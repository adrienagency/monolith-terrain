// L'INTERRUPTEUR DU BISEAU — BIS, 2026-09-05.
//
// > **Adrien, 2026-09-05** : *« Jupe de la mer non ok, je pense qu'il y a un
// > problème avec les biseaux de bords. Pour l'instant on peut les supprimer
// > pour éviter la problématique. »* — *« On va retirer le retrait du biseau
// > qui pose plus de problèmes qu'autre chose. »*
//
// Ce fichier tient les DEUX régimes dans le MÊME processus : le défaut ÉTEINT
// (arête vive, socle = emprise du relief, mer à la marge seule) et le RALLUMÉ
// (le dépôt d'avant, au bit près). Les tests du régime allumé (`crop-parois`,
// `mer-sphere`, `socle-matiere`, `damier-bords`, …) lèvent `FLAGS.biseauSocle`
// en tête de fichier ; ici on le bascule test par test, et on le REPOSE.
//
// ⚠️ **PROUVÉ PAR MUTATION** (rapport BIS §5) : chaque assertion ci-dessous a
// rougi sur au moins une mutation de `src/` seul.
import test from 'node:test'
import assert from 'node:assert/strict'
import { FLAGS, biseauSocleActif } from '../src/flags.js'
import {
  construireSolideCrop,
  fractionChanfreinCrop,
  fractionArrondiCrop,
  FRACTION_CHANFREIN,
  FRACTION_ARRONDI,
  BANDE_JUPE_MUR,
} from '../src/monde/parois-crop.js'
import {
  retraitEauCrop,
  bordDeMer,
  construireJupeMer,
  RETRAIT_EAU_CROP,
  MARGE_EAU_CROP,
} from '../src/monde/mer-sphere.js'
import {
  chanfreinSocle,
  arrondiSocle,
  rayonMurSocle,
  rayonEauDansSocle,
  rayonCoinEau,
  buildSlabWalls,
  computeSlab,
  SOCLE_CHANFREIN,
  SOCLE_ARRONDI,
  SOCLE_MARGE_EAU,
} from '../src/plinth.js'
import { repereCrop, coinNormalise } from '../src/monde/crop-sphere.js'
import { exposantCoin } from '../src/fenetre-clip.js'
import { Globe } from '../src/globe.js'
import { tileToLatLon } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const HALF = TERRAIN_SIZE / 2

/** Bascule le drapeau le temps d'un appel, et le repose quoi qu'il arrive. */
function avecBiseau(v, f) {
  const avant = FLAGS.biseauSocle
  FLAGS.biseauSocle = v
  try { return f() } finally { FLAGS.biseauSocle = avant }
}

// Le banc de `crop-parois.test.js`, mot pour mot : les réglages produit.
const CORNER = 0.04 * 56
const EXPO = exposantCoin(0.6)
const COIN = coinNormalise(CORNER, 28)
const RAYON = 100
const ECHELLE = (RAYON / 6371000) * 18
const CENTRE = { lat: 45, lon: 6.25 }
const REPERE = repereCrop({ centre: CENTRE })
const FORME = { coin: COIN, expo: EXPO }
const relief = (lat, lon) =>
  1200 + 900 * Math.sin((lon - CENTRE.lon) * 700) + 700 * Math.cos((lat - CENTRE.lat) * 820)
const commun = { repere: REPERE, forme: FORME, rayon: RAYON, echelle: ECHELLE, hauteur: relief }

/** Deux solides sont-ils identiques au bit près (positions, normales, champs) ? */
function memeSolide(a, b) {
  for (const champ of ['positions', 'normales']) {
    if (a[champ].length !== b[champ].length) return `${champ} : ${a[champ].length} ≠ ${b[champ].length} sommets`
    for (let k = 0; k < a[champ].length; k++) {
      if (!Object.is(a[champ][k], b[champ][k])) return `${champ}[${k}] : ${a[champ][k]} ≠ ${b[champ][k]}`
    }
  }
  for (const champ of ['chanfrein', 'arrondi', 'rangs', 'baseY', 'largeur', 'retraitJupe']) {
    if (!Object.is(a[champ], b[champ])) return `${champ} : ${a[champ]} ≠ ${b[champ]}`
  }
  return null
}

// ══════════ ① LE DRAPEAU : ÉTEINT PAR DÉFAUT, ET L'ADRESSE LE BASCULE ═════════

