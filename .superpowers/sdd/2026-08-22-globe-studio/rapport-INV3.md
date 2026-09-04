# INV3 — CE QUE LE PROGRAMME PAIE VRAIMENT

**Photo de `regroupement` au 2026-09-04**, arbre `C:\Dev\wt-inv3`, branche
`inv-poids`, HEAD `f558ed8` (« Fusion MER2 »). Trois agents modifient du code en
même temps (`wt-cull` sur `globe.js`, `wt-sortie` sur les gestes, `wt-veto` sur
la bathymétrie) : **tout chiffre ci-dessous est daté de cette photo** et sera
faux dès leur fusion. Aucune ligne de `src/` n'a été modifiée de façon durable —
`git diff -- src/` est vide (l'épreuve de mutation, §5, casse et restaure à
l'octet, vérifié après chaque cassure).

Matériel des mesures : ANGLE / NVIDIA GeForce RTX 3080, D3D11, Chrome avec
fenêtre (pas SwiftShader). Serveurs : `vite` dev sur `127.0.0.1:8631`,
`vite preview` sur `127.0.0.1:8641`.

---

## 0. LE RÉSUMÉ EN SIX LIGNES

1. **Il n'y a presque rien à gagner en supprimant du code mort.** Les 8 fichiers
   de `src/` que personne n'importe pèsent **63 785 octets de source et 0 octet
   dans le paquet livré** — Rollup ne les embarque déjà pas.
2. **Le poids du paquet est un poids de bibliothèques, pas de code applicatif** :
   three (804 763 o) + pdf-lib & sa suite (605 946 o) + mediabunny (169 196 o) +
   postprocessing (165 921 o) + n8ao (157 755 o) = **1 903 581 o sur 3 410 166
   attribués**, soit 56 %.
3. **Aucune dépendance de `package.json` n'est morte.** Les neuf sont importées.
   Zéro octet à retirer par ce chemin.
4. **Le vrai gaspillage est en vol, pas dans le paquet** : sur un vol normal,
   **75 à 78 % des tuiles de MNT demandées tombent hors du crop**, et
   **520 tuiles sur 556 sont tenues en mémoire sans jamais être dessinées**.
5. **La liste de tests n'a aucun écart** (263 = 263) — mais **six fichiers
   `test/attaque-*.mjs` (93 326 o) ne tournent jamais** et échappent à
   `audit:tests`, qui ne regarde que `*.test.js`.
6. **L'épreuve de mutation a trouvé un test tautologique** : `course-bar.test.js`
   (61 265 o, 3ᵉ plus gros de la suite) compare une constante à elle-même.

---

## 1. LE PAQUET LIVRÉ, MODULE PAR MODULE

`npx vite build --sourcemap`, 690 modules, 4 min 4 s. Attribution des octets
**minifiés** par décodage des `mappings` VLQ de chaque `.js.map`
(3 410 166 octets attribués sur 3 397 979 octets de JS émis ; l'écart vient des
sauts de ligne et des octets sans source).

### 1.1 Ce qui est chargé au DÉMARRAGE

| fichier | brut | gzip |
|---|---:|---:|
| `assets/index-DAIZ9WzA.js` (entrée) | 13 120 | 5 906 |
| `assets/main-62pt8Cnd.js` | 2 306 958 | 766 301 |
| `assets/main-fgYmZJTo.css` | 107 759 | 19 599 |
| `assets/index-BSw4I1Hq.css` | 17 490 | 3 990 |
| `index.html` | 21 034 | 8 346 |
| **total au démarrage** | **2 466 361** | **804 142** |

### 1.2 Ce qui n'est PAS chargé au démarrage (vérifié : `await import(...)`)

| chunk | octets | atteint pendant un vol normal ? |
|---|---:|---|
| `index-D_mhy0vG.js` (pdf-lib & co) | 728 675 | **non** — export PDF d'affiche |
| `export-recorder-iaKs71K_.js` (mediabunny) | 172 235 | **non** — enregistrement vidéo |
| `N8AO-DWe_0Rr_.js` | 159 247 | **non** — occlusion ambiante à la demande |
| `affiche-*`, `compositeur-*`, `pdf-*`, `coffre-*`, `sonde-materielle`, `export-modal`, `export-presets`, `tutorial` | 55 542 cumulés | non |
| `terrain-worker`, `cloud-volume-worker`, `decodeur-terrarium` | 12 364 | oui (workers) |

**Le découpage est déjà bon.** 1 115 699 octets — 33 % du JS émis — sont hors du
chemin critique et le restent pendant tout le vol. Les avertissements
« chunk > 500 kB » de Rollup portent sur des chunks paresseux.

### 1.3 Les gros modules de `main-62pt8Cnd.js` (2 306 958 o)

| octets | module | atteint en vol |
|---:|---|---|
| 803 237 | `node_modules::three` | oui |
| 213 939 | `src/globe.js` | oui |
| 165 921 | `node_modules::postprocessing` | oui |
| 146 385 | `src/main.js` | oui |
| 85 777 | `src/terrain.js` | oui |
| 43 455 | `src/ocean.js` | oui |
| 33 985 | `src/gpx.js` | **non** sur un vol sans trace GPX |
| 30 580 | `src/clouds2.js` | oui |
| 21 196 | `src/modes.js` | oui |
| 18 835 | `src/ui/bars.js` | oui |
| 18 320 | `src/ui/affiche.js` (chunk séparé) | non |
| 17 116 | `src/ui/create-panel.js` + 13 824 `grapick` | non tant qu'on n'ouvre pas l'éditeur de rampe |
| 16 801 | `src/ui/compte.js` | non tant qu'on ne se connecte pas |

Deux candidats au découpage paresseux, mesurés, **pas** au code mort :
`create-panel.js` + `grapick` = **30 940 o** et `ui/compte.js` = **16 801 o**,
tous deux statiques dans le chunk de démarrage pour des panneaux que le vol
n'ouvre pas.

### 1.4 Les modules de `src/` que personne n'importe

Graphe d'imports depuis `src/boot.js` (statiques, dynamiques et
`new Worker(new URL(...))`) : 265 fichiers JS, **261 atteints, 8 orphelins**.

