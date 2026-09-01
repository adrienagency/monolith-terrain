// Simulation du ciel — le « où et quand » des nuages, sans aucun rendu.
//
// Nuages v2 (plan 2026-07-25) : au lieu d'un champ de bruit global qu'on
// seuille, le ciel est peuplé d'ENTITÉS. Chacune a sa position, sa taille, sa
// graine de bruit et surtout sa VIE : elle naît, gonfle, mûrit, se dissipe,
// puis laisse la place à une autre. C'est ce qui donne des nuages qu'on peut
// compter et un ciel qui bouge au lieu d'un tapis qui dérive.
//
// v3 — LA GRAPPE (demande d'Adrien) : ce qu'on appelle « un nuage » n'est plus
// une entité mais une GRAPPE de 3 à 7 entités nées dans le même corps, qui
// voyagent ensemble à des vitesses très légèrement différentes et évoluent
// chacune à son rythme. Et la grande majorité du ciel est de PASSAGE : elle
// naît hors de la carte, la traverse, et meurt de l'autre côté — seule une
// minorité vit et se disloque sur place.
//
// Le cycle de vie suit l'esprit de l'automate cellulaire de Dobashi (SIGGRAPH
// 2000) — des règles simples par entité plutôt qu'une simulation fluide.
//
// Module PUR : pas de DOM, pas de three.js, pas d'horloge globale. Tout entre
// par les arguments, tout sort par le retour — donc testable en node.

// Bornes du peuplement, en GRAPPES (une grappe = un « nuage » au sens où
// l'utilisateur les compte). Au-delà les grappes se recouvrent et
// l'individualité — tout l'intérêt de cette refonte — se perd.
export const CLOUD_COUNT_MIN = 2
export const CLOUD_COUNT_MAX = 6 // 5 avant le 2026-09-01 — voir COUNT_BY_TIER

// Taille d'une grappe : un cœur + 2 à 6 compagnons (Adrien : « chaque nuage
// naît avec au moins deux nuages, max six, dans le même corps »).
export const CLUSTER_MIN = 3
export const CLUSTER_MAX = 7

// Plafond DUR sur les ENTITÉS : divisions, dislocations et grappes pleines
// font monter le compte transitoirement. C'est aussi le budget de boîtes
// raymarchées — il ne doit jamais dépasser MAX_INSTANCES côté rendu.
// 4 grappes pleines (4 × 7 = 28) + de quoi disloquer sans étouffer le
// repeuplement. C'est un BUDGET DE BOÎTES RAYMARCHÉES avant d'être un nombre :
// au-delà, les recouvrements écroulent la fréquence d'images (48 → 3 fps).
export const CLOUD_HARD_MAX = 34

