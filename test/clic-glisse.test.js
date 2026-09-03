// R35 — LE CLIC NE SAUTE PLUS : C'EST UN GLISSÉ D'UN NIVEAU, EN ORBITE ET EN
// SURFACE, SOUS LE DRAPEAU.
//
// ⛔ Mesuré avant (`.banc/R35/clic-avant.json`, Chrome sans tête, huit clics
// depuis 60 000 km) : clic 1 ×4,41 d'altitude en UNE image (60 000 → 13 613
// km, la butée `surfaceMaxDistance()` = 150 u d'un `_dive` à niveau imposé) ;
// clics 2 à 8 : ×1,43 chacun (`_loadDive` reposait `distancePresentation`,
// une distance FIXE sur un bloc deux fois plus petit — les 70 % du « lean »
// tombaient d'un coup). Critère du brief : aucun rapport de distance > 1,5
// entre deux images consécutives, la Terre plantée, D16 ter tenu.
//
// Ces tests rejouent le glissé image par image, à 60 i/s, dans la machine de
// `pivot-terre.test.js`, et tiennent la MÊME barre : pire rapport image à
// image, bornes du geste, compteur de niveau, et le régime hérité au bit près.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Y_CIBLE } from '../src/loi-altitude.js'
import { PAS_NIVEAU } from '../src/monde/zoom-continu.js'
import { R_GLOBE, ORBITAL_M_PER_UNIT, sphereToLatLon } from '../src/geo.js'
import fs from 'node:fs'

function domDePacotille() {
  const el = () => {
    const e = { className: '', innerHTML: '', textContent: '', style: {}, enfants: [] }
    e.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }
    e.appendChild = (c) => { e.enfants.push(c); return c }
    e.remove = () => {}
    e.setAttribute = () => {}
    e.addEventListener = () => {}
    e.querySelector = () => el()
    return e
  }
  globalThis.document = { createElement: () => el(), body: el(), addEventListener() {} }
  globalThis.window = globalThis.window ?? { innerWidth: 1280, innerHeight: 800 }
}

async function machine(hooksEnPlus = {}, { continu = true } = {}) {
  domDePacotille()
  const THREE = await import('three')
  const { Modes } = await import('../src/modes.js')
  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
  const controls = {
    target: new THREE.Vector3(0, Y_CIBLE, 0),
    minDistance: 6, maxDistance: 150, enabled: true, maxPolarAngle: 0,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  const journal = { charges: [], annonces: [], franchissements: 0 }
  const hooks = {
    zoomContinu: () => continu,
    empriseBlocM: () => 1e6,
    empriseBlocMAuZoom: (z) => 1e6 * 2 ** (12 - z),
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => 150,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat: 45.83, lon: 6.86 }),
    getRefineTarget: () => ({ lat: 45.83, lon: 6.86, zoom: 13 }),
    getCoarsenTarget: () => null,
    setSurfaceVisible() {}, setEffectsEnabled() {},
    viseeDuLieu: () => ({ x: 0, z: 0 }),
    async loadSurface(lat, lon, zoom) { journal.charges.push({ lat, lon, zoom }) },
    ...hooksEnPlus,
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.announce = (t) => journal.annonces.push(t)
  // on observe le franchissement sans le laisser recharger (le rechargement est
  // le chemin de `_rescale`, mesuré par R32) : le compteur et l'appel suffisent
  m._refine = async () => { journal.franchissements++ }
  return { m, camera, controls, journal, THREE }
}

// joue `n` images à 60 i/s et rend, par image, la distance de la caméra au
// centre (orbite) ou à la cible (surface), et la position
function jouer(m, camera, controls, n, mesure) {
  const releve = []
  for (let i = 0; i < n; i++) {
    m.update(1 / 60)
    releve.push(mesure())
  }
  return releve
}
const pireRapport = (xs) => xs.slice(1).reduce((p, x, i) => Math.max(p, x / xs[i], xs[i] / x), 1)

// ══════════ ① EN ORBITE, LE CLIC GLISSE VERS LE LIEU CLIQUÉ, D'UN NIVEAU ═══

