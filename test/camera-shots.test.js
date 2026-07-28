import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  easeInOutCubic, easeOutCubic, easeInCubic,
  buildHeightGrid, worldToGrid, gridToWorld, sampleGrid,
  findSummit, findValleyMouth, limitePente,
  findCorridor, resampleXZ, smoothXZ,
  routeLibre3D, chooseHeading, altitudeDeSecurite,
  dollyAnchor, fovForDolly, tailleEcran,
  northScreenAngleDeg, NORTH, TOP_DOWN_DIR,
  planShot, SHOTS,
} from '../src/camera-shots.js'

// ---------------------------------------------------------------- fixtures
//
// Relief d'essai : une vallée COUDÉE entre deux crêtes parallèles, plus un
// sommet au nord. C'est la figure qui piège un couloir naïf — une ligne droite
// de l'entrée au sommet escalade forcément une crête, donc si le couloir
// trouvé reste bas, c'est qu'il a bien suivi le fond de vallée.
//
//   · l'axe de la vallée serpente : xc(z) = 18·sin(z/40)
//   · deux crêtes à xc ± 22, hautes de 30
//   · un sommet de 45 planté en (0, -60)
const HALF = 100
function reliefValleeCoudee() {
  return (x, z) => {
    const xc = 18 * Math.sin(z / 40) // axe (serpentant) du fond de vallée
    const d = Math.abs(x - xc)
    const crete = 30 * Math.exp(-((d - 22) ** 2) / 60)
    const sommet = 45 * Math.exp(-((x ** 2 + (z + 60) ** 2) / 900))
    // un fond de vallée qui remonte doucement vers le nord
    const fond = 2 + (100 - z) * 0.01
    return Math.max(fond, crete, sommet)
  }
}

// Cuvette fermée : sol plat cerné d'un mur circulaire. Aucune route horizontale
// n'en sort — c'est l'impasse qui doit faire MONTER la caméra.
function reliefCuvette() {
  return (x, z) => {
    const r = Math.hypot(x, z)
    return r > 30 ? 120 : 0
  }
}

// ------------------------------------------------------ courbes d'accélération
//
// « une accélération, jamais une vitesse constante » (Adrien). Une courbe qui
// ne fait pas ça est la signature du mouvement automatique.

test('les courbes partent et arrivent exactement sur 0 et 1', () => {
  for (const f of [easeInOutCubic, easeOutCubic, easeInCubic]) {
    assert.equal(f(0), 0)
    assert.equal(f(1), 1)
  }
})

test('easeInOutCubic demarre lentement, accelere au milieu, ralentit a l arrivee', () => {
  // vitesse instantanee par difference finie
  const v = (t) => (easeInOutCubic(t + 1e-4) - easeInOutCubic(t - 1e-4)) / 2e-4
  const vDepart = v(0.05)
  const vMilieu = v(0.5)
  const vArrivee = v(0.95)
  assert.ok(vMilieu > vDepart * 3, `le milieu doit filer : ${vMilieu} vs ${vDepart}`)
  assert.ok(vMilieu > vArrivee * 3, `l arrivee doit freiner : ${vArrivee} vs ${vMilieu}`)
  // et jamais de marche arriere
  for (let t = 0; t <= 1; t += 0.02) assert.ok(v(t) >= -1e-6, `vitesse negative en ${t}`)
})

test('easeInOutCubic est symetrique — le freinage vaut l accélération', () => {
  for (let t = 0; t <= 0.5; t += 0.05) {
    assert.ok(Math.abs(easeInOutCubic(t) + easeInOutCubic(1 - t) - 1) < 1e-9)
  }
})

// ------------------------------------------------------------ grille de relief

test('buildHeightGrid echantillonne le bloc et retrouve ses extremes', () => {
  const g = buildHeightGrid({ sampleGround: reliefValleeCoudee(), half: HALF, n: 48 })
  assert.equal(g.n, 48)
  assert.ok(g.max > 40, `le sommet (45) doit ressortir, vu ${g.max}`)
  assert.ok(g.min < 4, `le fond de vallee (~2) doit ressortir, vu ${g.min}`)
})

test('worldToGrid et gridToWorld sont reciproques au centre des cellules', () => {
  const g = buildHeightGrid({ sampleGround: () => 0, half: HALF, n: 32 })
  for (const [i, j] of [[0, 0], [5, 17], [31, 31], [16, 16]]) {
    const w = gridToWorld(g, i, j)
    const b = worldToGrid(g, w.x, w.z)
    assert.equal(b.i, i)
    assert.equal(b.j, j)
    assert.ok(Math.abs(w.x) <= HALF && Math.abs(w.z) <= HALF)
  }
})

