import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fuseBathymetry, decodeTerrarium, encodeTerrarium, overzoomTile, smoothSeaFloor, BLEND_DEPTH } from '../src/bathy.js'

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
