# INV2 — INVENTAIRE DU CODE MORT

Arbre `C:\Dev\wt-inv2`, branche `inv-mort`.
**Photo de `regroupement` du 2026-09-04**, sommet `f558ed8` (« Fusion MER2 »).
Trois agents modifient du code en parallèle (`wt-cull` sur `globe.js`, `wt-sortie`
sur les gestes, `wt-veto` sur la bathymétrie) : les lignes citées ici peuvent
avoir bougé chez eux, **les symboles, non**.

**Rien n'a été supprimé.** `git diff` vide · `npm test` **4 899 · 0 échec** ·
`npm run audit:tests` **263 listés = 263 sur disque**.

---

## MÉTHODE, ET CE QU'ELLE VAUT

Aucun `knip`/`ts-prune` n'a été utilisé. Quatre passes maison, dont les trois
premières se sont **contredites** — c'est raconté au §« ce que j'ai cru puis
réfuté ».

La preuve retenue pour chaque ligne est la même, et elle est reproductible :

```
grep -rn "\bNOM\b" src test scripts netlify index.html   →  N occurrences
```

**N = 1** (la déclaration seule) ⇒ *certain*.
**N = 1 dans `src/`, le reste dans `test/`** ⇒ candidat, dit tel quel.

Les blocages du `grep` ont été listés AVANT de conclure :

- **`import()` dynamiques : 23, tous à chemin littéral** (`./export.js`,
  `./ui/tutorial.js`, `/src/pilote-banc.js`…). Aucun `import(variable)`, aucun
  gabarit. Le graphe statique est donc fiable ici.
- **`new URL(..., import.meta.url)` : 3 workers** — `cloud-volume-worker.js`,
  `monde/decodeur-terrarium.js`, `terrain-worker.js`. Ils sont vivants.
- **`import * as` : uniquement `three`.** Aucun espace de noms local, donc
  aucun symbole ne peut être atteint par un `obj[nomCalculé]` invisible.
- **Un `import` nommé jamais utilisé compte comme une référence** dans mes
  comptages : il gonfle le vivant, jamais le mort. Il y en a **20**, dont **un
  seul dans `src/`** (§7).

---

## 1. LE TABLEAU — trié par octets

Colonne « octets » = le bloc entier, commentaire de tête compris (c'est ce qui
part réellement du fichier).

