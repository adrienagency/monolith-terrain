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
> ⚠️ **UN TOUR DE CORRECTION SUIT CE BILAN — voir « Tour de correction 1 » plus bas.** Une relecture indépendante a rendu **conformité ❌** : mes vingt mutations déplaçaient la chaîne que l'assertion cherche, pas le comportement, et **douze mutations sémantiques survivaient**. Les chiffres de ce bilan sont refaits en monnaie unique ; **les phrases fautives restent ici, avec leur renvoi.**
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
> ⚠️ **CE « QUATORZE » NE TIENT PAS, ET IL EST RETIRÉ — voir « Tour de correction 1 », C-4.** Il comparait la pente du socle à un nuanceur du globe relevé sur un TOUT AUTRE cadrage : deux « coût du globe » cohabitaient au même 900² d'un facteur 3,9. En monnaie unique, le portage complet vaut **×1,90**. ⚠️ **Et la couverture annoncée dans la ligne de protocole ci-dessus n'était pas prouvée** : `autoClear` vaut `false` dans cette application, côté globe comme côté socle — voir I-1. **La conclusion — le portage intégral est refusé — ne change pas ; son ampleur, si.**
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
> ⚠️ **CETTE LIGNE EST FAUSSE SUR DEUX POINTS, ET ELLE EST CORRIGÉE PLUS BAS — voir « Tour de correction 1 », C-4 et I-3.** Le « +32 % » est calculé sur un dénominateur qui contient l'atmosphère et les nuages ; en monnaie unique il vaut **+34 %**. Et « le poste le plus cher » était **contredit par ma propre table** — le masque de côte y coûtait 0,0993 contre 0,0932 — d'un écart lui-même **sous le bruit** : cette table ne pouvait pas trancher. Le relevé du Tour 1 tranche, et il donne raison à la phrase pour de mauvaises raisons.
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


#### Tour de correction 1 — ce qu'une relecture indépendante a trouvé, et ce que la mesure a tranché

⚠️ **CETTE SECTION S'AJOUTE AU BILAN CI-DESSUS, ELLE NE LE REMPLACE PAS.** Les phrases fautives restent en place avec un renvoi ici : c'est la règle des listes du §0, appliquée à un compte rendu.

**Verdict de la relecture : conformité ❌, qualité approuvée sous réserve — 3 Critiques, 8 Importants, 9 Mineurs.** Elle a en revanche vérifié et validé, point par point : que les 20 mutations tuaient bien leur assertion et remettaient les fichiers octet par octet, que les 14 assertions vertes contre `6b8ca66` étaient justifiées **une par une** (12 sur le module pur, 2 garde-fous sur `terrain.js`), que les drapeaux étaient éteints et le damier intouché, et que mon constat sur l'Étape 2 était honnête.

**C-1 — MES VINGT MUTATIONS DÉPLAÇAIENT LA CHAÎNE CHERCHÉE, PAS LE COMPORTEMENT. C'est le grief central, et c'est lui qui vaut la non-conformité.** Le relecteur a monté sa propre campagne — **15 mutations sémantiques, 12 ONT SURVÉCU** : la garde v42 supprimée du GLSL, le grain réindexé sur `vUv`, **le grain qui mord sous l'eau**, **la marge jamais convertie (`uMargeCoteM = 0`)**, **l'intervalle jamais calé (retour à 500)**, **`poserHabillage` qui n'allume rien**, **`retirerHabillage` qui ALLUME**. **On pouvait casser l'habillage de six façons sans qu'un test rougisse : l'Étape 4 n'était remplie que dans sa lettre.**

**La parade — et elle est structurelle, pas cosmétique.** Deux sections neuves, **⑨** et **⑩** :
- **⑨ exerce `poserHabillage` et `retirerHabillage`** au lieu de les greper (`Globe.prototype.X.call` sur un objet minimal, le patron de la Tâche B). Dix tests.
- **⑩ EXTRAIT le GLSL et l'EXÉCUTE** au lieu de le décrire (le patron de `test/crop-rampe.test.js`, Tâche D) : on prend le texte du nuanceur, on le traduit en JS, on l'appelle, et **on confronte son verdict à celui du module pur** — `sousEauCrop`, `uvChampCrop`, `uvDrapeCrop`, `grainCrop` servent d'oracle. La garde v42 est ainsi rejouée sur **5 043 cas**, les deux UV sur **441 points** chacun. Dix tests.

**Nouvelle campagne : `.banc/mutations-habC-semantiques.mjs`, 31 mutations SÉMANTIQUES, 31 TUÉES**, dont les sept que le relecteur nommait. ⚠️ **Et elle tourne dans une COPIE du dépôt** (`git worktree add ../wt-mutC-habillage`), pas dans l'arbre partagé — son propre passage avait muté `src/` pendant qu'un autre implémenteur travaillait. ⚠️ **L'ancienne campagne reste sur le disque** : elle documente ce qui ne suffisait pas.

⚠️ **ET LA SECTION ⑩ A TROUVÉ DEUX DÉFAUTS DANS ELLE-MÊME AVANT DE TROUVER QUOI QUE CE SOIT D'AUTRE** : ⑩a capturait `bool sousEau = h < 0.0;` au lieu de l'affectation sous le masque — le motif « sousEau = » est CONTENU dans « bool sousEau = », et `String.match` rend la première occurrence ; l'assertion aurait été rouge sur du code juste et verte sur la mutation qu'elle vise. Et ⑩e trouvait `vUv` dans un **commentaire** du bloc. Les deux sont corrigés, et le motif de la correction est écrit dans le test.

**C-2 — `poserHabillage` N'ÉTAIT PAS TESTÉE DU TOUT.** Quarante lignes derrière un grep de nom — mot pour mot ce que la relecture de la Tâche B avait déjà remonté sur `hauteurSurface`. **Elle l'est maintenant, et comme là-bas, la poser a révélé un vrai défaut** (C-3).

**C-3 — UN VRAI DÉFAUT : `retirerHabillage` NE REMETTAIT PAS `uContourInterval`.** `uContourInterval` et `uContourOpacity` sont **PARTAGÉS** par toutes les tuiles, et le bloc des courbes les lit **SANS GARDE** — `uHabOn` à 0 ne les neutralise pas. `poserHabillage` les écrasait ; `retirerHabillage` n'en rendait que quatre sur seize. **Après `retirerCrop`, la planète entière gardait l'intervalle du crop** : 250 m à La Réunion au lieu de 500. Ma docstring promettait « le globe reprend son propre rendu, **au bit près** ». **Corrigé** : une constante unique `HABILLAGE_MONDE` (gelée) dans le module pur, lue **par le constructeur ET par `retirerHabillage`** — c'est `RAMPE_MONDE` de la Tâche D repris tel quel. `retirerHabillage` rend maintenant **les seize**, textures comprises (elles étaient retenues par un uniforme partagé). Tests ⑨h, ⑨i, ⑨j ; mutations S19, S22, S23.

---

**C-4 — LA TABLE VALAIT COMME INTERDICTION, PAS COMME AUTORISATION.** Deux « coût du globe » cohabitaient au même 900² **sans être réconciliés** — **0,1720 ms** (Étape 1, cadrage sur une tuile z13) et **0,6728 ms** (Étape 3, cadrage sur le crop, atmosphère comprise), **facteur 3,9**. Le « ×14 » était en ms/Mpx de nuanceur ; le « +32 % » était calculé sur le dénominateur le plus large, **celui qui contient l'atmosphère et les nuages que mon propre banc d'image avait dû masquer parce qu'ils remplissent le cadre.**

**I-1 — ET UNE QUATRIÈME MESURE MENTAIT, celle-là même que j'avais présentée comme la version qui tient.** `mesure-C3.prepareGlobe()` ne posait aucun calque, rendait `sceneGlobe` **entière**, et l'atmosphère remplit le cadre : la « preuve de couverture » rendait **1,0 quelle que soit la présence des tuiles**. Et **le filtre `t.mesh.visible !== false` de `mesure-C.js:94` avait été PERDU** dans la réécriture vers `mesure-C3.js:53`.

**TOUT EST REFAIT SUR UN SEUL BANC — `.banc/mesure-C5.js`** : une seule préparation de scène (atmosphère, calottes et nuages masqués **des deux côtés**, fond de scène retiré, filtre `visible` remis), **un seul protocole écrit dans `PROTOCOLE`** (cibles 480² et 900², 5 tours de 25 images, 12 jetées, boucle rAF gelée, `autoClear` forcé), couverture **prouvée** à 1,0 partout, et **les sorties brutes sont sur le disque** (`.banc/C5-brut.json`, `.banc/C5-postes-brut.json`) — le relecteur a eu raison de relever qu'aucune ne l'était : sans elles, personne ne peut confronter mes valeurs, seulement les refaire.

**LA MONNAIE UNIQUE — ms par mégapixel de FRAGMENT** (pente entre les deux tailles, témoin au nuanceur constant déduit sur la **même** géométrie) :

| | ms/Mpx | rapport au nuanceur du globe |
|---|---|---|
| **habillage COMPLET du socle** | **0,527** | **×1,90** |
| **nuanceur ENTIER du globe** | **0,277** | ×1 |
| **les quatre postes de la Tâche C** | **0,094** | **×0,34, soit +34 %** |

⚠️ **« QUATORZE » NE TIENT PAS, ET JE LE RETIRE.** En monnaie unique, porter tout l'habillage aurait coûté **1,9 fois le nuanceur entier du globe**, pas quatorze. ⚠️ **« SEPT FOIS MOINS » NE TIENT PAS NON PLUS** — le relecteur me l'accordait, mais il ne survit pas à la réconciliation : le rapport est **5,6** en per-pixel (et 11,9 en total à 0,81 Mpx). ⚠️ **« +32 % » devient +34 %** — proche par accident, calculé faux.

⚠️ **ET LE COÛT DU SOCLE EST SURTOUT FIXE, PAS PAR PIXEL — c'est le fait le plus utile de ce tour.** À 0,81 Mpx l'habillage complet coûte **1,087 ms**, dont **0,660 ms sont FIXES** : les douze liens de texture et les uniformes, payés une fois par appel de dessin. Les quatre postes, eux, coûtent 0,091 ms dont **0,015 seulement** de fixe. ⚠️ **Cela change la lecture du refus** : ce n'est pas tant le calcul du socle qui serait insoutenable sur une sphère de tuiles, **c'est son bagage de textures — répété à chaque tuile au lieu d'une fois par bloc.**

⚠️ **ET LE TÉMOIN DU SOCLE REND UNE PENTE NÉGATIVE** (−0,035 ms/Mpx) : un nuanceur à couleur constante sur 1,18 million de triangles coûte le même temps à 480² et à 900². **Le plancher du socle est lié au SOMMET, pas au pixel.** Ce n'est pas du bruit qu'on écarte, c'est un fait — et il interdit de lire le coût par pixel du socle sur son témoin.

**LE COÛT POSTE PAR POSTE, AU MÊME PROTOCOLE** (cible 900², crop de La Réunion, 172 tuiles z13) :

| état | ms | ajout |
|---|---|---|
| globe SANS habillage | 0,4157 | — |
| + courbes calées sur le local | 0,4291 | **+0,0134** ⚠️ |
| + grain | 0,4905 | +0,0614 |
| + masque de côte | 0,5059 | **+0,0154** ⚠️ |
| + occupation du sol (tout) | 0,6840 | **+0,1781** |
| témoin, sans habillage, à la fin | 0,4209 | dérive **+0,0052** |

**I-2 — LE PLANCHER DE BRUIT VAUT 0,0297 ms, ET DEUX POSTES TOMBENT DESSOUS.** Les courbes (+0,0134) et le masque de côte (+0,0154) : **leur coût n'est pas mesuré, il est BORNÉ.** Ce banc dit qu'ils coûtent moins de 0,03 ms ; il ne dit pas combien. Le relecteur demandait de le dire pour un poste — il y en a **deux**.

