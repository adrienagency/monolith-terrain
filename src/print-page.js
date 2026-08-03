// LA GÉOMÉTRIE D'UNE AFFICHE — millimètres, pixels, fond perdu, et le plan de
// tuiles qui permet de la rendre sans faire tomber la machine.
//
// Module PUR : ni DOM, ni three.js, ni état. Il rend des nombres, et se teste
// sous node. Le rendu vit à côté ; l'emballage PDF encore ailleurs.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE MODULE EXISTE, EN UN CHIFFRE
// ═══════════════════════════════════════════════════════════════════════════
//
// L'export actuel plafonne à 3 840 px. À 300 points par pouce — la densité
// qu'un imprimeur demande — 3 840 px font **32,5 cm de large**. C'est une carte
// postale, pas une affiche. Un 50 × 70 réclame 5 906 × 8 268 px, soit 48,8
// mégapixels.
//
// ⚠️ ET CE N'EST PAS UNE AFFAIRE DE PATIENCE : c'est une affaire de mémoire.
// Un tampon couleur de 5 906 × 8 268 en RGBA pèse 195 Mo, AVANT l'anticrénelage
// (× 4 en MSAA), avant le tampon de profondeur, et avant les cibles de la
// chaîne de post-traitement qui suivent la même taille. On dépasse le gigaoctet
// sur une machine de bureau, et `MAX_RENDERBUFFER_SIZE` vaut 8 192 sur une
// bonne moitié du parc — 8 268 passe déjà par-dessus.
//
// D'où le TUILAGE : on rend l'affiche en morceaux et on la recolle. C'est ce
// plan-là que ce module calcule, et il a une propriété non négociable — voir
// `planTuiles`.

/** Un pouce, en millimètres. La seule constante de conversion du fichier. */
export const MM_PAR_POUCE = 25.4

/** La densité qu'un imprimeur attend pour une image en ton continu. */
export const DPI_IMPRESSION = 300

/**
 * Le fond perdu, en millimètres. L'image déborde le format fini de cette
 * marge : la massicoteuse a une tolérance, et sans débord un liseré de papier
 * blanc apparaît sur un bord ou l'autre. 3 mm est le standard européen, et
 * c'est ce que demandent les imprimeurs à la commande.
 */
export const FOND_PERDU_MM = 3

/**
 * ⚠️ LA MARGE DE SÉCURITÉ N'EST PAS LE FOND PERDU, et les confondre coûte un
 * tirage. Le fond perdu est ce qu'on ajoute DEHORS et qui sera coupé ; la marge
 * de sécurité est ce qu'on s'interdit DEDANS. Rien de signifiant — un nom de
 * lieu, l'échelle, la signature — ne doit s'en approcher, sinon la même
 * tolérance de coupe le rogne.
 */
export const MARGE_SECURITE_MM = 5

// Les formats, en millimètres et en PORTRAIT. L'orientation se demande à part :
// une carte est plus souvent large que haute, et dupliquer chaque format en
// deux entrées ferait une liste deux fois plus longue à lire pour rien.
export const FORMATS_AFFICHE = [
  { id: 'a4', label: 'A4 · 21 × 29,7 cm', mm: [210, 297] },
  { id: '30x40', label: '30 × 40 cm', mm: [300, 400] },
  { id: 'a3', label: 'A3 · 29,7 × 42 cm', mm: [297, 420] },
  { id: '40x50', label: '40 × 50 cm', mm: [400, 500] },
  { id: 'a2', label: 'A2 · 42 × 59,4 cm', mm: [420, 594] },
  { id: '50x70', label: '50 × 70 cm', mm: [500, 700] },
  { id: '61x91', label: '61 × 91 cm', mm: [610, 914] },
]

export const FORMAT_PAR_ID = Object.fromEntries(FORMATS_AFFICHE.map((f) => [f.id, f]))

/**
 * Millimètres → pixels, à une densité donnée.
 *
 * ⚠️ ON ARRONDIT AU SUPÉRIEUR, jamais au plus proche. Un pixel en trop se perd
 * dans le fond perdu ; un pixel en moins découvre une ligne de papier sur le
 * bord de la feuille, et c'est le seul défaut d'impression qu'on ne peut plus
 * rattraper une fois le tirage payé.
 */
export function pxPourMm(mm, dpi = DPI_IMPRESSION) {
  if (!(mm > 0) || !(dpi > 0)) return 0
  return Math.ceil((mm / MM_PAR_POUCE) * dpi)
}

/** Pixels → millimètres, la réciproque (pour dire à l'utilisateur ce qu'il aura). */
export function mmPourPx(px, dpi = DPI_IMPRESSION) {
  if (!(px > 0) || !(dpi > 0)) return 0
  return (px / dpi) * MM_PAR_POUCE
}

