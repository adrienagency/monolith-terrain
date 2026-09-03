// Évalué dans la page : un transect nord→sud dans la tuile z13 sous (lat,lon) :
//   · la texture FUSIONNÉE telle que le GPU la tient (readPixels),
//   · le terrarium BRUT (la même tuile, redemandée à sa source, décodée ici).
(async () => {
  const e = window.__exp, g = e.globe, gl = e.renderer.getContext(), props = e.renderer.properties
  const lat = window.__b5lat, lon = window.__b5lon
  const n = Math.pow(2, 13)
  const wx = ((lon + 180) / 360) * n
  const r = lat * Math.PI / 180, wy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n
  const tx = Math.floor(wx), ty = Math.floor(wy)
  const t = [...g.tiles.values()].find((q) => q.z === 13 && q.x === tx && q.y === ty && q.state === 'ready' && q.texture)
  if (!t) return { erreur: 'tuile z13/' + tx + '/' + ty + ' pas prête' }
  const px = t.size
  const p = props.get(t.texture), gt = p && p.__webglTexture
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gt, 0)
  const a = new Uint8Array(px * px * 4); gl.readPixels(0, 0, px, px, gl.RGBA, gl.UNSIGNED_BYTE, a)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb)
  const col = Math.floor((wx - tx) * px)
  // ligne 0 du readPixels = SUD ; on remonte du nord au sud
  const fusion = []
  for (let l = px - 1; l >= 0; l -= 8) { const i = (l * px + col) * 4; fusion.push(+(a[i] * 256 + a[i + 1] + a[i + 2] / 256 - 32768).toFixed(1)) }
  // le brut : la même tuile, à sa source
  const src = e.demSources ? null : null
  const url = (window.__b5url || 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp').replace('{z}', 13).replace('{x}', tx).replace('{y}', ty)
  let brut = null, statut = null
  try {
    const rep = await fetch(url); statut = rep.status
    if (rep.ok) {
      const bm = await createImageBitmap(await rep.blob())
      const c = document.createElement('canvas'); c.width = c.height = bm.width
      const ctx = c.getContext('2d'); ctx.drawImage(bm, 0, 0)
      const d = ctx.getImageData(0, 0, bm.width, bm.height).data
      const cb = Math.floor((wx - tx) * bm.width)
      brut = []
      for (let l = 0; l < bm.height; l += Math.round(8 * bm.width / px)) { const i = (l * bm.width + cb) * 4; brut.push(+(d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768).toFixed(1)) }
    }
  } catch (err) { brut = String(err) }
  return { tuile: 'z13/' + tx + '/' + ty, px, col, url, statut, fusionNordSud: fusion, brutNordSud: brut }
})()
