import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEMPLATE_KEYS, parseTemplate, serializeTemplate } from '../src/templates-user.js'
import { styleTemplateText } from '../src/store-catalog.js'
import { TEMPLATES_LIVRES, chargeTemplatesLivres } from '../src/templates-livres.js'
import {
  ORIGINE_SHIBUMAP, ORIGINE_MOI, lisOrigine,
  signatureLook, origineTemplate, trieTemplates, nomsEnCollision,
} from '../src/bibliotheque-origine.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER = path.join(RACINE, 'public/templates/defaults')
const lis = (slug) => JSON.parse(fs.readFileSync(path.join(DOSSIER, `${slug}.json`), 'utf8'))

// Ce qu'un enregistrement local contient VRAIMENT : captureLook ne garde que
// les clés de TEMPLATE_KEYS. Un gabarit livré, lui, traîne des clés retirées
// depuis (waterFill, les fog*, les bloom*…). C'est toute la difficulté de la
// comparaison, et la raison pour laquelle la signature filtre les deux côtés.
const commeSauveEnLocal = (look) => {
  const o = {}
  for (const k of TEMPLATE_KEYS) if (k in look) o[k] = look[k]
  return o
}

// --------------------------------------------------------------- signature
test('la signature ignore l’ordre des clés et ce qui n’est pas appliqué', () => {
  const a = { rampStops: [{ c: '#111', p: 0 }], exposure: 1.2, contrast: 0.3 }
  const b = { contrast: 0.3, exposure: 1.2, rampStops: [{ c: '#111', p: 0 }] }
  assert.equal(signatureLook(a), signatureLook(b))
  // une clé hors liste blanche ne pèse rien : elle n'est jamais appliquée
  assert.equal(signatureLook({ ...a, waterFill: true, demLat: 45 }), signatureLook(a))
  // …mais une VALEUR qui change, si
  assert.notEqual(signatureLook({ ...a, exposure: 1.3 }), signatureLook(a))
})

test('la signature d’un look absent ou incohérent est vide, pas une erreur', () => {
  assert.equal(signatureLook(null), '')
  assert.equal(signatureLook(undefined), '')
  assert.equal(signatureLook('the main stuff'), '')
})

// ----------------------------------------------------------- le marqueur
test('lisOrigine n’accepte que les deux valeurs connues', () => {
  assert.equal(lisOrigine(ORIGINE_SHIBUMAP), 'shibumap')
  assert.equal(lisOrigine(ORIGINE_MOI), 'moi')
  assert.equal(lisOrigine('officiel'), null)
  assert.equal(lisOrigine(undefined), null)
  assert.equal(lisOrigine({ toString: () => 'shibumap' }), null)
})

test('le marqueur prime sur le contenu, dans les deux sens', () => {
  const look = { exposure: 1 }
  const sigs = new Set([signatureLook(look)])
  // même contenu qu'un livré, mais déclaré création : on ne le masque pas
  assert.equal(origineTemplate({ origine: ORIGINE_MOI, look }, sigs), 'moi')
  // contenu inconnu, mais déclaré de la maison (boutique) : il se range avec eux
  assert.equal(origineTemplate({ origine: ORIGINE_SHIBUMAP, look: { exposure: 9 } }, sigs), 'officiel')
})

test('sans marqueur, seul un look IDENTIQUE à un livré compte pour une copie', () => {
  const livre = { look: { exposure: 1, contrast: 0.2 } }
  const sigs = new Set([signatureLook(livre.look)])
  assert.equal(origineTemplate({ name: 'Etretat', look: { exposure: 1, contrast: 0.2 } }, sigs), 'copie')
  // un seul réglage qui diffère et ce n'est plus une copie : c'est du travail
  assert.equal(origineTemplate({ name: 'Etretat', look: { exposure: 1, contrast: 0.9 } }, sigs), 'moi')
  // sans catalogue de référence, rien n'est jamais masqué
  assert.equal(origineTemplate({ name: 'Etretat', look: { exposure: 1, contrast: 0.2 } }, new Set()), 'moi')
})

test('un gabarit sans look reste une création — on ne masque jamais dans le doute', () => {
  assert.equal(origineTemplate({ name: 'vieux' }, new Set([''])), 'moi')
})

// ------------------------------------------------------------------- tri
test('trieTemplates range en trois tas sans rien perdre', () => {
  const livres = [{ name: 'Carbon', look: { exposure: 1 } }]
  const miens = [
    { id: 'a', name: 'Carbon', look: { exposure: 1 } },              // copie locale
    { id: 'b', name: 'Mon look', look: { exposure: 2 } },            // création
    { id: 'c', name: 'Acheté', origine: ORIGINE_SHIBUMAP, look: {} }, // boutique
  ]
  const { officiels, miens: perso, copies } = trieTemplates(miens, livres)
  assert.deepEqual(officiels.map((t) => t.id), ['c'])
  assert.deepEqual(perso.map((t) => t.id), ['b'])
  assert.deepEqual(copies.map((t) => t.id), ['a'])
  assert.equal(officiels.length + perso.length + copies.length, miens.length)
})

