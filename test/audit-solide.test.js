// L'AUDIT DU SOLIDE — Tâche 5 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ CE QUE CE FICHIER GARDE ═════════════════════════════════════════
//
//   ① LE BANC — un solide de type « fenêtre » (nappe de dessus, quatre parois,
//      dalle), dont le volume est vérifié CONTRE UNE VALEUR FERMÉE (`côté² ×
//      profondeur`) avant qu'on lui fasse confiance. ⚠️ Le plan prévient : « si
//      vos six échouent du premier coup, c'est votre banc qu'il faut
//      suspecter » — donc le banc se vérifie d'abord tout seul ;
//   ② LES SIX SABOTAGES — solide retourné, dalle absente, mur manquant, trou
//      central, triangle dégénéré, NaN. Chacun doit être REFUSÉ ;
//   ③ LA MESURE QUI A FAIT ÉCHOUER DEUX VERSIONS DU PLAN — le volume signé
//      SEUL laisse passer trois sabotages sur six. Ce test rejoue la mesure et
//      la verrouille : c'est lui qui interdit de revenir en arrière ;
//   ④ LA NON-VACUITÉ — sur une géométrie vide l'audit REFUSE de se prononcer
//      (`ferme === null`), au lieu de la déclarer saine. C'est ainsi que le
//      test de silhouette du prototype passait à vide ;
//   ⑤ LES DEUX EPSILONS, MESURÉS ET NON DEVINÉS — la marge du seuil de
//      dégénérescence sur la fenêtre la PLUS FINE (n = 768), et le plus petit
//      défaut que le seuil de fermeture attrape ;
//   ⑥ L'INTERFACE — deux arguments et non un, les formes d'entrée acceptées,
//      et **le discriminant que la Tâche 6 attend** : un pavé droit à hauteurs
//      nulles ne doit pas pouvoir se faire passer pour un rééchantillonnage ;
//   ⑦ CE QUE L'AUDIT NE VOIT PAS — écrit noir sur blanc, avec sa preuve : deux
//      coques passées ensemble peuvent se masquer l'une l'autre.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  auditerSolide,
  EPS_FERMETURE,
  EPS_DEGENERE,
  EPS_VOLUME,
  PLAFOND_HAUTEURS,
} from '../src/monde/audit-solide.js'

// ════════════════════════════════════════════════════════════════════════════
// ① LE BANC
// ════════════════════════════════════════════════════════════════════════════
//
// Un solide « fenêtre » : une nappe de dessus (n × n mailles), quatre parois
// dont les sommets hauts SONT les sommets de bord de la nappe, et une dalle
// plane. Les quatre groupes sont rendus séparément — c'est ce qui permet d'en
// retirer un pour fabriquer un sabotage.
//
// Repère : x et z horizontaux, y vertical (convention du dépôt : `plinth.js`
// calcule `baseY = pointLePlusBas - profondeur`). Enroulement direct vu de
// l'extérieur : la nappe regarde +Y, la dalle -Y, chaque paroi vers le dehors.

const COTE = 56 // `TERRAIN_SIZE` (`terrain.js:57`)
const PROFONDEUR = 7 // `params.plinthDepth` (`main.js:541`)

