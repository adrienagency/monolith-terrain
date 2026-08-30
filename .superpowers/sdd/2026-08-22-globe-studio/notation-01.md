# NOTATION 01 — le crop face au socle d'avant la sphère

**Agent noteur · 2026-08-22 · `C:\Dev\wt-merge`, branche `regroupement`, HEAD `06b2339`
(arbre propre, aucune source touchée).**

> **Adrien :** *« Utilise des agents noteurs qui jugeront la conformité visuelle avec celle
> précédant le passage en mode sphère. »*

**Toutes les captures et tous les chiffres de ce rapport sont les miens**, pris ce jour, et
laissés dans **`.banc/vues-notation/`** (45 fichiers : 20 captures et 25 relevés, dont
`bilan-notation.json` qui rassemble tout ce que ce rapport avance). Cadre **1 280 × 800 = 1 024 000 px**, La Réunion, z12, vue isométrique 0,
`fov = 33`, rendu dans une **cible à profondeur**, **sans compositeur**.

---

## 0. ⚡ LA DÉCOUVERTE DE PROTOCOLE — ET ELLE INVALIDAIT MA PREMIÈRE SÉRIE

**Sous `?terre=unique`, le socle N'EST PAS DÉTRUIT : il est seulement caché**
(`poserVisibiliteSocle`, `main.js:4544` → `terrain.mesh.visible = false`,
`plinth.setVisible(false)`). Relevé dans la page vivante : `terrain.mesh` porte
**594 434 sommets** du MNT courant, et `terrain.mapUniforms.uRampTex === globe.uniforms.uRampCrop`
ainsi que `terrain.mapUniforms.uAnalysis === globe.uniforms.uAnalysis` rendent **`true`**.

➡️ **On peut donc rallumer le socle DANS LA MÊME PAGE et rendre les deux blocs à la même
seconde, sur la même palette, le même MNT, le même look, la même lumière.**

⛔ **Et il le fallait.** Ma première série comparait deux chargements. Relevé au même instant
dans le second : `params.plinthColor = '#d8d4cc'` — mais la paroi VIVANTE du socle valait
**`c06a44`** (terracotta). **Les deux chargements n'avaient pas la même palette**, et toute
comparaison de teinte entre eux était fausse. **Cette série-là est sur le disque
(`SOCLE-reunion-z12-iso0-BLOC-k1175.png`) et je NE M'EN SERS PAS pour noter la couleur** — je
n'en garde que l'ombre portée, qui ne dépend pas de la palette.

**Toute la notation ci-dessous vient des paires « même page ».**

---

## 1. LA PREUVE D'APPARIEMENT

### 1.1 Le piège mord, et voici de combien

À **caméra rigoureusement identique** (même cible, même `fov`, même cadre), sur le cadrage
intérieur :

| | pixels du bloc | fraction du cadre |
|---|---|---|
| crop, `?terre=unique` | **216 061** | 21,10 % |
| socle rallumé, MÊME caméra | **294 304** | 28,74 % |

➡️ **×1,362 en aire, ×1,167 en taille linéaire.** Noter là aurait noté du cadrage.

La fraction est comptée **en CACHANT le bloc et en comptant ce qui change** — jamais l'alpha
(`getClearAlpha()` vaut 1, une preuve naïve rendrait 1 024 000 / 1 024 000).

⚠️ **ET LES OMBRES SONT COUPÉES PENDANT LA MESURE.** Cacher le socle efface aussi son ombre
portée : elle serait comptée comme du bloc et fausserait `k` de 2,6 %. Elle est rallumée pour
le rendu qu'on note.

### 1.2 ⛔ Mon premier balayage était FAUX, et je dis pourquoi

En déplaçant la caméra **de l'application**, la suite n'était pas monotone (k = 1,20 → 225 427
puis k = 1,21 → 228 641) : l'application se recadre quand on lui bouge sa caméra. **Ce
balayage-là est retiré.** Le balayage retenu utilise un **CLONE** de la caméra, que
l'application ne voit jamais : deux mesures du même `k` rendent alors **232 566 et 232 566**,
identiques au pixel.

### 1.3 Les appariements retenus

| cadrage | crop | socle | `k` | **écart** |
|---|---|---|---|---|
| **intérieur** (tout terre) | 216 061 px | **216 068 px** | 1,1588 | **+0,0032 %** |
| **côte** (terre + mer) | 218 966 px | **218 839 px** | 1,159 | **−0,058 %** |

