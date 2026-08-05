# Damier multi-blocs — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser `superpowers:subagent-driven-development` pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** faire des blocs voisins du damier des blocs de plein droit — même habillage que le bloc principal, jointures nettes, hauteur commune, une seule mer pour tout l'ensemble — sous une grille toujours carrée et bornée.

**Architecture :** une seule décision porte tout le reste — **le damier est TOUJOURS un carré plein** (1×1, 2×2 ou 3×3, jamais de trou). Cet invariant rend calculable, sans aucune heuristique, quelles arêtes sont extérieures (arrondis), quelle est l'emprise de la mer et de sa jupe, et de combien les textes doivent s'écarter. Tout le plan en découle.

**Pile technique :** JavaScript ES modules, three.js, tests `node --test`. Aucune dépendance nouvelle.

---

## Ce qui existe déjà, et qu'il ne faut pas réinventer

Un agent qui ignore cette section va reconstruire des choses qui marchent.

| Besoin | Existe déjà | Où |
|---|---|---|
| Champ de mer sur N blocs | `resChamp(cote)`, `spanChamp(taille, cote)` | `src/mer-emprise.js:47-69` |
| Écarter les textes du bloc | `groundInfo.setFrameScale(k)` | `src/ground-info-layer.js:476`, appelé en mode zone isolée depuis `src/main.js:6246` |
| Pose isométrique d'un nuage de points | `poseIsometrique(points, { fovDeg, marge })` | `src/vue-ensemble.js` |
| Plancher de base commun aux socles | paramètre `baseYFloor` | `src/plinth.js:212` |
| Bande d'occlusion commune | `bandeContact(hautMax, baseY)` | `src/plinth.js:127` |
| Socle des voisines | `buildSlabWalls` appelé par cellule | `src/block-grid.js:579` |
| Photo aérienne des voisines | `cell.aerial` | `src/main.js:5764-5782` |
| Masque côtier des voisines | `fetchCoastMask` par cellule | `src/block-grid.js:608-623` |
| Rampe hypso / rugosité / bump partagées | `shareTexturesFrom` | `src/terrain.js:1521-1546` |

⚠️ **Le commentaire d'en-tête de `src/block-grid.js:12-15` est faux** : il annonce que les voisines n'ont « PAS le socle ni l'aérien ». Elles les ont. Ce commentaire est corrigé en Tâche 11.

---

## Contraintes globales

Elles s'appliquent à **toutes** les tâches. Une tâche qui les viole est rejetée, même si ses tests passent.

1. **`GRID_R` reste à 2.** `src/block-grid.js:25`. Le mode zone isolée s'en sert pour cadrer en 5×5 (`src/region-mask.js:523-556`, `spanBlocks = GRID_R * 2 + 1`) et `test/region-grid.test.js` le verrouille. Le plafond 3×3 introduit par ce plan concerne **le chemin GPX uniquement**. Ne touchez pas à `GRID_R`.
2. **Ne touchez pas au cache de gabarit de maillage.** `src/grid-template.js:48-69` et `src/detail-noise.js:29-36` mémoïsent à **2 entrées exactement** (héros + voisines). Donner sa propre résolution de maillage à chaque voisine ferait s'évincer les entrées mutuellement et recuirait le maillage du héros à chaque image — 194 ms et 262 Mo mesurés. `NEIGHBOUR_RES` reste une constante unique. « Traiter les voisines comme le principal » signifie **même habillage**, pas même densité de maillage.
3. **Aucune cohabitation avec la fenêtre continue.** Quand `dem.empriseCote > 1`, le damier est vide (`src/main.js:4404-4412`). Ce plan ne change pas cette frontière ; la Tâche 2 y ajoute un garde-fou testé.
4. **Le MNT des voisines n'est jamais réduit.** Exception délibérée, verrouillée par `test/damier-memoire.test.js:277`.
5. **Règle des 4× conservée** : aucune texture ne dépasse quatre fois la densité du maillage qui la porte (`src/block-grid.js:41-43`).
6. **Tout module pur nouveau est ajouté à la ligne `"test"` de `package.json`.** Cette ligne liste les fichiers de test **un par un** ; un test absent de la liste ne tourne jamais. Après chaque ajout, vérifier que le compte des fichiers sur disque égale le compte dans la liste.
7. **Français dans les commentaires et les noms de nouveaux symboles**, comme le reste du dépôt récent.
8. **Un commit par tâche**, message en français, préfixe `feat:` / `fix:` / `refactor:`.

---

## Décisions d'architecture, et pourquoi

Un agent qui n'est pas d'accord avec l'une d'elles doit le dire dans son rapport **avec une mesure**, pas la contourner en silence.

### D1 — La grille est un carré plein, pas un ensemble de cases adjacentes

La demande initiale disait « boucher les cases non traversées mais adjacentes à au moins 2 blocs », en concluant « on se retrouve forcément avec 1×1, 2×2, 3×3 ». **Ces deux phrases ne décrivent pas la même règle** : compter les adjacences ne produit pas un rectangle en général (un tracé en L garde son L). C'est le **résultat** qui est voulu — pas de trou, forme régulière — donc c'est le résultat qu'on implémente : boîte englobante des cases traversées, étendue au carré, plafonnée.

Ce choix n'est pas cosmétique. Il rend **exactes** quatre choses qui seraient autrement des heuristiques : quelles arêtes sont extérieures, l'emprise de la mer, le tracé de la jupe, l'écart des textes.

Coût assumé : un tracé qui ne touche que deux cases côte à côte fera charger un carré 2×2, soit une case de plus que le strict nécessaire. C'est le prix de la régularité, et il est plafonné par D2.

### D2 — Plafond 3×3 sur le chemin GPX, et le palier machine devient enfin effectif

Aujourd'hui `cellsForTrack` (`src/block-grid.js:331`) rejette au-delà de `GRID_R = 2`, donc **jusqu'à 24 voisines**. Le plafond « 3×3 » qu'on croyait avoir n'existe pas. Pire, `damierMax` (`src/palier-machine.js:123/140/159/176`, valeurs 24/12/8/4 selon la puissance de la machine) n'est **lu nulle part** pour brider le damier — vérifié par recensement : `blockGrid` n'apparaît que dans `main.js`, `ui/map-panel.js` et `block-grid.js`.

On introduit donc deux bornes :
- un plafond de côté **3** pour le carré GPX ;
- un rétrécissement du carré (3 → 2 → 1) tant que son nombre de voisines dépasse `damierMax`.

Sur le palier plancher (`damierMax = 4`), un carré 3×3 demande 8 voisines : il tombe à 2×2 (3 voisines). C'est l'exigence « l'optimisation de la charge est un point essentiel » rendue mesurable.

### D3 — Pas de masque mobile pour le multi-blocs

Question posée : le damier devrait-il glisser sous un masque comme le 1×1 ? **Non.**

Le glissement du 1×1 est la « fenêtre continue » : elle ne fonctionne que parce que **tout est précuit une fois sur une emprise finie et petite**, et le code le dit lui-même (`src/dem-emprise.js:47-50` : « toute l'architecture … ne tient QUE parce que l'emprise est finie et petite »). Faire glisser un damier 3×3 exigerait de précuire une emprise 5×5 — exactement ce que cette phrase interdit. Le damier reste statique ; c'est la caméra qui bouge (Tâche 10).

### D4 — Une seule mer pour tout le carré, en réutilisant la machinerie de l'emprise

Aujourd'hui une seule mer, taillée sur **un** bloc (`src/ocean.js:1090`), et aucune sous les voisines. Trois options ont été pesées :

| Option | Verdict |
|---|---|
| Une mer par cellule | Rejetée : N appels de rendu, N reflets à réconcilier, coutures visibles aux jointures |
| Une mer étendue au carré, champ recuit à `resChamp(cote)` | **Retenue** — c'est exactement ce que fait déjà la fenêtre continue, machinerie éprouvée et mesurée (3×3 → champ 1152², 5,3 Mo) |
| Mer plate sans champ hors du bloc central | Rejetée : la mer perdrait ses vagues et sa caustique dès qu'on charge un voisin |

La jupe suit : `buildRimGeometry(half, corner, cornerN)` (`src/ocean.js:633`) prend déjà un demi-côté en paramètre — on lui passe celui du carré.

### D5 — Arêtes intérieures : arrondi et chanfrein à zéro, murs conservés

Les arrondis laids des captures viennent de `SOCLE_ARRONDI` (congé bas, 0,9) et `SOCLE_CHANFREIN` (liseré haut, 0,16) appliqués **uniformément aux quatre côtés** de chaque cellule. Sur une arête intérieure, deux congés se font face et creusent une rainure.

On rend ces deux valeurs **indexées par sommet du contour**, à zéro sur les arêtes intérieures. Les murs intérieurs sont **conservés** (et non supprimés) : ils sont dos à dos, chacun ne regarde que vers l'intérieur du bloc voisin, donc invisibles — les supprimer économiserait des triangles mais ouvrirait un jour visible si deux MNT voisins divergeaient d'un pouce à la couture. Une mesure de ce gain est demandée en Tâche 12 ; la suppression n'est pas dans ce plan.

---

## Structure des fichiers

**Créés**
- `src/damier-carre.js` — pur. Boîte englobante → carré, plafonds, et masque d'arêtes extérieures.
- `test/damier-carre.test.js`
- `src/damier-bords.js` — pur. Étiquetage des sommets du contour du socle par côté.
- `test/damier-bords.test.js`
- `test/damier-mer.test.js` — emprise et centre de la mer sur le carré.
- `test/damier-cadre.test.js` — écart des textes et cadrage caméra.

**Modifiés**
- `src/block-grid.js` — `cellsForTrack` passe par le carré ; `baseYFloor` devient le minimum de toutes les cellules ; les bords sont transmis au socle.
- `src/plinth.js` — `computeSlab` étiquette son contour ; `buildSlabWalls` accepte des arrondis par arête.
- `src/ocean.js` — `rebuild` prend un côté de carré et un centre.
- `src/ground-info-layer.js` — l'ancrage mural suit le côté du carré.
- `src/main.js` — câblage : carré, mer, textes, caméra.
- `package.json` — quatre fichiers de test à ajouter à la ligne `"test"`.

---

## Tâche 1 : le carré couvrant (module pur)

**Fichiers**
- Créer : `src/damier-carre.js`
- Créer : `test/damier-carre.test.js`
- Modifier : `package.json` (ligne `"test"`)

