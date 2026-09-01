# R34 — LA PROFONDEUR DE CHAMP : même flou apparent à tout zoom

Arbre : `C:\Dev\wt-dof` · branche `flou-zoom` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 6400**.

## LA RÈGLE — `regle-D20.md`, dans ce dossier, à lire en entier

Adrien, textuellement : *« Le flou doit être proportionnel en fonction du niveau
de zoom. (…) Il existe déjà un focus sur le point terrestre qui est le plus
proche de la caméra sur l'axe caméra > pointeur > Terre ; il faut le corriger
car il semble mal fonctionner. La profondeur de champ sélectionnée est la même à
toutes les distances, mais sa distance de bokeh est proportionnelle à la
distance de la caméra avec la Terre. »*

Et ses trois réponses à mes questions :
1. **Le flou est l'exception** : actif à **tous** les zooms (orbite, surface,
   crop) — contrairement aux autres effets, bornés au crop.
2. **Mise au point sous le pointeur, repli au centre de l'écran** quand le
   pointeur quitte la toile ou passe sur un panneau — elle glisse, ne se fige pas.
3. **À réglage égal, même flou apparent à l'écran à tout zoom** : la plage de
   netteté vaut `k × distance(caméra → point de focus)` ; le curseur règle `k`.

## CE QUI EXISTE — et ce qui est su faux

`src/main.js` :
- `params` (~386) : `autoFocus: true` (« pointer→terrain autofocus »),
  `focusDistance: 13.2698`, `focusRange: 45`, `bokehScale: 3.7`.
- `dof = new DepthOfFieldEffect(camEffets, { focusDistance: 0.02, focalLength:
  0.06, bokehScale })` (~2581) ; `dofPass = new EffectPass(camEffets, dof)`.
- `poserMiseAuPoint(distanceBloc, porteeBloc)` (~5265) — **« Bloc » dans le nom :
  l'entrée est en UNITÉS DE BLOC.**
- Le tick d'autofocus écrit `dof.focusDistance` depuis `params`.
- `setDofEnabled(...)` (~2711, ~6584, ~7426) ; le palier machine coupe `dof`
  aux paliers 2 et 3 (`palier-machine.js:155,172`).

⛔ **Deux défauts d'unités déjà mesurés ici, dans cette fonction même** :
- `main.js` ~5187 : *« `1/k` vaut 130,43 »* — l'autofocus a porté un facteur
  **130,4** de conversion faux ;
- une **portée de flou de 1 465 km** publiée par un relevé : `focusRange = 45`
  en unités de bloc, convertie avec le mauvais rapport.
- L'inventaire du studio (option 1, « Mise au point auto (pointeur) ») : **⛔
  0,000 / 0,000** — le curseur ne changeait rien à l'image. R21 a noté *« le
  flou est inerte »*. **Vérifie d'abord si le flou agit encore, avant de régler
  sa loi** — un réglage parfait d'une passe inerte est un réglage de rien.

## ⚠️ LA CLASSE DE DÉFAUT QUI EST REVENUE NEUF FOIS — et c'est exactement ici

**Il y a trois espaces** : le bloc (`TERRAIN_SIZE = 56` pour l'emprise,
`altitudeFondM = camY × extentMeters / span`), le globe (`R_GLOBE = 100`,
`ORBITAL_M_PER_UNIT = EARTH_RADIUS_M / R_GLOBE`, `geo.js:17`), et **la caméra
des effets** (`camEffets`, dont `near`/`far` diffèrent entre modes — `camera.far
= 1400` en orbite). `DepthOfFieldEffect` de postprocessing prend `focusDistance`
**normalisé dans [0, 1] entre `near` et `far` de la caméra qu'il lit** — pas en
mètres, pas en unités.

➡️ **Écris la chaîne complète**, en commentaire, avec chaque facteur chiffré :
`point de focus (mètres réels) → unités de l'espace courant → profondeur de vue
normalisée [0,1] de camEffets`. Et **la plage** : `k × distance` en mètres →
`focalLength` / `focusRange` normalisé. **Une valeur transportée sans sa
conversion écrite est un défaut, même si elle a l'air de marcher.**

## LA MISE AU POINT SOUS LE POINTEUR — ce qu'il faut établir

1. **Le point terrestre le plus proche de la caméra sur l'axe caméra → pointeur**
   — donc un lancer de rayon **contre la Terre affichée** : en orbite et en
   surface c'est le globe (`camGlobe`, `R_GLOBE`, plus le relief si `terreUnique`
   le déplace), au crop c'est le bloc (`terrain.sample`). ⚠️ Un rayon contre une
   sphère lisse alors que la surface dessinée porte le relief exagéré met le
   focus **sous** la montagne — c'est la classe « 1 830 m sous les Alpes ».
