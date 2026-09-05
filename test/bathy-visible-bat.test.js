// LA BATHYMÉTRIE VISIBLE — Tâche BAT (2026-09-05).
//
// > **Adrien, mot pour mot :** *« J'ai l'impression que la bathymétrie a encore
// > totalement sauté, j'ai des dalles de flou complètes dans la mer ? Ici
// > Minorque, mais c'est partout. »*
//
// Trois gardes, pour les trois maillons que cette phrase met en cause :
//
//   ① **LA DONNÉE EST PEINTE** : une tuile bathy PRÉSENTE sur le serveur finit
//      dans le champ de hauteurs (`peindreBathyTuile`, puis `fuseBathymetry`).
//      C'est ce que le chantier a d'abord soupçonné — et c'était intact :
//      mesuré sur Minorque, 80 à 95 % de texels négatifs dans les tuiles de mer,
//      sur `t.heights` ET sur la texture GPU (`scripts/banc-bat.mjs`).
//   ② **LE FOND SE LIT À TRAVERS LA NAPPE** : le nuanceur de la mer du crop
//      (`MER_FRAG`, branche `uMerVraieEau`) garde le lobe large de Blinn-Phong
//      `pow(N·H, uMerBrillance)` À CÔTÉ du Beckmann de Cox & Munk. La fusion
//      EAU l'avait retiré : le gradient d'écran par blocs de 8 px tombait de
//      6,4 à 1,8 sur la mer de Minorque, et de RIEN d'autre (chaque changement
//      d'EAU testé seul, A/B dans la même page, témoin 1,79 → 1,79). Sans ce
//      terme il ne reste que la teinte de profondeur, une bathy z8 agrandie
//      seize fois : « des dalles de flou complètes ».
//   ③ **LE POURQUOI, CHIFFRÉ** : sur une pente de vague de côte (N·H = 0,98),
//      le Beckmann normalisé rend plusieurs fois moins que le lobe de
//      Blinn-Phong. Ce test le calcule avec les DEUX lois du dépôt — si un jour
//      le Beckmann rattrape le lobe, ce test dira que ② peut être revu.
//
// ⚠️ MORSURE PROUVÉE PAR MUTATION (rapport-BAT.md) : la ligne restaurée
// retirée ⇒ ② rouge ; `peindreBathyTuile` rendant −1 ⇒ ① rouge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { encodeTerrarium, fuseBathymetry } from '../src/bathy.js'
import { schlickEau, glitterSoleil, varianceCoxMunk } from '../src/monde/eau-lumiere.js'

// ---------------------------------------------------------------- bouchons DOM
// Les mêmes qu'en test/dem-load.test.js : un canevas dont `drawImage`
// échantillonne réellement la sous-fenêtre source.
class FakeCtx {
  constructor(size) { this.size = size; this.rgba = new Uint8ClampedArray(size * size * 4) }
  drawImage(img, ...a) {
    const long = a.length >= 8
    const [sx, sy, sw, sh] = long ? a.slice(0, 4) : [0, 0, img.width, img.height]
    const [dx, dy, dw, dh] = long ? a.slice(4) : [a[0], a[1], img.width, img.height]
    for (let y = dy; y < dy + dh; y++) for (let x = dx; x < dx + dw; x++) {
      if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue
      const rgb = img.at(sx + ((x - dx) / dw) * sw, sy + ((y - dy) / dh) * sh)
      const i = (y * this.size + x) * 4
      this.rgba[i] = rgb[0]; this.rgba[i + 1] = rgb[1]; this.rgba[i + 2] = rgb[2]; this.rgba[i + 3] = 255
    }
  }
  getImageData() { return { data: this.rgba } }
}
globalThis.document = {
  createElement() { const c = { width: 0, height: 0 }; c.getContext = () => (c._ctx ??= new FakeCtx(c.width)); return c },
}
globalThis.createImageBitmap = async (blob) => blob

// Le faux serveur : PAS d'index (⇒ z8 partout, le comportement d'avant les
// zones), UNE tuile bathy z8 à −1 000 m, et rien d'autre.
const PROF = -1000
const servies = []
globalThis.fetch = async (url) => {
  servies.push(url)
  if (url === 'data/bathy/index.json') return { ok: false, status: 404 }
  if (url === 'data/bathy/8/131/98.png') {
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, at: () => encodeTerrarium(PROF) }) }
  }
  return { ok: false, status: 404 }
}

const { peindreBathyTuile, indexBathy } = await import('../src/dem.js')

// ---------------------------------------------------------------- ① la donnée