| candidat | nature | octets | la preuve | confiance | risque |
|---|---|---|---|---|---|
| `src/poursuite-banc.js:142` `apercuPoursuite` | fonction export | **2 761** | `grep -rn "\bapercuPoursuite\b" src test scripts` → **1** | certain | **nul pour le bundle** : `poursuite-banc.js` n'est atteint par aucun import — il se charge à la main en console. Outil de dév. |
| `src/pilote-banc.js:173` `apercuVol` | fonction export | **2 325** | `grep` → **1** | certain | idem, hors bundle |
| `src/export.js:643` `VideoExporter` **+** `:687` `exportVideo` | classe + orchestrateur | **1 149 + 1 024 = 2 173** | `grep -rn "\bVideoExporter\b"` → **2** (déclaration + son seul appel, dans `exportVideo`) ; `grep -rn "\bexportVideo\b"` → **1** | certain | **grappe** — voir §3. Libère les 5 symboles `mediabunny` de `export.js` |
| `src/compositeur-affiche.js:664-673` `EFFETS_EN_LINEAIRE` | constante export | **752** | `grep` → **1**. Le commentaire de 9 lignes dit « une seule constante commande ce choix » : **elle ne commande rien**, le choix est écrit en dur plus bas | certain | aucun (documentation périmée) |
| `src/ruban-trace.js:120-127` `teintesDepuis` | fonction export | **476** | seul appelant en prod = `gpx.js:927`, **branche injoignable** (ligne suivante) | probable — **grappe §3** | un test l'exerce (`ruban-trace.test.js:334`) : test à retirer avec |
| `src/gpx.js:923-929` branche `params.gpxRubanOr === false` | branche injoignable | **382** | `grep -rn "gpxRubanOr" . --exclude-dir=node_modules` → **1 seule ligne, une LECTURE**. Jamais écrit : ni défaut de `params`, ni panneau, ni gabarit, ni `share-link`. `undefined === false` ⇒ **toujours faux** | certain | le `srgb` de la ligne 927 n'est calculé QUE pour cette branche : effet calculé, jamais lu |
| `src/pilote.js:545-550` `surLeBord` | fonction export | **311** | `grep` → **1**. Le commentaire l'annonce « le critère de la sortie prouvée » ; le vérificateur d'engagement ne l'appelle plus | certain | aucun |
| `src/compte.js:192-195` `CODES_REFUS` | constante export | **297** | `grep` → **1**. Son propre commentaire dit que le test de cohésion relit **la source**, pas elle | certain | aucun |
| `src/dem.js:302-309` `knownMaxZoomAt` | fonction export | **294** | `grep` → **1** | certain | aucun |
| `src/gpx.js:877-880` `params.gpxRuban !== false` | condition constante | **288** | `grep -rn "gpxRuban\b"` → **2**, les deux des LECTURES. Jamais écrit ⇒ terme toujours vrai | certain | ne supprime que le terme, pas la ligne |
| `src/material-textures.js:308-313` `SURFACE_MATERIALS` | liste d'interface | **216** | `grep` → **1**. Le commentaire dit « list offered on the terrain surface (Shaders panel) » : le panneau ne la lit plus, il passe par `TEXTURE_BUILDERS` (`plinth.js:795`, `terrain.js:3504`) | certain | **gisement 4** : option d'IHM sans effet |
| `src/ui/tutorial.js:155-161` `maybeStartTutorial` | fonction export | **189** | `grep` → **1**. `tutorial.js` est chargé par `import()` en `main.js:12095`, qui n'appelle QUE `startTutorial` | certain | le « premier lancement seulement » n'existe donc plus |
| `src/nuit.js:193-195` `NUIT_PLEINE` + `JOUR_PLEIN` | 2 constantes export | **139** | `grep` → **1** chacune | certain | aucun |
| `src/arch.js:103` `OLD_ARCH_TOTAL_HEIGHT` | constante export | **104** | `grep` → **1**. Reste de l'ancienne arche (`OLD_ARCH_WIDTH`, sa jumelle, est vivante) | certain | **grappe §3** avec `OLD_ARCH_HEIGHT`/`OLD_ARCH_BEAM_THICK` |
| `src/ui/compte.js:284` `reinitialisePorte` | fonction export | **90** | `grep` → **1**. Le commentaire dit « pour les bancs d'essai » : aucun banc ne l'appelle | certain | aucun |
| `src/ui/store.js:11` `STORE_COMMERCE` | interrupteur | **76** | `grep -rn "STORE_COMMERCE" src test` → **1**. **Le garde-fou du commerce n'est branché sur rien** | certain | ⚠️ à faire remonter : ce n'est pas qu'un octet, c'est une garantie qui n'existe pas |
| `src/monde/photo-monde.js:53` `ATTRIBUTION_MONDE` | constante export | **56** | `grep` → **1**. Doublon du littéral vivant `aerial-layer.js:375` | certain | aucun |
| `src/map/aerial-layer.js:153` `IGN_ATTRIBUTION` | constante export | **51** | `grep` → **1**. Doublon du littéral de la ligne **278** | certain | aucun |
| `src/map/aerial-layer.js:154` `SWISSTOPO_ATTRIBUTION` | constante export | **51** | `grep` → **1**. Doublon de la ligne **273** | certain | aucun |
| `src/globe.js:6532` `uMerMaille: { value: maille }` | **uniforme mort** | **38** | Aucun `uniform … uMerMaille` dans le moindre GLSL du dépôt ; `grep -rn "uMerMaille"` → **1** | certain | envoi GPU à chaque construction de mer |
| `src/ocean.js:398` + `:898` `uCaustics` | **uniforme mort** | **24 + 34 = 58** | déclaré `uniform float uCaustics;` et posé `{ value: 2.4 }` — **jamais lu dans aucun corps GLSL**. `grep -rn "uCaustics" src` → **2** | certain | un emplacement d'uniforme et un `uniform1f` par image |
| `src/drone-cam.js:464` `_diff`, `:467` `_tDir` | vecteurs de travail | **33 + 33 = 66** | `grep` → **1** chacun. Deux `THREE.Vector3` alloués au chargement du module, jamais touchés | certain | aucun |
| `src/pdf-affiche.js:501` `INTENTION_RVB` | constante export | **33** | `grep` → **1** | certain | aucun |

