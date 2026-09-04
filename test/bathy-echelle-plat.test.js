// ═══════════════════════════════════════════════════════════════════════════
// PLAT — UNE SOURCE NE REDESSINE UN RIVAGE QU'À SON ÉCHELLE.
//
// Adrien, deux fois : « dans les zones côtières du sud de la France, j'ai de
// nombreux carrés plats autour des côtes (…) il doit y avoir un problème de
// fond ». Reproduit en Camargue (43,45 / 4,60).
//
// LA MESURE (scripts/plat-champs.mjs, relevés dans `.banc/PLAT/`) :
//   bloc z17, pas au sol **0,433 m** ; la source bathymétrique qui répond est
//   EMODnet z10, maille **111,8 m** — rapport **258**. La bande de bruit de B5
//   rendait alors à la mer **728 813 pixels de terre franche** (31 % du bloc,
//   terrarium IGN à +0,1…+0,6 m, texturé), en rectangles alignés sur la grille
//   EMODnet, avec une cellule restée émergée au milieu : les carrés plats et le
//   carré blanc dans l'eau.
//
// LA RÈGLE : au-delà de `CELLULE_MAX_PX` pixels de champ par cellule de source,
// la source fine n'est plus fine ICI et perd le droit de RECLASSER de la terre.
// Elle garde tout le reste — elle creuse la mer comme avant, au bit près.
//
// ⛔ CE QUI NE DOIT PAS BOUGER : là où B5 est prouvée nécessaire (Porquerolles
// z13, rapport 16), la sortie doit être IDENTIQUE AU BIT. Mesuré : 0 pixel de
// différence sur les deux lieux z13 du relevé.
// ═══════════════════════════════════════════════════════════════════════════
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CELLULE_MAX_PX,
  NOISE_BAND,
  bandeBruitAdmise,
  detectNoiseFill,
  fuseBathymetry,
  resolutionBathyM,
} from '../src/bathy.js'

const f32 = (a) => Float32Array.from(a)

// Les six lieux du relevé, avec leur maille de source et leur pas de champ.
// (maille, pas, bande attendue) — les nombres viennent de `.banc/PLAT/`.
const LIEUX = [
  ['Porquerolles z13 — B5 nécessaire', 111.8, 6.99, NOISE_BAND],
  ['Camargue z13 — correct', 111.8, 6.94, NOISE_BAND],
  ['Bretagne z15', 101, 1.58, 0],
  ['Camargue z17 — les carrés plats', 111.8, 0.433, 0],
  ['Porquerolles z17', 111.8, 0.434, 0],
  ['fjord de Bergen z15 — GEBCO', 302, 1.18, 0],
]

test('PLAT · la règle d’échelle tranche les six lieux mesurés comme le relevé', () => {
  for (const [nom, maille, pas, attendu] of LIEUX) {
    assert.equal(bandeBruitAdmise(maille, pas), attendu, `${nom} : maille ${maille} m / pas ${pas} m`)
  }
})

test('PLAT · une entrée non mesurable garde le comportement d’avant, AU BIT', () => {
  // Un appelant qui ne sait pas dire son échelle ne doit rien perdre.
  for (const mauvais of [NaN, undefined, null, -1, Infinity]) {
    assert.equal(bandeBruitAdmise(mauvais, 1), NOISE_BAND)
    assert.equal(bandeBruitAdmise(111.8, mauvais), NOISE_BAND)
  }
  assert.equal(bandeBruitAdmise(111.8, 0), NOISE_BAND, 'un pas nul n’est pas une mesure')
})

test('PLAT · la frontière est bien à CELLULE_MAX_PX, des deux côtés', () => {
  const pas = 2
  assert.equal(bandeBruitAdmise(CELLULE_MAX_PX * pas, pas), NOISE_BAND, 'pile à la limite : admise')
  assert.equal(bandeBruitAdmise(CELLULE_MAX_PX * pas + 0.001, pas), 0, 'un cheveu au-delà : refusée')
})

test('PLAT · resolutionBathyM rend la maille d’une tuile bathy de 256 px', () => {
  // EMODnet z10 à 43,00° de latitude : 111,8 m, le nombre du relevé de Porquerolles.
  assert.ok(Math.abs(resolutionBathyM(10, 43.0) - 111.8) < 0.5, resolutionBathyM(10, 43.0))
  // en Camargue (43,45°) la même tuile vaut 111,0 m — le cosinus, pas une erreur.
  assert.ok(Math.abs(resolutionBathyM(10, 43.45) - 111.0) < 0.5, resolutionBathyM(10, 43.45))
  // GEBCO z8 au même endroit : quatre fois plus grossier.
  assert.ok(Math.abs(resolutionBathyM(8, 43.45) - 4 * 110.98) < 2)
  assert.ok(Number.isNaN(resolutionBathyM(-1, 43.45)), 'aucune tuile peinte ⇒ pas de maille')
})

test('PLAT · `noiseBand: 0` ÉTEINT la règle, il ne la rétrécit pas au zéro exact', () => {
  const land = new Float32Array(4096).fill(0) // remplissage à zéro exact
  const sea = new Float32Array(4096).fill(-80)
  assert.equal(detectNoiseFill(land, sea), true, 'témoin : la règle voit bien ce remplissage')
  assert.equal(detectNoiseFill(land, sea, { noiseBand: 0 }), false, 'la bande nulle doit tout éteindre')
})

