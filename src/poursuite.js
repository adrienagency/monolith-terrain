// LA POURSUITE — la caméra de retransmission qui garde la tête de course au
// centre de l'attention.
//
// Adrien : « L'objectif de la caméra est de TOUJOURS GARDER LA TÊTE DE COURSE AU
// CENTRE DE L'ATTENTION. »
//
// MODULE PUR, comme pilote.js : pas de three.js, pas de DOM, pas de GPX. Il
// reçoit une polyligne en coordonnées monde, un échantillonneur d'altitude et un
// modèle d'allure, et il rend des poses. C'est l'adaptateur (src/poursuite-cam.js)
// qui lit le fichier et écrit dans la caméra.
//
// ============================================================================
// LE PRINCIPE : LA TRAJECTOIRE ET LE REGARD SONT DÉCOUPLÉS
// ============================================================================
//
// Un hélicoptère de retransmission NE SUIT JAMAIS le tracé exact du coureur. Il
// vole une LIGNE LISSÉE, et c'est la TOURELLE qui garde le sujet dans le cadre.
// Une caméra posée « à distance fixe derrière » recopie chaque lacet ; sur un
// trail alpin, c'est insoutenable en trois secondes.
//
// ⚠️ MESURÉ SUR LE TRACÉ D'ADRIEN (Interlaken, 47,4 km, D+ 4 771 m, 4 329
// points) : la pente absolue médiane vaut 15 %, le 90ᵉ centile 50 %, le 99ᵉ
// 106 %. Ce n'est pas un tracé, c'est un escalier. Une caméra qui le recopie
// tourne sur elle-même en permanence.
//
// ============================================================================
// EN QUOI CE MODE FAIT MIEUX QUE `flyTrack` / DroneCam (src/drone-cam.js)
// ============================================================================
//
// DroneCam est un excellent RIG : la caméra tient une vue relative FIXE autour
// de la tête (azimut monde, distance, inclinaison choisis par l'utilisateur au
// pavé numérique) et translate avec elle. C'est ce qu'il faut pour PILOTER une
// vue à la main. Ce n'est pas une caméra de retransmission, et six différences
// le disent :
//
//   1. L'ALLURE. DroneCam n'a aucun modèle : `flyTrack` fixe une durée
//      (`clamp(km × 2,2 ; 14 ; 95)`) et la tête avance à vitesse d'abscisse
//      constante. Sur 4 771 m de D+, c'est faux à chaque pente — le coureur
//      « vole » dans les montées à 50 %. Ici, l'allure suit la FONCTION DE
//      TOBLER (voir `vitesseTobler`).
//   2. LES LACETS. La position de DroneCam est un décalage rigide du sujet
//      lissé : elle recopie donc chaque lacet, décalée et amortie. Ici, la
//      caméra vole une ligne LISSÉE À PART, qui COUPE les lacets.
//   3. L'AVANCE. L'azimut de DroneCam est ancré au monde et fixé une fois pour
//      toutes ; dans un lacet elle se retrouve tantôt devant, tantôt derrière,
//      arbitrairement. Ici la caméra PRÉCÈDE le sujet et se tient à l'INTÉRIEUR
//      du virage — ce que fait un hélicoptère, qui coupe le lacet.
//   4. LE CADRAGE. DroneCam vise EXACTEMENT la tête, pile au centre. « Au centre
//      de l'attention » n'est pas « au centre du cadre » : un sujet en mouvement
//      se cadre avec de l'ESPACE DEVANT LUI (`lead room`), sinon il a l'air de
//      sortir du cadre. Voir `pointDeVisee`.
//   5. L'OCCLUSION. `resolveOcclusion` de DroneCam est CURATIVE : quand une
//      crête coupe la ligne, elle rentre la caméra vers le sujet — donc le sujet
//      grossit d'un coup, le cadrage change. Ici la visibilité est CALCULÉE
//      D'AVANCE sur toute la course et l'altitude de vol monte AVANT la crête,
//      sans toucher au standoff (voir `profilVisibilite`).
//   6. LA DURÉE. 47 km d'un seul plan continu, ça n'existe pas en
//      retransmission. Il y a un RÉPERTOIRE de plans et un enchaînement
//      (voir `SEQUENCE_DEFAUT`).
//
// ⚠️ ET LES RÈGLES DU PILOTE RESTENT. Garde au sol, anticipation du relief,
// roulis borné : le sujet impose la trajectoire, il ne suspend pas la physique.
// Une caméra de poursuite qui percute une crête reste une caméra qui percute.
//
// ============================================================================
// POURQUOI UN HÉLICOPTÈRE, ET POURQUOI CE N'EST PAS UN CHOIX DE STYLE
// ============================================================================
//
// Un AVION NE PEUT PAS suivre ce coureur. Il a une vitesse de décrochage : en
// dessous, il tombe. Le profil `avion` de pilote.js porte cette contrainte
// (`vMin = 0,055 demi-bloc/s`, soit ~55 km/h à l'échelle de ce bloc), et la tête
// de course monte les raides à 4-5 km/h. Aucun aéronef à voilure fixe ne vole
// aussi lentement. Sur ce parcours, l'hélicoptère n'est pas le meilleur choix,
// c'est LE SEUL.
//
// CE QU'IL AUTORISE, ET DONT CE MODULE SE SERT :
//   · TENIR LA STATION à la vitesse du sujet, y compris quasi immobile dans une
//     montée à 50 % — `PROFILS.helico.vMin` vaut 0, et c'est la seule raison
//     pour laquelle la poursuite peut exister.
//   · PIVOTER À PLAT EN VOL LENT. ⚠️ Nuance qui change le modèle de roulis : un
//     hélicoptère s'incline en vol de TRANSLATION, comme un avion, mais en vol
//     lent il pivote sur son axe SANS incliner. « Un drone lace à plat, un
//     aéronef s'incline » reste vrai en vitesse et devient FAUX en vol lent.
//     L'inclinaison varie donc avec la vitesse (voir `rouliDeVol`) — c'est ce
//     qui distingue cet hélicoptère d'un avion ralenti.
//   · MONTER À LA VERTICALE pour dégager une crête. La parade anti-occlusion
//     s'en trouve simplifiée : on s'élève au lieu de contourner (voir
//     `monteePourVoir`, et la pente de montée affranchie en vol lent).
//   · SE DÉCALER LATÉRALEMENT sans faire de tour : le changement de côté est
//     une TRANSLATION progressive, pas une manœuvre (voir `cuirePlanDeVol`).
//
// LA TOURELLE GYROSTABILISÉE achève de justifier le découplage : sur un
// hélicoptère de retransmission, l'assiette de l'appareil et l'axe de la caméra
// sont indépendants. C'est exactement le principe posé plus haut — trajectoire
// lissée d'un côté, visée de l'autre — et ce module rend les deux séparément.
//
// CE QU'IL A FALLU CHANGER AU PROFIL `helico` DE pilote.js (on part de lui, on
// ne réécrit pas une personnalité) :
//   · la VITESSE n'est plus la sienne : elle est imposée par le sujet. `vCroisiere`
//     et `vMax` ne servent donc plus ; on ne garde que `garde`, `montMax`,
//     `rouliMax`, `rayon` et la gravité de scène `g`.
//   · le ROULIS est modulé par la vitesse de translation (nouveau, voir plus haut).
//   · la MONTÉE est affranchie en vol lent : la pente de montée disponible vaut
//     montMax/v, et v tend vers zéro dans les raides — donc la montée devient
//     quasi verticale, ce qui est exactement le comportement réel.

import { PROFILS, resoudreProfil, rouliCoordonne, profilTenable, angleWrap, capDe } from './pilote.js'

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t

