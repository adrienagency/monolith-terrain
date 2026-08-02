// LES LUMIÈRES NOCTURNES — la partie PURE : d'où viennent les tuiles, et
// combien la nuit les allume.
//
// Module pur : ni three.js, ni DOM, ni réseau. Il rend des adresses et des
// nombres, et se teste sous node. La mosaïque et la texture vivent à côté,
// dans src/map/nuit-layer.js.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CETTE COUCHE EST, ET CE QU'ELLE N'EST PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE N'EST PAS UNE TEXTURE DE DÉTAIL, C'EST UNE LUEUR. Black Marble plafonne
// à ~600 m par pixel, et ce n'est PAS une limite de tuilage qu'on pourrait
// contourner en montant d'un cran : c'est la résolution native du capteur VIIRS
// (bande jour/nuit, 15 secondes d'arc). Sur un bloc ShibuMap de 30 km, ça fait
// une cinquantaine de pixels de large. Aucune source mondiale libre ne fait
// mieux — les lumières nocturnes à haute résolution n'existent pas en accès
// ouvert.
//
// La conséquence est une décision de rendu, pas une excuse : on la peint en
// ÉMISSIF, floue et diffuse, et non en calque d'imagerie. À zoom large elle est
// juste ; de près, elle doit rester un halo au-dessus des villes, jamais une
// carte qu'on croirait pouvoir lire.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE PRODUIT CHOISI, ET LE PRODUIT ÉCARTÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// RETENU : `VIIRS_Black_Marble`, la composition annuelle stable. Sondé le
// 2026-08-02 sur la matrice `GoogleMapsCompatible_Level8` : z2, z5 et z8
// répondent tous en 200 image/png.
//
// ÉCARTÉ : `VIIRS_SNPP_DayNightBand_At_Sensor_Radiance`, le produit QUOTIDIEN.
// Même sonde, même jour : z2 répond, mais z5 et z8 rendent 404. Il ne vit pas
// sur cette matrice de tuiles. Et même s'il y vivait, il porterait la couverture
// nuageuse et la lune du jour choisi — du bruit, là où on veut une constante.
//
// Domaine public (œuvre du gouvernement des États-Unis), attribution d'usage.

// Le plafond de zoom de la matrice `Level8`, qui est aussi, à peu de chose
// près, celui du capteur. Demander z9 ne rendrait pas plus de détail : il
// rendrait une erreur.
export const NUIT_ZOOM_MAX = 8

export const NUIT_ATTRIBUTION = 'NASA GIBS · VIIRS Black Marble'

export const NUIT_COUCHE_GIBS = 'VIIRS_Black_Marble'

/**
 * L'adresse d'une tuile de lumières nocturnes.
 *
 * ⚠️ L'ORDRE EST {z}/{y}/{x}, ET C'EST UN PIÈGE. GIBS suit la convention WMTS
 * (ligne puis colonne), à l'inverse du {z}/{x}/{y} d'OpenStreetMap qu'on lit
 * partout ailleurs. Inverser les deux ne provoque AUCUNE erreur : ça rend une
 * tuile valide, prise ailleurs sur Terre. Le défaut se voit à l'œil, jamais en
 * console. Le fournisseur Blue Marble de map/aerial-layer.js a exactement la
 * même forme — c'est la même maison.
 *
 * @param {number} z @param {number} x @param {number} y
 * @returns {string}
 */
