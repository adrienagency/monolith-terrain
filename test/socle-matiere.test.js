// Les trois gestes de matière du socle, mesurés plutôt que crus :
//   1. le chanfrein d'arête haute (une couronne de plus dans buildSlabWalls) ;
//   2. l'occlusion de contact cuite en couleur de sommet ;
//   3. la carte de micro-rugosité (le champ, pas le canevas — node n'a pas de DOM).
// Plus le branchement de `slabCornerSmoothing`, resté exposé et jamais relu.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSlabWalls,
  contactAO,
  SOCLE_CHANFREIN,
  SOCLE_AO_BANDE,
  SOCLE_AO_FORCE,
} from '../src/plinth.js'
import { exposantCoin, plansFenetre, debordementCoin, dansFenetre } from '../src/fenetre-clip.js'
import { microRoughnessField, MICRO_ROUGH_CREUX } from '../src/material-textures.js'
import { buildRegionSkirt } from '../src/region-skirt.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const HALF = TERRAIN_SIZE / 2
const plat = () => 0

// ───────────────────────────── 1. chanfrein d'arête haute ────────────────────

test('le chanfrein ajoute UNE couronne : 5 triangles par segment au lieu de 3', () => {
  const n = 8 * 4 // resolution 8 → 4 côtés × 8 échantillons
  const avec = buildSlabWalls(plat, { resolution: 8 })
  const sans = buildSlabWalls(plat, { resolution: 8, chanfrein: 0 })
  assert.equal(sans.geo.attributes.position.count, n * 3 * 3, 'sans chanfrein : 2 murs + 1 fond')
  assert.equal(avec.geo.attributes.position.count, n * 5 * 3, 'avec : 2 chanfrein + 2 murs + 1 fond')
})

test("l'arête haute reste EXACTEMENT sur le bord du relief (pas de jour sous la carte)", () => {
  // le sommet du mur ne bouge pas d'un cheveu : c'est le point sous l'arête qui
  // rentre. Sinon le relief déborderait dans le vide, le bug de « l'envers ».
  const { geo } = buildSlabWalls(plat, { resolution: 16 })
  const p = geo.attributes.position.array
  let hauts = 0
  for (let i = 0; i < p.length; i += 3) {
    if (p[i + 1] < -1e-9) continue // tout ce qui n'est pas le sommet
    hauts++
    const surBord = Math.abs(Math.abs(p[i]) - HALF) < 1e-9 || Math.abs(Math.abs(p[i + 2]) - HALF) < 1e-9
    assert.ok(surBord, `sommet (${p[i]},${p[i + 2]}) hors du bord`)
  }
  assert.ok(hauts > 0, 'des sommets à la hauteur du relief')
})

test('la bande de chanfrein rentre perpendiculairement, et descend d’autant', () => {
  const c = 0.4 // exagéré pour mesurer sans bruit numérique
  const { geo } = buildSlabWalls(plat, { resolution: 16, chanfrein: c })
  const p = geo.attributes.position.array
  let vus = 0
  for (let i = 0; i < p.length; i += 3) {
    if (Math.abs(p[i + 1] + c) > 1e-6) continue // seuls les points du pli
    vus++
    // sur un carré, le point rentré est à HALF - c du côté qu'il longe
    const dx = HALF - Math.abs(p[i])
    const dz = HALF - Math.abs(p[i + 2])
    assert.ok(Math.abs(Math.min(dx, dz) - c) < 1e-6, `pli à (${p[i]},${p[i + 2]}) mal rentré`)
  }
  assert.ok(vus > 0, 'le pli existe')
})

test('la bande porte sa PROPRE normale — c’est tout l’intérêt du liseré', () => {
  // une normale par face : la bande ne peut pas hériter de celle du mur, donc
  // N·L y diffère et l’arête cesse d’être une teinte plate de plus.
  // ⚠️ Les normales STOCKÉES pointent vers l’intérieur (convention de pushTri,
  // inchangée depuis l’origine) ; c’est `side: DoubleSide` qui les redresse au
  // fragment via gl_FrontFacing. Une bande qui rentre EN DESCENDANT a donc ici
  // un +y, et vaut −y à l’écran.
  const { geo } = buildSlabWalls(plat, { resolution: 16, chanfrein: 0.3 })
  const nor = geo.attributes.normal.array
  const pos = geo.attributes.position.array
  let nBande = null
  let nMur = null
  for (let i = 0; i < pos.length; i += 9) {
    const ys = [pos[i + 1], pos[i + 4], pos[i + 7]]
    const haut = Math.max(...ys)
    const bas = Math.min(...ys)
    if (haut - bas < 1e-6) continue // le fond, tout plat
    if (haut > -1e-9 && bas > -0.31) nBande = [nor[i], nor[i + 1], nor[i + 2]]
    else if (bas < -1) nMur = [nor[i], nor[i + 1], nor[i + 2]]
  }
  assert.ok(nBande && nMur, 'bande et mur trouvés')
  const dot = nBande[0] * nMur[0] + nBande[1] * nMur[1] + nBande[2] * nMur[2]
  assert.ok(dot < 0.999, `bande et mur partagent la même normale (dot=${dot})`)
  assert.ok(nBande[1] > 0.1, 'la bande est inclinée, pas verticale')
  assert.ok(Math.abs(nMur[1]) < 1e-6, 'le mur reste vertical')
})

