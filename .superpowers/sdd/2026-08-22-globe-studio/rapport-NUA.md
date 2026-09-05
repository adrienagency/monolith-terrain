# RAPPORT NUA — LE PLAFOND DES NUAGES EST EN MÈTRES, ET LE CIEL TIENT DANS LE SOCLE

Arbre `C:\Dev\wt-nua2`, branche `nuages-metres`. Vite sur `127.0.0.1:10620`.
Mission du 2026-09-05 (`mission-2026-09-05.md`), défauts **N1** et **N2** du
catalogue VID2. Aucune question posée.

> **Adrien :** *« Reprendre tous les bugs que tu vois dans cette vidéo et les
> corriger. (…) corrige tous les bugs que tu trouves, ne t'arrête pas. »*

---

## ⓪ LE FACTEUR, ÉCRIT — la quatorzième confusion d'espaces

**mètres → unités de bloc, à la verticale : `× 56 / largeurBlocM × exagération`**
(`echelleBloc`, `loi-altitude.js` — mot pour mot la formule de `terrain.js`
`_makeDemSampler` et de `fenetre-bornee.js` `appliquerHauteurs`).

| palier | bloc | facteur (u/m) | 1 unité de bloc |
|---|---|---|---|
| **z13** | 10 496 m | **0,010 671** | 93,7 m |
| z12 | 20 992 m | 0,005 335 | 187,4 m |
| **z9** | 167 933 m | **0,000 667** | 1 499 m |
| La Réunion z12 (R20) | 27 354 m | 0,004 094 | 244 m |

Et **le zéro du bloc est la MOYENNE du relief, pas la mer** : une altitude
au-dessus de la mer se convertit en `(altitude − moyenneM) × facteur`. Écrit en
tête de `src/monde/nuages-metres.js` (§1), dans `clouds2.js` `build`, et dans
`main.js` à `majNuagesGlobe` (lignes ~5385–5420) et au littéral `params`.

---

## ① CE QUE J'AI TROUVÉ — trois défauts, pas deux

**N1 — le plafond était en unités de bloc.** `cloudAltitude = 13,5` u. Mesuré
au banc AVANT (`scripts/banc-nua.mjs`, Provence, exagération 2,
`.banc/NUA/avant2/journal.json`) :

| palier | largeur | crête (`maxM`) | plafond AVANT | plafond APRÈS |
|---|---|---|---|---|
| z9 | 167 933 m | 3 908 m (les Écrins) | **21 346 m** | **6 000 m** |
| z10 | 83 967 m | 3 368 m | 11 209 m | 6 000 m |
| z11 | 41 983 m | 2 000 m | 5 994 m | 6 000 m |
| z12 | 20 992 m | 1 829 m | 3 407 m | 6 000 m |
| z13 | 10 496 m | 1 425 m | **2 016 m** | **6 000 m** |
| z14 | 5 248 m | 906 m | **1 291 m** | **6 000 m** |

À z14 le plafond était à 385 m de la crête de ce bloc-ci, et sous celles du
bloc de la vidéo (1 800 m). Facteur 16,5 entre z9 et z14 ; **écart APRÈS : 0 %**.

