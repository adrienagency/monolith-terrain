import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { facteursCoins, rayonCoin, dansDalle, bordsExterieurs } from '../src/damier-bords.js'
import { slabInside, makeInsideBlock, blockOutline } from '../src/map/block-clip.js'

// ════════════ POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// Le défaut corrigé ici vit dans un FRAGMENT SHADER : pas une ligne de GLSL ne
// se compile dans node, et c'est précisément pour ça qu'il a survécu à trois
// revues. La parade est de séparer le calcul de son rendu — la règle est une
// fonction JS pure (`dansDalle`, src/damier-bords.js), ces tests portent sur
// elle, et le shader n'en est qu'une transcription de six lignes, relue en
// entier par le dernier test du fichier.
//
// Convention d'axes, la même que tout le module : z = −HALF est le NORD,
// z = +HALF le SUD, x = +HALF l'EST, x = −HALF l'OUEST.

const DEMI = 28 // TERRAIN_SIZE / 2
const RAYON = 5.6
const EXPO = 2 // cercle — l'exposant par défaut de la superellipse
const TOUS = { nord: true, est: true, sud: true, ouest: true }

// ════════════ LA RÈGLE DES COINS ═══════════════════════════════════════════

test('un bloc isole arrondit ses quatre coins', () => {
  assert.deepEqual(facteursCoins(TOUS), { ne: 1, se: 1, so: 1, no: 1 })
})

test('sans bords du tout, on retombe sur le bloc isole', () => {
  assert.deepEqual(facteursCoins(null), { ne: 1, se: 1, so: 1, no: 1 })
  assert.deepEqual(facteursCoins(undefined), { ne: 1, se: 1, so: 1, no: 1 })
})

test('une case entierement cernee n\'arrondit plus rien', () => {
  assert.deepEqual(facteursCoins({ nord: false, est: false, sud: false, ouest: false }),
    { ne: 0, se: 0, so: 0, no: 0 })
})

// LA RÈGLE, ET ELLE N'EST PAS NÉGOCIABLE : un coin n'est arrondi que si SES
// DEUX côtés sont extérieurs. Un quart de rond qui se termine à plat contre une
// jointure est pire que pas d'arrondi. C'est la règle du socle
// (masqueDepuisContour) transcrite pour la surface.
test('un coin n\'est arrondi que si ses DEUX cotes sont exterieurs', () => {
  // les 16 motifs, et pour chacun les 4 coins, dérivés à la main
  for (let m = 0; m < 16; m++) {
    const b = { nord: !!(m & 1), est: !!(m & 2), sud: !!(m & 4), ouest: !!(m & 8) }
    const f = facteursCoins(b)
    assert.equal(f.ne, b.nord && b.est ? 1 : 0, `ne, motif ${m}`)
    assert.equal(f.se, b.sud && b.est ? 1 : 0, `se, motif ${m}`)
    assert.equal(f.so, b.sud && b.ouest ? 1 : 0, `so, motif ${m}`)
    assert.equal(f.no, b.nord && b.ouest ? 1 : 0, `no, motif ${m}`)
  }
})

// UN CÔTÉ INTÉRIEUR EMPORTE SES DEUX COINS — c'est le corollaire qui rend les
// jointures étanches : dès qu'une arête est partagée, la dalle va jusqu'au
// carré sur TOUTE sa longueur, d'un coin à l'autre.
test('un cote interieur met a zero les deux coins qui le bordent', () => {
  const f = facteursCoins({ nord: false, est: true, sud: true, ouest: true })
  assert.equal(f.ne, 0, 'le nord est partage : son coin est doit etre vif')
  assert.equal(f.no, 0, 'et son coin ouest aussi')
  assert.equal(f.se, 1, 'le sud-est, lui, reste arrondi')
  assert.equal(f.so, 1)
})

test('rayonCoin choisit le quadrant par le SIGNE des coordonnees', () => {
  const f = { ne: 1, se: 0, so: 1, no: 0 }
  assert.equal(rayonCoin(10, -10, RAYON, f), RAYON, 'x>0, z<0 : nord-est')
  assert.equal(rayonCoin(10, 10, RAYON, f), 0, 'x>0, z>0 : sud-est')
  assert.equal(rayonCoin(-10, 10, RAYON, f), RAYON, 'x<0, z>0 : sud-ouest')
  assert.equal(rayonCoin(-10, -10, RAYON, f), 0, 'x<0, z<0 : nord-ouest')
})

