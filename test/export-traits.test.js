// L'ÉPAISSEUR DES TRAITS QUAND L'AFFICHE SE PAVE.
//
// ⚠️ LE TEST QUI COMPTE PLUS QUE LES AUTRES est le dernier bloc : « l'aperçu et
// le tirage montrent EXACTEMENT la même épaisseur relative ». Tout ce chantier
// existe pour que l'écran ne mente pas sur le fichier ; une épaisseur juste au
// tirage et fausse à l'aperçu serait une correction pour rien, puisque
// l'acheteur valide ce qu'il voit.
//
// Le second en importance est la non-régression : après un export, l'affichage
// normal doit retrouver EXACTEMENT ses valeurs. Une restauration ratée abîmerait
// la carte de quelqu'un qui n'a rien demandé — pire que le défaut corrigé.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  POINTS_PAR_POUCE,
  EPAISSEUR_MIN_PT,
  EPAISSEUR_MIN_MM,
  plancherEpaisseurPx,
  dpiEffectif,
  epaisseurRelative,
  epaisseurExport,
  materiauxDeLigne,
  reglerTraits,
} from '../src/export-traits.js'
import { MM_PAR_POUCE, DPI_IMPRESSION, geometriePage, planTuiles } from '../src/print-page.js'
import { DPI_NOMINAL } from '../src/export-dpi.js'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')

// ═══════════════════════════════════════════════════════════════════════════
// LE BANC : un LineMaterial de papier, et la formule du vrai shader
// ═══════════════════════════════════════════════════════════════════════════

const vecteur2 = (x, y) => ({
  x, y,
  set(a, b) { this.x = a; this.y = b; return this },
  copy(o) { this.x = o.x; this.y = o.y; return this },
})

const materiau = (linewidth, resX, resY) => ({
  isLineMaterial: true,
  linewidth,
  resolution: vecteur2(resX, resY),
})

// Un Object3D de papier : `traverse` est tout ce que `materiauxDeLigne` demande.
function noeud(material = null, enfants = []) {
  const n = { material, children: enfants }
  n.traverse = (f) => { f(n); for (const e of n.children) e.traverse(f) }
  return n
}

// ── L'ÉPAISSEUR RÉELLEMENT PEINTE, dérivée du shader lui-même ──────────────
//
// node_modules/three/examples/jsm/lines/LineMaterial.js, l. 148-228 :
//   dir.x *= aspect ; dir = normalize(dir) ; offset = (dir.y, -dir.x) ;
//   offset.x /= aspect ; offset *= linewidth ; offset /= resolution.y ;
//   clip.xy += offset · clip.w
// L'écart NDC total vaut donc 2·offset, et un écart NDC de 2 couvre la cible
// entière. D'où, en pixels de la cible :
const epaisseurVerticale = (m, cible) => (m.linewidth * cible.h) / m.resolution.y   // segment HORIZONTAL
const epaisseurHorizontale = (m, cible) => (m.linewidth * cible.w) / m.resolution.x // segment VERTICAL
// Le « peigne » : 1 = trait rond, tout le reste = trait plus fin dans un sens.
const anisotropie = (m, cible) => epaisseurVerticale(m, cible) / epaisseurHorizontale(m, cible)

const ECRAN = { w: 1920, h: 900 }

// ═══════════════════════════════════════════════════════════════════════════
// ① LE PEIGNE — pourquoi `resolution` DOIT suivre la tuile
// ═══════════════════════════════════════════════════════════════════════════

test('MUTATION « resolution non mise à jour » : sans elle le trait sort en peigne', () => {
  const geo = geometriePage({ format: '50x70', orientation: 'paysage' })
  const plan = planTuiles(geo.totalPx, 4096)
  const t = plan.tuiles[0]

  // Ce que faisait l'export avant : resolution figée sur la fenêtre.
  const avant = materiau(2, ECRAN.w, ECRAN.h)
  const peigne = anisotropie(avant, { w: t.w, h: t.h })
  assert.ok(Math.abs(peigne - 1) > 0.2, `le défaut doit être franc, anisotropie = ${peigne}`)

  // Et il vaut exactement aspect(resolution) / aspect(tuile) — la formule du
  // module, pas une observation.
  const attendu = (ECRAN.w / ECRAN.h) / (t.w / t.h)
  assert.ok(Math.abs(peigne - attendu) < 1e-12)

  // Le geste : resolution = la tuile. Le trait redevient rond, exactement.
  const { restaurer } = reglerTraits([avant], {
    tuile: { w: t.w, h: t.h }, hauteurTotalePx: geo.totalPx[1], hauteurMm: geo.hauteurMm,
  })
  assert.equal(avant.resolution.x, t.w)
  assert.equal(avant.resolution.y, t.h)
  assert.equal(anisotropie(avant, { w: t.w, h: t.h }), 1)
  restaurer()
})

