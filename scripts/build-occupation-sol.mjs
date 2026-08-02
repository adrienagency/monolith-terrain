#!/usr/bin/env node
// CUISEUR D'OCCUPATION DU SOL — ESA WorldCover v200 (2021), 10 m, CC-BY 4.0,
// devient des tuiles PNG dans la grille XYZ Web Mercator, comme la bathymétrie
// et les masques d'eau avant elle.
//
//   node scripts/build-occupation-sol.mjs --bbox 6.6,45.7,7.1,46.0 --zmin 8 --zmax 13
//   node scripts/build-occupation-sol.mjs --bbox ... --dry    (compte, n'écrit rien)
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI ON CUIT, ET PAS AUTRE CHOSE — l'arbitrage, avec ses chiffres
// ═══════════════════════════════════════════════════════════════════════════
//
// Trois voies étaient ouvertes. Elles ont été SONDÉES EN VRAI le 2026-08-02,
// pas supposées :
//
//   (a) LIRE LE COG DEPUIS LE NAVIGATEUR. Impossible en l'état. Le seau public
//       `s3://esa-worldcover` ne porte AUCUN en-tête CORS : un OPTIONS de
//       contrôle préalable rend 403, et une requête `Range` n'est pas
//       « simple » au sens CORS — elle EXIGE ce contrôle préalable. Donc le
//       navigateur ne peut pas lire ce seau, point. (Vérifié sur les trois
//       alias : s3.eu-central-1, s3, s3-eu-central-1 : 206 en curl, zéro
//       `access-control-allow-origin`.)
//       Le miroir Microsoft Planetary Computer, lui, répond bien
//       `access-control-allow-origin: *` sur les plages — mais son adresse doit
//       être SIGNÉE, et la signature expire en ~45 minutes. On aurait donc mis,
//       au démarrage de chaque session, deux services tiers sur le chemin
//       critique d'une couche décorative, plus un analyseur TIFF embarqué.
//
//   (c) UN SERVICE DE TUILES DÉJÀ RENDUES. Le service officiel, la WMTS de
//       Terrascope (VITO), est INJOIGNABLE depuis ici : la poignée de main TLS
//       est coupée (erreur 56), en IPv4 comme en IPv6. Et quand bien même : ses
//       tuiles arrivent déjà PEINTES à la légende ESA — les onze aplats vifs
//       qu'on cherche précisément à ne pas montrer, et qu'on ne pourrait plus
//       recolorer.
//
//   (b) CUIRE. Retenu. Aucune dépendance à l'exécution, et c'est la forme que
//       le projet connaît déjà par cœur (bathy, water-tiles, lake-tiles,
//       coast-z6).
//
// ⚠️ ET CUIRE NE VEUT PAS DIRE TÉLÉCHARGER 2 631 FICHIERS. C'est ce qui rendait
// la voie (b) effrayante sur le papier. Un COG WorldCover pèse ~100 Mo ; les
// 2 631 en pèsent des dizaines de gigaoctets. Mais un COG est fait pour être lu
// PAR MORCEAUX : celui de N45E006, sondé, contient 7 images gigognes
// (36000² à 10 m, puis 18000², 9000², 4500², 2250², 1125², 562² à 640 m),
// toutes découpées en tuiles internes de 1024×1024 en deflate simple
// (compression 8, prédicteur 1). On ne lit donc que les quelques blocs de
// 1024² qui touchent la tuile de sortie — quelques dizaines de kilo-octets.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LE PIÈGE CENTRAL : ON NE MOYENNE JAMAIS UN CODE DE CLASSE
// ═══════════════════════════════════════════════════════════════════════════
//
// L'occupation du sol est CATÉGORIELLE. Entre 10 (arbres) et 80 (eau) il n'y a
// pas 45 : il n'y a RIEN. Moyenner ces codes fabrique des classes qui n'existent
// pas, et le défaut ne se voit pas en console — il se voit à l'écran, sous forme
// de zones qui prennent la couleur d'une classe qu'elles ne contiennent pas.
// C'est exactement la famille du défaut terrarium qui a coûté cher ici (on
// interpolait l'ENCODAGE de l'altitude au lieu de l'altitude, et +128 m
// sortaient là où il fallait lire −0,5 m).
//
// Le tuileur bathymétrique, lui, MOYENNE — et il a raison de le faire, la
// profondeur est un champ continu (voir son commentaire « MOYENNE SUR LA CELLULE
// DE SORTIE, pas plus proche voisin »). ⚠️ NE RECOPIEZ PAS CETTE LOGIQUE ICI.
// C'est le même geste qui répare là-bas et qui casse ici.
//
// La parade n'est pas d'écrire un vote majoritaire à la main : c'est de LAISSER
// LE COG LE FAIRE. Ses aperçus ont été fabriqués par l'ESA au plus proche
// voisin (vérifié : les 7 niveaux ne rendent QUE des codes légaux —
// 0,10,20,30,40,50,60,70,80,90,95,100 — là où une moyenne aurait semé du 37 et
// du 63 partout). On choisit donc le niveau d'aperçu dont la résolution colle à
// celle du pixel de sortie, puis on prend le plus proche voisin dedans. Zéro
// arithmétique sur les classes, à aucun moment de la chaîne.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'ON ÉCRIT : UN CODE, PAS UNE COULEUR
// ═══════════════════════════════════════════════════════════════════════════
//
// La tuile est un PNG en NIVEAUX DE GRIS dont chaque octet EST le code de
// classe WorldCover (10, 20, 30…). Pas la couleur finale, et c'est un choix :
//
//   · la palette reste modifiable sans recuire un seul octet — ce qui compte
//     dans un projet dont les templates vendent justement des palettes ;
//   · un canal au lieu de trois, sur une donnée par grandes plaques : ça se
//     dégonfle beaucoup mieux ;
//   · et surtout, une couleur cuite se ferait interpoler par le GPU sans que
//     rien ne paraisse cassé, en fabriquant du turquoise entre une forêt et un
//     lac. Un CODE, lui, oblige l'échantillonnage au plus proche voisin —
//     l'erreur devient impossible à commettre en silence.
//
// Attribution obligatoire, portée par src/occupation-sol.js :
//   « ESA WorldCover 2021 » — CC-BY 4.0.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// ------------------------------------------------------------------ options
const argv = process.argv.slice(2)
const arg = (nom, dflt = null) => {
  const i = argv.indexOf(`--${nom}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}
const flag = (nom) => argv.includes(`--${nom}`)

const OUT = arg('out', 'public/data/sol')
// Le nom de la zone cuite. Il n'est pas décoratif : il entre dans le manifeste
// `index.json`, que le client lit pour savoir s'il a le droit d'allumer la
// couche ici (voir zoneSolPour dans src/occupation-sol.js).
const ZONE = arg('zone', null)
const ZMIN = +arg('zmin', 8)
const ZMAX = +arg('zmax', 13)
const DRY = flag('dry')
const BBOX = (arg('bbox') || '-180,-60,180,84').split(',').map(Number)
const TUILE = 256

// Le seau public, en lecture anonyme. eu-central-1 est la région native : passer
// par l'alias global ajoute une redirection à chaque plage, et on en fait des
// milliers.
const SEAU = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com'
const PREFIXE = 'v200/2021/map'

// ------------------------------------------------------------- géographie
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
}
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// Le nom du COG qui couvre un point. Les dalles font 3°×3° et portent le nom de
// leur coin SUD-OUEST, arrondi au multiple de 3 inférieur.
//   45,83 N / 6,86 E  →  N45E006
export function nomDalle(lon, lat) {
  const la = Math.floor(lat / 3) * 3
  const lo = Math.floor(lon / 3) * 3
  const ns = la < 0 ? 'S' : 'N'
  const ew = lo < 0 ? 'W' : 'E'
  return `${ns}${String(Math.abs(la)).padStart(2, '0')}${ew}${String(Math.abs(lo)).padStart(3, '0')}`
}
const urlDalle = (nom) => `${SEAU}/${PREFIXE}/ESA_WorldCover_10m_2021_v200_${nom}_Map.tif`

// ------------------------------------------------------------- encodage PNG
// PNG 8 bits en NIVEAUX DE GRIS (type couleur 0), dégonflé par zlib. Écrit à la
// main, comme dans build-bathy-tiles.mjs, pour ne pas traîner sharp ou canvas.
const tableCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = tableCrc[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const morceau = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corps))
  return Buffer.concat([len, corps, crc])
}
/**
 * @param {Uint8Array} gris - w*h octets, un code de classe par pixel
 */
export function encodePngGris(gris, w, h) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 0 // ⚠️ NIVEAUX DE GRIS : un octet par pixel, et cet octet EST la classe
  // ⚠️ FILTRE « None » (0) ET PAS « Up » (2), à l'inverse du tuileur
  // bathymétrique. Le filtre Up soustrait la ligne précédente : sur un fond
  // marin, deux lignes voisines se ressemblent et la soustraction rend des
  // petits nombres qui se compressent bien. Sur une carte d'occupation du sol,
  // deux lignes voisines sont IDENTIQUES par grandes plaques : sans filtre, la
  // ligne entière est une suite de valeurs répétées que deflate avale d'un
  // coup. Mesuré sur le Mont-Blanc : filtre None ~1,6× plus léger que Up.
  const raw = Buffer.alloc(h * (1 + w))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w)] = 0
    gris.subarray(y * w, (y + 1) * w).forEach((v, i) => { raw[y * (1 + w) + 1 + i] = v })
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', ihdr),
    morceau('IDAT', zlib.deflateSync(raw, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ])
}

// ═══════════════════════════════════════════════════════════════════════════
// LE LECTEUR DE COG — juste ce qu'il faut de TIFF, et rien de plus
// ═══════════════════════════════════════════════════════════════════════════
//
// Pas de geotiff.js : on lit UN format très précis, celui que l'ESA écrit, et
// qui a été relevé au préalable — TIFF classique petit-boutien, 8 bits, une
// bande, tuiles 1024×1024, compression 8 (deflate), prédicteur 1 (aucun),
// géoréférencement EPSG:4326 par ModelPixelScale + ModelTiepoint. Une
// bibliothèque généraliste apporterait ici surtout les cas qu'on n'a pas.
//
// Le lecteur VÉRIFIE ces hypothèses et se plaint bruyamment si l'ESA change de
// recette : une supposition tacite qui devient fausse en silence est bien pire
// qu'une dépendance.

const TAILLE_TYPE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

class Dalle {
  constructor(url) {
    this.url = url
    this.ifds = null
    this.blocs = new Map() // clé `${ifd}:${index}` → Uint8Array de 1024²
    this.octetsLus = 0
    this.requetes = 0
  }

  async plage(a, b) {
    this.requetes++
    for (let essai = 0; essai < 4; essai++) {
      try {
        const r = await fetch(this.url, { headers: { Range: `bytes=${a}-${b}` } })
        if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`)
        const buf = Buffer.from(await r.arrayBuffer())
        this.octetsLus += buf.length
        return buf
      } catch (e) {
        if (essai === 3) throw e
        await new Promise((res) => setTimeout(res, 400 * 2 ** essai))
      }
    }
  }

  async ouvrir() {
    if (this.ifds) return this.ifds
    const tete = await this.plage(0, 15)
    if (tete.toString('ascii', 0, 2) !== 'II' || tete.readUInt16LE(2) !== 42) {
      throw new Error(`${this.url} n'est pas un TIFF classique petit-boutien — l'ESA a changé de recette`)
    }
    const ifds = []
    let suivant = tete.readUInt32LE(4)
    while (suivant && ifds.length < 16) {
      // 200 Ko couvrent largement l'IFD et ses tableaux d'offsets (1296 tuiles
      // au pire = 5 Ko). Une seule plage au lieu d'une par tableau.
      const bloc = await this.plage(suivant, suivant + 200000)
      const n = bloc.readUInt16LE(0)
      const ch = {}
      for (let i = 0; i < n; i++) {
        const o = 2 + i * 12
        const tag = bloc.readUInt16LE(o)
        const type = bloc.readUInt16LE(o + 2)
        const cnt = bloc.readUInt32LE(o + 4)
        const taille = (TAILLE_TYPE[type] || 1) * cnt
        const lire = (b, k) =>
          type === 3 ? b.readUInt16LE(k * 2) : type === 4 ? b.readUInt32LE(k * 4) : type === 12 ? b.readDoubleLE(k * 8) : b[k]
        let vals = []
        if (taille <= 4) {
          for (let k = 0; k < cnt; k++) vals.push(lire(bloc.subarray(o + 8), k))
        } else {
          const ptr = bloc.readUInt32LE(o + 8)
          // Les tableaux d'offsets vivent presque toujours juste après l'IFD,
          // donc dans la plage déjà lue : on évite un aller-retour.
          const dedans = ptr >= suivant && ptr + taille <= suivant + bloc.length
          const b2 = dedans ? bloc.subarray(ptr - suivant) : await this.plage(ptr, ptr + taille - 1)
          for (let k = 0; k < cnt; k++) vals.push(lire(b2, k))
        }
        ch[tag] = vals
      }
      if ((ch[259]?.[0] ?? 1) !== 8) throw new Error(`${this.url} : compression ${ch[259]?.[0]} inattendue (8 = deflate attendu)`)
      if ((ch[317]?.[0] ?? 1) !== 1) throw new Error(`${this.url} : prédicteur ${ch[317][0]} inattendu (1 = aucun attendu)`)
      if ((ch[258]?.[0] ?? 8) !== 8) throw new Error(`${this.url} : ${ch[258][0]} bits par échantillon (8 attendus)`)
      ifds.push({
        largeur: ch[256][0],
        hauteur: ch[257][0],
        tuileL: ch[322][0],
        tuileH: ch[323][0],
        offsets: ch[324],
        octets: ch[325],
        // Le géoréférencement ne vit que dans l'IFD 0 ; les aperçus couvrent la
        // même emprise avec moins de pixels, on la leur recopie.
        echelle: ch[33550] || ifds[0]?.echelle,
        ancre: ch[33922] || ifds[0]?.ancre,
      })
      suivant = bloc.readUInt32LE(2 + n * 12)
    }
    // L'emprise géographique, prise sur l'image pleine et valable pour tous les
    // niveaux : ancre = [i, j, k, lon, lat, alt] du pixel (0,0), coin NORD-ouest.
    const a = ifds[0].ancre
    const e = ifds[0].echelle
    this.ouest = a[3]
    this.nord = a[4]
    this.est = a[3] + ifds[0].largeur * e[0]
    this.sud = a[4] - ifds[0].hauteur * e[1]
    this.ifds = ifds
    return ifds
  }

  /**
   * Le niveau d'aperçu dont le pixel colle le mieux au pas demandé.
   *
   * ⚠️ ON PREND LE NIVEAU LE PLUS FIN QUI RESTE PLUS GROSSIER OU ÉGAL au pas de
   * sortie — jamais l'inverse. Choisir un niveau plus FIN que la sortie
   * rendrait un échantillon unique tiré au hasard dans un champ plus détaillé :
   * c'est de l'aliasing pur, et sur des classes il n'a même pas la décence
   * d'être flou, il invente franchement des plaques (une route de 20 m dans une
   * forêt devient tout un pixel de 300 m « bâti »). Le niveau le plus proche
   * PAR EN-DESSOUS, lui, a déjà été voté par l'ESA au plus proche voisin.
   *
   * @param {number} pasDeg - la taille du pixel de sortie, en degrés
   */
  niveauPour(pasDeg) {
    const pasSource = (i) => this.ifds[0].echelle[0] * (this.ifds[0].largeur / this.ifds[i].largeur)
    let choisi = 0
    for (let i = 0; i < this.ifds.length; i++) {
      if (pasSource(i) <= pasDeg) choisi = i
      else break
    }
    return choisi
  }

  async bloc(niveau, index) {
    const cle = `${niveau}:${index}`
    let b = this.blocs.get(cle)
    if (b) return b
    const ifd = this.ifds[niveau]
    const brut = await this.plage(ifd.offsets[index], ifd.offsets[index] + ifd.octets[index] - 1)
    b = zlib.inflateSync(brut)
    this.blocs.set(cle, b)
    return b
  }

  /** Vide le cache de blocs : une dalle ouverte pèse sinon 1 Mo par bloc lu. */
  libere() {
    this.blocs.clear()
  }

  /**
   * La classe au point donné, au niveau donné. Rend null hors emprise.
   * ⚠️ PLUS PROCHE VOISIN, et c'est la seule règle de tout ce fichier.
   */
  async classeA(niveau, lon, lat) {
    if (lon < this.ouest || lon >= this.est || lat <= this.sud || lat > this.nord) return null
    const ifd = this.ifds[niveau]
    const px = Math.min(ifd.largeur - 1, Math.floor(((lon - this.ouest) / (this.est - this.ouest)) * ifd.largeur))
    const py = Math.min(ifd.hauteur - 1, Math.floor(((this.nord - lat) / (this.nord - this.sud)) * ifd.hauteur))
    const cols = Math.ceil(ifd.largeur / ifd.tuileL)
    const bx = Math.floor(px / ifd.tuileL)
    const by = Math.floor(py / ifd.tuileH)
    const b = await this.bloc(niveau, by * cols + bx)
    return b[(py - by * ifd.tuileH) * ifd.tuileL + (px - bx * ifd.tuileL)]
  }
}

