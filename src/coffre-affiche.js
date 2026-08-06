// ═══════════════════════════════════════════════════════════════════════════
// LE COFFRE — CE QUI FAIT SURVIVRE LE FICHIER AU PAIEMENT
// ═══════════════════════════════════════════════════════════════════════════
//
// La tâche 8 a rangé le rendu AVANT la caisse, et cela supprime une classe
// d'échec entière : « il a payé, ça a raté » n'existe plus. Mais elle laissait
// une réserve écrite noir sur blanc au registre du chantier :
//
//   « LE FICHIER NE SURVIT PAS AU PAIEMENT. Partir chez Stripe est une
//     NAVIGATION, le document est détruit, les blobs avec. La tâche 8 garantit
//     "cette machine SAIT le produire", pas "le fichier est EN SÉCURITÉ". »
//
// Rendre avant d'encaisser prouvait une capacité. Ce module garde le résultat.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES TROIS VOIES, ET POURQUOI C'EST CELLE-CI
// ═══════════════════════════════════════════════════════════════════════════
//
// ① OUVRIR LA CAISSE DANS UN NOUVEL ONGLET, pour que la page qui tient le
//    fichier survive. C'est la voie la plus simple à écrire, et elle ne marche
//    pas ici, pour deux raisons indépendantes :
//    · L'ACTIVATION DE L'UTILISATEUR EST DÉJÀ CONSOMMÉE. Entre le clic et
//      l'ouverture de la caisse il y a l'écran de validation puis le tirage —
//      MESURÉ À 11,5 s sur un 50 × 70 (tâche 8). `window.open` appelé onze
//      secondes après le geste, derrière une dizaine d'`await`, n'est plus un
//      « popup déclenché par l'utilisateur » pour aucun navigateur : il est
//      bloqué. On aurait remplacé « le fichier meurt » par « la vente meurt ».
//    · ET L'ONGLET QUI REVIENT N'EST PAS CELUI QUI TIENT LE FICHIER. Stripe
//      redirige vers `success_url` DANS L'ONGLET DE LA CAISSE. Le fichier, lui,
//      est resté dans l'autre. Il faudrait alors faire dialoguer deux documents
//      (BroadcastChannel, sondage de `sessionStorage`) — c'est-à-dire écrire un
//      canal de communication entre onglets pour éviter d'écrire un stockage.
//    S'y ajoute le cas des navigateurs intégrés (Instagram, Facebook, Gmail),
//    qui n'ouvrent souvent pas d'onglet du tout.
//
// ② REFAIRE LE TIRAGE AU RETOUR. Honnête, et rejeté pour une raison qui n'est
//    pas la durée (11,5 s de plus, on les paierait) :
//    · LE LOGO IMPORTÉ NE TRAVERSE PAS. C'est écrit dans paiement.js : le logo
//      est une URL d'objet, elle meurt avec le document, et `afficheSerialisable`
//      ne le sérialise pas. Un tirage refait après le paiement livrerait donc une
//      AUTRE affiche que celle validée — sans le logo payé. C'est exactement
//      l'écart que tout ce chantier existe pour supprimer.
//    · Et c'est une SECONDE CHANCE D'ÉCHOUER, cette fois APRÈS le débit :
//      la classe d'échec que la tâche 8 vient de supprimer, réintroduite d'un
//      cran plus loin.
//
// ③ PERSISTER. Retenu. La réserve disait « 89 Mo en base locale est une
//    décision, pas une ligne » — et elle avait raison à 89 Mo. Sauf que ces
//    89 Mo étaient du PNG. Le PDF de production emballe du JPEG recopié tel quel
//    (voir pdf-affiche.js) : le fichier réel PÈSE UN ORDRE DE GRANDEUR DE MOINS.
//    Écrire une dizaine de mégaoctets dans IndexedDB est une opération ordinaire
//    sur tous les navigateurs de la cible. La mesure a changé l'arbitrage.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CE MODULE PROMET, ET CE QU'IL NE PROMET PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ IL NE LÈVE JAMAIS. Un stockage refusé — navigation privée, quota, base
// verrouillée par un autre onglet — ne doit pas coûter une vente. Chaque
// fonction rend `false` ou `null` et le DIT en console. Le pire cas retombe
// exactement sur le comportement d'avant ce module : le fichier est perdu, et
// c'est Adrien qui l'envoie par mail (ce que le message de retour promet déjà).
//
// ⚠️ IL N'EST PAS UNE LIVRAISON. Rien ici ne remplace la tâche 10 : le fichier
// est dans le navigateur DE L'ACHETEUR, sur CETTE machine. S'il paie sur son
// téléphone et veut le fichier sur son ordinateur, seul un envoi serveur le
// donne. Ce coffre couvre le cas nominal — celui où l'on revient de la caisse
// dans l'onglet d'où l'on est parti, c'est-à-dire l'immense majorité.
//
// ⚠️ ET IL S'EFFACE. Une affiche dit où quelqu'un est allé : c'est une donnée
// personnelle qui n'a aucune raison de dormir un mois dans son navigateur. Deux
// gestes : la remise au client jette l'entrée, et tout ce qui dépasse
// `DUREE_VIE_MS` est purgé à l'ouverture suivante.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI DEUX MAGASINS
// ═══════════════════════════════════════════════════════════════════════════
//
// Un seul magasin obligerait la purge à lire les enregistrements ENTIERS pour
// atteindre leur date — c'est-à-dire à charger les PDF en mémoire pour décider
// de les jeter. Les FICHES (quelques centaines d'octets) portent la date et le
// nom ; les CORPS portent le blob et rien d'autre. La purge ne touche jamais un
// corps qu'elle ne supprime pas.
//
// ⚠️ MODULE SANS DOM ET SANS GLOBALE OBLIGATOIRE : `indexedDB` est un ARGUMENT
// (la globale par défaut). C'est ce qui rend ce fichier testable sous node,
// alors que c'est le seul endroit du projet où une erreur perd un fichier payé.

