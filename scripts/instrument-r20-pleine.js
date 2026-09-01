// INSTRUMENT R20 — COMPTAGE DE PIXELS À PLEINE RÉSOLUTION.
//
// ⛔ **PAS DE CONDENSÉ.** L'instrument de la première manche condensait en
// 256 × 160 et rendait une MOYENNE : un motif fin y survit mal, et ce dépôt a
// déjà produit un faux diagnostic avec un condensé 64 × 40 qui annulait des
// crêtes. Ici on lit **le tampon de dessin entier**, on compare pixel à pixel,
// et on COMPTE — une bouffée de nuage de 900 pixels sur 1 024 000 se voit,
// alors qu'elle pèse 0,0009 en moyenne et disparaît dans l'arrondi.
//
// ⚠️ **LE TÉMOIN DE LA TAILLE EST IMPRIMÉ** (`gl.drawingBufferWidth/Height`) :
// sans lui, un tampon qui ne serait pas celui qu'on croit rendrait un compte
// parfaitement crédible et faux.
(function () {
  const e = window.__exp
  const gl = e.renderer.getContext()
  const prises = new Map()

  function lire() {
    const w = gl.drawingBufferWidth
    const h = gl.drawingBufferHeight
    // on redessine soi-même : readPixels doit tomber sur une image FINIE
    e.composer.render(0)
    const px = new Uint8Array(w * h * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
    return { w, h, px }
  }

  window.__r20p = {
    // moyenne de N lectures ? non : une seule, l'image est figée (animations off)
    prendre(nom) {
      const p = lire()
      prises.set(nom, p)
      return { w: p.w, h: p.h, pixels: p.w * p.h }
    },
    // compte les pixels dont UN canal bouge de plus de `seuil`
    compter(a, b, seuil = 2) {
      const A = prises.get(a)
      const B = prises.get(b)
      if (!A || !B || A.w !== B.w || A.h !== B.h) return null
      let n = 0
      let somme = 0
      let pire = 0
      for (let i = 0; i < A.px.length; i += 4) {
        const d = Math.max(
          Math.abs(A.px[i] - B.px[i]),
          Math.abs(A.px[i + 1] - B.px[i + 1]),
          Math.abs(A.px[i + 2] - B.px[i + 2])
        )
        if (d > seuil) { n++; somme += d; if (d > pire) pire = d }
      }
      const total = A.w * A.h
      return {
        tampon: [A.w, A.h],
        totalPixels: total,
        pixelsTouches: n,
        pourcent: +((n / total) * 100).toFixed(4),
        deltaMoyenSurTouches: n ? +(somme / n).toFixed(2) : 0,
        deltaPire: pire,
      }
    },
    vider() { prises.clear() },
  }
})()
