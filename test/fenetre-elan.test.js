import test from 'node:test'
import assert from 'node:assert/strict'
import { COURSE_ELASTIQUE, borneElastique, rappelElastique } from '../src/fenetre-course.js'
import { V_ARRET, V_LANCER_MIN, vitesseAuLache, pasElan } from '../src/fenetre-elan.js'

// Un petit simulateur : on lance la fenêtre et on la laisse vivre, image par
// image, exactement comme `f3Tick` le fait — élan tant qu'il vit, rappel ensuite.
// C'est la seule façon honnête de tester une loi qui se juge sur une trajectoire
// entière et pas sur un pas isolé.
function simule(v0, { x = 0, z = 0, im = 1 / 60, max = 600, course = COURSE_ELASTIQUE } = {}) {
  let etat = { x, z, vx: v0.x, vz: v0.z }
  const traces = [{ x: borneElastique(x, course), z: borneElastique(z, course) }]
  let images = 0
  for (let k = 0; k < max; k++) {
    if (etat.vx !== 0 || etat.vz !== 0) {
      const r = pasElan(etat, im, course)
      etat = { x: r.brutX, z: r.brutZ, vx: r.vx, vz: r.vz }
      traces.push({ x: r.x, z: r.z })
      if (r.vx === 0 && r.vz === 0) {
        // La main passe le relais au rappel : le brut se recale sur l'affiché,
        // comme au lâcher. C'est ce que fait `f3Lache` et ce que doit faire
        // `f3Tick` quand l'élan meurt hors course.
        etat = { x: r.x, z: r.z, vx: 0, vz: 0 }
      }
      images++
      continue
    }
    const ax = rappelElastique(etat.x, course, im)
    const az = rappelElastique(etat.z, course, im)
    if (ax === etat.x && az === etat.z) break
    etat = { x: ax, z: az, vx: 0, vz: 0 }
    traces.push({ x: ax, z: az })
  }
  return { fin: { x: etat.x, z: etat.z }, traces, images, secondes: images * im }
}

// ── LA MESURE DE VITESSE AU LÂCHER ───────────────────────────────────────────

test('un lancer franc rend la vitesse du geste', () => {
  // 30 unités parcourues en 60 ms = 500 unités/s.
  const ech = [
    { t: 1.0, x: 0, z: 0 },
    { t: 1.03, x: 15, z: 0 },
    { t: 1.06, x: 30, z: 0 },
  ]
  const v = vitesseAuLache(ech, 1.06)
  assert.ok(v.x > 0, 'le lancer part dans le sens du geste')
  assert.equal(v.z, 0)
})

test("un drag LENT relâché ne part PAS — c'est la condition d'un geste précis", () => {
  // Poser le terrain au pixel près est le geste le plus fréquent. S'il glissait
  // encore après le lâcher, on ne pourrait jamais viser.
  const ech = [
    { t: 1.0, x: 0, z: 0 },
    { t: 1.05, x: 0.1, z: 0.05 },
    { t: 1.1, x: 0.2, z: 0.1 },
  ]
  const v = vitesseAuLache(ech, 1.1)
  assert.deepEqual(v, { x: 0, z: 0 })
})

test('un doigt arrêté avant le lâcher ne lance rien', () => {
  // Le cas classique : on file vite, on s'arrête pour viser, on relâche. Les
  // derniers échantillons sont vieux — les prendre pour du courant relancerait
  // le terrain alors que la main l'avait posé.
  const ech = [
    { t: 1.0, x: 0, z: 0 },
    { t: 1.03, x: 20, z: 0 },
  ]
  assert.deepEqual(vitesseAuLache(ech, 1.5), { x: 0, z: 0 }, 'lâché 470 ms après le dernier mouvement')
})

test('une pause courte avant le lâcher AMORTIT le lancer au lieu de le nier', () => {
  // On divise par (tLâcher − premier) et non par la durée entre échantillons :
  // une hésitation de quelques images rend mécaniquement une vitesse plus faible.
  // Sans ça, la loi aurait une falaise — même geste, tout ou rien selon 1 ms.
  // 6 unités en 30 ms = 200 unités/s, bien sous le plafond : c'est la pause qui
  // doit faire la différence, pas l'écrêtage.
  const ech = [
    { t: 1.0, x: 0, z: 0 },
    { t: 1.03, x: 6, z: 0 },
  ]
  const vif = vitesseAuLache(ech, 1.03).x
  const hesitant = vitesseAuLache(ech, 1.06).x
  assert.ok(hesitant > 0 && hesitant < vif, `${hesitant} devrait être entre 0 et ${vif}`)
})

test('la vitesse est PLAFONNÉE : un saut de souris ne catapulte pas la fenêtre', () => {
  // Un pointermove peut sauter 2 000 px en une image (fenêtre déplacée, souris
  // rattrapée). Sans plafond, l'élan partirait au bout de l'emprise en une image.
  const ech = [
    { t: 1.0, x: 0, z: 0 },
    { t: 1.001, x: 900, z: 0 },
  ]
  const v = vitesseAuLache(ech, 1.001)
  assert.ok(v.x > 0 && v.x < 1000, `vitesse aberrante : ${v.x}`)
})