function solideFenetre ({ n = 64, cote = COTE, profondeur = PROFONDEUR, relief = null, decalage = 0 } = {}) {
  const d = cote / n
  const demi = cote / 2
  const parCote = n + 1
  const nbGrille = parCote * parCote

  const positions = new Float64Array(nbGrille * 2 * 3)
  const T = (i, j) => j * parCote + i
  const B = (t) => t + nbGrille

  let plusBas = Infinity
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = -demi + i * d
      const z = -demi + j * d
      const y = relief ? relief(x, z) : 0
      if (y < plusBas) plusBas = y
      const t = T(i, j) * 3
      positions[t] = x + decalage
      positions[t + 1] = y + decalage
      positions[t + 2] = z + decalage
    }
  }
  const baseY = plusBas - profondeur
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const t = T(i, j)
      const b = B(t) * 3
      positions[b] = positions[t * 3]
      positions[b + 1] = baseY + decalage
      positions[b + 2] = positions[t * 3 + 2]
    }
  }

  // la nappe, maille par maille (2 triangles par maille, dans l'ordre j puis i)
  const dessus = new Uint32Array(n * n * 6)
  let k = 0
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      dessus[k++] = T(i, j); dessus[k++] = T(i, j + 1); dessus[k++] = T(i + 1, j)
      dessus[k++] = T(i + 1, j); dessus[k++] = T(i, j + 1); dessus[k++] = T(i + 1, j + 1)
    }
  }

  // la dalle : même grille, enroulement inverse (elle regarde -Y)
  const dalle = new Uint32Array(n * n * 6)
  k = 0
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      dalle[k++] = B(T(i, j)); dalle[k++] = B(T(i + 1, j)); dalle[k++] = B(T(i, j + 1))
      dalle[k++] = B(T(i + 1, j)); dalle[k++] = B(T(i + 1, j + 1)); dalle[k++] = B(T(i, j + 1))
    }
  }

  // les quatre parois. Le contour est parcouru dans l'ordre induit par la
  // nappe ; pour chaque arête p → q, deux triangles [p, q, p_bas] et
  // [q, q_bas, p_bas]. Vérifié à la main sur les quatre côtés, et vérifié
  // ci-dessous par le volume fermé.
  const paroi = (sommets) => {
    const out = new Uint32Array((sommets.length - 1) * 6)
    let m = 0
    for (let s = 0; s < sommets.length - 1; s++) {
      const p = sommets[s]
      const q = sommets[s + 1]
      out[m++] = p; out[m++] = q; out[m++] = B(p)
      out[m++] = q; out[m++] = B(q); out[m++] = B(p)
    }
    return out
  }
  const cote0 = []; for (let i = 0; i <= n; i++) cote0.push(T(i, 0))
  const cote1 = []; for (let j = 0; j <= n; j++) cote1.push(T(n, j))
  const cote2 = []; for (let i = n; i >= 0; i--) cote2.push(T(i, n))
  const cote3 = []; for (let j = n; j >= 0; j--) cote3.push(T(0, j))
  const murs = [paroi(cote0), paroi(cote1), paroi(cote2), paroi(cote3)]

  return { positions, dessus, dalle, murs, n, cote, profondeur, baseY, nbGrille }
}

/** Concatène des groupes d'indices en un seul tableau. */
function assembler (...groupes) {
  const plats = groupes.flat()
  let total = 0
  for (const g of plats) total += g.length
  const out = new Uint32Array(total)
  let k = 0
  for (const g of plats) { out.set(g, k); k += g.length }
  return out
}

/** Les indices complets d'un solide du banc. */
const complet = (s) => assembler(s.dessus, s.dalle, s.murs)

/** Retire de la nappe les mailles pour lesquelles `pred(i, j)` est vrai. */
function sansMailles (dessus, n, pred) {
  const garde = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (pred(i, j)) continue
      const base = (j * n + i) * 6
      for (let t = 0; t < 6; t++) garde.push(dessus[base + t])
    }
  }
  return Uint32Array.from(garde)
}

const relief = (x, z) => 1.5 * Math.sin(x * 0.21) + 0.9 * Math.cos(z * 0.17) + 0.4 * Math.sin(x * 0.6 + z * 0.4)

test('LE BANC — le solide plat rend EXACTEMENT côté² × profondeur, signe compris', () => {
  const s = solideFenetre({ n: 16 })
  const r = auditerSolide({ geometrie: s.positions, indices: complet(s) })
  const attendu = COTE * COTE * PROFONDEUR
  // ⚠️ C'est la vérification INDÉPENDANTE du banc : si l'enroulement des
  // parois ou de la dalle était faux, le volume serait négatif ou faux.
  assert.ok(Math.abs(r.volume - attendu) / attendu < 1e-12, `volume ${r.volume} ≠ ${attendu}`)
  assert.equal(r.vide, false)
  assert.equal(r.nan, false)
  assert.equal(r.ferme, true)
  assert.equal(r.oriente, true)
  assert.equal(r.degeneres, 0)
  assert.equal(r.sain, true)
})

test('LE BANC — l\'aire totale vaut EXACTEMENT 2·côté² + 4·côté·profondeur, au bit près', () => {
  // ⚠️ Une valeur fermée, pas une tolérance : c'est elle qui attrape un facteur
  // perdu dans le calcul d'aire — lequel décalerait silencieusement le seuil de
  // fermeture ET la marge de dégénérescence, sans changer aucun verdict.
  const attendue = 2 * COTE * COTE + 4 * COTE * PROFONDEUR // = 7840
  for (const n of [8, 16, 32, 64, 128]) {
    const s = solideFenetre({ n })
    const r = auditerSolide({ geometrie: s.positions, indices: complet(s) })
    assert.equal(r.aireTotale, attendue, `n = ${n}`)
  }
})

