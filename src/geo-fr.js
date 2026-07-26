// Délimitations administratives françaises — communes, départements, régions.
//
// SOURCES ET LICENCES (vérifiées le 2026-07-26)
//  · Communes : API Découpage administratif, https://geo.api.gouv.fr (Etalab /
//    data.gouv.fr). Sans clé, gratuite. Données INSEE (Code Officiel
//    Géographique) + IGN Admin Express — Licence Ouverte / Open Licence 2.0.
//  · Départements et régions : france-geojson de Grégoire David
//    (github.com/gregoiredavid/france-geojson), conversion des tracés IGN
//    Admin Express COG. Son README renvoie explicitement aux conditions
//    d'Admin Express, c'est-à-dire la Licence Ouverte / Etalab.
//    Fichiers VENDORISÉS par scripts/fetch-geo-fr.mjs dans public/geo/fr/.
//
// POURQUOI DEUX SOURCES ET PAS UNE
// geo.api.gouv.fr NE REND PLUS de `contour` pour les départements ni les
// régions : le champ est ignoré en silence (`/departements/74?fields=contour`
// rend `{"nom":"Haute-Savoie","code":"74"}`, rien d'autre). Il faut donc un
// tracé embarqué pour ces deux niveaux — et comme ils ne sont que 119 en tout,
// on peut se le permettre.
//
// POURQUOI LES COMMUNES NE SONT PAS EMBARQUÉES
// Elles sont 35 000 : le fichier national fait 45 Mo. On les demande à
// l'unité, au moment où on en a besoin, et on garde la réponse en mémoire —
// même motif que nominatimCache dans region-mask.js (promesse mise en cache,
// évincée en cas d'échec pour qu'une nouvelle tentative reste possible).
//
// POURQUOI UN FICHIER PAR ENTITÉ ET UN INDEX À PART
// departements.geojson pèse 3,4 Mo et regions.geojson 1,45 Mo. Les charger
// pour dessiner UN département reviendrait à télécharger la France entière
// pour la Haute-Savoie (25 Ko). Le script découpe donc un fichier par entité,
// plus un index de ~12 Ko (nom, nom normalisé, code, niveau, centre) qui est
// le SEUL fichier lu au démarrage : la recherche s'y fait en mémoire, sans
// réseau, et le tracé ne descend qu'à la sélection.
//
// LE FORMAT DE SORTIE — `parts`
// Toutes les fonctions publiques rendent des coordonnées de MultiPolygon :
// un tableau de POLYGONES, chaque polygone étant un tableau d'ANNEAUX dont le
// premier est l'extérieur ([[[ [lon,lat],… ],…],…]). C'est exactement ce que
// consomment déjà frameRegion (qui ne lit que `rings[0]`) et rasterizeMask
// (qui parcourt tous les anneaux et creuse les trous en evenodd) dans
// region-mask.js. Un MultiPolygon devient donc plusieurs entrées, et les trous
// (enclaves : Vaucluse dans la Drôme, Valréas) sont conservés puisque les deux
// consommateurs savent les traiter.

const API = 'https://geo.api.gouv.fr'
// public/ est servi à la racine du site par Vite (base './'), donc
// public/geo/fr/* se demande en relatif — même convention que coast-mask.js
// et les couches de tuiles.
const BASE = 'geo/fr/'

// combien de communes l'API doit proposer avant notre propre classement. Son
// _score est mauvais (voir rankFR) : il faut assez de candidats pour que
// l'entrée exacte soit dans le lot, sans rapatrier la moitié du pays.
const COMMUNE_LIMIT = 20

// ---------------------------------------------------------------- normalisation

// Articles de tête d'un toponyme. « Le Havre » se cherche presque toujours par
// « Havre », « La Rochelle » par « Rochelle ».
const ARTICLES = new Set(['le', 'la', 'les', 'l'])

// Nom → clé de comparaison. Tout ce qui varie d'une frappe à l'autre disparaît :
// la casse, les accents (« Côtes-d'Armor »), les tirets et les apostrophes
// (droite ou typographique), les espaces multiples.
//
// ⚠️ Le dépliage St → Saint se fait sur des MOTS ENTIERS, jamais sur un
// préfixe : « Strasbourg » commence par « st » et n'a rien d'un saint.
export function normalizeFR(nom) {
  if (typeof nom !== 'string') return ''
  const brut = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents détachés par NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // tirets, apostrophes ’ et ', ponctuation
    .trim()
  if (!brut) return ''
  return brut
    .split(' ')
    .map((m) => (m === 'st' ? 'saint' : m === 'ste' ? 'sainte' : m))
    .join(' ')
}

