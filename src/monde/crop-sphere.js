// LA FORME DU CROP, EN LAT/LON — Tâche A du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// Module PUR : ni DOM, ni three.js, ni état. Testable sous node
// (`test/crop-sphere.test.js`).
//
// ══════════ POURQUOI CE MODULE EXISTE ══════════════════════════════════════
//
// Adrien, le 2026-08-21 : « Je ne veux qu'une seule terre, globale. Le crop doit
// se faire dans la terre arrondie. » Les tuiles du globe cessent d'être
// dessinées entières : elles sont DÉCOUPÉES à la forme du crop, dans le nuanceur
// de fragment. Il faut donc dire, pour un point de la sphère, s'il est dans le
// crop — **et le dire en lat/lon**.
//
// ⚠️ **EN LAT/LON, ET C'EST STRUCTUREL, PAS UN CONFORT.** Les sommets du globe
// sont en RTC depuis `test/globe-precision.test.js` : `_buildMesh` écrit des
// positions RELATIVES au centre de leur propre tuile, la position mondiale
// vivant dans la matrice de l'objet. Un test de forme posé sur `position`
// donnerait donc une réponse différente par tuile, et une tuile chevauche la
// frontière par construction. `_buildMesh` écrit déjà l'attribut `latlon`, et le
// nuanceur le porte déjà en `vLatLon` (pour le graticule) : la donnée absolue
// est là, gratuite.
//
// ══════════ CE QUI EXISTE DÉJÀ, ET CE QU'ON A REJETÉ ═══════════════════════
//
// ⚠️ **C'est le §1 de `/threejs-optimisation` : l'audit s'arrête au fichier.**
// Quatre candidates ont été rejouées contre le dépôt avant d'écrire une ligne.
//
//   · **`dansDalle` (`damier-bords.js:181`) — PRISE.** C'est la loi que le
//     nuanceur du socle applique : `slabInside` (`map/block-clip.js:13`) s'y
//     ramène en une ligne et son en-tête l'atteste — « mirrors terrain.js's
//     slab-corner discard (superellipse) ». Une seule règle, N lecteurs ; le
//     globe devient un lecteur de plus. **On ne la recopie pas, on l'appelle.**
//   · **`dansFenetre` (`fenetre-clip.js:232`) — REJETÉE, ET LE PLAN LA
//     PRESCRIVAIT.** Deux raisons, toutes deux vérifiées :
//       ① le plan la dit « déjà utilisée par `plinth.js` ET `ocean.js` ».
//          `grep -rn dansFenetre src` rend `gpx.js`, `main.js`, `peaks.js` —
//          **et ni l'un ni l'autre des deux nommés** ;
//       ② ce n'est pas la superellipse mais son OCTOGONE CIRCONSCRIT, et son
//          propre en-tête l'écrit : « L'octogone DÉBORDE l'arrondi entre ses
//          points de tangence ». Découper le globe dessus le ferait dépasser de
//          la surface du socle — et les parois de la Tâche B, qui s'appuient sur
//          `arcCoin`, tomberaient en retrait. **Un liseré**, exactement le
//          défaut que `fenetre-clip.js` raconte avoir déjà payé une fois.
//     ⚠️ **L'ÉCART EST MESURÉ** (réglages par défaut, demi-côté 28, rayon 2,24,
//     exposant 4,4) : nul à 45° — le plan diagonal y est TANGENT, à 1,4·10⁻¹⁴ —
//     et **maximal à 44,3°, où il vaut 0,129 unité, soit 23,9 m au sol** à
//     `ZOOM_SOCLE`. En surface, l'octogone couvre **+0,0139 %**.
//     `dansFenetre` garde tout son sens là où il sert : écrêter des CALQUES par
//     huit plans de coupe three.js, où l'on préfère laisser dépasser un cheveu
//     que couper une rivière trop tôt.
//   · **`empriseSocle` (`seuil-socle.js`) — PRISE**, et c'est elle qui fixe le
//     repère. Ce module ne réinvente pas l'emprise, il la lit.
//   · **`boiteMerc` / `rectangleTuiles` (`flux-terrain.js`) — regardées, non
//     prises** : elles sont privées à ce module et travaillent en rectangles de
//     tuiles pour le RÉSEAU. Ici on a besoin d'un prédicat par point et d'un
//     test de recouvrement par tuile, pas d'une liste de clés.
//
// ══════════ LE REPÈRE — MERCATOR NORMALISÉ, ET RIEN D'AUTRE ════════════════
//
// Le crop est un carré de MERCATOR : `empriseSocle` le taille en tuiles, donc en
// mercator. Le repère naturel est donc (x, y) mercator normalisé sur [0, 1[,
// où le crop est un carré CENTRÉ de demi-côté `demi = tuilesParBloc / 2 / 2^z`.
//
// ⚠️ **CONVENTION DE SIGNE, ÉCRITE POUR QU'ON PUISSE LA CONTREDIRE** : le
// mercator `y` croît vers le SUD, et le `z` du monde aussi (`terrain.js:948` :
// « z >= 0 = sud »). `v` se lit donc directement comme un `z` de socle, sans
// retournement. Un signe inversé ici mettrait le relief en miroir nord-sud, et
// c'est le genre de défaut qui ne se voit qu'à côté d'une côte connue.

