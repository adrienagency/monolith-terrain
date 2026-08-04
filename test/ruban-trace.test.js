import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  reechantillonne,
  perpendiculaires,
  relevement,
  penteLocale,
  moyenneGlissante,
  dilatation,
  lissePolyligne,
  plancherDuRuban,
  construitRuban,
  fractionDeTraine,
  retraitDuNez,
  teintesDepuis,
  profilDeTeintes,
  PROFIL_RAILS,
  TEINTES_COURSE,
  COEUR_VERMILLON,
} from '../src/ruban-trace.js'

const P = (x, y, z) => ({ x, y, z })
const dist2D = (a, b) => Math.hypot(b.x - a.x, b.z - a.z)
const nr = PROFIL_RAILS.length

test('reechantillonne pose un pas CONSTANT, c’est ce qui empêche les longues cordes', () => {
  // un tracé volontairement irrégulier : un pas de 10, puis un pas de 0,5
  const brut = [P(0, 0, 0), P(10, 0, 0), P(10.5, 0, 0)]
  const out = reechantillonne(brut, 1)
  for (let i = 1; i < out.length; i++) {
    const d = dist2D(out[i - 1], out[i])
    assert.ok(d <= 1.001, `pas de ${d} > 1 à l’index ${i}`)
  }
  assert.ok(out.length > 10, 'la longue corde doit avoir été subdivisée')
})

test('reechantillonne garde le point d’ARRIVÉE, il ne se perd pas dans un reste de pas', () => {
  const out = reechantillonne([P(0, 0, 0), P(2.5, 0, 0)], 1)
  const dernier = out[out.length - 1]
  assert.ok(Math.abs(dernier.x - 2.5) < 1e-9, `arrivée à ${dernier.x} au lieu de 2,5`)
})

test('reechantillonne interpole aussi l’altitude', () => {
  const out = reechantillonne([P(0, 0, 0), P(2, 100, 0)], 1)
  const milieu = out.find((p) => Math.abs(p.x - 1) < 1e-9)
  assert.ok(milieu, 'point intermédiaire attendu à x=1')
  assert.ok(Math.abs(milieu.y - 50) < 1e-6, `y=${milieu.y} au lieu de 50`)
})

test('reechantillonne survit aux cas dégénérés', () => {
  assert.deepEqual(reechantillonne([], 1), [])
  assert.equal(reechantillonne([P(0, 0, 0)], 1).length, 1)
  // points identiques : pas de division par zéro, pas de boucle infinie
  assert.ok(reechantillonne([P(0, 0, 0), P(0, 0, 0), P(1, 0, 0)], 0.5).length >= 2)
})

test('perpendiculaires sont HORIZONTALES, unitaires et à 90° du tracé', () => {
  const pts = [P(0, 0, 0), P(1, 5, 0), P(2, 9, 0)] // le y monte fort
  const n = perpendiculaires(pts)
  for (const v of n) {
    assert.ok(Math.abs(Math.hypot(v.x, v.z) - 1) < 1e-9, 'doit être unitaire')
    assert.equal(v.y, undefined, 'aucune composante verticale : le ruban reste à plat vu du ciel')
  }
  // tracé selon +x ⇒ perpendiculaire selon ±z, quelle que soit la montée
  assert.ok(Math.abs(n[1].x) < 1e-9 && Math.abs(Math.abs(n[1].z) - 1) < 1e-9)
})

test('relevement croît avec la pente et se plafonne', () => {
  assert.equal(relevement(0, { garde: 0.05, parPente: 0.35, plafond: 0.5 }), 0.05)
  assert.ok(relevement(0.5, { garde: 0.05, parPente: 0.35, plafond: 0.5 }) > 0.05)
  // pente absurde : on ne décolle pas indéfiniment
  assert.equal(relevement(99, { garde: 0.05, parPente: 0.35, plafond: 0.5 }), 0.55)
  // une descente relève autant qu’une montée (valeur absolue)
  assert.equal(relevement(-0.4, {}), relevement(0.4, {}))
  assert.ok(Number.isFinite(relevement(NaN, {})))
})

test('penteLocale rend bien dy/dxz', () => {
  const pts = [P(0, 0, 0), P(1, 1, 0), P(2, 2, 0)] // 45°
  assert.ok(Math.abs(penteLocale(pts, 1) - 1) < 1e-9)
  assert.equal(penteLocale([P(0, 0, 0)], 0), 0)
})

// ── lissage ────────────────────────────────────────────────────────────────

