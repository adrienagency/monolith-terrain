# RAPPORT PF4 — LES BUGS QUI COÛTENT

Arbre `C:\Dev\wt-pp4`, branche `perf-bugs`, fusionnée sur `regroupement` (7694eab).
**Banc** : RTX 3080 (ANGLE D3D11), Chrome 152 sans tête 1280×800, dpr 1,
`--disable-gpu-vsync` (les images/s sont donc *sans* vsync — à 60 Hz, diviser),
ralentissement CDP `Emulation.setCPUThrottlingRate` quand indiqué, serveur
`npm run dev -- --port 6311`. Palier machine relevé dans chaque mesure
(`window.__palierMachine`) : palier 0, carte « fort ». Traces dans `.banc/PF4/`.

**La sonde** : `scripts/profil-pf1.mjs` n'existait pas ; j'ai écrit
`scripts/profil-pf4.mjs` — CDP brut sur WebSocket (Node ≥ 22), **aucune
dépendance** (pas de puppeteer). Six scénarios : `gl` (erreurs GL par image
composée + message exact du pilote via `Log.entryAdded`), `repos` (période, CPU
de soumission, GPU par `EXT_disjoint_timer_query_webgl2`, dessins/s, tas JS),
`palier` (palier et bannières seconde par seconde dès le premier dessin),
`voile`, `clic`, `fuites`. Options `--cpu`, `--orbite`, `--altitude`,
`--bokeh`, `--url`, `--erreurs 0`. Enveloppe `composer.render` en page.

---

## ① `GL_INVALID_OPERATION` à chaque image composée — corrigé

**Reproduction** : `--scenario gl` : **602 images sur 602** en erreur `1282`,
config par défaut (sans bokeh) ; 715/715 bokeh allumé.

**Cause, à la ligne — et ce n'était PAS un désaccord de format.** Le pilote
dit : *« glBlitFramebuffer: Read and write depth stencil attachments cannot be
the same image »*. Deux causes empilées :

1. `postprocessing/build/index.js:1047` `createDepthTexture()` fait
   `depthTexture.clone()` pour la copie « stable » ; `Texture.clone()` partage
   la `Source` (three r172) et `WebGLTextures` dédoublonne les textures GL par
   Source → vérifié à chaud `props.get(stable).__webglTexture ===
   props.get(vivante).__webglTexture` (`memeGl: true`). Le blit copie l'image sur
   elle-même. Amont 6.39.4 clone encore.
2. Pourquoi une profondeur existe **sans bokeh** : `SMAAEffect` déclare
   `CONVOLUTION | DEPTH` (attributs = 3, `index.js:10951`) alors qu'en détection
   COULEUR (défaut) son nuanceur ne lit jamais la profondeur → la passe finale
   `needsDepthTexture = true` → texture 32F + cible stable + blit + rattachement
   de profondeur aux deux tampons ping-pong à chaque passe, pour rien.

**Correctif** : `src/profondeur-compositeur.js` — `sansLectureDeProfondeur(smaa,
EffectAttribute.DEPTH)` (plus aucune profondeur créée en config par défaut) et
`copieStableDistincte(composer)` (la stable reçoit une `Source` à elle ; ne joue
que quand un effet lit vraiment la profondeur, bokeh). Deux lignes dans
`main.js` (2389, 2638). Échappatoire `?profondeur=amont`. Test
`test/profondeur-compositeur.test.js` (5) — exerce le VRAI `EffectComposer`
avec un renderer factice, témoin amont inclus.

**Avant/après** (600 images, surface 10 km, sans `getError` dans la minuterie) :

| | erreurs/image | GPU p50 | p90 | p99 |
|---|---|---|---|---|
| amont, défaut | **1** | 0,637–0,642 ms | 1,15–1,66 | 2,0–3,4 |
| après, défaut | **0** (0/616) | 0,68–0,70 ms | 1,40–1,42 | 3,2–5,5 |
| amont, bokeh | 1 | 1,018 ms | 2,02 | 3,00 |
| après, bokeh | **0** (0/638) | 1,024 ms | 1,72 | 3,05 |

Le gain est la **correction** (zéro erreur, console propre sur 600 images ; par
passe : `PasseFond` 0,45–0,54 ms, `EffectPass` 0,065 ms, identiques amont/après),
pas du temps : le pilote abandonnait le blit, il ne coûtait rien ; le blit qui
réussit désormais (bokeh) coûte ≈ 0 à 1280×800. ⚠️ Non mesuré sur GPU intégré,
où le rattachement de profondeur par passe qui disparaît peut compter.