test('moins de deux échantillons : aucun élan', () => {
  assert.deepEqual(vitesseAuLache([], 1), { x: 0, z: 0 })
  assert.deepEqual(vitesseAuLache([{ t: 1, x: 5, z: 5 }], 1), { x: 0, z: 0 })
})

// ── LA TRAJECTOIRE ───────────────────────────────────────────────────────────

test('un lancer franc parcourt une distance SENSIBLE puis s’arrête', () => {
  const s = simule({ x: 60, z: 0 })
  assert.ok(s.fin.x > 8, `un lancer franc doit se voir : ${s.fin.x} unité(s) parcourue(s)`)
  assert.ok(s.fin.x < COURSE_ELASTIQUE, 'mais pas traverser toute la course d’un coup')
  assert.ok(s.secondes > 0.4, `il doit GLISSER, pas se poser (${s.secondes} s)`)
  assert.ok(s.secondes < 2.5, `il doit finir par s’arrêter (${s.secondes} s)`)
})

test('plus on lance fort, plus on va loin — la loi est monotone', () => {
  let prec = 0
  for (const v of [10, 20, 40, 80, 160]) {
    const d = simule({ x: v, z: 0 }).fin.x
    assert.ok(d > prec, `lancer à ${v} ne va pas plus loin qu’à moins`)
    prec = d
  }
})

test('l’élan décélère toujours : aucune image ne va plus vite que la précédente', () => {
  // C'est la définition visuelle d'un amortissement. Une seule image qui
  // ré-accélère se lit comme un à-coup.
  const s = simule({ x: 80, z: 40 })
  let precPas = Infinity
  for (let i = 1; i < s.traces.length; i++) {
    const pas = Math.hypot(s.traces[i].x - s.traces[i - 1].x, s.traces[i].z - s.traces[i - 1].z)
    assert.ok(pas <= precPas + 1e-9, `ré-accélération à l’image ${i} : ${pas} après ${precPas}`)
    precPas = pas
  }
})

test('l’élan garde la DIRECTION du geste', () => {
  const s = simule({ x: 60, z: -30 })
  const angleGeste = Math.atan2(-30, 60)
  const angleFin = Math.atan2(s.fin.z, s.fin.x)
  assert.ok(Math.abs(angleGeste - angleFin) < 0.02, `dévié de ${angleGeste - angleFin} rad`)
})

test('l’élan ne dépend pas de la cadence — 60 im/s et 30 im/s arrivent au même endroit', () => {
  // Sinon l'iMac 2015 (la machine cible) lancerait deux fois plus loin ou deux
  // fois moins loin que la machine sur laquelle on règle le ressenti.
  const a = simule({ x: 90, z: 0 }, { im: 1 / 60 }).fin.x
  const b = simule({ x: 90, z: 0 }, { im: 1 / 30 }).fin.x
  assert.ok(Math.abs(a - b) / a < 0.06, `écart de ${(100 * Math.abs(a - b)) / a} % entre 60 et 30 im/s`)
})

test('un dt aberrant (onglet réveillé) ne catapulte pas la fenêtre', () => {
  const r = pasElan({ x: 0, z: 0, vx: 200, vz: 0 }, 12, COURSE_ELASTIQUE)
  assert.ok(r.brutX < 20, `12 s d’un coup ont envoyé la fenêtre à ${r.brutX}`)
})

// ── LE MARIAGE AVEC LA BUTÉE ─────────────────────────────────────────────────

test('un lancer vers le bord est ABSORBÉ par la butée, sans à-coup', () => {
  // Le lancer part de 40 et vise 300 unités/s : sans butée il sortirait de
  // l'emprise. Trois choses doivent tenir en même temps.
  const s = simule({ x: 300, z: 0 }, { x: 40 })
  // 1. On ne montre jamais le vide : l'affiché reste dans la butée.
  const maxVu = Math.max(...s.traces.map((p) => p.x))
  assert.ok(maxVu > COURSE_ELASTIQUE, 'le bord doit céder un peu, sinon c’est un mur')
  assert.ok(maxVu < COURSE_ELASTIQUE + 8, `débordement de ${maxVu - COURSE_ELASTIQUE} : trop de vide montré`)
  // 2. Aucun rebond : la fenêtre ne repart jamais vers l'extérieur après avoir
  //    commencé à revenir. Un rebond se lit comme une collision, pas comme une
  //    butée souple.
  const iMax = s.traces.findIndex((p) => p.x === maxVu)
  for (let i = iMax + 1; i < s.traces.length; i++) {
    assert.ok(s.traces[i].x <= s.traces[i - 1].x + 1e-9, `rebond vers l’extérieur à l’image ${i}`)
  }
  // 3. Elle finit EXACTEMENT au bord, et vite.
  assert.equal(s.fin.x, COURSE_ELASTIQUE)
  assert.ok(s.secondes < 2, `${s.secondes} s pour se faire absorber, c’est trop long`)
})

