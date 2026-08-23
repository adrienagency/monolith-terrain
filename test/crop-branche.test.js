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

import {
  creerVeilleCrop,
  poserChaineCrop,
  MAILLONS,
  CHAMPS_HABILLAGE,
  habillageDifferent,
  // ⚠️ **Tâche P6** : la FORME du bloc, surveillée à part de la signature de lieu.
  CHAMPS_FORME,
  formeDuCrop,
  formeDifferente,
} from '../src/monde/branchement-crop.js'
import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_MAIN = fs.readFileSync(path.join(RACINE, 'src/main.js'), 'utf8')
const SRC_FLAGS = fs.readFileSync(path.join(RACINE, 'src/flags.js'), 'utf8')

// ══════════ LE GLOBE FACTICE — IL REFUSE, IL NE FAIT PAS SEMBLANT ═══════════
//
// Il porte exactement ce que la chaîne lit et écrit, et **il se comporte comme
// le vrai sur le seul point qui compte pour l'ordre** : les cinq maillons qui
// suivent la découpe rendent `null` ou un refus tant que `_crop` est nul, comme
// `poserFondCrop`, `construireParoisCrop`, `poserRampe` et `poserMer` le font en
// tête de corps.
function globeFactice({ refuse = {} } = {}) {
  const j = []
  const g = {
    _crop: null,
    journal: j,
    refuse: { fond: false, parois: false, rampe: false, mer: false, ...refuse },
    poserCrop(a) {
      // ⚠️ **Tâche P6 : L'ARGUMENT ENTIER EST JOURNALISÉ.** Trois champs
      // recopiés ne diraient rien de `half`, `corner` et `expo` — ceux-là mêmes
      // que personne n'a jamais passés pendant dix tâches.
      j.push({ quoi: 'crop', arg: a, centre: a?.centre, zoom: a?.zoom, tuilesParBloc: a?.tuilesParBloc })
      g._crop = { cx: 0.5, cy: 0.35, demi: a.tuilesParBloc / 2 / 2 ** a.zoom, zoom: a.zoom }
      return g._crop
    },
    // LE FOND DU CROP — Tâche J bis. ⚠️ **IL REFUSE SANS CROP, comme le vrai** :
    // `poserFondCrop` sort à sa première ligne quand `_crop` est nul.
    poserFondCrop(a) {
      j.push({ quoi: 'fond', arg: a })
      if (!g._crop) return { refus: 'crop', couverture: 0, bathy: false }
      return g.refuse.fond
        ? { refus: 'champ', couverture: 0.3, bathy: false }
        : { refus: null, couverture: 1, bathy: true, profMaxM: 2116.3, rebati: 50 }
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
    fond: { portee: 3, couvertureMin: 0.99 },
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

test('① `poserChaineCrop` appelle les SIX maillons, la découpe en premier', async () => {
  const g = globeFactice()
  const r = poserChaineCrop({ globe: g, ...contexteFactice()() })
  assert.deepEqual(quoi(g), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'],
    'les six maillons doivent être appelés, et la découpe AVANT les cinq autres')
  // ⚠️ et le comportement le prouve : aucun des quatre suivants n'a refusé
  assert.deepEqual(r.refus, [], 'un maillon appelé avant la découpe aurait refusé')
  assert.ok(g.journal[3].avecCrop, 'l’habillage doit trouver le crop posé — il en tire `uMargeCoteM`')
  await r.mer
})

test('① bis la liste des maillons est celle que le globe expose', () => {
  assert.deepEqual(MAILLONS, ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])
})

test('① ter les bornes du crop sont CELLES DU CONTEXTE, pas des constantes locales', () => {
  // ⚠️ **C'EST LE POINT QUI FAIT COÏNCIDER LE CROP ET LE BLOC.** Si la chaîne
  // posait son propre centre ou son propre zoom, la découpe tomberait à côté du
  // bloc que la similitude de la passe de fond aligne — et ce serait invisible
  // partout sauf à l'écran.
  const g = globeFactice()
  poserChaineCrop({ globe: g, centre: { lat: -21.1, lon: 55.5 }, zoom: 13.25, tuilesParBloc: 3 })
  const { arg, ...borne } = g.journal[0]
  assert.deepEqual(borne, {
    quoi: 'crop', centre: { lat: -21.1, lon: 55.5 }, zoom: 13.25, tuilesParBloc: 3,
  })
  // ⚠️ **Tâche P6** : l argument entier est journalisé à côté, et sans forme au
  // contexte il ne porte AUCUN coin — le carré vif d avant, au bit près.
  assert.equal(arg.corner, undefined)
  assert.equal(arg.expo, undefined)
})

test('① quater ce que chaque maillon reçoit vient du contexte, pas d’un défaut', () => {
  const g = globeFactice()
  const ctx = contexteFactice()()
  poserChaineCrop({ globe: g, ...ctx })
  assert.equal(g.journal[3].arg.coastMask, 'masque', 'l’habillage doit recevoir le masque de côte du socle')
  assert.equal(g.journal[3].arg.amplitudeM, 2400)
  assert.equal(g.journal[5].arg.fovDeg, 33, 'la mer doit recevoir le fov VIVANT, pas le défaut du module')
  assert.equal(g.journal[5].arg.altitudeM, 12_000)
  // ⚠️ **LE FOND ET LA MER DOIVENT LIRE LA MÊME PORTÉE — Tâche J bis.** Deux
  // portées qui divergent rouvriraient exactement le désaccord que cette tâche
  // ferme : la mer s'arrêterait où le fond ne va pas, ou l'inverse.
  assert.equal(g.journal[1].arg.portee, 3, 'le fond doit recevoir la portée du contexte')
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
  assert.deepEqual(quoi(g), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])

  // et il ne se repose pas à chaque palier plus fin
  for (const z of [12, 13, 14, 15]) assert.equal(veille.maj(ALT_ARRIVEE_M[z]), true)
  assert.deepEqual(quoi(g), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'],
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
  assert.deepEqual(quoi(g), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])
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

test('⑥ ter QUAND LE FOND FINIT PAR PRENDRE, SES LECTEURS SONT REJOUÉS — Tâche J bis', async () => {
  // ⚠️ **CE TEST N'EXISTE QUE PARCE QU'ON A REGARDÉ, ET C'EST UN CHIFFRE.** La
  // nappe bathymétrique est ASYNCHRONE : au premier passage le fond REFUSE
  // pendant que `parois` et `rampe` PRENNENT, sur une surface encore plate.
  // `reprendre` ne rejoue que ce qui a refusé — donc, quand le fond prenait
  // enfin, la rampe gardait la profondeur de la surface d'avant. Relevé dans
  // l'application, La Réunion z12 : **`uOceanDepth = 130,36 m`** avec un fond de
  // **2 116 m** sous les pieds.
  const g = globeFactice({ refuse: { fond: true } })
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 2 })
  veille.maj(2_000)
  assert.deepEqual(veille.refus, ['fond'], 'le fond refuse seul : les autres ont pris')
  const paroisAvant = g.journal.filter((e) => e.quoi === 'parois').length
  const rampeAvant = g.journal.filter((e) => e.quoi === 'rampe').length

  // la nappe atterrit : la reprise suivante pose le fond, ET rejoue ses lecteurs
  g.refuse.fond = false
  veille.maj(2_000); veille.maj(2_000)
  assert.deepEqual(veille.refus, [])
  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, paroisAvant + 1,
    'les parois se posent sur `hauteurSurface` : sans rejeu, leur base reste au niveau de la mer')
  assert.equal(g.journal.filter((e) => e.quoi === 'rampe').length, rampeAvant + 1,
    'la rampe mesure la profondeur : sans rejeu, elle garde celle d’une surface qui n’existe plus')
  assert.equal(g.journal.filter((e) => e.quoi === 'habillage').length, 1,
    'l’habillage ne lit AUCUNE hauteur — le rejouer serait du travail pour rien')

  // et un fond INCHANGÉ ne rejoue rien : `rebati` vaut alors zéro
  await veille.enVol()
})

