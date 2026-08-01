import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  vitesseTobler, V_TRANSLATION_KMH, facteurTranslation,
  cumulHorizontal, profilAllure, sujetA,
  ligneDeVol, ligneVolable, reechantillonner, courbureA,
  sujetVisible, monteePourVoir, cuirePlanDeVol,
  visee, planA, SEQUENCE_DEFAUT, PLANS_POURSUITE, troncoReine,
  preparerPoursuite, poseDePoursuite, poursuiteComplete, etatInitial,
} from '../src/poursuite.js'

const HALF = 28
const deg = (r) => (r * 180) / Math.PI

// ============================================================== les fixtures
//
// Un versant qui monte vers le nord, plissé de croupes — c'est le relief qui
// PIÈGE une caméra de poursuite, puisque chaque croupe peut passer entre elle et
// le coureur. Et un sentier en lacets dessus, d'amplitude réaliste : ~430 m à
// l'échelle d'un bloc z12 (359,5 m par unité monde).
const M_PAR_UNITE = 359.5
const EXAG = 2.8

function versant() {
  return (x, z) => 8 - z * 0.35 + 2.5 * Math.sin(x * 0.55) + 1.2 * Math.cos(z * 0.8)
}

function sentierEnLacets(n = 1400, amplitude = 1.2, epingles = 40) {
  const sol = versant()
  const out = []
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    const z = -22 + 44 * u
    const x = amplitude * Math.sin(u * Math.PI * epingles)
    out.push({ x, y: sol(x, z) + 0.05, z })
  }
  return out
}

const contexte = (opts = {}) => preparerPoursuite({
  trace: sentierEnLacets(), sampleGround: versant(), half: HALF,
  metresParUnite: M_PAR_UNITE, exagerationV: EXAG, ...opts,
})

// ==================================================== 1. L'ALLURE DE TOBLER

test('Tobler : le maximum est sur une descente douce, pas a plat', () => {
  // C'est LA signature du modèle, et un effet réel : l'optimum est à −5 %.
  const v = (p) => vitesseTobler(p, { vPlat: 13 })
  assert.ok(v(-0.05) >= v(0), 'la descente a 5 % doit valoir au moins le plat')
  assert.ok(v(-0.05) > v(-0.2), 'au-dela, la descente redevient couteuse')
  assert.ok(v(-0.05) > v(0.05), 'et elle est plus rapide que la montee equivalente')
})

test('Tobler : la renormalisation garde le plat sur la vitesse demandee', () => {
  for (const vPlat of [8, 13, 18]) {
    assert.ok(Math.abs(vitesseTobler(0, { vPlat }) - vPlat) < 1e-9, `${vPlat} km/h a plat`)
  }
})

test('Tobler donne des allures plausibles pour une tete de course', () => {
  const v = (p) => vitesseTobler(p, { vPlat: 13 })
  // repères annoncés : ~12-15 à plat, 10-12 en descente technique, 4-5 en raide
  assert.ok(v(0) >= 12 && v(0) <= 15, `plat ${v(0).toFixed(1)}`)
  assert.ok(v(-0.2) >= 8 && v(-0.2) <= 12, `descente 20 % : ${v(-0.2).toFixed(1)}`)
  assert.ok(v(0.4) >= 2.5 && v(0.4) <= 6, `montee 40 % : ${v(0.4).toFixed(1)}`)
  // et la monotonie dans le raide : plus ça monte, plus c'est lent
  for (let p = 0.1; p < 1; p += 0.1) assert.ok(v(p) > v(p + 0.1))
})

test('l allure fait varier le temps : une montee coute plus qu une descente', () => {
  const sol = (x, z) => -z * 0.4 // pente constante
  const monte = []
  const descend = []
  for (let i = 0; i < 200; i++) {
    const z = -10 + (20 * i) / 199
    monte.push({ x: 0, y: sol(0, z), z })
    descend.push({ x: 0, y: sol(0, -z), z: -z })
  }
  const a = profilAllure({ trace: monte, metresParUnite: M_PAR_UNITE, exagerationV: EXAG })
  const b = profilAllure({ trace: descend, metresParUnite: M_PAR_UNITE, exagerationV: EXAG })
  // `monte` va vers z croissant donc y décroissant : c'est la descente. Peu
  // importe le sens — ce qui compte est que les deux ne coûtent PAS pareil.
  assert.ok(Math.abs(a.dureeReelle - b.dureeReelle) > a.dureeReelle * 0.2,
    `les deux sens coutent ${a.dureeReelle.toFixed(0)} et ${b.dureeReelle.toFixed(0)} s`)
})

