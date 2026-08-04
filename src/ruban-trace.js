// LE RUBAN — le tracé qui SURVOLE le relief.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI PAS Line2 (ce qu'on remplace)
// ═══════════════════════════════════════════════════════════════════════════
// Line2/LineMaterial dessine des rubans d'écran : leur largeur est en PIXELS
// et ils pivotent en permanence pour faire face à la caméra. Vu de dessus ça
// passe ; vu de côté, le tracé se dresse comme un mur, et sa largeur ne veut
// plus rien dire par rapport au terrain. Un tracé de course doit se lire comme
// un objet posé dans le paysage : largeur en MÈTRES, et une épaisseur qui
// survole le sol.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LA SECTION TRANSVERSALE EST HORIZONTALE — c'est LA règle
// ═══════════════════════════════════════════════════════════════════════════
// Une première version faisait chercher au sol sa hauteur À CHAQUE RAIL. Le
// ruban épousait alors le dévers : sur un flanc, le bord amont montait et le
// bord aval descendait, et le résultat se lisait comme une décalcomanie
// écrasée sur le relief. Ce n'est pas ce qu'on veut.
//
// Les 5 rails d'un même point partagent maintenant UNE SEULE altitude. Le
// ruban ne roule donc jamais sur le côté : sa section reste perpendiculaire à
// l'axe de gravité, comme une passerelle. Il ne s'incline QUE dans le sens de
// la marche, pour suivre la montée et la descente — sans quoi ce ne serait
// plus un tracé.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ CE QUI L'EMPÊCHE DE RENTRER DANS LE RELIEF
// ═══════════════════════════════════════════════════════════════════════════
// Une section horizontale au-dessus d'un flanc incliné a un côté qui plonge
// dans la pente. La parade tient en trois temps :
//   1. LE PLANCHER EST LE POINT LE PLUS HAUT SOUS LA LARGEUR. On interroge le
//      sol à chaque rail, et on garde le MAXIMUM. Le bord amont est donc
//      toujours le dernier servi, jamais enterré.
//   2. UN PAS COURT. Entre deux sections le ruban est un plan ; si le terrain
//      remonte au milieu, il passe au travers. Rééchantillonner à pas constant
//      et court rend la corde plus courte que la flèche du relief.
//   3. UNE GARDE, plus une part proportionnelle à la pente. C'est elle qui
//      fait le SURVOL : le ruban flotte visiblement au-dessus du sol au lieu
//      d'y être collé.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE LISSAGE
// ═══════════════════════════════════════════════════════════════════════════
// Un GPX est bruité (dérive GPS en forêt, altitude barométrique en dents de
// scie) et le relief sous lui l'est encore plus. Sans lissage, le ruban
// tressaute latéralement et ondule verticalement à chaque caillou.
//
// On lisse donc deux fois, et jamais de la même manière :
//   • LE CHEMIN (xz) par moyenne glissante : les départs et arrivées sont
//     épinglés, sinon la ligne d'arrivée se déplace.
//   • L'ALTITUDE par DILATATION puis moyenne. La dilatation d'abord, c'est
//     l'astuce : elle pousse le profil vers le HAUT avant de l'adoucir, si
//     bien que la moyenne qui suit ne peut plus le faire replonger dans une
//     bosse qu'elle vient d'aplanir. Une simple moyenne, elle, coupe les
//     sommets — et un sommet coupé, c'est un ruban qui rentre dans la crête.
//
// Module PUR : aucune dépendance à three.js ni au DOM, le sol est injecté.

