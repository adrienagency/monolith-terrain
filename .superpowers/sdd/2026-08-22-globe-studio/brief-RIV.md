# RIV — POURQUOI LES RIVIÈRES FONT LAGUER, ET CE QU'ON N'A PAS APPLIQUÉ

Arbre : `C:\Dev\wt-riv2` · branche `riv-lag`. Serveur : port **> 7200**,
`--host 127.0.0.1`. **Tu ne corriges rien** : `git diff -- src/` reste **vide**.
Tu écris une **explication mesurée** et un **inventaire chiffré**, pour Adrien.

## LES DEUX QUESTIONS D'ADRIEN

> *« Explique-moi pourquoi le chargement des rivières entraîne un si long temps
> de lag. Et explique-moi les optimisations possibles à faire que tu avais déjà
> trouvées mais que nous n'avons pas appliquées. »*

C'est une **question**, pas une tâche de correction. Le livrable est un texte
qu'il puisse lire, adossé à des mesures — pas un correctif.

## ① LE LAG DES RIVIÈRES — mesure-le, ne le raconte pas

**Ce qui est déjà su, et qu'il ne faut pas remesurer :**
- `src/map/water-layer.js` : `OSM_MIN_ZOOM = 12`, et **au-delà les LIGNES de
  rivière viennent d'OSM** ; en deçà c'est Natural Earth, filtré par
  `filterByZoom` sur le champ `min_zoom` (la généralisation cartographique).
- La couche d'eau a déjà maigri de **14,12 → 8,44 Mo de tas** (retrait de
  `computeVertexNormals()` et `computeLineDistances()`).
- ⛔ **Une hypothèse déjà réfutée** : `densifyWorld` / `drapeWorld` **ne sont
  appelés par personne**. Ne repars pas là-dessus.
- **210 367 sommets alpins chargés à 700 km d'Anvers** parce qu'une boîte en
  effleurait une autre de 0,04° — le tri spatial des emprises a déjà mordu ici.
- Le profil PF1 dit que **l'image est bornée par le CPU principal**, pas le GPU
  (GPU 0,2–2,7 ms ; tick 10–36 ms à ×4/×6).

**Ce que tu dois établir, chiffré, sur au moins trois lieux contrastés** (un
bassin dense : Rhône ou Rhin ; un delta : Mississippi ou Gange ; un désert :
Sahara ou Atacama) **et deux zooms** (juste sous `OSM_MIN_ZOOM`, et bien
au-dessus) :

| poste | comment |
|---|---|
| **réseau** : requêtes, octets, temps de vol | protocole CDP, **pas** `getEntriesByType` (plafond 250, sous-compte de 79 % mesuré) |
| **décodage / parsing** JSON ou vectoriel | `performance.mark` **dans** la boucle |
| **construction de géométrie** (sommets, segments, drapage sur le relief) | idem, et compte les **sommets** |
| **le fil principal bloqué** | Long Tasks (`PerformanceObserver`), et la plus longue tâche unique |
| **le temps d'image pendant le chargement** | p50/p99, avec et sans la couche |
| **la mémoire** | `renderer.info.memory`, tas JS avant/après |

⚡ **La question qui décide de tout** : le lag est-il **du réseau** (on attend),
**du décodage** (le fil principal est bloqué), ou **de la géométrie** (on
construit trop de sommets) ? Donne la **part de chacun en pourcentage**, et la
**plus longue tâche unique en millisecondes** — c'est elle qu'Adrien ressent.

⚠️ **Mesure aussi ce qui se passe quand on BOUGE** pendant le chargement : une
couche qui se reconstruit à chaque déplacement d'emprise coûte bien plus qu'un
chargement unique.

## ② L'INVENTAIRE DES OPTIMISATIONS TROUVÉES ET NON APPLIQUÉES

Relis les rapports du dossier — **c'est la moitié du travail**, et ils sont
nombreux : `plan-fusion.md` (les sections « reste ouvert »), `rapport-PF1.md`
(le profil et son §④ « ce que font Google Earth et Cesium et que nous ne faisons
pas »), `rapport-PF2.md`, `rapport-PF3.md`, `rapport-PF4.md`, `rapport-R37.md`,
`rapport-B4.md`, `rapport-BT-N.md`, `rapport-GE3.md`, `lecons-campagne-R.md`.

Pour **chaque** optimisation identifiée mais non appliquée, rends :

| optimisation | gain annoncé | qui l'a mesuré | ce qui bloque | risque |
|---|---|---|---|---|

⚠️ **Distingue trois catégories, et dis-le clairement** :
- **chiffré et prêt** (quelqu'un a mesuré le gain, rien ne bloque sauf le temps) ;
- **chiffré mais coûteux** (le gain est connu, le prix aussi — c'est un
  arbitrage d'Adrien) ;
- **supposé** (personne n'a mesuré ; à ne pas vendre comme un gain).

⛔ **Ne recopie aucun chiffre sans citer son rapport.** Et **vérifie qu'une
optimisation « non appliquée » ne l'a pas été depuis** : ce dossier s'est déjà
contredit (une option donnée morte était réparée depuis deux tâches). Un
`grep` dans `src/` vaut mieux qu'une lecture de rapport daté.

## PIÈGES — chacun a produit un faux constat ici

- `getEntriesByType('resource')` plafonne à **250** entrées.
- **Une sonde posée APRÈS la fonction lit un état écrasé** ; instrumente dedans.
- **Le pixel n'est déterministe qu'en orbite** ; ailleurs A/B **dans la même
  session**.
- **Vite doit écouter sur `--host 127.0.0.1`**, sinon `[::1]` seul.
- **Le voile `.ce-elemwrap` avale les gestes** ; la pose de démarrage arrive
  après un vol de plusieurs secondes.
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**
- ⛔ **Ne tue que TES Chrome sans tête** — un noteur a fermé celui d'Adrien.

## L'ATTENDU

1. **Le lag des rivières expliqué en français simple**, avec la part de chaque
   poste en %, la plus longue tâche unique en ms, et les trois lieux × deux zooms.
2. **Ce qui coûte le plus**, nommé à la ligne, et **ce qu'on gagnerait à le
   corriger** (estimation chiffrée, marquée comme estimation).
3. **L'inventaire ②**, en trois catégories, chaque chiffre cité avec son rapport.
4. Un **classement final** : les cinq choses à faire en premier, par gain
   mesuré divisé par risque.
5. `npm test` **4 799 · 0**, `audit:tests` **257 = 257**,
   `git diff -- src/` **vide**. `rapport-RIV.md` (`git add -f`).

Ne pose pas de question : mesure, lis, chiffre, classe.