// ============================================================ 1. L'ALLURE
//
// LA FONCTION DE TOBLER (Tobler, 1993, « Three Presentations on Geographical
// Analysis and Modeling ») : la vitesse de marche décroît exponentiellement avec
// la pente, et son maximum n'est PAS à plat — il est sur une descente douce de
// 5 %. C'est un effet réel, et c'est ce qui donne au mouvement sa signature :
//
//     v = 6 · exp(−3,5 · |pente + 0,05|)   (km/h)
//
// On la RENORMALISE sur la vitesse à plat du coureur au lieu des 6 km/h du
// marcheur de Tobler, ce qui garde la FORME (le seul apport du modèle) et rend
// l'allure réglable :
//
//     v = vPlat · exp(−raideur · (|pente + 0,05| − 0,05))
//
// Ce que ça donne pour une tête de course à 13 km/h à plat, et ce que ça vaut :
//   · plat            → 13,0 km/h
//   · descente à 5 %  → 13,0 km/h (l'optimum de Tobler, très légèrement au-dessus)
//   · descente à 20 % → 9,1 km/h  (repère annoncé : 10–12 en descente technique)
//   · montée à 20 %   → 6,4 km/h
//   · montée à 40 %   → 3,2 km/h  (repère annoncé : 4–5 en montée raide)
// La fonction de Tobler est celle d'un MARCHEUR : elle est un peu pessimiste
// pour un coureur d'élite dans le raide. `raideur` est donc un paramètre — la
// baisser à 2,8 remonte la montée à 40 % vers 4,3 km/h. On expose, on ne devine
// pas à la place d'Adrien.
export function vitesseTobler(pente, { vPlat = 13, raideur = 3.5, optimum = 0.05 } = {}) {
  return vPlat * Math.exp(-raideur * (Math.abs(pente + optimum) - optimum))
}

// Longueur cumulée HORIZONTALE le long d'une polyligne. Horizontale, parce que
// c'est elle qui entre au dénominateur de la pente.
export function cumulHorizontal(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z))
  }
  return cum
}

// LE PROFIL TEMPOREL. Parcourt le tracé segment par segment, calcule la pente
// RÉELLE de chaque segment et le temps qu'il coûte à l'allure de Tobler.
//
// ⚠️ LA PENTE SE CALCULE EN VRAI, PAS EN UNITÉS MONDE. ShibuMap exagère le
// relief (`demExaggeration`) : lue telle quelle, une pente de 15 % en paraîtrait
// 30, et le coureur ramperait. On divise donc la dénivelée par l'exagération.
// L'échelle horizontale, elle, se simplifie — elle est au numérateur ET au
// dénominateur de la pente. Seule la VITESSE a besoin de `metresParUnite`.
//
// `acceleration` compresse le temps : 47 km à 13 km/h font 3 h 40, ce que
// personne ne regarde. Les variations RELATIVES d'allure, elles, restent
// exactes — c'est tout l'intérêt du modèle.
export function profilAllure({
  trace, metresParUnite = 1, exagerationV = 1,
  vPlat = 13, raideur = 3.5, duree = null, acceleration = 1,
} = {}) {
  const n = trace.length
  const cum = cumulHorizontal(trace)
  const temps = new Float64Array(n)
  const vitesses = new Float64Array(n)
  const pentes = new Float64Array(n)
  for (let i = 1; i < n; i++) {
    const dh = cum[i] - cum[i - 1]
    const dy = (trace[i].y - trace[i - 1].y) / (exagerationV || 1)
    const pente = dh > 1e-9 ? dy / dh : 0
    pentes[i] = pente
    // km/h → unités monde par seconde
    const vKmh = vitesseTobler(pente, { vPlat, raideur })
    const vMonde = ((vKmh * 1000) / 3600) / Math.max(metresParUnite, 1e-9)
    vitesses[i] = vMonde
    // longueur RÉELLE du segment (pas horizontale) : c'est elle qu'on parcourt
    const dReel = Math.hypot(dh, dy * 0 + (trace[i].y - trace[i - 1].y) / (exagerationV || 1))
    temps[i] = temps[i - 1] + dReel / Math.max(vMonde, 1e-9)
  }
  pentes[0] = pentes[1] || 0
  vitesses[0] = vitesses[1] || 1
  const dureeReelle = temps[n - 1]
  // Si une durée de clip est demandée, l'accélération s'en déduit — sinon on
  // applique celle fournie.
  const acc = duree ? dureeReelle / duree : acceleration
  return { cum, temps, vitesses, pentes, dureeReelle, acceleration: acc, duree: dureeReelle / acc }
}

// Où en est le sujet à l'instant `t` (secondes de CLIP) ? Rend sa position, sa
// direction de course, sa pente et sa vitesse — plus l'indice fractionnaire, qui
// est la clé de tout le reste (voir `ligneDeVol`).
export function sujetA(trace, prof, t) {
  const tReel = clamp(t * prof.acceleration, 0, prof.temps[prof.temps.length - 1])
  const T = prof.temps
  let lo = 0
  let hi = T.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (T[mid] <= tReel) lo = mid
    else hi = mid
  }
  const seg = T[hi] - T[lo] || 1
  const f = clamp((tReel - T[lo]) / seg, 0, 1)
  const a = trace[lo]
  const b = trace[hi]
  const pos = { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f) }
  return {
    pos,
    idx: lo + f,
    cap: capDe(b.x - a.x, b.z - a.z),
    pente: prof.pentes[hi],
    vitesse: prof.vitesses[hi],
    // vitesse réelle en km/h, pour l'affichage et les tests
    vitesseKmh: vitesseTobler(prof.pentes[hi], { vPlat: prof.vPlat ?? 13, raideur: prof.raideur ?? 3.5 }),
  }
}

// ==================================================== 2. LA LIGNE DE VOL
//
// ⚠️ LES DEUX POLYLIGNES PARTAGENT LEURS INDICES, ET C'EST TOUT LE TRUC. On
// rééchantillonne le tracé à pas constant (`brut`), puis on le lisse fort
// (`lisse`). Les deux tableaux ont EXACTEMENT le même nombre de points, donc
// l'indice du sujet sur `brut` donne directement le point correspondant sur
// `lisse` — pas de reprojection, pas d'appariement à chercher. C'est ce qui rend
// l'avance (`i + avance`) triviale, alors qu'un appariement par abscisse
// curviligne serait faux : la ligne lissée est PLUS COURTE que le tracé, puisque
// c'est exactement ce qu'on lui demande (couper les lacets).
// ⚠️ LA FENÊTRE DE LISSAGE NE SE DEVINE PAS, ELLE SE MESURE. Premier essai :
// fenêtre calée sur l'avance (≈ 30 points, 4,5 unités monde). Sur le tracé
// d'essai — 14 épingles d'amplitude 28 unités — ça ne coupait rien du tout : la
// caméra recopiait les lacets et l'axe de visée balayait à 5 332 °/s, soixante
// fois le seuil de lisibilité. Le lissage n'est pas un réglage esthétique, il a
// un CRITÈRE : la ligne doit être VOLABLE, c'est-à-dire que sa courbure maximale
// ne doit pas dépasser 1/rayon de virage. On élargit donc la fenêtre jusqu'à ce
// que ce soit vrai — l'hélicoptère vole une ligne qu'il peut réellement voler,
// et le nombre sort de la machine, pas de mon doigt mouillé.
export function ligneVolable(trace, { rayonMin, ecartMax = Infinity, fenetre0 = 8, maxIter = 14, passes = 3 } = {}) {
  const kMax = (l, ecart) => {
    let m = 0
    for (let i = ecart; i < l.length - ecart; i += Math.max(1, Math.round(ecart / 2))) {
      const k = Math.abs(courbureA(l, i, ecart))
      if (k > m) m = k
    }
    return m
  }
  // écart maximal entre la ligne de vol et le tracé : si on lisse trop, la
  // caméra n'est plus une caméra de poursuite, elle survole le massif.
  const ecartDe = (l) => {
    let m = 0
    for (let i = 0; i < l.length; i += 3) {
      const d = Math.hypot(l[i].x - trace[i].x, l[i].z - trace[i].z)
      if (d > m) m = d
    }
    return m
  }
  const cible = 1 / Math.max(rayonMin, 1e-6)
  let fen = Math.max(4, fenetre0)
  let lisse = ligneDeVol(trace, { fenetre: fen, passes }).lisse
  let iter = 0
  let arret = 'courbure'
  // ⚠️ DEUX CRITÈRES QUI S'OPPOSENT, ET C'EST VOULU. On élargit tant que la
  // ligne n'est pas volable, MAIS on s'arrête si elle s'éloigne trop du coureur.
  // Mesuré sur un tracé d'essai à épingles violentes : sans le second critère la
  // fenêtre montait à 1 290 points sur 3 642 — un tiers du parcours — et la
  // « poursuite » devenait un survol de massif. Quand les deux critères sont
  // inconciliables, c'est la PROXIMITÉ qui gagne : une caméra de poursuite qui
  // perd son sujet n'est plus une caméra de poursuite, alors qu'une ligne un peu
  // trop tournante reste filmable (le lissage temporel de la tourelle absorbe).
  while (iter < maxIter && fen < trace.length / 3) {
    const ecart = Math.max(4, Math.round(fen / 2))
    if (kMax(lisse, ecart) <= cible) { arret = 'courbure'; break }
    const suivante = ligneDeVol(trace, { fenetre: Math.round(fen * 1.6), passes }).lisse
    if (ecartDe(suivante) > ecartMax) { arret = 'ecart'; break }
    fen = Math.round(fen * 1.6)
    lisse = suivante
    iter++
  }
  const ecart = Math.max(4, Math.round(fen / 2))
  return {
    lisse, fenetre: fen, iterations: iter, arret,
    courbureMax: kMax(lisse, ecart), courbureCible: cible, ecart: ecartDe(lisse),
  }
}

