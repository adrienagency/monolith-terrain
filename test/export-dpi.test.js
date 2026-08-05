// L'ÉCHELLE DE RÉSOLUTION D'UNE AFFICHE, ET SA DÉGRADATION — en tests.
//
// CE QUI S'EST PASSÉ. Le format par défaut de la boutique, un 50 × 70 en
// paysage, réclame 8 339 px de large à 300 dpi. La limite courante du parc est
// 8 192, et le rabotage par le pilote est SILENCIEUX : aucune exception, aucun
// avertissement, une affiche déformée de 1,8 % et 13 mm de papier nu sur un
// bord. Le défaut ne se voit qu'après le tirage payé.
//
// ⚠️ ET IL EST NÉ D'UNE ORIENTATION OUBLIÉE. En portrait, le même 50 × 70 tient
// (8 339 est la HAUTEUR, jamais demandée à la largeur du tampon). Les tests
// ci-dessous vérifient donc systématiquement LES DEUX orientations : c'est
// exactement l'angle mort qui a produit le défaut.
//
// Ce que ce fichier verrouille, dans l'ordre où ça coûte cher :
//   1. tout format du catalogue a une densité définie — un huitième format
//      ajouté demain sans entrée doit ROUGIR, pas passer en silence à 300 ;
//   2. la table nominale, mesurée sur `geometriePage`, dans les deux sens ;
//   3. la dégradation : on baisse la densité, on ne rogne jamais le format ;
//   4. le plancher : en dessous, on refuse la vente plutôt que de livrer une
//      bouillie.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FORMATS_AFFICHE, FORMAT_PAR_ID, geometriePage, planTuiles } from '../src/print-page.js'
import {
  COTE_TUILE,
  DPI_NOMINAL,
  DPI_PLANCHER,
  PAS_DPI,
  PLAFOND_REFERENCE,
  dpiPour,
  degradePour,
  formatsSansDensite,
} from '../src/export-dpi.js'

// La table de référence, mesurée. `px` est donné en PAYSAGE ; le portrait
// transpose (vérifié plus bas, pas supposé). `tuiles` est le compte à 2 048.
const TABLE = [
  { id: 'a4', dpi: 300, px: [3579, 2552], tuiles: 4 },
  { id: '30x40', dpi: 300, px: [4796, 3615], tuiles: 6 },
  { id: 'a3', dpi: 300, px: [5032, 3579], tuiles: 6 },
  { id: '40x50', dpi: 300, px: [5977, 4796], tuiles: 9 },
  { id: 'a2', dpi: 300, px: [7087, 5032], tuiles: 12 },
  { id: '50x70', dpi: 250, px: [6949, 4981], tuiles: 12 },
  { id: '61x91', dpi: 200, px: [7245, 4851], tuiles: 12 },
]

const ORIENTATIONS = ['paysage', 'portrait']

// ═══════════ 1. LA PROPRIÉTÉ QUI SURVIT À L'AJOUT D'UN FORMAT ═══════════════
//
// Ce n'est pas la liste d'aujourd'hui qui compte, c'est le lien entre les deux
// listes. Un format ajouté au catalogue sans densité ne doit pas hériter d'un
// 300 par défaut : c'est précisément ce qui a produit le défaut du 50 × 70.

test('le catalogue a exactement sept formats — pas huit', () => {
  assert.equal(FORMATS_AFFICHE.length, 7)
})

test('chaque format du catalogue a une densité définie, et réciproquement', () => {
  assert.deepEqual(formatsSansDensite(), [])
  assert.deepEqual(
    Object.keys(DPI_NOMINAL).slice().sort(),
    FORMATS_AFFICHE.map((f) => f.id).sort(),
    'une entrée orpheline dans la table est une densité qui ne sert plus, ou un format renommé'
  )
})

