// LA SONDE MATÉRIELLE — ce que CETTE machine-ci peut vraiment imprimer.
//
// Module PUR au sens qui compte : il ne connaît ni le DOM ni three.js. Il reçoit
// des ESSAIS — des fonctions qui allouent pour de vrai et rendent un booléen —
// et il rend un nombre et une grille de formats. Les essais, eux, sont branchés
// dans main.js, où vivent le renderer et le document. C'est ce qui permet de
// tester la sonde sur des limites SIMULÉES, sous node, sans GPU.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI DEMANDER À LA MACHINE PLUTÔT QU'À SA FICHE TECHNIQUE
// ═══════════════════════════════════════════════════════════════════════════
//
// `MAX_RENDERBUFFER_SIZE` est une PROMESSE, pas un contrat. Le pilote annonce
// 8 192 et alloue ce qu'il peut ; un canevas 2D de 12 Mpx est refusé EN SILENCE
// sur iOS (le contexte existe, il est vide) ; une cible de rendu peut naître
// incomplète sans lever une exception. Les trois défauts se ressemblent : rien
// ne casse, on obtient une image, et elle est fausse. Et on ne le découvre
// qu'après le tirage payé.
//
// D'où trois gestes, dans cet ordre :
//   ① on LIT les deux plafonds déclarés, et on garde le plus petit ;
//   ② on en déduit un plafond de MÉMOIRE, que le § suivant explique ;
//   ③ on ALLOUE vraiment — une cible de tuile, un canevas de bande — et on
//      relit un pixel de chacun. Une image suffit : ce qu'on cherche n'est pas
//      une vitesse, c'est un refus.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ `degradePour` NE COUVRE PAS LA MÉMOIRE, ET C'EST LE PIÈGE DE CE MODULE
// ═══════════════════════════════════════════════════════════════════════════
//
// `export-dpi.js` prend UN SEUL nombre — un côté maximal — et il ne traite que
// le rabotage silencieux du tampon de rendu. Le pic mémoire d'un tirage, lui,
// vient d'ailleurs : de la tuile (constante, 2 048²) et du CANEVAS DE BANDE, qui
// fait toute la largeur de l'affiche. La tâche 6 l'a mesuré — 178 Mo sur un A2
// paysage.
//
// La conversion est donc directe, et c'est ce qui permet de ne pas toucher à
// `export-dpi.js` : à hauteur de bande fixée (le côté de tuile), le pic mémoire
// est une fonction AFFINE DE LA LARGEUR de l'affiche. Un budget d'octets se
// retourne donc en une largeur maximale — c'est-à-dire exactement la même
// espèce de nombre que le plafond du pilote. On les compare, on garde le plus
// petit, et `degradePour` reçoit un seul nombre comme il l'a toujours voulu.
//
// Le prix de cette simplicité, dit franchement : le plafond mémoire est appliqué
// aux DEUX côtés, alors que seule la largeur pèse. C'est conservateur — sur un
// portrait, on refuse une hauteur qui serait passée. L'erreur va donc dans le
// sens « on dégrade un peu trop », jamais dans le sens « on promet ce qu'on ne
// peut pas rendre », et c'est le seul sens acceptable ici.

import { FORMATS_AFFICHE, geometriePage, poidsRendu } from './print-page.js'
import { COTE_TUILE, DPI_NOMINAL, degradePour, dpiPour } from './export-dpi.js'

/**
 * Le côté de la cible qu'on alloue pour de vrai. C'est celui du pavage
 * (`COTE_TUILE`), et il n'y a pas d'autre choix raisonnable : sonder plus grand
 * refuserait des machines qui savent imprimer, sonder plus petit ne prouverait
 * rien de ce qu'on va leur demander.
 */
export const COTE_SONDE = COTE_TUILE

/**
 * La part de la mémoire de l'appareil qu'un tirage a le droit de prendre en
 * pointe.
 *
 * ⚠️ UN HUITIÈME, PAS LA MOITIÉ. `navigator.deviceMemory` annonce la RAM de la
 * machine, pas ce que l'onglet peut en prendre : le navigateur, les autres
 * onglets, la scène 3D déjà chargée et le système sont déjà dedans. Un huitième
 * de 8 Go fait 1 Go, ce qui laisse cinq fois le pic mesuré du pire format.
 */
