import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  poolDePhrases,
  tirerPhrase,
  creerTireur,
  phraseDuLieu,
  phraseMesuree,
  arrondiAltitude,
  POIDS,
} from '../src/hints.js'
import { HINTS, LIEUX } from '../src/hints-data.js'

// Un tirage déterministe : on donne la suite de nombres que `rand` doit
// rendre, dans l'ordre. Chaque tirage en consomme deux (la catégorie, puis la
// phrase). Un test qui dépend de Math.random ne prouve rien.
const rands = (...suite) => {
  let i = 0
  return () => suite[Math.min(i++, suite.length - 1)]
}

// ---------------------------------------------------------------- les données

test('hints-data : aucune phrase vide, aucun doublon d’identifiant', () => {
  const vus = new Set()
  for (const [cat, lignes] of Object.entries(HINTS)) {
    assert.ok(lignes.length > 0, `la catégorie ${cat} est vide`)
    for (const l of lignes) {
      assert.ok(l.id && l.text, `une ligne de ${cat} est incomplète`)
      assert.ok(!vus.has(l.id), `identifiant en double : ${l.id}`)
      vus.add(l.id)
    }
  }
})

test('hints-data : ShibuMap tutoie — plus un seul vouvoiement dans les phrases', () => {
  // La demande n°2 d'Adrien vaut aussi pour ce qu'on écrit ici. Le test
  // l'attrape avant la relecture : une phrase ajoutée à la va-vite ne peut
  // pas réintroduire le « vous ».
  const tout = [
    ...Object.values(HINTS).flat().map((l) => l.text),
    ...LIEUX.flatMap((p) => p.lignes),
  ]
  for (const t of tout) {
    assert.ok(!/\b(vous|votre|vos)\b/i.test(t), `vouvoiement : « ${t} »`)
  }
})

test('hints-data : les zones curatées portent un rayon et au moins une ligne', () => {
  for (const p of LIEUX) {
    assert.ok(p.nom && p.lignes.length > 0, `zone incomplète : ${p.nom}`)
    assert.ok(p.rayonKm > 0, `${p.nom} : rayon manquant`)
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180, `${p.nom} : coordonnées hors monde`)
  }
})

// ------------------------------------------------------------- le fait du lieu

test('phraseDuLieu : la zone chargée donne ses propres phrases', () => {
  const lieux = [{ nom: 'Test', lat: 45, lon: 6, rayonKm: 30, lignes: ['a', 'b'] }]
  const trouve = phraseDuLieu(45.05, 6.05, lieux)
  assert.deepEqual(trouve.map((l) => l.text), ['a', 'b'])
  assert.equal(trouve[0].cat, 'lieu')
})

test('phraseDuLieu : hors rayon, on ne dit rien — le repli est le silence', () => {
  // C'est LE point qui compte : inventer un fait sur une zone inconnue est
  // pire que de meubler avec une astuce. La liste vide laisse le tirage
  // retomber sur les autres catégories.
  const lieux = [{ nom: 'Test', lat: 45, lon: 6, rayonKm: 10, lignes: ['a'] }]
  assert.deepEqual(phraseDuLieu(48.85, 2.35, lieux), [])
  assert.deepEqual(phraseDuLieu(undefined, undefined, lieux), [])
  assert.deepEqual(phraseDuLieu(45, 6, []), [])
})

test('phraseDuLieu : deux zones qui se chevauchent — la plus proche gagne', () => {
  const lieux = [
    { nom: 'Loin', lat: 45, lon: 6, rayonKm: 500, lignes: ['loin'] },
    { nom: 'Près', lat: 45.5, lon: 6, rayonKm: 500, lignes: ['près'] },
  ]
  assert.equal(phraseDuLieu(45.49, 6, lieux)[0].text, 'près')
})

test('LIEUX : le Piton de la Fournaise répond bien à La Réunion', () => {
  // L'exemple d'Adrien, mot pour mot, doit marcher sur la vraie table.
  const l = phraseDuLieu(-21.24, 55.71, LIEUX)
  assert.ok(l.length > 0)
  assert.ok(l.some((x) => /Fournaise/.test(x.text)), 'la ligne du Piton manque')
})

// -------------------------------------------------------- le fait mesuré (MNT)

test('phraseMesuree : le bloc chargé sait dire à quelle hauteur il monte', () => {
  const p = phraseMesuree({ maxM: 4802, minM: 620 })
  assert.ok(/4 800/.test(p.text), `altitude mal formatée : ${p.text}`)
  assert.equal(p.cat, 'lieu')
})

test('phraseMesuree : un bloc plat n’a rien à raconter', () => {
  // Amsterdam n'a pas de sommet. Une phrase « ce bloc monte à 10 m » est du
  // bruit : on préfère rendre null et laisser la place à une astuce.
  assert.equal(phraseMesuree({ maxM: 12, minM: -3 }), null)
  assert.equal(phraseMesuree(null), null)
  assert.equal(phraseMesuree({}), null)
})

test('phraseMesuree : la mer profonde compte autant que la montagne', () => {
  const p = phraseMesuree({ maxM: 40, minM: -4300 })
  assert.ok(/4 300/.test(p.text), `profondeur mal formatée : ${p.text}`)
})

