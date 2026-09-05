# RAPPORT FAN — L'IMAGE FANTÔME POSÉE, LE CRAN DEVENU COURSE, LA BASCULE ATTRIBUÉE — ET UN GEL ATTRAPÉ AVEC SA PILE

**Arbre** `C:\Dev\wt-fan` · branche `fantome-zoom` · base `99b037b` (Fusion BIS) ·
serveur `127.0.0.1:11411`. Chrome sans tête (ANGLE D3D11, RTX 3080), 1280 × 800.
`npm test` **5 114 · 0** (5 104 + 10). `audit:tests` **284 listés = 284 sur disque,
aucun écart**. Aucun `npm install`. Runs dans `…\scratchpad\fan\<run>\`.

## ⓪ MES LIGNES (pour `wt-gel` et `wt-obl`, qui touchent `modes.js`)

⚠️ **Conflit annoncé avec `wt-gel2`** (branche `gel-double-clic`) : son hunk
`_rescale` (base `1489–1553`) ré-indente tout le corps dans un `try/finally` ; mes
trois lignes `_rescaleEnCours` y tombent. Fusion : `this._rescaleEnCours = continu ?
next : null` juste avant l'`await loadSurface`, et **un seul** `this._rescaleEnCours =
null` dans son `finally` (au lieu de mes deux sorties). Ses autres hunks (`911`,
`1201`, `1753`) ne croisent pas les miens.

**Un seul fichier de source : `src/modes.js`.** `main.js` n'est pas touché d'une
ligne — **la coupure FLU de `regenerateTerrain` est intacte** (test G1 ④ la garde).

| hunk (lignes après correctif) | quoi |
|---|---|
| `178–181` | deux constantes, sous `ZOOM_STOP` : `DUREE_CRAN_S`, `PAS_CRAN_MAX_LOG` |
| `434–443` | constructeur : `this._rescaleEnCours = null`, `this._courseCran = 0` |
| `568–594` | `_suivreEmprise` : **le bloc G1** — pendant un `_rescale`, la cible d'arrivée est posée sur l'image même de la conversion |
| `776–813` | `cranZoom` : les deux lignes qui écrivaient `camera.position` deviennent `this._courseCran += …` ; nouvelle méthode `_avancerCourseCran(dt)` juste après |
| `1579–1591` | `_rescale` : `this._rescaleEnCours = continu ? next : null` avant l'`await`, remis à `null` dans les deux sorties |
| `2188–2190` | `update()` : une ligne, `_avancerCourseCran(dt)` juste avant `_applyZoom` |

Tests : `test/fantome-zoom.test.js` (neuf, 10 tests, inscrit dans `package.json`) ;
`test/zoom-continu.test.js` ⑨ et `test/retour-orbite.test.js` ③ quater épuisent la
course avant de lire la distance (3 + 7 lignes). Scripts : `scripts/banc-fan-8.mjs`,
`scripts/analyse-fan.mjs`, `scripts/fantome-sonde.mjs` (neufs) ; `scripts/banc-vid3.mjs`,
`analyse-vid3.mjs`, `ajuste-zoom-vid3.mjs` recopiés de `wt-vid3` (VID3 les a
commités sur sa branche ; **ma seule ligne dans `banc-vid3.mjs` : la sonde relève
l'angle polaire**). Si VID3 fusionne avant moi, garder sa version + cette ligne.

---

## ① LES TROIS RÉPONSES, EN TÊTE

| | avant (base `99b037b`, même banc, même session) | après | critère |
|---|---|---|---|
| **G1 — images fantômes** (sonde rAF, cible de l'ancien bloc sous une emprise nouvelle) | **3 / 3 crans** (`base-sul`), tenues 1 image ; VID3 : 9/9 | **0 / 3** (`fix1-sul`) et **0 sur 8 chargements × 3 crans** (`huit/`, 24 franchissements, 43 changements d'emprise) | 0 ✅ |
| **G1 — cast** (deux images d'affilée > 50 % de pixels changés) | 0 au cast (il perd une image sur trois — voir § ②) ; VID3 3/3 | **0**, et même **plus aucun écart isolé > 50 %** (base : 8) | 0 ✅ |
| **G2 — altitude de fond image à image** (`altitudeCadrageM`) | **3 sauts > 5 %** : ×1,343 · ×1,430 · ×1,399 (le cran sec) | **0 saut > 5 %** ; pire image **×1,046–1,047** sur 9 runs (plafond ×1,045 + arrondi) | continu ✅ |
| **G2 — arrivée et budget** | ×√2 par cran, budget `ln √2` | identiques au bit (tests G2 ①②, ⑨) | inchangés ✅ |
| **G3 — bascule 46,5° → 0° en 1 s après le premier cran** | présente | présente, **attribuée : D16 ter**, pas un défaut — § ④ | tranché ✅ |
| **D19 molette** (`sonde-ge3 --regime crop`, chemin `_zoomGesture`, non touché) | — | 1 cran : dérive du centre **0 px**, pire image ×1,0005 ; 6 crans avant : **0,04 px**, ×1,0023 | ≤ 1,4 px ✅ |
| **SORTIE** — crans pour ARMER la sortie | 3, 8/8 | **3, 8/8** | inchangé ✅ |
| **SORTIE** — crans pour tuer le crop | rapport-SORTIE : 8–10 ; **base aujourd'hui : 36 · 40 · ∅ · 35 · 13 · 13 · 34 · 43** | 10 · 36 · 58 · 21 · 57 · ∅ · ∅ · 55 | ⚠️ **hors critère DES DEUX CÔTÉS** — pas FAN, § ⑥ |
| **PORTE** — crans de retour | ≤ 22 ; **base : 26 · 26 · 24 · 26** (4 tours, `porte-base/`) | 29 · 30 · 25 · 63 · 25 · 29 · — · 26 | ⚠️ idem, § ⑥ |
| **plus longue tâche de descente ×4** (`banc-pa-budget`, vsync) | **772 ms** puis **821 ms** (base, deux sessions) | 912 · 831 puis **778 ms** (second A/B : fix < base) | ≤ 700 ⚠️ personne ne le tient, § ⑤ |
| **suite** | 5 089 · 0 | **5 114 · 0**, audit sans écart | ✅ |

**Et une prise qui n'est pas dans le brief : le gel de z7 (F1 de VID3, terrain de
`wt-gel`) a été attrapé AVEC SA PILE** — § ⑦. Il n'est ni de FAN ni de la nuit :
un `heights` nul lu dans `regenerateLabels`, dans la seconde moitié de
`regenerateTerrain`, et la promesse ne se résout jamais : `busy` pour toujours.

---

## ② G1 — L'IMAGE FANTÔME : CE QUE J'AI CRU, MESURÉ, ET FAIT

**Le mécanisme, vérifié à la sonde** (`base-sul/journal.json`, `fantome-sonde.mjs`) :
à chaque franchissement, l'image où `empriseM` change (3 740 468 → 1 872 904) porte
`camY` **×2,003** (le suiveur a converti) et **la cible de l'image d'avant**. VID3 avait
raison sur tout, y compris que `meshV = false` sur cette image : ce qui est dessiné,
c'est le globe vu par la caméra de fond dérivée du couple (caméra convertie, cible
de l'ancien bloc) — une autre région.

**Les deux voies du brief, mesurées toutes les deux :**

| voie | ce que ça fait sur l'image entre les deux moitiés | fantômes (sonde) | fantômes (cast) |
|---|---|---|---|
| **A — poser la cible avant de rendre la main** (retenue) | le suiveur, au moment où il voit l'emprise changer pendant un `_rescale`, calcule `_arrivalPose(next)` lui-même, pose la cible, et convertit sur le couple accordé (ancienne → nouvelle cible) | **0** | **0** |
| **B — geler le suiveur** pendant le rechargement (`gelB-sul`, le suiveur sort sans convertir NI mémoriser l'emprise) | la caméra reste non convertie sur une emprise nouvelle : **l'altitude de fond tombe à la moitié une image** (255 950 → 127 793 → 255 950 m ; 190 635 → 95 490) et la cible est toujours celle de l'ancien bloc | 3 (cible ancienne, non convertie) | **3** (85 %, 79 %, 83 % de pixels, deux fois de suite) |

➡️ **B est réfutée** : le fantôme n'est pas la conversion, c'est la CIBLE de
l'autre bloc ; geler la conversion rend en plus l'image à moitié d'altitude que le
suiveur par image avait été écrit pour tuer (« onze bascules du seuil du socle »).

**A, précisément.** `_rescale` publie `next` dans `this._rescaleEnCours` pendant
son `await`. Dans `_suivreEmprise()` (chemin par image), si un franchissement est
en cours **et** que l'emprise vient de changer : `cibleAvant = cible.clone()`,
`cible.copy(_arrivalPose(next).target)`, puis la même `poseFranchissement` qu'avant,
avec `empriseAvant = avant`. En sortant, `_rescale` fait ce qu'il a toujours fait —
`cibleAvant = target.clone()`, `target.copy(arrival.target)`, `_suivreEmprise(cibleAvant)` —
et c'est **idempotent** : même cible, même emprise, `emprise / emprise = 1`, la
caméra ne bouge pas (test G1 ① : `distanceTo(poseImage) < 1e-9` après l'`await`).
Hors régime continu, `_rescaleEnCours` est nul et rien ne change.

**Ce que ça donne au cast** (`fix1-sul`, 50 i/s) : non seulement 0 paire, mais **0
écart isolé > 50 %** là où la base en avait 8 — la conversion et la cible tombent
sur la même image, et l'image d'après le cran ressemble à celle d'avant.

**Piège payé : le cast ne suffit pas.** `banc-vid3` capte 1 409 images pour 2 136 rAF
(VID3 : 1 460 / 2 148) : une image sur trois manque. Sur `base-sul`, le cast montrait
**0 paire** alors que la sonde montrait 3 fantômes (VID3 en avait vu 3 au cast par
chance). D'où `fantome-sonde.mjs` et `banc-fan-8.mjs` : **la mesure de G1 est la
sonde**, le cast est une confirmation.

**FLU tient** : `regenerateTerrain` n'a pas bougé, `await new Promise((r) => setTimeout(r, 0))`
y est toujours (test G1 ④), et la plus longue tâche est discutée au § ⑤.

---

## ③ G2 — LE CRAN SEC : UNE COURSE, MÊME ARRIVÉE, MÊME BUDGET

**Une précision d'abord, que VID3 ne pouvait pas faire** (son banc appelait
`modes.cranZoom(1)` parce que `page.mouse.wheel` est avalé par le voile) : **la
molette réelle ne passe pas par `cranZoom`.** Elle passe par `_zoomGesture` →
`_zoomVel` → `_applyZoom` (glissé inertiel, τ = 1,2 s), et les bancs SORTIE / PORTE /
GE3 la pilotent bien par `Input.dispatchMouseEvent mouseWheel` (CDP) — c'est ce
chemin que D19 a mesuré, et il est **déjà continu** (GE3 ci-dessus : ×1,0005 par
image). Le cran sec vit dans `cranZoom` : `stepFiner/stepWider`, l'API publique
(`window.__exp.modes.cranZoom`, templates, bancs) — « il n'a plus d'appelant d'IHM
sous `?terre=unique` » (`main.js`, réserve du rapport M). Sous la molette d'Adrien,
le ×1,41 en une image de VID3 n'existait donc pas ; ce qu'il sent à la molette est
ailleurs (G1, et l'oblique D2 de VID3).

Je l'ai corrigé quand même : D19 vaut pour toute porte, et c'est trois lignes.

**Le correctif** : `cranZoom` compte le budget comme avant (`_levelZoom += dBudget`,
à l'instant du cran — « combien de crans » est intact, tests ③ ter/quater, ⑤ de
`retour-orbite` inchangés dans leur assertion), lance `_franchirSiBesoin()` comme
avant, mais au lieu d'écrire `camera.position`, ajoute `ln(nouvelle / dist)` (déjà
clampé, donc **la même arrivée**) à `_courseCran`. `update(dt)` consomme la course à
vitesse constante en log de distance — `ln √2` en **200 ms**, et **jamais plus de
×1,045 par image** quelle que soit la cadence (à 20 i/s le plafond mord, test G2 ⑤).
Le pas se fait le long de `cible → caméra`, la cible ne bouge pas (test G2 ④ — c'est
le zoom vers le point du cadre de D19, le seul que le bouton ait jamais fait). La
course traverse le rechargement comme le glissé (même condition dans `update`), et
la re-pose de `_rescale` la retrouve à sa distance courante : au cran z6 → z7 de
`fix1-sul`, l'image de conversion porte à la fois la conversion (×1,999) et un pas
de course (×0,966) — `convY` 1,912 lu à la sonde, altitude de fond continue.

**Sans easing** : Google Earth adoucit ; ici la vitesse est constante en log. C'est
un choix de simplicité prouvable (le plafond par image est une constante), à
faire lire à Adrien s'il veut une courbe.

---

## ④ G3 — LA BASCULE AU NADIR : D16 ter, ATTRIBUÉE, AVEC LE MÉCANISME

Sonde `polar` (0° = nadir), 9 chargements Sulawesi par `flyTo(−4,43, 121,77, 4)` :
**arrivée à 46,548° dans 9/9** (c'est `_ARRIVAL_DIR = (0, 18, 19)`, à la treizième
décimale), `dist = 6,000 = minDistance`, **immobile pendant 4 s** (`fondu = false`,
`busy = false`) ; au premier cran (z4 → z5), dès la fin du rechargement, `_fonduPose`
s'arme et **balaie 46,5° → 0° en 57–59 images (≈ 1 s)**, puis 0° à z5, z6, z7.

**Ce n'est pas un défaut du balayage, c'est D16 ter** — « la vue de trois quarts
appartient au BLOC. On la prend en arrivant dessus, on la rend en le quittant » —
appliquée par `redresserSiHerite` (`main.js`) / `_armerRetourNadir` : hors du crop,
vue inclinée, personne ne l'a inclinée à la main → retour au nadir. À z4 il n'y a pas
de crop : la règle veut le nadir.

**Pourquoi la règle ne s'applique qu'APRÈS le premier cran, et pas à l'arrivée** :
`_dive` pose l'oblique (`_posePlongee`, `_ARRIVAL_DIR`) puis `_attendreLeBloc` devrait
poser le nadir immédiatement — mais sa garde de dégagement refuse :
`camY − cible.y = 6 × cos 46,5° = 4,1 u < minDistance × 1,05 = 6,3 u` (à z4 la caméra
est clampée à `minDistance`). Même garde dans `_armerFonduPose`, donc
`redresserSiHerite` refuse aussi, image après image. Au premier franchissement la
conversion double `camY` (7,95 u), la garde passe, le balayage part. La garde a une
raison (au nadir sous `minDistance`, `controls.update()` repousserait la caméra à
chaque image et le fondu se battrait avec la butée) : lever la garde = poser un
nadir plus haut = changer l'altitude d'arrivée du `flyTo`, ce que D16 interdit
(« on ne vise pas, on se rapproche »). **Je ne corrige pas.**

**Ce qui le rend invisible pour Adrien** : à la molette depuis l'orbite, la traversée
pose le nadir (VID3 : « déjà au nadir à z4 »). Seul `flyTo(lat, lon, 4)` — recherche,
lien, GPX cadré à z4 — arrive incliné et se redresse au premier cran. Gravité basse,
comme VID3. Si Adrien veut le nadir dès l'arrivée du `flyTo` à z4, c'est une décision
sur la pose d'arrivée (`_posePlongee` + `_attendreLeBloc`), pas sur le balayage.

---

## ⑤ LA PLUS LONGUE TÂCHE ×4 : L'ACQUIS FLU, ET LE BRUIT DE LA MACHINE

`banc-pa-budget --throttle 4 --novsync 0`, descente Chamonix, **A/B même session,
même banc, ordre base → fix, puis base → fix (FAN-2)** :

| run (heure) | plus longue tâche de descente ×4 (Long Tasks API, top 5, ms) |
|---|---|
| base `99b037b` (`fanbase-x4-vsync`, 07:20) | **772** · 550 · 484 · 456 · 424 |
| fix (`fan-x4-vsync`, 07:17, machine plus chargée) | 912 · 863 · 429 · 353 · 338 |
| fix (`fan2-x4-vsync`, 07:21) | 831 · 747 · 434 · 401 · 385 |
| base `99b037b` (`fanbase2-x4-vsync`, 08:51 — second A/B) | **821** · 727 · 690 · 592 · 401 |
| fix (`fan3-x4-vsync`, 08:52 — second A/B) | **778** · 625 · 573 · 534 · 529 |

**Second A/B (FAN-2, lu dans `.banc/PA/budget-*.json`, `plusLongue.descente`) :
fix 778 < base 821.** Les deux sessions donnent des ordres opposés (base 772 <
fix 831 le matin, fix 778 < base 821 ensuite) : la différence base/fix est du
bruit, et le plafond de 700 ms n'est tenu par **aucun des cinq runs, base
comprise**.

**Le critère « ≤ 700 ms » n'est tenu par personne aujourd'hui, base comprise** :
FLU a mesuré 660 ms sur une machine partagée par six agents en publiant ±30 % de
bruit entre sessions ; ce soir cinq agents et leurs Chrome tournent. Ce que mon
code ajoute à ce chemin est **zéro ligne dans `regenerateTerrain`** et, sur l'image
de conversion, un `_arrivalPose` (une `viseeDuLieu` + un `terrain.sample`) — des
microsecondes, hors de la tâche longue (qui est `terrain.rebuild` + `plinth.rebuild`,
première moitié, intacte). La différence base/fix (772 contre 831–912) est dans
l'enveloppe du bruit documenté par FLU, et le second A/B est ci-dessus. **Je ne peux
pas prouver ≤ 700 sur cette machine ce soir ; je prouve que la coupure est intacte
(test) et que le chemin de la tâche n'est pas touché (diff).**

---

## ⑥ SORTIE ET PORTE : HORS CRITÈRE DES DEUX CÔTÉS — PAS FAN

`sonde-sortie --epreuve sortie --repete 8` et `sonde-porte --epreuve retour`, chemin
molette (CDP), **sur le fix puis sur la base, mêmes conditions, machine seule** :

| | fix | base `99b037b` | rapport d'origine |
|---|---|---|---|
| crans pour ARMER la sortie | 3 (8/8) | 3 (8/8) | 3 (8/8) ✅ |
| crans pour tuer le crop (SORTIE) | 10 · 36 · 58 · 21 · 57 · ∅ · ∅ · 55 | 36 · 40 · ∅ · 35 · 13 · 13 · 34 · 43 | 8 · 8 · 9 · 9 · 9 · 8 · 9 · 8 |
| crans de retour (PORTE) | 29 · 30 · 25 · 63 · 25 · 29 · — · 26 | **26 · 26 · 24 · 26** (4 tours) | ≤ 22 |

La courbe dit où ça casse, et c'est pareil sur la base : la poussée de sortie
(`poussee = true`) monte l'altitude de fond à 20 496 m (base) / 14 508 m (fix) au
cran 7, puis **s'éteint** (cran 8 : `poussee = false`) **sous le seuil de mort du
crop (32 274 m)** ; la suite est le glissé ordinaire, cran par cran, jusqu'à ce
que l'altitude atteigne le seuil. Ce n'est pas un chemin que je touche (la molette
ne passe pas par `cranZoom`, et G1 n'agit qu'au franchissement d'un niveau) ; c'est
une régression **d'entre SORTIE et `99b037b`** (VIE ? TRO ? BIS ?) ou une différence
de conditions (SORTIE mesurait sur `4199e52` ; la première passe de ce soir avait un
second Chrome en parallèle et a donné 40 · 51 · 37 · ∅ · 9 · 40 · 35 · ∅ — la base
seule fait pareil). **À bissecter par le prochain agent**, avec `sonde-sortie` : ce
rapport nomme le symptôme et le cran exact, pas le coupable.

---

## ⑦ LE GEL DE Z7, ATTRAPÉ AVEC SA PILE — pour `wt-gel`

`banc-fan-8`, 8 chargements sur le fix, Sulawesi z4 → z7 par `cranZoom` : **6 sur 8
se figent** (`busy = true` pour toujours, la caméra ne bouge plus au cran, z reste 6
ou 7 ; rapport-GEL : « 30 chargements, 0 gel » — sur une machine moins chargée). Sur
**la base : 0 sur 4** (`huit-base/`, 12 fantômes sur 28 changements d'emprise, et
aucune `pageerror`). Sur le fix, une `pageerror` à chaque gel, la même :

```
TypeError: Cannot read properties of null (reading '202')
    at sampleHeights (src/globe.js:4094)          ← heights[i] sur t.heights = null
    at hauteurDessinee (src/globe.js:8015 → 8024)  ← interpolerMaille sur la tuile la plus fine
    at hauteurM (src/monde/sol-globe.js:231)
    at etat.hauteur (src/monde/sol-globe.js:138)
    at sol (src/labels.js:198)
    at createLabels (src/labels.js:242)
    at regenerateLabels (src/main.js:2177)
    at <anonymous> (src/main.js:4489)              ← regenerateTerrain, SECONDE moitié (après le setTimeout 0)
