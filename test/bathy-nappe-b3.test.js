// ═══════════════════════════════════════════════════════════════════════════
// B3 — LA NAPPE, LA SENTINELLE, ET LE PLANCHER QUI SAIT SE TAIRE
//
// Trois règles nouvelles, trois façons de tout casser. Chacune de ces
// assertions vient d'un défaut MESURÉ, pas d'une précaution :
//
//   · SANS la sentinelle, une nappe de lac creuse la terre située sous sa cote.
//     B2 l'a mesuré sur l'exutoire du Rhône à Genève : **347,67 m de vallée**.
//   · SANS la nappe comme base du fondu, la source fine sort pondérée à ~1 % :
//     le Léman rendait **371,63 m au lieu de 62** (B2, contrôle ②).
//   · SANS `waterLevelM` dans `normalizeIndex`, le fichier est juste, le code
//     est juste, et le nombre n'arrive jamais (B2, vérifié à l'exécution).
//   · SANS le garde `level > 0`, tout ce qui précède changerait le chemin
//     MARIN — celui qui porte 21 556 tuiles et toute la carte.
//   · Et le PLANCHER : il protège l'ETOPO1 du terrarium, donc il ne doit
//     s'effacer QUE là où il n'y a pas d'ETOPO1 à protéger.
// ═══════════════════════════════════════════════════════════════════════════
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fuseBathymetry } from '../src/bathy.js'
import { normalizeIndex, zoneAt } from '../src/bathy-sources.js'

const f32 = (a) => Float32Array.from(a)

// ── ① LA SENTINELLE : sous une nappe, un échantillon NUL est une ABSENCE ────
//
// Le tuileur marin écrit `0` pour « ce pixel n'est pas de la mer »
// (`raw = m == null || m >= 0 ? 0 : m`). Tant que le niveau vaut 0, ce marqueur
// est attrapé par `s >= level`. Dès qu'une nappe de lac le relève à 456 m, le
// même `0` passe pour un fond situé 456 m sous la surface du lac — et TOUTE la
// terre sous la cote se fait creuser.
test('B3 · nappe : un échantillon nul ne creuse PAS la terre située sous la cote du lac', () => {
  // la géographie du piège : l'exutoire du Rhône sort du Léman à 371 m et perd
  // 100 m en quelques kilomètres. Tout est SOUS la nappe.
  const terre = f32([371, 340, 310, 280, 372, 372])
  const mer = f32([0, 0, 0, 0, 0, 0]) // « pas de la mer » — le marqueur du tuileur
  const out = fuseBathymetry(terre, mer, { seaLevel: 372.55 })
  for (let i = 0; i < terre.length; i++) {
    assert.equal(out[i], terre[i], `pixel ${i} déplacé : ${terre[i]} → ${out[i]}`)
  }
})

// ── ② LA NAPPE PILOTE LE FONDU, SINON LA SOURCE FINE EST MUSELÉE ───────────
//
// `t = smooth((level − l) / blend)` avec blend = 25 m : à 1,5 m sous la nappe,
// t ≈ 0,01. Piloter le fondu sur `l` — c'est-à-dire sur la cote de l'eau, la
// seule chose que le terrarium sache dire d'un lac — pondère la source fine à
// 1 % et rend la surface, pas le fond.
test('B3 · nappe : le fond du lac sort ENTIER, pas pondéré à 1 % par le fondu', () => {
  const terre = f32([372.05, 372.05, 372.05]) // ce que le terrarium sait d'un lac : sa surface
  const mer = f32([62.05, 62.05, 62.05]) // ce que swissBATHY3D en dit : le fond
  const out = fuseBathymetry(terre, mer, { seaLevel: 372.55 })
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(out[i] - 62.05) < 0.5,
      `le fond est ressorti à ${out[i].toFixed(2)} m au lieu de 62,05 — le fondu a muselé la source`
    )
  }
})

