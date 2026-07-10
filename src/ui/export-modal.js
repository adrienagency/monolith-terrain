// Export modal — still image (PNG/JPEG) or MP4 capture of the scene.
// deps = { renderer, composer, camera, pauseLoop, resumeLoop, step }
// step(timeSec, dtSec) advances the scene deterministically for video frames.

import { el, segmented, select, button } from './kit.js'
import { exportImage, exportVideo, downloadBlob } from '../export.js'

const RATIOS = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 }
const SIZES = ['1280', '1920', '2560', '3840']
const even = (n) => Math.max(2, 2 * Math.round(n / 2))

export function openExportModal(deps) {
  const state = { format: 'png', ratio: '16:9', size: '1920', duration: '5', fps: '30' }
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
  const durationRow = select({
    label: 'Duration',
    options: [
      { label: '3 s', value: '3' },
      { label: '5 s', value: '5' },
      { label: '10 s', value: '10' },
    ],
    get: () => state.duration,
    set: (v) => (state.duration = v),
  })
  const fpsRow = segmented({
    label: 'Frame rate',
    options: ['30', '60'],
    get: () => state.fps,
    set: (v) => (state.fps = v),
  })

  const syncRows = () => {
    const video = state.format === 'mp4'
    durationRow.style.display = video ? '' : 'none'
    fpsRow.style.display = video ? '' : 'none'
  }
  syncRows()

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

  card.append(formatRow, ratioRow, sizeRow, durationRow, fpsRow, status, progress, actions)
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
    const { width, height } = dims()
    const { renderer, composer, camera } = deps
    setBusy(true)
    try {
      if (state.format === 'mp4') {
        status.textContent = 'Rendering…'
        deps.pauseLoop()
        try {
          const blob = await exportVideo({
            renderer, composer, camera, width, height,
            fps: parseInt(state.fps, 10),
            duration: parseInt(state.duration, 10),
            step: deps.step,
            onProgress: (p) => (fill.style.width = `${Math.round(p * 100)}%`),
          })
          downloadBlob(blob, 'clean-earth.mp4')
        } finally {
          deps.resumeLoop()
        }
      } else {
        status.textContent = 'Exporting…'
        fill.style.width = '50%'
        const png = state.format === 'png'
        const blob = await exportImage({
          renderer, composer, camera, width, height,
          format: png ? 'image/png' : 'image/jpeg',
        })
        downloadBlob(blob, `clean-earth-${width}x${height}.${png ? 'png' : 'jpg'}`)
      }
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
