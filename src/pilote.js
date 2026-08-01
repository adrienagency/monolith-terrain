// LE PILOTE — une caméra qui vole comme un aéronef, pas comme un drone.
//
// Adrien : « j'ai besoin d'une VRAIE caméra intelligente, qui détecte des
// éléments à suivre, des vallées dans les montagnes, qui passe au ras du sol à
// travers une vallée […] qui se comporte comme un pilote d'avion ou
// d'hélicoptère, et qui n'aille jamais se crasher. »
//
// CE MODULE EST PUR. Pas de three.js, pas de DOM, pas de ShibuMap : il reçoit
// un échantillonneur d'altitude `(x, z) => hauteur`, un demi-bloc `half`, un
// profil de vol, et il rend des POSES. C'est ce qui le rend testable
// (test/pilote.test.js) et réutilisable ailleurs.
//   → L'adaptateur three.js vit dans src/pilote-cam.js, et lui seul.
//   → CONTRAT D'EXTRACTION : pour emporter ce cœur dans un autre projet, il faut
//     emmener avec lui le bloc « grille de relief » de camera-shots.js
//     (buildHeightGrid, gridToWorld, worldToGrid, sampleGrid, resampleXZ,
//     smoothXZ) — il est déjà pur et ne sait rien du socle ni des blocs. On ne
//     le duplique pas ici : 120 lignes recopiées se seraient désynchronisées.
//
// ============================================================================
// CE QUI SÉPARE CE MODULE D'UNE CAMÉRA DRONE
// ============================================================================
//
// 1. ELLE S'INCLINE. C'est LE tell visuel : un aéronef qui vire s'incline, et
//    l'horizon bascule dans le cadre. Une caméra qui change de cap en restant
//    horizontale se lit immédiatement comme un logiciel. L'inclinaison suit le
//    virage coordonné, φ = atan(v²/(g·r)), et son ÉTABLISSEMENT est borné en
//    vitesse : un avion met une à deux secondes à s'incliner, il ne claque pas.
//
// 2. ELLE REGARDE LOIN DEVANT, PAS SOUS ELLE. La règle réelle est « on regarde
//    là où on sera dans 10 à 20 secondes ». Voir POURQUOI CE N'EST PAS 10 s ICI
//    au paragraphe `tVisee` plus bas — on transpose le RAPPORT, pas la seconde.
//
// 3. ELLE NE SE CRASHE PAS PARCE QU'ELLE A UN PLAN, pas parce qu'elle a des
//    réflexes. Une caméra qui n'évite qu'en réagissant finit toujours coincée :
//    c'est le CANYON EN CUL-DE-SAC (box canyon), la faute classique qui tue de
//    vrais pilotes. Ici le couloir est calculé, sa SORTIE est prouvée, et sa
//    largeur est vérifiée AVANT l'engagement (verifierCouloir). L'évitement
//    réactif (chooseHeading) reste, mais comme garde-fou de dernier recours.
//
// 4. ELLE ANTICIPE LE RELIEF au lieu de le suivre. Un pilote bas commence à
//    monter AVANT la crête. La garde au sol se calcule sur le MAXIMUM du relief
//    dans la fenêtre d'anticipation, jamais sur le point courant — sinon on rase
//    la vallée puis on percute la crête.
//
// 5. ELLE A UNE ÉNERGIE FINIE. En virage, la portance disponible pour monter
//    chute en cos φ. Traduction : quand elle vire, elle monte moins ; quand elle
//    monte, elle vire moins. Faire les deux à fond a l'air d'un jeu vidéo.
//
// ============================================================================
// LES UNITÉS, ET POURQUOI IL Y A UNE « GRAVITÉ DE SCÈNE »
// ============================================================================
//
// Tout est exprimé en DEMI-BLOCS (`half`) et en secondes : le vol se comporte
// pareil quelle que soit l'échelle du bloc.
//
// Le bloc est une MAQUETTE, pas un morceau de planète : 56 unités monde pour
// 27 km de terrain à Chamonix z12. Une caméra qui traverse le bloc en 27 s y
// avance à ~1 km/s, soit Mach 3. Appliquer la vraie g = 9,81 m/s² donnerait donc
// des inclinaisons absurdes (des virages de 100 km de rayon).
//
// On garde donc les RELATIONS du vol coordonné, et on calibre la constante :
// G_SCENE est choisie pour qu'au rayon de virage nominal et à la vitesse de
// croisière, l'inclinaison vaille 30° — l'inclinaison de survol standard.
// C'est un choix ASSUMÉ et documenté, pas une physique déguisée.

import {
  buildHeightGrid, gridToWorld, worldToGrid, sampleGrid,
  resampleXZ, smoothXZ,
} from './camera-shots.js'

export { buildHeightGrid }

const TAU = Math.PI * 2
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t

// écart d'angle ramené dans (−π, π] — sans ça un virage de 190° se ferait du
// mauvais côté, et un demi-tour partirait dans le décor
export function angleWrap(a) {
  let r = (a + Math.PI) % TAU
  if (r < 0) r += TAU
  return r - Math.PI
}

// convention de cap du dépôt : x = sin(cap), z = cos(cap). Le nord est −Z.
export const capDe = (dx, dz) => Math.atan2(dx, dz)

// =========================================================== profils de vol
//
// DEUX PERSONNALITÉS, et elles ne servent pas au même plan. Adrien les nomme
// toutes les deux ; ce ne sont pas deux réglages du même appareil.
//
// ⚠️ LA MESURE QUI DÉCIDE, ET QUI SURPREND : à l'échelle d'un bloc z12, UN AVION
// NE PEUT PAS FAIRE DEMI-TOUR DANS UNE VALLÉE. Un fond de vallée de Chamonix
// fait 1 à 2 km, soit 0,07 à 0,15 demi-bloc ; le demi-tour d'un avion à la
// vitesse de croisière demande 2 × 0,16 = 0,32 demi-bloc. C'est exactement le
// piège réel : on s'engage dans un couloir où l'on ne peut plus se retourner.
// Ce n'est donc PAS un défaut du modèle, c'est la contrainte qu'il fallait
// reproduire — et elle impose au profil `avion` de ne s'engager QUE dans un
// couloir dont la sortie est prouvée. L'hélicoptère, lui, se retourne sur place.
//
// Toutes les longueurs sont en demi-blocs, les vitesses en demi-blocs/seconde.
export const PROFILS = {
  // ---- AVION : le survol de vallée, entrée → sortie, demi-tour au débouché.
  avion: {
    nom: 'avion',
    // Vitesse MINIMALE NON NULLE : un avion ne s'arrête pas. C'est ce qui rend
    // son mouvement fluide, et c'est aussi ce qui lui interdit de « chercher »
    // sur place quand il est coincé — d'où l'obligation du plan.
    vMin: 0.055,
    vCroisiere: 0.080, // ~27 s pour traverser le bloc en diagonale : la durée d'un plan
    vMax: 0.105,
    // Rayon de virage NOMINAL, celui sur lequel on planifie. Le rayon
    // dynamique réel peut descendre plus bas à l'inclinaison maximale ; on
    // planifie avec de la marge, comme en vrai.
    rayon: 0.16,
    rouliMax: (45 * Math.PI) / 180, // un plan de survol reste sous 45°
    // Établissement de l'inclinaison : ~1,3 s pour atteindre 45°. Un avion ne
    // claque pas son roulis, et c'est CE détail qui trahit une caméra logicielle.
    tauxRouli: 0.60,
    garde: 0.030, // garde au sol : on frôle vraiment (≈0,84 unité sur un bloc de 56)
    montMax: 0.030, // ~21° de pente de montée à la vitesse de croisière
    tVisee: 5.5, // voir POURQUOI CE N'EST PAS 10 s, plus bas
    tVeille: 3.2, // la garde au sol regarde 3,2 s devant elle
    tPoursuite: 2.4, // constante de la poursuite pure le long du couloir
    // décalage latéral dans le couloir, en fraction de la largeur libre du côté
    // choisi : « on vole sur un côté, pas au milieu » — ça laisse le rayon de
    // virage disponible du côté large.
    cote: 0.28,
  },
  // ---- HÉLICOPTÈRE : l'approche d'un sommet, le tour d'un point d'intérêt,
  // et le SEUL des deux qui puisse se retourner à l'intérieur d'une vallée.
  helico: {
    nom: 'helico',
    vMin: 0, // il peut s'arrêter, et c'est toute la différence
    vCroisiere: 0.036,
    vMax: 0.055,
    rayon: 0.045, // demi-tour en 0,09 demi-bloc : ça tient dans un vrai fond de vallée
    rouliMax: (25 * Math.PI) / 180, // il s'incline peu : il translate
    tauxRouli: 0.90,
    garde: 0.022,
    montMax: 0.036, // il monte aussi vite qu'il avance
    tVisee: 3.0, // 2,4 rayons de virage — le meme rapport que l'avion
    tVeille: 3.6,
    tPoursuite: 1.7,
    cote: 0.20,
  },
}

