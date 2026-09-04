// LISS — DÉCODEUR PNG MINIMAL, EN NODE, SANS NAVIGATEUR.
//
// ⚠️ POURQUOI PAS `createImageBitmap` : le brief le dit et B6 l'a payé — « un
// décodeur d'image CORRIGE une donnée numérique ». Un canevas applique un profil
// colorimétrique, un `colorSpaceConversion` mal posé, un premultiply alpha… et
// l'octet lu n'est plus l'octet écrit. Ici on inflate le flux IDAT et on
// défiltre à la main : l'octet rendu est l'octet du fichier, par construction.
//
// ⚠️ ET ÇA SUPPRIME LE NAVIGATEUR DE LA MESURE. Les bancs de B6 lançaient un
// Chrome sans tête et un serveur Vite pour lire un PNG de 8 Ko. Ici : `fs.read`.
//
// Le tuileur (`scripts/build-bathy-tiles.mjs`) écrit du PNG 8 bits non
// entrelacé. On refuse tout le reste au lieu de rendre des chiffres faux.
import fs from 'node:fs'
import zlib from 'node:zlib'

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** @returns {{w:number,h:number,canaux:number,px:Uint8Array}} px = w*h*canaux octets */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('pas un PNG')
  let o = 8
  let w = 0, h = 0, prof = 0, type = 0, entrelace = 0
  const idat = []
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o)
    const tag = buf.toString('latin1', o + 4, o + 8)
    const corps = buf.subarray(o + 8, o + 8 + len)
    if (tag === 'IHDR') {
      w = corps.readUInt32BE(0); h = corps.readUInt32BE(4)
      prof = corps[8]; type = corps[9]; entrelace = corps[12]
    } else if (tag === 'IDAT') idat.push(corps)
    else if (tag === 'IEND') break
    o += 12 + len
  }
  if (prof !== 8) throw new Error(`profondeur ${prof} non gérée`)
  if (entrelace !== 0) throw new Error('entrelacé non géré')
  const canaux = { 0: 1, 2: 3, 4: 2, 6: 4 }[type]
  if (!canaux) throw new Error(`type couleur ${type} non géré (palette ?)`)
  const brut = zlib.inflateSync(Buffer.concat(idat))
  const ligne = w * canaux
  const px = new Uint8Array(w * h * canaux)
  let prev = new Uint8Array(ligne)
  for (let y = 0; y < h; y++) {
    const f = brut[y * (ligne + 1)]
    const src = brut.subarray(y * (ligne + 1) + 1, y * (ligne + 1) + 1 + ligne)
    const cur = px.subarray(y * ligne, y * ligne + ligne)
    for (let i = 0; i < ligne; i++) {
      const a = i >= canaux ? cur[i - canaux] : 0
      const b = prev[i]
      const c = i >= canaux ? prev[i - canaux] : 0
      let v = src[i]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[i] = v & 255
    }
    prev = cur
  }
  return { w, h, canaux, px }
}

/** Tuile bathy → mètres. Encodage terrarium : R*256 + G + B/256 − 32768. */
export function tuileMetres(chemin) {
  const { w, h, canaux, px } = decodePng(fs.readFileSync(chemin))
  const m = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * canaux
    // alpha 0 = case non peinte (voir decodeTerrarium) — n'arrive pas sur un
    // fichier du tuileur, mais on ne veut pas d'un −32768 silencieux.
    if (canaux === 4 && px[o + 3] === 0) { m[i] = NaN; continue }
    m[i] = px[o] * 256 + px[o + 1] + px[o + 2] / 256 - 32768
  }
  return { w, h, m }
}
