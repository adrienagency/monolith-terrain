// Damier de blocs voisins — quand un tracé GPX déborde du bloc principal aux
// zooms fins (le cas de figure : une course de 90 km sur un patch z12), des
// blocs de terrain de la MÊME taille et du MÊME rendu apparaissent autour du
// bloc central pour porter la suite du tracé. Au dézoom, la trace retient dans
// le bloc principal et les voisins inutiles sont retirés.
//
// C'est aussi la FONDATION du futur système de blocs plus large (demande
// Adrien) : un damier générique, borné à 5×5 (GRID_R = 2 autour du centre),
// où chaque cellule (i,j) couvre le monde [i·56±28, j·56±28] et charge son
// DEM aligné sur la grille de tuiles du bloc central (zéro couture).
//
// Périmètre v1 assumé : les voisins reçoivent la peinture de carte complète
// (hypso, contours, grille, teinte mer — continues d'un bloc à l'autre car
// calculées en world-space) mais PAS la mer animée, le socle, les labels ni
// l'aérien — ce sont des blocs de CONTEXTE, le bloc central reste le héros.

import * as THREE from 'three'
import { Terrain, TERRAIN_SIZE } from './terrain.js'
import { loadDem, demTilePx } from './dem.js'
import { latLonToWorld } from './geo.js'
import { buildSlabWalls } from './plinth.js'
import { exposantCoin } from './fenetre-clip.js'
import { fetchCoastMask, COAST_ZOOM_MIN, COAST_ZOOM_MAX } from './coast-mask.js'

export const GRID_R = 2 // rayon du damier : 2 → 5×5 max, centre exclu

// LES VOISINES SE DIMENSIONNENT SUR ELLES-MÊMES, PAS SUR LE BLOC CENTRAL.
//
// C'est le correctif de mémoire du damier, et sa cause était invisible parce que
// chaque valeur était juste SÉPARÉMENT. Le bloc central est maillé à 768 sur
// 56 unités-monde (13,7 sommets par unité) et ses champs sont taillés pour lui :
// masque côtier 2048² (36,6 px/u), analyse à la taille du MNT, 1536² (27,4 px/u).
// Les voisines héritaient de ces tailles avec un maillage 3 fois plus grossier
// (4,59 sommets/u) — elles portaient donc des textures 6 à 8 fois plus fines que
// le relief capable de les montrer. Mesuré sur Le Var isolé à z12, dans la
// configuration d'alors (centre maillé à 1024, voisines à 384, soit un écart de
// 4 à 5 fois) : **79 Mo par dalle**, 1 824 Mo de tas JS pour 23 voisines, contre
// 2 à 4 Go de limite pratique dans Chrome. C'est le risque le plus sérieux du
// damier, devant la vitesse.
//
// La règle qui remplace l'héritage : aucune TEXTURE ne dépasse quatre fois la
// densité du maillage qui la porte (test/damier-memoire.test.js le verrouille,
// champ par champ et nommément — il ne l'a pas toujours fait, cf. plus bas).
//
// ⚠️ Le MNT, lui, N'EST PAS RÉDUIT et ce n'est pas un oubli : il est lu par le
// PROCESSEUR (veille devant l'étrave des bateaux, tracé de la jupe de découpe,
// orographie des nuages), pas seulement par la carte graphique. Le diviser
// échangerait de la mémoire contre de la QUALITÉ, notamment sur la précision du
// contour de découpe aux jointures — décision d'Adrien, pas du code. C'est la
// SEULE exception, elle est délibérée, et le test la verrouille comme telle
// pour qu'elle reste une exception et ne devienne pas une dérive.
//
// ⚠️ LE MASQUE DE MER A MANQUÉ CE CHANTIER, et la règle ci-dessus s'annonçait
// donc plus large qu'elle n'était tenue : `computeTerrainJob` le calculait sur
// le MNT PLEIN, soit 1536² sur une voisine maillée à 256 — **6,00×**, 2,25 Mo
// par dalle et 54 Mo sur un damier plein. Un commentaire juste sur trois champs
// et faux sur le quatrième coûte plus cher qu'un commentaire absent.
//
// ⚠️ ET LE PLAFOND N'ÉTAIT PAS EXACT. `analyzeDem` ne savait diviser que par un
// ENTIER : demander 1024 à un MNT de 1536 prenait le facteur 2 et rendait 768 —
// le même octet pour octet qu'un plafond de 768. Remonter la constante sans
// toucher au rééchantillonnage aurait donc été un correctif qui ne corrige rien,
// tout en se relisant comme appliqué. C'est `resampleField` qui rend la valeur
// exacte, et le test le dit nommément.
//
// LES TROIS DENSITÉS, dans la même unité, pour qu'un écart saute aux yeux — le
// maillage voisin porte 257 sommets sur 56 unités-monde, soit 4,59 sommets/u :
//   masque côtier 1024² → 18,29 px/u → 3,99× le maillage
//   analyse       1024² → 18,29 px/u → 3,99×
//   masque de mer 1024² → 18,29 px/u → 3,99×
// L'analyse à 1024 ne « casse » donc PAS la règle des 4× : elle se pose PILE au
// niveau du masque côtier, qui y était déjà.
//
// CE QUE ÇA REND, ET CE QUE ÇA COÛTE — mesuré sur MNT réel 1536² (Alpes
// valaisannes 45,95/7,30 à z11, Chrome piloté en CDP, ramassage FORCÉ). Perte
// de signal = écart-type de ce que la reconstruction bilinéaire ne restitue pas,
// rapporté à l'écart-type du champ pleine résolution :
//
//   canal R — le peigné des crêtes, que le shader multiplie par trois
//                                  36,2 %  →  23,1 %
//   canal G — l'ombrage            26,0 %  →  19,4 %
//   canal B — l'humidité            4,3 %  →   4,1 %
//
// Et le SOLDE, tous plafonds confondus, sur un damier de 24 dalles peuplé par
// sync() : 719,3 Mo de tas JS avant, 701,3 Mo après — **−18,0 Mo**, reproduit à
// 0,1 Mo près sur trois bascules alternées. L'analyse coûte +1,8 Mo par dalle,
// le masque de mer et sa landMask en rendent 2,6 : le peigné est gratuit, et il
// reste de la monnaie.
const NEIGHBOUR_RES = 256 // maillage des voisins : contexte, pas héros (4,59 sommets/u)
export const NEIGHBOUR_COAST_SIZE = 1024 // masque côtier (18,3 px/u) — 2048² au centre
export const NEIGHBOUR_ANALYSIS_SIZE = 1024 // analyse de relief (18,3 px/u) — MNT au centre
export const NEIGHBOUR_SEA_SIZE = 1024 // masque de mer (18,3 px/u) — MNT au centre
export { NEIGHBOUR_RES }