test('moyenneGlissante écrête le bruit et laisse les bords tranquilles', () => {
  const bruite = [0, 10, 0, 10, 0, 10, 0]
  const out = moyenneGlissante(bruite, 2)
  const amplitude = Math.max(...out) - Math.min(...out)
  assert.ok(amplitude < 10, `amplitude ${amplitude} : le bruit n’a pas été écrêté`)
  assert.equal(out.length, bruite.length)
  // demi-fenêtre nulle ou absurde : on rend l’entrée telle quelle
  assert.deepEqual(moyenneGlissante(bruite, 0), bruite)
})

test('dilatation NE DESCEND JAMAIS sous l’entrée — c’est tout son intérêt', () => {
  const v = [0, 5, 0, 0, 3, 0]
  const out = dilatation(v, 1)
  for (let i = 0; i < v.length; i++) assert.ok(out[i] >= v[i], `dilatation ${out[i]} < ${v[i]}`)
  assert.equal(out[0], 5, 'le voisin haut doit remonter le premier terme')
})

test('dilater PUIS moyenner reste au-dessus du profil, moyenner seul coupe les sommets', () => {
  // un pic isolé : c’est exactement la crête qui embroche un ruban trop lissé
  const profil = [0, 0, 0, 0, 10, 0, 0, 0, 0]
  const moyenneSeule = moyenneGlissante(profil, 2)
  assert.ok(moyenneSeule[4] < 10, 'une moyenne simple coupe le sommet (le défaut qu’on évite)')
  const dilatePuisMoyenne = moyenneGlissante(dilatation(profil, 2), 2)
  assert.ok(dilatePuisMoyenne[4] >= 10, `sommet à ${dilatePuisMoyenne[4]}, il devait rester ≥ 10`)
})

test('lissePolyligne adoucit le chemin mais ÉPINGLE départ et arrivée', () => {
  const brut = []
  for (let i = 0; i <= 20; i++) brut.push(P(i, 0, i % 2 ? 1 : -1)) // zigzag serré
  const out = lissePolyligne(brut, 3)
  assert.deepEqual({ x: out[0].x, z: out[0].z }, { x: brut[0].x, z: brut[0].z })
  const d = out[out.length - 1]
  assert.deepEqual({ x: d.x, z: d.z }, { x: brut[brut.length - 1].x, z: brut[brut.length - 1].z })
  // le zigzag intérieur doit s’être calmé
  const amplitude = Math.max(...out.slice(4, 16).map((p) => Math.abs(p.z)))
  assert.ok(amplitude < 0.9, `amplitude ${amplitude} : le zigzag n’a pas été lissé`)
})

// ── géométrie ──────────────────────────────────────────────────────────────

test('construitRuban : un sommet par rail et par point, 2 triangles par maille', () => {
  const r = construitRuban([P(0, 0, 0), P(4, 0, 0)], { sol: () => 0, pas: 1, demiLargeur: 0.5 })
  assert.equal(r.positions.length, r.nbPoints * nr * 3)
  assert.equal(r.couleurs.length, r.nbPoints * nr * 3)
  assert.equal(r.distances.length, r.nbPoints * nr)
  // (rails-1) quads × 2 triangles × 3 sommets, par intervalle
  assert.equal(r.indices.length, (r.nbPoints - 1) * (nr - 1) * 6)
})

test('LA SECTION EST HORIZONTALE : tous les rails d’un point partagent une altitude', () => {
  // un sol en forte pente transversale — c’est le cas qui, dans la version
  // précédente, faisait rouler le ruban sur le côté et le collait au relief
  const sol = (x, z) => z * 10
  const r = construitRuban([P(0, 0, 0), P(6, 0, 0)], { sol, pas: 0.5, demiLargeur: 1, lissageChemin: 0 })
  for (let p = 0; p < r.nbPoints; p++) {
    const ys = []
    for (let rail = 0; rail < nr; rail++) ys.push(r.positions[(p * nr + rail) * 3 + 1])
    const ecart = Math.max(...ys) - Math.min(...ys)
    assert.ok(ecart < 1e-9, `section ${p} inclinée de ${ecart} : elle doit être perpendiculaire à la gravité`)
  }
})

