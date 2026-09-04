# MER2 — LA COUPE PLATE À LA JUPE : LA CAUSE, LES DEUX CHIFFRES, LE CORRECTIF

Arbre `C:\Dev\wt-mer2`, branche `mer-jupe-plate`, au-dessus de `981aea7`
(« Fusion MIX »). Sonde neuve, rejouable : `scripts/sonde-mer-jupe.mjs`.
Relevés dans `.banc/MER2/AVANT.json` et `.banc/MER2/APRES.json`, captures dans
`.banc/MER2/pour-adrien/`.

> **Adrien, 2026-09-04 (D24)** : *« Je pense que l'effet latéral de vagues pose
> problème. Il faudrait que le crop se fasse de façon plate, au niveau de la jupe
> du socle, ça évitera de calculer cette déformation inutile. »*

**Ses deux moitiés, séparées, avec le chiffre de chacune :**

| | avant | après |
|---|---|---|
| ① **pixels de mer au-delà de l'arête du socle**, par image | **31 à 64 px**, sur **348 images sur 360** | **0 px**, sur **360 images sur 360** |
| total sur la campagne (18 postes × 20 images) | **6 028 px** | **0 px** |
| témoin `chop = 0` (pas de déplacement latéral) | **0 px** — c'est lui qui nomme le coupable | 0 px |
| ② **sommets pour lesquels la déformation est CALCULÉE** | **39 289** par image, dont **3 969** en produisent un pixel — **89,9 % jeté** | **6 265**, dont les mêmes 3 969 — **−84,1 %** |
| triangles soumis par image | **75 768** | **10 232** — **−86,5 %** |
| **la mer au large** — A/B `bande = 0` **dans la même image**, témoin nul | — | la bande ne touche que **0,92 à 2,82 %** de la nappe, sur 9 postes |
| silhouette de la nappe (18 postes appariés) | 2 354 285 px | 2 355 037 px — **+0,032 %**, écart max 0,163 % |
| temps GPU de la passe mer | **0,02 ms ± 0,08** | 0,02 ms ± 0,05 — **sous le bruit, et je le dis** (§5) |
| `npm test` | 4 882 · 0 | **4 888 · 0** |
| `audit:tests` | 262 = 262 | 262 = 262 |

---

## 1. LA CAUSE, NOMMÉE — et le diagnostic d'Adrien était juste

`MER_FRAG` mesure sa distance au bord sur **`vCrop`**, c'est-à-dire sur la
coordonnée paramétrique de la calotte **AU REPOS** — le commentaire de la Tâche
R5 le dit même explicitement, et pour une bonne raison : *« vCrop, PAS la
position déplacée : lire la position déplacée ferait onduler le trait de côte au
rythme des vagues »*.

Mais `MER_VERT`, lui, a déjà bougé le sommet :

```glsl
p.x += disp.x;   // disp.xz = le terme LATÉRAL de Gerstner
p.z += disp.z;
```

➡️ **Une crête née à l'intérieur est donc DESSINÉE à l'extérieur** : le `discard`
la juge sur l'endroit d'où elle vient, pas sur celui où elle est. C'est
exactement la signature de la capture d'Adrien — des **pointes**, pas une nappe
uniformément trop grande. Le rapport MER avait fermé l'étendue (`bordDeMer` ne
suit plus l'estompage) ; **il ne pouvait pas fermer celle-ci**, parce que la
faute n'est pas dans l'emprise mais dans le désaccord entre deux repères du même
nuanceur.

⚡ **ET C'EST POURQUOI LA SONDE DE MER NE POUVAIT PAS LE VOIR.**
`sonde-mer-crop.mjs` compare `uMerBord` **vivant** à `uMerBord` **idéal** ;
depuis le correctif de MER les deux sont égaux, donc son A/B rend **0 par
construction, houle comprise**. Une sonde neuve était nécessaire, et elle mesure
autre chose : **la géométrie**.

## 2. LA MESURE — l'arête relue dans le tampon, pas devinée

`scripts/sonde-mer-jupe.mjs` :

1. **l'arête** : le contour du crop (`|u| = 1` ou `|v| = 1` dans `aCrop`) est relu
   dans le **tampon d'attributs** de la nappe — donc **au repos** —, transformé
   par `matrixWorld`, projeté, puis rempli par balayage de lignes. C'est un
   masque exact, pas un seuil de couleur.
