// LE PLAFOND MATÉRIEL DE `applySize`, ET LA VIDÉO QUI NE DOIT RIEN SENTIR.
//
// Deux défauts vivaient au même endroit (src/export.js) :
//
//  1. AUCUN PLAFOND. Le 50 × 70 paysage — format par défaut de la boutique —
//     réclame 8 339 px à 300 dpi ; MAX_RENDERBUFFER_SIZE vaut 8 192 sur une
//     bonne moitié du parc ; le pilote rabote alors UNE SEULE dimension, sans
//     exception ni un mot en console. L'affiche part écrasée de 1,8 %.
//  2. `camera.aspect` prenait l'aspect de ce qu'on rend. `setViewOffset` attend
//     celui de l'IMAGE ENTIÈRE : three construit le frustum complet depuis
//     `aspect`, puis y découpe la fenêtre. Inoffensif tant qu'on rend plein
//     cadre — mortel dès qu'on pave.
//
// LA CONTRAINTE QUI PRIME : `applySize` est PARTAGÉ avec l'enregistreur vidéo,
// qui ne passe pas le quatrième argument. ShibuMap produit des vidéos de
// communication ; les casser en silence serait pire que le défaut corrigé. D'où
// le premier test ci-dessous, qui n'est pas une lecture de ce que le code
// DEVRAIT faire mais une comparaison avec ce qu'il FAISAIT, figé.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applySize, tailleSousPlafond } from '../src/export.js'
import { safeAspect } from '../src/viewport.js'
import { EXPORT_SIZES, EXPORT_RATIOS, exportDims } from '../src/export-presets.js'
import { geometriePage } from '../src/print-page.js'

// ---------------------------------------------------------------------------
// L'INSTRUMENTATION
// ---------------------------------------------------------------------------
// On journalise TOUT ce qu'`applySize` peut faire au moteur de rendu, et rien
// d'autre : la densité, la taille du compositeur, l'écriture de l'aspect (par
// un accesseur, parce que ce n'est pas un appel), et la remise à plat de la
// matrice. `getContext` n'y figure pas VOLONTAIREMENT : lire la limite
// matérielle n'est pas un effet sur l'image, et l'exiger ferait diverger les
// deux journaux pour la seule raison qu'on interroge la carte.

const CONSTANTE_TEXTURE = 0x0d33
const CONSTANTE_RENDERBUFFER = 0x84e8

// Une carte graphique simulée : `limite` est le côté maximal qu'elle admet.
// 0 = pas de contexte lisible du tout.
function fauxContexte(limite) {
  if (!(limite > 0)) return null
  return {
    MAX_TEXTURE_SIZE: CONSTANTE_TEXTURE,
    MAX_RENDERBUFFER_SIZE: CONSTANTE_RENDERBUFFER,
    getParameter: () => limite,
  }
}

// Le rabotage crie en console — c'est le but. Ici on le met en sourdine, sauf
// dans le test qui vérifie justement qu'il crie.
function muet(fn) {
  const warn = console.warn
  console.warn = () => {}
  try { return fn() } finally { console.warn = warn }
}

