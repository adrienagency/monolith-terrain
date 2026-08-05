// LES DEUX DÉCALAGES DE L'AFFICHE, ET LE SILENCE QUAND ON LES EMPILE
//
// `camera.setViewOffset` n'est pas cumulatif. Ce n'est pas un défaut de three :
// c'est un SETTEUR, il écrase les six nombres précédents (voir
// PerspectiveCamera.js — `this.view.offsetX = x`, pas `+=`). Or l'affiche a
// DEUX raisons de s'en servir :
//
//   1. le cadrage que l'acheteur compose au pouce et à la molette (main.js,
//      `cadrerAffiche` : décalage en fraction d'image sur un cadre virtuel) ;
//   2. le pavage du tirage (print-page.js, `cadrageTuile` : la fenêtre d'une
//      tuile dans l'image pleine, en pixels réels).
//
// Les deux appelés à la suite, le second gagne — et ce qui part chez
// l'imprimeur n'est plus la composition validée, sans une ligne en console.
// C'est le seul défaut du dossier qui ne casse RIEN : il livre juste une autre
// affiche que celle payée.
//
// D'où ce module : composer les deux AVANT d'appeler, et n'appeler qu'une fois.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PerspectiveCamera } from 'three'
import { planTuiles, cadrageTuile } from '../src/print-page.js'
import { composeDecalage } from '../src/export-cadrage.js'

// ── Mesurer ce que la caméra REND, pas ce qu'on lui a passé ────────────────
//
// On ne compare pas des arguments à des arguments : on relit la fenêtre du
// frustum dans la matrice de projection, celle qui décide vraiment des pixels.
// Un test qui se contenterait de relire `camera.view` prouverait seulement que
// three a rangé nos nombres.
//
//   m11 = 2n/(d−g)   m13 = (d+g)/(d−g)
//   m22 = 2n/(h−b)   m23 = (h+b)/(h−b)
function fenetre(camera) {
  const m = camera.projectionMatrix.elements // colonne-majeur
  const n = camera.near
  const largeur = (2 * n) / m[0]
  const hauteur = (2 * n) / m[5]
  const cx = (m[8] * largeur) / 2
  const cy = (m[9] * hauteur) / 2
  return {
    gauche: cx - largeur / 2,
    droite: cx + largeur / 2,
    bas: cy - hauteur / 2,
    haut: cy + hauteur / 2,
  }
}

const proche = (a, b, msg, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b)), `${msg} : ${a} ≠ ${b}`)

const memeFenetre = (a, b, msg, eps = 1e-9) => {
  for (const cle of ['gauche', 'droite', 'bas', 'haut']) proche(a[cle], b[cle], `${msg} — ${cle}`, eps)
}

// Le 70 × 50 paysage à 300 dpi : le format par défaut de la boutique.
const PLEINE = [8268, 5906]
const ASPECT = PLEINE[0] / PLEINE[1]

function cameraAffiche(zoom = 1) {
  const c = new PerspectiveCamera(50, ASPECT, 0.1, 1000)
  c.zoom = zoom
  c.updateProjectionMatrix()
  return c
}

// ⚠️ TRANSCRIPTION LITTÉRALE de ce que faisait `cadrerAffiche` (main.js) avant
// ce module — le cadre virtuel de 10 000 compris. Elle reste ici pour une
// raison : c'est la RÉFÉRENCE de ce que l'acheteur voit à l'écran. Toute
// composition doit retomber dessus quand une seule tuile couvre l'affiche.
function acheteurSeulHistorique(camera, c, aspect) {
  const W = 10000
  const H = Math.round(W / aspect)
  camera.setViewOffset(W, H, (c.x * W) / 2, (c.y * H) / 2, W, H)
}

// La sous-fenêtre qu'une tuile DOIT découper dans la fenêtre de l'acheteur.
// C'est la vérité géométrique du pavage : la tuile est un rectangle de pixels
// dans l'image pleine, donc un rectangle proportionnel dans ce que l'acheteur
// a cadré.
function attendueDansAcheteur(base, tuile, pleine) {
  const [Wp, Hp] = pleine
  const larg = base.droite - base.gauche
  const haut = base.haut - base.bas
  return {
    gauche: base.gauche + (tuile.x / Wp) * larg,
    droite: base.gauche + ((tuile.x + tuile.w) / Wp) * larg,
    haut: base.haut - (tuile.y / Hp) * haut,
    bas: base.haut - ((tuile.y + tuile.h) / Hp) * haut,
  }
}

