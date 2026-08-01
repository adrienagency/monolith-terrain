// Flotte — le MODÈLE des bateaux qui naviguent sur la mer du bloc. Pur et sans
// DOM : le rendu, le chargement du modèle et le shader vivent dans boats.js,
// ici il n'y a que des positions, des caps et des opacités.
//
// RÈGLE GÉNÉRALE DES ÉLÉMENTS 3D RAPPORTÉS (Adrien), appliquée ici et à tout
// ce qui suivra :
//   · invisibles en dessous de MIN_ZOOM — à l'échelle continentale, un bateau
//     de 50 m n'a aucun sens
//   · plus on zoome, plus il y en a : la densité suit l'échelle
//   · leur taille est exagérée pour rester lisible, mais reste ancrée sur une
//     taille réelle plausible
//
// Le bateau peut QUITTER la carte : il s'efface en approchant du bord, puis
// son calcul s'arrête (état `dormant`). Une place libérée peut resservir.

// en dessous, aucun élément 3D rapporté
export const MIN_ZOOM = 11

// « Une chance sur dix de les voir à l'écran » (Adrien) : c'est la probabilité
// qu'il y ait AU MOINS UN bateau, pas celle qu'une place donnée soit occupée.
// La nuance compte — avec six places tirées chacune à 1/10, on en verrait
// pratiquement toujours (1 − 0,9⁶ = 47 %). On inverse donc la formule : la
// probabilité qu'AUCUNE place ne sorte doit valoir 0,9.
export const SEE_CHANCE = 0.1
// UN SEUL bateau par bloc, et du même type (Adrien). La règle de densité
// croissante vaut toujours pour les éléments 3D en général — elle vit dans
// slotsForZoom, qui prend son nombre de places en paramètre — mais deux vapeurs
// identiques dans le même cadre font décor de jeu vidéo. Un seul se lit comme
// un événement, ce qui est tout l'intérêt du 1 sur 10.
export const FLEET_SLOTS = 1

// probabilité par place pour que P(au moins un) vaille SEE_CHANCE
export function slotChance(slots = FLEET_SLOTS, seeChance = SEE_CHANCE) {
  if (!(slots > 0)) return 0
  return 1 - Math.pow(1 - seeChance, 1 / slots)
}

// Longueur de coque en mètres — un vapeur côtier. Exagérée au rendu (voir
// boatScale) pour rester visible, mais c'est bien la référence.
export const HULL_M = 55

// Le bateau s'efface sur cette fraction du demi-bloc avant le bord, puis dort.
const FADE_BAND = 0.12

// vitesse de croisière, en fraction du demi-bloc par seconde
const SPEED = 0.012

// Un onglet en arrière-plan rend un dt énorme au retour : sans plafond, toute
// la flotte traverserait la carte d'un coup au premier réveil.
const DT_MAX = 0.1

// ------------------------------------------------------- évitement des terres
// « Les bateaux ne rentrent jamais en collision avec la terre » (Adrien).
// Semer sur l'eau ne suffisait pas : le bateau AVANCE, et rien dans le pas ne
// regardait devant lui — il finissait dans la falaise, ou pire, il la
// traversait, puisque le rendu n'a aucune notion de sol.

// Distance de veille, en fraction du demi-bloc. Assez loin pour laisser le
// temps de tourner à la vitesse de giration ci-dessous, assez près pour ne pas
// interdire l'entrée d'une baie — c'est un compromis, pas une constante
// physique : à 0,10 le bateau refuse les golfes, à 0,02 il touche avant d'avoir
// fini son virage.
const LOOKAHEAD = 0.05

// Giration maximale, en radians par seconde. Un bateau qui pivote d'un coup
// vers le cap libre se voit immédiatement ; celui-ci met ~2,6 s pour un
// demi-tour, ce qui se lit comme une manœuvre.
const TURN_RATE = 1.2

// Caps essayés de part et d'autre quand la route est barrée, du plus faible
// écart au plus fort : on préfère toujours l'inflexion la plus douce.
const SCAN = [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.1, -2.1, 2.6, -2.6, Math.PI]

// Combien de points on teste le long de la veille. Un seul point à l'arrivée
// laisserait sauter par-dessus une langue de terre étroite quand dt est grand.
const LOOKAHEAD_STEPS = 4

// La route est-elle dégagée sur toute la veille ? On échantillonne le SEGMENT,
// pas seulement son extrémité.
function routeLibre(x, z, cap, dist, isSea) {
  const dx = Math.sin(cap)
  const dz = Math.cos(cap)
  for (let i = 1; i <= LOOKAHEAD_STEPS; i++) {
    const t = (dist * i) / LOOKAHEAD_STEPS
    if (!isSea(x + dx * t, z + dz * t)) return false
  }
  return true
}

