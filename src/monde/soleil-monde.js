// LE SOLEIL DE LA PLANÈTE — Tâche R7 du chantier « une seule Terre ».
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il se vérifie sous node
// (`test/soleil-heure-monde.test.js`).
//
// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// ⛔ **LA PLANÈTE NE LISAIT PAS L'HEURE : ELLE LISAIT LA CAMÉRA.** `main.js`
// reposait, à chaque image et dans les DEUX modes :
//
//     _orbSun.copy(cam.position).normalize().applyAxisAngle(_upY, -0.73)
//     globe.setSunDir(_orbSun)
//
// Le motif est écrit dans le dépôt et il est bon **pour une planète qu'on
// regarde** : « un soleil de scène laisserait la moitié du fond dans la nuit ».
// Il devient faux dès que la planète est le DÉCOR d'un bloc éclairé par
// l'horloge — c'est-à-dire sous `?terre=unique`, exactement le cas que la
// Tâche P3 a corrigé pour le crop et laissé pour le fond.
//
// **Relevé au banc R7** (Chrome sans tête, 1280×800, `readPixels` sur le tampon
// composé, La Réunion, caméra IMMOBILE, seule l'horloge bouge) :
//
//   | heure  | élévation vue par le CROP | élévation vue par la PLANÈTE |
//   |--------|---------------------------|------------------------------|
//   | 00h00  | +40,02°                   | **+51,60°**                  |
//   | 03h22  | +40,01°                   | **+51,60°**                  |
//   | 06h00  | +15,14°                   | **+51,60°**                  |
//   | 09h00  | +34,32°                   | **+51,60°**                  |
//   | 12h00  | +57,16°                   | **+51,60°**                  |
//   | 15h00  | +35,56°                   | **+51,60°**                  |
//   | 18h00  | +12,32°                   | **+51,60°**                  |
//   | 21h00  | +39,99°                   | **+51,60°**                  |
//
// `uSunDir` est **identique au bit près** aux huit heures : (0,23049 ·
// −0,36868 · 0,90053). L'épreuve inverse — horloge figée à 12 h, caméra tournée
// de 60° en 60° — le fait parcourir **−66,5° à +38,8°**.
//
// ══════════ 1. ⚠️ LA MONNAIE DE L'ÉLÉVATION, ET C'EST TOUT LE FICHIER ═══════
//
// `daycycle.lightingFor` rend DEUX élévations dans le même objet :
//
//   · `sunElevation` — l'élévation ASTRONOMIQUE, **−26,12° à 03h22** au lieu
//     filmé. C'est elle, et elle seule, qui dit de quel côté du terminateur on
//     est.
//   · `elevation`    — l'élévation de la LAMPE, `lightElevationFor(sunElevation)`,
//     relevée par plancher à **+40°** la nuit, « so the moon shines from above »
//     (`main.js`, `placeSun`). C'est celle que `params.sunElevation` porte, et
//     c'est la BONNE pour modeler le relief : le socle et le crop la prennent
//     tous les deux, et ils ont raison de le faire.
//
// ⛔ **DONNER `params.sunElevation` À LA PLANÈTE RENDRAIT LE PLEIN JOUR À 3 h DU
// MATIN.** Une grandeur juste, dans la mauvaise monnaie — et cette fois-ci elle
// est nommée avant d'être livrée, pas après. C'est la raison d'être de la
// signature ci-dessous : elle prend le LOOK du cycle, pas `params`, pour qu'il
// n'y ait aucun endroit où se tromper de champ.
//
// ══════════ 2. LA LOI N'EST PAS RÉÉCRITE ════════════════════════════════════
//
// La conversion « (azimut, élévation) local → repère du globe » vit déjà dans
// `monde/eclairage-crop.js` (`directionSoleilLocale`, Tâche P3), avec la
// correspondance des deux repères écrite ligne à ligne et gardée par
// `test/crop-eclairage.test.js`. **Une grandeur, une source** : ce fichier
// l'appelle, il ne la recopie pas.
//
// ⚠️ **ET LE RÉSULTAT VAUT POUR LA PLANÈTE ENTIÈRE, PAS SEULEMENT POUR LE
// BLOC.** Le soleil est traité comme infiniment lointain partout dans ce dépôt
// (une `DirectionalLight` pour le socle, un `uSunDir` unique pour le globe) :
// la direction calculée au point (lat, lon) est donc LA direction du soleil dans
// le repère du globe, et le terminateur qu'elle produit tombe au bon endroit sur
// toute la sphère. Le test §① le vérifie par l'antipode.

import { directionSoleilLocale } from './eclairage-crop.js'

/**
 * La direction du soleil DE L'HEURE, dans le repère du globe.
 *
 * @param {{azimuth:number, sunElevation:number}} cycle le look rendu par
 *   `daycycle.lightingFor` (celui que `main.js` garde dans `skyState`).
 *   ⚠️ **`sunElevation`, PAS `elevation`** — voir §1.
 * @param {{lat:number, lon:number}} lieu le centre du bloc, en degrés.
 * @returns {number[]|null} un vecteur UNITAIRE, ou `null` si une donnée manque —
 *   l'appelant reprend alors sa loi d'avant plutôt que de pointer nulle part.
 */
export function soleilMondeDeLHeure(cycle, lieu) {
  if (!cycle || !lieu) return null
  const { azimuth, sunElevation } = cycle
  const { lat, lon } = lieu
  if (!Number.isFinite(azimuth) || !Number.isFinite(sunElevation)) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return directionSoleilLocale(azimuth, sunElevation, lat, lon)
}
