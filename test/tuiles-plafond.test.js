// LE CHARGEUR DE TUILES NE NOIE PLUS LE NAVIGATEUR.
//
// `loadTiles` faisait `Promise.all` sur toutes les tuiles couvrant l'emprise,
// sans borne. Le navigateur a une limite de connexions ; au-delà il rend
// `net::ERR_INSUFFICIENT_RESOURCES` — et il la rend pour la MAJORITÉ du lot.
// Comme le chargeur traite un échec comme une tuile vide (contrat « ne lève
// jamais », voir l'en-tête de tile-loader.js), la carte se dessinait SANS SON
// EAU, sans une erreur, sans un test rouge.
//
// Mesuré le 2026-08-20 à Madagascar (lat −18,7126), tuiles z8 :
//
//     bloc z4 (7 117 km) → 2 548 tuiles d'un coup
//     bloc z5 (3 558 km) →   650
//     bloc z6 (1 779 km) →   169
//
// Le défaut dormait parce que la plongée atterrissait toujours sur z5. La
// Tâche 1b l'a réveillé en rendant la plongée continue : elle atterrit
// désormais sur le niveau qui correspond à l'altitude, donc parfois z4.
//
// ⚠️ CE QUE CE TEST VÉRIFIE, ET QUI N'EST PAS ÉVIDENT : le plafond ne doit pas
// seulement borner le nombre de requêtes EN VOL, il doit aussi les servir
// TOUTES. Un plafond qui jette le surplus rendrait le même écran — de l'eau
// manquante — en étant vert.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWaterTiles, _clearCache, _enVol } from '../src/map/tile-loader.js'

const MAX_ATTENDU = 24

// Un `fetch` bouchonné qui ne résout jamais tout seul : le test le libère
// quand il veut, ce qui rend le pic mesurable au lieu d'être une course.
function bouchon() {
  const attentes = []
  let pic = 0
  let demandes = 0
  globalThis.fetch = (url) => {
    demandes++
    pic = Math.max(pic, _enVol())
    return new Promise((resolve) => {
      attentes.push(() => resolve({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) }))
    })
  }
  return {
    get pic() { return pic },
    get demandes() { return demandes },
    get enSuspens() { return attentes.length },
    // ⚠️ ON LIBÈRE JUSQU'À CE QUE LE TRAVAIL SOIT FINI, PAS JUSQU'À CE QUE LA
    // FILE SEMBLE VIDE. Une première version bouclait sur `attentes.length` :
    // à l'instant où un créneau passe d'une requête à la suivante, la file est
    // momentanément vide alors qu'il reste des milliers de tuiles — la boucle
    // sortait, la promesse attendue ne se réglait jamais, et le test pendait.
    async libereJusquA(promesse) {
      let fini = false
      const suivie = promesse.then((v) => { fini = true; return v })
      for (let garde = 0; !fini && garde < 100000; garde++) {
        const suite = attentes.splice(0, attentes.length)
        for (const f of suite) f()
        await new Promise((r) => setTimeout(r, 0))
      }
      assert.ok(fini, 'la garde a sauté : le chargeur ne se termine pas')
      return suivie
    },
  }
}

const EMPRISE_MADAGASCAR_Z4 = { minLon: 15.2, maxLon: 79.2, minLat: -50.7, maxLat: 13.3 }

test('le nombre de requêtes EN VOL ne dépasse jamais le plafond', async () => {
  _clearCache()
  const vrai = globalThis.fetch
  const b = bouchon()
  try {
    const p = loadWaterTiles(EMPRISE_MADAGASCAR_Z4, 8)
    // laisser la première vague partir
    await new Promise((r) => setTimeout(r, 0))
    assert.ok(
      b.pic <= MAX_ATTENDU,
      `pic de ${b.pic} requêtes en vol — le plafond est ${MAX_ATTENDU}`
    )
    assert.ok(b.demandes > 0, 'aucune requête partie : le bouchon ne mesure rien')
    await b.libereJusquA(p)
  } finally {
    globalThis.fetch = vrai
    _clearCache()
  }
})

test('TOUTES les tuiles sont servies, pas seulement les premières', async () => {
  _clearCache()
  const vrai = globalThis.fetch
  const b = bouchon()
  try {
    const p = loadWaterTiles(EMPRISE_MADAGASCAR_Z4, 8)
    await b.libereJusquA(p)
    // le nombre exact dépend de tile-index ; ce qui compte est qu'il dépasse
    // très largement le plafond ET qu'aucune requête ne reste en suspens
    assert.ok(
      b.demandes > MAX_ATTENDU * 10,
      `${b.demandes} requêtes seulement — l'emprise de référence en demande des milliers`
    )
    assert.equal(b.enSuspens, 0, 'des requêtes sont restées en suspens')
    assert.equal(_enVol(), 0, `${_enVol()} créneaux jamais rendus — le compteur fuit`)
  } finally {
    globalThis.fetch = vrai
    _clearCache()
  }
})

test('un échec rend un créneau, comme un succès', async () => {
  _clearCache()
  const vrai = globalThis.fetch
  let n = 0
  globalThis.fetch = () => {
    n++
    return Promise.reject(new Error('ERR_INSUFFICIENT_RESOURCES'))
  }
  try {
    const fc = await loadWaterTiles({ minLon: 0, maxLon: 2, minLat: 0, maxLat: 2 }, 8)
    assert.equal(fc.type, 'FeatureCollection')
    assert.ok(n > 0, 'aucune requête partie')
    assert.equal(_enVol(), 0, `${_enVol()} créneaux perdus après des échecs — la file se gèlerait`)
  } finally {
    globalThis.fetch = vrai
    _clearCache()
  }
})
