import * as THREE from 'three'
import { mulberry32 } from './noise.js'
import { BASIN_BLEND } from './terrain.js'

// Map-style typography draped flat on the terrain: place names + spot elevations,
// drawn to canvas textures so they read like printed cartography.
//
// ══════════ CE QUE CE FICHIER PORTE, ET CE QU'IL NE DOIT PAS PORTER ═════════
//
// ⛔ **`PLACE_NAMES` EST LA TOPONYMIE DE MONUMENT VALLEY, ET ELLE EST FAUSSE
// PARTOUT AILLEURS.** HUNTS MESA, RAIN GOD MESA, THREE SISTERS, EAR OF THE
// WIND… : des noms de l'Arizona, posés au hasard (`mulberry32`) sur le terrain
// courant. C'est un décor de démonstration, pas de la cartographie.
//
// ⚡ **ILS NE SORTENT QUE SUR LE TERRAIN PROCÉDURAL** — `if (!real)` — c'est-à-
// dire sur un relief inventé, où un nom inventé est à sa place. **Mesuré,
// Tâche R24** : sous le mode sphère `params.source` vaut `'real'` (relevé à La
// Réunion, `dem.lat = −21,26`), donc **aucun nom fictif n'a jamais atteint la
// sphère**. La garde ci-dessous rend cette impossibilité EXPLICITE au lieu de
// la laisser dépendre de la coïncidence de deux drapeaux — et
// `test/cotes-globe.test.js` la tient.
//
// ⚡ **CE QUE LE CURSEUR « Points cotés » SERT VRAIMENT, C'EST LA SECONDE
// MOITIÉ DE CE FICHIER** : des COTES D'ALTITUDE lues dans le MNT — de la vraie
// donnée, en mètres, sur le vrai relief. C'est elle qu'on reloge sur la sphère.
//
// ══════════ ⚠️ LES DEUX CONVERSIONS DE LA SPHÈRE, ET IL N'Y EN A PAS TROIS ══
//
// Ce fichier raisonne en unités de BLOC et il continue : c'est le poseur
// (`monde/sol-globe.js`) qui sait qu'il y a deux mondes. Deux longueurs
// seulement traversent, et les deux par le MÊME `k` :
//   ① **la position** — `poseur.placer(x, z, y)` ; c'est lui qui porte
//      `R_GLOBE + altitudeM × (R_GLOBE / EARTH_RADIUS_M) × exagération`, la
//      forme de `rayonAncre` (`monde/frontiere-rendu.js`), celle qui marche ;
//   ② **la taille du plan** — `mesh.scale = k`. Un plan de 1,5 unité de BLOC
//      laissé tel quel dans l'espace du GLOBE serait, à z12
//      (`k = 7,667 071 e−3` mesuré à La Réunion), **1 / k = 130,4 fois trop
//      grand** — et 130,4 est nommément l'un des sept facteurs de conversion
//      déjà attrapés sur ce chantier.
// ⛔ **LE DÉGAGEMENT NE SE CONVERTIT PAS À PART** : il est en unités de bloc et
// traverse DANS `y`, donc par ①. L'écrire une seconde fois en mètres en ferait
// une troisième loi, et deux écritures d'une même loi divergent en silence.

const PLACE_NAMES = [
  'HUNTS MESA',
  'RAIN GOD MESA',
  'MITCHELL BUTTE',
  'SENTINEL FLAT',
  'GYPSUM CREEK',
  'YAZZIE DRAW',
  'CAIRN RIDGE',
  'THREE SISTERS',
  'SUBMARINE ROCK',
  'EAR OF THE WIND',
]

function textTexture(text, { size = 96, italic = true, spacing = 0.35, color = '#2e2820' }) {
  const font = `${italic ? 'italic ' : ''}500 ${size}px Georgia, 'Times New Roman', serif`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const gap = size * spacing
  let width = 0
  for (const ch of text) width += probe.measureText(ch).width + gap
  width -= gap

  const pad = size * 0.4
  const c = document.createElement('canvas')
  c.width = Math.ceil(width + pad * 2)
  c.height = Math.ceil(size * 1.6)
  const ctx = c.getContext('2d')
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  let x = pad
  for (const ch of text) {
    ctx.fillText(ch, x, c.height / 2)
    x += ctx.measureText(ch).width + gap
  }

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: c.width / c.height }
}

function makeLabelMesh(text, opts, worldWidth) {
  const { tex, aspect } = textTexture(text, opts)
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: opts.opacity ?? 0.9,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldWidth / aspect), mat)
  mesh.renderOrder = 3
  return mesh
}

// sample a few points under the label footprint so it floats just above ridges
function settleHeight(sample, x, z, halfW) {
  let h = -Infinity
  for (let i = -2; i <= 2; i++) h = Math.max(h, sample(x + (i * halfW) / 2, z))
  return h + 0.14
}

