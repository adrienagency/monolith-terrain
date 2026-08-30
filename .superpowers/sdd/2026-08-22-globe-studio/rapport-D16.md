# ⚡ LE CHIFFRE QUI DOIT SURVIVRE À CETTE TÂCHE

> **La seconde caméra, le second espace, la similitude `poseFond`, la seconde
> passe de rendu et le `ClearPass` qui efface la profondeur existaient pour
> dessiner UN SPRITE DE SOLEIL — deux triangles.**

Mesuré, pas déduit. 969 images de surface sous `?terre=unique`, appels de dessin
comptés sur `renderer.info.render` **autour de chaque passe** (`.banc/D16/passes1.json`) :

| | appels de dessin | triangles |
|---|---|---|
| passe de **FOND** | 32 à 124 | **129 122 en médiane, 286 246 au MAX** |
| passe de **SURFACE**, 60,4 % des images | **0** | **0** |
| passe de **SURFACE**, les 39,6 % restantes | 3 à 36 | **168 au pire** |

➡️ **0,059 % des triangles**, au pire. Et l'inventaire de la scène le nomme
(`.banc/D16/scene2.json`) : **un seul objet visible porteur de géométrie**, le
`Sprite` de `SunDisc`.

**Ce que ça coûtait : le flou d'arrière-plan, entièrement.** Le `ClearPass`
remettait la profondeur à 1,0 et le sprite est en `depthWrite: false` — le tampon
valait donc 1,0 sur toute l'image. Mesuré au pixel : **0 sur 1 024 000**, aux
sept réglages, contre 248 229 en production.

⚠️ **ET L'ARGUMENT ÉCRIT QUI JUSTIFIAIT TOUT ÇA VAUT 0,173 %.** L'en-tête de
`monde/frontiere-rendu.js` disait qu'un `far` unique reviendrait à « dégrader
[le] tampon de profondeur [du bloc] pour rien ». La résolution de profondeur à la
distance `z` vaut `z²(f−n)/(n·f·(2ᵇ−1))` : dès que `f ≫ n` elle **ne dépend plus
de `f`**. Desserrer `far` **×1 448** coûte **+0,173 %** ; diviser `near` par deux
coûte **+99,7 %**. Les deux chiffres sont dans `test/frontiere-rendu.test.js` ⑩.

⛔ **Si quelqu'un veut remettre le `ClearPass` « par prudence » dans six mois :
ces chiffres sont aussi dans le code, au bloc « UNE SEULE PASSE, UNE SEULE
CAMÉRA » de `src/main.js`, et dans `src/export-effets.js`.**

---

# ⚡ DEUX RUPTURES DU CATALOGUE SE REFERMENT AVEC UNE SEULE CORRECTION

⛔ **La rupture ② (« le balayage fait monter la caméra de rendu de +32,6 % ») et
la moitié altitude de la rupture ⑥ (la sortie d'orbite) sont LA MÊME FORMULE.**

`_altitudeFondM()` rend `camY × emprise / span` — **le côté vertical du
triangle**. La caméra qui rend est à `√((R + k·camY)² + k²·r²)` du centre : le
déport horizontal de la vue de trois quarts la pousse vers le haut. Le rapport ne
dépend que de l'altitude, et il se calcule d'avance.

**Vérification croisée, que je n'ai pas cherchée :** mon test en arithmétique pure
rend **×1,0026 à 30 km d'altitude** — exactement le chiffre que l'inventaire avait
relevé **au navigateur** pour le balayage de pose près du sol, sur un phénomène
qu'il croyait distinct. Quatre décimales, deux méthodes indépendantes.

➡️ **Ne rouvrez pas la rupture ② en croyant qu'elle est encore là.** Elle est
fermée avec la ⑥, par la correction de l'étape ①.
⚠️ **Réserve** : je n'ai pas remesuré la ② en isolant le balayage au navigateur
(il faut le scénario `clic`). Ce que j'affirme, c'est que la CAUSE est la même et
qu'elle est corrigée à sa source ; pas que j'ai revu son chiffre à l'écran.

---

# RAPPORT D16 — UNE SEULE CAMÉRA

> Arbre `C:\Dev\wt-vue`, branche `vue-unique`, partie de `6157862`.
> Matériel : ANGLE (NVIDIA RTX 3080, D3D11), Chrome sans tête 1280 × 800, port 5537.
> URL : `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee&soleil=heure`
> ⚠️ **Un seul poste, un seul lieu** (La Réunion, le lieu de démarrage par défaut).
> Tout chiffre de ce rapport est le mien, relevé par `scripts/sonde-d16.mjs`.

---

# ÉTAPE 1 — LA LIGNE DE BASE EST REPRODUITE

**Statut : ✅ l'instrument marche chez moi et rend les chiffres de l'inventaire.**

Trace `.banc/D16/base-desc1.json` — 1 014 images, 0 erreur de page, descente à la
molette depuis `MAX_ALT_M = 60 000 000` m jusqu'au premier crop.

| ce que l'inventaire annonce | ce que je relève |
|---|---|
| franchissements 11,863 / 6,117 / 2,935 / 1,435 / 0,710° | **11,863 / 6,117 / 2,935 / 1,435 / 0,710°** |
| traversée orbite → surface à ≈ 12 000 km | **11 970 932 m** |
| `dImg` de la traversée 29,00 / 29,01 / 29,30 | **29,050** |
| MAX rapport d'altitude de fond 1,0822 – 1,0884 | **1,0847** |
| MAX déplacement relatif du fond 0,1303 – 1,1312 | **0,13132** |
| axe du bloc au franchissement : 0,000° | **0,000°** |

➡️ **Reproduit au millième sur les cinq franchissements.** Je pars donc de sa
ligne de base sans la rediscuter.

---

# ÉTAPE 2 — L'ANCRE : LA PIRE RUPTURE TOMBE SANS TOUCHER À L'ARCHITECTURE

**Statut : ✅ livré, mesuré, testé.**

## Ce qui a été mesuré AVANT d'écrire une ligne

L'inventaire nomme la cause (`quaternionDeBase(ancre)`, ancre snappée sur la
grille de tuiles) mais ne dit pas par quoi la remplacer. J'ai **étendu la sonde**
— pas reconstruit : `sonde-d16.mjs` relève désormais, par image, le lat/lon de
**trois ancres candidates**, avec l'arithmétique de `geo.js`, et le lecteur en
sort le déplacement en **degrés d'arc d'une image à l'autre**. C'est la grandeur
qui prédit la rupture : `quaternionDeBase` tourne du même angle que l'ancre.

