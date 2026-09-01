# R25 — LES DIX-SEPT MATIÈRES DE SURFACE

Arbre `C:\Dev\wt-mat`, branche `matieres-sphere`. Trois commits.
`npm test` : **4 604 · 0 échec** (base à battre : 4 573). `npm run audit:tests` : **238 = 238, aucun écart**.

---

## ⛔ AVIS DE CROISEMENT — POUR LE COORDINATEUR, À LIRE AVANT LA FUSION

> **Restriction reçue en fin de tâche :** *« reste strictement sur le matériau et
> les préréglages PBR, ne touche plus à la colorisation »*, `wt-sty` /
> `style-monde` tenant désormais le bloc de colorisation du fragment de
> `globe.js`.

**Réponse honnête : OUI, j'y suis déjà entré, et je ne défais rien comme demandé.**
Voici le partage exact, pour que l'arbitrage se fasse sur des lignes et non sur un
conflit de fusion.

### Ce que j'ai touché DANS le bloc de colorisation — 5 lignes, toutes sur l'ALBÉDO DU CROP

| ligne d'origine | ce qu'elle est devenue | nature |
|---|---|---|
| `float nduCrop = dot(nMonde, uHemiHaut);` | `dot(nMat, …)` | **renommage** — `nMat` vaut `nMonde` tant que `uMatOn = 0` |
| `vec3 fondCrop = uAlbedoBase * natGris(…);` | `vec3 fondCrop = baseMat * grisCrop;` | **un facteur** — `baseMat` vaut `uAlbedoBase` tant que `uMatOn = 0` |
| `col = mix(col, albedoCrop(col, uAlbedoBase, …), partBloc);` | `albedoCropMat(col, baseMat, grisCrop, teinteMat, ombreMat)` | **variante à ombre explicite ; `albedoCrop` lui DÉLÈGUE** |
| `irradianceCrop(dot(nMonde, uSoleilDir), …)` | `dot(nMat, …)` | renommage |
| `irradianceAppoint(dot(nMonde, uAppointDir), …)` | `dot(nMat, …)` | renommage |

… plus **un bloc inséré juste au-dessus** (`baseMat` / `teinteMat` / `nMat` /
`revele`), **entièrement sous la garde `uMatOn > 0.5 && dedansCrop > 0.0`**.

⚡ **À `uMatOn = 0`, ces cinq lignes rendent la valeur d'avant AU BIT PRÈS** :
`baseMat === uAlbedoBase`, `teinteMat === uAlbedoTeinte`, `nMat === nMonde`, et
`ombreMat === natOmbrePeinture(natLuminance(fondCrop))` — c'est-à-dire exactement
ce que `albedoCrop` calculait en interne. Un test le verrouille.

### Ce que je n'ai PAS touché — la liste qu'il tient

