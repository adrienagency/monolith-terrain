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
import { runLakeJob } from './terrain-jobs.js'
import { lacsMemoLire, lacsMemoEcrire } from './dem-memo.js'
import { plansEauRetenus } from './plan-eau.js'
// LE CHAMP SUIT LE RELIEF — règles pures et testées, voir src/mer-emprise.js
// pour la mesure d'avant/après et le pourquoi de chaque choix.
import { resChamp, spanChamp } from './mer-emprise.js'
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

// remous de côte : leur taille apparente devient grossière quand on s'éloigne
// (la bande de ressac occupe alors quelques pixels et « escalier »). On fond
// leur amplitude avec la DISTANCE D'AFFICHAGE (rayon d'orbite caméra, unités
// scène) : pleins sous SURF_NEAR, quasi plats au-delà de SURF_FAR. (retour Adrien)
const SURF_NEAR = 26
const SURF_FAR = 64

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
  // v46 : caustiques aussi sur 'map' (discrètes) — l'effet existe par défaut
  { id: 'map', name: 'Map', floor: null, caustics: 0.7 },
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
uniform float uSurfCalm; // 1 en vue rapprochee -> ~0 en vue large : efface les
                         // remous de cote grossiers quand on s'eloigne
${GERSTNER_GLSL}
${SHORE_SURF_GLSL}
uniform sampler2D uField;   // R ground Y, G shore distance (slab-wide)
uniform sampler2D uCoastMask; // OSM land/sea (R : 1 land, 0 sea) — the REAL shore
uniform float uCoastMaskOn;   // 1 when the coast mask is loaded for this patch
uniform float uSpan;    // largeur au sol du champ : 56, ou 168 sur l'emprise 3×3
uniform vec2 uFenetre;  // décalage de lecture du mode continu (0 sinon)
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

  // ══════════ DEUX ESPACES, ET IL FAUT LES DEUX ══════════════════════════════
  // xzChamp : où l'on est DANS LE MONDE — c'est là qu'on lit le fond, la
  //           distance au rivage et le masque côtier. Ça DÉFILE.
  // xzVue   : où l'on est SUR LE SOCLE — c'est là que vivent le clip, le bord
  //           et la soudure avec la jupe. Ça NE DÉFILE PAS.
  // La mer et sa jupe sont taillées sur le socle : elles ajoutent la fenêtre.
  // Un lac est taillé sur son emprise géographique et son groupe porte déjà la
  // translation −fenêtre : il lit son champ SANS décalage (mer-emprise.js).
#ifdef IS_LAKE
  vec2 xzChamp = xz;
  vec2 xzVue = xz - uFenetre;
#else
  vec2 xzChamp = xz + uFenetre;
  vec2 xzVue = xz;
#endif

  // waves die out on the beach: fade by the local depth so a swell can never
  // wash over the coastline polygons
  vec2 uvF = xzChamp / uSpan + 0.5;
  vec2 f = texture2D(uField, uvF).rg;
#ifdef IS_LAKE
  vec2 m = (xz - uMaskMin) / uMaskSize;
  float shoreD = texture2D(uMask, m).g;
#else
  float shoreD = max((uWaterY - f.r) * 2.0, f.g);
  // masque côtier : sur la vraie terre (polders sous 0 compris) houle, ressac
  // et lift meurent — le fragment y discarde le plan, laisser des vagues au
  // bord dessinerait des artefacts de silhouette le long du trait de côte
  if (uCoastMaskOn > 0.5) shoreD *= 1.0 - texture2D(uCoastMask, uvF).r;
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
  disp.y += surf.x * uSurfCalm;
  nAcc.x += surf.y * uSurfCalm;
  nAcc.z += surf.z * uSurfCalm;
  crest = max(crest, crestS * uSurfCalm);
#ifndef IS_LAKE
  // ---- CRITÈRE DE DÉFERLEMENT : une vague ne dépasse pas sa profondeur ------
  // Sans relèvement du niveau moyen, plus rien n'empêchait un creux de traverser
  // le fond dans la frange côtière — et il le traversait : le fondu de côte
  // atteint 1 dès ~2 m de profondeur, alors que l'amplitude sommée vaut des
  // dizaines de mètres. (Aucun accent grave dans ces commentaires : ils vivent
  // dans un template literal JS, un backtick y termine le module.)
  // Le relief sous-marin ressortait alors entre les vagues, en peignes et en
  // lames (captures Adrien à Ibiza et Toulon).
  //
  // Le relèvement n'était qu'un pansement. La règle physique, elle, est connue :
  // une houle qui entre par petits fonds gonfle puis DÉFERLE, sa hauteur étant
  // bornée à ~0,78 fois la profondeur. On applique donc cette borne — la mer
  // reste à son vrai niveau, et les vagues s'apaisent en approchant du rivage
  // au lieu de le percer.
  //
  // Limite DOUCE (pas un clamp) : cap·(1−e^(−|d|/cap)) vaut |d| en eau profonde
  // et tend vers cap en eau basse, sans créer de crêtes rabotées à plat.
  float prof = max(uWaterY - f.r, 0.0);
  float cap = 0.78 * prof;
  float amp = abs(disp.y);
  disp.y = sign(disp.y) * cap * (1.0 - exp(-amp / max(cap, 1e-5)));