// Nombre de GRAPPES selon la puissance de la machine (palier de perf.js :
// 0 = desktop, 1 = tablette, 2/3 = délestage, 3 = téléphone).
//
// ══════ LE PALIER 0 PASSE DE 4 À 7 — arbitrage du 2026-09-01 ═══════════════
//
// **Le ciel par défaut doit se voir.** Quinze curseurs de nuages existent dans
// le studio ; un système allumé, correctement peuplé et invisible à l'écran,
// c'est un réglage qui ne fait rien sous une autre forme.
//
// ⚠️ **MESURÉ EN COMPTANT LES PIXELS DU TAMPON ENTIER** (1280 × 800 ; pas de
// vignette — un condensé annule les motifs fins), **sur CINQ dispositions**,
// parce qu'à ce nombre de grappes l'écart entre deux tirages du MÊME réglage
// dépasse l'écart entre deux réglages : la même configuration a rendu 497 et
// 11 628 pixels selon la graine. Médianes, .banc/R20/defaut/diag-graines.json :
//
//   | grappes | entités | pixels touchés (médiane) | part de l'écran |
//   |---|---|---|---|
//   | 3 *(l'ancien défaut)* | 11–21 | 5 594 | 0,55 % |
//   | 4 | 11–25 | 7 025 | 0,69 % |
//   | **6** | 19–34 | **12 891** | **1,26 %** |
//   | 8 | 30–34 | 14 710 | 1,44 % |
//
// ⚡ **6 EST LE GENOU** : +83 % de ciel visible sur 4, quand 8 n'ajoute que
// +14 % de plus et **épingle CLOUD_HARD_MAX** (34 entités sur 4 tirages sur 5),
// c'est-à-dire le plafond que ce fichier décrit dix lignes plus haut comme
// celui où les recouvrements écroulent la fréquence d'images.
//
// ⛔ **ET ÇA SE PAIE, EN FRAGMENTS.** Minuterie du pilote
// (EXT_disjoint_timer_query_webgl2), mesure APPARIÉE ET ENTRELACÉE, témoin de
// sensibilité aux fragments validé aux deux bouts (×16 de fragments ⇒ ×8,2 puis
// ×5,2 de temps) — .banc/R20/defaut/diag-cout2.json :
//
//   | grappes | temps GPU de la scène, avec ÷ sans le ciel |
//   |---|---|
//   | 3 | ×1,57 |
//   | 4 | ×1,71 |
//   | **6** | **×2,04** |
//   | 8 | ×2,23 |
//
// ➡️ **Le ciel DOUBLE le temps GPU de la scène** au lieu de l'augmenter de
// moitié. Sur la carte du relevé (RTX 3080, 1,02 Mpx) cela reste 0,61 ms par
// image — mais c'est un coût de FRAGMENT, donc il suit la surface de rendu, et
// il ne se transpose pas tel quel sur un petit circuit intégré.
//
// ⛔ **C'EST POURQUOI SEUL LE PALIER 0 MONTE.** Les trois autres ne bougent pas
// d'une grappe : une machine qui a déjà besoin d'être délestée ne paie pas ce
// choix. ⚠️ Et ce n'est pas théorique — la bannière « PERFORMANCE — ESSENTIAL
// MODE » s'affiche pendant le chargement avant que le palier ne remonte :
// quelqu'un qui reste à T3 garde exactement le ciel d'avant.
//
// ⚠️ **7 ET NON 6, PARCE QUE LA DENSITÉ MULTIPLIE.** cloudCountForTier rend
// round(base × densité) avec densité = 0,65 + opacité × 0,18 : à l'opacité par
// défaut (1,4) le facteur vaut 0,902, donc une base de 6 rendrait 5 et non 6.
// Base 7 × 0,902 = 6,31 → **6**, plafonné par CLOUD_COUNT_MAX. Les trois autres
// paliers rendent le même nombre qu'avant : 3 × 0,902 → 3, et 2 × 0,902 → 2.
const COUNT_BY_TIER = [7, 3, 2, 2]
export function cloudCountForTier(tier = 0, density = 1) {
  const base = COUNT_BY_TIER[Math.max(0, Math.min(3, tier | 0))]
  return Math.round(clamp(base * density, CLOUD_COUNT_MIN, CLOUD_COUNT_MAX))
}

// Part du ciel qui est DE PASSAGE : naît hors carte, traverse, meurt dehors.
// Le reste vit et se disloque sur place (Adrien : « 90 % »).
export const TRANSIT_SHARE = 0.9