test('⑥ ter bis un fond qui PREND sans RIEN changer ne rejoue pas ses lecteurs', async () => {
  // ⚠️ **CE TEST A ÉTÉ RÉÉCRIT PARCE QU'IL NE PROUVAIT RIEN.** Sa première
  // version faisait prendre le fond DÈS LA POSE : `refus` ne contenait donc
  // jamais `'fond'`, la reprise ne rappelait jamais le maillon, et une mutation
  // qui rendait `neuf: true` à chaque fois survivait tranquillement. Il faut que
  // le fond REFUSE d'abord, PUIS prenne sans rien rebâtir.
  //
  // ⚠️ L'enjeu : `poserFondCrop` est rappelé à chaque reprise ; s'il se disait
  // `neuf` à chaque fois, le contour des parois (plus de mille points) et le
  // balayage de la rampe (`pas²`) repartiraient toutes les deux images.
  const g = globeFactice({ refuse: { fond: true, mer: true } })
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 2 })
  veille.maj(2_000)
  await veille.enVol()
  assert.ok(veille.refus.includes('fond'), 'le fond doit AVOIR refusé, sinon la reprise ne le rappelle pas')
  const paroisAvant = g.journal.filter((e) => e.quoi === 'parois').length
  const rampeAvant = g.journal.filter((e) => e.quoi === 'rampe').length

  // le fond prend à la reprise suivante, mais le champ est IDENTIQUE : rien à rebâtir
  g.poserFondCrop = (a) => {
    g.journal.push({ quoi: 'fond', arg: a })
    return { refus: null, couverture: 1, bathy: true, profMaxM: 2116.3, rebati: 0 }
  }
  veille.maj(2_000); veille.maj(2_000)
  await veille.enVol()
  assert.ok(!veille.refus.includes('fond'), 'le fond a bien pris')
  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, paroisAvant,
    'un fond identique ne doit entraîner personne')
  assert.equal(g.journal.filter((e) => e.quoi === 'rampe').length, rampeAvant)
})

test('⑥ ter ter un lecteur DÉJÀ rejoué ne l’est pas DEUX FOIS dans la même reprise', async () => {
  // ⚠️ Quand `fond` ET `parois` ont refusé, la reprise rejoue `parois` parce
  // qu'il est dans `refus` — et le fond, en prenant, voudrait le rejouer AUSSI.
  // Le balayage du contour fait plus de mille points : le payer deux fois par
  // reprise est exactement ce que la garde de `reprendre` évite.
  const g = globeFactice({ refuse: { fond: true, parois: true, mer: true } })
  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 2 })
  veille.maj(2_000)
  await veille.enVol()
  assert.deepEqual(veille.refus.slice().sort(), ['fond', 'mer', 'parois'])
  const avant = g.journal.filter((e) => e.quoi === 'parois').length

  // tout arrive d'un coup : le fond prend ET rebâtit, les parois prennent aussi
  g.refuse.fond = false
  g.refuse.parois = false
  veille.maj(2_000); veille.maj(2_000)
  await veille.enVol()
  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, avant + 1,
    'les parois doivent être rejouées UNE fois, pas deux')
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

