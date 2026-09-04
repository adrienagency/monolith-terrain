// LE SEUIL DU SOCLE, BRANCHÉ — la suite de la Tâche 3 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ POURQUOI CE FICHIER EXISTE ══════════════════════════════════════
//
// La Tâche 3 a livré `socleVisible` — l'automate à deux seuils — et son compte
// rendu se termine par une ligne : « **Rien n'est branché.** `socleVisible` et
// `empriseSocle` ne sont lus par AUCUN module de `src/` ». C'est resté vrai
// jusqu'ici, et **Adrien l'a vu à l'écran avant nous** : à Z5, un socle posé
// devant la Terre entière — « j'ai l'impression que tu calcules 2 fois la map ».
//
// ⚠️ **CE FICHIER GARDE LE BRANCHEMENT, PAS LA LOI.** La loi (les deux seuils,
// l'hystérésis, la trigonométrie du champ) est gardée par
// `test/seuil-socle.test.js`, 25 tests, et rien n'est recopié d'ici. Ce qui est
// gardé ici, c'est ce qui manquait : **l'automate qui tient l'état d'une image à
// l'autre**, et **le câblage de `main.js`** — que le §0 du plan déclare sans
// filet (« AUCUN TEST NE CHARGE `src/main.js` »). Le câblage se garde donc par
// LECTURE du source, précédent explicite de `test/export-effets.test.js`,
// `test/damier-mer.test.js` et neuf autres fichiers de ce dossier.
//
// ⚠️ **LES CHIFFRES DE CE FICHIER ONT ÉTÉ REJOUÉS CONTRE LE DÉPÔT AVANT D'ÊTRE
// ÉCRITS** (règle du §0, et cinq accidents la justifient). Relevés
// (`.banc/rejeu-seuil.mjs`, `.banc/rejeu-arrivee.mjs`, hors dépôt) :
//
//   · `SEUIL_NAISSANCE_M` = 32 274,3 m · `SEUIL_MORT_M` = 40 342,8 m (×1,25)
//   · cent oscillations autour du seuil de naissance → **1 bascule** ;
//     les deux seuils égalisés → **200 bascules**.
//   · l'altitude de cadrage RÉELLE des poses d'arrivée, par palier — c'est
//     elle que `main.js` donne à l'automate, pas l'ancre à 60 % :
//       z4 = 3 680 km · z5 = 920 km · z10 = 51,3 km · z11 = 25,7 km · z13 = 6,4 km
//     donc **la bascule tombe entre z10 et z11**, à mi-chemin des deux seuils —
//     ni l'un ni l'autre n'est frôlé par une pose d'arrivée. ⚠️ **Ce n'était pas
//     acquis** : l'ancre à 60 % de z13 vaut 32,27 km, c'est-à-dire le seuil de
//     naissance AU MÈTRE. Si `main.js` avait donné l'ancre au lieu de
//     l'altitude, le socle serait né pile sur sa frontière.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { creerVeilleSocle } from '../src/monde/veille-socle.js'
import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_MAIN = fs.readFileSync(path.join(RACINE, 'src/main.js'), 'utf8')
const SRC_MODES = fs.readFileSync(path.join(RACINE, 'src/modes.js'), 'utf8')

// Un mouchard : il note ce que la veille APPLIQUE, et quand.
function mouchard() {
  const vus = []
  return { appliquer: (v) => vus.push(v), vus }
}

// ══════════ ① L'ALTITUDE ORBITALE — LA VUE D'ADRIEN ═════════════════════════

