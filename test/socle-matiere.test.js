// Les trois gestes de matière du socle, mesurés plutôt que crus :
//   1. le chanfrein d'arête haute (une couronne de plus dans buildSlabWalls) ;
//   2. l'occlusion de contact cuite en couleur de sommet ;
//   3. la carte de micro-rugosité (le champ, pas le canevas — node n'a pas de DOM).
// Plus le branchement de `slabCornerSmoothing`, resté exposé et jamais relu.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSlabWalls,
  computeSlab,
  contactAO,
  SOCLE_CHANFREIN,
  SOCLE_AO_BANDE,
  SOCLE_AO_FORCE,
  bandeContact,
  SOCLE_ARRONDI,
  SOCLE_ARRONDI_SEG,
  SOCLE_MARGE_EAU,
  rayonMurSocle,
  rayonEauDansSocle,
  rayonCoinEau,
} from '../src/plinth.js'
import { exposantCoin, plansFenetre, debordementCoin, dansFenetre, pointCoin } from '../src/fenetre-clip.js'
import { microRoughnessField, MICRO_ROUGH_CREUX } from '../src/material-textures.js'
import { buildRegionSkirt } from '../src/region-skirt.js'
import { TERRAIN_SIZE } from '../src/terrain.js'
import { FLAGS } from '../src/flags.js'

// ⚠️ **BIS, 2026-09-05 — CES TESTS DÉCRIVENT LE RÉGIME « BISEAU ALLUMÉ ».**
// Adrien a décidé d'éteindre les biseaux du socle et leur retrait
// (`FLAGS.biseauSocle = false` par défaut) ; le code et ses lois restent, et
// c'est ici qu'on les tient. On rallume donc l'interrupteur pour ce fichier —
// un processus par fichier de test, rien ne fuit. Le défaut ÉTEINT est couvert
// par `test/biseau-socle.test.js`, qui prouve aussi que « rallumé » rend le
// solide d'avant au bit près.
FLAGS.biseauSocle = true

const HALF = TERRAIN_SIZE / 2
const plat = () => 0

// ───────────────────────────── 1. chanfrein d'arête haute ────────────────────

test('le profil du mur, couronne par couronne', () => {
  // ⚠️ Ce relief est PLAT et la profondeur celle par défaut : la bande
  // d'occlusion vaut 0,84 et le rayon du congé 0,9. La couronne de la bande
  // tombe donc SOUS le congé et se dégénère — d'où les 9 et non 11 quand seul
  // le congé est là. Sur un vrai relief le mur est vingt fois plus haut et les
  // deux couronnes coexistent. C'est ce recouvrement que le compte documente.
  const n = 8 * 4 // resolution 8 → 4 côtés × 8 échantillons
  const tri = (o) => buildSlabWalls(plat, { resolution: 8, ...o }).geo.attributes.position.count / 3
  assert.equal(tri({ chanfrein: 0, arrondi: 0 }), n * 5, 'nu : 2 murs + 2 bande + 1 fond')
  assert.equal(tri({ arrondi: 0 }), n * 7, '+ chanfrein : 2 de plus')
  assert.equal(tri({ chanfrein: 0 }), n * 9, '+ congé à 3 segments (la bande passe dedans)')
  assert.equal(tri({}), n * 11, 'les deux : 2 chanfrein + 2 murs + 6 congé + 1 fond')
  assert.equal(tri({ arrondiSeg: 1 }), n * 7, 'le congé à 1 segment retombe sur un chanfrein bas')
})

test('le congé porte des normales LISSES, sinon ce sont des facettes', () => {
  // C'est la normale qui fait l'arrondi, pas la silhouette : trois segments à
  // normales de face rendraient trois bandes plates, l'inverse de l'intention.
  const { geo, baseY } = buildSlabWalls(plat, { resolution: 16 })
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const vues = new Set()
  for (let v = 0; v < pos.count; v++) {
    if (pos.getY(v) > baseY + SOCLE_ARRONDI + 1e-6) continue // au-dessus du congé
    vues.add(nor.getY(v).toFixed(3))
  }
  assert.ok(vues.size >= 4, `le congé n'a que ${vues.size} direction(s) : il facette`)
})

