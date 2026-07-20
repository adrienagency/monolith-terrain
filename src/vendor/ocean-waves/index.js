import * as THREE from "three";

export { GERSTNER_GLSL } from "./gerstner.glsl.js";
export { sunLook, toHex } from "./sunlook.js";

// Génération d'un état de mer aléatoire — théorie linéaire des vagues (Airy) :
//   - relation de dispersion en eau profonde : omega = sqrt(g * k)
//   - deux systèmes croisés (houle longue + mer du vent courte), comme en mer
//     réelle : leurs interférences produisent des groupes et des vagues
//     occasionnellement plus hautes (sommation constructive)
//   - amplitude ~ pente constante par système (a = s * lambda / 2pi, esprit
//     Phillips : les composantes courtes portent moins d'énergie)
//   - phases aléatoires : aucune répétition visible, chaque seed diffère
export const WAVE_COUNT = 16;
const G = 9.81;

// PRNG déterministe (mulberry32) pour pouvoir rejouer un seed
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addSystem(waves, rng, { count, dir, spread, wlMin, wlMax, steep }) {
  for (let i = 0; i < count; i++) {
    // longueurs d'onde log-espacées + jitter : jamais commensurables
    const u = (i + 0.3 + rng() * 0.4) / count;
    const wl = wlMin * Math.pow(wlMax / wlMin, u);
    const k = (2 * Math.PI) / wl;
    // étalement directionnel (~ cos^2s) approché par tirage triangulaire
    const theta = dir + (rng() + rng() - 1) * spread;
    const amp = ((steep * wl) / (2 * Math.PI)) * (0.55 + 0.9 * rng());
    waves.push({
      dx: Math.cos(theta),
      dz: Math.sin(theta),
      k,
      amp,
      phase: rng() * Math.PI * 2,
      omega: Math.sqrt(G * k), // dispersion eau profonde
    });
  }
}

export function makeSeaState(seed = (Math.random() * 2 ** 31) | 0) {
  const rng = mulberry32(seed);
  const waves = [];

  // houle : pic spectral ÉTROIT — 3 composantes concentrent ~60 % de
  // l'énergie, condition pour des crêtes réellement cambrées (ka visible)
  const swellDir = rng() * Math.PI * 2;
  addSystem(waves, rng, {
    count: 3, dir: swellDir, spread: 0.20,
    wlMin: 12, wlMax: 24, steep: 0.14,
  });

  // mer du vent : plus courte, très étalée, direction croisée (45° à 110°)
  const windDir = swellDir + (0.8 + rng() * 1.1) * (rng() < 0.5 ? -1 : 1);
  addSystem(waves, rng, {
    count: WAVE_COUNT - 3, dir: windDir, spread: 0.85,
    wlMin: 2.5, wlMax: 11, steep: 0.12,
  });

  // normalisation : l'amplitude sommée vaut ~1.5 m pour waveH = 1
  // (hauteur significative ~1.2 m ; les groupes d'interférence font des
  // vagues nettement plus hautes que la moyenne)
  const sum = waves.reduce((s, w) => s + w.amp, 0);
  const scale = 1.5 / sum;
  for (const w of waves) w.amp *= scale;

  // part de cambrure de chaque composante ~ sa part d'énergie : ce sont les
  // grosses vagues qui se creusent et déferlent, pas le clapot
  const total = waves.reduce((s, w) => s + w.amp, 0);
  for (const w of waves) w.qShare = w.amp / total;

  return { seed, waves };
}

export function seaStateToUniforms(sea) {
  return {
    a: sea.waves.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.amp)),
    b: sea.waves.map((w) => new THREE.Vector4(w.phase, w.omega, w.qShare, 0)),
  };
}
