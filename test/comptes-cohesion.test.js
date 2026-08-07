// ═══════════════════════════════════════════════════════════════════════════
// LE TEST QUI REND LA DIVERGENCE IMPOSSIBLE
// ═══════════════════════════════════════════════════════════════════════════
//
// Trois fichiers se partagent UN vocabulaire — les codes de refus :
//   · src/compte.js      les ÉMET (`refus('code-expire')`) ;
//   · src/compte-app.js  en émet quelques-uns en propre, et laisse passer les
//     autres tels quels ;
//   · src/ui/compte.js   en donne le TEXTE (la table `REFUS`).
//
// Rien, dans le langage, ne relie ces trois tables. Un code ajouté d'un côté
// sans son texte de l'autre ne casse aucun test, ne lève aucune exception, et
// ne se voit nulle part — sauf sur l'écran de quelqu'un, qui lit « La connexion
// ne répond pas » (le repli d'`injoignable`) sur un code parfaitement périmé,
// et va donc vérifier son réseau au lieu de redemander un code.
//
// ⚠️ CE N'EST PAS UNE CRAINTE THÉORIQUE, C'EST CE QUI VENAIT D'ARRIVER. Le
// 2026-08-08, `src/compte.js` émettait `courriel` pour deux causes opposées, et
// `code`, `reseau`, `indisponible`, `configuration` — QUATRE codes qui
// n'existaient dans aucune table de l'interface. Les deux moitiés ont été
// écrites en parallèle, chacune cohérente, et personne ne pouvait voir le
// décalage sans lire les deux fichiers côte à côte. Ce test les lit.
//
// ⚠️ IL RELIT LA SOURCE, PAS UNE CONSTANTE EXPORTÉE. Un module qui exporterait
// la liste de ses propres codes ne prouverait que sa cohérence avec lui-même :
// il suffirait d'ajouter un `refus('bidon')` sans toucher la liste pour que
// tout reste vert. Ce qu'on veut savoir, c'est ce que le code PEUT ÉMETTRE —
// donc on va lire les appels eux-mêmes.
//
// PREUVE PAR MUTATION (à refaire si ce fichier est retouché) : ajouter
// `refus('bidon')` n'importe où dans src/compte.js doit faire ÉCHOUER
// « tout code émis … a un texte ». Fait le 2026-08-08 — le test est mort comme
// prévu, en nommant `bidon`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8')

const SRC_SESSION = lire('src/compte.js')
const SRC_ADAPTATEUR = lire('src/compte-app.js')
const SRC_ECRANS = lire('src/ui/compte.js')

/**
 * Les clés d'un littéral d'objet nommé, lues dans la source.
 *
 * On s'arrête à la première ligne qui n'est QUE `}` : les tables visées sont
 * écrites à plat, une entrée par ligne, sans objet imbriqué. Si un jour ce
 * n'est plus vrai, ce lecteur doit tomber bruyamment plutôt que rendre une
 * liste tronquée — d'où les assertions.
 */
function clesDuBloc(source, nom, ou) {
  const marque = `const ${nom} = {`
  const debut = source.indexOf(marque)
  assert.ok(debut >= 0, `table \`${nom}\` introuvable dans ${ou} — ce test ne sait plus quoi lire`)
  const fin = source.indexOf('\n}', debut)
  assert.ok(fin > debut, `fin de la table \`${nom}\` introuvable dans ${ou}`)
  const corps = source.slice(debut + marque.length, fin)
  const cles = new Set()
  for (const m of corps.matchAll(/^\s*'?([A-Za-z][\w-]*)'?\s*:/gm)) cles.add(m[1])
  assert.ok(cles.size > 0, `aucune clé lue dans \`${nom}\` (${ou}) — le lecteur a décroché`)
  return cles
}

