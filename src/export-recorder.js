// Live screen recorder — start/stop MP4 capture of the visible canvas at its
// CURRENT size (what you see is what you get; no resize dance). The render
// loop calls captureFrame() right after composer.render() while recording.
//
// Backpressure: captureFrame() never awaits. If the encoder hasn't settled
// the previous add() yet, the frame is dropped (timestamps stay real-time,
// so playback speed is unaffected — the video just skips a frame).
//
// Resize guard: H.264 tracks cannot change dimensions mid-stream. If the
// canvas is resized while recording (window resize), the recorder detects it
// and auto-stops with a graceful finalize; the file contains everything up
// to that point. Wire `onAutoStop(blob)` to receive that file.

import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } from 'mediabunny'

export class Recorder {
  constructor({ renderer }) {
    this.renderer = renderer
    // callbacks (assigned by the UI):
    this.onError = null // (err) => void — encoder failed, recording aborted
    this.onAutoStop = null // (blob) => void — resize forced a graceful stop
    this._recording = false
    this._busy = false // true while the previous source.add() is in flight
    this._t0 = 0
    this._lastT = 0
    this._startW = 0
    this._startH = 0
    this.output = null
    this.source = null
  }

  get recording() {
    return this._recording
  }

  // seconds since start() — keeps ticking until stop/cancel.
  get elapsed() {
    return this._recording ? (performance.now() - this._t0) / 1000 : 0
  }

  async start() {
    if (this._recording) return
    const canvas = this.renderer.domElement
    // H.264 refuses ODD dimensions outright — and the live canvas is whatever
    // window-width x pixel-ratio happens to be. When either side is odd, we
    // record through an even-sized bridge canvas (one drawImage per frame,
    // clipping a single pixel) instead of failing the whole recording.
    const evenW = canvas.width & ~1
    const evenH = canvas.height & ~1
    if (evenW !== canvas.width || evenH !== canvas.height) {
      this._bridge = document.createElement('canvas')
      this._bridge.width = evenW
      this._bridge.height = evenH
      this._bridgeCtx = this._bridge.getContext('2d')
    } else {
      this._bridge = null
      this._bridgeCtx = null
    }
    this.output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    })
    this.source = new CanvasSource(this._bridge ?? canvas, {
      codec: 'avc',
      bitrate: QUALITY_HIGH,
      keyFrameInterval: 2,
    })
    this.output.addVideoTrack(this.source, { frameRate: 60 })
    await this.output.start()
    this._startW = canvas.width
    this._startH = canvas.height
    this._busy = false
    this._t0 = performance.now()
    this._lastT = 0
    this._recording = true
  }

  // Called by the render loop right after composer.render(), every frame
  // while recording. Cheap, non-blocking, and never throws.
  captureFrame() {
    if (!this._recording) return
    try {
      const canvas = this.renderer.domElement
      if (canvas.width !== this._startW || canvas.height !== this._startH) {
        // H.264 can't switch dimensions mid-track — finalize what we have.
        this._autoStop()
        return
      }
      if (this._busy) return // encoder backed up — drop this frame
      if (this._bridgeCtx) this._bridgeCtx.drawImage(this.renderer.domElement, 0, 0)
      const t = (performance.now() - this._t0) / 1000
      const dt = t - this._lastT
      this._lastT = t
      this._busy = true
      // fire and forget — backpressure handled via the _busy flag above
      this.source.add(t, dt > 0 ? dt : 1 / 60).then(
        () => {
          this._busy = false
        },
        (err) => {
          this._busy = false
          this._fail(err)
        },
      )
    } catch (err) {
      this._fail(err)
    }
  }

  // Finalize and return the MP4 file.
  async stop() {
    if (!this.output) throw new Error('Recorder not started')
    this._recording = false
    this.source.close()
    await this.output.finalize()
    return new Blob([this.output.target.buffer], { type: 'video/mp4' })
  }

  // Abort without producing a file.
  async cancel() {
    this._recording = false
    try {
      await this.output?.cancel()
    } catch {
      /* already torn down */
    }
  }

  _autoStop() {
    this.stop().then(
      (blob) => this.onAutoStop?.(blob),
      (err) => this._fail(err),
    )
  }

  _fail(err) {
    if (!this._recording && !this.output) return
    console.warn('Recorder error — stopping:', err)
    this._recording = false
    const out = this.output
    this.output = null
    this.source = null
    try {
      out?.cancel()
    } catch {
      /* best effort */
    }
    this.onError?.(err)
  }
}
