// BT-I — CE QUE L'INTÉGRATION BLUETOPO A CHANGÉ, ET CE QU'ELLE NE DOIT PAS CHANGER.
//
// Trois défauts silencieux ont été corrigés pendant cette tâche. Chacun avait la
// même signature : le fichier juste, le code juste, et le nombre qui n'arrive
// jamais. Ces tests existent pour que le silence redevienne bruyant.
//
// ⚠️ AUCUN de ces tests n'a besoin d'un serveur ni d'un Chrome : ils portent sur
// les modules PURS. La mesure au GPU vit dans `test/attaque-bt-ROUGE.mjs`, qui
// n'est pas dans la liste `test` de package.json pour cette raison-là.

import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIndex, zoneAt, SOURCES, creditsForBounds, BATHY_BASE_ZMAX } from '../src/bathy-sources.js'
import { fuseBathymetry, BLEND_DEPTH } from '../src/bathy.js'

const idxAvec = (extra) =>
  normalizeIndex({
    base: { source: 'gebco', zmax: 8 },
    zmin: 4,
    zones: [{ id: 'z', source: 'bluetopo', zmax: 13, bbox: [-76.5, 36.9, -75.9, 37.6], ...extra }],
  })

// ─── ① LA LISTE BLANCHE DE `normalizeIndex` — le troisième champ à la franchir ─
//
// `waterLevelM` y avait été jeté en silence (B2 l'a mesuré, B3 l'a corrigé).
// `blendDepthM` est exactement le même piège : sans cette recopie, la zone
// porterait le nombre, `fuseBathymetry` l'accepterait, et la bande de 25 m
// s'appliquerait quand même.
test('BT-I-1 · normalizeIndex recopie blendDepthM, comme il recopie waterLevelM', () => {
  const z = zoneAt(idxAvec({ blendDepthM: 2 }), 37.0, -76.05)
  assert.equal(z.blendDepthM, 2, 'blendDepthM PERDU dans la liste blanche')
  const deux = zoneAt(idxAvec({ blendDepthM: 2, waterLevelM: 100 }), 37.0, -76.05)
  assert.equal(deux.blendDepthM, 2)
  assert.equal(deux.waterLevelM, 100, 'les deux champs doivent coexister')
})

test('BT-I-2 · un blendDepthM absent, nul ou absurde laisse le défaut de 25 m intact', () => {
  // ⚠️ C'est ce test qui garantit que la carte du monde entier n'a PAS bougé :
  // aucune zone préexistante ne porte le champ, donc aucune ne change.
  for (const mauvais of [undefined, null, 0, -3, 'deux', NaN]) {
    const z = zoneAt(idxAvec(mauvais === undefined ? {} : { blendDepthM: mauvais }), 37.0, -76.05)
    assert.equal(z.blendDepthM, undefined, `blendDepthM = ${String(mauvais)} aurait dû être ignoré`)
  }
})

// ─── ② LA BANDE DE FONDU, SUR LES VRAIES VALEURS MESURÉES ────────────────────
//
// Le fondu de `fuseBathymetry` se sert de la PROFONDEUR comme substitut de la
// DISTANCE À LA CÔTE. Le substitut est bon à 464 m de résolution (un fond de
// 25 m tient dans un pixel de rivage) et faux à 4 m : l'embouchure de la
// Chesapeake fait 11,6 m de fond à 20 km de toute côte.
//
// Les nombres ci-dessous ont été relevés en exécutant `fuseBathymetry` sur les
// valeurs de nos propres tuiles, et vérifiés au GPU (le globe rendait −5,2 m).
test('BT-I-3 · la bande de 25 m amputait de 55 % un fond de baie ; 2 m le rend entier', () => {
  const un = (l, s, o) => fuseBathymetry(Float32Array.from([l]), Float32Array.from([s]), o)[0]
  // La baie, telle que nos tuiles la portent
  assert.ok(Math.abs(un(0, -11.63, {}) - -5.21) < 0.02,
    `le défaut de ${BLEND_DEPTH} m doit rendre −5,21 m — il rend ${un(0, -11.63, {}).toFixed(2)}`)
  assert.ok(Math.abs(un(0, -11.63, { blendDepth: 2 }) - -11.63) < 0.02,
    'avec une bande de 2 m, le fond doit sortir ENTIER')
  // ⚡ ET LA BANDE EST SANS EFFET DÈS QU'ON QUITTE LE RÉGIME DES BAIES : ce
  // n'est donc pas un réglage global déguisé, c'est une correction locale.
  for (const fond of [-27.25, -31, -44.5, -198, -2200])
    assert.equal(un(0, fond, {}), un(0, fond, { blendDepth: 2 }),
      `à ${fond} m, les deux bandes doivent donner le MÊME nombre`)
})

