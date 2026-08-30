#### Tâche J — LA SURFACE PLEINE ⚠️ EN PREMIER, CONSIGNE D'ADRIEN

**Fichiers :** `src/main.js` (`contexteCrop`), `src/monde/branchement-crop.js`, tests.
⛔ **Interdit : `terrain.js`, `plinth.js`, `ocean.js`.**

Trois trous mesurés, **un seul défaut** :

1. ⛔ **La bathymétrie n'est jamais demandée.** `contexteCrop()` (`main.js:4688-4696`) le dit
   en toutes lettres : « PAS DE BATHYMÉTRIE… la mer sera d'un bleu uniforme ». Champ couvert
   à **0,7 %**, `bathy: false`. **Brancher `remplir` sur `bathy.js`.**
2. ⛔ **Le champ n'est rempli qu'à UN SEUL zoom** — z12 sur 164 km ne couvre que **19,3 %**
   des nœuds ; **z10 en couvre 100 %** pour 25 tuiles. **Choisir le zoom depuis l'emprise.**
3. ⛔ **La mer déborde de 400 km sur un bloc de 10 km**, et **l'estompage ne la touche pas**.
   Borner la portée de la calotte sur l'emprise du crop, et **la faire suivre l'estompage**.

- [ ] Test → rouge → implémenter → mutation → **REGARDER L'ÉCRAN** → clôture.
- [ ] **Critère : plus aucun aplat gris. La mer a un fond, et elle s'arrête où il faut.**
- [ ] ⚠️ **Vérifier aussi la couverture des HAUTEURS** : `reserverHauteurs` a une marge d'une
      tuile ; **sans elle la couverture plafonne à 0,552**. Le défaut est corrigé, **le
      vérifier non régressé** fait partie de la tâche.