test('trieTemplates supporte des listes vides ou absentes', () => {
  assert.deepEqual(trieTemplates(), { officiels: [], miens: [], copies: [] })
  const { miens } = trieTemplates([{ id: 'x', look: { a: 1 } }])
  assert.deepEqual(miens.map((t) => t.id), ['x'])
})

test('deux gabarits homonymes de contenus différents ne sont pas un doublon', () => {
  const livres = [{ name: 'Interlaken', look: { exposure: 1 } }]
  const miens = [{ id: 'z', name: 'interlaken', look: { exposure: 4 } }]
  const { copies, miens: perso } = trieTemplates(miens, livres)
  assert.equal(copies.length, 0, 'un homonyme ne doit JAMAIS être masqué')
  assert.deepEqual(perso.map((t) => t.id), ['z'])
  // …mais on le SIGNALE, casse et espaces compris
  assert.deepEqual([...nomsEnCollision(perso, livres)], ['interlaken'])
})

test('nomsEnCollision ne retient que les vrais homonymes', () => {
  const livres = [{ name: 'Etretat' }, { name: 'Carbon' }]
  assert.equal(nomsEnCollision([{ name: ' etretat ' }], livres).size, 1)
  assert.equal(nomsEnCollision([{ name: 'Etretat bis' }], livres).size, 0)
  assert.equal(nomsEnCollision([{ name: '' }, {}], livres).size, 0)
})

// ------------------------------------------------- le bug qu'Adrien a vu
// « the main stuff », « Carbon », « yellow glass », « Interlaken », « Etretat »
// s'affichaient deux fois : ces gabarits ont été fabriqués DANS l'application
// puis exportés vers public/templates/defaults/, et la copie de travail est
// restée dans le localStorage de qui les a faits. On reproduit exactement ça.
const DOUBLONS_SIGNALES = ['the-main-stuff', 'carbon', 'yellow-glass', 'interlaken', 'etretat']

test('la copie locale d’un gabarit livré est reconnue, nom pour nom', () => {
  const livres = TEMPLATES_LIVRES.map((s) => lis(s))
  for (const slug of DOUBLONS_SIGNALES) {
    const copie = { id: `ut_${slug}`, name: lis(slug).name, look: commeSauveEnLocal(lis(slug).look) }
    const { copies, miens } = trieTemplates([copie], livres)
    assert.equal(copies.length, 1, `${slug} : copie locale non reconnue`)
    assert.equal(miens.length, 0, `${slug} : rangé à tort dans les créations`)
  }
})

test('un livré retouché d’un cran redevient une création', () => {
  const livres = TEMPLATES_LIVRES.map((s) => lis(s))
  const base = lis('etretat')
  const retouche = { id: 'ut_1', name: 'Etretat', look: { ...commeSauveEnLocal(base.look), exposure: 42 } }
  const { copies, miens } = trieTemplates([retouche], livres)
  assert.equal(copies.length, 0)
  assert.equal(miens.length, 1)
})

test('aucun gabarit livré n’est la copie d’un autre gabarit livré', () => {
  const livres = TEMPLATES_LIVRES.map((s) => lis(s))
  const sigs = livres.map((t) => signatureLook(t.look))
  assert.equal(new Set(sigs).size, sigs.length, 'deux gabarits livrés ont le même look')
})

// ------------------------------------------------- le marqueur à la source
test('chargeTemplatesLivres estampille chaque gabarit « shibumap »', async () => {
  const faux = async (url) => {
    const slug = url.split('/').pop().replace('.json', '')
    // un fichier qui se déclarerait création ne doit RIEN changer : l'origine
    // est posée par le chargeur, pas lue du fichier
    return { json: async () => ({ ...lis(slug), origine: ORIGINE_MOI }) }
  }
  const list = await chargeTemplatesLivres(faux)
  assert.equal(list.length, TEMPLATES_LIVRES.length)
  for (const t of list) assert.equal(t.origine, ORIGINE_SHIBUMAP, `${t.slug} mal estampillé`)
  assert.equal(trieTemplates(list, []).officiels.length, list.length)
})

test('un style de la boutique reste de la maison après l’aller-retour fichier', () => {
  const entry = { slug: 'x', name: 'Bleu', strip: ['#123456'], look: { exposure: 1, rampStops: [{ c: '#123456', p: 0 }] } }
  const parsed = parseTemplate(styleTemplateText(entry))
  assert.equal(parsed.origine, ORIGINE_SHIBUMAP)
  assert.equal(origineTemplate(parsed, new Set()), 'officiel')
})

test('l’origine survit à un export/import, et une valeur inventée est refusée', () => {
  const t = { name: 'Mien', origine: ORIGINE_MOI, thumb: null, strip: ['#111111'], shaders: false, view: null, look: { exposure: 1 } }
  assert.equal(parseTemplate(serializeTemplate(t)).origine, ORIGINE_MOI)
  // pas d'origine du tout : le champ ne doit pas apparaître dans le fichier
  const sans = JSON.parse(serializeTemplate({ ...t, origine: undefined }))
  assert.equal('origine' in sans, false)
  assert.equal(parseTemplate(JSON.stringify({ ...sans, origine: 'maison' })).origine, null)
})
