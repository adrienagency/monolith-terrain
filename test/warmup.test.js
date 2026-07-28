import { test } from 'node:test'
import assert from 'node:assert/strict'
import { warmupPrograms } from '../src/warmup.js'

// Un renderer factice : warmupPrograms n'a besoin de rien d'autre que
// `compileAsync` et, optionnellement, `setRenderTarget`.
function rendererFactice({ compile, sansCompileAsync = false } = {}) {
  const journal = []
  const r = {
    journal,
    setRenderTarget(t) { journal.push(['cible', t]) },
  }
  if (!sansCompileAsync) {
    r.compileAsync = (s, c) => {
      journal.push(['compile', s, c])
      return compile ? compile() : Promise.resolve()
    }
  }
  return r
}

test('warmupPrograms : compile la scène de l application, une fois', async () => {
  const renderer = rendererFactice()
  const scene = { id: 'scene' }
  const camera = { id: 'cam' }
  const res = await warmupPrograms({ renderer, scene, camera })
  assert.equal(res.ok, true)
  const compils = renderer.journal.filter((l) => l[0] === 'compile')
  assert.equal(compils.length, 1)
  assert.equal(compils[0][1], scene)
  assert.equal(compils[0][2], camera)
})

test('warmupPrograms : compile CONTRE la cible de rendu, puis la repose à null', async () => {
  // MESURÉ : sans cette cible, three compile ses programmes pour le canevas
  // (sRGB, 8 bits) alors que la chaîne de post-traitement rend ensuite dans un
  // tampon HDR. Les clés de programme diffèrent, le préchauffage tombe à côté,
  // et on paie NEUF programmes compilés pour rien. Avec la cible : trois.
  const renderer = rendererFactice()
  const cible = { id: 'tampon-hdr' }
  await warmupPrograms({ renderer, scene: {}, camera: {}, target: cible })
  assert.deepEqual(renderer.journal.map((l) => (l[0] === 'cible' ? l[1] : 'COMPILE')), [cible, 'COMPILE', null])
})

test('warmupPrograms : la cible est reposée à null MÊME si la compilation échoue', async () => {
  // Le piège qui coûterait le plus cher : un renderer laissé braqué sur un
  // tampon hors écran dessinerait toutes les images suivantes dans le vide.
  // Écran noir permanent, et aucune erreur en console pour le dire.
  const renderer = rendererFactice({ compile: () => Promise.reject(new Error('pilote fâché')) })
  const res = await warmupPrograms({ renderer, scene: {}, camera: {}, target: { id: 'hdr' } })
  assert.equal(res.ok, false)
  assert.deepEqual(renderer.journal.at(-1), ['cible', null])
})

test('warmupPrograms : sans cible, on ne touche pas au renderer', async () => {
  const renderer = rendererFactice()
  await warmupPrograms({ renderer, scene: {}, camera: {} })
  assert.equal(renderer.journal.filter((l) => l[0] === 'cible').length, 0)
})

test('warmupPrograms : un pilote qui échoue ne doit JAMAIS empêcher le démarrage', async () => {
  // Tout l'enjeu : ce préchauffage est un confort. S'il casse, la carte doit
  // démarrer quand même — quitte à retrouver le gel qu'on cherchait à
  // supprimer. Une promesse rejetée ici laisserait un écran de chargement
  // éternel, ce qui est infiniment pire que 2 s de gel.
  const renderer = rendererFactice({ compile: () => Promise.reject(new Error('pilote fâché')) })
  const res = await warmupPrograms({ renderer, scene: {}, camera: {} })
  assert.equal(res.ok, false)
  assert.match(res.raison, /pilote/)
})

test('warmupPrograms : une compilation qui ne se termine jamais est abandonnée au délai', async () => {
  // KHR_parallel_shader_compile est une EXTENSION : un pilote peut ne jamais
  // lever COMPLETION_STATUS_KHR, et compileAsync boucler pour toujours. Sans
  // ce garde-fou, la carte ne serait jamais dessinée.
  const renderer = rendererFactice({ compile: () => new Promise(() => {}) })
  const t0 = Date.now()
  const res = await warmupPrograms({ renderer, scene: {}, camera: {}, timeoutMs: 60 })
  assert.ok(Date.now() - t0 >= 55, 'il doit vraiment avoir attendu')
  assert.equal(res.ok, false)
  assert.equal(res.raison, 'delai')
})

test('warmupPrograms : un renderer sans compileAsync (three ancien) passe son tour', async () => {
  const res = await warmupPrograms({ renderer: rendererFactice({ sansCompileAsync: true }), scene: {}, camera: {} })
  assert.equal(res.ok, false)
  assert.equal(res.raison, 'indisponible')
})

test('warmupPrograms : compileAsync qui lève de façon SYNCHRONE est rattrapé aussi', async () => {
  const renderer = { compileAsync: () => { throw new Error('boum') }, setRenderTarget() {} }
  const res = await warmupPrograms({ renderer, scene: {}, camera: {} })
  assert.equal(res.ok, false)
  assert.match(res.raison, /boum/)
})

test('warmupPrograms : rapporte toujours une durée exploitable', async () => {
  const res = await warmupPrograms({ renderer: rendererFactice(), scene: {}, camera: {} })
  assert.ok(Number.isFinite(res.ms) && res.ms >= 0)
})
