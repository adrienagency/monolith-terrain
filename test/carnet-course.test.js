import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  penteLocale,
  classePente,
  indexPourKm,
  pointsDePassage,
  pictosDuCarnet,
  deniveleRestant,
  fenetreDePentes,
  resumeParcours,
  carnetALaLigne,
} from '../src/carnet-course.js'

const cumKm = [0, 1, 2, 3, 4, 5]
const eles = [1000, 1050, 1150, 1140, 1080, 1080] // +50, +100, -10, -60, plat

const waypoints = [
  { km: 1, name: 'Ravito 1', pictos: ['ravito', 'eau'] },
  { km: 4, name: 'Col des Montets', pictos: ['col', 'vue'] },
]

test('penteLocale reproduit le calcul de GpxLayer.setHover', () => {
  // au point 2 (km 2) : entre eles[1]=1050 et eles[3]=1140, dKm = 3-1 = 2
  assert.equal(Math.round(penteLocale(cumKm, eles, 2) * 10) / 10, 4.5)
  assert.equal(penteLocale([], [], 0), 0)
  assert.equal(penteLocale(null, null, 0), 0)
})

test('classePente range en trois paliers, en valeur absolue', () => {
  assert.equal(classePente(2), 'douce')
  assert.equal(classePente(-2), 'douce')
  assert.equal(classePente(7), 'soutenue')
  assert.equal(classePente(15), 'raide')
  assert.equal(classePente(-15), 'raide')
})

test('classePente ne prend PAS une altitude manquante pour un mur', () => {
  // NaN (trou de tuile DEM, bord d'emprise) tombait dans le dernier return :
  // « raide », donc un +0,0 % teinté en rouge vif et une bande toute rouge.
  assert.equal(classePente(NaN), 'inconnue')
  assert.equal(classePente(undefined), 'inconnue')
  assert.equal(classePente(Infinity), 'inconnue')
})

test('indexPourKm trouve le même index qu’un findIndex, en dichotomie', () => {
  const naif = (km) => {
    const i = cumKm.findIndex((v) => v >= km)
    return i < 0 ? cumKm.length - 1 : i
  }
  for (const km of [-3, 0, 0.4, 1, 1.0001, 2.5, 4.999, 5, 12]) {
    assert.equal(indexPourKm(cumKm, km), naif(km), `km ${km}`)
  }
  assert.equal(indexPourKm([], 3), 0)
  assert.equal(indexPourKm(null, 3), 0)
})

test('pointsDePassage trouve le dernier franchi et le prochain', () => {
  assert.deepEqual(pointsDePassage(waypoints, 0.5), { precedent: null, suivant: waypoints[0], kmAvantSuivant: 0.5 })
  assert.deepEqual(pointsDePassage(waypoints, 1), { precedent: waypoints[0], suivant: waypoints[1], kmAvantSuivant: 3 })
  assert.deepEqual(pointsDePassage(waypoints, 4), { precedent: waypoints[1], suivant: null, kmAvantSuivant: null })
  assert.deepEqual(pointsDePassage([], 2), { precedent: null, suivant: null, kmAvantSuivant: null })
})

test('pictosDuCarnet annonce le prochain point, et ne le cache jamais', () => {
  // à km=1.5, le prochain point est le Col des Montets (km 4) : ses pictos
  // sont là quelle que soit la distance — savoir qu'il y a de l'eau dans
  // 2,5 km est ce qui décide combien on boit maintenant.
  // ⚠️ `km` VAUT null POUR LES PICTOS DU POINT AFFICHÉ, et n'est renseigné que
  // pour un picto EMPRUNTÉ à un point plus loin (voir le test suivant) : sans
  // cette distinction, un picto emprunté se ferait passer pour un service du
  // point dont le nom est écrit juste à côté.
  assert.deepEqual(pictosDuCarnet(waypoints, 1.5), [
    { picto: 'col', loin: false, km: null },
    { picto: 'vue', loin: false, km: null },
  ])
  // les pictos du point DÉJÀ FRANCHI ne sont plus construits : personne ne
  // les affichait, ils étaient filtrés au rendu, soixante fois par seconde
  assert.ok(pictosDuCarnet(waypoints, 1.5).every((p) => p.picto !== 'ravito'))
  // au-delà du seuil, l'annonce est GRADUÉE (le rendu l'atténue), pas coupée
  assert.deepEqual(pictosDuCarnet(waypoints, 0.5), [
    { picto: 'ravito', loin: false, km: null },
    { picto: 'eau', loin: false, km: null },
  ])
  assert.deepEqual(pictosDuCarnet([{ km: 40, name: 'Loin', pictos: ['eau'] }], 0), [
    { picto: 'eau', loin: true, km: null },
  ])
  // dernier point franchi : plus rien à annoncer
  assert.deepEqual(pictosDuCarnet(waypoints, 4.5), [])
})

