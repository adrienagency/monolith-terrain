import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchOverpassLines, fetchOverpassAreas, overpassEnPanne, oublierPanneOverpass } from '../src/map/overpass.js'

// ═══════════════════════════════════════════════════════════════════════════
// TÂCHE 8 — LA MESURE QUI A FAIT REFUSER L'EXTENSION DU CALQUE D'EAU AU CARRÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// Rivières et lacs vectoriels s'arrêtent au bloc central du damier. L'issue
// retenue est « on ne l'étend pas », et l'argument est écrit au long en tête de
// `WaterLayer.rebuild` (src/map/water-layer.js). Ce fichier-ci est sa MESURE,
// rejouable : neuf emprises font dix-huit requêtes Overpass, l'écart minimal ne
// les sérialise pas, elles partent ensemble, et le disjoncteur du module ne voit
// rien passer.
//
// ⚠️ CE FICHIER NE VERROUILLE PAS L'ABSENCE D'EXTENSION — il verrouille les
// PRÉMISSES DU REFUS. S'il rougit, c'est qu'`overpass.js` ne se comporte plus
// comme le jour de la décision (par exemple : une vraie file d'attente, ou un
// disjoncteur qui compte les refus). Alors la décision de la Tâche 8 est à
// ROUVRIR, pas le test à recaler.
//
// MÉTHODE : le module de production, tel quel, avec un `fetch` injecté. On ne
// touche PAS au point d'accès public — ce serait exactement l'abus que ce refus
// existe pour éviter.

// Un point d'accès simulé. `slots` = créneaux simultanés par adresse IP
// (2 = la politique usuelle d'overpass-api.de) ; au-delà, un 429, qui est ce que
// le serveur public rend à une rafale venue d'une même IP.
function pointDacces({ slots = Infinity, latenceMs = 5 } = {}) {
  const etat = { appels: 0, enVol: 0, pic: 0, refus: 0 }
  const fetchImpl = async () => {
    etat.appels++
    if (etat.enVol >= slots) { etat.refus++; return { ok: false, status: 429, headers: { get: () => null } } }
    etat.enVol++
    etat.pic = Math.max(etat.pic, etat.enVol)
    try {
      await new Promise((r) => setTimeout(r, latenceMs))
      return { ok: true, headers: { get: () => null }, json: async () => ({ elements: [] }) }
    } finally { etat.enVol-- }
  }
  return { fetchImpl, etat }
}

// Une emprise par case du damier — toutes distinctes, sinon le cache du module
// répondrait à la place du réseau et la mesure ne mesurerait rien.
const emprises = (n, sel) =>
  Array.from({ length: n }, (_, k) => ({
    minLat: 45 + k * 0.1 + sel, minLon: 6 + k * 0.1, maxLat: 45.2 + k * 0.1 + sel, maxLon: 6.2 + k * 0.1,
  }))

// Ce que fait le calque pour UNE emprise : deux requêtes, lignes ET aires,
// parties ensemble dans un `Promise.all` (water-layer.js). `nCases` emprises,
// c'est donc `2 × nCases` requêtes.
async function rafale(nCases, sel, { slots = Infinity, minInterval = 0, latenceMs = 5 } = {}) {
  oublierPanneOverpass()
  const { fetchImpl, etat } = pointDacces({ slots, latenceMs })
  const o = { fetchImpl, minInterval, attenteMs: 5000 }
  const jobs = []
  for (const b of emprises(nCases, sel)) {
    jobs.push(fetchOverpassLines(b, 'water', o))
    jobs.push(fetchOverpassAreas(b, o))
  }
  const res = await Promise.all(jobs)
  const servies = res.filter((r) => r !== null).length
  return { requetes: res.length, appels: etat.appels, pic: etat.pic, refus: etat.refus, servies, nulles: res.length - servies }
}

test('une case = deux requêtes Overpass ; neuf cases en feraient dix-huit, vingt-cinq en feraient cinquante', async () => {
  // Le rapport ×9 (et ×25 en zone isolée) est la moitié de l'argument : il ne
  // dépend d'aucun réglage de temps, donc il est mesuré ici sans écart minimal.
  assert.deepEqual(await rafale(1, 0.001).then((m) => [m.requetes, m.appels]), [2, 2], "l'état d'aujourd'hui : une emprise, deux requêtes")
  assert.deepEqual(await rafale(9, 0.002).then((m) => [m.requetes, m.appels]), [18, 18], 'un damier 3×3')
  assert.deepEqual(await rafale(25, 0.004).then((m) => [m.requetes, m.appels]), [50, 50], 'un 5×5 de zone isolée')
  oublierPanneOverpass()
})

test("l'écart minimal ne SÉRIALISE pas : les dix-huit requêtes partent ensemble", async () => {
  // 🔴 LE POINT QUI RETOURNE LA DÉCISION. On lit « écart minimal de 1 200 ms »
  // comme une file d'attente qui étalerait la rafale sur vingt secondes. Ce n'en
  // est pas une : chaque appel calcule son attente contre `_lastAt` AVANT que le
  // précédent ne l'ait écrit, donc dix-huit appels du même tour de boucle
  // attendent le MÊME délai puis partent en même temps. Ce n'est pas 9× le
  // trafic étalé, c'est une rafale simultanée depuis l'IP du visiteur.
  const m = await rafale(9, 0.02, { minInterval: 1200, latenceMs: 40 })
  assert.equal(m.appels, 18)
  assert.ok(m.pic >= 9, `pic de simultanéité ${m.pic} — mesuré 18 sur 18 dans la même milliseconde ; un écart qui sérialiserait vraiment donnerait 1`)
  oublierPanneOverpass()
})

test('au point d’accès public (2 créneaux par IP) seize des dix-huit repartent en 429 — et le disjoncteur reste FERMÉ', async () => {
  // Les deux moitiés du refus. D'abord : la rafale ne SERT à rien — huit cases
  // sur neuf n'auraient d'eau quand même pas, il ne resterait que le coût.
  // Ensuite : rien ne l'arrête. Un 429 est une erreur de REQUÊTE, et le module
  // refuse délibérément d'ouvrir son repos de 60 s dessus (couper l'eau partout
  // sur un 429 ponctuel fabriquerait la panne qu'on veut éviter). Une extension
  // qui passe SOUS le seul garde-fou du module est un défaut, pas un effet de
  // bord.
  const m = await rafale(9, 0.03, { slots: 2, latenceMs: 20 })
  assert.equal(m.appels, 18)
  assert.equal(m.refus, 16)
  assert.equal(m.servies, 2)
  assert.equal(m.nulles, 16)
  assert.equal(overpassEnPanne(), false, 'le disjoncteur ne compte pas les 429 : la rafale lui est invisible')
  oublierPanneOverpass()
})

test('aujourd’hui, la même IP ne tient jamais plus de deux requêtes en vol', async () => {
  // Le témoin : à une emprise, le pic de simultanéité est 2 (lignes + aires),
  // soit exactement le nombre de créneaux qu'offre le point d'accès public. La
  // marge est donc NULLE — c'est ce qui rend le ×9 décisif plutôt que confortable.
  const m = await rafale(1, 0.05, { slots: 2, latenceMs: 20 })
  assert.equal(m.pic, 2)
  assert.equal(m.refus, 0)
  assert.equal(m.servies, 2)
  oublierPanneOverpass()
})
