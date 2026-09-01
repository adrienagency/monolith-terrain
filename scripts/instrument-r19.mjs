// L'INSTRUMENT DE R18, EXTRAIT POUR ETRE PARTAGE PAR LES SONDES R19.
// Une seule ecriture : deux jumeaux auraient diverge, et les chiffres de deux
// scripts ne seraient plus comparables.
export function poserInstrument(LARG, HAUT) {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  if (window.__r19) return 'déjà posé'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const etages = []
  function construireEtages() {
    for (const f of etages) { gl.deleteFramebuffer(f.fbo); gl.deleteRenderbuffer(f.rb) }
    etages.length = 0
    let w = CV.width, h = CV.height
    for (let i = 0; i < 12; i++) {
      const nw = Math.max(LARG, w >> 1)
      const nh = Math.max(HAUT, h >> 1)
      const rb = gl.createRenderbuffer()
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, nw, nh)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb)
      etages.push({ fbo, rb, w: nw, h: nh })
      w = nw; h = nh
      if (nw === LARG && nh === HAUT) break
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  }
  const px = new Uint8Array(LARG * HAUT * 4)
  function condense() {
    if (!etages.length || etages[0].w * 2 < CV.width) construireEtages()
    let srcFbo = null, sw = CV.width, sh = CV.height
    for (const et of etages) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, et.fbo)
      gl.blitFramebuffer(0, 0, sw, sh, 0, 0, et.w, et.h, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      srcFbo = et.fbo; sw = et.w; sh = et.h
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
    gl.readPixels(0, 0, LARG, HAUT, gl.RGBA, gl.UNSIGNED_BYTE, px)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    R.resetState?.()
    const t = new Array(LARG * HAUT * 3)
    for (let i = 0, j = 0; i < LARG * HAUT; i++) { t[j++] = px[i * 4]; t[j++] = px[i * 4 + 1]; t[j++] = px[i * 4 + 2] }
    return t
  }
  const N = LARG * HAUT * 3
  const etat = { n: 0, slots: {}, LARG, HAUT }
  window.__r19 = etat
  const tampon = []
  function boucle() {
    try {
      tampon.push(Float32Array.from(condense()))
      if (tampon.length > 24) tampon.shift()
      etat.n++
    } catch (err) { etat.erreur = String(err).slice(0, 120) }
    requestAnimationFrame(boucle)
  }
  function gradientDe(moy) {
    const g = new Float32Array(LARG * HAUT)
    const lum = new Float32Array(LARG * HAUT)
    for (let i = 0; i < LARG * HAUT; i++) lum[i] = 0.299 * moy[i * 3] + 0.587 * moy[i * 3 + 1] + 0.114 * moy[i * 3 + 2]
    for (let y = 0; y < HAUT; y++) for (let x = 0; x < LARG; x++) {
      const i = y * LARG + x
      const dx = x + 1 < LARG ? Math.abs(lum[i + 1] - lum[i]) : 0
      const dy = y + 1 < HAUT ? Math.abs(lum[i + LARG] - lum[i]) : 0
      g[i] = dx + dy
    }
    return g
  }
  etat.vider = () => { tampon.length = 0; etat.n = 0 }
  etat.pret = (k) => tampon.length >= k
  etat.capturer = (nom, k) => {
    const im = tampon.slice(-k)
    const moy = new Float32Array(N)
    for (const t of im) for (let i = 0; i < N; i++) moy[i] += t[i]
    for (let i = 0; i < N; i++) moy[i] /= im.length
    etat.slots[nom] = { moy, grad: gradientDe(moy) }
    return im.length
  }
  etat.distance = (a, b) => {
    const A = etat.slots[a], B = etat.slots[b]
    if (!A || !B) return null
    let sm = 0
    for (let i = 0; i < N; i++) sm += Math.abs(A.moy[i] - B.moy[i])
    let sg = 0
    for (let i = 0; i < LARG * HAUT; i++) sg += Math.abs(A.grad[i] - B.grad[i])
    return { moy: sm / N, grad: sg / (LARG * HAUT) }
  }
  requestAnimationFrame(boucle)
  return 'posé'
}
