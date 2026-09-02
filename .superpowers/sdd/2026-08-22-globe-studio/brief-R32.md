# R32 — LE PIVOT EST LE CENTRE DE LA TERRE JUSQU'AU CROP. VRAIMENT.

Arbre : `C:\Dev\wt-orb3` · branche `orbite-jusquau-crop` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5800**.

## ⛔ QUATRE PASSES ONT DÉCLARÉ CE DÉFAUT RÉGLÉ. ADRIEN L'A FILMÉ DEUX FOIS.

> **Adrien, ce soir, troisième fois :** *« contrairement à ce qui est indiqué dans
> les messages précédents, le pivot de rotation de la Terre en mode surface
> n'est toujours pas au centre de la Terre (excepté pour le mode crop). »*

Sa règle : *« Le point d'orbite doit toujours viser le centre de la Terre. Il
change uniquement quand on passe en mode bloc croppé. »*

**Sa vidéo** (`…\scratchpad\vid32\h06.jpg` → `h10.jpg`, une image par seconde) :
depuis l'orbite, il zoome à la molette ; la bannière **« FX ONLINE — SURFACE
MODE ENGAGED »** s'affiche (~130 km, Afrique australe) ; il **glisse** ; en trois
secondes la vue devient **rasante**, l'horizon monte en haut du cadre, la Terre
sort du centre. À 130 km d'altitude. **C'est une caméra qui tourne autour d'un
point de la surface**, pas autour du centre de la Terre.

## ⚡ POURQUOI TOUT LE MONDE S'EST TROMPÉ — c'est une confusion d'ESPACE