**Aucune** de ces lignes n'apparaît dans mon diff : `RAMPE_MONDE`,
`monde/rampe-crop.js`, le trait de côte (`uCoastMask`, `uInk`, le `fwidth`),
`uAerialCoastFade`, la bathymétrie / `uMerRampe*` / `monde/fond-crop.js`, le
peigne de crêtes `uTexShade` et tout `GLSL_NATUREL`, le grain (`grainP`,
`uGrainParPixel`), les courbes de niveau, le graticule, le terminateur
(`float day = … dot(nMonde, uSunDir)` — **laissé sur `nMonde` exprès** : la nuit
n'est pas une affaire de matière).

### Les deux points où la fusion peut mordre, nommés

1. **`src/monde/eclairage-crop.js`** — `albedoCrop` **délègue** désormais à
   `albedoCropMat`. Une réécriture du mélange par l'autre tâche doit se poser dans
   `albedoCropMat`, sinon il y aura deux lois. **C'est le seul endroit partagé qui
   porte de la couleur.**
2. **`test/crop-eclairage.test.js` ⑤e** — l'ancre d'ordre est passée de
   `albedoCrop(col, uAlbedoBase` à `albedoCropMat(col, baseMat`. La garde de
   l'ORDRE (albédo → apparence → côte → courbes → lumière) est intacte ; seule
   l'ancre a changé de forme.

### Trois choses utiles pour son arbitrage

- ✅ **Mes douze uniformes sont nommés distinctement** (`uMat*`) et **n'écrivent
  jamais dans `col`** : ils composent `baseMat`, que la loi existante consomme.
- ⚠️ **Le compte de samplers du fragment passe de DIX à DOUZE** (plafond 16, quatre
  libres). **Deux tests le comptent** (`crop-habillage` ①, `crop-eclairage` ⑤f) et
  exigent que le pavé de `globe.js` annonce le même nombre : s'il en ajoute, c'est
  là qu'il faut regarder d'abord.
- ⛔ **La garde des tables factices ne couvrait qu'UN fichier sur TROIS.** Sa note
  ne parle que de `test/grille-crop.test.js` ; `crop-habillage` et `crop-naturel`
  en portent une aussi, et R25 y a fait tomber **onze** puis **trois** tests sur le
  même `Cannot set properties of undefined` muet. **La garde est maintenant sur les
  trois** — c'est la parade réelle à la collision qu'il redoute.

### Et un désaccord de base de tests à trancher

Il annonce **4 576 · 0 échec** et **`audit:tests` 237 = 237**. Ma branche part de
`5e4fa3b`, dont la base est **4 573 · 237** ; j'arrive à **4 604 · 238**
(+31 assertions, +1 fichier). **Les trois tests d'écart sont donc arrivés sur
`regroupement` après mon départ**, et ma branche ne les porte pas encore : à la
fusion, attendre **4 607**, pas 4 604 — et refaire `audit:tests`, la ligne `test`
de `package.json` étant une liste explicite.

---

## ⓪ EN UNE PHRASE

**Le sélecteur n'était pas un choix entre dix-sept matières : c'était un
interrupteur à deux positions**, et la seconde position était une perte. Les
quinze matières opaques rendaient **la même image** ; ce qui manquait au globe
tenait en **un facteur** — la texture. Le verre, lui, est **sans objet et caché**,
et le chiffre qui le dit a été pris **avant** d'écrire une ligne.

---

## ① LES TROIS QUESTIONS DU BRIEF, TRANCHÉES AVANT D'ÉCRIRE

### « Les dix-sept sont-elles dix-sept ? » — **non : seize + le retrait**

Le picker rend bien **17 tuiles**, mais ce sont **16 matières et « Aucune »**
(`src/material-catalog.js`, `MATERIALS.length === 16`). Des seize :

| famille | nombre |
|---|---|
| verre (`kind: 'glass'`) | **1** |
| jeux PBR CC0 sur disque (`kind: 'dir'`) | **14** |
| procédurale (`kind: 'tex'`) | **1** |

⚠️ **Et l'hypothèse du brief sur la « famille verre coloré » est FAUSSE ici.** Ces
25 verres (`ruby`, `emerald`, `ior`, `transmission`, `attenuation`) sont dans
`src/material-presets.js`, qui est le banc du **SOCLE (la plinthe)**, pas celui de
la surface du relief. L'option 38 lit `src/material-catalog.js` — deux fichiers,
deux pickers, et le brief a désigné le mauvais.

⚡ **Deux matières partagent en revanche leurs images, et le catalogue le dit
lui-même** : l'albâtre est copié du jeu `onyx002` (« copiées dans leur propre
dossier pour que la matière soit AUTONOME »). Ce qui les sépare — la rugosité
(0,52 contre 0,32) et le terme `sss` — sont **les deux postes sans receveur sur
la sphère**. C'est la seule exception du verdict ci-dessous, et elle est
structurelle, pas accidentelle.

### « Le globe n'a pas de matière PBR » — **encore vrai, et c'est PIRE que ça**

⛔ **Et le brief a lu l'inventaire de travers, dans le sens de la prudence.** La
ligne 306 porte `✅ 3,560` en colonne **sphère** ; le `⛔` que le brief cite est
dans la colonne **« lu par »**, où il commente ce qui traverse. L'option n'était
donc pas déclarée morte.

Mais le ✅ 3,560 ne dit pas ce qu'il a l'air de dire. Relevé le 2026-09-01, La
Réunion, réglages par défaut, **pleine résolution 1 280 × 800**, les **dix-sept
vignettes CLIQUÉES une par une** (`scripts/sonde-r25.mjs` — le chemin d'un doigt :
`.ce-mat-vig` → `setSurfaceMat` → `setMaterialMode` + `blockGrid.restyle` +
`refreshAll`) :

| comparaison | écart moyen /255 |
|---|---|
| « Aucune » contre elle-même — **le plancher de bruit du banc** | **0,231** |
| une matière opaque contre « Aucune » | 3,29 à 3,57 |
| **les quinze matières opaques ENTRE ELLES**, 105 paires | min **0,025** · **médiane 0,2312** · max **0,338** |

⚡ **La médiane des 105 paires retrouve le plancher de bruit à la troisième
décimale.** Les quinze rendaient la même image. Le `3,560` de l'inventaire est la
ligne « Éboulis contre Aucune » : **une seule matière comparée à l'absence de
matière ne peut pas voir que les quinze sont interchangeables.**

Et la position « matière » était une **perte** : tout ce qui traversait était
`setMaterialMode` posant `material.color` à **blanc** et `uTint` à **zéro** — la
peinture hypsométrique retirée, et rien mis à la place.

### « Que fait `setMaterialMode` ? » — **les DEUX, et c'est ce qui a décidé du portage**

