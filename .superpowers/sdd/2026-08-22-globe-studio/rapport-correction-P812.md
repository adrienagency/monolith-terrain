# Tour de correction P8 → P12 — `6063c5e..ee4e479`

**Statut : LES SIX POINTS SONT TRAITÉS. Un seul commit, `ee4e479`, purement de
TEST et de SANTÉ DU DÉPÔT — aucune ligne du code livré des cinq tâches n'est
touchée.** Les corrections de rapports sont sur le disque (`.superpowers/sdd/`
est couvert par son propre `.gitignore`, elles ne peuvent pas être commitées).

`npm test` — **4 087 / 4 087** (4 082 au départ, **+5**) · `npm run audit:tests`
— **211 / 211** · `node --check` sur les deux fichiers de test modifiés et les
trois modules de `src/` que j'ai mutés · **arbre propre** (`git status
--porcelain` vide) · **page chargée drapeau levé ET baissé**, zéro `pageerror`
des deux côtés · `git ls-files --eol` : **`i/lf w/lf`** sur les deux fichiers
commités.

> ⚡ **UN DES SIX CONSTATS EST FAUX DANS SA PREUVE, ET JE LE MONTRE — mais la
> version exacte est PLUS LOURDE, pas plus légère.** Voir le point ⑥.

---

## 0. Ce que j'ai exécuté, et dans quel ordre

| commande | résultat |
|---|---|
| `npm test` au départ (`6063c5e`) | **4 082 / 4 082** — le total annoncé, retrouvé |
| `npm test` à l'arrivée (`ee4e479`) | ⚡ **4 087 / 4 087** |
| `npm test`, **donnée gitignorée retirée du disque** | ⚡ **4 087 tests, 0 échec, 2 sautés** |
| `npm run audit:tests` | **211 listés · 211 sur disque · aucun écart** |
| `node --test test/atlas-normales.test.js` | **27 / 27** (22 au départ, **+5**) |
| pilote + `c1-cloture.js`, **drapeau levé** | page posée, `refus: []`, 256 tuiles, **0 `pageerror`** |
| pilote + `c1-cloture.js`, **drapeau baissé** | socle vivant, `uCropOn: 0`, **0 `pageerror`** |
| `git status --porcelain` (début, après chaque mutation, fin) | **vide** |

**Mutations : posées EN PLACE dans l'arbre, test rejoué, `git checkout --`,
`git diff --stat` vérifié vide avant de passer à la suivante.** Aucun worktree
n'a été créé — donc aucune exposition au piège CRLF du `worktree add`, celui qui
a fait tomber quatre agents ; **le contrôle CRLF a quand même été fait** et il a
trouvé autre chose (§7).
**Le banc de clôture vit dans `.banc/P812/`** (gitignoré) : `serveur.log`,
`cloture-leve.log`, `cloture-baisse.log` et leurs deux journaux d'erreurs.
**Aucun script du dépôt n'a été modifié** : la clôture rejoue `.banc/P9/pilote-P9.mjs`
et `.banc/P12/c1-cloture.js` tels quels.

---

## 1. ⛔ POINT ① — le témoin annoncé à zéro que son propre JSON dément — **TRAITÉ**

**CONSTAT CONFIRMÉ, AU CHIFFRE PRÈS.**

```
$ node -e "const j=require('./.banc/P12/D3-hemisphere-P12.json');
           console.log(j.retour, j.temoinNul)"
