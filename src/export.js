// Export helpers — still-image capture at arbitrary resolution and MP4
// recording via mediabunny (WebCodecs). The canvas uses
// preserveDrawingBuffer:false, so every capture renders through the composer
// and reads the canvas back synchronously in the same task.

import * as THREE from 'three'
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } from 'mediabunny'
import { safeAspect, glSizeLimit, fitDrawingBuffer } from './viewport.js'
import { planTuiles, cadrageTuile, poidsRendu } from './print-page.js'
import { COTE_TUILE } from './export-dpi.js'
import { planPavage } from './export-effets.js'

// Ces trois-là sont exportées pour l'enregistreur vidéo (export-recorder.js),
// qui force lui aussi la taille du canevas le temps d'une capture. Deux copies
// de cette danse — dont une seule connaîtrait le piège de l'aspect NaN
// ci-dessous — était le vrai risque.
export function saveState(renderer, camera) {
  const size = renderer.getSize(new THREE.Vector2())
  return { width: size.x, height: size.y, pixelRatio: renderer.getPixelRatio(), aspect: camera.aspect }
}

// ---------------------------------------------------------------------------
// LE PLAFOND MATÉRIEL SUR LE CHEMIN D'EXPORT
// ---------------------------------------------------------------------------
//
// `applyRenderSize` (viewport.js) borne le rendu temps réel. L'export ne passe
// PAS par là, et c'est délibéré : un export 4K doit rester un vrai 4K, un test
// verrouille la séparation des deux chemins (viewport-aspect.test.js). Le prix
// de cette séparation, jamais payé jusqu'ici : ce chemin-ci n'avait AUCUN
// plafond. Le 50 × 70 paysage — le format par défaut de la boutique — réclame
// 8 339 px de large à 300 dpi ; `MAX_RENDERBUFFER_SIZE` vaut 8 192 sur une
// bonne moitié du parc ; et le pilote rabote alors UNE SEULE dimension, sans
// exception ni un mot en console. L'affiche sort écrasée de 1,8 %, avec 13 mm
// de papier nu sur un bord, et le défaut se découvre après le tirage payé.
//
// ═══ ÉCRÊTER OU REFUSER ? NI L'UN NI L'AUTRE ═══════════════════════════════
//
// ÉCRÊTER EN SILENCE est exactement le défaut d'origine : c'est ce que fait
// déjà le pilote. Le refaire à la main proprement ne changerait rien à ce qui
// blesse — l'image déformée — et rendrait juste la faute nôtre.
//
// REFUSER (lever) casserait un appelant qui marchait. `applySize` est PARTAGÉ
// avec l'enregistreur vidéo : une exception ici perdrait un enregistrement en
// cours pour une taille que la carte aurait rendue un cheveu moins fine. Et
// refuser est bien le bon geste — mais UN CRAN PLUS HAUT, avant toute promesse
// à l'acheteur : c'est `degradePour` (export-dpi.js) qui rend `null` et retire
// le format de la grille. On ne refuse pas au moment de peindre.
//
// LA TROISIÈME VOIE — celle retenue : RÉDUIRE PROPORTIONNELLEMENT, LE DIRE, ET
// LE RENDRE. Les deux côtés reculent du MÊME facteur, donc l'aspect survit au
// pixel d'arrondi près : on perd de la finesse, jamais la géométrie. C'est déjà
// la règle de `fitDrawingBuffer` pour l'affichage, et deux règles opposées pour
// le même problème seraient une incohérence de plus à découvrir un jour. Le
// `console.warn` casse le silence qui a rendu ce défaut invisible, et la valeur
// de retour laisse l'appelant constater ce qui a VRAIMENT été rendu.
//
// ═══ QUI CONNAÎT LA LIMITE ═════════════════════════════════════════════════
//
// Personne ici. `glSizeLimit` (viewport.js) la mesure déjà — le plus petit de
// MAX_TEXTURE_SIZE et MAX_RENDERBUFFER_SIZE — et `fitDrawingBuffer` sait déjà
// reculer sans déformer, parité comprise. On les importe. Deux sources pour une
// même vérité finissent toujours par diverger, et celle-là ne se contredit
// qu'au moment du tirage.
//
// ═══ ET `degradePour` DANS TOUT ÇA ? INDÉPENDANT, VOLONTAIREMENT ═══════════
//
// 1. `applySize` est partagé avec la vidéo, qui n'a ni format d'affiche ni dpi.
//    `degradePour(format, orientation, limite)` n'aurait rien à lui dire.
// 2. Les deux ne répondent pas à la même question. `degradePour` DÉCIDE avant
//    (quelle densité promettre) ; ce plafond-ci CONSTATE après (ce que la carte
//    accepte réellement). Un filet qui dépend de l'arithmétique de celui qu'il
//    doit rattraper n'est pas un filet.
// 3. Ils lisent la MÊME limite mesurée, donc ils ne peuvent pas se contredire :
//    quand `degradePour` a fait son travail, ce plafond ne mord jamais. S'il
//    mord, c'est qu'une taille est arrivée ici sans passer par lui — et
//    l'avertissement ci-dessous est précisément là pour le dire.

