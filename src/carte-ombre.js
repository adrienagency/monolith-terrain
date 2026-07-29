// LA CARTE D'OMBRE NE SE REDESSINE QUE SI QUELQUE CHOSE QUI LA DESSINE A CHANGÉ.
//
// ---------------------------------------------------------------------------
// CE QU'ON PAYAIT, MESURÉ
// ---------------------------------------------------------------------------
// `renderer.shadowMap.autoUpdate = true` (mode d'ombres « dynamic ») redessine
// la carte 2048² À CHAQUE IMAGE. Chronométré le 28/07/2026 en production
// (shibumap.com, La Réunion, tampon 2048×1536, RTX 3080, chrono GPU par
// EXT_disjoint_timer_query_webgl2, minimum sur 6 rafales de 25 rendus) :
//
//   image complète, soleil au zénith .......... 2,10 ms  —  2 520 642 triangles
//   la même, carte d'ombre gelée .............. 1,55 ms  —  1 332 314 triangles
//   ------------------------------------------------------------------------
//   ce que coûtait la carte d'ombre ........... 0,55 ms  —  1 188 328 triangles
//                                               (26 % du temps GPU, 47 % des
//                                                triangles de chaque image)
//
// Et le chiffre est le MÊME de nuit (2,17 → 1,59 ms) : la passe tournait à
// minuit comme à midi.
//
// ---------------------------------------------------------------------------
// POURQUOI C'ÉTAIT DU GASPILLAGE PUR, ET PAS UN ARBITRAGE
// ---------------------------------------------------------------------------
// Redessiner chaque image n'a de sens que si un objet qui PROJETTE une ombre
// bouge. Or ils sont quatre dans toute l'application, et les quatre sont du
// décor immobile : le relief (terrain.js), les murs du socle (plinth.js), les
// murs des dalles voisines (block-grid.js) et la jupe de région
// (region-skirt.js). Les bateaux ont `castShadow = false` explicitement, les
// nuages et les voitures n'en projettent aucune. Entre deux gestes du visiteur,
// la carte d'ombre était donc recalculée à l'identique, soixante fois par
// seconde.
//
// L'image rendue est RIGOUREUSEMENT la même : ce n'est pas une dégradation de
// qualité, c'est une soustraction de travail inutile. Rien à voir dans l'image,
// 26 % de GPU en moins.
//
// ---------------------------------------------------------------------------
// POURQUOI UNE SIGNATURE ET PAS UNE LISTE DE DRAPEAUX
// ---------------------------------------------------------------------------
// Marquer « à refaire » à la main à chaque endroit qui bouge un projeteur, c'est
// la version qui casse : il suffit d'UN endroit oublié (une dalle voisine qui
// arrive, un socle reconstruit) pour qu'une ombre manque à l'écran — et une
// ombre manquante ne se lit pas comme un réglage, elle se lit comme une panne.
// La signature ne peut pas oublier : elle relit l'état réel avant chaque image.
// Son coût est nul (117 objets dans la scène, 2 projeteurs — parcours mesuré
// sous la résolution de performance.now()).
//
// La règle est volontairement PESSIMISTE : dans le doute elle redessine. Un
// faux positif coûte une image de plus ; un faux négatif laisse une ombre
// fausse à l'écran. Ces deux erreurs ne se valent pas.

// arrondi commun — tue le bruit de virgule flottante sans perdre de mouvement
// réel (le soleil vit sur une sphère de rayon 34 : 1e-4 unité est invisible)
const n = (v) => (Number.isFinite(v) ? v.toFixed(4) : 'x')

// La signature de TOUT ce qui dessine la carte d'ombre : la direction du
// soleil, les réglages de la carte, et chaque projeteur VISIBLE (sa géométrie,
// sa version de sommets, sa place dans le monde).
//
// ⚠️ Un projeteur invisible n'entre PAS dans la signature — et c'est ce qui
// fait qu'éteindre un objet redessine la carte : son entrée disparaît, donc la
// signature change, donc son ombre s'en va avec lui.
export function signatureCarteOmbre(etat) {
  if (!etat) return ''
  const s = etat.soleil ?? {}
  const parts = [`s${n(s.x)},${n(s.y)},${n(s.z)}`, `r${etat.res ?? 0}`, `f${n(etat.flou ?? 0)}`]
  const casters = Array.isArray(etat.casters) ? etat.casters : []
  for (const c of casters) {
    if (!c || c.visible === false) continue
    const m = Array.isArray(c.m) || ArrayBuffer.isView(c.m) ? Array.from(c.m, n).join(',') : ''
    parts.push(`${c.id}/${c.geo ?? 0}.${c.pv ?? 0}.${c.count ?? 0}[${m}]`)
  }
  return parts.join('|')
}
