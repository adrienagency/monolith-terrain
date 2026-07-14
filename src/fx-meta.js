// Per-effect metadata for the Fancy surface shaders (Scan > Fancy > Surface
// shader). Each entry: a label, default param values, and the list of controls
// the UI exposes for that effect. Keys map 1:1 to the uFx* uniforms consumed by
// `surfaceFx()` in terrain.js — colA/colB/colC (vec3), speed, scale, p1/p2/p3.
// `speed` drives how fast uFxTime accumulates (0 = frozen); it is not a GLSL
// uniform. This is the single source the UI reads and the runtime applies.

const col = (k, label) => ({ k, label, type: 'color' })
const sld = (k, label, min = 0, max = 1) => ({ k, label, type: 'slider', min, max })
const SPEED = sld('speed', 'Speed', 0, 1.5)
const SCALE = sld('scale', 'Scale', 0.3, 3)

// shared default palette (warm paper → clay → ink)
const PA = '#efe7d6', PB = '#b07a56', PC = '#20242c'

export const FX_META = {
  1: { label: 'Mesh gradient', d: { colA: PA, colB: PB, colC: PC, speed: 0.15, scale: 1 },
    c: [col('colA', 'Colour 1'), col('colB', 'Colour 2'), col('colC', 'Colour 3'), SPEED, SCALE] },
  2: { label: 'Grain gradient', d: { colA: PA, colB: PB, colC: PC, speed: 0.12, scale: 1, p1: 0.5 },
    c: [col('colA', 'Colour 1'), col('colB', 'Colour 2'), col('colC', 'Colour 3'), sld('p1', 'Grain'), SPEED, SCALE] },
  3: { label: 'Dithering', d: { colA: '#171a20', colB: '#efe9db', speed: 0.15, scale: 1, p1: 0.3 },
    c: [col('colA', 'Ink'), col('colB', 'Paper'), sld('p1', 'Pixel size'), SPEED, SCALE] },
  4: { label: 'Voronoi', d: { colA: '#c9a06a', colB: '#20242c', speed: 0.2, scale: 1, p1: 0.5, p2: 0.3 },
    c: [col('colA', 'Cells'), col('colB', 'Edges'), sld('p1', 'Density'), sld('p2', 'Edge glow'), SPEED, SCALE] },
  5: { label: 'Warp', d: { colA: '#20242c', colB: '#b07a56', colC: '#efe7d6', speed: 0.18, scale: 1 },
    c: [col('colA', 'Colour 1'), col('colB', 'Colour 2'), col('colC', 'Colour 3'), SPEED, SCALE] },
  6: { label: 'Waves', d: { colA: '#1a1e28', colB: '#e6dcc6', speed: 0.25, scale: 1, p1: 0.35, p2: 0.35 },
    c: [col('colA', 'Trough'), col('colB', 'Crest'), sld('p1', 'Frequency'), sld('p2', 'Distortion'), SPEED, SCALE] },
  7: { label: 'Swirl', d: { colA: '#20242c', colB: '#c98a5a', colC: '#efe7d6', speed: 0.15, scale: 1, p1: 0.4 },
    c: [col('colA', 'Colour 1'), col('colB', 'Colour 2'), col('colC', 'Colour 3'), sld('p1', 'Arms'), SPEED, SCALE] },
  8: { label: 'Spiral', d: { colA: '#12131a', colB: '#d8cfe6', speed: 0.15, scale: 1, p1: 0.35 },
    c: [col('colA', 'Ground'), col('colB', 'Line'), sld('p1', 'Density'), SPEED, SCALE] },
  9: { label: 'Metaballs', d: { colA: '#14161d', colB: '#c9885a', speed: 0.25, scale: 1, p1: 0.35, p2: 0.4 },
    c: [col('colA', 'Background'), col('colB', 'Blobs'), sld('p1', 'Count'), sld('p2', 'Size'), SPEED, SCALE] },
  10: { label: 'God rays', d: { colA: '#0d0f16', colB: '#ffe9b8', speed: 0.15, scale: 1, p1: 0.4 },
    c: [col('colA', 'Sky'), col('colB', 'Rays'), sld('p1', 'Density'), SPEED, SCALE] },
  11: { label: 'Dot grid', d: { colA: '#ece4d6', colB: '#20242c', speed: 0, scale: 1, p1: 0.4, p2: 0.4 },
    c: [col('colA', 'Paper'), col('colB', 'Dots'), sld('p1', 'Density'), sld('p2', 'Dot size'), SCALE] },
  12: { label: 'Noise field', d: { colA: PC, colB: PB, colC: PA, speed: 0.12, scale: 1 },
    c: [col('colA', 'Low'), col('colB', 'Mid'), col('colC', 'High'), SPEED, SCALE] },
  13: { label: 'Neuro', d: { colA: '#7fe9ff', colB: '#2a6cff', colC: '#0a0f1c', speed: 0.6, scale: 1, p1: 0.15, p2: 0.3 },
    c: [col('colA', 'Filaments'), col('colB', 'Mid'), col('colC', 'Background'), sld('p1', 'Brightness'), sld('p2', 'Contrast'), SPEED, SCALE] },
  14: { label: 'Heatmap', d: { speed: 0.5, scale: 1, p1: 0.4, p2: 0.25, p3: 0.5 },
    c: [sld('p1', 'Heat'), sld('p2', 'Contours'), sld('p3', 'Detail'), SPEED, SCALE] },
}

export const FX_LIST = Object.entries(FX_META).map(([id, m]) => ({ id: Number(id), label: m.label }))

// a fresh params store: { [id]: {colA,colB,colC,speed,scale,p1,p2,p3} } seeded
// from each effect's defaults (missing keys fall back to neutral values)
export function defaultFxParams() {
  const store = {}
  for (const [id, m] of Object.entries(FX_META)) {
    store[id] = { colA: '#ffffff', colB: '#808080', colC: '#000000', speed: 0.15, scale: 1, p1: 0.5, p2: 0.5, p3: 0.5, ...m.d }
  }
  return store
}
