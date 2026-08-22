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
  // ⚠️ **SIX DEPUIS LA TÂCHE J bis** : `uFondChamp` porte le fond du crop, que la
  // rampe lit pour savoir qu'elle peint une mer et non un pré. Le compte reste
  // très en dessous du plafond, mais il est ÉCRIT — un sampler ajouté sans que
  // ce chiffre bouge, c'est un chiffre qui ne garde plus rien.
  // ⚠️ **HUIT DEPUIS LA TÂCHE P2** : `uAnalysis` porte le peigné des crêtes
  // (`terrain-analysis.js`) et `uRampCrop` EST le LUT 2D du socle
  // (`terrain.mapUniforms.uRampTex`) — c'est par ce second lien que `rampDry`,
  // `rampWet` et `rampOklab` atteignent la sphère sans une seule couleur
  // recalculée. Le chiffre est REFAIT, pas cru : le commentaire de `globe.js`
  // qui l'annonce est vérifié juste en dessous.
  const n = (FRAG.match(/uniform\s+sampler2D\s+\w+\s*;/g) || []).length
  assert.ok(n <= 16, `le nuanceur du globe déclare ${n} samplers`)
  assert.equal(n, 8, `le compte attendu est 8 (uTex, uRamp, uCoastMask, uSol, uSolLut, uFondChamp, uAnalysis, uRampCrop), pas ${n}`)
  // ⚠️ **ET LE COMMENTAIRE QUI ANNONCE LE COMPTE DOIT DIRE LE MÊME NOMBRE.** Le
  // brief de la Tâche P2 le demandait nommément (« `globe.js:714` compte les
  // samplers — vérifie où en est ce compte avant d'ajouter ») : un pavé qui
  // annonce six pendant que le nuanceur en déclare huit est précisément le genre
  // de prose que le tour de mutation de la Tâche K ter a trouvée verte à tort.
  assert.match(GLOBE_SRC, /uAnalysis et uRampCrop font HUIT/)
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
  // ⚠️ **ET `zeroSousEau` NE TOUCHE PAS À CETTE BRANCHE — Tâche K bis.** Le
  // défaut du zéro ne vivait que dans le prédicat de REPLI : sous le masque, la
  // comparaison est `hM < margeM` avec `margeM > 0`, donc `h == 0` y est DÉJÀ
  // sous l'eau quand le masque dit « mer ». Étendre l'option ici déplacerait la
  // marge d'un cran et noierait la ligne d'eau exacte de la côte.
  // (La campagne de mutation a laissé survivre cette extension : ce bloc la tue.)
  for (const [landness, hM] of [[0, 1.33], [0, 0], [0, -50], [1, 1.33], [1, 0], [0, 2000]]) {
    assert.equal(
      sousEauCrop({ masqueActif: true, landness, hM, margeM: 1.33, zeroSousEau: true }),
      sousEauCrop({ masqueActif: true, landness, hM, margeM: 1.33 }),
      'sous le masque, l’option ne doit RIEN changer — landness=' + landness + ' hM=' + hM
    )
  }
  // et le point exact que l'extension déplacerait : h == margeM reste de la TERRE
  assert.equal(sousEauCrop({ masqueActif: true, landness: 0, hM: 1.33, margeM: 1.33, zeroSousEau: true }), false)
})

test('⑤ le nuanceur pose `sousEau` AVANT la garde, et son défaut est celui d’avant', () => {
  const i = FRAG.indexOf('bool sousEau =')
  assert.ok(i > 0, 'le nuanceur ne pose pas de défaut pour `sousEau`')
  assert.ok(i < FRAG.indexOf('if (uHabOn > 0.5) {'), 'la valeur d’avant est posée APRÈS la garde')
  // ⚠️ **CE TEST NE CHERCHE PLUS LA CHAÎNE `h < 0.0`, IL L'EXÉCUTE — Tâche K
  // bis.** La ligne porte maintenant une ternaire sur `uMerZeroSousEau`, et une
  // assertion de PRÉSENCE serait verte sur n'importe quelle ternaire, y compris
  // sur celle qui échange ses deux branches. On CAPTURE donc l'expression et on
  // la fait tourner aux DEUX valeurs de l'uniforme.
  const m = capture(FRAG, /bool sousEau = ([^;]+);/, 'le défaut de sousEau')
  const f = loi(m[1], ['uMerZeroSousEau', 'h'])
  // uniforme à 0 : le prédicat du dépôt, au bit près — c'est la garde de
  // production, la même que `uCropOn: 0` et `uMppFacteur: 0`
  assert.equal(!!f.appel(0, -0.001), true)
  assert.equal(!!f.appel(0, 0), false, 'à 0, h == 0 doit RESTER sur la branche terre')
  assert.equal(!!f.appel(0, 0.001), false)
  // uniforme à 1 : zéro passe sous l'eau, et RIEN D'AUTRE ne bouge
  assert.equal(!!f.appel(1, -0.001), true)
  assert.equal(!!f.appel(1, 0), true, 'à 1, h == 0 doit quitter la branche terre')
  assert.equal(!!f.appel(1, 0.001), false, 'à 1, un millimètre de terre reste de la terre')
  // et la rampe lit `sousEau`, pas `h < 0.0` — sinon le masque ne servirait
  // qu'au trait de côte et la couleur resterait celle du MNT
  assert.match(FRAG, /float t = sousEau\s*\n/, 'la rampe ne lit pas `sousEau`')
})