#endif
  // ⚠️ EN COORDONNÉES DE VUE : ce fondu existe pour souder la surface à la jupe
  // au BORD DU SOCLE. Mesuré en coordonnées de champ, un lac de l'emprise voyait
  // son déplacement horizontal annulé partout (il est à plus de 28 unités du
  // centre du champ) — ses vagues perdaient leur choppiness sans raison.
  float edgeHold = 1.0 - smoothstep(uHalf - 2.0, uHalf - 0.15, max(abs(xzVue.x), abs(xzVue.y)));
  p.xz += disp.xz * edgeHold;
  // NIVEAU MOYEN : PLUS AUCUN RELÈVEMENT EN MER (décision d'Adrien).
  //
  // Le niveau moyen était remonté au large de toute l'amplitude sommée, pour
  // que les creux ne percent jamais le fond. Cette précaution datait d'un temps
  // où le fond marin était une PLAINE PLATE au niveau zéro : les tuiles
  // terrarium n'ont aucune bathymétrie aux zooms fins (mesuré : 100 % de zéros
  // au large de Toulon à z12). Depuis la fusion GEBCO le fond est réellement à
  // −400 ou −4 800 m, et le relèvement ne faisait plus que gonfler la mer.
  //
  // La houle oscille donc maintenant AUTOUR du vrai niveau : les crêtes montent,
  // et les creux CREUSENT le bloc d'eau au lieu de le soulever.
  //
  // Le rivage reste protégé sans rien de spécial : fade (smoothstep 0 à 0,10
  // sur la distance à la côte) éteint déjà l'amplitude AVANT le trait d'eau,
  // donc il n'y a pas de creux là où le fond affleure.
  // (Pas d'accent grave ici : ce commentaire vit dans un template literal JS,
  // un backtick le terminerait et casserait le module.)
  //
  // Les LACS gardent leur garde : ils sont peu profonds par nature, et leur fond
  // ne vient pas de la bathymétrie marine.
#ifdef IS_LAKE
  p.y += disp.y + uLift * fadeLift;
#else
  p.y += disp.y;
#endif
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
uniform float uSurfCalm;       // 1 de près -> ~0 de loin : atténue l'écume de côte
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
uniform sampler2D uCoastMask; // trait de côte vectoriel (R : 1 terre, 0 mer) — la vérité terre/mer
uniform float uCoastMaskOn;   // 1 quand le masque du patch est chargé (sinon : règle altitude seule)
uniform float uSpan;    // largeur au sol du champ : 56, ou 168 sur l'emprise 3×3
uniform vec2 uFenetre;  // décalage de lecture du mode continu (0 sinon)
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
  // les deux espaces, comme dans le vertex — voir son commentaire
#ifdef IS_LAKE
  vec2 xzChamp = xz;
  vec2 xzVue = xz - uFenetre;
#else
  vec2 xzChamp = xz + uFenetre;
  vec2 xzVue = xz;
#endif

  // stay inside the slab's rounded footprint
  // ⚠️ LES LACS AUSSI, DEPUIS L'EMPRISE 3×3 : ils sont détectés sur les 168
  // unités du champ, donc huit lacs sur neuf tombent HORS de la fenêtre et
  // flotteraient au-dessus du vide, à côté du socle. Hors mode continu leur
  // uHalf reste a 1e6 et ce test ne peut pas se declencher : le comportement
  // d'avant est rendu au caractere pres. (Pas d'accent grave ici : ce
  // commentaire vit dans un template literal JS, il terminerait le module.)
  vec2 q = abs(xzVue) - vec2(uHalf - uCornerR);
  float sd = length(max(q, 0.0)) - uCornerR;
  if (sd > 0.0) discard;

  vec2 uvF = xzChamp / uSpan + 0.5;
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
  // masque côtier vectoriel : la TERRE ne porte JAMAIS la mer animée, même
  // sous le niveau 0 (polders NL, Camargue, Caspienne — la règle altitude
  // seule les inondait). Gros de la terre : discard (perf, pas d'overdraw) ;
  // bord (masque blurré 1.5px) : fondu d'alpha autour de 0.5 (voir plus bas).
  // CONTRAT : masque absent (uCoastMaskOn = 0) → comportement inchangé.
  float coastLand = 0.0;
  if (uCoastMaskOn > 0.5) {
    coastLand = texture2D(uCoastMask, uvF).r;
    if (coastLand > 0.8) discard;
  }
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
  float shoreFoam = shoreW * smoothstep(0.22, 0.55, foamNoise * 0.6 + bands * 0.4) * (0.5 + 0.5 * uFoamScale) * uViewCalm * uSurfCalm;
  // liseré de ressac : blanc franc au contact exact, bord cassé par le bruit
  float swash = (1.0 - smoothstep(0.0, 0.02, vFade)) * smoothstep(0.25, 0.6, foamNoise + 0.2) * uViewCalm * uSurfCalm;
  float foam = clamp(crestFoam + shoreFoam * 1.8 + swash * 1.1, 0.0, 1.0);
