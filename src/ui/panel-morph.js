// Morph partagé boutique/studio — #app se recadre en vitrine (CSS pilotée par
// modeClass) pendant qu'une colonne glisse. transitionend peut ne jamais venir
// (onglet caché → zéro frame → transitions gelées) : fallback timeout 750ms,
// le morph se « pose » quoi qu'il arrive et le renderer reprend la bonne box.
export function makeMorph({ modeClass, onSettle }) {
  let t = 0
  const settle = () => {
    clearTimeout(t)
    document.body.classList.remove('morph-anim')
    onSettle?.()
  }
  document.getElementById('app').addEventListener('transitionend', (e) => {
    if (e.target.id === 'app' && document.body.classList.contains('morph-anim')) settle()
  })
  return {
    enter() {
      document.body.classList.add('morph-anim', modeClass)
      clearTimeout(t)
      t = setTimeout(settle, 750)
    },
    exit() {
      document.body.classList.add('morph-anim')
      document.body.classList.remove(modeClass)
      clearTimeout(t)
      t = setTimeout(settle, 750)
    },
  }
}