export function ligneDeVol(trace, { fenetre = 24, passes = 3 } = {}) {
  const n = trace.length
  if (n < 3) return { lisse: trace.map((p) => ({ ...p })), n }
  let cur = trace.map((p) => ({ x: p.x, y: p.y, z: p.z }))
  for (let p = 0; p < passes; p++) {
    const next = cur.map((q) => ({ ...q }))
    for (let i = 0; i < n; i++) {
      let sx = 0
      let sy = 0
      let sz = 0
      let c = 0
      for (let j = Math.max(0, i - fenetre); j <= Math.min(n - 1, i + fenetre); j++) {
        sx += cur[j].x; sy += cur[j].y; sz += cur[j].z; c++
      }
      next[i] = { x: sx / c, y: sy / c, z: sz / c }
    }
    cur = next
  }
  return { lisse: cur, n }
}

// Rééchantillonne une polyligne à pas constant. Version 3D locale (celle de
// drone-cam.js est identique mais ce module ne doit pas dépendre de three.js).
export function reechantillonner(pts, pas) {
  if (!pts || pts.length < 2) return pts ? pts.map((p) => ({ ...p })) : []
  const out = [{ ...pts[0] }]
  let reste = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (L < 1e-9) continue
    let d = pas - reste
    while (d < L) {
      const t = d / L
      out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) })
      d += pas
    }
    reste = L - (d - pas)
  }
  const fin = pts[pts.length - 1]
  const q = out[out.length - 1]
  if (Math.hypot(fin.x - q.x, fin.y - q.y, fin.z - q.z) > pas * 0.25) out.push({ ...fin })
  return out
}

// COURBURE SIGNÉE de la ligne lissée à l'indice i, en radians par unité. Son
// SIGNE donne le côté intérieur du virage : c'est là que se met l'hélicoptère,
// parce qu'un virage se coupe par l'intérieur.
export function courbureA(ligne, i, ecart = 6) {
  const n = ligne.length
  const a = ligne[clamp(Math.round(i) - ecart, 0, n - 1)]
  const b = ligne[clamp(Math.round(i), 0, n - 1)]
  const c = ligne[clamp(Math.round(i) + ecart, 0, n - 1)]
  const cap1 = capDe(b.x - a.x, b.z - a.z)
  const cap2 = capDe(c.x - b.x, c.z - b.z)
  const dTheta = angleWrap(cap2 - cap1)
  const L = Math.hypot(c.x - a.x, c.z - a.z)
  return L > 1e-9 ? dTheta / L : 0
}

// ================================================= 3. LA VISIBILITÉ DU SUJET
//
// « Le sujet ne doit JAMAIS disparaître derrière le relief. » C'est la panne la
// plus visible d'une caméra de poursuite en montagne.
//
// ⚠️ C'EST LA VEILLE DE `fleet.js` RETOURNÉE. Au lieu de vérifier que le chemin
// est libre DEVANT, on vérifie que la ligne caméra→sujet ne traverse pas le sol.
// Même méthode : on échantillonne le SEGMENT, pas seulement son extrémité —
// sinon une crête étroite passe entre deux relevés. Le pas est lié à la peau
// (la marge sous laquelle on considère qu'on frôle), pour la même raison que la
// veille du pilote a dû être resserrée sur MNT réel.
export function sujetVisible({ sampleGround, cam, sujet, peau = 0.35, pas = 0 }) {
  const dx = cam.x - sujet.x
  const dy = cam.y - sujet.y
  const dz = cam.z - sujet.z
  const L = Math.hypot(dx, dz)
  const n = pas || clamp(Math.ceil(L / Math.max(peau * 2, 1e-6)), 8, 64)
  for (let i = 1; i < n; i++) {
    const t = i / n
    const sol = sampleGround(sujet.x + dx * t, sujet.z + dz * t)
    if ((Number.isFinite(sol) ? sol : 0) + peau > sujet.y + dy * t) return false
  }
  return true
}

// De combien faut-il MONTER, depuis une position caméra donnée, pour que le
// sujet redevienne visible ? Recherche dichotomique sur l'altitude — la
// visibilité est monotone en altitude (monter ne peut pas cacher), donc la
// dichotomie est exacte et non un tâtonnement.
// ⚠️ LE PLAFOND SE CHERCHE, IL NE SE POSTULE PAS. Première version : un plafond
// fixe (20 unités, ou quatre fois l'écart d'altitude). Sur une crête haute la
// dichotomie n'avait alors aucun encadrement — elle rendait le plafond lui-même,
// donc une valeur qui NE DÉGAGEAIT PAS. Le test « à la hauteur trouvée on voit,
// un poil en dessous on ne voit pas » l'a attrapé du premier coup : c'est
// exactement à ça que sert un test d'encadrement plutôt qu'un test de seuil.
// On double donc jusqu'à trouver un plafond qui dégage vraiment.
export function monteePourVoir({ sampleGround, cam, sujet, peau = 0.35, plafond = 0, pas = 12, doublements = 8 }) {
  if (sujetVisible({ sampleGround, cam, sujet, peau })) return 0
  let bas = 0
  let haut = plafond || Math.max(4, Math.abs(cam.y - sujet.y) * 2 + 2)
  let n = 0
  while (n < doublements && !sujetVisible({ sampleGround, cam: { ...cam, y: cam.y + haut }, sujet, peau })) {
    bas = haut
    haut *= 2
    n++
  }
  // toujours bouché après huit doublements : le relief est infranchissable ici,
  // on rend le dernier plafond plutôt que de boucler.
  if (!sujetVisible({ sampleGround, cam: { ...cam, y: cam.y + haut }, sujet, peau })) return haut
  for (let i = 0; i < pas; i++) {
    const m = (bas + haut) / 2
    if (sujetVisible({ sampleGround, cam: { ...cam, y: cam.y + m }, sujet, peau })) haut = m
    else bas = m
  }
  return haut
}