// POURQUOI tVisee N'EST PAS 10 s.
//
// La règle réelle est « on regarde là où on sera dans 10 à 20 secondes ». À
// 80 m/s et 30° d'inclinaison, un avion a un rayon de virage de ~700 m et
// regarde donc entre 800 et 1 600 m devant lui : entre 1,2 et 2,3 RAYONS DE
// VIRAGE. C'est ce RAPPORT qu'on transpose, pas la seconde — le bloc est une
// maquette, et 10 s de vol y couvriraient 0,8 demi-bloc, soit presque toute la
// scène : le point de visée sortirait du couloir.
//
// Vérification sur le profil avion : 5,5 s × 0,080 = 0,44 demi-bloc = 2,75 ×
// rayon (0,16). On est dans la fourchette réelle, du côté long — un plan de
// cinéma gagne à regarder loin. Le test `le point de visee vaut 1 a 3 rayons de
// virage` verrouille ce rapport.

// Résout un profil en unités monde pour un bloc donné, et calcule les grandeurs
// dérivées (gravité de scène, vitesse de lacet maximale).
export function resoudreProfil(nom, half, surcharge = {}) {
  const p = { ...(PROFILS[nom] || PROFILS.avion), ...surcharge }
  const v = p.vCroisiere * half
  const r = p.rayon * half
  // G_SCENE : calibrée pour que le virage au rayon nominal, à la vitesse de
  // croisière, s'incline de 30° — l'inclinaison de survol standard.
  // tan(30°) = 0,5774 ; g = v² / (r · tan φ).
  const g = (v * v) / (r * Math.tan((30 * Math.PI) / 180))
  return {
    ...p,
    half,
    g,
    v,
    vMin: p.vMin * half,
    vMax: p.vMax * half,
    rayon: r,
    garde: p.garde * half,
    montMax: p.montMax * half,
    // ω = v / r : la vitesse de lacet qui donne le rayon nominal. Le demi-tour
    // dure alors π/ω — 6,3 s pour l'avion, 4,0 s pour l'hélicoptère.
    omegaMax: v / r,
    // distances dérivées des temps (règle du pilote : tout est une durée)
    dVisee: p.tVisee * v,
    dVeille: p.tVeille * v,
    dPoursuite: p.tPoursuite * v,
  }
}

// ================================================== virage coordonné & roulis
//
// r = v² / (g · tan φ), donc φ = atan(v² / (g · r)), et pour une vitesse de
// lacet ω (= v/r) : tan φ = v·ω / g. C'est cette dernière forme qu'on utilise :
// le contrôleur commande un ω, l'inclinaison en découle. L'inclinaison n'est
// JAMAIS commandée directement — c'est ce qui garantit qu'elle est toujours
// cohérente avec le virage vu à l'écran.

export function rouliCoordonne(v, omega, g) {
  if (!(g > 0)) return 0
  return Math.atan((v * omega) / g)
}

export function rayonDeVirage(v, roulis, g) {
  const t = Math.tan(Math.abs(roulis))
  if (!(t > 1e-6) || !(g > 0)) return Infinity
  return (v * v) / (g * t)
}

// L'ÉNERGIE. En virage, la composante verticale de la portance chute en cos φ :
// on ne peut pas virer serré ET monter fort. Ce facteur multiplie la montée
// disponible, et c'est lui qui empêche la caméra de faire les deux à fond.
export function facteurEnergie(roulis) {
  return Math.max(0.15, Math.cos(roulis))
}

// ======================================================== lecture du relief

// ENCAISSEMENT d'un point : de combien le relief le domine DE PART ET D'AUTRE.
// C'est la mesure qui distingue un fond de vallée d'une plaine — une plaine est
// basse mais pas encaissée, une vallée est basse ENTRE DEUX FLANCS.
//
// ⚠️ CE QUI NE MARCHE PAS, ET QUI A ÉTÉ MESURÉ. La première version prenait le
// minimum sur les HUIT directions. Résultat : 0 partout, y compris au fond de la
// vallée d'essai dont les crêtes culminent 28 unités plus haut. La raison est
// évidente une fois vue — une vallée est FERMÉE en travers mais OUVERTE dans son
// axe : la direction « le long du fond » ne rencontre aucun mur, et le minimum
// sur huit directions vaut donc toujours ~0. La mesure disait « aucune vallée
// nulle part », et le classement se rabattait sur les couloirs de bord de bloc.
//
// La bonne mesure travaille par PAIRES OPPOSÉES. Pour chacun des quatre axes on
// prend `min(mur d'un côté, mur de l'autre)` — c'est le confinement selon cet
// axe — puis on garde le MEILLEUR des quatre. Un fond de vallée est confiné
// selon l'axe travers et libre selon son axe : le maximum sur les axes le
// trouve, le minimum le manquait.
export function encaissement(g, rayonCells = 6) {
  const n = g.n
  const out = new Float32Array(n * n)
  const axes = [[1, 0], [0, 1], [1, 1], [1, -1]]
  const murVers = (i, j, di, dj, h0) => {
    let hi = h0
    for (let k = 1; k <= rayonCells; k++) {
      const ni = i + di * k
      const nj = j + dj * k
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) break
      const v = g.h[nj * n + ni]
      if (v > hi) hi = v
    }
    return hi - h0
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const h0 = g.h[j * n + i]
      let best = 0
      for (const [di, dj] of axes) {
        const conf = Math.min(murVers(i, j, di, dj, h0), murVers(i, j, -di, -dj, h0))
        if (conf > best) best = conf
      }
      out[j * n + i] = best
    }
  }
  return out
}

// LARGEUR LIBRE perpendiculairement au cap, à l'altitude `y`. C'est la mesure
// qui décide si un demi-tour tient dans le couloir, et donc s'il y a une PORTE
// DE SORTIE. On scrute des deux côtés jusqu'à `portee`, et on s'arrête au
// premier point où le relief (+ garde) dépasse l'altitude de vol.
// ⚠️ LE PAS EST FIN, ET CE N'EST PAS DU LUXE. À portee/24 (2,08 unités sur un
// bloc de 100) le premier échantillon tombait au-delà du ruban de sécurité de
// la voie : sur le moindre dévers, la mesure renvoyait 0 — « aucune largeur
// libre » au milieu d'une vallée de 22 unités de large. Tous les couloirs du
// profil hélicoptère étaient refusés pour « trop étroit ». Un instrument trop
// grossier ne mesure pas mal, il ment.
export function largeurLibre({ sampleGround, x, z, cap, y, garde, portee, pas }) {
  const step = pas || portee / 48
  const droite = cap + Math.PI / 2
  const mesure = (signe) => {
    const dx = Math.sin(droite) * signe
    const dz = Math.cos(droite) * signe
    for (let d = step; d <= portee; d += step) {
      const s = sampleGround(x + dx * d, z + dz * d)
      if ((Number.isFinite(s) ? s : 0) + garde > y) return d - step
    }
    return portee
  }
  const gche = mesure(-1)
  const drte = mesure(1)
  return { gauche: gche, droite: drte, total: gche + drte }
}

// ALTITUDE DE SÉCURITÉ : le maximum du relief sur la fenêtre d'anticipation,
// plus la garde. C'est ce qui fait monter la caméra AVANT la crête au lieu de la
// percuter. Le suivi de terrain réel travaille sur le profil lu EN AVANT, jamais
// sur le sol sous l'appareil — un « ras du sol » à hauteur constante est faux.
//
// ⚠️ ON REGARDE LE LONG DE L'ARC, PAS DE LA DROITE — la mesure la plus vicieuse
// des quatre. Toutes les pointes d'accélération du vol d'essai (1 702 u/s² pour
// un plafond de manœuvre de 10) tombaient DANS LE DEMI-TOUR, sans exception.
// La cause : la veille scrutait une ligne droite au cap courant pendant que
// l'appareil, lui, suivait un arc de rayon 16 — il découvrait sous lui un relief
// que personne n'avait regardé, et le plancher le rattrapait d'un bond de 1
// unité par image, vingt fois le taux de montée. La veille suit donc la
// TRAJECTOIRE PRÉVUE : à la distance t, le cap vaut cap + courbure × t, où
// courbure = ω/v (radians par unité parcourue).
export function pointsDevant({ x, z, cap, distance, courbure = 0, pas = 6 }) {
  const out = [{ x, z, cap }]
  const dl = distance / pas
  let px = x
  let pz = z
  let c = cap
  for (let i = 1; i <= pas; i++) {
    c += courbure * dl
    px += Math.sin(c) * dl
    pz += Math.cos(c) * dl
    out.push({ x: px, z: pz, cap: c })
  }
  return out
}

