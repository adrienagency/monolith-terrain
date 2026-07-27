// Altitude réelle par tuiles terrarium — meters = (R*256 + G + B/256) − 32768.
//
// La source par défaut est MAPTERHORN (512 px/tuile, jeux nationaux agrégés :
// IGN RGE ALTI, swissALTI3D, …), avec le bucket AWS elevation-tiles-prod
// (256 px) en repli. Le choix, la couverture et la bascule vivent dans
// dem-source.js — ici on ne fait que peindre le damier et décoder.
//
// Attribution : « © Mapterhorn » + https://mapterhorn.com/attribution dès que
// la source active est Mapterhorn (crédits ET exports).

import { fuseBathymetry, decodeTerrarium, overzoomTile, smoothSeaFloor } from './bathy.js'
import {
  DEM_SOURCES,
  DemSourceError,
  activeDemSource,
  demTilePx,
  fallbackToAws,
  peekRegionMaxZoom,
  regionKey,
  resolveRegionMaxZoom,
} from './dem-source.js'

export { demTilePx }

// BATHYMÉTRIE FINE — nos propres tuiles, au MÊME encodage terrarium, servies
// depuis le site. Le jeu s'arrête à BATHY_ZMAX : au-delà, on relit l'ancêtre
// (voir overzoomTile). Absent ⇒ tout continue exactement comme avant, ce qui
// permet de déployer le code avant les données.
const BATHY_URL = (z, x, y) => `data/bathy/${z}/${x}/${y}.png`
const BATHY_ZMAX = 8
// PLANCHER DU JEU — le niveau le plus grossier, cuit INTÉGRALEMENT (256 tuiles
// pour le monde entier). C'est lui qui garantit qu'une tuile fine manquante
// trouve toujours un ancêtre à lire.
//
// Sans ce repli, une tuile absente laissait sa case à PLAT au niveau zéro,
// juste à côté d'une case voisine qui, elle, portait la vraie profondeur : la
// mer se couvrait de RECTANGLES nets de la taille d'une tuile (captures Adrien
// sur l'Atlantique et l'Australie). La couverture cuite est partielle par
// construction — 0 % à z4, 50 % à z5, 21 % à z8 — parce que le pré-tri de la
// cuisson saute les tuiles « sans intérêt ». C'est le REPLI qui manquait, pas
// les tuiles.
const BATHY_ZMIN = 4
// ⚠️ NOS tuiles bathy font 256 px, quelle que soit la taille des tuiles
// d'altitude. Le rectangle SOURCE du drawImage se mesure donc en pixels de
// tuile bathy, le rectangle DESTINATION en pixels de tuile d'altitude — les
// confondre, depuis le passage au 512, ne lisait plus qu'un quart de la tuile.
const BATHY_TILE_PX = 256
// une tuile manquante est le cas NORMAL (on n'écrit pas les tuiles sans mer) :
// on mémorise les absences pour ne pas les redemander à chaque déplacement
const bathyMisses = new Set()

// ─────────────────────────── NE PAS REDEMANDER CE QU'ON A DÉJÀ ───────────────
//
// Mesuré sur le damier du Var à z12 (campagne de référence, cf.
// docs/superpowers/plans/2026-07-27-damier-optimisation.md) : 6 405 requêtes
// pour 260 URL uniques, dont UNE SEULE tuile bathy demandée 2 070 fois. Deux
// mémoires, et elles n'ont pas la même durée de vie — parce que la contrainte
// qui prime n'est pas la vitesse mais le tas JS, mesuré à 1,76 Go sur un damier
// plein.
//
// · LES TUILES D'ALTITUDE ne se retiennent QUE LE TEMPS DU VOL. Elles se
//   partagent peu entre dalles — le damier aligne des grilles de tuiles
//   disjointes — SAUF EN SURZOOM : au-delà du maxZoom de la source, deux dalles
//   voisines remontent au même ancêtre, donc à la même URL (overzoomTile).
//   C'est sans danger, et même profitable : la mémoire en vol dédoublonne ce
//   partage-là comme le reste. La redondance qui coûtait, elle, était
//   temporelle — la même dalle relancée avant que sa première demande ne soit
//   revenue. Les garder APRÈS coup serait un cache d'images de 1 Mo pièce, pour
//   un partage marginal et sur un tas déjà à 1,76 Go.
// · LES TUILES BATHY, elles, se partagent MASSIVEMENT : nos tuiles s'arrêtent à
//   z8, donc les 9 cases d'un MNT z12 lisent le MÊME ancêtre, et les 25 dalles
//   du damier aussi. Une poignée de fichiers de 256² : les mémoriser coûte
//   quelques centaines de Ko et supprime des milliers de requêtes.
const tilesEnVol = new Map() // url → Promise<ImageBitmap|null>, purgée à l'atterrissage

