// The relief sits on a solid slab — walls drop from the terrain's border down
// to a base, a bottom cap closes it, and a wide neutral table beneath catches
// the slab's shadow. Turns the floating map into a physical object the moment
// its edges come into view (see the museum-relief references).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { PBR_BY_ID, GLASS_BY_ID } from './material-presets.js'
import { TEXTURE_BUILDERS, microRoughnessTextures, rugositeRecentree } from './material-textures.js'
import { exposantCoin, arcCoin } from './fenetre-clip.js' // module sans dépendance : pas de cycle
import { masqueDepuisContour } from './damier-bords.js' // idem : pur, aucune importation

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
export const SOCLE_CHANFREIN = 0.16 // largeur ET profondeur du liseré, en unités
// monde. ⚠️ Un chanfrein trop large bascule dans le plastique injecté. Le bloc
// fait 56 unités et occupe ~1 000 px cadré large, soit ~18 px/unité.
// ÉLARGI DE 0,05 À 0,16 (Adrien : « rends le plus visible ») : à 0,05 le liseré
// restait sous le pixel de loin et ne se lisait qu'en s'approchant d'une arête ;
// à 0,16 il fait ~3 px au cadrage large, c'est-à-dire une vraie ligne, sans
// atteindre l'épaisseur qui ferait facette.

// ═══════════════ LE CONGÉ DU DESSOUS — LE GESTE DE LA RÉFÉRENCE ══════════════
//
// Adrien, capture d'un diorama : « il est vraiment arrondi, et c'est un vrai
// chanfrein dessous ». L'arête basse était à 90° NET — la seule arête vive qui
// restait après le chanfrein du haut, et la plus visible : c'est elle qui porte
// l'ombre de contact et la ligne où le bloc touche sa table.
//
// ⚠️ CE N'EST PAS UN CHANFREIN, C'EST UN CONGÉ, et la différence se voit. Un
// chanfrein (une seule facette) rend UNE ligne spéculaire ; un congé en rend une
// qui GLISSE quand la caméra tourne, et c'est ce glissement que l'œil lit comme
// « massif ». Il faut donc plusieurs segments ET des normales analytiques
// lisses : trois segments à normales de face se liraient comme trois facettes,
// soit l'inverse exact de l'intention.
// ══════════ OÙ EST LA PEAU DU BLOC — UNE SEULE RÉPONSE, POUR TOUT LE MONDE ═══
//
// LE DÉFAUT DU 2026-08-03, « on voit l'eau à travers le bloc ». Trois modules
// décidaient chacun de leur côté où finit le bloc :
//   · le mur du socle, à HALF − chanfrein            → 27,950 avec l'ancien 0,05
//   · le clip de la surface de mer, à HALF × 0,998   → 27,944
//   · le flanc d'eau (buildRimGeometry), −0,02       → 27,924
// Ils s'accordaient à SIX MILLIÈMES d'unité près, et cet accord n'était écrit
// nulle part : c'était une coïncidence. Élargir le chanfrein à 0,16 a ramené le
// mur à 27,840, donc DERRIÈRE l'eau — et le flanc d'eau, qui court du fond de
// mer jusqu'à la surface, s'est mis à masquer tout le mur sur cette hauteur.
//
// Ce n'est donc pas un décalage à rattraper, c'est une définition qui manquait.
// La voici, et les trois modules la lisent au lieu de la deviner.
export const SOCLE_MARGE_EAU = 0.06 // de quoi l'eau reste EN DEDANS du mur

/** Le rayon du mur du socle sous le chanfrein — la vraie silhouette du bloc. */
export function rayonMurSocle(chanfrein = SOCLE_CHANFREIN) {
  return HALF - Math.max(0, chanfrein)
}
/** Où l'eau doit s'arrêter pour rester dans le bloc, quoi qu'il arrive. */
export function rayonEauDansSocle(chanfrein = SOCLE_CHANFREIN) {
  return rayonMurSocle(chanfrein) - SOCLE_MARGE_EAU
}
/** Le rayon de coin correspondant : rentrer d'une distance d réduit d'autant. */
export function rayonCoinEau(coinSocle, chanfrein = SOCLE_CHANFREIN) {
  return Math.max(0.05, coinSocle - Math.max(0, chanfrein) - SOCLE_MARGE_EAU)
}