// ═══════════════════════════════════════════════════════════════════════════
// LE MODELÉ TRANSVERSAL — bord sombre, cœur vif
// ═══════════════════════════════════════════════════════════════════════════
// Ce dégradé ne décrit AUCUNE donnée : c'est un modelé. Le liseré sombre fait
// office d'ombre propre et détache le ruban du relief quel que soit le terrain
// dessous ; le cœur vif donne la ligne de lecture. C'est ce qui le rend
// lisible sur de la neige comme sur de la roche sombre.
//
// ⚠️ LA RÉPARTITION EST CONTINUE, ET C'EST UNE CORRECTION. La première version
// n'avait que 5 rails avec des couleurs écrites à la main : le rail de bord
// valait 0,13/0,09/0,05 (presque noir) et son VOISIN IMMÉDIAT 1/0,85/0,62
// (crème). Du noir au crème en 22 % de la largeur — Adrien l'a vu tout de
// suite, « trop violent sur la répartition ». Les couleurs se calculent
// maintenant par une fonction lisse de la distance au centre, sur assez de
// rails pour que l'interpolation du GPU n'ait plus de marche à franchir.
// ⚠️ L'ESPACEMENT DES RAILS SUIT LA VITESSE DU DÉGRADÉ, pas l'esthétique. Les
// rails sont les seuls points où la couleur est CALCULÉE ; entre deux, le GPU
// interpole en ligne droite. Il en faut donc beaucoup là où la couleur change
// vite, et peu là où elle stagne.
// Ce jeu-ci a été refait en passant au dégradé diffus : l'ancien serrait ses
// rails près du BORD, ce qui convenait quand l'ombre y était confinée. Avec un
// fondu étalé sur toute la largeur, la variation la plus rapide se déplace à
// MI-LARGEUR — et la pire marche était remontée de 34 % à 38 %. Les rails sont
// donc resserrés entre 0,33 et 0,87.
export const PROFIL_RAILS = [-1, -0.87, -0.74, -0.61, -0.48, -0.33, -0.17, 0, 0.17, 0.33, 0.48, 0.61, 0.74, 0.87, 1]

// ⚠️ UNE COULEUR QUI NE SE CONFOND PAS AVEC LA CARTE. L'ancien crème doré se
// noyait littéralement dans les fonds de ShibuMap, qui sont des terres pâles
// (beige, rose, craie, neige). Le vermillon, lui, n'existe dans aucune rampe
// hypsométrique du catalogue, et c'est déjà la langue de l'accent de l'appli
// (cartouches de points de passage, repères kilométriques) : le tracé et ses
// repères parlent enfin la même. Le bleu était pris par l'eau, le brun et
// l'ocre par le relief.
export const COEUR_VERMILLON = [1, 0.42, 0.08]
// Encre FROIDE, pas brune : un liseré brun se lirait comme une ombre du
// terrain, un liseré froid se lit comme un trait dessiné.
export const BORD_ENCRE = [0.07, 0.055, 0.085]

const melange = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
// adoucissement de Hermite : dérivée nulle aux deux bouts, donc aucune arête
// perceptible ni au centre ni au bord
const adoucis = (x) => x * x * (3 - 2 * x)

// ⚠️ PUISSANCE 1 = DÉGRADÉ DIFFUS. Elle décale l'endroit où le sombre commence
// à mordre : au-dessus de 1, le cœur vif tient longtemps et l'ombre se resserre
// en un liseré net sur la marge. C'est ce qu'on avait à 1,7, et Adrien a demandé
// « un dégradé plus diffus ». À 1, l'assombrissement démarre dès l'axe et
// s'étale sur toute la largeur : plus de liseré dessiné, un fondu.
export const DIFFUSION_TEINTES = 1

/**
 * Construit le profil de couleurs, un [r,g,b] par rail.
 */
export function profilDeTeintes(coeur = COEUR_VERMILLON, bord = BORD_ENCRE, rails = PROFIL_RAILS, puissance = DIFFUSION_TEINTES) {
  return rails.map((u) => melange(coeur, bord, adoucis(Math.min(1, Math.abs(u) ** puissance))))
}

// Le profil par défaut.
export const TEINTES_COURSE = profilDeTeintes()

// Décline le même MODELÉ depuis une couleur choisie, pour que le sélecteur de
// couleur du panneau Parcours continue de servir. `teinte` est un [r,g,b] en
// 0..1 : elle devient le CŒUR, et le bord en est une version très assombrie
// (pas un noir absolu, sinon toutes les couleurs finissent par se ressembler).
export function teintesDepuis(teinte, rails = PROFIL_RAILS) {
  const bord = melange(teinte, [0, 0, 0], 0.9)
  return profilDeTeintes(teinte, bord, rails)
}

const dist2D = (a, b) => Math.hypot(b.x - a.x, b.z - a.z)
const fini = (v, repli = 0) => (Number.isFinite(v) ? v : repli)

