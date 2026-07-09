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
      // 8 tints tuned by the user's ICELAND base settings — bold electric blues
      // through pale ice to a light-grey summit cap
      rampStops: [
        { c: '#0082e6', p: 0.0 },
        { c: '#6bb5f5', p: 0.16 },
        { c: '#338ad7', p: 0.32 },
        { c: '#c8dcec', p: 0.48 },
        { c: '#1c9ffd', p: 0.64 },
        { c: '#dbdeff', p: 0.8 },
        { c: '#559eec', p: 0.92 },
        { c: '#d9d9d9', p: 1.0 },
      ],
      // water: pale shallows → mid blue → deep navy trenches
      oceanShallow: '#bcd3e6',
      oceanMid: '#6cb3fe',
      oceanDeep: '#22406b',
      ink: '#0c0b7a', // deep indigo ink, matching the contour lines
    },
    style: {
      mapTint: 0.68, // blue dominates the mid-slopes while the hillshade sculpts
      heightContrast: 3.4,
      heightPivot: 0.49,
      slopeTint: 0.48, // a touch of slope shading sculpts the flanks
    },
    // elevation (demExaggeration + fine detail) is NOT set here — every template
    // shares the default look's elevation settings as a single source of truth
    grid: {
      contourInterval: 0.29,
      contourOpacity: 0.86, // crisp indigo contour lines
      contourColor: '#0c0b7a',
      contourWeight: 0.55,
      gridStep: 5,
      gridOpacity: 0.54, // a light survey grid over the plate
      gridColor: '#242220',
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
      // the 3D slab is shared by every template (one block model) so switching
      // looks never makes the base drop out — templates only restyle it
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
      // 8 tints, non-monotonic warm signature: bright golden-yellow plains →
      // orange foothills → dark sienna/burnt-umber flanks → white-hot summits
      rampStops: [
        { c: '#e8cb72', p: 0.0 }, // bright golden-yellow lowland
        { c: '#d9a84e', p: 0.16 },
        { c: '#c2802f', p: 0.34 }, // orange ochre foothills
        { c: '#9a5624', p: 0.52 },
        { c: '#6e3d1a', p: 0.68 }, // dark sienna flanks
        { c: '#8a5a30', p: 0.82 },
        { c: '#c99a63', p: 0.92 },
        { c: '#f7f1e6', p: 1.0 }, // white-hot summits
      ],
      // sea in blue tones — pale, but blue rather than beige
      oceanShallow: '#cfe0e8',
      oceanMid: '#8fb0c4',
      oceanDeep: '#4d7791',
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
      // slab shared across templates — never toggled off (see ICELAND note)
    },
    // elevation shared from the default look (no per-template exaggeration)
  },

  // DENALI — from the classic USGS shaded-relief plate of Denali National Park:
  // a full hypsometric band system — green tundra lowlands rising through tan
  // and ochre rock to reddish-brown high ridges, then grey scree and white
  // snow/ice on the summits — over blue water. Strong relief, no flat plate.
  denali: {
    label: 'DENALI',
    darkMode: false,
    palette: {
      // 8 tints low → high: forest/tundra green → khaki → tan → ochre-brown →
      // reddish rock → grey scree → snow white
      // user-tuned DENALI base ramp: green tundra → sage → khaki → tan → ochre
      // → red-brown rock → near-black brown → light-grey summit cap
      rampStops: [
        { c: '#819669', p: 0.0 }, // green tundra lowland
        { c: '#b3c388', p: 0.14 },
        { c: '#abb795', p: 0.28 },
        { c: '#cdb079', p: 0.42 }, // tan
        { c: '#bd8a56', p: 0.56 }, // ochre-brown
        { c: '#9a4f2c', p: 0.7 }, // reddish-brown high rock
        { c: '#49330d', p: 0.84 }, // deep umber
        { c: '#d9d7d3', p: 1.0 }, // light-grey summit cap
      ],
      // blue water, deepening
      oceanShallow: '#bcd6e4',
      oceanMid: '#7ba7c2',
      oceanDeep: '#3f6f92',
      ink: '#3a3326',
    },
    style: {
      mapTint: 0.82, // the band colors lead, hillshade still carves the ridges
      heightContrast: 3.8,
      heightPivot: 0.42,
      slopeTint: 0.08, // barely any warm slope shading
    },
    grid: {
      contourInterval: 0.31,
      contourOpacity: 0.52,
      contourColor: '#332305',
      contourWeight: 0.85,
      gridStep: 3,
      gridOpacity: 0.32,
      gridColor: '#3a3326',
    },
    light: {
      sunIntensity: 5.3,
      sunAzimuth: 142,
      sunElevation: 11,
      hemiIntensity: 0.5,
      envLight: 0.18,
      shadowSoftness: 9,
    },
    surface: {
      color: '#e7e2d6',
      roughness: 1,
      roughnessVariation: 0.22,
      roughnessScale: 10,
      bumpScale: 1.1,
      envMapIntensity: 0.16,
    },
    look: {
      fogColor: '#eceae4', // pale neutral paper behind the plate
      exposure: 1.02,
      contrast: 0.12,
      saturation: 0,
      vignette: 0.38,
      grain: 0,
      clouds: true, // a mounted 3D plate — let the dense volumetric clouds ride over it
      plinth: true, // a mounted USGS relief plate — keep the 3D slab + shadow
    },
    // elevation shared from the default look (no per-template exaggeration)
  },
}