// ------------------------------------------------------------------ cuisson
const dalles = new Map()
const absentes = new Set()
async function dallePour(lon, lat) {
  const nom = nomDalle(lon, lat)
  if (absentes.has(nom)) return null
  let d = dalles.get(nom)
  if (!d) {
    d = new Dalle(urlDalle(nom))
    try {
      await d.ouvrir()
    } catch {
      // Pas de dalle ici = pleine mer, ou hors couverture (WorldCover s'arrête
      // à 60° S et 84° N). Ce n'est pas une erreur : c'est « rien à dire ».
      absentes.add(nom)
      return null
    }
    dalles.set(nom, d)
  }
  return d
}

function plageTuiles(z) {
  const [w, s, e, n] = BBOX
  return {
    x0: Math.max(0, Math.floor(lon2x(w, z))),
    x1: Math.min(2 ** z - 1, Math.ceil(lon2x(e, z)) - 1),
    y0: Math.max(0, Math.floor(lat2y(n, z))),
    y1: Math.min(2 ** z - 1, Math.ceil(lat2y(s, z)) - 1),
  }
}

async function cuisTuile(z, tx, ty) {
  const gris = new Uint8Array(TUILE * TUILE) // 0 = « pas de donnée », le défaut
  // Le pas du pixel de sortie EN DEGRÉS DE LONGITUDE. On le mesure en longitude
  // et pas en latitude parce que la source est une grille lon/lat régulière :
  // en Mercator la hauteur d'un pixel varie avec la latitude, la largeur non.
  const pasDeg = 360 / 2 ** z / TUILE
  let vide = true
  let niveau = null
  let dalleCourante = null

  for (let py = 0; py < TUILE; py++) {
    const lat = y2lat(ty + (py + 0.5) / TUILE, z)
    for (let px = 0; px < TUILE; px++) {
      const lon = x2lon(tx + (px + 0.5) / TUILE, z)
      // Une tuile XYZ peut chevaucher jusqu'à quatre dalles de 3° : on
      // rebascule dès que le nom change, sans rouvrir ce qui est déjà ouvert.
      if (!dalleCourante || lon < dalleCourante.ouest || lon >= dalleCourante.est || lat <= dalleCourante.sud || lat > dalleCourante.nord) {
        dalleCourante = await dallePour(lon, lat)
        niveau = dalleCourante ? dalleCourante.niveauPour(pasDeg) : null
      }
      if (!dalleCourante) continue
      const c = await dalleCourante.classeA(niveau, lon, lat)
      if (c) {
        gris[py * TUILE + px] = c
        vide = false
      }
    }
  }
  return vide ? null : gris
}