// ================================================ 4. LE PLAN DE VOL, CUIT
//
// ⚠️ ON CUIT, ON NE RÉAGIT PAS. C'est la leçon de drone-cam.js (« every one of
// those bugs is the price of GUESSING the future one frame at a time — and this
// app never has to guess »), et c'est aussi celle du pilote (« ne jamais
// s'engager sans avoir vérifié »). Tout le tracé et tout le relief sont connus
// au chargement : on résout hors ligne.
//
// Pour chaque indice on calcule l'altitude MINIMALE que la caméra doit tenir :
//   · la garde au sol sous elle,
//   · plus ce qu'il faut pour VOIR le sujet par-dessus le relief.
// Puis on passe le tout dans le filtre max-plus à rebours de pilote.js
// (`profilTenable`), qui transforme cette suite de contraintes ponctuelles en un
// profil que l'appareil peut réellement voler : il commence à monter AVANT la
// crête, juste assez tôt. La même pièce sert deux fois — c'est elle qui donne
// au pilote sa détection de cul-de-sac et à la poursuite son anti-occlusion.
export function cuirePlanDeVol({
  trace, ligne, sampleGround, standoff, tilt, avance, garde, penteMontee, cote0 = 1,
  peau = 0.35, fenetreVisee = 0,
}) {
  const n = ligne.length
  const fen = fenetreVisee || Math.max(4, Math.round(avance * 1.5))
  const cotes = new Int8Array(n)
  const alt = new Float64Array(n)
  const ds = new Float64Array(n)
  const posXZ = new Array(n)

  // Le côté : celui de l'INTÉRIEUR du virage, avec hystérésis. Il vient de la
  // courbure de la ligne LISSÉE, qui n'a plus de lacets — donc il change
  // lentement, alors que la courbure du tracé brut le ferait basculer à chaque
  // épingle (p90 de pente 50 % sur ce parcours : les épingles sont partout).
  let cote = cote0
  let depuis = 0
  for (let i = 0; i < n; i++) {
    const k = courbureA(ligne, i, Math.max(4, Math.round(avance * 0.6)))
    const voulu = k > 1e-4 ? -1 : k < -1e-4 ? 1 : cote
    depuis++
    // On ne change de côté que si le virage est franc ET qu'on est resté un
    // moment de l'autre bord : un hélicoptère ne saute pas d'un flanc à l'autre.
    if (voulu !== cote && Math.abs(k) > 3e-4 && depuis > fen * 2) { cote = voulu; depuis = 0 }
    cotes[i] = cote
  }

  // ⚠️ LE CHANGEMENT DE CÔTÉ EST UNE TRANSLATION, PAS UNE MANŒUVRE. Un
  // hélicoptère se décale latéralement sans faire de tour : c'est justement ce
  // qu'un avion ne sait pas faire. On lisse donc la suite de côtés (qui vaut
  // ±1) en une rampe continue — la caméra GLISSE d'un flanc à l'autre en
  // passant par le dessus du coureur, au lieu de sauter. Sans ce lissage, un
  // basculement produisait un saut de 2 × horiz (~2,5 unités monde ici), soit
  // exactement l'a-coup que la dérivée seconde punit.
  const coteLisse = Float64Array.from(cotes)
  const fenCote = Math.max(6, fen * 3)
  for (let p = 0; p < 3; p++) {
    const t = Float64Array.from(coteLisse)
    for (let i = 0; i < n; i++) {
      let sum = 0
      let c = 0
      for (let j = Math.max(0, i - fenCote); j <= Math.min(n - 1, i + fenCote); j++) { sum += t[j]; c++ }
      coteLisse[i] = sum / c
    }
  }

  const horiz = standoff * Math.cos(tilt)
  const vert = standoff * Math.sin(tilt)
  for (let i = 0; i < n; i++) {
    const j = clamp(i + avance, 0, n - 1)
    const p = ligne[Math.round(j)]
    const a = ligne[clamp(Math.round(j) - 3, 0, n - 1)]
    const b = ligne[clamp(Math.round(j) + 3, 0, n - 1)]
    const cap = capDe(b.x - a.x, b.z - a.z)
    const perp = cap + Math.PI / 2
    const x = p.x + Math.sin(perp) * horiz * coteLisse[i]
    const z = p.z + Math.cos(perp) * horiz * coteLisse[i]
    posXZ[i] = { x, z }
    const sol = sampleGround(x, z)
    const solOk = Number.isFinite(sol) ? sol : 0
    // contrainte 1 : la garde au sol
    let besoin = solOk + garde
    // contrainte 2 : voir le sujet — MAINTENANT et sur toute la fenêtre à venir.
    // C'est ce « et à venir » qui fait monter AVANT la crête au lieu de subir.
    // ⚠️ ON ÉCHANTILLONNE LA FENÊTRE FIN. À un point sur quatre, la cuisson
    // ratait des instants où le sujet passait derrière une croupe entre deux
    // relevés — même piège que l'échantillonnage du segment de fleet.js, une
    // dimension plus loin. La cuisson n'a lieu qu'une fois : elle a les moyens.
    for (let k = i; k <= Math.min(n - 1, i + fen); k += Math.max(1, Math.round(fen / 12))) {
      const sujet = trace[k]
      const cam = { x, y: Math.max(besoin, p.y + vert), z }
      const m = monteePourVoir({ sampleGround, cam, sujet, peau })
      if (m > 0) besoin = Math.max(besoin, cam.y + m)
    }
    alt[i] = Math.max(besoin, ligne[Math.round(j)].y + vert)
    ds[i] = i > 0 ? Math.hypot(posXZ[i].x - posXZ[i - 1].x, posXZ[i].z - posXZ[i - 1].z) : 0
  }
  // Le filtre max-plus à rebours : de contraintes ponctuelles à un profil volable.
  for (let i = 0; i < n - 1; i++) ds[i] = ds[i + 1]
  ds[n - 1] = ds[n - 2] || 1
  const profil = profilTenable({ sol: Array.from(alt, (v) => v - garde), ds: Array.from(ds), penteMontee, garde })
  // …puis un lissage doux : le max-plus donne des rampes à cassure, et une
  // cassure de pente verticale se voit à l'œil (c'est la dérivée seconde).
  const out = Float64Array.from(profil)
  for (let p = 0; p < 3; p++) {
    const t = Float64Array.from(out)
    for (let i = 1; i < n - 1; i++) out[i] = (t[i - 1] + t[i] + t[i + 1]) / 3
    for (let i = 0; i < n; i++) if (out[i] < profil[i]) out[i] = profil[i]
  }
  return { cotes, coteLisse, alt: out, posXZ }
}

// ==================================================== 5. LE CADRAGE
//
// « AU CENTRE DE L'ATTENTION » N'EST PAS « AU CENTRE DU CADRE ».
//
// Un sujet en mouvement se cadre avec de l'ESPACE DEVANT LUI (lead room) :
// cadré pile au centre, il a l'air de sortir du cadre ; cadré au centre avec
// l'espace derrière, il a l'air de reculer. On vise donc un point EN AVANT du
// coureur, ce qui le repousse du côté opposé — donc en arrière du centre, avec
// la route devant lui à l'image.
//
// La distance de visée n'est pas arbitraire : pour placer le sujet à une
// fraction `decentrage` de la demi-hauteur de cadre, il faut viser
//     avance = distance × tan(decentrage × fov/2).
// C'est exact, pas approché — la formule est l'inverse de solvePitchForNdcY
// (drone-cam.js), dont ce module reprend le raisonnement sans en dépendre.
export function visee({ sujet, cam, capSujet, decentrage = 0.30, fovDeg = 30 }) {
  const d = Math.hypot(sujet.x - cam.x, sujet.y - cam.y, sujet.z - cam.z)
  const lead = d * Math.tan(clamp(decentrage, 0, 0.9) * ((fovDeg * Math.PI) / 360))
  return {
    x: sujet.x + Math.sin(capSujet) * lead,
    y: sujet.y,
    z: sujet.z + Math.cos(capSujet) * lead,
  }
}

// ==================================================== 6. LE RÉPERTOIRE
//
// « 47 km d'un seul plan continu, c'est trop long. » Une retransmission alterne,
// et c'est cette alternance qui sépare une démonstration technique d'un plan
// qu'on peut montrer. Cinq plans, tous fondés sur le même plan de vol cuit :
//
//   · `etablissement`  — plan d'ouverture, haut, le parcours entier dans le
//                        cadre ; on descend vers le sujet. Il dit OÙ on est.
//   · `poursuite`      — le plan principal : à l'intérieur du virage, en avance,
//                        lead room. C'est celui qui « garde la tête au centre ».
//   · `depassement`    — la caméra double le sujet puis se retourne : l'avance
//                        passe de + à −, le regard bascule. Il dit la VITESSE.
//   · `profil`         — latéral serré, parallèle au coureur, standoff réduit.
//                        Il dit l'EFFORT (la pente se lit de profil).
//   · `fixe`           — la caméra se pose sur un point haut et laisse le sujet
//                        traverser le cadre. Il dit l'ÉCHELLE du relief.
//
// L'enchaînement par défaut alterne large et serré, et ne laisse jamais le même
// plan tenir plus de quatorze secondes.
export const PLANS_POURSUITE = ['etablissement', 'poursuite', 'depassement', 'profil', 'fixe']

export const SEQUENCE_DEFAUT = [
  { id: 'etablissement', duree: 9 },
  { id: 'poursuite', duree: 14 },
  { id: 'profil', duree: 8 },
  { id: 'poursuite', duree: 12 },
  { id: 'depassement', duree: 9 },
  { id: 'fixe', duree: 7 },
  { id: 'poursuite', duree: 11 },
]

