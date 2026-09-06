# RAPPORT EA1 — L'ÉCHELLE ADAPTATIVE AU MOUVEMENT : étude, mesure, applicabilité

Étude externe + mesure interne, lecture seule dans `C:\Dev\wt-ea1` (branche
`recherche-echelle-adaptative`). **`git diff -- src/` vide** — vérifié au
début et à la fin de la session, aucune ligne de `src/` touchée. Écrit après
lecture de `rapport-PB.md`, `rapport-PF1.md`, `rapport-FLU.md`,
`rapport-CN2.md`, `rapport-TUILE.md`, `rapport-INV3.md`, `regle-D20.md`, de
`src/accalmie-gouverneur.js`, `src/palier-machine.js`, `src/perf.js`,
`src/boot-gate.js`, `src/boot.js`, `src/modes.js`, `src/main.js`,
`src/viewport.js`, et de la compétence `/threejs-optimisation`.

⚠️ **Trois niveaux de preuve** distingués partout : **[É]** documenté par
l'éditeur · **[T]** mesuré/rapporté par un tiers identifiable · **[F]**
folklore de forum, non reproduit. Aucun chiffre n'est inventé ; là où je n'ai
pas de mesure, je l'écris.

⛔ **`rapport-PA.md`, cité par le brief, n'existe pas dans cet arbre** —
recherché par nom exact et par le contenu cité (« 2,1 ms/mégapixel »,
« 97–99 % ») dans tout `.superpowers/sdd/2026-08-22-globe-studio/` : aucune
occurrence. Les données les plus proches des citations viennent de
`rapport-PF1.md` (GPU p50 0,21 à 2,71 ms sur RTX 3080, budget d'image décomposé
par poste) et `rapport-R20.md` (minuterie GPU : ×16 de fragments ⇒ ×8,2 de
temps). Je m'appuie sur PF1/R20/FLU comme le fond réel derrière la citation, et
j'ai **remesuré moi-même** aujourd'hui (§②) avec le même banc pour vérifier que
rien n'a bougé depuis.

---

## ⚡ VERDICT EN HUIT LIGNES

1. **La distinction cadence/mouvement tient — vérifiée, pas supposée.** Le
   piège d'hier (`accalmie-gouverneur.js`, `perf.js`) écoute la **cadence
   CPU**, un signal réactif et déjà borné par un delta plafonné : il confond
   une rafale d'arrivée avec un problème de rendu. Un signal de **vitesse de
   caméra** est différent par construction : il ne dépend ni du réseau ni du
   décodage, et il est disponible **avant** le ralentissement.
2. ⚡ **Mais cette distinction répond à une question DIFFÉRENTE de « l'échelle
   aide-t-elle ? ».** Le signal (cadence vs mouvement) ne change que la
   PRÉDICTIVITÉ et l'immunité aux rafales CPU. Il ne change RIEN au fait qu'une
   échelle de rendu (résolution des pixels) n'a d'effet que si le goulot **est
   le GPU** — et ça, c'est une question de matériel et de scène, pas de
   signal. J'ai failli les confondre (§ « ce que j'ai cru puis réfuté »).
3. **Aucun signal de vitesse de rotation/glissé n'existe aujourd'hui.**
   `modes.js` porte `_zoomVel` (élan de zoom, log-space, `ZOOM_TAU = 1,2 s`) —
   rien pour la rotation orbitale ni le panoramique. C'est à écrire, et c'est
   la brique n° 1 de tout le reste.
4. **Remesuré aujourd'hui (RTX 3080, banc PF1 inchangé)** : sur cette carte,
   le GPU vaut **12 à 46 % du tick en mouvement**, jamais la majorité — le CPU
   reste toujours devant, y compris pendant l'orbite et le glissé de surface.
   Une échelle de rendu aiderait donc, mais **modestement**, sur ce matériel.
5. **La descente (chargement de tuiles) n'a AUCUNE composante GPU dans ses
   pics.** `rapport-FLU.md` : la tâche de 2 478 ms à ×4 est `terrain.rebuild`
   — échantillonnage de hauteurs et maillage sur 591 361 sommets, sur le fil
   principal JS. Une échelle de rendu n'y changerait **rien** : c'est
   exactement l'hypothèse du brief, confirmée par deux mesures indépendantes.
6. **Le vrai goulot mobile n'a jamais été mesuré dans ce dépôt.** Balayage de
   tous les scripts de `scripts/*.mjs` qui posent `Emulation.setDeviceMetricsOverride` :
   **`mobile: false` partout, sans exception**, dans toute la campagne.
