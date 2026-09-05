# RAPPORT CAM — le bouton de caméra pose la vue, et la vue tient

**Branche** `camera-stable` (arbre `C:\Dev\wt-cam`). Un commit.

## ⚠️ POUR LA FUSION À LA MAIN — les lignes touchées

| fichier | lignes (après correctif) | quoi |
|---|---|---|
| `src/monde/pose-explicite.js` | **nouveau**, pur | le témoin de pose explicite et les deux décisions |
| `test/pose-explicite.test.js` | **nouveau** | 6 tests, morsure prouvée par 5 mutations |
| `src/main.js` | 171 | import du module |
| | 2199-2202 | `tween.explicite` |
| | 2271-2282 | `flyTo(pos, target, { explicite })` pose le témoin et rend un `_fonduPose` déjà armé ; `temoinPose`, `volExplicite()` |
| | 12721-12723 | `applyIsoView` → `flyTo(…, { orbit: true, explicite: true })` |
| | 13789 | `temoinPose`, `volExplicite` exposés dans `__exp` |
| | 14835-14854 | `redresserSiHerite` : la décision passe par `doitRedresserHerite` (pur) |
| | 14868 | `appliquerGestesTerre` : `reprisePoseParLaMachine` chaque image |
| | 15204-15209 | `tick`, juste après `modes.update(dt)` : le front descendant est rendu pendant un vol explicite |
| `package.json` | liste `test` | `test/pose-explicite.test.js` inscrit |

⛔ **`src/modes.js` n'est PAS touché** (wt-obl y travaille) : le front descendant
`_etaitSurLeBloc && !surLeBloc → _armerRetourNadir()` (modes.js:2171) reste tel
quel ; c'est `tick()` qui rend son balayage pendant un vol demandé. `_suivreEmprise`
(wt-fan) n'est pas touché non plus.

## LA DEMANDE — citation

> « J'ai un truc simple à régler : la caméra avec le toggle en bouton en bas à
> droite, quand je clique dessus, les positions 1, 2, 3, 4 se mettent au bon
> endroit, puis reviennent automatiquement en arrière. Tu peux gérer une
> stabilisation dans la bonne position, sans cet effet d'aller-retour. »

## 1. REPRODUIT AU CLIC RÉEL — chiffré

Chrome sans tête 1280 × 800, gestes CDP sur `.ce-isobtn:not(.ce-cinebtn)`, sonde
rAF de `camera.position` / `controls.target` posée AVANT le geste, 5 s par clic.
Chemin fixé : démarrage → Échap → `modes.flyTo(-21.115, 55.536, 10)` (La Réunion
entière, comme la vidéo) → repos → six clics (vues 2, 3, 4, 5, 6, 1).

**AVANT (`.banc/CAM/avant-3.json`, 3 chargements — identiques au bit) :**

| vue | pose atteinte | repart à | vers où | écart max | balayage |
|---|---|---|---|---|---|
| **3, 4** | image **108-109** (1,8 s) | image **110-111** — 2 images après | nadir : d 145,5 → **74,2**, angle polaire 59,3° → **0°** | **125 unités = 1 161 px** | 67 images (1,1 s) |
| **1, 2** (le vol PART du crop) | **jamais** | — | file droit au nadir, d **73** | — | armé PENDANT le vol |
| 5 (du dessus) | 108-109 | — | tient | 0 | 0 |
| 6 (raz du sol, crop) | 109 | — | tient | 0 | 0 |

C'est image pour image la vidéo d'Adrien (104 images à 4 i/s) : clic 4 à
l'image 3 → vol de 7 images (1,75 s) → pause d'une image → second mouvement
adouci de 5-7 images vers un gros plan du dessus ; clic 1 (image 43) → un seul
mouvement de 2 s droit au gros plan ; vues 5 et 6 stables.

**APRÈS (`.banc/CAM/apres-8.json`, 8 chargements) :**

| vue | n | écart max après arrivée | balayage | d / angle à la fin | glissé ensuite |
|---|---|---|---|---|---|
| 1, 2, 3, 4 | 8/8 chacune | **0 px** (0 unité) | 0 image | 145,5 / 59,3° | répond (3,74 unités sur 200 px), dérive 0,038 sur 3 s, aucun balayage |
| 5 | 8/8 | 0 px | 0 | 138 / 0,3° | |
| 6 | 8/8 | 0 px | 0 | 78 / 80,7° | |