**Total du tableau : 11 909 octets de source**, dont **5 086** hors des deux
fichiers de bancs d'essai (qui ne partent pas au navigateur).

---

## 2. LES SIX GISEMENTS, CHACUN AVEC SON TOTAL

### ① Exports sans importateur — le plus gros, et le plus nuancé

**2 055 exports** recensés dans `src/` (hors `vendor/`). Le tri :

| classe | nombre | ce que ça veut dire |
|---|---|---|
| **A — aucune référence nulle part** | **21** | mort au sens strict, tous dans le tableau ci-dessus |
| **B — déclaré une fois, appelé UNIQUEMENT par des tests** | **81** | candidats, §5 |
| **C — utilisé seulement dans son propre fichier, zéro test** | **120** | **le symbole est vivant, le mot-clé `export` est mort** |
| **D — interne + tests** | **501** | vivant |

⚠️ La classe **C** n'est pas du code mort et je refuse de la présenter comme
telle : supprimer le symbole casserait le fichier. Ce qui est mort, c'est
**le mot `export ` — 120 × 7 octets ≈ 840 octets**, et le bénéfice réel n'est
pas là : c'est que le secouage d'arbre de Rollup et la lecture humaine
retrouvent une surface publique honnête. Exemples vérifiés :
`pilote.js` `pointsDevant` (2 occurrences, les deux internes), `virageLibre`
(3, toutes internes), `compositeur-affiche.js` `dessinerCartouche`,
`dessinerLogo`, `largeurTexte`, `supporteInterlettrage`.

**Aucun fichier `src/` entier n'est orphelin.** Les 265 fichiers sont tous
atteints. Le plus proche de l'être est `src/ui/tutorial.js` (5 644 o), atteint
par un seul `import()` pour un seul de ses deux exports.

### ② Fonctions et branches internes injoignables — **3 trouvées**

1. **`src/gpx.js:926`** — `params.gpxRubanOr === false` : la clé n'est **jamais
   écrite** dans tout le dépôt. La branche vraie est injoignable, et avec elle
   `teintesDepuis` (grappe §3). *Preuve : `grep -rn "gpxRubanOr" .
   --exclude-dir=node_modules` → une ligne, une lecture.*
2. **`src/gpx.js:880`** — `params.gpxRuban !== false` : même cause, terme
   toujours vrai. `utiliseRuban` se réduit à `!gradientOn`.
3. **`src/main.js:14145`** — `PIVOT_VERS_LE_CURSEUR ? … : [innerWidth/2,
   innerHeight/2]` : la constante vaut `true` en dur
   (`monde/gestes-terre.js:71`) et `main.js:14317` la relit en garde toujours
   vraie. La branche « pivot au centre » est injoignable.
   ⛔ **JE NE LA PROPOSE PAS À LA SUPPRESSION** — le commentaire dit
   explicitement « Adrien peut basculer ICI, en un caractère », et
   `test/gestes-terre.test.js:195` verrouille l'arbitrage du 2026-09-04. C'est
   un interrupteur d'arbitrage, pas un résidu.

### ③ Uniformes et nuanceurs — **2 morts sur 294 déclarés**

Méthode empruntée à la garde ⑨ de `test/grille-crop.test.js` (elle extrait les
`u.uXxx` écrits par `poserHabillage`), généralisée dans les deux sens :

- 294 `uniform <type> <nom>;` en GLSL, 295 entrées `uXxx: { value: … }` en JS.
- **Déclaré en GLSL mais jamais lu ailleurs** : `uCaustics` (`ocean.js:398`,
  posé à 2.4 en `:898`, total **2** occurrences dans tout `src/`).
- **Posé en JS mais déclaré dans aucun shader** : `uMerMaille`
  (`globe.js:6532`, **1** occurrence). Les 7 autres candidats de cette liste
  (`uParoiCielIrr`, `uParoiSolIrr`, `uParoiCouleur`, `uTraine`, `uRayonNez`,
  `uLongueur`, `uEtincelle`) sont **vivants** : ils sont déclarés dans des
  listes GLSL à virgules (`uniform float uProgress, uTemps, uTraine, …`,
  `gpx.js:1107`) que mon extracteur ne voyait pas. Corrigé à la main.
