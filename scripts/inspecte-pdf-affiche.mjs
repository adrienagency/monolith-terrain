// OUVRIR LE FICHIER QU'ON VEND, ET LE REGARDER
//
// ⚠️ CE SCRIPT EXISTE PARCE QU'UN PDF DONT LES OCTETS SONT JUSTES PEUT NE RIEN
// MONTRER. Tout le reste de la chaîne se prouve en amont — les boîtes par
// pdf-affiche.js, le pavage pixel par pixel par export-pavage.test.js, le
// cartouche par compositeur-affiche.test.js — et aucune de ces preuves ne dit
// que le fichier livré s'ouvre, ni ce qu'on y voit. Celui-ci ouvre un vrai PDF
// de production, le lit comme un lecteur le lirait, et en ressort une vignette
// et deux détails au 1:1.
//
// Il ne PRODUIT rien : il inspecte ce que le navigateur a produit. Le fichier
// s'obtient en lançant un tirage dans l'application (le PDF est mis au coffre
// avant le paiement, voir src/coffre-affiche.js) puis en le sortant d'IndexedDB.
//
//   node scripts/inspecte-pdf-affiche.mjs <fichier.pdf> [préfixe-de-sortie]
//
// Ce qu'il vérifie, dans l'ordre de ce que ça coûterait :
//   1. le fichier s'OUVRE — en-tête, table des références, marqueur de fin ;
//   2. les trois BOÎTES, en millimètres, et le format fini qu'elles décrivent ;
//   3. l'ÉTIQUETAGE — intention de sortie, profil incorporé, XMP, /Trapped ;
//   4. les IMAGES — recopiées telles quelles (DCTDecode) et non recompressées ;
//   5. ce qu'on VOIT — vignette de l'affiche entière, cartouche et attribution
//      au 1:1, décodés depuis les octets du PDF et de nulle part ailleurs.

import { readFileSync, writeFileSync } from 'node:fs'
import { decode, encode } from 'jpeg-js'

const chemin = process.argv[2]
const sortie = process.argv[3]
if (!chemin) {
  console.error('usage : node scripts/inspecte-pdf-affiche.mjs <fichier.pdf> [préfixe-de-sortie]')
  process.exit(1)
}

const buf = readFileSync(chemin)
// latin1 : un PDF est un fichier BINAIRE dont la structure est en ASCII. Le lire
// en utf8 corromprait les flux d'images et décalerait tous les offsets.
const texte = buf.toString('latin1')

console.log(`fichier    ${chemin}`)
console.log(`poids      ${buf.length} o  (${(buf.length / 1e6).toFixed(3)} Mo)`)
console.log(`en-tête    ${texte.slice(0, 8)}`)
console.log(`fin        ${JSON.stringify(texte.slice(-24))}`)
console.log('')

// ── ② les boîtes ─────────────────────────────────────────────────────────────
const PT_MM = 25.4 / 72
const boite = (nom) => {
  const m = texte.match(new RegExp('/' + nom + '\\s*\\[([^\\]]*)\\]'))
  if (!m) return null
  const pt = m[1].trim().split(/\s+/).map(Number)
  return { pt, mm: pt.map((p) => +(p * PT_MM).toFixed(3)) }
}
for (const nom of ['MediaBox', 'BleedBox', 'TrimBox', 'ArtBox']) {
  const r = boite(nom)
  // ⚠️ L'ArtBox DOIT être absente : PDF/X interdit qu'une page porte à la fois
  // un TrimBox et un ArtBox.
  console.log(`${nom.padEnd(11)}${r ? JSON.stringify(r.mm) + ' mm' : 'absente'}`)
}
const t = boite('TrimBox')
const b = boite('BleedBox')
const md = boite('MediaBox')
if (t) console.log(`format fini  ${(t.mm[2] - t.mm[0]).toFixed(2)} × ${(t.mm[3] - t.mm[1]).toFixed(2)} mm`)
if (t && b) console.log(`fond perdu   ${(t.mm[0] - b.mm[0]).toFixed(2)} mm sur chaque bord`)
if (t && md) {
  const e = [t.mm[0] - md.mm[0], t.mm[1] - md.mm[1], md.mm[2] - t.mm[2], md.mm[3] - t.mm[3]]
  console.log(`centrage     écarts ${e.map((x) => x.toFixed(2)).join(' / ')} mm (les quatre doivent être égaux)`)
}

// ── ③ l'étiquetage ───────────────────────────────────────────────────────────
console.log('')
const marqueurs = [
  ['/OutputIntents', 'intention de sortie'],
  ['/GTS_PDFX', 'sous-type PDF/X'],
  ['/DestOutputProfile', 'profil incorporé'],
  ['GTS_PDFXVersion', 'version dans le XMP'],
  ['/Trapped /False', 'recouvrement déclaré'],
  ['/ID [', 'identité du document'],
  ['/Metadata', 'paquet XMP'],
]
for (const [cle, quoi] of marqueurs) {
  console.log(`${quoi.padEnd(24)} ${texte.includes(cle) ? 'présent' : '⚠️ ABSENT'}`)
}
console.log(`table de références      ${/\nxref\r?\n/.test(texte) ? 'classique (lisible dans un éditeur)' : '⚠️ en flux'}`)
console.log(`objets                   ${(texte.match(/\n\d+ 0 obj/g) || []).length}`)

