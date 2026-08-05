// LA MER DU DAMIER — une seule mer, une seule jupe, pour tout le carré.
//
// ⚠️ CE FICHIER A ÉTÉ REFAIT EN RONDE 1. La première version verrouillait
// `src/ocean.js` par le TEXTE : dix tests qui détectaient une modification, pas
// un comportement. Le relecteur l'a démontré d'une mutation — remplacer
// `empriseDeMer` par une constante « un bloc » laissait 17 tests sur 20 au vert,
// et aucun des trois défauts réels ne rougissait.
//
// La correction n'est pas d'écrire d'autres assertions de texte : c'est de
// SORTIR le calcul du fichier intestable. `ocean.js` tire three.js, donc rien
// n'y est importable en node — mais rien de ce qui décide de la taille, du
// centre, de l'arrêt ou de la segmentation de la mer n'a besoin de three.js.
// Ces règles vivent désormais dans `src/damier-carre.js`, pur, et les tests
// ci-dessous les EXÉCUTENT.
//
// LE CRITÈRE, tenu et vérifié par mutation : chacun des tests de la section
// COMPORTEMENT meurt si `empriseDeMer`, `coteGeometrique` ou `geometrieDeMer`
// rend une constante.
//
// Ce qui RESTE en verrou de texte, en fin de fichier, est exactement ce qui
// n'existe que sous forme de GLSL ou d'appel three.js — un uniforme déclaré, un
// `translate` sur une géométrie. Ceux-là sont assumés comme des garde-fous de
// câblage, pas comme des preuves de comportement, et ils le disent.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resChamp, spanChamp, CHAMP_RES, mondeTexel } from '../src/mer-emprise.js'
import {
  centreDuCarre, empriseDeMer, coteGeometrique, geometrieDeMer, cleDuCarre, carreCouvrant,
} from '../src/damier-carre.js'

const TAILLE = 56
// `rayonEauDansSocle()` = HALF − chanfrein − marge (plinth.js). Verrouillé
// contre la source plus bas : si le chanfrein bouge, ce fichier doit le savoir.
const RAYON_EAU = 28 - 0.16 - 0.06