2. **la nappe** : sa silhouette par A/B `mer.visible` au GPU, **la calotte seule**
   (`setDrawRange`) — la jupe pend sous l'arête par construction et compterait
   comme un débordement qu'elle n'est pas.
3. **vingt images consécutives**, `uMerTemps` avancé de 0,137 s à chaque fois : la
   houle bouge, une image ne prouve rien.

⚡ **ET LE TÉMOIN EST CE QUI REND LA MESURE PROBANTE.** `uMerChop` ne pilote QUE
le terme latéral de Gerstner (`q`), jamais la hauteur. À `chop = 0` la sonde rend
**0 px hors arête sur les 18 postes**, avant comme après : le polygone est donc
exact, et les 31 à 64 px sont **entièrement** le déplacement latéral. Sans ce
témoin j'aurais attribué à un défaut ce qui aurait pu être la corde d'un arc.

**Campagne** (même serveur, même lieu, `AVANT` mesuré sur `src/` remisé, dans la
même session de banc) : 2 chargements × 3 déménagements de crop × 3 altitudes
(45 000 / 30 000 / 20 000 m), vue oblique (élévation 34°, azimut 45°) —
**18 postes probants sur 18**, des deux côtés.

## 3. LE CORRECTIF — deux lois, une par moitié

### ① La coupe est plate : la houle s'éteint AVANT le bord

`src/monde/mer-sphere.js` :

- `amplitudeLateraleHoule()` — la **borne** du terme latéral de Gerstner
  (`Σ q·a`, borne de Stokes comprise), rejouée sur les mêmes entrées que le
  nuanceur. ⚠️ **Ce n'est pas une seconde écriture** : le test ⑯a **relit**
  `src/vendor/ocean-waves/gerstner.glsl.js` pour vérifier que les cinq lignes
  qu'elle majore sont toujours les siennes, puis balaie 120 phases pour vérifier
  qu'elle majore vraiment.
- `bandeHouleBord()` — la largeur de la bande d'extinction : **deux fois**
  l'amplitude latérale. ⚠️ **Le facteur n'est pas un goût** : il faut
  `A · lissage(δ/B) < δ` sur toute la bande, et `max(3t − 2t²) = 1,125` en
  `t = 0,75` ; le test ⑯b **balaie les cent `δ`** plutôt que de croire l'algèbre,
  et vérifie qu'une marge de 1 laisse franchir.
- `GLSL_BORD_CROP` — la superellipse de la découpe, **extraite** de `MER_FRAG` et
  injectée dans les DEUX nuanceurs. Le sommet en a besoin ; la recopier aurait
  fait deux superellipses à garder d'accord, la faute que ce module raconte cinq
  fois. `MER_FRAG` n'a pas changé d'un caractère : les cinq lignes sont devenues
  un appel.

`src/globe.js`, `MER_VERT` : `attBord = attenuationBordMer(dBord, uMerBord.y,
uMerBandeHoule)` entre par **`fade`**, et c'est le point de la moitié ② autant
que de la ①. Dans `oceanGerstner`, `a = A·lenScale·waveH·fade` et
`q = min(chop·1,9·part·fade/(k·a), 1/(k·a))` : le produit `q·a`, **qui EST le
déplacement latéral**, vaut `chop·1,9·part·fade/k`. Il est linéaire en `fade`,
la hauteur `a·sin` aussi — un seul facteur éteint les deux, et le train dont
l'amplitude tombe sous `1e-7` est **sauté** par le `continue` de la boucle.

Bande relevée en production : **0,0702 à 0,0711 demi-côté**, soit **≈ 480 m au
sol** sur les 6 845 m du demi-côté. `parDemi = 0,2147` unité de scène (confronté à
la géométrie bâtie par ⑯f, pas cru sur parole). §4 mesure ce qu'elle déplace.

### ② La déformation hors emprise n'est plus calculée : les sommets n'existent plus

`construireCalotte()` gagne **`emprise`**, séparée de `portee` :

- **`portee` reste 3** — c'est elle qui cuit le champ, normalise `champ.unite` et
  ancre `profMaxCropM`, c'est-à-dire **la couleur du turquoise d'Adrien**. Le
  rapport MER §4 l'interdisait de bouger ; elle ne bouge pas d'un bit.
