import { test } from 'node:test'
import assert from 'node:assert/strict'
import { warmupPrograms } from '../src/warmup.js'

// Un renderer factice : warmupPrograms n'a besoin que de `compile()`, de
// `properties.get()` et, optionnellement, de `setRenderTarget()`.
//
// Un « matériau » y est un objet `{ programme }`, et `programme === null`
// signifie LIBÉRÉ : c'est ce que rend three après un `material.dispose()`, où
// `properties.get()` ne retrouve plus qu'un objet vide.
function materiauPret() { return { programme: { isReady: () => true } } }

function rendererFactice({ materiaux, leve = null, ancien = false } = {}) {
  const journal = []
  const r = {
    journal,
    setRenderTarget(t) { journal.push(['cible', t]) },
  }
  if (ancien) return r // three sans compile()/properties : cas « indisponible »
  r.properties = {
    get(materiau) { return materiau.programme === null ? {} : { currentProgram: materiau.programme } },
  }
  r.compile = (s, c) => {
    journal.push(['compile', s, c])
    if (leve) throw leve
    return new Set(materiaux ?? [materiauPret()])
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
  const renderer = rendererFactice({ leve: new Error('pilote fâché') })
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
  const renderer = rendererFactice({ leve: new Error('pilote fâché') })
  const res = await warmupPrograms({ renderer, scene: {}, camera: {} })
  assert.equal(res.ok, false)
  assert.match(res.raison, /pilote/)
})

test('warmupPrograms : un matériau LIBÉRÉ pendant le sondage ne fait pas dérailler le préchauffage', async () => {
  // LA RÉGRESSION. En production, une TypeError « Cannot read properties of
  // undefined (reading isReady) » tombait à CHAQUE chargement de page : le
  // sondage interne de `compileAsync` lit `properties.get(m).currentProgram`
  // sans garde, et three efface ces propriétés dès qu'un matériau est libéré.
  // ShibuMap en libère sans arrêt pendant le démarrage (dalles de relief
  // remplacées, globe évincé), donc la course était gagnée à tous les coups.
  // Pire : la levée avait lieu dans un setTimeout de three, hors de la chaîne
  // de promesses — increvable, et le préchauffage restait pendu jusqu'au délai.
  let sondages = 0
  const dalle = {
    programme: {
      isReady() {
        sondages += 1
        if (sondages === 2) dalle.programme = null // libérée en plein vol
        return false // sinon elle serait « prête » avant d'être libérée
      },
    },
  }
  const res = await warmupPrograms({ renderer: rendererFactice({ materiaux: [dalle, materiauPret()] }), scene: {}, camera: {}, timeoutMs: 2000 })
  assert.ok(sondages >= 2, 'la dalle doit avoir été sondée avant sa libération')
  assert.equal(res.ok, true)
  assert.equal(res.raison, undefined) // surtout pas 'delai' : on ne doit pas rester pendu
})

test('warmupPrograms : une sonde qui lève est rattrapée, sans rejet', async () => {
  // Un contexte WebGL perdu en cours de route fait lever getProgramParameter.
  // Le contrat tient : on rapporte, on ne rejette pas, on rend la main.
  const casse = { programme: { isReady() { throw new Error('contexte perdu') } } }
  const res = await warmupPrograms({ renderer: rendererFactice({ materiaux: [casse] }), scene: {}, camera: {} })
  assert.equal(res.ok, false)
  assert.match(res.raison, /contexte perdu/)
})

test('warmupPrograms : des programmes jamais prêts sont abandonnés au délai', async () => {
  // KHR_parallel_shader_compile est une EXTENSION : un pilote peut ne jamais
  // lever COMPLETION_STATUS_KHR, et le sondage tourner pour toujours. Sans ce
  // garde-fou, la carte ne serait jamais dessinée.
  const jamais = { programme: { isReady: () => false } }
  const t0 = Date.now()
  const res = await warmupPrograms({ renderer: rendererFactice({ materiaux: [jamais] }), scene: {}, camera: {}, timeoutMs: 60 })
  assert.ok(Date.now() - t0 >= 55, 'il doit vraiment avoir attendu')
  assert.equal(res.ok, false)
  assert.equal(res.raison, 'delai')
})

test('warmupPrograms : le préchauffage attend vraiment que les programmes soient prêts', async () => {
  // Sinon il ne servirait à rien : `programmesPrets` passerait à vrai avant que
  // le pilote ait fini, et le premier dessin paierait de nouveau la compilation.
  let sondages = 0
  const lent = { programme: { isReady: () => ++sondages >= 3 } }
  const res = await warmupPrograms({ renderer: rendererFactice({ materiaux: [lent] }), scene: {}, camera: {}, timeoutMs: 2000 })
  assert.equal(res.ok, true)
  assert.ok(sondages >= 3)
})

test('warmupPrograms : un renderer trop ancien (sans compile/properties) passe son tour', async () => {
  const res = await warmupPrograms({ renderer: rendererFactice({ ancien: true }), scene: {}, camera: {} })
  assert.equal(res.ok, false)
  assert.equal(res.raison, 'indisponible')
})

test('warmupPrograms : rapporte toujours une durée exploitable', async () => {
  const res = await warmupPrograms({ renderer: rendererFactice(), scene: {}, camera: {} })
  assert.ok(Number.isFinite(res.ms) && res.ms >= 0)
})
