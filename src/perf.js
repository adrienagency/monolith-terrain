// AdaptiveQuality — automatic degraded mode ("mode downgradé") that keeps the
// app smooth on weak devices while preserving the visual read of the map.
//
// Four tiers, degrading in order of least visual damage:
//   T0 FULL      — everything as authored (desktop default)
//   T1 BALANCED  — pixelRatio ≤ 1.5, water-glass taps 6 → 4
//   T2 LIGHT     — pixelRatio 1.0, DoF pass off (user bokeh value kept),
//                  shadows frozen to 'static', glass taps → 2
//   T3 ESSENTIAL — pixelRatio 0.85, shadows off, film grain off. The cloud
//                  deck is NEVER touched — it is the identity of the scene.
//
// Trigger: rolling FPS average < 30 sustained ~2.5 s → down to the tier the
// MEASURE warrants (see palierVise — 3 fps goes straight to T3, not one crumb
// at a time). Recovery: average > 55 sustained 12 s → one tier up, never above
// the START tier (phones boot at T3 — they only ever run the shared-shibu
// viewer — tablets at T1, desktops at T0). Hysteresis: at least 20 s between
// any two automatic changes, and the FPS window is ignored for 5 s after boot
// and 2 s after any tier change / tab-visibility change, so load spikes and
// background throttling can never cause a step.
//
// ---------------------------------------------------------------------------
// ⚠️ CE GOUVERNEUR A ÉTÉ SOURD PENDANT DES MOIS, ET DEUX FOIS PLUTÔT QU'UNE
// ---------------------------------------------------------------------------
// Signalé le 28/07/2026 sur un iMac 27" de 2015 (Retina 5K, Chrome, macOS) :
// « l'ordi souffle à fond, environ 3 images par seconde ». Le mode dégradé
// existe exactement pour ce cas. Il n'a rien fait. Deux causes, indépendantes :
//
//   1. LE DELTA ARRIVAIT DÉJÀ BORNÉ. main.js calculait
//      `Math.min(clock.getDelta(), 0.05)` — plafond légitime pour la
//      SIMULATION, sans quoi une image à 2 s téléporte les bateaux — et passait
//      CE MÊME nombre ici. La moyenne mesurée ne pouvait donc pas descendre
//      sous 20 fps : 3 fps et 20 fps rendaient le même chiffre, donc la même
//      décision. Le garde-fou `dt > 0.5` plus bas, lui, était purement mort :
//      il ne pouvait jamais se déclencher. main.js passe désormais `dtBrut`.
//
//   2. LA FENÊTRE SE COMPTAIT EN IMAGES. 60 images avant tout verdict : 1 s à
//      60 fps, mais VINGT SECONDES à 3 fps. Avec les 5 s de boot, les 2,5 s
//      sous le seuil et les 20 s entre deux paliers, le premier palier tombait
//      à 27,5 s, le deuxième à 47,5 s, le troisième à 67,5 s. Ce sont les
//      47 secondes mesurées la veille sur portable, à la seconde près.
//
// La règle qui en sort, et qu'il faut garder en tête avant de toucher à ce
// fichier : PLUS LA MACHINE EST LENTE, PLUS LE GOUVERNEUR DOIT ÊTRE RAPIDE.
// C'est exactement l'inverse que faisait le code. Le nouveau chemin donne son
// premier verdict vers 9-10 s sur une machine à 3 fps, et il atterrit
// directement au palier plancher au lieu de descendre un cran par 20 s.
//
// Respecting the user: once the controller has changed tiers, each lever
// (render scale / shadows / DoF / grain) is watched with a dirty flag. If the
// user moves that control in the Camera panel afterwards, the observed value
// no longer matches what the controller wrote → the lever is marked dirty and
// the controller stops managing it forever (the other levers stay managed).
//
// Nothing is persisted.

import { applyRenderSize } from './viewport.js'
import { palierDeDepart, plafondDeRemontee } from './palier-machine.js'

