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

// ══════════ 3. QUI POSE LE SOLEIL DU GLOBE — LA POLARITÉ, EXÉCUTABLE ════════
//
// ⛔ **UNE MUTATION A SURVÉCU À 4 204 TESTS EN INVERSANT DEUX `!`.** Le tour 1
// gardait les deux poses de la boucle d'image par `if (!soleilHeureMonde)` et
// n'en vérifiait que le MOT, par lecture du source : inverser le `!` laissait le
// mot en place, et la production ne reposait alors plus rien du tout. La
// polarité vit donc ici, dans du code que les tests EXÉCUTENT — `main.js` ne
// porte plus de négation à inverser, il compare le nom du poseur.
//
// @param {boolean} actif l'état du drapeau `soleilHeureMonde`
// @returns {'heure'|'camera'} qui a le droit d'écrire `uSunDir`
export function poseurDuSoleilDuGlobe(actif) {
  return actif ? 'heure' : 'camera'
}

// ══════════ 4. LE PLANCHER DE NUIT DE LA PLANÈTE — TOUR DE CORRECTION ═══════
//
// ⛔ **LE VRAI PRIX DU CORRECTIF N'ÉTAIT PAS « LA NUIT », C'ÉTAIT L'EFFACEMENT.**
// Relevé par le relecteur puis remesuré ici, à **10 h — l'heure par défaut du
// produit** (`params.timeOfDay ?? 10`), six poses d'orbite : à l'antisolaire la
// planète devenait une **sphère unie**, sans bathymétrie, sans rampe de relief,
// sans palette. La luminance moyenne ne pouvait pas le voir — elle MONTE
// pendant que la carte disparaît. L'instrument qui le voit est la **chroma**.
//
// La cause n'est pas `uSunDir`, qui est enfin juste : c'est le plancher de nuit
// de `globe.js`, `mix(uShadowColor, colPlanete, 0.10 + 0.90 * day)`. **10 % de
// carte résiduelle**, écrit à une époque où `uSunDir` suivait la caméra — la
// face nuit n'était jamais regardée de face, donc son effacement ne se voyait
// jamais. Le correctif R7 la met en plein cadre.
//
// Ce que ces deux jeux de valeurs disent :
//
//   · `carte`     — la part de CARTE gardée en pleine nuit (le reste est le
//                   fond de nuit). 0,10 en production, relevé sous le drapeau.
//   · `froid`     — de combien la couleur de nuit s'écarte du fond du décor
//                   vers un bleu sombre : **refroidir plutôt qu'effacer**.
//                   0 en production → le fond, au bit près.
//   · `coquille`  — le gain de la coquille de nuages sur sa face nuit. Elle
//                   n'avait AUCUN terminateur (plancher 0,74 sans `day`,
//                   `globe-clouds.js`) : drapeau levé, les nuages brillaient
//                   au-dessus d'une planète éteinte. 1 en production → la
//                   coquille d'avant, au bit près.
//
// ⚠️ **LES TROIS VALEURS DE PRODUCTION SONT NEUTRES AU BIT PRÈS**, et ce n'est
// pas une formule de style : `uNuitCarte + (1 - uNuitCarte) * day` avec
// `uNuitCarte = 0,10` EST `0,10 + 0,90 * day` (en float32, `1 - 0,1f == 0,9f`),
// `uNuitFond` vaut alors exactement `uShadowColor`, et le gain de coquille vaut
// exactement 1. Drapeau baissé, aucun de ces trois uniformes ne change une image.
export const NUIT_PRODUCTION = Object.freeze({ carte: 0.10, froid: 0, coquille: 1 })

// Les valeurs sous le drapeau, RÉGLÉES À LA MESURE — le détail et les bancs
// sont dans `rapport-R7.md`, voici les trois raisons en une ligne chacune :
//
//   · `carte: 0.55` — dans la fourchette recommandée par la relecture
//     (0,45–0,60). Mesuré à 10 h, caméra à l'antisolaire, sur le cadre central :
//     la dispersion de chroma passe de **2,755** (plancher du tour 1) à **4,086**,
//     soit **+48 %**, pour un plancher de bruit de **±0,010** (témoin nul). Entre
//     0,45 (4,111) et 0,60 (4,136) l'instrument ne départage pas : 0,55 est pris
//     au milieu de la fourchette, et parce qu'il vaut aussi le gain de coquille.
//
//   · `froid: 0.72` — REFROIDIR PLUTÔT QU'EFFACER, et c'est ce qui distingue
//     cette correction d'un simple relèvement. Sans refroidissement (`froid: 0`)
//     la face nuit garde la clarté du plein jour — L* mesuré **69,3**, contre
//     **73,0** au plancher du tour 1 : elle ne se lit pas comme une nuit. Avec,
//     elle tombe à **57,6** en gardant la carte.
//
//   · `coquille: 0.55` — LE MÊME NOMBRE QUE `carte`, et c'est une mesure qui l'a
//     choisi, pas la symétrie. L'excédent de luminance que la coquille apporte
//     à l'image (lue coquille cachée puis visible, même pose, même seconde) vaut
//     **+0,50 %** sur la face ÉCLAIRÉE — la référence. Sur la face nuit il valait
//     **+2,61 %**, soit **×5,2 la référence** : c'est ça, « les nuages brillent
//     au-dessus d'une planète éteinte ». À 0,55 il retombe à **+0,51 %**, la
//     référence de jour à 0,01 point près (plancher de bruit : ±0,01 point).
//     À 0,42 il passe à **−0,22 %** : la coquille assombrirait l'image, elle
//     serait trop éteinte.
export const NUIT_LISIBLE = Object.freeze({ carte: 0.55, froid: 0.72, coquille: 0.55 })

/** Le plancher de nuit à pousser dans le globe, selon l'état du drapeau. */
export function plancherNuitMonde(actif) {
  return actif ? NUIT_LISIBLE : NUIT_PRODUCTION
}
