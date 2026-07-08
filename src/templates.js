// Look templates — each one is a FULL bundle of parameters tuned to reproduce
// a reference image's style: palette + oceans, contour/grid, hillshade lighting,
// surface material, background, post-look, and scene toggles (clouds / slab).
// Camera and navigation are never touched. Pure data — no DOM, no three.js.
//
// ICELAND — from a cool bathymetric shaded-relief plate: near-white lit peaks,
// pale steel-blue lowlands deepening to navy in the troughs, crisp low-angle
// hillshade, no contour lines, no grid, a flat map (no slab, no clouds).

export const TEMPLATES = {
  iceland: {
    label: 'ICELAND',
    darkMode: false,
    palette: {
      // land: steel-blue coast and mid-slopes climbing to white summits
      // (cool, inverted-warm) — kept a touch deeper so the mid-relief reads
      // steel-blue like the reference rather than washing out pale
      gradLow: '#a9c2da',
      gradMid1: '#c2d5e8',
      gradMid2: '#e2edf6',
      gradHigh: '#ffffff',
      gradMid1Pos: 0.38,
      gradMid2Pos: 0.66,
      // water: pale shallows → mid steel → deep navy trenches
      oceanShallow: '#bcd3e6',
      oceanMid: '#5f8cbb',
      oceanDeep: '#22406b',
      ink: '#3a5578',
    },
    style: {
      mapTint: 0.68, // blue dominates the mid-slopes while the hillshade sculpts
      heightContrast: 3.4,
      heightPivot: 0.46,
      slopeTint: 0, // no warm slope brown — this world is blue and white
    },
    // flatten the relief toward a bathymetric plate (camera untouched)
    terrain: { demExaggeration: 1.0 },
    grid: {
      contourInterval: 0.12,
      contourOpacity: 0, // the reference has no contour lines
      contourColor: '#3a5578',
      contourWeight: 0.7,
      gridStep: 6,
      gridOpacity: 0, // and no survey grid
      gridColor: '#3a5578',
    },
    // low, raking sun from the upper-left for the crisp bathymetric hillshade
    light: {
      sunIntensity: 9.2,
      sunAzimuth: 315,
      sunElevation: 27,
      hemiIntensity: 0.5,
      envLight: 0.12,
      shadowSoftness: 6,
    },
    surface: {
      color: '#eef3f8',
      roughness: 1,
      roughnessVariation: 0.2,
      roughnessScale: 11,
      bumpScale: 1.1,
      envMapIntensity: 0.15,
    },
    look: {
      fogColor: '#eaf1f7', // pale ice sheet behind the map, no warm sky
      exposure: 1.02,
      contrast: 0.12,
      saturation: -0.15,
      vignette: 0.35,
      grain: 0,
      clouds: false, // a flat plate — no volumetric clouds
      plinth: false, // and no 3D slab
    },
  },

  // THE FALLOUT WASTELANDS — from a warm ochre shaded-relief plate (Thailand):
  // white summits, deep sienna/brown flanks losing altitude into a light
  // golden-orange lowland, a very pale sea, on a warm cream background. Same
  // flat-plate treatment as ICELAND but scorched instead of frozen.
  'fallout-wastelands': {
    label: 'FALLOUT WASTELANDS',
    darkMode: false,
    palette: {
      // by elevation: bright golden-yellow plains → orange foothills → dark
      // sienna flanks → white peaks (a non-monotonic warm ramp, the plate's
      // signature). Plains pushed lighter/yellower toward the reference.
      gradLow: '#e6c86e', // bright golden-yellow lowland
      gradMid1: '#bd7a2f', // orange ochre foothills
      gradMid2: '#653818', // dark sienna / burnt-umber flanks
      gradHigh: '#f7f1e6', // white-hot summits
      gradMid1Pos: 0.34,
      gradMid2Pos: 0.7,
      // a very light, barely-tinted sea
      oceanShallow: '#e9e7df',
      oceanMid: '#ddd9cd',
      oceanDeep: '#c7c1b0',
      ink: '#4a2f18',
    },
    style: {
      mapTint: 0.8, // the warm ramp leads while the hillshade still sculpts
      heightContrast: 4.2,
      heightPivot: 0.4, // most of the range is warm; white only at the very top
      slopeTint: 0.55, // warm brown darkens the steep faces like the reference
    },
    grid: {
      contourInterval: 0.12,
      contourOpacity: 0,
      contourColor: '#4a2f18',
      contourWeight: 0.7,
      gridStep: 6,
      gridOpacity: 0,
      gridColor: '#4a2f18',
    },
    // warm raking hillshade from the upper-left, low and strong
    light: {
      sunIntensity: 9,
      sunAzimuth: 315,
      sunElevation: 26,
      hemiIntensity: 0.45,
      envLight: 0.14,
      shadowSoftness: 6,
    },
    surface: {
      color: '#e7ddc8',
      roughness: 1,
      roughnessVariation: 0.25,
      roughnessScale: 10,
      bumpScale: 1.2,
      envMapIntensity: 0.14,
    },
    look: {
      fogColor: '#e9e4da', // warm cream sheet behind the plate
      exposure: 1.03,
      contrast: 0.14,
      saturation: 0.05, // let the ochres stay saturated and warm
      vignette: 0.4,
      grain: 0,
      clouds: false,
      plinth: false,
    },
    // relief stands proud of the golden plain, but pulled toward the flat-plate
    // read so the mountains read as a printed relief map, not a tall diorama
    terrain: { demExaggeration: 1.25 },
  },
}