**I-3 — « L'OCCUPATION DU SOL EST LE POSTE LE PLUS CHER » ÉTAIT CONTREDIT PAR MA PROPRE TABLE, et l'erreur était répétée au §8.** Dans la table livrée, le masque de côte la dépassait (+0,0993 contre +0,0932) — **de 0,0061 ms, très en dessous du bruit : cette table-là ne pouvait pas trancher, et j'ai tranché quand même.** La nouvelle tranche, et **elle donne raison à la phrase pour de mauvaises raisons** : l'occupation du sol coûte **+0,1781 ms contre +0,0154**, soit **onze fois plus**. ⚠️ **Le §8 est corrigé.**

⚠️ **ET LE TOTAL DÉPEND DE L'ÉTAT DE LA COUCHE** : **+0,2683 ms** avec l'occupation du sol allumée, **+0,0911 ms** avec elle éteinte — c'est-à-dire **telle qu'elle est dans l'application aujourd'hui**. Le chiffre de la monnaie unique (0,094 ms/Mpx) est celui de la couche éteinte, le seul relevé aux deux tailles.

**I-4 — TROIS PROTOCOLES DÉCRIVAIENT LA MÊME TABLE** (« 5 tours de 25 » au plan, « 4 tours × 20 » dans `globe.js`, 7×30 par défaut du banc). **Il n'y en a plus qu'un**, exporté sous le nom `PROTOCOLE`, et les deux tables ci-dessus en sortent.

**I-5 — LE SEUIL DE « 1,01 % DES PIXELS » N'ÉTAIT PAS DÉCLARÉ.** C'est `d > 2` unités de couleur sur 255. Il est maintenant exporté (`SEUIL_TOUCHE`) et motivé dans `.banc/image-C.js`.

---

**CE QUE CE TOUR N'A PAS FAIT, ET QU'IL FAUT DIRE.**
- **Le relevé d'image (1,01 % des pixels, témoin à zéro) N'A PAS ÉTÉ REFAIT** sur le banc unifié. Il reste juste — son témoin vaut exactement zéro — mais il tourne sur son propre cadrage et son propre masquage. **Deux protocoles subsistent donc : celui des temps, unifié ; celui des couleurs, non.**
- **L'occupation du sol n'a toujours pas été VUE.** Son coût est mesuré deux fois, son image jamais.
- **Rien n'a été remesuré sur une machine modeste.**

### Tâche D — LA RAMPE : CALCULÉE SUR LE CROP, SUIVIE PAR LES ALENTOURS (décision 4)

**Fichiers :** modifier `src/globe.js` · tester `test/crop-rampe.test.js` (créer)

L'échelle mondiale fixe (`uLandMax = 5600`) disparaît. La rampe se calcule sur **le relief du crop**, et **toute la Terre visible l'applique**.

- [x] **Étape 1 — le test qui échoue.** ✅ `test/crop-rampe.test.js`, **35 tests**. ⚠️ **NEUF CANDIDATES REJOUÉES AVANT D'ÊTRE ÉCRITES** (`.banc/rejoue-D.mjs`, laissé sur le disque) contre **cinq** lois : le dépôt (`82e8b87`), une rampe locale **naïve** (sans plancher, sans partage mer/terre), une rampe locale **bridée au crop** (le monde garderait 5 600 — la couture que la décision 4 interdit), une rampe mesurée sur la **BOÎTE** au lieu de la forme, et la cible. **Neuf sur neuf distinguent au moins une loi.** ⚠️ **Le banc n'estime pas la rampe du dépôt, il l'EXÉCUTE** : il EXTRAIT `float t = sousEau ? … ;` de `git show 82e8b87:src/globe.js` et l'évalue — `t(828 m) = 0,4429`, soit **14,3 %** du bas de la rampe. Le chiffre du §3 est donc confirmé, pas repris de confiance.
- [x] **Étape 2** — le lancer, vérifier qu'il échoue. ✅ Rouge sur les six assertions du nuanceur, puis 35 verts.
- [x] **Étape 3 — implémenter.** ✅ `src/monde/rampe-crop.js` (pur) + deux uniformes PARTAGÉS de plus (`uLandBas`, `uPlancherRampeM`) + `poserRampe` / `retirerRampe`. ⚠️ **R1 VÉRIFIÉE OUVERTE AVANT D'ÉCRIRE UNE LIGNE** : `grep -rn` sur `uLandMax` et `uOceanDepth` ne rend **aucune** occurrence hors `globe.js` ; les quatre sorties ne vont que dans des uniformes de COULEUR, et le test ⑥a échoue si `seuil-socle`, `descente-bornee`, `exageration-continue`, `veille-socle` ou `flux-terrain` se met à les lire. **La boucle est coupée, pas amortie.**
- [x] **Étape 4 — la conséquence acceptée, MESURÉE.** ✅ Voir le bilan ci-dessous.
- [x] **Étape 5 — mutation.** ✅ **19 posées, 19 tuées** (`.banc/mutations-D.py`, remise vérifiée par empreinte SHA-256 avant chaque suivante). ⚠️ **DEUX SURVIVAIENT au premier tour, et les deux ont trouvé quelque chose.**
- [x] **Étape 6 — REGARDER L'ÉCRAN**, côte à côte avec l'ancien socle. ✅ **Et le verdict est mitigé — voir « CE QUE J'AI VU ».**
- [x] **Étape 7 — LA CLÔTURE DU §0**, puis commit. ✅