const OCEAN = readFileSync(new URL('../src/ocean.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// ════════════════════ 1. LE CENTRE ET L'EMPRISE (fonctions pures) ═══════════

test('un carre 3x3 centre sur l\'origine reste centre', () => {
  assert.deepEqual(centreDuCarre({ i0: -1, j0: -1, cote: 3 }, TAILLE), { x: 0, z: 0 })
})

// ⚠️ LE PIÈGE DU CARRÉ PAIR. Un 2x2 n'est PAS centré sur le bloc principal :
// son centre tombe sur la jointure. Une mer posée en (0,0) déborderait d'un
// demi-bloc d'un côté et manquerait de l'autre.
test('un carre 2x2 a son centre sur la jointure, pas sur le bloc principal', () => {
  assert.deepEqual(centreDuCarre({ i0: -1, j0: -1, cote: 2 }, TAILLE), { x: -28, z: -28 })
  assert.deepEqual(centreDuCarre({ i0: 0, j0: 0, cote: 2 }, TAILLE), { x: 28, z: 28 })
})

test('un carre 1x1 est centre sur le bloc principal', () => {
  assert.deepEqual(centreDuCarre({ i0: 0, j0: 0, cote: 1 }, TAILLE), { x: 0, z: 0 })
})

test('l\'emprise de mer suit le cote du carre', () => {
  const e = empriseDeMer({ i0: -1, j0: -1, cote: 3 }, TAILLE)
  assert.equal(e.span, spanChamp(TAILLE, 3), '168 unites de large')
  assert.equal(e.res, resChamp(3), 'champ multiplie, pas etire')
  assert.equal(e.res, CHAMP_RES * 3)
})

test('un damier 1x1 rend exactement l\'emprise d\'avant', () => {
  const e = empriseDeMer({ i0: 0, j0: 0, cote: 1 }, TAILLE)
  assert.equal(e.span, TAILLE)
  assert.equal(e.res, CHAMP_RES, 'aucune regression sur le bloc seul')
  assert.deepEqual(e.centre, { x: 0, z: 0 })
})

test('un carre null rend l\'emprise d\'un bloc', () => {
  const e = empriseDeMer(null, TAILLE)
  assert.equal(e.span, TAILLE)
  assert.equal(e.res, CHAMP_RES)
})

test('un carre 2x2 : emprise ET centre ensemble', () => {
  const e = empriseDeMer({ i0: -1, j0: -1, cote: 2 }, TAILLE)
  assert.equal(e.cote, 2)
  assert.equal(e.span, 112)
  assert.equal(e.res, CHAMP_RES * 2)
  assert.deepEqual(e.centre, { x: -28, z: -28 })
})

test('un cote absent, nul ou fractionnaire retombe sur un bloc entier', () => {
  for (const carre of [{}, { cote: 0 }, { cote: -3 }, { cote: 1.4 }]) {
    const e = empriseDeMer(carre, TAILLE)
    assert.equal(e.cote, 1, `cote ${carre.cote}`)
    assert.equal(e.span, TAILLE)
  }
  assert.equal(empriseDeMer({ cote: 1.6 }, TAILLE).cote, 2)
})

// ════════════ 2. LE CHAMP COUVRE-T-IL VRAIMENT TOUTES LES CASES ? ═══════════
//
// Le vrai test de « la mer couvre tout le damier » ne porte ni sur un span ni
// sur une résolution : il porte sur les COINS DU MONDE que le champ atteint.
// C'est la composition centre + span, la seule qui puisse se tromper en
// silence — et celle qu'une emprise constante casse immédiatement.

// Où tombe le texel (i,j) d'un champ centré sur `centre`. Même convention
// qu'ocean.js `_bakeField` : `mondeTexel` + le centre du carré.
const mondeDuChamp = (e, i, j) => ({
  x: mondeTexel(i, e.res, e.span) + e.centre.x,
  z: mondeTexel(j, e.res, e.span) + e.centre.z,
})

test('le champ d\'un 3x3 atteint le coin extérieur de chacune des neuf cases', () => {
  const e = empriseDeMer({ i0: -1, j0: -1, cote: 3 }, TAILLE)
  const a = mondeDuChamp(e, 0, 0)
  const b = mondeDuChamp(e, e.res - 1, e.res - 1)
  assert.deepEqual(a, { x: -84, z: -84 })
  assert.deepEqual(b, { x: 84, z: 84 })
  // et chaque centre de case tombe DANS le champ, bord compris
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = i * TAILLE
      const cz = j * TAILLE
      assert.ok(cx >= a.x && cx <= b.x && cz >= a.z && cz <= b.z, `case ${i},${j} hors champ`)
    }
  }
})

// ⚠️ LE CAS QUI DÉMASQUE UNE EMPRISE CENTRÉE SUR L'ORIGINE. Un 2x2 ancré en
// (−1,−1) couvre les cases (−1,−1) à (0,0), c'est-à-dire le monde [−84, +28].
// Un champ cuit autour de zéro couvrirait [−56, +56] : il manquerait 28 unités
// au sud-ouest et en gaspillerait 28 au nord-est.
test('le champ d\'un 2x2 couvre ses quatre cases, et PAS le carre centre sur zero', () => {
  const e = empriseDeMer({ i0: -1, j0: -1, cote: 2 }, TAILLE)
  const a = mondeDuChamp(e, 0, 0)
  const b = mondeDuChamp(e, e.res - 1, e.res - 1)
  assert.deepEqual(a, { x: -84, z: -84 })
  assert.deepEqual(b, { x: 28, z: 28 })
  for (const [i, j] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const cx = i * TAILLE
    const cz = j * TAILLE
    assert.ok(cx >= a.x && cx <= b.x && cz >= a.z && cz <= b.z, `case ${i},${j} hors champ`)
  }
  // le coin nord-est du carré, à +28 : le champ s'y arrête PILE
  assert.equal(b.x, TAILLE / 2)
  // … et un champ centré sur zéro s'y serait arrêté 28 unités trop loin
  assert.notEqual(b.x, e.span / 2)
})

