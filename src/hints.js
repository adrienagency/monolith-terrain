// Quelle petite phrase montrer pendant ce chargement-ci — et à quelle
// condition on a le droit de la dire.
//
// Module PUR : ni DOM, ni three.js, ni réseau. Tout ce qui décide (la
// catégorie, la non-répétition, le repli quand le lieu est inconnu) se teste
// en node. L'affichage vit dans ui/loading-hints.js, le stock dans
// hints-data.js — pour ajouter une phrase, c'est là-bas et nulle part ici.
//
// ⚠️ AUCUNE REQUÊTE, JAMAIS. Le chargement est précisément ce qu'on essaie de
// meubler : aller chercher un fait sur le réseau pendant que le réseau est
// occupé à charger le terrain reviendrait à ralentir l'attente pour mieux la
// décorer. Tout ce qui se dit ici est déjà en mémoire — une table curatée, ou
// une mesure faite sur le MNT du bloc.

import { HINTS, LIEUX } from './hints-data.js'

// Le fait de lieu passe devant : c'est le plus fort (Adrien), il parle de
// l'endroit qu'on est en train de regarder. L'appel au partage ferme la
// marche — c'est celui qui fatigue le plus vite à la relecture.
// La roue ne compte QUE les catégories réellement présentes dans le pool :
// sinon un bloc sans fait de lieu perdait un tirage sur trois dans le vide.
export const POIDS = Object.freeze({ lieu: 5, astuce: 3, monde: 2, appel: 1 })

// Combien de phrases on se rappelle avoir montrées. Assez pour qu'un
// rechargement n'affiche pas deux fois la même de suite, assez court pour ne
// pas assécher le stock d'un visiteur qui enchaîne trente cartes.
const MEMOIRE = 5

// ------------------------------------------------------------------ le lieu

const R_TERRE_KM = 6371

// Distance orthodromique en kilomètres. Le rayon des zones se compte en
// dizaines de kilomètres : la formule de haversine est très au-delà du
// nécessaire, mais elle ne coûte rien et évite d'avoir à réfléchir aux
// méridiens ou aux hautes latitudes.
export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Les lignes de la zone curatée qui contient ce point, ou [].
//
// LE REPLI EST LE SILENCE. Hors de toute zone connue on ne rend rien, et le
// tirage retombe sur les astuces. Une phrase géographique approximative
// (« quelque part par ici il y a des montagnes ») serait pire qu'une astuce
// juste : elle apprend à ne plus lire la ligne.
export function phraseDuLieu(lat, lon, lieux = LIEUX) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
  let meilleur = null
  let meilleureD = Infinity
  for (const zone of lieux) {
    const d = distanceKm(lat, lon, zone.lat, zone.lon)
    // deux zones peuvent se recouvrir (une île dans un archipel) : c'est la
    // plus proche du centre du bloc qui parle
    if (d <= zone.rayonKm && d < meilleureD) {
      meilleur = zone
      meilleureD = d
    }
  }
  if (!meilleur) return []
  const cle = meilleur.nom.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return meilleur.lignes.map((text, i) => ({ id: `lieu-${cle}-${i}`, text, cat: 'lieu' }))
}

// ---------------------------------------------------------------- la mesure

// Le MNT est précis à une dizaine de mètres sur un sommet. Annoncer « 4 802 m »
// donnerait au pixel une autorité qu'il n'a pas, et la valeur changerait le
// jour où la source d'altitude change. On arrondit donc — sauf sur les petites
// hauteurs, où la dizaine mangerait toute l'information.
export function arrondiAltitude(m) {
  const v = Math.abs(m)
  return v >= 100 ? Math.round(v / 10) * 10 : Math.round(v)
}