test('à 4 000 km le socle n’est pas posé ; sous le seuil de naissance, il l’est', () => {
  const m = mouchard()
  const veille = creerVeilleSocle({ appliquer: m.appliquer })
  // au départ le socle est là — c'est l'état de l'application au chargement
  assert.equal(veille.visible, true)
  assert.deepEqual(m.vus, [], 'rien ne doit être appliqué tant que rien ne change')

  // ⚡ **D21 ① — SANS INTENTION, 4 000 km NE TUENT RIEN.** C'est le défaut
  // qu'Adrien nomme : « on ne puisse plus revenir en mode non crop uniquement
  // par l'altitude ». Le socle survit à dix fois son seuil de mort.
  assert.equal(veille.maj(4_000_000), true, 'le socle meurt sans intention — D21 ① tombe')
  assert.equal(veille.visible, true)
  assert.deepEqual(m.vus, [], 'et rien n’a été appliqué')

  // 4 000 km AVEC l'intention (un dézoom explicite) : le socle doit PARTIR.
  veille.armerSortie()
  assert.equal(veille.maj(4_000_000), false)
  assert.equal(veille.visible, false)
  assert.deepEqual(m.vus, [false])

  // puis on redescend sous le seuil de naissance : il REVIENT.
  assert.equal(veille.maj(SEUIL_NAISSANCE_M * 0.5), true)
  assert.equal(veille.visible, true)
  assert.deepEqual(m.vus, [false, true])
})

test('les altitudes de cadrage des poses d’arrivée : le socle vit à z11 et plus fin', () => {
  // ⚠️ VALEURS REJOUÉES (`.banc/rejeu-arrivee.mjs`) : `altitudeSurfaceM` à la
  // pose d'arrivée (`distanceArrivee(150)` = 141, pente 18/19 → camY = 96,972),
  // `blockExtentMeters(z, 45)`, exagération de palier. Elles ne sont PAS
  // recalculées ici : ce test dit ce que le branchement doit produire, et il
  // rougirait si la loi bougeait sous lui.
  const ALT_ARRIVEE_M = {
    4: 3_680_260, 5: 920_060, 6: 575_040, 7: 359_400, 8: 205_370, 9: 102_690,
    10: 51_340, 11: 25_670, 12: 12_840, 13: 6_420, 14: 3_210, 15: 1_600,
  }
  // ⚡ **D21 ③ — LE SOCLE NAÎT DÉSORMAIS DÈS z7, ET LA MESURE DIT MÊME UN CRAN
  // PLUS TÔT.** Il était absent jusqu'à z10 inclus ; `SEUIL_NAISSANCE_M` vaut
  // maintenant 600 000 m. Rejoué contre la table ci-dessus, la ligne de partage
  // tombe entre **z5 (920 060 m)** et **z6 (575 040 m)** : la pose d'arrivée z6
  // est déjà 24 960 m SOUS le seuil. Adrien demande « dès z7 » — au plus tard
  // z7 — et c'est tenu avec un cran de marge, pas raté.
  const veilleBas = creerVeilleSocle({ appliquer: () => {}, socleAuDepart: false })
  for (const z of [4, 5]) {
    assert.equal(veilleBas.maj(ALT_ARRIVEE_M[z]), false, `le socle ne devrait pas naître à z${z}`)
  }
  assert.ok(ALT_ARRIVEE_M[6] < SEUIL_NAISSANCE_M && ALT_ARRIVEE_M[5] > SEUIL_NAISSANCE_M,
    'la ligne de partage a quitté l’intervalle z5 / z6 — le chiffre de D21 ③ est à refaire')
  for (const z of [6, 7, 8, 9, 10]) {
    assert.equal(veilleBas.maj(ALT_ARRIVEE_M[z]), true, `D21 ③ : le socle doit vivre à z${z}`)
  }
  for (const z of [11, 12, 13, 14, 15]) {
    assert.equal(veilleBas.maj(ALT_ARRIVEE_M[z]), true, `le socle devrait vivre à z${z}`)
  }
  // ⚡ **ET EN REMONTANT — LES DEUX RÈGLES DE D21 SE CROISENT ICI.**
  // ① sans intention, AUCUNE pose d'arrivée ne tue le crop, pas même z4 ;
  // ③ avec l'intention, l'hystérésis (750 000 m) le tue entre z6 et z5.
  const veilleHaut = creerVeilleSocle({ appliquer: () => {}, socleAuDepart: true })
  for (const z of [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4]) {
    assert.equal(veilleHaut.maj(ALT_ARRIVEE_M[z]), true,
      `D21 ① : le socle meurt à z${z} sans qu’on l’ait demandé`)
  }
  veilleHaut.armerSortie()
  for (const z of [15, 14, 13, 12, 11, 10, 9, 8, 7, 6]) {
    assert.equal(veilleHaut.maj(ALT_ARRIVEE_M[z]), true, `le socle devrait survivre à z${z}`)
  }
  assert.equal(veilleHaut.maj(ALT_ARRIVEE_M[5]), false, 'intention armée, le socle meurt à z5')
})

