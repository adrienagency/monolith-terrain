// LE PLAFOND DES NUAGES EN MÈTRES — Tâche NUA (N1–N2 de la vidéo du 2026-09-04).
//
// ⛔ **UNE SUITE VERTE NE PROUVE RIEN** (pièges communs) : chaque test ci-dessous
// dit quelle MUTATION il tue. La principale : « remettre 13,5 unités de bloc »
// — un plafond qui ne passe pas par les mètres rend 21 346 m à z9 et 2 016 m à
// z13 (banc `.banc/NUA/avant/journal.json`), et le test ① rougit.
//
//   ① LE FACTEUR — mètres → unités de bloc, sa valeur à z13 et à z9, écrite.
//   ② LA CONSTANCE — le plafond en mètres est le même à z9, z11, z13, z14
//      (≤ 5 %), et au-dessus de la crête la plus haute de chaque bloc.
//   ③ LA VALEUR — 6 000 m : au-dessus des Écrins + marge, base au-dessus de la
//      caméra au repos de z13 (3 115 m, VID2).
//   ④ LA COLONNE — plancher marin conservé au bit près (R20 bis), ré-étagement.
//   ⑤ LA BORNE — N2 : 1 dedans, fondu au bord, 0 dehors, désactivée hors crop.
//   ⑥ LE CÂBLAGE — `clouds2.js` et `main.js`, LUS (aucun test ne les charge).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PLAFOND_NUAGES_M, MARGE_CRETE_M, BANDE_FONDU_BORNE,
  verticaleDuTerrain, plafondEffectifM, plafondNuagesBloc, hauteurBlocEnM,
  colonneNuages, reetagerY, attenuationBorne,
} from '../src/monde/nuages-metres.js'
import * as MODULE from '../src/monde/nuages-metres.js'
import { echelleBloc } from '../src/loi-altitude.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const CLOUDS2 = readFileSync(new URL('../src/clouds2.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const PANNEAU = readFileSync(new URL('../src/ui/effects-panel.js', import.meta.url), 'utf8')
const GABARITS = readFileSync(new URL('../src/templates-user.js', import.meta.url), 'utf8')
const DEPART = JSON.parse(readFileSync(new URL('../public/templates/defaults/shibustart.json', import.meta.url), 'utf8'))

// LE RELEVÉ DU BANC — Provence 44,3425 / 5,7777, exagération 2, vol de la vidéo
// (`scripts/banc-nua.mjs`, `.banc/NUA/avant/journal.json`). Ce sont des
// NOMBRES MESURÉS, pas des hypothèses : largeur de la fenêtre bornée, moyenne
// et crête du bloc à chaque palier.
const PALIERS = {
  z9: { largeurM: 167933, moyenneM: 1104, maxM: 3908 },
  z10: { largeurM: 83967, moyenneM: 1088, maxM: 3368 },
  z11: { largeurM: 41983, moyenneM: 934, maxM: 2000 },
  z12: { largeurM: 20992, moyenneM: 877, maxM: 1829 },
  z13: { largeurM: 10496, moyenneM: 751, maxM: 1425 },
  z14: { largeurM: 5248, moyenneM: 751, maxM: 1425 }, // z14 : moitié de z13, même relief
}
const EXAG = 2
const verticale = (p) => verticaleDuTerrain({
  fenetreBornee: { largeurM: p.largeurM, moyenneM: p.moyenneM, maxM: p.maxM, echelleVerticale: 0 },
  span: TERRAIN_SIZE, exageration: EXAG,
})

// ═══════════════ ① LE FACTEUR, ÉCRIT ══════════════════════════════════════

test('① le facteur mètres → unités de bloc vaut 0,010 671 à z13 et 0,000 667 à z9', () => {
  // ⚡ 56 / 10 496 × 2 — la formule de `terrain.js` et de `fenetre-bornee.js`
  const z13 = verticale(PALIERS.z13).blocParMetre
  const z9 = verticale(PALIERS.z9).blocParMetre
  assert.ok(Math.abs(z13 - 0.010671) < 1e-6, `z13 : ${z13}`)
  assert.ok(Math.abs(z9 - 0.000667) < 1e-6, `z9 : ${z9}`)
  // et c'est bien `echelleBloc`, pas une constante recopiée
  assert.equal(z13, echelleBloc({ extentMeters: 10496, span: 56, exageration: 2 }))
  // 93,7 m par unité à z13, 1 499 m à z9
  assert.ok(Math.abs(1 / z13 - 93.7) < 0.1)
  assert.ok(Math.abs(1 / z9 - 1499.4) < 0.1)
})

