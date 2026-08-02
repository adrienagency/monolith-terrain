import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEMPLATE_KEYS, parseTemplate } from '../src/templates-user.js'
import { TEMPLATES_LIVRES, urlTemplateLivre, estTemplateLivre, chargeTemplatesLivres } from '../src/templates-livres.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER = path.join(RACINE, 'public/templates/defaults')
const lis = (slug) => JSON.parse(fs.readFileSync(path.join(DOSSIER, `${slug}.json`), 'utf8'))

// La fournée du 2026-08-02 : les huit gabarits d'Adrien. Nommés en dur ici
// EXPRÈS — un test qui se contenterait de relire TEMPLATES_LIVRES ne dirait
// rien le jour où quelqu'un en retire un par mégarde.
const FOURNEE_2026_08_02 = [
  ['highlander', 'Highlander'],
  ['interlaken', 'Interlaken'],
  ['java', 'Java'],
  ['marvelous-old-school', 'Marvelous old school'],
  ['under-ice', 'UnderIce'],
  ['blue-is-back', 'Blue is back'],
  ['elixir', 'Elixir'],
  ['etretat', 'Etretat'],
]

// ------------------------------------------------ la bibliothèque elle-même
test('chaque gabarit annoncé existe vraiment sur le disque', () => {
  for (const slug of TEMPLATES_LIVRES) {
    const f = path.join(DOSSIER, `${slug}.json`)
    assert.ok(fs.existsSync(f), `gabarit annoncé mais absent : ${urlTemplateLivre(slug)}`)
  }
})

test('la fournée du 2026-08-02 est bien dans la bibliothèque livrée', () => {
  for (const [slug, nom] of FOURNEE_2026_08_02) {
    assert.ok(TEMPLATES_LIVRES.includes(slug), `${slug} absent de TEMPLATES_LIVRES`)
    assert.equal(lis(slug).name, nom)
  }
})

test('aucun doublon : ni de slug, ni de nom affiché', () => {
  assert.equal(new Set(TEMPLATES_LIVRES).size, TEMPLATES_LIVRES.length, 'slug en double')
  const noms = TEMPLATES_LIVRES.map((s) => String(lis(s).name).trim().toLowerCase())
  assert.equal(new Set(noms).size, noms.length, `nom affiché en double : ${noms.join(', ')}`)
})

test('chaque fichier livré est un .shibumap-template valide et relisible par parseTemplate', () => {
  for (const slug of TEMPLATES_LIVRES) {
    const o = lis(slug)
    assert.ok(estTemplateLivre(o), `${slug} n'est pas reconnu comme gabarit`)
    assert.equal(o.format, 'shibumap-template')
    assert.equal(o.version, 1)
    // parseTemplate est le portier de l'import : ce qu'il refuse n'entre pas
    const p = parseTemplate(JSON.stringify(o))
    assert.ok(p, `${slug} refusé par parseTemplate`)
    assert.equal(p.name, o.name)
    // la vignette est posée en <img src> : seul un data URL d'image passe
    if (o.thumb) assert.ok(p.thumb, `vignette de ${slug} rejetée (pas un data URL d'image)`)
    assert.ok(p.strip.length > 0, `${slug} sans bande de couleurs`)
  }
})

test('les huit portent une vignette JPEG et une pose de caméra exploitables', () => {
  for (const [slug] of FOURNEE_2026_08_02) {
    const p = parseTemplate(JSON.stringify(lis(slug)))
    assert.ok(/^data:image\/jpeg;base64,/.test(p.thumb || ''), `${slug} sans vignette JPEG`)
    assert.ok(p.view && p.view.dir && p.view.target, `${slug} sans pose de caméra`)
    assert.ok(Number.isFinite(p.view.k) && p.view.k > 0, `${slug} : facteur de distance invalide`)
  }
})

// ------------------------------------------------------ LE POINT CRITIQUE
// Les réglages retirés le 2026-08-02 (et leur comportement avec eux). Ces
// gabarits les portent TOUS. Le contrat du projet dit qu'une clé hors liste
// blanche tombe en silence — mais « ça devrait bien se passer » n'est pas une
// vérification, d'où ce bloc.
const CLES_SUPPRIMEES = [
  'waterFill',
  'placesHalo', 'placesDensity', 'placesSize',
  'fogEnabled', 'fogNear', 'fogFar',
  'bloomEnabled', 'bloomIntensity', 'bloomThreshold',
  // ⚠️ PAS 'slabCornerSmoothing' : voir le test dédié plus bas — celle-là est
  // morte dans le RENDU mais toujours dans la liste blanche, ce qui n'est pas
  // le même cas et ne se prouve pas de la même façon.
  // partis avant, même précédent
  'coastLine', 'roadsEnabled', 'roadsOpacity', 'roadsDetail', 'roadColor',
]