933 0
```

Le `temoinNul` vaut bien **0** ; le `retour` vaut **933**, là où
`rapport-P12.md` §1.2 écrivait *« aller-retour à 0 canal, témoin nul à 0 »*.
**Les deux champs sont produits par la MÊME expression** — `ecart(Iref,
imgCrop())`, `d3-hemisphere.js:37/40/180` — donc directement comparables, et
`0` ne pouvait pas être publié pour l'un en lisant `933` dans l'autre.
**D'où venait le `0` recopié** : `D1-irradiance-P12.json` porte, lui,
`retour: { canaux: 0 }`.

**➡️ CE QUE J'AI REPUBLIÉ, ET À QUOI ÇA SE COMPARE** (`rapport-P12.md` §1.2, plus
un bandeau en tête de rapport) :

- **933 canaux sur 4 096 000** — `L × H × 4` avec `L = 1280`, `H = 800`
  (`harnais-N03.mjs:36-37`) — soit **0,023 % du cadre**.
- **C'est le BAS de la bande que la réserve n° 9 du même rapport déclare** :
  *« 862 à 9 503 canaux »* pour les aller-retours qui contiennent un `await`.
  ⚡ **Et `d3-hemisphere.js` en contient un**, ligne 42 :
  `const S = await import('/src/sonde-ambiante.js')`. La réserve n'est donc pas
  invoquée après coup : elle décrit exactement ce fichier.
- **Sans commune mesure avec ce que le fichier porte** : 146,1 % d'amplitude
  d'azimut à `ndu = 0,3`, et **×2,18** entre les deux moitiés de sphère.

⚠️ **LA CONCLUSION N'EST PAS TOUCHÉE, ET JE NE FAIS PAS SEMBLANT DE LA
SAUVER** : je n'ai pas refait la mesure, j'ai corrigé la phrase qui la
présentait. C'est le témoin de propreté de l'affirmation la plus lourde des cinq
tâches, et il dit désormais vrai.

---

## 2. ⛔⛔ POINT ② — la mutation du relecteur qui SURVIT — **TRAITÉ, ET VÉRIFIÉ TROIS FOIS**

**CONSTAT CONFIRMÉ.** Le seul garde de « quelle bande est le ciel, laquelle est
le sol » était `test/atlas-normales.test.js` ④b : **deux `assert.match` sur le
texte source de `src/sonde-ambiante.js`**. Un échange dans l'objet gelé que
`coefAmbiante` RETOURNE laisse ces deux lignes intactes.

### 2.1 Le remède : cinq tests qui EXÉCUTENT la sonde

`test/atlas-normales.test.js` gagne une section **⑤** (**+210 lignes, +5 tests**)
qui appelle `coefAmbiante` contre un **renderer de paille** :

- il peint la **moitié basse** du tampon à `0,25` et la **moitié haute** à `1`
  (albédo blanc), et **tout** à `0,0625` (albédo noir) ;
- les trois valeurs sont des **puissances de deux** : l'aller-retour
  demi-flottant est **exact**, aucune assertion ne repose sur un arrondi ;
- ⚠️ **la coupure est à `COTE / 2`, PAS aux bornes des bandes** (0–28 et 35–63) :
  un banc qui peindrait exactement les plages rendrait la bonne réponse quelle
  que soit la marge, donc ne prouverait rien sur elle.

| test | ce qu'il exige |
|---|---|
| **⑤a** | `ciel > sol` sur les trois canaux, **et** les deux irradiances à `1e-6` de l'oracle écrit à la main (`E = π · (blanc − noir)` → `2,9452` / `0,5890`, rapport **exactement 5**) ; plus la preuve que le rendu noir est bien SOUSTRAIT |
| **⑤b** | `dispersion === 0`, `pixels` = le compte des deux plages (**3 712**), et les deux plages tombent chacune dans une moitié |
| **⑤c** | cible de rendu, `autoClear`, couleur et alpha d'effacement, `shadowMap.needsUpdate` **reposés** ; et PENDANT la mesure : deux rendus **blanc puis noir**, `autoClear = true`, `environmentIntensity = 1` |
| **⑤d** | le cache rend le **MÊME objet** (`Object.is`) et **ne re-rend pas** ; une autre texture, si |
| **⑤e** | sans renderer ou sans environnement : `AMBIANTE_NULLE`, **et zéro rendu** |

⚡ **ET LA PAGE VIVANTE CONFIRME LE MONTAGE** : la clôture drapeau levé rend
`sonde.ciel = 5,0119`, `sonde.sol = 2,1499`, `dispersion = 0`, `pixels = 3712`,
`bandes = [{0,28},{35,63}]` — **exactement l'ordre et le compte que ⑤a et ⑤b
exigent.** Le renderer de paille n'invente pas la géométrie qu'il teste.

### 2.2 ⚡ Vérifié EXPÉRIMENTALEMENT — trois mutations, chacune remise à zéro

| mutation | ce que je débranche | ④ (chaîne) | ⑤ (comportement) |
|---|---|---|---|
| **R7** *(celle du relecteur)* | `ciel`/`sol` échangés dans l'objet RETOURNÉ, les deux lignes assertées laissées intactes | ✅ **vert** | ⛔ **⑤a ROUGE** |
| **R8** *(de mon cru)* | `renderer.autoClear = true` → `= autoAvant` : plus forcé PENDANT la mesure, la ligne de restitution intacte | ✅ **vert** | ⛔ **⑤c ROUGE** |
| **R9** *(de mon cru)* | `const cibleAvant = renderer.getRenderTarget()` → `= null` : la cible de la page n'est plus sauvée, `setRenderTarget(cibleAvant)` intact | ✅ **vert** | ⛔ **⑤c ROUGE** |

**Les diagnostics rendus, mot pour mot :**

```
R7 ✖ ⑤a — canal 0 : le ciel (0.5890486225480608) doit depasser
          le sol (2.945243112740432) — le bloc s eclairerait par en dessous
