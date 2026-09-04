// Turn a lat/lon polyline into terrain-hugging world geometry. Long segments are
// densified before height sampling so a line follows the hill between two far
// vertices instead of cutting straight through it.

// ⚠️ 2026-09-04 — `densifyWorld` et `drapeWorld` sont partis d'ici. C'était le
// drapage d'une polyligne sur un terrain PLAT en XZ, la mécanique des calques
// du monde d'avant le globe ; il partait avec le calque Routes
// (`map/tile-loader.js:125` : « PLUS de road-tiles : le calque Routes a quitté
// le site »). Zero appelant dans src/, scripts/, netlify/ : seul son propre
// test le tenait en vie, et il part avec.
//
// ⚠️ `latlonToWorldPts`, ci-dessous, est VIVANT — `map/water-layer.js` l'appelle
// trois fois (l.189, 193, 813). Le fichier reste, les deux fonctions partent.

// project a GeoJSON [lon,lat] ring to terrain world XZ via the loaded DEM
export function latlonToWorldPts(coords, dem, latLonToWorld) {
  return coords.map(([lon, lat]) => { const w = latLonToWorld(dem, lat, lon); return { x: w.x, z: w.z } })
}