// OROGRAPHIE — le relief agit sur le ciel (phase 2 du plan nuages).
// Le module reste PUR : le rendu INJECTE un échantillonneur de terrain
// `terrainAt(x, z) -> hauteur monde` dans les options du ciel. Sans lui, rien
// ne change — c'est ce qui garde clouds-sim.js testable en node.
//   · SOULÈVEMENT : un versant qui monte face au vent pousse le nuage vers le
//     haut et le fait grossir — c'est ainsi que naissent les nuages de crête ;
//   · SUBSIDENCE : au vent arrière le sol redescend, le nuage plonge et maigrit
//     (l'ombre pluviométrique, en plus discret) ;
//   · BUTÉE : la base d'un nuage n'entre JAMAIS dans la roche. C'est le point
//     qu'Adrien voit en premier — un nuage qui traverse un sommet trahit tout.
const OROG_LIFT = 0.55 // vitesse de montée au vent, en hauteurs de nuage/s
const OROG_SINK = 0.3 // descente sous le vent, plus molle que la montée
const OROG_GROW = 0.25 // gonflement au vent (et amaigrissement sous le vent)
const OROG_DRAG = 0.5 // freinage max en montant un versant (0 = pas de frein)
const OROG_CLEAR = 0.55 // dégagement minimum sous la base, en hauteurs de nuage

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
// VOLONTAIREMENT dissymétriques — un cumulus bourgeonne vite et s'efface
// longuement. La fenêtre de dissipation couvre presque la moitié de la vie
// (Adrien : « très très en douceur »).
export function lifeEnvelope(age) {
  const t = clamp01(age)
  // ⚠️ zéro FRANC à la mort : (1 - 0.45/0.45) vaut 1.1e-16 en flottant, dont
  // le smooth tire un 3.7e-32 — assez pour qu'un nuage mort reste « visible »
  // dans les comparaisons. Le cas limite se traite en clair, pas par epsilon.
  if (t >= 1) return 0
  if (t < 0.18) return smooth(t / 0.18) // croissance, vive
  if (t < 0.55) return 1 // maturité
  return smooth(1 - (t - 0.55) / 0.45) // dissipation, très traînante
}
const smooth = (x) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

// GENRES de nuages (Adrien : « varier au maximum — certains extrêmement fins
// et diffus, d'autres plus épais »). Le genre décide de l'aplatissement, de la
// densité et du côté déchiqueté ; à l'intérieur d'un genre tout varie encore.
//   ratio = hauteur / demi-largeur · dens = opacité · wisp = 0 net … 1 filandreux
//
// ⚠️ ratios VOLONTAIREMENT bas (Adrien : « beaucoup trop verticaux ») : un
// cumulus vu depuis un diorama est plus large que haut. Même la tour, le genre
// le plus dressé, reste sous 1.0 — c'est le BOURGEONNEMENT qui donne le relief
// vertical, pas l'étirement de la boîte.
export const CLOUD_KINDS = [
  { id: 'bourgeon', ratio: [0.5, 0.72], dens: [0.85, 1.25], wisp: [0.0, 0.25], w: 3 },
  { id: 'galette', ratio: [0.2, 0.34], dens: [0.6, 0.95], wisp: [0.2, 0.5], w: 3 },
  { id: 'voile', ratio: [0.08, 0.17], dens: [0.16, 0.36], wisp: [0.7, 1.0], w: 2 }, // très fin et diffus
  { id: 'tour', ratio: [0.78, 1.0], dens: [0.95, 1.35], wisp: [0.0, 0.2], w: 1 },
]
const KIND_TOTAL = CLOUD_KINDS.reduce((s, k) => s + k.w, 0)
function pickKind(rng) {
  let t = rng() * KIND_TOTAL
  for (const k of CLOUD_KINDS) { t -= k.w; if (t <= 0) return k }
  return CLOUD_KINDS[0]
}
const lerp = (rng, [a, b]) => a + rng() * (b - a)

// ALLONGEMENT de la base (Adrien : « jusqu'à un ratio de 5 ou 6 pour 1 »).
// Tiré au CUBE : la plupart des nuages restent ronds, les vrais radeaux sont
// rares — c'est ce qui les rend remarquables quand ils passent.
// L'allongement est modéré et son AXE n'est plus tiré au sort : un nuage
// s'étire dans la direction du VENT, comme dans le ciel (Adrien). L'angle vit
// donc côté rendu (il vient de uWind) ; ici on ne décide que du rapport.
export const ELONG_MAX = 3
function drawElong(rng, kindId) {
  const eMax = kindId === 'tour' ? 1.3 : kindId === 'bourgeon' ? 1.8 : ELONG_MAX
  const t = rng()
  return 1 + (eMax - 1) * t * t * t
}

// UN GROS NUAGE N'EST JAMAIS UNE FEUILLE DE PAPIER (Adrien). Le genre décide
// de l'aplatissement, mais plus la masse est large, plus elle doit avoir du
// ventre — un voile de 6 unités de large et 0,5 d'épais ne ressemble à rien.
function minAspectFor(r, sizeMin, sizeMax) {
  const big = clamp((r - sizeMin) / Math.max(sizeMax - sizeMin, 1e-3), 0, 1)
  return 0.12 + 0.3 * big * big
}