Trace `.banc/D16/ancres1.json` — 1 059 images, mêmes conditions.

| ancre | médiane | p95 | p99 | **MAX** | au cran z3 → z4 |
|---|---|---|---|---|---|
| **centre du bloc** (le dépôt) | 0,000° | 8,538e-7° | 8,538e-7° | **15,2215°** | **15,2215°** |
| aplomb de la **caméra** | 0,03815° | 0,3711° | 1,882° | 6,5938° | 2,0725° |
| **aplomb de la CIBLE** | **0,000159°** | **0,002547°** | **0,005309°** | 7,6643° | **0,2138°** |

Aux quatre franchissements de surface, ancre-centre → ancre-cible :
**15,2215 → 0,2138°**, **7,7183 → 0,0291°**, **3,7829 → 0,0295°**.
Le seul endroit où l'ancre-cible bouge encore beaucoup (7,6643°) est **la
naissance du bloc** à la traversée orbite → surface : il n'y avait pas de cible
avant, ce n'est pas un franchissement.

➡️ **Le centre du bloc est un artefact de la grille de tuiles slippy** : il ne
bouge JAMAIS (médiane exactement 0,000°) puis saute de 15° en une image.
**L'aplomb de la cible traverse le cran** parce que `_rescale` repose la cible
sur le nouveau bloc et que `_suivreEmprise` y raccroche la caméra : le LIEU visé
est continu, par construction.

## Le geste

`poseFond` reçoit un paramètre `origineBloc` (défaut `[0,0,0]` — **le dépôt au bit
près**, verrouillé par un test) qui dit quel point du bloc se pose sur la sphère
au lat/lon donné. `majCameraFond` lui passe l'aplomb de `controls.target`.
⚠️ **x et z seulement, jamais y** : le plan `y = 0` est ce qui se pose sur la
sphère, la cible vit à `Y_CIBLE = −0,3` ; lui retrancher son `y` enfoncerait la
planète de 1 340 m à z12 et de 75 km à z3.

## Le résultat, même instrument, même geste

Trace `.banc/D16/ancre-fix1.json` — 1 035 images, 0 erreur de page.

| grandeur | **avant** (`base-desc1`) | **après** (`ancre-fix1`) |
|---|---|---|
| **MAX rotation de visée du fond** | **11,863°** | **1,500°** ⚡ |
| MAX inclinaison image à image du fond | 3,8005° | **0,51860°** |
| **MAX déplacement relatif du fond** | **0,13132** | **0,022875** |
| MAX rapport d'altitude de fond | 1,0847 | **1,0286** |
| p99 `dImg` | 2,333 | **1,462** |
| MAX `dImg` | 29,050 | 28,796 |
| médiane `dImg` | 0,3563 | 0,3521 |

⚡ **LES CINQ FRANCHISSEMENTS ONT DISPARU DU RELEVÉ.** Après correction, les plus
gros déplacements de la caméra de rendu de toute la descente sont des **crans de
molette ORBITAUX** (altitude de fond > 22 000 km, rotation de visée 0,000°,
`dImg` < 0,8) — c'est-à-dire du mouvement voulu, pas une rupture.

**Le 1,500° qui reste est le plafond que R4 s'est donné** (`PAS_POSE_MAX_DEG`) :
sur ces images la caméra du BLOC tourne aussi de 1,500°, donc les deux caméras
sont d'accord. C'est le balayage de pose, traité à l'étape 5, pas un décrochage.

