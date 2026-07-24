// Section LUMIÈRE — vit dans le panneau ÉLÉMENTS (réorg Adrien : Éléments =
// Lumière / Nuages / Brume / Mer). L'HEURE reste la maîtresse (elle recalcule
// le vrai soleil du lieu — daycycle.js) ; les curseurs manuels reprennent la
// main APRÈS elle, et bouger l'heure les réécrit — même sémantique que les
// templates. Montée par buildEffectsPanel en tête d'Éléments.

import { slider, section, el } from './kit.js'

export function lightSection(ctx) {
  const { params } = ctx
  const s = section('Lumière')
  s.body.append(
    el('div', 'ce-fx-head', 'Soleil'),
    slider({ label: 'Heure', min: 0, max: 24, step: 0.1, get: () => params.timeOfDay ?? 10, set: (v) => { ctx.applyTimeOfDay(v); ctx.syncHour?.() } }),
    el('div', 'ce-note', 'L’heure place le vrai soleil du lieu — les curseurs ci-dessous reprennent la main.'),
    slider({ label: 'Azimut', min: 0, max: 360, step: 1, get: () => params.sunAzimuth, set: (v) => { params.sunAzimuth = v; ctx.placeSun() } }),
    slider({ label: 'Élévation', min: 2, max: 90, step: 1, get: () => params.sunElevation, set: (v) => { params.sunElevation = v; ctx.placeSun() } }),
    slider({ label: 'Intensité du soleil', min: 0, max: 10, step: 0.1, get: () => params.sunIntensity, set: (v) => { params.sunIntensity = v; ctx.placeSun() } }),
    el('div', 'ce-fx-head', 'Ambiance'),
    slider({ label: 'Lumière ambiante', min: 0, max: 2, step: 0.02, get: () => params.hemiIntensity, set: (v) => { params.hemiIntensity = v; ctx.placeSun() } }),
    slider({ label: 'Éclairage d’environnement', min: 0, max: 1.5, step: 0.02, get: () => params.envLight, set: (v) => { params.envLight = v; ctx.setEnvLight(v) } }),
    slider({ label: 'Douceur des ombres', min: 0, max: 20, step: 0.5, get: () => params.shadowSoftness, set: (v) => { params.shadowSoftness = v; ctx.setShadowSoftness(v) } })
  )
  return s
}