➡️ **Appariés à 0,0032 % et 0,058 %** — soit **310 fois** et **17 fois** mieux que le 1 %
demandé. Balayages complets dans `sweep-*.json` et `duo-*.json`.

---

## 2. LA PREUVE DE TÉMOIN NUL

Sur **1 024 000 pixels**, deux prises consécutives du même état :

| témoin | pixels différents |
|---|---|
| crop, cadrage intérieur | **0** |
| crop, cadrage côte | **0** |
| socle, cadrage intérieur | **0** |
| socle, cadrage côte | **0** |
| aller-retour (bloc caché puis remis) | **0** |
| aller-retour d'éclairage (hémisphère coupée puis rendue) | histogramme de teinte **identique** |

**Et ce zéro n'est pas un banc vide** : cacher le bloc change **216 061** pixels. Le chemin est
le rendu de la scène seule dans une cible à profondeur (⚠️ `depth: false` sur le canevas de la
page), **sans compositeur, donc sans le grain de pellicule animé**.

**Reproductibilité entre deux chargements** : le cadrage intérieur rend **216 061 px les deux
fois, au pixel près** ; le cadrage côte 218 849 puis 218 966 (**0,053 %** d'écart, la
bathymétrie n'ayant pas fini de charger la première fois).

---

## 3. LES NOTES

### ① Richesse du relief — **6 / 10**

**La texture est là, et elle porte.** Sur `DUO-CROP-interieur.png` les crêtes sont peignées,
les ravines creusées, les remparts des cirques se lisent un par un. Ce n'est plus le dégradé
lisse d'avant P2.

**La mesure** (énergie de détail = gradient de luminance local moyen, calculé **uniquement sur
les pixels dont les deux voisins sont AUSSI dans le masque**, donc jamais sur la silhouette) :

| | crop | socle | |
|---|---|---|---|
| énergie de détail | **11,661** | **16,435** | socle **+40,9 %** |
| écart-type de luminance | 44,90 | 50,54 | socle **+12,6 %** |

➡️ Le crop atteint **71 % du contraste local du socle**. C'est le critère le mieux servi, et de
loin.

**Ce qui manque est nommé, pas deviné** : sur le socle, couper le soleil directionnel fait
tomber l'énergie de détail de **15,392 à 8,722 (−43,3 %)** — c'est lui qui fabrique le dernier
tiers, et le nuanceur des tuiles du crop n'a pas de terme d'éclairage.

### ② Palette et contraste — **3 / 10**

**C'est la note la plus basse et la plus démontrable.** Histogramme de teinte en 12 secteurs de
30°, sur les deux masques appariés à 0,0032 % :

| | crop | socle | |
|---|---|---|---|
| pixels **hors** de la bande orange (0–60°) | **562** | **36 478** | socle **×65** |
| en part du bloc | **0,26 %** | **16,92 %** | |
| pixels quasi neutres (saturation < 0,10) | **1,30 %** | **7,44 %** | socle **×5,7** |
| écart-type de saturation | 0,1947 | 0,2542 | socle **+30,6 %** |
| luminance moyenne | 84,26 | 91,85 | socle +9,0 % |

⚡ **Six secteurs sur douze (150° → 330°) sont à ZÉRO PIXEL sur le crop.** Le socle y en a
**8 778**. Le crop n'est pas « fade » : il est **monochrome**. Toute son image tient dans deux
secteurs de teinte.

### ⚠️ ③ Trait et bordure — **3 / 10**, et une correction de justice

**Les courbes de niveau ne comptent PAS contre le crop** : relevé au même instant,
`uContourOpacity = 0` **des deux côtés**. Personne ne les voit, ni sur le socle ni sur le crop.
C'est la réserve n° 5 de P2, et elle est **commune**, pas imputable au crop.

**Le trait de côte est présent** sur le crop (`uCoastMaskOn = 1`, `col = mix(col, uInk, cote*0.55)`,
`globe.js:1216-1219`) — il est simplement noyé sous l'écume (voir ④).

**Ce qui casse la note, ce sont les arêtes du bloc.** Sur `zoom-CROP-base.png` (ma découpe ×2) :
la nappe de terrain **déborde par-dessus la paroi** sur toute l'arête ouest — deux arêtes au
lieu d'une, et un porte-à-faux. Sur `zoom-SOCLE-base.png`, pris au même endroit et à la même
échelle, la surface rencontre la paroi le long d'**une seule arête franche**, et l'angle du
bloc se lit parce que les deux faces n'ont pas la même valeur.

### ④ La mer — **2 / 10**

**C'est ce qui saute le plus aux yeux.** Comparez `CROP2-cote.png` et
`DUO-SOCLE-cote-apparie.png` (appariés à 0,058 %) : le socle rend un bleu-canard profond avec
une **frange turquoise fine collée au trait de côte** ; le crop rend un bleu marine constellé
d'une **nappe blanche énorme et en plaques**.

| | crop | socle | |
|---|---|---|---|
| pixels très clairs et peu saturés (L > 200, sat < 0,25) | **26 128** (11,93 %) | **3 376** (1,54 %) | crop **×7,7** |
| luminance moyenne du bloc | **112,71** | 79,39 | crop **+42,0 %** |
| saturation moyenne | 0,4173 | **0,5869** | socle **+40,6 %** |
| teinte 210–240° (bleu) | **49 718** | 1 701 | crop **×29,2** |
| teinte 180–210° (turquoise) | 29 967 | **51 559** | socle ×1,72 |

➡️ Deux fautes distinctes, et il faut les séparer : **l'écume est 7,7 fois trop étendue**, et
**la mer est d'un secteur de teinte trop froid** (bleu là où le socle est turquoise).

Et sur `z-CROP-cote-nappe.png` : la **nappe de mer et le dessus du bloc ne sont pas la même
surface** — deux niveaux, un porte-à-faux, et **quatre jupes bleues qui pendent dans le vide**.

### ⑤ Les parois et la base — **2 / 10**

**Preuve dure, relevée au même instant dans la même page :**

| | valeur vivante |
|---|---|
| `params.plinthColor` | `#d8d4cc` |
| paroi du **socle** (`plinth.wallMat.color`) | **`c06a44`** |
| paroi du **crop** (`_parois.material.uniforms.uCol`) | **`d8d4cc`** |

➡️ **`globe.js:3520` code la couleur en dur** : `uCol: { value: new THREE.Color('#d8d4cc') }`,
avec le commentaire « `params.plinthColor` par défaut ». **Le socle n'utilise plus cette valeur
à l'exécution.** La paroi du crop est donc fausse *par construction*, et elle le restera quelle
que soit la palette.

Il manque aussi, et je les ai vues sur mes découpes : le chanfrein, l'assombrissement vers le
bas, **et l'ombre portée** — mesurée à **26 729 px, soit 2,61 % du cadre** sur le socle, contre
**0** sur le crop. Rien n'ancre le bloc au sol.

⚖️ **En toute justice** : le nuanceur des parois du crop n'est pas nu — il porte une occlusion
de contact par sommet (`aoCrop`) et un terme diffus (`globe.js:3535-3545`). Ce qui manque est
la **couleur juste** et la **matière**, pas tout l'appareil.

### ⑥ Propreté — **3 / 10**

**Le banc est propre** (témoins à 0 partout, §2). **L'image ne l'est pas.**

Sur ma seule capture intérieure : **au moins six langues de jupe pendent sous le bloc**, au-delà
de la paroi, dans le vide (`zoom-CROP-base.png`). Sur la côte, **quatre de plus** sous la nappe
de mer. La bande d'écume est **quantifiée en plaques** à bords durs, pas dégradée.

⚠️ **Je ne note PAS le clignotement** : toutes mes prises sont **au repos**, et je n'ai donc
aucune donnée sur le battement en mouvement. **Je préfère le dire que d'inventer une note.**

---

## 4. LA NOTE GLOBALE — **3,5 / 10**

Moyenne pondérée, le relief comptant double parce que c'est **la plus grande surface de
l'image** : `(6×2 + 3 + 3 + 2 + 2 + 3) / 7 = 3,57`. Moyenne simple : **3,2**.

**Non, ça ne ressemble toujours pas au socle.** Mais le progrès est réel et il est mesuré : le
peigné du relief est là et rend 71 % du contraste local de la référence. **Ce n'est plus la
texture qui manque.**

---

## 5. ⚡ CE QUI MANQUE LE PLUS — LA LISTE ORDONNÉE

### 1️⃣ L'ÉCLAIRAGE DES TUILES DU CROP — *et je CONFIRME P2, avec une correction*

**La tuile du globe sort une couleur nue.** Le socle est un `MeshPhysicalMaterial` éclairé par
un soleil (`fff7e6`, intensité **3,743**) et une lumière d'hémisphère (ciel `85c2eb`, sol
`4a3a2a`, intensité **0,810**).