// Combien de positions on tire avant de renoncer à peupler le bloc. Avec une
// seule place, perdre le tirage sur un pixel de terre viderait la mer entière :
// mesuré sur un chenal étroit, passer d'un seul essai à trente-deux fait monter
// le taux de blocs peuplés de 12 % à 90 %.
// (Le message de 636e2f4 annonce 40 % : c'était le taux de l'ancien semis à SIX
// places, pas celui d'un seul essai — ce commit changeait les deux à la fois.)
const SEED_TRIES = 32

// Échelle de rendu : la coque garde sa taille RÉELLE rapportée à l'emprise du
// bloc, puis on l'exagère d'un facteur constant pour qu'elle reste lisible de
// loin. À zoom fin le bloc couvre peu de terrain, donc le bateau y occupe
// naturellement plus de place — c'est la « taille logique » voulue.
// ×10 : une coque de 55 m dans un bloc de 27 km fait 0,2 % de sa largeur —
// à peine trois pixels à l'écran. L'exagération est ASSUMÉE (Adrien : « leur
// échelle peut être exagérée pour qu'ils restent visibles »), mais elle reste
// ancrée sur une taille réelle, donc le bateau grandit quand on zoome.
export function boatScale(terrainSize, extentMeters, exaggeration = 10) {
  if (!(extentMeters > 0) || !(terrainSize > 0)) return 0
  return (HULL_M / extentMeters) * terrainSize * exaggeration
}

// Combien de PLACES existent à ce zoom (occupées ou non). Plus on zoome, plus
// la mer est proche, plus on peut en croiser — la densité suit l'échelle.
export function slotsForZoom(zoom, slots = FLEET_SLOTS) {
  if (!(zoom >= MIN_ZOOM)) return 0
  return Math.max(1, Math.min(slots, Math.round(slots * Math.min(1, (zoom - MIN_ZOOM + 1) / 4))))
}

