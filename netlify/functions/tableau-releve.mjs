// LE RELEVÉ — ce qui bouge dans une journée, compté trois fois par jour.
//
// La carte du code, elle, est régénérée au build : elle ne change que quand on
// commite, et la recalculer à midi ne dirait rien de neuf. Ce qui vit entre
// deux déploiements, c'est le nombre de cartes publiées et les ventes. C'est
// tout ce que compte cette fonction.
//
// ⚠️ FONCTION PLANIFIÉE : Netlify ne l'appelle QU'À L'HEURE DITE, jamais par
// HTTP. Elle n'a donc aucune surface d'attaque — mais elle n'a pas non plus de
// moyen de rendre son résultat à qui que ce soit. D'où l'écriture dans un blob,
// que `tableau.mjs` sert ensuite, lui sous clé.
//
// ⚠️ L'HEURE EST EN TEMPS UNIVERSEL, Netlify n'accepte rien d'autre. `4,10,16`
// donne bien 6 h / 12 h / 18 h à Paris EN ÉTÉ ; en hiver le relevé tombera une
// heure plus tôt (5 h / 11 h / 17 h). Corriger ça demanderait deux planifications
// et une déduplication, pour une heure de décalage sur un tableau de bord — le
// jeu n'en vaut pas la chandelle, mais il fallait que ce soit écrit.

import { getStore } from '@netlify/blobs'
// La forme d'une clé de carte, définie là où les clés se fabriquent. Compter
// « tout sauf les préfixes que je connais » revenait à tenir une liste noire à
// jour de mémoire : chaque nouveau préfixe posé par race.mjs (`owner/`, puis
// `rlr_`) gonflait le chiffre en silence — une carte réelle en affichait trois.
import { estCleDeCarte } from './race.mjs'

// Compte les clés d'un magasin sous un préfixe, en suivant la pagination.
//
// ⚠️ ON NE LIT AUCUN CONTENU. `list()` ne rend que des noms de clés : compter
// 400 cartes coûte ainsi quelques kilo-octets, là où les ouvrir coûterait
// plusieurs gigaoctets — un payload de carte pèse plusieurs mégaoctets.
async function compter(store, prefix = '') {
  let total = 0
  let cursor
  do {
    const page = await store.list({ prefix, cursor })
    total += (page.blobs || []).length
    cursor = page.cursor
  } while (cursor)
  return total
}

// Combien de CARTES dans cette liste de blobs. Liste blanche : seul ce qui a
// EXACTEMENT la forme d'un identifiant de course compte. Les seaux (`rl_`,
// `rlq_`, `rlr_`), les entrées d'index (`owner/…`) et tout ce qui viendra
// ensuite portent un « _ » ou un « / » que ID_RE interdit — ils sont donc
// écartés sans qu'on ait à les nommer.
export const cartesPubliees = (blobs) => (blobs || []).filter((b) => estCleDeCarte(b?.key)).length

export default async () => {
  const releve = { faitLe: new Date().toISOString(), erreurs: [] }

  try {
    const cartes = getStore({ name: 'race-payloads', consistency: 'strong' })
    // Les seaux de débit et les entrées d'index vivent dans le MÊME magasin :
    // les compter gonflerait le chiffre d'un facteur imprévisible.
    const toutes = await cartes.list()
    releve.cartesPubliees = cartesPubliees(toutes.blobs)
  } catch (err) {
    releve.erreurs.push(`cartes : ${err.message}`)
  }

  try {
    const journal = getStore('paiements')
    releve.commandes = await compter(journal, 'session/')
  } catch (err) {
    releve.erreurs.push(`commandes : ${err.message}`)
  }

  // ⚠️ Le relevé s'écrit MÊME PARTIEL. Un tableau de bord qui n'affiche rien
  // parce qu'un seul chiffre a manqué est un tableau de bord qu'on cesse de
  // regarder ; les erreurs voyagent avec les chiffres et s'affichent à côté.
  try {
    await getStore('tableau').setJSON('releve', releve)
  } catch (err) {
    console.error('[relevé] écriture impossible :', err)
    return new Response('relevé non écrit', { status: 500 })
  }

  console.info('[relevé]', JSON.stringify(releve))
  return new Response('ok', { status: 200 })
}