- **`emprise = 1`** — jusqu'où des SOMMETS existent. Depuis que `bordDeMer()`
  éteint la nappe à `−RETRAIT_EAU_CROP`, tout sommet au-delà de `|u| = 1` ne peut
  produire QUE des fragments rejetés.
- **`pas` est divisé dans le même rapport** (192 → 64) : la densité de maille ne
  bouge pas, et les nœuds de la grille resserrée tombent **exactement** sur ceux
  de l'ancienne — `(−1 + 2i/64) = (−1 + 2(i+64)/192)·3`. Le test ⑯d le vérifie
  **position par position et bit par bit** sur les 4 225 nœuds.

**37 249 → 4 225 sommets de calotte, 73 728 → 8 192 triangles.**

## 4. LA MER RESTE BELLE — mesuré, pas raisonné

⚡ **LA MESURE QUI COMPTE EST UN A/B DANS LA MÊME IMAGE, PAS UNE COMPARAISON DE
DEUX CAMPAGNES** — entre deux sessions la houle a changé de phase, et un écart s'y
lit toujours. Ici : A = la bande vivante, B = `uMerBandeHoule` mis à **zéro**,
c'est-à-dire la mer **sans aucune extinction de bord**, dans la même image, boucle
gelée.

| poste | part de la nappe que la bande déplace | témoin | retour |
|---|---|---|---|
| 9 postes (3 déménagements × 3 altitudes) | **0,92 % à 2,82 %** | **0 px** | **0 px** |

➡️ **97,2 % à 99,1 % de la nappe est identique au bit près** à une mer sans coupe
plate — et les 1 à 3 % restants sont **le liseré du bord lui-même**, celui qui
débordait. `.banc/MER2/APRES-bande.json`.

⚠️ **ET LA BANDE EST UNE BORNE DU PIRE CAS, DONC PLUS LARGE QUE LE DÉPLACEMENT
RÉEL.** `amplitudeLateraleHoule` somme les seize trains comme s'ils étaient
alignés et en phase ; ils ne le sont jamais. Elle vaut **0,0702 à 0,0711
demi-côté**, soit **≈ 480 m au sol** sur les 6 845 m du demi-côté — un liseré,
et c'est le prix explicite de la garantie « aucun sommet ne franchit ».

En croisé, sur les 18 postes appariés des deux campagnes, la **silhouette de la
nappe** vaut 2 354 285 px avant et 2 355 037 px après : **+0,032 %**, écart
maximal par poste **0,163 %** — la phase de houle entre deux sessions, sous le
bruit que PF3 §4 documente.

Captures, `.banc/MER2/pour-adrien/` (rendues au GPU dans la même tâche que le
`composer.render` — le piège n° 2 du rapport MER) :

- `1-angle-AVANT.png` / `1-angle-APRES.png` — **le cadrage d'Adrien**, l'angle du
  socle agrandi ×2. Avant : le bord est **festonné**, la mer mord sur le liseré
  d'ombre et le déborde par endroits. Après : **une droite franche**, l'ombre du
  bloc de largeur constante sur les deux côtés.
- `2-affiche-AVANT.png` / `2-affiche-APRES.png` — l'affiche entière au même poste :
  houle, écume de côte, glacis de lagon, nuages, caustiques — **tout est là**.
- `3-large-AVANT.png` / `3-large-APRES.png` — le témoin du large, à 20 000 m.

## 5. LE COÛT EN MILLISECONDES — ce que je NE peux PAS affirmer

⚠️ **Je ne livre pas un gain de temps GPU, et c'est délibéré.** L'A/B « nappe
visible / nappe cachée », 120 rendus × 9 répétitions avec `gl.finish()`, rend
**0,02 ms par image** — avec des valeurs **négatives sur 12 postes sur 18 avant**
et 1 sur 18 après. Autrement dit : **la passe mer est sous le bruit de mesure de
cette machine**, et un « −86 % de triangles » traduit en millisecondes serait du
maquillage.