/**
 * La géométrie complète d'une page.
 *
 * Rend les deux tailles qui comptent et qu'on confond tout le temps :
 *   · `finiPx`  — le format APRÈS coupe, celui qu'on annonce à l'acheteur ;
 *   · `totalPx` — le format À RENDRE, fond perdu compris, celui qu'il faut
 *                 réellement produire et tuiler.
 *
 * @param {object} o
 * @param {string} o.format - un id de FORMATS_AFFICHE
 * @param {number} [o.dpi]
 * @param {'portrait'|'paysage'} [o.orientation]
 * @param {number} [o.fondPerduMm] - 0 pour une sortie sans débord (écran, PDF
 *   destiné à une imprimante de bureau qui ne massicote pas)
 * @returns {object|null} null si le format est inconnu
 */
export function geometriePage({ format, dpi = DPI_IMPRESSION, orientation = 'portrait', fondPerduMm = FOND_PERDU_MM } = {}) {
  const f = FORMAT_PAR_ID[format]
  if (!f || !(dpi > 0)) return null
  const fond = Math.max(0, fondPerduMm)
  const [court, long] = f.mm
  const [largeurMm, hauteurMm] = orientation === 'paysage' ? [long, court] : [court, long]
  return {
    id: f.id,
    label: f.label,
    orientation,
    dpi,
    largeurMm,
    hauteurMm,
    fondPerduMm: fond,
    margeSecuriteMm: MARGE_SECURITE_MM,
    // le format fini, celui qu'on annonce
    finiPx: [pxPourMm(largeurMm, dpi), pxPourMm(hauteurMm, dpi)],
    // le format à produire, fond perdu compris — c'est LUI qu'on rend
    totalMm: [largeurMm + 2 * fond, hauteurMm + 2 * fond],
    totalPx: [pxPourMm(largeurMm + 2 * fond, dpi), pxPourMm(hauteurMm + 2 * fond, dpi)],
  }
}

/**
 * Ce que pèse un rendu, en octets, pour que le Gardien puisse dire non.
 *
 * On compte ce qui existe VRAIMENT en même temps sur une tuile : la cible de
 * rendu (× l'échantillonnage), la profondeur, et les deux cibles de la chaîne
 * de post-traitement qui font du ping-pong. Plus le canevas de composition, qui
 * lui fait la taille PLEINE et vit du début à la fin.
 */
export function poidsRendu({ totalPx, tuilePx, echantillons = 1 }) {
  const [W, H] = totalPx
  const [tw, th] = tuilePx
  const octetsTuile = tw * th * 4 * (Math.max(1, echantillons) + 1 /* profondeur ≈ 1 */ + 2 /* ping-pong */)
  const octetsPleine = W * H * 4
  return { tuile: octetsTuile, pleine: octetsPleine, total: octetsTuile + octetsPleine }
}

/**
 * ═══════════ LE PLAN DE TUILES, ET SA PROPRIÉTÉ NON NÉGOCIABLE ══════════════
 *
 * ⚠️ LA SOMME DES TUILES DOIT RETOMBER EXACTEMENT SUR LA TAILLE PLEINE. Pas
 * « à peu près », pas « à un pixel près » : exactement. Un pixel manquant entre
 * deux tuiles, c'est une ligne claire d'un pixel en travers de l'affiche —
 * invisible à l'écran, parfaitement visible sur un tirage de 70 cm où ce pixel
 * mesure 0,08 mm et court sur toute la hauteur. Le découpage naïf
 * (`Math.floor(W / n)` répété) perd le reste de la division ; on répartit donc
 * ce reste sur les premières tuiles, une unité chacune.
 *
 * `maxTuile` est le plafond du matériel — typiquement MAX_RENDERBUFFER_SIZE,
 * mais on descend bien en dessous par prudence mémoire : quatre tuiles de
 * 2 048 coûtent moins cher, en pointe, qu'une de 8 192.
 *
 * @param {[number,number]} totalPx - la taille pleine à produire
 * @param {number} maxTuile - le côté maximal d'une tuile, en pixels
 * @returns {{colonnes:number, lignes:number, tuiles:Array}}
 */
export function planTuiles(totalPx, maxTuile = 2048) {
  const [W, H] = totalPx.map((v) => Math.max(1, Math.round(v)))
  const cote = Math.max(64, Math.round(maxTuile))
  const colonnes = Math.ceil(W / cote)
  const lignes = Math.ceil(H / cote)
  // Le reste de la division, réparti une unité par tuile sur les premières :
  // c'est ce qui garantit que la somme retombe juste.
  const tailles = (total, n) => {
    const base = Math.floor(total / n)
    const reste = total - base * n
    return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0))
  }
  const larg = tailles(W, colonnes)
  const haut = tailles(H, lignes)
  const tuiles = []
  let y = 0
  for (let j = 0; j < lignes; j++) {
    let x = 0
    for (let i = 0; i < colonnes; i++) {
      tuiles.push({ i, j, x, y, w: larg[i], h: haut[j] })
      x += larg[i]
    }
    y += haut[j]
  }
  return { colonnes, lignes, pleine: [W, H], tuiles }
}

