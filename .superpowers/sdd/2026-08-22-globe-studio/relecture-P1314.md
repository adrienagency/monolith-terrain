# Relecture P13 + P14 — `ee4e479..536f7a6` puis `536f7a6..17ddd41`

**Isolement.** `git -C C:/Dev/wt-merge worktree add C:/Dev/wt-relecP1314 17ddd41`,
plus deux worktrees jetables aux bornes (`wt-relec-p13start` @ `ee4e479`,
`wt-relec-p13end` @ `536f7a6`) pour rejouer les deux campagnes à leur propre
commit. **`npm install` fait dans les trois** (le piège du 42/42 sur un arbre
sans `node_modules` est explicitement contourné). **Les trois retirés avec
`--force`** en fin de relecture ; `git worktree list` ne les montre plus,
`git status --porcelain` est vide sur `wt-merge`. **Un seul fichier écrit** :
celui-ci.

---

## 0. Le piège tendu, désamorcé

| commit | `npm test` | `audit:tests` |
|---|---|---|
| `ee4e479` (avant P13) | **4 087 / 4 087**, 0 fail, 2 skip | — |
| `536f7a6` (fin P13) | **4 105 / 4 105**, 0 fail, 2 skip | 211/211, aucun écart |
| `17ddd41` (fin P14) | **4 115 / 4 115**, 0 fail, 2 skip | 211/211, aucun écart |

Les trois totaux **diffèrent**, les trois `0 fail` sont réels (`node_modules`
présent, installé à la main dans chaque worktree). Le total annoncé par P13
(4 087 → 4 105) et par P14 (4 105 → 4 115, +10) est retrouvé au chiffre.
**La campagne a réellement tourné.**

**CRLF (livrable de P13) :** `.gitattributes` porte `* text=auto eol=lf` ;
`git ls-files --eol | grep -c w/crlf` → **0** dans l'arbre à `17ddd41` (donc
après P13 et après P14, la dette reste fermée) ; le commit `d1b212a` touche
**exactement `.gitattributes`, 42 lignes, 1 fichier** (`git show --stat`
vérifié). **Confirmé.**

---

## 1. VERDICT — TÂCHE P13 (`ee4e479..536f7a6`)

### CONFORMITÉ ✅

**0 Critique · 1 Important · 2 notes mineures.**

| gravité | constat |
|---|---|
| Important | **Le test ⑬f (« et il mord quand on l'y force ») ne prouve la morsure du garde-fou QUE pour le congé (`arrondi`), pas pour le chanfrein (`ch`).** J'ai retiré le `Math.min(frCh * largeur, mur * PART_MUR_MAX)` du calcul de `ch` seul (`src/monde/parois-crop.js:803`) en laissant celui de `rd` intact : le test passe quand même — les deux seules assertions sur le bloc écrasé (`ecrase.arrondi < FRACTION_ARRONDI * ecrase.largeur` et `ecrase.arrondi === murEcrase * PART_MUR_MAX`) ne portent que sur `arrondi`. La campagne des 42 mutations de P13 ne l'a pas non plus isolé (M07 débranche `PART_MUR_MAX` globalement, donc pour les deux à la fois, et c'est cette mutation-là qui tue). Restauré immédiatement, `git diff --stat` vide après. Aucune preuve d'un vrai défaut — le code de `ch` est symétrique à celui de `rd` — mais la phrase du test surclaime ce qu'elle vérifie.|
| note | Le détail « 646 identiques / 421 égaux au CR près / 0 autre » (§1.1 du rapport) porte sur un état de la **copie de travail** antérieur au premier `git worktree add` que j'ai fait — il n'est plus reproductible depuis l'extérieur. Ce qui EST vérifiable et vérifié : le blob de chaque fichier à `ee4e479` est déjà en LF (`git show HEAD:src/globe.js \| xxd` et un `git worktree add` frais avec `core.autocrlf=false` sortent tous deux du LF pur), ce qui rend l'affirmation « la dette vivait dans la copie de travail, pas dans l'index » plausible et cohérente avec tout le reste — mais je ne peux pas re-mesurer la copie CRLF d'origine, elle n'existe plus. 646 + 421 = 1067 = le compte de fichiers suivis avant `.gitattributes` (1068 après) : cohérent en interne. |
| note | Le liseré de base « non reproduit, en fait reculé » (0,5817 → 0,3702, socle 0,7109) : P13 publie les trois colonnes de chiffres nécessaires à ce calcul (§3.2) mais ne fait pas elle-même la soustraction ; le noteur la fait. Ce n'est pas une dissimulation — les nombres bruts sont publiés et honnêtes — mais un constat que P13 aurait pu tirer de ses propres colonnes et qu'elle laisse au noteur. Je le note, sans le compter en gravité : rien n'est caché, juste pas conclu. |