export const SOCLE_ARRONDI = 0.9 // rayon du congé bas, en unités monde
export const SOCLE_ARRONDI_SEG = 3 // segments de l'arc. 3 suffit AVEC les
// normales lisses : c'est la normale qui fait l'arrondi, la silhouette ne se
// lit qu'au contre-jour. Chaque segment de plus coûte 2 triangles par point
// d'anneau, et l'anneau en compte près de trois mille.
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

// ════════ LA BANDE D'OCCLUSION SE MESURE UNE FOIS, POUR TOUT LE MONDE ════════
//
// LE DÉFAUT D'ADRIEN, « en mode isolé les socles semblent tous différents ».
// Chaque constructeur mesurait le point HAUT de SA propre pièce et en tirait sa
// bande. Or le damier isolé pose 23 jupes côte à côte : celle qui coupe un
// sommet mesurait 900 m de mur et cuisait 108 m d'assombrissement, sa voisine de
// plaine 200 m de mur et 24 m. Deux murs qui se touchent, deux hauteurs de pied
// sombre — les socles ne se ressemblaient plus, alors que la lumière et la
// matière étaient rigoureusement les mêmes.
//
// Une occlusion de contact ne dépend PAS de la hauteur du mur qui la surplombe :
// c'est la géométrie de l'angle rentrant qui la fixe, et cet angle est le même
// partout. La bande est donc une longueur MONDE, calculée une fois sur la pièce
// la plus haute de la fournée, puis servie à toutes — exactement comme `baseY`,
// qui est déjà commun pour la raison jumelle (une marche à chaque jointure).
export function bandeContact(hautMax, baseY) {
  return SOCLE_AO_BANDE * Math.max(0, (hautMax ?? 0) - (baseY ?? 0))
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
    // ⚠️ LA DENSITÉ DE L'ARC SE MESURE EN LONGUEUR, PAS EN ANGLE — et ce n'est
    // pas la même chose sur une superellipse. L'ancienne règle (n/48) donnait
    // CINQ segments par coin quelle que soit sa taille ; la remplacer par un
    // compte proportionnel au rayon ne suffisait pas non plus, parce que le
    // paramétrage angulaire se tasse près des axes (0,505 d'écart pour un pas de
    // 0,219, mesuré). C'est ce trou que le chanfrein élargi met en évidence, et
    // qu'Adrien lit « faible dans les angles ». Voir arcCoin.
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
      for (const [ex, ez] of arcCoin(a0, a1, r, expo, step)) edge(cx + ex, cz + ez)
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
// `aoBande` : la bande d'occlusion IMPOSÉE, en unités monde (voir bandeContact).
// Le damier s'en sert pour que ses voisines portent la même que le bloc central ;
// sans elle, chacune mesurerait la sienne sur son propre relief.
// `arrondi` : rayon du congé bas (0 = arête vive, la géométrie d'avant).
//
// `masqueArrondi` : un réel par sommet du contour (1 = arrondi, 0 = arête vive),
// pour que les jointures du damier soient PLATES. Deux congés qui se font face
// à une jointure creusent une rainure — c'est le défaut que ce paramètre
// supprime. null = arrondi uniforme, la géométrie d'avant, exacte.
//
// `bords` : le raccourci de l'appelant qui ne veut pas retracer le contour lui-
// même — `{ nord, est, sud, ouest }` (cf. damier-bords.js), converti ICI en
// masque à partir du contour que computeSlab vient de rendre.
//
// ⚠️ POURQUOI CE SECOND CHEMIN EXISTE. Calculer le masque chez l'appelant
// l'oblige à retracer le contour, donc à rappeler computeSlab — et computeSlab
// ÉCHANTILLONNE LE RELIEF (4·n points de bord + un balayage intérieur), c'est
// l'essentiel des ~9,4 ms d'une reconstruction de mur. Le damier en fait
// jusqu'à 36 par chargement (block-grid.js, egaliseHauteurs) : le doublement
// serait payé pour retrouver un contour qu'on a déjà sous la main. Et deux
// tracés, c'est deux occasions de diverger — un masque décalé d'un sommet ne se
// voit pas en test unitaire, il se voit à l'écran. `masqueArrondi` gagne quand
// les deux sont donnés.
export function buildSlabWalls(sample, { depth = 7, resolution = 256, cornerR = 0, cornerExp = 2, baseYFloor = null, chanfrein = SOCLE_CHANFREIN, aoForce = SOCLE_AO_FORCE, aoBande = null, arrondi = SOCLE_ARRONDI, arrondiSeg = SOCLE_ARRONDI_SEG, masqueArrondi = null, bords = null } = {}) {
  const slab = computeSlab(sample, depth, resolution, cornerR, cornerExp)
  const ring = slab.ring
  const baseY = baseYFloor != null ? Math.min(baseYFloor, slab.baseY) : slab.baseY
  const n = ring.length
  // hauteur de mur de référence : le point HAUT du bord. La bande d'occlusion
  // est constante en unités monde (un contact ne s'étire pas avec le mur qui le
  // surplombe) — c'est cette hauteur-là qui la calibre, une fois pour toutes.
  let topMax = -Infinity
  for (const p of ring) if (p.y > topMax) topMax = p.y
  const bande = Number.isFinite(aoBande) ? Math.max(0, aoBande) : bandeContact(topMax, baseY)
  // le pli ne descend jamais jusqu'au pied, même sur un socle écrasé
  const ch = Math.max(0, Math.min(chanfrein, (topMax - baseY) * 0.25))

  // le congé bas ne mange jamais plus du quart du mur, comme le chanfrein
  const rd = Math.max(0, Math.min(arrondi, (topMax - baseY) * 0.25))
  const segArc = rd > 0 ? Math.max(1, Math.round(arrondiSeg)) : 0

  // ⚠️ LE CHANFREIN ET LE CONGÉ SONT DÉSORMAIS PAR SOMMET. Ils étaient deux
  // scalaires ; sur un damier, les côtés qui touchent une autre case doivent
  // rester vifs. Les fonctions ci-dessous rendent la valeur d'AVANT quand aucun
  // masque n'est fourni — le bloc isolé est bit à bit inchangé (verrouillé par
  // empreinte dans test/damier-bords.test.js).
  const masque = masqueArrondi || (bords ? masqueDepuisContour(ring, HALF, bords) : null)
  // ⚠️ UN MASQUE QUI N'A PAS LA LONGUEUR DU CONTOUR EST UNE ERREUR, PAS UN CAS À
  // RATTRAPER. Le rattrapage d'avant (`masque[k] ?? 1`) rendait l'arrondi par
  // défaut aux sommets manquants : un masque tronqué ou tracé avec d'autres
  // réglages — le seul vrai risque de cette option, et l'argument même qui a
  // fait ajouter `bords` à côté — donnait alors une géométrie plausible, avec la
  // rainure toujours là et rien pour le dire. La longueur du contour dépend de
  // `resolution`, `cornerR` et `cornerExp` : qui trace le sien doit passer les
  // mêmes.
  if (masque && masque.length !== n) {
    throw new Error(`masqueArrondi de ${masque.length} sommets pour un contour de ${n} : les deux tracés ont divergé`)
  }
  const chDe = masque ? (k) => ch * masque[k] : () => ch
  const rdDe = masque ? (k) => rd * masque[k] : () => rd

  const positions = []
  const normals = []
  const uvs = []
  const couleurs = [] // occlusion de contact, en octets normalisés (3 o/sommet
  // au lieu de 12 en float : la géométrie est reconstruite à CHAQUE déplacement
  // de fenêtre continue, et un octet suffit largement pour une rampe de 20 %)
  //
  // `nm` non nul = normale IMPOSÉE (le congé, qui doit être lisse) ; nulle =
  // normale de FACE, calculée au produit vectoriel — c'est elle qui donne au
  // liseré d'arête sa cassure nette.
  const pousse = (a, b, c, uva, uvb, uvc, na = null, nb = null, nc = null) => {
    let face = null
    if (!na || !nb || !nc) {
      const ab = new THREE.Vector3().subVectors(b, a)
      const ac = new THREE.Vector3().subVectors(c, a)
      face = new THREE.Vector3().crossVectors(ab, ac)
      if (face.lengthSq() < 1e-18) return // triangle dégénéré : rien à peindre
      face.normalize()
    }
    const tri = [[a, uva, na], [b, uvb, nb], [c, uvc, nc]]
    for (const [v, uv, nrm] of tri) {
      const nn = nrm || face
      positions.push(v.x, v.y, v.z)
      normals.push(nn.x, nn.y, nn.z)
      uvs.push(uv[0], uv[1])
      const ao = Math.round(255 * contactAO(v.y, baseY, bande, aoForce))
      couleurs.push(ao, ao, ao)
    }
  }

  // Rentrée du pli, point par point. On prend la BISSECTRICE des deux arêtes
  // voisines, allongée de 1/cos(θ/2) : le retrait perpendiculaire vaut alors
  // exactement la distance voulue sur les DEUX faces, y compris dans un angle
  // droit. Une simple direction « vers le centre » y creuserait un cran de
  // d·(1−1/√2).
  //
  // ⚠️ On garde la bissectrice UNITAIRE et l'onglet À PART, parce que trois
  // profondeurs de rentrée s'en servent maintenant (chanfrein haut, mur, congé
  // bas) et qu'elles n'ont pas la même. La NORMALE du congé, elle, prend la
  // bissectrice SANS onglet : l'onglet corrige une distance, pas une direction.
  const biss = new Array(n) // [x, z] unitaire, vers l'intérieur
  const onglet = new Array(n) // 1/cos(θ/2), borné
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
    if (!na || !nb) { biss[i] = [0, 0]; onglet[i] = 1; continue }
    let mx = na[0] + nb[0]
    let mz = na[1] + nb[1]
    const L = Math.hypot(mx, mz)
    if (L < 1e-9) { biss[i] = [0, 0]; onglet[i] = 1; continue }
    biss[i] = [mx / L, mz / L]
    const cos = Math.max(0.35, (mx / L) * na[0] + (mz / L) * na[1]) // onglet borné (replis)
    onglet[i] = 1 / cos
  }
  // un point du profil : rentré de `d` à l'horizontale, posé à l'altitude `y`
  const point = (i, d, y) => new THREE.Vector3(
    ring[i].x + biss[i][0] * d * onglet[i],
    y,
    ring[i].z + biss[i][1] * d * onglet[i]
  )
  // ══════ LA NORMALE DU CONGÉ, ET LE SIGNE QUI L'A DÉTACHÉ DU BLOC ═══════════
  //
  // ⚠️ TOUTES LES NORMALES DE CETTE GÉOMÉTRIE SONT STOCKÉES RETOURNÉES, vers
  // l'INTÉRIEUR du solide — convention de `pousse` depuis l'origine, redressée au
  // fragment par `side: DoubleSide` et gl_FrontFacing. Mesuré : le mur rend
  // (−1, 0, 0) sur la face +x, et le fond (0, +1, 0).
  //
  // La première version ne retournait que la MOITIÉ de la normale : l'horizontale
  // était bien inversée, la verticale non. Le congé descendait donc de
  // « horizontale rentrante » à « tout droit vers le BAS » quand le fond, lui,
  // regarde vers le HAUT. Résultat à l'écran : la bande du congé recevait la
  // lumière comme si elle était tournée vers le ciel, avec une cassure nette là
  // où elle rejoint le mur — et Adrien a lu « la base du socle est traitée comme
  // un objet séparé ». Ce n'en était pas un : c'était un signe.
  //
  // À θ=0 elle vaut exactement la normale du mur (raccord invisible), à θ=90°
  // exactement celle du fond. C'est cette double coïncidence qui soude le congé.
  const normaleArc = (i, th) => new THREE.Vector3(
    -biss[i][0] * Math.cos(th),
    Math.sin(th),
    -biss[i][1] * Math.cos(th)
  ).normalize()

  // ══════════ LE PROFIL DU MUR, DU RELIEF JUSQU'AU FOND ══════════════════════
  //
  // ⚠️ POURQUOI IL Y A UN RANG DE SOMMETS AU MILIEU DE RIEN. Le mur n'avait que
  // DEUX rangs : le haut et le pied. L'occlusion de contact voyageant en couleur
  // de sommet, elle s'interpolait donc LINÉAIREMENT sur toute la hauteur — la
  // « bande » de 12 % ne contenait aucun sommet et n'existait pas. Conséquence
  // mesurée : sur un mur de 33 unités l'assombrissement s'étalait sur 33, sur un
  // mur de 5 sur 5. C'est exactement le « en mode isolé les socles semblent tous
  // différents » d'Adrien — deux murs voisins, deux dégradés de pied. Le rang
  // `yAo` fixe la bande à une hauteur MONDE, la même pour tout le monde.
  // là où le mur s'arrête et où le congé commence. PAR SOMMET depuis le masque :
  // un sommet d'arête intérieure n'a pas de congé, son mur descend jusqu'au fond.
  const yFilDe = (k) => baseY + rdDe(k)
  let acc = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const p = ring[i]
    const q = ring[j]
    const segLen = Math.hypot(q.x - p.x, q.z - p.z)
    const u0 = acc / UVSCALE
    const u1 = (acc + segLen) / UVSCALE
    acc += segLen
    // les altitudes du profil, forcées décroissantes : sur un bord très bas, le
    // pied du chanfrein peut passer sous le départ du congé
    const niveaux = (k) => {
      const chK = chDe(k)
      const yFil = yFilDe(k)
      const yT = ring[k].y
      const yC = Math.max(chK > 0 ? yT - chK : yT, yFil)
      const yA = Math.min(Math.max(baseY + bande, yFil), yC)
      return { yT, yC, yA, yFil, ch: chK }
    }
    const a = niveaux(i)
    const b = niveaux(j)
    const uv = (y) => (y - baseY) / UVSCALE
    // Une bande du mur : quatre sommets, deux triangles, normales de face.
    //
    // ⚠️ LA RENTRÉE EST PRISE SÉPARÉMENT AUX DEUX EXTRÉMITÉS. Quand le sommet i
    // a un congé et le sommet j non, la bande devient un triangle dégénéré d'un
    // côté — C'EST LE RACCORD VOULU, pas un défaut : c'est ainsi que le socle
    // passe d'une arête arrondie à une arête vive sans ouvrir de jour.
    const bande2 = (yHi, dHi, yHj, dHj, yBi, dBi, yBj, dBj) => {
      const p0 = point(i, dHi, yHi)
      const q0 = point(j, dHj, yHj)
      const p1 = point(i, dBi, yBi)
      const q1 = point(j, dBj, yBj)
      pousse(p0, p1, q0, [u0, uv(yHi)], [u0, uv(yBi)], [u1, uv(yHj)])
      pousse(q0, p1, q1, [u1, uv(yHj)], [u0, uv(yBi)], [u1, uv(yBj)])
    }
    // 1. le liseré d'arête haute — le sommet du mur ne bouge PAS, il doit rester
    //    exactement sur le bord du relief (sinon on voit le jour sous la carte)
    if (ch > 0) bande2(a.yT, 0, b.yT, 0, a.yC, a.ch, b.yC, b.ch)
    // 2. le mur, coupé au sommet de la bande d'occlusion
    bande2(a.yC, a.ch, b.yC, b.ch, a.yA, a.ch, b.yA, b.ch)
    // 3. le bas du mur, jusqu'au départ du congé
    bande2(a.yA, a.ch, b.yA, b.ch, a.yFil, a.ch, b.yFil, b.ch)
    // 4. LE CONGÉ. Normales analytiques lisses : avec des normales de face, trois
    //    segments se liraient comme trois facettes — l'inverse d'un arrondi.
    for (let k = 0; k < segArc; k++) {
      const t0 = (Math.PI / 2) * (k / segArc)
      const t1 = (Math.PI / 2) * ((k + 1) / segArc)
      // rayon nul au sommet → les quatre points s'effondrent sur le pied du mur :
      // la colonne d'arc disparaît toute seule, sans cas particulier à écrire
      const rdI = rdDe(i)
      const rdJ = rdDe(j)
      const d0i = a.ch + rdI - rdI * Math.cos(t0)
      const d1i = a.ch + rdI - rdI * Math.cos(t1)
      const d0j = b.ch + rdJ - rdJ * Math.cos(t0)
      const d1j = b.ch + rdJ - rdJ * Math.cos(t1)
      const y0i = baseY + rdI - rdI * Math.sin(t0)
      const y1i = baseY + rdI - rdI * Math.sin(t1)
      const y0j = baseY + rdJ - rdJ * Math.sin(t0)
      const y1j = baseY + rdJ - rdJ * Math.sin(t1)
      const nA0 = normaleArc(i, t0)
      const nB0 = normaleArc(j, t0)
      const nA1 = normaleArc(i, t1)
      const nB1 = normaleArc(j, t1)
      const p0 = point(i, d0i, y0i)
      const q0 = point(j, d0j, y0j)
      const p1 = point(i, d1i, y1i)
      const q1 = point(j, d1j, y1j)
      pousse(p0, p1, q0, [u0, uv(y0i)], [u0, uv(y1i)], [u1, uv(y0j)], nA0, nA1, nB0)
      pousse(q0, p1, q1, [u1, uv(y0j)], [u0, uv(y1i)], [u1, uv(y1j)], nB0, nA1, nB1)
    }
  }
  // Le fond, rentré du chanfrein ET du congé.
  //
  // ⚠️ PAR SOMMET, ET C'EST LE PIÈGE DE CETTE FONCTION. La rentrée était une
  // valeur UNIQUE (`ch + rd`) parce que les quatre côtés portaient le même
  // congé. Avec un masque elle ne l'est plus : un fond rentré partout de la même
  // distance ne rejoindrait plus le pied des murs restés vifs, et le socle
  // s'ouvrirait par en dessous — exactement la classe de défaut (« on voit sous
  // la carte ») que le reste de ce fichier passe son temps à éviter.
  const cen = new THREE.Vector3(0, baseY, 0)
  const capUv = (x, z) => [x / UVSCALE, z / UVSCALE]
  const dFond = (k) => chDe(k) + rdDe(k)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const pv = point(i, dFond(i), baseY)
    const qv = point(j, dFond(j), baseY)
    pousse(cen, qv, pv, capUv(0, 0), capUv(qv.x, qv.z), capUv(pv.x, pv.z))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.Uint8BufferAttribute(couleurs, 3, true))
  geo.computeBoundingSphere()
  // `bande` sort avec la géométrie : c'est elle que le damier redonne à ses
  // voisines pour qu'elles cuisent la MÊME hauteur d'assombrissement.
  return { geo, baseY, bande }
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
    this._brancheSSS()
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

    // Les arêtes du bloc central encore exposées au vide — `{nord,est,sud,ouest}`
    // ou null (bloc isolé : les quatre le sont). Posé par main.js depuis le
    // damier (BlockGrid.bordsHero) ; relu par rebuild(). C'est un CHAMP et non un
    // argument de rebuild() à dessein : rebuild est appelée depuis une dizaine
    // d'endroits de main.js (curseur d'épaisseur, régénération, sortie de zone
    // isolée…) et il faudrait le passer à chacun — un oubli quelque part rendrait
    // ses quatre arrondis au héros sans que rien ne le signale.
    this.bordsHero = null
  }

  // ═══════════ LA DIFFUSION SOUS-SURFACIQUE — CE QUE C'EST, ET SON PRIX ═══════
  //
  // Une pierre claire n'arrête pas la lumière à sa surface : elle la laisse
  // entrer, la promène de grain en grain et la relâche quelques millimètres plus
  // loin. C'est ce qui distingue l'albâtre, le marbre blanc, l'onyx et la résine
  // d'un plâtre — et c'est exactement le manque qui fait qu'un socle de synthèse
  // se lit comme du plastique mat, même parfaitement éclairé.
  //
  // ══════ CE QUE CE N'EST PAS, ET POURQUOI CE N'EST PAS ÇA ════════════════════
  //
  // Ce n'est PAS `transmission`. Three sait faire de la vraie transmission — le
  // socle de verre s'en sert — mais elle coûte une PASSE DE RENDU ENTIÈRE : la
  // scène est redessinée dans une cible, puis sa chaîne de mip est construite,
  // à chaque image. Sur un socle opaque, payer ça pour un effet qui se lit sur
  // quelques centimètres de bord serait absurde.
  //
  // Ce n'est PAS non plus une passe de post-traitement : la diffusion dépend de
  // la direction de la lumière et de la normale, deux choses qu'un post-traitement
  // n'a plus sous la main.
  //
  // C'est le terme de translucidité arrière classique (Frostbite) : on cherche la
  // lumière qui traverse en regardant AUTOUR de −L, déviée par la normale. Une
  // quinzaine d'opérations arithmétiques par pixel du socle. Aucune texture,
  // aucune passe, aucune lumière de plus.
  //
  // ⚠️ ET C'EST POUR ÇA QU'IL N'Y A PAS DE #define ICI, contrairement aux couches
  // du terrain. Un sampler coûte une UNITÉ DE TEXTURE même éteint — il faut donc
  // le faire disparaître à la compilation. Quinze opérations, non : les garder
  // compilées en permanence et les multiplier par zéro ne coûte rien de mesurable,
  // et ça évite de recompiler un matériau partagé par les vingt-quatre socles du
  // damier et la jupe de zone isolée à chaque bascule de l'interrupteur.
  _brancheSSS() {
    this.sssU = {
      uSSS: { value: 0 },
      uSSSTeinte: { value: new THREE.Color('#ff8a4c') },
      uSSSPower: { value: 4 },
    }
    this.wallMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.sssU)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uSSS;