// ⚠️ LE RUBAN, PAS LE RAYON — et c'est le bruit qui l'a imposé. Avec un simple
// cône à trois rayons, le plancher de dernier recours s'engageait 105 fois sur
// 2 700 pas (3,9 %) dès qu'on salissait le relief d'essai de ±1,5 unité : une
// pointe de bruit à un mètre de l'axe n'était vue par aucun rayon, la caméra la
// découvrait sous elle, et le plancher la rattrapait d'un saut. On balaie donc
// un RUBAN : à chaque pas en avant, on relève aussi le relief de part et
// d'autre, sur la largeur que l'appareil peut réellement occuper, et ce ruban
// s'ÉVASE avec la distance — l'incertitude sur la trajectoire grandit à mesure
// qu'on regarde loin. Un relief réel porte du bruit ; les cas d'école, non.
export function altitudeSecuritaire({ sampleGround, x, z, cap, distance, garde, courbure = 0, pas = 6, evasement = 0.3, lateral = 0 }) {
  const lat = lateral || garde
  const arc = pointsDevant({ x, z, cap, distance, courbure, pas })
  let h = -Infinity
  for (let i = 0; i < arc.length; i++) {
    const p = arc[i]
    const perp = p.cap + Math.PI / 2
    const etal = lat + (evasement * distance * i) / pas
    for (const u of [0, lat, -lat, etal, -etal]) {
      const s = sampleGround(p.x + Math.sin(perp) * u, p.z + Math.cos(perp) * u)
      if (Number.isFinite(s) && s > h) h = s
    }
  }
  return (h === -Infinity ? 0 : h) + garde
}

// ====================================================== détection des couloirs
//
// ⚠️ SUR QUOI ON CLASSE, ET POURQUOI (« le point d'intérêt, pas une zone au
// hasard »). Un couloir candidat est noté sur trois grandeurs mesurables :
//
//   · ENCAISSEMENT MOYEN — le dénivelé local entre le fond et ses deux flancs.
//     C'est la mesure qui dit « c'est une vallée » et pas « c'est une plaine ».
//     Elle porte le plus gros poids : sans parois, il n'y a pas de plan.
//   · LONGUEUR FRANCHISSABLE — un couloir long donne du plan ; un couloir de
//     trois cellules est un col, pas une vallée.
//   · PLATITUDE DU PROFIL — un couloir qui monte sans arrêt épuise la montée
//     disponible et finit en cul-de-sac ; on le pénalise.
//
// Rien n'est tiré au sort. Le tirage n'intervient QUE pour départager des
// couloirs de score voisin, et seulement si l'appelant fournit un `rng`.
//
// ⚠️ LA VOIE ROYALE, QUI N'EST PAS BRANCHÉE ICI. Les rivières SONT les fonds de
// vallée, et quelqu'un a déjà fait le travail : le calque `rivers` de ShibuMap
// (src/map/water-layer.js) porte des couloirs RÉELS, pas des artefacts de
// calcul. Elles ne sont pas exploitables telles quelles — le calque les rend
// dans une texture drapée, il ne conserve pas de polylignes en coordonnées
// monde — donc `planifierVol` accepte un paramètre `couloirsFournis` : le jour
// où le calque exposera ses tracés, on les branche là, sans toucher au reste.

// petit tas binaire — Dijkstra sur 3 136 cellules, rien à importer
class Tas {
  constructor() { this.a = [] }
  get size() { return this.a.length }
  push(node) {
    const a = this.a
    a.push(node)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].c <= a[i].c) break
      const t = a[p]; a[p] = a[i]; a[i] = t
      i = p
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l].c < a[m].c) m = l
        if (r < a.length && a[r].c < a[m].c) m = r
        if (m === i) break
        const t = a[m]; a[m] = a[i]; a[i] = t
        i = m
      }
    }
    return top
  }
}

// Champ de plus-court-chemin DEPUIS une cellule, à 8 voisins, où le coût n'est
// pas la distance mais l'ALTITUDE : traverser une crête coûte `penteMontee` fois
// plus cher que longer le fond. Le chemin résultant est, littéralement, la ligne
// de plus faible altitude — c'est la recette de findCorridor (camera-shots.js),
// mais SANS arrêt anticipé : une seule passe donne TOUS les débouchés d'une même
// entrée, ce qui fait 8 Dijkstra au lieu de 64 pour 8 entrées × 8 sorties.
export function champDijkstra(g, from, { coutAltitude = 10, coutMontee = 6 } = {}) {
  const n = g.n
  const range = g.max - g.min || 1
  const a = worldToGrid(g, from.x, from.z)
  const src = a.j * n + a.i
  const dist = new Float64Array(n * n).fill(Infinity)
  const prev = new Int32Array(n * n).fill(-1)
  const vu = new Uint8Array(n * n)
  dist[src] = 0
  const pq = new Tas()
  pq.push({ k: src, c: 0 })
  while (pq.size) {
    const { k } = pq.pop()
    if (vu[k]) continue
    vu[k] = 1
    const i = k % n
    const j = (k - i) / n
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue
        const nk = nj * n + ni
        if (vu[nk]) continue
        const pas = Math.hypot(di, dj) * g.cell
        const hn = (g.h[nk] - g.min) / range
        const montee = Math.max(0, g.h[nk] - g.h[k]) / range
        const c = dist[k] + pas * (1 + coutAltitude * hn) + coutMontee * montee * g.cell
        if (c < dist[nk]) { dist[nk] = c; prev[nk] = k; pq.push({ k: nk, c }) }
      }
    }
  }
  return { dist, prev, src }
}

export function cheminDepuisChamp(g, champ, to) {
  const n = g.n
  const b = worldToGrid(g, to.x, to.z)
  let k = b.j * n + b.i
  if (!Number.isFinite(champ.dist[k])) return []
  const out = []
  const garde = new Set()
  while (k !== -1 && !garde.has(k)) {
    garde.add(k)
    const i = k % n
    const j = (k - i) / n
    const w = gridToWorld(g, i, j)
    out.push({ x: w.x, z: w.z })
    if (k === champ.src) break
    k = champ.prev[k]
  }
  out.reverse()
  return out
}

// PORTES DU BLOC : les points bas du bord, un par « creux » de la ligne de bord.
// Ce sont les entrées et sorties possibles d'un couloir — « je vais suivre cette
// vallée de son entrée à sa sortie SUR LE CUBE » (Adrien).
//
// On ne garde qu'un minimum local par creux (séparation minimale), sinon huit
// cellules voisines du même fond de vallée compteraient pour huit portes et le
// classement serait noyé.
export function portesDuBloc(g, { plafond = 0.45, separation = 5 } = {}) {
  const n = g.n
  const range = g.max - g.min || 1
  const lim = g.min + range * plafond
  const cotes = [
    { nom: 'N', cell: (t) => ({ i: t, j: 0 }) },
    { nom: 'S', cell: (t) => ({ i: t, j: n - 1 }) },
    { nom: 'O', cell: (t) => ({ i: 0, j: t }) },
    { nom: 'E', cell: (t) => ({ i: n - 1, j: t }) },
  ]
  const out = []
  for (const c of cotes) {
    const h = []
    for (let t = 0; t < n; t++) {
      const { i, j } = c.cell(t)
      h.push(g.h[j * n + i])
    }
    // minima locaux sous le plafond, puis élagage par séparation
    const cands = []
    for (let t = 1; t < n - 1; t++) {
      if (h[t] > lim) continue
      if (h[t] <= h[t - 1] && h[t] <= h[t + 1]) cands.push(t)
    }
    cands.sort((a, b) => h[a] - h[b])
    const pris = []
    for (const t of cands) {
      if (pris.some((u) => Math.abs(u - t) < separation)) continue
      pris.push(t)
      const { i, j } = c.cell(t)
      const w = gridToWorld(g, i, j)
      out.push({ cote: c.nom, x: w.x, y: h[t], z: w.z, i, j })
    }
  }
  return out
}

// Un point est-il SUR le bord du bloc (à une cellule près) ? C'est le critère de
// la sortie prouvée : un couloir qui s'arrête au milieu du bloc n'a pas de sortie.
export function surLeBord(g, p, marge = 1.5) {
  const lim = g.half - g.cell * marge
  return Math.abs(p.x) >= lim || Math.abs(p.z) >= lim
}

