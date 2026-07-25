// Simulation du ciel — le « où et quand » des nuages, sans aucun rendu.
//
// Nuages v2 (plan 2026-07-25) : au lieu d'un champ de bruit global qu'on
// seuille, le ciel est peuplé d'ENTITÉS. Chacune a sa position, sa taille, sa
// graine de bruit et surtout sa VIE : elle naît, gonfle, mûrit, se dissipe,
// puis laisse la place à une autre. C'est ce qui donne des nuages qu'on peut
// compter et un ciel qui bouge au lieu d'un tapis qui dérive.
//
// Le cycle de vie suit l'esprit de l'automate cellulaire de Dobashi (SIGGRAPH
// 2000) — des règles simples par cellule plutôt qu'une simulation fluide — mais
// appliquées à des entités plutôt qu'à une grille : à l'échelle d'un bloc de
// carte, quelques dizaines de nuages suffisent et restent individuellement
// lisibles.
//
// Module PUR : pas de DOM, pas de three.js, pas d'horloge globale. Tout entre
// par les arguments, tout sort par le retour — donc testable en node.

// Bornes du peuplement. Au-delà de MAX les nuages se recouvrent et
// l'individualité — tout l'intérêt de cette refonte — se perd.
export const CLOUD_COUNT_MIN = 3
export const CLOUD_COUNT_MAX = 12