uniform vec3 uSSSTeinte;
uniform float uSSSPower;`
        )
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
if (uSSS > 0.001) {
  vec3 Vd = normalize(vViewPosition);
  vec3 Nd = normalize(normal);
  vec3 Ld = directionalLights[0].direction; // deja normalisee, en espace vue
  // La lumiere qui traverse ne repart pas exactement a l'oppose de L : elle
  // sort deviee par la normale. Cette distorsion est ce qui donne au bord
  // mince son halo, et c'est elle qui distingue l'effet d'un simple ajout.
  vec3 Hd = normalize(Ld + Nd * 0.35);
  float trav = pow(clamp(dot(Vd, -Hd), 0.0, 1.0), uSSSPower);
  // ... et elle ne traverse que ce qui est eclaire PAR DERRIERE. Sans ce
  // facteur, la face deja au soleil doublerait sa lumiere et le socle
  // deviendrait laiteux partout, ce qui est l'inverse du geste.
  float dos = clamp(-dot(Nd, Ld) * 0.5 + 0.5, 0.0, 1.0);
  reflectedLight.directDiffuse += directionalLights[0].color * uSSSTeinte * (trav + 0.12) * dos * uSSS;
}
#endif`
        )
    }
  }

  // Interrupteur et force, sans recompilation (voir _brancheSSS).
  setSSS({ on = false, force = 0.6, teinte = '#ff8a4c', nettete = 4 } = {}) {
    this.sssU.uSSS.value = on ? Math.max(0, force) : 0
    this.sssU.uSSSTeinte.value.set(teinte)
    this.sssU.uSSSPower.value = Math.max(1, nettete)
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
    // ⚠️ LE BLOC CENTRAL AUSSI PERD SES ARRONDIS INTÉRIEURS. C'est le défaut le
    // plus visible des captures d'Adrien : le héros gardait ses quatre congés AU
    // MILIEU du damier, et chaque jointure avec une voisine creusait sa rainure.
    // `bordsHero` est posé par main.js à chaque changement de damier (null hors
    // damier = les quatre côtés exposés, la géométrie d'avant, exacte).
    //
    // ══════════ LA RÉSOLUTION EST CELLE DU MAILLAGE, PAS CELLE DU RÉGLAGE ══════
    //
    // ⚠️ `terrain.resMaillage(params)`, ET NON `params.resolution`. La ligne
    // au-dessus dit depuis toujours « match the wall ring to the terrain mesh
    // edge resolution » — et depuis la fenêtre continue, elle avait cessé d'être
    // vraie : le module de finesse rabat volontairement le maillage à 384 tant
    // que l'image bouge (fenetre-finesse.js) pendant que le socle, lui, restait
    // coulé à 768. Le contour du mur suivait donc le relief PLUS FINEMENT que le
    // bord de la carte posée dessus, c'est-à-dire le décollement exact que ce
    // commentaire existe pour empêcher.
    //
    // ET ÇA COÛTAIT CHER : en fenêtre continue, `main.js` rappelle `rebuild` à
    // CHAQUE image où la fenêtre bouge. Mesuré (Ryzen 9 5900X, node,
    // .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-socle-fenetre.mjs) :
    // 5,5 ms à res 128 · 8,7 à 256 · 14,6 à 384 · 24,5 à 768. Suivre le maillage
    // rend donc **9,9 ms par image** de glissement, 40 % du poste.
    //
    // ⚠️ HORS FENÊTRE CONTINUE, C'EST LA MÊME VALEUR AU BIT PRÈS. `resMaillage`
    // rend `params.resolution` tel quel dès que l'emprise vaut un bloc : le bloc
    // ordinaire, le damier et la zone isolée ne voient aucun changement. Seul le
    // `?? 256` disparaît, et il ne servait qu'à un `params` sans résolution —
    // que ni `Terrain` ni `create-panel` ne produisent.
    const { geo, baseY, bande } = buildSlabWalls(sample, { depth: this.depth, resolution: terrain.resMaillage(params), cornerR, cornerExp, baseYFloor, bords: this.bordsHero })
    this.baseY = baseY
    // la bande de référence du bloc CENTRAL : le damier et la jupe de zone
    // isolée la relisent ici pour ne pas en inventer une chacun de leur côté
    this.aoBande = bande
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

  // ══════ « COULEUR DE LA TRANCHE » — Tâche R22, option 50 ══════════════════
  //
  // ⛔ **LE CURSEUR ÉCRIVAIT DANS UNE VARIABLE QUE PERSONNE NE RELISAIT.**
  // Relevé dans l'application vivante au démarrage : `params.plinthColor =
  // #d8d4cc`, `wallMat.color = #c06a44`. Le gabarit d'ouverture pose un
  // préréglage PBR, donc `_pbrColored` est vrai, donc la ligne ci-dessous
  // refusait la valeur — et le crop, qui lit `plinth.wallMat.color`
  // (`contexteCrop` → `paroiCouleur` → `uParoiCouleur`), ne voyait jamais rien
  // bouger. Mesuré avant : **0,0000** sur une fenêtre 1:1 de 512 × 320.
  //
  // ⚠️ **CE N'EST PAS UN DÉFAUT DE SPHÈRE, ET C'EST IMPORTANT DE LE DIRE** : le
  // socle du bloc plat souffrait EXACTEMENT du même refus, au même endroit. La
  // sphère ne fait que l'exposer, parce que c'est elle qu'on regarde.
  //
  // ⚡ **LA DISTINCTION QUI RÉPARE, ET ELLE EXISTAIT DÉJÀ SANS ÊTRE NOMMÉE :
  // UNE RECOLORATION AUTOMATIQUE N'EST PAS UN CHOIX D'UTILISATEUR.**
  // `_pbrColored` a été écrit pour qu'un mode sombre ou une teinte dérivée du
  // fond (`derivePlinthColor`, `main.js`) n'écrasent pas une matière choisie
  // exprès — et il a raison. Mais il traitait le CURSEUR de couleur comme une
  // de ces automatismes. `explicite: true` sépare les deux : le doigt gagne, la
  // dérivation perd. Le picker de matières, lui, repose sa propre couleur
  // (`setMaterial`), donc le dernier geste gagne dans les deux sens.
  //
  // ⚠️ **LE VERRE RESTE EXEMPTÉ, ET CE N'EST PAS UN OUBLI** : sa couleur de mur
  // est un blanc de base, la teinte vit dans `attenuationColor` (Beer-Lambert).
  // Y poser la couleur du curseur laisserait le verre inchangé à l'écran ET
  // repeindrait la paroi du crop d'un blanc que le socle ne montre pas — deux
  // Terres pour un seul réglage. L'interface le dit maintenant : la ligne est
  // CACHÉE sous une tranche de verre (`ui/create-panel.js`).
  setColors(params, { explicite = false } = {}) {
    // glass keeps its clear white base (tint rides on attenuation), and a real
    // PBR preset keeps its own colour — only the plain default socle takes the
    // edge/dark-mode colour, unless the user picked one explicitly (R22).
    if (!this.isGlass && (explicite || !this._pbrColored)) this.wallMat.color.set(params.plinthColor ?? '#d8d4cc')
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