// ── LE DÉFAUT, MONTRÉ ───────────────────────────────────────────────────────

test('LE DÉFAUT : deux appels à la suite, le pavage efface le cadrage de l’acheteur', () => {
  const cadrage = { x: 0.4, y: -0.25 }
  const plan = planTuiles(PLEINE, 4096)
  assert.equal(plan.colonnes, 3, 'un vrai pavage à deux dimensions, pas des bandes')
  assert.equal(plan.lignes, 2)

  // Ce que l'acheteur a validé.
  const ref = cameraAffiche()
  acheteurSeulHistorique(ref, cadrage, ASPECT)
  const base = fenetre(ref)

  // La séquence naïve : on cadre, PUIS on pave.
  const cam = cameraAffiche()
  acheteurSeulHistorique(cam, cadrage, ASPECT)
  const t = plan.tuiles[0]
  cam.setViewOffset(...Object.values(cadrageTuile(plan, t)))
  const rendue = fenetre(cam)

  const voulue = attendueDansAcheteur(base, t, PLEINE)
  // Le décalage de l'acheteur a disparu : la tuile est découpée dans une image
  // RECENTRÉE. L'écart n'est pas un arrondi — c'est un tiers d'affiche.
  assert.ok(
    Math.abs(rendue.gauche - voulue.gauche) > 0.01,
    'ce test doit ÉCHOUER tant que les deux appels sont empilés — s’il passe, la démonstration est morte'
  )
  // …et ce qu'on obtient à la place, c'est très exactement la tuile d'une
  // affiche jamais cadrée.
  const nu = cameraAffiche()
  nu.setViewOffset(...Object.values(cadrageTuile(plan, t)))
  memeFenetre(rendue, fenetre(nu), 'le second appel rend la tuile d’une affiche non cadrée')
})

// ── LA COMPOSITION ──────────────────────────────────────────────────────────

// Ce que l'acheteur VOIT dans l'aperçu : le cadrage seul, passé par le module.
// C'est la seule référence légitime pour le pavage — le tirage doit être ce
// qu'il a validé, pas ce qu'un autre chemin de code aurait calculé.
function apercuAcheteur(cadrage, zoom = 1) {
  const cam = cameraAffiche(zoom)
  const d = composeDecalage({ ...cadrage, aspect: ASPECT }, null)
  if (d) cam.setViewOffset(d.fullWidth, d.fullHeight, d.offsetX, d.offsetY, d.width, d.height)
  else cam.clearViewOffset()
  return cam
}

test('composeDecalage porte les DEUX décalages en un seul appel, sur tout le pavage', () => {
  const cadrage = { x: 0.4, y: -0.25 }
  const plan = planTuiles(PLEINE, 4096)

  const base = fenetre(apercuAcheteur(cadrage))

  for (const t of plan.tuiles) {
    const cam = cameraAffiche()
    const d = composeDecalage({ ...cadrage, aspect: ASPECT }, cadrageTuile(plan, t))
    cam.setViewOffset(d.fullWidth, d.fullHeight, d.offsetX, d.offsetY, d.width, d.height)
    memeFenetre(fenetre(cam), attendueDansAcheteur(base, t, PLEINE), `tuile ${t.i},${t.j}`)
  }
})

test('MUTATION — un test meurt si le décalage de l’ACHETEUR est ignoré', () => {
  const cadrage = { x: 0.4, y: -0.25 }
  const plan = planTuiles(PLEINE, 4096)
  const t = plan.tuiles[3]

  const juste = composeDecalage({ ...cadrage, aspect: ASPECT }, cadrageTuile(plan, t))
  // La mutation : composer avec un acheteur au repos, c'est-à-dire l'oublier.
  const mute = composeDecalage({ x: 0, y: 0, aspect: ASPECT }, cadrageTuile(plan, t))

  const a = cameraAffiche(); a.setViewOffset(juste.fullWidth, juste.fullHeight, juste.offsetX, juste.offsetY, juste.width, juste.height)
  const b = cameraAffiche(); b.setViewOffset(mute.fullWidth, mute.fullHeight, mute.offsetX, mute.offsetY, mute.width, mute.height)
  const fa = fenetre(a)
  const fb = fenetre(b)
  assert.ok(Math.abs(fa.gauche - fb.gauche) > 0.01, 'oublier le pouce de l’acheteur doit se voir en x')
  assert.ok(Math.abs(fa.haut - fb.haut) > 0.01, 'oublier le pouce de l’acheteur doit se voir en y')
  // …et l'écart vaut exactement une demi-image par unité de cadrage.
  const largeurPleine = (fenetre(cameraAffiche()).droite - fenetre(cameraAffiche()).gauche)
  proche(fa.gauche - fb.gauche, (cadrage.x / 2) * largeurPleine, 'x : une demi-image par unité', 1e-9)
})

