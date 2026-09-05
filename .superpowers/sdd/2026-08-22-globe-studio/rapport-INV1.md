# INV1 — L'HÉRITAGE DE LA TERRE PLATE : inventaire prouvé

**Photo du dépôt** : `regroupement` au 2026-09-04, arbre `C:\Dev\wt-inv1`, branche
`inv-plat`, tête `f558ed8` (« Fusion MER2 »). ⚠️ `wt-cull` (globe.js), `wt-sortie`
(gestes), `wt-veto` (bathymétrie) écrivent en parallèle : **ces trois fichiers-là
bougeront après cette photo.**

**Preuves de non-régression** : `git diff` **vide** · `npm test` → **4 899 / 0** ·
`npm run audit:tests` → **263 listés · 263 sur disque · aucun écart**.

---

## 0. LA RÉPONSE COURTE, ET ELLE EST DÉSAGRÉABLE

> **Il n'y a presque pas de « fichiers de terre plate » à supprimer.**

Trois mesures le disent, et ce sont les trois qu'on peut rejouer :

| mesure | résultat |
|---|---|
| graphe d'imports statique + `import()` + `new URL()` depuis `src/boot.js` | **268 modules atteints, 6 orphelins** sur 274 |
| exports de `src/` sans **aucun** lecteur (ni prod, ni test, ni script) | **24 symboles** sur 1 984 |
| fichiers de test hors de la liste `package.json` | **0** |

La raison est structurelle : **le monde plat n'a pas été remplacé, il a été
converti.** `terrain.js`, `plinth.js`, `block-grid.js`, `damier-*.js`,
`sea-mask.js`, `relief-grade.js` sont exactement les modules du monde plat — et
ce sont exactement ceux qui fabriquent **le crop d'aujourd'hui**. Le pivot a
changé *où* le bloc est posé (sur une sphère), pas *comment* il est fabriqué.

**Ce qui reste vraiment de l'avant-globe est de trois natures :**

1. **La fenêtre continue 3×3** (`?f3=1`) — le jalon 1 du plan
   « terrain continu sous une fenêtre fixe » du 2026-07-29, **éteint
   délibérément**, mais **encore câblé et encore joignable par l'adresse**.
   C'est la seule grosse masse : **~80 Ko de code + ~48 Ko de tests.**
2. **Des restes de l'ère « calques posés à plat »** (drapage, panneaux pliants) :
   petits, mais à zéro référence, donc **certains**.
3. **Des branches de repli** vers les régimes d'avant (`?globe=crans`,
   `?terre=0`, `?socle=mnt`), qui ne sont pas mortes : ce sont **les sorties de
   secours qu'Adrien a explicitement gardées** (`flags.js`).

---

## 1. LE TABLEAU, TRIÉ PAR OCTETS LIBÉRÉS

### Barème de confiance appliqué
- **certain** — zéro référence dans tout le dépôt hors lui-même et ses tests, **et**
  aucun chemin dynamique candidat.
- **probable** — référencé, mais seulement depuis d'autres candidats morts, ou
  derrière un drapeau éteint par défaut.
- **à vérifier à l'exécution** — chargement dynamique, chaîne composée, clé
  d'objet calculée.