7. ⚡ **Et « mobile » est déjà une décision produit, pas un oubli** :
   `src/boot-gate.js` **bloque l'éditeur complet sur téléphone** (message
   « These maps need room to breathe »). Seul un **lien partagé en lecture
   seule** boot sur téléphone — vérifié en émulant un Pixel 8 dans mon
   navigateur d'agent. Sur ce seul chemin mobile réel, un téléphone « fort »
   (Adreno 7xx/8xx, Apple A15+) reçoit **palier 0, PLEINE QUALITÉ** — densité
   ×2, DOF, ombres dynamiques — sans qu'aucun mécanisme ne voie la dérive
   thermique (15 à 50 % de perte de fréquence GPU après 2 à 5 min [T]).
8. **`applyRenderSize` réalloue le tampon de dessin et le compositeur à
   CHAQUE appel** (`renderer.setSize` + `composer.setSize`,
   `src/viewport.js:282`) : une échelle qui suit le mouvement **image par
   image** paierait cette réallocation à chaque frame. À limiter en fréquence,
   et un bug historique (iOS Safari, fuite mémoire au redimensionnement
   répété du canevas WebGL, corrigé en iOS 14.3) montre que ce geste précis a
   un passif documenté sur mobile.

---

## ① LA DISTINCTION CADENCE / MOUVEMENT — vérifiée sur le code

### Ce qui a été rejeté hier, et pourquoi

`src/accalmie-gouverneur.js` documente le piège en tête : pendant une rafale
d'arrivée (décodage, compilation de nuanceurs), `perf.js` a mesuré des
cadences de **10 · 5 · 2 · 1 · 5 · 6 · 3 i/s** sur neuf secondes — pas un
problème de rendu, un problème de CPU occupé ailleurs. `perf.js` lui-même
raconte en tête un deuxième piège, plus profond : le delta d'horloge passé au
gouverneur était **déjà plafonné à 50 ms** pour la simulation (bateaux), donc
3 i/s et 20 i/s produisaient le même nombre — le gouverneur était **sourd par
construction**. Les deux bugs sont corrigés (`ACCALMIE_ARRIVEE_MS`, `dtBrut`),
mais la leçon reste : **un système qui écoute la cadence CPU brute confond un
ralentissement de RENDU avec un ralentissement d'AILLEURS.**

### Ce qu'Adrien propose, et en quoi c'est un signal différent — vérifié