> **BILAN DE LA TÂCHE D — 2026-08-21.**
>
> **CE QUE LA RAMPE VAUT MAINTENANT** (La Réunion, crop z13 de 3 tuiles, neuf tuiles z12 à 512 px, couverture **1,0**, 16 380 points balayés, `.banc/pose-D.js`) :
>
> | | avant (mondiale) | après (le crop) |
> |---|---|---|
> | ancre basse de la terre | 0 m | 0 m *(crop côtier)* |
> | ancre haute | **5 600 m** | **2 613,6 m** |
> | profondeur | **6 000 m** | **223,1 m** |
> | `t` au sommet du crop | **0,6534** | **1,0000** |
> | texels du LUT occupés par le crop *(sur 512)* | **163** | **368** — ×2,26 |
>
> **CE QUE ÇA CHANGE À L'IMAGE** (`readPixels` après un rendu EXPLICITE de `sceneGlobe` avec `camGlobe`, boucle rAF gelée, cible 512², socle caché) — ⚠️ **et le témoin vaut EXACTEMENT ZÉRO**, deux prises au réglage inchangé, bit à bit identiques :
>
> | banc | écart moyen | max | pixels touchés |
> |---|---|---|---|
> | **témoin** | **0** | **0** | **0 %** |
> | crop au nadir *(parois cachées)* | 2,586 | 136 | **7,73 %** de l'image — **28,8 % des pixels du crop** |
> | la Terre AUTOUR *(crop éteint, vue orbitale)* | **11,08** | 151 | **37,44 %** |
>
> ⚠️ **À COMPARER AUX 1,01 % DE LA TÂCHE C, QUI CONCLUAIT « UNE FINITION, PAS UNE TRANSFORMATION ».** L'écart moyen sur les seuls pixels du crop vaut **9,64 unités** contre **0,080** pour ses quatre postes d'habillage : **cent vingt fois plus.** Elle avait raison de désigner cette tâche. ⚠️ **« CENT VINGT FOIS » NE TIENT PAS TEL QUEL ET LE CHIFFRE EST RETIRÉ — voir « Tour de correction 1 » plus bas, D-1.** La conclusion qualitative (cette tâche déplace bien plus l'image que la Tâche C) n'est en revanche pas remise en cause.
>
> ⚠️ **ET LA PREUVE DE COUVERTURE N'EST PAS VIDE, CETTE FOIS-CI POUR DE BON.** La première version comptait les pixels d'alpha non nul et rendait **262 144 sur 262 144** — `getClearAlpha()` vaut 1 dans cette application, exactement le piège que la Tâche C a payé deux fois. On CACHE donc `globe.group` et on compte ce qui CHANGE : **26,8 %** de l'image au nadir, **99,996 %** en orbite. ⚠️ **Et une seconde erreur du même banc a rendu un « témoin » de zéro qui n'en était pas un** : il rendait `x.scene`, la scène du SOCLE, quand le globe vit dans `sceneGlobe` (`main.js:4280`). Un écart de zéro partout, qui ressemblait à une réussite.
>
> **LA SATURATION DES ZONES LOINTAINES — L'ÉTAPE 4, ET ELLE EST ÉCRITE, PAS CORRIGÉE.** Protocole : toutes les tuiles du globe dont les hauteurs vivent encore, classées **point par point** par `dansCrop`, 147 456 échantillons, LUT de 512 texels.
>
> | les alentours, sous… | texels occupés | aux extrémités | saturés |
> |---|---|---|---|
> | la rampe **mondiale** | 153 *(29,9 %)* | **0,00 %** | 35,63 % |
> | la rampe **du crop** *(La Réunion, 0–2 614 m)* | **348** *(68,0 %)* | **0,00 %** | 35,63 % |
> | une rampe **ALPINE** de synthèse *(402–4 808 m)* | 158 *(30,9 %)* | **2,24 %** | **53,15 %** |
>
> ⚠️ **LE CAS QU'ADRIEN A NOMMÉ EST LE TROISIÈME, ET C'EST LUI QUI MORD** : « une plaine à côté d'un crop alpin sera monochrome ». Sous une rampe alpine, **50,9 % des alentours s'écrasent sur la PREMIÈRE teinte de terre** — tout ce qui est sous 402 m, c'est-à-dire toutes les plaines du monde — et **2 473 échantillons de mer butent sur l'abysse**, la profondeur locale d'un crop intérieur étant nulle. Sous la rampe de La Réunion, en revanche, **rien ne sature par le haut** : rien de chargé alentour ne dépasse 2 614 m.
>
> ⚠️ **ET LE VRAI EFFET N'EST PAS LA MONOCHROMIE, C'EST LE DURCISSEMENT.** Le comptage de couleurs distinctes le dit contre l'intuition : la rampe locale en rend **PLUS**, pas moins — 13 778 → **19 792** en orbite, **+43,6 %**. La rampe est plus RAIDE : elle traverse plus de texels par mètre en bas et écrête en haut. À l'écran, Madagascar passe d'un rose pâle lisible à une masse orange soutenue. **C'est visible, c'est accepté, et ce n'est pas ce que le mot « monochrome » laissait attendre.**
>
> ⚠️ **LA PORTÉE DE CETTE MESURE EST LIMITÉE, ET IL FAUT LE DIRE** : seules **neuf tuiles** gardent leurs hauteurs (`gardeHauteurs`, la réservation du flux), les autres les relâchent dès le maillage bâti — 256 Kio la tuile, 435 Mo au cache plein, décision de la Tâche 4 sexies. « Les alentours » désigne donc les **27 km** autour du crop, pas la planète. La planète, elle, n'est mesurable qu'à l'image, et c'est la ligne « la Terre AUTOUR » ci-dessus.
>
> **CE QUE LA CAMPAGNE DE MUTATION A TROUVÉ — DEUX SURVIVANTES, DEUX DÉFAUTS RÉELS.**
> - ⚠️ **M3 — LE PLANCHER DE DIVISION DU NUANCEUR ÉTAIT UNE CONSTANTE INATTEIGNABLE.** Le retirer ne tuait rien : `echelleRampe` applique déjà le plancher, donc le `max` valait **toujours** son premier terme. C'est le §2 de `/threejs-optimisation` mot pour mot — « une constante peut être du code mort sans que rien ne le signale ». La garde est maintenant ATTEIGNABLE : le balayage de ②b comprend une échelle **dégénérée** telle qu'un appelant peut en poser une à la main par `poserRampe({ echelle })`. ⚠️ **Et il a fallu deux essais** : au pas régulier de 18 m, `h = terreBas` était **SAUTÉ** (l'indice valait 566,67), et c'est là, et là seulement, que 0/0 se produit. Les ancres sont désormais dans le balayage.
> - ⚠️ **M11 — MON COMMENTAIRE PRÊTAIT AUX CENTRES DE CELLULE UNE VERTU QU'ILS N'ONT PAS.** Il affirmait qu'aux nœuds « la couverture tomberait sous 1 par construction » : **c'est faux**, un point hors forme est écarté par `continue` AVANT d'être compté manquant. La vraie propriété — aucun échantillon exactement SUR la frontière, et un jeu de points symétrique en u comme en v — est maintenant vérifiée **sur les points réellement visités**, relevés dans le rappel `hauteur`. Une mutation de plus (`M11 bis`, le `pas` de l'appelant ignoré) a été ajoutée : elle tue trois assertions.
>
> **CE QUE J'AI VU À L'ÉCRAN — ET LE VERDICT EST MITIGÉ.** Trois vues au même cadrage (nadir, `y = 110`, IHM masquée, exagération forcée à **×2,8** parce qu'à ×18 la vue est injugeable, `?exag=continu` étant éteint) :
> - **A, le socle seul** — une aquarelle **pâle** : crèmes et blancs sur presque toute l'île, ravines rosées et grises, mer turquoise à l'est.
> - **B, le crop du globe, rampe mondiale** — **une masse plate et orange**, exactement le grief de la Tâche C.
> - **C, le crop du globe, rampe du crop** — **la mer change du tout au tout** : le mauve sombre devient un bleu franc, et une frange turquoise apparaît le long de la côte. **La terre, elle, devient PLUS SOMBRE, pas plus claire** : 1 400 m passe de `t = 0,513` (sable) à `t = 0,698` (orange), et 2 000 m à `0,847` (brun rouge). ⚠️ **CE N'EST PAS CE QUE J'ATTENDAIS, ET C'EST LE RÉSULTAT.**
>
> ⚠️ **NON, LE CROP NE RESSEMBLE TOUJOURS PAS AU SOCLE, ET LA CAUSE EST MESURÉE.** Ce ne sont pas deux réglages de la même rampe, ce sont **deux rampes qui n'ont ni la même table ni la même loi** :
>
> | | globe | socle |
> |---|---|---|
> | table | `uRamp`, **512 × 1**, mer dans `[0 ; 0,35]`, terre dans `[0,35 ; 1]` | `uRampTex`, **512 × 64** *(2ᵉ axe : humidité)*, **ENTIÈREMENT TERRE** |
> | loi terre | `0,35 + 0,65 · (h − bas)/(haut − bas)` | `0,5 + (hNorm − pivot) · contraste`, **pivot 0,65, contraste 2,5** |
> | mer | le bas de la même table | une rampe nautique à **TROIS** couleurs (`uOceanShallow/Mid/Deep`) |
> | `hNorm` porte sur… | la terre seule | **le relief ENTIER, fond marin compris** |
>
> **Les `t` du socle, relevés sur ses propres uniformes** (`uHeightRange = (−14,64 ; 12,50)` unités, `uSeaY = −2,52`, pivot 0,65, contraste 2,5, `meanM = 440,8`, 488,47 m/unité) : **0 m → 0,000 · 200 m → 0,097 · 600 m → 0,308 · 1 000 m → 0,519 · 1 400 m → 0,730 · 2 000 m → 1,000.** Le socle **sature en blanc dès 2 000 m** ; le globe n'y arrive qu'à 2 614.
>
> ⚠️ **ET PORTER `pivot` / `contraste` N'EST PAS UN GESTE MÉCANIQUE — C'EST UNE DÉCISION PRODUIT, ET JE NE L'AI PAS PRISE.** Rejoué à la main : `contraste = 2,5` est calibré sur l'amplitude du SOCLE (4 734 m, fond marin à −2 116 m compris) ; appliqué à celle du CROP (2 837 m), il fait passer **tout ce qui est sous ~1 740 m** au premier ton de la rampe. Pour le porter juste il faudrait **rééchelonner le contraste avec l'amplitude** — 2,5 × 2 613/4 734 = **1,38** — et déplacer le pivot : 0,65 sur le socle vaut **964 m**, soit 0,369 sur une normalisation terre seule. **Et cela ne suffirait toujours pas, parce que les deux tables n'ont pas le même contenu** et que celle du socle est land-only. La réconcilier suppose de toucher à la mer, **c'est-à-dire la Tâche F**, que le §7 place explicitement après. Les chiffres sont là pour qu'Adrien tranche.
>
> ⚠️ **« AUCUNE COUTURE AU BORD » EST TENU PAR CONSTRUCTION, ET N'EST PAS OBSERVABLE AUJOURD'HUI.** Les quatre uniformes sont PARTAGÉS (`this.uniforms`, que `_materialFor` étale dans chaque matériau) et le nuanceur ne calcule `t` **qu'une fois, hors de toute branche** — ②c l'exige : une seule occurrence de `float t = `, une seule de `texture2D(uRamp`, et l'expression ne mentionne ni `uCrop` ni `qCrop`. Pour fabriquer une couture il faudrait un SECOND calcul de `t` sous une garde par fragment, les uniformes étant posés par appel de dessin et ne sachant rien de l'appartenance au crop. ⚠️ **Mais à l'écran il n'y a rien à coudre** : la Tâche A `discard` tout ce qui est hors du crop, donc la Terre autour **n'est pas dessinée** — vérifié à `y = 900`, le bloc flotte seul sur le fond. **La propriété ne deviendra visible qu'avec la Tâche G.**
>
> **LES TESTS.** 35 tests, **19 mutations posées, 19 tuées**. ⚠️ **UNE SEULE ASSERTION EST VERTE CONTRE LE DÉPÔT, ET ELLE EST DÉCLARÉE COMME TELLE** : ①c (« les alentours suivent »), verte parce que la rampe mondiale est sans couture elle aussi — c'est ①d qui porte la preuve. On la garde parce qu'elle est **ROUGE contre la loi bridée**, le contresens le plus probable de la décision 4. ⚠️ **`poserRampe` EST EXERCÉE, PAS SEULEMENT NOMMÉE** (`.call` sur un objet minimal, patron de la Tâche B) : sans ②h, le refus de couverture n'aurait été qu'une intention de commentaire — **et il s'est déclenché en conditions réelles**, deux fois, quand le rebâtissage d'exagération relâche les hauteurs (`couverture: 0`, `refus: 'couverture'`, uniformes intouchés).
>
> **LA CLÔTURE.** `npm test` **3 491** (3 456 + 35) · `audit:tests` 198/198 · `node --check` sur les quatre fichiers · `nettoie:dist` + `build:mapcells` + `vite build` + `verifie:dist`.
>
> **CE QUE JE N'AI PAS PU VÉRIFIER.**
> - **La saturation à l'échelle de la PLANÈTE**, faute de hauteurs : neuf tuiles seulement les gardent. Le chiffre publié porte sur 27 km autour du crop.
> - **Le `pas` sur un crop dont la mer compte** : la convergence du fond marin n'est pas atteinte à 128 (erreur ~7 %, treize texels de la rampe bathymétrique), et la suite n'est pas monotone parce que les points profonds sont rares. La table complète est dans l'en-tête de `PAS_MESURE`.
> - **Aucun branchement de production**, exactement comme A, B et C : `poserRampe` n'est appelé par personne dans `src/`. Tout ce qui précède vient de la console (`.banc/pose-D.js`).
> - **Un seul crop, une seule machine.** La Réunion, RTX 3080. Le cas alpin n'a été mesuré que par une échelle de **SYNTHÈSE** appliquée au relief de La Réunion, pas par un vrai crop alpin chargé.

#### Tour de correction 1 — ce qu'une relecture indépendante a trouvé, et ce que la mesure a tranché

⚠️ **CETTE SECTION S'AJOUTE AU BILAN CI-DESSUS, ELLE NE LE REMPLACE PAS.** Les phrases corrigées restent en place avec un renvoi ici : c'est la règle des listes du §0, appliquée à un compte rendu.

**Verdict de la relecture : conformité ⚠️ — 1 Critique, 1 Important, 2 Mineurs (les deux Mineurs sont différés). La décision 4 elle-même — la rampe est PARTAGÉE, pas bridée au crop — a été vérifiée au niveau du MÉCANISME (spread superficiel de `this.uniforms`, mutation `.value` en place, un seul calcul de `t` hors de toute branche, 19/19 mutations officielles tuées, rejoué indépendamment) et n'est PAS en cause. Les deux points de ce tour sont un chiffre de communication et une garde de code — pas le mécanisme de la tâche.**

**D-1 — « CENT VINGT FOIS » MÉLANGEAIT DEUX DÉNOMINATEURS. SES DEUX REMPLAÇANTS PROPOSÉS PAR LA RELECTURE N'EN SONT PAS NON PLUS UNE FOIS VÉRIFIÉS CONTRE LE CODE DES DEUX BANCS — LE CHIFFRE EST RETIRÉ, PAS REMPLACÉ.**

La relecture avait raison sur un point : **9,64** (le chiffre publié) est le `moyen` de `compare()` (`.banc/pose-D.js`) **rescaldé à la main**, en divisant par la couverture mesurée séparément (26,8 %) — alors que **0,080** (le chiffre de la Tâche C, `.banc/image-C.js`) était cité sans dire ce qu'il porte. Elle proposait donc ×32 (2,586 / 0,080, « cadre entier ») ou ×106 (9,64 / 0,091, « pixels du crop seuls »). **Aucun des deux ne se reproduit une fois qu'on relit le CODE des deux fonctions, pas seulement leurs noms de variables.**

- **Le dénominateur de `0,080` n'est ni 262 144 (cadre entier) ni un rescalage manuel : c'est `dessines`, une variable QUE LA FONCTION CALCULE ELLE-MÊME.** `ecart()` (`.banc/image-C.js:56-92`) ne compte et ne somme QUE les pixels « opaques » (`if (!opaque) continue`), et rend `moyenne: somme / Math.max(1, dessines)` — donc **0,080 est DÉJÀ une moyenne sur les seuls pixels du crop** (`dessines ≈ 230 603`, 87,96 % du cadre dans ce banc), **au même titre que le 9,64 rescaldé de cette tâche** — pas au titre du 2,586 brut. Le qualifier de « cadre entier, non rescaldé » (ce que fait la relecture) est donc **inexact** : sa propre fonction le rescalde déjà, nativement, avant de le rendre. ×32 (2,586 brut / 0,080 déjà-rescaldé) compare donc à son tour deux monnaies différentes — un numérateur DILUÉ par tout le cadre (D) contre un numérateur DÉJÀ CONCENTRÉ sur le crop (C). Reconverti correctement (`0,080 × 230603 / 262144 = 0,0704`, la vraie moyenne de C sur cadre entier — une identité algébrique, aucune hypothèse requise, puisque les pixels hors du crop ont un écart nul par construction), le rapport cadre-entier vaut **2,586 / 0,0704 ≈ ×37**, pas ×32. Et ×106 (9,64 / (0,080 / 0,8796)) refait le même sens dans l'autre sens : diviser 0,080 par sa propre couverture le fait AUGMENTER alors qu'il est déjà concentré — cette opération ne correspond à aucune quantité mesurée par aucun des deux bancs.
- **Et le dénominateur n'est pas le seul écart : la formule du pixel diffère aussi.** `compare()` de cette tâche (`.banc/pose-D.js:72-86`) somme `(|Δr|+|Δg|+|Δb|)/3` — la **MOYENNE** des trois canaux. `ecart()` de la Tâche C somme `Math.max(|Δr|,|Δg|,|Δb|)` — le **MAXIMUM**. Pour un même pixel, le maximum est toujours ≥ la moyenne : `0,080` porte donc un biais vers le haut que `2,586`/`9,64` ne portent pas, dans un sens qui RÉDUIT encore l'écart réel entre les deux tâches. Aucun facteur de correction fiable n'est calculable depuis les seules moyennes publiées — il faudrait les tampons de pixels bruts, qu'aucun des deux bancs ne conserve sur le disque.
- **Et le protocole de masquage diffère.** `ecart()` de la Tâche C cache explicitement l'atmosphère, les calottes et les nuages **avant les deux prises** (`.banc/image-C.js`, boucle sur `x.globe.group.children`, motivée par « l'atmosphère est une sphère qui couvre le cadre entier ») — c'est le garde-fou que le §0 de ce tour rappelle comme un piège connu de ce chantier. `mesureImage()` de cette tâche (`.banc/pose-D.js:328-368`) ne fait RIEN d'équivalent pour la comparaison `localeContreMonde` (le bascule de `g.group.visible` ne sert qu'à la mesure de couverture, séparée) : l'atmosphère et les nuages, s'ils rendent quelque chose à cette pose, ne sont exclus ni du numérateur ni du dénominateur de 2,586/9,64.

**Trois écarts de méthode indépendants (dénominateur, formule du pixel, masquage), et aucun des deux bancs ne conserve les tampons bruts qui permettraient de les corriger tous les trois à la fois.** Le chiffre exact — ×32, ×37, ×106, ×120 ou autre chose — **n'est pas récupérable dans une monnaie unique et vérifiable depuis les données publiées**. Conformément à la règle du §0 (« un rapport retiré vaut mieux qu'un rapport faux »), **le multiplicateur est retiré, et non remplacé par un autre**. Ce qui reste vrai et n'a besoin d'aucun ratio pour se soutenir : à l'écran, le passage à la rampe locale transforme le crop (§ « CE QUE J'AI VU », « une masse plate et orange » devient une mer et une terre lisibles) alors que l'habillage de la Tâche C ne touchait que 1,01 % des pixels pour une « finition » déclarée comme telle par sa propre autrice — **la Tâche D domine largement la Tâche C**, et c'est la seule affirmation que ce tour confirme.