const clampLat = (lat) => Math.min(85.05, Math.max(-85.05, lat))

// Un segment touche-t-il le rectangle ? (Liang–Barsky). Vrai aussi quand le
// segment y tient TOUT ENTIER — c'est le cas qui compte : un morceau de contour
// entièrement contenu dans une dalle ne croise aucun de ses bords.
function segHitsRect(ax, az, bx, bz, x0, z0, x1, z1) {
  let t0 = 0
  let t1 = 1
  const dx = bx - ax
  const dz = bz - az
  const bornes = [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]
  for (const [p, q] of bornes) {
    if (p === 0) {
      if (q < 0) return false // parallèle et déjà dehors
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
  }
  return true
}

// point dans un anneau projeté ({x,z}) — lancer de rayon, comme region-mask.js
// mais en coordonnées monde : Mercator est conforme et monotone, l'appartenance
// se conserve d'un espace à l'autre.
function pointInRingXZ(x, z, ring) {
  let dedans = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) dedans = !dedans
  }
  return dedans
}

// QUELLES DALLES DU DAMIER LA ZONE ISOLÉE TOUCHE-T-ELLE ?
//
// Le pendant de cellsForTrack pour le mode isolé (demande Adrien : « si j'isole
// un lieu que j'ai nommé, quand je zoom, des tuiles nouvelles se créent pour
// contenir tout le Var, dans la limite de 5×5 »). Pure et testée — aucun DOM,
// aucun réseau : `parts` est la liste de polygones GeoJSON [[[lon,lat],…],…]
// que rend region-mask.js, `dem` la dalle CENTRALE dont la géoréférence
// s'extrapole linéairement au-delà de ±28 (geo.js latLonToWorld).
//
// ⚠️ ÉCHANTILLONNER LES SOMMETS NE SUFFIT PAS, dans les deux sens :
//   · un long côté droit saute par-dessus une dalle entière sans y poser un
//     seul sommet — d'où le test segment/rectangle ;
//   · au MILIEU d'une grande zone, une dalle n'est traversée par aucun segment
//     du contour et se retrouve pourtant pleine — d'où le test d'appartenance
//     du centre de la dalle.
// Et l'inverse compte autant : une dalle que rien ne touche ne doit PAS naître,
// sinon le damier paie un DEM et un maillage pour afficher du vide. Une simple
// emprise englobante aurait créé toute la diagonale entre deux îlots opposés.
export function cellsForParts(parts, dem, r = GRID_R) {
  const need = new Set()
  if (!parts?.length || !dem) return need
  // projeter une fois pour toutes : latLonToWorld coûte un log2/atan par sommet
  const polys = []
  for (const poly of parts) {
    const rings = []
    for (const ring of poly || []) {
      const pts = []
      for (const c of ring || []) {
        const lon = c?.[0]
        const lat = c?.[1]
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
        pts.push(latLonToWorld(dem, clampLat(lat), lon))
      }
      if (pts.length > 1) rings.push(pts)
    }
    if (rings.length) polys.push(rings)
  }
  if (!polys.length) return need

  const H = TERRAIN_SIZE / 2
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      if (i === 0 && j === 0) continue // le bloc central n'appartient pas au damier
      const cx = i * TERRAIN_SIZE
      const cz = j * TERRAIN_SIZE
      const x0 = cx - H
      const x1 = cx + H
      const z0 = cz - H
      const z1 = cz + H
      let touche = false
      for (const rings of polys) {
        for (const ring of rings) {
          for (let k = 1; k < ring.length && !touche; k++) {
            const a = ring[k - 1]
            const b = ring[k]
            if (segHitsRect(a.x, a.z, b.x, b.z, x0, z0, x1, z1)) touche = true
          }
          if (touche) break
        }
        if (touche) break
        // aucun contour ne la traverse : la dalle est-elle NOYÉE dans la zone ?
        if (pointInRingXZ(cx, cz, rings[0])) {
          let trou = false
          for (let h = 1; h < rings.length; h++) if (pointInRingXZ(cx, cz, rings[h])) trou = true
          if (!trou) touche = true
        }
        if (touche) break
      }
      if (touche) need.add(`${i},${j}`)
    }
  }
  return need
}
// LE CACHE DE MNT DU DAMIER — et pourquoi il ne grossit PAS.
//
// ⚠️ CE CACHE PÈSE : un DEM en tuiles 256 px fait 768² flottants (2,3 Mo), le
// même en tuiles 512 px en fait 1536² (9,4 Mo). Un damier plein tient déjà
// 24 MNT VIVANTS, soit 207 Mo, sur un tas JS mesuré à 1,76 Go pour une limite
// pratique de 2 à 4 Go dans Chrome. Le dimensionner « sur le damier »
// (25 entrées) y ajouterait 235 Mo : le geste évident est ici le piège.
//
// D'OÙ VIENNENT LES CHIFFRES DE CE FICHIER. Une seule campagne fait foi, celle
// du rapport docs/superpowers/plans/2026-07-27-damier-optimisation.md (« Le
// Var » isolé, z11 → z12, Mapterhorn en tuiles 512 px, MNT 1536², 24 dalles) :
// 6 405 requêtes pour 260 URL distinctes, 101 s, 1 762 Mo de tas JS. Toute
// autre mesure citée ici est une mesure de BANC — le damier bouchonné de
// test/damier-reseau.test.js, AWS en tuiles 256 px — et le dit explicitement.
//
// Trois étages, du moins cher au plus cher. L'invariant qui tient la mémoire
// n'est pas une élégance, et il se dit AU NIVEAU DE LA CLÉ : UNE DALLE N'EST
// JAMAIS DÉTENUE PAR DEUX ÉTAGES À LA FOIS.
//
// ⚠️ Le dire « objet par objet » (aucun MNT dans deux étages) est plus faible,
// et ça s'est payé une fois : le dessaisissement de l'étage 3 vidait le cache
// un tour de microtâche AVANT que la cellule ne naisse, donc aucun MNT n'était
// jamais en double — et pourtant, la clé n'étant retenue par personne pendant
// cet intervalle, un SECOND MNT partait sur le réseau pour la même dalle.
// L'invariant d'objet restait vrai, celui de clé était rompu, et il coûtait
// 117 requêtes (cf. l'étage 1 et test/damier-reseau.test.js).
//
//   1. LES CHARGEMENTS EN VOL — une promesse par dalle, JAMAIS évincée tant
//      qu'elle n'a pas rendu la main. C'est la correction qui compte : main.js
//      resynchronise le damier à chaque arrivée de dalle (onReady →
//      gpxLayer.rebuildAll → sync), le cache borné évinçait des promesses non
//      RÉSOLUES, et chaque resynchro relançait le chargement des vingt autres.
//      Mesuré (campagne de référence) : 322 appels de loadDem pour 23 dalles.
//      ⚠️ Cet étage inscrit TOUTE promesse rendue à sync, réseau ou pas — y
//      compris celle, déjà résolue, dont l'étage 3 vient de se dessaisir. Il
//      est la mémoire UNIQUE de la clé entre l'instant où un étage la lâche et
//      celui où la cellule la reprend ; l'en dispenser, c'est rouvrir la
//      fenêtre de course décrite ci-dessus.
//   2. LES CELLULES VIVANTES — elles détiennent déjà leur MNT. Le relire coûte
//      un parcours de 24 entrées ; en garder une copie coûterait 235 Mo.
//   3. LES MNT DÉTACHÉS — ceux des cellules qu'on vient de détruire, les seuls
//      à mériter une place en propre (dézoom qui va et vient, mode isolé qui
//      rase puis rebâtit). Budget INCHANGÉ : 32 Mo, comme avant ce correctif.
//      ⚠️ Cet étage REND ET SE DESSAISIT (cf. _loadCellDem) : le MNT qui repart
//      dans une cellule quitte le cache — en passant la main à l'étage 1, qui
//      tient la clé jusqu'à la naissance de la cellule — et celui qu'on jette
//      y revient (_keepDetachedDem). Sans ce dessaisissement,
//      l'étage 3 se remplissait de MNT que des cellules
//      VIVANTES détenaient déjà — gratuits à garder, puisque partagés — et
//      évinçait à leur place les détachés, les seuls pour qui il existe.
const DEM_CACHE_BYTES = 32 * 1024 * 1024