/** Le nom de la base. Préfixé comme les clés de session : une origine, plusieurs sujets. */
export const NOM_BASE = 'shibumap.coffre'

/** La version du schéma. À monter si un magasin est ajouté — jamais autrement. */
export const VERSION_BASE = 1

/** Les fiches : identifiant, nom de fichier, poids, date. Petites, donc lisibles en bloc. */
export const MAGASIN_FICHES = 'fiches'

/** Les corps : `{ id, blob }`, et rien de plus. On ne les lit que pour les rendre. */
export const MAGASIN_CORPS = 'corps'

/**
 * Vingt-quatre heures.
 *
 * ⚠️ CE N'EST PAS UN DÉLAI DE COURTOISIE, C'EST UNE DURÉE DE VIE. Un aller-retour
 * chez Stripe se compte en minutes ; une carte qui demande une validation
 * bancaire, en heures au pire. Au-delà, l'entrée n'est plus un fichier en
 * transit, c'est un résidu — et un résidu qui pèse une dizaine de mégaoctets et
 * qui nomme un lieu.
 */
export const DUREE_VIE_MS = 24 * 60 * 60 * 1000

// ═══════════════════════════════════════════════════════════════════════════
// ① LES PRIMITIVES — UNE REQUÊTE, UNE TRANSACTION
// ═══════════════════════════════════════════════════════════════════════════

/** Une requête IndexedDB, en promesse. */
function requete(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error || new Error('coffre : requête refusée'))
  })
}

/**
 * La fin d'une transaction, en promesse.
 *
 * ⚠️ C'EST LA TRANSACTION QU'ON ATTEND POUR UNE ÉCRITURE, PAS LA REQUÊTE. Un
 * `put` de dix mégaoctets rend `onsuccess` bien avant que les octets soient
 * réellement écrits : un dépassement de quota n'apparaît qu'à la VALIDATION, en
 * `abort`. Attendre la requête seule, c'est croire à un dépôt qui n'a pas eu lieu.
 */
function finie(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res(true)
    tx.onerror = () => rej(tx.error || new Error('coffre : transaction en erreur'))
    tx.onabort = () => rej(tx.error || new Error('coffre : transaction abandonnée'))
  })
}

