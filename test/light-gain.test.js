// La lumière que l'utilisateur POSSÈDE, par-dessus celle que l'heure calcule.
//
// Ces tests gardent la frontière : le cycle garde la FORME (l'astronomie du
// lieu), l'utilisateur garde le NIVEAU. Si un jour un gain se met à déplacer le
// soleil ou à changer le mode jour/nuit, c'est ici que ça doit casser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { lightingFor, applyGains, fillDirection } from '../src/daycycle.js'
import { TEMPLATE_KEYS } from '../src/templates-user.js'

const ANNECY = { lat: 45.9, lon: 6.13 }
const REF = new Date(Date.UTC(2026, 6, 28))

test('applyGains à 1 ne change rien — c est le neutre, donc le défaut', () => {
  const look = lightingFor(14, ANNECY.lat, ANNECY.lon, REF)
  const out = applyGains(look, { sun: 1, hemi: 1, env: 1 })
  assert.equal(out.sunIntensity, look.sunIntensity)
  assert.equal(out.hemiIntensity, look.hemiIntensity)
  assert.equal(out.envIntensity, look.envIntensity)
})

test('applyGains multiplie les trois intensités et RIEN d’autre', () => {
  const look = lightingFor(14, ANNECY.lat, ANNECY.lon, REF)
  const out = applyGains(look, { sun: 2, hemi: 0.5, env: 1.5 })
  assert.equal(out.sunIntensity, look.sunIntensity * 2)
  assert.equal(out.hemiIntensity, look.hemiIntensity * 0.5)
  assert.equal(out.envIntensity, look.envIntensity * 1.5)
  // la géométrie et les couleurs restent au cycle : un gain décale, il ne pilote pas
  assert.equal(out.azimuth, look.azimuth)
  assert.equal(out.elevation, look.elevation)
  assert.equal(out.sunElevation, look.sunElevation)
  assert.equal(out.sunColor, look.sunColor)
  assert.equal(out.hemiSky, look.hemiSky)
  assert.equal(out.mode, look.mode)
})

test('applyGains ne mute pas son entrée', () => {
  const look = lightingFor(14, ANNECY.lat, ANNECY.lon, REF)
  const before = look.sunIntensity
  applyGains(look, { sun: 3, hemi: 3, env: 3 })
  assert.equal(look.sunIntensity, before)
})

test('applyGains borne les gains à [0, 4] et traite l’absence comme 1', () => {
  const look = lightingFor(14, ANNECY.lat, ANNECY.lon, REF)
  assert.equal(applyGains(look, { sun: 99 }).sunIntensity, look.sunIntensity * 4)
  assert.equal(applyGains(look, { sun: -5 }).sunIntensity, 0)
  assert.equal(applyGains(look, { hemi: NaN }).hemiIntensity, look.hemiIntensity)
  assert.equal(applyGains(look, {}).sunIntensity, look.sunIntensity)
  assert.equal(applyGains(look, undefined).sunIntensity, look.sunIntensity)
})

// Le cycle doit rester JUSTE : c'est une position d'Adrien écrite dans
// daycycle.js. Un gain remonte le niveau, il ne fabrique pas un jour qui
// n'existe pas — décembre à 60° N, 18 h, ça reste la nuit, gain ou pas.
test('un gain ne transforme JAMAIS la nuit en jour', () => {
  const DEC = new Date(Date.UTC(2026, 11, 21))
  const night = lightingFor(18, 60, 10, DEC)
  assert.equal(night.mode, 'night')
  const boosted = applyGains(night, { sun: 4, hemi: 4, env: 4 })
  assert.equal(boosted.mode, 'night')
  assert.equal(boosted.sunElevation, night.sunElevation)
  // et midi de juin reste incomparablement plus fort que cette nuit poussée à fond
  const noon = lightingFor(12, 60, 10, new Date(Date.UTC(2026, 5, 21)))
  assert.ok(noon.sunIntensity > boosted.sunIntensity, 'la nuit à gain 4 ne doit pas dépasser midi nu')
})

test('l’appoint est RELATIF au soleil : il suit l’heure sans être réécrit par elle', () => {
  assert.deepEqual(fillDirection(0, 150, 20), { azimuth: 150, elevation: 20 })
  assert.deepEqual(fillDirection(90, 150, 20), { azimuth: 240, elevation: 20 })
})

test('l’azimut de l’appoint reste dans [0, 360[', () => {
  assert.equal(fillDirection(300, 150, 20).azimuth, 90)
  assert.equal(fillDirection(10, -30, 20).azimuth, 340)
})

test('l’élévation de l’appoint est bornée à [-10, 90] — sous terre il n’éclaire rien', () => {
  assert.equal(fillDirection(0, 0, -80).elevation, -10)
  assert.equal(fillDirection(0, 0, 400).elevation, 90)
  assert.equal(fillDirection(NaN, 0, 20).azimuth, 0)
})

test('les gains et l’appoint voyagent dans les gabarits', () => {
  for (const k of ['sunGain', 'hemiGain', 'envGain', 'fillIntensity', 'fillAzimuthOffset', 'fillElevation', 'fillColor']) {
    assert.ok(TEMPLATE_KEYS.includes(k), `${k} manque à TEMPLATE_KEYS — le réglage ne survivrait pas à un export/import`)
  }
})