R8 ✖ ⑤c — autoClear doit valoir true PENDANT la mesure
R9 ✖ ⑤c — la cible de rendu de la page n est pas reposee
```

⚡ **R8 ET R9 SONT LA PREUVE QUE ④d ÉTAIT UN TÉMOIN CREUX, PAS SEULEMENT ④b** :
les deux laissent les cinq `assert.match` de ④d intacts et **④d reste VERT**
pendant que ⑤c rougit. Le §0 du plan liste `autoClear === false` comme la
**première** façon dont un banc a menti ici, et `PasseFond` a déjà avalé
`shadowMap.needsUpdate` une fois : ces deux gardes-là n'étaient gardées par
rien d'exécutable.

**Après chaque mutation** : `git checkout -- <fichier>` puis `git diff --stat`
vérifié **vide sur `src/`**.

### 2.3 ⚠️ « Cherche s'il y en a d'autres du même genre » — SONDÉ, PAS SUPPOSÉ

Le dépôt porte des centaines d'`assert.match` sur du texte source. **La plupart
sont structurellement forcées** : elles lisent du **GLSL**, ou `globe.js` /
`main.js` / `terrain.js` / `ocean.js`, qui ne s'importent pas sous node. Le
genre qui m'intéresse est l'autre : **une assertion de texte sur un module PUR
de `src/monde/`, qu'on aurait pu exécuter.**

**J'ai posé deux mutations du MÊME genre dans le voisin le plus exposé,
`src/monde/eclairage-crop.js` :**

| mutation | verdict |
|---|---|
| **M-A** — `irradianceCrop` mélange à l'envers (`lerp(ciel, sol, w)`) | ⚡ **TUÉE — 3 échecs sur 4 087** |
| **M-B** — `irradianceAmbiante` échange `ciel` et `sol` dans son retour | ⚡ **TUÉE — 4 échecs**, dont ④i, ⑦b, ⑦c de `crop-eclairage.test.js` |

➡️ ⚡ **LE TROU N'EST PAS ENDÉMIQUE, ET SA LOCALISATION S'EXPLIQUE.**
`eclairage-crop.js` est pur : tout le monde l'a exécuté. `sonde-ambiante.js`
**exige un renderer** — c'est très exactement pourquoi personne ne l'avait
exécuté, et pourquoi la seule chose qui restait était de lire son texte.
**Écrire le renderer de paille était le geste manquant.**

⚠️ **CE QUE JE N'AI PAS FAIT** : je n'ai pas audité les 111 assertions de texte
de `crop-eclairage.test.js` ni les 71 d'`ecume-mer.test.js` une par une. **Deux
mutations ne sont pas une campagne** ; elles bornent mon affirmation à ce
qu'elles couvrent.

---

## 3. ⚠️ POINT ③ — le chiffre contredit par le relevé de sa propre exécution — **TRAITÉ**

**CONSTAT CONFIRMÉ, DANS SES TROIS PARTIES.**

```
S5-relief-P9.json → crop.sommets = 29 978 · tuilesTouchees = 66
                    quadsParTuile = 64 · sommetsTotal = 170 304
                    socle.sommets = 594 434
s5-relief.js:78   → « le compte de sommets retenus doit tomber sur les 9 tuiles
                     du bloc, soit 9 x 25 x 25 = 5 625 au plus »