- **Aucun uniforme n'est déclaré ET jamais utilisé du tout** : le fond de
  gisement est propre, ces deux-là exceptés.

### ④ Options et réglages d'interface sans effet — **2 trouvés**

- `SURFACE_MATERIALS` (`material-textures.js:309`) — la liste « Carbon fibre /
  Wood (oak) / Frosted glass » que le panneau Shaders est censé offrir. Le
  panneau ne la lit plus ; les trois matières restent atteignables par
  `TEXTURE_BUILDERS` et `material-presets.js:33`. **La liste est morte, pas les
  matières.**
- `STORE_COMMERCE = false` (`ui/store.js:11`) — le drapeau censé cacher tout
  prix tant qu'il vaut `false` **n'est lu nulle part**. Aucun prix n'est
  affiché aujourd'hui, donc rien n'est cassé — mais la garantie est fictive.

**Le gisement des `params` est par ailleurs sain** : sur **223 clés `params.*`
distinctes**, deux seulement ne sont jamais écrites (`gpxRuban`, `gpxRubanOr`,
déjà comptées au ②). Aucun curseur branché sur du vide.

### ⑤ Effets devenus inutiles — **1 calcul recouvert, 0 passe morte**

- `src/gpx.js:927` : `srgb` (une conversion `THREE.Color` complète) est calculé
  à **chaque reconstruction de ruban** et n'est consommé que par la branche
  injoignable du ②. Effet calculé, jamais lu.
- **Le reste du gisement est VIDE, et c'est une bonne nouvelle** : la passe de
  bloom a déjà été retirée le 2026-08-02 et le nettoyage est complet — plus
  aucun `bloomPass`, plus de colonne `bloom` dans `palier-machine.js`, plus de
  `params._bloomTierOk`. Il ne reste que des commentaires qui racontent le
  retrait. Le bokeh, l'AO (`n8ao`, chargé en `import()` paresseux) et le
  scanner sont tous branchés et lus.

### ⑥ Constantes fantômes — **le plafond `MAX_Z` n'en est plus un ; 4 fantômes ailleurs**

⚠️ Le `MAX_Z = 11` du brief **n'existe plus** : `globe.js:815` porte
`MAX_Z = 15` depuis la Tâche 4 quater, et `descente-bornee.js:28` documente la
mesure qui a fait le changement. **Vérifier dans `src/` valait mieux que lire le
rapport daté** — c'est exactement le piège annoncé, et il s'est déclenché.

J'ai balayé les 54 constantes de la forme `MAX_/MIN_/PLAFOND_/SEUIL_/LIMITE_`.
Les clamps que j'ai crus fantômes ne le sont pas :

