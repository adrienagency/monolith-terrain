# Rapport R3 — ON NE CHARGE QUE LES DALLES DU SOCLE

**Statut : DONE_WITH_CONCERNS.**
Branche `dalles-crop`, arbre `C:\Dev\wt-dalles`, partie de `4cca4e7`.
**Ce document intègre le tour de correction du 2026-08-23** (relecture
`relecture-R3.md` : C1, C2, I1, I2, I3, M1→M4). Les constats sont repris tels
qu'ils ont été formulés, y compris celui qui dit que ma conclusion était
incomplète.

---

## 0. EN UN COUP D'ŒIL

Sur l'adresse de travail **sans** `&globe=continu` — c'est-à-dire le régime
**par défaut**, `FLAGS.globeContinu` valant `false` (`src/flags.js:60`) :

| grandeur | avant (`4cca4e7`) | après (`b90ab0c`) | écart |
|---|---|---|---|
| tuiles de MNT demandées au réseau | **190** | **118** | **−37,9 %** |
| octets de MNT | 23 818 607 (23,82 Mo) | 16 364 888 (16,36 Mo) | **−31,3 %** |
| tuiles **hors du crop** | **115** | **52** | −54,8 % |
| part hors crop | 60,5 % | 44,1 % | — |
| demandes de `_traverse` hors crop | **63** | **0** | −100 % |
| demandes `_request` (toutes) | 159 | 96 | −39,6 % |
| entrées de cache (`globe.tiles.size`) | 175 | 112 | −36,0 % |
| tuiles **dessinées** | 36 | 36 | **inchangé** |

**Cinq tirages de chaque côté**, cache HTTP coupé, La Réunion, Chrome en fenêtre
visible sur GPU réel. **Étendue 0,0 % sur les cinq tirages** pour toutes les
lignes ci-dessus sauf les octets (σ 518 o sur 16,36 Mo).
Sources : `.banc/R3/avant-chrono.json`, `.banc/R3/final-B.json`.

Sur l'adresse **avec** `&globe=continu`, **3 tirages** de chaque côté
(`avant-continu.json`, `final-A.json`) :

| | avant | après |
|---|---|---|
| tuiles de MNT | 121,67 [121–122] | **112,67 [112–113]** |
| octets | 18,571 Mo | **16,225 Mo** (−12,6 %) |
| hors crop | 46,67 | 46,67 [46–47] — inchangé |
| cache | 175 | **112** |
| demandes `_request` | 191 | **128** |

⚠️ **M1 — le compte de tirages était faux dans la première version** (« cinq par
régime ») : l'adresse A n'en a que **trois**. Aucune valeur n'était fausse, seule
l'étiquette. Corrigé partout dans ce document.

⚠️ **CE QUI N'EST PAS UN GAIN, ET QUI DOIT ÊTRE DIT** : sur l'adresse A, la
retenue de démarrage ne rapporte **rien** au réseau (la purge de file absorbait
déjà ces tuiles) ; les 2,35 Mo qu'on y gagne viennent **entièrement** de la
mutualisation (I3). Et **aucune mesure de temps de ce rapport ne tient** : voir
le §7, qui retire une affirmation de la première version.

---

## 1. L'INSTRUMENT (Étape 1)

`scripts/sonde-dalles.mjs` — nouveau, commit `241b673`. Chrome piloté en CDP
direct (WebSocket natif de Node, **zéro dépendance ajoutée**).

Trois questions que rien ne posait dans ce dépôt :

1. **combien** de tuiles de MNT partent, et pour combien d'octets — via
   `Network.requestWillBeSent` / `loadingFinished`, sur les deux seuls gabarits
   d'URL du dépôt (`tiles.mapterhorn.com/{z}/{x}/{y}.webp`,
   `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`) ;
2. **lesquelles tombent hors du crop** — le départage est fait **par la page
   elle-même** : la sonde y importe `/src/monde/crop-sphere.js` et appelle son
   `tuileDansCrop` avec le `globe._crop` vivant. Aucune copie du critère ;