test('le congé se SOUDE au mur en haut et au fond en bas', () => {
  // ══════ LE DÉFAUT D'ADRIEN : « la base du socle est traitée comme un objet
  // séparé ». Ce n'en était pas un — c'était un SIGNE.
  //
  // Toutes les normales de cette géométrie sont stockées RETOURNÉES, vers
  // l'intérieur du solide (convention de `pousse`, redressée au fragment par
  // DoubleSide). La première version du congé n'en retournait que la moitié :
  // l'horizontale oui, la verticale non. La bande descendait donc vers le BAS
  // quand le fond, lui, regarde vers le HAUT — elle recevait la lumière comme si
  // elle était tournée vers le ciel, avec une cassure nette au raccord.
  //
  // La propriété qui compte n'est pas « les normales varient » mais « elles
  // coïncident AUX DEUX BOUTS ». C'est ce que ce test verrouille.
  const { geo, baseY } = buildSlabWalls(plat, { resolution: 16 })
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  // ⚠️ `|z| < 5` EN PLUS de `x ≥ 26` : sans lui on tombait dans un COIN arrondi,
  // dont la bissectrice est diagonale — la normale y vaut (0,0,1) et non
  // (−1,0,0), et la comparaison avec le mur du côté droit ne voulait plus rien
  // dire. On reste au milieu de la face +x.
  const lire = (predicat) => {
    for (let v = 0; v < pos.count; v++) {
      if (pos.getX(v) < 26 || Math.abs(pos.getZ(v)) > 5) continue
      if (predicat(pos.getY(v) - baseY)) return [nor.getX(v), nor.getY(v), nor.getZ(v)]
    }
    return null
  }
  const fond = lire((h) => Math.abs(h) < 1e-9)
  const congeBas = lire((h) => h > 1e-9 && h < SOCLE_ARRONDI * 0.2)
  const congeHaut = lire((h) => Math.abs(h - SOCLE_ARRONDI) < 1e-6)
  // ⚠️ LE MUR SE CHERCHE PAR TRIANGLE, PAS PAR SOMMET. Sur ce relief plat il n'a
  // que deux rangs, 0,9 et 6,84 — et le rang 6,84 est PARTAGÉ avec le chanfrein,
  // dont la normale est inclinée par construction. Un sommet pris à cette
  // altitude tombait une fois sur deux dans le chanfrein, et le test croyait
  // mesurer le mur.
  const lireTri = (predicat) => {
    for (let t = 0; t < pos.count; t += 3) {
      const hs = [0, 1, 2].map((k) => pos.getY(t + k) - baseY)
      const xs = [0, 1, 2].map((k) => pos.getX(t + k))
      if (Math.min(...xs) < 26) continue
      if (predicat(Math.min(...hs), Math.max(...hs))) return [nor.getX(t), nor.getY(t), nor.getZ(t)]
    }
    return null
  }
  const mur = lireTri((bas, haut) => Math.abs(bas - SOCLE_ARRONDI) < 1e-6 && haut > SOCLE_ARRONDI + 1)
  assert.ok(fond && congeBas && congeHaut && mur, 'les quatre familles doivent exister')
  // le fond regarde vers le HAUT (normale rentrante d'une face du dessous)
  assert.ok(fond[1] > 0.99, `le fond ne regarde pas vers le haut : ${JSON.stringify(fond)}`)
  // …et le bas du congé part DANS LE MÊME SENS, jamais à l'opposé
  assert.ok(congeBas[1] > 0.5, `le bas du congé s'oppose au fond : ${JSON.stringify(congeBas)}`)
  // en haut il est PUREMENT horizontal : c'est ce qui le soude au mur
  assert.ok(Math.abs(congeHaut[1]) < 1e-6, `le haut du congé n'est pas plat : ${JSON.stringify(congeHaut)}`)
  assert.ok(Math.abs(mur[1]) < 1e-6, 'le mur est vertical, donc sa normale est horizontale')
  // et il pointe du même côté que le mur — sinon la bande s'éclaire à l'envers
  assert.ok(congeHaut[0] * mur[0] + congeHaut[2] * mur[2] > 0.99, 'congé et mur regardent à l’opposé')
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
    // ⚠️ `haut > -1` EN PLUS de `bas < -1` : sans lui, la dernière couronne
    // retenue était celle du CONGÉ (qui vit tout en bas et dont la normale est
    // oblique par construction), et le test croyait mesurer le mur.
    if (haut > -1e-9 && bas > -0.31) nBande = [nor[i], nor[i + 1], nor[i + 2]]
    else if (bas < -1 && haut > -1) nMur = [nor[i], nor[i + 1], nor[i + 2]]
  }
  assert.ok(nBande && nMur, 'bande et mur trouvés')
  const dot = nBande[0] * nMur[0] + nBande[1] * nMur[1] + nBande[2] * nMur[2]
  assert.ok(dot < 0.999, `bande et mur partagent la même normale (dot=${dot})`)
  assert.ok(nBande[1] > 0.1, 'la bande est inclinée, pas verticale')
  assert.ok(Math.abs(nMur[1]) < 1e-6, 'le mur reste vertical')
})