**Interfaces**
- Consomme : rien.
- Produit :
  - `carreCouvrant(cellules, { cotemax = 3 })` → `{ i0, j0, cote }` — coin bas-gauche inclus et côté du carré. `cellules` est un itérable de clés `"i,j"` (le format de `BlockGrid`). Rend `{ i0: 0, j0: 0, cote: 1 }` si l'entrée est vide.
  - `cellulesDuCarre({ i0, j0, cote })` → `Set<string>` de toutes les clés du carré, **centre `"0,0"` exclu** (le bloc central n'appartient pas au damier — cf. `src/block-grid.js:178`).
  - `carreSousPlafond(carre, damierMax)` → `{ i0, j0, cote }` — rétrécit le côté tant que `cellulesDuCarre(...).size > damierMax`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `test/damier-carre.test.js` :

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { carreCouvrant, cellulesDuCarre, carreSousPlafond } from '../src/damier-carre.js'

// LE CARRÉ CONTIENT TOUJOURS LE BLOC CENTRAL. C'est le héros : il porte le
// cartouche, la rampe hypso partagée et le zéro vertical de tout le damier.
// Un carré qui l'exclurait laisserait un bloc orphelin hors grille.
test('une entrée vide rend le carré 1x1 centré sur le bloc principal', () => {
  assert.deepEqual(carreCouvrant([]), { i0: 0, j0: 0, cote: 1 })
  assert.deepEqual(carreCouvrant(null), { i0: 0, j0: 0, cote: 1 })
})

test('une seule cellule voisine impose un carré 2x2 contenant le centre', () => {
  const c = carreCouvrant(['1,0'])
  assert.equal(c.cote, 2)
  const cl = cellulesDuCarre(c)
  assert.ok(cl.has('1,0'), 'la cellule demandée est dedans')
  // le centre est dans le carré mais PAS dans la liste des voisines
  assert.ok(!cl.has('0,0'), 'le bloc central ne fait pas partie du damier')
  assert.equal(cl.size, 3, 'un carré 2x2 = 4 cases, moins le centre')
})

test('deux coins opposés donnent le carré 3x3 complet, trous bouchés', () => {
  const c = carreCouvrant(['-1,-1', '1,1'])
  assert.deepEqual(c, { i0: -1, j0: -1, cote: 3 })
  const cl = cellulesDuCarre(c)
  assert.equal(cl.size, 8, '9 cases moins le centre')
  // LE COEUR DE LA DEMANDE : une case que le tracé ne traverse pas est
  // quand même chargée, sinon le damier est troué.
  assert.ok(cl.has('0,1'), 'la case non traversée est bouchée')
  assert.ok(cl.has('-1,0'), 'idem')
})

test('un tracé en L ne reste pas en L : le carré le remplit', () => {
  const cl = cellulesDuCarre(carreCouvrant(['0,1', '1,1']))
  assert.ok(cl.has('1,0'), "le creux du L est bouché")
})

// LE PLAFOND EST UN CÔTÉ, PAS UN COMPTE. Rejeter case par case au-delà de
// GRID_R (le code d'avant) rendait des formes trouées ; plafonner le CÔTÉ
// garde la forme carrée quoi qu'il arrive.
test('un tracé qui déborde est ramené à 3x3 sans trou', () => {
  const c = carreCouvrant(['-2,-2', '2,2'])
  assert.equal(c.cote, 3, 'plafonné à 3')
  const cl = cellulesDuCarre(c)
  assert.equal(cl.size, 8)
  for (const k of cl) {
    const [i, j] = k.split(',').map(Number)
    assert.ok(Math.abs(i) <= 1 && Math.abs(j) <= 1, `${k} hors 3x3`)
  }
})

test('le carré est déterministe : même entrée, même sortie', () => {
  const a = carreCouvrant(['1,0', '0,1'])
  const b = carreCouvrant(['0,1', '1,0'])
  assert.deepEqual(a, b, "l'ordre d'itération ne doit rien changer")
})

// LE PALIER MACHINE DEVIENT EFFECTIF. Avant ce plan, damierMax était calculé
// puis ignoré : une machine de palier 3 pouvait charger 24 voisines.
test('le plafond machine rétrécit le carré au lieu de le trouer', () => {
  const plein = carreCouvrant(['-1,-1', '1,1']) // 8 voisines
  const bride = carreSousPlafond(plein, 4)
  assert.equal(bride.cote, 2, '8 voisines > 4 : on descend à 2x2 (3 voisines)')
  assert.ok(cellulesDuCarre(bride).size <= 4)
})

test('un plafond large laisse le carré intact', () => {
  const plein = carreCouvrant(['-1,-1', '1,1'])
  assert.deepEqual(carreSousPlafond(plein, 24), plein)
})

test('le carré rétréci contient toujours le bloc central', () => {
  const bride = carreSousPlafond(carreCouvrant(['-1,-1', '1,1']), 0)
  assert.equal(bride.cote, 1)
  assert.equal(cellulesDuCarre(bride).size, 0, 'plus aucune voisine')
})
```

Ajouter `test/damier-carre.test.js` à la ligne `"test"` de `package.json`.

- [ ] **Étape 2 : lancer les tests pour vérifier qu'ils échouent**

```bash
node --test test/damier-carre.test.js
```

Attendu : ÉCHEC, `Cannot find module '../src/damier-carre.js'`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Créer `src/damier-carre.js` :

```js
// LE CARRÉ COUVRANT — la clé de voûte du damier multi-blocs.
//
// Un tracé GPX ne traverse qu'un chemin de cases, et charger ce seul chemin
// laisse des trous béants entre les cases. La règle : on prend la boîte
// englobante des cases traversées, on l'étend au CARRÉ, et on charge tout.
//
// ⚠️ POURQUOI UN CARRÉ ET PAS « LES CASES ADJACENTES À AU MOINS DEUX AUTRES ».
// Compter les adjacences ne rend PAS une forme rectangulaire : un tracé en L
// garde son L, avec le creux du L pour trou. C'est le RÉSULTAT qui est voulu
// — pas de trou, forme régulière — donc c'est lui qu'on calcule.
//
// Et ce n'est pas seulement esthétique. Le carré rend EXACTES quatre choses
// qui seraient sinon des heuristiques : quelles arêtes du socle sont
// extérieures (les arrondis), l'emprise de la mer, le tracé de sa jupe, et
// de combien les textes gravés doivent s'écarter du bloc.

const CLE = (i, j) => `${i},${j}`

const entier = (v) => (Number.isFinite(v) ? Math.round(v) : null)

function litCles(cellules) {
  const out = []
  if (!cellules) return out
  for (const k of cellules) {
    if (typeof k !== 'string') continue
    const parts = k.split(',')
    if (parts.length !== 2) continue
    const i = entier(Number(parts[0]))
    const j = entier(Number(parts[1]))
    if (i === null || j === null) continue
    out.push([i, j])
  }
  return out
}

/**
 * Le plus petit carré qui contient les cases données ET le bloc central,
 * plafonné à `cotemax` de côté.
 *
 * ⚠️ LE BLOC CENTRAL EST TOUJOURS DEDANS, et ce n'est pas négociable : il
 * porte le cartouche gravé, la rampe hypsométrique que les voisines
 * empruntent (terrain.js:1521) et le zéro vertical commun (block-grid.js:518).
 * Un carré qui l'excluerait laisserait un bloc hors grille.
 *
 * @param {Iterable<string>} cellules - clés "i,j"
 * @returns {{i0:number, j0:number, cote:number}} coin bas-gauche inclus + côté
 */
export function carreCouvrant(cellules, { cotemax = 3 } = {}) {
  const cles = litCles(cellules)
  // le centre participe toujours à la boîte englobante
  let iMin = 0
  let iMax = 0
  let jMin = 0
  let jMax = 0
  for (const [i, j] of cles) {
    if (i < iMin) iMin = i
    if (i > iMax) iMax = i
    if (j < jMin) jMin = j
    if (j > jMax) jMax = j
  }
  const plafond = Math.max(1, Math.round(cotemax))
  const cote = Math.min(plafond, Math.max(iMax - iMin + 1, jMax - jMin + 1))
  return { i0: ancre(iMin, iMax, cote), j0: ancre(jMin, jMax, cote), cote }
}

// Où poser le carré sur un axe. On veut trois choses, dans cet ordre :
// contenir le zéro (le bloc central), rester au plus près de la boîte
// demandée, et être DÉTERMINISTE — un damier qui change de forme selon
// l'ordre d'itération d'un Set se rebâtirait à chaque synchro.
function ancre(min, max, cote) {
  // centrer sur la boîte, puis arrondir vers le bas (choix arbitraire mais fixe)
  let a = Math.floor((min + max - cote + 1) / 2)
  // ne jamais laisser sortir la boîte demandée quand elle tient dans le côté
  if (a > min) a = min
  if (a + cote - 1 < max) a = max - cote + 1
  // et toujours contenir le zéro
  if (a > 0) a = 0
  if (a + cote - 1 < 0) a = -(cote - 1)
  return a
}

/**
 * Toutes les cases du carré, **centre exclu** — le bloc central n'appartient
 * pas au damier (cf. block-grid.js:178, la boucle saute i===0 && j===0).
 */
export function cellulesDuCarre({ i0, j0, cote } = {}) {
  const out = new Set()
  const c = Math.max(0, Math.round(cote ?? 0))
  for (let dj = 0; dj < c; dj++) {
    for (let di = 0; di < c; di++) {
      const i = i0 + di
      const j = j0 + dj
      if (i === 0 && j === 0) continue
      out.add(CLE(i, j))
    }
  }
  return out
}

/**
 * Rétrécit le carré tant qu'il demande plus de voisines que la machine n'en
 * supporte (`damierMax` de palier-machine.js : 24/12/8/4 selon la puissance).
 *
 * ⚠️ ON RÉTRÉCIT LE CÔTÉ, ON NE RETIRE PAS DES CASES. Retirer des cases
 * rouvrirait exactement le trou que tout ce module existe pour boucher.
 */
export function carreSousPlafond(carre, damierMax) {
  const max = Number.isFinite(damierMax) ? damierMax : Infinity
  let c = { ...carre }
  while (c.cote > 1 && cellulesDuCarre(c).size > max) {
    const cote = c.cote - 1
    c = { i0: ancre(c.i0, c.i0 + c.cote - 1, cote), j0: ancre(c.j0, c.j0 + c.cote - 1, cote), cote }
  }
  return c
}
```

- [ ] **Étape 4 : lancer les tests pour vérifier qu'ils passent**

```bash
node --test test/damier-carre.test.js
```

Attendu : RÉUSSITE, 9 tests.

- [ ] **Étape 5 : vérifier que la ligne "test" est complète**

```bash
node -e "const l=require('./package.json').scripts.test.match(/test\/[\w.-]+\.test\.js/g);const fs=require('fs');const d=fs.readdirSync('test').filter(f=>f.endsWith('.test.js'));console.log('liste',l.length,'disque',d.length);console.log('manquants',d.filter(f=>!l.includes('test/'+f)))"
```

Attendu : `manquants []`.

- [ ] **Étape 6 : commit**

```bash
git add src/damier-carre.js test/damier-carre.test.js package.json
git commit -m "feat: le damier se remplit en carre plein, borne par le palier machine"
```

---

## Tâche 2 : brancher le carré dans le damier

**Fichiers**
- Modifier : `src/block-grid.js` (`cellsForTrack`, ~322-335 ; `cellsNeeded`, ~346)
- Modifier : `test/damier-carre.test.js` (ajouts)

**Interfaces**
- Consomme : `carreCouvrant`, `cellulesDuCarre`, `carreSousPlafond` (Tâche 1).
- Produit : `BlockGrid.carreCourant()` → `{ i0, j0, cote }` — la forme du damier actuel. Les Tâches 3, 5, 6, 9 et 10 la lisent toutes.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter à `test/damier-carre.test.js` :

```js
import { BlockGrid } from '../src/block-grid.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

// un DEM bouchonné dont latLonToWorld rend une grille simple : 1 degré = 1 bloc
function demBouchon() {
  return { size: 768, zoom: 12, tx: 0, ty: 0, extentMeters: 5000, meanM: 0, lat: 0, lon: 0 }
}

test('cellsForTrack rend un carre plein, pas le seul chemin du trace', () => {
  const g = new BlockGrid({ scene: null, params: {}, getMainDem: demBouchon, getMainTerrain: () => null, getPlinth: () => null })
  // un tracé en diagonale ne touche que (0,0), (1,1) : le carré doit remplir
  const points = [{ lat: 0, lon: 0 }, { lat: 0.5, lon: 0.5 }]
  const need = g.cellsForTrack(points)
  const carre = g.carreCourant()
  assert.ok(carre.cote >= 1 && carre.cote <= 3, `cote ${carre.cote} hors bornes`)
  // AUCUN TROU : tout ce que le carré décrit est réclamé
  for (const k of cellulesDuCarre(carre)) {
    assert.ok(need.has(k), `${k} manque : le damier est troue`)
  }
})

test('le damier ne depasse jamais 3 de cote sur le chemin GPX', () => {
  const g = new BlockGrid({ scene: null, params: {}, getMainDem: demBouchon, getMainTerrain: () => null, getPlinth: () => null })
  const points = []
  for (let k = -60; k <= 60; k++) points.push({ lat: k / 10, lon: k / 10 })
  g.cellsForTrack(points)
  assert.ok(g.carreCourant().cote <= 3, 'plafond 3x3 non respecte')
})

// LE GARDE-FOU DE LA FRONTIÈRE (contrainte globale 3). En mode continu le
// damier doit rester vide ; c'était un invariant de fait, jamais testé.
test('en mode fenetre continue le damier reste vide', () => {
  const dem = { ...demBouchon(), empriseCote: 3 }
  const g = new BlockGrid({ scene: null, params: {}, getMainDem: () => dem, getMainTerrain: () => null, getPlinth: () => null })
  const need = g.cellsForTrack([{ lat: 0, lon: 0 }, { lat: 0.5, lon: 0.5 }])
  assert.equal(need.size, 0, 'le damier n\'existe pas quand l\'emprise est precuite')
  assert.equal(g.carreCourant().cote, 1)
})
```

- [ ] **Étape 2 : lancer pour vérifier l'échec**

```bash
node --test test/damier-carre.test.js
```

Attendu : ÉCHEC — `g.carreCourant is not a function`, et le premier test signale des cases manquantes.

- [ ] **Étape 3 : implémenter**

Dans `src/block-grid.js`, ajouter l'import en tête (après la ligne 23) :

```js
import { carreCouvrant, cellulesDuCarre, carreSousPlafond } from './damier-carre.js'

// Le côté maximal du damier sur le chemin GPX. DISTINCT de GRID_R (qui reste
// à 2 pour le cadrage du mode zone isolée, cf. region-mask.js:523 et
// test/region-grid.test.js) : ici on borne une FORME carrée, là-bas un rayon.
export const CARRE_COTE_MAX = 3
```

Dans le constructeur (après `this._need = new Set()`, ~ligne 299) :

```js
    // La forme carrée du damier, relue par le socle (bords), la mer (emprise),
    // les textes (écart) et la caméra (cadrage). Toujours définie.
    this._carre = { i0: 0, j0: 0, cote: 1 }
```

Remplacer `cellsForTrack` (lignes 322-335) par :

```js
  // Quelles cellules le tracé réclame-t-il ? (coordonnées monde CONTINUES du
  // DEM central — latLonToWorld extrapole linéairement au-delà de ±28.)
  //
  // ⚠️ CE N'EST PLUS LE CHEMIN DU TRACÉ, C'EST SON CARRÉ. Ne charger que les
  // cases traversées laissait des trous béants entre elles. Voir damier-carre.js.
  cellsForTrack(points) {
    const dem = this.getMainDem()
    if (!dem || !points?.length) return this._poseCarre({ i0: 0, j0: 0, cote: 1 })
    // frontière avec la fenêtre continue : quand l'emprise est précuite, le
    // damier n'existe pas (cf. main.js:4404) — et son géoréférencement ne
    // serait de toute façon pas celui qu'attend latLonToWorld ici.
    if (dem.empriseCote > 1) return this._poseCarre({ i0: 0, j0: 0, cote: 1 })
    const touchees = new Set()
    for (const p of points) {
      const w = latLonToWorld(dem, p.lat, p.lon)
      const i = Math.round(w.x / TERRAIN_SIZE)
      const j = Math.round(w.z / TERRAIN_SIZE)
      if (Math.abs(i) > GRID_R || Math.abs(j) > GRID_R) continue
      touchees.add(`${i},${j}`)
    }
    const plafond = this.params?.damierMax
    return this._poseCarre(carreSousPlafond(carreCouvrant(touchees, { cotemax: CARRE_COTE_MAX }), plafond))
  }

  _poseCarre(carre) {
    this._carre = carre
    return cellulesDuCarre(carre)
  }

  /** La forme carrée courante du damier : { i0, j0, cote }. Jamais null. */
  carreCourant() {
    return this._carre
  }
```

- [ ] **Étape 4 : lancer les tests**

```bash
node --test test/damier-carre.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/region-grid.test.js
```

Attendu : RÉUSSITE partout. Si `region-grid` échoue, c'est que `GRID_R` a été touché — contrainte globale 1 violée, corriger.

- [ ] **Étape 5 : lancer toute la suite**

```bash
npm test
```

Attendu : RÉUSSITE. Noter le nombre de tests pour la tâche suivante.

- [ ] **Étape 6 : commit**

```bash
git add src/block-grid.js test/damier-carre.test.js
git commit -m "feat: cellsForTrack charge un carre plein et respecte le palier machine"
```

---

## Tâche 3 : une hauteur de socle commune à toutes les cases

**Fichiers**
- Modifier : `src/block-grid.js` (`_buildCell`, ~510-600)
- Créer : `test/damier-hauteur.test.js`
- Modifier : `package.json`

**Interfaces**
- Consomme : `BlockGrid.carreCourant()` (Tâche 2).
- Produit : `BlockGrid.planchierCommun()` → `number|null` — le `baseY` le plus bas de toutes les cellules **et** du bloc central. Consommé par la Tâche 5 (socle) et la Tâche 6 (jupe de mer).

**Contexte** : `buildSlabWalls` accepte déjà `baseYFloor` (`src/plinth.js:212`, documenté lignes 203-205) et le damier lui passe aujourd'hui le `baseY` du **bloc central**. Résultat : une voisine dont le relief descend plus bas que le centre reçoit `Math.min(baseYFloor, slab.baseY)` (ligne 215) et sort donc plus bas que les autres — les hauteurs diffèrent. La demande est l'inverse : **tout le monde à la profondeur de la plus profonde**.

Le problème est asynchrone : les cellules arrivent une à une. Quand une nouvelle descend plus bas que le plancher courant, il faut **rebâtir les murs** des cellules déjà posées. Seuls les murs, pas le terrain.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `test/damier-hauteur.test.js` :

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSlabWalls, computeSlab } from '../src/plinth.js'

// relief plat à l'altitude `y`
const plat = (y) => () => y

// LA DEMANDE : « la hauteur des blocs sera toujours égale à la hauteur du bloc
// dont la base va le plus bas ». Donc un plancher COMMUN, et le plus bas.
test('deux socles de reliefs differents partagent le meme fond', () => {
  const profond = computeSlab(plat(-40), 7, 32)
  const hautPerche = computeSlab(plat(120), 7, 32)
  assert.ok(profond.baseY < hautPerche.baseY, 'preambule : les fonds different')

  const plancher = Math.min(profond.baseY, hautPerche.baseY)
  const a = buildSlabWalls(plat(-40), { resolution: 32, baseYFloor: plancher })
  const b = buildSlabWalls(plat(120), { resolution: 32, baseYFloor: plancher })
  assert.equal(fondDe(a), fondDe(b), 'les deux socles doivent finir a la meme altitude')
  assert.equal(fondDe(a), plancher)
})

// le point le plus bas de la géométrie rendue
function fondDe(res) {
  const pos = res.geometry.getAttribute('position')
  let min = Infinity
  for (let i = 0; i < pos.count; i++) min = Math.min(min, pos.getY(i))
  return Math.round(min * 1e6) / 1e6
}

// ⚠️ LE PIÈGE : baseYFloor prend un MINIMUM (plinth.js:215), il ne peut donc
// que faire DESCENDRE un socle, jamais remonter. Passer le baseY du bloc
// CENTRAL (le code d'avant) ne suffit pas : une voisine plus profonde le
// dépasse et sort plus bas que tout le monde.
test('le plancher du bloc central ne suffit pas a egaliser', () => {
  const centre = computeSlab(plat(0), 7, 32).baseY
  const a = buildSlabWalls(plat(0), { resolution: 32, baseYFloor: centre })
  const b = buildSlabWalls(plat(-40), { resolution: 32, baseYFloor: centre })
  assert.notEqual(fondDe(a), fondDe(b), 'c\'est bien le defaut qu\'on corrige')
})
```

Ajouter le fichier à la ligne `"test"` de `package.json`.

- [ ] **Étape 2 : lancer pour voir l'état de départ**

```bash
node --test test/damier-hauteur.test.js
```

Attendu : le premier test RÉUSSIT (le mécanisme `baseYFloor` fonctionne déjà), le second RÉUSSIT aussi (il documente le défaut). Ces tests verrouillent le contrat ; le travail de cette tâche est de faire **calculer** le bon plancher par `BlockGrid`.

- [ ] **Étape 3 : implémenter le plancher commun**

Dans `src/block-grid.js`, ajouter à la classe :

```js
  // LE PLANCHER COMMUN — « la hauteur des blocs sera toujours égale à celle du
  // bloc dont la base va le plus bas » (Adrien).
  //
  // ⚠️ IL SE RECALCULE À CHAQUE ARRIVÉE, et c'est la difficulté : les cellules
  // atterrissent une à une, sur plusieurs secondes. Une voisine plus profonde
  // que toutes les précédentes oblige à RE-COULER les murs déjà posés — sinon
  // le damier montre une marche à la jointure, exactement le défaut d'origine.
  // Seuls les MURS sont refaits : le terrain, son MNT et ses textures ne
  // bougent pas (c'est ce qui rend l'opération tenable).
  planchierCommun() {
    const socle = this.getPlinth?.()
    let bas = Number.isFinite(socle?.baseY) ? socle.baseY : null
    for (const cell of this.cells.values()) {
      const b = cell.baseYPropre
      if (!Number.isFinite(b)) continue
      bas = bas === null ? b : Math.min(bas, b)
    }
    return bas
  }

  // Re-coule les murs de toutes les cellules dont le fond n'est pas au
  // plancher commun. Rendu : le nombre de cellules refaites (0 = rien à faire),
  // pour que l'appelant puisse mesurer le coût réel de cette égalisation.
  egaliseHauteurs() {
    const plancher = this.planchierCommun()
    if (!Number.isFinite(plancher)) return 0
    let refaites = 0
    for (const cell of this.cells.values()) {
      if (cell.planchierPose === plancher) continue
      this._rebuildCellWalls(cell, plancher)
      cell.planchierPose = plancher
      refaites++
    }
    return refaites
  }
```

Dans `_buildCell`, après le calcul du socle de la cellule, mémoriser `cell.baseYPropre` (le `baseY` que `computeSlab` rend **sans** plancher imposé) et appeler `this.egaliseHauteurs()` à la fin. Extraire la construction des murs existante (`src/block-grid.js:573-600`) dans une méthode `_rebuildCellWalls(cell, plancher)` qui dispose l'ancienne géométrie avant d'en poser une neuve — **le matériau `wallMat` est partagé et ne doit jamais être disposé** (`src/plinth.js:423-438`).

- [ ] **Étape 4 : lancer les tests**

```bash
node --test test/damier-hauteur.test.js test/damier-memoire.test.js
npm test
```

Attendu : RÉUSSITE. `damier-memoire` doit rester vert : si le nombre de géométries grimpe, c'est que `_rebuildCellWalls` fuit — disposer l'ancienne.

- [ ] **Étape 5 : mesurer le coût de l'égalisation**

Ajouter un compteur temporaire et relever, sur un damier 3×3 complet, combien de fois `egaliseHauteurs` refait des murs. Consigner le chiffre dans le commentaire du fichier. Si le total dépasse 24 reconstructions pour 8 cellules, revoir : trier les arrivées ou différer l'égalisation d'une image.

- [ ] **Étape 6 : commit**

```bash
git add src/block-grid.js test/damier-hauteur.test.js package.json
git commit -m "feat: toutes les cases du damier descendent au meme fond"
```

---

## Tâche 4 : étiqueter les côtés du contour du socle (module pur)

**Fichiers**
- Créer : `src/damier-bords.js`
- Créer : `test/damier-bords.test.js`
- Modifier : `package.json`

**Interfaces**
- Consomme : rien.
- Produit :
  - `bordsExterieurs(i, j, { i0, j0, cote })` → `{ nord, est, sud, ouest }` de booléens. Une arête est extérieure quand aucune case du carré ne la jouxte.
  - `masqueArrondi(cote, resolution, cornerR, bords)` → `Float32Array` de longueur = celle du contour, valeur 1 sur les portions extérieures et 0 sur les intérieures. Sert à moduler `arrondi` **et** `chanfrein` par sommet.

**Contexte géométrique** — `computeSlab` (`src/plinth.js:137-199`) construit son contour dans un ordre fixe et documenté :
- cas carré (`cornerR === 0`, lignes 150-155) : 4 côtés de `n` échantillons chacun, dans l'ordre **z=−HALF (nord), x=+HALF (est), z=+HALF (sud), x=−HALF (ouest)** ;
- cas arrondi (lignes 156-190) : `line` nord, `arc`, `line` est, `arc`, `line` sud, `arc`, `line` ouest, `arc`. Chaque `line` pousse `straightN` points, chaque `arc` en pousse un nombre variable rendu par `arcCoin`.

C'est cette structure que le module doit reproduire pour savoir à quel côté appartient chaque index.

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `test/damier-bords.test.js` :

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { bordsExterieurs, masqueArrondi } from '../src/damier-bords.js'

// convention d'axes de computeSlab : z=-HALF est le NORD, z=+HALF le SUD,
// x=+HALF l'EST, x=-HALF l'OUEST. j croît vers le sud (z croissant).
const carre3 = { i0: -1, j0: -1, cote: 3 }

test('une case isolee a ses quatre bords exterieurs', () => {
  assert.deepEqual(bordsExterieurs(0, 0, { i0: 0, j0: 0, cote: 1 }),
    { nord: true, est: true, sud: true, ouest: true })
})

test('la case du milieu d\'un 3x3 n\'a AUCUN bord exterieur', () => {
  assert.deepEqual(bordsExterieurs(0, 0, carre3),
    { nord: false, est: false, sud: false, ouest: false })
})

test('le coin nord-ouest d\'un 3x3 garde ses deux bords exposes', () => {
  assert.deepEqual(bordsExterieurs(-1, -1, carre3),
    { nord: true, est: false, sud: false, ouest: true })
})

test('le bord nord milieu n\'expose que le nord', () => {
  assert.deepEqual(bordsExterieurs(0, -1, carre3),
    { nord: true, est: false, sud: false, ouest: false })
})

test('le coin sud-est expose sud et est', () => {
  assert.deepEqual(bordsExterieurs(1, 1, carre3),
    { nord: false, est: true, sud: true, ouest: false })
})

// LE MASQUE — c'est lui que le socle consomme, sommet par sommet.
test('le masque d\'une case isolee vaut 1 partout', () => {
  const m = masqueArrondi(1, 32, 0, { nord: true, est: true, sud: true, ouest: true })
  assert.equal(m.length, 4 * 32, 'contour carre : 4 cotes de n')
  for (const v of m) assert.equal(v, 1)
})

test('le masque de la case centrale vaut 0 partout', () => {
  const m = masqueArrondi(1, 32, 0, { nord: false, est: false, sud: false, ouest: false })
  for (const v of m) assert.equal(v, 0)
})

// L'ORDRE DES CÔTÉS EST CELUI DE computeSlab, pas un ordre choisi ici. Se
// tromper d'ordre arrondit le mauvais côté, et ça ne se voit qu'à l'écran.
test('le masque suit l\'ordre nord, est, sud, ouest de computeSlab', () => {
  const n = 8
  const m = masqueArrondi(1, n, 0, { nord: true, est: false, sud: false, ouest: false })
  for (let k = 0; k < n; k++) assert.equal(m[k], 1, `sommet ${k} : le nord doit etre arrondi`)
  for (let k = n; k < 4 * n; k++) assert.equal(m[k], 0, `sommet ${k} : les autres cotes non`)
})

test('un coin entre deux bords exterieurs reste arrondi', () => {
  const n = 8
  const m = masqueArrondi(1, n, 0, { nord: true, est: true, sud: false, ouest: false })
  assert.equal(m[n - 1], 1, 'fin du nord')
  assert.equal(m[n], 1, 'debut de l\'est')
})

test('un coin entre un bord exterieur et un interieur ne l\'est pas', () => {
  const n = 8
  const m = masqueArrondi(1, n, 0, { nord: true, est: false, sud: false, ouest: false })
  assert.equal(m[n - 1], 1, 'le nord garde son arrondi jusqu\'au bout')
  assert.equal(m[n], 0, 'l\'est, interieur, demarre a plat')
})
```

Ajouter le fichier à `package.json`.

- [ ] **Étape 2 : lancer pour vérifier l'échec**

```bash
node --test test/damier-bords.test.js
```

Attendu : ÉCHEC, module introuvable.

- [ ] **Étape 3 : implémenter**

Créer `src/damier-bords.js` :

```js
// QUELLES ARÊTES DU SOCLE SONT ENCORE EXPOSÉES — et lesquelles doivent perdre
// leur arrondi.
//
// Le congé bas (SOCLE_ARRONDI = 0,9) et le chanfrein haut (SOCLE_CHANFREIN =
// 0,16) sont appliqués aux QUATRE côtés de chaque cellule. Sur une jointure
// entre deux cases, les deux congés se font face et creusent une rainure — le
// « les arrondis posent problème et sont vilains » des captures d'Adrien.
//
// ⚠️ CE MODULE NE MARCHE QUE PARCE QUE LE DAMIER EST UN CARRÉ PLEIN. Sur une
// forme trouée, « la case d'à côté existe-t-elle » demanderait de connaître
// l'ensemble des cases ; ici il suffit de regarder si l'on est au bord du
// carré. Voir damier-carre.js.

/**
 * Les quatre arêtes de la case (i,j) sont-elles au bord du carré ?
 *
 * Convention d'axes de computeSlab (plinth.js:152-155) : z = −HALF est le
 * NORD, z = +HALF le SUD, x = +HALF l'EST, x = −HALF l'OUEST. `j` croît vers
 * le sud, `i` vers l'est.
 */
export function bordsExterieurs(i, j, { i0, j0, cote } = {}) {
  const c = Math.max(1, Math.round(cote ?? 1))
  return {
    nord: j <= j0,
    est: i >= i0 + c - 1,
    sud: j >= j0 + c - 1,
    ouest: i <= i0,
  }
}

/**
 * Le masque d'arrondi, un réel par sommet du contour rendu par computeSlab :
 * 1 = arrondi de plein droit, 0 = arête vive.
 *
 * ⚠️ L'ORDRE EST CELUI DE computeSlab ET DE NUL AUTRE (plinth.js:152-155 pour
 * le contour carré, 182-189 pour le contour arrondi) : nord, est, sud, ouest,
 * dans le sens horaire depuis le coin −x/−z. Se tromper d'ordre arrondit le
 * mauvais côté, et rien ne le signale à part l'écran.
 *
 * ⚠️ LES COINS. Un coin n'est arrondi que si SES DEUX côtés le sont — un
 * quart de rond qui se termine à plat contre une jointure est pire que pas
 * d'arrondi du tout. Dans le contour arrondi, les arcs sont insérés APRÈS
 * chaque côté : nord, arc(nord-est), est, arc(est-sud), sud, arc(sud-ouest),
 * ouest, arc(ouest-nord).
 *
 * @param {number} cote - côté du carré (sert de garde : à 1, tout est exposé)
 * @param {number} resolution - `n` de computeSlab (échantillons par côté)
 * @param {number} cornerR - rayon de coin ; 0 = contour carré simple
 * @param {{nord:boolean,est:boolean,sud:boolean,ouest:boolean}} bords
 * @returns {Float32Array}
 */
export function masqueArrondi(cote, resolution, cornerR, bords) {
  const n = Math.max(8, Math.round(resolution))
  const b = bords || { nord: true, est: true, sud: true, ouest: true }
  if (!(cornerR > 0)) {
    // contour carré : 4 blocs de n sommets, dans l'ordre nord, est, sud, ouest
    const m = new Float32Array(4 * n)
    const v = [b.nord, b.est, b.sud, b.ouest]
    for (let c = 0; c < 4; c++) {
      const val = v[c] ? 1 : 0
      m.fill(val, c * n, (c + 1) * n)
    }
    return m
  }
  // contour arrondi : les longueurs de côté et d'arc doivent être fournies par
  // l'appelant, qui seul connaît le découpage retenu par computeSlab.
  throw new Error('masqueArrondi : contour arrondi non couvert, passer par masqueDepuisContour')
}

/**
 * Variante robuste : au lieu de reproduire le découpage de computeSlab, on
 * étiquette chaque sommet par sa POSITION. Un sommet appartient au côté dont
 * il est le plus proche, et un sommet de coin appartient aux deux.
 *
 * ⚠️ C'EST CETTE VARIANTE QUE LE SOCLE UTILISE. Reproduire le découpage
 * (straightN, longueurs d'arc rendues par arcCoin) marcherait aujourd'hui et
 * casserait au prochain réglage de densité d'arc — un couplage muet entre
 * deux fichiers, exactement ce qui a déjà coûté un chantier ici (cf. le
 * commentaire « LA DENSITÉ DE L'ARC SE MESURE EN LONGUEUR », plinth.js:163).
 * La position, elle, ne ment pas.
 *
 * @param {Array<{x:number,z:number}>} contour - le `ring` de computeSlab
 * @param {number} demi - HALF, le demi-côté du bloc
 * @param {{nord:boolean,est:boolean,sud:boolean,ouest:boolean}} bords
 * @param {number} marge - tolérance monde pour « ce sommet est sur ce côté »
 */
export function masqueDepuisContour(contour, demi, bords, marge = 1e-3) {
  const b = bords || { nord: true, est: true, sud: true, ouest: true }
  const m = new Float32Array(contour.length)
  for (let k = 0; k < contour.length; k++) {
    const { x, z } = contour[k]
    // de quel(s) côté(s) ce sommet est-il ? un sommet d'arc en touche deux
    const auNord = z <= -demi + marge
    const auSud = z >= demi - marge
    const aLEst = x >= demi - marge
    const aLOuest = x <= -demi + marge
    // sur un arc, aucun des quatre n'est vrai : on prend le côté le plus proche
    let exposes = []
    if (auNord) exposes.push(b.nord)
    if (auSud) exposes.push(b.sud)
    if (aLEst) exposes.push(b.est)
    if (aLOuest) exposes.push(b.ouest)
    if (!exposes.length) {
      // sommet d'arc : il appartient au coin entre les deux côtés qu'il relie
      exposes = [z < 0 ? b.nord : b.sud, x > 0 ? b.est : b.ouest]
    }
    // UN COIN N'EST ARRONDI QUE SI SES DEUX CÔTÉS LE SONT
    m[k] = exposes.every(Boolean) ? 1 : 0
  }
  return m
}
```

Note : le test « le masque suit l'ordre nord, est, sud, ouest » vise `masqueArrondi` (cas carré). Les tests de coin visent `masqueDepuisContour` — les adapter à l'étape 1 si l'implémenteur préfère n'exposer que la seconde. **Une seule des deux doit survivre à la Tâche 5** ; garder les deux serait deux vérités pour une question.

- [ ] **Étape 4 : lancer les tests**

```bash
node --test test/damier-bords.test.js
```

Attendu : RÉUSSITE.

- [ ] **Étape 5 : commit**

```bash
git add src/damier-bords.js test/damier-bords.test.js package.json
git commit -m "feat: etiquetage des aretes exterieures du socle dans le damier"
```

---

## Tâche 5 : arrondis par arête dans le socle

**Fichiers**
- Modifier : `src/plinth.js` (`buildSlabWalls`, ~212-399)
- Modifier : `src/block-grid.js` (l'appel de ~579)
- Modifier : `test/damier-bords.test.js`

**Interfaces**
- Consomme : `masqueDepuisContour` (Tâche 4), `BlockGrid.carreCourant()` (Tâche 2).
- Produit : `buildSlabWalls(sample, { ..., masqueArrondi })` — nouveau paramètre facultatif, `Float32Array` parallèle au contour, ou `null` (comportement d'avant, arrondi uniforme).

**Ce qu'il faut modifier dans `buildSlabWalls`** — aujourd'hui `ch` (chanfrein) et `rd` (congé) sont des **scalaires** calculés une fois, lus par `niveaux(k)` (ligne 344-349), par le profil (lignes 362-388) et par le fond (ligne 393). Il faut qu'ils deviennent fonction de l'index de sommet.

⚠️ **Le fond est un piège.** Ligne 393, `const dFond = ch + rd` rentre le fond du chanfrein et du congé. Avec des valeurs par sommet, le fond n'est plus un carré régulier : il faut le rentrer **par sommet** (`dFond(i)`), sinon le fond et le bas des murs ne se rejoignent plus et on voit sous le socle.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter à `test/damier-bords.test.js` :

```js
import { buildSlabWalls } from '../src/plinth.js'
import { masqueDepuisContour } from '../src/damier-bords.js'
import { computeSlab } from '../src/plinth.js'

const plat = (y) => () => y

// mesure : jusqu'où la géométrie rentre vers l'intérieur, sur un côté donné
function rentreeSur(res, axe, signe) {
  const pos = res.geometry.getAttribute('position')
  let extreme = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const v = axe === 'x' ? pos.getX(i) : pos.getZ(i)
    extreme = Math.max(extreme, signe * v)
  }
  return extreme
}