| branche | ce qu'elle fait |
|---|---|
| `'glass'` | **remplace le matériau du maillage** (`mesh.material = glassMaterial`) et **sort** — sans toucher `map` ni `uTint` |
| opaque | **mute `this.material`** (`map`, `normalMap`, `roughnessMap`, `metalness`, `roughness`, `normalScale`, `color`) **ET pose des uniformes** (`uMatSSS`, `uTint = 0`, `uMatNoise*`, `uMatAboveZero`) |
| `''` | rend la carte topographique, `rebuildRoughness` |

⛔ **Et le maillage qu'il habille n'est PAS dessiné en mode sphère** :
`terrain.mesh.visible === false` (relevé, et déjà consigné par
`monde/lumiere-sphere.js`). C'est pourquoi le portage devait passer par le
nuanceur des tuiles, et pourquoi **le verre ne rendait littéralement rien**.

---

## ② LE VERDICT PAR VIGNETTE, AVEC LE CHIFFRE QUI LE PROUVE

La Réunion, mode surface, crop posé, pleine résolution, `params.paused`.
`window.__palierMachine` relevé dans le MÊME relevé : `ombres`, `grain`, `nuages`
et `dof` **tous nuls**, écran signalé `[800, 600]` — le palier n'a donc pas bougé
entre les dix-sept, et il ne peut expliquer aucun écart.

**Plancher de bruit du banc, mesuré dans chaque tour : 0,231 (avant) · 0,240 (après).**

### Les quinze matières opaques — **VIVANTES, et enfin distinctes**

Deux colonnes, et c'est la seconde qui compte : *écart à « Aucune »* dit que la
vignette fait quelque chose ; **la distance au VOISIN LE PLUS PROCHE dit qu'elle
fait quelque chose de PROPRE.**

| vignette | avant → après, écart à « Aucune » (moy) | avant → après, **voisin le plus proche** | verdict |
|---|---|---|---|
| Herbe | 3,370 → **14,942** | 0,126 → **2,821** (Roche patinée) | ✅ vivante |
| Roche foncée | 3,552 → **18,761** | 0,025 → **2,563** (Roche brute) | ✅ vivante |
| Roche brute | 3,479 → **18,938** | 0,141 → **2,563** (Roche foncée) | ✅ vivante |
| Roche patinée | 3,542 → **14,116** | 0,033 → **2,821** (Herbe) | ✅ vivante |
| Éboulis | 3,560 → **17,182** | 0,109 → **3,199** (Roche brute) | ✅ vivante |
| Terre | 3,514 → **11,371** | 0,073 → **3,436** (Onyx) | ✅ vivante |
| Marbre veiné | 3,572 → **2,986** | 0,106 → **2,098** (Métal patiné) | ✅ vivante |
| Marbre blanc | 3,465 → **23,612** | 0,152 → **0,694** (Carbone) | ✅ vivante |
| Onyx | 3,558 → **8,580** | 0,074 → **0,322** (Albâtre) | ⚠️ vivante, voir ci-dessous |
| Albâtre | 3,290 → **8,290** | 0,126 → **0,322** (Onyx) | ⚠️ vivante, voir ci-dessous |
| Neige fraîche | 3,548 → **5,611** | 0,025 → **2,149** (Toile) | ✅ vivante |
| Toile | 3,522 → **4,074** | 0,141 → **2,149** (Neige fraîche) | ✅ vivante |
| Métal brossé | 3,532 → **2,659** | 0,033 → **1,067** (Métal patiné) | ✅ vivante |
| Métal patiné | 3,569 → **2,592** | 0,109 → **1,067** (Métal brossé) | ✅ vivante |
| Carbone | 3,478 → **23,859** | 0,073 → **0,694** (Marbre blanc) | ✅ vivante |

⚡ **La colonne du voisin le plus proche est le vrai résultat.** Avant : **quinze
sur quinze** à **0,025 – 0,152**, c'est-à-dire **toutes sous le plancher de bruit
de 0,231**. Après : **0,32 – 3,44**, toutes au-dessus.

⚠️ **Trois notes de prudence, et je les publie plutôt que de les taire :**

1. **Marbre veiné (2,986), Métal brossé (2,659) et Métal patiné (2,592) ont un
   écart à « Aucune » PLUS FAIBLE qu'avant.** Ce n'est pas une régression : leur
   albédo est proche du blanc que l'ancienne branche posait, donc l'écart à la
   carte topographique se réduit — pendant que leur écart aux quatorze autres
   passe de 0,03–0,11 à 1,07–2,10. **La bonne grandeur est la seconde.**
2. **Onyx et Albâtre ne se séparent que de 0,322**, soit **1,4 fois** le plancher.
   Sous la règle du dossier (« entre 0,06 et 0,19 un relevé unique ne décide de
   rien »), 0,322 est au-dessus de la bande — mais il est honnête de dire que ces
   deux-là **restent proches**, et la cause est écrite au catalogue : **leurs
   images sont les mêmes** (l'albâtre est copié d'`onyx002`). Ce qui devait les
   séparer — rugosité et diffusion `sss` — **n'a pas de receveur** (§④).
