import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPRISE_COTE, EMPRISE_EN_VOL_MAX, enVolBorne, originesEmprise, recollerEmprise, statsRect, rectFenetre } from '../src/dem-emprise.js'

// Un faux bloc de MNT : la forme exacte que rend `loadDem` (dem.js:519), réduit
// aux clés dont le recollage a besoin.
const bloc = (over = {}) => ({
  data: new Int16Array(4 * 4),
  size: 4,
  tilePx: 512,
  demSource: 'mapterhorn',
  metersPerPixel: 30,
  extentMeters: 120,
  minM: 0,
  maxM: 10,
  meanM: 5,
  lat: 45,
  lon: 6,
  zoom: 12,
  originTileX: 100,
  originTileY: 200,
  ...over,
})

// Neuf blocs en ligne-major, chacun rempli d'une valeur constante = son rang.
// Un damier de constantes est le seul motif où une erreur de rangement se voit
// à coup sûr : une transposition, un décalage d'une ligne, une inversion des
// axes donnent tous une image différente.
function neufBlocs(cote = 4) {
  return Array.from({ length: 9 }, (_, k) => {
    const d = new Int16Array(cote * cote).fill(k)
    return bloc({
      data: d,
      size: cote,
      originTileX: 100 + (k % 3) * 3,
      originTileY: 200 + ((k / 3) | 0) * 3,
      minM: k,
      maxM: k,
      meanM: k,
    })
  })
}

// ── LES ORIGINES ─────────────────────────────────────────────────────────────

test('les neuf origines encadrent le bloc central, en ligne-major', () => {
  const o = originesEmprise({ originTileX: 100, originTileY: 200 }, 3)
  assert.equal(o.length, 9)
  assert.deepEqual(o[0], { x: 97, y: 197 }, 'le premier est le coin haut-gauche')
  assert.deepEqual(o[4], { x: 100, y: 200 }, 'le cinquième est le bloc central lui-même')
  assert.deepEqual(o[8], { x: 103, y: 203 }, 'le dernier est le coin bas-droit')
})

test('les origines avancent de tilesAcross, pas de 1', () => {
  // Une dalle voisine commence là où la précédente finit. Un pas de 1 ferait se
  // chevaucher les neuf dalles à 2/3 et le relief se répéterait.
  const o = originesEmprise({ originTileX: 0, originTileY: 0 }, 3)
  assert.equal(o[1].x - o[0].x, 3)
  assert.equal(o[3].y - o[0].y, 3)
})

// ── LE RECOLLAGE ─────────────────────────────────────────────────────────────

test('le champ recollé fait trois fois le côté d’un bloc', () => {
  const e = recollerEmprise(neufBlocs(4))
  assert.equal(e.size, 12)
  assert.equal(e.data.length, 144)
  assert.ok(e.data instanceof Int16Array, 'reste en Int16 — le levier mémoire du jalon 0')
})

test('chaque bloc atterrit à SA place, et pas à celle du voisin', () => {
  const e = recollerEmprise(neufBlocs(4))
  const at = (x, y) => e.data[y * 12 + x]
  // un point au cœur de chacune des neuf zones
  for (let by = 0; by < 3; by++) {
    for (let bx = 0; bx < 3; bx++) {
      const attendu = by * 3 + bx
      assert.equal(at(bx * 4 + 2, by * 4 + 2), attendu, `zone (${bx},${by})`)
    }
  }
})

test('le bloc CENTRAL occupe bien le tiers central', () => {
  // C'est l'invariant qui garantit qu'entrer en mode continu ne DÉPLACE rien :
  // à décalage nul, la fenêtre doit lire exactement ce qu'elle lisait avant.
  const e = recollerEmprise(neufBlocs(6))
  for (let y = 6; y < 12; y++) for (let x = 6; x < 12; x++) assert.equal(e.data[y * 18 + x], 4)
})

test('l’axe des lignes est bien +z (ligne-major), comme sampleDem le lit', () => {
  // sampleDem indexe `y0 * size + x0` avec y ↔ monde +z. Une transposition ici
  // ferait défiler le terrain à 90° du geste — visible tout de suite, mais
  // impossible à diagnostiquer sans ce test.
  const b = neufBlocs(2)
  b[1].data.fill(77) // colonne 1, ligne 0 → à droite du coin haut-gauche
  const e = recollerEmprise(b)
  assert.equal(e.data[0 * 6 + 2], 77, 'le bloc 1 est à DROITE, pas en dessous')
  assert.equal(e.data[2 * 6 + 0], 3, 'le bloc 3 est EN DESSOUS')
})

// ── LES STATISTIQUES GLOBALES — le piège n° 1 de l'étude ─────────────────────