test('arrondiAltitude : jamais plus précis que le MNT ne l’est vraiment', () => {
  // Le terrarium d'AWS est à ~10 m près sur un sommet. Annoncer « 4 802 m »
  // serait une fausse précision : on arrondit à la dizaine au-dessus de 100 m.
  assert.equal(arrondiAltitude(4802), 4800)
  assert.equal(arrondiAltitude(4806), 4810)
  assert.equal(arrondiAltitude(87), 87)
})

// ------------------------------------------------------------------ le tirage

test('poolDePhrases : sans lieu connu, il reste toujours de quoi écrire', () => {
  const pool = poolDePhrases({})
  assert.ok(pool.length > 10)
  assert.ok(pool.every((l) => l.id && l.text && l.cat))
  assert.ok(!pool.some((l) => l.cat === 'lieu'), 'aucun fait de lieu sans lieu')
})

test('poolDePhrases : le lieu et la mesure entrent dans le tirage', () => {
  const pool = poolDePhrases({ lat: -21.24, lon: 55.71, dem: { maxM: 2600, minM: -3000, lat: -21.24, lon: 55.71 } })
  assert.ok(pool.some((l) => /Fournaise/.test(l.text)), 'la zone curatée manque')
  assert.ok(pool.some((l) => l.id.startsWith('mesure')), 'la mesure du bloc manque')
})

test('poolDePhrases : un MNT qui ne correspond pas au lieu demandé est ignoré', () => {
  // Pendant un rechargement, `params` pointe déjà la nouvelle zone alors que
  // `dem` tient encore l'ancienne. Annoncer l'altitude du bloc précédent sous
  // le nom du nouveau serait un mensonge silencieux — le pire genre.
  const pool = poolDePhrases({ lat: 48.85, lon: 2.35, dem: { maxM: 4800, minM: 600, lat: 45.83, lon: 6.86 } })
  assert.ok(!pool.some((l) => l.id.startsWith('mesure')), 'la mesure du bloc précédent a fui')
})

test('tirerPhrase : le tirage choisit la catégorie, puis la phrase', () => {
  const pool = [
    { id: 'a1', text: 'A1', cat: 'astuce' },
    { id: 'a2', text: 'A2', cat: 'astuce' },
    { id: 'p1', text: 'P1', cat: 'partage' },
  ]
  // poids : astuce en tête, partage en queue — un premier nombre bas tombe
  // donc dans astuce, puis le second choisit dans cette catégorie
  const p = { astuce: 3, partage: 1 }
  assert.equal(tirerPhrase({ pool, rand: rands(0.01, 0.9), poids: p }).id, 'a2')
  assert.equal(tirerPhrase({ pool, rand: rands(0.99, 0), poids: p }).id, 'p1')
})

test('tirerPhrase : une phrase déjà vue ne revient pas tout de suite', () => {
  const pool = [
    { id: 'a1', text: 'A1', cat: 'astuce' },
    { id: 'a2', text: 'A2', cat: 'astuce' },
  ]
  const tire = tirerPhrase({ pool, recent: ['a1'], rand: rands(0, 0) })
  assert.equal(tire.id, 'a2', 'le tirage a repioché la phrase qu’on vient de lire')
})

test('tirerPhrase : tout le stock épuisé, on repart plutôt que de ne rien dire', () => {
  const pool = [{ id: 'a1', text: 'A1', cat: 'astuce' }]
  assert.equal(tirerPhrase({ pool, recent: ['a1'], rand: rands(0, 0) }).id, 'a1')
  assert.equal(tirerPhrase({ pool: [], rand: rands(0, 0) }), null)
})

test('tirerPhrase : une catégorie absente du pool ne mange pas de tirage', () => {
  // Sans lieu connu, le poids « lieu » ne doit pas laisser un trou dans la
  // roue : un nombre tiré dans sa part rendait null, donc un chargement muet.
  const pool = [{ id: 'a1', text: 'A1', cat: 'astuce' }]
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
    assert.equal(tirerPhrase({ pool, rand: rands(r, r) })?.id, 'a1')
  }
})

test('POIDS : le fait de lieu passe devant, l’appel au partage reste rare', () => {
  assert.ok(POIDS.lieu > POIDS.astuce, 'le fait géographique est le plus fort (Adrien)')
  assert.ok(POIDS.astuce > POIDS.appel, 'une astuce sert, un appel au partage fatigue')
})

// ------------------------------------------------------- la mémoire du tireur

test('creerTireur : deux chargements de suite ne montrent jamais la même phrase', () => {
  const tireur = creerTireur({ rand: () => 0 }) // rand constant : le pire cas
  const a = tireur.suivante({})
  const b = tireur.suivante({})
  assert.notEqual(a.id, b.id, 'la même phrase deux fois d’affilée')
})

test('creerTireur : la mémoire est courte et bornée', () => {
  // Elle doit oublier, sinon un visiteur qui charge trente cartes finit par
  // vider le stock et voir des répétitions en rafale plutôt qu'étalées.
  const tireur = creerTireur({ memoire: 3, rand: Math.random })
  for (let i = 0; i < 40; i++) tireur.suivante({})
  assert.ok(tireur.recent.length <= 3)
})

test('creerTireur : le lieu change, la phrase suit', () => {
  const tireur = creerTireur({ rand: () => 0 })
  const reunion = tireur.suivante({ lat: -21.24, lon: 55.71 })
  assert.equal(reunion.cat, 'lieu', 'le fait de lieu doit sortir en premier quand il existe')
  assert.ok(/Fournaise|Neiges|Réunion/.test(reunion.text))
})
