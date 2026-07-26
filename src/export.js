// Export helpers — still-image capture at arbitrary resolution and MP4
// recording via mediabunny (WebCodecs). The canvas uses
// preserveDrawingBuffer:false, so every capture renders through the composer
// and reads the canvas back synchronously in the same task.

import * as THREE from 'three'
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } from 'mediabunny'

function saveState(renderer, camera) {
  const size = renderer.getSize(new THREE.Vector2())
  return { width: size.x, height: size.y, pixelRatio: renderer.getPixelRatio(), aspect: camera.aspect }
}

function applySize({ renderer, composer, camera }, width, height) {
  renderer.setPixelRatio(1)
  composer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function restoreState({ renderer, composer, camera }, saved) {
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
