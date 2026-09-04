// SONDE TUILE — LE RETOUR EN ARRIÈRE DE FINESSE, POINT PAR POINT.
//
// ⚠️ **CE QUE LA SONDE CN2 NE POUVAIT PAS VOIR.** Le banc de papier de CN2
// résolvait ses dalles en une MICROTÂCHE : la couverture arrivait avant la fin
// de l'image, donc le palier montait sans jamais se voir attendre, et la
// « surcouche » d'Adrien — le bloc entier maintenu grossier tant qu'une tuile de
// bord manque — ne pouvait pas apparaître. C'est le piège que CN3 avait nommé
// (« une suite verte ne prouve rien, il manquait une latence »). Cette sonde
// pose donc une LATENCE RÉSEAU réglable (`--lat`, en images) avant qu'une dalle
// ne soit servie.
//
// Elle ne relève pas « combien de niveaux dans le cadre » — c'était la grandeur
// de la contrainte abrogée (D25). Elle relève **la finesse RENDUE en un point**,
// pour une grille de points de l'emprise, image par image : le niveau de la
// tuile qui peint réellement ce point, quadrant partiel de R37 compris. Un
// RETOUR EN ARRIÈRE est un point dont la finesse rendue DIMINUE d'une image à la
// suivante alors que la cible ne baisse pas.
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i > 0 ? Number(process.argv[i + 1]) : d
}
const LATENCE = arg('--lat', 6) // images avant qu'une dalle ne réponde
const IMAGES = arg('--images', 60)

const [ER, EG, EB] = encodeTerrarium(812)
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) { DALLE[i * 4] = ER; DALLE[i * 4 + 1] = EG; DALLE[i * 4 + 2] = EB; DALLE[i * 4 + 3] = 255 }
class FakeCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData() { return { data: DALLE } }
}
globalThis.document = { createElement() { const c = { width: 0, height: 0 }; c.getContext = () => (c._ctx ??= new FakeCtx()); return c } }
globalThis.createImageBitmap = async (b) => b

// ── LA LATENCE : une dalle n'est servie qu'après `LATENCE` images ────────────
// ⚠️ le compteur est l'image du globe, pas une horloge : un banc au fil de l'eau
// n'a pas de temps réel, et une attente en millisecondes rendrait le relevé
// dépendant de la charge de la machine.
let IMAGE = 0
let requetes = 0
const attente = []
globalThis.fetch = async () => {
  requetes++
  const depart = IMAGE
  await new Promise((r) => attente.push({ depart, r }))
  return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, size: 90000 }) }
}
function relacher() {
  for (let i = attente.length - 1; i >= 0; i--) {
    if (IMAGE - attente[i].depart >= LATENCE) attente.splice(i, 1)[0].r()
  }
}

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('../src/geo.js')
const { _resetDemSource, DEM_SOURCES } = await import('../src/dem-source.js')
const { tuileDansCrop } = await import('../src/monde/crop-sphere.js')

const LIEUX = [
  { nom: 'alpes', lat: 46.0122, lon: 7.8223 },
  { nom: 'majorque', lat: 39.62, lon: 2.98 },
  { nom: 'beauce', lat: 48.2, lon: 1.8 },
]
const FOV = 30

function camera(lat, lon, altM) {
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(lat, lon, R_GLOBE + orbAlt, cam.position)
  cam.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  cam.up.set(0, 1, 0)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

// ── LA FINESSE RENDUE EN UN POINT ───────────────────────────────────────────
// On descend depuis la racine : la première tuile VISIBLE qui peint le point
// gagne. Une tuile partielle (R37) ne peint que les quadrants de son masque
// (`t._partiel`), donc si le quadrant du point n'y est pas, on continue vers
// l'enfant. Rendre 0 = aucun pixel (trou).
function finesseEn(g, mx, my) {
  for (let z = 2; z <= 22; z++) {
    const n = 2 ** z
    const x = Math.min(n - 1, Math.floor(mx * n))
    const y = Math.min(n - 1, Math.floor(my * n))
    const t = g.tiles.get(`${z}/${x}/${y}`)
    if (!t || !t.mesh?.visible) continue
    if (!t._partiel) return z
    // quadrant de l'enfant qui contient le point, même bit que `quadrantDe`
    const cx = Math.floor(mx * n * 2) & 1
    const cy = Math.floor(my * n * 2) & 1
    if (t._partiel & (1 << (cx + (cy << 1)))) return z
  }
  return 0
}

function grille(rep, k = 7) {
  const pts = []
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < k; i++) {
      pts.push([rep.cx + rep.demi * (2 * (i + 0.5) / k - 1) * 0.98, rep.cy + rep.demi * (2 * (j + 0.5) / k - 1) * 0.98])
    }
  }
  return pts
}

