// ═══════════ L'ÉPAISSEUR DES TRAITS QUAND L'AFFICHE SE PAVE ═════════════════
//
// Les fleuves, les contours de lac et le halo du tracé sont dessinés par
// `LineMaterial` (three/examples/jsm/lines). Ce matériau est le SEUL de la
// scène dont l'épaisseur ne passe pas par la matrice de projection : il élargit
// le ruban en espace CLIP, après coup.
//
//     node_modules/three/examples/jsm/lines/LineMaterial.js, l. 197-228 :
//
//         vec2 offset = vec2( dir.y, - dir.x );
//         offset.x /= aspect;              // aspect = resolution.x / resolution.y
//         offset *= linewidth;
//         offset /= resolution.y;          // ← clip, PAS projection
//         offset *= clip.w;
//         clip.xy += offset;
//
// Conséquence, et c'est elle qui rend le défaut contre-intuitif : le décalage
// de tuile (`camera.setViewOffset`, export-cadrage.js) vit dans la projection.
// Il recadre parfaitement les sommets — et ne touche PAS à ce `offset`. Les
// étiquettes de villes, les rubans, le relief survivent au pavage ; ces
// trois matériaux-là, non.
//
// ═══ POURQUOI LE DÉFAUT EST ASYMÉTRIQUE ════════════════════════════════════
//
// En dépliant les deux lignes ci-dessus, l'épaisseur RÉELLEMENT peinte, en
// pixels de la cible, vaut :
//
//     segment horizontal (mesuré verticalement) : linewidth · Hcible / resolution.y
//     segment vertical  (mesuré horizontalement) : linewidth · Wcible / resolution.x
//
// Leur rapport — l'anisotropie, c'est-à-dire le « trait en peigne » — vaut donc
//
//     (Hcible · resolution.x) / (Wcible · resolution.y) = aspect(resolution) / aspect(cible)
//
// et il ne vaut 1 QUE si `resolution` a le rapport de la cible. C'est pour ça
// que poser `resolution = (tuile.w, tuile.h)` n'est pas un réglage de confort
// mais la seule façon de rendre un trait rond. Et l'anisotropie ne se voit pas
// à l'aperçu si l'aperçu ment de la même façon : d'où le second appelant.
//
// ⚠️ Le SENS de l'écart (plus fin ou plus épais) dépend de la fenêtre : une
// fenêtre large et basse face à une tuile carrée épaissit tout, en épaississant
// les horizontales plus que les verticales. Ce qui est garanti, dans tous les
// cas, c'est le PEIGNE — la formule ci-dessus, vérifiée par test.
//
// ═══ LE SECOND GESTE : L'ÉPAISSEUR ELLE-MÊME ═══════════════════════════════
//
// Une fois `resolution` posée sur la tuile, l'épaisseur peinte vaut exactement
// `linewidth` pixels D'AFFICHE (une tuile est un découpage 1:1 de l'affiche).
// Un trait de 2 px — celui du tracé à l'écran — ferait donc 2 px sur un tirage
// à 300 dpi, soit 0,17 mm. Invisible. Il faut le remettre à l'échelle :
//
//     linewidth = épaisseurRelative × hauteur TOTALE de l'affiche
//
// ⚠️ TOTALE, pas celle de la tuile. La tuile n'est qu'un morceau ; c'est la
// hauteur de l'image finie qui donne l'échelle, sans quoi une affiche en deux
// lignes de tuiles sortirait deux fois trop fine.
//
// L'épaisseur relative se lit sur le matériau lui-même : `linewidth /
// resolution.y`, la fraction de hauteur d'écran qu'il occupe aujourd'hui.
// Aucune table à tenir à jour, et un réglage utilisateur (les puces
// Fine/Classique/Épaisse) est donc suivi sans le savoir.
//
// ═══ LE PLANCHER — 0,25 pt, ET IL N'EST PAS NÉGOCIABLE ═════════════════════
//
// Sous 0,25 pt (0,088 mm), un filet ne survit pas au tirage : en jet d'encre il
// se dilue sous la goutte, en offset il se remplit ou disparaît selon
// l'engraissement de la trame. C'est le minimum retenu par la recherche métier
// de ce chantier. On le convertit en pixels à la densité RÉELLE du rendu, pas à
// une densité supposée : `plancherEpaisseurPx(dpi)`.