test('sans masque, le socle garde ses arrondis sur les quatre cotes', () => {
  const r = buildSlabWalls(plat(10), { resolution: 32 })
  const nord = rentreeSur(r, 'z', -1)
  const sud = rentreeSur(r, 'z', 1)
  assert.ok(Math.abs(nord - sud) < 1e-6, 'symetrie preservee')
})

// LE COEUR DE LA DEMANDE : « tous les arrondis directement adjacents d'une
// autre case sont retires pour avoir des jointures parfaites ».
test('un bord interieur perd son conge : le socle va jusqu\'au bord', () => {
  const slab = computeSlab(plat(10), 7, 32)
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  // nord exterieur, sud interieur (une case au sud)
  const masque = masqueDepuisContour(slab.ring, demi, { nord: true, est: true, sud: false, ouest: true })
  const r = buildSlabWalls(plat(10), { resolution: 32, masqueArrondi: masque })
  const pos = r.geometry.getAttribute('position')
  // sur le cote SUD, la geometrie doit atteindre +demi PARTOUT en profondeur
  let sudLePlusLoin = -Infinity
  let sudAuFond = -Infinity
  let fond = Infinity
  for (let i = 0; i < pos.count; i++) fond = Math.min(fond, pos.getY(i))
  for (let i = 0; i < pos.count; i++) {
    sudLePlusLoin = Math.max(sudLePlusLoin, pos.getZ(i))
    if (Math.abs(pos.getY(i) - fond) < 1e-6) sudAuFond = Math.max(sudAuFond, pos.getZ(i))
  }
  assert.ok(Math.abs(sudLePlusLoin - sudAuFond) < 1e-3,
    `le fond rentre de ${sudLePlusLoin - sudAuFond} au sud : le conge n'a pas ete supprime`)
})