// ── ③ LE CHEMIN MARIN NE BOUGE PAS D'UN BIT ────────────────────────────────
//
// C'est la garantie qui rend les deux règles ci-dessus déployables : elles sont
// gardées par `level > 0`. Sans ce test, une nappe mal placée les appliquerait
// aux 21 556 tuiles marines sans que rien ne le dise.
test('B3 · le garde `level > 0` : à niveau zéro, la fusion marine est identique AU BIT', () => {
  // un échantillon de chaque cas : terre, absence, mer franche, littoral, nodata
  const terre = f32([1234, 0, -2500, -12, -3, 240, -0.001, -60])
  const mer = f32([-800, -1850, -4000, -30, 0, -4000, -120, NaN])
  // ⚠️ CES HUIT NOMBRES SONT UN GEL, PAS UN RECALCUL. Ils ont été relevés en
  // exécutant `fuseBathymetry` du commit 27b01f9 — c'est-à-dire AVANT B3 — sur
  // exactement cette entrée. S'ils changent, c'est le chemin marin qui a bougé,
  // et aucun raisonnement ne doit servir à les réécrire.
  // ⚠️ Le pixel 3 vaut −20,4603 et NON −30 : le fondu s'applique (le terrarium
  // dit −12, donc il PARLE, donc il pilote). Je l'avais écrit −30 de tête et le
  // test m'a repris — c'est très exactement ce qu'on lui demande.
  const attendu = [1234, -1850, -4000, -20.4603, -3, 240, -120, -60]
  const out = fuseBathymetry(terre, mer) // AUCUNE option : exactement l'appel de production
  for (let i = 0; i < attendu.length; i++) {
    assert.ok(
      Math.abs(out[i] - attendu[i]) < 0.6,
      `pixel ${i} : ${out[i]} au lieu de ${attendu[i]} — le chemin marin a changé`
    )
  }
  // et l'appel avec `{}` doit valoir l'appel sans options
  const out2 = fuseBathymetry(terre, mer, {})
  for (let i = 0; i < out.length; i++) assert.equal(out2[i], out[i])
})

// ── ④ `waterLevelM` DOIT SURVIVRE À LA LISTE BLANCHE ───────────────────────
test('B3 · normalizeIndex conserve `waterLevelM`, et l ignore s il n est pas un nombre', () => {
  const idx = normalizeIndex({
    version: 1,
    base: { source: 'gebco', zmax: 8 },
    zmin: 4,
    zones: [
      { id: 'baikal', source: 'gebco', zmax: 8, waterLevelM: 455.5, bbox: [103.5, 51.3, 110.1, 56] },
      { id: 'marine', source: 'emodnet', zmax: 10, bbox: [-6, 41, 10, 52] },
      { id: 'absurde', source: 'gebco', zmax: 8, waterLevelM: 'haut', bbox: [0, 0, 1, 1] },
    ],
  })
  const lac = idx.zones.find((z) => z.id === 'baikal')
  assert.equal(lac.waterLevelM, 455.5, 'la nappe a été jetée par la liste blanche')

  // une zone marine ne doit PAS acquérir de nappe au passage : `undefined` est
  // ce qui rend le comportement d'origine, et `0` ne le rendrait pas.
  const mer = idx.zones.find((z) => z.id === 'marine')
  assert.equal('waterLevelM' in mer, false, 'une zone marine a hérité d une nappe')

  const absurde = idx.zones.find((z) => z.id === 'absurde')
  assert.equal('waterLevelM' in absurde, false, 'une nappe non numérique a été recopiée')

  // et la nappe doit être RETROUVABLE par le point, c'est-à-dire par le chemin
  // que `dem.js` et `globe.js` empruntent réellement.
  assert.equal(zoneAt(idx, 53.5, 108.1)?.waterLevelM, 455.5)
  assert.equal(zoneAt(idx, 43.0, 5.9)?.waterLevelM, undefined, 'la Méditerranée a une nappe ?')
})

// ── ⑤ LA NAPPE NE FAIT PAS ÉMERGER, ELLE NE FAIT QUE CREUSER ───────────────
//
// La règle du module depuis la session polders, appliquée au lac : une source
// fine qui prétendrait un fond AU-DESSUS de la nappe ne doit pas soulever l'eau.
test('B3 · nappe : la source fine ne peut pas faire remonter le fond au-dessus de la cote', () => {
  const terre = f32([372.05])
  const mer = f32([400]) // absurde : un « fond » 28 m au-dessus de la surface
  const out = fuseBathymetry(terre, mer, { seaLevel: 372.55 })
  // ⚠️ tolérance, et pas `assert.equal` : `Float32Array` rend 372,04998779…
  // Comparer un Float32 à un littéral double fait échouer un test qui a raison.
  assert.ok(Math.abs(out[0] - 372.05) < 1e-3, `un échantillon émergé doit laisser le terrarium intact : ${out[0]}`)
})

// ── ⑥ UNE MONTAGNE DANS L EMPRISE D UN LAC RESTE UNE MONTAGNE ──────────────
//
// La bbox d'un lac est un rectangle : elle embarque forcément du relief. Un
// pixel AU-DESSUS de la nappe est de la terre, et la branche terre le rend
// inchangé — mais seulement si `noData` ne le réclame pas au passage.
test('B3 · nappe : le relief au-dessus de la cote du lac ne bouge pas', () => {
  const terre = f32([1500, 2400, 800, 373, 455])
  const mer = f32([-200, -200, -200, -200, -200])
  const out = fuseBathymetry(terre, mer, { seaLevel: 372.55 })
  for (let i = 0; i < 3; i++) assert.equal(out[i], terre[i], `sommet ${i} déplacé`)
  assert.equal(out[3], 373, 'un pixel juste au-dessus de la cote a bougé')
})
