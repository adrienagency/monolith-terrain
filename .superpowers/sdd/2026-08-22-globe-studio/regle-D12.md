# D13 — AUTORISATION PLEINE : ON ADAPTE, ON NE MÉNAGE PLUS RIEN

> **Adrien, 2026-08-22 :** *« On se moque que ShibuMap tourne, il est en version alpha et
> personne ne l'utilise encore, tu peux modifier tout ce que tu veux, tu as l'autorisation. »*

**Ceci remplace D5 (interdiction), D11 (parité) et D12 (adapter ou copier).**
**Il n'y a plus aucun fichier protégé.** `src/terrain.js`, `src/plinth.js`, `src/ocean.js`,
`src/main.js`, le chemin bloc : **ouverts.**

## Ce que ça change dans la pratique

### ① Le cérémonial du « défaut au bit près » n'est plus obligatoire

Ce chantier a élargi **six fois** avec un défaut reproduisant le dépôt au bit près
(`distanceRivage`, `aussi: null`, le maillon `fond`, `uMppFacteur = 0`, `uMerZeroSousEau = 0`,
le terme nul de K ter). ⚠️ **Ce patron existait pour protéger une production. Il n'y a plus
de production à protéger.**

➡️ **On adapte DIRECTEMENT.** Plus de paramètre de compatibilité à traîner, plus de test qui
verrouille un comportement que personne n'utilise.

⚠️ **MAIS le patron garde UNE vertu, et elle n'est pas la sécurité : il rend la mesure
possible.** Un drapeau qui éteint un changement permet un **A/B à témoin nul** — c'est ce qui
a produit les meilleures preuves du chantier (`uKminFade`, `uCropCoin 0 → 0,2`).
➡️ **Garde-le comme INSTRUMENT DE BANC quand tu veux mesurer, pas comme filet de sécurité.**

### ② Le vrai filet, c'est git — pas un chemin parallèle qui tourne

Le mode plat est **une sauvegarde**. ⚠️ **Une sauvegarde vit dans l'historique, pas dans un
second moteur qu'il faut maintenir vivant.** `git log` porte chaque état livré ; le chemin
plat n'a pas besoin de rester exécutable pour être récupérable.

➡️ **Ne dépense plus une minute à préserver la parité fonctionnelle du mode plat.**

### ③ Copier reste le dernier recours — pour une raison qui n'a jamais été la production

⛔ **Ce chantier existe parce qu'Adrien a refusé DEUX TERRES calculées séparément.** Ses
mots : *« il vaut mieux calculer 2 terres qu'une seule ? au niveau ressources ça me paraît
aberrant »*. **Copier `terrain.js` recréerait cette duplication** — des milliers de lignes qui
divergeraient en un jour. **Cet argument-là tient toujours, et il n'a rien à voir avec le
risque de régression.**

➡️ **Ordre inchangé, mais pour un motif différent : ① ADAPTER en place · ② EXTRAIRE en module
pur partagé dans `src/monde/` (testable sous node — le dépôt a déjà cette architecture :
`escalier-zoom.js`, `frontiere-rendu.js`, `loi-altitude.js`, `echelle-continue.js`) ·
③ COPIER en dernier recours, jamais un fichier entier, avec un en-tête qui dit de quoi ça
dérive et ce qui devra être resynchronisé.**

### ④ Le drapeau `?terre=unique`

**Il reste utile tant qu'on compare** — c'est lui qui permet les A/B appariés. **Il n'a plus
de rôle de protection.** Quand la sphère sera meilleure que le plat, il pourra devenir le
défaut, puis disparaître. **Ce n'est pas urgent et ce n'est pas la priorité.**

## Ce qui NE change pas

- ⚠️ **Les tests, les campagnes de mutation et les bancs restent EXACTEMENT aussi exigeants.**
  L'autorisation porte sur ce qu'on a le droit de casser, **pas sur la rigueur de la preuve.**
  **Neuf chiffres ont été retirés par leurs propres auteurs sur ce chantier**, et c'est ce qui
  rend les rapports croyables. **Rien là-dedans ne se relâche.**
- **Le banc reste dans `.banc/`.** **La mutation vise le BRANCHEMENT.** **On regarde l'écran.**