export const PARTS_MEMOIRE = 8

/**
 * Le budget plancher, en octets, quel que soit ce que l'appareil raconte.
 *
 * 256 Mo : au-dessus du pic mesuré du pire format (178 Mo, A2 paysage, tâche 6)
 * avec une marge d'un tiers. En dessous de ce plancher, on ne dégraderait pas
 * un format, on l'effacerait — et un appareil qui ne peut vraiment pas tenir
 * 256 Mo échouera de toute façon aux essais du § ③, qui eux ne se devinent pas.
 */
export const BUDGET_PLANCHER_OCTETS = 256e6

/**
 * La mémoire supposée quand l'appareil ne la dit pas.
 *
 * ⚠️ `navigator.deviceMemory` N'EXISTE PAS DANS SAFARI ni dans Firefox — c'est
 * le cas le plus fréquent, pas le cas rare. Supposer 8 Go y serait optimiste ;
 * supposer 1 Go retirerait des formats à des machines qui les tiennent. 4 Go
 * donne un budget de 512 Mo, soit trois fois le pic mesuré : assez pour ne
 * jamais mordre sur une machine ordinaire, assez bas pour que l'essai réel
 * reste le juge sur une machine faible.
 */
export const MEMOIRE_DEFAUT_GO = 4

/**
 * Combien de fois la bande brute compte dans le pic.
 *
 * Deux : le canevas de bande lui-même, et ce qui vit en même temps que lui — la
 * tranche d'`ImageData` de la réapplication des effets (plafonnée à 2 Mpx par le
 * compositeur) puis le PNG encodé, avant que la bande suivante s'alloue. C'est
 * un majorant, pas une mesure ; il est là pour être conservateur.
 */
export const FACTEUR_BANDE = 2

/**
 * Les deux plafonds déclarés par le pilote, réduits au plus petit.
 *
 * ⚠️ LES DEUX, PAS L'UN. Une tuile est rendue dans un tampon (renderbuffer) puis
 * lue comme une texture : la chaîne casse au premier des deux qui plafonne, et
 * ils diffèrent sur une partie du parc. C'est le nombre que la tâche 1 réclame
 * pour `degradePour`.
 *
 * @param {object} gl - un contexte WebGL
 * @returns {number} 0 si le contexte ne répond pas — et 0 veut dire « on ne sait
 *   pas », donc « on ne promet rien » : `degradePour` rend `null` sur 0.
 */
export function limiteGL(gl) {
  if (!gl || typeof gl.getParameter !== 'function') return 0
  const lire = (nom) => {
    try {
      const v = gl.getParameter(gl[nom])
      return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
    } catch {
      return 0
    }
  }
  const texture = lire('MAX_TEXTURE_SIZE')
  const tampon = lire('MAX_RENDERBUFFER_SIZE')
  // Un seul des deux manquant, c'est un contexte qu'on ne comprend pas : on ne
  // le complète pas avec l'autre, on rend 0.
  if (!texture || !tampon) return 0
  return Math.min(texture, tampon)
}

/**
 * Le budget mémoire d'un tirage, en octets.
 *
 * @param {number} [memoireGo] - `navigator.deviceMemory`, ou rien
 */
export function budgetMemoire(memoireGo) {
  const go = typeof memoireGo === 'number' && Number.isFinite(memoireGo) && memoireGo > 0
    ? memoireGo
    : MEMOIRE_DEFAUT_GO
  return Math.max(BUDGET_PLANCHER_OCTETS, (go * 1e9) / PARTS_MEMOIRE)
}

/**
 * Le budget mémoire, retourné en côté maximal d'affiche.
 *
 * pic ≈ octets de la tuile (constants) + FACTEUR_BANDE × largeur × côté × 4
 * ⇒ largeur ≤ (budget − tuile) / (FACTEUR_BANDE × côté × 4)
 *
 * @returns {number} 0 si même une affiche d'un pixel de large ne tient pas
 */
export function limiteDepuisMemoire({ budgetOctets, cote = COTE_SONDE } = {}) {
  const c = Math.max(1, Math.round(cote))
  // `poidsRendu` est la fonction qui a justifié le pavage : c'est elle qui dit
  // ce qu'une tuile coûte, et la recopier ici en donnerait une seconde version.
  // Sa part `pleine` ne nous concerne pas — la composition bande par bande l'a
  // supprimée (tâche 6), on ne garde que `tuile`.
  const { tuile } = poidsRendu({ totalPx: [1, 1], tuilePx: [c, c], echantillons: 4 })
  const reste = budgetOctets - tuile
  if (!(reste > 0)) return 0
  return Math.floor(reste / (FACTEUR_BANDE * c * 4))
}