3. **Le grain du banc n'est pas le grain du studio** : le palier rend `grain:
   null` et `main.js` porte `grain: 0` par défaut (leçon ④ du dossier). Rien de ce
   qui est ci-dessus n'est du grain.

### « Aucune » — **vivante par construction**

C'est la tuile de retrait : elle rend la carte topographique
(`uMatOn = 0`, `uTint = params.mapTint`). Elle sert de référence à tout ce tableau.

### « Verre » — ⛔ **SANS OBJET, BORNÉE VOLONTAIREMENT, AVEC LE COÛT MESURÉ**

| preuve | chiffre |
|---|---|
| écart à « Aucune », avant | **0,3012** pour un plancher de **0,231** |
| écart à « Aucune », après | **0,3022** pour un plancher de **0,240** |
| identité mesurée | Verre contre Aucune : **0,30** ; Verre contre une matière : **3,35** |
| par construction | `setMaterialMode('glass')` ne touche **que** `mesh.material`, sur un maillage dont `visible === false` |

**Le nombre et la construction disent la même chose : le verre ne rendait rien.**
Et le coût de le faire rendre quelque chose est au §③. **Sa vignette est
maintenant cachée en mode sphère, avec ses cinq réglages.**

### Aux DEUX altitudes — ⚠️ **aucune vignette n'agit en orbite, et c'est structurel**

Même sonde, `modes.enterOrbit()` : les dix-sept rendent **0,020 à 0,437** pour un
plancher de **0,217**, et `uAlbedoBase` / `uAlbedoTeinte` sont revenus à leur
état de repos `(1, 1, 1)` / `1`. **Le crop meurt à `SEUIL_MORT_M = 40 342,8 m`** ;
`retirerHabillage` rend alors `uMatOn` à zéro, et le nuanceur ne franchit même pas
la garde `uMatOn > 0.5 && dedansCrop > 0.0`. La matière du relief est **une couche
de crop**, exactement comme la photo aérienne de R9. Ce n'est pas une réserve :
c'est ce qu'elle est.

---

## ③ LE COÛT EN TEMPS GPU — MINUTERIE DU PILOTE, DEUX ALTITUDES, TÉMOIN DE VALIDITÉ

`EXT_disjoint_timer_query_webgl2`. Protocole durci de R20 ⑫ : **22 s de repos**
avant toute mesure (le flux de tuiles contamine tout), simulation en pause, chauffe
jetée, **témoin de validité AVANT ET APRÈS** — ×4 fragments (pixelRatio 1 → 2)
doit multiplier le temps. `scripts/diag-r25-cout.mjs`, `.banc/R25/`.

**Témoins : ×4 fragments ⇒ ×3,70 à ×8,28 de temps** sur les huit relevés. Tous
au-dessus du seuil de 2. Aucun relevé marqué douteux.

### ⛔ La transmission — mesurée AVANT de porter quoi que ce soit

Ce qui est pesé est **une passe de rendu de la scène en plus**, c'est-à-dire
exactement ce que `WebGLRenderer.renderTransmissionPass` soumet.

| altitude | image seule | + une passe de scène (pleine) | + une passe (au **quart** des fragments) | facteur |
|---|---|---|---|---|
| **crop** (dist 145,5) | **0,4119 ms** | **1,5929 ms** | 1,7148 ms | **×3,87** |
| **orbite** (dist 100,6) | **0,4046 ms** | **1,9319 ms** | 1,9549 ms | **×4,78** |

⚡ **Et la sortie de secours n'en est pas une.** Au **quart** des fragments (ciseau
à 640 × 400), le surcoût est de **1,303 ms** contre **1,181 ms** en pleine
résolution — **le même, à la dérive du banc près (0,042 ms)**. La passe n'est pas
limitée par les fragments : elle est limitée par la **re-soumission de la scène**,
c'est-à-dire par le quadtree entier. **La cible demi-résolution que `three` alloue
n'y changerait rien.** C'est ce qui ferme la porte, pas le facteur brut.

➡️ **Décision : le verre est borné hors de la sphère.** D16 exige qu'une passe de
rendu soit chiffrée avant d'être ajoutée ; elle l'est, et elle ne passe pas.

### ✅ Le nuanceur de matière — deux tours, et la valeur la MOINS favorable

| altitude | tour 1 | tour 2 | publié |
|---|---|---|---|
| **crop** | sans 0,4175 / avec 0,4401 → **+0,0226 ms · ×1,054** | sans 0,4626 / avec 0,4813 → +0,0187 ms · ×1,040 | **+0,0226 ms · ×1,054** |
| **orbite** | +0,0898 ms · ×1,196 | **+0,0160 ms · ×1,039** | ⚠️ **non reproduit — voir ci-dessous** |

Au **crop**, les deux tours se recoupent : les deux lignes de base ne diffèrent que
de **0,0005 et 0,0050 ms**, les deux « avec » de **0,0021 et 0,0029 ms**. Le
surcoût est **reproductible**, et il vaut **5,4 % du temps d'image** pour deux
textures échantillonnées, un bruit de valeur et une perturbation de normale.

⛔ **En orbite, je retire le chiffre.** Le tour 1 rend +0,0898 ms, le tour 2
+0,0160 ms — **un facteur 5,6 entre deux tours** —, et au tour 1 les deux lignes
de base « sans » différaient à elles seules de **0,052 ms**, c'est-à-dire **plus
que l'effet mesuré**. Au tour 2, `avec2` (0,4257) est même **inférieur** à `sans2`
(0,4276) : le signe s'inverse. **C'est de la dérive de machine, pas un coût.**

⚡ **Et le coût réel en orbite est nul PAR CONSTRUCTION** : `uCropOn = 0` donc
`dedansCrop = 0` partout, la garde `uMatOn > 0.5 && dedansCrop > 0.0` n'est jamais
franchie, et `retirerHabillage` a de toute façon rendu `uMatOn` à zéro. **Le banc a
dû forcer l'uniforme à 1 pour mesurer quoi que ce soit** — il pesait donc
l'évaluation d'une condition fausse. La construction est ici plus solide que le
chronomètre, et c'est elle que je publie.

### Le compte de samplers — **de dix à DOUZE, plafond seize**

`uMatMap` et `uMatNormal`, **une seule paire pour tout le bloc** (mise en cache par
dossier dans `terrain._loadTextureSet`). ⛔ **La carte de rugosité aurait fait
treize**, et elle n'y est pas — non pour tenir le compte, mais parce qu'elle n'a
pas de receveur (§④). **Quatre unités restent libres**, et le plafond n'est pas
théorique : `terrain.js` a déjà planté dessus (« le gabarit java passait de 17 à
18 unités, le terrain ne linkait plus et disparaissait »). Deux tests le comptent,
et exigent que le pavé de `globe.js` annonce le même nombre.

---

## ④ AUCUN CURSEUR NI VIGNETTE AFFICHÉ EN MODE SPHÈRE S'IL N'AGIT PAS

Même mécanique que R21 : une **table** (`POSTES_MATIERE_SPHERE`) qui dit poste par
poste s'il a un receveur, **avec son motif écrit à côté**, et `visibleWhen` qui
l'exécute. Une seule écriture de « ça n'agit pas », et un test la relit.

**Vérifié à l'écran** — en lisant le **style en ligne** que `visibleWhen` écrit, et
non `offsetParent` (⚠️ un premier tour de la sonde s'y est fait prendre : la
section est repliée par défaut, donc **tout** était « invisible » et le relevé ne
disait rien) :

| | état |
|---|---|
| vignettes visibles | **16 sur 17** |
| vignette cachée | **Verre** |
| « Rugosité » | **CACHÉ** |
| les quatre autres curseurs | **visibles** |

### Ce qui agit, et de combien — mesuré par le chemin d'interface

Chaque curseur bougé dans le DOM (`input` **puis** `change` — certains ne valident
qu'au relâchement ; la bascule est un `<button class="ce-toggle">`, pas une case à
cocher, et un premier tour l'a déclarée introuvable **par erreur d'instrument**) :

| curseur | course | moy | grad |
|---|---|---|---|
| **Échelle (tuilage)** | `uMatRepeat` 3,75 → 15 | **1,8112** | 1,5687 |
| **Relief de la matière** | `uMatBump` 0 → 3 | **1,3306** | 1,0603 |
| **Bruit (révèle la base)** | 0 → 0,8 | **5,4605** | 1,8662 |
| **Au-dessus du niveau zéro** | off → on | **4,5035** | 1,5663 |

pour un plancher de bruit de **0,231**. ⚠️ **Un premier relevé de « Relief de la
matière » rendait 0,3535** parce qu'il bougeait `uMatBump` de sa valeur de départ
(2,08 = 1,3 × le `normalScale` du préréglage) à 3 — **1,5 fois le plancher, donc
indécidable**. Les deux BOUTS du curseur, eux, tranchent : **1,3306**.

### Ce qui ne peut PAS agir, avec la raison mesurée

| poste | motif |
|---|---|
| **Rugosité**, métalness, `envMapIntensity` | ⛔ **aucun receveur, et c'est structurel** : le crop est éclairé par `albedo × irradianceCrop(…) × 1/π`, c'est-à-dire **`BRDF_Lambert` et rien d'autre** — **0 terme spéculaire et 0 `envMap`** dans `globe.js`. Écrire un GGX ici ne serait pas une transcription mais **une seconde loi d'éclairage** à tenir d'accord avec celle de `three` (la faute de D13 §③). |
| **Verre** + ses 5 réglages | ⛔ la transmission est une passe de rendu : **×3,87 à ×4,78** du temps d'image, mesuré |
| **diffusion `sss` de l'albâtre** | ⛔ elle demande le vecteur de **VUE** (`normalize(vViewPosition)` dans `terrain.js`), et le nuanceur des tuiles n'en porte aucun : ses sommets sont en **RTC** (relatifs au centre de leur tuile) **exprès** pour ne pas payer l'ulp float32 à magnitude 100 (0,486 m). Ajouter un varying de vue rouvrirait cette précision-là. **C'est la cause du 0,322 entre Onyx et Albâtre.** |

---

## ⑤ LES CONVERSIONS D'UNITÉ QUE J'AI ÉCRITES, AVEC LEUR FACTEUR

La classe de défaut n° 1 du chantier — neuf occurrences. Ma matière en portait
trois, et **elles n'ont pas le même facteur**. Toutes vivent dans
`src/monde/matiere-crop.js`, avec leur démonstration, et un test les exécute.

### ① Le tuilage — **SANS DIMENSION, facteur 1**

`terrain.js` pose `texture.repeat.set(rep, rep)` sur un maillage dont les UV vont
de 0 à 1 d'un bord à l'autre du bloc ; le globe tient `qCrop ∈ [−1, 1]`, également
d'un bord à l'autre. Deux **répétitions par largeur de bloc** : `uv = qCrop × 0,5
+ 0,5`, la même conversion que `cmUv` pour les masques cuits.

⚡ **Et c'est pour ça qu'il n'y a PAS de `uFxFenetre` ici**, contrairement à la
couche d'apparence : celle-ci indexe son motif sur `champXZ()`, du monde en unités
de scène, donc la fenêtre continue doit l'y décaler ; **une carte de matière est
indexée sur l'UV DU MAILLAGE**, qui suit le bloc quand il se déplace. Y ajouter la
fenêtre aurait fait **glisser la texture sous le socle**.

### ② Le champ du bruit — **UNITÉS DE SCÈNE, facteur 28**

`terrain.js` écrit `mnNoise(champXZ() * uMatNoiseScale)` — des unités de scène. Le
globe ne connaît que `qCrop`. **Poser `mnNoise(qCrop * uMatNoiseScale)` aurait
rendu des taches vingt-huit fois plus grandes** : à `uMatNoiseScale = 0,5, **0,5
période** en travers du bloc au lieu de 14, c'est-à-dire **UNE tache, donc pas un
motif**. Le facteur existe déjà et il est vivant : `uFxDemiBloc` (= `uSlabHalf`).
J'ai réemployé **la même expression** que la couche d'apparence, `qCrop ×
uFxDemiBloc + uFxFenetre`, plutôt que d'en écrire une seconde.

