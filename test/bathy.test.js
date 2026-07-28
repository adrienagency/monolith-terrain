import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fuseBathymetry,
  detectFillLevels,
  decodeTerrarium,
  encodeTerrarium,
  overzoomTile,
  smoothSeaFloor,
  sampleCatmullRom,
  resampleCatmullRom,
  BLEND_DEPTH,
} from '../src/bathy.js'

const F = (arr) => Float32Array.from(arr)

// ------------------------------------------------------------------ fusion
test('la TERRE n est jamais touchée — le trait de côte ne bouge pas', () => {
  // le relief de référence dit « terre » ; la source fine dit n'importe quoi.
  // ⚠️ On ne met plus 0 dans cet échantillon : depuis la mesure faite sur
  // Toulon et Santorin (100 % et 73 % de zéros EXACTS en mer sur les tuiles
  // AWS de zoom fin, qui viennent de l'EU-DEM, un modèle terrestre), un zéro
  // exact est traité comme une ABSENCE de donnée. La plus petite altitude
  // positive, elle, reste intouchable — c'est l'objet du test suivant.
  const land = F([0.01, 5, 120, 2000])
  const sea = F([-50, -900, -12, 40])
  const out = fuseBathymetry(land, sea)
  assert.deepEqual([...out], [...land], 'aucun pixel émergé ne doit bouger')
})

test('un pixel de MER ne peut jamais émerger, même si la source fine le dit', () => {
  // cas des polders : la source fine prétend +30 m là où la référence dit mer
  const land = F([-200, -80, -3])
  const sea = F([30, 12, 500])
  const out = fuseBathymetry(land, sea)
  for (let i = 0; i < out.length; i++) {
    assert.ok(out[i] < 0, `pixel ${i} a émergé : ${out[i]}`)
  }
})

test('au large, la profondeur vient de la source fine', () => {
  // bien au-delà de la profondeur de fondu : la source fine parle seule
  const land = F([-1800])
  const sea = F([-3400])
  const out = fuseBathymetry(land, sea)
  assert.ok(Math.abs(out[0] - -3400) < 1, `attendu ~-3400, obtenu ${out[0]}`)
})

test('au rivage, on garde le relief de référence (raccord invisible)', () => {
  const land = F([-0.2])
  const sea = F([-400]) // la source fine est très différente…
  const out = fuseBathymetry(land, sea)
  // …mais à 20 cm sous le niveau, le fondu ne lui laisse presque rien
  assert.ok(out[0] > -5, `raccord trop brutal au rivage : ${out[0]}`)
})

test('le fondu est MONOTONE : plus on s enfonce, plus la source fine pèse', () => {
  const prof = [-1, -5, -10, -20, -40, -100]
  const land = F(prof)
  const sea = F(prof.map(() => -2000))
  const out = fuseBathymetry(land, sea)
  // jamais de remontée…
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i] <= out[i - 1], `remontée en ${i} : ${out[i - 1]} → ${out[i]}`)
  }
  // …et STRICTEMENT décroissant tant qu'on est DANS la bande de fondu
  const dansLaBande = prof.filter((p) => -p < BLEND_DEPTH).length
  for (let i = 1; i < dansLaBande; i++) {
    assert.ok(out[i] < out[i - 1], `fondu plat en ${i} : ${out[i - 1]} → ${out[i]}`)
  }
  // passé la bande, la source fine parle SEULE — deux profondeurs identiques
  // sont donc le comportement attendu, pas un bug
  assert.equal(out[out.length - 1], out[out.length - 2])
  assert.ok(out[out.length - 1] < -1000, 'au large, la source fine doit dominer')
})

test('la profondeur de fondu est réglable', () => {
  const land = F([-10])
  const sea = F([-1000])
  const court = fuseBathymetry(land, sea, { blendDepth: 5 })
  const long = fuseBathymetry(land, sea, { blendDepth: 200 })
  assert.ok(court[0] < long[0], 'un fondu court laisse la source fine parler plus tôt')
})

test('source absente ou mal dimensionnée : on rend le relief inchangé', () => {
  const land = F([-100, 5, -20])
  assert.deepEqual([...fuseBathymetry(land, null)], [...land])
  assert.deepEqual([...fuseBathymetry(land, F([-1, -2]))], [...land])
  // et c'est bien une COPIE, pas le tableau d'origine
  const out = fuseBathymetry(land, null)
  out[0] = 999
  assert.equal(land[0], -100, 'l entrée ne doit pas être mutée')
})

test('une valeur non finie dans la source fine est ignorée, pas propagée', () => {
  const land = F([-500, -500])
  const sea = F([NaN, -900])
  const out = fuseBathymetry(land, sea)
  assert.equal(out[0], -500, 'NaN ⇒ on garde la référence')
  assert.ok(Number.isFinite(out[1]))
})

