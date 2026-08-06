// LE POINT DE NETTETÉ DE L'AFFICHE — ce que le navigateur a montré, verrouillé.
//
// Le défaut d'origine, observé à l'écran : avec le flou allumé, on vise la côte
// au bord droit d'une affiche en paysage, on passe en portrait — et l'affiche
// entière ressort floue. La profondeur, elle, était juste : le point est un
// point du MONDE et `cadrerAffiche` recalculait sa distance à chaque rendu. Ce
// que personne ne vérifiait, c'est qu'il fût encore DANS LE CADRE, lequel est
// entièrement refait quand l'aspect change.
//
// Les tests ci-dessous tiennent les trois décisions qui en découlent, plus le
// ton de l'avertissement d'achat — parce qu'un texte qui dérive vers le jargon
// ne casse rien et ne se voit donc jamais.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MARGE_SUR_LA_FEUILLE,
  estSurLaFeuille,
  viseesDeRepli,
  doitAvertirAvantAchat,
  AVERTISSEMENT_NETTETE,
  MESSAGE_POINT_REPLACE,
} from '../src/affiche-nettete.js'

// ═══════════ ① EST-IL ENCORE SUR LA FEUILLE ? ═══════════════════════════════

test('un point au centre du cadre est sur la feuille', () => {
  assert.equal(estSurLaFeuille({ u: 0, v: 0, devant: true }), true)
  assert.equal(estSurLaFeuille({ u: 0.6, v: -0.4, devant: true }), true)
})

test('un point sorti du cadre ne l’est plus — le cas du passage en portrait', () => {
  // La côte visée à u = +0,85 en paysage se retrouve à u = +1,4 en portrait :
  // le champ horizontal s'est resserré, elle n'est plus sur le papier.
  assert.equal(estSurLaFeuille({ u: 1.4, v: 0.1, devant: true }), false)
  assert.equal(estSurLaFeuille({ u: 0.1, v: -1.2, devant: true }), false)
})

test('la bande de bord compte comme hors feuille', () => {
  const dedans = 1 - MARGE_SUR_LA_FEUILLE - 1e-6
  const dehors = 1 - MARGE_SUR_LA_FEUILLE + 1e-3
  assert.equal(estSurLaFeuille({ u: dedans, v: 0, devant: true }), true)
  assert.equal(estSurLaFeuille({ u: dehors, v: 0, devant: true }), false)
})

test('un point PASSÉ DERRIÈRE l’objectif n’est jamais sur la feuille', () => {
  // Il se projette pourtant en coordonnées parfaitement plausibles : c'est tout
  // l'intérêt du drapeau. Sans lui, on garderait une mise au point derrière la
  // caméra et l'affiche sortirait floue de bout en bout.
  assert.equal(estSurLaFeuille({ u: 0, v: 0, devant: false }), false)
})

test('l’absence de point, ou un point non fini, n’est pas « sur la feuille »', () => {
  assert.equal(estSurLaFeuille(null), false)
  assert.equal(estSurLaFeuille({ u: NaN, v: 0, devant: true }), false)
  assert.equal(estSurLaFeuille({ u: 0, v: Infinity, devant: true }), false)
})

// ═══════════ ② OÙ RE-VISER ? ═══════════════════════════════════════════════

test('on re-vise D’ABORD là où l’utilisateur avait visé sur la feuille', () => {
  const [premier] = viseesDeRepli({ u: 0.55, v: -0.2 })
  assert.deepEqual(premier, { u: 0.55, v: -0.2 })
})

test('sans visée mémorisée, on part du centre', () => {
  const liste = viseesDeRepli(null)
  assert.deepEqual(liste[0], { u: 0, v: 0 })
})

test('les replis existent parce qu’un rayon peut ne rien toucher', () => {
  // Viser le ciel ne rend aucun point : il faut d'autres endroits à essayer.
  assert.ok(viseesDeRepli(null).length >= 2)
  assert.ok(viseesDeRepli({ u: 0.3, v: 0.3 }).length >= 3)
})

test('aucun doublon, et rien hors du cadre dans la liste des replis', () => {
  const liste = viseesDeRepli({ u: 0, v: 0 })
  const clés = liste.map((e) => `${e.u}|${e.v}`)
  assert.equal(new Set(clés).size, clés.length)
  for (const e of liste) {
    assert.ok(Math.abs(e.u) <= 1 && Math.abs(e.v) <= 1)
  }
})

test('une visée aberrante est ignorée plutôt que rejouée', () => {
  const liste = viseesDeRepli({ u: 9, v: NaN })
  assert.deepEqual(liste[0], { u: 0, v: 0 })
})

// ═══════════ ③ L’AVERTISSEMENT D’ACHAT ═════════════════════════════════════

test('pas de flou, pas d’avertissement', () => {
  assert.equal(doitAvertirAvantAchat({ bokehActif: false, dejaConfirme: false }), false)
  assert.equal(doitAvertirAvantAchat({}), false)
})

test('flou allumé : on avertit, puis on laisse passer une fois la réponse donnée', () => {
  assert.equal(doitAvertirAvantAchat({ bokehActif: true, dejaConfirme: false }), true)
  assert.equal(doitAvertirAvantAchat({ bokehActif: true, dejaConfirme: true }), false)
})

test('« à chaque fois » : la confirmation ne se déduit que du drapeau passé', () => {
  // Aucune mémoire cachée dans le module — deux appels identiques répondent
  // identiquement. C'est ce qui garantit qu'une deuxième commande repose la
  // question, comme Adrien l'a demandé.
  for (let i = 0; i < 3; i += 1) {
    assert.equal(doitAvertirAvantAchat({ bokehActif: true, dejaConfirme: false }), true)
  }
})

// ═══════════ LE TON ════════════════════════════════════════════════════════

test('l’avertissement ne parle pas la langue du logiciel', () => {
  const tout = [
    AVERTISSEMENT_NETTETE.titre,
    AVERTISSEMENT_NETTETE.phrase,
    AVERTISSEMENT_NETTETE.deplacer,
    AVERTISSEMENT_NETTETE.continuer,
    MESSAGE_POINT_REPLACE,
  ].join(' ').toLowerCase()
  for (const jargon of ['bokeh', 'profondeur de champ', 'focus', 'dof', 'pixel', 'rendu']) {
    assert.ok(!tout.includes(jargon), `mot à bannir trouvé : ${jargon}`)
  }
})

test('l’avertissement dit le RISQUE et le REMÈDE, pas seulement « attention »', () => {
  const p = AVERTISSEMENT_NETTETE.phrase.toLowerCase()
  assert.ok(p.includes('flou'), 'il doit nommer le risque')
  assert.ok(p.includes('clique sur l’affiche'), 'il doit nommer le geste qui répare')
})

test('les deux réponses sont explicites : aucune ne se lit comme « annuler »', () => {
  assert.ok(AVERTISSEMENT_NETTETE.deplacer.length > 3)
  assert.ok(AVERTISSEMENT_NETTETE.continuer.toLowerCase().includes('continuer'))
  assert.notEqual(AVERTISSEMENT_NETTETE.deplacer, AVERTISSEMENT_NETTETE.continuer)
})

test('le message de replacement dit ce qui vient de se passer ET quoi faire', () => {
  const m = MESSAGE_POINT_REPLACE.toLowerCase()
  assert.ok(m.includes('cadre a changé'))
  assert.ok(m.includes('clique sur l’affiche'))
})
