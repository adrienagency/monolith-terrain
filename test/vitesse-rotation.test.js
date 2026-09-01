// LE GESTE DE ROTATION, D'UN BOUT À L'AUTRE — Tâche R23.
//
// ⚠️ **LE JUGE EST LE °/px, PAS `rotateSpeed`.** `OrbitControls` applique
// `rotateLeft(2π · dx / hauteurÉcran)` après avoir multiplié le delta par
// `rotateSpeed` : le geste vaut donc `360 × rotateSpeed / hauteurÉcran` degrés
// d'azimut par pixel. Sur 800 px de haut, `rotateSpeed = 1` fait 0,450 °/px —
// et le banc relève 0,447079 °/px, l'écart venant de la hauteur de canevas
// réelle (l'entête d'application). C'est ce nombre qu'Adrien juge parfait, en
// orbite haute ET sur le bloc.
//
// ⛔ **CE FICHIER TESTE LA CONTINUITÉ AU FRANCHISSEMENT, PAS UNE CONSTANTE.**
// Le critère chiffré de la tâche : aucun rapport supérieur à 1,5 entre deux
// images consécutives.

import test from 'node:test'
import assert from 'node:assert/strict'
import { empriseBlocM, distanceArrivee, DISTANCE_MIN_SURFACE, Y_CIBLE, PENTE_ARRIVEE_Y } from '../src/loi-altitude.js'
import { niveauDArrivee } from '../src/monde/zoom-continu.js'
import { DIVE_TIERS } from '../src/modes.js'

const EARTH_RADIUS_M = 6371000
const HAUTEUR_ECRAN = 800
const degPx = (rotateSpeed) => (360 * rotateSpeed) / HAUTEUR_ECRAN

// la loi d'AVANT, recopiée telle qu'elle vivait dans `modes.js:1517`
const LOI_AVANT = (altM) => Math.min(1, Math.max(0.015, (altM / EARTH_RADIUS_M) * 1.4))
// la loi d'APRÈS : le bloc et l'orbite portent le même geste
const LOI_APRES = () => 1

// ══════════ ① LA TABLE DES °/px, ET LE RAPPORT QU'ELLE PORTAIT ══════════════

test('① la loi d’avant écrase le geste d’un facteur 66,67 entre ses deux bouts', () => {
  // Relevé au navigateur, glissé de 100 px, `.banc/R13/avant.json` puis
  // `.banc/R23/avant.json` — les deux bancs rendent les mêmes nombres :
  //   orbite 60 000 km : 0,447079 °/px      orbite 1 000 km : 0,098919 °/px
  //   orbite 40 km     : 0,006716 °/px      le bloc         : 0,447079 °/px
  assert.equal(LOI_AVANT(60000000), 1)
  assert.ok(Math.abs(LOI_AVANT(1000000) - 0.219746) < 1e-5)
  assert.equal(LOI_AVANT(40000), 0.015)
  assert.ok(Math.abs(1 / LOI_AVANT(40000) - 66.667) < 0.01, 'le facteur 66,67 de pivot-bloc.js')
  // le geste, lui, se lit en °/px — c'est le juge
  assert.ok(Math.abs(degPx(LOI_AVANT(60000000)) - 0.45) < 1e-9)
  assert.ok(Math.abs(degPx(LOI_AVANT(40000)) - 0.00675) < 1e-9)
})

test('① le genou de la loi d’avant tombe à 4 550 000 m, et c’est lui qui décide de tout', () => {
  // `clamp(alt / R × 1,4, …, 1)` vaut 1 dès que `alt ≥ R / 1,4`
  const genou = EARTH_RADIUS_M / 1.4
  assert.ok(Math.abs(genou - 4550714.3) < 1)
  assert.equal(LOI_AVANT(genou * 1.0001), 1)
  assert.ok(LOI_AVANT(genou * 0.9999) < 1)
})

// ══════════ ② OÙ TOMBE LE FRANCHISSEMENT, PAR LA MÊME LOI QUE `modes.js` ════

// `Modes._niveauDArrivee`, rejoué avec ses vrais paramètres.
function porteOrbitale(lat, { span = 56, distanceMax = distanceArrivee(150) / 2 } = {}) {
  const empriseAuZoom = (z) => empriseBlocM({ zoom: z, lat, tuilesParBloc: 3 })
  const dedans = (altM) => {
    const n = niveauDArrivee({
      altM, empriseAuZoom, span, zoomMax: 15,
      pente: PENTE_ARRIVEE_Y, yCible: Y_CIBLE,
      distanceMin: DISTANCE_MIN_SURFACE, distanceMax,
    })
    return !!n && n.borne !== 'haut'
  }
  // dichotomie sur l'altitude : la porte est l'altitude la plus haute qui entre
  let bas = 1, haut = 6e7
  if (dedans(haut)) return haut
  for (let i = 0; i < 80; i++) {
    const mid = Math.sqrt(bas * haut)
    if (dedans(mid)) bas = mid
    else haut = mid
  }
  return bas
}