test('① la fenêtre bornée passe en premier, et son échelle est reprise telle quelle', () => {
  // `dem` passe à null pendant tout le rechargement d'un cran (R15) ; la
  // fenêtre, elle, ne disparaît pas — et `echelleVerticale` est la valeur qui
  // pose la ligne d'eau : la surface réellement dessinée.
  const v = verticaleDuTerrain({
    fenetreBornee: { largeurM: 10496, moyenneM: 751, maxM: 1425, echelleVerticale: 0.0123 },
    dem: { extentMeters: 999999, meanM: 0, maxM: 0 },
    span: 56, exageration: 2,
  })
  assert.equal(v.blocParMetre, 0.0123)
  assert.equal(v.moyenneM, 751)
  // sans fenêtre, le MNT ; sans MNT, rien (terrain procédural : pas de mètres)
  const d = verticaleDuTerrain({ dem: { extentMeters: 10496, meanM: 751, maxM: 1425 }, span: 56, exageration: 2 })
  assert.ok(Math.abs(d.blocParMetre - 0.010671) < 1e-6)
  assert.equal(verticaleDuTerrain({ span: 56, exageration: 2 }), null)
  assert.equal(verticaleDuTerrain({ dem: { extentMeters: 0 }, span: 56, exageration: 2 }), null)
})

// ═══════════════ ② LA CONSTANCE — LE TEST QUI TUE « 13,5 UNITÉS » ═════════

test('② ⛔ le plafond en MÈTRES est le même à z9, z11, z13, z14 — ≤ 5 %', () => {
  const plafonds = {}
  for (const [z, p] of Object.entries(PALIERS)) {
    const v = verticale(p)
    const { ceilY } = plafondNuagesBloc({ plafondM: PLAFOND_NUAGES_M, verticale: v })
    plafonds[z] = hauteurBlocEnM(ceilY, v)
  }
  const vals = Object.values(plafonds)
  const ecart = (Math.max(...vals) - Math.min(...vals)) / Math.min(...vals)
  assert.ok(ecart <= 0.05, `plafond variable d'un palier à l'autre : ${JSON.stringify(plafonds)}`)
  assert.ok(Math.abs(plafonds.z13 - PLAFOND_NUAGES_M) < 1e-6)
})

test('② ⛔ LA MUTATION « 13,5 unités de bloc » rougit : 21 346 m à z9, 2 016 m à z13', () => {
  // Le témoin : ce que l'ancienne loi rendait, calculé par le même instrument.
  const ancien = (z) => hauteurBlocEnM(13.5, verticale(PALIERS[z]))
  assert.ok(Math.abs(ancien('z9') - 21346) < 5, `z9 : ${ancien('z9')}`)
  assert.ok(Math.abs(ancien('z13') - 2016) < 5, `z13 : ${ancien('z13')}`)
  const ecart = (ancien('z9') - ancien('z13')) / ancien('z13')
  assert.ok(ecart > 5, 'le témoin est faux : l’ancienne loi devait varier d’un facteur 10')
  // et à z14 elle passait SOUS la crête
  assert.ok(ancien('z14') < PALIERS.z14.maxM, `à z14 l’ancien plafond (${ancien('z14')}) devait être sous la crête`)
})

test('② le plafond passe au-dessus de la crête la plus haute de CHAQUE bloc', () => {
  for (const [z, p] of Object.entries(PALIERS)) {
    const v = verticale(p)
    const { ceilY, plafondM } = plafondNuagesBloc({ plafondM: PLAFOND_NUAGES_M, verticale: v })
    const creteY = (p.maxM - p.moyenneM) * v.blocParMetre
    assert.ok(ceilY > creteY, `${z} : plafond ${ceilY} sous la crête ${creteY}`)
    assert.ok(plafondM >= p.maxM + MARGE_CRETE_M, `${z} : moins de ${MARGE_CRETE_M} m au-dessus de la crête`)
  }
})

test('② le plancher de crête relève un plafond trop bas, et lui seul', () => {
  // Himalaya : 6 000 m serait sous l'Everest
  assert.equal(plafondEffectifM({ plafondM: 6000, maxM: 8849 }), 8849 + MARGE_CRETE_M)
  // Provence : la valeur demandée, au bit près
  assert.equal(plafondEffectifM({ plafondM: 6000, maxM: 3908 }), 6000)
  // valeur absente ou absurde : le défaut
  assert.equal(plafondEffectifM({ plafondM: NaN, maxM: 1000 }), PLAFOND_NUAGES_M)
  assert.equal(plafondEffectifM({}), PLAFOND_NUAGES_M)
})

// ═══════════════ ③ LA VALEUR, DÉRIVÉE ═════════════════════════════════════

