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
      // land: pale blue coast climbing to white summits (inverted-warm, cool)
      gradLow: '#ccdcea',
      gradMid1: '#dce7f1',
      gradMid2: '#edf3f9',
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
      mapTint: 0.6, // enough blue while the hillshade still sculpts the relief
      heightContrast: 3.4,
      heightPivot: 0.46,
      slopeTint: 0, // no warm slope brown — this world is blue and white
    },
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
}