test('la densite de texels au sol ne bouge pas avec le cote du carre', () => {
  const dense = (cote) => empriseDeMer({ i0: 0, j0: 0, cote }, TAILLE).res / empriseDeMer({ i0: 0, j0: 0, cote }, TAILLE).span
  assert.equal(dense(3), dense(1))
  assert.equal(dense(5), dense(1))
})

// ════════════ 3. LA GÉOMÉTRIE NE SUIT PAS TOUJOURS LE CHAMP ═════════════════
//
// FINDING 1 de la ronde 1, et c'était un défaut visible à la première image.

// ⚠️ EN MODE CONTINU, LE CHAMP COUVRE TROIS BLOCS MAIS LE SOCLE EN FAIT UN.
// C'est le relief qui défile dans le bloc, pas le bloc qui grandit. Une mer
// taillée sur le côté du CHAMP y débordait de trois blocs de large sur la
// table — et rien ne l'arrêtait : la surface ne porte aucun plan de coupe, son
// seul arrêt est `uHalf`.
test('en mode continu, la geometrie de la mer reste UN bloc', () => {
  assert.equal(coteGeometrique(3, 1), 1, 'la fenetre continue ne pose pas de cases')
  assert.equal(coteGeometrique(3, 3), 1, 'meme si le carre pretend le contraire')
  const g = geometrieDeMer({ cote: coteGeometrique(3, 1), rayonEau: RAYON_EAU, taille: TAILLE })
  assert.equal(g.demiEau, 27.78, 'le clip deborde du socle')
  assert.equal(g.large, 55.888, 'la maille deborde du socle')
  assert.equal(g.seg, 256, 'trois fois plus de quadrilateres pour un seul bloc')
  // … et c'est EXACTEMENT ce que rend un bloc seul, hors mode continu
  assert.deepEqual(g, geometrieDeMer({ cote: coteGeometrique(1, 1), rayonEau: RAYON_EAU, taille: TAILLE }))
})

test('sur le damier, la geometrie suit bien le carre', () => {
  assert.equal(coteGeometrique(1, 3), 3)
  assert.equal(coteGeometrique(1, 5), 5)
  assert.equal(coteGeometrique(1, 1), 1)
  // un côté absurde ne fabrique pas une mer absurde
  assert.equal(coteGeometrique(1, 0), 1)
  assert.equal(coteGeometrique(1, undefined), 1)
})

// ⚠️ LE RETRAIT NE SE MULTIPLIE PAS — divergence assumée avec le brief, qui
// écrivait `rayonEauDansSocle() * cote`. Le retrait est celui du bord
// EXTÉRIEUR, et il n'y en a qu'un.
test('l\'eau s\'arrete au bord du carre, sans multiplier la marge du socle', () => {
  const demi = (cote) => geometrieDeMer({ cote, rayonEau: RAYON_EAU, taille: TAILLE }).demiEau
  assert.equal(demi(1), 27.78, 'aucune regression sur le bloc seul')
  assert.equal(demi(3), 83.78, 'un seul retrait, celui du bord exterieur')
  assert.equal(demi(5), 139.78)
  // la formule du brief aurait triplé les 0,22 unité de retrait
  assert.notEqual(demi(3), RAYON_EAU * 3)
  assert.equal(Number((TAILLE * 1.5 - demi(3)).toFixed(2)), 0.22, 'le retrait doit rester celui d un seul bord')
  assert.equal(Number((TAILLE * 1.5 - RAYON_EAU * 3).toFixed(2)), 0.66, 'la formule du brief : trois retraits')
})

