// The relief sits on a solid slab — walls drop from the terrain's border down
// to a base, a bottom cap closes it, and a wide neutral table beneath catches
// the slab's shadow. Turns the floating map into a physical object the moment
// its edges come into view (see the museum-relief references).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { PBR_BY_ID, GLASS_BY_ID } from './material-presets.js'
import { TEXTURE_BUILDERS, microRoughnessTextures, rugositeRecentree } from './material-textures.js'
import { exposantCoin } from './fenetre-clip.js' // module sans dépendance : pas de cycle

const HALF = TERRAIN_SIZE / 2
const UVSCALE = 6 // world units per texture tile on the socle walls
const INTERIOR_STEPS = 12 // coarse grid to find the global min (basin guard)

// ═══════════════════ CE QUI DONNE SA MATIÈRE AU SOCLE ════════════════════════
//
// Le socle était « très lisse, trop parfait » — et pour quatre raisons cumulées,
// toutes mesurées. Deux se réparent ici, dans la géométrie.
//
// 1. UNE SEULE NORMALE PAR FACE. `pushTri` calcule la normale au produit
//    vectoriel et la recopie sur les trois sommets. Sur un flanc plan, tous les
//    triangles partagent la même : N·L est constant, l'environnement est
//    échantillonné dans une seule direction, et chaque flanc devient UNE couleur
//    sur des milliers de pixels. D'où le chanfrein : aucune arête réelle n'a un
//    rayon nul (sciage, ponçage, démoulage laissent toujours quelques dixièmes
//    de millimètre), et ce rayon capte une ligne spéculaire continue que l'œil
//    lit comme de la matière. Comme les normales sont par face, la bande reçoit
//    la sienne : liseré NET, aucun lissage.
//
// 2. AUCUNE OMBRE DE CONTACT. Le SSAO est éteint aux quatre paliers machine et
//    la table est un ShadowMaterial transparent : du côté éclairé, le mur
//    rencontre le vide. Dans une vitrine de musée, la ligne où la maquette
//    rejoint son socle est TOUJOURS la zone la plus sombre — l'angle rentrant ne
//    voit qu'une fraction du ciel. On la cuit donc en couleur de sommet.
//    ⚠️ Et c'est un contournement : `aoMap` est impossible ici, three la lit sur
//    `uv1` et cet attribut n'existe pas dans cette géométrie. Un attribut
//    `color` n'en a pas besoin.
//
// Les valeurs ci-dessous sont des garde-fous, pas des goûts :
export const SOCLE_CHANFREIN = 0.05 // largeur ET profondeur du liseré, en unités
// monde. ⚠️ Un chanfrein trop large bascule dans le plastique injecté. Le bloc
// fait 56 unités et occupe ~1 000 px cadré large, soit ~18 px/unité : à 0,05 le
// liseré reste SOUS le pixel de loin (il ne se voit pas comme une facette) et
// devient net dès qu'on s'approche d'une arête.
export const SOCLE_AO_BANDE = 0.12 // hauteur de la cuisson, en fraction du mur
export const SOCLE_AO_FORCE = 0.2 // assombrissement au contact. Au-delà de ces
// deux valeurs on ne cuit plus un contact, on peint une vignette.
export const SOCLE_MARE_FORCE = 0.22 // occlusion ambiante de la TABLE par le
// bloc, tout autour de lui (voir _paintContactPool). Multipliée : elle mord sur
// une table claire et s'efface sur une table sombre.

// Occlusion de contact : 1 au grand jour, 1 − force au pied du mur, chute en
// carré (le ciel se rouvre vite quand on s'éloigne de l'angle rentrant). Pur.
export function contactAO(y, baseY, bande, force = SOCLE_AO_FORCE) {
  if (!(bande > 0) || !(force > 0)) return 1
  const t = Math.max(0, Math.min(1, (y - baseY) / bande))
  const k = 1 - t
  return 1 - force * k * k
}