test('un HUITIÈME format ajouté sans densité rougit, il ne passe pas à 300', () => {
  const nouveau = { id: 'a1', label: 'A1 · 59,4 × 84,1 cm', mm: [594, 841] }
  FORMATS_AFFICHE.push(nouveau)
  FORMAT_PAR_ID[nouveau.id] = nouveau
  try {
    // La sonde de cohérence le voit…
    assert.deepEqual(formatsSansDensite(), ['a1'])
    // …et les deux fonctions refusent plutôt que de deviner.
    for (const o of ORIENTATIONS) {
      assert.equal(dpiPour('a1', o), null, 'aucune densité inventée')
      assert.equal(degradePour('a1', o, 16384), null, 'aucun rendu promis')
    }
  } finally {
    FORMATS_AFFICHE.pop()
    delete FORMAT_PAR_ID[nouveau.id]
  }
  // et le catalogue est bien rendu intact aux tests suivants
  assert.deepEqual(formatsSansDensite(), [])
})

test('une densité ORPHELINE ne ressuscite pas un format retiré du catalogue', () => {
  // Le lien casse dans les deux sens. Si un format sort du catalogue et que sa
  // densité reste dans la table, c'est le CATALOGUE qui décide : sinon
  // `dpiPour` répondrait pour un papier que la boutique ne vend plus.
  DPI_NOMINAL.a1 = 300
  try {
    assert.equal(dpiPour('a1', 'paysage'), null)
    assert.equal(degradePour('a1', 'paysage', 16384), null)
  } finally {
    delete DPI_NOMINAL.a1
  }
})

test('un format inconnu ne reçoit ni densité ni plan', () => {
  for (const inconnu of ['a0', '', null, undefined, 'A4', 42]) {
    assert.equal(dpiPour(inconnu, 'paysage'), null, `${inconnu}`)
    assert.equal(degradePour(inconnu, 'paysage', 16384), null, `${inconnu}`)
  }
})

// ═══════════ 2. LA TABLE NOMINALE, MESURÉE ══════════════════════════════════

test('la densité nominale de chaque format', () => {
  for (const { id, dpi } of TABLE) {
    for (const o of ORIENTATIONS) assert.equal(dpiPour(id, o), dpi, `${id} ${o}`)
  }
})

test('la table de référence en paysage : px et tuiles, recalculés depuis geometriePage', () => {
  for (const { id, dpi, px, tuiles } of TABLE) {
    const g = geometriePage({ format: id, dpi, orientation: 'paysage' })
    assert.deepEqual(g.totalPx, px, `${id} px`)
    assert.equal(planTuiles(g.totalPx, COTE_TUILE).tuiles.length, tuiles, `${id} tuiles`)
    // …et c'est bien ce que le module promet, à une machine large
    const d = degradePour(id, 'paysage', 16384)
    assert.deepEqual(d, { dpi, px, tuiles }, `${id} dégradé inutilement`)
  }
})

test('le portrait transpose exactement — même densité, mêmes tuiles, px échangés', () => {
  for (const { id, dpi, px, tuiles } of TABLE) {
    const d = degradePour(id, 'portrait', 16384)
    assert.deepEqual(d, { dpi, px: [px[1], px[0]], tuiles }, `${id} portrait`)
  }
})

test('LE DÉFAUT D’ORIGINE : à 300 dpi, le 50 × 70 dépasse le plafond du parc', () => {
  const g = geometriePage({ format: '50x70', dpi: 300, orientation: 'paysage' })
  assert.equal(g.totalPx[0], 8339)
  assert.ok(g.totalPx[0] > PLAFOND_REFERENCE, '8 339 > 8 192, et le rabotage est muet')
})

test('aucune densité nominale ne dépasse le plafond de référence, dans AUCUNE orientation', () => {
  for (const f of FORMATS_AFFICHE) {
    for (const o of ORIENTATIONS) {
      const g = geometriePage({ format: f.id, dpi: dpiPour(f.id, o), orientation: o })
      const cote = Math.max(...g.totalPx)
      assert.ok(cote <= PLAFOND_REFERENCE, `${f.id} ${o} : ${cote} px > ${PLAFOND_REFERENCE}`)
    }
  }
})