test('LE BANC — le volume du solide plat est EXACT à toutes les résolutions', () => {
  // Mesuré : erreur relative nulle de n = 8 à n = 256, grâce à la sommation
  // compensée. Une sommation naïve rend 2,9e-13 — assez pour tomber ici, et
  // c'est le but : la précision de l'audit est une propriété testée.
  const attendu = COTE * COTE * PROFONDEUR
  for (const n of [8, 32, 128]) {
    const s = solideFenetre({ n })
    const r = auditerSolide({ geometrie: s.positions, indices: complet(s) })
    assert.ok(Math.abs(r.volume - attendu) / attendu < 1e-15, `n = ${n} : ${r.volume}`)
  }
})

test('LE BANC — un solide translaté de 1e9 rend le MÊME verdict : le recentrage sert', () => {
  // ⚠️ Sans recentrage, mesuré : 1,4e-9 d'erreur relative sur le volume à
  // 1e9 d'écart (4,2e-8 sans compensation non plus). C'est le seul endroit où
  // le recentrage se voit — sur un solide FERMÉ le volume signé est
  // indépendant de l'origine EN ARITHMÉTIQUE EXACTE, jamais en flottant.
  const attendu = COTE * COTE * PROFONDEUR
  for (const decalage of [0, 1e6, 1e9]) {
    const s = solideFenetre({ n: 64, decalage })
    const r = auditerSolide({ geometrie: s.positions, indices: complet(s) })
    assert.equal(r.sain, true, `décalage ${decalage}`)
    assert.ok(Math.abs(r.volume - attendu) / attendu < 1e-13, `décalage ${decalage} : ${r.volume}`)
  }
})

test('LE BANC — le solide à relief est sain lui aussi, et son aire orientée est nulle', () => {
  const s = solideFenetre({ n: 64, relief })
  const r = auditerSolide({ geometrie: s.positions, indices: complet(s) })
  assert.equal(r.sain, true)
  assert.ok(r.fermetureRelative < 1e-12, `‖Ā‖/aire = ${r.fermetureRelative}`)
  assert.ok(r.volume > 0)
})

// ════════════════════════════════════════════════════════════════════════════
// ② LES SIX SABOTAGES
// ════════════════════════════════════════════════════════════════════════════

const N_SABOTAGE = 256 // le trou de 128×128 mailles du plan = un quart de la nappe

function banc () {
  return solideFenetre({ n: N_SABOTAGE, relief })
}

test('SABOTAGE 1 — solide RETOURNÉ : refusé (un audit d\'arêtes dirait « 0 bord libre »)', () => {
  const s = banc()
  const idx = complet(s)
  const retourne = new Uint32Array(idx.length)
  for (let t = 0; t < idx.length; t += 3) {
    retourne[t] = idx[t + 2]; retourne[t + 1] = idx[t + 1]; retourne[t + 2] = idx[t]
  }
  const r = auditerSolide({ geometrie: s.positions, indices: retourne })
  assert.equal(r.sain, false)
  // ⚠️ Il est bien FERMÉ — c'est tout le piège. Seul le volume signé le voit.
  assert.equal(r.ferme, true)
  assert.equal(r.oriente, false)
  assert.ok(r.volume < 0)
})

test('SABOTAGE 2 — DALLE ABSENTE : refusé', () => {
  const s = banc()
  const r = auditerSolide({ geometrie: s.positions, indices: assembler(s.dessus, s.murs) })
  assert.equal(r.sain, false)
  assert.equal(r.ferme, false)
})

test('SABOTAGE 3 — MUR ENTIER MANQUANT : refusé', () => {
  const s = banc()
  const r = auditerSolide({
    geometrie: s.positions,
    indices: assembler(s.dessus, s.dalle, [s.murs[0], s.murs[1], s.murs[2]]),
  })
  assert.equal(r.sain, false)
  assert.equal(r.ferme, false)
})