test('BT-I-4 · raccourcir la bande ne peut pas faire émerger un pixel ni bouger un rivage', () => {
  const un = (l, s, o) => fuseBathymetry(Float32Array.from([l]), Float32Array.from([s]), o)[0]
  // TERRE : la branche est en amont du fondu, elle sort intacte quoi qu'il arrive
  for (const l of [0.5, 5, 120, 3000])
    assert.equal(un(l, -50, { blendDepth: 2 }), l, `la terre à ${l} m a bougé`)
  // MER : la source fine ne peut que creuser, jamais émerger — même à bande courte
  for (const s of [-0.01, -0.5, -2, -11.63])
    assert.ok(un(0, s, { blendDepth: 2 }) < 0, `un fond de ${s} m est ressorti émergé`)
  // Un fond ne peut pas devenir plus haut que le niveau sous une bande courte
  assert.ok(un(0, -0.001, { blendDepth: 2 }) <= 0)
})

// ─── ③ LE CATALOGUE ET LES LICENCES ──────────────────────────────────────────
test('BT-I-5 · BlueTopo et NCEI sortent leur crédit sur les emprises couvertes', () => {
  const idx = normalizeIndex({
    base: { source: 'gebco', zmax: 8 },
    zones: [
      { id: 'chesapeake', source: 'bluetopo', zmax: 13, bbox: [-76.5, 36.9, -75.9, 37.6] },
      { id: 'erie', source: 'ncei', zmax: 10, bbox: [-84, 41, -78, 43], waterLevelM: 173.8 },
    ],
  })
  const baie = creditsForBounds(idx, { minLat: 37.0, maxLat: 37.1, minLon: -76.1, maxLon: -76.0 })
  assert.ok(baie.includes(SOURCES.bluetopo.credit), 'le crédit BlueTopo ne SORT PAS sur la Chesapeake')
  const lac = creditsForBounds(idx, { minLat: 42.0, maxLat: 42.1, minLon: -81.5, maxLon: -81.4 })
  assert.ok(lac.includes(SOURCES.ncei.credit), 'le crédit NCEI ne SORT PAS sur le lac Érié')
  // ⚠️ et il ne sort PAS ailleurs : un crédit de trop est aussi une faute.
  const large = creditsForBounds(idx, { minLat: 37, maxLat: 38, minLon: -70, maxLon: -69 })
  assert.equal(large.includes(SOURCES.bluetopo.credit), false, 'BlueTopo cité hors de sa zone')
})

test('BT-I-6 · chaque source du catalogue porte une licence et un crédit exploitables', () => {
  for (const [id, s] of Object.entries(SOURCES)) {
    assert.equal(s.id, id, `l'entrée ${id} ne porte pas son propre identifiant`)
    assert.ok(s.credit && s.credit.length > 10, `${id} : crédit vide ou tronqué`)
    assert.ok(s.license && s.license.length > 5, `${id} : licence absente`)
    assert.equal(s.notForNavigation, true, `${id} : la mention de non-navigation manque`)
    assert.ok(Number.isFinite(s.resolutionM) && s.resolutionM > 0, `${id} : résolution non chiffrée`)
  }
  // NCEI est du domaine public fédéral américain, comme BlueTopo : c'est ce qui
  // autorise à la redistribuer. Si la chaîne change, on veut le savoir.
  assert.match(SOURCES.ncei.license, /17 U\.S\.C\./)
  assert.equal(SOURCES.bluetopo.license, 'CC0-1.0')
})

// ─── ④ UN PLAFOND DE ZONE NE DESCEND JAMAIS SOUS LE SOCLE ────────────────────
test('BT-I-7 · une zone BlueTopo mal déclarée ne peut pas creuser un trou sous le socle', () => {
  const idx = normalizeIndex({
    base: { source: 'gebco', zmax: 8 },
    zones: [{ id: 'z', source: 'bluetopo', zmax: 3, bbox: [-76.5, 36.9, -75.9, 37.6], blendDepthM: 2 }],
  })
  assert.equal(zoneAt(idx, 37.0, -76.05).zmax, BATHY_BASE_ZMAX)
})
