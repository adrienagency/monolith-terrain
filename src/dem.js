// Altitude réelle par tuiles terrarium — meters = (R*256 + G + B/256) − 32768.
//
// La source par défaut est MAPTERHORN (512 px/tuile, jeux nationaux agrégés :
// IGN RGE ALTI, swissALTI3D, …), avec le bucket AWS elevation-tiles-prod
// (256 px) en repli. Le choix, la couverture et la bascule vivent dans
// dem-source.js — ici on ne fait que peindre le damier et décoder.
//
// Attribution : « © Mapterhorn » + https://mapterhorn.com/attribution dès que
// la source active est Mapterhorn (crédits ET exports).

// ⚠️ PLUS de `smoothSeaFloor` ici : la branche de mémorisation partait d'un
// main qui l'appelait encore (elle mesurait ses 73 ms), mais le correctif
// Catmull-Rom l'a depuis SORTI du chemin de loadDem — il ne servait plus à
// rien une fois l'agrandissement corrigé, et coûtait 84 ms par bloc. Il reste
// exporté et testé pour une future source côtière (voir le corps du fichier).
import { fuseBathymetry, decodeTerrarium, overzoomTile, resampleCatmullRom } from './bathy.js'
import { normalizeIndex, tileMaxZoom } from './bathy-sources.js'
import { demMemoCle, demMemoLire, demMemoEcrire, demMemoVider } from './dem-memo.js'
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
// depuis le site. Le jeu s'arrête au plafond de la zone (voir juste en dessous) :
// au-delà, on relit l'ancêtre (voir overzoomTile). Absent ⇒ tout continue
// exactement comme avant, ce qui permet de déployer le code avant les données.
const BATHY_URL = (z, x, y) => `data/bathy/${z}/${x}/${y}.png`