function enUnSeulExemplaire(url, charger) {
  const vol = tilesEnVol.get(url)
  if (vol) return vol
  const p = charger()
  tilesEnVol.set(url, p)
  // ⚠️ `p.then(fini, fini)` et pas `p.finally()` : on veut ABSORBER le rejet de
  // cette branche de surveillance, sinon chaque tuile en panne lèverait un
  // unhandledrejection à côté de l'appelant qui, lui, l'a bien traité.
  const fini = () => {
    if (tilesEnVol.get(url) === p) tilesEnVol.delete(url)
  }
  p.then(fini, fini)
  return p
}

// LRU des tuiles bathy TROUVÉES. 32 entrées de 256²·4 o = 8 Mo au pire absolu ;
// en pratique un damier n'en touche qu'une poignée.
const BATHY_MEMO_MAX = 32
const bathyHits = new Map() // url → Promise<ImageBitmap>

function loadBathyTile(url) {
  const memo = bathyHits.get(url)
  if (memo) {
    bathyHits.delete(url)
    bathyHits.set(url, memo) // ré-insertion = most-recently-used
    return memo
  }
  const p = (async () => {
    const r = await fetch(url)
    if (!r.ok) throw new Error('miss')
    return createImageBitmap(await r.blob())
  })()
  bathyHits.set(url, p)
  // une absence n'a rien à faire ici : c'est bathyMisses qui la retient
  p.then(null, () => {
    if (bathyHits.get(url) === p) bathyHits.delete(url)
  })
  while (bathyHits.size > BATHY_MEMO_MAX) bathyHits.delete(bathyHits.keys().next().value)
  return p
}

/** Remise à zéro des mémoires de tuiles — tests uniquement. */
export function _resetTileCaches() {
  tilesEnVol.clear()
  bathyHits.clear()
  bathyMisses.clear()
}

// Zoom max réellement servi pour la dernière zone chargée — l'UI s'en sert pour
// dire « zoom maximum atteint ». null tant qu'aucun DEM n'a été chargé.
let lastMaxZoom = null
export const getDemMaxZoom = () => lastMaxZoom

/**
 * Zoom max connu pour une zone, SANS requête (lecture de la mémoire).
 * `undefined` = pas encore sondé, `null` = zone non couverte par la source.
 */
export function knownMaxZoomAt(zoom, tileX, tileY) {
  return peekRegionMaxZoom(regionKey(activeDemSource().id, zoom, tileX, tileY))
}