| octets source | fichier | qui s'en sert encore | dans le paquet ? |
|---:|---|---|---|
| 22 157 | `src/monde/audit-solide.js` | 5 fichiers de test | **non** |
| 12 633 | `src/monde/descente-bornee.js` | 4 fichiers de test | **non** |
| 11 426 | `src/pilote-banc.js` | banc collé à la console | **non** |
| 9 131 | `src/poursuite-banc.js` | idem | **non** |
| 3 574 + 1 713 | `src/vendor/ocean-waves/*` | **faux orphelin** : atteint par l'alias `ocean-waves` de `vite.config.js` | oui |
| 2 224 | `src/map/place-tier.js` | `scripts/build-places.mjs` + 2 tests | non (script de construction) |
| 927 | `src/accordion.js` | **rien, sauf son propre test** | **non** |

**Vérifié dans les `sources` des sourcemaps** : aucun de ces noms n'apparaît, et
aucun n'apparaît dans le JS minifié. Les grep qui semblaient les trouver
tombaient sur le `sourcesContent` — le texte source avec ses commentaires.

➡️ **Supprimer ces fichiers ne rend pas un octet de bande passante.** Ils libèrent
63 785 octets de dépôt et du temps de lecture humaine. C'est un argument
d'entretien, pas de performance : à écrire tel quel dans la décision.

---

## 2. LE RÉSEAU D'UN VOL

Sonde CDP écrite pour cette tâche (domaine `Network`, **jamais**
`getEntriesByType('resource')` et son plafond de 250 entrées), cache désactivé,
protocole identique à chaque tirage : chargement → **orbite** (12 rotations
d'azimut de 0,30 rad) → **descente** (2 000 000 → 800 000 → 300 000 → 120 000 →
45 000 → 18 000 m, 9 s de repos par palier) → **crop** (25 s) → **repos** (20 s).

