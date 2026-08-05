// L'ÉCHELLE DE RÉSOLUTION D'UNE AFFICHE, ET SA DÉGRADATION.
//
// Module PUR : ni DOM, ni three.js, ni état. Il prend un format, une
// orientation, un plafond matériel, et rend des nombres. Il se teste sous node.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE MODULE EXISTE, EN UN CHIFFRE
// ═══════════════════════════════════════════════════════════════════════════
//
// Le format par défaut de la boutique — 50 × 70 en paysage — réclame 8 339 px
// de large à 300 dpi. `MAX_RENDERBUFFER_SIZE` vaut 8 192 sur une bonne moitié
// du parc, et LE RABOTAGE EST SILENCIEUX : le pilote rend ce qu'il peut, aucune
// exception n'est levée, et l'affiche sort écrasée de 1,8 % avec 13 mm de
// papier nu sur un bord. Le défaut ne se découvre qu'après le tirage payé.
//
// ⚠️ ET IL EST NÉ D'UNE SEULE ORIENTATION CALCULÉE. En portrait, 8 339 est la
// hauteur — jamais demandée à la largeur du tampon. Toute densité définie ici
// est donc vérifiée dans LES DEUX SENS ; c'est l'angle mort d'origine.
//
// ═══════════════════════════════════════════════════════════════════════════
// 300 DPI EST UN PLAFOND DE TRAME, PAS UNE EXIGENCE
// ═══════════════════════════════════════════════════════════════════════════
//
// C'est la densité qu'un imprimeur demande pour un livre tenu à 30 cm. Le grand
// format se raisonne en DISTANCE DE LECTURE : l'œil sépare environ une minute
// d'arc, soit ~300 points par pouce à 30 cm, ~150 à 60 cm, ~90 à un mètre. Un
// A0 à 180 dpi est indiscernable à deux mètres.
//
// Et un fait mesuré dans ce code, qui tranche à lui seul : la mosaïque aérienne
// de ShibuMap plafonne autour de 208 dpi effectifs sur 500 mm de large.
// Descendre le 50 × 70 à 250 dpi ne perd donc RIEN — on est déjà au-dessus de
// ce que la source fournit. Le 61 × 91 à 200 dpi est à la source, exactement.

import { FORMATS_AFFICHE, FORMAT_PAR_ID, geometriePage, planTuiles } from './print-page.js'

/**
 * Le côté d'une tuile. 2 048 est le plancher garanti de WebGL2 : aucune machine
 * ne descend en dessous, donc en pavant à cette taille on n'a rien à détecter.
 */
export const COTE_TUILE = 2048

/**
 * Le plafond matériel le plus répandu, en pixels de côté. Sert de RÉFÉRENCE
 * pour la table nominale (aucune densité nominale ne doit le dépasser, dans
 * aucune orientation) — pas de limite d'exécution : celle-là se mesure sur la
 * machine et se passe à `degradePour`.
 */
export const PLAFOND_REFERENCE = 8192

/**
 * ═══════════ LA TABLE NOMINALE ══════════════════════════════════════════════
 *
 * La densité qu'on vise quand la machine suit, format par format. 300 jusqu'à
 * l'A2 ; puis on descend, non par faiblesse mais parce que la source s'arrête
 * là et que le plafond matériel arrive.
 *
 * ⚠️ PAS DE VALEUR PAR DÉFAUT. Un format ajouté au catalogue sans entrée ici
 * rend `null` — il disparaît de la grille au lieu d'hériter d'un 300 qui, sur
 * un grand format, redéclenche exactement le défaut du 50 × 70. `formatsSansDensite()`
 * existe pour que le test le voie avant l'utilisateur.
 */
