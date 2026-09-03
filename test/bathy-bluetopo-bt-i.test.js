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
// ⚠️ ON MESURE SUR UN CHAMP DE 256×256, JAMAIS SUR UN PIXEL — et ce n'est pas
// une précaution de style. `detectFillLevels` échantillonne un pixel sur 17
// (`FILL_STEP`) et exige 64 sondes (`FILL_MIN_SONDES`) ; `detectNoiseFill` (B5)
// travaille elle aussi sur une PART du champ. Sur un tableau d'un élément,
// aucune des deux ne se déclenche, et la fonction ne fait pas ce qu'elle fera
// en production. **B2 s'est fait prendre exactement là** (rapport-B2, §⑥-3 :
// « ma sonde travaillait sur des dalles 16×16 … elle ne se déclenchait
// jamais ») — et je m'y suis fait prendre à mon tour, avec l'avertissement écrit
// trois rapports plus haut : ma première version de ce test affirmait −5,21 m,
// ce qui n'est vrai que du pixel isolé.
const TUILE = 256 * 256
const champ = (fLand, fSea) => {
  const L = new Float32Array(TUILE)
  const S = new Float32Array(TUILE)
  for (let i = 0; i < TUILE; i++) {
    L[i] = fLand(i)
    S[i] = fSea(i)
  }
  return [L, S]
}
const moyenne = (x) => {
  let s = 0
  for (const v of x) s += v
  return s / x.length
}
// une baie de 11,6 m, comme la Chesapeake dans nos tuiles
const FOND = (i) => -11.6 + Math.sin(i * 0.01) * 0.4

test('BT-I-3 · la bande de 25 m ampute le fond quand le relief de référence en porte un', () => {
  // ⚡ LE RÉGIME OÙ LA BANDE MORD : le terrarium porte une VRAIE bathymétrie
  // grossière (ETOPO1 côtier, un haut-fond, une pente). Le fondu se pilote alors
  // sur `l`, et à 25 m de bande la source fine sort pondérée à une fraction.
  const regimes = {
    'ETOPO1 côtier, −1 à −20 m': (i) => -1 - 19 * Math.abs(Math.sin(i * 0.0007)),
    'haut-fond, −0,5 à −3 m': (i) => -0.5 - 2.5 * Math.abs(Math.sin(i * 0.0013)),
    'pente, −2 à −40 m': (i) => -2 - 38 * ((i % 256) / 256),
  }
  for (const [nom, fl] of Object.entries(regimes)) {
    const [L, S] = champ(fl, FOND)
    const large = moyenne(fuseBathymetry(L, S, {}))
    const court = moyenne(fuseBathymetry(L, S, { blendDepth: 2 }))
    assert.ok(court < large - 0.5,
      `${nom} : la bande de ${BLEND_DEPTH} m rend ${large.toFixed(2)} m et celle de 2 m ${court.toFixed(2)} m — ` +
      `le raccourcissement doit rendre au moins 0,5 m de fond`)
    assert.ok(court <= moyenne(S) + 1.6,
      `${nom} : à 2 m de bande le fond doit approcher la source (${moyenne(S).toFixed(2)} m), il rend ${court.toFixed(2)} m`)
  }
})

test('BT-I-4 · raccourcir la bande ne peut pas faire émerger un pixel ni bouger un rivage', () => {
  // TERRE — la branche est EN AMONT du fondu : elle sort intacte quoi qu'il
  // arrive. C'est la garantie structurelle des polders, et elle se vérifie sur
  // un champ entier, pas sur un pixel choisi.
  // ⚠️ ON COMMENCE À +1 m, ET PAS À +0,5 m, DEPUIS B5. Le terrarium Mapterhorn
  // est servi en `.webp` LOSSY : son zéro de mer ressort à 0 ± 0,5 m, des deux
  // côtés du signe. B5 a donc posé une BANDE DE BRUIT (|h| ≤ 0,6 m sur ≥ 10 %
  // des pixels que la source fine dit < −2 m ⇒ absence, signe compris), parce
  // qu'autour de Porquerolles un terrarium à +0,2/+0,5 m était classé TERRE et
  // interdisait de lire les −80 m d'EMODnet dessous.
  // ⛔ Un pixel à +0,5 m qui devient de la mer N'EST PAS un rivage déplacé :
  // c'est du bruit de compression reconnu comme tel. Ma première version de ce
  // test l'a compté comme une régression — c'était le test qui datait, pas le
  // code. La garantie que ce test doit défendre porte sur la terre RÉELLE,
  // c'est-à-dire au-dessus de la bande de bruit.
  for (const alt of [1, 5, 120, 3000]) {
    const [L, S] = champ(() => alt, () => -50)
    const out = fuseBathymetry(L, S, { blendDepth: 2 })
    for (const v of out) assert.equal(v, alt, `la terre à ${alt} m a bougé`)
  }
  // MER — la source fine ne peut que CREUSER sous le niveau, jamais émerger,
  // même à bande courte. Un seul pixel ressorti positif serait un rivage déplacé.
  for (const fond of [-0.01, -0.5, -2, -11.63]) {
    const [L, S] = champ(() => 0, () => fond)
    for (const v of fuseBathymetry(L, S, { blendDepth: 2 }))
      assert.ok(v <= 0, `un fond de ${fond} m est ressorti à ${v} m, donc émergé`)
  }
  // Et un littoral MIXTE : la moitié terre, la moitié mer. Aucun pixel de terre
  // ne doit bouger, aucun pixel de mer ne doit émerger.
  const [L, S] = champ((i) => (i % 512 < 256 ? 3 : 0), () => -11.63)
  const out = fuseBathymetry(L, S, { blendDepth: 2 })
  for (let i = 0; i < TUILE; i++) {
    if (i % 512 < 256) assert.equal(out[i], 3, 'un pixel de terre du littoral a bougé')
    else assert.ok(out[i] <= 0, 'un pixel de mer du littoral a émergé')
  }
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
