// REAL WATER (test) — a physically-flavoured ocean/lake surface that replaces
// the glass water when params.waterReal is on. Three requested behaviours:
//  · SHALLOWS are translucent — the seabed shows through, and animated sun
//    caustics ("rays through the water") play over them;
//  · DEPTHS darken and turn opaque (Beer-Lambert-ish colour ramp on depth);
//  · SEA STATE is a random 16-wave spectrum from the shared ocean-waves lib
//    (ocean-lab): two crossed systems (narrow swell + spread wind sea), deep
//    water dispersion, energy-weighted Gerstner steepness, jacobian breaking.
//    Height/choppiness/speed ride user sliders; a seed replays an exact sea.
// Depth comes from a small height+shore-distance field baked from the live
// terrain sampler at rebuild time: R = ground Y (scene units), G = distance
// to the nearest shore (normalised) — the fallback "depth" where the DEM
// carries no bathymetry (fine zooms) and for altitude lakes, whose beds are
// flat in the source data. Lakes reuse detectLakes() and get a per-lake
// coverage mask (A) + shore-distance (G) texture over their bounding box.
// Everything here is additive and disposable: turning the option off removes
// the meshes and restores the glass system untouched.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { detectLakes } from './lake.js'
// wave engine shared with ocean-lab (C:\Dev\ocean-lab) — the Vite alias
// resolves to the LIVE ocean-lab source when it's cloned next to this repo,
// to the committed src/vendor/ocean-waves copy otherwise (npm run sync:waves)
import { makeSeaState, seaStateToUniforms, GERSTNER_GLSL } from 'ocean-waves'

const FIELD_RES = 384 // height/shore field over the whole slab

// spectrum units → scene units: the sea state is authored in "spectrum
// metres" (dominant swell λ 12-24 m); at 0.12 scene units per metre the
// dominant wavelength lands at 1.4-2.9 scene units — the same band the old
// four-train Beaufort system used, tuned for the diorama read
// v39: 0.12 was "physically" scaled — the wind sea fell under the mesh grid
// (invisible: one single swell train read on screen) and the whole sea was
// too quiet. 0.42 is deliberately oversized: both crossed systems resolve,
// the sea reads COOL rather than realistic (Adrien's call).
const LEN_SCALE = 0.42
const SPEC_AMP_SUM = 1.5 // makeSeaState normalises the summed amplitude to this

const smooth01 = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x) }
const _v2 = new THREE.Vector2()

// v45 : HOULE DE CÔTE — un train d'ondes concentrique porté par le champ de
// distance au rivage (canal G de uField). Ses fronts suivent les iso-lignes
// de la côte : ils s'enroulent autour des îles et arrivent TOUJOURS face à la
// plage (la réfraction des vagues en eau peu profonde des photos aériennes),
// gonflent en approchant (shoaling) puis cassent — crestS nourrit l'écume.
// Retour Adrien : la mer spectre seule lisait comme « deux trains qui se
// croisent », sans aucune interaction avec les terres.
// Renvoie vec3(dy, pente·x, pente·z) ; crestS ressort pour le déferlement.
const SHORE_SURF_GLSL = /* glsl */ `
vec3 shoreSurf(vec2 uvF, sampler2D field, float t, float waveH, float chop, float speedMul, float lenScale, float viewCalm, out float crestS) {
  float dShore = texture2D(field, uvF).g; // 0..1 sur ~15 unités monde
  // bande de ressac : morte à la ligne d'eau, éteinte au large
  float shoal = (1.0 - smoothstep(0.02, 0.22, dShore)) * smoothstep(0.006, 0.03, dShore);
  crestS = 0.0;
  if (shoal <= 0.001) return vec3(0.0);
  vec2 e = vec2(1.0 / 384.0, 0.0);
  float gX = texture2D(field, uvF + e.xy).g - texture2D(field, uvF - e.xy).g;
  float gZ = texture2D(field, uvF + e.yx).g - texture2D(field, uvF - e.yx).g;
  vec2 dir = vec2(gX, gZ);
  float gLen = length(dir);
  dir = gLen > 1e-5 ? dir / gLen : vec2(0.0);
  float lamS = max(lenScale * 3.5, 0.4); // longueur d'onde du train de côte
  float k = 6.28318 / lamS;
  float ph = dShore * 15.0 * k + t * speedMul * 2.6; // fronts qui AVANCENT vers la plage
  float amp = waveH * viewCalm * lenScale * 0.16 * shoal;
  float s = sin(ph);
  float c = cos(ph);
  crestS = shoal * (0.35 + 0.65 * chop) * max(s, 0.0) * 1.6;
  return vec3(amp * s, amp * c * k * dir.x, amp * c * k * dir.y);
}
`

// choppiness → the shading knobs the old Beaufort scale used to derive
function chopLook(c) {
  return { detail: 0.25 + 0.5 * c, foam: 1.9 * c * c, gloss: 240 - 130 * c } // quadratique : mer d'huile 0, agite genereux
}

// Fonds marins (vignettes du panneau Effets > Sea). 'map' laisse la carte se
// lire à travers l'eau ; les autres peignent un fond procédural (dégradé
// A→B sur la profondeur + grain, caustiques du soleil sur les fonds clairs).
// Chaque preset est une rampe de FOND appliquee au terrain sous-marin
// (oceanShallow/Mid/Deep) - l'eau transparente au-dessus fait le reste :
// sable clair + lame turquoise peu profonde = rendu lagon caraibes.
export const SEABEDS = [
  { id: 'map', name: 'Map', floor: null, caustics: 0 },
  { id: 'sand', name: 'Sand', floor: { shallow: '#efe3c0', mid: '#dcc491', deep: '#ab9066' }, caustics: 1 },
  { id: 'lagoon', name: 'Lagoon', floor: { shallow: '#c8f2e4', mid: '#62cfc1', deep: '#136e7d' }, caustics: 1 },
  { id: 'abyss', name: 'Abyss', floor: { shallow: '#27435e', mid: '#122a42', deep: '#050c16' }, caustics: 0 },
  { id: 'seagrass', name: 'Seagrass', floor: { shallow: '#7ba375', mid: '#3f6d4c', deep: '#16301f' }, caustics: 1 },
  { id: 'ink', name: 'Ink', floor: { shallow: '#4a6a84', mid: '#2c4964', deep: '#16293a' }, caustics: 0 },
]

