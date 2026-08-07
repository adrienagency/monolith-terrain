// LA CONFIGURATION PUBLIQUE DU COMPTE — deux valeurs, et pas une de plus.
//
//   GET /.netlify/functions/compte-config  ->  { ok: true, url, cle }
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CETTE FONCTION EXISTE ALORS QUE CES DEUX VALEURS SONT PUBLIQUES
// ═══════════════════════════════════════════════════════════════════════════
//
// L'URL du projet Supabase et sa clé « anon » partent dans chaque navigateur :
// elles sont publiques PAR CONCEPTION, c'est leur métier. La façon habituelle
// de les livrer serait de les inscrire dans le bundle à la compilation, via une
// variable `VITE_…` que Vite remplace littéralement.
//
// On ne peut pas : elles vivent dans l'environnement Netlify sous
// `SUPABASE_URL` et `SUPABASE_ANON_KEY`, sans préfixe `VITE_`, donc invisibles
// du build — et ce sont exactement les mêmes noms que lit `_compte.mjs` côté
// serveur. Les dupliquer sous un second nom préfixé, ce serait deux variables
// à garder en phase, et un jour où l'une tourne sans l'autre.
//
// Un GET les rend, une fois, quand quelqu'un ouvre la connexion. Le client
// l'appelle PARESSEUSEMENT (voir src/compte.js) : l'application 3D démarre sans
// jamais toucher cette route.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ CETTE FONCTION NE PARCOURT PAS `process.env`, ET NE LE FERA JAMAIS
// ═══════════════════════════════════════════════════════════════════════════
//
// Deux noms sont lus, en toutes lettres, et rien d'autre n'a de chemin vers la
// réponse. Le même environnement porte `STRIPE_SECRET_KEY`, le secret du
// webhook et les jetons de déploiement : une boucle sur `process.env` — même
// filtrée par un préfixe, même « juste pour déboguer » — les publierait tous
// d'un coup, sans bruit et sans que rien ne le signale. Un test vérifie qu'un
// environnement pollué ne fait sortir que `url` et `cle`.

const json = (corps, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'content-type': 'application/json',
      // Publiques, mais pas immuables : le jour où la clé est révoquée, un
      // cache de trente secondes ne sauve rien et sert encore l'ancienne.
      'cache-control': 'no-store',
    },
  })

const CLE_MAX = 512
const URL_MAX = 200

/**
 * L'URL vers laquelle le NAVIGATEUR va poster le courriel de l'utilisateur.
 *
 * ⚠️ On la valide avant de la rendre. Une variable d'environnement mal remplie
 * — un `http://` recopié, un hôte changé par erreur — ferait partir des
 * adresses de courriel en clair vers n'importe où, sans que personne ne le
 * voie. Un identifiant dans l'URL (`https://user:mdp@…`) ou une query traînante
 * n'ont aucune raison d'être là non plus : on refuse plutôt que de deviner.
 */
export function urlSupabaseValide(brut) {
  if (typeof brut !== 'string' || !brut.trim() || brut.length > URL_MAX) return false
  let u
  try {
    u = new URL(brut.trim())
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  if (u.username || u.password) return false
  if (u.search || u.hash) return false
  return u.pathname === '/' || u.pathname === ''
}

/**
 * Les deux valeurs, lues UNE PAR UNE dans l'environnement.
 * Pure : les tests n'ont jamais à toucher `process.env`.
 */
export function configPublique(env = {}) {
  const url = String(env.SUPABASE_URL || '').trim()
  const cle = String(env.SUPABASE_ANON_KEY || '').trim()
  if (!urlSupabaseValide(url)) return { ok: false, erreur: 'compte indisponible' }
  if (!cle || cle.length > CLE_MAX) return { ok: false, erreur: 'compte indisponible' }
  // ⚠️ L'objet rendu est construit à la main, champ par champ. Jamais un
  // `{ ...env }` filtré : c'est la seule forme qui ne peut pas fuir demain.
  return { ok: true, url: url.replace(/\/$/, ''), cle }
}

export default async (req, _contexte, env = process.env) => {
  if (req.method !== 'GET') return json({ ok: false, erreur: 'méthode' }, 405)
  const c = configPublique(env)
  // 503 et pas 500 : ce n'est pas un bug, c'est un service qui n'est pas encore
  // branché. ShibuMap s'utilise sans compte — le reste du produit continue.
  if (!c.ok) return json(c, 503)
  return json(c)
}
