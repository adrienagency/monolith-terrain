// Panneau LUMIÈRE (table lumineuse — demande Adrien « continue avec la
// lumière ») : le chapitre manquant de la recette, entre Matières et
// Éléments. L'HEURE reste la maîtresse (elle recalcule le vrai soleil du
// lieu — daycycle.js) ; les curseurs manuels reprennent la main APRÈS elle,
// et bouger l'heure les réécrit — même sémantique que les templates.
// (Les anciens « six curseurs soleil » avaient été retirés pour ne garder
// que la tirette 24 h ; ils reviennent ici rangés, pas en vrac.)

import { slider, section, el } from './kit.js'
import { Panel } from './shell.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/></svg>'

export function buildLightPanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Lumière',
    icon: ICON,
    side: 'right',
    width: 268,
    tip: 'Le soleil et l’ambiance — l’heure pilote, les curseurs affinent.',
  })

  const sSun = panel.addSection(section('Soleil', { open: true }))
  sSun.body.append(
    slider({ label: 'Heure', min: 0, max: 24, step: 0.1, get: () => params.timeOfDay ?? 10, set: (v) => { ctx.applyTimeOfDay(v); ctx.syncHour?.() } }),
    el('div', 'ce-note', 'L’heure place le vrai soleil du lieu — les curseurs ci-dessous reprennent la main.'),
    slider({ label: 'Azimut', min: 0, max: 360, step: 1, get: () => params.sunAzimuth, set: (v) => { params.sunAzimuth = v; ctx.placeSun() } }),
    slider({ label: 'Élévation', min: 2, max: 90, step: 1, get: () => params.sunElevation, set: (v) => { params.sunElevation = v; ctx.placeSun() } }),
    slider({ label: 'Intensité du soleil', min: 0, max: 10, step: 0.1, get: () => params.sunIntensity, set: (v) => { params.sunIntensity = v; ctx.placeSun() } })
  )

  const sAmb = panel.addSection(section('Ambiance'))
  sAmb.body.append(
    slider({ label: 'Lumière ambiante', min: 0, max: 2, step: 0.02, get: () => params.hemiIntensity, set: (v) => { params.hemiIntensity = v; ctx.placeSun() } }),
    slider({ label: 'Éclairage d’environnement', min: 0, max: 1.5, step: 0.02, get: () => params.envLight, set: (v) => { params.envLight = v; ctx.setEnvLight(v) } }),
    slider({ label: 'Douceur des ombres', min: 0, max: 20, step: 0.5, get: () => params.shadowSoftness, set: (v) => { params.shadowSoftness = v; ctx.setShadowSoftness(v) } })
  )

  return panel
}