test('SABOTAGE 4 — TROU CENTRAL de 128×128 mailles (un quart de la nappe) : refusé', () => {
  const s = banc()
  const d = N_SABOTAGE / 4
  const perce = sansMailles(s.dessus, s.n, (i, j) => i >= d && i < 3 * d && j >= d && j < 3 * d)
  const r = auditerSolide({ geometrie: s.positions, indices: assembler(perce, s.dalle, s.murs) })
  assert.equal(r.sain, false)
  assert.equal(r.ferme, false)
})

test('SABOTAGE 5 — TRIANGLE DÉGÉNÉRÉ : refusé', () => {
  const s = banc()
  const idx = complet(s)
  idx[4] = idx[3] // deux sommets confondus : aire nulle
  const r = auditerSolide({ geometrie: s.positions, indices: idx })
  assert.equal(r.sain, false)
  assert.ok(r.degeneres >= 1)
})

test('SABOTAGE 6 — NaN : refusé, et l\'audit ne rend AUCUN verdict empoisonné', () => {
  const s = banc()
  const pos = Float64Array.from(s.positions)
  pos[3 * 1234 + 1] = NaN
  const r = auditerSolide({ geometrie: pos, indices: complet(s) })
  assert.equal(r.sain, false)
  assert.equal(r.nan, true)
  // le NaN empoisonne la boîte englobante, donc le volume : on refuse de se
  // prononcer plutôt que de rendre un verdict calculé sur du poison.
  assert.equal(r.ferme, null)
  assert.equal(r.oriente, null)
})

test('LES SIX SABOTAGES ensemble : six refus, et le sain reste sain', () => {
  const s = banc()
  const sain = auditerSolide({ geometrie: s.positions, indices: complet(s) })
  assert.equal(sain.sain, true)
})

// ════════════════════════════════════════════════════════════════════════════
// ③ CE QUE LE VOLUME SEUL LAISSE PASSER — la mesure qui a coulé deux versions
//    du plan, rejouée ici pour qu'on ne puisse plus y revenir
// ════════════════════════════════════════════════════════════════════════════

test('le VOLUME SEUL laisse passer TROIS sabotages sur six — mesuré, pas déduit', () => {
  const s = banc()
  const sain = auditerSolide({ geometrie: s.positions, indices: complet(s) })
  const dalleAbsente = auditerSolide({ geometrie: s.positions, indices: assembler(s.dessus, s.murs) })
  const murManquant = auditerSolide({
    geometrie: s.positions,
    indices: assembler(s.dessus, s.dalle, [s.murs[0], s.murs[1], s.murs[2]]),
  })
  const d = N_SABOTAGE / 4
  const perce = sansMailles(s.dessus, s.n, (i, j) => i >= d && i < 3 * d && j >= d && j < 3 * d)
  const trou = auditerSolide({ geometrie: s.positions, indices: assembler(perce, s.dalle, s.murs) })

  // ⚠️ LES TROIS RENDENT UN VOLUME POSITIF — ils « passeraient pour sains »
  // sous la mesure que le plan prescrivait au départ.
  for (const r of [dalleAbsente, murManquant, trou]) assert.ok(r.volume > 0)
  // et le trou d'un quart de nappe ne coûte que quelques pour cent de volume :
  // aucun seuil de volume ne peut le distinguer d'un relief différent.
  assert.ok(Math.abs(trou.volume - sain.volume) / sain.volume < 0.15)

  // ⚠️ TANDIS QUE `Ā` LES VOIT TOUS LES TROIS, avec des ordres de grandeur de
  // marge — et la marge est PROPORTIONNELLE à l'aire qui manque.
  for (const r of [dalleAbsente, murManquant, trou]) {
    assert.equal(r.ferme, false)
    assert.ok(r.fermetureRelative > 1e-3, `‖Ā‖/aire = ${r.fermetureRelative}`)
  }
})

test('l\'écart de fermeture est PROPORTIONNEL à l\'aire manquante — ce n\'est pas un seuil', () => {
  const s = solideFenetre({ n: 64, relief })
  const aireMaille = (COTE / 64) * (COTE / 64)
  const mesures = []
  for (const cotes of [2, 4, 8, 16]) {
    const perce = sansMailles(s.dessus, s.n, (i, j) => i < cotes && j < cotes)
    const r = auditerSolide({ geometrie: s.positions, indices: assembler(perce, s.dalle, s.murs) })
    mesures.push({ aire: cotes * cotes * aireMaille, norme: r.normeAireOrientee })
  }
  // ‖Ā‖ vaut l'aire retirée (la nappe est presque plane à cette échelle) :
  // le rapport reste constant d'un trou à l'autre, à 20 % près.
  for (const m of mesures) {
    assert.ok(m.norme / m.aire > 0.8 && m.norme / m.aire < 1.2, `${m.norme} / ${m.aire}`)
  }
})