3. **qui les demande, et à quelle image** — `_request` est enveloppé au moment où
   `main.js` publie `window.__exp` (piège de `defineProperty` posé par
   `Page.addScriptToEvaluateOnNewDocument`, donc avant le moindre module).
   ⚠️ **La pile du `fetch` ne suffisait pas** : elle s'arrête à `_pump`, où les
   quatre chemins deviennent indiscernables. La première version de la sonde
   attribuait ainsi 92 tuiles sur 122 à un « chemin 4 » qui n'en demandait que 9.

Trois pièges corrigés, notés parce qu'ils auraient produit de faux chiffres :

- **la fenêtre de repos se compte depuis la navigation**, pas depuis la dernière
  requête — sinon une page qui se tait à la 12ᵉ seconde voit *toutes* ses
  requêtes tomber « au repos » ;
- **fenêtre visible, pas mode sans écran** : sans écran, Chrome retombe sur
  SwiftShader, que `src/palier-machine.js:200` classe `logiciel` et rabat au
  palier 3, lequel change le damier chargé ;
- **le numéro d'image est enregistré** (correction C2). Il ne l'était pas, et la
  première version de ce rapport citait deux jalons d'image qu'aucune trace ne
  portait.

Relevés bruts : `.banc/R3/*.json` (répertoire ignoré par git). Tous les chiffres
de ce rapport en sortent.

### L'ÉTAT DE DÉPART

**Adresse A** — `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0`
(**3 tirages**, 45 s, fenêtre de repos 15 s) :

| | valeur | étendue |
|---|---|---|
| tuiles de MNT | 121,67 [121–122] | 0,8 % |
| octets de MNT | 18,571 Mo | 0,0 % |
| hors crop | 46,67 → **38,4 %** | 2,1 % |
| **demandes réseau au repos** | **0,00 / s** | — |
| `globe.queue.length` / `inFlight` au repos | **0** / **0** | — |
| `globe.tiles.size` / `_drawn` / `_refusFile` | 175 / 36 / **0** | — |

**Adresse B** — la même **sans** `&globe=continu` (**5 tirages**) :

| | valeur | étendue |
|---|---|---|
| tuiles de MNT | **190** | 0 % |
| octets | 23,818 Mo | 0 % |
| hors crop | **115** → **60,5 %** | 0 % |
| demandes au repos | **0,00 / s** | — |

⚠️ **PREMIER RÉSULTAT : AU REPOS, L'APPLICATION NE DEMANDE RIEN.** Zéro requête
par seconde, file vide, rien en vol, dans les deux régimes. Le symptôme d'Adrien
n'est pas un ruissellement permanent, c'est une **bouffée de démarrage**. Les
« 473 tuiles en chargement » du plan du 2026-08-08 ne se reproduisent pas ici.
⚠️ **Limite de l'instrument, nommée par la relecture** : la sonde **ne bouge
jamais la caméra**. Un ruissellement déclenché par un geste est hors de sa
portée — et le constat C1 ci-dessous montre qu'un geste change tout.

⚠️ **SECOND RÉSULTAT : LE RÉGIME CHANGE TOUT**, et **c'est l'adresse B qui est le
défaut du produit**.

---

## 2. ⛔ LE DIAGNOSTIC DU BRIEF EST FAUX SUR SON POINT PRINCIPAL — MAIS MA CONCLUSION L'ÉTAIT AUSSI

> **Brief, §1 :** « ⚡ **LE PLUS GROS, ET LE PLUS SIMPLE** — `bootInitialView`
> (`main.js:11609`), INCONDITIONNEL. ➡️ L'application télécharge le relief
> complet du bloc plat à chaque chargement, pour un bloc qu'elle rend invisible
> juste après. »

**Mesuré, chemin par chemin, adresse A avant correctif :**

| chemin | demandes de tuiles | dont hors crop |
|---|---|---|
| ④ `loadRealTerrain` → `dem.js:loadDem` | **9** (z12) | **0** |
| sondage de couverture (`probeMaxZoom`) | 6 (z12→z17) | 0 |
| ① `_traverse` | 109 | 63 |
| ③ `demanderEmprise` | 82 | 69 |
| ② racines z2 | 16 | 15 |

