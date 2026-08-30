# Tâche P2 — LA TEXTURE : le peigné du relief passe sur la sphère

> **Adrien, 2026-08-22 :** *« Je voudrais qu'on arrive à retrouver la texture comme elle était
> avant de faire la modification vers la sphère. Pour l'instant le détail est trop basique. »*

**C'est SA demande la plus forte, et c'est l'écart entre ses deux captures.**

## ⚠️ POURQUOI C'EST FAISABLE AUJOURD'HUI ET PAS HIER

**L'interdiction D5 est levée** (D13 : *« tu peux modifier tout ce que tu veux »*). Le texture
shading vivait dans `terrain.js` / `terrain-analysis.js`, **hors d'atteinte**. Il ne l'est plus.

## LE DIAGNOSTIC, DÉJÀ MESURÉ — n'y reviens pas, sers-t'en

La **Tâche C** a mesuré que les quatre postes d'habillage portés sur le globe **ne déplacent
que 1,01 % des pixels**, témoin à zéro, et a écrit :

> *« Ce qui fait la richesse de l'image du socle, c'est le TEXTURE SHADING et la rampe locale.
> Le porter coûterait 1,94 ms/Mpx au tarif complet ; sa part seule reste à mesurer. »*

➡️ **On a porté l'emballage et laissé le contenu. Ta tâche est le contenu.**

## L'ÉTAT DES LIEUX, VÉRIFIÉ

### `src/terrain-analysis.js` — 546 lignes, et ⚡ **AUCUN `import`**
**C'est déjà un module pur.** Il produit une **texture RGBA empaquetée** via
`packAnalysis({ texShade, hillshade, wetness, aspect }, size)` (l.327-335), et
`encodeTextureShade` (l.538). Son en-tête décrit `texShade` comme *« le peigné des crêtes,
laplacien FRACTIONNAIRE de Leland »*.
⚠️ **Il n'y a donc RIEN à extraire ni à copier : il est déjà réutilisable tel quel.**

### Comment `terrain.js` le consomme
- Uniformes : **`uAnalysis`** (`terrain.js:412`, défaut `neutralTexture()`) et
  **`uAnalysisOn`** (l.413).
- Déclarés dans le nuanceur l.516-517, **lus l.1063-1066** (`anl = texture2D(uAnalysis, anUv)`)
  et **l.1092** (`if (uAnalysisOn > 0.5 && uTexShade > 0.001)`).
- Calculé **hors du fil principal** (l.3075).

### Ce que le globe a déjà — la forme est identique
`uCoastMask` / `uCoastMaskOn` (`globe.js:690-691`, `1756-1757`) et `uSol` (l.693, 1759) sont
**exactement le même patron** : une texture + un interrupteur.
⚠️ **Le commentaire `globe.js:714` compte les samplers** : *« pour un plafond de seize :
celui-ci fait six »*. **Vérifie où en est ce compte avant d'ajouter.**

### Le trou, nommé par l'inventaire
`contexteCrop()` (`src/main.js`) **ne transmet AUCUNE texture d'analyse** — seuls `coastMask`
et `sol` passent. Et `habillage-crop.js:86` **mentionne** que `uAnalysis` partagerait la même
loi d'UV : ⚠️ **il ne l'implémente pas.**

## Ce qu'on attend

- [ ] **Étape 1 — la mesure AVANT**, au cadrage du socle de production (drapeau baissé) contre
      le crop. **Combien de pixels séparent les deux images ?** ⚠️ **ET LE PIÈGE DE CADRAGE :
      `applyIsoView` dérive de `controls.maxDistance`, donc crop et socle N'OCCUPENT PAS la
      même fraction du cadre. Apparie-les et PROUVE-le (fraction du cadre à 1 % près) avant
      toute comparaison** — sinon tu mesures du cadrage, pas du rendu.
- [ ] **Étape 2** — test rouge.
- [ ] **Étape 3 — porter.** Calculer l'analyse sur l'emprise du crop, la faire passer par
      `contexteCrop`, ajouter les deux uniformes, **transcrire le bloc d'ombrage de
      `terrain.js:1063-1092`**. ⚠️ **Transcris, ne réinvente pas** — le patron du chantier est
      la transcription exacte avec conversion d'unités documentée (la Tâche F a transcrit la
      rampe nautique « au bit près » et le relecteur l'a vérifiée).
      ⚠️ **L'UV : `habillage-crop.js` a DÉMONTRÉ que le crop et le bloc plat partagent la même
      loi d'UV par construction géométrique (`x = 28·u`, « pas une coïncidence »). Sers-t'en.**
- [ ] **Étape 4 — les quatre curseurs MORTS.** `mapTint`, `heightContrast`, `heightPivot`,
      `slopeTint` : **`rampe-crop.js` n'en lit AUCUN.** Et les sept sous-réglages d'Atlas
      (`texShade`, `wetK`, `expoK`, `treeLine`, `hazeAmt`, `rampDry`, `rampWet`) ne passent pas
      non plus. **Rends-les vivants, ou dis lesquels tu laisses et pourquoi.**
- [ ] **Étape 5 — le COÛT.** La Tâche C annonce **1,94 ms/Mpx au tarif complet, part du
      texture shading NON mesurée**. ⚠️ **Et elle a trouvé que le coût du socle est SURTOUT
      FIXE : 0,660 ms sur 1,087 sont les DOUZE LIENS DE TEXTURE, pas le calcul — payés PAR
      TUILE sur une sphère.** **Mesure ce que ton portage coûte réellement par tuile.**
- [ ] **Étape 6** — mutation sémantique **visant le BRANCHEMENT**, worktree à part,
      **banc dans `.banc/`**.
- [ ] **Étape 7 — REGARDER L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE**, cadrages appariés.
      **Captures dans `.banc/vues-P2/`.**
- [ ] **Étape 8** — clôture, page chargée drapeau levé ET baissé.

## Ce que tu ne fermes pas

Les matières des parois (50 vignettes orphelines), le cartouche, les effets de surface, le
scanner. **Ce sont d'autres tâches.** ⚠️ **Sept tâches de ce chantier ont écrit « non, ça ne
ressemble toujours pas au socle » plutôt que de conclure au succès — c'est ce qui a rendu
leurs rapports utilisables.**