**Effet secondaire non cherché, et il est gros** : la traversée orbite → surface
(rupture ① de l'inventaire) perd elle aussi son mouvement de caméra —
axe **3,376° → 0,192°**, déplacement relatif **3,56e-2 → 2,20e-3**, rapport
d'altitude **1,0003 → 1,0000**. Son `dImg` de 28,8, lui, ne bouge pas : **c'est
un changement de SCÈNE, pas de caméra**, et il reste entier.

## Ce que ça coûte, et je le publie du côté défavorable

⚠️ **Ce n'est pas neutre au bit près, et ça ne peut pas l'être.** La similitude
est exacte au point d'ancrage et approchée ailleurs (plan tangent). Ancrer sur la
cible met l'exactitude **au centre de la vue** au lieu du centre du bloc ; l'écart
entre les deux est du second ordre (`d²/2R`, soit 17 km pour un bloc de
14 005 km à z3 — 0,12 % de sa largeur).
Mesuré : la médiane de `dImg` passe de **0,3563 à 0,3521** et le p95 de **0,9833
à 0,9854** — l'image de régime courant est indiscernable. La naissance du crop
rend `dImg` **15,72** contre 13,32 chez moi et 11,24 / 13,49 / 17,2 dans les trois
sessions de l'inventaire : **c'est dans la dispersion de session, je ne
revendique donc aucune amélioration ni aucune dégradation là-dessus.**

## Fichiers touchés

- `src/monde/frontiere-rendu.js` — `poseFond` gagne `origineBloc`
- `src/main.js` — `latLonOrigineBloc()` généralisée en `latLonDuBloc(x, z)` ;
  `majCameraFond` ancre sur `controls.target`
- `test/frontiere-rendu.test.js` — **+3 tests**, dont celui qui compte : un
  franchissement de niveau simulé (bloc rebâti deux fois plus fin ET recalé
  ailleurs, même géographie visée) rend une pose de fond **identique à 1e-9**
  avec l'ancre-cible, et **plusieurs degrés** avec l'ancre-centre (contre-essai
  obligatoire, sans lui le premier ne prouve rien).
- `scripts/sonde-d16.mjs` — relevé des trois ancres candidates + `dA0/dAC/dAT`

**Tests : 4 296 / 0 échec · audit 221 = 221.** (Base annoncée : 4 293 ; +3 neufs.)

## Réserves de l'étape 2

1. ⚠️ **Un seul poste, un seul lieu.** L'inventaire notait que 11,863° est *une
   valeur, pas un maximum* (borne théorique à z3 ≈ 21°). Je n'ai pas mesuré
   ailleurs : ce que je peux affirmer, c'est que **la cause disparaît**, pas que
   **11,863 était le pire**.
2. ⚠️ **`assietteCrop()` garde le centre du bloc comme ancre du crop**, à dessein :
   c'est une empreinte GÉOGRAPHIQUE, pas une pose de caméra. Le désaccord entre
   les deux est du second ordre. **Vérifié À L'IMAGE, pas seulement au calcul** :
   la sonde a rejoué la descente en capturant l'écran tous les six crans
   (`.banc/D16/img-apres-img/`), comparée image par image à la même descente sur
   le dépôt non modifié (`.banc/D16/img-desc60000/`, captures de l'inventaire).
   À 4 171 km d'altitude, les étiquettes de villes du globe sont **au même
   pixel**, le limbe de la planète et le tracé des côtes sont au même endroit à
   quelques pixels près. **Aucun décalage constant** — la signature qu'une
   mauvaise ancre laisse, et que la sonde à pixels avait déjà attrapée une fois
   (28 px sur 562, cités dans `majCameraFond`).
3. ✅ **La remontée EST mesurée** — voir la section suivante.
4. ⚠️ **Le balayage de pose (+32,6 %) n'est PAS traité par cette étape** et ne
   pouvait pas l'être : il vient de `poseFonduArrivee`, pas de l'ancre.

## LE SENS INVERSE — vérifié aussi, et les cinq franchissements y tombent pareil

L'inventaire dit les cinq franchissements **symétriques**. Vérifié sur SA propre
trace (`remontee1`, volet `remontee`) : 11,863 / 6,117 / 2,935 / 1,435 / 0,710°,
aux mêmes millièmes qu'à l'aller. Puis remesuré avec la correction
(`.banc/D16/ancre-fix-remontee.json`, 1 195 images, 0 erreur de page) :

| volet `remontee` | **avant** | **après** |
|---|---|---|
| franchissements (5 valeurs) | 11,863 / 6,117 / 2,935 / 1,435 / 0,710° | ⚡ **aucun — tous sous 0,5°** |
| p99 rotation de visée du fond | 0,000° | 0,01025° |
| MAX rotation de visée du fond | **47,668°** (sortie d'orbite) | **45,132°** (sortie d'orbite) |
| MAX déplacement relatif du fond | 0,84669 | 0,81375 |
| MAX `dImg` | 57,600 (mort du crop) | 57,075 (mort du crop) |

➡️ **La correction d'ancre est symétrique**, comme la rupture qu'elle ferme.
➡️ **Ce qui reste au sommet des deux sens n'est plus la même chose** : ce n'est
plus un franchissement de niveau, c'est **la sortie d'orbite** (`enterOrbit`,
`src/modes.js:704-727`), qui téléporte la caméra sur
`latLonToSphere(lat, lon, R + orbAlt)` puis `lookAt(0,0,0)` **dans la même
image**. Elle n'a jamais été traitée : R4 n'a lissé QUE la plongée.

---

# ⚡ CE QUE L'ÉTAPE 2 CHANGE POUR LA SUITE — à arbitrer par Adrien

**La commande « une seule caméra » n'est pas remise en cause : c'est un ordre.**
Mais l'argument de MESURE qui la soutenait le plus fort vient de tomber, et je le
dis parce que la consigne l'exige.

**Ce que la réécriture n'a plus à aller chercher** — la pire rupture de la
descente (11,863° + 13 % de déplacement en une image) et sa jumelle de remontée
sont **déjà fermées, par 6 lignes et un paramètre par défaut**, tests à l'appui.

**Ce qui reste, et que l'ancre ne touche pas** — classé par ce que j'ai mesuré,
du plus gros au plus petit, dans les DEUX sens :

| # | rupture | ma mesure après l'ancre | ce qu'il faut pour la fermer |
|---|---|---|---|
| ⑤ | mort du crop (remontée) | `dImg` **57,08** en une image | le crop, pas la caméra |
| ① | traversée orbite → surface | `dImg` **28,80** (axe 0,192°, échelle 1,0000) | **un changement de SCÈNE**, pas de caméra |
| ⑥ | sortie d'orbite | **45,132°** en une image | `enterOrbit` — cher mais LOCAL |
| ④ | naissance du crop | `dImg` **15,72**, dt **438,8 ms** | le crop |
| ② | balayage de pose | non isolé chez moi (voir réserve) | D16 ter, étape 5 |
| ⑦ | clic sur le globe | non remesuré | `plongeDepuisGlobe` |
| ⑨ | rotation de veille orbitale | non remesurée | **une décision d'Adrien** |

⚠️ **Trois des quatre plus grosses ruptures restantes ne sont PAS des ruptures de
caméra** : ce sont des changements de contenu (le crop qui s'allume, le crop qui
s'éteint, la scène qui bascule). **Une caméra unique ne les ferme pas toute
seule** — c'est le §4.2 de l'inventaire, qui l'avait déjà dit pour ①.

**Ce que la réécriture apporte toujours, et je ne le retire pas** :
la classe de défaut `1/k` (six occurrences, autofocus à ×130,4), la passe
`ClearPass` et le flou d'arrière-plan inerte, et **l'ordre d'Adrien lui-même**.

**Coût recompté chez moi, sur l'arbre d'aujourd'hui** (l'inventaire donnait
52 / 55 / 191 / 78) : **49** branchements `mode === 'orbital'|'surface'` ·
**57** sites `camGlobe`/`poseFond`/`sceneGlobe`/`plansFond` dans **9 fichiers** ·
**191** `TERRAIN_SIZE` · **79** `R_GLOBE`/`ORBITAL_M_PER_UNIT`.

⛔ **Je m'arrête ici et je rapporte, comme le brief l'ordonne** : le résultat de
l'étape 2 change l'ampleur du reste, et l'arbitrage revient à Adrien.

---

# ÉTAPE ① — LA SORTIE D'ORBITE : DEUX DÉFAUTS, PAS UN

**Statut : ✅ la moitié ALTITUDE est close. La moitié AXE est identifiée et laissée à D16 ter, délibérément.**

## La décomposition, avant de toucher quoi que ce soit

Image `n1030 → n1031` de `.banc/D16/ancre-fix-remontee.json` :

| grandeur | avant → après, en UNE image |
|---|---|
| altitude de fond | **33 105 716 → 23 879 470 m** (×1,3864) |
| inclinaison de `camGlobe` au nadir **local** | **6,570° → 0,000°** |
| inclinaison de la caméra du **BLOC** | **46,548°** — la bascule de trois quarts, entière |
| rotation de visée du fond | **45,132°** |
| déplacement relatif du fond | **0,8138** |

⚡ **C'est la réponse à la question posée : ni l'un ni l'autre, LES DEUX — et ils n'ont pas la même cause.**

- La caméra de fond n'était déjà qu'à **6,570°** de son propre nadir : elle ne « bascule » quasiment pas. Les 45,132° de rotation de visée viennent de ce qu'elle **se téléporte à travers la sphère**, depuis là où le déport oblique la posait vers l'aplomb du lieu.
- Et elle **tombe de 9 226 246 m** au passage.

## (a) L'altitude — corrigée, et c'est une conversion de la classe `1/k`

`_altitudeFondM()` rend `camY × emprise / span` : **le côté vertical du triangle**. La caméra de fond, elle, est à `√((R + k·camY)² + k²·r²)` du centre — le déport horizontal de la vue de trois quarts la pousse vers le haut. `enterOrbit` reposait la caméra à la jambe verticale **en croyant sortir « à l'altitude EXACTE »** : son propre commentaire dit avoir supprimé un recul de 15 % parce qu'« un 15 % de recul serait un saut, et c'est exactement ce qu'Adrien refuse ». **L'erreur valait +38,6 % — deux fois et demie le recul qu'il avait supprimé.**

⚠️ **Le commentaire de `_altitudeFondM` dit « C'EST LA SEULE GRANDEUR DONT UN SAUT SE VOIT À L'ÉCRAN ». Ma mesure le contredit** : ce n'est pas l'altitude de la caméra qui rend, c'est sa projection verticale. Je n'ai PAS renommé la fonction — `zoom-continu.js` bâtit son invariant dessus — mais le nom ment, et c'est à dire.

**Mesuré après** (`.banc/D16/sortie-fix1.json`, même geste, même instrument) :

| | avant ancre | ancre seule | **+ altitude de sortie** |
|---|---|---|---|
| rapport d'altitude à l'image de sortie | 1,3783 | 1,3864 | **1,0063** ⚡ |
| MAX rapport d'altitude du volet | 1,3783 | 1,3864 | **1,0196** |
| déplacement relatif à la sortie | 0,8467 | 0,8138 | **0,6627** |
| `dImg` à l'image de sortie | 8,76 | 8,31 | **6,36** |
| rotation de visée | 47,668° | 45,132° | 45,186° |

**1,0063 est le pas de zoom ORDINAIRE de ses voisines** (n1028–n1030 rendent 1,0064 / 1,0062 / 1,0062) : l'altitude ne saute plus du tout.

⚠️ **La rotation de visée ne bouge pas — 45,132 → 45,186° — et c'était prévu.** Je publie la valeur la moins favorable : elle a légèrement AUGMENTÉ.

## (b) L'axe — pas touché, et c'est une décision

Les 45° restants **sont** la bascule de 46,548° vue par l'autre bout : sur cette image, `dIncl` de la caméra du bloc vaut **exactement 46,548°**. D16 ter dit de la **déplacer**, pas de l'étaler. ⛔ **La lisser ici serait exactement le réflexe que le brief interdit.** Elle tombe à l'étape 5.

## ⚡ UNE VALIDATION CROISÉE QUE JE N'AI PAS CHERCHÉE

Le test que j'ai écrit calcule le rapport en **arithmétique pure** : `(√((R+a)² + (a/pente)²) − R) / a`. À **30 km d'altitude** il rend **×1,0026** — exactement le chiffre que l'inventaire avait relevé **AU NAVIGATEUR** pour le balayage de pose près du sol (« l'effet s'éteint près du sol : à 30 km le même balayage rend ×1,0026 »).

➡️ **La rupture ② (+32,6 % du balayage) et la moitié altitude de la rupture ⑥ sont LA MÊME FORMULE** : Pythagore sur le déport oblique. Deux mesures indépendantes, à quatre décimales. **Et elles ont la même cure : le nadir.**

## Fichiers touchés

- `src/main.js` — crochet `altitudeFondRenduM` (lit `camGlobe.position.length()`, **pas une septième formule** à tenir d'accord avec `poseFond`) ; import d'`ORBITAL_M_PER_UNIT`
- `src/modes.js` — `enterOrbit` demande l'altitude rendue, **avec repli** sur l'ancien chemin hors frontière : drapeau baissé, rien ne change
- `test/frontiere-rendu.test.js` — ⑨ la jambe verticale n'est pas l'altitude
- `test/camera-continue.test.js` — le branchement, y compris **le repli**

**Tests : 4 298 / 0 échec · audit 221 = 221.**

## Réserves de l'étape ①

1. ⚠️ **La rotation de visée a AUGMENTÉ de 0,054°** (45,132 → 45,186°). C'est sous la dispersion de session, mais je publie la valeur défavorable.
2. ⚠️ **Le déplacement relatif reste à 0,6627.** Il ne descendra pas sans le nadir : à 45°, deux points séparés de 37° d'arc sur la sphère sont à `2·sin(18,5°)` l'un de l'autre, quoi qu'on fasse de l'altitude.
3. ⚠️ **Sortir plus haut de 38,6 % rapproche la porte de replongée.** `_diveArmed` l'interdit, et `entryAltM` reste borné par `MAX_ALT_M`. **Non mesuré sur un aller-retour rapide.**

---

# MES TROIS NON-REPRODUITS — ce que j'ai essayé, pour que le suivant ne reparte pas de zéro

1. **Le balayage à +32,6 %.** ⚠️ **Non isolé chez moi.** Sur mes descentes à la molette, le balayage et la descente courent ensemble : j'ai relevé **×1,0619 avant / ×1,0599 après** sur la fenêtre où la caméra du bloc tourne au plafond, **et cette fenêtre est contaminée** — mon filtre `dVisee > 1,4°` attrape aussi l'image de traversée à 111°. **L'inventaire l'a isolé avec le scénario `clic` (aucune molette pendant la séquence) : c'est par là qu'il faut passer.** ⚡ **Mais je n'ai plus besoin de la mesure pour en connaître la cause** : l'arithmétique du test ⑨ la reproduit à quatre décimales (×1,0026 à 30 km).
2. **Le gel de 1 849,7 ms à la naissance du crop.** ⚠️ **Non reproduit.** Mon MAX `dt` vaut **438,8 ms** (descente avec ancre) et **392,3 ms** (ligne de base), sur cinq sessions complètes. L'inventaire lui-même donne **1 849,7 ms** dans une session et **429,3 ms** dans une autre, au même endroit : **c'est intermittent**, pas absent. ⛔ **Un phénomène intermittent non reproduit n'est pas un phénomène absent.** Ce que je n'ai PAS essayé et qu'il faudrait : répéter la naissance du crop seule, une vingtaine de fois, cache HTTP froid.
3. **La borne théorique ≈ 21° de la rupture ③.** ⚠️ **Pas encore cherchée.** Ma correction supprime la CAUSE (l'ancre calée sur la grille) et non une valeur ; mais tant que je n'ai pas exhibé un lieu qui approche 21° avant, je ne peux pas transformer le résultat en garantie.

---

# ÉTAPE 3 — MESURE PRÉALABLE : LA SECONDE CAMÉRA DESSINE UN SOLEIL, ET RIEN D'AUTRE

**Statut : ⛔ je m'arrête et je rapporte, comme le contrat l'exige.** Deux mesures changent la forme de la réécriture, et l'une d'elles change son AMPLEUR — dans les deux sens à la fois. ⛔ **Aucune ligne de rendu n'a été touchée** : la sonde compte, elle ne modifie pas.

## ① CE QUE LA PASSE DU BLOC DESSINE VRAIMENT

Comptage de `renderer.info.render` **autour de chaque passe** (three remet le compteur à zéro au début de chaque `render`, donc l'état d'après est exactement ce que cette passe a dessiné). Trace `.banc/D16/passes1.json`, 969 images de surface :

| | appels de dessin | triangles |
|---|---|---|
| passe de **FOND** (`sceneGlobe`, `camGlobe`) | 32 à 124 | **129 122 en médiane, 286 246 au MAX** |
| passe de **SURFACE** (`scene`, `camera`) — 60,4 % des images | **0** | **0** |
| passe de **SURFACE** — les 39,6 % restantes | 3 à 36 | **168 au pire** |

➡️ **0,059 % des triangles, au pire.**

## ⚡ ET L'INVENTAIRE DE LA SCÈNE LE NOMME

Parcours de `scene` en mode surface, drapeau levé (`.banc/D16/scene2.json`) — **objets visibles porteurs de géométrie : UN.**

```
Sprite · SpriteMaterial · CanvasTexture · échelle 13 · depthWrite false
renderOrder posé · enfant direct de Scene · position (59,65 · 86,61 · −106,96)
```

C'est **`SunDisc`** (`src/sun-disc.js` : `scale.setScalar(13 + 9·(1 − opacity))`, texture de canevas, `renderOrder = 5`, `depthWrite: false`, ajouté directement à `scene`).

Les racines de la scène, avec leur visibilité :

```
V  DirectionalLight   V  HemisphereLight   V  DirectionalLight   V  Sprite   V  boats(0)
.  Mesh (le bloc)  .  plinth  .  ground-info  .  clouds2  .  traffic
.  real-water  .  water  .  places  .  Group(14)  .  Group(3)
```

⚡ **TOUT est éteint sauf trois lumières, un groupe vide, et le soleil.**

➡️ **La seconde caméra, le second espace, la similitude `poseFond`, la seconde passe et le `ClearPass` qui efface la profondeur existent pour dessiner UN SPRITE DE SOLEIL — deux triangles.**

⚠️ **Ce n'est pas une découverte de bogue** : `src/monde/visibilite-surface.js` l'écrit déjà — *« sous le drapeau, la réponse est NON, à toutes les altitudes »*. **Ce qui est neuf, c'est le chiffre, et ce que le chiffre implique.**

## ② LE FLOU INERTE — la démonstration, à partir de deux faits mesurés

⚠️ **`scripts/sonde-flou-focus.mjs` N'EXISTE PAS dans cet arbre** (`ls scripts/` : aucun script de flou). Je ne peux donc pas le rejouer, et je ne reprends pas son chiffre à mon compte. **Mais les deux faits que je viens de mesurer le démontrent :**

1. `ClearPass(false, true, false)` remet la profondeur à **1,0 partout** ;
2. la seule géométrie dessinée après lui est **un sprite en `depthWrite: false`**, qui n'écrit donc aucune profondeur.

➡️ **Le tampon de profondeur vaut donc 1,0 sur toute l'image, par construction.** ⛔ **Aucun effet d'écran qui lit la profondeur ne peut fonctionner** — ni le flou, ni l'occlusion ambiante, ni la brume de profondeur. **C'est une déduction à partir de deux mesures, pas un comptage de pixels : je le dis comme tel.**

## ③ LE PLAN LOINTAIN UNIQUE NE COÛTE PAS LE TAMPON DE PROFONDEUR

⛔ **L'en-tête de `frontiere-rendu.js` justifie les deux passes ainsi** : « aucun `far` unique ne satisfait les deux mondes sans desserrer le plan lointain du bloc de 290 à ≈500, **c'est-à-dire dégrader son tampon de profondeur pour rien** ». **C'est la justification écrite du `ClearPass`, donc du flou inerte.**

Pour une projection perspective sur `b` bits, la résolution de profondeur à la distance `z` vaut `z²·(f − n) / (n·f·(2^b − 1))`. Dès que `f ≫ n`, le facteur tend vers `1/n` : **il ne dépend plus de `f`.**

| geste | perte de résolution sur le bloc |
|---|---|
| `far` 290 → 4,2 · 10⁵ (**×1 448**, ce qu'un espace unique demande à z16) | **+0,173 %** |
| `near` 0,5 → 0,25 (÷2) | **+99,7 %** |

Et le rapport `far/near` d'un espace unique est **relevé image par image**, pas supposé (`.banc/D16/desc-sol.json`, 1 555 images jusqu'à 397 m) : **2,098 · 10² à z3**, il **double à chaque niveau**, **8,405 · 10⁵ à z16**.

➡️ **L'argument écrit vaut 0,17 %.** ⚠️ **Ce que ça ne dit pas** : rien sur le z-fighting entre le bloc et le globe, ni sur le format réel du tampon de la chaîne de post-traitement. Ça dit seulement que « dégrader » était le mauvais mot.

---

# ⛔ CE QUE JE DOIS REMONTER AVANT D'ALLER PLUS LOIN

**Adrien a décidé sur 49 branchements / 57 sites / 9 fichiers / 26 fichiers de test. Ces chiffres viennent de bouger dans les DEUX SENS, et l'écart est d'un ordre de grandeur.**

### ⚡ MOINS CHER QUE PRÉVU : la partie RENDU

Il n'y a **pas deux mondes à fusionner géométriquement**. La fusion des passes, telle que la décrit l'étape 4 du découpage, se réduit à :

1. reloger **un sprite de soleil** dans la scène du globe ;
2. supprimer la passe de surface et le `ClearPass` ;
3. pointer les effets qui lisent la profondeur sur la caméra qui rend.

**Le tampon de profondeur redevient vrai, et le flou avec lui.**

### ⛔ BEAUCOUP PLUS CHER QUE PRÉVU : la partie MONDE

⚠️ **La raison pour laquelle la partie rendu est si petite est aussi ce qui rend l'autre énorme : le monde du drapeau est INCOMPLET.** Sont éteints, à toutes les altitudes :

> le maillage du bloc · le socle (`plinth`) · les toponymes · les infos-sol · les nuages · le trafic · la mer réelle · l'eau · les lieux · le ruban GPX · deux groupes de 14 et 3 objets

**Une caméra unique en PRODUCTION veut dire reloger tout cela dans l'espace du globe.** Ce n'est pas dans D16, ce n'est chiffré nulle part, et c'est plusieurs fois le coût annoncé.

⚠️ **Le dépôt le sait déjà pour un cas, et il a écrit la méthode** : `visibilite-surface.js` documente que les plans de cinéma sont éteints sous le drapeau parce que `shots` reçoit `sampleGround: (x, z) => terrain.sample(x, z)` — *« le champ de hauteurs du bloc plat, celui qui n'est plus dessiné »* — et conclut : *« Donner aux plans un `sampleGround` de GLOBE, puis retirer cette exception — et pas l'inverse. »* **Il y a une douzaine de cas comme celui-là.**

### ➡️ CE QUE JE PROPOSE, ET QUI DOIT ÊTRE ARBITRÉ

**Séparer les deux, et ne pas les vendre comme une seule tâche :**

- **D16-a — LA CAMÉRA ET LES PASSES.** Faisable, borné, mesurable : un sprite déplacé, deux passes en une, les effets sur la bonne caméra, `poseFond` retiré du chemin de la caméra. **Ça rend le flou, ça supprime le `ClearPass`, ça supprime la seconde caméra.** ⚡ **C'est ce qu'Adrien a acheté.**
- **D16-b — LE MONDE.** Reloger les douze couches de surface dans l'espace du globe. **C'est le vrai chantier « une seule Terre », et il n'a jamais été chiffré.** `frontiere-rendu.js` ne peut pas disparaître avant lui : tant que le bloc existe comme espace d'interaction, quelque chose doit convertir.

⛔ **Je n'ai PAS commencé D16-a**, parce que la première chose qu'elle demande — déplacer le sprite du soleil dans la scène du globe — a un risque d'artefact visible que je ne peux pas lever sans le montrer, et parce que le contrat dit de remonter dès que le chiffre bouge d'un ordre de grandeur. **Il vient de bouger.**

## Fichiers touchés à cette étape

- `scripts/sonde-d16.mjs` — compte des appels de dessin et triangles **par passe** ; inventaire de la scène du bloc (objets visibles, matériaux, racines et leur visibilité)
- `test/frontiere-rendu.test.js` — **+2 tests** : ce que coûte un `far` unique, et le relevé du rapport `far/near` niveau par niveau

**Tests : 4 300 / 0 échec · audit 221 = 221.**

## Réserves de cette étape

1. ⚠️ **Le comptage par passe suppose que `renderer.info.autoReset` est vrai.** Vérifié indirectement : la passe du bloc rend `0/0` **immédiatement après** une passe de fond à 33 appels — impossible si le compteur était cumulatif. **Je n'ai pas lu le drapeau directement.**
2. ⚠️ **L'inventaire de scène est pris à UN instant**, à la fin de la descente (crop posé, ~20 km). Les cas non nuls à 168 triangles tombent ailleurs — **je ne les ai pas datés**.
3. ⛔ **Le flou n'est pas mesuré en pixels par moi** : `scripts/sonde-flou-focus.mjs` n'existe pas dans cet arbre. Ma conclusion est **déduite** de deux mesures.
4. ⚠️ **Le test du plan lointain est de l'arithmétique**, pas une image. Il réfute un argument écrit ; il ne prouve pas qu'une passe unique sera propre.

---

# D16-a — UNE SEULE PASSE, UNE SEULE CAMÉRA. LE FLOU RÉPOND.

**Statut : ✅ livré, mesuré, testé.**

## ① L'artefact : montré, et il y en avait un — mais pas là où je le craignais

J'avais écrit que déplacer le sprite du soleil « portait un risque d'artefact que
je ne pouvais pas lever sans le montrer ». **Je l'ai montré. Le risque que je
redoutais n'existe pas ; un autre, que je n'avais pas vu, existait.**

**Le déplacement du sprite est neutre PAR CONSTRUCTION** : il traverse par la
**même similitude** que la caméra, et une similitude conserve les angles — la
direction et la taille apparentes sont inchangées, ce n'est pas un réglage à
trouver. Vérifié au PSNR, sur la même vue, bokeh éteint, avec **le plancher de
bruit de chaque configuration mesuré sur deux sessions du MÊME code** :

| configuration | plancher (2 sessions, même code) | avant vs après |
|---|---|---|
| `production` (intouchée) | 45,65 dB | 38,44 dB |
| **`?terre=unique`** | 35,93 dB | **41,98 dB — MIEUX que son plancher** |

⚠️ **Le meilleur témoin de `production` n'est pas le PSNR mais le flou lui-même** :
175 098 / 248 229 / 91 308 / 9 964 avant, **175 052 / 248 087 / 91 196 / 9 904**
après — **à 0,1 % près.** Le chemin sans drapeau ne bouge pas.

### ⛔ L'artefact réel, qu'aucune relecture n'aurait vu

Sous **`?frontiere=1&terre=deux`**, le maillage du bloc **est encore dessiné**.
Ma première version fusionnait dès que `frontiereActive` — **et le bloc
disparaissait** :

| | PSNR avant/après, bokeh éteint |
|---|---|
| plancher de bruit de `production` | 44,88 dB |
| `?terre=deux`, fusion appliquée à tort | **17,80 dB** |

➡️ **Le critère n'est pas « y a-t-il deux passes » mais « la seconde
dessine-t-elle quelque chose ».** La fusion suit désormais `terre=unique`, jamais
la seule frontière. Un test le verrouille dans les deux sens.
⚠️ **Trouvé en mesurant, pas en relisant.** C'est exactement la consigne : ne pas
renoncer devant un risque non observé — et regarder ce qu'on trouve, pas ce qu'on
cherchait.

## ②③ Le geste

- le sprite de `SunDisc` part dans la scène du globe, transporté par la
  similitude (position **et** échelle, `× k`) ;
- `ClearPass` et la passe de surface disparaissent sous `terre=unique` ;
- `composer.setMainCamera(camGlobe)` : **les effets d'écran lisent enfin la caméra
  qui écrit la profondeur.**

⚠️ `passeSurface.enabled = false` plutôt que `removePass` : la chaîne est indexée
à la main ailleurs (`addPass(p, 1)` pour l'occlusion ambiante,
`composer.passes.length - 1` pour la profondeur de champ). La retirer décalerait
ces index en silence.

## ④ LE FLOU — la mesure

`scripts/sonde-flou-focus.mjs`, copié de `wt-merge` et **rendu portable**
(`puppeteer-core` n'est pas une dépendance produit et n'existe pas dans cet
arbre : sans repli la sonde ne démarrait pas là où le code change).

**Ma mesure de référence, avant de toucher à quoi que ce soit**
(`.banc/D16/flou-avant.json`) — elle reproduit celle du brief :

| configuration | pixels changés sur 1 024 000 | témoin |
|---|---|---|
| `production` | jusqu'à **248 229** (24,24 %) | 0 |
| `?frontiere=1&terre=deux` | jusqu'à **220 422** (21,53 %) | 0 |
| **`?terre=unique`** | **0**, aux sept réglages | 0 |

**Après la fusion** — et il a fallu deux corrections pour que le chiffre veuille
dire quelque chose :

| réglage (bloc) | `production` | réglage (globe, `× k`) | **`terre-unique` APRÈS** |
|---|---|---|---|
| témoin | 0 | témoin | **0** |
| 100 | 0 | 0,767 | 956 |
| 130 | 175 098 | 0,997 | **138 768** |
| **142,26** | **248 229** | **1,0908** | **151 243** ⚡ |
| 160 | 91 308 | 1,2267 | 63 598 |
| 200 | 9 964 | 1,5334 | 9 078 |

⚡ **Même forme, même pic, même décroissance.** Le flou ne répond pas seulement :
**il fait le point sur le sujet.**

## ⑤ La conversion `1/k` — mesurée, et elle vaut 130,4

**Relevé au lieu de démarrage** (`.banc/D16/flou-apres2.json`) : emprise
27 354 m, **`k = 0,007 667`**, donc **`1/k` = 130,4** — **exactement le facteur
que la tâche du flou avait relevé sur l'autofocus.** Distance caméra→cible :
**145,5 unités de bloc = 1,1156 unité de globe.**

⚡ **LA FUSION L'A RENDUE VISIBLE AU LIEU DE MUETTE.** Tant que la profondeur
était effacée, la mise au point pouvait valoir n'importe quoi — 0 pixel changeait.
Maintenant qu'elle est vraie, une longueur de bloc lue en unités de globe met le
point **130 fois trop loin**.

**Sept sites écrivaient la mise au point.** Ils passent tous par
`poserMiseAuPoint`, **seul endroit du fichier où le facteur s'applique** — un test
compte les écritures directes et rougit à la huitième.

⚠️ **ET LA PORTÉE AUSSI EST UNE LONGUEUR, ce que personne n'avait dit.** Épinglée
à 23 unités de bloc, elle vaut **1 465 km** en unités de globe — **vingt fois la
profondeur de toute la scène** : tout est net, quelle que soit la mise au point.
**Mesuré : le balayage ne rendait plus que 2 000 pixels au lieu de 151 243.**
⛔ **Corriger la distance sans corriger la portée aurait donné un flou qui
« répond » à 1,3 % de sa vraie amplitude — et le rapport aurait dit « ça marche ».**

## La descente complète, après

`.banc/D16/fusion1.json`, 1 076 images, **0 erreur de page** :

| | avant fusion (`ancre-fix1`) | après (`fusion1`) |
|---|---|---|
| **jeux de passes** | `fond+bloc+autre+autre+autre` | ⚡ **`fond+autre+autre+autre`** |
| **objets visibles dans la scène du bloc** | 1 (le soleil) | **0** |
| `dt` p99 | 239,5 ms | **191,6 ms** |
| `dt` MAX | 438,8 ms | **378,2 ms** |
| `dViseeG` MAX | 1,5000° | 1,5000° |
| `deplGRel` MAX | 0,022875 | 0,021987 |
| `rAltFond` MAX | 1,0286 | **1,0322** |
| `dImg` MAX | 28,796 | **28,900** |

⚠️ **Les deux dernières lignes sont défavorables et je les publie telles quelles.**
Elles sont dans la dispersion de session ; je ne revendique aucune amélioration là.

## Fichiers touchés

- `src/main.js` — fusion sous `terre=unique`, sprite relogé et transporté,
  `setMainCamera`, `cameraDeRendu`/`sceneDeRendu`/`facteurFond`,
  `poserMiseAuPoint` (site unique de la conversion)
- `src/sun-disc.js` — la pose en unités de bloc gardée à part
- `src/export-effets.js` — `ClearPass` reclassée : elle ne survit que sous `terre=deux`
- `scripts/sonde-flou-focus.mjs` — copiée, rendue portable, `--portee` ajouté
- `scripts/sonde-d16.mjs` — comptage par passe, inventaire de scène nommé
- `test/camera-continue.test.js` — **+2 tests** : la porte de la fusion, et le
  site unique de la conversion (écritures directes comptées)

**Tests : 4 302 / 0 échec · audit 221 = 221.**

## Réserves de D16-a

1. ⚠️ **Un seul poste, un seul lieu, un seul cadrage.** La mesure du flou est
   prise **à la vue de démarrage**, pas au fond d'une descente. `k` y vaut
   0,007 667 ; il varie de ≈ 0,22 à z3 à ≈ 2,7 · 10⁻⁴ à z16. **Je n'ai pas
   remesuré le flou aux deux bouts.**
2. ⚠️ **`aoRadius` de l'occlusion ambiante est une LONGUEUR de scène** (« the
   block is 56 across ») et la passe est maintenant construite sur la scène du
   globe. **Elle est éteinte dans les quatre paliers**, donc je n'ai pas pu la
   mesurer — mais **c'est la même classe de défaut, et elle n'est pas corrigée.**
3. ⚠️ **`erreurs GL : [1282]` (INVALID_OPERATION) par image composée, dans les
   TROIS configurations, `production` comprise.** Antérieur à ma tâche, non
   diagnostiqué. Signalé pour qu'il ne me soit pas attribué — ni oublié.
4. ⚠️ **`skipShadowMapUpdate` reste posé sur la passe de fond**, qui est
   maintenant la seule. Sous le drapeau le bloc n'est pas dessiné, donc aucune
   ombre n'est attendue — **mais le drapeau `needsUpdate` n'a plus de
   consommateur, et je ne l'ai pas vérifié à l'écran.**
5. ⚠️ **La conversion `1/k` SURVIT** — elle est devenue explicite et unique, pas
   supprimée. **Elle ne disparaîtra qu'avec la similitude, c'est-à-dire avec
   D16-b.** Par la règle « une conversion qui survit est un échec », D16-a est
   **incomplète, et c'est structurel, pas un oubli.**

---

# 🗺️ LA CARTE DE D16-b — ce qu'il faudra reloger, et ce que ça demande

⛔ **Je n'ai rien touché de ceci.** Voici l'inventaire mesuré (`.banc/D16/fusion1.json`,
racines de la scène du bloc, mode surface, drapeau levé) — **toutes éteintes, à
toutes les altitudes** — et pour chacune ce que son relogement demande.

| couche (nom dans la scène) | enfants | ce que le relogement demande |
|---|---|---|
| `Mesh` (le maillage du bloc plat) | — | **le cœur du problème** : c'est lui que le crop du globe remplace. Le reloger, c'est décider si le bloc existe encore comme géométrie ou seulement comme espace d'interaction. |
| `plinth` (le socle) | 5 Mesh | parois et silhouette du bloc : dépend entièrement de la décision ci-dessus. Le globe a déjà des parois de crop (`parois-crop.js`). |
| `ground-info` | 6 Mesh | posé en unités de bloc à la surface : demande un **échantillonneur de sol de GLOBE**. |
| `clouds2` | 1 Mesh | volume au-dessus du bloc ; hauteur et étendue en unités de bloc. |
| `traffic` | 0 | vide au repos ; posé sur le champ de hauteurs du bloc. |
| `real-water` | 1 (`real-water-lacs`) | lacs, en géométrie de bloc ; le globe a déjà sa mer (`mer-sphere`). |
| `water` | 0 | idem. |
| `places` | 0 | toponymes de surface ; le globe a déjà les siens (`peak-labels`, villes). |
| `boats` (visible, vide) | 0 | la flotte suit la houle du bloc — voir la compétence `shibumap-flotte`. |
| `Group` (14 Mesh) | 14 | **non identifié par mon relevé** — à nommer avant de chiffrer. |
| `Group` (3 : `Group`, `hud3-pois`, `Group`) | 3 | l'ATH 3D et ses points d'intérêt. |
| le ruban GPX (`gpxLayer`) | — | `setVisible(false)` sous le drapeau ; sprites en `depthTest: false`. |

⚠️ **UN CAS EST DÉJÀ DOCUMENTÉ AVEC SA MÉTHODE**, et il vaut modèle pour les
autres : `src/monde/visibilite-surface.js` explique que les plans de cinéma sont
éteints parce que `shots` reçoit `sampleGround: (x, z) => terrain.sample(x, z)` —
*« le champ de hauteurs du bloc plat, celui qui n'est plus dessiné »* — et
conclut : *« Donner aux plans un `sampleGround` de GLOBE, puis retirer cette
exception — et pas l'inverse. »*

➡️ **La brique commune est là : un échantillonneur de sol en espace GLOBE.**
Cinq des douze lignes ci-dessus en dépendent directement (`ground-info`,
`traffic`, `boats`, les plans de cinéma, l'autofocus). **C'est par là qu'il faut
chiffrer D16-b, pas couche par couche.**