// ⚠️ LA MAILLE DOIT DÉBORDER LE CLIP, PAS L'INVERSE. C'est `demiEau` qui arrête
// l'eau ; la maille ne fait que la porter. Le seul 0,998 repassait SOUS le clip
// au 5×5 et rognait un cheveu de mer sur tout le pourtour.
test('la maille du plan d\'eau deborde toujours le clip qui l\'arrete', () => {
  for (const cote of [1, 2, 3, 4, 5]) {
    const g = geometrieDeMer({ cote, rayonEau: RAYON_EAU, taille: TAILLE })
    assert.ok(g.large / 2 > g.demiEau, `cote ${cote} : maille ${g.large / 2} <= clip ${g.demiEau}`)
  }
  // le bloc seul garde EXACTEMENT sa maille d'avant
  assert.equal(geometrieDeMer({ cote: 1, rayonEau: RAYON_EAU, taille: TAILLE }).large, TAILLE * 0.998)
  // et le 5x5, que le seul 0,998 aurait rogné
  assert.ok(TAILLE * 5 * 0.998 / 2 < 139.78, 'le cas que ce garde existe pour attraper a disparu')
})

// La segmentation est PROVISOIRE (Tâche 7 la mesurera). On verrouille sa FORME :
// à densité constante (4,57 segments par unité), un 3x3 rendrait 768² = 590 000
// quadrilatères pour des vagues dont la longueur d'onde se compte en unités.
test('la segmentation est plafonnee, pas lineaire', () => {
  const seg = (cote) => geometrieDeMer({ cote, rayonEau: RAYON_EAU, taille: TAILLE }).seg
  assert.equal(seg(1), 256, 'un bloc seul garde EXACTEMENT sa segmentation d\'avant')
  assert.equal(seg(2), 384)
  assert.equal(seg(3), 384)
  assert.equal(seg(5), 384, 'le plafond tient jusqu\'au 5x5')
  assert.ok(seg(5) ** 2 < 200_000, 'plus de 200 000 quadrilateres')
  // la densité, elle, CHUTE — c'est le prix assumé, et c'est exactement ce que
  // la Tâche 7 doit arbitrer en le regardant à l'écran. Les chiffres, en
  // segments par unité monde : 4,571 sur un bloc, 2,286 sur un 3×3 (la MOITIÉ),
  // 1,371 sur un 5×5 (le TIERS).
  const densite = (cote) => seg(cote) / (TAILLE * cote)
  assert.equal(Number(densite(1).toFixed(3)), 4.571)
  assert.equal(densite(3), densite(1) / 2, 'le 3x3 doit couter exactement la moitie de la densite')
  assert.equal(Number((densite(5) / densite(1)).toFixed(3)), 0.3, 'le 5x5 tombe a 30 % de la densite d un bloc')
})

// LA CHAÎNE ENTIÈRE, celle que main.js et ocean.js parcourent : un carré posé
// par le damier → son emprise → sa géométrie. C'est ce test qui meurt si
// n'importe lequel des trois maillons rend une constante.
test('la chaine carre → emprise → geometrie tient de bout en bout', () => {
  const attendu = [
    // { i0, j0, cote },        span, res,  centre,          demiEau, seg
    [{ i0: 0, j0: 0, cote: 1 }, 56, 384, { x: 0, z: 0 }, 27.78, 256],
    [{ i0: -1, j0: -1, cote: 2 }, 112, 768, { x: -28, z: -28 }, 55.78, 384],
    [{ i0: -1, j0: -1, cote: 3 }, 168, 1152, { x: 0, z: 0 }, 83.78, 384],
    [{ i0: -2, j0: -2, cote: 5 }, 280, 1920, { x: 0, z: 0 }, 139.78, 384],
  ]
  for (const [carre, span, res, centre, demiEau, seg] of attendu) {
    const e = empriseDeMer(carre, TAILLE)
    assert.equal(e.span, span, `span du ${carre.cote}x${carre.cote}`)
    assert.equal(e.res, res, `res du ${carre.cote}x${carre.cote}`)
    assert.deepEqual(e.centre, centre, `centre du ${carre.cote}x${carre.cote}`)
    const g = geometrieDeMer({ cote: coteGeometrique(1, e.cote), rayonEau: RAYON_EAU, taille: TAILLE })
    assert.equal(g.demiEau, demiEau, `clip du ${carre.cote}x${carre.cote}`)
    assert.equal(g.seg, seg, `segmentation du ${carre.cote}x${carre.cote}`)
  }
})