test('le chanfrein par défaut reste un liseré, pas une facette', () => {
  // sous le pixel en vue large : le bloc fait 56 unités, cadré large il occupe
  // ~1000 px, soit ~18 px par unité. Un liseré doit rester sous ce pas.
  assert.ok(SOCLE_CHANFREIN <= 1 / 18, `chanfrein ${SOCLE_CHANFREIN} trop large`)
  assert.ok(SOCLE_CHANFREIN > 0.01, 'assez large pour survivre au MSAA')
})

// ────────────────────────── 2. occlusion de contact ──────────────────────────

test('contactAO : noir maximal au contact, blanc dès le haut de la bande', () => {
  assert.equal(contactAO(0, 0, 10), 1 - SOCLE_AO_FORCE)
  assert.equal(contactAO(10, 0, 10), 1)
  assert.equal(contactAO(50, 0, 10), 1)
  assert.equal(contactAO(-5, 0, 10), 1 - SOCLE_AO_FORCE, 'sous le pied : plancher, pas de dépassement')
  const mi = contactAO(5, 0, 10)
  assert.ok(mi > 1 - SOCLE_AO_FORCE && mi < 1, 'dégradé strictement entre les deux')
  assert.equal(contactAO(0, 0, 0), 1, 'bande nulle = aucune cuisson')
})

test('la cuisson reste sous 12 % de la hauteur et 20 % d’assombrissement', () => {
  assert.ok(SOCLE_AO_BANDE <= 0.12, 'bande trop haute → vignette')
  assert.ok(SOCLE_AO_FORCE <= 0.2, 'assombrissement trop fort → vignette')
  const { geo, baseY } = buildSlabWalls(plat, { resolution: 16, depth: 7 })
  const col = geo.attributes.color
  assert.ok(col, 'attribut color présent')
  assert.equal(col.itemSize, 3)
  assert.equal(col.normalized, true, 'octets normalisés : 3 o/sommet, pas 12')
  const pos = geo.attributes.position.array
  const bande = SOCLE_AO_BANDE * (0 - baseY)
  let plancher = 1
  for (let i = 0, v = 0; i < pos.length; i += 3, v++) {
    const g = col.getX(v)
    plancher = Math.min(plancher, g)
    const attendu = contactAO(pos[i + 1], baseY, bande)
    assert.ok(Math.abs(g - attendu) < 1.5 / 255, `sommet ${v} : ${g} ≠ ${attendu}`)
  }
  assert.ok(Math.abs(plancher - (1 - SOCLE_AO_FORCE)) < 1.5 / 255, 'le pied atteint bien le plancher')
})

test('l’occlusion s’éteint proprement (force 0 → couleurs blanches)', () => {
  const { geo } = buildSlabWalls(plat, { resolution: 8, aoForce: 0 })
  const col = geo.attributes.color
  for (let v = 0; v < col.count; v++) assert.ok(col.getX(v) > 254 / 255)
})

// ─────────────────────── 3. rupture de la rugosité ───────────────────────────

test('le champ de micro-rugosité est un multiplicateur 256², jamais > 1', () => {
  // une texture 8 bits ne code pas au-dessus de 1 : la carte ne peut que
  // CREUSER, c'est `roughness` qu'on relève pour recentrer.
  const f = microRoughnessField(256)
  assert.equal(f.length, 256 * 256)
  let min = Infinity
  let max = -Infinity
  let somme = 0
  for (const v of f) {
    if (v < min) min = v
    if (v > max) max = v
    somme += v
  }
  assert.ok(max <= 1 + 1e-6, `le multiplicateur dépasse 1 (${max})`)
  assert.ok(min >= 1 - MICRO_ROUGH_CREUX - 1e-6, `creux trop profond (${min})`)
  const moy = somme / f.length
  assert.ok(Math.abs(moy - (1 - MICRO_ROUGH_CREUX / 2)) < 0.02, `moyenne décentrée (${moy})`)
})

test('la rupture vaut ±0,06 autour de 0,95 une fois recentrée', () => {
  const f = microRoughnessField(256)
  const base = Math.min(1, 0.95 / (1 - MICRO_ROUGH_CREUX / 2)) // recentrage appliqué au matériau
  let min = Infinity
  let max = -Infinity
  for (const v of f) {
    const r = Math.min(1, base * v)
    if (r < min) min = r
    if (r > max) max = r
  }
  assert.ok(max - min > 0.08, `amplitude trop faible (${(max - min).toFixed(3)})`)
  assert.ok(max - min < 0.16, `amplitude trop forte (${(max - min).toFixed(3)}) — ce n'est plus de la pierre`)
})

