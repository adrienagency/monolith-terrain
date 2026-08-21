// LA CHAÎNE DU CROP, BRANCHÉE — Tâche I du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ POURQUOI CE FICHIER EXISTE ══════════════════════════════════════
//
// Les Tâches A à G ont livré `poserCrop`, `construireParoisCrop`,
// `poserHabillage`, `poserRampe`, `poserMer` et `poserEstompage`. **Personne ne
// les appelait.** Compté le 2026-08-21 dans `src/` hors `globe.js` : zéro
// appelant de production pour les cinq premières, un seul pour la sixième. Et
// c'est **Adrien qui l'a vu à l'écran** — l'application se comportait exactement
// comme avant le chantier : « j'ai l'impression de ne pas être sur le bon
// serveur ». Il était sur le bon serveur ; le plan n'avait pas de tâche qui
// branche.
//
// ⚠️ **CE FICHIER GARDE LE BRANCHEMENT, PAS LES LOIS.** Les seuils et
// l'hystérésis sont gardés par `test/seuil-socle.test.js` ; la découpe par
// `test/crop-sphere.test.js` ; les parois, l'habillage, la rampe, la mer et
// l'estompage par leurs cinq fichiers. **Rien n'est recopié d'ici.** Ce qui est
// gardé ici, c'est ce qui manquait : **que la descente APPELLE réellement la
// chaîne**, dans un ordre où chaque maillon trouve le crop déjà posé.
//
// ⚠️ **UN TEST QUI VÉRIFIE QU'UNE FONCTION EXISTE NE MORD PAS.** Ce chantier a
// vu un corps de 150 lignes passer 44 tests verts sans être exercé une seule
// fois — trouvé par un relecteur qui a échangé un `Math.min` et un `Math.max`
// sans faire rougir quoi que ce soit. Le globe factice de ce fichier **REFUSE**
// tout maillon appelé avant `poserCrop` : l'ordre n'est donc pas gardé par une
// chaîne de caractères, il est gardé par le comportement.
//
// ⚠️ **LE CÂBLAGE DE `main.js` SE GARDE PAR LECTURE DU SOURCE** — aucun test ne
// charge ce fichier (§0 du plan), précédent explicite de `test/seuil-branche.test.js`
// et de onze autres fichiers de ce dossier.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { creerVeilleCrop, poserChaineCrop, MAILLONS } from '../src/monde/branchement-crop.js'
import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_MAIN = fs.readFileSync(path.join(RACINE, 'src/main.js'), 'utf8')
const SRC_FLAGS = fs.readFileSync(path.join(RACINE, 'src/flags.js'), 'utf8')

// ══════════ LE GLOBE FACTICE — IL REFUSE, IL NE FAIT PAS SEMBLANT ═══════════
//
// Il porte exactement ce que la chaîne lit et écrit, et **il se comporte comme
// le vrai sur le seul point qui compte pour l'ordre** : les quatre maillons qui
// suivent la découpe rendent `null` ou un refus tant que `_crop` est nul, comme
// `construireParoisCrop`, `poserRampe` et `poserMer` le font en tête de corps.
function globeFactice({ refuse = {} } = {}) {
  const j = []
  const g = {
    _crop: null,
    journal: j,
    refuse: { parois: false, rampe: false, mer: false, ...refuse },
    poserCrop(a) {
      j.push({ quoi: 'crop', centre: a?.centre, zoom: a?.zoom, tuilesParBloc: a?.tuilesParBloc })
      g._crop = { cx: 0.5, cy: 0.35, demi: a.tuilesParBloc / 2 / 2 ** a.zoom, zoom: a.zoom }
      return g._crop
    },
    construireParoisCrop(a) {
      j.push({ quoi: 'parois', arg: a })
      if (!g._crop) return null
      return g.refuse.parois ? { mesh: null, refus: 'couverture' } : { mesh: {}, refus: null, couverture: 1 }
    },
    poserHabillage(a) {
      j.push({ quoi: 'habillage', arg: a, avecCrop: !!g._crop })
      return a
    },
    poserRampe(a) {
      j.push({ quoi: 'rampe', arg: a })
      if (!g._crop) return { refus: 'crop', echelle: null, mesure: null }
      return g.refuse.rampe ? { refus: 'couverture', echelle: null } : { refus: null, echelle: {} }
    },
    async poserMer(a) {
      j.push({ quoi: 'mer', arg: a })
      if (!g._crop) return null
      return g.refuse.mer ? { refus: 'champ', portee: 4 } : { portee: 4, couverture: 1 }
    },
    retirerCrop() {
      j.push({ quoi: 'retirer' })
      g._crop = null
    },
  }
  return g
}