// Pure: sample the border ring and pick a base level. `samples` per side should
// match the terrain mesh resolution so the wall top sits EXACTLY on the relief
// border — a coarser ring leaves gaps you can see the underside through. baseY
// sits `depth` below the LOWEST point anywhere on the patch (not just the
// border) so a deep interior basin can never pierce the base plane. Tested.
export function computeSlab(sample, depth, samples = 256, cornerRadius = 0, cornerExp = 2) {
  const n = Math.max(8, Math.round(samples))
  const r = Math.max(0, Math.min(cornerRadius, HALF - 1))
  const expo = Math.max(2, cornerExp) // superellipse exponent (2 = circle)
  let borderMin = Infinity
  let globalMin = Infinity
  const ring = [] // clockwise from the -x/-z corner
  const edge = (x, z) => {
    const y = sample(x, z)
    if (y < borderMin) borderMin = y
    if (y < globalMin) globalMin = y
    ring.push({ x, z, y })
  }
  if (r === 0) {
    // square footprint (default): 4 sides × n samples, exactly on the mesh grid
    for (let i = 0; i < n; i++) edge(-HALF + (TERRAIN_SIZE * i) / n, -HALF)
    for (let i = 0; i < n; i++) edge(HALF, -HALF + (TERRAIN_SIZE * i) / n)
    for (let i = 0; i < n; i++) edge(HALF - (TERRAIN_SIZE * i) / n, HALF)
    for (let i = 0; i < n; i++) edge(-HALF, HALF - (TERRAIN_SIZE * i) / n)
  } else {
    // rounded-rectangle footprint: straight runs on the mesh grid spacing, with
    // a quarter-circle arc filleting each of the four salient vertical corners.
    // Traces the same clockwise perimeter so the wall builder is unchanged.
    const inner = HALF - r
    const step = TERRAIN_SIZE / n
    const straightN = Math.max(1, Math.round((inner * 2) / step))
    const arcN = Math.max(3, Math.round(n / 48))
    const line = (x0, z0, x1, z1) => {
      for (let i = 0; i < straightN; i++) {
        const t = i / straightN
        edge(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)
      }
    }
    // superellipse corner: point = center + r·(sgn·|cos|^(2/n), sgn·|sin|^(2/n)).
    // n=2 reduces to a circular arc; higher n bulges toward a squircle. Matches
    // the terrain shader's p-norm clip so the map edge and wall stay aligned.
    const arc = (cx, cz, a0, a1) => {
      for (let i = 0; i < arcN; i++) {
        const a = a0 + ((a1 - a0) * i) / arcN
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        const ex = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / expo) * r
        const ez = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / expo) * r
        edge(cx + ex, cz + ez)
      }
    }
    line(-inner, -HALF, inner, -HALF) //  top edge   (z=-HALF)
    arc(inner, -inner, -Math.PI / 2, 0) //  corner +x −z
    line(HALF, -inner, HALF, inner) //  right edge  (x=+HALF)
    arc(inner, inner, 0, Math.PI / 2) //  corner +x +z
    line(inner, HALF, -inner, HALF) //  bottom edge (z=+HALF)
    arc(-inner, inner, Math.PI / 2, Math.PI) //  corner −x +z
    line(-HALF, inner, -HALF, -inner) //  left edge   (x=−HALF)
    arc(-inner, -inner, Math.PI, Math.PI * 1.5) //  corner −x −z
  }
  // coarse interior sweep for the global minimum
  for (let j = 1; j < INTERIOR_STEPS; j++) {
    for (let i = 1; i < INTERIOR_STEPS; i++) {
      const y = sample(-HALF + (TERRAIN_SIZE * i) / INTERIOR_STEPS, -HALF + (TERRAIN_SIZE * j) / INTERIOR_STEPS)
      if (y < globalMin) globalMin = y
    }
  }
  return { ring, borderMin, globalMin, baseY: globalMin - depth }
}