// LA QUATRIÈME MÉMOIRE : LES ÉCHECS. Elle ne garde pas d'octets, elle garde des
// clés — et sans elle, la tempête de requêtes que ce fichier vient de supprimer
// revient par la porte d'à côté.
//
// loadDem LÈVE quand aucune tuile n'a été peinte (404 de couverture, créneau
// `ty` hors bornes près des pôles, panne réseau) — le cas NORMAL d'un damier à
// cheval sur un bord de jeu national. Or l'étage 1 se purge à l'atterrissage et
// l'étage 3 n'accueille que des MNT résolus : un échec n'était retenu nulle
// part, donc chaque arrivée de dalle voisine (→ onReady → sync) réémettait les
// chargements morts. Mesuré au BANC (damier de 24 dalles dont la colonne i=+2
// est hors couverture) : 90 requêtes d'altitude pour 45 URL mortes. Et le banc
// est OPTIMISTE — ses arrivées se bousculent dans le même tour de boucle, donc
// la mémoire des tuiles en vol (dem.js) absorbe une partie des relances. Sur le
// terrain, où les dalles arrivent à ~4 s d'intervalle, plus rien ne se recouvre
// et le facteur monte d'autant.
//
// Le TTL plutôt qu'un Set définitif, et c'est un choix : un 404 de couverture
// est permanent, mais une coupure réseau ne l'est pas, et le damier n'a aucun
// autre moment pour retenter — main.js ne le resynchronise que sur événement.
// Une minute borne la tempête à un essai par dalle et par minute (au lieu d'un
// par arrivée de voisin) tout en laissant le relief apparaître si le réseau
// revient pendant que l'utilisateur regarde la carte.
const DEM_FAIL_TTL_MS = 60_000

