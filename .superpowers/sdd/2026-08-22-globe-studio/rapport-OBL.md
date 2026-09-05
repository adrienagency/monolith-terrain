# RAPPORT OBL — EN OBLIQUE, LA TERRE SE DÉCALAIT AU FRANCHISSEMENT : LA POSE PHYSIQUE EST DÉSORMAIS TRANSPORTÉE

**Arbre** `C:\Dev\wt-obl` · branche `oblique-pivot` · base `99b037b` (Fusion BIS) ·
serveur `127.0.0.1:11237`. Rapport commencé par OBL, terminé par **OBL-2** (reprise après limite d'usage : rejeu Réunion code figé, non-régression D19, mutations md5, tables). Second arbre **détaché** `C:\Dev\wt-obl-avant` sur
`99b037b` (jonctions `node_modules` + `public/data/*` posées à la main, rien
d'installé), servi sur `127.0.0.1:11238` : c'est l'AVANT de toutes les tables.
`npm test` **5 121 · 0 échec** (base 5 104) · `npm run audit:tests` **284 = 284, aucun
écart**. Commits : `b4fc062` (le correctif) et le commit de clôture d’OBL-2 (garde ⑤ bis durcie, rapport).

Instrument : **`scripts/sonde-obl.mjs`** (neuf) — Chrome sans tête d3d11, 1280 × 800,
**molette envoyée par CDP au centre de l'écran** (`Input.dispatchMouseEvent`
`mouseWheel`, vingt crans en rafale à 40 ms = un tour de molette, « vingt crans par
niveau »), relevé sur la **surface RENDUE** (lancer de rayon sur les maillages de
tuiles du globe — la méthode de GX3) à travers **la caméra qui dessine (`camGlobe`)**.
Un chargement de page par ligne, inclinaison posée EXACTEMENT (45° ou 0°) avant
le geste, trois lieux, `--cran` pour rejouer le bouton (`cranZoom`, le chemin de
VID3), `--images` / `--espion` pour l'image par image et les écrivains de la caméra.
Relevés : `.banc/OBL/<lieu>-t<tilt>-<avant|apres>.json`.

---

## ⓪ LES TROIS RÉPONSES, EN TÊTE

1. **(2) « le relief est ré-échelonné par niveau » — RÉFUTÉ, avec la hauteur rendue.**
   Le Piton de la Fournaise est **dessiné à 2 239 m à z11 et z12, 2 237 m à z13 et
   z14** (rayon du maillage, sans exagération ; réel 2 632 m — c'est la finesse des
   tuiles), **sur les 8 chargements, avant comme après**. Ce que `terrain.sample`
   rendait de différent à VID3 (3 303 / 2 144 / 2 039 / 1 010 m) est le **BLOC** :
   son plan `y = 0` est la **MOYENNE** du bloc (`appliquerHauteurs`,
   `fenetre-bornee.js`), qui change à chaque emprise (−727 → +426 → +351 → +630 m
   à La Réunion, z11 → z14) — et ses sommets gardent l'ancien niveau ~700 ms après
   chaque cran. Le bloc est invisible sous « terre unique » ; **le relief dessiné est
   le globe, et il ne bouge pas.** `loi-altitude.js`, `exageration-continue.js`,
   `_rescale` : rien à corriger de ce côté.
2. **Le pivot — c'est lui, mais pas comme VID3 le disait.** À la molette, **DANS un
   niveau, le point rendu sous le centre ne bougeait déjà pas (0,2 px)** : `_applyZoom`
   vise le point du cadre (D19). Ce qui sautait, c'est le **FRANCHISSEMENT** :
   **324 / 199 / 180 px** à 45° (z11 → z14, La Réunion), excursion 491–753 px pendant
   le glissé qui suit. Quatre causes, toutes du même défaut — *le bloc change de
   repère, la caméra ne suivait qu'en `y`* — corrigées ensemble : **0,3 à 1,1 px (médianes 0,7 / 0,4 / 0,8 par franchissement, série rejouée code figé) px**
   sur 8 chargements. Au nadir : **0,0 px × 8 × 3 franchissements** (AVANT : 0–22 px au repos, excursion 509–1 462 px).
3. **Les 16–18 px de la vidéo au nadir-presque** : le même franchissement, vu sous
   une petite inclinaison. Mesuré AVANT à **10°** d’inclinaison (3 chargements, La Réunion) : **47 à 72 px** de dérive au franchissement (z11→z12 53–64, z12→z13 47–72, z13→z14 48–57), excursion 250–1 210 px ; à 45° : 194–378 px ; au nadir : 0–22 px. Au nadir strict, le déplacement de la caméra
   physique est vertical (invisible) ; dès que la vue s'incline, sa projection
   apparaît, proportionnelle à l'inclinaison. Le fantôme G1 de `wt-fan` n'y est
   pour rien (une image, pas un point fixe), l'arrondi de tuile non plus (le calage
   est l'une des quatre causes, mais il est transporté avec le reste).

---

## ① LA HAUTEUR RENDUE — (2) TRANCHÉ

Trois lectures du MÊME sommet, à chaque repos de niveau, 8 chargements :

| lieu · sommet | z11 | z12 | z13 | z14 |
|---|---|---|---|---|
| **La Réunion**, Piton de la Fournaise — maillée (8 ch. après) | 2 239 | 2 237 | 2 237 | 2 237 |
| — même chose AVANT (8 ch.) | 2 239 | 2 237–2 239 | 2 237–2 239 | 2 237–2 239 |
| — `terrain.sample` (le BLOC, après) | 2 462 | 2 237 | 2 192 | 1 586 |
| **Mont-Blanc** — maillée (8 ch. après) | 4 790–4 802 | 4 790–4 802 | 4 790–4 804 | 4 802–4 804 |
| — bloc | 4 777 | 4 803 | 4 805 | 4 804 |
| **Teide** — maillée (8 ch. après) | 3 671–3 685 | 3 685 | 3 685 | 3 685 |
| — bloc | 3 671 | 3 695 | 3 107 | 2 224 |

« maillée » = `hauteurMaillee` : le rayon du maillage de tuile réellement dessiné, au lat/lon du sommet, sans exagération (colonne `hMailleeM` des JSON). Les fourchettes de Mont-Blanc et Teide sont la finesse des tuiles au moment de la lecture (± 13 m), pas un palier : le même chargement rend 4 802 à z11 et z14. La sonde radiale (`rendu.hM`) rend la même valeur que la maillée à Mont-Blanc et Teide ; à La Réunion elle touche une tuile de fond (2 485 m constant), voir réserve 5.

Écart maximal de la hauteur rendue z11 → z14 : **2 m sur 2 239 (0,09 %)**, sous le
critère (≤ 1 %). L'exagération vaut **2 partout** (`globe.exaggeration`, D10), pas de
palier caché. La colonne « bloc » est la seule qui bouge, et elle bouge pour deux
raisons ni l'une ni l'autre visibles : la moyenne (le plan `y = 0`) et les sommets
non encore remplis (à z14, 1 586 m est lu **avant** l'arrivée du flux).

---

## ② LA DÉRIVE DU POINT VISÉ AU GESTE — AVANT / APRÈS

Dérive = distance à l'écran, au repos après le geste, entre le centre (640, 400) et
le point RENDU qui y était avant le geste (même lat/lon, rayon relu sur le maillage).
Chaque ligne = 8 chargements de page (4 pour les lieux de contrôle AVANT).

### À 45° — La Réunion (flanc de la Fournaise sous le centre, ~700 m)

| franchissement | AVANT (8 ch.) dérive au repos | AVANT excursion | APRÈS (8 ch., code figé) dérive | APRÈS excursion |
|---|---|---|---|---|
| z11 → z12 | 266–378 (méd. 329) | 513–519 | **0,5–0,8 (méd. 0,7)** | 0,5–0,8 |
| z12 → z13 | 197–228 (méd. 218) | 788–819 | **0,3–0,4 (méd. 0,4)** | 0,3–0,4 |
| z13 → z14 | 194–253 (méd. 204) | 270–300 | **0,5–1,1 (méd. 0,8)** | 0,5–1,1 |
| cran DANS le niveau | 0,2 | | 0,2 | |

Inclinaison relue après le geste : AVANT **42,9–44,2°** (la butée `polaireMaxSol` écrêtait la caméra au franchissement, cause ③), APRÈS **45,0° × 8**. La série APRÈS est `reunion-t45-apres-b.json` (8/8 valides, lancée à 10 h 46 après le commit `b4fc062`) ; la première série (`reunion-t45-apres.json`) a 6 valides sur 8 — voir §④ — et donne les mêmes chiffres (0,3–0,9 px).

### À 45° — Mont-Blanc et Teide

| lieu · franchissement | AVANT (4 ch.) dérive | AVANT excursion | APRÈS (8 ch.) dérive | APRÈS excursion |
|---|---|---|---|---|
| **Mont-Blanc** z11 → z12 | 570–594 (méd. 573) | 570–594 | **0,5–0,6** | 0,5–0,6 |
| Mont-Blanc z12 → z13 | 0–4,4 ⚠️ | 245–250 | **0,0** | 0,0 |
| Mont-Blanc z13 → z14 | 0–4,9 ⚠️ | 308–311 | **0,0–0,1** | 0,0–0,1 |
| **Teide** z11 → z12 | 108–119 (méd. 115) | 3 022–3 823 | **0,3 × 7, 6,7 × 1** ⚠️ | 0,3 / 6,7 |
| Teide z12 → z13 | 112,5–113,0 | 554–575 | **0,1–0,2** | 0,1–0,2 |
| Teide z13 → z14 | 53–58 (méd. 55) | 536–576 | **0,2–0,3** | 0,2–0,3 |

⚠️ **Mont-Blanc AVANT** : au premier franchissement, la butée AVANT redressait la caméra de 45° à **0°** (inclinaison relue 0,0° sur les 4 chargements) ; les deux franchissements suivants sont donc mesurés au nadir, où la dérive est nulle par construction — les 0–4,9 px ne sont pas un « AVANT tenu », c'est l'oblique perdue. APRÈS : 45,0° × 8 aux trois franchissements.
⚠️ **Teide APRÈS, chargement 1** : 6,7 px à z11 → z12, et le cran DANS le niveau y valait déjà 3,9 px (contre 0,2 sur les 7 autres) ; la dérive est née avant le franchissement, sur un cran de molette, sur le premier chargement de la série (cache froid). Non diagnostiqué ; les 7 autres chargements sont à 0,3 px. Le chargement 4 porte une erreur de sonde (`Cannot read properties of null`, lecture d'un maillage en cours de remplacement) sans effet sur ses mesures (0,3 / 0,1 / 0,2).

### Au nadir (0°) — La Réunion

| franchissement | AVANT (4 ch.) dérive au repos | AVANT excursion | APRÈS (8 ch.) dérive | APRÈS excursion |
|---|---|---|---|---|
| z11 → z12 | 0–5,0 | 509–708 | **0,0** | 0,0 |
| z12 → z13 | 13,5–22,0 | 1 027–1 462 | **0,0** | 0,0 |
| z13 → z14 | 0–3,1 | 118–158 | **0,0** | 0,0 |

Au nadir, VID3 avait raison sur le repos (0 px, ou presque : jusqu'à 22 px ici) — mais l'**excursion** pendant le glissé qui suit le franchissement montait à 1 462 px AVANT : la caméra physique était bien déplacée, la projection verticale le cachait au repos. APRÈS : 0,0 px partout, image par image.

### Le BOUTON (`cranZoom`, le chemin de VID3) — La Réunion, 45°

| franchissement | AVANT (3 ch.) dérive | AVANT excursion | APRÈS (3 ch.) dérive | APRÈS excursion |
|---|---|---|---|---|
| z11 → z12 | **824** | 824 | **0,2** | 0,2 |
| z12 → z13 | 5,2 | 1 568 | **0,2** | 0,2 |
| z13 → z14 | 63,7 | 233 | **0,5** | 0,5 |
| cran DANS le niveau | 0 (une fois 283) | | 0,1–0,2 | |

AVANT, le premier cran du bouton faisait aussi retomber l'inclinaison de 45° à **6,7°** (relue après le geste, 3/3) : le « 438 px » de VID3 et ces 824 px sont le même geste, le point visé sortant par le haut pendant que la caméra se redresse. APRÈS : 45,0° gardés, 0,2–0,5 px.

C'est le « 438 px pendant les crans » de VID3 : le bouton reculait le long de
`cible → caméra`, et la cible est à `Y_CIBLE = −0,3` sous le plan moyen — pas sur
le sol regardé. Il vise maintenant le point du cadre, comme la molette.

---

## ③ LA CAUSE, EN QUATRE MORCEAUX — et ce que chacun valait, mesuré

La caméra vit dans le repère du BLOC (56 unités, plan `y = 0` à la moyenne). Ce
qu'on voit est dessiné par `camGlobe`, image du bloc par la similitude de
`frontiere-rendu.js` : `G(p) = haut · rayonAncre(moyenne) + k · R · (p − origine)`.
Au franchissement, **trois** termes changent — `k` (emprise ÷ 2), `rayonAncre` (la
moyenne) et `R` (le calage sur la grille de tuiles) — et `_suivreEmprise` ne
convertissait que `camera.y` par le rapport des emprises, pendant que `_rescale`
reposait la cible à `Y_CIBLE` sous une caméra dont la direction était gardée.

| # | morceau | ce qu'il valait (45°, La Réunion) | le correctif |
|---|---|---|---|
| 1 | **la pose n'était pas transportée** : `camY × emprise` conservé, cible reposée à −0,3, pivot `_zoomPivot` laissé dans l'ancien repère | 324 / 199 / 180 px | `_transporterSiRepereChange` (modes.js) : caméra, cible ET pivot réexprimés par `G'⁻¹ ∘ G` dès que l'**empreinte** du repère change (emprise, moyenne, exagération, calage) — `monde/pivot-oblique.js` ; `_rescale` ne repose plus la cible sous le crochet | 
| 2 | **le pivot lu sur le bloc** (`pointUnder` marche `terrain.sample`) : après un cran, le bloc garde ~700 ms les sommets de l'ancien niveau | 53 → 42 px résiduels au premier franchissement | `pointDessineSousLaVisee` (main.js) : la marche de la mise au point sur la surface dessinée, rendue au bloc par la réciproque de la similitude |
| 3 | **les deux butées lisaient ce même bloc faux, ET dans le nouveau repère sur une caméra encore dans l'ancien** (le rechargement est une tâche découpée qui tombe au milieu de l'image, après `modes.update()`) : `minDistance` 6 → 6,207, `φ` 45° → 43,97°, une image avant le transport | 25 à 60 px, **selon l'instant du remplissage** (1,8 px un chargement sur quatre) | `solDessine` (le sol dessiné en unités de bloc) pour `distanceMinSol` / `polaireMaxSol` / `redresserSurLeSol`, et `modes.suivreRepere()` AVANT la lecture du sol |
| 4 | **l'ancre du nouveau repère** : deux similitudes affines d'un bloc plat ne coïncident qu'à leur ancre ; le nouveau repère était ancré à l'aplomb des anciennes coordonnées de la cible lues dans le nouveau bloc — un autre lieu, jusqu'à 8 km | 1,1 à 1,6 px au transport, ×1,7 par le glissé qui suit → 2,0 / 2,5 px | `similitudeBlocAuLieu(lat, lon)` : le nouveau repère est ancré au MÊME point physique que l'ancien |

Preuve de 3, l'espion (`--espion`, `.banc/OBL/reunion-t45-espion2.json`, trois
chargements) : dans l'image du franchissement, `controls.update` écrête la caméra
(`d` 6 → 6,207, `min` 6 → 6,207, `φmax` 61° → 43,97°) **puis**, une image plus tard,
`_transporterSiRepereChange` transporte la pose déjà écrêtée. Après correctif, la
même sonde ne relève plus d'écriture entre le transport et le glissé.

---

## ④ CE QUE J'AI CRU PUIS RÉFUTÉ

- ⛔ **« Mont-Blanc AVANT tient déjà à z12 → z13 (0–4 px). »** Non : l'inclinaison relue après le premier franchissement y est 0,0° — la butée AVANT avait couché la caméra au nadir, où la dérive est nulle par construction. La ligne AVANT de Mont-Blanc ne compare pas la même chose que la ligne APRÈS (45° gardés).
- ⛔ **« 3 chargements GE3 bloqués dans le crop = régression du transport. »** Rejoué le témoin 8 + 8 : AVANT bloque aussi (2/8), et seulement pendant le recouvrement des deux bancs. Charge machine, pas correctif — voir §⑥.
- ⛔ **« Un test de texte qui passe garde l'ordre transport → butées. »** Il passait aussi sans l'appel (−1 < n). Vu par mutation md5, corrigé.

- ⛔ **« Le relief est ré-échelonné par niveau (VID3, cause 2). »** Réfuté au §①,
  hauteur rendue à l'appui. `terrain.sample` lit le bloc, centré sur sa moyenne, et
  ses sommets sont en retard sur son cadrage.
- ⛔ **« Le pivot est 0,3 u sous le sol, donc la molette dérive. »** Non : DANS un
  niveau, la molette rend 0,2 px sur 8 chargements — `_zoomPivot` est le point du
  cadre depuis D19. Le `Y_CIBLE` enterré ne coûte qu'au **bouton** (`cranZoom`, qui
  reculait vers la cible) et au **franchissement** (la cible reposée à −0,3).
- ⛔ **« Transporter la pose suffit. »** 324 → 53 px : il restait le pivot lu sur un
  bloc faux, les butées lues dans le mauvais repère, et l'ancre.
- ⛔ **« Les butées sur le sol dessiné suffisent. »** Elles lisaient encore le sol
  dans le NOUVEAU repère sur une caméra ANCIENNE — l'espion l'a montré, pas la
  relecture ; d'où `suivreRepere()` avant la lecture.
- ⛔ **« Un relevé stable est un relevé juste. »** 37 / 57 / 51 px sur trois
  chargements, puis 1,8 px sur un quatrième, pour le même geste : c'est l'instant du
  remplissage qui décidait. Sans les 8 chargements, j'aurais conclu deux fois faux.
- ⚠️ **Deux chargements de la série Réunion-après (n° 6 et 7) sont invalides** : mes
  mutations de `modes.js` (preuve de morsure) ont fait recharger la page pendant
  qu'ils tournaient. Ils sont marqués `ERR` dans le JSON ; la série a été rejouée
  (`reunion-t45-apres-b.json`) une fois le code figé.

---

## ⑤ MES LIGNES — pour `wt-fan` et la fusion à la main

| fichier | où | ce que j'y fais |
|---|---|---|
| `src/monde/pivot-oblique.js` | **neuf** | `similitudeBloc` (similitude + réciproque, les termes de `poseFond`), `empreinteRepere`, `transporterPose`, `cranAutourDuPivot` |
| `src/modes.js` | l. 13–20 | l'import |
| | l. 434–435 | `this._repereVue` |
| | **l. 552–585** | `_suivreEmprise` : sous le crochet `similitudeBloc`, `_transporterSiRepereChange()` et retour ; sans le crochet, le chemin d'avant au bit près |
| | **l. 603–670** | `_transporterSiRepereChange()` et `suivreRepere()` (neufs) |
| | l. 826–855 | `cranZoom` : le cran autour du pivot (`pointUnder(0, 0)`), même prédicat `horsDuCrop` que `_applyZoom` |
| | l. 1051 | `enterOrbit` lâche `_repereVue` |
| | l. 1361–1365 | `_loadDive` repart d'un repère vierge |
| | **l. 1641–1655** | `_rescale` : sous le crochet, `controls.target.copy(arrival.target)` n'est plus exécuté ; la ligne `if (continu) { this._suivreEmprise(cibleAvant); … }` est intacte |
| `src/main.js` | l. 64–69 | l'import de `similitudeBloc` |
| | l. 5267–5290 | `solDessine` (+ `_candidatsSol`) |
| | **l. 5305–5340** | `parametresSimilitude(x, z)` (neuf) — la lecture unique |
| | l. 5424–5450 | `majCameraFond` lit `parametresSimilitude` (même `poseFond`, mêmes valeurs) |
| | l. 5803–5830 | `pointDessineSousLaVisee(ndc)` (neuf) |
| | l. 7391–7410 | crochets `similitudeBloc`, `similitudeBlocAuLieu` |
| | l. 7632–7650 | `pointUnder` : la surface dessinée d'abord, le bloc en repli |
| | **l. 14160–14210** | `updateCameraMotion` : `modes.suivreRepere?.()` puis les butées sur `solDessine` |
| | l. 14252–14268 | `redresserSurLeSol` sur `solDessine` |
| `test/pivot-oblique.test.js` | neuf | 17 tests ; `test/zoom-continu.test.js` ⑩ adapté (la lecture unique) |

⚠️ **`wt-fan`** : je ne touche ni `regenerateTerrain` ni le `setTimeout(0)` de FLU.
Mais le transport PAR IMAGE (`_suivreEmprise` → `_transporterSiRepereChange`) change
ce que montre **l'image fantôme G1** : à l'image où l'emprise change, caméra ET
cible sont réexprimées ensemble — la planète de fond n'est plus lue « à l'ancienne
position locale ». Je n'ai pas mesuré G1 (ce n'est pas mon banc) ; si `wt-fan`
transporte la caméra dans `_rescale`, c'est la même chose écrite deux fois, et la
mienne est idempotente (empreinte comparée).