// Quel plan à l'instant t, et où en est-il (0→1) ?
export function planA(sequence, t, duree) {
  const total = sequence.reduce((s, p) => s + p.duree, 0) || 1
  const echelle = duree / total // la séquence s'étire ou se resserre sur le clip
  let acc = 0
  for (const p of sequence) {
    const d = p.duree * echelle
    if (t < acc + d || p === sequence[sequence.length - 1]) {
      return { id: p.id, s: clamp((t - acc) / d, 0, 1), debut: acc, duree: d }
    }
    acc += d
  }
  return { id: sequence[0].id, s: 0, debut: 0, duree }
}

// adoucissement aux raccords : un plan ne démarre ni ne finit sur une cassure
const doux = (s) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2)
function fondu(s, bord = 0.12) {
  if (s < bord) return doux(s / bord)
  if (s > 1 - bord) return doux((1 - s) / bord)
  return 1
}

// ============================================ 6 bis. LE CHOIX DU TRONÇON
//
// ⚠️ ON NE COUVRE PAS LES 47 KM, ET IL FAUT LE DIRE FRANCHEMENT.
//
// Le parcours d'Adrien fait 47,4 km ; à l'allure de Tobler ça fait 3 h 40. Un
// clip de 70 s le comprime donc 190 fois — et c'est là que le compte ne tombe
// plus juste : à cette compression, le coureur traverse une épingle en un
// dixième de seconde d'écran. Mesuré sur le banc, l'axe de visée balaie alors à
// 202 °/s, presque trois fois le seuil de lisibilité, et AUCUN réglage de caméra
// n'y peut quoi que ce soit — ce n'est pas un défaut de suivi, c'est de
// l'échantillonnage : à 120 m du sujet (la fourchette du métier), une épingle de
// 400 m sous-tend 70° de champ, et il faut bien les parcourir.
//
// Deux issues seulement : allonger le clip, ou reculer la caméra hors de la
// fourchette réaliste. Une retransmission fait la même chose, et elle en fait
// une troisième : ELLE NE MONTRE PAS TOUT. On ne suit pas 3 h 40 de course, on
// suit LE tronçon.
//
// Le tronçon par défaut n'est donc pas tiré au sort : c'est celui qui accumule
// le plus de DÉNIVELÉ POSITIF par kilomètre — la « montée reine », celle que la
// course elle-même met en avant, et celle où le coureur souffre le plus (donc
// où l'allure de Tobler a le plus à dire).
export function troncoReine(trace, { part = 0.16, exagerationV = 1 } = {}) {
  const n = trace.length
  const fen = Math.max(30, Math.round(n * part))
  if (fen >= n) return [0, n - 1]
  // dénivelé positif cumulé, pour un balayage en O(n)
  const dp = new Float64Array(n)
  for (let i = 1; i < n; i++) {
    const dy = (trace[i].y - trace[i - 1].y) / (exagerationV || 1)
    dp[i] = dp[i - 1] + Math.max(0, dy)
  }
  let best = 0
  let bestV = -1
  for (let i = 0; i + fen < n; i++) {
    const v = dp[i + fen] - dp[i]
    if (v > bestV) { bestV = v; best = i }
  }
  return [best, best + fen]
}

// Abscisse curviligne 3D d'une polyligne, un cumul par sommet.
function cumul3D(pts) {
  const c = new Float64Array(pts.length)
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    c[i] = c[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return c
}

// OÙ EST LE SUJET SUR LE TRACÉ D'ORIGINE, en fraction d'indice de sommet (0..1).
//
// ⚠️ SANS ÇA, LE MARQUEUR DE TÊTE DE COURSE ET LA CAMÉRA MONTRENT DEUX ENDROITS
// DIFFÉRENTS — et une poursuite dont le sujet est ailleurs à l'écran ne veut
// plus rien dire. ShibuMap place sa tête de course avec `headT`, une fraction de
// l'INDICE DE SOMMET du tracé chargé (voir `revealVertexIndex` dans gpx.js),
// pendant que la poursuite raisonne en indice sur `brut` : rééchantillonné à pas
// constant ET coupé au tronçon. Ni la même origine, ni le même pas.
//
// Le pont est l'ABSCISSE CURVILIGNE, seule grandeur commune : `brut` avance
// exactement de `pas` par indice depuis le sommet `troncon[0]`, donc
//     s = cumTrace[troncon[0]] + idx × pas
// et il ne reste qu'à retrouver le sommet d'origine à cette abscisse.
export function fractionSurTrace(ctx, idx) {
  const c = ctx?.cumTrace
  if (!c || c.length < 2) return 0
  const s = clamp(c[ctx.troncon[0]] + idx * ctx.pas, 0, c[c.length - 1])
  let lo = 0
  let hi = c.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (c[mid] <= s) lo = mid
    else hi = mid
  }
  const seg = c[hi] - c[lo]
  const f = seg > 1e-12 ? (s - c[lo]) / seg : 0
  return clamp((lo + f) / (c.length - 1), 0, 1)
}

