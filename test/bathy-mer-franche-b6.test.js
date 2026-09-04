// ═══════════════════════════════════════════════════════════════════════════
// B6 — DEUX ABSENCES NE FONT PAS UNE TERRE.
//
// PLAT et VETO ont travaillé sur les QUATRE portes qui mettent un pixel SOUS
// l'eau. Le défaut de Rodrigues (vidéo d'Adrien, −19,7253 / 63,3691, une île
// minuscule au milieu de 4 000 m de fond) est le SENS INVERSE, et il n'a qu'une
// sortie dans `fuseBathymetry` :
//
//     if (s >= level || sMuet) { out[i] = l }      et      if (!isFinite(s)) { out[i] = l }
//
// Ce sont les DEUX SEULS endroits du module où un pixel ressort ÉMERGÉ alors
// que la source marine a été consultée. Ils sont justes tant que `l` mesure
// quelque chose. En pleine mer profonde `l` ne mesure RIEN : la tuile terrarium
// de Rodrigues rend 0,000 m PILE sur 262 144 pixels sur 262 144 (mesuré,
// `scripts/b6-rodrigues.mjs`). Deux absences — et le code rendait celle qui
// veut dire TERRE.
//
// CE FICHIER VERROUILLE LES DEUX MOITIÉS :
//   ① la règle mord : sous un trait de côte qui déclare franchement la pleine
//     mer, une double absence ne peut plus sortir émergée ;
//   ⛔ ② ELLE NE MORD NULLE PART AILLEURS. La terre franche, le pixel déjà
//     négatif, la nappe de lac, l'appel sans option : identiques AU BIT. Un
//     garde qui aurait fermé plus large aurait fabriqué de la mer — c'est
//     l'erreur symétrique de celle que VETO a évitée sur le Vaccarès.
// ═══════════════════════════════════════════════════════════════════════════
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BLEND_DEPTH, NOISE_BAND, fuseBathymetry } from '../src/bathy.js'

// ⚠️ `Math.fround` : la sortie est un Float32Array, et −0,05 n'y est pas
// représentable exactement (−0,05000000074505806). Comparer au double nu fait
// échouer un test JUSTE — le piège coûte cinq minutes à chaque fois.
const SEA_EPS = Math.fround(0.05) // la constante privée de src/bathy.js

/** Un champ carré rempli d'une valeur, ou d'une fonction de (x, y). */
const champ = (n, v) => {
  const a = new Float32Array(n * n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) a[y * n + x] = typeof v === 'function' ? v(x, y) : v
  return a
}

// ── ① LA RÈGLE MORD — et sans elle, le défaut est là ────────────────────────

test('MUTATION — sans `merFranche`, une double absence sort ÉMERGÉE (le défaut, gelé)', () => {
  // Le champ de Rodrigues, réduit : terrarium muet à 0,000 pile, bathymétrie
  // NON PEINTE (la tuile n'existe pas, `SHELF = −500` l'a écartée à la cuisson).
  const land = champ(16, 0)
  const sea = champ(16, NaN)
  const out = fuseBathymetry(land, sea)
  let emerges = 0
  for (const v of out) if (v >= 0) emerges++
  assert.equal(emerges, 256, 'le défaut n est plus reproduit : ce test ne prouve plus rien')
})

test('la double absence NON PEINTE passe à l eau quand la côte dit pleine mer', () => {
  const land = champ(16, 0)
  const sea = champ(16, NaN)
  const out = fuseBathymetry(land, sea, { merFranche: true })
  for (const v of out) assert.equal(v, Math.fround(-0.05), `${v} au lieu de ${Math.fround(-0.05)}`)
})

test('MUTATION — sans `merFranche`, un DÉPASSEMENT DU CUBIQUE sort émergé', () => {
  // Mesuré (`scripts/b6-porte.mjs`, tuile bathy z8 171/142 au large de
  // Rodrigues) : la tuile brute a pour MAXIMUM 0,00 m exactement — 79 pixels de
  // haut-fond que le tuileur aplatit — et le champ rééchantillonné en
  // Catmull-Rom monte à +6,18 m. 257 pixels franchissent alors `s >= level`.
  const land = champ(8, 0)
  const sea = champ(8, (x) => (x === 3 ? 6.25 : -3200))
  const out = fuseBathymetry(land, sea)
  for (let y = 0; y < 8; y++) {
    assert.equal(out[y * 8 + 3], 0, 'la colonne du dépassement ne sort plus émergée : défaut non reproduit')
    assert.ok(out[y * 8 + 2] < -100, 'la colonne voisine devrait être au fond')
  }
})

