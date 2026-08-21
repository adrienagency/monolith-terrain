// L'HABILLAGE DU CROP — Tâche C du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même partage que `test/crop-sphere.test.js` et `test/crop-parois.test.js` :
//   ① LA LOI vit dans un module PUR (`src/monde/habillage-crop.js`), sans three
//      ni DOM, et se vérifie sous node, point par point ;
//   ② LE NUANCEUR est vérifié comme TEXTE : il doit porter les uniformes, les
//      gardes, et la TRANSCRIPTION des mêmes formules.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que le GPU exécute ce
// texte, et que l'image obtenue soit celle du socle. Seul l'écran le dit —
// c'est l'Étape 5 de la tâche, et son compte rendu.
//
// ══════════ LES ASSERTIONS ONT ÉTÉ REJOUÉES CONTRE LE DÉPÔT, ET DEUX ONT ÉTÉ
//            JETÉES POUR CELA ══════════════════════════════════════════════════
//
// La règle du §0 : « une assertion se rejoue contre le dépôt AVANT d'être
// écrite ». Le banc est `.banc/rejoue-habC.mjs`, **LAISSÉ SUR LE DISQUE** — une
// tâche de ce chantier a supprimé le sien alors que son test le citait. Il
// rejoue chaque assertion contre `git show 6b8ca66` (l'état d'avant la tâche) et
// exige qu'elle soit ROUGE là-bas.
//
// Deux assertions candidates ont été **jetées parce qu'elles ne distinguaient
// rien**, et ce sont exactement les sept cas que le plan énumère :
//   · « le nuanceur porte `smoothstep` » — VERTE AVANT : `globe.js` en portait
//     déjà quatre (couverture douce du crop, courbes, graticule, terminateur) ;
//   · « le nuanceur porte `texture2D(uRamp` » — VERTE AVANT elle aussi.
//
// Ce qui distingue vraiment est plus bas : la **lecture des champs au même texel
// que le socle** (③), la **marge convertie et non recopiée** (④), le **retour
// exact à l'image d'avant** quand un poste s'éteint (⑤), et la **constante
// recopiée qui doit rester égale à sa source** (④c).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  uvChampCrop,
  uvDrapeCrop,
  MARGE_COTE_UNITES,
  EXAG_SOCLE_NOMINALE,
  COTE_CROP_UNITES,
  margeCoteM,
  margeCoteDuCrop,
  largeurCropM,
  sousEauCrop,
  bruitValeur,
  grainCrop,
  intervalleCourbes,
  PAS_CARTO,
} from '../src/monde/habillage-crop.js'
import { repereCrop, localCrop } from '../src/monde/crop-sphere.js'
import { ZOOM_SOCLE } from '../src/monde/seuil-socle.js'
import { BLOCK_TILES } from '../src/landmarks.js'
import { latLonToWorld, tileToLatLon, latLonToTile } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const TERRAIN_SRC = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
const MAIN_SRC = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// Le GLSL du globe, isolé : plusieurs assertions doivent porter sur le NUANCEUR
// et pas sur le JS qui l'entoure — sans quoi elles tomberaient sur un
// commentaire ou sur une clé d'uniforme, et ne distingueraient rien.
const FRAG = (() => {
  const i = GLOBE_SRC.indexOf('const FRAG = /* glsl */ `')
  return GLOBE_SRC.slice(i, GLOBE_SRC.indexOf('\n`\n', i))
})()

// Le crop de référence des Tâches A et B : 45° N, 6,25° E.
const CENTRE = { lat: 45, lon: 6.25 }
const REPERE = repereCrop({ centre: CENTRE })

// Le MNT que le socle aurait chargé sur CETTE emprise. ⚠️ `originTileX/Y` ne
// sont pas devinés : `empriseSocle` (`seuil-socle.js`) prend
// `tuileX(lon, z) − tuilesParBloc/2`, **sans arrondi** — c'est ce qui fait que
// le bloc est centré sur le crop, et c'est la prémisse de tout ce fichier.
function demDuSocle(centre = CENTRE, zoom = ZOOM_SOCLE, tuiles = BLOCK_TILES) {
  const t = latLonToTile(centre.lat, centre.lon, zoom)
  return { zoom, originTileX: t.x - tuiles / 2, originTileY: t.y - tuiles / 2, size: tuiles * 256, tilePx: 256 }
}

