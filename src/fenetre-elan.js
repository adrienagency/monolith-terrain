// L'ÉLAN DE LA FENÊTRE — le terrain continue sur sa lancée puis s'amortit.
//
// Module PUR : ni DOM, ni three.js, ni état. Testable en node.
//
// ══════════ CE QU'ADRIEN A DEMANDÉ ══════════════════════════════════════════
//
// « Donne de l'élan au drag pour qu'il ne s'arrête pas de manière brute ! »
// Après avoir essayé le jalon 1, où le relief se fige à l'instant exact du
// relâchement. Un défilement qui s'arrête net se lit comme une perte du geste :
// la main a encore de la vitesse, l'image n'en a plus.
//
// ══════════ LES DEUX RÈGLES, ET POURQUOI DEUX ═══════════════════════════════
//
// 1. `vitesseAuLache` — DÉCIDER S'IL Y A LANCER. Regarde les dernières
//    millisecondes du geste et rend une vitesse, ou zéro. Le zéro est aussi
//    important que le reste : poser le terrain au pixel près est le geste le
//    plus fréquent, et il ne doit RIEN déclencher.
//
// 2. `pasElan` — FAIRE VIVRE LE LANCER, une image à la fois : frottement,
//    absorption par la butée, extinction.
//
// ══════════ LE MARIAGE AVEC LA BUTÉE ÉLASTIQUE ══════════════════════════════
//
// La butée de `fenetre-course.js` existait avant l'élan, et l'élan doit s'y
// MARIER, pas s'y battre. Trois décisions le règlent :
//
//  · LA VITESSE SE MESURE SUR L'AFFICHÉ, PAS SUR LE BRUT. Au bord, le brut file
//    (le geste continue) pendant que l'affiché est comprimé par l'hyperbole. En
//    mesurant le brut, lâcher au bord donnerait un lancer énorme alors que
//    l'image, elle, ne bougeait plus — le terrain repartirait tout seul sous la
//    main qui vient de le poser.
//
//  · L'ÉLAN INTÈGRE LE BRUT, ET C'EST `borneElastique` QUI DÉCIDE DE L'AFFICHÉ.
//    Même chaîne que pendant le geste : la compression au bord est donc la même
//    qu'on soit encore en train de tirer ou qu'on ait lâché. Aucune couture.
//
//  · HORS COURSE, LA VITESSE EST AMENÉE SUR CELLE DU RAPPEL — pas éteinte.
//
//    ⚠️ CECI EST UNE CORRECTION MESURÉE, pas une élégance. Première version :
//    hors course, la vitesse était simplement amortie très vite, puis le rappel
//    prenait la main une fois l'élan mort. Le banc `.banc/f3-elan.mjs` a montré
//    la couture, en unités par image à Chamonix :
//
//        0,598  0,433  0,263  0,173  0,114  0,076  0,052  0,034  0,024 │ 0,372
//        └────────── l'élan se fait absorber, il s'éteint ───────────┘ └ le
//                                                          rappel démarre À FROID
//
//    Le terrain s'arrêtait presque au bord, puis REPARTAIT d'un coup quinze fois
//    plus vite. C'est exactement le « rebond violent » qu'Adrien a écarté, et
//    c'est le genre de défaut qu'aucun test de la loi seule n'aurait vu.
//
//    La butée n'ÉTEINT donc pas la vitesse : elle la TIRE vers celle qu'aurait
//    le rappel à cet endroit, −excès/TAU_RAPPEL. La vitesse traverse zéro
//    continûment, sortante puis rentrante, et quand elle a convergé, le
//    mouvement EST déjà le rappel — la passation se fait à vitesses égales, donc
//    invisible. Les deux ne tournent toujours jamais ensemble.
//
// ══════════ ET POURQUOI ÇA RESSEMBLE À ORBITCONTROLS ════════════════════════
//
// Le projet a `controls.enableDamping = true` avec `dampingFactor = 0.03`, soit
// un facteur 0,97 par image à 60 im/s. Traduit en constante de temps :
// (1/60) / −ln(0,97) = **0,55 s**. C'est le glissé qu'a déjà la rotation de la
// caméra. On s'en rapproche sans le copier (voir `TAU_ELAN`) : les deux gestes
// se font à la même souris, dans la même image, et un amortissement deux fois
// plus sec sur l'un que sur l'autre se remarque immédiatement.