test('le ruban se cale sur le point le PLUS HAUT sous sa largeur, pas sur son centre', () => {
  const sol = (x, z) => z * 10 // le bord à z=+1 est 10 plus haut que le centre
  const perp = [{ x: 0, z: 1 }, { x: 0, z: 1 }]
  const pts = [P(0, 0, 0), P(1, 0, 0)]
  const pl = plancherDuRuban(pts, perp, { sol, demiLargeur: 1, garde: 0, parPente: 0 })
  assert.ok(Math.abs(pl[0] - 10) < 1e-9, `plancher à ${pl[0]}, le maximum sous la largeur vaut 10`)
})

test('LE RUBAN SURVOLE : la garde est respectée partout, jamais collé au sol', () => {
  const sol = (x, z) => Math.sin(x * 1.7) * 2 + Math.cos(z * 2.3) * 1.5
  const brut = []
  for (let i = 0; i <= 10; i++) brut.push(P(i * 3, 0, Math.sin(i) * 2))
  const garde = 0.4
  const r = construitRuban(brut, { sol, pas: 0.2, demiLargeur: 0.3, garde, parPente: 0.35 })
  let mini = Infinity
  for (let i = 0; i < r.positions.length; i += 3) {
    const x = r.positions[i], y = r.positions[i + 1], z = r.positions[i + 2]
    mini = Math.min(mini, y - sol(x, z))
  }
  assert.ok(mini > 0, `${mini} : un sommet est sous la surface`)
  assert.ok(mini >= garde - 1e-9, `survol minimal de ${mini}, il devait valoir au moins ${garde}`)
})

test('construitRuban : distances vont de 0 à 1 et ne reculent jamais', () => {
  const r = construitRuban([P(0, 0, 0), P(3, 0, 0), P(3, 0, 4)], { sol: () => 0, pas: 0.5 })
  assert.equal(r.distances[0], 0)
  assert.ok(Math.abs(r.distances[r.distances.length - 1] - 1) < 1e-9)
  for (let i = 1; i < r.distances.length; i++) {
    assert.ok(r.distances[i] >= r.distances[i - 1] - 1e-12, 'la distance doit être croissante')
  }
})

test('construitRuban : cas dégénérés, jamais de NaN ni de plantage', () => {
  assert.equal(construitRuban([], { sol: () => 0 }).positions.length, 0)
  assert.equal(construitRuban([P(0, 0, 0)], { sol: () => 0 }).positions.length, 0)
  // un sol qui rend n’importe quoi ne doit pas empoisonner la géométrie
  const r = construitRuban([P(0, 0, 0), P(2, 0, 0)], { sol: () => NaN, pas: 1 })
  for (const v of r.positions) assert.ok(Number.isFinite(v), 'position non finie')
  // sans échantillonneur de sol du tout
  const r2 = construitRuban([P(0, 1, 0), P(2, 1, 0)], { pas: 1 })
  for (const v of r2.positions) assert.ok(Number.isFinite(v))
})

// ── sillage de tête ────────────────────────────────────────────────────────

test('LE SILLAGE PARTAGE LES ALTITUDES DU RUBAN, il ne recalcule pas les siennes', () => {
  // sur un flanc, un halo cinq fois plus large qui prendrait son propre
  // plancher volerait bien plus haut que le tracé qu'il enveloppe
  const sol = (x, z) => z * 6 + x
  const pts = [P(0, 0, 0), P(4, 0, 0), P(8, 0, 2)]
  const ruban = construitRuban(pts, { sol, pas: 0.4, demiLargeur: 0.1, garde: 0.1 })
  const halo = construitRuban(pts, { sol, pas: 0.4, demiLargeur: 0.55, altitudesImposees: ruban.altitudes })
  assert.equal(halo.nbPoints, ruban.nbPoints, 'même axe, donc même nombre de sections')
  for (let i = 0; i < ruban.nbPoints; i++) {
    const yR = ruban.positions[i * nr * 3 + 1]
    const yH = halo.positions[i * nr * 3 + 1]
    assert.ok(Math.abs(yR - yH) < 1e-9, `section ${i} : le halo est à ${yH}, le ruban à ${yR}`)
  }
  // et il est bien PLUS LARGE, sinon il n'envelopperait rien
  const largeur = (r) => Math.hypot(r.positions[0] - r.positions[(nr - 1) * 3], r.positions[2] - r.positions[(nr - 1) * 3 + 2])
  assert.ok(largeur(halo) > largeur(ruban) * 4, 'le halo doit largement déborder du tracé')
})

