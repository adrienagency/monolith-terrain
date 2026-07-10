// Scan effect selector + lifecycle. The shader work lives in terrain.js
// (uScanType branches injected into the map material); this module owns the
// catalogue of scan styles and drives the shared scan uniforms per frame.

export const SCAN_TYPES = [
  { id: 0, key: 'radar', label: 'Radar sweep' },
  { id: 1, key: 'elevation', label: 'Elevation slice' },
  { id: 2, key: 'gridline', label: 'Grid sweep' },
  { id: 3, key: 'sonar', label: 'Sonar ping' },
  { id: 4, key: 'holo', label: 'Hologram' },
]

// default run time (seconds) per scan type -- radial sweeps take longer to
// cross the slab, the hologram flash is deliberately snappy
const DEFAULT_DURATIONS = { 0: 4.6, 1: 3.5, 2: 2.8, 3: 3.2, 4: 2.0 }

export class ScanController {
  /**
   * @param {object} mapUniforms terrain.mapUniforms (uScanT/uScanType/uScanOrigin/uScanMax live here)
   * @param {number} slabHalf half-extent of the slab in world units (TERRAIN_SIZE / 2)
   */
  constructor(mapUniforms, slabHalf) {
    this.uniforms = mapUniforms
    this.slabHalf = slabHalf
    this.t0 = -1 // ms timestamp of trigger, -1 = idle
    this.duration = DEFAULT_DURATIONS[0]
  }

  /**
   * Start a scan.
   * @param {number} typeId one of SCAN_TYPES ids (0..4)
   * @param {{x: number, z: number}|null} originWorld epicenter in world XZ (null = slab center)
   * @param {number|null} duration seconds; null = per-type default
   */
  trigger(typeId, originWorld = null, duration = null) {
    const ox = originWorld ? originWorld.x : 0
    const oz = originWorld ? originWorld.z : 0
    this.uniforms.uScanOrigin.value.set(ox, oz)
    // radius guaranteed to reach the farthest slab corner from the origin
    this.uniforms.uScanMax.value = Math.hypot(Math.abs(ox) + this.slabHalf, Math.abs(oz) + this.slabHalf)
    this.uniforms.uScanType.value = typeId | 0
    this.duration = duration ?? DEFAULT_DURATIONS[typeId] ?? 3.0
    this.t0 = performance.now()
    this.uniforms.uScanT.value = 0
  }

  // advance the scan; call once per frame
  update() {
    if (this.t0 < 0) return
    const p = (performance.now() - this.t0) / (this.duration * 1000)
    if (p >= 1) {
      this.t0 = -1
      this.uniforms.uScanT.value = -1
    } else {
      this.uniforms.uScanT.value = p
    }
  }

  get active() {
    return this.t0 >= 0
  }
}
