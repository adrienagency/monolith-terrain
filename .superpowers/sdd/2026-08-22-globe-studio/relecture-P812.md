# Relecture des tâches P8 → P12 — `6373339..6063c5e`

> **Verdict d'ensemble : 1 CRITIQUE · 6 IMPORTANTS · 11 MINEURS.**
> **Quatre tâches CONFORMES, une NON CONFORME (P12).**
> ⚡ **Les cinq campagnes se rejouent au chiffre près, les cinq totaux de tests
> aussi, et les quatre affirmations extraordinaires du brief TIENNENT — dont la
> plus lourde (P12) que j'ai vérifiée dans le code ET dans les données brutes.**
> ⛔ **Ce qui tombe, ce sont des TÉMOINS : deux phrases de P12 disent le
> contraire de leurs propres fichiers, et une survivante de mon cru montre que
> le cœur du correctif de P12 n'est gardé que par une assertion de CHAÎNE — la
> faute exacte qu'une survivante de P11 avait démasquée UNE TÂCHE PLUS TÔT.**

---

## 0. Protocole — et la preuve que mon banc n'est pas creux

**Isolement.** `git -C C:/Dev/wt-merge worktree add C:/Dev/wt-relecP812 6063c5e`.
**Un seul fichier écrit hors de mon worktree : ce rapport.** Le worktree a été
**retiré en partant** (`git worktree remove --force C:/Dev/wt-relecP812`) — voir §8.

⛔ **LE PIÈGE ANNONCÉ, DÉSAMORCÉ ET VÉRIFIÉ.** Un worktree neuf n'a pas de
`node_modules` : **tout y passe au vert parce que tout y échoue déjà.** J'ai posé
une **jonction** vers l'arbre principal, puis j'ai exigé une preuve que les tests
S'EXÉCUTENT vraiment, pas qu'ils se taisent :

- `node --test test/crop-eclairage.test.js` → **47/47**, dont **⑧c « l'oracle de
  ⑧b EST la formule de three, LUE DANS `node_modules` »** — un test qui ne peut
  pas passer sans `three` sur le disque.
- `npm test` complet aux **cinq** commits (§1), avec des totaux qui **changent**
  d'un commit à l'autre : 4 021 → 4 027 → 4 029 → 4 055 → 4 082. Un banc creux
  rend le même chiffre partout.
- `git ls-files --eol` sur les sept fichiers en jeu : **`i/lf w/lf` partout** —
  pas de faux survivants par CRLF.

⚠️ **UNE DÉCOUVERTE DE CE MONTAGE, ET ELLE VAUT POUR LA CI** : sur un checkout
propre, `test/occupation-sol.test.js:473` échoue seul (**1 / 4 082**) parce qu'il
lit `public/data/sol/index.json`, **qui est dans `.gitignore`**. Le « npm test
vert » du chantier n'est donc pas reproductible depuis git seul. J'ai jonctionné
le dossier généré ; **ce n'est pas un défaut de P8–P12**, mais c'est une
treizième-plus-une façon dont un banc peut mentir, dans l'autre sens.

**Courbe de tonalité déclarée : OCTET LINÉAIRE**, comme les cinq rapports et les
deux notations (`lookLineaire` du harnais). **Le socle est rallumé DANS LA MÊME
PAGE** dans tous les bancs que j'ai relus — `tuilesCrop`/`montrerSocle`
(`.banc/P7/harnais-P7.mjs:96-108`) bascule des `visible`, il ne recharge rien.
✅ La consigne du §0 du plan est respectée par les cinq tâches.

### Contrôle CRLF — sur TOUTE la plage de chaque tâche

`git diff --stat` contre `git diff --ignore-cr-at-eol --stat`, plage entière :

| tâche | plage | `--stat` | `--ignore-cr-at-eol` | verdict |
|---|---|---|---|---|
| P8 | `6373339..a0a600a` | 9 fichiers, 548 +, 11 − | **identique** | ✅ |
| P9 | `a0a600a..ac58500` | 9 fichiers, 592 +, 4 − | **identique** | ✅ |
| P10 | `ac58500..d258d0b` | 4 fichiers, 771 +, 303 − | **identique** | ✅ |
| P11 | `d258d0b..bf03bfe` | 11 fichiers, 1 158 +, 46 − | **identique** | ✅ |
| P12 | `bf03bfe..6063c5e` | 7 fichiers, 960 +, 82 − | **identique** | ✅ |

**Aucun faux diff.** Et les diffstats annoncés par P8 (548/11) et P9 (592/4) sont
**exacts au chiffre près**. `terrain.js`, `plinth.js`, `ocean.js` : **absents des
cinq plages** — la dépose du mode plat n'a pas eu lieu par mégarde.

---

## 1. Ce que j'ai rejoué moi-même — les cinq campagnes et les cinq suites

**Chaque campagne rejouée AU COMMIT DE SA TÂCHE**, script du dépôt, non modifié,
sortie écrite dans MON worktree :