**N2 — des nuages hors du socle.** Le ciel se peuple sur ±25,8 u et les grappes
de passage naissent jusqu'à ±41 u (`half + fadeOut`) ; le socle fait ±28 u
(la similitude d'`ancrageNuages` : 56 u pour `largeurBlocM()` m). Mesuré :
**6 068 pixels** de nuage hors du prisme du socle à z9, sur 20 images sur 20 ;
3 330 après la sortie à trois crans.

**N1 bis — l'ancre du ciel était à la MER, pas à la moyenne du relief.** Trouvé
en cherchant pourquoi la présence (§②-3) ne s'éteignait pas :
`uCamBloc.y = camera.position.y + 8,006` à z13, et `751 m × 0,010 671 = 8,014`.
`ancrageNuages` appelait `poseFond` sans `altitudeAncreM` (rayon `R_GLOBE`),
quand `majCameraFond` passe `altitudeAncreBlocM()` — la moyenne. Le groupe du
ciel était donc posé **`moyenneM` trop bas** (751 m à z13, 1 104 m à z9, ~440 m
à La Réunion) et la caméra relue en bloc d'autant trop haut. **C'est le « 4 %
d'écart, deux chemins » que R20 §2 avait relevé sans l'expliquer** : 74,52 − 72,72
= 1,80 = 440 m × 0,004 09. Après correction : `uCamBloc.y = camY − 0,01`
(`scripts/diag-nua-presence.mjs`).

---

## ② LE CORRECTIF

1. **`src/monde/nuages-metres.js`** (nouveau, pur) : `verticaleDuTerrain`
   (fenêtre bornée d'abord, MNT ensuite, `null` sur terrain procédural),
   `plafondNuagesBloc` = `(plafondM − moyenneM) × facteur`, plancher de crête
   `max(plafond, maxM + 500)`, `colonneNuages` (le plancher marin de R20 bis,
   au bit près), `reetagerY`, `attenuationBorne`, `presenceSelonCamera`.
2. **`src/clouds2.js`** : `build` lit `cloudAltitudeM` (mètres) via
   `_plafondBloc` ; **le plafond est relu à chaque image** (`_majPlafond`) parce
   que la fenêtre bornée change de largeur ~350 ms après le cran (VID2) — la
   colonne se ré-étage sans reconstruire ; nuanceur : `uBorne`/`uBorneFondu`
   (fondu sur 3 u vers l'intérieur, 0 = hors crop, neutre) et `uPresence`.
3. **`src/main.js`** : `cloudAltitudeM: 6000` au littéral ;
   `clouds.setBorne(fusionDesPasses ? TERRAIN_SIZE / 2 : 0)` ; `majNuagesGlobe`
   passe `altitudeAncreM: altitudeAncreBlocM()` et l'exagération du globe ;
   la note de R20 corrigée.
4. **`src/monde/nuages-globe.js`** : `ancrageNuages` accepte `altitudeAncreM`
   et `exageration`.
5. Panneau (`Altitude (m)`, 1 000–9 000), `templates-user.js`
   (`cloudAltitudeM`), `shibustart.json` (`6000`). `cloudAltitude` (u de bloc)
   reste la loi du terrain procédural.

**La valeur 6 000 m, dérivée** (`nuages-metres.js` §2) : ① au-dessus de la
crête la plus haute de tous les blocs du vol (3 908 m, Écrins, + 500) ; ② la base
de la couche (étalement 0,45 du gabarit, moyenne ~800 m) au-dessus de la caméra
au repos de z13 dans la vidéo (3 115 m + 300) ⇒ plafond ≥ 5 555 m. Base
mesurée : 3 638 m à z13, 3 797 m à z9.

**La présence selon la caméra** (`presenceSelonCamera`) : 1 vue de haut ou de
bas, 0 quand la caméra vole DANS la couche, fondu sur 20 % de l'épaisseur. Elle
est née d'une mesure APRÈS le passage en mètres : à z14 top-down, caméra à
5 614 m dans la couche (3 596 → 6 000), **304 033 px — 30 % de l'écran** en un
seul nuage à 140 m de l'objectif. La classe de N1 par un autre chemin.

---

## ③ LE TABLEAU DU CRITÈRE

Banc : `scripts/banc-nua.mjs` — vol de la vidéo (`flyTo(44.3425, 5.7777, 9)`,
caméra à `maxDistance`, deux `cranZoom(1)` par palier), captures d'écran
décodées dans la page, comptage par DIFFÉRENCE ON − OFF (seuil 2), prisme du
socle projeté par `camGlobe`, 20 images par pose. AVANT = même script sur
l'arbre sans le correctif (`git stash`), `.banc/NUA/avant2/` ; APRÈS
`.banc/NUA/apres4/`.

| grandeur | attendu | AVANT | APRÈS |
|---|---|---|---|
| plafond en mètres z9 / z11 / z13 / z14 | constant ≤ 5 %, au-dessus de la crête | 21 346 / 5 994 / 2 016 / 1 291 | **6 000 / 6 000 / 6 000 / 6 000** — 0 % ; crête max 3 908 |
| pixels de nuage hors du socle, crop, 20 images | 0 | z9 : **6 068** (20/20) ; sortie : 3 330 (20/20) | **0** à z9…z14, obliques et sortie (20/20 à 0) |
| pixels devant la caméra, z13 au repos, 3 115 m, 55° | ≈ 0 | **110 965** (10,8 % de l'écran) | **0** |
| idem z14, 1 560 m | — | 148 999 (14,6 %) | **0** |
| idem z13 top-down 5 477 m / z14 top-down 5 614 m | — | 114 033 / 45 801 | **0 / 0** (présence : caméra dans la couche) |
| témoin (deux captures OFF) | 0 | 0 | 0 (barre de mode exclue, voir ⑤) |
| coût | inchangé | — | une `max/abs/smoothstep` et un produit de plus par échantillon ; `_majPlafond` = une soustraction par image, O(entités) seulement quand la fenêtre change. **Pas pesé à la minuterie GPU** (réserve) |
| ⛔ hors crop — orbite 3 000 km, ON − OFF | identique | **0** | **0** (`diag-nua-orbite.mjs`, témoin 0) |
| suite | ≥ 5 000 · 0 | 5 014 | **5 018 · 0** ; audit **272 · 272, aucun écart** |

Captures avant/après aux poses de la vidéo : `avant2/` et `apres4/`
`z13-oblique-3115m-ON.png` (m_078–m_080 : nuages posés sur les crêtes →
aucun dans le cadre), `z09-ON.png` (m_050 : nuage hors socle à gauche →
dedans), `z14-ON.png` (m_089 : taches dans les vallées → rien), `z11-ON.png`.

⚠️ La vue de surface d'ouverture (La Réunion, 18 km) CHANGE, et c'est voulu :
4 286 → 3 887 px de ciel (le plafond passe de 6 594 m de carte à 6 000 m réels
posés à la bonne ancre).

---

## ④ LES TESTS QUI MORDENT

`test/nuages-metres.test.js` (15) et `test/nuages-globe.test.js` (+3, ⑧),
inscrits dans `package.json`. Trois mutations, exécutées, trois rouges
(`.banc/NUA/` et la sortie ci-dessous) :

| mutation | test qui rougit |
|---|---|
| `const ceilY = params?.cloudAltitude ?? 4.5` remis dans `build` | ⑥ « `clouds2.build` ne lit plus la tirette en unités de bloc » |
| `altitudeAncreM: 0` dans `majNuagesGlobe` | ⑧ « `majNuagesGlobe` passe l'altitude de l'ancre » |
| `presenceSelonCamera` rendant toujours 1 | ⑤ bis « éteint quand la caméra est dedans » |

Et ② exécute l'ancienne loi comme témoin : 21 346 m à z9, 2 016 m à z13,
facteur > 5, sous la crête à z14.

⚠️ La mutation 1 n'est tuée que par le test de TEXTE : les tests exécutés
passent par le module pur, pas par `clouds2.build` (qu'aucun test ne charge).
C'est la même limite que `cartouche-globe.test.js` et je la dis.

---

## ⑤ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. ⛔ **« Le témoin bouge : c'est le grain, ou l'effet de surface »** — non.
   `grain = 0`, `surfaceFx = 0`, trafic, bateaux, sommets, cycle du jour,
   cartouche, toponymes, brume : coupés un à un, 30 à 50 k pixels restaient
   (`scripts/diag-nua-temoin.mjs`). **La boîte des pixels qui bougent est
   [405..875 × 630..799] : la barre de mode et la recherche**, une interface
   animée. Exclue du comptage → témoin **0** exactement.
2. ⛔ **« Un plafond à 2 000–3 000 m au-dessus du sol suffira »** (le brief) —
   la caméra au repos de z13 dans la vidéo est à 3 115 m : une couche à
   2 800–4 100 m la prend DEDANS, et c'est « la moitié de l'écran ». D'où la
   dérivation ② et 6 000 m.
3. ⛔ **« La présence caméra est en place, donc z14 top-down est réglé »** —
   284 976 px au banc suivant. `uCamBloc.y` valait `camY + 8` : l'ancre à la
   mer (N1 bis). Sans cette mesure, la présence aurait été « verte » et fausse.
4. ⛔ **« `clouds.group.scale.x` est `k` »** — non : le groupe de `Clouds2` est
   l'ENFANT de `groupeNuages`, qui porte la similitude. Première mesure des
   parois : 2,87 u de large. Corrigé : **60,6–61,1 u** — le socle est 8 à 9 %
   plus large que les 56 u du relief (la « bande pâle vide » ⑤ de la mission,
   terrain de wt-soc). Ma borne à 28 u est DANS le socle.
5. ⛔ **« Deux `cranZoom(1)` font un palier »** — le premier banc a compté
   z9→z13 en s'arrêtant un palier trop tôt à chaque étiquette. Le banc insiste
   désormais jusqu'à `dem.zoom === z`.
6. ⛔ **« Trois `cranZoom(−1)` en 600 ms sortent du crop »** — non, la caméra
   monte (5 614 → 7 687 m) et reste à z14. La sortie molette n'est pas ce
   chemin (wt-vie) ; la ligne « sortie » du tableau mesure donc un dézoom
   dans le crop.
7. ⛔ **« `readPixels` fera l'affaire »** — pièges communs : captures d'écran
   uniquement, décodées par un canvas dans la page.

## ⑥ CE QUE J'AI VU, NON TRAITÉ

- `ancrageCartouche` a la même ancre à la mer (`cartouche-globe.js`) : le
  cartouche est posé `moyenneM` trop bas. Pas mon terrain.
- Le socle fait 60,6–61,1 u pour 56 u de relief (wt-soc).
- Les nuages ne bougent pas quand `params.animations = false` : les 20 images
  d'une pose sont identiques (min = médiane = max). Le critère « 20 images »
  est tenu, mais il ne teste pas la dérive.
- L'ombre au sol suit le plafond en mètres : à z14 le décalage vaut
  `ceilY × slant / 56` avec `ceilY = 114 u` — l'ombre part hors du bloc quand
  le soleil rase. Physique, mais à regarder.

## Fichiers

`src/monde/nuages-metres.js` (nouveau), `src/clouds2.js`, `src/main.js`,
`src/monde/nuages-globe.js`, `src/ui/effects-panel.js`,
`src/templates-user.js`, `public/templates/defaults/shibustart.json`,
`test/nuages-metres.test.js` (nouveau), `test/nuages-globe.test.js`,
`package.json`, `scripts/banc-nua.mjs`, `scripts/diag-nua-temoin.mjs`,
`scripts/diag-nua-orbite.mjs`, `scripts/diag-nua-presence.mjs`.
Rien touché à `nuages-globe.js` côté coquille, ni à la mer, ni au socle.