// ════════════════════════════════════════════════════════════════════════════
// ④ LA NON-VACUITÉ
// ════════════════════════════════════════════════════════════════════════════

test('NON-VACUITÉ — sans sommet, l\'audit REFUSE de se prononcer', () => {
  const r = auditerSolide({ geometrie: new Float64Array(0), indices: new Uint32Array(0) })
  assert.equal(r.vide, true)
  assert.equal(r.sain, false)
  // ⚠️ null, pas false : « refuser de rendre un verdict », pas « rendre un
  // verdict négatif ». Un appelant qui teste `r.ferme === false` doit voir la
  // différence entre « troué » et « il n'y a rien à auditer ».
  assert.equal(r.ferme, null)
  assert.equal(r.oriente, null)
  assert.equal(r.degeneres, null)
  assert.ok(typeof r.raison === 'string' && r.raison.length > 0)
})

test('NON-VACUITÉ — des sommets mais AUCUN triangle : même refus', () => {
  const s = solideFenetre({ n: 4 })
  const r = auditerSolide({ geometrie: s.positions, indices: new Uint32Array(0) })
  assert.equal(r.vide, true)
  assert.equal(r.ferme, null)
  assert.equal(r.sain, false)
})

test('NON-VACUITÉ — une géométrie absente ne se déclare pas saine', () => {
  for (const entree of [null, undefined, {}, { geometrie: null }, { geometrie: [] }]) {
    const r = auditerSolide(entree)
    assert.equal(r.vide, true, `${JSON.stringify(entree)}`)
    assert.equal(r.sain, false)
  }
})

test('NON-VACUITÉ — un solide dégénéré à aire nulle est vide, pas sain', () => {
  // trois sommets confondus : il y a un triangle, mais rien à mesurer
  const r = auditerSolide({ geometrie: [0, 0, 0, 0, 0, 0, 0, 0, 0], indices: [0, 1, 2] })
  assert.equal(r.sain, false)
})

// ════════════════════════════════════════════════════════════════════════════
// ⑤ LES DEUX EPSILONS — MESURÉS, PAS DEVINÉS
// ════════════════════════════════════════════════════════════════════════════

test('EPSILON DE DÉGÉNÉRESCENCE — six ordres de marge sur la fenêtre la plus fine (n = 768)', () => {
  const n = 768 // `RES_REPOS_MAX` (`fenetre-finesse.js`) : la fenêtre la plus fine
  const s = solideFenetre({ n, relief })
  const r = auditerSolide({ geometrie: s.positions, indices: complet(s) })
  assert.equal(r.sain, true)
  assert.equal(r.degeneres, 0)
  // le seuil est `EPS_DEGENERE × côté²`, et `côté` est le plus grand côté de la
  // boîte englobante.
  assert.ok(Math.abs(r.seuils.degenere - EPS_DEGENERE * r.boite.cote ** 2) < 1e-30)
  const marge = r.aireMin / r.seuils.degenere
  assert.ok(marge > 1e5, `marge de ${marge} — le plan annonce six ordres`)
  assert.ok(marge < 1e8, `marge de ${marge} — plus grande qu'annoncé, à réexpliquer`)
})

