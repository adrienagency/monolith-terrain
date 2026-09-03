// RECONNAISSANCE BLUETOPO — lit l'INDEX VIVANT, jamais une URL figée.
//
// ⛔ LE PIÈGE QUE B2 A RELEVÉ ET QUI JUSTIFIE CE FICHIER :
// l'index de BlueTopo est un GeoPackage HORODATÉ. Au 2026-09-03 il s'appelle
//   BlueTopo/_BlueTopo_Tile_Scheme/BlueTopo_Tile_Scheme_20260903_145453.gpkg
// et le nom change à chaque republication (mesuré : il portait la date DU JOUR
// même de la reconnaissance). « Tout chemin figé pourrira » — B2.
// Ce script BALAIE donc le préfixe `BlueTopo/_` à chaque exécution et prend le
// plus récent par LastModified. Aucune date n'est écrite en dur nulle part.
//
// Le bucket est PUBLIC et listable sans compte (vérifié) :
//   s3://noaa-ocs-nationalbathymetry-pds  →  https://<bucket>.s3.amazonaws.com/
// Licence CC0-1.0, domaine public fédéral américain.
//
// USAGE
//   node scripts/recon-bluetopo.mjs --index-only
//   node scripts/recon-bluetopo.mjs --bbox -77.4,36.8,-75.5,39.6 --out data/bluetopo
//   node scripts/recon-bluetopo.mjs --bbox ... --telecharge
//   node scripts/recon-bluetopo.mjs --poids-total     (énumère TOUT le bucket)

import fs from 'node:fs'
import path from 'node:path'
import { DuckDBInstance } from '@duckdb/node-api'

const BUCKET = 'noaa-ocs-nationalbathymetry-pds'
const HOST = `https://${BUCKET}.s3.amazonaws.com`
// ⚠️ On ne fige QUE le préfixe du dossier d'index, jamais le nom du fichier.
const PREFIXE_INDEX = 'BlueTopo/_'

const args = process.argv.slice(2)
const opt = (n, d = null) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const flag = (n) => args.includes(n)

const dec = (s) =>
  String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')

// ─────────────────────────────────────────────────────────── listage S3 brut
// L'API REST publique de S3, paginée. Pas d'aws-sdk, pas de credentials.
async function listeS3({ prefix = '', delimiter = null, onPage = null } = {}) {
  let token = null
  const objets = []
  const dossiers = []
  let pages = 0
  do {
    const u = new URL(HOST + '/')
    u.searchParams.set('list-type', '2')
    u.searchParams.set('prefix', prefix)
    u.searchParams.set('max-keys', '1000')
    if (delimiter) u.searchParams.set('delimiter', delimiter)
    if (token) u.searchParams.set('continuation-token', token)
    const r = await fetch(u, { signal: AbortSignal.timeout(120_000) })
    if (!r.ok) throw new Error(`S3 ${r.status} sur ${u}`)
    const xml = await r.text()
    pages++
    for (const m of xml.matchAll(
      /<Contents>\s*<Key>([^<]+)<\/Key>\s*<LastModified>([^<]+)<\/LastModified>[\s\S]*?<Size>(\d+)<\/Size>/g,
    ))
      objets.push({ key: dec(m[1]), modifie: m[2], taille: Number(m[3]) })
    for (const m of xml.matchAll(/<CommonPrefixes><Prefix>([^<]+)<\/Prefix><\/CommonPrefixes>/g))
      dossiers.push(dec(m[1]))
    const t = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) && t ? dec(t[1]) : null
    if (onPage) onPage({ pages, objets: objets.length, dossiers: dossiers.length })
  } while (token)
  return { objets, dossiers, pages }
}

// ────────────────────────────────────────────────── ① L'INDEX VIVANT
// Rend { key, url, taille, modifie } du GeoPackage le PLUS RÉCENT présent
// aujourd'hui dans le bucket. Relu à chaque appel — c'est tout l'objet du script.
export async function indexVivant() {
  const { objets } = await listeS3({ prefix: PREFIXE_INDEX })
  const gpkg = objets.filter((o) => o.key.toLowerCase().endsWith('.gpkg'))
  if (!gpkg.length) throw new Error(`aucun .gpkg sous ${PREFIXE_INDEX} — le schéma du bucket a changé`)
  gpkg.sort((a, b) => (a.modifie < b.modifie ? 1 : -1))
  const g = gpkg[0]
  return { ...g, url: `${HOST}/${g.key.split('/').map(encodeURIComponent).join('/')}` }
}