// ══════════ ① LE PÉRIMÈTRE — quatre postes, et pas un de plus ══════════════

test('① le nuanceur du globe déclare les gardes des quatre postes', () => {
  // Le plan (Tâche C, Étape 3) : « Contours, grain, masque de côte, occupation
  // du sol ». Chacun a sa garde, et elles sont cherchées DANS LE GLSL — un
  // `grep` sur tout le fichier serait tombé sur les clés d'uniformes JS et
  // n'aurait rien prouvé du nuanceur.
  for (const [type, nom] of [
    ['float', 'uHabOn'],
    ['sampler2D', 'uCoastMask'],
    ['float', 'uCoastMaskOn'],
    ['float', 'uMargeCoteM'],
    ['sampler2D', 'uSol'],
    ['sampler2D', 'uSolLut'],
    ['float', 'uSolOn'],
    ['float', 'uGrainForceM'],
    ['float', 'uContourWeight'],
  ]) {
    assert.ok(
      new RegExp(`uniform\\s+${type}\\s+${nom}\\s*;`).test(FRAG),
      `le nuanceur du globe ne déclare pas ${type} ${nom}`
    )
  }
})

test('① uHabOn vaut ZÉRO par défaut — sans poserHabillage, la production est intouchée', () => {
  // ⚠️ MÊME GARDE QUE uCropOn, ET POUR LA MÊME RAISON : le nuanceur est partagé
  // par TOUTES les tuiles du globe, y compris celles qui ne verront jamais de
  // crop. Une garde posée à 1 découperait et repeindrait la planète entière.
  assert.match(GLOBE_SRC, /uHabOn:\s*\{\s*value:\s*0\s*\}/)
  assert.ok(/\n  poserHabillage\(/.test(GLOBE_SRC), 'pas de méthode `poserHabillage` sur le globe')
  assert.ok(/\n  retirerHabillage\(\)/.test(GLOBE_SRC), 'pas de méthode `retirerHabillage` sur le globe')
})

test('① retirerCrop retire aussi l’habillage — sinon il survivrait au crop qu’il habille', () => {
  const bloc = GLOBE_SRC.slice(GLOBE_SRC.indexOf('  retirerCrop() {'), GLOBE_SRC.indexOf('  retirerCrop() {') + 400)
  assert.match(bloc, /this\.retirerHabillage\(\)/, '`retirerCrop` ne retire pas l’habillage')
})

test('① le compte de samplers du nuanceur du globe reste sous le plafond de 16', () => {
  // ⚠️ CE N'EST PAS UNE ASSERTION QUI DISTINGUE, C'EST UN PLAFOND — et il a déjà
  // été crevé une fois : le 2026-08-03 le terrain a purement disparu de l'écran,
  // « FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS
  // (16) », 18 samplers pour 16 (voir `test/plafond-unites-texture.test.js`).
  // Sa mutation nommée est M9 (`.banc/mutations-habC.mjs`).
  const n = (FRAG.match(/uniform\s+sampler2D\s+\w+\s*;/g) || []).length
  assert.ok(n <= 16, `le nuanceur du globe déclare ${n} samplers`)
  assert.equal(n, 5, `le compte attendu est 5 (uTex, uRamp, uCoastMask, uSol, uSolLut), pas ${n}`)
})

// ══════════ ② LES DEUX FAMILLES D'UV NE SE CONFONDENT PAS ══════════════════

test("② les champs CUITS ne se retournent pas, les couches DRAPÉES si — et l'écart vaut exactement 1", () => {
  // ⚠️ C'EST LE PIÈGE LE PLUS SILENCIEUX DE CETTE TÂCHE. `terrain.js` lit
  // uCoastMask / uSeaMask / uAnalysis en `vWorldPos.xz` DIRECT, et `uvSolDrape`
  // — et lui seul — retourne y. Confondre les deux pose la forêt à l'envers et
  // la mer sur les crêtes, sans qu'aucune erreur ne se lève.
  for (const [u, v] of [[-1, -1], [-0.3, 0.7], [0, 0], [0.9, -0.4], [1, 1]]) {
    const c = uvChampCrop(u, v)
    const d = uvDrapeCrop(u, v)
    assert.equal(c.x, d.x, 'les deux familles partagent le x')
    assert.ok(Math.abs(c.y + d.y - 1) < 1e-15, `c.y + d.y doit valoir 1 en (${u}, ${v})`)
  }
  // et le retournement est bien du côté DRAPÉ, pas du côté CUIT
  assert.equal(uvChampCrop(0, 1).y, 1)
  assert.equal(uvDrapeCrop(0, 1).y, 0)
})

test('② le dépôt confirme la dissymétrie : `uvSolDrape` retourne y, la lecture du masque de côte non', () => {
  // Rejoué contre `src/terrain.js`, pas cité de mémoire. Si le socle se mettait
  // à retourner ses champs cuits, le globe devrait suivre — et ce test le dit.
  const i = TERRAIN_SRC.indexOf('vec2 uvSolDrape')
  assert.ok(i > 0, '`uvSolDrape` a disparu de terrain.js')
  assert.match(TERRAIN_SRC.slice(i, i + 600), /uv\.y\s*=\s*1\.0\s*-\s*uv\.y/, '`uvSolDrape` a perdu son retournement')
  const cm = TERRAIN_SRC.indexOf('landness = texture2D(uCoastMask, cmUv).r')
  assert.ok(cm > 0, 'la lecture du masque de côte a changé de forme dans terrain.js')
  assert.ok(!/cmUv\.y\s*=\s*1\.0\s*-/.test(TERRAIN_SRC.slice(cm - 400, cm)), 'le masque de côte s’est mis à retourner y')
})

test('② le nuanceur du globe applique le retournement à l’occupation du sol, et à elle seule', () => {
  const sol = FRAG.slice(FRAG.indexOf('uSolOn > 0.5'), FRAG.indexOf('uSolOn > 0.5') + 400)
  assert.match(sol, /1\.0\s*-\s*\(\s*qCrop\.y\s*\*\s*0\.5\s*\+\s*0\.5\s*\)/, 'la couche drapée ne retourne pas y')
  const cote = FRAG.slice(FRAG.indexOf('uCoastMaskOn > 0.5'), FRAG.indexOf('uCoastMaskOn > 0.5') + 300)
  assert.ok(!/1\.0\s*-\s*\(\s*qCrop\.y/.test(cote), 'le masque de côte retourne y alors que le socle ne le fait pas')
})

// ══════════ ③ LE GLOBE LIT LES CHAMPS AU MÊME TEXEL QUE LE SOCLE ═══════════

test('③ pour un même point de la Terre, le globe et le socle tombent sur le MÊME texel de champ', () => {
  // ⚠️ **C'EST L'ASSERTION QUI DÉCIDE DE LA TÂCHE.** Si les deux lectures
  // divergeaient d'un texel, le trait de côte du globe ne tomberait pas sur
  // celui du socle, et « une seule Terre » redeviendrait « deux Terres qui se
  // ressemblent » — le palliatif qu'Adrien a refusé. Elle est rejouée contre
  // `latLonToWorld` DU DÉPÔT, qui sert d'oracle indépendant : une erreur de
  // convention chez moi tombe ici, pas à l'écran.
  const dem = demDuSocle()
  const n = 2 ** REPERE.zoom
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      const u = -1 + (2 * i) / 6
      const v = -1 + (2 * j) / 6
      const { lat, lon } = tileToLatLon((REPERE.cx + u * REPERE.demi) * n, (REPERE.cy + v * REPERE.demi) * n, REPERE.zoom)
      const q = localCrop(lat, lon, REPERE)
      const vu = uvChampCrop(q.u, q.v)
      const w = latLonToWorld(dem, lat, lon)
      assert.ok(Math.abs(vu.x - (w.x / TERRAIN_SIZE + 0.5)) < 1e-9, `u : ${vu.x} vs ${w.x / TERRAIN_SIZE + 0.5}`)
      assert.ok(Math.abs(vu.y - (w.z / TERRAIN_SIZE + 0.5)) < 1e-9, `v : ${vu.y} vs ${w.z / TERRAIN_SIZE + 0.5}`)
    }
  }
})

