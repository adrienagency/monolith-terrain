# RAPPORT FLU — « je veux que tout charge plus vite et soit plus fluide »

**Arbre** `C:\Dev\wt-flu` · branche `perf-fluide` · **base mesurée `6275e62`**
(« Fusion RAMP »), **commit livré `1e85e7b`**. Banc : `scripts/banc-pa-budget.mjs`
(copié de PA, inchangé), Chrome sans tête, ANGLE/RTX 3080 D3D11, 1600 × 1000,
**vsync 60 Hz**, CPU ×1 et ×4, Vite dev `127.0.0.1:9931`. `npm test` **5 013 · 0**,
`audit:tests` **275 = 275, aucun écart**.

⚠️ **LE BANC TOURNAIT SUR UNE MACHINE PARTAGÉE PAR SIX AGENTS.** Les valeurs
ABSOLUES d'une session à l'autre bougent de ±30 % (le `(program)` du profil est
passé de 25 % à 45 % entre deux relevés à code égal, la période p50 de 16,7 à
33,3 ms). Ce qui se compare, c'est : ① les **enveloppes par poste** dans le même
régime, ② les **A/B dans la même session**, ③ la **plus longue tâche unique**,
dont l'ordre de grandeur (×3 à ×6) dépasse le bruit. Quand deux valeurs
existent, les deux sont données.

---

## ① LA BASE, REMESURÉE (`6275e62`, 2026-09-05, avant tout correctif)

| scène | ×1 : CPU p50 / p99 | ×4 : CPU p50 / p99 | `veilleCrop.maj` moy ×4 | plus longue tâche ×1 / ×4 |
|---|---|---|---|---|
| orbite | 4,8 / 19,4 | 8,5 / 28,6 | 0,02 | — / — |
| orbite-geste | 6,0 / 21,5 | 23,2 / 73,6 | 0,02 | — / 87 |
| **descente** | 5,9 / 232 | 15,0 / 450 | 1,11 | **991** (27 tâches) / **2 478** (26) |
| crop | 5,9 / 11,9 | 22,3 / 40,4 | **3,24** | — / — |
| crop-geste | 5,4 / 9,3 | 15,4 / 38,5 | 2,83 | — / — |

Profil ×4, temps propre : **descente** `noise` 1 407 ms · `natGris` 1 118 ·
`gridNormals` 594 · `pousse` 537 · `sampleHeights` 318 · `_ecrireRelief` 303 ·
`_tuileLaPlusFine` 163 ; **crop** `contexteCrop` **1 264 ms = 15 %** ;
**orbite-geste** `getBoundingClientRect` **844 ms = 9,6 %**. C'est le même
tableau que PA (les cinq postes, dans le même ordre) ; la descente ×1 est à 991 ms
contre 482 chez PA — machine chargée, pas régression (aucun changement de `src/`
entre les deux relevés de base).

---

## ② CHAQUE POSTE, AVANT / APRÈS

### Poste ① — `contexteCrop` : ce n'était pas le calcul, c'était `clientHeight`

**Ce que j'ai cru** (et le brief avec moi) : le contexte est reconstruit à chaque
image pour rien, il faut le mémoïser sur sa signature. **Réfuté par la mesure**
avant d'écrire la mémo : `__exp.contexteCrop()` appelé **400 fois de suite**
coûte **0,006 ms à ×1 et 0,024 ms à ×4** par appel (`.banc/sonde-ctx-noinline.log`,
profil sans inlining). Or l'enveloppe par image dit 3,24 ms et le profil 15 % de
temps PROPRE. Un profil d'arbre d'appel sans inlining sur de vraies images
(`.banc/sonde-ctx2-x4.log`) : **`contexteCrop` total 1 213 ms, self 1 188 ms**, et
ses enfants réunis 25 ms. Tout est dans le corps de la fonction — et le seul
accès du corps qui touche le moteur de rendu est `renderer.domElement.clientHeight`
(`mer.hauteurPx`), qui **force une mise en page synchrone** dès que le DOM a
bougé, c'est-à-dire à chaque image (HUD, cartouches). En boucle serrée le DOM
est propre : 24 µs. Le profileur attribue la mise en page à la fonction JS qui
lit la propriété.