async function telecharge(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const r = await fetch(url, { signal: AbortSignal.timeout(900_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  fs.writeFileSync(dest, buf)
  return buf.length
}

// ────────────────────────────────────── ② LIRE LE GEOPACKAGE (duckdb spatial)
async function ouvreDuck() {
  const inst = await DuckDBInstance.create(':memory:')
  const c = await inst.connect()
  await c.run('INSTALL spatial;')
  await c.run('LOAD spatial;')
  return c
}
const lignes = async (c, sql) => {
  const r = await c.runAndReadAll(sql)
  return r.getRowObjects()
}

export async function litSchema(gpkgPath, bbox = null) {
  const c = await ouvreDuck()
  const p = gpkgPath.replace(/\\/g, '/').replace(/'/g, "''")
  // ⚠️ LE NOM DE LA COUCHE EST HORODATÉ LUI AUSSI — pas seulement le fichier.
  // Mesuré : couche `BlueTopo_Tile_Scheme_20260903_145453` DANS le gpkg du même
  // nom. Le passer en dur ferait segfauter duckdb (st_read sur une couche
  // absente ne lève pas : il TUE le processus — vu, exit 139). On le relit.
  const couches = await lignes(c, `SELECT layers FROM st_read_meta('${p}')`)
  const nom = couches[0]?.layers?.items?.[0]?.entries?.name
  if (!nom) throw new Error('aucune couche lisible dans le GeoPackage')
  const filtre = bbox
    ? `WHERE ST_Intersects(geom, ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}))`
    : ''
  const cols = await lignes(c, `DESCRIBE SELECT * FROM st_read('${p}', layer='${nom}') LIMIT 1`)
  const noms = cols.map((r) => r.column_name)
  const colRes = noms.find((n) => /resolution/i.test(n)) ?? null
  const colId = noms.find((n) => /^tile$/i.test(n)) ?? noms.find((n) => /tile/i.test(n))
  const sel = [
    `${colId} AS tile`,
    colRes ? `${colRes} AS resolution` : `NULL AS resolution`,
    // ⚡ L'index PORTE l'URL du GeoTIFF. On n'a donc AUCUN besoin de lister les
    // 592 dossiers du bucket un par un (592 requêtes, ~2 min) : le lien vivant
    // est déjà là, et un lien NUL est la marque explicite d'un trou de
    // couverture. C'est la source d'autorité, pas une déduction.
    `GeoTIFF_Link AS url`,
    `Delivered_Date AS livre`,
    `UTM AS utm`,
    `ST_XMin(ST_Envelope(geom)) AS w`,
    `ST_YMin(ST_Envelope(geom)) AS s`,
    `ST_XMax(ST_Envelope(geom)) AS e`,
    `ST_YMax(ST_Envelope(geom)) AS n`,
  ].join(', ')
  const dalles = await lignes(
    c,
    `SELECT ${sel} FROM st_read('${p}', layer='${nom}') ${filtre} ORDER BY tile`,
  )
  return { couche: nom, colonnes: noms, dalles: dalles.map((d) => ({ ...d, resolution: d.resolution == null ? null : Number(d.resolution) })) }
}

// ───────────────────────────────── ③ QUELLES DALLES SONT VRAIMENT PUBLIÉES
// Le schéma décrit la GRILLE ; le bucket dit ce qui est CUIT. BlueTopo est
// trouée par construction — « une source fine est TOUJOURS trouée »
// (src/bathy-sources.js). On confronte donc les deux, on ne suppose pas.
export async function tiffsPublies(tuiles) {
  const out = new Map()
  let fait = 0
  for (const t of tuiles) {
    const { objets } = await listeS3({ prefix: `BlueTopo/${t}/` })
    const tif = objets.filter((o) => /\.tiff?$/i.test(o.key))
    if (tif.length) {
      tif.sort((a, b) => (a.key < b.key ? 1 : -1))
      out.set(t, { ...tif[0], url: `${HOST}/${tif[0].key}` })
    }
    if (++fait % 25 === 0) process.stderr.write(`  … ${fait}/${tuiles.length}\r`)
  }
  return out
}

// ──────────────────────────────────────────────────────────────────── main
async function main() {
  const idx = await indexVivant()
  console.log('── INDEX VIVANT (relu, jamais figé) ──')
  console.log('  clé      :', idx.key)
  console.log('  publié   :', idx.modifie)
  console.log('  poids    :', (idx.taille / 1e6).toFixed(2), 'Mo')

  if (flag('--poids-total')) {
    console.log('\n── ÉNUMÉRATION COMPLÈTE DU BUCKET ──')
    const { objets, pages } = await listeS3({
      prefix: 'BlueTopo/',
      onPage: (p) => process.stderr.write(`  page ${p.pages} — ${p.objets} objets\r`),
    })
    const tif = objets.filter((o) => /\.tiff?$/i.test(o.key))
    const aux = objets.filter((o) => /\.aux\.xml$/i.test(o.key))
    const somme = (a) => a.reduce((s, o) => s + o.taille, 0)
    console.log(`\n  pages S3            : ${pages}`)
    console.log(`  objets              : ${objets.length}`)
    console.log(`  GeoTIFF             : ${tif.length}`)
    console.log(`  poids GeoTIFF       : ${(somme(tif) / 1e9).toFixed(2)} Go`)
    console.log(`  poids .aux.xml      : ${(somme(aux) / 1e6).toFixed(1)} Mo`)
    console.log(`  plus gros GeoTIFF   : ${(Math.max(...tif.map((o) => o.taille)) / 1e6).toFixed(0)} Mo`)
    console.log(`  médiane GeoTIFF     : ${(tif.map((o) => o.taille).sort((a, b) => a - b)[tif.length >> 1] / 1e6).toFixed(1)} Mo`)
    const dossier = opt('--out', 'data/bluetopo')
    fs.mkdirSync(dossier, { recursive: true })
    fs.writeFileSync(path.join(dossier, 'bucket.json'), JSON.stringify(objets, null, 0))
    console.log(`  → ${path.join(dossier, 'bucket.json')}`)
  }

  if (flag('--index-only')) return

  const dossier = opt('--out', 'data/bluetopo')
  const dest = path.join(dossier, path.basename(idx.key))
  if (!fs.existsSync(dest)) {
    process.stderr.write('  téléchargement de l’index…\n')
    await telecharge(idx.url, dest)
  }
  console.log('  local    :', dest)

  const bboxTxt = opt('--bbox')
  const bbox = bboxTxt ? bboxTxt.split(',').map(Number) : null
  const { couche, colonnes, dalles } = await litSchema(dest, bbox)
  console.log('\n── SCHÉMA DE DALLAGE ──')
  console.log('  couche   :', couche)
  console.log('  colonnes :', colonnes.join(', '))
  console.log('  dalles   :', dalles.length, bbox ? `(dans ${bboxTxt})` : '(tout le schéma)')
  const parRes = {}
  for (const d of dalles) parRes[d.resolution] = (parRes[d.resolution] ?? 0) + 1
  console.log('  par résolution (m) :', JSON.stringify(parRes))

  if (!bbox) return
  console.log('\n── CE QUI EST RÉELLEMENT PUBLIÉ ──')
  const avecUrl = dalles.filter((d) => d.url)
  console.log(
    `  ${avecUrl.length} / ${dalles.length} dalles ont un GeoTIFF (${dalles.length - avecUrl.length} trous)`,
  )
  // Le poids exact vient du bucket (l'index ne le porte pas) — une requête de
  // listage par dossier, seulement pour les dalles qu'on garde vraiment.
  const pub = await tiffsPublies(avecUrl.map((d) => d.tile))
  const poids = [...pub.values()].reduce((s, o) => s + o.taille, 0)
  console.log(`  poids : ${(poids / 1e6).toFixed(0)} Mo`)
  const manifeste = dalles
    .filter((d) => pub.has(d.tile))
    .map((d) => ({ ...d, ...pub.get(d.tile) }))
  fs.mkdirSync(dossier, { recursive: true })
  const f = path.join(dossier, 'manifeste.json')
  fs.writeFileSync(f, JSON.stringify({ index: idx, bbox, dalles: manifeste }, null, 2))
  console.log('  →', f)

  if (flag('--telecharge')) {
    let n = 0
    for (const d of manifeste) {
      const dst = path.join(dossier, 'tiff', path.basename(d.key))
      if (fs.existsSync(dst) && fs.statSync(dst).size === d.taille) {
        n++
        continue
      }
      process.stderr.write(`  ${++n}/${manifeste.length} ${path.basename(d.key)} (${(d.taille / 1e6).toFixed(0)} Mo)…\n`)
      await telecharge(d.url, dst)
    }
    console.log(`  ${n} GeoTIFF sur disque dans ${path.join(dossier, 'tiff')}`)
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