| tâche | commit | campagne annoncée | **rejouée par moi** | branchement | survivantes | arbre après |
|---|---|---|---|---|---|---|
| P8 | `a0a600a` | 37 / 37 | ⚡ **37 / 37** | 25 (67,6 %) | 0 | propre |
| P9 | `ac58500` | 36 / 36 | ⚡ **36 / 36** | 20 (55,6 %) | 0 | propre |
| P10 | `d258d0b` | 51 / 51 | ⚡ **51 / 51** | 42 (82,4 %) | 0 | propre |
| P11 | `bf03bfe` | 71 / 71 | ⚡ **71 / 71** | 59 (83,1 %) | 0 | propre |
| P12 | `6063c5e` | 58 / 58 | ⚡ **58 / 58** | 47 (81,0 %) | 0 | propre |

**Zéro survivante, zéro « NON APPLIQUÉE » sur les 253 mutations.** Aucune
campagne n'a été rejouée « à vide » : les mutations s'appliquent (une occurrence
exacte à chaque fois) et les tests les tuent.

**Les cinq suites, exécutées au commit de chaque tâche :**

| tâche | `npm test` annoncé | **mesuré par moi** | `audit:tests` annoncé | **mesuré** |
|---|---|---|---|---|
| P8 | 4 021 | ⚡ **4 021 / 4 021** | 209 / 209 | ⚡ **209 / 209** |
| P9 | 4 027 | ⚡ **4 027 / 4 027** | 209 / 209 | ⚡ **209 / 209** |
| P10 | 4 029 | ⚡ **4 029 / 4 029** | 209 / 209 | ⚡ **209 / 209** |
| P11 | 4 055 | ⚡ **4 055 / 4 055** | 210 / 210 | ⚡ **210 / 210** |
| P12 | 4 082 | ⚡ **4 082 / 4 082** | 211 / 211 | ⚡ **211 / 211** |

⚡ **Cinq totaux sur cinq, au test près.** Et `audit:tests` confirme qu'aucun
fichier de test n'est sur le disque sans être dans la ligne `test` de
`package.json` — le défaut historique du dépôt ne s'est pas rouvert.

---

## 2. Les quatre affirmations extraordinaires — vérifiées aux données brutes

### P9 — « le crop rendait 5 625 sommets contre 594 434 » → relief 98,02 %

- **594 434 : EXACT et MESURÉ.** `S5-relief-P9.json`, `normales.socle.sommets`.
- **Le gain est réel et il est mesuré sur des PIXELS**, pas sur des sommets :
  `S7-livre-int-P9.json` donne 10,963 → 15,721 contre un socle à 16,056, soit
  **97,9 %** (P9 publie 97,9 ; **98,02 % est le chiffre du NOTEUR**, notation-03
  l. 151-158, qui écrit lui-même « P9 publie 97,9 % » — aucun des deux ne triche).
- **La texture de hauteur fait bien 256², et le fragment la lit DÉJÀ** :
  `decodeMetersAA` était appelée pour la rampe et les courbes avant P9. ✅
- ⛔ **MAIS LE 5 625 EST UN CALCUL À LA MAIN QUE LE PROPRE RELEVÉ DE LA TÂCHE
  CONTREDIT — voir constat I-1.**

### P9 — « sur 14,51 % de l'intersection, le socle compose sa mer sur du VIDE, et 92,3 % de son bleu profond vit là »

⚡ **LES DEUX SONT EXACTS AU CHIFFRE PRÈS**, recalculés par moi depuis
`.banc/P9/S9-fondnoir-P9.json` :

| | fichier brut | rapport |
|---|---|---|
| part sur du vide | `separation.partSurDuVide = 14.51` | 14,51 % ✅ |
| bleu profond du socle sur le vide | `surDuVide.socle.bleuProfond = 10 401` | — |
| bleu profond du socle ailleurs | `avecFondMarin.socle.bleuProfond = 864` | — |
| **part qui vit sur le vide** | **10 401 / 11 265 = 92,33 %** | **92,3 % ✅** |

Et la borne que P9 pose lui-même — *« le vide est la couleur de nettoyage DU
BANC ; je n'affirme donc pas que le socle a un défaut là »* — est reprise
telle quelle par le noteur (notation-03 §7), qui **retrouve 14,48 % et 92,67 %
indépendamment**. ⚡ **L'implémenteur a corrigé le noteur, et le noteur a
corrigé sa propre note 02 en conséquence. Les deux avaient raison de mesurer.**

### P10 — « énorme aux décalages IMPAIRS, nul aux PAIRS : la parité des quads 2×2 »

⚡ **SPECTACULAIREMENT CONFIRMÉ, des deux côtés, dans les fichiers bruts :**

| état | dx = 1 | dx = 2 | dx = 3 | pixels instables (dx = 1) |
|---|---|---|---|---|
| **avant** (`vues-notation-03/N3-mouvement-N03.json`) | ⛔ **10,8724** | **0,8002** | ⛔ **10,8563** | ⛔ **52 048** (38,49 %) |
| **après** (`P10/N3-mouvement-P10.json`) | **0,8143** | 0,7865 | 0,8163 | ⚡ **6** (0,004 %) |
| socle (après) | 0,0320 | 0,0014 | 0,0322 | 66 |