**Expérience décisive, même masque, retour vérifié identique :**

| état du socle | hors bande orange | pixels neutres | énergie de détail |
|---|---|---|---|
| les deux lumières | **15,64 %** | **7,03 %** | **15,392** |
| **sans l'hémisphère** | **7,24 %** (−53,7 %) | **2,90 %** (−58,7 %) | 14,833 |
| **sans le soleil** | 23,24 % | 7,82 % | **8,722** (−43,3 %) |

➡️ **Couper l'hémisphère retire plus de la moitié de la richesse de teinte du socle et près de
60 % de ses neutres, et le pousse vers la signature du crop.** L'hémisphère fabrique la
couleur ; le soleil fabrique le relief. Le crop n'a ni l'un ni l'autre.

⛔ **CORRECTION À P2, §0.1.** P2 range **le compositeur** parmi les causes de l'écart. **Il n'en
est pas une** : `composer.addPass(passeFond, 0)` (`main.js:4412`) met `sceneGlobe` — le crop —
**dans le même compositeur, dans la même image**. L'exposition, le contraste et la saturation
s'appliquent **identiquement aux deux**. Chercher l'écart là ferait perdre du temps. En
revanche, la conclusion de P2 (« aucune rampe ne comblera cet écart ») est **confirmée par la
mesure** : rampe et texture d'analyse sont **le même objet `three`** des deux côtés, et l'écart
subsiste entier.