import { dansDalle } from '../damier-bords.js'
import { ZOOM_SOCLE, MERCATOR_LAT_MAX } from './seuil-socle.js'
import { BLOCK_TILES } from '../landmarks.js'

const D2R = Math.PI / 180

/** Longitude → x mercator normalisé. Linéaire : c'est la moitié facile. */
export function mercX(lon) {
  return (lon + 180) / 360
}

/**
 * Latitude → y mercator normalisé, écrêtée à la couverture de Mercator.
 * ⚠️ L'ÉCRÊTAGE N'EST PAS DÉCORATIF : sans lui un pôle rend un infini, et le
 * `discard` du nuanceur deviendrait un `NaN` — c'est-à-dire une comparaison
 * fausse, donc un fragment GARDÉ, donc un globe entier dessiné au pôle.
 */
export function mercY(lat) {
  const la = Math.max(-MERCATOR_LAT_MAX, Math.min(MERCATOR_LAT_MAX, lat)) * D2R
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + la / 2)) / (2 * Math.PI)
}

/**
 * Le repère du crop : son centre et son demi-côté, en mercator normalisé.
 *
 * ⚠️ **LE `zoom` FIXE LA LARGEUR, PAS LA FINESSE** — la règle d'`empriseSocle`,
 * reprise telle quelle. Changer ce zoom en vol ferait changer le crop de taille
 * à l'écran, c'est-à-dire ferait revenir le cran par la fenêtre.
 *
 * @param {{centre:{lat:number,lon:number}, zoom?:number, tuilesParBloc?:number}} arg
 * @returns {{cx:number, cy:number, demi:number, zoom:number}}
 */
export function repereCrop({ centre, zoom = ZOOM_SOCLE, tuilesParBloc = BLOCK_TILES } = {}) {
  const lat = Number(centre?.lat)
  const lon = Number(centre?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new TypeError('repereCrop : `centre` doit porter des `lat` et `lon` finis')
  }
  return { cx: mercX(lon), cy: mercY(lat), demi: tuilesParBloc / 2 / 2 ** zoom, zoom }
}

/**
 * (lat, lon) → coordonnées LOCALES du crop, dans [-1, 1] sur son emprise.
 *
 * ⚠️ **LE REPLI D'ANTIMÉRIDIEN EST DANS `u`, ET IL EST OBLIGATOIRE.** Le
 * mercator `x` est de période 1 : sans `du − round(du)`, un crop à cheval sur
 * 180° verrait la moitié de ses fragments à une distance de ~1 de son centre,
 * donc coupés. `seuil-socle.js` autorise explicitement `ouest > est`.
 */
export function localCrop(lat, lon, repere) {
  let du = mercX(lon) - repere.cx
  du -= Math.round(du)
  return { u: du / repere.demi, v: (mercY(lat) - repere.cy) / repere.demi }
}

/**
 * L'INVERSE de `localCrop` : coordonnées locales du crop (±1) → (lat, lon).
 *
 * ⚠️ **AJOUTÉE PAR LA TÂCHE B, ET ELLE NE REMPLACE RIEN.** Les parois ont besoin
 * de savoir QUEL point de la planète tombe sur la frontière du crop, pour y lire
 * la hauteur EXACTE de la surface — `localCrop` ne répond qu'à la question
 * inverse.
 *
 * ⚠️ **LE REPLI DE LONGITUDE EST OBLIGATOIRE, ET IL EST MESURÉ**, pour la raison
 * jumelle de celui de `localCrop` : un crop à cheval sur 180° a un `cx + u·demi`
 * hors de [0, 1[, et une longitude de 187° n'existe pas.
 *
 * ⚠️ **ET `test/crop-sphere.test.js` PORTE UNE COPIE PRIVÉE DE CETTE FORMULE QUI,
 * ELLE, N'A PAS LE REPLI** (`latLonDeLocal`, en bas de ce fichier-là, écrite par
 * la Tâche A). Ce n'est pas un défaut chez elle : son crop de test est à
 * lon 6,25, très loin de 180°, et les deux formules y coïncident au bit. Mais un
 * témoin qu'on ne confronte jamais n'est pas un témoin — la première version de
 * ce commentaire affirmait que `test/crop-parois.test.js` vérifiait la
 * composition en identité, **et c'était faux, il ne le faisait pas.**
 * `test/crop-parois.test.js` le fait maintenant, et il fait mieux : il **oppose**
 * les deux formules sur un crop à cheval sur l'antiméridien, là où elles
 * divergent de 360° exactement.
 */
