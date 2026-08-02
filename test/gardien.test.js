import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PALIERS } from '../src/palier-machine.js'
import {
  PART_MO,
  COUCHES,
  MARGE_TENDU,
  MARGE_DEBLOCAGE,
  couche,
  coutCouche,
  partsPortees,
  cransPerdus,
  capaciteParts,
  occupationParts,
  etatBudget,
  evaluerCouche,
  aRetirerPour,
  etatCouches,
  desarmeUrl,
  PROTECTIONS,
  machinePorteContinu,
  palierVise,
  echantillonRetenu,
} from '../src/gardien.js'

const ROOT = path.join(import.meta.dirname, '..')

// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CES TESTS PROTÈGENT
// ═══════════════════════════════════════════════════════════════════════════
//
// Le gardien décide si une couche cartographique optionnelle peut s'allumer.
// Sa promesse tient en une phrase d'Adrien : « ShibuMap ne plante jamais ».
//
// Trois affirmations sont verrouillées ici, et ce sont celles qui coûtent cher
// à réapprendre :
//
//   1. LA CAPACITÉ SORT DE LA TABLE DES PALIERS, pas d'un second tableau.
//      C'est la leçon de fenetre-reglage.js : un seuil écrit à côté de la table
//      doit être rejustifié chaque fois qu'on touche à la table.
//   2. AUCUN REFUS N'EST MUET, et aucun refus n'est définitif. Un refus porte
//      toujours une raison ET la liste de ce qu'il faut éteindre.
//   3. LE GARDIEN NE MESURE RIEN LUI-MÊME. Il lit le palier du gouverneur
//      (perf.js), qui porte déjà toutes les garanties contre le piège du dt.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ POURQUOI LES TESTS DE BUDGET N'INTERROGENT PAS `COUCHES`
// ═══════════════════════════════════════════════════════════════════════════
//
// Le 2026-08-02, Adrien a fait retirer quatre couches du catalogue (étoiles,
// volcans, pistes de ski, sentiers : elles annonçaient ce qui vient sans rien
// peindre). TREIZE tests de ce fichier sont tombés d'un coup — alors qu'aucune
// règle de budget n'avait bougé.
//
// La cause était ici, pas dans src/gardien.js : ces tests se servaient des
// couches réelles comme EXEMPLES DE COÛT. « aRetirerPour propose le sacrifice le
// plus petit » avait besoin d'une couche à 3 parts et de trois couches allumées
// à 1+1+2 ; la marge de déblocage avait besoin d'une capacité tout juste
// atteinte. Le catalogue passant de 18 parts à 7, tous ces scénarios changeaient
// de sens en même temps.
//
// Le rafistolage aurait été de recalculer treize assertions. C'aurait été
// réparer le symptôme : trois mois plus tard, la couche suivante les recassait.
// UNE RÈGLE DE BUDGET NE DOIT PAS ÊTRE ÉPROUVÉE SUR UN INVENTAIRE. Le gardien
// accepte désormais un `catalogue` en argument (défaut : `COUCHES`), et tout ce
// qui suit sous « LA RÈGLE » s'éprouve sur ESSAI, un catalogue fictif figé.
//
// Ce qui reste attaché au VRAI catalogue, c'est ce dont le vrai catalogue est le
// sujet : les trois couches qu'Adrien veut voir, l'unicité des identifiants, la
// présence des notes, et le fait que l'onglet reste utilisable sur la machine la
// plus faible. Ces tests-là DOIVENT rougir quand l'inventaire change.

// ═══════════ LE CATALOGUE FICTIF — le banc d'essai de la règle ══════════════
//
// Cinq entrées, et les coûts couvrent toute l'échelle déclarée par le gardien
// (1, 2, 3, 4). DEUX couches à 1 part : c'est ce qui permet d'éprouver que les
// égalités de coût sont tranchées par l'ORDRE du catalogue, et pas au hasard.
// Une entrée sans rendu, pour que `aProduire` garde un sujet même le jour où
// aucune couche réelle ne le porte.
//
// ⚠️ CE CATALOGUE EST FIGÉ. Ne l'alignez jamais sur le vrai : le jour où on le
// fait, on a reperdu ce que ce fichier vient de gagner.
const ESSAI = [
  { id: 'ess-un', nom: 'Essai une part', cout: 1, note: 'catalogue fictif : la famille la moins chère (du remplissage, rien de drapé).' },
  { id: 'ess-un-bis', nom: 'Essai une part bis', cout: 1, note: 'catalogue fictif : même coût que la précédente, pour éprouver le départage par l’ordre.' },
  { id: 'ess-deux', nom: 'Essai deux parts', cout: 2, note: 'catalogue fictif : une texture drapée par dalle du damier.' },
  { id: 'ess-trois', nom: 'Essai trois parts', cout: 3, note: 'catalogue fictif : une texture drapée qui porte en plus ses mips.' },
  { id: 'ess-quatre', nom: 'Essai quatre parts', cout: 4, note: 'catalogue fictif : un réseau vectoriel Overpass, la famille la plus chère.' },
  { id: 'ess-sans-rendu', nom: 'Essai sans rendu', cout: 1, aProduire: true, note: 'catalogue fictif : annoncée au catalogue, mais son rendu n’est pas écrit.' },
]

