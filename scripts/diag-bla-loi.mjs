// DIAG BLA — LE JUGE DÉTERMINISTE : la couleur d'UN POINT DU SOL, rejouée
// depuis les uniformes vivants, à trois zooms, avant et après.
//
// ⛔ **LA MOYENNE D'ÉCRAN NE SAIT PAS RÉPONDRE** (rapport-RAMP §②, rapport-GRA
// §①⓹) : un cran change le CADRAGE, donc le sol qu'on moyenne. Ici on rejoue la
// LOI du nuanceur (`natHNormRef` → `natVoile` → `natBrume`, et `natHumiditeY`)
// sur les uniformes RELEVÉS dans l'application (`.banc/BLA/<etiquette>/
// extinction.json`), pour une altitude et une distance au centre FIXES, en
// mètres. Le critère du brief : ≤ 8/255 en luminance, ≤ 4/255 en chroma entre
// z9 et z13, pour le même point.
//
// Usage : node scripts/diag-bla-loi.mjs [--avant avant] [--apres apres]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hNormRef, voile, brume, humiditeY, luminance } from '../src/monde/naturel-crop.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const lire = (et) => JSON.parse(fs.readFileSync(path.join(RACINE, '.banc/BLA', et, 'extinction.json'), 'utf8'))

// la couleur de base : le quatrième arrêt de la rampe d'ouverture (#c99f66, tan)
// — la couleur d'une altitude est celle de GRA/RAMP, ce juge ne la rejoue pas :
// il rejoue ce que le VOILE lui fait.
const BASE = [0xc9 / 255, 0x9f / 255, 0x66 / 255]
const HAZE_COLOR = [0xb9 / 255, 0xc6 / 255, 0xd6 / 255]
const ALTITUDES = [600, 800, 1000, 1200, 1400]
const DISTANCES = [0, 2000, 5000]
const cl = (v) => Math.min(Math.max(v, 0), 1)

function couleurVoilee(cran, hM, dM) {
  const G = cran.etat.globe
  const amp = G.landMax - G.reliefBas
  const hNorm = cl((hM - G.reliefBas) / amp)
  // AVANT le correctif, les uniformes n'existent pas : identité, et la distance
  // en demi-côtés de crop (le dépôt d'alors)
  const a = G.hNormRefA ?? 1
  const b = G.hNormRefB ?? 0
  const demiM = G.cropDemiM ?? cran.etat.dem.extentMeters / 2
  const facteur = G.fdFacteur ?? 1
  const fd = cl((dM / demiM) * facteur)
  const veil = voile({ hNorm: hNormRef(hNorm, a, b), fd, hazeAmt: G.hazeAmt, hazeAlt: G.hazeAlt, hazeDist: G.hazeDist })
  const lum = luminance(BASE)
  const rgb = BASE.map((c, i) => brume({ col: c, lum, veil, couleur: HAZE_COLOR[i], hazeAmt: G.hazeAmt }))
  const wetY = humiditeY({ canalB: 0.8, canalA: 0.5, hNorm: hNormRef(hNorm, a, b), wetK: G.wetK, expoK: 0, hemi: 1, treeLine: G.treeLine })
  return { veil, rgb, lum255: luminance(rgb) * 255, chroma255: (Math.max(...rgb) - Math.min(...rgb)) * 255, wetY }
}

function juger(rapport) {
  const crans = rapport.crans
  const lignes = []
  let pireLum = 0, pireChroma = 0, pireWet = 0
  for (const hM of ALTITUDES) {
    for (const dM of DISTANCES) {
      const cs = crans.map((c) => ({ z: c.zoom, ...couleurVoilee(c, hM, dM) }))
      const lums = cs.map((c) => c.lum255), chromas = cs.map((c) => c.chroma255), wets = cs.map((c) => c.wetY)
      const dl = Math.max(...lums) - Math.min(...lums)
      const dc = Math.max(...chromas) - Math.min(...chromas)
      const dw = Math.max(...wets) - Math.min(...wets)
      pireLum = Math.max(pireLum, dl); pireChroma = Math.max(pireChroma, dc); pireWet = Math.max(pireWet, dw)
      lignes.push({ hM, dM, parCran: cs.map((c) => ({ z: c.z, veil: +c.veil.toFixed(3), lum: +c.lum255.toFixed(1), chroma: +c.chroma255.toFixed(1), wetY: +c.wetY.toFixed(3) })), etendueLum: +dl.toFixed(1), etendueChroma: +dc.toFixed(1), etendueWetY: +dw.toFixed(3) })
    }
  }
  return { lignes, pireLum, pireChroma, pireWet }
}

const sortie = {}
for (const et of [opt('--avant', 'avant'), opt('--apres', 'apres')]) {
  const r = lire(et)
  const j = juger(r)
  sortie[et] = j
  console.log(`\n═══ ${et} — étendue z${r.crans[0].zoom} → z${r.crans.at(-1).zoom} du MÊME point du sol ═══`)
  console.log('  alt (m)  dist (m)   voile par cran            lum/255 par cran        chroma/255 par cran     Δlum   Δchroma  ΔwetY')
  for (const l of j.lignes) {
    console.log(`  ${String(l.hM).padStart(5)}    ${String(l.dM).padStart(5)}    ${l.parCran.map((c) => c.veil.toFixed(3)).join(' / ').padEnd(24)}  ${l.parCran.map((c) => c.lum.toFixed(1)).join(' / ').padEnd(22)}  ${l.parCran.map((c) => c.chroma.toFixed(1)).join(' / ').padEnd(22)}  ${String(l.etendueLum).padStart(5)}  ${String(l.etendueChroma).padStart(7)}  ${l.etendueWetY.toFixed(3)}`)
  }
  console.log(`  ➡️ PIRE ÉTENDUE : luminance ${j.pireLum.toFixed(1)}/255 · chroma ${j.pireChroma.toFixed(1)}/255 · wetY ${j.pireWet.toFixed(3)}   (critère : ≤ 8 · ≤ 4)`)
}
fs.writeFileSync(path.join(RACINE, '.banc/BLA/loi.json'), JSON.stringify(sortie, null, 1))
console.log('\nécrit : .banc/BLA/loi.json')
