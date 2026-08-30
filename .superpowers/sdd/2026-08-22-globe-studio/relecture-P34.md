# RELECTURE P3 + P4 — le globe éclairé, la mer réparée

**Relecteur indépendant · 2026-08-22 · isolation respectée** : travail dans
`C:\Dev\wt-relecP34` (worktree créé sur `git -C C:/Dev/wt-merge worktree add
C:/Dev/wt-relecP34 a4ec5b1`, `node_modules` reconstitué en **jonction** vers
`C:/Dev/wt-merge/node_modules`, jamais copié). **Retiré en partant**
(`git worktree remove C:/Dev/wt-relecP34 --force`, exécuté après ce rapport).
Aucune source modifiée dans `C:\Dev\wt-merge` ; les trois mutations que j'ai
posées dans le worktree ont toutes été **reversées** avant retrait
(`git status --porcelain` vide aux deux bouts, vérifié).

---

## CE QUE J'AI VÉRIFIÉ MOI-MÊME (pas recopié des rapports)

- **Le piège du worktree sans `node_modules` ne s'est PAS reproduit ici** :
  `node --test test/crop-eclairage.test.js` a d'abord échoué avec
  `ERR_PACKAGE_PATH_NOT_EXPORTED` sur un import annexe tant que la jonction
  n'existait pas ; une fois posée, **33/33 puis 99/99** tests s'exécutent
  réellement (durées non nulles, assertions qui échouent quand je mute — voir
  plus bas).
- **`npm test` complet : 3 946 / 3 947**, 1 échec — `occupation-sol.test.js`,
  `ENOENT public/data/sol/index.json`. Vérifié : ce répertoire n'est **pas
  suivi par git** (`git ls-files public/data/sol` vide), n'est touché par
  aucun des deux diffs, et l'échec est un manque de donnée générée absente du
  worktree frais, pas une régression P3/P4. **3 946/3 947 est donc le bon
  chiffre pour un worktree propre**, cohérent avec les 3 905 et 3 947 annoncés.
- **`npm run audit:tests` : 209/209**, aucun écart.
- **CRLF, refait moi-même** : `git diff 06b2339..0700848 --stat` et
  `--ignore-cr-at-eol --stat` rendent EXACTEMENT le même compte pour P3
  (2203/57/12, conforme au rapport). Pour P4, `git diff 3b332a7..a4ec5b1` (les
  QUATRE commits) rend **1433 insertions(+), 77 deletions(-), 8 fichiers**,
  identique avec ou sans `--ignore-cr-at-eol` (donc CRLF-propre) — **mais ce
  n'est PAS le chiffre du rapport** (voir Important P4-1).
- **Trois mutations de mon cru, ciblant le branchement**, posées dans le
  worktree isolé puis reversées :
  1. `main.js` : `paroiCouleur: `#${plinth.wallMat.color.getHexString()}`` →
     `paroiCouleur: params.plinthColor` (réintroduit exactement le bug mesuré
     par le noteur). **Tuée** par `crop-eclairage.test.js` ④g **et** ④j, avec
     un diagnostic qui pointe la ligne exacte.
  2. `main.js` : `if (terreUniqueBranchee) globe?.majReglagesMer(realWater?.reglagesMer)`
     coupé (`if (false && …)`) puis altéré (`.reglagesMerXXX`). **Tuée** les
     deux fois par `ecume-mer.test.js` ④c (recherche littérale de l'appel,
     après `setView`, sous le bon drapeau, unique). Confirme au passage que
     `main.js` n'étant chargé par aucun test, cette garde est nécessairement
     **une vérification de SOURCE**, pas d'exécution — limite ancienne et
     assumée du dépôt (le commentaire `__exp` le dit depuis la Tâche 1b bis),
     pas un défaut propre à P4.
  3. `globe.js` : `float partBloc = uEclairageOn > 0.5 ? dedansCrop : 0.0;` →
     `float partBloc = dedansCrop;` (retire la garde). **Tuée** par
     `crop-eclairage.test.js` ⑤c.
  **Zéro survivante sur mes trois mutations.** Aucun code mort trouvé.
