// DIAG GRA — L'ÉCART D'IMAGE ENTRE DEUX CHEMINS, EN PIXELS, PLEINE RÉSOLUTION
//
// ⚠️ **PLEINE RÉSOLUTION ET PAS DE CONDENSÉ** — le piège que le brief nomme :
// « un condensé annule les motifs fins ». On compte les pixels dont AU MOINS un
// canal diffère de plus de `SEUIL` niveaux sur 255, sur les 1 280 × 800 = 1 024 000
// pixels de la capture.
//
// ⚠️ **LE TÉMOIN NUL EST OBLIGATOIRE** : une image comparée à elle-même doit
// rendre 0 pixel. Sans lui, un banc différentiel ne distingue pas « rien n'a
// changé » de « les deux lectures sont cassées pareil » (R31 §⑤②).
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEUIL = 2 // niveaux sur 255 — le seuil du brief

// ── un décodeur PNG minimal (RGBA 8 bits, non entrelacé) — pas de dépendance
function lirePng(fichier) {
  const buf = fs.readFileSync(fichier)
  let i = 8, w = 0, h = 0, profondeur = 0, type = 0
  const morceaux = []
  while (i < buf.length) {
    const len = buf.readUInt32BE(i)
    const nom = buf.toString('ascii', i + 4, i + 8)
    const data = buf.subarray(i + 8, i + 8 + len)
    if (nom === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4)
      profondeur = data[8]; type = data[9]
      if (profondeur !== 8 || (type !== 6 && type !== 2)) throw new Error(`PNG non gere : profondeur ${profondeur}, type ${type}`)
    } else if (nom === 'IDAT') morceaux.push(data)
    else if (nom === 'IEND') break
    i += 12 + len
  }
  const canaux = type === 6 ? 4 : 3
  const brut = zlib.inflateSync(Buffer.concat(morceaux))
  const ligne = w * canaux
  const px = Buffer.alloc(h * ligne)
  let p = 0
  for (let y = 0; y < h; y++) {
    const filtre = brut[p++]
    const src = brut.subarray(p, p + ligne); p += ligne
    const dst = px.subarray(y * ligne, (y + 1) * ligne)
    const prec = y > 0 ? px.subarray((y - 1) * ligne, y * ligne) : null
    for (let x = 0; x < ligne; x++) {
      const a = x >= canaux ? dst[x - canaux] : 0
      const b = prec ? prec[x] : 0
      const c = prec && x >= canaux ? prec[x - canaux] : 0
      let v = src[x]
      if (filtre === 1) v += a
      else if (filtre === 2) v += b
      else if (filtre === 3) v += (a + b) >> 1
      else if (filtre === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      }
      dst[x] = v & 0xff
    }
  }
  return { w, h, canaux, px }
}

function ecart(a, b) {
  if (a.w !== b.w || a.h !== b.h || a.canaux !== b.canaux) throw new Error('tailles differentes')
  let n = 0, sommeEcart = 0, pire = 0
  const total = a.w * a.h
  for (let i = 0; i < total; i++) {
    const o = i * a.canaux
    let d = 0
    for (let c = 0; c < 3; c++) { const e = Math.abs(a.px[o + c] - b.px[o + c]); if (e > d) d = e }
    if (d > SEUIL) { n++; sommeEcart += d }
    if (d > pire) pire = d
  }
  return { pixels: n, part: n / total, ecartMoyenSurBouges: n ? sommeEcart / n : 0, pire, total }
}

const LIEUX = ['reunion', 'everest', 'paysbas']
const rapport = { quand: new Date().toISOString(), seuil: SEUIL, lignes: [] }
for (const etiquette of ['avant', 'apres']) {
  const dir = path.join(RACINE, '.banc/GRA', etiquette)
  for (const lieu of LIEUX) {
    const ref = path.join(dir, `${lieu}-depuis-z13.png`)
    if (!fs.existsSync(ref)) { console.log(`(manquant : ${ref})`); continue }
    const A = lirePng(ref)
    // ⛔ LE TÉMOIN NUL, D'ABORD
    const nul = ecart(A, lirePng(ref))
    for (const depart of [11, 9]) {
      const f = path.join(dir, `${lieu}-depuis-z${depart}.png`)
      if (!fs.existsSync(f)) continue
      const e = ecart(A, lirePng(f))
      rapport.lignes.push({ etiquette, lieu, paire: `z13 vs depuis-z${depart}`, temoinNul: nul.pixels, ...e })
      console.log(`[${etiquette}] ${lieu.padEnd(8)} z13 vs depuis-z${depart} : temoin nul ${nul.pixels} px · `
        + `${e.pixels} px (${(e.part * 100).toFixed(2)} %) au-dela de ${SEUIL}/255 · ecart moyen ${e.ecartMoyenSurBouges.toFixed(1)} · pire ${e.pire}`)
    }
  }
}
// et le z13 avant/apres — la référence d'Adrien
for (const lieu of LIEUX) {
  const a = path.join(RACINE, '.banc/GRA/avant', `${lieu}-depuis-z13.png`)
  const b = path.join(RACINE, '.banc/GRA/apres', `${lieu}-depuis-z13.png`)
  if (!fs.existsSync(a) || !fs.existsSync(b)) continue
  const e = ecart(lirePng(a), lirePng(b))
  rapport.lignes.push({ etiquette: 'z13-avant-vs-apres', lieu, paire: 'avant vs apres', temoinNul: 0, ...e })
  console.log(`[z13 AVANT vs APRES] ${lieu.padEnd(8)} : ${e.pixels} px (${(e.part * 100).toFixed(2)} %) · ecart moyen ${e.ecartMoyenSurBouges.toFixed(1)} · pire ${e.pire}`)
}
fs.mkdirSync(path.join(RACINE, '.banc/GRA'), { recursive: true })
fs.writeFileSync(path.join(RACINE, '.banc/GRA/pixels.json'), JSON.stringify(rapport, null, 1))
console.log('\necrit : .banc/GRA/pixels.json')