export const DPI_NOMINAL = {
  a4: 300,
  '30x40': 300,
  a3: 300,
  '40x50': 300,
  a2: 300,
  // 700 mm + fond perdu à 300 dpi = 8 339 px > 8 192. Et la mosaïque plafonne à
  // ~208 dpi sur cette largeur : 250 est encore au-dessus de la source.
  '50x70': 250,
  // 914 mm à 250 dpi feraient encore 9 055 px. 200 dpi tient dans le parc, et
  // c'est la densité de la source. Un 61 × 91 se regarde à plus d'un mètre.
  '61x91': 200,
}

/**
 * ═══════════ LE PLANCHER, ET POURQUOI 150 ═══════════════════════════════════
 *
 * La règle d'Adrien est « dégrader d'abord, cacher ensuite » : sur une machine
 * limitée on garde le format et on baisse la densité. Mais il faut un fond,
 * sinon on finit par vendre une bouillie — et une affiche floue coûte plus
 * qu'une vente manquée : elle coûte le remboursement, l'avis, et la confiance.
 *
 * 150 dpi, pour quatre raisons qui convergent :
 *
 * 1. UNE CARTE S'APPROCHE. L'acuité pure autoriserait bien moins : 90 dpi
 *    suffisent à un mètre, 60 à deux. Mais un poster de carte n'est pas une
 *    photo qu'on regarde de loin — on vient lire les noms de lieux à 50 cm, le
 *    nez dessus. À cette distance la limite de l'œil est d'environ 180 dpi, et
 *    150 est le premier cran en dessous où l'on ne voit encore rien d'anormal.
 *
 * 2. C'EST LE TEXTE QUI CASSE EN PREMIER, pas la carte. Le trait d'attribution
 *    et l'échelle sont composés autour de 2 mm de hauteur de capitale. À
 *    150 dpi cela fait 11,8 px de haut : de la typographie anticrénelée encore
 *    nette. À 120 dpi, 9,4 px — les diagonales marchent visiblement à bout de
 *    bras. Le seuil est là, pas dans le relief.
 *
 * 3. AU-DESSUS DU PLANCHER, ON NE JETTE QUE DU RÉ-ÉCHANTILLONNAGE. Entre 208
 *    (le plafond de la mosaïque) et 150, on perd de l'information que la source
 *    a réellement ; en dessous de 150, on en perd beaucoup, et vite.
 *
 * 4. C'EST LE MINIMUM QUE LE MÉTIER ÉNONCE pour le grand format. Un prestataire
 *    qui reçoit moins prévient ou refuse. Vendre en dessous de ce qu'un
 *    imprimeur accepte, c'est vendre une réclamation. (Règle de métier, pas
 *    mesure : c'est la seule des quatre raisons que je n'ai pas vérifiée moi-même.)
 *
 * CE QUE ÇA COÛTE, dit franchement : sur une machine plafonnée à 4 096 px, le
 * 50 × 70 (147 dpi possibles) et le 61 × 91 (113) sortent de la grille. C'est
 * le choix assumé — ces deux-là sont justement les formats qu'on regarde de
 * près en boutique avant de payer 39 €.
 */
export const DPI_PLANCHER = 150

/**
 * Le pas de descente, en dpi.
 *
 * ⚠️ PAS UN PALIER GROSSIER, et c'est un choix mesuré. Une échelle
 * 300 → 250 → 200 rendrait 200 dpi à un A3 sur une machine plafonnée à 4 096,
 * là où le format en tolère 244 : 20 % de résolution linéaire jetés pour 2 % de
 * dépassement. Le pas de 10 rend 240. Il garde des densités rondes — celles
 * qu'on peut annoncer à l'acheteur sans avoir l'air de bricoler — pour au plus
 * 4 % de perte.
 *
 * Toutes les densités nominales sont des multiples de 10, et le plancher aussi :
 * la descente tombe donc exactement dessus (verrouillé par test).
 */
export const PAS_DPI = 10