### ③ La bande du niveau zéro — **VERTICALE, donc `/ exagération` : 0,05 → 12,213 m**

`terrain.js` : `1.0 - smoothstep(uSeaY - 0.05, uSeaY + 0.05, vWorldPos.y)`, en
unités de scène, sur un relief **déjà exagéré**. Le globe tient `h` en **mètres
bruts** et son niveau de la mer vaut **0 m**.

    unités de scène par mètre = (span / extentMeters) × exagération
                              = (56 / 27 356,4) × 2 = 4,094 106 × 10⁻³
    0,05 unité de scène       = 12,2127 m

⛔ **Recopier « 0,05 » aurait donné cinq centimètres** là où le socle en a 12,2 m :
**un facteur 244**, c'est-à-dire une marche franche au lieu d'un fondu sur toute
la ligne de côte. Relevé à l'écran après portage : `uMatBandeM = 12,212`.

⚠️ **ET LE FACTEUR N'EST PAS EXACTEMENT CELUI QUE LE BRIEF M'A DONNÉ, PARCE QUE LE
BLOC A DEUX LARGEURS.** `rapport-R24.md` publie **4,094 425e−3** ; le mien vaut
**4,094 106e−3**. L'écart, **+7,8 × 10⁻⁵ en relatif**, est exactement celui que le
plan de fusion nomme entre `dem.extentMeters` (**27 356,4 m**) et `_empriseVue`
(**27 354,269 m**) — *« les deux largeurs diffèrent de 0,0079 % »*. R24 est parti
de la seconde, `matiereDuCrop` de la première, **et c'est le bon choix** :
`dem.extentMeters` est la largeur du MNT que le socle a effectivement drapé, donc
celle sur laquelle son 0,05 s'applique. Sur 12,21 m l'écart vaut **1 mm** — mais
un chiffre repris d'un autre rapport sans vérifier sa source est précisément ce
qui a coûté neuf fautes d'unité à ce chantier. Le test vérifie les **deux**.

