# UNE SEULE TERRE — le crop est une découpe dans la planète

**Décidé avec Adrien le 2026-08-21.** Successeur direct de `2026-08-08-globe-continu.md`, dont il **conserve tous les acquis** et **remplace la Phase 2**.

> **Adrien, le 2026-08-21 :** « *Je ne veux qu'une seule terre, globale, mais avec un système d'échantillonnage comme tu as fait là. Je veux le même rendu que la qualité de rendu des tuiles à plat qui vont donc disparaître, la mer devra aussi être recalculée. Le crop doit se faire dans la terre arrondie.* »

---

## 0. Comment on vérifie — à lire AVANT toute tâche

⚠️ **CES RÈGLES SONT HÉRITÉES DU PLAN PRÉCÉDENT, OÙ ELLES ONT ÉTÉ PAYÉES.** Elles ne sont pas des principes : chacune vient d'un défaut réellement livré.

### La règle des chiffres

**Un chiffre de ce plan porte soit sa mesure et sa source, soit la mention « À MESURER » avec son protocole.** Il n'y a pas de troisième cas. Le plan précédent a vu **quatre constantes posées à l'instinct puis mesurées destructrices** — dont un plancher de crédit qui faisait tomber le globe à z3 et installait six requêtes par image caméra immobile.

### La règle des listes

⚠️ **ON ÉLARGIT UNE LISTE, ON NE LA REMPLACE JAMAIS.** Le même accident s'est produit **cinq fois** sur le plan précédent : un remplacement global a dupliqué des étapes dans quatre tâches ; une correction de repères a fait **sortir du document** le vrai pop-up de l'application ; le commit écrit pour réparer cet accident l'a reproduit.

### Les quatre gestes obligatoires

- ⚠️ **Une assertion se rejoue contre le dépôt AVANT d'être écrite.** Quatre assertions du plan précédent ont été écrites fausses, puis remplacées par d'autres fausses **aux mêmes valeurs**.
- ⚠️ **Les scripts d'édition passent par un fichier, jamais par une ligne de commande.** Les accents graves de ces documents sont innombrables et le shell les interprète — deux noms ont été avalés au §10 du plan précédent.
- ⚠️ **CHARGE LA PAGE AVANT DE COMMITER.** **Aucun test de ce dépôt ne charge `src/main.js`** : `node --check` ne voit pas une référence non définie. Une tâche a livré du code qui plantait au démarrage avec 3 098 tests verts.
- ⚠️ **REMETS TES MUTATIONS EN PLACE.** Deux tâches de suite ont laissé des sondes dans l'arbre — un `Math.max(0, hn)` retiré et jamais restauré, puis `_MUT` / `MUT_GLOBE` / `globalThis.__SONDE`. **Vérifie `git status` ET `npm test` juste avant de commiter, puis juste après.**

### La clôture

```
npm test
npm run audit:tests
node --check <chaque fichier modifié>
npm run nettoie:dist && npm run build:mapcells && npx vite build && npm run verifie:dist
```

⚠️ **`build:mapcells` PASSE AVANT `vite build`** — `netlify.toml:19` documente cette correction ; sans lui, le découpage en cellules n'existe pas et **34 % de gain de poids disparaissent en silence**.

### Le protocole de banc

⚠️ **Jette au moins 17 images avant de relever**, puis 20, et exige la stabilité. La règle sans-trou ne descend que **d'un niveau par image** ; convergence mesurée à l'image 12 à 8 km, 13 à 2 km. **Un banc trop court n'est pas imprécis : il IMITE le défaut cherché.**

⚠️ **Un relevé à une seule image ne dit rien d'un système qui oscille**, et **une sonde lue après la fonction ment de façon plausible** — 404 au lieu de 0, et 404 était l'effectif du cache moins ses racines.

---

## 1. Les décisions d'Adrien — tranchées le 2026-08-21

1. **UNE SEULE TERRE.** Le crop n'est pas un objet posé devant la planète : **c'est la planète, découpée.** Les tuiles du globe **sont** la surface du socle.
2. **Les parois restent VERTICALES ET PARALLÈLES**, comme aujourd'hui. ⚠️ **La base a la même taille que le dessus.** C'est l'objet-affiche que ses utilisateurs connaissent ; la justesse physique cède au produit.
3. **La Terre autour du crop S'ESTOMPE PROGRESSIVEMENT** à mesure qu'on descend, pour que le bloc se détache. **Une transition à dessiner.**
4. **La rampe de couleur se calcule SUR LE CROP, et les alentours la suivent.** Couleurs stables et reproductibles pour l'affiche, **aucune couture au bord**. ⚠️ **Conséquence acceptée : les zones lointaines peuvent saturer** — une plaine à côté d'un crop alpin sera monochrome.
5. **La mer riche est PARTOUT, DÉGRADÉE AVEC LA DISTANCE.** ⚠️ **Où placer la bascule est À MESURER** : elle ne doit pas se voir.
6. **Le rendu du socle est la RÉFÉRENCE, pas un point de départ.** *« le même rendu que la qualité des tuiles à plat qui vont donc disparaître »* — courbes de niveau, grain, masque de côte, bathymétrie fusionnée, occupation du sol, étiquettes.

### Les décisions du plan précédent qui restent en vigueur

**Une seule caméra de l'orbite au sol · plus de paliers · plus de voile de chargement** (décision 1) · **le socle naît sous un seuil d'ALTITUDE, jamais sur une fraction d'écran** (R1, décision 2) · **le socle suit le cadrage en continu** (3) · **la gravure ne s'écrit qu'à l'arrêt** (5) · **le flou pendant le mouvement est accepté, net dès l'arrêt** (13) · **l'exagération verticale est une courbe continue de l'altitude** (14).

⚠️ **La décision 8 — « les statistiques sont LISSÉES, pas rebasées sur le monde » — est AMENDÉE par la décision 4 ci-dessus** : la référence n'est plus « le monde » ni « la vue », c'est **le crop**.

---

## 2. Les trois règles d'architecture — héritées, et toujours vraies

- **R1 — Aucune décision de cadrage ne lit une quantité dérivée du terrain.** Une fraction d'écran dépend du relief chargé, donc de `meanM`, qui est lissé : on fabriquerait un oscillateur. ⚠️ **Elle a déjà mordu deux fois** — `surfaceCamAltMeters` ajoutait `meanM` et pilotait `enterOrbit` ; et un pilote d'exagération refermait la boucle avec un gain mesuré de **1,44**, donc divergent.
- **R2 — Aucune tuile Google, jamais.** Leurs conditions interdisent le cache, l'usage hors ligne et la revente de géodonnées ; **une affiche imprimée est une œuvre dérivée hors ligne.**
- **R3 — La descente est bornée par ce que le réseau soutient.** Loi mesurée à six points : `z = ⌊6,2 + 1,4 × log₂(débit Mb/s)⌋`. ⚠️ **Elle borne le REMPLISSAGE, jamais l'emprise.**

---

## 3. L'état mesuré — ce sur quoi ce plan s'appuie

### Ce qui est acquis et ne doit pas être re-litigé

| fait | mesure |
|---|---|
| **L'attente est morte** | entrée morte **25,41 s → 0,21 s** sur huit crans, rideau **25,41 s → 0 s** |
| **Le cran ne reconstruit plus de géométrie** | **14 crans sur 14** gardent le même tampon (témoin : 7 sur 7 le refont) |
| **Le globe atteint z15** | z7 à 1 600 km · z8 à 800 · z10 à 200 · z12 à 60 · z14 à 8 · **z15 à 2 km** |
| **Le vrai verrou n'était pas `MAX_Z`** | c'était le plancher de `dist` : `R_GLOBE = 100` pour 6 371 km, donc `1` valait **63,7 km**. `MAX_Z = 16` + cache ×13 rendait **toujours z11** |
| **Le globe est plus fin que le socle n'a besoin** | globe **1,69 m/échantillon** à z15 · socle z13 **6,76 m** (45°, tuiles 512 px) |
| **Coût du globe au socle** | **964 tuiles dessinées**, cache 1 504, **72,6 Mo** de tas |
| **La bathymétrie est dans le flux** | écart en mer **615 m → 3,2 m** (Nice z12), **un seul fichier local ouvert** |
| **La précision est réglée** | RTC : pas représentable **0,486 m → ~1 mm**. ⚠️ **L'origine se prend sur la surface DÉPLACÉE**, pas sur le centre géométrique |

