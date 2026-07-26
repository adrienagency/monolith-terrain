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
export const FLEET_SLOTS = 6

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

// Échelle de rendu : la coque garde sa taille RÉELLE rapportée à l'emprise du
// bloc, puis on l'exagère d'un facteur constant pour qu'elle reste lisible de
// loin. À zoom fin le bloc couvre peu de terrain, donc le bateau y occupe
// naturellement plus de place — c'est la « taille logique » voulue.
export function boatScale(terrainSize, extentMeters, exaggeration = 3.2) {
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
export function seedFleet({ zoom, half, seed = 1, isSea = null, slots = FLEET_SLOTS, force = false } = {}) {
  const n = slotsForZoom(zoom, slots)
  if (!n) return []
  const rand = rng(seed)
  const p = slotChance(n)
  const boats = []
  for (let i = 0; i < n; i++) {
    // Le tirage est consommé MÊME pour une place vide, et avant les positions :
    // changer SEE_CHANCE ne doit pas décaler toute la flotte, sinon régler la
    // rareté rebattrait aussi les emplacements.
    const occupe = rand() < p || force
    const x = (rand() * 2 - 1) * half * 0.85
    const z = (rand() * 2 - 1) * half * 0.85
    const cap = rand() * Math.PI * 2
    if (!occupe) continue
    if (isSea && !isSea(x, z)) continue
    boats.push({ x, z, cap, opacite: 0, dormant: false })
  }
  return boats
}

// Fait avancer un bateau d'un pas. Retourne un NOUVEL état (pur) :
//   · il avance selon son cap
//   · il s'efface en approchant du bord (opacite → 0)
//   · passé le bord, il dort : plus aucun calcul, plus aucun rendu
export function stepBoat(b, dt, half) {
  if (!b || b.dormant) return b
  const d = Math.min(Math.max(dt, 0), DT_MAX)
  if (!(d > 0)) return b
  const v = SPEED * half
  const x = b.x + Math.sin(b.cap) * v * d
  const z = b.z + Math.cos(b.cap) * v * d

  // distance au bord la plus courte, en fraction du demi-bloc
  const marge = (half - Math.max(Math.abs(x), Math.abs(z))) / half
  if (marge <= 0) return { ...b, x, z, opacite: 0, dormant: true }

  // fondu : plein à l'intérieur, éteint au bord. L'apparition suit la même
  // rampe, donc un bateau semé près du bord entre en fondu au lieu de surgir.
  const cible = Math.min(1, marge / FADE_BAND)
  const k = 1 - Math.exp(-2.5 * d) // lissage, pour que le fondu ne saute pas
  const opacite = b.opacite + (cible - b.opacite) * Math.max(k, 0)
  return { ...b, x, z, opacite, dormant: false }
}

// Toute la flotte est-elle endormie ? Le rendu peut alors se taire entièrement.
export function fleetAsleep(boats) {
  return !boats?.length || boats.every((b) => b.dormant)
}