R27, R29 et l'attaquant R30 ont tous mesuré **`hypot(controls.target.x,
controls.target.z)` et l'ont appelé « écart à l'axe de la Terre »**. R27 publie
« exactement 0 », R29 « 14,1 % d'images hors axe ». **Ils mesuraient l'axe du
BLOC.**

En mode `surface`, les contrôles travaillent dans **l'espace du bloc plat** :
`TERRAIN_SIZE = 56` unités pour l'emprise, `altitudeFondM = camY × extentMeters
/ span` (`zoom-continu.js:120`). Dans cet espace, **`(0, y, 0)` est le point de
la surface sous la caméra** — l'origine du bloc. Le centre de la Terre, lui, est
à `(0, −EARTH_RADIUS_M / (extentMeters / span), 0)` : pour une emprise de
27 354 m, **≈ −13 050 unités sous l'origine**. Personne ne l'a jamais calculé.

Et `pivoterAutourDuBloc` (`main.js` ~13245) le dit **en toutes lettres** :

> *« en orbite la cible EST déjà le centre de l'objet regardé, et c'est
> précisément le geste qu'on copie ici »* — en tournant autour de **l'axe du
> bloc**.

⛔ **Tourner autour de la verticale locale n'est PAS orbiter.** C'est un **lacet
sur place** : l'azimut fait tourner le paysage autour du point sous la caméra,
et l'angle polaire **incline** la vue jusqu'à la rendre rasante — exactement les
images 8 à 10. Orbiter autour du centre de la Terre, c'est **se déplacer
au-dessus de la surface** : le point sous la caméra change, la Terre reste
plantée au centre du cadre, l'horizon ne bouge pas.

**Le régime concerné est immense** : `pickDiveTier` engage le mode surface sous
`altM < 8 000 000 m` (z4) ; le crop naît à `SEUIL_NAISSANCE_M = 32 274 m`. Entre
**8 000 km et 32 km**, la caméra tourne autour d'un point de la surface.

## ⚠️ CE QUI EST UNE HYPOTHÈSE ET CE QUI NE L'EST PAS

**Établi par lecture** : l'espace des contrôles en surface est celui du bloc, et
`(0,y,0)` y est un point de surface. **Ce que tu dois établir par la MESURE,
avant toute ligne** : pendant un glissé à ~130 km en mode surface hors crop,

1. **la position du pivot par rapport au centre de la Terre, en mètres, dans
   l'espace GLOBE** (via la similitude `k = (extent/span)/ORBITAL_M_PER_UNIT`,
   `frontiere-rendu.js:65` ; `ORBITAL_M_PER_UNIT = EARTH_RADIUS_M / R_GLOBE`,
   `geo.js:17`) ;
2. **le point du sol sous la caméra (lat/lon) change-t-il pendant le glissé ?**
   En orbite : oui, beaucoup. En lacet : non. **C'est LA signature** qui
   distingue les deux, et aucune passe ne l'a relevée ;
3. **la position du centre de la Terre à l'écran, en pixels**, avant/pendant/
   après le glissé — le critère visuel d'Adrien.

Si ces trois mesures te disent que je me trompe, **c'est toi qui as raison** :
sur ce chantier l'exécutant qui mesurait a eu raison contre le coordinateur
**vingt fois sur vingt**. Mais alors dis-le **avec les trois chiffres**, en
premier.

## LES DEUX ARCHITECTURES POSSIBLES — à départager par la mesure, pas par goût

**A. Cible au centre de la Terre, en unités de bloc.** `controls.target =
(0, −R_bloc, 0)`, OrbitControls inchangé. Zoom radial (déjà accepté par Adrien).
⚠️ **Le bloc doit alors SUIVRE la caméra** : à 100 km (≈ 205 u), 1° de rotation
déplace la caméra de ~111 km ≈ 228 u de côté — hors des 56 u du bloc. La
machine de rechargement (`_rescale`, `_suivreEmprise`, la fenêtre continue)
existe pour le zoom ; **elle n'a jamais été sollicitée par un glissé**. Mesure
ce qu'elle fait, ne suppose pas.

**B. Le régime orbital (espace globe, cible `(0,0,0)`) reste maître jusqu'à la
naissance du crop.** `mode = 'surface'` garde ses responsabilités de chargement
(paliers, DEM du bloc), mais **la paramétrisation de la caméra ne bascule en
espace bloc qu'au crop**. C'est la lecture littérale de D16 (*« une seule
caméra »*) et de la règle d'Adrien. ⚠️ Tout le code de surface suppose l'espace
bloc : `_applyZoom`, `_franchirSiBesoin`, les paliers, `altM`. Chiffre ce qui
casse avant de choisir.

⛔ **Interdits, et mesurés comme tels** : écrire `controls.target` d'un coup
(`veille-repos` : `|Δ ln d|` contre `1e-4`, un ré-ancrage vaut 66× le seuil et
déplace la bascule de trois quarts de D16 ter) ; borner par le sommet du disque
(supprimait la vue 3/4) ; « corriger » `redresserSurLeSol` sans rappeler
`controls.update()` (la sonde de R30 lisait trop tôt, R29 l'a établi).

## LE CRITÈRE D'ACCEPTATION — celui d'Adrien, pas celui d'un banc

**Rejoue sa vidéo exactement** : chargement → voile fermé → `enterOrbit` →
molette jusqu'à « SURFACE MODE ENGAGED » (~130 km) → **glissé horizontal de
200 px, puis vertical de 200 px**, à la souris, sonde **DANS la boucle**.

| grandeur | attendu |
|---|---|
| centre de la Terre à l'écran | **immobile à quelques px près** pendant tout le glissé, comme en orbite |
| lat/lon du point sous la caméra | **change** pendant le glissé horizontal (on se déplace) |
| angle entre la verticale locale et l'axe optique | **ne devient jamais rasant** avant le crop (D16 ter : la vue 3/4 arrive AU BLOC) |
| `|Δ ln(distance caméra→cible)|` | `< 1e-4` sur toutes les images du glissé |
| au crop (`globe._crop` vrai) | **rien ne change** : le pivot du bloc de R13 reste tel quel |
| retour en dézoomant depuis le crop | la cible revient au centre de la Terre **sans saut** (px relevés) |

**Et à trois altitudes** : 2 000 km, 130 km, 50 km — le régime va de 8 000 km à
32 km, un seul jalon ne prouve rien.

## LES INSTRUMENTS QUI MENTENT — chacun a produit un faux constat ici

- ⛔ **Le voile d'accueil `.ce-hubveil` avale TOUS les gestes** — 32 crans
  envoyés, 0 reçu. **Ferme-le d'abord**, et vérifie qu'il l'est
  (`document.querySelector('.ce-hubveil')`). Les quatre sondes de la campagne le
  retiraient sans le dire.
- ⛔ **La pose de démarrage arrive après un vol de 8,3 s**, et la caméra est
  **immobile 5 s AVANT** ce vol. « Attendre la stabilité » mesure un état qui
  n'est pas l'état final.
- ⛔ **Une sonde dans `controls.update` lit trop tôt** pour ce qui écrit
  `camera.position` après (`redresserSurLeSol`). Relève **au rendu**.
- ⛔ **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas** — patron qui marche : `scripts/sonde-demarrage.mjs`, Chrome
  sans tête, et `scripts/sonde-sortie-r29.mjs` pour le geste réel.
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité.
- **R23 a mesuré la LATITUDE en croyant mesurer l'inclinaison.** Vérifie la
  grandeur que tu lis.
- **La suite de tests peut verrouiller le défaut** : `test/pivot-terre.test.js`,
  `test/pivot-molette.test.js` et `test/pivot-bloc.test.js` **gravent l'axe du
  BLOC comme l'axe de la Terre**. Relis-les ; ceux qui codent la confusion
  doivent être réécrits, pas contournés — et dis lesquels.

## LES RÈGLES — dans ce dossier

- **D16 / bis / ter** (`regle-D16.md`) — *« une seule caméra »*, *« la vue 3/4
  arrive au bloc, pas avant »*. C'est ta tâche entière.
- **D17** — ⛔ **IL N'Y A PAS DE PRODUCTION.**
- `plan-fusion.md` (état courant) · `rapport-R27.md`, `rapport-R29bis.md`,
  `rapport-R30.md` — les trois passes qui ont mesuré le mauvais axe. **Lis-les
  pour ne pas refaire leur erreur, pas pour t'appuyer dessus.**
- L'en-tête de `src/monde/pivot-bloc.js` — le pivot **du crop**, qui reste juste
  et ne doit pas bouger.

## L'ATTENDU

1. **Les trois mesures d'ouverture** (pivot en mètres du centre de la Terre ;
   lat/lon sous la caméra pendant le glissé ; centre de la Terre en px), sur
   l'état actuel, à 130 km. C'est ce qui décide si j'ai raison.
2. **Le choix A ou B, justifié par un chiffre** (ce qui casse, ce que ça coûte).
3. **Le tableau du critère d'acceptation, aux trois altitudes, avant/après**,
   rejoué sur le geste de la vidéo.
4. Les tests qui gravaient la confusion **réécrits et nommés**.
5. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent ne tourne **jamais**. `npm run audit:tests`, aucun
   écart.
6. `npm test` — **base à battre : 4 667 · 0 échec**.
7. ⚠️ **Scripts d'édition en BINAIRE**, et **relis l'octet écrit**
   (`grep | cat -A`) : quatre incidents cette nuit.
8. Commits sur `orbite-jusquau-crop`, messages en français.
9. Rapport `rapport-R32.md` ici, avec **« ce que j'ai cru puis réfuté »**.

⚠️ **Un attaquant mesure en parallèle** dans `C:\Dev\wt-att2`, **en espace globe**,
sans rien corriger. Ne lui parle pas, ne lis pas sa branche.

Travaille jusqu'au bout, ne pose pas de question : mesure, tranche, corrige.