const quoi = (g) => g.journal.map((e) => e.quoi)

// Un contexte de branchement minimal — celui que `main.js` fabrique.
function contexteFactice(centre = { lat: 45.9, lon: 6.87 }, zoom = 12) {
  return () => ({
    centre,
    zoom,
    tuilesParBloc: 3,
    habillage: { coastMask: 'masque', amplitudeM: 2400 },
    mer: { altitudeM: 12_000, fovDeg: 33, hauteurPx: 900 },
  })
}

// Un mouchard d'estompage : il note ce que la veille du crop lui relaie.
function estompageFactice() {
  const alt = []
  const modes = []
  return { alt, modes, maj: (a) => alt.push(a), poserMode: (v) => modes.push(v) }
}

// ══════════ ① LA CHAÎNE ENTIÈRE, APPELÉE — ET DANS UN ORDRE QUI TIENT ═══════

test('① `poserChaineCrop` appelle les CINQ maillons, la découpe en premier', async () => {
  const g = globeFactice()
  const r = poserChaineCrop({ globe: g, ...contexteFactice()() })
  assert.deepEqual(quoi(g), ['crop', 'parois', 'habillage', 'rampe', 'mer'],
    'les cinq maillons doivent être appelés, et la découpe AVANT les quatre autres')
  // ⚠️ et le comportement le prouve : aucun des quatre suivants n'a refusé
  assert.deepEqual(r.refus, [], 'un maillon appelé avant la découpe aurait refusé')
  assert.ok(g.journal[2].avecCrop, 'l’habillage doit trouver le crop posé — il en tire `uMargeCoteM`')
  await r.mer
})

test('① bis la liste des maillons est celle que le globe expose', () => {
  assert.deepEqual(MAILLONS, ['crop', 'parois', 'habillage', 'rampe', 'mer'])
})

test('① ter les bornes du crop sont CELLES DU CONTEXTE, pas des constantes locales', () => {
  // ⚠️ **C'EST LE POINT QUI FAIT COÏNCIDER LE CROP ET LE BLOC.** Si la chaîne
  // posait son propre centre ou son propre zoom, la découpe tomberait à côté du
  // bloc que la similitude de la passe de fond aligne — et ce serait invisible
  // partout sauf à l'écran.
  const g = globeFactice()
  poserChaineCrop({ globe: g, centre: { lat: -21.1, lon: 55.5 }, zoom: 13.25, tuilesParBloc: 3 })
  assert.deepEqual(g.journal[0], {
    quoi: 'crop', centre: { lat: -21.1, lon: 55.5 }, zoom: 13.25, tuilesParBloc: 3,
  })
})

test('① quater ce que chaque maillon reçoit vient du contexte, pas d’un défaut', () => {
  const g = globeFactice()
  const ctx = contexteFactice()()
  poserChaineCrop({ globe: g, ...ctx })
  assert.equal(g.journal[2].arg.coastMask, 'masque', 'l’habillage doit recevoir le masque de côte du socle')
  assert.equal(g.journal[2].arg.amplitudeM, 2400)
  assert.equal(g.journal[4].arg.fovDeg, 33, 'la mer doit recevoir le fov VIVANT, pas le défaut du module')
  assert.equal(g.journal[4].arg.altitudeM, 12_000)
})

test('① quinquies un refus est RENDU, jamais avalé', () => {
  const g = globeFactice({ refuse: { parois: true, rampe: true } })
  const r = poserChaineCrop({ globe: g, ...contexteFactice()() })
  assert.deepEqual(r.refus.sort(), ['parois', 'rampe'])
})

test('① sexies `poserChaineCrop` EXIGE un globe — une chaîne muette est une chaîne absente', () => {
  // ⚠️ **C'EST LE MESSAGE QUI EST GARDÉ, ET C'EST DÉLIBÉRÉ.** Sans la garde, la
  // chaîne jette de toute façon — `Cannot read properties of undefined (reading
  // 'poserCrop')`, au même endroit, du même type. **La seule chose que la garde
  // change est le DIAGNOSTIC**, et c'est précisément ce qu'elle sert à produire :
  // la campagne de mutation l'a montré en la remplaçant par `if (false)` sans
  // faire rougir un `assert.throws(…, TypeError)` nu.
  for (const mauvais of [undefined, {}, { poserCrop: 'oui' }]) {
    assert.throws(
      () => poserChaineCrop({ globe: mauvais, centre: { lat: 0, lon: 0 }, zoom: 12, tuilesParBloc: 3 }),
      (e) => e instanceof TypeError && /poserChaineCrop/.test(e.message),
      `un globe ${JSON.stringify(mauvais)} doit être refusé avec un message qui se lit`,
    )
  }
})