test('⑧ bis la veille du crop ET l’échelle de couleur lisent LA MÊME altitude', () => {
  // ⚠️ **RÈGLE R1**, et c'est la seule chose que ce fichier ne peut pas prouver
  // autrement : `altitudeCadrageM()` est l'instrument SANS `dem.meanM`.
  //
  // ⚠️ **ET DEPUIS LA TÂCHE K bis IL Y A DEUX CONSOMMATEURS**, donc la question
  // n'est plus seulement « lit-on le bon instrument » mais « les deux
  // lisent-ils LA MÊME VALEUR à LA MÊME IMAGE ». Deux appels à
  // `altitudeCadrageM()` côte à côte seraient verts sur l'ancienne assertion et
  // rouvriraient exactement le désaccord que ce chantier a payé trois fois.
  const i = SRC_MAIN.indexOf('function majSeuilSocle()')
  assert.ok(i > 0)
  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}', i))
  const m = corps.match(/const (\w+) = altitudeCadrageM\(\)/)
  assert.ok(m, 'l’altitude doit être lue UNE fois, dans une variable')
  const v = m[1]
  // ⚠️ **ET DEPUIS LA TÂCHE R1, LA VEILLE DU CROP REÇOIT DEUX GRANDEURS** —
  // l'altitude pour la naissance du crop et l'estompage, la DISTANCE pour le
  // repos (voir le §1 de `veille-repos.js`, qui porte la mesure qui a réfuté le
  // principe inverse). Ce qu'elles doivent partager n'est plus le NOMBRE mais
  // l'IMAGE : les deux sont lues UNE fois dans cette branche, chacune dans sa
  // variable, et partent ensemble en un seul appel.
  const md = corps.match(/const (\w+) = distanceCadrageM\(\)/)
  assert.ok(md, 'la distance doit être lue UNE fois, dans une variable')
  assert.match(corps, new RegExp('veilleCrop\\.maj\\(' + v + ', ' + md[1] + '\\)'),
    'la veille du crop doit recevoir les DEUX variables, pas une seconde lecture')
  assert.match(corps, new RegExp('majEchelleRampe\\(' + v + '\\)'),
    'l’échelle de couleur doit recevoir LA MÊME variable d’altitude')
  // un seul point d'alimentation pour chacun, sinon deux lois
  assert.equal((SRC_MAIN.match(/veilleCrop\.maj\(/g) || []).length, 1)
  assert.equal((SRC_MAIN.match(/majEchelleRampe\(/g) || []).length, 1)
  // ⚠️ **ET LA BRANCHE `terre unique` NE LIT L'INSTRUMENT QU'UNE FOIS.** On
  // retire les commentaires avant de compter — le corps en cite le nom, et une
  // assertion qui compterait les citations serait rouge sur une correction de
  // prose et verte sur une seconde lecture. (L'autre appel du corps est celui
  // de `veilleSocle`, le chemin SANS drapeau, qui n'est pas de cette tâche.)
  const code = corps.replace(/\/\/[^\n]*/g, '')
  const branche = code.slice(code.indexOf('if (terreUniqueBranchee)'), code.indexOf('veilleSocle.maj('))
  assert.equal((branche.match(/altitudeCadrageM\(\)/g) || []).length, 1,
    'la branche `terre unique` doit lire l’altitude UNE seule fois')
  assert.equal((branche.match(/distanceCadrageM\(\)/g) || []).length, 1,
    'la branche `terre unique` doit lire la distance UNE seule fois')
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
  const listes = SRC_MAIN.match(/terrain\.mesh\.visible = vue\.socle\b/g) || []
  assert.equal(listes.length, 1)
  // ⚠️ **LE BORNAGE A DÉMÉNAGÉ DANS `monde/visibilite-surface.js` — Tâche R1 ②**,
  // et il n'a pas changé de sens : il vaut toujours pour le MAILLAGE. Ce qui a
  // changé, c'est qu'il ne déborde plus sur les trois boutons du bas, qui ne
  // parlent pas du maillage. Le module est PUR, donc la garde se vérifie
  // désormais par le comportement (`test/visibilite-surface.test.js` ①②) au
  // lieu d'une expression régulière — ici on ne garde que le câblage.
  assert.match(SRC_MAIN, /function poserVisibiliteSocle\s*\(\s*v\s*\)\s*\{[\s\S]{0,1400}?const vue = visibiliteSurface\(\{ terreUnique: terreUniqueBranchee, surface: v \}\)/)
  // ⚠️ **ET IL FAUT QUE QUELQU'UN L'APPELLE.** Borner `v` ne sert à rien si la
  // fonction n'est jamais rappelée : c'est exactement ce qui s'est passé à la
  // première image du drapeau levé. La veille du crop la rappelle, LA MÊME.
  // ⚠️ **ET IL L'APPELLE AVEC `true` DEPUIS LA TÂCHE R1 ②** : l'argument dit
  // « sommes-nous en surface devant un bloc », pas « allume le bloc plat ». Le
  // maillage est éteint par le BORNAGE du drapeau, quoi qu'on passe — ce que
  // `test/visibilite-surface.test.js` ① prouve par le comportement. Passer
  // `false` disait « nous ne sommes pas en surface », et c'est ce qui a effacé
  // les trois boutons du bas.
  assert.match(SRC_MAIN, /masquerSocle: \(\) => poserVisibiliteSocle\(true\)/)
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

test('⑧ nonies le FOND et la MER lisent le MÊME champ, par les MÊMES arguments — Tâche J bis', () => {
  // ⚠️ **ASSERTION DE SOURCE, DÉCLARÉE COMME TELLE** : `main.js` n'est chargé par
  // aucun test (three.js, le DOM, WebGL). Ce qu'elle garde n'est pas une chaîne
  // décorative : deux jeux d'arguments qui divergeraient — une portée ici, une
  // autre là — rouvriraient EXACTEMENT le désaccord que la Tâche J bis ferme,
  // et l'écran montrerait une mer qui s'arrête où le fond ne va pas.
  const bloc = SRC_MAIN.slice(SRC_MAIN.indexOf('ctx.fond = {'), SRC_MAIN.indexOf('ctx.fond = {') + 400)
  assert.ok(bloc.length > 20, '`contexteCrop` ne construit pas de section `fond`')
  for (const champ of ['remplir', 'portee', 'couvertureMin', 'exigerBathy']) {
    assert.match(bloc, new RegExp(champ + ':\\s*ctx\\.mer\\.' + champ),
      `fond.${champ} doit être DÉRIVÉ de mer.${champ}, pas recopié`)
  }
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

// ══════════ ⑨ LE RAFRAÎCHISSEMENT DE L'HABILLAGE — Tâche K ter ═════════════
//
// ⛔ **CE QUI A ÉTÉ RELEVÉ, ET QUI A CRÉÉ CES TESTS.** Application vivante,
// 2026-08-22, La Réunion z12, `?terre=unique&globe=continu&socle=quadtree` :
// `contexteCrop().habillage.coastMask` **non nul** pendant que le globe portait
// `uCoastMaskOn = 0` ; `amplitudeM = 4 737,2 m` pendant que `uContourInterval`
// valait **500** (le défaut mondial) ; et couche « Occupation du sol » allumée à
// la main, `terrain.mapUniforms.uSolOn = 1`, `ctx.habillage.sol` et `solLut`
// posés — **`globe.uniforms.uSolOn` resté à 0**.
//
// La cause est UNE : l'habillage ne refuse jamais, donc `reprendre` ne le rejoue
// jamais, et la chaîne ne se repose que si le LIEU change. Ce qui arrive après
// la première pose n'atteint donc jamais le nuanceur.

// Un contexte dont l'habillage ÉVOLUE — c'est le cas réel : le masque de côte,
// la mosaïque d'occupation du sol et l'amplitude arrivent après la pose.
function contexteEvolutif(etat) {
  return () => ({
    centre: { lat: 45.9, lon: 6.87 },
    zoom: 12,
    tuilesParBloc: 3,
    habillage: { ...etat.habillage },
    fond: { portee: 3, couvertureMin: 0.99 },
    mer: { altitudeM: 12_000, fovDeg: 33, hauteurPx: 900 },
  })
}

const habillages = (g) => g.journal.filter((e) => e.quoi === 'habillage')

test('⑨a le masque de côte qui arrive APRÈS la pose atteint le globe — ROUGE avant', () => {
  const g = globeFactice()
  const etat = { habillage: { coastMask: null, amplitudeM: null } }
  const v = creerVeilleCrop({ globe: g, contexte: contexteEvolutif(etat), periodeReprise: 30 })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(habillages(g).length, 1, 'la pose doit poser l’habillage une fois')
  assert.equal(habillages(g)[0].arg.coastMask, null)
  // le masque est cuit par le bloc plat, DEUX images plus tard
  etat.habillage = { coastMask: 'masque', amplitudeM: 4737.2 }
  v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(habillages(g).length, 2, 'l’habillage doit être REPOSÉ quand son contenu change')
  assert.equal(habillages(g)[1].arg.coastMask, 'masque')
  assert.equal(habillages(g)[1].arg.amplitudeM, 4737.2)
  assert.equal(v.rafraichissements, 1)
})

test('⑨b la mosaïque d’occupation du sol allumée EN COURS DE ROUTE atteint le globe', () => {
  const g = globeFactice()
  const etat = { habillage: { coastMask: 'masque', sol: null, solLut: null, solOpacite: 2 } }
  const v = creerVeilleCrop({ globe: g, contexte: contexteEvolutif(etat) })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(v.rafraichissements, 0, 'rien n’a changé : rien ne doit être reposé')
  // l'utilisateur allume la couche : DEUX textures apparaissent
  etat.habillage = { coastMask: 'masque', sol: 'mosaique', solLut: 'table', solOpacite: 2 }
  v.maj(SEUIL_NAISSANCE_M - 1000)
  const dernier = habillages(g).at(-1)
  assert.equal(dernier.arg.sol, 'mosaique')
  assert.equal(dernier.arg.solLut, 'table', 'la TABLE est le champ qu’on oublie — sans elle la couche ne peint rien')
  assert.equal(v.rafraichissements, 1)
})

test('⑨b bis la TABLE seule qui change suffit — et c’est le champ qu’on oublie', () => {
  // ⚠️ **UNE MUTATION A SURVÉCU FAUTE DE CE TEST** : retirer `solLut` de la liste
  // surveillée ne faisait rougir personne, parce que ⑨b faisait changer `sol` ET
  // `solLut` ensemble. Or `terrain.js` l'écrit noir sur blanc : « poser la
  // première sans la seconde ne casse rien de VISIBLE — la table de remplacement
  // est noire et opaque à zéro, donc la couche s'allume et ne peint RIEN. On
  // chercherait le défaut du côté des tuiles pendant longtemps. »
  const g = globeFactice()
  const etat = { habillage: { sol: 'mosaique', solLut: null } }
  const v = creerVeilleCrop({ globe: g, contexte: contexteEvolutif(etat) })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  etat.habillage = { sol: 'mosaique', solLut: 'table' } // SEULE la table arrive
  v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(v.rafraichissements, 1, 'la table seule doit suffire à reposer')
  assert.equal(habillages(g).at(-1).arg.solLut, 'table')
})

test('⑨c bis le rafraîchissement N’A LIEU QU’UNE FOIS par changement', () => {
  // ⚠️ **UNE MUTATION A SURVÉCU FAUTE DE CE TEST** : ne pas mettre à jour
  // l'instantané après avoir reposé laissait ⑨c verte (rien n'avait changé
  // AVANT le premier rafraîchissement) et faisait reposer l'habillage **à chaque
  // image pour toujours** après le premier. C'est la garde de
  // `creerVeilleEstompage`, mais du côté de l'APRÈS.
  const g = globeFactice()
  const etat = { habillage: { coastMask: null } }
  const v = creerVeilleCrop({ globe: g, contexte: contexteEvolutif(etat) })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  etat.habillage = { coastMask: 'masque' }
  for (let i = 0; i < 120; i++) v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(v.rafraichissements, 1, 'un changement, UN rafraîchissement — pas 120')
  assert.equal(habillages(g).length, 2, 'la pose, puis le seul rafraîchissement')
})

test('⑨c RIEN ne bouge tant que rien ne change — pas un uniforme par image', () => {
  // ⚠️ **LA GARDE DE `creerVeilleEstompage`, APPLIQUÉE ICI.** Sans elle, la
  // chaîne repasserait l'habillage à CHAQUE image ; c'est peu cher, mais c'est
  // exactement le genre de coût qu'on ne voit jamais venir.
  const g = globeFactice()
  const etat = { habillage: { coastMask: 'masque', amplitudeM: 2400 } }
  const v = creerVeilleCrop({ globe: g, contexte: contexteEvolutif(etat) })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  for (let i = 0; i < 200; i++) v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(habillages(g).length, 1, 'un seul appel : celui de la pose')
  assert.equal(v.rafraichissements, 0)
})

test('⑨d un objet REFABRIQUÉ à chaque image ne déclenche rien — c’est le cas réel', () => {
  // ⚠️ **`contexteCrop` FABRIQUE UN OBJET NEUF PAR IMAGE.** Une comparaison par
  // identité d'OBJET aurait donc reposé l'habillage 60 fois par seconde, en
  // restant verte sur ⑨a. On compare les CHAMPS, et le test le prouve.
  const g = globeFactice()
  const masque = { texture: 1 }
  const contexte = () => ({
    centre: { lat: 45.9, lon: 6.87 },
    zoom: 12,
    tuilesParBloc: 3,
    habillage: { coastMask: masque, amplitudeM: 2400, contourOpacity: 0.5 },
  })
  const v = creerVeilleCrop({ globe: g, contexte })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  for (let i = 0; i < 50; i++) v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(v.rafraichissements, 0, 'un objet neuf mais des champs identiques ne change rien')
})

test('⑨e les RÉGLAGES du studio suivent aussi — D3, « aucune option ne se perd »', () => {
  const g = globeFactice()
  const etat = { habillage: { coastMask: 'masque', contourOpacity: 0, contourWeight: 0.55 } }
  const v = creerVeilleCrop({ globe: g, contexte: contexteEvolutif(etat) })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  // l'utilisateur remonte l'opacité des courbes dans le panneau
  etat.habillage = { coastMask: 'masque', contourOpacity: 0.8, contourWeight: 0.55 }
  v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(habillages(g).at(-1).arg.contourOpacity, 0.8)
  assert.equal(v.rafraichissements, 1)
})

test('⑨f `habillageDifferent` : `null`, `undefined` et `NaN` sont trois réponses', () => {
  assert.equal(habillageDifferent(null, { coastMask: 'm' }), true, 'rien de posé : tout diffère')
  assert.equal(habillageDifferent({ coastMask: null }, { coastMask: undefined }), true,
    '« pas de masque » et « champ absent » ne sont pas la même chose')
  assert.equal(habillageDifferent({ amplitudeM: NaN }, { amplitudeM: NaN }), false,
    'Object.is doit rendre deux NaN ÉGAUX — sinon on repose à chaque image')
  assert.equal(habillageDifferent({ amplitudeM: 0 }, { amplitudeM: -0 }), true,
    'Object.is distingue 0 et -0 — on ne fait pas semblant du contraire')
  // tous les champs surveillés sont réellement surveillés
  for (const champ of CHAMPS_HABILLAGE) {
    const pose = {}
    for (const c of CHAMPS_HABILLAGE) pose[c] = 'a'
    const voulu = { ...pose, [champ]: 'b' }
    assert.equal(habillageDifferent(pose, voulu), true, `${champ} n’est pas surveillé`)
  }
  assert.equal(habillageDifferent({ coastMask: 'm' }, { coastMask: 'm', inconnu: 1 }), false,
    'un champ hors liste ne doit PAS déclencher — la liste est fermée, et déclarée')
})

test('⑨g le rafraîchissement ne survit pas au retrait du crop', () => {
  // `retirerCrop` appelle `retirerHabillage` : ce qui est posé n'est plus ce
  // qu'on croyait, et le compteur doit dire la vérité.
  const g = globeFactice()
  const etat = { habillage: { coastMask: 'masque' } }
  const v = creerVeilleCrop({ globe: g, contexte: contexteEvolutif(etat) })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  v.poserMode(false) // orbite : le crop part
  v.poserMode(true)
  v.maj(SEUIL_NAISSANCE_M - 1000) // re-pose au MÊME lieu, MÊME habillage
  assert.equal(v.rafraichissements, 0, 'la re-pose n’est pas un rafraîchissement')
  assert.equal(habillages(g).length, 2, 'deux poses, aucun rafraîchissement')
})

test('⑨h le rafraîchissement n’a lieu QUE sous le seuil et QU’EN surface', () => {
  const g = globeFactice()
  const etat = { habillage: { coastMask: null } }
  const v = creerVeilleCrop({ globe: g, contexte: contexteEvolutif(etat) })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  etat.habillage = { coastMask: 'masque' }
  v.poserMode(false)
  v.maj(SEUIL_NAISSANCE_M - 1000) // en orbite : la veille sort avant tout
  assert.equal(v.rafraichissements, 0, 'pas de rafraîchissement hors surface')
  v.poserMode(true)
  v.maj(SEUIL_MORT_M + 1000) // au-dessus du seuil : le crop n'existe pas
  assert.equal(v.rafraichissements, 0, 'pas de rafraîchissement sans crop')
})

// ══════════ ⑩ L'ORBITE RETIRE LE CROP — Tâche K ter, défaut n° 4 ═══════════
//
// ⛔ **`veilleCrop.poserMode` N'ÉTAIT APPELÉE DE NULLE PART.** Relevé le
// 2026-08-22 à 3 000 km, mode `orbital` (`.banc/vues-Kter/AV-orbite.json`) :
// `uCropOn = 1`, `uHabOn = 1`, `uCoastMaskOn = 1`, `uLandMax = 2 584,4 m`,
// `uOceanDepth = 1 262,0 m`, parois et mer du bloc encore dans la scène. **La
// planète entière portait la rampe et le masque de côte du dernier bloc visité.**

test('⑩a `main.js` DIT à la veille du crop qu’on a quitté la surface — ROUGE avant', () => {
  // ⚠️ **ASSERTION DE SOURCE, DÉCLARÉE COMME TELLE** : `main.js` n'est chargé par
  // aucun test (§0 du plan). Ce qui est gardé, c'est l'existence du câblage.
  const i = SRC_MAIN.indexOf('setSurfaceVisible(v) {')
  assert.ok(i > 0, '`main.js` doit porter le crochet `setSurfaceVisible`')
  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n    setEffectsEnabled', i))
  assert.match(corps, /veilleCrop\.poserMode\(v\)/,
    'sans cet appel, le crop reste POSÉ en orbite et la planète porte sa rampe')
  // un seul point d'alimentation dans tout le fichier
  assert.equal((SRC_MAIN.match(/veilleCrop\.poserMode\(/g) || []).length, 1)
})

test('⑩b sous `terre unique`, le crop est le SEUL à recevoir le mode', () => {
  // ⚠️ **UN SEUL ÉCRIVAIN, SINON DEUX LOIS** — mot pour mot l'argument de
  // `majSeuilSocle`. `veilleCrop.poserMode` relaie déjà l'estompage lui-même ;
  // l'appeler une seconde fois à côté ferait deux chemins pour un seul geste, et
  // `veilleSocle` est rigoureusement hors-jeu sous ce drapeau.
  const i = SRC_MAIN.indexOf('setSurfaceVisible(v) {')
  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n    setEffectsEnabled', i))
  const code = corps.replace(/\/\/[^\n]*/g, '')
  const iDrapeau = code.indexOf('if (terreUniqueBranchee)')
  assert.ok(iDrapeau > 0, 'le câblage doit être derrière le drapeau — la production ne change pas')
  const branche = code.slice(iDrapeau, code.indexOf('veilleSocle.poserMode('))
  assert.match(branche, /veilleCrop\.poserMode\(v\)/)
  assert.match(branche, /\breturn\b/, 'la branche doit RENDRE LA MAIN, sinon les deux chemins jouent')
  assert.doesNotMatch(branche, /veilleEstompage\.poserMode\(/,
    'l’estompage a UN SEUL point d’alimentation sous ce drapeau : la veille du crop')
})

test('⑩c la veille RETIRE réellement le crop en orbite, et le RÉTABLIT au retour', () => {
  // ⚠️ **LE COMPORTEMENT, PAS LA CHAÎNE.** Le globe factice enregistre le retrait.
  const g = globeFactice()
  const est = estompageFactice()
  const v = creerVeilleCrop({ globe: g, contexte: contexteFactice(), estompage: est })
  v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.ok(v.pose, 'le crop doit être posé en surface')
  const lieu = v.signature
  assert.ok(lieu, 'la signature du lieu doit exister tant que le crop est posé')
  v.poserMode(false)
  assert.equal(v.pose, false, 'le crop doit être RETIRÉ en orbite')
  assert.ok(quoi(g).includes('retirer'), '`retirerCrop` doit avoir été appelé')
  // ⚠️ **LA SIGNATURE PART AVEC LE CROP, ET C'EST UN CONTRAT PUBLIC** :
  // `get signature()` existe « pour les sondes et les bancs » (le harnais de la
  // Tâche K bis la lit), et une signature qui survivrait au retrait dirait qu'un
  // crop est posé quelque part alors qu'il n'y en a plus.
  assert.equal(v.signature, null, 'la signature doit partir avec le crop')
  assert.equal(est.modes.at(-1), false, 'l’estompage doit apprendre le mode par la veille du crop')
  // et une image d'orbite ne repose rien
  const avant = g.journal.length
  v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.equal(g.journal.length, avant, 'aucune pose en orbite')
  // retour en surface : la chaîne revient
  v.poserMode(true)
  v.maj(SEUIL_NAISSANCE_M - 1000)
  assert.ok(v.pose)
  assert.equal(est.modes.at(-1), true)
})

test('⑩d le retrait n’introduit AUCUN seuil d’altitude — consigne « zéro saut »', () => {
  // La veille ne doit décider du retrait que sur le MODE, jamais sur une
  // altitude qu'elle inventerait. On lui donne la MÊME altitude des deux côtés.
  const g = globeFactice()
  const v = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
  const alt = SEUIL_NAISSANCE_M - 1000
  v.maj(alt)
  assert.ok(v.pose)
  v.poserMode(false)
  assert.equal(v.pose, false, 'à altitude IDENTIQUE, c’est le mode seul qui décide')
  v.poserMode(true)
  v.maj(alt)
  assert.ok(v.pose, 'et le retour rétablit, toujours à la même altitude')
})

// ══════════ ⑧ LA FORME DU BLOC, SURVEILLÉE PAR IMAGE — Tâche P6 ════════════
//
// ⛔ **`poserCrop` PORTE `half`, `corner` ET `expo` DEPUIS LA TÂCHE A, ET
// PERSONNE NE LES A JAMAIS PASSÉS** ; `construireParoisCrop` porte
// `profondeur` depuis la Tâche B, même sort. Le bloc du crop était donc un
// CARRÉ À ANGLES VIFS pendant que celui du socle est un squircle — relevé le
// 2026-08-22 au même instant dans la même page : `uCropCoin = 0`,
// `uCropCoinN = 2` contre `uSlabCorner = 2,24`, `uSlabCornerN = 4,4`.
//
// ⚠️ **ET LA SURVEILLANCE EST À PART DE LA SIGNATURE DE LIEU, PAR CALCUL DE
// COÛT** : `signature` déclenche `poserTout`, donc un champ de mer de 385² et
// un balayage de rampe de 128² à CHAQUE image d'un glissement de tirette.

test('⑧a la forme est TRANSMISE à `poserCrop`, et le poseur ne la fabrique pas', async () => {
  const g = globeFactice()
  const ctx = {
    ...contexteFactice()(),
    forme: { half: 28, corner: 2.24, expo: 4.4 },
    parois: { fractionProfondeur: 0.125 },
  }
  const r = poserChaineCrop({ globe: g, ...ctx })
  const crop = g.journal.find((e) => e.quoi === 'crop')
  assert.ok(crop.arg, 'le poseur doit transmettre l argument entier')
  assert.equal(crop.arg.corner, 2.24)
  assert.equal(crop.arg.expo, 4.4)
  assert.equal(crop.arg.half, 28)
  const parois = g.journal.find((e) => e.quoi === 'parois')
  assert.equal(parois.arg.fractionProfondeur, 0.125)
  await r.mer
})

test('⑧b sans forme au contexte, `poserCrop` reçoit ses défauts — le carré vif d avant', async () => {
  const g = globeFactice()
  const r = poserChaineCrop({ globe: g, ...contexteFactice()() })
  const crop = g.journal.find((e) => e.quoi === 'crop')
  assert.equal(crop.arg.corner, undefined, 'aucun coin inventé')
  assert.equal(crop.arg.expo, undefined)
  assert.equal(crop.arg.half, undefined)
  await r.mer
})

test('⑧c `formeDuCrop` aplatit les DEUX sous-objets — une grandeur, une veille', () => {
  assert.deepEqual(
    formeDuCrop({ forme: { half: 28, corner: 2.24, expo: 4.4 }, parois: { fractionProfondeur: 0.125 } }),
    { half: 28, corner: 2.24, expo: 4.4, fractionProfondeur: 0.125 })
  // ⚠️ **UN CONTEXTE VIDE REND QUATRE `undefined`, PAS UN OBJET VIDE** : c'est
  // ce qui rend `Object.is` capable de dire « rien n'a changé ».
  assert.deepEqual(formeDuCrop(null), { half: undefined, corner: undefined, expo: undefined, fractionProfondeur: undefined })
  assert.deepEqual(CHAMPS_FORME, ['half', 'corner', 'expo', 'fractionProfondeur'])
})

test('⑧d `formeDifferente` compare par `Object.is`, champ par champ', () => {
  const a = { half: 28, corner: 2.24, expo: 4.4, fractionProfondeur: 0.125 }
  assert.equal(formeDifferente(null, a), true, 'rien de posé : tout diffère')
  assert.equal(formeDifferente(a, { ...a }), false)
  for (const champ of CHAMPS_FORME) {
    assert.equal(formeDifferente(a, { ...a, [champ]: 9 }), true, `${champ} doit être surveillé`)
  }
  // ⚠️ **UN `NaN` DIFFÈRE DE LUI-MÊME SOUS `==` MAIS PAS SOUS `Object.is`** —
  // même contrat qu'`habillageDifferent`, et pour la même raison.
  assert.equal(formeDifferente({ ...a, corner: NaN }, { ...a, corner: NaN }), false)
  assert.equal(formeDifferente(a, { ...a, corner: NaN }), true)
})

test('⑧e un changement de forme rejoue la DÉCOUPE ET LES PAROIS, et RIEN d autre', async () => {
  const g = globeFactice()
  let forme = { half: 28, corner: 2.24, expo: 4.4 }
  const ctx = () => ({ ...contexteFactice()(), forme, parois: { fractionProfondeur: 0.125 } })
  const veille = creerVeilleCrop({ globe: g, contexte: ctx })
  veille.maj(20_000)
  await veille.enVol()
  assert.equal(veille.reformages, 0)
  const avant = g.journal.length
  // même forme : RIEN ne se rejoue
  veille.maj(20_000)
  assert.equal(g.journal.length, avant, 'une forme inchangée ne doit rien rejouer')
  assert.equal(veille.reformages, 0)
  // la tirette bouge
  forme = { half: 28, corner: 11.2, expo: 2 }
  veille.maj(20_000)
  assert.equal(veille.reformages, 1)
  const rejoues = g.journal.slice(avant).map((e) => e.quoi)
  // ⚠️ **DEUX MAILLONS, PAS SIX** : la mer suit par l'uniforme PARTAGÉ
  // `uCropCoin`, et la rampe se remesure au prochain déplacement. Rejouer la
  // chaîne entière coûterait un champ de 385² par image de glissement.
  assert.deepEqual(rejoues, ['crop', 'parois'])
  assert.equal(g.journal[g.journal.length - 2].arg.corner, 11.2)
  // et la profondeur est surveillée AUSSI — elle vit dans l'autre sous-objet
  const avant2 = g.journal.length
  veille.maj(20_000)
  assert.equal(g.journal.length, avant2, 'la forme est posée : plus rien à rejouer')
})

test('⑧f la PROFONDEUR entre dans la même veille que le coin', async () => {
  const g = globeFactice()
  let fraction = 0.125
  const ctx = () => ({
    ...contexteFactice()(),
    forme: { half: 28, corner: 2.24, expo: 4.4 },
    parois: { fractionProfondeur: fraction },
  })
  const veille = creerVeilleCrop({ globe: g, contexte: ctx })
  veille.maj(20_000)
  await veille.enVol()
  const avant = g.journal.length
  fraction = 0.375
  veille.maj(20_000)
  assert.equal(veille.reformages, 1, 'la profondeur doit déclencher un reformage')
  assert.deepEqual(g.journal.slice(avant).map((e) => e.quoi), ['crop', 'parois'])
  assert.equal(g.journal[g.journal.length - 1].arg.fractionProfondeur, 0.375)
})

test('⑧g un reformage qui voit les parois REFUSER les remet dans la file de reprise', async () => {
  const g = globeFactice()
  let forme = { half: 28, corner: 2.24, expo: 4.4 }
  const ctx = () => ({ ...contexteFactice()(), forme, parois: { fractionProfondeur: 0.125 } })
  const veille = creerVeilleCrop({ globe: g, contexte: ctx, periodeReprise: 2 })
  veille.maj(20_000)
  await veille.enVol()
  assert.deepEqual(veille.refus, [], 'témoin : rien ne refuse au départ')
  g.refuse.parois = true
  forme = { half: 28, corner: 11.2, expo: 2 }
  veille.maj(20_000)
  // ⚠️ **UN REFUS PENDANT UN REFORMAGE N'EST PAS PERDU** : sans cette ligne, le
  // bloc garderait une surface arrondie et un flanc carré jusqu'au prochain
  // déplacement — deux formes pour un objet, pire que deux carrés.
  assert.ok(veille.refus.includes('parois'), 'le refus doit rejoindre la file de reprise')
})

test('⑧h `contexteCrop` de `main.js` remplit les deux sous-objets — lecture de SOURCE', () => {
  // ⚠️ **AUCUN TEST NE CHARGE `main.js`** (§0 du plan) : ce garde-fou est une
  // lecture, et il est DÉCLARÉ tel.
  const i = SRC_MAIN.indexOf('function contexteCrop()')
  assert.ok(i > 0)
  const bloc = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n  ctx.rampe =', i))
  assert.match(bloc, /forme: \{/)
  assert.match(bloc, /parois: \{/)
  // ⚠️ **LES UNIFORMES DU SOCLE, PAS `params`** — même règle que pour les dix
  // curseurs d'Atlas et pour les lampes : `terrain.js` porte l'écrêtage du rayon
  // et `exposantCoin`, que `params` ne porte pas.
  assert.match(bloc, /terrain\.mapUniforms\.uSlabCorner/)
  assert.match(bloc, /terrain\.mapUniforms\.uSlabCornerN/)
  assert.match(bloc, /plinth\.depth/)
  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT DE CHERCHER UNE FORMULE** — la
  // Tâche K ter a eu une mutation survivante parce qu'une assertion lisait une
  // formule dans un pavé de prose. Ici le pavé NOMME `params.plinthDepth` pour
  // dire précisément qu'on ne s'en sert pas.
  const code = bloc.replace(/\/\/[^\n]*/g, '')
  assert.ok(!/params\.slabCorner/.test(code), 'la forme ne doit pas passer par params')
  assert.ok(!/params\.plinthDepth/.test(code), 'la profondeur ne doit pas passer par params')
  assert.match(code, /terrain\.mapUniforms\.uSlabCorner/, 'le témoin : le code lui-même porte bien la lecture')
})