### Les trois écarts qui font « deux Terres » — la mesure du 2026-08-21

| | globe | socle |
|---|---|---|
| **exagération verticale** | **18** (`globe.js`) | **2,8** (`BASE_EXAG`) — facteur **6,4** |
| **échelle de la rampe** | **mondiale fixe** : `uLandMax = 5600 m`, `uOceanDepth = 6000 m` | **locale** : `uHeightRange = (minH, maxH)` du bloc |
| **habillage** | rampe + contours + graticule | + courbes calées sur le local, grain, masque de côte, fusion GEBCO, occupation du sol, étiquettes |

⚠️ **C'est la deuxième ligne qui explique les captures d'Adrien.** À l'île Maurice, qui culmine à **800 m**, le globe n'utilise que **14 % du bas de sa rampe** (le vert) quand le socle l'étale sur **100 %** jusqu'aux blancs.

### La courbure — pour que personne ne se trompe d'argument

| largeur du crop | écart au plan |
|---|---|
| **z13 — 10,4 km** *(la largeur du socle)* | **2,1 m** |
| z8 — 166 km | 541 m |
| z5 — 1 328 km | **34,6 km** |

⚠️ **La courbure ne justifie PAS ce chantier à l'échelle du socle actuel.** Ce qui le justifie, c'est **qu'on cesse de calculer deux Terres** — et, en second, que les crops continentaux deviennent possibles.

---

## 4. Ce qui existe déjà et qu'il ne faut pas réécrire

⚠️ **C'est le §1 de `/threejs-optimisation` : l'audit s'arrête au fichier, et zéro occurrence est un signal, pas un soulagement.** Le plan précédent est tombé deux fois dans ce piège.

| ce qui existe | où | ce qu'il fait |
|---|---|---|
| **La projection sphérique exacte** | `globe.js`, `_buildMesh` / `posAt` | chaque sommet **posé sur la sphère** puis déplacé le long du rayon — **jamais interpolé sur un quad plat** |
| **`dansDalle(x, z, demi, rayon, exposant, facteurs)`** | `damier-bords.js:181` | ⚠️ **LA SUPERELLIPSE EXACTE, et c'est elle qu'il faut.** Le §4 de ce plan prescrivait `dansFenetre` (`fenetre-clip.js:232`) en le décrivant faux **deux fois** : il n'est utilisé ni par `plinth.js` ni par `ocean.js` (mais par `gpx.js`, `main.js`, `peaks.js`), et **ce n'est pas la superellipse mais son OCTOGONE CIRCONSCRIT** — son propre en-tête le dit. ⚠️ **Écart mesuré : NUL à 45°** (le plan diagonal y est tangent, 1,4e-14 — **un test posé là ne les aurait pas distinguées**), **maximal à 44,3° où il vaut 0,129 unité = 23,9 m au sol.** Sur l'octogone, la surface aurait débordé les parois : un liseré |
| `plansFenetre`, `pointCoin`, `arcCoin`, `exposantCoin` | `fenetre-clip.js` | la loi de coin, accord mesuré à **1,1e-16** avec la fenêtre |
| **`buildSlabWalls`** | `plinth.js:232` | **douze options** : congé, chanfrein, AO de contact, liner, masque d'arrondi, bords, `baseYFloor` |
| Le flux et sa réserve | `monde/flux-terrain.js` | `remplirHauteurs` **par lot**, `gardeHauteurs`, `debitObserve`, `PLAFOND_FILE = 256` |
| Le seuil du socle | `monde/seuil-socle.js` | `ZOOM_SOCLE = 13`, naissance **32 274 m**, mort **40 343 m**, hystérésis ×1,25 |
| L'audit de solidité | `monde/audit-solide.js` | **‖Ā‖ < ε** — la somme des vecteurs-aires, nulle sur un solide fermé |
| La loi d'altitude | `loi-altitude.js` | l'instrument qui a mesuré les onze sauts |
| Le partage d'exagération | `monde/exageration-continue.js` | **un écrivain, treize lecteurs** |

---

## 5. Ce qui MEURT — et c'est le bilan du chantier

⚠️ **CE PLAN RETIRE DU CODE. Si à la fin le dépôt a grossi, quelque chose a mal tourné.**

- **`monde/fenetre-bornee.js`** (818 lignes) — le rééchantillonnage dans une grille plane n'a plus d'objet : les tuiles du globe **sont** la surface.
- **Le chemin « bloc » de `terrain.js`** — à retirer **en dernier**, quand le drapeau devient le défaut.
- **Le rééchantillonnage MNT du socle** — le globe le sert déjà.

⚠️ **Ce qui ne meurt pas :** le **damier** (`block-grid.js`, **13 fichiers de test, 254 tests à empreintes bit à bit**) reste plat, derrière `FLAGS.fenetreContinue` qui vaut `false`. **Hors périmètre, et on n'y touche pas.**

---

## 6. LES TÂCHES

### Tâche A — LE CROP DÉCOUPÉ DANS LA SPHÈRE ⚠️ EN PREMIER

**Fichiers :** modifier `src/globe.js` · lire `src/fenetre-clip.js` · tester `test/crop-sphere.test.js` (créer)

Les tuiles du globe cessent d'être dessinées entières : **elles sont découpées à la forme du crop.** `dansFenetre` donne la forme, coins compris. La découpe se fait **dans le nuanceur de fragment** (`discard` hors de la fenêtre) — pas de nouvelle géométrie, pas de couture.

- [ ] **Étape 1 — le test qui échoue** : à l'intérieur du crop, la surface est dessinée ; **à un texel dehors, elle ne l'est pas**, et la frontière suit la superellipse. ⚠️ **Rejoue-le contre le dépôt avant de l'écrire.**
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3 — implémenter.** ⚠️ **Le test se fait en lat/lon, pas en coordonnées de scène** : une tuile chevauche la frontière, et sa position mondiale est relative à son propre centre (RTC).
- [x] **Étape 4 — le raffinement dans le crop. ✅ MESURÉ, ET IL RETIRE AU LIEU D'AJOUTER.** **16 tuiles z13 à toutes les altitudes** — uniforme et stable dans la descente. Il n'ajoute qu'**au seuil de naissance** (+18 dessinées, +24 cache, +0,1 Mo — c'est le plancher, et il confirme *à l'exécution* ce que `seuil-socle.js` n'avait que dérivé) et **retire partout en dessous** : à 2 km, **−210 dessinées (−21,8 %), −280 en cache (−18,6 %), −1,9 Mo**. ⚠️ **CONTREPARTIE ASSUMÉE : le crop cesse de descendre à z15 et se cale à z13** — c'est la résolution du socle d'aujourd'hui, mais le globe savait faire plus fin.
- [ ] **Étape 5 — mutation** : retirer le `discard` doit tuer le test.
- [ ] **Étape 6 — REGARDER L'ÉCRAN** et dire ce qu'on voit.
- [ ] **Étape 7 — LA CLÔTURE DU §0**, puis commit.

### Tâche B — LES PAROIS ET LA BASE ⚠️ VERTICALES ET PARALLÈLES (décision 2)

**Fichiers :** modifier `src/globe.js` · lire `src/plinth.js` · tester `test/crop-parois.test.js` (créer)


⚠️ **LE BORD DU `discard` N'EST PAS ANTIALIASÉ, ET C'EST MESURÉ, PAS JUGÉ À L'ŒIL** : `gl.getContextAttributes().antialias === false`. Un `discard` donne une frontière binaire, donc les coins vont créneler.