// `originTile` (optionnel) : origine-tuile EXPLICITE {x, y} du coin haut-gauche
// — le damier (block-grid.js) charge les blocs voisins alignés sur la grille de
// tuiles du bloc central (originTileX ± tilesAcross) : zéro couture entre blocs.
export async function loadDem({ lat, lon, zoom, tilesAcross = 3, originTile = null, bathy = true }) {
  const n = 2 ** zoom
  const half = Math.floor(tilesAcross / 2)
  let cx, cy
  if (originTile) {
    cx = originTile.x + half
    cy = originTile.y + half
    // lat/lon deviennent le CENTRE réel de cette grille de tuiles (métadonnée
    // + metersPerPixel cohérents avec le géoréférencement)
    const cxF = cx + 0.5, cyF = cy + 0.5
    lon = (cxF / n) * 360 - 180
    lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * cyF) / n))) * 180) / Math.PI
  } else {
    const latRad0 = (lat * Math.PI) / 180
    cx = Math.floor(((lon + 180) / 360) * n)
    cy = Math.floor(((1 - Math.log(Math.tan(latRad0) + 1 / Math.cos(latRad0)) / Math.PI) / 2) * n)
  }
  const latRad = (lat * Math.PI) / 180

  // --- quelle source, et jusqu'à quel zoom voit-elle ICI ? -------------------
  // Trois issues, et elles ne se valent pas :
  //   un zoom  → on y va, en surzoomant au-delà (overzoomTile)
  //   null     → zone hors couverture (pleine mer) → AWS POUR CE CHARGEMENT,
  //              sans toucher au choix de session : le bloc d'à côté, sur la
  //              terre ferme, doit continuer à profiter de Mapterhorn
  //   panne    → repli AWS pour TOUTE la session (dem-source.js)
  let source = activeDemSource()
  let maxZoom
  try {
    maxZoom = await resolveRegionMaxZoom(source, zoom, cx, cy)
  } catch (err) {
    source = fallbackToAws(err)
    maxZoom = source.maxZoom
  }
  if (maxZoom == null) {
    source = DEM_SOURCES.aws
    maxZoom = source.maxZoom
  }
  lastMaxZoom = maxZoom

  const TILE_PX = source.tilePx
  const sizePx = tilesAcross * TILE_PX
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = sizePx
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // ⚠️ UNE TUILE EN ÉCHEC NE DOIT PLUS EMPORTER TOUT LE BLOC. Avant, le moindre
  // `throw` sur un coin du damier faisait échouer le Promise.all et la carte
  // entière restait vide — alors qu'un trou de couverture est le cas NORMAL au
  // bord d'un jeu national. Une tuile absente peint du vide (alpha 0, décodé
  // comme ABSENCE de mesure plus bas) et le reste du bloc vit sa vie.
  let painted = 0
  let hardFail = null
  const jobs = []
  // on retient l'emplacement de chaque dalle : la réparation par tuile (plus
  // bas) doit pouvoir la redemander à l'autre source et la repeindre au bon endroit
  const slots = []
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const tx = (cx + dx + n) % n
      const ty = cy + dy
      if (ty < 0 || ty >= n) continue
      const t = overzoomTile(zoom, tx, ty, maxZoom)
      const ox = (dx + half) * TILE_PX
      const oy = (dy + half) * TILE_PX
      slots.push({ tx, ty, ox, oy })
      jobs.push(
        fetchTerrainTile(source, t)
          .then((img) => {
            if (!img) return // 404 : trou de couverture, on laisse du vide
            // surzoom : on n'agrandit qu'une SOUS-FENÊTRE de l'ancêtre
            const s = TILE_PX / t.scale
            ctx.drawImage(img, t.ox * TILE_PX, t.oy * TILE_PX, s, s, ox, oy, TILE_PX, TILE_PX)
            painted++
          })
          .catch((err) => {
            if (err instanceof DemSourceError) hardFail ??= err
          })
      )
    }
  }
  await Promise.all(jobs)

  // panne de la source fine : on rejoue CE chargement sur AWS (la bascule est
  // retenue pour la session, donc l'appel récursif repart d'emblée sur AWS)
  if (hardFail && source.id !== DEM_SOURCES.aws.id) {
    fallbackToAws(hardFail)
    return loadDem({ lat, lon, zoom, tilesAcross, originTile, bathy })
  }
  // plus rien du tout : c'est une panne, pas un trou — l'UI doit le dire
  if (!painted) throw hardFail ?? new Error(`aucune tuile d'altitude à ${zoom}/${cx},${cy} (${source.id})`)

  let rgba = ctx.getImageData(0, 0, sizePx, sizePx).data

  // ⚠️ LA SOURCE FINE SERT L'OCÉAN EN TUILES VIDES, AVEC UN HTTP 200.
  // Mesuré aux Canaries, z8 : Mapterhorn rend 52 octets de WebP uniforme là où
  // AWS en sert 130 Ko d'ETOPO1. Aucun code de statut ne l'attrape — la dalle
  // arrive « valide » et se décode à zéro partout, ce qui donne un plateau plat
  // au niveau de la mer. Ce sont les carrés blancs signalés par Adrien, larges
  // d'exactement un tiers de bloc, donc d'une tuile.
  //
  // On répare DALLE PAR DALLE plutôt que de basculer tout le bloc : un damier à
  // cheval sur une île et sur le large doit garder le relief fin sur l'île. AWS
  // porte de l'ETOPO1 sur tout l'océan, c'est exactement le socle qui manque.
  if (source.id !== DEM_SOURCES.aws.id) {
    const vides = []
    for (const slot of slots) {
      if (slotIsBlank(rgba, sizePx, slot.ox, slot.oy, TILE_PX)) vides.push(slot)
    }
    if (vides.length) {
      const aws = DEM_SOURCES.aws
      await Promise.all(
        vides.map((slot) =>
          fetchTerrainTile(aws, overzoomTile(zoom, slot.tx, slot.ty, aws.maxZoom))
            .then((img) => {
              if (!img) return
              const t = overzoomTile(zoom, slot.tx, slot.ty, aws.maxZoom)
              const s = aws.tilePx / t.scale
              // la tuile AWS fait 256 px, la dalle 512 : drawImage met à
              // l'échelle. De l'ETOPO1 à ~1 850 m ne perd rien à être agrandi.
              ctx.drawImage(img, t.ox * aws.tilePx, t.oy * aws.tilePx, s, s, slot.ox, slot.oy, TILE_PX, TILE_PX)
            })
            .catch(() => {}) // le socle est un bonus : son échec ne casse rien
        )
      )
      rgba = ctx.getImageData(0, 0, sizePx, sizePx).data
    }
  }

  // BATHYMÉTRIE : on peint le même damier dans un second canevas, puis on
  // fusionne. Tout échec est silencieux et sans conséquence — la carte reste
  // celle d'avant.
  const seaData = bathy === false ? null : await loadBathyPatch({ zoom, cx, cy, half, n, sizePx, tilePx: TILE_PX })
  const data = new Float32Array(sizePx * sizePx)
  let minM = Infinity
  let maxM = -Infinity
  let sum = 0
  let measured = 0
  for (let i = 0; i < data.length; i++) {
    // ⚠️ ALPHA 0 = AUCUNE TUILE PEINTE ICI, PAS UNE FOSSE ABYSSALE. Le triplet
    // (0,0,0) d'un canevas vierge se décode en −32768 m (voir bathy.js, même
    // piège côté mer). On rend 0, que fuseBathymetry lit comme une ABSENCE de
    // mesure — la bathymétrie fine peut donc y creuser normalement.
    if (rgba[i * 4 + 3] === 0) {
      data[i] = 0
      continue
    }
    const m = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
    data[i] = m
    if (m < minM) minM = m
    if (m > maxM) maxM = m
    sum += m
    measured++
  }
  if (!measured) { minM = 0; maxM = 0 }

  // La fusion ne peut que CREUSER la mer : la terre et le trait de côte
  // restent ceux du terrarium (voir src/bathy.js, et la session polders).
  const fused = seaData ? fuseBathymetry(data, seaData) : data
  // LISSAGE DU FOND, À L'ÉCHELLE DES FACETTES DU SURZOOM (retour Adrien :
  // « l'effet creusement par cube »). Nos tuiles bathy s'arrêtent à z8 — la
  // résolution native de GEBCO, il n'y a rien de plus fin à avoir. Au-delà, une
  // dalle est reconstruite depuis une poignée de pixels de l'ancêtre, et
  // l'agrandissement en fait de grandes facettes plates à arêtes franches.
  //
  // Le rayon suit donc la taille de CETTE facette, pas une constante : une
  // facette fait `2^(zoom−8)` pixels de source, chacun étalé sur `TILE_PX/256`
  // pixels de sortie. Lisser à la moitié de sa taille efface l'artefact sans
  // toucher à de l'information réelle — sous 463 m au sol, il n'y en a plus.
  if (seaData) {
    const facette = 2 ** Math.max(0, zoom - BATHY_ZMAX) * (TILE_PX / 256)
    smoothSeaFloor(fused, sizePx, { radius: Math.min(24, Math.round(facette / 2)) })
  }
  if (fused !== data) {
    minM = Infinity; maxM = -Infinity; sum = 0
    for (let i = 0; i < fused.length; i++) {
      const m = fused[i]
      if (m < minM) minM = m
      if (m > maxM) maxM = m
      sum += m
    }
    measured = fused.length
  }

  // ⚠️ 156543·cos(lat)/2^z est la résolution d'une tuile de 256 px. Une tuile
  // de 512 px décrit la MÊME étendue au sol avec deux fois plus de pixels : la
  // résolution est donc moitié moindre. Sans ce facteur, extentMeters doublait
  // et le bloc entier se retrouvait à la mauvaise échelle (relief écrasé,
  // tracés GPX décalés, damier de blocs voisins désaligné).
  const metersPerPixel = ((156543.03392 * Math.cos(latRad)) / 2 ** zoom) * (256 / TILE_PX)
  return {
    data: fused,
    size: sizePx,
    tilePx: TILE_PX,
    demSource: source.id,
    maxZoom,
    metersPerPixel,
    extentMeters: metersPerPixel * sizePx,
    minM,
    maxM,
    meanM: measured ? sum / measured : 0,
    lat,
    lon,
    zoom,
    // exact georeference: fractional tile coords of the canvas top-left corner,
    // so lat/lon ↔ world XZ conversions are pixel-accurate (see geo.js)
    originTileX: cx - half,
    originTileY: cy - half,
  }
}