### Ce qui a été vérifié et TIENT

- **Chanfrein/congé.** `FRACTION_CHANFREIN = 0.16/56`, `FRACTION_ARRONDI = 0.9/56`,
  `PART_MUR_MAX = 0.25`, garde-fou `Math.min(fr*largeur, mur*0.25)` — tout
  retrouvé dans `src/monde/parois-crop.js:292-305,803-804`.
- **L'exagération est bien FIXE à 2 sur le chemin crop.** `EXAGERATION_UNIQUE = 2`
  (`zoom-continu.js:75`), et `main.js:832` pose
  `constante: terreUniqueBranchee ? EXAGERATION_UNIQUE : null` dans
  `exagPartage`, seul lecteur autorisé (`lireExageration`,
  `exageration-continue.js:495`). **La « troisième raison périmée » de la
  Tâche B est donc vraie dans le code, pas seulement affirmée.**
- **Les ratios ×10,3 / ×58 / ×76 / ×431 sont arithmétiquement cohérents**
  entre eux à partir des hauteurs de mur données (0,107909 / 0,808432) et des
  largeurs demandées (0,16289 ≈ 0,163, cohérent avec « le crop fait 0,163 unité
  de large ») — reconstruit indépendamment, ça retombe pile sur les quatre
  chiffres publiés.
- **Campagne de mutation : 42/42 tuées, 35 BRANCHEMENT (83,3 %), rejouée
  telle quelle au commit `536f7a6`** (`.banc/P13/mutations-P13.mjs`, copié et
  exécuté avec `RACINE` redirigée vers un worktree isolé). **Chiffre exact
  retrouvé, dont les 42 restaurations vérifiées propres.**
