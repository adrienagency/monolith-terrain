// L'ATLAS DE NORMALES — Tâche P12 du plan « LE STUDIO SUR LE GLOBE ».
//
// Module PUR : ni DOM, ni three.js, ni fetch. Tout se vérifie sous node
// (`test/atlas-normales.test.js`). Le rendu, lui, vit dans
// `src/sonde-ambiante.js`, qui n'écrit aucune de ces lois deux fois.
//
// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// > **L'agent noteur, `notation-04.md` §7-1️⃣ :** *« TOUT LE DÉPASSEMENT
// > RESTANT EST DANS L'IRRADIANCE, uniforme sur les trois canaux
// > (×1,0848 / ×1,0818 / ×1,0842). C'est un terme de gain. »*
//
// ⚡ **IL EST DANS UN SEUL DES TROIS TERMES, ET C'EST MESURÉ.** Un atlas de
// normales posé dans la page vivante (`.banc/P12/d1-irradiance.js`) rend, sur
// les 1 600 normales de la sphère, La Réunion z12, socle rallumé dans la même
// page :
//
// | terme | formule du crop | mesure du socle | rapport |
// |---|---|---|---|
// | soleil directionnel | 0,9388 | 0,9385 | ⚡ **×1,0003** |
// | lampe hémisphérique | 0,1231 | 0,1231 | ⚡ **exact** |
// | **environnement** | **1,5307** | **1,1985** | ⛔ **×1,2772** |
//
// **Les deux lampes sont justes ; l'environnement dépasse de 27,7 %.**
//
// ══════════ 1. LA CAUSE : LA SONDE NE VOYAIT QU'UNE MOITIÉ DE SPHÈRE ═══════
//
// La sonde d'origine (Tâche P3) posait une BILLE regardée de côté par une
// caméra orthographique, et régressait l'irradiance sur la coordonnée écran
// `sy`. Son argument était juste — pour une sphère unité vue ainsi, `N·haut`
// **est** `sy` — mais il ne dit rien du reste : **les normales visibles sont
// toutes celles du demi-espace `Nz > 0`**, et elles sont pondérées par l'aire
// d'ÉCRAN, qui n'est pas la mesure de la sphère.
//
// ⛔ **ET L'ENVIRONNEMENT N'EST PAS INVARIANT PAR ROTATION AUTOUR DE LA
// VERTICALE — MESURÉ, PAS SUPPOSÉ** (`.banc/P12/d3-hemisphere.js`,
// `D3-hemisphere-P12.json`). À `ndu = 0,3` l'irradiance varie de **0,7225 à
// 2,6446 selon l'azimut**, soit **146 % d'amplitude**. Les deux moitiés de
// sphère rendent donc deux droites différentes :
//
// | régression, même algèbre, même grille | ciel | sol |
// |---|---|---|
// | demi-sphère AVANT (celle que la sonde voyait) | **6,827** | 1,048 |
// | demi-sphère ARRIÈRE | ⛔ **3,133** | 1,255 |
// | *(la sonde livrée)* | *6,683* | *1,045* |
//
// ⚡ **×2,18 SUR LE TERME DE CIEL SELON LE CÔTÉ D'OÙ ON REGARDE.** La sonde
// livrée retombe à 2,2 % de la moitié AVANT : son rendu était juste, c'est son
// ÉCHANTILLONNAGE qui était faux.
//
// ══════════ 2. ET LA SECONDE FAUTE EST UNE FAUTE DE MONNAIE — LA CINQUIÈME ═
//
// ⚠️ **`ciel` ET `sol` NE SONT PAS LES COEFFICIENTS D'UN AJUSTEMENT : CE SONT
// DEUX IRRADIANCES AUX PÔLES.** L'appelant les ADDITIONNE à `hemi.color` et
// `hemi.groundColor` (`globe.js`, `poserEclairage`), et le nuanceur évalue
// `mix(sol, ciel, 0.5·ndu + 0.5)` — la loi de `getHemisphereLightIrradiance` de
// three, où `skyColor` est **par définition** l'irradiance à `ndu = +1`.
// Y verser l'extrapolation d'une droite des moindres carrés, c'est mettre une
// valeur juste dans la mauvaise monnaie : ce chantier l'a payé quatre fois.
//
// ➡️ **ON MESURE DONC EXACTEMENT LES DEUX GRANDEURS QUE LE NUANCEUR CONSOMME**,
// et rien d'autre : l'irradiance sur `(0, +1, 0)` et sur `(0, −1, 0)`.
// Deux faces, deux normales, aucun échantillonnage à biaiser.
//
// ⚡ **CE QUE ÇA VAUT, MESURÉ SUR LES NORMALES DU RELIEF** (`ndu ≥ 0,7`, là où
// vit la surface du crop) — irradiance totale, formule du crop contre mesure
// du socle : **×1,1429 avant**, **×1,0006 avec les deux pôles**, et **×0,9618**
// si l'on avait pris la droite des moindres carrés de la sphère entière.
// **Les pôles ne sont pas le choix commode : c'est le seul des trois qui
// retombe sur le socle.**
//
// ⚠️ **CE QUE ÇA NE RÈGLE PAS, ET JE LE DIS ICI :** entre les deux pôles, le
// modèle reste une DROITE, et l'irradiance vraie ne l'est pas — elle a un genou
// vers `ndu = 0` (mesurée : 0,807 à `ndu = −0,5`, 1,025 à `ndu = 0`, 1,959 à
// `ndu = +0,9`). Sur une paroi VERTICALE (`ndu ≈ 0`) la droite des pôles
// dépasse la vérité de **+40 %** là où celle des moindres carrés dépasse de
// **+17 %**. C'est la limite du modèle du NUANCEUR, pas de la sonde — la
// réserve que P8 a nommée (« `mix(sol, ciel, 0.5·ndu+0.5)` ne sait dire que
// `N·haut` ») et que le noteur a reprise. Elle est mesurée au §4 du rapport
// P12, elle n'est pas fermée.