// ══════════ ② LA DESCENTE — L'OBJET DE LA TÂCHE ═════════════════════════════

test('② de l’orbite au sol : rien au-dessus du seuil, la chaîne entière en dessous', async () => {
  // ⚠️ LES ALTITUDES SONT CELLES DE `test/seuil-branche.test.js`, rejouées là-bas
  // sur les poses d'arrivée (`.banc/rejeu-arrivee.mjs`). Elles ne sont PAS
  // recalculées ici : ce test dit ce que le BRANCHEMENT doit produire.
  const ALT_ARRIVEE_M = {
    4: 3_680_260, 5: 920_060, 6: 575_040, 7: 359_400, 8: 205_370, 9: 102_690,
    10: 51_340, 11: 25_670, 12: 12_840, 13: 6_420, 14: 3_210, 15: 1_600,
  }
  const g = globeFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })

  for (const z of [4, 5, 6, 7, 8, 9, 10]) {
    assert.equal(veille.maj(ALT_ARRIVEE_M[z]), false, `pas de crop à z${z}`)
  }
  assert.deepEqual(quoi(g), [], 'de z4 à z10 on regarde la planète : rien ne doit être posé')

  assert.equal(veille.maj(ALT_ARRIVEE_M[11]), true, 'le crop doit naître à z11')
  assert.deepEqual(quoi(g), ['crop', 'parois', 'habillage', 'rampe', 'mer'])

  // et il ne se repose pas à chaque palier plus fin
  for (const z of [12, 13, 14, 15]) assert.equal(veille.maj(ALT_ARRIVEE_M[z]), true)
  assert.deepEqual(quoi(g), ['crop', 'parois', 'habillage', 'rampe', 'mer'],
    'la chaîne ne doit pas être rejouée tant que le lieu ne bouge pas')
  assert.equal(veille.bascules, 1)
  await veille.enVol()
})

test('② bis la remontée retire le crop, et à L’AUTRE seuil — l’hystérésis', async () => {
  const g = globeFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
  veille.maj(2_000)
  assert.equal(veille.pose, true)
  // entre les deux seuils, en MONTANT : le crop survit
  assert.equal(veille.maj(SEUIL_NAISSANCE_M * 1.05), true, 'il ne meurt pas au seuil de NAISSANCE')
  assert.ok(SEUIL_NAISSANCE_M * 1.05 < SEUIL_MORT_M)
  assert.equal(veille.maj(SEUIL_MORT_M * 1.01), false, 'il meurt au seuil de MORT')
  assert.equal(g.journal.at(-1).quoi, 'retirer')
  assert.equal(g._crop, null)
  await veille.enVol()
})

test('② ter cent oscillations au seuil ne posent la chaîne qu’UNE fois', async () => {
  // ⚠️ **C'EST LE TEST QUE LA MUTATION DOIT TUER.** Reposer la chaîne à chaque
  // image, c'est reconstruire les parois, rebalayer 128² points de rampe et
  // recuire un champ de mer de 385² — soit un gel par image. Égaliser les deux
  // seuils rend 200 poses.
  const g = globeFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
  const bas = SEUIL_NAISSANCE_M * 0.999
  const haut = SEUIL_NAISSANCE_M * 1.001
  for (let i = 0; i < 100; i++) { veille.maj(bas); veille.maj(haut) }
  assert.equal(veille.bascules, 1)
  assert.equal(g.journal.filter((e) => e.quoi === 'crop').length, 1)
  assert.equal(g.journal.filter((e) => e.quoi === 'mer').length, 1)
  await veille.enVol()
})

test('② quater mille images stables : la chaîne est posée UNE fois, et plus rien', async () => {
  const g = globeFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
  for (let i = 0; i < 1000; i++) veille.maj(2_200) // le Mont-Blanc du vol de référence
  assert.deepEqual(quoi(g), ['crop', 'parois', 'habillage', 'rampe', 'mer'])
  await veille.enVol()
})

test('② quinquies une altitude non finie ne décide rien', async () => {
  const g = globeFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
  for (const mauvaise of [NaN, Infinity, -Infinity, undefined, null, '2000']) {
    assert.equal(veille.maj(mauvaise), false, `${String(mauvaise)} ne doit pas faire naître le crop`)
  }
  assert.deepEqual(quoi(g), [])
  await veille.enVol()
})