- **Captures regardées** (`.banc/vues-P3/`, `.banc/vues-P4/`) : le triptyque
  P3 (`P3-SURFACE-CROP-nu-P2.png` → `-eclaire.png` → socle apparié) montre un
  vrai ombrage gagné (versant à l'ombre visible, eau qui prend un modelé) mais
  un crop toujours nettement moins riche en couleur que le socle — cohérent
  avec le texte, **pas embelli**. Le triptyque P4 (`H1-AVANT` → `F1-CROP` →
  `F1-SOCLE-apparie`) montre l'écume en plaques dures disparaître, remplacée
  par des bandes pâles à bords droits que le rapport attribue au relief du
  fond marin (hors tâche) — l'image confirme cet aveu au lieu de le cacher.
  L'A/B `Z4-SOCLE-avec-jupe-est.png` / `-sans-jupe-` montre un changement net
  et localisé exactement à la jonction mur/mer quand la jupe est masquée :
  soutient la thèse du manque n° 4.
- **Le raisonnement du plancher de bruit (P4 §4), vérifié terme à terme** :
  323 405/1 024 000 = 31,58 % (ancien vs nouveau) contre 341 000/1 024 000 =
  33,28 % (nouveau vs nouveau, deux chargements). Le second nombre EST bien le
  plancher d'une mesure bit-à-bit PLEIN CADRE, protocole différent du 1,1 %
  d'écart sur l'écume seule (masque restreint, témoin socle appairé) et du
  ~2,2 % cité ailleurs pour le grain de bruit inter-chargement sur une autre
  grandeur : **ce sont trois mesures différentes, sur des dénominateurs
  différents, et le rapport ne les confond pas** — il utilise le 33,28 %
  uniquement pour retirer LA preuve bit-à-bit plein cadre, et garde le couple
  1 923/1 945 (mesure comparable, masque étroit) pour la conclusion réelle.
  **Le raisonnement tient. C'est exemplaire.**
- **Code source confirmé pour les trois affirmations-clés de P3** :
  `globe.js:11777-11778` de `main.js` (sic, en fait `main.js:11777`) montre
  `_orbSun.copy(camGlobe.position)…` **toujours actif**, mais UNIQUEMENT pour
  le rendu de fond (`frontiereActive && modes.mode === 'surface'`/orbital) —
  le crop lui-même utilise désormais `uSoleilDir` dérivé de
  `directionSoleilLocale(soleilAzimut, soleilElevation, centreLat, centreLon)`
  dans `poserHabillage` (`globe.js:2963`), un uniforme SÉPARÉ de `uSunDir`.
  `three.module.js:16785-16788` confirme mot pour mot l'écrasement
  `envMapIntensity` par `scene.environmentIntensity` cité par le rapport, et
  `terrain.js` ne fixe jamais `envMap` sur le matériau de base. Le gabarit
  `shibustart.json` porte bien `surfaceFx:9`, `opacity:0.44`, `blend:2`,
  `colA:#14161d` — identique aux valeurs citées.
- **Code source confirmé pour les affirmations-clés de P4** : `ocean.js:565`
  utilise bien `POIDS_RESSAC=1.8`/`POIDS_LISERE=1.1` importés de
  `ecume-mer.js`, où ils sont documentés identiques des deux côtés.
  `globe.js:421` utilise maintenant `vLocal / uMerUnite * FREQ_TAVELURE`
  (l'ancien bug `/uMerLambda*0.08` a disparu du fragment vivant).
  `mer-sphere.js:380` (`dBord = pn - uCropCoin + min(max(q.x, q.y), 0.0)`)
  confirme le correctif signé ; `uCropCoin: {value: 0}` confirme le défaut à
  zéro cité comme preuve que l'ancienne mesure était structurellement muette
  à l'intérieur. `ocean.js` bâtit bien un maillage séparé `renderOrder=16`
  (jupe) sous la surface `renderOrder=18`, et `construireJupeMer` dans
  `mer-sphere.js` réplique le même patron avec `RETRAIT_EAU_CROP` dérivé de
  `plinth.js` (0,16+0,06)/(28) — la cohérence des deux retraits est vérifiable
  dans le texte, pas seulement affirmée.
- **Le test ⑪b réécrit vérifie le bon sens** (`b.fin < 0`, mer qui RENTRE),
  et son propre commentaire admet explicitement l'ancien piège
  (« CE TEST ENCODAIT LE SIGNE INVERSE ») — pas une réécriture qui mord sur un
  mauvais comportement.
- **Les aveux de P4 (réserves) sont chiffrés, pas minimisés** : l'état de mer
  non branché est chiffré (`chop 0,7/1`, `uFoamScale 0,35/1`, facteur 5,8× sur
  les moutons) : conforme au code (`contexteCrop().mer` ne passe effectivement
  aucun des cinq champs d'état de mer — vérifié : `mer:` dans `contexteCrop`
  ne porte que `altitudeM`, `remplir`, `portee`, `couvertureMin`,
  `exigerBathy`, `fovDeg`, `hauteurPx` — aucun de `chop/houle/foam/foamScale/
  lenScale`). La limite des 3 km est expliquée par une cause concrète
  (`controls.minDistance = 6`), pas juste déclarée.

---

## CONSTATS

### Critique — 0 pour P3, 0 pour P4

Aucun constat de gravité Critique : les trois affirmations-clés de P3 et les
trois de P4 (plus les seize chiffres retirés/bornés et le raisonnement sur le
plancher de bruit) résistent à la lecture du code source, à l'exécution réelle
des tests, et à mes propres mutations.

### Important — 2

1. **[P3] §5, l'affirmation « cinq d'entre eux divisent l'écart par plus de
   deux » est FAUSSE, recalculée depuis les propres pourcentages publiés par
   le rapport.** Ratios |avant|/|après| : luminance 12,3/1,0 = **12,3×** ·
   écart-type luminance 64,3/6,4 = **10,05×** · saturation 24,0/14,4 =
   **1,67×** · écart-type saturation 49,7/11,0 = **4,52×** · neutres
   40,7/20,7 = **1,97×** · détail 29,3/19,6 = **1,49×**. Seuls **trois**
   critères (luminance, écart-type luminance, écart-type saturation)
   dépassent ×2, pas cinq. « Six sur sept se rapprochent » reste exact. Ceci
   ne remet pas en cause le fond (l'accord d'exposition tient, la luminance
   passe de −12,3 % à +1,0 %), mais c'est un chiffre inventé — exactement le
   genre d'erreur que ce chantier se donne pour règle de traquer.
2. **[P4] §7 « Clôture », le compte CRLF cité (« 1 237 insertions, 76
   suppressions, 8 fichiers ») ne correspond qu'au PREMIER des quatre commits
   de la tâche (`3b332a7..5897c97`), pas à l'ensemble annoncé en tête de
   rapport (`3b332a7..a4ec5b1`).** Recalculé moi-même : le compte réel sur les
   quatre commits est **1433 insertions(+), 77 deletions(-), 8 fichiers**,
   identique avec `--ignore-cr-at-eol` (donc toujours CRLF-propre — la
   substance du contrôle n'est pas fausse, seul le chiffre cité est resté
   celui d'un état intermédiaire non remis à jour après les tours 2, 3 et 4
   de la campagne de mutation).

### Mineur — 2

1. **[P3]** Cinq métriques sur sept franchissent zéro entre « nu » et
   « éclairé » (luminance, saturation, écart-type de saturation, neutres,
   détail), pas seulement les deux nommées « ne s'améliorent pas » (neutres,
   saturation). Le rapport ne cache pas le dépassement pour ces deux-là, mais
   ne signale pas que l'écart-type de saturation (49,7 %→−11,0 %) traverse
   aussi zéro avec une magnitude comparable. N'invalide rien, aurait mérité
   une phrase.
2. **[P4]** La garde de branchement sur `main.js` (④c d'`ecume-mer.test.js`,
   et son équivalent pour `paroiCouleur`/`soleilAzimut` dans
   `crop-eclairage.test.js`) reste une vérification de SOURCE, pas
   d'exécution — inévitable puisque `main.js` n'est chargé par aucun test
   (limite ancienne du dépôt, pas introduite par P3/P4). Mes mutations
   montrent que ces gardes attrapent bien un texte altéré, déplacé ou sous
   mauvais drapeau ; elles n'attraperaient pas un renommage de variable qui
   pointerait vers le mauvais objet en gardant un texte plausible. Risque
   théorique, non exploité ici, déjà nommé par les rapports eux-mêmes.

---

## VERDICT PAR TÂCHE

### P3 — L'ÉCLAIRAGE DU BLOC — **CONFORMITÉ ✅**

Les trois affirmations qui corrigeaient le brief (soleil = caméra, ambiante à
~47 % avec `envMapIntensity` mort, `surfaceFx:9` × 0,59) sont toutes vérifiées
dans le code vivant du commit `0700848`, pas seulement dans le texte du
rapport. La sonde d'ambiante est une mesure réelle (régression linéaire sur
`N·haut`, retrait du spéculaire par soustraction, cache par identité de
texture), pas une constante déguisée. Les tests s'exécutent réellement
(33 nouveaux, 3 946/3 947 sur l'ensemble, écart expliqué et hors périmètre) et
résistent à trois mutations de branchement indépendantes des miennes. Le seul
défaut trouvé est une erreur arithmétique dans le tableau de synthèse du §5
(Important n° 1), qui ne change pas la conclusion mais aurait dû être vraie.

### P4 — LA MER — **CONFORMITÉ ✅**

Les trois affirmations qui corrigeaient le brief (constantes innocentes, quatre
entrées coupables dont la tavelure en mauvaise monnaie, jupe manquante comme
vraie cause du manque n° 4, correctif de signe qui a d'abord tout effacé à
cause de `cq = max(…,0)`) sont vérifiées dans le code du commit `a4ec5b1` et
confirmées par une A/B écran convaincante (masquage de la jupe du socle). Le
retrait de la preuve bit-à-bit (16ᵉ chiffre retiré) est un raisonnement
correct et rigoureux, pas un aveu de façade. Les réserves (état de mer non
branché, 3 km non atteint) sont chiffrées et honnêtes, vérifiées dans le code
(`contexteCrop().mer` ne porte aucun des cinq champs d'état). Le seul défaut
trouvé est un chiffre de clôture (§7 CRLF) resté celui du premier des quatre
commits au lieu de l'ensemble livré — la substance du contrôle (pas de faux
diff CRLF) reste vraie sur mon propre recalcul.

---

## RÉCAPITULATIF

| | Critique | Important | Mineur |
|---|---|---|---|
| P3 | 0 | 1 | 1 |
| P4 | 0 | 1 | 1 |

**P3 : CONFORMITÉ ✅ · P4 : CONFORMITÉ ✅**, tous deux avec réserve mineure
notée ci-dessus (à corriger dans les rapports, pas dans le code).
