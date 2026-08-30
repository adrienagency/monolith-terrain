#### Tâche K — LA CONTINUITÉ DE TEXTURE ⚠️ CE QUI FERME LES ARÊTES DROITES

**Fichiers :** `src/globe.js` (nuanceur de fragment), tests.

- [ ] **Étape 1 — la mesure AVANT.** Reprendre le protocole d'élimination de la Tâche G en
      **gelant `minFade` puis le terme `vUv` du grain tour à tour**, pour savoir **laquelle
      des deux sources domine**. ⚠️ **Cette mesure n'a jamais été faite : ne pas la sauter.**
- [ ] **Étape 2 — désindexer.** `minFade` : remplacer la mesure locale
      `fwidth(vUv) * uTilePx` par une grandeur **continue** (dérivée de `vLatLon` ou d'une
      distance-caméra), **indépendante du zoom de la tuile**. Le grain de papier : l'indexer
      sur une coordonnée continue, **exactement comme l'habillage le fait déjà avec `qCrop`**.
- [ ] **Étape 3 — mutation sémantique**, worktree à part.
- [ ] **Étape 4 — REGARDER L'ÉCRAN**, même cadrage qu'avant/après, **témoin exigé**.
- [ ] **Critère : une frontière de niveau ne doit plus se lire comme une arête droite.**
      ⚠️ **Ce que cette tâche NE ferme PAS, et qu'elle ne doit pas prétendre fermer :** la
      résolution réelle de la donnée diffère par niveau (fait de la source), et **le crop
      impose un zoom prescrit uniforme, donc un saut non borné à sa frontière.**