Le chemin 4 pèse **9 tuiles sur 122 (7,4 %)**, **toutes dans le crop** : ce sont
les 9 tuiles z12 du bloc 3×3 sur lequel le crop est découpé.

**Et couper ce chemin n'économise pas 9 tuiles, il éteint le produit.**
Expérience faite (garde `&& !terreUniqueBranchee` sur la ligne, un chargement,
puis `git checkout`), **et rejouée indépendamment par le relecteur** :

| | avec le chargement | sans |
|---|---|---|
| `globe._crop` | posé | **`null` — le crop n'existe jamais** |
| tuiles **dessinées** | 36 | **0** |
| voile `#loading` retiré | 4,2 s | **jamais** |
| tuiles de MNT quand même téléchargées | 122 | **80 (6,6 Mo)** |

Chaîne vérifiée à la ligne : `majSeuilSocle` sort à `!(largeurBlocM() > 0)`
(`main.js:4689`) → `veilleCrop.maj()` jamais appelée → `poserCrop` non plus ;
`contexteCrop()` (**`main.js:4915`** — M3 : la première version citait 4905) lit
`terrain.mapUniforms.uCoastMask`, `uSol`, `uAnalysis`, `uRampTex` et
`terrain.fenetreBornee.min/maxM` ; `socleEmprise()` (`main.js:3300`) exige `dem`.

➡️ **Le chemin 4 n'est pas coupé.**

### ⚡ MAIS « RIEN À RETIRER » ÉTAIT FAUX — constat I3

Le relecteur a lu ma propre trace jusqu'au bout, ce que je n'avais pas fait :
**les 9 tuiles z12 apparaissent DEUX FOIS dans `mnt.liste`, même source, même
URL, ~1,7 s d'écart.**

```
mapterhorn 12/2681/2294  376 179 o  t = 2,02 s  loadDem@dem.js
mapterhorn 12/2681/2294  376 174 o  t = 3,68 s  _pump@globe.js
```

Deux mémoires indépendantes : celle de `dem.js` (`tilesEnVol`) ne dédoublonnait
que le **vol** — purgée à l'atterrissage —, celle de `globe.js` (`_tileMemo`)
survivait mais l'autre chemin ne la voyait pas.

**Correction** : la mémoire du globe **déménage** dans
`src/monde/memo-tuiles-mnt.js`, module PUR, que `dem.js` peut importer sans
tirer `three`. Même Map, même borne de 32 Mo, même LRU, même règle « un échec ne
se mémorise pas ». `globe.js` réexporte `_tileMemo` sous son nom historique.
**Ce n'est pas un cache de plus, c'est un cache de moins.**

⛔ **Un résultat vide n'est pas mémorisé, et c'est la condition du partage** :
sur un 404, `dem.js` rend `null` quand `globe.js` **lève** une erreur
`status = 404` que `fetchTile` rattrape pour se replier sur AWS. Mémoriser le
`null` de l'un priverait l'autre de son repli. Testé (④ de
`test/tuiles-mutualisees.test.js`).

**Mesure, adresse B, 3 tirages :** 127 → **118** requêtes,
18 711 905 → **16 364 359** octets, soit **−2,347 Mo (−12,5 %)**.
Il reste 118 requêtes pour **116 URL distinctes** : les deux « doublons »
restants sont des sondes **HEAD** de `probeMaxZoom`, à **0 octet**. Le doublon
d'octets est entièrement éteint.