export class BlockGrid {
  // getMainDem() → DEM central ; getMainTerrain() → Terrain central (teinte
  // continue) ; getPlinth() → le socle principal (matériau + baseY partagés,
  // pour donner aux voisins EXACTEMENT la même finition)
  constructor({ scene, params, getMainDem, getMainTerrain, getPlinth }) {
    this.scene = scene
    this.params = params
    this.getMainDem = getMainDem
    this.getMainTerrain = getMainTerrain
    this.getPlinth = getPlinth
    this.cells = new Map() // "i,j" → { terrain, dem, key }
    this._demPending = new Map() // zoom:tx,ty → Promise<dem> EN VOL (jamais évincée)
    this._demCache = new Map() // LRU zoom:tx,ty → dem DÉTACHÉ (borné en octets)
    this._demFailed = new Map() // zoom:tx,ty → date de l'échec (cf. DEM_FAIL_TTL_MS)
    this._need = new Set() // dalles réclamées par la DERNIÈRE synchro (cf. sync)
    // Contour de la zone ISOLÉE, s'il y en a une. C'est un ÉTAT du damier et
    // pas un argument de sync() pour une raison précise : sync est rappelée de
    // partout (re-drapage GPX, arrivée d'un voisin, fermeture d'un parcours), et
    // le moindre appel qui ignorerait la zone raserait ses dalles — puis les
    // rebâtirait au passage suivant, en boucle.
    this.regionParts = null
    this.onReady = null // (cell) => {} — un voisin vient d'arriver (re-drapage GPX)
    this.onGridChanged = null // () => {} — le damier a gagné/perdu une cellule
    this.onCoastReady = null // (cell) => {} — son trait de côte est arrivé (re-découpe de zone)
  }

  // rayon MONDE couvert par le damier au-delà du bloc central (0 si aucun
  // voisin) : sert au trafic aérien pour qu'un avion traverse d'une dalle à la
  // suivante sans coupure au lieu de disparaître au bord du bloc central.
  spanRadius() {
    let r = 0
    for (const cell of this.cells.values()) r = Math.max(r, Math.abs(cell.i), Math.abs(cell.j))
    return r * TERRAIN_SIZE
  }

  // Quelles cellules le tracé touche-t-il ? (coordonnées monde CONTINUES du
  // DEM central — latLonToWorld extrapole linéairement au-delà de ±28.)
  cellsForTrack(points) {
    const dem = this.getMainDem()
    const need = new Set()
    if (!dem || !points?.length) return need
    for (const p of points) {
      const w = latLonToWorld(dem, p.lat, p.lon)
      const i = Math.round(w.x / TERRAIN_SIZE)
      const j = Math.round(w.z / TERRAIN_SIZE)
      if (i === 0 && j === 0) continue
      if (Math.abs(i) > GRID_R || Math.abs(j) > GRID_R) continue // hors damier 5×5
      need.add(`${i},${j}`)
    }
    return need
  }

  // Le contour de la zone isolée que le damier doit porter (null = plus de
  // zone). L'appelant enchaîne avec sync() pour que le damier se refasse.
  setRegionParts(parts) {
    this.regionParts = parts?.length ? parts : null
  }

  // Toutes les dalles réclamées : celles du tracé GPX ET celles de la zone
  // isolée. Les deux raisons de faire grandir le damier cohabitent — isoler une
  // région pendant qu'un parcours est chargé ne doit rien retirer à l'autre.
  cellsNeeded(points) {
    const dem = this.getMainDem()
    const need = this.cellsForTrack(points)
    if (dem && this.regionParts) for (const key of cellsForParts(this.regionParts, dem)) need.add(key)
    return need
  }