// ==================================================== 7. LA PRÉPARATION
//
// Tout est cuit ici, une fois. `poseDePoursuite` n'est ensuite qu'une lecture.
export function preparerPoursuite({
  trace, sampleGround, half,
  metresParUnite = 1, exagerationV = 1,
  vPlat = 13, raideur = 3.5, duree = 70,
  profil = 'helico', surcharge = {},
  hauteurM = 120, tiltDeg = 32, standoff = null,
  avanceRel = 0.9, decentrage = 0.30, fovDeg = 30,
  sequence = SEQUENCE_DEFAUT,
  espacement = null,
  portion = 'reine', // 'reine' | [a, b] en fractions | null (tout le parcours)
} = {}) {
  if (!trace || trace.length < 8) return null
  const P = resoudreProfil(profil, half, surcharge)
  // ⚠️ L'ABSCISSE CURVILIGNE DU TRACÉ D'ORIGINE, CALCULÉE AVANT LA COUPE — après,
  // le tronçon aurait perdu son origine et il n'y aurait plus moyen de dire où
  // est le sujet SUR LA COURSE ENTIÈRE. C'est le seul pont entre les deux
  // échelles d'indices du module ; voir `fractionSurTrace`.
  const cumTrace = cumul3D(trace)
  // Le tronçon, AVANT tout le reste : c'est lui qui fixe l'accélération.
  let troncon = [0, trace.length - 1]
  if (portion === 'reine') troncon = troncoReine(trace, { exagerationV })
  else if (Array.isArray(portion)) {
    troncon = [Math.round(portion[0] * (trace.length - 1)), Math.round(portion[1] * (trace.length - 1))]
  }
  const traceCoupee = trace.slice(troncon[0], troncon[1] + 1)
  if (traceCoupee.length >= 8) trace = traceCoupee
  // Rééchantillonnage à pas constant : sans lui, un GPX dont les points sont
  // serrés en montée et lâches en descente donnerait un lissage inégal.
  const pas = espacement || Math.max(half * 0.004, 0.15)
  const brut = reechantillonner(trace, pas)
  if (brut.length < 8) return null

  // ⚠️ LA HAUTEUR VIENT DU MÉTIER, ET ELLE SE CONVERTIT — 50 à 150 m au-dessus
  // du sujet, c'est la fourchette de travail d'un hélicoptère de retransmission.
  // Mais le bloc est une maquette, et il faut deux conversions, pas une :
  //   · horizontalement, `metresParUnite` (mesuré ici : 20 130 m d'emprise pour
  //     56 unités monde à z12 Interlaken, soit 359,5 m par unité) ;
  //   · verticalement, il faut EN PLUS diviser par l'exagération du relief
  //     (2,8 par défaut dans ShibuMap) — ou plutôt multiplier, puisque le relief
  //     est étiré : 1 m réel occupe 2,8 m d'unité verticale.
  // Résultat mesuré : 120 m réels = 120 × 2,8 / 359,5 = 0,93 unité monde. La
  // garde au sol du profil hélicoptère (0,616 unité) vaut, elle, 79 m réels —
  // elle tombe donc PILE dans la fourchette basse du métier. Les deux chiffres
  // sont cohérents, ce qui est la meilleure preuve que la conversion est juste.
  const hauteur = (hauteurM * (exagerationV || 1)) / Math.max(metresParUnite, 1e-9)
  const tilt = (tiltDeg * Math.PI) / 180
  // le standoff DÉCOULE de la hauteur voulue et de l'assiette de la prise de vue
  const so = standoff ?? Math.max(hauteur / Math.max(Math.sin(tilt), 0.1), P.garde * 1.6)
  // L'avance se compte en SECONDES de course, donc en indices : c'est une durée
  // d'anticipation, pas une distance — comme tout le reste chez le pilote.
  const prof = profilAllure({ trace: brut, metresParUnite, exagerationV, vPlat, raideur, duree })
  prof.vPlat = vPlat
  prof.raideur = raideur
  const vMoyenne = prof.cum[prof.cum.length - 1] / Math.max(prof.dureeReelle, 1e-9)

  // ⚠️ L'AVANCE SE MESURE EN STANDOFF, PAS EN SECONDES — et ça a été une erreur
  // franche. Comptée en secondes de course RÉELLE elle valait deux points de
  // grille (invisible) ; comptée en secondes de CLIP elle plaçait la caméra une
  // heure de course devant le coureur, puisque le clip est accéléré 1 750 fois.
  // Aucune des deux n'a de sens. Ce qui compte est GÉOMÉTRIQUE : de combien la
  // caméra précède le sujet PAR RAPPORT À SA DISTANCE À LUI. À 0,9 standoff, le
  // coureur est nettement derrière l'objectif sans sortir du cadre.
  const avance = Math.max(2, Math.round((avanceRel * so) / pas))

  // La ligne de vol, calibrée sur ce que l'appareil sait tourner (voir ligneVolable).
  const vVol = (prof.cum[prof.cum.length - 1] / Math.max(prof.duree, 1e-9))
  const rayonMin = Math.max(P.rayon, (vVol * vVol) / (P.g * Math.tan(P.rouliMax)))
  // L'écart toléré vaut 1,5 standoff : au-delà, le sujet sort du cadrage prévu.
  const lv = ligneVolable(brut, { rayonMin, ecartMax: so * 1.5, fenetre0: Math.max(8, Math.round(so / pas)) })
  const lisse = lv.lisse
  // ⚠️ LA MONTÉE EST AFFRANCHIE EN VOL LENT, et c'est tout l'apport de la
  // voilure tournante. `profilTenable` raisonne en PENTE (hauteur par unité
  // parcourue) ; or la pente disponible vaut montMax / v, et v est ici celle du
  // COUREUR, pas celle d'un appareil de croisière. Dans une montée à 50 % le
  // coureur avance à 2 km/h : la pente de montée disponible explose, donc
  // l'hélicoptère monte quasi verticalement pour dégager une crête. C'est
  // exactement le comportement réel, et il tombe tout seul de la formule.
  const penteMontee = clamp((P.montMax * 0.9) / Math.max(vMoyenne, 1e-6), 0, 12)
  const plan = cuirePlanDeVol({
    trace: brut, ligne: lisse, sampleGround, standoff: so, tilt, avance,
    garde: P.garde, penteMontee, peau: P.garde * 0.5,
  })
  return {
    brut, lisse, prof, plan, profil: P, half, sampleGround,
    standoff: so, tilt, avance, decentrage, fovDeg, sequence,
    duree: prof.duree,
    pas,
    hauteur,
    hauteurM,
    metresParUnite,
    troncon,
    cumTrace,
    ligneInfo: lv,
    rayonMin,
    vVol,
    // mesures utiles au rapport et aux tests
    longueur: prof.cum[prof.cum.length - 1],
  }
}

// ==================================================== 8. LES POSES
//
// Une pose = position, cible, roulis. Même contrat que pilote.js, donc le même
// adaptateur three.js sait l'écrire.

// De combien faut-il monter, depuis un point FIXE, pour voir le sujet pendant
// tout un intervalle de temps ? C'est ce qui permet aux plans qui s'écartent de
// la ligne de vol (ouverture, plan posé) de payer leur propre vérification :
// la cuisson ne couvre que la ligne de vol.
function hauteurDeVue(ctx, cam, t0, t1, n = 9) {
  let m = 0
  for (let i = 0; i <= n; i++) {
    const S = sujetA(ctx.brut, ctx.prof, t0 + ((t1 - t0) * i) / n)
    const h = monteePourVoir({ sampleGround: ctx.sampleGround, cam, sujet: S.pos, peau: ctx.profil.garde * 0.5 })
    if (h > m) m = h
  }
  return m
}

// Point de la ligne de vol pour un sujet à l'indice `i`, altitude cuite comprise.
//
// ⚠️ L'AVANCE EST DÉJÀ DEDANS, ET C'EST LE BUG QUI A COÛTÉ LE PLUS CHER ICI.
// `cuirePlanDeVol` range dans `posXZ[i]` la position de la caméra QUAND LE SUJET
// EST À L'INDICE i — l'avance est appliquée à la cuisson. Les plans appelaient
// pourtant `volA(ctx, S.idx + ctx.avance)`, donc l'avance comptait DEUX FOIS :
// la caméra volait à un endroit dont personne n'avait vérifié la visibilité.
// Mesuré sur le tracé d'Interlaken : le sujet était caché 12,2 % du temps dans
// le plan de poursuite lui-même, alors que c'est exactement ce que la cuisson
// est censée rendre impossible. `i` est donc l'indice DU SUJET, point.
// ⚠️ L'INTERPOLATION EST CUBIQUE, PAS LINÉAIRE — et c'est la dérivée seconde qui
// l'a exigée, encore. Le plan de vol ne compte que 167 points pour 70 secondes :
// la caméra franchit un point toutes les 0,42 s, soit toutes les 25 images. En
// interpolant linéairement, la DIRECTION casse à chaque franchissement — la
// position reste continue, sa dérivée aussi, mais pas la seconde. Mesuré sur le
// tracé d'Interlaken : 491 fois l'accélération d'un virage nominal, une pointe
// toutes les 25 images, invisible dans un test de position et parfaitement
// visible à l'œil. Catmull-Rom (la même raison qui fait que drone-cam.js utilise
// CatmullRomCurve3) rend la courbe C¹ et l'accélération continue.
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function volA(ctx, i) {
  const n = ctx.lisse.length
  const f = clamp(i, 0, n - 1)
  const b = Math.floor(f)
  const u = f - b
  const p = ctx.plan.posXZ
  const A = ctx.plan.alt
  const k = (j) => clamp(j, 0, n - 1)
  const i0 = k(b - 1)
  const i1 = k(b)
  const i2 = k(b + 1)
  const i3 = k(b + 2)
  // ⚠️ MAIS PAS SUR L'ALTITUDE SANS FILET. Une cubique de Catmull-Rom
  // SOUS-DÉPASSE entre deux points de contrôle — c'est sa nature, et sur
  // l'altitude ça veut dire passer sous le profil qu'on vient de cuire, donc
  // sous la ligne de vue vérifiée. On borne donc par le minimum du couple
  // encadrant : la courbe reste douce partout où elle ne fautait pas, et elle ne
  // peut plus descendre là où la cuisson l'interdit.
  const yLisse = catmull(A[i0], A[i1], A[i2], A[i3], u)
  return {
    x: catmull(p[i0].x, p[i1].x, p[i2].x, p[i3].x, u),
    y: Math.max(yLisse, Math.min(A[i1], A[i2])),
    z: catmull(p[i0].z, p[i1].z, p[i2].z, p[i3].z, u),
  }
}