const VERT = /* glsl */ `
uniform float uTime;
uniform float uWaveH;    // wave height (user slider), in spectrum metres
uniform float uChop;     // choppiness 0..1 (crest sharpening + breaking)
uniform float uSpeedMul; // time multiplier over the deep-water dispersion
uniform float uLenScale; // scene units per spectrum metre
uniform float uLift;     // élévation du niveau moyen AU LARGE uniquement :
                         // à la côte le niveau meurt exactement à zéro (fade)
uniform float uWaterY;
uniform float uHalf;     // le deplacement horizontal des vagues s'annule au
                         // bord du bloc pour rester soude a la jupe laterale
uniform float uViewCalm; // 1 pres du sol -> 0 en tres haute altitude (la mer
                         // s'aplatit au-dela de ~10 km : vagues/ecume envahissantes)
${GERSTNER_GLSL}
${SHORE_SURF_GLSL}
uniform sampler2D uField;   // R ground Y, G shore distance (slab-wide)
#ifdef IS_LAKE
uniform sampler2D uMask;    // A coverage, G shore distance (lake bbox)
uniform vec2 uMaskMin;
uniform vec2 uMaskSize;
#endif
varying vec3 vWorld;
varying vec3 vNorm;
varying float vCrest;
varying float vFade;
#include <fog_pars_vertex>

void main() {
  vec3 p = position; // geometry is authored in world XZ, y = 0
  vec2 xz = p.xz;

  // waves die out on the beach: fade by the local depth so a swell can never
  // wash over the coastline polygons
  vec2 uvF = xz / ${TERRAIN_SIZE.toFixed(1)} + 0.5;
  vec2 f = texture2D(uField, uvF).rg;
#ifdef IS_LAKE
  vec2 m = (xz - uMaskMin) / uMaskSize;
  float shoreD = texture2D(uMask, m).g;
#else
  float shoreD = max((uWaterY - f.r) * 2.0, f.g);
#endif
  // v45 : les vagues vivent JUSQU'À la côte — le déclin v40 (0.35) aplatissait
  // toute la frange côtière : plus aucune interaction mer/îles. Le niveau
  // moyen (uLift) garde lui sa longue rampe : pas de mur d'eau. vFade reste
  // le repère côtier LARGE du fragment (écume, réfraction).
  float fade = smoothstep(0.0, 0.10, shoreD);
  float fadeLift = smoothstep(0.0, 0.55, shoreD);
  vFade = smoothstep(0.0, 0.35, shoreD);

  // shared 16-wave random spectrum (ocean-waves lib): two crossed systems
  // (narrow swell + spread wind sea), energy-weighted Gerstner steepness,
  // breaking measured by the surface jacobian (crest ~1 = folding whitecap).
  // The shore fade rides inside: swell dies on the beach, never over land.
  vec3 nAcc;
  float crest;
  vec3 disp = oceanGerstner(xz, uTime, uWaveH * uViewCalm, uChop, uSpeedMul, uLenScale, fade, nAcc, crest);
  // houle de côte : fronts qui suivent le trait de côte, gonflent et cassent
  float crestS;
  vec3 surf = shoreSurf(uvF, uField, uTime, uWaveH, uChop, uSpeedMul, uLenScale, uViewCalm, crestS);
  disp.y += surf.x;
  nAcc.x += surf.y;
  nAcc.z += surf.z;
  crest = max(crest, crestS);
  float edgeHold = 1.0 - smoothstep(uHalf - 2.0, uHalf - 0.15, max(abs(p.x), abs(p.z)));
  p.xz += disp.xz * edgeHold;
  // niveau moyen : zéro exactement à la ligne de côte, remonté au large de
  // l'amplitude sommée pour que les creux ne percent jamais la plaine marine.
  // La MER ne dépasse ainsi jamais le trait de côte (retour Adrien v39).
  p.y += disp.y + uLift * fadeLift;
  vCrest = crest;
  vNorm = normalize(vec3(-nAcc.x, 1.0 - nAcc.y, -nAcc.z));
  vWorld = vec3(p.x, uWaterY + p.y, p.z);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  #ifdef USE_FOG
  vFogDepth = -mv.z;
  #endif
}
`

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uDeep;
uniform vec3 uShallowT; // glacis d'eau claire (peu profond)
uniform vec3 uSky;
uniform float uSeabedCaustics; // caustiques du soleil (presets sable/lagon/posidonie)
uniform float uFoamScale;      // moutons dosés par l'échelle de vue
uniform float uViewCalm;       // accalmie en haute altitude (vagues + écume + détail)
uniform sampler2D uSceneTex;   // framebuffer copie juste avant l'eau (grab pass)
uniform vec2 uResolution;
uniform float uRefract;        // intensite de la refraction (slider)
uniform float uLenScale;       // unités scène par mètre de spectre (écume en espace spectre)
uniform float uWaterY;
uniform float uDepthMax;
uniform float uGloss;
uniform float uDetail;
uniform float uFoam;
uniform float uCaustics;
uniform float uTransp; // user slider: 0 = milky, 1 = crystal
uniform float uSunFx;  // user slider: sun on the water, above AND below (glint + caustics)
uniform float uDayLight; // 0 nuit -> 1 jour (sunLook.dayLight) : la mer s'éteint la nuit
uniform sampler2D uField;
uniform float uHalf;     // rounded-square clip: half extent…
uniform float uCornerR;  // …and corner radius (sea only; lakes use the mask)
#ifdef IS_LAKE
uniform sampler2D uMask;
uniform vec2 uMaskMin;
uniform vec2 uMaskSize;
uniform float uLakeDepth;
#endif
varying vec3 vWorld;
varying vec3 vNorm;
varying float vCrest;
varying float vFade;
#include <fog_pars_fragment>

// small tiling value noise for ripples + foam breakup
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// sun caustics — the classic iterated-phase shimmer (Hoskins-style), cheap
// and convincing where the water is clear
float caustic(vec2 p, float t) {
  vec2 i = p;
  float c = 1.0;
  for (int n = 0; n < 3; n++) {
    float ft = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(ft - i.x) + sin(ft + i.y), sin(ft - i.y) + cos(ft + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + ft) / 0.6), p.y / (cos(i.y + ft) / 0.6)));
  }
  c /= 3.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 6.0), 0.0, 1.0);
}

