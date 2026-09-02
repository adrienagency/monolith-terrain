// ON ATTRAPE LA TERRE — règle D19, Tâche R32. La loi pure, et sa convergence
// sur une vraie projection.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pointSousLeRayon,
  latLonDe,
  vecteurDe,
  poseNadir,
  roulisDe,
  pointSousLePixel,
  pasDeSaisie,
  deplacementDeSaisie,
  elanDeSaisie,
  enroulerLon,
  PLAFOND_PAS_DEG,
  PLAFOND_LIMBE_DEG,
  TAU_ELAN_S,
  ITERATIONS_SAISIE,
  LAT_MAX_DEG,
} from '../src/monde/saisie-terre.js'

const D2R = Math.PI / 180
const ECRAN = { fovDeg: 33, aspect: 1.6, largeurPx: 1280, hauteurPx: 800 }
// altitudes en unités-globe (1 u = 63,71 km) : 50 km, 130 km, 2 000 km, 60 000 km
const ALTS = { '50 km': 50 / 63.71, '130 km': 130 / 63.71, '2 000 km': 2000 / 63.71, '60 000 km': 60000 / 63.71 }

// la projection d'un point de la sphère par une pose, en pixels — l'inverse de `pointSousLePixel`
function projette(pose, v, { fovDeg, aspect, largeurPx, hauteurPx }) {
  const R = 100
  const d = [v[0] * R - pose.position[0], v[1] * R - pose.position[1], v[2] * R - pose.position[2]]
  const z = d[0] * pose.avant[0] + d[1] * pose.avant[1] + d[2] * pose.avant[2]
  const x = d[0] * pose.droite[0] + d[1] * pose.droite[1] + d[2] * pose.droite[2]
  const y = d[0] * pose.haut[0] + d[1] * pose.haut[1] + d[2] * pose.haut[2]
  const t = Math.tan((fovDeg / 2) * D2R)
  return [((x / z / (t * aspect)) * 0.5 + 0.5) * largeurPx, ((-y / z / t) * 0.5 + 0.5) * hauteurPx]
}

// ══════════ ① LE RAYON ET LA SPHÈRE ════════════════════════════════════════

test('① un rayon qui touche rend le point d’entrée, unitaire, et pas le limbe', () => {
  const r = pointSousLeRayon({ origine: [0, 0, 300], direction: [0, 0, -1] })
  assert.ok(r && !r.limbe)
  assert.ok(Math.hypot(r.point[0], r.point[1], r.point[2] - 1) < 1e-12, 'le point d’entrée est (0,0,1)')
})

test('① bis un rayon qui rate rend le point du LIMBE le plus proche — le geste de Google Earth passé le disque', () => {
  // depuis (0,0,300), la direction (0,6 · 0 · −0,8) passe à 180 unités du centre
  const r = pointSousLeRayon({ origine: [0, 0, 300], direction: [0.6, 0, -0.8] })
  assert.ok(r && r.limbe)
  assert.ok(Math.abs(r.point[0] - 0.8) < 1e-12 && Math.abs(r.point[2] - 0.6) < 1e-12)
})

test('① ter la sphère derrière la caméra, ou une entrée molle, rend null', () => {
  assert.equal(pointSousLeRayon({ origine: [0, 0, 300], direction: [0, 0, 1] }), null)
  assert.equal(pointSousLeRayon({ origine: [0, 0, 300], direction: [0, 0, 0] }), null)
  assert.equal(pointSousLeRayon({ origine: [NaN, 0, 300], direction: [0, 0, -1] }), null)
  assert.equal(pointSousLeRayon(), null)
})

// ══════════ ② LA CONVENTION DE `geo.js` ════════════════════════════════════

test('② pôle nord +Y, longitude 0 vers +Z, 90°E vers +X — et l’aller-retour est exact', () => {
  const p = (v, w) => assert.ok(Math.hypot(v[0] - w[0], v[1] - w[1], v[2] - w[2]) < 1e-12, `${v} ≠ ${w}`)
  p(vecteurDe(0, 0), [0, 0, 1]); p(vecteurDe(0, 90), [1, 0, 0]); p(vecteurDe(90, 0), [0, 1, 0])
  for (const [lat, lon] of [[-21.13, 55.53], [45.83, 6.86], [78.65, 15.4], [-33.9, 151.2], [0, 179.9]]) {
    const ll = latLonDe(vecteurDe(lat, lon))
    assert.ok(Math.abs(ll.lat - lat) < 1e-9 && Math.abs(ll.lon - lon) < 1e-9, `${lat}, ${lon} → ${ll.lat}, ${ll.lon}`)
  }
  assert.equal(latLonDe([0, 0, 0]), null)
})

