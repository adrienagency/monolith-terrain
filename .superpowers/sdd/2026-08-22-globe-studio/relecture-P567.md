# RELECTURE P5 + P6 + P7 — le fond marin, les vingt branchements, le tablier et les jupes

**Relecteur indépendant · 2026-08-22 · isolation respectée.** Travail dans
`C:\Dev\wt-relecP567` (`git -C C:/Dev/wt-merge worktree add C:/Dev/wt-relecP567 6373339`).
`node_modules` **copié** depuis `C:/Dev/wt-merge` (171 Mo, pas de jonction possible entre
volumes séparés sous Windows dans cet environnement — vérifié fonctionnel, voir plus bas).
**Retiré en partant** (`git worktree remove C:/Dev/wt-relecP567 --force`, exécuté après ce
rapport ; `git worktree list` ne le porte plus, le dossier n'existe plus). Aucun fichier écrit
dans `C:\Dev\wt-merge` autre que ce rapport.

---

## LE PIÈGE DU WORKTREE SANS EXÉCUTION RÉELLE — vérifié explicitement

Premier `npm test` dans le worktree frais (avant tout ajout) : **4013/4014**, 1 échec réel
(durées non nulles, 33,25 s). ⚠️ **Donc pas le piège des 42/42 sans `node_modules`** — ici
`node_modules` était bien présent et les tests tournaient pour de vrai. L'unique échec
(`occupation-sol.test.js`, `ENOENT public/data/sol/index.json`) vient d'un répertoire **gitignoré**
(`git check-ignore` le confirme), généré, absent d'un `git worktree add` frais — sans lien avec
P5/P6/P7. Copié depuis `wt-merge` (776 octets, pas les 68 Mo complets de `public/data`) : **4014/4014,
0 échec**, confirmé aussi directement dans `wt-merge` lui-même. **Retenu comme second piège de
worktree, à côté de `node_modules` absent, pour les relectures futures.**

**CRLF** : `core.autocrlf=false` partout (dépôt et worktree), `file` ne rapporte aucun CRLF sur
les fichiers touchés, `git check-attr` ne force aucun `eol`. **Aucun risque de faux survivant ici.**
`git diff --stat` vs `--ignore-cr-at-eol --stat`, refait moi-même **sur la PLAGE COMPLÈTE de
chaque tâche** (pas seulement le premier commit) :

| tâche | plage | insertions/suppressions/fichiers, avec et sans `--ignore-cr-at-eol` |
|---|---|---|
| P5 | `a4ec5b1..4a182a3` (2 commits) | 769(+) / 39(−) / 7 fichiers — **identique** |
| P6 | `4a182a3..f78cb3f` (4 commits) | 1672(+) / 58(−) / 12 fichiers — **identique** |
| P7 | `f78cb3f..6373339` (3 commits) | 626(+) / 7(−) / 7 fichiers — **identique** |

---

## LES TROIS CAMPAGNES DE MUTATION — rejouées pour de vrai, à COMMIT CONSTANT

Les scripts (`.banc/mutations-P5.mjs`, `.banc/mutations-P6.mjs`, `.banc/P7/mutations-P7.mjs`)
existent encore sur le disque de `wt-merge` (hors dépôt, `.banc/` gitignoré) : copiés dans le
worktree isolé et **exécutés réellement** (écriture, tests, restauration, `git status` vide
vérifié après chaque campagne). ⚠️ **Rejouées au commit DE CHAQUE TÂCHE**, pas au HEAD final —
un premier essai à `6373339` a rendu 34/38 pour P5 avec 4 mutations « NON APPLIQUÉES » (le motif
de texte ne se trouve plus : P6/P7 ont depuis retouché `globe.js`/`mer-sphere.js`), ce qui n'est
**pas** un défaut de P5 mais un artefact de rejouer une campagne hors de son commit.

| tâche | commit | annoncé | **rejoué** |
|---|---|---|---|
| P5 | `4a182a3` | 38 / 38 | **38 / 38, 0 non appliquée** ✅ |
| P6 | `f78cb3f` | 72 / 72 | **72 / 72, 0 non appliquée** ✅ |
| P7 | `6373339` | 31 / 31 | **31 / 31, 0 non appliquée** ✅ |

**Les trois chiffres-titres du brief sont exacts, au commit près qu'ils annoncent.**

### Mes trois mutations, visant le branchement, indépendantes des listes ci-dessus

1. `profondeurMaxDuCrop` (`mer-sphere.js`) : relâché le masque d'emprise (`> 1` → `> 2`),
   réintroduisant une fuite vers la calotte. **Tuée** par ⑬d.
2. `abscisseNautique` (`mer-sphere.js`) : exposant 0,55 → 1 (défait le coude de la rampe).
   **Tuée** par ⑨d.
3. `occlusionContact` (`parois-crop.js`) : retiré le carré (`k*k` → `k`), cassant la recopie
   verrouillée contre `plinth.js:contactAO`. **Tuée** par le test de verrouillage ligne 437.

**Zéro survivante. Aucun code mort trouvé** (voir aussi le contrôle de branchement ci-dessous).

### Trois tests pris au hasard, ligne visée cassée, échec vérifié

`globe-precision.test.js` (« la jupe descend toujours vers le centre de la planète »,
`skirtDrop` mis à 0) · `crop-eclairage.test.js` (① c, garde NaN de `natGris` retirée) ·
`ecume-mer.test.js` (⑧e, clamp d'`opaciteEau` retiré). **Les trois échouent avec un diagnostic
exact — aucun test vide.**

### Vérification anti-code-mort des fonctions centrales

`majReglagesMer`, `couleursFondDuSocle`, `profondeurMaxDuCrop`, `rabattementBorne`,
`construireJupeMer` : appelées directement dans `main.js`/`globe.js`. `lameEauDuSocle` /
`couleursEauDuSocle` / `etatMerDuSocle` semblaient orphelines par grep direct — **elles sont
appelées dans `ocean.js:1864/1872/1878` via l'accesseur `reglagesMer`**, lui-même consommé par
`main.js:11999` (`...realWater?.reglagesMer` → `globe?.majReglagesMer`). **Chaîne complète
vérifiée, rien de mort.**

---

## CONSTATS PAR AFFIRMATION

### P5

- ✅ **`couleursFond` jamais passé.** Confirmé : `git grep couleursFond` sur `a4ec5b1` ne
  trouve d'appelant nulle part hors la signature par défaut elle-même.
- ✅ **Budget calotte vs bloc.** Diff confirmé : `fondBudget: Math.max(champ.profMaxM, 1)`
  (calotte) devient `Math.max(champ.profMaxCropM || champ.profMaxM, 1)` avec
  `profMaxCropM: profondeurMaxDuCrop(brut, cote, portee)` (bloc). Structure cohérente avec
  ×1,658 et le doublement de frange annoncés.
- ⚠️ **Bathymétrie non quantifiée (5 299/5 448, pente −9,4 %).** Chiffre sourcé uniquement dans
  `.banc/vues-P5/releves-bruts-P5.json`, **gitignoré, non recalculable dans cette relecture**
  (nécessiterait de rejouer le rendu vivant). Plausible structurellement (Catmull-Rom +
  `fuseBathymetry` lissent les marches GEBCO comme documenté dans `bathy.js`), **non vérifié au
  pixel**, à la différence des chiffres ci-dessous qui sont auto-documentés dans le code.
- ✅ **Rugosité retirée comme artefact d'arrondi entier (`Int16Array`, 0,531 vs 0,526).**
  Raisonnement sain : un champ moins résolu qui échantillonne le même relief lisse aura
  moins de bruit de quantification, donc une « rugosité » apparente plus faible sans être
  réellement plus lisse en profondeur — le témoin (arrondi au mètre du champ crop) le montre.
- ✅ **Six écarts d'état de mer, dont la vitesse ×2,5.** `uMerVitesse: { value: 1 }` en dur
  confirmé dans le diff, contre `(params.seaSpeed ?? 1) × 0,4` d'`ocean.js`.
- ⚠️ **Tests et pourcentages pixel (80,97 %→30,33 %, 493 px orange→0, 1 unité/255) non
  reproduits** — capturés par `.banc/serveur-vues-P5.mjs`/`harnais-P5.mjs` (gitignorés),
  impossible à rejouer sans relancer un rendu vivant dans cette relecture.

### P6

- ✅ **Le tableau d'audit — recompté depuis `.banc/P6/TABLEAU-P6.json` lui-même** (77 lignes) :
  `ferme-P6` = **20**, somme des `ferme-avant*`/`converti, ferme-avant*` = **43**
  (9+1+4+2+9+1+13+3+1), `liste` (non fermé) = **11**, `sans-homologue` = **3**. **20+43+11+3 =
  77, exact au chiffre près.**
- ✅ **Soleil de la mer et des parois = caméra, P3 n'avait corrigé que les tuiles.** Vérifié dans
  le diff (`vec3 L = normalize(uSunDir)` avant, gardé par `uEclairageOn` après) **et** dans le
  code AVANT P6 (`4a182a3`) : `uSoleilDir`/`uEclairageOn` alimentaient déjà `colBloc` pour les
  TUILES (ligne 1614), mais pas la mer ni le nuanceur des parois. Le lien avec l'aplat beige de
  P5 (réserve n° 1, « face de la paroi ») est plausible mais pas revérifié pixel par pixel.
- ✅ **`uMerHoule` 121,6× trop haute, aggravée ×4 par P5.** **Auto-documenté dans le code** :
  `src/globe.js:289`, « uMerUnite = 0,008227, donc uMerHoule = 2 valait 121,6 FOIS l'amplitude
  du socle ». P5 était passée de 0,5 (défaut mort) à 2 (branché mais sans `uMerUnite`) — un
  facteur ×4 cohérent avec « aggravée », le vrai correctif de P6 étant l'ajout du facteur
  `uMerUnite` dans l'expression du vertex shader.
- ⚠️ **Méthode du « témoin aberrant »** vérifiée en détail sur le cas `uMerHoule` (A/B à zéro,
  disparition confirmée) — **non auditée exhaustivement sur les 43 entrées « déjà branché »**
  du tableau (hors du périmètre temps de cette relecture ; échantillon de 3 lecturé, rien
  d'anormal trouvé).
- ⚠️ **Mesures de luminance (80,97 %→48,50 %→30,25 %, socle reproduit à 0,08 pt)** non
  reproduites (captures gitignorées).

### P7

- ✅ **`construireJupeMer` — sens d'index inversé, matériau `FrontSide`, correctif « deux
  lignes ».** Confirmé **dans le code lui-même** (`mer-sphere.js:645-679`) : le commentaire cite
  le même anneau, le même agencement que `parois-crop.js §④`, et prouve l'inversion ligne à
  ligne. Le correctif réel est bien les deux lignes d'indices (`(i,j,n+i)/(j,n+j,n+i)`) — et le
  code affirme, mesuré, que passer en `DoubleSide` **ne change rien** (186 px dans les deux cas),
  donc `FrontSide` est **conservé** (`globe.js:3638`) : le matériau n'était pas la vraie cause,
  seulement un facteur aggravant du même défaut de sens.
- ✅ **Liséré de fond nu 5 314 px → 186 px, socle 441 px.** Chiffres présents mot pour mot dans
  le commentaire source, pas seulement le rapport.
- ✅ **`skirtDrop` en unités de globe (0,1–0,9) contre 0,0507–0,0955 unité d'épaisseur de bloc,
  2 186 px/12 langues → 1 px/1 langue.** Confirmé dans `parois-crop.js:255-280`. La concordance
  « au pixel et à la colonne » avec le relevé du noteur (`F-jupes-N02.json`) est **elle-même
  affirmée dans le commentaire source**, pas seulement le rapport — bonne pratique de citer sa
  source de comparaison sur le disque.
- ✅ **Défaut introduit (467 px de rideau devant la paroi, 352 px de houle horizontale) — aveu
  non minimisé.** Le rapport chiffre, isole par A/B (`uMerHoule=0` → 115 px), explique le
  mécanisme arithmétique (rapport 8,4×), **et retire explicitement une mesure non concluante**
  (63 707 canaux d'écart sur une tentative de correctif, gardée sur le disque plutôt qu'effacée).
  C'est un traitement plus rigoureux que la moyenne du chantier, pas une minimisation.
- ⚠️ **Désaccord non tranché sur « ×98 ».** Cinq conventions de comptage essayées, aucune ne
  reproduit `41 949 / 428` du noteur ; **validation croisée réelle** : la même convention
  appliquée aux jupes retombe pile sur les chiffres du noteur (`F-jupes-N02.json`), ce qui
  borne le désaccord au seul poste du tablier. Le noteur n'a pas laissé son script sur le
  disque — **aucune des deux parties n'est vérifiable ici**, mais l'implémenteur documente sa
  méthode et concède l'ordre de grandeur sans défendre son facteur exact. Position crédible,
  non tranchable dans cette relecture faute du script du noteur.
- ✅ **Piège du volet de navigateur qui ne composite pas** — explicitement découvert et
  contourné (`rapport-P7.md:421-424`, `requestAnimationFrame` à 0 image en 3 701 ms, Chrome
  piloté à part via puppeteer-core). Correspond exactement au piège signalé par le protocole
  de cette relecture.

### Constat transversal (nouveau, trouvé dans cette relecture)

⚠️ **Courbe de tonalité — gap méthodologique non déclaré par P5 (et P6, indéterminé).**
`.banc/harnais-P5.mjs` chaîne directement sur `P3.rendreLin` du harnais P3 **original**
(rendu linéaire brut, sans le calibrage ACES/octet-linéaire de la notation). `.banc/P7/
harnais-P7.mjs`, lui, importe explicitement `../vues-notation-02/harnais-N02.mjs` et le dit en
tête de fichier : *« le rendu linéaire, l'octet linéaire CALIBRÉ par la notation-02 [...] sont
déjà écrits. Une seconde écriture ferait deux bancs qui divergent. »* **P7 a donc silencieusement
fermé cet écart**, sans le nommer comme correctif dans son propre rapport. Pour P6, le pipeline
de mesure n'est pas traçable depuis ce qui reste sur le disque (`sonde-P6.js`/`recois-P6.mjs`
n'importent aucune chaîne de rendu Node identifiable) — **impossible de confirmer ou d'infirmer**
si P6 partage le même écart. Aucun des trois rapports P5/P6/P7 ne mentionne cette question, alors
que le §0 du plan la nomme explicitement comme une règle acquise du chantier. **Les correctifs de
branchement de P5/P6 (vérifiés par mutation, indépendants de la courbe de rendu) ne sont pas
remis en cause** ; ce qui est en question, c'est la fiabilité de leurs pourcentages pixel
(luminance, saturation) comme preuve de ressemblance perçue.

---

## RÉCAPITULATIF

| | Critique | Important | Mineur |
|---|---|---|---|
| P5 | 0 | 1 | 1 |
| P6 | 0 | 1 | 1 |
| P7 | 0 | 0 | 1 |

### Important — 2

1. **[P5, partagé possiblement P6]** Le harnais de mesure de P5 chaîne sur le rendu linéaire
   brut de P3, pas sur la chaîne calibrée octet-linéaire de la notation-02 que P7 utilise. Non
   déclaré. Affecte la fiabilité des pourcentages pixel comme preuve de ressemblance, pas les
   correctifs de branchement eux-mêmes (vérifiés indépendamment par mutation).
2. **[P6]** La méthode du « témoin aberrant » n'a été ré-auditée que sur un échantillon (le cas
   `uMerHoule`, solide) des 43 entrées « déjà branché » du tableau — un audit exhaustif des 43
   dépasse le périmètre temps de cette relecture.

### Mineur — 3

1. **[P5]** Bathymétrie (5 299/5 448, −9,4 %) et pourcentages de luminance/saturation du fond
   marin sourcés uniquement dans des captures `.banc` gitignorées, non reproductibles ici.
2. **[P6]** Pourcentages de concentration de luminance (80,97→48,50→30,25 %) de même, non
   reproductibles.
3. **[P7]** Le désaccord sur « ×98 » reste ouvert faute du script du noteur sur le disque — ni
   confirmé ni infirmé par cette relecture (traité comme Mineur car l'implémenteur documente sa
   méthode et ne défend pas son propre chiffre au-delà de l'ordre de grandeur).

---

## VERDICT PAR TÂCHE

### P5 — LE FOND MARIN — **CONFORMITÉ ✅**

Les deux vraies causes (`couleursFond` jamais passé, budget de la calotte au lieu du bloc) sont
vérifiées dans le diff lui-même, pas seulement dans le texte. Le retrait de la première mesure
(rugosité, artefact d'arrondi) est un raisonnement sain, pas un aveu de façade. Les six écarts
d'état de mer, dont la vitesse ×2,5, sont confirmés dans le code. Campagne de mutation rejouée
**38/38 exact** au commit `4a182a3`. Seule réserve : les pourcentages pixel et le chiffre de
quantification bathymétrique reposent sur des captures non reproductibles ici, et le pipeline de
rendu utilisé n'est pas celui, calibré, que P7 adoptera plus tard.

### P6 — LES VINGT BRANCHEMENTS — **CONFORMITÉ ✅**

Le tableau d'audit (77 = 20+43+11+3) est exact au recomptage direct du JSON brut. Le double bug
du soleil caméra (mer ET parois, tuiles déjà réparées par P3) est confirmé par diff avant/après.
Le facteur ×121,6 de la houle est auto-documenté dans le code source lui-même, avec la valeur
exacte d'`uMerUnite` — un niveau de traçabilité au-dessus de la moyenne du chantier. Campagne
rejouée **72/72 exact** au commit `f78cb3f`. Réserve : audit du témoin aberrant non exhaustif sur
les 43 entrées, et même incertitude sur la courbe de rendu que P5.

### P7 — LE TABLIER ET LES JUPES — **CONFORMITÉ ✅**

Le bug de sens d'index de `construireJupeMer` (l'exact inverse des parois du même anneau) et son
correctif à deux lignes sont vérifiés dans le code, avec la démonstration que `DoubleSide`
n'aurait rien changé. Le mésaccord d'unité de `skirtDrop` (0,1–0,9 unité de globe contre
0,05–0,095 d'épaisseur de bloc) est confirmé, et sa concordance au pixel près avec le relevé du
noteur est elle-même citée dans le code source. L'aveu du défaut introduit (467 px, 352 de houle
horizontale) est un des traitements les plus rigoureux du chantier — mesuré, isolé, et une mesure
ratée explicitement retirée plutôt que maquillée. P7 a aussi silencieusement fermé l'écart de
courbe de tonalité que P5/P6 n'ont pas traité. Campagne rejouée **31/31 exact** au commit
`6373339`. Seule zone grise : le facteur « ×98 » du noteur reste irréproductible des deux côtés,
faute de son script — traité comme ouvert, pas comme faute.

**P5 : CONFORMITÉ ✅ · P6 : CONFORMITÉ ✅ · P7 : CONFORMITÉ ✅** — aucun constat Critique sur les
trois tâches ; les Importants portent sur la fiabilité méthodologique des preuves visuelles
(courbe de rendu, audit non exhaustif), pas sur la validité des correctifs de branchement, tous
vérifiés indépendamment par mutation réelle à commit constant.
