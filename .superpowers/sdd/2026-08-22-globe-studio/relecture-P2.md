# Relecture — Tâche P2 : le peigné du relief passe sur la sphère

**Relecteur indépendant · worktree isolé `C:/Dev/wt-relecP2` @ `06b2339`, retiré en
partant (`--force`) — CONFIRMÉ RETIRÉ, aucune source touchée dans `C:/Dev/wt-merge`.**
**`node_modules` : jonction ajoutée pour l'exécution (mirroir de la méthode du rapport
lui-même) ; sans elle, aucun test ne tournait — le piège du 42/42 fantôme a été vérifié
et évité : `npm test` a réellement tourné (32,3 s, chronos réels, pas instantané).**

---

## VERDICT GLOBAL

**Le geste d'extraction est réel, la découverte technique (`hNorm` ≠ `hNormRelief`) est
vraie et vérifiée au code et à l'arithmétique, l'architecture est propre, la campagne de
mutation mord réellement — y compris sur trois mutations de mon cru visant le
branchement, plus une quatrième visant directement la découverte centrale (`hNormRelief`
→ `hNorm`), toutes tuées.** La correction de `notation-01` sur le compositeur est
également vraie et vérifiée dans le code (`main.js`).

**Mais le chiffre le plus mis en avant de l'Étape 1 — « cadrages appariés à 0,009 %,
cent fois mieux que le 1 % demandé » — n'est PAS reproductible depuis la donnée brute
citée par le rapport lui-même** (`cadrage-apparie.json`). C'est exactement le défaut
endémique nommé au §0 du plan (mélange de dénominateurs), et il touche le chiffre-titre
d'une étape explicitement obligatoire du brief. La conclusion de fond (les cadrages sont
bien appariés, largement sous la barre de 1 %) reste vraie — mais avec le vrai chiffre
propre du fichier (≈0,05 %), pas celui publié.

## CONFORMITÉ ❌

(Non-conformité limitée à un point Critique isolé — voir décompte. La tâche livre
l'essentiel de ce qui était demandé et n'a pas besoin d'être refaite ; le point Critique
appelle une correction du rapport, pas du code.)

---

## Décompte par gravité

- **Critique : 1**
- **Important : 3**
- **Mineur : 4**

---

## Constats

### Critique