test('② bis enroulerLon replie sur ]−180, 180]', () => {
  assert.equal(enroulerLon(358), -2); assert.equal(enroulerLon(-358), 2)
  assert.equal(enroulerLon(180), 180); assert.equal(enroulerLon(-180), 180)
  assert.equal(enroulerLon(NaN), 0)
})

test('② ter la pose au nadir a le nord en haut, l’est à droite, et le roulis se relit', () => {
  const pose = poseNadir({ sousCamera: { lat: -21.13, lon: 55.53 }, hauteur: 2 })
  // regarder vers le centre
  const up = vecteurDe(-21.13, 55.53)
  assert.ok(Math.hypot(pose.avant[0] + up[0], pose.avant[1] + up[1], pose.avant[2] + up[2]) < 1e-12)
  // le haut de l'écran pointe vers le nord : sa composante +Y est positive, et il est ⊥ up
  assert.ok(pose.haut[1] > 0 && Math.abs(pose.haut[0] * up[0] + pose.haut[1] * up[1] + pose.haut[2] * up[2]) < 1e-12)
  // la droite de l'écran est l'est : à lon 55,53°, +x tourné — on vérifie par le point projeté
  const est = latLonDe(vecteurDe(-21.13, 55.53 + 0.01))
  const px = projette(pose, vecteurDe(est.lat, est.lon), ECRAN)
  // (le parallèle s'incurve d'un millième de pixel par rapport à la tangente est : c'est la sphère)
  assert.ok(px[0] > 640 && Math.abs(px[1] - 400) < 0.01, `un point à l’est se projette à ${px}`)
  assert.ok(Math.abs(roulisDe(pose)) < 1e-9)
  for (const r of [-120, -30, 12.5, 90, 170]) {
    const p = poseNadir({ sousCamera: { lat: 30, lon: -70 }, hauteur: 5, roulisDeg: r })
    assert.ok(Math.abs(roulisDe(p) - r) < 1e-9, `roulis ${r} relu ${roulisDe(p)}`)
  }
  assert.equal(poseNadir({ sousCamera: { lat: 90, lon: 0 }, hauteur: 5 }), null, 'au pôle, le nord en haut n’a pas de sens')
})

// ══════════ ③ LE PAS DE SAISIE ═════════════════════════════════════════════

test('③ le point saisi sous le pointeur : aucun pas', () => {
  const p = pasDeSaisie({ saisi: { lat: 10, lon: 20 }, sous: { lat: 10, lon: 20 } })
  assert.deepEqual(p, { dLat: 0, dLon: 0, plafonne: false })
})

test('③ bis la caméra va VERS le point saisi — `S′ = S + (G − D)`', () => {
  // le pointeur a bougé vers l'ouest : le point sous lui (D) est à l'ouest de G.
  // Pour ramener G sous le pointeur, la caméra doit aller à l'EST (dLon > 0).
  const p = pasDeSaisie({ saisi: { lat: 0, lon: 10 }, sous: { lat: 0, lon: 8 } })
  assert.ok(Math.abs(p.dLon - 2) < 1e-12 && p.dLat === 0)
  // et à travers l'antiméridien, le chemin court
  const q = pasDeSaisie({ saisi: { lat: 0, lon: 179 }, sous: { lat: 0, lon: -179 } })
  assert.ok(Math.abs(q.dLon + 2) < 1e-12, `dLon ${q.dLon} : 358° au lieu de −2°`)
})

test('③ ter le pas est PLAFONNÉ en angle d’arc, direction conservée', () => {
  const p = pasDeSaisie({ saisi: { lat: 0, lon: 90 }, sous: { lat: 0, lon: 0 } })
  assert.equal(p.plafonne, true)
  assert.ok(Math.abs(p.dLon - PLAFOND_PAS_DEG) < 1e-12 && p.dLat === 0)
  // en latitude haute, la longitude pèse au cosinus : 40° de lon à 60° de lat font 20° d'arc
  const q = pasDeSaisie({ saisi: { lat: 60, lon: 40 }, sous: { lat: 60, lon: 0 } })
  assert.equal(q.plafonne, false, '20° d’arc tiennent sous le plafond de 30°')
  assert.ok(Math.abs(q.dLon - 40) < 1e-12)
})

test('③ quater une entrée molle ne déplace rien', () => {
  for (const a of [undefined, {}, { saisi: { lat: NaN, lon: 0 }, sous: { lat: 0, lon: 0 } }, { saisi: { lat: 0, lon: 0 } }]) {
    assert.deepEqual(pasDeSaisie(a), { dLat: 0, dLon: 0, plafonne: false })
  }
  assert.deepEqual(deplacementDeSaisie(), { dLat: 0, dLon: 0, plafonne: false, iterations: 0, limbe: false, residuDeg: 0 })
})

// ══════════ ④ L'ÉLAN ═══════════════════════════════════════════════════════

