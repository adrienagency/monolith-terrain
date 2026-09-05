# RAPPORT PC — LE STOCK D'OPTIMISATIONS DÉJÀ CHIFFRÉES ET JAMAIS APPLIQUÉES

**Arbre** `C:\Dev\wt-pc` · branche `perf-inventaire` · `git diff -- src/` **vide**
· `npm test` **4 899 · 0** · `audit:tests` **263 = 263**.

**La question d'Adrien :** *« Quelles options me reste-t-il pour améliorer le
framerate ? »* — **ma moitié : le stock déjà constitué.** Je ne mesure rien de
neuf (c'est `wt-pa`), je ne regarde pas ce que font les autres moteurs
(troisième agent). Je fais **la liste que personne n'avait**, et je la confronte
au code d'aujourd'hui.

---

## ⚠️ LIRE CECI D'ABORD — CE QUE LA VÉRIFICATION A CHANGÉ

Le brief anticipait que le dossier se serait contredit. **Il s'est contredit
davantage que prévu, et dans le sens qui compte : à la baisse.** Quatre des
lignes que le brief lui-même me donnait comme « du stock » ne sont plus des
gains :

1. **« Router les descendants d'un 404 vers AWS — 40 % des requêtes (PF2 §5) »**
   → ⛔ **fait**, et **le chiffre est réfuté**. `globe.js:3425` porte le routage
   (« LE DESCENDANT D'UN 404 VA DROIT CHEZ AWS — CIB »). Et `rapport-CIB.md` §5
   mesure le plafond réel : **7 à 21 requêtes par descente** — Ajaccio **8/83 =
   10 %**, Nice **7/61 = 11 %** — parce que sur les 679 404 de PF2, seuls 7 à 21
   ont un ancêtre déjà troué. CIB l'écrit lui-même : *« son plafond est petit, et
   je l'annonce petit »*.
2. **Les trois lignes « rivières »** (Natural Earth d'abord, échéance partagée,
   disjoncteur plus tôt) → ⛔ **faites** par RIV-C, et **le gain de 13,3 s est
   réfuté** : délai jusqu'au premier trait, médiane de 3 tours, **13 699 →
   13 481 ms** au Rhône z12 et **10 836 → 11 452** au Mississippi z12 — *« du
   bruit, dans les deux sens »* (`rapport-RIV-C.md`, § LIRE CECI D'ABORD). Le
   gain réel est **−0,6 à −1,6 s** sur le mur bloquant, pas 7,7 s.
3. **« L'annulation des requêtes en vol »** → ce n'est pas « la dernière, risque
   moyen » : c'est **refusée dans le code, par écrit, pour deux raisons
   mesurées** (`globe.js:8429`). Voir §C-1.
4. **La barrière d'ordonnancement D22** est **écrite, testée, et livrée
   DÉBRAYÉE parce qu'elle DÉGRADE** — pas faute de temps (`rapport-CIB.md` §4).

⚡ **Il reste malgré tout un stock considérable, et son sommet est intact.**

---

## ① LE NOMBRE DE RAPPORTS LUS

Le dossier contient **206 fichiers**. J'ai fait lire **101 fichiers**, dont
**82 des 84 `rapport-*.md`**, les **11 `regle-D*.md`**, `plan-fusion.md`
(toutes ses sections « reste ouvert »), `lecons-campagne-R.md`, les trois
`socle-*.md`, `inventaire-D16.md`, `inventaire-studio-2.md`, `attaque-D16.md`
et `bugs-adrien-2026-09-04.md`.

**Non traités, et je dis lesquels :**

| non lu | combien | pourquoi |
|---|---|---|
| `rapport-correction-P812.md`, `rapport-correction-P1314.md` | 2 | comptes rendus de correction de tests, aucune mesure de perf |
| `brief-*.md` | 47 | commandes, pas mesures — les chiffres qu'ils portent sont ceux des rapports, et **le brief PC dit lui-même de vérifier le code plutôt que de recopier un brief** |
| `paquet-*.md`, `paquet-*.diff` | 24 | transcriptions de session et diffs bruts |
| `notation-0*.md`, `relecture-*.md`, `constats-*.md`, `etude-libelles.md`, `recherche-routes-*.md`, `progress.md`, `traces-*` | ~32 | relectures, notations d'options de studio, recherches documentaires, journaux |

⚠️ **Réserve honnête** : `notation-01` à `05` (208 Ko) portent les relevés
d'options du studio. `rapport-R21.md` §④ quinquies établit que **le barème de
cet inventaire est partiellement sous le bruit** (transitoire 0,162–0,191 de
moyenne, 0,326–0,385 de gradient, contre un seuil de 0,06) — donc **7 verdicts
✅ sur 72 n'en sont pas**. Je ne republie aucun chiffre d'options de studio pour
cette raison ; ce ne sont pas des postes de framerate.

---

## ② CE QUI A ÉTÉ FAIT DEPUIS, ET QUE PERSONNE N'A RAYÉ

**C'est la section qui évite qu'on repaie du travail.** Chaque ligne est
vérifiée par `grep` dans `src/` aujourd'hui.

| piste du stock | preuve dans `src/` | où c'était annoncé « à faire » |
|---|---|---|
| **404 → AWS pour les descendants** | `globe.js:3425` `if (trouConnu(...)) return surAws` | `rapport-PF2.md` §5 ; `rapport-RIV.md` §②-A rang 3 |
| **Rivières : peindre le local sans attendre Overpass** | `map/water-layer.js` §« LE CHANGEMENT EST UN ORDRE » ; `test/eau-attente.test.js` | `rapport-RIV.md` §③ rang 1 |
| **Rivières : échéance d'attente partagée** | `map/overpass.js`, `OVERPASS_ATTENTE_SONDE_MS = 1500`, `OVERPASS_PANNE_MS = 60_000` | `rapport-RIV.md` §③ rang 2 |
| **Purge de file + éviction + plafond de file** | `globe.js:914` `PLAFOND_FILE = 256`, `_purgerFile`, `_annuler` | plan « globe continu » Tâche 4 bis |
| **Raffinement partiel + rechargement sur place + prélecture** | `globe.js:4114` `raffinementPartiel = true`, `PRELECTURE_RATIO/RETRAIT/CENTRE/CREDIT_MIN` | `rapport-R37.md` |
| **Cible D22 (priorité continue au centre)** | `globe.js:951` `R_CIBLE = √(2/π)`, `_dansLaCible` | `regle-D22.md` |
| **Matériau de tuile partagé** | `monde/materiau-tuile.js`, `libererMateriauTuile` | `rapport-PF1.md` §④ ligne 2 — **et PF4 a réfuté à moitié l'estimation : 15–25 % annoncés, 9 % réels** |
| **`matrixAutoUpdate = false`** | 5 sites (`globe.js` tuiles/mer/parois/group, `main.js` `sceneGlobe`) | `rapport-PF1.md` §④ ligne 3 (−15 %) |
| **Décodage terrarium hors fil principal** | `monde/decodeur-terrarium.js` | `rapport-PF1.md` §④ ligne 7 |
| **Cadence de repos (1 image sur 2, 1/30 figé)** | `cadence-repos.js`, `DIVISEUR = 2`, `DIVISEUR_FIGE = 30` | `rapport-PF1.md` §③ — **partiel : orbite seulement** |
| **Coupe du parcours hors crop sous estompage plein** | `globe.js:4832` `if (!this._cropSeul && !this.estompePlein()) return false` | `rapport-M.md` §5.2 — **−92,6 % de demandes, −88,8 % de tuiles parcourues** |
| **Crop seul au repos** | `globe.js:4806` `poserCropSeul`, `monde/veille-repos.js` | `rapport-N.md` §4 |
| **`GL_INVALID_OPERATION` à chaque image** | `profondeur-compositeur.js` (SMAA-DEPTH retiré + `Source` propre à la stable) | `lecons-campagne-R.md` §⑦ « Tâche à ouvrir » ; `plan-fusion.md` « Défauts déclarés » |
| **Le saut `rotateSpeed` ×66,67** | `modes.js:1182` `rotateSpeed = 1` des deux côtés | `rapport-R13.md` réserve 1 (jugée « pas évidente à fermer ») — **R23 l'a fermée d'une ligne** |
| **Garde d'échelle bathymétrique** | `bathy.js:197` `CELLULE_MAX_PX = 32`, `bandeBruitAdmise` | `rapport-PLAT.md` §⑥ point 1 |
| **Mer coupée à plat à la jupe, houle hors emprise non calculée** | `monde/mer-sphere.js` §⑧, `EMPRISE_MER_CROP = 1` + `bandeHouleBord` | `regle-D24.md` §② — **les DEUX moitiés sont livrées** |
| **Crop revenu à z10** | `monde/seuil-socle.js` §6 bis, `SEUIL_NAISSANCE_M = SEUIL_BLOC_M` (32 274,3 m) | `regle-D23.md` |
| **`contexteCrop()` mémoïsé** | mémo **retiré** — PF4 mesure 4,3–5,0 µs contre 5,3–6,8 | ⛔ **ne pas rouvrir**, PF1 §⑤-2 annonçait 14,1 % à tort |

⛔ **Six d'entre elles étaient encore listées « à faire » dans un document du
dossier au moment où j'écris** (le classement de `rapport-RIV.md` §③ met en
rangs 1, 2 et 3 trois choses qui sont faites).

---

## ③ CHIFFRÉ ET PRÊT — mesuré, rien ne bloque sauf le temps

| optimisation | gain annoncé | qui l'a mesuré | encore valable ? (preuve `grep`) | ce qui bloque | risque |
|---|---|---|---|---|---|
| **A1 · Plafond de finesse fonction de l'altitude** (le crop haut se remplit à z9, pas z13) | vise le facteur **×6,5** : **1 700 tuiles** (= `CACHE_MAX_CONTINU`, cache saturé) et **129,9 / 202,5 ms** à CPU ×4 contre **495 tuiles / 19,9 ms** sans crop ; décomposition ×4 : `rendu.objets` **64,78 ms**, `composer.render` 19,46, `_traverse` 11,23 ; GPU `PasseFond` **67,62 ms** ; **1 140 draw calls, 1 385 323 triangles** | `rapport-C1.md` § « LE CHIFFRE DE z7 » et §③ point 2 ; **re-confirmé** par `rapport-REV.md` §③ | ✅ **OUI, ET C'EST VÉRIFIÉ APRÈS D23.** `crop-sphere.js:308` `zoomCropPrescrit` rend `ZOOM_SOCLE` **plancher ET plafond** ; `globe.js:866` `CACHE_MAX_CONTINU = 1700` ; aucune loi altitude→zoom : `grep "zoomMaxAltitude\|plafondFinesse\|ZOOM_MAX_ALT"` = **0**. REV relève à 130 km : `tuiles 1700 · rAF p50 44,10 ms` contre **11,90 ms** dans le crop | **rien — sauf que `globe.js` était pris.** ⚡ **Adrien l'a validé ce matin : marquer « validé, en attente ».** | faible : ne touche aucun seuil livré |
| **A2 · Maillage étalé sous budget** (`processTerrainQueue`, 4 ms/image, centre d'abord) | **121 tuiles bâties dans la même image de 315 ms** ; p99 des maillages **13,8 → 8,7 ms** (×1) et **44 → 32 ms** (×4) | `rapport-PF2.md` §4.8 et §3 | ✅ `grep processTerrainQueue src/` = **0** | **25 tests dans six fichiers** supposent qu'une tuile est prête dès sa réponse. PF2 a **retiré le code** plutôt que réécrire 25 contrats | moyen |
| **A3 · Couper les tuiles hors crop de `demanderEmprise`** | **37 tuiles sur les 52 restantes hors crop** (emprise primaire 5×5 z12 : 16/25 hors crop ; emprise mer z11 : 21/25) | `rapport-R3.md` §5 et §9 réserve 1 | ✅ `main.js:4712` passe encore `aussi: empriseZoomMer()` sans garde de crop ; `TUILES_MER_MAX = 25` (`main.js:6128`) | R3 : *« je refuse d'y toucher sans budget de vérification visuelle »* — l'anneau de marge est lu par la frontière du crop, et réduire la mer à 4 tuiles rend l'aplat gris mesuré à **0,7 %** par la Tâche J | moyen — **il faut un œil, pas un compteur** |
| **A4 · Prescription progressive du zoom à la naissance du crop** (z12 puis z13) | supprime le **dernier maximum de flou à 100 % d'écran**, ≈ **1 s**, sans recul | `rapport-R37.md` §6, 2ᵉ point | ✅ `monde/branchement-crop.js:516` appelle `globe.poserCrop({ centre, zoom, … })` avec **un zoom unique** | R37 : *« décision de produit, pas prise ici »* | faible — mais c'est un arbitrage produit |
| **A5 · `_tuileLaPlusFine` : un `break` au lieu du parcours complet** | **+1 698 ms de fil principal à z6** (3,27 µs/sommet × 519 404 sommets) ; z8 +1 438 ms, z10 +359, z12 +51 | `rapport-D16b.md` réserve 1 | ✅ **VÉRIFIÉ LIGNE À LIGNE** : `globe.js:7411-7433`, boucle `for` sans `break`, alors que `tuilesAvecHauteurs()` (`globe.js:7437`) trie **déjà du plus fin au plus grossier** | `candidates` est un **paramètre public** : rien ne garantit le tri chez les autres appelants. D16-b a préféré ne pas toucher un chemin partagé | faible si on garde la garde sur `candidates` fourni |

---

## ④ CHIFFRÉ MAIS COÛTEUX — c'est un arbitrage d'Adrien, pas une tâche

| optimisation | gain annoncé | qui l'a mesuré | encore valable ? | le prix, dit net | risque |
|---|---|---|---|---|---|
| **B1 · UBO (`UniformsGroup`, std140) + samplers hors de `material.uniforms`** | `composer.render` p50 **4,7–4,9 → 1,8 ms, soit −60 %** à CPU ×4 (borne B, A/B **dans la même session**). Le matériau partagé seul a déjà pris **−17 %** | `rapport-PF4.md` « Levier 1 » | ✅ `grep "UniformsGroup\|std140" src/` = **0** | réécrire les déclarations d'un nuanceur de **192 uniformes** touché par **sept tâches la même semaine**, et sortir ~10 samplers de `material.uniforms` | **fort** |
| **B2 · Rendu à la demande généralisé (`requestRenderMode`)** | au repos figé : **13–24 ms de CPU par image → 0**, pour trois images **identiques au bit** dans les neuf cellules (100 % du tick et du GPU). Aucun gain en mouvement | `rapport-PF1.md` §③ et §④ ligne 1 | ✅ `grep "requestRenderMode\|needsRender" src/` = **0**. La version **orbite** est livrée (`cadence-repos.js`) : ×4 orbite **31,9 → 13,5 ms** animé, **17,2 → 4,5 ms** figé | généraliser suppose de **geler la rotation propre** (choix produit v29, `7777e08`) **et le grain**. En surface, mer/nuages/faune changent vraiment à chaque image | moyen |
| **B3 · Supprimer la rotation propre du globe** | **+14,7 ms/image** en orbite ×4 (31,9 → 17,2 p50) ; **+252 tuiles / 60 images** ; **+160–180 tuiles et +114–130 textures par 20 s de repos** ; **20–41 requêtes / 60 images** ; pousse le cache vers 1 700 (**~1,3 Go**) sans qu'on ait rien demandé | `rapport-PF1.md` §③ et §⑤-4 | ✅ `main.js:14580` `camera.position.applyAxisAngle(UP, dtAmb * 0.035)` | ⛔ **choix produit d'Adrien, pas un oubli.** ⚠️ **ET LE CHIFFRE EST CONTESTÉ** : GE1 mesure **0,000° sur 90 images et 5 s** à deux altitudes ; `lecons-campagne-R.md` interdit d'affirmer les ~2 °/s tant que ce n'est pas tranché | moyen |
| **B4 · Format R16/float ou compressé pour les textures de hauteurs** | **0 ms sur le tick**, **−50 % de VRAM** : une tuile ≈ **0,75 Mo**, `cacheMax` 1 700 ⇒ **~1,3 Go**. Pour la photo : RGBA8 **48,0 Mio** / BC7 **12,0 (÷4)** / DXT1 **6,0 (÷8)**, extensions `bptc`/`rgtc`/`s3tc` présentes | `rapport-PF1.md` §④ ligne 8 ; `rapport-R16.md` §6 | ✅ `grep "KTX2\|CompressedTexture" src/` = **0** | les hauteurs terrarium **ne se compressent pas en lossy** (la mip corromprait les hauteurs). Côté photo, GIBS sert du **JPEG** : il faudrait un encodeur CPU par tuile (seconde perte) ou **héberger une pyramide KTX2/Basis**. R16 note que le levier gratuit est ailleurs : **plafond à 96 entrées = 24,0 Mio** | moyen — chantier de format, **zéro milliseconde** |
| **B5 · Reculer `PORTEE_CROP` (la calotte de mer)** | `portee = 3` = **9× la surface du socle** ; après le correctif MER, **~21,6 %** de la surface projetée est encore peinte (**111 670 / 517 270 px**) ; le champ 385² ne consacre que **~1/9** de ses texels au crop | `rapport-MER.md` §4 | ✅ `globe.js:4400` `uFondPortee: PORTEE_CROP` inchangé (D24 a rétréci la **géométrie**, `EMPRISE_MER_CROP = 1`, **pas** `portee`) | ⛔ **`portee` sert à TROIS choses** : cuisson du champ, normalisation `champ.unite`, et `profMaxCropM` — **c'est-à-dire la couleur du turquoise d'Adrien.** MER : *« c'est exactement la régression qu'il a déjà signalée une fois »* | **fort** |
| **B6 · Le 256/512 de la chaîne bathymétrique** | **−4,3 %** sur BT-1 et **−19 % de pente** à Virginia Beach — et ça vaut pour **EMODnet et GEBCO surzoomée, donc toute la carte**, pas seulement BlueTopo | `rapport-BT-N.md` §① et §⑦ (**qui réfute les −34 % de BT-I**) | ✅ `BATHY_TILE_PX` inchangé | **aucune des deux issues n'est gratuite** : cuire en 512 px = **+150 % d'octets ET BT-1 BAISSE à 0,667** (cuisson complète faite) ; sinon il faut changer l'interpolation avant fusion | fort |
| **B7 · Étendre la couverture BlueTopo** | z10 partout **≈ 92 Mo** · z12 littoral **≈ 273 Mo** · z13 littoral **≈ 959 Mo** — *« le z13 littoral entier double le `dist/` »* (968 Mo aujourd'hui) | `rapport-BT-I.md` §⑥ ; `plan-fusion.md` | ✅ non cuit | poids de déploiement (plafond dur Netlify) + **licence NCEI Puget à vérifier une fois**, comme Copernicus l'a été | **ce n'est pas de la perf d'image** |
| **B8 · Brancher `coast-mask.js` en VETO dans `fuseBathymetry`** | PLAT l'appelle **« LE VRAI VERROU, À FAIRE »** : à z11–z13 la règle d'échelle **ne mord pas** (rapport 8 à 16 contre un seuil de 32) et une tuile z12 **noyée à 100 % (262 144 / 262 144 px)** remplit le trou d'une z15 manquante | `rapport-PLAT.md` §⑥ point 2 | ✅ **VÉRIFIÉ** : `bathy.js:264` `fuseBathymetry` ne consulte aucun masque de côte ; `coast-mask.js` n'est importé que par `block-grid.js` (rendu) | *« c'est un chantier — pas une constante »*. ⛔ **La Camargue montre encore ses carrés** | moyen — **qualité, pas framerate** |

---

## ⑤ SUPPOSÉ — personne n'a mesuré. ⛔ Ne pas vendre comme un gain.

| piste | ce qui est dit | source | pourquoi « supposé » |
|---|---|---|---|
| **C1 · Annulation des requêtes EN VOL (`AbortController`)** | 24 % du temps de créneau (32 s / 135 s → 16 s / 156 s) ; 70–84 % des requêtes d'un geste arrivent après le geste | `rapport-PF2.md` §5, `rapport-PF1.md` §④ | ⛔ **CE N'EST PLUS « la dernière, risque moyen » : C'EST REFUSÉ PAR ÉCRIT DANS LE CODE.** `globe.js:8429` donne **deux** raisons — ① `fetchTile` n'a pas de `signal` parce que la promesse est **partagée par URL** entre tous les demandeurs (`_tileMemo` : l'abandon de l'un tuerait la tuile des autres) ; ② *« le gain est dans la file, pas dans le vol : le vol est plafonné à six (`MAX_CONCURRENT`), la file montait à 558 — annuler six requêtes ne rachète rien, vider la file rachète tout »*. **Et vider la file est FAIT** (`PLAFOND_FILE = 256`, `_purgerFile`, `_annuler`). La porte resterait `memo-tuiles-mnt.js` avec un compteur de demandeurs : **personne n'a mesuré ce que ça rend une fois la purge en place.** |
| **C2 · Barrière d'ordonnancement centre/périphérie (D22)** | — | `rapport-CIB.md` §4 | ⛔ **MESURÉE ET CONDAMNÉE, pas « faute de temps ».** Sur liaison bridée 1,5 Mb/s elle **DÉGRADE le centre** : retard **18,5 → 28,4 %** (Chamonix), **17,1 → 57,9 %** (Nice), netteté **21 249 → 40 464 ms**, cache max **580 → 543**. Occupation des créneaux inchangée (93,2 → 92,6 %). **Livrée débrayée** (`globe.js:4137` `this.barriereCible = false` ; rien en production ne l'allume, seuls `test/globe-cible.test.js` la lève). Piste ouverte à **une heure de banc** : le couplage `_porteuses` → cache souple → éviction |
| **C3 · Raffinement du crop (le crop est un carré cuit une fois)** | un texel du crop couvre **~15 pixels d'écran** | `inventaire-D16.md` §6 ; CHASSE bug 1 repris par `rapport-PLAT.md` §⑥ | ⛔ **CE N'EST PAS UN CORRECTIF DE BUG, C'EST UNE REFONTE, et il faut le dire comme tel.** `crop-sphere.js:308` prescrit `ZOOM_SOCLE` **plancher et plafond** dans toute l'emprise, **délibérément** : *« un crop dont le bord proche serait à z15 et le bord lointain à z13 est une affiche à deux résolutions, et le raccord se voit »*. Le rendre progressif, c'est réécrire le critère de refente du crop **et** son raccord de résolution. Aucun gain de framerate n'est chiffré ; c'est un poste de **netteté** |
| **C4 · Fusion des draws / atlas de textures de tuiles** | « un atlas irait plus loin » | `rapport-PF1.md` §④ ligne 2, fin de ligne | **aucun banc.** Et PF4 a déjà réfuté à moitié l'estimation voisine de PF1 (15–25 % annoncés → 9 % réels) |
| **C5 · SSE vraie (erreur d'espace-écran)** | — | `rapport-PF1.md` §④ ligne 4, re-réfutée `rapport-PF2.md` §4.9 | ⛔ **RÉFUTÉE : 0 ms gagné.** À densité 2 (h 1 440) le critère actuel `chord/dist > 0,38` rend **le même nombre de tuiles : 374 = 374** ; une vraie SSE chargerait **×2 sur Retina**. C'est un levier de **justesse**, pas de vitesse |
| **C6 · Second `EffectPass` sans `NoiseEffect`** | — | `rapport-PF3.md` §5 et §8.2 | ⛔ **RÉFUTÉ, mesuré** : **+0,005 ms (3,9 % d'une passe de 0,07–0,12 ms)**, au prix d'une compilation visible à la bascule |
| **C7 · Fondu parent → enfant au raffinement partiel** | — | `rapport-R37.md` §6 | **il n'y a pas de défaut à corriger** : couture médiane **p50 +0,6 / −0,1 / 0,0 / −1,1** niveaux. *« Il ne paierait rien de mesuré »* |
| **C8 · Rivières dans un Worker** | — | `rapport-RIV.md` §②-C | ⛔ **l'A/B borne l'écart imputable à +72 ms (z11) / +13 ms (z13).** *« La saccade appartient au globe »* |
| **C9 · Baisser `OSM_MIN_ZOOM`** | — | `map/water-layer.js:40-83` | ⛔ **PIÈGE CHIFFRÉ** : z12 et z10 → REFUS à **6 004–6 008 ms** ; baisser le plancher étendrait l'attente de 6 s à **tous** les zooms, et à z8 un pixel vaut 256 m — les ~50 000 ways rendraient **un aplat bleu**, pas des rivières |
| **C10 · Basculer de miroir Overpass** | `overpass.osm.ch` répond 4/4 en 0,13–0,33 s | `rapport-RIV-C.md` § miroirs | ⛔ **RECOMMANDATION EXPLICITE : NE PAS BASCULER.** Son corps fait **272 octets** — c'est un extrait **suisse** qui rend un **succès vide** sur Lyon ; or `if (feats)` est vrai pour un tableau vide ⇒ **il effacerait les rivières de repli**, en silence |
| **C11 · Fondu croisé du contenu à la naissance du crop** | claquement mesuré : **173 → 94** de luminance (**79 niveaux sur 255**) en une image | `rapport-R4.md` §5 et §8 étape 5 | R4 le classe lui-même comme **coût de rendu ajouté** : *« évaluer les deux apparences par fragment sur un nuanceur partagé par toutes les tuiles du globe. Ce n'est pas une étape, c'est une tâche »* — plus **sept interrupteurs frères** |
| **C12 · Analyse/peigne cuits par tuile, ou champ mondial (D15 partout)** | — | `rapport-R11.md` étape 3 | ⛔ **DEUX PISTES MORTES PAR ARITHMÉTIQUE, et c'est chiffré.** Piste A : **176 tuiles × 28,4 ms = 5,0 s de CPU** pour le seul niveau visible, **48 s** pour le cache — et `robustScale` divise par le p95 de **son propre champ**, donc l'intensité changerait à chaque bord de tuile **même avec une marge parfaite**. Piste B : **3,2 Go** à 1 000 m/texel, **51,4 Go** à 250 m |
| **C13 · Verre / transmission sur la sphère** | passe de scène en plus : **×3,87 au crop** (0,4119 → 1,5929 ms), **×4,78 en orbite** (0,4046 → 1,9319) | `rapport-R25.md` §③ | ⛔ **BORNÉ HORS DE LA SPHÈRE, et la raison tue l'échappatoire** : la passe est limitée par **la re-soumission du quadtree entier**, pas par les fragments — *« la cible demi-résolution que three alloue n'y changerait rien »* |
| **C14 · Les tuiles d'eau demandées à z8 quel que soit le niveau du bloc** | **3 332 requêtes = 63,6 %** du trafic d'une descente ; **1 585 (30,3 %)** partent quand le bloc fait 6 989–14 005 km ou n'existe pas ; une tuile z8 y occupe **< 15 px**. Le MNT légitime ne pèse que **492 requêtes (9,4 %)** | `inventaire-D16.md` §6 | ⚠️ **VÉRIFIÉ ENCORE VRAI** (`map/tile-loader.js` ne borne que le vol, `MAX_SIMULTANE = 24`) — mais **c'est du réseau, pas du temps d'image**, et **personne n'a mesuré ce que le supprimer rend en ms**. Je le range ici pour cette raison exacte |

---

## ⑥ LE CLASSEMENT — LES DIX À FAIRE EN PREMIER, gain mesuré ÷ risque

⚠️ **L'ORDRE EST UN RÉSULTAT, PAS UNE PRÉSENTATION.** Le chantier a déjà payé
la leçon inverse : **desserrer un budget avant d'avoir réduit l'emprise a donné
×14 sur les requêtes et un détail pire qu'avant.** Le classement ci-dessous
place donc **toute réduction d'emprise avant toute mesure de budget**, et il
refuse d'ouvrir le cache tant que l'emprise n'est pas bornée.

| # | quoi | gain mesuré | risque | pourquoi ce rang |
|---|---|---|---|---|
| **1** | **A1 — plafond de finesse par altitude** | **×6,5** (129,9 → 19,9 ms à ×4) ; **1 700 → 495 tuiles** ; à 130 km **44,10 → 11,90 ms** de rAF p50 | faible | ⚡ **Le plus gros chiffre du document, validé par Adrien, et c'est une RÉDUCTION D'EMPRISE** — donc l'ordre exige qu'elle passe avant tout le reste. ⛔ **Marquer « validé, en attente » : il attend qu'un agent libère `globe.js`** |
| **2** | **A3 — couper les tuiles hors crop de `demanderEmprise`** | 37 tuiles sur 52 | moyen | même famille que le n° 1 : **on réduit l'emprise**. R3 exige un budget de vérification visuelle — le prévoir, ne pas le sauter |
| **3** | **A5 — le `break` de `_tuileLaPlusFine`** | **+1 698 ms de fil principal à z6** | faible | fil principal pur, une ligne, chemin déjà trié à la source. Indépendant des deux premiers |
| **4** | **A2 — maillage étalé sous budget** | p99 **44 → 32 ms** à ×4 ; supprime les images à 121 tuiles bâties | moyen | **lissage de pointe**, c'est exactement ce qu'un « framerate » ressent. Le prix est connu et fini : **25 contrats de test** |
| **5** | **B2 — rendu à la demande, généralisé** | **13–24 ms → 0** au repos | moyen | ⚠️ **après le n° 1** : au repos avec un crop à 130 km on économiserait des images qui ne devraient déjà pas coûter 44 ms. Réduire d'abord, ne dessiner moins qu'ensuite |
| **6** | **B1 — l'UBO** | **`composer.render` −60 %** | fort | le second plus gros chiffre, mais **192 uniformes** et sept tâches récentes dessus : à faire quand `globe.js` est calme, pas pendant une vague |
| **7** | **A4 — zoom progressif à la naissance du crop** | dernier pic de flou à 100 % d'écran, ≈ 1 s | faible | coût quasi nul, **visible immédiatement** ; c'est une décision de produit à poser à Adrien en même temps que le n° 1 (les deux touchent `poserCrop`) |
| **8** | **B3 — la rotation propre** | **+14,7 ms/image** en orbite ×4 | moyen | ⛔ **arbitrage d'Adrien**, et ⚠️ **le chiffre doit être re-mesuré avant** : GE1 lit 0,000°/s. Débloque aussi la moitié du n° 5 |
| **9** | **C2 — reprendre la barrière D22 par le couplage `_porteuses`** | — (le seul couplage visible : cache max **580 → 543**) | faible | **une heure de banc, pas une réécriture** (CIB §7). Rang bas assumé : **la barrière telle quelle dégrade**, on n'allume rien avant d'avoir la mesure |
| **10** | **B8 — le veto `coast-mask` dans `fuseBathymetry`** | ferme les carrés z12 noyés à 100 % | moyen | ⛔ **ce n'est pas du framerate, c'est de la qualité** — mais c'est le dernier défaut nommé par Adrien qui reste entier, et PLAT l'appelle « le vrai verrou » |

⛔ **Ce que ce classement écarte volontairement, et pourquoi :** l'`AbortController`
(refusé par écrit dans le code, et son gain est déjà pris par la purge de file),
l'atlas et la SSE (aucun banc / réfutée à 0 ms), le second `EffectPass`
(+0,005 ms), le raffinement du crop (refonte, pas correctif), et `PORTEE_CROP`
(la régression de couleur qu'Adrien a déjà signalée une fois).

---

## ⑦ CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« Le 404 → AWS vaut 40 % des requêtes, c'est le gain facile du dossier. »**
   Faux, et je l'ai cru une demi-heure parce que le brief le portait et que
   `rapport-RIV.md` le classait rang 3. **Il est fait** (`globe.js:3425`) **et
   CIB en a mesuré le plafond réel : 7 à 21 requêtes par descente, 10–11 %.**
   Les 679 404 de PF2 sont bien réels ; **seuls ceux qui ont un ancêtre déjà
   troué sont rattrapables**, et c'est une poignée.

2. **« La barrière D22 est écrite, testée, il ne reste qu'à l'allumer — c'est
   un gain à une ligne. »** C'est ce que le commit `94928e5` (« la barriere
   livree DEBRAYEE ») m'a d'abord suggéré, et j'ai failli la mettre en tête du
   classement. **Elle est débrayée parce qu'elle DÉGRADE** : retard du centre
   17,1 → 57,9 % à Nice. **Une ligne qui empire les choses n'est pas un gain
   qui attend.**

3. **« Le crop à 130 km est fermé depuis D23. »** J'ai lu `regle-D23.md`
   (« crop à partir de z10 uniquement ») et j'ai cru la piste A1 morte.
   **`rapport-REV.md` §③ dit exactement l'inverse et je l'ai vérifié** : D23
   borne la **naissance** du crop, pas sa **vie** — D21 ① (`sortieArmee`,
   `monde/branchement-crop.js:996`) fait qu'un utilisateur qui incline ou use
   des boutons d'angle **emporte le crop aussi haut qu'il veut**. Les 1 700
   tuiles existent encore, relevées à 130 km avec `rAF p50 44,10 ms`.

4. **« Le gain des rivières (13,3 s) est le plus gros du dossier. »** C'est ce
   que `rapport-RIV.md` §③ met en rang 1. **RIV-C l'a réfuté en le mesurant
   après correction : du bruit dans les deux sens.** Ce qui garde le premier
   trait, c'est **l'arrivée du relief — 76 Mo, ~500 requêtes** — pas Overpass.
   ⚠️ **La leçon générale** : *l'attente mesurée n'est pas le gain du
   correctif qui la supprime, tant que personne n'a mesuré après.*

5. **« Le rendu à la demande n'existe pas dans le dépôt. »** À moitié faux :
   `cadence-repos.js` **le fait déjà en orbite** (1 image sur 2, 1 sur 30 si
   les animations sont coupées). Ce qui manque est la généralisation à la
   surface, et PF4 explique pourquoi elle n'est pas gratuite (mer, nuages et
   faune changent vraiment à chaque image).

6. **« `PLAFOND_FILE` n'a jamais été porté »** — c'est ce que dit une note de
   mémoire du projet (« porter purge+evict, PAS PLAFOND_FILE »). **Le code
   porte les trois** : `globe.js:914` `export const PLAFOND_FILE = 256`,
   `_purgerFile`, `_evictJusqua`. La note est périmée.

---

## ⑧ CE QUI N'EST PAS DANS MON PÉRIMÈTRE, ET QUE JE SIGNALE

- ⚠️ **Deux « coûts indiscernables de zéro » du chantier ne sont pas des
  mesures.** `lecons-campagne-R.md` §② : les bancs de coût mesuraient **le
  temps de soumission CPU**, pas le GPU créé ; *« un plancher à ±0,005 ms n'est
  pas un plancher sur le coût créé »*. Toute décision fondée sur un « ça ne
  coûte rien » de ce dossier est à re-poser sur un banc GPU.
- ⚠️ **`MER2` refuse d'annoncer le gain de sa propre coupe** (−86 % de
  triangles) : la passe mer est à **0,02 ms ± 0,08 avant et 0,02 ± 0,05 après**,
  donc **sous le bruit de la machine**. Le gain est à chercher **sur un bas
  palier** (`palier-machine.js`), où ce sont **89,9 % de sommets** qui
  disparaissent. **C'est une mesure à faire, pas un chiffre à republier.**
- ⚠️ **Le plancher de bruit de 8,97 / le « 59–61 % des pixels qui changent
  d'une image à l'autre » (MIX §①) n'est toujours pas expliqué**, à tous les
  paliers, y compris au repos complet. Tant qu'il vit, **tout instrument de
  pixels de ce dossier est saturé par lui.**
- ⚠️ **`_tileMemo` est partagé globe / damier** (R3 réserve 2, borne 32 Mo /
  128 entrées, 116 URL distinctes mesurées sous `?terre=unique`). Toute
  optimisation de cache doit être pensée pour les deux consommateurs.

---

## ⑨ PREUVES DE FIN

```
git diff -- src/          → vide
npm test                  → tests 4899 · pass 4899 · fail 0
npm run audit:tests       → 263 listés · 263 sur disque · Aucun écart
```

Ce rapport a été ajouté par `git add -f` (le dossier est git-ignoré).