test('au bord, la vitesse est CONTINUE — ni arrêt net, ni reprise à froid', () => {
  // ⚠️ LE TEST QUI MANQUAIT, ET QUI A COÛTÉ UNE VERSION. Tout ce qui précède
  // passait avec une butée qui ÉTEIGNAIT l'élan puis laissait le rappel repartir
  // à froid. Le banc navigateur a montré la couture, en unités par image :
  //
  //     0,598 0,433 0,263 0,173 0,114 0,076 0,052 0,034 0,024 │ 0,372
  //
  // Le terrain s'arrêtait presque, puis repartait quinze fois plus vite. Aucun
  // test de position ne le voyait, parce que les positions, elles, étaient
  // bonnes. C'est la DÉRIVÉE qu'il faut regarder.
  //
  // ⚠️ ET CE N'EST PAS L'AMPLITUDE DU FREINAGE QU'IL FAUT BORNER. Un lancer
  // violent DOIT décélérer violemment contre une butée — c'est ce qu'est une
  // butée. Le défaut, c'est le REDÉMARRAGE : ralentir presque jusqu'à l'arrêt,
  // puis repartir. On mesure donc exactement ça — une fois le terrain descendu
  // sous le dixième de sa vitesse de lancement, il ne doit plus jamais la
  // dépasser.
  //
  // Mesuré sur toute la plage de lancers (40 à 420 unités/s, le plafond) : la
  // reprise plafonne à 12,3 % du pic. L'ancienne loi était à 62 %.
  for (const v0 of [60, 120, 300, 420]) {
    const s = simule({ x: v0, z: 0 }, { x: 40 })
    const d = []
    for (let i = 1; i < s.traces.length; i++) d.push(s.traces[i].x - s.traces[i - 1].x)
    const pic = Math.max(...d.map(Math.abs))
    let i = 0
    while (i < d.length && Math.abs(d[i]) > 0.1 * pic) i++
    const reprise = Math.max(0, ...d.slice(i).map(Math.abs))
    assert.ok(
      reprise < 0.2 * pic,
      `lancer à ${v0} : le terrain redémarre à ${((100 * reprise) / pic).toFixed(1)} % de sa vitesse après s’être presque arrêté`
    )
  }
})

test('la butée mange la vitesse : un lancer énorme ne va pas plus loin qu’un gros', () => {
  // Sans absorption, le brut filerait à 3 000 unités hors course et il faudrait
  // des secondes de rappel pour rentrer — le terrain paraîtrait décroché.
  const gros = simule({ x: 300, z: 0 }, { x: 50 })
  const enorme = simule({ x: 3000, z: 0 }, { x: 50 })
  const dGros = Math.max(...gros.traces.map((p) => p.x)) - COURSE_ELASTIQUE
  const dEnorme = Math.max(...enorme.traces.map((p) => p.x)) - COURSE_ELASTIQUE
  assert.ok(dEnorme - dGros < 3, `10× plus fort enfonce ${dEnorme - dGros} unités de plus`)
  assert.ok(enorme.secondes < 2, `${enorme.secondes} s pour rentrer après un lancer énorme`)
})

test('un axe en butée n’éteint pas l’autre', () => {
  // On lance en diagonale contre le bord droit : x doit être absorbé, mais le
  // glissement en z doit continuer sa vie. Sinon toucher un bord fige tout.
  const s = simule({ x: 300, z: 60 }, { x: 50, z: 0 })
  assert.equal(s.fin.x, COURSE_ELASTIQUE, 'x revient au bord')
  assert.ok(s.fin.z > 8, `z devait continuer à glisser, il n’a fait que ${s.fin.z}`)
})

// ── REPRENDRE LE TERRAIN ─────────────────────────────────────────────────────

test('reprendre le terrain annule l’inertie SUR-LE-CHAMP', () => {
  // Rattraper un terrain qui glisse encore est le geste réflexe. S'il continuait
  // sous le doigt d'une seule image, le geste suivant partirait décalé.
  const r = pasElan({ x: 12, z: 3, vx: 0, vz: 0 }, 1 / 60, COURSE_ELASTIQUE)
  assert.equal(r.brutX, 12)
  assert.equal(r.brutZ, 3)
  assert.equal(r.actif, false)
})

test('sous le seuil d’arrêt, l’élan s’éteint net au lieu de traîner', () => {
  // Une exponentielle ne s'annule jamais. Sans seuil, `tickFenetre` (9,9 ms) et
  // `plinth.rebuild` (2,2 ms) tourneraient indéfiniment pour un déplacement
  // sous le pixel — 12 ms par image volées pour rien.
  const r = pasElan({ x: 0, z: 0, vx: V_ARRET * 0.9, vz: 0 }, 1 / 60, COURSE_ELASTIQUE)
  assert.equal(r.vx, 0)
  assert.equal(r.actif, false)
})

test('les deux seuils sont cohérents : ce qui se lance peut vivre', () => {
  // Si le seuil de lancement était sous le seuil d'arrêt, un lancer tout juste
  // valide mourrait à la première image — un élan qui clignote.
  assert.ok(V_LANCER_MIN > V_ARRET, `${V_LANCER_MIN} doit dépasser ${V_ARRET}`)
})