// ══════════ ③ LE LIEU BOUGE — LE CROP SUIT, SINON IL RESTE COLLÉ ════════════

test('③ un changement de lieu REJOUE la chaîne, sans compter une bascule', async () => {
  // ⚠️ **C'EST LE DÉFAUT QUE `recadrerFenetre` A DÉJÀ PAYÉ UNE FOIS** (Tâche 6
  // septies) : « Réunion, Chamonix, Nice et Everest chargés à la suite rendaient
  // les mêmes `minM` au mètre près » — l'emprise était figée à la construction.
  // Un crop figé au premier lieu ferait exactement la même chose, en pire : la
  // découpe serait ailleurs que le bloc.
  const g = globeFactice()
  let centre = { lat: 45.9, lon: 6.87 }
  let zoom = 12
  const veille = creerVeilleCrop({ globe: g, contexte: () => ({ centre, zoom, tuilesParBloc: 3 }) })
  veille.maj(2_000)
  assert.equal(g.journal.filter((e) => e.quoi === 'crop').length, 1)

  centre = { lat: -21.1, lon: 55.5 } // La Réunion
  veille.maj(2_000)
  const poses = g.journal.filter((e) => e.quoi === 'crop')
  assert.equal(poses.length, 2, 'le crop doit suivre le bloc')
  assert.deepEqual(poses[1].centre, { lat: -21.1, lon: 55.5 })
  assert.equal(veille.bascules, 1, 'un déménagement n’est pas une naissance')

  zoom = 13 // un cran
  veille.maj(2_000)
  assert.equal(g.journal.filter((e) => e.quoi === 'crop').length, 3, 'un cran change la largeur du crop')
  await veille.enVol()
})

test('③ bis sans contexte (pas encore de bloc), on n’invente pas de lieu', async () => {
  // ⚠️ **LES DEUX MOITIÉS DE LA GARDE, ET LA SECONDE A SURVÉCU À LA PREMIÈRE
  // CAMPAGNE.** `null` est le cas du démarrage — pas encore de MNT ni de fenêtre.
  // Un contexte SANS `centre` est l'autre : `latLonOrigineBloc()` peut rendre un
  // objet dont les champs sont `NaN` pendant un vol, et un crop posé sur `NaN`
  // n'atterrit nulle part.
  for (const ctx of [null, undefined, {}, { zoom: 12, tuilesParBloc: 3 }]) {
    const g = globeFactice()
    const veille = creerVeilleCrop({ globe: g, contexte: () => ctx })
    assert.equal(veille.maj(2_000), false, `${JSON.stringify(ctx)} ne doit rien poser`)
    assert.deepEqual(quoi(g), [], 'poser un crop sans savoir où le mettrait au milieu de l’Atlantique')
    await veille.enVol()
  }
})

// ══════════ ④ L'ORBITE — LE MODE PRIME, COMME POUR LE SOCLE ═════════════════

test('④ passer en orbite RETIRE le crop, et aucune altitude ne le ressort', async () => {
  const g = globeFactice()
  const est = estompageFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), estompage: est })
  veille.maj(2_000)
  assert.equal(veille.pose, true)

  veille.poserMode(false)
  assert.equal(veille.pose, false)
  assert.equal(g.journal.at(-1).quoi, 'retirer', 'la planète redevient entière en orbite')
  for (const alt of [0, 1, 1e9, -5, 2_000]) veille.maj(alt)
  assert.equal(veille.pose, false, 'aucune altitude ne doit rouvrir le crop en orbite')
  assert.equal(g.journal.filter((e) => e.quoi === 'crop').length, 1)

  veille.poserMode(true)
  assert.equal(veille.maj(2_000), true, 'et la première image de surface tranche')
  assert.equal(g.journal.filter((e) => e.quoi === 'crop').length, 2)
  await veille.enVol()
})

// ══════════ ④ bis LE BLOC PLAT PART — SANS ÇA IL Y A ENCORE DEUX TERRES ═════
//
// ⚠️ **CE TEST N'EXISTE QUE PARCE QU'ON A REGARDÉ.** Première image du drapeau
// levé, La Réunion z12, relevé dans la console : `uCropOn = 1`, `uHabOn = 1`,
// `uMerRampeOn = 1`, la mer posée — **et `terrain.mesh.visible === true`.** Le
// bloc plat est opaque et se dessine dans la passe de SURFACE, donc après la
// passe de fond : il recouvrait le crop en entier et l'écran était rigoureusement
// celui d'avant le chantier. **C'est exactement la classe d'erreur qui a créé
// cette tâche** — du code qui tourne, et personne qui le voit.