// ══════════ ② CELUI QUI COMPTE : CENT OSCILLATIONS, UNE BASCULE ═════════════

test('cent oscillations autour du seuil de NAISSANCE ne produisent qu’UNE bascule', () => {
  // ⚠️ **C'EST LE TEST QUE LA MUTATION DOIT TUER.** Égaliser les deux seuils
  // (`RAPPORT_HYSTERESIS = 1`) rend **200 bascules** — rejoué, pas supposé.
  const m = mouchard()
  const veille = creerVeilleSocle({ appliquer: m.appliquer, socleAuDepart: false })
  const bas = SEUIL_NAISSANCE_M * 0.999
  const haut = SEUIL_NAISSANCE_M * 1.001
  for (let i = 0; i < 100; i++) { veille.maj(bas); veille.maj(haut) }
  assert.equal(veille.bascules, 1, 'un doigt qui tremble au seuil ne doit pas faire clignoter le socle')
  assert.deepEqual(m.vus, [true])
  assert.equal(veille.visible, true, 'et il reste NÉ : on est sous le seuil de mort')
})

test('cent oscillations autour du seuil de MORT ne produisent qu’UNE bascule', () => {
  const m = mouchard()
  const veille = creerVeilleSocle({ appliquer: m.appliquer, socleAuDepart: true })
  const bas = SEUIL_MORT_M * 0.999
  const haut = SEUIL_MORT_M * 1.001
  // ⚡ D21 ① : sans intention, cent oscillations au seuil de mort ne font RIEN.
  for (let i = 0; i < 100; i++) { veille.maj(haut); veille.maj(bas) }
  assert.equal(veille.bascules, 0)
  assert.equal(veille.visible, true)
  // avec l'intention, l'hystérésis reprend ses droits : UNE bascule, pas 200
  veille.armerSortie()
  for (let i = 0; i < 100; i++) { veille.maj(haut); veille.maj(bas) }
  assert.equal(veille.bascules, 1)
  assert.deepEqual(m.vus, [false])
  assert.equal(veille.visible, false, 'et il reste MORT : on est au-dessus du seuil de naissance')
})

test('la veille n’applique QUE sur changement — mille images stables, zéro appel', () => {
  // Sans cette garde, `appliquer` repasserait quatorze calques par image : la
  // liste de `setSurfaceVisible` touche `terrain`, `labels`, `hud3`, `gpxLayer`,
  // `clouds`, `plinth`, `regionSkirt`, `groundInfo`, `traffic`, `realWater`,
  // `mapLayers` et trois boutons.
  const m = mouchard()
  const veille = creerVeilleSocle({ appliquer: m.appliquer })
  for (let i = 0; i < 1000; i++) veille.maj(2_200) // le Mont-Blanc du vol de référence
  assert.deepEqual(m.vus, [])
  assert.equal(veille.bascules, 0)
})

// ══════════ ③ L'ORBITE — LE SEUIL SE TAIT, ET CE N'EST PAS UN CONFORT ═══════

test('en orbite la veille GÈLE le seuil : l’altitude de bloc n’y veut plus rien dire', () => {
  // ⚠️ En mode orbital la caméra vit sur la sphère de rayon 100, pas au-dessus
  // du bloc : `altitudeCadrageM()` y mesure une grandeur qui n'a plus de sens.
  // La laisser piloter l'automate reviendrait à décider la naissance du socle
  // sur du bruit.
  const m = mouchard()
  const veille = creerVeilleSocle({ appliquer: m.appliquer })
  veille.poserMode(false)
  assert.equal(veille.visible, false)
  assert.deepEqual(m.vus, [false])
  // mille images d'orbite, à des altitudes absurdes : rien ne bouge
  for (const alt of [0, 1, 1e9, -5, 32_000]) veille.maj(alt)
  assert.deepEqual(m.vus, [false], 'aucune altitude ne doit ressortir le socle en orbite')
  // au retour en surface, l'état d'avant est rendu, puis la première image tranche
  veille.poserMode(true)
  assert.deepEqual(m.vus, [false, true])
  // ⚡ D21 ① : la première altitude de surface décide — SI l'intention est armée
  veille.armerSortie()
  assert.equal(veille.maj(4_000_000), false, 'et la première altitude de surface décide')
  assert.deepEqual(m.vus, [false, true, false])
})