// La taille réellement servie au compositeur : celle demandée tant que la carte
// suit, une réduction proportionnelle sinon.
//
// ⚠️ RETOUR À L'IDENTIQUE QUAND ÇA PASSE, ET C'EST LA CONTRAINTE QUI PRIME.
// Tant que le grand côté tient sous la limite — ou qu'aucune limite n'est
// lisible — on ressort les nombres reçus, tels quels, sans les faire transiter
// par le moindre calcul. Les crans du menu d'export plafonnent à 3 840 px
// (export-presets.js) : l'enregistreur vidéo ne peut donc pas atteindre cette
// branche, et son comportement reste strictement celui d'avant ce garde-fou.
export function tailleSousPlafond(renderer, width, height) {
  // un contexte perdu ne doit pas empêcher un export : sans limite lisible on
  // sert la taille demandée, exactement comme applyRenderSize (viewport.js)
  let limite = 0
  try { limite = glSizeLimit(renderer?.getContext?.()) } catch { limite = 0 }
  if (!(limite > 0) || !(Math.max(width, height) > limite)) return [width, height]
  // densité 1 : le tampon de dessin VAUT ces pixels-là (setPixelRatio(1) juste
  // au-dessus), donc c'est bien la taille demandée qu'on soumet à la limite.
  const fit = fitDrawingBuffer(width, height, 1, limite)
  console.warn(
    `[ShibuMap] export raboté : ${width}×${height} demandés dépassent la limite matérielle `
    + `de cette carte (${limite} px). Taille ramenée à ${fit.width}×${fit.height} — `
    + `les deux côtés du même facteur, aspect préservé (${(width / height).toFixed(4)} → `
    + `${(fit.width / fit.height).toFixed(4)}). Sans ce garde-fou, le pilote rabote UNE SEULE `
    + `dimension, sans rien dire, et l'affiche part à l'impression écrasée.`
  )
  return [fit.width, fit.height]
}

// `aspect` est celui de l'IMAGE ENTIÈRE, pas celui du morceau qu'on rend.
// three construit le frustum complet à partir de `aspect`, puis `setViewOffset`
// y découpe une fenêtre : passer l'aspect d'une tuile étirerait chaque tuile.
// Par défaut il vaut celui de la taille demandée — c'est le cas du rendu plein
// cadre, et c'est ce que l'enregistreur vidéo obtient sans rien changer.
//
// Renvoie la taille RÉELLEMENT appliquée : elle peut différer de la demande si
// le plafond matériel a mordu (voir au-dessus).
export function applySize({ renderer, composer, camera }, width, height, aspect = safeAspect(width, height)) {
  renderer.setPixelRatio(1)
  const [w, h] = tailleSousPlafond(renderer, width, height)
  composer.setSize(w, h, false)
  // Ici on ne peut pas renoncer comme le fait le resize (l'appelant attend une
  // image), donc on borne à 1 px au lieu de risquer `0 / 0`. Un export vidéo
  // enchaîne des centaines de frames sur cette même caméra : un aspect NaN posé
  // une fois y resterait jusqu'à la fin, muet, et ressortirait ensuite par
  // restoreState dans la vue interactive. Voir viewport.js.
  //
  // ⚠️ L'ASPECT SUIT LA DEMANDE, PAS LE TAMPON — même règle qu'applyRenderSize
  // (« la caméra suit le cadre, jamais le tampon »). La réduction ci-dessus est
  // proportionnelle : l'écart est celui d'un arrondi, alors qu'aligner l'aspect
  // sur le tampon raboté déplacerait le cadrage de l'utilisateur.
  camera.aspect = aspect
  camera.updateProjectionMatrix()
  return { width: w, height: h, aspect, rabote: w !== width || h !== height }
}

export function restoreState({ renderer, composer, camera }, saved) {
  renderer.setPixelRatio(saved.pixelRatio)
  composer.setSize(saved.width, saved.height, false)
  camera.aspect = saved.aspect
  camera.updateProjectionMatrix()
}

// ATTRIBUTION DES EXPORTS — la contrepartie des licences des données.
//
// Le bandeau de crédits en bas d'écran est du DOM : il ne part PAS dans le
// canevas WebGL, donc une image exportée n'en portait aucune trace. Or les
// licences qui nous coûtent quelque chose s'appliquent d'abord aux images
// diffusées ou VENDUES : ODbL pour OpenStreetMap, Licence Ouverte 2.0 pour
// l'IGN RGE ALTI (via Mapterhorn), les conditions GEBCO pour la bathymétrie.
// D'où cette ligne, incrustée après coup sur un canevas 2D.
//
// Discrète par construction : hauteur proportionnelle à l'image (0,9 %), en bas
// à droite, blanc translucide sur ombre portée pour rester lisible sur un fond
// clair comme sur un fond sombre.
export const EXPORT_CREDIT = '© Adrien Agency · © OpenStreetMap contributors · © Mapterhorn · GEBCO_2026'