test('pictosDuCarnet va chercher l’eau même si elle n’est pas au point suivant', () => {
  // « le prochain point qui a X », pas « le X du prochain point ». Le
  // raisonnement du dépôt — annoncer l'eau de loin, parce que c'est ce qui
  // décide combien on boit MAINTENANT — n'était servi qu'un point à la fois :
  // si le point suivant est un col et le ravito deux points plus loin, le
  // panneau n'annonçait l'eau nulle part, alors même que le commentaire de la
  // fonction défendait exactement l'inverse.
  const wp = [
    { km: 1, name: 'Col', pictos: ['col'] },
    { km: 2, name: 'Belvédère', pictos: ['vue'] },
    { km: 4, name: 'Base de vie', pictos: ['ravito', 'eau'] },
  ]
  assert.deepEqual(pictosDuCarnet(wp, 0.5), [
    { picto: 'col', loin: false, km: null },
    // emprunté : `loin` par construction (ce n'est pas le point suivant) et
    // ANCRÉ à son kilomètre, sinon il mentirait sur le point affiché
    { picto: 'eau', loin: true, km: 4 },
  ])
  // le point suivant porte déjà de quoi boire → rien à emprunter
  assert.deepEqual(pictosDuCarnet(wp, 3), [
    { picto: 'ravito', loin: false, km: null },
    { picto: 'eau', loin: false, km: null },
  ])
})

test('deniveleRestant compte ce qui RESTE à monter, pas ce qui est derrière', () => {
  // au départ (index 0) : eles 1000→1150 puis redescente. D+ total = 150.
  const depart = deniveleRestant(cumKm, eles, 0, waypoints)
  assert.equal(depart.dplusRestant, 150)
  // à l'index 2 (sommet, km 2) il ne reste plus rien à monter
  assert.equal(deniveleRestant(cumKm, eles, 2, waypoints).dplusRestant, 0)
  // et le D+ jusqu'au prochain point SEULEMENT (Ravito 1, km 1) : 1000→1050
  assert.equal(depart.dplusProchain, 50)
  // plus de point suivant → plus de D+ intermédiaire à annoncer
  assert.equal(deniveleRestant(cumKm, eles, 4, waypoints).dplusProchain, null)
  assert.deepEqual(deniveleRestant([], [], 0, []), { dplusRestant: 0, dplusProchain: null, dMoinsRestant: 0 })
})

test('deniveleRestant expose le D− RESTANT — une descente cumulée, pas un sommet', () => {
  // ⚠️ CE N'EST PAS UNE ALTITUDE. Le carnet affichait le point culminant
  // restant sous un libellé qui promet un dénivelé négatif : « D− restant »
  // doit être la descente cumulée entre la position courante et l'arrivée, à
  // la MÊME hystérésis que le D+ (ascentStats, un seul balayage pour les
  // deux), pas un maximum d'altitude qui ne redescend jamais.
  // au départ (index 0) : eles 1000→1050→1150 (monte) →1140→1080→1080
  // (descend), hystérésis 8 : dminus = 10 + 60 = 70
  assert.equal(deniveleRestant(cumKm, eles, 0, []).dMoinsRestant, 70)
  // au sommet (index 2, km 2) : ce qui reste EST la redescente — le chiffre
  // ne bouge pas, preuve que ce n'est pas une altitude qui varie avec i
  assert.equal(deniveleRestant(cumKm, eles, 2, []).dMoinsRestant, 70)
  // juste avant l'arrivée plate (index 4) : plus rien à descendre
  assert.equal(deniveleRestant(cumKm, eles, 4, []).dMoinsRestant, 0)
  // exclusif avec le bloc « prochain point », même contrat d'affichage que
  // l'ancien sommetRestant() : dès qu'un point de passage reste devant, la
  // valeur n'est pas exposée (elle ne sert que quand la colonne bascule sur
  // Altitude/D− faute de prochain point à montrer)
  assert.equal(deniveleRestant(cumKm, eles, 0, waypoints).dMoinsRestant, null)
})

test('deniveleRestant somme TOUTES les descentes d’un profil en dents de scie, pas la première', () => {
  // ⚠️ POINT DE VÉRIFICATION EXPLICITE DE LA CONSIGNE : ascentStats() ne
  // s'arrête pas au premier changement de pente, mais ça se lit dans le code,
  // ça ne se prouve pas — d'où ce test. Profil descente→montée→descente→
  // montée→descente (hystérésis 8, toutes les variations la dépassent) :
  // une implémentation qui s'arrêterait au premier changement de sens ne
  // rendrait QUE le premier segment (100 m), pas le cumul des trois.
  const dents = [0, 1, 2, 3, 4, 5]
  const profil = [1000, 900, 950, 850, 900, 800] // -100, +50, -100, +50, -100
  const r = deniveleRestant(dents, profil, 0, [])
  assert.equal(r.dMoinsRestant, 300, 'les trois descentes doivent s’additionner : 100+100+100')
  assert.equal(r.dplusRestant, 100, 'les deux remontées doivent s’additionner : 50+50')
})

test('fenetreDePentes omet les segments hors piste plutôt que de les inventer', () => {
  // piste 0..5, fenêtre CENTRÉE de 2 km sur km=0.2 -> [-0.8, 1.2] : avant 0 coupé
  const f = fenetreDePentes(cumKm, eles, 0.2, { porteeKm: 2, segments: 5, versAvant: false })
  assert.ok(f.length > 0 && f.length < 5, 'les segments avant le départ doivent sauter')
  for (const seg of f) assert.ok(['douce', 'soutenue', 'raide'].includes(seg.classe))
  assert.deepEqual(fenetreDePentes([], [], 0), [])
})

