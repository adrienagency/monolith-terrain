// LES MODES DE MÉLANGE — une seule écriture, deux nuanceurs. Tâche P3.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il ne porte QUE du texte GLSL, et
// `test/crop-eclairage.test.js` vérifie que ni `terrain.js` ni `globe.js` n'en
// gardent une seconde copie.
//
// (Pas d'accent GRAVE dans le bloc `/* glsl */` : il vit dans un template
// literal JS et le terminerait.)
//
// ══════════ POURQUOI CE FICHIER EXISTE ═════════════════════════════════════
//
// ⚠️ **`blLum` / `blClip` / `blSetLum` ÉTAIENT DÉJÀ ÉCRITS DEUX FOIS** — une
// fois dans `terrain.js` (« Appearance blend modes »), une fois dans `globe.js`
// (« blLum / blClip / blSetLum — terrain.js:886 »), avec le commentaire « une
// seconde écriture de ces formules finirait par diverger de la première ». La
// Tâche P2 a fermé cette dette pour le peigné ; celle-ci la ferme pour le
// mélange, et pour la raison qui l'oblige : **le crop doit porter la couche
// « Apparence », et cette couche EST un mode de mélange.**
//
// ⚡ **ET LA COUCHE APPARENCE N'EST PAS UNE OPTION EXOTIQUE — LE GABARIT
// D'OUVERTURE L'ALLUME.** `public/templates/defaults/shibustart.json` pose
// `look.surfaceFx = 9`. Relevé dans l'application vivante le 2026-08-22 :
// `uSurfaceFx = 9`, `uFxOpacity = 0,44`, `uFxBlend = 2` (Multiply),
// `uFxColA = #14161d`.
//
// ⛔ **CE QUE ÇA PÈSE, MESURÉ, ET PERSONNE NE L'AVAIT NOMMÉ** : socle rendu avec
// un albédo forcé à BLANC (`material.color` = 1, `vertexColors` coupé,
// `uTint = 0`) sous un hémisphère blanc d'irradiance 1, donc un pixel qui devrait
// valoir exactement `1 / PI` :
//
//   · couche Apparence ALLUMÉE  → **0,591 · 0,575 · 0,571**
//   · couche Apparence ÉTEINTE  → **0,997 · 0,997 · 0,997**
//
// **Elle multiplie l'albédo du socle par 0,59 et le teinte.** Un portage de
// l'éclairage qui l'aurait ignorée rendait un crop **1,7 fois trop clair** —
// c'est ce que la première version de la Tâche P3 a mis à l'écran, et c'est la
// mesure qui l'a dit, pas la lecture du code.
//
// ⚠️ **`natSoftLight` VIENT DE `naturel-crop.js`** (mode 10), qui doit donc être
// injecté AVANT ce texte-ci dans les deux nuanceurs.

export const GLSL_MELANGE = /* glsl */ `
// --- Appearance blend modes (Figma / W3C compositing set) — b = backdrop map,
// s = the shader colour. Separable ops are channel-wise; the last four are the
// non-separable HSL modes. ---
float blLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 blClip(vec3 c) { float l = blLum(c); float mn = min(min(c.r, c.g), c.b); float mx = max(max(c.r, c.g), c.b);
  if (mn < 0.0) c = l + (c - l) * l / (l - mn + 1e-5);
  if (mx > 1.0) c = l + (c - l) * (1.0 - l) / (mx - l + 1e-5);
  return clamp(c, 0.0, 1.0); }
vec3 blSetLum(vec3 c, float l) { return blClip(c + (l - blLum(c))); }
float blSat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 blSetSat(vec3 c, float s) { float mn = min(min(c.r, c.g), c.b), mx = max(max(c.r, c.g), c.b);
  return mx > mn ? (c - mn) / (mx - mn) * s : vec3(0.0); }
vec3 blHard(vec3 b, vec3 s) { return mix(b + s - b * s - (1.0 - 2.0 * s) * b, b * 2.0 * s, step(s, vec3(0.5))); }
vec3 fxBlend(vec3 b, vec3 s, int m) {
  if (m == 1) return min(b, s);                                  // Darken
  if (m == 2) return b * s;                                      // Multiply
  if (m == 3) return max(vec3(0.0), b + s - 1.0);                // Plus darker (linear burn)
  if (m == 4) return 1.0 - min(vec3(1.0), (1.0 - b) / max(s, 1e-4)); // Colour burn
  if (m == 5) return max(b, s);                                  // Lighten
  if (m == 6) return b + s - b * s;                              // Screen
  if (m == 7) return min(vec3(1.0), b + s);                      // Plus lighter (linear dodge)
  if (m == 8) return min(vec3(1.0), b / max(1.0 - s, 1e-4));     // Colour dodge
  if (m == 9) return blHard(s, b);                               // Overlay (hard-light swapped)
  if (m == 10) return natSoftLight(b, s);                        // Soft light — voir naturel-crop.js
  if (m == 11) return blHard(b, s);                              // Hard light
  if (m == 12) return abs(b - s);                                // Difference
  if (m == 13) return b + s - 2.0 * b * s;                       // Exclusion
  if (m == 14) return blSetLum(blSetSat(s, blSat(b)), blLum(b)); // Hue
  if (m == 15) return blSetLum(blSetSat(b, blSat(s)), blLum(b)); // Saturation
  if (m == 16) return blSetLum(s, blLum(b));                     // Colour
  if (m == 17) return blSetLum(b, blLum(s));                     // Luminosity
  return s;                                                      // Normal
}
`

/**
 * Les défauts MONDE de la couche Apparence : ÉTEINTE.
 *
 * ⚠️ **MÊME GARDE ET MÊME RAISON QUE `uCropOn`, `uHabOn` ET `uEclairageOn`** :
 * le nuanceur des tuiles est partagé par toutes les tuiles du globe. Sans
 * `poserHabillage`, `uSurfaceFx` vaut 0 et le bloc n'est pas exécuté — la vue
 * orbitale en production rend au bit près ce qu'elle rendait.
 */
export const APPARENCE_MONDE = Object.freeze({
  surfaceFx: 0,
  fxBlend: 0,
  fxOpacity: 0,
  fxScale: 1,
  fxTime: 0,
  fxColA: '#000000',
  fxColB: '#000000',
  fxColC: '#000000',
  fxP1: 0,
  fxP2: 0,
  fxP3: 0,
  // le demi-côté du bloc, en unités de scène — `uSlabHalf` du socle. C'est lui
  // qui convertit `qCrop` (±1) en la coordonnée de sol que `champXZ()` donne à
  // `terrain.js`, et l'en-tête de `habillage-crop.js` en porte la démonstration.
  fxDemiBloc: 28,
  fxFenetreX: 0,
  fxFenetreY: 0,
})