---

## ⑥ D19 ET LA SUITE — non-régression

Rejoué avec `scripts/sonde-ge3.mjs` sur l'arbre APRÈS (`.banc/OBL/ge3-surface-apres.json`, régime surface à 2 000 km, 4 chargements par geste ; `ge3-crop-apres.json`, régime crop à La Réunion z12, 8 chargements par geste) :

| critère | seuil | APRÈS | |
|---|---|---|---|
| D19 §1 prise (glissé gauche, `terreDerivePx`) | ≤ 0,2 px | surface H : **0 × 4** · V : **0 × 3** (+ 1 chargement invalide, ci-dessous) · crop H : **0 × 8** | ✅ |
| D19 §2 molette au centre (`centre0DerivePx`) | ≤ 1,4 px | surface 1 cran : **0,00 × 3** (+ 1 invalide) · crop 6 crans : **0,01 × 8** · crop 1 cran : **0,00 × 8** | ✅ |
| `\|Δ ln d\|` sur un geste de pose (glissé) | < 1e-4 | **0 / 8,9e-16** sur tous les glissés, surface et crop | ✅ |
| redressement avant le geste | tilt 0° | **0,000°** sur les chargements valides, pas ≤ 1,48°/image, `retoursNadir = 2` | ✅ |

⚠️ **Chargements invalides, et ce qu'ils sont.** Dans la série surface, 3 chargements sur 16 (glissé H n° 4, glissé V n° 3, molette n° 1) ont fait leur geste **dans le crop de démarrage** (`cropPose = true`, `busy = true`, altitude 84–89 km au lieu de 2 400 km, inclinaison 43–47° jamais redressée en 4 200 images) : la montée à 2 000 km de `porterA` n'a pas eu lieu, et le glissé y est une rotation (azimut −89°, inclinaison +40°), pas une saisie. **Ce n'est pas le correctif** : rejoué le témoin sans geste, 8 chargements par arbre, **AVANT 2/8 bloqués, APRÈS 4/8 bloqués**, et les blocages tombent exactement pendant que les deux bancs tournaient EN MÊME TEMPS (APRÈS seul : 4/4 propres, puis 4/4 bloqués dès que le banc AVANT a démarré à côté ; AVANT : les 2 bloqués pendant le recouvrement). Sous charge, `modes.busy` reste vrai après le voile et la molette de la sonde ne prend pas. GE3 avait 33/33 sur une machine seule ; ici cinq agents tournent. Fichiers : `ge3-temoin-avant.json`, `ge3-temoin-apres.json`. Les lignes ci-dessus ne comptent que les chargements arrivés à 2 000 km.
Le régime orbital n'a pas été rejoué : `enterOrbit` lâche `_repereVue` et rien du correctif ne s'exécute hors du mode surface.

