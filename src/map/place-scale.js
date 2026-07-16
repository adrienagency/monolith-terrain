// Label scale factor from population (+ a capital bump) — used to size floating
// city-name sprites so bigger cities read bigger, with a sane floor so small
// towns and pop-less rows still stay legible, and a ceiling so megacities
// don't swallow the map.
export function labelScale(pop, capital) {
  const p = Math.max(0, pop || 0)
  const s = 0.7 + Math.min(1.6, (Math.log10(p + 10) / 7) * 1.6)
  return capital ? s * 1.25 : s
}