// Build the slab wall + bottom-cap geometry for a relief `sample`. Pure and
// self-contained (extracted from Plinth.rebuild so the block-grid neighbours
// get the EXACT same socle). `baseYFloor` (optional) forces the base level no
// higher than this — the damier shares the main block's baseY for a flat grid
// bottom without ever piercing a deeper neighbour's relief.
// `chanfrein` : largeur du liseré d'arête haute (0 = géométrie d'avant, exacte).
// `aoForce` : profondeur de l'occlusion de contact cuite dans l'attribut color.
export function buildSlabWalls(sample, { depth = 7, resolution = 256, cornerR = 0, cornerExp = 2, baseYFloor = null, chanfrein = SOCLE_CHANFREIN, aoForce = SOCLE_AO_FORCE } = {}) {
  const slab = computeSlab(sample, depth, resolution, cornerR, cornerExp)
  const ring = slab.ring
  const baseY = baseYFloor != null ? Math.min(baseYFloor, slab.baseY) : slab.baseY
  const n = ring.length
  // hauteur de mur de référence : le point HAUT du bord. La bande d'occlusion
  // est constante en unités monde (un contact ne s'étire pas avec le mur qui le
  // surplombe) — c'est cette hauteur-là qui la calibre, une fois pour toutes.
  let topMax = -Infinity
  for (const p of ring) if (p.y > topMax) topMax = p.y
  const aoBande = SOCLE_AO_BANDE * Math.max(0, topMax - baseY)
  // le pli ne descend jamais jusqu'au pied, même sur un socle écrasé
  const ch = Math.max(0, Math.min(chanfrein, (topMax - baseY) * 0.25))

  const positions = []
  const normals = []
  const uvs = []
  const couleurs = [] // occlusion de contact, en octets normalisés (3 o/sommet
  // au lieu de 12 en float : la géométrie est reconstruite à CHAQUE déplacement
  // de fenêtre continue, et un octet suffit largement pour une rampe de 20 %)
  const pushTri = (a, b, c, uva, uvb, uvc) => {
    const ab = new THREE.Vector3().subVectors(b, a)
    const ac = new THREE.Vector3().subVectors(c, a)
    const nm = new THREE.Vector3().crossVectors(ab, ac).normalize()
    const tri = [[a, uva], [b, uvb], [c, uvc]]
    for (const [v, uv] of tri) {
      positions.push(v.x, v.y, v.z)
      normals.push(nm.x, nm.y, nm.z)
      uvs.push(uv[0], uv[1])
      const ao = Math.round(255 * contactAO(v.y, baseY, aoBande, aoForce))
      couleurs.push(ao, ao, ao)
    }
  }

  // Rentrée du pli, point par point. On prend la BISSECTRICE des deux arêtes
  // voisines, allongée de 1/cos(θ/2) : le retrait perpendiculaire vaut alors
  // exactement `ch` sur les DEUX faces, y compris dans un angle droit. Une
  // simple direction « vers le centre » y creuserait un cran de ch·(1−1/√2).
  const rentre = new Array(n)
  const nrm = (ax, az, bx, bz) => {
    const dx = bx - ax
    const dz = bz - az
    const L = Math.hypot(dx, dz)
    return L > 1e-12 ? [-dz / L, dx / L] : null // anneau horaire → intérieur
  }
  for (let i = 0; i < n; i++) {
    const p = ring[i]
    const a = nrm(ring[(i - 1 + n) % n].x, ring[(i - 1 + n) % n].z, p.x, p.z)
    const b = nrm(p.x, p.z, ring[(i + 1) % n].x, ring[(i + 1) % n].z)
    const na = a || b
    const nb = b || a
    if (!na || !nb) { rentre[i] = [0, 0]; continue }
    let mx = na[0] + nb[0]
    let mz = na[1] + nb[1]
    const L = Math.hypot(mx, mz)
    if (L < 1e-9) { rentre[i] = [0, 0]; continue }
    mx /= L
    mz /= L
    const cos = Math.max(0.35, mx * na[0] + mz * na[1]) // onglet borné (replis)
    rentre[i] = [(mx * ch) / cos, (mz * ch) / cos]
  }

  let acc = 0
  const pli = (i) => {
    const p = ring[i]
    return new THREE.Vector3(p.x + rentre[i][0], p.y - ch, p.z + rentre[i][1])
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const p = ring[i]
    const q = ring[j]
    const segLen = Math.hypot(q.x - p.x, q.z - p.z)
    const u0 = acc / UVSCALE
    const u1 = (acc + segLen) / UVSCALE
    acc += segLen
    const pTop = new THREE.Vector3(p.x, p.y, p.z)
    const qTop = new THREE.Vector3(q.x, q.y, q.z)
    // le sommet du mur ne bouge PAS : il doit rester exactement sur le bord du
    // relief, sinon on voit le jour sous la carte (le bug de « l'envers »)
    const pHaut = ch > 0 ? pli(i) : pTop
    const qHaut = ch > 0 ? pli(j) : qTop
    const pBot = new THREE.Vector3(pHaut.x, baseY, pHaut.z)
    const qBot = new THREE.Vector3(qHaut.x, baseY, qHaut.z)
    const uv = (v) => [0, (v.y - baseY) / UVSCALE]
    if (ch > 0) {
      pushTri(pTop, pHaut, qTop, [u0, uv(pTop)[1]], [u0, uv(pHaut)[1]], [u1, uv(qTop)[1]])
      pushTri(qTop, pHaut, qHaut, [u1, uv(qTop)[1]], [u0, uv(pHaut)[1]], [u1, uv(qHaut)[1]])
    }
    pushTri(pHaut, pBot, qHaut, [u0, uv(pHaut)[1]], [u0, 0], [u1, uv(qHaut)[1]])
    pushTri(qHaut, pBot, qBot, [u1, uv(qHaut)[1]], [u0, 0], [u1, 0])
  }
  const cen = new THREE.Vector3(0, baseY, 0)
  const capUv = (x, z) => [x / UVSCALE, z / UVSCALE]
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const px = ring[i].x + rentre[i][0]
    const pz = ring[i].z + rentre[i][1]
    const qx = ring[j].x + rentre[j][0]
    const qz = ring[j].z + rentre[j][1]
    pushTri(cen, new THREE.Vector3(qx, baseY, qz), new THREE.Vector3(px, baseY, pz), capUv(0, 0), capUv(qx, qz), capUv(px, pz))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.Uint8BufferAttribute(couleurs, 3, true))
  geo.computeBoundingSphere()
  return { geo, baseY }
}