/**
 * La grille des formats pour une limite donnée : ce qu'on peut vendre, et à
 * quelle densité.
 *
 * ⚠️ DÉGRADER D'ABORD, CACHER ENSUITE — la règle d'Adrien, et c'est
 * `degradePour` qui la tient. Ici on ne fait que l'appeler dans les DEUX
 * orientations et rapporter ce qui en sort : un format n'est retiré de la grille
 * que si aucune de ses deux orientations ne passe, même au plancher de 150 dpi.
 *
 * @param {object} o
 * @param {number} o.limitePx - le côté maximal admis, tous plafonds confondus
 * @param {Array} [o.formats]
 * @returns {Array<{id, label, portrait, paysage, dispo, degrade}>}
 */
export function grilleAffiche({ limitePx, formats = FORMATS_AFFICHE } = {}) {
  return formats.map((f) => {
    const portrait = degradePour(f.id, 'portrait', limitePx)
    const paysage = degradePour(f.id, 'paysage', limitePx)
    const nominal = dpiPour(f.id)
    // « dégradé » se dit d'une orientation qui existe mais sous sa densité
    // nominale : c'est ce qu'on annonce à l'acheteur, pas un état interne.
    const degrade = [portrait, paysage].some((r) => r && nominal && r.dpi < nominal)
    return {
      id: f.id,
      label: f.label,
      portrait,
      paysage,
      dispo: !!(portrait || paysage),
      degrade,
    }
  })
}

/** La ligne d'un format dans la grille, ou `null`. */
export function ligneFormat(grille, id) {
  return grille?.find((g) => g.id === id) || null
}

/**
 * La densité retenue pour (format, orientation), ou `null` si ce couple ne se
 * rend pas sur cette machine.
 */
export function dpiRetenu(grille, id, orientation = 'portrait') {
  const l = ligneFormat(grille, id)
  return l?.[orientation === 'paysage' ? 'paysage' : 'portrait']?.dpi ?? null
}

/**
 * Le premier couple (format, orientation) jouable, en partant de celui qu'on
 * voulait.
 *
 * ⚠️ ON GARDE LE FORMAT AVANT DE GARDER LE SENS. Un acheteur qui a choisi un
 * 50 × 70 tient à ses proportions ; le sens, il vient de le voir à l'écran et il
 * le rechoisira. Retomber sur un A4 paysage parce que le 50 × 70 portrait ne
 * passe pas serait lui changer son affiche.
 */
export function replierSur(grille, id, orientation = 'portrait') {
  const autre = orientation === 'paysage' ? 'portrait' : 'paysage'
  const l = ligneFormat(grille, id)
  if (l?.[orientation]) return { format: id, orientation }
  if (l?.[autre]) return { format: id, orientation: autre }
  for (const g of grille || []) {
    if (g[orientation]) return { format: g.id, orientation }
    if (g[autre]) return { format: g.id, orientation: autre }
  }
  return null
}

/**
 * La plus grande bande qu'un tirage ouvrira, d'après une grille.
 *
 * C'est la largeur à SONDER : c'est ce canevas-là qui est refusé en silence sur
 * les appareils qui refusent en silence, et c'est le seul de la chaîne dont la
 * taille ne soit pas connue d'avance.
 */
export function largeurBandeMax(grille) {
  let max = 0
  for (const g of grille || []) {
    for (const sens of ['portrait', 'paysage']) {
      const r = g[sens]
      if (r) max = Math.max(max, r.px[0])
    }
  }
  return max
}