// ═══════════ LE CATALOGUE RÉEL — ce qu'Adrien doit voir dans le panneau ═════

test('le catalogue déclare des coûts FIXES, entiers, positifs, et des identifiants uniques', () => {
  assert.ok(COUCHES.length >= 1, 'un catalogue vide ferait un panneau vide')
  const vus = new Set()
  for (const c of COUCHES) {
    assert.ok(typeof c.id === 'string' && c.id.length > 0, `identifiant manquant : ${JSON.stringify(c)}`)
    assert.equal(vus.has(c.id), false, `identifiant en double : ${c.id}`)
    vus.add(c.id)
    assert.ok(typeof c.nom === 'string' && c.nom.length > 0, `${c.id} : pas de nom affichable`)
    assert.ok(Number.isInteger(c.cout) && c.cout >= 1, `${c.id} : le coût doit être un entier ≥ 1`)
    // Le POURQUOI du chiffre voyage avec le chiffre : sans lui, personne ne
    // saura sur quoi le recalibrer le jour où la couche s'avère plus lourde.
    assert.ok(typeof c.note === 'string' && c.note.length > 10, `${c.id} : le coût doit dire d'où il vient`)
  }
})

test('le catalogue porte EXACTEMENT les trois couches qui peignent, et aucune autre', () => {
  // Adrien, le 2026-08-02 : « retire les cases étoiles, volcans, pistes de ski,
  // et sentiers ». Ces quatre-là n'avaient pas de rendu : quatre lignes grisées
  // en permanence dans un panneau de sept, c'est un panneau qu'on cesse de lire.
  //
  // ⚠️ CE TEST EST UNE LISTE EXACTE, PAS UNE INCLUSION. Une entrée réintroduite
  // à la légère (par une fusion de branche, par exemple) doit le faire rougir —
  // c'est tout son intérêt.
  assert.deepEqual(COUCHES.map((c) => c.id), ['lumieres-nocturnes', 'occupation-sol', 'canopee'])
  assert.deepEqual(COUCHES.map((c) => c.cout), [2, 3, 2])
})

test('aucune couche du catalogue réel ne s’annonce sans son rendu', () => {
  // Le pendant du test précédent : les quatre retirées portaient toutes
  // `aProduire`. S'il en reste une, c'est qu'on a retiré la mauvaise entrée.
  for (const c of COUCHES) {
    assert.notEqual(c.aProduire, true, `« ${c.id} » est au catalogue mais ne peint rien`)
  }
})

test('couche() et coutCouche() : un identifiant inconnu ne lève pas et ne coûte rien de gratuit', () => {
  assert.equal(couche('nawak', ESSAI), null)
  // ⚠️ Un inconnu coûte le MAXIMUM du catalogue, pas 0. Une couche ajoutée sans
  // entrée au catalogue ne doit pas devenir gratuite par accident : c'est
  // exactement le chemin silencieux par lequel un budget se vide.
  assert.equal(coutCouche('nawak', ESSAI), 4)
  assert.equal(coutCouche('ess-deux', ESSAI), 2)
  // …et sans catalogue explicite, c'est le vrai qui répond : le défaut ne doit
  // pas partir à la dérive pendant que les tests regardent ailleurs.
  assert.equal(couche('nawak'), null)
  assert.equal(coutCouche('canopee'), couche('canopee').cout)
  assert.equal(coutCouche('nawak'), Math.max(...COUCHES.map((c) => c.cout)))
})

test('PART_MO ancre la part sur une mesure du dépôt, pas sur un chiffre rond', () => {
  // 79 Mo par dalle voisine, relevé le 2026-07-27 (test/damier-memoire.test.js).
  assert.equal(PART_MO, 79)
})

// ═══════════ LA CAPACITÉ — elle se lit dans la table des paliers ════════════

test('partsPortees se lit sur damierMax : la table des paliers dit déjà ce que la machine porte', () => {
  assert.equal(partsPortees(PALIERS[0]), 12) // damierMax 24
  assert.equal(partsPortees(PALIERS[1]), 6) // damierMax 12
  assert.equal(partsPortees(PALIERS[2]), 4) // damierMax 8
  assert.equal(partsPortees(PALIERS[3]), 2) // damierMax 4
})