const TIER_NAMES = ['FULL QUALITY', 'BALANCED MODE', 'LIGHT MODE', 'ESSENTIAL MODE']

// LA FENÊTRE EST UNE DURÉE, PAS UN COMPTE D'IMAGES. Une machine à 3 fps met
// 20 s à produire 60 images ; elle mettait donc 20 s à obtenir un verdict alors
// qu'elle est précisément celle qui en a besoin tout de suite. Deux conditions,
// et il faut les DEUX : assez de secondes (le signal est stable) et assez
// d'images (deux à-coups collés ne font pas une mesure).
export const FENETRE_S = 1.5 // s de signal minimum avant tout verdict
export const FENETRE_FRAMES = 6 // images minimum — à 3 fps, ~2 s
const WINDOW = 180 // taille de l'anneau : 1,5 s à 120 fps, jamais atteint plus bas
const BOOT_IGNORE = 5 // s of samples dropped after boot
const SETTLE_IGNORE = 2 // s dropped after a tier change / visibility change
export const DOWN_FPS = 30
const DOWN_SUSTAIN = 2.5 // s below DOWN_FPS before stepping down
const UP_FPS = 55
const UP_SUSTAIN = 12 // s above UP_FPS before stepping back up
const MIN_GAP = 20 // s minimum between two automatic tier changes

// Au-delà, une image n'est plus une mesure de vitesse : c'est un FIGEMENT du
// fil principal (décompression d'une tuile, construction d'une géométrie,
// onglet qui revient d'arrière-plan). 0,5 s = 2 fps.
const ACOUP_S = 0.5

// ---------------------------------------------------------------------------
// LES TROIS DÉCISIONS, EXTRAITES ET PURES — pour être testées sans GPU ni DOM
// ---------------------------------------------------------------------------

// Faut-il compter cette image dans la moyenne ?
//
// ⚠️ LE PIÈGE, ET IL A COÛTÉ LE SYMPTÔME ENTIER. L'ancienne règle écartait
// TOUTE image de plus de 0,5 s, sans mémoire. Or une machine sous 2 fps ne
// produit QUE des images de plus de 0,5 s : elle n'alimentait donc jamais la
// fenêtre, et le gouverneur restait muet — d'autant plus muet qu'elle souffrait.
// La mémoire d'UNE image suffit à séparer les deux cas : un figement est
// isolé (encadré d'images normales), une machine lente enchaîne.
// `precedentLong` = la précédente image dépassait déjà ACOUP_S.
export function echantillonRetenu(dt, precedentLong) {
  if (!(dt > 0) || !Number.isFinite(dt)) return { garde: false, long: false }
  if (dt > 5) return { garde: false, long: false } // onglet réveillé : aucune valeur
  const long = dt > ACOUP_S
  return { garde: !long || !!precedentLong, long }
}

// La fenêtre est-elle assez fournie pour se prononcer ?
export const fenetreMure = (dtSum, dtCount) => dtSum >= FENETRE_S && dtCount >= FENETRE_FRAMES

// À quel palier cette mesure oblige-t-elle ? On ne descend PAS d'un cran :
// on descend de la hauteur de la chute. Un cran toutes les 20 s mettait 67,5 s
// à atteindre T3, ce qui, à 3 fps, est une éternité de ventilateur.
//
// Les seuils ne sont pas des réglages de confort : 30 fps est la limite du
// fluide, 20 fps celle où le déplacement à la souris commence à saccader,
// 12 fps celle où l'application ne répond plus vraiment. En dessous, tout
// palier intermédiaire est du temps perdu.
//
// La fonction ne REMONTE jamais : la remontée a ses propres règles (UP_SUSTAIN,
// startTier). Sinon une mesure basse suivie d'une mesure moins basse ferait
// osciller la qualité à l'écran — ce qui se voit bien plus qu'un palier de trop.
export function palierVise(fps, tierActuel) {
  const cible = fps >= DOWN_FPS ? tierActuel
    : fps >= 20 ? tierActuel + 1
      : fps >= 12 ? tierActuel + 2
        : 3
  return Math.max(tierActuel, Math.min(3, cible))
}

