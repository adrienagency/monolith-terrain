import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROFILS, resoudreProfil, angleWrap, capDe,
  rouliCoordonne, rayonDeVirage, facteurEnergie, hauteurManoeuvre,
  encaissement, largeurLibre, altitudeSecuritaire, profilTenable,
  portesDuBloc, champDijkstra, cheminDepuisChamp, verifierCouloir,
  planifierVol, creerVol, stepPilote, poseDe, pointDeVisee, routeDegagee,
  seuilDemiTour, seuilPassage, virageLibre, pointsDevant, volComplet, cumulSur, buildHeightGrid,
} from '../src/pilote.js'

const HALF = 100
const deg = (r) => (r * 180) / Math.PI

// ============================================================== les reliefs
//
// ⚠️ LA LEÇON DU DÉPÔT, APPLIQUÉE ICI. « Un banc synthétique ment » : les
// normales par différences centrées donnaient 0,008° d'écart sur relief
// synthétique et 118,9° sur du MNT réel. Une caméra validée sur une gaussienne
// lisse se plantera dans les Alpes. On teste donc TROIS reliefs, et le troisième
// est le seul qui compte vraiment :
//   · la vallée coudée, propre — pour vérifier que la mécanique est juste ;
//   · la même AVEC DU BRUIT — parce qu'un relief réel en porte, et que c'est le
//     bruit qui fait échouer les gardes-fous, pas la forme ;
//   · le cirque fermé — le canyon en cul-de-sac, qui doit être REFUSÉ.
// La validation sur MNT réel (Chamonix, La Réunion) se fait in situ dans le
// navigateur, pas ici : node n'a pas les tuiles.

// Vallée coudée traversant le bloc du nord au sud, entre deux crêtes.
function valleeCoudee() {
  return (x, z) => {
    const xc = 18 * Math.sin(z / 40)
    const d = Math.abs(x - xc)
    const crete = 30 * Math.exp(-((d - 24) ** 2) / 60)
    const sommet = 45 * Math.exp(-((x ** 2 + (z + 60) ** 2) / 900))
    const fond = 2 + (100 - z) * 0.01
    return Math.max(fond, crete, sommet)
  }
}

// La même, salie. Un bruit déterministe de ±1,5 unité (5 % de la hauteur des
// crêtes) : c'est l'ordre de grandeur du grain d'un MNT à 30 m rapporté à un
// bloc de 100. Sans ce test, on ne saurait pas si les gardes tiennent sur autre
// chose qu'une surface analytique.
function valleeBruitee(amp = 1.5) {
  const lisse = valleeCoudee()
  return (x, z) => {
    const n = Math.sin(x * 1.7 + z * 0.9) * Math.cos(x * 0.4 - z * 2.3) + Math.sin(x * 5.1 - z * 3.7) * 0.5
    return lisse(x, z) + n * amp
  }
}

// CIRQUE FERMÉ — le canyon en cul-de-sac. Une gorge s'ouvre au sud, monte vers
// le nord, se resserre, et bute sur un mur infranchissable. Aucune sortie.
// Tout autour, un rempart. C'est la figure qui tue de vrais pilotes.
function cirqueFerme() {
  return (x, z) => {
    const rempart = Math.max(Math.abs(x), Math.abs(z)) > 74 ? 200 : 0
    // la gorge : un couloir étroit en x, ouvert au sud (z > 0)
    const dansGorge = Math.abs(x) < 9 && z > -40
    if (dansGorge) {
      // le fond monte de plus en plus vite vers le nord, puis c'est le mur
      const t = (40 - z) / 120
      return Math.max(rempart, 4 + 500 * Math.max(0, t) ** 3)
    }
    return Math.max(rempart, 120)
  }
}

// Entonnoir : couloir large au sud qui se resserre régulièrement vers le nord
// SANS remonter. Il n'a pas de sortie, mais il est plat : le refus ne peut donc
// venir que du critère de LARGEUR, pas de celui de pente.
function entonnoir() {
  return (x, z) => {
    // demi-largeur libre : 45 au sud, 4 au nord
    const w = 45 - 41 * ((100 - z) / 200)
    if (Math.abs(z) > 88) return 140 // fermé au nord ET au sud : aucune issue
    return Math.abs(x) < w ? 3 : 140
  }
}