- `EMPRISE_EN_VOL_MAX = 3` contre `CARRE_COTE_MAX = 3` : j'ai cru à un
  `Math.min(3, 3)` qui ne mord jamais. **Faux** — `enVolBorne` reçoit `n = 9`
  entrées (l'emprise 3×3 recollée), le plafond mord à chaque vol.
- `COAST_NE_MAX = 8` : sépare Natural Earth (z4-8) d'OSM (z9-15), lu deux fois
  dans `coast-mask.js:254` et `:264`. Vivant.

Les **fantômes réels** de ce gisement sont des constantes qui ne produisent
plus rien du tout, et le compilateur ne le dit pas :

| constante | ce qu'elle prétend | ce qu'elle produit |
|---|---|---|
| `EFFETS_EN_LINEAIRE = true` | « une seule constante commande ce choix » | rien : personne ne la lit |
| `INTENTION_RVB = true` | l'intention colorimétrique du PDF | rien |
| `STORE_COMMERCE = false` | cacher les prix | rien |
| `OLD_ARCH_TOTAL_HEIGHT` | la hauteur de l'ancienne arche | rien |

---

## 3. LES GRAPPES — ce qui se supprime ensemble, ou pas du tout

**Grappe A — l'enregistreur MP4 doublon** (2 173 o)
`export.js:643 VideoExporter` → `export.js:687 exportVideo` → l'import
`mediabunny` de `export.js:7`.
Les cinq symboles `Output`, `Mp4OutputFormat`, `BufferTarget`, `CanvasSource`,
`QUALITY_HIGH` ne sont utilisés **que** dans `VideoExporter` (lignes 654-660).
Retirer la classe retire l'import. **`src/export-recorder.js:24` importe
`mediabunny` de son côté et reste l'enregistreur vivant** — c'est un doublon
historique, pas une dépendance à supprimer du `package.json`.
⛔ **Tout ou rien** : retirer `exportVideo` seul laisserait une classe orpheline.

**Grappe B — le ruban aux couleurs choisies** (858 o + un test)
`gpx.js:926-928` (branche injoignable) → `srgb` de `gpx.js:927` →
`ruban-trace.js:124 teintesDepuis` → le test `ruban-trace.test.js:334`.
⛔ **Tout ou rien.** ⚠️ **Et c'est une décision produit, pas une décision de
code** : la branche existe pour que « le sélecteur de couleur du panneau
Parcours continue de servir » (son commentaire). Le sélecteur ne la pilote plus.
Il faut demander à Adrien si le ruban doit reprendre la couleur choisie —
auquel cas c'est un **bug à réparer**, pas du code à supprimer.

**Grappe C — l'ancienne arche** (186 o)
`arch.js:103 OLD_ARCH_TOTAL_HEIGHT` → `arch.js:99 OLD_ARCH_HEIGHT` →
`arch.js:100 OLD_ARCH_BEAM_THICK`.
Les deux dernières ne servent qu'à la première. ⚠️ **`OLD_ARCH_WIDTH`,
`OLD_ARCH_UNIT`, `OLD_ARCH_POST_THICK`, `OLD_ARCH_SPAN` restent VIVANTS** — ils
normalisent le nouveau GLB. Ne pas emporter tout le bloc `OLD_ARCH_*`.

**Grappe D — les attributions en double** (158 o)
`IGN_ATTRIBUTION`, `SWISSTOPO_ATTRIBUTION`, `ATTRIBUTION_MONDE` : trois
constantes qui recopient trois littéraux vivants dans `PROVIDERS`. Elles se
suppriment ensemble ou pas ; ⛔ **ne pas « factoriser » les littéraux vers
elles**, ce serait ressusciter du mort.

---

## 4. ⚠️ CANDIDATS QUE J'AI DISQUALIFIÉS — avec la preuve de vie

Cette section vaut la première. Chacun de ces symboles est sorti « mort » d'au
moins une de mes passes.

| ce qui avait l'air mort | la preuve de vie |
|---|---|
| **`src/main.js:2834` `_globeHit`** (9 531 o) — le plus gros faux positif | `main.js:2891` `sphereToLatLon(_globeHit.set(…))`. Mon découpeur en blocs avait absorbé l'appel DANS le bloc et l'avait ignoré. |
| `src/main.js:13276` `UNDOABLE_UI` (7 867 o) | lu par deux `addEventListener` aux lignes 13277-13278 |
| `src/share-link.js:209` `toBase64url`, `:254` `escapeXml` | appelés en `:225` et `:270`. Mon compteur d'accolades dérivait sur les **littéraux d'expression régulière** (`/^\s*[[{]/`) et étendait le bloc jusqu'à la fin du fichier. |
| `src/route-entry.js:54` `looksJson`, `casse-titre.js:132` `soloLettres`, `peak-mask.js:477` `escStr` | même cause, appelés 2 à 3 fois chacun |
| `src/main.js:12866` `couchesPanel` | ⚠️ **piège subtil** : la LIAISON est morte (1 seule occurrence) mais l'**appel** `buildCouchesPanel({…})` construit tout l'onglet « Couches ». Seuls les 21 octets `const couchesPanel = ` sont retirables — et le gain ne vaut pas le risque. |
| `src/main.js:9064` `_rebuildAllRaw`, `:1923` `_plinthRebuild`, `:9075` `_draggedProfiles`, `:2832` `_clickDownX`, `:2833` `_clickNdc`, `:13224` `shortcutsCtx`, `:11791` `majCorpsCompte`, `:13887-13892` `surPointerMove/UpSaisie` | tous relus 1 à 3 fois dans les lignes qui suivent (`bindShortcuts(shortcutsCtx)`, `renderer.domElement.addEventListener('pointerup', surPointerUpSaisie)`…) |
| `src/ui/liquid.js:38` `LQ_PAD` | **référencé depuis le CSS** : `src/ui/v28.css:630` `inset: -12px; /* = LQ_PAD */`. Un `grep` limité au JS l'aurait tué. |
| `src/flags.js` — `fenetreContinue`, `suiviHelico`, `exagContinue` (les 3 drapeaux `false`) | chacun a une **échappatoire d'adresse** : `?f3=1`, `?suivi=helico`, `?exag=continu` (`flags.js:523-537`). Le code derrière est atteignable sans toucher au source. `fenetreContinue` seul commande **26 sites d'appel** dans `main.js`. |
| `src/monde/gestes-terre.js:71` `PIVOT_VERS_LE_CURSEUR` | vrai en dur, mais **interrupteur d'arbitrage à un caractère**, verrouillé par un test daté du 2026-09-04 |
| `src/pilote.js:309 pointsDevant`, `:954 virageLibre`, `src/monde/sol-globe.js poseurPlat`, `src/monde/rampe-crop.js plancherRampeDuCrop` | **vivants dans leur propre fichier** ; ce sont des imports de test inutilisés (§7) qui les faisaient paraître externes |
| `src/bathy.js:530 cr4`, `occupation-sol.js:143 PAR_CODE`, `monde/seuil-socle.js:217 hauteurVueM`, `monde/zoom-continu.js:529 echelons`, `monde/habillage-crop.js:314 hash2`, `dem-source.js:80 readFlag` | tous appelés 1 à 4 fois plus bas dans leur fichier. `echelons` est même appelé **avant** sa déclaration (remontée de fonction) — un découpage naïf par ordre de ligne le rate. |
| `src/export.js:320 MPX_CANEVAS_MAX`, `dem-emprise.js:233 EMPRISE_EN_VOL_MAX`, `coast-mask.js:25 COAST_NE_MAX`, `block-grid.js:30 CARRE_COTE_MAX` | plafonds qui **mordent** ; voir gisement ⑥ |
| Les 3 workers (`terrain-worker.js`, `cloud-volume-worker.js`, `monde/decodeur-terrarium.js`) | atteints par `new Worker(new URL(…, import.meta.url))` — invisibles à un `grep` d'`import` |

---

## 5. LES 81 « SEULS LES TESTS L'APPELLENT » — dits précisément

Je ne les mets **pas** dans le tableau des morts : le brief l'interdit à juste
titre. Ils se lisent en trois familles, très inégales.

**a) Crochets de test assumés — À NE PAS TOUCHER (≈ 20)**
`_resetDemSource`, `_resetTileCaches`, `_resetTileMemo`, `_resetJournalReseau`,
`clearRegionMemo`, `clearTrous`, `nombreDeTrous`, `_setRoutageTrous`,
`clearDetailField(-Emprise)`, `clearTintField`, `clearGridTemplates`,
`clearGeoFRCache`, `_clearCache`, `_enVol`, `oublierPanneOverpass`,
`resetTerrainTransport`, `videCacheSommets`, `tailleCacheSommets`,
`overpassSondeSeulement`.
Ce sont les remises à zéro sans lesquelles la suite ne peut pas isoler un test
de l'autre. Le préfixe `_` les annonce. **Les supprimer casse 4 899 tests.**

