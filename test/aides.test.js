import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PREFIXE_CLE,
  cleAide,
  vuesDepuisCles,
  doitMontrer,
  acquitte,
  clesAOublier,
  nbMasquees,
} from '../src/aides.js'
import { AIDES } from '../src/aides-data.js'

// ══════════ CE QUE CE FICHIER VERROUILLE ════════════════════════════════════
//
// Une aide contextuelle a exactement deux façons de mal se comporter, et elles
// sont symétriques : se montrer quand personne ne l'a demandée (elle devient un
// bruit, et on apprend à cliquer « J'ai compris » sans lire), ou refuser de
// revenir quand on la redemande (elle devient un mécanisme sans marche arrière,
// donc invérifiable). Les tests ci-dessous tiennent les deux bords.

// ---------------------------------------------------------------- la clé

test('la clé est préfixée et stable — le stockage doit rester lisible à l’œil', () => {
  assert.equal(PREFIXE_CLE, 'shibumap.aide.')
  assert.equal(cleAide('fenetre-3x3'), 'shibumap.aide.fenetre-3x3')
})

// ---------------------------------------------------------- quand ça se montre

test('doitMontrer : l’option active et jamais acquittée — c’est le seul cas qui montre', () => {
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: true, vues: new Set() }), true)
})

test('doitMontrer : option éteinte, rien ne se montre — le mode ordinaire ne change pas', () => {
  // ⚠️ Contrainte de la demande, littéralement : tant qu'aucune aide n'est
  // déclenchée, l'interface se comporte exactement comme avant.
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: false, vues: new Set() }), false)
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: false, vues: new Set(['fenetre-3x3']) }), false)
})

test('doitMontrer : acquittée une fois, plus jamais — même en rallumant l’option', () => {
  const vues = new Set(['fenetre-3x3'])
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: true, vues }), false)
})

test('doitMontrer : « déjà actif au chargement » se montre aussi, et c’est voulu', () => {
  // Le visiteur qui arrive par un lien `?f3=1` n'a JAMAIS basculé
  // l'interrupteur : il n'y a pas eu de « première activation » à surprendre.
  // C'est pourtant lui qui a le plus besoin de la phrase — il a un mode
  // inhabituel sous les doigts sans avoir rien demandé. La règle ne regarde
  // donc pas la transition, elle regarde l'état : actif ET jamais acquitté.
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: true, vues: new Set() }), true)
})

test('doitMontrer : un id absent du catalogue ne montre rien — garde-fou anti-coquille', () => {
  // Sans ce garde, une faute de frappe dans l'appel afficherait une bulle vide
  // au milieu du terrain, et rien dans la console pour le dire.
  assert.equal(doitMontrer({ id: 'fenetre-3X3', actif: true, vues: new Set() }), false)
  assert.equal(doitMontrer({ id: '', actif: true, vues: new Set() }), false)
  assert.equal(doitMontrer({ id: undefined, actif: true, vues: new Set() }), false)
})

test('doitMontrer : `vues` accepte un tableau aussi bien qu’un Set', () => {
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: true, vues: ['fenetre-3x3'] }), false)
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: true, vues: [] }), true)
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: true, vues: null }), true)
})

test('doitMontrer : un catalogue passé en argument remplace le catalogue réel', () => {
  const faux = [{ id: 'essai', texte: 'x', action: 'ok', cible: () => null }]
  assert.equal(doitMontrer({ id: 'essai', actif: true, vues: new Set(), catalogue: faux }), true)
  assert.equal(doitMontrer({ id: 'fenetre-3x3', actif: true, vues: new Set(), catalogue: faux }), false)
})

// --------------------------------------------------------------- l'acquittement

test('acquitte : rend un nouvel ensemble et ne touche pas l’ancien', () => {
  const avant = new Set(['a'])
  const apres = acquitte(avant, 'fenetre-3x3')
  assert.deepEqual([...avant], ['a'], 'l’ensemble d’entrée doit rester intact')
  assert.ok(apres.has('fenetre-3x3'))
  assert.ok(apres.has('a'))
})

test('acquitte : deux fois de suite ne double pas l’entrée', () => {
  const une = acquitte(new Set(), 'fenetre-3x3')
  const deux = acquitte(une, 'fenetre-3x3')
  assert.equal(deux.size, 1)
})

// ---------------------------------------------------- la lecture du stockage

test('vuesDepuisCles : ne retient que les clés d’aide, et rend les ids nus', () => {
  const cles = ['shibumap.aide.fenetre-3x3', 'shibumap.aide.photo-aerienne']
  assert.deepEqual([...vuesDepuisCles(cles)].sort(), ['fenetre-3x3', 'photo-aerienne'])
})

test('vuesDepuisCles : ignore tout ce qui n’est pas une aide', () => {
  const cles = ['shibumap.fenetre-continue', 'shibumap-tour-done', 'autre', '']
  assert.equal(vuesDepuisCles(cles).size, 0)
})

// ══════════ LA REMISE À ZÉRO — LE TEST LE PLUS IMPORTANT DU FICHIER ═════════
//
// Le même `localStorage` porte les gabarits de l'utilisateur, ses palettes, sa
// préférence de mode continu et l'état du tour guidé. Une remise à zéro qui
// balaie une clé de trop efface un travail. On vérifie donc ce qui SURVIT,
// pas seulement ce qui part.