**Correctif** : `src/monde/rect-toile.js` — la boîte et `clientHeight` lus une
fois, invalidés par `ResizeObserver` sur la toile, `resize`, `scroll` (capture),
filet d'une relecture par seconde ; la MÊME grandeur (`clientHeight || undefined`)
est rendue. **PC §② (« mémo retirée, ne pas rouvrir ») avait raison sur la mémo et
tort sur la cause** : PF4 avait mesuré la fonction en boucle, donc DOM propre.

| mesure | avant | après |
|---|---|---|
| `veilleCrop.maj` moy, crop ×4 (banc) | **3,24 ms** | **0,89 ms** (crop-geste 2,83 → 0,75) |
| `veilleCrop.maj` moy, crop ×1 (banc) | 1,07 | 0,21 |
| **A/B même session**, ×4, crop posé, pointeur en mouvement, ordre A-B-A-B (`.banc/sonde-ab-toile.mjs`) : cache **contre** cache invalidé à chaque image (= avant) | p50 **5,20 ms**, moy 7,13, p99 39,0 | p50 **0,40 ms**, moy 0,83, p99 8,4 |
| CPU d'image du même A/B, p50 | 42,5 ms | 37,4 ms (**−5,1 ms/image à ×4**) |
| `contexteCrop` au profil du crop ×4 | 15,0 % (rang 2) | absent du top 30 |

Critère « `contexteCrop` ≤ 0,3 ms » : la fonction elle-même vaut 0,024 ms ; ce
que l'enveloppe `veilleCrop.maj` mesure en plus (0,4 ms p50) est la comparaison
d'habillage et de forme par image, hors périmètre.

### Poste ② — `getBoundingClientRect` dans `projectionSaisie`

Même cache. Profil orbite-geste ×4 : **844 ms / 9,6 % → 125 ms / 1,3 %**. Le
reste vient d'autres lecteurs de l'interface (`ui/elembar.js`, `ui/liquid.js`),
hors périmètre — nommés, pas corrigés.

### Poste ③ — le `break` de `_tuileLaPlusFine`