#ifndef IS_LAKE
  // anti-aliasing du trait de côte : le masque est déjà blurré 1.5px, on fond
  // l'eau (couleur ET écume) autour de l'iso 0.5 au lieu d'un bord crénelé
  foam *= 1.0 - smoothstep(0.35, 0.65, coastLand);
#endif

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
  col = mix(through, col, wOp);
  // reflets de surface : jamais attenues par la transparence
  col = mix(col, uSky, fres * 0.35);
  col += uSunColor * spec * uSunFx * (0.35 + 0.85 * patchy);
  col = mix(col, vec3(0.96) * mix(0.14, 1.0, uDayLight), foam);
  float alpha = max(shoreAA, foam * 0.85);
#ifndef IS_LAKE
  alpha *= 1.0 - smoothstep(0.35, 0.65, coastLand); // la lame d'eau meurt en douceur sur la terre du masque
#endif

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
uniform float uSurfCalm;
uniform sampler2D uField;
uniform sampler2D uCoastMask; // même masque côtier que la surface (R : 1 terre)
uniform float uCoastMaskOn;
uniform float uSpan;    // largeur au sol du champ : 56, ou 168 sur l'emprise 3×3
uniform vec2 uFenetre;  // décalage de lecture du mode continu (0 sinon)
${GERSTNER_GLSL}
${SHORE_SURF_GLSL}
varying vec3 vWorld;
varying float vV;
#include <fog_pars_vertex>

