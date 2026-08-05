#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MESURER LE PAVAGE D'UNE AFFICHE — sept formats, deux orientations
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE SCRIPT EST COMMITTÉ EXPRÈS. Deux agents de ce chantier ont produit des
// chiffres que personne ne pouvait rejouer, parce qu'ils avaient supprimé le
// script qui les avait produits. Un chiffre qu'on ne peut pas refaire n'est pas
// une mesure, c'est une affirmation.
//
//     node scripts/mesure-pavage-affiche.mjs
//     node scripts/mesure-pavage-affiche.mjs --json
//     node --expose-gc scripts/mesure-pavage-affiche.mjs   (mesure plus nette)
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI EST MESURÉ, ET CE QUI NE L'EST PAS — À LIRE AVANT DE CITER UN CHIFFRE
// ═══════════════════════════════════════════════════════════════════════════
//
// MESURÉ POUR DE VRAI, en faisant tourner `exporteAffichePavee` lui-même :
//   · le nombre de tuiles, la grille, le côté de tuile retenu, la marge de
//     recouvrement — ce sont des calculs, ils sont exacts ;
//   · le PIC DE MÉMOIRE RÉSIDENTE du processus (`process.memoryUsage().rss`),
//     échantillonné aux instants où l'orchestrateur alloue. Les tampons sont
//     de VRAIS tampons, aux VRAIES tailles ;
//   · la DURÉE DE COMPOSITION : les copies de pixels tuile → bande, plus
//     l'encodage de chaque bande ;
//   · le POIDS DU FICHIER, par `deflate` sur les octets de chaque bande — ce
//     que fait un encodeur PNG, à son filtrage par ligne près.
//
// ⚠️ NON MESURÉ, et aucun chiffre de ce script ne le prétend :
//   · LE TEMPS DE RENDU GPU. Node n'a pas de contexte WebGL. Une tuile de
//     2 048² de cette scène coûte, sur la machine d'Adrien, entre 40 et 200 ms
//     selon les effets — c'est ce terme qui domine la durée réelle, et il se
//     mesurera dans le navigateur, à la tâche 8.
//   · LA MÉMOIRE GPU. Les cibles de rendu sont modélisées par des tampons HÔTE
//     de même taille (cible × échantillons + profondeur + ping-pong, le modèle
//     de `poidsRendu`). C'est un modèle fidèle en octets, pas une lecture du
//     pilote.
//
// Autrement dit : les colonnes « tuiles », « bande » et « pic » sont solides ;
// la colonne « durée » ne compte que la moitié composition.

import zlib from 'node:zlib'
import { FORMATS_AFFICHE, geometriePage, poidsRendu } from '../src/print-page.js'
import { DPI_NOMINAL, COTE_TUILE } from '../src/export-dpi.js'
import { exporteAffichePavee, MPX_CANEVAS_MAX } from '../src/export.js'

// Les effets tels que main.js les construit par défaut : SMAA toujours, bokeh
// à 3,7 (params.bokehScale, main.js:262). Le grain et le vignettage sont à zéro
// dans le look de base — s'ils étaient allumés ils ne changeraient pas la
// géométrie du pavage, seulement le plan de neutralisation.
const EFFETS = { smaaActif: true, bokehActif: true, bokehScale: 3.7 }

// ⚠️ EN MÉBIOCTETS (1 024²). Le plan du chantier annonce « 226 Mo » et
// « 1 141 Mo » : ce sont des MÉGAOCTETS DÉCIMAUX. 215,4 MiB = 225,9 Mo et
// 1 088,3 MiB = 1 141,1 Mo — les deux chiffres du plan, retrouvés exactement.
// La conversion est rappelée en pied de tableau pour qu'on ne croie jamais à
// un écart là où il n'y a qu'une unité.
const Mo = (o) => o / 1024 / 1024
const enDecimal = (mib) => mib * 1.048576