// ============================================== vérification avant engagement
//
// ⚠️ C'EST LA FONCTION QUI EMPÊCHE LE CRASH. « On ne s'engage jamais dans un
// couloir dont on n'a pas vérifié la sortie. » Elle est appelée AVANT le vol,
// jamais pendant.
//
// RÈGLE D'ENGAGEMENT, dans l'ordre où un pilote la vérifie :
//   (a) le couloir DÉBOUCHE — son dernier point est sur le bord du bloc ;
//   (b) le profil d'altitude est TENABLE — la montée exigée nulle part au-dessus
//       de ce que l'appareil sait faire, énergie comprise ;
//   (c) il reste une PORTE DE SORTIE — à tout instant, soit on peut faire
//       demi-tour (largeur ≥ 2 × rayon), soit la sortie est encore devant et
//       prouvée par (a) + (b).
//
// Un couloir qui échoue rend `{ ok: false, raison }`, et `raison` est lisible :
// 'sans-issue' · 'trop-etroit' · 'trop-raide'. Le vol ne part pas.
// LE PROFIL D'ALTITUDE TENABLE — la passe arrière, et c'est LA pièce qui
// détecte le canyon en cul-de-sac.
//
// ⚠️ CE QUI NE MARCHE PAS, ET QUI A ÉTÉ MESURÉ. La première version comparait la
// pente entre deux points consécutifs de l'altitude ANTICIPÉE. C'est faux : la
// fenêtre d'anticipation est un maximum glissant, donc une marche d'escalier —
// quand une crête entre dans la fenêtre, l'altitude requise saute d'un coup.
// Mesuré sur la vallée coudée d'essai, ça donnait une montée exigée de
// 24,9 unités/s pour une montée disponible de 2,1 : TOUS les couloirs étaient
// refusés, y compris ceux qui se volent les doigts dans le nez. La marche n'est
// pas une pente, c'est un artefact de la fenêtre.
//
// La bonne question est causale : « à quelle altitude dois-je être ICI pour
// pouvoir être au-dessus de tout ce qui vient, sans dépasser mon taux de
// montée ? » On la résout à REBOURS, depuis la sortie :
//
//     besoin[dernier] = sol + garde
//     besoin[i]       = max(sol[i] + garde, besoin[i+1] − penteMontée × ds)
//
// C'est un filtre max-plus, et son résultat est exactement le profil qu'un
// pilote vole : il commence à monter AVANT la crête, juste assez tôt.
//
// Et il donne le diagnostic gratuitement : si `besoin[0]` est très au-dessus du
// sol à l'entrée, c'est qu'il faudrait arriver DÉJÀ HAUT pour franchir ce qui
// vient — le couloir monte plus vite qu'on ne sait grimper. C'est la définition
// littérale du canyon en cul-de-sac, détectée AVANT l'engagement.
// HAUTEUR DE MANŒUVRE : ce qu'on gagne en altitude pendant un demi-demi-tour.
//
// ⚠️ POURQUOI LA LARGEUR NE SE MESURE PAS AU RAS DU FOND. Dans une vallée en V,
// la largeur libre à la hauteur de garde est presque nulle PAR CONSTRUCTION —
// c'est la définition d'un V. Mesurée là, la vérification refusait des vallées
// de 22 unités de large en annonçant « 0,0 ». Or un pilote qui doit se retourner
// ne se retourne pas au ras du fond : il monte d'abord. On mesure donc la place
// À L'ALTITUDE OÙ LA MANŒUVRE SE FERAIT, soit la garde plus ce qu'on gagne en
// montant pendant la moitié du demi-tour (montée disponible × π/2ω).
export function hauteurManoeuvre(profil) {
  return profil.montMax * facteurEnergie(profil.rouliMax) * (Math.PI / profil.omegaMax) * 0.5
}

export function profilTenable({ sol, ds, penteMontee, garde }) {
  const n = sol.length
  const besoin = new Float64Array(n)
  besoin[n - 1] = sol[n - 1] + garde
  for (let i = n - 2; i >= 0; i--) {
    besoin[i] = Math.max(sol[i] + garde, besoin[i + 1] - penteMontee * ds[i])
  }
  return besoin
}

export function verifierCouloir({ sampleGround, voie, profil }) {
  if (!voie || voie.length < 3) return { ok: false, raison: 'sans-issue', largeurMin: 0, hauteurEntree: 0 }
  const { garde, rayon, montMax, v } = profil
  const besoinDemiTour = 2 * rayon
  const portee = Math.max(besoinDemiTour * 1.25, profil.half * 0.5)

  // Le sol vu le long de la voie, ÉLARGI latéralement : l'appareil ne suit pas
  // la polyligne au millimètre (décalage sur un côté, corrections de cap), donc
  // on prend le relief le plus haut dans le ruban qu'il peut réellement occuper.
  const lat = rayon * 0.45
  const caps = []
  const sol = []
  const ds = []
  for (let i = 0; i < voie.length; i++) {
    const p = voie[i]
    const q = voie[Math.min(i + 1, voie.length - 1)]
    const cap = i === voie.length - 1
      ? capDe(p.x - voie[i - 1].x, p.z - voie[i - 1].z)
      : capDe(q.x - p.x, q.z - p.z)
    caps.push(cap)
    const perp = cap + Math.PI / 2
    let h = -Infinity
    for (const u of [-lat, 0, lat]) {
      const s = sampleGround(p.x + Math.sin(perp) * u, p.z + Math.cos(perp) * u)
      if (Number.isFinite(s) && s > h) h = s
    }
    sol.push(h === -Infinity ? 0 : h)
    if (i < voie.length - 1) ds.push(Math.hypot(q.x - p.x, q.z - p.z))
  }
  ds.push(ds[ds.length - 1] || 1)

  // Pente de montée disponible, SANS DIMENSION (unités de hauteur par unité
  // parcourue). `facteurEnergie(rouliMax)` : on exige que le couloir tienne MÊME
  // en virage — c'est la marge qui évite de découvrir en vol qu'on ne peut pas à
  // la fois suivre le méandre et franchir le verrou.
  const penteMontee = (montMax * facteurEnergie(profil.rouliMax)) / Math.max(v, 1e-6)
  const besoin = profilTenable({ sol, ds, penteMontee, garde })

  let hauteurMax = 0
  let largeurMin = Infinity
  let iEtroit = -1
  const hMan = hauteurManoeuvre(profil)
  for (let i = 0; i < voie.length; i++) {
    const h = besoin[i] - sol[i]
    if (h > hauteurMax) hauteurMax = h
    const l = largeurLibre({
      sampleGround, x: voie[i].x, z: voie[i].z, cap: caps[i],
      y: besoin[i] + hMan, garde, portee,
    })
    if (l.total < largeurMin) { largeurMin = l.total; iEtroit = i }
  }
  const hauteurEntree = besoin[0] - sol[0]

  // (a) LA SORTIE. Le dernier point doit être sur le bord du bloc : « on ne
  // s'engage jamais dans un couloir dont on n'a pas vérifié la sortie ».
  const fin = voie[voie.length - 1]
  const debouche = Math.abs(fin.x) >= profil.half * 0.92 || Math.abs(fin.z) >= profil.half * 0.92

  // (b) LA MONTÉE. Devoir entrer à plus de 6 gardes au-dessus du sol veut dire
  // que le verrou est plus raide que la capacité de montée : on ne s'engage pas.
  // 6 gardes = 18 unités sur un bloc de 100, soit un mur qu'il faudrait aborder
  // en survol et non en vallée — ce n'est plus le plan demandé.
  const plafondEntree = garde * 6
  if (hauteurEntree > plafondEntree) {
    return { ok: false, raison: 'trop-raide', largeurMin, hauteurEntree, hauteurMax, plafondEntree, debouche }
  }
  // (c) LA PORTE DE SORTIE. Sans débouché prouvé, il FAUT pouvoir se retourner
  // partout : c'est la définition même du cul-de-sac.
  if (!debouche && largeurMin < besoinDemiTour) {
    return { ok: false, raison: 'sans-issue', largeurMin, hauteurEntree, hauteurMax, iEtroit, debouche }
  }
  // Même avec un débouché, un couloir plus étroit que le virage de correction
  // n'est pas franchissable : on n'aurait aucune marge de manœuvre dedans.
  if (largeurMin < rayon * 0.6) {
    return { ok: false, raison: 'trop-etroit', largeurMin, hauteurEntree, hauteurMax, iEtroit, debouche }
  }
  return { ok: true, raison: null, largeurMin, hauteurEntree, hauteurMax, debouche, besoin, sol, caps }
}

// ==================================================== planification d'un vol
//
// Rend un PLAN validé, ou `null` si aucun couloir du bloc n'est engageable.
// Rendre `null` est un résultat, pas un échec : c'est le refus d'un pilote.

