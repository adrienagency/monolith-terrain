// Nuages v2 — des ENTITÉS, plus un champ de bruit découpé au seuil.
//
// Plan docs/superpowers/plans/2026-07-25-nuages-v2-systeme-meteo.md. La bascule
// d'architecture : au lieu d'UNE boîte raymarchée couvrant toute la carte dans
// laquelle un seuillage sculpte des bancs, on instancie N boîtes — une par
// nuage — chacune raymarchée dans SES bornes. Une boîte est une frontière dure
// de calcul : les nuages sont séparés par construction, chacun avec sa graine,
// sa taille, sa vie (voir clouds-sim.js, module pur et testé).
//
// Trois bénéfices, dans l'ordre où ils comptent :
//   1. des nuages qu'on peut compter, qui naissent et meurent individuellement ;
//   2. moins cher — 28 pas dans une petite boîte plutôt que 64 dans une boîte
//      pleine carte, avec le culling de scène gratuit (ce sont des objets) ;
//   3. l'ombre au sol se peint depuis les MÊMES entités, ce qui supprime la
//      duplication de la formule de densité entre le CPU et le GLSL (l'ancien
//      système miroitait `densityAt` en JavaScript pour son bake).
//
// L'éclairage est repris tel quel de clouds.js — il était déjà à l'état de
// l'art (Beer-Lambert, double lobe Henyey-Greenstein, approximation
// multi-octave du multiple scattering de Wrenninge, marche vers le soleil) —
// avec l'ajout du terme Beer-Powder de Schneider (SIGGRAPH 2015) qui manquait.
//
// L'ancien clouds.js est CONSERVÉ (repli, comparaison) : rien n'y est touché.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { sunLook } from 'ocean-waves' // palette jour/nuit partagée (ocean-lab)
import { bakeCloudVolume } from './cloud-volume.js'
import { normalizeBgStops, deriveAoColor } from './background.js'
import { createSky, stepSky, resizeSky, cloudDensity, cloudScale, cloudCountForTier, CLOUD_HARD_MAX } from './clouds-sim.js'

// plafond dur du buffer ; le peuplement réel est adaptatif. Doit couvrir
// CLOUD_HARD_MAX : une grappe pèse jusqu'à 7 entités, et les dislocations en
// ajoutent le temps que les lambeaux s'éteignent.
const MAX_INSTANCES = CLOUD_HARD_MAX
const SHADOW_N = 96 // résolution du bake d'ombre au sol
const SHADOW_EVERY = 0.25 // s — un système météo n'a pas besoin de 60 Hz

const _moonTint = new THREE.Color()
const _shadowTint = new THREE.Color()
const _m = new THREE.Matrix4()
const _v = new THREE.Vector3()

// ------------------------------------------------------------------ shader
// Axe d'allongement : LA DIRECTION DU VENT, pour tout le ciel (Adrien — « les
// nuages s'étirent en longueur dans la direction du vent uniquement »). C'était
// un angle tiré de la graine, donc des radeaux orientés n'importe comment.
// La MÊME valeur sert côté JS (boîte englobante) et côté GLSL (uElongAngle).
const elongAngle = (params) => ((params?.windDir ?? 45) * Math.PI) / 180