export class Plinth {
  constructor(scene, params) {
    this.group = new THREE.Group()
    this.group.name = 'plinth'
    scene.add(this.group)

    // slab walls + bottom: a matte stone edge, lit by the scene sun so the cut
    // face reads as thickness. DoubleSide so no viewing angle ever sees through
    // the slab into a culled back face (the "underside" bug).
    // MeshPhysicalMaterial so the same slab can be a matte stone, a polished
    // metal, OR real transmissive glass (transmission/ior/thickness) depending
    // on the preset the user gives it in the Block panel.
    this.wallMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(params.plinthColor ?? '#d8d4cc'),
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
      // OCCLUSION DE CONTACT : elle voyage dans l'attribut `color` de la
      // géométrie. ⚠️ `aoMap` était impossible — three la lit sur `uv1`, et cet
      // attribut n'existe nulle part ici. ⚠️ Le drapeau est posé UNE fois, à la
      // construction : three recompile le programme quand il change, et ce
      // matériau est partagé par les 24 socles du damier et la jupe du mode
      // zone isolée — un basculement en cours de route les gèlerait tous.
      // Corollaire : TOUTE géométrie portée par ce matériau doit fournir un
      // attribut `color`, sinon WebGL sert la valeur générique (0,0,0,1) et la
      // pièce devient NOIRE. buildSlabWalls et buildRegionSkirt le font.
      vertexColors: true,
    })
    this.isGlass = false
    this.walls = new THREE.Mesh(new THREE.BufferGeometry(), this.wallMat)
    this.walls.castShadow = true
    this.walls.receiveShadow = true
    this.group.add(this.walls)

    // CŒUR opaque du bloc de verre (Adrien : « on voit à travers ») — la même
    // géométrie parois+fond, légèrement rétrécie, teintée par le verre : le
    // socle transparent devient un bloc de verre PLEIN. Fini l'intérieur creux
    // (rampes marines vues de dos) et la vue traversante par en dessous.
    this.linerMat = new THREE.MeshStandardMaterial({ color: 0x66707a, roughness: 0.9, metalness: 0 })
    this.liner = new THREE.Mesh(new THREE.BufferGeometry(), this.linerMat)
    this.liner.scale.set(0.985, 0.985, 0.985)
    this.liner.visible = false
    this.group.add(this.liner)

    // the table: a wide plane that shows ONLY the slab's cast shadow. A
    // ShadowMaterial is transparent everywhere else, so the ground reads as the
    // exact scene background color — no grey mismatch, just the shadow.
    this.baseMat = new THREE.ShadowMaterial({ opacity: 0.26 })
    this.base = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE * 3.4, TERRAIN_SIZE * 3.4), this.baseMat)
    this.base.rotation.x = -Math.PI / 2
    this.base.receiveShadow = true
    this.group.add(this.base)

    // OPAQUE studio floor — shown ONLY when an HDRI sky is active (Adrien : « le
    // sol disparaît avec un HDRI »). With a solid/gradient backdrop the shadow
    // base above already reads as the ground (it shows the background through
    // its transparency) ; but an HDRI wraps a sky panorama all around, so without
    // this the socle floats in the sky. It's a LIT MeshStandard, so it follows
    // the day/night cycle on its own. When it's on, the shadow base is hidden so
    // the shadow isn't doubled — this ground receives it directly.
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.96, metalness: 0 })
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE * 3.4, TERRAIN_SIZE * 3.4), this.groundMat)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.ground.visible = false
    this.group.add(this.ground)

    // glass ground-pool: light through a coloured glass casts a coloured shadow
    // on the table. three's transmission can't tint the shadow, so we paint the
    // glass colour into a rounded-rect glow (matching the block footprint) and
    // MULTIPLY it onto the ground — which reads as a coloured shadow that is
    // strong on a light table and fades on a dark one, exactly like real glass.
    this._poolCanvas = document.createElement('canvas')
    this._poolCanvas.width = this._poolCanvas.height = 256
    this._paintContactPool(SOCLE_MARE_FORCE) // état de départ : socle opaque
    this.glassPoolTex = new THREE.CanvasTexture(this._poolCanvas)
    this.glassPoolMat = new THREE.MeshBasicMaterial({
      map: this.glassPoolTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.MultiplyBlending, // coloured shadow: white table × tint = tint
    })
    this.glassPool = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE * 1.08, TERRAIN_SIZE * 1.08), this.glassPoolMat)
    this.glassPool.rotation.x = -Math.PI / 2
    this.glassPool.renderOrder = 1
    this.glassPool.visible = false
    this._poolStrength = SOCLE_MARE_FORCE
    this._poolSpread(1.6) // la mare de contact déborde l'emprise ; le verre non
    this.group.add(this.glassPool)

    this.depth = params.plinthDepth ?? 7
  }

  // Paint the ground-pool: a rounded-rect glow whose centre is the glass colour
  // (lerped from white by `strength`) fading to white at the edges. Multiplied
  // onto the table it becomes a coloured shadow — strong on light, faint on dark.
  _paintGlassPool(hex, strength) {
    const s = Math.max(0, Math.min(1, strength))
    const gc = this._poolCanvas.getContext('2d')
    gc.clearRect(0, 0, 256, 256)
    gc.fillStyle = '#ffffff' // white = multiply no-op → bare table
    gc.fillRect(0, 0, 256, 256)
    if (s <= 0.001) return
    const c = new THREE.Color(hex)
    const ch = (v) => Math.round(255 * (1 - s * (1 - v)))
    gc.save()
    gc.beginPath()
    gc.roundRect(24, 24, 208, 208, 48) // rounded footprint, follows the block
    gc.clip()
    const grad = gc.createRadialGradient(128, 128, 20, 128, 128, 150)
    grad.addColorStop(0, `rgb(${ch(c.r)},${ch(c.g)},${ch(c.b)})`)
    grad.addColorStop(0.6, `rgb(${ch(0.5 + c.r * 0.5)},${ch(0.5 + c.g * 0.5)},${ch(0.5 + c.b * 0.5)})`)
    grad.addColorStop(1, '#ffffff')
    gc.fillStyle = grad
    gc.fillRect(0, 0, 256, 256)
    gc.restore()
  }

  // ─────────────── LA MARE DE CONTACT DES SOCLES OPAQUES ────────────────────
  //
  // POURQUOI. L'ombre portée est d'opacité RIGOUREUSEMENT fixe (ShadowMaterial,
  // 0,26) : même avec un socle parfait, une ombre uniforme trahit la synthèse.
  // Ce qui manque n'est pas de l'ombre de soleil, c'est l'occlusion AMBIANTE que
  // le bloc fait subir à la table tout autour de lui — sur les quatre côtés, y
  // compris du côté éclairé, là où le mur rencontre aujourd'hui le vide.
  //
  // On n'ajoute aucune lumière (three recompile TOUS les programmes de la scène
  // quand le compte change : 1 923 ms de gel, déjà mesuré ici) et aucun rendu
  // supplémentaire : on réutilise EXACTEMENT le mécanisme du halo de verre — un
  // canevas multiplié sur la table — en teinte neutre. Le quad est simplement
  // agrandi, parce que le halo du verre se lit SOUS le bloc alors que celui-ci
  // se lit AUTOUR : sa mare doit déborder l'emprise.
  //
  // Multiplication : forte sur une table claire, quasi nulle sur une table
  // sombre. C'est le comportement d'une vraie occlusion, pas d'un calque gris.
  _paintContactPool(force) {
    const s = Math.max(0, Math.min(1, force))
    const gc = this._poolCanvas.getContext('2d')
    gc.clearRect(0, 0, 256, 256)
    gc.fillStyle = '#ffffff' // blanc = multiplication neutre → table nue
    gc.fillRect(0, 0, 256, 256)
    if (s <= 0.001) return
    const v = Math.round(255 * (1 - s))
    gc.save()
    // ⚠️ Un dégradé RADIAL laisserait les quatre coins du bloc hors de la mare
    // (28·√2 = 39,6 unités contre 28 au milieu d'un côté). On floute donc le
    // rectangle de l'emprise : la mare épouse le socle, coins compris.
    // Sans `filter` (moteur ancien) le flou est ignoré : il reste un carré net
    // exactement sous le bloc, donc invisible — la dégradation est nulle.
    gc.filter = 'blur(13px)'
    gc.fillStyle = `rgb(${v},${v},${v})`
    gc.beginPath()
    gc.roundRect(48, 48, 160, 160, 34) // emprise du bloc sur ce quad élargi
    gc.fill()
    gc.restore()
    gc.filter = 'none'
  }

  // Bascule le quad de mare entre les deux usages : le halo du verre se lit sous
  // l'emprise (facteur 1,08), la mare de contact autour (facteur 1,6).
  _poolSpread(k) {
    const f = k / 1.08
    this.glassPool.scale.set(f, f, 1)
  }

  // Apply a socle material. `finish` is 'solid' (PBR presets) or 'glass'
  // (transmissive presets). `diffusion`/`projection` are the live glass sliders
  // (frost roughness, ground-pool strength); undefined = use the preset value.
  setMaterial({ finish = 'solid', id, diffusion, projection = 0.5, glassBump = 0.6, bump = 1.3, refract = 0.25, fallbackColor = '#d8d4cc' } = {}) {
    const m = this.wallMat
    if (finish === 'glass') {
      const p = GLASS_BY_ID[id] || GLASS_BY_ID.clear
      this.isGlass = true
      this._pbrColored = false
      const diff = diffusion == null ? p.diffusion : diffusion
      // Frosted/diffuse glass driven by a micro-facet NORMAL map rather than raw
      // transmission roughness (which mip-blurs into chunky artefacts). A capped
      // roughness gives a soft blur; the frost bump does the real scattering, so
      // it reads grainy and diffuse without the visual bugs.
      const frost = TEXTURE_BUILDERS.frost()
      m.color.set('#ffffff') // clear base; the tint rides on attenuation
      m.map = null
      m.normalMap = frost.normalMap
      m.roughnessMap = frost.roughnessMap
      m.normalScale.set(glassBump, glassBump)
      m.metalness = 0
      m.roughness = Math.min(0.06 + diff * 0.34, 0.42) // capped — no chunky mip blur
      m.transmission = p.transmission
      // DÉFORMATION pilotée (tirette Adrien, 0..1) — l'offset de réfraction
      // de three est ∝ thickness × (ior-1) : à 0 le verre est limpide (aucune
      // copie fantôme), à 1 il tord franchement ce qu'on voit au travers. La
      // TEINTE Beer-Lambert est préservée quel que soit le réglage (le ratio
      // thickness/attenuationDistance est conservé).
      const refr = Math.max(0, Math.min(1, refract))
      const thick = 0.4 + refr * 6
      m.ior = 1 + (p.ior - 1) * (0.12 + 0.88 * refr)
      m.thickness = thick
      m.attenuationColor.set(p.color)
      m.attenuationDistance = p.attenuation * (thick / p.thickness)
      // le cœur prend la couleur du verre, assombrie — un bloc PLEIN
      this.linerMat.color.set(p.color).multiplyScalar(0.72)
      this.liner.visible = this.group.visible
      m.clearcoat = 0
      m.anisotropy = 0
      m.specularIntensity = 1
      m.transparent = true
      m.envMapIntensity = 1.4
      this._paintGlassPool(p.color, projection)
      this._poolSpread(1.08) // le halo se lit SOUS le verre
      this.glassPoolTex.needsUpdate = true
      this._poolStrength = projection
      this.glassPool.visible = this.group.visible && projection > 0.001
    } else {
      const p = PBR_BY_ID[id] || { color: fallbackColor, roughness: 0.95, metalness: 0 }
      this.isGlass = false
      this.liner.visible = false // les solides sont déjà pleins
      // a real PBR preset owns the wall colour — the dark-mode/edge-colour reset
      // in setColors must not clobber it (only the plain default 'stone' takes it)
      this._pbrColored = !!(id && id !== 'stone')
      m.color.set(p.color)
      m.metalness = p.metalness ?? 0
      m.roughness = p.roughness ?? 0.9
      m.transmission = 0
      m.thickness = 0
      m.attenuationDistance = Infinity
      m.clearcoat = p.clearcoat ?? 0
      m.clearcoatRoughness = p.clearcoatRoughness ?? 0
      m.ior = p.ior ?? 1.5
      m.transparent = false
      m.envMapIntensity = p.envMapIntensity ?? 1
      // textured finishes (carbon, wood): albedo + normal + roughness maps; the
      // bump slider drives normalScale (exaggerated relief)
      const build = p.tex && TEXTURE_BUILDERS[p.tex]
      if (build) {
        const t = build()
        m.map = t.map ?? null
        m.normalMap = t.normalMap
        m.roughnessMap = t.roughnessMap
        const b = bump * (p.normalScale ?? 1)
        m.normalScale.set(b, b)
        m.anisotropy = p.anisotropy ?? 0
        m.anisotropyRotation = p.anisotropyRotation ?? 0
      } else {
        // RUPTURE DE LA RUGOSITÉ, PAS DE LA COULEUR. 22 finitions sur 25 n'ont
        // aucune carte : sans carte de rugosité, le spéculaire est
        // mathématiquement uniforme, et c'est le signal « synthétique » numéro
        // un. On ne touche NI l'albédo NI la normale — la sobriété est intacte,
        // seule la micro-géométrie cesse d'être constante.
        m.map = null
        m.normalMap = null
        m.roughnessMap = microRoughnessTextures().roughnessMap
        // la carte ne sait que creuser (un octet ne code pas > 1) : on relève la
        // rugosité de base pour que la MOYENNE retombe sur celle du préréglage
        m.roughness = rugositeRecentree(p.roughness ?? 0.9)
        m.normalScale.set(1, 1)
        m.anisotropy = p.anisotropy ?? 0
        m.anisotropyRotation = 0
      }
      // mare de contact neutre : le socle opaque cesse de rencontrer le vide
      this._paintContactPool(SOCLE_MARE_FORCE)
      this._poolSpread(1.6)
      this.glassPoolTex.needsUpdate = true
      this._poolStrength = SOCLE_MARE_FORCE
      this.glassPool.visible = this.group.visible && !this._slabOnly
    }
    m.needsUpdate = true
  }

  // give the socle walls their own studio env map (overrides scene.environment
  // for this material only, so metals/glass/carbon get punchy reflections while
  // the terrain keeps the neutral room env)
  setEnvMap(tex) {
    this.wallMat.envMap = tex
    this.wallMat.needsUpdate = true
  }

  // rebuild the walls to hug the current relief border; call after every
  // terrain rebuild (the heightfield changed)
  // `baseYFloor` : plancher IMPOSÉ du socle, au lieu du point bas trouvé en
  // balayant le champ. Le damier s'en sert déjà pour que ses dalles voisines
  // partagent le socle du centre (block-grid.js). La fenêtre continue s'en sert
  // pour la raison symétrique — voir `socleEmprise` dans main.js.
  rebuild(terrain, params, baseYFloor = null) {
    const sample = terrain.sample
    if (!sample) return
    this.depth = params.plinthDepth ?? this.depth

    // match the wall ring to the terrain mesh edge resolution so the top of the
    // walls lands exactly on the relief border (no gaps → no visible underside).
    // The corner radius rounds the four salient vertical edges; the terrain
    // shader clips to the SAME rounded rectangle so nothing overhangs the walls.
    // v42: meme formule que le clip de la mer (rayon clampe, cercle)
    const cornerR = Math.min(TERRAIN_SIZE / 2 - 0.05, Math.max(0.05, (params.slabCorner ?? 0) * TERRAIN_SIZE))
    const cornerExp = exposantCoin(params.slabCornerSmoothing)
    const { geo, baseY } = buildSlabWalls(sample, { depth: this.depth, resolution: params.resolution ?? 256, cornerR, cornerExp, baseYFloor })
    this.baseY = baseY
    this.base.position.y = baseY
    this.ground.position.y = baseY - 0.02 // opaque floor just under the shadow base
    this.glassPool.position.y = baseY + 0.05 // glass colour pools just over the table
    this.walls.geometry.dispose()
    this.walls.geometry = geo
    this.liner.geometry = geo // même géométrie, rétrécie par liner.scale
    // le rétrécissement Y (1,5 %) remonterait le fond du cœur AU-DESSUS du
    // fond de verre vu d'en bas — on recale son origine pour rester dedans
    this.liner.position.y = baseY * 0.015 - 0.02
  }

  setColors(params) {
    // glass keeps its clear white base (tint rides on attenuation), and a real
    // PBR preset keeps its own colour — only the plain default socle takes the
    // edge/dark-mode colour.
    if (!this.isGlass && !this._pbrColored) this.wallMat.color.set(params.plinthColor ?? '#d8d4cc')
    // the table is a ShadowMaterial (no color — it only darkens the background
    // where the shadow lands); the dark sheet reads a touch stronger
    this.baseMat.opacity = params.darkMode ? 0.34 : 0.24
  }

  setVisible(v) {
    this.group.visible = v
    this.walls.visible = v && !this._slabOnly
    // la mare sert AUSSI aux socles opaques depuis qu'elle porte l'occlusion de
    // contact de la table : ce n'est plus une affaire de verre
    this.glassPool.visible = v && !this._slabOnly && (this._poolStrength ?? 0) > 0.001
    this.liner.visible = v && !this._slabOnly && this.isGlass
  }

  // ZONE ISOLÉE : plus de bloc, mais la DALLE reste — c'est elle qui reçoit
  // l'ombre portée de la découpe (Adrien : « le mode isolé doit projeter ses
  // ombres sur la dalle du dessous »). Auparavant setVisible(false) emportait
  // tout, y compris le plan qui capte l'ombre : la zone isolée flottait sans
  // rien sous elle. On la remonte au zéro absolu du relief, le même plan que
  // les textes du cartouche et que le pied de la découpe.
  setSlabOnly(on, baseY = null) {
    this._slabOnly = !!on
    if (on && Number.isFinite(baseY)) {
      this.baseY = baseY
      this.base.position.y = baseY
      this.ground.position.y = baseY - 0.02
    }
    this.group.visible = true
    this.setVisible(true)
  }

  // opaque floor: on with an HDRI (keeps a ground under the socle), off with a
  // solid/gradient backdrop (the shadow base already reads as the ground). When
  // it's on, hide the shadow base so the cast shadow isn't doubled.
  setGroundVisible(v) {
    this.ground.visible = !!v
    this.base.visible = !v
  }
  setGroundColor(hex) {
    if (hex) this.groundMat.color.set(hex)
  }
}