export function planifierVol({
  sampleGround, half, profil: nomProfil = 'avion', n = 56,
  couloirsFournis = null, grille = null, maxCandidats = 6, surcharge = {},
}) {
  const profil = resoudreProfil(nomProfil, half, surcharge)
  const g = grille || buildHeightGrid({ sampleGround, half, n })
  const enc = encaissement(g, Math.max(3, Math.round(n / 9)))

  // --- les candidats -------------------------------------------------------
  let candidats = []
  if (couloirsFournis?.length) {
    // Voie royale : des couloirs RÉELS (rivières) fournis par l'appelant. On ne
    // les invente pas, on les note et on les vérifie comme les autres.
    candidats = couloirsFournis.map((voie) => ({ voie, source: 'fourni' }))
  } else {
    const portes = portesDuBloc(g)
    // ⚠️ ON CHOISIT LES ENTRÉES SUR L'ENCAISSEMENT, PAS SUR L'ALTITUDE — et
    // c'est mesuré. En prenant simplement la porte la plus BASSE de chaque côté,
    // la vallée d'essai (dont tout le bord sud est au même niveau) donnait le
    // coin nord-ouest : un couloir de bord de bloc, encaissement moyen 2,4 sur
    // des crêtes de 30. Le vol était correct et le plan était plat. Une porte de
    // vallée n'est pas la plus basse du bord, c'est celle qui a des flancs.
    for (const p of portes) {
      const k = worldToGrid(g, p.x, p.z)
      p.encaissement = enc[k.j * g.n + k.i]
    }
    // deux entrées par côté au plus : huit Dijkstra, et on couvre les deux
    // débouchés d'un même massif sans explorer huit variantes du même fond.
    const parCote = new Map()
    for (const p of portes) {
      const l = parCote.get(p.cote) || []
      l.push(p)
      parCote.set(p.cote, l)
    }
    const entrees = []
    for (const l of parCote.values()) {
      l.sort((a, b) => b.encaissement - a.encaissement || a.y - b.y)
      entrees.push(...l.slice(0, 2))
    }
    for (const e of entrees) {
      const champ = champDijkstra(g, e)
      for (const s of portes) {
        // « de son entrée à SA SORTIE sur le cube » : une sortie sur le même côté
        // que l'entrée n'est pas une traversée, c'est un aller-retour.
        if (s.cote === e.cote) continue
        const voie = cheminDepuisChamp(g, champ, s)
        if (voie.length < 6) continue
        candidats.push({ voie, entree: e, sortie: s, source: 'dijkstra' })
      }
    }
  }
  if (!candidats.length) return null

  // --- le classement -------------------------------------------------------
  const range = g.max - g.min || 1
  for (const c of candidats) {
    let sEnc = 0
    let sAlt = 0
    for (const p of c.voie) {
      const k = worldToGrid(g, p.x, p.z)
      sEnc += enc[k.j * g.n + k.i]
      sAlt += sampleGrid(g, p.x, p.z)
    }
    const nP = c.voie.length
    let lg = 0
    for (let i = 1; i < nP; i++) lg += Math.hypot(c.voie[i].x - c.voie[i - 1].x, c.voie[i].z - c.voie[i - 1].z)
    c.encaissement = sEnc / nP
    c.longueur = lg
    c.altMoyenne = sAlt / nP
    // Trois termes, dans l'ordre de leur poids. L'encaissement domine : c'est
    // lui qui dit « vallée » ; la longueur donne du plan ; l'altitude moyenne
    // pénalise un couloir qui passe son temps en altitude (donc sans parois).
    c.score = (c.encaissement / range) * 1.0
      + (lg / (4 * half)) * 0.45
      - ((c.altMoyenne - g.min) / range) * 0.35
  }
  candidats.sort((a, b) => b.score - a.score)

  // --- la vérification, dans l'ordre du classement -------------------------
  //
  // On vérifie les `maxCandidats` premiers et on garde TOUS ceux qui passent,
  // puis on tranche sur une note qui n'est connue qu'après vérification : la
  // HAUTEUR DE VOL au-dessus du fond. Adrien demande « au ras du sol » ; entre
  // deux couloirs engageables, celui qui se vole bas est le bon plan.
  const refus = []
  const retenus = []
  for (const c of candidats.slice(0, maxCandidats)) {
    // On lisse AVANT de vérifier : un chemin de Dijkstra avance en escalier à 8
    // directions, et ses marches créent de faux rétrécissements. On vérifie donc
    // la voie qu'on va RÉELLEMENT voler, pas une approximation.
    const voie = smoothXZ(resampleXZ(c.voie, half * 0.03), 2, 2)
    const v = verifierCouloir({ sampleGround, voie, profil })
    if (!v.ok) { refus.push({ score: c.score, raison: v.raison, largeurMin: v.largeurMin }); continue }
    retenus.push({ c, voie, v, note: c.score - clamp(v.hauteurMax / (profil.garde * 10), 0, 1) * 0.4 })
  }
  retenus.sort((a, b) => b.note - a.note)
  for (const { c, voie, v } of retenus.slice(0, 1)) {
    return {
      profil,
      voie,
      grille: g,
      score: c.score,
      encaissementMoyen: c.encaissement,
      longueur: c.longueur,
      largeurMin: v.largeurMin,
      // hauteurMax : à quelle hauteur au-dessus du fond il faut voler au plus
      // haut du couloir. C'est la mesure du « ras du sol » : plus elle est
      // proche de la garde, plus le plan frôle.
      hauteurMax: v.hauteurMax,
      hauteurEntree: v.hauteurEntree,
      debouche: v.debouche,
      besoin: v.besoin,
      entree: c.entree || { x: voie[0].x, z: voie[0].z },
      sortie: c.sortie || { x: voie[voie.length - 1].x, z: voie[voie.length - 1].z },
      refus,
    }
  }
  return null
}

// ========================================================== le vol lui-même

// État initial : on se pose à l'entrée du couloir, cap vers la suite, à
// l'altitude de sécurité, ailes à plat.
export function creerVol(plan) {
  const { voie, profil } = plan
  const sampleGround = plan.sampleGround || (() => 0)
  const a = voie[0]
  const b = voie[Math.min(3, voie.length - 1)]
  const cap = capDe(b.x - a.x, b.z - a.z)
  const y = altitudeSecuritaire({
    sampleGround, x: a.x, z: a.z, cap, distance: profil.dVeille, garde: profil.garde,
  })
  // Le regard est posé DÈS L'ÉTAT INITIAL : sans ça le premier pas rattrapait
  // d'un coup l'écart entre la visée par défaut et la visée filtrée, et le plan
  // s'ouvrait sur un sursaut de cadre.
  const etat0 = { x: a.x, z: a.z, y, cap, roulis: 0, v: profil.vCroisiere * profil.half, avanceVisee: 0 }
  return {
    x: a.x, z: a.z, y,
    cap, roulis: 0, v: profil.vCroisiere * profil.half,
    s: 0, sens: 1, t: 0,
    avanceVisee: 0,
    visee: pointDeVisee(etat0, { profil, sampleGround }),
    phase: 'vol',
    // Compteurs de PREUVE, pas de décor : `plancher` compte les fois où le
    // garde-fou d'altitude a dû rattraper la dynamique — s'il n'est jamais
    // engagé, c'est que le plan tenait tout seul. `evitements` compte les
    // reprises de cap réactives.
    plancher: 0, evitements: 0, gardeMin: Infinity,
  }
}

// Projette (x, z) sur la polyligne et rend l'abscisse curviligne. On repart de
// `sHint` pour ne pas ré-scanner toute la voie à chaque image, et surtout pour ne
// pas « sauter » sur un méandre qui revient près de soi.
export function abscisseSur(voie, cum, x, z, sHint = 0, fenetre = Infinity) {
  let best = sHint
  let bestD = Infinity
  const total = cum[cum.length - 1]
  const s0 = Math.max(0, sHint - fenetre)
  const s1 = Math.min(total, sHint + fenetre)
  for (let i = 1; i < voie.length; i++) {
    if (cum[i] < s0 || cum[i - 1] > s1) continue
    const a = voie[i - 1]
    const b = voie[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const L2 = dx * dx + dz * dz
    if (L2 < 1e-9) continue
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1)
    const px = a.x + dx * t
    const pz = a.z + dz * t
    const d = (x - px) ** 2 + (z - pz) ** 2
    if (d < bestD) { bestD = d; best = cum[i - 1] + t * Math.sqrt(L2) }
  }
  return best
}

export function pointA(voie, cum, s) {
  const total = cum[cum.length - 1]
  const d = clamp(s, 0, total)
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= d) lo = mid
    else hi = mid
  }
  const seg = cum[hi] - cum[lo] || 1
  const t = clamp((d - cum[lo]) / seg, 0, 1)
  return { x: lerp(voie[lo].x, voie[hi].x, t), z: lerp(voie[lo].z, voie[hi].z, t) }
}

export function cumulSur(voie) {
  const cum = [0]
  for (let i = 1; i < voie.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(voie[i].x - voie[i - 1].x, voie[i].z - voie[i - 1].z))
  }
  return cum
}

// Largeur libre en dessous de laquelle il faut faire demi-tour. Voir le
// paragraphe « LE DEMI-TOUR » dans stepPilote pour le pourquoi des deux seuils.
// ⚠️ 2 × RAYON, MAIS DU CÔTÉ DU VIRAGE — la règle classique dit « il faut 2 × r
// de largeur pour faire demi-tour », et elle sous-entend qu'on vole COLLÉ À UN
// FLANC : le demi-cercle se déroule alors entièrement du côté libre. Un appareil
// au milieu du couloir a besoin des mêmes 2 × r, mais d'un seul côté — soit 4 × r
// de largeur totale. On mesure donc la place DU CÔTÉ où l'on tournerait,
// `max(gauche, droite)`, jamais le total : mesuré sur l'entonnoir d'essai, le
// total disait « il reste 9, c'est juste assez » là où le cercle de virage
// n'avait que 4,5 devant lui et sortait dans la paroi.
export function seuilDemiTour(profil) {
  return 2 * profil.rayon
}

// Seuil de simple FRANCHISSABILITÉ : en deçà, le couloir ne se passe plus, même
// tout droit. Rien à voir avec le demi-tour.
export function seuilPassage(profil) {
  return profil.rayon * 0.6
}

