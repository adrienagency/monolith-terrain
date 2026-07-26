// Vendorise les tracés des DÉPARTEMENTS (101) et des RÉGIONS (18) françaises
// dans public/geo/fr/ : un fichier par entité, plus un index léger.
//
// SOURCE ET LICENCE (vérifiées le 2026-07-26)
//   france-geojson, Grégoire David — github.com/gregoiredavid/france-geojson
//   Conversion des tracés IGN Admin Express COG (édition 2018), noms et codes
//   INSEE (COG 2018). Le README du dépôt renvoie aux conditions d'utilisation
//   d'Admin Express, c'est-à-dire la LICENCE OUVERTE / OPEN LICENCE (Etalab).
//   Les tracés sont simplifiés (Visvalingam pondéré 25 %, 5 décimales ≈ 1,1 m),
//   ce qui est très largement suffisant pour une découpe de bloc.
//
// POURQUOI VENDORISER PLUTÔT QUE REQUÊTER
// geo.api.gouv.fr NE REND PLUS de `contour` pour les départements ni les
// régions (le champ est ignoré en silence). Il n'existe donc pas d'API vivante
// pour ces deux niveaux — le tracé doit être embarqué.
//
// POURQUOI UN FICHIER PAR ENTITÉ
// Les fichiers nationaux pèsent 3,7 Mo (départements) et 1,7 Mo (régions).
// Découper la Haute-Savoie coûte 25 Ko ; charger le fichier national pour ça
// reviendrait à télécharger la France entière. L'index (~12 Ko) est le SEUL
// fichier lu au démarrage, il suffit à la recherche.
//
// POURQUOI LES VARIANTES « avec-outre-mer »
// regions.geojson ne contient que les 13 régions métropolitaines et
// departements.geojson que les 96 départements de métropole. Sans le suffixe,
// chercher « La Réunion » ou « Guadeloupe » ne rendait aucun tracé.
//
// Lancer : npm run build:geofr
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { normalizeFR } from '../src/geo-fr.js'

const CDN = 'https://cdn.jsdelivr.net/gh/gregoiredavid/france-geojson@master'
const SOURCES = [
  { fichier: 'departements-avec-outre-mer.geojson', niveau: 'departement', prefixe: 'dept', attendu: 101 },
  { fichier: 'regions-avec-outre-mer.geojson', niveau: 'region', prefixe: 'region', attendu: 18 },
]
const OUT = new URL('../public/geo/fr/', import.meta.url)

// Centre de l'emprise de TOUS les anneaux extérieurs. Un centroïde de surface
// serait plus juste, mais ce centre ne sert qu'à poser la caméra avant que le
// tracé n'arrive : frameRegion recadre proprement juste après.
function centre(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let lo0 = Infinity, lo1 = -Infinity, la0 = Infinity, la1 = -Infinity
  for (const rings of polys) {
    for (const [lon, lat] of rings[0]) {
      if (lon < lo0) lo0 = lon
      if (lon > lo1) lo1 = lon
      if (lat < la0) la0 = lat
      if (lat > la1) la1 = lat
    }
  }
  const r = (n) => Math.round(n * 1e4) / 1e4
  return [r((lo0 + lo1) / 2), r((la0 + la1) / 2)]
}

async function main() {
  await mkdir(OUT, { recursive: true })
  // on repart d'un dossier propre : un redécoupage qui supprimerait une entité
  // ne doit pas laisser traîner son ancien fichier
  for (const f of await readdir(OUT).catch(() => [])) {
    if (f.endsWith('.json')) await rm(new URL(f, OUT))
  }

  const entites = []
  for (const src of SOURCES) {
    const url = `${CDN}/${src.fichier}`
    process.stdout.write(`${url} … `)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
    const fc = await res.json()
    console.log(`${fc.features.length} entités`)
    if (fc.features.length !== src.attendu) {
      // garde-fou : si le dépôt amont change de découpage, on veut le savoir
      // au build et pas six mois plus tard sur une recherche qui ne rend rien
      throw new Error(`${src.fichier} : ${fc.features.length} entités, ${src.attendu} attendues`)
    }

    for (const f of fc.features) {
      const { code, nom } = f.properties
      if (!code || !nom) throw new Error(`entité sans code ni nom dans ${src.fichier}`)
      const nomFichier = `${src.prefixe}-${code}.json`
      await writeFile(
        new URL(nomFichier, OUT),
        JSON.stringify({ code, nom, niveau: src.niveau, geometry: f.geometry })
      )
      entites.push({ nom, norm: normalizeFR(nom), code, niveau: src.niveau, centre: centre(f.geometry) })
    }
  }

  // l'index, trié pour que le diff git reste lisible d'une génération à l'autre
  entites.sort((a, b) => a.niveau.localeCompare(b.niveau) || a.code.localeCompare(b.code))
  await writeFile(
    new URL('index.json', OUT),
    JSON.stringify(
      {
        version: 1,
        source: 'france-geojson (Grégoire David) — tracés IGN Admin Express COG, codes/noms INSEE',
        licence: 'Licence Ouverte / Open Licence 2.0 (Etalab)',
        genere: new Date().toISOString().slice(0, 10),
        entites,
      },
      null,
      0
    )
  )

  const dir = fileURLToPath(OUT)
  console.log(`\n${entites.length} entités écrites dans ${dir}`)
  console.log(`index.json : ${entites.filter((e) => e.niveau === 'region').length} régions, ${entites.filter((e) => e.niveau === 'departement').length} départements`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