## ② Le globe tourne tout seul → rendu à cadence réduite — corrigé

**Décision retrouvée** : `git log -S"dtAmb * 0.035"` → `7777e08` v29 « orbiting
planet clouds », `main.js:13474`, gardée par l'interrupteur Animations. **Choix
produit**, gardé. Et « jamais d'image au repos » vaut aussi en surface avec les
animations (mer, nuages, faune bougent vraiment) : le repos n'existe qu'en orbite.

**Correctif** : `src/cadence-repos.js` `dessinerCetteImage()` — en orbite, aucun
geste (souris, molette, survol) depuis 3 s, ni vol, ni plongée, ni
enregistrement : **une image dessinée sur deux** (0,067° de rotation entre deux
dessins). Toute la logique de l'image tourne ; seul le dessin est sauté
(`main.js` tick, avant `aq.update`). Échappatoire `?cadence=pleine`. Test
`test/cadence-repos.test.js` (3, texte du tick inclus).

**Avant/après**, orbite, repos 60 s, sans vsync :

| altitude | dessins/s p50 | GPU/dessin p50 | CPU rendu/dessin p50 | tas JS |
|---|---|---|---|---|
| 60 000 km, avant | 289 | 0,164 ms | 0,7 ms | plat 232–259 Mo |
| 60 000 km, après | **157** | 0,177 ms | 0,5 ms | plat 228–254 Mo |
| 3 000 km, `?cadence=pleine` | 272 | 0,324 ms | 1,1 ms | 277→288 Mo |
| 3 000 km, après | **146** | 0,261 ms | 2,6 ms* | 280→279 Mo |

À 60 Hz : 60 → 30 dessins/s, soit la moitié du GPU et du CPU de soumission au
repos. \*le CPU « par dessin » monte parce que la période double (le rAF entre
deux dessins fait plus de logique) : le total par seconde baisse (2,6×146 = 380
ms/s contre 1,1×272 = 300 — comparaison bruitée, deux sessions). **Témoin GPU
×16 fragments : 1,5–3,6, non valide** au sens du socle — à ces altitudes l'image
n'est pas bornée par les fragments (1 appel/passe finale), la minuterie mesure
un plancher de passes. Les dessins/s, eux, sont exacts. La part du tick hors
dessin (globe.update, ~2 ms/image) reste — c'est PF1/PF2.

## ③ « ESSENTIAL MODE » au chargement, et l'écran 0×0 — corrigé

**Ce que ça n'est pas** : le palier machine (`palier-machine.js`) est appliqué
en silence (`applyTier(startTier)`, perf.js:434, sans bannière). **La bannière
ne sort que de `setTier`, donc du gouverneur** (perf.js:319).

**Reproduction** (`--scenario palier --cpu 4`) : premier dessin à 38,5 s ;
dessins/s ensuite **10 · 5 · 2 · 1 · 5 · 6 · 3 · 11 · 1 · 22 · 28 · 48** — neuf
secondes de rafale d'arrivée (dalles voisines, tuiles, nuanceurs) — palier 3 à
la 4ᵉ seconde, bannière « PERFORMANCE — ESSENTIAL MODE », **jamais remonté en
100 s** (remonter exige 55 i/s pendant 12 s ; il tournait 40–58). Cause :
`main.js:12815` `canStep` ne ferme le guichet que pendant `demBusy` (le MNT
central) ; `BOOT_IGNORE` (5 s) court depuis la naissance du contrôleur, 30 s
avant le premier dessin ; `echantillonRetenu` garde les images longues
consécutives — une rafale est indiscernable d'une machine lente par le temps
seul.

**Correctif** : `src/accalmie-gouverneur.js` — guichet fermé **10 s après le
premier dessin et après chaque relâchement du MNT** (`programmesPrets`, les
deux `finally { demBusy = false }`), lu dans `canStep`. Test
`test/accalmie-gouverneur.test.js`. **Après, CPU ×4** : palier **0 tenu 100 s**,
dessins/s 9 6 5 3 2 5 14 7 puis **55–70** — la machine méritait le palier 0. À
CPU ×6 (avant) : palier 3 d'emblée, légitimement (premier dessin 26,6 s).