test('① orbite : le clic descend d’UN niveau en géométrique — pire rapport image à image < 1,05, jamais 4,41', async () => {
  // l'emprise réelle d'un bloc z4 (~7 500 km) : à 30 000 km, aucun niveau ne
  // tient sous le plafond — la porte reste fermée, et armée
  const { m, camera, controls } = await machine({ empriseBlocMAuZoom: (z) => 7.5e6 * 2 ** (4 - z) })
  m.mode = 'orbital'
  m.orbAlt = m.orbAltTarget = 60e6 / ORBITAL_M_PER_UNIT
  camera.position.set(0, 0, R_GLOBE + m.orbAlt)
  m.altM = 60e6
  assert.equal(m.plongeDepuisGlobe(10, 20), true)
  assert.ok(m.travel && m.travel.clic, 'le clic est un glissé (travel.clic), pas un `_dive`')
  assert.equal(m._diveArmed, false, 'la porte n’est pas armée pendant le glissé')
  const d = jouer(m, camera, controls, 70, () => camera.position.length())
  assert.ok(pireRapport(d) < 1.05, `pire rapport image à image ${pireRapport(d).toFixed(4)} — le critère du brief est 1,5, le glissé vaut ~1,02`)
  assert.equal(m.travel, null, 'le glissé est fini en 0,9 s')
  assert.ok(Math.abs(m.orbAlt * ORBITAL_M_PER_UNIT - 30e6) < 1, `altitude d’arrivée ${m.orbAlt * ORBITAL_M_PER_UNIT} m : la moitié de 60 000 km`)
  const { lat, lon } = sphereToLatLon(camera.position)
  assert.ok(Math.abs(lat - 10) < 1e-6 && Math.abs(lon - 20) < 1e-6, `le lieu cliqué est sous la caméra (${lat}, ${lon})`)
  assert.equal(m._diveArmed, true, 'à l’arrivée, la porte géométrique est ARMÉE — c’est la molette qui décide de la traversée')
  assert.equal(controls.enabled, true)
})

test('① bis orbite : la Terre reste plantée — la caméra vise toujours le centre pendant le glissé', async () => {
  const { m, camera, controls, THREE } = await machine()
  m.mode = 'orbital'
  m.orbAlt = m.orbAltTarget = 20e6 / ORBITAL_M_PER_UNIT
  camera.position.set(R_GLOBE + m.orbAlt, 0, 0)
  m.altM = 20e6
  m.plongeDepuisGlobe(-30, 90)
  const avant = new THREE.Vector3()
  const ecarts = jouer(m, camera, controls, 60, () => {
    camera.getWorldDirection(avant)
    const versCentre = camera.position.clone().negate().normalize()
    return avant.angleTo(versCentre)
  })
  assert.ok(Math.max(...ecarts) < 1e-6, `axe optique / centre de la Terre : ${Math.max(...ecarts)} rad`)
})

test('① ter orbite, régime hérité (`?terre=deux`) : la plongée à palier imposé, au bit près', async () => {
  const { m, camera, journal } = await machine({}, { continu: false })
  m.mode = 'orbital'
  m.orbAlt = m.orbAltTarget = 60e6 / ORBITAL_M_PER_UNIT
  camera.position.set(0, 0, R_GLOBE + m.orbAlt)
  m.altM = 60e6
  m.plongeDepuisGlobe(10, 20)
  assert.equal(m.travel, null, 'pas de glissé hors du drapeau')
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(journal.charges.length, 1, 'un chargement immédiat — la plongée d’avant')
  assert.equal(journal.charges[0].zoom, 4)
})

// ══════════ ② EN SURFACE, LE CLIC GLISSE VERS LE POINT, D'UN NIVEAU ════════