void main() {
  vec2 xz = vWorld.xz;

#ifndef IS_LAKE
  // stay inside the slab's rounded footprint
  vec2 q = abs(xz) - vec2(uHalf - uCornerR);
  float sd = length(max(q, 0.0)) - uCornerR;
  if (sd > 0.0) discard;
#endif

  vec2 uvF = xz / ${TERRAIN_SIZE.toFixed(1)} + 0.5;
  vec2 f = texture2D(uField, uvF).rg;

#ifdef IS_LAKE
  vec2 m = (xz - uMaskMin) / uMaskSize;
  vec4 mask = texture2D(uMask, m);
  if (mask.a < 0.35) discard;
  float depth = mask.g * uLakeDepth;
  float shoreAA = smoothstep(0.35, 0.55, mask.a);
#else
  // real bathymetry when the tiles carry it; distance-to-shore as the stand-in
  // where the sea floor is a flat 0 m plain (fine zooms)
  float depth = max(uWaterY - f.r, f.g * 1.6);
  if (uWaterY - f.r < -0.005) discard; // land
  float shoreAA = smoothstep(0.0, 0.02, depth);
#endif
  float d01 = clamp(depth / uDepthMax, 0.0, 1.0);
  float dpow = pow(d01, 0.65);

  // ripple micro-normals on top of the Gerstner normal
  vec2 rp = xz * 6.0;
  float n1 = vnoise(rp + vec2(uTime * 0.9, 0.0));
  float n2 = vnoise(rp * 1.9 - vec2(0.0, uTime * 1.2));
  vec3 N = normalize(vNorm + uDetail * 0.6 * uViewCalm * vec3(n1 - 0.5, 0.9, n2 - 0.5));

  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunDir);
  // ^5 not ^3: the softer curve painted flat pale "fresnel continents" in
  // rows across wave backs at F2-F3; the cap kills the same artefact on
  // steep F3 wave backs, where dot(N,V)→0 saturates any exponent
  float fres = min(pow(1.0 - max(dot(N, V), 0.0), 5.0), 0.5);

  // v41 : le FOND vit sur le terrain (les vignettes Seabed pilotent la rampe
  // ocean oceanShallow/Mid/Deep du relief) - ici l'eau n'est qu'une lame
  // teintee dont la transparence depend de la VRAIE profondeur : peu d'eau =
  // le fond se lit (sable -> rendu lagon caraibes), profond = teinte pleine.
  // glacis clair en eau peu profonde -> navy au large, sur la profondeur
  // REELLE : sur un fond HDR lumineux (sable au soleil), une lame sombre
  // semi-transparente disparait dans le tone mapping - il faut une couleur
  // d'eau claire qui teinte le fond, pas juste de l'alpha
  // profondeur reelle (bathymetrie seule - pas le proxy distance-au-rivage,
  // c'etait lui le halo) ; les lacs gardent leur masque
#ifdef IS_LAKE
  float dR = d01;
#else
  float dR = clamp(max(uWaterY - f.r, 0.0) / uDepthMax, 0.0, 1.0);
#endif
  // le degrade lagon vit sur les ~premiers 15% du budget de profondeur
  // (une baie de 30 m est un lagon ; uDepthMax couvre des colonnes de 1 km)
#ifdef IS_LAKE
  float dRt = d01;
#else
  float dRt = clamp(max(uWaterY - f.r, 0.0) / max(uDepthMax * 0.15, 0.02), 0.0, 1.0);