**b) Constantes exposées pour être vérifiées — À NE PAS TOUCHER (≈ 15)**
`PEAK_CONST` (« exposé pour les tests », dit son commentaire), `PROTECTIONS`,
`PART_MO`, `CATEGORIES`, `GRAIN_MIN_SAMPLES`, `EPAISSEUR_MIN_MM`,
`ALT_PALIER_Z7_M`, `MARGE_MEDIA_SANS_REPERES`, `MATERIAL_BY_ID`, `CODES_SOL`,
`PLANS_POURSUITE`… Elles servent à ce qu'un test compare une valeur à **la
source** au lieu de la recopier.

**c) Fonctions pures dont la production a cessé d'appeler — LES VRAIS CANDIDATS (≈ 12)**
`camera-shots.js` `easeOutCubic`, `easeInCubic`, `tailleEcran`,
`northScreenAngleDeg` · `accordion.js` `openExclusive` ·
`bathy.js` `sampleCatmullRom` · `palette.js` `generateStyle`,
`generateGridContour` · `map/draped-line.js` `densifyWorld`, `drapeWorld` ·
`map/geo-cells.js` `cellKey` · `ground-info.js` `splitBlurb` (7 705 o) ·
`monde/lumiere-sphere.js` `curseursMorts` · `ui-theme.js` `auditUiTokens`.
⚠️ **Sur celles-là, la suite verte protège peut-être du vide** — un test qui
vérifie qu'un mort existe encore n'est pas une preuve de vie. **Aucune ne doit
partir sans qu'Adrien tranche**, parce que plusieurs (`generateStyle`,
`generateGridContour`, `splitBlurb`) sont des fonctionnalités visibles qui ont
pu être débranchées **par accident**. Le brief le dit : *« une option donnée
morte était réparée depuis deux tâches »*.