**L'écran** : lu dans `lireSignaux` (`palier-machine.js:524`), `screen` d'abord.
Le `[0,0]` de la session ne se reproduit pas dans le panneau aujourd'hui
(`screen` 1920×1080) ; mais il y lit 1920×1080 pour **563×419 dessinés**, et en
sans tête un fantôme **800×600 pour 1280×800**. Sur un vrai poste : le moniteur,
pas la fenêtre. Corrigé : **la fenêtre d'abord** (c'est elle qu'`applyRenderSize`
dessine et que le budget de pixels peut réduire), `screen` en repli ; `[0,0]`
reste « inconnu → légère » (règle testée, gardée). Test ajouté dans
`test/palier-machine.test.js`. Chez Adrien : l'iMac 5K « faible » est estimé
palier 2 par la table ; la bannière ESSENTIAL de sa vidéo est le gouverneur
sur la rafale d'arrivée — le cas mesuré ci-dessus.

## ④ Le clic qui saute onze fois — tracé, NON corrigé (modes.js aux agents caméra)

**Reproduction** (`--scenario clic --orbite 1 --altitude 60000000`, onze clics
au centre) : clic 1 : **60 000 km → 13 613 km en UNE image (×4,41, 566 ms)**,
z4 ; clics 2 à 8 : **×1,43–1,45 en une image** chacun (6,89 M→4,74 M, 3,38→2,35,
1,67→1,17, 830 k→580 k, 414→288, 205→143, 101→70 k), puis ×1,47, ×1,55 ; l'attaque
D16 avait ×2,23 puis ×1,38–1,43. Trace `.banc/PF4/clic-avant.json`.

**Cause, à la ligne** :
- Clic 1 (orbite → surface) : `modes.js:1488 plongeDepuisGlobe` → `_dive`
  (1048) → `_posePlongee` (956) : la distance qui conserverait l'altitude quittée
  est **bornée** `clamp(d, minDistance, surfaceMaxDistance())` (973–977), et
  `surfaceMaxDistance` vaut **150 unités** (`main.js:6789`, `loi-altitude.js:41`)
  : au bloc z4, 150 unités ≈ 13 600 km. La règle R1 est abrogée par la butée dès
  que l'altitude quittée la dépasse — d'un seul coup, dans `_whiteout`.
- Clics 2–11 (surface → surface) : `diveTo` (1496–1506) ne fait qu'un **lissage
  de 30 %** (`lean = 0.3 × …`, 0,42 s) puis `_loadDive` (1512) **repose la caméra
  à une distance fixe** `distancePresentation(surfaceMaxDistance())` (1529–1533)
  sur le bloc du niveau suivant, qui représente moitié moins de mètres : les 70 %
  restants tombent en une image → ×1,4 ≈ 2 × 0,7.

**Ce qu'il faudrait** (pour eux) : dans `_loadDive`, poser la distance qui
CONSERVE l'altitude en mètres (comme `distancePourAltitudeFond` de
`_posePlongee`), ou prolonger le tween après le chargement ; pour le clic 1,
arriver à un niveau dont 150 unités couvrent l'altitude quittée, ou glisser
jusqu'à la butée au lieu de la poser.

## ⑤ Le voile d'accueil avale les gestes — corrigé

**Reproduction** (`--scenario voile`, caméra immobile, témoin sans geste = 0) :
à (200, 400) le geste tombe sur **`DIV.ce-elemwrap`** — le wrap de la barre,
frère du voile, étalé au centre sous `body.ce-hub` — pas sur le voile. **Glissé
160 px : voile ouvert, caméra immobile. Double-clic : voile ouvert, rien.** La
croix (1236,18) : `elementFromPoint` = la croix, elle FERME ici (chez Adrien,
non : à vérifier chez lui — la topbar z 60 passe en `pointer-events: none` sous
`ce-hub`, rien ne la couvre à 1280 px). Seul le point exact du centre tombait sur
le voile : « clic n'importe où » était faux presque partout.

**Correctif** : `src/ui/hub-sortie.js` + `hub.js` : `pointerdown` sur la fenêtre
en capture (même portée que la molette de R29), hors de tout ce qui se clique
(`button, input, a, [role=button], .ce-qb-core`) → `escape()`. **Le geste n'est
pas rejoué sur la toile** : un `pointerdown` rejoué armerait le clic-plongée
(`main.js:2754`) et fermer l'accueil plongerait. **Après** : glissé → voile
fermé, caméra immobile (le geste suivant arrive à la toile) ; double-clic →
fermé, pas de plongée (altitude inchangée) ; croix → fermé. Test
`test/voile-accueil.test.js`.