#endif
  // transp 0 -> teinte pleine uDeep (peinture opaque, eau foncee possible) ;
  // en montant le slider, le glacis clair des faibles profondeurs s'installe
  float lagoonW = smoothstep(0.0, 0.35, uTransp);
  vec3 body = mix(uDeep, mix(uShallowT, uDeep, pow(dRt, 0.7)), lagoonW);
  body *= mix(vec3(0.10, 0.16, 0.30), vec3(1.0), uDayLight);

  // caustiques du soleil : elles eclairent le FOND, donc d'autant plus
  // visibles que l'eau est claire et peu profonde
  float sunUp = clamp(L.y, 0.0, 1.0);
  float ca = caustic(xz * 4.0 + vec2(uTime * 0.06), uTime * 0.9);
  float ca2 = caustic(xz * 1.8 - vec2(uTime * 0.03), uTime * 0.45);
  float causNet = clamp(ca * 1.3 + ca2 * 0.45, 0.0, 1.5);
  float causMask = uSeabedCaustics * clamp(uCaustics * uSunFx, 0.0, 3.0) * sunUp
                 * (0.05 + 0.95 * uDayLight) * (1.0 - smoothstep(0.0, 0.85, dR));

  // large-scale patchiness: without it the glitter and the whitecaps line up
  // in parallel rows along the dominant swell — the "repeating waves" flag
  // (named patchy: "patch" is a reserved word in GLSL and kills the compile)
  float patchy = smoothstep(0.32, 0.72, vnoise(xz * 0.33 + vec2(uTime * 0.015, -uTime * 0.011)));

  // v44: les reflets (ciel + glint solaire) sont des reflets DE SURFACE :
  // ils s'appliquent APRES le composite de transparence, sinon ils sont
  // dilues comme s'ils venaient du fond — le glint avait disparu (Adrien)
  vec3 col = body;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uGloss) * (0.5 + 1.6 * fres);

  // foam — v40 : le bruit d'écume vit en ESPACE SPECTRE (xz / uLenScale),
  // il suit donc la taille des vagues à tous les zooms — fini les
  // mouchetures pixel des vues larges, et les moutons redeviennent visibles.
  vec2 sm = xz / max(uLenScale, 1e-4);
  float foamNoise = vnoise(sm * 0.55 + vec2(uTime * 0.25, -uTime * 0.18));
  float foamNoise2 = foamNoise * vnoise(sm * 1.35 - vec2(uTime * 0.15, uTime * 0.2)) * 1.6;
  // moutons : vCrest est le jacobien de déferlement normalisé du spectre
  // (~1 quand une crête se replie) — intermittent, seules certaines cassent
  float crestFoam = uFoam * uFoamScale * uViewCalm * smoothstep(0.30, 0.60, vCrest) * smoothstep(0.35, 0.75, foamNoise2) * (0.5 + 0.5 * patchy);
  // écume de bord : bande étroite là où les vagues meurent (vFade), avec des
  // fronts qui arrivent vers la côte — l'écume « contact terre/hauts-fonds »
  // de la version originale, sans le halo du proxy de profondeur
  float bands = 0.5 + 0.5 * sin(vFade * 14.0 - uTime * 1.6 + foamNoise * 4.0);
  // v45 : jonction mer-côte des photos de référence — une bande de ressac
  // texturée qui ourle le trait de côte, plus un LISERÉ net à la ligne d'eau
  float shoreW = (1.0 - smoothstep(0.10, 0.75, vFade)) * smoothstep(0.002, 0.03, vFade);
  float shoreFoam = shoreW * smoothstep(0.22, 0.55, foamNoise * 0.6 + bands * 0.4) * (0.5 + 0.5 * uFoamScale) * uViewCalm;
  // liseré de ressac : blanc franc au contact exact, bord cassé par le bruit
  float swash = (1.0 - smoothstep(0.0, 0.02, vFade)) * smoothstep(0.25, 0.6, foamNoise + 0.2) * uViewCalm;
  float foam = clamp(crestFoam + shoreFoam * 1.8 + swash * 1.1, 0.0, 1.0);

  // v43 : COMPOSITE REFRACTE (grab pass). Le fond deja rendu est
  // echantillonne avec un decalage de Snell : la pente de la surface devie
  // ce qu'on voit a travers. Lisible a toutes les echelles (pas d'attenuation
  // d'altitude), seule la cote l'eteint (vFade).
  // v45 : la tirette couvre une VRAIE plage — à fond, l'eau du large garde
  // ~25 % de teinte (le fond se lit clairement) au lieu du plancher 47 % qui
  // rendait la transparence indiscernable (retour Adrien)
  float wOp = mix(0.45, 0.95, pow(dRt, 0.55));
  wOp = clamp(wOp * mix(1.15, 0.26, uTransp), 0.05, 0.97);
  wOp = max(wOp, fres * 0.5);
  // sous ~0.35 de transparence : PEINTURE pleine (eau foncee comme avant)
  wOp = mix(1.0, wOp, lagoonW);
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  // v45 : la réfraction reste ACTIVE près des côtes (0.3 plancher) — c'est là
  // que le fond a du détail à tordre ; au large un fond uniforme ne montre
  // rien, l'ancien *vFade l'éteignait donc exactement où elle se voyait
  vec2 refOff = N.xz * uRefract * 0.09 * (0.3 + 0.7 * vFade);
  vec3 through = texture2D(uSceneTex, clamp(screenUv + refOff, vec2(0.001), vec2(0.999))).rgb;
  through += uSunColor * min(causNet * causMask, 1.2) * 0.6;
  through = mix(through, through * (1.0 - 0.35 * clamp(causMask, 0.0, 1.0)), (1.0 - clamp(causNet, 0.0, 1.0)) * 0.4);
  col = mix(through, col, wOp);
  // reflets de surface : jamais attenues par la transparence
  col = mix(col, uSky, fres * 0.35);
  col += uSunColor * spec * uSunFx * (0.35 + 0.85 * patchy);
  col = mix(col, vec3(0.96) * mix(0.14, 1.0, uDayLight), foam);
  float alpha = max(shoreAA, foam * 0.85);

  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}
`

// ---- jupe de verre (bord des socles) --------------------------------------
// Comble le vide entre le niveau de l'eau et le fond marin au bord du bloc :
// un ruban vertical sur le périmètre arrondi, du fond jusqu'à la SURFACE
// ANIMÉE (le haut du ruban suit les mêmes vagues Gerstner que la mer).
// Effet « verre poli » : la tirette Edge frost va du verre clair au dépoli.
const SKIRT_VERT = /* glsl */ `
uniform float uTime;
uniform float uWaveH;
uniform float uChop;
uniform float uSpeedMul;
uniform float uLenScale;
uniform float uLift;
uniform float uWaterY;
uniform float uBottomY;
uniform float uViewCalm;
uniform sampler2D uField;
${GERSTNER_GLSL}
${SHORE_SURF_GLSL}
varying vec3 vWorld;
varying float vV;
#include <fog_pars_vertex>

void main() {
  vec3 p = position; // xz = chemin du bord ; y = 0 (fond) / 1 (surface)
  vV = p.y;
  vec2 uvF = p.xz / ${TERRAIN_SIZE.toFixed(1)} + 0.5;
  vec2 f = texture2D(uField, uvF).rg;
  float shoreD = max((uWaterY - f.r) * 2.0, f.g);
  float fade = smoothstep(0.0, 0.10, shoreD); // v45 : même déclin serré que la surface
  float fadeLift = smoothstep(0.0, 0.55, shoreD);
  float y = uBottomY;
  if (p.y > 0.5) {
    vec3 nAcc;
    float crest;
    vec3 disp = oceanGerstner(p.xz, uTime, uWaveH * uViewCalm, uChop, uSpeedMul, uLenScale, fade, nAcc, crest);
    float crestS;
    vec3 surf = shoreSurf(uvF, uField, uTime, uWaveH, uChop, uSpeedMul, uLenScale, uViewCalm, crestS);
    y = uWaterY + disp.y + surf.x + uLift * fadeLift + 0.025; // leger recouvrement : jamais de jour entre jupe et surface
  }
  vWorld = vec3(p.x, y, p.z);
  vec4 mv = modelViewMatrix * vec4(vWorld, 1.0);
  gl_Position = projectionMatrix * mv;
  #ifdef USE_FOG
  vFogDepth = -mv.z;
  #endif
}
`

const SKIRT_FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallowT; // glacis d'eau claire (peu profond)
uniform vec3 uSky;
uniform float uFrost;
uniform float uDayLight;
uniform float uWaterY;
uniform float uBottomY;
uniform sampler2D uField;
varying vec3 vWorld;
varying float vV;
#include <fog_pars_fragment>

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  // pas de jupe devant la terre (côte qui touche le bord du bloc)
  vec2 uvF = vWorld.xz / ${TERRAIN_SIZE.toFixed(1)} + 0.5;
  float ground = texture2D(uField, uvF).r;
  if (uWaterY - ground < -0.005) discard;

  float g = clamp((uWaterY - vWorld.y) / max(uWaterY - uBottomY, 1e-3), 0.0, 1.0);
  vec3 col = uDeep * mix(1.05, 0.45, g); // s'assombrit vers le fond
  col *= mix(vec3(0.10, 0.16, 0.30), vec3(1.0), uDayLight);

  // verre poli → dépoli : grain + éclaircissement laiteux avec uFrost
  float grain = vnoise(vWorld.xz * 6.0 + vWorld.y * 4.0) * 0.5
              + vnoise(vWorld.xz * 17.0 - vWorld.y * 9.0) * 0.5;
  col = mix(col, col * 0.75 + uSky * 0.30 * (0.5 + 0.5 * grain), uFrost * 0.65);
  float alpha = mix(0.55, 0.94, uFrost);
  alpha *= 1.0 - 0.15 * (1.0 - uFrost) * grain;

  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}
`