test('⑤ bis l’uniforme du zéro de la mer est DÉCLARÉ, et son défaut est 0', () => {
  // ⚠️ **LA GARDE DE PRODUCTION SE VÉRIFIE DES DEUX CÔTÉS** : le nuanceur doit
  // DÉCLARER l'uniforme (sans quoi la ternaire ne compile pas) ET `globe.js`
  // doit le faire naître à 0 (sans quoi la vue orbitale en ligne changerait de
  // couleur sans que personne l'ait demandé). Même patron que `uMerRampeOn`.
  assert.match(FRAG, /uniform float uMerZeroSousEau;/)
  assert.match(GLOBE_SRC, /uMerZeroSousEau: \{ value: 0 \}/)
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

// ════════════════════════════════════════════════════════════════════════════
//  TOUR 1 — CE QUI MANQUAIT, ET C'EST UNE RELECTURE INDÉPENDANTE QUI L'A VU
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠️ **LE GRIEF CENTRAL, ET IL ÉTAIT JUSTE : MES VINGT MUTATIONS DÉPLAÇAIENT LA
// CHAÎNE DE CARACTÈRES QUE L'ASSERTION CHERCHE, PAS LE COMPORTEMENT DU POSTE.**
// Le relecteur a monté sa propre campagne — **15 mutations SÉMANTIQUES, 12 ont
// SURVÉCU** : la garde v42 supprimée du GLSL, le grain réindexé sur `vUv`, le
// grain qui mord sous l'eau, la marge jamais convertie, l'intervalle jamais
// calé, `poserHabillage` qui n'allume rien, `retirerHabillage` qui ALLUME.
// **On pouvait casser l'habillage de six façons sans qu'un test rougisse.**
//
// Les deux parades de cette section :
//   ⑨ `poserHabillage` et `retirerHabillage` sont EXERCÉES, pas grepées. C'est
//     le patron de la Tâche B (`Globe.prototype.X.call` sur un objet minimal) —
//     et là-bas, poser de vrais tests avait révélé un vrai défaut. **Ici aussi :
//     `retirerHabillage` ne remettait pas `uContourInterval`.**
//   ⑩ le nuanceur est EXTRAIT PUIS EXÉCUTÉ, pas décrit. C'est le patron de la
//     Tâche D (`test/crop-rampe.test.js`) : on prend le TEXTE du GLSL, on le
//     traduit en JS et on l'appelle. Une garde retirée du nuanceur change alors
//     une VALEUR, et l'assertion tombe.

import { Globe } from '../src/globe.js'
import { HABILLAGE_MONDE } from '../src/monde/habillage-crop.js'
import { NATUREL_MONDE } from '../src/monde/naturel-crop.js'

// ══════════ ⑨ poserHabillage / retirerHabillage, EXERCÉES ══════════════════
//
// ⚠️ LA VERSION LIVRÉE NE LES COUVRAIT QUE PAR UN GREP DE NOM — quarante lignes
// derrière `assert.ok(/poserHabillage/)`. C'est mot pour mot ce que la relecture
// de la Tâche B avait déjà remonté sur `hauteurSurface`.

const val = (v) => ({ value: v })
const vec2 = (x, y) => ({ x, y, set(a, b) { this.x = a; this.y = b } })
// ⚠️ **UNE COULEUR SE MUTE, ELLE NE SE REMPLACE PAS** — c'est le contrat de
// `THREE.Color` que `poserHabillage` emploie (`u.uHazeColor.value.set(...)`), et
// c'est aussi ce qui rend la couleur de brume INSURVEILLABLE par identité : le
// contexte en transmet donc la valeur hexadécimale (voir `CHAMPS_HABILLAGE`).
const couleurStub = (hex) => ({ hex, set(v) { this.hex = v } })

/** Un globe minimal : rien que les uniformes et le repère du crop. */
function globeStub(crop = REPERE) {
  return {
    _crop: crop,
    uniforms: {
      uHabOn: val(0),
      uCoastMask: val(null),
      uCoastMaskOn: val(0),
      uMargeCoteM: val(HABILLAGE_MONDE.margeCoteM),
      uSol: val(null),
      uSolLut: val(null),
      uSolOn: val(0),
      uSolOpacite: val(HABILLAGE_MONDE.solOpacite),
      uSolOffset: val(vec2(0, 0)),
      uSolScale: val(vec2(1, 1)),
      uSolTexel: val(vec2(1 / 2048, 1 / 2048)),
      uContourInterval: val(HABILLAGE_MONDE.contourIntervalM),
      uContourOpacity: val(HABILLAGE_MONDE.contourOpacite),
      uContourWeight: val(HABILLAGE_MONDE.contourPoids),
      uGrainForceM: val(HABILLAGE_MONDE.grainForceM),
      uGrainEchelle: val(HABILLAGE_MONDE.grainEchelle),
      // ══════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
      //
      // ⚠️ **LE STUB PORTE LES SEIZE UNIFORMES DE L'HABILLAGE PLUS LES QUATORZE
      // DE LA COLORISATION**, et il les part aux MÊMES valeurs que le
      // constructeur : c'est ce qui rend ⑨h (l'aller-retour bit à bit) capable de
      // voir un uniforme que `retirerHabillage` oublierait de rendre.
      uAnalysis: val(null),
      uAnalysisOn: val(0),
      uTexShade: val(NATUREL_MONDE.texShade),
      uWetK: val(NATUREL_MONDE.wetK),
      uExpoK: val(NATUREL_MONDE.expoK),
      uHemi: val(NATUREL_MONDE.hemi),
      uTreeLine: val(NATUREL_MONDE.treeLine),
      uRampCrop: val(null),
      uRampCropOn: val(0),
      uHeightContrast: val(NATUREL_MONDE.heightContrast),
      uHeightPivot: val(NATUREL_MONDE.heightPivot),
      uHazeAmt: val(NATUREL_MONDE.hazeAmt),
      uHazeAlt: val(NATUREL_MONDE.hazeAlt),
      uHazeDist: val(NATUREL_MONDE.hazeDist),
      uHazeColor: val(couleurStub(NATUREL_MONDE.hazeColor)),
    },
  }
}
const poserHab = (g, arg) => Globe.prototype.poserHabillage.call(g, arg)
const retirerHab = (g) => Globe.prototype.retirerHabillage.call(g)
const lireHab = (g) => {
  const o = {}
  for (const [k, u] of Object.entries(g.uniforms)) {
    o[k] = u.value && typeof u.value === 'object' && 'x' in u.value ? [u.value.x, u.value.y] : u.value
  }
  return o
}
const TEX = { nom: 'une texture, peu importe laquelle' }

test('⑨a poserHabillage ALLUME l’habillage — sinon elle ne fait rien du tout', () => {
  // ⚠️ MUTATION QUI SURVIVAIT : `poserHabillage` qui n'allume rien. Aucune
  // assertion ne tombait, et pourtant plus un seul poste ne s'exécutait.
  const g = globeStub()
  assert.equal(g.uniforms.uHabOn.value, 0)
  poserHab(g, {})
  assert.equal(g.uniforms.uHabOn.value, 1, 'poserHabillage n’allume pas uHabOn')
})

test('⑨b retirerHabillage ÉTEINT — et une mutation qui ALLUME tombe ici', () => {
  const g = globeStub()
  poserHab(g, { coastMask: TEX })
  assert.equal(g.uniforms.uHabOn.value, 1)
  retirerHab(g)
  assert.equal(g.uniforms.uHabOn.value, 0, 'retirerHabillage n’éteint pas uHabOn')
})

test('⑨c la marge de côte est CALCULÉE sur le crop — pas laissée à zéro', () => {
  // ⚠️ MUTATION QUI SURVIVAIT : `uMargeCoteM = 0`. Le masque redevenait seul
  // juge, et une lagune que le MNT croit émergée repassait en terre.
  const g = globeStub()
  poserHab(g, { coastMask: TEX })
  const attendu = margeCoteDuCrop(REPERE)
  assert.ok(Math.abs(g.uniforms.uMargeCoteM.value - attendu) < 1e-12, `marge ${g.uniforms.uMargeCoteM.value} au lieu de ${attendu}`)
  assert.ok(g.uniforms.uMargeCoteM.value > 1, 'la marge doit valoir plus d’un mètre, pas zéro')
  // et sans crop il n'y a pas d'emprise d'où la tirer : elle reste nulle
  const sansCrop = globeStub(null)
  poserHab(sansCrop, { coastMask: TEX })
  assert.equal(sansCrop.uniforms.uMargeCoteM.value, 0)
})

test('⑨d l’intervalle des courbes est CALÉ sur l’amplitude — pas laissé à 500', () => {
  // ⚠️ MUTATION QUI SURVIVAIT : l'intervalle jamais calé. C'est LE grief des
  // captures d'Adrien, et il repassait sans qu'un test bronche.
  const g = globeStub()
  poserHab(g, { amplitudeM: 828 }) // l'île Maurice
  assert.equal(g.uniforms.uContourInterval.value, 50)
  assert.notEqual(g.uniforms.uContourInterval.value, HABILLAGE_MONDE.contourIntervalM)
  // un intervalle imposé gagne sur l'amplitude
  const h = globeStub()
  poserHab(h, { amplitudeM: 828, contourIntervalM: 123 })
  assert.equal(h.uniforms.uContourInterval.value, 123)
  // et sans amplitude ni intervalle, on ne touche à rien
  const i = globeStub()
  poserHab(i, {})
  assert.equal(i.uniforms.uContourInterval.value, HABILLAGE_MONDE.contourIntervalM)
})

test('⑨e le masque de côte ne s’allume QUE s’il y a une texture', () => {
  const g = globeStub()
  poserHab(g, {})
  assert.equal(g.uniforms.uCoastMaskOn.value, 0)
  poserHab(g, { coastMask: TEX })
  assert.equal(g.uniforms.uCoastMaskOn.value, 1)
  assert.equal(g.uniforms.uCoastMask.value, TEX)
})

test('⑨f l’occupation du sol exige LES DEUX textures — le code ET sa table', () => {
  // ⚠️ `uSol` porte un CODE de classe, `uSolLut` la couleur. Allumer sans la
  // table ferait lire `solEn` dans une table vide : toutes les classes en noir.
  for (const [sol, lut, attendu] of [[TEX, TEX, 1], [TEX, null, 0], [null, TEX, 0], [null, null, 0]]) {
    const g = globeStub()
    poserHab(g, { sol, solLut: lut })
    assert.equal(g.uniforms.uSolOn.value, attendu, `sol=${!!sol} lut=${!!lut}`)
  }
})

test('⑨g le grain passe, et les vecteurs sont COPIÉS, pas partagés', () => {
  const g = globeStub()
  const offset = { x: 0.25, y: 0.75 }
  poserHab(g, { grainForceM: 3.5, grainEchelle: 64, solOffset: offset, solScale: { x: 2, y: 3 }, solTexel: { x: 0.5, y: 0.25 } })
  assert.equal(g.uniforms.uGrainForceM.value, 3.5)
  assert.equal(g.uniforms.uGrainEchelle.value, 64)
  assert.deepEqual([g.uniforms.uSolOffset.value.x, g.uniforms.uSolOffset.value.y], [0.25, 0.75])
  // ⚠️ COPIÉS : si l'uniforme partageait l'objet de l'appelant, modifier
  // l'argument après coup changerait le rendu à distance.
  offset.x = 99
  assert.equal(g.uniforms.uSolOffset.value.x, 0.25)
})

test('⑨h L’ALLER-RETOUR EST BIT À BIT — c’est le défaut que ce tour a corrigé', () => {
  // ⚠️ **UN VRAI DÉFAUT, TROUVÉ PAR LA RELECTURE.** `uContourInterval` et
  // `uContourOpacity` sont PARTAGÉS par toutes les tuiles et le bloc des courbes
  // les lit **SANS GARDE** : `uHabOn` à 0 ne les neutralise pas. La version
  // livrée ne rendait que quatre uniformes sur seize — **après `retirerCrop`, la
  // planète entière gardait l'intervalle du crop.**
  const g = globeStub()
  const avant = lireHab(g)
  poserHab(g, {
    coastMask: TEX, sol: TEX, solLut: TEX, solOpacite: 1.7,
    solOffset: { x: 0.3, y: 0.4 }, solScale: { x: 2, y: 2 }, solTexel: { x: 0.01, y: 0.02 },
    amplitudeM: 828, contourOpacity: 0.9, contourWeight: 1.3,
    grainForceM: 7, grainEchelle: 12,
  })
  // la pose change bien QUELQUE CHOSE — sinon l'aller-retour serait vrai par
  // construction, et c'est le premier des sept pièges du plan
  assert.notDeepEqual(lireHab(g), avant, 'poserHabillage n’a rien changé')
  retirerHab(g)
  assert.deepEqual(lireHab(g), avant, 'retirerHabillage ne rend pas l’état d’avant')
  // et l'intervalle nommément, parce que c'est LUI qui fuyait
  assert.equal(g.uniforms.uContourInterval.value, HABILLAGE_MONDE.contourIntervalM)
})

test('⑨i le constructeur PREND ses valeurs dans HABILLAGE_MONDE — une seule écriture', () => {
  // ⚠️ La question 2 du §1 de /threejs-optimisation : une constante recopiée
  // diverge en silence. Le constructeur et `retirerHabillage` doivent lire la MÊME
  // source, sinon l'aller-retour ci-dessus devient faux sans prévenir.
  for (const [cle, champ] of [
    ['uContourInterval', 'contourIntervalM'],
    ['uContourOpacity', 'contourOpacite'],
    ['uContourWeight', 'contourPoids'],
    ['uGrainForceM', 'grainForceM'],
    ['uGrainEchelle', 'grainEchelle'],
    ['uSolOpacite', 'solOpacite'],
    ['uMargeCoteM', 'margeCoteM'],
  ]) {
    assert.ok(
      new RegExp(cle + ':\\s*\\{\\s*value:\\s*HABILLAGE_MONDE\\.' + champ + '\\s*\\}').test(GLOBE_SRC),
      'le constructeur ne prend pas ' + cle + ' dans HABILLAGE_MONDE.' + champ
    )
  }
})

// ══════════ ⑩ LE NUANCEUR EXTRAIT PUIS EXÉCUTÉ ═════════════════════════════
//
// ⚠️ **C'EST LA PARADE AU GRIEF CENTRAL DU TOUR 1.** Mes assertions de la
// version livrée DÉCRIVAIENT le nuanceur ; on pouvait donc en changer le SENS
// sans changer la chaîne qu'elles cherchaient — le relecteur l'a démontré avec
// 15 mutations sémantiques dont 12 ont survécu. Ici on prend le TEXTE du GLSL,
// on le traduit en JS, et **on l'appelle**. Une garde retirée du nuanceur change
// alors une VALEUR, et l'assertion tombe. C'est le patron de
// test/crop-rampe.test.js (Tâche D), repris tel quel.
//
// ⚠️ **ET LE VERDICT DU NUANCEUR EST CONFRONTÉ À CELUI DU MODULE PUR**, pas à ma
// propre arithmétique : sousEauCrop, uvChampCrop, uvDrapeCrop et grainCrop
// servent d'oracle. Si les deux divergent, l'un des deux a tort — le test ne dit
// pas lequel, mais il dit qu'il faut regarder.

/** Le corps d'un bloc à accolades équilibrées, à partir d'une ancre. */
function blocApres(src, ancre) {
  const i = src.indexOf(ancre)
  assert.ok(i >= 0, 'ancre introuvable dans le nuanceur : ' + ancre)
  const o = src.indexOf('{', i)
  assert.ok(o >= 0, 'pas d’accolade après ' + ancre)
  let n = 0
  for (let k = o; k < src.length; k++) {
    if (src[k] === '{') n++
    else if (src[k] === '}') { n--; if (n === 0) return src.slice(o + 1, k) }
  }
  assert.fail('accolades déséquilibrées après ' + ancre)
  return ''
}

/** Une expression GLSL SCALAIRE du nuanceur, rendue appelable. */
function loi(glsl, noms) {
  const js = glsl
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bclamp\s*\(/g, 'CLAMP(')
    .replace(/\bmax\s*\(/g, 'Math.max(')
    .replace(/\bmin\s*\(/g, 'Math.min(')
    .trim()
  const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)
  // eslint-disable-next-line no-new-func
  const f = new Function(...noms, 'CLAMP', 'return (' + js + ');')
  return { js, appel: (...a) => f(...a, CLAMP) }
}

/** Capture OBLIGATOIRE : rend le groupe 1, et échoue si le motif a disparu. */
function capture(src, re, quoi) {
  const m = src.match(re)
  assert.ok(m, 'le nuanceur ne porte plus ' + quoi)
  return m
}

/** Découpe « A, B » au niveau de parenthèses zéro. */
function deuxArgs(txt) {
  let n = 0
  for (let i = 0; i < txt.length; i++) {
    if (txt[i] === '(') n++
    else if (txt[i] === ')') n--
    else if (txt[i] === ',' && n === 0) return [txt.slice(0, i).trim(), txt.slice(i + 1).trim()]
  }
  assert.fail('pas de virgule de premier niveau dans : ' + txt)
  return ['', '']
}

// ---- ⑩a la garde v42, EXÉCUTÉE -------------------------------------------

test('⑩a la garde v42 du nuanceur rend le MÊME verdict que la loi — sur 5 043 cas', () => {
  // ⚠️ **MUTATION QUI SURVIVAIT** : retirer « && h < uMargeCoteM » du GLSL.
  // Aucune assertion ne tombait, et la rampe océan se remettait à peindre les
  // montagnes — le défaut que le correctif v42 de terrain.js avait réparé.
  // ⚠️ LA RECHERCHE ARRIÈRE N'EST PAS UNE COQUETTERIE : « sousEau = » est
  // CONTENU dans « bool sousEau = », et String.match rend la PREMIÈRE
  // occurrence. Sans elle, ce test évaluait la valeur par défaut en croyant
  // évaluer la garde v42 — rouge sur du code juste, vert sur la mutation visée.
  const m = capture(FRAG, /(?<!bool )sousEau = ([^;]+);/, 'l’affectation de sousEau sous le masque')
  const f = loi(m[1], ['landness', 'h', 'uMargeCoteM'])
  let vus = 0
  for (const marge of [0, 1.745, 12]) {
    for (let i = 0; i <= 40; i++) {
      const landness = i / 40
      for (let j = -20; j <= 20; j++) {
        const h = j * 137.3
        const attendu = sousEauCrop({ masqueActif: true, landness, hM: h, margeM: marge })
        assert.equal(!!f.appel(landness, h, marge), attendu, 'landness=' + landness + ' h=' + h + ' marge=' + marge)
        vus++
      }
    }
  }
  assert.ok(vus > 5000, 'le balayage doit être large, sinon il ne prouve rien')
  // les trois cas nommés du correctif v42, en clair
  assert.equal(f.appel(0, 2000, 1.745), false, 'un sommet à 2 000 m que le masque croit en mer doit rester TERRE')
  assert.equal(f.appel(0, 1.7, 1.745), true)
  assert.equal(f.appel(1, -50, 1.745), false)
})

test('⑩b sans masque, le nuanceur retombe sur le prédicat d’avant — exécuté, pas décrit', () => {
  const m = capture(FRAG, /bool sousEau = ([^;]+);/, 'la valeur par défaut de sousEau')
  const f = loi(m[1], ['uMerZeroSousEau', 'h'])
  // ⚠️ **LES DEUX BRANCHES SONT CONFRONTÉES À LA LOI PURE — Tâche K bis.** Le
  // nuanceur et `sousEauCrop` doivent dire la même chose aux DEUX valeurs de
  // l'uniforme, zéro compris : c'est là, et seulement là, qu'elles diffèrent.
  for (const zero of [0, 1]) {
    for (let j = -60; j <= 60; j++) {
      const h = j * 91.7
      assert.equal(
        !!f.appel(zero, h),
        sousEauCrop({ masqueActif: false, landness: 0, hM: h, margeM: 1.745, zeroSousEau: zero > 0.5 }),
        'zero=' + zero + ' h=' + h
      )
    }
    // et le point qui SÉPARE les deux lois, en propre
    assert.equal(!!f.appel(zero, 0), zero > 0.5, 'h == 0, uMerZeroSousEau=' + zero)
  }
})

test('⑩c la rampe est pilotée par le jeton sousEau — CAPTURÉ, pas cherché', () => {
  // Un retour à « h < 0.0 » change la capture, et le masque de côte ne
  // déciderait plus que du trait, plus de la couleur.
  const m = capture(FRAG, /float t = ([A-Za-z_][A-Za-z0-9_]*)\s*\n/, 'la ternaire de la rampe')
  assert.equal(m[1], 'sousEau', 'la rampe est pilotée par ' + m[1] + ' et non par sousEau')
})

// ---- ⑩d le grain, EXÉCUTÉ -------------------------------------------------

test('⑩d la garde du grain REFUSE de mordre sous l’eau — exécutée', () => {
  // ⚠️ **MUTATION QUI SURVIVAIT** : « if (uGrainForceM > 0.0) » sans
  // « && h > 0.0 ». Le fond marin se couvrait d'une rugosité que la bathymétrie
  // ne porte pas, et les courbes bathymétriques se mettaient à onduler.
  const m = capture(FRAG, /if \((uGrainForceM[^)]*)\) \{\s*\n\s*vec2 gp/, 'la garde du grain')
  const f = loi(m[1], ['uGrainForceM', 'h'])
  for (const [force, h, attendu] of [
    [3.489, -1000, false], [3.489, -0.001, false], [3.489, 0, false],
    [3.489, 0.001, true], [3.489, 3000, true],
    [0, 3000, false], [0, -3000, false],
  ]) {
    assert.equal(!!f.appel(force, h), attendu, 'force=' + force + ' h=' + h)
  }
  // et la garde du nuanceur dit la MÊME chose que la loi pure : sous l'eau, zéro
  for (const h of [-500, -1, 0, 1, 500]) {
    const nuanceurMord = !!f.appel(3.489, h)
    const loiMord = grainCrop({ u: 0.21, v: -0.13, force: 3.489, echelle: 96, surTerre: h > 0 }) !== 0
    assert.equal(nuanceurMord, loiMord, 'h=' + h)
  }
})

test('⑩e le grain est indexé sur qCrop — le nom est CAPTURÉ, pas cherché', () => {
  // ⚠️ **MUTATION QUI SURVIVAIT** : « vec2 gp = vUv * uGrainEchelle; ». Le grain
  // se répétait à chaque tuile — seize grains au lieu d'un — et se décalait avec
  // la tuile au lieu de rester solidaire du sol.
  const m = capture(FRAG, /vec2 gp = ([A-Za-z_][A-Za-z0-9_]*) \* uGrainEchelle;/, 'l’index du grain')
  assert.equal(m[1], 'qCrop', 'le grain est indexé sur ' + m[1] + ' au lieu de qCrop')
  // et AUCUN uv de tuile ne se lit dans tout le bloc de l’habillage
  // ⚠️ LES COMMENTAIRES SONT RETIRÉS D'ABORD : le bloc en porte un qui dit
  // « INDEXE SUR LE CROP, JAMAIS SUR vUv », et un commentaire n'est pas du code.
  const bloc = blocApres(FRAG, 'if (uHabOn > 0.5) {').replace(/\/\/[^\n]*/g, ' ')
  assert.ok(!/\bvUv\b/.test(bloc), 'le bloc de l’habillage lit vUv — il serait solidaire de la TUILE')
})

test('⑩f la composition des deux octaves du nuanceur EST celle de la loi pure', () => {
  // On extrait le terme ajouté à h, on l'appelle avec deux valeurs de bruit
  // connues, et on exige le même nombre que grainCrop calculé sur les mêmes deux
  // valeurs. Un poids changé d'un seul côté tombe ici.
  const m = capture(FRAG, /h \+= (uGrainForceM \* \([^;]+\));/, 'le terme de grain')
  const f = loi(m[1], ['uGrainForceM', 'g1', 'g2'])
  const p = 96
  for (const [u, v] of [[0.21, -0.13], [-0.77, 0.4], [0, 0], [0.99, 0.99]]) {
    const g1 = bruitValeur(u * p, v * p)
    const g2 = bruitValeur(u * p * 2.17 + 19.3, v * p * 2.17 - 7.1)
    const attendu = grainCrop({ u, v, force: 3.489, echelle: p })
    assert.ok(Math.abs(f.appel(3.489, g1, g2) - attendu) < 1e-12, 'u=' + u + ' v=' + v)
  }
})

// ---- ⑩g les deux UV, ÉVALUÉS ---------------------------------------------

test('⑩g l’UV du champ cuit du nuanceur ÉGALE uvChampCrop — sur 441 points', () => {
  const m = capture(FRAG, /vec2 cmUv = ([A-Za-z_][A-Za-z0-9_]*) \* ([\d.]+) \+ ([\d.]+);/, 'l’UV du masque de côte')
  assert.equal(m[1], 'qCrop', 'le champ est lu en ' + m[1])
  const a = Number(m[2])
  const b = Number(m[3])
  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const u = i / 10
      const v = j / 10
      const attendu = uvChampCrop(u, v)
      assert.ok(Math.abs(u * a + b - attendu.x) < 1e-15, 'x en (' + u + ',' + v + ')')
      assert.ok(Math.abs(v * a + b - attendu.y) < 1e-15, 'y en (' + u + ',' + v + ')')
    }
  }
})

test('⑩h l’UV drapé du nuanceur ÉGALE uvDrapeCrop — le retournement compris', () => {
  // ⚠️ **MUTATION QUI SURVIVAIT** : le retournement en y perdu. La forêt à
  // l'envers, et rien qui lève d'erreur.
  const m = capture(FRAG, /vec2 sUv = vec2\(([^;]+)\);/, 'l’UV drapé de l’occupation du sol')
  const [ax, ay] = deuxArgs(m[1])
  const fx = loi(ax, ['qCrop'])
  const fy = loi(ay, ['qCrop'])
  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const q = { x: i / 10, y: j / 10 }
      const attendu = uvDrapeCrop(q.x, q.y)
      assert.ok(Math.abs(fx.appel(q) - attendu.x) < 1e-15, 'x en (' + q.x + ',' + q.y + ')')
      assert.ok(Math.abs(fy.appel(q) - attendu.y) < 1e-15, 'y en (' + q.x + ',' + q.y + ')')
    }
  }
  // et les deux familles ne se confondent pas : hors du centre du crop, l’UV
  // drapé et l’UV cuit DIFFÈRENT en y
  assert.notEqual(fy.appel({ x: 0, y: 0.6 }), uvChampCrop(0, 0.6).y)
})