test('un niveau de mer décalé déplace la frontière terre/mer', () => {
  const land = F([3, -3])
  const sea = F([-99, -99])
  const out = fuseBathymetry(land, sea, { seaLevel: 5 })
  assert.ok(out[0] < 3, 'à +3 m sous un niveau à +5, le pixel est immergé')
  assert.ok(out[1] < 0)
})

// ----------------------------------------------------------------- encodage
test('encodeTerrarium et decodeTerrarium sont réciproques', () => {
  for (const m of [-11000, -3800, -464, -1, 0, 0.5, 137, 2750, 8849]) {
    const [r, g, b] = encodeTerrarium(m)
    for (const c of [r, g, b]) {
      assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, `canal hors bornes pour ${m} : ${c}`)
    }
    const back = decodeTerrarium(Uint8Array.from([r, g, b, 255]))[0]
    assert.ok(Math.abs(back - m) <= 1 / 256, `aller-retour ${m} → ${back}`)
  }
})

test('encodeTerrarium borne au lieu de déborder', () => {
  for (const m of [-40000, 90000]) {
    const [r, g, b] = encodeTerrarium(m)
    for (const c of [r, g, b]) assert.ok(c >= 0 && c <= 255, `débordement sur ${m}`)
  }
})

test('decodeTerrarium lit tout un bloc RGBA', () => {
  const [r, g, b] = encodeTerrarium(-1234.5)
  const rgba = Uint8Array.from([r, g, b, 255, r, g, b, 255])
  const out = decodeTerrarium(rgba)
  assert.equal(out.length, 2)
  assert.ok(Math.abs(out[0] - -1234.5) <= 1 / 256)
})

// ------------------------------------------------------------------ surzoom
test('surzoom : sous le plafond, la tuile est rendue telle quelle', () => {
  assert.deepEqual(overzoomTile(6, 33, 22, 8), { z: 6, x: 33, y: 22, scale: 1, ox: 0, oy: 0 })
  assert.deepEqual(overzoomTile(8, 5, 5, 8), { z: 8, x: 5, y: 5, scale: 1, ox: 0, oy: 0 })
})

test('surzoom : au-delà du plafond, on retombe sur l ancêtre et sa sous-fenêtre', () => {
  // z10 demandé, plafond z8 : l'ancêtre est 4× plus large
  const t = overzoomTile(10, 13, 7, 8)
  assert.equal(t.z, 8)
  assert.equal(t.scale, 4)
  assert.equal(t.x, 3) // 13 / 4 = 3.25
  assert.equal(t.y, 1) // 7 / 4 = 1.75
  assert.ok(Math.abs(t.ox - 0.25) < 1e-9)
  assert.ok(Math.abs(t.oy - 0.75) < 1e-9)
})

test('surzoom : la sous-fenêtre reste toujours dans [0,1[', () => {
  for (let z = 9; z <= 15; z++) {
    for (const x of [0, 1, 77, 2 ** z - 1]) {
      const t = overzoomTile(z, x, x, 8)
      assert.ok(t.ox >= 0 && t.ox < 1, `ox hors bornes z${z} x${x} : ${t.ox}`)
      assert.ok(t.x >= 0 && t.x < 2 ** 8, `ancêtre hors grille : ${t.x}`)
    }
  }
})

test('BLEND_DEPTH est exporté et raisonnable', () => {
  assert.ok(BLEND_DEPTH > 0 && BLEND_DEPTH < 200)
})

test('un pixel TRANSPARENT est une absence de donnée, pas une fosse abyssale', () => {
  // le canevas naît transparent là où aucune tuile n'a été peinte ; sans
  // ce garde-fou, (0,0,0,0) se décodait en −32768 m et noyait la carte
  const rgba = Uint8Array.from([0, 0, 0, 0, 128, 10, 5, 255])
  const out = decodeTerrarium(rgba)
  assert.ok(Number.isNaN(out[0]), 'alpha nul doit donner NaN')
  assert.ok(Number.isFinite(out[1]), 'un pixel opaque reste lisible')
})

test('bout en bout : une zone sans tuile ne creuse pas la mer', () => {
  const land = F([-1000, -1000])
  // pixel 0 non peint (transparent), pixel 1 peint à -3000 m
  const [r, g, b] = encodeTerrarium(-3000)
  const sea = decodeTerrarium(Uint8Array.from([0, 0, 0, 0, r, g, b, 255]))
  const out = fuseBathymetry(land, sea)
  assert.equal(out[0], -1000, 'sans donnée, on garde le relief de référence')
  assert.ok(Math.abs(out[1] - -3000) < 1, 'avec donnée, la profondeur fine gagne')
})