test('② surface : la cible glisse rigidement vers le point cliqué, la distance descend d’un niveau — |Δ ln d| < 0,03 par image, rien n’est posé', async () => {
  const { m, camera, controls, journal, THREE } = await machine()
  m.mode = 'surface'
  camera.position.set(0, 60, 40)
  controls.target.set(0, Y_CIBLE, 0)
  const d0 = controls.getDistance()
  m.diveTo({ lat: 45.9, lon: 6.9, zoom: 13, point: new THREE.Vector3(8, 1.7, -5) })
  assert.ok(m._diveTween && m._diveTween.glisse, 'le glissé est armé')
  let lnPrec = Math.log(d0)
  const pas = []
  const releve = jouer(m, camera, controls, 70, () => {
    const d = controls.getDistance()
    pas.push(Math.abs(Math.log(d) - lnPrec)); lnPrec = Math.log(d)
    return d
  })
  assert.ok(Math.max(...pas) < 0.03, `|Δ ln d| max par image ${Math.max(...pas).toFixed(4)} (ln 2 réparti sur 0,9 s, adouci)`)
  assert.ok(pireRapport(releve) < 1.05, `pire rapport ${pireRapport(releve).toFixed(4)}`)
  assert.equal(m._diveTween, null, 'fini en 0,9 s')
  assert.ok(Math.abs(controls.getDistance() - d0 / 2) < 1e-9, `distance d’arrivée ${controls.getDistance()} = d0/2 = ${d0 / 2}`)
  assert.equal(controls.target.x, 8); assert.equal(controls.target.z, -5)
  assert.equal(controls.target.y, Y_CIBLE, 'le `y` de la cible ne change pas (R32 : il porte l’altitude de cadrage)')
  // l'axe de vue est gardé (D16 ter : pas de bascule au clic)
  const dir = camera.position.clone().sub(controls.target).normalize()
  assert.ok(Math.abs(dir.y - 60.3 / Math.hypot(60.3, 40)) < 1e-9, 'même pente qu’au départ')
  assert.equal(journal.franchissements, 1, '`_franchirSiBesoin` a demandé le niveau fin à l’arrivée : le compteur valait EXACTEMENT −ln 2')
  assert.ok(Math.abs(m._levelZoom) < 1e-12, `et le franchissement l’a dépensé : reste ${m._levelZoom}`)
  assert.equal(journal.charges.length, 0, '`_loadDive` n’a rien posé')
  assert.equal(controls.enabled, true)
})

test('② bis surface, au zoom fin : sans niveau à affiner, le compteur compte le déplacement réel, pas l’intention', async () => {
  const { m, camera, controls, journal, THREE } = await machine({ getRefineTarget: () => null })
  m.mode = 'surface'
  camera.position.set(0, 8, 6) // d = 10,3 → d/2 = 5,15 < plancher 6 : clippé
  controls.target.set(0, Y_CIBLE, 0)
  const d0 = controls.getDistance()
  m.diveTo({ lat: 45.9, lon: 6.9, zoom: 15, point: new THREE.Vector3(1, 0, 1) })
  jouer(m, camera, controls, 70, () => 0)
  assert.ok(Math.abs(controls.getDistance() - 6) < 1e-9, 'la distance bute au plancher')
  assert.ok(Math.abs(m._levelZoom - Math.log(6 / d0)) < 1e-9, `compteur = ln(6/d0) = ${Math.log(6 / d0)}, reçu ${m._levelZoom}`)
  assert.equal(journal.franchissements, 0)
})

test('② ter surface, régime hérité : le « lean » de 30 % puis `_loadDive`, au bit près', async () => {
  const { m, camera, controls, journal, THREE } = await machine({}, { continu: false })
  m.mode = 'surface'
  camera.position.set(0, 60, 40)
  m.diveTo({ lat: 45.9, lon: 6.9, zoom: 13, point: new THREE.Vector3(8, 1.7, -5) })
  assert.ok(m._diveTween && !m._diveTween.glisse && m._diveTween.dur === 0.42, 'le tween d’avant, 0,42 s')
  jouer(m, camera, controls, 30, () => 0)
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(journal.charges.length, 1, '`_loadDive` a chargé le niveau')
  assert.equal(journal.charges[0].zoom, 13)
})