test("③ le facteur est bien 1/2 : le bord du crop tombe à x = 28, pas ailleurs", () => {
  // Le §2 de `/threejs-optimisation` : « ne lisez pas la constante, mesurez ce
  // qu'elle produit ». Un facteur 1 au lieu de 1/2 — l'erreur la plus probable —
  // est INVISIBLE au centre du crop et se voit seulement au bord.
  const dem = demDuSocle()
  const n = 2 ** REPERE.zoom
  const bord = tileToLatLon((REPERE.cx + REPERE.demi) * n, REPERE.cy * n, REPERE.zoom)
  const w = latLonToWorld(dem, bord.lat, bord.lon)
  assert.ok(Math.abs(w.x - TERRAIN_SIZE / 2) < 1e-9, `le bord du crop doit tomber à x = 28, il tombe à ${w.x}`)
  const q = localCrop(bord.lat, bord.lon, REPERE)
  assert.ok(Math.abs(q.u - 1) < 1e-12, `le bord du crop doit être à u = 1, il est à ${q.u}`)
  assert.ok(Math.abs(uvChampCrop(q.u, q.v).x - 1) < 1e-9, 'le bord du crop doit tomber au texel 1 du champ')
  // et le CENTRE ne distingue rien : la preuve que le test devait aller au bord
  assert.equal(uvChampCrop(0, 0).x, 0.5)
})