// --- RÉGRESSION Santorin / Toulon (2026-07-26) -----------------------------
// Le tuileur aplatit la terre à 0 : ce 0 est une ABSENCE de mesure, pas un
// fond. Il écrasait la mer à zéro dès qu'on surzoomait près d'une côte.
test('un échantillon marin ÉMERGÉ est ignoré, il ne rabote pas la mer à zéro', () => {
  const land = new Float32Array([-800, -800, -800])
  // la source fine dit : terre aplatie (0), vrai fond (-2400), et +12 m
  const sea = new Float32Array([0, -2400, 12])
  const out = fuseBathymetry(land, sea)
  assert.equal(out[0], -800, 'un 0 de terre doit laisser le relief de référence')
  assert.ok(out[1] < -2000, 'un vrai fond doit bien creuser')
  assert.equal(out[2], -800, 'une altitude positive doit être ignorée')
})

test('le cas Santorin : une mer profonde survit à un patch entièrement émergé', () => {
  const n = 64
  const land = new Float32Array(n).fill(-350)
  const sea = new Float32Array(n).fill(0) // surzoom qui n a attrapé que de la terre
  const out = fuseBathymetry(land, sea)
  for (let i = 0; i < n; i++) assert.equal(out[i], -350, `pixel ${i} rabote à zéro`)
})

// --- RÉGRESSION Toulon / Santorin z12 (2026-07-26, second tour) -------------
// Aux zooms fins les tuiles AWS viennent de l'EU-DEM, qui ne décrit que la
// terre : la mer y est un remplissage à ZÉRO EXACT. Mesuré : 100 % de zéros au
// large de Toulon. Les tenir pour de la terre interdisait à GEBCO d'y toucher.
test('une mer remplie à zéro exact est bien creusée par la source fine', () => {
  const land = new Float32Array([0, 0, 0])
  const sea = new Float32Array([-2000, -300, -40])
  const out = fuseBathymetry(land, sea)
  assert.ok(out[0] < -1900, `au large on prend la source fine, reçu ${out[0]}`)
  assert.ok(out[1] < -280, `sur le talus aussi, reçu ${out[1]}`)
  assert.ok(out[2] < -25, `sur le plateau aussi, reçu ${out[2]}`)
})

test('une terre à altitude POSITIVE reste intouchable, même à 1 mm', () => {
  const land = new Float32Array([0.004, 2, 900])
  const sea = new Float32Array([-2000, -2000, -2000])
  const out = fuseBathymetry(land, sea)
  assert.equal(out[0], land[0])
  assert.equal(out[1], 2)
  assert.equal(out[2], 900)
})

test('un polder NÉGATIF ne se fait pas noyer par une source fine muette', () => {
  const land = new Float32Array([-4, -6])
  const sea = new Float32Array([0, 0]) // terre aplatie côté source fine
  const out = fuseBathymetry(land, sea)
  assert.equal(out[0], -4)
  assert.equal(out[1], -6)
})

test('au rivage le fondu reste nul : le trait de côte ne bouge pas', () => {
  const land = new Float32Array([0])
  const sea = new Float32Array([-0.01]) // la source fine dit « à peine immergé »
  const out = fuseBathymetry(land, sea)
  assert.ok(Math.abs(out[0]) < 0.05, `le rivage a bougé de ${out[0]} m`)
})

// --- RÉGRESSION La Ciotat / Nice / Brest z14 (2026-07-28) -------------------
// LES PLATEAUX RECTANGULAIRES À RAS DE L'EAU. Le remplissage de mer du relief
// de référence ne vaut PAS toujours zéro pile : mesuré sur Mapterhorn, il vaut
// −0,094 m sur une dalle, −0,406 m sur sa voisine, −0,344 m sur Nice, −2,781 m
// sur la rade de Brest. `NODATA_EPS` (1/512 m) ne les voit pas ; la fusion les
// prend pour une bathymétrie réelle, éteint son fondu (t = 0,08 %) et MUSELLE
// la source fine — d'où un aplat parfaitement plat, borné par le rectangle de
// la dalle. Mesuré à Nice : 833 054 pixels rendus à −0,34 m alors que la source
// fine y donnait −25,2 m en moyenne.
//
// La signature d'un remplissage n'est pas sa VALEUR, c'est sa PART :
//   remplissage   Nice 99,3 %  ·  Brest 86,8 %  ·  La Ciotat 34,3 % et 26,4 %
//   vraie mer     Tokyo 1,9 %  ·  Manche 1,1 %  ·  Toulon/Égée/Atlantique 0,0 %
// Douze fois d'écart : le seuil est posé à 10 %, au milieu du gouffre.
const champMer = (n, remplir) => {
  const a = new Float32Array(n)
  for (let i = 0; i < n; i++) a[i] = remplir(i)
  return a
}

