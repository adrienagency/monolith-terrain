// AdaptiveQuality — automatic degraded mode ("mode downgradé") that keeps the
// app smooth on weak devices while preserving the visual read of the map.
//
// Four tiers, degrading in order of least visual damage:
//   T0 FULL      — everything as authored (desktop default)
//   T1 BALANCED  — pixelRatio ≤ 1.5, water-glass taps 6 → 4
//   T2 LIGHT     — pixelRatio 1.0, DoF pass off (user bokeh value kept),
//                  shadows frozen to 'static', glass taps → 2
//   T3 ESSENTIAL — pixelRatio 0.85, shadows off, film grain off. The cloud
//                  deck is NEVER touched — it is the identity of the scene.
//
// Trigger: rolling 60-frame FPS average < 30 sustained ~2.5 s → one tier down.
// Recovery: average > 55 sustained 12 s → one tier up, never above the START
// tier (coarse-pointer devices boot at T1, desktops at T0). Hysteresis: at
// least 20 s between any two automatic changes, and the FPS window is ignored
// for 5 s after boot and 2 s after any tier change / tab-visibility change,
// so load spikes and background throttling can never cause a step.
//
// Respecting the user: once the controller has changed tiers, each lever
// (render scale / shadows / DoF / grain) is watched with a dirty flag. If the
// user moves that control in the Camera panel afterwards, the observed value
// no longer matches what the controller wrote → the lever is marked dirty and
// the controller stops managing it forever (the other levers stay managed).
//
// Nothing is persisted.

const TIER_NAMES = ['FULL QUALITY', 'BALANCED MODE', 'LIGHT MODE', 'ESSENTIAL MODE']

const WINDOW = 60 // frames in the rolling FPS average
const BOOT_IGNORE = 5 // s of samples dropped after boot
const SETTLE_IGNORE = 2 // s dropped after a tier change / visibility change
const DOWN_FPS = 30
const DOWN_SUSTAIN = 2.5 // s below DOWN_FPS before stepping down
const UP_FPS = 55
const UP_SUSTAIN = 12 // s above UP_FPS before stepping back up
const MIN_GAP = 20 // s minimum between two automatic tier changes

// water glass: taps are baked into the shader as a #define (see
// vendor/MeshTransmissionMaterial.js). Rewriting the count and flagging
// needsUpdate recompiles the program — customProgramCacheKey() includes the
// tap count, so materials with different counts never share a program.
function setGlassSamples(lake, n) {
  for (const m of [lake?.seaMat, lake?.lakeMat]) {
    if (!m || m._mtmSamples === n) continue
    m._mtmSamples = n
    m.needsUpdate = true
  }
}