test('partsPortees : une machine non sondée reçoit le budget le plus généreux', () => {
  // Même règle que machinePorteContinu et que palier-machine.js : on ne refuse
  // JAMAIS sur une absence d'information. Les machines dont on ne sait rien
  // sont souvent les plus récentes.
  for (const muet of [null, undefined, {}, { nom: 'X' }, { damierMax: NaN }, { damierMax: -3 }]) {
    assert.equal(partsPortees(muet), partsPortees(PALIERS[0]), `${JSON.stringify(muet)} ne doit pas rogner le budget`)
  }
})

test('cransPerdus : c’est l’écart au palier de DÉPART, jamais une valeur négative', () => {
  assert.equal(cransPerdus({ tier: 0, startTier: 0 }), 0)
  assert.equal(cransPerdus({ tier: 2, startTier: 0 }), 2)
  assert.equal(cransPerdus({ tier: 3, startTier: 1 }), 2)
  // Le gouverneur a le droit de REMONTER d'un cran au-dessus de son départ
  // (plafondDeRemontee). Ce cadeau ne doit pas gonfler le budget : un signal ne
  // peut qu'aggraver le verdict, jamais l'adoucir (règle de palier-machine.js).
  assert.equal(cransPerdus({ tier: 0, startTier: 1 }), 0)
  // Absence d'information = aucune souffrance constatée.
  for (const muet of [null, undefined, {}, { tier: NaN, startTier: 0 }]) {
    assert.equal(cransPerdus(muet), 0, `${JSON.stringify(muet)} ne doit pas punir`)
  }
})

test('capaciteParts : chaque cran perdu par le gouverneur coupe le budget en deux', () => {
  const m = PALIERS[0] // 12 parts
  assert.equal(capaciteParts({ machine: m, gouverneur: { tier: 0, startTier: 0 } }), 12)
  assert.equal(capaciteParts({ machine: m, gouverneur: { tier: 1, startTier: 0 } }), 6)
  assert.equal(capaciteParts({ machine: m, gouverneur: { tier: 2, startTier: 0 } }), 3)
  assert.equal(capaciteParts({ machine: m, gouverneur: { tier: 3, startTier: 0 } }), 1)
})

test('capaciteParts : le palier de DÉPART du gouverneur peut rogner le budget, jamais l’élargir', () => {
  // Le cas du téléphone : un Adreno 750 est une carte « forte » (palier 0 de la
  // table), et pourtant palierDeDepart le colle à 3. La règle d'appareil prime,
  // exactement comme dans palier-machine.js.
  const fort = PALIERS[0]
  assert.equal(capaciteParts({ machine: fort, gouverneur: { tier: 3, startTier: 3 } }), 2)
  // …et l'inverse n'existe pas : un départ généreux ne rachète pas une machine
  // faible.
  assert.equal(capaciteParts({ machine: PALIERS[3], gouverneur: { tier: 0, startTier: 0 } }), 2)
})

test('capaciteParts : sans aucune information, le budget reste celui de la meilleure machine', () => {
  assert.equal(capaciteParts({}), 12)
  assert.equal(capaciteParts(), 12)
})

// ═══════════════════════════════════════════════════════════════════════════
// LA RÈGLE — tout ce qui suit s'éprouve sur ESSAI, jamais sur l'inventaire
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════ LA COMPTABILITÉ ═════════════════════════════════════════════════

test('occupationParts additionne le coût des couches allumées et ignore les inconnues des listes vides', () => {
  assert.equal(occupationParts([], ESSAI), 0)
  assert.equal(occupationParts(null, ESSAI), 0)
  assert.equal(occupationParts(['ess-un', 'ess-trois'], ESSAI), 4)
  // Une couche listée deux fois ne se paie qu'une fois : la liste décrit un
  // ENSEMBLE d'interrupteurs, pas une file.
  assert.equal(occupationParts(['ess-deux', 'ess-deux'], ESSAI), 2)
})