test('MUTATION — un test meurt si le décalage de la TUILE est ignoré', () => {
  const cadrage = { x: 0.4, y: -0.25 }
  const plan = planTuiles(PLEINE, 4096)
  const t = plan.tuiles[3] // colonne 0, ligne 1 : x = 0, y ≠ 0
  const t2 = plan.tuiles[1] // colonne 1, ligne 0 : x ≠ 0, y = 0

  for (const tuile of [t, t2]) {
    const juste = composeDecalage({ ...cadrage, aspect: ASPECT }, cadrageTuile(plan, tuile))
    // La mutation : garder la TAILLE de la tuile mais oublier sa POSITION —
    // c'est le raté qui empile N fois le même coin de l'affiche.
    const c = cadrageTuile(plan, tuile)
    const mute = composeDecalage({ ...cadrage, aspect: ASPECT }, { ...c, offsetX: 0, offsetY: 0 })
    const a = cameraAffiche(); a.setViewOffset(juste.fullWidth, juste.fullHeight, juste.offsetX, juste.offsetY, juste.width, juste.height)
    const b = cameraAffiche(); b.setViewOffset(mute.fullWidth, mute.fullHeight, mute.offsetX, mute.offsetY, mute.width, mute.height)
    const fa = fenetre(a)
    const fb = fenetre(b)
    const ecart = Math.abs(fa.gauche - fb.gauche) + Math.abs(fa.haut - fb.haut)
    assert.ok(ecart > 0.01, `oublier la position de la tuile ${tuile.i},${tuile.j} doit se voir`)
  }
})

// ── LA CONTRAINTE QUI PROTÈGE L'APERÇU À L'ÉCRAN ───────────────────────────

test('une seule tuile couvrant l’affiche rend EXACTEMENT l’aperçu de l’acheteur', () => {
  for (const cadrage of [{ x: 0.4, y: -0.25 }, { x: 0, y: 0 }, { x: -1.3, y: 0.7 }]) {
    const plan = planTuiles(PLEINE, 100000) // une tuile, toute l'affiche
    assert.equal(plan.tuiles.length, 1)

    const cam = cameraAffiche(1.7)
    const d = composeDecalage({ ...cadrage, aspect: ASPECT }, cadrageTuile(plan, plan.tuiles[0]))
    if (d) cam.setViewOffset(d.fullWidth, d.fullHeight, d.offsetX, d.offsetY, d.width, d.height)
    else cam.clearViewOffset()

    memeFenetre(fenetre(cam), fenetre(apercuAcheteur(cadrage, 1.7)), `cadrage ${cadrage.x}/${cadrage.y}`, 1e-12)
    proche(cam.aspect, ASPECT, 'l’aspect de l’affiche survit à la tuile', 1e-15)
  }
})

// ⚠️ LE PIÈGE : setViewOffset ÉCRASE camera.aspect (`this.aspect = fullWidth /
// fullHeight`, première ligne de la méthode). Le cadre de référence n'est donc
// pas neutre — et celui de `cadrerAffiche`, dont la hauteur était ARRONDIE, ne
// valait le rapport de l'affiche qu'à l'arrondi près.
test('le cadre du module rend l’aspect de l’affiche intact — l’ancien l’étirait', () => {
  const ancien = cameraAffiche()
  acheteurSeulHistorique(ancien, { x: 0.4, y: 0 }, ASPECT)
  assert.notEqual(ancien.aspect, ASPECT, 'la hauteur arrondie changeait bien l’aspect')
  const dérive = Math.abs(ancien.aspect - ASPECT) / ASPECT
  assert.ok(dérive > 1e-6 && dérive < 1e-4, `dérive historique ${dérive}`)

  const cam = apercuAcheteur({ x: 0.4, y: 0 })
  assert.equal(cam.aspect, ASPECT, 'sans arrondi, l’aspect posé survit exactement')
})

