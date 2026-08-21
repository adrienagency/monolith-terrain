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

- [ ] **Étape 1 — le test qui échoue** : le solide est **fermé** — `auditerSolide` rend `‖Ā‖ < ε`. ⚠️ **Et le test qui MORD** : `hauteurs.distinctes > 2`, sans quoi un pavé droit à hauteurs nulles passerait cent fois.
- [ ] **Étape 2** — le lancer, vérifier qu'il échoue.
- [ ] **Étape 3 — implémenter.** ⚠️ **La frontière tombe au MILIEU des tuiles** : les sommets de paroi doivent s'appuyer sur la surface **exacte** au point de coupe, pas sur le sommet de tuile le plus proche — sinon un liseré.
- [ ] **Étape 4 — les douze options de `buildSlabWalls`.** Porte ce qui a un sens ; **écris ce qui se perd et pourquoi.** La décision 5 dit que la gravure ne s'écrit qu'à l'arrêt.
- [ ] **Étape 5 — mutation** : retirer une paroi doit tuer le test de fermeture.
- [ ] **Étape 6 — REGARDER L'ÉCRAN.**
- [ ] **Étape 7 — LA CLÔTURE DU §0**, puis commit.

### Tâche C — L'HABILLAGE : LE GLOBE PREND LE RENDU DU SOCLE ⚠️ C'EST LA TÂCHE QUI DÉCIDE DU RÉSULTAT

**Fichiers :** modifier `src/globe.js` · lire `src/terrain.js` · tester `test/crop-habillage.test.js` (créer)

**Décision 6 : le rendu du socle est la RÉFÉRENCE.** Le nuanceur du globe doit porter ce que porte celui du socle : **courbes de niveau calées sur le relief local, grain, masque de côte, bathymétrie fusionnée, occupation du sol.**

⚠️ **C'EST LE SEUL POINT DONT LE COÛT EST INCONNU. Mesure-le AVANT d'implémenter**, et si le budget ne tient pas, **dis-le et propose une dégradation** plutôt que de livrer une image lente.

- [ ] **Étape 1 — MESURER D'ABORD.** Coût par image du nuanceur du socle contre celui du globe, à même nombre de pixels. **Écris la table.**
- [ ] **Étape 2 — le test qui échoue** : sur une même emprise, le globe et l'ancien socle rendent **la même image à quelques unités de couleur près**. ⚠️ **Sers-toi de `readPixels` après un `composer.render()` explicite** — c'est ce qu'ont fait trois tâches du plan précédent.
- [ ] **Étape 3 — implémenter, poste par poste**, en mesurant à chaque ajout.
- [ ] **Étape 4 — mutation** : retirer un poste doit tuer une assertion identifiée.
- [ ] **Étape 5 — REGARDER L'ÉCRAN**, côte à côte avec l'ancien socle.
- [ ] **Étape 6 — LA CLÔTURE DU §0**, puis commit.

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

- [ ] Test → rouge → implémenter → mutation → écran → clôture.

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

- **La transition d'apparition du crop** (décision 4 du plan précédent : « le socle complet apparaît d'un coup, **avec une transition à dessiner** ») — elle n'est toujours pas dessinée, et le rideau qui la masquait est parti.
- **L'indicateur affiche encore un numéro de zoom** quand il n'y a plus de socle.
- **Le raccord de palette au bord du crop** — la Tâche D doit le supprimer ; s'il subsiste, c'est un arbitrage de goût.
- **Les crops continentaux** que la sphère rend enfin possibles : les veut-il, et à quelle largeur maximale ?

---

## 9. Auto-revue

**Ce plan retire plus qu'il n'ajoute** — c'est son critère de réussite, pas un effet de bord.

⚠️ **Le risque principal est la Tâche C.** Si le nuanceur du socle ne tient pas sur une sphère de tuiles à budget constant, tout le chantier se réduit à « deux Terres qui se ressemblent », c'est-à-dire au palliatif qu'Adrien a refusé. **C'est pour ça que sa première étape est une mesure, et non une implémentation.**

⚠️ **Le second risque est la frontière.** La découpe tombe au milieu des tuiles ; le plan précédent a nommé ce problème « on ne coud pas les tuiles » et l'a résolu en rééchantillonnant. **Ici on ne peut plus : il faut couper.** La différence est qu'on coupe le long d'une **courbe**, pas d'une surface — et que `dansFenetre` donne cette courbe exactement.

**Aucun chiffre de ce plan n'est inventé.** Ils viennent tous du plan précédent, où ils ont été mesurés, ou portent la mention « À MESURER » avec leur protocole.