test('le trait reste rond sur TOUTES les tuiles du damier, pas seulement la première', () => {
  const geo = geometriePage({ format: '61x91', orientation: 'portrait' })
  const plan = planTuiles(geo.totalPx, 2048)
  assert.ok(plan.colonnes > 1 && plan.lignes > 1, 'il faut un vrai damier pour que le test morde')
  for (const t of plan.tuiles) {
    const m = materiau(2, ECRAN.w, ECRAN.h)
    const r = reglerTraits([m], {
      tuile: { w: t.w, h: t.h }, hauteurTotalePx: geo.totalPx[1], hauteurMm: geo.hauteurMm,
    })
    assert.equal(anisotropie(m, { w: t.w, h: t.h }), 1, `tuile ${t.i},${t.j}`)
    r.restaurer()
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ② L'ÉCHELLE — un trait de 2 px fait 0,17 mm si on ne fait rien
// ═══════════════════════════════════════════════════════════════════════════

const mmPourPxRendu = (px, dpi) => (px / dpi) * MM_PAR_POUCE

test('MUTATION « épaisseur non mise à l’échelle » : le tracé s’évanouit sur le papier', () => {
  const geo = geometriePage({ format: '50x70', orientation: 'paysage' })
  const plan = planTuiles(geo.totalPx, 4096)
  const t = plan.tuiles[0]

  // Le chiffre du brief : resolution corrigée, épaisseur laissée telle quelle.
  const nu = materiau(2, ECRAN.w, ECRAN.h)
  nu.resolution.set(t.w, t.h)
  const sansEchelle = mmPourPxRendu(epaisseurVerticale(nu, { w: t.w, h: t.h }), DPI_IMPRESSION)
  assert.ok(sansEchelle < 0.2, `2 px à 300 dpi ≈ 0,17 mm, obtenu ${sansEchelle}`)

  // Avec les deux gestes : le trait retrouve sa place sur la feuille.
  const m = materiau(2, ECRAN.w, ECRAN.h)
  const r = reglerTraits([m], {
    tuile: { w: t.w, h: t.h }, hauteurTotalePx: geo.totalPx[1], hauteurMm: geo.hauteurMm,
  })
  const avec = mmPourPxRendu(epaisseurVerticale(m, { w: t.w, h: t.h }), DPI_IMPRESSION)
  assert.ok(avec > 1, `attendu > 1 mm, obtenu ${avec}`)
  // Et c'est bien la MÊME fraction de hauteur qu'à l'écran.
  assert.ok(Math.abs(m.linewidth - (2 / ECRAN.h) * geo.totalPx[1]) < 1e-9)
  r.restaurer()
})

test('MUTATION « hauteur de la tuile au lieu de l’affiche » : deux lignes de tuiles, traits deux fois trop fins', () => {
  const geo = geometriePage({ format: '61x91', orientation: 'portrait' })
  const plan = planTuiles(geo.totalPx, 2048)
  assert.ok(plan.lignes >= 2)
  const H = geo.totalPx[1]
  const attendu = (2 / ECRAN.h) * H
  for (const t of plan.tuiles) {
    const m = materiau(2, ECRAN.w, ECRAN.h)
    const r = reglerTraits([m], { tuile: { w: t.w, h: t.h }, hauteurTotalePx: H, hauteurMm: geo.hauteurMm })
    // L'épaisseur ne dépend PAS de la tuile : sinon deux tuiles voisines
    // livreraient deux épaisseurs, et le raccord se verrait au millimètre.
    assert.ok(Math.abs(m.linewidth - attendu) < 1e-9, `tuile ${t.i},${t.j} : ${m.linewidth} ≠ ${attendu}`)
    assert.ok(m.linewidth > (2 / ECRAN.h) * t.h, 'la hauteur de tuile donnerait un trait plus fin')
    r.restaurer()
  }
})

test('l’épaisseur relative se lit sur le matériau, donc un réglage utilisateur est suivi', () => {
  const H = 8268
  for (const largeurEcran of [1, 2, 4.8]) {
    const m = materiau(largeurEcran, ECRAN.w, ECRAN.h)
    const r = reglerTraits([m], { tuile: { w: 2048, h: 2048 }, hauteurTotalePx: H, hauteurMm: 700 })
    assert.ok(Math.abs(m.linewidth - (largeurEcran / ECRAN.h) * H) < 1e-9)
    r.restaurer()
  }
})

test('epaisseurRelative refuse les résolutions inutilisables au lieu de semer un NaN', () => {
  assert.equal(epaisseurRelative(2, 0), 0)
  assert.equal(epaisseurRelative(2, NaN), 0)
  assert.equal(epaisseurRelative(NaN, 900), 0)
  assert.equal(epaisseurRelative(2, 900), 2 / 900)
  // et le matériau retombe alors sur le plancher : fin, mais IMPRIMABLE
  const m = materiau(2, 0, 0)
  const r = reglerTraits([m], { tuile: { w: 2048, h: 2048 }, hauteurTotalePx: 8268, dpi: DPI_IMPRESSION })
  assert.ok(Number.isFinite(m.linewidth))
  assert.equal(m.linewidth, plancherEpaisseurPx(DPI_IMPRESSION))
  r.restaurer()
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ LE PLANCHER — 0,25 pt, et il ne se négocie pas
// ═══════════════════════════════════════════════════════════════════════════

test('le plancher vaut 0,25 pt, soit 0,088 mm', () => {
  assert.equal(EPAISSEUR_MIN_PT, 0.25)
  assert.equal(POINTS_PAR_POUCE, 72)
  assert.ok(Math.abs(EPAISSEUR_MIN_MM - 0.0882) < 1e-4, `obtenu ${EPAISSEUR_MIN_MM}`)
  // 300 dpi : un peu plus d'un pixel. C'est bien un plancher, pas un réglage.
  assert.ok(Math.abs(plancherEpaisseurPx(300) - 1.0417) < 1e-3)
  assert.equal(plancherEpaisseurPx(0), 0)
})

test('MUTATION « plancher supprimé » : aucune densité de la table nominale ne descend sous 0,088 mm', () => {
  const geo = geometriePage({ format: 'a4', orientation: 'portrait' })
  for (const dpi of new Set([...Object.values(DPI_NOMINAL ?? {}), 150, 200, 300].filter((d) => d > 0))) {
    // un trait volontairement ridicule : c'est le plancher, et lui seul, qui
    // doit le sauver
    const m = materiau(0.02, ECRAN.w, ECRAN.h)
    const r = reglerTraits([m], { tuile: { w: 1024, h: 1024 }, hauteurTotalePx: geo.totalPx[1], dpi })
    const mm = mmPourPxRendu(m.linewidth, dpi)
    assert.ok(mm >= EPAISSEUR_MIN_MM - 1e-9, `${dpi} dpi : ${mm} mm`)
    r.restaurer()
  }
})

test('le plancher ne PLAFONNE pas : un trait déjà épais n’est pas ramené vers lui', () => {
  assert.equal(epaisseurExport({ relative: 0.01, hauteurTotalePx: 8268, dpi: 300 }), 82.68)
  assert.equal(epaisseurExport({ relative: 0, hauteurTotalePx: 8268, dpi: 300 }), plancherEpaisseurPx(300))
})

test('dpiEffectif dit la densité RÉELLE, pas la densité supposée', () => {
  // une vignette de 1 000 px pour une affiche de 700 mm : 36 dpi, pas 300
  assert.ok(Math.abs(dpiEffectif(1000, 700) - 36.28) < 0.01)
  // une affiche rendue à sa taille de tirage retombe sur sa densité nominale
  const geo = geometriePage({ format: '50x70', orientation: 'portrait', fondPerduMm: 0 })
  assert.ok(Math.abs(dpiEffectif(geo.finiPx[1], geo.hauteurMm) - DPI_IMPRESSION) < 1)
  assert.equal(dpiEffectif(0, 700), 0)
  assert.equal(dpiEffectif(1000, 0), 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// ④ LE RECENSEMENT — une traversée, pas une liste
// ═══════════════════════════════════════════════════════════════════════════

test('materiauxDeLigne trouve les traits larges à n’importe quelle profondeur', () => {
  const a = materiau(1, 10, 10)
  const b = materiau(2, 10, 10)
  const racine = noeud(null, [
    noeud(a),
    noeud({ isMeshStandardMaterial: true }, [noeud(null, [noeud(b)])]),
  ])
  const trouves = materiauxDeLigne(racine)
  assert.equal(trouves.length, 2)
  assert.ok(trouves.includes(a) && trouves.includes(b))
})

test('materiauxDeLigne ignore ce qui n’est pas un trait large, et lit les tableaux de matériaux', () => {
  const a = materiau(1, 10, 10)
  const racine = noeud(null, [
    noeud([{ isMeshBasicMaterial: true }, a]),
    noeud({ isSpriteMaterial: true }),
    noeud(undefined),
    // un faux positif plausible : le drapeau sans la résolution
    noeud({ isLineMaterial: true, linewidth: 3 }),
  ])
  assert.deepEqual(materiauxDeLigne(racine), [a])
  assert.deepEqual(materiauxDeLigne(null), [])
  assert.deepEqual(materiauxDeLigne({}), [])
})

test('MUTATION « dédoublonnage retiré » : un matériau partagé n’est jamais restauré', () => {
  const partage = materiau(2, ECRAN.w, ECRAN.h)
  // le calque d'eau range plusieurs objets par lot : le même matériau revient
  const racine = noeud(null, [noeud(partage), noeud(partage), noeud(null, [noeud(partage)])])
  assert.equal(materiauxDeLigne(racine).length, 1)

  const r = reglerTraits(materiauxDeLigne(racine), {
    tuile: { w: 2048, h: 2048 }, hauteurTotalePx: 8268, hauteurMm: 700,
  })
  r.restaurer()
  assert.equal(partage.linewidth, 2)
  assert.equal(partage.resolution.x, ECRAN.w)
  assert.equal(partage.resolution.y, ECRAN.h)
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ LA NON-RÉGRESSION — l'affichage normal retrouve EXACTEMENT son état
// ═══════════════════════════════════════════════════════════════════════════

test('MUTATION « restauration omise » : après un export, l’écran retrouve exactement l’épaisseur d’avant', () => {
  // les trois familles réelles : le tracé, son halo, un lot de fleuves
  const etatInitial = [
    { linewidth: 2, x: ECRAN.w, y: ECRAN.h },     // lineMat
    { linewidth: 4.8, x: ECRAN.w, y: ECRAN.h },   // glowMat (× 2,4)
    { linewidth: 0.9, x: ECRAN.w, y: ECRAN.h },   // fleuve fin
    { linewidth: 3.5, x: ECRAN.w, y: ECRAN.h },   // fleuve principal
    { linewidth: 1.4, x: ECRAN.w, y: ECRAN.h },   // contour de lac
  ]
  const mats = etatInitial.map((e) => materiau(e.linewidth, e.x, e.y))
  const racine = noeud(null, mats.map((m) => noeud(m)))

  const r = reglerTraits(materiauxDeLigne(racine), {
    tuile: { w: 4096, h: 2048 }, hauteurTotalePx: 8268, hauteurMm: 700,
  })
  // pendant l'export, TOUT a bougé
  for (const m of mats) {
    assert.equal(m.resolution.x, 4096)
    assert.equal(m.resolution.y, 2048)
  }
  assert.ok(mats.every((m, i) => m.linewidth !== etatInitial[i].linewidth))

  r.restaurer()
  mats.forEach((m, i) => {
    assert.equal(m.linewidth, etatInitial[i].linewidth, `linewidth du matériau ${i}`)
    assert.equal(m.resolution.x, etatInitial[i].x)
    assert.equal(m.resolution.y, etatInitial[i].y)
  })
})

test('restaurer() est idempotente : deux appels ne réappliquent pas un état périmé', () => {
  const m = materiau(2, ECRAN.w, ECRAN.h)
  const r = reglerTraits([m], { tuile: { w: 2048, h: 2048 }, hauteurTotalePx: 8268, hauteurMm: 700 })
  r.restaurer()
  m.linewidth = 7 // un réglage utilisateur arrivé entre-temps
  r.restaurer()
  assert.equal(m.linewidth, 7, 'la seconde restauration ne doit rien écraser')
})

test('deux exports enchaînés ne dérivent pas (l’état d’après est celui d’avant)', () => {
  const m = materiau(2, ECRAN.w, ECRAN.h)
  for (let i = 0; i < 5; i++) {
    const r = reglerTraits([m], { tuile: { w: 2048, h: 3000 }, hauteurTotalePx: 8268, hauteurMm: 700 })
    r.restaurer()
  }
  assert.equal(m.linewidth, 2)
  assert.equal(m.resolution.x, ECRAN.w)
  assert.equal(m.resolution.y, ECRAN.h)
})

test('reglerTraits ne se casse pas sur une entrée vide ou absurde', () => {
  assert.equal(reglerTraits([], {}).materiaux, 0)
  assert.doesNotThrow(() => reglerTraits(null, undefined).restaurer())
  assert.doesNotThrow(() => reglerTraits([{}, null], { tuile: { w: 0, h: 0 } }).restaurer())
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ CE POUR QUOI TOUT LE CHANTIER EXISTE : l'aperçu ne ment plus
// ═══════════════════════════════════════════════════════════════════════════

// L'épaisseur EN MILLIMÈTRES SUR LE PAPIER : la seule grandeur que l'aperçu et
// le tirage puissent comparer sans convention cachée.
const mmSurLePapier = (m, cible, hauteurMm) =>
  (epaisseurVerticale(m, cible) / cible.h) * hauteurMm

test('MUTATION « aperçu à la densité du tirage » : aperçu et tirage donnent la MÊME épaisseur, au millimètre', () => {
  const APERCU_MAX_PX = 1400 // l'ordre de grandeur d'ui/affiche.js
  for (const format of ['a4', 'a3', '50x70', '61x91']) {
    for (const orientation of ['portrait', 'paysage']) {
      const geo = geometriePage({ format, orientation })
      const [W, H] = geo.finiPx
      const k = APERCU_MAX_PX / Math.max(W, H)
      const wA = Math.max(2, Math.round(W * k))
      const hA = Math.max(2, Math.round(H * k))
      const plan = planTuiles(geo.finiPx, 4096)

      // 0,02 px d'écran met le PLANCHER en jeu ; les autres non. Les deux
      // régimes doivent coïncider, sinon l'aperçu ment dans l'un des deux.
      for (const largeurEcran of [0.02, 0.9, 2, 3.5]) {
        // L'APERÇU : une seule « tuile », qui est l'image entière.
        const a = materiau(largeurEcran, ECRAN.w, ECRAN.h)
        const rA = reglerTraits([a], { tuile: { w: wA, h: hA }, hauteurTotalePx: hA, hauteurMm: geo.hauteurMm })
        const mmApercu = mmSurLePapier(a, { w: wA, h: hA }, geo.hauteurMm)
        rA.restaurer()

        // LE TIRAGE : une tuile parmi d'autres, sur l'affiche entière.
        // ⚠️ MÊME RECTANGLE DE RÉFÉRENCE QUE L'APERÇU (le format FINI) : c'est
        // la condition de l'égalité, et elle est écrite dans export-traits.js.
        const t = plan.tuiles[plan.tuiles.length - 1]
        const p = materiau(largeurEcran, ECRAN.w, ECRAN.h)
        const rP = reglerTraits([p], {
          tuile: { w: t.w, h: t.h }, hauteurTotalePx: geo.finiPx[1], hauteurMm: geo.hauteurMm,
        })
        const mmTirage = (p.linewidth / geo.finiPx[1]) * geo.hauteurMm
        rP.restaurer()

        assert.ok(
          Math.abs(mmApercu - mmTirage) < 1e-9,
          `${format} ${orientation} à ${largeurEcran} px : aperçu ${mmApercu} mm ≠ tirage ${mmTirage} mm`
        )
        assert.ok(mmTirage >= EPAISSEUR_MIN_MM - 1e-9)
      }
    }
  }
})

test('MUTATION « pixels avec fond perdu, millimètres sans » : l’appariement incohérent se voit', () => {
  const geo = geometriePage({ format: '50x70', orientation: 'portrait' })
  const juste = materiau(0.02, ECRAN.w, ECRAN.h)
  const faux = materiau(0.02, ECRAN.w, ECRAN.h)
  reglerTraits([juste], { tuile: { w: 2048, h: 2048 }, hauteurTotalePx: geo.finiPx[1], hauteurMm: geo.hauteurMm })
  reglerTraits([faux], { tuile: { w: 2048, h: 2048 }, hauteurTotalePx: geo.totalPx[1], hauteurMm: geo.hauteurMm })
  // le plancher est en jeu : la densité déduite change, donc l'épaisseur aussi
  assert.notEqual(juste.linewidth, faux.linewidth)
  // l'écart est exactement celui du fond perdu : 0,86 % sur un 50 × 70
  assert.ok(Math.abs(faux.linewidth / juste.linewidth - geo.totalPx[1] / geo.finiPx[1]) < 1e-9)
  assert.ok(Math.abs(faux.linewidth / juste.linewidth - 1) > 0.008)
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ LE CÂBLAGE, LU DANS LA SOURCE (aucun test ne charge src/main.js)
// ═══════════════════════════════════════════════════════════════════════════

const fichiersSrc = (dir = 'src') => {
  const out = []
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...fichiersSrc(rel))
    else if (e.name.endsWith('.js')) out.push(rel)
  }
  return out
}

test('RECENSEMENT : tout `new LineMaterial(` de src/ est connu et vit sous la scène', () => {
  // Le recensement de la tâche 5. Une entrée nouvelle doit faire ROUGIR ce
  // test, pas se glisser en silence : un matériau qui n'est pas sous `scene`
  // échapperait à la traversée de `reglerTraitsAffiche` et sortirait en peigne.
  const attendu = { 'src/gpx.js': 2, 'src/map/line-segments.js': 1 }
  const trouve = {}
  for (const f of fichiersSrc()) {
    const n = (lire(f).match(/new LineMaterial\(/g) || []).length
    if (n) trouve[f] = n
  }
  assert.deepEqual(trouve, attendu,
    'un LineMaterial est apparu (ou a disparu) : vérifier qu’il est accroché à la scène, '
    + 'puis mettre ce recensement à jour — voir tache-5-rapport.md')
})

test('MUTATION « resolution relue depuis window » : les deux calques gardent leur propre résolution', () => {
  for (const f of ['src/gpx.js', 'src/map/water-layer.js']) {
    const s = lire(f)
    assert.ok(/this\._resolution\s*=\s*new THREE\.Vector2\(/.test(s), `${f} : pas de résolution mémorisée`)
    assert.ok(/onResize\s*\([^)]*\)\s*\{[\s\S]{0,200}this\._resolution\.set\(/.test(s),
      `${f} : onResize ne tient pas la résolution mémorisée à jour`)
  }
  // et plus aucune construction de trait large ne relit la fenêtre
  assert.ok(!/resolution\.set\(window\.innerWidth/.test(lire('src/gpx.js')))
  assert.ok(!/new THREE\.Vector2\(window\.innerWidth, window\.innerHeight\)\s*\n?\s*const ink/.test(lire('src/map/water-layer.js')))
  assert.ok(/const resolution = this\._resolution/.test(lire('src/map/water-layer.js')))
  // le gestionnaire de calques délègue au calque, qui seul connaît le miroir
  assert.ok(/l\.onResize\?\.\(w, h\)/.test(lire('src/map/layer-manager.js')))
})

test('MUTATION « restauration omise dans main.js » : le rendu d’affiche règle ET rend les traits', () => {
  const s = lire('src/main.js')
  assert.ok(/import \{ materiauxDeLigne, reglerTraits \} from '\.\/export-traits\.js'/.test(s))
  assert.ok(/function reglerTraitsAffiche\(/.test(s), 'le réglage d’affiche a disparu')
  // l'aperçu l'appelle, avec la taille RÉELLEMENT peinte…
  const apercu = s.slice(s.indexOf('rendreApercu: async'), s.indexOf('rendreApercu: async') + 1800)
  assert.ok(/tailleSousPlafond\(renderer, largeur, hauteur\)/.test(apercu),
    'l’aperçu doit régler les traits sur la taille servie au compositeur, pas sur la demande')
  assert.ok(/reglerTraitsAffiche\(\{ tuile: \{ w, h \}/.test(apercu))
  // …et le rend dans un `finally`, avant le cadrage
  assert.ok(/finally \{\s*traits\.restaurer\(\)\s*\n\s*rendu\.restaurer\(\)/.test(apercu),
    'traits.restaurer() doit être dans le finally de l’aperçu')
})

test('la géométrie de page fournit bien la hauteur physique que l’aperçu transmet', () => {
  assert.ok(/hauteurMm: geo\.hauteurMm/.test(lire('src/ui/affiche.js')),
    'sans hauteurMm, l’aperçu retombe sur la densité du tirage et s’épaissit à tort')
  assert.ok(Number.isFinite(geometriePage({ format: 'a4' }).hauteurMm))
})