/**
 * Le cadrage d'une tuile pour `camera.setViewOffset`.
 *
 * ⚠️ LES QUATRE PREMIERS ARGUMENTS SONT LA TAILLE PLEINE, PAS CELLE DE LA TUILE.
 * C'est tout le contrat de setViewOffset : on lui décrit l'image ENTIÈRE, puis
 * la fenêtre qu'on veut en extraire. Lui passer la taille de la tuile rendrait
 * la scène entière dans chaque tuile — on obtiendrait N × M miniatures au lieu
 * d'une affiche.
 */
export function cadrageTuile(plan, tuile) {
  const [W, H] = plan.pleine
  return { fullWidth: W, fullHeight: H, offsetX: tuile.x, offsetY: tuile.y, width: tuile.w, height: tuile.h }
}

// ═══════════ LE CADRAGE DE L'AFFICHE — TROIS NOMBRES, ET UNE RÈGLE ══════════
//
// Adrien : « par défaut, la totalité du socle est visible sur l'affiche ». Ce
// n'est pas le cadrage de l'écran : à l'écran on tourne autour du bloc, on
// s'approche, on ressort — et ce qu'on regarde n'est presque jamais l'objet
// entier. L'affiche, elle, s'ouvre TOUJOURS sur le bloc au complet, et c'est
// ensuite que l'utilisateur resserre s'il veut.
//
// Le cadrage tient donc en trois nombres, et aucun ne touche la caméra de la
// scène : zoom (1 = tout le socle), puis deux décalages en fraction de l'image.
export const CADRAGE_DEFAUT = { zoom: 1, x: 0, y: 0 }
export const CADRAGE_ZOOM_MIN = 0.7
export const CADRAGE_ZOOM_MAX = 3

/** Ramène un cadrage dans ses bornes, quoi qu'on lui passe. */
export function cadrageValide(c = {}) {
  const n = (v, d) => (Number.isFinite(v) ? v : d)
  const zoom = Math.min(CADRAGE_ZOOM_MAX, Math.max(CADRAGE_ZOOM_MIN, n(c.zoom, 1)))
  // ⚠️ LE DÉCALAGE EST BORNÉ PAR LE ZOOM, et pas par une constante. À zoom 1 on
  // voit déjà tout : traîner l'image ne ferait qu'ouvrir du vide sur un bord. La
  // marge disponible est exactement ce que le zoom a poussé hors cadre.
  const marge = Math.max(0, 1 - 1 / zoom)
  // `+ 0` normalise le zéro NÉGATIF que produit un clamp à marge nulle. Il vaut
  // zéro à tous les usages, mais pas à la comparaison stricte — et c'est le
  // genre de valeur qui traverse un enregistrement de gabarit sans prévenir.
  const borne = (v) => Math.min(marge, Math.max(-marge, n(v, 0))) + 0
  return { zoom, x: borne(c.x), y: borne(c.y) }
}

/**
 * À quelle distance placer la caméra pour que TOUS ces points tiennent dans le
 * cadre — la règle « on voit le socle en entier ».
 *
 * Les points sont donnés en espace CAMÉRA, relatifs au point visé : x à droite,
 * y en haut, z vers l'arrière (la caméra regarde vers −z, convention three.js).
 *
 * ⚠️ ON NE SE CONTENTE PAS D'UNE SPHÈRE ENGLOBANTE, et la différence se voit.
 * Un bloc de 56 × 56 × 20 a une sphère de rayon 41 : cadrer dessus laisserait
 * une marge énorme et l'affiche paraîtrait vide. On projette donc les huit
 * coins et on prend le pire — c'est exact, et c'est serré.
 *
 * ⚠️ ET LE `+ p.z` N'EST PAS UN DÉTAIL : un coin PROCHE de la caméra remplit
 * plus de cadre qu'un coin lointain de même écart latéral. L'oublier cadre bien
 * la face arrière du bloc et laisse la face avant déborder.
 *
 * @param {Array<{x:number,y:number,z:number}>} points
 * @param {number} fovYRad - l'ouverture VERTICALE, en radians
 * @param {number} aspect - largeur / hauteur de l'image
 * @param {number} [marge] - respiration ajoutée, en fraction (0,06 = 6 %)
 * @returns {number} la distance, jamais négative
 */
export function distanceCadrage(points, fovYRad, aspect, marge = 0.06) {
  if (!Array.isArray(points) || !points.length) return 0
  if (!(fovYRad > 0) || !(aspect > 0)) return 0
  const tanY = Math.tan(fovYRad / 2)
  const tanX = tanY * aspect
  let d = 0
  for (const p of points) {
    if (!p || ![p.x, p.y, p.z].every(Number.isFinite)) continue
    d = Math.max(d, Math.abs(p.y) / tanY + p.z, Math.abs(p.x) / tanX + p.z)
  }
  return Math.max(0, d * (1 + Math.max(0, marge)))
}

/**
 * Le format fini réellement atteint par une image donnée, en centimètres — de
 * quoi dire honnêtement à l'utilisateur ce qu'il peut tirer.
 *
 * C'est le calcul qui justifie tout ce module : 3 840 px, la limite de l'export
 * actuel, valent 32,5 cm à 300 dpi.
 */
export function formatAtteintCm(px, dpi = DPI_IMPRESSION) {
  return mmPourPx(px, dpi) / 10
}