**Où ça vit** : le nuanceur de fragment des tuiles, `src/globe.js` (la chaîne `col = …`,
~l. 1039–1240). `uSunDir` et `uShadowColor` **y sont déjà déclarés** — le nuanceur des parois
s'en sert, lui, à `globe.js:3535-3545`.
**Ce que ça coûte** : quelques lignes de GLSL et deux à trois uniformes pour le terme diffus +
hémisphère. ⚠️ **Le vrai coût n'est pas là** : il est dans **l'accord d'exposition** avec le
`MeshPhysicalMaterial` du socle. Poser une seconde loi d'éclairage qui dériverait de la première
serait exactement la faute que D13 §③ demande d'éviter. **C'est le poste le plus rentable de la
liste, et le plus délicat.**

### 2️⃣ LA COULEUR DES PAROIS — *le gain le moins cher du tableau*

Socle `c06a44`, crop `d8d4cc`, **au même instant, sur la même palette**. Écart RGB
(24, 106, 136) : la paroi du crop est froide là où celle du socle est terracotta, et elle
n'appartient à aucune famille de teinte de l'image.

**Où ça vit** : `src/globe.js:3520`, `_materiauParois()`.
**Ce que ça coûte** : **très peu**. Lire la couleur vivante de la paroi du socle dans l'uniforme,
et l'inscrire dans `CHAMPS_HABILLAGE` (`branchement-crop.js`) pour qu'elle suive les changements
de palette — le patron existe déjà pour `rampe2D`, qui change d'identité à chaque palette.

### 3️⃣ L'ÉCUME DE LA MER — *7,7 fois trop, et en plaques*

**26 128 px contre 3 376** sur des cadres appariés à 0,058 %. C'est ce qui rend la mer du crop
méconnaissable, plus encore que sa teinte.

**Où ça vit** : `src/globe.js:322-324` —
`ecume = clamp((moutons + ressac * 1.8 + lisere * 1.1) * vRichesse, 0.0, 1.0)` puis
`col = mix(col, vec3(0.96), ecume)`. Le champ qui l'alimente est cuit en demi-flottants vers
`globe.js:3120-3128`, avec un déclin côtier normalisé par
`dist / (15 * (largeurUnites / (56 * portee)))`.
**Ce que ça coûte** : moyen. Les trois constantes (1,8 / 1,1 / 0,96) et la normalisation du
déclin sont à re-dériver contre celles du socle. ⚠️ **Et la résolution du champ est à vérifier
en plus** : la bande est visiblement **quantifiée en plaques**, ce qu'un simple réglage de gain
ne corrigera pas.

### 4️⃣ LA NAPPE DE MER ET LE DESSUS DU BLOC, UNE SEULE SURFACE

Deux niveaux, un porte-à-faux, des jupes bleues qui pendent (`z-CROP-cote-nappe.png`). C'est ce
qui fait que le bloc ne se lit pas comme **un objet**, mais comme des morceaux empilés. Défaut
déjà connu, **retrouvé et confirmé sur ma propre capture**.

**Où ça vit** : `poserMer` (`globe.js` ~2847–3030, maillage `crop-mer`) face à
`construireParoisCrop` (~3398) et à la surface des tuiles.
**Ce que ça coûte** : **cher** — c'est un accord de géométrie à trois (plan de mer, surface du
crop, anneau haut de la paroi), pas un réglage. C'est pourquoi je le place après trois postes
plus rentables, alors qu'il est plus grave qu'eux à l'œil.

