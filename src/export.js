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

// Render one frame at width x height and return it as an image Blob.
export async function exportImage({ renderer, composer, camera, width, height, format = 'image/png', quality = 0.95 }) {
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
  return pending
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