test('sans facteurs, rayonCoin rend le rayon nominal partout', () => {
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 0]]) {
    assert.equal(rayonCoin(x, z, RAYON, null), RAYON)
  }
})

// ════════════ LES QUATRE CAS NOMMÉS DU BRIEF ═══════════════════════════════

// 1. LE POINT PILE AU COIN DE QUATRE BLOCS. C'est le défaut le plus visible des
// captures : quatre coins arrondis se font face et laissent un TROU EN ÉTOILE
// au milieu du damier. Chacun des quatre blocs voit ce point à un coin
// différent de son propre carré, et pour chacun ce coin a ses deux côtés
// partagés — donc vif, donc le point est DEDANS pour les quatre.
test('le point ou quatre blocs se rejoignent est DEDANS pour les quatre', () => {
  // damier 2×2 : (0,0) le héros, (1,0), (0,1), (1,1). Leur coin commun est le
  // sud-est du héros, en coordonnées locales (+DEMI, +DEMI).
  const cases = new Set(['1,0', '0,1', '1,1'])
  const local = { // le même point monde, vu par chaque bloc
    '0,0': [DEMI, DEMI],   // sud-est du héros
    '1,0': [-DEMI, DEMI],  // sud-ouest de sa voisine d'est
    '0,1': [DEMI, -DEMI],  // nord-est de sa voisine du sud
    '1,1': [-DEMI, -DEMI], // nord-ouest de la diagonale
  }
  for (const [cle, [x, z]] of Object.entries(local)) {
    const [i, j] = cle.split(',').map(Number)
    const f = facteursCoins(bordsExterieurs(i, j, cases))
    assert.equal(dansDalle(x, z, DEMI, RAYON, EXPO, f), true,
      `bloc ${cle} : le coin des quatre doit etre couvert, sinon le trou en etoile`)
  }
})

// … et la PREUVE PAR L'ABSURDE : sans la correction (facteurs tous à 1), ce même
// point est DEHORS pour les quatre. C'est exactement le défaut des captures.
test('preambule : sans les facteurs, ce point est dehors pour les quatre', () => {
  for (const [x, z] of [[DEMI, DEMI], [-DEMI, DEMI], [DEMI, -DEMI], [-DEMI, -DEMI]]) {
    assert.equal(dansDalle(x, z, DEMI, RAYON, EXPO, null), false)
  }
})

// 2. UN POINT SUR UNE ARÊTE PARTAGÉE — dedans des deux côtés, sur TOUTE la
// longueur de l'arête, coins compris. C'est la rainure sombre des captures.
test('toute l\'arete partagee est couverte des deux cotes', () => {
  const cases = new Set(['1,0']) // le héros et sa voisine d'est
  const fHero = facteursCoins(bordsExterieurs(0, 0, cases))
  const fVoisine = facteursCoins(bordsExterieurs(1, 0, cases))
  // l'arête commune est x = +DEMI pour le héros, x = −DEMI pour la voisine ;
  // on la balaie sur toute sa longueur, extrémités comprises
  for (let k = 0; k <= 200; k++) {
    const z = -DEMI + (2 * DEMI * k) / 200
    assert.equal(dansDalle(DEMI, z, DEMI, RAYON, EXPO, fHero), true,
      `heros : trou a z=${z} sur la jointure est`)
    assert.equal(dansDalle(-DEMI, z, DEMI, RAYON, EXPO, fVoisine), true,
      `voisine : trou a z=${z} sur la jointure ouest`)
  }
})