test('SEUIL DE FERMETURE — le plus petit défaut attrapé est UN triangle de la fenêtre la plus fine', () => {
  const n = 768
  const s = solideFenetre({ n, relief })
  const idx = complet(s)

  // ⚠️ LE PLANCHER DE BRUIT — c'est lui qui dit que le seuil ne mesure pas le
  // flottant. Mesuré : 1,73e-19, soit dix ordres SOUS le seuil de 1e-9.
  const sain = auditerSolide({ geometrie: s.positions, indices: idx })
  assert.ok(sain.fermetureRelative < 1e-15, `bruit de ${sain.fermetureRelative}`)

  // UN SEUL TRIANGLE retiré : le plus petit défaut qu'un rééchantillonnage
  // puisse produire sans être par ailleurs dégénéré. Mesuré : 322 × le seuil.
  const unTriangle = Uint32Array.from([...idx.slice(0, 3 * 12345), ...idx.slice(3 * 12346)])
  const r1 = auditerSolide({ geometrie: s.positions, indices: unTriangle })
  assert.equal(r1.ferme, false, 'un seul triangle manquant à n=768 doit être vu')
  assert.ok(r1.fermetureRelative / EPS_FERMETURE > 100, `marge de ${r1.fermetureRelative / EPS_FERMETURE}`)

  // une maille entière (deux triangles) : mesuré 665 × le seuil
  const perce = sansMailles(s.dessus, s.n, (i, j) => i === 400 && j === 400)
  const r2 = auditerSolide({ geometrie: s.positions, indices: assembler(perce, s.dalle, s.murs) })
  assert.equal(r2.ferme, false)
  assert.ok(r2.fermetureRelative > r1.fermetureRelative, 'deux triangles pèsent plus qu\'un')
})

test('les trois epsilons sont des constantes exportées, relatives, et documentées', () => {
  assert.equal(EPS_FERMETURE, 1e-9)
  assert.equal(EPS_DEGENERE, 1e-12)
  assert.ok(EPS_VOLUME > 0 && EPS_VOLUME < 1e-6)
  assert.ok(PLAFOND_HAUTEURS >= 3)
})

// ════════════════════════════════════════════════════════════════════════════
// ⑥ L'INTERFACE
// ════════════════════════════════════════════════════════════════════════════

test('INTERFACE — deux arguments et non un : `geometrie` et `indices` séparés', () => {
  const s = solideFenetre({ n: 8 })
  const idx = complet(s)
  const parObjet = auditerSolide({ geometrie: s.positions, indices: idx })
  assert.equal(parObjet.sain, true)
  assert.equal(parObjet.triangles, idx.length / 3)
})

test('INTERFACE — les formes d\'entrée acceptées rendent le MÊME verdict', () => {
  const s = solideFenetre({ n: 8 })
  const idx = complet(s)
  const attendu = auditerSolide({ geometrie: s.positions, indices: idx })

  // un tableau ordinaire
  const brut = auditerSolide({ geometrie: Array.from(s.positions), indices: Array.from(idx) })
  assert.equal(brut.sain, true)
  assert.ok(Math.abs(brut.volume - attendu.volume) / attendu.volume < 1e-12)

  // une géométrie façon `BufferGeometry` (sans importer three.js)
  const facon = {
    attributes: { position: { array: s.positions, itemSize: 3 } },
    index: { array: idx },
  }
  const bg = auditerSolide({ geometrie: facon })
  assert.equal(bg.sain, true)
  assert.ok(Math.abs(bg.volume - attendu.volume) / attendu.volume < 1e-12)

  // une soupe de triangles, sans indices
  const soupe = new Float64Array(idx.length * 3)
  for (let t = 0; t < idx.length; t++) {
    soupe[t * 3] = s.positions[idx[t] * 3]
    soupe[t * 3 + 1] = s.positions[idx[t] * 3 + 1]
    soupe[t * 3 + 2] = s.positions[idx[t] * 3 + 2]
  }
  const sansIndices = auditerSolide({ geometrie: soupe })
  assert.equal(sansIndices.sain, true)
  assert.ok(Math.abs(sansIndices.volume - attendu.volume) / attendu.volume < 1e-9)
})

test('INTERFACE — un indice hors bornes est un refus, pas une exception muette', () => {
  const s = solideFenetre({ n: 8 })
  const idx = Uint32Array.from(complet(s))
  idx[7] = 10 ** 7
  const r = auditerSolide({ geometrie: s.positions, indices: idx })
  assert.equal(r.sain, false)
  assert.ok(r.indicesInvalides >= 1)
})

test('INTERFACE — un nombre d\'indices non multiple de 3 est refusé', () => {
  const s = solideFenetre({ n: 8 })
  const idx = Uint32Array.from(complet(s).slice(0, 3 * 5 + 1))
  assert.throws(() => auditerSolide({ geometrie: s.positions, indices: idx }), /multiple de 3/)
})

