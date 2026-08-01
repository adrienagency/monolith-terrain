// QUAND LA FENÊTRE PASSE DE 384 À 768 — et surtout, quand elle N'Y PASSE PAS.
//
// Module PUR : ni DOM, ni three.js, ni horloge. Testable en node.
//
// ══════════ CE QUE ÇA RÉCUPÈRE ═════════════════════════════════════════════
//
// C'est le levier des 12,2 ms par image du grain en coordonnées monde (§3.4 de
// l'étude). Mesuré par une session précédente, emprise 3×3, La Réunion z13 et
// Chamonix z12 : la fabrication d'une dalle passe de **36,0 ms à res 768 à
// 9,9 ms à res 384** — le budget par image de l'étude est de 6 ms.
//
// Le jalon 3 a pris le plus simple qui marche : 384 EN PERMANENCE. Le drag y
// est fluide, mais on regarde du 384 même arrêté, alors que rien n'empêche d'y
// remettre le grain d'aujourd'hui quand plus personne ne bouge.
//
// ══════════ LE PIÈGE, ET IL EST DANS LES LEÇONS DE LA BRANCHE ═══════════════
//
// ⚠️ LA VITESSE MÉMORISÉE MENT. `pasElan` ANNULE `_f3V` dès que la norme passe
// sous `V_ARRET` — et c'est `rappelElastique` qui prend la suite, lequel n'a
// AUCUNE variable de vitesse : il déplace la position directement, en
// exp(−dt/τ). Un détecteur de repos branché sur `_f3V` verrait donc « arrêté »
// alors que l'image glisse encore, et raffinerait EN PLEIN MOUVEMENT.
//
// C'est exactement la leçon nº 3 de cette branche — « un test de position ne
// voit pas un à-coup : pour tout ce qui bouge, regarde la dérivée » — appliquée
// à l'envers : ici c'est la vitesse DÉCLARÉE qui est fausse, et il faut la
// remesurer sur ce qui est AFFICHÉ. `pas()` ne prend donc pas de vitesse : il
// prend la position, et fait la dérivée lui-même. Les trois régimes (geste,
// élan, rappel élastique) se retrouvent alors couverts par la même mesure, sans
// que ce module ait à savoir lequel tourne.
//
// ══════════ POURQUOI UN DÉLAI, ET POURQUOI CELUI-LÀ ═════════════════════════
//
// Un raffinement qui part à la première image immobile serait un CLIGNOTEMENT :
// le geste courant d'une carte est une suite de coups de souris séparés de
// quelques dixièmes de seconde, et on paierait un aller-retour 384→768→384
// entre chacun. Adrien : « si la bascule saute à l'œil, elle est ratée ».
//
// Le délai court APRÈS l'extinction de l'élan, pas après le lâcher : l'élan met
// lui-même 1,0 à 1,3 s à mourir (mesuré, fenetre-elan.js). Le raffinement
// arrive donc ~1,5 s après un lancer — le temps qu'il faut pour que l'image
// soit vraiment posée, et pas une milliseconde de plus.
export const REPOS_S = 0.4

// Sous cette vitesse d'AFFICHÉ, on considère la fenêtre arrêtée. Même chiffre
// que `V_ARRET` de l'élan, et pour la même raison chiffrée : 2 unités/s valent
// un demi-pixel par image sur un écran de 800 px de haut (1 unité = 14,3 px),
// c'est-à-dire la limite de la perception. Deux seuils différents pour la même
// notion d'« arrêté » finiraient par diverger.
export const V_REPOS = 2

// ══════════ LE PLAFOND DU REPOS, ET IL N'EST PAS COSMÉTIQUE ═════════════════
//
// ⚠️ NE PAS SERVIR `params.resolution` TEL QUEL. Le sélecteur monte à 2048 ;
// en emprise 3×3, le grain pré-cuit s'étale sur l'emprise ENTIÈRE, soit
// (3×2048+1)² × 2 octaves = **302 Mo pour le seul champ de grain**, sur un
// budget total de 260 Mo. Un utilisateur qui laisse le curseur au maximum ferait
// tomber l'onglet à la première pause, et le lien de cause à effet serait
// introuvable (il n'a rien touché, il a juste arrêté de bouger).
//
// 768 est le grain du bloc ordinaire d'aujourd'hui, et c'est très exactement ce
// que proposait l'étude : « si Adrien veut la fenêtre à res 768 (le grain
// d'aujourd'hui) : +28,7 Mo de géométrie » (§3.4). On ne promet donc rien de
// plus fin que ce que le mode ordinaire montre déjà.
export const RES_REPOS_MAX = 768

/**
 * La résolution à servir, et si elle vient de changer.
 *
 * Machine à deux états avec HYSTÉRÉSIS ASYMÉTRIQUE, et l'asymétrie est le
 * cœur du réglage :
 *
 *  · vers le GROSSIER, on descend À L'IMAGE MÊME — dès qu'un doigt se pose ou
 *    que l'image bouge. Tarder d'une seule image ferait payer les 36 ms de la
 *    res 768 au premier pas du geste, c'est-à-dire à l'instant précis où
 *    l'utilisateur juge si le drag est fluide.
 *
 *  · vers le FIN, on remonte APRÈS `REPOS_S` d'immobilité franche. C'est le
 *    seul sens où l'attente est gratuite : personne ne regarde une image
 *    arrêtée en attendant qu'elle s'affine.
 *
 * @param {{fin:boolean, repos:number, x:number, z:number, amorce:boolean}} etat
 *        l'état précédent — `amorce` à false tant qu'aucune position n'a été vue
 * @param {{glisse:boolean, x:number, z:number, dt:number}} vue
 *        le doigt est-il posé, et où est la fenêtre AFFICHÉE
 * @returns {{fin:boolean, repos:number, x:number, z:number, amorce:boolean, change:boolean}}
 */