2. **Le repli au centre de l'écran** quand le pointeur est hors toile / sur un
   panneau (`elementFromPoint` ≠ canvas), **avec un lissage** : un saut de mise
   au point se voit comme une pulsation du flou. Mesure le temps de glissement
   et donne-le.
3. **Ce qui « semblait mal fonctionner »** : trouve-le par la mesure, pas par
   lecture. Relève, pendant un déplacement du pointeur sur 20 images, la
   distance de focus écrite et **la distance réelle du point sous le pointeur**
   (en mètres, même espace), et l'écart entre les deux. Si l'écart est un
   facteur constant, c'est une unité ; s'il dépend de l'altitude, c'est un
   espace.

## LE JUGE — le flou apparent en PIXELS, pas un paramètre

**Le critère d'Adrien est visuel** : même réglage → même rendu à 5 km et à
5 000 km. Mesure donc **le rayon de flou en pixels** à une distance donnée
derrière/devant le point de focus, exprimée en fraction de la distance au
focus (par exemple à ±20 % et ±100 % de la distance caméra→focus), aux
altitudes **5 km (crop), 130 km, 2 000 km**. Le tableau attendu :

| altitude | focus (m) | flou px à −100 % | à −20 % | au focus | à +20 % | à +100 % |
|---|---|---|---|---|---|---|

**Avant / après.** Après : les colonnes doivent être **les mêmes aux trois
altitudes**, à quelques pixels près. Avant : elles ne le sont pas, et c'est le
défaut. Comment lire un rayon de flou : image nette (`dofPass` désactivée) vs
image floue, gradient local sur une arête de côte ou de crête ; ou la réponse
à une mire injectée. **Décris ton instrument.**

## PIÈGES — chacun a produit un faux constat ici

- ⛔ **Un banc différentiel ne distingue pas « rien n'a changé » de « tout est
  cassé pareil »**. Lis la console à chaque recompilation.
- **`gl.finish()` ne pèse pas les fragments** ; **`EXT_disjoint_timer_query_webgl2`
  avec témoin** pour chiffrer ce que coûte la passe hors crop — Adrien l'a
  acceptée partout, mais **il veut le chiffre sur machine lente** (CPU ×4/×6,
  pixelRatio 2). Un profileur (PF1, `C:\Dev\wt-pp1`) écrit une sonde commune
  `scripts/profil-pf1.mjs` ; si elle existe, sers-t'en.
- **Le palier machine coupe `dof` aux paliers 2 et 3** et **réimpose son état à
  chaque image** — relève `window.__palierMachine` dans chaque mesure, sinon tu
  attribueras au curseur un zéro du palier.
- **Le voile d'accueil `.ce-hubveil` avale les gestes** — ferme-le et vérifie.
  **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne composite
  pas** — Chrome sans tête, `scripts/sonde-demarrage.mjs`.
- **Le globe tourne tout seul** à ~2 °/s après 3 s : un focus sous le pointeur
  bouge donc même pointeur immobile. Gèle-le pour mesurer.
- **Certains curseurs ne valident qu'au relâchement.**
- **La suite de tests peut verrouiller le défaut** : relis ce qui borde
  `poserMiseAuPoint` et `focusRange`.

## PÉRIMÈTRES — quatre autres agents tournent

- **PF3** (`wt-pp3`) tient le compositeur : *quelles* passes tournent. Il laisse
  `dofPass` active partout. **Toi, tu tiens ses paramètres et l'autofocus** —
  pas l'ordre ni l'activation des passes.
- **PF1/PF2/PF4** : profil, priorité des tuiles, bugs. Les agents caméra :
  `modes.js`, `pivot-bloc.js`. **N'y touche pas.**

## L'ATTENDU

1. **Le flou agit-il aujourd'hui ?** (option 1 de l'inventaire à 0,000) — chiffre.
2. **Ce qui faisait mal fonctionner l'autofocus**, mesuré : écart focus écrit /
   point réel, en mètres, sur 20 images.
3. **La chaîne d'unités écrite**, chaque facteur chiffré.
4. **Le tableau du flou en pixels aux trois altitudes, avant/après.**
5. **Le repli au centre**, avec son temps de glissement.
6. **Le coût de la passe hors crop** sur trois machines émulées.
7. Tests. ⚠️ **`package.json` porte une LISTE EXPLICITE** — `npm run
   audit:tests`, aucun écart. `npm test` : **base 4 667 · 0 échec**.
8. ⚠️ **Scripts d'édition en BINAIRE**, relis l'octet écrit (`grep | cat -A`).
9. Commits sur `flou-zoom`, messages en français. `rapport-R34.md` ici
   (`git add -f`), avec **« ce que j'ai cru puis réfuté »**.

Ne pose pas de question : mesure, tranche, corrige.
