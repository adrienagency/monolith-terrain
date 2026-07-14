// Central feature flags. The default value here is exactly what ships to
// production. OFF (false) means: skip the module's initialisation AND its UI
// section, so there are no orphan controllers and no empty panels. The
// feature's code stays in the repo — flip the flag to true to bring it back.
export const FLAGS = {
  water: false, // v37 water simulation (ocean.js) — rejected by Adrien, kept disabled
  lightingPresets: false, // v40 studio presets + 24h slider (lighting.js) — rejected, kept disabled
}