test('② quater le glissé refuse pendant un chargement, un vol ou un autre glissé — et hors surface', async () => {
  const { m, camera, controls, THREE } = await machine()
  m.mode = 'surface'
  camera.position.set(0, 60, 40)
  const cible = { lat: 45.9, lon: 6.9, zoom: 13, point: new THREE.Vector3(8, 1.7, -5) }
  m.busy = true; m.diveTo(cible); assert.ok(!m._diveTween)
  m.busy = false; m.travel = { t: 0 }; m.diveTo(cible); assert.ok(!m._diveTween)
  m.travel = null; m.mode = 'orbital'; m.diveTo(cible); assert.ok(!m._diveTween)
  m.mode = 'surface'; m.diveTo(cible); assert.ok(m._diveTween)
  const t = m._diveTween; m.diveTo(cible); assert.equal(m._diveTween, t, 'un second clic pendant le glissé est ignoré')
})

test('① quater orbite : quand le glissé arrive sous la porte géométrique, la traversée part d’elle-même, vers le lieu cliqué, sans niveau imposé', async () => {
  const { m, camera, controls, journal } = await machine({ empriseBlocMAuZoom: (z) => 7.5e6 * 2 ** (4 - z) })
  m.mode = 'orbital'
  m.orbAlt = m.orbAltTarget = 7.5e6 / ORBITAL_M_PER_UNIT
  camera.position.set(0, 0, R_GLOBE + m.orbAlt)
  m.altM = 7.5e6
  m.plongeDepuisGlobe(-21.115, 55.536)
  jouer(m, camera, controls, 70, () => 0)
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(journal.charges.length, 1, 'la porte s’est ouverte à 3 750 km : un chargement')
  assert.equal(journal.charges[0].zoom, 4, 'le niveau vient de `_niveauDArrivee`, pas de `DIVE_TIERS`')
  assert.ok(Math.abs(journal.charges[0].lat + 21.115) < 1e-6 && Math.abs(journal.charges[0].lon - 55.536) < 1e-6, 'centré sur le lieu cliqué — il est sous la caméra')
  assert.equal(journal.annonces.some((a) => /Z4/.test(a)), true)
})

test('② quinquies surface : à mi-glissé le compteur porte la moitié du niveau, et un clic partant d’un compteur non nul ne perd rien', async () => {
  const { m, camera, controls, journal, THREE } = await machine()
  m.mode = 'surface'
  camera.position.set(0, 60, 40)
  m._levelZoom = -0.2 // un reste de molette
  m.diveTo({ lat: 45.9, lon: 6.9, zoom: 13, point: new THREE.Vector3(2, 0, 2) })
  jouer(m, camera, controls, 27, () => 0) // 0,45 s sur 0,9 : e = 0,5
  assert.ok(Math.abs(m._levelZoom - (-0.2 - PAS_NIVEAU * 0.5)) < 1e-9, `à mi-chemin : ${m._levelZoom}`)
  jouer(m, camera, controls, 40, () => 0)
  assert.equal(journal.franchissements, 1)
  assert.ok(Math.abs(m._levelZoom + 0.2) < 1e-9, `le reste de molette est conservé après le franchissement : ${m._levelZoom}`)
})

// ══════════ ③ LE CLIC N'EST PLUS JETÉ PENDANT LE VOL DU MNT (main.js) ══════

test('③ main.js : le clic-plongée accepte la fenêtre bornée sans `dem`, et convertit par `latLonDuBloc` — la garde de R32, appliquée au clic', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const debut = src.indexOf("renderer.domElement.addEventListener('pointerup', (e) => {\n  if (!_clickArmed")
  assert.ok(debut > 0, 'le gestionnaire du clic est là')
  const corps = src.slice(debut, src.indexOf('modes.diveTo(', debut))
  assert.ok(corps.includes("(!dem && !terrain.fenetreBornee)"), 'la garde tolère `dem` nul si la fenêtre bornée est posée')
  assert.ok(!/\|\| !dem \|\|/.test(corps), 'plus de `!dem` seul : c’est lui qui jetait le clic 8 (`.banc/R35/clic-apres-2.json`)')
  assert.ok(corps.includes('latLonDuBloc(px, pz)') && !corps.includes('worldToLatLon(dem, px, pz)'), 'la conversion passe par le même chemin que `viseeAuSol`')
})