➡️ **Le chiffre honnête de la moitié ② est donc celui que le brief autorise en
premier — les sommets traités** : `39 289 → 6 265` par image, et surtout
**3 969 sommets sur 39 289 (10,1 %) étaient les seuls à produire un pixel**. Les
35 320 autres passaient les seize trains de Gerstner, `shoreSurf` et une lecture
de texture **pour être rejetés par le `discard`**. C'est cette proportion, pas
une milliseconde, qui dit ce qu'Adrien appelle « cette déformation inutile ».

Sur une machine de bas palier (`palier-machine.js`), où la passe mer n'est plus
sous le bruit, l'économie sera celle de ces 89,9 %. **Je ne l'ai pas mesurée là,
donc je ne l'annonce pas.**

## 6. LES TESTS — ils rougissent sans le correctif

Inscrits dans `test/mer-sphere.test.js` et `test/ecume-mer.test.js`, **déjà dans
la liste explicite de `package.json`** — `audit:tests` **262 = 262**, aucun
fichier neuf. `npm test` : **4 888 · 0** (4 882 avant).

| test | ce qu'il ferme |
|---|---|
| ⑯a | `amplitudeLateraleHoule` **majore** le terme latéral — sur la source relue de `gerstner.glsl.js`, et vérifié sur 120 phases |
| ⑯b | la bande vaut 2 A, et **le balayage des cent `δ`** montre qu'une marge de 1 laisserait franchir |
| ⑯c | l'atténuation vaut **exactement** 1 dedans et **exactement** 0 au bord — la propriété qui autorise la sortie anticipée |
| ⑯d | la géométrie s'arrête à l'emprise, la **portée ne bouge pas**, et les 4 225 nœuds coïncident **au bit près** avec l'ancienne grille |
| ⑯e | `poserMer` bâtit 65², `uMerPortee` vaut toujours 3, `aCrop` reste en demi-côtés **bruts** (sinon le champ serait lu 9× trop gros) |
| ⑯f | `_majBandeHouleMer` lit les uniformes **vivants**, `parDemi` est confronté à la **géométrie bâtie**, et sans mer posée elle n'écrit nulle part |
| ⑥b, ⑧b, ⑧d, ⑪g, ⑫a | suivis à la nouvelle loi : la superellipse est **appelée** par les deux nuanceurs et **réécrite par aucun**, `attBord` est dans la garde ET dans `fade` |

**Quatre mutations rejouées une par une** (`src/` seul, tests inchangés) :

| mutation | rouges |
|---|---|
| `emprise = p` (la géométrie revient à la portée) | ⑯e, ⑯f |
| `fade` sans `attBord` | ⑧d |
| la garde sans `|| attBord <= 0.0` | ⑧b |
| `uMerBandeHoule` jamais posée | ⑫a, ⑯f |

## 7. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le déplacement latéral grandit avec la houle, donc la bande aussi »** —
   **faux, et c'est le test ⑯f qui me l'a dit, pas le raisonnement.** Mon premier
   jet exigeait « une houle deux fois plus haute, une bande deux fois plus large » ;
   relevé : **0,0811 → 0,0821, +1,2 %**. Dans `oceanGerstner`,
   `q·a = min(chop·1,9·part·fade/k ; 1/k)` — **l'amplitude se simplifie**. Le
   déplacement latéral ne dépend PAS de la hauteur de houle, seulement de la
   **cambrure** et de la longueur d'onde (la hauteur n'entre que par la borne de
   Stokes). Bonne nouvelle pour D24 : la coupe plate ne s'élargit pas quand
   Adrien monte sa houle. Le test exerce désormais `chop`, et documente pourquoi.
2. **« La sonde de MER verra le défaut »** — non, et **par construction** : son
   A/B compare `uMerBord` vivant à `uMerBord` idéal, qui sont égaux depuis son
   propre correctif. Elle rend **0 hors emprise houle comprise**, à tous les
   postes, **avant comme après**. Une sonde qui mesure le bon réglage ne voit pas
   une géométrie qui le contredit. J'ai bâti la mesure géométrique pour ça.
3. **« Une vue du dessus suffit »** — non, et j'ai failli publier un zéro
   tautologique. À 12 000 m au zénith, le bloc **remplit l'écran** : le polygone
   de l'arête couvre **1 024 000 px sur 1 024 000**, et « hors arête » ne peut
   valoir que 0. C'est le cadrage OBLIQUE d'Adrien qui porte la mesure, et la
   sonde incline désormais la vue elle-même.