// ⚠️ LA BATHYMÉTRIE FINE N'EST PAS DANS LA LIGNE CI-DESSUS, ET C'EST DÉLIBÉRÉ.
// Depuis le 2026-07-28, une zone peut être creusée par une source régionale
// (EMODnet sur la France, plus tard BlueTopo ou Copernicus) dont l'attribution
// est OBLIGATOIRE et dont la formulation est IMPOSÉE MOT POUR MOT par la
// licence — « This data product was created by EMODnet… » ne se paraphrase pas.
//
// Or elle dépend de l'emprise : citer EMODnet sur une carte du Japon serait
// faux, et l'omettre sur une carte de Brest serait une violation. La liste
// exacte se calcule donc à l'export, par `creditsForBounds(index, bounds)`
// (src/bathy-sources.js), qui rend aussi la mention « not to be used for
// navigation » exigée par les quatre sources.
//
// 🔴 TANT QUE `creditFor()` N'EST PAS APPELÉ À L'EXPORT, ne cuire aucune tuile
// d'une source à attribution imposée pour une zone que le public peut exporter.
// La France EMODnet est livrée AVEC ce câblage, jamais avant.
export function creditFor(bathyIndex, bounds, creditsForBounds) {
  const sup = creditsForBounds(bathyIndex, bounds) || []
  // GEBCO est déjà nommé dans la ligne de base : on ne le répète pas.
  const neufs = sup.filter((c) => !EXPORT_CREDIT.includes('GEBCO') || !c.startsWith('GEBCO'))
  return [EXPORT_CREDIT, ...neufs].join(' · ')
}

async function stampCredit(blob, width, height, format, quality, text) {
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const g = c.getContext('2d')
  g.drawImage(bmp, 0, 0, width, height)
  bmp.close?.()
  const px = Math.max(11, Math.round(height * 0.009))
  const pad = Math.round(px * 1.6)
  g.font = `${px}px system-ui, -apple-system, "Segoe UI", sans-serif`
  g.textAlign = 'right'
  g.textBaseline = 'bottom'
  g.shadowColor = 'rgba(0,0,0,0.55)'
  g.shadowBlur = px * 0.6
  g.fillStyle = 'rgba(255,255,255,0.72)'
  g.fillText(text, width - pad, height - pad)
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas capture failed'))), format, quality)
  )
}