- **C1 — Le chiffre-titre de l'appariement de cadrage (« 0,009 % ») mélange deux
  mesures distinctes, et « dix essais consignés » est faux.** `.banc/vues-P2/cadrage-apparie.json`
  ne contient que **cinq** essais (k = 1,262/1,264/1,266/1,268/1,27), pas dix. Pour
  k = 1,266, le fichier lui-même calcule `ecartPct: -0,05` (contre son propre
  `cropPixelsBloc: 251258`) — recalcul indépendant confirmé : (251135−251258)/251258 =
  −0,0489 % ≈ −0,05 %. Le rapport publie **−0,009 %** pour la même paire
  (k = 1,266, pixels = 251 135), ce qui exige une référence ≈ 251 157 — **le chiffre de
  `bilan-final-P2.json` (`fractionBloc.changes = 251157`), pris ~15 minutes plus tard,
  dans une mesure séparée.** Les AUTRES lignes du même tableau du rapport (ex. k = 1,27 →
  −0,67 %) collent, elles, exactement au calcul du fichier avec sa propre référence
  (251 258) : recalcul (249585−251258)/251258 = −0,666 % ≈ −0,67 %. **Seule la ligne
  retenue (k = 1,266, celle qui sert de preuve pour toutes les captures appariées)
  substitue une référence plus favorable, non déclarée comme telle.** Résultat : la
  précision réellement traçable au disque est **~0,05 %** (20× mieux que le 1 % demandé,
  pas 100×). Le seuil du brief (1 %) reste largement respecté, donc les comparaisons
  visuelles restent valides — mais le chiffre publié n'est pas celui que sa propre source
  donne, exactement le défaut nommé au §0 du plan (« tout chiffre remonte à une donnée
  brute... un chiffre retiré vaut mieux qu'un chiffre faux »).

### Important

- **I1 — La correction de `notation-01` sur le compositeur est vraie, et P2 avait
  vraiment sur-attribué.** Vérifié dans `src/main.js` : l'`EffectPass` de gradation
  (exposition/contraste/saturation, ligne 2430) est ajouté à la fin de la chaîne, et
  `composer.addPass(passeFond, 0)` (`main.js:4412`) insère `sceneGlobe` — le crop — en
  TÊTE, donc avant cette passe finale. Le crop traverse donc la MÊME gradation que le
  socle. P2 avait rangé « il passe par le compositeur » dans la liste des causes de
  l'écart visuel (§0.1 et §9) ; ce n'est pas un facteur différentiel. La conclusion de
  fond de P2 (« aucune rampe ne comblera cet écart », l'écart venant du matériau éclairé
  contre une couleur nue) reste vraie et confirmée par la mesure de `notation-01`
  (rampe et analyse sont le même objet three des deux côtés).

- **I2 — Le coût de LIAISON des deux samplers ajoutés reste un angle mort réel, pas
  seulement un aveu de forme.** L'auteur le dit explicitement plutôt que de deviner un
  chiffre (`nonMesure` dans `cout-P2.json`, confirmé mot pour mot). Mais la Tâche C a
  montré que ce poste-là domine le coût du socle (0,660 ms sur 1,087 pour douze liens) et
  qu'il se paie **par tuile** sur une sphère — donc potentiellement plusieurs fois le
  +0,039 ms/Mpx mesuré ici. C'est un aveu honnête ET un vrai risque de coût non quantifié
  pour la suite du chantier ; à ne pas refermer sans mesure dédiée (deux builds, comme
  l'auteur le propose).

- **I3 — La campagne ABBA retenue est statistiquement correcte mais l'effet est faible
  (2,6 σ), et la médiane nulle mérite d'être prise au sérieux.** Vérifié dans
  `cout-P2.json` : 400 paires réelles (tableaux `A`/`B` de 400 valeurs chacun), moyenne
  +0,0395 ms, écart-type 0,300, erreur type 0,0150 → 2,633 σ. C'est au-dessus du bruit
  mais loin d'être écrasant (p ≈ 0,009 sous hypothèse de normalité) ; la médiane exactement
  nulle et la distribution asymétrique (Q1 = −0,10, Q3 = +0,20) sont compatibles avec un
  petit nombre de valeurs hautes (pauses GPU/driver) plutôt qu'un coût de calcul
  systématique. Le rapport le dit lui-même honnêtement (« il faut le dire ») — je ne
  demande pas de refaire la mesure, seulement de noter que 2,6 σ ne devrait pas être cité
  ailleurs comme un fait établi sans ce garde-fou.

### Mineur

- **M1 — Le geste d'extraction (module pur, injection GLSL partagée, test d'unicité) est
  vérifié et mord réellement**, mais je n'ai pas re-fait moi-même le pixel-diff du socle
  (`git stash` × 3 chargements) : cela demande un navigateur/GPU que je n'ai pas ici. La
  preuve indirecte est bonne (le test `②e` de `crop-rampe.test.js`, « SANS `poserRampe`,
  LE GLOBE EST CELUI D'AVANT — au bit près », passe réellement ; la lecture du diff montre
  que la branche par défaut de `hNorm`/`t` n'est pas altérée, seulement nommée). Je
  recommande de faire confiance à cette preuve plutôt que de la refaire, mais je ne peux
  pas signer un « bit-identique » de première main.

- **M2 — Petit écart interne entre deux mesures du même poste** (`bilan-final-P2.json`
  `ab.changes = 101414` vs `postes-P2.json` `total.changes = 101423`, écart de 9 px /
  0,009 point de %). Sans conséquence sur la conclusion (le rapport cite la seconde,
  cohérente avec son propre dénominateur de bloc), mais c'est le même genre de
  non-déterminisme WebGL entre deux passes que le rapport documente ailleurs
  (`SOCLE-P2-A`, canevas 1088×680 vs 1280×800) — pas signalé ici, aurait dû l'être en une
  ligne pour éviter toute impression de précision plus grande que la réalité.

- **M3 — La monnaie des chiffres de l'Étape 3 est cohérente**, vérifié : `postes-P2.json`
  donne `denominateurBloc: 251157` = `bilan-final-P2.json` `fractionBloc.changes: 251157`
  = le témoin nul « cacher le globe change 251 157 pixels » du rapport. **40,38 % du bloc**
  et **9,90 % du cadre** utilisent la même paire cohérente de dénominateurs
  (101 423/251 157 et 101 423/1 024 000). Aucun mélange ici — seul C1 (le cadrage) pose
  problème.

- **M4 — La découverte centrale (`hNorm` ≠ `hNormRelief`) est vérifiée par le calcul, pas
  seulement crue sur parole.** Recalcul indépendant avec les valeurs mêmes du rapport
  (pivot = 0,65, contraste = 2,5, `uLandMax` = 2 584,4 relevé) : le seuil « rampT = 0 sous
  1 163 m » sort EXACTEMENT de `pivot − 0,5/contraste = 0,45` en hNorm-terre, soit
  `0,45 × 2584,4 = 1163,0 m`. Coïncidence trop exacte pour être fabriquée — la trouvaille
  est réelle. Sur la méthode (« c'est la comparaison appariée qui l'a révélé, pas les
  tests ») : plausible et cohérent avec la chronologie du rapport — le test `⑤d` qui
  verrouille `hNormRelief` a manifestement été écrit APRÈS coup pour encoder le correctif,
  pas avant pour le détecter. Je l'ai confirmé en mutant `hNormRelief` → `hNorm` dans
  `globe.js` : `⑤d` tue la mutation aujourd'hui, mais rien dans la suite AVANT l'ajout de
  P2 n'aurait pu le faire — c'est un vrai enseignement de méthode pour le chantier, pas
  une clause de style.

---

## Détail des vérifications faites (pour traçabilité)

- **Pureté du module** : `grep -niE "import|require\(|three|document|window\."
  src/monde/naturel-crop.js` → aucune importation réelle (seules des mentions en prose).
  Confirmé.
- **Injection partagée** : `GLSL_NATUREL` importé et injecté tel quel dans `terrain.js:892`
  ET `globe.js:828`. Confirmé.
- **Test d'unicité `③b` mord** : injection d'une formule dupliquée
  (`clamp(0.5 + (anl.r - 0.5) * 3.0, 0.0, 1.0)`) dans `globe.js` → le test échoue
  immédiatement. Reverté, suite repropre.
- **Trois mutations de branchement personnelles, toutes tuées** :
  1. retrait de `'hemi'` de `CHAMPS_HABILLAGE` → `④b` échoue.
  2. `u.uAnalysisOn.value = 1` (garde contournée) → `④c` échoue.
  3. `contexteCrop` lit `uAnalysis` sans passer par `uAnalysisOn` → `④a` échoue.
  4. (bonus, visant la trouvaille elle-même) `hNormRelief` → `hNorm` dans le bloc de
     rampe → `⑤d` échoue.
- **34/34 mutations du rapport confirmées sur disque** (`resultat-mutations-P2.json` :
  `{total:34, tues:34, survivantes:[]}`), script `.banc/mutations-P2.mjs` réellement
  présent, 20 des 34 mutations visent bien le branchement (fil, veille, poseurs,
  constructeur), pas la loi.
- **Coût (§Étape 5)** : `cout-P2.json` reproduit exactement moyennes/médianes/quartiles
  publiés, N = 400 paires réelles, calcul de σ vérifié (2,633).
- **CRLF** : `git diff --stat` vs `git diff --ignore-cr-at-eol --stat` sur
  `a0e0499..06b2339` → identiques (1 523/68/9). `core.autocrlf = false` confirmé dans le
  dépôt (donc le raisonnement du rapport sur ce point est correct, et diffère à raison de
  l'avertissement générique du §0 du plan sur `autocrlf=true`).
- **Suite complète** : `npm test` → **3 871/3 872** en 32,3 s réelles (1 échec :
  `test/occupation-sol.test.js`, `ENOENT public/data/sol/index.json`, fichier généré
  gitignored absent d'un worktree neuf, sans rapport avec ce diff — confirmé par
  `git log` : dernière modification du test antérieure à P2). `npm run audit:tests` →
  **207/207, aucun écart**, conforme au rapport.
- **Captures** : `FINAL-CROP-AVANT.png` / `FINAL-CROP-APRES.png` inspectées — écart
  net et honnête (dégradé lisse sans grain vs crêtes peignées, ravines creusées, couronne
  blanche, fonds de vallon humides) ; les plaques blanches sur la mer, déjà présentes sur
  l'AVANT, ne sont pas maquillées. Aucune embellissement détecté — le rapport ne surjoue
  pas ses propres captures.

---

## Ce que je n'ai pas pu vérifier de première main

- Le pixel-diff « socle bit-identique » (§6 du rapport) demande un rendu GPU/navigateur
  réel avec `git stash` en direct ; je m'appuie sur les tests unitaires passants
  (`crop-rampe ②e`) et la lecture du diff plutôt que sur une réplique complète.
- Les mesures visuelles de `notation-01` (histogrammes de teinte, énergie de détail) n'ont
  pas été refaites — seule la correction ponctuelle sur le compositeur (I1) a été
  vérifiée au code, parce que c'est elle que la mission demandait de trancher.