// LE ROULIS, DÉDUIT DU VIRAGE — jamais commandé, comme chez le pilote.
//
// ⚠️ MAIS IL S'ÉTEINT EN VOL LENT, ET C'EST LA SIGNATURE DE L'HÉLICOPTÈRE. Un
// hélicoptère s'incline en vol de TRANSLATION exactement comme un avion ; en vol
// lent il pivote sur son axe, à plat. « Un drone lace à plat, un aéronef
// s'incline » est donc vrai en vitesse et FAUX en vol lent — et sur ce parcours
// la caméra passe une bonne part du temps en vol lent, puisqu'elle tient la
// station à côté d'un coureur qui monte à 4 km/h.
//
// On module donc l'inclinaison par un facteur de translation qui vaut 0 sous
// `vTranslation / 3` et 1 au-dessus de `vTranslation`. Sans lui, on aurait un
// avion ralenti : une machine inclinée à l'arrêt, ce qui ne se voit nulle part.
// ⚠️ ET LE SEUIL SE JUGE EN VITESSE RÉELLE, PAS EN VITESSE DE CLIP. Le clip est
// accéléré (645 à 1 750 fois selon la durée demandée) : mesurée dans le temps de
// l'écran, la caméra file, et elle s'inclinerait tout le temps. Mais ce qu'on
// dépeint est un VRAI hélicoptère au-dessus d'un VRAI coureur — c'est sa vitesse
// à lui qui décide s'il est en translation. On divise donc par l'accélération.
//
// LA TRANSITION SE FAIT VERS 35 km/h (~19 nœuds) : c'est l'ordre de grandeur de
// la vitesse de translation d'un hélicoptère, celle à partir de laquelle il
// s'appuie sur son déplacement au lieu de brasser son propre souffle.
//
// ⚠️ CE QUE CE CHIFFRE IMPLIQUE, ET IL FAUT L'ASSUMER : un hélicoptère qui suit
// un coureur à 13 km/h N'EST JAMAIS EN TRANSLATION. Il reste à plat, il pivote
// sur son axe. Ce n'est pas une limite du modèle, c'est ce que font réellement
// les hélicoptères de retransmission en cyclisme et en trail — ils tiennent la
// station à côté du sujet. L'inclinaison ne revient donc QUE dans les plans où
// la caméra se déplace par rapport au sujet : le dépassement, et la descente du
// plan d'établissement. C'est exactement là qu'on veut la voir.
export const V_TRANSLATION_KMH = 35

export function facteurTranslation(vKmh, seuil = V_TRANSLATION_KMH) {
  const t = clamp((vKmh - seuil / 3) / Math.max(seuil * (2 / 3), 1e-9), 0, 1)
  return t * t * (3 - 2 * t) // adouci : l'inclinaison naît, elle n'apparaît pas
}

// Vitesse RÉELLE de l'appareil, en km/h, à partir de son déplacement à l'écran.
export function vitesseCameraKmh(camA, camB, dt, ctx) {
  if (!camA || !(dt > 0)) return 0
  const d = Math.hypot(camB.x - camA.x, camB.y - camA.y, camB.z - camA.z)
  const vMonde = d / dt / Math.max(ctx.prof.acceleration, 1e-9) // on ôte l'accélération du clip
  return (vMonde * ctx.metresParUnite * 3600) / 1000
}

function rouliDeVol(ctx, i, vApparente, vCamKmh) {
  const k = courbureA(ctx.plan.posXZ, i, Math.max(4, Math.round(ctx.avance * 0.6)))
  const omega = k * vApparente
  const brut = clamp(rouliCoordonne(vApparente, omega, ctx.profil.g), -ctx.profil.rouliMax, ctx.profil.rouliMax)
  return brut * facteurTranslation(vCamKmh)
}

// ⚠️ LA POSE PORTE UN ÉTAT, ET IL N'EST PAS FACULTATIF.
//
// Première version sans état : la parade d'occlusion se déclenchait à l'image,
// et sur le tracé d'essai elle a levé la caméra 1 356 fois sur 4 201 images —
// chacune un saut vertical instantané. L'axe de visée balayait à 5 332 °/s et
// l'accélération atteignait 88 943 fois celle d'un virage nominal. Aucun de ces
// deux chiffres n'apparaît dans un test de position : c'est encore la dérivée
// seconde qui parle, comme pour le pilote.
//
// L'état porte donc les deux grandeurs qui doivent avoir de l'inertie : la levée
// d'occlusion (un hélicoptère monte, il ne se téléporte pas) et la cible de
// regard (une tourelle gyrostabilisée ne claque pas). `poseDePoursuite` reste
// pure : elle reçoit l'état et en rend un nouveau.
export function etatInitial() {
  return { leve: 0, cible: null, cam: null }
}