⚠️ **Le relecteur chiffrait le doublon à 2,705 Mo ; je mesure l'écart à
2,347 Mo.** Je publie le mien parce que c'est celui que j'ai pris (différence
d'octets entre `apres-C1-B.json` et `apres-I3-B.json`), sans contester le sien —
il compte vraisemblablement la taille des neuf tuiles des deux côtés, moi l'écart
observé.

---

## 3. LE VRAI CHEMIN, QUE LE BRIEF NE NOMMAIT PAS (Étapes 2 et 3)

Le tableau du brief marque le chemin ① « ✅ gardé par `_horsCropSeul` ». Il
l'était — **mais seulement une fois le crop posé.** Première ligne de
`_horsCropSeul` : `if (!this._crop) return false`.

Relevé, `_request` instrumenté, **traces reprises pour le constat C2** :

| | adresse A (`&globe=continu`) | adresse B (défaut) |
|---|---|---|
| demandes avant `poserCrop` | **114 sur 191 = 59,7 %** | **114 sur 159 = 71,7 %** |
| tirages, tous identiques | 4 | 3 |
| dernière demande sans crop | image **3 à 12** | image **4 à 9** |
| première demande avec crop | image **39 à 63** | image **75 à 107** |
| tuiles z3 demandées sans crop | **64** (la planète entière) | **64** |

Sources : `.banc/R3/avant-jalons-A2.json`, `.banc/R3/avant-jalons-B.json`.

⚠️ **CE QUE LE CONSTAT C2 A CORRIGÉ.** La première version écrivait « 114 des
191 demandes (60 %) » dans le rapport **et dans trois fichiers source**, sans
qu'aucune trace du disque ne porte la liste par demande de l'adresse A ni le
moindre numéro d'image. Le chiffre était juste ; **il n'était pas
recalculable**, et au regard de la règle de ce chantier c'est la même chose
qu'un chiffre faux. Les traces existent maintenant, les deux régimes sont
donnés, et les jalons d'image sont des **intervalles** — « image 11 / image 41 »
étaient les valeurs d'un tirage.

### Le correctif

`cropAttendu`, option de construction posée par `main.js:4122` sous
`?terre=unique` : *« ce globe ne servira jamais qu'un crop, ne descends pas tant
que tu ne sais pas où il est. »*

- `_horsCropSeul` : `if (!this._crop) return this._retenueAvantCrop() && z > ROOT_Z`.
  **Les racines passent** — sans elles, pas de planète du tout.
- `_traverse` : `if (this._retenueAvantCrop() && !this._crop) wantSplit = false`.

⛔ **LA COUPE EST SUR `wantSplit`, PAS DANS `_children`.** `_children` filtre
déjà par `_horsCropSeul` : il rendrait une liste **vide**, or `[].every(…)` vaut
`true`, la descente « réussit » dans le vide et le `return` qui suit **saute le
dessin de la racine**. C'est le `kids.length > 0 &&` que la Tâche P14 a retiré
comme code mort : il l'était, et il cesse de l'être si l'on coupe trop bas.
**Mesuré** (constat I2) : ligne supprimée, `_drawn` tombe de **16 à 5** —
onze racines sur seize disparaissent, et l'assertion `_drawn > 0` de ① ter
restait vraie. Elle compte maintenant les racines une par une.

---

## 4. ⛔ C1 — LA RÉGRESSION QUE J'AVAIS LIVRÉE

**`_cropAttendu` était un booléen à vie. `_crop`, lui, est RETIRÉ.**
`retirerCrop` (`globe.js`) est appelée par `retirer(g)`
(`branchement-crop.js`) sur **deux chemins nominaux** : au-dessus de
`SEUIL_MORT_M` (40 342,8 m) et à **toute** sortie du mode surface. Le globe
écartait alors tout `z > ROOT_Z` au nom d'un crop qui n'existait plus.

Mesuré par le relecteur dans l'application vivante, même
`__exp.modes.enterOrbit()` :

| en orbite (`_crop` null) | avant `4cca4e7` | après `b08352f` |
|---|---|---|
| tuiles **dessinées** | **283** (z2:5, z10:4, z11:16, z12:162, z13:96) | **16** — z2 uniquement |
| `globe.tiles.size` | 1 425 | 112 |

**C'est le geste central du produit « une seule Terre » — remonter du bloc à la
planète — et il rendait une planète grossière. Aucun des 4 131 tests ne le
voyait.**

**Correction** : la retenue n'est plus le drapeau.
`_retenueAvantCrop() = _cropAttendu && !_cropDejaPose`, où `_cropDejaPose`
s'allume à la **première** `poserCrop` et ne s'éteint jamais.
⚠️ **Ce n'est pas `!this._crop`** : la question n'est pas « y a-t-il un crop
maintenant » (non, en orbite) mais « a-t-on déjà su où il était » — une ignorance
qui ne revient jamais. Le test ⑧ ter l'interdit explicitement.

Trois tests neufs, **sans nombre magique** : ⑧ rejoue la même scène (crop posé,
`retirerCrop`, caméra éloignée) avec et sans le drapeau et exige le **même jeu de
tuiles dessinées** ; ⑧ bis est le témoin d'échec exact ; ⑧ ter interdit le
rallumage. Les trois tombent si l'on remet le drapeau à vie (vérifié par
mutation).

