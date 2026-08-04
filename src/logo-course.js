// LE LOGO DE COURSE — vérifié AU MOMENT DU CHOIX, pas à la publication.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE MODULE EXISTE
// ═══════════════════════════════════════════════════════════════════════════
// Le logo d'un organisateur était déjà validé, mais TROP TARD : le serveur
// (netlify/functions/race.mjs, isValidLogoDataUrl) et le lecteur de charge
// partagée (share-link.js, parseRacePayload) refusent tous deux ce qui n'est
// pas un data URL png/jpeg/webp/gif borné. L'étape ① du Race Studio, elle,
// acceptait n'importe quel `image/*` sans un contrôle : on pouvait choisir un
// logo de 10 Mo, le voir gravé sur le flanc du bloc, l'autosauver en
// localStorage (au risque d'en dépasser le quota, ce qui fait échouer TOUTES
// les sauvegardes de brouillon suivantes) — et ne découvrir qu'à la
// publication que le logo ne partirait pas. Pire : `logoForPublish` rend
// `null` plutôt que d'échouer, donc la course partait SANS logo, en silence.
//
// Un refus qui arrive après coup n'est pas un refus, c'est un piège. Ce module
// applique la même règle, au moment où l'utilisateur peut encore agir.
//
// ⚠️ LA LIMITE N'EST PAS RECOPIÉE ICI. Elle est importée de share-link.js.
// Trois copies de la même constante existaient déjà dans le projet (serveur,
// partage, icônes) ; en ajouter une quatrième aurait garanti qu'un jour l'une
// d'elles dérive et qu'un logo accepté à l'import soit rejeté à l'envoi.
//
// ⚠️ LE SVG EST REFUSÉ, ET C'EST VOULU. Le serveur ne l'a jamais accepté. Un
// SVG téléversé est du code exécutable, et le seul chemin qui en acceptait
// (le sélecteur d'icônes de sport, avec son désinfecteur) a été retiré à la
// demande d'Adrien — le désinfecteur est parti avec, faute de consommateur.
// Autoriser le SVG ici rouvrirait cette surface pour rien.
//
// Module PUR : aucune dépendance au DOM.

import { RACE_LOGO_MAX_CHARS } from './share-link.js'

// L'allowlist du serveur, mot pour mot (race.mjs LOGO_DATA_URL_RE).
export const FORMATS_LOGO = ['png', 'jpeg', 'webp', 'gif']

const LOGO_DATA_URL_RE = new RegExp(`^data:image/(${FORMATS_LOGO.join('|')});base64,[A-Za-z0-9+/]+=*$`)

// Un mégaoctet lisible, pour écrire une raison qui parle à un organisateur
// plutôt qu'un nombre de caractères base64.
const enMo = (cars) => Math.round((cars * 0.75) / 1e5) / 10

/**
 * @param dataUrl le résultat d'un FileReader.readAsDataURL
 * @returns { ok: true } ou { ok: false, raison } — la raison est destinée à
 *          être AFFICHÉE telle quelle, c'est pourquoi elle est en français et
 *          dit quoi faire, pas seulement ce qui ne va pas.
 */
export function verifieLogo(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) {
    return { ok: false, raison: 'Fichier illisible — réessaie avec une image.' }
  }
  // la taille D'ABORD : sur un fichier énorme, on refuse sans faire tourner
  // l'expression régulière sur des mégaoctets de base64
  if (dataUrl.length > RACE_LOGO_MAX_CHARS) {
    return { ok: false, raison: `Logo trop lourd (${enMo(dataUrl.length)} Mo) — maximum ${enMo(RACE_LOGO_MAX_CHARS)} Mo.` }
  }
  if (!LOGO_DATA_URL_RE.test(dataUrl)) {
    return { ok: false, raison: `Format non accepté — utilise un ${FORMATS_LOGO.join(', ')}.` }
  }
  return { ok: true }
}