test('① `biseauSocle` est ÉTEINT par défaut — c est la décision d Adrien, pas une prudence', () => {
  assert.equal(FLAGS.biseauSocle, false)
  assert.equal(biseauSocleActif(), false)
  assert.equal(biseauSocleActif('?biseau=1'), true, '`?biseau=1` rallume')
  assert.equal(biseauSocleActif('?biseau=on'), true)
  assert.equal(biseauSocleActif('?biseau=0'), false)
  assert.equal(biseauSocleActif('?biseau=vif'), false)
  // les deux branches contre le défaut CONTRAIRE : une branche ne mord jamais
  // contre le défaut qui lui donne déjà raison
  avecBiseau(true, () => {
    assert.equal(biseauSocleActif(), true)
    assert.equal(biseauSocleActif('?biseau=0'), false, '`?biseau=0` coupe même rallumé')
  })
})

// ══════════ ② LES LECTURES APPLIQUÉES : 0 ÉTEINT, LES RÉGLAGES ALLUMÉ ════════

test('② les quatre lectures rendent 0 éteint, et les constantes allumé', () => {
  assert.equal(fractionChanfreinCrop(), 0)
  assert.equal(fractionArrondiCrop(), 0)
  assert.equal(chanfreinSocle(), 0)
  assert.equal(arrondiSocle(), 0)
  avecBiseau(true, () => {
    assert.equal(fractionChanfreinCrop(), FRACTION_CHANFREIN)
    assert.equal(fractionArrondiCrop(), FRACTION_ARRONDI)
    assert.equal(chanfreinSocle(), SOCLE_CHANFREIN)
    assert.equal(arrondiSocle(), SOCLE_ARRONDI)
  })
  // et l'argument explicite l'emporte sur le drapeau, dans les deux sens
  assert.equal(fractionChanfreinCrop(true), FRACTION_CHANFREIN)
  assert.equal(chanfreinSocle(true), SOCLE_CHANFREIN)
  avecBiseau(true, () => {
    assert.equal(fractionArrondiCrop(false), 0)
    assert.equal(arrondiSocle(false), 0)
  })
})

// ══════════ ③ LE SOLIDE DU CROP : ARÊTE VIVE, SOCLE = EMPRISE DU RELIEF ══════

test('③ éteint, le solide du crop est à arête VIVE et son empreinte est EXACTEMENT celle du relief', () => {
  const s = construireSolideCrop(commun)
  assert.equal(s.chanfrein, 0)
  assert.equal(s.arrondi, 0)
  assert.equal(s.rangs, 3, 'sans chanfrein ni congé, trois rangs : surface, bande, fond')
  // ⚡ LE MUR EST À `d = 0` SUR TOUTE SA HAUTEUR : chaque rang a l'empreinte
  // horizontale du rang de surface, au bit près (x et z locaux). C'est le
  // « socle = 56 u pour 56 u de relief » du brief, mesuré sur la géométrie.
  const n = s.anneau.length
  const P = s.positions
  let pire = 0
  for (const r of [1, 2]) {
    for (let k = 0; k < n; k++) {
      const dx = Math.abs(P[(r * n + k) * 3] - P[k * 3])
      const dz = Math.abs(P[(r * n + k) * 3 + 2] - P[k * 3 + 2])
      pire = Math.max(pire, dx, dz)
    }
  }
  assert.equal(pire, 0, `le mur rentre encore de ${pire} sous la surface`)
  // et la bande de P14 tient : sans chanfrein on coupe encore les jupes de bord
  assert.equal(s.retraitJupe, BANDE_JUPE_MUR)
  assert.ok(s.retraitJupe > 0)
  // le témoin : allumé, le fond RENTRE de chanfrein + congé, en unités monde
  const b = avecBiseau(true, () => construireSolideCrop(commun))
  assert.ok(b.chanfrein > 0 && b.arrondi > 0)
  assert.ok(b.rangs > 3)
  const attendu = b.chanfrein + b.arrondi
  const nb = b.anneau.length
  const Q = b.positions
  const fond = b.rangs - 1
  // ⚠️ le déplacement se fait sur la BISSECTRICE, allongée de l'onglet
  // (1/cos(θ/2), borné à 1/0,35) : sur un côté droit il vaut exactement
  // `attendu`, dans un coin il est plus long — jamais plus court.
  let dMin = Infinity, dMax = 0
  for (let k = 0; k < nb; k++) {
    const d = Math.hypot(Q[(fond * nb + k) * 3] - Q[k * 3], Q[(fond * nb + k) * 3 + 2] - Q[k * 3 + 2])
    dMin = Math.min(dMin, d); dMax = Math.max(dMax, d)
  }
  // (positions en Float32 : tolérance relative, pas absolue)
  assert.ok(dMin > attendu * (1 - 1e-4), `allumé, le fond doit rentrer d au moins ${attendu} : ${dMin}`)
  assert.ok(dMax <= attendu / 0.35 + 1e-9, `l onglet est borné : ${dMax}`)
})

