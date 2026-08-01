// LE CHAMP DE LA MER SUR L'EMPRISE 3×3 — les règles de lecture, pures.
//
// Module PUR : ni DOM, ni three.js, ni état. Testable en node.
//
// ══════════ LE PROBLÈME QU'IL RÉSOUT ═══════════════════════════════════════
//
// `ocean.js` cuit un champ (R = altitude du sol, G = distance au rivage) et le
// lit dans ses quatre shaders en `uv = xz / 56 + 0.5` — 56 étant la largeur du
// socle, écrite EN DUR quatre fois dans le GLSL (étude 3×3 §5.2).
//
// En mode continu la géométrie de la mer ne bouge pas, mais le relief DÉFILE
// dessous : le sol affiché en `x` est celui du monde en `x + fenêtre`. Un champ
// cuit sur les 56 unités du socle et lu sans décalage dit donc, à chaque pas de
// défilement, la profondeur d'un AUTRE endroit.
//
// MESURÉ AVANT CORRECTION, La Réunion −21,13 / 55,53 z13, sur les texels mêmes
// que le GPU échantillonne (demi-flottants décodés, sonde `mer-suivi.mjs`) :
//
//   fenêtre        écart fond/relief     mer vue par le champ / mer réelle
//   (0, 0)            0,03 unité          0 %  /  0 %
//   (20, 20)          3,90 unités         0 %  /  0 %
//   (56, −56)        14,34 unités        **0 %  /  9,2 %**  (max 31,3 unités)
//
// À la butée sud-est, un neuvième de la fenêtre est de la haute mer et le champ
// de la mer n'en voit RIEN. C'est ce que rapporte Adrien : « la mer, les
// rivières et la jupe ne suivent pas du tout le déplacement ».
//
// ══════════ LA CORRECTION, EN UNE LIGNE ════════════════════════════════════
//
// Cuire le champ sur l'EMPRISE ENTIÈRE (168 unités) et le lire avec le décalage
// de fenêtre : `uv = (xz + fenêtre) / 168 + 0.5`. Le champ ne bouge plus jamais
// — c'est la LECTURE qui se déplace, exactement comme le relief (`terrain.js`
// `_makeDemSampler` échantillonne en `x + fen.x`).
//
// Coût : une texture 1152² RG demi-flottante, soit 5,3 Mo, cuite une fois par
// reconstruction. AUCUN travail par image : deux flottants d'uniforme.
//
// ══════════ POURQUOI CE MODULE EXISTE SÉPARÉMENT ═══════════════════════════
//
// `ocean.js` tire three.js : rien de ce qu'il contient n'est testable en node.
// Les trois règles ci-dessous sont exactement celles qui peuvent se tromper en
// silence (un demi-texel, un signe, un bord), et ce sont les seules du chantier
// qui ne demandent ni GPU ni MNT pour être vérifiées.

// Résolution du champ pour UN socle. Doit rester égale à `FIELD_RES` d'ocean.js
// — le test le verrouille en relisant le fichier, faute de pouvoir l'importer.
export const CHAMP_RES = 384

/**
 * Résolution du champ pour une emprise de `cote` socles de large.
 *
 * ⚠️ MULTIPLICATIVE, PAS CONSTANTE. Garder 384 sur 168 unités diviserait par
 * trois la densité de texels : la bande de ressac de `shoreSurf` vit entre 0,3
 * et 3,3 unités du rivage, elle ne tiendrait plus que sur sept texels et
 * l'escalier se verrait sur toute la côte. Le prix est linéaire en surface —
 * 1152² au lieu de 384², soit 5,3 Mo au lieu de 0,6.
 */
export function resChamp(cote) {
  return CHAMP_RES * (cote > 1 ? cote : 1)
}

/**
 * Largeur au sol du champ, en unités monde.
 * @param {number} taille - largeur d'un socle (TERRAIN_SIZE)
 * @param {number} cote - côté de l'emprise en socles (1 hors mode continu)
 */
export function spanChamp(taille, cote) {
  return taille * (cote > 1 ? cote : 1)
}

/**
 * UV de lecture du champ pour un point de la géométrie.
 *
 * @param {number} x - abscisse du point, en coordonnées de CHAMP (monde absolu
 *   sur l'emprise). L'appelant convertit : la mer et sa jupe sont dessinées en
 *   coordonnées de fenêtre, elles ajoutent le décalage ; les lacs sont cuits en
 *   coordonnées de champ, ils n'ajoutent rien (c'est leur groupe qui translate).
 * @param {number} z
 * @param {number} span - largeur du champ (spanChamp)
 * @returns {{u:number,v:number}}
 *
 * ⚠️ LE RÉSULTAT PEUT SORTIR DE [0,1], ET C'EST VOULU. La butée élastique
 * laisse déborder d'un huitième de socle (7 unités) au-delà de la course : au
 * coin de la fenêtre on lit jusqu'à 91 unités du centre, pour un champ qui n'en
 * couvre que 84. Les textures du champ sont en `ClampToEdgeWrapping` (le défaut
 * de three), donc la lecture se colle au bord — EXACTEMENT comme `sampleDem`
 * clampe le relief au même endroit. Les deux restent d'accord ; un `RepeatWrapping`
 * ferait au contraire apparaître la mer du bord opposé, en couture franche.
 */
export function uvChamp(x, z, span) {
  return { u: x / span + 0.5, v: z / span + 0.5 }
}

/**
 * Coordonnée monde du texel `i` d'un champ de `n` texels sur `span` unités.
 *
 * Convention retenue : les texels 0 et n−1 tombent PILE sur les deux bords du
 * champ (pas de demi-texel). C'est celle qu'`ocean.js` employait déjà pour le
 * socle seul, et c'est elle qui rend `uvChamp` exactement inverse — voir le test
 * d'aller-retour, qui est la seule preuve que la mer se pose sur son relief.
 */
export function mondeTexel(i, n, span) {
  return (i / (n - 1) - 0.5) * span
}

/**
 * Le décalage à AJOUTER aux coordonnées de la géométrie pour obtenir celles du
 * champ, selon que la géométrie appartient à la fenêtre ou au monde.
 *
 * ⚠️ LES DEUX CAS EXISTENT DANS LE MÊME FICHIER, ET LES CONFONDRE EST MUET.
 * La surface de mer et sa jupe sont taillées sur le socle : elles restent en
 * place et voient défiler le champ, donc elles ajoutent la fenêtre. Un lac est
 * taillé sur son emprise géographique : il défile avec le terrain (son groupe
 * porte la translation −fenêtre), donc il lit son champ SANS décalage. Une
 * inversion de ce choix donne un lac qui glisse à double vitesse — visible, mais
 * seulement sur les zones à lacs, donc facile à ne pas voir en développement.
 */
export function decalageChamp(ancrage, fx, fz) {
  return ancrage === 'monde' ? { x: 0, z: 0 } : { x: fx, z: fz }
}
