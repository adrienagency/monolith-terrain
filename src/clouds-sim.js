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
function spawnCloud(rng, opts) {
  const { half, baseY, topY, sizeMin, sizeMax, ageAtBirth = 0 } = opts
  const r = sizeMin + rng() * (sizeMax - sizeMin)
  return {
    x: (rng() * 2 - 1) * half,
    z: (rng() * 2 - 1) * half,
    y: baseY + rng() * Math.max(0, topY - baseY),
    r, // demi-largeur au sol
    h: r * (0.55 + rng() * 0.6), // hauteur propre : des galettes et des tours
    seed: rng() * 1000,
    age: ageAtBirth,
    // durée de vie en secondes — un ciel où tout meurt en même temps est faux
    span: 45 + rng() * 75,
    speed: 0.75 + rng() * 0.5, // chaque nuage prend le vent un peu différemment
    density: 0.7 + rng() * 0.6,
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
export function createSky({ count = 16, seed = 1, ...opts } = {}) {
  const o = { ...SKY_DEFAULTS, ...opts }
  const rng = makeRng(seed)
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
    c.age += dt / c.span
    if (c.age >= 1) {
      // mort : une nouvelle entité prend la place, ailleurs et différente
      sky.clouds[i] = spawnSpaced(rng, opts, sky.clouds)
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