test('③ bis RALLUMÉ, le solide est celui d avant AU BIT PRÈS — et éteint, celui des fractions nulles', () => {
  const allume = avecBiseau(true, () => construireSolideCrop(commun))
  const explicite = construireSolideCrop({ ...commun, fractionChanfrein: FRACTION_CHANFREIN, fractionArrondi: FRACTION_ARRONDI })
  assert.equal(memeSolide(allume, explicite), null, 'rallumé ≠ fractions explicites')
  const eteint = construireSolideCrop(commun)
  const vif = construireSolideCrop({ ...commun, fractionChanfrein: 0, fractionArrondi: 0 })
  assert.equal(memeSolide(eteint, vif), null, 'éteint ≠ fractions nulles')
  // et les deux régimes diffèrent bel et bien : sinon le drapeau ne pilote rien
  assert.notEqual(memeSolide(allume, eteint), null, 'allumé et éteint rendent le même solide')
})

// ══════════ ④ LA MER : LA MARGE SEULE ÉTEINT, CHANFREIN + MARGE ALLUMÉ ═══════

test('④ éteint, la nappe et le rideau ne rentrent que de la MARGE — jamais de zéro', () => {
  assert.equal(retraitEauCrop(), MARGE_EAU_CROP)
  assert.ok(MARGE_EAU_CROP > 0, 'la marge est strictement positive : pas de rideau dans le plan du mur')
  assert.ok(Math.abs(MARGE_EAU_CROP - SOCLE_MARGE_EAU / 28) < 1e-15, 'la marge est celle de plinth.js, en demi-côtés')
  const b = bordDeMer()
  assert.equal(b.fin, -MARGE_EAU_CROP, 'la mer s éteint à la marge, DEDANS')
  assert.equal(b.debut, -2 * MARGE_EAU_CROP)
  assert.ok(b.fin - b.debut > 0, 'la bande de fondu reste strictement positive (smoothstep défini)')
  avecBiseau(true, () => {
    assert.equal(retraitEauCrop(), RETRAIT_EAU_CROP)
    const ba = bordDeMer()
    assert.equal(ba.fin, -RETRAIT_EAU_CROP)
    assert.equal(ba.debut, -2 * RETRAIT_EAU_CROP)
  })
  assert.ok(RETRAIT_EAU_CROP > MARGE_EAU_CROP, 'le retrait allumé contient la marge et le chanfrein')
})

test('④ bis le rideau d eau suit la même lecture — rallumé, il est celui d avant au bit près', () => {
  const arg = { repere: REPERE, rayon: RAYON, forme: FORME, basY: -0.02 }
  const eteint = construireJupeMer(arg)
  const marge = construireJupeMer({ ...arg, retrait: MARGE_EAU_CROP })
  assert.deepEqual(Array.from(eteint.positions), Array.from(marge.positions), 'éteint ≠ retrait = marge')
  const allume = avecBiseau(true, () => construireJupeMer(arg))
  const plein = construireJupeMer({ ...arg, retrait: RETRAIT_EAU_CROP })
  assert.deepEqual(Array.from(allume.positions), Array.from(plein.positions), 'rallumé ≠ RETRAIT_EAU_CROP')
  // et les deux ne se confondent pas : le haut du rideau est PLUS LOIN du centre éteint
  const n = eteint.compte?.anneau ?? eteint.positions.length / 6
  let rE = 0, rA = 0
  for (let i = 0; i < n; i++) {
    rE += Math.hypot(eteint.positions[i * 3], eteint.positions[i * 3 + 2])
    rA += Math.hypot(allume.positions[i * 3], allume.positions[i * 3 + 2])
  }
  assert.ok(rE > rA, `éteint, le rideau doit être plus près de l arête (${rE / n} contre ${rA / n})`)
})