// ⚠️ le plancher doit s'appliquer PARTOUT où une hauteur est décidée : à la
// naissance ET pour les compagnons d'une grappe, qui recalculent la leur de
// leur côté. Un seul point de passage, sinon un gros compagnon repasse à plat.
function thickEnough(r, h, opts) {
  return Math.max(h, r * minAspectFor(r, opts.sizeMin, opts.sizeMax))
}

// Un nuage « volumineux » au sens de la règle de grappe ci-dessous.
const VOLUMINOUS = 0.42

// NIVEAUX DE VOL (Adrien : « plein de niveaux d'altitude différents, du sol à
// l'altitude max — au sommet des montagnes pour certains, au fond des vallées
// pour d'autres »). Un tirage uniforme donne une purée ; des paliers jittés
// donnent des COUCHES lisibles, comme un vrai ciel.
// ZONES D'ALTITUDE — Adrien : « j'ai l'impression que tous les nuages partent
// de la même hauteur ; qu'est-ce que ça donnerait avec plusieurs zones de
// départ aléatoires ? ». Il avait raison sur le diagnostic : les paliers
// étaient FIXES (quatre étages régulièrement espacés), donc à plage étroite
// tout le monde se retrouvait au même endroit. Chaque ciel tire maintenant ses
// PROPRES zones — deux à quatre bandes, à des hauteurs et des épaisseurs
// tirées au sort — exactement comme il tire déjà son humeur horizontale.
export function drawAltZones(rng) {
  const n = 2 + Math.floor(rng() * 3) // 2 à 4 zones
  const zones = []
  for (let i = 0; i < n; i++) {
    // centre biaisé vers le haut (un tirage plat enterre la moitié du ciel
    // dans les montagnes — vérifié à l'écran, diorama vide)
    const c = Math.pow(rng(), 0.6)
    zones.push({ c, w: 0.06 + rng() * 0.22, weight: 0.4 + rng() })
  }
  return zones
}

function drawAltitude(rng, baseY, topY, zones) {
  const band = Math.max(0, topY - baseY)
  if (!zones?.length) return baseY + band * clamp01(Math.pow(rng(), 0.6))
  // tirage pondéré : certaines bandes sont plus peuplées que d'autres
  let total = 0
  for (const z of zones) total += z.weight
  let t = rng() * total
  let zone = zones[zones.length - 1]
  for (const z of zones) { t -= z.weight; if (t <= 0) { zone = z; break } }
  return baseY + band * clamp01(zone.c + (rng() - 0.5) * zone.w)
}

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
  const elong = drawElong(rng, k.id)
  return {
    x: pos.x,
    z: pos.z,
    y: drawAltitude(rng, baseY, topY, opts.altZones),
    r, // demi-largeur au sol (rayon MOYEN : l'ellipse garde la même aire)
    elong, // 1 = rond, 6 = radeau très allongé
    // un radeau très allongé doit rester PLAT, sinon c'est une crête : la
    // hauteur s'amortit quand la base s'étire
    h: thickEnough(r, r * lerp(rng, k.ratio) * Math.pow(elong, -0.25), opts),
    kind: k.id,
    wisp: lerp(rng, k.wisp), // 0 = bord net, 1 = déchiqueté et translucide
    seed: rng() * 1000,
    age: ageAtBirth,
    // durée de vie en secondes — un ciel où tout meurt en même temps est faux
    span: 45 + rng() * 75,
    speed: 0.55 + rng() * 0.95, // écart FRANC : certains filent, d'autres traînent
    density: lerp(rng, k.dens),
    fade: 1,
    transit: false,
    lead: true,
    gid: 0,
  }
}