```

**La garde était écrite dans la sonde, elle a sonné (facteur 5,3), et ni le
relevé ni le démenti n'étaient dans le rapport.**

⚡ **LA CAUSE EST VÉRIFIÉE, PAS DÉDUITE.** `.banc/P7/harnais-P7.mjs:96` :

```js
export const tuilesCrop = () => [...x.globe.tiles.values()].map((t) => t.mesh).filter(Boolean)
```

**Tout le cache du quadtree, tous niveaux confondus.** Le filtre Mercator de la
sonde admet donc la pyramide EMPILÉE — 66 tuiles pour un bloc qui en a 9. **Et
le fichier porte son propre témoin** : `quadsParTuile = 64` est
`segmentsTuile(z ≤ 2)` (`src/monde/maillage-tuile.js:82-87`), pas les 24 de z12
— la première tuile de la liste est une tuile continentale.

**➡️ CORRIGÉ DANS LES DEUX ENDROITS OÙ LE CHIFFRE VIVAIT :**

- **`rapport-P9.md` §1.3** — le tableau publie désormais **29 978 (relevé)** à
  côté du 5 625 marqué **calcul de géométrie**, avec une colonne **segments par
  côté de bloc** (768 contre 72) ; le bandeau de tête l'annonce.
- **`notation-04.md` poste 3️⃣** — le noteur avait recopié le 5 625 ; l'encadré
  le retire et rebâtit le poste sur ce qu'il a mesuré lui-même.

**Ce que je retire** : **« cent cinq fois moins »**. Il comparait **une mesure**
(594 434) à **un calcul** (5 625) — le défaut endémique des dénominateurs que le
§0 du plan nomme — et `9 × 25²` compte deux fois les sommets des arêtes
partagées, ce que `768²` ne fait pas.
**Ce que je garde** : **×10,7 par axe**, rapport de deux comptes de SEGMENTS
(768 contre 3 × 24), indépendant de tout compte de sommets. C'est la lecture que
`rapport-P11.md` réserve n° 2 fait indépendamment.
**Ce que je borne** : **`nduEcartType = 0,1994` n'est pas la dispersion du
bloc** — il est calculé sur la population empilée. Il n'est plus défendu comme
tel.
⚡ **Ce qui survit, et du bon côté** : `nduMin` est un **minimum**, et la
population mesurée **contient** les sommets du bloc — donc le minimum du bloc
est **nécessairement ≥ 0,2126**. « Aucune face raide » tient de façon
**conservatrice**. Le gain final (97,9 %) est mesuré sur des **pixels**
(`S7-livre-int-P9.json`) : il ne bouge pas.

---

## 4. ⚠️ POINT ④ — la capture qui contredit sa propre légende — **TRAITÉ**

**CONSTAT CONFIRMÉ PAR LES DEUX PIÈCES.**

```
E2-pas-mer-pavage-P12.json → socle.pavage = { suites: 268, pixels: 64367,
                                              pic: 19, picNormalise: 0.0339 }
```

**Et j'ai regardé la capture moi-même** : sur
`.banc/P12/F2-SOCLE-cote-apparie-N03.png`, la mer du socle porte des **bandes
franchement visibles** sur toute la nappe, à gauche du trait de côte. **La
capture était plus honnête que la légende.**

**➡️ CORRIGÉ dans `rapport-P12.md` §2.3** — la cellule « aucun » devient
**19 px (0,0339)**, et un encadré explique l'écart plutôt que de l'effacer :

- **L'ABSOLU TOMBE.** Le socle en porte 0,0339 ; je ne peux pas écrire qu'il
  n'en a aucun.
- **LE DOUBLEMENT TIENT, et il est rechiffré contre un socle non nul** :
  0,1565 livré contre **0,0828** (noteur) = ×1,9, contre **0,0685** (mon propre
  relevé du même état) = ×2,3 — c'est ce ×2,3 que la réserve n° 4 oppose aux
  17 % de bruit inter-chargement — et contre **0,0339** (socle) = ×4,6.
- ⚠️ **JE NE RÉCONCILIE PAS 0 ET 19.** `periodeSocle` de `n5` et `pavage` de
  `e2` sont deux instruments sur deux cadrages ; je n'ai pas refait
  l'appariement. **Je publie les deux et je dis lequel contredit ma phrase.**
- ⚡ **Une chose que P12 avait sous les yeux sans la voir** : sa réserve n° 4
  écrivait déjà que ce pic *« saute de 11 à 19 px selon les exécutions »* —
  **19 px est très exactement le pic que `e2` relève sur le SOCLE.**

**Et j'ai porté la même précision dans `notation-04.md` §4️⃣**, où le même
« aucun » vivait : sinon la correction aurait laissé le chiffre se propager, ce
qui est le défaut du point ③.

---

## 5. ⛔ POINT ⑤ — la dette de santé du dépôt — **TRAITÉ**

**CONSTAT REPRODUIT AVANT D'ÊTRE RÉPARÉ.** Donnée retirée du disque :

```
✖ le manifeste RÉEL du sol porte un zmin, et il vaut 8   (occupation-sol.test.js:473)
  Error: ENOENT: no such file or directory,
         open 'C:\Dev\wt-merge\public\data\sol\index.json'
  → 37 pass, 1 fail