test('un bord exterieur garde son conge quand son voisin l\'a perdu', () => {
  const slab = computeSlab(plat(10), 7, 32)
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  const masque = masqueDepuisContour(slab.ring, demi, { nord: true, est: true, sud: false, ouest: true })
  const r = buildSlabWalls(plat(10), { resolution: 32, masqueArrondi: masque })
  const pos = r.geometry.getAttribute('position')
  let fond = Infinity
  for (let i = 0; i < pos.count; i++) fond = Math.min(fond, pos.getY(i))
  let nordLePlusLoin = Infinity
  let nordAuFond = Infinity
  for (let i = 0; i < pos.count; i++) {
    nordLePlusLoin = Math.min(nordLePlusLoin, pos.getZ(i))
    if (Math.abs(pos.getY(i) - fond) < 1e-6) nordAuFond = Math.min(nordAuFond, pos.getZ(i))
  }
  assert.ok(nordAuFond - nordLePlusLoin > 0.5,
    'le nord, exterieur, doit garder son conge rentrant')
})

// LE PIÈGE DU FOND (plinth.js:393). Avec des arrondis par sommet, un fond
// rentré d'une valeur unique ne rejoint plus le bas des murs.
test('le fond reste soude au bas des murs, arrondi ou pas', () => {
  const slab = computeSlab(plat(10), 7, 32)
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  const masque = masqueDepuisContour(slab.ring, demi, { nord: true, est: false, sud: false, ouest: false })
  const r = buildSlabWalls(plat(10), { resolution: 32, masqueArrondi: masque })
  const geo = r.geometry
  geo.computeBoundingBox()
  assert.ok(geo.getAttribute('position').count > 0)
  // aucun sommet ne doit etre isole : un trou se voit comme un ecart d'index
  assert.equal(geo.getIndex(), null, 'geometrie non indexee, comme avant')
})
```

- [ ] **Étape 2 : lancer pour vérifier l'échec**

```bash
node --test test/damier-bords.test.js
```

Attendu : ÉCHEC sur « un bord interieur perd son conge » — le paramètre `masqueArrondi` est ignoré.

- [ ] **Étape 3 : implémenter dans `src/plinth.js`**

Ajouter le paramètre à la signature (ligne 212) : `masqueArrondi = null`.

Documenter juste au-dessus (après la ligne 211) :

```js
// `masqueArrondi` : un réel par sommet du contour (1 = arrondi, 0 = arête vive),
// pour que les jointures du damier soient PLATES. Deux congés qui se font face
// à une jointure creusent une rainure — c'est le défaut que ce paramètre
// supprime. null = arrondi uniforme, la géométrie d'avant, exacte.
```

Dans le corps, remplacer les scalaires `ch` et `rd` par des accesseurs :

```js
  // ⚠️ LE CHANFREIN ET LE CONGÉ SONT DÉSORMAIS PAR SOMMET. Ils étaient deux
  // scalaires ; sur un damier, les côtés qui touchent une autre case doivent
  // rester vifs. Les fonctions ci-dessous rendent la valeur d'AVANT quand
  // aucun masque n'est fourni — le bloc isolé est bit à bit inchangé.
  const kMasque = (k) => (masqueArrondi ? (masqueArrondi[k] ?? 1) : 1)
  const chDe = (k) => ch * kMasque(k)
  const rdDe = (k) => rd * kMasque(k)