import { MM_PAR_POUCE, DPI_IMPRESSION } from './print-page.js'

/** Le point typographique PostScript : 72 par pouce. */
export const POINTS_PAR_POUCE = 72

/**
 * Le trait le plus fin qui survive à une presse. 0,25 pt = 0,0882 mm.
 * En dessous, le filet se dilue (jet d'encre) ou se remplit (offset).
 */
export const EPAISSEUR_MIN_PT = 0.25

/** Le même plancher, en millimètres — ce qu'on mesure sur le papier. */
export const EPAISSEUR_MIN_MM = (EPAISSEUR_MIN_PT / POINTS_PAR_POUCE) * MM_PAR_POUCE

/**
 * Le plancher exprimé en pixels de l'image produite, à une densité donnée.
 * À 300 dpi il vaut 1,04 px ; à 150 dpi (le plancher d'export-dpi.js) 0,52 px.
 */
export function plancherEpaisseurPx(dpi = DPI_IMPRESSION) {
  if (!(dpi > 0) || !Number.isFinite(dpi)) return 0
  return (EPAISSEUR_MIN_PT / POINTS_PAR_POUCE) * dpi
}

/**
 * La densité RÉELLE d'un rendu, sachant la taille physique qu'il représente.
 *
 * ⚠️ C'EST CE QUI REND L'APERÇU HONNÊTE. Un aperçu de 1 000 px de haut qui
 * représente une affiche de 70 cm n'est pas à 300 dpi : il est à 36 dpi. Lui
 * appliquer le plancher de 300 dpi (1,04 px) épaissirait à l'écran des traits
 * qui, sur le papier, n'ont aucun besoin d'être relevés — et l'aperçu
 * mentirait à nouveau, dans l'autre sens.
 */
export function dpiEffectif(hauteurPx, hauteurMm) {
  if (!(hauteurPx > 0) || !(hauteurMm > 0)) return 0
  return hauteurPx / (hauteurMm / MM_PAR_POUCE)
}

/**
 * L'épaisseur d'un matériau exprimée en fraction de la hauteur qu'il occupe
 * aujourd'hui. C'est la seule grandeur qui traverse un changement de cible.
 *
 * Rend 0 quand la résolution est inutilisable (matériau jamais dimensionné,
 * fenêtre à 0 px de haut le temps d'un repli d'onglet) : l'appelant retombe
 * alors sur le plancher, c'est-à-dire sur un trait fin mais IMPRIMABLE, plutôt
 * que sur un NaN qui ferait disparaître la ligne entière.
 */
export function epaisseurRelative(linewidth, resolutionY) {
  if (!(resolutionY > 0) || !Number.isFinite(linewidth) || linewidth <= 0) return 0
  return linewidth / resolutionY
}

/**
 * L'épaisseur à poser sur le matériau pendant l'export, en pixels d'affiche.
 *
 * @param {object} o
 * @param {number} o.relative - sortie d'`epaisseurRelative`
 * @param {number} o.hauteurTotalePx - la hauteur de l'affiche ENTIÈRE, pas celle
 *   de la tuile en cours
 * @param {number} [o.dpi] - la densité du tirage, pour le plancher
 */
export function epaisseurExport({ relative, hauteurTotalePx, dpi = DPI_IMPRESSION }) {
  const plancher = plancherEpaisseurPx(dpi)
  if (!(hauteurTotalePx > 0)) return plancher
  const brute = (relative > 0 ? relative : 0) * hauteurTotalePx
  return Math.max(brute, plancher)
}

/**
 * Tous les `LineMaterial` accrochés sous une racine de scène, sans doublon.
 *
 * ⚠️ UNE TRAVERSÉE, PAS UNE LISTE. Trois matériaux sont concernés aujourd'hui
 * (le tracé Line2, son halo, et les lots de LineSegments2 du calque d'eau) ;
 * une liste écrite en dur laisserait un quatrième sortir en peigne sans une
 * ligne en console. On lit le graphe, qui est la seule chose qui ne mente pas.
 *
 * Le dédoublonnage compte : le calque d'eau range plusieurs objets par lot, et
 * un même matériau vu deux fois serait sauvegardé deux fois — la seconde
 * sauvegarde enregistrant l'état DÉJÀ MODIFIÉ, la restauration ne reviendrait
 * jamais à l'affichage d'avant.
 */