Critère (≤ 1 px sur 5 s, 8/8) : **tenu à 0 px**. Conversion : 1 px au plan de la
cible = `2·d·tan(fov/2)/H` = 0,108 unité à d = 145,5.

## 2. QUI RAMENAIT LA CAMÉRA — deux écrivains, les deux moitiés de D16 ter

Pile capturée par un crochet sur `camera.position.set/copy` armé à la fin du
tween, puis relevé image par image de `regimeGeste()`, `veilleCrop.auBloc`,
`modes._fonduPose`, `gestesTerre.retoursNadir` :

1. **`redresserSiHerite` (main.js)** — « l'inclinaison HÉRITÉE hors du crop est
   redressée ». Après le vol, la caméra est hors du crop (70 km à z10 pour
   145 unités), inclinée à 59,3°, personne ne l'a inclinée à la main →
   `_armerRetourNadir()` → balayage vers le nadir, hauteur conservée
   (`poseFonduArrivee` garde `camY`, donc d passe de 145 à 74 : c'est le
   « gros plan » de la vidéo). `retoursNadir` monte de 1 à chaque clic. Cas des
   vues 2, 3, 4 de la vidéo.
2. **le front descendant `_etaitSurLeBloc && !surLeBloc` (modes.js:2171)** —
   « quitter le bloc rend la vue au nadir ». Le vol iso sort lui-même la caméra
   du bloc ; le balayage s'arme PENDANT le tween, et comme `modes.update` écrit
   après `updateCameraMotion` dans la même image, **il gagne** : la caméra ne
   passe jamais par la pose. Cas de la vue 1 de la vidéo (et de tout premier
   clic depuis le crop). `retoursNadir` ne bouge pas (ce chemin ne le compte
   pas), `_fonduPose` est vrai pendant le tween.

Les deux lisent la même chose de travers : une vue iso demandée au bouton
n'est pas une inclinaison héritée du vol de présentation, **c'est un choix**.

## 3. LE CORRECTIF

`src/monde/pose-explicite.js` (pur) :
- `temoinPoseExplicite()` / `armerPoseExplicite()` — le témoin `posee` se pose au
  départ d'un vol explicite ;
- `reprisePoseParLaMachine(temoin, { regime, volExplicite })` — il tombe quand la
  machine reprend la pose (régime crop ou orbite), **jamais pendant le vol** (un
  vol qui part du crop traverse le régime crop sur ses premières images) ;
- `doitRedresserHerite({...})` — la décision de `redresserSiHerite`, sortie de
  main.js, avec `poseExplicite` en garde supplémentaire ; toutes les gardes
  d'origine (régime, manuel, pilote, `auBloc`, seuil 1°) sont conservées et
  testées ;
- `retourNadirPermis({ volExplicite })` — faux pendant un vol demandé.

Plomberie main.js : `applyIsoView` déclare `{ explicite: true }` ; `flyTo`
explicite pose le témoin et rend un `_fonduPose` déjà armé ; `tick()` rend le
balayage que `modes.update` viendrait d'armer pendant le vol.

Vie du témoin = celle d'`inclinaisonManuelle` : la pose tient dans tout le
régime de la Terre, et tombe au crop (la bascule de trois quarts est à la
machine) ou en orbite (`enterOrbit` pose au nadir).

## 4. CE QUI N'EST PAS CASSÉ

- **D16 ter** : le cas HÉRITÉ de GE2 tour 2 redresse toujours (test CAM ②,
  `doitRedresserHerite(HERITE) === true`) ; la symétrie « quitter le bloc rend
  le nadir » reste entière hors d'un vol demandé (CAM ⑤). Sur le banc « après »,
  `retoursNadir` reste à 1 (le redressement de démarrage), aucun de plus.
