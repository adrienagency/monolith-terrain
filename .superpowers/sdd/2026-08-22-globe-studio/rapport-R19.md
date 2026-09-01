# RAPPORT R19 — LES COURBES DE NIVEAU SUR LES TERRES DU CROP

> **Arbre** `C:\Dev\wt-cbe`, branche `courbes-crop`.
> **Traces** : `.banc/R19/` — sonde de nuanceur, trois bancs, captures appariées.
> **Port** : 5563.

---

## 1. OÙ MEURT LA COURBE

⛔ **SUR `minFade`, LE FONDU DE MINIFICATION DU NUANCEUR DE TUILE — ET SUR RIEN
D'AUTRE.**

`src/globe.js`, bloc des courbes :

```glsl
float minFade = clamp(1.6 - texel * 0.55, 0.0, 1.0);
float contour = max(minor * minorK, major) * uContourOpacity * crowd * minFade;
```

⚡ **UNE VALEUR DE SORTIE FORCÉE À CHAQUE ÉTAGE** (`scripts/diag-r19-sonde.mjs` :
un `uDbgCourbes` temporaire remplace `gl_FragColor` par la grandeur demandée,
terre marquée en vert et mer en bleu ; relu par `readPixels` sur une **passe
brute de `sceneGlobe`**, hors composeur). Sur les TERRES du crop, cadrage
d'ouverture :

| étage sondé | moyenne / max (sur 255) | ce que ça dit |
|---|---|---|
| `dedansCrop` *(étalon 0/1)* | 253,78 / 255 | l'échelle est bonne, 1,0 → 255 |
| `minor` | **12,26 / 255** | ⚡ **les bandes de courbe EXISTENT** |
| `major` | 1,29 / 255 | idem |
| `crowd` | **250,21 / 255** | il ne coupe rien (0,98) |
| **`minFade`** | **3,57 / 43** | ⛔ **ZÉRO** |
| `contour` | **0,14 / 41** | ce qui reste : rien |
| `texel × 0,2` | 153,19 / 184 | donc **`texel` = 3,00** (min 1,78, max 3,61) |

`clamp(1,6 − 3,00 × 0,55)` vaut **zéro**. La cause est arithmétique : sous le
crop, la loi de monde rend `texel = mppEcran / uResRefM` avec `uResRefM` = la
résolution du **zoom 13** (17,81 m à La Réunion). Le crop meurt au-dessus de
40,3 km ; dès ~26 km la loi rend déjà `texel > 1,09`. **`minFade` est donc nul
sur presque toute la plage de vie du bloc — les courbes du crop étaient
impossibles par construction, pas par réglage.**

⛔ **ET R18 A CONCLU DE TRAVERS PARCE QU'IL N'A JAMAIS NEUTRALISÉ `minFade`.**
Son essai posait `uMppFacteur = 0`. Cette écriture ne neutralise rien : elle fait
**basculer de branche** — `texel = uMppFacteur > 0.0 ? texelMonde : texelTuile`.
Mesuré (banc de R18, condensé 256 × 160, mouvement ambiant coupé, plancher
**0,0000**) :

| état, opacité 0 → 1 | moy | grad |
|---|---|---|
| tel quel — **le 0,014 de R18, reproduit** | **0,0146** | **0,0278** |
| `uMppFacteur = 0` — **l'essai que R18 croyait décisif** | **0,1490** | **0,2468** |
| `minFade` VRAIMENT à 1 | **0,5113** | **0,7017** |
| … + intervalle forcé | **0,9599** | **0,9668** |

Même son essai ramenait les courbes **au-dessus du seuil de lisibilité**
(0,06 / 0,12). Il n'en avait pris qu'une capture, jamais une mesure. **Une mesure
contredit le brief, et elle gagne.**

⚡ **ET LE SOCLE EST LE MODÈLE, TERME À TERME** (`terrain.js`, bloc
« contour lines ») :

