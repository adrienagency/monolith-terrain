# RIV — POURQUOI LES RIVIÈRES LAGUENT, ET CE QU'ON N'A PAS APPLIQUÉ

Arbre `C:\Dev\wt-riv2`, branche `riv-lag`. `git diff -- src/` **vide** — rien n'a
été corrigé, tout a été mesuré. Bancs : `scripts/sonde-riv.mjs`,
`sonde-riv2.mjs`, `sonde-riv3.mjs` ; relevés dans `.banc/RIV/`.

**Le banc, pour qu'il se compare.** Chrome sans tête `--headless=new`,
SwiftShader, 1 280 × 800, serveur `vite` en développement sur `127.0.0.1:7241`,
mode sphère (le mode de démarrage), drapeaux au défaut. Ce qui diffère de la
production : SwiftShader au lieu du vrai pilote (le GPU n'est pas le sujet, PF1
l'avait déjà borné à 0,2–2,7 ms), et **le réseau d'Adrien** — c'est justement ce
qui décide de tout ici.

---

## ① LE LAG DES RIVIÈRES — CE QUE DIT LA MESURE

### La réponse courte

Il y a **deux plaintes différentes** derrière « les rivières laguent », et la
mesure les sépare nettement.

**A. « Les rivières mettent une éternité à apparaître. » — VRAI, et c'est du
réseau à 97 %.** Sur une page neuve, dès qu'on descend au-dessous de 24 km
d'altitude (`OSM_MIN_ZOOM = 12`), la couche appelle le service public Overpass.
**Depuis la machine d'Adrien, ce service ne répond jamais** : la connexion expire
au bout de 12,1 à 12,8 secondes. La couche, elle, a un budget d'attente de
6 secondes (`OVERPASS_ATTENTE_MS`), puis abandonne.

Mesuré, session neuve, vol direct sur le Rhône à z13
(`.banc/RIV/riv-attribution.json`, § *premierContact*) — les quatre
reconstructions du calque, dans l'ordre :

| # | durée | ce qu'elle a produit |
|---|---|---|
| 1 | **6 009,9 ms** | **rien** (0 sommet, 0 objet) |
| 2 | **7 715,5 ms** | **rien** (0 sommet, 0 objet) |
| 3 | 45,8 ms | rien |
| 4 | 334,1 ms | 366 sommets, 1 objet — les rivières Natural Earth |

**13,7 secondes d'attente pure pour zéro rivière**, puis 380 ms pour dessiner
celles qu'on avait déjà en local depuis le début. `6 009,9` est
`OVERPASS_ATTENTE_MS` à la milliseconde près : ce n'est pas une coïncidence,
c'est le minuteur.

**B. « Ça saccade pendant le chargement. » — VRAI, mais ce ne sont PAS les
rivières.** A/B rivières allumées / éteintes, **dans la même session**, même
vol, médiane de 3 tours (`.banc/RIV/riv-attribution.json`, § *ab*) :

| Rhône z11 | rivières ON | rivières OFF | écart imputable à l'eau |
|---|---|---|---|
| plus longue tâche | 275 ms | 203 ms | **+72 ms** |
| fil principal bloqué (total) | 887 ms | 894 ms | **−7 ms** |
| temps d'image p99 | 20,1 ms | 22,4 ms | **−2,3 ms** |
| pire image | 363,8 ms | 353,1 ms | +10,7 ms |

| Rhône z13 | ON | OFF | écart |
|---|---|---|---|
| plus longue tâche | 270 ms | 257 ms | **+13 ms** |
| bloqué (total) | 1 749 ms | 2 401 ms | **−652 ms** |
| p99 | 94,4 ms | 96,1 ms | −1,7 ms |

⚠️ **Éteindre les rivières ne rend pas l'application fluide.** La saccade
appartient au globe qui maille ses tuiles de relief en même temps — dans la même
fenêtre, le Rhône z11 tire **688 requêtes et 88,1 Mo** de tuiles d'altitude, avec
une tâche unique de **1 627 ms** et une pire image à **1 667 ms**. Ce n'est pas
la couche d'eau.

### La part de chaque poste, en pourcentage

**Premier contact (page neuve, z ≥ 12) — c'est le cas qu'Adrien ressent :**

| poste | part | ms |
|---|---|---|
| **réseau (attente Overpass, pour rien)** | **97,3 %** | 13 725 |
| décodage / découpe à l'emprise | 2,3 % | 331 |
| construction de géométrie | **0,02 %** | 2,4 |

**Ensuite (le disjoncteur d'`overpass.js` s'ouvre 60 s ; le calque retombe sur
les données locales) — six lieux × deux zooms**
(`.banc/RIV/riv-froid.json`) :

| lieu | zoom | mur | réseau | décod./découpe | géométrie | sommets |
|---|---|---|---|---|---|---|
| Rhône (bassin dense) | 11 | 181,0 ms | 0,1 % | 56,6 % | **42,5 %** | 11 541 |
| Rhône | 13 | 164,5 ms | 0 % | 98,7 % | 1,0 % | 366 |
| Mississippi (delta) | 11 | 135,4 ms | 0 % | 98,5 % | 1,0 % | 276 |
| Mississippi | 13 | 242,0 ms | 0 % | 99,4 % | 0,4 % | 74 |
| Sahara (désert) | 11 | 45,0 ms | 0 % | 99,1 % | 0 % | **0** |
| Sahara | 13 | 51,4 ms | 0 % | 98,8 % | 0 % | **0** |

⚠️ **Honnêteté sur ce tableau** : `chronoEau.sources` est du temps MUR, pas du
CPU — il englobe des `await` de requêtes servies par le cache HTTP. La borne CPU
réelle vient de l'A/B : **109,6 ms au Rhône z11, 58,8 ms au Rhône z13** (mur du
calque, ON moins OFF). Le reste est de l'attente.