### ④ Et les deux longueurs du verre, puisque je les ai cherchées

`_makeGlassMaterial` pose `thickness: 8` et `attenuationDistance: 12`, en unités
de scène. Même loi : **8 → 1 954 m d'épaisseur**, **12 → 2 931 m d'atténuation**.
Les recopier telles quelles aurait donné **huit mètres de verre** : un bloc de
27 km de large serait sorti entièrement opaque, teinte saturée au premier mètre.
Elles sont écrites dans le module pour le prochain qui rouvrira le verre.

---

## ⑥ CE QUE J'AI CRU, PUIS RÉFUTÉ

### ① « L'inventaire déclare l'option 38 morte » — **faux, et le brief me l'a transmis**

Le `⛔` cité par le brief est dans la colonne **« lu par »**, pas dans la colonne
**sphère**, qui porte `✅ 3,560`. ⚡ **Mais le ✅ était incomplet là où son auteur
s'interdisait de l'être** — c'est la leçon ① du dossier prise par l'autre bout :
non pas « le chiffre le plus favorable parmi deux », mais **le seul chiffre qu'on
ait pensé à prendre**. Une matière contre l'absence de matière ne peut pas voir
que les quinze sont interchangeables. Il fallait **105 paires**, pas 1.

### ② « `material-presets.js` suggère une famille verre coloré » — **mauvais fichier**