test('④ l’élan décroît en exp(−dt/τ), son pas est l’intégrale exacte, et il finit', () => {
  let v = { dLat: 0, dLon: 30 } // 30 °/s au relâché
  let total = 0, n = 0
  for (; n < 600; n++) {
    const r = elanDeSaisie({ vitesse: v, dt: 1 / 60 })
    total += r.pas.dLon
    v = r.vitesse
    if (r.fini) break
  }
  assert.ok(n < 600, 'l’élan ne finit jamais')
  // ∫₀^∞ 30·exp(−t/τ) = 30·τ = 10,5° — à la troncature près
  assert.ok(Math.abs(total - 30 * TAU_ELAN_S) < 0.05, `course totale ${total}° pour ${30 * TAU_ELAN_S} attendus`)
  assert.ok(n > 60 && n < 240, `${n} images : l’élan doit durer entre 1 et 4 s`)
  assert.deepEqual(elanDeSaisie({ vitesse: { dLat: 0, dLon: 0 }, dt: 1 / 60 }).fini, true)
  assert.deepEqual(elanDeSaisie({ vitesse: { dLat: NaN, dLon: 0 }, dt: 1 / 60 }).pas, { dLat: 0, dLon: 0 })
})

// ══════════ ⑤ LA CONVERGENCE, SUR UNE VRAIE PROJECTION ═════════════════════
//
// Une caméra au nadir, nord en haut, à `h` unités au-dessus de `S`, projection
// en trou d'épingle (fov 33°, 1280 × 800). On saisit `G` au pixel `p0`, on
// déplace le pointeur en `p1`, et UNE image de `deplacementDeSaisie` doit
// ramener `G` sous `p1`.

// une ou plusieurs IMAGES de saisie : à chaque image, la pose réelle est celle
// que l'image précédente a posée — exactement ce que fait `main.js`
function saisie({ S, h, p0, p1, roulis = 0, images = 1 }) {
  let pose = poseNadir({ sousCamera: S, hauteur: h, roulisDeg: roulis })
  const G = latLonDe(pointSousLePixel({ pose, ...ECRAN, px: p0[0], py: p0[1] }).point)
  let s = { ...S }, d = null, residuPx = Infinity, n = 0
  for (; n < images; n++) {
    d = deplacementDeSaisie({ saisi: G, sousCamera: s, hauteur: h, poseReelle: pose, ...ECRAN, px: p1[0], py: p1[1] })
    s = { lat: s.lat + d.dLat, lon: s.lon + d.dLon }
    pose = poseNadir({ sousCamera: s, hauteur: h, roulisDeg: roulis })
    const pG = projette(pose, vecteurDe(G.lat, G.lon), ECRAN)
    residuPx = Math.hypot(pG[0] - p1[0], pG[1] - p1[1])
    if (residuPx < 0.01) { n++; break }
  }
  return { d, s, residuPx, G, images: n }
}

test('⑤ le point saisi revient sous le pointeur en UNE image sous 2 000 km — glissé de 200 px', () => {
  for (const [nom, h] of Object.entries(ALTS)) {
    if (nom === '60 000 km') continue
    for (const p1 of [[840, 400], [640, 200], [840, 300], [440, 560]]) {
      const S = { lat: -25.2, lon: 27.4 }
      const { d, s, residuPx } = saisie({ S, h, p0: [640, 400], p1 })
      assert.ok(residuPx < 0.01, `${nom}, pointeur en ${p1} : le point saisi est à ${residuPx.toFixed(4)} px du pointeur (${d.iterations} itérations, résidu ${d.residuDeg.toExponential(2)}°)`)
      assert.ok(d.iterations <= ITERATIONS_SAISIE)
      // et la caméra a bien BOUGÉ : c'est une orbite, pas un lacet
      assert.ok(Math.hypot(s.lat - S.lat, s.lon - S.lon) > 1e-4, `${nom} : la caméra n’a pas bougé`)
    }
  }
})

test('⑤ à 60 000 km, un saut de 100 px vaut ~50° : le plafond de 30° par image l’étale sur deux images, puis c’est exact', () => {
  // (un glissé RÉEL avance de quelques pixels par image et ne touche jamais le
  // plafond ; celui-ci ne mord que sur un saut — un chargement, ou le limbe.
  // Et le disque de la Terre fait ~130 px de rayon à cette altitude : au-delà,
  // le pointeur est dans l'espace et AUCUN point saisi ne peut le rejoindre —
  // c'est le cas ⑤ quater, celui du limbe)
  const S = { lat: -25.2, lon: 27.4 }, h = ALTS['60 000 km']
  const une = saisie({ S, h, p0: [640, 400], p1: [740, 400], images: 1 })
  assert.equal(une.d.plafonne, true, `un saut de ~50° doit être plafonné (pas ${une.d.dLon.toFixed(2)}°)`)
  // l'arc parcouru en une image tient sous le plafond (la longitude compte au
  // cosinus de la latitude, qui change en route : on borne, on n'égale pas)
  const arc = Math.hypot(une.d.dLat, une.d.dLon * Math.cos((S.lat + une.d.dLat / 2) * D2R))
  assert.ok(arc <= PLAFOND_PAS_DEG + 1e-6 && arc > PLAFOND_PAS_DEG * 0.8, `arc de ${arc.toFixed(2)}° pour un plafond de ${PLAFOND_PAS_DEG}°`)
  const fin = saisie({ S, h, p0: [640, 400], p1: [740, 400], images: 6 })
  assert.ok(fin.residuPx < 0.01, `résidu ${fin.residuPx.toFixed(4)} px après ${fin.images} images`)
  assert.ok(fin.images <= 3, `${fin.images} images pour un saut de 100 px`)
})