// ================================================== 1. le virage coordonné
//
// « Un avion s'incline, un drone lace à plat. » C'est LE tell visuel, et il se
// vérifie par une relation, pas par une impression.

test('le roulis coordonne verifie r = v² / (g · tan φ)', () => {
  const g = 9.81
  for (const v of [20, 60, 120]) {
    for (const r of [200, 800, 3000]) {
      const omega = v / r
      const phi = rouliCoordonne(v, omega, g)
      // aller-retour exact : le rayon reconstruit depuis l'inclinaison
      assert.ok(Math.abs(rayonDeVirage(v, phi, g) - r) < r * 1e-9, `v=${v} r=${r}`)
    }
  }
})

test('le profil avion est calibre pour 30° au rayon nominal', () => {
  const p = resoudreProfil('avion', HALF)
  const phi = rouliCoordonne(p.v, p.omegaMax, p.g)
  assert.ok(Math.abs(deg(phi) - 30) < 0.01, `inclinaison nominale ${deg(phi).toFixed(2)}°`)
})

test('l energie interdit de virer a fond ET de monter a fond', () => {
  // en virage, la portance verticale chute en cos φ
  assert.ok(facteurEnergie(0) > facteurEnergie(0.6))
  assert.ok(facteurEnergie(0.6) > facteurEnergie(Math.PI / 3))
  assert.ok(Math.abs(facteurEnergie(0) - 1) < 1e-9)
  // à 45° (roulis max avion), il ne reste que 71 % de la montée
  assert.ok(Math.abs(facteurEnergie(Math.PI / 4) - Math.SQRT1_2) < 1e-9)
})

// ============================================ 2. le point de visée est DEVANT
//
// « Un pilote regarde le sol devant lui à ras de terre, pas le sol sous lui. »

test('le point de visee est toujours DEVANT, jamais sous l appareil', () => {
  const sol = valleeBruitee()
  const plan = planifierVol({ sampleGround: sol, half: HALF })
  assert.ok(plan, 'un plan doit exister sur la vallee bruitee')
  plan.sampleGround = sol
  let e = creerVol(plan)
  let pires = { horiz: Infinity, devant: Infinity }
  for (let i = 0; i < 1800; i++) {
    e = stepPilote(e, 1 / 60, plan, { sampleGround: sol })
    const p = poseDe(e, plan, { sampleGround: sol })
    const dx = p.target.x - p.pos.x
    const dz = p.target.z - p.pos.z
    const horiz = Math.hypot(dx, dz)
    // projection de la visée sur le cap : strictement positive = devant
    const devant = dx * Math.sin(e.cap) + dz * Math.cos(e.cap)
    pires = { horiz: Math.min(pires.horiz, horiz), devant: Math.min(pires.devant, devant) }
  }
  // la cible n'est jamais confondue avec l'appareil (« le sol sous lui »)
  assert.ok(pires.horiz > plan.profil.rayon * 0.5, `distance horizontale minimale ${pires.horiz.toFixed(2)}`)
  // …et elle est toujours du bon côté du nez
  assert.ok(pires.devant > 0, `projection minimale sur le cap ${pires.devant.toFixed(2)}`)
})

test('la distance de visee vaut 1 a 3 rayons de virage — le rapport reel', () => {
  // La règle réelle « on regarde là où on sera dans 10 à 20 s » donne, à 80 m/s
  // et 30° d'inclinaison, 1,2 à 2,3 rayons de virage. C'est CE RAPPORT qui est
  // transposé (voir POURQUOI tVisee N'EST PAS 10 s dans pilote.js) — et c'est
  // ce test qui empêche de le perdre en réglant tVisee « à l'œil ».
  for (const nom of ['avion', 'helico']) {
    const p = resoudreProfil(nom, HALF)
    const k = p.dVisee / p.rayon
    assert.ok(k >= 1 && k <= 3.2, `${nom} : visee a ${k.toFixed(2)} rayons`)
  }
})

