// LA SUPPRESSION D'UN COMPTE — POST /.netlify/functions/compte-supprimer
//
//   POST (avec `Authorization: Bearer <jeton>`)  ->  { ok: true }
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ ELLE NE SUPPRIME QUE LE COMPTE DE L'APPELANT. IL N'Y A PAS D'AUTRE MODE.
// ═══════════════════════════════════════════════════════════════════════════
//
// L'identifiant supprimé est celui que `compteVerifie` a tiré du JETON, et rien
// d'autre n'a de chemin jusqu'à lui : pas un champ du corps, pas un paramètre
// d'URL, pas un en-tête. Cette fonction NE LIT MÊME PAS LE CORPS de la requête,
// et c'est délibéré — un corps qu'on ne lit pas est un corps qu'on ne peut pas
// se mettre à croire un jour, dans six mois, « juste pour l'outil d'admin ».
// Une route de suppression qui accepte un identifiant est une route qui
// supprime le compte de quelqu'un d'autre le jour où sa vérification a un trou.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA CLÉ `service_role`, ET LE 503 QUAND ELLE MANQUE
// ═══════════════════════════════════════════════════════════════════════════
//
// Supprimer un utilisateur passe par l'API d'administration de Supabase
// (`DELETE /auth/v1/admin/users/<id>`), qui n'accepte que la clé
// `service_role`. Cette clé-là n'est PAS la clé « anon » : elle contourne toutes
// les règles de sécurité du projet et vaut, à elle seule, un accès complet à la
// base. Elle ne peut donc pas être posée par la même main qui écrit le code.
//
// Tant que `SUPABASE_SERVICE_ROLE_KEY` n'est pas dans l'environnement Netlify,
// cette route rend un 503 EXPLICITE — pas un 500 qui ressemblerait à un bug,
// pas un 200 qui mentirait à quelqu'un venu effacer ses données. Le reste du
// produit ne s'en trouve pas affecté d'un octet : ShibuMap s'utilise sans
// compte, et un compte s'utilise sans être supprimable.
//
// ═══════════════════════════════════════════════════════════════════════════
// L'ORDRE DES DEUX EFFACEMENTS, ET POURQUOI IL EST CELUI-LÀ
// ═══════════════════════════════════════════════════════════════════════════
//
// Deux choses disparaissent : l'utilisateur chez Supabase, et les entrées
// d'index `owner/<uid>/<raceId>` qui font le panneau « Mes cartes ».
//
// L'UTILISATEUR D'ABORD, L'INDEX ENSUITE, ET SANS DROIT DE VETO — c'est la
// doctrine déjà écrite dans race.mjs (« le blob est la vérité, l'index n'est
// qu'un cache »), appliquée à l'envers du même raisonnement :
//   · si l'index part en premier et que la suppression échoue, quelqu'un
//     garde son compte mais perd la liste de ses cartes. Du dégât visible, sur
//     un compte bien vivant.
//   · si l'utilisateur part en premier et que le ménage échoue, il reste des
//     entrées orphelines sous un identifiant que plus personne ne pourra jamais
//     présenter. Du déchet invisible, et sans conséquence.
//
// ⚠️ LES CARTES PUBLIÉES, ELLES, NE SONT PAS TOUCHÉES. C'est écrit noir sur
// blanc dans l'écran de confirmation (« leurs liens continuent de fonctionner
// pour ceux qui les ont ») et c'est la seule promesse tenable : un organisateur
// qui a diffusé un lien à trois cents coureurs ne doit pas casser leur lien en
// fermant son compte — sinon il ne le ferme pas, et il écrit à Adrien.

import { getStore } from '@netlify/blobs'
import { compteVerifie } from './_compte.mjs'

const SANS_CACHE = { 'cache-control': 'no-store' }

const json = (corps, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json', ...SANS_CACHE },
  })

// Au-delà, on considère que Supabase ne répond pas — même garde que
// `_compte.mjs`, et pour la même raison : une panne de leur côté ne doit pas
// faire expirer la fonction entière.
const DELAI_MS = 8000