test('④ bis le bloc plat est masqué dès la première image de surface', () => {
  const g = globeFactice()
  const vus = []
  const veille = creerVeilleCrop({
    globe: g, contexte: contexteFactice(), masquerSocle: () => vus.push('masque'),
  })
  // ⚠️ **AU-DESSUS DU SEUIL AUSSI**, et c'est le point : sous ce drapeau le bloc
  // plat n'a plus lieu d'exister à AUCUNE altitude. Le laisser vivre là-haut
  // remettrait un socle devant la planète entière — la capture d'Adrien à Z5.
  veille.maj(4_000_000)
  assert.deepEqual(vus, ['masque'])
  assert.equal(veille.pose, false, 'et sans crop pour autant : on est au-dessus du seuil')
  // et pas une fois par image : la liste qu'il rappelle touche quatorze calques
  for (let i = 0; i < 200; i++) veille.maj(2_000)
  assert.deepEqual(vus, ['masque'])
})

test('④ ter un aller-retour par l’orbite redemande le masquage', () => {
  // `modes.js` rallume les calques de surface en revenant du globe : un masquage
  // posé une seule fois pour toute la session serait défait par le premier
  // aller-retour, et le bloc plat reviendrait par-dessus le crop.
  const g = globeFactice()
  const vus = []
  const veille = creerVeilleCrop({
    globe: g, contexte: contexteFactice(), masquerSocle: () => vus.push('masque'),
  })
  veille.maj(2_000)
  veille.poserMode(false)
  veille.poserMode(true)
  veille.maj(2_000)
  assert.deepEqual(vus, ['masque', 'masque'])
})

// ══════════ ⑤ L'ESTOMPAGE SUIT LA MÊME ALTITUDE, À LA MÊME IMAGE ════════════

test('⑤ l’estompage est nourri par la MÊME altitude que le crop, à chaque image', async () => {
  // ⚠️ **UN SEUL POINT D'ALIMENTATION, SINON DEUX LOIS.** Un crop qui naîtrait
  // sur une altitude et une planète qui s'effacerait sur une autre se
  // contrediraient à l'écran — c'est mot pour mot l'argument que `main.js` écrit
  // déjà entre `majSeuilSocle` et `majEstompage`.
  const g = globeFactice()
  const est = estompageFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), estompage: est })
  for (const a of [900_000, 100_000, 30_000, 2_000]) veille.maj(a)
  assert.deepEqual(est.alt, [900_000, 100_000, 30_000, 2_000])
  // et le MODE lui est relayé aussi : la veille de l'estompage FORCE zéro en
  // orbite, geler y laisserait une planète effacée au moment où elle redevient
  // le sujet (§6 de `monde/estompage-terre.js`)
  veille.poserMode(false)
  veille.poserMode(true)
  assert.deepEqual(est.modes, [false, true])
  await veille.enVol()
})

test('⑤ bis l’estompage est nourri MÊME en orbite — sinon la planète reste effacée', async () => {
  const g = globeFactice()
  const est = estompageFactice()
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), estompage: est })
  veille.poserMode(false)
  veille.maj(1_000_000)
  assert.deepEqual(est.alt, [1_000_000])
  await veille.enVol()
})

// ══════════ ⑥ LA REPRISE — UN REFUS N'EST PAS UNE FIN ═══════════════════════

test('⑥ un maillon qui REFUSE est repris plus tard, et la découpe n’est pas rejouée', async () => {
  // ⚠️ **SANS LA REPRISE, LE BRANCHEMENT NE MONTRE RIEN.** À l'instant où le
  // crop naît, le quadtree n'a pas encore les tuiles fines de son emprise :
  // `construireParoisCrop` et `poserRampe` rendent un refus de couverture, et
  // « le refus ne touche pas à ce qui est en place » — donc rien n'arrive jamais
  // si personne ne redemande.
  const g = globeFactice({ refuse: { parois: true, rampe: true } })
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 5 })
  veille.maj(2_000)
  assert.deepEqual(veille.refus.sort(), ['parois', 'rampe'])

  for (let i = 0; i < 4; i++) veille.maj(2_000)
  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, 1, 'pas de reprise avant la période')
  veille.maj(2_000) // la cinquième image depuis la pose
  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, 2)
  assert.equal(g.journal.filter((e) => e.quoi === 'crop').length, 1, 'la découpe, elle, tient')

  // les tuiles arrivent : la reprise suivante prend, et il n'y en a plus
  g.refuse.parois = false
  g.refuse.rampe = false
  for (let i = 0; i < 5; i++) veille.maj(2_000)
  assert.deepEqual(veille.refus, [])
  const n = g.journal.filter((e) => e.quoi === 'parois').length
  for (let i = 0; i < 50; i++) veille.maj(2_000)
  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, n, 'plus rien à reprendre, plus rien à faire')
  await veille.enVol()
})