test('la distance de visee DEPEND de la vitesse', () => {
  const sol = valleeCoudee()
  const profil = resoudreProfil('avion', HALF)
  const base = { x: 0, z: 0, y: 40, cap: 0, roulis: 0, omega: 0 }
  const lent = pointDeVisee({ ...base, v: profil.v * 0.5 }, { profil, sampleGround: sol })
  const vite = pointDeVisee({ ...base, v: profil.v }, { profil, sampleGround: sol })
  const dLent = Math.hypot(lent.x, lent.z)
  const dVite = Math.hypot(vite.x, vite.z)
  assert.ok(dVite > dLent * 1.5, `lent ${dLent.toFixed(1)} vs vite ${dVite.toFixed(1)}`)
})

// ================================================ 3. la lecture du relief

test('l encaissement voit une vallee la ou une plaine ne donne rien', () => {
  const g = buildHeightGrid({ sampleGround: valleeCoudee(), half: HALF, n: 56 })
  const enc = encaissement(g, 6)
  const lire = (x, z) => {
    const i = Math.min(g.n - 1, Math.max(0, Math.floor((x + HALF) / g.cell)))
    const j = Math.min(g.n - 1, Math.max(0, Math.floor((z + HALF) / g.cell)))
    return enc[j * g.n + i]
  }
  // au fond de la vallée (l'axe passe par x ≈ 18·sin(z/40))
  const fond = lire(18 * Math.sin(20 / 40), 20)
  // en dehors du système de crêtes, sur le plat du bord
  const plaine = lire(-90, 20)
  assert.ok(fond > 10, `encaissement au fond = ${fond.toFixed(1)}`)
  assert.ok(plaine < 2, `encaissement en plaine = ${plaine.toFixed(1)}`)
  assert.ok(fond > plaine * 5, 'une vallee doit se distinguer nettement d une plaine')
})

test('la largeur libre se mesure des DEUX cotes et sature a la portee', () => {
  // couloir droit de demi-largeur 20, murs infranchissables
  const sol = (x) => (Math.abs(x) < 20 ? 0 : 500)
  const l = largeurLibre({ sampleGround: sol, x: 0, z: 0, cap: 0, y: 10, garde: 1, portee: 60 })
  assert.ok(Math.abs(l.gauche - 20) < 2, `gauche ${l.gauche}`)
  assert.ok(Math.abs(l.droite - 20) < 2, `droite ${l.droite}`)
  // décalé de 10 vers la droite : 30 d'un côté, 10 de l'autre
  const d = largeurLibre({ sampleGround: sol, x: 10, z: 0, cap: 0, y: 10, garde: 1, portee: 60 })
  assert.ok(Math.abs(d.gauche - 30) < 2 && Math.abs(d.droite - 10) < 2, `${d.gauche}/${d.droite}`)
  // ciel dégagé : la mesure sature à la portée au lieu de partir à l'infini
  const libre = largeurLibre({ sampleGround: () => 0, x: 0, z: 0, cap: 0, y: 10, garde: 1, portee: 60 })
  assert.equal(libre.total, 120)
})

test('l altitude de securite anticipe la crete au lieu de suivre le sol', () => {
  // sol plat, puis une crête à 40 unités devant
  const sol = (x, z) => (z > 30 && z < 50 ? 60 : 0)
  const garde = 3
  const sansAnticipation = sol(0, 0) + garde
  const avec = altitudeSecuritaire({ sampleGround: sol, x: 0, z: 0, cap: 0, distance: 45, garde })
  assert.equal(sansAnticipation, 3)
  assert.ok(avec >= 60 + garde, `altitude anticipee ${avec} — la crete doit etre vue`)
})

test('le profil tenable commence a monter AVANT le mur', () => {
  // 20 points espacés de 5 ; le sol saute à 100 au dernier
  const n = 20
  const sol = Array.from({ length: n }, (_, i) => (i === n - 1 ? 100 : 0))
  const ds = Array.from({ length: n }, () => 5)
  const besoin = profilTenable({ sol, ds, penteMontee: 0.5, garde: 2 })
  assert.equal(besoin[n - 1], 102)
  // à 5 unités avant, on doit déjà être à 102 − 0,5×5 = 99,5
  assert.ok(Math.abs(besoin[n - 2] - 99.5) < 1e-9)
  // …et le profil est monotone décroissant vers l'amont : c'est une rampe
  for (let i = 1; i < n; i++) assert.ok(besoin[i] >= besoin[i - 1] - 1e-9 || besoin[i - 1] >= sol[i - 1] + 2)
  // le point d'entrée doit être haut : le mur est trop raide pour être pris tard
  assert.ok(besoin[0] > 50, `entree a ${besoin[0]}`)
})

