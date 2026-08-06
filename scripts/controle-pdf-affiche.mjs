// LE FICHIER DE CONTRÔLE — CELUI QU'ADRIEN DÉPOSE DANS ACROBAT
//
// ⚠️ CE SCRIPT EXISTE PARCE QU'AUCUN VALIDATEUR PDF/X LIBRE N'EXISTE. veraPDF
// ne couvre que PDF/A et PDF/UA ; il n'y a rien, sous node, qui puisse dire
// « oui, un préflight professionnel acceptera ce fichier ». Acrobat Pro, lui,
// sait le dire. Ce script fabrique donc l'objet à lui soumettre.
//
// Il produit DEUX fichiers, et les deux servent :
//
//   ① `controle-affiche.pdf` — CE QUE LA PRODUCTION PRODUIT : les traits de
//      coupe par défaut, sur une image volontairement TRÈS SOMBRE. C'est celui
//      qui doit passer le profil PDF/X-4 d'Acrobat, et c'est aussi la double
//      démonstration visuelle :
//        · les repères se VOIENT, parce qu'ils sont posés au-delà du fond
//          perdu, sur du papier nu (zoomer à 800 % sur un angle) ;
//        · le fond perdu PROLONGE le voile sombre du cartouche au lieu de
//          laisser réapparaître la carte brute (zoomer sur un angle BAS).
//   ② `controle-affiche-sans-reperes.pdf` — le MÊME fichier pour un prestataire
//      qui exige « MediaBox = BleedBox ». Il sert à lire la boîte support
//      réduite à son strict nécessaire : 216 × 303 mm pour un A4.
//
// ⚠️ LE VOILE EST PEINT PAR LE VRAI COMPOSITEUR, pas par une transcription.
// `composerSurToile` (src/compositeur-affiche.js) tourne ici sur un contexte 2D
// minimal écrit plus bas : ce que le fichier montre est donc ce que le
// navigateur dessinera, et non une seconde implémentation qui pourrait diverger.
// LE TEXTE DU CARTOUCHE, LUI, N'EST PAS DESSINÉ — node n'a pas de moteur de
// fonte. Il est prouvé ailleurs (tirage réel de la tâche « branchement »).
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
import { construirePdfAffiche, REPERES_AUCUN, REPERES_DEFAUT, ptVersMm } from '../src/pdf-affiche.js'
import { planComposition, composerSurToile } from '../src/compositeur-affiche.js'

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
// UN CONTEXTE 2D MINIMAL — POUR FAIRE TOURNER LE VRAI COMPOSITEUR
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ IL N'IMITE PAS LE COMPOSITEUR, IL LUI SERT DE PAPIER. Transcrire ici le
// voile dégradé aurait produit une SECONDE implémentation, qui aurait pu
// diverger de celle du navigateur — c'est-à-dire exactement le genre d'écart
// que tout ce chantier existe pour supprimer. On écrit donc le minimum de
// canevas dont `composerSurToile` a besoin, et on le laisse dessiner.
//
// Ce qu'il sait faire : `fillRect` (couleur unie ou dégradé linéaire vertical),
// `getImageData` / `putImageData` (le vignettage et le grain), la pile
// d'états. Ce qu'il NE sait PAS faire : le TEXTE — node n'a pas de moteur de
// fonte, et un texte approximé serait pire qu'un texte absent.

