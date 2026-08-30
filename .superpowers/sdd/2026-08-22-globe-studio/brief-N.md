### Tâche N — LE CROP SEUL ⚠️ CONSIGNE D'ADRIEN, EN PREMIER

**Adrien, 2026-08-22 :**

> *« Tout ce qui est en dehors du crop ne doit pas s'afficher. Ça ne s'affiche que si on
> dézoome, puis ça recrop quand la vue est stabilisée. On ne calcule donc pas les éléments
> hors crop sauf si dézoom ou zoom pour faire la transition. »*

**Trois exigences, et la troisième est la plus lourde :**

1. **Au repos, seul le crop est visible.** Rien autour.
2. **Pendant un mouvement de zoom, les alentours réapparaissent** — c'est la transition.
3. ⛔ **ET SURTOUT : on ne les CALCULE PAS au repos.** Pas seulement « invisibles » :
   **pas dessinés, pas maillés, pas chargés.** C'est une exigence de COÛT, pas d'affichage.

#### Ce que le dépôt fait aujourd'hui, et pourquoi ça ne suffit pas

- **La Tâche A** pose un `discard` par lat/lon dans le nuanceur : hors crop, **le fragment
  est jeté**. ⚠️ **Mais la tuile est quand même chargée, maillée, et soumise au GPU** —
  seul le pixel meurt. **Le coût, lui, est payé.**
- **La Tâche G** (l'estompage) fait l'inverse : elle **DESSINE** la Terre autour puis la fond
  vers le fond. ⚠️ **C'est elle qui rend les alentours visibles au repos** — et
  l'implémenteur de K a mesuré que **pendant le fondu plus rien n'est `discard`é et toutes
  les tuiles résidentes passent en chemin trié/transparent.**
  ➡️ **La consigne d'Adrien inverse la logique de G : l'estompage devient un état de
  TRANSITION, pas un état de repos.**
- **La Tâche K ter** vient de faire lâcher le crop à l'orbite (`veilleCrop.poserMode`).
  **Le mécanisme de bascule existe donc déjà — sers-t'en, ne le refais pas.**

#### Ce qu'on attend

- [ ] **Étape 1 — la mesure AVANT.** Au repos, à une altitude de bloc : **combien de tuiles
      sont chargées, maillées, dessinées ?** Combien sont **entièrement hors crop** ?
      **Chiffres avec source, données brutes dans `.banc/`.** ⚠️ **C'est ce chiffre qui dira
      si la tâche a servi — sans lui, tu ne pourras rien prouver.**
- [ ] **Étape 2** — test rouge.
- [ ] **Étape 3 — implémenter.** ⚠️ **Le quadtree doit cesser de PARCOURIR ce qui est hors
      crop au repos** (`_traverse`, `src/globe.js`), pas seulement de le peindre. Et le cache
      ne doit pas évincer ce qu'il faudra pour la transition — **sinon chaque dézoom
      redéclenchera un chargement, ce qu'Adrien refuse explicitement.**
- [ ] **Étape 4 — la stabilisation.** *« ça recrop quand la vue est stabilisée »* : il faut un
      critère de repos. ⚠️ **ATTENTION AU CLIGNOTEMENT** — un critère trop nerveux fera battre
      les alentours à chaque micro-mouvement. **Mesure l'hystérésis, ne la devine pas.**
      Précédent utile : le seuil du socle a produit **onze bascules là où il en fallait une**,
      et c'est documenté dans `main.js`.
- [ ] **Étape 5** — mutation sémantique **visant le BRANCHEMENT**, worktree à part,
      **banc dans `.banc/`**.
- [ ] **Étape 6 — REGARDER L'ÉCRAN** : repos → dézoom → repos. **Captures dans `.banc/vues-N/`.**
- [ ] **Étape 7** — clôture, page chargée drapeau levé ET baissé.

⚠️ **CE QUE TU NE DOIS PAS CASSER :** l'estompage de la Tâche G est **mesuré, relu et
validé**. Tu changes **quand** il s'applique, **pas sa loi**.