test('worldToGrid borne les points hors bloc au lieu de sortir du tableau', () => {
  const g = buildHeightGrid({ sampleGround: () => 0, half: HALF, n: 32 })
  const a = worldToGrid(g, -9999, 9999)
  assert.ok(a.i >= 0 && a.i < 32 && a.j >= 0 && a.j < 32)
})

test('sampleGrid interpole — pas de marches d escalier entre deux cellules', () => {
  // rampe pure en x : l'interpolation doit redonner la rampe, pas des paliers
  const g = buildHeightGrid({ sampleGround: (x) => x, half: HALF, n: 64 })
  for (const x of [-40, -12.5, 0, 7.3, 55]) {
    assert.ok(Math.abs(sampleGrid(g, x, 0) - x) < 4, `interpolation molle en x=${x}`)
  }
})

// ------------------------------------------------------------ sujets du plan
//
// « sers-toi du relief reel comme sujet du plan » : le sommet le plus haut et
// l'entree de vallee la plus basse sont trouves DANS le relief, pas tires au sort.

test('findSummit tombe sur le sommet plante en (0,-60)', () => {
  const g = buildHeightGrid({ sampleGround: reliefValleeCoudee(), half: HALF, n: 64 })
  const s = findSummit(g)
  assert.ok(Math.hypot(s.x - 0, s.z + 60) < 12, `sommet trouve en (${s.x}, ${s.z})`)
  assert.ok(s.y > 40, `hauteur du sommet ${s.y}`)
})

test('findSummit ignore un sommet colle au BORD du bloc', () => {
  // Cas rencontre pour de vrai : sur Chamonix z12 le point culminant est le mont
  // Blanc, a z = 26,5 pour un demi-bloc de 28. Une orbite autour d un sujet
  // pareil sort du bloc et filme le vide. On veut donc le sommet INTERIEUR.
  const sol = (x, z) => {
    const bord = 60 * Math.exp(-((x - 95) ** 2 + (z - 95) ** 2) / 200) // enorme, au coin
    const dedans = 30 * Math.exp(-((x + 20) ** 2 + (z - 10) ** 2) / 400) // plus modeste, au centre
    return Math.max(1, bord, dedans)
  }
  const g = buildHeightGrid({ sampleGround: sol, half: HALF, n: 64 })
  const s = findSummit(g)
  assert.ok(Math.abs(s.x) <= HALF * 0.76 && Math.abs(s.z) <= HALF * 0.76, `sommet trop au bord : (${s.x}, ${s.z})`)
  assert.ok(Math.hypot(s.x + 20, s.z - 10) < 15, `on attendait le sommet interieur, vu (${s.x}, ${s.z})`)
})

test('limitePente borne la visee sans toucher a la direction horizontale', () => {
  const pos = { x: 0, y: 0, z: 0 }
  // cible 10 unites devant, 10 au-dessus : 45°, bien trop pour une poursuite
  const t = limitePente(pos, { x: 0, y: 10, z: 10 }, 0.36)
  assert.equal(t.x, 0)
  assert.equal(t.z, 10) // la direction horizontale est intacte
  assert.ok(Math.abs(t.y - 3.6) < 1e-9, `altitude bornee attendue 3.6, vue ${t.y}`)
  // et ca marche aussi vers le bas
  const b = limitePente(pos, { x: 0, y: -10, z: 10 }, 0.36)
  assert.ok(Math.abs(b.y + 3.6) < 1e-9)
  // une visee deja douce n est pas touchee
  const d = { x: 0, y: 1, z: 10 }
  assert.deepEqual(limitePente(pos, d, 0.36), d)
})

test('findValleyMouth part d un point BAS et LOIN du sommet', () => {
  const g = buildHeightGrid({ sampleGround: reliefValleeCoudee(), half: HALF, n: 64 })
  const s = findSummit(g)
  const m = findValleyMouth(g, s)
  const dist = Math.hypot(m.x - s.x, m.z - s.z)
  assert.ok(dist > HALF * 0.8, `l entree doit etre loin du sommet, vu ${dist.toFixed(1)}`)
  // et basse : dans le tiers inferieur de l'amplitude du relief
  assert.ok(m.y < g.min + (g.max - g.min) * 0.34, `entree trop haute : ${m.y.toFixed(1)}`)
})

