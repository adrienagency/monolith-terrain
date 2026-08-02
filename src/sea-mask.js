// OCEAN MASK — which sea-level cells are REALLY the sea.
//
// At coarse zoom the resampled DEM drops scattered cells a hair below 0 m
// inland (coastal averaging, tile artefacts). Painted purely by "height <
// sea level" they read as phantom lakes and inlets that don't exist. The fix
// is topological, not a threshold tweak: the true ocean is the below-sea
// region CONNECTED to the map border. A flood fill from the edges marks it;
// every other below-sea pocket is land (a small valley), UNLESS it's a
// genuinely large basin (Caspian, Dead Sea) that deserves its blue — those
// are kept by an area test.
//
// Output: a size×size Uint8 mask (255 = real sea) the terrain shader ANDs
// with its height test. Pure over the DEM, unit-testable.
//
// landMask (optionnel) : Uint8Array(size²) alignée sur dem.data, 255 = TERRE
// d'après le trait de côte vectoriel (coast-mask.js). Une cellule déclarée
// terre ne peut être ni mer ni chemin du flood fill — c'est ce qui sauve les
// polders : sous 0 m ET connectés au bord (Pays-Bas) ou en bassin ≥2 %
// (Flevoland), la topologie seule les prenait pour la mer. CONTRAT : sans
// landMask, résultat bit-à-bit identique à avant.
//
// ⚠️ SI TU ARRIVES ICI PARCE QUE « DE L'EAU RENTRE DANS LES TERRES », MESURE
// D'ABORD LE TRAIT DE CÔTE AVANT D'ACCUSER LA MER. Fait à Brest le 2026-08-02,
// sur le bloc vivant : le masque côtier déclare 37,78 % du bloc en mer, et de
// ces 891 375 cellules **88 seulement (0,01 %) portent plus de 20 m de
// relief** — il ne remonte donc PAS dans les vallées. En peignant la rampe
// océan en magenta, la mer s'arrête exactement au goulet, à la rade et au port.
// La part de terre déclarée par le trait de côte et peinte en eau par la mer
// est NULLE.
//
// L'eau fautive venait des PLANS D'EAU D'ALTITUDE (ocean.js, src/lake.js), qui
// ont leur propre détecteur et ne consultent ni ce masque ni le trait de côte.
// Vérifié par extinction : masquer le groupe `real-water-lacs` fait disparaître
// exactement les dentelles bleu pâle, et rien d'autre. Leur garde-fou est dans
// src/plan-eau.js. Ce module-ci ne peut mouiller QUE des cellules sous le
// niveau de la mer : au-dessus, `underwater` est faux dans terrain.js quoi
// qu'il dise. Une nappe bleue sur un plateau à 90 m ne vient jamais d'ici.

// Le seuil de « grand bassin », en FRACTION du champ : une poche basse non
// connectée au bord reste mer si elle occupe au moins ça. C'est ce qui sauve la
// Caspienne et la mer Morte, et c'est le piège Flevoland que
// test/sea-mask.test.js verrouille.
//
// ⚠️ EXPORTÉ PARCE QU'IL SE CONVERTIT. Sur une emprise 3×3, le champ compte neuf
// fois plus de cellules, donc la même fraction exige neuf fois la même surface
// absolue : l'appelant passe alors fracBassinEmprise(BASSIN_FRAC_DEFAUT, 3)
// (dem-emprise.js). Le DÉFAUT, lui, ne bouge pas — deux tests en dépendent.
export const BASSIN_FRAC_DEFAUT = 0.02

export function buildSeaMask(dem, { seaLevelM = 0.5, minBasinFrac = BASSIN_FRAC_DEFAUT, landMask = null } = {}) {
  const { data, size } = dem
  const n = size * size
  const isLow = new Uint8Array(n) // 1 = at/below sea level (et pas terre du masque)
  for (let i = 0; i < n; i++) isLow[i] = data[i] <= seaLevelM && !(landMask && landMask[i]) ? 1 : 0

  const label = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  const areas = [] // per-component cell count
  const touchesBorder = [] // per-component: reachable from an edge
  let comp = 0

  for (let start = 0; start < n; start++) {
    if (!isLow[start] || label[start] !== -1) continue
    let top = 0
    stack[top++] = start
    label[start] = comp
    let area = 0
    let border = false
    while (top > 0) {
      const i = stack[--top]
      area++
      const x = i % size
      const y = (i / size) | 0
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) border = true
      // 4-neighbourhood flood over connected low cells
      if (x > 0 && isLow[i - 1] && label[i - 1] === -1) (label[i - 1] = comp), (stack[top++] = i - 1)
      if (x < size - 1 && isLow[i + 1] && label[i + 1] === -1) (label[i + 1] = comp), (stack[top++] = i + 1)
      if (y > 0 && isLow[i - size] && label[i - size] === -1) (label[i - size] = comp), (stack[top++] = i - size)
      if (y < size - 1 && isLow[i + size] && label[i + size] === -1) (label[i + size] = comp), (stack[top++] = i + size)
    }
    areas.push(area)
    touchesBorder.push(border)
    comp++
  }

  // a component is "real sea" if it reaches the border, or it's a big basin
  const minBasin = Math.max(64, Math.round(n * minBasinFrac))
  const seaComp = new Uint8Array(comp)
  for (let c = 0; c < comp; c++) seaComp[c] = touchesBorder[c] || areas[c] >= minBasin ? 1 : 0

  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = isLow[i] && seaComp[label[i]] ? 255 : 0
  return { mask, size }
}

// Rééchantillonne le masque côtier rasterisé ({data,width,height}, un octet
// par texel, >127 = terre) à la grille du DEM → la landMask que buildSeaMask
// attend. Plus-proche-voisin : le masque source (2048²) est plus fin que tout
// DEM de l'app, et la ligne 0 du champ (nord) correspond à la ligne 0 du DEM —
// même convention que le sampler GPU (flipY off). Pure, testable en node
// (aucun DOM requis).
//
// ⚠️ FOULÉE DE 1, PAS DE 4. Le masque côtier était une ImageData RGBA dont
// seul le canal R portait de l'information ; il est désormais un Uint8Array R8
// unique, partagé avec la DataTexture du GPU (voir coast-mask.js). C'est le
// même contenu, indexé sans le facteur 4 — trois copies de 16,78 Mo devenues
// une de 4,19 sur le bloc central.
export function landMaskFromField(field, size) {
  const { data, width, height } = field
  const out = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    const py = Math.min(height - 1, ((y * height) / size) | 0)
    const row = py * width
    for (let x = 0; x < size; x++) {
      const px = Math.min(width - 1, ((x * width) / size) | 0)
      out[y * size + x] = data[row + px] > 127 ? 255 : 0
    }
  }
  return out
}

// small separable box blur (radius r) so the coastline reads smooth under the
// shader's 0.5 threshold instead of a stair-stepped DEM edge
export function blurMask({ mask, size }, r = 1) {
  const n = size * size
  const tmp = new Float32Array(n)
  const out = new Uint8Array(n)
  const w = 2 * r + 1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0
      for (let dx = -r; dx <= r; dx++) {
        const xx = Math.min(size - 1, Math.max(0, x + dx))
        s += mask[y * size + xx]
      }
      tmp[y * size + x] = s / w
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0
      for (let dy = -r; dy <= r; dy++) {
        const yy = Math.min(size - 1, Math.max(0, y + dy))
        s += tmp[yy * size + x]
      }
      out[y * size + x] = Math.round(s / w)
    }
  }
  return { mask: out, size }
}
