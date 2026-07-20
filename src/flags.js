// Central feature flags. The default value here is exactly what ships to
// production. OFF (false) means: skip the module's initialisation AND its UI
// section, so there are no orphan controllers and no empty panels. The
// feature's code stays in the repo — flip the flag to true to bring it back.
export const FLAGS = {
  // v39: back on — the wave engine is now the shared "ocean-waves" random
  // spectrum (ocean-lab repo), with a Sea toggle in the Effects panel, OFF by
  // default (params.waterReal). The rejected v37 Beaufort system is replaced.
  water: true,
}