```

**Le mécanisme** : `regenerateLabels` demande le sol dessiné au globe ;
`poseurPourReconstruction` prend `globe.tuilesAvecHauteurs()` puis
`hauteurDessinee(lat, lon, liste)` choisit la tuile la plus fine **et lit
`t.heights`** — qui est **`null`** : depuis FLU, `_buildMesh` relâche `heights` dès le
maillage et `_retenirHauteurs` n'en garde que 24 ; entre la constitution de la liste
et la lecture (ou entre deux images, la liste étant lue dans la seconde tâche), une
tuile a perdu ses hauteurs. **L'exception part dans le rappel du `setTimeout` de
`regenerateTerrain`** : `resolve()` n'est jamais appelé, `rebuildPending` reste vrai,
`loadSurface` n'a jamais sa réponse, `_rescale` reste dans son `await`, **`busy`
pour toujours** — la définition du gel. Et l'étiquette « REFINING » s'efface quand
même à `MSG_MS` (le `setTimeout` de l'annonce est indépendant), exactement le
`p_031` de la vidéo d'Adrien que rapport-GEL utilisait pour dire « pas une boucle
infinie » : ce n'en est pas une, c'est une promesse morte.

**Ce que je n'ai pas fait** : corriger — `globe.js` / `labels.js` / `regenerateTerrain`
sont le terrain de `wt-gel` et de FLU. Deux correctifs évidents, au choix de
`wt-gel` : (a) `hauteurDessinee` rend `null` si `!t.heights` (le « `null` traverse »
que son commentaire promet déjà), (b) `regenerateTerrain` enveloppe sa seconde
moitié d'un `try/finally` pour que `rebuildPending` retombe et que la promesse se
résolve même sur exception. **(b) est une ceinture qu'il faudrait de toute façon** :
toute exception dans les calques figeait déjà l'application avant FLU.

---

## ⑧ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le fantôme se voit au cast. »** Sur `base-sul` le cast rendait **0** paire
   alors que la sonde en voyait 3 : le screencast perd une image sur trois. VID3
   avait vu les siens par chance de phase. La mesure est la sonde.
2. **« Geler le suiveur suffit »** (voie B du brief) : mesuré, 3 fantômes au cast et
   une image à moitié d'altitude — la cible est le coupable, pas la conversion.
3. **« G2, c'est ce qu'Adrien sent sous la molette. »** Non : la molette passe par
   `_zoomGesture` (inertiel, ×1,0005 par image mesuré à GE3) ; `cranZoom` n'a pas
   d'appelant d'IHM sous `?terre=unique`. Corrigé quand même (API, bancs, boutons).
4. **« La distance métrique `dist × emprise` est invariante par conversion. »** Non,
   à 1 % près : l'invariant est `camY × emprise` et la cible est enterrée de 0,3 u
   (`Y_CIBLE`) — c'est le pivot sous le sol de VID3 (D1). Le test G2 ② tolère 1 %
   et le dit.
5. **« Les 6 gels sur 8 sont ma régression. »** Ma première crainte : `_arrivalPose`
   appelé une image plus tôt. La pile dit `regenerateLabels` → `sampleHeights` sur
   `heights = null`, aucune image de `modes.js` ; le résultat sur la base est au
   § ⑦ : **0 gel sur 4 sur la base, 6/8 + 2/4 + 1/3 sur le fix** — FAN ne crée
   pas le trou, mais il l'ouvre bien plus souvent ; voir § ⑩.
6. **« SORTIE 8–10 et PORTE ≤ 22 vont tenir. »** Ils ne tiennent pas — sur la base
   non plus, même session : la poussée s'éteint sous le seuil de mort. Attribué à
   la période SORTIE → `99b037b`, pas à FAN.
7. **« G3 est un choix (D19 ?). »** C'est D16 ter, et la raison du délai est une garde
   de dégagement à `minDistance`, chiffrée (4,1 u < 6,3 u).

---

## ⑨ LA RECETTE

```
npx vite --host 127.0.0.1 --port 11411
node scripts/banc-vid3.mjs 11411 <dir> sulawesi        # une descente à 50 i/s, cast + sonde (polar ajouté)
node scripts/fantome-sonde.mjs <dir>                   # G1 par la sonde : cible ancienne sous emprise nouvelle
node scripts/analyse-vid3.mjs <dir> && node scripts/analyse-fan.mjs <dir>   # cast, G2 métrique, G3 polaire
node scripts/banc-fan-8.mjs 11411 <dir> 8              # 8 chargements, sonde seule : fantômes, sauts d'altitude, polaire, pageerror (pile)
node scripts/banc-pa-budget.mjs --port 11411 --throttle 4 --novsync 0 --etiquette <x>   # plus longue tâche
node scripts/sonde-sortie.mjs --epreuve sortie --repete 8 --port 11411 ; node scripts/sonde-porte.mjs --epreuve retour --repete 8 --port 11411
node scripts/sonde-ge3.mjs --port 11411 --regime crop --repete 4                        # D19 molette
node --test test/fantome-zoom.test.js                  # G1 ①–④, G2 ①–⑥ ; mutation : retirer le bloc G1 de _suivreEmprise → G1 ① rouge ; remettre l'écriture directe dans cranZoom → G2 ① rouge
```

---

## ⑩ REPRISE FAN-2 (l'agent FAN a été coupé par une limite d'usage, rien n'était commité)

Ce que j'ai vérifié en reprenant : `git diff` = les six hunks du § ⓪, cohérents
avec le brief (G1 : la cible posée sur l'image de la conversion, la coupure FLU
intacte ; G2 : le budget compté à l'instant du cran, la course ne change que le
chemin ; G3 : attribué, pas corrigé). Les relevés « À COMPLÉTER » existaient dans
le scratchpad (`huit-base`, `porte-base`, `fanbase2`/`fan3`) : ils sont
reportés ci-dessus.

**Le gel : c'est le même que celui de `wt-gel2`, et `wt-gel2` a déjà les deux
correctifs du § ⑦.** Son arbre porte, non commité, (a) `if (!t.heights) continue`
dans `_tuileLaPlusFine` (`globe.js`) et (b) le `try/catch/finally` autour de la
seconde moitié de `regenerateTerrain` (`main.js`), avec le même diagnostic
(« `sampleHeights(null)` sous `regenerateLabels`, 6/8 depuis l'orbite »). Je n'ai
donc rien écrit hors `modes.js`.

**Mais FAN l'ouvre plus souvent, et il faut le dire** : base 0/4, fix 6/8, 2/4,
1/3, toujours au franchissement z6 → z7. Le mécanisme est cohérent avec le
correctif : sur la base, la caméra est immobile pendant le rechargement ; avec la
course du cran (G2) et la cible posée dès l'image de conversion (G1), elle bouge
encore pendant les deux moitiés, le globe maille de nouvelles tuiles, et
`_retenirHauteurs` (24 tuiles) relâche une tuile que `regenerateLabels` a déjà
dans sa liste. **FAN ne doit pas fusionner sans (a) ou (b)** — sinon la descente
au cran gèle plus d'une fois sur deux.

**Preuve que c'est bien ce trou-là, et rien d'autre** (`huit-garde/`) : la garde (a)
posée temporairement sur mon arbre (une ligne, retirée avant le commit — le diff
ne touche pas `globe.js`), `banc-fan-8`, **8 chargements** Sulawesi z4 → z7 :

| chargement | changements d'emprise | fantômes (sonde) | sauts d'altitude > 5 % | pire image | niveaux | pageerror |
|---|---|---|---|---|---|---|
| 1 … 8 | 7 × 8 = **56** | **0** | **0** | ×1,0461 – ×1,0474 | 5, 6, 7 (8/8) | **0** |

C'est le critère du brief tenu en entier : **0 fantôme sur 8 chargements**, zoom
continu (plafond ×1,045 + arrondi de la sonde), aucun gel.

**Morsure par mutation (rejouée par FAN-2, `node --test test/fantome-zoom.test.js`)** :
- bloc G1 de `_suivreEmprise` neutralisé (`if (false)`) → **G1 ① rouge**, 9 verts ;
- `cranZoom` remis en écriture directe de `camera.position` → **G2 ① et G2 ② rouges**, 8 verts ;
- `modes.js` restauré au bit près après chaque mutation (`cmp`).

**Suite** : `npm test` **5 114 · 0** (base de cet arbre `99b037b` : 5 104 ; +10 de
`fantome-zoom.test.js`), `audit:tests` 284 = 284, aucun écart. Le « ≥ 5 119 » du
brief de reprise compte des tests d'autres arbres ; ici la base est 5 104.

**Ce que je n'ai pas refait** : le cast CDP 50 i/s (VID3/`fix1-sul`, déjà 0 paire
sur le fix), SORTIE/PORTE (hors critère sur la base aussi, § ⑥ — à bissecter à part),
GE3 (D19 mesuré au § ①, chemin non touché).
