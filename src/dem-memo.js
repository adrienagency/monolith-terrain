// MÉMOIRE DES BLOCS D'ALTITUDE — le MNT fusionné+lissé et son analyse de relief,
// gardés pour le RETOUR de zoom.
//
// LE CONSTAT, mesuré en navigateur à La Réunion (Chrome piloté, MNT 1536²,
// séquence z13→z14→z13) : revenir à un zoom déjà vu ne télécharge presque rien
// (20 ms de réseau, tout est dans le cache HTTP) mais REFAIT tout le calcul.
// Deux passes dominent, et ni l'une ni l'autre ne dépend de quoi que ce soit
// d'autre que du bloc de tuiles :
//
//   · la fabrication du MNT      145 ms de fil principal figé
//     (décodage terrarium 36 · fusion bathy 8 · lissage du fond marin 73 ·
//      statistiques après fusion 21), + les 20 ms de réseau ci-dessus
//   · l'analyse de relief        464 ms de travailleur (analyzeDem, ~10 flous)
//
// 609 ms recalculés à l'identique, à chaque aller-retour de zoom. D'où ce
// module : une mémoire à deux entrées, commune aux deux (l'analyse est rangée
// SOUS le MNT dont elle est issue, voir plus bas).
//
// ⚠️ LA CLÉ PORTE TOUT CE DONT LE BLOC DÉPEND, et rien de moins. Un cache
// d'altitudes qui servirait une donnée périmée ne planterait pas : il peindrait
// une carte fausse, en silence, et personne ne saurait la diagnostiquer. Sont
// donc dans la clé (voir `demMemoCle`) :
//   source.id     bascule Mapterhorn → AWS en cours de session (dem-source.js),
//                 et repli AWS d'une zone non couverte : ce ne sont PAS les
//                 mêmes altitudes.
//   maxZoom       le zoom max servi ICI décide du surzoom (overzoomTile) : le
//                 même bloc lu à z14 depuis un ancêtre z12 ou depuis du natif
//                 z14 n'a pas le même relief.
//   zoom, ox, oy  le bloc de tuiles lui-même (origine du damier de tuiles).
//   tilesAcross, tilePx   la forme du canevas peint.
//   lat, lon      les métadonnées géo RENDUES avec le bloc. Deux clics dans la
//                 même tuile donnent le même relief mais pas le même centre :
//                 servir l'ancien recentrerait la carte au mauvais endroit.
//   bathy         `bathy: false` rend un MNT SANS mer creusée (block-grid).
// Ne sont PAS dans la clé, parce que le MNT n'en dépend pas : l'exagération, la
// résolution du maillage, la palette, le mode isolé (masque de découpe, qui est
// un clip appliqué APRÈS), le palier machine.
//
// ⚠️ L'ANALYSE EST RANGÉE SOUS SON MNT, pas dans une seconde mémoire à clé
// parallèle. Deux mémoires indépendantes finissent par se désynchroniser : la
// première évincée, la seconde non, et l'analyse d'hier se pose sur un MNT
// re-téléchargé qui a pu changer (une tuile bathy absente au premier passage,
// une dalle réparée sur AWS). Rangée sous l'objet MNT, une analyse ne peut
// JAMAIS être servie à côté d'autres altitudes que celles qui l'ont produite.
// Elle garde en revanche sa propre sous-clé : `analysisMax`, le plafond de
// taille que le palier machine change (palier-machine.js sert 0, 1024 ou 768) —
// une analyse cuite à 768 ne doit pas être servie à un palier qui en veut 1536.
//
// ⚠️ LES TABLEAUX SONT PARTAGÉS, EN LECTURE SEULE — même règle qu'à
// grid-template.js. `dem.data` est lu par le sampler, le tracé de la jupe et la
// veille des bateaux, et RECOPIÉ (jamais transféré) vers le travailleur ; le
// `rgba` de l'analyse est branché tel quel dans une DataTexture, que personne
// n'écrit. Si un jour du code se met à écrire dans l'un des deux, il faudra
// copier — et le bug se verrait sur tous les blocs à la fois.
//
// ─────────────────────────────── LA FACTURE ─────────────────────────────────
// Par entrée, sur le MNT de production (1536², Mapterhorn en tuiles 512 px) :
//   MNT Float32 1536²                        9,4 Mo
//   analyse RGBA, selon le palier machine    9,4 Mo (analysisMax 0 → 1536²)
//                                            4,2 Mo (1024²) · 2,4 Mo (768²)
// Soit à DEUX entrées : 18,9 Mo au minimum, 37,7 Mo au pire (machine haute, qui
// analyse à pleine taille) — et 23,6 Mo sur un iMac 2015, dont le palier
// plafonne l'analyse à 768². À comparer au pic du damier plein, 1 762 Mo
// (test/damier-memoire.test.js) : 2,1 % au pire. C'est le rapport qui rend la
// mémoire défendable, pas la valeur absolue.
//
// ⚠️ DEUX ENTRÉES, ET C'EST UN CHOIX, pas un défaut. Un aller-retour de zoom
// n'en met en jeu que deux (le zoom de départ et celui d'arrivée) : c'est le
// geste qu'on optimise, et la troisième entrée ne servirait qu'à un
// aller-retour à trois étages en coûtant +18,9 Mo. La borne est aussi ce qui
// permet à l'étude « fenêtre continue 3×3 » de compter sur un chiffre FIXE.
//
// ⚠️ ET LE DAMIER N'ENTRE PAS ICI. block-grid.js tient déjà sa propre mémoire
// de MNT voisins, bornée à 32 Mo (DEM_CACHE_BYTES) : ses 8 à 24 dalles
// chasseraient le bloc central de cette mémoire-ci à chaque extension, et leurs
// MNT seraient comptés DEUX FOIS. D'où l'entrée sur demande — `loadDem` ne
// mémorise que si on le lui demande (`memo: true`), et seul le bloc central le
// demande.

