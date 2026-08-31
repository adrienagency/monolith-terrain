// LE CARTOUCHE DANS L'ESPACE DU GLOBE — Tâche D16-c.
//
// Module PUR : ni DOM, ni three.js, ni état, ni réseau. Il rend des tableaux de
// nombres. Tout se vérifie sous node (`test/cartouche-globe.test.js`).
//
// ══════════ 0. CE QUE LA CARTE DE D16-b ANNONÇAIT, ET CE QUI EST VRAI ═══════
//
// ⛔ **LA CARTE DE D16-b DIT, POUR `ground-info` : « posé en unités de bloc à la
// surface : demande un échantillonneur de sol de GLOBE ». C'EST FAUX, ET ÇA
// RACCOURCIT LA TÂCHE D'AUTANT.**
//
// Le cartouche n'est PAS posé sur le relief. Il est posé sur **la BASE** — le
// plan horizontal unique que `GroundInfoLayer` lit par `getBaseY()`, et sur
// lequel il couche TOUS ses plans, du titre à la rose des vents
// (`ground-info-layer.js`, `_addPlaneAt` : `mesh.position.set(x, getBaseY() +
// 0.05, z)`). Un plan, une hauteur, la même pour les huit mailles. **Il ne
// demande donc aucun échantillonnage de hauteurs, ni de bloc ni de globe** : il
// lui faut UN nombre, le niveau de la base, et le repère où le poser.
//
// ⚡ **ET LE GLOBE A DÉJÀ LES DEUX.** Il a des parois de crop
// (`monde/parois-crop.js`), donc une base — `globe._baseYCrop`, en unités de
// GLOBE ; et il a le repère, parce que la similitude de `frontiere-rendu.js` y
// envoie déjà la caméra à chaque image.
//
// ══════════ 1. LE REPÈRE DU CROP EST L'IMAGE DU REPÈRE DU BLOC ══════════════
//
// ⚠️ **CE N'EST PAS UNE HYPOTHÈSE : C'EST MESURÉ, AU NAVIGATEUR, LE 2026-08-31.**
// La Réunion, mode sphère par défaut, `?` sans paramètre. `poseFond` appelée sur
// l'ORIGINE DU BLOC (`positionBloc: [0,0,0]`, `origineBloc: [0,0,0]`, quaternion
// identité) et comparée au repère du maillage `crop-parois` déjà posé :
//
//   |                | `poseFond` (origine du bloc)         | `globe._parois`                     |
//   |----------------|--------------------------------------|-------------------------------------|
//   | position       | 77,05483557224011 · −36,241237327491284 · 52,43209925138888 | 77,05483557224011 · −36,24123732749129 · 52,43209925138887 |
//   | quaternion     | 0,7295304024548144 · 0,2640562864582355 · −0,38599427266680136 · 0,49906722086751987 | 0,7295304024548144 · 0,2640562864582355 · −0,3859942726668014 · 0,4990672208675199 |
//
// **Identiques à l'epsilon du double.** Et l'échelle se recoupe par un troisième
// chemin : `k = 0,007667070940797353`, donc le demi-bloc `28 × k = 0,2146780`,
// quand la boîte englobante du maillage `crop-parois` mesure **0,2144811 /
// 0,2146865** en x. C'est la même transformation, prise par les deux bouts.
//
// ➡️ **Le relogement du cartouche est donc UNE similitude appliquée à UN
// groupe** — pas une couche à réécrire en coordonnées de globe. Les tailles de
// texte, les distances au bord, l'anneau de sécurité, la rose des vents : tout
// est porté par `echelle`, ensemble, une seule fois.
//
// ══════════ 2. ⛔ LA CONVERSION QUI MANQUE, ET CELLE QU'ON N'INVENTE PAS ═════
//
// ⚠️ **LA SEULE GRANDEUR QUI NE TRAVERSE PAS PAR `echelle` EST LE NIVEAU DE LA
// BASE**, et c'est parce qu'elle n'a pas la même origine des deux côtés :
//
//   · côté bloc, `plinth.baseY` = le minimum du relief du BLOC PLAT moins la
//     profondeur du socle — mesuré **−17,4074** à La Réunion ;
//   · côté globe, `_baseYCrop` = le minimum du relief du CROP moins sa
//     profondeur, dans l'exagération du GLOBE — mesuré **−0,1199794** unité de
//     globe, soit **−15,6489** unités de bloc.
//
// **1,76 unité de bloc d'écart, soit 11 % de la profondeur du crop.** Transporter
// `plinth.baseY` tel quel poserait donc le cartouche sous le fond du crop, où il
// se verrait flotter dès qu'on baisse la caméra. On prend la base du CROP, et on
// la ramène en unités de bloc — parce que c'est en unités de bloc que
// `GroundInfoLayer` écrit toute sa mise en page, et qu'il n'a aucune raison
// d'apprendre un second système.
//
// ⛔ **ET LE SENS DE LA DIVISION EST LE PIÈGE DE CE CHANTIER.** `k` vaut ici
// 0,00767 : diviser rend −15,6, multiplier rendrait −0,00092 — un cartouche
// collé au ras du relief. Aux zooms continentaux `1/k` dépasse 3 700 ; c'est la
// classe de défaut « facteur 121,6 / facteur 130,4 » de ce chantier, et le test
// la tue par une mutation explicite.

import { poseFond } from './frontiere-rendu.js'

const IDENTITE = [0, 0, 0, 1]

/**
 * Le repère où poser le groupe du cartouche, dans l'espace du GLOBE.
 *
 * C'est l'image du repère du BLOC par la similitude de `frontiere-rendu.js`,
 * ancrée sur l'origine du bloc — donc exactement le repère du crop (§1).
 *
 * @param {object} o
 * @param {number} o.lat latitude de l'ORIGINE du bloc (pas de la cible caméra :
 *   c'est le crop qu'on suit, et le crop est posé sur le centre du bloc)
 * @param {number} o.lon longitude de la même origine
 * @param {number} o.extentMeters l'emprise RÉELLE du bloc affiché, en mètres
 * @param {number} o.span `TERRAIN_SIZE`, en unités de bloc
 * @returns {{position: number[], quaternion: number[], echelle: number}}
 *   `echelle` est le nombre d'unités-globe par unité-bloc : **une seule
 *   homothétie porte toutes les longueurs du cartouche.**
 */
export function ancrageCartouche({ lat, lon, extentMeters, span }) {
  const p = poseFond({
    lat,
    lon,
    positionBloc: [0, 0, 0],
    quaternionBloc: IDENTITE,
    origineBloc: [0, 0, 0],
    extentMeters,
    span,
  })
  return { position: p.position, quaternion: p.quaternion, echelle: p.k }
}

/**
 * LE NIVEAU DE LA BASE, RAMENÉ EN UNITÉS DE BLOC.
 *
 * ⚠️ **C'est la seule conversion d'espace que le cartouche porte à la main** —
 * tout le reste passe par `echelle` (§2).
 *
 * @param {number} baseYCropGlobe `globe._baseYCrop`, en unités de GLOBE
 * @param {number} echelle le `k` d'`ancrageCartouche`
 * @param {number} repli la base du bloc plat, servie tant que le crop n'est pas
 *   posé (premières images, retour d'orbite) — en unités de bloc, déjà
 * @returns {number} en unités de BLOC, prêt pour `GroundInfoLayer.getBaseY`
 */
export function baseCartoucheEnBloc(baseYCropGlobe, echelle, repli) {
  if (!Number.isFinite(baseYCropGlobe) || !(echelle > 0)) return repli
  return baseYCropGlobe / echelle
}
