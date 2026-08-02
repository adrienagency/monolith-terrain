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

// ═══════════ LE CATALOGUE ════════════════════════════════════════════════════

test('le catalogue déclare des coûts FIXES, entiers, positifs, et des identifiants uniques', () => {
  assert.ok(COUCHES.length >= 7, 'les sept couches annoncées par Adrien doivent être là')
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

test('les sept couches demandées par Adrien sont au catalogue', () => {
  const ids = COUCHES.map((c) => c.id)
  for (const attendu of ['etoiles', 'volcans', 'lumieres-nocturnes', 'occupation-sol', 'canopee', 'pistes-ski', 'sentiers']) {
    assert.ok(ids.includes(attendu), `couche « ${attendu} » absente du catalogue`)
  }
})

test('couche() et coutCouche() : un identifiant inconnu ne lève pas et ne coûte rien de gratuit', () => {
  assert.equal(couche('nawak'), null)
  // ⚠️ Un inconnu coûte le MAXIMUM du catalogue, pas 0. Une couche ajoutée sans
  // entrée au catalogue ne doit pas devenir gratuite par accident : c'est
  // exactement le chemin silencieux par lequel un budget se vide.
  const maxi = Math.max(...COUCHES.map((c) => c.cout))
  assert.equal(coutCouche('nawak'), maxi)
  assert.equal(coutCouche('etoiles'), couche('etoiles').cout)
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

// ═══════════ LA COMPTABILITÉ ═════════════════════════════════════════════════

test('occupationParts additionne le coût des couches allumées et ignore les inconnues des listes vides', () => {
  assert.equal(occupationParts([]), 0)
  assert.equal(occupationParts(null), 0)
  assert.equal(occupationParts(['etoiles', 'volcans']), coutCouche('etoiles') + coutCouche('volcans'))
  // Une couche listée deux fois ne se paie qu'une fois : la liste décrit un
  // ENSEMBLE d'interrupteurs, pas une file.
  assert.equal(occupationParts(['etoiles', 'etoiles']), coutCouche('etoiles'))
})

test('etatBudget rend de quoi dessiner une jauge, et une phrase lisible', () => {
  const b = etatBudget({ actives: ['sentiers'], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 } })
  assert.equal(b.capacite, 12)
  assert.equal(b.occupation, coutCouche('sentiers'))
  assert.equal(b.restant, 12 - coutCouche('sentiers'))
  assert.ok(b.fraction > 0 && b.fraction < 1)
  assert.ok(typeof b.resume === 'string' && b.resume.length > 0)
  assert.equal(b.tendu, false)
})

test('etatBudget : la jauge ne déborde jamais, même si l’occupation dépasse la capacité', () => {
  // Cas réel : les couches sont allumées, PUIS le gouverneur descend d'un cran
  // et la capacité fond. Le gardien n'éteint rien de lui-même (il ne retire
  // jamais ce que le visiteur a choisi) — mais la jauge doit rester dessinable.
  const b = etatBudget({ actives: ['sentiers', 'canopee', 'occupation-sol'], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 } })
  assert.ok(b.occupation > b.capacite)
  assert.equal(b.fraction, 1)
  assert.equal(b.restant, 0, 'le restant se plancherise à 0, il ne devient pas négatif')
  assert.equal(b.depassement, b.occupation - b.capacite)
  assert.equal(b.tendu, true)
})

test('etatBudget : « tendu » s’allume dès qu’il reste MARGE_TENDU parts ou moins', () => {
  const g = { tier: 0, startTier: 0 }
  // capacité 4 (palier ALLÉGÉ) ; on remplit à 3 → il reste 1
  const b = etatBudget({ actives: ['occupation-sol'], machine: PALIERS[2], gouverneur: g })
  assert.equal(b.restant, 1)
  assert.equal(MARGE_TENDU, 1)
  assert.equal(b.tendu, true)
})

// ═══════════ LE VERDICT — trois réponses, jamais un refus muet ══════════════

test('evaluerCouche rend « oui » quand la place est franche, avec une raison chiffrée', () => {
  const r = evaluerCouche({ id: 'etoiles', actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 } })
  assert.equal(r.verdict, 'oui')
  assert.equal(r.cout, 1)
  assert.equal(r.restantApres, 11)
  assert.match(r.raison, /\d/, 'la raison doit porter des chiffres')
  assert.deepEqual(r.aRetirer, [])
})

test('evaluerCouche rend « oui-avec-avertissement » quand allumer vide le budget', () => {
  // palier ALLÉGÉ : 4 parts. « occupation-sol » coûte 3 → il reste 1.
  const r = evaluerCouche({ id: 'occupation-sol', actives: [], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 } })
  assert.equal(r.verdict, 'oui-avec-avertissement')
  assert.equal(r.restantApres, 1)
  assert.ok(r.raison.length > 0)
})