`tuilesAvecHauteurs()` étiquette sa liste (`trieeFinAbord = true`) ; le parcours
s'arrête à la première tuile qui couvre **seulement sur une liste étiquetée** —
`test/crop-parois.test.js` exige toujours que « l'ordre de la liste ne fasse
rien » sur une liste quelconque, et il passe. `test/tuile-la-plus-fine.test.js`
mord dans les deux sens (une liste qui lève dès qu'on la lit au-delà de la
réponse ; une liste non étiquetée lue jusqu'au bout). Au profil de la descente ×4 :
`_tuileLaPlusFine` **163 ms → hors du top 30**. Le +1 698 ms de D16-b était à z6,
que le banc de PA ne traverse pas ; je ne le republie pas.

### Poste ④ — la descente : la plus longue tâche unique

**Décomposée avant de toucher** (`.banc/sonde-descente-x4.log`, enveloppes sur
`terrain.rebuild`, `rafraichirFenetre`, `_ecrireRelief`, `plinth.rebuild`… + tâches
longues) :

- **La tâche de 2 478 / 4 072 ms à ×4** : `terrain.rebuild` **2 908 ms** au premier
  instant de la plongée, avec `remplirDepuisFlux → null` juste avant. `entrerEnVol`
  pose `dem = null` et reconstruit ; les tuiles viennent d'être demandées trois
  lignes plus haut et **aucune n'a de hauteurs** (les parents z8–z11 venaient
  d'être dessinés, mais `_buildMesh` relâche `t.heights` dès le maillage). Le
  chemin retombait alors sur le **sampler PROCÉDURAL** : un `fbm`/`ridged` par
  sommet sur 591 361 sommets — c'est le `noise` à 1 407 ms du profil de PA, pour
  des montagnes d'ailleurs, remplacées quelques centaines de ms plus tard.
- **Les tâches de 450 à 1 060 ms, treize fois en neuf secondes** : à chaque tuile
  qui atterrit, `rafraichirFenetre` 330–810 ms (`remplirHauteurs` + `_ecrireRelief`
  dont `natGris` sur toute la nappe + `gridNormals` **deux fois**) + `plinth.rebuild`
  100–250 ms, dans la même image.
- `rebuildRoughness` **300–460 ms** à chaque reconstruction, pour des octets
  identiques (six octaves de simplex sur 512²).

**Ce qui a été fait, dans mon périmètre (`main.js`, `terrain.js`, `globe.js`
autour du maillage, `detail-noise.js`, `terrain-jobs.js`) :**

1. **`globe._retenirHauteurs`** : les hauteurs des **24 dernières tuiles
   maillées** restent lisibles (file bornée, 24 Mo au pire ; `gardeHauteurs`
   prime). À la plongée, `remplirDepuisFlux → remplis = 591 361` dès le premier
   appel : **le socle se pose sur le relief du parent** — « affiche le parent
   pendant que ça calcule » — et `terrain.rebuild` passe de **2 908 à 405 ms** à ×4.
   `test/globe-eviction.test.js` verrouillait « zéro hauteur retenue » : il
   verrouille désormais « ≤ 24 et > 0 » ; `test/raffinement-partiel.test.js` ④ bis
   vieillit ses tuiles pour continuer d'exercer le rechargement sur place.
2. **La nappe d'attente** : à froid (aucune hauteur récente), une nappe PLATE à
   1 m (de la terre, au-dessus de `seaEps`) au lieu du procédural — dite `vide`,
   recouverte par le premier raffinement. Le repli réseau tombé garde le
   procédural (`rebuild(params, { repliProcedural: true })`).
3. **La teinte par sommet dans le Worker** (`monde/teinte-relief.js`, `kind:
   'teinte'`) sur le chemin du raffinement : `y` et `ny` partent (transférés), les
   couleurs reviennent écrire `color` en place une image plus tard. **Même octet**
   (`test/teinte-relief.test.js` compare à la boucle d'origine, `Buffer.equals`).
   Jamais sur une géométrie neuve ni au changement de niveau (peint en ligne).
4. **Le grain cuit d'avance dans le Worker** (`kind: 'grain'`, `cuireDetailField` /
   `cuireTintField` sans cache, `poserDetailField` / `poserTintField` côté fil),
   lancé au démarrage et à chaque `loadSurface`.
5. **Plus deux `gridNormals` par raffinement** : `appliquerHauteurs(…, { normales:
   false })` quand `_ecrireRelief` va les refaire après le grain (prédicat unique
   `terrain.grainSuivra`, compte rendu `normalesManquantes`).
6. **Raffinements espacés** (`RAFFINEMENT_SOCLE_MS = 350`, le premier et le dernier
   partent toujours) et **le socle une image plus tard** (`_socleAttendPlinthe`).
7. **`regenerateTerrain` coupée en deux tâches** : relief + socle + matière, puis
   `setTimeout(0)`, puis eau, calques, étiquettes, nuages.
8. **`rebuildRoughness` mémorisée** par (graine, échelle, rugosité, variation).

| mesure (descente, Chamonix z12) | avant | après |
|---|---|---|
| **plus longue tâche, ×4** (banc) | **2 478 ms** (PA : 1 995) | **660 ms** (÷3,8 ; ÷3,0 contre PA) |
| **plus longue tâche, ×1** (banc) | **991 ms** (PA : 482) | **245 ms** (÷4,0 ; ÷2,0 contre PA) |
| les cinq suivantes, ×4 | 497 · 494 · 408 · 403 | 573 · 340 · 319 · 309 |
| `terrain.rebuild` à la plongée, ×4 (sonde) | 2 908 ms | 405–435 ms |
| `rafraichirFenetre` par tuile, ×4 (sonde) | 330–810 ms | 106–370 ms |
| `_ecrireRelief` par raffinement, ×4 | 160–450 ms | 50–110 ms |
| CPU p99 descente ×1 / ×4 (banc) | 232 / 450 | 128 / 499* |
| requêtes / octets dans la fenêtre de 14 s, ×1 | 206 / 25,8 Mo (PA : 332 / 41,8) | 289 / 38,4 Mo |

\* le p99 à ×4 est dominé par la période de 33 ms du banc chargé (voir l'avertissement
en tête) ; les tâches longues, elles, ont baissé sur toute la liste.

⚠️ **Les octets de la fenêtre montent à ×1 (25,8 → 38,4 Mo) et restent sous PA
(41,8).** Aucun budget n'a été desserré (cache, file, crédit intacts) : PA §⑤
avait relevé que « le streaming est bridé par le fil principal » ; le fil libéré
réclame plus vite dans la même fenêtre de 14 s, il ne réclame pas plus au total
(l'emprise est la même). À ×4 : 87 → 117 requêtes, 10,0 → 11,9 Mo.

**Ce qui reste dans la tâche de 660 ms** (×4) : `terrain.rebuild` ~400 (le
`remplirHauteurs` + `sampleHeights` sur 591 361 sommets, `gridNormals`, la
teinte en ligne au changement de niveau) + `plinth.rebuild` ~170 (`pousse` alloue
trois `Vector3` par triangle — **`plinth.js` n'est pas dans mon périmètre**, c'est
le prochain poste : 680 ms de temps propre sur la descente ×4).

### Poste ⑤ — le rendu à la demande au repos : **non retenu**

La condition du brief (« si le témoin de PA le permet ») n'est pas remplie : au
repos dans le crop, `clouds.update` et `globe.animerMer` tournent à chaque
image et PA a mesuré 59–61 % de pixels qui changent seuls. Il faudrait la liste
exhaustive des sources de changement (PB §rendu à la demande) — un chantier, pas
un poste de cette nuit. La cadence de repos en orbite (`cadence-repos.js`) reste.

---

## ③ CE QUE J'AI ÉCARTÉ, ET LA MESURE QUI L'A ÉCARTÉ

- **La mémoïsation de `contexteCrop`** : 0,024 ms par appel en boucle — il n'y
  avait rien à mémoïser ; c'était une lecture DOM (§②-①).
- **Une table (LUT) pour `natGris`** : elle aurait changé le dernier bit de la
  couleur par sommet, donc pu changer un pixel au repos — critère ⛔. Le Worker
  rend le même octet.
- **Déporter `remplirHauteurs` (le `sampleHeights`, 1 186 ms sur la descente ×4
  après correctif)** : il faudrait copier les hauteurs des tuiles vers le Worker
  (9 Mo par raffinement) et rendre asynchrone toute la chaîne `hauteursDeFlux →
  majHauteurs → terrain.sample → plinth`, que quatre modules lisent en
  synchrone. Trop de surface pour une nuit à six agents ; c'est le prochain
  levier avec `pousse`.
- **`BatchedMesh`, `skipLevelOfDetail`, résolution dynamique** : ⛔ du brief.

---

## ④ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« `contexteCrop` est cher parce qu'il reconstruit un gros objet. »** Faux :
   24 µs en boucle. C'est `clientHeight`. J'ai failli écrire une mémo sur la
   signature — elle aurait laissé la lecture DOM en place, dans la signature.
2. **« Le banc de PA ne descend plus sur cet arbre » (premier relevé : mode
   `orbital`, altitude 60 000 m, crop absent).** Faux : `loadSurface` avait levé
   « SURFACE DATA UNAVAILABLE » parce que Vite ré-optimisait ses dépendances au
   moment exact du vol (rechargement de page). Rejoué : atterrissage normal.
   Leçon payée deux fois : **ne pas éditer `src/` pendant qu'un banc tourne** — un
   HMR a tué un second relevé (`__pa` disparu, `Cannot read 'demarre'`).
3. **« Le `noise` de la descente, c'est la cuisson du grain (`detailField`). »**
   À moitié faux : le grain est en cache dès l'accueil. Le `noise` venait du
   **sampler procédural** appelé à la plongée faute de hauteurs — vu seulement en
   enveloppant `rebuild` avec `dem=false` et `remplirDepuisFlux → null` côte à côte.
   Le préchauffage du grain dans le Worker reste utile (première finesse, autre
   graine), mais ce n'est pas lui qui a rendu les 2 500 ms.
4. **« Les gains se liront sur le CPU p50 du banc. »** Non : entre deux sessions
   à code égal, le p50 du crop ×4 a bougé de 22,3 à 25,4 puis 32,7 ms (machine
   partagée). Seuls l'A/B même session, les enveloppes par poste et la plus
   longue tâche sont publiables — d'où le tableau.

---

## ⑤ CE QUI EST VISIBLE, ET CE QUI NE L'EST PAS

- Au repos : **rien ne change** — même boîte, même `clientHeight`, même octets de
  teinte, même tuile la plus fine. Capture de contrôle après la descente
  (`.banc/FLU-repos.png`) : Chamonix, 16 teintes déportées arrivées, 0 erreur.
- Pendant un raffinement : la teinte du bloc a une image de retard sur ses
  hauteurs (quelques millièmes), et les parois une image de retard sur le relief.
- À la plongée : le relief du **parent** apparaît avant le fin (au lieu d'un
  relief procédural) ; à froid seulement, une plaque plate un instant.
- ⚠️ **À faire lire à Adrien** : la nappe d'attente plate (à froid) et le retard
  d'une image des parois — deux choix de rendu transitoire que je préfère
  annoncer qu'enterrer.

---

## ⑥ FICHIERS ET LIGNES (pour `wt-bla` et `wt-soc`)

- `src/main.js` : `cacheToile` (après `applyRenderSize`), `projectionSaisie`,
  `contexteCrop → mer.hauteurPx`, `socleRaffine` + `RAFFINEMENT_SOCLE_MS` +
  `HAUTEUR_ATTENTE_M`, `hauteursDeFlux` (option `normales`, nappe `vide`),
  `regenerateTerrain` (coupure), `loadSurface` (préchauffage), export `contexteCrop`.
- `src/globe.js` : `_tuileLaPlusFine` (étiquette + `break`), `tuilesAvecHauteurs`
  (étiquette), `_buildMesh` fin (`_retenirHauteurs`), `HAUTEURS_RECENTES_MAX`.
  **`wt-soc`** : je n'ai pas touché `poserCrop`, la plaque ni les parois.
- `src/terrain.js` : `grainSuivra`, `prechauffeGrainHorsFil`, `_posterTeinte`,
  `_ecrireRelief` (normales manquantes, teinte déportée, grain sur `vide`),
  `_remplirDepuisFlux` (`vide`, `repliProcedural`), `rebuild` (option),
  `rafraichirFenetre` (`teinteDeportee`), `rebuildRoughness` (mémo).
  **`wt-bla`** : `natGris` (`eclairage-crop.js`) n'a pas changé d'une ligne — son
  COÛT est déplacé dans le Worker, sa COULEUR est à vous.
- `src/monde/fenetre-bornee.js` : `appliquerHauteurs` / `majHauteurs` (option
  `normales`). `src/detail-noise.js` : cuisson sans cache + pose. `src/terrain-jobs.js`,
  `src/terrain-worker.js` : `teinte`, `grain`. Nouveaux : `src/monde/rect-toile.js`,
  `src/monde/teinte-relief.js`.
- Tests nouveaux (inscrits dans `package.json`) : `tuile-la-plus-fine`, `rect-toile`,
  `teinte-relief`, `hauteurs-recentes`. Adaptés : `globe-eviction` (borne 24),
  `fenetre-branchee` ⑩h (regex de l'appel), `raffinement-partiel` ④ bis.
- Bancs et sondes : `scripts/banc-pa-budget.mjs`, `.banc/sonde-*.mjs`, traces
  `.banc/PA/budget-{base,flu1,flu}-x{1,4}-vsync.json`, `.banc/sonde-*.log`.