| terme | socle | globe |
|---|---|---|
| grandeur | `vWorldPos.y / uContourInterval` | `h / uContourInterval` |
| poids du trait | `dch × 1.4 × uContourWeight` | identique |
| mineur | `× 0.55` | identique |
| foule | `clamp(1 − dch × 0.22)` | identique |
| **fondu de minification** | ⛔ **aucun** | ⚠️ **`minFade`** |

**Le seul terme que le globe ajoutait est celui qui éteignait tout.**

## 2. LE CORRECTIF, EN UNE PHRASE

**`minFade` est fondu vers 1 dans le crop — `mix(clamp(1.6 − texel × 0.55, 0, 1),
1.0, dedansCrop)` — donc le bloc reprend la loi de trait du socle, qui n'a aucun
fondu de ce genre, pendant que la planète nue garde la sienne au bit près
(`dedansCrop` vaut 0 hors découpe et `mix(x, 1, 0) = x`).**

Et, la panne trouvée, **la tirette d'intervalle est branchée avec sa conversion
ÉCRITE** : `intervalleCourbesBloc` (`monde/habillage-crop.js`) rend
`valeurBloc / echelleBloc`, dérivé de `echelleBloc` de `loi-altitude.js` — la loi
de hauteur du socle, écrite avant cette tâche, qui sert d'**oracle indépendant**
au test. `poserHabillage` portait déjà la préférence
(`contourIntervalM > 0` d'abord, l'amplitude ensuite) : il ne lui manquait que la
valeur.

## 3. LES TROIS CURSEURS

Mesurés **par le chemin du panneau** (`ui/map-panel.js` écrit `params.X` puis
`terrain.mapUniforms.uX.value` ; la couleur passe par `applyGridContour` →
`globe.setInk`), même instrument, même plancher.

| curseur | avant R19 | après R19 | seuil |
|---|---|---|---|
| **Opacité des courbes** 0 → 1 | 0,0146 / 0,0278 | **1,2275 / 1,0021** | 0,06 / 0,12 |
| **Intervalle** 0,29 → 0,10 u | ⛔ n'arrivait pas | **1,3202 / 0,9526** | |
| **Intervalle** 0,29 → 0,55 u | ⛔ n'arrivait pas | **0,6360 / 0,8428** | |
| **Couleur** noir → rouge | *(rien à peindre)* | **0,6677 / 0,6128** | |
| *témoin (même état deux fois)* | | **0,0000 / 0,0000** | |

**×84 sur l'opacité.** Et l'intervalle traverse et se convertit : 0,29 unité de
bloc devient **70,83 m** à La Réunion et **52,95 m** au Mont-Blanc — deux
emprises différentes, la même tirette.

## 4. À L'ÉCRAN

`.banc/R19/` :

| capture | quoi |
|---|---|
| `e4-opacite-0.png` / `e4-opacite-1.png` | le vis-à-vis, même cadrage : le Piton passe de nu à gravé |
| `appaire-reunion-sphere.png` / `appaire-reunion-socle.png` | **cadrages appariés** — même `camera` (46, 40, 58), même cible (0, 2, 0), fov 33, même intervalle 0,29 |
| `appaire-montblanc-sphere.png` / `appaire-montblanc-socle.png` | **fort relief** — 3 800 m d'amplitude, courbes sur tout le massif |
| `sonde-01..12.png` | les douze étages du nuanceur, forcés en sortie |
| `etape1.json`, `etape2-sonde.json`, `etape2-minfade.json`, `etapes4-6.json`, `etape6-appaire.json` | les relevés |

