// R33 — ATTAQUANT : TESTS ROUGES. Le pivot n'est PAS le centre de la Terre hors
// du crop, et ceci le dit en ESPACE GLOBE et en PIXELS — jamais en unités de bloc.
//
// ⛔ CE FICHIER N'EST PAS DANS `package.json` ET NE DOIT PAS Y ENTRER TEL QUEL :
// les gardes de journal lisent `.banc/` (ignoré par git). Il se rejoue ainsi :
//
//   npm run dev -- --port 5951
//   node scripts/sonde-attaque-r33.mjs --port 5951 --etiquette altimetre --altitudes 4000000,260000,100000
//   node scripts/sonde-attaque-r33.mjs --port 5951 --etiquette inclinaison --serie inclinaison --altitudes 4000000,260000,100000
//   node scripts/lit-sonde-r33.mjs .banc/R33/altimetre.json
//   node scripts/lit-sonde-r33.mjs .banc/R33/inclinaison.json
//   node --test test/attaque-r33-ROUGE.mjs
//
// Les altitudes 4 000 000 / 260 000 / 100 000 m sont celles de la CAMÉRA QUI
// REND ; l'altimètre affiche la moitié (exagération ×2) : 2 000 / 130 / 50 km.
//
// ══════════ POURQUOI AUCUN CORRECTIF EN ESPACE BLOC NE PEUT LES RENDRE VERTS ═
//
// Quatre passes ont mesuré `hypot(target.x, target.z)` — l'écart de la cible à
// l'axe vertical du BLOC — et publié « écart à l'axe : exactement 0 ». Ce
// nombre vaut bien 0 dans tous les relevés de ce banc. **Et le pivot est quand
// même à 6 300 km du centre de la Terre** : l'angle polaire d'OrbitControls
// tourne autour de `controls.target`, un point de la SURFACE, et l'azimut est un
// lacet autour de la verticale locale. Les grandeurs ci-dessous ne peuvent
// changer que si la caméra qui rend tourne autrement.
//
// Le jour où ces rouges deviennent verts : garder ⑤ (pur) dans `npm test` sous
// un autre nom, et laisser les gardes de journal ici avec leur commande.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { poseFond } from '../src/monde/frontiere-rendu.js'
import { EARTH_RADIUS_M, R_GLOBE, ORBITAL_M_PER_UNIT, latLonVersMondeEmprise, mondeVersLatLonEmprise } from '../src/geo.js'
import { Y_CIBLE } from '../src/loi-altitude.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const lire = (nom) => {
  const p = path.join(RACINE, '.banc', 'R33', nom)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