// ═══════════ 3. LA DÉGRADATION — on baisse la densité, on garde le format ═══

test('une machine large ne dégrade rien, et ne MONTE jamais au-dessus du nominal', () => {
  // 61 × 91 est nominalement à 200 : une carte graphique énorme ne le repasse
  // pas à 300, parce que la source ne suit pas (mosaïque ~208 dpi effectifs).
  const d = degradePour('61x91', 'paysage', 100000)
  assert.equal(d.dpi, 200)
  assert.deepEqual(d.px, [7245, 4851])
})

test('une machine étroite baisse la densité et garde le format', () => {
  // 8 192 suffit à tout le nominal…
  for (const { id, dpi } of TABLE) assert.equal(degradePour(id, 'paysage', 8192).dpi, dpi, id)
  // …6 000 fait plier les trois plus grands, sans jamais les retirer.
  assert.equal(degradePour('a3', 'paysage', 6000).dpi, 300)
  assert.equal(degradePour('40x50', 'paysage', 6000).dpi, 300)
  assert.equal(degradePour('a2', 'paysage', 6000).dpi, 250)
  assert.equal(degradePour('50x70', 'paysage', 6000).dpi, 210)
  assert.equal(degradePour('61x91', 'paysage', 6000).dpi, 160)
  // et le format reste ENTIER : la géométrie dégradée est celle du même papier
  const d = degradePour('a2', 'paysage', 6000)
  assert.deepEqual(d, { dpi: 250, px: [5906, 4193], tuiles: 9 })
})

test('la densité descend par pas de 10 — on ne jette pas 20 % de résolution pour 2 % de dépassement', () => {
  // A3 paysage à 4 096 : le côté long tolère 244 dpi. Un palier grossier
  // (300 → 250 → 200) tomberait à 200 ; le pas de 10 rend 240.
  assert.equal(degradePour('a3', 'paysage', 4096).dpi, 240)
  for (const { id } of TABLE) {
    for (const o of ORIENTATIONS) {
      for (const lim of [2048, 3000, 4096, 5000, 6000, 8192]) {
        const d = degradePour(id, o, lim)
        if (d) assert.equal(d.dpi % PAS_DPI, 0, `${id} ${o} ${lim} → ${d.dpi} dpi`)
      }
    }
  }
})

test('la borne est INCLUSIVE : une limite pile égale au besoin passe', () => {
  assert.equal(degradePour('a4', 'paysage', 3579).dpi, 300, 'pile 3 579 : ça tient')
  assert.ok(degradePour('a4', 'paysage', 3578).dpi < 300, 'un pixel de moins : ça plie')
})

test('la contrainte porte sur LES DEUX côtés, pas sur la largeur seule', () => {
  // A4 portrait à 300 : 2 552 de large (ça passe) mais 3 579 de haut (non).
  const d = degradePour('a4', 'portrait', 3000)
  assert.ok(d.dpi < 300, `la hauteur doit décider aussi (obtenu ${d.dpi} dpi)`)
  assert.ok(Math.max(...d.px) <= 3000)
})

// ═══════════ 4. LE PLANCHER — refuser vaut mieux que livrer une bouillie ════

test('sous le plancher, le format sort de la grille au lieu de sortir dégueulasse', () => {
  // 4 096 : les deux plus grands formats demanderaient 147 et 113 dpi.
  assert.equal(degradePour('50x70', 'paysage', 4096), null)
  assert.equal(degradePour('61x91', 'paysage', 4096), null)
  assert.equal(degradePour('50x70', 'portrait', 4096), null)
  assert.equal(degradePour('61x91', 'portrait', 4096), null)
  // …tandis que l'A2, lui, dégrade et reste vendable.
  assert.equal(degradePour('a2', 'paysage', 4096).dpi, 170)
})