import { borneElastique, TAU_RAPPEL } from './fenetre-course.js'

// ══════════ LES CONSTANTES, ET CE QUI LES FIXE ══════════════════════════════

// Constante de temps du frottement, en secondes. La distance parcourue par un
// lancer vaut v₀ × TAU_ELAN : à 0,40 s, un lancer vif (~150 unités/s) traverse
// une largeur de socle, ce qui est exactement le geste utile.
//
// ⚠️ RÉGLÉ AU RESSENTI, PAS AU CALCUL. Départ à 0,55 s pour coller à
// OrbitControls : trop flottant ici, parce que le terrain défile sous une
// caméra FIXE — l'œil suit un point du sol et le voit dériver longtemps, là où
// une rotation de caméra emmène toute l'image et se lit comme un mouvement
// voulu. 0,40 s garde le glissé sans la traîne.
const TAU_ELAN = 0.4

// Constante de temps de la PRISE EN MAIN par la butée : le temps que met la
// vitesse du lancer à être remplacée par celle du rappel, une fois le bord
// franchi. Un huitième du frottement — trois images à 60 im/s. Assez ferme pour
// qu'on sente une butée et pas une zone molle, assez souple pour que la
// décélération ne soit pas un mur.
const TAU_ABSORPTION = 0.05

// Sous cette vitesse (unités monde par seconde), l'élan s'éteint net.
// ⚠️ CE SEUIL EST UN POSTE DE DÉPENSE, pas un détail : chaque image d'élan
// coûte `tickFenetre` (9,9 ms) + `plinth.rebuild` (2,2 ms). Une exponentielle
// ne s'annulant jamais, sans seuil on paierait 12 ms par image indéfiniment
// pour un déplacement invisible. 2 unités/s valent **un demi-pixel par image**
// sur un écran de 800 px de haut (1 unité = 14,3 px) : à la limite de la
// perception. Mesuré au banc : l'élan meurt en 1,0 à 1,3 s au lieu de jamais.
export const V_ARRET = 2

// En deçà de cette vitesse au lâcher, AUCUN élan : le terrain se pose là où on
// l'a mis. 6 unités/s valent ~100 px/s d'écran — au-dessus d'un geste de visée
// et bien au-dessous d'un lancer.
export const V_LANCER_MIN = 6

// Plafond de vitesse. Un `pointermove` peut sauter 2 000 px en une image
// (fenêtre revenue au premier plan, souris rattrapée) ; sans plafond l'élan
// traverserait toute l'emprise en une image et s'écraserait au bord. 420
// unités/s = 7,5 largeurs de socle par seconde, plus que tout geste humain.
const V_MAX = 420

// Largeur de la fenêtre de mesure de vitesse, en secondes. Trois à quatre
// images : assez pour moyenner le bruit du capteur, assez peu pour que la
// vitesse soit bien celle de la FIN du geste et pas celle de son milieu.
const FENETRE_MESURE = 0.06

// Âge maximal du dernier mouvement au moment du lâcher. Au-delà, la main s'est
// arrêtée pour viser avant de relâcher : relancer serait contredire le geste.
const AGE_MAX = 0.12

// Pas d'intégration maximal. Un onglet réveillé rend un dt de plusieurs
// secondes ; `v × dt` enverrait la fenêtre au bout de l'emprise en une image.
const DT_MAX = 0.05