/** Nombre d'entrées gardées. Voir la facture ci-dessus avant de le changer. */
export const DEM_MEMO_MAX = 2

const cache = new Map() // clé → entrée, en ordre d'insertion (LRU simple)
const parDem = new WeakMap() // MNT → son entrée, pour ranger l'analyse à l'arrivée

// entrée = { cle, dem, analyses: Map<analysisMax, {rgba, size}> }

/**
 * La clé d'un bloc d'altitude. Tous les champs comptent — voir l'avertissement
 * en tête de module avant d'en retirer un.
 */
export function demMemoCle({ source, zoom, maxZoom, ox, oy, tilesAcross, tilePx, lat, lon, bathy }) {
  return `${source}|${zoom}|${maxZoom}|${ox},${oy}|${tilesAcross}x${tilePx}|${lat},${lon}|${bathy ? 1 : 0}`
}

/** Le MNT mémorisé pour cette clé, ou `null`. Un succès remonte l'entrée en tête. */
export function demMemoLire(cle) {
  const e = cache.get(cle)
  if (!e) return null
  cache.delete(cle)
  cache.set(cle, e) // ré-insertion = le plus récemment servi
  return e.dem
}

/** Mémorise ce MNT sous cette clé, et le rend tel quel (pour `return demMemoEcrire(...)`). */
export function demMemoEcrire(cle, dem) {
  const e = { cle, dem, analyses: new Map() }
  cache.delete(cle)
  cache.set(cle, e)
  parDem.set(dem, e)
  while (cache.size > DEM_MEMO_MAX) {
    const vieux = cache.keys().next().value
    // ⚠️ on lâche AUSSI l'index inverse : sans ça, l'analyse d'un MNT évincé
    // resterait joignable et repousserait dans une entrée fantôme.
    parDem.delete(cache.get(vieux).dem)
    cache.delete(vieux)
  }
  return dem
}

/** L'analyse mémorisée pour ce MNT à ce plafond, ou `null`. */
export function analyseMemoLire(dem, analysisMax) {
  return parDem.get(dem)?.analyses.get(analysisMax | 0) ?? null
}

/**
 * Range une analyse SOUS son MNT. Sans effet si le MNT n'est pas mémorisé —
 * c'est ce qui tient la facture : les dalles du damier ne paient rien ici.
 */
export function analyseMemoEcrire(dem, analysisMax, rgba, size) {
  const e = parDem.get(dem)
  if (!e || !rgba) return
  e.analyses.set(analysisMax | 0, { rgba, size })
}

/** Octets retenus par la mémoire — comptabilité (test/damier-memoire.test.js). */
export function demMemoOctets() {
  let o = 0
  for (const e of cache.values()) {
    o += e.dem?.data?.byteLength ?? 0
    for (const a of e.analyses.values()) o += a.rgba?.byteLength ?? 0
  }
  return o
}

/** Vide la mémoire — tests uniquement. */
export function demMemoVider() {
  cache.clear()
}