/**
 * Ouvre la base, en créant les magasins au besoin.
 *
 * @param {object} [o]
 * @param {IDBFactory} [o.idb] - injectable ; la globale par défaut
 * @returns {Promise<IDBDatabase>}
 */
export function ouvrirCoffre({ idb = globalThis.indexedDB } = {}) {
  if (!idb || typeof idb.open !== 'function') {
    return Promise.reject(new Error('coffre : indexedDB indisponible'))
  }
  const req = idb.open(NOM_BASE, VERSION_BASE)
  req.onupgradeneeded = () => {
    const db = req.result
    if (!db.objectStoreNames.contains(MAGASIN_FICHES)) db.createObjectStore(MAGASIN_FICHES, { keyPath: 'id' })
    if (!db.objectStoreNames.contains(MAGASIN_CORPS)) db.createObjectStore(MAGASIN_CORPS, { keyPath: 'id' })
  }
  return requete(req)
}

/** Referme sans jamais se plaindre : une base déjà fermée n'est pas un incident. */
function refermer(db) {
  try { db?.close?.() } catch { /* rien à fermer, rien à dire */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// ② LA FICHE — CE QU'ON GARDE À CÔTÉ DU FICHIER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ce qui se range dans le magasin des fiches. Liste EXPLICITE, jamais un
 * `{...entree}` : l'état d'affiche porte des URL d'objet et des références à la
 * scène, qui ne survivent pas à une sérialisation structurée (ou qui la
 * traversent en `{}`, ce qui est pire — on croirait avoir sauvegardé).
 */
export function fichePour(entree = {}, maintenant = Date.now()) {
  const id = String(entree.id || '')
  if (!id) return null
  return {
    id,
    nom: String(entree.nom || 'affiche.pdf'),
    type: String(entree.type || 'application/pdf'),
    octets: Number.isFinite(entree.octets) && entree.octets > 0 ? Math.round(entree.octets) : 0,
    format: String(entree.format || ''),
    orientation: String(entree.orientation || ''),
    dpi: Number.isFinite(entree.dpi) ? Math.round(entree.dpi) : 0,
    date: Number.isFinite(entree.date) ? entree.date : maintenant,
  }
}

/**
 * Les identifiants des fiches périmées. Pur, donc vérifiable sans base.
 *
 * ⚠️ UNE DATE ILLISIBLE EST PÉRIMÉE. Une entrée écrite par une version
 * précédente de ce code, ou corrompue, ne doit pas devenir immortelle : le seul
 * moyen de ne jamais la revoir est de la traiter comme expirée.
 */
export function perimees(fiches, { maintenant = Date.now(), dureeVie = DUREE_VIE_MS } = {}) {
  if (!Array.isArray(fiches)) return []
  return fiches
    .filter((f) => f && typeof f.id === 'string' && f.id
      && (!Number.isFinite(f.date) || maintenant - f.date > dureeVie))
    .map((f) => f.id)
}

// ═══════════════════════════════════════════════════════════════════════════
// ③ DÉPOSER, RETIRER, JETER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dépose un fichier. Rend `true` s'il est VRAIMENT écrit.
 *
 * ⚠️ APPELÉ AVANT DE PARTIR CHEZ STRIPE, ET ATTENDU. Un dépôt lancé sans être
 * attendu est un dépôt qui n'a pas lieu : `location.assign` détruit le document,
 * et une transaction IndexedDB non validée est abandonnée avec lui.
 *
 * @param {{id:string, blob:Blob, nom?:string, octets?:number}} entree
 * @param {object} [options] - `{ idb }`
 * @returns {Promise<boolean>}
 */
export async function deposer(entree, options = {}) {
  const fiche = fichePour(entree)
  if (!fiche || !entree?.blob) return false
  let db = null
  try {
    db = await ouvrirCoffre(options)
    const tx = db.transaction([MAGASIN_FICHES, MAGASIN_CORPS], 'readwrite')
    tx.objectStore(MAGASIN_FICHES).put(fiche)
    tx.objectStore(MAGASIN_CORPS).put({ id: fiche.id, blob: entree.blob })
    await finie(tx)
    return true
  } catch (err) {
    // Le pire cas retombe sur le comportement d'avant ce module : le fichier est
    // perdu et Adrien l'envoie par mail. Ce n'est PAS une raison de perdre la
    // vente, ni de le taire.
    console.warn(
      '[ShibuMap] coffre : le fichier d’impression n’a pas pu être mis de côté avant le paiement '
      + `(${err?.message || err}). Il devra être renvoyé à la main.`
    )
    return false
  } finally {
    refermer(db)
  }
}

/**
 * Retire un fichier — la fiche ET le corps. Rend `null` si rien à ce nom.
 *
 * ⚠️ IL NE JETTE PAS. Rendre le fichier et l'effacer dans le même geste, c'est
 * l'effacer avant de savoir si le téléchargement a abouti. `jeter` est appelé
 * après, par qui a constaté la remise.
 */
export async function retirer(id, options = {}) {
  const cle = String(id || '')
  if (!cle) return null
  let db = null
  try {
    db = await ouvrirCoffre(options)
    const tx = db.transaction([MAGASIN_FICHES, MAGASIN_CORPS], 'readonly')
    // ⚠️ LES DEUX LECTURES SONT LANCÉES D'AFFILÉE, SANS `await` ENTRE ELLES. Une
    // transaction IndexedDB se referme d'elle-même dès qu'elle n'a plus de
    // requête en cours : demander le corps APRÈS avoir attendu la fiche, c'est
    // le demander à une transaction dont certains moteurs considèrent qu'elle
    // est déjà terminée. Deux requêtes posées ensemble, une seule attente.
    const [fiche, corps] = await Promise.all([
      requete(tx.objectStore(MAGASIN_FICHES).get(cle)),
      requete(tx.objectStore(MAGASIN_CORPS).get(cle)),
    ])
    if (!fiche || !corps?.blob) return null
    return { ...fiche, blob: corps.blob }
  } catch (err) {
    console.warn('[ShibuMap] coffre : lecture impossible —', err?.message || err)
    return null
  } finally {
    refermer(db)
  }
}

/** Jette une entrée. Silencieux : ce qui n'existe plus n'a pas à se plaindre. */
export async function jeter(id, options = {}) {
  const cle = String(id || '')
  if (!cle) return false
  let db = null
  try {
    db = await ouvrirCoffre(options)
    const tx = db.transaction([MAGASIN_FICHES, MAGASIN_CORPS], 'readwrite')
    tx.objectStore(MAGASIN_FICHES).delete(cle)
    tx.objectStore(MAGASIN_CORPS).delete(cle)
    await finie(tx)
    return true
  } catch {
    return false
  } finally {
    refermer(db)
  }
}

/**
 * Purge ce qui a dépassé sa durée de vie. Rend le nombre d'entrées jetées.
 *
 * ⚠️ ELLE NE LIT QUE LES FICHES. C'est toute la raison des deux magasins : lire
 * les corps pour décider de les jeter chargerait en mémoire, une par une, les
 * affiches qu'on est justement en train de vouloir libérer.
 */
export async function purger({ maintenant = Date.now(), dureeVie = DUREE_VIE_MS, ...options } = {}) {
  let db = null
  try {
    db = await ouvrirCoffre(options)
    const lecture = db.transaction(MAGASIN_FICHES, 'readonly')
    const fiches = await requete(lecture.objectStore(MAGASIN_FICHES).getAll())
    const morts = perimees(fiches, { maintenant, dureeVie })
    if (!morts.length) return 0
    const tx = db.transaction([MAGASIN_FICHES, MAGASIN_CORPS], 'readwrite')
    for (const id of morts) {
      tx.objectStore(MAGASIN_FICHES).delete(id)
      tx.objectStore(MAGASIN_CORPS).delete(id)
    }
    await finie(tx)
    return morts.length
  } catch {
    return 0
  } finally {
    refermer(db)
  }
}