test('altitudesImposees est ignoré s’il ne colle pas au nombre de sections', () => {
  // un tableau de la mauvaise taille viendrait d’un rééchantillonnage
  // différent : mieux vaut recalculer que produire une géométrie de travers
  const sol = () => 3
  const pts = [P(0, 0, 0), P(4, 0, 0)]
  const r = construitRuban(pts, { sol, pas: 0.5, garde: 0.1, altitudesImposees: [1, 2] })
  for (let i = 1; i < r.positions.length; i += 3) {
    assert.ok(r.positions[i] > 3, `altitude ${r.positions[i]} : le repli n’a pas eu lieu`)
  }
})

test('les transverses vont de -1 à +1 et repèrent le bord et l’axe', () => {
  const r = construitRuban([P(0, 0, 0), P(4, 0, 0)], { sol: () => 0, pas: 1 })
  assert.equal(r.transverses.length, r.nbPoints * nr)
  assert.equal(r.transverses[0], -1, 'premier rail : bord gauche')
  assert.equal(r.transverses[nr - 1], 1, 'dernier rail : bord droit')
  assert.equal(r.transverses[(nr - 1) / 2], 0, 'rail central : l’axe')
})

test('fractionDeTraine convertit une longueur MONDE en fraction de tracé', () => {
  // une traîne de 1,6 sur un tracé de 40 fait 4 % du tracé
  assert.ok(Math.abs(fractionDeTraine(1.6, 40) - 0.04) < 1e-12)
  // sur un tracé COURT, la même traîne physique pèse beaucoup plus lourd —
  // c’est voulu : la traîne est une longueur, pas une proportion
  assert.ok(fractionDeTraine(1.6, 8) > fractionDeTraine(1.6, 80))
  // et elle ne peut jamais déborder du tracé
  assert.equal(fractionDeTraine(50, 10), 1)
  // cas dégénérés : aucune traîne plutôt qu’un NaN qui ferait clignoter tout
  assert.equal(fractionDeTraine(1.6, 0), 0)
  assert.equal(fractionDeTraine(0, 40), 0)
  assert.equal(fractionDeTraine(NaN, 40), 0)
})

// ── nez arrondi ────────────────────────────────────────────────────────────

test('retraitDuNez : nul sur l’axe, maximal aux bords, symétrique', () => {
  assert.equal(retraitDuNez(0, 0.5), 0, 'au centre, le nez va aussi loin que la coupe')
  assert.ok(Math.abs(retraitDuNez(1, 0.5) - 0.5) < 1e-12, 'au bord, il recule d’un rayon entier')
  assert.ok(Math.abs(retraitDuNez(-0.6, 0.5) - retraitDuNez(0.6, 0.5)) < 1e-12)
  // monotone : sinon le contour ondulerait au lieu de s’arrondir
  let prec = -1
  for (let u = 0; u <= 1; u += 0.05) {
    const r = retraitDuNez(u, 0.5)
    assert.ok(r >= prec, `retrait non monotone en u=${u}`)
    prec = r
  }
})

test('LE CONTOUR DU NEZ EST UN VRAI DEMI-CERCLE, pas une approximation', () => {
  // le centre du cercle est à un rayon en arrière de la pointe, sur l’axe.
  // Tout point du contour doit se trouver EXACTEMENT à un rayon de ce centre —
  // c’est ça qui distingue un nez rond d’un nez simplement biseauté.
  const rayon = 0.4
  for (let u = -1; u <= 1; u += 0.1) {
    const leLongDeLAxe = rayon - retraitDuNez(u, rayon) // depuis le centre du cercle
    const enTravers = u * rayon // la demi-largeur EST le rayon, par construction
    const d = Math.hypot(leLongDeLAxe, enTravers)
    assert.ok(Math.abs(d - rayon) < 1e-12, `u=${u.toFixed(1)} : distance ${d}, attendue ${rayon}`)
  }
})

test('retraitDuNez : cas dégénérés, jamais de NaN', () => {
  // au-delà des bords (interpolation du GPU en coin de triangle) on plafonne
  assert.ok(Math.abs(retraitDuNez(1.4, 0.5) - 0.5) < 1e-12)
  assert.equal(retraitDuNez(0.5, 0), 0, 'rayon nul : aucun arrondi, pas une division par zéro')
  for (const v of [retraitDuNez(NaN, 0.5), retraitDuNez(0.5, NaN)]) assert.ok(Number.isFinite(v))
})

// ── modelé transversal ─────────────────────────────────────────────────────

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