// 3. UN COIN EXTÉRIEUR DE LA GRILLE GARDE SON ARRONDI. Le correctif ne doit pas
// se transformer en « plus d'arrondi du tout » : le pourtour du damier est
// visible, et c'est lui que le curseur de l'utilisateur règle.
test('le coin exterieur du damier garde son arrondi', () => {
  const damier3x3 = new Set(['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1'])
  const f = facteursCoins(bordsExterieurs(-1, -1, damier3x3)) // coin nord-ouest
  assert.deepEqual(f, { ne: 0, se: 0, so: 0, no: 1 }, 'seul le nord-ouest est expose')
  // le coin nord-ouest (−DEMI, −DEMI) est DEHORS : l'arrondi est bien là
  assert.equal(dansDalle(-DEMI, -DEMI, DEMI, RAYON, EXPO, f), false)
  // … et la superellipse est intacte : sur la bissectrice, la frontière est à
  // r·(1/2)^(1/n) du centre du congé, la valeur d'un bloc isolé
  const d = RAYON * Math.pow(0.5, 1 / EXPO)
  const c = DEMI - RAYON // centre du congé, sur chaque axe
  const eps = 1e-9
  assert.equal(dansDalle(-(c + d - eps), -(c + d - eps), DEMI, RAYON, EXPO, f), true)
  assert.equal(dansDalle(-(c + d + eps), -(c + d + eps), DEMI, RAYON, EXPO, f), false)
  // … tandis que les trois autres coins, eux, sont pleins
  assert.equal(dansDalle(DEMI, -DEMI, DEMI, RAYON, EXPO, f), true, 'nord-est : jointure')
  assert.equal(dansDalle(DEMI, DEMI, DEMI, RAYON, EXPO, f), true, 'sud-est : jointure')
  assert.equal(dansDalle(-DEMI, DEMI, DEMI, RAYON, EXPO, f), true, 'sud-ouest : jointure')
})

// 4. LE BLOC ISOLÉ, IDENTIQUE AU PIXEL PRÈS. C'est le contrat le plus dur : le
// mode zone isolée et la fenêtre continue passent tous deux par ce clip sans
// damier, et l'utilisateur règle la rondeur de son bloc au curseur. On rejoue
// donc la FORMULE D'AVANT, recopiée telle quelle, sur une grille fine.
function clipAvant(x, z, half, corner, cornerN) {
  if (Math.abs(x) > half || Math.abs(z) > half) return false
  if (corner <= 0) return true
  const qx = Math.max(Math.abs(x) - (half - corner), 0)
  const qz = Math.max(Math.abs(z) - (half - corner), 0)
  if (qx === 0 && qz === 0) return true
  return Math.pow(Math.pow(qx, cornerN) + Math.pow(qz, cornerN), 1 / cornerN) <= corner
}

test('quatre cotes exposes : le clip est celui d\'avant, point par point', () => {
  const N = 240
  for (const rayon of [0.05, 2.5, RAYON, 13, 27.95]) {
    for (const expo of [2, 2.6, 4, 8]) {
      for (let a = 0; a <= N; a++) {
        for (let b = 0; b <= N; b++) {
          const x = -DEMI + (2 * DEMI * a) / N
          const z = -DEMI + (2 * DEMI * b) / N
          const attendu = clipAvant(x, z, DEMI, rayon, expo)
          assert.equal(dansDalle(x, z, DEMI, rayon, expo, facteursCoins(TOUS)), attendu,
            `r=${rayon} n=${expo} (${x}, ${z})`)
          assert.equal(dansDalle(x, z, DEMI, rayon, expo, null), attendu, 'facteurs absents')
        }
      }
    }
  }
})

// … y compris sur la frontière elle-même, là où un ulp se verrait : on balaie
// le contour exact de la superellipse, coin par coin.
test('quatre cotes exposes : la frontiere du conge ne bouge pas d\'un ulp', () => {
  for (const expo of [2, 3, 5]) {
    const c = DEMI - RAYON
    for (let k = 0; k <= 400; k++) {
      const t = (k / 400) * (Math.PI / 2)
      // point exact du contour de la superellipse |u|^n + |v|^n = r^n
      const u = RAYON * Math.pow(Math.abs(Math.cos(t)), 2 / expo) * Math.sign(Math.cos(t))
      const v = RAYON * Math.pow(Math.abs(Math.sin(t)), 2 / expo)
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const x = sx * (c + u), z = sz * (c + v)
        assert.equal(dansDalle(x, z, DEMI, RAYON, expo, facteursCoins(TOUS)),
          clipAvant(x, z, DEMI, RAYON, expo), `n=${expo} t=${t} (${x}, ${z})`)
      }
    }
  }
})