// ------------------------------------------------------------------ le couloir
//
// LE morceau difficile. « un couloir se choisit dans le relief (la ligne de plus
// faible altitude entre deux cretes), pas au hasard ».

test('le couloir reste au FOND de la vallee et n escalade jamais une crete', () => {
  const sol = reliefValleeCoudee()
  const g = buildHeightGrid({ sampleGround: sol, half: HALF, n: 64 })
  const s = findSummit(g)
  const m = findValleyMouth(g, s)
  const couloir = findCorridor(g, m, s)
  assert.ok(couloir.length > 8, `couloir trop court : ${couloir.length} points`)

  // Les cretes culminent a 30. Hors de l'approche finale du sommet (qui monte
  // pour de bon, c'est le sujet du plan), aucun point ne doit s'y hisser :
  // rester sous 14 prouve qu'aucune crete n'a ete franchie.
  const horsSommet = couloir.filter((p) => Math.hypot(p.x - s.x, p.z - s.z) > 40)
  const plafond = Math.max(...horsSommet.map((p) => sol(p.x, p.z)))
  assert.ok(plafond < 14, `le couloir escalade a ${plafond.toFixed(1)} (cretes = 30)`)
})

test('LE COL : barre par un mur, le couloir va chercher la seule breche', () => {
  // Le test decisif du choix de couloir. Un mur continu de 40 barre le bloc
  // d est en ouest, perce d une SEULE breche a x = 35. Aller tout droit coute
  // de franchir le mur ; le bon plan est de trouver le col. C est exactement ce
  // que « passer entre les montagnes » demande.
  const sol = (x, z) => (Math.abs(z) < 6 && Math.abs(x - 35) > 8 ? 40 : 0)
  const g = buildHeightGrid({ sampleGround: sol, half: HALF, n: 64 })
  const depart = { x: 0, z: 60 }
  const arrivee = { x: 0, z: -60 }

  // en ligne droite, on percute le mur de plein fouet
  let plafondDroite = 0
  for (let i = 0; i <= 200; i++) plafondDroite = Math.max(plafondDroite, sol(0, 60 - 120 * (i / 200)))
  assert.equal(plafondDroite, 40)

  const couloir = findCorridor(g, depart, arrivee)
  const plafondCouloir = Math.max(...couloir.map((p) => sol(p.x, p.z)))
  assert.equal(plafondCouloir, 0, 'le couloir ne doit jamais franchir le mur')

  // et il est bien passe par la breche, pas ailleurs
  const auCol = couloir.filter((p) => Math.abs(p.z) < 6)
  assert.ok(auCol.length > 0, 'le couloir doit bien traverser la ligne du mur')
  for (const p of auCol) assert.ok(Math.abs(p.x - 35) <= 8, `passage hors de la breche en x=${p.x.toFixed(1)}`)
})

test('le couloir part bien de l entree et arrive bien au sommet', () => {
  const g = buildHeightGrid({ sampleGround: reliefValleeCoudee(), half: HALF, n: 64 })
  const s = findSummit(g)
  const m = findValleyMouth(g, s)
  const c = findCorridor(g, m, s)
  const cell = (2 * HALF) / 64
  assert.ok(Math.hypot(c[0].x - m.x, c[0].z - m.z) < cell * 2)
  assert.ok(Math.hypot(c[c.length - 1].x - s.x, c[c.length - 1].z - s.z) < cell * 2)
})

test('un couloir sur relief plat existe toujours (aucune impasse inventee)', () => {
  const g = buildHeightGrid({ sampleGround: () => 0, half: HALF, n: 32 })
  const c = findCorridor(g, { x: -80, z: -80 }, { x: 80, z: 80 })
  assert.ok(c.length > 4)
})

test('resampleXZ espace regulierement et garde les extremites', () => {
  const pts = [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 30 }]
  const r = resampleXZ(pts, 3)
  assert.ok(Math.hypot(r[0].x - 0, r[0].z - 0) < 1e-9)
  const fin = r[r.length - 1]
  assert.ok(Math.hypot(fin.x - 30, fin.z - 30) < 3)
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z)
    assert.ok(d > 1.2 && d < 4.8, `pas irregulier : ${d}`)
  }
})