test('③ 6 000 m : au-dessus des Écrins + marge, base au-dessus de la caméra de z13', () => {
  assert.equal(PLAFOND_NUAGES_M, 6000)
  // ① la crête la plus haute du vol (z9, Barre des Écrins dans le bloc de 168 km)
  assert.ok(PLAFOND_NUAGES_M >= PALIERS.z9.maxM + MARGE_CRETE_M)
  // ② la base, avec l'étalement du gabarit d'ouverture, au-dessus de 3 115 m
  //    (la caméra au repos de z13 dans la vidéo, rapport VID2)
  const v = verticale(PALIERS.z13)
  const { ceilY } = plafondNuagesBloc({ plafondM: PLAFOND_NUAGES_M, verticale: v })
  const col = colonneNuages({ ceilY, spread: DEPART.look.cloudAltSpread, eau: -Infinity })
  const baseM = hauteurBlocEnM(col.baseY, v)
  assert.ok(baseM > 3115 + 300, `base de la couche à ${baseM} m : la caméra de z13 vole dedans`)
  // et le gabarit d'ouverture porte la valeur en mètres
  assert.equal(DEPART.look.cloudAltitudeM, PLAFOND_NUAGES_M)
})

// ═══════════════ ④ LA COLONNE ═════════════════════════════════════════════

test('④ le plancher marin de R20 bis est conservé au bit près', () => {
  const nu = colonneNuages({ ceilY: 13.5, spread: 0.45, eau: undefined })
  assert.equal(nu.baseY, 13.5 * 0.55)
  assert.equal(nu.topY, 13.5)
  // La Réunion (mer à −1,80) : neutre ; Pacifique (+13,05) : remonte en bloc
  const reu = colonneNuages({ ceilY: 13.5, spread: 0.45, eau: -1.8007 })
  assert.equal(reu.baseY, nu.baseY); assert.equal(reu.topY, nu.topY)
  const pac = colonneNuages({ ceilY: 13.5, spread: 0.45, eau: 13.0489 })
  assert.equal(pac.baseY, 13.0489 + 0.5)
  assert.ok(Math.abs(pac.epaisseur - nu.epaisseur) < 1e-12)
})

test('④ le ré-étagement garde la position RELATIVE d’un nuage dans la couche', () => {
  const avant = { baseY: 7.4, topY: 13.5 }
  const apres = { baseY: 30, topY: 56 }
  assert.equal(reetagerY(7.4, avant, apres), 30)
  assert.equal(reetagerY(13.5, avant, apres), 56)
  const milieu = reetagerY((7.4 + 13.5) / 2, avant, apres)
  assert.ok(Math.abs(milieu - 43) < 1e-9)
  // le passage z13 → z14 double le facteur : la colonne double en unités de bloc
  const v13 = verticale(PALIERS.z13), v14 = verticale(PALIERS.z14)
  const c13 = plafondNuagesBloc({ plafondM: 6000, verticale: v13 }).ceilY
  const c14 = plafondNuagesBloc({ plafondM: 6000, verticale: v14 }).ceilY
  assert.ok(Math.abs(c14 / c13 - 2) < 1e-9, `z14/z13 = ${c14 / c13}`)
})

// ═══════════════ ⑤ LA BORNE — N2 ══════════════════════════════════════════

test('⑤ la borne vaut 1 dedans, fond sur la bande, 0 dehors — et 0 la désactive', () => {
  const demi = 28
  assert.equal(attenuationBorne(0, 0, demi), 1)
  assert.equal(attenuationBorne(24, -24, demi), 1) // avant la bande (28 − 3 = 25)
  assert.equal(attenuationBorne(28, 0, demi), 0) // au bord
  assert.equal(attenuationBorne(0, 35, demi), 0) // dehors
  assert.equal(attenuationBorne(-41, 0, demi), 0) // là où naissent les nuages de passage
  const milieu = attenuationBorne(26.5, 0, demi)
  assert.ok(milieu > 0.4 && milieu < 0.6, `fondu au milieu de la bande : ${milieu}`)
  // monotone sur la bande — pas de coupe franche
  let prev = 1
  for (let d = 25; d <= 28; d += 0.25) { const a = attenuationBorne(d, 0, demi); assert.ok(a <= prev + 1e-12); prev = a }
  // hors crop : identique au pixel
  assert.equal(attenuationBorne(1000, 1000, 0), 1)
  assert.equal(BANDE_FONDU_BORNE, 3)
})

// ═══════════════ ⑤ bis LA PRÉSENCE — « la caméra vole dans la couche » ═════