test('clesAOublier : ne rend QUE les clés d’aide — le reste du stockage survit', () => {
  const stockage = [
    'shibumap.aide.fenetre-3x3',
    'shibumap.aide.photo-aerienne',
    'shibumap.fenetre-continue', // la préférence du mode : NE DOIT PAS PARTIR
    'shibumap-tour-done', // le tour guidé : NE DOIT PAS PARTIR
    'shibumap.templates',
    'shibumap.palettes',
    '',
    'aide.fenetre-3x3', // préfixe incomplet : ce n'est pas une aide
    'shibumap.aides-autre-chose', // ressemblant mais pas préfixé pareil
  ]
  const partent = clesAOublier(stockage)
  assert.deepEqual(partent.sort(), ['shibumap.aide.fenetre-3x3', 'shibumap.aide.photo-aerienne'])
  for (const survivante of stockage.filter((k) => !partent.includes(k))) {
    assert.ok(!partent.includes(survivante), `${survivante} ne doit pas être effacée`)
  }
})

test('nbMasquees : compte ce que le bouton de remise à zéro annonce', () => {
  assert.equal(nbMasquees(['shibumap.aide.a', 'shibumap.aide.b', 'shibumap.autre']), 2)
  assert.equal(nbMasquees([]), 0)
  assert.equal(nbMasquees(null), 0)
})

test('la boucle complète : montrer → acquitter → taire → remettre à zéro → remontrer', () => {
  const id = 'fenetre-3x3'
  let vues = new Set()
  assert.equal(doitMontrer({ id, actif: true, vues }), true, '1. première activation : ça se montre')
  vues = acquitte(vues, id)
  assert.equal(doitMontrer({ id, actif: true, vues }), false, '2. « J’ai compris » : ça se tait')
  const cles = [...vues].map(cleAide)
  assert.deepEqual(clesAOublier(cles), ['shibumap.aide.fenetre-3x3'], '3. la remise à zéro la vise')
  vues = vuesDepuisCles([]) // le stockage a été vidé de ses aides
  assert.equal(doitMontrer({ id, actif: true, vues }), true, '4. et elle revient')
})

// ══════════ LE CATALOGUE — LES MÊMES RÈGLES QUE hints-data.js ═══════════════

test('catalogue : les ids sont uniques', () => {
  const ids = AIDES.map((a) => a.id)
  assert.equal(new Set(ids).size, ids.length, 'deux aides partagent un id')
})

test('catalogue : chaque aide a un id en minuscules-tirets, un texte, une action et une cible', () => {
  for (const a of AIDES) {
    assert.match(a.id, /^[a-z0-9-]+$/, `id douteux : ${a.id}`)
    assert.ok(a.texte?.trim().length > 0, `${a.id} : texte vide`)
    assert.ok(a.action?.trim().length > 0, `${a.id} : bouton sans libellé`)
    assert.equal(typeof a.cible, 'function', `${a.id} : la cible doit être une fonction (le DOM n’existe pas encore au chargement du module)`)
  }
})

test('catalogue : tutoiement — aucun « vous » nulle part', () => {
  // Même règle que hints-data.js. Une passe entière est passée à tutoyer tout
  // le site ; une bulle qui vouvoie se remarque immédiatement.
  for (const a of AIDES) {
    for (const champ of [a.titre, a.texte, a.note, a.action]) {
      if (!champ) continue
      assert.doesNotMatch(champ, /\bvous\b|\bvotre\b|\bvos\b/i, `${a.id} vouvoie : « ${champ} »`)
    }
  }
})

test('catalogue : ni point d’exclamation ni emoji — le ton reste calme', () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u
  for (const a of AIDES) {
    for (const champ of [a.titre, a.texte, a.note, a.action]) {
      if (!champ) continue
      assert.ok(!champ.includes('!'), `${a.id} : point d’exclamation dans « ${champ} »`)
      assert.doesNotMatch(champ, emoji, `${a.id} : emoji dans « ${champ} »`)
    }
  }
})

test('catalogue : l’apostrophe est typographique, pas droite', () => {
  // Le reste du site utilise ’. Une ' droite au milieu d'une bulle en gros
  // corps se voit.
  for (const a of AIDES) {
    for (const champ of [a.titre, a.texte, a.note, a.action]) {
      if (!champ) continue
      assert.ok(!champ.includes("'"), `${a.id} : apostrophe droite dans « ${champ} »`)
    }
  }
})

test('catalogue : le texte reste court — une bulle qu’on lit, pas un paragraphe', () => {
  // Au-delà, la bulle couvre le terrain qu'elle est censée expliquer.
  for (const a of AIDES) {
    assert.ok(a.texte.length <= 200, `${a.id} : ${a.texte.length} caractères, c’est trop long`)
    if (a.note) assert.ok(a.note.length <= 90, `${a.id} : note trop longue`)
  }
})

test('catalogue : l’aide du mode continu existe et dit le geste', () => {
  const a = AIDES.find((x) => x.id === 'fenetre-3x3')
  assert.ok(a, 'l’aide du mode continu 3×3 doit exister')
  assert.match(a.texte, /clic droit/i, 'le geste doit être nommé — c’est tout l’objet de la bulle')
  assert.equal(a.action, 'J’ai compris')
})