test('le socle est le ET des deux : le mode orbital gagne toujours', () => {
  const veille = creerVeilleSocle({ appliquer: () => {}, socleAuDepart: true })
  veille.maj(2_200) // largement sous le seuil
  assert.equal(veille.visible, true)
  veille.poserMode(false)
  assert.equal(veille.visible, false, 'sous le seuil ou pas, l’orbite éteint le socle')
})

test('une altitude non finie conserve l’état — elle ne peut pas décider', () => {
  const m = mouchard()
  const veille = creerVeilleSocle({ appliquer: m.appliquer })
  for (const mauvaise of [NaN, Infinity, -Infinity, undefined, null, '32000']) {
    assert.equal(veille.maj(mauvaise), true, `${String(mauvaise)} ne doit rien changer`)
  }
  assert.deepEqual(m.vus, [])
})

test('la veille EXIGE son applicateur — un branchement muet est un branchement absent', () => {
  assert.throws(() => creerVeilleSocle({}), TypeError)
  assert.throws(() => creerVeilleSocle({ appliquer: 'oui' }), TypeError)
})

// ══════════ ④ LE CÂBLAGE DE `main.js` — LU, PAS CHARGÉ ══════════════════════

test('`main.js` importe la veille et lui donne l’ALTITUDE, pas une fraction d’écran', () => {
  // ⚠️ **RÈGLE R1**, et c'est la seule chose que ce fichier ne peut pas prouver
  // autrement. Une fraction d'écran dépendrait de la distance au sol, donc du
  // terrain chargé, donc de `meanM` lissé : gain + retard = oscillateur.
  assert.match(SRC_MAIN, /import\s*\{[^}]*creerVeilleSocle[^}]*\}\s*from\s*'\.\/monde\/veille-socle\.js'/)
  assert.match(SRC_MAIN, /veilleSocle\.maj\(\s*altitudeCadrageM\(\)\s*\)/,
    'la veille doit être nourrie par `altitudeCadrageM()`, l’instrument SANS `dem.meanM`')
  // et rien d'autre ne la nourrit
  const appels = SRC_MAIN.match(/veilleSocle\.maj\(/g) || []
  assert.equal(appels.length, 1, 'un seul point d’alimentation, sinon deux lois')
})

test('la veille est appelée DANS `tick()`, avant le dessin', () => {
  // ⚠️ Retirer cet appel est la mutation de l'Étape 5 : elle doit tuer ce test.
  const iTick = SRC_MAIN.indexOf('\nfunction tick() {')
  assert.ok(iTick > 0, 'la boucle d’image s’appelle toujours `tick()`')
  const iAppel = SRC_MAIN.indexOf('majSeuilSocle()', iTick)
  const iRender = SRC_MAIN.indexOf('composer.render(dtAmb)', iTick)
  assert.ok(iAppel > iTick, '`majSeuilSocle()` doit être appelé dans `tick()`')
  assert.ok(iRender > iAppel, 'et AVANT le dessin de l’image')
  // il est piloté par le mode, pas par le hasard : `modes.update` d'abord
  const iModes = SRC_MAIN.indexOf('modes.update(dt)', iTick)
  assert.ok(iModes > 0 && iAppel > iModes, 'le seuil se lit APRÈS `modes.update(dt)`')
})