const RGBA = (s) => {
  const m = String(s).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/)
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
  const h = String(s).match(/^#([0-9a-f]{6})$/i)
  if (h) { const v = parseInt(h[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1] }
  return [0, 0, 0, 1]
}

/** Un contexte 2D sur un tampon RVBA, suffisant pour le compositeur. */
function contexte2dMinimal(pixels, largeur, hauteur) {
  const etat = { fillStyle: '#000', globalAlpha: 1 }
  const pile = []
  let textesIgnores = 0
  return {
    canvas: { width: largeur, height: hauteur },
    get textesIgnores() { return textesIgnores },
    font: '', textAlign: 'left', textBaseline: 'alphabetic', letterSpacing: '0px',
    shadowColor: '', shadowBlur: 0,
    get fillStyle() { return etat.fillStyle },
    set fillStyle(v) { etat.fillStyle = v },
    get globalAlpha() { return etat.globalAlpha },
    set globalAlpha(v) { etat.globalAlpha = v },
    save() { pile.push({ ...etat }) },
    restore() { Object.assign(etat, pile.pop() || { fillStyle: '#000', globalAlpha: 1 }) },
    createLinearGradient(x0, y0, x1, y1) {
      const arrets = []
      return { _degrade: true, x0, y0, x1, y1, arrets, addColorStop(o, c) { arrets.push([o, RGBA(c)]) } }
    },
    // ⚠️ LE TEXTE N'EST PAS DESSINÉ, ET C'EST DIT À VOIX HAUTE en fin de script.
    measureText(t) { return { width: String(t).length * 6 } },
    fillText() { textesIgnores++ },
    drawImage() { textesIgnores++ },
    fillRect(x, y, w, h) {
      const x0 = Math.max(0, Math.floor(x))
      const y0 = Math.max(0, Math.floor(y))
      const x1 = Math.min(largeur, Math.ceil(x + w))
      const y1 = Math.min(hauteur, Math.ceil(y + h))
      const d = etat.fillStyle
      const ga = etat.globalAlpha
      for (let Y = y0; Y < y1; Y++) {
        let r, v, b, a
        if (d && d._degrade) {
          // vertical seulement — c'est tout ce que le voile demande
          const denom = d.y1 - d.y0
          const t = denom === 0 ? 0 : Math.min(1, Math.max(0, (Y + 0.5 - d.y0) / denom))
          // ⚠️ AU-DELÀ DES DEUX ARRÊTS, LA COULEUR DE L'ARRÊT LE PLUS PROCHE.
          // C'est la règle du canevas, et c'est elle qui fait que le fond perdu
          // prolonge le voile à pleine opacité au lieu de découvrir la carte.
          const [c0, c1] = [d.arrets[0][1], d.arrets[d.arrets.length - 1][1]]
          r = c0[0] + (c1[0] - c0[0]) * t
          v = c0[1] + (c1[1] - c0[1]) * t
          b = c0[2] + (c1[2] - c0[2]) * t
          a = c0[3] + (c1[3] - c0[3]) * t
        } else {
          [r, v, b, a] = RGBA(d)
        }
        const alpha = a * ga
        if (alpha <= 0) continue
        for (let X = x0; X < x1; X++) {
          const p = (Y * largeur + X) * 4
          pixels[p] = pixels[p] + (r - pixels[p]) * alpha
          pixels[p + 1] = pixels[p + 1] + (v - pixels[p + 1]) * alpha
          pixels[p + 2] = pixels[p + 2] + (b - pixels[p + 2]) * alpha
        }
      }
    },
    getImageData(x, y, w, h) {
      const d = new Uint8ClampedArray(w * h * 4)
      for (let j = 0; j < h; j++) {
        d.set(pixels.subarray(((y + j) * largeur + x) * 4, ((y + j) * largeur + x + w) * 4), j * w * 4)
      }
      return { data: d, width: w, height: h }
    },
    putImageData(img, x, y) {
      for (let j = 0; j < img.height; j++) {
        pixels.set(img.data.subarray(j * img.width * 4, (j + 1) * img.width * 4), ((y + j) * largeur + x) * 4)
      }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// L'IMAGE — UNE AFFICHE SOMBRE PLAUSIBLE
// ═══════════════════════════════════════════════════════════════════════════
//
// Un relief de nuit : dégradé vertical très sombre, quelques courbes de niveau
// d'un pixel — ET UNE MER TURQUOISE le long des bords. Elle est faite pour
// quatre vérifications :
//   · la RÉSOLUTION — les courbes d'un pixel n'existent qu'à 300 dpi ;
//   · le FOND SOMBRE — c'est le cas où des repères mal placés disparaissent ;
//   · la JOINTURE — le dégradé la rendrait visible s'il y en avait une ;
//   · LE FOND PERDU — la mer est CLAIRE, le voile du cartouche est SOMBRE. Si
//     le voile s'arrêtait au format fini, une bande turquoise apparaîtrait à
//     exactement 3 mm du bord, sur trois côtés. C'est le défaut qu'Adrien a
//     photographié, et c'est ce que ce fichier doit ne PLUS montrer.

/** La bande, en RVBA — le compositeur veut un tampon à quatre canaux. */
function bandeSombre(y0, hauteur) {
  const rgba = new Uint8ClampedArray(LARGEUR_PX * hauteur * 4)
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
      // ⚠️ LA MER SE DÉCIDE SUR LE RELIEF, AVANT LES COURBES DE NIVEAU. La
      // première version testait `n` APRÈS y avoir ajouté la courbe — et la
      // courbe vaut 0,16 partout où le relief est nul : la mer n'apparaissait
      // jamais, et le contrôle du fond perdu mesurait un écart trois fois trop
      // petit. Le piège vaut d'être écrit : un témoin qui ne se voit pas ne
      // témoigne de rien.
      const mer = n <= 0
      n = Math.min(1, Math.max(0, n + courbe))
      const p = (y * LARGEUR_PX + x) * 4
      rgba[p] = mer ? 46 : Math.round(255 * (0.03 + n * 0.42))
      rgba[p + 1] = mer ? 196 : Math.round(255 * (0.05 + n * 0.46))
      rgba[p + 2] = mer ? 188 : Math.round(255 * (0.10 + n * 0.40))
      rgba[p + 3] = 255
    }
  }
  return rgba
}

/** RVBA → RVB, juste avant l'encodage : le PNG du contrôle est opaque. */
function versRgb(rgba, largeur, hauteur) {
  const rgb = Buffer.alloc(largeur * hauteur * 3)
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2]
  }
  return rgb
}