test('⑥ bis la mer qui refuse est reprise elle aussi — son refus arrive PLUS TARD', async () => {
  // ⚠️ `poserMer` est la seule asynchrone de la chaîne : son refus n'existe pas
  // encore quand `poserChaineCrop` rend la main. Une reprise qui ne lirait que
  // le retour synchrone laisserait une mer absente pour toujours.
  const g = globeFactice({ refuse: { mer: true } })
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 2 })
  veille.maj(2_000)
  assert.deepEqual(veille.refus, [], 'à l’instant de la pose, la promesse n’est pas encore tenue')
  await veille.enVol()
  assert.deepEqual(veille.refus, ['mer'], 'et quand elle l’est, le refus est là')
  g.refuse.mer = false
  veille.maj(2_000); veille.maj(2_000)
  await veille.enVol()
  assert.deepEqual(veille.refus, [])
  assert.equal(g.journal.filter((e) => e.quoi === 'mer').length, 2)
})

test('⑥ quater les hauteurs sont RÉSERVÉES avant la chaîne, et à chaque reprise', async () => {
  // ⚠️ **CE TEST N'EXISTE QUE PARCE QU'ON A REGARDÉ, ET C'EST UN CHIFFRE.** La
  // Réunion z12, drapeau levé, **600 tuiles de globe en cache** :
  // `globe.tuilesAvecHauteurs().length` rendait **0**, donc `couverture = 0`,
  // donc `refus: 'couverture'` pour les parois ET la rampe, à chaque tentative.
  // La cause n'est pas le réseau : `_buildMesh` relâche `t.heights` dès le
  // maillage bâti, **sauf pour les clés de `gardeHauteurs`**. Quelqu'un doit
  // réserver l'emprise du crop, et ce module est pur — donc un rappel.
  const g = globeFactice({ refuse: { parois: true } })
  const ordre = []
  const veille = creerVeilleCrop({
    globe: g,
    contexte: contexteFactice(),
    periodeReprise: 3,
    reserverHauteurs: () => ordre.push('reserve'),
  })
  const j = () => [...ordre, ...quoi(g)]
  veille.maj(2_000)
  // ⚠️ **AVANT LA CHAÎNE, PAS APRÈS** : une tuile bâtie avant la réservation a
  // déjà perdu ses hauteurs, et c'est `demanderEmprise` qui la redemande.
  assert.equal(ordre.length, 1)
  assert.equal(g.journal[0].quoi, 'crop')
  assert.ok(j().indexOf('reserve') < j().indexOf('crop'))

  for (let i = 0; i < 3; i++) veille.maj(2_000)
  assert.equal(ordre.length, 2, 'la reprise doit redemander les hauteurs, pas seulement les parois')
  await veille.enVol()
})

test('⑥ ter la veille EXIGE son globe et son contexte', () => {
  assert.throws(() => creerVeilleCrop({}), TypeError)
  assert.throws(() => creerVeilleCrop({ globe: globeFactice() }), TypeError)
})

// ══════════ ⑦ LE DRAPEAU — LA PRODUCTION NE BASCULE PAS ═════════════════════

test('⑦ `terreUnique` est FALSE par défaut — le socle est en production', async () => {
  const { FLAGS } = await import('../src/flags.js')
  assert.equal(FLAGS.terreUnique, false, 'shibumap.com sert le socle plat : le défaut ne bascule pas ici')
})