// ── Le banc : un moteur de rendu qui alloue pour de vrai, et peint vraiment ──
//
// Il ne simule pas le GPU, il en modélise le COÛT MÉMOIRE. `composer.setSize`
// alloue le canevas de dessin (largeur × hauteur × RGBA) et les cibles de la
// chaîne (× 7, le modèle de `poidsRendu` avec 4 échantillons). `render` peint
// un motif — assez pour que les copies vers la bande portent de vrais octets.
function bancDeRendu(pic, livre) {
  let largeur = 1
  let hauteur = 1
  const toile = { largeur: 1, hauteur: 1, pixels: new Uint8ClampedArray(4) }
  let cibles = null
  let graine = 0
  return {
    renderer: {
      setPixelRatio() {},
      getPixelRatio: () => 1,
      // aucune limite lisible → `tailleSousPlafond` sert la taille demandée,
      // ce qui est exactement le comportement d'une machine qui suit
      getContext: () => null,
      getSize: (v) => { v.x = largeur; v.y = hauteur; return v },
      domElement: toile,
    },
    composer: {
      setSize(w, h) {
        largeur = w
        hauteur = h
        toile.largeur = w
        toile.hauteur = h
        toile.pixels = new Uint8ClampedArray(w * h * 4)
        cibles = Buffer.allocUnsafe(w * h * 4 * 7)
        cibles[0] = 1 // toucher la page, sinon le système ne la donne jamais
        livre.set('canevas-gl', w * h * 4)
        livre.set('cibles-gl', w * h * 4 * 7)
        pic()
      },
      render() {
        // un motif à un octet par pixel : ce qui compte ici, c'est que les
        // octets existent et se recopient, pas ce qu'ils représentent
        const p = toile.pixels
        graine = (graine + 37) & 255
        for (let i = 0; i < p.length; i += 4) {
          p[i] = (i + graine) & 255
          p[i + 1] = (i >> 8) & 255
          p[i + 2] = graine
          p[i + 3] = 255
        }
      },
    },
    camera: {
      aspect: 1,
      updateProjectionMatrix() {},
    },
    relacher() { cibles = null; toile.pixels = new Uint8ClampedArray(4); livre.clear() },
  }
}

// ── Le support de composition : de vraies bandes, un vrai encodage ──────────
function supportMesure(pic, compte, livre) {
  return {
    creerToile(largeur, hauteur) {
      let pixels = new Uint8ClampedArray(largeur * hauteur * 4)
      compte.canevasMaxPx = Math.max(compte.canevasMaxPx, largeur * hauteur)
      livre.set('bande', largeur * hauteur * 4)
      pic()
      return {
        largeur,
        hauteur,
        poser(src, sx, sy, sw, sh, dx, dy, dw, dh) {
          // pas de mise à l'échelle attendue sur ce banc (le plafond ne mord
          // jamais) : on le vérifie plutôt que de le supposer
          if (sw !== dw || sh !== dh) throw new Error(`mise à l'échelle inattendue ${sw}×${sh} → ${dw}×${dh}`)
          for (let y = 0; y < sh; y++) {
            const s = ((sy + y) * src.largeur + sx) * 4
            const d = ((dy + y) * largeur + dx) * 4
            pixels.set(src.pixels.subarray(s, s + sw * 4), d)
          }
          compte.pixelsPoses += sw * sh
        },
        encoder() {
          const z = zlib.deflateSync(Buffer.from(pixels.buffer, 0, pixels.length), { level: 6 })
          compte.octetsEncodes += z.length
          // l'encodeur tient son propre tampon le temps de la compression :
          // c'est le vrai instant de pointe d'une bande
          livre.set('encodage', z.length)
          pic()
          livre.delete('encodage')
          return Promise.resolve({ size: z.length, type: 'image/png' })
        },
        liberer() { pixels = null; livre.delete('bande') },
      }
    },
  }
}