// ═══════════════════════════════════════════════════════════════════════════

const lisible = (o) => `${(o / 1e6).toFixed(2)} Mo`

async function principal() {
  mkdirSync(SORTIE, { recursive: true })

  // ⚠️ LE PLAN DU COMPOSITEUR, AUX DIMENSIONS DU FICHIER. C'est lui qui porte
  // le voile SOMBRE — l'option « écrire en clair (fond sombre) » de l'écran
  // d'édition — et c'est ce voile qui doit désormais couvrir le fond perdu.
  const plan = planComposition({
    largeur: LARGEUR_PX,
    hauteur: HAUTEUR_PX,
    fondPerduPx: Math.round((FOND_PERDU_MM / 25.4) * DPI),
    largeurMm: LARGEUR_MM,
    cartouche: { actif: true, sombre: true, titre: 'Contrôle', lieu: { nom: 'Contrôle', lat: 45.832, lon: 6.865, altMax: 4805 } },
    // le vignettage est allumé : il doit lui aussi traiter le fond perdu
    vignette: 0.6,
    attribution: 'contrôle d’impression',
  })

  // Deux bandes, comme le pavage en produit : le contrôle porte donc une
  // jointure réelle, et Acrobat permet de zoomer dessus.
  const coupe = Math.floor(HAUTEUR_PX / 2)
  const hauteurs = [coupe, HAUTEUR_PX - coupe]
  console.log(`image : ${LARGEUR_PX} × ${HAUTEUR_PX} px à ${DPI} dpi, en ${hauteurs.length} bandes`)
  const bandes = []
  let ignores = 0
  let y0 = 0
  for (const h of hauteurs) {
    const rgba = bandeSombre(y0, h)
    // ⚠️ LE VRAI COMPOSITEUR, SUR LA VRAIE BANDE, AUX VRAIES COORDONNÉES.
    const ctx = contexte2dMinimal(rgba, LARGEUR_PX, h)
    composerSurToile(ctx, plan, { toile: { x: 0, y: y0, largeur: LARGEUR_PX, hauteur: h } })
    ignores += ctx.textesIgnores
    const png = encoderPng(versRgb(rgba, LARGEUR_PX, h), LARGEUR_PX, h)
    bandes.push({ octets: new Uint8Array(png), type: 'image/png', hauteurPx: h })
    y0 += h
  }
  const octetsPng = bandes.reduce((s, b) => s + b.octets.length, 0)

  // ── LA MESURE QUI COMPTE : la carte brute a-t-elle disparu du fond perdu ? ──
  //
  // On relit la DERNIÈRE bande composée là où le défaut se voyait : sur une
  // colonne verticale traversant le bord bas. Si le voile s'arrêtait au format
  // fini, la valeur sauterait brutalement à 3 mm du bord.
  const derniere = bandeSombre(y0 - hauteurs[hauteurs.length - 1], hauteurs[hauteurs.length - 1])
  const hD = hauteurs[hauteurs.length - 1]
  const ctxD = contexte2dMinimal(derniere, LARGEUR_PX, hD)
  composerSurToile(ctxD, plan, { toile: { x: 0, y: y0 - hD, largeur: LARGEUR_PX, hauteur: hD } })
  const fondPx = Math.round((FOND_PERDU_MM / 25.4) * DPI)
  const lire = (colonne, dy) => {
    const p = ((hD - 1 - dy) * LARGEUR_PX + colonne) * 4
    return [derniere[p], derniere[p + 1], derniere[p + 2]]
  }
  // ⚠️ ON BALAIE TOUT LE BORD, pas une colonne choisie. Le défaut se voyait « le
  // long de deux bords » : une seule sonde, mal placée, l'aurait manqué.
  let saut = 0
  let auBord = [0, 0, 0]
  let justeDedans = [0, 0, 0]
  for (let c = 0; c < LARGEUR_PX; c++) {
    const a = lire(c, 1)
    const b = lire(c, fondPx + 2)
    const e = Math.max(...a.map((v, i) => Math.abs(v - b[i])))
    if (e > saut) { saut = e; auBord = a; justeDedans = b }
  }

  const commun = {
    largeurMm: LARGEUR_MM,
    hauteurMm: HAUTEUR_MM,
    bandes,
    auteur: 'ShibuMap',
    producteur: 'ShibuMap',
    outil: 'ShibuMap — emballage PDF d’affiche (src/pdf-affiche.js)',
    date: new Date('2026-08-06T12:00:00Z'),
  }

  // ① CE QUE LA PRODUCTION PRODUIT : les repères par défaut.
  const avec = await construirePdfAffiche({ ...commun, titre: 'ShibuMap — contrôle d’impression' })
  // ② LA VARIANTE « MediaBox = BleedBox », pour un prestataire qui l'exige.
  const sans = await construirePdfAffiche({
    ...commun,
    titre: 'ShibuMap — contrôle d’impression (sans repères)',
    reperes: REPERES_AUCUN,
  })

  writeFileSync(join(SORTIE, 'controle-affiche.pdf'), avec.octets)
  writeFileSync(join(SORTIE, 'controle-affiche-sans-reperes.pdf'), sans.octets)

  const mm = (r) => `[${r.map((v) => ptVersMm(v).toFixed(3)).join(', ')}] mm`
  const taille = (r) => `${ptVersMm(r[2] - r[0]).toFixed(2)} × ${ptVersMm(r[3] - r[1]).toFixed(2)} mm`
  console.log('')
  console.log('── controle-affiche.pdf — LE DÉFAUT DE PRODUCTION, avec repères ──')
  console.log(`TrimBox   ${mm(avec.boites.trimBox)}   ${taille(avec.boites.trimBox)}`)
  console.log(`BleedBox  ${mm(avec.boites.bleedBox)}   ${taille(avec.boites.bleedBox)}  (fond perdu ${avec.boites.mm.fondPerdu} mm)`)
  console.log(`MediaBox  ${mm(avec.boites.mediaBox)}   ${taille(avec.boites.mediaBox)}  (marge ${avec.boites.mm.marge} mm)`)
  console.log(`repères   ${avec.reperes.segments.length} segments, décalage ${avec.reperes.decalageMm} mm, longueur ${avec.reperes.longueurMm} mm, épaisseur ${avec.reperes.epaisseurMm} mm`)
  console.log('')
  console.log('── controle-affiche-sans-reperes.pdf — MediaBox = BleedBox ──')
  console.log(`MediaBox  ${mm(sans.boites.mediaBox)}   ${taille(sans.boites.mediaBox)}  (marge ${sans.boites.mm.marge} mm)`)
  console.log('')
  console.log('── LE FOND PERDU PROLONGE-T-IL L’IMAGE FINALE ? ──')
  console.log(`au bord du fichier      rvb(${auBord.join(', ')})`)
  console.log(`juste dans le format fini rvb(${justeDedans.join(', ')})`)
  console.log(`saut au trait de coupe  ${saut} / 255  ${saut <= 4 ? '→ AUCUNE bande de carte brute' : '→ ⚠️ LA CARTE BRUTE RÉAPPARAÎT'}`)
  console.log('')
  console.log(`PNG source        ${lisible(octetsPng)}`)
  console.log(`PDF avec repères  ${lisible(avec.octets.length)}  (× ${(avec.octets.length / octetsPng).toFixed(2)} du PNG)`)
  console.log(`PDF sans repères  ${lisible(sans.octets.length)}`)
  console.log(`profil ICC        ${avec.profilOctets} o (sRGB IEC61966-2.1), incorporé`)
  console.log(`conformité        ${avec.conformite}`)
  if (ignores) {
    console.log('')
    console.log(`⚠️ ${ignores} dessin(s) de TEXTE ou d’IMAGE ignoré(s) : node n’a pas de moteur de fonte.`)
    console.log('   Ce fichier contrôle les BOÎTES, les REPÈRES et le FOND PERDU — pas le cartouche,')
    console.log('   qui se prouve sur un tirage réel du navigateur.')
  }
}

principal().catch((e) => { console.error(e); process.exit(1) })