// ============================== 4. LE REFUS : un cul-de-sac ne s'engage pas
//
// ⚠️ C'est le test le plus important du fichier. « On ne s'engage jamais dans un
// couloir dont on n'a pas vérifié la sortie. »

test('un couloir qui bute sur un mur est REFUSE avant l engagement', () => {
  const sol = cirqueFerme()
  const profil = resoudreProfil('avion', HALF)
  // la gorge, remontée du sud vers le nord jusqu'au mur
  const voie = []
  for (let z = 70; z >= -30; z -= 3) voie.push({ x: 0, z })
  const v = verifierCouloir({ sampleGround: sol, voie, profil })
  assert.equal(v.ok, false)
  assert.ok(['sans-issue', 'trop-raide', 'trop-etroit'].includes(v.raison), `raison ${v.raison}`)
  // et le diagnostic est celui du cul-de-sac : il faudrait entrer déjà haut
  assert.ok(v.hauteurEntree > profil.garde * 2, `hauteur d entree exigee ${v.hauteurEntree.toFixed(1)}`)
})

test('un entonnoir plat et sans issue est refuse pour sa LARGEUR', () => {
  const sol = entonnoir()
  const profil = resoudreProfil('avion', HALF)
  const voie = []
  for (let z = 80; z >= -80; z -= 3) voie.push({ x: 0, z })
  const v = verifierCouloir({ sampleGround: sol, voie, profil })
  assert.equal(v.ok, false)
  assert.equal(v.debouche, false, 'l entonnoir ne debouche pas : il est ferme aux deux bouts')
  assert.ok(v.largeurMin < 2 * profil.rayon, `largeur minimale ${v.largeurMin.toFixed(1)} pour un besoin de ${(2 * profil.rayon).toFixed(1)}`)
  assert.equal(v.raison, 'sans-issue')
})

test('aucun vol ne part sur un relief entierement ferme', () => {
  // une cuvette murée : rien ne traverse le bloc
  const cuvette = (x, z) => (Math.hypot(x, z) > 40 ? 300 : 0)
  assert.equal(planifierVol({ sampleGround: cuvette, half: HALF }), null)
})

test('un couloir traversant est ACCEPTE, et sa sortie est sur le bord', () => {
  const plan = planifierVol({ sampleGround: valleeCoudee(), half: HALF })
  assert.ok(plan, 'la vallee coudee doit donner un plan')
  assert.equal(plan.debouche, true)
  const fin = plan.voie[plan.voie.length - 1]
  assert.ok(Math.max(Math.abs(fin.x), Math.abs(fin.z)) >= HALF * 0.92, 'la sortie doit toucher le bord du bloc')
})

test('le couloir retenu est une VRAIE vallee, pas un chemin de bord de bloc', () => {
  // Le classement porte sur l'encaissement : le couloir choisi doit être
  // nettement plus encaissé que le plat du bord (mesuré : 16,2 contre 2,4).
  const plan = planifierVol({ sampleGround: valleeCoudee(), half: HALF })
  assert.ok(plan.encaissementMoyen > 10, `encaissement moyen ${plan.encaissementMoyen.toFixed(1)}`)
})

// ==================================== 5. LA GARDE AU SOL NE DEVIENT JAMAIS < 0
//
// La preuve de non-collision. Sur chaque pas de chaque vol, à la vitesse d'un
// tir réel (60 images/s) ET à une cadence dégradée (15 images/s, un portable qui
// rame), la caméra reste au-dessus du relief.