**Et M4 avec** : la réserve « si le MNT ne charge jamais, le globe reste à z2 »
était le **même mécanisme**, pris par l'autre bout. Elle est testée (⑨, 60
images, file vide comprise). La décision reste la même — sous `?terre=unique` le
bloc plat est éteint, une planète grossière vaut mieux qu'un hémisphère que
personne n'a demandé — mais elle rougit si elle change.

---

## 5. CHEMIN 3 — `demanderEmprise` : la garde NE S'Y APPLIQUE PAS (Étape 4)

`demanderEmprise` sépare ses deux emprises par la priorité (`1e9` le bloc,
`9e8` la seconde). Relevé, adresse B :

| | tuiles | dans le crop | hors du crop |
|---|---|---|---|
| emprise **primaire** (le socle), z12 | 25 (5×5, x 2680→2684, y 2293→2297) | 9 | **16** |
| emprise **seconde** (la mer), z11 | 25 | 4 | **21** |

- La **seconde emprise est dehors par construction** : `empriseZoomMer` demande
  `empriseCalotte(rep, PORTEE_CROP = 3)`, trois fois plus large que le crop,
  bornée à `TUILES_MER_MAX = 25`. Lui appliquer `tuileDansCrop` la réduirait à
  4 tuiles et rendrait le champ de mer que la Tâche J a mesuré à 0,7 % de
  couverture — l'aplat gris.
- L'**emprise primaire est un 5×5 autour d'un crop de 3×3** : un anneau de marge
  d'une tuile tout autour. `tuileDansCrop` teste le **centre** de la tuile ;
  l'anneau est ce que la frontière du crop lit (les parois échantillonnent
  `latLonDeLocal(±1, ±1)`). Et ces 25 clés sont celles que `globe.gardeHauteurs`
  réserve : `_purgerFile` et `_evictJusqua` les exemptent explicitement — « les
  évincer rendrait le socle intrinsèquement irremplissable », dit le fichier.

➡️ **Aucune modification de `src/monde/flux-terrain.js`.** Ces 37 tuiles sont le
premier poste hors crop après correctif (37 des 52). **Je n'ai pas mesuré ce que
leur retrait fait au bord du crop, aux parois et à la mer.** Voir §9.

---

## 6. LA CONTRE-PRESSION — ÉLARGIE, PAS LEVÉE (Étape 5)

Le brief demandait de lever les trois gardes `this.continu`. **Objection :**
`FLAGS.globeContinu` vaut `false`, donc le « globe ordinaire » **est la
production**. Les lever la change — ce que l'Étape 8 interdit explicitement. Les
deux consignes du brief sont contradictoires ; j'ai suivi la seconde.

Forme retenue : `_contrePression() { return this.continu || this._cropAttendu }`,
appliquée aux trois mécanismes nommés — `PLAFOND_FILE`, `_purgerFile`, rang 0
d'éviction — **plus la quarantaine**, qui n'est pas un quatrième mécanisme : le
dépôt écrit lui-même que « le tri spatial seul rend les tuiles bloquées
évinçables, hors de lui la question ne se pose pas ». En armant le rang 0, elle
se pose : sans quarantaine, une `error` évincée renaîtrait `empty` et repartirait
sur le réseau.

