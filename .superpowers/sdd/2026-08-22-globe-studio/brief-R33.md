# R33 — ATTAQUANT : où est le pivot, EN MÈTRES DU CENTRE DE LA TERRE ?

Arbre : `C:\Dev\wt-att2` · branche `attaque-pivot-globe` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5900**.

## ⛔ TON RÔLE : TU NE CORRIGES RIEN. TU MESURES DANS LE BON ESPACE.

Adrien a filmé **deux fois** que le pivot de rotation en mode surface n'est pas
le centre de la Terre. **Quatre passes** (R27, R29, R29 bis, l'attaquant R30) ont
publié des chiffres disant le contraire — « écart à l'axe : exactement 0 »,
« 14,1 % hors axe ». **Quelqu'un mesure la mauvaise grandeur, et ta tâche est
de le prouver ou de me réfuter.**

## MON HYPOTHÈSE — à attaquer, pas à croire

**Ils ont tous mesuré `hypot(controls.target.x, controls.target.z)` — dans
l'espace du BLOC.** En mode `surface`, les contrôles vivent en unités de bloc
(`TERRAIN_SIZE = 56` pour l'emprise ; `altitudeFondM = camY × extentMeters /
span`, `zoom-continu.js:120`). Dans cet espace `(0, y, 0)` est **le point de la
surface sous la caméra**, pas le centre de la Terre, qui est à
`(0, −EARTH_RADIUS_M / (extentMeters/span), 0)` ≈ **−13 050 unités** pour une
emprise de 27 354 m. `pivoterAutourDuBloc` (`main.js` ~13245) tourne autour de
**l'axe du bloc** — la verticale locale — et se décrit comme « le geste qu'on
copie » de l'orbite. **Tourner autour de la verticale locale est un lacet sur
place, pas une orbite.**

**Si je me trompe, c'est le résultat le plus utile que tu puisses rendre** — sur
ce chantier l'exécutant qui mesurait a eu raison contre le coordinateur vingt
fois sur vingt. Dis-le en premier, avec les chiffres.

## LA VIDÉO D'ADRIEN — ton geste de référence

`…\scratchpad\vid32\h01.jpg` → `h10.jpg` (une image par seconde) : orbite →
molette jusqu'à la bannière **« FX ONLINE — SURFACE MODE ENGAGED »** (~130 km,
Afrique australe) → **glissé** → en 3 s la vue est rasante, l'horizon en haut
du cadre, la Terre hors du centre.

## LES MESURES QUE PERSONNE N'A FAITES — dans l'ordre de valeur

Sur l'état actuel de `regroupement`, geste réel à la souris, sonde **au rendu**
(pas dans `controls.update` : `redresserSurLeSol` écrit la caméra après, R29
l'a établi), voile d'accueil fermé et vérifié, en Chrome sans tête
(`scripts/sonde-demarrage.mjs`, `scripts/sonde-sortie-r29.mjs` comme patrons).

1. **Le pivot en MÈTRES du centre de la Terre, en espace globe.** Convertis
   `controls.target` par la similitude `k = (extent/span)/ORBITAL_M_PER_UNIT`
   (`frontiere-rendu.js:65` ; `ORBITAL_M_PER_UNIT = EARTH_RADIUS_M/R_GLOBE`,
   `geo.js:17`), ou lis directement `camGlobe` (`main.js:4982`, `:5062`). En
   orbite ce nombre vaut **0**. En surface hors crop, à 130 km : **combien ?**
   Si c'est ≈ 6 371 000 m, le pivot est à la surface et j'ai raison.
2. **La signature orbite / lacet.** Pendant un glissé horizontal de 200 px :
   **la lat/lon du point sous la caméra change-t-elle ?** En orbite (mesure-le
   d'abord en orbite pour avoir l'étalon) : oui, de plusieurs degrés. En lacet :
   non. Rends les deux chiffres côte à côte.
3. **Le centre de la Terre à l'écran, en pixels**, avant/pendant/après un glissé
   horizontal puis vertical, à **2 000 km, 130 km, 50 km**. En orbite : immobile.
   Adrien juge à l'œil ; c'est ce chiffre-là qu'il voit.
4. **L'angle entre la verticale locale et l'axe optique** pendant le glissé
   vertical à 130 km. S'il dépasse ~60° hors crop, **D16 ter est violé** (*« la
   vue 3/4 arrive au bloc, pas avant »*) — et c'est l'image 10 de la vidéo.
5. **Quels tests gravent la confusion.** `test/pivot-terre.test.js`,
   `test/pivot-molette.test.js`, `test/pivot-bloc.test.js` : lesquels affirment
   « axe de la Terre » en lisant l'axe du bloc ? Nomme-les ligne par ligne.

## LES INSTRUMENTS QUI MENTENT — chacun a produit un faux constat ici

- ⛔ **Le voile `.ce-hubveil` avale TOUS les gestes** (32 crans → 0 reçu).
  Vérifie qu'il est fermé, ne le suppose pas.
- ⛔ **La pose de démarrage arrive après un vol de 8,3 s**, précédé de 5 s
  d'immobilité. « Stable » ≠ « final ».
- ⛔ **Sonde dans `controls.update` = trop tôt.** Au rendu.
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s : soustrais-le ou
  gèle-le, sinon tu mesures la Terre, pas le geste.
- **R23 a mesuré la latitude en croyant mesurer l'inclinaison.** Vérifie la
  grandeur, pas seulement la valeur.
- **Un relevé sur une image ne prouve rien** : 20 images consécutives.

## CE QUI FAIT UN BON RAPPORT D'ATTAQUANT

Pour chacune des cinq mesures : le chiffre, **l'espace dans lequel il est
exprimé** (bloc / globe / écran), le banc décrit en une ligne, et le verdict
**✅ tient / ⛔ faux / ⚠️ indécidable** sur l'affirmation « le pivot est le
centre de la Terre hors crop ». ⛔ **N'écris pas « probablement ».**

Livre des **tests rouges** dans `test/attaque-r33-ROUGE.mjs` (hors liste de
`package.json`, commande en tête du fichier), un par mesure qui échoue —
**exprimés en espace globe**, pour qu'aucun correctif en espace bloc ne puisse
les rendre verts par accident.

## L'ATTENDU

1. Les cinq mesures, avec espace et banc, à trois altitudes.
2. Le verdict sur mon hypothèse — et si elle est fausse, **ce que mesuraient
   vraiment R27/R29/R30** et pourquoi Adrien voit ce qu'il voit.
3. Les tests rouges, et la commande.
4. `npm test` — **la base reste 4 667 · 0 échec** ; `npm run audit:tests`
   sans écart. `git diff -- src/` **vide**.
5. ⚠️ **Scripts en BINAIRE**, relis l'octet écrit.
6. Commits sur `attaque-pivot-globe`. Rapport `rapport-R33.md` ici.

⚠️ Un correcteur travaille en parallèle dans `C:\Dev\wt-orb3`. **Ne lui parle
pas, ne lis pas sa branche.** Ton indépendance est tout ce que vaut ta mesure.

**Cherche à avoir tort sur mon hypothèse — c'est ce pour quoi tu es là.**