test('etatBudget rend de quoi dessiner une jauge, et une phrase lisible', () => {
  const b = etatBudget({ actives: ['ess-quatre'], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
  assert.equal(b.capacite, 12)
  assert.equal(b.occupation, 4)
  assert.equal(b.restant, 8)
  assert.ok(b.fraction > 0 && b.fraction < 1)
  assert.ok(typeof b.resume === 'string' && b.resume.length > 0)
  assert.equal(b.tendu, false)
})

test('etatBudget : la jauge ne déborde jamais, même si l’occupation dépasse la capacité', () => {
  // Cas réel : les couches sont allumées, PUIS le gouverneur descend d'un cran
  // et la capacité fond. Le gardien n'éteint rien de lui-même (il ne retire
  // jamais ce que le visiteur a choisi) — mais la jauge doit rester dessinable.
  const b = etatBudget({ actives: ['ess-quatre', 'ess-deux', 'ess-trois'], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 }, catalogue: ESSAI })
  assert.equal(b.capacite, 2)
  assert.equal(b.occupation, 9)
  assert.equal(b.fraction, 1)
  assert.equal(b.restant, 0, 'le restant se plancherise à 0, il ne devient pas négatif')
  assert.equal(b.depassement, 7)
  assert.equal(b.tendu, true)
})

test('etatBudget : « tendu » s’allume dès qu’il reste MARGE_TENDU parts ou moins', () => {
  const g = { tier: 0, startTier: 0 }
  // capacité 4 (palier ALLÉGÉ) ; on remplit à 3 → il reste 1
  const b = etatBudget({ actives: ['ess-trois'], machine: PALIERS[2], gouverneur: g, catalogue: ESSAI })
  assert.equal(b.restant, 1)
  assert.equal(MARGE_TENDU, 1)
  assert.equal(b.tendu, true)
})

test('sans `catalogue`, toutes les fonctions de budget retombent sur COUCHES', () => {
  // ⚠️ LE DÉFAUT EST CE QUE L'APPLICATION UTILISE. Ni main.js ni
  // couches-panel.js ne passent de catalogue : si le paramètre venait à changer
  // de défaut, tout ce fichier continuerait de passer au vert pendant que le
  // panneau se viderait à l'écran. Ce test-ci est le seul lien entre les deux.
  const total = COUCHES.reduce((s, c) => s + c.cout, 0)
  assert.equal(occupationParts(COUCHES.map((c) => c.id)), total)
  assert.equal(etatBudget({ actives: COUCHES.map((c) => c.id), machine: PALIERS[0] }).occupation, total)
  assert.equal(etatCouches({ machine: PALIERS[0] }).couches.length, COUCHES.length)
})

// ═══════════ LE VERDICT — trois réponses, jamais un refus muet ══════════════

test('evaluerCouche rend « oui » quand la place est franche, avec une raison chiffrée', () => {
  const r = evaluerCouche({ id: 'ess-un', actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
  assert.equal(r.verdict, 'oui')
  assert.equal(r.cout, 1)
  assert.equal(r.restantApres, 11)
  assert.match(r.raison, /\d/, 'la raison doit porter des chiffres')
  assert.deepEqual(r.aRetirer, [])
})

test('evaluerCouche rend « oui-avec-avertissement » quand allumer vide le budget', () => {
  // palier ALLÉGÉ : 4 parts. Une couche à 3 parts → il reste 1.
  const r = evaluerCouche({ id: 'ess-trois', actives: [], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
  assert.equal(r.verdict, 'oui-avec-avertissement')
  assert.equal(r.restantApres, 1)
  assert.ok(r.raison.length > 0)
})

test('evaluerCouche rend « non » AVEC une raison ET la liste de ce qu’il faut éteindre', () => {
  // palier ESSENTIEL : 2 parts. La couche à 4 parts ne passe pas.
  const r = evaluerCouche({ id: 'ess-quatre', actives: ['ess-un'], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 }, catalogue: ESSAI })
  assert.equal(r.verdict, 'non')
  assert.ok(r.raison.length > 0, 'un refus muet est explicitement écarté')
  assert.match(r.raison, /\d/)
  assert.ok(Array.isArray(r.aRetirer))
})

test('evaluerCouche : une couche DÉJÀ allumée est toujours « oui » — le gardien n’éteint rien', () => {
  // Le gardien refuse d'ALLUMER ; il ne retire jamais ce que le visiteur a déjà
  // choisi. Même règle que les drapeaux `dirty` de perf.js : une fois que
  // l'humain a la main sur un levier, l'automate ne la reprend pas.
  const r = evaluerCouche({ id: 'ess-quatre', actives: ['ess-quatre', 'ess-deux'], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 }, catalogue: ESSAI })
  assert.equal(r.verdict, 'oui')
  assert.equal(r.deja, true)
})

test('evaluerCouche : un identifiant inconnu est refusé, pas ignoré', () => {
  const r = evaluerCouche({ id: 'nawak', actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
  assert.equal(r.verdict, 'non')
  assert.match(r.raison, /catalogue/i)
  // Le coût annoncé pour un inconnu est le plus cher du catalogue CONSULTÉ.
  assert.equal(r.cout, 4)
})

// ═══════════ L'HYSTÉRÉSIS — une marge entre bloquer et débloquer ════════════

test('evaluerCouche : une couche déjà refusée exige MARGE_DEBLOCAGE parts de plus pour revenir', () => {
  assert.equal(MARGE_DEBLOCAGE, 1)
  const commun = { id: 'ess-deux', machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI } // capacité 4, coût 2
  // Occupation 2 (deux couches à 1 part) → 2 + 2 = 4 = capacité : ça passe
  // TOUT JUSTE, tant que la couche n'était pas déjà refusée.
  assert.notEqual(evaluerCouche({ ...commun, actives: ['ess-un', 'ess-un-bis'] }).verdict, 'non')
  // Le même calcul, mais la couche était refusée à l'image d'avant : elle
  // reste refusée tant qu'il n'y a pas une part de marge en plus. Sans ça, un
  // budget qui oscille d'une part fait clignoter tout le panneau.
  const collant = evaluerCouche({ ...commun, actives: ['ess-un', 'ess-un-bis'], bloqueePrecedemment: true })
  assert.equal(collant.verdict, 'non')
  assert.match(collant.raison, /marge|hystér|clignot/i)
  // Une part libérée de plus, et elle revient.
  const revenue = evaluerCouche({ ...commun, actives: ['ess-un'], bloqueePrecedemment: true })
  assert.notEqual(revenue.verdict, 'non')
})

test('evaluerCouche : la marge de déblocage ne s’applique QU’au retour, jamais au premier allumage', () => {
  const commun = { id: 'ess-deux', actives: ['ess-un', 'ess-un-bis'], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI }
  assert.notEqual(evaluerCouche({ ...commun, bloqueePrecedemment: false }).verdict, 'non')
  assert.equal(evaluerCouche({ ...commun, bloqueePrecedemment: true }).verdict, 'non')
})

// ═══════════ « QUE DOIS-JE ÉTEINDRE ? » ═════════════════════════════════════

test('aRetirerPour propose le SACRIFICE LE PLUS PETIT qui suffise', () => {
  // capacité 4 (ALLÉGÉ). Allumées : 1 + 1 + 2 = 4, c'est-à-dire plein. Ajouter
  // la couche à 3 parts demande donc d'en libérer 3, et AUCUNE des allumées n'en
  // rend 3 à elle seule : il faut en éteindre deux.
  //
  // ⚠️ CE SCÉNARIO A DÉJÀ ÉTÉ VIDÉ DE SON SENS UNE FOIS, EN SILENCE. Il visait
  // « canopee » et son coût écrit en dur (3) ; le 2026-08-02 la canopée est
  // passée à 2 parts, et le test s'est mis à demander 2 — ce que les lumières
  // nocturnes rendaient À ELLES SEULES. Il ne testait plus « le plus petit
  // sacrifice quand il en faut deux », il testait le cas trivial, sans qu'une
  // seule assertion ne rougisse.
  //
  // C'est précisément pour ça que le scénario vit maintenant sur ESSAI, qui ne
  // bouge pas : le catalogue réel peut changer de coûts sans rendre ce test
  // muet — ni faux.
  const r = aRetirerPour({ id: 'ess-trois', actives: ['ess-un', 'ess-un-bis', 'ess-deux'], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
  // Les plus CHÈRES d'abord, pour en éteindre le moins possible : 2 + 1 = 3.
  // Éteindre les deux couches à 1 part n'aurait rendu que 2, il en aurait fallu
  // une troisième.
  assert.deepEqual(r, ['ess-deux', 'ess-un-bis'])
  assert.equal(r.reduce((s, id) => s + coutCouche(id, ESSAI), 0), 3)
})

test('aRetirerPour préfère UNE couche qui suffit à elle seule plutôt que d’en éteindre deux', () => {
  // capacité 4 (ALLÉGÉ), une seule allumée à 4 parts. Ajouter 1 part demande
  // d'en libérer 1, et la seule allumée y pourvoit.
  const r = aRetirerPour({ id: 'ess-un', actives: ['ess-quatre'], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
  assert.deepEqual(r, ['ess-quatre'])
})

test('aRetirerPour : parmi celles qui suffisent SEULES, il sacrifie la MOINS chère', () => {
  // « on ne sacrifie pas les sentiers pour libérer une part quand les étoiles y
  // pourvoient » — la phrase de l'en-tête de choisirSacrifice, mise à l'épreuve.
  // capacité 6 (ÉQUILIBRÉ), allumées 1 + 4 = 5 ; ajouter 2 demande 1 part.
  // Les DEUX allumées suffisent seules ; c'est la couche à 1 part qui doit y
  // passer, pas celle à 4.
  const r = aRetirerPour({ id: 'ess-deux', actives: ['ess-un', 'ess-quatre'], machine: PALIERS[1], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
  assert.deepEqual(r, ['ess-un'])
})

test('aRetirerPour : à coût égal, c’est l’ORDRE DU CATALOGUE qui tranche, jamais le hasard', () => {
  // Deux couches à 1 part sont allumées et suffisent chacune. Si le départage
  // n'était pas déterministe, le libellé du bouton d'échange changerait tout
  // seul d'une image à l'autre sous les yeux du visiteur.
  const commun = { id: 'ess-deux', machine: PALIERS[1], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI }
  // capacité 6, allumées 1 + 1 + 4 = 6 ; ajouter 2 demande 2 parts… non : on
  // vise le cas « 1 part à libérer » en n'allumant que 1 + 4 + 1 = 6 → déficit 2.
  // Une couche à 1 part ne suffit alors plus seule, la couche à 4 si.
  assert.deepEqual(aRetirerPour({ ...commun, actives: ['ess-un', 'ess-un-bis', 'ess-quatre'] }), ['ess-quatre'])
  // Et sur un déficit d'UNE part, l'égalité entre les deux couches à 1 part est
  // tranchée par leur rang : la première du catalogue.
  assert.deepEqual(aRetirerPour({ ...commun, actives: ['ess-un', 'ess-un-bis', 'ess-trois'] }), ['ess-un'])
  assert.deepEqual(aRetirerPour({ ...commun, actives: ['ess-un-bis', 'ess-un', 'ess-trois'] }), ['ess-un'], 'l’ordre de la liste des allumées ne doit rien changer')
})

test('aRetirerPour rend une liste vide s’il n’y a rien à éteindre — le refus vient alors de la machine', () => {
  // palier ESSENTIEL, 2 parts, rien d'allumé, et la couche visée en coûte 4.
  // Aucune permutation ne sauve ce cas : la couche est hors de portée.
  const r = aRetirerPour({ id: 'ess-quatre', actives: [], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 }, catalogue: ESSAI })
  assert.deepEqual(r, [])
})

test('evaluerCouche : quand rien à éteindre ne suffit, la raison le DIT au lieu de proposer une liste vide sans mot', () => {
  const r = evaluerCouche({ id: 'ess-quatre', actives: [], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 }, catalogue: ESSAI })
  assert.equal(r.verdict, 'non')
  assert.deepEqual(r.aRetirer, [])
  assert.match(r.raison, /machine|hors de portée|à elle seule/i)
})

// ═══════════ L'ÉCHAPPATOIRE ═════════════════════════════════════════════════

test('desarmeUrl : « 0 » désarme, et TOUT le reste laisse le gardien armé', () => {
  assert.equal(desarmeUrl('0'), true)
  // ⚠️ Même règle que forceUrl : ce qui n'est pas exactement la valeur attendue
  // est une ABSENCE, pas une erreur. Un lien mal recopié ne doit pas désarmer
  // le seul système qui empêche la page de mourir.
  for (const rien of [null, undefined, '', '1', 'oui', 'false', ' 0', 'off']) {
    assert.equal(desarmeUrl(rien), false, `« ${rien} » ne doit pas désarmer`)
  }
})

test('gardien désarmé : plus aucun refus, mais plus jamais de silence non plus', () => {
  const commun = { id: 'ess-quatre', actives: [], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 }, catalogue: ESSAI }
  const arme = evaluerCouche(commun)
  assert.equal(arme.verdict, 'non')
  const desarme = evaluerCouche({ ...commun, desarme: true })
  assert.equal(desarme.verdict, 'oui-avec-avertissement')
  assert.equal(desarme.desarme, true)
  // La raison qu'aurait rendue le gardien armé reste LISIBLE : c'est tout
  // l'intérêt de l'échappatoire — mesurer la panne qu'on s'apprête à provoquer.
  assert.ok(desarme.raison.includes(arme.raison) || desarme.raison.length > arme.raison.length)
})

test('gardien désarmé : un « oui » franc reste un « oui » franc, sans avertissement parasite', () => {
  const r = evaluerCouche({ id: 'ess-un', actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 }, desarme: true, catalogue: ESSAI })
  assert.equal(r.verdict, 'oui')
})

// ═══════════ L'ÉTAT COMPLET POUR L'ONGLET « COUCHES » ═══════════════════════

test('etatCouches rend tout le panneau d’un coup : budget, souffrance, et une ligne par couche', () => {
  const e = etatCouches({ actives: ['ess-deux'], machine: PALIERS[1], gouverneur: { tier: 2, startTier: 1 }, catalogue: ESSAI })
  assert.equal(e.budget.capacite, 3) // 6 parts, un cran perdu → 3
  assert.equal(e.souffrance.crans, 1)
  assert.ok(e.souffrance.raison.length > 0)
  assert.equal(e.desarme, false)
  assert.equal(e.couches.length, ESSAI.length)
  for (const c of e.couches) {
    assert.ok(['oui', 'oui-avec-avertissement', 'non'].includes(c.verdict), `${c.id} : verdict ${c.verdict}`)
    assert.ok(c.raison.length > 0, `${c.id} : pas de raison`)
    assert.ok(Array.isArray(c.aRetirer))
    assert.equal(typeof c.active, 'boolean')
  }
  assert.equal(e.couches.find((c) => c.id === 'ess-deux').active, true)
})

test('etatCouches : le jeu de couches bloquées à l’image d’avant porte l’hystérésis', () => {
  const commun = { actives: ['ess-un', 'ess-un-bis'], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI }
  const libre = etatCouches(commun).couches.find((c) => c.id === 'ess-deux')
  const collee = etatCouches({ ...commun, bloquees: ['ess-deux'] }).couches.find((c) => c.id === 'ess-deux')
  assert.notEqual(libre.verdict, 'non')
  assert.equal(collee.verdict, 'non')
})

test('etatCouches : ce qui est allumé le reste, quoi qu’il arrive au budget', () => {
  // Le gouverneur s'est effondré APRÈS l'allumage : le gardien constate le
  // dépassement, il ne l'annule pas.
  const e = etatCouches({ actives: ['ess-deux', 'ess-trois'], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 0 }, catalogue: ESSAI })
  assert.ok(e.budget.depassement > 0)
  for (const id of ['ess-deux', 'ess-trois']) {
    assert.equal(e.couches.find((c) => c.id === id).verdict, 'oui', `${id} ne doit pas être éteinte par le gardien`)
  }
})

// ═══════════ `aProduire` — LE GARDE-FOU DES INTERRUPTEURS QUI MENTENT ═══════
//
// ⚠️ AUCUNE COUCHE RÉELLE NE PORTE CE DRAPEAU DEPUIS LE 2026-08-02, ET CES
// TESTS RESTENT. Ce n'est pas du code mort : c'est ce qui a empêché CINQ
// interrupteurs de s'allumer sans rien peindre. La prochaine couche naîtra avec
// — on écrit toujours l'entrée du catalogue (donc le coût, qui se discute) avant
// d'écrire le rendu.
//
// Ces trois tests s'éprouvent donc sur ESSAI, qui garde une entrée sans rendu à
// demeure. C'est ce qui leur permet d'exister alors que le catalogue réel, lui,
// n'en a plus.

test('aProduire : une couche sans rendu est refusée, même quand le budget est grand ouvert', () => {
  // Machine la plus forte, rien d'allumé : 12 parts pour une couche qui en coûte
  // 1. Le budget dit oui — et pourtant c'est non, parce qu'il n'y a rien à
  // peindre. Ce refus-là ne parle pas de puissance.
  const c = etatCouches({ actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
    .couches.find((x) => x.id === 'ess-sans-rendu')
  assert.equal(c.verdict, 'non')
  assert.equal(c.aProduire, true)
  assert.match(c.raison, /rendu|peindrait/i, 'le refus doit dire que rien ne serait peint, pas que la machine est faible')
  assert.deepEqual(c.aRetirer, [], 'aucun échange ne peut débloquer une couche qui n’a pas de rendu')
})

test('aProduire : le désarmement du gardien ne lève PAS ce refus-là', () => {
  // `?gardien=0` désarme le BUDGET, pas la réalité. Forcer l'allumage d'une
  // couche sans rendu ne montrerait rien et se lirait comme une panne.
  const c = etatCouches({ actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 }, desarme: true, catalogue: ESSAI })
    .couches.find((x) => x.id === 'ess-sans-rendu')
  assert.equal(c.verdict, 'non')
})

test('aProduire : une couche sans rendu n’est jamais rendue ACTIVE, même listée dans les allumées', () => {
  // Le cas arrive par un gabarit sauvegardé avant le retrait d'une couche : son
  // identifiant traîne dans la liste des actives. L'interrupteur ne doit pas
  // s'allumer pour autant.
  const c = etatCouches({ actives: ['ess-sans-rendu'], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 }, catalogue: ESSAI })
    .couches.find((x) => x.id === 'ess-sans-rendu')
  assert.equal(c.active, false)
  assert.equal(c.verdict, 'non')
})

// ═══════════ L'ONGLET RÉEL — celui-ci DOIT suivre l'inventaire ══════════════

test('etatCouches : sur une machine ESSENTIEL, l’onglet reste UTILISABLE — au moins une couche allumable', () => {
  // ⚠️ CE TEST INTERROGE LE VRAI CATALOGUE, ET C'EST VOULU. Un onglet où tout
  // est gris est un onglet qu'il ne fallait pas ouvrir. Le catalogue doit
  // toujours porter au moins une couche qui tient dans les 2 parts de la
  // machine la plus faible — c'est une contrainte sur l'INVENTAIRE, pas sur la
  // règle, donc elle se vérifie sur l'inventaire.
  const e = etatCouches({ actives: [], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 } })
  assert.ok(e.couches.some((c) => c.verdict !== 'non'), 'aucune couche allumable au palier plancher')
})

test('etatCouches : les trois couches réelles s’allument toutes sur une machine confortable', () => {
  // Le panneau qu'Adrien doit voir : trois lignes, trois interrupteurs
  // cliquables, budget entier (2 + 3 + 2 = 7 parts pour 12 disponibles).
  const e = etatCouches({ actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 } })
  assert.equal(e.couches.length, 3)
  for (const c of e.couches) assert.notEqual(c.verdict, 'non', `« ${c.id} » refusée sur la meilleure machine`)
  assert.equal(etatBudget({ actives: COUCHES.map((c) => c.id), machine: PALIERS[0] }).depassement, 0)
})

// ═══════════ LE REGROUPEMENT — l'identité unique ════════════════════════════

test('PROTECTIONS recense les garde-fous existants, chacun avec son critère et sa cible', () => {
  assert.ok(PROTECTIONS.length >= 12, 'le recensement doit couvrir les garde-fous connus')
  const vus = new Set()
  for (const p of PROTECTIONS) {
    assert.ok(typeof p.cle === 'string' && p.cle.length > 0)
    assert.equal(vus.has(p.cle), false, `clé en double : ${p.cle}`)
    vus.add(p.cle)
    for (const champ of ['module', 'identifiant', 'protege', 'contre', 'critere']) {
      assert.ok(typeof p[champ] === 'string' && p[champ].length > 0, `${p.cle} : champ « ${champ} » manquant`)
    }
    assert.equal(typeof p.pur, 'boolean', `${p.cle} : la pureté doit être dite`)
  }
})

test('PROTECTIONS : chaque module recensé EXISTE et porte encore l’identifiant annoncé', () => {
  // ⚠️ C'EST LE TEST QUI DONNE SA VALEUR AU REGROUPEMENT. Sans lui, la liste
  // ci-dessus deviendrait de la documentation périmée en trois commits — et une
  // documentation périmée sur un système de sécurité est pire que rien : elle
  // fait croire qu'on est protégé. Ici, renommer une constante ou supprimer un
  // garde-fou casse ce test, et celui qui l'a fait l'apprend tout de suite.
  for (const p of PROTECTIONS) {
    const abs = path.join(ROOT, p.module)
    assert.ok(fs.existsSync(abs), `${p.cle} : module introuvable — ${p.module}`)
    const src = fs.readFileSync(abs, 'utf8')
    assert.ok(src.includes(p.identifiant), `${p.cle} : « ${p.identifiant} » a disparu de ${p.module}`)
  }
})

test('le gardien réexporte les protections existantes SANS en changer le comportement', () => {
  // Regrouper, c'est donner une adresse unique — pas réécrire. Si l'une de ces
  // fonctions se met à répondre autre chose, ce n'est pas un regroupement,
  // c'est un bug.
  assert.equal(machinePorteContinu(PALIERS[3]).porte, false)
  assert.equal(machinePorteContinu(PALIERS[2]).porte, true)
  assert.equal(palierVise(3, 0), 3)
  assert.equal(palierVise(60, 1), 1)
  assert.equal(echantillonRetenu(1.2, false).garde, false)
  assert.equal(echantillonRetenu(1.2, true).garde, true)
})

// ═══════════ LA PURETÉ ══════════════════════════════════════════════════════

test('src/gardien.js est PUR : ni three, ni DOM, ni location, ni localStorage', () => {
  // Le fait que ce fichier de test s'exécute sous node le prouve déjà pour
  // l'essentiel ; cette lecture-ci verrouille l'intention, y compris pour du
  // code qui ne serait touché par aucun test.
  const src = fs.readFileSync(path.join(ROOT, 'src/gardien.js'), 'utf8')
  const nu = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const interdit of ['three', 'document', 'window.', 'localStorage', 'location.', 'navigator.', 'performance.']) {
    assert.equal(nu.includes(interdit), false, `gardien.js ne doit pas mentionner « ${interdit} » hors commentaire`)
  }
})

test('test/gardien.test.js est bien listé dans la ligne « test » de package.json', () => {
  // ⚠️ SUR CE PROJET, UN TEST NON LISTÉ N'EST JAMAIS LANCÉ. C'est arrivé
  // plusieurs fois. Et sans `node --test`, node n'exécute que le PREMIER
  // fichier de la liste, en silence.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  assert.ok(pkg.scripts.test.startsWith('node --test '), 'la ligne test doit commencer par « node --test »')
  assert.ok(pkg.scripts.test.includes('test/gardien.test.js'), 'test/gardien.test.js absent de la ligne test')
})