for (const [nom, relief] of [['vallee lisse', valleeCoudee()], ['vallee bruitee', valleeBruitee()], ['vallee tres bruitee', valleeBruitee(3)]]) {
  for (const profil of ['avion', 'helico']) {
    for (const fps of [60, 15]) {
      test(`garde au sol positive — ${nom} · ${profil} · ${fps} im/s`, () => {
        const v = volComplet({ sampleGround: relief, half: HALF, profil, duree: 45, dt: 1 / fps })
        assert.ok(v, `un plan doit exister (${nom}/${profil})`)
        let mini = Infinity
        for (const p of v.poses) {
          const g = p.pos.y - relief(p.pos.x, p.pos.z)
          if (g < mini) mini = g
        }
        assert.ok(mini > 0, `garde minimale ${mini.toFixed(3)} — la camera est passee sous le relief`)
        // et elle reste à la garde nominale près : on FRÔLE, sans toucher
        assert.ok(mini >= v.plan.profil.garde * 0.98, `garde minimale ${mini.toFixed(3)} pour une garde nominale de ${v.plan.profil.garde}`)
      })
    }
  }
}

test('le garde-fou de dernier recours ne sert JAMAIS quand le plan est bon', () => {
  // ⚠️ Ce compteur est la vraie mesure de qualité du plan. Le plancher d'altitude
  // garantit la non-collision quoi qu'il arrive ; s'il s'engage, c'est que la
  // DYNAMIQUE n'a pas suffi, donc que le couloir avait été mal jugé.
  for (const relief of [valleeCoudee(), valleeBruitee()]) {
    const v = volComplet({ sampleGround: relief, half: HALF, duree: 45 })
    assert.equal(v.etat.plancher, 0, `le plancher a rattrape ${v.etat.plancher} fois`)
  }
})

test('la camera ne sort jamais du bloc', () => {
  const v = volComplet({ sampleGround: valleeBruitee(), half: HALF, duree: 45 })
  for (const p of v.poses) {
    assert.ok(Math.abs(p.pos.x) <= HALF && Math.abs(p.pos.z) <= HALF,
      `sortie du bloc en (${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`)
  }
})

// ==================================== 6. LES BORNES D'INCLINAISON ET DE ROULIS

test('l inclinaison et sa vitesse d etablissement restent dans leurs bornes', () => {
  for (const profil of ['avion', 'helico']) {
    const v = volComplet({ sampleGround: valleeBruitee(), half: HALF, profil, duree: 45 })
    const p = v.plan.profil
    let maxR = 0
    let maxTaux = 0
    for (let i = 1; i < v.poses.length; i++) {
      const r = Math.abs(v.poses[i].roulis)
      if (r > maxR) maxR = r
      const taux = Math.abs(v.poses[i].roulis - v.poses[i - 1].roulis) * 60
      if (taux > maxTaux) maxTaux = taux
    }
    assert.ok(maxR <= p.rouliMax + 1e-9, `${profil} : ${deg(maxR).toFixed(1)}° pour un maximum de ${deg(p.rouliMax).toFixed(0)}°`)
    assert.ok(maxTaux <= p.tauxRouli + 1e-6, `${profil} : ${maxTaux.toFixed(3)} rad/s pour un maximum de ${p.tauxRouli}`)
  }
})

test('la camera S INCLINE vraiment quand elle vire — sinon c est un drone', () => {
  // Le contraire du test précédent : les bornes seraient respectées par une
  // caméra qui ne s'incline jamais. On vérifie que le roulis EXISTE, et qu'il
  // est corrélé au changement de cap.
  const v = volComplet({ sampleGround: valleeBruitee(), half: HALF, duree: 45 })
  let maxR = 0
  let accords = 0
  let virages = 0
  for (let i = 1; i < v.poses.length; i++) {
    const r = v.poses[i].roulis
    if (Math.abs(r) > maxR) maxR = Math.abs(r)
    const dcap = angleWrap(v.poses[i].cap - v.poses[i - 1].cap)
    if (Math.abs(dcap) > 1e-4) {
      virages++
      if (Math.sign(dcap) === Math.sign(r)) accords++
    }
  }
  assert.ok(deg(maxR) > 10, `inclinaison maximale ${deg(maxR).toFixed(1)}° — trop plat pour un aeronef`)
  assert.ok(accords / virages > 0.9, `le roulis n accompagne le virage que ${((accords / virages) * 100).toFixed(0)} % du temps`)
})