test('③ le nuanceur transcrit ce même UV, sur qCrop — jamais sur vUv', () => {
  // ⚠️ SUR LE CROP, JAMAIS SUR L'UV DE TUILE. `vUv` est local à la tuile : lu
  // là, le champ se répéterait à chaque tuile — seize côtes au lieu d'une.
  const bloc = FRAG.slice(FRAG.indexOf('uCoastMaskOn > 0.5'), FRAG.indexOf('uCoastMaskOn > 0.5') + 300)
  assert.match(bloc, /qCrop\s*\*\s*0\.5\s*\+\s*0\.5/, 'le nuanceur ne lit pas le champ en qCrop * 0.5 + 0.5')
  assert.ok(!/texture2D\(uCoastMask,\s*vUv/.test(FRAG), 'le masque de côte est lu en UV DE TUILE')
  assert.ok(!/texture2D\(uSol,\s*vUv/.test(FRAG), 'l’occupation du sol est lue en UV DE TUILE')
})

test('③ qCrop est HISSÉ hors du bloc de découpe, et il est affecté dedans', () => {
  // Sans le hissage, l'habillage devrait recalculer la projection de Mercator —
  // avec son écrêtage et son repli d'antiméridien. Deux écritures qui divergent :
  // la cicatrice que `terrain.js` documente déjà.
  const decl = FRAG.indexOf('vec2 qCrop = vec2(0.0);')
  const aff = FRAG.indexOf('qCrop = q;')
  const usage = FRAG.indexOf('qCrop * 0.5 + 0.5')
  assert.ok(decl > 0, '`qCrop` n’est pas déclaré')
  assert.ok(aff > decl, '`qCrop` n’est pas affecté après sa déclaration')
  assert.ok(usage > aff, 'l’habillage lit `qCrop` avant qu’il soit affecté')
  assert.ok(FRAG.indexOf('if (uCropOn > 0.5) {') > decl, '`qCrop` est déclaré DANS le bloc de découpe')
})

// ══════════ ④ LA MARGE DE CÔTE — convertie, jamais recopiée ════════════════

test('④ la marge est le 0,02 du socle CONVERTI en mètres, et elle ne vaut pas 0,02', () => {
  // ⚠️ RECOPIER « 0.02 » CÔTÉ GLOBE AURAIT DONNÉ DEUX CENTIMÈTRES — cinquante
  // fois trop court, donc un liseré de terre sur chaque lagune et chaque
  // estuaire. Le globe tient sa hauteur en MÈTRES BRUTS ; le socle la tient en
  // unités de scène, sur un relief DÉJÀ EXAGÉRÉ.
  const m = margeCoteM(185.7, 2.8)
  assert.ok(Math.abs(m - (0.02 * 185.7) / 2.8) < 1e-12)
  assert.ok(m > 1.3 && m < 1.34, `la marge doit valoir ~1,33 m, elle vaut ${m}`)
  assert.notEqual(m, MARGE_COTE_UNITES)
  // et elle suit l'exagération : à ×18 (l'ancienne du globe) elle est 6,4 fois
  // plus courte — c'est le facteur du §3 du plan
  assert.ok(Math.abs(margeCoteM(185.7, 2.8) / margeCoteM(185.7, 18) - 18 / 2.8) < 1e-9)
})

test('④ la marge d’un crop se tire de son SEUL repère, et le cos(lat) y mord', () => {
  // ⚠️ EN WEB-MERCATOR UNE LARGEUR N'EST UNE LARGEUR EN MÈTRES QU'À L'ÉQUATEUR.
  // Sans le cos(lat), la marge d'un crop islandais serait deux fois trop grande.
  const equateur = repereCrop({ centre: { lat: 0, lon: 6.25 } })
  const alpes = repereCrop({ centre: CENTRE })
  assert.ok(Math.abs(largeurCropM(alpes) / largeurCropM(equateur) - Math.cos((45 * Math.PI) / 180)) < 1e-9)
  // à 45°, un bloc de 16 tuiles z13 fait ~10,4 km : la valeur du §3 du plan
  const km = largeurCropM(alpes) / 1000
  assert.ok(km > 10.3 && km < 10.5, `la largeur du crop doit valoir ~10,4 km, elle vaut ${km}`)
  assert.ok(Math.abs(margeCoteDuCrop(alpes) - margeCoteM(largeurCropM(alpes) / COTE_CROP_UNITES)) < 1e-12)
})

test('④c la constante recopiée est encore égale à sa source — sinon elle a divergé', () => {
  // ⚠️ C'EST LA QUESTION 2 DU §1 DE `/threejs-optimisation` : « les constantes du
  // fichier sont-elles dupliquées ailleurs ? Une constante recopiée diverge tôt
  // ou tard, en silence. » `EXAG_SOCLE_NOMINALE` ne PEUT pas être importée —
  // `main.js` n'exporte rien et n'est chargé par aucun test ; passer par
  // `terrain.js` ferait un cycle. La parade est donc ce test.
  const m = MAIN_SRC.match(/const BASE_EXAG = ([\d.]+)/)
  assert.ok(m, '`BASE_EXAG` a disparu de main.js — la copie n’a plus de source')
  assert.equal(Number(m[1]), EXAG_SOCLE_NOMINALE, 'EXAG_SOCLE_NOMINALE a divergé de BASE_EXAG')
})

// ══════════ ⑤ UN POSTE ÉTEINT REND L'IMAGE D'AVANT, AU BIT PRÈS ════════════

test('⑤ sans masque, `sousEauCrop` EST le prédicat du globe d’aujourd’hui (h < 0)', () => {
  // ⚠️ SINON LA MUTATION QUI ÉTEINT LE POSTE NE PROUVE RIEN : elle changerait
  // l'image des deux côtés, et on ne saurait plus ce qu'on mesure.
  for (const h of [-5000, -1, -1e-9, 0, 1e-9, 1, 800, 8848]) {
    assert.equal(sousEauCrop({ masqueActif: false, landness: 0, hM: h, margeM: 1.33 }), h < 0, `h = ${h}`)
    assert.equal(sousEauCrop({ masqueActif: false, landness: 1, hM: h, margeM: 1.33 }), h < 0, `h = ${h}`)
  }
})

test('⑤ le masque décide, mais il ne peut JAMAIS noyer une terre au-dessus de la marge', () => {
  // Le correctif v42 de `terrain.js`, rejoué : « la rampe océan (fond marin
  // choisi) se peignait sur des montagnes quand le masque était faux » (retour
  // Adrien). Un masque à 0 (mer) sur un sommet à 2 000 m ne doit rien noyer.
  assert.equal(sousEauCrop({ masqueActif: true, landness: 0, hM: 2000, margeM: 1.33 }), false)
  assert.equal(sousEauCrop({ masqueActif: true, landness: 0, hM: 1.32, margeM: 1.33 }), true)
  // et l'inverse : une lagune à +3 m que le MNT croit émergée reste de la mer
  // pour le globe d'aujourd'hui (h < 0 est faux), et le masque ne la sauve pas
  // au-delà de la marge — c'est la limite ASSUMÉE de la marge, pas un oubli.
  assert.equal(sousEauCrop({ masqueActif: true, landness: 0, hM: 3, margeM: 1.33 }), false)
  // une terre franche reste terre quelle que soit sa hauteur
  assert.equal(sousEauCrop({ masqueActif: true, landness: 1, hM: -50, margeM: 1.33 }), false)
})

test('⑤ le nuanceur pose bien `sousEau = h < 0.0` avant toute garde', () => {
  const i = FRAG.indexOf('bool sousEau = h < 0.0;')
  assert.ok(i > 0, 'le nuanceur ne pose pas la valeur d’avant comme défaut')
  assert.ok(i < FRAG.indexOf('if (uHabOn > 0.5) {'), 'la valeur d’avant est posée APRÈS la garde')
  // et la rampe lit `sousEau`, pas `h < 0.0` — sinon le masque ne servirait
  // qu'au trait de côte et la couleur resterait celle du MNT
  assert.match(FRAG, /float t = sousEau\s*\n/, 'la rampe ne lit pas `sousEau`')
})

// ══════════ ⑥ LE GRAIN — sur le sol, sur la terre, et borné ════════════════

test('⑥ le grain est SOLIDAIRE DU SOL : deux points du même endroit rendent la même valeur', () => {
  // ⚠️ C'EST LE DÉFAUT QU'ADRIEN A ATTRAPÉ À L'ŒIL sur le socle : « évalué en x
  // seul, le grain resterait COLLÉ À L'ÉCRAN pendant que le relief défile ».
  // Indexé sur (u, v) du crop, il ne dépend que de l'endroit.
  const a = grainCrop({ u: 0.31, v: -0.17, force: 3, echelle: 96 })
  const b = grainCrop({ u: 0.31, v: -0.17, force: 3, echelle: 96 })
  assert.equal(a, b)
  // et il CHANGE quand l'endroit change — sinon il serait constant, ce qui
  // passerait l'assertion précédente sans rien dire
  assert.notEqual(a, grainCrop({ u: 0.32, v: -0.17, force: 3, echelle: 96 }))
  assert.notEqual(a, grainCrop({ u: 0.31, v: -0.16, force: 3, echelle: 96 }))

  // ⚠️ **ET LES DEUX OCTAVES SONT VIVANTES — cette assertion-là a été ÉCRITE
  // PARCE QU'UNE MUTATION SURVIVAIT.** La campagne (`.banc/mutations-habC.mjs`,
  // M20) fige le PREMIER octave : les trois `notEqual` ci-dessus restent
  // VERTES, parce que le second suffit à faire varier la somme. On retranche
  // donc le second octave — calculé ici à partir de `bruitValeur`, qui est
  // testé plus bas — et on exige que le RESTE porte encore du signal.
  const p = 96
  let mn = Infinity
  let mx = -Infinity
  for (let i = 0; i <= 2000; i++) {
    const u = -1 + (2 * i) / 2000
    const v = u * 0.37 + 0.11
    const reste = grainCrop({ u, v, force: 1, echelle: p }) - (bruitValeur(u * p * 2.17 + 19.3, v * p * 2.17 - 7.1) - 0.5) * 0.7
    mn = Math.min(mn, reste)
    mx = Math.max(mx, reste)
  }
  assert.ok(mx - mn > 1, `le premier octave ne porte plus de signal (étendue ${mx - mn})`)
})

test('⑥ le grain ne mord pas sous l’eau, et son amplitude est bornée par sa force', () => {
  assert.equal(grainCrop({ u: 0.3, v: 0.2, force: 3, echelle: 96, surTerre: false }), 0)
  assert.equal(grainCrop({ u: 0.3, v: 0.2, force: 0, echelle: 96 }), 0)
  // deux octaves de bruit de valeur : |(n1-0.5)*2 + (n2-0.5)*0.7| <= 1.35
  let pire = 0
  for (let i = 0; i < 5000; i++) {
    const u = -1 + (2 * i) / 5000
    pire = Math.max(pire, Math.abs(grainCrop({ u, v: u * 0.37 + 0.11, force: 1, echelle: 96 })))
  }
  assert.ok(pire <= 1.35 + 1e-9, `le grain déborde son enveloppe : ${pire}`)
  assert.ok(pire > 0.3, `le grain est plat (${pire}) — l’assertion précédente ne prouverait rien`)
})

test('⑥ `bruitValeur` reste dans [0, 1] et est continu — c’est mnNoise, pas un autre bruit', () => {
  for (let i = 0; i < 2000; i++) {
    const x = -50 + (i * 137) / 991
    const y = 17 - (i * 53) / 613
    const n = bruitValeur(x, y)
    assert.ok(n >= 0 && n <= 1, `bruitValeur hors [0,1] : ${n}`)
    assert.ok(Math.abs(n - bruitValeur(x + 1e-7, y)) < 1e-3, 'bruitValeur n’est pas continu')
  }
})

test('⑥ le nuanceur porte mnHash/mnNoise AUX MÊMES CONSTANTES que terrain.js', () => {
  // ⚠️ UNE SECONDE LOI DE BRUIT FINIRAIT PAR DIVERGER — `terrain.js` porte déjà
  // cette cicatrice. Les deux textes sont comparés, pas décrits.
  // ⚠️ LA CAPTURE S'ARRÊTE À L'ACCOLADE, PAS À LA FIN DE LIGNE — et cette
  // précision-là a été trouvée par le test lui-même : `terrain.js` porte DEUX
  // copies de `mnNoise` (sommet, ligne 458 ; fragment, ligne 495), et la
  // première finit par l'accent grave qui ferme son gabarit. Capturée jusqu'au
  // saut de ligne, elle emportait cet accent grave et ne se retrouvait nulle
  // part — l'assertion échouait sur du vrai code identique.
  const source = TERRAIN_SRC.match(/float mnHash\(vec2 p\)\{[^\n]*\}/)
  assert.ok(source, '`mnHash` a disparu de terrain.js')
  assert.ok(FRAG.includes(source[0]), 'le nuanceur du globe n’a pas le mnHash de terrain.js')
  const bruit = TERRAIN_SRC.match(/float mnNoise\(vec2 p\)\{[^\n]*\}/)
  assert.ok(bruit, '`mnNoise` a disparu de terrain.js')
  assert.ok(FRAG.includes(bruit[0]), 'le nuanceur du globe n’a pas le mnNoise de terrain.js')
})

test('⑥ le grain est appliqué AVANT la rampe et AVANT les courbes', () => {
  // ⚠️ L'ORDRE EST UN ARGUMENT, PAS UN RANGEMENT. Le socle cuit son grain dans
  // la GÉOMÉTRIE : sa couleur ET ses courbes le portent, parce que les deux
  // lisent `vWorldPos.y`. Posé après la rampe, le grain ne serait qu'un bruit de
  // teinte, et les courbes resteraient lisses.
  const g = FRAG.indexOf('h += uGrainForceM')
  assert.ok(g > 0, 'le grain ne modifie pas h')
  assert.ok(g < FRAG.indexOf('float t = sousEau'), 'le grain est appliqué APRÈS la rampe')
  assert.ok(g < FRAG.indexOf('float ch = h / uContourInterval;'), 'le grain est appliqué APRÈS les courbes')
})

// ══════════ ⑦ LES COURBES — la loi de trait du socle, et l'échelle locale ══

test('⑦ l’intervalle s’étale sur le local : 800 m ne rendent PAS les 500 m du globe', () => {
  // ⚠️ C'EST LA LIGNE « ÉCHELLE » DU §3 DU PLAN, APPLIQUÉE AUX LIGNES. À l'île
  // Maurice, qui culmine à 800 m, les 500 m codés en dur du globe ne tracent
  // qu'UNE courbe sur toute l'île.
  assert.equal(intervalleCourbes(800), 50)
  assert.notEqual(intervalleCourbes(800), 500)
  // et un massif alpin de 4 000 m en demande bien davantage
  assert.equal(intervalleCourbes(4000), 200)
  // la loi est monotone
  let prec = 0
  for (const a of [10, 50, 100, 400, 800, 2000, 4000, 9000, 40000]) {
    const p = intervalleCourbes(a)
    assert.ok(p >= prec, `l’intervalle n’est pas monotone en ${a}`)
    prec = p
  }
})

test('⑦ l’intervalle est un pas CARTOGRAPHIQUE, et il est borné des deux côtés', () => {
  // Un intervalle de 37 m n'existe sur aucune carte.
  for (const a of [1, 7, 37, 123, 999, 12345, 1e9]) {
    assert.ok(PAS_CARTO.includes(intervalleCourbes(a)), `${intervalleCourbes(a)} n’est pas un pas cartographique`)
  }
  // ⚠️ ET LE PLANCHER N'EST PAS DÉCORATIF : un crop plat demanderait un
  // intervalle nul, donc `h / 0`, donc un NaN — et `globe.js` rappelle où mène
  // un NaN dans ce nuanceur (« une comparaison FAUSSE, donc un fragment GARDÉ »).
  for (const a of [0, -1, NaN, Infinity, null, undefined]) {
    const p = intervalleCourbes(a)
    assert.ok(Number.isFinite(p) && p > 0, `intervalleCourbes(${a}) rend ${p}`)
  }
})

test('⑦ le nuanceur prend les TROIS constantes de trait du socle, et rend les siennes éteint', () => {
  // ⚠️ TROIS CONSTANTES, ET ELLES DIFFÉRAIENT TOUTES LES TROIS : le globe posait
  // 1.5 / 0.5 / 0.30, le socle pose 1.4 × uContourWeight / 0.55 / 0.22. C'est ce
  // qui fait que les courbes du socle se lisent là où celles du globe s'effacent.
  assert.match(FRAG, /float poidsC = uHabOn > 0\.5 \? 1\.4 \* uContourWeight : 1\.5;/)
  assert.match(FRAG, /float minorK = uHabOn > 0\.5 \? 0\.55 : 0\.5;/)
  assert.match(FRAG, /float crowdK = uHabOn > 0\.5 \? 0\.22 : 0\.30;/)
  // et elles sont EMPLOYÉES — une constante déclarée et non lue ne changerait rien
  assert.match(FRAG, /smoothstep\(0\.0, dch \* poidsC,/)
  assert.match(FRAG, /smoothstep\(0\.0, fwidth\(ch5\) \* poidsC,/)
  assert.match(FRAG, /max\(minor \* minorK, major\)/)
  assert.match(FRAG, /clamp\(1\.0 - dch \* crowdK, 0\.0, 1\.0\)/)
  // ⚠️ et le dépôt confirme d'où viennent 1.4 et 0.22 : `terrain.js`, pas moi
  assert.match(TERRAIN_SRC, /dch \* 1\.4 \* uContourWeight/)
  assert.match(TERRAIN_SRC, /clamp\(1\.0 - dch \* 0\.22, 0\.0, 1\.0\)/)
})

// ══════════ ⑧ LE TRAIT DE CÔTE — sa place dans l'ordre est un argument ═════

test('⑧ le trait de côte est posé AVANT les courbes, comme dans le socle', () => {
  // Une courbe de niveau doit passer PAR-DESSUS le trait de côte : sinon la
  // courbe zéro disparaît sous lui sur toute la longueur du littoral.
  const cote = FRAG.indexOf('float cote = 1.0 - smoothstep(0.0, caa * 1.5')
  assert.ok(cote > 0, 'le trait de côte n’est pas tracé')
  assert.ok(cote < FRAG.indexOf('float ch = h / uContourInterval;'), 'le trait de côte est posé APRÈS les courbes')
  // et la même force qu'au socle : 0,55 vers l'encre
  assert.match(FRAG, /col = mix\(col, uInk, cote \* 0\.55\);/)
  assert.match(TERRAIN_SRC, /uContourColor, coast \* 0\.55\)/)
})

test('⑧ l’occupation du sol MODULE la luminance, elle ne pose pas un aplat', () => {
  // ⚠️ C'est toute la différence entre une carte et un aplat colorié : blSetLum
  // prend la TEINTE de la classe et lui impose une LUMINANCE tirée de la rampe,
  // ce qui laisse l'ombrage, les courbes et la rampe se lire à travers.
  assert.match(FRAG, /blSetLum\(lavis\.rgb, mix\(blLum\(col\), blLum\(lavis\.rgb\), 0\.55\)\)/)
  assert.match(TERRAIN_SRC, /blSetLum\(lavis\.rgb, mix\(lumFond, blLum\(lavis\.rgb\), 0\.55\)\)/)
  // et le plafond à 1 est là : la tirette Force monte à 2, et mix() extrapole
  assert.match(FRAG, /float k = min\(1\.0, lavis\.a \* uSolOpacite\);/)
})

test('⑧ le décodage de classe garde les trois précautions du socle', () => {
  // Chacune répare une faute qui ne lève aucune erreur : le +0,5 avant le floor
  // (un octet valant 40 peut ressortir à 39,997 en précision moyenne), la visée
  // du CENTRE du texel de la table, et la conversion sRVB → linéaire à la main.
  assert.match(FRAG, /floor\(texture2D\(uSol, p\)\.r \* 255\.0 \+ 0\.5\)/)
  assert.match(FRAG, /vec2\(\(code \+ 0\.5\) \/ 256\.0, 0\.5\)/)
  assert.match(FRAG, /step\(vec3\(0\.04045\), e\.rgb\)/)
  // et le mélange des quatre voisins se fait sur la COULEUR, jamais sur le code
  assert.match(FRAG, /c00\.rgb \*= c00\.a; c10\.rgb \*= c10\.a;/)
})