⚡ **CE QUI REND L'APPARIEMENT EXACT** : les deux modes conduisent le bloc avec la
**même caméra de scène** (`camera` + `controls.target`) — sous la sphère,
`majCameraFond` DÉRIVE `camGlobe` d'elle par la similitude qui ancre le globe sur
le bloc. On pose donc la même position et la même cible des deux côtés.
⛔ **Le premier jet ne l'avait pas** : `modes.flyTo` atterrit à une distance qui
dépend du mode, et les deux captures de La Réunion ne montraient pas le même
morceau d'île — c'est le piège que le brief signale (« trois captures prises
au-dessus de l'Ukraine en croyant viser la Suisse »). Le lieu est relu à chaque
capture depuis `uCropCentre`, retraduit en lat/lon.

## 5. TESTS

**4 422 tests, 4 422 pass, 0 fail** — `npm test`.
**`npm run audit:tests` : 229 listés · 229 sur disque, aucun écart.**
Base annoncée par le brief : 4 412 / 228. Les dix tests neufs sont
`test/courbes-crop.test.js`.

⚠️ **DEUX TESTS EXISTANTS ONT CHANGÉ, ET CE SONT DEUX GARDES DE CLASSE QUI ONT
FAIT LEUR TRAVAIL.**

1. `test/fenetre-branchee.test.js` compte les lecteurs de `lireExageration` par
   fichier : la conversion d'intervalle en ajoute un dans `main.js` (7 → 8). ⚡ **Et
   c'est exactement la garde qu'il existe pour tenir** : une exagération FIGÉE
   dans cette conversion espacerait les courbes d'un autre pas que le relief
   qu'elles dessinent, au facteur `exagAvant / exagApres`.
2. `test/loi-texture-monde.test.js` ④d extrait `minFade` du GLSL et l'EXÉCUTE :
   il levait « mix is not defined ». Son traducteur connaît désormais `mix`, et le
   test exerce les deux côtés — `dedansCrop = 0` rend la courbe du dépôt au bit
   près, `dedansCrop = 1` rend 1. **Une mutation y fait tomber une valeur, pas une
   chaîne.**

`test/courbes-crop.test.js` était **ROUGE avant le correctif** (l'export
`intervalleCourbesBloc` n'existait pas, et `minFade` rendait 0 au texel mesuré).

## 6. FICHIERS TOUCHÉS

⚠️ **`main.js` EST PARTAGÉ AVEC LE CHANTIER DES NUAGES — VOICI EXACTEMENT CE QUE
J'Y AI FAIT, ET RIEN D'AUTRE.**

**`src/`**
- `src/globe.js` : **une ligne de nuanceur changée**, `float minFade = …` devient
  `mix(…, 1.0, dedansCrop)`, plus son commentaire. ⛔ Rien d'autre — ni uniforme
  neuf (le compte d'unités de texture est **inchangé**), ni signature, ni
  `poserHabillage`.
- `src/monde/habillage-crop.js` : **un export neuf**, `intervalleCourbesBloc`.
  Aucune ligne existante modifiée.
- `src/main.js` : **deux ajouts, aucune suppression.** ① l'import
  `intervalleCourbesBloc` depuis `monde/habillage-crop.js` ; ② le champ
  `contourIntervalM:` dans l'objet rendu par `contexteCrop`.
  ⛔ **Je n'ai touché ni `clouds2`, ni `cloud-shell`, ni aucune ligne de nuages,
  ni `refreshAerial` / `aerial-layer`.**
- `src/ui/map-panel.js` : la note posée par R18 disait « les courbes ne se gravent
  pas encore ». Elle est désormais fausse : la note et son bloc de commentaire
  sont réécrits avec les mesures.

**tests** : `test/courbes-crop.test.js` (neuf, 10 tests),
`test/loi-texture-monde.test.js`, `test/fenetre-branchee.test.js`,
`package.json` (la ligne `test`).

**outils** (aucun effet sur l'application) : `scripts/instrument-r19.mjs`
(l'instrument de R18, extrait pour être partagé — une seule écriture),
`scripts/diag-r19-courbes.mjs`, `scripts/diag-r19-sonde.mjs`,
`scripts/diag-r19-minfade.mjs`, `scripts/diag-r19-ecran.mjs`,
`scripts/diag-r19-appaire.mjs`.

⚠️ **LA SONDE DE NUANCEUR A ÉTÉ RETIRÉE.** `uDbgCourbes` et son bloc de sortie
forcée ont vécu le temps de l'étape 2 ; `src/globe.js` n'en porte plus une ligne.
Le script qui la pilotait est conservé, avec la recette pour la reposer.

## 7. RÉSERVES

1. ⚠️ **LA TIRETTE PREND LE PAS SUR LA CALIBRATION AUTOMATIQUE, ET C'EST UN
   ARBITRAGE.** `poserHabillage` préférait déjà `contourIntervalM` ; maintenant
   qu'il est nourri, `intervalleCourbes(amplitudeM)` — la calibration de la
   Tâche C, qui rendait 250 m à La Réunion — ne sert plus que de **repli sans
   MNT**. Conséquence chiffrée : au défaut du produit (`contourInterval = 0,11`)
   l'intervalle tombe à **~27 m** sur un bloc de 27 km, soit une centaine de
   courbes sur un relief alpin. C'est ce que le socle trace au même réglage —
   « une seule Terre » — mais si Adrien préfère l'automatique, c'est une ligne :
   ne passer `contourIntervalM` que lorsque la tirette a été touchée.
2. ⚠️ **`uResRefM` COMPARE L'ÉCRAN À UNE DONNÉE QUE LE CROP N'A PAS, ET JE NE L'AI
   PAS TOUCHÉ.** La loi de monde cale sa résolution de référence sur
   `ZOOM_SOCLE = 13` (17,81 m à La Réunion) alors que le MNT vivant du crop était
   à `demZoom = 12` (~35,6 m) : `texel` est mécaniquement **deux fois trop grand**.
   Hors du crop cela reste le comportement de la Tâche K, mesuré et assumé par
   elle ; **dans** le crop, la question ne se pose plus puisque le fondu y est
   neutralisé. À regarder si `minFade` devait un jour revenir dans le bloc.
3. ⚠️ **LE SCINTILLEMENT QUE `minFade` RÉPARE N'EST PAS RE-MESURÉ DANS LE CROP.**
   L'argument est que le crop ne vit que sous 40,3 km, où le fondu devrait déjà
   valoir 1, et que le socle — même cadrage, mêmes données — n'en a jamais eu
   besoin. Mais je n'ai pas filmé une descente complète pour le prouver.
   `decodeMetersAA`, lui, reste en place des deux côtés.
4. ⚠️ **UN SEUL PROTOCOLE, DEUX LIEUX.** La Réunion (le cadrage de R18) et le
   Mont-Blanc, tous deux à `zoom 12`, mouvement ambiant coupé, 1280 × 800,
   SwiftShader désactivé (RTX 3080 / ANGLE D3D11). Un crop continental très large
   ou une très haute latitude n'ont pas été essayés.
5. ⚠️ **LA COMPARAISON AU SOCLE EST VISUELLE, PAS CHIFFRÉE.** Les deux images
   appariées portent des courbes de même pas et de même trait, mais je n'ai pas
   mesuré une distance socle ↔ sphère : les deux modes diffèrent par ailleurs
   (maillage à 5 625 sommets contre 594 434, grille de relevé présente d'un seul
   côté), et une distance globale aurait mélangé ces écarts-là avec celui des
   courbes.
6. ⛔ **JE N'AI RIEN VÉRIFIÉ SUR LA VUE ORBITALE À L'ÉCRAN.** L'invariance y est
   prouvée par l'arithmétique et par un test bit à bit (`Object.is` sur huit
   valeurs de `texel`), pas par une capture : `dedansCrop` vaut 0 par déclaration
   dès que `uCropOn` est éteint, et `mix(x, 1, 0)` rend `x`.