const ALTS = [5000, 2000, 900, 600]
console.log(`# sonde-tuile — latence ${LATENCE} images, ${IMAGES} images par altitude`)
for (const lieu of LIEUX) {
  for (const altM of ALTS) {
    _resetTileMemo()
    _resetDemSource(DEM_SOURCES.aws.id)
    attente.length = 0
    IMAGE = 0
    requetes = 0
    const g = new Globe({ globeContinu: true })
    g.setVisible(true)
    g.poserCrop({ centre: { lat: lieu.lat, lon: lieu.lon }, zoom: 15, tuilesParBloc: 3 })
    const cam = camera(lieu.lat, lieu.lon, altM)
    const pts = grille(g._crop)
    let prec = null
    let retours = 0
    let pire = 0
    const trace = []
    let premierNet = -1
    let cibleFin = 0
    for (let i = 0; i < IMAGES; i++) {
      IMAGE = i
      relacher()
      await new Promise((r) => setTimeout(r, 0))
      g.update(cam, 0.016)
      await new Promise((r) => setTimeout(r, 0))
      const f = pts.map(([mx, my]) => finesseEn(g, mx, my))
      cibleFin = g._zCropCible
      if (prec) {
        for (let k = 0; k < f.length; k++) {
          if (f[k] > 0 && prec[k] > 0 && f[k] < prec[k]) { retours++; pire = Math.max(pire, prec[k] - f[k]) }
        }
      }
      prec = f
      // netteté AU CENTRE : le point central atteint la cible
      const centre = f[(pts.length - 1) / 2 | 0]
      if (premierNet < 0 && centre >= g._zCropCible && g._zCropCible > 0) premierNet = i
      trace.push(`${centre}`)
      const dessines = new Set()
      for (const t of g.tiles.values()) if (t.mesh?.visible && tuileDansCrop(t.z, t.x, t.y, g._crop)) dessines.add(t.z)
      if (i === IMAGES - 1) {
        console.log(`${lieu.nom} ${altM}m : cible z${g._zCropCible} servi z${g._zCropServi} | finesse rendue min/max ${Math.min(...f)}/${Math.max(...f)} | niveaux dessines [${[...dessines].sort((a, b) => a - b)}] | cache ${g.tiles.size} | requetes ${requetes}`)
        console.log(`   RETOURS EN ARRIERE : ${retours} (pire ${pire} niveau) | 1re image nette au centre : ${premierNet < 0 ? 'jamais' : premierNet} | trace centre: ${trace.join('')}`)
      }
    }
    void cibleFin
  }
}

// ══════════ SCÉNARIO B — LE CHANGEMENT D'ÉCHELLE, LE GESTE D'ADRIEN ═════════
//
// ⚠️ **C'EST ICI QUE LA SURCOUCHE SE VOIT, ET NULLE PART AILLEURS.** Le scénario
// A part d'un cache froid : la finesse ne peut que monter, donc « zéro retour en
// arrière » n'y prouve rien. Adrien décrit autre chose : *« une belle carte bien
// définie (…) RECOUVERTE À CHAQUE CHANGEMENT D'ÉCHELLE »*. On chauffe donc
// jusqu'à la netteté, puis on repose le crop à une autre échelle — exactement ce
// que fait `branchement-crop.js` quand `demZoom` ou `tuilesParBloc` bouge — et on
// relève la finesse rendue point par point pendant les 20 images qui suivent.
console.log('\n# SCÉNARIO B — changement d’échelle sur un crop DÉJÀ NET')
for (const lieu of LIEUX) {
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id)
  attente.length = 0
  IMAGE = 0
  requetes = 0
  const g = new Globe({ globeContinu: true })
  g.setVisible(true)
  g.poserCrop({ centre: { lat: lieu.lat, lon: lieu.lon }, zoom: 15, tuilesParBloc: 3 })
  const cam = camera(lieu.lat, lieu.lon, 600)
  for (let i = 0; i < 300; i++) {
    IMAGE = i
    relacher()
    await new Promise((r) => setTimeout(r, 0))
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
  }
  const pts = grille(g._crop)
  const avant = pts.map(([mx, my]) => finesseEn(g, mx, my))
  // le changement d'échelle : même centre, un cran d'emprise de plus
  g.poserCrop({ centre: { lat: lieu.lat, lon: lieu.lon }, zoom: 14, tuilesParBloc: 3 })
  const pts2 = grille(g._crop)
  let retours = 0
  let pire = 0
  const trace = []
  let prec = pts2.map(([mx, my]) => finesseEn(g, mx, my))
  const depart = prec.slice()
  for (let i = 0; i < 20; i++) {
    IMAGE = 300 + i
    relacher()
    await new Promise((r) => setTimeout(r, 0))
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    const f = pts2.map(([mx, my]) => finesseEn(g, mx, my))
    for (let k = 0; k < f.length; k++) {
      if (f[k] > 0 && depart[k] > 0 && f[k] < depart[k]) { retours++; pire = Math.max(pire, depart[k] - f[k]) }
    }
    prec = f
    trace.push(`${Math.min(...f)}/c${g._zCropCible}`)
  }
  console.log(`${lieu.nom} : avant repose min/max ${Math.min(...avant)}/${Math.max(...avant)} → après ${Math.min(...prec)}/${Math.max(...prec)} (cible z${g._zCropCible}, servi z${g._zCropServi}, cache ${g.tiles.size})`)
  console.log(`   RETOURS EN ARRIERE (20 images × ${pts2.length} points) : ${retours}, pire ${pire} niveau(x) | min par image: ${trace.join(',')}`)
}