`npm test` **5 121 · 0**, `audit:tests` 284 = 284. **Six mutations rougissent, prouvé par md5** (`.banc/OBL/mutations.json` : md5 avant, muté, restauré identique pour chacune ; `node --test test/pivot-oblique.test.js` entre les deux)
(`test/pivot-oblique.test.js`) : la cible reposée à `Y_CIBLE` malgré le crochet (③),
la caméra non transportée (③, ③ bis), le pivot non transporté (③), `cranZoom` radial
(④, ④ bis), `suivreRepere` inerte (③ ter), **l'appel `modes.suivreRepere?.()` retiré de `main.js` (⑤ bis)** — celle-ci NE MORDAIT PAS au premier essai : la garde comparait `indexOf('modes.suivreRepere?.()') < indexOf('const solButee')`, et `indexOf` rend −1 quand l'appel est absent, −1 < tout. La garde exige maintenant la présence (`iTransport >= 0`) ; rejouée : 1 rouge. C'est le piège « une suite verte ne prouve rien » en vrai, attrapé par la mutation, pas par la relecture. Les tests de texte (⑤, ⑤ bis) tiennent la
lecture unique de la similitude, le pivot sur la surface dessinée, les butées sur
`solDessine` et l'ordre « transport avant lecture du sol ».