---

## 6. ORDRE DE SUPPRESSION RECOMMANDÉ — du plus sûr au plus risqué

1. **Les 4 constantes fantômes muettes** — `OLD_ARCH_TOTAL_HEIGHT` (+ grappe C),
   `EFFETS_EN_LINEAIRE`, `INTENTION_RVB`, `NUIT_PLEINE`/`JOUR_PLEIN`,
   `CODES_REFUS`. *(≈ 1 435 o, aucun comportement)*
2. **Les 3 attributions en double** (grappe D, 158 o).
3. **Les 2 vecteurs de travail** `_diff` / `_tDir` de `drone-cam.js` (66 o).
4. **Les 2 uniformes morts** `uCaustics` et `uMerMaille` (96 o) — ⚠️ **relancer
   `npm test` juste après** : `test/grille-crop.test.js` ⑨ et
   `test/damier-uniformes.test.js` gardent les tables d'uniformes.
5. **`SURFACE_MATERIALS`** et **`maybeStartTutorial`** (405 o) — vérifier d'abord
   à l'écran que le panneau Shaders et le tutoriel se comportent comme
   aujourd'hui.
6. **`knownMaxZoomAt`, `surLeBord`, `reinitialisePorte`** (695 o).
7. **`apercuVol` / `apercuPoursuite`** (5 086 o) — **aucun gain de bande
   passante** (hors bundle), gain de lecture seulement. Demander à Adrien : ce
   sont ses bancs d'essai, il peut vouloir les garder.
8. **Grappe A, l'enregistreur MP4 doublon** (2 173 o) — ⚠️ **passer d'abord un
   export vidéo à la main dans l'application** : la preuve statique est solide,
   mais l'export MP4 est un chemin que la suite ne couvre pas (les tests le
   disent eux-mêmes, `export-presets.test.js:115`).
9. **`STORE_COMMERCE`** — ⛔ **ne pas supprimer sans décision** : c'est une
   garantie manquante, pas un déchet. Soit on la branche, soit on l'enlève en
   connaissance de cause.
10. **Grappe B, le ruban aux couleurs choisies** — ⛔ **décision produit** (§3).
11. **Le retrait des `export` superflus (classe C, 120 symboles)** — sans risque
    unitaire mais large ; à faire en une passe séparée, jamais mélangée aux
    suppressions ci-dessus.
12. **Les 12 fonctions pures « tests seulement »** — en dernier, une par une,
    chacune avec son test.

---

## 7. RECOUPEMENTS À SIGNALER

**Pour `wt-inv3` (le poids réel)** :

- ⚡ **La piste `mediabunny` que je croyais tenir n'en est pas une, et je le
  prouve** — voir §8. Le paquet pèse **10 Mo sur disque**, et j'ai cru qu'il
  partait dans le lot de démarrage parce que `main.js:27` importe
  statiquement `export.js`, qui importe statiquement `mediabunny`. **`npx vite
  build` dit le contraire** : `mediabunny` n'apparaît que dans
  `dist/assets/export-recorder-*.js` (**172 182 o**, chargé à la demande), et
  `grep -c "fastStart" dist/assets/main-*.js` rend **0**. Rollup a bien isolé
  le morceau. Le gain de la grappe A est de **2 173 octets de source**, pas de
  172 Ko de réseau.