| # | candidat (fichier / symbole) | octets | pourquoi c'est mort | la preuve (commande + résultat) | confiance | risque |
|---|---|---:|---|---|---|---|
| 1 | **La grappe `?f3=1` — fenêtre continue 3×3** (voir §3, grappe A) | **128 142** (80 559 code + 47 583 tests) | Jalon 1 du monde plat continu, `FLAGS.fenetreContinue: false`, « RESTENT ÉTEINTS, ET C'EST DÉLIBÉRÉ » (`flags.js:24`) | `grep -n "fenetreContinue: false" src/flags.js` → l.63 ; toutes les entrées runtime passent par `fenetreContinueActive()` (`main.js:3010`), qui rend `false` sans `?f3=1` | **probable** | **ÉLEVÉ** — 39 Ko sont **dans `main.js`**, entrelacés (l.2979-3700) ; ce n'est pas une suppression de fichier, c'est une amputation |
| 2 | `public/demo/grande-traversee.gpx` | **832 390** | Le produit ne lit que le `.json` frère ; le `.gpx` est le fichier **source** de la démo, publié par erreur | `grep -rn "grande-traversee" src index.html netlify scripts test docs \| grep -v race.json` → **aucune sortie** ; seuls `main.js:9196` et `ui/studio.js:328` font `fetch('/demo/grande-traversee.shibumap-race.json')` | **certain** | faible — vérifier qu'aucun lien externe (blog, mail) ne le pointe. ⚠️ **recoupement INV3** (poids réel) |
| 3 | `src/pilote-banc.js` + `src/poursuite-banc.js` | **20 557** | Bancs d'essai du pilote ; `ui/bars.js:437` prétend qu'ils sont « chargés à la demande par `import()` » — **cet `import()` n'existe pas** | ① graphe depuis `boot.js` : orphelins. ② `grep -rn "import(" src \| grep -v vendor` → 20 sites, **aucun** vers ces deux fichiers. ③ `grep -rln "pilote-banc\|poursuite-banc\|bancVol\|bancPoursuite\|apercuVol" scripts docs .superpowers` → **vide** | **certain** (joignabilité) | moyen — usage manuel possible en console pendant un tournage ; `poursuite-banc` importe `pilote-banc`, ils partent **ensemble** |
| 4 | `src/monde/exageration-continue.js` §4 — `zoomCadrage`, `majExagerationCadrage` | **6 960** | Le fichier le dit lui-même l.244 : « **CE QUI SUIT N'EST PLUS APPELÉ PAR AUCUN CHEMIN DE PRODUCTION** ». Pilote de la fenêtre continue, remplacé par le §4 bis (pilote au cran) | `grep -rn "majExagerationCadrage\|zoomCadrage" src test scripts \| grep -v exageration-continue.js` → `flags.js`/`main.js` = **commentaires** ; `monde/fenetre-bornee.js:289,292` = **ré-export en tonneau, sans consommateur** ; le reste = `test/exageration-globe.test.js`, `test/fenetre-branchee.test.js` | **probable** | moyen — le module demande explicitement à garder la mesure ; supprimer tuerait ② à ⑤b de `fenetre-branchee.test.js` |
| 5 | `src/drag.js` :: `makeCollapsible`, `collapseAll`, `setUiHidden` (l.100-155) | **1 664** | Panneaux pliants de l'ère « fenêtres flottantes », remplacés par le shell (`ui/shell.js:87`, « exclusive column accordion ») | balayage d'exports : `prod=0, test=0, script=0, self=0` — voir §5 pour la commande | **certain** | faible |
| 6 | `src/accordion.js` (+ `test/accordion.test.js`) | **2 563** (927 + 1 636) | Aucun importeur de production ; l'accordéon vit dans `ui/shell.js` | `grep -rn "accordion.js'" src test` → **une seule ligne**, `test/accordion.test.js:3` | **certain** | faible — retire 2 tests du compte 4 899 |
| 7 | `src/map/draped-line.js` :: `densifyWorld`, `drapeWorld` (l.5-27) (+ `test/draped-line.test.js`) | **1 803** (750 + 1 053) | Drapage d'une polyligne sur un terrain **plat en XZ** — la mécanique des calques du monde d'avant. Partait avec le calque Routes (`map/tile-loader.js:125` : « PLUS de `road-tiles` : le calque Routes a quitté le site ») | `grep -rn "densifyWorld\|drapeWorld" src test scripts` → **uniquement** leur définition + `test/draped-line.test.js`. ⚠️ `latlonToWorldPts` du **même fichier** est vivant (`map/water-layer.js:5`) : **le fichier reste, les deux fonctions partent** | **certain** | faible — c'est le cas que le brief cite ; confirmé |
| 8 | Le champ `fen` du format de partage | ~15 lignes réparties | Écrit `{x:0,z:0}` toujours (`main.js:11012,11921` : `fenetreContinueActive() ? terrain.fenetre : null`), relu dans `f3PoseFenetre` (`main.js:3470`) qui **sort en `false` à la première ligne** hors `?f3=1` | `grep -rn "\.fen\b" src \| grep -v share-link` → 3 sites, tous vers `pendingShareFen` → `f3PoseFenetre` | **probable** | moyen — **format persisté** : des liens partagés portent le champ. Le lecteur doit rester tolérant même si l'écrivain disparaît. **Fait partie de la grappe A** |
| 9 | `src/ocean.js` :: uniforme `uCaustics` | 2 lignes | Déclaré (l.398) et initialisé à 2,4 (l.898), **jamais lu dans le GLSL** | `grep -n "uCaustics" src/ocean.js` → **exactement 2 lignes**, aucune dans le corps du shader (le vivant est `uSeabedCaustics`, l.385/883/1813) | **certain** | nul. ⚠️ **recoupement INV2** |
| 10 | 21 autres exports à zéro référence (§5) | ~3 000 estimés | aucun lecteur nulle part | balayage d'exports, §5 | **certain** symbole par symbole | faible — **aucun n'est de la terre plate**, c'est du recoupement INV2 |