test('un remplissage de mer NON NUL est reconnu comme une absence de mesure', () => {
  // 4 096 pixels : 60 % à −0,40625 m (l aplat Mapterhorn), le reste en relief
  const n = 4096
  const land = champMer(n, (i) => (i % 5 < 3 ? -0.40625 : -30 - (i % 700)))
  const sea = champMer(n, () => -80)
  const out = fuseBathymetry(land, sea)
  for (let i = 0; i < n; i++) {
    if (i % 5 < 3) assert.ok(out[i] < -70, `l aplat n a pas été creusé en ${i} : ${out[i]}`)
  }
})

test('le remplissage détecté ne fait JAMAIS émerger ni immerger un pixel', () => {
  // la règle absolue du module, vérifiée sur un champ qui porte un aplat
  const n = 4096
  const land = champMer(n, (i) => (i % 3 === 0 ? -2.78125 : i % 3 === 1 ? 12 + i % 50 : -140 - (i % 900)))
  const sea = champMer(n, (i) => (i % 7 === 0 ? 25 : -600))
  const out = fuseBathymetry(land, sea)
  let bascules = 0
  for (let i = 0; i < n; i++) if (land[i] >= 0 !== out[i] >= 0) bascules++
  assert.equal(bascules, 0, 'aucun pixel ne doit changer de statut terre/mer')
})

test('le LISERÉ du remplissage suit le remplissage : le plancher de crédibilité', () => {
  // Après le premier correctif, il restait à La Ciotat un rectangle en relief
  // sur le pourtour de chaque dalle : les valeurs de bord (−0,02 … −0,37 m),
  // trop dispersées pour être des aplats à elles seules, gardaient la main.
  // Au-dessus du plus profond des aplats, la référence n a plus de résolution.
  const n = 4096
  const land = champMer(n, (i) => (i % 4 ? -0.40625 : -0.02 - (i % 37) / 100))
  const sea = champMer(n, () => -70)
  const out = fuseBathymetry(land, sea)
  for (let i = 0; i < n; i++) assert.ok(out[i] < -60, `liseré resté en surface en ${i} : ${out[i]}`)
})

test('⚠️ un plancher détecté ne doit JAMAIS relâcher la TERRE', () => {
  // Le piège : +5 m est bien « au-dessus du plancher » (−0,406 m). Sans le
  // test d immersion, ce pixel de terre passerait dans la branche marine et le
  // trait de côte deviendrait celui de la source fine.
  const n = 4096
  const land = champMer(n, (i) => (i % 4 ? -0.40625 : 5 + (i % 300)))
  const sea = champMer(n, () => -900)
  const out = fuseBathymetry(land, sea)
  for (let i = 0; i < n; i += 4) assert.equal(out[i], land[i], `la terre a bougé en ${i}`)
})

test('un aplat POSITIF reste de la terre : on ne regarde que le côté immergé', () => {
  // une plaine littorale rigoureusement plate à +0,25 m, c est de la TERRE
  const n = 4096
  const land = champMer(n, (i) => (i % 2 ? 0.25 : -500))
  const sea = champMer(n, () => -900)
  const out = fuseBathymetry(land, sea)
  for (let i = 1; i < n; i += 2) assert.equal(out[i], 0.25, `la terre a bougé en ${i}`)
})

test('une VRAIE bathymétrie n est pas prise pour un remplissage', () => {
  // Mesuré : la valeur la plus portée d un vrai fond plafonne à 1,9 % (baie de
  // Tokyo). Ici 1/64 des pixels partagent la même profondeur, et elle doit
  // continuer à piloter le fondu — donc à retenir la source fine au rivage.
  const n = 4096
  const land = champMer(n, (i) => (i % 64 === 0 ? -0.5 : -0.5 - (i % 4000) / 100))
  const sea = champMer(n, () => -900)
  const out = fuseBathymetry(land, sea)
  assert.ok(out[0] > -20, `le rivage a sauté à ${out[0]} : la vraie mer a été prise pour un aplat`)
})

test('deux dalles, deux remplissages : les DEUX sont reconnus', () => {
  // c est le cas de La Ciotat — une dalle à −0,094 m, sa voisine à −0,406 m
  const n = 4096
  const land = champMer(n, (i) => (i < n / 2 ? -0.09375 : -0.40625))
  const sea = champMer(n, () => -60)
  const out = fuseBathymetry(land, sea)
  assert.ok(out[10] < -50, `première dalle non creusée : ${out[10]}`)
  assert.ok(out[n - 10] < -50, `seconde dalle non creusée : ${out[n - 10]}`)
})