### La plus longue tâche unique — celle qu'on ressent

| fenêtre | plus longue tâche |
|---|---|
| session neuve, Rhône z13, tout confondu | **1 815 ms** |
| Rhône z11, tout confondu | **1 627 ms** (pire image 1 667,5 ms) |
| **part imputable aux rivières (A/B)** | **+72 ms** (z11) · **+13 ms** (z13) |

⛔ **Ne pas lire « 1 815 ms » comme le coût des rivières.** Une reconstruction du
calque dure longtemps *en horloge* parce qu'elle attend ; pendant cette attente,
le globe maille ses tuiles, et ces tâches-là tombent *à l'intérieur* de
l'intervalle de la reconstruction. Attribuer par recouvrement donnait 5 844 ms
« dans l'eau » — **c'est faux**, et c'est exactement le piège que l'A/B dans la
même session sert à éviter. Le chiffre juste est +72 ms.

### Ce qui se passe quand on BOUGE pendant le chargement — bonne nouvelle

Six vols enchaînés de 0,05° toutes les 700 ms sur le Rhône à z13, sans attendre
la fin (`.banc/RIV/riv-riv.json`, § *mouvement*) :

| grandeur | valeur |
|---|---|
| durée observée | 13 247 ms |
| **reconstructions du calque d'eau entrées** | **2** (pas 6) |
| fil principal bloqué | 1 733 ms (13,1 %) |
| plus longue tâche | 442 ms |
| image p50 / p99 / pire | 16,7 / 89,2 / 492,8 ms |

**Le calque ne se reconstruit PAS à chaque déplacement** : le gel de carte
(`carteGelee()` / `_gelDemande`, `main.js:10102-10115`) coalesce les demandes. La
crainte « une couche qui se reconstruit à chaque emprise » **ne se vérifie pas
ici** — deux reconstructions pour six gestes.

### Ce qui coûte le plus, nommé à la ligne