// LE CERCLE DE VIRAGE EST-IL LIBRE ?
//
// ⚠️ LA LARGEUR NE SUFFIT PAS, et c'est la dernière chose que la mesure a
// apprise. Après avoir corrigé la veille en arc, le plancher de dernier recours
// s'engageait encore 44 fois par vol — et TOUJOURS dans le demi-tour. La largeur
// libre est une mesure HORIZONTALE : elle dit qu'il y a de la place, elle ne dit
// pas que le sol y est plat. Le virage partait vers le côté large et grimpait
// un flanc qui montait plus vite (pente mesurée 4 à 7) que la capacité de montée
// (0,37) — la place était là, la performance non.
//
// On vérifie donc ce qu'un pilote vérifie : le DEMI-CERCLE qu'on va parcourir,
// point par point, en comparant le relief à l'altitude ATTEIGNABLE à cet endroit
// de l'arc (y + pente × longueur d'arc parcourue). C'est la « porte de sortie »
// au sens propre : une manœuvre existe, ou elle n'existe pas.
export function virageLibre({ sampleGround, x, z, y, cap, sens, rayon, garde, penteMontee, half = Infinity, pas = 12 }) {
  // centre du cercle : à `rayon` sur le côté vers lequel on tourne
  const cx = x + Math.sin(cap + (sens * Math.PI) / 2) * rayon
  const cz = z + Math.cos(cap + (sens * Math.PI) / 2) * rayon
  // angle du point courant vu du centre
  const a0 = Math.atan2(x - cx, z - cz)
  for (let i = 1; i <= pas; i++) {
    const dth = (Math.PI * i) / pas // on parcourt un demi-tour
    const a = a0 + sens * dth
    const px = cx + Math.sin(a) * rayon
    const pz = cz + Math.cos(a) * rayon
    if (Math.abs(px) > half || Math.abs(pz) > half) return false
    const s = sampleGround(px, pz)
    // longueur d'arc parcourue = rayon × angle
    if ((Number.isFinite(s) ? s : 0) + garde > y + penteMontee * rayon * dth) return false
  }
  return true
}

// Un onglet en arrière-plan rend un dt énorme au retour : sans plafond, le vol
// entier se déroulerait en une image, et toutes les gardes sauteraient avec.
const DT_MAX = 0.1

// Caps essayés de part et d'autre quand la route est barrée, du plus faible
// écart au plus fort — même table que fleet.js : on préfère toujours
// l'inflexion la plus douce, parce qu'un virage doit se LIRE.
const SCAN = [0.3, -0.3, 0.6, -0.6, 0.95, -0.95, 1.3, -1.3, 1.7, -1.7, 2.1, -2.1, 2.6, -2.6, Math.PI]

// La route est-elle dégagée ? Échantillonnage DU SEGMENT, pas seulement de son
// extrémité — sinon on saute par-dessus une arête étroite (leçon de fleet.js).
//
// ⚠️ `penteMontee` N'EST PAS UN DÉTAIL, et ça aussi a été mesuré. La première
// version comparait le relief à l'altitude COURANTE : sur la vallée d'essai, le
// garde-fou réactif se déclenchait à 922 pas sur 2 400, soit 38 % du vol — la
// caméra passait son temps à zigzaguer alors qu'il lui suffisait de monter.
// C'est que la question était mal posée. Un pilote ne se demande pas « suis-je
// au-dessus de ce qui vient », il se demande « SERAI-JE au-dessus quand j'y
// serai » — et entre ici et là-bas, il grimpe. On compare donc le relief à
// l'altitude ATTEIGNABLE au point testé, y + penteMontée × distance parcourue.
// Le virage redevient ce qu'il doit être : le recours quand monter ne suffit pas.
export function routeDegagee({ sampleGround, x, z, y, cap, distance, garde, penteMontee = 0, pas = 5, half = Infinity }) {
  const dx = Math.sin(cap)
  const dz = Math.cos(cap)
  for (let i = 1; i <= pas; i++) {
    const t = (distance * i) / pas
    const px = x + dx * t
    const pz = z + dz * t
    // LE BORD DU BLOC EST UN OBSTACLE. Hors du bloc il n'y a pas de relief à
    // échantillonner, donc pas de garde au sol : y voler serait voler à
    // l'aveugle. Mesuré, le demi-tour de fin de couloir emmenait la caméra à
    // z = 106 pour un demi-bloc de 100 — dehors, et sans filet.
    if (Math.abs(px) > half || Math.abs(pz) > half) return false
    const s = sampleGround(px, pz)
    if ((Number.isFinite(s) ? s : 0) + garde > y + penteMontee * t) return false
  }
  return true
}