- Trois tests cassés au hasard pour vérifier qu'ils échouent réellement :
  la dilatation cyclique de `jupesEffacees` cassée → le test P14 dédié échoue
  bien ; `RETRAIT_EAU_CROP` décalé de 0,02 unité → l'invariant ⑬e échoue bien ;
  le garde-fou de `ch` cassé → ⑬f **ne détecte rien** (voir Important
  ci-dessus, c'est la trouvaille).
- Captures regardées : `P5/P6/P7-zoom6-…-base-…P13.png` montrent bien un
  liseré orange **pointillé** sur l'arête HAUTE du crop livré, absent sur le
  bloc rebâti aux arêtes vives — cohérent avec la légende, aucune capture
  contredisant son texte trouvée dans l'échantillon regardé.

---

## 2. VERDICT — TÂCHE P14 (`536f7a6..17ddd41`)

### CONFORMITÉ ✅

**0 Critique · 2 Important · 1 note mineure.**

| gravité | constat |
|---|---|
| Important | **`D5-energie-P14.json` (§2.3 du rapport) affirme que la normale fine est « l'UNIQUE poste dont l'extinction traverse 1,00 » — c'est faux dans le tableau qu'il publie lui-même.** Relu dans le JSON brut : `éclairage du crop éteint` rend un rapport de **0,863** (< 1), tout comme `normale fine éteinte` (**0,7746**). Les deux traversent 1,00. La distinction tenable (l'extinction de l'éclairage est un état dégénéré — `rose` s'effondre à 0,003, quasi achromatique, donc pas une comparaison à isopoids) n'est jamais énoncée dans le rapport : la phrase surclaime ce que le tableau montre. Ça ne change PAS la conclusion (la normale fine reste le seul levier isolable à un seul bouton qui traverse 1,00 sur un état comparable), mais la formulation est inexacte face à ses propres données. |
| Important | **Ma mutation R4 (de mon cru, visant le branchement) survit** : dans `_retaillerJupe` (`src/globe.js:5082-5083`), la boucle qui construit `locaux[bi]` depuis `d.bord[bi]` bornée à `d.bord.length` a été raccourcie d'un cran (`d.bord.length - 1`). Le dernier sommet de l'anneau garde alors un `locaux[dernier] = undefined`, que `jupesEffacees` ignore silencieusement (`if (l && …)`) — **son marquage « brut » n'est jamais calculé**, et rien dans la suite `test/crop-parois.test.js` ne le détecte. Impact réel probablement faible : la dilatation d'un cran (`brut[i-1] || brut[i] || brut[i+1]`) peut encore marquer ce sommet via ses voisins si l'un d'eux est sur la frontière — mais si le dernier sommet de l'anneau est ISOLÉ (aucun voisin marqué), sa jupe ne s'efface jamais. Aucun test du dépôt ne couvre spécifiquement la LECTURE complète de l'anneau (les tests existants couvrent la dilatation cyclique et les gardes, pas la complétude de la boucle de lecture). Recommandation : un test qui vérifie que `locaux` a exactement `d.bord.length` entrées non-`undefined`, ou un test posé sur une géométrie où seul le dernier index de l'anneau tombe dans la bande. |
| note | Une deuxième mutation à moi (R1 : `q <= 1 + retrait` → `q < 1 + retrait`, borne stricte) survit aussi, mais c'est très probablement un mutant équivalent : elle ne change le résultat qu'à l'égalité flottante exacte `q === 1 + retrait`, un cas mesure-zéro sur des coordonnées issues d'un rabattement sphérique continu. Pas compté en gravité. |

### Ce qui a été vérifié et TIENT — et c'est l'essentiel de cette tâche

- **⛔⛔ « La route nommée par P13 et le noteur désigne l'ensemble vide » — CONFIRMÉ, dans le code ET dans les données.**
  `main.js:4857` tire `assietteCrop` de `terrain.fenetreBornee.emprise`, donc
  alignée sur la grille de tuiles par construction. Le JSON brut
  `.banc/P14/D1-jupes-qui-P14.json` le prouve à l'expérience : éteindre les
  jupes des **14 tuiles « traversées »** rend EXACTEMENT le même résultat que
  ne rien éteindre (**23 traînées / 68 colonnes / résidu 0,961**, au chiffre
  près, dans les deux cas) — c'est une intervention nulle, mesurée. Éteindre
  les **46 tuiles entièrement dedans** (ou toutes) fait tomber le compte à
  **10 / 14 / 0,665**. Et les 14 « traversées » sont bien des ancêtres
  grossiers du quadtree (z2 à z12, `listeDedans` du même JSON), avec des
  sommets de bord à **|u| = 519** pour la z2 — confirmé dans
  `D3-uv-bord-P14.json`. **La lecture du code et les données brutes
  s'accordent parfaitement avec le texte du rapport.**
- **Traînées 23 → 9, sous le plancher d'extinction totale (10).**
  `D1-jupes-qui-P14.json` et `D2-balayage-retrait-P14.json` reproduisent au
  chiffre exact le tableau du rapport (dépôt 23/68/0,961 ; livré 9/13/0,604 ;
  jupes éteintes 10/14/0,665). **L'escalier à deux marches** (23 → 17 avec la
  seule frontière, → 9 avec le voisin dilaté) est présent dans le JSON de
  balayage, dix valeurs, plateau confirmé de `0,25·ch` à `8·ch`.
- **La mutation équivalente M23, vérifiée expérimentalement — reproduite
  indépendamment.** J'ai copié `verif-M23.mjs` tel quel dans mon worktree et
  je l'ai exécuté : **écart max (u,v) bord vs jupe = 1,521·10⁻⁸, bande =
  5,714·10⁻³** — soit un rapport de **375 700**, conforme au « 375 000 fois
  plus étroit » annoncé. Le mécanisme (rabattement radial depuis le centre de
  la planète, donc (lat, lon) conservée) est cohérent avec le code lu dans
  `_retaillerJupe` : `locaux[bi]` est bien lu depuis `d.bord[bi]` (le sommet de
  BORD), pas depuis `d.nV + bi` (le sommet de JUPE) — la mutation M23
  échange l'un pour l'autre, et l'équivalence géométrique tient.
- **Campagne de mutation P14 : 23/24, rejouée telle quelle sur mon worktree —
  chiffre exact retrouvé**, seule M23 survit (l'équivalente vérifiée
  ci-dessus). M11 (la garde `retrait > 0` de `jupesEffacees`) a bien été
  retirée du fichier committé — vérifié dans `src/monde/parois-crop.js:503-514`,
  le commentaire in situ explique pourquoi c'était du code mort, et la
  mutation de remplacement (marquer le VOISIN plutôt que le sommet lu) est
  bien TUÉE dans mon run.
- **Poste ③ (rampe) : réfutation confirmée par les données brutes.**
  `D4-rampe-P14.json` redonne exactement 2 896 m (crop) contre 2 967 m
  (socle), soit 2,4 %, et non ×3,12. Les neuf valeurs du balayage d'ancre
  (`uReliefBas`) sont dans le fichier, cohérentes avec le tableau du rapport
  au chiffre.
- **Poste ② (spéculaire) : réfutation confirmée.** `D6-speculaire-P14.json`
  redonne l'écart de luminance −3,94 % → −1,30 % en éteignant
  `specularIntensity` du socle, et le rosé 1,421 → 1,203. Le
  « onzième code mort » (`envMapIntensity = 0,15` sans effet) est une mesure
  EMPIRIQUE sur la page réelle (`aEnvMap: false` lu en direct sur le
  matériau vivant, 0 canal de témoin dans le fichier JSON), pas une simple
  lecture de texte source — j'ai vérifié que `scene.environment` est bien
  posé ailleurs dans l'app (`main.js:1370`, `roomEnvTex`), ce qui rendait la
  question légitime (un `envMapIntensity` pourrait en théorie moduler l'IBL de
  scène même sans `material.envMap` propre) ; la mesure à canal nul tranche
  correctement malgré cette possibilité théorique.
- **Captures.** `V2-zoom-CROP-mur-AVEC-jupes-N05.png` et
  `V3-…SANS-jupes-N05.png` sont, à l'œil, indiscernables au pixel près sur la
  zone regardée — cohérent avec « les jupes ne dépassent plus, les éteindre ne
  change plus rien ». Aucune capture contredisant sa légende trouvée dans
  l'échantillon inspecté (dont `A1` vs `V6`, et le triptyque `P5/P6/P7`).

---

## 3. Ce que je n'ai PAS pu faire, et pourquoi

- Je n'ai pas rejoué les scripts de capture/mesure eux-mêmes (ils demandent un
  serveur de dev + pilote CDP complet) : j'ai vérifié les JSON déjà produits
  contre le code source et contre une ré-exécution indépendante des campagnes
  de mutation et du script d'équivalence M23, qui, eux, ne demandent qu'un
  worktree Node. C'est le sous-ensemble qui peut être vérifié sans recréer
  tout le banc visuel — je ne prétends pas avoir re-rendu les captures.