test('le champ est BASSE fréquence : pas de bruit poivre et sel', () => {
  // deux pixels voisins doivent presque toujours se ressembler, sinon la carte
  // scintille au loin au lieu de casser le spéculaire.
  const N = 256
  const f = microRoughnessField(N)
  let sauts = 0
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.abs(f[y * N + x] - f[y * N + ((x + 1) % N)])
      if (d > MICRO_ROUGH_CREUX * 0.25) sauts++
    }
  }
  assert.ok(sauts === 0, `${sauts} sauts brutaux entre pixels voisins`)
})

test('le champ boucle sans couture (RepeatWrapping)', () => {
  const N = 64
  const f = microRoughnessField(N)
  for (let y = 0; y < N; y++) {
    const bord = Math.abs(f[y * N + (N - 1)] - f[y * N])
    assert.ok(bord < MICRO_ROUGH_CREUX * 0.25, `couture verticale en y=${y}`)
  }
  for (let x = 0; x < N; x++) {
    const bord = Math.abs(f[(N - 1) * N + x] - f[x])
    assert.ok(bord < MICRO_ROUGH_CREUX * 0.25, `couture horizontale en x=${x}`)
  }
})

// ───────────────── slabCornerSmoothing : branché, plus muet ──────────────────

test('exposantCoin traduit le réglage en exposant de superellipse', () => {
  assert.equal(exposantCoin(0), 2) // arc de cercle pur
  assert.ok(Math.abs(exposantCoin(0.6) - 4.4) < 1e-12) // le défaut d'Adrien — squircle
  assert.equal(exposantCoin(1), 6)
  assert.equal(exposantCoin(undefined), 2) // absent = comportement d'avant
  assert.equal(exposantCoin(-3), 2) // borné
  assert.equal(exposantCoin(9), 6)
})

test('l’octogone de la fenêtre continue reste DEHORS, squircle compris', () => {
  // l'invariant du module : un calque peut dépasser du coin, il ne peut jamais
  // être coupé trop tôt. Un squircle est plus PLEIN qu'un cercle — garder
  // l'ancienne constante diagonale l'aurait rogné.
  const half = 28
  const r = 0.04 * 56
  for (const lissage of [0, 0.3, 0.6, 1]) {
    const n = exposantCoin(lissage)
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * (Math.PI / 2)
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      // point du coin sur la superellipse d'exposant n
      const x = half - r + Math.pow(ca, 2 / n) * r
      const z = half - r + Math.pow(sa, 2 / n) * r
      assert.ok(dansFenetre(x, z, half, r, n), `lissage ${lissage}, angle ${i} : coupé trop tôt`)
    }
  }
})

test('à exposant 2 les plans sont ceux d’avant, au bit près', () => {
  const av = plansFenetre(28, 2.24) // signature d'avant (exposant implicite)
  const ap = plansFenetre(28, 2.24, 2)
  assert.deepEqual(av, ap)
  assert.ok(Math.abs(debordementCoin(2.24) - (Math.SQRT2 - 1) * 2.24) < 1e-12)
  // le squircle remplit mieux le coin : l'octogone le déborde MOINS
  assert.ok(debordementCoin(2.24, 4.4) < debordementCoin(2.24, 2))
})

// ──────── la jupe du mode zone isolée porte le même attribut, ou elle NOIRCIT ─

test('la jupe de découpe fournit l’attribut color — sinon WebGL la peint en noir', () => {
  // Le matériau des flancs est PARTAGÉ (24 socles du damier + cette jupe) et il
  // est passé en `vertexColors`. Une géométrie sans attribut `color` reçoit
  // alors la valeur générique WebGL (0,0,0,1) : la découpe entière deviendrait
  // NOIRE. Ce test est le garde-fou de cette dépendance à distance.
  // `uniform: 'full'` évite le canevas de masque (node n'a pas de DOM).
  const { mesh, baseY } = buildRegionSkirt({
    uniform: 'full',
    sample: (x, z) => 3 + Math.sin(x / 9) * 2,
    grid: 24,
    depth: 5,
  })
  const col = mesh.geometry.attributes.color
  assert.ok(col, 'attribut color absent : la jupe rendrait NOIRE')
  assert.equal(col.itemSize, 3)
  assert.equal(col.count, mesh.geometry.attributes.position.count)
  const pos = mesh.geometry.attributes.position
  let plancher = 1
  let plafond = 0
  for (let v = 0; v < col.count; v++) {
    const g = col.getX(v)
    plancher = Math.min(plancher, g)
    plafond = Math.max(plafond, g)
    if (pos.getY(v) === baseY) assert.ok(Math.abs(g - (1 - SOCLE_AO_FORCE)) < 1.5 / 255, 'pied non cuit')
  }
  assert.ok(plafond > 254 / 255, 'le haut de la jupe reste au grand jour')
  assert.ok(plancher < 1, 'le pied est bien assombri')
})