test('detectFillLevels : la part se mesure sur le champ IMMERGÉ, pas sur tout', () => {
  // 1/16 du champ est en mer, et 3/4 de cette mer est un aplat : 75 % du champ
  // immergé, mais moins de 5 % du bloc. Compté sur le bloc entier, il passerait
  // sous le seuil et on retomberait dans les plateaux de La Ciotat.
  const n = 65536
  const land = champMer(n, (i) => (i % 16 ? 40 : i % 64 ? -0.34375 : -80 - (i % 5000) / 10))
  assert.ok(detectFillLevels(land).has(-0.34375), 'un aplat noyé dans la terre reste un aplat')
})

test('detectFillLevels : trop peu de mer pour conclure, on ne conclut pas', () => {
  // sur une poignée de pixels, « 10 % du champ » ne veut rien dire : deux
  // pixels identiques feraient un faux aplat. Le module s abstient.
  assert.equal(detectFillLevels(Float32Array.from([-0.2, -0.2, -0.2, -0.2])).size, 0)
})

test('detectFillLevels : un champ sans mer ne rend aucun aplat', () => {
  assert.equal(detectFillLevels(champMer(4096, () => 12)).size, 0)
})

// --- lissage du fond marin -------------------------------------------------
test('le lissage efface une marche du surzoom sans toucher la terre', () => {
  const n = 64
  const d = new Float32Array(n * n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    // une falaise artificielle : deux plateaux de mer separes par une marche,
    // plus une bande de terre en haut
    d[y * n + x] = y < 8 ? 120 : x < n / 2 ? -400 : -600
  }
  const avant = d.slice()
  smoothSeaFloor(d, n, { radius: 6, fadeDepth: 20 })
  // la terre n a pas bouge
  for (let x = 0; x < n; x++) assert.equal(d[2 * n + x], 120, 'terre deplacee')
  // la marche s est adoucie : au bord, la valeur n est plus l un des deux paliers
  const iBord = 40 * n + n / 2
  assert.ok(d[iBord] > -600 && d[iBord] < -400, `marche non lissee : ${d[iBord]}`)
  // loin de la marche, le fond garde sa profondeur
  assert.ok(Math.abs(d[40 * n + 4] - avant[40 * n + 4]) < 5, 'fond du large deforme')
})

test('un rayon nul ou absent ne change rien', () => {
  const d = Float32Array.from([-100, -200, -300])
  const copie = d.slice()
  smoothSeaFloor(d, 1, {})
  assert.deepEqual([...d], [...copie])
})

test('le lissage laisse le rivage tranquille', () => {
  const n = 32
  const d = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) d[i] = -2 // mer TRES peu profonde
  const avant = d.slice()
  smoothSeaFloor(d, n, { radius: 5, fadeDepth: 40 })
  for (let i = 0; i < n * n; i++) {
    assert.ok(Math.abs(d[i] - avant[i]) < 0.2, `rivage bouge de ${d[i] - avant[i]}`)
  }
})

// ═══════════════ AGRANDISSEMENT DU FOND MARIN — Catmull-Rom ═══════════════════
//
// LE CHIFFRE À BATTRE, mesuré sur la VRAIE tuile 8/227/101 (baie de Tokyo),
// fenêtre 48×48 cellules, 73 % de mer, 79 % de cette mer sous 40 m :
//
//   agrandissement                  saut de pente moyen au bord   max
//   bilinéaire (ce qu on faisait)        3,825 m/cellule        57,00
//   Catmull-Rom libre                    0,003 m/cellule         0,05
//   Catmull-Rom + bride rivage           0,006 m/cellule         1,26   ← retenu
//   Catmull-Rom + clamp 2×2 complet      0,296 m/cellule        17,86   ← écarté
//
// C'est ce saut de pente qui dessinait la grille de carrés de 464 m : une
// surface bilinéaire est continue mais sa PENTE casse à chaque bord de cellule,
// et `computeVertexNormals` la révèle intégralement.

const grille = (w, h, f) => {
  const g = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = f(x, y)
  return g
}

// échantillonnage bilinéaire de référence, pour comparer les sauts de pente
function bilin(src, w, h, x, y) {
  const cl = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i)
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const a = src[cl(y0, h) * w + cl(x0, w)], b = src[cl(y0, h) * w + cl(x0 + 1, w)]
  const c = src[cl(y0 + 1, h) * w + cl(x0, w)], d = src[cl(y0 + 1, h) * w + cl(x0 + 1, w)]
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
}