La signature impair/pair est **présente avant, absente après**, et le témoin sans
normale fine (0,8625 / 0,8343 / 0,8651 avant) **ne la porte pas** — l'attribution
est propre. **52 048 → 6 : exact.** **10,872 → 0,8143 : exact.**
⚠️ **Et le crop reste ×25,4 au-dessus du socle sur ce résidu** — P10 l'écrit
(« ×360 à ×25,4 »), notation-04 aussi (×25,5). Personne ne cache le reste.

### P10 — l'invariant qui APPARIE deux conversions : `TOUR × UNITE = 2 π R_GLOBE`

**Il mord, et je l'ai fait mordre.** Mutation **R3** de mon cru
(`UNITES_PAR_METRE_SOL = R_GLOBE / EARTH_RADIUS_M` → `/ TOUR_SPHERE_M`) :

```
✖ ⑧e bis ⛔ `uUvParMonde` EST PROPRE À LA TUILE, ET IL VAUT `1 / 2^z`
  AssertionError: le tour en unites de scene vaut 100 au lieu de 628.3185307179587
```

⚡ **Diagnostic exact, chiffré, et il nomme la monnaie.** ⚠️ **Et l'appariement
seul ne suffirait pas** — le produit est symétrique, donc un ÉCHANGE pur des deux
constantes le laisserait invariant. C'est l'assertion absolue voisine
(`|tour − 2 π · EARTH_RADIUS_M| < 1`, plus le contre-exemple WGS84) qui ferme ce
trou-là. **Les deux ensemble épinglent les deux facteurs ; l'invariant seul, non.**
Le rapport de P10 ne le précise pas — c'est une nuance, pas une faute.

### P11 — « le crop n'a PAS UN SEUL PIXEL D'OLIVE : l'écart vit dans l'ALBÉDO »

⚡ **EXACT, et c'est un zéro dur** — `.banc/P11/D1-palette-P11.json`,
irradiance neutralisée à π des deux côtés, aller-retour 0 canal des deux côtés :

| secteur 60–90° (olive) | crop | socle |
|---|---|---|
| **albédo nu** | ⛔ **0** | 4 199 |
| image vivante | 2 709 | 10 017 |