test('⑦ bis `terreUniqueActive()` EXIGE la frontière de rendu', async () => {
  // ⚠️ Sans la passe de fond, le globe n'est pas dessiné en mode surface : un
  // crop creusé dans une planète qu'on ne dessine pas ne montrerait rien.
  const { terreUniqueActive } = await import('../src/flags.js')
  const avant = globalThis.location
  globalThis.location = { search: '?terre=unique' }
  assert.equal(terreUniqueActive(), false, '`?terre=unique` seul ne doit rien allumer')
  globalThis.location = { search: '?terre=unique&frontiere=1' }
  assert.equal(terreUniqueActive(), true)
  globalThis.location = { search: '?frontiere=1' }
  assert.equal(terreUniqueActive(), false, 'sans paramètre, c’est le défaut du drapeau qui décide')

  // ⚠️ **L'ÉCHAPPATOIRE NE SE TESTE QUE CONTRE UN DÉFAUT VRAI, ET LA PREMIÈRE
  // CAMPAGNE DE MUTATION L'A MONTRÉ** : avec `FLAGS.terreUnique === false`,
  // supprimer la ligne `?terre=deux` ne change RIEN — la valeur inconnue retombe
  // sur le défaut, qui est faux de toute façon. Le test ne mordait pas. C'est
  // pourtant la ligne qui comptera **le jour où le défaut passera à true**, et
  // c'est exactement ce jour-là qu'on voudra pouvoir couper depuis l'adresse.
  const { FLAGS } = await import('../src/flags.js')
  const defaut = FLAGS.terreUnique
  try {
    FLAGS.terreUnique = true
    globalThis.location = { search: '?frontiere=1' }
    assert.equal(terreUniqueActive(), true, 'défaut à true : la frontière suffit')
    globalThis.location = { search: '?terre=deux&frontiere=1' }
    assert.equal(terreUniqueActive(), false, '`?terre=deux` doit COUPER un défaut allumé')
    globalThis.location = { search: '?terre=0&frontiere=1' }
    assert.equal(terreUniqueActive(), false, '`?terre=0` aussi')
  } finally {
    FLAGS.terreUnique = defaut
    if (avant === undefined) delete globalThis.location
    else globalThis.location = avant
  }
})

// ══════════ ⑧ LE CÂBLAGE DE `main.js` — LU, PAS CHARGÉ ══════════════════════

test('⑧ `main.js` importe le drapeau et la veille du crop', () => {
  assert.match(SRC_MAIN, /import\s*\{[^}]*terreUniqueActive[^}]*\}\s*from\s*'\.\/flags\.js'/)
  assert.match(SRC_MAIN, /import\s*\{[^}]*creerVeilleCrop[^}]*\}\s*from\s*'\.\/monde\/branchement-crop\.js'/)
})