// saut de pente au franchissement des bords de cellule internes
function sautDePente(src, w, h, f) {
  const eps = 1e-4
  let somme = 0, max = 0, n = 0
  for (let y = 1; y < h - 2; y++) {
    for (let x = 1; x < w - 2; x++) {
      const gG = (f(src, w, h, x - eps, y + 0.5) - f(src, w, h, x - 2 * eps, y + 0.5)) / eps
      const gD = (f(src, w, h, x + 2 * eps, y + 0.5) - f(src, w, h, x + eps, y + 0.5)) / eps
      const d = Math.abs(gD - gG)
      somme += d; n++
      if (d > max) max = d
    }
  }
  return { moyen: somme / n, max }
}

test('la PENTE ne casse plus aux bords de cellule — c est ça, les dalles carrées', () => {
  // un fond marin plausible : deux houles croisées sur une pente générale,
  // arrondi au mètre comme le fait le tuileur
  const N = 32
  const fond = grille(N, N, (x, y) =>
    Math.round(-20 - x * 1.7 - y * 0.9 - 14 * Math.sin(x / 3.1) - 9 * Math.cos(y / 2.3))
  )
  const bi = sautDePente(fond, N, N, bilin)
  const cr = sautDePente(fond, N, N, (s, w, h, x, y) => sampleCatmullRom(s, w, h, x, y))
  assert.ok(bi.moyen > 0.5, `le bilinéaire devrait casser franchement, mesuré ${bi.moyen}`)
  // le rapport mesure 1 000× sur GEBCO natif ; on exige au moins 100× ici, la
  // bride rivage pouvant mordre sur une cellule ou deux de ce champ de test
  assert.ok(
    cr.moyen * 100 < bi.moyen,
    `Catmull-Rom devrait diviser le saut par 100 au moins : ${bi.moyen} → ${cr.moyen}`
  )
})

test('le dépassement Catmull-Rom ne fait JAMAIS émerger un pixel de mer', () => {
  // ⚠️ LA RÈGLE DU MODULE. Catmull-Rom dépasse par construction, contrairement
  // au bilinéaire. Un dépassement passant au-dessus du niveau serait lu par
  // `fuseBathymetry` comme une ABSENCE de mesure : la mer y retomberait sur le
  // terrarium, c'est-à-dire sur un remplissage à zéro près des côtes — le
  // « fond plat à zéro » de Santorin et Toulon, en trou d'épingle cette fois.
  //
  // Cas hostile : des fosses étroites entre des hauts-fonds à −1 m, où le
  // dépassement au-dessus des voisins est maximal.
  const N = 16
  const fond = grille(N, N, (x) => (x % 4 === 2 ? -400 : -1))
  for (let y = 0; y < N * 4; y++) {
    for (let x = 0; x < N * 4; x++) {
      const px = (x + 0.5) / 4, py = (y + 0.5) / 4
      const v = sampleCatmullRom(fond, N, N, px, py)
      assert.ok(v < 0, `pixel émergé à (${px},${py}) : ${v}`)
    }
  }
})

test("le dépassement n'immerge JAMAIS un pixel dont les quatre voisins sont émergés", () => {
  // le miroir du précédent, et c'est le cas le PLUS fréquent en vrai : mesuré
  // 3 705 sondes concernées sur la tuile 8/227/101 (contre 9 dans l'autre
  // sens). La source bathy aplatit la terre à 0 ; un dépassement vers le bas y
  // creuserait un trou d'eau au milieu d'un estran.
  const N = 16
  const fond = grille(N, N, (x) => (x % 4 === 2 ? -400 : 0))
  const cl = (i) => (i < 0 ? 0 : i >= N ? N - 1 : i)
  let brides = 0
  for (let y = 0; y < N * 4; y++) {
    for (let x = 0; x < N * 4; x++) {
      const px = (x + 0.5) / 4, py = (y + 0.5) / 4
      const x0 = Math.floor(px), y0 = Math.floor(py)
      const quatre = [
        fond[cl(y0) * N + cl(x0)], fond[cl(y0) * N + cl(x0 + 1)],
        fond[cl(y0 + 1) * N + cl(x0)], fond[cl(y0 + 1) * N + cl(x0 + 1)],
      ]
      if (Math.min(...quatre) < 0) continue // le voisinage n'est pas unanime
      brides++
      assert.ok(
        sampleCatmullRom(fond, N, N, px, py) >= 0,
        `pixel immergé à (${px},${py}) alors que ses 4 voisins sont émergés`
      )
    }
  }
  assert.ok(brides > 100, `le cas n a pas été exercé (${brides} sondes)`)
})