const M = lire('mesures-altimetre.json') ?? lire('mesures-releve.json')
const I = lire('mesures-inclinaison.json')
const surfaces = (m) => (m ? m.bancs.filter((b) => b.mode === 'surface' && !b.cropPose && b.horsDuCrop && b.nom.startsWith('surface-')) : [])
const orbite = (m) => (m ? m.bancs.find((b) => b.mode === 'orbital') : null)
const km = (x) => (x / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' km'

// ═══════════════════════════════════════════════════════════════════════════
// ① LE PIVOT, EN MÈTRES DU CENTRE DE LA TERRE — espace globe
// Axe instantané de rotation de `camGlobe` pendant un glissé VERTICAL de 200 px
// (mesuré au rendu, image par image). En orbite : 0 m. Hors crop : ≈ 6 300 km,
// soit la SURFACE — le pivot est `controls.target`, pas le centre.
// ═══════════════════════════════════════════════════════════════════════════
test('ROUGE ① hors du crop, l’axe de rotation du glissé vertical passe par le centre de la Terre (< 200 km)', { skip: !M && 'journal .banc/R33 absent' }, () => {
  const o = orbite(M)
  assert.ok(o && o.glisses.V.axeDistanceM_mediane < 200000, `étalon orbite : ${o?.glisses.V.axeDistanceM_mediane} m`)
  for (const b of surfaces(M)) {
    const v = b.glisses.V
    assert.ok(v.axeDistanceM_mediane < 200000,
      `${b.nom} (altimètre ${km(b.altimetreM)}) : l’axe de rotation du glissé vertical est à ${km(v.axeDistanceM_mediane)} du centre de la Terre — la cible (le pivot) est à ${km(v.cibleM_avant)} du centre, c’est-à-dire À LA SURFACE`)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ② LA SIGNATURE ORBITE / LACET — espace globe (lat/lon sous la caméra)
// Glissé HORIZONTAL de 200 px. En orbite le point sous la caméra change de
// ~48°. Hors crop : 0,000° — la caméra tourne autour de sa propre verticale.
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ **RÉÉCRIT PAR R32 CONTRE D19.** Ce test comparait à l'orbite d'AVANT D19
// (`rotateSpeed = 1` : 0,447 °/px quelle que soit l'altitude) et exigeait « au
// moins la moitié de l'étalon ». D19 remplace la vitesse par une contrainte —
// le point saisi reste sous le curseur — donc le déplacement du point sous la
// caméra vaut le SOL que 200 px couvrent à cette altitude : 200 × 2·h·tan(fov/2)
// / 800, soit 5,4° à 4 000 km de fond, 0,2° à 100 km. Ce qu'on garde : il n'est
// pas nul (le lacet rendait 0,0000°), et il vaut ce que la géométrie impose.
test('ROUGE ② hors du crop, un glissé horizontal déplace le point sous la caméra du sol que 200 px couvrent (D19), jamais 0°', { skip: !M && 'journal .banc/R33 absent' }, () => {
  for (const b of surfaces(M)) {
    const h = b.glisses.H
    const solPx = (b.altFondM * 2 * Math.tan((33 / 2) * Math.PI / 180)) / 800 // mètres de sol par pixel, au nadir
    const attenduDeg = (200 * solPx) / EARTH_RADIUS_M * 180 / Math.PI
    assert.ok(h.dSousCamDeg > 0.05 * attenduDeg,
      `${b.nom} (altimètre ${km(b.altimetreM)}) : le point sous la caméra bouge de ${h.dSousCamDeg.toFixed(4)}° pour 200 px (attendu ≈ ${attenduDeg.toFixed(3)}°) — c’est un LACET sur place, pas une orbite`)
    assert.ok(h.dSousCamDeg < 3 * attenduDeg,
      `${b.nom} : ${h.dSousCamDeg.toFixed(4)}° pour 200 px, plus de trois fois le sol couvert (${attenduDeg.toFixed(3)}°) — le point saisi ne suit plus le curseur`)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ LE CENTRE DE LA TERRE À L'ÉCRAN — pixels
// Projeté par `camGlobe`. En orbite : immobile (0 px) sous tout glissé. Hors
// crop, glissé vertical : il sort du cadre (1 200 à 3 300 px de déplacement).
// ═══════════════════════════════════════════════════════════════════════════
test('ROUGE ③ hors du crop, le centre de la Terre ne bouge pas à l’écran sous un glissé vertical (< 20 px)', { skip: !M && 'journal .banc/R33 absent' }, () => {
  const o = orbite(M)
  assert.ok(o && o.glisses.V.pTerre_deplacementMaxPx < 20, `étalon orbite : ${o?.glisses.V.pTerre_deplacementMaxPx} px`)
  for (const b of surfaces(M)) {
    const v = b.glisses.V
    assert.ok(v.pTerre_deplacementMaxPx < 20,
      `${b.nom} (altimètre ${km(b.altimetreM)}) : le centre de la Terre se déplace de ${v.pTerre_deplacementMaxPx.toFixed(0)} px (${v.pTerre_avant.map(Math.round).slice(0, 2)} → ${v.pTerre_apres.map(Math.round).slice(0, 2)}) sur un écran de 800 px de haut`)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ④ D16 ter — l'angle verticale locale / axe optique, hors crop — degrés
// « La vue 3/4 arrive au bloc, pas avant. » Un glissé vertical de 200 px à
// 130 km couche la vue à 66°, à 50 km à 68° — avant tout crop.
// ═══════════════════════════════════════════════════════════════════════════
test('ROUGE ④ hors du crop, un glissé vertical ne couche pas la vue au-delà de 60° (D16 ter)', { skip: !M && 'journal .banc/R33 absent' }, () => {
  const bas = surfaces(M).filter((b) => b.altimetreM < 300000)
  assert.ok(bas.length >= 1, 'il faut au moins un banc sous 300 km d’altimètre')
  for (const b of bas) {
    const v = b.glisses.V
    assert.ok(v.angleVert_max < 60,
      `${b.nom} (altimètre ${km(b.altimetreM)}) : angle verticale locale / axe optique = ${v.angleVert_max.toFixed(2)}° pendant le glissé, ${v.angleVert_apres.toFixed(2)}° après — la vue de trois quarts est arrivée AVANT le bloc (crop posé : ${b.cropPose})`)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ LE MÉCANISME, SANS NAVIGATEUR — espace globe, par la similitude du dépôt
// OrbitControls tourne la caméra de bloc autour de `controls.target` ; la
// similitude `poseFond` (celle qui pose la caméra qui rend) transporte ce
// mouvement. On mesure l'axe de rotation transporté. ⚠️ Ce test décrit le
// mécanisme ACTUEL : il restera rouge tant que la caméra qui rend tournera
// autour de la cible de bloc, et devra être réécrit contre le nouveau mécanisme.
// ═══════════════════════════════════════════════════════════════════════════
function camGlobeDepuisBloc({ phiDeg, thetaDeg, d, extentMeters, lat = -21.13, lon = 55.53 }) {
  const cible = new THREE.Vector3(0, Y_CIBLE, 0)
  const phi = phiDeg * Math.PI / 180, th = thetaDeg * Math.PI / 180
  const cam = new THREE.PerspectiveCamera(33, 1.6, 0.1, 1000)
  cam.position.set(cible.x + d * Math.sin(phi) * Math.sin(th), cible.y + d * Math.cos(phi), cible.z + d * Math.sin(phi) * Math.cos(th))
  cam.up.set(0, 1, 0)
  cam.lookAt(cible)
  cam.updateMatrixWorld()
  const pose = poseFond({ lat, lon, positionBloc: cam.position.toArray(), quaternionBloc: cam.quaternion.toArray(), extentMeters, span: TERRAIN_SIZE, origineBloc: [0, 0, 0] })
  return { p: new THREE.Vector3(...pose.position), q: new THREE.Quaternion(...pose.quaternion) }
}
function distanceAxeM(a, b) {
  const dR = b.q.clone().multiply(a.q.clone().invert())
  if (dR.w < 0) { dR.x *= -1; dR.y *= -1; dR.z *= -1; dR.w *= -1 }
  const theta = 2 * Math.acos(Math.min(1, dR.w))
  const axe = new THREE.Vector3(dR.x, dR.y, dR.z).normalize()
  const t = b.p.clone().sub(a.p.clone().applyQuaternion(dR))
  const tp = t.clone().addScaledVector(axe, -t.dot(axe))
  const c = tp.clone().multiplyScalar(0.5).addScaledVector(axe.clone().cross(tp), 0.5 / Math.tan(theta / 2))
  return c.length() * ORBITAL_M_PER_UNIT
}

// ⚠️ **RÉÉCRITS PAR R32 CONTRE LE NOUVEAU MÉCANISME**, comme l'en-tête de ⑤ le
// demandait. Hors du crop, le glissé n'est plus une rotation d'OrbitControls
// autour de la cible : c'est une TRANSLATION rigide caméra + cible dans le plan
// du bloc, transportée par la même similitude, ancrée sur l'aplomb de la cible
// (`main.js`, « on attrape la Terre »). Le témoin d'avant (la rotation polaire
// autour de la cible tourne autour de la surface) est gardé dans
// `test/pivot-globe.test.js` ① ter.
const EMPRISE_Z9 = { ouest: 54.5, est: 56.5, sud: -22.2, nord: -20.3 }
function camGlobeParTranslation({ tx, tz, camY, extentMeters }) {
  const cam = new THREE.PerspectiveCamera(33, 1.6, 0.1, 1000)
  cam.position.set(tx, camY, tz)
  cam.up.set(0, 1, 0)
  cam.lookAt(tx, Y_CIBLE, tz + 1e-6)
  cam.updateMatrixWorld()
  const ancre = mondeVersLatLonEmprise(EMPRISE_Z9, tx, tz, TERRAIN_SIZE)
  const pose = poseFond({ lat: ancre.lat, lon: ancre.lon, origineBloc: [tx, 0, tz], positionBloc: cam.position.toArray(), quaternionBloc: cam.quaternion.toArray(), extentMeters, span: TERRAIN_SIZE })
  return { p: new THREE.Vector3(...pose.position), q: new THREE.Quaternion(...pose.quaternion) }
}

test('ROUGE ⑤ mécanisme : la translation rigide caméra + cible du glissé, transportée par `poseFond`, tourne autour du centre de la Terre (< 100 km)', () => {
  const extentMeters = 219000, camY = 33
  const a = camGlobeParTranslation({ tx: 0, tz: 0, camY, extentMeters })
  const A = mondeVersLatLonEmprise(EMPRISE_Z9, 0, 0, TERRAIN_SIZE)
  const w = latLonVersMondeEmprise(EMPRISE_Z9, A.lat, A.lon + 1, TERRAIN_SIZE)
  const b = camGlobeParTranslation({ tx: w.x, tz: w.z, camY, extentMeters })
  const dist = distanceAxeM(a, b)
  assert.ok(dist < 100000, `l’axe de rotation transporté est à ${km(dist)} du centre de la Terre (rayon terrestre : ${km(EARTH_RADIUS_M)})`)
  assert.ok(Math.abs(a.p.length() - b.p.length()) * ORBITAL_M_PER_UNIT < 50, 'l’altitude de la caméra qui rend doit rester constante')
})

test('ROUGE ⑤ bis mécanisme : la translation, transportée par `poseFond`, déplace le point sous la caméra d’autant (1° pour 1°)', () => {
  const extentMeters = 219000, camY = 33
  const a = camGlobeParTranslation({ tx: 0, tz: 0, camY, extentMeters })
  const A = mondeVersLatLonEmprise(EMPRISE_Z9, 0, 0, TERRAIN_SIZE)
  const w = latLonVersMondeEmprise(EMPRISE_Z9, A.lat, A.lon + 1, TERRAIN_SIZE)
  const b = camGlobeParTranslation({ tx: w.x, tz: w.z, camY, extentMeters })
  const deg = a.p.clone().normalize().angleTo(b.p.clone().normalize()) * 180 / Math.PI
  // 1° de longitude à la latitude de La Réunion vaut cos(lat) degrés d'arc
  const attendu = Math.cos(A.lat * Math.PI / 180)
  assert.ok(Math.abs(deg - attendu) < 0.02, `le point sous la caméra bouge de ${deg.toFixed(4)}° d’arc pour 1° de longitude demandé (attendu ${attendu.toFixed(4)}°, R_GLOBE = ${R_GLOBE})`)
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ D19 — GLISSÉ : le point saisi reste sous le curseur, la Terre reste plantée
// Pixels. Étalon : l'orbite (Adrien : « c'est bon »). Hors crop, glissé
// horizontal : le point saisi ne suit pas le curseur (200 px d'écart = il n'a
// pas bougé) ; glissé vertical : le centre de la Terre sort du cadre.
// ═══════════════════════════════════════════════════════════════════════════
test('ROUGE ⑥ D19 : hors du crop, le point saisi au mousedown suit le curseur comme en orbite (≤ 1,5 × l’étalon)', { skip: !M && 'journal .banc/R33 absent' }, () => {
  const o = orbite(M)
  const etalon = o?.glisses.H.saisiEcartPx_final
  assert.ok(etalon != null, 'pas d’étalon orbite')
  for (const b of surfaces(M)) {
    const h = b.glisses.H
    assert.ok(h.saisiEcartPx_final <= etalon * 1.5,
      `${b.nom} (altimètre ${km(b.altimetreM)}) : le point saisi est à ${h.saisiEcartPx_final.toFixed(0)} px du curseur en fin de glissé horizontal de 200 px (orbite : ${etalon.toFixed(0)} px) — il n’a pas bougé, la vue a tourné sur elle-même`)
  }
})

test('ROUGE ⑥ bis D19 : hors du crop, la Terre reste plantée dans le cadre pendant tout glissé (< 20 px)', { skip: !M && 'journal .banc/R33 absent' }, () => {
  for (const b of surfaces(M)) {
    for (const g of ['H', 'V']) {
      const m = b.glisses[g]
      assert.ok(m.pTerre_deplacementMaxPx < 20, `${b.nom} · glissé ${g} : le centre de la Terre se déplace de ${m.pTerre_deplacementMaxPx.toFixed(0)} px`)
    }
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ D19 — MOLETTE : le point de la surface AU CENTRE DE L'ÉCRAN y reste
// Pixels. Vue inclinée modérément (glissé vertical de 60 px), hors crop, deux
// crans dedans puis deux dehors. Le zoom radial « vers le centre de la Terre »
// vise la cible, pas le point du cadre : le centre dérive.
// ═══════════════════════════════════════════════════════════════════════════
test('ROUGE ⑦ D19 : hors du crop, vue inclinée, le point du centre de l’écran reste au centre à chaque cran (< 10 px)', { skip: !I && 'journal .banc/R33/mesures-inclinaison.json absent' }, () => {
  const o = orbite(I)
  for (const b of surfaces(I)) {
    for (const [g, m] of Object.entries(b.molettes)) {
      if (!g.startsWith('Mt')) continue
      if (m.cropPose_apres) continue // le crop est l'exception d'Adrien
      assert.ok(m.centreEcartPx_max < 10,
        `${b.nom} (altimètre ${km(b.altimetreM)}) · ${g} · vue inclinée à ${m.angleVert_avant.toFixed(1)}° : le point du centre s’écarte de ${m.centreEcartPx_max.toFixed(1)} px du centre de l’écran (par cran : ${m.crans.map((c) => c.ecartPx_max.toFixed(1)).join(' · ')} ; orbite : ${o ? Object.values(o.molettes).map((x) => x.centreEcartPx_max.toFixed(1)).join('/') : '—'})`)
    }
  }
})

test('ROUGE ⑦ bis D19 : hors du crop, vue COUCHÉE (glissé de 200 px), le point du centre reste au centre tant que le crop n’est pas né (< 10 px)', { skip: !M && 'journal .banc/R33 absent' }, () => {
  // Les bancs à 133 et 53 km font naître le crop pendant les trois crans : ils
  // tombent sous l'exception d'Adrien et sont écartés. Celui à 1 980 km reste
  // hors du crop : 12,7 px sur trois crans, la vue couchée à 50°.
  let vus = 0
  for (const b of surfaces(M)) {
    for (const [g, m] of Object.entries(b.molettes)) {
      if (!g.startsWith('Mc') || m.cropPose_apres) continue
      vus++
      assert.ok(m.centreEcartPx_max < 10,
        `${b.nom} (altimètre ${km(b.altimetreM)}) · ${g} · vue couchée à ${m.angleVert_avant.toFixed(1)}° : le point du centre s’écarte de ${m.centreEcartPx_max.toFixed(1)} px (par cran : ${m.crans.map((c) => c.ecartPx_max.toFixed(1)).join(' · ')}) — le zoom radial vise la cible, pas le point du cadre`)
    }
  }
  assert.ok(vus > 0, 'aucune molette couchée hors du crop dans le journal')
})