// Nombre de nuages selon la puissance de la machine (palier de perf.js :
// 0 = desktop, 1 = tablette, 2/3 = délestage, 3 = téléphone). Adrien : « peut-
// être modifier ce chiffre en fonction de la puissance de calcul ».
// Adrien : « tu peux afficher jusqu'à 12 nuages, ça suffit — moins de nuages
// et plus qualitatif ». Le budget économisé part dans la forme et l'éclairage.
const COUNT_BY_TIER = [12, 9, 6, 4]
export function cloudCountForTier(tier = 0, density = 1) {
  const base = COUNT_BY_TIER[Math.max(0, Math.min(3, tier | 0))]
  return Math.round(clamp(base * density, CLOUD_COUNT_MIN, CLOUD_COUNT_MAX))
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const clamp01 = (v) => clamp(v, 0, 1)

// générateur déterministe (mulberry32) — un ciel rejouable à graine égale,
// indispensable pour tester et pour que deux rendus d'une même carte se
// ressemblent
export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Enveloppe de vie : 0 à la naissance, 1 à maturité, 0 à la mort. Fenêtres
// VOLONTAIREMENT dissymétriques (0.2 / 0.5 / 0.3) — un cumulus bourgeonne plus
// vite qu'il ne s'effiloche ; à fenêtres égales le ciel respire comme une
// machine.
export function lifeEnvelope(age) {
  const t = clamp01(age)
  if (t < 0.2) return smooth(t / 0.2) // croissance, vive
  if (t < 0.7) return 1 // maturité
  return smooth(1 - (t - 0.7) / 0.3) // dissipation, traînante
}
// borné : (1 - 0.3/0.3) vaut -2e-16 en flottant, et un smooth non borné en
// tire un 1.5e-31 au lieu d'un zéro franc à la mort du nuage
const smooth = (x) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

// Un nuage neuf, posé au hasard dans les bornes. `ageAtBirth` désamorce l'effet
// « tout le ciel naît en même temps » au premier build : à l'initialisation on
// répartit les âges, ensuite les nouveaux naissent bien à 0.
// GENRES de nuages (Adrien : « varier au maximum — certains extrêmement fins
// et diffus, d'autres plus épais »). Le genre décide de l'aplatissement, de la
// densité et du côté déchiqueté ; à l'intérieur d'un genre tout varie encore.
//   ratio = hauteur / demi-largeur · dens = opacité · wisp = 0 net … 1 filandreux
export const CLOUD_KINDS = [
  { id: 'bourgeon', ratio: [0.75, 1.15], dens: [0.85, 1.25], wisp: [0.0, 0.25], w: 3 },
  { id: 'galette', ratio: [0.26, 0.46], dens: [0.6, 0.95], wisp: [0.2, 0.5], w: 3 },
  { id: 'voile', ratio: [0.1, 0.24], dens: [0.16, 0.36], wisp: [0.7, 1.0], w: 2 }, // très fin et diffus
  { id: 'tour', ratio: [1.35, 2.0], dens: [0.95, 1.35], wisp: [0.0, 0.2], w: 1 },
]
const KIND_TOTAL = CLOUD_KINDS.reduce((s, k) => s + k.w, 0)
function pickKind(rng) {
  let t = rng() * KIND_TOTAL
  for (const k of CLOUD_KINDS) { t -= k.w; if (t <= 0) return k }
  return CLOUD_KINDS[0]
}
const lerp = (rng, [a, b]) => a + rng() * (b - a)

// RÉPARTITION du ciel (Adrien : « parfois tous au même endroit, d'autres fois
// éparpillés ») : chaque ciel tire son humeur — dispersé, en bancs (2-3
// grappes), ou massé en un seul front. Les naissances suivent l'humeur.
export function drawGrouping(rng, half) {
  const t = rng()
  if (t < 0.4) return { mode: 'disperse', centers: null }
  const n = t < 0.8 ? 2 + Math.round(rng()) : 1
  const centers = []
  for (let i = 0; i < n; i++) {
    centers.push({ x: (rng() * 2 - 1) * half * 0.7, z: (rng() * 2 - 1) * half * 0.7 })
  }
  return { mode: n === 1 ? 'front' : 'bancs', centers }
}

function drawPosition(rng, opts) {
  const { half, grouping } = opts
  if (!grouping?.centers) {
    return { x: (rng() * 2 - 1) * half, z: (rng() * 2 - 1) * half }
  }
  const c = grouping.centers[Math.floor(rng() * grouping.centers.length)]
  // étalement gaussien-ish autour du centre de la grappe (somme de 2 tirages)
  const s = half * (grouping.mode === 'front' ? 0.34 : 0.26)
  return {
    x: clamp(c.x + (rng() + rng() - 1) * s, -half, half),
    z: clamp(c.z + (rng() + rng() - 1) * s, -half, half),
  }
}

function spawnCloud(rng, opts) {
  const { baseY, topY, sizeMin, sizeMax, ageAtBirth = 0 } = opts
  const k = pickKind(rng)
  // les voiles sont plus étalés, les tours plus étroites — la taille au sol
  // dépend du genre, sinon toutes les silhouettes se ressemblent en largeur
  const spanMul = k.id === 'voile' ? 1.35 : k.id === 'tour' ? 0.72 : 1
  const r = (sizeMin + rng() * (sizeMax - sizeMin)) * spanMul
  const pos = drawPosition(rng, opts)
  return {
    x: pos.x,
    z: pos.z,
    y: baseY + rng() * Math.max(0, topY - baseY),
    r, // demi-largeur au sol
    h: r * lerp(rng, k.ratio), // hauteur propre : galettes, bourgeons, tours
    kind: k.id,
    wisp: lerp(rng, k.wisp), // 0 = bord net, 1 = déchiqueté et translucide
    seed: rng() * 1000,
    age: ageAtBirth,
    // durée de vie en secondes — un ciel où tout meurt en même temps est faux
    span: 45 + rng() * 75,
    speed: 0.75 + rng() * 0.5, // chaque nuage prend le vent un peu différemment
    density: lerp(rng, k.dens),
  }
}

// Deux nuages qui se chevauchent lisent comme une seule masse informe : au
// spawn on rejette les positions trop proches d'un voisin vivant. Quelques
// essais suffisent — au-delà on accepte, mieux vaut un nuage un peu proche
// qu'un ciel qui se dépeuple.
function spawnSpaced(rng, opts, others, tries = 12) {
  let best = null
  let bestGap = -Infinity
  for (let i = 0; i < tries; i++) {
    const c = spawnCloud(rng, opts)
    let gap = Infinity
    for (const o of others) {
      if (!o || o === c) continue
      const d = Math.hypot(o.x - c.x, o.z - c.z) - (o.r + c.r)
      if (d < gap) gap = d
    }
    if (gap > bestGap) { bestGap = gap; best = c }
    if (gap > 0) break // assez d'air autour : on prend
  }
  return best
}

export const SKY_DEFAULTS = {
  half: 26, // demi-étendue du peuplement, en unités monde
  baseY: 5,
  topY: 9,
  sizeMin: 2.5,
  sizeMax: 6.5,
}

// Crée un ciel peuplé. Les âges sont répartis d'entrée pour que le ciel soit
// « déjà vivant » à la première image.
export function createSky({ count = 16, seed = 1, grouping = null, ...opts } = {}) {
  const o = { ...SKY_DEFAULTS, ...opts }
  const rng = makeRng(seed)
  // l'humeur du ciel (dispersé / bancs / front) se tire une fois et gouverne
  // toutes les naissances, y compris les respawns — un ciel garde son humeur
  o.grouping = grouping || drawGrouping(rng, o.half)
  const clouds = []
  for (let i = 0; i < count; i++) {
    clouds.push(spawnSpaced(rng, { ...o, ageAtBirth: rng() }, clouds))
  }
  return { clouds, rng, opts: o, t: 0 }
}

// Avance le ciel de dt secondes : advection par le vent, vieillissement,
// remplacement des morts. MUTE le ciel (appelé chaque frame) et le renvoie.
//
// wind : { dir (radians), speed (unités monde/s) }. La direction pilote aussi
// l'orographie en P2 — c'est la même donnée.
export function stepSky(sky, dt, { wind = { dir: 0, speed: 0.6 } } = {}) {
  if (!sky || !(dt > 0)) return sky
  const { opts, rng } = sky
  const wx = Math.cos(wind.dir) * wind.speed
  const wz = Math.sin(wind.dir) * wind.speed
  const lim = opts.half * 1.15 // marge de sortie : on laisse le nuage quitter le champ
  sky.t += dt
  const { baseY, topY } = opts
  const band = Math.max(1e-3, topY - baseY)
  for (let i = 0; i < sky.clouds.length; i++) {
    const c = sky.clouds[i]
    // PARALLAXE (Adrien) : le vent est plus fort en altitude, donc un nuage
    // haut file plus vite qu'un nuage bas. C'est ce décalage qui donne la
    // profondeur — sans lui la couche glisse d'un bloc, comme un décor peint.
    const alt = clamp((c.y - baseY) / band, 0, 1)
    const par = 0.6 + alt * 0.9
    c.x += wx * c.speed * par * dt
    c.z += wz * c.speed * par * dt
    // le ciel s'enroule : sorti d'un bord, le nuage rentre par l'autre — le
    // peuplement reste constant sans avoir à tuer/faire naître au passage
    if (c.x > lim) c.x -= 2 * lim
    else if (c.x < -lim) c.x += 2 * lim
    if (c.z > lim) c.z -= 2 * lim
    else if (c.z < -lim) c.z += 2 * lim
    // croissance douce vers la cible de fusion (voir collisions ci-dessous)
    if (c.rTarget && c.rTarget > c.r) c.r += (c.rTarget - c.r) * Math.min(1, dt * 0.5)
    c.age += dt / c.span
    if (c.age >= 1) {
      // mort : une nouvelle entité prend la place, ailleurs et différente
      sky.clouds[i] = spawnSpaced(rng, opts, sky.clouds)
    }
  }
  // COLLISIONS (Adrien) : deux nuages mûrs qui se recouvrent fusionnent — le
  // plus gros ABSORBE (il enfle vers le volume combiné, en douceur), le petit
  // bascule en dissipation. Vu de loin : deux masses qui se rejoignent en une.
  const maxR = opts.sizeMax * 1.7
  for (let i = 0; i < sky.clouds.length; i++) {
    for (let j = i + 1; j < sky.clouds.length; j++) {
      const a = sky.clouds[i], b = sky.clouds[j]
      if (!a || !b || a.merging || b.merging) continue
      // seuls des nuages installés fusionnent (ni naissants ni mourants)
      if (a.age < 0.12 || a.age > 0.68 || b.age < 0.12 || b.age > 0.68) continue
      const d = Math.hypot(a.x - b.x, a.z - b.z)
      if (d >= (a.r + b.r) * 0.55) continue
      const big = a.r >= b.r ? a : b
      const small = big === a ? b : a
      big.rTarget = Math.min(maxR, Math.hypot(big.r, small.r)) // ~volume combiné
      small.age = Math.max(small.age, 0.72) // le petit se dissout dans le gros
      small.merging = true
    }
  }
  return sky
}

// Ajuste le peuplement sans rejouer tout le ciel (le palier de perf peut
// changer en cours de route, et le curseur de densité aussi) : on coupe les
// plus jeunes en trop, on ajoute des neufs quand il en manque.
export function resizeSky(sky, count) {
  const n = Math.max(0, count | 0)
  if (!sky) return sky
  while (sky.clouds.length > n) sky.clouds.pop()
  while (sky.clouds.length < n) sky.clouds.push(spawnSpaced(sky.rng, sky.opts, sky.clouds))
  return sky
}

// Densité effective d'un nuage à cet instant : sa densité propre pondérée par
// son enveloppe de vie. 0 = invisible (naissance ou mort) — c'est ce que le
// rendu utilise pour faire apparaître/disparaître sans « pop ».
export function cloudDensity(c) {
  return c.density * lifeEnvelope(c.age)
}

// Échelle effective : un nuage naissant est aussi plus PETIT, pas seulement
// plus transparent — sinon il « apparaît » à sa taille finale et ça se voit.
export function cloudScale(c) {
  const e = lifeEnvelope(c.age)
  return 0.55 + 0.45 * e
}
