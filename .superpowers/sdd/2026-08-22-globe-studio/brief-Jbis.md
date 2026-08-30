### Tâche J bis — LA BATHYMÉTRIE DANS LA SURFACE DU CROP ⚠️ AVANT K

**Fichiers :** `src/globe.js` (`_buildMesh`/`posAt`, le nuanceur), `src/main.js`
(`contexteCrop`), `src/monde/*`, tests.
⛔ **Interdit : `terrain.js`, `plinth.js`, `ocean.js`.**

**Le défaut, établi par élimination par la Tâche J et non supposé :**

> Au-dessus de ~20 km la mer se lit en **taches bleues et vertes**. Mer cachée → le fond du
> crop est **un plateau vert uniforme**. Houle et clapot à zéro → **le marbrage disparaît
> entièrement**. Les creux de houle (**73 m mesurés**) passent **derrière** un fond marin
> rendu **à l'altitude ZÉRO**.
>
> ➡️ **LE CHAMP DE LA MER A UN FOND ; LA SURFACE DU CROP N'EN A PAS.** C'est ce désaccord
> qu'on voit.

**Trois sorties nommées par la Tâche J, aucune mesurée :**

1. **La bathymétrie dans les tuiles du crop** — la surface porte le relief sous-marin, donc
   les deux surfaces s'accordent. ⭐ **C'est la seule qui répare la CAUSE ; les deux autres
   masquent le symptôme.** ⚠️ Prix à établir : les tuiles terrarium portent-elles des valeurs
   négatives exploitables, ou faut-il fusionner `bathy.js` dans les hauteurs du quadtree ?
   **`bathy.js` opère en lat/lon, il est donc portable — c'est le point d'entrée qui manque.**
2. **La houle coupée** au-dessus d'une altitude — supprime le marbrage sans donner de fond.
   ⚠️ **Attention : la Tâche F a mesuré `ΔE = 0` à 6,4 km et `0,10` à 12,7 km entre la mer
   riche et la mer plate — la houle ne se lit PAS aux altitudes du bloc.** Donc la couper
   haut coûterait peu. **Mais ça ne répare rien.**
3. **`depthTest: false`** sur la nappe — ⛔ **le plus dangereux** : la mer passerait devant
   tout, y compris devant la terre qui devrait la cacher.

**Ce qu'on attend :** **choisir la sortie 1 si elle est atteignable, et le DIRE si elle ne
l'est pas.** Une tâche qui rend « la cause est hors de portée pour telle raison mesurée, voici
le palliatif et son prix » vaut mieux qu'une tâche qui maquille.

- [ ] **Étape 1 — la mesure.** Les tuiles portent-elles la bathymétrie ? À quelle profondeur,
      à quel zoom, avec quelle couverture ? **Chiffres avec source, données brutes sur disque.**
- [ ] **Étape 2** — test rouge.
- [ ] **Étape 3** — implémenter.
- [ ] **Étape 4** — mutation sémantique, worktree à part.
- [ ] **Étape 5 — REGARDER L'ÉCRAN.** ⚠️ **Le témoin est la capture
      `.banc/vues-J/J-final-17-apres-commit.png` : les taches bleues et vertes doivent
      disparaître.** Captures dans `.banc/vues-Jbis/`.
- [ ] **Étape 6** — clôture, page chargée drapeau levé ET baissé.

⚠️ **Deux constats de la Tâche J à reprendre au passage, tous deux à deux pas de ton chemin :**
- **`uCoastMaskOn` du globe vaut 0 alors que `contexteCrop` porte un masque** — constaté, pas
  creusé. Si c'est un branchement manquant, c'est peut-être une part du plateau vert uniforme.
- **`uCropCoin`/`uCropCoinN` étaient déclarés dans `MER_FRAG` et lus par PERSONNE** depuis la
  Tâche F — **cinquième constante morte du chantier.** La Tâche J vient de les réveiller ;
  vérifie qu'ils servent vraiment.
