// Section LUMIÈRE — vit dans le panneau ÉLÉMENTS (réorg Adrien : Éléments =
// Lumière / Nuages / Brume / Mer). L'HEURE reste la maîtresse (elle recalcule
// le vrai soleil du lieu — daycycle.js) ; les curseurs manuels reprennent la
// main APRÈS elle, et bouger l'heure les réécrit — même sémantique que les
// templates. Montée par buildEffectsPanel en tête d'Éléments.
//
// UX v2 (passe Éléments) : le réglage STAR est l'AMBIANCE — quatre chips
// (Aube / Midi / Heure dorée / Nuit) calculées pour le VRAI lieu du bloc
// (l'aube d'Annecy n'est pas celle de Patagonie), le curseur d'heure fin
// dessous, et la mécanique (azimut/élévation/intensités) reléguée en bas.
// Meta parlante repliée : « Heure dorée · 17h30 » + pastille couleur du soleil.

import { slider, section, el, color, toggle, onRefresh, refreshAll } from './kit.js'
import { lightingFor, sunPosition, solarHourToDate } from '../daycycle.js'

// heure formatée façon tirette (17h30, 19h) — pas de zéro de tête ni de
// minutes nulles : la meta est courte, elle ne doit pas tronquer
const fmtHour = (h) => {
  const mn = Math.round((h % 1) * 60)
  return `${Math.floor(h)}h${mn ? String(mn).padStart(2, '0') : ''}`
}

// Les quatre MOMENTS du lieu, calculés sur la vraie course du soleil (scan de
// la journée solaire par pas de 0,1 h — maths pures, ~240 appels, négligeable).
// Midi est 12 par construction (heure solaire) ; les autres se cherchent.
function computeMoments(lat, lon) {
  const elAt = (h) => sunPosition(solarHourToDate(h, lon), lat, lon).elevation
  const find = (from, to, pred, fallback) => {
    for (let h = from; h <= to; h += 0.1) if (pred(elAt(h))) return Math.round(h * 10) / 10
    return fallback
  }
  const aube = find(0, 12, (e) => e >= -1, 6.5) // le soleil crève l'horizon
  const doree = find(12.5, 24, (e) => e <= 6, 17.5) // il redescend sous 6°
  const nuit = find(doree, 24, (e) => e <= -8, 23) // nuit franche
  return [
    { id: 'aube', label: 'Aube', hour: aube },
    { id: 'midi', label: 'Midi', hour: 12 },
    { id: 'doree', label: 'Heure dorée', hour: doree },
    { id: 'nuit', label: 'Nuit', hour: nuit },
  ]
}