```

Puis :
- `niveaux(k)` (ligne 344) utilise `chDe(k)` au lieu de `ch`, et `yFil` devient `yFilDe(k) = baseY + rdDe(k)` ;
- les appels `bande2` (lignes 364-368) passent `chDe(i)` et `chDe(j)` aux deux extrémités de chaque bande, et `yFilDe(i)` / `yFilDe(j)` ;
- la boucle du congé (lignes 371-388) calcule `d0`/`d1`/`y0`/`y1` **séparément pour `i` et pour `j`** — quand un sommet a un congé et pas l'autre, la bande est un triangle dégénéré d'un côté, ce qui est exactement le raccord voulu ;
- **le fond** (lignes 393-398) : remplacer `const dFond = ch + rd` par `const dFond = (k) => chDe(k) + rdDe(k)` et l'appliquer par sommet à la ligne 396-397.

⚠️ `normaleArc(i, th)` (ligne 316) reste valable : à congé nul la bande est dégénérée et sa normale n'est jamais échantillonnée.

- [ ] **Étape 4 : lancer les tests de non-régression du socle**

```bash
node --test test/damier-bords.test.js
npm test
```

Attendu : RÉUSSITE. **Tout test existant du socle doit rester vert au bit près** — sans masque, la géométrie doit être identique à celle d'avant. Si un test de socle bouge, l'accesseur ne rend pas la valeur d'avant à masque nul.

- [ ] **Étape 5 : brancher dans `src/block-grid.js`**

À l'appel de `buildSlabWalls` (~ligne 579), calculer le masque depuis le carré courant :

```js
    const bords = bordsExterieurs(cell.i, cell.j, this.carreCourant())
    // le contour est celui que computeSlab vient de tracer pour cette cellule
    const masque = masqueDepuisContour(slab.ring, TERRAIN_SIZE / 2, bords)