test('le DÉPASSEMENT DU CUBIQUE passe à l eau quand la côte dit pleine mer', () => {
  const land = champ(8, 0)
  const sea = champ(8, (x) => (x === 3 ? 6.25 : -3200))
  const out = fuseBathymetry(land, sea, { merFranche: true })
  for (let y = 0; y < 8; y++) assert.equal(out[y * 8 + 3], Math.fround(-0.05))
})

test('⛔ ON N INVENTE PAS DE PROFONDEUR — jamais le fond voisin, toujours `level − SEA_EPS`', () => {
  // Le piège serait de « boucher » avec la profondeur d'à côté : ce serait une
  // mesure fabriquée, exactement la faute que PLAT a refusée en écartant la
  // voie B de son brief. On rend de l'EAU, la moins profonde possible.
  const land = champ(8, 0)
  const sea = champ(8, (x) => (x === 3 ? NaN : -4043.2))
  const out = fuseBathymetry(land, sea, { merFranche: true })
  for (let y = 0; y < 8; y++) {
    assert.equal(out[y * 8 + 3], Math.fround(-0.05), 'une profondeur a été inventée')
    assert.ok(out[y * 8 + 2] < -4000)
  }
})

// ── ⛔ ② ELLE NE MORD NULLE PART AILLEURS ───────────────────────────────────

test('⛔ LA TERRE FRANCHE NE BOUGE PAS, même en mer franche déclarée', () => {
  // Un îlot que le trait de côte OSM ignore (trop petit, ou pas encore
  // cartographié) mais que le terrarium mesure : il reste terre, au bit.
  const land = champ(8, (x, y) => (x === 4 && y === 4 ? 67.5 : 0))
  const sea = champ(8, NaN)
  const out = fuseBathymetry(land, sea, { merFranche: true })
  assert.equal(out[4 * 8 + 4], 67.5)
})

test('⛔ UN PIXEL DÉJÀ NÉGATIF DU TERRARIUM garde sa valeur — ce n est pas une absence', () => {
  const land = champ(8, -12.5)
  const sea = champ(8, NaN)
  const avant = fuseBathymetry(land, sea)
  const apres = fuseBathymetry(land, sea, { merFranche: true })
  for (let i = 0; i < apres.length; i++) {
    assert.equal(apres[i], -12.5)
    assert.equal(apres[i], avant[i])
  }
})

test('⛔ SOUS UNE NAPPE DE LAC DÉCLARÉE, LA RÈGLE EST ÉTEINTE', () => {
  // `merFranche` parle de la côte MARINE ; elle n'a rien à dire sous un lac.
  // Sans cette extinction, le marqueur de terre `0` du tuileur (sentinelle B3)
  // se ferait noyer sous la cote du lac — la régression que B2 a mesurée à
  // 347,67 m de vallée détruits sur l'exutoire du Rhône.
  const land = champ(8, 0)
  const sea = champ(8, 0)
  const opts = { seaLevel: 372.55 }
  const avant = fuseBathymetry(land, sea, opts)
  const apres = fuseBathymetry(land, sea, { ...opts, merFranche: true })
  for (let i = 0; i < apres.length; i++) assert.equal(apres[i], avant[i], 'la règle a mordu sous une nappe')
})

test('⛔ IDENTITÉ AU BIT — sans `merFranche`, sur un champ côtier réaliste', () => {
  // Un rivage : terre en haut, bruit de remplissage à la limite, mer franche en
  // bas ; la source fine creuse. C'est le champ que B5, PLAT et VETO se
  // partagent, et aucun bit ne doit bouger quand l'option est absente.
  const n = 24
  const land = champ(n, (x, y) => (y < 8 ? 40 - y * 4 : y < 11 ? 0.3 : 0))
  const sea = champ(n, (x, y) => (y < 6 ? 0 : -(y - 5) * 12))
  const ref = fuseBathymetry(land, sea, { noiseBand: NOISE_BAND, blendDepth: BLEND_DEPTH })
  for (const val of [undefined, false, 0, null, 'oui', 1]) {
    const out = fuseBathymetry(land, sea, { noiseBand: NOISE_BAND, blendDepth: BLEND_DEPTH, merFranche: val })
    for (let i = 0; i < ref.length; i++) {
      assert.equal(out[i], ref[i], `merFranche=${String(val)} a changé le pixel ${i}`)
    }
  }
})