// Tirage reproductible : deux blocs identiques donnent la même flotte.
//
// La graine est BROUILLÉE avant usage. Un xorshift amorcé par de petits
// entiers consécutifs sort des premiers tirages corrélés : mesuré, le taux
// d'apparition montait à 0,149 au lieu des 0,10 demandés — les blocs voisins
// « décidaient » ensemble. Le mélange type SplitMix64 casse cette parenté.
function rng(seed) {
  let s = (seed >>> 0) || 1
  s = Math.imul(s ^ (s >>> 16), 2246822507) >>> 0
  s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0
  s = (s ^ (s >>> 16)) >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

// Sème une flotte sur le bloc. `isSea(x, z)` dit si un point est navigable —
// sans lui, les bateaux traverseraient les montagnes.
//
// `force` remplit toutes les places sans tirage : c'est ce qui permet de VOIR
// la flotte pour la régler, sans relancer trente fois en attendant le 1/10.
// ══════════ L'EMPRISE 3×3 : NEUF FOIS LA MER, NEUF FOIS LES PLACES ═════════
//
// `cote` est le côté de l'emprise (1 sur un bloc ordinaire, 3 en mode continu).
// Deux nombres en découlent, et ils ne se traitent PAS pareil :
//
//  · LE NOMBRE DE PLACES suit la SURFACE, donc le carré du côté — même règle
//    que `maxN` des noms de lieux. Une seule place sur neuf fois la mer, c'est
//    huit chances sur neuf que le bateau soit hors de la fenêtre : la mer
//    paraîtrait vide alors qu'elle est peuplée.
//  · LA CHANCE PAR PLACE reste celle d'UN BLOC. `slotChance(n)` répond « quelle
//    probabilité par place pour que P(au moins un parmi n) vaille 0,1 » : la
//    calculer sur les neuf places ferait tomber la probabilité d'en voir un
//    DANS LA FENÊTRE de 1 sur 10 à 1 sur 90. « Une chance sur dix » parle de ce
//    qu'on voit, pas de ce que le champ contient.
export function seedFleet({ zoom, half, seed = 1, isSea = null, slots = FLEET_SLOTS, force = false, cote = 1 } = {}) {
  const parBloc = slotsForZoom(zoom, slots)
  if (!parBloc) return []
  const c = cote > 1 ? Math.round(cote) : 1
  const n = parBloc * c * c
  const rand = rng(seed)
  const p = slotChance(parBloc)
  const boats = []
  for (let i = 0; i < n; i++) {
    // Le tirage est consommé MÊME pour une place vide, et avant les positions :
    // changer SEE_CHANCE ne doit pas décaler toute la flotte, sinon régler la
    // rareté rebattrait aussi les emplacements.
    const occupe = rand() < p || force
    // On REPREND le tirage tant qu'on tombe à terre au lieu d'abandonner la
    // place : avec une seule place par bloc, un tirage malheureux ne doit pas
    // vider une mer parfaitement navigable.
    let x = 0
    let z = 0
    let flotte = false
    for (let essai = 0; essai < SEED_TRIES; essai++) {
      x = (rand() * 2 - 1) * half * 0.85
      z = (rand() * 2 - 1) * half * 0.85
      if (!isSea || isSea(x, z)) { flotte = true; break }
    }
    const cap = rand() * Math.PI * 2
    if (!occupe || !flotte) continue
    boats.push({ x, z, cap, opacite: 0, dormant: false })
  }
  return boats
}

// Fait avancer un bateau d'un pas. Retourne un NOUVEL état (pur) :
//   · il avance selon son cap
//   · il s'efface en approchant du bord (opacite → 0)
//   · passé le bord, il dort : plus aucun calcul, plus aucun rendu
//   · il évite la terre : route barrée, il infléchit sa route ; cerné, il dort
// ══════════ TROIS LONGUEURS, ET IL FAUT LES TROIS ══════════════════════════
//
// `half`  — le demi-BLOC (28). C'est l'échelle du bateau : `SPEED` et
//           `LOOKAHEAD` sont des fractions de cette longueur.
//           ⚠️ LUI PASSER 84 (ce que l'étude proposait) AURAIT TRIPLÉ LA VITESSE
//           AU SOL et la portée de la veille, sans que rien ne le signale.
// `bord`  — où l'eau s'arrête pour de bon : le demi-bloc hors mode continu, le
//           demi-emprise (84) dedans. Passé ce bord, le bateau DORT.
// `fenX/fenZ` — le centre de la fenêtre. Le FONDU se mesure à elle : hors socle
//           le bateau s'efface (il n'y a plus de mer sous lui), et il se
//           rallume quand on défile jusqu'à lui. C'est ce qui fait qu'on le
//           RETROUVE au lieu de le perdre.
//
// Hors mode continu, `bord` = `half` et la fenêtre est en (0,0) : les trois
// longueurs se confondent et le pas est exactement celui d'avant.
export function stepBoat(b, dt, half, isSea = null, { bord = half, fenX = 0, fenZ = 0 } = {}) {
  if (!b || b.dormant) return b
  const d = Math.min(Math.max(dt, 0), DT_MAX)
  if (!(d > 0)) return b
  const v = SPEED * half

  let cap = b.cap
  if (isSea) {
    const veille = LOOKAHEAD * half
    if (!routeLibre(b.x, b.z, cap, veille, isSea)) {
      const ecart = SCAN.find((a) => routeLibre(b.x, b.z, cap + a, veille, isSea))
      // Aucune issue : mer qui se retire, relief rechargé plus fin, bateau
      // cerné. Il s'endort — sinon il tournerait sur lui-même à jamais, et le
      // rendu ne pourrait jamais se taire.
      if (ecart === undefined) return { ...b, opacite: 0, dormant: true }
      // Virage PROGRESSIF : pivoter d'un coup vers le cap libre se verrait.
      cap += Math.sign(ecart) * Math.min(Math.abs(ecart), TURN_RATE * d)
      // Tant que la route n'est pas dégagée, on ne fait que tourner : c'est ce
      // qui garantit qu'aucun pas ne peut déposer la coque sur la terre.
      if (!routeLibre(b.x, b.z, cap, veille, isSea)) return { ...b, cap }
    }
  }

  const x = b.x + Math.sin(cap) * v * d
  const z = b.z + Math.cos(cap) * v * d

  // MORT : passé le bord de l'eau (le bloc, ou l'emprise en mode continu).
  if (Math.max(Math.abs(x), Math.abs(z)) >= bord) return { ...b, x, z, cap, opacite: 0, dormant: true }

  // FONDU : mesuré à la FENÊTRE, pas au champ. Distance au bord du socle
  // affiché, en fraction du demi-bloc — négative dès qu'on en est sorti.
  const marge = (half - Math.max(Math.abs(x - fenX), Math.abs(z - fenZ))) / half

  // fondu : plein à l'intérieur, éteint au bord. L'apparition suit la même
  // rampe, donc un bateau semé près du bord entre en fondu au lieu de surgir.
  const cible = Math.max(0, Math.min(1, marge / FADE_BAND))
  const k = 1 - Math.exp(-2.5 * d) // lissage, pour que le fondu ne saute pas
  const opacite = b.opacite + (cible - b.opacite) * Math.max(k, 0)
  return { ...b, x, z, cap, opacite, dormant: false }
}

// Toute la flotte est-elle endormie ? Le rendu peut alors se taire entièrement.
export function fleetAsleep(boats) {
  return !boats?.length || boats.every((b) => b.dormant)
}