**Décision, et elle est d'ingénierie, pas de goût : la paroi et la surface partagent EXACTEMENT la même courbe, et la surface passe d'un `discard` binaire à une COUVERTURE DOUCE** — `smoothstep` sur la distance signée à la frontière, sur une largeur d'environ un pixel écran. ⚠️ **Le `discard` reste au-delà d'un pixel**, sinon on paie le mélange sur toute la tuile. **Mesure la largeur en unités-monde à partir de la dérivée d'écran (`fwidth`), jamais une constante** — une constante serait juste à une seule altitude.

Des parois tombent depuis la frontière du crop jusqu'à une base. ⚠️ **Verticales et parallèles, pas radiales — c'est la décision d'Adrien, et elle prime sur la justesse physique.**

- [x] **Étape 1 — le test qui échoue** : le solide est **fermé** — `auditerSolide` rend `‖Ā‖ < ε`. ✅ **Fermeture relative mesurée : 8,7·10⁻¹⁸ pour un seuil de 1e-9**, huit ordres sous. ⚠️ **MAIS `hauteurs.distinctes > 2` NE MORD PAS ICI, ET C'EST MESURÉ** : un crop à relief RIGOUREUSEMENT NUL rend déjà **513** hauteurs distinctes, et un pavé à 1 200 m en rend **331** — la nappe suit la SPHÈRE, et sa sagitta (4,1 m au coin) est cinq ordres au-dessus du quantum de l'audit. **L'assertion est gardée et DOUBLÉE** par l'amplitude verticale, qui, elle, sépare : relief **×38,9** contre le solide plat, pavé **×1,003**.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue. ✅ Rouge, puis 24 tests verts.
- [x] **Étape 3 — implémenter.** ✅ `src/monde/parois-crop.js` (pur) + `globe.hauteurSurface`. **La frontière tombe au MILIEU des tuiles** : la hauteur se lit **au point de coupe exact**, par interpolation bilinéaire dans la tuile la plus fine. **Mesuré : accrocher au nœud le plus proche d'une tuile z13 à 512 px déplacerait le sommet de 29,96 m** — quatre texels et demi de socle. ⚠️ **Et le plancher de mer est celui du globe** (`max(h, 0)`, « oceans stay on the sphere ») : le suivre est obligatoire, sinon le liseré fait le tour de chaque côte.
- [x] **Étape 4 — les douze options de `buildSlabWalls`.** ✅ **Sept portées** : `depth` (⚠️ **en FRACTION de la largeur, 7/56** — recopier « 7 » aurait donné un puits de quarante fois la largeur du crop), `resolution`, `cornerR`, `cornerExp`, `baseYFloor`, `aoForce`, `aoBande` (+ le balayage intérieur de `computeSlab`, porté avec son test). **Cinq perdues** : `masqueArrondi` et `bords` sont **sans objet** (ils servent le damier, le crop est un bloc sans voisine) ; `chanfrein`, `arrondi`, `arrondiSeg` sont **une VRAIE perte, assumée** — machinerie de bissectrice/onglet + normales analytiques, le chanfrein entame la décision 2 en rétrécissant la base de 0,29 %, et leur garde-fou est calibré sur une exagération de 2,8 quand le globe est à 18. ⚠️ **Le bloc a donc des arêtes VIVES, en haut comme en bas.**
- [x] **Étape 5 — la couverture douce.** ✅ `smoothstep` sur la distance signée à la MÊME courbe, largeur `fwidth(d)`, `discard` au-delà d'un demi-pixel de chaque côté. **Largeur mesurée au canal alpha (cible RGBA8, rendu explicite) : 1 à 2 px à `dist` 2,0 ET à 1,05 — un zoom ×2,76 qui ne l'élargit pas** ; 1 141 pixels partiels pour un périmètre de 1 097. **Coût GPU** (`EXT_disjoint_timer_query_webgl2`, 17 images jetées puis **200** moyennées, crop plein écran 680×425, 37 appels, 50 102 triangles) : **0,2246 / 0,2194 ms** sans mélange contre **0,2571 / 0,2476 ms** avec — **+0,031 ms, soit +14 %**. ⚠️ **À 20 images le bruit noyait tout** (0,23 à 1,06 ms des deux côtés) : c'est la moyenne longue qui sépare. ⚠️ **COÛT NON MESURÉ** : `transparent` fait passer les tuiles dans la liste triée arrière-avant, donc leur surdessin perd le rejet Z précoce — invisible sur cette machine, à mesurer sur un portable et sur un tampon 4K.
- [x] **Étape 6 — mutation.** ✅ **Trois, ÉCRITES et non passées à la main** : retirer une paroi tue la fermeture, retirer le fond aussi, et **retourner toutes les faces PASSE la fermeture et tombe sur le volume signé** — la démonstration du §1 d'`audit-solide.js`, rejouée ici. Côté forme : chaque point d'anneau est SUR la frontière de `dansDalle` à ±1e-9, ce qu'un anneau tracé sur l'octogone ne peut pas être. ⚠️ **ET L'ANGLE EST MESURÉ** : au point d'anneau le plus proche de **44,3°** l'octogone est **0,1145 unité dehors (21,2 m au sol)** ; au plus proche de **45°** il n'est plus qu'à **0,0068 — dix-sept fois moins.**
- [x] **Étape 7 — REGARDER L'ÉCRAN.** ✅ **Au nadir, le crop est un bloc PLEIN de 48 × 46 px, sans un seul trou intérieur, bordé d'un liseré d'un pixel.** Les parois se voient à l'oblique et ferment le bord. ⚠️ **CE QUI EST LAID, ET IL FAUT LE DIRE : l'objet est DEBOUT.** À l'exagération 18 du globe, le relief de La Réunion fait **0,23 unité de haut pour 0,216 de large**, et sur un relief de synthèse alpin **0,77 pour 0,164 — près de cinq fois plus haut que large**. C'est la **Tâche E**, pas celle-ci. ⚠️ **Et un second défaut apparaît, qu'aucune tâche ne couvre encore** : la silhouette du bloc est désormais celle de la **PAROI**, qui est de la géométrie réelle et n'est donc **pas antialiasée** ; la couverture douce ne lisse que le bord du DESSUS contre le ciel. Coût des parois : **+1 appel de dessin, +3 060 triangles, 242,1 Kio** — et ce dernier chiffre se reconstitue : 9 180 sommets × (12 + 12 + 3) o = 247 860 o. **Reconstruction : 1,9 ms de médiane** (protocole du §0 : **17 jetées, 20 relevées**, p10 1,8 / p90 2,1, stable), à l'arrêt seulement (décision 5). ⚠️ **Le « 3,16 ms, moyenne de 5 » de la première version était au mauvais protocole** — et sur ce chantier même, la mesure de la couverture douce a montré qu'à 20 images le bruit noyait un écart de 14 %.
- [x] **Étape 8 — LA CLÔTURE DU §0**, puis commit. ✅ `npm test` **3 400** (3 376 + 24) · `audit:tests` 195/195 · `node --check` sur les quatre fichiers · `nettoie:dist` + `build:mapcells` + `vite build` + `verifie:dist` — « dist est complet ». Commit **127dcb5**.