test('la bride ne mord PAS quand le voisinage est franchement en mer', () => {
  // le fond marin ordinaire : la bride doit être totalement transparente, sinon
  // elle rendrait au champ les cassures de pente qu on vient de lui enlever
  const N = 24
  const fond = grille(N, N, (x, y) => -50 - 6 * Math.sin(x / 2) - 4 * Math.cos(y / 3))
  let mordu = 0
  for (let y = 2; y < N - 3; y++) {
    for (let x = 2; x < N - 3; x++) {
      for (let s = 1; s < 4; s++) {
        const v = sampleCatmullRom(fond, N, N, x + s / 4, y + s / 4)
        const libre = sampleCatmullRom(fond, N, N, x + s / 4, y + s / 4, { seaLevel: -1e9 })
        if (Math.abs(v - libre) > 1e-6) mordu++
      }
    }
  }
  assert.equal(mordu, 0, 'la bride a mordu en pleine mer')
})

test('aux bords du tableau : aucune lecture hors limites, la valeur reste finie', () => {
  const N = 6
  const fond = grille(N, N, (x, y) => -10 - x - 3 * y)
  for (const p of [-3, -1, -0.4, 0, 0.5, N - 1, N - 0.5, N + 2, N + 9]) {
    for (const q of [-3, 0, 2.5, N - 0.5, N + 4]) {
      const v = sampleCatmullRom(fond, N, N, p, q)
      assert.ok(Number.isFinite(v), `valeur non finie en (${p},${q}) : ${v}`)
      // bord répliqué : au-delà du tableau on ne peut pas sortir de la plage
      assert.ok(v <= 0 && v > -100, `valeur aberrante en (${p},${q}) : ${v}`)
    }
  }
})

test('Catmull-Rom passe EXACTEMENT par les échantillons source', () => {
  const N = 8
  const fond = grille(N, N, (x, y) => -100 - 13 * x + 7 * y - ((x * y) % 11))
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = sampleCatmullRom(fond, N, N, x, y)
      assert.ok(Math.abs(v - fond[y * N + x]) < 1e-3, `interpolation infidèle en (${x},${y}) : ${v}`)
    }
  }
})

test('un champ constant reste constant, une rampe reste une rampe', () => {
  const N = 8
  const plat = grille(N, N, () => -137)
  const rampe = grille(N, N, (x, y) => -20 - 5 * x - 2 * y)
  for (let i = 0; i < 40; i++) {
    const x = 1 + (i % 7) * 0.83, y = 1 + ((i * 3) % 7) * 0.61
    assert.ok(Math.abs(sampleCatmullRom(plat, N, N, x, y) + 137) < 1e-4, 'champ constant déformé')
    // Catmull-Rom reproduit EXACTEMENT une rampe : pas de biais d'échelle
    const attendu = -20 - 5 * x - 2 * y
    assert.ok(
      Math.abs(sampleCatmullRom(rampe, N, N, x, y) - attendu) < 1e-3,
      `rampe déformée en (${x},${y})`
    )
  }
})

// ------------------------------------------------- l agrandissement en bloc
test('resampleCatmullRom agrandit la SOUS-FENÊTRE demandée, et elle seule', () => {
  // surzoom ×4 : on ne relit qu'un quart de la tuile, comme overzoomTile le dit
  const N = 16
  const src = grille(N, N, (x, y) => -100 - x - y * 10)
  const dst = new Float32Array(64 * 64).fill(999)
  resampleCatmullRom({
    src, srcW: N, srcH: N,
    sx: 8, sy: 4, sw: 4, sh: 4,
    dst, dstStride: 64, dx: 16, dy: 8, dw: 32, dh: 32,
  })
  // hors du rectangle de destination, rien n'a bougé
  assert.equal(dst[0], 999)
  assert.equal(dst[7 * 64 + 16], 999, 'la ligne au-dessus a été écrasée')
  assert.equal(dst[8 * 64 + 15], 999, 'la colonne à gauche a été écrasée')
  assert.equal(dst[40 * 64 + 16], 999, 'la ligne en dessous a été écrasée')
  // le pixel (16,16) du rectangle retombe sur la cellule source (9,5625 ;
  // 5,5625) — même repère que drawImage, centres de pixels alignés
  const xs = 8 + 16.5 * (4 / 32) - 0.5
  const ys = 4 + 16.5 * (4 / 32) - 0.5
  const centre = dst[(8 + 16) * 64 + (16 + 16)]
  assert.ok(
    Math.abs(centre - (-100 - xs - ys * 10)) < 0.01,
    `sous-fenêtre lue à côté : ${centre} au lieu de ${-100 - xs - ys * 10}`
  )
})

test('resampleCatmullRom, à l échelle 1, rend la source au pixel près', () => {
  const N = 12
  const src = grille(N, N, (x, y) => -3 * x - 7 * y - 40)
  const dst = new Float32Array(N * N)
  resampleCatmullRom({ src, srcW: N, srcH: N, sw: N, sh: N, dst, dstStride: N, dw: N, dh: N })
  for (let i = 0; i < N * N; i++) {
    assert.ok(Math.abs(dst[i] - src[i]) < 1e-3, `pixel ${i} déplacé : ${dst[i]} ≠ ${src[i]}`)
  }
})