// Ce qui part sur le RÉSEAU — et qui n'est PAS la clé de comparaison.
//
// ⚠️ PIÈGE MESURÉ EN VRAI (2026-07-26). La recherche floue de geo.api.gouv.fr
// tolère la casse, les accents manquants et les tirets remplacés par des
// espaces — mais PAS l'apostrophe élidée. Envoyer la clé normalisée rendait
// zéro résultat sur toute une famille de communes :
//     nom=saint martin d uriage → (vide)   nom=saint-martin-d'uriage → OK
//     nom=les sables d olonne   → (vide)   nom=les sables d'olonne   → OK
// On envoie donc la frappe de l'utilisateur presque telle quelle : apostrophe
// typographique ramenée à l'apostrophe droite, espaces resserrés, et St/Ste
// dépliés — ça, l'API ne sait pas le faire (« St Martin d'Uriage » : zéro
// résultat, « Saint Martin d'Uriage » : la bonne commune).
export function apiQueryFR(query) {
  return String(query || '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    // mots ENTIERS seulement : « Strasbourg » et « Brest » ne sont pas des saints
    .replace(/\bst\b/gi, 'Saint')
    .replace(/\bste\b/gi, 'Sainte')
}

// Retire l'article de tête d'une clé déjà normalisée. Rend la clé inchangée
// s'il n'y a rien à retirer, ou si l'article EST le nom (« Les Adrets » ne doit
// pas se réduire à « adrets » au point de laisser une chaîne vide).
export function dropArticleFR(clef) {
  const mots = String(clef || '').split(' ')
  if (mots.length > 1 && ARTICLES.has(mots[0])) return mots.slice(1).join(' ')
  return clef
}

// les deux clés sous lesquelles un nom peut être cherché
const clefs = (nom) => {
  const n = normalizeFR(nom)
  return [n, dropArticleFR(n)]
}

// ---------------------------------------------------------------- classement

// À nom également exact, l'entité la plus VASTE gagne : chercher « Bretagne »,
// c'est chercher la région, pas l'un des deux hameaux qui portent ce nom
// (Bretagne dans le Territoire de Belfort, 319 habitants, et dans l'Indre, 125).
// Le résultat suivant reste dans la liste pour qui voulait le hameau.
const RANG_NIVEAU = { region: 0, departement: 1, commune: 2 }

// Le classement maison, et POURQUOI il existe : le `_score` de geo.api.gouv.fr
// favorise les noms courts au point de se retourner sur des cas évidents —
// « Toulon » rend TOULONJAC (755 habitants) devant Toulon (179 000). Mesuré en
// vrai le 2026-07-26, pas supposé.
//
// La règle : correspondance du nom d'abord (exacte, puis début de nom, puis
// fragment), et seulement à égalité la taille de l'entité puis la population.
// Ce qui ne correspond à rien est ÉCARTÉ — l'API ratisse large et rend des
// communes qui n'ont plus rien à voir avec ce qu'on a tapé.
// Pur : aucun réseau, testé unitairement.
export function rankFR(query, candidats) {
  const [qn, qa] = clefs(query)
  if (!qn) return []

  const palier = (nom) => {
    const [cn, ca] = clefs(nom)
    if (cn === qn || ca === qa || cn === qa || ca === qn) return 0
    if (cn.startsWith(qn) || ca.startsWith(qa)) return 1
    if (cn.includes(qn) || ca.includes(qa)) return 2
    return -1
  }

  return (candidats || [])
    .map((c) => ({ c, p: palier(c?.nom) }))
    .filter((e) => e.p >= 0)
    .sort(
      (a, b) =>
        a.p - b.p ||
        (RANG_NIVEAU[a.c.niveau] ?? 9) - (RANG_NIVEAU[b.c.niveau] ?? 9) ||
        (b.c.population ?? 0) - (a.c.population ?? 0) ||
        String(a.c.nom).localeCompare(String(b.c.nom))
    )
    .map((e) => e.c)
}

// ---------------------------------------------------------------- géométrie

// Géométrie GeoJSON → `parts` (voir l'en-tête). Ne rend JAMAIS null : une
// géométrie sans surface (Point, LineString, absente) rend une liste vide, que
// l'appelant traite comme « pas de découpe », exactement comme fetchRegionMask.
export function geometryToParts(geometry) {
  if (!geometry) return []
  const t = geometry.type
  const brut = t === 'Polygon' ? [geometry.coordinates] : t === 'MultiPolygon' ? geometry.coordinates : null
  if (!brut) return []
  // un polygone sans anneau extérieur exploitable ne dessine rien
  return brut.filter((rings) => Array.isArray(rings) && rings[0]?.length >= 3)
}

// ---------------------------------------------------------------- cache
// Un seul cache pour tout le module, indexé par une clé lisible. On y range la
// PROMESSE, pas le résultat, pour que deux appels concurrents ne partent pas
// deux fois sur le réseau ; et on l'évince en cas d'échec pour qu'une nouvelle
// tentative reste possible. Motif repris tel quel de nominatimCache
// (region-mask.js) — c'est le même problème, résolu deux fois sinon.
const cache = new Map()

function memo(key, faire) {
  if (!cache.has(key)) {
    const job = faire()
    cache.set(key, job)
    job.catch(() => cache.delete(key))
  }
  return cache.get(key)
}

// vidange — pour les tests, et pour un éventuel « recharger les données »
export function clearGeoFRCache() {
  cache.clear()
}

// `fetchImpl` est injecté pour que les tests n'aient pas besoin du réseau (et
// pour qu'ils vérifient les URL construites) ; en production c'est le fetch du
// navigateur. `baseUrl` situe les fichiers vendorisés.
async function getJSON(url, fetchImpl) {
  const r = await (fetchImpl || fetch)(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return r.json()
}

// ---------------------------------------------------------------- index vendorisé

// L'index léger (public/geo/fr/index.json) : nom, nom normalisé, code, niveau,
// centre pour les 101 départements et les 18 régions. ~12 Ko, chargé une fois.
// Rejette en cas d'échec — searchFR, lui, sait s'en passer.
export function loadIndexFR({ fetchImpl, baseUrl = BASE } = {}) {
  return memo(`index:${baseUrl}`, () => getJSON(`${baseUrl}index.json`, fetchImpl))
}

// ---------------------------------------------------------------- communes

// Recherche de communes sur l'API. Deux formes du même nom, et c'est voulu :
// `clef` (normalisée) sert de clé de CACHE — « Toulon » et « TOULON » ne
// doivent pas partir deux fois — tandis que `terme` (apiQueryFR) est ce qui
// part vraiment, apostrophes comprises.
// `contour` n'est JAMAIS demandé ici — une recherche ne rapatrie pas de
// polygones, c'est contourFR qui ira chercher celui de l'entité choisie.
function fetchCommunes(clef, terme, fetchImpl) {
  return memo(`communes:${clef}`, async () => {
    const url =
      `${API}/communes?nom=${encodeURIComponent(terme)}` +
      `&fields=nom,code,centre,population&format=json&limit=${COMMUNE_LIMIT}`
    const j = await getJSON(url, fetchImpl)
    return (Array.isArray(j) ? j : []).map((c) => ({
      nom: c.nom,
      code: c.code,
      niveau: 'commune',
      population: c.population,
      centre: c.centre?.coordinates ?? null,
    }))
  })
}

// ---------------------------------------------------------------- recherche

// query → candidats classés `{ nom, code, niveau, population?, centre }`.
// Les départements et régions viennent de l'index embarqué (aucun réseau après
// le premier chargement), les communes de l'API. Les deux listes sont classées
// ENSEMBLE par rankFR, sinon « Bretagne » rendrait un hameau de 319 habitants
// avant la région.
//
// Ne jette jamais : si l'API communes est hors service, on rend quand même les
// départements et régions plutôt que rien du tout.
export async function searchFR(query, { fetchImpl, baseUrl = BASE } = {}) {
  const clef = normalizeFR(query)
  if (!clef) return []
  const [index, communes] = await Promise.all([
    loadIndexFR({ fetchImpl, baseUrl }).catch(() => null),
    fetchCommunes(clef, apiQueryFR(query), fetchImpl).catch(() => []),
  ])
  const admin = (index?.entites || []).map((e) => ({
    nom: e.nom,
    code: e.code,
    niveau: e.niveau,
    centre: e.centre,
  }))
  return rankFR(query, admin.concat(communes))
}

// ---------------------------------------------------------------- contours

// candidat (rendu par searchFR) → `parts`. Commune : requête à l'unité sur
// l'API. Département / région : le fichier vendorisé de CETTE entité, jamais
// le fichier national.
//
// Rend une liste vide sur tout échec, comme fetchRegionMask rend null : sans
// tracé, l'appelant garde son bloc carré — c'est moins grave qu'une exception
// qui remonte au milieu d'un vol de caméra.
export async function contourFR(candidat, { fetchImpl, baseUrl = BASE } = {}) {
  if (!candidat?.code || !candidat?.niveau) return []
  const { niveau, code } = candidat
  try {
    return await memo(`contour:${niveau}:${code}`, async () => {
      if (niveau === 'commune') {
        const j = await getJSON(`${API}/communes/${encodeURIComponent(code)}?fields=contour&format=json`, fetchImpl)
        // l'API rend un OBJET en accès direct, un TABLEAU en recherche —
        // on accepte les deux plutôt que de dépendre de la forme du jour
        const o = Array.isArray(j) ? j[0] : j
        return geometryToParts(o?.contour)
      }
      const nom = niveau === 'region' ? `region-${code}` : `dept-${code}`
      const j = await getJSON(`${baseUrl}${nom}.json`, fetchImpl)
      return geometryToParts(j?.geometry)
    })
  } catch {
    return []
  }
}
