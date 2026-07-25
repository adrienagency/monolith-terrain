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
import { bakeCloudVolume } from './clouds.js'
import { createSky, stepSky, resizeSky, cloudDensity, cloudScale, cloudCountForTier } from './clouds-sim.js'

const MAX_INSTANCES = 32 // plafond dur du buffer ; le peuplement réel est adaptatif
const SHADOW_N = 96 // résolution du bake d'ombre au sol
const SHADOW_EVERY = 0.25 // s — un système météo n'a pas besoin de 60 Hz

const _moonTint = new THREE.Color()
const _m = new THREE.Matrix4()
const _v = new THREE.Vector3()

// ------------------------------------------------------------------ shader
const VERT = /* glsl */ `
  out vec3 vWorldPos;
  flat out vec3 vCenter;
  flat out vec3 vHalf;
  flat out vec3 vInfo;   // x = graine, y = densité (vie incluse), z = filandreux

  in vec3 iInfo;

  void main() {
    // les bornes du nuage se DÉRIVENT de la matrice d'instance (translation +
    // échelle, jamais de rotation) : pas d'attribut redondant à tenir à jour
    vCenter = instanceMatrix[3].xyz;
    vHalf = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)) * 0.5;
    vInfo = iInfo;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler3D;
  #define PI 3.14159265359
  #define MARCH_STEPS 26
  #define SUN_STEPS 3
  #define UP_STEPS 2
  #define LOBES 7
  // marge de la boîte autour de la silhouette — DOIT valoir la même chose que
  // le facteur de mise à l'échelle des instances (_writeInstances)
  #define BOX_PAD 1.15

  in vec3 vWorldPos;
  flat in vec3 vCenter;
  flat in vec3 vHalf;
  flat in vec3 vInfo;
  out vec4 outColor;

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
  // relief : sert à l'occlusion (le rayon s'arrête dans la montagne)
  uniform sampler2D uTerrainTex;
  uniform vec2 uMapMin;
  uniform vec2 uMapSize;
  uniform float uTerrainMin;
  uniform float uTerrainRange;

  float sat(float v) { return clamp(v, 0.0, 1.0); }

  vec3 hash31(float p) {
    vec3 q = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yxz + 33.33);
    return fract((q.xxy + q.yzz) * q.zyx);
  }

  // union LISSE de deux distances (metaball) : c'est elle qui soude les lobes
  // en une seule masse au lieu de laisser des boules collées
  float smin(float a, float b, float k) {
    float h = sat(0.5 + 0.5 * (b - a) / k);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Les LOBES d'un nuage, tirés de sa graine — construits UNE fois par
  // fragment (pas par pas de marche : ce serait 26× plus cher).
  //
  // C'est LA correction du retour d'Adrien : « ils ont tous la même forme
  // ronde, seule la taille change ». Un cumulus n'est pas un ellipsoïde, c'est
  // un amas de bourgeons. Chaque nuage tire son propre nombre effectif de
  // lobes, son étalement, sa verticalité — deux nuages n'ont jamais la même
  // silhouette, même à taille égale.
  void buildLobes(float seed, float wisp, out vec4 lobes[LOBES], out vec3 stretch[LOBES]) {
    vec3 c = hash31(seed * 0.717 + 3.1);
    float spread = 0.34 + c.x * 0.62;   // largeur de l'amas
    float rise = 0.10 + c.y * 0.60;     // tendance à bourgeonner vers le haut
    // asymétrie franche : le nuage penche d'un côté, comme sous le vent —
    // c'est ce qui casse le plus efficacement l'impression de boule
    float leanA = c.z * 6.28318;
    vec2 lean = vec2(cos(leanA), sin(leanA)) * (0.10 + c.x * 0.26);
    for (int i = 0; i < LOBES; i++) {
      vec3 h = hash31(seed + float(i) * 17.31 + 0.5);
      vec3 g = hash31(seed * 1.37 + float(i) * 5.11);
      // chaque lobe est une PRIMITIVE DIFFÉRENTE (sphère, galette, fuseau) :
      // c'est la « fusion de plusieurs formes » demandée — des ellipsoïdes
      // étirés au hasard soudés ensemble ne peuvent pas lire comme une boule
      stretch[i] = vec3(0.75 + g.x * 0.7, 0.9 + g.y * 1.1, 0.75 + g.z * 0.7);
      if (i == 0) {
        // le corps principal, posé bas : c'est lui qui porte la base plate
        lobes[0] = vec4(0.0, -0.16, 0.0, 0.42 + c.z * 0.15);
        stretch[0] = vec3(1.0, 1.05 + c.y * 0.5, 1.0);
        continue;
      }
      float a = h.x * 6.28318 + float(i) * 1.7;
      float ring = spread * (0.30 + h.y * 0.95);
      // certains lobes sont franchement petits (h.z bas) : c'est ce qui crée
      // les épaules et les bosses irrégulières plutôt qu'une couronne régulière
      float r = 0.11 + h.z * h.z * 0.32;
      float y = -0.24 + h.y * rise + r * 0.5;
      // les nuages filandreux étalent leurs lobes à l'horizontale et les
      // aplatissent : un voile n'a pas de bourgeons, il a des lambeaux
      // (« flat » est un mot RÉSERVÉ en GLSL 3 — qualificateur d interpolation)
      float squash = 1.0 + wisp * 1.1;
      vec2 xz = vec2(cos(a), sin(a)) * ring * (1.0 + wisp * 0.5) + lean;
      // ⚠️ ANTI-CARRÉ : un lobe qui sort de la boîte de calcul se fait TRANCHER
      // par elle — c'était les « nuages carrés » d'Adrien. Le centre est borné
      // pour que centre + rayon + bruit restent toujours dans la boîte.
      float lim = 0.70 - r;
      float l = length(xz);
      if (l > lim) xz *= lim / l;
      // ÉVOLUTION : chaque lobe respire à son rythme (croît, se résorbe,
      // repousse ailleurs) — le nuage crée des protubérances à différents
      // endroits au fil du temps au lieu d'être figé dans sa graine
      float ph = h.y * 6.28318;
      float breathe = 1.0 + 0.22 * sin(uTime * (0.05 + h.z * 0.06) + ph);
      lobes[i] = vec4(xz.x, y / squash, xz.y, r * breathe);
      stretch[i].y *= squash;
    }
  }

  float terrainH(vec2 xz) {
    vec2 uv = (xz - uMapMin) / uMapSize;
    return uTerrainMin + texture(uTerrainTex, clamp(uv, 0.0, 1.0)).r * uTerrainRange;
  }

  vec2 boxSpan(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
    vec3 t0 = (bmin - ro) / rd;
    vec3 t1 = (bmax - ro) / rd;
    vec3 ts = min(t0, t1);
    vec3 tb = max(t0, t1);
    return vec2(max(max(ts.x, ts.y), ts.z), min(min(tb.x, tb.y), tb.z));
  }

  // Densité DANS un nuage. Modèle enveloppe (Nubis) : une macro-forme lisse —
  // ellipsoïde à base plate et sommet bombé — que le bruit vient éroder. C'est
  // l'enveloppe qui donne la silhouette de cumulus ; le bruit ne fait que la
  // ronger, il ne la définit pas (l'erreur de l'ancien système).
  float densityAt(vec3 wp, vec4 lobes[LOBES], vec3 stretch[LOBES]) {
    // ⚠️ la BOÎTE est plus large que le nuage (BOX_PAD, pour que l'enveloppe
    // s'éteigne avant le bord) : sans ce facteur, l'enveloppe se calcule sur la
    // boîte, le profil vertical ne s'applique jamais et le nuage redevient un
    // pavé aux angles rongés.
    vec3 p = (wp - vCenter) / vHalf * BOX_PAD;

    // silhouette = union lisse des lobes (SDF metaball). C'est ce qui donne des
    // épaules, des bosses, des creux — une forme PROPRE à chaque nuage.
    float wisp = vInfo.z;
    float d = 1e9;
    for (int i = 0; i < LOBES; i++) {
      // ellipsoïde : l'étirement par lobe fait des primitives toutes
      // différentes, l'union lisse les soude en une seule masse.
      // ⚠️ la division par le plus grand facteur est OBLIGATOIRE : sans elle un
      // lobe très étiré rend une « distance » plusieurs fois trop grande, le
      // seuil de sortie coupe tout et le nuage disparaît purement et
      // simplement (c'est ce qui a vidé le ciel au premier essai).
      vec3 s = stretch[i];
      vec3 q = (p - lobes[i].xyz) * s;
      float dl = (length(q) - lobes[i].w) / max(s.x, max(s.y, s.z));
      d = smin(d, dl, 0.20 + wisp * 0.14);
    }
    // sortie franche dès qu'on est loin de la masse : inutile de payer le bruit
    if (d > 0.45) return 0.0;

    // Le bruit DÉPLACE la surface au lieu de la gommer. C'est la différence
    // entre un chou-fleur et un ballon flou : en soustrayant le bruit à la
    // distance signée, chaque bosse du bruit devient un vrai bourgeon de la
    // silhouette. Trois octaves ; les nuages filandreux se font DÉCHIQUETER
    // bien plus fort (amplitude ×2.4) — c'est ce qui donne les lambeaux.
    vec3 coord = (wp * uScale + vInfo.x) * 0.055;
    float n1 = texture(uVolume, fract(coord)).r;
    float n2 = texture(uVolume, fract(coord * 3.1 + 0.37)).r;
    float n3 = texture(uVolume, fract(coord * 7.7 + 0.81)).r;
    float amp = 1.0 + wisp * 1.4;
    d += ((0.5 - n1) * 0.30 + (0.5 - n2) * 0.12 + (0.5 - n3) * 0.05) * amp;

    // seuil SERRÉ : c'est le bruit qui doit dessiner le bord, pas un
    // dégradé de 2 unités monde qui transforme tout en coton
    float env = 1.0 - smoothstep(-0.05, 0.09 + wisp * 0.10, d);
    if (env <= 0.002) return 0.0;
    // base FRANCHE pour un cumulus (coupé net au niveau de condensation) mais
    // molle pour un voile, qui n'a pas de base du tout
    env *= smoothstep(-0.60, mix(-0.42, -0.10, wisp), p.y);
    // CEINTURE anti-carré : quoi qu'aient fait les lobes et le bruit, la
    // densité s'éteint AVANT la paroi de la boîte — aucune tranche possible
    float wall = max(abs(p.x), max(abs(p.y), abs(p.z)));
    env *= 1.0 - smoothstep(0.88, 1.06, wall);

    // OPACITÉ PAR ÉPAISSEUR (Adrien) : très opaque au cœur, presque rien sur
    // les bords fins — la non-linéarité creuse l'écart au lieu de tout lisser
    float dens = pow(env, uContrast);
    dens *= mix(0.30, 1.55, smoothstep(0.12, 0.8, env));
    // jamais de nuage collé à l'objectif
    dens *= smoothstep(1.5, 4.0, distance(wp, cameraPosition));
    return dens * uDensity * vInfo.y;
  }

  float beer(float d) { return exp(-d); }

  float henyeyGreenstein(float g, float cosA) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosA, 1.5));
  }

  // approximation multi-octave du multiple scattering (Wrenninge, SIGGRAPH
  // 2015) : on ré-évalue la même profondeur avec des coefficients atténués
  // plutôt que de tracer des chemins supplémentaires
  float scatter(float depth, float cosA) {
    float lum = 0.0, a = 1.0, b = 1.0, g = 0.45;
    for (int o = 0; o < 3; o++) {
      float phase = mix(henyeyGreenstein(g, cosA), henyeyGreenstein(-g * 0.5, cosA), 0.4) + 0.24;
      lum += b * phase * beer(depth * a);
      a *= 0.45; b *= 0.55; g *= 0.85;
    }
    return lum;
  }

  // Épaisseur de matière entre l'échantillon et le soleil — c'est elle qui fait
  // que les PROTUBÉRANCES projettent leur ombre sur la masse en dessous
  // (demande d'Adrien) : un bourgeon éclairé se détache d'un creux à l'ombre.
  float sunDepth(vec3 wp, vec3 toSun, vec3 bmin, vec3 bmax, vec4 lobes[LOBES], vec3 stretch[LOBES]) {
    // pas COURT devant la taille du nuage : un pas long ressort du nuage dès le
    // premier échantillon, tout paraît mince et le nuage vire au blanc plat
    float step = min(vHalf.x, vHalf.y) * 0.26;
    float d = 0.0;
    for (int j = 1; j <= SUN_STEPS; j++) {
      vec3 s = wp + toSun * (step * float(j));
      if (any(lessThan(s, bmin)) || any(greaterThan(s, bmax))) break;
      d += densityAt(s, lobes, stretch) * step;
      if (d >= 2.2) break;
    }
    return d;
  }

  // Épaisseur de matière AU-DESSUS de l'échantillon. La lumière du ciel tombe
  // du haut : plus il y a de nuage au-dessus, moins elle atteint le point —
  // c'est ce qui assombrit naturellement la base des nuages ÉPAIS et laisse
  // claires les galettes minces (demande explicite d'Adrien, à la place de
  // l'ancien dégradé vertical arbitraire).
  float depthAbove(vec3 wp, vec3 bmax, vec4 lobes[LOBES], vec3 stretch[LOBES]) {
    float step = vHalf.y * 0.3;
    float d = 0.0;
    for (int j = 1; j <= UP_STEPS; j++) {
      vec3 s = wp + vec3(0.0, step * float(j), 0.0);
      if (s.y > bmax.y) break;
      d += densityAt(s, lobes, stretch) * step;
    }
    return d;
  }

  void main() {
    vec3 bmin = vCenter - vHalf;
    vec3 bmax = vCenter + vHalf;
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorldPos - cameraPosition);
    vec2 span = boxSpan(ro, rd, bmin, bmax);
    span.x = max(span.x, 0.0);
    if (span.y <= span.x) discard;

    // occlusion par le relief AVANT le nuage : une crête entre la caméra et la
    // boîte cache tout ce qu'il y a derrière
    for (int i = 1; i <= 8; i++) {
      vec3 wp = ro + rd * (span.x * float(i) / 8.0);
      if (wp.y < terrainH(wp.xz)) discard;
    }

    // les lobes de CE nuage, une seule fois pour tout le rayon
    vec4 lobes[LOBES];
    vec3 stretch[LOBES];
    buildLobes(vInfo.x, vInfo.z, lobes, stretch);

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
    float camDist = distance(cameraPosition, vCenter);
    int steps = camDist < max(vHalf.x, vHalf.y) * 2.5 ? 12 : MARCH_STEPS;

    float dt = (span.y - span.x) / float(steps);
    float transmittance = 1.0;
    vec3 light = vec3(0.0);

    for (int i = 0; i < MARCH_STEPS; i++) {
      if (i >= steps) break;
      vec3 wp = ro + rd * (span.x + (float(i) + jitter) * dt);
      if (wp.y < terrainH(wp.xz)) break; // le rayon plonge dans la montagne
      float d = densityAt(wp, lobes, stretch);
      if (d <= 0.002) continue;
      float depth = sunDepth(wp, toSun, bmin, bmax, lobes, stretch);
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
      float above = depthAbove(wp, bmax, lobes, stretch);
      vec3 skyLight = uAmbColor * (0.16 + 0.84 * exp(-above * 1.7));
      vec3 col = sun + sss + skyLight;
      // LA NUIT (Adrien : « tes nuages deviennent lumineux ») : un nuage ne
      // produit aucune lumière — sans lune ni ville, c'est une MASSE PLUS
      // SOMBRE QUE LE CIEL, au mieux argentée d'un soupçon de lune froide.
      // On écrase la luminance vers un gris-bleu très sombre ; l'ombrage
      // interne (ratios sun/sss/skyLight) reste intact, seul le niveau chute.
      col = mix(col, col * vec3(0.10, 0.12, 0.16) + vec3(0.006, 0.008, 0.013), uNight);
      float stepTrans = exp(-d * dt * 1.2);
      light += col * (1.0 - stepTrans) * transmittance;
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
    // le curseur « Densité » du panneau module aussi le PEUPLEMENT, pas
    // seulement l'opacité : plus dense = plus de nuages, ce que l'œil attend
    const density = params?.cloudOpacity != null ? 0.5 + params.cloudOpacity * 0.6 : 1
    return Math.min(MAX_INSTANCES, cloudCountForTier(this._tier, density))
  }

  build(params) {
    this._params = params
    this._dispose()
    const vol = bakeCloudVolume()
    const hf = this._bakeHeightfield()
    const half = TERRAIN_SIZE / 2

    // le ciel vit au-dessus des sommets mais assez bas pour que les crêtes le
    // percent — c'est la rencontre relief/nuages, cœur de la phase 2
    const baseY = (params?.cloudAltitude ?? 4.5)
    const sky = createSky({
      count: this._targetCount(params),
      seed: (params?.seaSeed ?? 1) | 0 || 1,
      half: half * 0.92,
      baseY,
      topY: baseY + 4,
      sizeMin: 2.2,
      sizeMax: 6.0,
    })
    this.sky = sky

    const geo = new THREE.BoxGeometry(1, 1, 1)
    const info = new Float32Array(MAX_INSTANCES * 3)
    geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(info, 3))
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
        uTerrainTex: { value: hf.tex },
        uMapMin: { value: new THREE.Vector2(-half, -half) },
        uMapSize: { value: new THREE.Vector2(TERRAIN_SIZE, TERRAIN_SIZE) },
        uTerrainMin: { value: hf.min },
        uTerrainRange: { value: hf.range },
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
  }

  // Écrit les matrices d'instance, TRIÉES de l'arrière vers l'avant : un
  // InstancedMesh ne trie pas ses instances, et deux nuages transparents qui se
  // recouvrent dans le mauvais ordre laissent une couture visible.
  _writeInstances(camera = null) {
    const mesh = this.mesh
    if (!mesh || !this.sky) return
    const list = this.sky.clouds
    if (camera) {
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z
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
      _m.makeScale(c.r * pad * s, c.h * pad * s, c.r * pad * s)
      _m.setPosition(c.x, c.y, c.z)
      mesh.setMatrixAt(n, _m)
      info.array[n * 3] = c.seed
      info.array[n * 3 + 1] = dens
      info.array[n * 3 + 2] = c.wisp ?? 0 // 0 = bord net, 1 = voile déchiqueté
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
      // empreinte en cellules
      const cx = ((c.x + half) / TERRAIN_SIZE) * N
      const cz = ((c.z + half) / TERRAIN_SIZE) * N
      const rp = (r / TERRAIN_SIZE) * N
      const i0 = Math.max(0, Math.floor(cx - rp)), i1 = Math.min(N - 1, Math.ceil(cx + rp))
      const j0 = Math.max(0, Math.floor(cz - rp)), j1 = Math.min(N - 1, Math.ceil(cz + rp))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz) / Math.max(rp, 1e-3)
          if (d >= 1) continue
          // bord adouci : une ombre de nuage n'a pas de contour net
          const f = (1 - d * d) * (1 - d * d)
          const v = px[j * N + i] + f * dens * 210
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

  update(dt, params, camera) {
    if (!this.mesh || !this.group.visible || !this.sky) return
    const u = this.mesh.material.uniforms
    // vent : direction en degrés + force, réglables dans Éléments (phase 1) ;
    // la même donnée pilotera l'orographie en phase 2
    const dir = ((params?.windDir ?? 45) * Math.PI) / 180
    const speed = (params?.windSpeed ?? 0.6) * (params?.cloudDrift ?? 1) * 0.35
    stepSky(this.sky, Math.min(dt, 0.1), { wind: { dir, speed } })

    // le peuplement suit le curseur de densité et le palier de perf
    const want = this._targetCount(params)
    if (this.sky.clouds.length !== want) resizeSky(this.sky, want)

    this._writeInstances(camera)
    u.uTime.value = this.sky.t
    if (params) {
      u.uDensity.value = params.cloudOpacity ?? 1
      u.uScale.value = params.cloudScale ?? 3
      u.uContrast.value = params.cloudContrast ?? 1
      // le curseur est partagé avec l'ancien moteur, dont l'accumulation de
      // densité était plus faible : à valeur égale, v2 saturerait au blanc pur
      // (nuages « découpés dans du papier »). On le ramène à son échelle.
      u.uBrightness.value = (params.cloudBrightness ?? 2.9) * 0.42
      u.uSSS.value = params.cloudSSS ?? 0.8
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
    // Adrien : « je ne vois pas d'ombre au sol ». L'ancienne loi (up × 0.42)
    // tombait à 0.10 dès que le soleil descendait — invisible. Un plancher
    // garde l'ombre lisible à toute heure : soleil bas = ombres LONGUES et
    // décalées, pas absentes.
    mu.uCloudShadowK.value = this.group.visible ? Math.min(0.55, 0.16 + up * 0.5) : 0
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
  _bakeHeightfield() {
    const N = 256
    const sample = this.terrain?.sample
    const half = TERRAIN_SIZE / 2
    const heights = new Float32Array(N * N)
    let min = Infinity, max = -Infinity
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -half + ((i + 0.5) / N) * TERRAIN_SIZE
        const z = -half + ((j + 0.5) / N) * TERRAIN_SIZE
        const h = sample ? sample(x, z) : 0
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
    return { tex, min, range }
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