export function createAdaptiveQuality({
  params,
  renderer,
  composer,
  dof, // reserved — the pass toggle is enough today, kept for future levers
  dofPass,
  aoPass = null, // render-upgrade levers (2026-07-20 plan): tier 2 sheds AO,
  bloomPass = null, // tier 3 sheds bloom — one product, adaptive, no forked mode
  lake,
  grain = null, // NoiseEffect (optional) — T3 turns film grain off
  applyShadowMode,
  announce = () => {},
  refreshAll = () => {},
  // sampling/stepping gate — main.js keeps the controller quiet in orbital
  // view (FX are already stripped there) and during a live MP4 recording
  // (a pixelRatio change would resize the canvas and abort the encoder)
  canStep = () => true,
} = {}) {
  const startTier = matchMedia('(pointer: coarse)').matches ? 1 : 0
  let tier = 0

  // the user's own settings — what T0 restores. Tracked live until the first
  // tier change, then frozen (from that point the dirty flags own the story).
  const base = {
    pixelRatio: params.pixelRatio,
    shadowMode: params.shadowMode,
    grain: params.grain,
    samples: lake?.seaMat?._mtmSamples ?? 6,
  }
  // per-lever opt-out: true = the user reclaimed this control, hands off
  const dirty = { pixelRatio: false, shadows: false, dof: false, grain: false }
  // what the controller last wrote — divergence means the user moved it
  let expected = null
  let everChanged = false

  // ---------------------------------------------------------------- levers

  const tierPixelRatio = (n) =>
    [base.pixelRatio, Math.min(base.pixelRatio, 1.5), Math.min(base.pixelRatio, 1.0), Math.min(base.pixelRatio, 0.85)][n]
  const tierShadows = (n) => {
    if (base.shadowMode === 'off') return 'off' // never resurrect user-disabled shadows
    return ['dynamic', 'static', 'off'].includes(base.shadowMode)
      ? [base.shadowMode, base.shadowMode, 'static', 'off'][n]
      : 'dynamic'
  }
  const tierSamples = (n) => [base.samples, Math.min(base.samples, 4), Math.min(base.samples, 2), Math.min(base.samples, 2)][n]

  function applyTier(n) {
    if (!dirty.pixelRatio) {
      const pr = tierPixelRatio(n)
      if (params.pixelRatio !== pr) {
        params.pixelRatio = pr
        renderer.setPixelRatio(pr)
        composer.setSize(window.innerWidth, window.innerHeight)
      }
    }
    // Render-upgrade levers. AO costs a whole extra scene pass, so it is shed
    // first; bloom holds on until the floor tier. `&& params.x` means a manual
    // OFF stays off whatever the tier — the governor only ever restores the
    // user's own setting on the way back up, never a blind true.
    params._aoTierOk = n < 2
    params._bloomTierOk = n < 3
    if (!dirty.shadows) {
      const sm = tierShadows(n)
      if (params.shadowMode !== sm) {
        params.shadowMode = sm
        applyShadowMode()
      }
    }
    if (!dirty.dof) {
      // T2+: kill the whole DoF pass but leave params.bokehScale alone — the
      // Camera panel keeps showing the user's bokeh, and stepping back up
      // re-enables the pass exactly as they left it. bokehEnabled is the user's
      // explicit gate and always wins: auto-quality may only ever turn DoF OFF,
      // never switch it back on behind their back.
      dofPass.enabled = n < 2 && params.bokehEnabled && params.bokehScale > 0
    }
    if (!dirty.grain) {
      params.grain = n >= 3 ? 0 : base.grain
      if (grain) grain.blendMode.opacity.value = params.grain
    }
    setGlassSamples(lake, tierSamples(n)) // no UI control → no dirty flag
    expected = {
      pixelRatio: params.pixelRatio,
      shadowMode: params.shadowMode,
      dofEnabled: dofPass.enabled,
      bokehScale: params.bokehScale,
      grain: params.grain,
    }
    refreshAll() // Camera panel sliders reflect the new reality
  }

  // user-override detection — any managed value that drifted from what we
  // wrote was moved by the user: release that lever permanently
  function watchDirty() {
    if (!expected) return
    if (!dirty.pixelRatio && params.pixelRatio !== expected.pixelRatio) dirty.pixelRatio = true
    if (!dirty.shadows && params.shadowMode !== expected.shadowMode) dirty.shadows = true
    if (!dirty.dof && (dofPass.enabled !== expected.dofEnabled || params.bokehScale !== expected.bokehScale))
      dirty.dof = true
    if (!dirty.grain && params.grain !== expected.grain) dirty.grain = true
  }

  // ---------------------------------------------------------------- sensing

  const dts = new Float32Array(WINDOW)
  let dtSum = 0
  let dtCount = 0
  let dtHead = 0
  let below = 0 // s spent under DOWN_FPS
  let above = 0 // s spent over UP_FPS
  const now = () => performance.now() / 1000
  const bootAt = now()
  let quietUntil = bootAt + BOOT_IGNORE
  let lastChangeAt = -Infinity

  function resetWindow() {
    dtSum = 0
    dtCount = 0
    dtHead = 0
    below = 0
    above = 0
  }

  document.addEventListener('visibilitychange', () => {
    resetWindow()
    quietUntil = Math.max(quietUntil, now() + SETTLE_IGNORE)
  })

  function setTier(n, manual = false) {
    n = Math.max(0, Math.min(3, Math.round(n)))
    if (n === tier) return
    const up = n < tier
    tier = n
    everChanged = true
    lastChangeAt = now()
    quietUntil = lastChangeAt + SETTLE_IGNORE
    resetWindow()
    applyTier(n)
    if (!manual) announce(up ? `PERFORMANCE — ${TIER_NAMES[n]} RESTORED` : `PERFORMANCE — ${TIER_NAMES[n]}`)
  }

  // re-assert the current tier's levers (mode transitions restore FX straight
  // from params and would silently undo the tier — main.js calls this when
  // surface FX come back online). Not a change: no announce, no settle reset.
  function reassert() {
    if (everChanged || tier !== 0) applyTier(tier)
  }

  function update(dt) {
    const t = now()

    // pre-change on desktop: keep tracking the user's own values as the
    // restore target (on tablets T1 was applied at boot, so the baseline is
    // frozen at construction and the dirty flags take over from there)
    if (!everChanged && tier === 0) {
      base.pixelRatio = params.pixelRatio
      base.shadowMode = params.shadowMode
      base.grain = params.grain
    }
    watchDirty()

    if (!canStep()) {
      resetWindow()
      return
    }
    if (t < quietUntil) return
    if (!(dt > 0) || dt > 0.5) return // stall / resume spike — not signal

    // rolling average over the last WINDOW frames
    if (dtCount === WINDOW) dtSum -= dts[dtHead]
    else dtCount++
    dts[dtHead] = dt
    dtSum += dt
    dtHead = (dtHead + 1) % WINDOW
    if (dtCount < WINDOW) return // need a full window before judging
    const avg = dtCount / dtSum

    if (avg < DOWN_FPS) {
      below += dt
      above = 0
    } else if (avg > UP_FPS) {
      above += dt
      below = 0
    } else {
      below = 0
      above = 0
    }

    if (t - lastChangeAt < MIN_GAP) return
    if (below >= DOWN_SUSTAIN && tier < 3) setTier(tier + 1)
    else if (above >= UP_SUSTAIN && tier > startTier) setTier(tier - 1)
  }

  // coarse-pointer devices (tablets) boot straight into BALANCED — silently,
  // and before the first frame, so there is no visible quality pop
  if (startTier > 0) {
    tier = startTier
    applyTier(startTier)
  }

  return {
    update,
    setTier,
    reassert,
    get tier() {
      return tier
    },
    get startTier() {
      return startTier
    },
    get dirty() {
      return { ...dirty }
    },
  }
}