// chemin du périmètre arrondi du bloc (mêmes demi-côté et rayon que le clip
// de la mer) → ruban vertical indexé, y = 0 (fond) / 1 (surface)
function buildRimGeometry(half, corner) {
  const r = Math.min(Math.max(corner, 0.02), half)
  const sSide = half - r
  const pts = []
  const STEP = 0.3 // ~ meme densite que la grille de la mer : pas de trous
  const side = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(2, Math.ceil(len / STEP))
    for (let i = 1; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n])
  }
  const arc = (cx, cz, a0, a1) => {
    const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) * r) / STEP))
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
    }
  }
  // parcours anti-horaire, arcs orientes correctement (le v40 tournait deux
  // coins a l'envers : le "pli" dans l'angle venait de la)
  pts.push([half, 0])
  side(half, 0, half, sSide)
  arc(sSide, sSide, 0, Math.PI / 2)
  side(sSide, half, -sSide, half)
  arc(-sSide, sSide, Math.PI / 2, Math.PI)
  side(-half, sSide, -half, -sSide)
  arc(-sSide, -sSide, Math.PI, 1.5 * Math.PI)
  side(-sSide, -half, sSide, -half)
  arc(sSide, -sSide, 1.5 * Math.PI, 2 * Math.PI)
  side(half, -sSide, half, -0.0001)
  const n = pts.length
  const positions = new Float32Array(n * 2 * 3)
  const indices = []
  for (let i = 0; i < n; i++) {
    positions.set([pts[i][0], 0, pts[i][1]], i * 6)
    positions.set([pts[i][0], 1, pts[i][1]], i * 6 + 3)
    const j = (i + 1) % n
    indices.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(indices)
  return geo
}

// shallow leans hard into saturated lagoon turquoise and deep into navy —
// pale derivations disappeared entirely on light templates. Lerp weights
// were tuned live in the v37 visual loop (waterloop-10: coastal turquoise,
// dark open water, both surviving the templates' desaturation grade).
// The mix happens in sRGB: THREE stores colors in Linear-sRGB, where even
// 10% of a light base adds so much luminance that the "deep" navy came out
// two stops too bright and the whole sea rendered white-pastel.
function srgbMix(a, b, t) {
  const ca = new THREE.Color(a).convertLinearToSRGB()
  const cb = new THREE.Color(b).convertLinearToSRGB()
  return ca.lerp(cb, t).convertSRGBToLinear()
}
function waterColors(params) {
  const base = params.lakeColor ?? '#8fc6e8'
  return {
    // v41 : le glacis clair est de retour, mais pilote par la profondeur
    // REELLE dans le shader (le halo v37 venait du proxy distance-au-rivage)
    shallowT: srgbMix(base, '#7fe0d8', 0.45),
    deep: srgbMix(base, '#0b3556', 0.9),
  }
}

function waterMaterial({ isLake, params, fieldTex }) {
  const { shallowT, deep } = waterColors(params)
  const look = chopLook(params.seaChop ?? 0.7)
  const mat = new THREE.ShaderMaterial({
    name: isLake ? 'real-water-lake' : 'real-water-sea',
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
    defines: isLake ? { IS_LAKE: 1 } : {},
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        // spectrum arrays are assigned AFTER creation (same clone rule as the
        // textures below) by RealWater._applySea()
        uWaveA: { value: [] },
        uWaveB: { value: [] },
        uWaveH: { value: params.seaWaveH ?? 0.8 },
        uChop: { value: params.seaChop ?? 0.7 },
        uSpeedMul: { value: (params.seaSpeed ?? 1) * 0.4 },
        uLenScale: { value: LEN_SCALE },
        uLift: { value: 0 },
        uWaterY: { value: 0 },
        // textures are assigned AFTER creation: UniformsUtils.merge CLONES any
        // texture it finds, and the clone is what lands on the GPU — dispose()
        // on the original then never frees it (v37 review finding)
        uField: { value: null },
        uMask: { value: null },
        uMaskMin: { value: new THREE.Vector2() },
        uMaskSize: { value: new THREE.Vector2(1, 1) },
        uLakeDepth: { value: 1.15 },
        uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uSunColor: { value: new THREE.Color('#fff3d6') },
        uDeep: { value: deep },
        uShallowT: { value: shallowT },
        uSeabedCaustics: { value: 0 },
        uViewCalm: { value: 1 },
        uFoamScale: { value: 1 },
        uSceneTex: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uRefract: { value: params.seaRefract ?? 0.6 },
        uSky: { value: new THREE.Color('#cfe3f2') },
        uDepthMax: { value: 2.2 },
        uGloss: { value: look.gloss },
        uDetail: { value: look.detail },
        uFoam: { value: look.foam },
        uCaustics: { value: 2.4 },
        uDayLight: { value: 1 },
        uTransp: { value: params.waterTransparency ?? 0.4 },
        uSunFx: { value: params.waterSunFx ?? 1 },
        uHalf: { value: TERRAIN_SIZE / 2 },
        uCornerR: { value: 0.5 },
      },
    ]),
  })
  mat.uniforms.uField.value = fieldTex // post-merge assignment — no clone, dispose() works
  return mat
}