test('UNE SEULE liste de calques — le socle et le mode orbital passent par la même', () => {
  // ⚠️ **CE FICHIER RACONTE CINQ FOIS L'ACCIDENT DE LA LISTE DUPLIQUÉE** (voir
  // le §0 du plan, et `entrerEnVol` : « une seconde liste aurait divergé au
  // premier calque ajouté »). Le seuil ne fabrique donc PAS sa propre liste :
  // il rappelle celle de `setSurfaceVisible`.
  // ⚠️ **`vue.socle` DEPUIS LA TÂCHE R1 ②** — l'entrée est bornée par
  // `visibiliteSurface`, la liste, elle, n'a pas bougé : toujours une seule.
  const listes = SRC_MAIN.match(/terrain\.mesh\.visible = vue\.socle\b/g) || []
  assert.equal(listes.length, 1, 'la liste des calques du socle doit être écrite UNE fois')
  assert.match(SRC_MAIN, /function poserVisibiliteSocle\s*\(\s*v\s*\)/)
  assert.match(SRC_MAIN, /creerVeilleSocle\(\s*\{\s*appliquer:\s*poserVisibiliteSocle/)
  // et le hook de `modes.js` passe par la veille, pas par la liste en direct
  // (fenêtre élargie : la branche `terre unique` de ce hook porte maintenant le
  // relais des boutons de surface — Tâche R1 ② — et son commentaire avec)
  assert.match(SRC_MAIN, /setSurfaceVisible\s*\(v\)\s*\{[\s\S]{0,4000}?veilleSocle\.poserMode\(v\)/)
})

test('`main.js` lit le drapeau : la production garde son socle à tous les zooms', () => {
  assert.match(SRC_MAIN, /import\s*\{[^}]*seuilSocleActif[^}]*\}\s*from\s*'\.\/flags\.js'/)
  assert.match(SRC_MAIN, /function majSeuilSocle\(\)/)
  // la garde est DANS `majSeuilSocle`, donc l'appel de `tick()` est inconditionnel
  const i = SRC_MAIN.indexOf('function majSeuilSocle()')
  const corps = SRC_MAIN.slice(i, i + 1400)
  assert.match(corps, /seuilSocle/, 'sans drapeau, `majSeuilSocle` doit rendre la main tout de suite')
})

test('`modes.js` n’appelle `setSurfaceVisible` que sur une VRAIE transition', () => {
  // ⚠️ C'est ce qui garantit que « n'appliquer que sur changement » ne perd
  // rien : les deux appels alternent parce qu'ils sont gardés par le mode.
  const appels = SRC_MODES.match(/hooks\.setSurfaceVisible\(/g) || []
  assert.equal(appels.length, 2, 'deux sites : `enterOrbit` et `_dive`')
  assert.match(SRC_MODES, /async enterOrbit\([\s\S]{0,200}?if \(this\.mode !== 'surface' \|\| this\.busy\) return/)
  assert.match(SRC_MODES, /async _dive\([\s\S]{0,200}?if \(this\.mode !== 'orbital' \|\| this\.busy\) return/)
})

// ══════════ ⑤ LE GARDE QUI MANQUAIT AU GLOBE — TROUVÉ À L'ÉCRAN ═════════════
//
// ⚠️ **CE TEST N'EXISTE QUE PARCE QU'ON A REGARDÉ.** Le seuil retirait bien le
// socle à Z5… et découvrait une **boule blanche sans continent**. Cause :
// `_dive` pose `globe.setVisible(false)`, donc `enabled = false`, donc
// `Globe.update()` sortait à sa première ligne — alors que `main.js` l'appelle
// EXPRÈS en mode surface sous la frontière, avec un commentaire qui prévient que
// « sans cet appel il reste à ses seize racines ». **L'appel existait et ne
// faisait rien.**
//
// Mesuré au navigateur (`?globe=crans&frontiere=1`, La Réunion dézoomée à z5,
// altitude de cadrage **847 km**) : cache du quadtree **16 tuiles**,
// `update()` rend **0**. Le seul fait de lever `enabled` le fait passer à
// **52 tuiles en une image**, et la Terre retrouve Madagascar et l'Afrique.
//
// ⚠️ `frontiereFond` n'est vrai que sous le drapeau : sans drapeau, le garde est
// celui d'avant, au caractère près — c'est la troisième assertion.

class FauxCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData(x, y, w) { return { data: new Uint8ClampedArray(w * w * 4) } }
}
globalThis.document = globalThis.document || {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FauxCtx())
    return c
  },
}
globalThis.createImageBitmap = async (b) => b
// ⚠️ une promesse qui ne se résout JAMAIS : on veut compter les images, pas
// faire tourner un décodage de tuile.
globalThis.fetch = async () => new Promise(() => {})

const THREE = await import('three')
const { Globe } = await import('../src/globe.js')

function camGlobeFactice() {
  const c = new THREE.PerspectiveCamera(30, 1.6, 0.1, 1400)
  c.position.set(0, 0, 300)
  return c
}

test('un globe ÉTEINT sans frontière ne parcourt rien — le comportement d’avant', () => {
  const g = new Globe({})
  g.setVisible(false)
  const f = g.frame
  assert.equal(g.update(camGlobeFactice(), 0.016), 0)
  assert.equal(g.frame, f, 'la boucle du quadtree ne doit pas tourner')
})

test('un globe éteint mais EN FOND parcourt quand même : c’est lui l’arrière-plan', () => {
  const g = new Globe({})
  g.frontiereFond = true // ce que `main.js` pose sous `?frontiere=1`
  g.setVisible(false) // ce que `_dive` fait à chaque entrée en surface
  const f = g.frame
  g.update(camGlobeFactice(), 0.016)
  assert.notEqual(g.frame, f, 'sans ça, la planète de fond reste à ses seize racines')
})

test('un globe ALLUMÉ parcourt, frontière ou pas', () => {
  const g = new Globe({})
  g.setVisible(true)
  const f = g.frame
  g.update(camGlobeFactice(), 0.016)
  assert.notEqual(g.frame, f)
})

// ══════════ ⑥ AUCUN CALQUE ORPHELIN — L'ÉTAPE 4, GARDÉE ═════════════════════
//
// ⚠️ **CE TEST N'EXISTE, LUI AUSSI, QUE PARCE QU'ON A REGARDÉ.** `main.js` a
// DIX-SEPT ré-affirmations de visibilité de calques de socle, toutes écrites
// `modes.mode === 'surface'` — qui ne connaît que le MODE, jamais le seuil. La
// pire est dans `fetchAndBuildDem` : elle rallume le cartouche à CHAQUE palier.
// Mesuré au navigateur (Z5, altitude de cadrage 1 172 km, socle retiré) : le
// cartouche `ground-info` et ses **huit mailles** restaient dessinés SUR la
// planète. C'était le seul orphelin, et il a fallu l'écran pour le voir.
//
// La garde : **aucune ligne qui pose la visibilité d'un calque de socle ne doit
// interroger le mode elle-même.** Elle passe par `socleAffiche()`, qui rend
// l'expression d'avant quand le drapeau est éteint.

const POSEURS_DE_CALQUE = [
  /\bgroundInfo\.setVisible\(/, /\bplinth\.setVisible\(/, /\bclouds\.setVisible\(/,
  /\brealWater\?\.setVisible\(/, /\blabels\.visible\s*=/, /\bhud3\.group\.visible\s*=/,
  /\bgpxLayer\.setVisible\(/, /\btraffic\.setVisible\(/, /\bmapCorner\?\.setVisible\(/,
]
const MODE_EN_DUR = /modes\??\.mode\s*(===\s*'surface'|!==\s*'orbital')/

test('aucun calque de socle ne décide seul de sa visibilité', () => {
  const coupables = []
  SRC_MAIN.split(/\r?\n/).forEach((l, i) => {
    if (!POSEURS_DE_CALQUE.some((r) => r.test(l))) return
    if (MODE_EN_DUR.test(l)) coupables.push(`${i + 1}: ${l.trim()}`)
  })
  assert.deepEqual(coupables, [], 'ces lignes ré-affirment la visibilité sans passer par `socleAffiche()`')
})

test("`socleAffiche()` rend l'expression d'avant quand le drapeau est éteint", () => {
  // ⚠️ C'est ce qui garantit qu'aucune de ces dix-sept lignes ne change en
  // production : il n'y a que DEUX modes, donc `!== 'orbital'` est le même
  // prédicat que `=== 'surface'`, et le `?.` couvre le `!modes ||` d'origine.
  // ⚠️ **AMENDÉ PAR LA TÂCHE I (« UNE SEULE TERRE »), ET L'INTENTION EST
  // INTACTE.** Le prédicat porte désormais une garde de plus AVANT lui —
  // `if (terreUniqueBranchee) return false`, parce que sous ce drapeau-là le bloc
  // plat a cédé la place à un crop dans la planète et qu'aucun des dix-sept sites
  // ne doit le rallumer. **Ce que ce test garde n'a pas bougé** : le chemin
  // DRAPEAU ÉTEINT reste l'expression d'avant, au caractère près, et c'est elle
  // qui est exigée ici. La garde ajoutée est gardée, elle, par
  // `test/crop-branche.test.js` (⑧ quater).
  assert.match(
    SRC_MAIN,
    /function socleAffiche\(\)\s*\{[^}]*?\breturn seuilSocleBranche \? veilleSocle\.visible : modes\?\.mode !== 'orbital'\s*\}/,
  )
  const modesPoses = [...new Set(SRC_MODES.match(/this\.mode = '[a-z]+'/g) || [])].sort()
  assert.deepEqual(modesPoses, ["this.mode = 'orbital'", "this.mode = 'surface'"],
    'si un TROISIÈME mode apparaissait, `!== orbital` cesserait d’être `=== surface`')
})

test('les dix-sept sites passent bien par le prédicat unique', () => {
  const n = (SRC_MAIN.match(/socleAffiche\(\)/g) || []).length
  assert.ok(n >= 18, `attendu au moins 18 emplois de socleAffiche() (17 sites + la déclaration), trouvé ${n}`)
})

// ══════════ ⑦ LE CRAN EST UN OSCILLATEUR — LA GARDE QUI L'ÉTEINT ════════════
//
// ⚠️ **MESURÉ À L'ÉCRAN, PAS DÉDUIT.** Sept crans z5 → z12 sous
// `?globe=crans&frontiere=1&seuil=1` (La Réunion) : **ONZE bascules** au lieu
// d'une. Journal par image, au moment d'un cran z9 → z10 :
//
//   alt 40 751 · socle 1 · busy 0 · largeur 219 km · camY 29,19
//   alt 20 375 · socle 0 · busy 1 · largeur 109 km · camY 29,19   ← désaccord
//   alt 40 751 · socle 1 · busy 0 · largeur 109 km · camY 58,38
//
// `largeurBlocM()` est divisée par deux UNE IMAGE AVANT que `_rescale` ne
// double `camera.position.y` : l'altitude lue vaut alors exactement la MOITIÉ de
// la vraie, et la moitié de 40 751 m tombe de l'autre côté des deux seuils.
// **`modes.busy` est vrai sur toutes les images du transitoire.**

test('le seuil ne décide pas pendant un cran — la garde `busy`', () => {
  const i = SRC_MAIN.indexOf('function majSeuilSocle()')
  assert.ok(i > 0)
  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}', i))
  assert.match(corps, /if \(modes\?\.busy \|\| !\(largeurBlocM\(\) > 0\)\) return/,
    'sans cette ligne, chaque cran fait naître puis mourir le socle')
  // la garde doit précéder l'appel, sinon elle ne garde rien
  assert.ok(corps.indexOf('modes?.busy') < corps.indexOf('veilleSocle.maj('))
})

test('la seconde garde a sa raison : sans emprise, `altitudeCadrageM` change de loi', () => {
  // ⚠️ Rejoué contre le dépôt : `altitudeCadrageM()` a DEUX branches, et la
  // seconde n'est pas une altitude de cadrage du tout — c'est le relief
  // procédural converti en pieds. `entrerEnVol` ouvre cet instant en posant
  // `dem = null` le temps du vol.
  const i = SRC_MAIN.indexOf('function altitudeCadrageM()')
  assert.ok(i > 0)
  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}', i))
  assert.match(corps, /largeurBlocM\(\)/)
  assert.match(corps, /terrain\.heightToFeet\(camera\.position\.y\) \/ 3\.28084/,
    'la branche de repli existe toujours — c’est elle que la garde évite')
})

// ══════════ LE DRAPEAU — LEVÉ, SA GARDE ET SON ÉCHAPPATOIRE, ÉVALUÉES ═══════
//
// ⛔ **CE BLOC N'EXISTAIT PAS, ET C'ÉTAIT UN TROU MESURÉ** : au 2026-08-30,
// `grep -rn 'FLAGS.seuilSocle' test/` ne rendait RIEN. Le fichier lisait le
// CÂBLAGE de `main.js` (par le texte source) mais jamais la valeur rendue par
// `seuilSocleActif()`. Mettre le défaut à `false`, inverser les deux branches
// de l'échappatoire, ou SUPPRIMER LA GARDE DE DÉPENDANCE ne faisait rougir
// aucun des 4 293 tests.

test('le drapeau `seuilSocle` est LEVÉ par défaut — le socle s’efface en altitude au chargement', async () => {
  const { FLAGS } = await import('../src/flags.js')
  assert.equal(FLAGS.seuilSocle, true,
    'le mode sphère est le démarrage : au-dessus du seuil, c’est la Terre qu’on voit, plus le bloc')
})

test('⛔ `seuilSocleActif()` EXIGE la frontière de rendu — la garde, ÉVALUÉE', async () => {
  // ⚠️ **LA GARDE NE SE TESTE PLUS PAR L'ABSENCE DE PARAMÈTRE.** Sans la passe
  // de fond, au-dessus du seuil il n'y aurait pas la Terre derrière le socle,
  // il n'y aurait RIEN. Tant que `frontiereRendu` était éteint par défaut, un
  // `?seuil=1` nu suffisait à montrer la garde ; depuis qu'il est levé, la même
  // ligne rend `true` — pour la bonne raison, mais elle ne prouve plus rien. La
  // garde s'exerce donc contre une frontière **explicitement éteinte**.
  const { FLAGS, seuilSocleActif } = await import('../src/flags.js')
  const avant = globalThis.location
  const defaut = FLAGS.seuilSocle
  const q = (s) => { globalThis.location = { search: s } }
  try {
    // ① la garde de dépendance
    q('?seuil=1&frontiere=0')
    assert.equal(seuilSocleActif(), false, '`?seuil=1` ne doit rien allumer sans la frontière')
    q('?seuil=1&frontiere=crans')
    assert.equal(seuilSocleActif(), false, 'et `?frontiere=crans` la coupe pareillement')
    q('?seuil=1&frontiere=1')
    assert.equal(seuilSocleActif(), true)

    // ② le défaut, lu sur la VALEUR RENDUE
    q('')
    assert.equal(seuilSocleActif(), true, 'adresse nue : le seuil du socle est armé')
    q('?frontiere=0')
    assert.equal(seuilSocleActif(), false, 'la garde prime sur le défaut levé')

    // ③ les DEUX branches de l'échappatoire, chacune contre le défaut CONTRAIRE
    q('?frontiere=1&seuil=toujours')
    assert.equal(seuilSocleActif(), false, '`?seuil=toujours` doit COUPER un défaut allumé')
    q('?frontiere=1&seuil=0')
    assert.equal(seuilSocleActif(), false, '`?seuil=0` aussi')
    FLAGS.seuilSocle = false
    q('?frontiere=1')
    assert.equal(seuilSocleActif(), false, 'défaut éteint : la frontière ne suffit pas')
    q('?frontiere=1&seuil=altitude')
    assert.equal(seuilSocleActif(), true, '`?seuil=altitude` doit ALLUMER un défaut éteint')
    q('?frontiere=1&seuil=1')
    assert.equal(seuilSocleActif(), true, '`?seuil=1` aussi')
  } finally {
    FLAGS.seuilSocle = defaut
    if (avant === undefined) delete globalThis.location
    else globalThis.location = avant
  }
})