test('aucune clé supprimée ne figure dans TEMPLATE_KEYS', () => {
  for (const k of CLES_SUPPRIMEES) {
    assert.ok(!TEMPLATE_KEYS.includes(k), `${k} a été retirée du produit mais reste dans TEMPLATE_KEYS`)
  }
})

// Le filtre EXACT d'applyUserTemplate (main.js) : `for (const k of
// TEMPLATE_KEYS) if (k in L) params[k] = …`. On le rejoue ici pour prouver ce
// qui atterrit vraiment dans params, plutôt que de le déduire.
const filtreApplique = (look) => {
  const out = {}
  for (const k of TEMPLATE_KEYS) if (k in look) out[k] = look[k]
  return out
}

test('les clés supprimées sont écartées à l’application, sans erreur ni migration', () => {
  for (const slug of TEMPLATES_LIVRES) {
    const look = lis(slug).look
    const applique = filtreApplique(look)
    for (const k of CLES_SUPPRIMEES) {
      assert.ok(!(k in applique), `${slug} : ${k} a franchi le filtre et va écrire dans params`)
    }
  }
})

test('les huit portent bien ces clés mortes — le filtre a donc du travail', () => {
  // Si ce test tombe, c'est que les fichiers ont été nettoyés en amont : le
  // test précédent ne prouverait alors plus rien (il passerait à vide).
  for (const [slug] of FOURNEE_2026_08_02) {
    const look = lis(slug).look
    const portees = CLES_SUPPRIMEES.filter((k) => k in look)
    assert.ok(portees.length >= 10, `${slug} ne porte que ${portees.length} clés mortes — test à vide ?`)
  }
})

test('slabCornerSmoothing traverse encore la liste blanche, mais n’est lue par personne', () => {
  // Le cas à part. Contrairement aux clés ci-dessus, celle-ci n'a jamais été
  // retirée de TEMPLATE_KEYS : elle est donc bien recopiée dans params. Ce qui
  // la rend inoffensive, c'est qu'AUCUN code de rendu ne la relit — elle n'est
  // qu'une valeur par défaut posée dans main.js. Le jour où quelqu'un la
  // rebranche, ce test tombe et il faudra décider ce que les gabarits livrés
  // (qui portent tous 0.6 ou 0.72) doivent en faire.
  assert.ok(TEMPLATE_KEYS.includes('slabCornerSmoothing'))
  const lecteurs = []
  const parcours = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { parcours(p); continue }
      if (!/\.(js|glsl)$/.test(e.name)) continue
      const src = fs.readFileSync(p, 'utf8')
      // la DÉCLARATION du défaut (main.js) et la liste blanche ne sont pas des
      // lectures : on cherche un usage, c'est-à-dire une autre occurrence.
      for (const ligne of src.split('\n')) {
        if (!ligne.includes('slabCornerSmoothing')) continue
        if (/^\s*(\/\/|\*)/.test(ligne)) continue // un commentaire ne lit rien
        if (/slabCornerSmoothing:\s*0\.6/.test(ligne)) continue // le défaut
        if (/^\s*'slabCorner'/.test(ligne)) continue // TEMPLATE_KEYS
        lecteurs.push(`${path.relative(RACINE, p)} : ${ligne.trim()}`)
      }
    }
  }
  parcours(path.join(RACINE, 'src'))
  assert.deepEqual(lecteurs, [], `slabCornerSmoothing a retrouvé un lecteur :\n${lecteurs.join('\n')}`)
})

// --------------------------------------- ce qui compte ENCORE, et qui reste
// hazeAmt/hazeAlt/hazeDist = brume atmosphérique du nuanceur, à ne pas
// confondre avec le brouillard (fogEnabled/fogNear/fogFar) qui, lui, est parti.
// fogColor, malgré son nom, est la teinte de la FEUILLE DE FOND : gardée exprès.
const CLES_VIVANTES = [
  'hazeAmt', 'hazeAlt', 'hazeDist', 'fogColor',
  'surfaceFx', 'fx', 'terrainSurfaceMat', 'plinthPbr', 'seaBed',
  'bgStops', 'bgPoints', 'bgMode', 'colorMode', 'rampStops',
  'oceanShallow', 'oceanMid', 'oceanDeep', 'darkMode',
]

test('les réglages encore vivants traversent le filtre intacts', () => {
  for (const slug of TEMPLATES_LIVRES) {
    const look = lis(slug).look
    const applique = filtreApplique(look)
    for (const k of CLES_VIVANTES) {
      if (!(k in look)) continue
      assert.ok(k in applique, `${slug} : ${k} est vivante mais tombe au filtre`)
      assert.deepEqual(applique[k], look[k], `${slug} : ${k} déformée au passage`)
    }
  }
})