/** Le zénith : `ndu = +1`, l'irradiance que le nuanceur appelle `ciel`. */
export const ZENITH = Object.freeze([0, 1, 0])
/** Le nadir : `ndu = −1`, l'irradiance que le nuanceur appelle `sol`. */
export const NADIR = Object.freeze([0, -1, 0])

/**
 * Les normales de l'atlas, DANS L'ORDRE DES LIGNES DU TAMPON.
 *
 * ⚠️ **`readRenderTargetPixels` REND LA LIGNE 0 EN BAS** (convention OpenGL) :
 * la bande du BAS est donc la première, et c'est celle du NADIR. Inverser les
 * deux échangerait le ciel et le sol sans qu'aucune erreur ne soit levée — le
 * bloc s'éclairerait par en dessous. `test/atlas-normales.test.js` ①c le tue.
 */
export const NORMALES_ATLAS = Object.freeze([NADIR, ZENITH])

/** Le débord des faces hors du cadre : aucun pixel n'est à couverture partielle. */
export const DEBORD = 0.2
/** Le demi-écart entre deux faces, en coordonnées de cadre. */
export const ECART = 0.05
/** Le nombre minimal de lignes écartées de part et d'autre d'une couture. */
export const MARGE_MIN = 1

/**
 * La géométrie de l'atlas : une bande horizontale par normale, empilées du bas
 * vers le haut, dans le cadre `[-1, 1]²` d'une caméra orthographique unité.
 *
 * ⚠️ **LES FACES DÉBORDENT ET SE SÉPARENT, ET LES DEUX SONT NÉCESSAIRES.** Le
 * débord met la bordure du cadre à l'INTÉRIEUR d'une face : aucun pixel lu n'a
 * une couverture partielle, donc aucun ne mélange une face avec le fond. L'écart
 * laisse entre deux faces une bande vide de `2 × ECART`, que `bandesLecture`
 * écarte : aucun pixel lu ne mélange deux normales.
 *
 * ⚠️ **L'ENROULEMENT EST DIRECT (sens trigonométrique vu de +Z)** : les faces
 * regardent la caméra, donc `gl_FrontFacing` vaut vrai et three n'inverse pas
 * la normale — ce qu'il ne ferait de toute façon qu'en `DoubleSide`, mais un
 * jour où quelqu'un poserait `side` autrement, l'atlas ne se retournerait pas.
 *
 * @param {ReadonlyArray<ReadonlyArray<number>>} normales une par bande, du bas vers le haut
 * @returns {{positions: Float32Array, normales: Float32Array, index: Uint16Array}}
 */
export function facesAtlas(normales) {
  const n = normales.length
  const pos = new Float32Array(n * 4 * 3)
  const nor = new Float32Array(n * 4 * 3)
  const idx = new Uint16Array(n * 6)
  const x0 = -1 - DEBORD
  const x1 = 1 + DEBORD
  for (let i = 0; i < n; i++) {
    const y0 = i === 0 ? -1 - DEBORD : -1 + (2 * i) / n + ECART
    const y1 = i === n - 1 ? 1 + DEBORD : -1 + (2 * (i + 1)) / n - ECART
    const q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    for (let s = 0; s < 4; s++) {
      const b = (i * 4 + s) * 3
      pos[b] = q[s][0]
      pos[b + 1] = q[s][1]
      pos[b + 2] = 0
      nor[b] = normales[i][0]
      nor[b + 1] = normales[i][1]
      nor[b + 2] = normales[i][2]
    }
    const base = i * 4
    idx.set([base, base + 1, base + 2, base, base + 2, base + 3], i * 6)
  }
  return { positions: pos, normales: nor, index: idx }
}

