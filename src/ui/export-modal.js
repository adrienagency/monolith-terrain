// Export modal — still image (PNG/JPEG) or live MP4 recording of the scene.
// deps = { renderer, composer, camera, recorder }
// `recorder` is a Recorder instance (src/export-recorder.js); MP4 export is
// start/stop live capture — the modal closes on start and a REC pill
// (top-center) shows elapsed time with a Stop button.
// pauseLoop/resumeLoop/step are still accepted for backward compat but are
// no longer used (the old fixed-duration offline render path is gone).
//
// Les crans de taille (dont le 2K) vivent dans export-presets.js : ils servent
// aux DEUX voies, image fixe et vidéo, et une table recopiée ici finirait par
// diverger de l'autre.

import { el, segmented, select, button } from './kit.js'
import { exportImage, downloadBlob } from '../export.js'
import { EXPORT_SIZES, EXPORT_RATIOS, DEFAULT_SIZE, DEFAULT_RATIO, exportDims } from '../export-presets.js'

// La vidéo garde un cran de plus que l'image : « écran », l'ancien comportement
// (on enregistre le canevas tel quel). C'est le défaut, parce que forcer une
// taille fait rendre CHAQUE frame à cette taille — un choix, pas une valeur par
// défaut à imposer aux machines modestes.
const NATIVE = 'native'

const fmtElapsed = (sec) => {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function openExportModal(deps) {
  const state = { format: 'png', ratio: DEFAULT_RATIO, size: DEFAULT_SIZE, videoSize: NATIVE }
  let exporting = false

  const veil = el('div', 'ce-modal-veil')
  const card = el('div', 'ce-modal ce-glassbox')
  card.append(el('h3', null, 'Export'))

  const dims = () => {
    const canvas = deps.renderer.domElement
    const aspect = (canvas.clientWidth || canvas.width) / (canvas.clientHeight || canvas.height)
    return exportDims(state.ratio, state.size, aspect)
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
    options: [...Object.keys(EXPORT_RATIOS), 'Screen'],
    get: () => state.ratio,
    set: (v) => (state.ratio = v),
  })
  const sizeRow = select({
    label: 'Size',
    options: EXPORT_SIZES,
    get: () => state.size,
    set: (v) => (state.size = v),
  })
  // Menu SÉPARÉ pour la vidéo : son défaut (« écran ») n'existe pas côté image,
  // et un état partagé imposerait une taille forcée dès qu'on a exporté un PNG.
  const videoSizeRow = select({
    label: 'Size',
    options: [{ label: 'Screen (as displayed)', value: NATIVE }, ...EXPORT_SIZES],
    get: () => state.videoSize,
    set: (v) => {
      state.videoSize = v
      syncRows()
    },
  })
  const recNote = el('div', 'ce-rec-note', 'Records the live view until you stop.')

  const syncRows = () => {
    const video = state.format === 'mp4'
    ratioRow.style.display = video ? 'none' : ''
    sizeRow.style.display = video ? 'none' : ''
    videoSizeRow.style.display = video ? '' : 'none'
    recNote.style.display = video ? '' : 'none'
    // La vidéo n'a pas de choix de ratio : le cadrage est celui de l'écran, on
    // ne fait que changer le nombre de pixels rendus dedans.
    recNote.textContent = state.videoSize === NATIVE
      ? 'Records the live view until you stop.'
      : 'Records the live view at that size — the framing stays the one on screen.'
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

  card.append(formatRow, ratioRow, sizeRow, videoSizeRow, recNote, status, progress, actions)
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
        await deps.recorder.start({ longEdge: state.videoSize === NATIVE ? 0 : state.videoSize })
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
      // La ligne de crédits DÉPEND DE L'EMPRISE : une carte creusée par EMODnet
      // doit porter son attribution mot pour mot (CC BY 4.0), et une carte du
      // Japon ne doit surtout pas la porter. `deps.creditLine` la calcule ;
      // absente, on retombe sur la ligne fixe historique (voir export.js).
      const credit = deps.creditLine?.()
      const blob = await exportImage({
        renderer, composer, camera, width, height,
        format: png ? 'image/png' : 'image/jpeg',
        ...(credit ? { credit } : {}),
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

// Le nom porte les dimensions ENCODÉES, comme pour une image : c'est la seule
// façon de distinguer une prise en 2K d'une prise à la taille de l'écran une
// fois les fichiers rangés dans le dossier de téléchargements.
const recName = (recorder) => {
  const { width, height } = recorder.size
  return width && height ? `shibumap-recording-${width}x${height}.mp4` : 'shibumap-recording.mp4'
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
      downloadBlob(blob, recName(recorder))
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