// ---- ⑩i la loi de trait, ÉVALUÉE -----------------------------------------

test('⑩i les trois constantes de trait sont ÉVALUÉES aux deux états, pas lues', () => {
  // ⚠️ Éteint, le nuanceur doit rendre EXACTEMENT les trois valeurs d’avant la
  // Tâche C ; allumé, celles de terrain.js. Une mutation qui fige l’un ou
  // l’autre côté tombe ici — celle qui figeait poidsC à 1.5 survivait avant.
  const lois = {}
  for (const [nom, defaut, socle] of [
    ['poidsC', 1.5, 1.4 * 0.7],
    ['minorK', 0.5, 0.55],
    ['crowdK', 0.3, 0.22],
  ]) {
    const m = capture(FRAG, new RegExp('float ' + nom + ' = ([^;]+);'), 'la constante ' + nom)
    const f = loi(m[1], ['uHabOn', 'uContourWeight'])
    lois[nom] = f
    assert.ok(Math.abs(f.appel(0, 0.7) - defaut) < 1e-12, nom + ' éteint vaut ' + f.appel(0, 0.7) + ' au lieu de ' + defaut)
    assert.ok(Math.abs(f.appel(1, 0.7) - socle) < 1e-12, nom + ' allumé vaut ' + f.appel(1, 0.7) + ' au lieu de ' + socle)
  }
  // ⚠️ ET LE POIDS SUIT VRAIMENT LA TIRETTE DU SOCLE — sinon elle serait morte
  // côté globe, et rien ne le dirait.
  assert.ok(Math.abs(lois.poidsC.appel(1, 1.4) - 1.4 * 1.4) < 1e-12)
  assert.notEqual(lois.poidsC.appel(1, 1.4), lois.poidsC.appel(1, 0.7))
  // éteint, la tirette ne doit RIEN changer : la production est intouchée
  assert.equal(lois.poidsC.appel(0, 1.4), lois.poidsC.appel(0, 0.7))
})