  // (Re)synchronise le damier sur le tracé courant : charge les cellules
  // manquantes, retire celles devenues inutiles (dézoom, recadrage, clear).
  sync(points) {
    const dem = this.getMainDem()
    const need = dem ? this.cellsNeeded(points) : new Set()
    // ⚠️ CE QU'UNE ARRIVÉE DOIT VÉRIFIER, C'EST LE BESOIN, PAS LE NUMÉRO DE
    // SYNCHRO. Un compteur incrémenté à chaque sync() périmait les chargements
    // ENCORE JUSTES : main.js resynchronise à chaque arrivée de dalle, donc un
    // MNT qui revenait entre deux arrivées était jeté, et rechargé au passage
    // suivant. Mesuré au BANC en rejouant ce compteur sur le code d'aujourd'hui
    // (test/damier-reseau.test.js) : 243 requêtes d'altitude pour 216 tuiles.
    // Les deux seules vraies raisons de jeter un MNT qui arrive sont : la dalle
    // n'est plus réclamée, ou le bloc central a bougé sous elle. On teste
    // exactement ça — la GÉORÉFÉRENCE du centre, et rien de plus : ni un
    // compteur (trop large, il périme des MNT justes), ni l'identité de l'objet
    // DEM (trop étroite, le centre est remplacé même quand il revient au même
    // endroit). Les deux tests « le centre… » verrouillent ces deux bords.
    this._need = need
    const centerKey = dem ? this._centerKey(dem) : null
    // retirer l'inutile
    let changed = false
    for (const [key, cell] of this.cells) {
      if (!need.has(key)) {
        this._disposeCell(cell)
        this.cells.delete(key)
        changed = true
      }
    }
    if (changed) this.onGridChanged?.()
    if (!dem) return
    // charger le manquant
    // ⚠️ le damier ALIGNE les voisins sur la grille de tuiles du bloc central
    // (originTileX ± tilesAcross) : compter les tuiles avec 256 en dur pendant
    // que le DEM en sert des 512 doublait le pas et ouvrait une couture d'un
    // bloc entier entre le centre et ses voisins.
    const tilesAcross = Math.round(dem.size / demTilePx(dem))
    for (const key of need) {
      if (this.cells.has(key)) {
        // zone/zoom du centre a changé ? re-seat la cellule
        const cell = this.cells.get(key)
        if (cell.centerKey === this._centerKey(dem)) continue
        this._disposeCell(cell)
        this.cells.delete(key)
      }
      const [i, j] = key.split(',').map(Number)
      const origin = { x: dem.originTileX + i * tilesAcross, y: dem.originTileY + j * tilesAcross }
      const demKey = `${dem.zoom}:${origin.x},${origin.y}`
      this._loadCellDem(dem.zoom, origin, tilesAcross)
        .then((nDem) => {
          // Les trois raisons de ne PAS bâtir. Dans chacune, le MNT qui arrive
          // se retrouve sans porteur — et l'étage 3 s'en est dessaisi en le
          // rendant : on le lui redonne, sinon il faudrait le retélécharger.
          // (_keepDetachedDem refuse de son côté ce qu'une cellule détient.)
          if (this.cells.has(key)) { this._keepDetachedDem(demKey, nDem); return } // déjà bâtie par une autre arrivée
          if (!this._need.has(key)) { this._keepDetachedDem(demKey, nDem); return } // la dalle n'est plus réclamée
          const cur = this.getMainDem()
          if (!cur || this._centerKey(cur) !== centerKey) { // le centre a bougé
            this._keepDetachedDem(demKey, nDem)
            return
          }
          const cell = this._buildCell(i, j, nDem)
          cell.centerKey = centerKey
          // la cellule DEVIENT le cache de son propre MNT (voir _loadCellDem) —
          // demRaw est le MNT d'origine, cell.dem en est une copie de surface
          // dont le meanM est aligné sur le bloc central
          cell.demKey = demKey
          cell.demRaw = nDem
          this.cells.set(key, cell)
          this.onReady?.(cell)
          this.onGridChanged?.()
        })
        .catch(() => {}) // tuile océan absente etc. — la cellule reste vide
    }
  }

  _centerKey(dem) {
    return `${dem.zoom}:${dem.originTileX},${dem.originTileY}`
  }

  // Les trois étages décrits en tête de fichier, du moins cher au plus cher,
  // précédés de la mémoire des échecs (DEM_FAIL_TTL_MS).
  _loadCellDem(zoom, origin, tilesAcross) {
    const key = `${zoom}:${origin.x},${origin.y}`
    // 0. cette dalle a échoué il y a peu → on ne relance rien. Le rejet est
    // immédiat et de même forme que celui de loadDem : l'appelant (sync) le
    // traite déjà comme une dalle qui ne naîtra pas.
    const echec = this._demFailed.get(key)
    if (echec != null) {
      if (Date.now() - echec < DEM_FAIL_TTL_MS) {
        return Promise.reject(new Error(`dalle ${key} en échec récent — pas de relance avant ${DEM_FAIL_TTL_MS} ms`))
      }
      this._demFailed.delete(key)
    }
    // 1. déjà en vol → LA MÊME promesse. Vingt resynchros n'émettent qu'un
    // chargement, et il n'est jamais évincé sous les pieds de l'appelant.
    const vol = this._demPending.get(key)
    if (vol) return vol
    // 2. une cellule vivante le détient déjà : coût mémoire nul. (`disposed`
    // exclu : sa cellule est en train de mourir et son MNT part au cache — le
    // rendre ici le placerait dans deux étages à la fois.)
    for (const cell of this.cells.values()) {
      if (!cell.disposed && cell.demKey === key && cell.demRaw) return Promise.resolve(cell.demRaw)
    }
    // 3. détaché, encore dans le budget. Le cache le REND et S'EN DESSAISIT :
    // le MNT s'en va habiter la cellule qui naîtra de lui (étage 2), et si
    // cette cellule ne naît pas, sync() le lui rend (_keepDetachedDem). Un
    // `delete` + `set` — le simple MRU d'avant — laissait l'entrée en place et
    // vidait l'étage 3 de son sens : il ne contenait plus que des MNT vivants.
    //
    // ⚠️ ET LE MNT RENDU PASSE PAR L'ÉTAGE 1, exactement comme un chargement
    // réseau. Sans cette ligne, le dessaisissement ouvrait une FENÊTRE DE
    // COURSE : l'étage 3 se vidait tout de suite, la cellule ne naissait qu'au
    // tour de microtâche suivant, et main.js resynchronise entre les deux
    // (onReady → rebuildAll → sync). Pendant cet intervalle la clé n'était
    // retenue par AUCUN étage et un chargement réseau repartait. Mesuré au BANC
    // sur la phase « retour » du cycle détacher/rattacher — le scénario même
    // pour lequel l'étage 3 existe : 162 requêtes d'altitude (18 dalles) au
    // lieu de 45 (5 dalles), soit 13 des 14 MNT rendus par le cache
    // re-téléchargés. Et transitoirement 13 MNT en double en mémoire.
    const garde = this._demCache.get(key)
    const p = garde
      ? (this._demCache.delete(key), Promise.resolve(garde))
      : loadDem({ lat: 0, lon: 0, zoom, tilesAcross, originTile: origin })
    this._demPending.set(key, p)
    // then(f, f) et non finally : le rejet est absorbé ici. L'échec, lui, se
    // MÉMORISE — c'est la seule chose qui empêche la resynchro suivante de
    // relancer une dalle qu'on sait morte.
    const fini = (rate) => {
      if (this._demPending.get(key) === p) this._demPending.delete(key)
      if (!rate) return
      for (const [k, t] of this._demFailed) if (Date.now() - t >= DEM_FAIL_TTL_MS) this._demFailed.delete(k)
      this._demFailed.set(key, Date.now())
    }
    p.then(() => fini(false), () => fini(true))
    return p
  }