test('fenetreDePentes regarde DEVANT par défaut, pas autour', () => {
  // au départ (km 0), une fenêtre vers l'avant est entièrement sur la piste :
  // aucun segment ne doit être coupé, contrairement à une fenêtre centrée
  const avant = fenetreDePentes(cumKm, eles, 0, { porteeKm: 2, segments: 5 })
  assert.equal(avant.length, 5)
  const centre = fenetreDePentes(cumKm, eles, 0, { porteeKm: 2, segments: 5, versAvant: false })
  assert.ok(centre.length < avant.length, 'la fenêtre centrée déborde avant le départ')
})

test('fenetreDePentes en fin de piste ne fabrique pas de terrain après l’arrivée', () => {
  const f = fenetreDePentes(cumKm, eles, 5, { porteeKm: 2, segments: 5 })
  assert.ok(f.length <= 1, 'à l’arrivée, il n’y a plus rien à annoncer')
})

test('resumeParcours rend les chiffres de la course entière', () => {
  const r = resumeParcours(cumKm, eles)
  assert.equal(r.km, 5)
  assert.equal(r.altMin, 1000)
  assert.equal(r.altMax, 1150)
  assert.ok(r.dplus > 0)
  assert.equal(resumeParcours([], []), null)
  assert.equal(resumeParcours(null, null), null)
})

test('resumeParcours tient une trace longue sans casser la pile', () => {
  // Math.min(...eles) explose bien avant ; la boucle, non
  const n = 200000
  const longCum = new Array(n)
  const longEle = new Array(n)
  for (let i = 0; i < n; i++) { longCum[i] = i * 0.01; longEle[i] = 500 + (i % 700) }
  const r = resumeParcours(longCum, longEle)
  assert.equal(r.altMin, 500)
  assert.equal(r.altMax, 1199)
})

test('carnetALaLigne assemble tout, et rend null sans données', () => {
  const c = carnetALaLigne({ cumKm, eles, waypoints }, 3)
  assert.equal(c.km, 3)
  assert.equal(c.alt, 1140)
  assert.equal(c.pointActuel, 'Ravito 1')
  assert.equal(c.pointSuivant, 'Col des Montets')
  assert.equal(c.kmAvantSuivant, 1)
  // eles[3..5] = 1140, 1080, 1080 : plus rien à monter d'ici l'arrivée
  assert.equal(c.dplusRestant, 0)
  assert.equal(carnetALaLigne({ cumKm: [], eles: [] }, 0), null)
})

test('carnetALaLigne distingue « pas de points de passage » de « tous franchis »', () => {
  // le rendu confondait les deux (pointSuivant null dans les deux cas) et
  // annonçait « Prochain / Arrivée » du km 0 au km 42 sur un GPX brut, à côté
  // d'un « 42,0 km restants » qui le contredisait
  const sans = carnetALaLigne({ cumKm, eles, waypoints: [] }, 0)
  assert.equal(sans.aDesPoints, false)
  assert.equal(sans.pointSuivant, null)
  const fini = carnetALaLigne({ cumKm, eles, waypoints }, 5)
  assert.equal(fini.aDesPoints, true)
  assert.equal(fini.pointSuivant, null)
})

test('carnetALaLigne transporte la BARRIÈRE HORAIRE du prochain point', () => {
  // seule donnée temporelle de tout le modèle : le dépôt n'a aucun modèle
  // d'allure, une ETA serait inventée — le cutoff, lui, est saisi et connu
  const avecCutoff = [{ km: 4, name: 'Col', pictos: [], cutoff: '12h30', alt: 1840 }]
  const c = carnetALaLigne({ cumKm, eles, waypoints: avecCutoff }, 1)
  assert.equal(c.cutoffSuivant, '12h30')
  assert.equal(c.altSuivant, 1840)
  // pas de barrière saisie → null, jamais une chaîne vide qui s'afficherait
  assert.equal(carnetALaLigne({ cumKm, eles, waypoints }, 1).cutoffSuivant, null)
})

test('carnetALaLigne rend la distance RESTANTE, jamais négative', () => {
  assert.equal(carnetALaLigne({ cumKm, eles, waypoints }, 0).restant, 5)
  assert.equal(carnetALaLigne({ cumKm, eles, waypoints }, 3).restant, 2)
  assert.equal(carnetALaLigne({ cumKm, eles, waypoints }, 5).restant, 0)
  assert.equal(carnetALaLigne({ cumKm, eles, waypoints }, 99).restant, 0)
})

test('carnetALaLigne clampe un index hors bornes plutôt que de planter', () => {
  const c1 = carnetALaLigne({ cumKm, eles, waypoints }, -5)
  assert.equal(c1.km, 0)
  const c2 = carnetALaLigne({ cumKm, eles, waypoints }, 99)
  assert.equal(c2.km, 5)
})