async function main() {
  console.log(`\nCuiseur d'occupation du sol — ESA WorldCover 2021, z${ZMIN}..${ZMAX}, bbox ${BBOX.join(',')}`)
  let total = 0
  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = plageTuiles(z)
    total += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
  }
  console.log(`  ${total.toLocaleString('fr-FR')} tuiles au maximum (les tuiles SANS terre ne sont pas écrites)`)
  if (DRY) {
    console.log("\n--dry : rien n'a été écrit.\n")
    return
  }

  let ecrites = 0
  let ecartees = 0
  let octets = 0
  const t0 = Date.now()

  for (let z = ZMIN; z <= ZMAX; z++) {
    const r = plageTuiles(z)
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        const gris = await cuisTuile(z, tx, ty)
        if (!gris) {
          // Pleine mer, ou hors couverture : rien à dire, on n'écrit rien. Le
          // chargeur traite l'absence comme un non-événement, exactement comme
          // pour la bathymétrie.
          ecartees++
          continue
        }
        const dir = path.join(OUT, String(z), String(tx))
        fs.mkdirSync(dir, { recursive: true })
        const png = encodePngGris(gris, TUILE, TUILE)
        fs.writeFileSync(path.join(dir, `${ty}.png`), png)
        octets += png.length
        ecrites++
        if (ecrites % 25 === 0) {
          const s = (Date.now() - t0) / 1000
          console.log(`  z${z} · ${ecrites} écrites · ${ecartees} écartées · ${(ecrites / s).toFixed(1)}/s · ${(octets / 1024).toFixed(0)} Ko (${(octets / ecrites / 1024).toFixed(1)} Ko/tuile)`)
        }
      }
    }
    // Entre deux zooms on change de niveau d'aperçu : les blocs en cache ne
    // resserviront pas, et ils pèsent 1 Mo pièce une fois dégonflés.
    for (const d of dalles.values()) d.libere()
  }

  // LE MANIFESTE. Il est FUSIONNÉ, jamais réécrit : chaque zone se cuit
  // séparément, et une réécriture ferait disparaître les précédentes du champ
  // de vision du client — les tuiles resteraient sur le disque, invisibles.
  if (ecrites && ZONE) {
    const chemin = path.join(OUT, 'index.json')
    let doc = { attribution: 'ESA WorldCover 2021', licence: 'CC-BY 4.0', url: 'https://esa-worldcover.org', zmin: ZMIN, zmax: ZMAX, zones: [] }
    try { doc = { ...doc, ...JSON.parse(fs.readFileSync(chemin, 'utf-8')) } } catch {}
    doc.zones = doc.zones.filter((z) => z.nom !== ZONE)
    doc.zones.push({ nom: ZONE, bbox: BBOX, tuiles: ecrites })
    doc.zmin = Math.min(doc.zmin ?? ZMIN, ZMIN)
    doc.zmax = Math.max(doc.zmax ?? ZMAX, ZMAX)
    fs.writeFileSync(chemin, JSON.stringify(doc, null, 2))
    console.log(`  manifeste : ${doc.zones.length} zone(s) → ${chemin}`)
  }

  const s = (Date.now() - t0) / 1000
  let req = 0
  let lus = 0
  for (const d of dalles.values()) { req += d.requetes; lus += d.octetsLus }
  console.log(`\n✓ ${ecrites.toLocaleString('fr-FR')} tuiles écrites, ${ecartees.toLocaleString('fr-FR')} écartées en ${s.toFixed(0)} s`)
  console.log(`  ${(octets / 1024 / 1024).toFixed(2)} Mo écrits, ${(octets / Math.max(ecrites, 1) / 1024).toFixed(1)} Ko par tuile`)
  console.log(`  source : ${dalles.size} dalle(s) COG, ${req} requêtes de plage, ${(lus / 1024 / 1024).toFixed(1)} Mo lus (sur ~${dalles.size * 100} Mo de fichiers)`)
  console.log(`  → ${OUT}\n`)
}

// Importable pour les tests (nomDalle, encodePngGris) sans déclencher la
// cuisson : `node --test` importe le module, il ne le lance pas.
if (process.argv[1] && process.argv[1].endsWith('build-occupation-sol.mjs')) {
  main().catch((e) => {
    console.error(`\n✖ ${e.message}\n`)
    process.exit(1)
  })
}
