// Noyau Gerstner partagé (démo ocean-lab + ShibuMap). Déclare ses propres
// uniforms de spectre ; l'hôte fournit uWaveA/uWaveB via seaStateToUniforms().
//
// Théorie : sommation linéaire (Airy) de 16 trains d'ondes, cambrure de
// Gerstner répartie au prorata de l'énergie (uWaveB[i].z), bornée par la
// limite de Stokes (q k a <= 1). `crest` est le jacobien de convergence
// normalisé : ~1 quand la crête locale approche le point de déferlement.
export const GERSTNER_GLSL = /* glsl */ `
uniform vec4 uWaveA[16]; // dir.x, dir.z, k (rad/m), amplitude (m)
uniform vec4 uWaveB[16]; // phase, omega (rad/s), part de cambrure, 0

// xz en unités scène ; lenScale = unités scène par "mètre" du spectre
// (1.0 pour un monde en mètres). Retourne le déplacement (x, y, z) ;
// nAcc.xz = pentes accumulées, nAcc.y / crest = jacobien (déferlement).
vec3 oceanGerstner(vec2 xz, float t, float waveH, float chop, float speedMul,
                   float lenScale, float fade, out vec3 nAcc, out float crest) {
  vec3 disp = vec3(0.0);
  nAcc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    vec2 d = uWaveA[i].xy;
    float k = uWaveA[i].z / lenScale;
    float a = uWaveA[i].w * lenScale * waveH * fade;
    if (a < 1e-7) continue;
    float f = k * dot(d, xz) - uWaveB[i].y * speedMul * t + uWaveB[i].x;
    float q = min(chop * 1.9 * uWaveB[i].z * fade / (k * a), 1.0 / (k * a));
    float S = sin(f);
    float C = cos(f);
    disp.x += q * a * d.x * C;
    disp.z += q * a * d.y * C;
    disp.y += a * S;
    float WA = k * a;
    nAcc.x += d.x * WA * C;
    nAcc.z += d.y * WA * C;
    nAcc.y += q * WA * S;
  }
  crest = clamp(nAcc.y / (chop * 1.9 + 0.001), 0.0, 1.5);
  return disp;
}
`;