⚡ **L'ombrage ATTÉNUAIT l'écart** (il fabriquait 2 709 pixels d'olive là où
l'albédo n'en a aucun) : la clé de la note 03 (« c'est la composition de
l'ombrage ») était donc bien fausse, et **le noteur l'a retirée de son propre
chef** (notation-04 §2). **2 691 → 10 938** se lit exactement dans
`P10/N1-…-P10.json` (`teintes12[2] = 2 691`) puis `P11/N1-…-N03.json`
(`= 10 938`), socle 9 999.

### P11 — « `uOceanDepth = 6 000` pour un bloc dont le point le plus bas est à 107 m »

⚡ **EXACT AU DIX-MILLIÈME**, `.banc/P11/D2-ancre-basse-P11.json` :
`echelles.crop.uOceanDepth = 6000` · `echelles.rampeMesuree.terreBas =
107.4638671875` · `rampeMesuree.profondeur = 0.017466033592535575` (le plancher
de division, « un aveu, pas une grandeur » — sa formule, et elle est juste).
Le noteur a **rejoué l'A/B dans les deux sens** et retrouve les mêmes seize
décimales (notation-04 §4).

### ⚡⚡ P12 — « l'INSTRUMENT était faux depuis onze tâches : une bille vue par UNE caméra orthographique »

**C'est l'affirmation la plus lourde des cinq. Je l'ai vérifiée dans le code ET
dans les données. Elle tient, sur les deux plans.**

**Dans le code** (`git show bf03bfe:src/sonde-ambiante.js`) : la sonde de P3 était
bien une `SphereGeometry(1, 48, 32)` regardée par une
`OrthographicCamera(-1,1,1,-1,…)` posée en `(0, 0, 4)`, et elle régressait sur
`sy`. ⛔ **Une caméra orthographique ne voit QUE le demi-espace `Nz > 0`** : pour
un `ndu` donné, elle n'échantillonne qu'une moitié des azimuts, et elle les
pondère par l'aire d'ÉCRAN. **C'est juste si et seulement si l'environnement est
invariant par rotation autour de la verticale.**

**Dans les données** (`.banc/P12/D3-hemisphere-P12.json`, atlas de 1 600 normales
RENDU dans la page, lampes éteintes, `temoinNul = 0`) :

| ce que le rapport affirme | ce que le fichier dit | ✔ |
|---|---|---|
| à `ndu = 0,3`, de **0,7225 à 2,6446** selon l'azimut, **146 %** | `table[6] = {min 0.7225, max 2.6446, amplitudeAzimutPct 146.1}` | ⚡ exact |
| **×2,18** sur le terme de ciel entre les deux moitiés | `demiAvant.ciel = 6.8273` / `demiArriere.ciel = 3.13285` → **2,1793** | ⚡ exact |
| la sonde livrée retombe à **2,2 %** de la moitié qu'elle voyait | `coefAmbiante.ciel = 6.682655…` → 6,8273/6,6827 = **1,0216** | ⚡ exact |

⚡ **Et le correctif est le bon geste, pas un pansement** : au lieu d'INFÉRER
deux pôles depuis un échantillon courbe, il RENVOIE les deux normales que le
nuanceur consomme — deux quads plats portant `(0, +1, 0)` et `(0, −1, 0)`. **Il
n'y a plus de distribution à biaiser**, et la sonde publie son propre témoin
(`dispersion` doit valoir 0, tous les pixels d'une bande portant la même normale).
La seconde faute qu'il nomme — un coefficient d'ajustement versé dans un champ
qui attend une irradiance AU PÔLE — est réelle aussi : `poserEclairage` ADDITIONNE
`ciel`/`sol` à `hemi.color`/`hemi.groundColor`, où `skyColor` est par définition
l'irradiance à `ndu = +1`.

⛔ **Ce qui NE tient pas, c'est le témoin qu'il met en aval de cette mesure —
constat C-1.**

---

## 3. Verdict PAR TÂCHE

### ⚖️ Tâche P8 — `6373339..a0a600a` — **CONFORMITÉ ✅**
**0 critique · 1 important · 2 mineurs.**

Campagne **37/37 rejouée**, `npm test` **4 021** et `audit:tests` **209/209**
reproduits exactement, diffstat annoncé exact, CRLF propre.

**Les aveux sont EXACTS, pas minimisés — et ils sont écrits DANS LA SOURCE, pas
seulement dans le rapport.** `src/monde/ecume-mer.js:120-137` cite l'avertissement
d'`ocean.js` mot pour mot, et j'ai vérifié qu'il existe bien
(`src/ocean.js:532-533` : *« profondeur reelle (bathymetrie seule - pas le proxy
distance-au-rivage, c'etait lui le halo) »*). Il dit qu'il l'étend, il dit
pourquoi (le repli sur la seule alpha ne déplace rien : 11,72 % contre 11,71 %),
et il déclare le halo comme **risque non cherché ailleurs**. Les deux postes non
fermés (azimut du studio, chanfrein) sont annoncés dès le §0 avec le reste
chiffré (×1,125 et ×1,22), et **notation-03 comme notation-04 confirment que le
chanfrein n'a été pris par aucune des onze tâches** — l'aveu n'était pas une
formule de style.

⚡ **Un aveu que je tiens pour exemplaire** : ⑥a « C'était l'assertion qui
VERROUILLAIT LE DÉFAUT — elle rendait vert exactement l'état que le noteur
mesurait à 1,68× ». Et le relevé fautif `S7-nappe-P8.json` est **laissé sur le
disque** au lieu d'être effacé.

### ⚖️ Tâche P9 — `a0a600a..ac58500` — **CONFORMITÉ ✅**
**0 critique · 1 important · 4 mineurs.**

Campagne **36/36 rejouée**, **4 027** tests, **209/209**, diffstat exact.
**Le code mort retiré est réellement mort** : j'ai refait l'algèbre du commit
`ac58500` — `(sy − n(sy·n)) × n = sy × n` parce que le terme retiré est colinéaire
à `n`, et `det = (sx − n(sx·n))·R1 = sx·R1` parce que `R1 ⟂ n`. **La projection ne
changeait NI `R1`, NI `R2`, NI `det`.** Le commentaire qui la justifiait était
bien faux, et il a été corrigé, pas contourné.

**Les deux aveux sont exacts et l'un d'eux était prophétique.** « Rien mesuré en
mouvement — c'est la réserve qui porte le plus de risque sur ce que je livre » :
⚡ **c'est très exactement ce que la notation 03 a mesuré (×360) et ce que P10 a
réparé.** Il a nommé son propre risque au bon endroit. La lame d'eau 1,34× est
publiée **avec sa cause déclarée introuvable**, et les chiffres du socle de ce
tableau-là sont bornés d'avance (« des ordres de grandeur, pas des valeurs que je
défends »). Le noteur refuse de confirmer ce facteur faute d'avoir rejoué l'A/B —
et il le dit. Personne ne s'appuie sur un chiffre qu'il n'a pas fait.

**Ce qui coûte l'important : le 5 625 (constat I-1).**

### ⚖️ Tâche P10 — `ac58500..d258d0b` — **CONFORMITÉ ✅**
**0 critique · 1 important · 3 mineurs.**

Campagne **51/51 rejouée**, **4 029** tests, **209/209**. **L'affirmation de
parité est la mieux étayée des cinq tâches** (§2). L'invariant de monnaie mord
(§2, R3). Le prix est déclaré **avant** qu'on le trouve, avec le témoin de
reproductibilité du socle à côté.

⛔ **L'aveu est exact mais INCOMPLET, et ce n'est pas un détail : voir I-2.**

### ⚖️ Tâche P11 — `d258d0b..bf03bfe` — **CONFORMITÉ ✅**
**0 critique · 1 important · 3 mineurs.**

Campagne **71/71 rejouée** (la plus grosse du chantier, 59 mutations de
branchement), **4 055** tests, **210/210**. Les deux affirmations extraordinaires
sont exactes au chiffre près (§2).

⚡ **C'est la tâche la mieux tenue des cinq sur les aveux.** Il DÉPASSE (+16,3 %
d'énergie, +15,7 % de saturation, +16,4 % de hors-orange), **il le publie avec les
trois chiffres et le signe inversé**, il nomme la cause (pente de rampe ×3,12) et
**il refuse d'arbitrer à la place du noteur**. Il déclare n'avoir mesuré à
l'écran QUE le cas sans mer — ⚡ **et le noteur a levé ce risque après coup, en
bougeant l'uniforme dans les deux sens, avec `Object.is` vrai aux seize
décimales.** Son refus de reprendre la dette de P10 est **motivé** (« la toucher
rouvrirait son poste n° 1 ») et le noteur l'a jugé **fondé**. Le banc qui s'est
corrompu une fois est déclaré, la mécanique de la corruption est écrite, et
⚡ **j'ai vérifié que le chiffre jeté (414 647) n'apparaît nulle part dans
`.banc/P11/`** — il a vraiment été jeté, pas recyclé ailleurs. Un second script
qui rate sa lecture (`m2-anneau.js`) est laissé sur le disque **avec son verdict
d'échec** plutôt que publié.

### ⚖️ Tâche P12 — `bf03bfe..6063c5e` — ⛔ **NON-CONFORMITÉ ❌**
**1 critique · 3 importants · 3 mineurs.**

**Le fond est juste, et il est important** : la campagne **58/58** se rejoue,
**4 082** tests et **211/211** aussi, et l'affirmation la plus lourde du brief est
vérifiée dans le code et dans les données (§2). Les aveux sont exacts : le pavage
qui DOUBLE est déclaré avant qu'on le trouve, **avec sa cause** (« la FACETTE de
la bilinéaire du champ ») et **avec le bruit de sa propre mesure** (17 %
inter-chargement) ; le fait de n'avoir pas refait les quatre chiffres-titres du
noteur est écrit **en tête de rapport, avant les colonnes concernées** ; et les
deux chiffres retirés des en-têtes (`×1,0006`, une prédiction jamais rendue) le
sont par un commit dédié, `6063c5e`, purement documentaire.

⛔ **Ce qui fait basculer le verdict, ce sont DEUX PHRASES QUI DISENT LE
CONTRAIRE DE LEURS PROPRES FICHIERS** (C-1, I-4), **plus une survivante de mon
cru qui montre que le cœur du correctif n'est gardé par rien d'exécutable**
(I-3). Les trois se réparent en quelques lignes ; aucune ne menace la mesure.
Mais sur ce chantier un témoin qui annonce zéro quand le fichier dit 933 est
exactement la catégorie de faute que la relecture de la tâche J a sanctionnée, et
la règle ne peut pas être plus douce ici parce que la conclusion est bonne.

---

## 4. Décompte par gravité, une ligne par constat

### ⛔ CRITIQUE — 1

**C-1 · P12 · Le témoin qui porte le ×2,18 annonce « aller-retour à 0 canal » ; son fichier dit 933.**
`rapport-P12.md` §1.2 présente `d3-hemisphere.js` comme *« aller-retour à 0 canal, témoin nul à 0 »*. `D3-hemisphere-P12.json` porte **`"retour": 933`** — le témoin nul, lui, vaut bien 0. Le champ est calculé par la MÊME expression que dans `d1-irradiance.js` (`ecart(Iref, imgCrop())`), où il vaut réellement 0 : les deux sont donc comparables, et l'un des deux est mal rapporté. ⚠️ **La conclusion n'est pas menacée** (146 % d'amplitude et ×2,18 pèsent sans commune mesure avec 933 canaux sur 4 096 000), et la **réserve n° 9 du même rapport déclare la bande 862–9 503 canaux qui explique 933**. ➡️ **C'est une phrase à corriger, pas une mesure à refaire** — mais c'est le témoin de propreté du fichier qui porte l'affirmation la plus lourde des cinq tâches, et il faut qu'il dise vrai. *(À remplacer par le chiffre réel + le renvoi à la réserve n° 9, comme la tâche J l'a fait pour son propre critique.)*

### ⚠️ IMPORTANTS — 6

**I-1 · P9 · Le « 5 625 sommets / CENT CINQ FOIS MOINS » est un calcul à la main que le relevé de la tâche contredit dans le MÊME fichier, et la garde du banc a sonné sans être rapportée.**
`rapport-P9.md` §1.3 pose « `gridFor(z) = 24` quads par tuile, 3 × 3 tuiles → **5 625** » contre 594 434 (celui-là mesuré). Or `S5-relief-P9.json`, produit par la même exécution, enregistre **`crop.sommets = 29 978`**, **`tuilesTouchees = 66`** et **`quadsParTuile = 64`** — et le commentaire du sonde `s5-relief.js:78` écrit noir sur blanc l'attente : *« le compte de sommets retenus doit tomber sur les 9 tuiles du bloc, soit 9 × 25 × 25 = 5 625 au plus »*. **La mesure l'a démentie d'un facteur 5,3, et ni le relevé ni le démenti ne sont dans le rapport.** La cause est identifiable : `tuilesCrop()` (`.banc/P7/harnais-P7.mjs:96`) rend **TOUTES** les tuiles du globe, tous niveaux confondus, et le filtre Mercator admet donc la pyramide empilée — d'où 66 tuiles pour un bloc qui en a 9. ➡️ **Conséquence à peser : l'écart-type `nduEcartType = 0,1994` publié à côté est calculé sur cette population empilée, donc il n'est PAS celui du bloc.** ⚡ **Le reste de l'argument survit** : `nduMin` est un MINIMUM, donc le minimum du bloc est nécessairement ≥ 0,2126 — « aucune face raide » tient de façon conservatrice, et le gain final (97,9 % / 98,02 %) est mesuré sur des pixels, pas sur des sommets. ⚠️ **Le 5 625 s'est propagé** : notation-04 le reprend au poste 3️⃣ (« silhouette dix fois trop grossière »), et `rapport-P11.md` réserve n° 2 aussi — là, du moins, avec une seconde lecture défendable et indépendante (**72 segments par côté de bloc contre 768**, soit 10,7 par axe, qui ne dépend pas du compte de sommets).

**I-2 · P10 · Le prix déclaré n'a été mesuré que sur un axe, alors que l'instrument qui portait le second tournait déjà.**
P10 déclare, avant qu'on le lui trouve, que la frange en marches empire de **5,9 %** (2,058 contre 1,943), et il le fait bien : le témoin de reproductibilité du socle est à côté. ⛔ **Mais le même pas élargi coûte AUSSI le grain du fond marin, deux fois plus cher — 100,08 % → 75,41 % du socle, soit −24,6 points**, trouvé par notation-04. Ce n'était pas hors de portée : `n4-mer.js`, le script du noteur, **rend déjà les deux colonnes**, et P10 rejouait ce banc-là. Son §2.4 arbitre explicitement le pas (pleine empreinte 96,30 % contre demi-empreinte 109,47 %) **en ne regardant que le relief**. ➡️ **L'aveu est exact sur ce qu'il dit et incomplet sur ce qu'il couvre** — et c'est P12 qui a payé les deux tiers de l'addition (75,41 % → 84,91 %), en établissant au passage que le reste vit dans `CHAMP_FOND = 384`.

**I-3 · P12 · ⚡ SURVIVANTE DE MON CRU : le cœur du correctif — quelle bande est le CIEL et laquelle est le SOL — n'est gardé que par une assertion de CHAÎNE, et un échange au point d'usage survit aux 4 082 tests.**
Mutation **R7** : je laisse intactes les deux lignes que le test cherche
(`const sol = irradianceBande(…, BANDES[0])` / `const ciel = … BANDES[1]`) et
j'échange `ciel` et `sol` **dans l'objet gelé que `coefAmbiante` RETOURNE** :
```js
ciel: Object.freeze(sol.map((v) => Math.max(0, v))),
sol:  Object.freeze(ciel.map((v) => Math.max(0, v))),
```
➡️ ⛔ **`npm test` complet : 4 082 / 4 082, VERT.** Le bloc s'éclairerait par en
dessous et rien ne rougirait. Le seul garde est `test/atlas-normales.test.js` ④b
(`sonde-ambiante.js:319-324`), **deux `assert.match` sur le texte source** — qui
par ailleurs rougirait à tort au moindre renommage local. ⚠️ **Le code livré est
JUSTE aujourd'hui : c'est un trou de COUVERTURE, pas un défaut livré** — mais
c'est très exactement la faute que la survivante `10f` de P11 avait démasquée
**une tâche plus tôt** (*« `test/mer-sphere.test.js` ⑫h exigeait une assertion de
CHAÎNE, et la mutation passait à travers »*), et que P12 cite lui-même dans son
§4. **Elle a été réintroduite dans le fichier de test neuf de la tâche qui la
raconte.** ➡️ **Remède connu et déjà employé ici : un test qui EXÉCUTE
`coefAmbiante` sur un faux renderer rendant deux bandes de valeurs distinctes, et
qui exige `ciel` > `sol`** — l'oracle existe déjà (`irradianceBande` est pure).
*(Mes cinq autres mutations de branchement — R1, R2, R4, R5, R6 — sont toutes
TUÉES, dont R5 par deux tests exécutables. Voir §5.)*

**I-4 · P12 · « le socle n'en a aucun » (pavage) est démenti par son propre second instrument ET par sa propre capture.**
Le §2.3 chiffre le doublement du pavage **0,0828 → 0,1565** et conclut « le socle n'en a **aucun** », sur la foi de `N5-…-N03.json` (`periodeSocle.pic = 0`). ⛔ **Son autre relevé du même état dit le contraire** : `E2-pas-mer-pavage-P12.json` porte `socle.pavage = {pic: 19, picNormalise: 0.0339}`. ⚡ **Et sa propre capture le montre** : sur `F2-SOCLE-cote-apparie-N03.png`, la mer du socle porte des bandes verticales franchement visibles. ⚠️ **Ce n'est pas une dissimulation** — le message du commit `16b0be7` cite ouvertement le 0,0339 — mais un rapport qui publie un absolu contredit par deux de ses propres pièces affaiblit le chiffre qu'il défend. ➡️ **Le doublement, lui, tient** : ×2,3 est au-dessus des 17 % de bruit que l'auteur déclare, et il le dit.

**I-5 · P8 · Le repli étendu contre l'avertissement d'`ocean.js` est posé exactement là où `ocean.js` dit que le halo est né, et quatre tâches plus tard le risque n'a toujours été cherché nulle part.**
`ocean.js:532-533` réserve le proxy distance-au-rivage à l'ALPHA — *« pas le proxy distance-au-rivage, c'etait lui le halo »*. P8 mesure que sur la seule alpha il ne déplace RIEN (11,72 % contre 11,71 %) et le pose donc **aussi sur le glacis**, c'est-à-dire sur le corps de l'eau. ⚡ **L'aveu est intégralement exact** : il cite l'avertissement, il dit qu'il le franchit, il dit pourquoi, et il déclare le halo comme risque *« il ne s'est pas montré à mes deux cadrages, et je ne l'ai pas cherché ailleurs »*. ⛔ **Mais le cas nommé — un crop sur plateau continental peu profond — n'a été regardé par AUCUNE des quatre tâches suivantes, ni par les deux notations**, qui n'ont jamais quitté La Réunion. ➡️ **Risque ouvert, attribué, non instruit ; il ne coûte rien tant qu'un second lieu n'est pas ouvert, et il coûtera tout ce jour-là.**

**I-6 · Transverse (P10, P11, P12) · Le champ `head` qui atteste « quel code a été mesuré » est une chaîne TAPÉE À LA MAIN.**
`.banc/*/n1-etat-relief-palette.js:26`, `n4-mer.js:32`, `n5-…js:27` portent `head: 'ac58500'` en dur ; `d1-irradiance.js:56` porte `head: 'bf03bfe'` ; `e1/e2/e3` portent `'e4d4ae4'`. ⛔ **Conséquence : les cinq relevés `N*` de P10, P11 et P12 déclarent tous `ac58500` — un commit de P9** — alors qu'ils ont été pris à trois états différents du code. Ce n'est **la faute d'aucun des trois** (ils ont rejoué le script du noteur sans le modifier, comme demandé, et c'est même la preuve qu'ils ne l'ont pas touché). ⚠️ **Mais la provenance de tous les chiffres « à travers les notes » repose en réalité sur les appariements et les témoins, jamais sur l'estampille**, et P12 s'appuie explicitement dessus (*« ont tourné sur son HEAD `bf03bfe`, source intouchée »*). ➡️ **Deux lignes à changer** : lire `head` depuis le harnais plutôt que de le taper.

### ▫️ MINEURS — 11

1. **P8** — le relevé fautif `S7-nappe-P8.json` reste sur le disque : **c'est une vertu**, mais rien dans le fichier ne le marque comme retiré ; seul le rapport le dit.
2. **P8** — l'aller-retour inexact des rustines varying→fragment (10 451 à 32 171 canaux, cause inconnue) est déclaré mais jamais rouvert par la suite.
3. **P9** — deux valeurs de la même grandeur sans réconciliation : énergie de départ du crop **10,972** (`S5`) contre **10,963** (`S7`).
4. **P9** — l'intersection des masques de mer dérive (75 079 / 75 086 / 75 118 / 75 095 selon les tâches) sans être commentée ; c'est du bruit inter-chargement, mais il traverse tous les tableaux comparatifs.
5. **P9** — le `d01` retiré est attribué à `S4` dans le texte et localisé dans `S2-fond-P9.json`.
6. **P9** — renvoi cassé : le §0.2 pointe « §3.2 » pour une mesure qui est au §2.2.
7. **P10** — « le socle se reproduit à 0,3 % » vaut pour `longueurMoyenne` (1,669 / 1,674) mais pas pour `part4plus` (6,65 / 6,58, soit **+1,1 %**, quatre fois plus).
8. **P10** — l'appariement pair/impair résiduel « 0,0278 contre 0,0288 » compare deux quantités calculées par deux formules différentes (une différence contre une moyenne d'impairs) ; la conclusion tient, l'appariement écrit n'est pas apparié.
9. **P11** — le socle des **2 778 m** de la ligne d'arbres (§1.3) **n'a de source nulle part sur le disque** : aucun JSON, aucun log, aucun test ne le porte.
10. **P11** — `M1-bord-apres.json` porte un bloc `anneauContreMaillage` **identique au bit** à celui d'avant, et sa colonne socle a bougé entre les deux chargements (`socleEau` 809 → 0) ; le rapport ne cite que « avant », donc il ne sur-affirme rien, mais un fichier « après » identique devrait dire qu'il est invariant par construction.
11. **P12** — l'en-tête annonce *« les quatre fichiers de `src/` touchés »* ; `git show --stat` en donne **trois** (`atlas-normales.js`, `sonde-ambiante.js`, `globe.js`). Et une **troisième prédiction jamais rendue** survit dans l'en-tête de `atlas-normales.js` (« +40 % / +17 % à `ndu ≈ 0` »), dans le bloc même dont le §6 dit que **la mesure lui a donné tort** — le commit `6063c5e` ne l'a pas touchée.