export function poseDePoursuite(t, ctx, etat = null, dt = 1 / 60) {
  const E = etat || etatInitial()
  const S = sujetA(ctx.brut, ctx.prof, t)
  const sujet = S.pos
  const n = ctx.lisse.length
  const pl = planA(ctx.sequence, t, ctx.duree)
  const e = fondu(pl.s)
  const v = S.vitesse * ctx.prof.acceleration

  let cam
  const capVise = S.cap
  let decentrage = ctx.decentrage

  switch (pl.id) {
    // ---- plan d'ouverture : haut, tout le parcours, puis on descend ---------
    case 'etablissement': {
      const haut = volA(ctx, S.idx)
      // Le point de départ est PLEIN CIEL au-dessus du sujet, pas « deux fois
      // plus loin que la ligne de vol » : ce dernier calcul dépendait du côté
      // courant et sautait quand le côté basculait.
      // ⚠️ ON PART DE L'ALTITUDE LISSÉE, PAS DE CELLE DU COUREUR. Mesuré : en
      // interpolant depuis `sujet.y` (le tracé drapé brut), la caméra recopiait
      // à 100 % la trépidation du sentier au début du plan — 283 fois
      // l'accélération d'un virage nominal, la pire pointe de tout le clip. Le
      // coureur cahote, l'hélicoptère non.
      // ⚠️ UN PLAN DE SITUATION EST OBLIQUE, PAS VERTICAL. Première version :
      // départ à 1,15 demi-bloc au-dessus du coureur et 0,35 en arrière — vu de
      // là, l'axe de visée plonge à 73° et l'image est une carte, pas un plan.
      // On recule donc AUTANT qu'on monte, le long de l'axe du tronçon : la
      // caméra domine la course mais on voit encore le relief de profil, ce qui
      // est le seul intérêt d'un plan d'ouverture — dire où l'on est.
      // ⚠️ LE POINT DE DÉPART EST FIGÉ AU DÉBUT DU PLAN, PAS RECALCULÉ. Recalculé
      // à chaque image, il glissait avec le coureur — et comme sa hauteur se
      // cale sur le sol qui le porte, il montait et descendait avec le relief
      // sous lui : 468 fois l'accélération d'un virage nominal, la pire pointe
      // du clip, sur le plan qui est censé être le plus calme de tous. Une
      // caméra d'ouverture part d'un point choisi, elle ne le renégocie pas.
      const A = ctx.lisse[0]
      const B = ctx.lisse[n - 1]
      const capTroncon = capDe(B.x - A.x, B.z - A.z)
      const recul = ctx.half * 0.95
      const S0e = sujetA(ctx.brut, ctx.prof, pl.debut)
      const depart0 = volA(ctx, S0e.idx)
      const depart = {
        x: depart0.x - Math.sin(capTroncon) * recul,
        y: depart0.y + ctx.half * 0.62,
        z: depart0.z - Math.cos(capTroncon) * recul,
      }
      // ⚠️ LE POINT DE DÉPART SE VÉRIFIE AUSSI. Mesuré : en reculant d'un
      // demi-bloc le long de l'axe du tronçon, l'ouverture passait derrière une
      // croupe et perdait le sujet 59,6 % du temps — de loin le pire des cinq
      // plans, alors que la poursuite et le profil étaient à zéro. La cuisson ne
      // couvre que la ligne de vol ; un plan qui s'en écarte doit payer sa
      // propre vérification. On monte le départ jusqu'à voir, une fois pour
      // toutes — c'est justement ce qu'un hélicoptère sait faire.
      // …et la levée est calculée UNE FOIS pour le plan, sur son sujet de début.
      // Recalculée à chaque image, elle changeait de quelques centièmes par
      // image et donnait 625 fois l'accélération nominale : le remède devenait
      // le mal. Un plan d'ouverture se règle avant de tourner, pas pendant.
      const solD = ctx.sampleGround(depart.x, depart.z)
      depart.y = Math.max(depart.y, (Number.isFinite(solD) ? solD : 0) + ctx.profil.garde)
      depart.y += hauteurDeVue(ctx, depart, pl.debut, pl.debut + pl.duree * 0.5)
      const k = doux(pl.s)
      cam = { x: lerp(depart.x, haut.x, k), y: lerp(depart.y, haut.y, k), z: lerp(depart.z, haut.z, k) }
      decentrage = ctx.decentrage * k // au plus haut on centre : c'est un plan de situation
      break
    }
    // ---- le dépassement : l'avance passe de + à −, la caméra double ---------
    case 'depassement': {
      // De +avance à −avance : la caméra remonte le long du parcours, dépasse le
      // coureur et le regarde revenir. C'est le plan qui dit la vitesse.
      // L'avance EFFECTIVE passe de 1,2 à −1,6 fois l'avance nominale ; comme
      // `volA` en applique déjà une, l'écart demandé vaut (facteur − 1).
      const a = lerp(ctx.avance * 0.2, -ctx.avance * 2.6, doux(pl.s))
      cam = volA(ctx, S.idx + a)
      // en le regardant revenir, l'espace se met DERRIÈRE lui à l'image —
      // c'est le seul plan où le lead room s'inverse, et c'est voulu
      decentrage = ctx.decentrage * (1 - 2 * doux(pl.s))
      break
    }
    // ---- le profil : latéral serré, parallèle -------------------------------
    case 'profil': {
      // avance effective 0,25 → écart de −0,75 avance
      const p = volA(ctx, S.idx - ctx.avance * 0.75)
      // ⚠️ ON SE RAPPROCHE À L'HORIZONTALE SEULEMENT, ON NE DESCEND PAS. Première
      // version : on interpolait aussi l'altitude vers le coureur (62 %). Mesuré
      // sur le tracé d'Interlaken, ce plan perdait le sujet 29,2 % du temps — de
      // loin le pire des cinq — parce qu'en descendant on repasse sous les
      // croupes que l'altitude cuite venait justement de franchir. On garde donc
      // l'altitude du plan de vol et on ne resserre que le bras de levier
      // horizontal : le regard plonge davantage, ce qui est le cadrage voulu, et
      // la ligne de vue reste celle qui a été vérifiée.
      const ancre = ctx.lisse[clamp(Math.round(S.idx), 0, n - 1)]
      cam = {
        x: lerp(ancre.x, p.x, 0.62),
        y: p.y,
        z: lerp(ancre.z, p.z, 0.62),
      }
      decentrage = ctx.decentrage * 1.15
      break
    }
    // ---- le plan fixe : la caméra se pose et laisse passer ------------------
    case 'fixe': {
      // ⚠️ LE POINT DE POSE EST DÉTERMINISTE, PAS MÉMORISÉ. Première version : on
      // le calculait au premier appel du plan et on le rangeait dans `ctx`. Deux
      // défauts d'un coup — la fonction n'était plus pure (elle écrivait dans son
      // contexte), et un rendu hors ligne qui rembobine ou saute des images
      // obtenait un point différent. On le recalcule donc À PARTIR DE L'INSTANT
      // OÙ LE PLAN COMMENCE : la même entrée donne toujours la même sortie.
      const S0 = sujetA(ctx.brut, ctx.prof, pl.debut)
      cam = volA(ctx, clamp(S0.idx + ctx.avance * 1.5, 0, n - 1))
      // Une caméra POSÉE doit voir passer le sujet sur TOUTE la durée du plan :
      // elle ne peut plus se rattraper en montant, puisqu'elle ne bouge plus.
      // On la place donc assez haut d'emblée, en balayant les instants à venir.
      cam = { ...cam, y: cam.y + hauteurDeVue(ctx, cam, pl.debut, pl.debut + pl.duree) }
      decentrage = ctx.decentrage * 0.5
      break
    }
    // ---- la poursuite : le plan principal -----------------------------------
    default:
      cam = volA(ctx, S.idx)
      break
  }

  // ⚠️ LA GARDE AU SOL S'APPLIQUE À TOUS LES PLANS, SANS EXCEPTION. Le plan de
  // vol cuit la porte déjà, mais `etablissement`, `profil` et `fixe` s'en
  // écartent : le sujet impose la trajectoire, il ne suspend pas la physique.
  const sol = ctx.sampleGround(cam.x, cam.z)
  const mini = (Number.isFinite(sol) ? sol : 0) + ctx.profil.garde
  let plancher = false
  if (cam.y < mini) { cam = { ...cam, y: mini }; plancher = true }

  // Dernier filet d'occlusion : le plan cuit ne devrait presque jamais le
  // solliciter (les chiffres le disent), mais un plan qui s'écarte de la ligne
  // de vol peut se retrouver derrière une croupe. On MONTE — on ne rentre pas
  // vers le sujet, parce que rentrer change la taille du sujet à l'image, donc
  // le cadrage. C'est l'affordance de l'hélicoptère : dégager par le haut.
  //
  // ⚠️ ET LA LEVÉE A DE L'INERTIE. Appliquée telle quelle, elle produisait un
  // saut vertical à chaque image concernée. Elle monte donc au taux de montée
  // de l'appareil (affranchi, puisqu'on est en vol lent) et redescend deux fois
  // plus lentement — on ne se rejette pas vers le relief dès qu'on l'a passé.
  const peau = ctx.profil.garde * 0.5
  const besoin = sujetVisible({ sampleGround: ctx.sampleGround, cam, sujet, peau })
    ? 0
    : monteePourVoir({ sampleGround: ctx.sampleGround, cam, sujet, peau })
  // Taux de la levée : le taux NOMINAL, pas la ressource. Mesuré à 3 × montMax,
  // la levée à elle seule produisait 283 fois l'accélération d'un virage nominal
  // — le filet de sécurité devenait la principale source d'à-coups. C'est au
  // plan cuit d'anticiper ; ce filet ne doit que rattraper, doucement.
  const monte = ctx.profil.montMax
  const leve = clamp(besoin, (E.leve || 0) - monte * 0.5 * dt, (E.leve || 0) + monte * dt)
  if (leve > 0) cam = { ...cam, y: cam.y + leve }

  // La cible : lead room, puis lissage temporel. La tourelle gyrostabilisée est
  // douce par construction ; c'est ce filtre qui la modélise.
  // ⚠️ ON NE MESURE PAS UNE VITESSE À TRAVERS UNE COUPE. Au raccord, la position
  // saute d'un plan à l'autre ; divisée par dt, ça donne une vitesse absurde, et
  // l'hélicoptère s'inclinait à fond pendant une image — mesuré : 25° de roulis
  // en plein plan de poursuite, là où il doit rester à plat.
  const vCamKmh = E.plan && E.plan !== pl.id ? 0 : vitesseCameraKmh(E.cam, cam, dt, ctx)
  const brute = visee({ sujet, cam, capSujet: capVise, decentrage, fovDeg: ctx.fovDeg })
  let cible = brute
  if (E.cible) {
    const k = 1 - Math.exp(-dt / 0.35)
    cible = {
      x: E.cible.x + (brute.x - E.cible.x) * k,
      y: E.cible.y + (brute.y - E.cible.y) * k,
      z: E.cible.z + (brute.z - E.cible.z) * k,
    }
  }
  // …sauf au raccord entre deux plans : là, le cadrage DOIT sauter (c'est une
  // coupe, pas un mouvement), sinon la caméra traîne le cadre de l'ancien plan.
  if (E.plan && E.plan !== pl.id) cible = brute

  return {
    pos: cam,
    target: cible,
    roulis: pl.id === 'fixe' ? 0 : rouliDeVol(ctx, S.idx, v, vCamKmh) * e,
    sujet,
    // l'indice FRACTIONNAIRE du sujet sur `brut` — c'est lui, et pas la
    // position, qui permet de replacer la tête de course sur le tracé chargé
    // (voir `fractionSurTrace`) : chercher le sommet le plus proche d'un point
    // rendrait le mauvais sur un lacet, où deux brins se frôlent.
    idx: S.idx,
    plan: pl.id,
    vitesseKmh: S.vitesseKmh,
    pente: S.pente,
    plancher,
    leve,
    besoinLeve: besoin,
    vCamKmh,
    etat: { leve, cible, plan: pl.id, cam },
  }
}

// Déroule la poursuite entière hors ligne — l'outil de preuve, comme
// `volComplet` pour le pilote. C'est lui qui rend les chiffres du rapport.
export function poursuiteComplete(ctx, { dt = 1 / 60 } = {}) {
  const poses = []
  const n = Math.round(ctx.duree / dt)
  let etat = etatInitial()
  for (let i = 0; i <= n; i++) {
    const p = poseDePoursuite(i * dt, ctx, etat, dt)
    etat = p.etat
    poses.push(p)
  }
  return poses
}