export function pasFinesse(etat, vue) {
  const dt = Math.max(0, vue.dt || 0)
  // ⚠️ LA PREMIÈRE IMAGE N'A PAS DE DÉRIVÉE. Sans `amorce`, la position initiale
  // se comparerait à un zéro par défaut : à Chamonix, ouvrir la carte avec la
  // fenêtre à 30 unités donnerait une « vitesse » de 1 800 unités/s à la
  // première image, et le repos ne partirait qu'une demi-seconde trop tard.
  const v = etat.amorce && dt > 0 ? Math.hypot(vue.x - etat.x, vue.z - etat.z) / dt : 0
  const bouge = vue.glisse || v > V_REPOS
  // Le compteur se remet à ZÉRO, il ne se décrémente pas : une image de
  // mouvement au milieu d'une pause repart de zéro. Un compteur qui redescend
  // laisserait passer un raffinement au milieu d'un geste haché.
  const repos = bouge ? 0 : etat.repos + dt
  const fin = bouge ? false : etat.fin || repos >= REPOS_S
  return { fin, repos, x: vue.x, z: vue.z, amorce: true, change: fin !== etat.fin }
}

/** L'état de départ : grossier, comme le jalon 3, et sans position connue. */
export const finesseInitiale = () => ({ fin: false, repos: 0, x: 0, z: 0, amorce: false })

/**
 * La résolution du maillage pour un état donné.
 *
 * ⚠️ `Math.min` DANS LES DEUX BRANCHES. Un utilisateur qui choisit 256 dans les
 * Paramètres doit obtenir 256, pas se voir imposer 384 par le mode continu : le
 * mode continu est là pour BRIDER une machine, jamais pour la charger plus que
 * ce qu'on lui a demandé.
 *
 * @param {boolean} fin
 * @param {number} resVoulue - `params.resolution`
 * @param {number} resDrag - le plafond pendant le mouvement (RES_FENETRE_CONTINUE)
 * @returns {number}
 */
export function resDeFinesse(fin, resVoulue, resDrag) {
  return fin ? Math.min(resVoulue, RES_REPOS_MAX) : Math.min(resVoulue, resDrag)
}

// ══════════ LES DEUX FINESSES, POUR QUI DOIT LES PRÉPARER ═══════════════════
//
// ⚠️ CE QUI RESTAIT À TROUVER, ET QUI NE SE VOIT QUE DANS LE NAVIGATEUR. La
// bascule est gratuite tant que le champ de grain de la résolution VISÉE est
// déjà cuit — le cache à deux entrées de `detail-noise.js` est là pour ça. Mais
// la PREMIÈRE bascule d'une session ne trouve rien, et elle cuit.
//
// Mesuré sur l'instance vivante (pas un second exemplaire rendu par un import()
// à la main), La Réunion z12 en 3×3, `terrain.majResFenetre` chronométrée
// autour :
//
//     bascule vers 384, champ déjà cuit │    18 ms
//     bascule vers 768, champ déjà cuit │    73 ms
//     bascule vers 384, champ À CUIRE   │   373 ms
//     bascule vers 768, champ À CUIRE   │ 1 516 ms   ← une seconde et demie
//
// 1,5 s de gel arrivant 0,4 s après que la carte s'est posée, sans que
// l'utilisateur ait touché à quoi que ce soit : c'est le cas d'école de « une
// dégradation ne doit pas se voir comme une panne ». Et un banc synthétique ne
// l'aurait pas vu — le module pur, lui, bascule en zéro milliseconde.
//
// La cuisson elle-même est incompressible ici (285 ns le point, 5,31 M points à
// res 768). Ce qui est déplaçable, c'est le MOMENT : sous le voile de
// chargement, où l'on attend déjà, plutôt qu'en pleine contemplation. D'où
// cette fonction — elle nomme les deux clés que le mode va s'échanger, pour que
// l'appelant les prépare TOUTES LES DEUX pendant qu'il a le droit d'être lent.
//
// ⚠️ LES DEUX, ET PAS SEULEMENT LA FINE. La reconstruction cuit celle de
// l'instant ; l'autre reste à découvert. Après la première bascule, `resFenetre`
// vaut 768 et c'est donc la GROSSIÈRE qui manque — celle qu'on va chercher au
// premier appui du doigt, à l'instant précis où l'on juge si le drag est fluide.
//
// @param {number} resVoulue - `params.resolution`
// @param {number} resDrag - le plafond pendant le mouvement (RES_FENETRE_CONTINUE)
// @returns {number[]} une ou deux résolutions, sans doublon
export function resFinesses(resVoulue, resDrag) {
  const mouvement = resDeFinesse(false, resVoulue, resDrag)
  const repos = resDeFinesse(true, resVoulue, resDrag)
  return mouvement === repos ? [mouvement] : [mouvement, repos]
}