// Render one frame at width x height and return it as an image Blob.
// `credit` : texte d'attribution incrusté en bas à droite. Passer `null` le
// retire — à ne faire que pour un usage où l'attribution est portée ailleurs.
export async function exportImage({
  renderer,
  composer,
  camera,
  width,
  height,
  format = 'image/png',
  quality = 0.95,
  credit = EXPORT_CREDIT,
}) {
  const ctx = { renderer, composer, camera }
  const saved = saveState(renderer, camera)
  let pending
  // ⚠️ LA TAILLE VRAIMENT PEINTE, PAS CELLE DEMANDÉE — voir plus bas.
  let peint = { width, height, rabote: false }
  try {
    peint = applySize(ctx, width, height)
    composer.render()
    // toBlob snapshots the bitmap synchronously at call time, so it is safe
    // to restore the previous size right after issuing it.
    pending = new Promise((resolve, reject) => {
      renderer.domElement.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas capture failed'))),
        format,
        quality,
      )
    })
  } finally {
    restoreState(ctx, saved)
  }
  const blob = await pending
  if (!credit) return blob
  // ═══ POURQUOI `peint` ET NON `width`/`height` ═══════════════════════════
  //
  // `stampCredit` REDESSINE l'image sur un canevas 2D avant d'y poser la
  // ligne d'attribution. Tant qu'il recevait les dimensions DEMANDÉES, il
  // redessinait un tampon raboté par le plafond matériel dans un canevas plus
  // grand : `drawImage(bmp, 0, 0, width, height)` étire. On retrouvait donc,
  // par un autre chemin, exactement le défaut que le plafond corrigeait — un
  // ré-échantillonnage silencieux, cette fois de notre main.
  //
  // ⚠️ ET CETTE BRANCHE N'EST PAS THÉORIQUE, contrairement à ce qu'on pouvait
  // espérer du pavage. Le pavage la rend inatteignable POUR L'AFFICHE (les
  // tuiles tiennent sous 2 048, le plancher garanti de WebGL2), mais
  // `exportImage` sert aussi le menu d'export d'écran, dont le cran 4K demande
  // 3 840 px : sur une machine dont `MAX_TEXTURE_SIZE` vaut 2 048 — la valeur
  // minimale que la spécification WebGL2 autorise — le plafond mord pour de
  // bon. On livre alors un fichier plus petit, net, plutôt qu'un fichier
  // aux dimensions promises et flou. Le `console.warn` de `tailleSousPlafond`
  // a déjà dit ce qui s'est passé.
  //
  // une incrustation ratée ne doit jamais faire perdre l'export à l'utilisateur
  try {
    return await stampCredit(blob, peint.width, peint.height, format, quality, credit)
  } catch {
    return blob
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LE PAVAGE D'UNE AFFICHE — LES TROIS INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════
//
// `planTuiles`, `cadrageTuile` et `poidsRendu` (print-page.js) existent, sont
// testés, et n'étaient appelés que par leur propre test. Ce qui suit les
// BRANCHE. Il ne recalcule aucune de leurs grandeurs : la propriété qui compte
// — la somme des tuiles retombe EXACTEMENT sur la taille pleine — n'est vraie
// que si personne ne la refait à côté.
//
// Trois invariants tiennent tout le reste, et chacun a son test :
//
//   ① CHAQUE PIXEL DE L'AFFICHE EST ÉCRIT UNE FOIS, ET UNE SEULE. Pas « à peu
//      près » : un pixel jamais écrit est une ligne claire en travers du
//      tirage, un pixel écrit deux fois est une bande sombre. Le test compte
//      les écritures, pixel par pixel, sur un pavage aux dimensions
//      volontairement indivisibles.
//   ② AUCUNE IMAGE PLEINE N'EXISTE JAMAIS. On compose BANDE PAR BANDE — une
//      ligne de tuiles — et on encode chaque bande avant d'ouvrir la suivante.
//      Le plus grand canevas jamais alloué reste sous `MPX_CANEVAS_MAX`.
//   ③ LA TUILE RENDUE, RECOUVREMENT COMPRIS, TIENT SOUS 2 048. C'est le
//      plancher garanti de WebGL2 : en dessous, aucune détection matérielle
//      n'est nécessaire. Le recouvrement des effets de voisinage
//      (export-effets.js) est donc retiré du côté de la tuile AVANT de paver,
//      jamais ajouté après.
//
// ═══ POURQUOI LA BANDE, ET PAS LA COLONNE ═════════════════════════════════
//
// Une bande est une LIGNE de tuiles, large comme l'affiche et haute comme une
// tuile. C'est le seul découpage qui permette d'encoder au fil : un encodeur
// d'image lit ses lignes de haut en bas, et une bande est un préfixe complet.
// Une colonne, elle, obligerait à garder toute la largeur ouverte jusqu'au
// bout — c'est-à-dire l'image pleine, précisément ce qu'on refuse.
//
// ═══ CE QUE COÛTE LE MONO-CANEVAS, PAR `poidsRendu` ════════════════════════
//
// Sur un A2 paysage (7 087 × 5 032, le pire des sept formats) :
//   · rendu plein cadre  : 1 141 Mo  (cible ×4 échantillons + profondeur +
//                                     ping-pong, plus le canevas pleine taille)
//   · rendu pavé          :   226 Mo  (poidsRendu, qui compte ENCORE un canevas
//                                     pleine taille : c'est son modèle)
//   · pavé + bande par bande : ~131 Mo mesurés — le canevas pleine taille
//                                     n'existe pas, il est remplacé par une
//                                     bande de 11,89 Mpx.
// Voir `scripts/mesure-pavage-affiche.mjs`, committé pour que ces trois
// chiffres se rejouent.

/**
 * Le plus grand canevas de composition qu'on s'autorise, en pixels.
 *
 * ⚠️ CE N'EST PAS UNE LIMITE MATÉRIELLE, C'EST UNE MARGE. Safari iOS refuse
 * d'allouer au-delà d'environ 16,7 Mpx (4 096 × 4 096) et le fait EN SILENCE :
 * le canevas existe, il est simplement vide. 11,9 Mpx laisse 29 % sous ce
 * seuil — assez pour que la mesure d'un appareil un peu plus sévère que la
 * moyenne ne se découvre pas sur un tirage payé.
 *
 * La bande la plus large des quatorze combinaisons format × orientation est
 * celle de l'A2 paysage : 7 087 × 1 678 = 11 891 986 px. Elle passe, mais à
 * 0,07 % près. D'où le garde-fou ci-dessous plutôt qu'une chance reconduite.
 */
export const MPX_CANEVAS_MAX = 11.9e6

/**
 * Le côté de tuile réellement utilisable, une fois retirés le recouvrement des
 * effets de voisinage ET la contrainte de bande.
 *
 * ⚠️ LE RECOUVREMENT SE RETIRE, IL NE S'AJOUTE PAS. Une tuile de 2 048
 * élargie de 54 px de chaque côté ferait 2 156 px — au-dessus du plancher
 * garanti de WebGL2, donc au-dessus de ce qu'on a le droit de supposer. On
 * pave donc à `2048 − 2·marge` et on rend `2048` : la fenêtre rendue tient
 * toujours, quel que soit le `bokehScale` choisi par l'utilisateur (il monte à
 * 18 dans les looks aléatoires, soit 54 px de marge).
 *
 * ⚠️ ET LA CONTRAINTE DE BANDE MORD SUR LES DEUX AXES. `planTuiles` n'a qu'un
 * côté : réduire pour la hauteur de bande ajoute aussi des colonnes. C'est le
 * prix, il est assumé, et il ne se paie sur aucun des sept formats
 * d'aujourd'hui (vérifié par le script de mesure).
 *
 * @param {[number,number]} totalPx
 * @param {number} [recouvrementPx]
 * @param {number} [cote] - le côté nominal (le plancher garanti de WebGL2)
 * @param {number} [mpxMax]
 * @returns {number}
 */
export function coteTuileUtile(totalPx, recouvrementPx = 0, cote = COTE_TUILE, mpxMax = MPX_CANEVAS_MAX) {
  const W = Math.max(1, Math.round(totalPx?.[0] || 1))
  const H = Math.max(1, Math.round(totalPx?.[1] || 1))
  const marge = Number.isFinite(recouvrementPx) && recouvrementPx > 0 ? Math.ceil(recouvrementPx) : 0
  const nominal = Math.max(64, Math.round(cote))
  // ① la fenêtre rendue (tuile + deux marges) doit tenir sous le côté nominal
  let c = Math.max(64, nominal - 2 * marge)
  if (!(mpxMax > 0)) return c
  // ② la bande — largeur PLEINE × hauteur de tuile — doit tenir sous le plafond
  //    de canevas.
  //
  // ⚠️ ON NE BORNE PAS LE CÔTÉ PAR `mpxMax / W`, ET LA NUANCE COÛTE DES TUILES.
  // La hauteur d'une bande n'est PAS le côté de tuile : `planTuiles` répartit
  // la hauteur sur `ceil(H / côté)` lignes, ce qui donne des tuiles nettement
  // plus basses que le côté demandé. Un A2 paysage pavé à 1 998 produit des
  // tuiles de 1 678 de haut, pas de 1 998 — sa bande passe. Borner le côté à
  // `mpxMax / W` = 1 679 aurait ajouté une CINQUIÈME COLONNE pour rien : 15
  // tuiles au lieu de 12, soit 25 % de rendu en plus sur le format le plus
  // lourd du catalogue. On teste donc la hauteur de bande RÉELLE, et on ne
  // descend que si elle ne passe pas.
  while (c > 64) {
    const lignes = Math.ceil(H / c)
    if (W * Math.ceil(H / lignes) <= mpxMax) break
    // le côté qui force une ligne de plus ; le `c - 1` garantit qu'on avance
    c = Math.max(64, Math.min(c - 1, Math.ceil(H / (lignes + 1))))
  }
  return c
}

/**
 * La fenêtre à rendre pour une tuile, recouvrement compris, et de quoi rogner.
 *
 * ⚠️ LA MARGE EST BORNÉE PAR L'IMAGE, et ce n'est pas une commodité. Au bord
 * de l'affiche il n'y a pas de voisin à aller chercher : élargir au-delà
 * rendrait du hors-champ, et le rognage ramènerait alors la mauvaise bande de
 * pixels. Un bord d'affiche n'a pas de couture — il n'y a rien de l'autre côté.
 *
 * @param {{pleine:[number,number]}} plan - la sortie de `planTuiles`
 * @param {{x:number,y:number,w:number,h:number}} tuile
 * @param {number} [marge] - `planPavage(...).recouvrementPx`
 * @returns {{cadrage:object, rogneX:number, rogneY:number}} `cadrage` est au
 *   format de `cadrageTuile` : il se passe tel quel à `composeDecalage`.
 */
export function tuileRecouverte(plan, tuile, marge = 0) {
  // ⚠️ LA FENÊTRE DE BASE VIENT DE `cadrageTuile`, ELLE NE SE RECOPIE PAS.
  // C'est lui qui sait que les quatre premiers arguments de `setViewOffset`
  // décrivent l'image ENTIÈRE et non la tuile ; réécrire ce contrat ici en
  // ferait une seconde vérité, et les deux ne divergeraient qu'au tirage.
  const base = cadrageTuile(plan, tuile)
  const m = Number.isFinite(marge) && marge > 0 ? Math.ceil(marge) : 0
  const x0 = Math.max(0, base.offsetX - m)
  const y0 = Math.max(0, base.offsetY - m)
  const x1 = Math.min(base.fullWidth, base.offsetX + base.width + m)
  const y1 = Math.min(base.fullHeight, base.offsetY + base.height + m)
  return {
    cadrage: { ...base, offsetX: x0, offsetY: y0, width: x1 - x0, height: y1 - y0 },
    rogneX: base.offsetX - x0,
    rogneY: base.offsetY - y0,
  }
}

/**
 * Les bandes d'un plan : une ligne de tuiles chacune, dans l'ordre du haut vers
 * le bas. C'est la seule structure que l'orchestrateur ouvre en mémoire.
 */
export function bandesDuPlan(plan) {
  const bandes = []
  for (let j = 0; j < plan.lignes; j++) {
    const tuiles = plan.tuiles.filter((t) => t.j === j)
    bandes.push({ index: j, y: tuiles[0].y, hauteur: tuiles[0].h, largeur: plan.pleine[0], tuiles })
  }
  return bandes
}

// Le support de composition par défaut : un `<canvas>` 2D du document.
//
// ⚠️ IL EST INJECTABLE, ET C'EST CE QUI REND LA PREUVE D'ABSENCE DE COUTURE
// REJOUABLE. Sous node il n'y a ni DOM ni WebGL ; le test fournit un support en
// mémoire qui compte les écritures pixel par pixel. Sans cette couture-là,
// l'invariant ① ne se vérifierait qu'à l'œil, sur un tirage.
// ⚠️ EXPORTÉ POUR ÊTRE ENVELOPPÉ, PAS POUR ÊTRE REMPLACÉ. Le compositeur
// d'affiche (compositeur-affiche.js) a besoin de la MÊME toile, mais avec un
// passage de plus juste avant l'encodage : la réapplication du vignettage et du
// grain, puis le cartouche. Le recopier là-bas aurait donné deux toiles à
// maintenir — dont une seule connaîtrait le piège du `c.width = 1` ci-dessous.
export function supportNavigateur() {
  return {
    creerToile(largeur, hauteur) {
      const c = document.createElement('canvas')
      c.width = largeur
      c.height = hauteur
      const g = c.getContext('2d', { alpha: false })
      return {
        largeur,
        hauteur,
        poser(src, sx, sy, sw, sh, dx, dy, dw, dh) { g.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) },
        // Le contexte, pour qui doit dessiner PAR-DESSUS la bande avant qu'elle
        // soit encodée — le compositeur d'affiche, et lui seul. L'orchestrateur
        // ne s'en sert pas : il ne connaît que `poser` et `encoder`.
        contexte2d: () => g,
        encoder: (format, quality) =>
          new Promise((res, rej) =>
            c.toBlob((b) => (b ? res(b) : rej(new Error('Canvas capture failed'))), format, quality)
          ),
        // ⚠️ RAMENER LE CANEVAS À 1 × 1 LIBÈRE VRAIMENT LE TAMPON. Lâcher la
        // référence ne suffit pas : sur iOS le ramasse-miettes prend son temps,
        // et la bande suivante s'alloue AVANT que la précédente soit rendue.
        // Deux bandes vivantes, c'est 95 Mo au lieu de 48 — et sur un appareil
        // qui refuse en silence, c'est un tirage vide.
        liberer() { c.width = 1; c.height = 1 },
      }
    },
  }
}

