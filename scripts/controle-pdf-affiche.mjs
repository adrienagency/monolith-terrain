// LE FICHIER DE CONTRÔLE — CELUI QU'ADRIEN DÉPOSE DANS ACROBAT
//
// ⚠️ CE SCRIPT EXISTE PARCE QU'AUCUN VALIDATEUR PDF/X LIBRE N'EXISTE. veraPDF
// ne couvre que PDF/A et PDF/UA ; il n'y a rien, sous node, qui puisse dire
// « oui, un préflight professionnel acceptera ce fichier ». Acrobat Pro, lui,
// sait le dire. Ce script fabrique donc l'objet à lui soumettre.
//
// Il produit DEUX fichiers, et les deux servent :
//
//   ① `controle-affiche.pdf` — ce que la production produira : aucun repère.
//      C'est celui qui doit passer le profil PDF/X-4 d'Acrobat.
//   ② `controle-affiche-reperes.pdf` — le MÊME fichier avec les repères
//      optionnels, sur une image volontairement TRÈS SOMBRE. C'est la
//      démonstration du point qui a fait perdre du temps : les repères se
//      voient, parce qu'ils sont posés au-delà du fond perdu, sur du papier nu.
//      Zoomer sur un angle dans Acrobat suffit à le vérifier à l'œil.
//
// ⚠️ L'IMAGE EST ENCODÉE EN PNG, ET CE N'EST PAS CE QUE LA PRODUCTION FERA.
// Node n'a pas d'encodeur JPEG, et le navigateur en a un (`canvas.toBlob`).
// Le chemin de production passera donc par `FORMAT_RECOMMANDE` — du JPEG, recopié
// tel quel dans le PDF. Ce que ce script mesure au passage, c'est justement le
// coût de l'autre chemin : combien un PNG grossit quand pdf-lib le décode et le
// recompresse sans prédicteur. Le chiffre est imprimé en fin d'exécution.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pxPourMm, FOND_PERDU_MM } from '../src/print-page.js'
import { construirePdfAffiche, REPERES_COINS, ptVersMm } from '../src/pdf-affiche.js'

const ICI = dirname(fileURLToPath(import.meta.url))
const SORTIE = join(ICI, '..', '.superpowers', 'sdd', '2026-08-06-fichiers-impression')

// ── Le format du contrôle ─────────────────────────────────────────────────────
//
// A4, à 300 dpi réels. Le FORMAT n'a aucune importance pour un préflight — il
// lit des boîtes, pas des centimètres — mais la RÉSOLUTION en a une : le profil
// PDF/X-4 d'Acrobat avertit sous 250 dpi, et un avertissement de résolution sur
// un fichier de contrôle ferait douter de tout le reste. A4 tient en mémoire ici
// là où un 50 × 70 demanderait 146 Mo de pixels bruts.
const LARGEUR_MM = 210
const HAUTEUR_MM = 297
const DPI = 300

const LARGEUR_PX = pxPourMm(LARGEUR_MM + 2 * FOND_PERDU_MM, DPI)
const HAUTEUR_PX = pxPourMm(HAUTEUR_MM + 2 * FOND_PERDU_MM, DPI)

// ═══════════════════════════════════════════════════════════════════════════
// UN ENCODEUR PNG MINIMAL
// ═══════════════════════════════════════════════════════════════════════════
//
// Huit bits par canal, RVB, entrelacement zéro. Les filtres de ligne sont
// choisis par l'heuristique de la somme des valeurs absolues, celle de la
// spécification PNG : sans eux, le PNG de référence serait artificiellement
// gonflé et la comparaison avec le PDF ne voudrait rien dire.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function morceau(type, donnees) {
  const t = Buffer.from(type, 'latin1')
  const corps = Buffer.concat([t, donnees])
  const out = Buffer.alloc(corps.length + 8)
  out.writeUInt32BE(donnees.length, 0)
  corps.copy(out, 4)
  out.writeUInt32BE(crc32(corps), corps.length + 4)
  return out
}