  // Un MNT vient de perdre sa cellule — ou de ne pas en trouver : c'est le SEUL
  // moment où le cache mérite d'en garder une référence en propre. Tant que la
  // dalle vit, elle EST le cache (étage 2) ; dupliquer ce qu'elle détient déjà,
  // c'est 235 Mo pour rien. D'où le refus net quand un porteur existe.
  _keepDetachedDem(key, dem) {
    if (!key || !dem?.data) return
    for (const cell of this.cells.values()) {
      if (!cell.disposed && cell.demKey === key && cell.demRaw) return // déjà porté : étage 2
    }
    this._demCache.delete(key)
    this._demCache.set(key, dem)
    let octets = 0
    for (const d of this._demCache.values()) octets += d.data.byteLength
    while (this._demCache.size > 1 && octets > DEM_CACHE_BYTES) {
      const vieux = this._demCache.keys().next().value
      octets -= this._demCache.get(vieux).data.byteLength
      this._demCache.delete(vieux)
    }
  }

  _buildCell(i, j, nDem) {
    // params voisin : même apparence, maillage réduit (contexte)
    const p = { ...this.params, resolution: Math.min(this.params.resolution ?? NEIGHBOUR_RES, NEIGHBOUR_RES) }
    // CONTINUITÉ VERTICALE : le sampler élève en (raw - meanM)·scale — chaque
    // bloc doit partager la référence meanM du bloc CENTRAL, sinon les
    // jointures marquent des falaises fantômes. (extentMeters : même zoom →
    // même échelle, rien d'autre à harmoniser.)
    const main = this.getMainDem()
    const dem = main ? { ...nDem, meanM: main.meanM } : nDem
    // rampe, rugosité et bump viennent du bloc central : elles sont identiques
    // octet pour octet d'une dalle à l'autre (voir shareTexturesFrom)
    const terrain = new Terrain(p, {
      offset: { x: i * TERRAIN_SIZE, z: j * TERRAIN_SIZE },
      analysisMax: NEIGHBOUR_ANALYSIS_SIZE,
      seaMax: NEIGHBOUR_SEA_SIZE,
      shareFrom: this.getMainTerrain?.() || null,
    })
    terrain.setDem(dem)
    terrain.rebuild(p)
    // CONTINUITÉ DE TEINTE : la rampe hypsométrique se normalise par bloc —
    // aligner la plage de hauteurs sur celle du bloc central
    const mt = this.getMainTerrain?.()
    if (mt) terrain.mapUniforms.uHeightRange.value.copy(mt.mapUniforms.uHeightRange.value)
    // ---------------------------------------------------------------------
    // UNE DALLE VOISINE SORT ENTIÈREMENT DE LA PASSE D'OMBRE (28/07/2026)
    // ---------------------------------------------------------------------
    // ⚠️ IL FAUT COUPER LES DEUX DRAPEAUX, ET `receiveShadow` EST LE VRAI.
    // Ce n'est pas une ceinture-et-bretelles : le rendu est en VSM
    // (`renderer.shadowMap.type = THREE.VSMShadowMap`, main.js), et three écrit
    // noir sur blanc, dans WebGLShadowMap.renderObject :
    //     object.castShadow || (object.receiveShadow && type === VSMShadowMap)
    // Autrement dit, sous VSM, un objet qui REÇOIT une ombre est aussi dessiné
    // dans la carte d'ombre. Passer le seul `castShadow` à false ne retire donc
    // RIEN : mesuré, la passe d'ombre restait à 2 260 040 triangles, au
    // triangle près. C'est le piège de ce fichier — quiconque « rétablit »
    // receiveShadow ici pour faire joli remet 1,07 million de triangles par
    // image sans qu'aucun test ne bronche.
    //
    // POURQUOI ON A LE DROIT DE LES COUPER : la caméra d'ombre du soleil couvre
    // ±42 unités monde (main.js) quand une dalle en fait 56 de côté. Une
    // voisine commence donc à 28 et SORT DU CADRE À 42 — elle n'était ombrée
    // que sur une bande de 14 unités, puis pleinement éclairée sur les 42
    // suivantes. La coupure était déjà à l'écran avant qu'on y touche. Vérifié
    // en capture, damier 3×3, soleil à 5,8° d'élévation (le cas extrême, celui
    // des ombres les plus longues) : les voisines sont indiscernables d'avant,
    // et le bloc central — qui garde ses deux drapeaux — ne bouge pas d'un
    // pixel. La voisine reste un CONTEXTE (256² au lieu de 768², cf.
    // NEIGHBOUR_RES) : son relief se lit par son ombrage diffus et son bump.
    //
    // CE QUE ÇA COÛTAIT — mesuré le 28/07/2026 (1920×1080, La Réunion, damier
    // 3×3, 8 voisines) :
    //   passe d'ombre : 2 260 040 → 1 188 328 triangles, 21 → 5 appels ;
    //   image entière : 4 527 467 → 3 455 755 triangles, soit −23,7 %.
    // Le damier monte à 5×5 au palier 0 (damierMax 24) : c'était jusqu'à trois
    // millions de triangles par image pour un liseré. Ce qui RESTE dans la
    // passe, c'est le relief du bloc central (1 179 648 triangles, 99,3 % du
    // total) — et lui doit y rester : c'est le relief qui s'ombre lui-même,
    // l'image entière tient dessus.
    terrain.mesh.castShadow = false
    terrain.mesh.receiveShadow = false
    this.scene.add(terrain.mesh)

    const cell = { i, j, terrain, dem }
    // SOCLE : mêmes murs que le bloc principal (matériau partagé → suit le
    // panneau Block), baseY plafonné au socle central pour un fond de damier
    // plat sans percer un voisin plus profond
    const plinth = this.getPlinth?.()
    if (plinth?.wallMat && plinth.group?.visible !== false) {
      const cornerR = Math.min(TERRAIN_SIZE / 2 - 0.05, Math.max(0.05, (this.params.slabCorner ?? 0) * TERRAIN_SIZE))
      const { geo } = buildSlabWalls(terrain.sample, {
        depth: plinth.depth ?? 7,
        resolution: p.resolution,
        cornerR,
        cornerExp: exposantCoin(this.params.slabCornerSmoothing), // même coin que la dalle centrale
        baseYFloor: plinth.baseY,
      })
      const walls = new THREE.Mesh(geo, plinth.wallMat)
      // même raison, et même piège VSM, que le relief de la voisine ci-dessus :
      // ces murs n'ont rien sous eux à ombrer et sortent du cadre de la caméra
      // d'ombre avec le reste de la dalle. Les DEUX drapeaux, donc.
      walls.castShadow = false
      walls.receiveShadow = false
      walls.position.set(i * TERRAIN_SIZE, 0, j * TERRAIN_SIZE)
      this.scene.add(walls)
      cell.walls = walls
    }
    // dès la naissance, la cellule porte le matériau/shader de la dalle centrale
    this._applyLook(cell, this.params)
    // masque côtier de LA cellule : chaque voisin a SON dem/footprint, le
    // masque du bloc central ne le couvre pas — sans le sien, ses polders
    // sous le niveau 0 seraient peints en mer par la règle altitude. Async,
    // non bloquant ; échec/hors bande → repli altitude comme avant. La
    // texture appartient à la cellule (disposée avec elle, cf. _disposeCell).
    if (dem.zoom >= COAST_ZOOM_MIN && dem.zoom <= COAST_ZOOM_MAX) {
      fetchCoastMask({ lat: 0, lon: 0, zoom: dem.zoom, dem, size: NEIGHBOUR_COAST_SIZE })
        .then((res) => {
          if (!res) return
          if (cell.disposed) { res.maskTexture.dispose(); return } // cellule retirée pendant le fetch
          // ⚠️ Plus de getImageData : le champ R8 sort tel quel de
          // coast-mask.js, et c'est LE MÊME TABLEAU que la texture. Ces deux
          // lignes coûtaient 4,19 Mo d'ImageData par dalle voisine pour
          // recopier, au quadruple de leur taille utile, des octets déjà là.
          const img = res.maskField
          cell.coastImage = img // la découpe de zone la relit pour garder les polders
          terrain.setCoastMask(res.maskTexture, img) // relance aussi son sea mask (polders)
          this.onCoastReady?.(cell)
        })
        .catch(() => {})
    }
    return cell
  }