**D-2 — UNE SECONDE CONSTANTE MORTE DE LA MÊME FAMILLE QUE M3, TROUVÉE PAR LA RELECTURE.** `echelleRampe` (`src/monde/rampe-crop.js`) portait deux replis — `terreBas = Number.isFinite(mesure.minTerreM) ? mesure.minTerreM : 0` et `brut = Number.isFinite(mesure.maxTerreM) ? mesure.maxTerreM : terreBas` — que la relecture a montrés **inatteignables dans la chaîne réelle** (deux mutations sémantiques, posées et survivantes) : le seul appelant du dépôt (`poserRampe` → `mesurerRelief` → `echelleRampe`) reçoit toujours un `mesure.minTerreM`/`maxTerreM` déjà normalisé à un nombre fini par `mesurerRelief` elle-même, avant que `echelleRampe` ne le relise. **Même famille de défaut que M3** (§2 de `/threejs-optimisation`, « une constante peut être du code mort sans que rien ne le signale »), trouvée une seconde fois sur cette même tâche. Contrairement à M3, ces deux replis ne défendaient **aucun point d'entrée public réel** : l'échappatoire de M3 (`poserRampe({ echelle })`) est un paramètre documenté, exercé par les tests, par lequel un appelant PEUT légitimement imposer une échelle dégénérée — rien d'équivalent n'existe pour un `mesure` construit à la main avec des bornes de terre non finies, et le type documenté de `echelleRampe` (`@param {{minM:number, maxM:number, minTerreM:number, maxTerreM:number}} mesure`) ne les déclare pas optionnelles. **Les deux replis sont donc retirés**, pas rendus atteignables artificiellement : `terreBas`/`terreHaut` lisent maintenant `mesure.minTerreM`/`mesure.maxTerreM` directement, exactement comme `mesure.minM` (qui n'a jamais eu de repli, juste en dessous) l'a toujours fait. Les 35 tests de `test/crop-rampe.test.js` passent inchangés — aucun test, officiel ou de la relecture, ne construisait de `mesure` violant ce contrat — et les mutations S3/S9 de la relecture ne s'appliquent plus : le code qu'elles mutaient n'existe plus.

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

- [x] **Étape 1 — MESURER le coût de la mer riche** à trois distances. ✅ **Table ci-dessous, et elle dit l'inverse de ce qu'on attendait : le coût par pixel NE BAISSE PAS avec la distance, il MONTE.**
- [x] **Étape 2 — le test qui échoue.** ✅ `test/mer-sphere.test.js`, **44 tests**. ⚠️ **DIX CANDIDATES REJOUÉES CONTRE SEPT LOIS AVANT D'ÊTRE ÉCRITES** (`.banc/rejoue-F.mjs`).
- [x] **Étape 3 — implémenter la calotte**, bathymétrie fusionnée comprise. ✅ `src/monde/mer-sphere.js` (pur) + `poserMer` / `retirerMer`.
- [x] **Étape 4 — la dégradation, MESURÉE.** ✅ Bascule **dérivée** de la loi d'échantillonnage, et sa position vérifiée indécelable en ΔE*ab. Voir le bilan.
- [x] **Étape 5 — mutation.** ✅ **30 posées, 30 tuées**, dans un `git worktree` à part. ⚠️ **DEUX ASSERTIONS ÉTAIENT AVEUGLES, ET C'EST LA CAMPAGNE QUI L'A DIT.**
- [x] **Étape 6 — REGARDER L'ÉCRAN.** ✅ **Et c'est là que cinq défauts sur six ont été trouvés.**
- [x] **Étape 7 — LA CLÔTURE DU §0**, puis commit. ✅

> **BILAN DE LA TÂCHE F — 2026-08-21.**
>
> **⚠️ L'ÉTAPE 1 DIT L'INVERSE DE CE QU'ON ATTENDAIT.** Banc `.banc/mesure-F.js`,
> sorties brutes dans `.banc/F1-brut.json`. Mer du socle, nadir en plein océan à
> l'est de La Réunion, maille 55,888 unités / 256 segments / 66 049 sommets,
> cible 900², **9 tours × 25 images, 12 jetées, 40 de chauffe**, `uTime` figé,
> **un seul appel de dessin PROUVÉ**, couverture comptée au magenta :
>
> | station | alt. caméra | `uViewCalm` | `uSurfCalm` | couverture | mer riche | témoin | riche − témoin | par Mpx COUVERT |
> |---|---|---|---|---|---|---|---|---|
> | 12 unités | 2 093 m | 1,000 | **1,000** | 100,0 % (0,810 Mpx) | 0,0553 ms | 0,0092 | 0,0461 | **0,0569** |
> | 40 unités | 6 978 m | 1,000 | 0,717 | 78,4 % (0,635 Mpx) | 0,0573 ms | 0,0154 | 0,0419 | **0,0660** |
> | 90 unités | 15 701 m | 0,605 | **0,080** | 33,7 % (0,273 Mpx) | 0,0471 ms | 0,0205 | 0,0266 | **0,0974** |
> | **témoin de dérive** *(rejeu de la station 12)* | 2 093 m | 1,000 | 1,000 | 100,0 % | 0,0563 ms | 0,0102 | 0,0461 | 0,0569 |
>
> **Dérive : +0,0010 ms sur 0,0553, soit 1,8 %.** p10–p90 sur neuf tours : **≤ 0,001 ms**, un tic du chronomètre GPU.
>
> **AJUSTEMENT AFFINE SUR LES TROIS STATIONS : `0,0372 ms/Mpx + 0,0169 ms de FIXE`** (résidus ≤ 0,0014 ms). Le fixe vaut **36 %** du total à 0,81 Mpx et **62 %** à 0,27 Mpx. ⚠️ **RÉSERVE, VOIR « TOUR DE CORRECTION 1 » PLUS BAS, F-3 : trois stations pour deux paramètres libres ne laissent qu'UN DEGRÉ DE LIBERTÉ pour juger la linéarité, et son résidu (0,0014 ms) est du même ordre que le bruit du banc lui-même (témoin de dérive : ≤ 0,001 ms).** Les chiffres restent exacts ; la confiance qu'on peut leur accorder est plus modeste que ce paragraphe, seul, ne le laisse entendre.
>
> **LE FAIT LE PLUS UTILE DE CETTE TÂCHE : `uViewCalm` ET `uSurfCalm` MULTIPLIENT LE RÉSULTAT AU LIEU DE SAUTER LE CALCUL.** De 2 093 m à 15 701 m la richesse visible s'éteint (`uSurfCalm` 1,000 → 0,080) pendant que le coût par pixel de mer **monte** de 0,0569 à 0,0974 ms/Mpx — parce que la part fixe s'amortit sur moins de pixels. **Dégrader la mer telle qu'`ocean.js` la dégrade ne fait rien gagner.** D'où la loi de ce module : une richesse qui atteint **exactement zéro**, pour qu'on puisse SAUTER. ⚠️ **ET IL FAUT LE DIRE HONNÊTEMENT, VOIR « TOUR DE CORRECTION 1 » PLUS BAS, F-4 : la hausse du coût par pixel N'EST PAS un second fait indépendant de l'ajustement affine ci-dessus — c'est son COROLLAIRE ALGÉBRIQUE (`coût/pixel = a + b/pixels`, qui croît mécaniquement quand la couverture rétrécit, pour tout `b > 0`). Le mécanisme causal nommé (« la part fixe s'amortit sur moins de pixels ») reste juste, et la décision d'ingénierie qui en découle reste bonne — mais ce n'est pas une seconde preuve, c'est une reformulation de la même régression.**
>
> **LE BAGAGE DE TEXTURES, COMPTÉ — ET UN CHIFFRE EN A ÉTÉ RETIRÉ.** La mer du socle porte **trois** liens de texture (`uField`, `uCoastMask`, `uSceneTex`) **et une copie de tampon d'image**, **par appel de dessin, c'est-à-dire par tuile** — c'est le fait que le Tour 1 de la Tâche C désignait comme le plus utile. ⚠️ **~~Portée par tuile sur les 986 tuiles du globe, cela ferait 2 958 liens et 986 copies~~ — CE CHIFFRE N'AVAIT AUCUNE SOURCE ET EST RETIRÉ, VOIR « TOUR DE CORRECTION 1 » PLUS BAS, F-2.** Ce qui reste, et qui n'a besoin d'aucun compte de tuiles pour se soutenir : **portée par une calotte UNIQUE, ce bagage devient un lien et zéro copie — au lieu de trois liens et une copie PAR TUILE, quel que soit leur nombre.** ⚠️ **Contrepartie assumée et dite : la RÉFRACTION n'est pas portée** (elle exige la copie de tampon) ; la lame d'eau est simplement transparente, et ce qui se perd est la torsion du fond sous les vagues.
>
> **CE QUE LE BANC A RENDU DE FAUX AVANT DE RENDRE CETTE TABLE — SIX FOIS.** ① couverture 1,0 aux trois distances, `scene.background` peint par-dessus l'effacement ; ② couverture 1,0 de nouveau, cette fois sur un tampon **jamais effacé** (noir) ; ③ **0,8868 ms à 480² contre 0,1413 à 900²** — la compilation du nuanceur prise DANS le chronomètre ; ④ un « ms/Mpx : NaN » — un tour entier rejeté (`GPU_DISJOINT`) ; ⑤ deux couvertures différentes aux mêmes distances, le DAMIER ayant posé des cases entre-temps ; ⑥ un désaccord jamais expliqué entre le banc et sa réplication à la main, **clos par un compteur d'APPELS DE DESSIN qui refuse tout relevé où un objet étranger entre dans le cadre**. ⚠️ **Aucune de ces six n'aurait été vue sans témoin.**
>
> ---
>
> **OÙ EST LA BASCULE, ET COMMENT JE PROUVE QU'ELLE NE SE VOIT PAS.**
>
> **Elle est DÉRIVÉE, pas choisie** : `d = λ · hauteurPx / (2 · parDetail · tan(fov/2))`, avec `parDetail = 2`, **la borne de Nyquist** — en dessous, un détail n'est plus représenté mais REPLIÉ. Pour la calotte livrée (portée 12, pas 256, λ = 688 m, 414 px, fov ~~33°~~ **30°**) elle vaut ~~3,77 unités de scène, soit 240 km~~ **4,17 unités de scène, soit 265,75 km**, bande ~~[1,89 ; 7,55] unités = [120 ; 481] km~~ **[2,09 ; 8,34] unités = [133 ; 531] km**. ⚠️ **LE FOV DE 33° N'EXISTAIT NULLE PART DANS LE DÉPÔT — LE CHIFFRE EST CORRIGÉ, VOIR « TOUR DE CORRECTION 1 » PLUS BAS, F-1.** Le socle naît à 32 274 m et meurt à 40 343 m : toute sa plage de vie est du côté RICHE, avec un facteur **3,3** de marge (et non trois : la correction l'agrandit). La dégradation ne s'engage donc qu'en vue orbitale — exactement là où « dégradée avec la distance » doit s'engager.
>
> **LA PREUVE — et le protocole du plan a dû être RAFFINÉ, ce qui est dit.** Le plan demande « comparer deux images à la bascule et exiger un écart de couleur sous le seuil de perception ». Comparer la mer riche à la mer dégradée dit ce que la dégradation ENLÈVE ; **cela ne dit pas si la BASCULE se voit.** La bascule se voit si l'on peut la SITUER — donc si la DÉPLACER change l'image. On rend donc deux images au même cadrage et au même instant, l'une avec la bande à `B`, l'autre à `2B` (`.banc/pose-F.js`, `deplacement()`, sorties brutes dans `.banc/F4-brut.json`) :
>
> | altitude caméra | cadre | ΔE*ab moyen en déplaçant la bascule d'une OCTAVE | p99 | *(borne : la même image contre la mer entièrement riche)* |
> |---|---|---|---|---|
> | 6,4 km | 3,8 km | **0** | **0** | 0 / 0 |
> | 12,7 km | 7,5 km | **0,102** | 3,19 | 0,105 / 3,43 |
> | 25,5 km | 15,1 km | **0,957** | 34,7 | 0,968 / 35,1 |
> | 51 km | 30,2 km | 4,41 | 69,5 | 4,42 / 69,7 |
> | 102 km | 60 km | **2,35** | 58,5 | 2,36 / 58,6 |
> | 204 km | 121 km | **1,31** | 42,4 | 1,31 / 42,4 |
>
> **Seuil déclaré : ΔE\*ab = 2,3, la juste différence perceptible de CIE76** — calculé en L\*a\*b\*, pas en RGB, parce qu'un écart de deux unités RGB ne se voit pas dans les ombres et se voit dans les clairs. ⚠️ **C'est la réponse au grief R-4 de la Tâche E** (« un écart moyen n'est pas un critère perceptif »).
>
> ⚠️ **TÉMOIN : deux prises au réglage inchangé rendent EXACTEMENT ZÉRO sur 102 400 pixels.** Tout écart non nul est donc l'effet.
>
> **CE QUE LA TABLE AUTORISE À DIRE, ET RIEN DE PLUS :** sur la MOYENNE, déplacer la bascule d'une octave entière reste sous la juste différence perceptible **jusqu'à 25,5 km** (0,957) et à la limite à **204 km** (1,31) ; elle la dépasse à 51 km (4,41). **Sur toute la plage de vie du socle (≤ 40 km), la position de la bascule est indécelable.**
>
> ⚠️ **ET CE QUE LA TABLE NE PERMET PAS DE DIRE : le p99 ne descend JAMAIS sous le seuil.** Il vaut 34 à 70 unités. **Ce n'est pas la transition** — la colonne de droite montre la MÊME valeur pour la borne totale — c'est la dégradation elle-même, concentrée sur 1 % des pixels : les crêtes d'écume, qui **crénellent** parce que `gl.getContextAttributes().antialias` vaut `false` sur ce contexte (mesuré par la Tâche B). **Un critère sur le p99 n'est pas atteignable avec ce rendu, et je le dis plutôt que de choisir la statistique qui passe.**
>
> ---
>
> **CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC L'ANCIEN SOCLE.** ⚠️ **L'onglet ne COMPOSE pas** (page pilotée en arrière-plan) : aucune capture n'est possible et `requestAnimationFrame` ne se déclenche jamais. Les images sont donc des rendus EXPLICITES hors écran, sortis par un petit récepteur HTTP (`.banc/recois-images.mjs`), et elles sont sur le disque (`.banc/vues/`). **Ce n'est pas « la capture de l'application », et il fallait l'écrire.**
>
> - **`W-socle-bloc.jpg` — LE SOCLE, la référence.** Aquarelle riche ; et sa mer est **presque NOIRE au large avec une frange TURQUOISE étroite au littoral**. ⚠️ **Cette frange n'est PAS la lame d'eau : c'est le FOND MARIN, vu au travers.** C'est ce constat qui a fait porter la rampe nautique (voir plus bas).
> - **`N-mer-seule-large.jpg` — LA CALOTTE SEULE, au bloc.** Océan navy, **anneau d'écume blanc qui suit tout le littoral de La Réunion**, île découpée au trait. **C'est le résultat visuel le plus net de la tâche** : le globe n'avait aucune écume, aucun ressac, aucun trait d'eau.
> - **`L-champ-large.jpg` — LE CHAMP, en fausses couleurs.** La forme exacte de l'île, le liseré jaune du zéro, et **le plateau puis la fosse en dégradé de bleu**. **La bathymétrie fusionnée est là, et elle se voit.** Le globe seul (`hauteurSurface`) lit **zéro** partout où le terrarium n'a pas de fond marin, et la mer y serait d'un bleu uniforme de bord à bord.
> - **`AA-crop-mer.jpg` — le crop avec sa mer.** Dégradé de profondeur correct, pâle au littoral, bleu au large, contre une terre olive à courbes de niveau.
>
> ⚠️ **ET IL FAUT LE DIRE FRANCHEMENT : ÇA NE RESSEMBLE PAS ENCORE AU SOCLE.** La frange côtière de la calotte reste **nettement plus large et plus pâle** que celle du socle, et **aux altitudes du socle la houle et l'écume ne se lisent pas** — c'est la même chose que dit la première ligne de la table de la bascule (ΔE = 0 à 6,4 km). Ce qui manque n'est pas identifié avec certitude ; ce que je peux affirmer, c'est que **la loi de couleur, elle, est juste** : forcée à rouge/bleu (`X-peu-rouge-fond-bleu.jpg`), la mer prend bien la couleur PROFONDE là où le champ dit profond.
>
> ---
>
> **LES SIX DÉFAUTS TROUVÉS EN CHEMIN — CINQ SUR SIX À L'ŒIL, PAS AU RAISONNEMENT.**
>
> 1. ⚠️ **LE CHANFREIN DE DISTANCE AU RIVAGE D'`ocean.js` EST INCOMPLET, ET SON ERREUR VAUT +41,4 %.** Son demi-masque ne lit que TROIS voisins par passe au lieu de quatre : les anti-diagonales manquent. Mesuré sur une grille 65² à une seule cellule de terre : **(+8, 0) → 0,0 % · (+8, +8) → −0,02 % · (+8, −8) → +41,42 %**. Ce champ pilote la houle de côte, les bandes d'écume et le ressac : **la frange de ressac du socle meurt 41 % trop tôt sur deux orientations de côte sur quatre.** Personne ne l'avait vu parce que rien ne comparait ce champ à une référence indépendante. ⚠️ **NON CORRIGÉ dans `ocean.js`** (le socle est en production, le damier hors périmètre) : la fonction est ÉLARGIE d'une option `completes`, le défaut par défaut est celui du dépôt **au bit près** (⑤e le prouve case par case), et la calotte prend le juste.
> 2. ⚠️ **`empriseCalotte` RENDAIT UN PÔLE.** À grande portée, `latLonDeLocal` passe par `sinh(π · 36,5)` qui déborde en `Infinity` : `atan` rendait **exactement 90°**, donc `tuileY(90) = ∞` dans `remplirHauteurs`. Écrêté à la couverture de Mercator.
> 3. ⚠️ **LE SPECTRE DE HOULE N'ÉTAIT PAS POSÉ, ET LA MER ÉTAIT UN MIROIR.** `GERSTNER_GLSL` déclare `uWaveA[16]` / `uWaveB[16]` et **saute tout train d'amplitude nulle**. Sans `seaStateToUniforms`, `disp` et `nAcc` valent zéro. **Le relevé rendait ZÉRO pixel de différence entre la mer riche et la mer dégradée, à toutes les distances** — et c'est ce zéro trop propre qui l'a dénoncé.
> 4. ⚠️ **QUATRE CONSTANTES DU SOCLE, RECOPIÉES, AURAIENT ÉTÉ RUINEUSES**, et chacune porte le chiffre de sa faute :
>
>    | constante | valeur du socle | recopiée telle quelle | convertie |
>    |---|---|---|---|
>    | epsilon de coplanarité | 0,003 unité | **68,3 m de marée** | **0,26 m** |
>    | budget de profondeur | 2,2 unités | *(la profondeur RÉELLE : 4 310 m, glacis de lagon jusqu'à 646 m)* | **192 m** |
>    | seuil du trait d'eau | 0,02 unité | **455 m d'eau semi-transparente** | **1,75 m** |
>    | échelle de houle | 0,42 unité/m de spectre | *(le pas de maille : houles de 8 à 16 km)* | **102,7 m/m, houle de 1,23 km** |
>
>    ⚠️ **ET LA QUATRIÈME EST HORIZONTALE, DONC PAS DIVISÉE PAR L'EXAGÉRATION** — à la différence des trois autres, qui sont des hauteurs. Le test ⑨c garde cette distinction.
> 5. ⚠️ **L'ÉCUME N'AVAIT NI TAVELURE NI FACTEUR D'ÉCHELLE**, les deux que porte `ocean.js` : la côte vue de 7,6 km était **une masse BLANCHE trouée de bleu** (`M-mer-seule-cote.jpg`). Les deux sont remis.
> 6. ⚠️ **LA RAMPE NAUTIQUE DU FOND — LA PIÈCE QUE LA TÂCHE D AVAIT NOMMÉE SANS LA PRENDRE.** Son bilan écrit : « le socle peint la mer par une rampe nautique à TROIS couleurs (`uOceanShallow/Mid/Deep`) […] la réconcilier suppose de toucher à la mer, c'est-à-dire la Tâche F ». **Elle est portée** : `terrain.js:1019-1023` transcrit au bit près — exposant 0,55, coude à 0,45, les trois mêmes couleurs — derrière `uMerRampeOn`, à **zéro par défaut**. ⚠️ **Et son budget n'est PAS `uOceanDepth`** : celui-ci vaut encore 6 000 m (la valeur mondiale) tant que `poserRampe` est refusée faute de couverture ; le budget vient du champ de la calotte, où il est **mesuré à 4 310 m**.
>
> ---
>
> **LA CAMPAGNE DE MUTATION : 30 POSÉES, 30 TUÉES**, `.banc/mutations-F.mjs`, **dans un `git worktree` à part** (`../wt-mutF-mer`, retiré en partant), remise vérifiée par empreinte SHA-256 avant chaque suivante. **Chacune change un COMPORTEMENT et nomme l'assertion qu'elle doit tuer**, et le banc SIGNALE quand ce n'est pas celle-là qui rougit.
>
> ⚠️ **ET C'EST CE SIGNAL QUI A TROUVÉ DEUX ASSERTIONS AVEUGLES.**
> - **③c** (« la mer du crop et celle du large sont la même surface ») comparait le coin du crop à `u = 1` **exactement** — l'endroit où la loi `CHORDE` (la calotte dans le crop, un plan dehors) coïncide avec la cible. M5 passait. C'est le piège que la Tâche A avait su retourner (écart NUL à 45° entre la superellipse et son octogone) et que la Tâche E a repayé (①b posé pile à `f = ±1`). **L'assertion regarde maintenant AU-DELÀ du crop** et exige que la mer continue de descendre, quadratiquement.
> - **③d** (« le repère de la calotte est celui des parois ») comparait deux appelants de **la même fonction** : M6, qui échange EST et SUD dans `repereLocalCrop`, les faisait mentir ENSEMBLE. **L'assertion recalcule maintenant la base à la main**, depuis la seule latitude du centre, et vérifie qu'elle est DIRECTE.
>
> **LES TESTS.** **44 tests** (`test/mer-sphere.test.js`). ⚠️ **DIX CANDIDATES REJOUÉES CONTRE SEPT LOIS AVANT D'ÊTRE ÉCRITES** (`.banc/rejoue-F.mjs`, laissé sur le disque) : le dépôt (`PLAN`), `NAIVE` (la flèche en `1 − cos`), `CHORDE`, `PLANCHER` (la loi que `ocean.js` applique aujourd'hui), `DURE`, `TOT`, et la cible. **Dix sur dix distinguent au moins une loi** — ⚠️ **et F7 n'en distinguait AUCUNE au premier rejeu** (`0,08 + 0,92 · 1` vaut exactement 1 en double) : c'est la loi `TOT` qui a été AJOUTÉE pour lui donner prise, pas l'assertion qui a été affaiblie.
>
> ⚠️ **`poserMer` ET `retirerMer` SONT EXERCÉES, PAS GREPÉES** (`Globe.prototype.X.call` sur un objet minimal — le patron de la Tâche B). C'est le grief C-2 pris d'avance, **et il y avait bien un défaut à trouver** : `uMerRampeOn`, `uMerFondBudgetM` et les trois couleurs du fond sont des uniformes **PARTAGÉS par toutes les tuiles** — les laisser allumés après `retirerMer` repeindrait **tous les océans du monde** avec le budget d'un crop. C'est exactement le défaut C-3 de la Tâche C ; il est gardé par ⑩a et par les mutations M23 et M24.
>
> **LA CLÔTURE.** `npm test` **3 555** (3 511 + 44) · `audit:tests` 199/199 · `node --check` sur les quatre fichiers · `nettoie:dist` + `build:mapcells` + `vite build` + `verifie:dist` → « dist est complet ». **Page rechargée avant le commit** : les cinq drapeaux éteints, `uCropOn = 0`, `uHabOn = 0`, `uMerRampeOn = 0`, `uMerFondBudgetM = 6000`, `uLandMax = 5600` — **la production est intouchée**, et aucune erreur nouvelle en console (seuls les 404 et le `ERR_CONNECTION_TIMED_OUT` du bucket AWS, déjà connus).
>
> **CE QUE JE N'AI PAS PU VÉRIFIER.**
> - ⚠️ **LA CALOTTE N'EST PAS BRANCHÉE EN PRODUCTION**, exactement comme A, B, C, D et E : `poserMer` n'est appelé par personne dans `src/`. Tout ce qui précède vient de la console (`.banc/pose-F.js`).
> - ⚠️ **LA FRANGE CÔTIÈRE RESTE PLUS LARGE ET PLUS PÂLE QUE CELLE DU SOCLE, ET JE N'AI PAS ÉTABLI POURQUOI.** Le champ est juste (`L-champ-large.jpg`), la loi de couleur est juste (`X-peu-rouge-fond-bleu.jpg`), le budget est converti — et pourtant l'image ne rejoint pas celle du socle. **C'est la réserve principale de cette tâche.**
> - ⚠️ **AUX ALTITUDES DU SOCLE, LA HOULE ET L'ÉCUME NE SE LISENT PAS** : ΔE = 0 à 6,4 km, 0,10 à 12,7 km. La mer y est une nappe de couleur. **La richesse ne commence à se voir qu'au-dessus de ~25 km**, c'est-à-dire au seuil de naissance du socle, pas en dessous.
> - **LA RÉFRACTION N'EST PAS PORTÉE** (elle exige une copie de tampon d'image par appel de dessin).
> - **LE COÛT DE LA CALOTTE ELLE-MÊME N'A PAS ÉTÉ MESURÉ** au protocole de l'Étape 1. La table mesure la mer DU SOCLE ; la calotte a une autre géométrie (66 049 sommets à pas 256, un appel de dessin, un lien de texture) et son coût par image reste à relever.
> - **LE CHAMP EST À UN SEUL ZOOM.** `remplirHauteurs` ne remplit que les nœuds couverts par une tuile dont les hauteurs vivent encore : demandé à z12 sur une calotte de 164 km, la couverture tombe à **0,193** ; à z10 elle atteint **1,0** pour 25 tuiles. **Une calotte fine près du crop et grossière au loin reste à faire** — c'est elle qui rendrait la houle lisible aux basses altitudes.
> - **UN SEUL CROP, UNE SEULE MACHINE.** La Réunion, RTX 3080.

#### Tour de correction 1 — ce qu'une relecture indépendante a trouvé, et ce que la mesure a tranché

⚠️ **CETTE SECTION S'AJOUTE AU BILAN CI-DESSUS, ELLE NE LE REMPLACE PAS.** Les phrases corrigées restent en place, barrées, avec un renvoi ici — la règle des listes du §0, appliquée à un compte rendu.

**Verdict de la relecture : NON-CONFORMITÉ ❌ — 2 Critique, 5 Important, 2 Mineur (les deux Mineurs sont sans conséquence pratique). Le CODE tient intégralement : les 30 mutations d'origine ont été rejouées et tuées 30/30, chacune par l'assertion prévue, et trois mutations sémantiques supplémentaires posées par le relecteur ont trouvé deux trous de COUVERTURE (pas deux défauts de comportement) et zéro régression. Ce tour corrige donc des CHIFFRES et ajoute des TESTS ; il ne touche à aucune loi (`fleche`, `richesseMer`, `distanceBascule`, `distanceRivage`, la rampe nautique) qui restent celles livrées.**

**F-1 (critique) — LE `fov = 33°` DE LA DÉRIVATION DE NYQUIST N'EXISTAIT NULLE PART AILLEURS DANS LE DÉPÔT, ET C'EST CORRIGÉ, PAS SEULEMENT DIT.** `grep -rn "fovDeg.*33" src/*.js src/monde/*.js` ne rendait que le défaut de `poserMer` lui-même — une constante inventée, pas recopiée d'une source. Le fov CANONIQUE de l'application est `FOV_DEG = 30` (`src/monde/seuil-socle.js:174`, tiré de `main.js:263`), et c'est LUI qui alimente `SEUIL_NAISSANCE_M` (32 274 m) — le chiffre même auquel le bilan compare sa bascule. Comparer une bascule calculée à 33° à un seuil calculé à 30° comparait deux caméras différentes.

- **`src/globe.js` importe maintenant `FOV_DEG` depuis `./monde/seuil-socle.js`** et le défaut de `poserMer` est `fovDeg = FOV_DEG`, pas une valeur en dur. Un futur défaut recopié divergerait du fov réel de l'application au lieu de le refléter.
- **Recalculé** (mêmes λ = 688 m, hauteurPx = 414 px que le bilan) : bascule **265,75 km** (4,171 unités de scène) au lieu de 240,39 km, soit **+10,55 %**. Bande **[132,88 ; 531,50] km** (**[2,086 ; 8,343]** unités) au lieu de [120,20 ; 480,79] km.
- **La conclusion qualitative NE SURVIT PAS SEULEMENT — ELLE SE RENFORCE.** Le socle naît à 32 274 m et meurt à 40 343 m ; le rapport bascule/mort-du-socle passe de **2,98** (l'ancien calcul, faussé) à **3,29** (le vrai). Toute la plage de vie du socle reste du côté riche, avec une marge légèrement PLUS GRANDE que celle publiée, pas plus petite.
- **Test ajouté :** `test/mer-sphere.test.js` ⑩i appelle `Globe.prototype.poserMer` sur un crop réel et recalcule `distanceBascule({ lambda: r.lambda, hauteurPx: 900, fovDeg: FOV_DEG })` INDÉPENDAMMENT de `poserMer`, puis compare au `r.bascule` rendu — un futur défaut recopié (« 33 », ou toute autre valeur non tirée de `FOV_DEG`) ferait diverger ce test sans que le test ait besoin de connaître sa propre valeur numérique.
- ⚠️ **Avertissement pris au sérieux :** le contrôleur de ce chantier avait déjà inventé une réconciliation par le fov qui n'existait pas ailleurs dans ce même dépôt. Le correctif ci-dessus prend le fov à sa source canonique (`seuil-socle.js`, elle-même dérivée de `main.js`), pas d'une seconde constante recopiée.

**F-2 (critique) — « 986 TUILES » N'AVAIT AUCUNE SOURCE. LE CHIFFRE EST RETIRÉ, PAS REMPLACÉ.** Cherché dans tout `.banc/` (JSON, scripts, `.md`) : « 986 » n'apparaissait que dans la prose du bilan et dans les deux scripts qui l'y ont saisie — aucune mesure, aucun `_visites` relevé ne le précédait. Le bilan citait le Tour 1 de la Tâche C comme origine ; **la Tâche C, à l'endroit cité, porte 700, et le déclare elle-même explicitement NON MESURÉ** (`paquet-C-tour1.md:174` : « Personne n'a mesuré ce que ce bagage devient à 700 tuiles »). Aucun des deux chiffres (700 ou 986) n'a de mesure derrière lui dans ce chantier — le Tour 1 de C a mesuré sur 172 tuiles z13, une configuration différente.

- **« 2 958 liens et 986 copies » est retiré** : c'était une multiplication arithmétiquement correcte d'un nombre inventé, et la retirer ne change rien à ce qui EST établi.
- **Ce qui reste, sans avoir besoin d'aucun compte de tuiles :** la mer du socle porte trois liens de texture et une copie de tampon d'image PAR APPEL DE DESSIN, c'est-à-dire par tuile ; une calotte unique en porte un et zéro — quel que soit le nombre de tuiles que compare une mesure future. C'est une inégalité, pas un ratio chiffré, et elle n'a besoin d'aucune mesure pour être vraie.
- Conformément à la règle du §0 (« un chiffre retiré vaut mieux qu'un chiffre faux ») : pas de chiffre de remplacement fabriqué pour cette correction. Une mesure réelle du nombre de tuiles concerné reste à faire si ce chiffre est un jour nécessaire.

**F-3 (important) — LE CORPS DE `poserMer` (~150 LIGNES) N'ÉTAIT EXERCÉ PAR AUCUN TEST. IL L'EST MAINTENANT, ET AUCUN DÉFAUT DE COMPORTEMENT N'Y A ÉTÉ TROUVÉ.** Seule la clause de refus (`!this._crop`, ⑩c) était exercée ; le relecteur a démontré en direct qu'échanger `Math.min`/`Math.max` dans le bornage de portée (`src/globe.js`, la ligne qui calcule `p`) survivait à 44/44 verts.

- **Cause du trou :** `poserMer` fait `await import('./ocean.js')` en cours de route, et `ocean.js` tire `ocean-waves` par un alias que seul Vite résout — un import statique de `Globe` sous node nu échoue dès qu'on dépasse la clause de refus. `test/damier-mer-runtime.test.js` avait déjà payé et résolu ce même problème pour `RealWater`, avec `node:module.registerHooks` (cinq lignes, qui redirigent `ocean-waves` vers la copie vendorée). Le même patron est repris en tête de `test/mer-sphere.test.js`.
- **Six tests ajoutés** (⑩e à ⑩j) qui appellent `Globe.prototype.poserMer` sur un `Globe` minimal portant un VRAI `repereCrop` (La Réunion), avec un `remplir` de synthèse : la dérivation de portée non bornée (⑩e, qui tue directement l'échange `Math.min`/`Math.max` — vérifié en remettant la mutation en place : ⑩e et ⑩g rougissent, chacune par l'assertion qui la vise), l'écrêtage au plafond (⑩f, altitude 400 km) et au plancher (⑩g, altitude quasi nulle), la pose réelle du maillage et des uniformes (⑩h), la bascule au fov canonique (⑩i, voir F-1), et le retrait effectif du maillage posé (⑩j).
- **Aucun défaut de comportement trouvé** : le bornage, la pose et le retrait font tous ce que la documentation du code annonce. Le trou était un trou de COUVERTURE, pas un bug caché.

**F-4 et F-5 (important) — DEUX LITTÉRAUX GLSL NON GARDÉS, MAINTENANT GARDÉS.** L'exposant `0,55` de la rampe nautique du fond (transcription de `terrain.js:1019-1023` dans `globe.js`) et le seuil `0,10` du fondu de rivage (`smoothstep(0.0, 0.10, vRive)`) n'étaient protégés par aucun test — mutés à `1,0` et `0,40` respectivement, les deux survivaient à 44/44.

- **`test/mer-sphere.test.js` ⑧c** extrait le texte GLSL de `dMer01` (même patron que ⑧a pour `richesseMer`) et le confronte MÉCANIQUEMENT à `abscisseNautique`, la loi pure du module, sur un balayage de 201 points — remis en place, la mutation de l'exposant (`0,55` → `1,0`) fait rougir exactement ce test.
- **`test/mer-sphere.test.js` ⑧d** vérifie la valeur EXACTE du seuil (`0.0`, `0.10`) dans le bloc GLSL extrait — remis en place, la mutation du seuil (`0,10` → `0,40`) fait rougir exactement ce test.
- Les deux valeurs restent celles livrées, vérifiées justes ; seule leur couverture change.

**F-6 (important) — LA RÉGRESSION EST EXACTE, SA PUISSANCE ÉTAIT SURPRÉSENTÉE. Réserve ajoutée, chiffres inchangés.** Trois stations et deux paramètres libres ne laissent qu'UN DEGRÉ DE LIBERTÉ pour juger la linéarité de l'ajustement affine (`0,0372 ms/Mpx + 0,0169 ms de fixe`) — et son résidu maximal (0,0014 ms) est du même ordre que le bruit du banc lui-même (témoin de dérive : ≤ 0,001 ms). Les trois points recalculés à la main tombent exactement sur les chiffres publiés ; ce n'est pas leur exactitude qui est en cause, c'est la confiance qu'un ajustement à un seul degré de liberté peut soutenir. La réserve est maintenant explicite dans le bilan ; aucune donnée supplémentaire n'a été prise pour ce tour de correction.

**F-7 (important) — « LE COÛT PAR PIXEL MONTE » EST UN COROLLAIRE ALGÉBRIQUE DE LA RÉGRESSION DU MÊME PARAGRAPHE, PAS UN SECOND FAIT INDÉPENDANT. Reformulé, rien retiré.** Si `coût = a·x + b` (ce que F-6 établit), alors `coût/x = a + b/x`, qui croît mécaniquement quand `x` (la couverture) rétrécit, pour toute valeur `b > 0` — sans qu'aucune propriété particulière de la mer n'intervienne. Le bilan le présentait comme « LE FAIT, ET IL FONDE TOUTE LA TÂCHE ». Le mécanisme causal nommé (« la part fixe s'amortit sur moins de pixels ») reste juste et bien identifié, et la décision d'ingénierie qui en découle (une richesse qui atteint exactement zéro, pour sauter plutôt que multiplier) reste une bonne décision — mais elle ne repose sur aucun fait de plus que l'ajustement affine déjà publié. Le bilan est reformulé pour le dire ; le fait lui-même — **le bagage fixe domine en vue lointaine** — reste, sans déguisement, le fait le plus utile de la tâche.

**Ce qui n'a PAS bougé, vérifié pour de bon :** le chanfrein « au bit près », la rampe nautique transcrite, les assertions ③c/③d réparées par l'implémenteur, les drapeaux de sûreté production (`uCropOn`, `uHabOn`, `uMerRampeOn`, `uMerFondBudgetM`, `uLandMax`), et les 30 mutations d'origine — tous revérifiés, tous bons.

**Tests : 52/52 sur `mer-sphere` (44 + 8 nouveaux : ⑧c, ⑧d, ⑩e à ⑩j), 3 563/3 563 au total (3 555 + 8), `audit:tests` 199/199, `node --check` sur les quatre fichiers touchés.** Les trois mutations nommées par la relecture (bornage `Math.min`/`Math.max`, exposant `0,55`, seuil `0,10`) ont été remises en place une par une pour vérifier que les nouveaux tests les tuent — confirmé, chacune par l'assertion qui la vise (⑩e/⑩g pour le bornage, ⑧c pour l'exposant, ⑧d pour le seuil) — puis retirées avant le commit. **Page rechargée après la correction : aucune erreur nouvelle en console** (seuls les `ERR_CONNECTION_TIMED_OUT` déjà connus du bucket AWS).

### Tâche G — L'ESTOMPAGE DE LA TERRE AUTOUR (décision 3)

**Fichiers :** modifier `src/main.js` (la passe de fond) · tester

⚠️ **ET C'EST ELLE QUI RÉPARE CE QUE LA TÂCHE A A RENDU BIZARRE.** Relevé à l'écran après la découpe : **l'atmosphère et les nuages ne sont PAS coupés** (matériaux séparés), donc la planète reste « une grosse boule laiteuse avec un timbre-poste dessus ». Les calottes polaires non plus — sans effet à l'échelle du socle. **Tant que cette tâche n'est pas faite, l'image ne peut pas être jugée.**


La planète autour du crop **se fond progressivement vers le fond** à mesure qu'on descend, pour que le bloc se détache. ⚠️ **La Tâche 1b bis a laissé la porte ouverte : « un fondu croisé en espace-écran est trivial avec deux passes ».** Ici il n'y a plus deux mondes, mais le fondu reste en espace-écran.

⚠️ **R1 : le paramètre du fondu est une ALTITUDE, jamais une fraction d'écran.**

- [ ] Test → rouge → implémenter → mutation → écran → clôture.

### Tâche I — LE BRANCHEMENT ⚠️ LE TROU DU PLAN, TROUVÉ PAR ADRIEN À L'ÉCRAN

**Fichiers :** modifier `src/main.js` · `src/flags.js` · tester

⚠️ **CE PLAN N'AVAIT AUCUNE TÂCHE QUI BRANCHE CE QU'IL CONSTRUIT.** Les tâches A à G posent
`poserCrop`, `construireParoisCrop`, `poserHabillage`, `poserRampe`, `poserMer` — et
**personne ne les appelle**. Compté le 2026-08-21 dans `src/` hors `globe.js` :

| | appelants de production |
|---|---|
| `poserCrop` | **0** *(1 mention, en commentaire)* |
| `poserHabillage` | **0** *(1 mention, en commentaire)* |
| `poserRampe` | **0** *(2 mentions, en commentaire)* |
| `poserMer` | **0** |
| `construireParoisCrop` | **0** |
| `poserEstompage` | **1**, derrière le drapeau de la Tâche G |

**Conséquence, et Adrien l'a vue avant moi :** l'application se comporte exactement comme
avant le chantier. Crans au zoom, bascule sur le socle vers Z11, **les deux Terres
superposées en transparence**, exagération démesurée. Ce n'est pas un mauvais serveur, ce
n'est pas un drapeau oublié : **c'est une tâche qui manque au plan.**

⚠️ **Et la Tâche H ne peut pas passer avant.** « Retirer le chemin bloc de `terrain.js` »
retirerait le seul socle qui existe, sans rien pour le remplacer.

- [ ] **Étape 1 — le test qui échoue.** Il doit exiger que, sous le drapeau, **la descente
      appelle réellement la chaîne** : crop posé aux bonnes bornes, parois bâties, habillage,
      rampe, mer, estompage suivi de l'altitude. ⚠️ **Un test qui vérifie qu'une fonction
      EXISTE ne mord pas** — ce chantier a déjà vu un corps de 150 lignes passer 44 tests
      verts sans être exercé une seule fois.
- [ ] **Étape 2** — le lancer, le voir rouge.
- [ ] **Étape 3 — implémenter, DERRIÈRE UN DRAPEAU.** `terreUnique`, défaut **false**, essayable
      par l'adresse (`?terre=unique`). ⚠️ **Le socle actuel est EN PRODUCTION sur shibumap.com :
      le défaut ne bascule pas dans cette tâche.**
- [ ] **Étape 4 — la reprise de `seuil-socle.js`.** `socleVisible` / `empriseSocle` décident
      aujourd'hui quand le socle plat naît et meurt (32 274 m / 40 343 m). C'est la même
      décision pour le crop : **réutiliser, ne pas refaire.**
- [ ] **Étape 5 — mutation.** Sémantiques, dans un worktree à part.
- [ ] **Étape 6 — REGARDER L'ÉCRAN, et c'est l'objet de la tâche.** Descendre de l'orbite au
      sol **sans toucher à la console**, drapeau levé. ⚠️ **Dire franchement ce qu'on voit** :
      trois tâches de ce chantier ont écrit « non, ça ne ressemble pas encore au socle »
      plutôt que de conclure au succès, et c'est ce qui a rendu leurs rapports utilisables.
- [ ] **Étape 7 — la clôture du §0**, page chargée drapeau levé ET baissé, puis commit.

⚠️ **CE QUI RESTERA FAUX APRÈS CETTE TÂCHE, ET QU'ELLE NE DOIT PAS MAQUILLER** : le crop ne
ressemble toujours pas au socle (Tâches C, D, F), les arêtes du bloc sont vives (Tâche B),
**les jupes des tuiles pendent sous le bloc** (Tâche E), et **les raccords de niveaux du
quadtree font des arêtes droites dans les alentours** (Tâche G). Le branchement les rend
**visibles ensemble pour la première fois** — c'est son intérêt, pas son échec.

### Tâche H — LA DÉPOSE ⚠️ EN DERNIER

Retirer `monde/fenetre-bornee.js`, le chemin « bloc » de `terrain.js`, et les drapeaux devenus inutiles. ⚠️ **Ne commence pas avant que tout le reste soit vert à l'écran.** **Le dépôt doit avoir MAIGRI.**

---

## 7. Ordre imposé

**A** (la découpe) → **B** (les parois) → **C** (l'habillage) → **D** (la rampe) → **E** (l'exagération) → **F** (la mer) → **G** (l'estompage) → **H** (la dépose).

**A, B, C, D, E et F sont faites.** ⚠️ **Et le §9 avait raison sur un point que la Tâche F confirme** : ce plan devait RETIRER du code, et il en ajoute encore — `monde/fenetre-bornee.js` (818 lignes) et le chemin « bloc » de `terrain.js` attendent toujours la Tâche H.

⚠️ **C avant D** : la rampe est un poste de l'habillage, mais elle a sa tâche parce qu'elle porte une décision produit. ⚠️ **F après C** : la mer réutilise le nuanceur unifié. ⚠️ **H en dernier, toujours.**

---

## 8. Ce qui reste ouvert pour Adrien

- **Le bloc a des arêtes VIVES** (Tâche B, Étape 4) — le **chanfrein** d'arête haute et le **congé** bas de `plinth.js` ne sont pas portés. C'est le geste qu'Adrien avait lui-même demandé sur le socle (« il est vraiment arrondi, et c'est un vrai chanfrein dessous ») : **la perte est visible, et elle est devant lui, pas cachée dans un commentaire.** Trois raisons de l'avoir différée, toutes dans l'en-tête de `parois-crop.js` ; la troisième est datante — leur garde-fou (`min(x, (topMax − baseY) × 0,25)`) est calibré sur une exagération de **2,8**, et le globe est à **18**. **À reposer après la Tâche E**, pas avant.
- **Le bord de la PAROI n'est pas antialiasé** (relevé par la Tâche B) — la couverture douce ne couvre que la surface ; la silhouette du bloc, elle, est de la géométrie, et `antialias === false`. Reste à trancher : on vit avec, ou on paie une passe.
- **La transition d'apparition du crop** (décision 4 du plan précédent : « le socle complet apparaît d'un coup, **avec une transition à dessiner** ») — elle n'est toujours pas dessinée, et le rideau qui la masquait est parti.
- **L'indicateur affiche encore un numéro de zoom** quand il n'y a plus de socle.
- **Le raccord de palette au bord du crop** — la Tâche D doit le supprimer ; s'il subsiste, c'est un arbitrage de goût. ⚠️ **RÉPONDU PAR LA TÂCHE D, ET LA RÉPONSE EST À MOITIÉ VIDE** : il n'y a plus qu'UNE rampe, calculée une seule fois hors de toute branche et portée par des uniformes PARTAGÉS — un raccord ne peut pas naître. **Mais rien ne le montre à l'écran** : la Tâche A `discard` tout ce qui est hors du crop, donc il n'y a pas d'alentours à raccorder tant que la Tâche G n'a pas rendu la Terre autour.
- **Les crops continentaux** que la sphère rend enfin possibles : les veut-il, et à quelle largeur maximale ?
- **LES JUPES DES TUILES PENDENT SOUS LE BLOC** (relevé par la Tâche E, à l'écran) — cinq à six languettes qui descendent sous la base. Le `discard` du crop est en **lat/lon**, et une jupe partage le (lat, lon) du bord de sa tuile : elle n'est **jamais** coupée. Aucune tâche du plan ne la couvre. Deux sorties possibles, aucune mesurée : couper la jupe par sa hauteur radiale plutôt que par sa position, ou ne pas bâtir de jupe sur une tuile qui touche la frontière.
- **LE RELIEF DU GLOBE VU DE LOIN, À TRANCHER** (Tâche E, tour 1) — à ×2,8 la silhouette du limbe passe de **≈7 px à ≈1 px** sur un cadrage plein disque. **La métrique employée (écart moyen absolu sur l'image) ne sait pas distinguer cet effet du bruit des nuages** — elle n'autorise donc pas à conclure « acceptable ». Il faudrait un critère LOCAL (limbe seul, chaîne montagneuse dans le cadre, nuages figés) pour trancher ; il n'a pas été fait. **Si Adrien veut du relief à l'orbite, la courbe doit remonter aux hautes altitudes — et c'est une mesure à faire, pas un goût.**
- **L'OCCUPATION DU SOL DU CROP N'A JAMAIS ÉTÉ VUE** (Tâche C) — la couche est éteinte dans l'application, son coût est mesuré (**+0,1781 ms pour 0,81 Mpx au relevé du Tour 1**, et c'est bien le poste le plus cher des quatre, par un facteur **onze**) mais son image ne l'est pas. ⚠️ **Le chiffre « 0,093 ms, le poste le plus cher » de la première version était contredit par sa propre table** — voir « Tour de correction 1 », I-3. **À rallumer et à regarder.**
- **DEUX DES QUATRE POSTES COÛTENT MOINS QUE LE BRUIT DU BANC** (Tâche C, Tour 1) — les courbes (**+0,0134 ms**) et le masque de côte (**+0,0154 ms**) contre un plancher de **0,0297 ms**. ⚠️ **Leur coût est BORNÉ, pas mesuré** : le banc dit qu'ils valent moins de 0,03 ms, il ne dit pas combien. Il faudrait un banc plus fin, ou une machine plus lente, pour les séparer.
- **LE COÛT DE L'HABILLAGE DU SOCLE EST SURTOUT FIXE** (Tâche C, Tour 1) — **0,660 ms sur 1,087** à 0,81 Mpx sont des **liens de texture**, pas du calcul. ⚠️ **Cela déplace la question du portage** : ce qui coûterait cher sur une sphère de tuiles n'est pas le calcul du socle, **c'est son bagage de douze textures, payé par TUILE au lieu d'une fois par bloc.** Personne n'a mesuré ce que ce bagage devient à 700 tuiles.
- **LE PEIGNÉ (analyse de relief) RESTE AU SOCLE, ET C'EST LUI QU'ON VOIT** (Tâche C) — les quatre postes portés ne déplacent que **1,01 % des pixels**, témoin à zéro. Ce qui fait la richesse de l'image du socle, c'est le texture shading et la rampe locale. **Le porter coûterait 1,94 ms/Mpx au tarif complet ; sa part seule reste à mesurer.**
- **LA VUE AU NADIR DU CROP EST INJUGEABLE À ×18** (Tâche C, à l'écran) — le relief de La Réunion fait 0,86 unité de haut pour 0,21 de large, la montagne passe au-dessus de la caméra. `?exag=continu` (Tâche E) le corrige, mais il est éteint.
- **LE GLOBE ET LE SOCLE N'ONT NI LA MÊME TABLE DE COULEURS NI LA MÊME LOI DE RAMPE** (Tâche D, mesuré) — `uRamp` fait 512 × 1 et réserve 35 % à la mer ; `uRampTex` fait 512 × **64** (2ᵉ axe d'humidité) et est **entièrement terre**, la mer étant peinte par une rampe nautique à trois couleurs. Et la loi diffère : `0,35 + 0,65 · u` contre `0,5 + (hNorm − 0,65) · 2,5`. **Porter le pivot et le contraste suppose de rééchelonner le contraste avec l'amplitude du crop (2,5 → 1,38 ici) ET de changer de table — donc de toucher à la mer, c'est-à-dire la Tâche F.** C'est une décision produit, pas un portage : à trancher, avec les chiffres du bilan de D.
- **LA RAMPE LOCALE REND LE CROP PLUS SOMBRE, PAS PLUS CLAIR** (Tâche D, à l'écran) — sur la table du globe, occuper 100 % du segment terre pousse les moyennes altitudes de La Réunion du sable (`t = 0,513`) au brun rouge (`t = 0,847`), et place une « ligne de neige » vers 2 090 m sur une île tropicale. C'est la contrepartie de « couleurs stables et reproductibles », et elle se voit.
- **LA TERRE AUTOUR DU CROP N'EST PAS DESSINÉE DU TOUT** (Tâche D, vérifié à `y = 900`) — la Tâche A `discard` tout ce qui est hors du crop, donc « les alentours la suivent » n'a rien à montrer aujourd'hui. La propriété est tenue par construction (uniformes partagés, un seul calcul de `t`) mais **ne deviendra visible qu'avec la Tâche G**.
- **LE CHANFREIN DE DISTANCE AU RIVAGE DU SOCLE EST INCOMPLET, ET SON ERREUR VAUT +41,4 %** (Tâche F, mesuré) — `ocean.js` (`_bakeField`) ne lit que TROIS voisins par passe au lieu de quatre : les anti-diagonales manquent. Sur une grille 65² à une seule cellule de terre, la direction (+8, −8) rend **16,00 au lieu de 11,31**, soit `√2 − 1` d'erreur, tandis que (+8, 0) et (+8, +8) sont exacts. Ce champ pilote la houle de côte, les bandes d'écume et le ressac : **la frange de ressac meurt 41 % trop tôt sur deux orientations de côte sur quatre.** ⚠️ **NON CORRIGÉ, DÉLIBÉRÉMENT** — le socle est en production et le damier hors périmètre. `distanceRivage` a été ÉLARGIE d'une option `completes` ; le défaut par défaut reproduit le dépôt **au bit près**, et c'est la calotte qui prend le juste. **Un mot d'Adrien suffit à basculer le socle dessus** ; la ligne à changer est unique.
- **LA FRANGE CÔTIÈRE DE LA CALOTTE RESTE PLUS LARGE ET PLUS PÂLE QUE CELLE DU SOCLE** (Tâche F, à l'écran) — le champ est juste, la loi de couleur est juste (forcée à rouge/bleu elle prend bien la teinte PROFONDE là où le champ dit profond), le budget est converti — **et pourtant l'image ne rejoint pas celle du socle**. C'est la réserve principale de la Tâche F, et sa cause n'est pas établie.
- **AUX ALTITUDES DU SOCLE, LA HOULE ET L'ÉCUME DE LA CALOTTE NE SE LISENT PAS** (Tâche F, mesuré) — écart de couleur **ΔE = 0 à 6,4 km** et **0,10 à 12,7 km** entre la mer riche et la mer plate. Le socle naît à 32 km : la richesse ne commence à se voir qu'au-dessus de ~25 km. ⚠️ **La sortie est nommée et non faite : une calotte à maille GRADUÉE**, fine près du crop et grossière au loin. Aujourd'hui la maille est uniforme (688 m à portée 12), et le champ est rempli à un SEUL zoom — z12 sur 164 km ne couvre que **19,3 %** des nœuds, z10 en couvre **100 %** pour 25 tuiles.
- **LE COÛT DE LA CALOTTE ELLE-MÊME N'EST PAS MESURÉ** (Tâche F) — la table de l'Étape 1 mesure la mer DU SOCLE (`0,0372 ms/Mpx + 0,0169 ms de fixe`, part fixe de 36 % à 0,81 Mpx). La calotte a une autre géométrie (66 049 sommets, **un** appel de dessin, **un** lien de texture contre trois, **zéro** copie de tampon contre une) : son coût par image reste à relever au même protocole.
- **LA RÉFRACTION N'EST PAS PORTÉE SUR LA CALOTTE** (Tâche F) — elle exige `copyFramebufferToTexture` à chaque dessin. La lame d'eau est simplement transparente : le fond se lit à travers, mais **sans la torsion de Snell sous les vagues**.
- **LES QUATRE CONSTANTES DU SOCLE QUE LA MER A DÛ CONVERTIR** (Tâche F) sont maintenant nommées et testées, mais **elles disent aussi que le socle et le globe n'ont toujours pas d'unité commune** : epsilon de coplanarité (0,003 unité → 68,3 m si recopié), budget de profondeur (2,2 → 4 310 m si pris sur le réel), seuil du trait d'eau (0,02 → **455 m d'eau semi-transparente** si recopié), échelle de houle (0,42, **horizontale donc non divisée par l'exagération**). ⚠️ **Une cinquième dort encore dans `ocean.js` : `SHORE_SURF_GLSL` porte `1.0 / 384.0` EN DUR** pour son pas de gradient, alors que `resChamp` rend 1 152 sur une emprise 3×3 — **le pas de la houle de côte y est trois fois trop grand.** Hors périmètre (c'est le damier), non corrigé, écrit ici pour qu'on puisse le retrouver.
- **LE COÛT DE L'EXAGÉRATION DU GLOBE** (Tâche E) — **12 à 21 s de rechargement réseau à chaque cran**, parce que le relief est cuit dans les sommets. Tant qu'il n'est pas déplacé dans le nuanceur de sommets, `?exag=continu` ne peut pas devenir le défaut, et la courbe reste échantillonnée aux crans au lieu de glisser.

---

## 9. Auto-revue

**Ce plan retire plus qu'il n'ajoute** — c'est son critère de réussite, pas un effet de bord.

⚠️ **Le risque principal est la Tâche C.** Si le nuanceur du socle ne tient pas sur une sphère de tuiles à budget constant, tout le chantier se réduit à « deux Terres qui se ressemblent », c'est-à-dire au palliatif qu'Adrien a refusé. **C'est pour ça que sa première étape est une mesure, et non une implémentation.**

⚠️ **Le second risque est la frontière.** La découpe tombe au milieu des tuiles ; le plan précédent a nommé ce problème « on ne coud pas les tuiles » et l'a résolu en rééchantillonnant. **Ici on ne peut plus : il faut couper.** La différence est qu'on coupe le long d'une **courbe**, pas d'une surface — et que `dansFenetre` donne cette courbe exactement.

**Aucun chiffre de ce plan n'est inventé.** Ils viennent tous du plan précédent, où ils ont été mesurés, ou portent la mention « À MESURER » avec leur protocole.
