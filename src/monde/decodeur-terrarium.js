// LE DÉCODAGE DES TUILES HORS DU FIL PRINCIPAL — PF2, la cinquième technique
// de Cesium (« le décodage ne touche pas le fil principal »).
//
// ⚠️ MESURÉ AVANT (profil-pf2, microbanc dans la page, RTX 3080, machine
// partagée) : dépaqueter une tuile terrarium sur le fil principal coûte
// **4 ms en 256² (AWS) et 6,5 ms en 512² (Mapterhorn)** — `drawImage`,
// `getImageData`, puis la boucle `r × 256 + g + b / 256 − 32 768` sur 65 536 ou
// 262 144 pixels. Six réponses qui tombent dans la même image font 25 à 40 ms
// de fil principal, c'est-à-dire deux images perdues ; à ×4 de ralentissement
// CPU, chaque tuile à elle seule dépasse le budget de 16,7 ms.
//
// Ce module tourne dans un Worker (`new Worker(new URL(...), { type: 'module' })`,
// que vite empaquète) : il reçoit l'ImageBitmap (CLONÉ, jamais transféré — la
// mémoire de tuiles le partage avec le damier), le dessine dans un
// OffscreenCanvas (surzoom compris, la même sous-fenêtre que `fetchTile`), lit
// les hauteurs et rend un ImageBitmap prêt pour la texture, plus le
// Float32Array — tous deux TRANSFÉRÉS, sans copie.
//
// ⚠️ `hauteursTerrarium` est LA formule, exportée : `fetchTile` (repli sans
// Worker, et les bancs sous node) et le Worker lisent la même fonction. Une
// formule recopiée deux fois diverge en silence (§1 de /threejs-optimisation).

/**
 * Dépaquette une dalle RGBA terrarium en mètres.
 * @param {Uint8ClampedArray} rgba  px × px × 4 octets
 * @param {number} px
 * @param {Float32Array} [out]  px × px, alloué si absent
 * @returns {Float32Array}
 */
export function hauteursTerrarium(rgba, px, out = new Float32Array(px * px)) {
  const n = px * px
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i] = rgba[j] * 256 + rgba[j + 1] + rgba[j + 2] / 256 - 32768
  }
  return out
}

// ⚠️ Le corps du Worker ne s'installe QUE dans un Worker : sous node (les
// tests) et sur le fil principal, ce module n'est qu'une fonction pure.
if (typeof self !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = (ev) => {
    const { id, bitmap, px, scale, ox, oy } = ev.data
    try {
      const c = new OffscreenCanvas(px, px)
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!(scale > 1)) ctx.drawImage(bitmap, 0, 0)
      else {
        // SURZOOM : la sous-fenêtre de l'ancêtre, comme `fetchTile` et `src/dem.js`
        const s = px / scale
        ctx.drawImage(bitmap, ox * px, oy * px, s, s, 0, 0, px, px)
      }
      const rgba = ctx.getImageData(0, 0, px, px).data
      const heights = hauteursTerrarium(rgba, px)
      const image = c.transferToImageBitmap()
      self.postMessage({ id, heights, image }, [heights.buffer, image])
    } catch (err) {
      self.postMessage({ id, erreur: String(err?.message || err) })
    } finally {
      bitmap?.close?.() // c'est un CLONE : le fermer ne touche pas l'original
    }
  }
}
