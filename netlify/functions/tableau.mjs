// LE GUICHET DU RELEVÉ — et il est sous clé.
//
// ⚠️ CES CHIFFRES SONT DES CHIFFRES D'AFFAIRES. Le tableau de bord vit sur une
// adresse publique de shibumap.com ; sans cette clé, n'importe qui appelant
// cette fonction saurait combien ShibuMap vend. Ce n'est pas une donnée
// personnelle, donc pas un problème de RGPD — c'est un problème de commerce,
// et il se règle pareil : on ferme.
//
// La clé se pose dans Netlify sous `SHIBU_CLE_TABLEAU`, et s'ouvre en visitant
// /tableau-de-bord/?k=<la clé>. Le reste de la page — la carte du code — reste
// visible sans elle : c'est de l'architecture, pas du secret.

import { getStore } from '@netlify/blobs'
import { timingSafeEqual } from 'node:crypto'

// Même plancher que le code d'atelier : une clé courte se force, et se
// comporte alors exactement comme une clé absente.
const LONGUEUR_MIN = 24

// ⚠️ Comparaison à temps constant. Un `===` sur un secret fuit, caractère par
// caractère, de quoi le reconstruire.
function cleValide(proposee, attendue = process.env.SHIBU_CLE_TABLEAU) {
  if (typeof attendue !== 'string' || attendue.length < LONGUEUR_MIN) return false
  if (typeof proposee !== 'string' || !proposee) return false
  const a = Buffer.from(attendue, 'utf8')
  const b = Buffer.from(proposee, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const json = (corps, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': 'application/json',
      // ⚠️ JAMAIS DE CACHE. Ces chiffres dépendent d'une clé : une réponse
      // mise en cache par le réseau de diffusion serait resservie au visiteur
      // suivant, qui n'a pas la clé.
      'cache-control': 'no-store',
      'netlify-cdn-cache-control': 'no-store',
    },
  })

export default async (req) => {
  if (!cleValide(new URL(req.url).searchParams.get('k'))) {
    // 404 et non 403 : un refus explicite confirmerait que le guichet existe
    // et qu'il y a quelque chose derrière.
    return json({ erreur: 'introuvable' }, 404)
  }
  try {
    const releve = await getStore('tableau').get('releve', { type: 'json' })
    // Pas encore de relevé : le premier tombe à la prochaine heure planifiée.
    return json(releve || { enAttente: true })
  } catch (err) {
    console.error('[tableau] lecture impossible :', err)
    return json({ erreur: 'magasin indisponible' }, 502)
  }
}
