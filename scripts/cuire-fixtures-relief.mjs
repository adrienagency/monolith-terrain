#!/usr/bin/env node
// CUISSON DES MNT DE RÉFÉRENCE — six morceaux de monde figés sur le disque,
// pour que le garde-fou des plans d'eau puisse tourner SANS RÉSEAU.
//
// ⚠️ CE SCRIPT NE TOURNE QU'À LA MAIN, et presque jamais. Ce qui est versionné,
// ce sont ses SORTIES (test/fixtures/relief/*.bin.gz) ; lui n'existe que pour
// pouvoir les refaire ou en ajouter une. Un test qui téléchargerait son propre
// MNT ne tournerait pas hors ligne, ne tournerait pas en intégration, et donc
// ne protègerait rien — c'est la même leçon que scripts/verifie-dist.mjs.
//
// SOURCE : le bucket public `elevation-tiles-prod` (terrarium, 256 px, domaine
// public / CC0 pour SRTM+GMTED, cf. registry.opendata.aws/terrain-tiles).
// PAS mapterhorn : ses tuiles sont en WebP, et décoder du WebP demanderait une
// dépendance que ce dépôt n'a pas. L'encodage d'altitude est le MÊME
// (m = R*256 + G + B/256 − 32768), et le défaut qu'on protège — des plaines
// plates adoptées comme plans d'eau — ne vient pas de la source mais de la
// QUANTIFICATION EN MÈTRES ENTIERS que dem-quant.js applique à toutes.
//
// FORMAT DU FICHIER : `Int16Array` en mètres entiers (exactement ce que
// `dem.data` porte en production), aplati ligne par ligne, DIFFÉRENCIÉ
// horizontalement, puis dégonflé par gzip. Les métadonnées (côté, pas au sol,
// lat/lon) vivent dans le manifeste JSON à côté — un binaire muet serait
// illisible dans six mois.
//
// ⚠️ LA DIFFÉRENCIATION N'EST PAS DE LA COQUETTERIE : gzip ne voit pas qu'un
// relief varie lentement, il ne voit que des octets qui se répètent, et deux
// altitudes voisines de 1 203 et 1 204 m n'ont AUCUN octet en commun.
// L'écart, lui, tient sur un octet presque partout. Mesuré sur les six zones :
// 1 828 Kio → 1 051 Kio, soit 43 % de moins, et l'essentiel du gain vient des
// deux zones de montagne (Serre-Ponçon 621 → 297 Kio, Sognefjord 591 → 317).
// L'encodage est SANS PERTE et le test le vérifie sur chaque chargement (la
// taille attendue), parce qu'une fixture silencieusement corrompue rendrait
// tous les seuils du garde-fou insignifiants.
//
// Usage : node scripts/cuire-fixtures-relief.mjs [nom-de-zone…]

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { quantizeElevation } from '../src/dem-quant.js'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const SORTIE = path.join(ICI, '..', 'test', 'fixtures', 'relief')