⚠️ **CE QUE LA MESURE DIT DES TROIS, ET C'EST TRÈS INÉGAL** :

- **`_purgerFile` paie**, et elle seule : c'est elle qui fait la différence
  190 → 122 entre les adresses B et A avant correctif (`mnt.parZoom["3"]` vaut
  **64** sans `continu`, **1** avec) ;
- **`PLAFOND_FILE` ne se déclenche jamais** sur cette scène : `_refusFile` relevé
  à **0** sur tous les tirages, avant comme après ;
- **le rang d'éviction n'est jamais atteint** : 112 à 175 tuiles en cache pour un
  budget de 1 700.

Ces deux-là sont le **filet** (un panoramique rapide, un dézoom), pas le gain.
Ils sont couverts par des tests qui **forcent** leurs conditions à la main.

---

## 7. LE COÛT DE DÉMARRAGE — ⛔ JE RETIRE UNE AFFIRMATION (Étape 7, M2)

La première version de ce rapport écrivait : « le seul effet que je tiens pour
réel est la **stabilité** — l'étendue passe de 23 % à 2,6 % ». **Je la retire.**

Le relecteur a relancé deux tirages dans un autre contexte (machine chargée) :
**3 792 et 7 288 ms après correctif contre 3 611 et 3 874 avant**. J'ai refait
cinq tirages en fin de tour, machine chargée elle aussi. Les trois séries :

| série | premier dessin | σ | étendue |
|---|---|---|---|
| avant (`avant-chrono`, 5 tirages) | 3 780,8 ms | 366,3 | 23 % |
| après C1 (`apres-chrono`, 5 tirages) | 3 444,4 ms | 28,9 | 2,6 % |
| après I3 (`final-B`, 5 tirages, machine chargée) | 5 169,3 ms | 1 266,3 | **62,5 %** |

➡️ **Conclusion honnête : aucune mesure de temps de ce rapport ne survit au
changement de contexte.** Ni le gain de −337 ms (que je refusais déjà), ni la
baisse de dispersion (que je tenais à tort pour réelle). **Ce que je peux dire :
je n'ai pas observé de ralentissement.** Ce que je ne peux pas dire : que le
démarrage soit plus rapide, ni plus stable.

Les grandeurs de **tuiles** et d'**octets**, elles, ont une étendue de 0,0 % sur
cinq tirages et ont été **reproduites indépendamment par le relecteur** dans un
arbre aux données complètes, histogramme par zoom identique.

---

## 8. CLÔTURE — DRAPEAU BAISSÉ (Étape 8)

`?f3=0` (production : ni `terre=unique`, ni `frontiere`), **3 chargements avant**
(par `git stash` du correctif) **et 3 après, y compris après I3** :

- 31 tuiles de MNT à chaque tirage, des deux côtés ;
- **le jeu de tuiles `(source, z, x, y)` est IDENTIQUE au caractère près**
  (`diff` des listes triées : aucune différence).

Et par construction : les six sites modifiés dans `globe.js` sont gardés par
`_cropAttendu`, `false` partout sauf sous `?terre=unique`. Les tests `bis`
(③ bis, ④ bis, ⑤ bis, ⑥ bis, ⑦) le vérifient **par le comportement**, mécanisme
par mécanisme. La mutualisation (I3), elle, s'applique aussi à la production —
et c'est précisément ce que le jeu de tuiles identique vérifie.

**Drapeau levé**, les deux adresses rendent **36 tuiles dessinées**, le même
nombre qu'avant : on a retiré du réseau, pas de l'image.

**Suite complète : `4 142 pass · 0 fail · 0 skipped`** (`npm test`, 213 fichiers).
`npm run audit:tests` : « 213 listés · 213 sur disque · aucun écart ».

### Les mutations, après le tour de correction

Les trois survivantes de la relecture sont tuées :