// L'aperçu à l'écran passe par le même chemin : il ne doit pas bouger sous les
// yeux de l'acheteur. Il ne bouge pas — sauf de la dérive d'aspect corrigée
// ci-dessus, et ce test dit EXACTEMENT ce qu'elle vaut plutôt que de la couvrir
// d'une tolérance molle.
test('l’aperçu à l’écran ne bouge que de la dérive d’aspect corrigée, et rien d’autre', () => {
  for (const cadrage of [{ x: 0.4, y: -0.25 }, { x: -1.3, y: 0.7 }, { x: 0, y: 2 }]) {
    const ancien = cameraAffiche()
    acheteurSeulHistorique(ancien, cadrage, ASPECT)
    const a = fenetre(ancien)
    const b = fenetre(apercuAcheteur(cadrage))

    // En VERTICAL, rien ne change : la hauteur du frustum ne dépend pas du
    // cadre de référence, et la fraction y/2 se simplifiait déjà exactement.
    proche(a.haut, b.haut, 'haut', 1e-12)
    proche(a.bas, b.bas, 'bas', 1e-12)
    // En HORIZONTAL, l'écart est une homothétie pure de rapport connu : l'ancien
    // aspect sur le nouveau. Pas un déplacement, pas un recadrage — un
    // étirement de 0,003 %, celui que l'arrondi introduisait.
    const rapport = ancien.aspect / ASPECT
    for (const cle of ['gauche', 'droite']) {
      proche(a[cle], b[cle] * rapport, `${cle} : homothétie exacte`, 1e-12)
    }
    // Et ce que ça pèse pour l'œil, en pixels d'affiche.
    const px = (v) => Math.abs((v / (a.droite - a.gauche)) * PLEINE[0])
    for (const cle of ['gauche', 'droite']) {
      assert.ok(px(a[cle] - b[cle]) < 0.5, `${cle} : ${px(a[cle] - b[cle]).toFixed(3)} px`)
    }
  }
})

test('aucun décalage nulle part rend `null` — donc clearViewOffset, comme avant', () => {
  assert.equal(composeDecalage({ x: 0, y: 0, aspect: ASPECT }, null), null)
  const plan = planTuiles(PLEINE, 100000)
  assert.equal(composeDecalage({ x: 0, y: 0, aspect: ASPECT }, cadrageTuile(plan, plan.tuiles[0])), null)
  // …mais une tuile parmi d'autres n'est JAMAIS l'identité, même sans cadrage.
  const pave = planTuiles(PLEINE, 4096)
  assert.notEqual(composeDecalage({ x: 0, y: 0, aspect: ASPECT }, cadrageTuile(pave, pave.tuiles[0])), null)
})

// ── LES ENTRÉES ABSURDES ────────────────────────────────────────────────────

test('un cadrage non numérique ne fabrique pas un NaN dans la matrice', () => {
  const d = composeDecalage({ x: NaN, y: undefined, aspect: ASPECT }, null)
  assert.equal(d, null)
  const plan = planTuiles(PLEINE, 4096)
  const e = composeDecalage({ x: 'oui', y: null, aspect: ASPECT }, cadrageTuile(plan, plan.tuiles[2]))
  for (const v of Object.values(e)) assert.ok(Number.isFinite(v), `${v} n’est pas fini`)
})

test('un aspect absurde ne rend pas une hauteur nulle ou infinie', () => {
  for (const aspect of [0, -3, NaN, Infinity]) {
    const d = composeDecalage({ x: 0.5, y: 0.5, aspect }, null)
    assert.ok(d.fullHeight > 0 && Number.isFinite(d.fullHeight), `aspect ${aspect}`)
    assert.ok(Number.isFinite(d.offsetY))
  }
})

// ── LE BRANCHEMENT : UN SEUL APPEL, JAMAIS DEUX ─────────────────────────────

test('cadrerAffiche (main.js) pose son décalage PAR le module, et une seule fois', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const debut = src.indexOf('function cadrerAffiche(')
  assert.ok(debut > 0, 'cadrerAffiche a été renommée : ce garde ne garde plus rien')
  const fin = src.indexOf('\nfunction ', debut + 10)
  const corps = src.slice(debut, fin)

  assert.ok(corps.includes('composeDecalage('), 'le décalage doit passer par le module composé')
  assert.ok(src.includes("from './export-cadrage.js'"), 'le module doit être importé')
  // Le seul setViewOffset admis dans cadrerAffiche est celui du `restaurer`,
  // qui remet la vue SAUVEGARDÉE — il ne compose rien.
  const appels = corps.match(/setViewOffset\(/g) || []
  assert.equal(appels.length, 2, 'un pour restaurer l’état d’avant, un pour poser le décalage composé')
  assert.ok(!corps.includes('const W = 10000'), 'le cadre virtuel a déménagé dans le module')
})