- Deux avertissements de `vite build` valent une mesure de sa part :
  `src/export.js` et `src/ocean.js` sont **à la fois** importés
  dynamiquement et statiquement — « dynamic import will not move module into
  another chunk ». `main-*.js` pèse **2 306 916 o**, `index-*.js` **728 632 o**.
- `dist/` complet fait **2,5 Go** (les données de `public/` dominent).

**Pour `wt-inv1` (l'héritage de la terre plate)** : le préfixe `OLD_ARCH_*`
(grappe C) et les trois drapeaux `false` de `flags.js` sont sur sa frontière.
Les drapeaux ont des échappatoires d'adresse — **ce n'est pas de l'héritage
mort**.

**Le seul import inutile de `src/`** : `src/paiement.js:28` importe
`CADRAGE_DEFAUT` de `print-page.js` sans jamais s'en servir. `CADRAGE_DEFAUT`
reste vivant ailleurs (5 usages dans `src/`). Ligne à raboter, pas symbole à
tuer. Les 19 autres imports inutiles sont dans `test/` et `scripts/`.

---

## 8. CE QUE J'AI CRU, PUIS RÉFUTÉ

**① « `mediabunny` part au navigateur au démarrage. »**
Chaîne de raisonnement impeccable — `main.js` → `export.js` → `mediabunny`, tout
en statique — et **fausse**. Je ne l'ai su qu'en construisant le bundle et en
cherchant le marqueur `fastStart` dans chaque morceau. *Leçon : on ne déduit pas
le poids d'un graphe d'imports, on le lit dans `dist/`.*

**② « Un découpage du fichier en blocs de haut niveau suffit à mesurer la vie
d'un symbole. »**
Ma deuxième passe a rendu **154 blocs morts, 148 673 octets**. Elle était fausse
sur presque tout : quand un `const` est suivi de code exécutable au premier
niveau, mon bloc l'absorbait, et l'usage tombait « dans » la déclaration. C'est
comme ça que `_globeHit` (9 531 o) et `UNDOABLE_UI` (7 867 o) sont sortis morts
alors qu'ils sont lus deux lignes plus bas.

**③ « Un compteur d'accolades corrige le ②. »**
Troisième passe : **108 blocs, 74 376 octets**. Toujours faux, autrement — le
compteur dérive sur les **littéraux d'expression régulière** (`/^\s*[[{]/`
ouvre un crochet qui ne se referme pas), et `toBase64url`, `escapeXml`,
`looksJson`, `soloLettres`, `escStr` sont morts par accident de comptage.
*Les trois quarts d'un chiffre spectaculaire étaient un défaut d'analyseur.*

**④ Ce qui a fini par tenir** : la métrique la plus bête. *Combien de fois ce
nom apparaît-il dans tout le dépôt ?* Une seule ⇒ mort. Elle ne se trompe
jamais dans le sens dangereux : elle peut garder du mort en vie (un nom
homonyme, un commentaire), **jamais tuer du vivant**. Elle rend **21** morts au
lieu de 154. Les 21 sont vrais.

**⑤ « `MAX_Z = 11` est un plafond fantôme. »** Il vaut **15** depuis la Tâche 4
quater. Le brief citait une mesure datée ; `src/` disait autre chose.

**⑥ « `EMPRISE_EN_VOL_MAX = 3` contre `CARRE_COTE_MAX = 3`, le clamp ne mord
jamais. »** Il mord : `enVolBorne` reçoit **neuf** entrées, pas trois. J'ai lu
la constante avant de mesurer ce qu'elle produit — l'erreur exacte contre
laquelle le brief met en garde.

**⑦ « Les 7 uniformes JS sans déclaration GLSL sont morts. »** Six d'entre eux
sont déclarés dans des listes à virgules (`uniform float uProgress, uTemps,
uTraine, …`) que mon extracteur, calé sur `uniform <type> <nom>;`, ne voyait
pas. Il n'en restait **qu'un** : `uMerMaille`.