// Le miroir de `cleIndexProprietaire` (race.mjs). La fonction ne peut pas
// importer depuis src/, et race.mjs ne l'exporte que pour ses propres tests :
// la règle est donc écrite deux fois, comme le reste de ce contrat.
const prefixeIndex = (uid) => `owner/${uid}/`

// Un identifiant de compte, tel que `compteVerifie` le rend. On le revalide
// avant de le coller dans une URL et dans un préfixe de clé : c'est la seule
// chose de cette fonction qui traverse une frontière.
const COMPTE_RE = /^[A-Za-z0-9_-]{8,64}$/

/**
 * Le ménage de l'index. AUCUN DROIT DE VETO : la suppression a déjà eu lieu.
 * Le magasin est passé en argument (les tests en fournissent un en mémoire).
 */
async function effacerIndexDuCompte(store, uid) {
  if (!store) return
  try {
    const { blobs } = await store.list({ prefix: prefixeIndex(uid) })
    for (const b of blobs || []) {
      // `delete` est optionnel à dessein : un magasin de test ou une version
      // antérieure peut ne pas l'avoir, et ce n'est pas ce ménage qui doit
      // faire échouer une suppression déjà accomplie.
      await store.delete?.(b.key)
    }
  } catch (err) {
    console.error('[compte] index non nettoyé après suppression (le compte, lui, est parti) :', err)
  }
}

/**
 * Le cœur, injectable de bout en bout — magasin, `fetch`, environnement — pour
 * que le chemin entier (autorisation comprise) soit vérifiable sans réseau.
 */
export async function handleSuppression(req, store, {
  apporter = fetch,
  env = process.env,
  verifieCompte = compteVerifie,
} = {}) {
  if (req.method !== 'POST') return json({ error: 'méthode' }, 405)

  // ⚠️ L'AUTORISATION AVANT LA CONFIGURATION. Rendre le 503 en premier
  // dirait à n'importe qui, sans le moindre jeton, quelles variables
  // d'environnement manquent sur ce site. Sans jeton, `compteVerifie` rend ''
  // sans le moindre appel réseau : ce contrôle-là ne coûte rien.
  const uid = await verifieCompte(req)
  if (!uid || !COMPTE_RE.test(uid)) return json({ error: 'connexion requise' }, 401)

  const base = String(env.SUPABASE_URL || '').trim().replace(/\/$/, '')
  const cle = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!base || !cle) {
    console.error('[compte] suppression impossible : SUPABASE_SERVICE_ROLE_KEY absente')
    return json({
      ok: false,
      // 503 et pas 500 : ce n'est pas un bug, c'est une clé qui n'est pas
      // encore posée. Le message est destiné à Adrien dans les journaux, pas à
      // l'utilisateur — l'écran affiche son propre texte (voir REFUS dans
      // src/ui/compte.js).
      erreur: 'suppression de compte non configurée sur ce site (SUPABASE_SERVICE_ROLE_KEY manquante)',
    }, 503)
  }

  let rep
  try {
    rep = await apporter(`${base}/auth/v1/admin/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers: {
        // Supabase exige les deux, comme partout ailleurs : la clé identifie le
        // projet, le jeton identifie le pouvoir. Ici les deux sont la même
        // valeur — c'est la forme que l'API d'administration attend.
        apikey: cle,
        authorization: `Bearer ${cle}`,
      },
      signal: AbortSignal.timeout(DELAI_MS),
    })
  } catch (err) {
    console.error('[compte] Supabase injoignable à la suppression :', err?.message || err)
    return json({ error: 'service indisponible' }, 502)
  }

  // 404 : l'utilisateur n'existe déjà plus. C'est le résultat demandé, pas une
  // erreur — quelqu'un qui clique deux fois ne doit pas voir un échec.
  if (!rep.ok && rep.status !== 404) {
    console.error('[compte] Supabase a refusé la suppression :', rep.status)
    return json({ error: 'suppression refusée' }, 502)
  }

  await effacerIndexDuCompte(store, uid)
  return json({ ok: true })
}

export default async (req) =>
  handleSuppression(req, getStore({ name: 'race-payloads', consistency: 'strong' }))