// ------------------------------------------------------------------ grappes
// Une GRAPPE : un cœur + 2 à 6 compagnons nés DANS son corps. Ils partagent
// l'altitude et la trajectoire à très peu près, mais chacun a sa graine, sa
// taille, son âge et sa vitesse propres — « ils se suivent en avançant à une
// vitesse très légèrement différente » (Adrien).
function buildCluster(rng, opts, core) {
  const gid = Math.floor(rng() * 1e9) || 1
  core.gid = gid
  core.lead = true
  const out = [core]
  const n = (CLUSTER_MIN - 1) + Math.floor(rng() * (CLUSTER_MAX - CLUSTER_MIN + 1))
  for (let i = 0; i < n; i++) {
    const ang = rng() * Math.PI * 2
    const d = core.r * (0.12 + rng() * 0.55)
    const r = core.r * (0.4 + rng() * 0.42)
    const elong = drawElong(rng, core.kind)
    out.push({
      ...core,
      gid,
      lead: false,
      seed: rng() * 1000,
      x: core.x + Math.cos(ang) * d,
      z: core.z + Math.sin(ang) * d,
      y: core.y + (rng() - 0.5) * core.h * 1.3,
      r,
      elong,
      h: thickEnough(r, r * (0.3 + rng() * 0.5) * Math.pow(elong, -0.25), opts),
      // chacun évolue à son propre rythme, en partant d'un âge voisin
      age: clamp01(core.age + (rng() - 0.5) * 0.14),
      span: core.span * (0.8 + rng() * 0.4),
      // ILS SE SUIVENT : quelques pour cent d'écart suffisent à faire respirer
      // la grappe sans qu'elle se démembre en traversant la carte
      speed: core.speed * (0.965 + rng() * 0.07),
      density: core.density * (0.65 + rng() * 0.55),
      wisp: clamp01((core.wisp ?? 0) + (rng() - 0.5) * 0.35),
      merging: false,
      shattered: false,
      rTarget: 0,
    })
  }
  // RÈGLE DE GRAPPE (Adrien) : « si un nuage est plat, au moins un autre doit
  // être plus volumineux ». Une grappe entièrement plate lit comme une flaque ;
  // il lui faut au moins une masse qui monte pour donner l'échelle. On promeut
  // le plus large, c'est celui qui portera le mieux du volume.
  if (!out.some((c) => c.h / c.r >= VOLUMINOUS)) {
    let big = out[0]
    for (const c of out) if (c.r > big.r) big = c
    big.h = big.r * (VOLUMINOUS + rng() * 0.25)
  }
  return out
}

// Vecteur unitaire du vent + sa perpendiculaire (repère de traversée).
function windFrame(wind) {
  const d = wind?.dir ?? 0
  return { ux: Math.cos(d), uz: Math.sin(d), px: -Math.sin(d), pz: Math.cos(d) }
}

// Distance PARCOURUE le long du vent, comptée depuis l'amont : c'est elle qui
// dit si une grappe de passage est encore en approche, sur la carte, ou déjà
// sortie — bien plus stable que de regarder x et z séparément.
function alongWind(c, fr) {
  return c.x * fr.ux + c.z * fr.uz
}

// Effacement AUX BORDS : 1 sur la carte, 0 une fois loin dehors. C'est ce qui
// fait « naître et disparaître hors de la map » sans aucun pop.
function edgeFade(c, opts) {
  const over = Math.max(0, Math.max(Math.abs(c.x), Math.abs(c.z)) - opts.half)
  return 1 - smooth(clamp01(over / Math.max(1e-3, opts.fadeOut)))
}

// Une grappe DE PASSAGE : posée en amont, hors carte, elle traverse et meurt
// en aval. `prefill` la pose à un point quelconque de sa traversée — sinon le
// premier ciel serait vide le temps que tout le monde arrive.
function spawnTransitCluster(rng, opts, wind, prefill = false) {
  const fr = windFrame(wind)
  const core = spawnCloud(rng, opts)
  const reach = opts.half + opts.fadeOut
  const along = prefill ? -reach + rng() * 2 * reach : -reach
  const lat = (rng() * 2 - 1) * opts.half
  core.x = fr.ux * along + fr.px * lat
  core.z = fr.uz * along + fr.pz * lat
  core.transit = true
  // il ne mourra pas de vieillesse en route : sa durée de vie couvre largement
  // la traversée, c'est la SORTIE de carte qui l'emporte
  core.span = 600 + rng() * 600
  core.age = 0.2 + rng() * 0.25 // installé, en pleine maturité
  const cluster = buildCluster(rng, opts, core)
  for (const c of cluster) { c.transit = true; c.fade = edgeFade(c, opts) }
  return cluster
}

