// Export modal — still image (PNG/JPEG) or live MP4 recording of the scene.
// deps = { renderer, composer, camera, recorder }
// `recorder` is a Recorder instance (src/export-recorder.js); MP4 export is
// start/stop live capture at screen size — the modal closes on start and a
// REC pill (top-center) shows elapsed time with a Stop button.
// pauseLoop/resumeLoop/step are still accepted for backward compat but are
// no longer used (the old fixed-duration offline render path is gone).

import { el, segmented, select, button } from './kit.js'
import { exportImage, downloadBlob } from '../export.js'

const RATIOS = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 }
const SIZES = ['1280', '1920', '2560', '3840']
const even = (n) => Math.max(2, 2 * Math.round(n / 2))

const fmtElapsed = (sec) => {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function openExportModal(deps) {
  const state = { format: 'png', ratio: '16:9', size: '1920' }
  let exporting = false

  const veil = el('div', 'ce-modal-veil')
  const card = el('div', 'ce-modal ce-glassbox')
  card.append(el('h3', null, 'Export'))

  const dims = () => {
    const canvas = deps.renderer.domElement
    const aspect = state.ratio === 'Screen'
      ? (canvas.clientWidth || canvas.width) / (canvas.clientHeight || canvas.height)
      : RATIOS[state.ratio]
    const edge = parseInt(state.size, 10)
    return aspect >= 1
      ? { width: even(edge), height: even(edge / aspect) }
      : { width: even(edge * aspect), height: even(edge) }
  }

  const formatRow = segmented({
    label: 'Format',
    options: [
      { label: 'PNG', value: 'png' },
      { label: 'JPEG', value: 'jpeg' },
      { label: 'MP4', value: 'mp4' },
    ],
    get: () => state.format,
    set: (v) => {
      state.format = v
      syncRows()
    },
  })
  const ratioRow = segmented({
    label: 'Ratio',
    options: ['16:9', '9:16', '1:1', '4:5', 'Screen'],
    get: () => state.ratio,
    set: (v) => (state.ratio = v),
  })
  const sizeRow = select({
    label: 'Size',
    options: SIZES.map((s) => ({ label: `${s} px`, value: s })),
    get: () => state.size,
    set: (v) => (state.size = v),
  })
  const recNote = el('div', 'ce-rec-note', 'Records the live view until you stop.')

  const syncRows = () => {
    const video = state.format === 'mp4'
    ratioRow.style.display = video ? 'none' : ''
    sizeRow.style.display = video ? 'none' : ''
    recNote.style.display = video ? '' : 'none'
    exportBtn.textContent = video ? 'Start recording' : 'Export'
  }

  const progress = el('div', 'ce-progress')
  const fill = el('i')
  progress.append(fill)
  progress.style.display = 'none'
  const status = el('div', 'ce-label')
  status.style.display = 'none'

  const cancelBtn = button('Cancel', () => close(), { ghost: true })
  const exportBtn = button('Export', () => run(), { accent: true })
  const actions = el('div', 'ce-modal-actions')
  actions.append(cancelBtn, exportBtn)
  syncRows()

  card.append(formatRow, ratioRow, sizeRow, recNote, status, progress, actions)
  veil.append(card)
  document.body.append(veil)

  function close() {
    if (exporting) return
    window.removeEventListener('keydown', onKey)
    veil.remove()
  }
  const onKey = (e) => {
    if (e.key === 'Escape') close()
  }
  window.addEventListener('keydown', onKey)
  veil.addEventListener('mousedown', (e) => {
    if (e.target === veil) close()
  })

  function setBusy(busy) {
    exporting = busy
    cancelBtn.disabled = busy
    exportBtn.disabled = busy
    progress.style.display = busy ? '' : 'none'
    status.style.display = busy ? '' : 'none'
    if (!busy) fill.style.width = '0'
  }

  async function run() {
    if (exporting) return
    if (state.format === 'mp4') {
      // one recording at a time — a second Start would orphan the first pill
      if (deps.recorder?.recording) {
        close()
        return
      }
      setBusy(true)
      status.textContent = 'Starting…'
      try {
        await deps.recorder.start()
      } catch (err) {
        console.error('Recording failed to start:', err)
        setBusy(false)
        status.style.display = ''
        status.textContent = 'Recording failed to start'
        return
      }
      setBusy(false)
      close()
      showRecPill(deps.recorder)
      return
    }
    const { width, height } = dims()
    const { renderer, composer, camera } = deps
    setBusy(true)
    try {
      status.textContent = 'Exporting…'
      fill.style.width = '50%'
      const png = state.format === 'png'
      const blob = await exportImage({
        renderer, composer, camera, width, height,
        format: png ? 'image/png' : 'image/jpeg',
      })
      downloadBlob(blob, `shibumap-${width}x${height}.${png ? 'png' : 'jpg'}`)
      setBusy(false)
      close()
    } catch (err) {
      console.error('Export failed:', err)
      setBusy(false)
      status.style.display = ''
      status.textContent = 'Export failed'
    }
  }
}

// Discreet REC pill — fixed top-center under the top bar while a live
// recording runs. Deliberately NOT hidden by the no-UI mode (see v28.css):
// users hide the UI while recording precisely to get a clean capture.
function showRecPill(recorder) {
  const pill = el('div', 'ce-rec ce-glassbox')
  const dot = el('span', 'ce-rec-dot')
  const time = el('span', 'ce-rec-time', '0:00')
  const stopBtn = button('Stop', () => finish(), {})
  pill.append(dot, time, stopBtn)
  document.body.append(pill)

  let done = false
  const timer = setInterval(() => {
    time.textContent = fmtElapsed(recorder.elapsed)
  }, 250)

  function teardown() {
    clearInterval(timer)
    recorder.onError = null
    recorder.onAutoStop = null
  }

  async function finish() {
    if (done) return
    done = true
    stopBtn.disabled = true
    teardown()
    try {
      const blob = await recorder.stop()
      downloadBlob(blob, 'shibumap-recording.mp4')
      pill.remove()
    } catch (err) {
      console.warn('Recording failed:', err)
      fail()
    }
  }

  function fail() {
    stopBtn.remove()
    dot.remove()
    time.textContent = 'Recording failed'
    setTimeout(() => pill.remove(), 2000)
  }

  // canvas was resized mid-recording — the recorder finalized gracefully
  recorder.onAutoStop = (blob) => {
    if (done) return
    done = true
    teardown()
    downloadBlob(blob, 'shibumap-recording.mp4')
    pill.remove()
  }
  recorder.onError = (err) => {
    if (done) return
    done = true
    console.warn('Recording failed:', err)
    teardown()
    fail()
  }
}