test('⑤ bis le ciel est plein vu de haut ou de bas, éteint quand la caméra est dedans', () => {
  const { presenceSelonCamera, MARGE_PRESENCE } = MODULE
  // la colonne de z13 après le passage en mètres : 30,8 → 56,0 unités de bloc
  const base = 30.8, top = 56.0
  assert.equal(presenceSelonCamera(102, base, top), 1) // z12 au repos, 10 369 m : de haut
  assert.equal(presenceSelonCamera(0, base, top), 1) // au sol : de bas
  // z13 d'Adrien, 3 115 m : (3 115 − 751) × 0,010 671 = 25,2 — sous la base et
  // sous la bande de fondu (0,2 × 25,2 = 5,0 unités, soit ~470 m à z13)
  assert.equal(presenceSelonCamera(25.2, base, top), 1)
  assert.ok(MARGE_PRESENCE <= 0.2, 'une bande plus large attrape la caméra de z13 dans le fondu')
  assert.equal(presenceSelonCamera(50, base, top), 0) // 5 477 m, DANS la couche : éteint
  // témoin : la mutation qui rend toujours 1 tue ici (30 % de l'écran à z14)
  assert.equal(presenceSelonCamera(43, base, top), 0)
  // fondu doux, monotone, sur MARGE_PRESENCE × épaisseur de chaque côté
  const m = MARGE_PRESENCE * (top - base)
  let prev = 1
  for (let y = base - m; y <= base; y += 0.5) { const v = presenceSelonCamera(y, base, top); assert.ok(v <= prev + 1e-12); prev = v }
  assert.ok(presenceSelonCamera(base - m / 2, base, top) > 0.4 && presenceSelonCamera(base - m / 2, base, top) < 0.6)
  assert.ok(presenceSelonCamera(top + m / 2, base, top) > 0.4 && presenceSelonCamera(top + m / 2, base, top) < 0.6)
  assert.equal(presenceSelonCamera(top + m, base, top), 1)
  assert.equal(presenceSelonCamera(base - m, base, top), 1)
  // et le nuanceur la multiplie à la densité
  assert.ok(CLOUDS2.includes('return dens * uDensity * vInfo.y * uPresence;'), 'la présence ne pèse plus sur la densité')
  assert.ok(CLOUDS2.includes('u.uPresence.value = presenceSelonCamera(cam.y, this._colonne.baseY, this._colonne.topY)'))
})

// ═══════════════ ⑥ LE CÂBLAGE, LU ═════════════════════════════════════════

test('⑥ ⛔ `clouds2.build` ne lit plus la tirette en unités de bloc comme plafond', () => {
  assert.ok(!CLOUDS2.includes('const ceilY = params?.cloudAltitude ?? 4.5'),
    'le plafond est redevenu 13,5 unités de bloc : N1 est de retour')
  assert.ok(CLOUDS2.includes('const ceilY = this._plafondBloc(params)'))
  assert.ok(CLOUDS2.includes('plafondNuagesBloc({ plafondM: params?.cloudAltitudeM ?? PLAFOND_NUAGES_M, verticale })'))
  // le facteur est écrit en commentaire, avec sa valeur à z13
  assert.ok(CLOUDS2.includes('0,010 671'), 'le facteur chiffré a disparu du commentaire')
  // et l'ombre au sol suit le plafond converti, pas la tirette
  assert.ok(CLOUDS2.includes('this._colonne?.ceilY ?? this._params?.cloudAltitude'))
})

test('⑥ le plafond est relu à chaque image (la fenêtre change 350 ms après le cran)', () => {
  assert.ok(CLOUDS2.includes('this._majPlafond(params)'), '`update` ne relit plus le plafond')
  assert.ok(CLOUDS2.includes('n.y = reetagerY(n.y, avant, apres)'))
})

test('⑥ N2 : le nuanceur porte la borne, et `main.js` la pose sous la fusion des passes', () => {
  assert.ok(CLOUDS2.includes('uniform float uBorne;'))
  assert.ok(CLOUDS2.includes('1.0 - smoothstep(uBorne - uBorneFondu, uBorne, d)'), 'le fondu au bord est devenu une coupe franche')
  assert.ok(CLOUDS2.includes('dens *= borneSocle(wp.xz);'), 'la densité ne passe plus par la borne')
  assert.ok(CLOUDS2.includes('if (uBorne <= 0.0) return 1.0;'), 'hors crop, la borne doit être neutre')
  assert.ok(MAIN.includes('clouds.setBorne(fusionDesPasses ? TERRAIN_SIZE / 2 : 0)'),
    'main.js ne borne plus le ciel à l’emprise du socle')
})

test('⑥ le réglage voyage : littéral, panneau, gabarits', () => {
  assert.ok(MAIN.includes('cloudAltitudeM: PLAFOND_NUAGES_M'))
  assert.ok(PANNEAU.includes("cloudBaked('Altitude (m)', 'cloudAltitudeM'"))
  assert.ok(GABARITS.includes("'cloudAltitudeM'"))
})