// Rééchantillonne le tracé à pas CONSTANT dans le plan horizontal. C'est le
// point 2 ci-dessus : un GPX a des points très inégalement espacés (dense en
// virage, très étiré en ligne droite), et ce sont les longues cordes qui
// traversent le relief.
export function reechantillonne(points, pas) {
  if (!points?.length) return []
  if (points.length === 1 || !(pas > 0)) return points.map((p) => ({ ...p }))
  const sortie = [{ ...points[0] }]
  let reste = pas
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const d = dist2D(a, b)
    if (!(d > 0)) continue
    let t0 = 0
    while (reste <= d - t0) {
      t0 += reste
      const t = t0 / d
      sortie.push({ x: a.x + (b.x - a.x) * t, y: (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * t, z: a.z + (b.z - a.z) * t })
      reste = pas
    }
    reste -= d - t0
  }
  const dernier = points[points.length - 1]
  const q = sortie[sortie.length - 1]
  // le dernier point du tracé est l'ARRIVÉE : elle ne se perd pas dans un
  // reste de pas, sinon le ruban s'arrête avant la ligne
  if (dist2D(q, dernier) > pas * 1e-3) sortie.push({ ...dernier })
  return sortie
}

// Moyenne glissante sur un tableau de nombres. `demiFenetre` en ÉCHANTILLONS.
// Les bords sont traités par répétition du premier/dernier terme (clamp) :
// c'est ce qui évite qu'un tracé se recroqueville sur ses extrémités.
export function moyenneGlissante(valeurs, demiFenetre) {
  const n = valeurs.length
  if (n === 0 || !(demiFenetre >= 1)) return Array.from(valeurs)
  const k = Math.min(Math.floor(demiFenetre), n)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = -k; j <= k; j++) s += valeurs[Math.min(n - 1, Math.max(0, i + j))]
    out[i] = s / (2 * k + 1)
  }
  return out
}

// Dilatation : chaque terme prend le MAXIMUM de son voisinage. Appliquée à
// l'altitude du plancher avant la moyenne, elle garantit que l'adoucissement
// qui suit ne redescend pas sous une bosse (voir l'en-tête, « LE LISSAGE »).
export function dilatation(valeurs, demiFenetre) {
  const n = valeurs.length
  if (n === 0 || !(demiFenetre >= 1)) return Array.from(valeurs)
  const k = Math.min(Math.floor(demiFenetre), n)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    let m = -Infinity
    for (let j = -k; j <= k; j++) m = Math.max(m, valeurs[Math.min(n - 1, Math.max(0, i + j))])
    out[i] = m
  }
  return out
}

// Lisse le CHEMIN dans le plan horizontal (et son y indicatif). Départ et
// arrivée sont épinglés : ce sont des lieux réels, pas des points de contrôle.
export function lissePolyligne(points, demiFenetre) {
  const n = points.length
  if (n < 3 || !(demiFenetre >= 1)) return points.map((p) => ({ ...p }))
  const lx = moyenneGlissante(points.map((p) => p.x), demiFenetre)
  const lz = moyenneGlissante(points.map((p) => p.z), demiFenetre)
  const ly = moyenneGlissante(points.map((p) => p.y ?? 0), demiFenetre)
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = { x: lx[i], y: ly[i], z: lz[i] }
  out[0] = { ...points[0] }
  out[n - 1] = { ...points[n - 1] }
  return out
}

// Perpendiculaire HORIZONTALE (dans le plan xz) en chaque point. Horizontale
// et pas normale à la surface : c'est ce qui garde une largeur constante vue
// du ciel, donc une largeur qui se lit en mètres sur la carte.
export function perpendiculaires(points) {
  const n = points.length
  if (n === 0) return []
  if (n === 1) return [{ x: 1, z: 0 }]
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(n - 1, i + 1)]
    let dx = b.x - a.x
    let dz = b.z - a.z
    const l = Math.hypot(dx, dz)
    if (l > 1e-9) { dx /= l; dz /= l } else { dx = 1; dz = 0 }
    // rotation de 90° dans le plan horizontal
    out[i] = { x: -dz, z: dx }
  }
  return out
}

// Hauteur de survol au-dessus du plancher. `garde` partout, plus une part
// proportionnelle à la pente, plafonnée : en forte pente la corde entre deux
// sections mord davantage, il faut donc voler un peu plus haut.
export function relevement(penteAbs, { garde = 0.05, parPente = 0.35, plafond = 0.5 } = {}) {
  const p = Number.isFinite(penteAbs) ? Math.abs(penteAbs) : 0
  return garde + Math.min(plafond, p * parPente)
}

// Pente locale (sans dimension : dy/dxz) autour du point i.
export function penteLocale(points, i) {
  const n = points.length
  if (n < 2) return 0
  const a = points[Math.max(0, i - 1)]
  const b = points[Math.min(n - 1, i + 1)]
  const d = dist2D(a, b)
  if (!(d > 0)) return 0
  return ((b.y ?? 0) - (a.y ?? 0)) / d
}