- Je n'ai pas audité les ~90 captures une par une, seulement un échantillon
  ciblé sur les affirmations les plus lourdes (chanfrein, traînées,
  spéculaire).
- La rupture historique de la copie de travail CRLF (avant `d1b212a`) n'est
  plus observable de l'extérieur ; je l'ai notée comme non-reproductible, pas
  comme fausse.

---

## Résumé

| tâche | Critique | Important | CONFORMITÉ |
|---|---|---|---|
| **P13** (`ee4e479..536f7a6`) | 0 | 1 (couverture ⑬f incomplète sur le chanfrein) | **✅** |
| **P14** (`536f7a6..17ddd41`) | 0 | 2 (formulation « unique poste » inexacte ; off-by-one non testé sur le dernier sommet d'anneau) | **✅** |

Aucune des affirmations les plus lourdes des deux tâches — la dette CRLF déjà
en LF côté index, le chanfrein mesuré à +58,25 %, l'ensemble vide de la route
« tuiles traversées », l'équivalence de M23, les réfutations des postes ② et
③ — ne s'est effondrée sous vérification indépendante (code, données brutes,
ré-exécution des campagnes, mutations de mon cru). Les deux trouvailles
Importantes sont des trous de COUVERTURE DE TEST, pas des défauts de
comportement démontrés.