test('uHeightRange : les extrema portent sur l’emprise ENTIÈRE', () => {
  // ⚠️ LE PIÈGE. Une voisine plus haute que le centre ferait saturer les
  // sommets si l'échelle restait celle du centre — le sommet du voisin
  // dépasserait le haut de la rampe et se peindrait d'une seule couleur.
  const b = neufBlocs(4)
  b[4].minM = 100
  b[4].maxM = 200 // le centre
  b[7].maxM = 3000 // une voisine BIEN plus haute
  b[1].minM = -50 // une autre bien plus basse
  const e = recollerEmprise(b)
  assert.equal(e.maxM, 3000, 'le max est celui de l’emprise, pas du centre')
  assert.equal(e.minM, -50, 'le min aussi')
})

test('meanM reste celui du CENTRE — c’est le zéro vertical', () => {
  // meanM ne normalise rien : il cale la verticale. Le prendre sur l'emprise
  // ferait SAUTER le terrain au moment d'entrer en mode continu, alors que
  // l'image doit être identique à décalage nul.
  const b = neufBlocs(4)
  b[4].meanM = 1234
  assert.equal(recollerEmprise(b).meanM, 1234)
})

test('l’emprise couvre trois fois l’étendue au sol, à résolution constante', () => {
  const e = recollerEmprise(neufBlocs(4))
  assert.equal(e.extentMeters, 360, '3 × 120')
  assert.equal(e.metersPerPixel, 30, 'la résolution ne change pas — on colle, on ne rééchantillonne pas')
})

test('le géoréférencement est celui du coin HAUT-GAUCHE', () => {
  // C'est ce que lit geo.js pour convertir lat/lon ↔ XZ. Laisser l'origine du
  // centre décalerait tous les tracés GPX d'une largeur de bloc.
  const e = recollerEmprise(neufBlocs(4))
  assert.equal(e.originTileX, 100)
  assert.equal(e.originTileY, 200)
})

test('le centre géographique de l’emprise est celui du bloc central', () => {
  const b = neufBlocs(4)
  b[4].lat = -21.13
  b[4].lon = 55.53
  const e = recollerEmprise(b)
  assert.equal(e.lat, -21.13)
  assert.equal(e.lon, 55.53)
  assert.equal(e.zoom, 12)
})

// ── LES REFUS ────────────────────────────────────────────────────────────────

test('un bloc manquant fait échouer le recollage, il ne fabrique pas un trou', () => {
  // Un trou dans l'emprise se lirait comme une plaine au niveau de la mer au
  // milieu des Alpes : une PANNE déguisée en relief. Mieux vaut ne pas entrer
  // en mode continu que de montrer ça.
  const b = neufBlocs(4)
  b[6] = null
  assert.throws(() => recollerEmprise(b), /manquant/i)
})

test('des blocs de tailles différentes sont refusés', () => {
  const b = neufBlocs(4)
  b[2] = bloc({ data: new Int16Array(64), size: 8 })
  assert.throws(() => recollerEmprise(b), /taille/i)
})

test('des blocs de zooms différents sont refusés', () => {
  const b = neufBlocs(4)
  b[5].zoom = 11
  assert.throws(() => recollerEmprise(b), /zoom/i)
})

test('des tailles de tuile différentes sont refusées', () => {
  const b = neufBlocs(4)
  b[5].tilePx = 256
  assert.throws(() => recollerEmprise(b), /tuile/i)
})

test('⚠️ des metersPerPixel différents sont ACCEPTÉS — c’est Mercator, pas un défaut', () => {
  // `metersPerPixel = 156543,03 · cos(lat) / 2^zoom` DÉPEND DE LA LATITUDE : les
  // voisins nord et sud ne sont jamais à la même résolution au sol que le
  // centre (0,6 % d'écart à Chamonix). Une première version exigeait l'égalité.
  // Résultat mesuré : « emprise 3×3 abandonnée » sur les DEUX zones de
  // référence, aucune emprise montée, et un drag qui ne bougeait pas d'un pixel
  // sans qu'aucune erreur ne soit levée. Ce test est là pour que personne ne
  // resserre la garde une seconde fois.
  const b = neufBlocs(4)
  b[1].metersPerPixel = 29.82
  b[7].metersPerPixel = 30.18
  const e = recollerEmprise(b)
  assert.equal(e.metersPerPixel, 30, 'on retient celui du centre — une valeur NOMINALE')
})

test('il en faut neuf, pas huit', () => {
  assert.throws(() => recollerEmprise(neufBlocs(4).slice(0, 8)), /neuf|9/i)
})

test('EMPRISE_COTE vaut 3 — le 3×3 borné qu’Adrien a fixé', () => {
  assert.equal(EMPRISE_COTE, 3)
})

