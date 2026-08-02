// MESURE — le remplissage d'enveloppe convexe, composante par composante, sur
// les onze MNT cuits. Sert à VÉRIFIER le critère avant de s'en servir : le
// rapport de `tour-2km` annonce vrais lacs 0,65-0,91, dentelles 0,27-0,64,
// Rhône 0,11, et on ne pose pas un seuil sur un chiffre qu'on n'a pas refait.
//
// ⚠️ ENVELOPPE CONVEXE, PAS BOÎTE ENGLOBANTE. Le remplissage de boîte a déjà
// été mesuré et il ÉCHOUE (cf. lake.js) : une dentelle qui serpente en
// diagonale remplit très bien sa boîte. L'enveloppe convexe, elle, épouse la
// forme — c'est ce qui sépare une tache compacte d'un ruban qui serpente.
//
// Relance :  node scripts/mesure-enveloppe.mjs [nom-de-zone]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectLakes } from '../src/lake.js'
import { mesurePlanEau, longueurMinM, remplissageEnveloppe, LARGEUR_MIN_M } from '../src/plan-eau.js'
import { decodeRelief } from './cuire-fixtures-relief.mjs'

const DOSSIER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'relief')
const MANIFESTE = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'manifeste.json'), 'utf8'))

const LARGEUR_AVANT_M = 150 // l'ancien seuil : le monde où le critère devait trancher
const filtre = process.argv[2]
for (const z of MANIFESTE) {
  if (filtre && z.nom !== filtre) continue
  const data = decodeRelief(fs.readFileSync(path.join(DOSSIER, `${z.nom}.bin.gz`)), z.cote)
  const dem = { data, size: z.cote }
  const cellM = z.extentMeters / (dem.size - 1)
  const planche = longueurMinM(z.extentMeters)
  const lacs = detectLakes(dem)
  const marque = new Uint8Array(dem.size * dem.size)
  const lignes = []
  for (const lac of lacs) {
    const m = mesurePlanEau(lac, cellM, marque)
    // ⚠️ ON REJOUE LE MONDE D'AVANT — seuil de largeur à 150 m, l'ancienne
    // règle. C'est là que le critère d'enveloppe devait trancher : sur les
    // composantes que la largeur laissait encore passer. Le mesurer au seuil
    // d'aujourd'hui (250 m) ne rendrait plus que les vrais lacs, et le tableau
    // ne dirait plus rien.
    if (m.longueurM < planche || m.largeurM < LARGEUR_AVANT_M) continue
    lignes.push({
      elev: lac.elevM,
      cellules: m.aire,
      largeurM: Math.round(m.largeurM),
      longueurM: Math.round(m.longueurM),
      boite: +(m.aire / (m.w * m.h)).toFixed(3),
      enveloppe: +remplissageEnveloppe(lac).toFixed(3),
    })
  }
  lignes.sort((a, b) => a.enveloppe - b.enveloppe)
  console.log(`\n═══ ${z.nom} (${z.quoi}) — ${cellM.toFixed(1)} m/cellule, bloc ${(z.extentMeters / 1000).toFixed(1)} km`)
  if (!lignes.length) console.log('   (aucune étendue retenue)')
  for (const l of lignes)
    console.log(
      `   ${String(l.elev).padStart(5)} m | ${String(l.cellules).padStart(7)} cel | ` +
        `larg ${String(l.largeurM).padStart(5)} m | long ${String(l.longueurM).padStart(6)} m | ` +
        `boîte ${l.boite.toFixed(3)} | ENVELOPPE ${l.enveloppe.toFixed(3)}`
    )
}