- **Aucune dépendance au réseau/décodage** : une vitesse de caméra se calcule
  à partir de deux poses consécutives (`camera.position`, angle), pas de
  l'état du chargement. `src/poursuite.js:886` (`vitesseCameraKmh(camA, camB,
  dt, ctx)`) est un précédent EXACT de ce calcul dans ce dépôt, pour la caméra
  de poursuite en mode course — la brique existe déjà comme motif, ailleurs.
- **Disponible avant le ralentissement** : une accélération de la molette ou
  du glissé se lit à l'image même où l'utilisateur agit, avant qu'aucune tuile
  n'ait eu le temps d'arriver ou qu'aucun nuanceur n'ait eu le temps de
  compiler. C'est structurellement prédictif, la cadence est structurellement
  un constat après coup.
- **Un élan existe déjà, mais seulement pour le zoom** : `modes.js` porte
  `_zoomVel` (ligne 430, élan inertiel en espace logarithmique, `ZOOM_TAU =
  1,2 s`, alimenté par la molette L912). **Aucune vitesse de rotation
  orbitale ni de panoramique n'est calculée nulle part** — vérifié par
  recherche exhaustive (`grep -n "azimuth\|panVel\|rotateSpeed\|angularVel"`
  dans `modes.js` et `main.js`) : `OrbitControls` a son propre
  `dampingFactor` interne, jamais lu par l'application pour en dériver une
  vitesse.

**Verdict : la distinction tient.** Ce n'est pas une reformulation du système
rejeté hier — c'est un signal d'entrée différent, disponible plus tôt, non
sujet au même piège. Mais (point ⚡ du verdict) **cela ne dit encore rien de
si l'échelle aide** — c'est la question du §②.

---

## ② LE PARTAGE GPU / CPU, PAR SCÈNE — remesuré aujourd'hui

### Méthode

Remesuré avec **le banc existant, inchangé** : `scripts/profil-pf1.mjs`
(`EXT_disjoint_timer_query_webgl2`, témoin de validité ×4 rendus ⇒ ×N de
temps, 40 images de chauffe jetées, ≥ 60 images consécutives). Serveur `vite
--host 127.0.0.1 --port 6231` (le premier essai sans `--host` s'est lié en
IPv6 seul, `[::1]`, invisible depuis `127.0.0.1` — piège d'environnement, pas
de produit). Machine : **ANGLE, NVIDIA GeForce RTX 3080, D3D11** — la même
carte forte que PF1, donc **directement comparable**. Commande :

    node scripts/profil-pf1.mjs --port 6231 --machines x4,x6r --postes surface,crop,orbite --sortie .banc/EA1-pf1-frais.json

### Résultat — tick CPU vs GPU, part du GPU dans le tick (×4, témoin valide)

| scène | phase | tick CPU p50 (ms) | GPU p50 (ms) | **part GPU** |
|---|---|---:|---:|---:|
| orbite | au repos (FIGÉ) | 1,20 | 0,98 | 82 % (mais 1,2 ms au total — non pertinent : rien n'est « lent » ici) |
| **orbite** | **MOUVEMENT** (rotation programmée, proxy du glissé) | 4,20 | 1,06 | **25 %** |
| **surface hors-crop** | **MOUVEMENT** (translation programmée) | 10,90 | 5,01 | **46 %** |
| **crop** | **MOUVEMENT** | 4,50 | 1,12 | **25 %** |
| surface hors-crop | au repos (FIGÉ) | 10,60 | 2,67 | 25 % |
| crop | au repos (FIGÉ) | 4,20 | 0,78 | 19 % |

⚠️ **Les cellules x6r crop et x6r orbite ont un témoin GPU invalide** (×2,45 à
×2,49 au lieu de ≥ 2,5 requis) — sous fort ralentissement CPU la requête
`TIME_ELAPSED` englobe des attentes, ce que PF1 documentait déjà. Je ne les
publie pas comme fiables ; seule la colonne x4, dont les trois postes ont un
témoin valide (×3,87 à ×5,14), est citée ci-dessus.

⚠️ **« MOUVEMENT » ici est une rotation/translation PROGRAMMÉE** (0,25°/image
en orbite, 0,3 % de la distance/image en surface — le protocole de PF1), pas
un vrai glissé de souris humain. C'est un proxy raisonnable pour le coût GPU
(même nombre de tuiles visibles, même remplissage), mais pas pour le coût CPU
du geste lui-même (`OrbitControls`, `projectionSaisie`), que ce banc ne mesure
pas séparément.

### Ce que ça dit

**Le GPU monte pendant le mouvement (25 → 46 % du tick contre 19 → 25 % au
repos), mais ne dépasse jamais le CPU.** Sur cette carte forte, une échelle de
rendu asservie au mouvement gagnerait donc quelque chose — l'ordre de
grandeur est de **2 à 5 ms sur un tick de 4 à 11 ms**, pas une division par
deux du temps total.

### La descente — aucune composante GPU dans ce qui est lent

`rapport-FLU.md` (remesuré le 2026-09-05, même campagne) : la plus longue
tâche d'une descente à ×4 vaut **2 478 ms avant correctif, 660 ms après** —
entièrement dans `terrain.rebuild` (échantillonnage procédural puis
`remplirHauteurs`/`sampleHeights` sur 591 361 sommets, `gridNormals`,
`plinth.rebuild`), sur le **fil principal JS**, zéro composante de rendu GPU.
`rapport-PF1.md` le confirmait déjà : « ces tâches longues ne sont pas le
globe, ce sont les rechargements du bloc ». **Une échelle de rendu, pilotée
par n'importe quel signal (cadence ou mouvement), n'a aucune prise sur ce
poste** — ce n'est pas un problème de pixels, c'est un problème
d'échantillonnage et de maillage CPU.

### Réponse à la question du brief, chiffrée

| scène | goulot | l'échelle aide-t-elle ? |
|---|---|---|
| orbite (rotation/glissé) | CPU dominant (75 %), GPU 25 % du tick | **un peu** — 1 ms sur 4 |
| surface hors-crop (glissé) | CPU dominant (54 %), GPU 46 % du tick | **le plus, des quatre** — 5 ms sur 11 |
| crop (glissé/zoom) | CPU dominant (75 %), GPU 25 % du tick | **un peu** — 1 ms sur 4,5 |
| **descente (chargement)** | **100 % CPU**, 0 ms de GPU mesurable dans les pics | **non — aucun effet** |

---

## ③ L'ÉTUDE EXTERNE — sourcée, [É]/[T]/[F] distingués

### Résolution dynamique classique (consoles/moteurs) — toujours RÉACTIVE, jamais au mouvement

- **Unreal Engine, `r.DynamicRes`** [É] *Dynamic Resolution in Unreal Engine*
  (https://dev.epicgames.com/documentation/unreal-engine/dynamic-resolution-in-unreal-engine) :
  « adjusts the primary screen percentage according to the previous frames'
  GPU workload » — mesure le **temps GPU réel**, jamais la cadence CPU.
  `r.DynamicRes.MaxConsecutiveOverbudgetGPUFrameCount` : un « interrupteur de
  panique » après N images consécutives hors budget (2 dans l'exemple de la
  doc) fait chuter la résolution immédiatement. Aucun chiffre public sur la
  vitesse exacte de remontée.
- **Unity, `ScalableBufferManager` / `DynamicResolutionHandler`** [É]
  (https://docs.unity.cn/6000.0/Documentation/Manual/DynamicResolution-control.html,
  code source `DynamicResolutionSample`) : pilote par `FrameTimingManager`
  (temps CPU **et** GPU mesurés séparément), applique le nouveau facteur
  d'échelle via `ScalableBufferManager.ResizeBuffers()`. Unity ne fournit pas
  la logique de décision — chaque jeu écrit la sienne (confirmé aussi par
  `rapport-PB.md`).
- **PS4 Pro, checkerboard rendering** [T] Engadget, interview Mark Cerny,
  **2016-10-20** (https://www.engadget.com/2016-10-20-ps4-pro-mark-cerny-interview-hardware.html) :
  reconstruction spatiale, pas une échelle de rendu au sens de notre étude.
  Certains titres (Battlefield 1, CoD Infinite Warfare [T], Beebom
  https://beebom.com/what-is-checkerboard-rendering/) combinent checkerboard
  **et** résolution dynamique, mais **aucune source consultée ne documente le
  déclencheur exact** (temps GPU vraisemblable par analogie avec Unreal/Unity,
  non confirmé pour PS4 spécifiquement).
- **Xbox, Halo 5 / CoD Advanced Warfare** [T] — dynamic resolution scaling
  confirmé par la presse technique, mais **aucun GDC talk public retrouvé**
  détaillant le mécanisme de décision. Je ne l'invente pas.
- **id Tech 5 (Rage)** [T] PC Gamer, GamingBolt — texture/LOD **liés à la
  RAM et à la bande passante disponibles**, pas à la vitesse de caméra. Piste
  proche mais **sur un axe différent** (ressource matérielle statique, pas
  mouvement).

➡️ **Aucun système documenté par un éditeur de premier rang ne pilote la
résolution sur la vitesse de la caméra.** Tous les systèmes de résolution
dynamique retrouvés sont réactifs au temps GPU mesuré — exactement la nuance
que `rapport-PB.md` avait déjà posée (« à ne brancher que sur une mesure GPU,
jamais sur la cadence »). La proposition d'Adrien (piloter sur le
**mouvement**, pas sur le temps GPU) est donc **une troisième voie**, ni celle
d'hier (cadence CPU) ni celle des consoles (temps GPU réactif) : un signal
**prédictif**, que je n'ai trouvé documenté nulle part sous cette forme
exacte pour la résolution d'écran.

### Scaling prédictif / basé sur le mouvement — ce qui existe vraiment

- **VR — Asynchronous Spacewarp (ASW)** [É] Meta
  (https://developers.meta.com/horizon/documentation/native/pc/asynchronous-spacewarp/) :
  extrapole une image intermédiaire à partir du flux optique et de la
  translation caméra/tête — **prédictif**, mais c'est de l'interpolation
  d'images, pas une échelle de résolution. Inapplicable ici tel quel (pas de
  compositeur temporel de ce type), mais confirme que « prédire depuis le
  mouvement plutôt que réagir à un symptôme » est un principe reconnu dans un
  domaine voisin.
- **Foveated rendering** — écarté comme le brief le prévoyait : pas de suivi
  oculaire disponible dans un navigateur.
- **LOD géométrique lié à la vitesse, en VR** [T] Petrescu, Warren, Montazeri,
  Pettifer, *Velocity-Based LOD Reduction in Virtual Reality: A Psychometric
  Approach*, arXiv 2301.09394, **soumis 2023-01-23**
  (https://arxiv.org/abs/2301.09394) : étude psychophysique, 17 participants,
  LOD réduit en fonction de la vitesse de **rotation de la tête**. Résultat
  chiffré : « participants accepted an approximately four-fold LOD reduction
  even in the low maximum velocity condition without a significant impact on
  perceived quality », et la tolérance monte encore à haute vitesse. **C'est
  la source la plus solide trouvée pour le principe général** (le mouvement
  masque la perte de détail), mais ⚠️ **le contexte ne se transpose pas
  directement** : casque VR (vestibulo-oculaire, immersion totale), pas un
  écran d'ordinateur en vue orbitale. Le principe (mouvement → tolérance ↑)
  est probablement vrai ici aussi mais dans une mesure moindre et non
  quantifiée pour notre cas.
- **Motion blur masquant une résolution réduite** — principe cité dans la
  littérature brevets (variable rate shading + motion blur, [T] mention
  générale, sans banc reproductible trouvé) et dans des discussions de
  développeurs [F, GameDev.net, non chiffré]. **Je n'ai pas trouvé de source
  de premier rang qui chiffre ce masquage pour de la RÉSOLUTION** (par
  opposition au shading rate) — à traiter comme un principe plausible, non
  comme un fait mesuré.
- **LOD lié à la vitesse dans les jeux de course/monde ouvert** — recherché
  spécifiquement (requêtes sur le LOD bias et la vitesse du véhicule) :
  **aucune source publique solide retrouvée** documentant ce mécanisme nommé
  et chiffré. Un mod communautaire (Need for Speed Rivals) augmente la
  distance de LOD mais sans lien décrit à la vitesse. Je ne l'invente pas :
  **piste non confirmée par la recherche externe**, à ne pas citer comme
  précédent établi.

### LOD de maillage adaptatif à la vitesse — et le piège local à ne pas rejouer

Aucun mécanisme externe nommé et chiffré n'a été trouvé pour « LOD qui baisse
temporairement pendant un mouvement rapide puis remonte, sans popping
visible » en dehors du principe VR ci-dessus. **En interne, en revanche, deux
rapports très récents (`rapport-CN2.md`, `rapport-TUILE.md`) documentent
EXACTEMENT le risque inverse** : un mécanisme qui retient le maillage à un
niveau plus grossier pendant une transition a produit **500 à 788 reculs de
finesse visibles** sur un crop déjà net, avant d'être retiré. `TUILE` : « le
défaut se voit au CHANGEMENT D'ÉCHELLE, et nulle part ailleurs ». **Toute
proposition de LOD qui baisse pendant le mouvement rejoue structurellement ce
risque** si elle n'est pas bornée à ne jamais descendre sous ce qui est
**déjà affiché** — c'est un contrat plus dur qu'il n'y paraît, et la
campagne CN2/TUILE montre qu'il a fallu plusieurs mesures et plusieurs
itérations pour l'obtenir correctement une seule fois, sur un mécanisme
voisin.

### Mobile — spécifiquement

- **`devicePixelRatio` mobile** [T, consensus de pratique, plusieurs sources
  convergentes — Codrops, IGC, forums three.js] : 2 à 3 sur les téléphones
  récents (Pixel 6 : 2,6 ; iPhone Plus/Pro Max : 3 côté CSS). Pratique
  courante : plafonner à 1,5–2. **Notre `palier-machine.js` le fait déjà**
  (`densiteMax` 0,85 à 2 selon palier, `PLANCHER_DENSITE = 0,5`).
- **Le coût quadratique de la densité** : `budgetMpx` de `palier-machine.js`
  et `PLAFOND_MPX` de `viewport.js` existent précisément pour ça. Sur le poste
  x6r (densité 2, CPU ×6) remesuré aujourd'hui, le GPU `PasseFond` seul monte
  déjà à 7,16 ms (surface, ANIMÉ) contre 2,51 ms à densité 1 — proche du
  facteur 4 attendu (2,1 ms/mégapixel × ratio² serait le calcul si le
  rapport-PA existait ; ici c'est une mesure directe, cohérente avec la loi
  physique).
- **Starvation thermique** [T, agrégé sur plusieurs sources techniques] : un
  téléphone haut de gamme tient sa fréquence GPU maximale **2 à 5 minutes**
  avant le premier palier de réduction thermique ; un appareil d'entrée de
  gamme, **60 à 90 secondes**. Impact rapporté : **15 à 50 % de perte de
  cadence** en usage prolongé. **Aucun mécanisme de ce dépôt ne voit cette
  dérive** : `palier-machine.js` classe une fois, avant le premier rendu (et
  un Adreno 7xx/8xx ou un Apple A15+ est classé **`fort`**, donc palier 0) ;
  `perf.js` ne réagit qu'à une cadence FPS déjà dégradée, avec 2,5 s
  d'hystérésis avant de bouger.
- **`WebGL2` sur mobile** : couverture large (Chrome/Firefox/Edge/Safari
  iOS+macOS+iPadOS) [T, testmuai.com, à recouper]. Pas de blocage technique
  identifié pour notre usage.
- **Fuite mémoire iOS Safari au redimensionnement du canevas WebGL** [T]
  WebKit bug **#219780** (https://bugs.webkit.org/show_bug.cgi?id=219780) et
  forum développeur Apple
  (https://developer.apple.com/forums/thread/668999) : redimensionner un
  canevas WebGL **on-screen** en boucle (reproduction : toutes les ~1 s) fait
  fuir la mémoire jusqu'au crash de l'onglet sur **iOS 14.2 et antérieur** ;
  **corrigé en iOS 14.3**. ⚠️ **Directement pertinent ici** : `applyRenderSize`
  (`src/viewport.js:282`) appelle `renderer.setSize()` (qui redimensionne le
  canevas) à **chaque** appel, et une échelle asservie au mouvement image par
  image ferait exactement le geste qui a déclenché ce bug. Le correctif date
  de fin 2020 ; je n'ai pas de moyen de vérifier ici s'il existe une
  régression sur iOS récent — à tester avant de shipper un appel fréquent.
- **`gl.setPixelRatio`/`setSize` en continu, avis de la communauté three.js**
  [F/T mixte] Discourse *Changing pixelRatio based on fps, good or bad idea?*
  (https://discourse.threejs.org/t/changing-pixelratio-based-on-fps-good-or-bad-idea/34563) :
  un contributeur expérimenté (`usnul`) déconseille l'ajustement continu «
  changing resolution is not always free » (réallocation des cibles de
  rendu), recommande de mesurer 20+ images avant toute décision (exactement
  la règle des pièges communs de ce chantier), et signale des images noires
  aléatoires au changement de ratio rapporté par l'auteur du fil. Ce n'est pas
  une source de premier rang, mais elle converge avec le fait mesuré au-dessus
  (`applyRenderSize` réalloue le tampon à chaque appel).
- **FSR/DLSS (upscaling temporel) en WebGL2** [T] — porter FSR2
  (https://juandiegomontoya.github.io/porting_fsr2.html) s'appuie sur des
  primitives de shaders de calcul/liaisons étendues ; **aucune source
  consultée ne documente une implémentation WebGL2**, et le fil three.js sur
  l'upscaling temporel (https://discourse.threejs.org/t/temporal-upscaling-webgpu/89989)
  cible explicitement **WebGPU**, pas WebGL2. **Inapplicable à ce produit
  tel quel** (WebGL2, pas WebGPU — cohérent avec le refus déjà posé par
  `rapport-PB.md` pour une migration WebGPU, jugée à risque et sans gain
  démontré ici).

---

## ④ LE TABLEAU D'APPLICABILITÉ — ancré dans notre code

| technique | signal utilisé | où dans notre code | gain attendu (chiffré §②/FLU) | risque |
|---|---|---|---|---|
| **Signal de vitesse de rotation/panoramique** | delta d'angle/position caméra ÷ dt | **N'EXISTE PAS** — seul `_zoomVel` (`modes.js:430`, molette) existe ; `vitesseCameraKmh` (`poursuite.js:886`) est un précédent de calcul réutilisable | 0 ms direct — c'est la BRIQUE qui rend tout le reste possible | faible : pur, testable sans GPU, sur le modèle de `palier-machine.js` |
| **Échelle de rendu (pixelRatio) pilotée par le mouvement** | le signal ci-dessus | `params.pixelRatio` (`main.js:619`), `applyRenderSize` (`viewport.js:282`, appelé `main.js:1230` et au `resize` `main.js:16185`) | **orbite/glissé : 1 à 5 ms sur un tick de 4 à 11 ms (25–46 % du tick, mesuré §②)** ; **descente : 0 ms (FLU/PF1, 100 % CPU)** | moyen : `applyRenderSize` réalloue `renderer.setSize` + `composer.setSize` à CHAQUE appel — nécessite un débit limité (throttle), pas un appel par image ; passif documenté sur iOS Safari (redimensionnement répété du canevas) |
| **LOD de maillage temporaire pendant le mouvement** | idem | quadtree (`globe.js`, `_traverse`), raffinement partiel R37 (`_dessinerPartiel`), palier CN2/TUILE (`_zCropServi` = `_zCropCible` depuis TUILE) | non chiffrable sans l'écrire ; le principe VR [T, arXiv 2301.09394] suggère une tolérance ×4 en rotation rapide, non transposé | **ÉLEVÉ** : CN2/TUILE ont mesuré 500 à 788 reculs de finesse visibles sur un mécanisme voisin (palier retardant le niveau servi) avant de le retirer entièrement. Toute nouvelle dégradation temporaire du maillage rejoue ce risque si elle peut descendre sous ce qui est déjà affiché |
| **Réduction du budget DOF/ombres/grain pendant le mouvement** | idem | `PALIERS` (`palier-machine.js`), `perf.js` (T1-T3) | non mesuré | **ÉLEVÉ, et probablement à écarter** : `regle-D20.md` documente une décision produit explicite d'Adrien — le flou de profondeur de champ doit être **actif à tous les zooms**, avec un flou apparent constant ; l'éteindre ou le réduire pendant le mouvement contredit cette règle sauf accord explicite |
| **Palier machine statique (existant)** | GPU/écran/cœurs, une fois au démarrage | `src/palier-machine.js` (NE PAS REMPLACER) | déjà en place ; ne voit jamais une dérive EN COURS DE SESSION (thermique, fenêtre agrandie) | — |
| **Gouverneur réactif (existant)** | cadence CPU, `perf.js` | déjà en place, corrigé (`dtBrut`, `accalmie-gouverneur.js`) | déjà en place ; réagit **après** la chute, avec 2,5 s d'hystérésis | — |
| **Mobile : lever le portail téléphone** | `isPhone` (`boot.js:22`, `coarse && shortSide < 600`) | `src/boot-gate.js:30` | **hors périmètre de l'échelle adaptative**, mais c'est le plus gros levier mobile potentiel — décision produit à trancher avec Adrien, pas un correctif technique | — (décision produit) |
| **Mobile : voir la dérive thermique** | fréquence GPU en cours de session (pas de signal existant) | rien aujourd'hui | pourrait combler l'angle mort entre `palier-machine.js` (une fois, au boot) et `perf.js` (réactif, après coup) | moyen : pas de mesure directe de fréquence GPU accessible depuis WebGL2 ; à approximer par une dérive de la cadence propre, en respectant la même prudence que `perf.js` |

---

## ⑤ CE QUI EST SÉDUISANT ET QU'IL NE FAUT PAS FAIRE ICI

1. **Baisser l'échelle de rendu PENDANT la descente (chargement de tuiles).**
   Séduisant parce que « ça rame en descendant » est exactement le symptôme
   qu'Adrien décrit. Mesuré deux fois (FLU, PF1) : la descente est **100 %
   CPU** (échantillonnage, maillage sur le fil principal), 0 ms de composante
   GPU dans les pics. Toucher la résolution n'y changerait rien — le geste
   viserait le mauvais poste.
2. **Un LOD de maillage qui recule visiblement pendant le mouvement.**
   Séduisant (« moins de triangles pendant qu'on bouge »), mais c'est
   très exactement la classe de bug que `rapport-CN2.md` et `rapport-TUILE.md`
   viennent de passer une campagne entière à éliminer (500 à 788 reculs de
   finesse mesurés sur un crop déjà net). Toute variante qui peut descendre
   sous ce qui est déjà affiché rejoue ce piège.
3. **Un upscaling temporel façon FSR/DLSS en WebGL2.** Aucune implémentation
   publique documentée sur WebGL2 (les portages retrouvés ciblent
   OpenGL/Vulkan avec compute shaders, ou WebGPU pour l'écosystème three.js).
   Cohérent avec le refus déjà posé par `rapport-PB.md` pour une migration
   WebGPU entière : risque élevé, gain non démontré sur ce produit.
4. **Rendre `pixelRatio` dynamique à chaque image sans limiter la
   fréquence.** `applyRenderSize` réalloue le tampon de dessin et le
   compositeur à chaque appel (`viewport.js:282`) — un appel par image serait
   un `setSize`/`composer.setSize` par image. Un avis de la communauté
   three.js le déconseille explicitement pour cette raison, et un bug
   historique documenté (WebKit #219780, iOS ≤ 14.2) montre que le
   redimensionnement répété d'un canevas WebGL a un passif réel sur mobile,
   même s'il est corrigé depuis 2020.
5. **Couper ou réduire la profondeur de champ pendant le mouvement.**
   Contredit `regle-D20.md` : Adrien a explicitement demandé un flou actif
   « à tous les zooms », avec un flou apparent constant — c'est l'exception
   nommée à la règle « les effets n'apparaissent qu'en mode crop ». Y toucher
   sans lui demander reviendrait sur une décision déjà prise et documentée.
6. **Extrapoler « le GPU intégré/mobile se comporte comme le RTX 3080 ».**
   Sur cette carte forte, le GPU ne dépasse jamais 46 % du tick, même en
   mouvement (§②). `rapport-PF1.md` a mesuré qu'un **GPU logiciel** (le seul
   cas où le GPU domine vraiment, 85–89 % du temps) est un régime totalement
   différent. Sans mesure sur un vrai palier faible/mobile (Iris Xe, Adreno
   moyen), le gain à attendre côté desktop reste dans l'ordre du 1 à 5 ms
   mesuré ici, pas d'un facteur spectaculaire.
7. **Citer un mécanisme « LOD lié à la vitesse dans les jeux de course »
   comme précédent établi.** Recherché spécifiquement, aucune source solide
   trouvée. Le principe est plausible par analogie avec la VR (arXiv
   2301.09394), mais je ne l'ai pas trouvé documenté et chiffré pour ce cas
   d'usage précis — je ne l'invente pas.

---

## ⑥ LE CLASSEMENT — gain ÷ risque, desktop et mobile séparés

### Desktop

1. **Écrire le signal de vitesse de caméra (rotation + panoramique)** —
   gain nul en soi, mais condition de tout le reste ; pur, testable sans GPU,
   même famille que `palier-machine.js`/`poursuite.js`. **Risque faible. À
   faire en premier.**
2. **Piloter `pixelRatio` par ce signal, en orbite et au glissé de
   surface** — gain mesuré 1 à 5 ms sur un tick de 4 à 11 ms (25–46 %),
   **jamais** en descente (0 ms, à exclure explicitement du déclencheur).
   Débattre un throttle (ne pas appeler `applyRenderSize` plus souvent que,
   disons, une fois toutes les quelques images) pour éviter le coût de
   réallocation à chaque frame. **Risque moyen**, gain réel mais modeste sur
   une carte forte — potentiellement plus grand sur un GPU intégré, non
   mesuré ici faute de la machine.
3. **Ne rien faire sur la descente avec ce mécanisme** — le classer
   explicitement hors périmètre pour ne pas rouvrir le débat plus tard : le
   bon chantier pour la descente est celui que FLU a déjà commencé (le
   maillage/l'échantillonnage CPU), pas l'échelle de rendu.
4. **LOD de maillage lié à la vitesse** — seulement si mesuré avec le
   **même protocole que TUILE** (cache chaud, changement d'échelle, latence
   réseau simulée) pour prouver l'absence de tout recul visible sous ce qui
   est déjà affiché. **Risque élevé**, à instruire en dernier et avec le
   luxe de temps que CN2/TUILE ont eu.

### Mobile

1. **Le plus gros gain potentiel n'est PAS l'échelle adaptative : c'est de
   mesurer enfin le mobile.** Aucun banc de ce dépôt n'a jamais émulé
   `mobile: true` — vérifié. Avant d'optimiser un mécanisme, savoir ce qui
   rame vraiment sur un vrai téléphone (thermique ? réseau ? poids ?) manque
   entièrement.
2. **Le périmètre mobile réel aujourd'hui est étroit** : l'éditeur complet
   est bloqué sur téléphone (`boot-gate.js`), seul le lien partagé en lecture
   seule boot. Sur ce seul chemin, un téléphone classé « fort » reçoit palier
   0 (densité ×2, DOF, ombres dynamiques) sans garde-fou pour la dérive
   thermique. **C'est potentiellement le terrain le plus favorable à un
   signal prédictif** (la dérive thermique est progressive, un signal de
   mouvement ne la voit pas plus qu'un autre, mais un geste de glissé sur un
   téléphone qui chauffe est justement le moment où la cadence a le plus de
   chances de flancher pendant l'interaction).
3. **Le geste technique lui-même (`renderer.setSize` fréquent) a un passif
   documenté sur iOS Safari**, corrigé depuis 2020 mais jamais revérifié ici.
   À tester sur un appareil réel avant de shipper un asservissement fréquent.
4. **Le poids réseau en 4G n'est pas mesuré ici** — `rapport-INV3.md` donne
   804 Ko compressés au démarrage et ~24 Mo de MNT gaspillé hors-crop par vol,
   mesurés en local (pas de throttling réseau CDP dans cette session). Je
   n'ai pas de chiffre en débit mobile réel et je ne l'invente pas.

---

## CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« La distinction cadence/mouvement répond à la question de savoir si
   l'échelle aide. »** Non — j'ai failli les confondre. Le signal (mouvement
   vs cadence) ne change que quand et pourquoi on déclenche un ajustement ;
   il ne change rien au fait qu'une échelle de rendu n'a d'effet que si le
   goulot mesuré EST le GPU. Ce sont deux questions orthogonales, et le §②
   les traite séparément exprès.
2. **« Je pourrai mesurer un vrai comportement mobile en émulant un
   téléphone dans mon navigateur d'agent. »** Partiellement réfuté : l'écran
   (`screen.width/height`), le pointeur (`coarse`) et l'agent utilisateur
   s'émulent correctement (vérifié : le portail `boot-gate.js` réagit
   juste), mais **le GPU rapporté reste celui de la machine hôte** (RTX 3080)
   — aucune émulation de GPU faible n'est possible par ce chemin. Mes
   observations mobiles disent « le portail et le rendu partagé fonctionnent
   sans erreur », rien de plus sur la performance réelle d'un téléphone.
3. **« Rien n'avoir testé sur mobile, c'est un oubli. »** Réfuté par la
   lecture de `boot-gate.js` : c'est une **décision produit délibérée et
   documentée**, pas un oubli — l'éditeur complet est volontairement bloqué
   sur téléphone. « Mobile » pour Adrien aujourd'hui se limite donc, en
   pratique, au lien partagé en lecture seule — un périmètre plus étroit que
   ce que sa phrase (« y compris sur mobile ») suggère à première lecture. Je
   le signale sans trancher à sa place.
4. **Premier essai d'émulation mobile bloqué à tort.** Après avoir posé un
   lien `#s=` censé passer le portail (`sharedView`), l'écran de refus
   restait affiché. J'ai d'abord suspecté un bug de `boot-gate.js` ; c'était
   en fait un artefact de mon outil de test : changer seulement le fragment
   d'URL sur un onglet déjà chargé ne réexécute pas `boot.js` (script de
   premier chargement). Un nouvel onglet a confirmé le comportement correct
   du produit.
5. **« Le rapport-PA.md du brief est quelque part sous un autre nom. »**
   Cherché par contenu exact (les deux citations chiffrées) dans tout le
   dossier `sdd` : aucune correspondance. Je le signale comme un écart entre
   le brief et l'arbre plutôt que d'inventer une correspondance approximative.

---

## VÉRIFICATIONS DE SORTIE

- `git diff -- src/` : **vide**, vérifié avant et après la session.
- Bench utilisé : `scripts/profil-pf1.mjs`, **non modifié**, sortie
  `.banc/EA1-pf1-frais.json` (ignoré par git, comme les traces des autres
  rapports de cette campagne).
- Aucun test ajouté ni modifié — aucun code n'a été écrit.
- Serveur de mesure : `vite --host 127.0.0.1 --port 6231`, arrêté en
  quittant.