export function lightSection(ctx) {
  const { params } = ctx
  const s = section('Lumière')

  // moments recalculés quand le bloc change de lieu (cache par lat/lon)
  let momentsKey = ''
  let moments = []
  const momentsFor = () => {
    const key = `${(+params.demLat).toFixed(2)},${(+params.demLon).toFixed(2)}`
    if (key !== momentsKey) {
      momentsKey = key
      moments = computeMoments(params.demLat, params.demLon)
    }
    return moments
  }
  const setHour = (h) => {
    params.timeOfDay = h
    ctx.applyTimeOfDay(h)
    ctx.syncHour?.()
  }
  // Les trois intensités sont des GAINS, pas des valeurs absolues : elles
  // multiplient la lumière que le cycle calcule pour l'heure et le lieu, au
  // lieu de la remplacer. On repasse donc par applyTimeOfDay (et pas par
  // placeSun) — c'est lui qui recompose heure × gain. Avant, ces curseurs
  // écrivaient dans params.sunIntensity/hemiIntensity/envLight, les mêmes clés
  // qu'applyTimeOfDay réécrit : le réglage sautait au déplacement suivant.
  const setGain = (key, v) => {
    params[key] = v
    ctx.applyTimeOfDay(params.timeOfDay ?? 10)
  }

  // ---- le star : chips d'ambiance + curseur d'heure fin ----
  const chipRow = el('div', 'ce-chiprow')
  const chips = momentsFor().map((m, i) => {
    const b = el('button', 'ce-chip', m.label)
    b.type = 'button'
    b.setAttribute('data-tip', `Place le soleil du lieu à ${fmtHour(m.hour)} — l’heure vraie de ce moment ici.`)
    b.addEventListener('click', () => {
      setHour(momentsFor()[i].hour)
      refreshAll()
    })
    chipRow.append(b)
    return b
  })
  // chip active par PROXIMITÉ de l'heure courante (jamais d'état stocké)
  const activeMoment = () => momentsFor().find((m) => Math.abs((params.timeOfDay ?? 10) - m.hour) < 0.2)
  onRefresh(() => {
    const act = activeMoment()
    momentsFor().forEach((m, i) => {
      chips[i].classList.toggle('on', act === m)
      chips[i].setAttribute('data-tip', `Place le soleil du lieu à ${fmtHour(m.hour)} — l’heure vraie de ce moment ici.`)
    })
  }, chipRow)

  s.body.append(
    chipRow,
    slider({ label: 'Heure', min: 0, max: 24, step: 0.1, get: () => params.timeOfDay ?? 10, set: (v) => setHour(v) }),
    el('div', 'ce-note', 'L’heure place le vrai soleil du lieu ; les réglages ci-dessous s’appliquent par-dessus et ne se perdent plus quand tu déplaces la carte.'),

    // ---- la mécanique, au fond : soleil manuel puis ambiance ----
    el('div', 'ce-fx-head', 'Soleil manuel'),
    // ALLUMÉ par défaut : c'est la lumière principale. Éteint, il tombe à 0 et
    // rend sa carte d'ombre 2048² — il ne quitte pas la scène (voir main.js).
    // ⚠️ La PREMIÈRE extinction fige ~1,9 s : couper les ombres fait recompiler
    // les shaders, et c'est le comportement de three, pas de nous (mesuré
    // identique sur le code d'avant). Les bascules suivantes sont instantanées.
    toggle({ label: 'Soleil', get: () => params.sunEnabled !== false, set: (v) => { ctx.setSunEnabled(v); refreshAll() } }),
    slider({ label: 'Azimut', min: 0, max: 360, step: 1, get: () => params.sunAzimuth, set: (v) => { params.sunAzimuth = v; ctx.placeSun() } }),
    slider({ label: 'Élévation', min: 2, max: 90, step: 1, get: () => params.sunElevation, set: (v) => { params.sunElevation = v; ctx.placeSun() } }),
    slider({ label: 'Intensité du soleil', min: 0, max: 3, step: 0.02, get: () => params.sunGain ?? 1, set: (v) => setGain('sunGain', v) }),
    el('div', 'ce-fx-head', 'Ambiance'),
    slider({ label: 'Lumière ambiante', min: 0, max: 3, step: 0.02, get: () => params.hemiGain ?? 1, set: (v) => setGain('hemiGain', v) }),
    slider({ label: 'Éclairage d’environnement', min: 0, max: 3, step: 0.02, get: () => params.envGain ?? 1, set: (v) => setGain('envGain', v) }),
    slider({ label: 'Douceur des ombres', min: 0, max: 20, step: 0.5, get: () => params.shadowSoftness, set: (v) => { params.shadowSoftness = v; ctx.setShadowSoftness(v) } }),

    // ---- l'appoint : la lumière que l'heure ne pilote pas ----
    el('div', 'ce-fx-head', 'Appoint'),
    el('div', 'ce-note', 'Une seconde lumière, sans ombre, pour rouvrir un flanc bouché. Sa direction est relative au soleil : elle le suit sans jamais être écrasée.'),
    // ÉTEINT par défaut. Contrairement au soleil, celui-ci est gratuit dans les
    // deux sens (1,3 ms mesuré) : la lampe existe depuis le boot à intensité 0,
    // l'interrupteur ne fait que monter son intensité, donc rien ne recompile.
    toggle({ label: 'Appoint', get: () => params.fillEnabled === true, set: (v) => { ctx.setFillEnabled(v); refreshAll() } }),
    slider({ label: 'Intensité', min: 0, max: 3, step: 0.02, get: () => params.fillIntensity ?? 0, set: (v) => { params.fillIntensity = v; ctx.placeSun() } }),
    slider({ label: 'Écart au soleil', min: 0, max: 360, step: 1, get: () => params.fillAzimuthOffset ?? 150, set: (v) => { params.fillAzimuthOffset = v; ctx.placeSun() } }),
    slider({ label: 'Hauteur', min: -10, max: 90, step: 1, get: () => params.fillElevation ?? 20, set: (v) => { params.fillElevation = v; ctx.placeSun() } }),
    color({ label: 'Couleur', get: () => params.fillColor ?? '#ffcf9a', set: (v) => { params.fillColor = v; ctx.placeSun() } })
  )

  // meta parlante : le moment (chip active, sinon Jour/Crépuscule/Nuit) +
  // l'heure + la couleur actuelle du soleil en pastille
  const MODE_LABEL = { day: 'Jour', twilight: 'Crépuscule', night: 'Nuit' }
  onRefresh(() => {
    const h = params.timeOfDay ?? 10
    const look = lightingFor(h, params.demLat, params.demLon)
    const name = activeMoment()?.label ?? MODE_LABEL[look.mode] ?? 'Jour'
    s.setMeta(`${name} · ${fmtHour(h)}`, look.sunColor)
  }, s.head)

  return s
}