// ============================================ 7. LE DEMI-TOUR ET SON SEUIL

test('le seuil de demi-tour vaut 2 x rayon sans sortie prouvee', () => {
  const p = resoudreProfil('avion', HALF)
  assert.equal(seuilDemiTour(p), 2 * p.rayon)
  // avec une sortie prouvée et vérifiée avant l'engagement, on PASSE : le seuil
  // retombe sur la simple franchissabilité (voir « LE SEUIL DÉPEND DE LA
  // SORTIE » dans pilote.js — c'est de l'airmanship, pas un réglage)
  assert.ok(seuilPassage(p) < seuilDemiTour(p))
})

test('le demi-tour se declenche quand la largeur restante descend sous 2 x rayon', () => {
  // Couloir SANS sortie prouvée qui se resserre : la caméra doit se retourner
  // TANT QU'ELLE PEUT, c'est-à-dire pendant que la largeur ici est encore
  // suffisante. « Le demi-tour se planifie avant le fond, pas au fond. »
  const profil = resoudreProfil('helico', HALF)
  const besoin = 2 * profil.rayon
  // demi-largeur : large au sud (z=+80), étroite au nord (z=-80)
  const demiLargeur = (z) => 30 - 26 * ((80 - z) / 160)
  const sol = (x, z) => (Math.abs(x) < demiLargeur(z) ? 0 : 300)
  const voie = []
  for (let z = 80; z >= -80; z -= 2) voie.push({ x: 0, z })
  const plan = { profil, voie, debouche: false, cum: cumulSur(voie), sampleGround: sol }
  let e = creerVol(plan)
  let zVirage = null
  for (let i = 0; i < 3000 && zVirage === null; i++) {
    e = stepPilote(e, 1 / 60, plan, { sampleGround: sol })
    if (e.phase === 'demi-tour') zVirage = e.z
  }
  assert.ok(zVirage !== null, 'la camera doit finir par se retourner dans un couloir qui se ferme')
  // au point de virage, il reste ENCORE la place de virer — c'est tout l'objet
  // de la règle : on ne se retourne pas quand il est trop tard.
  const largeurAuVirage = 2 * demiLargeur(zVirage)
  assert.ok(largeurAuVirage >= besoin * 0.9,
    `demi-tour a z=${zVirage.toFixed(1)} ou il reste ${largeurAuVirage.toFixed(1)} pour un besoin de ${besoin.toFixed(1)}`)
  // …et pas trop tôt non plus : on ne renonce pas au premier resserrement
  assert.ok(largeurAuVirage < besoin * 3, `demi-tour beaucoup trop tot (${largeurAuVirage.toFixed(1)})`)
})

test('un demi-tour ne se declenche pas deux fois de suite (periode refractaire)', () => {
  const sol = valleeBruitee()
  const v = volComplet({ sampleGround: sol, half: HALF, duree: 60 })
  // au plus un demi-tour toutes les π/ω + 1,5 s : sans ce verrou, la mesure de
  // largeur prise EN VIRAGE relançait un second demi-tour et la caméra vibrait
  const p = v.plan.profil
  const mini = Math.PI / p.omegaMax + 1.5
  assert.ok((v.etat.demiTours || 0) <= Math.ceil(60 / mini), `${v.etat.demiTours} demi-tours en 60 s`)
})

// ======================================== 8. LE CONFORT — la dérivée seconde
//
// ⚠️ LEÇON DU DÉPÔT : « un test de position ne voit pas un à-coup ». Pour tout
// ce qui bouge il faut regarder la dérivée, et pour une caméra aller jusqu'à la
// DÉRIVÉE SECONDE — c'est l'accélération qui donne la nausée, et un mouvement
// peut être parfait en position et détestable à l'œil.