> **TOUR DE CORRECTION 1 — ce qu'une relecture indépendante a trouvé, et qui n'était pas vu.** Cinq points, tous tenus :
> - ⚠️ **QUATRE ASSERTIONS ÉTAIENT VERTES DES DEUX CÔTÉS**, et c'est mesuré (`.banc/rejoue-B.mjs` contre `git show 69b32e5`) : `/smoothstep/` passait parce que le nuanceur en portait **déjà deux** hors du crop, et `discard;` / `uCropOn > 0.5` / `uCropOn: { value: 0` étaient **déjà posées mot pour mot** par `crop-sphere.test.js`. Remplacées par **huit** assertions rejouées fausses-avant / vraies-après, sur un bloc **borné des deux côtés**.
> - ⚠️ **`hauteurSurface` N'ÉTAIT TESTÉE QUE PAR UN `grep` DE SON NOM.** Quatre tests directs l'exercent maintenant (`.call` sur un objet minimal, patron de `globe-precision.test.js`) — et ils ont trouvé un défaut : **son repli d'antiméridien au `round` est FAUX dès que `n` vaut 1** (`.banc/repli-B.mjs`, 8 cas), la tuile unique d'un z0 rejetant la moitié de la planète. Passé au **modulo**, juste pour tout `n` et pour un `t.x` hors bornes.
> - ⚠️ **UNE TUILE ABSENTE DEVENAIT LE NIVEAU DE LA MER, EN SILENCE.** `return 0` sur un point non couvert creusait une **encoche** dans la paroi, et la `couverture` rendue n'était lue par personne. **Décision, écrite au §7 de `parois-crop.js` : la paroi REFUSE de se bâtir sous `couvertureMin`, qui vaut 1**, et le refus **ne touche pas aux parois déjà posées**. Le repli sur un ancêtre plus grossier, lui, existait déjà et reste gratuit. ✅ **Vu se déclencher en conditions réelles** : un crop posé 28 km hors de l'emprise du flux rend `couverture: 0`, `refus: 'couverture'`, et ne dessine rien.
> - ⚠️ **UN COMMENTAIRE DE SOURCE ÉTAIT FAUX** : `crop-sphere.js` affirmait que `crop-parois.test.js` vérifiait la composition en identité — **il ne le faisait pas**, et le « témoin indépendant » de la Tâche A **n'a pas le repli de longitude**. Corrigé, et les deux formules sont maintenant **opposées** sur un crop à cheval sur 180°, où elles divergent de **360° exactement**.
> - ⚠️ **`DoubleSide` + `gl_FrontFacing` RENDENT UN SOLIDE RETOURNÉ VISUELLEMENT IDENTIQUE** : le rendu neutralise l'invariant que la mutation défend. `DoubleSide` reste (la caméra entre dans le bloc pendant la descente) et l'invariant reste — parce que la carte d'ombre et l'export d'impression consomment le sens de parcours, et parce qu'**un audit qui accepte un solide retourné n'est pas un audit**. Écrit devant `_materiauParois`.
>
> **Campagne de mutation : dix posées, dix TUÉES**, chacune retirée et le fichier vérifié bit à bit avant la suivante (`.banc/mut-C.py`). `npm test` **3 425**, dont **+12 de ce tour** (le fichier passe de 24 à 36 tests) ; les 13 autres viennent de la **Tâche E, qui travaille en parallèle dans le même arbre** — ⚠️ `src/globe.js` et `package.json` portaient nos deux travaux en même temps, et le commit de ce tour ne stage que **la version HEAD + mes seules corrections** de `globe.js`, l'arbre de travail restant intact pour elle.

### Tâche C — L'HABILLAGE : LE GLOBE PREND LE RENDU DU SOCLE ⚠️ C'EST LA TÂCHE QUI DÉCIDE DU RÉSULTAT

**Fichiers :** modifier `src/globe.js` · lire `src/terrain.js` · tester `test/crop-habillage.test.js` (créer)

**Décision 6 : le rendu du socle est la RÉFÉRENCE.** Le nuanceur du globe doit porter ce que porte celui du socle : **courbes de niveau calées sur le relief local, grain, masque de côte, bathymétrie fusionnée, occupation du sol.**

⚠️ **C'EST LE SEUL POINT DONT LE COÛT EST INCONNU. Mesure-le AVANT d'implémenter**, et si le budget ne tient pas, **dis-le et propose une dégradation** plutôt que de livrer une image lente.

- [x] **Étape 1 — MESURER D'ABORD.** Coût par image du nuanceur du socle contre celui du globe, à même nombre de pixels. **Écris la table.** ✅ **Table ci-dessous — et elle INTERDIT le portage complet (×14) tout en AUTORISANT les quatre postes (+32 %).**
- [x] **Étape 2 — le test qui échoue** : sur une même emprise, le globe et l'ancien socle rendent **la même image à quelques unités de couleur près**. ⚠️ **Sers-toi de `readPixels` après un `composer.render()` explicite** — c'est ce qu'ont fait trois tâches du plan précédent. ⚠️ **CE CRITÈRE N'EST PAS ATTEIGNABLE À LA TÂCHE C SEULE, et c'est dit dans le bilan** : la rampe (Tâche D) et l'exagération (Tâche E, drapeau éteint) diffèrent par construction. Ce qui a été mesuré à la place : l'écart **avec / sans habillage**, `readPixels` après rendu explicite, **témoin exactement nul**.
- [x] **Étape 3 — implémenter, poste par poste**, en mesurant à chaque ajout. ✅ Quatre postes, quatre ajouts mesurés.
- [x] **Étape 4 — mutation** : retirer un poste doit tuer une assertion identifiée. ✅ **20 posées, 20 tuées**, dont une qui survivait.
- [x] **Étape 5 — REGARDER L'ÉCRAN**, côte à côte avec l'ancien socle. ✅ **Et il a fallu forcer ×2,8 pour que la vue soit lisible.**
- [x] **Étape 6 — LA CLÔTURE DU §0**, puis commit. ✅ Commit **`dc89f01`**.