// ─────────── LE DÉFAUT LUI-MÊME, REJOUÉ SUR UN CHAMP DE CAMARGUE ────────────
//
// Le terrarium : un marais IGN à +0,09…+0,60 m, TEXTURÉ (aucune valeur ne tient
// 10 % du champ, donc `detectFillLevels` n'y voit aucun aplat) — c'est le relevé
// de `.banc/PLAT/sonde/camargue-z17.json` (47 à 72 valeurs distinctes par tuile).
// La source fine : EMODnet, qui donne −2,05 m sur TOUT le champ (elle ne connaît
// pas le delta), à 111,8 m de maille contre 0,433 m de pixel.
function camargue(n = 4096) {
  const land = new Float32Array(n)
  const sea = new Float32Array(n).fill(-2.05)
  for (let i = 0; i < n; i++) land[i] = 0.09 + ((i * 7) % 33) * 0.0155 // +0,09 … +0,59
  return { land, sea }
}

test('PLAT · Camargue : sans la règle, EMODnet noie le marais ; avec elle, la terre tient', () => {
  const { land, sea } = camargue()
  const noye = fuseBathymetry(land, sea) // le comportement d'AVANT
  let sousEau = 0
  for (let i = 0; i < land.length; i++) if (noye[i] < 0) sousEau++
  assert.equal(sousEau, land.length,
    `témoin : sans la règle, la bande de B5 doit noyer TOUT le marais (${sousEau}/${land.length})`)

  // La maille EMODnet (111,8 m) contre le pas du bloc z17 (0,433 m) : rapport 258.
  const bande = bandeBruitAdmise(resolutionBathyM(10, 43.45), 0.433)
  assert.equal(bande, 0, 'la règle doit refuser la bande à cette échelle')
  const tenu = fuseBathymetry(land, sea, { noiseBand: bande })
  for (let i = 0; i < land.length; i++) {
    assert.equal(tenu[i], land[i], `le marais a été creusé au pixel ${i} : ${tenu[i]} au lieu de ${land[i]}`)
  }
})

test('PLAT · le carré blanc dans l’eau : plus aucune cellule ne reste émergée au milieu', () => {
  // Deux cellules EMODnet voisines : l'une un cheveu sous le seuil de bruit,
  // l'autre un cheveu au-dessus. AVANT, la première était noyée et la seconde
  // restait terre — un carré clair au milieu de l'eau, à angles droits.
  const n = 4096, moitie = n / 2
  const land = new Float32Array(n), sea = new Float32Array(n).fill(-2.05)
  for (let i = 0; i < n; i++) land[i] = i < moitie ? 0.55 : 0.65 // 0,55 dedans, 0,65 dehors
  const avant = fuseBathymetry(land, sea)
  let mer = 0, terre = 0
  for (let i = 0; i < n; i++) (avant[i] < 0 ? mer++ : terre++)
  assert.ok(mer > 0 && terre > 0, `témoin : AVANT, le champ doit être coupé en deux (${mer} mer / ${terre} terre)`)

  const apres = fuseBathymetry(land, sea, { noiseBand: bandeBruitAdmise(111.8, 0.433) })
  for (let i = 0; i < n; i++) assert.ok(apres[i] > 0, `pixel ${i} encore immergé : ${apres[i]}`)
})

// ─────────────── ET CE QUI NE DOIT ABSOLUMENT PAS BOUGER ────────────────────

test('PLAT · Porquerolles z13 : la règle laisse passer, et la sortie est identique AU BIT', () => {
  // le champ de B5 : une île, puis une mer que le terrarium remplit d'un bruit
  // positif (+0,2…+0,5) et qu'EMODnet donne à −80 m.
  const n = 4096
  const land = new Float32Array(n), sea = new Float32Array(n)
  const bruit = [0.2, 0.3, 0.4, 0.5, 0.3, 0.4]
  for (let i = 0; i < n; i++) {
    if (i < 1200) { land[i] = 30 + (i % 50); sea[i] = 0 }
    else { land[i] = bruit[i % bruit.length]; sea[i] = -80 - (i % 7) }
  }
  const bande = bandeBruitAdmise(resolutionBathyM(10, 43.0), 6.99) // rapport 16
  assert.equal(bande, NOISE_BAND, 'à z13 la règle ne doit rien refuser')
  const avant = fuseBathymetry(land, sea)
  const apres = fuseBathymetry(land, sea, { noiseBand: bande })
  for (let i = 0; i < n; i++) assert.equal(apres[i], avant[i], `écart au pixel ${i}`)
  // et B5 tient toujours : la mer est bien rendue à EMODnet
  for (let i = 1200; i < n; i++) assert.ok(apres[i] < 0, `plateau de Porquerolles revenu au pixel ${i}`)
})

test('PLAT · la règle ne touche QUE la reclassification : la mer franche est creusée comme avant', () => {
  // référence muette (0 exact) — c'est `NODATA_EPS` qui décide, pas la bande.
  const land = f32([0, 0, 0, 0])
  const sea = f32([-1, -2, -4, -8])
  const avant = fuseBathymetry(land, sea)
  const apres = fuseBathymetry(land, sea, { noiseBand: 0 })
  for (let i = 0; i < 4; i++) assert.equal(apres[i], avant[i], `la mer muette a bougé au pixel ${i}`)
  // référence bavarde sous le niveau : le fondu d'origine, intact
  const bav = f32([-2]), bavSea = f32([-10])
  assert.equal(fuseBathymetry(bav, bavSea, { noiseBand: 0 })[0], fuseBathymetry(bav, bavSea)[0])
})

test('PLAT · un appel sans options reste EXACTEMENT celui d’avant', () => {
  const { land, sea } = camargue(2048)
  const a = fuseBathymetry(land, sea)
  const b = fuseBathymetry(land, sea, {})
  for (let i = 0; i < land.length; i++) assert.equal(a[i], b[i], `divergence au pixel ${i}`)
})