// Un espace insécable étroit entre les milliers : « 4 800 m » ne doit jamais
// se couper en fin de ligne.
function milliers(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// LA VOIE LA MOINS CHÈRE ET LA PLUS RICHE : le bloc qu'on vient de charger
// connaît déjà son altitude maximale (dem.maxM, calculé au décodage des
// tuiles). Aucune requête, et ça marche partout — y compris sur les milliers
// d'endroits qu'aucune table curatée ne couvrira jamais.
//
// Rend null quand il n'y a rien à dire : un bloc plat ne mérite pas une phrase
// sur son relief, et « ce bloc monte à 12 m » n'apprend rien à personne.
export function phraseMesuree(dem) {
  const maxM = dem?.maxM
  const minM = dem?.minM
  if (Number.isFinite(maxM) && maxM >= 300) {
    const a = arrondiAltitude(maxM)
    return { id: `mesure-h${a}`, cat: 'lieu', text: `Le point le plus haut de ce bloc monte à ${milliers(a)} m.` }
  }
  // pas de sommet, mais peut-être un abysse : la bathymétrie est du relief
  if (Number.isFinite(minM) && minM <= -800) {
    const p = arrondiAltitude(minM)
    return { id: `mesure-b${p}`, cat: 'lieu', text: `Sous cette carte, la mer descend à ${milliers(p)} m.` }
  }
  return null
}

// ------------------------------------------------------------------ le pool

// Tout ce qu'on a le droit de dire pour CE chargement-ci.
//
// `dem` est optionnel et surtout : il n'est retenu que s'il décrit bien la
// zone demandée. Pendant un rechargement, main.js a déjà déplacé demLat/demLon
// vers la nouvelle zone alors que `dem` tient encore l'ancienne — annoncer
// l'altitude du bloc précédent serait un mensonge silencieux, le pire genre.
export function poolDePhrases({ lat, lon, dem = null, hints = HINTS, lieux = LIEUX } = {}) {
  const pool = []
  for (const [cat, lignes] of Object.entries(hints)) {
    for (const l of lignes) pool.push({ ...l, cat })
  }
  pool.push(...phraseDuLieu(lat, lon, lieux))
  if (demCorrespond(dem, lat, lon)) {
    const m = phraseMesuree(dem)
    if (m) pool.push(m)
  }
  return pool
}

// Tolérance volontairement serrée : dem.lat/lon sont recopiés des arguments de
// loadDem, donc ils tombent au bit près quand c'est le bon bloc.
function demCorrespond(dem, lat, lon) {
  if (!dem || !Number.isFinite(dem.lat) || !Number.isFinite(dem.lon)) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return true // aucune zone demandée : rien à contredire
  return Math.abs(dem.lat - lat) < 1e-6 && Math.abs(dem.lon - lon) < 1e-6
}

// ---------------------------------------------------------------- le tirage

// On tire la CATÉGORIE d'abord, la phrase ensuite. Tirer directement dans le
// pool laisserait les astuces (vingt lignes) écraser le fait de lieu (une ou
// deux), qui est justement le plus intéressant : le poids d'une catégorie ne
// doit pas dépendre du nombre de phrases qu'elle contient.
export function tirerPhrase({ pool = [], recent = [], rand = Math.random, poids = POIDS } = {}) {
  if (!pool.length) return null
  // On écarte ce qui vient d'être lu. Si ça ne laisse rien, on repart du stock
  // entier : mieux vaut une répétition qu'un chargement muet.
  let frais = pool.filter((l) => !recent.includes(l.id))
  if (!frais.length) frais = pool

  const parCat = new Map()
  for (const l of frais) {
    if (!parCat.has(l.cat)) parCat.set(l.cat, [])
    parCat.get(l.cat).push(l)
  }
  // ordre fixe (celui de `poids`) : sans lui le tirage dépendrait de l'ordre
  // d'insertion et les tests ne prouveraient plus rien
  const cats = Object.keys(poids).filter((c) => parCat.has(c))
  for (const c of parCat.keys()) if (!cats.includes(c)) cats.push(c) // catégorie inconnue : poids 1
  const poidsDe = (c) => poids[c] ?? 1

  const total = cats.reduce((s, c) => s + poidsDe(c), 0)
  let tir = rand() * total
  let choisie = cats[cats.length - 1]
  for (const c of cats) {
    tir -= poidsDe(c)
    if (tir < 0) {
      choisie = c
      break
    }
  }
  const lignes = parCat.get(choisie)
  return lignes[Math.min(lignes.length - 1, Math.floor(rand() * lignes.length))]
}

// Le tireur avec sa mémoire. Un seul par page : c'est lui qui garantit qu'on
// ne relit pas la même phrase deux chargements de suite.
export function creerTireur({ memoire = MEMOIRE, rand = Math.random, hints = HINTS, lieux = LIEUX } = {}) {
  const recent = []
  return {
    recent,
    suivante(ctx = {}) {
      const pool = poolDePhrases({ ...ctx, hints, lieux })
      const ligne = tirerPhrase({ pool, recent, rand })
      if (ligne) {
        recent.push(ligne.id)
        while (recent.length > memoire) recent.shift()
      }
      return ligne
    },
  }
}