| # | ligne | ce qu'elle coûte | ce qu'on gagnerait (estimation) |
|---|---|---|---|
| 1 | `src/map/water-layer.js:567-570` — `await Promise.all([fetchOverpassLines(...), fetchOverpassAreas(...)])` | **6 009,9 ms puis 7 715,5 ms**, pour zéro sommet | ⚡ **≈ 13,3 s** sur la première arrivée : dessiner Natural Earth TOUT DE SUITE et n'enrichir qu'à l'arrivée d'Overpass. *Estimation* — les 380 ms de la 4ᵉ reconstruction sont, eux, mesurés |
| 2 | `src/map/overpass.js:210-213` — `_attendre(key, attenteMs)` : chaque reconstruction ouvre **son propre** budget de 6 s sur la MÊME requête déjà en vol | la 2ᵉ attente : **7 715,5 ms** | ⚡ **≈ 7,7 s** : partager l'échéance au lieu du minuteur. *Estimation*, risque faible |
| 3 | `src/map/overpass.js:163` — « On n'annule PAS la requête » | 2 connexions mortes de 12,1–12,8 s par arrivée, 8 à 14 échecs réseau par fenêtre | pas de temps gagné directement ; libère deux créneaux de connexion pour les tuiles de relief. *Supposé* |
| 4 | `src/map/water-layer.js:198` `triangulateAndClip` + `:232` `poseur.hauteur` (drapage) | 29,5 + 37,8 = **67,3 ms** au Rhône z11, pour 11 541 sommets | ≈ 67 ms — **le seul poste de géométrie mesurable**, et il ne vaut pas un chantier |
| 5 | `src/map/water-layer.js:578` `_neRiverRings` → `clipToPatch` + `filterByZoom` | **45 à 51 ms au Sahara pour ZÉRO rivière** | ≈ 45 ms par arrivée en zone vide : un test d'emprise vide avant de découper. *Estimation* |

**Mémoire** : le tas ne grandit pas pendant ces reconstructions (delta mesuré
−50 à 0 Mo, `.banc/RIV/riv-riv.json`) ; le retrait de `computeVertexNormals()` /
`computeLineDistances()` (14,12 → 8,44 Mo, cité par `brief-RIV.md` §① et par
`water-layer.js:247`) est **déjà encaissé**. ⚠️ Son rapport source
(`rapport-R14.md`) est **absent de cet arbre** — le chiffre ne survit que dans
les commentaires du code.

---

## ② L'INVENTAIRE DES OPTIMISATIONS TROUVÉES ET NON APPLIQUÉES

⚠️ **Avertissement de lecture, et il est important.** Les rapports du dossier
(PF1→PF4, R37, B4, BT-N, GE3, `lecons-campagne-R.md`, `plan-fusion.md`) **ne
mesurent pas les rivières**. PF1→PF4 portent sur le globe et ses tuiles de
terrain, B4/BT-N sur la bathymétrie, GE3 sur la souris. **Aucune des
optimisations chiffrées du dossier ne touche la couche d'eau.** Les entrées
« rivières » de la catégorie C viennent donc de la mesure faite ci-dessus, pas
d'un rapport.

Chaque ligne a été **vérifiée par `grep` dans `src/`** — le dossier s'est déjà
contredit une fois.

### A. CHIFFRÉ ET PRÊT — quelqu'un a mesuré, rien ne bloque sauf le temps