Le brief désigne `ruby`, `emerald`, `ior`, `transmission`, `attenuation`. Ce sont
les 25 verres du **SOCLE (la plinthe)**. Le sélecteur de l'option 38 lit
`src/material-catalog.js`, qui n'a **qu'un seul** verre. Aucune des dix-sept
vignettes n'est une variante d'une autre par `color` + `attenuation`.

### ③ « `mnHash` / `mnNoise` manquent au globe, il faut les apporter » — **ils y étaient**

Je les ai recopiés de `terrain.js`. `globe.js` les portait **déjà** (« le bruit de
valeur du grain », mêmes deux lignes, mêmes constantes). Le compilateur a rendu
*« function already has a body »* sur les deux — et **le fragment entier refusait
alors de se lier, donc plus une seule tuile ne se dessinait**.

⛔ **Et voici le vrai enseignement, qui vaut plus que la faute : LE BANC
DIFFÉRENTIEL N'A RIEN VU.** Dix-sept images **cassées de la même façon** s'écartent
les unes des autres de 0,12 à 0,33 — c'est-à-dire du bruit. Mon relevé disait
*« aucune vignette n'agit »* là où il fallait lire *« la Terre a disparu »*, et il
avait l'air parfaitement plausible : un portage qui ne marche pas encore. **La
console, elle, le disait en toutes lettres.**

➡️ **Deux gardes en sont sorties** : la sonde surveille désormais les erreurs de
nuanceur et refuse son relevé s'il y en a ; et un test refuse toute fonction du
module qui serait déjà déclarée dans `globe.js`.

### ④ « Les uniformes vont dans le module de GLSL » — **une garde existante a dit non**

`②d ter` de `test/crop-rampe.test.js` a rougi : *« uniformes lus mais jamais
déclarés : uMatOn, uMatMap, … »*. Elle lit le **texte brut** du fragment, où
`${GLSL_MATIERE}` n'est pas substitué. Vérification faite : **aucun des sept autres
modules de GLSL injectés ne déclare d'uniforme**. La convention du dépôt est donc
« un module porte des FONCTIONS, `globe.js` porte les déclarations ». ⛔ **Il aurait
été facile d'élargir la garde pour y faire entrer mon écriture** — c'était le
contraire du travail. Les douze ont déménagé.

### ⑤ « La garde des tables factices est en place » — **elle couvrait un fichier sur trois**

Le plan de fusion raconte la garde ⑨, écrite après **deux** chutes en masse, et
insiste : *« ajouter l'uniforme manquant ne suffit pas »*. Elle n'avait été posée
que sur `grille-crop.test.js`. R25 a fait tomber **onze** tests dans
`crop-habillage.test.js` puis **trois** dans `crop-naturel.test.js`, sur le même
`Cannot set properties of undefined` muet. ⚡ **Trois fichiers portent une table
factice, la garde n'en gardait qu'un.** Elle est maintenant sur les trois — et
c'est elle qui, dans `grille-crop`, m'a nommé les uniformes manquants **avant**
qu'un seul test ne tombe.

### ⑥ « Baisser la résolution de la passe de transmission la rendrait acceptable » — **non**

C'était l'échappatoire que je préparais. Mesurée : au **quart** des fragments le
surcoût vaut **1,303 ms** contre **1,181 ms** en pleine résolution. La passe est
limitée par la **re-soumission de la scène**, pas par les fragments. La cible
demi-résolution de `three` n'aurait rien changé. **C'est ce qui ferme la porte,
pas le facteur ×4.**

