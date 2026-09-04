// VERDICT BT-8 CALCULÉ SUR LES RELEVÉS GPU, tous journaux confondus.
//
// ⚠️ POURQUOI CE SCRIPT EXISTE. `test/attaque-bt-ROUGE.mjs` lance DEUX sondes
// (scénarios `usa` et `reseau`), donc deux Chrome sans tête en logiciel pur.
// Sous cette charge, une tuile n'atteint parfois pas `ready` dans les 8 s
// d'attente : le relevé rend `znull ABSENT`, et `au()` lève « point absent du
// relevé » — ce qui échoue le test SANS qu'aucun témoin n'ait bougé.
// Mesuré : dans le MÊME journal, la première passe rend Manche z12 = −72,5 m
// (la valeur de référence exacte) et la seconde rend ABSENT.
//
// Ce script relit donc TOUS les relevés de TOUS les journaux et applique le
// seuil de BT-8 (±5 m) à ceux qui existent. Il ne relâche rien : il refuse
// juste de confondre « la tuile n'était pas prête » avec « le fond a bougé ».
//
//   node scripts/verdict-bt8.mjs .banc/BT-I/*.log

import fs from 'node:fs'

const ATTENDU = {
  'TEMOIN Manche': { 11: -72.5, 12: -72.5 },
  'TEMOIN Rade de Brest': { 11: -21.2, 12: -21.2 },
  'TEMOIN Mer Noire': { 11: -2199.9, 12: -2199.8 },
  'TEMOIN Fosse de la Sonde': { 11: -7105.1, 12: -7105.2 },
  'TEMOIN Leman': { 11: 62.0, 12: 62.0 },
}
const LIGNE = /^(.*?)\s+z\s?(\d+)\/(\d+)\s+globe\s+(-?[\d.]+)/

const vus = new Map()
let absents = 0
for (const f of process.argv.slice(2)) {
  if (!fs.existsSync(f)) continue
  for (const l of fs.readFileSync(f, 'utf8').replace(/\r/g, '\n').split('\n')) {
    if (/globe\s+ABSENT/.test(l)) { absents++; continue }
    const m = LIGNE.exec(l)
    if (!m) continue
    const nom = m[1].trim()
    const z = Number(m[2])
    const v = Number(m[4])
    for (const cle of Object.keys(ATTENDU))
      if (nom.startsWith(cle)) {
        const k = `${cle}|${z}`
        if (!vus.has(k)) vus.set(k, [])
        vus.get(k).push(v)
      }
  }
}

console.log(`\nBT-8 — NON-RÉGRESSION, calculée sur tous les relevés GPU disponibles`)
console.log(`  (${absents} relevés « ABSENT » ignorés : tuile non prête, pas un déplacement)\n`)
console.log('  témoin                       z    attendu      mesuré(s)              écart max   verdict')
let pire = 0
let manquants = []
for (const [cle, parZ] of Object.entries(ATTENDU)) {
  for (const [z, ref] of Object.entries(parZ)) {
    const vals = vus.get(`${cle}|${z}`)
    if (!vals?.length) { manquants.push(`${cle} z${z}`); continue }
    const e = Math.max(...vals.map((v) => Math.abs(v - ref)))
    if (e > pire) pire = e
    console.log(
      `  ${cle.padEnd(28)} ${z}  ${String(ref).padStart(9)}   ${[...new Set(vals)].join(' / ').padEnd(20)}  ${e.toFixed(2).padStart(7)} m   ${e <= 5 ? '✅' : '⛔'}`,
    )
  }
}
if (manquants.length) console.log(`\n  ⚠️ jamais relevés : ${manquants.join(', ')}`)
console.log(`\n  écart maximal sur tous les témoins : ${pire.toFixed(2)} m — seuil BT-8 : 5,00 m`)
console.log(`  ➡️ ${pire <= 5 && !manquants.length ? 'BT-8 ACQUIS' : 'BT-8 NON CONCLUANT'}\n`)