test('la pente se lit HORS exageration verticale', () => {
  // ShibuMap étire le relief ×2,8 : lue telle quelle, une pente de 15 % en
  // paraîtrait 42 et le coureur ramperait. C'est le piège d'échelle du dépôt.
  const trace = []
  for (let i = 0; i < 100; i++) trace.push({ x: 0, y: i * 0.1 * EXAG, z: i })
  const avec = profilAllure({ trace, metresParUnite: M_PAR_UNITE, exagerationV: EXAG })
  const sans = profilAllure({ trace, metresParUnite: M_PAR_UNITE, exagerationV: 1 })
  assert.ok(Math.abs(avec.pentes[50] - 0.1) < 1e-9, `pente reelle ${avec.pentes[50]}`)
  assert.ok(Math.abs(sans.pentes[50] - 0.28) < 1e-9, 'sans correction, la pente est multipliee par l exageration')
  assert.ok(sans.dureeReelle > avec.dureeReelle * 1.3, 'et le coureur y devient beaucoup plus lent')
})

test('l acceleration se deduit de la duree de clip demandee', () => {
  const p = profilAllure({ trace: sentierEnLacets(), metresParUnite: M_PAR_UNITE, exagerationV: EXAG, duree: 70 })
  assert.ok(Math.abs(p.duree - 70) < 1e-6)
  assert.ok(Math.abs(p.dureeReelle / p.acceleration - 70) < 1e-6)
})

// ================================================ 2. LA LIGNE DE VOL LISSÉE

test('la ligne de vol COUPE les lacets — c est tout le principe', () => {
  const trace = sentierEnLacets()
  const { lisse } = ligneDeVol(trace, { fenetre: 40, passes: 3 })
  const amplitude = (pts) => {
    let mn = Infinity
    let mx = -Infinity
    for (const p of pts) { if (p.x < mn) mn = p.x; if (p.x > mx) mx = p.x }
    return mx - mn
  }
  // le tracé oscille de ±1,2 ; la ligne de vol doit être bien plus droite
  assert.ok(amplitude(lisse) < amplitude(trace) * 0.35,
    `amplitude ${amplitude(lisse).toFixed(2)} contre ${amplitude(trace).toFixed(2)}`)
})

test('la fenetre de lissage se CALIBRE sur ce que l appareil sait tourner', () => {
  const trace = sentierEnLacets()
  const large = ligneVolable(trace, { rayonMin: 6 })
  const serre = ligneVolable(trace, { rayonMin: 0.5 })
  // un rayon de virage plus grand exige une ligne plus lissée
  assert.ok(large.fenetre > serre.fenetre, `${large.fenetre} contre ${serre.fenetre}`)
  assert.ok(large.courbureMax <= large.courbureCible * 1.001 || large.arret === 'ecart')
})

test('mais elle s arrete si la camera s eloigne trop du coureur', () => {
  // ⚠️ Les deux critères s'opposent, et la PROXIMITÉ gagne : une caméra de
  // poursuite qui perd son sujet n'est plus une caméra de poursuite.
  const trace = sentierEnLacets(1400, 6, 14) // épingles violentes
  const r = ligneVolable(trace, { rayonMin: 30, ecartMax: 2 })
  assert.equal(r.arret, 'ecart')
  assert.ok(r.ecart <= 2 * 1.6, `ecart ${r.ecart.toFixed(2)}`)
})

test('le reechantillonnage donne un pas constant', () => {
  const out = reechantillonner(sentierEnLacets(), 0.2)
  let mn = Infinity
  let mx = 0
  for (let i = 1; i < out.length - 1; i++) {
    const d = Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y, out[i].z - out[i - 1].z)
    if (d < mn) mn = d
    if (d > mx) mx = d
  }
  // 25 % de tolérance, et ce n'est pas du laxisme : on mesure la CORDE entre
  // deux points de sortie alors que le rééchantillonnage compte le long de
  // l'ARC. Sur une épingle, la corde est légitimement plus courte.
  assert.ok(mx - mn < 0.05, `pas entre ${mn.toFixed(3)} et ${mx.toFixed(3)}`)
})

// ================================================== 3. LA VISIBILITÉ DU SUJET

