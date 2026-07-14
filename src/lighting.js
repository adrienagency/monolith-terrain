// STUDIO LIGHTING — a 24 h sun cycle + a bank of studio presets, from the
// lighting-artist research (three-point, Rembrandt, high/low-key, museum
// vitrine, golden hour, overcast…). The scene already owns a DirectionalLight
// "sun", a HemisphereLight, and scene.environment (RoomEnvironment PMREM) with
// scene.environmentIntensity as the global IBL dose. A preset reconfigures
// those three and toggles up to two RectAreaLights ("softboxes", the three.js
// way — MeshStandardMaterial only, no shadows) + one accent SpotLight.
//
// RectAreaLightUniformsLib must be initialised once before RectAreaLight lights
// contribute anything — done in the constructor.

import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'

// hex per colour temperature (Kelvin), from the research table
const K = {
  candle: '#ff8b14',
  tungsten: '#ffb46b',
  golden: '#ffc58f',
  museum: '#ffcf9a',
  warmWhite: '#ffcf9a',
  neutral: '#ffdcbe',
  flash: '#ffe9d6',
  daylight: '#fff4ea',
  d65: '#ffffff',
  shadeCool: '#e8f0ff',
  skyBlue: '#cfe0ff',
  moon: '#aebfe0',
}

// ---------------------------------------------------------- 24 h sun cycle
// hour 0..24 → sun azimuth/elevation/intensity/colour + hemisphere fill.
// Day arc peaks at noon; sun dips below the horizon at night and a dim cool
// moonlight + hemisphere fill carries the scene.
export function sunFromHour(hour) {
  // daytime parameter: 0 at 06:00, 1 at 18:00
  const t = (hour - 6) / 12
  const dayArc = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) // 0..1..0 across the day
  const isDay = hour >= 5.5 && hour <= 18.5
  // sun travels E→S→W: az 90° (dawn) → 180° (noon) → 270° (dusk)
  const azimuth = 90 + ((hour - 6) / 12) * 180
  // elevation: horizon at 6/18, ~68° at noon; small negative at night
  const elevation = isDay ? Math.max(2, dayArc * 68) : 6
  // warmth: low sun = golden, high sun = daylight white
  const warm = 1 - Math.min(1, elevation / 45)
  const dayColor = new THREE.Color(K.daylight).lerp(new THREE.Color(K.golden), warm)
  const color = isDay ? dayColor : new THREE.Color(K.moon)
  const intensity = isDay ? 1.2 + dayArc * 7.5 : 0.5
  // sky fill: bright blue by day, deep by night; ground warm
  const hemiSky = isDay ? new THREE.Color('#bcd4ff') : new THREE.Color('#20304e')
  const hemiGround = new THREE.Color('#4a3a2a')
  const hemiIntensity = isDay ? 0.35 + dayArc * 0.5 : 0.28
  const envIntensity = isDay ? 0.12 + dayArc * 0.28 : 0.18
  return { azimuth, elevation, intensity, color, hemiSky, hemiGround, hemiIntensity, envIntensity }
}