// Une grappe LOCALE : elle vit et se disloque sur place, dans la carte.
function spawnLocalCluster(rng, opts, ageAtBirth = 0) {
  const core = spawnCloud(rng, { ...opts, ageAtBirth })
  core.transit = false
  return buildCluster(rng, opts, core)
}

function spawnCluster(rng, opts, { prefill = false } = {}) {
  const wind = opts.wind ?? { dir: 0.8, speed: 0.6 }
  // sans vent, personne ne traverse : tout le monde vit sur place, sinon le
  // ciel resterait planté hors champ
  const moving = (wind.speed ?? 0) > 0.05
  if (moving && rng() < TRANSIT_SHARE) return spawnTransitCluster(rng, opts, wind, prefill)
  return spawnLocalCluster(rng, opts, prefill ? rng() : 0)
}

function groupCount(clouds) {
  const s = new Set()
  for (const c of clouds) s.add(c.gid)
  return s.size
}

export const SKY_DEFAULTS = {
  half: 26, // demi-étendue du peuplement, en unités monde
  baseY: 5,
  topY: 9,
  sizeMin: 2.5,
  sizeMax: 6.5,
  fadeOut: 14, // largeur de la bande d'apparition/disparition, HORS carte
  // injectés par le rendu (absents = pas d'orographie, le module reste pur)
  terrainAt: null, // (x, z) -> hauteur du sol en unités monde
  waterY: -Infinity, // surface de l'eau : un nuage ne descend pas dessous
  wind: { dir: 0.8, speed: 0.6 },
}

// Crée un ciel peuplé. Les âges et les positions de traversée sont répartis
// d'entrée pour que le ciel soit « déjà vivant » à la première image.
export function createSky({ count = 4, seed = 1, grouping = null, ...opts } = {}) {
  const o = { ...SKY_DEFAULTS, ...opts }
  const rng = makeRng(seed)
  // l'humeur du ciel (dispersé / bancs / front) se tire une fois et gouverne
  // toutes les naissances locales — un ciel garde son humeur
  o.grouping = grouping || drawGrouping(rng, o.half)
  // les ZONES d'altitude aussi : un ciel garde ses étages tout du long
  o.altZones = o.altZones || drawAltZones(rng)
  const clouds = []
  for (let i = 0; i < count; i++) clouds.push(...spawnCluster(rng, o, { prefill: true }))
  // `target` = nombre de GRAPPES voulu. Divisions et dislocations font monter
  // le compte d'entités au-dessus ; les morts le ramènent en douceur. Sans
  // cette cible, l'appelant remettait le compte à niveau chaque frame et
  // supprimait le nouveau-né — les nuages ne se divisaient JAMAIS.
  return { clouds, rng, opts: o, t: 0, target: count }
}

// DISLOCATION (Adrien : « s'ils disparaissent, ils disparaissent très très en
// douceur en se disloquant en plusieurs petits sous-nuages ») : au lieu de
// fondre sur place, une entité en fin de vie se rompt en lambeaux qui partent
// chacun de leur côté et s'éteignent à leur tour.
function dislocate(sky, c, rng) {
  const n = 3 + Math.floor(rng() * 3) // 3 à 5 lambeaux
  for (let f = 0; f < n && sky.clouds.length < CLOUD_HARD_MAX; f++) {
    const ang = (f / n) * Math.PI * 2 + rng() * 0.8
    const d = c.r * (0.25 + rng() * 0.6)
    const r = c.r * (0.18 + rng() * 0.2)
    const elong = drawElong(rng, 'voile') // les lambeaux s'étirent
    sky.clouds.push({
      ...c,
      seed: rng() * 1000,
      x: c.x + Math.cos(ang) * d,
      z: c.z + Math.sin(ang) * d,
      y: c.y + (rng() - 0.5) * c.h,
      r,
      elong,
      h: c.h * (0.25 + rng() * 0.35),
      age: 0.42, // déjà mûr : il ne fera que se déliter
      span: 22 + rng() * 26,
      rTarget: 0,
      density: c.density * (0.45 + rng() * 0.35),
      speed: c.speed * (0.9 + rng() * 0.5),
      wisp: clamp01((c.wisp ?? 0) + 0.3 + rng() * 0.3),
      merging: false,
      shattered: true,
      lead: false,
    })
  }
  c.shattered = true
}