/**
 * Vitesse à donner à la fenêtre au moment du lâcher, ou zéro.
 *
 * ⚠️ Les échantillons portent l'AFFICHÉ (`terrain.fenetre`), pas le brut — voir
 * l'en-tête : au bord, le brut file alors que l'image ne bouge plus.
 *
 * ⚠️ On divise par `tLache − premier.t`, pas par la durée entre échantillons.
 * Une hésitation de quelques images avant le relâchement rend donc mécaniquement
 * une vitesse plus faible. Sans ça la loi aurait une falaise : même geste, tout
 * ou rien selon une milliseconde.
 *
 * @param {{t:number,x:number,z:number}[]} echantillons - positions AFFICHÉES
 *        horodatées en secondes, dans l'ordre chronologique
 * @param {number} tLache - instant du relâchement, en secondes
 * @returns {{x:number,z:number}} unités monde par seconde
 */
export function vitesseAuLache(echantillons, tLache) {
  const nul = { x: 0, z: 0 }
  if (!echantillons || echantillons.length < 2) return nul
  const dernier = echantillons[echantillons.length - 1]
  if (tLache - dernier.t > AGE_MAX) return nul
  // le plus ancien échantillon encore dans la fenêtre de mesure
  let premier = dernier
  for (let i = echantillons.length - 1; i >= 0; i--) {
    if (dernier.t - echantillons[i].t > FENETRE_MESURE) break
    premier = echantillons[i]
  }
  const dt = Math.max(tLache, dernier.t) - premier.t
  if (dt < 1e-4) return nul
  let vx = (dernier.x - premier.x) / dt
  let vz = (dernier.z - premier.z) / dt
  const v = Math.hypot(vx, vz)
  if (v < V_LANCER_MIN) return nul
  if (v > V_MAX) {
    vx *= V_MAX / v
    vz *= V_MAX / v
  }
  return { x: vx, z: vz }
}

/**
 * Tire une vitesse vers celle qu'aurait le rappel élastique à cet endroit.
 *
 * Hors de la course, `rappelElastique` fait décroître l'excès en exp(−dt/τ) :
 * sa vitesse instantanée vaut donc −signe(excès) × excès / TAU_RAPPEL. C'est
 * cette valeur, et pas zéro, que l'élan doit rejoindre — sinon le mouvement
 * s'arrête avant de repartir, et le raccord se voit (voir l'en-tête).
 *
 * Dans la course, la butée n'a rien à dire : la vitesse ressort intacte.
 *
 * @param {number} v - vitesse de l'axe
 * @param {number} brut - position brute de l'axe
 * @param {number} course - la demi-course autorisée
 * @param {number} a - part du chemin à faire cette image, dans [0, 1]
 * @returns {number}
 */
function versRappel(v, brut, course, a) {
  const exces = Math.abs(brut) - course
  if (exces <= 0) return v
  const cible = -Math.sign(brut) * (exces / TAU_RAPPEL)
  return v + (cible - v) * a
}

/**
 * Le bord est un ÉQUILIBRE : l'élastique ramène jusqu'au bord et s'y arrête.
 *
 * ⚠️ SANS CETTE RÈGLE, L'ÉLASTIQUE RELANCE LE TERRAIN VERS L'INTÉRIEUR. La
 * vitesse rejoint celle du rappel avec un retard (`TAU_ABSORPTION`) : quand
 * l'axe touche enfin le bord, il lui reste un peu de vitesse rentrante, et il
 * continue. Mesuré : 0,58 unité — 8 pixels — de dépassement vers l'intérieur.
 * C'est un rebond, exactement ce qu'Adrien a écarté (« absorbé, pas de rebond »).
 *
 * ⚠️ ET POURQUOI UNE CONDITION PLUTÔT QU'UN CLAMP SEC. Un lancer VOULU vers
 * l'intérieur, parti d'une position en débordement, doit traverser le bord et
 * continuer sa route — s'arrêter net au bord serait le bogue symétrique. On
 * distingue les deux par la vitesse : l'élastique ne rend jamais plus que sa
 * propre vitesse de rappel (excès / TAU_RAPPEL). Plus vite que ça, c'est la main.
 *
 * @returns {{brut:number, v:number}} position et vitesse corrigées de l'axe
 */