### Les totaux

| catégorie | octets |
|---|---:|
| **données** (disque / CDN) | **832 390** |
| **code** de production | **~113 100** — dont 80 559 pour la seule grappe `?f3=1` (39 000 à l'intérieur de `main.js`) |
| **tests** | **~50 300** — 47 583 (grappe A) + 1 636 (accordion) + 1 053 (draped-line) |
| **TOTAL** | **~995 800 octets**, dont **84 % de données** et **1 fichier** |

⚠️ **La lecture honnête de ce tableau** : hors le `.gpx` de démo, la terre plate
ne pèse pas 1 Mo de fichiers à jeter. Elle pèse **une amputation de `main.js`**.

---

## 2. ⚠️ CE QUI RESSEMBLE À DE LA TERRE PLATE MAIS EST VIVANT

**C'est la section la plus utile du rapport.** Un agent supprimeur qui se fie aux
noms casse le crop en dix minutes.

| ça ressemble à de la terre plate | c'est **VIVANT**, et voici la preuve |
|---|---|
| `src/terrain.js` (203 578 o), `TERRAIN_SIZE` | **Le maillage du crop lui-même.** `main.js` construit `terrain` et le globe l'habille. `block-grid.js:18` importe `Terrain` et `TERRAIN_SIZE` |
| `src/plinth.js` (53 479 o), « socle » | Le socle cubique du crop, **la fonction principale du produit**. `main.js` appelle `plinth.rebuild(...)` |
| `src/block-grid.js` (75 301 o) — le damier de blocs voisins | `main.js:8285` : `const blockGrid = new BlockGrid({...})`, puis `blockGrid.sync/restyle/diffuseDuCentre` sur **12 sites**. Sert au débordement GPX aux zooms fins **et au mode zone isolée** |
| `src/damier-carre.js`, `src/damier-bords.js` | Modules **purs** importés par `block-grid.js`, `plinth.js`, `terrain.js`, `ocean.js`, `map/block-clip.js`, `monde/crop-sphere.js`, `ground-info-layer.js`, `vue-ensemble.js` |
| `src/fenetre-clip.js` — nom « fenêtre » | ⛔ **PIÈGE.** `exposantCoin`/`pointCoin`/`arcCoin` sont lus par `block-grid.js:22`, `monde/fenetre-bornee.js:231` et **`monde/parois-crop.js:260`** — c'est la géométrie des **coins arrondis du socle sphérique**, pas la fenêtre 3×3 |
| `src/monde/fenetre-bornee.js` (41 762 o) — nom « fenêtre » | ⛔ **PIÈGE MAJEUR.** `flags.js:117` : *« `socleQuadtree` … exige la fenêtre bornée »*. C'est **l'emprise du socle sur le globe**, drapeau **levé** |
| `scripts/plat-*.mjs` (5 fichiers, 20 946 o) | ⛔ **PIÈGE.** `PLAT` est le **nom de code d'une tâche récente sur la bathymétrie** (les *carrés plats* de la mer), pas la terre plate. Preuve : commit `29a84b8` « Fusion PLAT : une source grossière ne reclasse plus de la terre en mer ». Idem `test/bathy-echelle-plat.test.js` |
| Les 21 occurrences de « mode plat » dans les commentaires | Vocabulaire **historique pour le mode surface/bloc**, qui est le produit actuel. Ex. `monde/mer-sphere.js:964` : *« l'emprise 3×3 du mode plat »* — cité comme **référence de calibration** de la calotte de mer sphérique, pas comme code appelé |
| `src/escalier-zoom.js`, `DIVE_TIERS`, les paliers | Toujours importés par `modes.js:14` et `main.js:34`. Les branches `!this._continu()` sont le régime d'avant, **joignable par `?terre=0` / `?globe=crans`** : **sortie de secours voulue**, pas code mort |
| `src/monde/lumiere-sphere.js` :: `curseursMorts` | Le mot « morts » est dans le **nom d'une fonction vivante** qui masque les curseurs sans effet sur la sphère (`reglageAgit`). Ne pas supprimer : c'est le mécanisme qui **empêche** les options fantômes |
| `src/shuffle-pool.js` | Son en-tête dit « code mort depuis l'arrivée des biomes » — **il parle de `generatePalette` qu'il a RESSUSCITÉ**. Le module est importé par `main.js:52` |
| `src/map/place-tier.js` | Orphelin **du graphe navigateur**, mais vivant **à la cuisson** : `scripts/build-places.mjs:17` |
| `src/monde/audit-solide.js`, `src/monde/descente-bornee.js` (34 790 o) | Orphelins du graphe navigateur, mais **modules de preuve** cités nommément par `globe.js:7834`, `monde/parois-crop.js:960`, `ui/indicateur-retard.js:21` et exercés par 4 tests de la liste. Travail **globe récent**, pas terre plate |
| `public/data/water-tiles/`, `lake-tiles/` (258 Mo) | Chemins **composés** : `makeTileSource(kind)` puis `` fetch(`data/${kind}/index.json`) `` (`map/tile-loader.js:110,122,136`). **Invisible au grep de `water-tiles`.** Vivants |

---

## 3. LES GRAPPES — ce qui part ensemble ou pas du tout

### Grappe A — la fenêtre continue 3×3 (`?f3=1`) · 128 142 o
Le monde plat continu. Se supprime **entièrement ou pas du tout** : chaque
morceau ne sert qu'aux autres.

| pièce | octets |
|---|---:|
| `src/main.js` l.2979-3700 (`_f3*`, `f3Tick`, `f3EcritFenetre`, `f3CentreSur`, `f3Fige`, `f3AncreAuSol`, `f3SuitAuSol`, `f3CalquesSuivent`, `f3PoseFenetre`, `fenetreContinueActive`, `f3Applique`) + ~25 sites d'appel dispersés | 38 961 |
| `src/fenetre-elan.js` | 14 303 |
| `src/fenetre-course.js` | 10 613 |
| `src/fenetre-finesse.js` | 9 384 |
| `src/fenetre-reglage.js` (+ ré-export `gardien.js:149`) | 7 298 |
| `FLAGS.fenetreContinue` + son bloc de commentaire (`flags.js:49-63`) | ~1 000 |
| le champ `fen` de `share-link.js` (l.67, 113, 195-204) et `pendingShareFen` | ~500 |
| **tests** : `fenetre-elan`, `fenetre-course`, `fenetre-finesse`, `fenetre-reglage`, `fenetre-centrage` | 47 583 |

⛔ **N'ENTRENT PAS DANS LA GRAPPE** malgré leur nom : `fenetre-clip.js`,
`monde/fenetre-bornee.js`, `test/fenetre-bornee.test.js`,
`test/fenetre-coin-exposant.test.js`, `test/fenetre-clip.test.js`.
⚠️ `test/fenetre-branchee.test.js` (102 871 o) est **mixte** : ses ② à ⑤b
appartiennent à la grappe B, le reste au socle vivant.

### Grappe B — le pilote d'exagération par cadrage · 6 960 o + tests
`zoomCadrage` + `majExagerationCadrage` + le ré-export de `fenetre-bornee.js`
(l.289, 292) + les cas ② à ⑤b de `test/fenetre-branchee.test.js` + les cas de
`test/exageration-globe.test.js` qui l'exercent. **Le reste du fichier
`exageration-continue.js` est vivant** (`lireExageration` a douze lecteurs).

### Grappe C — les bancs du pilote · 20 557 o
`src/poursuite-banc.js` importe `src/pilote-banc.js` (l.140). Le commentaire
menteur de `ui/bars.js:437-438` part avec.

### Grappe D — le drapage à plat · 1 803 o
`densifyWorld` + `drapeWorld` + `test/draped-line.test.js`.
⚠️ `latlonToWorldPts` **reste** dans le fichier.

---

## 4. L'ORDRE DE SUPPRESSION RECOMMANDÉ, du plus sûr au plus risqué

1. **`public/demo/grande-traversee.gpx`** — un fichier, zéro ligne de code, 832 Ko.
   Rien à retester. *(Vérifier d'abord qu'aucune communication ne le pointe.)*
2. **`src/ocean.js` :: `uCaustics`** (2 lignes) — aucun test ne le touche.
3. **Grappe D** (drapage) puis **`src/drag.js`** (3 fonctions) puis
   **`src/accordion.js` + son test** — trois suppressions indépendantes, chacune
   vérifiable par `npm test` (le compte passe de 4 899 à ~4 895, `audit:tests`
   doit descendre de 263 à 262 en retirant `accordion.test.js` de la liste
   `package.json` **dans le même commit**, sinon la ligne `test` casse).
4. **Grappe C** (bancs du pilote) — deux fichiers entiers, aucun test.
5. **Grappe B** (pilote de cadrage) — demande de retirer des cas de test nommés ;
   ⚠️ le module demande explicitement à garder la mesure : **poser la question à
   Adrien avant**.
6. **Les 21 exports restants du §5** — un par un, chacun avec son `npm test`.
7. ⛔ **Grappe A en dernier, et pas sans arbitrage.** C'est une amputation de
   `main.js`, elle touche le format de partage, et elle supprime une réponse
   qu'Adrien n'a jamais formellement rendue (« le geste vaut-il le coup ? »,
   §7 de l'étude 3×3). **Tant qu'elle est là, `?f3=1` répond encore.**

---

## 5. LES 24 EXPORTS À ZÉRO RÉFÉRENCE

Commande (reproductible) : balayage de tous les `export function|const|class` de
`src/`, comptés hors commentaires dans `src/`, `test/`, `scripts/`, `netlify/`,
en excluant leur propre ligne de déclaration.

```
src/arch.js :: OLD_ARCH_TOTAL_HEIGHT          src/nuit.js :: NUIT_PLEINE
src/compositeur-affiche.js :: EFFETS_EN_LINEAIRE  src/nuit.js :: JOUR_PLEIN
src/compte.js :: CODES_REFUS                  src/pdf-affiche.js :: INTENTION_RVB
src/dem.js :: knownMaxZoomAt                  src/pilote-banc.js :: apercuVol
src/drag.js :: makeCollapsible                src/pilote-banc.js :: bancShibu
src/drag.js :: collapseAll                    src/pilote.js :: surLeBord
src/drag.js :: setUiHidden                    src/poursuite-banc.js :: bancPoursuite
src/export.js :: exportVideo                  src/poursuite-banc.js :: apercuPoursuite
src/loi-altitude.js :: altitudePourDistance   src/ui/compte.js :: reinitialisePorte
src/map/aerial-layer.js :: IGN_ATTRIBUTION    src/ui/liquid.js :: LQ_PAD
src/map/aerial-layer.js :: SWISSTOPO_ATTRIBUTION  src/ui/tutorial.js :: maybeStartTutorial
src/material-textures.js :: SURFACE_MATERIALS src/monde/photo-monde.js :: ATTRIBUTION_MONDE
```

⚠️ **Trois pièges dans cette liste** : `IGN_ATTRIBUTION`,
`SWISSTOPO_ATTRIBUTION`, `ATTRIBUTION_MONDE` sont des **mentions légales**. Le
crédit affiché passe par `PROVIDERS` / un autre chemin ; **vérifier à l'écran
qu'un crédit ne disparaît pas** avant de toucher. `exportVideo` et
`maybeStartTutorial` méritent une lecture : ce sont des points d'entrée de
fonctionnalités visibles, susceptibles d'être appelés depuis une chaîne.

---

## 6. LES CHEMINS DYNAMIQUES — cherchés **avant** de conclure

Aucune de mes lignes « certain » ne peut être atteinte par l'un de ces chemins.

| chemin dynamique | où | conséquence |
|---|---|---|
| `import()` — 20 sites | `boot.js:45`, `globe.js:6478`, `main.js` (×16), `pdf-affiche.js:724` | tous **inclus** dans mon graphe ; aucun ne pointe vers un candidat |
| `` fetch(`data/${kind}/index.json`) `` | `map/tile-loader.js:110` via `makeTileSource('water-tiles'\|'lake-tiles')` | **258 Mo de tuiles échappent au grep littéral** — d'où leur classement « vivant » |
| `` `data/bathy/${z}/${x}/${y}.png` `` etc. | `dem.js:49`, `canopee.js:273`, `occupation-sol.js:207`, `map/geo-cells.js:81`, `coast-mask.js:225`, `map/geo-data.js:14` | toutes les grosses arborescences de `public/data/` ont **un** constructeur d'URL, tous vivants |
| `` fetch('/demo/…json') `` | `main.js:9196`, `ui/studio.js:328` | c'est **ce fetch** qui prouve que le `.gpx` frère est orphelin |
| `window.__exp` (console) | fin de `main.js`, documenté par `ui/bars.js:449` | **la seule réserve** sur la grappe C : les bancs sont peut-être appelés à la main pendant un tournage |
| clés composées `` `${i},${j}` `` | `main.js:8492`, `damier-carre.js` | internes au damier vivant |

---

## 7. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« `scripts/plat-*.mjs` = terre plate. »** Cinq fichiers, 20 946 o, nom
   parfait. **Faux** : `PLAT` est le nom de code de la tâche bathymétrie des
   *carrés plats*, fusionnée il y a **trois commits** (`29a84b8`). J'ai failli
   classer du travail de la semaine en héritage mort.
2. **« `src/monde/rampe-crop.js` (54 Ko) est orphelin. »** Mon premier graphe le
   disait. **Faux — c'était mon outil.** Ma regex d'import s'arrêtait sur une
   apostrophe **dans un commentaire à l'intérieur d'un bloc `import { … }`** de
   `globe.js`. Corrigée, le graphe passe de 258 à 268 modules atteints et
   `rampe-crop` rentre dans le vivant (`globe.js:60`). **Leçon : un graphe
   d'imports qui trouve 54 Ko orphelins dans un fichier cité 8 fois par `globe.js`
   est un graphe faux, pas une découverte.**
3. **« `shuffle-pool.js` est mort, il le dit lui-même. »** **Faux** : la phrase
   « du code mort depuis l'arrivée des biomes » parle de `generatePalette`,
   que ce module **ressuscite**. Importé par `main.js:52`.
4. **« `block-grid.js` (75 Ko) = le damier plat d'avant le globe. »** **Faux** :
   `main.js:8285` l'instancie, 12 sites l'appellent, il porte le débordement GPX
   et le mode zone isolée.
5. **« `monde/fenetre-bornee.js` appartient à la grappe `?f3=1`. »** **Faux, et
   c'était la faute la plus chère** : `flags.js:117` dit que le socle quadtree
   **exige** la fenêtre bornée. Deux « fenêtres » sans rapport dans le même dépôt.
6. **« Il doit y avoir des tests hors liste. »** **Faux** : 263 = 263, aucun écart.
   La ligne `test` de `package.json` est propre à cette date.
7. **« `map/place-tier.js` est orphelin. »** Orphelin **du navigateur**, vivant à
   la cuisson (`scripts/build-places.mjs:17`). Un graphe à une seule racine ment.

---

## 8. RECOUPEMENTS SIGNALÉS

- **INV3 (poids réel)** : `public/demo/grande-traversee.gpx` (832 Ko) est à eux
  autant qu'à moi. Et le point le plus important pour eux : **`public/data/`
  pèse 2,15 Go** (bathy 343 Mo, canopée 928 Mo, coast-z6 323 Mo, sol 300 Mo,
  lake-tiles 180 Mo, water-tiles 78 Mo) et **tout est atteint par un chemin
  composé** — qu'ils ne concluent pas « orphelin » sur un grep littéral.
- **INV2 (code mort général)** : les §5 (24 exports), l'uniforme `uCaustics`,
  `src/accordion.js`, les grappes C et D sont du code mort **qui n'a rien à voir
  avec la terre plate**. Ils lui reviennent ; je ne les ai listés que parce que
  ma recherche les a croisés et qu'ils sont prouvés.
- **`scripts/`** : 2 388 345 o au total, dont **38 fichiers (251 469 o) sans
  aucune référence hors de `scripts/`** — sondes et diagnostics à usage unique
  des tâches R15 à R37. Ce n'est **pas** de la terre plate (ces tâches sont du
  chantier globe), mais c'est le plus gros gisement de fichiers jetables du
  dépôt, et il n'appartient à aucun des trois inventaires. **Je le signale pour
  qu'il ne tombe entre personne.**