- **D19** : aucun geste touché ; le glissé après pose répond et ne dérive pas
  (0,038 unité sur 3 s = amortissement d'OrbitControls).
- **D21 ①** : `veilleCrop.pose` reste `true` sur les huit chargements pendant les
  vues 1-5 (le crop vit) ; le témoin ne touche ni au crop ni au régime.
- **VIE** : rien n'est redessiné — aucun appel de dessin ajouté.
- `npm test` : **5 119 tests, 5 114 verts, 5 rouges** — les cinq sont
  `test/pdf-affiche.test.js`, `ERR_MODULE_NOT_FOUND '@cantoo/pdf-lib'` :
  la dépendance est dans `package.json` (ligne 35) mais absente de la jonction
  `node_modules` (`npm install` interdit). Antérieur et étranger à CAM.
  `npm run audit:tests` : 286 listés · 286 sur disque · aucun écart.

## 5. TESTS QUI MORDENT — mutations prouvées

`node --test test/pose-explicite.test.js` : 6/6. Chaque mutation ci-dessous
rend **5 verts · 1 rouge**, puis le fichier est restauré :

| mutation | test qui rougit |
|---|---|
| `doitRedresserHerite` ignore `poseExplicite` | CAM ① |
| `reprisePoseParLaMachine` reprend pendant le vol | CAM ④ |
| `retourNadirPermis` rend toujours vrai | CAM ⑤ |
| la reprise tombe aussi hors du crop (`regime === surface`) | CAM ③ |
| `applyIsoView` sans `explicite: true` (main.js) | CAM ⑥ (lit main.js) |

## 6. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« C'est l'élan de zoom `_zoomVel` qui continue après le tween. »** Réfuté :
   un zoom pivoté conserve la direction caméra→cible, or la vidéo change
   d'angle (59° → 0°). Et mesuré : molette puis clic → écart 2,4 unités max,
   pas 125.
2. **« C'est l'amortissement d'OrbitControls après un glissé. »** Mesuré : 3,26
   unités de rotation résiduelle (le `sphericalDelta` ne décroît pas pendant le
   tween, `controls.update()` n'y est pas appelé) — réel mais dix fois trop
   petit, et sans changement de distance.
3. **« C'est le lecteur de plans (`camera-shots.js`) qui pilote. »** Faux
   constat de sonde : `querySelector('.ce-isobtn')` rendait le bouton **cinéma**,
   qui porte aussi `.ce-isobtn`. Corrigé en `:not(.ce-cinebtn)`. ⚠️ À retenir
   pour toute sonde du coin bas-droit.
4. **« Ça ne se reproduit pas. »** Vrai sur l'arbre tel que gréé — qui était sur
   `cameras-cine` à `d2d6626` (29 juillet), sans D16 ter ni `veilleCrop`, et
   non sur `camera-stable`. Basculé sur `camera-stable` (`be69433`), où
   `_suivreEmprise`, `redresserSiHerite` et « Mes créations » de la vidéo
   existent. Puis vrai encore au lieu de démarrage (z12 : 145 unités = 18 km,
   sous `SEUIL_MORT_M`, on reste dans le crop, rien ne redresse). C'est
   l'échelle de la vidéo (La Réunion entière, z10 : 70 km) qui sort la caméra
   du crop et arme D16 ter. **Le chemin dit tout** (piège ⚡ de la liste).
5. **« La pose de démarrage est la vue iso 1. »** Non : `Échap` (la sortie du hub
   de la sonde) tombe sur le raccourci `play-stop` → `stopPlay()` →
   `tween.active = false` à t = 0,09 ; l'app démarre à d ≈ 29 avec le badge
   « 1 ». Hors sujet ici, mais c'est un piège de banc : ne pas sortir du hub par
   Échap si la pose d'ouverture compte.

## 7. RÉSERVES

- Le témoin tient tant qu'on reste hors du crop : après une vue iso, une
  molette qui ne franchit ni le crop ni l'orbite laisse la vue oblique. C'est
  le comportement demandé (« stabilisation dans la bonne position ») et celui
  de l'inclinaison manuelle ; si Adrien veut que la molette rende le nadir,
  c'est une ligne dans `reprisePoseParLaMachine`.
- `.banc/CAM/` est git-ignoré (avant-3.json, apres-8.json) ; les sondes vivent
  dans le scratchpad (`cam/sonde-banc.mjs`, `sonde-regime.mjs`, `sonde-tween.mjs`).