/**
 * ═══════════ LE RENDU PAVÉ D'UNE AFFICHE ═══════════════════════════════════
 *
 * Rend `totalPx` en tuiles, compose bande par bande, encode au fil.
 *
 * @param {object} o
 * @param {object} o.renderer @param {object} o.composer @param {object} o.camera
 * @param {[number,number]} o.totalPx - la taille PLEINE à produire, fond perdu
 *   compris (`geometriePage(...).totalPx`)
 * @param {number} o.dpi - la densité du tirage ; sert au plan d'effets
 * @param {function} o.preparerTuile - `({ cadrage, largeur, hauteur, tuile,
 *   plan }) => ({ restaurer })`. C'est le seul point où la SCÈNE entre : c'est
 *   lui qui pose `camera.setViewOffset` (via `composeDecalage`) et l'épaisseur
 *   des traits. Il est rappelé À CHAQUE TUILE — voir l'encadré ci-dessous.
 * @param {function} [o.avantTirage] - une promesse à attendre avant la première
 *   tuile : la mise au repos de la scène.
 * @param {function} [o.surBande] - `(bande) => void|Promise`, appelée dès qu'une
 *   bande est encodée. Fournie, les blobs ne sont PAS conservés.
 * @param {function} [o.onProgress] - `(fraction)`
 * @param {function} [o.annule] - `() => boolean`, consultée entre deux tuiles
 * @param {object} [o.effets] - les arguments de `planPavage` (bokeh, SMAA…)
 * @param {object} [o.support] - injectable ; voir `supportNavigateur`
 * @returns {Promise<object>}
 */