// Dégagement d'une cote au-dessus du sol, en unités de BLOC. C'était un `0.12`
// nu dans le corps de la boucle ; il devient une constante parce que la sphère
// le fait traverser et qu'une valeur qui traverse doit avoir un nom.
export const DEGAGEMENT_COTE = 0.12

// Pas de la dérivée qui donne l'EST local, en unités de bloc. `TERRAIN_SIZE/1000`
// : assez grand pour que la différence de deux positions de globe reste très
// au-dessus du bruit du double (à z12, 0,056 × k = 4,3e−4 unité de globe contre
// des coordonnées de l'ordre de 100 — six ordres de grandeur de marge), assez
// petit pour que la direction soit celle du point et non celle du bloc.
const PAS_EST = 56 / 1000

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _est = new THREE.Vector3()
const _haut = new THREE.Vector3()
const _sud = new THREE.Vector3()
const _m = new THREE.Matrix4()

/**
 * LE REPÈRE LOCAL D'UNE COTE, PRIS AU POINT LUI-MÊME.
 *
 * ⛔ **PAS `poseur.repereLocal()`, ET C'EST MESURÉ, PAS SUPPOSÉ.** Celui-là est
 * le repère du CENTRE du bloc. Sur une emprise large, le nord local du coin
 * n'est plus celui du centre : à z8 (emprise 330 km) l'écart angulaire vaut
 * ~1,5°, et à z4 (10 600 km) il vaut 48° — la cote se coucherait sur la
 * tangente d'un autre endroit. `frontiere-rendu.js` porte la même mise en garde
 * pour la caméra (« le bloc plat est au-dessus de la sphère de 538 km à z4 »).
 *
 * ⚡ **ET IL SE PREND SANS LATITUDE.** `placer` est la seule loi de passage ; on
 * lui demande DEUX points au lieu d'un, et la direction de l'est tombe toute
 * seule. Rien à recopier, donc rien à désaccorder.
 *
 * @returns {{est: THREE.Vector3, haut: THREE.Vector3, sud: THREE.Vector3}}
 */
export function repereCote(poseur, x, z, y) {
  const p0 = poseur.placer(x, z, y)
  const p1 = poseur.placer(x + PAS_EST, z, y)
  _a.set(p0.x, p0.y, p0.z)
  _b.set(p1.x, p1.y, p1.z)
  // le HAUT local est la verticale de la sphère : la position, normalisée
  _haut.copy(_a).normalize()
  _est.copy(_b).sub(_a)
  // orthogonalisation : `placer` a fait monter les deux points d'une hauteur
  // qui n'est pas la même (le sol change), donc la corde n'est pas horizontale
  _est.addScaledVector(_haut, -_est.dot(_haut))
  if (_est.lengthSq() < 1e-24) _est.set(1, 0, 0) // dégénéré : n'arrive qu'au pôle
  _est.normalize()
  // `sud = est × haut` — vérifié contre `repereGlobe` de `monde/frontiere-rendu.js`
  // (est × haut = (sla·slo, −cla, sla·clo) = sud), et le test le confronte.
  _sud.copy(_est).cross(_haut)
  return { est: _est.clone(), haut: _haut.clone(), sud: _sud.clone() }
}

/**
 * La pose complète d'une cote sur le globe : position, orientation, échelle.
 *
 * @param {object} poseur celui de `monde/sol-globe.js` (`globe: true`)
 * @param {number} x @param {number} z coordonnées de BLOC
 * @param {number} y altitude de BLOC (sol dessiné + dégagement)
 * @returns {{position: THREE.Vector3, quaternion: THREE.Quaternion, echelle: number}}
 */
export function poseCoteGlobe(poseur, x, z, y) {
  const { est, haut, sud } = repereCote(poseur, x, z, y)
  const p = poseur.placer(x, z, y)
  // ⚠️ **LES COLONNES SONT L'IMAGE DES AXES DU BLOC** — `makeBasis(X, Y, Z)`
  // attend exactement ça, et c'est `rotationVersGlobe` mot pour mot :
  // colonneX = est, colonneY = haut, colonneZ = sud.
  _m.makeBasis(est, haut, sud)
  const q = new THREE.Quaternion().setFromRotationMatrix(_m)
  return { position: new THREE.Vector3(p.x, p.y, p.z), quaternion: q, echelle: poseur.rapportSimilitude() }
}

/**
 * @param {object} [opts.poseur] le poseur de `monde/sol-globe.js`. `null` ou
 *   plat ⇒ le drapage du dépôt, au bit près.
 */