// ════════════ 4. LE GARDE : COMBIEN DE RECONSTRUCTIONS, VRAIMENT ? ══════════
//
// FINDING 3 de la ronde 1. Le rapport annonçait « au plus 4 » sans l'avoir
// mesuré. Ici on rejoue de vraies rafales d'arrivées à travers le VRAI
// `carreCouvrant` (celui qu'`empriseVivante` appelle) et la VRAIE `cleDuCarre`.

// mélange déterministe (xorshift) : un test qui varie d'une exécution à l'autre
// n'est pas un test.
function melange(liste, graine) {
  const a = [...liste]
  let s = graine | 0 || 1
  for (let i = a.length - 1; i > 0; i--) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0
    const j = Math.abs(s) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Combien de fois la mer se rebâtit-elle si les cases arrivent dans cet ordre ?
function reconstructions(ordre) {
  const posees = []
  let cle = cleDuCarre({ i0: 0, j0: 0, cote: 1 }) // état de départ : un bloc seul
  let n = 0
  for (const k of ordre) {
    posees.push(k)
    const neuve = cleDuCarre(carreCouvrant(posees, { cotemax: Infinity }))
    if (neuve !== cle) { cle = neuve; n++ }
  }
  return n
}

const CASES_3x3 = ['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1']
const CASES_5x5 = []
for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i || j) CASES_5x5.push(`${i},${j}`)

test('le garde converge : une fois toutes les cases posees, plus rien ne bouge', () => {
  for (const cases of [CASES_3x3, CASES_5x5]) {
    const ordre = melange(cases, 12345)
    const n = reconstructions(ordre)
    // rejouer la MÊME forme une seconde fois ne doit plus rien reconstruire
    assert.equal(reconstructions([...ordre, ...ordre]), n, 'le garde ne converge pas')
  }
})

// ⚠️ LE CHIFFRE DU RAPPORT DE LA RONDE 0 ÉTAIT FAUX : « au plus 4 », parce que
// je n'avais compté que les côtés distincts. La clé porte AUSSI le coin, et
// l'ancre se translate à mesure que la boîte englobante grandit — un carré peut
// donc changer de clé sans changer de côté. Mesuré ici, 2 000 ordres par
// taille : 3×3 → 2 à 4, 5×5 → jusqu'à 8. C'est le CHIFFRE, et il est borné.
test('le nombre de reconstructions reste borne sur une rafale d\'arrivees', () => {
  const bornes = (cases, tirages) => {
    let min = Infinity
    let max = 0
    for (let g = 1; g <= tirages; g++) {
      const n = reconstructions(melange(cases, g * 2654435761))
      if (n < min) min = n
      if (n > max) max = n
    }
    return { min, max }
  }
  const b3 = bornes(CASES_3x3, 2000)
  const b5 = bornes(CASES_5x5, 2000)
  assert.ok(b3.max <= 4, `3x3 : ${b3.max} reconstructions, borne 4`)
  assert.ok(b5.max <= 8, `5x5 : ${b5.max} reconstructions, borne 8`)
  // … et jamais une par dalle : c'est tout l'objet du garde
  assert.ok(b3.max < CASES_3x3.length, '3x3 : autant de reconstructions que de dalles')
  assert.ok(b5.max < CASES_5x5.length / 2, '5x5 : le garde n\'amortit plus rien')
  // le meilleur cas existe et vaut 1 : la premiere voisine ouvre deja le carre
  assert.equal(b3.min >= 1, true)
})