// ------------------------------------------------------------- studio presets
// Each preset reconfigures sun/hemi/env and (optionally) the two area lights +
// the accent spot. Positions are in scene units around a ~56-unit block.
// area/spot entries omitted = that fixture is off for this preset.
export const LIGHT_PRESETS = {
  'map-default': { label: 'Map light' }, // sentinel: restore the template's own light
  'three-point': {
    label: 'Three-point',
    sun: { intensity: 5.2, color: K.daylight, az: 40, el: 42, shadow: true },
    hemi: { intensity: 0.3, sky: '#dfeaff', ground: '#4a4038' },
    env: 0.5,
    areaA: { color: K.flash, intensity: 3.2, w: 24, h: 24, pos: [-34, 16, 24] }, // fill, opposite
    areaB: { color: K.skyBlue, intensity: 7, w: 12, h: 12, pos: [-16, 30, -34] }, // rim, behind/high
  },
  rembrandt: {
    label: 'Rembrandt',
    sun: { intensity: 5.6, color: K.neutral, az: 55, el: 40, shadow: true },
    hemi: { intensity: 0.15, sky: '#d6ddf0', ground: '#3a3026' },
    env: 0.25,
  },
  'studio-sweep': {
    label: 'Studio sweep',
    sun: { intensity: 2.2, color: K.daylight, az: 45, el: 40, shadow: true },
    hemi: { intensity: 0.5, sky: '#eef4ff', ground: '#5a5248' },
    env: 1.0,
    areaA: { color: K.daylight, intensity: 5, w: 26, h: 34, pos: [-28, 28, 28] }, // key
    areaB: { color: K.daylight, intensity: 3, w: 26, h: 34, pos: [28, 18, 24] }, // fill 0.6x
  },
  'high-key': {
    label: 'High-key',
    sun: { intensity: 2.0, color: K.d65, az: 30, el: 62, shadow: false },
    hemi: { intensity: 0.85, sky: '#ffffff', ground: '#d8dce2' },
    env: 1.25,
    areaA: { color: '#ffffff', intensity: 4, w: 40, h: 40, pos: [-34, 22, 24] },
    areaB: { color: '#ffffff', intensity: 4, w: 40, h: 40, pos: [34, 22, 24] },
  },
  'low-key': {
    label: 'Low-key',
    sun: { intensity: 6.5, color: K.flash, az: 40, el: 58, shadow: true },
    hemi: { intensity: 0.05, sky: '#1c2436', ground: '#0a0a0c' },
    env: 0.1,
    areaB: { color: K.skyBlue, intensity: 5, w: 10, h: 18, pos: [-20, 24, -28] }, // cold rim
    background: '#0a0a0c',
  },
  overcast: {
    label: 'Overcast',
    sun: { intensity: 0.5, color: K.shadeCool, az: 30, el: 60, shadow: false },
    hemi: { intensity: 1.25, sky: '#eaf1ff', ground: '#8a8f96' },
    env: 1.25,
  },
  'golden-hour': {
    label: 'Golden hour',
    sun: { intensity: 5.0, color: K.tungsten, az: 118, el: 9, shadow: true },
    hemi: { intensity: 0.6, sky: '#bcd4ff', ground: '#4a3a2a' },
    env: 0.55,
  },
  'museum-vitrine': {
    label: 'Museum vitrine',
    sun: { intensity: 1.0, color: K.neutral, az: 300, el: 40, shadow: false },
    hemi: { intensity: 0.22, sky: '#2a2a34', ground: '#101014' },
    env: 0.4,
    areaA: { color: '#ffe6c8', intensity: 5, w: 34, h: 34, pos: [0, 34, 0] }, // ceiling top-light
    spot: { color: K.museum, intensity: 42, angle: 28, penumbra: 0.4, pos: [14, 30, 14] },
    background: '#0c0c0f',
  },
}

export class StudioLighting {
  constructor({ scene, sun, hemi }) {
    RectAreaLightUniformsLib.init()
    this.scene = scene
    this.sun = sun
    this.hemi = hemi
    this.current = 'map-default'

    this.areaA = new THREE.RectAreaLight(0xffffff, 0, 20, 20)
    this.areaB = new THREE.RectAreaLight(0xffffff, 0, 20, 20)
    this.areaA.visible = this.areaB.visible = false
    this.spot = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 6, 0.4, 1.2)
    this.spot.visible = false
    this.spot.target.position.set(0, 0, 0)
    scene.add(this.areaA, this.areaB, this.spot, this.spot.target)
  }

  _setArea(light, cfg) {
    if (!cfg) {
      light.visible = false
      return
    }
    light.color.set(cfg.color)
    light.intensity = cfg.intensity
    light.width = cfg.w
    light.height = cfg.h
    light.position.set(...cfg.pos)
    light.lookAt(0, 0, 0)
    light.visible = true
  }

  // Apply a preset. `hooks` provides placeSun (to re-seat the sun after we set
  // its az/el/intensity into params) and setBackground(color|null). Writing to
  // params keeps the sliders and the rest of the app in sync.
  apply(name, { params, placeSun, setBackground }) {
    const p = LIGHT_PRESETS[name] ?? LIGHT_PRESETS['map-default']
    this.current = name
    if (name === 'map-default' || !p.sun) {
      // restore: hide studio fixtures, hand control back to the template look
      this.areaA.visible = this.areaB.visible = this.spot.visible = false
      setBackground?.(null)
      return
    }
    // sun ← preset (through params so the Light sliders read the new values)
    params.sunIntensity = p.sun.intensity
    params.sunAzimuth = p.sun.az
    params.sunElevation = p.sun.el
    this.sun.color.set(p.sun.color)
    params.shadowMode = p.sun.shadow ? params.shadowMode === 'off' ? 'static' : params.shadowMode : 'off'
    this.sun.castShadow = !!p.sun.shadow
    // hemi
    params.hemiIntensity = p.hemi.intensity
    this.hemi.color.set(p.hemi.sky)
    this.hemi.groundColor.set(p.hemi.ground)
    // env dose
    params.envLight = p.env
    this.scene.environmentIntensity = p.env
    // area softboxes + accent spot
    this._setArea(this.areaA, p.areaA)
    this._setArea(this.areaB, p.areaB)
    if (p.spot) {
      this.spot.color.set(p.spot.color)
      this.spot.intensity = p.spot.intensity
      this.spot.angle = THREE.MathUtils.degToRad(p.spot.angle)
      this.spot.penumbra = p.spot.penumbra
      this.spot.position.set(...p.spot.pos)
      this.spot.visible = true
    } else {
      this.spot.visible = false
    }
    setBackground?.(p.background ?? null)
    placeSun?.()
  }
}