### ⑦ « Le curseur Relief de la matière agit : 0,3535 » — **retiré, puis remesuré**

Le premier relevé bougeait `uMatBump` de **2,08** (sa valeur de départ, 1,3 × le
`normalScale` du préréglage) à 3 : **1,5 fois le plancher de bruit**. Sous la règle
du dossier, ça ne décide de rien. **Les deux bouts du curseur (0 → 3) rendent
1,3306.** Le premier chiffre est retiré.

### ⑧ « Le verre est caché, la sonde le dit » — **la sonde ne disait rien du tout**

Elle jugeait la visibilité sur `offsetParent`. La section « Matière du relief » est
**repliée par défaut** : *tout* était donc « invisible », y compris les quatre
curseurs qui agissent. **Un relevé où le témoin et le sujet sont tous deux
négatifs ne prouve rien.** Refait sur le style en ligne qu'écrit `visibleWhen` —
16 vignettes sur 17 visibles, « Verre » et « Rugosité » cachés.

### ⑨ « La bascule Au-dessus du niveau zéro est introuvable » — **l'instrument, pas le réglage**

La sonde cherchait un `input[type=checkbox]`. `toggle()` (`kit.js`) rend un
`<button class="ce-toggle">` dont l'état vit dans une classe. Corrigé : la bascule
rend **4,5035**.

### ⑩ ⚠️ **ET TROIS FOIS CE SOIR UN SCRIPT D'ÉDITION A MANGÉ UNE CONTRE-OBLIQUE**

Le plan de fusion consigne l'incident du `\b` devenu **retour arrière (0x08)**,
avec un test qui trouvait 0 sur 68 en restant vert. Il m'est arrivé **trois fois**,
sur la même cause — un heredoc qui retire un niveau d'échappement avant que
l'interpréteur ne le lise :

| ce que j'ai écrit | ce qui est arrivé dans le fichier | conséquence |
|---|---|---|
| `'\n'` dans un journal de sonde | **un retour à la ligne véritable** | chaîne non terminée → **script mort** |
| `/\/\/[^\n]*/` dans un test | idem, à l'intérieur d'une expression régulière | **erreur de syntaxe : 29 assertions perdues d'un coup** |
| `\b` (deux fois) dans une garde | **0x08**, invisible à la lecture | la garde ne trouvait plus rien — **rattrapée par son propre témoin** |

➡️ **Ce qui a marché** : relire l'octet écrit (`grep | cat -A`) après **chaque**
expression régulière posée ; et, pour tout ce qui porte une contre-oblique, ne pas
passer par un script du tout. **Un balayage final des dix-sept fichiers touchés ne
rend plus aucun octet de contrôle.**

⚡ **Et le témoin `ecrits.size > 20` est ce qui a sauvé les deux gardes** : sans
lui, elles auraient été vertes et vides — exactement le défaut que le plan de
fusion décrit. **Une garde sans témoin de sa propre sensibilité n'est pas une
garde.**

---

## ⑦ CE QUI RESTE OUVERT, ET CE QUE JE N'AI PAS FAIT

- **La diffusion `sss` de l'albâtre** — pas portée, faute de vecteur de vue dans le
  nuanceur des tuiles (§④). C'est ce qui laisse Onyx et Albâtre à 0,322 l'un de
  l'autre. Le porter demande un varying de position monde, et les sommets sont en
  RTC exprès : **c'est une tâche à part, avec sa mesure de précision.**
- **La rugosité et le métal** — sans receveur tant que le crop est Lambert pur. Les
  rendre vivants demande d'écrire un terme spéculaire dans `globe.js`, c'est-à-dire
  **une seconde loi d'éclairage**. À arbitrer, pas à faire en passant.
- ⚠️ **`material-catalog.js` étiquette « Marbre blanc » une carte dont la luminance
  moyenne est 25 sur 255** — le catalogue le signale lui-même (« c'est un marbre
  NOIR, défaut préexistant, signalé à Adrien »). Ma mesure le confirme par un autre
  chemin : c'est la vignette qui s'écarte le plus de « Aucune » (**23,61**), parce
  qu'elle est la plus **sombre**, pas la plus blanche. **Non corrigé** : c'est un
  choix d'image, pas de code.
- **`sand` (Sable moucheté)** a été retiré du catalogue par Adrien ; `_matFlow` et
  `tickSurfaceMaterial` (le sable qui dérive) n'ont donc **plus aucun porteur** —
  aucune matière du catalogue ne déclare `flow`. Du code vivant sans appelant.
- Le mode d'emploi du banc : **les mesures d'orbite de cette nuit dérivent**
  (0,052 ms entre deux lignes de base). Toute tranche future qui mesure en orbite
  doit **entrelacer davantage**, ou prouver par construction.