/**
 * Les formats du catalogue qui n'ont pas de densité définie.
 *
 * ⚠️ LIT `FORMATS_AFFICHE` À CHAQUE APPEL, volontairement. C'est ce qui permet
 * au test d'injecter un huitième format et de vérifier qu'il rougit — la
 * propriété qui compte n'est pas la liste d'aujourd'hui, c'est le lien entre le
 * catalogue et la table.
 */
export function formatsSansDensite() {
  return FORMATS_AFFICHE.filter((f) => !(DPI_NOMINAL[f.id] > 0)).map((f) => f.id)
}

/**
 * La densité nominale d'un format.
 *
 * L'orientation ne la change pas — c'est le même papier, tourné — et c'est
 * vérifié plutôt que supposé : le côté long décide, dans les deux sens. Le
 * paramètre reste dans la signature parce que l'appelant raisonne toujours en
 * (format, orientation), et qu'une signature qui l'omet invite à l'oublier.
 *
 * @param {string} format - un id de FORMATS_AFFICHE
 * @param {'portrait'|'paysage'} [orientation]
 * @returns {number|null} null si le format est inconnu ou sans densité définie
 */
export function dpiPour(format, orientation = 'portrait') {
  if (!FORMAT_PAR_ID[format]) return null
  const dpi = DPI_NOMINAL[format]
  return dpi > 0 ? dpi : null
}

/**
 * ═══════════ DÉGRADER D'ABORD, CACHER ENSUITE ═══════════════════════════════
 *
 * La décision d'Adrien, telle quelle : « ok pour abaisser un peu la qualité de
 * celui qui a un ordi ou un tel pas assez puissant. On peut aussi cacher
 * certains formats. » Dans cet ordre, et pas l'inverse : on ne retire jamais un
 * format que l'acheteur voulait tant qu'on peut encore le lui livrer propre.
 *
 * On part du nominal — JAMAIS au-dessus, même sur une machine énorme, parce que
 * la source ne suit pas — et on descend de `PAS_DPI` en `PAS_DPI` jusqu'à ce
 * que les deux côtés tiennent dans le plafond. Si on atteint le plancher sans y
 * arriver, on rend `null` : à l'appelant de retirer le format de la grille.
 *
 * `limiteMaterielle` est le côté maximal admis par la machine, mesuré (une
 * sonde, `MAX_TEXTURE_SIZE`, `MAX_RENDERBUFFER_SIZE` — le plus petit des trois).
 *
 * ⚠️ ON NE DEVINE PAS LE MATÉRIEL. Une limite absente, nulle, négative,
 * infinie ou non numérique rend `null` — pas un plafond par défaut qui
 * promettrait une résolution que personne n'a vérifiée. C'est ce genre de
 * valeur par défaut optimiste qui a produit le défaut d'origine.
 *
 * @param {string} format
 * @param {'portrait'|'paysage'} [orientation]
 * @param {number} limiteMaterielle - côté maximal, en pixels
 * @returns {{dpi:number, px:[number,number], tuiles:number}|null}
 */
export function degradePour(format, orientation = 'portrait', limiteMaterielle = 0) {
  const nominal = dpiPour(format, orientation)
  if (nominal === null) return null
  if (typeof limiteMaterielle !== 'number' || !Number.isFinite(limiteMaterielle) || limiteMaterielle <= 0) return null

  for (let dpi = nominal; dpi >= DPI_PLANCHER; dpi -= PAS_DPI) {
    const g = geometriePage({ format, dpi, orientation })
    if (!g) return null
    const [largeur, hauteur] = g.totalPx
    // Les DEUX côtés, pas la largeur seule : c'est l'orientation oubliée.
    if (Math.max(largeur, hauteur) > limiteMaterielle) continue
    return { dpi, px: [largeur, hauteur], tuiles: planTuiles(g.totalPx, COTE_TUILE).tuiles.length }
  }
  // Même au plancher, ça ne passe pas : ce format sort de la grille. Refuser la
  // vente vaut mieux que livrer une affiche qu'on devra rembourser.
  return null
}