// water glass: taps are baked into the shader as a #define (see
// vendor/MeshTransmissionMaterial.js). Rewriting the count and flagging
// needsUpdate recompiles the program — customProgramCacheKey() includes the
// tap count, so materials with different counts never share a program.
function setGlassSamples(lake, n) {
  for (const m of [lake?.seaMat, lake?.lakeMat]) {
    if (!m || m._mtmSamples === n) continue
    m._mtmSamples = n
    m.needsUpdate = true
  }
}

export function createAdaptiveQuality({
  params,
  renderer,
  composer,
  dof, // reserved — the pass toggle is enough today, kept for future levers
  setDofEnabled = () => {}, // DoF is lazily built (see main.js ensureDof)
  isDofEnabled = () => false,
  aoPass = null, // render-upgrade lever (2026-07-20 plan): tier 2 sheds AO.
  // PLUS de `bloomPass` : le palier 3 lâchait le bloom, mais la passe de bloom
  // a été retirée le 2026-08-02 (Adrien : « inutile, on retire »). Il n'y a
  // plus rien à lâcher. (Le paramètre n'était de toute façon jamais
  // déréférencé ici — seul `params._bloomTierOk` l'était, et il est parti avec.)
  lake,
  grain = null, // NoiseEffect (optional) — T3 turns film grain off
  applyShadowMode,
  announce = () => {},
  refreshAll = () => {},
  // sampling/stepping gate — main.js keeps the controller quiet in orbital
  // view (FX are already stripped there) and during a live MP4 recording
  // (a pixelRatio change would resize the canvas and abort the encoder)
  canStep = () => true,
  // Le palier ESTIMÉ avant le premier rendu (src/palier-machine.js, sondé par
  // boot.js). null = pas de détection, et alors ce fichier se comporte
  // exactement comme avant elle.
  palierMachine = null,
} = {}) {
  // Boot tier by device class. Phones (coarse pointer + short side < 600, the
  // same test as boot.js's gate) only ever reach the app as the shared-shibu
  // VIEWER — no editing, no need for the max — so they start at T3 ESSENTIAL
  // (pixelRatio 0.85, shadows/DoF/grain off) and stay there. Tablets keep T1,
  // desktops T0.
  //
  // ⚠️ CE GOUVERNEUR NE DÉMARRE PLUS SYSTÉMATIQUEMENT AU MAXIMUM. C'était le
  // défaut mesuré le 28/07/2026 : une machine à 5,5 images par seconde partait
  // au palier 0 et mettait 47 secondes à redescendre. `palierMachine` porte
  // l'ESTIMATION faite avant le premier rendu ; elle ne peut que renforcer la
  // sévérité des règles d'appareil ci-dessus, jamais l'alléger (un Adreno 750
  // est une carte « forte », et pourtant un téléphone reste au plancher).
  // L'arbitrage vit dans palier-machine.js, où il est testé sans DOM.
  const coarse = matchMedia('(pointer: coarse)').matches
  const phone = coarse && Math.min(screen.width, screen.height) < 600
  const startTier = palierDeDepart(palierMachine, { phone, coarse })
  // Jusqu'où la remontée a le droit d'aller. La détection ESTIME, elle ne
  // mesure pas : on lui laisse se tromper d'un cran, pas de deux. Sur tactile,
  // aucune remontée — la règle d'appareil prime.
  const plafondHaut = plafondDeRemontee(startTier, { phone, coarse })
  let tier = 0

  // the user's own settings — what T0 restores. Tracked live until the first
  // tier change, then frozen (from that point the dirty flags own the story).
  const base = {
    pixelRatio: params.pixelRatio,
    shadowMode: params.shadowMode,
    grain: params.grain,
    samples: lake?.seaMat?._mtmSamples ?? 6,
  }
  // per-lever opt-out: true = the user reclaimed this control, hands off
  const dirty = { pixelRatio: false, shadows: false, dof: false, grain: false }
  // what the controller last wrote — divergence means the user moved it
  let expected = null
  let everChanged = false

  // ---------------------------------------------------------------- levers

  const tierPixelRatio = (n) =>
    [base.pixelRatio, Math.min(base.pixelRatio, 1.5), Math.min(base.pixelRatio, 1.0), Math.min(base.pixelRatio, 0.85)][n]
  const tierShadows = (n) => {
    if (base.shadowMode === 'off') return 'off' // never resurrect user-disabled shadows
    return ['dynamic', 'static', 'off'].includes(base.shadowMode)
      ? [base.shadowMode, base.shadowMode, 'static', 'off'][n]
      : 'dynamic'
  }
  const tierSamples = (n) => [base.samples, Math.min(base.samples, 4), Math.min(base.samples, 2), Math.min(base.samples, 2)][n]

  function applyTier(n) {
    if (!dirty.pixelRatio) {
      const pr = tierPixelRatio(n)
      if (params.pixelRatio !== pr) {
        params.pixelRatio = pr
        // ⚠️ La densité se PASSE à applyRenderSize, elle ne se pose plus ici :
        // c'est cette fonction qui la borne à ce que la carte graphique
        // accepte. Un `renderer.setPixelRatio(pr)` direct court-circuiterait ce
        // plafond, et Chrome raboterait le tampon de dessin lui-même — une
        // dimension à la fois, sans un mot en console. Voir viewport.js.
        // La taille de rendu vient du CONTENEUR du canevas, jamais de la
        // fenêtre : en boutique / Studio, `#app` n'est qu'un cadre de ~58 % de
        // large. `composer.setSize` réécrit la taille CSS du canevas (il
        // rappelle renderer.setSize avec updateStyle=true), donc lui passer
        // window.innerWidth faisait déborder le canevas de son cadre pendant
        // que camera.aspect gardait le rapport du cadre : image écrasée et
        // rognée — le « se déforme, zoom à fond » du 28/07/2026. Et comme le
        // gouverneur ne bouge que sous 30 fps, cela ne se voyait QUE sur une
        // machine lente. Arrondi pair inclus (carré noir). Voir viewport.js.
        applyRenderSize({ renderer, composer, pixelRatio: pr })
      }
    }
    // Render-upgrade lever. AO costs a whole extra scene pass, so it is shed
    // dès le palier 2. `&& params.x` means a manual OFF stays off whatever the
    // tier — the governor only ever restores the user's own setting on the way
    // back up, never a blind true.
    // (`params._bloomTierOk` vivait ici : le bloom tenait jusqu'au palier
    // plancher. La passe a été retirée le 2026-08-02, le levier avec.)
    params._aoTierOk = n < 2
    if (!dirty.shadows) {
      const sm = tierShadows(n)
      if (params.shadowMode !== sm) {
        params.shadowMode = sm
        applyShadowMode()
      }
    }
    if (!dirty.dof) {
      // T2+: kill the whole DoF pass but leave params.bokehScale alone — the
      // Camera panel keeps showing the user's bokeh, and stepping back up
      // re-enables the pass exactly as they left it. bokehEnabled is the user's
      // explicit gate and always wins: auto-quality may only ever turn DoF OFF,
      // never switch it back on behind their back.
      setDofEnabled(n < 2 && params.bokehEnabled && params.bokehScale > 0)
    }
    if (!dirty.grain) {
      params.grain = n >= 3 ? 0 : base.grain
      if (grain) grain.blendMode.opacity.value = params.grain
    }
    setGlassSamples(lake, tierSamples(n)) // no UI control → no dirty flag
    expected = {
      pixelRatio: params.pixelRatio,
      shadowMode: params.shadowMode,
      dofEnabled: isDofEnabled(),
      bokehScale: params.bokehScale,
      grain: params.grain,
    }
    refreshAll() // Camera panel sliders reflect the new reality
  }

  // user-override detection — any managed value that drifted from what we
  // wrote was moved by the user: release that lever permanently
  function watchDirty() {
    if (!expected) return
    if (!dirty.pixelRatio && params.pixelRatio !== expected.pixelRatio) dirty.pixelRatio = true
    if (!dirty.shadows && params.shadowMode !== expected.shadowMode) dirty.shadows = true
    if (!dirty.dof && (isDofEnabled() !== expected.dofEnabled || params.bokehScale !== expected.bokehScale))
      dirty.dof = true
    if (!dirty.grain && params.grain !== expected.grain) dirty.grain = true
  }

  // ---------------------------------------------------------------- sensing

  const dts = new Float32Array(WINDOW)
  let dtSum = 0
  let dtCount = 0
  let dtHead = 0
  let below = 0 // s spent under DOWN_FPS
  let above = 0 // s spent over UP_FPS
  let precedentLong = false // l'image précédente dépassait ACOUP_S
  const now = () => performance.now() / 1000
  const bootAt = now()
  let quietUntil = bootAt + BOOT_IGNORE
  let lastChangeAt = -Infinity

  function resetWindow() {
    dtSum = 0
    dtCount = 0
    dtHead = 0
    below = 0
    above = 0
    precedentLong = false
  }

  document.addEventListener('visibilitychange', () => {
    resetWindow()
    quietUntil = Math.max(quietUntil, now() + SETTLE_IGNORE)
  })

  function setTier(n, manual = false) {
    n = Math.max(0, Math.min(3, Math.round(n)))
    if (n === tier) return
    const up = n < tier
    tier = n
    everChanged = true
    lastChangeAt = now()
    quietUntil = lastChangeAt + SETTLE_IGNORE
    resetWindow()
    applyTier(n)
    if (!manual) announce(up ? `PERFORMANCE — ${TIER_NAMES[n]} RESTORED` : `PERFORMANCE — ${TIER_NAMES[n]}`)
  }

  // re-assert the current tier's levers (mode transitions restore FX straight
  // from params and would silently undo the tier — main.js calls this when
  // surface FX come back online). Not a change: no announce, no settle reset.
  function reassert() {
    if (everChanged || tier !== 0) applyTier(tier)
  }

  // ⚠️ LE RENDEZ-VOUS AVEC LE LOOK D'OUVERTURE — une fois, et une seule.
  //
  // Ce contrôleur naît AVANT que le look d'ouverture (STARTUP_LOOK, ou celui
  // d'un lien partagé) ne soit appliqué : ce look attend la première
  // construction du relief, donc plusieurs secondes de plus. Or il porte
  // `shadowMode` et `grain` (ils sont dans TEMPLATE_KEYS — ce sont des choix
  // de LOOK, pas de machine). Tant que le palier de départ valait 0, personne
  // ne s'en apercevait. Depuis que la machine est estimée avant le premier
  // rendu, un ordinateur classé faible démarre à 2 ou 3, et deux défauts se
  // déclenchent ensemble à l'arrivée du look :
  //
  //   1. `watchDirty` voit shadowMode repasser de 'static' à 'dynamic', croit
  //      que l'UTILISATEUR a bougé le sélecteur, et relâche le levier POUR
  //      TOUJOURS — sur la machine qui en avait justement besoin.
  //   2. La référence `base` a été figée à la construction, quand grain valait
  //      encore 0. Ré-appliquer le palier sans rien faire d'autre effacerait
  //      donc le grain du look d'ouverture.
  //
  // D'où : on RECAPTURE la référence sur les deux valeurs que le look apporte,
  // puis on ré-applique le palier par-dessus. Vérifié le 28/07/2026 sur un
  // iMac 2015 simulé : sans ce rendez-vous, les ombres repassaient en
  // 'dynamic' au palier ALLÉGÉ.
  //
  // `base.pixelRatio` n'en fait PAS partie, et c'est délibéré : l'échelle de
  // rendu ne voyage dans aucun gabarit (voir TEMPLATE_KEYS), donc rien ne l'a
  // touchée — la recapturer ne ferait que verrouiller la valeur déjà rabotée
  // et interdire à la remontée de la rendre.
  let rebased = false
  function rebase() {
    if (rebased || everChanged) return
    rebased = true
    base.shadowMode = params.shadowMode
    base.grain = params.grain
    if (tier !== 0) applyTier(tier)
  }

  function update(dt) {
    const t = now()

    // pre-change on desktop: keep tracking the user's own values as the
    // restore target (on tablets T1 was applied at boot, so the baseline is
    // frozen at construction and the dirty flags take over from there)
    if (!everChanged && tier === 0) {
      base.pixelRatio = params.pixelRatio
      base.shadowMode = params.shadowMode
      base.grain = params.grain
    }
    watchDirty()

    if (!canStep()) {
      resetWindow()
      return
    }
    if (t < quietUntil) return
    // ⚠️ `dt` doit être le delta RÉEL, pas celui que main.js borne à 0,05 s
    // pour la simulation — relire l'en-tête de ce fichier avant d'y toucher.
    const ech = echantillonRetenu(dt, precedentLong)
    precedentLong = ech.long
    if (!ech.garde) return

    // moyenne glissante sur une DURÉE (voir FENETRE_S) : l'anneau ne sert plus
    // qu'à borner la mémoire, ce n'est plus lui qui décide du moment du verdict
    if (dtCount === WINDOW) dtSum -= dts[dtHead]
    else dtCount++
    dts[dtHead] = dt
    dtSum += dt
    dtHead = (dtHead + 1) % WINDOW
    // on purge la queue de fenêtre au-delà de ce qui est utile : sans ça, à
    // 3 fps, l'anneau garderait une minute de passé et la moyenne mettrait
    // autant de temps à réagir à une amélioration qu'à une dégradation
    while (dtCount > FENETRE_FRAMES && dtSum - dts[(dtHead - dtCount + WINDOW) % WINDOW] >= FENETRE_S) {
      dtSum -= dts[(dtHead - dtCount + WINDOW) % WINDOW]
      dtCount--
    }
    if (!fenetreMure(dtSum, dtCount)) return // pas encore de quoi juger
    const avg = dtCount / dtSum

    if (avg < DOWN_FPS) {
      below += dt
      above = 0
    } else if (avg > UP_FPS) {
      above += dt
      below = 0
    } else {
      below = 0
      above = 0
    }

    if (t - lastChangeAt < MIN_GAP) return
    // LA PROFONDEUR DE LA CHUTE DÉCIDE, pas un cran fixe : une machine à 3 fps
    // atterrit directement au plancher. `setTier` ne change qu'une fois, donc
    // MIN_GAP reste respecté — c'est le nombre de crans qui change, pas le
    // rythme des changements.
    if (below >= DOWN_SUSTAIN && tier < 3) setTier(palierVise(avg, tier))
    else if (above >= UP_SUSTAIN && tier > plafondHaut) setTier(tier - 1)
  }

  // touch devices boot straight into their tier (T1 tablets, T3 phones) —
  // silently, and before the first frame, so there is no visible quality pop
  if (startTier > 0) {
    tier = startTier
    applyTier(startTier)
  }

  return {
    update,
    setTier,
    reassert,
    rebase,
    get tier() {
      return tier
    },
    get startTier() {
      return startTier
    },
    get plafondHaut() {
      return plafondHaut
    },
    get dirty() {
      return { ...dirty }
    },
  }
}