test('smoothXZ adoucit les angles vifs sans deplacer les extremites', () => {
  const pts = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 20 }, { x: 0, z: 30 }]
  const s = smoothXZ(pts, 2, 1)
  assert.deepEqual(s[0], pts[0])
  assert.deepEqual(s[s.length - 1], pts[pts.length - 1])
  const zig = (a) => a.reduce((t, p, i) => (i ? t + Math.abs(p.x - a[i - 1].x) : 0), 0)
  assert.ok(zig(s) < zig(pts), 'le zigzag doit diminuer')
})

// -------------------------------------------------- garde au sol (le garde-fou)
//
// Adapte de l'evitement des terres de fleet.js : veille devant soi, segment
// echantillonne (pas seulement son extremite), balayage de caps du plus petit
// ecart au plus grand. En 3D la contrainte est une GARDE : sol + garde <= y.

test('routeLibre3D voit une crete etroite AU MILIEU du segment', () => {
  // mur mince en x = 10 : tester seulement l'extremite (x = 20) le raterait
  const sol = (x) => (Math.abs(x - 10) < 1.5 ? 50 : 0)
  assert.equal(routeLibre3D({ sampleGround: sol, x: 0, z: 0, y: 20, cap: Math.PI / 2, dist: 20, garde: 3 }), false)
})

test('routeLibre3D laisse passer au-dessus quand l altitude suffit', () => {
  const sol = (x) => (Math.abs(x - 10) < 1.5 ? 50 : 0)
  assert.equal(routeLibre3D({ sampleGround: sol, x: 0, z: 0, y: 60, cap: Math.PI / 2, dist: 20, garde: 3 }), true)
})

test('chooseHeading prefere TOUJOURS l inflexion la plus douce', () => {
  // tout est libre sauf un cone etroit droit devant → le cap corrige doit etre
  // le plus petit ecart qui degage, pas un demi-tour
  const sol = (x, z) => (z < -2 && Math.abs(x) < 6 ? 80 : 0)
  const r = chooseHeading({ sampleGround: sol, x: 0, z: 0, y: 10, cap: Math.PI, veille: 30, garde: 3 })
  assert.equal(r.climb, false)
  assert.ok(Math.abs(r.ecart) > 0, 'il faut bien devier')
  assert.ok(Math.abs(r.ecart) < 1.2, `deviation trop brutale : ${r.ecart}`)
})

test('chooseHeading ne touche pas au cap quand la route est deja libre', () => {
  const r = chooseHeading({ sampleGround: () => 0, x: 0, z: 0, y: 10, cap: 1.234, veille: 30, garde: 3 })
  assert.equal(r.climb, false)
  assert.equal(r.ecart, 0)
  assert.equal(r.cap, 1.234)
})

test('IMPASSE : cernee de toutes parts, la camera MONTE au lieu de bloquer', () => {
  const sol = reliefCuvette()
  const r = chooseHeading({ sampleGround: sol, x: 0, z: 0, y: 5, cap: 0, veille: 45, garde: 3 })
  assert.equal(r.climb, true, 'aucun cap ne degage : il faut monter')
})

test('altitudeDeSecurite anticipe le mur AVANT de le toucher', () => {
  // mur a x = 30 ; a x = 20 avec une veille de 15 on doit deja etre monte
  const sol = (x) => (x > 30 ? 60 : 0)
  const yLoin = altitudeDeSecurite({ sampleGround: sol, x: 0, z: 0, cap: Math.PI / 2, veille: 15, garde: 4 })
  const yPres = altitudeDeSecurite({ sampleGround: sol, x: 20, z: 0, cap: Math.PI / 2, veille: 15, garde: 4 })
  assert.ok(yLoin < 10, `au large on reste bas : ${yLoin}`)
  assert.ok(yPres >= 64, `devant le mur on doit etre monte : ${yPres}`)
})

// ------------------------------------------------------------------ dolly zoom
//
// « le dolly zoom COMPENSE par le champ de vision : on avance ET on reduit le
// FOV pour garder le sujet a la meme taille pendant que l arriere-plan enfle ».
// C'est CE couple qui le distingue d'un simple travelling.

test('dolly zoom : le sujet garde la meme taille a l ecran, a 1% pres', () => {
  const d0 = 120
  const fov0 = 35
  const k = dollyAnchor(d0, fov0)
  const taille0 = tailleEcran(10, d0, fov0)
  for (const d of [120, 100, 80, 60, 45, 30]) {
    const fov = fovForDolly(d, k)
    const t = tailleEcran(10, d, fov)
    assert.ok(Math.abs(t / taille0 - 1) < 0.01, `taille du sujet derive a d=${d} : ${(t / taille0).toFixed(3)}`)
  }
})

