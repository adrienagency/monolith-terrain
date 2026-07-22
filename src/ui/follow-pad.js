// Contrôles caméra du GPX follow — CLAVIER UNIQUEMENT depuis le retour Adrien :
// le pavé 3x3 à l'écran « ne sert à rien lors de la lecture du trail et bloque
// l'accès aux autres panneaux » — supprimé. Les raccourcis restent (numpad 1-9
// = vues fixes autour de la tête, 5 = top-down, +/- zoom, flèches tilt/orbite)
// et sont documentés dans l'overlay des raccourcis. La molette zoome aussi
// pendant le suivi (voir modes.js followWheel).

let keyHandler = null

export function showFollowPad(drone) {
  hideFollowPad()
  keyHandler = (e) => {
    // never steal keys from an input field
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return
    const d = e.code.startsWith('Numpad') ? e.code.slice(6) : e.code.startsWith('Digit') ? e.code.slice(5) : null
    if (d && d >= '1' && d <= '9') { drone.setView(+d); e.preventDefault(); return }
    if (e.key === '+' || e.code === 'NumpadAdd') { drone.zoomBy(1 / 1.18); e.preventDefault(); return }
    if (e.key === '-' || e.code === 'NumpadSubtract') { drone.zoomBy(1.18); e.preventDefault(); return }
    if (e.code === 'ArrowUp') { drone.tiltBy(6); e.preventDefault(); return }
    if (e.code === 'ArrowDown') { drone.tiltBy(-6); e.preventDefault(); return }
    // held arrows auto-repeat: a smooth continuous orbit for free
    if (e.code === 'ArrowLeft') { drone.rotateBy(-6); e.preventDefault(); return }
    if (e.code === 'ArrowRight') { drone.rotateBy(6); e.preventDefault() }
  }
  document.addEventListener('keydown', keyHandler)
}

export function hideFollowPad() {
  if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null }
}