// ⛔ JAMAIS DE BACKTICK DANS UN COMMENTAIRE GLSL — le nuanceur vit dans un
// template literal : un backtick le TERMINE, et l erreur qu on lit
// (« Unexpected identifier ») ne pointe pas vers la cause. La page ne demarre
// simplement plus. Ca a coute une execution de banc a la Tache R20.
const VERT = /* glsl */ `
  out vec3 vLocalPos; // en unités de BLOC — voir monde/nuages-globe.js §2
  flat out vec3 vCenter;
  flat out vec3 vHalf;
  flat out vec4 vInfo;   // x = graine, y = densité (vie incluse), z = filandreux, w = allongement
  flat out vec3 vAxes;   // demi-axes RÉELS de l'empreinte : x = long, y = court, z = angle

  in vec4 iInfo;
  uniform float uElongAngle; // direction du vent, en radians

  void main() {
    // les bornes du nuage se DÉRIVENT de la matrice d'instance (translation +
    // échelle, jamais de rotation) : pas d'attribut redondant à tenir à jour
    vCenter = instanceMatrix[3].xyz;
    vHalf = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)) * 0.5;
    vInfo = iInfo;
    // La boîte est AXÉE SUR LE MONDE mais l'empreinte est une ellipse TOURNÉE
    // (jusqu'à 6:1, Adrien) : on retrouve ses demi-axes depuis la boîte
    // englobante — Rx² = b²(e²cos²θ + sin²θ), donc b = Rx / √(…).
    float e = max(1.0, iInfo.w);
    float th = uElongAngle; // le vent, partagé par tout le ciel
    float c = cos(th), s = sin(th);
    float b = vHalf.x / sqrt(e * e * c * c + s * s);
    vAxes = vec3(e * b, b, th);
    // ⛔ LA MARCHE RESTE EN UNITÉS DE BLOC — Tâche R20.
    // Le groupe porte désormais la similitude bloc → globe (k ≈ 0,0077 à
    // La Réunion). Toutes les constantes du nuanceur sont en unités de bloc
    // (world / 0.42, near * 3.0, smoothstep(1.5, 4.0, …), uMapMin /
    // uMapSize) : les laisser lire un espace 130 fois plus petit les
    // rendrait TOUTES fausses d'un coup, sans erreur ni message. On sort donc
    // la position AVANT modelMatrix, et la caméra arrive divisée par k.
    // ⚠️ Hors mode sphère modelMatrix est l'identité : neutre au bit près.
    vec4 lp = instanceMatrix * vec4(position, 1.0);
    vLocalPos = lp.xyz;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * lp;
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  #define PI 3.14159265359
  #define MARCH_STEPS 26
  #define SUN_STEPS 3
  #define UP_STEPS 2
  // marge de la boîte autour de la silhouette — DOIT valoir la même chose que
  // le facteur de mise à l'échelle des instances (_writeInstances)
  #define BOX_PAD 1.15

  in vec3 vLocalPos;
  flat in vec3 vCenter;
  flat in vec3 vHalf;
  flat in vec4 vInfo;
  flat in vec3 vAxes; // demi-axe long, demi-axe court, angle de l'allongement
  out vec4 outColor;

  // LA CAMÉRA, EN UNITÉS DE BLOC — Tâche R20. cameraPosition est en unités
  // de MONDE ; sous la similitude du globe ce n'est plus l'espace où le ciel
  // est décrit. monde/nuages-globe.js porte la conversion ET le SENS de sa
  // division (multiplier au lieu de diviser met la caméra DANS le nuage).
  // Hors mode sphère elle vaut exactement camera.position.
  uniform vec3 uCamBloc;

  uniform sampler3D uVolume;
  uniform float uDensity;
  uniform float uScale;       // finesse du grain à l'intérieur d'un nuage
  uniform float uContrast;
  uniform float uSSS;
  uniform float uBrightness;
  uniform vec3 uSunDir;       // direction que suit la lumière (soleil → scène)
  uniform vec3 uSunColor;
  uniform vec3 uAmbColor;
  uniform float uNight; // 0 = jour, 1 = nuit noire
  uniform float uTime;
  // vent en unité monde (direction unitaire × force) : cisaille la base des
  // nuages et fait dériver le dessin interne de l'empreinte (phase 2)
  uniform vec2 uWind;
  // teintes du ciel tirées des couleurs de fond (bgStops) : haut du dégradé
  // pour les sommets, bas (horizon) pour les bases — phase 3
  uniform vec3 uSkyHi;
  uniform vec3 uSkyLo;
  // tirette de TEXTURE (Adrien) : 0 = bourgeons nets v3 (érosion-remap),
  // 1 = coton doux de l'ancien moteur (le bruit module au lieu de ronger)
  uniform float uTexMix;
  // « Gonflement vertical » et « Trouées » du panneau : ces deux tirettes
  // existaient depuis l'ancien moteur mais n'étaient RELIÉES À RIEN en v2/v3.
  uniform float uBillow;   // force du bourgeonnement en chou-fleur
  uniform float uCoverage; // 0 = masses pleines, 0.8 = dentelle trouée
  // relief : sert à l'occlusion (le rayon s'arrête dans la montagne)
  uniform sampler2D uTerrainTex;
  uniform vec2 uMapMin;
  uniform vec2 uMapSize;
  uniform float uTerrainMin;
  uniform float uTerrainRange;
  // NIVEAU DE L'EAU en unites monde (uSeaY du terrain, -9999 = pas de mer) :
  // un nuage ne peut pas vivre SOUS l'eau (Adrien). Le plancher de la marche
  // est donc le plus HAUT du relief et de la surface de l'eau.
  uniform float uWaterY;

  float sat(float v) { return clamp(v, 0.0, 1.0); }

  vec3 hash31(float p) {
    vec3 q = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yxz + 33.33);
    return fract((q.xxy + q.yzz) * q.zyx);
  }

  float remapC(const float x, const float a, const float b) {
    return sat((x - a) / max(b - a, 1e-5));
  }

  mat2 rot2(const float a) {
    float c = cos(a), sn = sin(a);
    return mat2(c, -sn, sn, c);
  }

  float terrainH(vec2 xz) {
    vec2 uv = (xz - uMapMin) / uMapSize;
    return uTerrainMin + texture(uTerrainTex, clamp(uv, 0.0, 1.0)).r * uTerrainRange;
  }

  // plancher opaque sous lequel plus rien ne se dessine : le relief, ou la
  // surface de l'eau la ou elle recouvre le relief
  float floorY(vec2 xz) {
    return max(terrainH(xz), uWaterY);
  }

  vec2 boxSpan(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
    vec3 t0 = (bmin - ro) / rd;
    vec3 t1 = (bmax - ro) / rd;
    vec3 ts = min(t0, t1);
    vec3 tb = max(t0, t1);
    return vec2(max(max(ts.x, ts.y), ts.z), min(min(tb.x, tb.y), tb.z));
  }

  // ---- Nuages v3 : la silhouette nait d'une CHAINE DE REMAPS (recette
  // Takram/Nubis, dissequee depuis clouds.glsl, MIT) — plus aucune primitive,
  // plus aucun seuil sec, donc ni carres ni boules :
  //   empreinte 2D x profil de hauteur -> enveloppe
  //   enveloppe (-)remap bruit de forme -> chou-fleur
  //   (-)remap bruit de detail (de pres seulement) -> bords fins
  //   x densite croissante avec la hauteur -> base tenue, sommet dense

  // Parametres d'empreinte par ENTITE, tires de la graine + du filandreux.
  struct Foot {
    vec2 lean;      // decentrage de l'empreinte (asymetrie sous le vent)
    float covr;     // couverture : plein (bourgeon) -> troue (voile)
    float wExp;     // exposant meteo : mord plus ou moins dans le bruit
    float bias;     // ou gonfle le ventre du profil demi-cercle
    float shapeAmt; // force de l'erosion par le bruit de forme
    float dtlAmt;   // force du detail near-field
    vec2 wOff;      // offset meteo propre (deux nuages = deux dessins)
  };

  Foot footprintOf(const float seed, const float wisp) {
    vec3 c = hash31(seed * 0.717 + 3.1);
    vec3 g = hash31(seed * 1.37 + 5.11);
    Foot F;
    float leanA = c.z * 6.28318;
    F.lean = vec2(cos(leanA), sin(leanA)) * (0.05 + c.x * 0.22);
    // l'allongement de l'empreinte n'est plus ici : il est GÉOMÉTRIQUE
    // (ellipse tournée, jusqu'a 6:1) et arrive par vAxes
    // uCoverage part de 0.8 (Adrien) : au minimum de la tirette les masses
    // sont pleines, au maximum c'est de la dentelle. Borné : sans le clamp,
    // une couverture forte rendait covr négatif et éteignait tout le ciel.
    F.covr = clamp(mix(0.92, 0.58, wisp) - c.y * 0.12 - (uCoverage - 0.8) * 0.34, 0.06, 1.05);
    F.wExp = mix(0.8, 2.4, wisp);
    F.bias = mix(0.42, 0.22, wisp); // voile = ventre bas et plat
    F.shapeAmt = mix(0.5, 0.85, wisp);
    F.dtlAmt = mix(0.55, 0.95, wisp);
    F.wOff = vec2(c.x * 7.31 + seed * 0.011, c.y * 5.17);
    return F;
  }

  #define COV_FILTER 0.4

  // cheap = version allégée pour les marches SECONDAIRES (soleil, ciel).
  // ⚠️ jamais de backtick dans un commentaire GLSL : il termine le template
  // literal JS qui porte le shader (piège déjà rencontré sur ce projet).
  // Elles n'ont besoin que d'une épaisseur approchée — payer le cisaillement
  // de base sur chacune multipliait le coût par 5 sans rien changer à l'œil.
  float densityAt(const vec3 wp, const Foot F, const float detailOn, const bool cheap) {
    // la BOITE est plus large que le nuage (BOX_PAD) : les coordonnees sont
    // normalisees a la SILHOUETTE (plus ou moins 1), la paroi est a 1.15
    vec3 rel = wp - vCenter;
    float py = rel.y / vHalf.y * BOX_PAD;
    float hf = sat(py * 0.5 + 0.5); // 0 = base, 1 = sommet

    // EMPREINTE ELLIPTIQUE TOURNEE (Adrien : « la base peut etre tres allongee,
    // jusqu'a 5 ou 6 pour 1 ») : la boite reste axee sur le monde, c'est le
    // POINT qu'on ramene dans le repere du nuage puis sur le disque unite.
    vec2 q = (rot2(-vAxes.z) * rel.xz) / vAxes.xy * BOX_PAD;

    // CISAILLEMENT (Takram : turbulence en deplacement de domaine, ponderee a
    // la BASE, remap(h, 0.3 -> 0.0)) : la base est trainee par le vent et
    // fouettee par la turbulence, le sommet reste net. Une seule lecture de
    // volume, payee uniquement dans le tiers bas du nuage.
    float baseW = cheap ? 0.0 : 1.0 - remapC(hf, 0.0, 0.3);
    if (baseW > 0.001) {
      vec2 tn = texture(uVolume, fract(wp * uScale * 0.021 + vInfo.x)).rg - 0.5;
      q += (uWind * 0.30 + tn * (0.30 + 0.35 * length(uWind))) * baseW;
    }

    // profil demi-cercle biaise (Takram shapeAlteringFunction) : nul a la
    // base ET au sommet, ventre place par le bias — le profil de cumulus
    float hb = pow(hf, F.bias);
    float x = clamp(hb * 2.0 - 1.0, -1.0, 1.0);
    float heightScale = 1.0 - x * x;
    if (heightScale <= 0.003) return 0.0;

    // retombee radiale sur le disque unite + meteo bruitee a domaine deforme :
    // le contour est dessine par le bruit, jamais par la geometrie
    q -= F.lean;
    float radial = 1.0 - smoothstep(0.30, 1.0, length(q));
    if (radial <= 0.003) return 0.0;
    // l'empreinte EVOLUE : derive lente du dessin interne (protuberances qui
    // migrent) — remplace la respiration des lobes
    // ADVECTION : le dessin interne derive AVEC le vent (offset meteo Takram),
    // plus un souffle residuel pour que le calme plat ne fige pas le nuage
    vec2 wuv = q * 0.33 + F.wOff + uWind * uTime * 0.006 + vec2(uTime * 0.0015, 0.0);
    float warp = texture(uVolume, vec3(fract(wuv * 0.61 + 0.13), 0.62)).g;
    float wthr = texture(uVolume, vec3(fract(wuv + (warp - 0.5) * 0.5), 0.29)).g;
    float weather = pow(wthr, F.wExp) * radial;

    // enveloppe par couverture remappee (Takram, ref. Skybolt) : le seuil est
    // un remap DOUX pilote par le profil de hauteur
    float factor = 1.0 - F.covr * heightScale;
    float env = remapC(mix(weather, 1.0, COV_FILTER), factor, factor + COV_FILTER);
    if (env <= 0.004) return 0.0;

    // erosion par REMAP (Nubis) : le bruit de forme RONGE l'enveloppe — des
    // bourgeons francs. La TIRETTE uTexMix re-mélange avec le traitement de
    // l'ancien moteur (modulation douce = coton), au choix de l'utilisateur.
    vec3 sp = wp * uScale * 0.055 + vInfo.x;
    float shape = texture(uVolume, fract(sp)).r;
    float net = remapC(env, (1.0 - shape) * F.shapeAmt, 1.0);
    float coton = sat(env * (0.40 + shape * 1.05));
    env = mix(net, coton, uTexMix);
    if (env <= 0.004) return 0.0;

    // BOURGEONNEMENT (Adrien : « augmente le bourgeonnement comme a la session
    // precedente ») : seconde echelle de bruit, plus fine et cabossee, qui
    // creuse des BOSSES DE CHOU-FLEUR — d'autant plus marquees qu'on monte
    // (un cumulus bourgeonne par le haut, sa base reste lisse). C'est ce que
    // faisaient les lobes qui grossissaient, sans leurs patates.
    float budAmt = uBillow * (0.18 + 0.82 * hf) * (1.0 - 0.6 * uTexMix);
    if (budAmt > 0.004) {
      float bump = texture(uVolume, fract(sp * 2.35 + 0.61)).r;
      env = remapC(env, (1.0 - bump) * budAmt, 1.0);
      if (env <= 0.004) return 0.0;
    }

    // detail NEAR-FIELD seulement (gate distance — gratuit de loin) :
    // "fluffy at the top, whippy at the bottom" (Takram, verbatim)
    if (detailOn > 0.5) {
      float detail = texture(uVolume, fract(sp * 3.1 + 0.37)).r;
      float modif = mix(pow(detail, 6.0), 1.0 - detail, remapC(hf, 0.2, 0.4));
      // le détail net s'efface à mesure qu'on glisse vers le coton
      env = remapC(env * 2.0, modif * 0.5 * F.dtlAmt * (1.0 - 0.7 * uTexMix), 1.0);
      if (env <= 0.004) return 0.0;
    }

    env = pow(env, uContrast);
    // ceintures de secours elliptiques (invisibles : l'empreinte s'eteint
    // bien avant), au cas ou
    env *= 1.0 - smoothstep(0.86, 1.05, length(q));
    env *= 1.0 - smoothstep(0.90, 1.08, abs(py));

    // densite CROISSANTE avec la hauteur (profil 0.25 + 0.75*h de Takram) :
    // base tenue et vaporeuse, sommet dense — le x0.85 recale l'ensemble un
    // cran plus leger (Adrien : « trop denses »)
    float dens = env * (0.25 + 0.75 * hf) * 0.85;
    // CARTE D'ÉPAISSEUR intra-nuage (Adrien) : le MÊME nuage est massif ici,
    // évanescent là — champ de couverture lu à grande échelle sur l'empreinte
    float thick = texture(uVolume, vec3(fract(q * 0.16 + F.wOff * 1.9), 0.47)).g;
    dens *= mix(0.10, 1.5, smoothstep(0.12, 0.85, thick));
    // jamais de nuage colle a l'objectif
    dens *= smoothstep(1.5, 4.0, distance(wp, uCamBloc));
    return dens * uDensity * vInfo.y;
  }

  float beer(float d) { return exp(-d); }

  float henyeyGreenstein(float g, float cosA) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosA, 1.5));
  }

  // phase de Draine : HG corrige d'un terme en cos² — pic avant plus juste
  // pour les gouttelettes d'eau que le double-HG bricole
  float draine(float g, float a, float cosA) {
    float g2 = g * g;
    return ((1.0 - g2) * (1.0 + a * cosA * cosA)) /
      (4.0 * PI * (1.0 + a * (1.0 + 2.0 * g2) / 3.0) * pow(1.0 + g2 - 2.0 * g * cosA, 1.5));
  }

  // melange HG + Draine, constantes Jendersie–d'Eon pour gouttelettes ~5 um,
  // copiees du source Takram (MIT). k replie le pic vers l'isotrope pour les
  // octaves de multiple scattering.
  float phaseHGD(float cosA, float k) {
    float hg = henyeyGreenstein(0.9881 * k, cosA);
    float dr = draine(0.5556 * k, 21.9955, cosA);
    // pic avant BORNE : a 26 pas sans accumulation temporelle, le pic complet
    // (~10^3 pile face au soleil) ferait des lucioles — 6.0 garde un lisere
    // argente franc sans pixels aveuglants
    return min(mix(hg, dr, 0.4819), 6.0);
  }

  // approximation multi-octave du multiple scattering (Wrenninge, SIGGRAPH
  // 2015) : on ré-évalue la même profondeur avec des coefficients atténués
  // plutôt que de tracer des chemins supplémentaires
  float scatter(float depth, float cosA) {
    float lum = 0.0, a = 1.0, b = 1.0, k = 1.0;
    for (int o = 0; o < 3; o++) {
      // plancher isotrope 0.11 conservé (plus bas, l'« éclairage inversé »
      // revenait) ; la partie directionnelle passe au HG+Draine de Takram
      float phase = phaseHGD(cosA, k) + 0.11;
      lum += b * phase * beer(depth * a);
      a *= 0.45; b *= 0.55; k *= 0.7;
    }
    return lum;
  }

  // Épaisseur de matière entre l'échantillon et le soleil — c'est elle qui fait
  // que les PROTUBÉRANCES projettent leur ombre sur la masse en dessous
  // (demande d'Adrien) : un bourgeon éclairé se détache d'un creux à l'ombre.
  float sunDepth(vec3 wp, vec3 toSun, vec3 bmin, vec3 bmax, const Foot F) {
    // pas COURT devant la taille du nuage : un pas long ressort du nuage dès le
    // premier échantillon, tout paraît mince et le nuage vire au blanc plat
    float step = min(vHalf.x, vHalf.y) * 0.26;
    float d = 0.0;
    for (int j = 1; j <= SUN_STEPS; j++) {
      vec3 s = wp + toSun * (step * float(j));
      if (any(lessThan(s, bmin)) || any(greaterThan(s, bmax))) break;
      d += densityAt(s, F, 0.0, true) * step * 1.7;
      if (d >= 2.4) break;
    }
    return d;
  }

  // Épaisseur de matière AU-DESSUS de l'échantillon. La lumière du ciel tombe
  // du haut : plus il y a de nuage au-dessus, moins elle atteint le point —
  // c'est ce qui assombrit naturellement la base des nuages ÉPAIS et laisse
  // claires les galettes minces (demande explicite d'Adrien, à la place de
  // l'ancien dégradé vertical arbitraire).
  float depthAbove(vec3 wp, vec3 bmax, const Foot F) {
    float step = vHalf.y * 0.3;
    float d = 0.0;
    for (int j = 1; j <= UP_STEPS; j++) {
      vec3 s = wp + vec3(0.0, step * float(j), 0.0);
      if (s.y > bmax.y) break;
      d += densityAt(s, F, 0.0, true) * step;
    }
    return d;
  }

  void main() {
    vec3 bmin = vCenter - vHalf;
    vec3 bmax = vCenter + vHalf;
    vec3 ro = uCamBloc;
    vec3 rd = normalize(vLocalPos - uCamBloc);
    vec2 span = boxSpan(ro, rd, bmin, bmax);
    span.x = max(span.x, 0.0);
    if (span.y <= span.x) discard;

    // occlusion par le relief AVANT le nuage : une crête entre la caméra et la
    // boîte cache tout ce qu'il y a derrière
    for (int i = 1; i <= 8; i++) {
      vec3 wp = ro + rd * (span.x * float(i) / 8.0);
      if (wp.y < floorY(wp.xz)) discard;
    }

    // l'empreinte de CE nuage, une seule fois pour tout le rayon ; le
    // detail fin ne se paie que de pres (il ne se voit pas de loin)
    Foot F = footprintOf(vInfo.x, vInfo.z);
    float detailOn = distance(uCamBloc, vCenter) < max(vHalf.x, vHalf.y) * 7.0 ? 1.0 : 0.0;

    vec3 toSun = -normalize(uSunDir);
    float cosA = dot(rd, -toSun);
    // dither du départ : sans lui, les pas de marche font des anneaux
    vec3 h = fract(vec3(gl_FragCoord.xyx) * 0.1031);
    h += dot(h, h.yzx + 33.33);
    float jitter = fract((h.x + h.y) * h.z);

    // GARDE-FOU DE REMPLISSAGE : de près, la boîte d'un nuage couvre tout
    // l'écran et chaque pixel paie la marche complète (+ marches soleil et
    // verticale) — la page se fige. On raccourcit la marche quand la caméra
    // est dans ou contre le nuage : à cette distance le détail ne se voit pas
    // de toute façon, la densité étant déjà éteinte autour de l'objectif.
    float camDist = distance(uCamBloc, vCenter);
    // PAS ADAPTATIF À LA TAILLE DE LA BOÎTE. Une grappe, c'est 3 à 7 boîtes qui
    // se recouvrent : marcher chacune en 26 pas quelle que soit sa taille
    // multipliait le remplissage jusqu'à écrouler la fréquence d'images (2 fps
    // mesurés). Un compagnon fait le tiers du cœur — il lui faut le tiers des
    // pas pour le même pas en unités monde, donc la même finesse à l'écran.
    float world = max(span.y - span.x, 1e-3);
    int steps = int(clamp(world / 0.42, 8.0, float(MARCH_STEPS)));
    // GARDE-FOU DE REMPLISSAGE, version dure. Quand la couche de nuages
    // descend à hauteur d'œil (Altitude basse), la caméra se retrouve DANS le
    // ciel : chaque boîte couvre alors presque tout l'écran et 17 nuages
    // suffisent à écrouler la fréquence d'images (2 fps mesurés). Plus la
    // boîte est proche, moins on marche — et de si près, le détail fin ne se
    // voit pas de toute façon.
    float near = max(vHalf.x, vHalf.y);
    if (camDist < near * 3.0) steps = min(steps, 10);
    if (camDist < near * 1.5) steps = min(steps, 6);

    float dt = world / float(steps);
    float transmittance = 1.0;
    vec3 light = vec3(0.0);

    for (int i = 0; i < MARCH_STEPS; i++) {
      if (i >= steps) break;
      vec3 wp = ro + rd * (span.x + (float(i) + jitter) * dt);
      if (wp.y < floorY(wp.xz)) break; // le rayon plonge dans le relief ou sous l'eau
      float d = densityAt(wp, F, detailOn, false);
      if (d <= 0.002) continue;
      // la marche SOLEIL coûte trois fois la marche principale : de très près
      // (on est dans le nuage), on lui substitue une épaisseur constante —
      // invisible à l'œil, décisif pour la fréquence d'images
      float depth = camDist < near * 1.5 ? d * 1.6 : sunDepth(wp, toSun, bmin, bmax, F);
      // BEER-POWDER (Schneider 2015) : les bords épais vus vers le soleil
      // s'assombrissent au lieu de blanchir
      float powder = 1.0 - exp(-depth * 2.0);
      vec3 sun = uSunColor * uBrightness * scatter(depth, cosA) * mix(1.0, powder, 0.35 * sat(cosA));
      // translucence : là où la marche soleil n'a rien trouvé, la lumière passe
      float thin = exp(-depth * 2.0);
      vec3 sss = uSunColor * uSSS * thin * (0.35 + 0.65 * sat(cosA));
      // LUMIÈRE DU CIEL atténuée par la matière AU-DESSUS : la base d'un nuage
      // épais s'assombrit d'elle-même, celle d'une galette mince reste claire.
      // Remplace l'ancien dégradé vertical arbitraire (retour Adrien).
      float above = camDist < near * 1.5 ? d * 0.8 : depthAbove(wp, bmax, F);
      // IRRADIANCE CIEL DÉGRADÉE (Takram mix(minSky, maxSky, h)) : l'ambiante
      // n'est pas une couleur unique — sombre et teintée horizon dessous, ton
      // du haut du ciel dessus. Les deux teintes viennent de NOS couleurs de
      // fond (bgStops) : le nuage baigne dans la palette de la carte.
      float hfs = sat(((wp.y - vCenter.y) / vHalf.y * BOX_PAD) * 0.5 + 0.5);
      vec3 skyTint = mix(uSkyLo, uSkyHi, hfs);
      vec3 skyLight = uAmbColor * skyTint * mix(1.0, 1.9, hfs) * (0.16 + 0.84 * exp(-above * 1.7));
      vec3 col = sun + sss + skyLight;
      // LA NUIT (Adrien : « tes nuages deviennent lumineux ») : un nuage ne
      // produit aucune lumière — sans lune ni ville, c'est une MASSE PLUS
      // SOMBRE QUE LE CIEL, au mieux argentée d'un soupçon de lune froide.
      // On écrase la luminance vers un gris-bleu très sombre ; l'ombrage
      // interne (ratios sun/sss/skyLight) reste intact, seul le niveau chute.
      col = mix(col, col * vec3(0.10, 0.12, 0.16) + vec3(0.006, 0.008, 0.013), uNight);
      // EXTINCTION (Adrien : « à travers un nuage, il ne faut pas voir le
      // nuage derrière ») : le coefficient était trop bas — la transmittance
      // ne tombait jamais à zéro, même au cœur, et deux nuages superposés se
      // lisaient l'un dans l'autre. Les BORDS restent vaporeux (leur densité
      // est faible), seul le corps devient franchement opaque.
      float stepTrans = exp(-d * dt * 3.0);
      // ALBÉDO < 1 (Takram : extinction = scattering + absorption) : la
      // matière bloque un peu plus qu'elle ne réémet — les cœurs très épais
      // virent au gris réaliste au lieu du blanc saturé
      light += col * (1.0 - stepTrans) * transmittance * 0.97;
      transmittance *= stepTrans;
      if (transmittance < 0.02) break;
    }

    float alpha = 1.0 - transmittance;
    if (alpha < 0.01) discard;
    outColor = vec4(light, alpha);
  }
`