| mutation | avant le tour | après |
|---|---|---|
| `_traverse` : ligne supprimée | survivait | **tuée** (① ter, ⑨) |
| `main.js` : `cropAttendu: false` | survivait aux 4 131 | **tuée** (⑩) |
| `main.js` : `cropAttendu: true` | survivait aux 4 131 | **tuée** (⑩) |
| `_retenueAvantCrop` → `this._cropAttendu` (le drapeau à vie) | — | **tuée** (⑧, ⑧ bis, ⑧ ter) |
| I3 débranché (`git stash` de `dem.js`/`globe.js`) | — | **tuée** (① et ② de `tuiles-mutualisees`) |

⛔ **`test/dalles-crop.test.js` ⑩ LIT LE TEXTE SOURCE**, alors que l'en-tête du
fichier dit qu'aucune assertion ne le fait. C'est une exception assumée et
écrite : `main.js` n'est chargeable par aucun test de ce dépôt, et le dépôt a
déjà tranché la question **sur la ligne d'à côté du même appel**
(`test/crop-branche.test.js` garde `exagContinue: … || terreUniqueBranchee` par
`assert.match`). Le commentaire dit aussi ce que la garde **ne** prouve pas : que
la valeur arrive au globe — ça, c'est la mutation `_cropAttendu = false` au
constructeur, tuée par sept tests de comportement.

---

## 9. RÉSERVES

1. **Le premier poste hors crop n'est toujours pas traité** : 37 des 52 tuiles
   restantes viennent de `demanderEmprise` (§5). Je refuse d'y toucher **sans
   budget de vérification visuelle** — l'anneau de marge et la nappe de mer sont
   lus par la frontière du crop, et je n'ai pas mesuré ce que leur retrait fait
   au bord. C'est la tâche suivante, et elle a besoin d'un œil, pas d'un
   compteur.
2. **`dem.js` gagne un cache persistant qu'il n'avait pas** (I3). Sur les deux
   scènes mesurées la concurrence n'existe pas — **116 URL distinctes sous
   `?terre=unique`, 31 en production**, pour une borne de 128 entrées AWS — mais
   sur une session qui balaierait beaucoup plus de MNT, les tuiles du socle et
   celles du globe se disputeraient la place. **Le budget total, lui, ne bouge
   pas d'un octet** : c'est la borne du globe, déplacée.
3. **Le journal de débit perd neuf échantillons par chargement** : `noterReponse`
   n'est appelé que par le chargeur du globe, et la tuile vient désormais parfois
   de `dem.js`. C'étaient neuf mesures d'un doublon. Corriger cela imposerait à
   `dem.js` d'importer `globe.js` : non fait, dit.
4. **Quatre tests de `test/dem-load.test.js` ont dû recevoir un
   `_resetTileCaches()`** : ils rejouent les mêmes URL avec une autre réponse
   réseau et lisaient désormais la tuile du test précédent. C'est l'idiome que ce
   fichier emploie déjà trois fois ailleurs, mais **ce sont des tests que je
   n'ai pas écrits** : à relire au moment de la fusion.
5. **Aucune mesure de TEMPS ne tient** (§7). Ce rapport n'annonce aucun gain de
   démarrage, seulement l'absence de ralentissement observé.
6. **Deux des trois mécanismes de contre-pression ne sont pas exercés par la
   scène mesurée** (`_refusFile` = 0, cache à 112 pour 1 700). Filet testé par
   conditions forcées, **pas un gain mesuré**.
7. **Une seule machine, un seul lieu, une seule pose.** RTX 3080 / ANGLE D3D11,
   Chrome en fenêtre visible, **serveur de dev** (pas le build de production),
   La Réunion, caméra au démarrage. **Non mesuré : le panoramique, le dézoom
   continu, une autre zone géographique.** La sonde ne bouge pas la caméra —
   c'est exactement l'angle mort par lequel C1 est passé, et il n'est pas fermé :
   il est seulement couvert par des tests au banc, pas par l'instrument.