> **BILAN DE LA TÂCHE C — 2026-08-21, commit `dc89f01`.**
>
> **⚠️ L'ÉTAPE 1 A TRANCHÉ, ET ELLE INTERDIT LE PORTAGE COMPLET.** Cible 900×900 hors écran, **boucle rAF gelée**, `autoClear` forcé, couverture 1,0 **prouvée**, 5 tours de 25 images **entrelacés**, RTX 3080 :
>
> | variante | ms pour 0,81 Mpx | ce que dit l'écart |
> |---|---|---|
> | **socle habillé** | **3,5656** | — |
> | **socle PBR nu** *(le même matériau, `onBeforeCompile` retiré)* | **1,9968** | **l'habillage COMPLET = 1,569 ms**, soit **1,94 ms/Mpx** |
> | socle témoin *(nuanceur constant)* | 1,1151 | le plancher de rastérisation du maillage |
> | **globe actuel** | **0,1720** | — |
> | globe témoin | 0,0604 | **le nuanceur ENTIER du globe = 0,112 ms**, soit **0,138 ms/Mpx** |
>
> **Porter tout l'habillage du socle, c'était multiplier le coût par pixel du globe par QUATORZE.** ⚠️ **C'est la réponse à la question du §9**, et elle est négative pour le portage intégral.
>
> **LES QUATRE POSTES DU PLAN, EUX, TIENNENT — et c'est mesuré sur le crop lui-même**, témoin de dérive **0,003 ms**, tours à ±0,01 ms :
>
> | état | ms | ajout |
> |---|---|---|
> | globe SANS habillage | 0,6728 | — |
> | + courbes calées sur le local | 0,6769 | **+0,0041** |
> | + grain | 0,6953 | **+0,0184** |
> | + masque de côte | 0,7946 | **+0,0993** |
> | + occupation du sol *(tout)* | 0,8878 | **+0,0932** |
> | **témoin — sans habillage, à la fin** | 0,6758 | dérive **+0,0030** |
>
> **+0,215 ms pour 0,81 Mpx, soit +32 % du coût du globe et SEPT FOIS MOINS que l'habillage complet.** ⚠️ **L'occupation du sol est le poste le plus cher** (huit accès de texture par fragment : `lavisSol` lit quatre voisins, `solEn` en fait deux chacun) — mais **elle ne coûte rien quand la couche est éteinte**, la branche étant gardée par un uniforme.
>
> **CE QUI EST PORTÉ, ET CE QUI NE L'EST PAS.** Porté : **courbes calées sur l'amplitude du crop** (pas cartographique — 250 m à La Réunion contre 500 m codés en dur), **grain** indexé sur le crop, **masque de côte** (trait d'encre + autorité sur la décision mer/terre), **occupation du sol**. ⚠️ **PAS porté, et il faut le dire** : analyse de relief (le peigné), perspective aérienne, caustiques de fond, photo aérienne, lumières de nuit, ombre des nuages, effets de surface, balayage. **Le plan ne les met pas dans cette tâche, et la mesure ci-dessus dit ce qu'ils coûteraient.**
>
> **LE FAIT QUI REND LE PORTAGE GRATUIT, ET IL EST DÉMONTRÉ.** Le bloc du socle est une fenêtre **mercator alignée sur les tuiles** : `latLonToWorld` (`geo.js:47`) plus `empriseSocle` (`seuil-socle.js:337-345`, qui prend `tuileX(lon,z) − tuilesParBloc/2` **sans arrondi**) donnent **`x = 28·u`**. Le globe lit donc les champs cuits du socle **AU MÊME TEXEL**, sans rééchantillonner : `cmUv = qCrop · 0,5 + 0,5`. ⚠️ **Aucune texture n'est recuite** — c'est le §5 appliqué : le dépôt ne grossit que de la loi et de sa transcription.
>
> **⚠️ TROIS TÉMOINS ONT REJETÉ TROIS TABLES AVANT CELLE-CI.** Les trois bancs sont sur le disque (`.banc/`, hors dépôt) :
> - **boucle rAF laissée tourner** : dérive **−1,589 ms** sur une référence à 3,455, et des postes **DÉJÀ ÉTEINTS** (`uSolOn = 0`) crédités de **3,235 ms d'économie** — couper ce qui est déjà coupé ne fait rien gagner. Table jetée, `gelePage()` écrit.
> - **`autoClear` vaut `false` dans cette application** : la cible n'est jamais effacée, donc la « preuve de couverture » ne trouvait **aucun** pixel magenta et rendait **1,0 quoi qu'il arrive** — une preuve vide, le piège « un test de silhouette passe à vide » du §3 de `/threejs-optimisation`. ⚠️ **Les couvertures des deux premiers bancs ne prouvaient donc rien.**
> - **un écart d'image de 1,867 unités qui ne s'est pas reproduit** : deux relances ont rendu **0,070**. Publié tel quel, il aurait décrit l'habillage comme quatre fois plus visible qu'il ne l'est.
>
> **CE QUE L'HABILLAGE CHANGE VRAIMENT À L'IMAGE** (`readPixels` après un rendu explicite, nadir sur le crop, 512², atmosphère/calottes/nuages masqués, fond de scène retiré ; **230 603 pixels dessinés**) — ⚠️ **et le témoin vaut EXACTEMENT ZÉRO**, réglage inchangé, deux prises bit à bit identiques : **tout écart non nul est donc l'effet, pas le bruit.**
>
> | | écart moyen | max | % de pixels touchés |
> |---|---|---|---|
> | **témoin (réglage inchangé)** | **0** | **0** | **0 %** |
> | habillage complet | 0,080 | 46 | **1,01 %** |
> | masque de côte | 0,029 | **46** | 0,37 % |
> | grain | 0,051 | 17 | 0,60 % |
> | courbes locales (250 m contre 500) | 0,023 | 18 | 0,34 % |
> | occupation du sol | 0 | 0 | 0 % — **couche éteinte dans l'application, poste non démontrable ici** |
>
> ⚠️ **UN POUR CENT DES PIXELS. IL FAUT LE DIRE COMME ÇA.** Les quatre postes de cette tâche sont une **finition**, pas une transformation. **Ce qui sépare encore l'image du globe de celle du socle, ce sont les deux termes que cette tâche n'a pas le droit de toucher : la RAMPE (Tâche D) et l'ANALYSE DE RELIEF (hors périmètre).**
>
> **CE QUE J'AI VU À L'ÉCRAN** (La Réunion, crop posé à la main depuis `.banc/pose-habC.js`, nadir, ×2,8 forcé pour que l'image soit lisible) : **les courbes sont deux fois plus nombreuses** et suivent le relief local ; **le littoral specké du MNT est remplacé par un trait franc**, et la mer cesse d'être un pointillé. ⚠️ **ET CE QUI EST LAID** : à l'exagération ×18 du globe **la vue au nadir est INJUGEABLE** — le relief de La Réunion fait **0,86 unité de haut pour 0,21 de large**, la montagne passe au-dessus de la caméra. Il a fallu forcer ×2,8 à la main (`?exag=continu` est éteint). ⚠️ **Et le crop reste une masse plate et brune tant que la rampe est mondiale** : `uLandMax = 5600` écrase les 3 000 m de La Réunion dans une seule bande. **C'est la Tâche D, et elle est plus urgente que tout ce que cette tâche a livré.**
>
> **LES TESTS.** 28 tests, dont **14 rejoués ROUGES contre `6b8ca66`** (`.banc/rejoue-habC.mjs`, laissé sur le disque). ⚠️ **Les 14 autres sont VERTES là-bas et c'est justifié** : elles portent sur le module pur (qui n'existait pas) ou sur `terrain.js` — ce sont des garde-fous contre une dérive **du socle**, pas des preuves du globe, et le fichier le dit. ⚠️ **Deux assertions candidates ont été jetées parce qu'elles ne distinguaient rien** : « le nuanceur porte `smoothstep` » (il en portait déjà quatre) et « il porte `texture2D(uRamp` ».
>
> **LA CAMPAGNE DE MUTATION : 20 posées, 20 TUÉES** (`.banc/mutations-habC.mjs`, laissé sur le disque, remise vérifiée octet par octet). ⚠️ **UNE SURVIVAIT** — M20 fige le PREMIER octave du grain, et les trois `notEqual` restaient verts parce que le second suffit à faire varier la somme. L'assertion a été renforcée : on retranche le second octave et on exige que le reste porte encore du signal.
>
> **LA CLÔTURE.** `npm test` **3 456** (3 428 + 28) · `audit:tests` 197/197 · `node --check` sur les trois fichiers · `nettoie:dist` + `build:mapcells` + `vite build` + `verifie:dist` — « dist est complet ». Page rechargée après commit, aucune erreur nouvelle en console.
>
> **CE QUE JE N'AI PAS PU VÉRIFIER.**
> - **L'occupation du sol n'a jamais été vue.** La couche est éteinte dans l'application (`uSolOn = 0`) et je n'ai pas trouvé son interrupteur ; son **coût** est mesuré (0,093 ms, texture bouchon), son **image** ne l'est pas.
> - **L'Étape 2 telle que le plan la formule — « le globe et l'ancien socle rendent la même image à quelques unités de couleur près » — N'EST PAS ATTEIGNABLE À LA TÂCHE C SEULE**, et ce n'est pas un échec de la tâche : la rampe (Tâche D) et l'exagération (Tâche E, drapeau éteint) diffèrent **par construction**. J'ai donc mesuré ce qui est mesurable — l'écart entre le globe **avec** et **sans** habillage, témoin à zéro — et je le dis plutôt que de maquiller le critère.
> - **Aucun branchement de production.** `poserHabillage` n'est appelé par personne dans `src/`, exactement comme `poserCrop` de la Tâche A. Tout ce qui précède a été obtenu depuis la console.
> - **Le coût sur une machine modeste.** Tout est mesuré sur une RTX 3080. Le +32 % pourrait mordre autrement sur un portable — et le tampon 4K multiplierait les 0,215 ms par dix.

### Tâche D — LA RAMPE : CALCULÉE SUR LE CROP, SUIVIE PAR LES ALENTOURS (décision 4)

**Fichiers :** modifier `src/globe.js` · tester `test/crop-rampe.test.js` (créer)

L'échelle mondiale fixe (`uLandMax = 5600`) disparaît. La rampe se calcule sur **le relief du crop**, et **toute la Terre visible l'applique**.

- [ ] **Étape 1 — le test qui échoue** : sur un crop à faible relief, la rampe **s'étale sur l'amplitude locale** ; et **le bord du crop ne montre aucune discontinuité de couleur**.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3 — implémenter.** ⚠️ **R1 : la rampe est une décision de RENDU, pas de cadrage — elle a le droit de lire le relief.** Mais **rien qui décide d'un cadrage ne doit la lire en retour**, sous peine d'oscillateur.
- [ ] **Étape 4 — la conséquence acceptée** : mesure la saturation des zones lointaines, **et écris-la**. Adrien l'a acceptée en connaissance de cause.
- [ ] **Étape 5 — mutation** : revenir à l'échelle mondiale doit tuer le test.
- [ ] **Étape 6 — REGARDER L'ÉCRAN.**
- [ ] **Étape 7 — LA CLÔTURE DU §0**, puis commit.

### Tâche E — L'EXAGÉRATION UNIQUE

**Fichiers :** modifier `src/globe.js` · lire `src/monde/exageration-continue.js` · tester

Le globe passe de **18** à la **courbe continue** partagée (décision 14). ⚠️ **Un écrivain, N lecteurs — le partage existe déjà et compte treize lecteurs. Le globe devient le quatorzième.**

⚠️ **Le pilote a déjà échoué deux fois** : piloté par l'altitude de cadrage il **diverge** (gain 1,44) ; piloté par la grandeur que le cran conserve il **gèle** à 2,8. **La forme retenue est `zc = demZoom + f`, bornée à `[z, z+1]` par construction.**

- [x] Test → rouge → implémenter → mutation → écran → clôture. ✅ **FAIT le 2026-08-21.** `test/exageration-globe.test.js` (13 tests) · `src/monde/exageration-continue.js` §4 bis · `src/globe.js` (`majExageration`) · `src/modes.js` (`zoomNiveau()`) · `src/main.js` (`cranCourant`).

**LE PILOTE — et il a été rejoué AVANT d'être écrit.** ⚠️ **`f = log2(dRef / d)`, la forme la plus évidente, a été ÉCARTÉE PAR LA MESURE** : au cran, `poseCranContinu` repose la caméra à `camY × facteurEchelle`, et `facteurEchelle = 2 × exagAprès / exagAvant` — **toute grandeur tirée de la pose d'après-cran porte l'exagération.** Rejouée à la main, la boucle s'écarte de la table dès le premier cran (5 au lieu de 2,5) puis se fige sur `EXAG_BASE` pour les six derniers : **c'est exactement le gel mesuré à l'écran**, et sa cause n'était pas la signature de `zoomCadrage`, qui est propre. **Le pilote retenu est `f = -_levelZoom / STEP_IN`** (`modes.js`) : `_rescale` l'écrase à zéro AVANT de reposer la caméra, et `_applyZoom` ne lui ajoute que `log(newDist / dist)`. La boucle est **coupée**, pas amortie. Il est déjà borné à `[-ln2, +ln2]`, donc `zc ∈ [z-1, z+1]` sans garde-fou ajouté — **et la borne est symétrique, pas `[z, z+1]`** : le dézoom doit glisser vers `z-1`, sinon le cran de sortie redevient un saut. **Continuité EXACTE au cran** : à la butée `zc = z+1`, puis `demZoom = z+1` et `_levelZoom = 0` donnent encore `z+1`. ⚠️ **CETTE DERNIÈRE PHRASE EST FAUSSE ET RETIRÉE — voir « Tour 1 » plus bas, R-1.**

**LA TABLE D'ADRIEN, RETROUVÉE À L'ÉCRAN** (La Réunion, neuf `_coarsen()` enchaînés, lu sur `exagPartage` **et** sur `globe.exaggeration`) : Z12→Z8 ×2,8 · **Z7 ×3,2** · **Z6 ×4** · **Z5 ×5** · **Z4 ×2,5** · Z3 ×2,5 — là où l'ancien pilote rendait ×2,8 partout. Les surcharges `localStorage` traversent (tests ②c, ③c). Et `f` glisse pour de vrai : douze images de glissé mesurées, `zc` de **3,043 à 3,417**, monotone. ⚠️ **CE GLISSEMENT N'ATTEINT JAMAIS L'EXAGÉRATION — voir « Tour 1 » plus bas, R-3.**

**LA MESURE DE CONTRÔLE — un bloc est redevenu un bloc.** Solide livré, base comprise, couverture 1,0 :

| | hauteur | largeur | rapport |
|---|---|---|---|
| **La Réunion ×18** (avant) | 0,70338 | 0,21539 | **3,27** |
| **La Réunion ×2,8** (après) | **0,13208** | 0,21463 | **0,615** |
| relief alpin de synthèse ×18 | 0,80843 | 0,16398 | **4,930** |
| relief alpin de synthèse ×2,8 | **0,14293** | 0,16295 | **0,877** |

⚠️ **LA LARGEUR N'EST PAS TOUT À FAIT CONSTANTE, ET L'ASSERTION QUI LE SUPPOSAIT A ÉCHOUÉ CONTRE LE DÉPÔT** : l'anneau est posé sur la surface DÉPLACÉE et le déplacement est RADIAL, donc un relief plus haut **évase** le bloc — **+0,6305 %, soit 1,027·10⁻³ unité (19 cm au sol)** entre ×18 et ×2,8. Deux ordres sous la variation de hauteur (×5,656) : le rapport mesure bien la hauteur. ⚠️ **Et le chiffre « 0,23 » de la Tâche B ne s'est pas reproduit** : même largeur (0,2154 contre 0,216, le crop est identique) mais une hauteur trois fois plus grande, parce que ce relevé-ci a **neuf tuiles z12 à 512 px et une couverture de 1,0**, sur une emprise qui monte à **2 607 m**. Le relevé de la Tâche B décrivait un crop bien moins chargé.

**LE GLOBE ENTIER — ACCEPTABLE, ET C'EST MESURÉ, PAS JUGÉ.** ⚠️ **« ACCEPTABLE » EST UNE CONCLUSION QUE CETTE MESURE NE PORTE PAS — voir « Tour 1 » plus bas, R-4.** Même pose orbitale (alt 420, océan Indien), mêmes 29 tuiles, image redimensionnée à 200×180 : l'écart moyen entre ×18 et ×2,8 vaut **5,098 unités de couleur**. ⚠️ **MAIS LE TÉMOIN LE NOIE** : deux images prises à ×2,8 **inchangée**, à 31 s d'intervalle, rendent **5,532** — les nuages en orbite déplacent plus de pixels que l'exagération. **Sans ce témoin j'aurais conclu « 27 % des pixels changent », ce qui est vrai et ne veut rien dire.** La courbe n'a donc PAS besoin de remonter aux altitudes orbitales. ⚠️ **Ce qui reste vrai géométriquement** : un sommet à 8 848 m sort de **2,50 % du rayon** à ×18 contre **0,39 %** à ×2,8 — sur ce cadrage (disque ~558 px), **≈7 px de silhouette contre ≈1 px**. ⚠️ **Et le relevé est fait à UNE pose, dont le limbe ne passe par aucune grande chaîne** : un limbe himalayen dirait peut-être autre chose.

⚠️ **LE COÛT, ET IL N'EST PAS PAYABLE TEL QUEL.** Le relief du globe est cuit dans les sommets : chaque changement de valeur passe par `setExaggeration` → `_rechargeTuiles`, qui rend au réseau **toutes** les tuiles prêtes. Mesuré deux fois, aller et retour, La Réunion z12 : **4,8 et 6,5 ms de travail synchrone** (868 maillages relâchés), puis **12 s et 21 s** pour retrouver ~900 tuiles prêtes. **À chaque cran.** La sortie est nommée par `_rechargeTuiles` lui-même — déplacer le relief dans le nuanceur de sommets — et ce n'est pas cette tâche. ⚠️ **CONSÉQUENCE : `syncExagToZoom` n'est appelé qu'AU CRAN**, donc la courbe est juste et continue mais encore **ÉCHANTILLONNÉE aux crans** ; le glissement de la décision 14 ne se voit pas encore à l'écran entre deux crans. **C'est la vraie limite de cette tâche.**

⚠️ **CE QUI EST LAID, ET IL FAUT LE DIRE.** Le bloc tient enfin dans le cadre et se lit comme un bloc. Mais **les JUPES des tuiles du globe pendent sous lui comme des rideaux** — cinq à six languettes qui descendent bien plus bas que la base. Le `discard` du crop est en lat/lon, et une jupe partage le (lat, lon) du bord de sa tuile : **elle n'est donc jamais coupée.** Aucune tâche du plan ne couvre ce défaut. Et la couleur du dessus reste la rampe du globe (vert/tan) contre des parois beige-gris : c'est la Tâche C.

⚠️ **CE QUI N'A PAS PU ÊTRE VÉRIFIÉ** : le crop n'a **pas** été vu sous `frontiere=0` (la Tâche B le demandait) ; sous `frontiere=1` il a fallu **masquer le socle à la main** pour le voir, parce qu'il est dessiné par-dessus. Et `globe.enabled` valait `false` en mode surface pendant tout le relevé.


#### Tour de correction 1 — ce que la relecture a trouvé, et ce que la mesure a tranché

⚠️ **CETTE SECTION S'AJOUTE AU BILAN CI-DESSUS, ELLE NE LE REMPLACE PAS.** Les phrases corrigées restent en place avec un renvoi ici : c'est la règle des listes du §0, appliquée à un compte rendu.

**R-1 — L'INVARIANT « CONTINUITÉ EXACTE AU CRAN » ÉTAIT FAUX, ET LE TEST QUI LE GARDAIT ÉTAIT POSÉ LÀ OÙ IL NE POUVAIT PAS MORDRE.** Le cran ne se déclenche pas qu'à la butée du budget : `atInLimit` (`modes.js`) porte **trois** voies — `_levelZoom <= -STEP_IN + 0.03`, `dist <= minDistance × 1.02`, et `nearGround()` — et **les deux dernières tombent à un `_levelZoom` arbitraire**. Balayage complet, `f` de 0 à 1 sur z3→z12 :

| voie | `f` au déclenchement | saut d'exagération |
|---|---|---|
| budget, butée **exacte** | 1 | **0 %** (tous zooms, écart nul) |
| budget, **avec sa tolérance réelle** de 0,03 | 0,95672 | **≤ 1,017 %** (pire : z5, 4,0411 → 4) |
| `nearGround()` / `minDistance` | 0,5 | **33,3 %** (z4, 3,750 → 5) |
| `nearGround()` / `minDistance` | 0 | **100 %** (z4, 2,5 → 5) |

⚠️ **Et mon test ①b était posé exactement à `f = ±1`, l'endroit où les deux formes coïncident** — le piège que la Tâche A avait su retourner en assertion (superellipse contre octogone, écart NUL à 45°). Il est **restreint et renommé** (« sur la voie du budget, et sur elle seule »), et **①e est ajouté** : il mesure les trois lignes du tableau et garde par la source que `atInLimit` a toujours ses trois voies et sa tolérance de 0,03. ⚠️ **Ce n'est pas une régression** : la table en escalier d'aujourd'hui saute de 100 % à ce cran-là sur **toutes** les voies ; le pilote l'annule sur celle du budget et laisse les deux autres intactes.

**R-2 — UNE ASSERTION NE DISTINGUAIT RIEN.** `/_levelZoom\s*=\s*0/` était cherché sur **tout `modes.js`** et tombait sur la **déclaration du champ, ligne 222**. **Vider entièrement `_resetZoom()` la laissait verte** — alors que c'est la propriété dont dépend toute la borne du pilote. Elle est désormais bornée au **corps de `_resetZoom`**, et la mutation M5 la tue.

**R-3 — `f` EST STRUCTURELLEMENT MORT EN PRODUCTION, ET JE L'AVAIS LAISSÉ CROIRE AUTREMENT.** La chaîne du cran est : molette → `_resetZoom()` → `_refine()` → `_rescale()` → **`_resetZoom()` encore** → `loadSurface` → `fetchAndBuildDem` → `syncExagToZoom`. **Quand le pilote lit `_levelZoom`, il vaut donc toujours zéro.** Mon relevé « `zc` de 3,043 à 3,417 » est vrai pour le PILOTE — je l'ai obtenu en appelant `_applyZoom` à la main — mais **cette valeur n'atteint jamais l'exagération**. Sur les **trois** sites d'appel (`fetchAndBuildDem`, `entrerEnVol`, `resetZoomExag` — le bilan disait quatre, corrigé par la re-relecture après un `grep` exhaustif) de `syncExagToZoom`, **un seul** peut voir un `_levelZoom` non nul : le bouton « réinitialiser l'exagération » de l'IHM. **Ce que la Tâche E livre est donc la table d'Adrien, juste, à chaque cran — pas une courbe qui glisse.** Nouveau test ②a ter : il garde l'ordre `_resetZoom()` avant `loadSurface` et échoue si quelqu'un le change sans relire ①e.

**R-4 — « ACCEPTABLE » N'EST PAS CE QUE MA MESURE DIT.** L'écart moyen absolu (5,098 contre un témoin à 5,532) **ne sait pas distinguer** le passage de ×18 à ×2,8 du bruit des nuages ; ce n'est pas la même chose que « l'écart est négligeable ». Une moyenne sur toute l'image **noie par construction** une perte localisée et structurée — et mon propre chiffre géométrique en décrit une : la silhouette du limbe passe de **≈7 px à ≈1 px**. **La conclusion honnête est : « la métrique employée ne sépare pas l'effet du bruit », et la question reste ouverte pour Adrien.** Il faudrait un critère perceptif local (limbe seul, chaîne montagneuse dans le cadre, nuages figés) pour trancher ; **je ne l'ai pas fait**.

**R-5 — LA CAMPAGNE DE MUTATION N'AVAIT AUCUNE SOURCE.** Le test citait `.banc/mutations-E.mjs` : **je l'avais supprimé au nettoyage**, alors que la Tâche B avait laissé le sien. Il est reposé, **élargi de 5 à 11**, et chacune nomme l'assertion qu'elle tue :

| mutation | fichier | assertion tuée |
|---|---|---|
| M1 — le constructeur revient à 18 | `globe.js` | ③d |
| M1b — `majExageration` ignore le partage | `globe.js` | ③, ③c |
| M1c — le globe se recharge pour rien | `globe.js` | ③ |
| M2 — la courbe perd les surcharges | `exageration-continue.js` | ②c, ③c |
| M3 — `f` non borné | `exageration-continue.js` | ①c |
| M4 — le pilote ignore `f` | `exageration-continue.js` | ①b, ①e |
| M4b — borne `[z, z+1]` au lieu de `[z-1, z+1]` | `exageration-continue.js` | ①b |
| M5 — `_resetZoom()` vidé | `modes.js` | ①d |
| M6 — `atInLimit` perd `nearGround()` | `modes.js` | ①e |
| M7 — `_resetZoom()` après `loadSurface` | `modes.js` | ①d, ②a ter |
| M8 — `cranCourant` repilote par la caméra | `main.js` | ②a bis |

⚠️ **M1 ET M5 NE TUAIENT RIEN AVANT CE TOUR** — c'est ce qui a fait naître ③d puis corriger ①d. **Les onze tuent maintenant leur assertion nommée.**

**R-6 — LE GARDE ANTI-BOUCLE ÉTAIT AU MAUVAIS ENDROIT.** Il portait sur `zoomCran`, un module **pur** qui ne peut pas lire l'exagération : il ne reçoit que ce qu'on lui donne. **Le risque est dans ce qu'on lui DONNE**, c'est-à-dire `cranCourant`, qui vit dans `main.js` — le seul fichier qu'aucun test ne charge. Nouveau test ②a bis : `cranCourant` ne lit ni `exag`, ni `echelleBloc`, ni `altitudeCadrage`, ni `camera`, ni `controls`, ni `dem`, et **ne lit que** `params.demZoom` et `zoomNiveau`. Mutation M8.

**Bilan du tour : 13 tests → 16**, et la campagne passe de 5 mutations sans source à **11 rejouables**, dont deux qui ne tuaient rien.

### Tâche F — LA MER, PARTOUT ET DÉGRADÉE AVEC LA DISTANCE (décision 5)

**Fichiers :** modifier `src/ocean.js` (1 825 lignes) · tester `test/mer-sphere.test.js` (créer)

La mer cesse d'être un plan à hauteur fixe cuit sur une grille plate : elle devient une **calotte sphérique** au niveau de la mer, avec ses vagues, son écume et sa profondeur. ⚠️ **Complète près de la caméra, simplifiée au loin — et la bascule ne doit pas se voir.**

- [ ] **Étape 1 — MESURER le coût de la mer riche** à trois distances. **Écris la table.**
- [ ] **Étape 2 — le test qui échoue** : la mer suit la sphère (un point à 100 km du centre du crop est **plus bas** qu'au centre, de la sagitta), et **le raccord au bord du crop est continu**.
- [ ] **Étape 3 — implémenter la calotte**, en réutilisant la fusion bathymétrique déjà dans le flux.
- [ ] **Étape 4 — la dégradation** : **À MESURER** — où placer la bascule pour qu'elle ne se voie pas. **Protocole : comparer deux images à la bascule, exiger un écart de couleur sous le seuil de perception.**
- [ ] **Étape 5 — mutation** : figer la mer à un plan doit tuer le test de sagitta.
- [ ] **Étape 6 — REGARDER L'ÉCRAN**, sur une côte franche.
- [ ] **Étape 7 — LA CLÔTURE DU §0**, puis commit.

### Tâche G — L'ESTOMPAGE DE LA TERRE AUTOUR (décision 3)

**Fichiers :** modifier `src/main.js` (la passe de fond) · tester

⚠️ **ET C'EST ELLE QUI RÉPARE CE QUE LA TÂCHE A A RENDU BIZARRE.** Relevé à l'écran après la découpe : **l'atmosphère et les nuages ne sont PAS coupés** (matériaux séparés), donc la planète reste « une grosse boule laiteuse avec un timbre-poste dessus ». Les calottes polaires non plus — sans effet à l'échelle du socle. **Tant que cette tâche n'est pas faite, l'image ne peut pas être jugée.**


La planète autour du crop **se fond progressivement vers le fond** à mesure qu'on descend, pour que le bloc se détache. ⚠️ **La Tâche 1b bis a laissé la porte ouverte : « un fondu croisé en espace-écran est trivial avec deux passes ».** Ici il n'y a plus deux mondes, mais le fondu reste en espace-écran.

⚠️ **R1 : le paramètre du fondu est une ALTITUDE, jamais une fraction d'écran.**

- [ ] Test → rouge → implémenter → mutation → écran → clôture.

### Tâche H — LA DÉPOSE ⚠️ EN DERNIER

Retirer `monde/fenetre-bornee.js`, le chemin « bloc » de `terrain.js`, et les drapeaux devenus inutiles. ⚠️ **Ne commence pas avant que tout le reste soit vert à l'écran.** **Le dépôt doit avoir MAIGRI.**

---

## 7. Ordre imposé

**A** (la découpe) → **B** (les parois) → **C** (l'habillage) → **D** (la rampe) → **E** (l'exagération) → **F** (la mer) → **G** (l'estompage) → **H** (la dépose).

⚠️ **C avant D** : la rampe est un poste de l'habillage, mais elle a sa tâche parce qu'elle porte une décision produit. ⚠️ **F après C** : la mer réutilise le nuanceur unifié. ⚠️ **H en dernier, toujours.**

---

## 8. Ce qui reste ouvert pour Adrien

- **Le bloc a des arêtes VIVES** (Tâche B, Étape 4) — le **chanfrein** d'arête haute et le **congé** bas de `plinth.js` ne sont pas portés. C'est le geste qu'Adrien avait lui-même demandé sur le socle (« il est vraiment arrondi, et c'est un vrai chanfrein dessous ») : **la perte est visible, et elle est devant lui, pas cachée dans un commentaire.** Trois raisons de l'avoir différée, toutes dans l'en-tête de `parois-crop.js` ; la troisième est datante — leur garde-fou (`min(x, (topMax − baseY) × 0,25)`) est calibré sur une exagération de **2,8**, et le globe est à **18**. **À reposer après la Tâche E**, pas avant.
- **Le bord de la PAROI n'est pas antialiasé** (relevé par la Tâche B) — la couverture douce ne couvre que la surface ; la silhouette du bloc, elle, est de la géométrie, et `antialias === false`. Reste à trancher : on vit avec, ou on paie une passe.
- **La transition d'apparition du crop** (décision 4 du plan précédent : « le socle complet apparaît d'un coup, **avec une transition à dessiner** ») — elle n'est toujours pas dessinée, et le rideau qui la masquait est parti.
- **L'indicateur affiche encore un numéro de zoom** quand il n'y a plus de socle.
- **Le raccord de palette au bord du crop** — la Tâche D doit le supprimer ; s'il subsiste, c'est un arbitrage de goût.
- **Les crops continentaux** que la sphère rend enfin possibles : les veut-il, et à quelle largeur maximale ?
- **LES JUPES DES TUILES PENDENT SOUS LE BLOC** (relevé par la Tâche E, à l'écran) — cinq à six languettes qui descendent sous la base. Le `discard` du crop est en **lat/lon**, et une jupe partage le (lat, lon) du bord de sa tuile : elle n'est **jamais** coupée. Aucune tâche du plan ne la couvre. Deux sorties possibles, aucune mesurée : couper la jupe par sa hauteur radiale plutôt que par sa position, ou ne pas bâtir de jupe sur une tuile qui touche la frontière.
- **LE RELIEF DU GLOBE VU DE LOIN, À TRANCHER** (Tâche E, tour 1) — à ×2,8 la silhouette du limbe passe de **≈7 px à ≈1 px** sur un cadrage plein disque. **La métrique employée (écart moyen absolu sur l'image) ne sait pas distinguer cet effet du bruit des nuages** — elle n'autorise donc pas à conclure « acceptable ». Il faudrait un critère LOCAL (limbe seul, chaîne montagneuse dans le cadre, nuages figés) pour trancher ; il n'a pas été fait. **Si Adrien veut du relief à l'orbite, la courbe doit remonter aux hautes altitudes — et c'est une mesure à faire, pas un goût.**
- **L'OCCUPATION DU SOL DU CROP N'A JAMAIS ÉTÉ VUE** (Tâche C) — la couche est éteinte dans l'application, son coût est mesuré (0,093 ms pour 0,81 Mpx, le poste le plus cher des quatre) mais son image ne l'est pas. **À rallumer et à regarder.**
- **LE PEIGNÉ (analyse de relief) RESTE AU SOCLE, ET C'EST LUI QU'ON VOIT** (Tâche C) — les quatre postes portés ne déplacent que **1,01 % des pixels**, témoin à zéro. Ce qui fait la richesse de l'image du socle, c'est le texture shading et la rampe locale. **Le porter coûterait 1,94 ms/Mpx au tarif complet ; sa part seule reste à mesurer.**
- **LA VUE AU NADIR DU CROP EST INJUGEABLE À ×18** (Tâche C, à l'écran) — le relief de La Réunion fait 0,86 unité de haut pour 0,21 de large, la montagne passe au-dessus de la caméra. `?exag=continu` (Tâche E) le corrige, mais il est éteint.
- **LE COÛT DE L'EXAGÉRATION DU GLOBE** (Tâche E) — **12 à 21 s de rechargement réseau à chaque cran**, parce que le relief est cuit dans les sommets. Tant qu'il n'est pas déplacé dans le nuanceur de sommets, `?exag=continu` ne peut pas devenir le défaut, et la courbe reste échantillonnée aux crans au lieu de glisser.

---

## 9. Auto-revue

**Ce plan retire plus qu'il n'ajoute** — c'est son critère de réussite, pas un effet de bord.

⚠️ **Le risque principal est la Tâche C.** Si le nuanceur du socle ne tient pas sur une sphère de tuiles à budget constant, tout le chantier se réduit à « deux Terres qui se ressemblent », c'est-à-dire au palliatif qu'Adrien a refusé. **C'est pour ça que sa première étape est une mesure, et non une implémentation.**

⚠️ **Le second risque est la frontière.** La découpe tombe au milieu des tuiles ; le plan précédent a nommé ce problème « on ne coud pas les tuiles » et l'a résolu en rééchantillonnant. **Ici on ne peut plus : il faut couper.** La différence est qu'on coupe le long d'une **courbe**, pas d'une surface — et que `dansFenetre` donne cette courbe exactement.

**Aucun chiffre de ce plan n'est inventé.** Ils viennent tous du plan précédent, où ils ont été mesurés, ou portent la mention « À MESURER » avec leur protocole.