---

## ⑦ RÉSERVES — dites

1. **La cible n'est plus à `Y_CIBLE` après un franchissement** : elle est là où le
   glissé l'a menée (le point du cadre l'attire), à sa hauteur. `distanceMinSol`
   mesure son plancher depuis la cible : une cible enterrée (jusqu'à −2,3 u mesuré)
   rend un plancher plus haut d'autant — la caméra s'arrête un peu plus loin du sol
   au zoom le plus fin. Pas mesuré contre l'œil ; c'est la loi R23 avec une cible
   qui bouge.
2. **`pointDessineSousLaVisee` coûte une marche sur la surface dessinée par cran de
   molette** (21 à 29 lectures de `hauteurDessinee`, 0,1–0,2 ms mesurées par R34) —
   par ÉVÉNEMENT, pas par image. Les butées coûtent `PAS_CERCLE + PAS_PARCOURS` =
   80 lectures par image au lieu de 80 `terrain.sample` : non chronométré.
3. **Le résidu de 0,3 à 1,1 px** est la similitude affine d'un bloc plat contre une
   sphère Mercator : second ordre autour de l'ancre, quelques décimètres à 3 km.
4. **G1 (`wt-fan`)** : voir §⑤.
5. La sonde radiale ne touche pas les tuiles du crop à z13–z14 (`rendu —` dans les
   tables) ; `hauteurMaillee` lit le même maillage et rend 2 237 m — c'est elle qui
   fait foi là.

---

## ⑧ LA RECETTE

```
npx vite --host 127.0.0.1 --port 11237                                   # ⛔ pas de npm install
node scripts/sonde-obl.mjs --port 11237 --lieu reunion --tilt 45 --n 8   # molette, 45°, 3 niveaux
node scripts/sonde-obl.mjs --port 11237 --lieu reunion --tilt 0  --n 8   # nadir
node scripts/sonde-obl.mjs --port 11237 --lieu reunion --tilt 45 --n 3 --cran   # le bouton (VID3)
node scripts/sonde-obl.mjs ... --images    # relevé image par image dans le JSON
node scripts/sonde-obl.mjs ... --espion    # chaque écrivain de la caméra autour du franchissement
→ dérive ≤ 2 px par franchissement, hauteur rendue du sommet identique à tous les niveaux.
```

Le second arbre `C:\Dev\wt-obl-avant` est laissé en place (détaché sur `99b037b`) ;
ses serveurs Vite sont les miens et sont arrêtés.