// ── LE NOMBRE DE CHARGEMENTS EN VOL ──────────────────────────────────────────
//
// MESURÉ, sur le mode continu à Chamonix z12 et La Réunion z13 (banc
// `.banc/f3-pic.mjs`) : les neuf `loadDem` lancés d'un seul `Promise.all`
// portent le tas de 160 Mo à 386 Mo pendant le chargement, pour retomber à
// 158 Mo une fois le ramassage passé. Le poste n'est PAS retenu — il est
// TRANSITOIRE, et c'est précisément le pic que l'étude §3.3 refusait quand elle
// écartait `tilesAcross: 9` et ses ~255 Mo. Neuf appels concurrents l'ont
// réintroduit tel quel.
//
// D'où cette règle : les neuf chargements se font par vagues bornées.

test('jamais plus de `limite` chargements en vol à la fois', async () => {
  let enVol = 0
  let pire = 0
  const res = await enVolBorne(
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
    3,
    async (v) => {
      enVol++
      if (enVol > pire) pire = enVol
      await new Promise((r) => setTimeout(r, 5))
      enVol--
      return v * 10
    }
  )
  assert.equal(pire, 3, 'trois en vol au plus — c’est tout l’objet de la règle')
  assert.deepEqual(res, [0, 10, 20, 30, 40, 50, 60, 70, 80])
})

test('les résultats sortent dans l’ordre des entrées, pas dans l’ordre d’arrivée', async () => {
  // `recollerEmprise` lit ses neuf blocs en LIGNE-MAJOR : un résultat rangé
  // dans l'ordre où le réseau a répondu recollerait l'emprise en désordre —
  // un relief faux, sans la moindre erreur levée.
  const res = await enVolBorne([50, 5, 30, 1], 2, async (ms, k) => {
    await new Promise((r) => setTimeout(r, ms))
    return k
  })
  assert.deepEqual(res, [0, 1, 2, 3])
})

test('le rang est passé au chargeur — le centre est reconnu par son rang', async () => {
  // main.js s'en sert pour ne PAS retélécharger le bloc central (rang 4).
  const rangs = []
  await enVolBorne(['a', 'b', 'c'], 2, async (v, k) => {
    rangs.push(k)
    return v
  })
  assert.deepEqual(rangs.sort(), [0, 1, 2])
})

test('chaque entrée est chargée une seule fois', async () => {
  let n = 0
  await enVolBorne(Array.from({ length: 9 }, (_, k) => k), 3, async () => {
    n++
  })
  assert.equal(n, 9)
})

test('un échec remonte, il n’est pas avalé', async () => {
  // Une emprise incomplète se lirait comme une plaine au milieu des Alpes :
  // main.js compte sur le rejet pour retomber sur le bloc unique.
  await assert.rejects(
    () =>
      enVolBorne([1, 2, 3, 4], 2, async (v) => {
        if (v === 3) throw new Error('tuile absente')
        return v
      }),
    /tuile absente/
  )
})

test('une limite absurde est ramenée à un, jamais à zéro', () => {
  // Une limite nulle ne doit pas rendre une promesse qui ne se résout jamais :
  // le voile de chargement l'attend (main.js).
  return Promise.all([
    enVolBorne([1, 2], 0, async (v) => v).then((r) => assert.deepEqual(r, [1, 2])),
    enVolBorne([1, 2], -3, async (v) => v).then((r) => assert.deepEqual(r, [1, 2])),
    enVolBorne([1, 2], NaN, async (v) => v).then((r) => assert.deepEqual(r, [1, 2])),
  ])
})

test('une limite plus grande que la liste ne sérialise rien', async () => {
  let enVol = 0
  let pire = 0
  await enVolBorne([1, 2, 3], 9, async () => {
    enVol++
    if (enVol > pire) pire = enVol
    await new Promise((r) => setTimeout(r, 5))
    enVol--
  })
  assert.equal(pire, 3, 'les trois partent ensemble')
})

test('une liste vide rend une liste vide sans rien appeler', async () => {
  let n = 0
  assert.deepEqual(
    await enVolBorne([], 3, async () => n++),
    []
  )
  assert.equal(n, 0)
})

test('EMPRISE_EN_VOL_MAX borne le pic à trois chargements, pas neuf', () => {
  // Le chiffre porte le budget : trois `loadDem` en vol tiennent ~3 × 30 Mo
  // d'intermédiaires (ImageData + Float32 + champ fusionné) là où neuf en
  // tenaient ~9 × 30. Voir le banc cité en tête de section avant de le monter.
  assert.equal(EMPRISE_EN_VOL_MAX, 3)
})

// ══════════ CE QU'IL Y A SOUS LA FENÊTRE ════════════════════════════════════
//
// Le damier de neuf constantes est exactement le motif qu'il faut ici : chaque
// tiers de l'emprise porte son rang, donc le rectangle visible doit rendre
// EXACTEMENT le rang du tiers qu'on vise. Une erreur d'un facteur `empriseCote`
// — celle qui a déjà mordu `surfaceMetersPerUnit` et la barre d'échelle — se
// traduit alors par un chiffre franchement faux, pas par un arrondi.