export async function exporteAffichePavee({
  renderer,
  composer,
  camera,
  totalPx,
  dpi = 300,
  preparerTuile,
  avantTirage,
  surBande,
  onProgress,
  annule,
  effets = {},
  format = 'image/png',
  quality = 0.95,
  support = null,
  // ⚠️ OUTREPASSE `coteTuileUtile`, ET C'EST RÉSERVÉ À LA PREUVE. Un côté
  // imposé peut violer les invariants ② et ③ ; le test s'en sert pour produire
  // le RENDU EN UNE PASSE (une seule tuile) auquel comparer le pavage, et pour
  // fabriquer des damiers aux restes non nuls. La production ne le passe pas.
  cote: coteImpose = null,
}) {
  const W = Math.max(1, Math.round(totalPx?.[0] || 1))
  const H = Math.max(1, Math.round(totalPx?.[1] || 1))
  const aspect = safeAspect(W, H)

  // ── ① Le plan d'effets : il donne la MARGE, et il dit ce qu'il faudrait
  //    neutraliser. On ne neutralise rien ici (voir l'avertissement), mais la
  //    marge, elle, décide de la taille des tuiles — donc du plan tout entier.
  const plage = planPavage({ hauteurTuile: COTE_TUILE, dpi, ...effets })
  const recouvrementPx = plage?.recouvrementPx ?? 0

  const cote = coteImpose > 0 ? Math.round(coteImpose) : coteTuileUtile([W, H], recouvrementPx)
  const plan = planTuiles([W, H], cote)
  const bandes = bandesDuPlan(plan)

  // La marge se recalcule sur la hauteur RÉELLE des tuiles : celle du bokeh en
  // dépend (export-effets.js), et prendre la valeur d'une taille pour une autre
  // laisse précisément la couture qu'on veut éviter.
  const hauteurTuile = Math.max(...plan.tuiles.map((t) => t.h))
  const plageReelle = planPavage({ hauteurTuile, dpi, ...effets })
  const marge = plageReelle?.recouvrementPx ?? recouvrementPx

  if (plageReelle?.neutraliser?.length) {
    console.warn(
      `[ShibuMap] pavage : ${plageReelle.neutraliser.join(', ')} ${plageReelle.neutraliser.length > 1 ? 'sont allumés' : 'est allumé'} `
      + `et ${plageReelle.neutraliser.length > 1 ? 'dépendent' : 'dépend'} de la position dans la CIBLE, pas dans l'affiche. `
      + `Chaque tuile en recevra un exemplaire entier : l'affiche sortira en damier. `
      + `Il faut les éteindre pendant le pavage PUIS les réappliquer une fois sur l'image assemblée `
      + `(export-effets.js, champ « reappliquer »). Le compositeur d'affiche est le seul endroit où ce geste `
      + `soit exact — il travaille en fractions de l'image entière.`
    )
  }
  for (const s of plageReelle?.signalements || []) console.warn(`[ShibuMap] pavage : ${s}`)

  // Le budget, par `poidsRendu` — la même fonction qui a justifié le pavage.
  const budget = poidsRendu({ totalPx: [W, H], tuilePx: [hauteurTuile, hauteurTuile], echantillons: 4 })
  const bandeMaxPx = Math.max(...bandes.map((b) => b.largeur * b.hauteur))

  const ctx = { renderer, composer, camera }
  const sauve = saveState(renderer, camera)
  const sup = support || supportNavigateur()
  const rendues = []
  let rabote = false
  let faites = 0

  try {
    // ⚠️ LA MISE AU REPOS EST AVANT LA PREMIÈRE TUILE, PAS AVANT CHACUNE. Ce
    // qu'on veut, c'est UN instant de la carte, pas douze.
    if (avantTirage) await avantTirage()

    for (const bande of bandes) {
      if (annule?.()) throw new Error('Rendu annulé')
      const toile = sup.creerToile(bande.largeur, bande.hauteur)
      try {
        for (const tuile of bande.tuiles) {
          const r = tuileRecouverte(plan, tuile, marge)
          // `applySize` d'ABORD : il rend la taille VRAIMENT servie au
          // compositeur, et c'est sur elle que l'épaisseur des traits se règle
          // (réserve nº 3 de la tâche 5). Avec des tuiles sous 2 048, le
          // plafond ne mord jamais — mais « jamais » se vérifie, il ne se
          // suppose pas.
          const taille = applySize(ctx, r.cadrage.width, r.cadrage.height, aspect)
          rabote = rabote || taille.rabote
          // ═══ POURQUOI `preparerTuile` EST RAPPELÉ À CHAQUE TUILE ═════════
          //
          // Entre deux tuiles il y a des `await` : l'encodage d'une bande, la
          // remise de la main au navigateur. Une tuile de données peut y
          // atterrir et RECONSTRUIRE le calque d'eau — les matériaux neufs
          // naissent alors à l'échelle de l'ÉCRAN, et ressortent en cheveux sur
          // le tirage (réserve nº 2 de la tâche 5).
          //
          // ⚠️ ET IL FAUT RESTAURER ENTRE CHAQUE TUILE, pas seulement à la fin.
          // `reglerTraits` lit l'épaisseur RELATIVE sur le matériau lui-même
          // (`linewidth / resolution.y`) : appliqué deux fois de suite sans
          // retour en arrière, il composerait les échelles. Traverser, poser,
          // rendre, remettre — le cycle est fermé sur chaque tuile, donc il ne
          // peut ni manquer un matériau né en route ni s'appliquer deux fois.
          const prep = preparerTuile?.({
            cadrage: r.cadrage,
            largeur: taille.width,
            hauteur: taille.height,
            tuile,
            plan,
          })
          try {
            composer.render()
            // On rogne le recouvrement à la SOURCE et on pose à la place exacte
            // de la tuile dans la bande. `k` vaut 1 tant que le plafond ne mord
            // pas ; s'il mordait, la tuile serait remise à l'échelle de sa
            // place plutôt que décalée — une affiche un peu moins fine vaut
            // mieux qu'une affiche décalée d'un demi-pixel par tuile.
            const kx = taille.width / r.cadrage.width
            const ky = taille.height / r.cadrage.height
            toile.poser(
              renderer.domElement,
              r.rogneX * kx, r.rogneY * ky, tuile.w * kx, tuile.h * ky,
              tuile.x, tuile.y - bande.y, tuile.w, tuile.h
            )
          } finally {
            prep?.restaurer?.()
          }
          faites++
          onProgress?.(faites / plan.tuiles.length)
        }
        const blob = await toile.encoder(format, quality)
        const sortie = { index: bande.index, y: bande.y, largeur: bande.largeur, hauteur: bande.hauteur, blob }
        if (surBande) {
          await surBande(sortie)
          // ⚠️ ON NE GARDE PAS LE BLOB QUAND QUELQU'UN L'A PRIS. Douze bandes
          // d'un A2 en PNG, c'est l'image pleine sous une autre forme — le
          // défaut qu'on vient de passer trois cents lignes à éviter.
          rendues.push({ ...sortie, blob: null })
        } else {
          rendues.push(sortie)
        }
      } finally {
        toile.liberer()
      }
    }
  } finally {
    restoreState(ctx, sauve)
  }

  return {
    largeur: W,
    hauteur: H,
    dpi,
    plan,
    bandes: rendues,
    recouvrementPx: marge,
    coteTuile: cote,
    bandeMaxPx,
    budget,
    effets: plageReelle,
    rabote,
  }
}