export function latLonDeLocal(u, v, repere) {
  const mx = repere.cx + u * repere.demi
  const my = repere.cy + v * repere.demi
  const mxr = mx - Math.floor(mx)
  return {
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI,
    lon: mxr * 360 - 180,
  }
}

/** Le rayon d'arrondi, en fraction du demi-côté — l'unité du nuanceur. */
export function coinNormalise(corner, half) {
  return Math.max(0, Math.min(1, corner / half))
}

/**
 * Ce point est-il dans le crop ?
 *
 * ⚠️ **DÉLÈGUE À `dansDalle`, ET C'EST TOUT L'INTÉRÊT.** La superellipse est
 * invariante d'échelle : la tester à demi-côté 1 avec un rayon normalisé rend
 * exactement le même verdict qu'à demi-côté 28 avec le rayon en unités monde.
 * Une seconde copie de la formule aurait fini par diverger de celle du socle —
 * `fenetre-clip.js` raconte ce défaut, il a coûté un liseré dans chaque coin.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {{cx:number,cy:number,demi:number}} repere
 * @param {{coin:number, expo:number}} forme - rayon NORMALISÉ, exposant
 */
export function dansCrop(lat, lon, repere, { coin = 0, expo = 2 } = {}) {
  const { u, v } = localCrop(lat, lon, repere)
  return dansDalle(u, v, 1, coin, expo, null)
}

/**
 * La tuile (z, x, y) recouvre-t-elle l'emprise du crop ?
 *
 * ⚠️ **SUR LA BOÎTE, PAS SUR LA FORME, ET C'EST DÉLIBÉRÉ.** Une tuile qui ne
 * touche le crop que par un coin arrondi doit quand même être raffinée : la
 * forme se joue au fragment, le raffinement se joue à la tuile. Un test de
 * forme ici ouvrirait un trou d'une tuile dans chaque coin.
 */
export function tuileDansCrop(z, x, y, repere) {
  const n = 2 ** z
  const y0 = y / n
  const y1 = (y + 1) / n
  if (y1 <= repere.cy - repere.demi || y0 >= repere.cy + repere.demi) return false
  // en longitude, la comparaison se fait sur l'écart REPLIÉ — même raison que
  // dans `localCrop`, et le repli doit se faire sur le CENTRE de la tuile pour
  // que le signe de l'écart soit celui du plus court chemin.
  const demiTuile = 0.5 / n
  let dx = (x + 0.5) / n - repere.cx
  dx -= Math.round(dx)
  return Math.abs(dx) < repere.demi + demiTuile
}

/**
 * Le zoom PRESCRIT pour cette tuile par le crop, ou 0 si le crop ne la concerne
 * pas (et c'est alors le critère de distance qui décide).
 *
 * ⚠️ **`chord / dist` REFEND PAR DISTANCE ; LE CROP A BESOIN D'UNE RÉSOLUTION
 * UNIFORME.** C'est le cœur de l'Étape 4 de la tâche : un crop dont le bord
 * proche serait à z15 et le bord lointain à z13 est une affiche à deux
 * résolutions, et le raccord se voit. On prescrit donc `ZOOM_SOCLE` PARTOUT dans
 * l'emprise — plancher ET plafond — et on laisse la distance décider dehors.
 *
 * ⚠️ **CONSÉQUENCE ASSUMÉE, ET ELLE EST MESURÉE** : sous ce régime le crop cesse
 * de descendre à z15. C'est cohérent avec le socle d'aujourd'hui, qui est
 * rééchantillonné à `ZOOM_SOCLE` (§3 du plan : globe 1,69 m/échantillon à z15,
 * socle z13 6,76 m), mais **c'est un changement visible** : voir le compte rendu
 * de la tâche pour le coût en tuiles et en mémoire.
 */
export function zoomCropPrescrit(z, x, y, repere, zoomSocle = ZOOM_SOCLE) {
  return tuileDansCrop(z, x, y, repere) ? zoomSocle : 0
}