async function mesureUn(format, orientation) {
  const dpi = DPI_NOMINAL[format]
  const geo = geometriePage({ format, dpi, orientation })
  const [W, H] = geo.totalPx

  globalThis.gc?.()
  let picRss = process.memoryUsage().rss
  const base = picRss
  // ⚠️ DEUX MESURES DE MÉMOIRE, ET LA PREMIÈRE EST LA BONNE. Le `rss` d'un
  // processus node dépend du moment où le ramasse-miettes passe : d'une
  // exécution à l'autre il varie du simple au décuple, et il compte aussi ce
  // que node garde pour lui. `livre` tient au contraire le compte EXACT des
  // octets que l'algorithme détient EN MÊME TEMPS — c'est ce qui se compare à
  // `poidsRendu`, et c'est ce qui se rejoue à l'identique.
  const livre = new Map()
  let picVivant = 0
  const pic = () => {
    picRss = Math.max(picRss, process.memoryUsage().rss)
    let s = 0
    for (const v of livre.values()) s += v
    picVivant = Math.max(picVivant, s)
  }

  const compte = { canevasMaxPx: 0, pixelsPoses: 0, octetsEncodes: 0 }
  const banc = bancDeRendu(pic, livre)
  const support = supportMesure(pic, compte, livre)

  const t0 = performance.now()
  const r = await exporteAffichePavee({
    renderer: banc.renderer,
    composer: banc.composer,
    camera: banc.camera,
    totalPx: [W, H],
    dpi,
    effets: EFFETS,
    // la scène n'existe pas sur ce banc : le cadrage et l'épaisseur des traits
    // sont des gestes sur three, pas des octets. Ils ne pèsent pas.
    preparerTuile: () => ({ restaurer() {} }),
    support,
  })
  const duree = performance.now() - t0
  banc.relacher()

  const hTuile = Math.max(...r.plan.tuiles.map((t) => t.h))
  const wTuile = Math.max(...r.plan.tuiles.map((t) => t.w))
  const mono = poidsRendu({ totalPx: [W, H], tuilePx: [W, H], echantillons: 4 })
  const pave = poidsRendu({ totalPx: [W, H], tuilePx: [wTuile, hTuile], echantillons: 4 })

  return {
    format, orientation, dpi,
    px: `${W}×${H}`,
    mpxPleine: (W * H) / 1e6,
    grille: `${r.plan.colonnes}×${r.plan.lignes}`,
    tuiles: r.plan.tuiles.length,
    coteTuile: r.coteTuile,
    tuileMax: `${wTuile}×${hTuile}`,
    fenetreMax: `${wTuile + 2 * r.recouvrementPx}×${hTuile + 2 * r.recouvrementPx}`,
    recouvrementPx: r.recouvrementPx,
    bandeMpx: r.bandeMaxPx / 1e6,
    // La somme des tuiles retombe-t-elle sur la taille pleine ? La propriété
    // non négociable de `planTuiles`, vérifiée ici sur les pixels RÉELLEMENT
    // posés — pas sur les nombres du plan.
    couvertureExacte: compte.pixelsPoses === W * H,
    picVivantMo: Mo(picVivant),
    picRssMo: Mo(picRss - base),
    modeleMonoMo: Mo(mono.total),
    modelePaveMo: Mo(pave.total),
    // ce que la composition bande par bande évite en plus du pavage : le
    // canevas pleine taille de `poidsRendu`, remplacé par une bande
    modeleBandeMo: Mo(pave.tuile + r.bandeMaxPx * 4),
    dureeMs: duree,
    poidsMo: Mo(compte.octetsEncodes),
  }
}

