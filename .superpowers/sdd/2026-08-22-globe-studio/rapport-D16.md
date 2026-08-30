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