// Frame-by-frame MP4 recorder. The caller drives the scene clock and calls
// addFrame() once per video frame; encoding backpressure is awaited.
export class VideoExporter {
  constructor({ renderer, composer, camera }) {
    this.renderer = renderer
    this.composer = composer
    this.camera = camera
  }

  async start(width, height, fps) {
    this.fps = fps
    this.saved = saveState(this.renderer, this.camera)
    applySize(this, width, height)
    this.output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    })
    this.source = new CanvasSource(this.renderer.domElement, {
      codec: 'avc',
      bitrate: QUALITY_HIGH,
      keyFrameInterval: 2,
    })
    this.output.addVideoTrack(this.source, { frameRate: fps })
    await this.output.start()
  }

  async addFrame(timeSec) {
    this.composer.render()
    await this.source.add(timeSec, 1 / this.fps)
  }

  async finish() {
    try {
      this.source.close()
      await this.output.finalize()
    } finally {
      restoreState(this, this.saved)
    }
    return new Blob([this.output.target.buffer], { type: 'video/mp4' })
  }

  // Abort without producing a file (restores renderer state).
  async cancel() {
    try {
      await this.output?.cancel()
    } finally {
      if (this.saved) restoreState(this, this.saved)
    }
  }
}

// Orchestrator: renders duration*fps frames by advancing the scene through
// the caller-provided step(timeSec, dtSec), then returns the MP4 Blob.
// The caller is responsible for pausing/resuming its own RAF loop.
export async function exportVideo({ renderer, composer, camera, width, height, fps, duration, step, onProgress }) {
  const exporter = new VideoExporter({ renderer, composer, camera })
  try {
    await exporter.start(width, height, fps)
  } catch (err) {
    // start() resizes BEFORE encoder setup — if the codec refuses the config,
    // the renderer must be restored or the live view stays distorted
    await exporter.cancel()
    throw err
  }
  const total = Math.round(duration * fps)
  try {
    for (let f = 0; f < total; f++) {
      step(f / fps, 1 / fps)
      await exporter.addFrame(f / fps)
      onProgress?.((f + 1) / total)
    }
  } catch (err) {
    await exporter.cancel()
    throw err
  }
  return exporter.finish()
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