  // Hauteur du sol à un point monde QUELCONQUE du damier (drapage GPX hors du
  // bloc central) — null si aucune cellule chargée ne couvre le point.
  heightAt(x, z) {
    const i = Math.round(x / TERRAIN_SIZE)
    const j = Math.round(z / TERRAIN_SIZE)
    if (i === 0 && j === 0) return null // le bloc central appartient à terrain.sample
    const cell = this.cells.get(`${i},${j}`)
    if (!cell?.terrain?.sample) return null
    return cell.terrain.sample(x - i * TERRAIN_SIZE, z - j * TERRAIN_SIZE)
  }

  // opacité de la photo aérienne (slider Map) → toutes les cellules
  setAerialOpacity(v) {
    for (const cell of this.cells.values()) cell.terrain?.setAerialOpacity?.(v)
  }
  setAerialCoastFade(v) {
    for (const cell of this.cells.values()) cell.terrain?.setAerialCoastFade?.(v)
  }

  // le look a changé (template, contours, rampe, MATÉRIAU…) — les voisins
  // suivent la dalle PRINCIPALE comme un composant (Adrien) : même rampe, même
  // matériau/relief/shader de surface. Ce qui doit rester PROPRE à chaque dalle
  // ne bouge pas : topographie (géométrie/DEM) et photo aérienne (uAerial posé
  // par paintCellAerial), jamais retouchées ici.
  restyle(params) {
    const mt = this.getMainTerrain?.()
    for (const cell of this.cells.values()) this._applyLook(cell, params, mt)
  }
  _applyLook(cell, params, mt = this.getMainTerrain?.()) {
    const t = cell.terrain
    if (!t) return
    const p = { ...params, resolution: Math.min(params.resolution ?? NEIGHBOUR_RES, NEIGHBOUR_RES) }
    // l'emprunt des textures communes se réarme ici : une dalle née avant le
    // bloc central (ou après son remplacement) doit se raccrocher, sinon elle
    // recuirait sa propre rampe à chaque restyle
    if (mt) t.shareTexturesFrom?.(mt)
    // COLORISATION : le mode (Classique / Naturel) et ses réglages DOIVENT
    // passer ici, sinon la couture au bord du bloc central saute aux yeux — un
    // voisin resté en rampe 1D à côté d'un centre peigné et voilé. setColorMode
    // recuit aussi le LUT de la rampe, il remplace donc rebuildRamp.
    t.setColorMode?.(p.colorMode, p)
    t.updateMaterial?.(p)
    t.setMaterialMode?.(p.terrainSurfaceMat || '', p)
    t.setLiquidMetal?.(!!p.liquidMetal, p)
    t.setSurfaceFx?.(p.surfaceFx | 0)
    if ((p.surfaceFx | 0) > 0 && p.fx?.[p.surfaceFx]) t.applyFxParams?.(p.fx[p.surfaceFx])
    t.setAerialCoastFade?.(p.aerialCoastFade ?? 0.1)
    // continuité de teinte : aligner la plage hypsométrique sur le bloc central
    if (mt) t.mapUniforms.uHeightRange.value.copy(mt.mapUniforms.uHeightRange.value)
  }