export class Clouds2 {
  constructor(scene, terrain, params) {
    this.terrain = terrain
    this.group = new THREE.Group()
    this.group.name = 'clouds2'
    scene.add(this.group)
    this.sunDir = new THREE.Vector3(0, -1, 0)
    this.sky = null
    this.mesh = null
    this.shadowTex = null
    this._shadowT = 0
    this._tier = 0
    this.build(params)
  }

  // le palier de perf pilote le peuplement (Adrien : « en fonction de la
  // puissance de calcul de l'ordi / mobile ») — main.js le pousse ici
  setTier(tier) {
    if (tier === this._tier) return
    this._tier = tier | 0
    if (this.sky) resizeSky(this.sky, this._targetCount())
  }

  _targetCount(params = this._params) {
    // Le curseur « Densité » module AUSSI le peuplement, mais doucement : la
    // formule datait d'une tirette bornée à 1.5 et, montée à 2.5, elle collait
    // le ciel au plafond d'entités en permanence — 48 boîtes raymarchées qui se
    // recouvrent, soit 3 fps mesurés. La densité est d'abord une OPACITÉ.
    const density = params?.cloudOpacity != null ? 0.65 + params.cloudOpacity * 0.18 : 1
    return Math.min(MAX_INSTANCES, cloudCountForTier(this._tier, density))
  }

