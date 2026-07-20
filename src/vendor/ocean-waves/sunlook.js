// Le LOOK du cycle jour/nuit — la palette d'ocean-lab sous forme de fonction
// pure de l'élévation solaire VRAIE (degrés). Partagée entre la démo
// (OceanScene) et ShibuMap (daycycle.js + océan + nuages) : une seule source
// pour les couleurs du soleil, de l'ambiance et du ciel.
//
// Tout est continu (aucun branchement à seuil) : le raccord soleil→lune est
// un fondu sur [-6°, -1°], comme l'exige le rig de ShibuMap (un éclairage qui
// saute d'un coup se voit immédiatement sur le terrain).

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const SUN_WARM = [1.0, 0.38, 0.10];   // soleil rasant
const SUN_WHITE = [1.0, 0.97, 0.90];  // soleil haut
const MOON = [0.42, 0.53, 0.75];      // chroma lunaire (bleuté)
const AMB_NIGHT = [0.006, 0.009, 0.020];
const AMB_DAY = [0.22, 0.30, 0.38]; // étalonné dans la boucle visuelle du MVP
const HOR_NIGHT = [0.014, 0.025, 0.050];
const HOR_DAY = [0.52, 0.76, 0.92];
const DUSK_GLOW = [0.98, 0.40, 0.12];

export function sunLook(elevationDeg) {
  const el = elevationDeg;
  const sinEl = Math.sin((Math.max(-90, Math.min(90, el)) * Math.PI) / 180);

  const day = smoothstep(-2.3, 16.3, el);   // 0 à l'horizon-, 1 soleil franc
  const night = 1 - smoothstep(-6.9, 1.7, el);
  const dusk = Math.exp(-Math.pow(Math.abs(el) / 13.6, 2)); // lueur du crépuscule

  // lumière directionnelle : soleil chaud→blanc, fondu continu vers la lune
  // (poids lune 0 à el=-1°, 1 à el=-6° — aucun saut au raccord)
  const sunChroma = mix3(SUN_WARM, SUN_WHITE, smoothstep(0, 20.5, el));
  const sunScaled = sunChroma.map((c) => c * (0.2 + 1.1 * day));
  const moonScaled = MOON.map((c) => c * 0.13 * night); // étalonné (nuit MVP)
  const wMoon = smoothstep(1, 6, -el);
  const light = mix3(sunScaled, moonScaled, wMoon);

  const maxC = Math.max(light[0], light[1], light[2], 1e-4);
  const lightChroma = light.map((c) => c / maxC);

  const ambient = mix3(AMB_NIGHT, AMB_DAY, day);

  // teinte du ciel à l'horizon : nuit→jour + lueur chaude du crépuscule
  let skyTint = mix3(HOR_NIGHT, HOR_DAY, day);
  skyTint = skyTint.map((c, i) => Math.min(1, c + DUSK_GLOW[i] * dusk * 0.55));

  return {
    day,
    night,
    dusk,
    lightColor: light, // prémultipliée (chroma × échelle 0..~1.3)
    lightChroma,       // normalisée (pour un hex de couleur de lampe)
    ambient,
    skyTint,
    dayLight: day,
    caustStr: Math.max(sinEl, 0) * 1.15 + night * 0.05,
  };
}

export const toHex = (rgb) =>
  "#" +
  rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(1, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