test('deux sous-fenêtres VOISINES du même ancêtre se raccordent sans couture', () => {
  // ⚠️ CE QUE `drawImage` NE SAVAIT PAS FAIRE. Un rectangle source coupe le
  // voisinage au bord : chaque case interpolait comme si le monde s arrêtait
  // là. En échantillonnant la tuile ENTIÈRE, le raccord entre deux cases
  // voisines devient invisible — c est la seconde famille de dalles.
  const N = 16
  const src = grille(N, N, (x, y) => -60 - 11 * Math.sin(x / 2.2) - 7 * Math.cos(y / 1.7))
  const L = 32
  const dst = new Float32Array(2 * L * L)
  const commun = { src, srcW: N, srcH: N, sw: 4, sh: 4, dst, dstStride: 2 * L, dy: 0, dw: L, dh: L }
  resampleCatmullRom({ ...commun, sx: 4, sy: 4, dx: 0 })
  resampleCatmullRom({ ...commun, sx: 8, sy: 4, dx: L })
  const ligne = L / 2
  const o = ligne * 2 * L
  // un pas ORDINAIRE entre deux pixels de sortie voisins, à l intérieur d une case
  const pas = Math.abs(dst[o + L - 1] - dst[o + L - 2])
  const couture = Math.abs(dst[o + L - 1] - dst[o + L])
  assert.ok(
    couture < 2 * pas + 1e-3,
    `couture de ${couture.toFixed(3)} m pour un pas ordinaire de ${pas.toFixed(3)} m`
  )
})

test('🔴 interpoler l ENCODAGE n est pas interpoler l ALTITUDE — 128 m d écart', () => {
  // ⚠️ LE PIÈGE QUI COÛTAIT LE PLUS CHER, et le plus facile à réintroduire en
  // « simplifiant » avec un drawImage. L'encodage terrarium vaut
  // R·256 + V + B/256 − 32768 : le canal R pèse 256 MÈTRES par unité, et un
  // canevas ne stocke que des entiers 8 bits. Agrandir la tuile avant de la
  // décoder revient à interpoler des octets, et un demi-LSB d'arrondi sur R
  // fait sauter l'altitude de 128 m.
  //
  // Le pire cas n'est pas exotique : c'est le couple 0 m / −1 m, autrement dit
  // LE TRAIT DE CÔTE, où R franchit 127→128.
  const dec = (r, g, b) => r * 256 + g + b / 256 - 32768
  const A = encodeTerrarium(0)
  const B = encodeTerrarium(-1)
  const parOctets = dec(...[0, 1, 2].map((k) => Math.round((A[k] + B[k]) / 2)))
  assert.ok(
    Math.abs(parOctets - -0.5) > 100,
    `le piège aurait disparu de l encodage ? écart mesuré ${(parOctets - -0.5).toFixed(2)} m`
  )

  // notre chemin — DÉCODER D'ABORD, INTERPOLER ENSUITE — rend le bon chiffre
  const src = Float32Array.from([0, 0, -1, -1])
  const milieu = sampleCatmullRom(src, 4, 1, 1.5, 0)
  assert.ok(
    Math.abs(milieu - -0.5) < 1e-4,
    `le milieu de 0 m et −1 m doit valoir −0,5 m, obtenu ${milieu}`
  )

  // et sur toute la dalle agrandie, aucune excursion : c'est le contraire du
  // gouffre à −247 m mesuré dans la baie de Tokyo avant correction
  // Le dépassement Catmull-Rom légitime sur une marche vaut 7,4 % de la marche,
  // soit ici 7,4 CENTIMÈTRES. On tolère 10 cm — et on traque les 128 m.
  const dst = new Float32Array(64)
  resampleCatmullRom({ src, srcW: 4, srcH: 1, sw: 4, sh: 1, dst, dstStride: 64, dw: 64, dh: 1 })
  for (let i = 0; i < 64; i++) {
    assert.ok(dst[i] <= 0.1 && dst[i] >= -1.1, `excursion en ${i} : ${dst[i]} m`)
  }
})

test('une source dégénérée (1 pixel) ne fait pas exploser l agrandissement', () => {
  const src = Float32Array.from([-77])
  const dst = new Float32Array(16)
  resampleCatmullRom({ src, srcW: 1, srcH: 1, sw: 1, sh: 1, dst, dstStride: 4, dw: 4, dh: 4 })
  for (const v of dst) assert.ok(Math.abs(v + 77) < 1e-4, `valeur ${v}`)
})