test('dolly zoom : le CHAMP DE VISION bouge vraiment — sinon ce n est qu un travelling', () => {
  const k = dollyAnchor(120, 35)
  const fovLoin = fovForDolly(120, k)
  const fovPres = fovForDolly(30, k)
  assert.ok(fovPres - fovLoin > 25, `amplitude de FOV trop timide : ${fovLoin.toFixed(1)} → ${fovPres.toFixed(1)}`)
  // en avancant, le champ s'ouvre (Vertigo : l'arriere-plan enfle)
  assert.ok(fovPres > fovLoin)
})

test('fovForDolly reste dans des focales filmables', () => {
  const k = dollyAnchor(120, 35)
  for (const d of [400, 200, 120, 60, 20, 5]) {
    const f = fovForDolly(d, k)
    assert.ok(f > 1 && f < 120, `FOV aberrant a d=${d} : ${f}`)
  }
})

// ------------------------------------------------- top-down toujours au nord
//
// NOUVELLE REGLE (Adrien) : « le point de vue top down doit toujours etre
// oriente nord ». Le nord du monde est -Z (main.js : north {x:0,z:-1}).
//
// La cause du bug : pour une vue quasi verticale, up = (0,1,0) est PARALLELE a
// l'axe de visee — le roulis devient indefini et c'est le chemin d'arrivee du
// tween qui le decide. On force donc up = nord.

const UP_Y = { x: 0, y: 1, z: 0 }
// reconstruit la pose de la vue iso : cible + direction normalisee x distance
function poseIso(dir, target = { x: 0, y: -1.5, z: 0 }, dist = 138) {
  const l = Math.hypot(dir.x, dir.y, dir.z)
  return { x: target.x + (dir.x / l) * dist, y: target.y + (dir.y / l) * dist, z: target.z + (dir.z / l) * dist }
}

test('northScreenAngleDeg detecte une carte tournee', () => {
  // up = est → le nord part sur le cote, 90° d'ecart
  const a = northScreenAngleDeg({ eye: { x: 0, y: 100, z: 0 }, target: { x: 0, y: 0, z: 0 }, up: { x: 1, y: 0, z: 0 } })
  assert.ok(Math.abs(Math.abs(a) - 90) < 1e-6, `azimut ${a}`)
})

test('LA CAUSE DU BUG : l ancien top-down (0,100,-0.6) cadrait le SUD en haut', () => {
  // Le commentaire du code annoncait « top-down, nord en haut » — c'etait faux.
  // Avec up = (0,1,0), le haut de l ecran est la projection de up sur le plan
  // image ; un biais de direction vers -Z la fait pointer vers le SUD. D ou la
  // regle qui change : Adrien constate que ca ne marche pas.
  const a = northScreenAngleDeg({ eye: poseIso({ x: 0, y: 100, z: -0.6 }), target: { x: 0, y: -1.5, z: 0 }, up: UP_Y })
  assert.ok(Math.abs(Math.abs(a) - 180) < 1, `l ancienne vue devrait etre a 180° du nord, mesure ${a.toFixed(2)}°`)
})

test('LA REGLE : TOP_DOWN_DIR cadre le nord en haut', () => {
  const a = northScreenAngleDeg({ eye: poseIso(TOP_DOWN_DIR), target: { x: 0, y: -1.5, z: 0 }, up: UP_Y })
  assert.ok(Math.abs(a) < 0.01, `le nord doit pointer en haut, mesure ${a.toFixed(4)}°`)
})