### 5️⃣ LES JUPES DE TUILES SOUS LE BLOC, ET L'ABSENCE D'OMBRE PORTÉE

**Au moins six langues** au-delà de la paroi sur ma capture intérieure, quatre de plus sur la
côte. Et **0 pixel d'ombre portée** contre **26 729 px (2,61 % du cadre)** sur le socle : rien
ne pose le bloc sur quoi que ce soit.

**Où ça vit** : les jupes sont posées dans `_buildMesh` (`globe.js:4127-4162`, `skirtDrop`
borné à 0,9 unité par `JUPE_MAX`, l. 473) ; l'ombre demande que le crop entre dans la carte
d'ombre de la scène de fond — or `passeFond.skipShadowMapUpdate = true` (`main.js:4410`).
**Ce que ça coûte** : les jupes, **faible à moyen** (les couper à l'intérieur du crop, où elles
ne servent à rien puisque les tuiles y sont jointives). L'ombre, **moyen** — il faut un receveur
et une passe d'ombre dans la scène de fond, et le drapeau ci-dessus dit que ce n'était pas prévu.

---

## 6. MES RÉSERVES

1. ⚠️ **UN SEUL LIEU.** Tout est sur La Réunion. Un crop continental (pas de mer) ou de haute
   latitude (`uHemi = +1`) n'est pas jugé ici.
2. ⚠️ **TOUT EST AU REPOS.** Je n'ai aucune donnée sur le clignotement, le battement des
   alentours ou les coutures en mouvement. Le critère « propreté » est donc noté **sur les
   défauts statiques seulement**, et je le dis dans la note.
3. ⚠️ **PAS DE COMPOSITEUR.** Mes deux côtés sont rendus sans lui — c'est ce qui rend le témoin
   exploitable. Comme il s'applique identiquement aux deux (§5.1), cela ne biaise pas la
   comparaison, **mais mes images ne sont pas exactement celles qu'Adrien voit**.
4. ⚠️ **UNE MESURE ABANDONNÉE, ET JE NE LA REMPLACE PAS PAR UNE APPROXIMATION.** J'ai tenté de
   donner la **largeur en pixels** de la frange côtière, rangée par rangée
   (`.banc/frange-notation.mjs`). Elle ne sépare pas l'écume des crêtes claires de la terre :
   sur le socle, une rangée rend 54 px de « clair » qui sont une arête enneigée, pas une frange.
   **Aucune largeur n'est reportée.** Seul le compte agrégé sur le masque apparié l'est.
5. ⚠️ **L'ÉNERGIE DE DÉTAIL DU CADRAGE CÔTE EST TROMPEUSE ET JE NE M'EN SERS PAS.** Le crop y
   rend 12,581 contre 10,403 au socle — un chiffre *plus haut*. Ce n'est pas du relief : c'est
   la bande d'écume en plaques, qui est du bruit haute fréquence. **La note ① s'appuie sur le
   cadrage intérieur, sans mer, où la mesure veut dire ce qu'elle dit.**
6. ⚠️ **`uHeightContrast` / `uHeightPivot` valaient 2,2 / 0,41 chez moi contre 2,5 / 0,65 chez
   P2.** Ce sont des réglages vivants, pas des constantes. Mes chiffres et les siens ne se
   comparent pas terme à terme — **mais mes deux côtés partagent les mêmes**, ce qui est la
   seule chose qui compte pour une note.

---

## 7. CE QUI RESTE SUR LE DISQUE

`.banc/vues-notation/` — **20 captures PNG** (dont les deux paires appariées « même page » et
six découpes ×2) et **25 fichiers de relevés**, `bilan-notation.json` compris. Outils :
`.banc/serveur-vues-notation.mjs` (port 5600), `.banc/decoupe-notation.mjs`,
`.banc/frange-notation.mjs`.

**Les paires à regarder d'abord :**
- `DUO-CROP-interieur.png` ↔ `DUO-SOCLE-interieur-apparie.png` (**+0,0032 %**)
- `CROP2-cote.png` ↔ `DUO-SOCLE-cote-apparie.png` (**−0,058 %**)
- `zoom-CROP-base.png` ↔ `zoom-SOCLE-base.png` (les parois, ×2)
- `z-CROP-cote-nappe.png` (la nappe, le porte-à-faux, les jupes)