export function createLabels(sample, seed, { real = false, toFeet, ink, poseur = null } = {}) {
  const group = new THREE.Group()
  const rng = mulberry32(seed * 13 + 29)
  const surGlobe = !!poseur?.globe
  // ⛔ **LA MARQUE QUI INTERDIT LE PAS DE FENÊTRE.** `f3AncreAuSol` /
  // `f3SuitAuSol` (main.js) ajoutent le décalage de fenêtre aux positions des
  // enfants et translatent le groupe de −fenêtre : c'est juste tant que les
  // enfants sont en coordonnées de BLOC. Sur la sphère ils portent des points de
  // GLOBE à ~100 unités de l'origine ; leur ajouter une fenêtre de bloc les
  // enverrait à des centaines de kilomètres, et le test d'octogone
  // (`|x| > demi`) les masquerait tous. Le drapeau se lit là-bas.
  group.userData.espaceGlobe = surGlobe
  // le sol à consulter : celui que le GLOBE dessine quand il y en a un, celui du
  // bloc sinon. `poseur.hauteur` rend déjà des unités de bloc et retombe tout
  // seul sur `sample` quand aucune tuile ne couvre (`monde/sol-globe.js`).
  const sol = surGlobe ? (x, z) => poseur.hauteur(x, z) : sample

  // ⛔ **LA TOPONYMIE FICTIVE NE SORT QUE SUR LE TERRAIN PROCÉDURAL, ET JAMAIS
  // SUR LA SPHÈRE.** `!real` disait déjà la première moitié ; `!surGlobe` dit
  // la seconde, à voix haute, pour que « plaquer Monument Valley sur les
  // Alpes » soit impossible par CONSTRUCTION et pas par coïncidence.
  if (!real && !surGlobe) {
    const region = makeLabelMesh('N A V A J O   P L A T E A U', { size: 110, italic: false, spacing: 0.9, opacity: 0.78, color: ink }, 22)
    region.rotation.x = -Math.PI / 2
    region.position.set(0, 0, -12.5)
    region.position.y = settleHeight(sample, 0, -12.5, 11)
    group.add(region)

    const names = [...PLACE_NAMES].sort(() => rng() - 0.5).slice(0, 7)
    names.forEach((name) => {
      const angle = rng() * Math.PI * 2
      const dist = BASIN_BLEND + 2.5 + rng() * 12
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      const width = 3.6 + rng() * 1.8
      const mesh = makeLabelMesh(name, { size: 96, italic: true, spacing: 0.3, opacity: 0.85, color: ink }, width)
      mesh.rotation.x = -Math.PI / 2
      mesh.rotation.z = (rng() - 0.5) * 0.7
      mesh.position.set(x, settleHeight(sample, x, z, width / 2), z)
      group.add(mesh)
    })
  }

  // COTES D'ALTITUDE, EN MÈTRES. Elles étaient en PIEDS et sans unité : sur le
  // lac d'Annecy (447 m) la carte affichait « 1480 », un chiffre juste en
  // pieds mais que tout lecteur lit en mètres — et faux d'un facteur 3,28.
  // Le reste de l'app est en mètres (« 2 750 M »), les cotes le sont aussi.
  const spotCount = real ? 14 : 9
  const minDist = real ? 3 : BASIN_BLEND + 1
  for (let i = 0; i < spotCount; i++) {
    const angle = rng() * Math.PI * 2
    const dist = minDist + rng() * (24 - minDist)
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist
    // ⚡ **LA COTE EST CELLE DU RELIEF QU'ON REGARDE.** Sur la sphère c'est le
    // sol DESSINÉ par le globe, pas celui du bloc plat : les deux diffèrent de
    // −72 m à +98,7 m à La Réunion (mesure en tête de `peaks.js`), et une cote
    // qui annonce l'altitude d'une autre surface que celle qu'elle touche est
    // exactement le mensonge que ce curseur est censé corriger.
    const h = sol(x, z)
    const feet = toFeet ? toFeet(h) : Math.round(4800 + h * 420 + rng() * 40)
    const metres = Math.round(feet / 3.28084)
    const mesh = makeLabelMesh(`· ${metres.toLocaleString('fr-FR')} m`, { size: 78, italic: false, spacing: 0.06, opacity: 0.85, color: ink ?? '#2a241c' }, 1.5)
    if (surGlobe) {
      // ⚠️ **LA ROTATION PART DANS LA GÉOMÉTRIE, PAS DANS LE MESH.** Le
      // quaternion du repère local écrase `mesh.rotation` en entier — c'est le
      // même piège que le `translateX(-50%)` des cartouches de sommet. En la
      // cuisant dans la géométrie, la normale du plan devient `+Y` du mesh, et
      // le repère local n'a plus qu'à envoyer `+Y` sur le haut local.
      mesh.geometry.rotateX(-Math.PI / 2)
      const pose = poseCoteGlobe(poseur, x, z, h + DEGAGEMENT_COTE)
      mesh.position.copy(pose.position)
      mesh.quaternion.copy(pose.quaternion)
      // ② la SEULE longueur qui se convertit à la main : voir l'en-tête.
      mesh.scale.setScalar(pose.echelle)
    } else {
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(x, h + DEGAGEMENT_COTE, z)
    }
    group.add(mesh)
  }

  return group
}

export function disposeLabels(group) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose()
      o.material.map?.dispose()
      o.material.dispose()
    }
  })
}