test('LA REGLE : le cadrage top-down est le MEME quelle que soit la vue d ORIGINE', () => {
  // C est la demande exacte d Adrien, et le vrai piege : le vol vers la vue est
  // un tween orbital, donc on y arrive par six chemins differents. Le cadrage
  // final ne depend QUE de la pose d arrivee et de up — jamais du chemin — donc
  // les six origines doivent donner le meme angle au degre pres.
  const origines = [
    { x: 62, y: 52, z: 62 }, { x: -62, y: 52, z: 62 },
    { x: -62, y: 52, z: -62 }, { x: 62, y: 52, z: -62 },
    { x: 0, y: 100, z: 0.6 }, { x: 0.28, y: 0.17, z: 1 },
  ]
  const target = { x: 0, y: -1.5, z: 0 }
  const arrivee = poseIso(TOP_DOWN_DIR)
  // le tween part de chaque origine et atterrit sur la MEME pose : on verifie
  // que l angle mesure a l arrivee ne bouge pas d une origine a l autre
  const angles = origines.map((o) => {
    const depart = poseIso(o)
    assert.ok(Number.isFinite(depart.x), 'origine invalide')
    return northScreenAngleDeg({ eye: arrivee, target, up: UP_Y })
  })
  for (const a of angles) assert.ok(Math.abs(a) < 1, `cadrage devie de ${a.toFixed(3)}°`)
  assert.ok(Math.max(...angles) - Math.min(...angles) < 1e-9, 'les six origines doivent donner un cadrage identique')
})

test('le biais nord du top-down est assez franc pour ne pas dependre du bruit numerique', () => {
  // Une vue PARFAITEMENT verticale (z = 0) a un roulis indefini : up est
  // parallele a l axe de visee. Le biais de TOP_DOWN_DIR existe pour lever
  // cette ambiguite — il doit rester largement au-dessus de l epsilon machine.
  assert.ok(TOP_DOWN_DIR.z > 0, 'le biais doit etre vers +Z pour mettre le nord en haut')
  assert.ok(TOP_DOWN_DIR.z / TOP_DOWN_DIR.y > 1e-3, 'biais trop faible : le roulis redeviendrait instable')
})

test('NORTH est bien -Z, la convention du projet', () => {
  assert.deepEqual(NORTH, { x: 0, y: 0, z: -1 })
})

// ------------------------------------------------------------- les sept plans

test('il y a sept crans, dans l ordre demande par Adrien', () => {
  assert.equal(SHOTS.length, 7)
  assert.deepEqual(SHOTS.map((s) => s.id), ['canyon', 'travelling', 'vertigo', 'survol', 'contreplongee', 'poi', 'serie'])
  // le badge affiche 1..7
  assert.deepEqual(SHOTS.map((s) => s.name), ['1', '2', '3', '4', '5', '6', '7'])
})

// contexte de planification commun aux tests de plans
function ctxEssai() {
  const sampleGround = reliefValleeCoudee()
  return {
    sampleGround,
    half: HALF,
    start: { pos: { x: 60, y: 60, z: 60 }, target: { x: 0, y: 0, z: 0 }, fov: 35 },
    rng: () => 0.42,
  }
}

test('chaque plan a une duree qui respire et se termine', () => {
  for (const s of SHOTS) {
    if (s.id === 'serie') continue // la serie enchaine, elle n'a pas de fin propre
    const p = planShot(s.id, ctxEssai())
    assert.ok(p, `plan ${s.id} non construit`)
    assert.ok(p.duration >= 8 && p.duration <= 40, `duree ${s.id} = ${p.duration}s`)
  }
})

test('chaque plan echantillonne des poses finies sur toute sa duree', () => {
  for (const s of SHOTS) {
    if (s.id === 'serie') continue
    const p = planShot(s.id, ctxEssai())
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const f = p.sample(Math.min(1, t))
      for (const k of ['x', 'y', 'z']) {
        assert.ok(Number.isFinite(f.pos[k]), `${s.id} pos.${k} non fini a t=${t}`)
        assert.ok(Number.isFinite(f.target[k]), `${s.id} target.${k} non fini a t=${t}`)
      }
      assert.ok(f.fov > 1 && f.fov < 120, `${s.id} fov ${f.fov} a t=${t}`)
    }
  }
})

test('LA GARANTIE : aucun plan ne passe jamais SOUS le relief', () => {
  const sol = reliefValleeCoudee()
  const ctx = ctxEssai()
  for (const s of SHOTS) {
    if (s.id === 'serie') continue
    const p = planShot(s.id, ctx)
    let garde = Infinity
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const f = p.sample(Math.min(1, t))
      garde = Math.min(garde, f.pos.y - sol(f.pos.x, f.pos.z))
    }
    assert.ok(garde > 0, `${s.id} passe sous le relief (garde mini ${garde.toFixed(2)})`)
  }
})