function fauxRendu(limite = 0) {
  const journal = []
  const camera = {
    _aspect: 1.2345,
    get aspect() { return this._aspect },
    set aspect(v) { this._aspect = v; journal.push(['aspect', v]) },
    updateProjectionMatrix() { journal.push(['updateProjectionMatrix']) },
  }
  return {
    journal,
    camera,
    renderer: {
      setPixelRatio(r) { journal.push(['setPixelRatio', r]) },
      getContext: () => fauxContexte(limite),
    },
    composer: {
      setSize(w, h, updateStyle) { journal.push(['setSize', w, h, updateStyle]) },
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. LA VIDÉO EST INCHANGÉE — comparaison avec le code figé, pas avec l'idée
//    qu'on s'en fait
// ═══════════════════════════════════════════════════════════════════════════

// `applySize` tel qu'il était au commit b13fc23, RECOPIÉ MOT POUR MOT. C'est
// l'oracle : si un jour la version courante s'en écarte sur le chemin sans
// quatrième argument, on veut le savoir ici, pas dans un fichier MP4.
//
// ⚠️ NE PAS « CORRIGER » CETTE FONCTION. Son intérêt est justement de ne plus
// jamais bouger — un oracle qu'on met à jour en même temps que le code testé ne
// prouve plus rien.
function applySizeAvant({ renderer, composer, camera }, width, height) {
  renderer.setPixelRatio(1)
  composer.setSize(width, height, false)
  camera.aspect = safeAspect(width, height)
  camera.updateProjectionMatrix()
}

// Toutes les tailles que l'application peut réellement demander à ce chemin :
// les crans du menu croisés avec les ratios, plus « Screen » sur des aspects
// d'écran plausibles, plus quelques dégénérées que le garde-fou d'aspect existe
// précisément pour absorber.
function taillesRealistes() {
  const t = []
  for (const { value } of EXPORT_SIZES) {
    for (const r of Object.keys(EXPORT_RATIOS)) {
      const d = exportDims(r, value)
      t.push([d.width, d.height])
    }
    for (const a of [16 / 9, 4 / 3, 0.6222, 1, 2.3333]) {
      const d = exportDims('Screen', value, a)
      t.push([d.width, d.height])
    }
  }
  // les cas tordus : 0×0 (onglet masqué), un côté nul, un NaN qui remonterait
  // d'un ratio pourri. Le comportement d'avant doit survivre à tous.
  t.push([0, 0], [1920, 0], [0, 1080], [1, 1], [NaN, 1080], [-500, 300])
  // et le haut de gamme, encore sous la limite : là non plus rien ne bouge.
  t.push([8192, 4608], [4096, 4096], [8000, 8192])
  return t
}

test('la vidéo est intacte : sans quatrième argument, exactement le code d’avant', () => {
  // On rejoue sur une carte QUI DÉCLARE UNE LIMITE (8 192, la plus répandue) :
  // c'est le cas où un plafond mal posé se verrait. Et sur une carte muette,
  // où l'on ne doit rien deviner.
  for (const limite of [8192, 4096, 16384, 0]) {
    for (const [w, h] of taillesRealistes()) {
      if (limite > 0 && Math.max(w, h) > limite) continue // hors périmètre, cas traité plus bas
      const avant = fauxRendu(limite)
      const apres = fauxRendu(limite)
      applySizeAvant(avant, w, h)
      applySize(apres, w, h)
      assert.deepEqual(apres.journal, avant.journal,
        `divergence sur ${w}×${h} (carte à ${limite || 'limite illisible'})`)
      // même l'aspect final, NaN compris : c'est lui qui reste collé dans la
      // caméra pendant des centaines de frames et ressort par restoreState.
      assert.deepEqual(apres.camera.aspect, avant.camera.aspect)
    }
  }
})

test('la vidéo est intacte : les crans du menu ne peuvent pas atteindre le plafond', () => {
  // La preuve que la branche « raboté » est INATTEIGNABLE depuis l'enregistreur
  // vidéo : le plus grand cran vaut 3 840 px de côté long (export-presets.js),
  // et 2 048 est le plancher garanti de WebGL2 — aucune carte ne descend en
  // dessous. Si quelqu'un ajoute un cran 8K, ce test tombe, et c'est le moment
  // exact où il faut revenir lire le plafond.
  const maxCran = Math.max(...EXPORT_SIZES.map((s) => Number(s.value)))
  assert.ok(maxCran <= 4096, `un cran d’export à ${maxCran} px peut désormais franchir le plafond`)
  for (const { value } of EXPORT_SIZES) {
    for (const r of Object.keys(EXPORT_RATIOS)) {
      const d = exportDims(r, value)
      assert.deepEqual(tailleSousPlafond({ getContext: () => fauxContexte(4096) }, d.width, d.height),
        [d.width, d.height], `${r} ${value} devrait passer intact`)
    }
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. LE PLAFOND EXISTE — ces tests meurent si on l'enlève
// ═══════════════════════════════════════════════════════════════════════════

test('LE DÉFAUT D’ORIGINE : le 50 × 70 paysage à 300 dpi ne sort plus au-dessus de la limite', () => {
  // Le chiffre du dossier, recalculé plutôt que recopié.
  const g = geometriePage({ format: '50x70', dpi: 300, orientation: 'paysage' })
  const [w, h] = g.totalPx
  assert.equal(w, 8339, 'le format par défaut de la boutique réclame bien 8 339 px de large')

  const ctx = fauxRendu(8192)
  const rendu = muet(() => applySize(ctx, w, h))
  const [, aw, ah] = ctx.journal.find((e) => e[0] === 'setSize')

  // ⚠️ CE QUI TUE LA MUTATION « plus de plafond » : sans lui, aw vaut 8 339.
  assert.ok(Math.max(aw, ah) <= 8192,
    `${aw}×${ah} dépasse encore la limite de la carte — le pilote raboterait en silence`)
  assert.equal(rendu.rabote, true)

  // ⚠️ CE QUI TUE LA MUTATION « écrêter chaque côté séparément » : un
  // Math.min(w, 8192) laisserait la hauteur intacte et écraserait l'image de
  // 1,8 %, c'est-à-dire refaire à la main exactement la faute du pilote.
  const ecart = Math.abs((aw / ah) / (w / h) - 1)
  assert.ok(ecart < 0.001, `aspect déformé de ${(ecart * 100).toFixed(2)} % — la réduction n’est pas proportionnelle`)

  // Les cibles en demi-résolution des passes de post-traitement se taillent sur
  // ce tampon : un côté impair les rend fractionnaires (le carré noir de main.js).
  assert.equal(aw % 2, 0)
  assert.equal(ah % 2, 0)

  // La caméra suit la DEMANDE, pas le tampon : la réduction est proportionnelle,
  // aligner l'aspect sur le tampon raboté déplacerait le cadrage de l'acheteur.
  assert.equal(ctx.camera.aspect, safeAspect(w, h))
})

test('le rabotage ne se fait pas en silence — c’est le silence qui coûtait cher', () => {
  const vu = []
  const warn = console.warn
  console.warn = (m) => vu.push(String(m))
  try {
    applySize(fauxRendu(8192), 8339, 5906)
  } finally {
    console.warn = warn
  }
  assert.equal(vu.length, 1, 'un export raboté doit se signaler exactement une fois')
  assert.match(vu[0], /8339×5906/)
  assert.match(vu[0], /8192/)
})

test('le plafond tient dans les DEUX orientations — l’angle mort d’origine', () => {
  // En portrait, 8 339 est la HAUTEUR : un plafond qui ne regarde que la
  // largeur laisserait passer exactement le même défaut, retourné.
  for (const orientation of ['portrait', 'paysage']) {
    const [w, h] = geometriePage({ format: '50x70', dpi: 300, orientation }).totalPx
    const [aw, ah] = muet(() => tailleSousPlafond({ getContext: () => fauxContexte(8192) }, w, h))
    assert.ok(Math.max(aw, ah) <= 8192, `${orientation} : ${aw}×${ah} dépasse encore`)
  }
})

test('une carte plus basse rabote plus, toujours sans déformer', () => {
  for (const limite of [8192, 4096, 2048]) {
    const [aw, ah] = muet(() => tailleSousPlafond({ getContext: () => fauxContexte(limite) }, 8339, 5906))
    assert.ok(Math.max(aw, ah) <= limite)
    assert.ok(Math.abs((aw / ah) / (8339 / 5906) - 1) < 0.002, `aspect perdu à ${limite}`)
  }
})

test('ON NE DEVINE PAS LE MATÉRIEL : sans limite lisible, on rend ce qui est demandé', () => {
  // Brider à l'aveugle serait pire que le mal — un export 4K doit rester un
  // vrai 4K, et un contexte perdu ne doit pas transformer un export en vignette.
  const casMuets = [
    { getContext: () => null },
    { getContext: () => ({ getParameter: () => 0 }) },
    { getContext() { throw new Error('contexte perdu') } },
    {},
    undefined,
  ]
  for (const r of casMuets) {
    assert.deepEqual(tailleSousPlafond(r, 20000, 12000), [20000, 12000])
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. L'ASPECT DE L'IMAGE ENTIÈRE
// ═══════════════════════════════════════════════════════════════════════════

test('le quatrième argument porte l’aspect de l’AFFICHE, pas celui de la tuile', () => {
  const [w, h] = geometriePage({ format: '50x70', dpi: 300, orientation: 'paysage' }).totalPx
  const affiche = w / h

  const ctx = fauxRendu(8192)
  applySize(ctx, 2048, 2048, affiche) // une tuile carrée d'une affiche paysage
  assert.equal(ctx.camera.aspect, affiche,
    'three bâtit le frustum complet depuis aspect, puis setViewOffset y découpe : ' +
    'passer l’aspect de la tuile étirerait chaque tuile')
  assert.deepEqual(ctx.journal.find((e) => e[0] === 'setSize'), ['setSize', 2048, 2048, false],
    'la tuile se rend bien à SA taille, seul l’aspect parle de l’affiche')
})

test('sans quatrième argument, l’aspect reste borné à 1 px (le NaN qui ne se répare jamais)', () => {
  const ctx = fauxRendu(8192)
  applySize(ctx, 0, 0)
  assert.equal(ctx.camera.aspect, 1, '0 / 0 donnerait NaN, et un aspect NaN est définitif')
  assert.equal(applySize(fauxRendu(0), 1920, 1080).aspect, safeAspect(1920, 1080))
})

test('applySize rend la taille RÉELLEMENT appliquée', () => {
  assert.deepEqual(
    applySize(fauxRendu(16384), 3840, 2160),
    { width: 3840, height: 2160, aspect: safeAspect(3840, 2160), rabote: false },
  )
  const r = muet(() => applySize(fauxRendu(4096), 8339, 5906))
  assert.equal(r.rabote, true)
  assert.ok(r.width <= 4096 && r.height <= 4096)
})