  clear() {
    // Plus rien n'est réclamé : les chargements ENCORE EN VOL atterriront sans
    // bâtir personne (leur MNT ira au cache des détachés). Ce n'est pas une
    // annulation et il ne faut pas l'écrire comme telle : un sync() ultérieur
    // qui réarme la même dalle peut très bien laisser atterrir un vol antérieur
    // — le MNT est alors juste, pas étranger, et la garde `centerKey` couvre le
    // seul cas où il ne le serait pas. Sans conséquence en pratique : clear()
    // n'est appelé nulle part en production, main.js ne passe que par sync().
    this._need = new Set()
    const had = this.cells.size
    for (const cell of this.cells.values()) this._disposeCell(cell)
    this.cells.clear()
    if (had) this.onGridChanged?.()
  }

  _disposeCell(cell) {
    cell.disposed = true // gèle les fetchs async encore en vol (masque côtier)
    // son MNT n'a plus de porteur : il passe au cache des DÉTACHÉS, borné
    this._keepDetachedDem(cell.demKey, cell.demRaw)
    cell.aerial?.dispose?.() // AerialLayer dédié de la cellule (posé par main.js)
    if (cell.walls) {
      this.scene.remove(cell.walls)
      cell.walls.geometry?.dispose() // le matériau des murs est PARTAGÉ (socle principal) — ne pas disposer
    }
    const t = cell.terrain
    if (!t) return
    this.scene.remove(t.mesh)
    t.mesh.geometry?.dispose()
    t.material?.dispose()
    // ⚠️ D'ABORD SE DÉSABONNER. Les textures partagées (rampe, rugosité, bump)
    // appartiennent au bloc CENTRAL : les disposer avec la cellule tuerait le
    // relief principal et toutes les autres dalles d'un coup. Et rester inscrit
    // dans son ensemble d'emprunteurs après la mort ferait repointer un mort à
    // la prochaine recuisson.
    const emprunte = !!t._shareSrc
    t.stopSharing?.()
    // ⚠️ AVANT de disposer : un masque de mer ou une analyse encore en vol dans
    // le Worker (terrain-jobs.js) se poserait sur une dalle morte en créant une
    // DataTexture que plus personne ne disposerait. Le damier churn à chaque
    // zoom — ce serait une fuite VRAM par dalle détruite.
    t.cancelFields?.()
    // textures créées PAR instance (le damier churn au fil des zooms) —
    // uAnalysis en fait partie : une RGBA à la taille du DEM (2,3 Mo avec ses
    // mipmaps en tuiles 256 px, ~12 Mo en tuiles 512 px — Mapterhorn), l'oublier
    // ici serait de loin la plus grosse fuite VRAM du lot
    const propres = emprunte
      ? ['uSeaMask', 'uRegionMask', 'uCoastMask', 'uAnalysis'] // uRampTex est au centre
      : ['uRampTex', 'uSeaMask', 'uRegionMask', 'uCoastMask', 'uAnalysis']
    for (const u of propres) {
      const tex = t.mapUniforms?.[u]?.value
      tex?.dispose?.()
    }
    // placeholders 1px par instance : plus la valeur courante quand un vrai
    // masque les a remplacés — les disposer aussi (double dispose inoffensif)
    t._coastPlaceholder?.dispose?.()
    t._seaPlaceholder?.dispose?.()
    t._analysisPlaceholder?.dispose?.()
    t._regionPlaceholder?.dispose?.()
    t._regionEmpty?.dispose?.()
    if (!emprunte) {
      t.material?.roughnessMap?.dispose?.()
      t.material?.bumpMap?.dispose?.()
    }
  }
}
