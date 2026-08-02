// LES VOLCANS — la partie PURE : qui est dans le cadre, et lesquels on montre.
//
// Ni three.js, ni DOM, ni réseau. Le catalogue est cuit par
// scripts/build-volcans.mjs (Smithsonian Global Volcanism Program, 1 196
// volcans de l'Holocène, 65 Ko) ; ici on ne fait que choisir.

import { spanLon } from './map/tile-index.js'

// ═══════════════════════════════════════════════════════════════════════════
// COMBIEN, ET POURQUOI PAS TOUS
// ═══════════════════════════════════════════════════════════════════════════
//
// Sur la ceinture de feu, un bloc large attrape facilement quarante volcans.
// Quarante étiquettes sur une carte, ce n'est pas quarante fois l'information
// d'une seule : c'est du bruit, et les repères de sommet (peaks.js) ont déjà
// tranché ce débat pour le relief. On plafonne donc, et on CHOISIT.
export const VOLCANS_MAX = 14

/**
 * Le tableau cuit → des objets nommés. Le fichier stocke des lignes compactes
 * pour tenir en 65 Ko ; personne n'a envie de lire `v[5]` dans le reste du code.
 *
 * @param {Array} ligne - [nom, lat, lon, altitude_m, type, derniere_eruption]
 */
export function volcanDeLigne(ligne) {
  if (!Array.isArray(ligne) || ligne.length < 6) return null
  const [nom, lat, lon, altitude, type, eruption] = ligne
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { nom, lat, lon, altitude, type, eruption }
}

/**
 * Ceux qui tombent dans l'emprise.
 *
 * ⚠️ `spanLon` ET PAS UNE COMPARAISON DIRECTE. Sur une emprise qui franchit
 * ±180° — le Pacifique, c'est-à-dire précisément là où se trouvent la moitié
 * des volcans du monde — `minLon <= lon && lon <= maxLon` est faux pour TOUS
 * les points. On mesure donc la distance depuis le bord ouest, enroulement
 * compris. C'est le même piège que celui qui avait fait rendre son complément
 * à `demBounds` (voir son commentaire).
 */
export function volcansDansEmprise(volcans, bbox) {
  if (!Array.isArray(volcans) || !bbox) return []
  const largeur = spanLon(bbox.minLon, bbox.maxLon)
  return volcans.filter((v) => {
    if (v.lat < bbox.minLat || v.lat > bbox.maxLat) return false
    return spanLon(bbox.minLon, v.lon) <= largeur
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// L'ORDRE D'IMPORTANCE — et pourquoi ce n'est pas l'altitude
// ═══════════════════════════════════════════════════════════════════════════
//
// Le réflexe serait de garder les plus hauts, comme pour les sommets. C'est le
// mauvais critère ici : un volcan n'intéresse pas par sa taille mais par le
// fait QU'IL SOIT VIVANT. Le Stromboli culmine à 924 m et entre en éruption
// presque en continu ; à côté, une caldeira endormie de 4 000 m ne raconte
// rien.
//
// On classe donc d'abord sur la RÉCENCE de la dernière éruption, l'altitude ne
// servant qu'à départager. Les volcans sans éruption datée (365 sur 1 196)
// passent en dernier — sans être exclus : « pas de date » n'est pas « éteint »,
// c'est « personne n'était là pour le voir ».
export function rangVolcan(v) {
  const an = Number.isFinite(v?.eruption) ? v.eruption : -Infinity
  return an
}

/**
 * Les volcans à montrer pour cette emprise, du plus vivant au moins.
 *
 * @param {Array} volcans - déjà convertis par volcanDeLigne
 * @param {object} bbox
 * @param {number} max
 */
export function volcansAMontrer(volcans, bbox, max = VOLCANS_MAX) {
  const dedans = volcansDansEmprise(volcans, bbox)
  dedans.sort((a, b) => rangVolcan(b) - rangVolcan(a) || (b.altitude ?? -9999) - (a.altitude ?? -9999))
  return dedans.slice(0, Math.max(0, max))
}

/**
 * Ce qu'on écrit sous le nom. Court : c'est une étiquette de carte, pas une
 * fiche. Et on ne ment jamais sur l'inconnu.
 */
export function légendeVolcan(v) {
  if (!v) return ''
  const bouts = []
  if (Number.isFinite(v.altitude)) {
    // Un volcan sous-marin est une information en soi, pas une altitude bizarre.
    bouts.push(v.altitude < 0 ? `${Math.abs(v.altitude)} m sous la mer` : `${v.altitude} m`)
  }
  if (Number.isFinite(v.eruption)) {
    bouts.push(v.eruption < 0 ? `éruption vers ${Math.abs(v.eruption)} av. J.-C.` : `éruption en ${v.eruption}`)
  } else {
    bouts.push('aucune éruption datée')
  }
  return bouts.join(' · ')
}