```

et le passer en option. **Le bloc central aussi** : `Plinth.rebuild` (`src/plinth.js:784`) doit recevoir le masque de la case `(0,0)`, sinon le héros garde ses quatre arrondis au milieu du damier — le défaut le plus visible des captures.

- [ ] **Étape 6 : vérifier à l'écran**

Charger un tracé qui déclenche un damier 2×2 puis 3×3, et regarder les jointures : aucune rainure, aucun jour. Prendre une capture avant/après.

- [ ] **Étape 7 : commit**

```bash
git add src/plinth.js src/block-grid.js test/damier-bords.test.js
git commit -m "fix: les aretes interieures du damier perdent leur conge et leur chanfrein"
```

---

## Tâche 6 : une seule mer, une seule jupe, pour tout le carré

**Fichiers**
- Modifier : `src/ocean.js` (`rebuild`, ~1012-1099 ; `buildRimGeometry` en amont)
- Modifier : `src/main.js` (l'appel de `rebuild`)
- Créer : `test/damier-mer.test.js`
- Modifier : `package.json`

**Interfaces**
- Consomme : `resChamp`, `spanChamp` (`src/mer-emprise.js`), `BlockGrid.carreCourant()` (Tâche 2), `BlockGrid.planchierCommun()` (Tâche 3).
- Produit : `Ocean.rebuild({ terrain, params, carre })` — `carre` = `{ i0, j0, cote }` ou `null` (comportement d'avant, un bloc).

**C'est la tâche la plus lourde du plan.** Trois choses changent ensemble : l'emprise du plan d'eau, la résolution de son champ, et le centre — car un carré 2×2 n'est **pas** centré sur l'origine.

**Centre du carré**, en unités monde : `cx = (i0 + (cote - 1) / 2) * TERRAIN_SIZE`, `cz = (j0 + (cote - 1) / 2) * TERRAIN_SIZE`. Pour un 3×3 avec `i0 = j0 = -1`, cela donne bien `(0, 0)` ; pour un 2×2 avec `i0 = j0 = -1`, cela donne `(-28, -28)`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `test/damier-mer.test.js` :

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { resChamp, spanChamp, CHAMP_RES } from '../src/mer-emprise.js'
import { centreDuCarre, empriseDeMer } from '../src/damier-carre.js'

const TAILLE = 56

test('un carre 3x3 centre sur l\'origine reste centre', () => {
  assert.deepEqual(centreDuCarre({ i0: -1, j0: -1, cote: 3 }, TAILLE), { x: 0, z: 0 })
})

// ⚠️ LE PIÈGE DU CARRÉ PAIR. Un 2x2 n'est PAS centré sur le bloc principal :
// son centre tombe sur la jointure. Une mer posée en (0,0) déborderait d'un
// demi-bloc d'un côté et manquerait de l'autre.
test('un carre 2x2 a son centre sur la jointure, pas sur le bloc principal', () => {
  assert.deepEqual(centreDuCarre({ i0: -1, j0: -1, cote: 2 }, TAILLE), { x: -28, z: -28 })
  assert.deepEqual(centreDuCarre({ i0: 0, j0: 0, cote: 2 }, TAILLE), { x: 28, z: 28 })
})

test('un carre 1x1 est centre sur le bloc principal', () => {
  assert.deepEqual(centreDuCarre({ i0: 0, j0: 0, cote: 1 }, TAILLE), { x: 0, z: 0 })
})

// L'EMPRISE — on réutilise la machinerie éprouvée de la fenêtre continue
// (mer-emprise.js) plutôt que d'en inventer une seconde.
test('l\'emprise de mer suit le cote du carre', () => {
  const e = empriseDeMer({ i0: -1, j0: -1, cote: 3 }, TAILLE)
  assert.equal(e.span, spanChamp(TAILLE, 3), '168 unites de large')
  assert.equal(e.res, resChamp(3), 'champ multiplie, pas etire')
  assert.equal(e.res, CHAMP_RES * 3)
})

test('un damier 1x1 rend exactement l\'emprise d\'avant', () => {
  const e = empriseDeMer({ i0: 0, j0: 0, cote: 1 }, TAILLE)
  assert.equal(e.span, TAILLE)
  assert.equal(e.res, CHAMP_RES, 'aucune regression sur le bloc seul')
  assert.deepEqual(e.centre, { x: 0, z: 0 })
})

test('un carre null rend l\'emprise d\'un bloc', () => {
  const e = empriseDeMer(null, TAILLE)
  assert.equal(e.span, TAILLE)
  assert.equal(e.res, CHAMP_RES)
})

// LE COÛT, ET SA BORNE. Le champ est multiplicatif (resChamp), donc un 3x3
// coûte NEUF fois un bloc. C'est le chiffre déjà payé par la fenêtre continue
// (1152², 5,3 Mo) — mais il doit rester dit, pas découvert en production.
test('le champ d\'un 3x3 reste sous 6 Mo en demi-flottants', () => {
  const res = resChamp(3)
  const octets = res * res * 2 * 2 // deux canaux, demi-flottants
  assert.ok(octets < 6 * 1024 * 1024, `${(octets / 1048576).toFixed(1)} Mo, trop`)
})
```

Ajouter le fichier à `package.json`.

- [ ] **Étape 2 : lancer pour vérifier l'échec**

```bash
node --test test/damier-mer.test.js
```

Attendu : ÉCHEC — `centreDuCarre` et `empriseDeMer` n'existent pas.

- [ ] **Étape 3 : ajouter les deux fonctions à `src/damier-carre.js`**

```js
/**
 * Le centre du carré, en unités monde.
 *
 * ⚠️ UN CARRÉ DE CÔTÉ PAIR N'EST PAS CENTRÉ SUR LE BLOC PRINCIPAL : son
 * centre tombe sur une jointure. Poser la mer en (0,0) la ferait déborder
 * d'un demi-bloc d'un côté et manquer de l'autre — un défaut qui ne se voit
 * qu'en 2×2, donc rarement, donc tard.
 */
export function centreDuCarre({ i0, j0, cote } = {}, taille) {
  const c = Math.max(1, Math.round(cote ?? 1))
  return {
    x: ((i0 ?? 0) + (c - 1) / 2) * taille,
    z: ((j0 ?? 0) + (c - 1) / 2) * taille,
  }
}

/**
 * L'emprise que la mer doit couvrir pour porter tout le damier d'un seul
 * tenant : largeur au sol, résolution de champ, et centre.
 *
 * On réutilise `spanChamp`/`resChamp` de mer-emprise.js — la machinerie de la
 * fenêtre continue, mesurée et éprouvée (3×3 → 1152², 5,3 Mo) — au lieu d'en
 * écrire une seconde qui dirait la même chose autrement.
 */
export function empriseDeMer(carre, taille) {
  const cote = Math.max(1, Math.round(carre?.cote ?? 1))
  return {
    span: spanChamp(taille, cote),
    res: resChamp(cote),
    centre: centreDuCarre(carre || { i0: 0, j0: 0, cote: 1 }, taille),
    cote,
  }
}
```

avec l'import en tête du fichier : `import { resChamp, spanChamp } from './mer-emprise.js'`.

- [ ] **Étape 4 : lancer les tests du module pur**

```bash
node --test test/damier-mer.test.js test/damier-carre.test.js test/mer-emprise.test.js
```

Attendu : RÉUSSITE.

- [ ] **Étape 5 : brancher dans `src/ocean.js`**

Dans `rebuild` (ligne 1012), accepter `carre` et l'appliquer :

```js
  rebuild({ terrain, params, carre = null }) {
```

Puis, autour de la ligne 1088-1093 :

