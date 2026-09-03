// Évalué DANS la page par scripts/capture-b5.mjs : lit au GPU chaque tuile prête
// autour de (LAT, LON) et compte les texels à 0 exact, <0, >0.
(() => {
  const e = window.__exp, g = e.globe, gl = e.renderer.getContext(), props = e.renderer.properties
  const lat = window.__b5lat, lon = window.__b5lon
  const n = (z) => Math.pow(2, z)
  const wx = (z) => ((lon + 180) / 360) * n(z)
  const wy = (z) => { const r = lat * Math.PI / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n(z) }
  const out = []
  for (const t of g.tiles.values()) {
    if (t.state !== 'ready' || !t.texture || !t.mesh || t.z < 11) continue
    if (Math.abs(t.x + 0.5 - wx(t.z)) > 2.5 || Math.abs(t.y + 0.5 - wy(t.z)) > 2.5) continue
    const p = props.get(t.texture), gt = p && p.__webglTexture
    if (!gt) continue
    const px = t.size, fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gt, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); continue }
    const a = new Uint8Array(px * px * 4)
    gl.readPixels(0, 0, px, px, gl.RGBA, gl.UNSIGNED_BYTE, a)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb)
    let z0 = 0, neg = 0, pos = 0, ras = 0; const bins = { '-0.5..0': 0, '-5..-0.5': 0, '-20..-5': 0, '-100..-20': 0, '<-100': 0 }; let mn = Infinity
    for (let i = 0; i < px * px; i++) { const h = a[i * 4] * 256 + a[i * 4 + 1] + a[i * 4 + 2] / 256 - 32768; if (h === 0) z0++; else if (h < 0) { neg++; if (h > -0.5) ras++; if (h < mn) mn = h; bins[h > -0.5 ? '-0.5..0' : h > -5 ? '-5..-0.5' : h > -20 ? '-20..-5' : h > -100 ? '-100..-20' : '<-100']++ } else pos++ }
    const ud = t.mesh.userData && t.mesh.userData.tuile; const mat = t.mesh.material; const ku = mat && mat.uniforms ? Object.keys(mat.uniforms).filter(k=>/crop|Crop|dans|Dans|habOn|HabOn/.test(k)).map(k=>k+'='+JSON.stringify(mat.uniforms[k].value && mat.uniforms[k].value.isVector4 ? [mat.uniforms[k].value.x,mat.uniforms[k].value.y,mat.uniforms[k].value.z,mat.uniforms[k].value.w] : mat.uniforms[k].value)).join(' ') : ''; const matId = mat ? mat.uuid.slice(0,6) : null; const udk = ud ? Object.keys(ud).filter(k=>/crop|Crop|dans/i.test(k)).map(k=>k+'='+JSON.stringify(ud[k])).join(' ') : ''; const mu = t.mesh.material && t.mesh.material.uniforms
    const photoOn = ud ? ud.uPhotoOn : (mu && mu.uPhotoOn ? mu.uPhotoOn.value : null)
    out.push({ z: t.z, x: t.x, y: t.y, px, z0, neg, pos, ras, visible: t.mesh.visible, bins, min: mn, matId, ku, udk, crop: g._crop ? { cx: g._crop.cx, cy: g._crop.cy, demi: g._crop.demi, zoom: g._crop.zoom } : null, photoOn, photoMonde: g.uniforms.uPhotoMonde ? g.uniforms.uPhotoMonde.value : null })
  }
  return out
})()