8. **Deux fragilités du dépôt rencontrées par ricochet, et il faut le savoir :**
   `src/gardien.js` recensait la borne de la mémoire sous
   `TILE_MEMO_OCTETS_MAX` dans `globe.js` (l'entrée suit le déménagement) ; et
   mon commentaire contenait le littéral `retirerCrop()`, que
   `test/estompage-terre.test.js` ⑦d cherche par `indexOf` pour découper le corps
   de la méthode — parenthèses retirées du commentaire. **Un test qui lit le
   texte source cassé par un commentaire : la fragilité que ce chantier
   documente, rencontrée en vrai.**
9. **`package.json` : deux fichiers de test ajoutés à la ligne `test`.** Conflit
   d'une ligne si une tâche parallèle en ajoute aussi : garder les deux, puis
   `npm run audit:tests`.
10. **Écart de périmètre** : le brief plaçait mon point d'entrée à
    `main.js:11609`. Je n'y ai pas touché (§2) ; j'ai touché **`main.js:4122`**,
    la construction du `Globe`. C'est loin des zones 4564-4600 et 4750-4780 des
    tâches parallèles. J'ai en revanche touché `src/dem.js` et `src/gardien.js`,
    qui n'étaient pas dans mon périmètre initial — I3 l'exigeait.
11. **J'ai ajouté une ligne dans `_traverse`.** Le travail de la Tâche N n'est pas
    modifié (tri spatial, horizon, frustum, règle sans-trou, `_horsCropSeul` dans
    `_children` : intacts), mais la ligne est **dans** sa fonction.

---

## 10. CE QUI A ÉTÉ TOUCHÉ

| fichier | nature |
|---|---|
| `src/globe.js` | `_cropAttendu` + `_cropDejaPose` au constructeur ; `_retenueAvantCrop()` et `_contrePression()` (neuves) ; `_horsCropSeul` (1 ligne) ; 5 gardes `this.continu` → `_contrePression()` ; 1 ligne dans `_traverse` ; `_cropDejaPose = true` dans `poserCrop` ; la mémoire de tuiles déménagée (I3) |
| `src/main.js` | **une seule ligne**, 4122 : `cropAttendu: terreUniqueBranchee` |
| `src/monde/memo-tuiles-mnt.js` | **neuf** — la mémoire de tuiles de MNT, partagée |
| `src/dem.js` | `fetchTerrainTile` passe par la mémoire partagée ; `tilesEnVol` supprimée ; `_resetTileCaches` la vide |
| `src/gardien.js` | l'entrée `globe-tuiles` suit le déménagement de la borne |
| `test/dalles-crop.test.js` | **neuf** — 21 tests |
| `test/tuiles-mutualisees.test.js` | **neuf** — 4 tests |
| `test/dem-load.test.js` | 4 `_resetTileCaches()` ajoutés |
| `scripts/sonde-dalles.mjs` | **neuf** — l'instrument |
| `package.json` | ligne `test` : deux fichiers ajoutés |

**Non touchés**, alors qu'ils sont dans le sujet :
`src/monde/flux-terrain.js`, `src/monde/veille-repos.js`,
`src/monde/branchement-crop.js`, `src/ocean.js`, `src/monde/mer-sphere.js`,
le nuanceur de `src/globe.js`, `_rechargeTuiles`, `main.js:11609`,
`main.js:4564-4600`, `main.js:4750-4780`.

## 11. COMMITS

| | |
|---|---|
| `241b673` | l'instrument (`scripts/sonde-dalles.mjs`) |
| `b08352f` | le correctif + les 16 tests + `package.json` |
| `1ca430c` | le rapport |
| `b5a15b4` | **C1 (+M4)** — en orbite, la planète retombait à seize racines |
| `17585c6` | **I2** — `_drawn > 0` était trop faible d'exactement une ligne |
| `64eeda3` | **C2** — le chiffre-titre remonte à sa source, dans les deux régimes |
| `39c6cd7` | **I1** — le branchement n'était gardé par rien |
| `b90ab0c` | **I3** — les neuf tuiles du bloc étaient téléchargées deux fois |
| (celui-ci) | **M1→M3** — le rapport corrigé : étiquettes de tirages, renvoi de ligne, et la « stabilité » retirée |