```

`git check-ignore -v` : **`.gitignore:24 : data/`**. Le fichier n'est **pas**
suivi par git. **Le vert du chantier n'était donc pas reproductible depuis git
seul.**

### ➡️ J'AI CHOISI LE SAUT DÉCLARÉ, PAS LA RECONSTRUCTION — et voici pourquoi

**La donnée n'est pas reconstructible par une commande de dépôt.**
`scripts/build-occupation-sol.mjs` (son propre en-tête le documente) télécharge
les **COG d'ESA WorldCover v200** depuis `s3://esa-worldcover` et cuit la grille
XYZ ; `npm run build:solmonde` est une cuisson **mondiale z8–z9 en heures**, avec
un drapeau `--reprendre` prévu pour les coupures. ⛔ **Une suite de tests ne peut
pas dépendre de ça** — ni en durée, ni en réseau, ni en licence de données.

**Le saut se DÉCLARE, il ne se tait pas.** J'ai utilisé `t.skip()` du
`node:test`, pas un `return` muet :

```
donnée absente → ﹣ le manifeste RÉEL du sol porte un zmin, et il vaut 8
                   # public/data/sol/index.json absent (ignore par git)
                   - cuire avec npm run build:solmonde
                 ℹ tests 4087 · pass 4085 · fail 0 · skipped 2
donnée présente → ℹ tests 4087 · pass 4087 · fail 0 · skipped 0
```

⚠️ **ET J'AI CORRIGÉ LE TEST VOISIN AU PASSAGE, PARCE QU'IL PORTAIT LE MÊME
DÉFAUT DANS L'AUTRE SENS.** `occupation-sol.test.js:434` avait déjà la garde,
mais sous la forme d'un **`return` muet** : sur un checkout propre il rendait
**VERT**, c'est-à-dire **indistinguable d'un test qui a vraiment lu le
manifeste**. Il déclare désormais son saut lui aussi. **Un test qui se tait est
un test qui ment sur ce qu'il a vérifié** — c'est la même famille que les treize
façons dont un banc a menti ici, dans l'autre sens.

---

## 6. ⚠️ POINT ⑥ — la dette de P10 — **TRAITÉ, ET LE CONSTAT EST RÉFUTÉ DANS SA PREUVE**

### 6.1 ⚡ Le fond du grief est EXACT, et je l'ai mesuré moi-même

| état | fichier | grain du fond marin |
|---|---|---|
| avant le pas de P10 (état P9) | `.banc/vues-notation-03/N4-mer-N03.json` | **100,08 %** (4,858 / 4,854) |
| **après le pas de P10** | `.banc/N04/N4-mer-N03.json` | ⛔ **75,41 %** (3,668 / 4,864) |
| après P12 | `.banc/P12/N4-mer-N03.json` | **84,91 %** (4,123 / 4,856) |

**−24,67 points**, contre les **+5,9 %** que P10 déclarait sur la frange. Et son
§2.4 arbitre explicitement le pas **en ne regardant que le relief**.

### 6.2 ⛔ MAIS LA PREUVE QUI L'ACCOMPAGNE EST FAUSSE, DEUX FOIS