// ════════════ LES BORDS DROITS RESTENT EXACTS ══════════════════════════════
//
// C'est déjà vrai aujourd'hui (une composante de `cq` vaut zéro le long d'un
// côté droit) et ça doit le rester — un rayon qui change d'un quadrant à
// l'autre ne doit pas creuser une marche au MILIEU d'un côté.
// ⚠️ ON N'ÉCHANTILLONNE PAS LE POINT EXACT DE LA FRONTIÈRE, et c'est délibéré :
// `demi − (demi − r)` ne rend pas `r` au bit près (28 − 22,4 = 5,600000000000001)
// et le point pile sur le bord bascule d'un ulp — AVANT comme APRÈS, la formule
// est la même. L'équivalence exacte est déjà prouvée point par point par le test
// « le clip est celui d'avant » ; ici on mesure la POSITION du bord, à 1e-6 près.
const EPS = 1e-6
test('les bords droits vont exactement jusqu\'a demi, quel que soit le motif', () => {
  for (let m = 0; m < 16; m++) {
    const b = { nord: !!(m & 1), est: !!(m & 2), sud: !!(m & 4), ouest: !!(m & 8) }
    const f = facteursCoins(b)
    // le MILIEU de chaque côté (loin des congés) touche la frontière et pas au-delà
    for (const [ux, uz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const dedans = [ux * (DEMI - EPS), uz * (DEMI - EPS)]
      const dehors = [ux * (DEMI + EPS), uz * (DEMI + EPS)]
      assert.equal(dansDalle(dedans[0], dedans[1], DEMI, RAYON, EXPO, f), true,
        `motif ${m} : le cote (${ux},${uz}) n'atteint pas demi`)
      assert.equal(dansDalle(dehors[0], dehors[1], DEMI, RAYON, EXPO, f), false,
        `motif ${m} : le cote (${ux},${uz}) deborde de demi`)
    }
  }
})

// LE CHANGEMENT DE QUADRANT TOMBE AU CENTRE DE LA DALLE, à `demi` de tout bord :
// aucune discontinuité ne peut s'y voir. On le vérifie plutôt qu'on ne
// l'affirme — la frontière du clip est continue de part et d'autre de x = 0.
test('le passage d\'un quadrant a l\'autre ne creuse aucune marche', () => {
  const f = facteursCoins({ nord: true, est: true, sud: false, ouest: false })
  // sur le côté nord (z = −DEMI), le coin est est arrondi et le coin ouest vif :
  // la frontière doit rester z = −DEMI de part et d'autre de x = 0
  for (const x of [-1, -EPS, 0, EPS, 1]) {
    assert.equal(dansDalle(x, -DEMI + EPS, DEMI, RAYON, EXPO, f), true, `x=${x}`)
    assert.equal(dansDalle(x, -DEMI - EPS, DEMI, RAYON, EXPO, f), false, `x=${x}`)
  }
})

// ════════════ LES CALQUES SE DÉCOUPENT SUR LA MÊME EMPREINTE ═══════════════
//
// `map/block-clip.js` est le pendant JS du shader : c'est lui qui taille les
// rivières, les lacs et les plans d'eau. S'il gardait l'ancien arrondi, un
// cours d'eau qui traverse une jointure s'arrêterait court sur un quart de
// rond que le terrain ne dessine plus.
test('slabInside suit les memes coins que le clip du relief', () => {
  const f = facteursCoins({ nord: true, est: false, sud: false, ouest: true })
  for (const [x, z] of [[DEMI, DEMI], [-DEMI, -DEMI], [DEMI, -DEMI], [-DEMI, DEMI], [12, -DEMI]]) {
    assert.equal(slabInside(x, z, DEMI, RAYON, EXPO, f), dansDalle(x, z, DEMI, RAYON, EXPO, f),
      `(${x}, ${z})`)
  }
  // … et l'appel à cinq arguments, celui d'avant, ne change pas de sens
  assert.equal(slabInside(DEMI, DEMI, DEMI, RAYON, EXPO), false)
})

test('makeInsideBlock transmet les coins de l\'empreinte', () => {
  const coins = facteursCoins({ nord: false, est: false, sud: false, ouest: false })
  const dedans = makeInsideBlock({ half: DEMI, corner: RAYON, cornerN: EXPO, coins })
  assert.equal(dedans(DEMI, DEMI), true, 'case cernee : la dalle va jusqu\'au carre')
  const isole = makeInsideBlock({ half: DEMI, corner: RAYON, cornerN: EXPO })
  assert.equal(isole(DEMI, DEMI), false, 'sans coins : le bloc isole d\'avant')
})

// … ET LE MASQUE DE ZONE ISOLÉE PASSE TOUJOURS DEVANT. En mode zone isolée le
// clip de superellipse est court-circuité (terrain.js) et `blockFootprint` rend
// corner: 0 ET coins: null — la découpe vient du masque, pas des coins.
test('le mode zone isolee ignore les coins et garde son masque', () => {
  const dedans = makeInsideBlock({
    half: DEMI, corner: 0, cornerN: EXPO, coins: null,
    regionOn: true, regionSample: (x) => (x < 0 ? 1 : 0),
  })
  assert.equal(dedans(-10, 0), true)
  assert.equal(dedans(10, 0), false)
})

// blockOutline ray-marche la frontière : avec des coins mixtes elle doit
// atteindre le carré là où le coin est vif, et rester sur l'arc ailleurs.
test('blockOutline pousse jusqu\'au carre les coins remis vifs', () => {
  const coins = facteursCoins({ nord: true, est: true, sud: false, ouest: false })
  const ring = blockOutline({ half: DEMI, corner: RAYON, cornerN: EXPO, coins }, 64, 40)
  const rayonA = (deg) => {
    const t = (deg * Math.PI) / 180
    let best = null, ecart = Infinity
    for (const p of ring) {
      const a = ((Math.atan2(p.z, p.x) * 180) / Math.PI + 360) % 360
      const d = Math.min(Math.abs(a - deg), 360 - Math.abs(a - deg))
      if (d < ecart) { ecart = d; best = p }
    }
    return Math.hypot(best.x, best.z)
  }
  const diagonale = Math.SQRT2 * DEMI
  // 45° = sud-est (x>0, z>0) : deux côtés intérieurs → coin vif, on va au carré
  assert.ok(Math.abs(rayonA(45) - diagonale) < 0.05, `sud-est : ${rayonA(45)} au lieu de ${diagonale}`)
  // 315° = nord-est (x>0, z<0) : nord ET est exposés → l'arrondi reste
  assert.ok(rayonA(315) < diagonale - 1, `nord-est : ${rayonA(315)} devrait etre rentre`)
})

// ════════════ LA TRANSCRIPTION DANS LE SHADER ══════════════════════════════
//
// ⚠️ AUCUN TEST NE PEUT COMPILER CE GLSL. Ce fichier tourne dans node, sans
// contexte graphique — c'est exactement pour ça que le défaut a survécu à trois
// revues. On relit donc le shader comme test/mer-emprise.test.js relit ocean.js
// et test/damier-bords.test.js relit main.js : la règle est prouvée sur la
// fonction pure ci-dessus, et ici on vérifie que la transcription lui ressemble
// ligne à ligne et n'a pas gardé l'ancienne expression symétrique.
const TERRAIN = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')

test('le clip de surface choisit son rayon par quadrant', () => {
  const m = TERRAIN.match(/} else if \(uSlabCorner > 0\.0\) \{[\s\S]*?\n  \}/)
  assert.ok(m, 'le clip de superellipse est introuvable dans le shader')
  const glsl = m[0]
  assert.match(glsl, /float fx = step\(0\.0, pl\.x\);/, 'le quadrant se choisit par le SIGNE de x')
  assert.match(glsl, /float fz = step\(0\.0, pl\.y\);/, '… et par celui de z (vec2.xz : pl.y EST le z)')
  assert.match(glsl, /rCoin = uSlabCorner \* mix\(/, 'le rayon effectif = rayon nominal x facteur du quadrant')
  assert.match(glsl, /mix\(uCoinsDamier\.w, uCoinsDamier\.x, fx\)/, 'nord : no puis ne')
  assert.match(glsl, /mix\(uCoinsDamier\.z, uCoinsDamier\.y, fx\)/, 'sud : so puis se')
  assert.match(glsl, /max\(abs\(pl\) - vec2\(uSlabHalf - rCoin\), 0\.0\)/,
    'la formule reste celle d\'avant, avec le rayon du quadrant')
  assert.match(glsl, /if \(pn > rCoin\) discard;/, 'et le seuil suit le meme rayon')
  // ⚠️ L'ANCIENNE EXPRESSION SYMÉTRIQUE NE DOIT PLUS EXISTER. C'est elle le
  // défaut : `uSlabHalf - uSlabCorner` sur les quatre côtés, donc un carré
  // arrondi par bloc, jointures comprises.
  assert.doesNotMatch(glsl, /uSlabHalf - uSlabCorner/,
    'le rayon nominal ne doit plus entrer directement dans la distance')
  // la superellipse et son exposant, EUX, ne bougent pas : l'utilisateur regle
  // sa rondeur au curseur (uSlabCornerN)
  assert.match(glsl, /pow\(pow\(cq\.x, uSlabCornerN\) \+ pow\(cq\.y, uSlabCornerN\), 1\.0 \/ uSlabCornerN\)/)
})

test('uCoinsDamier est declare, initialise a (1,1,1,1) et pose par setBordsDamier', () => {
  assert.match(TERRAIN, /uniform vec4 uCoinsDamier;/, 'declaration GLSL manquante')
  assert.match(TERRAIN, /uCoinsDamier: \{ value: new THREE\.Vector4\(1, 1, 1, 1\) \}/,
    'le defaut DOIT etre le bloc isole : sinon la fenetre continue et le mode zone isolee changent')
  const m = TERRAIN.match(/setBordsDamier\(bords\) \{[\s\S]*?\n  \}/)
  assert.ok(m, 'Terrain.setBordsDamier introuvable')
  assert.match(m[0], /facteursCoins\(bords\)/, 'la regle vient de damier-bords.js, pas d\'une copie locale')
  assert.match(m[0], /uCoinsDamier\.value\.set\(f\.ne, f\.se, f\.so, f\.no\)/, 'ordre (ne, se, so, no)')
})

test('le mode zone isolee court-circuite toujours ce clip', () => {
  // uRegionOn passe AVANT le clip de superellipse : la découpe de zone
  // remplace l'arrondi, elle ne s'y ajoute pas.
  assert.match(TERRAIN, /if \(uRegionOn > 0\.5\) \{[\s\S]{0,400}?\} else if \(uSlabCorner > 0\.0\) \{/,
    'le clip de coins doit rester dans la branche `else` de la zone isolee')
})

test('l\'empreinte rendue aux calques porte les coins du damier', () => {
  const m = TERRAIN.match(/blockFootprint\(\) \{[\s\S]*?\n  \}/)
  assert.ok(m, 'blockFootprint introuvable')
  assert.match(m[0], /coins: regionOn \? null : this\._coinsDamier/,
    'les calques doivent recevoir les memes coins que le relief')
})

test('le damier pose les coins de toutes ses cases, et main.js ceux du heros', () => {
  const grille = readFileSync(new URL('../src/block-grid.js', import.meta.url), 'utf8')
  const m = grille.match(/majCoinsSurface\(\) \{[\s\S]*?\n  \}/)
  assert.ok(m, 'BlockGrid.majCoinsSurface introuvable')
  assert.match(m[0], /bordsExterieurs\(cell\.i, cell\.j, posees\)/,
    'la MEME source que le masque du socle — deux verites pour une question, jamais')
  assert.match(m[0], /setBordsDamier/)
  // … et elle est appelée sur les trois evenements qui changent le damier
  assert.match(grille, /this\.egaliseHauteurs\(\); this\.majCoinsSurface\(\); this\.onGridChanged/,
    'un depart change les coins des survivantes')
  assert.match(grille, /this\.cells\.set\(key, cell\)\s+this\.majCoinsSurface\(\)/,
    'une arrivee change les coins de ses voisines')

  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const h = main.match(/function majBordsHero\(\)\s*\{[\s\S]*?\n\}/)
  assert.ok(h, 'majBordsHero introuvable')
  assert.match(h[0], /terrain\.setBordsDamier\(cle === '1111' \? null : b\)/,
    'le bloc central ne passe pas par le damier : il a son propre poseur')
  const poseurs = main.match(/terrain\.setBordsDamier\(/g) ?? []
  assert.equal(poseurs.length, 1, `${poseurs.length} poseurs pour le heros : il n'en faut qu'un`)
})