/** Tout `refus('…')` de la source : ce que le module PEUT émettre. */
function codesEmis(source) {
  const cles = new Set()
  for (const m of source.matchAll(/\brefus\(\s*'([\w-]+)'/g)) cles.add(m[1])
  return cles
}

/** Tout `code: '…'` — la forme sous laquelle l'adaptateur nomme un refus. */
function codesLitteraux(source) {
  const cles = new Set()
  for (const m of source.matchAll(/\bcode:\s*'([\w-]+)'/g)) cles.add(m[1])
  return cles
}

const tri = (s) => [...s].sort()

// ── Ce que chaque fichier dit, lu une fois pour toutes ───────────────────────
const TEXTES_ECRANS = clesDuBloc(SRC_ECRANS, 'REFUS', 'src/ui/compte.js')
const TABLE_SESSION = clesDuBloc(SRC_SESSION, 'MESSAGES', 'src/compte.js')
const EMIS_SESSION = codesEmis(SRC_SESSION)
const EMIS_ADAPTATEUR = new Set([
  ...codesEmis(SRC_ADAPTATEUR),
  ...codesLitteraux(SRC_ADAPTATEUR),
  // l'adaptateur nomme ses refus par `refus('…')` lui aussi, mais son repli
  // s'écrit `r?.raison || 'injoignable'` — on le tient donc pour émis d'office.
  'injoignable',
])

test('les deux tables sont lues pour de vrai (le lecteur n’est pas à côté de la plaque)', () => {
  // Sans ce garde, une refonte cosmétique de l'un des deux fichiers rendrait
  // tous les tests suivants vrais pour la pire des raisons : deux ensembles
  // vides sont parfaitement égaux.
  assert.ok(TEXTES_ECRANS.size >= 6, `six refus au moins à l’écran, vu ${TEXTES_ECRANS.size}`)
  assert.ok(EMIS_SESSION.size >= 6, `six codes au moins émis, vu ${EMIS_SESSION.size}`)
  assert.ok(TEXTES_ECRANS.has('injoignable'), 'le repli `injoignable` doit exister à l’écran')
})

test('⚠️ tout code que src/compte.js peut émettre a un texte dans src/ui/compte.js', () => {
  const orphelins = tri(EMIS_SESSION).filter((c) => !TEXTES_ECRANS.has(c))
  assert.deepEqual(
    orphelins,
    [],
    `ces codes sont émis par src/compte.js et n’ont AUCUN texte dans la table REFUS de ` +
      `src/ui/compte.js : ${orphelins.join(', ')}. Ils tomberaient en silence sur le texte ` +
      `d’« injoignable » (« La connexion ne répond pas »), qui ne dit pas ce qui s’est passé. ` +
      `Ajoute le texte, ou réutilise un code existant.`,
  )
})

test('⚠️ tout texte de src/ui/compte.js correspond à un code réellement émis', () => {
  const emis = new Set([...EMIS_SESSION, ...EMIS_ADAPTATEUR])
  const inutiles = tri(TEXTES_ECRANS).filter((c) => !emis.has(c))
  assert.deepEqual(
    inutiles,
    [],
    `ces textes de src/ui/compte.js ne correspondent à aucun code émis : ${inutiles.join(', ')}. ` +
      `Soit le code a été renommé sans que le texte suive, soit le texte est mort — dans les ` +
      `deux cas quelqu’un le relira un jour en croyant qu’il s’affiche.`,
  )
})

test('src/compte.js a un message pour chacun de ses propres codes', () => {
  // La table locale de src/compte.js sert aux appelants non graphiques (et aux
  // journaux). Un code émis sans message y rendrait `erreur: undefined`.
  const sansTexte = tri(EMIS_SESSION).filter((c) => !TABLE_SESSION.has(c))
  assert.deepEqual(sansTexte, [], `émis sans message dans MESSAGES : ${sansTexte.join(', ')}`)
  const jamaisEmis = tri(TABLE_SESSION).filter((c) => !EMIS_SESSION.has(c))
  assert.deepEqual(jamaisEmis, [], `message pour un code jamais émis : ${jamaisEmis.join(', ')}`)
})

test('⚠️ l’adaptateur n’invente aucun code que l’interface ne saurait afficher', () => {
  // src/compte-app.js laisse passer les codes de la session TELS QUELS ; ceux
  // qu'il fabrique lui-même (réseau tombé sur « Mes cartes », suppression
  // refusée) doivent obéir à la même table.
  const inconnus = tri(EMIS_ADAPTATEUR).filter((c) => !TEXTES_ECRANS.has(c))
  assert.deepEqual(inconnus, [], `codes émis par src/compte-app.js sans texte : ${inconnus.join(', ')}`)
})

// ── Le contrat de l'objet, pas seulement des codes ──────────────────────────

test('l’adaptateur expose EXACTEMENT le contrat écrit en tête de src/ui/compte.js', async () => {
  const { creerCompteApp } = await import('../src/compte-app.js')
  const app = creerCompteApp({ session: sessionMuette() })

  // `compteInerte` EST le contrat : c'est l'objet nul contre lequel les quatre
  // écrans ont été écrits, avant même que la session n'existe. Comparer les
  // deux jeux de clés, c'est comparer l'implémentation à sa spécification.
  //
  // ⚠️ IL EST LU DANS LA SOURCE, PAS IMPORTÉ. src/ui/compte.js commence par
  // `import './compte.css'`, que node ne sait pas charger — l'importer ici
  // ferait tomber le fichier de test entier, et c'est justement le genre de
  // panne qui finit par se « régler » en supprimant le test.
  const contrat = clesDuBloc(SRC_ECRANS, 'compteInerte', 'src/ui/compte.js')
  assert.deepEqual(Object.keys(app).sort(), tri(contrat))
  for (const cle of contrat) {
    assert.equal(typeof app[cle], 'function', `${cle} doit être une fonction`)
  }
})

function sessionMuette() {
  return {
    connecte: () => false,
    courriel: () => '',
    entetes: async () => ({}),
    jeton: async () => '',
    deconnecter: () => {},
    demanderCode: async () => ({ ok: false, raison: 'injoignable' }),
    verifierCode: async () => ({ ok: false, raison: 'injoignable' }),
  }
}