// ── ④ les images ─────────────────────────────────────────────────────────────
const images = []
const re = /\/Subtype\s*\/Image[\s\S]{0,400}?stream\r?\n/g
let m
while ((m = re.exec(texte))) {
  const dict = texte.slice(texte.lastIndexOf('<<', m.index), m.index + m[0].length)
  images.push({
    largeur: +(dict.match(/\/Width\s+(\d+)/) || [])[1],
    hauteur: +(dict.match(/\/Height\s+(\d+)/) || [])[1],
    longueur: +(dict.match(/\/Length\s+(\d+)/) || [])[1],
    filtre: (dict.match(/\/Filter\s*\/(\w+)/) || [])[1],
    espace: (dict.match(/\/ColorSpace\s*\/(\w+)/) || [])[1],
    debut: m.index + m[0].length,
  })
}
console.log('')
for (const [i, im] of images.entries()) {
  console.log(`bande ${i} : ${im.largeur} × ${im.hauteur}  ${im.filtre}  ${im.espace}  ${(im.longueur / 1e6).toFixed(3)} Mo`)
}
const somme = images.reduce((s, i) => s + i.longueur, 0)
console.log(`somme des images ${(somme / 1e6).toFixed(3)} Mo — surcoût d'emballage ${buf.length - somme} o`)
// ⚠️ SI CE FILTRE N'EST PAS `DCTDecode`, LE JPEG A ÉTÉ DÉCODÉ PUIS RECOMPRESSÉ.
// C'est le défaut que le passage au JPEG existe pour éviter : un `FlateDecode`
// ici voudrait dire que les bandes sont arrivées en PNG.
if (images.some((i) => i.filtre !== 'DCTDecode')) {
  console.log('⚠️ au moins une bande n’est PAS un JPEG recopié tel quel — voir FORMAT_RECOMMANDE (src/pdf-affiche.js)')
}

if (!sortie || !images.length) process.exit(0)

// ── ⑤ ce qu'on voit ──────────────────────────────────────────────────────────
//
// Les bandes sont décodées DEPUIS LES OCTETS DU PDF : ce qui suit montre le
// contenu du fichier livré, pas celui d'un canevas qu'on aurait gardé à côté.
const bandes = images.map((im) => decode(buf.subarray(im.debut, im.debut + im.longueur), { useTArray: true }))
const W = bandes[0].width
const H = bandes.reduce((s, b2) => s + b2.height, 0)
console.log(`\nimage recomposée ${W} × ${H} px`)

const bandePour = (Y) => {
  let acc = 0
  for (const bd of bandes) {
    if (Y < acc + bd.height) return { bd, ly: Y - acc }
    acc += bd.height
  }
  return null
}

const reduire = (cibleW) => {
  const k = Math.max(1, Math.round(W / cibleW))
  const w = Math.floor(W / k), h = Math.floor(H / k)
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, bb = 0, n = 0
      for (let dy = 0; dy < k; dy++) {
        const p = bandePour(y * k + dy)
        if (!p) continue
        for (let dx = 0; dx < k; dx++) {
          const q = (p.ly * W + x * k + dx) * 4
          r += p.bd.data[q]; g += p.bd.data[q + 1]; bb += p.bd.data[q + 2]; n++
        }
      }
      const q = (y * w + x) * 4
      out[q] = r / n; out[q + 1] = g / n; out[q + 2] = bb / n; out[q + 3] = 255
    }
  }
  return { data: out, width: w, height: h }
}

const detail = (x0, y0, w, h, nom) => {
  w = Math.min(w, W - x0); h = Math.min(h, H - y0)
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const p = bandePour(y0 + y)
    if (!p) continue
    for (let x = 0; x < w; x++) {
      const s = (p.ly * W + x0 + x) * 4
      const q = (y * w + x) * 4
      out[q] = p.bd.data[s]; out[q + 1] = p.bd.data[s + 1]; out[q + 2] = p.bd.data[s + 2]; out[q + 3] = 255
    }
  }
  writeFileSync(nom, encode({ data: out, width: w, height: h }, 94).data)
  console.log(`détail ${w} × ${h} en (${x0}, ${y0}) → ${nom}`)
}

const v = reduire(760)
writeFileSync(`${sortie}-vignette.jpg`, encode(v, 92).data)
console.log(`vignette ${v.width} × ${v.height} → ${sortie}-vignette.jpg`)
// Le cartouche vit en bas à gauche, l'attribution en bas à droite : deux
// fenêtres au 1:1, à l'endroit exact où le compositeur dit les avoir posés.
detail(Math.round(W * 0.02), H - 760, 1500, 700, `${sortie}-cartouche.jpg`)
detail(Math.max(0, W - 1500), H - 420, 1500, 380, `${sortie}-attribution.jpg`)