---

## 5. Mes propres mutations, et mes cassures de tests

### Six mutations de mon cru, TOUTES visant le branchement

| id | fichier | ce que j'ai débranché | verdict |
|---|---|---|---|
| **R1** | `sonde-ambiante.js` | ciel et sol lus à l'envers **chez le consommateur** | tuée — ⚠️ **par une assertion de CHAÎNE** (④b) |
| **R2** | `main.js` | la paroi reprend l'INTENSITÉ du relief (le coef restant juste) | tuée |
| **R3** | `globe.js` | `UNITES_PAR_METRE_SOL` divisé par le TOUR au lieu du RAYON | tuée — ⚡ *« le tour en unites de scene vaut 100 au lieu de 628,3185… »* |
| **R4** | `globe.js` | le repli « au bit près » de P8 recopie ciel et sol à l'envers | tuée |
| **R5** | `globe.js` | l'alias des uniformes de paroi échange ciel et sol | tuée par **deux** tests exécutables (⑥a, ⑦b) |
| **R6** | `main.js` | le RELIEF prend le studio de la paroi (le défaut de P8 par l'autre bout) | tuée |
| ⛔ **R7** | `sonde-ambiante.js` | ciel/sol échangés **au point d'usage**, les chaînes assertées laissées intactes | ⛔ **SURVIVANTE — 4 082/4 082 vert** (constat I-3) |

### Trois tests pris au hasard, ligne visée cassée

| cassure | tué par | diagnostic rendu |
|---|---|---|
| `ecume-mer.js` : `REPLI_RIVAGE 1.6 → 1.0` | ⑦b **et** ⑦c | ⑦b **relit la constante dans `ocean.js`** — oracle croisé, pas recopié ; ⑦c cite la chaîne GLSL attendue |
| `maillage-tuile.js` : anti-diagonale échangée | ②b **et** ③a | ⚡ *« saut de 63,39 sur la diagonale à s=0,1 »* et *« la loi s'écarte de la géométrie de 587,81 m (flèche théorique 0,0033 m) »* |
| `atlas-normales.js` : `marge` sans `MARGE_MIN` | ②d | plages attendues contre plages rendues, en `deepEqual` |

⚡ **Cinq des six tests qui ont mordu nomment la MÉCANIQUE et donnent l'écart
chiffré.** Le seul purement textuel (⑦c) est doublé d'un test exécutable (⑦b) sur
la même ligne. **C'est le bon patron — et c'est précisément celui qui manque au
④b de P12 (I-3), qui n'est doublé de rien.**

---

## 6. Les captures — un rapport qui embellit ses captures est un critique

**Aucun des cinq ne le fait. Trois exemples que j'ai regardés :**

- ⚡ **`P12/F1-CROP-cote-N03.png`** — la capture que P12 nomme lui-même *« le prix
  de cette tâche, en une image »*. **Le pavage rectangulaire y crève l'écran**,
  et avec lui le tablier de mer qui déborde le mur et les jupes qui pendent —
  trois défauts NON corrigés, dans la capture de livraison. **Honnête.**
- ⚡ **`P9/E4-zoom-CROP-livre-int-P9.png`** — P9 déclare *« je vois un léger
  crénelage »*. **On le voit** : moucheture de pixels isolés sombres sur toute la
  surface, arêtes en escalier sur les crêtes. **Il n'a pas choisi une capture qui
  le cache.** Et `P10/B3-zoom6-CROP-relief-P10.png`, même cadrage après P10,
  **ne l'a plus** — le gain annoncé se voit aussi.
- ⚠️ **`P12/F2-SOCLE-cote-apparie-N03.png`** — c'est la capture qui **contredit**
  la phrase « le socle n'en a aucun » (I-4) : la mer du socle y porte des bandes
  verticales nettes. **La capture est plus honnête que la légende.**

---

## 7. Ce que je n'ai PAS fait — bornez mes conclusions là-dessus

1. ⛔ **Je n'ai rien mesuré à l'écran.** Aucun de mes constats ne repose sur un
   rendu que j'aurais produit : je suis allé aux **JSON bruts** et aux **captures
   déjà sur le disque**, et j'ai rejoué **le code sous node**. Les chiffres d'écran
   que je valide, je les valide par recalcul depuis les relevés, pas par
   reproduction.
2. **Je n'ai pas rejoué les campagnes des tâches ANTÉRIEURES** (P2…P7) : le « le
   branchement était fidèle depuis onze tâches » de P12 n'est vérifié par moi
   qu'à travers `D2-sonde-P12.json` et le code de `bf03bfe`.
3. **Je n'ai pas cherché le halo d'`ocean.js`** (I-5) : il demande un second lieu,
   donc un banc d'écran.
4. **Mes six mutations et mes trois cassures ne couvrent que le branchement de
   l'ÉCLAIRAGE** — je n'ai pas visé la chaîne de la mer ni celle de la rampe.
5. **Je n'ai pas tranché lequel du 5 625 ou du 29 978 est le bon compte** (I-1) —
   j'affirme plus étroitement, et cela suffit : **le rapport publie l'un pendant
   que son relevé enregistre l'autre, et la garde écrite dans le sonde a sonné
   sans être rapportée.**

---

## 8. Isolement — état rendu

- Worktree `C:/Dev/wt-relecP812` créé sur `6063c5e`, `node_modules` et
  `public/data/sol` en **jonction** (aucune copie, aucune écriture dans l'arbre
  principal).
- Les cinq résultats de campagne rejoués ont été écrits **dans mon worktree**
  (`.banc/P8…P12/resultat-mutations-*.json`), **jamais dans `C:/Dev/wt-merge`**.
- Après chaque mutation et chaque cassure : `git status --porcelain` **vide**.
- ✅ **Worktree retiré en partant** : `git worktree remove --force C:/Dev/wt-relecP812`.
- **Un seul fichier écrit dans le dépôt : celui-ci.**