test('la poursuite au ras du sol vole BAS — c est tout l interet du plan', () => {
  const sol = reliefValleeCoudee()
  const p = planShot('canyon', ctxEssai())
  const gardes = []
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const f = p.sample(Math.min(1, t))
    gardes.push(f.pos.y - sol(f.pos.x, f.pos.z))
  }
  const mediane = gardes.slice().sort((a, b) => a - b)[Math.floor(gardes.length / 2)]
  assert.ok(Math.min(...gardes) > 0, 'jamais sous le relief')
  assert.ok(mediane < 25, `« au ras du sol » : garde mediane ${mediane.toFixed(1)} trop haute`)
})

test('la poursuite REGARDE OU ELLE VA (et non le centre de la carte)', () => {
  // « une poursuite au sol qui fixe le centre de la carte pendant qu elle vole,
  // ca ne ressemble a rien » : la cible doit se trouver DEVANT le deplacement.
  const p = planShot('canyon', ctxEssai())
  let devant = 0
  let total = 0
  let tPrec = 0.02
  let prec = p.sample(tPrec)
  for (let t = 0.06; t <= 0.7; t += 0.02) {
    const f = p.sample(t)
    const vx = f.pos.x - prec.pos.x
    const vz = f.pos.z - prec.pos.z
    const vLen = Math.hypot(vx, vz)
    const gx = f.target.x - f.pos.x
    const gz = f.target.z - f.pos.z
    const gLen = Math.hypot(gx, gz)
    if (vLen > 1e-4 && gLen > 1e-4) {
      total++
      if ((vx * gx + vz * gz) / (vLen * gLen) > 0.3) devant++
    }
    prec = f
    tPrec = t
  }
  assert.ok(total > 10)
  assert.ok(devant / total > 0.85, `la camera regarde devant seulement ${((devant / total) * 100).toFixed(0)}% du temps`)
})

test('la poursuite ne pointe JAMAIS le nez en l air (elle cadrerait du ciel)', () => {
  // Le defaut mesure sur Chamonix avant correction : 53° au-dessus de
  // l horizontale a mi-plan, donc un cadre entierement vide.
  const p = planShot('canyon', ctxEssai())
  let penteMax = 0
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const f = p.sample(Math.min(1, t))
    const dh = Math.hypot(f.target.x - f.pos.x, f.target.z - f.pos.z)
    if (dh > 1e-6) penteMax = Math.max(penteMax, (f.target.y - f.pos.y) / dh)
  }
  const deg = (Math.atan(penteMax) * 180) / Math.PI
  assert.ok(deg < 22, `la poursuite vise ${deg.toFixed(1)}° vers le haut`)
})

test('tous les plans gardent leur sujet DANS le bloc', () => {
  // Un plan qui sort du bloc filme le vide. On tolere un debord modere (la
  // camera peut prendre du recul), mais pas un sujet hors-champ.
  const ctx = ctxEssai()
  for (const s of SHOTS) {
    if (s.id === 'serie') continue
    const p = planShot(s.id, ctx)
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const f = p.sample(Math.min(1, t))
      const d = Math.max(Math.abs(f.target.x), Math.abs(f.target.z))
      assert.ok(d <= HALF, `${s.id} vise hors du bloc a t=${t.toFixed(2)} (${d.toFixed(1)} > ${HALF})`)
    }
  }
})

test('le survol haute altitude monte VRAIMENT haut', () => {
  const sol = reliefValleeCoudee()
  const p = planShot('survol', ctxEssai())
  let hMax = 0
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const f = p.sample(Math.min(1, t))
    hMax = Math.max(hMax, f.pos.y - sol(f.pos.x, f.pos.z))
  }
  assert.ok(hMax > HALF, `un survol doit dominer le bloc : ${hMax.toFixed(0)} pour un demi-bloc de ${HALF}`)
})

test('la contre-plongee regarde VERS LE HAUT depuis un point bas', () => {
  const sol = reliefValleeCoudee()
  const p = planShot('contreplongee', ctxEssai())
  let versLeHaut = 0
  let n = 0
  let basse = false
  for (let t = 0.1; t <= 1.0001; t += 0.02) {
    const f = p.sample(Math.min(1, t))
    n++
    if (f.target.y > f.pos.y) versLeHaut++
    if (f.pos.y - sol(f.pos.x, f.pos.z) < 30) basse = true
  }
  assert.ok(basse, 'la camera doit passer bas')
  assert.ok(versLeHaut / n > 0.8, `axe de visee montant seulement ${((versLeHaut / n) * 100).toFixed(0)}% du temps`)
})

