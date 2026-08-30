### Tâche K ter — LES TROIS DÉFAUTS VISIBLES ⚠️ AVANT L'ACTE III

**Relevés EN DIRECT dans l'application par le contrôleur**, après qu'Adrien a comparé son
socle de production au crop **au même cadrage Z12** :

```
uEstompage 1 · uCropOn 1 · uHabOn 1 · uSolOn 0 · uCoastMaskOn 0
matériaux : transparent: true — et l'un avec depthWrite: false
```

**Adrien : « plus aucune texture sur la terre, la mer ne fonctionne plus ».**
⚠️ **Ce ne sont pas des manques d'habillage : ce sont TROIS DÉFAUTS, et ils rendent l'image
illisible.**

#### ⛔ 1 — LE BLOC EST TRANSLUCIDE, ON LE TRAVERSE DU REGARD

`transparent: true` sur les matériaux de tuile, **et `depthWrite: false` sur au moins un**.
Parois, mer et fond se mélangent. ⚠️ **C'est exactement le défaut neuf que la Tâche K a
signalé sans le porter** : *« à estompage intermédiaire, les tuiles semi-transparentes et
leurs jupes se mélangent en plaques diagonales »*.

**Ce qu'on attend :** que le bloc soit **opaque** là où il doit l'être. L'estompage a besoin
de transparence **pour les alentours**, pas pour le crop lui-même — **c'est probablement la
distinction qui manque.** ⚠️ **Vérifie AVANT de coder : si tu coupes la transparence partout,
tu casses l'estompage de la Tâche G, qui est mesuré et validé.**

#### ⛔ 2 — LE TRAIT DE CÔTE EST ÉTEINT (`uCoastMaskOn = 0`)

Alors que `contexteCrop().habillage.coastMask` **est non nul**. La Tâche J bis l'a diagnostiqué :
**« un RAFRAÎCHISSEMENT absent, pas un branchement absent »**, et a mesuré que le masque
changerait **5 761 px** une fois le fond posé (contre 67 084 avant). **Elle l'a laissé. C'est
visible à l'œil nu : c'est le liseré de côte du socle.**

#### ⛔ 3 — L'OCCUPATION DU SOL EST ÉTEINTE (`uSolOn = 0`)

**Jamais vue à l'écran sur le globe.** Son coût est mesuré (**+0,1781 ms pour 0,81 Mpx**, le
poste le plus cher des quatre **par un facteur onze**), son image ne l'est pas.
⚠️ **Si l'allumer coûte trop cher ou rend mal, DIS-LE et laisse-la éteinte** — mais alors
avec une mesure, pas par oubli.

- [ ] **Étape 1 — la mesure AVANT**, au cadrage exact d'Adrien (Z12, isométrique).
- [ ] **Étape 2** — test rouge · **Étape 3** — implémenter · **Étape 4** — mutation sémantique,
      worktree à part, **banc dans `.banc/`**.
- [ ] **Étape 5 — REGARDER L'ÉCRAN, côte à côte avec le socle de production** (drapeau baissé,
      même cadrage). **Captures dans `.banc/vues-Kter/`.**
- [ ] **Étape 6** — clôture, page chargée drapeau levé ET baissé.

⚠️ **CE QUE TU NE FERMES PAS** : l'habillage du socle (texture shading, analyse de relief,
matières des parois, grain fin) **n'est pas porté** — c'est l'Acte III, et **la Tâche C a
mesuré que les quatre postes déjà portés ne déplacent que 1,01 % des pixels**. **Ne prétends
pas rattraper l'aspect du socle avec cette tâche.**

#### ⛔ 4 — À L'ORBITE, LE CROP RESTE POSÉ (trouvé par la Tâche K bis, non corrigé)

`uCropOn = 1` **à 3 000 km d'altitude**, et **la planète entière porte alors la rampe du
dernier bloc visité**. ⚠️ **C'est un branchement manquant, pas un réglage** — et c'est
pourquoi le jeu de six stations d'altitude de la Tâche K bis « ne s'améliore quasiment pas ».

**Ce qu'on attend :** que le crop se retire quand il n'a plus lieu d'être, et que la rampe
revienne à l'échelle de la planète. ⚠️ **Attention à ne pas réintroduire un SEUIL** — la
consigne d'Adrien est « zéro saut ». Le retrait doit suivre la même loi continue que
l'estompage, qui est mesuré et validé.