export class RealWater {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'real-water'
    scene.add(this.group)
    this.meshes = []
    this.materials = []
    this._textures = []
    this._time = 0
    this._surfaceVisible = true
  }

  // Bake the slab-wide height + shore-distance field from the live sampler.
  _bakeField(terrain, seaY) {
    const n = FIELD_RES
    const data = new Float32Array(n * n * 2)
    const water = new Uint8Array(n * n)
    for (let j = 0; j < n; j++) {
      const z = (j / (n - 1) - 0.5) * TERRAIN_SIZE
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * TERRAIN_SIZE
        const h = terrain.sample ? terrain.sample(x, z) : 0
        data[(j * n + i) * 2] = h
        water[j * n + i] = h < seaY ? 1 : 0
      }
    }
    // two-pass chamfer distance to the nearest land cell, in world units
    const cell = TERRAIN_SIZE / (n - 1)
    const INF = 1e9
    const dist = new Float32Array(n * n)
    for (let k = 0; k < n * n; k++) dist[k] = water[k] ? INF : 0
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + cell)
        if (j > 0) dist[k] = Math.min(dist[k], dist[k - n] + cell)
        if (i > 0 && j > 0) dist[k] = Math.min(dist[k], dist[k - n - 1] + cell * 1.414)
      }
    for (let j = n - 1; j >= 0; j--)
      for (let i = n - 1; i >= 0; i--) {
        const k = j * n + i
        if (i < n - 1) dist[k] = Math.min(dist[k], dist[k + 1] + cell)
        if (j < n - 1) dist[k] = Math.min(dist[k], dist[k + n] + cell)
        if (i < n - 1 && j < n - 1) dist[k] = Math.min(dist[k], dist[k + n + 1] + cell * 1.414)
      }
    for (let k = 0; k < n * n; k++) data[k * 2 + 1] = Math.min(1, dist[k] / 15) // v41: declin cotier x6 (Adrien) - le halo peint qui interdisait un grand rayon a disparu avec les hauts-fonds
    // half float: linear filtering is core WebGL2 (full float linear is an
    // optional extension); the ±20-unit height range fits half precision fine
    const half = new Uint16Array(n * n * 2)
    for (let k = 0; k < half.length; k++) half[k] = THREE.DataUtils.toHalfFloat(data[k])
    const tex = new THREE.DataTexture(half, n, n, THREE.RGFormat, THREE.HalfFloatType)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }

  // Per-lake coverage (A) + shore-distance (G) mask over its dem bbox.
  _bakeLakeMask(lake) {
    const { cells, size } = lake
    let minX = size, maxX = 0, minY = size, maxY = 0
    for (const c of cells) {
      const x = c % size
      const y = (c / size) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const pad = 2
    minX = Math.max(0, minX - pad); maxX = Math.min(size - 1, maxX + pad)
    minY = Math.max(0, minY - pad); maxY = Math.min(size - 1, maxY + pad)
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const inside = new Uint8Array(w * h)
    for (const c of cells) {
      const x = c % size - minX
      const y = ((c / size) | 0) - minY
      inside[y * w + x] = 1
    }
    // chamfer distance to shore (in cells), normalised by the lake half-width
    const INF = 1e9
    const dist = new Float32Array(w * h)
    for (let k = 0; k < w * h; k++) dist[k] = inside[k] ? INF : 0
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i
        if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + 1)
        if (j > 0) dist[k] = Math.min(dist[k], dist[k - w] + 1)
      }
    for (let j = h - 1; j >= 0; j--)
      for (let i = w - 1; i >= 0; i--) {
        const k = j * w + i
        if (i < w - 1) dist[k] = Math.min(dist[k], dist[k + 1] + 1)
        if (j < h - 1) dist[k] = Math.min(dist[k], dist[k + w] + 1)
      }
    let maxD = 1
    for (let k = 0; k < w * h; k++) if (inside[k] && dist[k] < INF && dist[k] > maxD) maxD = dist[k]
    // one 3x3 box blur on the distance channel: at high uLakeDepth the raw
    // per-cell values band into visible pixel steps on big lakes
    const smooth = new Float32Array(w * h)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let sum = 0
        let n = 0
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const jj = j + dj
            const ii = i + di
            if (jj < 0 || jj >= h || ii < 0 || ii >= w) continue
            sum += dist[jj * w + ii]
            n++
          }
        smooth[j * w + i] = sum / n
      }
    const data = new Uint8Array(w * h * 4)
    for (let k = 0; k < w * h; k++) {
      data[k * 4 + 1] = Math.round(255 * Math.min(1, smooth[k] / maxD)) // G shore distance
      data[k * 4 + 3] = inside[k] ? 255 : 0 // A coverage
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return { tex, minX, minY, w, h }
  }

  _clear() {
    this._refractRT?.dispose()
    this._refractRT = null
    for (const m of this.meshes) {
      m.geometry.dispose()
      this.group.remove(m)
    }
    for (const mat of this.materials) mat.dispose()
    for (const t of this._textures) t.dispose()
    this.meshes = []
    this.materials = []
    this._textures = []
    this._seaMesh = null
  }

  // (Re)build for the current zone. Cheap no-op when the option is off.
  rebuild({ terrain, params }) {
    this._clear()
    if (!params.waterReal || params.source !== 'real' || !terrain.dem) return

    const seaY = terrain.mapUniforms.uSeaY.value
    const fieldTex = this._bakeField(terrain, seaY > -9000 ? seaY : -1e9)
    this._textures.push(fieldTex)

    const demScale = (TERRAIN_SIZE / terrain.dem.extentMeters) * params.demExaggeration
    // wave amplitude follows the VIEW SCALE: at a 20 km bay the swell reads,
    // at a 500 km continental view the same scene-unit swell would be a
    // 30 m monster — the sea (and the lakes) calm as you zoom out
    this._waveScale = Math.min(1, Math.max(0.15, demScale / 0.008))
    this._demScale = demScale // pour setView : unites scene -> metres reels
    this._waveH = params.seaWaveH ?? 0.5

    // random sea state (shared ocean-waves spectrum) — a saved seed replays
    // the exact same sea (share-links), 0/undefined draws a fresh one
    this._sea = makeSeaState(params.seaSeed || undefined)

    // --- open sea (skip in region mode: the plate replaces the ocean there)
    if (seaY > -9000 && !params.regionMode) {
      // the surface rides ~2 m above the coastline plus the CURRENT swell
      // amplitude, so a trough can never dip through the flat marine plain
      // (the v37 "fresnel continents" were mostly this poke-through) — yet
      // the lift stays metres in real terms: a fixed scene-unit lift flooded
      // tens of metres of lowland at continental zooms (Baltic screenshot)
      // v39: la surface repose AU NIVEAU ZERO (la mer ne depasse jamais le
      // trait de cote) ; le niveau moyen remonte au large via uLift * fade
      // dans le vertex — il meurt exactement a zero a la ligne de cote.
      this._seaBase = seaY + Math.max(2 * demScale, 0.003)
      const mat = waterMaterial({ isLake: false, params, fieldTex })
      mat.uniforms.uWaterY.value = this._seaBase
      // plancher d'echelle : sous ~0.55 la mer du vent passe sous la maille
      // de la grille et le croisement disparait (une seule ligne de vagues)
      const lenSea = LEN_SCALE * Math.min(1, Math.max(0.55, this._waveScale))
      mat.uniforms.uLenScale.value = lenSea
      mat.uniforms.uLift.value = SPEC_AMP_SUM * lenSea * this._waveH
      mat.uniforms.uFoamScale.value = smooth01((this._waveScale - 0.12) / 0.2) // le bruit vit en espace spectre : seul l'extreme zoom continental coupe l'ecume
      // depth budget: with real bathymetry the ramp can span a deep column;
      // fine-zoom tiles have none (flat 0 m sea) — there depth is the capped
      // shore-distance proxy, and a 2.2 budget means nothing ever reads deep.
      // The test lives in SCENE units: -68 m of DEM bathy at z11 is only
      // ~0.014 scene units — metres said "deep column", the render said no.
      const bathyScene = (0 - terrain.dem.minM) * demScale
      mat.uniforms.uDepthMax.value = bathyScene > 1.0 ? 2.2 : 0.75
      const r = Math.min(TERRAIN_SIZE / 2 - 0.05, Math.max(0.05, (params.slabCorner ?? 0) * TERRAIN_SIZE))
      mat.uniforms.uHalf.value = (TERRAIN_SIZE / 2) * 0.998
      mat.uniforms.uCornerR.value = r
      const seg = 256
      const geo = new THREE.PlaneGeometry(TERRAIN_SIZE * 0.998, TERRAIN_SIZE * 0.998, seg, seg)
      geo.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(0, this._seaBase, 0)
      // above the draped OSM water polygons (17) so harbours read UNDER the
      // animated surface (through its transparency), below GPX markers (21+)
      mesh.renderOrder = 18
      mesh.frustumCulled = false // vertex waves move it; the slab is always on screen anyway
      this.group.add(mesh)
      this.meshes.push(mesh)
      this.materials.push(mat)
      this._seaMesh = mesh
      // grab pass : copie ce qui est deja rendu (terrain + fond peint) dans
      // une texture que le shader echantillonne avec le decalage de Snell
      mesh.onBeforeRender = (renderer) => {
        const size = renderer.getDrawingBufferSize(_v2)
        if (!this._refractRT || this._refractRT.image.width !== size.x || this._refractRT.image.height !== size.y) {
          this._refractRT?.dispose()
          this._refractRT = new THREE.FramebufferTexture(size.x, size.y)
          // le composer rend en HalfFloat : la copie exige le MÊME type de
          // stockage. RGBA8 depuis RGBA16F = INVALID_OPERATION silencieuse →
          // texture NOIRE : c'était la cause de la transparence morte, de la
          // réfraction inerte et des reflets ternes après l'upgrade rendu.
          this._refractRT.type = THREE.HalfFloatType
          for (const m2 of this.materials) {
            if (m2.uniforms.uSceneTex) {
              m2.uniforms.uSceneTex.value = this._refractRT
              m2.uniforms.uResolution.value.set(size.x, size.y)
            }
          }
        }
        renderer.copyFramebufferToTexture(this._refractRT)
      }

      // jupe de verre au bord du socle : comble le vide entre le niveau de
      // l'eau et le fond marin sur le pourtour du bloc (option seaEdge)
      if (params.seaEdge ?? true) {
        const drop = Math.max(2.0, bathyScene + 0.6)
        const smat = new THREE.ShaderMaterial({
          name: 'real-water-skirt',
          vertexShader: SKIRT_VERT,
          fragmentShader: SKIRT_FRAG,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: true,
          uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
              uTime: { value: 0 },
              uWaveA: { value: [] },
              uWaveB: { value: [] },
              uWaveH: { value: params.seaWaveH ?? 0.8 },
              uChop: { value: params.seaChop ?? 0.7 },
              uSpeedMul: { value: (params.seaSpeed ?? 1) * 0.4 },
              uLenScale: { value: lenSea },
              uLift: { value: SPEC_AMP_SUM * lenSea * this._waveH },
              uWaterY: { value: this._seaBase },
              uBottomY: { value: this._seaBase - drop },
              uField: { value: null },
              uDeep: { value: waterColors(params).deep },
              uSky: { value: new THREE.Color('#cfe3f2') },
              uFrost: { value: params.seaEdgeFrost ?? 0.5 },
              uDayLight: { value: 1 },
              uViewCalm: { value: 1 },
            },
          ]),
        })
        smat.uniforms.uField.value = fieldTex // post-merge (règle du clone)
        const sgeo = buildRimGeometry((TERRAIN_SIZE / 2) * 0.998 - 0.02, r)
        const skirt = new THREE.Mesh(sgeo, smat)
        skirt.renderOrder = 16 // sous la surface (18) : la mer se dessine par-dessus
        skirt.frustumCulled = false
        this.group.add(skirt)
        this.meshes.push(skirt)
        this.materials.push(smat)
      }
    }

    // --- altitude lakes
    const dem = terrain.dem
    const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
    const cellM = dem.extentMeters / (dem.size - 1)
    for (const lake of detectLakes(dem)) {
      const { tex, minX, minY, w, h } = this._bakeLakeMask(lake)
      // couche maritime réservée aux VRAIS lacs : longueur >= 3 km (demande
      // Adrien v40 — detectLakes prenait des zones plates urbaines pour des
      // plans d'eau, cf. les taches bleues d'Annecy)
      if (Math.max(w, h) * cellM < 3000) { tex.dispose(); continue }
      this._textures.push(tex)
      const yLake = (lake.elevM - dem.meanM) * scale + 0.04 + (params.detail ?? 0) * 0.6 + 0.025
      const toWorld = (g, n) => (g / (n - 1) - 0.5) * TERRAIN_SIZE
      const size = lake.size
      const x0 = toWorld(minX, size)
      const z0 = toWorld(minY, size)
      const x1 = toWorld(minX + w - 1, size)
      const z1 = toWorld(minY + h - 1, size)
      const mat = waterMaterial({ isLake: true, params, fieldTex })
      mat.uniforms.uWaterY.value = yLake
      const lenLake = LEN_SCALE * Math.min(1, Math.max(0.55, this._waveScale)) * 0.5
      mat.uniforms.uLenScale.value = lenLake
      mat.uniforms.uLift.value = SPEC_AMP_SUM * lenLake * this._waveH
      mat.uniforms.uFoamScale.value = smooth01((this._waveScale - 0.12) / 0.2) // le bruit vit en espace spectre : seul l'extreme zoom continental coupe l'ecume
      mat.uniforms.uMask.value = tex
      mat.uniforms.uMaskMin.value.set(x0, z0)
      mat.uniforms.uMaskSize.value.set(Math.max(1e-4, x1 - x0), Math.max(1e-4, z1 - z0))
      mat.uniforms.uDepthMax.value = 0.9
      const segX = Math.max(12, Math.min(80, Math.round((x1 - x0) * 6)))
      const segZ = Math.max(12, Math.min(80, Math.round((z1 - z0) * 6)))
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ)
      geo.rotateX(-Math.PI / 2)
      geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.y = yLake
      mesh.renderOrder = 18 // same rule as the sea: over the draped OSM water
      mesh.frustumCulled = false
      this.group.add(mesh)
      this.meshes.push(mesh)
      this.materials.push(mat)
    }
    this._applySea()
    this.setSeabed(params.seaBed ?? 'map')
    this.group.visible = this._surfaceVisible
  }

  // push the current spectrum into every material (arrays are assigned
  // post-creation: UniformsUtils.merge would clone them at build time)
  _applySea() {
    if (this._sea) {
      const u = seaStateToUniforms(this._sea)
      for (const mat of this.materials) {
        mat.uniforms.uWaveA.value = u.a
        mat.uniforms.uWaveB.value = u.b
      }
    }
    if (this._sunState) this.setSunState(this._sunState)
  }

  // day/night state from the shared sunLook palette (applyTimeOfDay pushes it)
  setSunState(s) {
    this._sunState = s
    for (const mat of this.materials) {
      mat.uniforms.uDayLight.value = s.dayLight ?? 1
      if (s.skyHex && mat.uniforms.uSky) mat.uniforms.uSky.value.set(s.skyHex)
    }
  }

  // live look change — colour, transparency and sun sliders, no rebuild needed
  setLook(params) {
    const { shallowT, deep } = waterColors(params)
    for (const mat of this.materials) {
      mat.uniforms.uDeep.value.copy(deep)
      if (mat.uniforms.uShallowT) mat.uniforms.uShallowT.value.copy(shallowT)
      if (mat.uniforms.uTransp) mat.uniforms.uTransp.value = params.waterTransparency ?? 0.4
      if (mat.uniforms.uSunFx) mat.uniforms.uSunFx.value = params.waterSunFx ?? 1
      if (mat.uniforms.uFrost) mat.uniforms.uFrost.value = params.seaEdgeFrost ?? 0.5
      if (mat.uniforms.uRefract) mat.uniforms.uRefract.value = params.seaRefract ?? 0.6
    }
  }


  // live wave change (UI sliders) — no rebuild needed. La hauteur ne déplace
  // plus le maillage : le niveau moyen est porté par uLift * fade dans le
  // vertex (zéro à la côte, quelle que soit la hauteur des vagues).
  setWaves({ height, choppiness, speed } = {}) {
    for (const mat of this.materials) {
      if (height !== undefined) {
        mat.uniforms.uWaveH.value = height
        mat.uniforms.uLift.value = SPEC_AMP_SUM * mat.uniforms.uLenScale.value * height
      }
      if (choppiness !== undefined) {
        mat.uniforms.uChop.value = choppiness
        const l = chopLook(choppiness)
        if (mat.uniforms.uDetail) {
          mat.uniforms.uDetail.value = l.detail
          mat.uniforms.uFoam.value = l.foam
          mat.uniforms.uGloss.value = l.gloss
        }
      }
      if (speed !== undefined) mat.uniforms.uSpeedMul.value = speed * 0.4
    }
    if (height !== undefined) this._waveH = height
  }

  // fond marin (vignettes Seabed) — 'map' = la carte se lit à travers
  // le fond lui-meme est peint par le TERRAIN (rampe ocean pilotee par l'UI) ;
  // ici on ne regle que les caustiques du preset
  setSeabed(id) {
    const preset = SEABEDS.find((s) => s.id === id) ?? SEABEDS[0]
    this._seabedId = preset.id
    for (const mat of this.materials) {
      if (mat.uniforms.uSeabedCaustics) mat.uniforms.uSeabedCaustics.value = preset.caustics ?? 0
    }
  }

  // replay a given sea state (share-links) / draw a brand-new random one
  setSeed(seed) {
    this._sea = makeSeaState(seed)
    this._applySea()
    return this._sea.seed
  }

  reseed() {
    return this.setSeed((Math.random() * 2 ** 31) | 0)
  }

  // accalmie selon l'altitude REELLE de la camera : pleine mer sous 8 km,
  // plate au-dela de 25 km (la mer/l'ecume envahissaient les vues continentales)
  setView(cameraY) {
    if (!this._demScale) return
    const km = Math.max(0, (cameraY - (this._seaBase ?? 0)) / this._demScale / 1000)
    const calm = smooth01((25 - km) / 17)
    for (const mat of this.materials) {
      if (mat.uniforms.uViewCalm) mat.uniforms.uViewCalm.value = 0.08 + 0.92 * calm
    }
  }

  update(dt, sun) {
    if (!this.meshes.length) return
    this._time += dt
    const dir = sun ? sun.position.clone().normalize() : null
    for (const mat of this.materials) {
      mat.uniforms.uTime.value = this._time
      if (dir && mat.uniforms.uSunDir) mat.uniforms.uSunDir.value.copy(dir)
      if (sun && mat.uniforms.uSunColor) mat.uniforms.uSunColor.value.copy(sun.color)
    }
  }

  setVisible(v) {
    this._surfaceVisible = v
    this.group.visible = v && this.meshes.length > 0
  }

  dispose() {
    this._clear()
  }
}