## La liste de `/threejs-optimisation`

- **Allocations dans la boucle** : tas JS plat 60 s au repos (232–259 Mo, dents
  de GC), en orbite haute et basse. Rien à corriger.
- **`dispose()` manquants** : `--scenario fuites`, 6 changements de lieu
  (Chamonix, Annecy, Nice ×2) : textures **70 → 70**, géométries **71 → 71**,
  programmes **23 → 23**, tas 256 → 261 Mo, **écouteurs** window 23 / document 8
  / canvas 20 **constants**. ⚠️ `gotoCtl.go` a rendu `true` mais `demLocation`
  est resté « La Réunion » : la sonde a peut-être mesuré six allers vers le
  même lieu — à refaire avec `flyTo`/`loadRealTerrain` avant de conclure
  « aucune fuite ». Non conclu.
- **Recompilations de nuanceur** : `programs.length` 19–23 constant sur tous les
  bancs ; deux `Program Info Log` X4000 (`f_surfaceFx_int` non initialisé) à la
  compilation — cosmétique.
- **`preserveDrawingBuffer`** absent, `antialias: false` (SMAA), `powerPreference:
  'high-performance'` : rien à dire.
- **Deux systèmes pour une chose** : la profondeur du compositeur en avait
  deux (texture vivante + stable) pour zéro lecteur — c'est ①.

## Cosmétique, listé non corrigé

- `renderer.info.render` est remis à zéro à chaque `render()` : lu après le
  compositeur il ne montre que la passe finale (1 triangle) — piège de mesure.
- `Program Info Log X4000 f_surfaceFx_int` (deux fois au démarrage).
- Chrome sans tête : `screen` 800×600 fantôme (documenté dans lireSignaux).
- `attendreImmobile` de la sonde rend −1 en surface : la caméra dérive toujours
  un peu (butée de sol / élastique) — pas un bug de l'app, un seuil de sonde.

## Tests

`npm run audit:tests` : **245 listés · 245 sur disque, aucun écart** (241 + 4).
`npm test` après fusion de `regroupement` (base 4 675 · 0) : **ℹ tests 4688 ℹ pass 4687 ℹ fail 1 ** (4 675 + 13 tests PF4). Un échec transitoire réfuté en chemin : `export-effets.test.js` classe la chaîne en lisant `const x = new XEffect(` dans main.js — le SMAA enveloppé dans un ternaire disparaissait du classement ; remis sur sa ligne.

## Commits (branche `perf-bugs`)

- `ee5d472` PF4 sonde : `scripts/profil-pf4.mjs` (+ module et test du compositeur)
- `dc6b0c5` PF4 : les cinq bugs — profondeur, cadence au repos, accalmie du
  gouverneur, fenêtre d'abord, sortie au pointeur
- fusion de `regroupement` (7694eab), sans conflit
- ce rapport

## Ce que j'ai cru puis réfuté

1. **« Un blit DEPTH_COMPONENT24 vs 32F »** (le brief, deux rapports). Réfuté par
   le message du pilote : *same image*. Les deux formats étaient 32F ; c'est la
   Source partagée du `clone()` qui faisait une seule texture GL.
2. **« L'erreur ne vient qu'avec le bokeh »** (DoF est le seul lecteur de
   profondeur). Réfuté : 602/602 sans bokeh — SMAA déclare DEPTH sans le lire.
3. **« Le correctif coûte ×6 de GPU »** (0,7 → 4,5 ms p50, quatre bancs
   concordants). Réfuté par la mesure par passe (identique amont/après) puis en
   coupant `gl.getError()` de la sonde : **c'était le point de synchronisation
   de la sonde** qui tombait dans la minuterie quand aucune erreur n'était en
   attente. Sans lui : 0,64 vs 0,70 ms. Le socle avait prévenu sur `finish()` ;
   `getError()` est du même bois.
4. **« ESSENTIAL au chargement = le palier machine sur un écran 0×0 »**. Réfuté :
   0×0 rend le palier le plus GÉNÉREUX, et le palier de départ ne fait jamais de
   bannière ; c'est le gouverneur sur la rafale d'arrivée.
5. **« Le voile capte tout »**. Presque : c'est son frère `.ce-elemwrap` qui
   capte, le voile lui-même fermait au clic. Et **la croix ferme** ici.
6. **« Le glissé doit traverser le voile »** : renoncé — le rejouer plongerait.