### 2.1 Quatre vols, chiffres reproductibles

| vol | serveur | requêtes | octets | MNT | MNT hors crop |
|---|---|---:|---:|---:|---:|
| 1 | dev 8631, adresse par défaut | 748 | 78 326 747 | 297 | **231 (77,8 %)** |
| 2 | dev 8631, répétition | 729 | 76 287 352 | 287 | **221 (77,0 %)** |
| 3 | dev 8631, `globe=continu&socle=quadtree` | 679 | 73 334 499 | 262 | **196 (74,8 %)** |
| 4 | **preview du paquet** 8641 | 451 | 37 312 055 | 289 | (non mesurable : `crop-sphere.js` n'est pas importable depuis une page de production) |

Le départage dedans/dehors est fait **par l'application elle-même** —
`tuileDansCrop` de `src/monde/crop-sphere.js` appelé sur le `globe._crop` vivant,
pas par une réimplémentation.

L'écart dev/production (78,3 → 37,3 Mo) est **entièrement** le service des
modules non groupés par Vite : famille `module-dev`, 278 requêtes, 35 183 955
octets, qui disparaît en production. Ne jamais citer le chiffre de dev comme un
coût de produit.

### 2.2 Le vol de production, par famille

| requêtes | octets | famille |
|---:|---:|---|
| 289 | 30 828 255 | **MNT externe** (mapterhorn/AWS), 6 échecs |
| 2 | 2 773 490 | `data/map` (dont `places.json` seul : 2 764 869) |
| 111 | 2 619 521 | `data/bathy` |
| 8 | 848 460 | local (dont `models/plane.glb`, 586 929) |
| 18 | 100 832 | `textures` |
| 17 | 98 084 | externe (polices, etc.) |
| 2 | 24 511 | CSS |
| 1 | 12 019 | `templates` |
| 1 | 6 210 | `coast-z6` |

**82,6 % du vol est du MNT.** Le paquet JavaScript complet (804 kB gzip) est
**2,6 % du vol**. Toute discussion de « bande passante » qui porte sur le poids du
code se trompe de deux ordres de grandeur.

### 2.3 CE QUI EST CHARGÉ SANS JAMAIS ÊTRE DESSINÉ

C'est la mesure la plus dure du rapport, et elle est identique aux quatre vols :

| jalon | `tiles` en mémoire | `_drawn` | mailles visibles |
|---|---:|---:|---:|
| après démarrage | 112 | **36** | 42 |
| après orbite | 112 | **36** | 42 |
| 2 000 000 m | 262 | **36** | 42 |
| 300 000 m | 390 | **36** | 42 |
| 45 000 m | 556 | **36** | 42 |
| après crop + repos | 556 | **36** | 42 |

**`_drawn` ne bouge jamais : 36, du démarrage au repos.** Le crop est un socle
fixe (c'est la décision « fenêtre continue 3×3 », socle fixe + déplacement
dedans) : monter à 2 000 km et redescendre ne change pas ce qui est dessiné.
Pendant ce temps le cache passe de 112 à 556 tuiles (`cacheMax = 1700`, jamais
atteint, donc **aucune éviction n'a lieu**), et **231 des 297 tuiles de MNT
demandées tombent hors du crop**.

Traduit en octets sur le vol de production : sur 30,8 Mo de MNT, la part hors
crop, au taux mesuré en dev (77,8 %), pèse de l'ordre de **24 Mo par vol**.
C'est, de très loin, le premier poste de bande passante du produit.

⚠️ **Ce n'est pas du code mort** : ce chemin est vivant, il coûte, et il coûte
pour rien à l'écran. Il ne relève pas d'une suppression mais d'un resserrement
de la garde d'emprise — à confier à `wt-cull`, pas à ce chantier.

Deux notes honnêtes :
- **au repos, rien ne part** (0 requête pendant les 20 dernières secondes, file
  vide, `inFlight = 0`) : il n'y a pas de fuite de fond ;
- **3 doublons d'URL seulement** sur 451 requêtes en production ; le cache
  applicatif fait son travail.

---

## 3. LES DONNÉES SUR DISQUE

### 3.1 Ce qui est PROPRE au dépôt

| octets | chemin | qui le lit |
|---:|---|---|
| 28 367 015 | `public/data/map/` | `src/map/geo-data.js` |
| 13 848 017 | `public/textures/` | `background.js`, `material-catalog.js`, `terrain.js` |
| 5 480 263 | `public/geo/` | `src/geo-fr.js` |
| 1 883 044 | `public/data/land-10m.json` | `src/coast-mask.js` + 3 scripts |
| 1 875 933 | `public/demo/` | `main.js`, `ui/studio.js` |
| 713 809 | `public/models/` | `arch.js`, `traffic.js` |
| 691 377 | `public/og.png` | balise `og:image` de `index.html` |
| 315 845 | `public/templates/` | 4 modules |
| 25 406 | `public/tableau-de-bord/` | `netlify/functions/tableau.mjs` |
| 25 118 | `public/fr/` | `geo-fr.js`, `map/aerial-layer.js` |

**Balayage fichier par fichier de `public/textures/` : 0 orphelin sur 13,8 Mo.**
Chaque nom de fichier est cité par `src/`, `index.html`, `scripts/` ou un
template. Rien à supprimer là.

Détail de `public/data/map/` (28,4 Mo), tous **livrés dans `dist/`** :

| octets | fichier | demandé pendant le vol ? |
|---:|---|---|
| 9 988 073 | `rivers.json` | **non** |
| 8 837 652 | `coastline.json` | **non** |
| 6 539 071 | `places.json` | **oui, 2 764 869 o gzip, au démarrage** |
| 3 002 219 | `lakes.json` | **non** |

Ces quatre monolithes sont le **repli** documenté dans `geo-data.js` : le chemin
normal découpe en cellules (`build:mapcells`) et ne tire que 1 à 4 cellules par
vue. Voir §7 pour ce que j'en ai d'abord conclu à tort.

### 3.2 Les JONCTIONS — poids PARTAGÉ, pas propre au dépôt

`public/data/{bathy,canopee,coast-z6,lake-tiles,sol,water-tiles}` sont des
jonctions Windows vers `C:\Dev\wt-merge\public\data\…`. `du -sb` sur la jonction
rend **41 octets** ; il faut descendre d'un cran (`public/data/bathy/*`).

| octets | fichiers | dossier |
|---:|---:|---|
| 928 325 703 | 71 569 | `canopee` |
| 343 166 144 | 23 626 | `bathy` |
| 323 198 945 | 2 361 | `coast-z6` |
| 300 237 272 | 78 069 | `sol` |
| 179 570 559 | 2 255 | `lake-tiles` |
| 78 170 154 | 487 | `water-tiles` |
| **2 152 668 777** | **178 367** | **total, PARTAGÉ entre tous les arbres** |

Ces 2,15 Go sont **gitignorés et régénérables** (`.gitignore` l. 12-30). Ils ne
pèsent ni dans le dépôt, ni dans un `git clone` — mais ils **pèsent dans le
déploiement** : `dist/` mesuré à **2 225 881 846 octets**, ce qui recoupe le
« 2,5 Go, 150 000 fichiers » écrit dans `scripts/nettoie-dist.mjs`.

Sur ces 2,15 Go, un vol normal en télécharge **2,6 Mo de bathy et 6 Ko de
coast-z6**, et **rien** de canopée, de sol, de lake-tiles ni de water-tiles. Ce
n'est pas une anomalie (ces couches s'allument à la demande), c'est le rapport
entre l'entrepôt et l'étal : **1 pour 800**.

---

## 4. LES DÉPENDANCES

Vérification par recherche de la spécification exacte d'import dans `src/`,
`scripts/`, `netlify/`, `test/`, `vite.config.js` :

| paquet | importé par | octets qu'il retirerait du paquet |
|---|---|---:|
| `three` | 40+ modules de `src/` | 804 763 — indispensable |
| `@cantoo/pdf-lib` | `src/pdf-affiche.js` (dynamique) | 605 946 avec `@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `crypto-js`, `html-entities`, `pako`, `node-html-better-parser` — **déjà hors du chemin critique** |
| `mediabunny` | `src/export.js`, `src/export-recorder.js` | 169 196 — déjà en chunk paresseux |
| `postprocessing` | `src/main.js` | 165 921 — chunk de démarrage |
| `n8ao` | `src/main.js` (dynamique) | 157 755 — déjà paresseux |
| `grapick` | `src/ui/create-panel.js` (**statique**) | 13 824 — seul candidat au report paresseux |
| `@netlify/blobs` | 4 fonctions Netlify | 0 (serveur) |
| `@duckdb/node-api` (dev) | 3 scripts de construction | 0 |
| `vite` (dev) | `vite.config.js` | 0 |

➡️ **Zéro dépendance non importée. Zéro octet à récupérer en supprimant une
ligne de `package.json`.** L'unique gain mesuré par ce chemin est de rendre
`grapick` (13 824 o) paresseux avec `create-panel.js` (17 116 o) : **30 940 o**
du chunk de démarrage.

---

## 5. LES TESTS

Référence, avant toute manipulation : **`npm test` → 4 899 · 0**, 32,9 s ;
**`audit:tests` → 263 listés · 263 sur disque, aucun écart**. Poids total des
263 fichiers listés : **4 708 408 octets**.

### 5.1 Listés, mais qui ne testent que du code absent du paquet

Confrontation de chaque test listé aux `sources` des sourcemaps (258 modules de
`src/` sont dans le paquet). Quatre tests n'importent **aucun** module livré :

| octets | test | sujet | verdict |
|---:|---|---|---|
| 27 753 | `test/audit-solide.test.js` | `src/monde/audit-solide.js` | **le sujet n'est pas livré** — mais `crop-parois.test.js`, `ecume-mer.test.js`, `fenetre-bornee.test.js` et `mer-sphere.test.js` l'importent aussi, comme oracle. Supprimer le module casserait cinq tests. |
| 1 720 | `test/places-minzoom.test.js` | `src/map/place-tier.js` | **à garder** : le module sert à `scripts/build-places.mjs`, donc à la donnée livrée. |
| 1 636 | `test/accordion.test.js` | `src/accordion.js` | **candidat net** : le module n'est importé par rien, nulle part, sauf ce test. |
| 423 | `test/sea-vendor.test.js` | `src/vendor/ocean-waves/index.js` | **faux positif** : le vendor est atteint par l'alias de `vite.config.js`. |

**Un seul vrai candidat : `accordion.js` + `accordion.test.js` = 2 563 octets.**

Cas voisin, non listé ci-dessus parce qu'il importe aussi des modules vivants :
`src/monde/descente-bornee.js` (12 633 o) est **absent du paquet** et n'a plus
que quatre tests pour lecteurs.

### 5.2 Sur disque et NON listés

`audit:tests` dit « aucun écart » — et il a raison **pour les `*.test.js`**.
Mais il ne regarde que ce motif. À côté d'eux vivent six fichiers qui ne tournent
jamais :

| octets | fichier | référencé par |
|---:|---|---|
| 26 135 | `test/attaque-r30-ROUGE.mjs` | **rien** |
| 18 984 | `test/attaque-r33-ROUGE.mjs` | `scripts/lit-sonde-r33.mjs` |
| 18 597 | `test/attaque-ge-ROUGE.mjs` | **rien** |
| 13 390 | `test/attaque-bt-ROUGE.mjs` | `scripts/verdict-bt8.mjs` |
| 8 180 | `test/attaque-b1-ROUGE.mjs` | `scripts/sonde-b1.mjs` |
| 8 040 | `test/attaque-b3-REANCRE.mjs` | **rien** |
| **93 326** | **total** | dont **52 772 o sans aucune référence** |

Aucun sous-dossier de `test/` ne contient de `*.test.js`, aucun `.test.mjs`,
aucun `.spec.js` : l'écart tient entièrement dans ces six fichiers.
➡️ **Proposition : étendre `scripts/audit-tests.mjs` à `test/*.mjs`**, sinon la
zone d'ombre reviendra.

### 5.3 ⚡ L'ÉPREUVE : « casse le code, le test rougit-il ? »

Treize cassures sur onze modules, chacune appliquée, mesurée, puis **restaurée
par `git checkout --` et vérifiée octet à octet** (`restauré : true` aux treize).

| cassure | test | verdict |
|---|---|---|
| `ecume-mer.js` `POIDS_PROFONDEUR` 2→3 | `ecume-mer.test.js` | **ROUGE** |
| idem | `mer-sphere.test.js` (165 517 o) | vert |
| `exageration-continue.js` `EXAG_BASE` 2.8→3.3 | `fenetre-branchee.test.js` (102 871 o) | **ROUGE** |
| idem | `exageration-globe.test.js` | **ROUGE** |
| `zoom-continu.js` `EXAGERATION_UNIQUE` 2→3 | `zoom-continu.test.js` (73 158 o) | **ROUGE** |
| `veille-repos.js` `IMAGES_CALME` 30→45 | `veille-repos.test.js` (52 215 o) | **vert** |
| idem | `cadence-repos.test.js` | **vert** |
| `veille-repos.js` `SEUIL_BOUGE_LOG` 1e-4→1e-1 | `veille-repos.test.js` | **ROUGE** |
| `seuil-socle.js` `FRACTION_NAISSANCE` 0.6→0.75 | `seuil-socle.test.js` | **ROUGE** |
| idem | `crop-branche.test.js` (67 207 o) | vert |
| `audit-solide.js` `EPS_VOLUME` 1e-12→1e-2 | `audit-solide.test.js` | **ROUGE** |
| idem | `crop-parois.test.js` (107 421 o) | **ROUGE** |
| `accordion.js` `foldOthers` court-circuitée | `accordion.test.js` | **ROUGE** |
| `lissage.js` `lisser` → renvoie la cible | `lissage.test.js` | **ROUGE** |
| idem | `course-bar.test.js` (61 265 o) | **vert** |
| idem | `suivi-relance.test.js` | **vert** |
| `mer-sphere.js` `ECHELLE_HOULE_UNITES` 0.42→0.61 | `mer-sphere.test.js` | **ROUGE** |
| `mer-sphere.js` `BUDGET_PROFONDEUR_UNITES` 2.2→3.1 | `mer-sphere.test.js` | **ROUGE** |
| `mer-sphere.js` `PORTEE_CROP` 3→5 | `mer-sphere.test.js` | **ROUGE** |
| `carnet-course.js` `PORTEE_PENTES` 2→4 | `course-bar.test.js` | **vert** |
| idem | `carnet-course.test.js` | **vert** |

**LE RÉSULTAT QUI COMPTE — un test tautologique, trouvé et localisé.**
`PORTEE_PENTES` passe de 2 à 4 sans qu'aucun test ne bronche. La raison est
lisible à `test/course-bar.test.js:186-187` :

```js
assert.equal(t.portee, `+${PORTEE_PENTES} km`)
assert.match(libelleFenetrePentes([…]), new RegExp(`${PORTEE_PENTES} prochains`))
```

Le test **importe la constante et la compare à elle-même**. Les deux côtés de
l'égalité bougent ensemble : l'assertion ne peut pas échouer, quelle que soit la
valeur. Or le commentaire de `carnet-course.js:15-19` dit précisément pourquoi la
constante est exportée — « écrite en dur dans le rendu, elle devenait fausse en
silence ». **Le test censé fermer cette porte la laisse ouverte.** Correctif :
écrire `'+2 km'` en clair dans l'assertion, ou vérifier que le libellé et le
rendu CSS s'accordent sur la MÊME valeur littérale.

Second trou, plus étroit : `IMAGES_CALME = 30` n'est couvert par aucun test —
`veille-repos.test.js` passe toujours `imagesCalme` en argument explicite, si
bien que le **défaut** du module n'est jamais exercé. `estompage-terre.js`, lui,
en dérive `IMAGES_FONDU_REPOS` sans le passer.

**Ce qu'il ne faut PAS conclure.** `mer-sphere.test.js`, resté vert à la première
cassure, **mord parfaitement sur son propre module** (3 cassures sur 3). Un test
qui ne réagit pas à la mutation d'un module qu'il importe pour s'en servir
d'outil n'est pas décoratif — il est simplement hors sujet sur ce point-là.
La conclusion « le plus gros test de la suite ne mord pas » aurait été fausse.

**La durée n'est pas un critère** et ne l'a été nulle part ici : la suite
complète tourne en **32,9 secondes** pour 4 899 assertions. Il n'y a aucun test
lent à défendre, et aucun test rapide à récompenser.

---

## 6. LE CLASSEMENT — LES DIX PREMIÈRES SUPPRESSIONS

Critère : **octets libérés ÷ risque**. Le risque est coté sur ce que la mesure
montre, pas sur une impression.

| # | action | octets libérés | où | risque | pourquoi ce rang |
|---:|---|---:|---|---|---|
| 1 | Corriger `course-bar.test.js:186-187` (assertion tautologique) | 0 | — | **nul** | Zéro octet, mais c'est la seule chose du rapport qui **répare une garde cassée**. Rien ne se supprime avant que la garde morde. |
| 2 | Supprimer `test/attaque-r30-ROUGE.mjs`, `attaque-ge-ROUGE.mjs`, `attaque-b3-REANCRE.mjs` | **52 772** | dépôt | **nul** | Aucun fichier du dépôt ne les cite, ils ne tournent pas, `audit:tests` ne les voit pas. |
| 3 | Étendre `audit-tests.mjs` à `test/*.mjs` | 0 | — | **nul** | Empêche la zone d'ombre de revenir. À faire dans le même geste que le 2. |
| 4 | Supprimer `src/accordion.js` + `test/accordion.test.js` | **2 563** | dépôt | **nul** | Zéro import en dehors de son propre test ; absent du paquet ; le test rougit, donc on sait exactement ce qu'on perd. |
| 5 | Rendre `grapick` + `ui/create-panel.js` paresseux | **30 940** | **paquet, chemin critique** | **faible** | Le seul gain de démarrage mesuré ; le motif `await import()` est déjà employé onze fois dans `main.js`. |
| 6 | Rendre `ui/compte.js` paresseux | **16 801** | **paquet, chemin critique** | **faible** | Même motif ; le panneau de compte n'est pas ouvert en vol. |
| 7 | Supprimer `src/pilote-banc.js` + `src/poursuite-banc.js` | **20 557** | dépôt | **faible** | Bancs collés à la console ; hors paquet ; `ui/bars.js:437` les documente — mettre le mode d'emploi à jour avec. |
| 8 | Statuer sur `src/monde/descente-bornee.js` | **12 633** | dépôt | **moyen** | Hors paquet, mais quatre tests l'utilisent et `main.js`, `butee-sol.js`, `rampe-crop.js` et `ui/indicateur-retard.js` s'y réfèrent **en commentaire** : c'est une loi écrite quelque part et appliquée ailleurs. À trancher avec `wt-cull`, pas seul. |
| 9 | Statuer sur `src/monde/audit-solide.js` | **22 157** | dépôt | **moyen-fort** | Hors paquet, mais oracle de **cinq** tests dont `crop-parois.test.js` — et l'épreuve montre qu'ils mordent. Le supprimer coûterait cette garde. |
| 10 | Resserrer l'emprise du MNT (**PAS une suppression**) | **≈ 24 Mo par vol** | **réseau** | **fort** | Le premier poste du produit, de trois ordres de grandeur au-dessus de tout le reste. Ne relève pas de ce chantier : c'est du code vivant, c'est le terrain de `wt-cull`. Je le classe dernier pour cette raison, pas pour son poids. |

**Total réellement libérable sans risque (rangs 2, 4, 7) : 75 892 octets de
dépôt.** **Total du chemin critique du paquet (rangs 5, 6) : 47 741 octets, soit
1,9 % du démarrage.** Voilà la vérité chiffrée de la moitié de phrase d'Adrien :
**le nettoyage de code ne rend presque pas de bande passante ; la bande passante
est ailleurs, et elle est vivante.**

---

## 7. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Les fichiers orphelins de `src/` pèsent dans le paquet. »** Faux. Un
   `grep` du nom dans `dist/assets/*.js.map` les trouvait tous les six —
   **il tombait sur `sourcesContent`**, le texte source complet embarqué dans la
   sourcemap, commentaires compris. La bonne lecture est le tableau `sources` :
   aucun n'y figure, et aucun n'apparaît dans le JS minifié. Gain réel : 0 octet
   livré. C'est le constat qui a retourné tout le classement.

2. **« `mer-sphere.test.js`, 165 kB, le plus gros de la suite, ne mord pas. »**
   Faux, et j'ai failli l'écrire. Il est resté vert sur une cassure de
   `ecume-mer.js`, un module qu'il importe pour s'en servir. Trois cassures dans
   `mer-sphere.js` lui-même le font rougir trois fois sur trois. **Une seule
   mutation ne juge pas un test** — même piège que « un relevé sur une image ne
   prouve rien ».

3. **« `places.json`, 2,76 Mo au démarrage, est du gaspillage en production. »**
   Faux dans le processus réel. J'avais construit avec `npx vite build` seul,
   comme le brief le demandait : sans `build:mapcells`, `geo-data.js` retombe sur
   le monolithe (chemin de repli documenté l. 9-11). `npm run deploy` enchaîne
   `build:mapcells` **et** `verifie:dist`, qui exige au moins 4 000 fichiers sous
   `data/map/cells` et **refuse le déploiement** sinon. La garde existe déjà. Ce
   que ma mesure prouve, c'est que **le repli fonctionne**, pas que la production
   le subit.

4. **« `models/plane.glb`, 587 Ko chargés pendant la descente, part au
   démarrage. »** Faux, et corrigé depuis le 28/07/2026 : `traffic.js:73-100`
   raconte le déplacement des trois `load()` hors du constructeur. Ce que ma
   sonde a vu, c'est un tirage de dé **gagnant** pendant la descente. Le coût est
   payé par la session qui verra vraiment un aéronef.

5. **« Il y a des dépendances mortes dans `package.json`. »** Faux : les neuf
   sont importées, y compris `@duckdb/node-api` (trois scripts de construction)
   et `@netlify/blobs` (quatre fonctions serveur). Ce chemin ne rend rien.

6. **« `public/textures`, 13,8 Mo, doit contenir des fichiers oubliés. »** Faux :
   balayage nom par nom, **0 orphelin**. Idem pour les dix dossiers de `public/`,
   tous lus par au moins un module.

7. **« La durée de la suite dira quels tests couper. »** Sans objet : 4 899
   assertions en 32,9 secondes. Le critère n'existe pas ici, et le brief avait
   raison de l'interdire d'avance.

8. **« `du -sb public/data/bathy` donne le poids de la bathymétrie. »** Il donne
   **41 octets** — la taille du lien. Il faut descendre d'un cran. Et même
   corrigé, ce poids **n'est pas propre au dépôt** : les 2,15 Go sont partagés
   entre tous les arbres de travail et gitignorés. Ils comptent pour le
   déploiement, pas pour le dépôt.

---

## 8. VÉRIFICATIONS DE SORTIE

- `git diff -- src/` : **vide** (contrôlé après chacune des treize cassures et à
  la fin).
- `npm test` : **4 899 · 0**, 32,9 s.
- `npm run audit:tests` : **263 listés · 263 sur disque, aucun écart**.

Instruments écrits pour cette tâche (hors dépôt, dans le bloc-notes de session,
reproductibles depuis ce rapport) : décodeur de sourcemap → octets par module ;
graphe d'imports depuis `boot.js` ; sonde de vol CDP ; harnais de mutation
casse/restaure.