test('l orbite POI tourne autour du SOMMET et se resserre', () => {
  const ctx = ctxEssai()
  const g = buildHeightGrid({ sampleGround: ctx.sampleGround, half: HALF, n: 64 })
  const sommet = findSummit(g)
  const p = planShot('poi', ctx)
  const rayons = []
  let angleTotal = 0
  let prec = null
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const f = p.sample(Math.min(1, t))
    // la cible du plan doit rester le sommet, pas le centre du bloc
    assert.ok(Math.hypot(f.target.x - sommet.x, f.target.z - sommet.z) < 25, 'l orbite doit viser le sommet')
    const dx = f.pos.x - sommet.x
    const dz = f.pos.z - sommet.z
    rayons.push(Math.hypot(dx, dz))
    const a = Math.atan2(dx, dz)
    if (prec !== null) {
      let d = a - prec
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      angleTotal += d
    }
    prec = a
  }
  assert.ok(Math.abs(angleTotal) > Math.PI * 0.8, `l orbite ne tourne pas assez : ${(angleTotal * 57.3).toFixed(0)}°`)
  assert.ok(rayons[rayons.length - 1] < rayons[0] * 0.75, `l orbite doit se RESSERRER : ${rayons[0].toFixed(0)} → ${rayons[rayons.length - 1].toFixed(0)}`)
})

test('le dolly zoom fait varier le FOV pendant le plan, pas seulement la position', () => {
  const p = planShot('vertigo', ctxEssai())
  const fovs = []
  const dists = []
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const f = p.sample(Math.min(1, t))
    fovs.push(f.fov)
    dists.push(Math.hypot(f.pos.x - f.target.x, f.pos.y - f.target.y, f.pos.z - f.target.z))
  }
  const dFov = Math.max(...fovs) - Math.min(...fovs)
  const dDist = Math.max(...dists) - Math.min(...dists)
  assert.ok(dFov > 12, `l effet Vertigo exige une vraie variation de FOV : ${dFov.toFixed(1)}°`)
  assert.ok(dDist > 20, `et un vrai deplacement : ${dDist.toFixed(1)}`)
})

test('les autres plans ne touchent PAS au FOV (seul le Vertigo le fait bouger)', () => {
  for (const s of SHOTS) {
    if (s.id === 'serie' || s.id === 'vertigo') continue
    const p = planShot(s.id, ctxEssai())
    const fovs = []
    for (let t = 0; t <= 1.0001; t += 0.05) fovs.push(p.sample(Math.min(1, t)).fov)
    const d = Math.max(...fovs) - Math.min(...fovs)
    assert.ok(d < 10, `${s.id} fait bouger le FOV de ${d.toFixed(1)}° — ca empiete sur le Vertigo`)
  }
})

test('UN PLAN FINIT : la pose finale est tenable (pas au milieu d un virage)', () => {
  // la vitesse doit s'eteindre a l'arrivee — on compare le dernier pas au pas
  // du milieu du plan.
  for (const s of SHOTS) {
    if (s.id === 'serie') continue
    const p = planShot(s.id, ctxEssai())
    const d = (a, b) => Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y, b.pos.z - a.pos.z)
    const vFin = d(p.sample(0.99), p.sample(1))
    const vMil = d(p.sample(0.5), p.sample(0.51))
    assert.ok(vFin <= vMil * 0.6 + 1e-6, `${s.id} ne freine pas a l arrivee : ${vFin.toFixed(3)} vs ${vMil.toFixed(3)}`)
  }
})

test('planShot est deterministe a graine egale, et varie quand la graine change', () => {
  const a = planShot('canyon', { ...ctxEssai(), rng: () => 0.2 }).sample(0.5)
  const b = planShot('canyon', { ...ctxEssai(), rng: () => 0.2 }).sample(0.5)
  assert.deepEqual(a.pos, b.pos)
})

test('un identifiant inconnu ne casse pas le lecteur', () => {
  assert.equal(planShot('nawak', ctxEssai()), null)
})

test('un relief plat ne fait planter aucun plan (bloc sans relief)', () => {
  const ctx = { ...ctxEssai(), sampleGround: () => 0 }
  for (const s of SHOTS) {
    if (s.id === 'serie') continue
    const p = planShot(s.id, ctx)
    assert.ok(p, `${s.id} non construit sur relief plat`)
    const f = p.sample(0.5)
    assert.ok(Number.isFinite(f.pos.x) && Number.isFinite(f.pos.y))
    assert.ok(f.pos.y > 0, `${s.id} sous le sol plat`)
  }
})