const SOCLE = 56 // TERRAIN_SIZE

test('rectFenetre au centre vise le TIERS CENTRAL de l’emprise', () => {
  const e = recollerEmprise(neufBlocs(30)) // size 90, un tiers = 29,67 px
  const r = rectFenetre(e, 0, 0, SOCLE)
  assert.equal(r.cotePx, (e.size - 1) / 3)
  // le centre du rectangle est le centre de l'emprise
  assert.ok(Math.abs(r.px0 + r.cotePx / 2 - (e.size - 1) / 2) < 1e-9)
  assert.ok(Math.abs(r.py0 + r.cotePx / 2 - (e.size - 1) / 2) < 1e-9)
  assert.deepEqual(statsRect(e, r.px0, r.py0, r.cotePx), { minM: 4, maxM: 4, meanM: 4 }, 'le bloc central est le rang 4')
})

test('un défilement d’un socle vise le bloc VOISIN, pas un mélange', () => {
  const e = recollerEmprise(neufBlocs(30))
  // +x d'un socle → colonne de droite (rangs 2, 5, 8) ; +z → ligne du bas
  const droite = rectFenetre(e, SOCLE, 0, SOCLE)
  assert.deepEqual(statsRect(e, droite.px0, droite.py0, droite.cotePx), { minM: 5, maxM: 5, meanM: 5 })
  const bas = rectFenetre(e, 0, SOCLE, SOCLE)
  assert.deepEqual(statsRect(e, bas.px0, bas.py0, bas.cotePx), { minM: 7, maxM: 7, meanM: 7 })
  const coin = rectFenetre(e, -SOCLE, -SOCLE, SOCLE)
  assert.deepEqual(statsRect(e, coin.px0, coin.py0, coin.cotePx), { minM: 0, maxM: 0, meanM: 0 })
})

test('la plage sous la fenêtre est PLUS ÉTROITE que celle de l’emprise', () => {
  // C'est tout le défaut du cartouche : il annonçait la seconde en montrant la
  // première. Neuf blocs de 0 à 8 → l'emprise dit 0–8, la dalle dit 4–4.
  const e = recollerEmprise(neufBlocs(30))
  assert.equal(e.minM, 0)
  assert.equal(e.maxM, 8)
  const r = rectFenetre(e, 0, 0, SOCLE)
  const s = statsRect(e, r.px0, r.py0, r.cotePx)
  assert.ok(s.maxM - s.minM < e.maxM - e.minM)
})

test('statsRect rend une VRAIE moyenne, pas le zéro vertical', () => {
  // ⚠️ `meanM` de l'emprise est celui du bloc CENTRAL — un zéro de scène, pas
  // une altitude moyenne. Confondre les deux ferait dire « mean 4 m » à une
  // dalle qui ne contient que des 0 et des 8.
  const e = recollerEmprise(neufBlocs(30))
  assert.equal(e.meanM, 4)
  const s = statsRect(e, 0, 0, e.size) // l'emprise ENTIÈRE
  assert.equal(s.minM, 0)
  assert.equal(s.maxM, 8)
  assert.ok(Math.abs(s.meanM - 4) < 0.2, `moyenne réelle ${s.meanM}`)
})

test('un rectangle qui déborde est BORNÉ, il ne rend ni NaN ni Infinity', () => {
  // La butée élastique laisse la fenêtre sortir de l'emprise de 7 unités ;
  // `sampleDem` y clampe. Lire à l'index négatif rendrait `undefined` → NaN,
  // c'est-à-dire un cartouche muet.
  const e = recollerEmprise(neufBlocs(30))
  for (const [x, z] of [[-1e6, 0], [1e6, 0], [0, -1e6], [999, 999], [-70, -70], [70, 70]]) {
    const r = rectFenetre(e, x, z, SOCLE)
    const s = statsRect(e, r.px0, r.py0, r.cotePx)
    assert.ok(Number.isFinite(s.minM) && Number.isFinite(s.maxM) && Number.isFinite(s.meanM), `(${x},${z}) → ${JSON.stringify(s)}`)
  }
})

test('hors emprise 3×3, rectFenetre rend le bloc ENTIER — le mode ordinaire est intact', () => {
  const b = bloc({ data: new Int16Array(16).fill(3), size: 4 })
  const r = rectFenetre(b, 0, 0, SOCLE)
  assert.equal(r.cotePx, b.size - 1)
  assert.equal(r.px0, 0)
  assert.equal(r.py0, 0)
  assert.deepEqual(statsRect(b, r.px0, r.py0, r.cotePx), { minM: 3, maxM: 3, meanM: 3 })
})