test('① une tuile bathy PRÉSENTE est peinte dans le champ, puis fusionnée sous la mer', async () => {
  const index = await indexBathy()
  const px = 256
  const sea = new Float32Array(px * px).fill(NaN)
  const zt = await peindreBathyTuile({ zoom: 8, tx: 131, ty: 98, index, dst: sea, dstStride: px, dx: 0, dy: 0, dw: px, dh: px })
  assert.equal(zt, 8, 'la tuile z8 servie est celle qui est peinte')
  assert.ok(servies.includes('data/bathy/8/131/98.png'), 'la tuile a été demandée au serveur')
  let peints = 0
  for (let i = 0; i < sea.length; i++) if (Number.isFinite(sea[i]) && Math.abs(sea[i] - PROF) < 1) peints++
  assert.equal(peints, px * px, 'tous les texels portent la profondeur de la tuile')
  // le terrarium muet (0 m partout) : la fusion doit rendre la mer, pas le zéro
  const terre = new Float32Array(px * px)
  const fondu = fuseBathymetry(terre, sea)
  let sousLaMer = 0
  for (let i = 0; i < fondu.length; i++) if (fondu[i] < -500) sousLaMer++
  assert.ok(sousLaMer > 0.9 * px * px, `la fusion peint la mer sous le terrarium muet : ${sousLaMer}/${px * px}`)
})

test('① la tuile ABSENTE ne peint rien, et ne fabrique pas de fond', async () => {
  const index = await indexBathy()
  const px = 256
  const sea = new Float32Array(px * px).fill(NaN)
  const zt = await peindreBathyTuile({ zoom: 8, tx: 5, ty: 5, index, dst: sea, dstStride: px, dx: 0, dy: 0, dw: px, dh: px })
  assert.equal(zt, -1)
  assert.ok(sea.every((v) => Number.isNaN(v)))
})

// ---------------------------------------------------------------- ② le nuanceur

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const sansComm = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
const GLOBE_NU = sansComm(GLOBE_SRC)
const LOBE = /col \+= uSunColor \* pow\(max\(dot\(N, H\), 0\.0\), uMerBrillance\) \* \(0\.5 \+ 1\.6 \* fres\) \* uMerSoleilFx \* vRichesse;/

/** Le corps de la branche `if (vraieEau) {` qui suit `vec3 H = normalize(L + V);`. */
function brancheVraieEau(src) {
  const h = src.indexOf('vec3 H = normalize(L + V);')
  assert.ok(h > 0, 'le demi-vecteur H est calculé dans MER_FRAG')
  const debut = src.indexOf('if (vraieEau) {', h)
  assert.ok(debut > 0, 'la branche uMerVraieEau suit H')
  let prof = 0, i = src.indexOf('{', debut)
  for (; i < src.length; i++) {
    if (src[i] === '{') prof++
    else if (src[i] === '}' && --prof === 0) break
  }
  return src.slice(debut, i)
}

test('② la branche « vraie eau » de MER_FRAG garde le lobe de Blinn-Phong à côté du Beckmann', () => {
  const branche = brancheVraieEau(GLOBE_NU)
  assert.match(branche, /glitterSoleil\(/, 'le Beckmann de Cox & Munk y est (EAU)')
  assert.match(branche, LOBE, 'le lobe large qui fait lire le fond y est aussi (BAT)')
  // et il n'a pas remplacé le Beckmann : les deux s'AJOUTENT, dans cet ordre
  assert.ok(branche.indexOf('glitterSoleil(') < branche.search(LOBE), 'le Beckmann d abord, le lobe ensuite')
  // la branche d'avant (uMerVraieEau = 0) garde la sienne : deux occurrences en tout
  assert.equal((GLOBE_NU.match(new RegExp(LOBE.source, 'g')) || []).length, 2)
})

// ---------------------------------------------------------------- ③ le pourquoi

test('③ au pic du reflet, le Beckmann normalisé rend quatre à treize fois moins que le lobe', () => {
  // Le lobe pow(N·H, 110) et le Beckmann de Cox & Munk à 10 m/s (uMerVentMs
  // relevé sur Minorque) ont à peu près la même LARGEUR (~6°) ; ce qui les
  // sépare est la HAUTEUR du pic : le Beckmann porte F(V·H) ≈ 0,02 et le
  // diviseur 4 N·V, le lobe porte (0,5 + 1,6 fres). Table calculée le
  // 2026-09-05 (rapport-BAT.md) : rapport 8,4 / 10,4 / 13,4 au pic pour
  // N·V = 0,4 / 0,6 / 0,8, encore 3,9 à 6,2 à N·H = 0,99, et parité vers 0,97.
  // uMerBrillance = 110 relevé, fres = loi d'avant (celle que le lobe lit).
  const brillance = 110, vDotH = 0.8
  for (const nDotV of [0.4, 0.6, 0.8]) {
    const fres = Math.min(Math.pow(1 - nDotV, 5), 0.5)
    for (const nDotH of [1, 0.99]) {
      const beckmann = glitterSoleil(nDotH, vDotH, nDotV, varianceCoxMunk(10))
      const lobe = Math.pow(nDotH, brillance) * (0.5 + 1.6 * fres)
      assert.ok(lobe > 3.5 * beckmann, `N·V ${nDotV} N·H ${nDotH} : lobe ${lobe.toFixed(3)} contre Beckmann ${beckmann.toFixed(3)}`)
    }
  }
  // et le Fresnel de Schlick n'y change rien : à N·V = 0,6 il vaut ~0,03
  assert.ok(schlickEau(0.6) < 0.05)
})