// Avance le ciel de dt secondes : advection par le vent, vieillissement,
// sorties de carte, remplacement des grappes parties. MUTE le ciel (appelé
// chaque frame) et le renvoie.
//
// wind : { dir (radians), speed (unités monde/s) }. La direction pilote aussi
// l'orographie en P2 — c'est la même donnée.
export function stepSky(sky, dt, { wind = { dir: 0, speed: 0.6 } } = {}) {
  if (!sky || !(dt > 0)) return sky
  const { opts, rng } = sky
  opts.wind = wind // les naissances suivent le vent du moment
  const fr = windFrame(wind)
  const wx = fr.ux * wind.speed
  const wz = fr.uz * wind.speed
  const lim = opts.half * 1.15 // marge de sortie pour les nuages locaux
  const reach = opts.half + opts.fadeOut // au-delà, un nuage de passage est sorti
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
    // croissance douce vers la cible de fusion (voir collisions ci-dessous)
    if (c.rTarget && c.rTarget > c.r) c.r += (c.rTarget - c.r) * Math.min(1, dt * 0.5)

    // ---- OROGRAPHIE : le relief soulève, freine et bloque
    if (opts.terrainAt) {
      const here = opts.terrainAt(c.x, c.z)
      // on sonde DEVANT, à la mesure du nuage : un gros nuage sent la montagne
      // de plus loin qu'un lambeau
      const probe = Math.max(1.5, c.r * 1.4)
      const ahead = opts.terrainAt(c.x + fr.ux * probe, c.z + fr.uz * probe)
      const rise = ahead - here
      const push = Math.min(1, wind.speed * 0.8) * dt
      if (rise > 0) {
        c.y += Math.min(rise, c.h * 2) * OROG_LIFT * push
        c.r += c.r * OROG_GROW * push * Math.min(1, rise / Math.max(c.h, 1e-3))
        // il FREINE en escaladant : le ciel s'entasse au vent des crêtes
        const slow = 1 - Math.min(OROG_DRAG, rise / Math.max(probe, 1e-3))
        c.x -= wx * c.speed * par * dt * (1 - slow)
        c.z -= wz * c.speed * par * dt * (1 - slow)
      } else if (rise < 0) {
        c.y += Math.max(rise, -c.h * 2) * OROG_SINK * push
        c.r -= c.r * OROG_GROW * 0.6 * push * Math.min(1, -rise / Math.max(c.h, 1e-3))
      }
      // BUTÉE : la base reste au-dessus du sol (et de l'eau, si on la connaît)
      const ground = Math.max(here, opts.waterY ?? -Infinity)
      const floor = ground + c.h * OROG_CLEAR
      if (c.y < floor) c.y += (floor - c.y) * Math.min(1, dt * 4)
      // et il ne monte pas au ciel non plus
      const ceil = topY + (topY - baseY) * 0.6
      if (c.y > ceil) c.y = ceil
      c.r = clamp(c.r, opts.sizeMin * 0.35, opts.sizeMax * 1.7)
    }

    if (c.transit) {
      // DE PASSAGE : pas d'enroulement, pas de mort de vieillesse. Il entre
      // par un bord, traverse, et ne s'éteint qu'une fois DEHORS (Adrien).
      c.fade = edgeFade(c, opts)
      c.age = Math.min(0.5, c.age + dt / c.span) // évolue à peine, jamais ne meurt
      if (alongWind(c, fr) > reach) {
        sky.clouds.splice(i, 1)
        i--
      }
      continue
    }

    // LOCAL : le ciel s'enroule, l'entité vieillit et se disloque en fin de vie
    if (c.x > lim) c.x -= 2 * lim
    else if (c.x < -lim) c.x += 2 * lim
    if (c.z > lim) c.z -= 2 * lim
    else if (c.z < -lim) c.z += 2 * lim
    c.fade = 1
    c.age += dt / c.span
    // la dislocation se déclenche AVANT la mort : les lambeaux prennent le
    // relais pendant que le parent s'efface — aucune disparition sèche
    if (!c.shattered && c.age > 0.6 && c.r > opts.sizeMin * 0.55 && sky.clouds.length + 3 <= CLOUD_HARD_MAX) {
      dislocate(sky, c, rng)
    }
    if (c.age >= 1) {
      sky.clouds.splice(i, 1)
      i--
    }
  }
  // COLLISIONS (Adrien) : deux nuages mûrs qui se recouvrent fusionnent — le
  // plus gros ABSORBE (il enfle vers le volume combiné, en douceur), le petit
  // bascule en dissipation. Vu de loin : deux masses qui se rejoignent en une.
  // Les membres d'une MÊME grappe ne fusionnent pas : ils sont censés vivre
  // côte à côte dans le même corps.
  const maxR = opts.sizeMax * 1.7
  for (let i = 0; i < sky.clouds.length; i++) {
    for (let j = i + 1; j < sky.clouds.length; j++) {
      const a = sky.clouds[i], b = sky.clouds[j]
      if (!a || !b || a.merging || b.merging || a.gid === b.gid) continue
      // seuls des nuages installés fusionnent (ni naissants ni mourants)
      if (a.age < 0.12 || a.age > 0.55 || b.age < 0.12 || b.age > 0.55) continue
      const d = Math.hypot(a.x - b.x, a.z - b.z)
      if (d >= (a.r + b.r) * 0.55) continue
      const big = a.r >= b.r ? a : b
      const small = big === a ? b : a
      big.rTarget = Math.min(maxR, Math.hypot(big.r, small.r)) // ~volume combiné
      if (small.transit) { small.transit = false; small.span = 40 + rng() * 30 }
      small.age = Math.max(small.age, 0.62) // le petit se dissout dans le gros
      small.merging = true
    }
  }
  // REPEUPLEMENT : dès qu'une grappe a fini de sortir (ou de se disloquer), une
  // autre prend le relais, en amont du vent.
  let guard = 0
  while (groupCount(sky.clouds) < (sky.target ?? 0) && sky.clouds.length + CLUSTER_MAX <= CLOUD_HARD_MAX && guard++ < 8) {
    sky.clouds.push(...spawnCluster(rng, opts))
  }
  return sky
}

