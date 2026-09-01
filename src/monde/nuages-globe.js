// LE VOLUME DE NUAGES DANS L'ESPACE DU GLOBE — Tâche R20.
//
// Module PUR : ni DOM, ni three.js, ni état, ni réseau. Il rend des tableaux de
// nombres. Tout se vérifie sous node (`test/nuages-globe.test.js`).
//
// ══════════ 0. IL Y AVAIT DEUX SYSTÈMES, ET LES QUINZE CURSEURS PILOTAIENT
//            CELUI QUI N'EST PAS SOUMIS AU GPU ═══════════════════════════════
//
// ⛔ **MESURÉ, PAS LU** (`.banc/R20/diag-deux-systemes.json`, sonde
// `scripts/diag-r20-deux-systemes.mjs`, mode sphère par défaut, La Réunion z12).
// Une image du dépôt soumet **QUATRE** rendus : `sceneGlobe` avec `camGlobe`,
// puis trois quadrilatères plein écran du compositeur. **La scène du bloc plat
// n'y figure pas** — `main.js` fait `passeSurface.enabled = false` sous la
// fusion des passes. `clouds2` y vivait, avec **16 instances vivantes** : un
// système complet, allumé, correctement peuplé, dessiné dans un tampon que
// personne ne regarde. Forcé `visible = true`, l'écart à l'écran vaut
// **0,000 / 0,000** (256 × 160, moyenne et gradient, mouvement ambiant coupé).
//
// ⛔ **ET LA COQUILLE DU GLOBE NE LE REMPLACE PAS.** Même sonde, cinq altitudes,
// allumée puis éteinte puis rallumée :
//
//   | altitude | `uFade` | écart moy | écart grad |
//   |---|---|---|---|
//   | 18 km (le défaut, vue de surface) | 0,0000 | **0,000** | **0,000** |
//   | 1 200 km (là où `enterOrbit` SORT du mode surface) | 0,0020 | **0,000** | **0,000** |
//   | 6 371 km | 1,0000 | 8,157 | 1,741 |
//   | 19 113 km | 1,0000 | 3,044 | 1,072 |
//   | 57 339 km | 1,0000 | 0,426 | 0,255 |
//
// Sa loi de fondu (`globe-clouds.js`) est `smoothstep(R × 1,18, R × 1,50, d)`,
// c'est-à-dire **rien en dessous de 1 147 km et plein au-dessus de 3 186 km**.
// La vue de surface et la sortie d'orbite tombent toutes les deux SOUS le seuil.
// ➡️ **Le brief la dit « déjà rendue » ; elle l'est, mais à des altitudes que
// l'application n'atteint pas en zoomant : pas une seule des trois altitudes
// demandées à l'étape 7 ne la montre.**
//
// ══════════ 1. LEQUEL SURVIT, ET POURQUOI ══════════════════════════════════
//
// ⚡ **`clouds2` SURVIT.** Trois raisons, dans l'ordre où elles pèsent :
//
//   ① **La coquille ne porte pas les quinze réglages, et ne peut pas les
//      porter.** Elle a cinq uniformes (`uTex`, `uSunDir`, `uTime`, `uFade`,
//      `uNuitCoquille`) et une texture équirectangulaire cuite au CPU.
//      Bourgeonnement, translucidité, texture cotonneuse, étalement en
//      altitude n'ont **aucun sens sur une image plaquée** : les y brancher
//      serait inventer un comportement, pas en rebrancher un.
//   ② **`clouds2` les porte déjà, tous les quinze**, et sa simulation est un
//      module pur testé sous node (`clouds-sim.js`, `test/clouds-sim.test.js`).
//      Ce qui lui manque n'est pas une loi : c'est **un parent**.
//   ③ **La coquille garde son métier** — le voile satellite de la planète
//      entière, au-dessus de 1 147 km. Les deux ne se disputent aucune
//      altitude : elles ne sont visibles nulle part en même temps.
//
// ⛔ **ET ON NE CONSTRUIT PAS DE TROISIÈME SYSTÈME.** Le geste tient en une
// phrase : **le groupe `clouds2` change de parent et reçoit la similitude du
// crop.** C'est la même similitude que le cartouche (`cartouche-globe.js`), les
// rivières et les toponymes (`sol-globe.js`) et les sommets (R18).
//
// ══════════ 2. ⛔ LES UNITÉS — LE FACTEUR EST `1/k`, ET IL VAUT 130,4 ICI ═══
//
// ⚠️ **C'est la classe de défaut n° 1 de ce chantier, et les nuages en sont la
// pire vitrine parce que leur hauteur est LUE PAR L'ŒIL.**
//
// Relevé à mon banc (`.banc/R20/releve.json`, La Réunion, z12, exagération 2) :
//
//   · `extentMeters` = 27 354,269 m pour `span` = 56 unités de bloc ;
//   · `k` = (extent / span) / ORBITAL_M_PER_UNIT = **0,0076671** unité-globe
//     par unité-bloc, donc **1/k = 130,43** ;
//   · le curseur « Altitude » vaut **13,5** unités de bloc au démarrage, et la
//     boîte la plus haute du ciel monte à **14,795**.
//
//   | ce qu'on écrit | plafond du ciel | boîte la plus haute |
//   |---|---|---|
//   | ⛔ la valeur de bloc TELLE QUELLE en unités de globe | **860 km** | **942 km** |
//   | ⛔ idem, curseur au maximum (16) | **1 019 km** | ≈ **1 116 km** |
//   | ✅ la valeur de bloc × `k` | **6 595 m** | **7 227 m** |
//
// ➡️ **Sans `k`, la couche de nuages est en orbite basse**, à deux fois
// l'altitude de la station spatiale, et le ciel disparaît de l'écran par le
// haut. Avec `k`, elle est à 6,6 km — un plafond de cumulus.
//
// ⚡ **ET LA CONVERSION N'EST ÉCRITE QU'UNE FOIS : c'est l'homothétie du
// groupe.** Le volume continue de vivre, de se peupler, de dériver et de se
// dessiner **en unités de bloc**, dans le repère de son groupe ; la similitude
// s'applique au groupe entier. Il n'y a donc pas quinze conversions à écrire,
// pas de constante à recopier dans le nuanceur, et aucun réglage sauvegardé à
// ré-échelonner. ⛔ **La seule grandeur qui traverse la frontière dans l'autre
// sens est LA POSITION DE LA CAMÉRA** — le nuanceur en a besoin pour lancer
// son rayon —, et elle passe par `positionCameraEnBloc` ci-dessous, qui porte
// le sens de la division.
//
// ⚠️ **LE SENS EST LE PIÈGE.** `k` vaut 0,00767 : la caméra du globe est à
// ~100 unités de l'origine du monde, mais à ~0,2 unité-globe du crop, soit
// ~26 unités de BLOC. Multiplier au lieu de diviser mettrait la caméra à
// 0,0000117 unité de bloc du ciel — dans le nuage, à tous les coups, et la
// marche s'éteindrait sur son garde-fou de remplissage (6 pas).
//
// ══════════ 3. LA VERTICALE PASSE PAR `k` COMME L'HORIZONTALE ══════════════
//
// ⚠️ **`frontiere-rendu.js` écrit en tête que `k` porte l'échelle HORIZONTALE,
// « jamais la verticale ». C'est vrai de la CAMÉRA, et faux du CROP** — et la
// distinction m'a coûté une relecture.
//
// La caméra de fond ne doit pas voir la planète rétrécir de l'exagération, donc
// son altitude ne porte pas l'exagération. Le relief du crop, lui, EST exagéré,
// et de la MÊME exagération que le bloc (`globe.majExageration` lit
// `lireExageration(params)`, l'inventaire le mesure ✅ à l'option 23). Les deux
// exagérations se simplifient, et une homothétie unique transporte donc aussi
// les hauteurs.
//
// ⚡ **CE N'EST PAS UN RAISONNEMENT : C'EST MESURÉ, PAR DEUX CHEMINS.** Le fond
// du crop vaut `baseYCrop = −0,11997935843827294` unité de GLOBE, et
// `−0,11997935843827294 / k = −15,6489` unités de bloc — une profondeur de
// socle plausible, quand la valeur non divisée vaudrait −0,12 unité de bloc,
// c'est-à-dire le ras du relief. C'est le même chemin que
// `baseCartoucheEnBloc`, pris pour une autre grandeur.
//
// ══════════ 4. CE QUE CE MODULE NE FAIT PAS ════════════════════════════════
//
// Il ne connaît ni three.js ni le globe : il rend une pose et deux conversions.
// Le changement de parent, la pose par image et le prédicat de visibilité
// vivent dans `main.js` (qu'aucun test de ce dépôt ne charge — d'où la lecture
// de son texte, comme le fait `cartouche-globe.test.js`).