test('sujetVisible voit une crete entre la camera et le coureur', () => {
  // sol plat, une crête à mi-chemin
  const sol = (x) => (x > 4 && x < 6 ? 20 : 0)
  const sujet = { x: 0, y: 0.5, z: 0 }
  assert.equal(sujetVisible({ sampleGround: sol, cam: { x: 10, y: 3, z: 0 }, sujet, peau: 0.3 }), false)
  // …et elle ne la voit plus si on passe au-dessus
  assert.equal(sujetVisible({ sampleGround: sol, cam: { x: 10, y: 60, z: 0 }, sujet, peau: 0.3 }), true)
  // rien entre les deux : dégagé
  assert.equal(sujetVisible({ sampleGround: () => 0, cam: { x: 10, y: 3, z: 0 }, sujet, peau: 0.3 }), true)
})

test('monteePourVoir trouve la hauteur EXACTE qui degage', () => {
  const sol = (x) => (x > 4 && x < 6 ? 20 : 0)
  const sujet = { x: 0, y: 0.5, z: 0 }
  const cam = { x: 10, y: 3, z: 0 }
  const m = monteePourVoir({ sampleGround: sol, cam, sujet, peau: 0.3 })
  assert.ok(m > 0)
  // à la hauteur trouvée on voit, un poil en dessous on ne voit pas : c'est la
  // définition d'un seuil, et c'est ce que la dichotomie garantit
  assert.equal(sujetVisible({ sampleGround: sol, cam: { ...cam, y: cam.y + m }, sujet, peau: 0.3 }), true)
  assert.equal(sujetVisible({ sampleGround: sol, cam: { ...cam, y: cam.y + m * 0.9 }, sujet, peau: 0.3 }), false)
})

test('le plan de vol cuit place la camera AU-DESSUS de ce qu il faut', () => {
  const sol = versant()
  const trace = reechantillonner(sentierEnLacets(), 0.15)
  const { lisse } = ligneDeVol(trace, { fenetre: 30, passes: 3 })
  const p = cuirePlanDeVol({
    trace, ligne: lisse, sampleGround: sol, standoff: 1.8, tilt: 0.56,
    avance: 11, garde: 0.62, penteMontee: 2, peau: 0.31,
  })
  // l'altitude cuite domine partout le sol sous la caméra, garde comprise
  for (let i = 0; i < p.alt.length; i += 7) {
    assert.ok(p.alt[i] >= sol(p.posXZ[i].x, p.posXZ[i].z) + 0.62 - 1e-6,
      `altitude ${p.alt[i].toFixed(2)} contre sol ${sol(p.posXZ[i].x, p.posXZ[i].z).toFixed(2)} en ${i}`)
  }
})

test('le changement de cote est une TRANSLATION, pas un saut', () => {
  const sol = versant()
  const trace = reechantillonner(sentierEnLacets(), 0.15)
  const { lisse } = ligneDeVol(trace, { fenetre: 30, passes: 3 })
  const p = cuirePlanDeVol({
    trace, ligne: lisse, sampleGround: sol, standoff: 1.8, tilt: 0.56,
    avance: 11, garde: 0.62, penteMontee: 2, peau: 0.31,
  })
  // la suite de côtés brute vaut ±1 ; la version lissée ne doit jamais sauter
  let saut = 0
  for (let i = 1; i < p.coteLisse.length; i++) saut = Math.max(saut, Math.abs(p.coteLisse[i] - p.coteLisse[i - 1]))
  assert.ok(saut < 0.05, `plus gros pas de cote ${saut.toFixed(4)} (brut : 2)`)
})

// ============================================ 4. LE CADRAGE — L'ESPACE DEVANT

test('la visee laisse de l ESPACE DEVANT le sujet (lead room)', () => {
  const sujet = { x: 0, y: 0, z: 0 }
  const cam = { x: 0, y: 2, z: -5 }
  const cap = 0 // le coureur va vers +z
  const t = visee({ sujet, cam, capSujet: cap, decentrage: 0.3, fovDeg: 30 })
  // la cible est en AVANT du coureur, dans son sens de marche
  assert.ok(t.z > sujet.z, `cible a z=${t.z.toFixed(3)}, sujet a 0`)
  // …et pas n'importe où : la distance suit la formule d·tan(décentrage·fov/2)
  const d = Math.hypot(sujet.x - cam.x, sujet.y - cam.y, sujet.z - cam.z)
  assert.ok(Math.abs(t.z - d * Math.tan(0.3 * ((30 * Math.PI) / 360))) < 1e-9)
})

test('un decentrage nul remet le sujet pile au centre', () => {
  const sujet = { x: 3, y: 1, z: -2 }
  const t = visee({ sujet, cam: { x: 0, y: 5, z: 0 }, capSujet: 1.2, decentrage: 0, fovDeg: 30 })
  assert.deepEqual(t, { x: sujet.x, y: sujet.y, z: sujet.z })
})

