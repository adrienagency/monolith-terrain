# La fenêtre continue 3×3 — plan d'optimisation chiffré

**Date** : 2026-07-29
**Cadre figé par Adrien** : « On va limiter à 3×3 au départ, et faire des recherches avancées sur toutes les optimisations de poids et de calcul qu'on peut faire. Optimisation et fluidité sont la priorité absolue. On est limité par ce 3×3, mais le socle reste existant, on peut juste se déplacer dans le clipmap 3×3. »
**Hors périmètre** : le mode isolé (découpage d'un pays/région) garde son comportement actuel — sa règle du point bas, son masque de découpe, son polygone Nominatim. Rien de ce document ne le touche.
**Nature du document** : ÉTUDE ET PLAN. **Aucune ligne de `src/` n'a été modifiée.** Les seuls fichiers écrits sont ce rapport, six bancs de mesure Node et un banc navigateur, tous jetables et hors dépôt (voir l'annexe).

---

## 0. La réponse en une page

**Trois choses ont changé pendant cette étude, et chacune rend le chantier plus petit que prévu.**

**1. Le chiffre de départ était périmé — dans le bon sens.** « Un 3×3 naïf = centre + 8 × 79 Mo = ~700 Mo » repose sur la mesure du 2026-07-27 **d'avant** la passe des plafonds. Depuis, `NEIGHBOUR_COAST_SIZE`, `NEIGHBOUR_ANALYSIS_SIZE` et `NEIGHBOUR_SEA_SIZE` sont tous à 1024 et le maillage voisin à 256. Recomptée poste par poste sur les modules réels (§2.1), **une dalle voisine d'aujourd'hui pèse 33,4 Mo, pas 79.** Un 3×3 en neuf dalles coûte donc **~430 Mo**, pas 700. On part de bien plus près qu'on ne le croyait.

**2. L'écrêtage à la fenêtre est déjà écrit, et le banc dit de ne pas y toucher.** `terrain.js:471-479` fait déjà, dans le fragment shader, exactement le « socle-masque d'écrêtage » qu'Adrien décrit : une superellipse en **coordonnées monde**, centrée sur `uBlockOffset`, avec `discard` au-delà. J'ai fait mesurer les quatre mécanismes possibles côte à côte, sur GPU réel (§3.5) : **à résolution normale ils sont strictement indiscernables — tous les écarts sont dans le bruit.** Et en régime de remplissage forcé, le classement est contre-intuitif : les `clippingPlanes` gagnent (−16 %), le `discard` de superellipse suit (−11 %), **et le stencil arrive DERNIER (−5 %)**. Migrer vers le stencil coûterait `stencil: true` sur le renderer — aujourd'hui explicitement `false` (`main.js:710`) — **et sur toute la chaîne de post-traitement**, pour un résultat mesuré moins bon. **La question est close : on garde le `discard` existant.**

**3. Et surtout : la bonne architecture n'est pas neuf dalles.** C'est **une seule géométrie, de la taille de la fenêtre, dont on ré-échantillonne les altitudes à chaque image dans un MNT 3×3 unique, avec un atlas de champs unique.** Mesuré (§3) :

| | 9 dalles qui défilent | **une fenêtre sur un atlas 3×3** |
|---|---:|---:|
| mémoire du terrain | ~430 Mo | **109 Mo** |
| **sommets traités par image** | **594 441** | **148 225** *(facteur 4)* |
| calcul par image pendant le drag | 0 ms *(mais pics de 380 ms aux promotions)* | **2,7 ms, sans aucun pic** |
| les 5 statistiques globales | à geler, une par une | **calculées une fois sur l'emprise, par construction** |
| coutures entre dalles | 4 à gérer | **aucune** |

**Le facteur 4 en mémoire et l'absence totale de pic viennent du même fait** : dans une emprise 3×3, la fenêtre ne bouge que de ±1 largeur de socle. Tout ce qu'elle pourra jamais montrer tient dans un objet fini qu'on peut fabriquer **une seule fois, au chargement**. C'est l'énorme avantage du 3×3 borné sur un clipmap infini, et il ne se récolte qu'en abandonnant le découpage en dalles.

⚠️ **Et la ligne des sommets est celle qui compte, un banc navigateur l'a tranché.** Sur une scène reproduisant exactement le cas — 9 dalles de 257² sommets, viewport 1280×800 — la décomposition donne : surcoût des appels de dessin **0,022 ms**, traitement des sommets et rastérisation **0,131 ms**, remplissage des pixels **0,000 ms** (le total avec 35 % d'écran couvert est identique au total avec 0 %, à 0,002 ms près, sous le bruit). **86 % du temps image part dans le traitement des 1,18 million de triangles**, dont l'immense majorité sont sous-pixel. **Passer de 9 appels de dessin à 1 ne rapporte RIEN de mesurable (+2,4 %, dans le bruit) ; diviser les sommets par 4 rapporte tout.**