export function urlTuileNuit(z, x, y) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${NUIT_COUCHE_GIBS}/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`
}

/**
 * Le zoom de tuiles à demander, borné par le capteur.
 *
 * @param {number} voulu - le zoom que le budget de texture autoriserait
 * @returns {number}
 */
export function zoomNuitBorne(voulu) {
  if (!Number.isFinite(voulu)) return NUIT_ZOOM_MAX
  return Math.max(0, Math.min(NUIT_ZOOM_MAX, Math.floor(voulu)))
}

// ═══════════════════════════════════════════════════════════════════════════
// LE GARDE D'ÉCHELLE — la couche s'efface quand elle n'a plus rien à dire
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE GARDE N'EST PAS UNE PRÉCAUTION, IL RÉPARE UN DÉFAUT CONSTATÉ. Premier
// essai en vrai, Tokyo au zoom 16, minuit : le bloc fait environ 1,5 km de côté.
// À 600 m par pixel, il couvre DEUX pixels et demi de Black Marble. Le résultat
// à l'écran n'était pas une ville qui brille, c'était un voile gris uniforme
// posé sur tout le bloc — pire que la couche éteinte, parce qu'on lit un défaut
// de rendu là où on croit lire une donnée.
//
// C'est le même raisonnement que le fond mondial de la photo aérienne, qui
// « cesse d'être honnête de près » et se coupe plutôt que de servir une bouillie
// (voir refreshAerialCore). Ici on FOND au lieu de couper : la couche est
// décorative, et une extinction franche ferait clignoter au passage du seuil.
//
// Les bornes, tirées de la donnée et pas du goût :
//   · 60 km de côté ≈ 100 pixels source → il y a une forme à voir, plein feu ;
//   · 20 km ≈ 33 pixels → on distingue encore une tache de ville, on s'efface ;
//   · en dessous, plus rien d'honnête : zéro.

export const NUIT_LARGEUR_PLEINE_KM = 60
export const NUIT_LARGEUR_NULLE_KM = 20

/**
 * De combien la couche s'affiche à cette échelle, de 0 à 1.
 *
 * @param {number} largeurKm - le côté de l'emprise affichée, en kilomètres
 * @returns {number}
 */
export function facteurEchelleNuit(largeurKm) {
  if (!Number.isFinite(largeurKm) || largeurKm <= 0) return 0
  if (largeurKm >= NUIT_LARGEUR_PLEINE_KM) return 1
  if (largeurKm <= NUIT_LARGEUR_NULLE_KM) return 0
  return (largeurKm - NUIT_LARGEUR_NULLE_KM) / (NUIT_LARGEUR_PLEINE_KM - NUIT_LARGEUR_NULLE_KM)
}

/**
 * La largeur d'une emprise lon/lat en kilomètres, mesurée à sa latitude.
 *
 * ⚠️ La longitude RÉTRÉCIT avec la latitude : un degré vaut 111 km à
 * l'équateur et 55 km à 60°. Prendre la différence de longitude sans ce cosinus
 * aurait rendu un bloc scandinave deux fois plus large qu'il n'est, et le garde
 * l'aurait laissé passer alors qu'il ne montre rien.
 *
 * @param {{minLon:number,maxLon:number,minLat:number,maxLat:number}|null} bbox
 * @returns {number} 0 si l'emprise est illisible
 */
export function largeurEmpriseKm(bbox) {
  if (!bbox) return 0
  const { minLon, maxLon, minLat, maxLat } = bbox
  if (![minLon, maxLon, minLat, maxLat].every(Number.isFinite)) return 0
  const latMoy = (minLat + maxLat) / 2
  const kmParDegLon = 111.32 * Math.cos((latMoy * Math.PI) / 180)
  const largeur = Math.abs(maxLon - minLon) * kmParDegLon
  const hauteur = Math.abs(maxLat - minLat) * 110.57
  // Le plus GRAND des deux côtés : c'est lui qui décide s'il y a une forme à
  // voir. Une emprise très aplatie garde donc sa couche tant qu'une dimension
  // porte de l'information.
  return Math.max(largeur, hauteur)
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBIEN LA NUIT ALLUME — le couplage à la tirette d'heure
// ═══════════════════════════════════════════════════════════════════════════
//
// Des villes qui brillent à midi seraient un défaut, pas une couche. L'intensité
// suit donc l'heure, et elle la suit avec la MÊME grammaire que le reste du
// site : `daycycle.js` fait déjà varier l'éclairage sur l'heure décimale 0→24.
//
// La courbe, et pourquoi elle n'est pas un simple créneau :
//   · plein feu entre 21 h et 5 h (la vraie nuit) ;
//   · extinction PROGRESSIVE sur les deux crépuscules, parce qu'un basculement
//     net ferait clignoter la carte quand on traîne la tirette — et cette
//     tirette, Adrien la traîne ;
//   · zéro strict entre 7 h et 19 h. Pas « presque zéro » : à zéro, l'appelant
//     peut sauter le rendu entier plutôt que de peindre du noir sur du noir.

/** L'heure où la nuit est pleine, et celle où le jour est plein. */
export const NUIT_PLEINE = [21, 5]
export const JOUR_PLEIN = [7, 19]

/**
 * L'intensité des lumières nocturnes à une heure donnée, de 0 à 1.
 *
 * @param {number} heure - heure décimale, 0 à 24 (24 est traité comme 0)
 * @returns {number} 0 = éteint, 1 = plein feu
 */
export function intensiteNuit(heure) {
  if (!Number.isFinite(heure)) return 0
  const h = ((heure % 24) + 24) % 24
  if (h >= 21 || h < 5) return 1
  if (h >= 7 && h < 19) return 0
  // Aube : 5 h → 7 h, on s'éteint.
  if (h < 7) return 1 - (h - 5) / 2
  // Crépuscule : 19 h → 21 h, on s'allume.
  return (h - 19) / 2
}