test('evaluerCouche rend « non » AVEC une raison ET la liste de ce qu’il faut éteindre', () => {
  // palier ESSENTIEL : 2 parts. « sentiers » en coûte 4, rien ne passe.
  const r = evaluerCouche({ id: 'sentiers', actives: ['etoiles'], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 } })
  assert.equal(r.verdict, 'non')
  assert.ok(r.raison.length > 0, 'un refus muet est explicitement écarté')
  assert.match(r.raison, /\d/)
  assert.ok(Array.isArray(r.aRetirer))
})

test('evaluerCouche : une couche DÉJÀ allumée est toujours « oui » — le gardien n’éteint rien', () => {
  // Le gardien refuse d'ALLUMER ; il ne retire jamais ce que le visiteur a déjà
  // choisi. Même règle que les drapeaux `dirty` de perf.js : une fois que
  // l'humain a la main sur un levier, l'automate ne la reprend pas.
  const r = evaluerCouche({ id: 'sentiers', actives: ['sentiers', 'canopee'], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 } })
  assert.equal(r.verdict, 'oui')
  assert.equal(r.deja, true)
})

test('evaluerCouche : un identifiant inconnu est refusé, pas ignoré', () => {
  const r = evaluerCouche({ id: 'nawak', actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 } })
  assert.equal(r.verdict, 'non')
  assert.match(r.raison, /catalogue/i)
})

// ═══════════ L'HYSTÉRÉSIS — une marge entre bloquer et débloquer ════════════

test('evaluerCouche : une couche déjà refusée exige MARGE_DEBLOCAGE parts de plus pour revenir', () => {
  assert.equal(MARGE_DEBLOCAGE, 1)
  const commun = { id: 'lumieres-nocturnes', machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 } } // capacité 4, coût 2
  // Occupation 2 (volcans 1 + etoiles 1) → 2 + 2 = 4 = capacité : ça passe
  // TOUT JUSTE, tant que la couche n'était pas déjà refusée.
  assert.notEqual(evaluerCouche({ ...commun, actives: ['volcans', 'etoiles'] }).verdict, 'non')
  // Le même calcul, mais la couche était refusée à l'image d'avant : elle
  // reste refusée tant qu'il n'y a pas une part de marge en plus. Sans ça, un
  // budget qui oscille d'une part fait clignoter tout le panneau.
  const collant = evaluerCouche({ ...commun, actives: ['volcans', 'etoiles'], bloqueePrecedemment: true })
  assert.equal(collant.verdict, 'non')
  assert.match(collant.raison, /marge|hystér|clignot/i)
  // Une part libérée de plus, et elle revient.
  const revenue = evaluerCouche({ ...commun, actives: ['etoiles'], bloqueePrecedemment: true })
  assert.notEqual(revenue.verdict, 'non')
})

test('evaluerCouche : la marge de déblocage ne s’applique QU’au retour, jamais au premier allumage', () => {
  const commun = { id: 'lumieres-nocturnes', actives: ['volcans', 'etoiles'], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 } }
  assert.notEqual(evaluerCouche({ ...commun, bloqueePrecedemment: false }).verdict, 'non')
  assert.equal(evaluerCouche({ ...commun, bloqueePrecedemment: true }).verdict, 'non')
})

// ═══════════ « QUE DOIS-JE ÉTEINDRE ? » ═════════════════════════════════════

test('aRetirerPour propose le SACRIFICE LE PLUS PETIT qui suffise', () => {
  // capacité 4 (ALLÉGÉ). Allumées : etoiles (1) + volcans (1) + lumières (2) = 4,
  // c'est-à-dire plein. Ajouter « occupation-sol » (3) demande donc de libérer
  // 3 parts, et aucune couche allumée n'en rend 3 à elle seule.
  //
  // ⚠️ CE TEST INTERROGEAIT « canopee » ET SON COÛT EN DUR (3). Le 2026-08-02 la
  // canopée est passée à 2 parts — elle s'est révélée être une couleur drapée et
  // non du relief lu par le processeur (voir sa note au catalogue). Le test
  // demandait alors 2 parts, ce que les lumières nocturnes rendent À ELLES
  // SEULES : il ne testait plus « le sacrifice le plus petit quand il en faut
  // deux », il testait le cas trivial, sans qu'une assertion ne rougisse.
  //
  // On vise donc la couche qui coûte VRAIMENT 3 aujourd'hui, et on lit le besoin
  // depuis le catalogue plutôt que de le recopier : le jour où un autre coût
  // bouge, ce test dira lequel au lieu de mentir.
  const besoin = coutCouche('occupation-sol')
  assert.equal(besoin, 3, 'le scénario suppose une couche à 3 parts ; sinon il ne teste plus rien')
  const r = aRetirerPour({ id: 'occupation-sol', actives: ['etoiles', 'volcans', 'lumieres-nocturnes'], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 } })
  assert.ok(r.length >= 1)
  const libere = r.reduce((s, id) => s + coutCouche(id), 0)
  assert.ok(libere >= besoin, `la proposition doit vraiment libérer la place (libère ${libere}, il en faut ${besoin})`)
  for (const id of r) assert.ok(['etoiles', 'volcans', 'lumieres-nocturnes'].includes(id), `${id} n'est pas allumée`)
})