  build(params) {
    this._params = params
    this._bgKey = '' // le matériau renaît avec ses teintes par défaut — reparse
    this._dispose()
    const vol = bakeCloudVolume()
    const hf = this._bakeHeightfield()
    const half = TERRAIN_SIZE / 2

    // PLAGE VERTICALE (Adrien) : « du sol au 100 % de l'altitude actuelle —
    // certains vivent au sommet des montagnes, d'autres au fond des vallées ».
    // La tirette Altitude est donc le PLAFOND, et « Étalement en altitude »
    // dit quelle part de la colonne est peuplée (1 = jusqu'au sol).
    const ceilY = params?.cloudAltitude ?? 4.5
    const spread = Math.max(0, Math.min(1, params?.cloudAltSpread ?? 0.85))
    const sky = createSky({
      count: this._targetCount(params),
      seed: (params?.seaSeed ?? 1) | 0 || 1,
      half: half * 0.92,
      baseY: ceilY * (1 - spread),
      topY: ceilY,
      sizeMin: 2.2,
      sizeMax: 6.0,
      // bande d'apparition/disparition HORS carte : les grappes de passage
      // naissent et meurent là, jamais sous les yeux (Adrien)
      fadeOut: half * 0.55,
      wind: {
        dir: ((params?.windDir ?? 45) * Math.PI) / 180,
        speed: (params?.windSpeed ?? 0.6) * (params?.cloudDrift ?? 1) * 0.35,
      },
      // OROGRAPHIE : la sim reste pure, on lui PRÊTE le relief. C'est le même
      // échantillonneur CPU que le bake du champ de hauteur, donc la butée que
      // calcule la sim et l'occlusion que fait le shader parlent du même sol.
      terrainAt: this.terrain?.sample ? (x, z) => this.terrain.sample(x, z) : null,
      waterY: this.terrain?.mapUniforms?.uSeaY?.value ?? -Infinity,
    })
    this.sky = sky

    const geo = new THREE.BoxGeometry(1, 1, 1)
    const info = new Float32Array(MAX_INSTANCES * 4)
    geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(info, 4))
    this._info = geo.getAttribute('iInfo')

    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      // ⚠️ PAS de test de profondeur : le fragment porte la profondeur de la
      // FACE ARRIÈRE de la boîte, qui ne dit rien de l'endroit où se trouve
      // vraiment la matière nuageuse. Avec le test activé, une crête située
      // devant cette face arrière — mais DERRIÈRE le nuage — rejetait le
      // fragment : « certains bouts de montagne passent au travers » (Adrien).
      // C'est la marche elle-même qui gère l'occlusion, via terrainH().
      depthTest: false,
      // BackSide : la caméra peut entrer dans la boîte d'un nuage sans que la
      // face avant disparaisse et n'éteigne le rayon
      side: THREE.BackSide,
      uniforms: {
        uVolume: { value: vol.tex },
        // Tâche R20 : posée à chaque image par `update`, en unités de BLOC.
        uCamBloc: { value: new THREE.Vector3() },
        uDensity: { value: params?.cloudOpacity ?? 1 },
        uScale: { value: params?.cloudScale ?? 3 },
        uContrast: { value: params?.cloudContrast ?? 1 },
        uSSS: { value: params?.cloudSSS ?? 0.8 },
        uBrightness: { value: (params?.cloudBrightness ?? 2.9) * 0.42 },
        uSunDir: { value: this.sunDir.clone() },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uAmbColor: { value: new THREE.Color(0.32, 0.35, 0.4) },
        uNight: { value: 0 },
        uTime: { value: 0 },
        uWind: { value: new THREE.Vector2(0.42, 0.42) },
        uElongAngle: { value: elongAngle(params) },
        uSkyHi: { value: new THREE.Color(1, 1, 1) },
        uSkyLo: { value: new THREE.Color(0.82, 0.85, 0.9) },
        uTexMix: { value: params?.cloudTexMix ?? 0.35 },
        uBillow: { value: params?.cloudBillow ?? 0.8 },
        uCoverage: { value: params?.cloudCoverage ?? 0.9 },
        uTerrainTex: { value: hf.tex },
        // ⚠️ LE CHAMP DE HAUTEURS EST EN COORDONNÉES DE CHAMP, LE FRAGMENT EN
        // COORDONNÉES DE GÉOMÉTRIE : `uMapMin` porte la conversion, et c'est
        // LUI qui défile (`setFenetre`). Le nuage, lui, appartient au CIEL —
        // c'est la fenêtre, il ne bouge pas. Ce qui doit suivre, c'est le
        // relief qu'il consulte pour savoir où il est occlus.
        uMapMin: { value: new THREE.Vector2(-hf.span / 2, -hf.span / 2) },
        uMapSize: { value: new THREE.Vector2(hf.span, hf.span) },
        uTerrainMin: { value: hf.min },
        uTerrainRange: { value: hf.range },
        uWaterY: { value: -9999 },
      },
    })

    const mesh = new THREE.InstancedMesh(geo, mat, MAX_INSTANCES)
    mesh.frustumCulled = false // les boîtes bougent chaque frame, l'AABB du mesh mentirait
    // APRÈS TOUTES les couches drapées de la carte. Le premier correctif (19)
    // ne passait que la mer animée (18) et laissait encore l'eau OSM drapée
    // (LAKE_RENDER_ORDER = 26, water-layer.js) repasser par-dessus : « l'eau et
    // la mer passent à travers les nuages comme s'ils n'existaient pas ».
    // 30 = au-dessus de tout ce qui est posé sur le relief.
    mesh.renderOrder = 30
    mesh.count = sky.clouds.length
    this.mesh = mesh
    this.group.add(mesh)
    this._writeInstances()
    this._bakeShadow()
    // le champ vient d'être recuit : remet `uMapMin` sur la fenêtre courante,
    // sinon une reconstruction pendant un défilement repartirait à zéro
    this.setFenetre(this.terrain?.fenetre?.x ?? 0, this.terrain?.fenetre?.z ?? 0)
  }

  // Le décalage de fenêtre du mode continu — DEUX FLOTTANTS par pas, rien de
  // plus. Le champ de hauteurs couvre l'emprise entière et ne se recuit jamais
  // pendant le geste ; c'est la LECTURE qui se déplace.
  setFenetre(x, z) {
    const u = this.mesh?.material?.uniforms
    if (!u?.uMapMin) return
    const half = (u.uMapSize.value.x || TERRAIN_SIZE) / 2
    u.uMapMin.value.set(-half - x, -half - z)
  }

  // Écrit les matrices d'instance, TRIÉES de l'arrière vers l'avant : un
  // InstancedMesh ne trie pas ses instances, et deux nuages transparents qui se
  // recouvrent dans le mauvais ordre laissent une couture visible.
  // ⚠️ `camPos` EST EN UNITÉS DE BLOC, comme les nuages — Tâche R20. Le tri
  // arrière→avant compare des distances : mélanger deux espaces le rendrait
  // muet (un InstancedMesh ne trie pas, et deux nuages transparents dans le
  // mauvais ordre laissent une couture). Hors mode sphère c'est exactement
  // `camera.position`.
  _writeInstances(camPos = null) {
    const mesh = this.mesh
    if (!mesh || !this.sky) return
    const list = this.sky.clouds
    if (camPos) {
      const cx = camPos.x, cy = camPos.y, cz = camPos.z
      list.sort((a, b) =>
        ((b.x - cx) ** 2 + (b.y - cy) ** 2 + (b.z - cz) ** 2) -
        ((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2))
    }
    const info = this._info
    let n = 0
    for (const c of list) {
      const dens = cloudDensity(c)
      if (dens <= 0.01) continue // né à l'instant ou mort : rien à dessiner
      const s = cloudScale(c)
      // la boîte est un peu plus large que la silhouette (BOX_PAD dans le
      // shader — les deux valeurs DOIVENT rester d'accord) : l'enveloppe
      // s'éteint avant le bord, donc aucun nuage n'est coupé net
      const pad = 2 * 1.15
      // BOÎTE ENGLOBANTE d'une ellipse TOURNÉE : les demi-axes conservent
      // l'aire (a·b = r²), la boîte reste axée sur le monde et le shader
      // retrouve a et b depuis elle — voir vAxes dans VERT.
      const e = Math.max(1, c.elong ?? 1)
      const th = elongAngle(this._params)
      const ct = Math.cos(th), st = Math.sin(th)
      const se = Math.sqrt(e)
      const a = c.r * se, b = c.r / se
      const rx = Math.hypot(a * ct, b * st)
      const rz = Math.hypot(a * st, b * ct)
      _m.makeScale(rx * pad * s, c.h * pad * s, rz * pad * s)
      _m.setPosition(c.x, c.y, c.z)
      mesh.setMatrixAt(n, _m)
      info.array[n * 4] = c.seed
      info.array[n * 4 + 1] = dens
      info.array[n * 4 + 2] = c.wisp ?? 0 // 0 = bord net, 1 = voile déchiqueté
      info.array[n * 4 + 3] = e
      n++
      if (n >= MAX_INSTANCES) break
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    info.needsUpdate = true
  }

  // Ombre au sol peinte DEPUIS LES ENTITÉS : chaque nuage projette son disque
  // adouci. Plus de miroir CPU de la formule de densité du shader — c'est la
  // même source de vérité, donc les ombres ne peuvent plus diverger du ciel.
  _bakeShadow() {
    const N = SHADOW_N
    const px = this._shadowPx || (this._shadowPx = new Uint8Array(N * N))
    px.fill(0)
    const half = TERRAIN_SIZE / 2
    for (const c of this.sky.clouds) {
      const dens = cloudDensity(c)
      if (dens <= 0.02) continue
      const r = c.r * cloudScale(c)
      // empreinte en cellules — ELLIPSE tournée, la même que celle du shader :
      // un radeau 6:1 doit projeter une ombre en radeau, pas un disque
      const cx = ((c.x + half) / TERRAIN_SIZE) * N
      const cz = ((c.z + half) / TERRAIN_SIZE) * N
      const se = Math.sqrt(Math.max(1, c.elong ?? 1))
      const th = elongAngle(this._params)
      const ct = Math.cos(th), st = Math.sin(th)
      const ap = Math.max(((r * se) / TERRAIN_SIZE) * N, 1e-3)
      const bp = Math.max(((r / se) / TERRAIN_SIZE) * N, 1e-3)
      const ext = Math.max(ap, bp)
      const i0 = Math.max(0, Math.floor(cx - ext)), i1 = Math.min(N - 1, Math.ceil(cx + ext))
      const j0 = Math.max(0, Math.floor(cz - ext)), j1 = Math.min(N - 1, Math.ceil(cz + ext))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = i + 0.5 - cx, dz = j + 0.5 - cz
          const d = Math.hypot((dx * ct + dz * st) / ap, (-dx * st + dz * ct) / bp)
          if (d >= 1) continue
          // bord adouci : une ombre de nuage n'a pas de contour net
          const f = (1 - d * d) * (1 - d * d)
          const v = px[j * N + i] + f * dens * 205
          px[j * N + i] = v > 255 ? 255 : v
        }
      }
    }
    if (!this.shadowTex) {
      const tex = new THREE.DataTexture(px, N, N, THREE.RedFormat)
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
      tex.minFilter = tex.magFilter = THREE.LinearFilter
      this.shadowTex = tex
    }
    this.shadowTex.needsUpdate = true
    const mu = this.terrain?.mapUniforms
    if (mu?.uCloudShadow) mu.uCloudShadow.value = this.shadowTex
  }

  setSunDir(sunPos) {
    this.sunDir.copy(sunPos).normalize().negate()
    if (this.mesh) this.mesh.material.uniforms.uSunDir.value.copy(this.sunDir).negate()
  }

  // relayout complet — appelé quand la vue change de niveau
  reroll() {
    if (!this._params) return
    this._params.seaSeed = ((this._params.seaSeed | 0) + 977) % 99991
    this.build(this._params)
  }

  // ⚡ `camBloc` — LA CAMÉRA EN UNITÉS DE BLOC, Tâche R20. Sous le mode sphère
  // le groupe porte la similitude bloc → globe : `camera.position` n'est plus
  // dans l'espace où le ciel est décrit, et le nuanceur lance son rayon depuis
  // l'œil. `main.js` la calcule par `positionCameraEnBloc`. **Omise, on sert
  // `camera.position` — c'est-à-dire le comportement du dépôt, au bit près.**
  update(dt, params, camera, camBloc = null) {
    if (!this.mesh || !this.group.visible || !this.sky) return
    const u = this.mesh.material.uniforms
    const cam = camBloc ?? camera?.position ?? null
    if (cam) u.uCamBloc.value.set(cam.x, cam.y, cam.z)
    // vent : direction en degrés + force, réglables dans Éléments (phase 1) ;
    // la même donnée pilotera l'orographie en phase 2
    const dir = ((params?.windDir ?? 45) * Math.PI) / 180
    const speed = (params?.windSpeed ?? 0.6) * (params?.cloudDrift ?? 1) * 0.35
    stepSky(this.sky, Math.min(dt, 0.1), { wind: { dir, speed } })

    // Le peuplement suit le curseur de densité et le palier de perf — mais on
    // ne remet le compte à niveau QUE si la cible a changé. Le remettre à
    // chaque image supprimait l'enfant qu'une division venait de créer : les
    // nuages ne se divisaient jamais à l'écran. Le surplus se résorbe tout
    // seul, à la mort des morceaux (voir stepSky).
    const want = this._targetCount(params)
    if (this.sky.target !== want) resizeSky(this.sky, want)

    this._writeInstances(cam)
    u.uTime.value = this.sky.t
    // le niveau de l'eau bouge avec la carte (et vaut -9999 sans mer) : on le
    // relit du terrain a chaque image plutot que de le figer au build
    u.uWaterY.value = this.terrain?.mapUniforms?.uSeaY?.value ?? -9999
    // la sim a besoin du même plancher que le shader (sortie de mer, template)
    this.sky.opts.waterY = this.terrain?.mapUniforms?.uSeaY?.value ?? -Infinity
    // même vent que la sim, en vecteur : cisaillement de base + advection
    u.uWind.value.set(Math.cos(dir), Math.sin(dir)).multiplyScalar(Math.min(1.5, params?.windSpeed ?? 0.6))
    u.uElongAngle.value = dir // l'étirement suit le vent, en direct
    if (params) {
      u.uDensity.value = params.cloudOpacity ?? 1
      u.uScale.value = params.cloudScale ?? 3
      u.uContrast.value = params.cloudContrast ?? 1
      // le curseur est partagé avec l'ancien moteur, dont l'accumulation de
      // densité était plus faible : à valeur égale, v2 saturerait au blanc pur
      // (nuages « découpés dans du papier »). On le ramène à son échelle.
      u.uBrightness.value = (params.cloudBrightness ?? 2.9) * 0.42
      u.uSSS.value = params.cloudSSS ?? 0.8
      u.uTexMix.value = params.cloudTexMix ?? 0.35
      u.uBillow.value = params.cloudBillow ?? 0.8
      u.uCoverage.value = params.cloudCoverage ?? 0.9
      // Couleur du soleil selon SON ÉLÉVATION — même recette que l'ancien
      // système (palette sunLook partagée avec la mer et le terrain) : lumière
      // chaude quand le soleil rase, ambiante froide et sourde la nuit.
      const elev = params.sunElevation ?? 30
      const warmth = 1 - Math.min(1, Math.max(0, (elev - 6) / 26))
      const look = sunLook(elev)
      const dayF = 0.08 + 0.92 * look.dayLight
      u.uSunColor.value.setRGB(1, 1 - 0.45 * warmth, 1 - 0.68 * warmth)
      _moonTint.setRGB(0.45, 0.55, 0.78)
      u.uSunColor.value.lerp(_moonTint, look.night * 0.85).multiplyScalar(dayF)
      u.uNight.value = look.night ?? 0
      u.uAmbColor.value.setRGB(0.5 + 0.1 * warmth, 0.56 - 0.06 * warmth, 0.66 - 0.14 * warmth)
      u.uAmbColor.value.multiplyScalar((0.28 - 0.1 * warmth) * (0.12 + 0.88 * look.dayLight))
      // teintes du ciel depuis les couleurs de fond : premier stop = haut du
      // dégradé (sommets), dernier = horizon (bases). Parsées seulement quand
      // le fond change — pas de conversion hex par frame.
      const stops = normalizeBgStops(params)
      const bgKey = stops[0].c + stops[stops.length - 1].c
      if (bgKey !== this._bgKey) {
        this._bgKey = bgKey
        u.uSkyHi.value.set(stops[0].c)
        u.uSkyLo.value.set(stops[stops.length - 1].c)
      }
    }
    // l'ombre au sol se rafraîchit à la cadence du système météo, pas à celle
    // du rendu : les nuages naissent et meurent, un bake figé mentirait
    this._shadowT += dt
    if (this._shadowT >= SHADOW_EVERY) {
      this._shadowT = 0
      this._bakeShadow()
      this._syncShadowStrength(params)
    }
  }

  _syncShadowStrength(params) {
    const mu = this.terrain?.mapUniforms
    if (!mu?.uCloudShadowK) return
    const up = Math.max(0, -this.sunDir.y)
    // Dosage : l'ombre doit se voir sans écraser la carte. Elle a été montée
    // (« je ne vois pas d'ombre »), puis redescendue (« baisse l'opacité ») —
    // ce niveau-ci va de pair avec la TEINTE : une ombre colorée se lit bien
    // plus qu'un voile noir, donc elle a besoin de moins de force.
    mu.uCloudShadowK.value = this.group.visible ? Math.min(0.46, 0.14 + up * 0.4) : 0
    // teinte d'ombre = celle de la carte (même recette que le SSAO)
    if (mu.uCloudShadowTint) {
      _shadowTint.set(deriveAoColor(this._params ?? {}))
      mu.uCloudShadowTint.value.set(_shadowTint.r, _shadowTint.g, _shadowTint.b)
    }
    if (mu.uCloudShadowOff) {
      // décalage de l'ombre le long de la pente du soleil : plus il rase, plus
      // l'ombre s'éloigne du nuage
      const slant = Math.min(2.5, 0.35 / Math.max(0.14, up))
      const drop = (this._params?.cloudAltitude ?? 4.5) * slant
      const len = Math.hypot(this.sunDir.x, this.sunDir.z) || 1
      mu.uCloudShadowOff.value.set(
        (this.sunDir.x / len) * drop / TERRAIN_SIZE,
        (this.sunDir.z / len) * drop / TERRAIN_SIZE
      )
    }
    // la mer reçoit la MÊME ombre que le relief : « projeter sur l'élément
    // affiché le plus élevé de toutes les couches du sol » (Adrien)
    this._pushShadowToSea()
  }

  // La mer a son propre matériau : on lui pousse la texture d'ombre et les
  // mêmes réglages, sinon un nuage survolant le lac ne projette rien.
  _pushShadowToSea() {
    const mu = this.terrain?.mapUniforms
    const sea = this._seaUniforms
    if (!sea || !mu) return
    if (sea.uCloudShadow) sea.uCloudShadow.value = this.shadowTex
    if (sea.uCloudShadowK) sea.uCloudShadowK.value = mu.uCloudShadowK.value
    if (sea.uCloudShadowOff) sea.uCloudShadowOff.value.copy(mu.uCloudShadowOff.value)
  }

  // main.js branche ici les uniforms du matériau de mer quand elle existe
  attachSea(uniforms) {
    this._seaUniforms = uniforms || null
    this._pushShadowToSea()
  }

  setVisible(v) {
    this.group.visible = !!v
    const mu = this.terrain?.mapUniforms
    if (!v && mu?.uCloudShadowK) mu.uCloudShadowK.value = 0
  }

  // même champ de hauteurs que l'ancien système : 256², quantifié 8 bits sur sa
  // propre amplitude (filtrable partout, contrairement à une texture flottante)
  //
  // ══════════ EN MODE CONTINU, IL COUVRE L'EMPRISE ═══════════════════════════
  //
  // Le relief que ce champ décrit sert à DEUX choses : l'occlusion du rayon dans
  // le shader (un nuage ne se dessine pas dans la montagne) et le plancher sous
  // lequel rien ne vit. Cuit sur la fenêtre, il devenait FAUX dès le premier
  // pas de défilement — le nuage aurait été occlus par une crête qui n'est plus
  // là. On le cuit donc une fois sur l'emprise entière, en coordonnées de
  // CHAMP, et c'est `uMapMin` qui défile (étude §5.2, « uMapMin qui défile »).
  //
  // ⚠️ LA RÉSOLUTION NE TRIPLE PAS AVEC L'EMPRISE. À densité égale il faudrait
  // 768², soit 590 000 appels à `terrain.sample` — mesuré ci-dessous, c'est le
  // genre de gel qu'on vient de sortir du fil principal pour les lacs. 384²
  // couvre neuf fois la surface pour 2,25 fois les points : 0,44 unité par
  // texel contre 0,22. À cette échelle un nuage fait 2 à 6 unités de large : sa
  // silhouette d'occlusion ne bouge pas d'un pixel.
  _bakeHeightfield() {
    const cote = this.terrain?.dem?.empriseCote > 1 ? this.terrain.dem.empriseCote : 1
    const N = cote > 1 ? 384 : 256
    const span = TERRAIN_SIZE * cote
    const sample = this.terrain?.sample
    const half = span / 2
    // ⚠️ `terrain.sample` PARLE EN COORDONNÉES DE GÉOMÉTRIE : il ajoute lui-même
    // le décalage. On le retranche pour que `(x, z)` soit bien une coordonnée
    // de CHAMP — sans quoi le champ cuit ne serait pas celui de l'emprise mais
    // celui d'une emprise décalée d'une fenêtre.
    const fen = this.terrain?.fenetre ?? { x: 0, z: 0 }
    const heights = new Float32Array(N * N)
    let min = Infinity, max = -Infinity
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -half + ((i + 0.5) / N) * span
        const z = -half + ((j + 0.5) / N) * span
        const h = sample ? sample(x - fen.x, z - fen.z) : 0
        const v = Number.isFinite(h) ? h : 0
        heights[j * N + i] = v
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    const range = Math.max(max - min, 1e-3)
    const data = new Uint8Array(N * N)
    for (let k = 0; k < data.length; k++) data[k] = Math.round(((heights[k] - min) / range) * 255)
    this._heightTex?.dispose()
    const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat)
    tex.magFilter = tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    this._heightTex = tex
    return { tex, min, range, span }
  }

  _dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.mesh.material.dispose()
      this.group.remove(this.mesh)
      this.mesh = null
    }
  }
}