Le constat I-2 écrit : *« `n4-mer.js`, le script du noteur, rend déjà les deux
colonnes, et P10 rejouait ce banc-là. »* **Les deux moitiés tombent.**

**① Aucun script ne rend les deux colonnes.**

```
n4-mer.js:87                    out.fondSeul = { crop: …, socle: … }   ← le fond marin
n5-trait-proprete-mouvement.js  grainDeLaMer.plateauxCrop{…}           ← la frange
```

`n4-mer.js` **ne produit pas** la frange. Et les chiffres de P10
(`longueurMoyenne 2,058` · `part4plus 13,57` · socle `1,669` / `6,65`) se lisent
**au chiffre près** dans `.banc/P10/N5-trait-proprete-mouvement-P10.json`,
`grainDeLaMer` — **donc dans `n5`, pas dans `n4`.**

**② P10 n'a jamais rejoué `n4-mer.js`.** Son §0 liste ses scripts : *« `n1-etat-relief-palette.js`,
`n3-mouvement.js` et `n5-trait-proprete-mouvement.js` »* — trois, pas quatre. Et
sur le disque :

```
$ ls .banc/*/N4*
.banc/N04/N4-mer-N03.json
.banc/P12/N4-mer-N03.json
.banc/vues-notation-03/N4-mer-N03.json
```

**Il n'y a aucun `N4-*.json` dans `.banc/P10/`.** Les seuls sont ceux du noteur
et celui de P12.

### 6.3 ➡️ La version exacte, et elle est PLUS LOURDE

Ce n'est pas *« le banc qu'il rejouait rendait déjà la colonne »*. C'est :
**le quatrième script de la suite du noteur était sur le disque, il portait
l'axe que le pas de P10 touchait le plus, et P10 ne l'a NI rejoué NI déclaré
comme laissé de côté.** Il a déclaré le prix sur l'axe que son banc mesurait —
**sans dire qu'il avait restreint son banc.**

**➡️ NOTÉ DANS `rapport-P10.md`** : un encadré au §4 avec le tableau des trois
états, la réserve n° 2 mise à jour, et un bandeau en tête. **La réfutation y est
écrite aussi** — un rapport qui reprend une dette doit dire ce qu'il accepte et
ce qu'il refuse.

⚠️ **ET J'AI CORRIGÉ UN TROISIÈME CHIFFRE AU PASSAGE.** Le constat I-2 écrit que
P12 *« a payé les deux tiers de l'addition (75,41 % → 84,91 %) »*. **Non :
9,50 des 24,67 points, soit 38,5 %.** Les « deux tiers » viennent de la
**frange** — excès sur le socle de 7,03 à 2,82 points, soit **60 %**, ce que P12
appelle lui-même « divisé par 2,5 ». **Les deux axes ont été confondus.**

---

## 7. ⚠️ Ce que le contrôle CRLF a trouvé, et qui n'était dans aucun constat

`git ls-files --eol` sur les fichiers que je m'apprêtais à toucher :

```
i/lf  w/crlf   test/occupation-sol.test.js
```

⛔ **LE FICHIER ÉTAIT EN CRLF SUR LE DISQUE ALORS QUE SON BLOB EST EN LF, avec
`core.autocrlf = false` et aucun `.gitattributes`.** `git status` ne le voyait
pas — le cache de `stat` le donnait propre tant que personne n'y touchait. **Ma
première écriture a fait apparaître un diff de 508 / 479 lignes** pour une
modification de 33 lignes. J'ai réécrit le fichier en **LF** ; le diff est
retombé à **33 / 4**, et `git diff --stat` est désormais **identique** à
`git diff --ignore-cr-at-eol --stat`.

⚠️ **ET CE N'EST PAS UN CAS ISOLÉ : `git ls-files --eol` compte 421 fichiers
`i/lf w/crlf` dans l'arbre.** README, LICENSE, `.github/workflows/deploy.yml`,
les plans de `docs/superpowers/plans/`, `.superpowers/sdd/progress.md`… **Chacun
fabriquera un diff de fichier entier au premier agent qui l'éditera.**
**Je ne l'ai PAS réparé** — 421 fichiers réécrits en un commit noieraient
n'importe quelle relecture, et ce n'est pas ma tâche. **Je le signale : c'est la
même famille que le point ⑤, une dette de santé du dépôt qui ne se voit pas tant
que personne ne marche dessus.**