// Une tuile d'altitude → ImageBitmap, `null` si elle n'existe pas (404), et
// DemSourceError si c'est la SOURCE qui a un problème (réseau, 5xx, DNS, image
// indécodable — un navigateur sans WebP, par exemple).
function fetchTerrainTile(source, t) {
  return enUnSeulExemplaire(source.url(t.z, t.x, t.y), async () => {
    let res
    try {
      res = await fetch(source.url(t.z, t.x, t.y))
    } catch (err) {
      throw new DemSourceError(`${source.id} ${t.z}/${t.x}/${t.y} → ${err?.message || err}`)
    }
    if (res.status === 404) return null
    if (!res.ok) throw new DemSourceError(`${source.id} ${t.z}/${t.x}/${t.y} → HTTP ${res.status}`)
    try {
      return await createImageBitmap(await res.blob())
    } catch (err) {
      throw new DemSourceError(`${source.id} ${t.z}/${t.x}/${t.y} illisible → ${err?.message || err}`)
    }
  })
}

// bilinear sample of the height grid at fractional pixel coords
export function sampleDem(dem, px, py) {
  const { data, size } = dem
  const x = Math.min(Math.max(px, 0), size - 1.001)
  const y = Math.min(Math.max(py, 0), size - 1.001)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i = y0 * size + x0
  const a = data[i]
  const b = data[i + 1]
  const c = data[i + size]
  const d = data[i + size + 1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

// Une dalle est-elle VIDE au sens « rien de mesuré » ? On échantillonne une
// grille clairsemée : dès qu'un pixel s'écarte du niveau zéro, la dalle porte
// une information et on la garde. Un océan réel n'est jamais plat au mètre près
// sur toute une tuile — sauf justement quand la source n'a rien à en dire.
//
// Le seuil de 1/256 m est un pas de quantification terrarium : c'est la plus
// petite valeur non nulle représentable, donc la frontière exacte entre
// « exactement zéro » et « une vraie mesure ».
const BLANK_STEP = 16 // un pixel sur 16 dans chaque sens : 1024 sondes par dalle
function slotIsBlank(rgba, sizePx, ox, oy, tilePx) {
  for (let y = 0; y < tilePx; y += BLANK_STEP) {
    for (let x = 0; x < tilePx; x += BLANK_STEP) {
      const i = ((oy + y) * sizePx + ox + x) * 4
      if (rgba[i + 3] === 0) continue // pas peint : ce n'est pas un verdict
      const m = rgba[i] * 256 + rgba[i + 1] + rgba[i + 2] / 256 - 32768
      if (Math.abs(m) > 1 / 256) return false
    }
  }
  return true
}

// Peint le damier de tuiles BATHYMÉTRIQUES dans un canevas et le décode.
// Rend `null` dès que rien d'utile n'a été trouvé — l'appelant continue alors
// avec le seul terrarium, sans le savoir.
async function loadBathyPatch({ zoom, cx, cy, half, n, sizePx, tilePx }) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = sizePx
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  let painted = 0
  const jobs = []
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const tx = (cx + dx + n) % n
      const ty = cy + dy
      if (ty < 0 || ty >= n) continue
      const ox = (dx + half) * tilePx
      const oy = (dy + half) * tilePx
      // On descend de la tuile la plus fine disponible vers le plancher : la
      // première qui répond gagne. Une absence reste le cas NORMAL à un niveau
      // donné, mais elle ne doit plus laisser la case à plat.
      jobs.push(
        (async () => {
          for (let zt = Math.min(zoom, BATHY_ZMAX); zt >= BATHY_ZMIN; zt--) {
            const t = overzoomTile(zoom, tx, ty, zt)
            const url = BATHY_URL(t.z, t.x, t.y)
            if (bathyMisses.has(url)) continue
            try {
              // TROUVÉE ⇒ MÉMORISÉE. Les 9 cases de ce damier lisent le même
              // ancêtre z8, et les 25 dalles du damier de blocs aussi : sans
              // cette mémoire, une seule tuile partait 2 070 fois.
              const img = await loadBathyTile(url)
              // surzoom : on n'agrandit qu'une SOUS-FENÊTRE de l'ancêtre — la
              // sous-fenêtre se mesure sur la tuile BATHY (256 px), la case de
              // destination sur la tuile d'altitude (256 ou 512 px)
              const s = BATHY_TILE_PX / t.scale
              ctx.drawImage(img, t.ox * BATHY_TILE_PX, t.oy * BATHY_TILE_PX, s, s, ox, oy, tilePx, tilePx)
              painted++
              return
            } catch {
              bathyMisses.add(url)
            }
          }
        })()
      )
    }
  }
  await Promise.all(jobs)
  if (!painted) return null
  return decodeTerrarium(ctx.getImageData(0, 0, sizePx, sizePx).data)
}