/**
 * ═══════════ LA SONDE ═══════════════════════════════════════════════════════
 *
 * Lit les plafonds, en déduit un budget, puis ALLOUE — une cible de tuile, un
 * canevas de bande — et relit un pixel de chacun.
 *
 * ⚠️ LES ESSAIS SONT INJECTÉS, ET C'EST TOUT L'INTÉRÊT. `essaiCible(cote)` et
 * `essaiToile(largeur, hauteur)` rendent `true` quand l'allocation a tenu ET que
 * le pixel relu est celui qu'on a écrit. Sous node, le test les simule ; en
 * production, main.js les branche sur le vrai renderer et le vrai document. La
 * sonde elle-même n'a donc aucune branche « si on est dans un test ».
 *
 * @param {object} o
 * @param {object} [o.gl] - le contexte WebGL, pour ① seulement
 * @param {number} [o.memoireGo] - `navigator.deviceMemory`
 * @param {function} [o.essaiCible] - `(cote) => boolean`
 * @param {function} [o.essaiToile] - `(largeur, hauteur) => boolean`
 * @param {number} [o.cote]
 * @returns {object} `{ limitePx, limiteGL, limiteMemoire, budgetOctets, cible,
 *   toile, largeurBandeSondee, grille, raison }`
 */
export function sonderMateriel({
  gl = null,
  memoireGo = undefined,
  essaiCible = null,
  essaiToile = null,
  cote = COTE_SONDE,
} = {}) {
  const gpu = limiteGL(gl)
  const budgetOctets = budgetMemoire(memoireGo)
  const memoire = limiteDepuisMemoire({ budgetOctets, cote })
  const brute = Math.min(gpu || 0, memoire || 0)

  const sortie = {
    limiteGL: gpu,
    limiteMemoire: memoire,
    budgetOctets,
    cible: null,
    toile: null,
    largeurBandeSondee: 0,
    limitePx: 0,
    grille: [],
    raison: null,
  }

  if (!(brute > 0)) {
    sortie.raison = gpu > 0 ? 'mémoire insuffisante' : 'plafonds matériels illisibles'
    sortie.grille = grilleAffiche({ limitePx: 0 })
    return sortie
  }

  // ③a — la cible d'une tuile. Si elle ne s'alloue pas, rien de ce chantier ne
  // s'alloue : 2 048 est le plancher garanti de WebGL2, et le pavage entier est
  // bâti dessus. On ne cherche pas plus petit, on renonce.
  if (essaiCible) {
    sortie.cible = !!safe(() => essaiCible(cote))
    if (!sortie.cible) {
      sortie.raison = `cible ${cote}² refusée`
      sortie.grille = grilleAffiche({ limitePx: 0 })
      return sortie
    }
  }

  // ③b — le canevas de bande, à la largeur que le plus grand format retenu
  // demanderait vraiment. On l'essaie, et s'il est refusé on redescend : moitié,
  // puis le côté de tuile. Trois essais au plus — la sonde doit coûter une
  // image, pas une seconde.
  const provisoire = grilleAffiche({ limitePx: brute })
  const voulue = Math.min(brute, largeurBandeMax(provisoire) || brute)
  // Sans essai branché, on n'a rien mesuré : la limite reste celle des plafonds
  // déclarés. La rabattre sur la plus grande bande utile ne changerait pas la
  // grille, mais ferait dire à `limitePx` qu'on a vérifié quelque chose.
  let retenue = brute
  if (essaiToile) {
    const candidats = [voulue, Math.floor(voulue / 2), cote].filter((v, i, a) => v >= cote && a.indexOf(v) === i)
    retenue = 0
    for (const largeur of candidats) {
      if (safe(() => essaiToile(largeur, cote))) { retenue = largeur; break }
    }
    sortie.toile = retenue > 0
    sortie.largeurBandeSondee = retenue
    if (!retenue) {
      sortie.raison = `canevas de bande refusé jusqu'à ${cote} px`
      sortie.grille = grilleAffiche({ limitePx: 0 })
      return sortie
    }
  }

  sortie.limitePx = Math.min(brute, retenue)
  sortie.grille = grilleAffiche({ limitePx: sortie.limitePx })
  if (!sortie.grille.some((g) => g.dispo)) sortie.raison = 'aucun format ne tient sur cette machine'
  return sortie
}

// Un essai qui lève est un essai qui échoue : c'est le sens de la sonde, et
// laisser l'exception remonter ferait perdre l'écran entier pour un pilote
// grognon.
function safe(fn) {
  try { return !!fn() } catch { return false }
}

// Réexporté pour que l'appelant n'ait pas à importer deux modules pour dire
// « cette densité-là est la nominale » — la table, elle, reste dans export-dpi.js.
export { DPI_NOMINAL, geometriePage }