test('le modelé va du bord SOMBRE au cœur VIF, sans jamais repartir en arrière', () => {
  const t = TEINTES_COURSE
  assert.equal(t.length, PROFIL_RAILS.length)
  const milieu = (t.length - 1) / 2
  assert.ok(Number.isInteger(milieu), 'il faut un rail central pour porter le cœur')
  for (let i = 1; i <= milieu; i++) {
    assert.ok(lum(t[i]) > lum(t[i - 1]), `la luminance recule entre les rails ${i - 1} et ${i}`)
  }
  assert.deepEqual(t[0], t[t.length - 1], 'symétrique')
})

test('LA RÉPARTITION EST DOUCE : aucune marche brutale entre deux rails voisins', () => {
  // le défaut qu’Adrien a signalé : l’ancien profil passait de 0,09 à 0,87 de
  // luminance entre DEUX rails voisins, soit 88 % de l’écart total d’un coup.
  // Le seuil s’est resserré avec le passage au dégradé DIFFUS : l’ombre ne se
  // concentre plus près du bord, elle s’étale — l’espacement des rails a donc
  // dû suivre (voir PROFIL_RAILS).
  const t = TEINTES_COURSE
  const etendue = lum(t[Math.floor(t.length / 2)]) - lum(t[0])
  let pireMarche = 0
  for (let i = 1; i < t.length; i++) pireMarche = Math.max(pireMarche, Math.abs(lum(t[i]) - lum(t[i - 1])))
  // mesuré : 22 %. Le seuil laisse trois points de marge — au-delà, c'est que
  // quelqu'un a retiré des rails ou raidi le fondu sans refaire l'espacement.
  assert.ok(
    pireMarche < etendue * 0.25,
    `marche de ${(pireMarche / etendue * 100).toFixed(0)} % de l’étendue : c’est encore une cassure`,
  )
})

test('LE DÉGRADÉ EST DIFFUS : il travaille sur toute la largeur, pas en liseré', () => {
  // un profil « à liseré » garde un cœur plat puis plonge d’un coup au bord.
  // Diffus, c’est l’inverse : la luminance change à CHAQUE rail, dès l’axe.
  const t = TEINTES_COURSE
  const milieu = Math.floor(t.length / 2)
  const etendue = lum(t[milieu]) - lum(t[0])
  // à mi-largeur on doit déjà avoir parcouru une part réelle du dégradé —
  // preuve que l’assombrissement ne s’est pas réfugié dans la marge
  const aMiLargeur = lum(t[Math.floor(milieu / 2)])
  const parcouru = (lum(t[milieu]) - aMiLargeur) / etendue
  assert.ok(parcouru > 0.35, `seulement ${(parcouru * 100).toFixed(0)} % du dégradé consommé à mi-largeur`)
})

test('le cœur est un VERMILLON, pas un crème — il ne doit pas se noyer dans la carte', () => {
  // les fonds de ShibuMap sont des terres pâles et peu saturées ; un cœur qui
  // se confond avec elles, c’est exactement le tracé invisible d’Adrien
  const [r, g, b] = COEUR_VERMILLON
  const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b)
  assert.ok(sat > 0.7, `saturation ${sat.toFixed(2)} : trop proche d’un ton de terre`)
  assert.ok(r > g && g > b, 'la dominante doit rester chaude et franche')
})

test('teintesDepuis applique le MÊME modelé à une couleur choisie', () => {
  const t = teintesDepuis([0.2, 0.5, 0.9])
  assert.equal(t.length, PROFIL_RAILS.length)
  const coeur = t[Math.floor(t.length / 2)]
  assert.ok(Math.abs(coeur[0] - 0.2) < 1e-9 && Math.abs(coeur[2] - 0.9) < 1e-9, 'le cœur EST la couleur choisie')
  assert.ok(lum(t[0]) < lum(coeur), 'le bord reste plus sombre')
  assert.deepEqual(t[0], t[t.length - 1], 'symétrique')
})

test('profilDeTeintes : la puissance resserre l’ombre sur la marge', () => {
  const rails = [-1, -0.5, 0, 0.5, 1]
  const doux = profilDeTeintes([1, 1, 1], [0, 0, 0], rails, 1)
  const resserre = profilDeTeintes([1, 1, 1], [0, 0, 0], rails, 3)
  assert.ok(lum(resserre[1]) > lum(doux[1]), 'à mi-largeur, le cœur doit tenir plus longtemps')
  // les deux bouts restent les mêmes quoi qu’il arrive
  assert.deepEqual(resserre[0], doux[0])
  assert.deepEqual(resserre[2], doux[2])
})