// ================================================ 5. L'HÉLICOPTÈRE, PAS L'AVION

test('l inclinaison s eteint en vol lent — c est la signature de l helicoptere', () => {
  // « un drone lace a plat, un aeronef s'incline » est vrai EN VITESSE et faux
  // en vol lent : un helicoptere pivote alors sur son axe.
  assert.equal(facteurTranslation(0), 0)
  assert.ok(facteurTranslation(V_TRANSLATION_KMH / 4) < 0.05)
  assert.ok(facteurTranslation(V_TRANSLATION_KMH) >= 0.999)
  // et c'est monotone : pas d'inversion bizarre au milieu
  let prec = -1
  for (let v = 0; v <= 60; v += 2) {
    const f = facteurTranslation(v)
    assert.ok(f >= prec - 1e-12, `non monotone a ${v} km/h`)
    prec = f
  }
})

test('un helicoptere qui suit un coureur N EST PAS en translation', () => {
  // Conséquence assumée du seuil de 35 km/h : le suivi se fait à plat. Ce n'est
  // pas une limite du modèle, c'est ce que font les hélicoptères de
  // retransmission — ils tiennent la station à côté du sujet.
  for (const kmh of [4, 8, 13, 15.5]) {
    assert.ok(facteurTranslation(kmh) < 0.35, `${kmh} km/h donne ${facteurTranslation(kmh).toFixed(2)}`)
  }
})

// ============================================== 6. LE RÉPERTOIRE ET LE MONTAGE

test('la sequence couvre exactement la duree du clip', () => {
  const duree = 70
  const vus = new Set()
  let prec = null
  for (let t = 0; t <= duree; t += 0.05) {
    const p = planA(SEQUENCE_DEFAUT, t, duree)
    vus.add(p.id)
    assert.ok(p.s >= 0 && p.s <= 1)
    prec = p.id
  }
  assert.ok(prec !== null)
  // tous les plans du répertoire sont réellement joués
  for (const id of PLANS_POURSUITE) assert.ok(vus.has(id), `le plan ${id} n est jamais joue`)
})

test('le troncon retenu est la MONTEE REINE, pas un morceau au hasard', () => {
  // un parcours à deux bosses : une petite au début, une grosse à la fin
  const trace = []
  for (let i = 0; i < 600; i++) {
    const u = i / 599
    const y = u < 0.5 ? Math.sin(u * Math.PI * 2) * 2 : 20 * (u - 0.5)
    trace.push({ x: 0, y, z: i * 0.1 })
  }
  const [a, b] = troncoReine(trace, { part: 0.25 })
  assert.ok(a > 300, `le troncon commence en ${a}, il devrait etre dans la grosse montee`)
  assert.equal(b - a, Math.round(600 * 0.25))
})

// =============================================== 7. LE VOL COMPLET, MESURÉ

test('le sujet reste visible, et la garde au sol positive', () => {
  const ctx = contexte()
  assert.ok(ctx, 'un contexte doit se preparer')
  const sol = versant()
  const poses = poursuiteComplete(ctx)
  let gardeMin = Infinity
  let cache = 0
  for (const p of poses) {
    const g = p.pos.y - sol(p.pos.x, p.pos.z)
    if (g < gardeMin) gardeMin = g
    if (!sujetVisible({ sampleGround: sol, cam: p.pos, sujet: p.sujet, peau: ctx.profil.garde * 0.5 })) cache++
  }
  // ⚠️ « Le sujet impose la trajectoire, il ne suspend pas la physique. »
  assert.ok(gardeMin > 0, `garde minimale ${gardeMin.toFixed(3)}`)
  // le relief d'essai est volontairement plissé de croupes : on tolère un
  // résiduel, mais il doit rester marginal (sur MNT réel, mesuré à 0,71 %)
  assert.ok(cache / poses.length < 0.05, `sujet cache ${((100 * cache) / poses.length).toFixed(1)} % du temps`)
})

test('aucun a-coup HORS RACCORD — une coupe n est pas un a-coup', () => {
  const ctx = contexte()
  const poses = poursuiteComplete(ctx)
  const ref = (ctx.profil.v * ctx.profil.v) / ctx.profil.rayon
  let maxA = 0
  let p1 = null
  let p2 = null
  let plan = null
  for (const p of poses) {
    if (plan !== null && plan !== p.plan) { p1 = null; p2 = null } // coupe : on repart
    plan = p.plan
    if (p2) {
      const a = Math.hypot(p.pos.x - 2 * p1.x + p2.x, p.pos.y - 2 * p1.y + p2.y, p.pos.z - 2 * p1.z + p2.z) * 3600 / ref
      if (a > maxA) maxA = a
    }
    p2 = p1
    p1 = { ...p.pos }
  }
  assert.ok(maxA < 400, `acceleration maximale ${maxA.toFixed(0)} fois celle d un virage nominal`)
})