void main() {
  vec3 p = position; // xz = chemin du bord ; y = 0 (fond) / 1 (surface)
  vV = p.y;
  // ══════════ LA JUPE EST TAILLÉE SUR LE SOCLE, ELLE LIT LE MONDE ════════════
  // Le ruban ne bouge pas — c'est le pourtour du bloc. Mais ce qu'il a SOUS lui
  // défile : le fond marin, la distance au rivage, la terre du masque côtier.
  // Il ajoute donc la fenêtre, EXACTEMENT comme la surface de mer — et c'est
  // cette égalité, pas un réglage, qui garantit que les deux restent soudées.
  // Un demi-pixel d'écart entre ces deux expressions ouvrirait un jour de
  // lumière sur tout le périmètre du bloc.
  vec2 uvF = (p.xz + uFenetre) / uSpan + 0.5;
  vec2 f = texture2D(uField, uvF).rg;
  float shoreD = max((uWaterY - f.r) * 2.0, f.g);
  // même règle que la surface : les vagues du haut de jupe meurent sur la
  // terre du masque (le fragment discarde ces colonnes, pas de houle au bord)
  if (uCoastMaskOn > 0.5) shoreD *= 1.0 - texture2D(uCoastMask, uvF).r;
  float fade = smoothstep(0.0, 0.10, shoreD); // v45 : même déclin serré que la surface
  float fadeLift = smoothstep(0.0, 0.55, shoreD);
  float y = uBottomY;
  if (p.y > 0.5) {
    vec3 nAcc;
    float crest;
    vec3 disp = oceanGerstner(p.xz, uTime, uWaveH * uViewCalm, uChop, uSpeedMul, uLenScale, fade, nAcc, crest);
    float crestS;
    vec3 surf = shoreSurf(uvF, uField, uTime, uWaveH, uChop, uSpeedMul, uLenScale, uViewCalm, crestS);
    // MÊME niveau que la surface, DÉFERLEMENT COMPRIS. Aucun relèvement, et la
    // hauteur bornée par la profondeur exactement comme au-dessus : si les deux
    // divergeaient d'un millimètre, un jour s'ouvrirait entre la jupe de verre
    // et la mer sur tout le périmètre du bloc.
    float dy = disp.y + surf.x * uSurfCalm;
    float prof = max(uWaterY - f.r, 0.0);
    float cap = 0.78 * prof;
    dy = sign(dy) * cap * (1.0 - exp(-abs(dy) / max(cap, 1e-5)));
    y = uWaterY + dy + 0.025; // leger recouvrement
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
uniform sampler2D uCoastMask; // même masque côtier que la surface (R : 1 terre)
uniform float uCoastMaskOn;
uniform float uSpan;    // largeur au sol du champ : 56, ou 168 sur l'emprise 3×3
uniform vec2 uFenetre;  // décalage de lecture du mode continu (0 sinon)
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
  // MÊME expression que le vertex de la jupe et que la surface : c'est ce qui
  // fait qu'en défilant, le rideau d'eau s'efface pile où la côte arrive au bord.
  vec2 uvF = (vWorld.xz + uFenetre) / uSpan + 0.5;
  float ground = texture2D(uField, uvF).r;
  if (uWaterY - ground < -0.005) discard;
  // masque côtier : pas de rideau d'eau devant un polder sous le niveau 0 —
  // la règle altitude ci-dessus ne sait pas qu'il est terre (contrat : masque
  // absent → comportement inchangé)
  if (uCoastMaskOn > 0.5 && texture2D(uCoastMask, uvF).r > 0.5) discard;

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
        uCoastMask: { value: null },
        uCoastMaskOn: { value: 0 },
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
        uSurfCalm: { value: 1 },
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
        // ⚠️ UN LAC N'EST PAS CLIPPÉ AU SOCLE HORS MODE CONTINU. 1e6 rend le
        // test d'empreinte du fragment structurellement inatteignable : c'est le
        // comportement d'avant, où le clip vivait dans un `#ifndef IS_LAKE`.
        // `rebuild` redescend cette valeur à 28 quand l'emprise 3×3 est montée,
        // parce qu'alors huit lacs sur neuf tombent hors de la fenêtre.
        uHalf: { value: isLake ? 1e6 : TERRAIN_SIZE / 2 },
        uCornerR: { value: 0.5 },
        // le champ couvre le socle (56) ou l'emprise 3×3 (168) ; uFenetre est le
        // décalage de lecture du mode continu — voir src/mer-emprise.js
        uSpan: { value: TERRAIN_SIZE },
        uFenetre: { value: new THREE.Vector2(0, 0) },
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
    // GÉNÉRATION DU BÂTI DES LACS — voir `rebuild`. Toute reconstruction
    // l'incrémente, et un retour de Worker qui ne la porte plus est jeté.
    this._genLacs = 0
  }

  // Bake the slab-wide height + shore-distance field from the live sampler.
  //
  // ══════════ MODE CONTINU : LE CHAMP COUVRE L'EMPRISE, PAS LA FENÊTRE ═══════
  //
  // Cuit sur les 56 unités du socle, ce champ décrivait le fond marin d'un
  // AUTRE endroit dès le premier pas de défilement : mesuré à La Réunion, la
  // mer lisait un fond faux de 14,3 unités en moyenne à la butée, et ne voyait
  // RIEN des 9,2 % de haute mer réellement dans la fenêtre (src/mer-emprise.js
  // porte le tableau complet). Cuit sur les 168 unités de l'emprise et lu avec
  // le décalage de fenêtre, il ne bouge plus jamais : c'est la LECTURE qui se
  // déplace, et elle ne coûte que deux flottants d'uniforme par image.
  //
  // Prix : 1 152² texels RG demi-flottants = 5,3 Mo de VRAM (0,6 Mo avant), et
  // une cuisson par reconstruction — jamais par image.
  _bakeField(terrain, seaY, params) {
    const cote = terrain.dem?.empriseCote > 1 ? terrain.dem.empriseCote : 1
    const n = resChamp(cote)
    const span = spanChamp(TERRAIN_SIZE, cote)
    // ⚠️ `terrain.sample` NE PEUT PAS SERVIR ICI EN MODE CONTINU : il répond
    // « sous le point AFFICHÉ en x », donc il porte le décalage et rendrait un
    // champ neuf à chaque pas. `sampleChamp` répond « au point du MONDE » et
    // saute le grain FBM, nul à la ligne d'eau (terrain.js dit pourquoi).
    const echChamp = cote > 1 && params ? terrain.sampleChamp(params) : null
    const water = new Uint8Array(n * n)
    // ⚠️ LES DEMI-FLOTTANTS SONT ÉCRITS DIRECTEMENT, sans Float32Array
    // intermédiaire : à 1 152² celui-ci pesait 10,6 Mo de tas transitoire pour
    // porter des valeurs qu'on convertit aussitôt. Le résultat est identique au
    // bit près (même valeur, même conversion, seul le stockage temporaire saute).
    const half = new Uint16Array(n * n * 2)
    // terre selon le masque côtier (si reçu) : un polder sous le niveau 0 est
    // TERRE — ni cellule « eau », ni exclu du champ de distance-rivage (le
    // ressac s'enroule alors autour du VRAI trait de côte). Le champ du
    // masque et le slab couvrent le même footprint : monde → texel direct
    // (ligne 0 du champ = nord = z monde -T/2, même convention que uField).
    // CONTRAT : sans masque (cd null) le champ est identique à avant.
    // ⚠️ FOULÉE DE 1 : le masque côtier est un Uint8Array R8 depuis la passe
    // de mémoire du 2026-07-29, plus une ImageData RGBA (voir coast-mask.js).
    const cd = this._coastImage
    // ⚠️ `span`, PAS `TERRAIN_SIZE` : coast-mask.js rastérise le masque sur le
    // footprint du MNT, et le MNT recollé couvre les 168 unités de l'emprise.
    // Lu sur 56, le masque était agrandi trois fois — la terre du continent
    // voisin se serait posée sur la baie qu'on regarde.
    const landAt = cd
      ? (x, z) => {
          const px = Math.max(0, Math.min(cd.width - 1, Math.round((x / span + 0.5) * (cd.width - 1))))
          const py = Math.max(0, Math.min(cd.height - 1, Math.round((z / span + 0.5) * (cd.height - 1))))
          return cd.data[py * cd.width + px] > 127
        }
      : null
    const ech = echChamp || (terrain.sample ? terrain.sample : null)
    for (let j = 0; j < n; j++) {
      const z = (j / (n - 1) - 0.5) * span
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * span
        const h = ech ? ech(x, z) : 0
        half[(j * n + i) * 2] = THREE.DataUtils.toHalfFloat(h)
        water[j * n + i] = h < seaY && !(landAt && landAt(x, z)) ? 1 : 0
      }
    }
    // two-pass chamfer distance to the nearest land cell, in world units
    const cell = span / (n - 1)
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
    // half float: linear filtering is core WebGL2 (full float linear is an
    // optional extension); the ±20-unit height range fits half precision fine
    // v41: declin cotier x6 (Adrien) - le halo peint qui interdisait un grand
    // rayon a disparu avec les hauts-fonds
    for (let k = 0; k < n * n; k++) half[k * 2 + 1] = THREE.DataUtils.toHalfFloat(Math.min(1, dist[k] / 15))
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

  // Le sous-groupe des lacs — créé à la demande, il porte la translation
  // −fenêtre du mode continu. La mer et sa jupe restent dans `this.group`, qui
  // ne bouge JAMAIS : elles sont la fenêtre, pas le paysage.
  _groupeLacs() {
    if (!this._lacs) {
      this._lacs = new THREE.Group()
      this._lacs.name = 'real-water-lacs'
      this.group.add(this._lacs)
      if (this._fenetre) this._lacs.position.set(-this._fenetre.x, 0, -this._fenetre.z)
    }
    return this._lacs
  }

  /**
   * Le terrain a défilé d'un pas : la mer suit.
   *
   * Deux écritures d'uniforme par matériau (le champ et le masque côtier se
   * lisent ailleurs) et une translation de groupe pour les lacs. AUCUNE
   * géométrie refaite, AUCUN champ recuit — c'est tout l'intérêt d'avoir cuit
   * le champ sur l'emprise entière (src/mer-emprise.js).
   *
   * ⚠️ La surface, la jupe ET les lacs reçoivent la MÊME valeur. C'est ce qui
   * garantit que le haut de la jupe reste soudé à la mer : les deux shaders
   * évaluent la même houle sur le même champ, au même endroit.
   */
  setFenetre(x, z) {
    this._fenetre = { x, z }
    for (const mat of this.materials) mat.uniforms.uFenetre?.value.set(x, z)
    if (this._lacs) this._lacs.position.set(-x, 0, -z)
  }

  _clear() {
    this._refractRT?.dispose()
    this._refractRT = null
    for (const m of this.meshes) {
      m.geometry.dispose()
      m.parent?.remove(m)
    }
    for (const mat of this.materials) mat.dispose()
    for (const t of this._textures) t.dispose()
    this.meshes = []
    this.materials = []
    this._textures = []
    this._seaMesh = null
    this._fieldTex = null
    this._bakeCtx = null
    // 🔴 ET LE BÂTI DES LACS EN VOL EST PÉRIMÉ ICI, pas dans `rebuild`. Le cas
    // qui l'exige : on éteint « Mer animée » alors qu'un travail est parti —
    // `rebuild` fait `_clear()` puis RETOURNE, sans jamais atteindre la ligne
    // qui périmerait. Le retour se poserait alors sur une texture détruite, et
    // ça ne lève rien : ça peint du noir.
    this._genLacs = (this._genLacs ?? 0) + 1
  }

  // (Re)build for the current zone. Cheap no-op when the option is off.
  rebuild({ terrain, params }) {
    this._clear()
    if (!params.waterReal || params.source !== 'real' || !terrain.dem) return

    // le côté de l'emprise : 1 sur un socle ordinaire, 3 en mode continu
    const cote = terrain.dem.empriseCote > 1 ? terrain.dem.empriseCote : 1
    this._cote = cote
    this._span = spanChamp(TERRAIN_SIZE, cote)

    const seaY = terrain.mapUniforms.uSeaY.value
    const fieldTex = this._bakeField(terrain, seaY > -9000 ? seaY : -1e9, params)
    this._textures.push(fieldTex)
    // mémorisés pour _rebakeField : le masque côtier arrive en async, souvent
    // APRÈS ce build — il faudra recuire le champ sans reconstruire les meshes
    this._fieldTex = fieldTex
    this._bakeCtx = { terrain, seaY: seaY > -9000 ? seaY : -1e9, params }

    // ⚠️ `this._span`, PAS `TERRAIN_SIZE`. Sur une emprise 3×3 `extentMeters` a
    // TRIPLÉ (dem-emprise.js), donc `TERRAIN_SIZE / extentMeters` rendait une
    // échelle TROIS FOIS TROP PETITE. Conséquences, toutes silencieuses : une
    // houle trois fois trop calme, et surtout un `bathyScene` au tiers de sa
    // valeur — la jupe de mer était alors trop courte pour rejoindre le fond,
    // c'est-à-dire un rideau d'eau suspendu au-dessus du vide. Hors mode continu
    // `_span` vaut TERRAIN_SIZE et l'expression est celle d'avant, au bit près.
    const demScale = (this._span / terrain.dem.extentMeters) * params.demExaggeration
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
      // LE PLAN D'EAU REPOSE AU NIVEAU DE LA MER, POINT.
      //
      // Il flottait auparavant ~2 m au-dessus du trait de côte, en plus du
      // relèvement du niveau moyen dans le vertex — deux précautions contre la
      // même chose : un creux qui perce la « plaine marine ». Cette plaine était
      // bien réelle tant que les tuiles de relief n'avaient aucune bathymétrie
      // (mesuré : 100 % de zéros au large de Toulon à z12) ; depuis la fusion
      // GEBCO, le fond est à sa vraie profondeur et les deux n'ont plus d'objet.
      //
      // Il ne reste que l'epsilon de coplanarité : sans lui la surface et le
      // trait de côte se disputent le même plan et scintillent (z-fighting).
      this._seaBase = seaY + 0.003
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
      // le plan d'eau EST la fenêtre : il ne bouge pas, c'est son champ qui défile
      mat.uniforms.uSpan.value = this._span
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
              // masque côtier : affecté APRÈS création (règle du clone) par
              // _pushCoastMask, qui couvre tout matériau portant uCoastMask
              uCoastMask: { value: null },
              uCoastMaskOn: { value: 0 },
              uDeep: { value: waterColors(params).deep },
              uSky: { value: new THREE.Color('#cfe3f2') },
              uFrost: { value: params.seaEdgeFrost ?? 0.5 },
              uDayLight: { value: 1 },
              uViewCalm: { value: 1 },
              uSurfCalm: { value: 1 },
              uSpan: { value: this._span },
              uFenetre: { value: new THREE.Vector2(0, 0) },
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
    // ══════════ UN LAC APPARTIENT AU MONDE, PAS À LA FENÊTRE ═══════════════════
    // Sa géométrie est taillée sur son emprise géographique, en coordonnées de
    // CHAMP (jusqu'à ±84 en mode continu). C'est son groupe qui porte la
    // translation −fenêtre — deux écritures de `position` par pas, aucune
    // géométrie refaite, exactement la règle que main.js applique déjà aux noms
    // de lieux et au calque d'eau vectoriel.
    const dem = terrain.dem
    // ⚠️ LES LACS NE SE REDÉTECTENT PAS À CHAQUE RECONSTRUCTION, ET NE SE
    // DÉTECTENT PLUS SUR LE FIL. Cette méthode est rappelée pour « Mer
    // animée », « Tranche de verre », un template, un tirage aléatoire,
    // l'entrée/sortie du mode région — autant de gestes qui ne touchent pas AUX
    // ALTITUDES. Deux réponses, dans cet ordre :
    //   · la fente de dem-memo.js répond tout de suite pour le MNT courant,
    //     donc les reconstructions répétées ne coûtent plus rien ;
    //   · sinon le travail part au Worker (8 ms de fil principal pour envoyer
    //     40,5 Mo, contre ~600 ms de gel à le calculer ici).
    // Mesure, durée TOTALE de rebuild : Annecy 3×3 875 → 201 ms, Annecy z12
    // 187 → 98 ms, La Réunion 3×3 556 → 67 ms.
    const cuits = lacsMemoLire(dem)
    if (cuits) this._batirLacs(cuits, { dem, params, fieldTex, cote })
    else {
      // ⚠️ LE GARDE-FOU EST UNE GÉNÉRATION, pas une comparaison de MNT : entre
      // le départ et l'arrivée, `_clear()` a pu disposer `fieldTex` et le groupe
      // des lacs. Poser un lac sur une texture détruite ne lève pas d'erreur —
      // ça peint du noir, et personne ne saurait d'où il vient. La génération
      // est incrémentée par `_clear()` lui-même (voir là-bas pourquoi) : ici on
      // ne fait que retenir celle sous laquelle on part.
      const gen = this._genLacs
      runLakeJob({ data: dem.data, size: dem.size }).then((r) => {
        if (!r || gen !== this._genLacs) return
        lacsMemoEcrire(dem, r.lacs)
        this._batirLacs(r.lacs, { dem, params, fieldTex, cote })
      })
    }
    this._applySea()
    this.setSeabed(params.seaBed ?? 'map')
    // ⚠️ LA FENÊTRE SE RELIT SUR LE TERRAIN, elle ne se mémorise pas ici. Une
    // reconstruction peut arriver EN PLEIN DÉFILEMENT (curseur d'exagération,
    // arrivée du trait de côte) : repartir de zéro ferait sauter la mer d'un
    // bloc entier sous les yeux, alors que le relief, lui, n'aurait pas bougé.
    const f = terrain.fenetre
    if (f) this.setFenetre(f.x, f.z)
    this.group.visible = this._surfaceVisible
  }

  /**
   * Les plans d'eau d'altitude, posés dans la scène.
   *
   * ══════════ UN LAC APPARTIENT AU MONDE, PAS À LA FENÊTRE ═══════════════════
   * Sa géométrie est taillée sur son emprise géographique, en coordonnées de
   * CHAMP (jusqu'à ±84 en mode continu). C'est son groupe qui porte la
   * translation −fenêtre — deux écritures de `position` par pas, aucune
   * géométrie refaite, exactement la règle que main.js applique déjà aux noms
   * de lieux et au calque d'eau vectoriel.
   *
   * ⚠️ SÉPARÉE DE `rebuild` PARCE QU'ELLE PEUT ARRIVER APRÈS LUI (retour du
   * Worker). Tout ce qu'elle lit est donc passé en paramètre ou relu sur
   * `this` — rien ne doit dépendre de l'instant où elle tourne.
   */
  _batirLacs(lacs, { dem, params, fieldTex, cote }) {
    const scale = (this._span / dem.extentMeters) * params.demExaggeration
    const cellM = dem.extentMeters / (dem.size - 1)
    // ⚠️ LA LARGEUR D'UN BLOC, PAS CELLE DE L'EMPRISE. En mode continu
    // `extentMeters` est déjà multiplié par `empriseCote` (dem-emprise.js) :
    // servir cette valeur au plancher de longueur le multiplierait par trois et
    // ferait disparaître, en mode continu seulement, les lacs que ce plancher
    // borné existe pour sauver.
    const blocM = dem.extentMeters / (dem.empriseCote > 1 ? dem.empriseCote : 1)
    let poses = 0
    // ══════════ QUI A LE DROIT À UNE SURFACE D'EAU ANIMÉE ═══════════════════
    //
    // Le tri vit dans src/plan-eau.js, pas ici, et il TRIE AVANT DE CUIRE : le
    // masque par lac (`_bakeLakeMask`, une distance de chanfrein sur la boîte
    // englobante) coûtait plein tarif pour 21 dentelles refusées sur 21 à
    // Brest. Deux conditions, toutes deux mesurées là-bas et à Valence :
    //   · largeur  >= 150 m — la NOUVELLE, celle qui refuse les dentelles de
    //     contour que la quantification en mètres entiers fabrique sur toute
    //     pente douce (« la mer qui rentre dans les côtes », 2026-08-02) ;
    //   · longueur >= min(3 km, 80 % du bloc) — la règle d'Adrien de la v40,
    //     BORNÉE PAR LE BLOC : telle quelle, à 3 km absolus, elle effaçait le
    //     lac d'Annecy dès z15 puisqu'un bloc n'y fait plus que 2,6 km.
    // test/garde-plans-eau.test.js les tient sur onze MNT réels, hors ligne —
    // dont la MÊME eau cuite à deux finesses, parce qu'un seuil peut sembler
    // invariant sans l'être et que c'est ce qui a coûté un revert le 2026-08-02.
    for (const { lac: lake } of plansEauRetenus(lacs, { cellM, blocM })) {
      const { tex, minX, minY, w, h } = this._bakeLakeMask(lake)
      this._textures.push(tex)
      const yLake = (lake.elevM - dem.meanM) * scale + 0.04 + (params.detail ?? 0) * 0.6 + 0.025
      const toWorld = (g, n) => (g / (n - 1) - 0.5) * this._span
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
      mat.uniforms.uSpan.value = this._span
      // clip de fenêtre : un lac de l'emprise qui sort du socle flotterait
      // au-dessus du vide. 1e6 hors mode continu = pas de clip, comme avant.
      if (cote > 1) {
        mat.uniforms.uHalf.value = (TERRAIN_SIZE / 2) * 0.998
        mat.uniforms.uCornerR.value = Math.min(TERRAIN_SIZE / 2 - 0.05, Math.max(0.05, (params.slabCorner ?? 0) * TERRAIN_SIZE))
      }
      const segX = Math.max(12, Math.min(80, Math.round((x1 - x0) * 6)))
      const segZ = Math.max(12, Math.min(80, Math.round((z1 - z0) * 6)))
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ)
      geo.rotateX(-Math.PI / 2)
      geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.y = yLake
      mesh.renderOrder = 18 // same rule as the sea: over the draped OSM water
      mesh.frustumCulled = false
      this._groupeLacs().add(mesh)
      this.meshes.push(mesh)
      this.materials.push(mat)
      poses++
    }
    // 🔴 ET L'ÉTAT COURANT SE REJOUE SUR LES NOUVEAUX MATÉRIAUX. Six réglages
    // sont poussés matériau par matériau APRÈS la reconstruction (houle, soleil,
    // trait de côte, fond marin, teintes, accalmie de vue). Un lac qui arrive
    // 600 ms plus tard les a tous manqués : il garderait la hauteur de vague et
    // la couleur d'avant, jusqu'au prochain coup de curseur. Ça ne lève aucune
    // erreur — ça se voit, et seulement si on regarde le bon lac.
    if (poses) this._rejouerEtat(params)
  }

  /**
   * Repousse sur TOUS les matériaux l'état que les réglages externes ont
   * déposé depuis la dernière reconstruction. Idempotent par construction :
   * chacun de ces appels n'écrit que des uniformes.
   *
   * ⚠️ SI UN SEPTIÈME RÉGLAGE PAR MATÉRIAU APPARAÎT, IL SE REJOUE ICI. C'est le
   * prix d'un bâti qui peut arriver après coup, et le seul endroit qui le sait.
   */
  _rejouerEtat(params) {
    this._applySea() // houle + soleil + masque côtier
    this.setSeabed(this._seabedId ?? params?.seaBed ?? 'map')
    if (this._look) this.setLook(this._look)
    if (this._ondes) this.setWaves(this._ondes)
    if (this._vue) this.setView(this._vue.cameraY, this._vue.viewDist)
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
    this._pushCoastMask() // re-apply the coast mask onto the freshly built materials
  }

  // OSM coast mask (same texture the terrain uses) — gates the sea so waves stop
  // at the REAL shoreline, not the elevation contour (flat polders below sea
  // level are land, not sea). Stored so a rebuild re-applies it (see _applySea).
  // coastImage : champ R8 du masque (le tableau MÊME de sa DataTexture)
  // — nourrit le champ de simulation uField via _bakeField. Le fetch du masque
  // étant async, s'il arrive APRÈS le build le champ est recuit sur place.
  setCoastMask(tex, on, coastImage) {
    this._coastMask = tex || null
    this._coastMaskOn = on ? 1 : 0
    const img = tex && on ? coastImage || null : null
    const changed = img !== this._coastImage
    this._coastImage = img
    this._pushCoastMask()
    if (changed) this._rebakeField()
  }

  // Recuit du champ uField (hauteur + distance-rivage) avec la connaissance
  // terre/mer du masque côtier, SANS reconstruire les meshes : la nouvelle
  // texture remplace l'ancienne partout (surface, jupe, lacs) puis l'ancienne
  // est disposée — _textures reste cohérent pour _clear().
  _rebakeField() {
    if (!this._bakeCtx || !this.materials.length) return
    const { terrain, seaY, params } = this._bakeCtx
    const tex = this._bakeField(terrain, seaY, params)
    const old = this._fieldTex
    for (const mat of this.materials) if (mat.uniforms.uField) mat.uniforms.uField.value = tex
    const i = this._textures.indexOf(old)
    if (i >= 0) this._textures[i] = tex
    else this._textures.push(tex)
    old?.dispose?.()
    this._fieldTex = tex
  }
  _pushCoastMask() {
    for (const mat of this.materials) {
      if (!mat.uniforms.uCoastMask) continue
      mat.uniforms.uCoastMask.value = this._coastMask ?? null
      mat.uniforms.uCoastMaskOn.value = this._coastMask ? (this._coastMaskOn ?? 0) : 0
    }
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
  // ⚠️ retenu (`_look`) : un lac bâti après coup doit le rejouer, voir _rejouerEtat
  setLook(params) {
    this._look = params
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
  // ⚠️ retenu (`_ondes`) : un lac bâti après coup doit le rejouer — sans ça il
  // porterait la hauteur de vague de la reconstruction, pas celle du curseur.
  setWaves({ height, choppiness, speed } = {}) {
    this._ondes = { ...(this._ondes ?? {}), ...(height !== undefined && { height }), ...(choppiness !== undefined && { choppiness }), ...(speed !== undefined && { speed }) }
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
  // plate au-dela de 25 km (la mer/l'ecume envahissaient les vues continentales).
  // `viewDist` = distance d'affichage (rayon d'orbite, unites scene) : elle
  // pilote la TAILLE des remous de cote — pleins de pres, effaces de loin ou
  // ils lisaient grossiers (retour Adrien).
  // ⚠️ retenu (`_vue`) : un lac bâti après coup doit le rejouer, sinon il reste
  // à l'accalmie de la vue précédente.
  setView(cameraY, viewDist) {
    this._vue = { cameraY, viewDist }
    if (!this._demScale) return
    const km = Math.max(0, (cameraY - (this._seaBase ?? 0)) / this._demScale / 1000)
    const calm = smooth01((25 - km) / 17)
    const surfCalm = viewDist == null ? 1 : 0.08 + 0.92 * smooth01((SURF_FAR - viewDist) / (SURF_FAR - SURF_NEAR))
    for (const mat of this.materials) {
      if (mat.uniforms.uViewCalm) mat.uniforms.uViewCalm.value = 0.08 + 0.92 * calm
      if (mat.uniforms.uSurfCalm) mat.uniforms.uSurfCalm.value = surfCalm
    }
  }

  // Le Y de la surface de mer courante, ou null tant qu'aucune mer n'est
  // construite.
  get seaY() {
    return this.meshes.length ? this._seaBase : null
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