import { poseFond } from './frontiere-rendu.js'
import { ORBITAL_M_PER_UNIT } from '../geo.js'

const IDENTITE = [0, 0, 0, 1]

/**
 * LE REPÈRE OÙ POSER LE GROUPE DU CIEL, DANS L'ESPACE DU GLOBE.
 *
 * C'est l'image du repère du BLOC par la similitude de `frontiere-rendu.js`,
 * ancrée sur l'origine du bloc — donc exactement le repère du crop, et
 * exactement celui du cartouche (§1). **Une seule homothétie porte toutes les
 * longueurs du ciel** : altitude, rayon des nuages, étalement, taille des pas
 * de marche, portée du vent.
 *
 * @param {object} o
 * @param {number} o.lat latitude de l'ORIGINE du bloc
 * @param {number} o.lon longitude de la même origine
 * @param {number} o.extentMeters l'emprise RÉELLE du bloc affiché, en mètres
 * @param {number} o.span `TERRAIN_SIZE`, en unités de bloc
 * @returns {{position: number[], quaternion: number[], echelle: number}}
 */
export function ancrageNuages({ lat, lon, extentMeters, span }) {
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
 * UNE HAUTEUR DE CIEL, EN MÈTRES — l'instrument qui rend le défaut LISIBLE.
 *
 * ⚠️ **Cette fonction n'est appelée par aucun chemin de rendu**, et c'est
 * voulu : la conversion de rendu est l'homothétie du groupe (§2). Elle existe
 * pour que le test puisse dire « 6 595 m » et « 860 085 m » au lieu de comparer
 * deux flottants sans unité — c'est-à-dire pour qu'une mutation qui retire `k`
 * tue par un nombre qu'un humain reconnaît.
 *
 * ⚠️ **L'EXAGÉRATION EST DANS LA FORMULE ET N'EST PAS DANS L'HOMOTHÉTIE**, et
 * ce n'est pas une contradiction : le relief du crop porte la MÊME exagération
 * que celui du bloc (§3), donc elle se simplifie entre les deux espaces mais
 * PAS entre l'espace de bloc et les mètres réels. Un plafond de 13,5 unités de
 * bloc est à 6 595 m au-dessus du zéro du bloc **quand on croit l'exagération**,
 * et à 13 190 m si on l'oublie.
 *
 * @param {object} o
 * @param {number} o.hauteurBloc une hauteur en unités de BLOC (« Altitude »)
 * @param {number} o.extentMeters emprise du bloc, en mètres
 * @param {number} o.span `TERRAIN_SIZE`
 * @param {number} o.exageration l'exagération verticale en cours
 * @returns {number} des MÈTRES au-dessus du zéro du bloc
 */
export function altitudeNuageM({ hauteurBloc, extentMeters, span, exageration }) {
  if (!(extentMeters > 0) || !(span > 0) || !(exageration > 0)) return 0
  return (hauteurBloc * extentMeters) / (span * exageration)
}

/**
 * LA MÊME HAUTEUR, EN UNITÉS DE GLOBE — ce que le groupe posé rend réellement.
 *
 * ⛔ **Elle N'EST PAS `hauteurBloc` tel quel** : c'est tout le défaut. Un test
 * la compare aux deux, et la mutation qui remplace `echelle` par 1 tue.
 *
 * @param {number} hauteurBloc en unités de bloc
 * @param {number} echelle le `k` d'`ancrageNuages`
 */
export function hauteurNuageEnGlobe(hauteurBloc, echelle) {
  return hauteurBloc * echelle
}

/** La même hauteur de globe, relue en mètres réels. Sert au test et au rapport. */
export function hauteurGlobeEnM(hauteurGlobe) {
  return hauteurGlobe * ORBITAL_M_PER_UNIT
}

/**
 * LA POSITION DE LA CAMÉRA, RAMENÉE EN UNITÉS DE BLOC.
 *
 * ⚠️ **C'est la SEULE grandeur qui traverse la frontière dans le sens
 * globe → bloc**, et le nuanceur ne peut pas s'en passer : il lance son rayon
 * depuis l'œil. `three.js` ne fournit que `cameraPosition`, qui est en unités
 * de MONDE ; sous la similitude, ce n'est plus l'espace où le ciel est décrit.
 *
 * ⛔ **LE SENS DE LA DIVISION EST LE PIÈGE** (§2) : ici on RETRANCHE l'ancre,
 * on ANNULE la rotation, puis on DIVISE par `k`.
 *
 * @param {number[]} camMonde position de la caméra, en unités de globe
 * @param {{position:number[], quaternion:number[], echelle:number}} ancre
 * @returns {number[]} la même position, en unités de BLOC
 */
export function positionCameraEnBloc(camMonde, ancre) {
  const k = ancre?.echelle
  if (!(k > 0)) return [camMonde[0], camMonde[1], camMonde[2]]
  const dx = camMonde[0] - ancre.position[0]
  const dy = camMonde[1] - ancre.position[1]
  const dz = camMonde[2] - ancre.position[2]
  // rotation inverse : conjugué du quaternion appliqué au vecteur
  const [qx, qy, qz, qw] = ancre.quaternion
  // q* · v · q  (q* = conjugué), forme développée sans allocation
  const ix = qw * dx - qy * dz + qz * dy
  const iy = qw * dy - qz * dx + qx * dz
  const iz = qw * dz - qx * dy + qy * dx
  const iw = qx * dx + qy * dy + qz * dz
  return [
    (ix * qw + iw * qx + iy * qz - iz * qy) / k,
    (iy * qw + iw * qy + iz * qx - ix * qz) / k,
    (iz * qw + iw * qz + ix * qy - iy * qx) / k,
  ]
}