---

## 8. Verdict par point

| | point | verdict |
|---|---|---|
| ① | témoin annoncé à 0, fichier à 933 | ⚡ **TRAITÉ** — chiffre republié depuis la source, comparé à la réserve n° 9 et au dénominateur 4 096 000 |
| ② | mutation R7 survivante, garde de CHAÎNE | ⚡ **TRAITÉ** — 5 tests de comportement, R7/R8/R9 vérifiées expérimentalement, 2 sondages du même genre ailleurs (tués) |
| ③ | 5 625 contre 29 978, garde non rapportée | ⚡ **TRAITÉ** — corrigé dans `rapport-P9.md` ET `notation-04.md`, garde citée, `nduEcartType` borné |
| ④ | capture contre légende (pavage) | ⚡ **TRAITÉ** — absolu retiré, écart expliqué, corrigé dans les deux documents |
| ⑤ | vert non reproductible depuis git | ⚡ **TRAITÉ** — saut DÉCLARÉ (`t.skip`), motif chiffré, test voisin corrigé aussi |
| ⑥ | dette de P10 sur un seul axe | ⚡ **TRAITÉ**, ⛔ **et le constat RÉFUTÉ dans sa preuve** — `n4` ne rend pas les deux colonnes, P10 ne l'a jamais rejoué ; la version exacte est plus lourde |

---

## 9. Ce que je n'ai PAS fait — bornez mes conclusions là-dessus

1. ⛔ **Je n'ai touché AUCUNE ligne du code livré des cinq tâches.** Le commit ne
   contient que deux fichiers de `test/`.
2. ⛔ **Je n'ai rien mesuré à l'écran de neuf.** Tous les chiffres que je valide
   viennent des **JSON déjà sur le disque**, recalculés ou relus ; la seule chose
   que j'ai rendue est la **clôture** (page chargée, deux drapeaux), et elle ne
   porte aucun verdict.
3. **Je n'ai pas rejoué les cinq campagnes de mutation.** La relecture groupée
   les a rejouées au chiffre près ; je n'avais pas de raison de les refaire, et
   je ne m'en réclame pas.
4. **Mes cinq mutations ne visent que le branchement de l'ÉCLAIRAGE** — R7, R8,
   R9 dans `sonde-ambiante.js`, M-A et M-B dans `eclairage-crop.js`. **Je n'ai
   visé ni la chaîne de la mer, ni celle de la rampe, ni le maillage.**
5. **Je n'ai pas tranché lequel de 5 625 ou 29 978 décrit « le bloc ».** Je
   publie **ce que la sonde a mesuré**, **ce que la sonde attendait**, et **ce
   que chacun compte** ; le seul rapport que je défends est celui des segments
   par axe.
6. **Je n'ai pas réconcilié les deux instruments du pavage** (`n5` à 0, `e2` à
   19 px) : cadrages différents, appariement non refait.
7. ⛔ **Je n'ai pas pris le pavage rectangulaire (`CHAMP_FOND`, chiffré à neuf
   fois `remplirHauteurs`), ni la silhouette, ni le chanfrein** : ce sont des
   tâches, pas des corrections.
8. **Je n'ai pas réparé les 421 fichiers `i/lf w/crlf`** du §7 — signalé, non
   traité.

---

## 10. Isolement — état rendu

- **Aucun worktree créé**, donc aucune exposition au piège CRLF du
  `worktree add` ; les mutations ont été posées en place et **rendues
  immédiatement**, `git diff --stat` vérifié vide entre chacune.
- **`git status --porcelain` vide** au début, entre chaque mutation, et à la fin.
- **Le banc est dans `.banc/P812/`** (`.gitignore:44`) : rien n'en sort.
- **Le serveur de développement lancé pour la clôture a été arrêté**
  (`taskkill` sur le PID qui écoutait 5503 ; `netstat` vérifié ensuite).
- **Un seul commit : `ee4e479`**, deux fichiers de test, `i/lf w/lf` tous les
  deux.