test('au plancher garanti de WebGL2 (2 048), seul l’A4 survit — et c’est assumé', () => {
  // 170 dpi, pas 150 : le pas de 10 récupère les 20 dpi qu'un palier grossier
  // aurait jetés. Et une tuile unique — le pavage se réduit au cas dégénéré.
  assert.deepEqual(degradePour('a4', 'paysage', 2048), { dpi: 170, px: [2028, 1446], tuiles: 1 })
  for (const { id } of TABLE.slice(1)) {
    assert.equal(degradePour(id, 'paysage', 2048), null, `${id} devrait être masqué`)
  }
})

test('jamais de densité sous le plancher, quelle que soit la limite', () => {
  for (const { id } of TABLE) {
    for (const o of ORIENTATIONS) {
      for (let lim = 500; lim <= 9000; lim += 37) {
        const d = degradePour(id, o, lim)
        if (d) assert.ok(d.dpi >= DPI_PLANCHER, `${id} ${o} ${lim} → ${d.dpi} dpi`)
      }
    }
  }
})

// ═══════════ 5. LES INVARIANTS, SUR TOUT LE DOMAINE ═════════════════════════

test('ce qui est rendu tient TOUJOURS dans la limite annoncée, et le plan de tuiles colle', () => {
  for (const { id } of TABLE) {
    for (const o of ORIENTATIONS) {
      for (let lim = 1000; lim <= 9000; lim += 53) {
        const d = degradePour(id, o, lim)
        if (!d) continue
        assert.ok(Math.max(...d.px) <= lim, `${id} ${o} ${lim} → ${d.px.join('x')}`)
        assert.ok(d.dpi <= dpiPour(id, o), `${id} ${o} ${lim} : au-dessus du nominal`)
        // les px sont bien ceux de la géométrie à cette densité, fond perdu compris
        const g = geometriePage({ format: id, dpi: d.dpi, orientation: o })
        assert.deepEqual(d.px, g.totalPx, `${id} ${o} ${lim}`)
        assert.equal(d.tuiles, planTuiles(g.totalPx, COTE_TUILE).tuiles.length, `${id} ${o} ${lim}`)
      }
    }
  }
})

test('un refus est un VRAI refus : même au plancher, ça ne passait pas', () => {
  // Le pendant du test précédent : sans lui, un module qui renvoie toujours
  // null passerait tous les autres tests de dégradation.
  let refus = 0
  for (const { id } of TABLE) {
    for (const o of ORIENTATIONS) {
      for (let lim = 1000; lim <= 9000; lim += 53) {
        if (degradePour(id, o, lim)) continue
        refus++
        const g = geometriePage({ format: id, dpi: DPI_PLANCHER, orientation: o })
        assert.ok(Math.max(...g.totalPx) > lim, `${id} ${o} ${lim} : refusé alors que le plancher tenait`)
      }
    }
  }
  assert.ok(refus > 20, `il faut de vrais refus pour que ce test dise quelque chose (${refus})`)
})

test('une limite matérielle qu’on ne connaît pas ne se devine pas', () => {
  for (const mauvaise of [0, -1, NaN, Infinity, undefined, null, '8192', {}]) {
    assert.equal(degradePour('a4', 'paysage', mauvaise), null, `${String(mauvaise)}`)
  }
})

// ═══════════ 6. LA COHÉRENCE DES CONSTANTES ═════════════════════════════════

test('les constantes se tiennent entre elles', () => {
  assert.equal(COTE_TUILE, 2048, 'le plancher garanti de WebGL2')
  assert.ok(DPI_PLANCHER < Math.min(...Object.values(DPI_NOMINAL)))
  // le pas doit tomber juste sur le plancher depuis n'importe quel nominal,
  // sinon la descente le manque et s'arrête au-dessus
  for (const dpi of Object.values(DPI_NOMINAL)) {
    assert.equal((dpi - DPI_PLANCHER) % PAS_DPI, 0, `${dpi} → ${DPI_PLANCHER} par pas de ${PAS_DPI}`)
  }
})