```js
      const emprise = empriseDeMer(carre, TERRAIN_SIZE)
      // le plan d'eau EST la fenêtre : il ne bouge pas, c'est son champ qui défile
      mat.uniforms.uSpan.value = emprise.span
      // ⚠️ LA SEGMENTATION NE SUIT PAS L'EMPRISE LINÉAIREMENT. Garder la
      // densité d'un bloc (4,57 segments/unité) donnerait 768² = 590 000
      // quadrilatères sur un 3×3, pour des vagues dont la longueur d'onde se
      // compte en unités. On plafonne, et la Tâche 7 mesure ce que ça coûte
      // visuellement avant de figer la valeur.
      const seg = Math.min(384, 256 * emprise.cote)
      const cote = TERRAIN_SIZE * emprise.cote * 0.998
      const geo = new THREE.PlaneGeometry(cote, cote, seg, seg)
      geo.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(emprise.centre.x, this._seaBase, emprise.centre.z)
```

Le rayon de coin et la jupe suivent : `buildRimGeometry(rayonEauDansSocle() * emprise.cote, r, cornerN)` — la jupe entoure alors le carré entier. Le fond de la jupe descend au `planchierCommun()` du damier (Tâche 3), pas au `baseY` du bloc central.

⚠️ Le champ doit être recuit à `emprise.res` **et** échantillonné sur `emprise.span` — vérifier que le code qui cuit le champ lit bien ces deux valeurs et pas `CHAMP_RES`/`TERRAIN_SIZE` en dur.

- [ ] **Étape 6 : câbler dans `src/main.js`**

Passer `carre: blockGrid.carreCourant()` à chaque appel de `ocean.rebuild`, et rappeler `rebuild` quand `onGridChanged` se déclenche (`src/block-grid.js:307`).

⚠️ **Ne pas rebâtir la mer à chaque arrivée de cellule.** Le damier se resynchronise à chaque dalle reçue ; recuire un champ 1152² huit fois de suite gèlerait la page. Ne rebâtir que si `cote` **ou** le centre ont changé.

- [ ] **Étape 7 : vérifier à l'écran et mesurer**

Charger un tracé qui donne un 3×3. Vérifier : la mer couvre les neuf cases, la jupe fait le tour de l'ensemble, aucune couture aux jointures, les vagues et la caustique sont présentes partout. Relever le temps de `rebuild` et le tas JS avant/après.

- [ ] **Étape 8 : commit**

```bash
git add src/ocean.js src/main.js src/damier-carre.js test/damier-mer.test.js package.json
git commit -m "feat: une seule mer et une seule jupe couvrent tout le carre du damier"
```

---

## Tâche 7 : arbitrer la charge de la mer étendue

**Fichiers**
- Modifier : `src/ocean.js` (la constante de segmentation)
- Modifier : `test/damier-mer.test.js`

**Interfaces**
- Consomme : la Tâche 6.
- Produit : rien de nouveau — une valeur mesurée et un commentaire qui la justifie.

L'exigence « l'optimisation de la charge est un point essentiel » se joue ici : le plafond `seg = min(384, 256 × cote)` de la Tâche 6 est un **choix provisoire non mesuré**. Cette tâche le remplace par un chiffre défendu.

- [ ] **Étape 1 : mesurer trois segmentations sur un damier 3×3**

Pour `seg ∈ {256, 384, 512}`, relever : nombre de quadrilatères, images par seconde en survol, et si la crête des vagues montre un escalier visible à la caméra la plus basse. Consigner dans un tableau.

- [ ] **Étape 2 : mesurer aussi le champ**

`resChamp(3)` = 1152². Vérifier le temps de cuisson réel et le tas. Si la cuisson bloque le fil principal plus de 150 ms, la découper ou la déporter.

- [ ] **Étape 3 : figer la valeur et la commenter**

Remplacer le `Math.min(384, ...)` par la valeur retenue, avec un commentaire donnant les trois mesures et la raison du choix — sur le modèle des commentaires chiffrés déjà présents dans `src/block-grid.js`.

- [ ] **Étape 4 : verrouiller par un test**

Ajouter à `test/damier-mer.test.js` un test qui borne le nombre de quadrilatères du plan d'eau pour un 3×3, avec le chiffre mesuré et sa justification en commentaire.

- [ ] **Étape 5 : commit**

```bash
git add src/ocean.js test/damier-mer.test.js
git commit -m "perf: segmentation de la mer etendue mesuree et bornee"
```

---

## Tâche 8 : les couches d'eau intérieures sur tout le carré

**Fichiers**
- Modifier : `src/plan-eau.js` et/ou `src/lake.js` (à déterminer par lecture)
- Modifier : `src/main.js`

**Interfaces**
- Consomme : `BlockGrid.carreCourant()` (Tâche 2), `empriseDeMer` (Tâche 6).

Les rivières et lacs sont construits sur le bloc central (ou sur l'emprise en mode continu) et **n'existent pas** sur les cellules voisines. C'est le dernier écart réel entre « bloc principal » et « bloc secondaire » une fois la mer traitée.

- [ ] **Étape 1 : établir l'état exact**

Lire `src/plan-eau.js` et `src/lake.js` et écrire, dans le rapport de tâche, **ce qui borne aujourd'hui leur emprise** : une constante, un DEM, un contour ? Ne rien modifier avant.

- [ ] **Étape 2 : décider et le dire**

Deux issues acceptables, la seconde devant être argumentée :
1. étendre l'emprise au carré, comme la mer ;
2. **ne pas** l'étendre, si la mesure montre que le coût réseau (un jeu de polygones OSM par cellule) est disproportionné — auquel cas écrire la raison dans le code et la remonter à Adrien.

Une troisième issue n'est pas acceptable : laisser l'écart sans le documenter.

- [ ] **Étape 3 : implémenter l'issue retenue, avec ses tests**

- [ ] **Étape 4 : vérifier à l'écran** qu'aucune rivière ne s'arrête net à une jointure.

- [ ] **Étape 5 : commit**

---

## Tâche 9 : les textes s'écartent avec la grille

**Fichiers**
- Modifier : `src/ground-info-layer.js` (`_addWallPlane` ~152-172, `_place` ~281, et les usages de `HALF` aux lignes 205, 245, 283, 321)
- Modifier : `src/main.js` (l'appel de `setFrameScale`)
- Créer : `test/damier-cadre.test.js`
- Modifier : `package.json`

**Interfaces**
- Consomme : `BlockGrid.carreCourant()` (Tâche 2), `centreDuCarre` (Tâche 6).

**Bonne nouvelle** : `setFrameScale(k)` existe déjà (`src/ground-info-layer.js:476`) et sert au mode zone isolée (`src/main.js:6246`). Le commentaire de la ligne 469 le dit : « Toute la mise en page pend d'un HALF unique (le demi-bloc), donc il suffit… ». L'essentiel du travail est donc de **l'appeler avec le côté du carré**, puis de vérifier les cas que le mode zone isolée ne rencontre jamais.

⚠️ **Ce que `setFrameScale` ne couvre probablement pas** : le **centre**. En 2×2 le carré n'est pas centré sur l'origine (Tâche 6) ; les textes doivent suivre ce décalage, sinon ils se collent d'un côté. À vérifier en premier.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `test/damier-cadre.test.js` :

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { centreDuCarre } from '../src/damier-carre.js'
import { ecartTextes } from '../src/damier-carre.js'

const TAILLE = 56
const ECART = 0.06 // la marge de _addWallPlane (ground-info-layer.js:167)

// LA DEMANDE : « les textes vont s'éloigner vers le sud, l'est et l'ouest en
// fonction de la grille, tout en restant à la MÊME DISTANCE du bloc le plus
// proche qu'ils le sont actuellement ».
test('en 1x1 les textes ne bougent pas d\'un pouce', () => {
  const e = ecartTextes({ i0: 0, j0: 0, cote: 1 }, TAILLE, ECART)
  assert.equal(e.sud, TAILLE / 2 + ECART, 'exactement HALF + 0,06, comme avant')
})

test('en 3x3 les textes s\'ecartent d\'un cote de carre entier', () => {
  const e = ecartTextes({ i0: -1, j0: -1, cote: 3 }, TAILLE, ECART)
  assert.equal(e.sud, (TAILLE * 3) / 2 + ECART)
  // LA DISTANCE AU BLOC LE PLUS PROCHE EST INCHANGÉE : le bloc du bord sud
  // finit en 3*56/2 = 84, le texte est a 84,06. Ecart : 0,06, comme en 1x1.
  assert.equal(e.sud - (TAILLE * 3) / 2, ECART)
})

test('en 2x2 les textes suivent le decalage du carre', () => {
  const c = { i0: -1, j0: -1, cote: 2 }
  const centre = centreDuCarre(c, TAILLE)
  const e = ecartTextes(c, TAILLE, ECART)
  // le bord sud du carre est a centre.z + cote*TAILLE/2
  assert.equal(e.sud, centre.z + (TAILLE * 2) / 2 + ECART)
  assert.notEqual(e.sud, (TAILLE * 2) / 2 + ECART, 'ne pas oublier le decalage')
})

test('les textes se rapprochent quand la grille retrecit', () => {
  const large = ecartTextes({ i0: -1, j0: -1, cote: 3 }, TAILLE, ECART)
  const etroit = ecartTextes({ i0: 0, j0: 0, cote: 1 }, TAILLE, ECART)
  assert.ok(etroit.sud < large.sud, 'le retour au 1x1 doit ramener les textes')
})
```

Ajouter le fichier à `package.json`.

- [ ] **Étape 2 : lancer pour vérifier l'échec**

```bash
node --test test/damier-cadre.test.js
```

Attendu : ÉCHEC, `ecartTextes` n'existe pas.

- [ ] **Étape 3 : ajouter `ecartTextes` à `src/damier-carre.js`**

```js
/**
 * Où poser les plans de texte muraux pour qu'ils restent à la MÊME distance
 * du bloc le plus proche, quelle que soit la taille de la grille.
 *
 * `ground-info-layer.js:167` pose le plan sud à `HALF + 0,06`. Avec un damier,
 * ce n'est plus `HALF` qu'il faut mais le demi-côté du CARRÉ — et il faut y
 * ajouter le décalage du carré, qui n'est nul que pour un côté impair.
 */
export function ecartTextes(carre, taille, marge) {
  const cote = Math.max(1, Math.round(carre?.cote ?? 1))
  const demi = (taille * cote) / 2
  const c = centreDuCarre(carre || { i0: 0, j0: 0, cote: 1 }, taille)
  return {
    sud: c.z + demi + marge,
    nord: c.z - demi - marge,
    est: c.x + demi + marge,
    ouest: c.x - demi - marge,
  }
}
```

- [ ] **Étape 4 : brancher dans `src/ground-info-layer.js`**

Remplacer les `HALF` d'ancrage (lignes 164, 167, et les marges des lignes 283 et 321) par les valeurs rendues par `ecartTextes`, transmises via une méthode `setCarre(carre)` appelée depuis `main.js` sur `onGridChanged`. Conserver `setFrameScale` pour le mode zone isolée — les deux mécanismes ne doivent pas se marcher dessus : documenter lequel gagne quand les deux sont actifs.

- [ ] **Étape 5 : vérifier à l'écran**

Charger un tracé donnant un 2×2 puis un 3×3, puis revenir au 1×1. Les textes doivent s'écarter et revenir, sans jamais toucher un socle ni flotter loin.

- [ ] **Étape 6 : commit**

```bash
git add src/ground-info-layer.js src/damier-carre.js src/main.js test/damier-cadre.test.js package.json
git commit -m "feat: les textes graves suivent la taille et le centre du damier"
```

---

## Tâche 10 : la caméra voit tout le damier en isométrique

**Fichiers**
- Modifier : `src/main.js` (le bouton caméra)
- Modifier : `src/vue-ensemble.js` si nécessaire
- Modifier : `test/damier-cadre.test.js`

**Interfaces**
- Consomme : `poseIsometrique(points, { fovDeg, marge })` (`src/vue-ensemble.js`), `carreCourant()`, `centreDuCarre`.

**Demande** : « le bouton caméra en vue multi-cases permettra de voir toutes les cases à la fois en isométrique **sans passer au zoom inférieur**, et on reviendra au mode précédent si une seule case est affichée. Si l'utilisateur continue de dézoomer, alors on dézoome vraiment. »

Trois comportements distincts, à ne pas confondre :
1. **grille > 1×1** → le bouton cadre l'ensemble en isométrique, **sans toucher au niveau de zoom géographique** (le zoom reste celui du damier chargé) ;
2. **grille = 1×1** → le bouton retrouve son comportement d'avant ;
3. **dézoom continué dans ce mode** → on sort du cadrage isométrique et on dézoome pour de bon (l'escalier de zoom, `src/escalier-zoom.js`).

Le point 3 est le piège : il faut distinguer « le bouton a cadré » de « l'utilisateur veut vraiment partir ». Un seuil de molette, pas un booléen.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter à `test/damier-cadre.test.js` un test du module pur de décision :

```js
import { modeCameraDamier, doitVraimentDezoomer } from '../src/vue-ensemble.js'

test('en 1x1 le bouton camera garde son comportement d\'avant', () => {
  assert.equal(modeCameraDamier({ cote: 1 }), 'bloc')
})

test('des qu\'il y a plusieurs cases, le bouton cadre l\'ensemble', () => {
  assert.equal(modeCameraDamier({ cote: 2 }), 'ensemble')
  assert.equal(modeCameraDamier({ cote: 3 }), 'ensemble')
})

// LE PIÈGE : cadrer l'ensemble ne doit PAS changer le zoom geographique.
// Un dezoom d'escalier rechargerait tout le damier a une autre resolution.
test('cadrer l\'ensemble ne consomme pas un cran de zoom', () => {
  const avant = 12
  const r = modeCameraDamier({ cote: 3 }, { zoom: avant })
  assert.equal(r === 'ensemble' ? avant : avant, avant, 'le zoom ne bouge pas')
})

// ET SON REVERS : si l'utilisateur insiste, il doit pouvoir sortir.
test('un dezoom franc sort du cadrage et dezoome vraiment', () => {
  assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: 0.2 }), false, 'un cran mou ne sort pas')
  assert.equal(doitVraimentDezoomer({ mode: 'ensemble', cumul: 1.5 }), true, 'l\'insistance sort')
})