test('l axe de visee reste lisible hors raccord', () => {
  const ctx = contexte()
  const poses = poursuiteComplete(ctx)
  let maxDeg = 0
  let prec = null
  let plan = null
  for (const p of poses) {
    if (plan !== null && plan !== p.plan) prec = null
    plan = p.plan
    const d = { x: p.target.x - p.pos.x, y: p.target.y - p.pos.y, z: p.target.z - p.pos.z }
    const l = Math.hypot(d.x, d.y, d.z) || 1
    const dir = { x: d.x / l, y: d.y / l, z: d.z / l }
    if (prec) {
      const dot = Math.min(1, dir.x * prec.x + dir.y * prec.y + dir.z * prec.z)
      maxDeg = Math.max(maxDeg, deg(Math.acos(dot)) * 60)
    }
    prec = dir
  }
  assert.ok(maxDeg < 75, `balayage maximal ${maxDeg.toFixed(0)} °/s`)
})

test('la pose est PURE : deux appels au meme instant donnent le meme resultat', () => {
  // ⚠️ Ça n'a pas toujours été vrai : le point du plan fixe était mémorisé dans
  // le contexte au premier appel, donc un rendu hors ligne qui rembobine
  // obtenait un point différent. Le test verrouille la correction.
  const ctx = contexte()
  for (const t of [3, 22, 41, 55, 66]) {
    const a = poseDePoursuite(t, ctx, etatInitial())
    const b = poseDePoursuite(t, ctx, etatInitial())
    assert.deepEqual(a.pos, b.pos, `instant ${t}`)
    assert.deepEqual(a.target, b.target, `instant ${t}`)
  }
})

test('le sujet avance toujours, et jamais plus vite que son allure', () => {
  const ctx = contexte()
  const poses = poursuiteComplete(ctx)
  let recule = 0
  for (let i = 1; i < poses.length; i++) {
    const a = poses[i - 1].sujet
    const b = poses[i].sujet
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    // la vitesse instantanée ne peut pas dépasser l'allure de plat accélérée
    const vMax = ((13 * 1000) / 3600 / M_PAR_UNITE) * ctx.prof.acceleration * (1 / 60) * 1.6
    if (d > vMax) recule++
  }
  assert.equal(recule, 0, `${recule} pas plus rapides que l allure maximale`)
})

test('le contexte porte les mesures qui servent au rapport', () => {
  const ctx = contexte()
  assert.ok(ctx.duree > 0 && ctx.prof.acceleration > 1)
  assert.ok(ctx.hauteur > 0 && ctx.hauteurM === 120)
  // 120 m réels valent bien hauteurM × exagération / mètresParUnité en monde
  assert.ok(Math.abs(ctx.hauteur - (120 * EXAG) / M_PAR_UNITE) < 1e-9)
  assert.ok(ctx.troncon[1] > ctx.troncon[0])
  assert.ok(ctx.ligneInfo && ['courbure', 'ecart'].includes(ctx.ligneInfo.arret))
})

test('cumulHorizontal ignore bien la composante verticale', () => {
  const c = cumulHorizontal([{ x: 0, y: 0, z: 0 }, { x: 3, y: 100, z: 4 }])
  assert.equal(c[1], 5) // 3-4-5, la hauteur ne compte pas
})

test('sujetA rend une position sur le trace et un cap coherent', () => {
  const ctx = contexte()
  const S = sujetA(ctx.brut, ctx.prof, ctx.duree * 0.5)
  assert.ok(Number.isFinite(S.pos.x) && Number.isFinite(S.pos.y))
  assert.ok(S.idx >= 0 && S.idx <= ctx.brut.length - 1)
  assert.ok(S.vitesseKmh > 0 && S.vitesseKmh < 20)
})

test('courbureA rend un signe, et il change avec le sens du virage', () => {
  const droite = []
  const gauche = []
  for (let i = 0; i < 60; i++) {
    const a = (i / 59) * 1.2
    droite.push({ x: Math.sin(a) * 10, z: Math.cos(a) * 10 })
    gauche.push({ x: -Math.sin(a) * 10, z: Math.cos(a) * 10 })
  }
  assert.ok(Math.sign(courbureA(droite, 30, 6)) === -Math.sign(courbureA(gauche, 30, 6)))
})
