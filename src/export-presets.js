// Préréglages d'export — la table est ici, seule, et pure.
//
// POURQUOI un module à part : la même échelle sert désormais DEUX voies qui ne
// se parlent pas — l'image fixe (export.js, rendu hors ligne) et
// l'enregistrement MP4 (export-recorder.js, capture du canevas vivant). Tant
// que la table vivait dans la modale, la vidéo n'avait aucun choix de taille ;
// la sortir permet aux deux de citer les mêmes crans sans se recopier.
//
// « 2K » EST AMBIGU, ET LE CHOIX EST ASSUMÉ. Le cinéma appelle 2K le DCI
// 2048×1080 ; le grand public appelle 2K le QHD 2560×1440. Ici c'est le QHD,
// parce que l'échelle existante — 1280 / 1920 / 2560 / 3840 — est la
// progression grand public 720p / 1080p / 1440p / 2160p. Un DCI 2K y serait
// plus BAS que le cran 1080p en hauteur tout en s'appelant « 2K » : personne
// n'y comprendrait rien. Le cran 2560 existait déjà, il lui manquait son nom.

// Le chiffre est le côté LONG, jamais la largeur : c'est ce qui permet au même
// menu de servir le 16:9 comme le 9:16 (2560 → 2560×1440 ou 1440×2560).
export const EXPORT_SIZES = [
  { value: '1280', label: 'HD · 1280 px' },
  { value: '1920', label: 'Full HD · 1920 px' },
  { value: '2560', label: '2K · 2560 px' },
  { value: '3840', label: '4K · 3840 px' },
]

export const EXPORT_RATIOS = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 }

export const DEFAULT_SIZE = '1920'
export const DEFAULT_RATIO = '16:9'

// Toujours pair : les passes de post-traitement construisent des cibles à la
// moitié et au quart de la taille, et une dimension impaire y devient
// fractionnaire — c'est le bug du rectangle noir documenté dans main.js.
export const even = (n) => Math.max(2, 2 * Math.round(n / 2))

// Ratio × cran → dimensions du fichier. `screenAspect` n'est lu que pour le
// ratio « Screen ».
//
// Tout ce qui n'est pas dans la table retombe sur le défaut plutôt que de
// laisser passer un NaN : la valeur ressort d'ici vers composer.setSize() puis
// camera.aspect, et un aspect NaN ne se répare pas tout seul (voir viewport.js).
export function exportDims(ratio, size, screenAspect = 1) {
  const known = EXPORT_SIZES.some((s) => s.value === String(size))
  const edge = Number(known ? size : DEFAULT_SIZE)
  const raw = ratio === 'Screen' ? screenAspect : (EXPORT_RATIOS[ratio] ?? EXPORT_RATIOS[DEFAULT_RATIO])
  const aspect = Number.isFinite(raw) && raw > 0 ? raw : 1
  return aspect >= 1
    ? { width: even(edge), height: even(edge / aspect) }
    : { width: even(edge * aspect), height: even(edge) }
}

// Octets d'UNE cible de rendu plein cadre. La chaîne compose en HalfFloat
// (main.js : `frameBufferType: THREE.HalfFloatType`), soit RGBA sur 16 bits =
// 8 octets par pixel.
//
// À GARDER EN TÊTE AVANT D'AJOUTER UN CRAN : pendant un export,
// composer.setSize() réalloue TOUTES les cibles à la taille demandée, y compris
// les six de la profondeur de champ si elle a déjà été allumée (voir
// style.css). Passer de 1080p à 2K multiplie chacune par 1,78 ; passer à 4K la
// multiplie encore par 2,25.
export const targetBytes = (w, h) => w * h * 8