// LE POINT DE VISÉE. « Un pilote regarde le sol devant lui à ras de terre, pas
// le sol sous lui » (Adrien), et « en virage, le regard précède la trajectoire :
// on regarde la SORTIE du virage, pas le nez de l'appareil ».
//
// Trois règles, toutes vérifiées par les tests :
//   · la distance vaut v × tVisee — elle DÉPEND DE LA VITESSE ;
//   · le cap de visée est celui du mouvement AVANCÉ du virage en cours : on vise
//     là où le cap sera dans `tVisee/2` secondes, donc plus loin dans le virage ;
//   · l'altitude visée est celle DU SOL à ce point (relevée d'un souffle), donc
//     la caméra plonge légèrement — mais la cible reste toujours DEVANT, jamais
//     sous l'appareil, et sa pente est bornée pour ne pas cadrer le ciel.
export function pointDeVisee(etat, ctx) {
  const { profil, sampleGround } = ctx
  const d = Math.max(profil.dVisee * (etat.v / profil.v), profil.rayon * 0.8)
  // Le regard précède la trajectoire : « en virage, le pilote regarde LA SORTIE
  // du virage, pas le nez de l'appareil ». On avance donc le cap de visée d'une
  // demi-anticipation de lacet.
  //
  // ⚠️ LE LACET EST DÉDUIT DU ROULIS, PAS PRIS TEL QUEL. Utiliser ω directement
  // faisait sauter la cible : quand le garde-fou réactif change le cap de
  // consigne, ω bascule d'un coup, le cap visé saute de 1,4 rad et la cible se
  // déplace de 60 unités en une image — 4 529 u/s mesurées pour un appareil à 8.
  // L'inclinaison, elle, est bornée EN VITESSE D'ÉTABLISSEMENT : en repassant
  // par elle (ω = g·tan φ / v, la relation du virage coordonné) le regard hérite
  // de cette continuité. C'est aussi plus juste : le pilote tourne la tête parce
  // qu'il est incliné, pas parce qu'une consigne a changé.
  //
  // ⚠️ ET L'AVANCE EST FILTRÉE, avec un coefficient RÉDUIT. Mesuré : l'axe de
  // visée balayait à 151°/s en virage, alors que le virage lui-même ne tourne
  // qu'à 28,6°/s. La faute au terme d'avance — sa dérivée vaut tVisee/2 × dω/dt,
  // et dω/dt monte à 0,77 rad/s² pendant l'établissement du roulis, soit cinq
  // fois le lacet lui-même. On regarde la sortie du virage, on ne fouette pas la
  // tête : coefficient ramené à tVisee/4, et lissé sur 2,5 s (état `avanceVisee`).
  const omegaLisse = (profil.g * Math.tan(etat.roulis || 0)) / Math.max(etat.v, 1e-6)
  const avance = etat.avanceVisee ?? omegaLisse * profil.tVisee * 0.25
  const capVise = etat.cap + avance
  const x = etat.x + Math.sin(capVise) * d
  const z = etat.z + Math.cos(capVise) * d
  // On regarde une TACHE de sol, pas un point : le relief réel est bruité, et
  // une lecture ponctuelle transmet ce bruit au cadrage. La moyenne sur un petit
  // disque est aussi ce que fait un œil — on ne fixe pas un caillou.
  const r = profil.garde
  let somme = 0
  let n = 0
  for (const [ux, uz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    const s = sampleGround(x + ux, z + uz)
    if (Number.isFinite(s)) { somme += s; n++ }
  }
  let y = (n ? somme / n : 0) + profil.garde * 0.6
  // Borne de PENTE : sans elle, un couloir qui monte fait pointer le nez au
  // zénith et la caméra ne cadre plus que du ciel (mesuré à 53° sur Chamonix
  // par la poursuite de camera-shots.js — même piège, même remède).
  const dh = Math.hypot(x - etat.x, z - etat.z)
  const penteMax = 0.36 // ~20°
  y = clamp(y, etat.y - dh * 1.2, etat.y + dh * penteMax)
  return { x, y, z }
}

// UN PAS DE VOL. Pur : rend un NOUVEL état, ne touche à rien.
//
// L'ordre des opérations est celui du pilotage réel, et il compte :
//   1. où veux-je aller ? (poursuite pure le long du couloir, décalée d'un côté)
//   2. le cap voulu est-il dégagé ? (garde-fou réactif — dernier recours)
//   3. combien de lacet puis-je commander ? (borné, et réduit si je monte)
//   4. quelle inclinaison cela donne-t-il ? (virage coordonné, roulis borné en
//      valeur ET en vitesse d'établissement)
//   5. à quelle altitude dois-je être ? (anticipation, montée bornée × cos φ)
//   6. j'avance.
export function stepPilote(etat, dt, plan, ctx) {
  if (!etat || etat.phase === 'fini') return etat
  const d = Math.min(Math.max(dt, 0), DT_MAX)
  if (!(d > 0)) return etat
  const { profil } = plan
  const sampleGround = ctx.sampleGround
  const voie = plan.voie
  const cum = plan.cum || (plan.cum = cumulSur(voie))
  const total = cum[cum.length - 1]

  const e = { ...etat }
  e.t += d

  // --- 1. la consigne : poursuite pure le long du couloir -------------------
  // On se projette sur la voie, puis on vise un point à `dPoursuite` devant.
  const s = abscisseSur(voie, cum, e.x, e.z, e.s, profil.rayon * 4)
  e.s = s
  const sVise = s + e.sens * profil.dPoursuite
  const cible = pointA(voie, cum, sVise)

  // « On vole sur un CÔTÉ du couloir, pas au milieu » : ça laisse le rayon de
  // virage disponible du côté large. On mesure la largeur libre des deux côtés
  // et on se décale vers le plus large.
  // Mesurée à l'altitude de MANŒUVRE (voir hauteurManoeuvre) : c'est la place
  // réellement disponible pour virer, pas la fente au ras du fond.
  const hMan = hauteurManoeuvre(profil)
  const l = largeurLibre({
    sampleGround, x: e.x, z: e.z, cap: e.cap, y: e.y + hMan, garde: profil.garde,
    portee: Math.max(2.2 * profil.rayon, profil.half * 0.35),
  })
  const large = l.droite >= l.gauche ? 1 : -1

  // ⚠️ LE DÉCALAGE SE MESURE SUR L'AXE DU COULOIR, ET IL EST HYSTÉRÉTIQUE.
  // Première version : perpendiculaire au CAP COURANT, côté recalculé à chaque
  // image. Résultat mesuré sur l'entonnoir d'essai — la caméra n'avançait plus
  // du tout : elle oscillait entre x = −5,8 et x = +3,4 en tournant autour de
  // z ≈ 75, et finissait par ressortir du bloc par où elle était entrée. La
  // boucle est évidente une fois vue : le décalage change le cap, le cap change
  // la perpendiculaire, la perpendiculaire change le décalage.
  // Deux corrections : la perpendiculaire est celle DU COULOIR (elle ne dépend
  // pas de nous), et le côté choisi ne change que si l'autre est franchement
  // meilleur (facteur 1,6) — un pilote ne change pas de côté toutes les secondes.
  const avantCible = pointA(voie, cum, sVise + e.sens * profil.rayon)
  const capVoie = capDe((avantCible.x - cible.x) * e.sens, (avantCible.z - cible.z) * e.sens)
  if (e.coteVol === undefined) e.coteVol = large
  else {
    const dispo = e.coteVol > 0 ? l.droite : l.gauche
    const autre = e.coteVol > 0 ? l.gauche : l.droite
    if (autre > dispo * 1.6) e.coteVol = -e.coteVol
  }
  const placeCote = e.coteVol > 0 ? l.droite : l.gauche
  const dec = profil.cote * Math.min(placeCote, profil.rayon) * e.coteVol
  const perp = capVoie + Math.PI / 2
  // Le décalage ne doit pas pousser la visée HORS DU BLOC : mesuré, un couloir
  // qui longe le bord faisait sortir la caméra de 1 % de l'emprise, et au-delà
  // du bord il n'y a plus de relief à échantillonner — donc plus de garde au sol.
  const lim = profil.half * 0.96
  const cibleD = {
    x: clamp(cible.x + Math.sin(perp) * dec, -lim, lim),
    z: clamp(cible.z + Math.cos(perp) * dec, -lim, lim),
  }

  let capDesire = capDe(cibleD.x - e.x, cibleD.z - e.z)

  // --- LE DEMI-TOUR ---------------------------------------------------------
  // Deux déclencheurs, et aucun des deux n'attend le fond du couloir :
  //   · on est arrivé au bout de la voie (le débouché — « demi-tour au bout ») ;
  //   · la largeur qu'on VOIT DEVANT descend sous le seuil : on se retourne TANT
  //     QU'ON PEUT ENCORE, ici où il reste de la place. « Le demi-tour se
  //     planifie avant le fond, pas au fond. »
  //
  // ⚠️ LE CRITÈRE DÉPEND DE LA SORTIE, et c'est de l'airmanship, pas un réglage.
  // Sans sortie prouvée, la règle est stricte : il faut garder EN PERMANENCE de
  // quoi se retourner — 2 × rayon DU CÔTÉ DU VIRAGE (voir seuilDemiTour) —,
  // sinon on est déjà dans le cul-de-sac. Avec une sortie prouvée et vérifiée
  // avant l'engagement, on PASSE : c'est exactement ce que la vérification a
  // acheté, et c'est ce qui permet à un avion de traverser une vallée trop
  // étroite pour son demi-tour, le cas normal à l'échelle d'un bloc. Le critère
  // retombe alors sur la simple franchissabilité.
  const besoin = seuilDemiTour(profil)
  const devant = {
    x: e.x + Math.sin(e.cap) * profil.dVeille,
    z: e.z + Math.cos(e.cap) * profil.dVeille,
  }
  const lDevant = largeurLibre({
    sampleGround, x: devant.x, z: devant.z, cap: e.cap, y: e.y + hMan, garde: profil.garde,
    portee: Math.max(1.4 * besoin, profil.half * 0.35),
  })
  // On déclenche le demi-tour 2 rayons AVANT le bout, pas au bout : un virage
  // avance de son propre diamètre pendant qu'il tourne. Déclenché au bout, il
  // finissait hors du bloc (mesuré : z = 106 pour un demi-bloc de 100).
  const margeBout = profil.dPoursuite * 0.6 + 2 * profil.rayon
  const boutAtteint = (e.sens > 0 && s >= total - margeBout) || (e.sens < 0 && s <= margeBout)
  const retrecit = plan.debouche
    // sortie prouvée : on ne renonce que si ça ne passe carrément plus
    ? lDevant.total < seuilPassage(profil)
    // pas de sortie : on se retourne TANT QU'IL RESTE la place de le faire
    : Math.max(lDevant.gauche, lDevant.droite) < besoin && Math.max(l.gauche, l.droite) >= besoin
  // PÉRIODE RÉFRACTAIRE. Un demi-tour dure π/ω (6,3 s pour l'avion) ; sans ce
  // verrou, la mesure de largeur prise EN PLEIN VIRAGE — donc en travers du
  // couloir, là où elle est forcément mauvaise — relançait un second demi-tour
  // avant la fin du premier, et la caméra vibrait entre deux caps. Un pilote ne
  // s'inverse pas deux fois en trois secondes.
  e.depuisDemiTour = (e.depuisDemiTour ?? 1e3) + d
  const refractaire = e.depuisDemiTour < Math.PI / profil.omegaMax + 1.5
  if (e.phase === 'vol' && !refractaire && (boutAtteint || retrecit)) {
    // ⚠️ ON NE FAIT PAS DEMI-TOUR SANS LA PLACE. Sans 2 × rayon de largeur
    // libre, le demi-tour EST le crash — c'est précisément la manœuvre qui tue
    // dans un canyon fermé. Deux cas, et c'est de l'airmanship :
    //   · au bout du couloir : on ne se retourne pas, on SORT par le débouché.
    //     C'est ce que la sortie prouvée a acheté, et le plan se pose dehors.
    //   · au milieu, sur un rétrécissement : se retourner est exclu, mais sortir
    //     l'est aussi — on ne fait rien de plus, et c'est la MONTÉE (garde-fou
    //     `force` plus bas) qui dégage. Monter est toujours possible ; se
    //     retourner, non.
    // Le sens du demi-tour n'est pas libre : on essaie D'ABORD le côté large —
    // « on vole sur un côté du couloir, ça laisse le rayon disponible du côté
    // large » — puis l'autre. Et on n'essaie pas la largeur, on essaie LE
    // CERCLE : voir virageLibre, la place ne dit rien de la pente.
    const penteVirage = (profil.montMax * facteurEnergie(profil.rouliMax)) / Math.max(e.v, 1e-6)
    const essai = { sampleGround, x: e.x, z: e.z, y: e.y, cap: e.cap, rayon: profil.rayon, garde: profil.garde, penteMontee: penteVirage, half: profil.half }
    const cote = [large, -large].find((s) => virageLibre({ ...essai, sens: s }))
    if (cote === undefined) {
      if (boutAtteint) e.sortant = true
    } else {
      e.depuisDemiTour = 0
      e.demiTours = (e.demiTours || 0) + 1
      e.phase = 'demi-tour'
      e.sens = -e.sens
      e.sensVirage = cote
      e.tDemiTour = 0
      e.sortant = false // se retourner annule la sortie : on repart en sens inverse
    }
  }
  // On SORT par le débouché : le plan se termine quand la caméra atteint le bord
  // du bloc, pas avant — le couloir se vole jusqu'au bout.
  if (e.sortant && (s >= total - profil.dPoursuite * 0.3
    || Math.max(Math.abs(e.x), Math.abs(e.z)) > profil.half * 0.95)) {
    e.phase = 'fini'
    return e
  }
  if (e.phase === 'demi-tour') {
    e.tDemiTour = (e.tDemiTour || 0) + d
    // On commande le lacet maximal du côté large jusqu'à avoir tourné assez pour
    // que la poursuite reprenne la main d'elle-même (écart < 60°).
    capDesire = e.cap + (e.sensVirage || 1) * Math.PI * 0.6
    const versVoie = angleWrap(capDe(cibleD.x - e.x, cibleD.z - e.z) - e.cap)
    if (Math.abs(versVoie) < 1.05 && e.tDemiTour > 0.5) { e.phase = 'vol'; e.tDemiTour = 0 }
  }

  // --- 2. le garde-fou réactif ---------------------------------------------
  // Le plan doit suffire. S'il ne suffit pas (relief rechargé plus fin que la
  // grille de planification, méandre serré), on balaie les caps du plus petit
  // écart au plus grand — méthode fleet.js, transposée en 3D : ici la caméra
  // peut aussi passer AU-DESSUS, donc « libre » veut dire « l'altitude de vol
  // domine le relief de `garde` sur toute la veille ».
  let force = false
  // pente de montée réellement disponible ICI, énergie comprise (elle chute en
  // cos φ) : c'est elle qui dit si un obstacle se franchit en montant.
  const penteMontee = (profil.montMax * facteurEnergie(e.roulis)) / Math.max(e.v, 1e-6)
  const veille = { sampleGround, x: e.x, z: e.z, y: e.y, distance: profil.dVeille, garde: profil.garde, penteMontee, half: profil.half }
  if (!routeDegagee({ ...veille, cap: capDesire })) {
    const ec = SCAN.find((a) => routeDegagee({ ...veille, cap: capDesire + a }))
    if (ec === undefined) force = true // aucune route horizontale : il faut MONTER
    else { capDesire += ec; e.evitements++ }
  }

  // --- 3. le lacet commandé -------------------------------------------------
  const err = angleWrap(capDesire - e.cap)
  // constante de temps de la boucle de cap : ~0,9 s. Plus court, ça oscille ;
  // plus long, la caméra coupe les virages du couloir.
  let omega = clamp(err / 0.9, -profil.omegaMax, profil.omegaMax)

  // --- 4. le roulis ---------------------------------------------------------
  // L'inclinaison DÉCOULE du virage (elle n'est jamais commandée), elle est
  // bornée en valeur, et son établissement est borné en vitesse.
  let rouliCible = clamp(rouliCoordonne(e.v, omega, profil.g), -profil.rouliMax, profil.rouliMax)
  const dRouli = clamp(rouliCible - e.roulis, -profil.tauxRouli * d, profil.tauxRouli * d)
  e.roulis = e.roulis + dRouli
  // …et le lacet RÉEL est celui que l'inclinaison réelle autorise : tant que
  // l'appareil n'a pas fini de s'incliner, il ne vire pas encore. C'est ce
  // couplage qui fait qu'un virage COMMENCE par une inclinaison.
  const omegaPossible = (profil.g * Math.tan(Math.abs(e.roulis))) / Math.max(e.v, 1e-6)
  omega = Math.sign(omega || e.roulis) * Math.min(Math.abs(omega), omegaPossible)
  e.omega = omega
  e.cap = angleWrap(e.cap + omega * d)

  // --- 5. l'altitude --------------------------------------------------------
  // Anticipation : le maximum du relief sur la fenêtre, jamais le sol sous soi.
  let cibleY = altitudeSecuritaire({
    sampleGround, x: e.x, z: e.z, cap: e.cap, distance: profil.dVeille, garde: profil.garde,
    courbure: omega / Math.max(e.v, 1e-6), // la veille suit l'arc, pas la droite
  })
  if (force) cibleY += profil.garde * 2 // cerné : on prend de l'altitude franchement
  // L'ÉNERGIE : la montée disponible chute en cos φ. Quand elle vire, elle monte
  // moins. La descente, elle, n'est bornée que par le confort (pas d'énergie à
  // fournir pour descendre), d'où le facteur 1,4.
  const monte = profil.montMax * facteurEnergie(e.roulis)
  // ⚠️ LA VITESSE VERTICALE EST UN ÉTAT, PAS UNE CONSIGNE — et c'est encore la
  // dérivée seconde qui l'a exigé. Un simple `clamp(cible − y)` fait du
  // tout-ou-rien : au moment où l'appareil passe de « monte à fond » à
  // « descend à fond », la vitesse verticale saute de 0,05 à −0,07 par image,
  // soit 432 u/s² d'accélération — un à-coup net, invisible en position et
  // parfaitement visible à l'œil. Un aéronef change de taux de montée avec une
  // inertie ; on la modélise, et l'à-coup disparaît.
  const vyCible = clamp((cibleY - e.y) / 0.8, -monte * 1.4, monte)
  const accVert = monte / 0.7 // taux de montée pleinement établi en 0,7 s
  e.vy = (e.vy || 0) + clamp(vyCible - (e.vy || 0), -accVert * d, accVert * d)
  e.y += e.vy * d

  // --- 6. on avance ---------------------------------------------------------
  // Vitesse : un avion ne s'arrête pas (vMin > 0) mais ralentit un peu en
  // virage serré — c'est ce qui rend un demi-tour lisible au lieu d'une embardée.
  const vCible = Math.max(profil.vMin, profil.v * (1 - 0.35 * Math.abs(e.roulis) / profil.rouliMax))
  e.v += clamp(vCible - e.v, -profil.v * 0.6 * d, profil.v * 0.6 * d)
  e.x += Math.sin(e.cap) * e.v * d
  e.z += Math.cos(e.cap) * e.v * d

  // --- LE GARDE-FOU DE DERNIER RECOURS -------------------------------------
  // La dynamique ci-dessus DOIT suffire — c'est tout l'objet du plan. Ce
  // plancher est là pour que la garantie « la garde au sol ne devient jamais
  // négative » soit vraie même quand une pente dépasse la montée disponible.
  // ⚠️ Il est COMPTÉ (`e.plancher`) : un vol où il s'engage est un vol dont le
  // plan était faux, et c'est ce compteur qu'on regarde pour le savoir.
  const sol = sampleGround(e.x, e.z)
  const solY = Number.isFinite(sol) ? sol : 0
  const mini = solY + profil.garde
  // …et on remet la vitesse verticale à zéro quand il engage : sans ça la
  // dynamique continuerait de pousser vers le bas contre le plancher à chaque
  // image, et le rattrapage se répéterait au lieu de se résoudre.
  if (e.y < mini) { e.y = mini; e.vy = Math.max(e.vy || 0, 0); e.plancher++ }
  const gardeReelle = e.y - solY
  if (gardeReelle < e.gardeMin) e.gardeMin = gardeReelle

  // --- 7. le regard ---------------------------------------------------------
  // ⚠️ LE REGARD EST UN ÉTAT, LUI AUSSI. Le point de visée glisse le long du sol
  // devant l'appareil ; sur un flanc de pente 5, une avance d'une unité par
  // image fait bouger sa hauteur de cinq — mesuré, la cible se déplaçait à
  // 386 u/s pour un appareil à 8, soit 8° de tangage en une image. C'est
  // parfaitement visible, et invisible dans un test de position. Un pilote ne
  // claque pas son regard : on filtre l.altitude visée à ~0,9 s. Le CAP de
  // visée, lui, n'est pas filtré — il vient déjà du roulis, donc il est lisse.
  const omegaVisee = (profil.g * Math.tan(e.roulis)) / Math.max(e.v, 1e-6)
  const avanceCible = omegaVisee * profil.tVisee * 0.25
  e.avanceVisee = (e.avanceVisee || 0) + (avanceCible - (e.avanceVisee || 0)) * (1 - Math.exp(-d / 2.5))
  const brut = pointDeVisee(e, { profil, sampleGround })
  if (!e.visee) e.visee = brut
  else {
    const k = 1 - Math.exp(-d / 0.9)
    e.visee = { x: brut.x, y: e.visee.y + (brut.y - e.visee.y) * k, z: brut.z }
  }
  // (Pas de recalage sur le sol visé après le filtre : le remonter au relief
  // instantané réinjecterait exactement le saut qu'on vient d'ôter — mesuré,
  // 386 u/s à l'identique. La cible n'est qu'un point de regard, pas une
  // position : la voir passer un dixième de seconde sous la pente ne se voit
  // pas, alors qu'un saut de 8° de tangage, si.)

  return e
}

// Pose de caméra pour l'état courant : position, cible de regard, roulis.
// C'est TOUT ce que l'adaptateur consomme.
export function poseDe(etat, plan, ctx) {
  const t = etat.visee || pointDeVisee(etat, { profil: plan.profil, sampleGround: ctx.sampleGround })
  return {
    pos: { x: etat.x, y: etat.y, z: etat.z },
    target: t,
    roulis: etat.roulis,
    cap: etat.cap,
    v: etat.v,
    phase: etat.phase,
  }
}

// ============================================================ vol complet
//
// Déroule un vol entier hors ligne. C'est l'outil de PREUVE : c'est lui que les
// tests font tourner sur du relief réel pour vérifier qu'aucun pas ne passe sous
// la garde au sol, et c'est lui qui donne les chiffres du rapport.
export function volComplet({ sampleGround, half, profil = 'avion', duree = 30, dt = 1 / 60, plan = null, surcharge = {} }) {
  const p = plan || planifierVol({ sampleGround, half, profil, surcharge })
  if (!p) return null
  p.sampleGround = sampleGround
  let etat = creerVol(p)
  const poses = [poseDe(etat, p, { sampleGround })]
  const n = Math.round(duree / dt)
  for (let i = 0; i < n; i++) {
    etat = stepPilote(etat, dt, p, { sampleGround })
    poses.push(poseDe(etat, p, { sampleGround }))
  }
  return { plan: p, etat, poses }
}