test('⑤ bis le roulis est respecté : avec le haut de l’écran tourné, le point saisi revient quand même sous le pointeur', () => {
  for (const roulis of [37, -110]) {
    const { residuPx } = saisie({ S: { lat: 45.83, lon: 6.86 }, h: ALTS['130 km'], p0: [640, 400], p1: [840, 250], roulis })
    assert.ok(residuPx < 0.01, `roulis ${roulis}° : résidu ${residuPx.toFixed(4)} px`)
  }
})

test('⑤ ter ce que ça rend en °/px — mesuré, pas fixé : le geste dépend de l’altitude, comme la Terre sous la souris', () => {
  const S = { lat: 0, lon: 0 }
  const parPx = {}
  for (const [nom, h] of Object.entries(ALTS)) {
    const { d } = saisie({ S, h, p0: [640, 400], p1: [690, 400] })
    parPx[nom] = Math.abs(d.dLon) / 50
  }
  // 50 px au centre de l'écran, c'est 50 × 2·h·tan(16,5°)/800 de sol : 1,9 km à 50 km, 4,8 km à 130 km …
  assert.ok(parPx['50 km'] < parPx['130 km'] && parPx['130 km'] < parPx['2 000 km'] && parPx['2 000 km'] < parPx['60 000 km'])
  // à 60 000 km on retrouve l'ordre de grandeur d'OrbitControls (0,447 °/px) ; à 130 km on en est à deux cents fois moins
  assert.ok(parPx['60 000 km'] > 0.3 && parPx['60 000 km'] < 0.6, `60 000 km : ${parPx['60 000 km']} °/px`)
  assert.ok(parPx['130 km'] < 0.003, `130 km : ${parPx['130 km']} °/px`)
})

test('⑤ quater à 60 000 km, un glissé qui sort du disque continue au rythme du limbe, plafonné, sans exploser', () => {
  const S = { lat: 0, lon: 0 }, h = ALTS['60 000 km']
  const pose = poseNadir({ sousCamera: S, hauteur: h })
  const G = latLonDe(pointSousLePixel({ pose, ...ECRAN, px: 640, py: 400 }).point)
  const d = deplacementDeSaisie({ saisi: G, sousCamera: S, hauteur: h, poseReelle: pose, ...ECRAN, px: 640 + 300, py: 400 })
  assert.ok(d.limbe, 'le pointeur est hors du disque (~130 px de rayon) : c’est le limbe qui doit répondre')
  // ⚠️ au rythme du BORD, pas au plafond de 30° : mesuré, 30°/image emportait
  // la caméra au pôle en une seconde (voir PLAFOND_LIMBE_DEG)
  const arc = Math.hypot(d.dLat, d.dLon)
  assert.ok(Number.isFinite(arc) && arc <= PLAFOND_LIMBE_DEG + 1e-9 && arc > PLAFOND_LIMBE_DEG * 0.99, `arc de ${arc}° pour un rythme de bord de ${PLAFOND_LIMBE_DEG}°`)
  assert.ok(d.dLon < 0, 'le pointeur est parti à l’est : la caméra va à l’ouest')
  assert.ok(Math.abs(d.dLat) < Math.abs(d.dLon) * 0.05, `un glissé horizontal ne doit pas emporter la latitude (dLat ${d.dLat.toFixed(4)}°)`)
})

test('⑤ quinquies la latitude est bornée : on ne passe pas le pôle', () => {
  const S = { lat: 84.9, lon: 0 }, h = ALTS['2 000 km']
  const pose = poseNadir({ sousCamera: S, hauteur: h })
  const G = latLonDe(pointSousLePixel({ pose, ...ECRAN, px: 640, py: 400 }).point)
  const d = deplacementDeSaisie({ saisi: G, sousCamera: S, hauteur: h, poseReelle: pose, ...ECRAN, px: 640, py: 790 })
  assert.ok(S.lat + d.dLat <= LAT_MAX_DEG + 1e-9, `latitude ${S.lat + d.dLat}`)
})