// ══════════ LES SIX ZONES, ET POURQUOI CHACUNE ═════════════════════════════
//
// Elles ne sont pas jolies, elles sont CHOISIES : chacune est un piège connu
// d'un détecteur d'eau, et les six couvrent les deux façons de se tromper.
//
//   · rhone-valence — LA PLAINE ALLUVIALE, le défaut rapporté par Adrien. Le
//     fond de vallée du Rhône est plat au mètre près sur des kilomètres : un
//     détecteur de platitude y voit des lacs partout.
//   · camargue      — LE DELTA. Encore plus plat, et une partie sous 0 m :
//     c'est le cas où le fond de mer et la terre se touchent.
//   · flevoland     — LE POLDER. Terre habitée SOUS le niveau de la mer ; le
//     cas durement gagné par la session polders, qui doit rester gagné.
//   · serre-poncon  — LE LAC DE BARRAGE. Un VRAI plan d'eau, en Y, coincé
//     entre deux versants : c'est lui qui interdit de simplement tout refuser.
//   · sognefjord    — LE FJORD. Bras de mer étroits et profonds : la forme la
//     plus « ruban » qu'une vraie étendue d'eau puisse prendre.
//   · etretat       — LA CÔTE FRANCHE. Falaise, transition terre/mer nette :
//     le témoin qui ne doit RIEN changer.
//
// ══════════ QUATRE ZONES DE PLUS, LE 2026-08-02 ════════════════════════════
//
// Les six ci-dessus tenaient le PLAFOND (trop d'eau) à UN SEUL zoom. Il y
// manquait exactement ce qui a coûté l'annulation de la première tentative :
//
//   · brest       — LA CÔTE DÉCOUPÉE, le défaut rapporté (« la mer qui rentre
//     dans les côtes »). Mesuré sur place : ce n'est PAS la mer — le trait de
//     côte n'accorde à l'eau que 0,01 % de cellules situées au-dessus de 20 m.
//     Ce sont six dentelles de plateau (29 à 47 m de large) posées à 6, 53 et
//     90 m d'altitude, dont l'une longe le rivage : de loin elles se lisent
//     comme une marée qui remonterait les vallées. Sans cette zone, le
//     garde-fou protégerait la plaine et pas la côte.
//   · annecy-z12 / annecy-z15 — LA MÊME EAU À DEUX FINESSES, et c'est LE couple
//     qui manquait : un seuil peut sembler invariant sans l'être, et personne
//     ne s'en aperçoit tant qu'un seul zoom est testé. z15 porte en plus un
//     défaut PRÉEXISTANT que la mesure a mis au jour (voir plan-eau.js,
//     `longueurMinM`) : à cette finesse le bloc ne fait plus 3 km, et le
//     plancher de 3 km effaçait le lac d'Annecy tout entier.
//   · paris-idf   — LE PLATEAU URBAIN PLAT. C'est lui qui INTERDIT de
//     simplement supprimer le plancher de longueur : deux terrasses bâties à
//     173 m passent le test de largeur (157 et 174 m) sans être de l'eau.
export const ZONES = [
  { nom: 'rhone-valence', lat: 44.93, lon: 4.89, zoom: 12, tuiles: 3, quoi: 'plaine alluviale (vallée du Rhône)' },
  // ⚠️ LA MÊME VALLÉE AU PAS DE LA PRODUCTION (13,5 m/cellule). Pas un
  // doublon : c'est elle qui dit à quel point le défaut est PIRE en vrai. La
  // fixture à 27 m noie 4,41 % du bloc, celle-ci **23,19 %** — la finesse ne
  // dilue pas la dentelle, elle en fabrique davantage. Un garde-fou calibré sur
  // la seule vue grossière aurait donc été calibré cinq fois trop bas.
  //
  // ⚠️ ELLE NE PEUT PAS TENIR LE PLANCHER D'UN COURS D'EAU, et il faut le dire
  // plutôt que de le laisser croire : le Rhône y ressort en BIEFS de 0,5 à
  // 4,8 km (100 à 194 m de large), parce que ces tuiles-ci sont du terrarium
  // z13 BRUT quand la production sert un bloc z12 en tuiles de 512 px —
  // rééchantillonné, donc recollé. Sur l'instance vivante, le fleuve est UNE
  // composante de 16,4 km et 170 m de large, gardée à z12 comme à z14 (173 m).
  // Le plancher « une rivière reste une rivière » est donc tenu par un témoin
  // ANALYTIQUE, à la géométrie mesurée du Rhône — voir garde-plans-eau.test.js.
  { nom: 'rhone-fin', lat: 44.93, lon: 4.89, zoom: 13, tuiles: 7, quoi: 'la même vallée au pas de la production' },
  // ⚠️ z13 ET CINQ TUILES, PAS z12 ET TROIS. Le pas au sol est ce qui compte,
  // pas le numéro de zoom : l'application sert un bloc z12 à 12,7 m/cellule
  // (tuiles de 512 px, cf. dem.js), là où une tuile terrarium z12 nue en vaut
  // 25,4. Cuite à 25,4 m, cette zone rend ZÉRO dentelle — la fixture aurait été
  // verte en ne protégeant rien, ce qui est le seul échec vraiment coûteux pour
  // un garde-fou. À 12,7 m elle porte les six dentelles mesurées au navigateur.
  { nom: 'brest', lat: 48.39, lon: -4.49, zoom: 13, tuiles: 5, quoi: 'côte découpée (rade, abers, estuaire)' },
  { nom: 'annecy-z12', lat: 45.85, lon: 6.17, zoom: 12, tuiles: 3, quoi: 'lac de montagne, vue large' },
  { nom: 'annecy-z15', lat: 45.85, lon: 6.17, zoom: 15, tuiles: 3, quoi: 'le MÊME lac, vue rapprochée' },
  { nom: 'paris-idf', lat: 48.86, lon: 2.35, zoom: 12, tuiles: 3, quoi: 'plateau urbain plat (fausse eau compacte)' },
  { nom: 'camargue', lat: 43.5, lon: 4.45, zoom: 12, tuiles: 3, quoi: 'delta du Rhône' },
  { nom: 'flevoland', lat: 52.45, lon: 5.55, zoom: 12, tuiles: 3, quoi: 'polder sous le niveau de la mer' },
  { nom: 'serre-poncon', lat: 44.51, lon: 6.33, zoom: 12, tuiles: 3, quoi: 'lac de barrage' },
  { nom: 'sognefjord', lat: 61.1, lon: 6.7, zoom: 11, tuiles: 3, quoi: 'fjord' },
  { nom: 'etretat', lat: 49.7, lon: 0.2, zoom: 12, tuiles: 3, quoi: 'côte franche (falaises)' },
]