/**
 * Les lignes du tampon qu'on a le droit de lire, une plage par bande.
 *
 * ⚠️ **LA MARGE N'EST PAS UNE PRÉCAUTION DE STYLE, ET ELLE N'EST PAS UNE
 * CONSTANTE** : la couture entre deux faces est une bande VIDE de `2 × ECART`
 * en coordonnées de cadre, c'est-à-dire de `ECART × cote` LIGNES. Poser un
 * nombre de lignes en dur marcherait à `cote = 64` et laisserait entrer le vide
 * à `cote = 256` — la même faute de monnaie que le reste de ce chantier, en
 * plus petit. `test/atlas-normales.test.js` ②b la tue sur cinq tailles.
 *
 * ⚠️ **ET LES BORDS EXTÉRIEURS N'EN PRENNENT PAS**, parce qu'il n'y a rien à en
 * écarter : `facesAtlas` fait DÉBORDER la première et la dernière face hors du
 * cadre. Les deux fonctions portent donc la même distinction `i === 0` /
 * `i === n - 1`, et c'est ce qui les APPARIE.
 *
 * @param {number} bandes le nombre de faces
 * @param {number} cote le côté du tampon, en pixels
 * @param {number} ecart le demi-écart entre faces, en coordonnées de cadre
 * @returns {Array<{debut:number, fin:number}>} lignes INCLUSES, du bas vers le haut
 */
export function bandesLecture(bandes, cote, ecart = ECART) {
  const marge = Math.ceil((cote * Math.max(0, ecart)) / 2) + MARGE_MIN
  const out = []
  for (let i = 0; i < bandes; i++) {
    out.push({
      debut: i === 0 ? 0 : Math.ceil((cote * i) / bandes) + marge,
      fin: i === bandes - 1 ? cote - 1 : Math.floor((cote * (i + 1)) / bandes) - 1 - marge,
    })
  }
  return out
}

/**
 * L'irradiance d'une bande : `E = π · (blanc − noir)`, moyennée sur la plage.
 *
 * ⚠️ **`albédo × E / π` EST LA SORTIE, DONC `E = π × SORTIE` À ALBÉDO 1** —
 * `BRDF_Lambert` de three. Et la soustraction du rendu à albédo NOIR retire le
 * spéculaire, qui ne s'annule pas à `roughness = 1` : `F0 = 0,04` en renvoie
 * **4,0 %** sur le socle (mesure de P3).
 *
 * ⚡ **ET ELLE RETIENT AUSSI, SANS LE CHERCHER, LE FACTEUR QUI COMPTE VRAIMENT :**
 * three atténue le diffus INDIRECT par `1 − max(totalScattering)`
 * (`RE_IndirectSpecular_Physical`), soit **0,9835** à `F0 = 0,04`. Ce facteur est
 * dans le blanc ET absent du noir, donc il SURVIT à la soustraction — et c'est
 * exactement ce qu'il faut, puisque le relief du socle le subit lui aussi.
 * ⚠️ **Poser `specularIntensity = 0` sur la sonde aurait rendu l'irradiance
 * « pure » et le crop serait ressorti 1,7 % trop clair.**
 *
 * @param {Float32Array|number[]} blanc RGB linéaire, 3 par pixel, ligne 0 en bas
 * @param {Float32Array|number[]} noir le même rendu, albédo noir
 * @param {number} cote côté du tampon
 * @param {{debut:number, fin:number}} bande
 * @returns {number[]} l'irradiance linéaire, trois canaux
 */
export function irradianceBande(blanc, noir, cote, bande) {
  const s = [0, 0, 0]
  let n = 0
  for (let ligne = bande.debut; ligne <= bande.fin; ligne++) {
    for (let col = 0; col < cote; col++) {
      const i = (ligne * cote + col) * 3
      for (let k = 0; k < 3; k++) s[k] += Math.max(0, (blanc[i + k] - noir[i + k]) * Math.PI)
      n++
    }
  }
  if (n === 0) return [0, 0, 0]
  return [s[0] / n, s[1] / n, s[2] / n]
}

/**
 * L'écart maximal, en relatif, entre les pixels d'une bande.
 *
 * ⚠️ **C'EST LE TÉMOIN DE LA MESURE, ET IL N'EST PAS DÉCORATIF.** Tous les
 * pixels d'une bande portent la MÊME normale : ils doivent rendre le MÊME
 * nombre. Un écart non nul dit qu'un pixel de couture, de bord ou de fond est
 * entré dans la moyenne — c'est-à-dire que la sonde ne mesure pas ce qu'elle
 * croit. `coefAmbiante` le publie, et `test/atlas-normales.test.js` ③b le tue
 * en glissant un pixel étranger dans la plage.
 */
export function dispersionBande(blanc, noir, cote, bande) {
  let mn = Infinity
  let mx = -Infinity
  for (let ligne = bande.debut; ligne <= bande.fin; ligne++) {
    for (let col = 0; col < cote; col++) {
      const i = (ligne * cote + col) * 3
      let v = 0
      for (let k = 0; k < 3; k++) v += Math.max(0, (blanc[i + k] - noir[i + k]) * Math.PI)
      v /= 3
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
  }
  if (!(mx > 0)) return 0
  return (mx - mn) / mx
}