// Ajuste le peuplement sans rejouer le ciel (le palier de perf peut changer en
// cours de route, et le curseur de densité aussi). Le compte est en GRAPPES :
// on retire les grappes entières en trop, on en ajoute quand il en manque.
export function resizeSky(sky, count) {
  const n = Math.max(0, count | 0)
  if (!sky) return sky
  sky.target = n
  while (groupCount(sky.clouds) > n) {
    const last = sky.clouds[sky.clouds.length - 1].gid
    sky.clouds = sky.clouds.filter((c) => c.gid !== last)
  }
  let guard = 0
  while (groupCount(sky.clouds) < n && sky.clouds.length + CLUSTER_MAX <= CLOUD_HARD_MAX && guard++ < 16) {
    sky.clouds.push(...spawnCluster(sky.rng, sky.opts, { prefill: true }))
  }
  return sky
}

// Densité effective d'un nuage à cet instant : sa densité propre pondérée par
// son enveloppe de vie ET par son effacement aux bords. 0 = invisible — c'est
// ce que le rendu utilise pour faire apparaître/disparaître sans « pop ».
export function cloudDensity(c) {
  return c.density * lifeEnvelope(c.age) * (c.fade ?? 1)
}

// Échelle effective : un nuage naissant (ou qui sort de la carte) est aussi
// plus PETIT, pas seulement plus transparent — sinon il « apparaît » à sa
// taille finale et ça se voit.
export function cloudScale(c) {
  const e = lifeEnvelope(c.age) * (c.fade ?? 1)
  return 0.55 + 0.45 * e
}
