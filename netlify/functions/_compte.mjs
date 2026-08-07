// LA SESSION VÉRIFIÉE — la seule source d'identité du serveur.
//
// Tout le système de comptes repose sur cette fonction. Elle répond à une
// question et une seule : « qui est cette requête ? », et elle n'accepte pour
// preuve qu'un jeton signé par Supabase. Rien de ce que le navigateur raconte
// par ailleurs — un champ du corps, un paramètre d'URL, un en-tête inventé —
// ne peut influencer sa réponse.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI ON INTERROGE SUPABASE PLUTÔT QUE DE VÉRIFIER LA SIGNATURE ICI
// ═══════════════════════════════════════════════════════════════════════════
//
// Un jeton Supabase est un JWT : on POURRAIT le vérifier localement contre les
// clés publiques du projet, sans aucun appel réseau. C'est plus rapide, et
// c'est ce que font la plupart des tutoriels.
//
// On ne le fait pas, pour deux raisons.
//
// 1. VÉRIFIER UN JWT À LA MAIN EST EXACTEMENT LÀ OÙ L'ON SE TROMPE. Il faut
//    refuser l'algorithme « none », refuser qu'un jeton signé en symétrique
//    passe pour de l'asymétrique, vérifier l'expiration, l'émetteur, le
//    destinataire — et chacun de ces oublis est une porte ouverte, silencieuse.
//    Ce fichier décide qui possède quoi ; ce n'est pas l'endroit pour
//    réimplémenter de la cryptographie.
//
// 2. LE COÛT N'EN EST PAS UN ICI. Un appel HTTPS de plus sur une publication de
//    carte ou une mise en caisse, c'est quelques dizaines de millisecondes sur
//    une action qui en prend déjà des centaines. ShibuMap n'a pas un profil de
//    charge où ça compte, et il sera toujours temps d'optimiser le jour où ce
//    sera mesurable — pas avant.
//
// ⚠️ CONSÉQUENCE ASSUMÉE : si Supabase est injoignable, PERSONNE n'est
// authentifié. C'est le bon sens de l'échec — mieux vaut refuser une propriété
// que d'en accorder une par erreur — et le produit continue de fonctionner,
// parce que le jeton d'édition (secretMatches) est un chemin indépendant qui,
// lui, ne dépend de personne.

// Le jeton d'un utilisateur connecté. Supabase les émet en JWT, donc trois
// segments en base64url séparés par des points. On borne AVANT d'appeler quoi
// que ce soit : inutile d'envoyer 4 Mo de n'importe quoi à Supabase parce que
// quelqu'un a rempli l'en-tête au hasard.
const JETON_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const JETON_MAX = 4096

// Au-delà, on considère que Supabase ne répond pas. Sans ce garde, une panne
// de leur côté ferait expirer la fonction entière — et une publication de
// carte échouerait pour quelqu'un qui n'avait même pas de compte.
const DELAI_MS = 4000

export function jetonPresente(req) {
  const brut = req.headers.get('authorization') || ''
  const m = /^Bearer\s+(.+)$/i.exec(brut.trim())
  if (!m) return ''
  const jeton = m[1].trim()
  if (jeton.length > JETON_MAX || !JETON_RE.test(jeton)) return ''
  return jeton
}

/**
 * L'identifiant de l'utilisateur derrière cette requête, ou '' s'il n'y en a
 * pas — et '' est un cas parfaitement normal : ShibuMap s'utilise sans compte.
 *
 * `apporter` est injectable pour les tests ; en production c'est `fetch`.
 */
export async function compteVerifie(req, apporter = fetch, env = process.env) {
  const jeton = jetonPresente(req)
  if (!jeton) return ''

  const base = env.SUPABASE_URL
  const cle = env.SUPABASE_ANON_KEY
  // ⚠️ Sans configuration, on ne devine pas : on refuse. Une authentification
  // qui « marche quand même » quand ses variables manquent n'authentifie rien.
  if (!base || !cle) return ''

  const stop = AbortSignal.timeout(DELAI_MS)
  let rep
  try {
    rep = await apporter(`${base.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${jeton}`,
        // Supabase exige les DEUX : la clé publique du projet identifie le
        // projet, le jeton identifie la personne.
        apikey: cle,
      },
      signal: stop,
    })
  } catch (err) {
    // Réseau coupé, délai dépassé, DNS : on n'authentifie personne.
    console.error('[compte] Supabase injoignable :', err?.message || err)
    return ''
  }

  // 401 sur un jeton expiré ou falsifié : c'est le cas nominal du refus, pas
  // une anomalie — on ne l'écrit pas dans les journaux, il arriverait à chaque
  // session périmée.
  if (!rep.ok) return ''

  let corps
  try {
    corps = await rep.json()
  } catch {
    return ''
  }

  // ⚠️ UN 200 DE SUPABASE N'EST PAS UNE IDENTITÉ. Entre « GoTrue a répondu
  // 200 » et « cette requête possède des cartes », il n'y avait qu'une longueur
  // de chaîne : un corps portant `role: 'anon'` ou `role: 'service_role'`
  // devenait un `ownerId` et une clé d'index. Ce n'est pas exploitable
  // aujourd'hui — GoTrue refuse ces jetons-là sur /auth/v1/user — mais la seule
  // chose qui nous en séparait était le comportement d'un service tiers, à sa
  // version d'aujourd'hui. `aud` est le destinataire du jeton, et le seul qui
  // désigne un vrai utilisateur connecté vaut EXACTEMENT 'authenticated'. On le
  // compare en strict : ni un tableau, ni une valeur approchante.
  if (corps?.aud !== 'authenticated') return ''

  // ON NE REND QUE L'IDENTIFIANT. Pas le courriel, pas les métadonnées.
  // Le courriel change ; l'identifiant, jamais. Et tout ce qu'on ne fait pas
  // circuler est une chose de moins à protéger, à exporter et à effacer.
  const uid = corps?.id
  return typeof uid === 'string' && uid.length >= 8 && uid.length <= 64 ? uid : ''
}