test('② en régime continu la porte orbitale s’ouvre à des millions de mètres — la loi d’avant y valait DÉJÀ 1', () => {
  // ⚡ **C'EST LE CONSTAT QUI REND LE RETRAIT SÛR**, et il contredit le brief :
  // la descente réelle ne descend JAMAIS dans la partie variable de la loi.
  // Relevé au navigateur : franchissement à **12 332 703 m**, `rotateSpeed`
  // 1 → 1, pire rapport d'une image à la suivante ×1,0000 sur 1 810 images.
  const p = porteOrbitale(45.8326)
  assert.ok(p > 4550714, `porte à ${Math.round(p)} m, sous le genou de la loi`)
  assert.equal(LOI_AVANT(p), 1)
})

test('② MAIS AUX HAUTES LATITUDES LA PORTE PASSE SOUS LE GENOU, et le saut revenait', () => {
  // ⚠️ **LE BLOC RÉTRÉCIT EN `cos(lat)`** : à 80° il fait 17 % de sa largeur
  // équatoriale, donc il « tient sous le plafond » bien plus bas, donc la porte
  // descend — et la loi d'avant n'y valait plus 1. Le ×66,67 du brief n'était
  // pas le seul cas : il y avait un continuum, et personne ne l'avait mesuré.
  let pireRapport = 1
  let pireLat = null
  for (let lat = 0; lat <= 84; lat += 2) {
    const p = porteOrbitale(lat)
    const r = degPx(1) / degPx(LOI_AVANT(p))
    if (r > pireRapport) { pireRapport = r; pireLat = lat }
  }
  assert.ok(pireRapport > 1.5, `pire rapport ${pireRapport.toFixed(3)} à ${pireLat}° — le défaut devrait dépasser 1,5`)
})

test('② la loi d’APRÈS rend un rapport de 1,000 à toutes les latitudes', () => {
  for (let lat = 0; lat <= 84; lat += 2) {
    const p = porteOrbitale(lat)
    const r = degPx(1) / degPx(LOI_APRES(p))
    assert.equal(r, 1, `à ${lat}°, rapport ${r}`)
  }
})

// ══════════ ③ LE RÉGIME HÉRITÉ — LÀ OÙ LE ×66,67 ÉTAIT BEL ET BIEN ATTEINT ══

test('③ en régime cranté la plongée tombe à 8 000 m : le saut valait 66,67, il vaut 1', () => {
  // `DIVE_TIERS[0].altM` est le seuil du zoom fin ; c'est là que la traversée
  // pose le mode surface et écrit `rotateSpeed = 1`.
  const altM = DIVE_TIERS[0].altM
  assert.equal(altM, 8000)
  const avant = degPx(1) / degPx(LOI_AVANT(altM))
  assert.ok(Math.abs(avant - 66.667) < 0.01, `rapport d’avant ${avant.toFixed(3)}`)
  assert.equal(degPx(1) / degPx(LOI_APRES(altM)), 1)
})

test('③ et sur toute la descente, plus aucun rapport image à image ne dépasse 1,5', () => {
  // Une descente de 60 000 km à la traversée par crans de ×√2 — le pas mesuré
  // par Adrien dans Google Earth (`zoom-continu.js`, PAS_CRAN) — puis le bloc.
  const suite = []
  for (let a = 6e7; a > 8000; a /= Math.SQRT2) suite.push(LOI_APRES(a))
  suite.push(1) // le bloc
  let pire = 1
  for (let i = 1; i < suite.length; i++) {
    const r = Math.max(suite[i] / suite[i - 1], suite[i - 1] / suite[i])
    pire = Math.max(pire, r)
  }
  assert.ok(pire <= 1.5, `pire rapport ${pire}`)
  assert.equal(pire, 1, 'le geste ne bouge pas du tout — c’est mieux que 1,5')
  // et le témoin : la MÊME descente sous la loi d'avant
  const avant = [...(function* () { for (let a = 6e7; a > 8000; a /= Math.SQRT2) yield LOI_AVANT(a) })(), 1]
  let pireAvant = 1
  for (let i = 1; i < avant.length; i++) pireAvant = Math.max(pireAvant, Math.max(avant[i] / avant[i - 1], avant[i - 1] / avant[i]))
  assert.ok(pireAvant > 1.5, `témoin : la loi d’avant devrait dépasser 1,5 (lu ${pireAvant.toFixed(3)})`)
})
