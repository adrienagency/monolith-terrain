// LE PIED DE LA DÉCOUPE (demande Adrien) : « si les zones découpées sont en
// altitude, le point le plus bas de la zone découpée sera utilisé pour être le
// niveau zéro qui touchera la dalle du sol. Ça évitera d'avoir un grand bloc
// comme ici aux Deux Alpes. »
//
// ⚠️ CETTE RÈGLE EN INVERSE À MOITIÉ UNE AUTRE, et c'est tout l'objet de ce
// fichier. Le pied avait été fixé au ZÉRO ABSOLU (niveau de la mer) CONTRE le
// minimum local, qui faisait flotter la découpe à une hauteur différente d'une
// région à l'autre. Ce zéro reste JUSTE pour une île — c'est le rendu qu'Adrien
// a validé — et n'est faux qu'en altitude. Une seule expression couvre les deux :
//     baseY = max(niveau de la mer, plancher du relief DANS la zone)
// Le test de non-régression de l'île est le plus important des deux.
//
// traceSkirt a besoin d'un canvas et n'est pas jouable en node ; skirtFloor et
// regionBaseLevel, elles, sont pures — on leur donne une trace de synthèse.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { skirtFloor, regionBaseLevel } from '../src/region-skirt.js'

// trace de synthèse : quelques segments de coupe + un minimum intérieur
const trace = (interiorMin, hauteurs) => ({
  interiorMin,
  segs: hauteurs.map((h, k) => ({ ax: k, az: 0, bx: k + 1, bz: 0, _h: h })),
})
// le relief : chaque segment est plat à sa hauteur
const relief = (t) => (x) => t.segs[Math.min(t.segs.length - 1, Math.max(0, Math.floor(x)))]._h

test('le plancher est le point le plus bas de la zone, intérieur compris', () => {
  const t = trace(12, [40, 55, 31])
  assert.equal(skirtFloor(t, relief(t)), 12)
})

test('le plancher tient compte du BORD de coupe, pas seulement de l’intérieur', () => {
  // une découpe qui traverse une combe : le bord descend plus bas que tout
  // point intérieur échantillonné (le pas de 1 sur 16 saute les creux fins)
  const t = trace(40, [40, 7, 55])
  assert.equal(skirtFloor(t, relief(t)), 7)
})

test('sans aucun intérieur mesuré, le bord suffit — et ne rend pas 0', () => {
  // Zone plus fine que le pas d'échantillonnage : traceSkirt ne voit aucune
  // maille pleine. Rendre 0 rouvrait la jupe jusqu'au niveau de la mer, c'est
  // exactement le grand bloc des Deux Alpes.
  const t = trace(Infinity, [1180, 1240, 1205])
  assert.equal(skirtFloor(t, relief(t)), 1180)
})

test('les hauteurs sont mémorisées dans la trace, pas rééchantillonnées', () => {
  const t = trace(Infinity, [30, 20])
  let appels = 0
  const s = relief(t)
  skirtFloor(t, (x, z) => { appels++; return s(x, z) })
  const premier = appels
  skirtFloor(t, () => { appels++; return -999 })
  assert.equal(appels, premier, 'la seconde passe ne doit rien rééchantillonner')
  assert.equal(skirtFloor(t, () => -999), 20, 'et elle rend le même plancher')
})

test('une trace vide ou sans relief ne rend pas de plancher', () => {
  assert.equal(skirtFloor(null, () => 0), null)
  assert.equal(skirtFloor({ segs: [], interiorMin: 5 }, () => 0), null)
  assert.equal(skirtFloor(trace(3, [1]), null), null)
})

// ── la règle elle-même ──────────────────────────────────────────────────────

test('ÎLE : le niveau de la mer l’emporte — le rendu validé ne bouge pas', () => {
  // La Réunion : le plancher de la zone est sous l'eau (plateau immergé resté
  // dans le masque). C'est le zéro absolu qui doit continuer de trancher.
  assert.equal(regionBaseLevel(0, -3.2), 0)
  assert.equal(regionBaseLevel(0, 0), 0)
  assert.equal(regionBaseLevel(-0.5, -12), -0.5)
})

test('ALTITUDE : le plancher de la zone l’emporte — la jupe maigrit', () => {
  // Les Deux Alpes : fond de vallée bien au-dessus de la mer
  assert.equal(regionBaseLevel(0, 4.7), 4.7)
  assert.ok(regionBaseLevel(0, 4.7) > regionBaseLevel(0, -3.2), 'la jupe doit maigrir, pas grossir')
})

test('la base ne descend JAMAIS sous le niveau de la mer', () => {
  for (const sea of [-1, 0, 2.5]) {
    for (const sol of [-50, -1, 0, 3, 900]) {
      assert.ok(regionBaseLevel(sea, sol) >= sea, `mer ${sea} sol ${sol}`)
    }
  }
})

test('une mesure manquante ne fabrique pas de base absurde', () => {
  assert.equal(regionBaseLevel(0, null), 0) // pas de plancher → la mer
  assert.equal(regionBaseLevel(0, NaN), 0)
  assert.equal(regionBaseLevel(-99999, 4.7), 4.7) // sentinelle « pas de mer »
  assert.equal(regionBaseLevel(undefined, 4.7), 4.7)
  assert.equal(regionBaseLevel(null, null), null)
})

test('un plancher COMMUN au damier : le min des dalles, pas celui de chacune', () => {
  // Sans cette mise en commun, chaque dalle poserait sa coupe à SON minimum et
  // les jointures marqueraient une marche.
  const dalles = [trace(Infinity, [1200]), trace(Infinity, [1180]), trace(Infinity, [1310])]
  const planchers = dalles.map((t) => skirtFloor(t, relief(t)))
  const commun = Math.min(...planchers)
  assert.equal(commun, 1180)
  for (const p of planchers) assert.ok(p >= commun, 'aucune dalle sous le plancher commun')
  assert.equal(regionBaseLevel(0, commun), 1180)
})