4. **« `e.camera` projette la nappe »** — non : elle vit dans `sceneGlobe`, rendue
   par **`camGlobe`** (la passe de fond, `main.js:4981`). Projetée avec la caméra
   du bloc, l'arête tombait à **−846 px**, hors de l'écran, et la sonde comptait
   **305 933 px « hors arête » sur 305 328 px de silhouette** — c'est-à-dire toute
   la mer. C'est la confusion d'espace bloc/globe, payée une fois de plus ; le
   garde-fou est maintenant dans le code de la sonde.
5. **« `page.evaluate(chaîne, args)` passe les arguments »** — non. Quand le
   premier argument est une **chaîne**, puppeteer l'évalue comme une expression et
   **ignore les suivants** : mon premier poste a rendu `{}` (la fonction
   sérialisée) et la sonde l'a annoncé « AUCUNE MER ». Les arguments sont
   désormais collés dans la source.
6. **« `maille` doit valoir le pas relevé sur la géométrie »** — non, et l'accuser
   aurait été accuser D24 d'un écart qu'il n'a pas fait. Relevé **0,003354 contre
   0,003599, 6,8 %**, au coin comme au centre : `maille` est un pas **nominal**,
   calculé en unités de Mercator, qui sur-estime la distance au sol de `1/cos φ`
   — **il valait déjà cela avant ma tâche**. Le test verrouille donc le RAPPORT
   (la densité), et ⑯d prouve l'identité position par position.
7. **« La campagne écrira son JSON »** — non : ma première campagne AVANT s'est
   arrêtée sur une **page détachée** au 8ᵉ poste et n'a **rien** écrit — dix-sept
   relevés qui n'existaient plus que dans la console. La sonde écrit maintenant
   **à chaque poste**, et repart d'une page neuve au lieu de perdre la suite.

## 8. À DONNER AUX AUTRES

- ⚡ **LE DÉFAUT DU LIEN PROFOND EST TOUJOURS LÀ, ET JE NE L'AI PAS CORRIGÉ**
  (hors périmètre, signalé par MER §8) : au démarrage par `#s=` avec `loc`, le
  champ de la mer est cuit **VIDE**. **Je n'ai donc pas pu tenir « trois lieux »
  du critère** : les trois postes de chaque passe sont trois **déménagements du
  crop** (`controls.target.x ± 25`, la seule translation qui ne passe pas par
  `flyTo`), soit trois traits de côte différents de La Réunion, pas trois lieux
  du monde. Je préfère le dire que maquiller. Les **3 altitudes × 2 chargements ×
  3 postes = 18** sont, eux, tenus des deux côtés.
- **`sonde-mer-jupe.mjs` est rejouable et générique** : elle mesure « des pixels
  de la nappe hors de l'arête du socle » sans rien savoir du correctif. Elle
  servira à qui touchera au bord de la mer après moi — et son témoin `chop = 0`
  est le garde-fou qui distingue un vrai débordement d'une corde de polygone.
- **wt-cull** : la nappe ne soumet plus que **10 232 triangles** au lieu de
  75 768, et sa `boundingSphere` a été divisée par trois. Si vous comptiez la mer
  dans un budget de tri, le chiffre a changé.
- **`construireCalotte` sépare désormais `portee` (le champ) et `emprise` (la
  surface)**. C'était le même paramètre pour deux grandeurs ; qui voudra un jour
  toucher à l'une sans l'autre n'aura plus à choisir.

## 9. COMMITS (branche `mer-jupe-plate`, au-dessus de `981aea7`)

- « La mer se coupe à plat sur la jupe, et ne déforme plus hors de l'emprise » —
  `mer-sphere.js` (`emprise`, `EMPRISE_MER_CROP`, `amplitudeLateraleHoule`,
  `bandeHouleBord`, `MARGE_BANDE_HOULE`, `GLSL_BORD_CROP`), `globe.js`
  (`MER_VERT`, `MER_FRAG`, `poserMer`, `_majBandeHouleMer`, `majReglagesMer`),
  `test/mer-sphere.test.js` (⑯a à ⑯f), `test/ecume-mer.test.js`,
  `scripts/sonde-mer-jupe.mjs`, et ce rapport.