const TUILE_PX = 256
const url = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`

// ------------------------------------------------------------- codec fixture
// ⚠️ LES DEUX SENS VIVENT CÔTE À CÔTE, ET LE TEST IMPORTE LE DÉCODEUR D'ICI.
// Recopier la formule dans test/garde-plans-eau.test.js aurait laissé deux
// implémentations libres de diverger d'un signe — et un relief décodé de
// travers ne lève AUCUNE erreur : il rend simplement d'autres plans d'eau, et
// le garde-fou se mettrait à protéger un monde qui n'existe pas.
//
// Première colonne : écart avec la ligne du dessus (et, pour le tout premier
// pixel, la valeur brute). Colonnes suivantes : écart avec le voisin de gauche.
// Le débordement Int16 est volontairement laissé faire — il est exactement
// réversible en arithmétique modulo 2^16, ce que `Int16Array` applique seule.
export function encodeRelief(v, cote) {
  const d = new Int16Array(v.length)
  for (let y = 0; y < cote; y++)
    for (let x = 0; x < cote; x++) {
      const i = y * cote + x
      d[i] = x ? v[i] - v[i - 1] : y ? v[i] - v[i - cote] : v[i]
    }
  return zlib.gzipSync(Buffer.from(d.buffer), { level: 9 })
}

export function decodeRelief(gz, cote) {
  const buf = zlib.gunzipSync(gz)
  const v = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
  for (let y = 0; y < cote; y++)
    for (let x = 0; x < cote; x++) {
      const i = y * cote + x
      if (x) v[i] += v[i - 1]
      else if (y) v[i] += v[i - cote]
    }
  return v
}

// ------------------------------------------------------------------ PNG
// Décodeur minimal : 8 bits par canal, non entrelacé, types couleur 0/2/4/6 —
// tout ce que terrarium produit. Écrit à la main parce que le dépôt n'a AUCUNE
// dépendance image, et qu'en ajouter une pour un script joué deux fois par an
// serait payer un poids permanent pour un besoin ponctuel.
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('pas un PNG')
  let p = 8
  let largeur = 0, hauteur = 0, profondeur = 0, typeCouleur = 0
  const idat = []
  while (p < buf.length) {
    const taille = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const corps = buf.subarray(p + 8, p + 8 + taille)
    if (type === 'IHDR') {
      largeur = corps.readUInt32BE(0)
      hauteur = corps.readUInt32BE(4)
      profondeur = corps[8]
      typeCouleur = corps[9]
      if (profondeur !== 8) throw new Error(`profondeur ${profondeur} non gérée`)
      if (corps[12] !== 0) throw new Error('PNG entrelacé non géré')
    } else if (type === 'IDAT') idat.push(corps)
    else if (type === 'IEND') break
    p += 12 + taille
  }
  const canaux = { 0: 1, 2: 3, 4: 2, 6: 4 }[typeCouleur]
  if (!canaux) throw new Error(`type couleur ${typeCouleur} non géré`)
  const brut = zlib.inflateSync(Buffer.concat(idat))
  const pas = largeur * canaux
  const out = Buffer.alloc(hauteur * pas)
  // Défiltrage PNG, les cinq filtres de la spec. `a` = pixel de gauche,
  // `b` = pixel du dessus, `c` = diagonale haut-gauche.
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (pas + 1)]
    const ligne = brut.subarray(y * (pas + 1) + 1, (y + 1) * (pas + 1))
    for (let i = 0; i < pas; i++) {
      const a = i >= canaux ? out[y * pas + i - canaux] : 0
      const b = y > 0 ? out[(y - 1) * pas + i] : 0
      const c = y > 0 && i >= canaux ? out[(y - 1) * pas + i - canaux] : 0
      let v = ligne[i]
      if (filtre === 1) v += a
      else if (filtre === 2) v += b
      else if (filtre === 3) v += (a + b) >> 1
      else if (filtre === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (filtre !== 0) throw new Error(`filtre ${filtre} inconnu`)
      out[y * pas + i] = v & 0xff
    }
  }
  return { largeur, hauteur, canaux, data: out }
}

// ------------------------------------------------------------------ tuiles
const lonLatVersTuile = (lon, lat, z) => {
  const n = 2 ** z
  const la = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180
  return [
    Math.floor(((lon + 180) / 360) * n),
    Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n),
  ]
}

async function cuis(zone) {
  const { nom, lat, lon, zoom, tuiles } = zone
  const [cx, cy] = lonLatVersTuile(lon, lat, zoom)
  const moitie = (tuiles - 1) / 2
  const cote = tuiles * TUILE_PX
  const data = new Int16Array(cote * cote)
  for (let ty = 0; ty < tuiles; ty++) {
    for (let tx = 0; tx < tuiles; tx++) {
      const u = url(zoom, cx - moitie + tx, cy - moitie + ty)
      const r = await fetch(u)
      if (!r.ok) throw new Error(`${u} → HTTP ${r.status}`)
      const png = decodePng(Buffer.from(await r.arrayBuffer()))
      const { canaux, data: px } = png
      for (let y = 0; y < TUILE_PX; y++) {
        for (let x = 0; x < TUILE_PX; x++) {
          const s = (y * TUILE_PX + x) * canaux
          const m = px[s] * 256 + px[s + 1] + px[s + 2] / 256 - 32768
          // ⚠️ LA MÊME QUANTIFICATION QUE LA PRODUCTION, appelée sur le module
          // de production. C'est ELLE le sujet : un MNT en flottants ne
          // reproduirait pas le défaut qu'on protège.
          data[(ty * TUILE_PX + y) * cote + (tx * TUILE_PX + x)] = quantizeElevation(m)
        }
      }
      process.stdout.write('.')
    }
  }
  const metresParPixel = ((156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom) * (256 / TUILE_PX)
  fs.mkdirSync(SORTIE, { recursive: true })
  const gz = encodeRelief(data, cote)
  // ⚠️ ALLER-RETOUR VÉRIFIÉ SUR PLACE. Écrire une fixture fausse ne coûte rien
  // au moment où on l'écrit — ça coûte le jour où le garde-fou est vert sur un
  // relief imaginaire. On ne fait pas confiance au codec, on le contrôle.
  const relu = decodeRelief(gz, cote)
  for (let i = 0; i < data.length; i++)
    if (relu[i] !== data[i]) throw new Error(`${nom} : aller-retour du codec faux en ${i}`)
  fs.writeFileSync(path.join(SORTIE, `${nom}.bin.gz`), gz)
  return { ...zone, cote, extentMeters: metresParPixel * cote }
}

// ⚠️ RIEN NE S'EXÉCUTE À L'IMPORT. test/garde-plans-eau.test.js importe
// `decodeRelief` d'ici : sans cette garde, lancer la suite déclencherait une
// cuisson complète — six MNT téléchargés, et un test qui « échoue » parce
// qu'il n'y a pas de réseau. C'est exactement ce que ce fichier existe pour
// éviter.
const lanceDirectement = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (lanceDirectement) {
  const demandees = process.argv.slice(2)
  const liste = demandees.length ? ZONES.filter((z) => demandees.includes(z.nom)) : ZONES
  const manifeste = []
  for (const z of liste) {
    const m = await cuis(z)
    const octets = fs.statSync(path.join(SORTIE, `${z.nom}.bin.gz`)).size
    console.log(` ${z.nom} ${m.cote}² · ${Math.round(m.extentMeters / 1000)} km · ${(octets / 1024) | 0} Kio`)
    manifeste.push(m)
  }
  if (!demandees.length) {
    fs.writeFileSync(path.join(SORTIE, 'manifeste.json'), JSON.stringify(manifeste, null, 2) + '\n')
    console.log('manifeste écrit')
  }
}
