// Export helpers — still-image capture at arbitrary resolution and MP4
// recording via mediabunny (WebCodecs). The canvas uses
// preserveDrawingBuffer:false, so every capture renders through the composer
// and reads the canvas back synchronously in the same task.

import * as THREE from 'three'
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } from 'mediabunny'
import { safeAspect, glSizeLimit, fitDrawingBuffer } from './viewport.js'

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
  try {
    applySize(ctx, width, height)
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
  // une incrustation ratée ne doit jamais faire perdre l'export à l'utilisateur
  try {
    return await stampCredit(blob, width, height, format, quality, credit)
  } catch {
    return blob
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