test('le chanfrein se VOIT, sans devenir une facette', () => {
  // Le bloc fait 56 unités et occupe ~1 000 px cadré large, soit ~18 px/unité.
  // La borne d'avant (1/18, « sous le pixel ») rendait le liseré invisible à
  // distance de lecture — Adrien : « rends le plus visible ». La fenêtre utile
  // va donc de 2 à 6 px : en dessous il disparaît, au-dessus il cesse d'être
  // une ligne et devient une facette de plastique injecté.
  assert.ok(SOCLE_CHANFREIN >= 2 / 18, `chanfrein ${SOCLE_CHANFREIN} invisible de loin`)
  assert.ok(SOCLE_CHANFREIN <= 6 / 18, `chanfrein ${SOCLE_CHANFREIN} : c'est une facette`)
})

test('le congé bas reste un congé, pas un boudin', () => {
  // Il doit se lire comme un arrondi de fabrication, pas comme un galet : au
  // quart de la hauteur du mur, le socle perdrait sa franchise.
  assert.ok(SOCLE_ARRONDI > SOCLE_CHANFREIN, 'le dessous est plus rond que le dessus')
  assert.ok(SOCLE_ARRONDI <= 1.5, `congé ${SOCLE_ARRONDI} : le socle devient un galet`)
  assert.ok(SOCLE_ARRONDI_SEG >= 2, 'un seul segment ne fait pas un arrondi')
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

// ═════ 4. LA BANDE D'OCCLUSION EST COMMUNE À TOUTES LES DALLES ═══════════════
//
// LE DÉFAUT D'ADRIEN, « en mode isolé sur plusieurs socles, les socles semblent
// tous différents ». Chaque constructeur mesurait le point HAUT de SA pièce et
// en tirait sa bande : sur le damier isolé (jusqu'à 23 jupes) celle qui coupe un
// sommet cuisait un pied sombre plusieurs fois plus haut que sa voisine de
// plaine. Deux murs qui se touchent, deux hauteurs d'assombrissement.

test('bandeContact rend une longueur MONDE, jamais négative ni NaN', () => {
  assert.equal(bandeContact(10, 0), SOCLE_AO_BANDE * 10)
  assert.equal(bandeContact(3, -7), SOCLE_AO_BANDE * 10)
  assert.equal(bandeContact(0, 0), 0)
  assert.equal(bandeContact(-5, 0), 0, 'un mur de hauteur négative ne cuit rien')
  assert.equal(bandeContact(undefined, undefined), 0)
})

// Hauteur, au-dessus du pied, à laquelle l'assombrissement se REFERME : le
// sommet le plus bas resté au grand jour. C'est la mesure qui distingue une
// bande d'une rampe étalée sur tout le mur.
function hauteurBandeCuite(geo, baseY) {
  const pos = geo.attributes.position
  const col = geo.attributes.color
  let haut = Infinity
  for (let v = 0; v < col.count; v++) {
    if (col.getX(v) > 254.5 / 255) haut = Math.min(haut, pos.getY(v) - baseY)
  }
  return Number.isFinite(haut) ? haut : 0
}

test('deux socles de hauteurs opposées cuisent le MÊME pied sombre', () => {
  const montagne = (x) => 20 + 6 * Math.sin(x / 5)
  const plaine = () => 1
  const opts = { resolution: 16, baseYFloor: -7 }
  // TÉMOIN — sans bande imposée, chacun mesure la sienne, et elles diffèrent.
  const mLibre = buildSlabWalls(montagne, opts)
  const pLibre = buildSlabWalls(plaine, opts)
  const hM = hauteurBandeCuite(mLibre.geo, mLibre.baseY)
  const hP = hauteurBandeCuite(pLibre.geo, pLibre.baseY)
  assert.ok(hM > hP * 1.5, `le témoin doit mordre : ${hM.toFixed(2)} vs ${hP.toFixed(2)}`)

  // IMPOSÉE — les deux cuisent exactement la même hauteur.
  const bande = bandeContact(26, -7)
  const m = buildSlabWalls(montagne, { ...opts, aoBande: bande })
  const p = buildSlabWalls(plaine, { ...opts, aoBande: bande })
  assert.equal(m.baseY, p.baseY, 'même pied, sinon la comparaison ne dit rien')
  const a = hauteurBandeCuite(m.geo, m.baseY)
  const b = hauteurBandeCuite(p.geo, p.baseY)
  assert.ok(Math.abs(a - b) < 1e-6, `bandes divergentes : ${a} vs ${b}`)
  assert.ok(a > 0 && a <= bande + 1e-3, `bande hors de sa borne : ${a} pour ${bande}`)
})

test('buildSlabWalls ressort sa bande, pour que le damier la redonne', () => {
  const { bande, baseY } = buildSlabWalls((x) => 10 + Math.sin(x), { resolution: 8 })
  assert.ok(Number.isFinite(bande) && bande > 0)
  assert.ok(Math.abs(bande - bandeContact(11, baseY)) < 0.2, 'mesurée sur le point haut du bord')
})

test('la jupe de découpe suit la bande imposée, pas la sienne', () => {
  const relief = (x, z) => 3 + Math.sin(x / 9) * 2
  const commune = 4 // unités monde, bien plus large que ce que ce relief donnerait
  const libre = buildRegionSkirt({ uniform: 'full', sample: relief, grid: 24, depth: 5 })
  const impose = buildRegionSkirt({ uniform: 'full', sample: relief, grid: 24, depth: 5, aoBande: commune })
  const hLibre = hauteurBandeCuite(libre.mesh.geometry, libre.baseY)
  const hImpose = hauteurBandeCuite(impose.mesh.geometry, impose.baseY)
  assert.ok(hImpose > hLibre * 1.5, `la bande imposée doit primer : ${hImpose} vs ${hLibre}`)
  assert.ok(hImpose <= commune + 1e-9)
})

// ═══ 5. LA PEAU DU BLOC : UNE SEULE DÉFINITION POUR LE SOCLE ET POUR L'EAU ═══
//
// LE DÉFAUT D'ADRIEN, « on voit l'eau à travers le bloc ». Trois modules
// décidaient chacun où finit le bloc, et s'accordaient à six millièmes d'unité
// près — par coïncidence, pas par construction. Élargir le chanfrein a mangé
// cette marge, et le flanc d'eau, qui court du fond de mer à la surface, s'est
// mis à masquer le mur sur toute cette hauteur.

test('le mur du socle est TOUJOURS dehors, l’eau TOUJOURS dedans', () => {
  for (const ch of [0, 0.05, SOCLE_CHANFREIN, 0.4, 1.2]) {
    const mur = rayonMurSocle(ch)
    const eau = rayonEauDansSocle(ch)
    assert.ok(eau < mur, `chanfrein ${ch} : l'eau (${eau}) déborde le mur (${mur})`)
    assert.ok(mur - eau >= 0.05, `marge trop mince à ${ch} : ${(mur - eau).toFixed(3)}`)
  }
})

test('le rayon du mur suit le chanfrein, pas une constante gravée', () => {
  assert.equal(rayonMurSocle(0), HALF, 'sans chanfrein le mur est au bord du bloc')
  assert.equal(rayonMurSocle(0.16), HALF - 0.16)
  assert.equal(rayonMurSocle(-3), HALF, 'un chanfrein négatif ne pousse pas le mur dehors')
})

test('le coin de l’eau rentre autant que son bord — sinon il ressort dans les angles', () => {
  // Rentrer un rectangle arrondi d'une distance d réduit son rayon de coin
  // d'autant. Garder le rayon d'origine ferait ressortir l'eau dans les quatre
  // angles alors qu'elle rentre sur les côtés droits.
  const rSocle = 2.24 // slabCorner 0,04 × 56, le réglage des gabarits livrés
  const rEau = rayonCoinEau(rSocle)
  assert.ok(Math.abs(rEau - (rSocle - SOCLE_CHANFREIN - SOCLE_MARGE_EAU)) < 1e-9)
  assert.ok(rayonCoinEau(0.05) > 0, 'un coin minuscule ne devient jamais négatif')
})

test('pointCoin : une seule formule pour le socle ET pour le flanc d’eau', () => {
  // Elle était recopiée des deux côtés, et la copie du flanc était restée en
  // CERCLE quand celle du socle est passée au squircle. Un squircle est plus
  // PLEIN : le flanc rentrait dans les quatre angles pendant que la surface
  // allait au bord, et un liseré de vide s'ouvrait dans chaque coin.
  const rayon = (a, expo) => Math.hypot(...pointCoin(a, 10, expo))
  // à exposant 2, c'est le cercle d'avant, au bit près
  for (const a of [0, 0.3, Math.PI / 4, 1.2, Math.PI / 2]) {
    assert.ok(Math.abs(rayon(a, 2) - 10) < 1e-9, )
  }
  // au-delà, il gonfle — et c'est exactement là, en diagonale, que ça se joue
  assert.ok(rayon(Math.PI / 4, 4.4) > 10.5, 'le squircle ne gonfle pas')
  assert.ok(rayon(Math.PI / 4, 4.4) < 10 * Math.SQRT2, 'un squircle ne dépasse jamais le carré')
  // et il reste sur les axes, quel que soit l'exposant : le milieu des côtés ne
  // bouge pas, sinon le raccord avec les parties droites s'ouvrirait
  for (const expo of [2, 3, 4.4, 8]) {
    const [x, z] = pointCoin(0, 10, expo)
    assert.ok(Math.abs(x - 10) < 1e-9 && Math.abs(z) < 1e-9, )
  }
  assert.deepEqual(pointCoin(0.7, 5, 1), pointCoin(0.7, 5, 2), 'un exposant sous 2 retombe sur le cercle')
})
test('l’arc de coin s’échantillonne en LONGUEUR : plus de pentagone dans l’angle', () => {
  // LE DÉFAUT D'ADRIEN, « la qualité du chanfrein paraît faible dans les
  // angles ». L'ancienne règle (n/48) donnait CINQ segments par coin quelle que
  // soit sa taille : un quart de cercle de 2,24 unités rendu par un pentagone,
  // là où les côtés droits échantillonnent tous les 0,22. Tant que le liseré
  // tenait sous le pixel ça ne se voyait pas ; à 0,16 il épouse ces facettes.
  //
  // ⚠️ CE N'EST PAS UN COMPTE DE TRIANGLES QU'IL FAUT MESURER : un grand coin
  // RETIRE de la longueur droite, si bien que le total BAISSE quand le rayon
  // monte (11 264 → 8 448 de 0 à 14). La bonne propriété est l'ESPACEMENT :
  // aucun point de l'anneau ne doit s'éloigner de son voisin plus que le pas de
  // la grille, coins compris.
  const n = 256
  const pas = TERRAIN_SIZE / n
  for (const r of [1, 2.24, 6, 14]) {
    const { ring } = computeSlab(plat, 7, n, r, exposantCoin(0.6))
    let max = 0
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      max = Math.max(max, Math.hypot(b.x - a.x, b.z - a.z))
    }
    assert.ok(max < pas * 1.6, `coin ${r} : un écart de ${max.toFixed(3)} pour un pas de ${pas.toFixed(3)}`)
  }
})

test('…et le plafond de segments d’arc tient la facture sur un grand coin', () => {
  // Sans plafond, un coin de 14 unités demanderait une centaine de segments par
  // angle, et chaque point d'anneau coûte onze triangles.
  const tri = (r) => buildSlabWalls(plat, { resolution: 256, cornerR: r }).geo.attributes.position.count / 3
  assert.ok(tri(14) < tri(0), 'un coin arrondi retire de la longueur droite, il ne doit pas coûter plus')
})