test('les matières demandées par Java et Étretat sont transmises telles quelles', () => {
  // Deux cas nommés parce qu'ils sont les seuls de la fournée à sortir des
  // valeurs d'usine côté matières — s'ils tombaient, la carte changerait de
  // texture sans que rien ne le dise.
  assert.equal(filtreApplique(lis('java').look).terrainSurfaceMat, 'fabric062')
  assert.equal(filtreApplique(lis('java').look).plinthPbr, 'oak')
  assert.equal(filtreApplique(lis('etretat').look).plinthPbr, 'sandstone')
  assert.equal(filtreApplique(lis('elixir').look).plinthPbr, 'sandstone')
})

test('bgStops/bgPoints voyagent qu’ils soient peuplés ou nuls', () => {
  // Un fond v2 peuplé (Highlander) et un fond resté nul (Java) : les deux
  // doivent traverser, sinon applyUserTemplate hérite du fond de la session.
  const hl = filtreApplique(lis('highlander').look)
  assert.ok(Array.isArray(hl.bgStops) && hl.bgStops.length === 3)
  assert.ok(Array.isArray(hl.bgPoints) && hl.bgPoints.length > 0)
  const jv = filtreApplique(lis('java').look)
  assert.ok('bgStops' in jv && jv.bgStops === null)
  assert.ok('bgPoints' in jv && jv.bgPoints === null)
})

// ------------------------------------------------------------ le chargeur
test('chargeTemplatesLivres garde l’ordre annoncé et étiquette chaque gabarit', async () => {
  const faux = async (url) => {
    const slug = url.split('/').pop().replace(/\.json$/, '')
    return { json: async () => lis(slug) }
  }
  const list = await chargeTemplatesLivres(faux)
  assert.deepEqual(list.map((t) => t.slug), TEMPLATES_LIVRES)
})

test('un gabarit illisible manque à l’appel sans faire tomber la bibliothèque', async () => {
  const faux = async (url) => {
    if (url.includes('java')) throw new Error('réseau')
    const slug = url.split('/').pop().replace(/\.json$/, '')
    return { json: async () => lis(slug) }
  }
  const list = await chargeTemplatesLivres(faux)
  assert.equal(list.length, TEMPLATES_LIVRES.length - 1)
  assert.ok(!list.some((t) => t.slug === 'java'))
})

test('un fichier qui n’est pas un gabarit est rejeté plutôt qu’affiché', async () => {
  const faux = async () => ({ json: async () => ({ hello: 'world' }) })
  assert.deepEqual(await chargeTemplatesLivres(faux), [])
})

// ------------------------------------------------- les DEUX modes, une liste
// Adrien : « dans la bibliothèque du mode avancé ET du mode simplifié ». Le
// seul moyen que ça reste vrai est qu'aucun des deux ne se refasse sa propre
// liste — ce test garde la source unique.
test('mode simple et mode avancé lisent la même liste livrée', () => {
  const atelier = fs.readFileSync(path.join(RACINE, 'src/ui/atelier.js'), 'utf8')
  const panneau = fs.readFileSync(path.join(RACINE, 'src/ui/templates-panel.js'), 'utf8')
  for (const [nom, src] of [['atelier.js (mode simple)', atelier], ['templates-panel.js (mode avancé)', panneau]]) {
    assert.match(src, /from '\.\.\/templates-livres\.js'/, `${nom} n'importe pas la bibliothèque livrée`)
    assert.match(src, /chargeTemplatesLivres/, `${nom} n'appelle pas le chargeur partagé`)
    // aucune liste de slugs reconstruite à côté
    assert.ok(!/\/templates\/defaults\//.test(src), `${nom} refabrique des URL de gabarits livrés`)
  }
})

// ------------------------------------------------------------------- poids
test('la bibliothèque livrée reste hors du bundle et sous un plafond de poids', () => {
  // Ces fichiers sont dans public/ : servis tels quels, chargés à la demande
  // (ouverture de la section / de l'étape ①), jamais sur le chemin du premier
  // affichage. Le plafond existe pour qu'une fournée future ne transforme pas
  // « à la demande » en « long à ouvrir » sans que personne le remarque.
  let total = 0
  for (const slug of TEMPLATES_LIVRES) total += fs.statSync(path.join(DOSSIER, `${slug}.json`)).size
  assert.ok(total < 400 * 1024, `bibliothèque livrée : ${(total / 1024).toFixed(1)} Ko, plafond 400 Ko`)
})