// ══════════ ⑤ LE SOCLE DU MODE PLAT : MUR À HALF, EAU À HALF − MARGE ═════════

test('⑤ éteint, le mur du socle plat est au bord du bloc et l eau à la marge ; rallumé, le dépôt d avant', () => {
  assert.equal(rayonMurSocle(), HALF)
  assert.equal(rayonEauDansSocle(), HALF - SOCLE_MARGE_EAU)
  assert.equal(rayonCoinEau(2), 2 - SOCLE_MARGE_EAU)
  avecBiseau(true, () => {
    assert.equal(rayonMurSocle(), HALF - SOCLE_CHANFREIN)
    assert.equal(rayonEauDansSocle(), HALF - SOCLE_CHANFREIN - SOCLE_MARGE_EAU)
    assert.equal(rayonCoinEau(2), 2 - SOCLE_CHANFREIN - SOCLE_MARGE_EAU)
  })
  // la géométrie du mur : sans biseau, cinq faces par point d'anneau (2 murs,
  // 2 bande, 1 fond) ; allumé, onze (le compte de `socle-matiere.test.js`)
  const plat = () => 3
  const n = computeSlab(plat, 7, 16).ring.length
  const tri = (o) => buildSlabWalls(plat, { resolution: 16, ...o }).geo.getAttribute('position').count / 3
  assert.equal(tri({}), n * 5, 'éteint : le socle nu')
  assert.equal(tri({}), tri({ chanfrein: 0, arrondi: 0 }))
  avecBiseau(true, () => {
    assert.equal(tri({}), n * 11, 'rallumé : chanfrein + congé à 3 segments')
    assert.equal(tri({}), tri({ chanfrein: SOCLE_CHANFREIN, arrondi: SOCLE_ARRONDI }))
  })
})

// ══════════ ⑥ `globe.js` : CE QUE LES PAROIS PUBLIENT, ÉTEINT ═══════════════

test('⑥ éteint, `construireParoisCrop` publie base sans retrait, plancher au fond, et la bande de P14', () => {
  const tp = { z: 12, x: 2094, y: 2270, key: '12/2094/2270', size: 32 }
  tp.heights = new Float32Array(32 * 32)
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 32; i++) tp.heights[j * 32 + i] = 400 + 900 * Math.sin(i * 0.7) * Math.cos(j * 0.5)
  }
  const c = tileToLatLon(tp.x + 0.5, tp.y + 0.5, tp.z)
  const rp = repereCrop({ centre: c, zoom: tp.z, tuilesParBloc: 1 })
  const bati = () => {
    const faux = {
      _crop: rp,
      _fondCrop: null,
      _parois: null,
      _baseYCrop: null,
      exaggeration: 2,
      tiles: new Map([[tp.key, tp]]),
      tuilesAvecHauteurs: () => [tp],
      uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
      group: { add() {}, remove() {} },
      hauteurDessinee: Globe.prototype.hauteurDessinee,
      _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
      _retaillerJupes: () => 0,
      retirerParoisCrop() { this._parois = null },
      _materiauParois: () => null,
    }
    const r = Globe.prototype.construireParoisCrop.call(faux, { couvertureMin: 0 })
    return { solide: r.solide, faux }
  }
  const { solide, faux } = bati()
  assert.equal(solide.chanfrein, 0)
  assert.equal(solide.arrondi, 0)
  assert.equal(faux._retraitBaseCrop, 0, 'la base ne rentre pas : le rideau d eau descend droit')
  assert.equal(faux._plancherJupeCrop, solide.baseY, 'sans congé, les jupes descendent jusqu au fond')
  assert.equal(faux._retraitJupeCrop, BANDE_JUPE_MUR, 'la bande de P14 survit au biseau')
  // rallumé : les trois valeurs d'avant
  const a = avecBiseau(true, bati)
  assert.ok(Math.abs(a.faux._retraitBaseCrop - (0.16 + 0.9) / 28) < 1e-12)
  assert.equal(a.faux._plancherJupeCrop, a.solide.baseY + a.solide.arrondi)
  assert.ok(Math.abs(a.faux._retraitJupeCrop - 2 * FRACTION_CHANFREIN) < 1e-9)
  assert.ok(a.faux._retraitJupeCrop !== BANDE_JUPE_MUR || Math.abs(a.faux._retraitJupeCrop - BANDE_JUPE_MUR) < 1e-15)
})