export function materiauxDeLigne(racine) {
  const vus = new Set()
  racine?.traverse?.((o) => {
    const m = o?.material
    if (!m) return
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (mat?.isLineMaterial && mat.resolution) vus.add(mat)
    }
  })
  return [...vus]
}

/**
 * ═══════════ LES DEUX GESTES, ET LEUR RETOUR EN ARRIÈRE ═════════════════════
 *
 * Pose `resolution` sur la tuile et `linewidth` à l'échelle de l'affiche, et
 * rend de quoi tout remettre exactement comme c'était.
 *
 * ⚠️ LA RESTAURATION EST LA MOITIÉ DU TRAVAIL, PAS UNE POLITESSE. Un export
 * dure une seconde ; la carte que l'utilisateur regarde, elle, reste. Oublier
 * de rendre les valeurs laisserait des fleuves de vingt pixels de large sur
 * l'écran, jusqu'au prochain redimensionnement de fenêtre — un défaut PIRE que
 * celui qu'on corrige, parce qu'il frappe quelqu'un qui n'a rien demandé.
 *
 * @param {Array} materiaux - sortie de `materiauxDeLigne`
 * @param {object} plan
 * @param {{w:number, h:number}} plan.tuile - la taille RÉELLEMENT rendue (celle
 *   servie au compositeur, plafond matériel compris)
 * @param {number} plan.hauteurTotalePx - la hauteur de l'affiche entière
 * @param {number} [plan.hauteurMm] - sa hauteur physique ; passée, le plancher
 *   se calcule à la densité réelle du rendu (voir `dpiEffectif`)
 *
 * ⚠️ `hauteurTotalePx` ET `hauteurMm` DOIVENT DÉCRIRE LE MÊME RECTANGLE, et ce
 * rectangle est le format FINI — celui d'après la coupe, celui que l'acheteur
 * verra. C'est à cette condition, et à elle seule, que l'aperçu et le tirage
 * donnent la même épaisseur au millimètre près (test « aperçu et tirage donnent
 * la MÊME épaisseur »). Apparier les pixels AVEC fond perdu à des millimètres
 * SANS lui décale tout de 0,85 % sur un 50 × 70 : invisible, gratuit, et
 * exactement le genre d'écart qu'on ne retrouve plus une fois qu'il est là.
 * @param {number} [plan.dpi] - la densité, si on la connaît directement
 * @returns {{materiaux:number, dpi:number, plancherPx:number, restaurer:function}}
 */
export function reglerTraits(materiaux, { tuile, hauteurTotalePx, hauteurMm = 0, dpi = 0 } = {}) {
  const w = Math.max(1, Number(tuile?.w) || 0)
  const h = Math.max(1, Number(tuile?.h) || 0)
  const hTotale = Number(hauteurTotalePx) > 0 ? Number(hauteurTotalePx) : h
  // La densité, par ordre de fiabilité : celle qu'on nous donne, sinon celle
  // qu'on déduit de la taille physique, sinon celle du tirage nominal.
  const densite = dpi > 0 ? dpi : (dpiEffectif(hTotale, hauteurMm) || DPI_IMPRESSION)
  const plancher = plancherEpaisseurPx(densite)

  const avant = []
  for (const mat of materiaux || []) {
    if (!mat?.resolution) continue
    avant.push({ mat, linewidth: mat.linewidth, x: mat.resolution.x, y: mat.resolution.y })
    const relative = epaisseurRelative(mat.linewidth, mat.resolution.y)
    mat.linewidth = epaisseurExport({ relative, hauteurTotalePx: hTotale, dpi: densite })
    mat.resolution.set(w, h)
  }

  let rendu = false
  const restaurer = () => {
    // Idempotente : l'appelant la met dans un `finally`, et un `finally` peut
    // se croiser avec un chemin d'erreur qui l'a déjà appelée.
    if (rendu) return
    rendu = true
    for (const s of avant) {
      s.mat.linewidth = s.linewidth
      s.mat.resolution.set(s.x, s.y)
    }
  }
  return { materiaux: avant.length, dpi: densite, plancherPx: plancher, restaurer }
}