// PLAFOND PAR ZONE — depuis le 2026-07-28, le jeu ne s'arrête plus au même
// niveau partout. Là où une source régionale plus fine que GEBCO a été cuite
// (EMODnet à 115 m sur la France, pour commencer), on peut descendre plus bas ;
// ailleurs on reste à z8, qui est la résolution native de GEBCO.
//
// La règle d'Adrien, mot pour mot : « à chaque fois qu'on a une map mieux
// définie, on l'utilise, à défaut on laisse la map GEBCO en soutien ».
//
// ⚠️ L'INDEX EST FACULTATIF, et c'est la propriété qui compte : absent, illisible
// ou 404, `normalizeIndex(null)` rend z8 partout — exactement le comportement
// d'avant. On peut donc déployer ce code sans les données, et les données sans
// redéployer le code. La promesse est mémorisée : un seul aller-retour réseau
// pour toute la session, et un échec ne se retente pas en boucle.
let _bathyIndex = null
// L'index déjà résolu, ou null s'il n'est pas encore arrivé. Sert à l'export,
// qui doit nommer les sources ayant creusé l'emprise et ne peut pas attendre.
let _bathyIndexResolu = null
export const bathySourceIndex = () => _bathyIndexResolu
const bathyIndex = () => {
  if (!_bathyIndex) {
    _bathyIndex = fetch('data/bathy/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(normalizeIndex)
      .then((idx) => { _bathyIndexResolu = idx; return idx })
  }
  return _bathyIndex
}
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
//
// 🔴 POURQUOI 7 ET PLUS 4. Un repli trop profond ÉCRASE DE LA DONNÉE MEILLEURE
// QUE LUI. `fuseBathymetry` fait qu'au-delà de 25 m de fond la sortie vaut
// EXACTEMENT la source fine (le fondu sature, `out = s`) : un ancêtre grossier
// remplace donc purement et simplement le terrarium. Or les tuiles terrarium
// d'AWS portent de l'ETOPO1 à 1 852 m, tandis que nos niveaux de repli valent,
// à 35,5°N : z7 = 996 m, z6 = 1 992 m, z5 = 3 984 m, z4 = 7 968 m.
//
// Recensement mondial (rapport du 2026-07-28) : 13 891 tuiles z8 présentes,
// 8 946 coutures avec une voisine absente, dont 2 758 retombent à z6 ou pire —
// et sur 796 d'entre elles le repli à z4/z5 DÉGRADE ACTIVEMENT l'ETOPO1 déjà là.
// On abîmait la carte au nom de l'améliorer.
//
// z7 (996 m) reste deux fois meilleur qu'ETOPO1 : c'est le dernier niveau qui
// mérite encore d'écraser le socle. En dessous, ne rien peindre est le bon
// choix — le pixel garde le terrarium, qui est plus fin.
//
// ⚠️ CE PLANCHER NE VAUT QUE POUR LE SURZOOM. `modes.js` charge des blocs
// CONTINENTAUX à z4 et z5 : là, une tuile bathy z4 est la résolution NATIVE de
// l'affichage, pas un repli dégradé, et l'interdire supprimerait la
// bathymétrie de toutes les vues d'ensemble. Le plancher effectif est donc
// `min(BATHY_ZMIN, zoom)` : on ne descend jamais SOUS le zoom demandé.
const BATHY_ZMIN = 7
// ⚠️ NOS tuiles bathy font 256 px, quelle que soit la taille des tuiles
// d'altitude. La sous-fenêtre SOURCE se mesure donc en pixels de tuile bathy,
// le rectangle DESTINATION en pixels de tuile d'altitude — les confondre,
// depuis le passage au 512, ne lisait plus qu'un quart de la tuile.
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

// LRU des GRILLES bathy décodées. 32 entrées de 256²·4 o = 8 Mo au pire absolu ;
// en pratique un damier n'en touche qu'une poignée.
//
// ⚠️ ON MÉMORISE LA GRILLE EN MÈTRES, PLUS L'IMAGE. C'est le pivot du correctif
// « fond marin lisse » : tant qu'on gardait un ImageBitmap, le seul moyen de
// l'agrandir était `drawImage`, donc du BILINÉAIRE — dont la pente casse à
// chaque bord de cellule et dessine la grille de carrés de 464 m. Une fois la
// tuile décodée en Float32, l'agrandissement devient de l'arithmétique, et on
// peut la faire en Catmull-Rom (src/bathy.js). Bonus : les 9 cases d'un damier
// qui partagent le même ancêtre ne le décodent plus qu'UNE fois.
const BATHY_MEMO_MAX = 32
const bathyHits = new Map() // url → Promise<{w, h, m: Float32Array}>

// Décode une tuile bathy À SA RÉSOLUTION NATIVE, sans la moindre mise à
// l'échelle : le drawImage est ici strictement 1:1, il n'interpole rien.
function grilleBathy(img) {
  const w = img.width || BATHY_TILE_PX
  const h = img.height || BATHY_TILE_PX
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  return { w, h, m: decodeTerrarium(ctx.getImageData(0, 0, w, h).data) }
}

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
    return grilleBathy(await createImageBitmap(await r.blob()))
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
  demMemoVider()
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
//
// `memo` : mémorise le bloc FINI (fusionné, lissé, statistiques faites) pour le
// retour de zoom — 145 ms de fil principal figé et 20 ms de réseau rendus, voir
// dem-memo.js. C'est une DEMANDE et non le défaut : le damier tient sa propre
// mémoire de MNT voisins, l'y faire entrer doublerait la facture et chasserait
// le bloc central à chaque extension.
export async function loadDem({ lat, lon, zoom, tilesAcross = 3, originTile = null, bathy = true, memo = false }) {
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
  // MÉMOIRE DU BLOC — la clé se ferme ICI et pas plus tôt : `maxZoom` en fait
  // partie (il décide du surzoom) et il vient d'être résolu. Le sondage de
  // couverture, lui, est déjà mémorisé par dem-source.js : sur un retour de
  // zoom l'await ci-dessus ne coûte rien.
  const cleMemo = memo
    ? demMemoCle({
        source: source.id, zoom, maxZoom, ox: cx - half, oy: cy - half,
        tilesAcross, tilePx: TILE_PX, lat, lon, bathy: bathy !== false,
      })
    : null
  if (cleMemo) {
    const dejaVu = demMemoLire(cleMemo)
    if (dejaVu) return dejaVu
  }
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
    return loadDem({ lat, lon, zoom, tilesAcross, originTile, bathy, memo })
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
  // ⚠️ FLOAT32, ET PAS INT16 — LA MESURE, POUR QUE PERSONNE NE LA REFASSE.
  //
  // 1536² × 4 octets = 9,44 Mo par bloc. Le passer en Int16 rendrait 4,72 Mo et
  // ~9 % du temps de lecture. C'est tentant, et c'est un piège dès qu'on choisit
  // une unité ABSOLUE : quantifier le relief ajoute du bruit exactement à la
  // fréquence de Nyquist du maillage, et src/grid-normals.js vient de prouver
  // que c'est précisément ce que les normales révèlent à l'œil.
  //
  // Mesuré sur MNT réel (banc `.banc/f3-int16.mjs`), écart angulaire des
  // normales contre le Float32 actuel, res 768, La Réunion z13 et Chamonix z12 :
  //
  //   quantification            | pas    | écart moyen     | pire
  //   mètre entier (±32767 m)   | 1 m    | 0,57° à 1,09°   | 5,1° à 7,4°
  //   demi-mètre   (±16383 m)   | 0,5 m  | 0,29° à 0,54°   | 2,3° à 3,6°
  //   AFFINE PAR BLOC           | 4–6 cm | 0,035° à 0,044° | 0,30°
  //   (le terrarium natif)      | 3,9 mm | 0,005° à 0,006° | 0,03°
  //
  // Une unité absolue réinjecte donc entre un tiers et deux tiers de l'erreur de
  // normales qu'on venait justement de supprimer (3,2° à La Réunion). Elle est
  // exclue — et le demi-mètre est le maximum qui couvre encore la Terre entière
  // (Everest 8 849 m, Challenger Deep −10 935 m), donc il n'y a pas de réglage
  // absolu plus fin disponible.
  //
  // La SEULE voie tenable est AFFINE PAR BLOC : stocker `(h − minM) × 65534 /
  // (maxM − minM)` et porter `minM` et le facteur à côté du tableau. Le pas
  // devient 4 à 6 cm sur un bloc alpin, millimétrique sur un bloc plat — et le
  // bruit tombe à 0,04°, sept fois le plancher d'arrondi Float32 mais
  // soixante-dix fois moins que la version « mètre ». ⚠️ Deux réserves à lever
  // avant de l'écrire :
  //   — le ZÉRO n'est plus exactement représentable, et les seuils terre/mer se
  //     jouent au décimètre (seaLevelM 0,5 ; LAND_MIN_ELEV_M 0,3) : il faut
  //     vérifier que la topologie du flood-fill de sea-mask.js ne bouge pas ;
  //   — `fuseBathymetry` ne doit CREUSER QUE LA MER (« la terre ne bouge
  //     jamais », src/bathy.js) : la fusion doit se faire AVANT la
  //     quantification, jamais après.
  //
  // Non fait ici parce que la fenêtre continue 3×3 remplace les neuf reliefs par
  // UN SEUL : l'offset et le facteur devront alors porter sur l'emprise entière,
  // exactement comme `uHeightRange`. Le faire maintenant serait à refaire.
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
  // ⚠️ PLUS DE `smoothSeaFloor` ICI, ET C'EST UN CHOIX MESURÉ, PAS UN OUBLI.
  //
  // Ce flou existait pour cacher les facettes de l'agrandissement BILINÉAIRE
  // (« l'effet creusement par cube » signalé par Adrien). Il traitait le
  // symptôme en aval ; le Catmull-Rom traite la cause en amont. Mesuré sur une
  // dalle z12 de la baie de Tokyo, en CASSURE D'INCLINAISON entre facettes
  // voisines — c'est exactement ce que `computeVertexNormals` révèle à l'œil :
  //
  //                                   baie 0-40 m      large > 200 m
  //   bilinéaire seul                  max 4,66°         max 31,71°
  //   bilinéaire + lissage             max 3,22°         max  2,13°
  //   Catmull-Rom seul                 max 0,82°         max  4,43°
  //   Catmull-Rom + lissage            max 0,69°         max  2,43°
  //
  // Trois raisons de le retirer :
  //  · DANS LA BAIE, IL NE SERVAIT DÉJÀ PRESQUE À RIEN — il s'atténue sous 40 m
  //    de fond pour ne pas bouger le rivage, or 91 % de la baie de Tokyo fait
  //    moins de 40 m (force moyenne du lissage : 47 %, et 4 % sur la tranche
  //    0-10 m). Le Catmull-Rom seul y fait déjà 4× mieux que le lissage.
  //  · AU LARGE, il rendait un chiffre flatteur en floutant du RELIEF RÉEL : les
  //    4,43° du Catmull-Rom sont une courbure douce et distribuée, pas une arête
  //    sur une ligne de grille (le saut de pente aux bords de cellule tombe de
  //    3,825 à 0,006 m/cellule).
  //  · IL COÛTAIT 84 ms PAR BLOC (1536², rayon 16), contre 14 ms pour tout
  //    l'agrandissement Catmull-Rom. Sur un damier de 25 blocs, 2 s de fil
  //    principal rendues à la carte.
  //
  // `smoothSeaFloor` reste exporté et testé : le jour où une source côtière
  // fine arrivera avec ses propres coutures, il sera là.
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
  const bloc = {
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
  return cleMemo ? demMemoEcrire(cleMemo, bloc) : bloc
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

// Assemble le damier de tuiles BATHYMÉTRIQUES, en mètres, case par case.
// Rend `null` dès que rien d'utile n'a été trouvé — l'appelant continue alors
// avec le seul terrarium, sans le savoir.
//
// ⚠️ PLUS AUCUN CANEVAS À LA TAILLE DU BLOC, ET PLUS AUCUN `drawImage`
// AGRANDISSANT. C'est LE correctif : agrandir une tuile z8 par drawImage se
// faisait en bilinéaire, dont la pente casse à chaque bord de cellule — mesuré
// 3,825 m/cellule dans la baie de Tokyo, soit 0,67° de cassure d'inclinaison à
// l'exagération 2,8, que `computeVertexNormals` révèle en grille de carrés de
// 464 m. En Catmull-Rom : 0,006 m/cellule, 615 fois moins (src/bathy.js).
async function loadBathyPatch({ zoom, cx, cy, half, n, sizePx, tilePx }) {
  // NaN = case non peinte, que `fuseBathymetry` ignore comme n'importe quelle
  // valeur non finie (c'est ce que faisait l'alpha nul du canevas d'avant)
  const patch = new Float32Array(sizePx * sizePx).fill(NaN)
  let painted = 0
  const jobs = []
  // Un seul aller-retour pour tout le damier : l'index est mémorisé, et les 25
  // dalles du damier de blocs attendent la MÊME promesse.
  const index = await bathyIndex()
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
          const plancher = Math.min(BATHY_ZMIN, zoom)
          // Le plafond se lit AU CENTRE DE CETTE TUILE, pas au centre du bloc :
          // un bloc peut chevaucher la limite d'une source fine, et chaque case
          // du damier doit alors chercher au niveau qui la concerne.
          for (let zt = Math.min(zoom, tileMaxZoom(index, zoom, tx, ty)); zt >= plancher; zt--) {
            const t = overzoomTile(zoom, tx, ty, zt)
            const url = BATHY_URL(t.z, t.x, t.y)
            if (bathyMisses.has(url)) continue
            try {
              // TROUVÉE ⇒ MÉMORISÉE. Les 9 cases de ce damier lisent le même
              // ancêtre z8, et les 25 dalles du damier de blocs aussi : sans
              // cette mémoire, une seule tuile partait 2 070 fois.
              const g = await loadBathyTile(url)
              // surzoom : on n'agrandit qu'une SOUS-FENÊTRE de l'ancêtre — elle
              // se mesure sur la tuile BATHY (256 px), la case de destination
              // sur la tuile d'altitude (256 ou 512 px).
              //
              // La sous-fenêtre borne ce qu'on AGRANDIT, pas ce qu'on LIT : les
              // voisins hors fenêtre restent de la vraie donnée, donc deux cases
              // servies par le même ancêtre se raccordent sans couture.
              resampleCatmullRom({
                src: g.m, srcW: g.w, srcH: g.h,
                sx: t.ox * g.w, sy: t.oy * g.h, sw: g.w / t.scale, sh: g.h / t.scale,
                dst: patch, dstStride: sizePx, dx: ox, dy: oy, dw: tilePx, dh: tilePx,
              })
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
  return painted ? patch : null
}