/**
 * Le PLANCHER : sous chaque section, le point de sol le plus haut rencontré
 * sur toute la largeur du ruban, majoré du survol. C'est le point 1 de
 * l'en-tête — sans ce maximum, une section horizontale posée sur un flanc
 * aurait toujours un bord enterré.
 */
export function plancherDuRuban(pts, perp, {
  sol,
  demiLargeur = 0.16,
  rails = PROFIL_RAILS,
  garde = 0.05,
  parPente = 0.35,
  plafond = 0.5,
} = {}) {
  const n = pts.length
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const nv = perp[i]
    let haut = -Infinity
    for (let r = 0; r < rails.length; r++) {
      const x = p.x + nv.x * demiLargeur * rails[r]
      const z = p.z + nv.z * demiLargeur * rails[r]
      haut = Math.max(haut, fini(sol ? sol(x, z) : (p.y ?? 0)))
    }
    if (!Number.isFinite(haut)) haut = 0
    out[i] = haut + relevement(penteLocale(pts, i), { garde, parPente, plafond })
  }
  return out
}

/**
 * Construit la géométrie du ruban.
 *
 * @param points          tracé en coordonnées monde [{x,y,z}]
 * @param sol             (x,z) => hauteur du terrain. C'est LUI qui décide de
 *                        l'altitude du ruban : le y des points d'entrée ne
 *                        sert qu'à estimer la pente.
 * @param demiLargeur     demi-largeur du ruban, en unités monde
 * @param pas             pas de rééchantillonnage, en unités monde
 * @param garde           survol minimal au-dessus du sol, en unités monde
 * @param lissageChemin   longueur de lissage du chemin xz, en unités monde
 * @param lissageAltitude longueur de lissage de l'altitude, en unités monde
 * @param teintes         5 couleurs [r,g,b], du bord gauche au bord droit
 *
 * Rend des tableaux plats prêts pour des BufferAttribute, plus `distances`
 * (0..1, la position le long du tracé) qui sert au dévoilement continu :
 * comparer un attribut à un uniforme se fait par FRAGMENT, donc sans le
 * moindre cran — contrairement à un setDrawRange qui ne coupe qu'aux sommets.
 */