/** RVB brut (largeur × hauteur × 3) → octets d'un PNG. */
function encoderPng(rgb, largeur, hauteur) {
  const parLigne = largeur * 3
  const brut = Buffer.alloc((parLigne + 1) * hauteur)
  const essais = [Buffer.alloc(parLigne), Buffer.alloc(parLigne), Buffer.alloc(parLigne)]
  for (let y = 0; y < hauteur; y++) {
    const dep = y * parLigne
    const prec = (y - 1) * parLigne
    const scores = [0, 0, 0]
    for (let i = 0; i < parLigne; i++) {
      const a = i >= 3 ? rgb[dep + i - 3] : 0
      const b = y > 0 ? rgb[prec + i] : 0
      essais[0][i] = rgb[dep + i]
      essais[1][i] = (rgb[dep + i] - a) & 0xff
      essais[2][i] = (rgb[dep + i] - b) & 0xff
      for (let f = 0; f < 3; f++) {
        const v = essais[f][i]
        scores[f] += v < 128 ? v : 256 - v
      }
    }
    let meilleur = 0
    if (scores[1] < scores[meilleur]) meilleur = 1
    if (scores[2] < scores[meilleur]) meilleur = 2
    brut[y * (parLigne + 1)] = meilleur
    essais[meilleur].copy(brut, y * (parLigne + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largeur, 0)
  ihdr.writeUInt32BE(hauteur, 4)
  ihdr[8] = 8   // profondeur
  ihdr[9] = 2   // type couleur : RVB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', ihdr),
    morceau('IDAT', deflateSync(brut, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ])
}

// ═══════════════════════════════════════════════════════════════════════════
// L'IMAGE — UNE AFFICHE SOMBRE PLAUSIBLE
// ═══════════════════════════════════════════════════════════════════════════
//
// Un relief de nuit : dégradé vertical très sombre, quelques courbes de niveau
// d'un pixel, un grain léger. Elle est faite pour trois vérifications :
//   · la RÉSOLUTION — les courbes d'un pixel n'existent qu'à 300 dpi ;
//   · le FOND SOMBRE — c'est le cas où des repères mal placés disparaissent ;
//   · la JOINTURE — le dégradé la rendrait visible s'il y en avait une.

function bandeSombre(y0, hauteur) {
  const rgb = Buffer.alloc(LARGEUR_PX * hauteur * 3)
  for (let y = 0; y < hauteur; y++) {
    const Y = y0 + y
    const v = Y / HAUTEUR_PX
    for (let x = 0; x < LARGEUR_PX; x++) {
      const u = x / LARGEUR_PX
      // le relief : un dôme, en valeurs basses
      const d = Math.hypot(u - 0.5, v - 0.55)
      let n = Math.max(0, 0.42 - d) * 1.6
      // les courbes de niveau, un pixel de large
      const courbe = Math.abs(((n * 26) % 1) - 0.5) > 0.494 ? 0.16 : 0
      // ⚠️ PAS DE GRAIN ICI, ET C'EST UN CHOIX DE POIDS. Le grain d'une vraie
      // affiche est un bruit blanc : incompressible par construction, il
      // triplerait ce fichier de contrôle sans rien apporter à un préflight,
      // qui ne juge ni la texture ni le sujet. Les courbes d'un pixel, elles,
      // restent : ce sont elles qui prouvent la résolution.
      n = Math.min(1, Math.max(0, n + courbe))
      const p = (y * LARGEUR_PX + x) * 3
      rgb[p] = Math.round(255 * (0.03 + n * 0.42))
      rgb[p + 1] = Math.round(255 * (0.05 + n * 0.46))
      rgb[p + 2] = Math.round(255 * (0.10 + n * 0.40))
    }
  }
  return rgb
}

// ═══════════════════════════════════════════════════════════════════════════

const lisible = (o) => `${(o / 1e6).toFixed(2)} Mo`

async function principal() {
  mkdirSync(SORTIE, { recursive: true })

  // Deux bandes, comme le pavage en produit : le contrôle porte donc une
  // jointure réelle, et Acrobat permet de zoomer dessus.
  const coupe = Math.floor(HAUTEUR_PX / 2)
  const hauteurs = [coupe, HAUTEUR_PX - coupe]
  console.log(`image : ${LARGEUR_PX} × ${HAUTEUR_PX} px à ${DPI} dpi, en ${hauteurs.length} bandes`)
  const bandes = []
  let y0 = 0
  for (const h of hauteurs) {
    const png = encoderPng(bandeSombre(y0, h), LARGEUR_PX, h)
    bandes.push({ octets: new Uint8Array(png), type: 'image/png', hauteurPx: h })
    y0 += h
  }
  const octetsPng = bandes.reduce((s, b) => s + b.octets.length, 0)

  const commun = {
    largeurMm: LARGEUR_MM,
    hauteurMm: HAUTEUR_MM,
    bandes,
    auteur: 'ShibuMap',
    producteur: 'ShibuMap',
    outil: 'ShibuMap — emballage PDF d’affiche (src/pdf-affiche.js)',
    date: new Date('2026-08-06T12:00:00Z'),
  }

  const sans = await construirePdfAffiche({ ...commun, titre: 'ShibuMap — contrôle d’impression (sans repères)' })
  const avec = await construirePdfAffiche({
    ...commun,
    titre: 'ShibuMap — contrôle d’impression (repères optionnels)',
    reperes: REPERES_COINS,
  })

  writeFileSync(join(SORTIE, 'controle-affiche.pdf'), sans.octets)
  writeFileSync(join(SORTIE, 'controle-affiche-reperes.pdf'), avec.octets)

  const mm = (r) => `[${r.map((v) => ptVersMm(v).toFixed(3)).join(', ')}] mm`
  console.log('')
  console.log(`TrimBox   ${mm(sans.boites.trimBox)}  →  ${LARGEUR_MM} × ${HAUTEUR_MM} mm`)
  console.log(`BleedBox  ${mm(sans.boites.bleedBox)}  →  fond perdu ${sans.boites.mm.fondPerdu} mm`)
  console.log(`MediaBox  ${mm(sans.boites.mediaBox)}  →  marge ${sans.boites.mm.marge} mm`)
  console.log('')
  console.log(`PNG source        ${lisible(octetsPng)}`)
  console.log(`PDF sans repères  ${lisible(sans.octets.length)}  (× ${(sans.octets.length / octetsPng).toFixed(2)} du PNG)`)
  console.log(`PDF avec repères  ${lisible(avec.octets.length)}  · ${avec.reperes.segments.length} segments`)
  console.log(`profil ICC        ${sans.profilOctets} o (sRGB IEC61966-2.1), incorporé`)
  console.log(`conformité        ${sans.conformite}`)
}

principal().catch((e) => { console.error(e); process.exit(1) })
