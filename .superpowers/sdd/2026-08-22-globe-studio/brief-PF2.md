# PF2 — LA PRIORITÉ : le visible d'abord, le centre de l'écran d'abord

Arbre : `C:\Dev\wt-pp2` · branche `perf-priorite`. Serveur : port libre **> 6100**.
**Lis d'abord `socle-perf.md`** (même dossier), puis invoque `/threejs-optimisation`.

## LA DEMANDE, DANS LES MOTS D'ADRIEN

> *« Ce qui est visible doit toujours être calculé en premier. Ce qui est au
> centre de l'écran est la priorité. »*

## TON TERRAIN : `src/globe.js` — `_traverse`, `_request`, la file, l'éviction

Ce qui est su (mesuré, pas supposé) :
- **`PLAFOND_FILE = 256` ne se déclenche jamais** (`_refusFile = 0`). La file
  n'est donc pas bornée par la contre-pression mais par ce qu'on y met.
- **La règle sans-trou** (`kids.every(ready)`) exige les quatre enfants avant
  de dessiner un raffinement : **quatre tuiles chargées quand une suffit**, et
  le raffinement ne descend que d'un niveau par image (d'où le cycle de
  période 4 documenté). Cesium l'a chiffrée puis abandonnée en profondeur.
- **Les tuiles hors champ consomment les places du cache**, pas des appels de
  dessin — c'est ça qui affame le budget. R26 : 4 à 9 tuiles `empty` restent
  après chaque chargement, **demandées par personne** — la conséquence de
  `demanderEmprise → _annuler`, qui annule en plein vol.
- **283 tuiles traversées en orbite** contre 36 au crop.
- Les racines sont demandées à priorité `1e9` (`globe.js` ~4127, ~4156).

## CE QUE FAIT CESIUM, ET QUE TU DOIS ÉTABLIR AVANT DE CODER

1. **Le niveau se choisit par erreur d'espace-écran (SSE)**, pas par distance :
   `sse = géométrieErreur × hauteurÉcran / (2 × distance × tan(fov/2))`. Une
   tuile au bord, vue de biais, n'a pas besoin du même niveau qu'au centre.
2. **La file est une file de priorité**, clé = (dans le tronc ?, distance au
   centre de l'écran, SSE). **Le centre charge avant les bords, le visible avant
   l'invisible**, toujours.
3. **Les requêtes hors champ sont ANNULÉES** (`AbortController`) quand la vue
   bouge, pas laissées finir — et leur place est rendue **au retour**, pas jamais.
4. **Une tuile parent reste dessinée tant que TOUS ses enfants ne sont pas
   prêts** — pas de trou — mais on peut dessiner un enfant prêt et le parent
   pour les trois autres, ce que la règle sans-trou interdit ici. **Chiffre ce
   que ça coûte de la garder.**
5. **Le décodage des tuiles ne touche pas le fil principal** : Worker +
   `createImageBitmap`, téléversement étalé (une ou deux textures par image).

⚠️ **Mesure d'abord l'état actuel** avec la sonde de PF1 (`scripts/profil-pf1.mjs`
si elle existe déjà ; sinon la tienne, **décrite**) : ordre réel d'arrivée des
tuiles pendant une descente — **quelle fraction des N premières tuiles arrivées
est au centre de l'écran ? dans le tronc ?** C'est le chiffre à battre.

## L'ATTENDU

1. **L'ordre d'arrivée avant/après**, sur une descente et sur un glissé : la
   fraction des 20 premières tuiles arrivées qui sont (a) dans le tronc, (b)
   dans le tiers central de l'écran. Et **le temps jusqu'à la première image
   sans tuile grossière au centre**.
2. **Requêtes et octets par descente avant/après**, au protocole CDP.
3. **Le cache** : places occupées par des tuiles hors tronc, avant/après, et à
   1/5/15 min d'usage (une fuite se voit dans le temps).
4. **Le coût CPU de `_traverse` par image**, avant/après, p50/p99 — une file de
   priorité mal écrite coûte plus qu'elle ne rapporte.
5. **L'ordre des correctifs écrit** — réduire ce qui entre AVANT de toucher au
   budget (mesuré ici : l'inverse donne ×14 de requêtes).
6. Tests (liste explicite de `package.json`, `audit:tests`), base 4 667 · 0.
7. `rapport-PF2.md`, avec « ce que j'ai cru puis réfuté ».

⛔ Ne touche ni au compositeur ni aux effets (PF3), ni à `modes.js` (caméra).