test('hors du cadrage, tout dezoom est un vrai dezoom', () => {
  assert.equal(doitVraimentDezoomer({ mode: 'bloc', cumul: 0.1 }), true)
})
```

- [ ] **Étape 2 : lancer pour vérifier l'échec**

```bash
node --test test/damier-cadre.test.js
```

- [ ] **Étape 3 : implémenter les deux fonctions pures dans `src/vue-ensemble.js`**, puis les câbler au bouton caméra et à la molette dans `main.js`. Le cadrage utilise `poseIsometrique` sur les **quatre coins du carré** projetés au sol, pas sur les points du tracé.

- [ ] **Étape 4 : lancer les tests**

```bash
node --test test/damier-cadre.test.js
npm test
```

- [ ] **Étape 5 : vérifier à l'écran** les trois comportements, dans l'ordre : 3×3 → bouton → tout est visible en isométrique et le relief n'a pas changé de finesse ; molette douce → rien ; molette insistante → vrai dézoom ; retour en 1×1 → bouton d'avant.

- [ ] **Étape 6 : commit**

```bash
git add src/vue-ensemble.js src/main.js test/damier-cadre.test.js
git commit -m "feat: le bouton camera cadre tout le damier en isometrique sans changer de zoom"
```

---

## Tâche 11 : vérifier qu'aucun habillage ne reste réservé au bloc principal

**Fichiers**
- Modifier : `src/block-grid.js` (l'en-tête, lignes 1-15)
- Modifier : selon les écarts trouvés

**Interfaces** : aucune nouvelle.

C'est la tâche de **vérification** de l'exigence principale : « les blocs secondaires doivent être traités exactement comme le principal, avec les mêmes infos du template ».

- [ ] **Étape 1 : dresser la liste**

Pour chaque réglage que le gabarit contrôle (matières, palette, hypsométrie, contours, grille, teinte de mer, aérien, masque côtier, socle, occlusion, ombres, nuages, végétation, occupation du sol), établir s'il atteint les cellules voisines. Produire un tableau à trois colonnes : réglage / atteint les voisines ? / si non, pourquoi.

- [ ] **Étape 2 : classer chaque écart**

Trois catégories, et une seule est acceptable sans action :
- **contrainte technique mesurée** (ex. la résolution de maillage, contrainte globale 2) — acceptable, **à condition d'être commentée dans le code avec son chiffre** ;
- **choix délibéré** (ex. le cartouche gravé, qui n'a de sens qu'une fois) — acceptable, à documenter ;
- **oubli** — à corriger.

- [ ] **Étape 3 : corriger les oublis**, chacun avec son test.

- [ ] **Étape 4 : réécrire l'en-tête de `src/block-grid.js`**

Les lignes 12-15 affirment aujourd'hui que les voisines n'ont « PAS la mer animée, le socle, les labels ni l'aérien ». Le socle et l'aérien y sont depuis longtemps, et la mer y arrive avec la Tâche 6. Un en-tête faux coûte plus cher qu'un en-tête absent — c'est le fichier lui-même qui le dit, ligne 57.

- [ ] **Étape 5 : commit**

```bash
git add src/block-grid.js
git commit -m "docs: l'en-tete du damier decrit enfin ce que les voisines recoivent vraiment"
```

---

## Tâche 12 : revue de charge et garde-fous

**Fichiers**
- Modifier : `test/damier-memoire.test.js`, `test/damier-reseau.test.js`
- Modifier : `src/block-grid.js` si un garde-fou manque

**Interfaces** : aucune nouvelle.

- [ ] **Étape 1 : mesurer un damier 3×3 complet, avant/après ce plan**

Relever, sur le même tracé et la même machine : tas JS, nombre de requêtes, temps jusqu'à l'affichage complet, images par seconde en survol, nombre de triangles rendus. Un tableau, comme la campagne du 27/07 citée dans `src/block-grid.js:217-222`.

- [ ] **Étape 2 : comparer au coût de la régularité**

Le carré plein charge plus de cases que le chemin du tracé. Chiffrer ce surcoût sur trois tracés réels de forme différente (ligne droite, boucle, aller-retour). Si le surcoût dépasse 40 %, remonter la mesure à Adrien avec la question — le remplissage reste sa décision, mais elle doit être prise en connaissance du chiffre.

- [ ] **Étape 3 : mesurer ce que coûteraient encore les murs intérieurs**

Décision D5 : ils sont conservés. Mesurer le nombre de triangles qu'ils représentent sur un 3×3. Si c'est supérieur à 10 % du total, l'écrire dans le code comme piste connue, sans l'implémenter dans ce plan.

- [ ] **Étape 4 : vérifier que le palier machine mord vraiment**

Simuler chaque palier et vérifier que le côté du carré descend comme prévu (24 → 3×3, 12 → 3×3, 8 → 3×3, 4 → 2×2). Ajouter le test correspondant.

- [ ] **Étape 5 : vérifier la non-régression du mode zone isolée et du mode continu**

```bash
npm test
```

Attendu : RÉUSSITE, dont `test/region-grid.test.js`, `test/dem-emprise.test.js` et tous les `test/fenetre-*.test.js` inchangés.

- [ ] **Étape 6 : commit**

```bash
git add -A
git commit -m "perf: campagne de mesure du damier carre et garde-fous de palier"
```

---

## Auto-revue du plan

**Couverture des exigences d'Adrien**

| # | Exigence | Tâche |
|---|---|---|
| 1 | Blocs secondaires traités comme le principal | 6, 8, 11 |
| 2 | La mer + sa jupe couvrent tous les blocs | 6, 7 |
| 3 | Boucher les trous, formes 1×1 / 2×2 / 3×3 | 1, 2 |
| 4 | Plafond 3×3 préservé | 1, 2 (et D2 : il n'existait pas) |
| 5 | Masque mobile pour le multi-blocs ? | D3 — décidé : non, avec sa raison |
| 6 | Hauteur commune, celle du bloc le plus profond | 3 |
| 7 | Arrondis retirés sur les arêtes adjacentes | 4, 5 |
| 8 | Les textes s'écartent et reviennent | 9 |
| 9 | Optimisation de la charge | 1 (palier), 7, 12 |
| 10 | Bouton caméra isométrique multi-cases | 10 |
| 11 | Dézoom réel si l'utilisateur insiste | 10 |

**Points à surveiller pendant l'exécution**

- La Tâche 4 propose **deux** fonctions de masque ; une seule doit survivre à la Tâche 5. Si les deux restent, c'est un défaut à signaler.
- La Tâche 5 touche `plinth.js`, partagé avec le bloc central et le mode zone isolée. Tout test de socle qui bouge sans masque est une régression, pas un ajustement.
- La Tâche 6 est la plus lourde ; si elle dépasse deux allers-retours de revue, la scinder (emprise, puis jupe).
- Les Tâches 8 et 11 peuvent conclure « on ne fait rien », mais **jamais sans écrire pourquoi**.