export function construitRuban(points, {
  sol,
  demiLargeur = 0.16,
  pas = 0.25,
  teintes = TEINTES_COURSE,
  rails = PROFIL_RAILS,
  garde = 0.05,
  parPente = 0.35,
  plafond = 0.5,
  lissageChemin = 0.5,
  lissageAltitude = 1.2,
  dilatationLongueur = 0.4,
  altitudesImposees = null,
} = {}) {
  const vide = {
    positions: [], couleurs: [], indices: [], distances: [], transverses: [],
    altitudes: [], longueur: 0, nbPoints: 0,
  }
  if (!points?.length || points.length < 2) return vide

  const brut = reechantillonne(points, pas)
  if (brut.length < 2) return vide
  // le lissage se compte en unités MONDE et se convertit en échantillons : un
  // même réglage donne donc le même adoucissement quel que soit le pas
  const enEchantillons = (longueur) => (pas > 0 ? Math.round(longueur / pas) : 0)
  const pts = lissePolyligne(brut, enEchantillons(lissageChemin))
  const perp = perpendiculaires(pts)
  const nr = rails.length

  // ── altitude : plancher, dilatation, moyenne, puis garde REMISE ──────────
  // le dernier max n'est pas une ceinture de sécurité décorative : le lissage
  // travaille sur une fenêtre finie, un pic plus large qu'elle passerait
  // encore au travers. Ici, c'est impossible par construction.
  // ⚠️ LES DEUX FENÊTRES NE SONT PAS LA MÊME, et c'est délibéré. Dilater sur
  // la longueur de lissage ferait voler le ruban au niveau du point le plus
  // haut rencontré à ±1,5 unité : dans une descente il décollerait franchement
  // du versant. Une dilatation COURTE se contente de protéger les bosses
  // locales — sur une pente régulière elle ne fait qu'ajouter un décalage
  // constant, et la moyenne longue derrière suit alors le versant exactement.
  //
  // ⚠️ `altitudesImposees` EXISTE POUR LE SILLAGE. Le halo de vitesse est un
  // second ruban, bien plus large, construit sur le même axe. S'il calculait
  // son propre plancher, il le prendrait sur une bande plus large, donc plus
  // haut : sur un versant, la lueur décollerait du tracé qu'elle est censée
  // envelopper. En lui imposant les altitudes du ruban, les deux sont soudés
  // par construction — et les bords du halo qui rentrent dans la pente sont
  // simplement masqués par le test de profondeur, ce qui se lit comme une
  // vraie lumière avalée par le relief.
  let altitudes
  if (altitudesImposees?.length === pts.length) {
    altitudes = altitudesImposees
  } else {
    const plancher = plancherDuRuban(pts, perp, { sol, demiLargeur, rails, garde, parPente, plafond })
    const adouci = moyenneGlissante(
      dilatation(plancher, enEchantillons(dilatationLongueur)),
      enEchantillons(lissageAltitude),
    )
    altitudes = new Array(pts.length)
    for (let i = 0; i < pts.length; i++) altitudes[i] = Math.max(fini(adouci[i]), plancher[i])
  }

  // distance cumulée, normalisée à la fin — le dévoilement s'exprime en
  // fraction de tracé, pas en index de sommet
  const cumul = new Array(pts.length)
  cumul[0] = 0
  for (let i = 1; i < pts.length; i++) cumul[i] = cumul[i - 1] + dist2D(pts[i - 1], pts[i])
  const longueur = cumul[cumul.length - 1] || 1

  const positions = []
  const couleurs = []
  const distances = []
  const transverses = []
  const indices = []

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const n = perp[i]
    // ⚠️ UNE SEULE ALTITUDE POUR TOUS LES RAILS. C'est ça qui garde la section
    // perpendiculaire à la gravité, et qui distingue un ruban qui survole
    // d'une décalcomanie qui épouse le dévers.
    const y = fini(altitudes[i])
    const d = cumul[i] / longueur
    for (let r = 0; r < nr; r++) {
      positions.push(p.x + n.x * demiLargeur * rails[r], y, p.z + n.z * demiLargeur * rails[r])
      const t = teintes[r] || teintes[teintes.length - 1]
      couleurs.push(t[0], t[1], t[2])
      distances.push(d)
      // la position EN TRAVERS, -1 au bord gauche, +1 au bord droit : c'est ce
      // que le shader du sillage lit pour concentrer sa lumière sur l'axe
      transverses.push(rails[r])
    }
    if (i) {
      const q = (i - 1) * nr
      for (let r = 0; r < nr - 1; r++) {
        indices.push(q + r, q + r + 1, q + r + nr)
        indices.push(q + r + 1, q + r + nr + 1, q + r + nr)
      }
    }
  }

  return { positions, couleurs, indices, distances, transverses, altitudes, longueur, nbPoints: pts.length }
}

/**
 * LE NEZ ARRONDI — de combien la coupe de tête RECULE, à la position
 * transversale `u` (−1 au bord gauche, +1 au bord droit).
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE. Le dévoilement compare la distance le
 * long du tracé à un uniforme, et cette distance est la MÊME sur toute la
 * largeur d'une section (les rails partagent leur abscisse). La coupe tombait
 * donc perpendiculairement au tracé : un couperet bien droit, que la moindre
 * capture d'écran trahissait. En reculant la coupe sur les bords selon
 * `1 − √(1 − u²)`, le contour devient un demi-cercle exact de rayon égal à la
 * demi-largeur — le tracé se termine en pointe ronde, comme un trait de pinceau.
 *
 * Le rayon s'exprime dans la MÊME unité que la distance comparée (fraction de
 * tracé), d'où le passage par fractionDeTraine au câblage.
 *
 * Le shader en est la transcription littérale, en une ligne — c'est ici que la
 * géométrie est décrite et vérifiée.
 */
export function retraitDuNez(u, rayon) {
  const a = Math.min(1, Math.abs(fini(u)))
  return fini(rayon) * (1 - Math.sqrt(1 - a * a))
}

// Convertit une longueur de traîne exprimée en unités MONDE (« le sillage dure
// quelques dizaines de mètres ») en fraction du tracé, la seule unité que le
// shader manipule puisque `aDist` est normalisé. Un tracé de 150 km et un de
// 5 km n'ont donc pas la même traîne relative — et c'est voulu : la traîne est
// une longueur physique, pas une proportion de la course.
export function fractionDeTraine(traineMonde, longueur) {
  if (!(longueur > 0) || !(traineMonde > 0)) return 0
  return Math.min(1, traineMonde / longueur)
}