**Les deux budgets que je propose et que je tiens** (§1) : **≤ 260 Mo de mémoire totale** en mode continu (contre 125 Mo pour le bloc seul aujourd'hui) et **≤ 6 ms de fil principal par image** pendant le drag. Les deux sont atteints avec de la marge par l'architecture ci-dessus.

**Et le levier de calcul le plus rentable du dossier n'a rien à voir avec le 3×3** : `computeVertexNormals` de three.js coûte **89,9 ms sur les 95 ms** que met à naître une dalle à res 768 — 81 % du total. Sur une **grille régulière**, la normale s'écrit par différences centrées en **5,10 ms**, soit **17,6× moins cher**, pour un écart angulaire moyen de **0,008°** (§2.4). C'est le même facteur 18 que Hoppe a obtenu en 2005 en passant sur GPU — mais ici en CPU pur, sans réécrire un shader, sans casser un seul test. **Ce gain vaut aujourd'hui, sur le zoom actuel, même si la fenêtre continue ne se fait jamais.**

Le jalon 1 est un drag laid mais réel en une poignée de jours (§6). Le critère d'abandon est en §7.

---

## 1. Les deux budgets

### 1.1 Mémoire — je propose 260 Mo, pas 350

Adrien propose ≤ 350 Mo. **Je propose plus serré, et voici pourquoi.**

Les faits mesurés :

| état | tas JS | source |
|---|---:|---|
| bloc central seul | **125 Mo** | campagne du 2026-07-27 |
| damier plein 24 voisines, avant plafonds | 1 824 Mo | idem, `test/damier-memoire.test.js` |
| damier plein 24 voisines, après plafonds | 1 049 Mo | idem |
| → **par dalle voisine, mesuré** | **(1 049 − 125) / 24 = 38,5 Mo** | dérivé |
| → **par dalle voisine, recompté poste par poste** | **33,4 Mo** | §2.1, banc de cette étude |

L'écart de 15 % entre le compté et le mesuré, c'est le coût des objets three.js, des shaders compilés et du déchet transitoire. **Ma comptabilité est donc bonne à 15 % près, et je l'utilise avec cette marge.**

Et la contrainte de la machine cible, vérifiée pendant cette étude : l'**iMac 21,5" Retina 4K Late 2015** porte un **Intel Iris Pro 6200**, dont Apple réserve **jusqu'à 1,7 Go de mémoire système** pour la fonction vidéo (spec Apple / EveryMac). Sa mémoire est de la **LPDDR3-1867 en double canal, soit ~30 Go/s** — *partagés avec le processeur*. (L'iMac 27" 5K de la même année a lui un Radeon R9 M380 avec 2 Go de GDDR5 dédiés ; c'est la configuration **la plus favorable** des deux.)

> **Sur cette machine, la contrainte n'est pas la capacité, c'est la bande passante.** 30 Go/s partagés, c'est ce qui doit porter le framebuffer Retina, les textures, les VBO et le travail du processeur en même temps. Un octet économisé en mémoire est aussi un octet non relu à chaque image.

**Le budget que je fixe :**

| | cible | justification |
|---|---:|---|
| **mode continu 3×3, total** | **≤ 260 Mo** | 2× le bloc seul d'aujourd'hui (125 Mo). Au-delà, on double encore l'empreinte d'un produit qui tient déjà juste sur l'iMac. |
| dont MNT de l'emprise | ≤ 45 Mo | poste irréductible, §2.3 |
| dont atlas de champs | ≤ 30 Mo | §2.2 |
| dont géométrie de la fenêtre | ≤ 40 Mo | §2.4 |
| dont le reste (socle, mer, calques, nuages) | ≤ 145 Mo | ce que le bloc actuel consomme déjà hors terrain |

**Pourquoi 260 et pas 350** : parce que l'architecture retenue y arrive avec **126 Mo pour le terrain, marge comprise** (§3.4) — soit à peu près ce que coûte le bloc central seul aujourd'hui. Fixer 350 reviendrait à autoriser un gaspillage dont on n'a pas besoin. **Un budget doit être un plafond atteignable et serré, pas un permis.**

⚠️ **Ce que ce budget ne couvre pas** : la VRAM. `usedJSHeapSize` ne voit pas les textures téléversées ni les canevas 2D (l'avertissement de `test/damier-memoire.test.js`). Les chiffres de ce document sont des **octets de données**, comptés une fois qu'ils soient en RAM ou en VRAM ; sur les postes qui vivent des deux côtés (masque côtier), je le dis explicitement.

### 1.2 Fil principal par image pendant le drag — je propose 6 ms

À 60 images/s on dispose de 16,7 ms. Le rendu en prend déjà 3 à 4. Il reste **~12 ms**.

Mais 12 ms est un plafond, pas un budget. Un budget doit laisser de la place à l'imprévu — un ramassage de mémoire, une arrivée réseau, un calque qui se met à jour, la simulation de la mer et des nuages. **Je fixe 6 ms**, la moitié de ce qui reste :

| poste, pendant le drag | budget | mesuré (§3.4) |
|---|---:|---:|
| altitudes de la fenêtre + normales | 4,0 ms | **2,33 ms** à res 384 · 9,71 ms à res 768 |
| socle mis à jour en place | 1,0 ms | **0,38 ms** à res 768 |
| calques qui suivent (étiquettes, tracés) | 1,0 ms | à mesurer, §5 |
| **total** | **6,0 ms** | **~2,7 ms** à res 384 |

Traduit en pixels de champ, avec les **164 ns/pixel** de `analyzeDem` : 6 ms = 36 600 pixels, soit un carré de 191². **Autrement dit : aucun recalcul de champ n'est possible pendant le drag, à aucune résolution utile.** C'est la contrainte qui décide de toute l'architecture, et c'est pour ça que le §3 choisit de tout précuire.

⚠️ **Et sur l'iMac 2015 ?** Elle est au palier 2 (`ALLÉGÉ`), qui vise déjà moins de 60 images/s. À 30 images/s elle dispose de 33 ms, donc de ~25 ms libres — **quatre fois le budget**. Le rapport du 2026-07-27 le dit déjà : *ce sont les pics qui la tuent, pas le régime permanent.* Une architecture sans pic lui convient mieux qu'à personne.

---

## 2. Le poste-par-poste : sept leviers, chiffrés

### 2.0 D'abord, la comptabilité exacte d'aujourd'hui

Mesurée au banc `bench-memoire.mjs`, sur les modules réels du dépôt, avec les constantes en vigueur (`NEIGHBOUR_RES = 256`, les trois champs à 1024) :

**Une dalle VOISINE, aujourd'hui :**

| poste | octets | où |
|---|---:|---|
| masque côtier — texture RGBA 1024² | 4,19 Mo | `coast-mask.js:147` (CanvasTexture) |
| masque côtier — le canevas 2D qui la porte | 4,19 Mo | `coast-mask.js:142-146`, hors tas |
| masque côtier — l'`ImageData` gardée pour les polders | 4,19 Mo | `block-grid.js:566` |
| MNT `Float32Array` 1536² | 9,00 Mo | `dem.js` |
| analyse de relief RGBA 1024² + mipmaps | 5,33 Mo | `terrain-jobs.js` |
| géométrie 257² sommets (pos+uv+index+normales+couleurs) | 4,27 Mo | `terrain.js:1189-1236` |
| `landMask` `Uint8Array` 1024², cuite depuis l'`ImageData` | 1,00 Mo | `terrain.js:1290` |
| masque de mer R8 1024² | 1,00 Mo | `terrain-jobs.js` |
| murs du socle, res 256 | 0,26 Mo | `plinth.js:87` |
| rugosité + bump + rampe | **0** | **déjà PARTAGÉS** — `shareTexturesFrom`, `block-grid.js:611` |
| **TOTAL** | **33,4 Mo** | |

> **Réponse à la question d'Adrien sur les textures identiques** : elles sont **déjà partagées**, pas dupliquées. `_applyLook` appelle `t.shareTexturesFrom?.(mt)` à chaque restyle (`block-grid.js:611`), et `_disposeCell` se désabonne avant de disposer, avec l'avertissement explicite « les disposer avec la cellule tuerait le relief principal et toutes les autres dalles d'un coup » (`block-grid.js:656-661`). **Ce poste est réglé, il ne reste rien à y gagner.**

**Le bloc CENTRAL, aujourd'hui** (res 768, côte 2048, analyse et mer 1536) :

| poste | octets |
|---|---:|
| masque côtier 2048² × 3 (texture + canevas + `ImageData`) | 50,33 Mo |
| géométrie 769² sommets | 38,31 Mo |
| analyse RGBA 1536² + mipmaps | 12,00 Mo |
| MNT `Float32Array` 1536² | 9,00 Mo |
| `landMask` 1536² + masque de mer R8 1536² | 4,50 Mo |
| rugosité + bump + rampe | 2,13 Mo |
| murs du socle res 768 | 0,79 Mo |
| **TOTAL** | **117,1 Mo** |

*(À rapprocher des 125 Mo de tas mesurés pour le bloc seul : l'écart de 7 %, c'est le reste de l'application.)*

**Donc : un 3×3 en neuf dalles = 117 + 8 × 33,4 = 384 Mo comptés, ~430 Mo mesurés.** Le chiffre de 700 Mo du cadrage était celui d'avant la passe des plafonds ; **il n'y a plus 340 Mo à trouver, il y en a 170.**

---

### 2.1 Le masque côtier — le pire poste, et le plus facile à réparer

**32 Mo à 2048², 12,6 Mo à 1024², en trois copies du même bit.** C'est le poste le plus lourd de la dalle, et il est lourd pour une raison bête : **c'est un masque binaire noir-et-blanc rangé en RGBA.**

Trois gestes, indépendants, cumulables :

**(a) Le format. RGBA → R8 : facteur 4.** Le masque ne porte qu'un bit d'information (terre / mer, plus un flou de 1,5 px pour lisser l'iso-0,5). Le shader n'en lit **que le canal rouge** (`terrain.js:505` : `texture2D(uCoastMask, cmUv).r`), et `maskUniformity` aussi (« ne lit que le canal rouge, pas l'alpha », `test/damier-memoire.test.js:165`). **Les canaux V, B et A sont du vide payé plein tarif.**
`RedFormat` + `UnsignedByteType` est un format obligatoire de WebGL2, color-renderable, sans extension. ⚠️ **Un seul piège, vérifié dans le source de r172** : `Texture.js:63` initialise `unpackAlignment = 4`, et une texture R8 dont la largeur n'est pas multiple de 4 se lit alors en biais. `DataTexture.js` surcharge à `1` — donc **passer par une `DataTexture` protège par construction**, et une `CanvasTexture` ne protège pas.

**(b) Le canevas. Le supprimer après conversion.** `rasterize()` (`coast-mask.js:122-159`) fabrique **deux** canevas (le net et le flouté) et rend une `CanvasTexture` qui **retient le canevas comme image source**. Une fois converti en `Uint8Array` R8, les deux canevas peuvent mourir. Gain : leur taille entière, hors tas.

**(c) L'`ImageData`. La libérer dès la `landMask` cuite.** Son unique consommateur est `landMaskFromImage(this._coastImage, taille)` (`terrain.js:1290`), qui en tire un `Uint8Array` de `taille²` — 1 Mo à 1024, contre 4,19 Mo pour l'`ImageData`. Une fois la `landMask` cuite, l'`ImageData` ne sert plus qu'à **deux choses** : son identité, comme clé de péremption (`terrain.js:1289`), et la re-découpe de zone du **mode isolé** (`block-grid.js:567`, « la découpe de zone la relit pour garder les polders »). **En mode continu, le mode isolé n'existe pas** — décision d'Adrien. La clé de péremption peut porter sur la `landMask` elle-même.

**Bilan du poste :**

| taille du masque | aujourd'hui (RGBA ×3 + landMask) | après (a)+(b)+(c) | gain |
|---:|---:|---:|---:|
| 1024² (voisine) | **13,58 Mo** | **2,05 Mo** | **−11,5 Mo** |
| 2048² (centre) | **52,58 Mo** | **8,25 Mo** | **−44,3 Mo** |

> **Sur un 3×3 en neuf dalles, ce seul geste rend 136 Mo.** C'est plus que tout le reste du plan d'optimisation réuni, et il vaut **aussi pour le damier d'aujourd'hui** — donc il est rentable même si la fenêtre continue ne se fait jamais.

**À quelle taille l'œil ne voit-il plus la différence ?** Le socle occupe environ 800 pixels d'écran pour 56 unités-monde, soit **14,3 px écran par unité**. Un masque de côté `C` sur ces 56 unités donne `C/56` texels par unité, donc **un texel de masque vaut `800/C` pixels d'écran** :

| masque | texels/unité | 1 texel = ? pixel d'écran | verdict |
|---:|---:|---:|---|
| 2048 (centre) | 36,6 | 0,39 px | sur-échantillonné ×2,5 |
| 1024 (voisine) | 18,3 | 0,78 px | encore sous le pixel |
| **768** | **13,7** | **1,04 px** | **exactement un pixel — la limite** |
| 512 | 9,1 | 1,56 px | visible sur un trait de côte droit |

Le masque est **pré-flouté à 1,5 px** avant d'être téléversé (`coast-mask.js:145`), et le shader coupe à l'iso-0,5 : le contour est donc **filtré, pas escalier**, ce qui pardonne beaucoup. **768 est le plancher défendable ; 1024 garde une marge d'un cran.** ⚠️ Ce raisonnement est géométrique, pas perceptif : je n'ai pas fait de comparaison d'images côte à côte, c'est l'essai qu'il faudra faire au jalon 2.

---

### 2.2 L'analyse de relief — la recuire une fois, sur l'emprise entière

**Aujourd'hui : 5,33 Mo et 244 ms par dalle voisine (RGBA 1024² + mipmaps).**

Le coût est mesuré linéaire en pixels de sortie, à **164 ns/pixel** (mesure du 2026-07-27, reproduite ici : 393 ms pour 1536², contre 384 ms annoncés — **les deux bancs sont d'accord à 2 % près**, ce qui valide la machine de mesure).

**Les trois sorties, pesées :**

**(1) En Worker — déjà fait, et ça ne suffit pas.** `terrain-jobs.js` déporte déjà `analyzeDem` et `buildSeaMask`, et son propre en-tête le dit : *« ces ~470 ms ne DISPARAISSENT PAS en migrant dans un Worker — elles cessent seulement de figer l'onglet. »* Pendant un drag, une dalle qui met 300 ms à recevoir son analyse est une dalle **grise pendant 300 ms**. Le Worker règle le gel, pas l'attente.

**(2) En fragment shader (la piste Hoppe, facteur 18).** Structurellement possible — l'analyse est une pile d'une dizaine de flous par boîte à rayons doublants, donc une pyramide, donc des mipmaps et des passes de fragment. Mais c'est une **réécriture, pas un portage** : les flous CPU utilisent des sommes glissantes en O(1) par pixel quel que soit le rayon, technique qui n'existe pas en fragment shader. Et `test/terrain-jobs.test.js` **verrouille l'égalité octet pour octet** sur quatre familles de relief : une version GPU ne le passera jamais, il faudra le remplacer par un test de tolérance. **C'est la sortie la plus chère, et le 3×3 borné la rend inutile.**

**(3) La cuire UNE FOIS sur l'emprise 3×3, au chargement. C'est la bonne, et c'est celle que le 3×3 borné offre gratuitement.** Mesuré (`bench-atlas.mjs`, MNT source 4608²) :

| atlas | densité sur les 168 unités | cuisson (analyse + mer) | mémoire RGBA+mips |
|---:|---:|---:|---:|
| 1024² | 6,1 px/u | **425 ms** | 5,3 Mo |
| **1536²** | **9,1 px/u** | **563 ms** | **12,0 Mo** |
| 2048² | 12,2 px/u | 1 306 ms | 21,3 Mo |
| **2304²** | **13,7 px/u** | **1 048 ms** | **27,0 Mo** |
| 3072² | 18,3 px/u | 2 796 ms | 48,0 Mo |

*(Rappel : le centre d'aujourd'hui est à **27,4 px/u**, une voisine à **18,3 px/u**.)*

Et la comparaison qui tranche :

> **Neuf dalles cuites séparément (analyse 1024² chacune) : 9 × 307 = 2 767 ms.**
> **Un atlas 2304², à la MÊME densité que neuf dalles à 768² : 1 378 ms.**
> **Deux fois moins cher, et il n'y a plus qu'un objet.**

**Mon choix : l'atlas à 2304² (27,0 Mo, 1,05 s de cuisson au chargement, en Worker).** C'est 13,7 px/u contre 18,3 pour une voisine actuelle — un cran plus grossier, mais **la règle de `test/damier-memoire.test.js` est largement tenue** : à un maillage de fenêtre de res 384 (6,9 sommets/u), 13,7 px/u fait **1,99×**, quand la règle autorise 4×.

⚠️ **Une seconde de cuisson au chargement, c'est long.** Deux atténuations : elle est en Worker (aucun gel), et elle se fait **une seule fois** au lieu de se répéter à chaque changement de bloc. Le jalon 3 devra vérifier qu'elle tient derrière le voile de chargement existant.

---

### 2.3 Le MNT — l'`Int16` est gagnant sur les deux tableaux

**Aujourd'hui : `Float32Array` 1536² = 9,00 Mo par dalle. Sur une emprise 3×3 à la même densité (4608²) : 81 Mo.** C'est le poste le plus lourd de l'architecture retenue.

Le test le protège nommément — « le MNT, lui, n'est PAS réduit : exception assumée, pas oubli » — parce qu'il est lu par le **processeur** (veille devant l'étrave des bateaux, tracé de la jupe, orographie des nuages) et que le réduire échangerait de la mémoire contre de la qualité.

**Mais le test protège sa RÉSOLUTION, pas son TYPE.** Passer de `Float32` à `Int16` en mètres entiers ne retire **aucun échantillon** : c'est un autre geste, et il ne coûte rien à la qualité.

**Mesuré (`bench-rebuild.mjs`) :**

| | mémoire (4608²) | 2 000 000 lectures bilinéaires |
|---|---:|---:|
| `Float32Array` | **81,0 Mo** | **42,5 ms** (21,2 ns/lecture) |
| `Int16Array` | **40,5 Mo** | **38,5 ms** (19,3 ns/lecture) — **9,5 % plus RAPIDE** |

> **L'`Int16` divise la mémoire par deux ET accélère la lecture de 9,5 %** — meilleure localité de cache : deux fois plus d'échantillons par ligne de cache. C'est rare, un levier qui gagne des deux côtés.

**Et la précision ?** L'arrondi au mètre donne ±0,5 m. À z12, avec l'échelle du dépôt (`TERRAIN_SIZE / extentMeters × exagération`, exagération 3), cela fait **±0,00307 unité-monde**, soit **±0,044 pixel d'écran**. Invisible. Et la marge de l'`Int16` (±32 767 m) couvre l'Everest et la fosse des Mariannes avec un facteur 3.

⚠️ **Deux réserves honnêtes.** (1) L'étude clipmap a mesuré que **58 % d'une tuile terrarium z12 est du bruit sub-métrique** — c'est bien ce bruit qu'on jette, et il ne sert à rien sur une carte stylisée ; mais je ne l'ai pas vérifié sur un relief très plat, où le mètre pourrait se voir sur une pente douce. (2) `dem.data` est consommé par `analyzeDem`, `buildSeaMask`, `resampleField`, `sampleDem` et le tracé de la jupe : passer au `Int16` demande de vérifier chacun. Aucun ne fait d'arithmétique qui exige le `Float32` — mais c'est une lecture à faire, pas une supposition.

---

### 2.4 La géométrie — et le levier le plus rentable de tout le dossier

**Aujourd'hui : 4,27 Mo à res 256, 38,31 Mo à res 768.**

**(a) `uv` et `index` sont partageables et ne le sont pas.** `grid-template.js` mémorise déjà les **tableaux** et `terrain.js:1192-1193` les branche tels quels (« `uv` et `index` sont branchés TELS QUELS parce que personne ne les écrit »). Mais chaque `rebuild` fabrique un **`BufferAttribute` neuf** autour du même tableau — et three.js indexe ses VBO par `BufferAttribute`, pas par tableau. **Côté carte graphique, chaque dalle a donc son propre VBO d'`uv` et d'`index`, alors que le contenu est identique.**

| res | `uv` + `index` par dalle | part du total |
|---:|---:|---:|
| 256 | 2,00 Mo | **47 %** |
| 384 | 4,51 Mo | 47 % |
| 768 | 18,01 Mo | 47 % |

Mémoriser le `BufferAttribute` au lieu du seul tableau rend **2,00 Mo × 8 = 16 Mo** de VRAM sur un 3×3 en dalles. ⚠️ Le geste a un piège nommé dans `grid-template.js` : *« si un jour du code se met à écrire dedans (un `applyMatrix4` sur les uv, un `toNonIndexed`), il faudra copier — et le bug se verrait sur tous les blocs à la fois. »* Partager le `BufferAttribute` **aggrave** ce piège, il faut un test qui le verrouille. *(Ce levier devient sans objet dans l'architecture retenue, qui n'a qu'une seule géométrie — mais il vaut pour le damier d'aujourd'hui.)*

**(b) Les normales — 17,6× de gain, en CPU pur.**

Mesuré (`bench-normales.mjs`), fabrication d'une dalle, poste par poste :

| res | gabarit + copie | échantillonnage | **`computeVertexNormals`** | teintes | total |
|---:|---:|---:|---:|---:|---:|
| 256 | 0,13 ms | 0,46 ms | **8,15 ms** | 1,12 ms | 9,86 ms |
| 384 | 0,28 ms | 1,66 ms | **20,41 ms** | 2,50 ms | 24,85 ms |
| 512 | 0,48 ms | 2,89 ms | **34,45 ms** | 4,42 ms | 42,24 ms |
| 768 | 1,41 ms | 6,74 ms | **76,98 ms** | 9,95 ms | 95,09 ms |

> **`computeVertexNormals` pèse 81 % de la fabrication d'une dalle.** C'est exactement le résultat de Hoppe en 2004 (la carte de normales à 11 ms sur les 21-26 ms d'une mise à jour de niveau — « plus de la moitié du budget »).

La cause : `computeVertexNormals` est **générique**. Il parcourt les triangles indexés, calcule une normale de face par produit vectoriel, l'accumule sur ses trois sommets, puis normalise tout. Sur une grille régulière, c'est du travail perdu : la normale s'écrit directement par **différences centrées sur les quatre voisins**, en O(1) par sommet, sans jamais toucher à l'index.

| res | `computeVertexNormals` | **normales de grille** | facteur | écart angulaire moyen |
|---:|---:|---:|---:|---|
| 256 | 9,78 ms | **0,61 ms** | **16,1×** | 0,041° (pire 3,03°) |
| 384 | 17,67 ms | **1,38 ms** | **12,9×** | 0,018° (pire 2,04°) |
| 512 | 32,27 ms | **2,27 ms** | **14,2×** | 0,012° (pire 1,53°) |
| 768 | 89,87 ms | **5,10 ms** | **17,6×** | 0,008° (pire 1,02°) |

**Un écart moyen de 0,008° sur 591 361 sommets**, et le pire cas (1,02°) est **sur les bords**, où la différence décentrée remplace la centrée — exactement les sommets que le `discard` de la superellipse jette. **Le résultat est le même à l'œil, il est 17,6 fois moins cher, et il ne touche à aucun test.**

> ⚠️ **Ce levier vaut MAINTENANT, sur le zoom d'aujourd'hui.** Le rapport du 2026-07-27 a fait passer une reconstruction complète du bloc de 853 à 600 ms au Mont-Blanc à res 1024 ; **ce geste-ci en retire encore ~85 ms à res 768 et ~110 ms à res 1024.** C'est le meilleur rapport gain/risque du dossier, et il est indépendant de tout le reste. **À faire même si la fenêtre continue est abandonnée.**

**(c) Quelle résolution pour la fenêtre ?** La comparaison avec l'état de l'art, reprise de l'étude clipmap : Mapbox GL JS et MapLibre travaillent à **128×128 par tuile**, NASA WorldWind à 32×32, Cesium à 1 000-4 200 sommets par tuile. ShibuMap aligne **591 361 sommets pour 21 km**, soit 1,18 million de triangles là où le clipmap de Hoppe en met 460 000 **pour les États-Unis entiers à 30 m**.

À l'écran, res 768 donne **13,7 sommets par unité** pour **14,3 pixels par unité** : un sommet par pixel. C'est le point où ajouter des sommets ne peut plus rien montrer. **res 384 donne un sommet pour deux pixels — encore trois fois plus dense que Mapbox**, et c'est ce que je retiens pour le mode continu.

---

### 2.5 Le masque de mer — le seul poste déjà optimal

R8, plafonné à 1024² sur une voisine (`NEIGHBOUR_SEA_SIZE`), **1,00 Mo**. C'est déjà le bon format, la bonne taille et la bonne règle. **Rien à y gagner.**

Ce qui change en 3×3, c'est sa **topologie**, et c'est traité en §4.3.

---

### 2.6 Le socle — reconstruit à chaque image pour 0,38 ms

**C'est le poste que le mode continu invente.** Aujourd'hui le mur du socle est cuit une fois par bloc ; quand le terrain défile sous une fenêtre fixe, la coupe verticale au bord de la fenêtre balaye un relief différent **à chaque image**.

Mesuré (`bench-socle.mjs`, le terrain défilant vraiment de 0,05 unité par image) :

| res | `buildSlabWalls` tel qu'il est | dont l'anneau (échantillonnage du relief) | dont la géométrie |
|---:|---:|---:|---:|
| 256 | 1,81 ms | 0,04 ms | **1,56 ms (98 %)** |
| 768 | 5,41 ms | 0,08 ms | **4,02 ms (98 %)** |

> **L'échantillonnage du relief ne coûte RIEN (0,08 ms pour 3 013 sondages). Les 98 % restants sont de l'allocation** : `positions.push()` sur des tableaux JavaScript, et **six `new THREE.Vector3` par segment de l'anneau** (`plinth.js`, `pushTri`).

Or **la topologie du mur ne change jamais quand la fenêtre glisse** : le contour (x, z) est celui de la fenêtre, il est fixe. Seuls les Y du haut du mur et le `baseY` bougent. C'est le cas d'école du buffer dynamique. Réécrit en `Float32Array` pré-alloués, mis à jour en place, avec `DynamicDrawUsage` :

| res | naïf (aujourd'hui) | **en place** | facteur | sommets de mur |
|---:|---:|---:|---:|---:|
| 256 | 1,81 ms | **0,135 ms** | **13,4×** | 8 676 |
| 384 | 2,40 ms | **0,205 ms** | **11,7×** | 12 996 |
| 512 | 3,35 ms | **0,286 ms** | **11,7×** | 17 352 |
| 768 | 5,41 ms | **0,384 ms** | **14,1×** | 26 028 |

**0,38 ms sur un budget de 6 ms : le socle qui suit le terrain coûte 6 % du budget.** Le poste est réglé.

⚠️ **Mais il pose LA question produit du dossier.** `computeSlab` rend `baseY = globalMin − depth`, où `globalMin` est le point le plus bas **sous la fenêtre**. Quand le terrain défile, ce minimum change en permanence : **le socle entier monterait et descendrait pendant le drag** — dalle, sol de studio, flaque de verre, liseré, et le placage des flancs avec (leurs UV sont calculés en `(y − baseY) / UVSCALE`).

> **En 3×3 borné, la sortie est immédiate et elle est propre : `globalMin` se calcule UNE FOIS sur l'emprise 3×3 entière, au chargement.** Le socle est alors garanti de ne jamais être percé, où que la fenêtre aille, et il ne bouge plus jamais. Le mécanisme existe déjà : `buildSlabWalls` accepte un `baseYFloor` (`plinth.js:87-93`), et le damier s'en sert déjà pour partager le fond du bloc central.
> ⚠️ **La contrepartie est réelle et Adrien doit la connaître** : la règle « le point le plus bas de la zone touche la dalle » devient « **le point le plus bas de l'EMPRISE 3×3 touche la dalle** ». Si l'emprise contient une fosse profonde hors de la vue courante, le socle est plus épais qu'il ne le serait aujourd'hui — le relief visible « flotte » un peu plus haut au-dessus de la dalle. **C'est une décision de produit, pas d'ingénierie.** Une atténuation possible : prendre non pas le minimum absolu de l'emprise, mais le 2e centile de son histogramme, en gardant `baseYFloor` comme garde-fou anti-perçage.

---

### 2.7 Récapitulatif des sept leviers

| # | levier | gain mémoire | gain calcul | vaut aussi hors 3×3 ? | risque |
|---|---|---:|---:|:---:|---|
| 1 | masque côtier en R8, sans canevas ni `ImageData` | **−11,5 Mo/dalle** (−44 sur le centre) | — | **oui** | alignement `unpackAlignment` |
| 2 | **normales de grille au lieu de `computeVertexNormals`** | — | **−85 ms** par dalle à res 768 (**17,6×**) | **oui** | écart 0,008°, à valider à l'œil |
| 3 | MNT en `Int16` | **−50 %** (−40,5 Mo sur l'emprise) | **−9,5 %** de lecture | **oui** | 5 consommateurs à relire |
| 4 | socle mis à jour en place | — | **−5,0 ms** par image (**14,1×**) | non | aucun (topologie fixe) |
| 5 | `uv` + `index` en `BufferAttribute` partagé | **−16 Mo** sur un 3×3 en dalles | — | **oui** | aggrave un piège déjà nommé |
| 6 | atlas de champs cuit une fois sur l'emprise | **−22 Mo** vs 9 dalles | **−1 389 ms** au chargement (2×) | non | 1 s de cuisson au chargement |
| 7 | une géométrie au lieu de neuf | **−280 Mo**, 9 appels de dessin → 1 | — | non | c'est l'architecture, §3 |

---

## 3. Le défilement lui-même — trois options, une tranchée

### 3.0 Le geste existe déjà, et il n'est même pas borné

Vérifié dans le code : **`controls.enablePan = true` en mode surface** (`modes.js:382`), et **aucun clamp de `controls.target` nulle part dans `src/`**. Le clic droit et la translation à deux doigts font donc **déjà** un pan libre et illimité — sauf qu'ils déplacent la *caméra*, et que le terrain s'arrête au bord du bloc.

| geste, mode surface | qui le capte | effet aujourd'hui |
|---|---|---|
| clic gauche + drag | `OrbitControls` | rotation orbitale, avec inertie |
| clic gauche bref | `main.js:1716-1735` (`isTap()`) | **plongée au point cliqué** |
| **clic droit + drag** | `OrbitControls` (`MOUSE.PAN`) | **pan libre, non borné** |
| molette | `modes.js:134` | escalier de zoom maison |
| deux doigts, écartement | `modes.js:145-157` (`PinchTracker`) | zoom par paliers |
| **deux doigts, translation** | `OrbitControls` (`TOUCH.DOLLY_PAN`) | **pan libre** |

> **Rien à débloquer. Le chantier est de DÉTOURNER ce geste — déplacer le contenu au lieu de la caméra — et de le BORNER à l'emprise 3×3.**
> ⚠️ **Attention au clic gauche : il est déjà doublement pris** (rotation *et* plongée). Si « le visiteur drague » doit se faire au bouton gauche, il entre en collision avec les deux. Le clic droit est libre de conflit ; le tactile à deux doigts aussi.

### 3.1 La course réelle du 3×3 — à dire à Adrien avant tout le reste

Une fenêtre de 56 unités dans une emprise de 168 se déplace de **±56 unités**, soit **±1 largeur de socle**. Pas plus.

| zoom | un bloc | emprise 3×3 | **course dans chaque direction** |
|---:|---:|---:|---:|
| z10 | 83 km | 250 km | **±83 km** |
| z11 | 42 km | 125 km | **±42 km** |
| z12 | 21 km | 62 km | **±21 km** |
| z13 | 10 km | 31 km | **±10 km** |

*(Calculé à latitude 45° : 156 543 × cos(lat) / 2^zoom mètres par pixel de tuile 256, × 1 536 pixels de MNT.)*

C'est significatif — à z12 on va d'Annecy à Chamonix — mais c'est **borné, et le bord se sent**. La question produit qui va avec : **que se passe-t-il quand on pousse au bord ?** Trois réponses possibles, à trancher par Adrien : (1) le drag résiste avec un rappel élastique, comme un défilement de liste iOS ; (2) le drag s'arrête net ; (3) atteindre le bord **recentre l'emprise** et recharge un nouveau 3×3 derrière un voile — on retrouve le geste d'aujourd'hui, mais une fois tous les 56 unités au lieu d'à chaque zoom.

### 3.2 Les trois mécanismes, pesés

**(a) Déplacer les 9 maillages et les écrêter au socle.**
On garde le damier, on met les 9 dalles dans un groupe, on translate le groupe, et le `discard` de superellipse est recentré sur la fenêtre au lieu de chaque dalle.

- *Coût par image* : 9 écritures de `mesh.position` + 9 uniformes `uBlockOffset` = **négligeable**, littéralement 18 écritures de flottants.
- *Coût mémoire* : **~430 Mo** (§2.0), ramené à **~250 Mo** avec les leviers 1, 3 et 5. C'est tout juste dans le budget.
- *Coût d'écrêtage* : nul en plus — le `discard` existe. ⚠️ Mais les 9 dalles sont dessinées **entières** (9 appels de dessin, 9 × 131 000 triangles à res 256) alors que 5 d'entre elles sont **toujours entièrement hors de la fenêtre** : c'est du travail de sommets intégralement jeté au fragment. Un test de frustum ne les sauve pas — elles sont dans le champ de la caméra, c'est le `discard` qui les tue, trop tard.
- *Le vrai défaut* : **les coutures.** Chaque dalle a son `robustScale`, son analyse, son masque de mer, sa topologie. L'audit l'a confirmé et c'est le point le plus dur : **`robustScale` dépend de la RÉSOLUTION du champ, pas seulement de son contenu** — `textureShade` floute à des rayons de 1, 2, 4 … 32 **pixels** (`terrain-analysis.js:129-130`), donc à moitié de résolution ces rayons couvrent deux fois plus de terrain et l'amplitude du champ change. En mode continu, où **n'importe quelle dalle peut se retrouver sous la fenêtre**, il faudrait mettre les neuf à la même résolution d'analyse **et** partager un p95 unique, ce qui oblige à scinder `analyzeDem` en trois temps (les neuf `textureShade`, puis un p95 global, puis les neuf `encodeTextureShade`) — et à sérialiser ce qui est aujourd'hui parallélisable par dalle.
- **Verdict : ça marche, c'est le chemin le plus court, et c'est le plus mauvais à long terme.** Neuf fois les mêmes problèmes à recoudre.

**(b) Une seule grande géométrie 3×3, et le socle en stencil.**
Un maillage unique de 168×168 unités, écrêté à la fenêtre.

- *Coût mémoire* : à la densité de res 384 sur 56 unités, une grille 3×3 fait **1153² sommets = 86 Mo** — plus que les 9 dalles séparées, pour la même densité. Et **91 % de ces sommets sont écrêtés en permanence** (la fenêtre couvre 1/9 de l'emprise).
- **Verdict : non. On paie neuf fois la géométrie pour en montrer un neuvième.**

**(c) Une géométrie de la taille de la FENÊTRE, ré-échantillonnée dans un MNT 3×3.**
C'est le vrai clipmap, à un seul niveau (la caméra de ShibuMap reste à distance quasi constante, `controls.maxDistance × 0.97` — l'étude clipmap a montré que les anneaux multi-résolution n'y servent à rien). La géométrie ne bouge jamais ; ce sont ses **altitudes** qui défilent.

- *Coût par image, mesuré* (`bench-normales.mjs`, terrain défilant vraiment) :

| res de la fenêtre | ré-échantillonnage des Y | normales de grille | **total par image** |
|---:|---:|---:|---:|
| **384** | 1,03 ms | 1,30 ms | **2,33 ms** |
| 768 | 4,49 ms | 5,22 ms | 9,71 ms |

- *Coût mémoire* : **109 Mo de terrain nu, 126 Mo avec la marge** (§3.4).
- **Sommets traités par image : 148 225 au lieu de 594 441 — facteur 4 sur le poste qui pèse 86 % du temps GPU** (§3.5). C'est le seul gain de rendu réel des trois options, et c'est le plus gros.
- *Coutures* : **aucune. Il n'y a qu'un objet.**
- *Les statistiques globales* : **résolues par construction**, il n'y a qu'un champ, une résolution, un p95, une topologie (§4).
- ⚠️ *Ce que ça coûte en échange* : **du temps processeur là où il n'y en avait pas.** Les autres options ne calculent rien par image ; celle-ci ré-échantillonne 148 225 altitudes et autant de normales. C'est le marché du plan : **2,33 ms de processeur par image contre 320 Mo de mémoire et 446 216 sommets par image.** Sur une machine dont la contrainte est la bande passante mémoire — l'iMac 2015, 30 Go/s partagés — c'est le bon sens du marché.

> ⚠️ **Et l'option torique (`copyTextureToTexture`) ?** Elle n'est pas nécessaire ici, et la recherche a montré qu'elle est plus chère qu'annoncé. En r172, `copyTextureToTexture` fait **cinq `gl.getParameter` par appel** — cinq allers-retours synchrones vers le processus GPU — plus deux `bindFramebuffer`, deux `framebufferTexture2D` et trois `pixelStorei`, **même sur le chemin GPU vers GPU où ils ne servent à rien**. Et son chemin dépend d'une condition non documentée (`properties.has(srcTexture)`) : une `DataTexture` jamais liée déclenche un **upload processeur**, une déjà liée fait une copie GPU **de l'état GPU, pas de la RAM**. `copyFramebufferToTexture` est bien moins cher (un seul appel GL utile) mais exige que la source soit le framebuffer courant.
> **Dans une emprise BORNÉE, il n'y a rien à mettre à jour torique : tout l'atlas tient en mémoire dès le chargement.** La mise à jour torique est la réponse à un monde infini. On n'en a pas un.

### 3.3 Ce que je tranche

> **Option (c) : une géométrie de la taille de la fenêtre, un MNT 3×3 unique, un atlas de champs unique, tous fabriqués une fois au chargement.**
>
> **Le rendu ne change pas de nature : c'est le même mesh, le même matériau, le même `discard` de superellipse, les mêmes uniformes. Ce qui change, c'est que la géométrie cesse d'être une PHOTOGRAPHIE du bloc pour devenir une FENÊTRE sur un MNT plus grand.**

Et le détail qui rend la migration douce : **le shader n'a presque rien à changer.** Les six lectures de texture du fragment sont toutes de la forme `(vWorldPos.xz − uBlockOffset) / (uSlabHalf × 2) + 0.5` (`terrain.js:469, 495, 504, 561, 661, 706`). Avec un atlas 3×3 elles deviennent `(vWorldPos.xz − uAtlasOrigin) / (uSlabHalf × 6) + 0.5` — **un uniforme de plus, un facteur 3, six lignes touchées.** Et le clip de la superellipse (`terrain.js:475`) ne bouge **pas du tout** : il y a un seul mesh, centré à l'origine, donc `uBlockOffset` y vaut zéro et le clip est déjà exactement la fenêtre.

`loadDem` aide aussi : il accepte **déjà** un `tilesAcross` arbitraire (`dem.js:140`) et un `originTile` explicite. ⚠️ Mais ne lui demandez **pas** `tilesAcross: 9` d'un coup : il peindrait un canevas 4608², en lirait l'`ImageData` et le décoderait en `Float32Array` — **un pic transitoire de ~255 Mo**, inacceptable sur l'iMac. **Il faut neuf appels à `tilesAcross: 3` avec neuf `originTile`, recollés dans un `Int16Array` unique** — c'est exactement ce que `block-grid.js:395` calcule déjà (`originTileX + i × tilesAcross`), et le cache à trois étages du damier évite les re-téléchargements.

### 3.4 Le budget de l'architecture retenue

| poste | taille | octets | source |
|---|---|---:|---|
| MNT de l'emprise 3×3, `Int16` | 4608² | **40,5 Mo** | §2.3 |
| atlas d'analyse, RGBA + mipmaps | 2304² | **27,0 Mo** | §2.2 |
| atlas de masque côtier, R8 | 3072² | **9,0 Mo** | §2.1 |
| atlas de masque de mer, R8 | 2304² | **5,1 Mo** | §2.5 |
| `landMask` de l'atlas, `Uint8` | 2304² | **5,1 Mo** | §2.1 |
| géométrie de la fenêtre, res 384 | 385² | **9,6 Mo** | §2.4 |
| murs du socle, res 384, dynamiques | 12 996 sommets | **0,4 Mo** | §2.6 |
| rugosité + bump + rampe | — | **2,1 Mo** | inchangé, déjà partagées |
| grain FBM pré-cuit sur l'emprise | 1153² × 2 | **10,6 Mo** | §5.4 |
| **TOTAL TERRAIN** | | **109,4 Mo** | |
| marge de 15 % (objets three.js, shaders, déchet) | | **16,4 Mo** | §1.1 |
| **TOTAL AVEC MARGE** | | **125,8 Mo** | |

**Contre les ~430 Mo d'un 3×3 en neuf dalles. Et contre les 117 Mo du bloc central seul aujourd'hui : le mode continu 3×3 coûterait à peu près la même chose que le bloc unique d'aujourd'hui.**

Il reste **134 Mo de marge** sur le budget de 260 Mo pour le reste de l'application (mer, nuages, calques, trafic, GPX) — qui existe déjà et n'augmente pas.

Et si Adrien veut la fenêtre à res 768 (le grain d'aujourd'hui) : +28,7 Mo de géométrie et le coût par image passe de 2,33 à 9,71 ms. **Ça ne tient dans le budget de 6 ms que sur les paliers 0 et 1.** Ma proposition : **res 384 pendant le drag, res 768 au repos** — le raffinement au repos ne coûte que 95 ms une fois le geste terminé, et c'est le seul endroit du plan où un pic est acceptable.

### 3.5 Le banc navigateur — ce que le GPU dit vraiment

Mesuré sur GPU réel (Chrome en mode fenêtré, `EXT_disjoint_timer_query_webgl2` disponible, three r172, 9 maillages de 257² sommets = 1 179 648 triangles, viewport 1280×800, `MeshStandardMaterial` + une lumière directionnelle). ⚠️ **La machine est une RTX 3080, pas un iMac 2015 : seuls les RAPPORTS sont exploitables, pas les valeurs absolues.**

**Les quatre mécanismes d'écrêtage, à résolution normale :**

| mécanisme | temps par image | écart avec « ne rien écrêter » |
|---|---:|---:|
| (A) rien | 0,1270 ms | référence |
| (B) 4 puis 8 `clippingPlanes` | 0,1277 ms | **+0,5 %** |
| (C) `discard` de superellipse *(l'existant)* | 0,1267 ms | **−0,3 %** |
| (D) stencil | 0,1267 ms | **−0,3 %** |

**Tous les écarts sont dans le bruit** (dispersion inter-répétitions : 0,001 à 0,008 ms). La décomposition explique pourquoi :

| | temps par image |
|---|---:|
| surcoût des 9 appels de dessin (géométrie réduite à 9×9 sommets) | **0,022 ms** |
| traitement des sommets + rastérisation, fenêtre fermée (0 % d'écran couvert) | **0,131 ms** |
| la même scène avec 35 % d'écran réellement rempli | **0,131 ms** |
| → **coût du remplissage** | **0,000 ms** |

> **86 % du temps image part dans le traitement des 1,18 million de triangles.** Le remplissage des pixels ne coûte rien de mesurable. **Écrêter ne supprime que la part qui est déjà gratuite.**

**En régime de remplissage forcé** (dalles allégées à 65² sommets, densité de pixels ×3 — pour renverser le rapport sommets/pixels), un classement apparaît enfin :

| mécanisme | écart avec (A) |
|---|---:|
| (B) 8 `clippingPlanes` | **−16,8 %** |
| (B) 4 `clippingPlanes` | −15,8 % |
| (C) `discard` de superellipse | **−10,6 %** |
| **(D) stencil** | **−4,8 %** — **le pire des trois** |

**Deux enseignements qui vont à l'encontre de l'intuition, et de la littérature :**

1. **Le stencil arrive dernier.** La théorie dit qu'il devrait gagner, parce qu'il rejette avant le fragment shader et préserve l'early-Z que le `discard` détruit. Mesuré, il perd — et il coûterait en plus `stencil: true` sur le renderer et sur toute la chaîne de post-traitement. **On garde le `discard`.**
2. **Les `clippingPlanes` sont exactement le MÊME mécanisme que le `discard`.** Lecture du source r172 : `clipping_planes_fragment` fait `if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;`. Aucun écrêtage matériel n'est utilisé. **(B) gagne sur (C) uniquement parce qu'un produit scalaire coûte moins que deux `pow()`.**
   → **Petit levier repérable** : le test de superellipse de `terrain.js:478` fait `pow(pow(cq.x, n) + pow(cq.y, n), 1/n)` **à chaque fragment**. Pour l'exposant 2 (le cas par défaut, `uSlabCornerN = 2`), c'est un simple `length(cq)` — **et la comparaison peut se faire au carré, sans aucune racine.** Gain estimé de l'ordre de 6 % en régime remplissage, pour trois lignes de GLSL.

**Neuf maillages contre un seul, à nombre de sommets équivalent** (9 × 257² = 594 441 contre 1 × 769² = 591 361) :

| | appels de dessin | temps par image |
|---|---:|---:|
| 9 maillages | 9 | 0,1270 ms |
| 1 maillage | 1 | 0,1300 ms (**+2,4 %**) |

> **Aucun gain à réduire le nombre d'appels de dessin.** Le prix d'un appel est de 0,0024 ms, négligeable devant les 0,13 ms de la géométrie. **C'est le nombre de SOMMETS qui décide, pas le nombre d'appels** — et c'est exactement ce que l'architecture retenue divise par 4.

**`copyTextureToTexture`, et pourquoi il ne faut pas y compter :**

| opération | temps par appel |
|---|---:|
| `copyTextureToTexture`, bande 256×1024, source déjà liée (chemin GPU) | 0,220 ms |
| `copyTextureToTexture`, bande 256×1024, source jamais liée (chemin processeur) | 0,528 ms |
| **dont : les 5 `gl.getParameter(UNPACK_*)` seuls, sans rien copier** | **0,131 ms** |
| la copie réelle (`copyTexSubImage2D` en WebGL brut) | **0,004 ms** |
| **`copyFramebufferToTexture`, même bande** | **0,0055 ms — 40× moins cher** |
| ré-upload complet d'un 1024² RGBA (`needsUpdate = true`) | 1,316 ms |
| ré-upload complet d'un 1024² **R8** | **0,383 ms — 3,4× moins cher** |

Trois confirmations : **(1)** `copyTextureToTexture` passe 60 % de son temps dans cinq lectures d'état synchrones qui ne servent à rien sur le chemin GPU — c'est un argument de plus contre la mise à jour torique ; **(2)** `copyFramebufferToTexture` est la seule primitive vraiment bon marché, et c'est elle qu'il faudrait employer si l'aérien devait défiler (§5.3) ; **(3)** le **R8 est 3,4× moins cher à téléverser que le RGBA**, ce qui ajoute un gain de bande passante au gain de mémoire du levier 1.

---

## 4. Les statistiques globales sur l'emprise 3×3 — vérifiées une par une

⚠️ **L'audit en a trouvé une SEPTIÈME que le cadrage ne listait pas : `uHeightRange`.** C'est le `minH`/`maxH` balayé sur la géométrie (`terrain.js:1207-1219, 1238`), et le fragment s'en sert pour normaliser l'altitude avant la rampe (`terrain.js:513`). `block-grid.js:529` le copie du centre vers les voisines — **ce qui est faux en mode continu** : une voisine dont le sommet dépasse le max du centre verrait tous ses hauts saturer à `hNorm = 1`, en un seul aplat de teinte sommitale. **Il faut le max des neuf.**

| # | statistique | où | calculable une fois sur le 3×3 ? |
|---|---|---|---|
| 1 | `meanM` — zéro vertical | `dem.js:340`, `terrain.js:1104, 1251` | **OUI — déjà fait** |
| 2 | `globalMin` / `baseY` — niveau de la dalle | `plinth.js:20-82` | **OUI, avec une décision produit** |
| 3 | topologie de la mer | `sea-mask.js:22-66` | **OUI, avec trois transformations** |
| 4 | `robustScale` — p95 du peigné | `terrain-analysis.js:152, 466` | **OUI — et l'atlas le règle gratuitement** |
| 5 | `relativeTiers` — hiérarchie des routes | `map/road-tier.js:25` | **OUI, mais un mur réseau en amont** |
| 6 | `gradeForDem` — quantiles de la rampe | `relief-grade.js:117` | **OUI, sans réserve** |
| 7 | **`uHeightRange`** *(oubliée du cadrage)* | `terrain.js:1238` | **OUI, trivial — mais il faut y penser** |

### 4.1 `meanM` — rien à faire, et surtout ne pas y toucher

Ce n'est pas une fonction, c'est un scalaire en mètres (`dem.js:340`), consommé en quatre endroits. **`block-grid.js:515` impose déjà le `meanM` du bloc central aux neuf** — « chaque bloc doit partager la référence meanM du bloc CENTRAL, sinon les jointures marquent des falaises fantômes ».

> ⚠️ **Et il ne faut PAS le remplacer par la moyenne du 3×3.** Cela déplacerait verticalement tout le relief, et le niveau de la mer avec (`uSeaY = (0 − meanM) × demScale`, `terrain.js:1251`) — donc changerait l'image de tous les blocs existants et casserait la reproductibilité des liens partagés. Garder le `meanM` du bloc d'origine coûte zéro et change zéro.

### 4.2 `globalMin` / `baseY` — le calcul est gratuit, la décision ne l'est pas

**Le calcul.** `globalMin` en Y-monde vaut, à la précision qui compte, `(min₉(dem.minM) − meanM) × scale`. Or `dem.minM` est **déjà calculé au chargement de chaque dalle** (`dem.js:338`). **Neuf comparaisons.** Le grain FBM ne peut pas creuser en dessous : il est multiplié par `landFactor = smoothstep(0, 90, raw)` (`terrain.js:1110`), donc nul là où se trouve le minimum.

⚠️ **Ne pas passer par `computeSlab` pour ça.** Son balayage intérieur est de `INTERIOR_STEPS = 12` (`plinth.js:14`), soit 121 points sur 56 unités — un point tous les 5 unités, environ 4 km à z11. Il rate déjà des vallées étroites ; sur 168 unités il en raterait neuf fois plus. `min₉(dem.minM)` est **exact**, pas échantillonné.

**La décision produit** est en §2.6 : le socle est plus épais, le relief flotte un peu plus haut. À trancher par Adrien.

### 4.3 La topologie de la mer — trois transformations, dont une que personne n'avait vue

**(1) Les bords changent, et c'est en partie une amélioration.** Le remplissage part aujourd'hui des bords du bloc ; il partira des bords du 3×3. Deux effets **opposés** :
- *Ça corrige* : un lac qui touche par hasard le bord du bloc central est aujourd'hui classé « mer » à tort ; sur le 3×3 il devient intérieur et redevient terre. **L'image du centre change — en mieux, mais elle change.**
- *Ça ne casse pas les vraies mers* : un océan qui atteint le bord du 1×1 atteint forcément le bord du 3×3, puisqu'il est connecté vers l'extérieur. **Les vraies mers ne peuvent que rester mer.** C'est une garantie, pas un espoir.

**(2) Le seuil des 2 % devient neuf fois plus strict. Il faut le convertir — et le paramètre existe déjà.**
`minBasin = max(64, round(n × minBasinFrac))` (`sea-mask.js:59`), et `minBasinFrac` est **déjà exposé** dans la signature (`sea-mask.js:22`). Mesuré au banc :

| | seuil des 2 % |
|---|---:|
| 1 bloc à 1024² | 20 972 cellules |
| **la même surface absolue sur un atlas 3×3** | **0,2222 %, soit exactement 2 %/9** |

Et en surface réelle (atlas à la densité 1024²/bloc) : **15,0 km² à z12**, 59,8 km² à z11, 239,2 km² à z10. Passer en **surface absolue en km²** plutôt qu'en fraction est plus juste encore, parce que le seuil cesse alors de dépendre du zoom.
⚠️ **Ne pas toucher au DÉFAUT de `minBasinFrac`** : `test/sea-mask.test.js` verrouille « bassin ≥ 2 % masqué terre ⇒ pas mer (le piège Flevoland) », et `test/terrain-jobs.test.js` verrouille l'égalité **octet pour octet** de `computeTerrainJob`. Passer la valeur en argument depuis l'appelant préserve les deux.

**(3) Le piège que personne n'avait vu : le sous-échantillonnage SECTIONNE LES CHENAUX.**
`resampleField` et `coarsenField` **moyennent** par blocs (`terrain-analysis.js:358`, verrouillé par `test/damier-memoire.test.js:46`). Un détroit large d'un pixel, moyenné avec ses berges, remonte au-dessus du seuil de 0,5 m → **le remplissage ne passe plus** → une baie réelle est peinte en terre.

> **La correction est petite et elle est belle : sous-échantillonner le champ du MASQUE DE MER par un MIN-pooling, pas par une moyenne.** Un minimum ne peut qu'élargir les zones basses, jamais les rétrécir : **la connectivité est préservée par construction**, c'est un théorème, pas un réglage. Une quinzaine de lignes à ajouter à `terrain-analysis.js`, et ça rend un atlas de 1536² utilisable là où la moyenne exigerait 3072².

**(4) Et le coût, qui décide de la résolution.** `buildSeaMask` alloue **10 octets par cellule** (`isLow` Uint8 + `label` Int32 + `stack` Int32 + `mask` Uint8, `sea-mask.js:25-29, 63`) et `blurMask` cinq de plus :

| atlas | cellules | mémoire transitoire | verdict |
|---:|---:|---:|---|
| 4608² (MNT plein) | 21,2 M | **~318 Mo** | **hors budget** |
| 3072² | 9,44 M | ~141 Mo | limite |
| **2304²** | **5,3 M** | **~80 Mo** | **acceptable** |
| 1536² | 2,36 M | ~35 Mo | confortable |

**Mon choix : l'atlas de mer à 2304², avec MIN-pooling depuis le MNT 4608².** ⚠️ Le pic de 80 Mo est transitoire et il est dans le Worker, pas sur le fil principal — mais il s'ajoute au reste pendant la cuisson : à vérifier au jalon 3.

### 4.4 `robustScale` — l'atlas le règle sans qu'on ait rien à faire

`robustScale(T, { p = 0.95, samples = 4096 })` (`terrain-analysis.js:152`) échantillonne **4 096 valeurs quelle que soit la taille du champ** : son coût propre est **constant**, quelques microsecondes.

Le piège, en revanche, est sérieux : **il dépend de la RÉSOLUTION du champ, pas seulement de son contenu.** `textureShade` floute à des rayons de 1, 2, 4 … 32 **pixels** (`terrain-analysis.js:129-130`) : à moitié de résolution, ces rayons couvrent deux fois plus de terrain et l'amplitude change. C'est **déjà un défaut latent aujourd'hui** — le centre est à 27,4 px/u, une voisine à 18,3 — mais personne ne l'a vu parce que les voisines sont du contexte lointain. **En mode continu, où n'importe quelle dalle passerait sous la fenêtre, ça se verrait immédiatement : le peigné des crêtes changerait d'intensité à chaque franchissement de jointure.**

> **Avec un atlas unique, il n'y a qu'un champ, qu'une résolution et qu'un p95. Le problème n'existe pas.** C'est la validation la plus nette de l'architecture du §3 : elle ne *corrige* pas cette statistique, elle *supprime la condition* qui la rendait instable.

*(Dans l'option (a), les neuf dalles séparées, il faudrait scinder `analyzeDem` en trois temps — les neuf `textureShade`, un p95 global, les neuf `encodeTextureShade` — et sérialiser ce qui est aujourd'hui parallélisable.)*

### 4.5 `gradeForDem` et `uHeightRange` — additifs, donc gratuits

`gradeForDem({ minM, maxM, meanM, histogram, extentM })` (`relief-grade.js:117`) ne prend que des scalaires plus un `Uint32Array` de 256 cases. **Et les histogrammes sont ADDITIFS** : l'histogramme du 3×3 est la somme des neuf, à condition que les neuf partagent le même intervalle `[minM, maxM]` — qui se déduit de `min₉(dem.minM)` et `max₉(dem.maxM)`, tous deux déjà calculés (`dem.js:338`).

⚠️ Deux pièges mineurs : `extentM` doit passer à **3×**, sinon le rapport de relief `rugged = amplitude / ext / 0.06` (`relief-grade.js:152`) triple à tort et sature les teintes ; et `gradeForDem` produit `heightPivot` **dans l'espace `hNorm` du shader**, donc `uHeightRange` doit couvrir la **même** emprise que le grade — sinon le pivot de la rampe tombe à côté.

**`uHeightRange` : max des neuf `minH`/`maxH`.** Coût nul, mais il faut y penser, et il n'était sur aucune liste.

### 4.6 `relativeTiers` — la statistique est facile, le réseau ne l'est pas

`relativeTiers(ranks)` (`map/road-tier.js:25`) est une fonction pure sur un tableau d'entiers, sans aucun couplage géométrique. **Trivialement calculable sur l'union des neuf.**

**Le mur est en amont, dans la récolte.** Les routes sont cherchées sur `patchBounds(dem)` (`roads-layer.js:78`), la bbox du bloc central padée de 5 %. Les chiffres consignés dans le fichier lui-même (`roads-layer.js:27-32`) : **Chamonix à z12 = 10 752 chemins pour 15 Mo de charge Overpass. Neuf fois plus, c'est environ 97 000 chemins et 135 Mo** — au-delà du seuil que le fichier qualifie lui-même d'« inutilisable ».

> **Un 3×3 de routes ne passe QUE par la voie tuilée Overture** (`roads-layer.js:101-115`) — **qui n'existe que dans `REGION = { lon 5,0-8,0 ; lat 44,5-47,0 }`** (`map/tile-index.js:15`), les Alpes franco-suisses. **Hors de cette boîte, le 3×3 doit se faire SANS routes.** Ce n'est pas une régression du plan : c'est une limite existante que le 3×3 rend visible.

⚠️ Et le remède produit a un effet de bord à assumer : élargir la fenêtre de jugement au 3×3 signifie qu'**une autoroute à 100 km de la vue courante rétrograde les nationales du centre** — elles deviennent plus fines et plus claires. C'est exactement le symptôme que `test/road-tier.test.js:33` documente comme « the reported bug ». Le test unitaire ne cassera pas (la fonction est pure), mais la régression visuelle qu'il protège revient d'un cran d'échelle. **Atténuation : plafonner la rétrogradation à un cran par rapport au rang local.**

---

## 5. Ce qui bouge avec le terrain, et ce qui reste

### 5.1 Le tableau

La règle est simple : **est-ce que l'objet appartient au MONDE (il défile) ou à la FENÊTRE (il reste) ?**

| calque | ancrage | écrêtage actuel | ce que coûte le défilement |
|---|---|---|---|
| `map/places-layer.js` — libellés de lieux | **MONDE** | `places-layer.js:117` `halfLimit: HALF × 0,96` ; declutter en espace écran (`:46`) | **une écriture de `group.position`.** Élargir `halfLimit` à 84×0,96 et tripler `maxN`. Le declutter est déjà en espace écran, il suit tout seul. **Zéro géométrie.** |
| `peaks.js` — sommets | **MONDE** | `peaks.js:223` rejet au-delà de ±`TERRAIN_SIZE`/2 | **le moins cher de tous.** Ce sont des `div` HTML reprojetés chaque image depuis des coordonnées monde. Élargir le rejet à ±84 et ajouter un test de fenêtre. **Zéro géométrie.** |
| `race-labels.js` | **MONDE** | aucun rejet | idem `peaks.js` : superposition DOM reprojetée par image, un test de fenêtre à ajouter. |
| `boats.js` / `fleet.js` — objets flottants | **MONDE** | aucun `TERRAIN_SIZE` en dur : **tout est paramétré par `half`** (`boats.js:74, 200` ; `fleet.js:142, 160-161, 176, 203`) | **le plus propre du lot.** Passer `half = 84` et la flotte navigue sur toute l'emprise. Ils sont déjà déplacés par `position` chaque image. Reste à les masquer hors fenêtre. |
| trafic aérien (`traffic.js`) | **MONDE** | `traffic.js:267` `bound = HALF + 13 + spanExtra` | **déjà résolu.** C'est le seul système déjà branché sur le damier : `main.js:3304` fait `blockGrid.onGridChanged = () => traffic.setSpan(blockGrid.spanRadius())`. Appeler `setSpan(84)`. |
| nuages (`clouds2.js`) | **FENÊTRE** (c'est le ciel) | — | **une écriture d'uniforme.** `clouds2.js:612-613` expose déjà `uMapMin` et `uMapSize`, consommés à `:153`. Faire défiler `uMapMin` pour que la portance orographique suive le relief. |
| `labels.js`, `hud3d.js`, `ground-info-layer.js` | **FENÊTRE** | — | **ils restent.** Décor du socle, positions constantes, ancrage sur `FLOOR_Y`/`baseY`. Rien à faire. |
| océan (`ocean.js`) | **FENÊTRE** — et c'est une chance | `ocean.js:914` un seul `PlaneGeometry(TERRAIN_SIZE × 0,998)` centré à l'origine | Le plan d'eau **EST** déjà la fenêtre : il ne bouge pas. ⚠️ **Mais `56.0` est interpolé EN DUR dans le GLSL en quatre endroits** (`ocean.js:141, 313, 482, 542`) et il n'y a **aucun `uBlockOffset`** ici : les textures qu'il échantillonne (côte, masque de mer) doivent défiler → il faut ajouter l'uniforme d'offset. Et les dalles voisines n'ont aujourd'hui **aucune eau**. |
| `map/roads-layer.js`, `map/water-layer.js` — routes, rivières, lacs | **MONDE** | `roads-layer.js:152` `clipPolylineToBlock` ; `water-layer.js:100` `triangulateAndClip` | **`group.position` suffit pour la position, mais le clip est CUIT dans la géométrie.** C'est le vrai problème — §5.2. |
| `gpx.js` / `gpx-layers.js` | **MONDE** | `gpx.js:698` — ⚠️ **ce n'est PAS un clip** : le test `inside` ne choisit que la source du drapage (repli sur `grid.heightAt`). Le tracé est dessiné **au-delà** du bloc. | Géométrie cuite en monde absolu → `group.position` marche. **Mais il n'existe aujourd'hui AUCUN écrêtage du GPX à la fenêtre : le tracé déborderait visiblement.** Un clip à écrire — §5.2. Bonne nouvelle : c'est le seul calque déjà conscient du damier (`gpx.js:702-709`). |
| `map/aerial-layer.js` — photo aérienne | **MONDE** | `aerial-layer.js:28-36` les deux coins exacts du bloc | **le seul vrai « non » — §5.3.** |

### 5.2 L'écrêtage des tracés — le seul vrai chantier, et sa sortie est déjà écrite

`map/block-clip.js` **densifie** chaque polyligne à un pas de **0,6 unité-monde** (`:32-33`), teste chaque point densifié, et **bissecte 7 fois** à chaque franchissement pour poser l'extrémité pile sur le bord (`:37-44`). Pour les polygones d'eau, c'est pire : earcut, puis **Sutherland–Hodgman triangle par triangle** (`:184-188`) contre un contour convexe de **192 sommets** produit par `blockOutline(fp, n = 192, bisect = 30)` — soit **5 760 tests `slabInside` rien que pour construire la fenêtre de découpe**.

Le volume, déduit des mesures consignées dans `roads-layer.js:27-32` (Chamonix à z12 : 10 752 chemins, 15 Mo de charge Overpass) : de l'ordre de **10⁵ à 10⁶ appels à `insideBlock` par reconstruction**, chacun coûtant deux `Math.pow` près des coins. **Estimation : 10 à 100 ms par reconstruction.**

> **Non, on ne peut pas refaire ça à chaque image.** Et le clip n'est même pas le poste dominant : derrière lui, `buildLineSegments` (`roads-layer.js:157`) recrée un `BufferGeometry` et le réuploade au GPU.

**Mais la sortie est courte, et elle est déjà écrite.** Le shader du terrain porte **déjà** le `discard` de superellipse (`terrain.js:475-479`), ses uniformes sont déclarés (`:168, 170, 173, 199`), `terrain.blockFootprint()` (`:958-966`) les **exporte déjà** vers le JavaScript, et `slabInside` (`block-clip.js:6-14`) en est la **transcription littérale** — l'en-tête du fichier le dit : « slabInside mirrors terrain.js's slab-corner discard ».

> **Porter ce `discard` dans les matériaux de lignes et d'eau, via un `onBeforeCompile` sur `LineMaterial`, c'est une dizaine de lignes de GLSL déjà écrites et déjà testées.** On construit alors la géométrie **non écrêtée** sur toute l'emprise 3×3, **une seule fois**, et le GPU coupe à la fenêtre gratuitement à chaque image.
> ⚠️ **Un arbitrage à prévoir** : `uRegionOn` **remplace** le clip de superellipse (`terrain.js:468-470`). Le mode isolé et le mode continu ne pourront donc pas partager le même écrêtage GPU sans une branche explicite. Comme le mode isolé est hors périmètre, c'est un `if` à écrire, pas un conflit.

### 5.3 La photo aérienne — le seul mur que je ne sais pas franchir

`TARGET_TEXTURE_PX = 4096` **par bloc** (`aerial-layer.js:49`), soit **144 récupérations de tuiles et ~15 secondes** à z15, d'après le commentaire du fichier lui-même.

À densité de texels égale, une emprise 3×3 demanderait **12 288²** :

| | un bloc | **emprise 3×3** |
|---|---:|---:|
| côté de la texture | 4 096 | **12 288** |
| tuiles à récupérer | 144 | **1 296** |
| temps de constitution | ~15 s | **~135 s** |
| VRAM avant mipmaps | 67 Mo | **604 Mo** |

> **Non viable en une seule texture, à aucun budget.**

Trois sorties, par ordre de préférence :
1. **Désactiver l'aérien en mode continu.** C'est déjà le choix du damier v1 (« les voisins reçoivent la peinture de carte complète mais PAS la mer animée, le socle, les labels ni l'aérien », `block-grid.js:12-15`). Le mode continu et l'aérien deviennent exclusifs — l'un ou l'autre, pas les deux.
2. **Neuf textures aériennes séparées**, une par bloc, chacune sur son propre `uAerial`/`uAerialOffset`/`uAerialScale` (`terrain.js:178-182`). Techniquement possible — les uniformes existent — mais **1 296 tuiles et 604 Mo restent 1 296 tuiles et 604 Mo.** Ça ne résout que le format, pas le coût.
3. **Une seule texture aérienne, à la résolution de la FENÊTRE, mise à jour par bandes pendant le drag.** C'est le seul cas de tout le plan où la mise à jour torique (`copyFramebufferToTexture`, mesuré à **0,004-0,014 ms par bande**, §3.5) serait vraiment justifiée. **Mais chaque bande nouvelle exige des tuiles réseau**, donc le terrain aérien arriverait en retard sur le drag. C'est un chantier à part entière, pas un jalon de celui-ci.

**Ma recommandation : la sortie 1.** L'aérien reste disponible en mode bloc figé, il s'éteint en mode continu.

### 5.4 Le grain FBM — un piège que l'architecture retenue crée

`detailField(params.seed, params.detailScale, res, TERRAIN_SIZE)` (`terrain.js:1106`) pré-cuit le grain **sur la grille de la géométrie**, sans aucun offset monde. Aujourd'hui ce n'est pas un problème : la grille et le terrain sont solidaires.

> ⚠️ **Avec une géométrie fixe et un terrain qui défile dessous, le grain resterait COLLÉ À L'ÉCRAN pendant que le relief glisse.** Un fin moirage immobile sur un paysage en mouvement — exactement le genre de défaut que l'œil attrape tout de suite.

*(Et dans l'option (a), les neuf dalles séparées, le même code produit le défaut symétrique : le grain est **identique** sur les neuf dalles, donc il se répète visiblement à chaque franchissement de jointure.)*

**La sortie : pré-cuire le grain sur l'emprise 3×3 entière et l'échantillonner en coordonnées monde.** À la densité de la grille res 384 sur 56 unités, l'emprise demande **1153² × 2 valeurs × 4 octets = 10,6 Mo** — c'est le poste que le §3.4 provisionne. Coût par sommet : une lecture bilinéaire de plus, quelques nanosecondes.
⚠️ **Ne pas le recalculer par image** : `detail-noise.js` mesure 5 octaves de simplex par sommet à **175 ms pour un million de sommets**, soit ~175 ns/sommet — sur 148 225 sommets cela ferait **26 ms par image**, quatre fois le budget entier.
⚠️ **Et ne pas « simplifier » l'expression finale** : `terrain.js:1091-1092` avertit que `detail·(a + 0,35·b)` n'est pas identique au bit près à `detail·a + detail·0,35·b` — 48 % des sommets diffèrent — et `test/detail-noise.test.js` le verrouille sur six combinaisons.

### 5.5 Le streaming par tuiles — qui en bénéficie, et où

| calque | tuilé ? |
|---|---|
| routes | **OUI** — `roads-layer.js:10` → `loadRoadTiles` |
| rivières, lacs | **OUI** — `water-layer.js:13` → `loadWaterTiles`, `loadLakeTiles` |
| lieux, sommets, aérien, GPX, flotte, trafic | **NON** — fichiers monolithiques ou requêtes live |

Et la couverture est **géographiquement bornée** : `REGION = { lon 5,0-8,0 ; lat 44,5-47,0 }` (`map/tile-index.js:15`), les Alpes franco-suisses. Hors de cette boîte, `inRegion()` est faux et on retombe sur Overpass en direct — qui ne tient pas une emprise 3×3 (§4.6).

> **Conséquence à assumer : le mode continu 3×3 avec routes et rivières ne marche, aujourd'hui, QUE dans les Alpes.** Partout ailleurs il marche sans elles. C'est une limite préexistante que le 3×3 rend visible — et c'est aussi le meilleur argument pour le chantier « tuiler les calques monolithiques » que l'étude clipmap recommandait déjà (30 Mo de bande passante par visite fraîche à récupérer).

---

## 6. Le phasage

Chaque jalon livre quelque chose de **visible et testable**, et chacun a de la valeur même si le suivant n'est jamais fait. L'effort est en jours-personne, à la louche, avec une incertitude que j'estime à ±50 %.

### Jalon 0 — les gains qui ne dépendent de rien (2 à 3 j)

**Ne touche pas au 3×3. Améliore le produit d'aujourd'hui. À faire d'abord, quoi qu'il arrive ensuite.**

| tâche | gain mesuré |
|---|---|
| normales de grille au lieu de `computeVertexNormals` (levier 2) | **−85 ms** par reconstruction à res 768, **−110 ms** à res 1024 |
| masque côtier en R8, sans canevas ni `ImageData` (levier 1) | **−44 Mo** sur le centre, **−11,5 Mo** par voisine ; et **3,4× moins cher à téléverser** (0,383 ms contre 1,316 ms pour un 1024², mesuré) |
| MNT en `Int16` (levier 3) | **−50 % de mémoire, −9,5 % de temps de lecture** |

**Test de recette** : `npm test` reste au vert (1 314 tests), le temps de reconstruction du bloc au Mont-Blanc à res 1024 baisse d'au moins 100 ms, le tas JS du bloc seul baisse d'au moins 40 Mo.
⚠️ Le levier 2 demande un test neuf qui compare les deux méthodes de normales et verrouille l'écart angulaire (mesuré à 0,008° en moyenne, 1,02° au pire).

### Jalon 1 — le plus petit drag qui marche, même moche (3 à 5 j)

**But : sentir le geste, avant d'optimiser quoi que ce soit.** Derrière un drapeau (`src/flags.js` existe).

Périmètre volontairement misérable :
- charger **neuf MNT** par neuf appels à `loadDem({ tilesAcross: 3, originTile })` et les recoller dans un `Int16Array` 4608² ;
- **une seule géométrie** res 384 dont on ré-échantillonne les Y et les normales à chaque image ;
- **le socle mis à jour en place** ;
- le drag au **clic droit** (pas de conflit avec la plongée), borné à ±56 unités, arrêt net au bord ;
- **aucun atlas de champs** : ni analyse, ni masque de mer, ni masque côtier — le terrain est peint à la rampe d'altitude nue, comme aux zooms où ces champs sont éteints ;
- **aucun calque** : ni routes, ni lieux, ni sommets, ni GPX, ni bateaux, ni nuages, ni aérien ;
- **aucun `robustScale`, aucun `gradeForDem`** — on prend ceux du bloc central tels quels.

**Ce qui est validé à ce jalon** : la sensation du geste, et les trois nombres du §7.
**Ce qui est laid et assumé** : pas de peigné des crêtes, pas de mer topologique, pas de trait de côte vectoriel, un socle qui a la bonne silhouette mais un contenu pauvre.

### Jalon 2 — l'atlas de champs (4 à 6 j)

- cuire, **en Worker et une seule fois**, l'analyse à 2304², le masque de mer à 2304² et le masque côtier à 3072² R8 ;
- le **MIN-pooling** pour le masque de mer (§4.3) et le `minBasinFrac` converti ;
- les six lectures de texture du fragment passent en UV d'atlas (`terrain.js:469, 495, 504, 561, 661, 706`) ;
- `min₉/max₉` pour `baseY`, `uHeightRange` et `gradeForDem` ; histogrammes sommés ;
- **le grain FBM pré-cuit sur l'emprise** (§5.4).

**Ce qui est validé** : l'image en mode continu ressemble à l'image d'aujourd'hui. C'est ici qu'on met les captures côte à côte, et c'est ici que se teste la question du §2.1 — « à quelle taille de masque côtier l'œil voit-il la différence ? ».

### Jalon 3 — les calques qui suivent (3 à 5 j)

- `group.position` pour lieux, sommets, étiquettes de course ;
- `setSpan(84)` pour le trafic, `half = 84` pour la flotte ;
- `uMapMin` qui défile pour les nuages ;
- l'uniforme d'offset pour l'océan, et les quatre `56.0` en dur du GLSL sortis en uniforme (`ocean.js:141, 313, 482, 542`) ;
- **le `discard` de superellipse porté sur `LineMaterial`** pour les routes, l'eau et le GPX (§5.2) — géométrie construite une fois sur toute l'emprise, écrêtée par le GPU.

**Ce qui est validé** : plus rien ne dépasse de la fenêtre, plus rien ne reste collé à l'écran.

### Jalon 4 — la finition (3 à 5 j)

- **res 384 pendant le drag, res 768 au repos** (§3.4) ;
- le comportement au bord de l'emprise — rappel élastique, arrêt net, ou rechargement (§3.1), **décision d'Adrien** ;
- le format de partage : `loc` doit porter la position dans l'emprise, en restant compatible avec les liens existants ;
- l'export et l'usine à vidéos doivent **figer le défilement** pendant un rendu ;
- la table des paliers : le mode continu doit pouvoir se refuser au palier 3 (`ESSENTIEL`), où `damierMax = 4` dit déjà que la machine ne porte pas neuf blocs.

> ⚠️ **Un chiffre qui n'est pas un hasard : `damierMax` vaut exactement 8 au palier 2** (`palier-machine.js:131`), le palier de l'iMac 2015 — **c'est-à-dire précisément les 8 voisines d'un 3×3.** La table des paliers dit déjà que cette machine porte un 3×3 et pas plus. Et elle dit aussi que le palier 3 ne le porte pas.

**Total : 15 à 24 jours-personne** pour un mode continu complet derrière un drapeau, dont **2 à 3 jours** (le jalon 0) rentables immédiatement et sans risque.

---

## 7. Le critère d'abandon

**Trois signaux. Si l'un se déclenche, on s'arrête et on garde le système actuel.** Ils sont volontairement mesurables et placés tôt.

### Signal 1 — à la fin du jalon 1 : le geste ne vaut pas le coup

Mesurer sur **l'iMac 2015**, pas sur une machine de développement :

| mesure | seuil d'abandon |
|---|---|
| images par seconde pendant un drag continu, terrain nu | **< 20 im/s → on arrête.** Le jalon 1 n'a ni champs, ni calques, ni mer, ni nuages ; s'il ne tient pas déjà, le produit complet n'y arrivera jamais. |
| temps de fil principal par image, p95 | **> 10 ms → on arrête.** Le budget est 6 ms et le jalon 1 ne porte qu'un tiers de la charge finale. |
| tas JS après deux minutes de drag | **s'il dérive au lieu de plafonner → on arrête**, ou on cherche la fuite avant tout le reste. Une architecture bornée doit avoir une empreinte *constante* : si elle ne l'est pas, c'est que quelque chose se recrée par image. |

### Signal 2 — à la fin du jalon 2 : l'image a changé de caractère

**C'est le signal le plus important, et il est subjectif — donc c'est Adrien qui le juge, sur des captures côte à côte.**

Le 3×3 borné change l'image de trois façons, toutes documentées ici : la topologie de la mer se décide sur une emprise neuf fois plus grande (§4.3), le socle est plus épais (§2.6), et l'analyse de relief est un cran plus grossière (13,7 px/u contre 27,4 au centre aujourd'hui, §2.2).

> **Si le mode continu produit une carte que ShibuMap n'aurait pas signée, il ne sert à rien.** ShibuMap est un producteur d'images avant d'être un visualiseur de données. Le geste ne rachète pas une image affaiblie.

### Signal 3 — à tout moment : le temps de chargement devient une régression

Le mode continu charge **neuf MNT au lieu d'un** et cuit **un atlas de 1,05 s** avant la première image. Aujourd'hui le bloc central s'affiche puis les voisines arrivent en flux (`block-grid.js:397-421`) ; là, il faut **attendre les neuf** avant de pouvoir décider la topologie de la mer.

| mesure | seuil d'abandon |
|---|---|
| temps jusqu'à la première image utile, réseau normal | **> 2× le temps actuel → on arrête**, ou on rétablit un affichage progressif (le centre d'abord, l'atlas ensuite) avant de continuer. |

⚠️ **Et un signal d'alerte qui n'est pas un abandon** : si l'aérien s'avère indispensable au produit (§5.3), le mode continu et l'aérien deviennent exclusifs. C'est une contrainte à assumer, pas un motif d'arrêt — mais c'est à savoir avant de commencer, pas après.

### Ce qu'on garde même en cas d'abandon

**Le jalon 0 en entier.** Les normales de grille, le masque côtier en R8 et le MNT en `Int16` améliorent le produit d'aujourd'hui et ne dépendent d'aucune décision sur le 3×3. **Ils sont acquis quoi qu'il arrive.**

---

## 8. Ce qui n'a PAS été mesuré, et que je ne peux pas affirmer

1. **Rien n'a été mesuré sur l'iMac 2015.** Les bancs de calcul tournent sur un PC Windows sous Node 24 ; leur validité tient à ce que `analyzeDem` y donne **393 ms en 1536² contre 384 ms mesurés au dépôt** — 2 % d'écart, donc une machine comparable à celle des campagnes de référence. **Mais l'iMac est plus lent, et je ne sais pas de combien.** Le banc navigateur, lui, tournait sur une **RTX 3080** : ses chiffres absolus ne transposent pas du tout, seuls ses **rapports** sont exploitables — et encore, le rapport sommets/pixels d'un GPU intégré n'est pas celui d'une carte discrète.
2. **Le point de rupture en textures n'est pas transposable.** Le banc l'a trouvé entre 5 et 10 Go, c'est-à-dire à la VRAM de la carte de test. Sur un Iris Pro 6200 (1,7 Go réservés), il tomberait un ordre de grandeur plus tôt. **Je n'ai pas mesuré le budget textures de la machine cible.**
3. **La question « à quelle taille du masque côtier l'œil voit-il la différence » est traitée géométriquement, pas perceptivement.** Le raisonnement en texels par pixel d'écran (§2.1) donne 768 comme plancher défendable, mais **je n'ai comparé aucune image.** C'est l'essai du jalon 2.
4. **Le coût de `block-clip.js` est une estimation, pas une mesure.** Les 10 à 100 ms de §5.2 sont dérivés des charges Overpass consignées dans `roads-layer.js:27-32`. Il faudrait l'instrumenter pour trancher.
5. **Le pic transitoire de la cuisson de l'atlas n'a pas été mesuré en conditions réelles.** Le calcul donne ~80 Mo pour le masque de mer à 2304² (10 octets par cellule), mais il s'additionne à ce que le Worker tient déjà par ailleurs.
6. **Le MNT en `Int16` n'a pas été vérifié sur ses cinq consommateurs.** `analyzeDem`, `buildSeaMask`, `resampleField`, `sampleDem` et le tracé de la jupe le lisent tous. Aucun ne fait d'arithmétique qui exige le `Float32` — mais c'est une lecture à faire, pas une supposition. Et je n'ai pas vérifié l'effet de l'arrondi au mètre sur un relief **très plat**, où il pourrait produire des marches sur une pente douce.
7. **Je n'ai pas vérifié que le format de partage supporte l'extension.** `share-link.js` valide `lat`/`lon`/`zoom` numériques et rejette le reste ; l'ajout de champs optionnels *devrait* être compatible. C'est une lecture, pas un test.
8. **`labels.js` et `hud3d.js` sont classés « FENÊTRE » sur lecture du code** (positions constantes, ancrage sur `FLOOR_Y`/`baseY`), sans vérification à l'écran.
9. **Aucun test n'a été exécuté pendant cette étude.** Les tests cités comme « à relire » ou « qui casseraient » le sont sur lecture. `npm test` n'a pas été lancé — rien n'a été modifié dans `src/`.
10. **Je n'ai pas mesuré la sensation.** Tout ce document parle de millisecondes et de mégaoctets. **La seule question qui décide vraiment — est-ce que ça fait plaisir de draguer ? — n'a de réponse qu'au jalon 1.**

---

## Annexe — les bancs de mesure

Quatre scripts Node jetables, **hors dépôt**, dans le bac à sable de la session (`…/scratchpad/banc-33/`). Ils **importent** les modules de `C:\Dev\wt-33\src\` en lecture seule et n'écrivent rien.

| banc | ce qu'il mesure | le chiffre qu'il produit |
|---|---|---|
| `bench-memoire.mjs` | octets de chaque poste (géométrie, textures, MNT), coût de `computeTerrainJob` par taille, seuil des grands bassins, budget par image en pixels de champ | **33,4 Mo par dalle voisine** ; **2 %/9 = 0,2222 %** ; **15,0 km² à z12** |
| `bench-socle.mjs` | `computeSlab` et `buildSlabWalls` par résolution, décomposition anneau / géométrie | **98 % du coût du socle est de l'allocation, pas de l'échantillonnage** |
| `bench-socle-enplace.mjs` | le socle reconstruit à chaque image, naïf contre mise à jour en place dans des `Float32Array` pré-alloués | **0,384 ms au lieu de 5,41 ms à res 768 — 14,1×** |
| `bench-rebuild.mjs` | fabrication d'une dalle poste par poste, `Float32` contre `Int16`, coût d'une promotion | **`Int16` 9,5 % plus rapide** ; **promotion complète 381 ms à res 768** |
| `bench-normales.mjs` | `computeVertexNormals` contre normales de grille, et le coût de ne bouger que les Y | **17,6× à res 768, écart 0,008°** ; **2,33 ms par image à res 384** |
| `bench-atlas.mjs` | cuisson des champs sur l'emprise 3×3 entière, par taille d'atlas | **1 378 ms pour un atlas 2304² contre 2 767 ms pour neuf dalles à la même densité** |

Et un banc navigateur (puppeteer + Chrome, GPU réel, three r172), dans `…/scratchpad/banc33/` : quatre mécanismes d'écrêtage comparés, 9 maillages contre 1, `copyTextureToTexture` par format et par taille de bande, budget textures. **Machine : RTX 3080 en mode headful, `EXT_disjoint_timer_query_webgl2` disponible.**


---

## ADDENDUM — les quatre décisions d'Adrien (2026-07-29)

Réponses aux quatre questions ouvertes du rapport. **Elles sont fermées, ne les
rediscute pas.**

### 1. Le bord de course : BUTÉE ÉLASTIQUE

« Pour l'instant : butée élastique (on se laisse la possibilité pour plus tard
d'un rechargement). »

Au bout de la course (±1 largeur de socle, ±21 km à z12), le terrain **résiste
et revient** — il ne s'arrête pas net et ne recharge pas. La butée dit « il y a
une limite » sans la faire vivre comme une panne. Le rechargement d'un nouveau
3×3 reste une porte ouverte, à ne pas fermer par construction : le code doit
pouvoir recentrer l'emprise plus tard sans être réécrit.

### 2. Le socle plus épais : ACCEPTÉ

`baseY` se cale sur le point bas de l'emprise 3×3 entière, pas de la vue. C'est
le prix de la stabilité — un socle qui garde son épaisseur pendant qu'on
défile.

### 3. L'aérien : DU GROSSIER D'ABORD, PUIS L'AFFINAGE — le mur tombe

« Chargement grossier d'abord sur des données plus lointaines, puis
amélioration alors que la vue est déjà chargée (comme Google Earth). **On
optimise le chargement de la zone au centre de la vue.** »

⚠️ **Cette réponse invalide la conclusion « l'aérien et le mode continu sont
exclusifs » du corps du rapport.** Le calcul de 1 296 tuiles / 135 s / 604 Mo
supposait de charger tout le 3×3 à la résolution du centre — ce n'est plus le
cas :

- **Un seul niveau grossier couvre les 9 dalles** immédiatement (une tuile de
  zoom z−2 couvre 16 dalles fines : le 3×3 entier tient en quelques tuiles).
- **L'affinage est piloté par la distance au centre de la vue**, en continu,
  après affichage. La périphérie peut rester grossière indéfiniment : elle est
  petite à l'écran et en partie hors du socle.
- **Le budget devient une file de priorité**, pas un total : on ne demande
  jamais plus que ce que la connexion et la mémoire tiennent, et on demande
  d'abord ce qui est au centre.

À chiffrer au jalon correspondant : combien de tuiles pour le niveau grossier
du 3×3, et quel est le budget d'affinage par seconde qui ne mange pas le
budget d'image.

### 4. Les routes : SUPPRIMÉES

« Ce système de routes ne me convient pas, très lourd, très mauvais, tu peux le
supprimer. » Le calque, ses données (12,6 Mo), son script de cuisson et ses
réglages partent. La contrainte « hors des Alpes, pas de routes » disparaît
avec eux.