test('⛔ `merFranche` N EST PAS UN VETO À L ENVERS — il ne retire jamais d eau', () => {
  const n = 24
  const land = champ(n, (x, y) => (y < 8 ? 40 - y * 4 : 0))
  const sea = champ(n, (x, y) => (y < 6 ? 0 : -(y - 5) * 12))
  const avant = fuseBathymetry(land, sea)
  const apres = fuseBathymetry(land, sea, { merFranche: true })
  for (let i = 0; i < apres.length; i++) {
    if (avant[i] < 0) assert.ok(apres[i] < 0, `le pixel ${i} a perdu son eau : ${avant[i]} → ${apres[i]}`)
    assert.ok(apres[i] <= avant[i], `le pixel ${i} a été REMONTÉ : ${avant[i]} → ${apres[i]}`)
  }
})

test('⛔ LA RÈGLE NE PEUT QUE DESCENDRE — sur un champ aléatoire, jamais un pixel plus haut', () => {
  // Contre-épreuve large : mille champs pseudo-aléatoires mélangeant terre,
  // zéros muets, remplissages et vraies profondeurs. La propriété « B6 ne
  // remonte jamais un pixel » est ce qui rend le correctif sûr pour la terre.
  let graine = 20260904
  const rnd = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let essai = 0; essai < 200; essai++) {
    const n = 12
    const land = champ(n, () => (rnd() < 0.3 ? 0 : rnd() < 0.5 ? rnd() * 50 : -rnd() * 30))
    const sea = champ(n, () => (rnd() < 0.2 ? NaN : rnd() < 0.1 ? rnd() * 3 : -rnd() * 4000))
    const avant = fuseBathymetry(land, sea)
    const apres = fuseBathymetry(land, sea, { merFranche: true })
    for (let i = 0; i < apres.length; i++) {
      assert.ok(apres[i] <= avant[i] || Number.isNaN(avant[i]), `essai ${essai} pixel ${i} : ${avant[i]} → ${apres[i]}`)
    }
  }
})

// ── ③ LE JUGE LUI-MÊME : `merFranche` n'affirme que ce qu'il a vérifié ──────

test('⛔ `merFranche` est FAUX sans consultation possible — jamais par défaut', async () => {
  // Trois abstentions, et aucune ne doit passer pour « pleine mer » : une
  // grille dégénérée, une emprise HORS DU MONDE (la fenêtre continue enjambe
  // l'antiméridien en sortant de [0,1] — c'est la borne que VETO a posée), et
  // une fenêtre inversée. Aucune ne touche le réseau : le test reste pur.
  const { merFranche } = await import('../src/coast-veto.js')
  const base = { largeur: 8, hauteur: 8, metresParCellule: 500, zoom: 9 }
  const cas = [
    { nom: 'largeur nulle', o: { ...base, largeur: 0, u0: 0.4, u1: 0.5, v0: 0.4, v1: 0.5 } },
    { nom: 'hors du monde à l ouest', o: { ...base, u0: -0.01, u1: 0.5, v0: 0.4, v1: 0.5 } },
    { nom: 'hors du monde à l est', o: { ...base, u0: 0.4, u1: 1.01, v0: 0.4, v1: 0.5 } },
    { nom: 'fenêtre inversée', o: { ...base, u0: 0.5, u1: 0.4, v0: 0.4, v1: 0.5 } },
  ]
  for (const { nom, o } of cas) {
    assert.equal(await merFranche({ ...o, cle: `b6/${nom}` }), false, `« ${nom} » a été pris pour de la pleine mer`)
  }
})

test('⛔ `vetoTerre` GARDE SON CONTRAT — `null` quand la côte ne déclare rien', async () => {
  // B6 ajoute une seconde lecture à la même promesse ; le veto de VETO ne doit
  // pas changer d'un bit pour autant. Sur une abstention, il rend toujours
  // `null`, et la fusion se comporte alors exactement comme avant.
  const { vetoTerre } = await import('../src/coast-veto.js')
  const o = { largeur: 8, hauteur: 8, metresParCellule: 500, zoom: 9, u0: -0.01, u1: 0.5, v0: 0.4, v1: 0.5, cle: 'b6/contrat' }
  assert.equal(await vetoTerre(o), null)
})