test('LE DISCRIMINANT DE LA TÂCHE 6 — un pavé droit ne se fait pas passer pour un rééchantillonnage', () => {
  // ⚠️ C'est l'assertion que la Tâche 6 attend : `construireFenetre` seule rend
  // une boîte à hauteurs nulles, fermée et orientée PAR CONSTRUCTION. Elle
  // passerait l'audit cent fois sans que le rééchantillonnage soit touché.
  const pave = solideFenetre({ n: 32 })
  const rp = auditerSolide({ geometrie: pave.positions, indices: complet(pave) })
  assert.equal(rp.sain, true) // il EST sain — c'est bien le problème
  // deux hauteurs distinctes seulement : le dessus et la dalle.
  assert.equal(rp.hauteurs.distinctes, 2)
  assert.equal(rp.hauteurs.amplitude, PROFONDEUR)

  const vrai = solideFenetre({ n: 32, relief })
  const rv = auditerSolide({ geometrie: vrai.positions, indices: complet(vrai) })
  assert.equal(rv.sain, true)
  assert.ok(rv.hauteurs.distinctes > 2, 'un relief rééchantillonné a plus de deux hauteurs')
  assert.ok(rv.hauteurs.amplitude > PROFONDEUR)
})

test('LE DISCRIMINANT — le comptage des hauteurs est PLAFONNÉ et le dit', () => {
  const s = solideFenetre({ n: 128, relief })
  const r = auditerSolide({ geometrie: s.positions, indices: complet(s) })
  assert.ok(r.hauteurs.distinctes <= PLAFOND_HAUTEURS)
  assert.equal(r.hauteurs.plafonnees, r.hauteurs.distinctes >= PLAFOND_HAUTEURS)
})

test('INTERFACE — l\'axe de hauteur est réglable, et vaut y par défaut', () => {
  const s = solideFenetre({ n: 8, relief })
  const parDefaut = auditerSolide({ geometrie: s.positions, indices: complet(s) })
  const surX = auditerSolide({ geometrie: s.positions, indices: complet(s), axeHauteur: 'x' })
  assert.equal(parDefaut.hauteurs.min, s.baseY)
  assert.equal(surX.hauteurs.min, -COTE / 2)
})

// ════════════════════════════════════════════════════════════════════════════
// ⑦ CE QUE L'AUDIT NE VOIT PAS — et la règle qui en découle
// ════════════════════════════════════════════════════════════════════════════

test('DEUX COQUES PASSÉES ENSEMBLE PEUVENT SE MASQUER — d\'où la règle : une coque à la fois', () => {
  // Le socle réel est DEUX coques (`walls` + le liner de `plinth.js`). Le plan
  // ne disait pas laquelle `auditerSolide` prend : la réponse est UNE À LA
  // FOIS, et voici la preuve qu'on ne peut pas les concaténer.
  const a = solideFenetre({ n: 32 })
  const trouA = sansMailles(a.dessus, a.n, (i, j) => i < 4 && j < 4)
  const seule = auditerSolide({ geometrie: a.positions, indices: assembler(trouA, a.dalle, a.murs) })
  assert.equal(seule.ferme, false) // seule, la coque trouée est vue

  // une seconde coque, retournée et trouée au même endroit : son Ā est l'opposé
  const b = new Uint32Array(trouA.length)
  for (let t = 0; t < trouA.length; t += 3) {
    b[t] = trouA[t + 2]; b[t + 1] = trouA[t + 1]; b[t + 2] = trouA[t]
  }
  const dalleB = new Uint32Array(a.dalle.length)
  for (let t = 0; t < a.dalle.length; t += 3) {
    dalleB[t] = a.dalle[t + 2]; dalleB[t + 1] = a.dalle[t + 1]; dalleB[t + 2] = a.dalle[t]
  }
  const mursB = a.murs.map((m) => {
    const r = new Uint32Array(m.length)
    for (let t = 0; t < m.length; t += 3) { r[t] = m[t + 2]; r[t + 1] = m[t + 1]; r[t + 2] = m[t] }
    return r
  })
  const ensemble = auditerSolide({
    geometrie: a.positions,
    indices: assembler(trouA, a.dalle, a.murs, b, dalleB, mursB),
  })
  // ⚠️ Fermé — et pourtant les DEUX coques sont trouées. C'est la raison de la
  // règle. (L'orientation, elle, tombe : le volume s'annule.)
  assert.equal(ensemble.ferme, true)
  assert.equal(ensemble.sain, false, 'sauvé ici par le volume, mais ce n\'est pas garanti')
})
