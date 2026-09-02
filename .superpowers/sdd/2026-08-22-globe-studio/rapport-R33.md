# R33 — ATTAQUANT : LE PIVOT EST À LA SURFACE, À 6 300 km DU CENTRE DE LA TERRE — ET LES QUATRE PASSES N'ONT MESURÉ QUE L'AZIMUT

Arbre `C:\Dev\wt-att2`, branche `attaque-pivot-globe`, base `34307e8`
(`regroupement`). Serveur `npm run dev --port 5951` (arrêté à la fin).
Instrument : `scripts/sonde-attaque-r33.mjs` (neuf) + `scripts/lit-sonde-r33.mjs`
(neuf), Chrome sans tête 1280 × 800, **sonde AU RENDU** (`composer.render`
enveloppé), **gestes réels** (`Input.dispatchMouseEvent`), voile fermé par Échap
et **vérifié** (`elementFromPoint(640,400) = CANVAS`, sans retrait du DOM).
Journaux : `.banc/R33/releve.json`, `altimetre.json`, `inclinaison.json`,
`capture.json`, et leurs `mesures-*.json`. **13 400 images relevées** (4 759 + 4 760 + 3 289 + 578).

⛔ **Aucune ligne de `src/` touchée.** `git diff -- src/` est vide.
`npm test` : **4 667 · 0 échec**. `npm run audit:tests` : **241 = 241**.

---

## ⓪ LE VERDICT SUR L'HYPOTHÈSE, EN PREMIER — ELLE EST JUSTE À MOITIÉ, ET C'EST LA MOITIÉ QUI N'EST PAS DANS LES CHIFFRES

> **L'hypothèse :** *« Ils ont tous mesuré `hypot(target.x, target.z)` dans
> l'espace du BLOC. […] `pivoterAutourDuBloc` tourne autour de l'axe du bloc —
> la verticale locale. Tourner autour de la verticale locale est un lacet sur
> place, pas une orbite. »*

**⚠️ La partie fausse, dite d'abord.** *« L'axe du bloc n'est pas l'axe de la
Terre »* — **si, hors du crop, c'est le même axe, et je l'ai mesuré**. La
similitude qui pose la caméra qui rend (`majCameraFond`, `main.js:5045`) prend
pour ancre **l'aplomb de la cible** (`origineBloc = [target.x, 0, target.z]`) :
la verticale du bloc passant par la cible est transportée sur le **rayon
terrestre** passant par cette ancre, donc par le centre de la Terre. Quand la
cible est sur l'axe du bloc (`hypot(target.x, target.z) = 0`, ce que R27 a
réparé et ce que je relève à **0,0000 u sur tous mes bancs hors crop**), l'axe
d'azimut passe **exactement** par le centre de la Terre : **distance mesurée de
l'axe de rotation au centre, en espace globe, pendant un glissé horizontal :
0 m aux cinq altitudes** (médiane 0, maximum 8 m). Le chiffre des quatre passes
est donc **juste, dans le bon espace, à un facteur d'échelle près** — mais il ne
mesure **que l'azimut**.

**⚡ La partie juste, et elle est entière.** *« C'est un lacet, pas une
orbite »* : **oui, mesuré.** Un glissé horizontal de 200 px déplace le point
sous la caméra de **47,97°** en orbite et de **0,0000°** en surface hors crop,
à toutes les altitudes. La caméra tourne autour de sa propre verticale.

**⛔ Et ce que personne n'a mesuré, qui est ce qu'Adrien filme : la moitié
POLAIRE.** L'angle polaire d'OrbitControls tourne autour de `controls.target`
— un point de la **surface**. Distance de l'axe de rotation au centre de la
Terre pendant un glissé **vertical** de 200 px : **6 263 km à 1 980 km
d'altimètre, 6 297 km à 133 km, 6 297 km à 53 km** — le rayon terrestre. Le
centre de la Terre projeté par la caméra qui rend part à **1 259 / 3 080 /
3 283 px** de sa position, la vue se couche à **43° / 66° / 68°** de la
verticale, et la caméra **descend** de 258 km à 20,9 km parce qu'elle tourne
autour d'un point posé au sol. **C'est l'image 10 de la vidéo**, reproduite
(`.banc/R33/capture-surface-260km-V.png` : horizon en haut du cadre, vue à
73,7° de la verticale, centre de la Terre à 4 608 px de sa position).