test('aRetirerPour préfère UNE couche qui suffit à elle seule plutôt que d’en éteindre deux', () => {
  // capacité 12 (PLEINE QUALITÉ), allumées : sentiers (4) + etoiles (1) = 5.
  // On veut ajouter de quoi dépasser : on force en descendant la capacité.
  // Ici capacité 4 et actives sentiers(4) : ajouter etoiles(1) demande 1 part.
  // « sentiers » suffit à lui seul — et c'est la seule allumée.
  const r = aRetirerPour({ id: 'etoiles', actives: ['sentiers'], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 } })
  assert.deepEqual(r, ['sentiers'])
})

test('aRetirerPour rend une liste vide s’il n’y a rien à éteindre — le refus vient alors de la machine', () => {
  // palier ESSENTIEL, 2 parts, rien d'allumé, et « sentiers » en coûte 4.
  // Aucune permutation ne sauve ce cas : la couche est hors de portée.
  const r = aRetirerPour({ id: 'sentiers', actives: [], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 } })
  assert.deepEqual(r, [])
})

test('evaluerCouche : quand rien à éteindre ne suffit, la raison le DIT au lieu de proposer une liste vide sans mot', () => {
  const r = evaluerCouche({ id: 'sentiers', actives: [], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 } })
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
  const commun = { id: 'sentiers', actives: [], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 } }
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
  const r = evaluerCouche({ id: 'etoiles', actives: [], machine: PALIERS[0], gouverneur: { tier: 0, startTier: 0 }, desarme: true })
  assert.equal(r.verdict, 'oui')
})

// ═══════════ L'ÉTAT COMPLET POUR L'ONGLET « COUCHES » ═══════════════════════

test('etatCouches rend tout le panneau d’un coup : budget, souffrance, et une ligne par couche', () => {
  // ⚠️ `lumieres-nocturnes` et PAS `etoiles` : depuis le 2026-08-02 les couches
  // sans rendu portent `aProduire` et sont refusées d'office par etatCouches.
  // Les prendre pour exemple ferait tester le refus au lieu du budget.
  const e = etatCouches({ actives: ['lumieres-nocturnes'], machine: PALIERS[1], gouverneur: { tier: 2, startTier: 1 } })
  assert.equal(e.budget.capacite, 3) // 6 parts, un cran perdu → 3
  assert.equal(e.souffrance.crans, 1)
  assert.ok(e.souffrance.raison.length > 0)
  assert.equal(e.desarme, false)
  assert.equal(e.couches.length, COUCHES.length)
  for (const c of e.couches) {
    assert.ok(['oui', 'oui-avec-avertissement', 'non'].includes(c.verdict), `${c.id} : verdict ${c.verdict}`)
    assert.ok(c.raison.length > 0, `${c.id} : pas de raison`)
    assert.ok(Array.isArray(c.aRetirer))
    assert.equal(typeof c.active, 'boolean')
  }
  assert.equal(e.couches.find((c) => c.id === 'lumieres-nocturnes').active, true)
  // Une couche sans rendu n'est jamais rendue active, même listée dans actives.
  assert.equal(e.couches.find((c) => c.id === 'etoiles').verdict, 'non')
})

test('etatCouches : le jeu de couches bloquées à l’image d’avant porte l’hystérésis', () => {
  const commun = { actives: ['volcans', 'etoiles'], machine: PALIERS[2], gouverneur: { tier: 0, startTier: 0 } }
  const libre = etatCouches(commun).couches.find((c) => c.id === 'lumieres-nocturnes')
  const collee = etatCouches({ ...commun, bloquees: ['lumieres-nocturnes'] }).couches.find((c) => c.id === 'lumieres-nocturnes')
  assert.notEqual(libre.verdict, 'non')
  assert.equal(collee.verdict, 'non')
})

test('etatCouches : sur une machine ESSENTIEL, l’onglet reste UTILISABLE — au moins une couche allumable', () => {
  // Un onglet où tout est gris est un onglet qu'il ne fallait pas ouvrir. Le
  // catalogue doit toujours porter au moins une couche qui tient dans 2 parts.
  const e = etatCouches({ actives: [], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 3 } })
  assert.ok(e.couches.some((c) => c.verdict !== 'non'), 'aucune couche allumable au palier plancher')
})

test('etatCouches : ce qui est allumé le reste, quoi qu’il arrive au budget', () => {
  // Le gouverneur s'est effondré APRÈS l'allumage : le gardien constate le
  // dépassement, il ne l'annule pas.
  // idem : deux couches qui PEIGNENT, sinon on teste `aProduire`.
  const e = etatCouches({ actives: ['lumieres-nocturnes', 'occupation-sol'], machine: PALIERS[3], gouverneur: { tier: 3, startTier: 0 } })
  assert.ok(e.budget.depassement > 0)
  for (const id of ['lumieres-nocturnes', 'occupation-sol']) {
    assert.equal(e.couches.find((c) => c.id === id).verdict, 'oui', `${id} ne doit pas être éteinte par le gardien`)
  }
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