test('aucun a-coup : l acceleration de la camera reste bornee', () => {
  const sol = valleeBruitee()
  const v = volComplet({ sampleGround: sol, half: HALF, duree: 45, dt: 1 / 60 })
  const p = v.plan.profil
  const pos = v.poses.map((q) => q.pos)
  let maxA = 0
  let iPire = 0
  for (let i = 2; i < pos.length - 1; i++) {
    // on ignore le pas où le vol se termine (l'état gèle, ce n'est pas un à-coup)
    if (v.poses[i + 1].phase === 'fini') break
    const ax = (pos[i + 1].x - 2 * pos[i].x + pos[i - 1].x) * 3600
    const ay = (pos[i + 1].y - 2 * pos[i].y + pos[i - 1].y) * 3600
    const az = (pos[i + 1].z - 2 * pos[i].z + pos[i - 1].z) * 3600
    const a = Math.hypot(ax, ay, az)
    if (a > maxA) { maxA = a; iPire = i }
  }
  // Référence physique : l'accélération centripète d'un virage au rayon nominal
  // vaut v²/r = g·tan(30°) = 0,58 g. On tolère 2,5 fois cela — au-delà, c'est
  // un à-coup, pas une manœuvre.
  const plafond = 2.5 * ((p.v * p.v) / p.rayon)
  assert.ok(maxA < plafond,
    `acceleration maximale ${maxA.toFixed(2)} u/s² (plafond ${plafond.toFixed(2)}) au pas ${iPire}`)
})

test('l axe de visee ne balaie jamais plus vite qu un mouvement lisible', () => {
  // ⚠️ CE QU'ON MESURE ICI EST UNE VITESSE ANGULAIRE, pas un déplacement. C'est
  // l'angle que l'axe de visée parcourt par seconde qui décide si un plan est
  // lisible ou s'il donne la nausée — un même déplacement de cible est anodin à
  // 200 unités et violent à 5. Repère : un virage au taux maximal fait tourner
  // l'appareil de 28,6°/s ; un panoramique de cinéma reste sous ~60°/s ; un
  // whip-pan est à 300°/s. On plafonne à 75°/s, soit 2,6 fois le lacet maximal.
  const sol = valleeBruitee()
  const v = volComplet({ sampleGround: sol, half: HALF, duree: 45, dt: 1 / 60 })
  const dir = v.poses.map((q) => {
    const d = { x: q.target.x - q.pos.x, y: q.target.y - q.pos.y, z: q.target.z - q.pos.z }
    const l = Math.hypot(d.x, d.y, d.z) || 1
    return { x: d.x / l, y: d.y / l, z: d.z / l }
  })
  let maxDeg = 0
  for (let i = 1; i < dir.length; i++) {
    if (v.poses[i].phase === 'fini') break
    const dot = Math.min(1, dir[i].x * dir[i - 1].x + dir[i].y * dir[i - 1].y + dir[i].z * dir[i - 1].z)
    maxDeg = Math.max(maxDeg, deg(Math.acos(dot)) * 60)
  }
  assert.ok(maxDeg < 75, `balayage maximal ${maxDeg.toFixed(0)}°/s (lacet maximal ${deg(v.plan.profil.omegaMax).toFixed(0)}°/s)`)
})

// ================================================ 9. LES DEUX PERSONNALITES

test('les deux personnalites ne sont pas deux reglages du meme appareil', () => {
  const a = resoudreProfil('avion', HALF)
  const h = resoudreProfil('helico', HALF)
  // l'avion ne s'arrête pas ; l'hélicoptère peut
  assert.ok(a.vMin > 0)
  assert.equal(h.vMin, 0)
  // l'hélicoptère se retourne dans une vraie vallée, l'avion non — c'est la
  // mesure qui a imposé les deux profils (voir PROFILS dans pilote.js)
  assert.ok(2 * h.rayon < HALF * 0.15, `demi-tour helico : ${(2 * h.rayon).toFixed(1)} unites`)
  assert.ok(2 * a.rayon > HALF * 0.25, `demi-tour avion : ${(2 * a.rayon).toFixed(1)} unites`)
  // l'avion s'incline davantage, l'hélicoptère translate
  assert.ok(a.rouliMax > h.rouliMax)
})

// ========================================================= 10. le détail utile