async function main() {
  const lignes = []
  for (const f of FORMATS_AFFICHE) {
    for (const o of ['portrait', 'paysage']) {
      lignes.push(await mesureUn(f.id, o))
    }
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(lignes, null, 2))
    return
  }

  const n = (v, d = 1) => v.toFixed(d)
  console.log(`\nPavage d'affiche — ${lignes.length} combinaisons, côté nominal ${COTE_TUILE}, `
    + `plafond de canevas ${(MPX_CANEVAS_MAX / 1e6).toFixed(1)} Mpx`)
  console.log(`Effets : SMAA + bokeh ${EFFETS.bokehScale} → la marge dépend de la hauteur de tuile\n`)
  const tete = ['format', 'orient.', 'dpi', 'pixels', 'Mpx', 'grille', 'tuiles', 'côté', 'tuile max',
    'fenêtre', 'marge', 'bande Mpx', 'PIC Mo', 'rss Mo', 'modèle pavé', 'modèle mono', 'compo ms', 'PNG Mo', 'couv.']
  const corps = lignes.map((l) => [
    l.format, l.orientation, String(l.dpi), l.px, n(l.mpxPleine), l.grille, String(l.tuiles),
    String(l.coteTuile), l.tuileMax, l.fenetreMax, String(l.recouvrementPx), n(l.bandeMpx, 2),
    n(l.picVivantMo), n(l.picRssMo), n(l.modelePaveMo), n(l.modeleMonoMo), n(l.dureeMs, 0),
    n(l.poidsMo), l.couvertureExacte ? 'exacte' : '⚠️ TROU',
  ])
  const larg = tete.map((t, i) => Math.max(t.length, ...corps.map((c) => c[i].length)))
  const ligne = (c) => c.map((v, i) => v.padEnd(larg[i])).join('  ')
  console.log(ligne(tete))
  console.log(larg.map((w) => '─'.repeat(w)).join('  '))
  for (const c of corps) console.log(ligne(c))

  const pire = lignes.reduce((a, b) => (b.bandeMpx > a.bandeMpx ? b : a))
  const gros = lignes.reduce((a, b) => (b.picVivantMo > a.picVivantMo ? b : a))
  const tuilu = lignes.reduce((a, b) => (b.tuiles > a.tuiles ? b : a))
  console.log(`\nPire bande      : ${pire.format} ${pire.orientation} — ${n(pire.bandeMpx, 2)} Mpx, `
    + `soit ${n((pire.bandeMpx * 1e6 * 100) / MPX_CANEVAS_MAX)} % du plafond de canevas `
    + `et ${n((pire.bandeMpx * 1e6 * 100) / 16.7e6)} % de ce qu'iOS admet`)
  console.log(`PIRE PIC        : ${gros.format} ${gros.orientation} — ${n(gros.picVivantMo)} Mo vivants `
    + `(modèle mono au même format : ${n(gros.modeleMonoMo)} Mo)`)
  console.log(`Plus de tuiles  : ${tuilu.format} ${tuilu.orientation} — ${tuilu.tuiles} tuiles `
    + `(${tuilu.grille}), côté ${tuilu.coteTuile}`)
  console.log(`Couverture      : ${lignes.every((l) => l.couvertureExacte) ? 'exacte partout' : '⚠️ UN TROU'}`)
  console.log(`Canevas max     : ${n(Math.max(...lignes.map((l) => l.bandeMpx)), 2)} Mpx — `
    + `aucune image pleine (la plus grande ferait ${n(Math.max(...lignes.map((l) => l.mpxPleine)), 1)} Mpx)`)
  // Invariant ③ : la fenêtre rendue, recouvrement compris, sous le plancher
  // garanti de WebGL2. S'il tombe, aucune détection matérielle ne rattrape.
  const debord = lignes.filter((l) => {
    const [w, h] = l.fenetreMax.split('×').map(Number)
    return Math.max(w, h) > COTE_TUILE
  })
  console.log(`Fenêtre max     : ${debord.length ? `⚠️ ${debord.length} DÉPASSENT ${COTE_TUILE}` : `toutes sous ${COTE_TUILE} px (plancher WebGL2)`}`)
  console.log(`\nUnités : mébioctets. En mégaoctets décimaux — ceux du plan — le pire pic vaut `
    + `${n(enDecimal(gros.picVivantMo))} Mo, le modèle pavé ${n(enDecimal(gros.modelePaveMo))} Mo `
    + `(annoncé 226) et le mono ${n(enDecimal(gros.modeleMonoMo))} Mo (annoncé 1 141).\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