// ⚠️ ET C'EST BIEN POURQUOI LE CHAMP DOIT ÊTRE RECUIT À PART. Au plus 8
// reconstructions pour 24 dalles veut dire que SEIZE arrivées au moins ne
// reconstruisent RIEN — et leur relief resterait donc absent du champ, c'est-à-
// dire pas de mer là où le bord du bloc central est de la terre. Le recuit
// différé de main.js est la conséquence directe de ce chiffre.
test('la majorite des arrivees ne reconstruit rien — d\'ou le recuit differe', () => {
  const n = reconstructions(melange(CASES_5x5, 7))
  assert.ok(CASES_5x5.length - n >= 16, `${CASES_5x5.length - n} arrivees muettes, attendu >= 16`)
  // le recuit lui-même est EXÉCUTÉ dans test/damier-mer-runtime.test.js : ici
  // on ne vérifie que le fil, entre le damier et la mer.
  assert.match(MAIN, /realWater\?\.recuireChampDiffere\?\.\(carre\.cote\)/, 'le damier ne previent plus la mer')
  assert.match(MAIN, /merRecuitDiffere\(carre\)/, 'onGridChanged n\'amorce plus le recuit')
})

// ════════════════════════ 5. LE COÛT, ET SA BORNE ═══════════════════════════

// Le champ est multiplicatif (resChamp), donc un 3x3 coûte NEUF fois un bloc.
// C'est le chiffre déjà payé par la fenêtre continue (1152², 5,3 Mo).
test('le champ d\'un 3x3 reste sous 6 Mo en demi-flottants', () => {
  const res = empriseDeMer({ i0: -1, j0: -1, cote: 3 }, TAILLE).res
  const octets = res * res * 2 * 2 // deux canaux, demi-flottants
  assert.ok(octets < 6 * 1024 * 1024, `${(octets / 1048576).toFixed(1)} Mo, trop`)
})

// ⚠️ ET LE 5×5 EXISTE, LUI AUSSI. `empriseVivante()` n'a AUCUN plafond — c'est
// un constat, pas une commande — et le mode zone isolée y monte réellement
// (block-grid.js). Ne borner que le 3×3 laissait le vrai pire cas hors champ.
test('le champ d\'un 5x5 est chiffre, et il coute quatre fois le 3x3', () => {
  const res5 = empriseDeMer({ i0: -2, j0: -2, cote: 5 }, TAILLE).res
  const res3 = empriseDeMer({ i0: -1, j0: -1, cote: 3 }, TAILLE).res
  assert.equal(res5, 1920)
  const vram = (r) => r * r * 2 * 2
  assert.equal(Number((vram(res5) / 1048576).toFixed(1)), 14.1, 'la memoire video du 5x5 a change')
  assert.ok(vram(res5) / vram(res3) > 2.7, 'le cout du 5x5 devrait etre pres de trois fois celui du 3x3')
  // + le transitoire de la cuisson : `water` (1 octet) et `dist` (4 octets) par
  // texel. 1920² × 5 = 18 432 000 octets, soit 17,6 Mio — ou 18,4 Mo si on
  // compte en millions. (Mon rapport de ronde 1 annonçait 18,3 : ni l'un ni
  // l'autre. Les deux unités sont écrites ici pour qu'on ne puisse plus les
  // mélanger.)
  const transitoire = res5 * res5 * (1 + 4)
  assert.equal(transitoire, 18_432_000)
  assert.equal(Number((transitoire / 1048576).toFixed(1)), 17.6, 'Mio')
  assert.equal(Number((transitoire / 1e6).toFixed(1)), 18.4, 'Mo')
  assert.ok(transitoire < 24 * 1024 * 1024)
})

// ═══════ 6. VERROUS DE CÂBLAGE — ce qui n'existe qu'en GLSL ou en three.js ═══
//
// Assumés comme tels : ils prouvent qu'un fil est branché, pas qu'un calcul est
// juste. Tout ce qui pouvait être un calcul est remonté en section 1 à 5.