function poseAuBord(avant, brut, v, course) {
  const exces = Math.abs(avant) - course
  if (exces <= 0) return { brut, v }
  if (Math.sign(v) !== -Math.sign(avant)) return { brut, v } // encore sortant
  if (Math.abs(brut) >= course) return { brut, v } // pas encore rentré
  if (Math.abs(v) > exces / TAU_RAPPEL + V_ARRET) return { brut, v } // c'est la main
  return { brut: Math.sign(avant) * course, v: 0 }
}

/**
 * Fait vivre l'élan d'une image.
 *
 * Rend la même forme qu'`avanceFenetre` — affiché et brut côte à côte — plus la
 * vitesse restante. `actif` à `false` signifie « l'élan est mort, le rappel
 * élastique peut prendre la main » : les deux ne tournent JAMAIS ensemble.
 *
 * @param {{x:number,z:number,vx:number,vz:number}} etat - position BRUTE et vitesse
 * @param {number} dt - secondes écoulées depuis l'image précédente
 * @param {number} course - la demi-course autorisée
 * @returns {{x:number,z:number,brutX:number,brutZ:number,vx:number,vz:number,actif:boolean}}
 */
export function pasElan(etat, dt, course) {
  const d = Math.min(Math.max(dt, 0), DT_MAX)
  // ⚠️ LA POSITION D'ABORD, LA VITESSE ENSUITE. Amortir avant d'avancer perdrait
  // une image de course à chaque pas, et le lancer serait ~4 % plus court à
  // 30 im/s qu'à 60 : le réglage se ferait sur la mauvaise machine.
  const brutX = etat.x + etat.vx * d
  const brutZ = etat.z + etat.vz * d
  // Frottement en exp(−dt/τ) et non « × 0,9 » : même raison que `rappelElastique`
  // — sinon l'élan serait deux fois plus long sur l'iMac 2015 que sur la machine
  // de développement.
  const k = Math.exp(-d / TAU_ELAN)
  let vx = etat.vx * k
  let vz = etat.vz * k
  // PRISE EN MAIN PAR LA BUTÉE, PAR AXE. Taper le bord droit ne doit pas
  // éteindre le glissement vertical : un seul traitement commun figerait tout
  // dès qu'un seul des deux axes touche.
  const a = 1 - Math.exp(-d / TAU_ABSORPTION)
  vx = versRappel(vx, brutX, course, a)
  vz = versRappel(vz, brutZ, course, a)
  // Le bord est un équilibre : l'élastique s'y pose, il ne rebondit pas dedans.
  const px = poseAuBord(etat.x, brutX, vx, course)
  const pz = poseAuBord(etat.z, brutZ, vz, course)
  vx = px.v
  vz = pz.v
  // ⚠️ L'ARRÊT SE JUGE SUR LA NORME. Couper axe par axe ferait tourner la
  // trajectoire dans ses derniers dixièmes de seconde : un lancer en diagonale
  // finirait à l'horizontale, ce qui se voit.
  //
  // ⚠️ ET C'EST ICI QUE LA PASSATION EST INVISIBLE. Hors course, la vitesse a
  // convergé sur celle du rappel : au moment où on l'annule, `rappelElastique`
  // rendra très exactement la même — il reste alors V_ARRET × TAU_RAPPEL, soit
  // 0,24 unité (3 pixels), à parcourir en s'éteignant. Aucune reprise à froid.
  if (Math.hypot(vx, vz) < V_ARRET) {
    vx = 0
    vz = 0
  }
  return {
    x: borneElastique(px.brut, course),
    z: borneElastique(pz.brut, course),
    brutX: px.brut,
    brutZ: pz.brut,
    vx,
    vz,
    actif: vx !== 0 || vz !== 0,
  }
}