| optimisation | gain annoncé | qui l'a mesuré | ce qui bloque | risque | vérification |
|---|---|---|---|---|---|
| **Routage des descendants d'un 404 Mapterhorn directement vers AWS** | **679 requêtes 404 sur 1 704** d'une descente, soit **40 %**, chacune suivie d'un second aller-retour | `rapport-PF2.md` §5, 4ᵉ point | rien d'écrit ; simplement pas fait | faible | `grep -n "404" src/globe.js` → le code *classe* 404 vs panne (3349-3353, 3568-3577) mais **aucun routage anticipé** : toujours absent |
| **Annulation des requêtes en vol (`AbortController` + compteur de demandeurs dans `memo-tuiles-mnt.js`)** | créneaux dépensés après sortie du champ = **24 % du temps de créneau** (32 s / 135 s → 16 s / 156 s) ; en amont **70–84 % des requêtes d'un geste arrivent après le geste** | `rapport-PF2.md` §5 ; `rapport-PF1.md` §④ | `fetchTile` refuse le `signal` (promesse partagée avec le damier, `.catch` qui réessaie). La vraie porte est `memo-tuiles-mnt.js`, hors périmètre PF2 | moyen | `grep AbortController src/` → **absent** (une seule occurrence : un commentaire de refus, `globe.js:8034`) |
| **Prescription progressive du zoom à la naissance du crop (z12 puis z13)** | dernier maximum de flou à **100 % d'écran**, ≈ 1 s, sans recul | `rapport-R37.md` §3 et §6, 2ᵉ point | R37 l'a laissé : « décision de produit, pas prise ici » | faible | `poserCrop({ centre, zoom, … })` (`globe.js:4563`) prescrit **toujours un zoom unique** : absent |
| **Maillage étalé sous budget (`processTerrainQueue`, 4 ms/image, centre d'abord)** | **121 tuiles bâties dans la même image de 315 ms** ; p99 des maillages 13,8 → 8,7 ms (×1) et 44 → 32 ms (×4) | `rapport-PF2.md` §4.8 et §3 | **25 tests dans six fichiers** supposent qu'une tuile est prête dès sa réponse. PF2 a retiré le code plutôt que réécrire 25 contrats | moyen | `grep processTerrainQueue src/` → **absent** |

### B. CHIFFRÉ MAIS COÛTEUX — arbitrage d'Adrien

| optimisation | gain annoncé | qui l'a mesuré | ce qui bloque | risque | vérification |
|---|---|---|---|---|---|
| **UBO (`UniformsGroup`, `std140`) pour les ~120 uniformes de tuile** | `composer.render` p50 **4,7–4,9 → 1,8 ms (−60 %)** à CPU ×4 | `rapport-PF4.md` § « Levier 1 », A/B **dans la même session** | réécrire un nuanceur de **192 uniformes** touché par sept tâches la même semaine, et sortir les samplers de `material.uniforms` | **fort** | `grep UniformsGroup src/` → **absent** |
| **Rendu à la demande généralisé (`requestRenderMode`, façon Google Earth / Cesium)** | au repos figé, **100 % du tick** — 13 à 24 ms de CPU par image (×4/×6) pour trois images **identiques au bit** | `rapport-PF1.md` §③ et §④ | PF4 n'a livré qu'une cadence de repos **partielle** (orbite, 1 image sur 2). Généraliser suppose de geler la rotation propre — **choix produit v29, gardé**. ⚠️ `lecons-campagne-R.md` avertit que « le globe tourne seul à ~2 °/s » n'est pas tranché (GE1 a mesuré 0,000° sur 90 images) | moyen | `grep "requestRenderMode\|needsRender" src/` → **absent** ; `dessinerCetteImage` (`cadence-repos.js:35`) → la version **orbite EST appliquée** |
| **Réduction du format des textures de hauteurs (R16 / float au lieu de RGBA8)** | **0 ms sur le tick**, mais **−50 % de VRAM** (une tuile ≈ 0,75 Mo, `cacheMax` 1 700 ⇒ ~1,3 Go) | `rapport-PF1.md` §④ et § Mémoire | les hauteurs terrarium ne se compressent pas en lossy (la mip corromprait les hauteurs) : chantier de format, zéro gain de temps d'image | moyen | `grep "KTX2\|CompressedTexture" src/` → **absent** |
| **Perte 256/512 de la chaîne bathy** | **−4,3 %** sur BT-1, **−19 % de pente** à Virginia (BT-N corrige BT-I, qui annonçait −34 % à tort) | `rapport-BT-N.md` §② | touche tout le tuileur, pas seulement BlueTopo | fort | hors périmètre rivières |
| **Extension de couverture BlueTopo** | z10 partout ≈ **92 Mo** · z12 littoral ≈ **273 Mo** · z13 ≈ **959 Mo** | `plan-fusion.md`, ligne BT-I | poids de déploiement + licence NCEI Puget | faible techniquement, coûteux en Mo | hors périmètre rivières |
| **`build:bathytiles` dans `npm run deploy`** | pas de gain de perf — un risque de livraison | `rapport-B4.md` §⑦ | arbitrage assumé par B3 ; `verifie:dist` sert de filet | faible | `package.json` ligne 25 : **toujours absent**, conforme |

### C. SUPPOSÉ — personne n'a mesuré. À ne pas vendre comme un gain.

| piste | ce qui est dit | source | pourquoi « supposé » | vérification |
|---|---|---|---|---|
| **Rivières : dessiner Natural Earth d'abord, enrichir Overpass ensuite** | supprimerait ≈ 13,3 s d'attente à vide | **aucune** — déduit de MA mesure ci-dessus | le gain n'est pas mesuré *après correction* ; seule l'attente est mesurée | `water-layer.js:567` : l'`await` bloque toujours l'affichage |
| **Rivières : partager l'échéance d'attente Overpass entre reconstructions** | supprimerait la 2ᵉ attente, **7 715,5 ms** | ma mesure | idem — l'attente est mesurée, pas le correctif | `overpass.js:210` : budget rouvert à chaque appel |
| **Rivières : sortir décodage/géométrie du fil principal (Worker)** | rien | — | ⚠️ **et la mesure dit que ça ne vaut rien ici** : l'A/B donne **+72 ms** au maximum | `grep -rn "Worker" src/map/` → **aucun Worker dans la couche carte** ; les Workers servent le terrain |
| **Rivières : annuler la requête Overpass** | refus documenté : « On n'annule PAS la requête : elle reste dans le cache » | `src/map/overpass.js:163` (code) | choix écrit, adossé au budget d'attente | `grep -i abort src/map/` → **aucun** |
| **Rivières : baisser `OSM_MIN_ZOOM`** | ⛔ **réfuté d'avance** : z12 et z10 → REFUS à **6 004–6 008 ms** ; baisser le plancher étendrait l'attente de 6 s à TOUS les zooms | `water-layer.js:55-84`, `scripts/sonde-overpass.mjs` | c'est un **piège**, pas une optimisation | `OSM_MIN_ZOOM = 12`, inchangé |
| **Fusion des draws de tuiles (atlas)** | « un atlas irait plus loin » | `rapport-PF1.md` §④ | phrase de fin de ligne, **aucun banc**. PF4 a déjà réfuté à moitié l'estimation PF1 voisine (15–25 % annoncés → 9 % réels) | `grep atlas src/map src/globe.js` → absent |
| **SSE vraie (erreur d'espace-écran)** | ⛔ **RÉFUTÉE** : « 0 ms gagné », et chargerait **plus** sur Retina | `rapport-PF1.md` §④, re-réfutée `rapport-PF2.md` §4.9 | levier de **justesse**, pas de vitesse | critère `chord/dist` inchangé, volontairement |
| **Fondu parent → enfant au raffinement partiel** | « la couture médiane est nulle, il ne paierait rien de mesuré » | `rapport-R37.md` §6 | il n'y a pas de défaut à corriger | `grep "_melangeCrop\|_partiels"` → mécanisme présent, **aucun fondu** |
| **Second `EffectPass` sans `NoiseEffect`** | ⛔ réfuté : le grain à opacité 0 vaut **+0,005 ms (3,9 % de la passe)** | `rapport-PF3.md` §5 et §8.2 | mesuré, non rentable | conforme |

### Donné pour « à faire » mais EN FAIT APPLIQUÉ — ne pas re-proposer

- **Matériau partagé des tuiles** — `libererMateriauTuile` (`monde/materiau-tuile.js:129`), importé `globe.js:18`, appelé aux 4 `dispose()`. **APPLIQUÉ** (−17 %, PF4).
- **`matrixAutoUpdate = false`** — tuiles (8481), mer (6400), parois (7203), `globe.group` (3787), `sceneGlobe` (`main.js:4876`). **APPLIQUÉ** (−15 %).
- **Décodage terrarium en Worker** — `monde/decodeur-terrarium.js`. **APPLIQUÉ** (PF2 ⑦).
- **Raffinement partiel + rechargement sur place + prélecture** — `globe.js:8162`, `8982`, défauts à `true` (3983-3988). **APPLIQUÉ** (R37 : flou 13 % → 3,9 %).
- **`contexteCrop()` mémoïsé** — PF1 l'annonçait à 14 % ; **PF4 bis l'a RÉFUTÉ** (5,3–6,8 µs/appel) et a retiré le mémo. **Ne pas rouvrir.**
- **`PLAFOND_FILE`** — reste à 256 (`globe.js:844`), `_refusFile` à 0 : conforme à la décision « porter purge+evict, PAS PLAFOND_FILE ».

---

## ③ LES CINQ CHOSES À FAIRE EN PREMIER — gain ÷ risque

| # | quoi | gain | risque | pourquoi ce rang |
|---|---|---|---|---|
| **1** | **Dessiner Natural Earth AVANT d'attendre Overpass** (`water-layer.js:567`) | **≈ 13,3 s** sur la première arrivée à z ≥ 12 (*estimation ; l'attente, elle, est mesurée : 6 009,9 + 7 715,5 ms*) | **faible** — le repli existe déjà et fonctionne, on ne fait que l'exécuter en premier | le plus gros gain du document, dans le fichier le mieux documenté, sans nouveau contrat |
| **2** | **Partager l'échéance d'attente Overpass entre reconstructions** (`overpass.js:210`) | **≈ 7,7 s** (*estimation*) | **faible** — quelques lignes, une seule variable d'échéance | corrige un doublon d'attente sur une requête déjà en vol ; indépendant du n° 1 |
| **3** | **Routage des descendants d'un 404 vers AWS** (PF2 §5) | **40 % des requêtes** d'une descente | **faible** — aucun contrat de test en travers | seul gain *déjà chiffré par un rapport* qui ne demande aucun arbitrage |
| **4** | **Prescription progressive du zoom à la naissance du crop** (R37 §6) | supprime le dernier pic de flou à **100 % d'écran**, ≈ 1 s | **faible** — mais c'est une décision de produit | visible immédiatement, coût quasi nul |
| **5** | **Annulation en vol via `memo-tuiles-mnt.js`** (PF2 §5) | **24 % du temps de créneau** ; libère aussi les connexions que les 2 requêtes Overpass mortes retiennent 12 s | **moyen** — cache partagé globe/damier | gros gain, mais la porte touche du code partagé : à faire après les quatre autres |

⛔ **Ce que ce classement écarte volontairement** : sortir la géométrie des
rivières dans un Worker, ajouter un atlas, ou toucher `OSM_MIN_ZOOM`. Les deux
premiers ne sont adossés à aucune mesure et l'A/B borne le gain possible à
**+72 ms** ; le troisième est un piège déjà chiffré (il étendrait l'attente de
6 s à tous les zooms).

---

## CE QUI A ÉTÉ CRU PUIS RÉFUTÉ EN COURS DE ROUTE

1. **« La géométrie des rivières est le poste dominant. »** Faux : 0,02 % au
   premier contact, 42,5 % d'un mur de 181 ms au meilleur des cas, et l'A/B
   plafonne l'écart à +72 ms.
2. **« La plus longue tâche (1 815 ms) est celle des rivières. »** Faux —
   l'attribution par recouvrement donnait 5 844 ms « dans l'eau » alors que
   l'A/B donne +72 ms. Une reconstruction qui *attend* longtemps héberge les
   tâches des autres.
3. **« La couche se reconstruit à chaque déplacement. »** Faux : 6 gestes
   enchaînés → **2 reconstructions**. Le gel de carte fait son travail.
4. **Première sonde invalidée** : mesurer une reconstruction 12 s après le vol
   ne mesure rien — le cache d'`overpass.js` et son disjoncteur de 60 s rendent
   la branche gratuite. Il faut une **page neuve par cas**.
5. **Horloge CDP invalidée** : `Network.requestWillBeSent.timestamp` est une
   horloge monotone d'origine arbitraire ; la comparer à
   `performance.timeOrigin` rendait « 0 requête » partout. On retient les
   requêtes **par ordre d'arrivée**, pas par horodatage.