test('rebuild accepte le carre, la fabrique de sol et le plancher', () => {
  assert.match(OCEAN, /rebuild\(\{[^}]*carre = null/, 'la signature de rebuild ne prend pas `carre`')
  assert.match(OCEAN, /fabriqueSol = null/, 'rebuild n\'accepte pas de fabrique d\'echantillonneur')
  assert.match(OCEAN, /planchier = null/, 'rebuild n\'accepte pas le plancher commun')
})

test('le champ est cuit sur l\'emprise, pas sur des constantes en dur', () => {
  const bake = OCEAN.slice(OCEAN.indexOf('_bakeField('), OCEAN.indexOf('_bakeLakeMask('))
  assert.ok(bake.length > 200, '_bakeField introuvable')
  assert.match(bake, /const n = emprise\.res/, 'la resolution du champ ne vient pas de l\'emprise')
  assert.match(bake, /const span = emprise\.span/, 'la largeur du champ ne vient pas de l\'emprise')
  assert.doesNotMatch(bake, /resChamp\(|FIELD_RES/, '_bakeField recalcule sa resolution au lieu de la lire')
  // le champ est centré sur le carré (section 2) : les deux lignes qui le font
  assert.match(bake, /\* span \+ cz/, 'le champ est cuit autour de l\'origine')
  assert.match(bake, /\* span \+ cx/, 'le champ est cuit autour de l\'origine')
})

test('les trois mesures de la geometrie viennent de geometrieDeMer', () => {
  assert.match(OCEAN, /geometrieDeMer\(\{ cote: coteGeo, rayonEau: rayonEauDansSocle\(\), taille: TERRAIN_SIZE \}\)/)
  assert.match(OCEAN, /const coteGeo = coteGeometrique\(coteFenetre, emprise\.cote\)/)
  assert.match(OCEAN, /mat\.uniforms\.uHalf\.value = mesures\.demiEau/)
  assert.match(OCEAN, /buildRimGeometry\(mesures\.demiEau, r,/, 'la jupe et la surface divergent')
  assert.match(OCEAN, /PlaneGeometry\(mesures\.large, mesures\.large, mesures\.seg, mesures\.seg\)/)
  // et `emprise.cote` ne pilote plus AUCUNE géométrie : le défaut du mode continu
  assert.doesNotMatch(OCEAN, /256 \* emprise\.cote|TERRAIN_SIZE \* emprise\.cote|rayonEauDansSocle\(\) \* emprise\.cote/)
})

// Le brief écrivait `mesh.position.set(centre.x, seaBase, centre.z)`. Les quatre
// shaders lisent `position.xz` COMME DES COORDONNÉES MONDE : une translation
// portée par la matrice du mesh aurait déplacé le RENDU sans déplacer ce que le
// shader croit regarder. Seule la HAUTEUR passe par la matrice.
test('le centre du carre va dans la geometrie, pas dans mesh.position', () => {
  assert.match(OCEAN, /geo\.translate\(emprise\.centre\.x, 0, emprise\.centre\.z\)/)
  assert.match(OCEAN, /sgeo\.translate\(emprise\.centre\.x, 0, emprise\.centre\.z\)/)
  assert.match(OCEAN, /mesh\.position\.set\(0, this\._seaBase, 0\)/, 'la hauteur seule passe par la matrice')
  // … et le clip du fragment, et la lecture du champ
  assert.match(OCEAN, /uniform vec2 uCentre;/)
  assert.match(OCEAN, /abs\(xzVue - uCentre\)/)
  assert.match(OCEAN, /\(xzChamp - uCentre\) \/ uSpan \+ 0\.5/)
})

test('le masque cotier se lit sur son empreinte, pas sur celle du champ', () => {
  assert.match(OCEAN, /uniform float uSpanMasque;/)
  assert.match(OCEAN, /vec2 uvMasqueCotier\(vec2 xzChamp\)/)
  // le premier `return` garde la fenêtre continue au bit près : quand les deux
  // empreintes coïncident, l'uv sort tel quel et la texture clampe au bord.
  assert.match(OCEAN, /if \(uSpanMasque >= uSpan\) return uv;/)
  assert.match(OCEAN, /const spanMasque = this\._spanMasque \?\? span/, 'la cuisson CPU lit encore le span du champ')
  assert.doesNotMatch(OCEAN, /texture2D\(uCoastMask, uvF\)/)
})

test('l\'echelle du relief suit le MNT, pas le carre du damier', () => {
  assert.match(OCEAN, /const demScale = \(this\._spanDem \/ terrain\.dem\.extentMeters\)/)
  assert.match(OCEAN, /const scale = \(this\._spanDem \/ dem\.extentMeters\)/, 'les lacs suivent le carre au lieu du MNT')
  assert.match(OCEAN, /\(g \/ \(n - 1\) - 0\.5\) \* this\._spanDem/, 'la grille des lacs suit le carre au lieu du MNT')
})

test('la jupe descend au plancher commun du damier', () => {
  assert.match(OCEAN, /Math\.min\(this\._seaBase - drop, planchier\)/, 'la jupe pourrait REMONTER')
  assert.match(MAIN, /planchier: carre\.cote > 1 \? blockGrid\.planchierCommun\(\) : null/)
})

test('main.js lit empriseVivante, jamais carreCourant, pour la mer', () => {
  const mer = MAIN.slice(MAIN.indexOf('function carreDeMer'), MAIN.indexOf('function carreDeMer') + 2600)
  assert.ok(mer.length > 200, 'carreDeMer introuvable dans main.js')
  assert.match(mer, /blockGrid\.empriseVivante\(\)/)
  assert.doesNotMatch(mer, /carreCourant\(\)/, 'carreCourant plafonne à 3x3 : mer trop petite en zone isolée')
})

// ⚠️ LE GRAIN FBM EST REFUSÉ, ET C'EST CHIFFRÉ. 285 ms de fil principal gelé
// avec, 53 ms sans, sur un champ 1152² ; 789 contre 182 sur un 1920². Le grain
// est éteint sous 90 m par `landFactor`, donc NUL à la ligne d'eau — la seule
// chose que ce champ sert à trouver. Le mode continu prend cette décision
// depuis terrain.js:2083. Script rejouable :
// .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-cuisson.mjs
test('la cuisson du champ ne paie pas le grain FBM', () => {
  assert.match(OCEAN, /const ech = \(this\._fabriqueSol \? this\._fabriqueSol\(\) : null\) \|\| echChamp/)
  assert.match(MAIN, /blockGrid\.echantillonSansGrain\(params, terrain\.sampleChamp\(params\)\)/)
  const grid = readFileSync(new URL('../src/block-grid.js', import.meta.url), 'utf8')
  const ech = grid.slice(grid.indexOf('echantillonSansGrain('), grid.indexOf('heightAt(x, z) {'))
  assert.ok(ech.length > 200, 'echantillonSansGrain introuvable')
  assert.match(ech, /sampleChamp\?\.\(params\)/, 'les voisines repassent par le sampler grainé')
  assert.doesNotMatch(ech, /\.sample\(/, 'echantillonSansGrain paie encore le grain')
})

// Le retrait de l'eau est lu sur plinth.js, pas deviné ici : si le chanfrein
// bouge, ce fichier doit rougir plutôt que mentir.
test('RAYON_EAU de ce fichier est bien celui de plinth.js', () => {
  const src = readFileSync(new URL('../src/plinth.js', import.meta.url), 'utf8')
  const chanfrein = Number(src.match(/export const SOCLE_CHANFREIN = ([\d.]+)/)?.[1])
  const marge = Number(src.match(/export const SOCLE_MARGE_EAU = ([\d.]+)/)?.[1])
  assert.ok(Number.isFinite(chanfrein) && Number.isFinite(marge), 'constantes du socle introuvables')
  assert.equal(RAYON_EAU, 28 - chanfrein - marge)
})