➡️ **Pourquoi les quatre passes n'ont rien vu : leur grandeur est nulle par
construction pour le geste vertical.** `hypot(target.x, target.z)` ne bouge pas
quand on incline la vue. R27 a mesuré D16 ter sur une **descente sans geste**
(5,7 × 10⁻⁵°), R29 bis et R30 ont mesuré la **molette**, R13 a mesuré le glissé
**horizontal** (0 px de dérive du centre — vrai, c'est le lacet). Le glissé
vertical hors crop n'a jamais été relevé.

---

## ① LE PIVOT, EN MÈTRES DU CENTRE DE LA TERRE — espace globe

**Banc :** `camGlobe` relevée au rendu, image par image ; entre deux images
consécutives on calcule le **déplacement rigide** `(p₀,q₀) → (p₁,q₁)`, son axe
hélicoïdal, et la **distance du centre de la Terre (l'origine) à cet axe**,
en mètres (× `ORBITAL_M_PER_UNIT` = 63 710). La formule est auto-testée sur un
cas synthétique au lancement du lecteur (exact à 10⁻⁹). La cible est
transportée par `camGlobe.position + avant × k·d`.

| banc (altimètre · caméra qui rend) | cible, m du centre | glissé **H** : axe ↔ centre (méd / max) | glissé **V** : axe ↔ centre (méd / max) |
|---|---|---|---|
| **orbite** 60 000 km | **0** | **0 / 0** | **0 / 0** |
| surface 5 952 km · 11 899 km (z3) | 6 285 171 | 0 / 0 | 6 221 660 / 6 278 080 |
| **surface 1 980 km · 3 954 km (z4)** | **6 326 493** | **0 / 8** | **6 262 565 / 6 319 355** |
| surface 990 km · 1 971 km (z5) | 6 345 421 | 0 / 4 | 6 281 301 / 6 338 261 |
| **surface 133 km · 258 km (z8)** | **6 361 057** | **0 / 0** | **6 296 779 / 6 353 880** |
| surface 69 km · 130 km (z9) | 6 362 418 | 0 / 0 | 6 298 127 / 6 355 239 |
| **surface 53 km · 98 km (z8)** | **6 360 836** | **0 / 0** | **6 296 560 / 6 353 659** |
| surface 25 km · 49 km (z11, **crop posé**) | 6 370 037 | 0 / 0 | 6 305 668 / 6 362 849 |

**Verdict « le pivot est le centre de la Terre hors crop » : ⛔ FAUX pour le
geste vertical** (6,3 × 10⁶ m — le pivot est `controls.target`, à la surface) ;
**✅ tient pour l'axe du geste horizontal** (0 m — mais voir ②, c'est un lacet).
La médiane du glissé V est ~1 % sous la cible : le pas de `redresserSurLeSol`
et le `Y_CIBLE = −0,3` (0,3 unité de bloc sous la surface) déplacent l'axe de
quelques dizaines de kilomètres ; ce n'est pas le sujet.

---

## ② LA SIGNATURE ORBITE / LACET — espace globe, lat/lon sous la caméra

**Banc :** `sphereToLatLon(camGlobe.position)` avant le glissé et à l'image qui
suit le relâchement ; écart en grand cercle. Étalon en orbite d'abord.

| banc | Δ point sous la caméra, glissé H 200 px | Δ point sous la cible | Δ azimut |
|---|---|---|---|
| **orbite 60 000 km** | **47,97°** (55° en comptant l'amorti) | — | −51,72° |
| surface 1 980 km | **0,0000°** | 0,0000° | −51,72° |
| surface 133 km | **0,0000°** | 0,0000° | −51,72° |
| surface 53 km | **0,0000°** | 0,0000° | −51,72° |

**Même azimut, même °/px, et la caméra n'est pas allée ailleurs.** Le glissé
horizontal hors crop est un **lacet autour de la verticale locale** : l'image
tourne autour du pixel central, la Terre reste plantée, **le lieu ne change
pas**. ⛔ pour la règle D19 (*« la Terre se déplace autour de son centre »*).

---

## ③ LE CENTRE DE LA TERRE À L'ÉCRAN — pixels

**Banc :** `(0,0,0)` projeté par `camGlobe` (matrices du rendu), sur
1280 × 800 ; déplacement maximal sur les 40 images du geste + 20 après.

| banc | glissé H : avant → après (dépl. max) | glissé V : avant → après (dépl. max) |
|---|---|---|
| **orbite 60 000 km** | (640,400) → (640,400) · **0 px** | (640,400) → (640,400) · **0 px** |
| surface 1 980 km | (640,400) → (640,400) · 0 px | (640,400) → (640,**1 247**) · **1 259 px** |
| surface 133 km | (640,400) → (640,400) · 0 px | (640,400) → (640,**2 002**) · **3 080 px** |
| surface 53 km | (640,400) → (640,400) · 0 px | (640,400) → (640,**2 065**) · **3 283 px** |

Sur un écran de 800 px de haut, le centre de la Terre sort du cadre par le bas
dès la moitié du glissé vertical. En orbite il ne bouge pas d'un pixel. **⛔.**

---

## ④ L'ANGLE ENTRE LA VERTICALE LOCALE ET L'AXE OPTIQUE — degrés

**Banc :** `acos(−avant · normalize(camGlobe.position))`, au rendu, pendant un
glissé vertical de 200 px vers le haut (le geste de la vidéo).

| banc | avant | **max pendant** | après relâchement | altitude caméra avant → min |
|---|---|---|---|---|
| orbite 60 000 km | 0° | **0°** | 0° | 60 000 km → 60 000 km |
| surface 1 980 km | 0° | **43,0°** | 32,1° | 3 954 km → 1 768 km |
| **surface 133 km** | 0° | **66,33°** | 49,87° | 258 km → **52,9 km** |
| **surface 53 km** | 0° | **67,64°** | 50,96° | 98 km → **12,5 km** |

**D16 ter (« la vue 3/4 arrive au bloc, pas avant ») est violé par un seul
glissé de 200 px hors crop : 66° à 133 km, 68° à 53 km.** Et parce que le pivot
est au sol, incliner **fait descendre** : la caméra passe de 98 km à 12,5 km
pendant le geste. C'est l'horizon en haut du cadre de l'image 10. **⛔.**

⚠️ R27 a mesuré D16 ter à 5,7 × 10⁻⁵° **sur une descente sans geste** : sa
grandeur était bonne, son banc ne contenait pas le glissé.

---

## ⑤ LES TESTS QUI GRAVENT LA CONFUSION — ligne par ligne

Aucun des trois fichiers ne lit une grandeur en espace globe. Tous lisent
`(target.x, target.z)` en unités de bloc, et trois d'entre eux nomment cette
lecture « le centre / l'axe de la Terre » :

| fichier · lignes | ce qu'il affirme | ce qu'il lit | ce que ça vaut |
|---|---|---|---|
| `test/pivot-molette.test.js:146-153` | *« un cran de molette laisse la cible SUR l'axe de la Terre »* | `Math.hypot(controls.target.x, controls.target.z) < 1e-9` | l'axe du **bloc**. Vrai pour l'azimut ; muet sur l'angle polaire |
| `test/pivot-terre.test.js:24-31` (① bis) | *« Le centre de la Terre est sur la VERTICALE du centre du bloc : tout point de `x = z = 0` le vise »* | `decalageRecentrage(...).y === 0` | **Faux tel quel** : viser le centre de la Terre n'est pas le regarder ; la caméra vise `target`, à 6 300 km du centre |
| `test/pivot-terre.test.js:224-228` (⑧) | *« HORS DU CROP, la visée d'arrivée est l'axe »* | `c.x === 0 && c.z === 0` | l'axe du bloc, en unités de bloc |
| `test/pivot-bloc.test.js:214-218` | *« l'axe du pivot est celui du bloc, et il est nommé »* | `PIVOT_BLOC_X === 0` | honnête : il dit « bloc » |
| `test/pivot-bloc.test.js:274-281` | *« un pivot enfoncé au centre de la Terre doit rendre le MÊME décalage »* — *« c'est ce qui identifie les deux règles »* | `decalagePivot({…, pivotY: −6 371 000})` deepEqual sans `pivotY` | **le test grave que le code est AVEUGLE au `y` du pivot et en fait une preuve d'identité.** Vrai pour l'azimut seulement ; c'est de là que vient « rien à excepter » |
| `test/pivot-bloc.test.js:262-271` | *« le pivot n'est PAS conditionné au crop »* | absence de `veilleCrop` dans `pivoterAutourDuBloc` | protège le lacet hors crop contre une exception ; ne dit rien du polaire |

⚠️ **`polaireMaxSol` / `redresserSurLeSol` / `maxPolarAngle = 0,49π`**
(`butee-sol.js:61`) sont le SEUL cadre de l'angle polaire hors crop, et ils
bornent la caméra contre le **sol**, pas contre D16 ter : 88,2° sont permis à
toute altitude.

---

## ⑥ D19 — LE GLISSÉ : le point saisi sous le curseur, la Terre plantée — pixels

**Banc :** au `mousedown`, rayon depuis `camGlobe` par le pixel (640,400) ∩
surface dessinée (sphère + relief `hauteurDessinee`, itéré) → point fixe en
espace globe, reprojeté à chaque image et comparé au curseur relevé par le DOM
(`pointermove`, capture).

| banc | H : écart saisi ↔ curseur, fin de glissé | V : écart | centre Terre, dépl. max H / V |
|---|---|---|---|
| **orbite 60 000 km** | **102 px** (amorti `dampingFactor = 0,03` : le point SUIT, en retard, et rattrape après relâchement — 641 → 745 px pour un curseur 650 → 840) | 98 px | **0 / 0 px** |
| surface 1 980 km | **200 px = le point n'a PAS bougé** (640 → 640) | 188 px | 0 / **1 259 px** |
| surface 133 km | **200 px** | 160 px | 0 / **3 080 px** |
| surface 53 km | **200 px** | 96 px | 0 / **3 283 px** |

Hors crop, on n'attrape pas la Terre : le pixel saisi au centre est sur l'axe du
lacet, il reste au centre pendant que le curseur s'en va. **⛔.**

---

## ⑦ D19 — LA MOLETTE : le point du centre de l'écran reste au centre — pixels

**Banc :** avant le premier cran, rayon par (640,400) ∩ surface dessinée →
point fixe ; écart au centre de l'écran à chaque image, par cran, jusqu'à
l'extinction du glissé.

### Vue d'aplomb (inclinaison résiduelle ≤ 8°), hors crop

| banc | 3 crans dedans : écart max par cran | max | 3 crans dehors |
|---|---|---|---|
| orbite 60 000 km (juste après un glissé V) | 0 · 0 · 0 | **0 px** | 0 px |
| surface 1 980 km (5,6° d'inclinaison) | 1,0 · 1,7 · 2,2 | 2,7 px | 0 px |
| surface 133 km (0,8°) | 1,8 · 2,0 · 2,0 | 2,2 px | 0 px |
| surface 53 km (7,9°) | 8,7 · 14,1 · 16,2 | **17,5 px** | 0 px |

### Vue couchée (après le glissé V de 200 px)

| banc | 3 crans dedans | max | crop né pendant | altitude caméra |
|---|---|---|---|---|
| orbite 60 000 km | 0 · 0 · 0 | 0 px | — | 60 000 → 43 239 km |
| surface 1 980 km (49,6°) | 4,6 · 8,2 · 10,6 | 12,7 px | non | 1 768 → 1 078 km |
| surface 133 km (46°→…) | 20 · 42,7 · 74,4 | **124,5 px** | **oui** | 52,9 → 46,4 km |
| surface 53 km (77°) | 71 · 127 · 130 | **142 px** | **oui** | 12,5 → −0,1 km |

### Vue inclinée modérément (glissé V de 60 px), hors crop — la mesure propre

| banc | inclinaison pendant la molette | 2 crans dedans : écart max par cran | max | 2 crans dehors | altitude caméra |
|---|---|---|---|---|---|
| orbite 60 000 km | 0° | 1,7 · 3,4 | 8,7 px (queue d'amorti du glissé précédent, comme ci-dessus) | 0,7 px | 60 000 → 48 248 km |
| surface 1 976 km | 14,4° → 16,9° | 0,3 · 0,6 | **1,1 px** | 0 px | 3 739 → 3 482 km |
| surface 133 km | 22,6° → 26,0° | 1,1 · 1,9 | **3,7 px** | 0 px | 236 → 217 km |
| surface 53 km | 23,1° → 26,6° | 2,4 · 4,4 | **8,4 px** | 0 px | 89,6 → 82,1 km |

Et le glissé de 60 px lui-même, aux trois altitudes : axe de rotation à
**5 709 / 5 740 / 5 741 km** du centre, centre de la Terre déplacé de
**303 / 485 / 498 px**, vue couchée à **12,6° / 19,8° / 20,2°**. Même à 60 px, le
pivot est au sol.

**Verdict ⑦ : ✅ tient sous 10 px hors du crop jusqu'à ~27° d'inclinaison
(1,1 / 3,7 / 8,4 px pour deux crans) ; ⛔ au-delà** — 12,7 px à 1 980 km pour
une vue couchée à 50°, hors crop, et des dizaines de pixels par cran à 133 /
53 km, où trois crans couchés **font naître le crop et posent la caméra sous la
sphère idéale (−0,1 km)**. D'aplomb, le zoom radial vers la cible et le zoom
vers le point du cadre coïncident (D19 le dit) : ≤ 2,7 px, sauf à 53 km où 7,9°
de résidu d'inclinaison font 17,5 px. Les 0 px « dehors » ne sont pas une
réussite : le dézoom radial recule le long du même rayon, le point est déjà
parti. **La molette est le geste le moins faux des trois** — c'est le glissé
qui porte le défaut filmé.

---

## ⑧ CE QUE MESURAIENT VRAIMENT R27 / R29 bis / R30, ET POURQUOI ADRIEN VOIT CE QU'IL VOIT

1. **R27 § ②** — `hypot(target.x, target.z)` sur une descente par `cranZoom`,
   sans geste : la cible reste sur l'axe du bloc. **Juste**, et c'est l'axe de
   la Terre pour l'azimut (mesuré ici : 0 m). **Rien sur le polaire, rien sur le
   lacet.** Son D16 ter à 5,7 × 10⁻⁵° est mesuré sans glissé.
2. **R29 bis § ①** — la même grandeur sous la molette, réparée (96 % → 14 %) ;
   puis *« l'algèbre qui tranche »* : viser le centre et zoomer vers le curseur
   sont la même quantité. **Juste dans son espace**, mais D19 vient de poser une
   troisième cible — *le point au centre de l'écran* — que ni l'un ni l'autre
   ne vise quand la vue est inclinée (⑦).
3. **R30 Q2** — l'attaquant a mesuré la même grandeur, en pixels (616 px de
   l'axe au centre de l'écran) : **c'est l'écart d'AZIMUT** ; il ne pouvait pas
   voir le polaire non plus.
4. **R13** — 68 px → 0 px de dérive du centre du bloc pour 100 px de glissé
   **horizontal**. Vrai : le lacet garde le centre. Sa conclusion *« les deux
   pivots n'en font qu'un »* est vraie pour l'axe d'azimut et fausse pour le
   geste entier ; le test `pivot-bloc.test.js:274-281` l'a gravée.

**Adrien voit** : un glissé quelconque a une composante verticale ; elle fait
tourner la caméra autour d'un point de la surface, la vue se couche à 66°, la
caméra tombe de 258 km à 21 km, l'horizon monte en haut du cadre, la Terre sort
par le bas (image 10). La composante horizontale, elle, fait pivoter l'image
sur elle-même sans changer de lieu. **Ni l'une ni l'autre n'est l'orbite.**

---

## ⑨ LES INSTRUMENTS — ce que j'ai vérifié, et ce qui a failli mentir

| piège du brief | relevé |
|---|---|
| voile `.ce-hubveil` | fermé par **Échap**, `elementFromPoint(640,400) = CANVAS` sur les quatre sessions, **sans retrait du DOM** |
| pose de démarrage | attendue ≥ 14 s après `#loading.hidden` **et** 120 images immobiles : `d = 26,44`, 4 405 m, crop posé. ⚠️ **Je n'ai PAS vu le vol de 8,3 s vers `d = 145,5`** de R29 bis (chrono dans le journal, 0,7 → 14 s, `d` constant) — en sans-tête avec Échap avant le vol, la pose de présentation n'est pas prise. Sans conséquence : chaque banc part de `enterOrbit(60 000 km)` |
| sonde dans `controls.update` | non : au rendu, après `majCameraFond` (l'ordre de `tick()` : `updateCameraMotion` → `modes.update` → `redresserSurLeSol` → `majCameraFond` → `composer.render`) |
| le globe tourne seul | `params.animations = false` (dtAmb = 0, `main.js:13398`) ; vérifié : `sousCam` immobile sur les 20 images « avant » de chaque geste |
| grandeur ≠ valeur (R23) | l'angle ④ est `acos(−avant·radial)` en espace globe, pas `getPolarAngle()` ; les deux sont relevés côte à côte et coïncident hors crop |
| 20 images consécutives | 40 images par glissé + 20 après, 5 à 8 bancs par relevé, 4 relevés |

**Trois choses que j'ai crues puis réfutées.**

1. ⛔ *« Le 102 px d'écart saisi ↔ curseur en orbite dit que l'orbite n'attrape
   pas non plus. »* Non : c'est l'**amorti** (`enableDamping`, facteur 0,03) —
   le point suit le curseur avec du retard (641 → 745 px pour 650 → 840) et
   continue après relâchement. Hors crop il reste à 640 : ce n'est pas du
   retard, c'est un lacet.
2. ⛔ *« Le point du centre dérive de 33 px en orbite sous la molette, donc
   l'étalon est sale. »* C'est la **queue d'amorti du glissé précédent** (φ
   passe de 111° à 92° sur les 20 images « avant », sans geste) ; la même
   molette juste après le glissé V rend 0 px. Retenu comme étalon : **0 px**.
3. ⛔ *« 50 km hors crop »* : à 49 km de caméra qui rend, l'altimètre lit
   24,6 km et le crop est posé (né sur `altitudeCadrageM`, l'altimètre). Les
   trois altitudes du brief sont donc lues **à l'altimètre** (2 000 / 130 /
   50 km = 4 000 / 260 / 100 km de caméra qui rend), et le relevé à 49 km est
   gardé comme témoin de l'exception du crop.

**Trouvé en passant, hors sujet, non traité.** Molette depuis l'orbite : la
porte de plongée tombe à **11 900 km** sur un bloc **z3** (`params.demZoom = 3`,
altimètre 5 952 km) alors que R27 a posé `ZOOM_PALIER_MIN = 4` (*« z3 n'en est
plus un »*). Et 3 crans de molette vue couchée à 53 km posent la caméra à
**−0,1 km** de la sphère idéale.

---

## ⑩ LES TESTS ROUGES — `test/attaque-r33-ROUGE.mjs`

Hors liste de `package.json` (cinq gardes de journal lisent `.banc/`). Commande
en tête du fichier :

```
npm run dev -- --port 5951
node scripts/sonde-attaque-r33.mjs --port 5951 --etiquette altimetre --altitudes 4000000,260000,100000
node scripts/sonde-attaque-r33.mjs --port 5951 --etiquette inclinaison --serie inclinaison --altitudes 4000000,260000,100000
node scripts/lit-sonde-r33.mjs .banc/R33/altimetre.json
node scripts/lit-sonde-r33.mjs .banc/R33/inclinaison.json
node --test test/attaque-r33-ROUGE.mjs
```

**10 tests · 9 rouges · 1 vert** (relevé du 2026-09-01, journaux `altimetre` et
`inclinaison`) :

| test | grandeur · espace | lu | attendu |
|---|---|---|---|
| ⛔ ① axe du glissé vertical ↔ centre de la Terre | mètres · globe | 6 263 km | < 200 km |
| ⛔ ② Δ point sous la caméra, glissé H | degrés · globe | 0,0000° | ≥ 24° (moitié de l'orbite) |
| ⛔ ③ centre de la Terre, glissé V | pixels | 1 259 px | < 20 px |
| ⛔ ④ angle verticale / axe optique, glissé V < 300 km | degrés · globe | 66,33° | < 60° (D16 ter) |
| ⛔ ⑤ mécanisme : polaire transporté par `poseFond` | mètres · globe, **pur** | 6 369 km | < 100 km |
| ⛔ ⑤ bis mécanisme : azimut transporté par `poseFond` | degrés · globe, **pur** | 0° | ≥ 5° |
| ⛔ ⑥ D19 glissé : saisi ↔ curseur | pixels | 200 px | ≤ 1,5 × orbite (153 px) |
| ⛔ ⑥ bis D19 glissé : Terre plantée | pixels | 1 259 px | < 20 px |
| ✅ ⑦ D19 molette, inclinaison modérée (≤ 27°) | pixels | 8,4 px | < 10 px |
| ⛔ ⑦ bis D19 molette, vue couchée (50°), hors crop | pixels | 12,7 px | < 10 px |

Tous exprimés en **mètres du centre de la Terre (espace globe)** ou en
**pixels** ; aucun ne lit `target.x/z`. ⑤ et ⑤ bis sont **purs** (la similitude
du dépôt, `poseFond`, sans navigateur) : ils décrivent le mécanisme actuel et
resteront rouges tant que la caméra qui rend tournera autour de la cible de
bloc — à réécrire contre le nouveau mécanisme, pas à supprimer.

---

## ⑪ CLÔTURE

| | valeur |
|---|---|
| `npm test` | **4 667 · 0 échec** (inchangé) |
| `npm run audit:tests` | **241 listés · 241 sur disque · aucun écart** |
| `git diff -- src/` | **vide** |
| fichiers neufs | `scripts/sonde-attaque-r33.mjs`, `scripts/lit-sonde-r33.mjs`, `test/attaque-r33-ROUGE.mjs`, ce rapport |
| octets | scripts écrits en binaire, `grep -c '\r'` = 0 sur les trois |