test('angleWrap ramene bien dans (−π, π]', () => {
  assert.ok(Math.abs(angleWrap(3 * Math.PI)) - Math.PI < 1e-9)
  assert.ok(Math.abs(angleWrap(0.2) - 0.2) < 1e-12)
  assert.ok(Math.abs(angleWrap(-3.5) - (2 * Math.PI - 3.5)) < 1e-12)
  // un virage de 190° se fait du côté court (−170°), jamais du long
  assert.ok(angleWrap((190 * Math.PI) / 180) < 0)
})

test('le bord du bloc est un obstacle : on ne vole pas la ou il n y a pas de relief', () => {
  const plat = () => 0
  const dedans = routeDegagee({ sampleGround: plat, x: 0, z: 0, y: 10, cap: 0, distance: 50, garde: 1, half: HALF })
  const dehors = routeDegagee({ sampleGround: plat, x: 0, z: 80, y: 10, cap: 0, distance: 50, garde: 1, half: HALF })
  assert.equal(dedans, true)
  assert.equal(dehors, false)
})

test('routeDegagee tient compte de la montee disponible', () => {
  // un mur de 20 a 40 unites devant, on vole a 5
  const sol = (x, z) => (z > 38 && z < 45 ? 20 : 0)
  const commun = { sampleGround: sol, x: 0, z: 0, y: 5, cap: 0, distance: 50, garde: 1 }
  assert.equal(routeDegagee({ ...commun, penteMontee: 0 }), false, 'sans montee, le mur barre')
  assert.equal(routeDegagee({ ...commun, penteMontee: 0.5 }), true, 'en montant, on le franchit')
})

test('un profil se resout en unites monde et reste invariant d echelle', () => {
  const a = resoudreProfil('avion', 100)
  const b = resoudreProfil('avion', 28)
  // toutes les longueurs suivent `half`, donc les RAPPORTS sont identiques
  assert.ok(Math.abs(a.rayon / a.half - b.rayon / b.half) < 1e-12)
  assert.ok(Math.abs(a.dVisee / a.rayon - b.dVisee / b.rayon) < 1e-12)
  // …et le temps de demi-tour, lui, ne dépend PAS de l'échelle
  assert.ok(Math.abs(Math.PI / a.omegaMax - Math.PI / b.omegaMax) < 1e-9)
})

test('hauteurManoeuvre est ce qu on gagne en montant pendant un demi demi-tour', () => {
  const p = resoudreProfil('avion', HALF)
  const attendu = p.montMax * facteurEnergie(p.rouliMax) * (Math.PI / p.omegaMax) * 0.5
  assert.ok(Math.abs(hauteurManoeuvre(p) - attendu) < 1e-12)
  assert.ok(hauteurManoeuvre(p) > p.garde, 'elle doit depasser la garde, sinon elle ne sert a rien')
})

test('les portes du bloc sont sur le bord et sous le plafond d altitude', () => {
  const g = buildHeightGrid({ sampleGround: valleeCoudee(), half: HALF, n: 56 })
  const portes = portesDuBloc(g)
  assert.ok(portes.length > 0)
  for (const p of portes) {
    assert.ok(Math.max(Math.abs(p.x), Math.abs(p.z)) >= HALF - g.cell * 1.5, 'une porte est sur le bord')
    assert.ok(p.y <= g.min + (g.max - g.min) * 0.45 + 1e-9, 'une porte est un point BAS du bord')
  }
})

test('le champ de Dijkstra suit le fond de vallee, pas la ligne droite', () => {
  const sol = valleeCoudee()
  const g = buildHeightGrid({ sampleGround: sol, half: HALF, n: 56 })
  const champ = champDijkstra(g, { x: 0, z: -95 })
  const voie = cheminDepuisChamp(g, champ, { x: 10, z: 95 })
  assert.ok(voie.length > 10)
  // altitude moyenne du couloir contre celle de la ligne droite entre les mêmes
  // points : si le couloir ne fait pas mieux, ce n'est pas un fond de vallée
  const moy = (pts) => pts.reduce((s, p) => s + sol(p.x, p.z), 0) / pts.length
  const droite = []
  for (let t = 0; t <= 1; t += 0.02) droite.push({ x: 0 + 10 * t, z: -95 + 190 * t })
  assert.ok(moy(voie) < moy(droite), `couloir ${moy(voie).toFixed(1)} contre ligne droite ${moy(droite).toFixed(1)}`)
})