test('⑧ bis la veille du crop est nourrie par `altitudeCadrageM()`, et par elle seule', () => {
  // ⚠️ **RÈGLE R1**, et c'est la seule chose que ce fichier ne peut pas prouver
  // autrement : `altitudeCadrageM()` est l'instrument SANS `dem.meanM`.
  assert.match(SRC_MAIN, /veilleCrop\.maj\(\s*altitudeCadrageM\(\)\s*\)/)
  const appels = SRC_MAIN.match(/veilleCrop\.maj\(/g) || []
  assert.equal(appels.length, 1, 'un seul point d’alimentation, sinon deux lois')
})

test('⑧ ter le crop se décide APRÈS `modes.update` et AVANT le dessin', () => {
  const iTick = SRC_MAIN.indexOf('\nfunction tick() {')
  assert.ok(iTick > 0)
  const iModes = SRC_MAIN.indexOf('modes.update(dt)', iTick)
  const iSeuil = SRC_MAIN.indexOf('majSeuilSocle()', iTick)
  const iRender = SRC_MAIN.indexOf('composer.render(dtAmb)', iTick)
  assert.ok(iModes > 0 && iSeuil > iModes && iRender > iSeuil)
  // et `majSeuilSocle` est bien le porteur des deux décisions
  const i = SRC_MAIN.indexOf('function majSeuilSocle()')
  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}', i))
  assert.match(corps, /veilleCrop\.maj\(/, 'le crop lit la même altitude, à la même image, que le seuil du socle')
  assert.ok(corps.indexOf('modes?.busy') < corps.indexOf('veilleCrop.maj('),
    'la garde du cran doit précéder la décision — sinon onze bascules au lieu d’une')
})

test('⑧ quater le bloc plat cède la place : `socleAffiche()` rend FAUX sous le drapeau', () => {
  // ⚠️ **SANS ÇA, IL Y AURAIT ENCORE DEUX TERRES** — et c'est exactement ce
  // qu'Adrien a signalé. Le bloc plat est opaque et se dessine dans la passe de
  // surface, donc APRÈS la passe de fond : il recouvrirait le crop en entier.
  assert.match(SRC_MAIN, /function socleAffiche\(\)\s*\{\s*if \(terreUniqueBranchee\) return false/)
  // et la liste des calques reste UNIQUE — on borne son entrée, on ne la double pas
  const listes = SRC_MAIN.match(/terrain\.mesh\.visible = v\b/g) || []
  assert.equal(listes.length, 1)
  assert.match(SRC_MAIN, /function poserVisibiliteSocle\s*\(\s*v\s*\)\s*\{[\s\S]{0,400}?if \(terreUniqueBranchee\) v = false/)
  // ⚠️ **ET IL FAUT QUE QUELQU'UN L'APPELLE.** Borner `v` ne sert à rien si la
  // fonction n'est jamais rappelée : c'est exactement ce qui s'est passé à la
  // première image du drapeau levé. La veille du crop la rappelle, LA MÊME.
  assert.match(SRC_MAIN, /masquerSocle: \(\) => poserVisibiliteSocle\(false\)/)
})

test('⑧ quinquies l’estompage n’a QU’UN nourrisseur, drapeau levé ou baissé', () => {
  // Sous `terre unique`, c'est `veilleCrop` qui relaie l'altitude à l'estompage :
  // `majEstompage` doit donc rendre la main, sinon la même image l'applique deux
  // fois et les deux compteurs de bascules divergent.
  const i = SRC_MAIN.indexOf('function majEstompage()')
  assert.ok(i > 0)
  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}', i))
  assert.match(corps, /terreUniqueBranchee/)
  assert.ok(corps.indexOf('terreUniqueBranchee') < corps.indexOf('veilleEstompage.maj('))
  assert.match(SRC_MAIN, /creerVeilleCrop\(\{[\s\S]{0,900}?estompage: veilleEstompage/)
})

test('⑧ sexies la mer reçoit le fov VIVANT, pas le défaut du module', () => {
  // ⚠️ **RELEVÉ SUR L'APPLICATION VIVANTE le 2026-08-21** : `params.fov = 33`,
  // `camera.fov = 33`, `camGlobe.fov = 33` — alors que le défaut du code est 30
  // (`main.js`, `fov: 30`) et que `FOV_DEG` vaut 30. L'écart vient des
  // templates : `templates-user.js` sauvegarde `'fov'`, et un template appliqué
  // au démarrage repose `params.fov`. « 33 n'existe nulle part dans le dépôt »
  // était vrai de la SOURCE et faux de l'application qui tourne.
  const i = SRC_MAIN.indexOf('function contexteCrop()')
  assert.ok(i > 0, '`main.js` doit fabriquer le contexte du crop dans une fonction nommée')
  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}\n', i))
  assert.match(corps, /fovDeg:\s*camGlobe\?\.fov/, 'le fov doit être lu sur la caméra de fond, à l’image')
})

test('⑧ octies le crop hérite de la loi de relief du socle qu’il remplace', () => {
  // ⚠️ **MESURÉ À L'ÉCRAN, PAS DÉDUIT.** La Tâche E fait du globe « le
  // quatorzième lecteur » de l'exagération partagée — mais derrière SON drapeau.
  // Branché sans elle, le crop garde l'exagération du globe, **18**, contre les
  // **2,8** du socle qu'il remplace : facteur **6,4**. Deux captures au même
  // cadrage, La Réunion z12, `.banc/vues-I/03-…-exag18.jpg` et
  // `04-…-exag-continu.jpg` : sans elle, un champ d'aiguilles où l'île n'est plus
  // reconnaissable ; avec elle, le bloc.
  assert.match(SRC_MAIN, /exagContinue: exagContinueActive\(\) \|\| terreUniqueBranchee/)
  // ⚠️ **ET IL DOIT ÊTRE DÉCLARÉ AVANT LE GLOBE.** Un `const` déclaré plus bas
  // serait dans sa zone morte à cette ligne : `ReferenceError` au démarrage, que
  // ni un test ni `node --check` ne voient — le piège que ce chantier a déjà payé
  // une fois, « 3 098 tests verts et ça plante au démarrage ».
  const iDecl = SRC_MAIN.indexOf('const terreUniqueBranchee = terreUniqueActive()')
  const iGlobe = SRC_MAIN.indexOf('globe = new Globe({')
  assert.ok(iDecl > 0 && iGlobe > iDecl, 'le drapeau doit être déclaré AVANT la construction du globe')
})

test('⑧ septies le drapeau est lu UNE fois, et la production ne change pas', () => {
  assert.match(SRC_MAIN, /const terreUniqueBranchee = terreUniqueActive\(\)/)
  const lectures = SRC_MAIN.match(/terreUniqueActive\(\)/g) || []
  assert.equal(lectures.length, 2, 'l’import et la seule lecture — un drapeau relu ailleurs divergerait')
  // `?terre=unique` doit rester joignable par l'adresse
  assert.match(SRC_FLAGS, /paramAdresse\('terre'\)/)
})