test('⑩j le trait de côte et l’occupation du sol gardent la FORCE du socle', () => {
  // Les deux nombres sont capturés des DEUX fichiers et comparés entre eux : si
  // le socle change sa force, le globe doit suivre, et ce test le dit.
  const g = capture(FRAG, /col = mix\(col, uInk, cote \* ([\d.]+)\);/, 'la force du trait de côte')
  const s = capture(TERRAIN_SRC, /uContourColor, coast \* ([\d.]+)\)/, 'la force du trait de côte du socle')
  assert.equal(Number(g[1]), Number(s[1]), 'le globe pose ' + g[1] + ' là où le socle pose ' + s[1])
  const gl = capture(FRAG, /blSetLum\(lavis\.rgb, mix\(blLum\(col\), blLum\(lavis\.rgb\), ([\d.]+)\)\)/, 'le dosage de luminance du sol')
  const sl = capture(TERRAIN_SRC, /blSetLum\(lavis\.rgb, mix\(lumFond, blLum\(lavis\.rgb\), ([\d.]+)\)\)/, 'le dosage du socle')
  assert.equal(Number(gl[1]), Number(sl[1]), 'le globe dose à ' + gl[1] + ' là où le socle dose à ' + sl[1])
})

test('⑨j HABILLAGE_MONDE porte bien les valeurs D’AVANT la Tâche C', () => {
  // ⚠️ SANS CETTE ASSERTION, CHANGER LA CONSTANTE PASSE INAPERÇU : le
  // constructeur et `retirerHabillage` la lisent tous les deux, donc
  // l'aller-retour de ⑨h resterait vert alors que le globe peindrait la planète
  // entière avec un autre intervalle. Les trois valeurs sont celles que
  // `globe.js` posait en dur avant cette tâche — 500 m d'équidistance à
  // l'échelle du monde, 0,55 d'opacité, et le poids de trait du socle.
  assert.equal(HABILLAGE_MONDE.contourIntervalM, 500)
  assert.equal(HABILLAGE_MONDE.contourOpacite, 0.55)
  assert.equal(HABILLAGE_MONDE.contourPoids, 0.7)
  assert.equal(HABILLAGE_MONDE.grainForceM, 0)
  assert.equal(HABILLAGE_MONDE.margeCoteM, 0)
  // ⚠️ et l'objet est GELÉ : un uniforme partagé qu'on peut réécrire à distance
  // ne serait plus une référence, juste une variable de plus.
  assert.ok(Object.isFrozen(HABILLAGE_MONDE))
})
