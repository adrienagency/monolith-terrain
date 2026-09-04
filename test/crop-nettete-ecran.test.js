// LE CROP NET — L'ÉCART ENTRE LE TEXEL SERVI ET LE PIXEL AFFICHÉ (CN1)
//
// > **Adrien, 2026-09-04 :** *« Je veux un crop net. Quand je zoome dans le
// > socle, l'image ne gagne pas en détail : elle grossit. »*
//
// ⛔ **CES TESTS SONT ÉCRITS AVANT LE CORRECTIF ET SONT ROUGES À LA LIVRAISON.**
// Trois d'entre eux (①, ②, ④) échouent sur le dépôt d'aujourd'hui ; ils
// passeront quand le crop deviendra net. Les trois autres (⓪, ③, ⑤) sont des
// GARDES VERTES : ils décrivent ce qu'un correctif n'a pas le droit de casser.
// Le compte attendu au moment où ce fichier est déposé : **3 échecs sur 6**.
//
// ══════════ CE QUI EST MESURÉ, ET SUR QUEL BANC ═════════════════════════════
//
// Le banc est celui de `test/crop-emprise-ecran.test.js` (CULL) : DOM de papier,
// `fetch` qui rend une dalle plate immédiatement, vrai `Globe`, vraies boucles.
//
// ⚠️ **EN QUOI CE BANC DIFFÈRE DE LA PRODUCTION — à écrire, sinon le chiffre ne
// se compare à rien** (§2 de `/threejs-optimisation`) :
//   · la source est forcée à **AWS, tuiles de 256 px** (`_resetDemSource`),
//     là où la production sert du **Mapterhorn 512 px**. À niveau de tuile
//     égal, le banc sert donc un texel **DEUX FOIS PLUS GROS** que la
//     production : un `pxParTexel` du banc vaut le double de celui de
//     l'application. Les seuils ci-dessous en tiennent compte, et le disent.
//   · la caméra est **au nadir**, à la verticale du centre du crop. Le mètre
//     par pixel y vaut exactement `2 · altitude · tan(fov/2) / hauteurPx`, sans
//     raccourci ni relief. Dans l'application, la vue est de trois quarts et le
//     relief rapproche la surface : mesuré (`scripts/sonde-cn1.mjs`), à 900 m
//     d'altitude de cadrage, le mètre par pixel vaut 1,44 en plaine (Beauce,
//     Bretagne, Majorque) mais **0,345 dans les Alpes** — un facteur 4 dû au
//     seul relief. Le banc décrit donc le cas FAVORABLE.
//   · pas de `requestAnimationFrame` : les images sont poussées à la main.
//
// ══════════ LA MESURE DE RÉFÉRENCE, DANS L'APPLICATION ══════════════════════
//
// `scripts/sonde-cn1.mjs`, Chrome sans tête, 1280×720, pixelRatio 1, CPU ×4,
// vite sur 127.0.0.1:8941, 20 images consécutives au repos, quatre lieux, bloc
// à `DEFAULT_FINE_ZOOM = 15`. Traces : `.banc/CN1/*.json` (ignoré par git).
//
//   | altitude | Beauce | Bretagne | Majorque | Alpes |
//   |---|---|---|---|---|
//   | 20 000 m | 0,19 | 0,19 | 0,22 | 0,21 |
//   |  5 000 m | 0,77 | 0,78 | 0,90 | 0,94 |
//   |  2 000 m | 1,94 | 1,96 |   —  | 3,09 |
//   |    900 m | **4,31** | **4,45** | **5,09** | **19,3** |
//   |    600 m | **6,45** | **6,79** |   —  | **43,5** |
//
// (pixels d'écran par texel servi, direction horizontale, médiane de 20 images ;
// le tirage des Alpes a été rejoué à l'identique : 19,28 puis 19,44, et 43,52
// puis 43,52.)
//
// ⚠️ **ET LE TEXEL SERVI NE BOUGE PAS D'UN BIT SUR TOUTE LA PLAGE** : 6,647 m
// aux Alpes, 6,346 en Bretagne, 6,369 en Beauce, 7,360 à Majorque — la MÊME
// valeur à 20 000 m et à 600 m, avec le MÊME histogramme de niveaux
// (`{13: n}`) et le MÊME effectif de cache à l'unité près. C'est le point fixe
// du §2 de la compétence : deux extrêmes identiques sur un facteur 33
// d'altitude, donc un plafond qui n'est pas celui qu'on croit.
//
// ══════════ LA PREUVE QUE CES TESTS MORDENT ═════════════════════════════════
//
// ⛔ **UNE SUITE VERTE NE PROUVE RIEN, ET UNE SUITE ROUGE NON PLUS** — CULL a
// mesuré 4 869 · 0 des DEUX côtés d'un vrai défaut. Un test rouge peut l'être
// pour une raison stupide (banc mort, seuil inatteignable). On le vérifie donc
// en MUTANT LE PRODUIT, et en regardant les couleurs changer.
//
// Mutation appliquée puis RETIRÉE (`src/globe.js` est revenu au bit près,
// `git diff -- src/` vide) — trois lignes, toutes sur le plafond de finesse :
//   · `MAX_Z = 15` → `16`
//   · `_zoomCropEcran` : `Math.min(z + MARGE_CROP, ZOOM_SOCLE)` → `…, 16)`
//   · `_zoomCropEcran` : `while (z < ZOOM_SOCLE)` → `while (z < 16)`
//
//   | test | dépôt | mutation partielle (2 lignes) | mutation complète |
//   |---|---|---|---|
//   | ⓪ garde banc vivant | ✔ | **✖** (z14 partout) | ✔ |
//   | ① finesse ~ altitude | ✖ z13 partout | ✖ **z14** partout | **✔** |
//   | ② px par texel | ✖ 10,99 à 900 m | ✖ **5,49** | **✔** |
//   | ③ garde une seule finesse | ✔ | ✔ | ⛔ **✖ — `[11, 16]` à 5 000 m** |
//   | ④ net sans rétrécir | ✖ | ✖ | **✔** |
//   | ⑤ garde coût | ✔ | ✔ | ✔ |
//
// ⚡ **ET C'EST LE RÉSULTAT LE PLUS UTILE DE CE FICHIER.** Le correctif
// « évident » — lever le plafond de finesse — rend ①, ② et ④ verts, tient
// l'emprise et tient le coût… **et casse ③, l'exigence non négociable
// d'Adrien** : deux résolutions dans le même cadre. Le barème n'est pas une
// formalité ; il attrape exactement le correctif qu'on écrirait d'instinct.

// ══════════ LES SEUILS DU BARÈME, ET D'OÙ ILS VIENNENT ══════════════════════

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ⚡ **UN NIVEAU DE MANQUE, PAS ZÉRO.** Exiger `pxParTexel ≤ 1` serait exiger le
// texel-pour-pixel exact, que même une source parfaite ne tient pas en vue
// oblique. `2,0` = un niveau de détail manquant au plus, c'est-à-dire le seuil
// au-delà duquel un deuxième niveau de zoom se justifierait.
const PX_PAR_TEXEL_MAX = 2.0
// ⛔ **ET L'ASSERTION PORTE SUR LE NIVEAU SERVI, PAS SUR LE TEXEL DU BANC — un
// premier jet a été jeté pour ça.** Première écriture : « au banc, un texel ne
// couvre pas plus de 4 pixels » (le double du seuil, puisque les tuiles AWS font
// 256 px et celles de la production 512). Le test était **inatteignable même
// par un correctif parfait** : avec des tuiles de 256 px et `MAX_Z = 15`, le
// meilleur rapport possible à 900 m vaut 5,49. Un test qui ne peut pas passer ne
// décrit rien. On assertе donc le **NIVEAU** — `z servi ≥ z requis` — et `z
// requis` se dérive du seuil ci-dessus AVEC LA TUILE DE PRODUCTION (512 px),
// bornée par ce que la source sait faire. C'est la même exigence, exprimée dans
// une grandeur que le banc et la production partagent.
const TUILE_PX_PRODUCTION = 512
// `getDemMaxZoom` à Majorque, LU DANS L'APPLICATION par `scripts/sonde-cn1.mjs`
// (`dem.maxZoom` = 16 à Majorque et en Beauce, 17 aux Alpes et en Bretagne).
// ⚠️ La netteté est bornée par la donnée : au-delà, ce n'est plus un défaut.
const PLAFOND_SOURCE_MAJORQUE = 16
// L'emprise du bloc ne rétrécit pas : plancher en mètres, mesuré dans
// l'application à `DEFAULT_FINE_ZOOM = 15` (2 437 m en Bretagne, le plus petit
// des quatre lieux). Un correctif qui gagne en netteté en montant `demZoom`
// tomberait dessous — c'est le piège écrit dans `main.js:3758`.
const EMPRISE_MIN_M = 2400
const CIRCONFERENCE_M = 40075016.686
const HAUTEUR_PX = 720
const FOV = 30

// ---------------------------------------------------------------- bouchons DOM
const [ER, EG, EB] = encodeTerrarium(812)
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  DALLE[i * 4] = ER
  DALLE[i * 4 + 1] = EG
  DALLE[i * 4 + 2] = EB
  DALLE[i * 4 + 3] = 255
}
class FakeCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData() { return { data: DALLE } }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FakeCtx())
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob
globalThis.fetch = async () => {
  await new Promise((r) => setTimeout(r, 0))
  return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, size: 90000 }) }
}

const { Globe, _resetTileMemo, MAX_Z } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('../src/geo.js')
const { _resetDemSource, DEM_SOURCES } = await import('../src/dem-source.js')
const { ZOOM_SOCLE } = await import('../src/monde/seuil-socle.js')
const { tuileDansCrop } = await import('../src/monde/crop-sphere.js')

// Majorque — le lieu des captures d'Adrien, et celui des trois campagnes
// précédentes (CULL, PLF, CN1).
const LAT = 39.62
const LON = 2.98
// (la taille de tuile du banc, AWS 256 px, ne sert plus à aucune assertion — voir l’encart des seuils)

function camera(lat, lon, altM) {
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(lat, lon, R_GLOBE + orbAlt, cam.position)
  cam.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  cam.up.set(0, 1, 0)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

function neuf() {
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id)
  const g = new Globe({ globeContinu: true })
  g.setVisible(true)
  return g
}

// `demZoom` = la largeur du crop, en niveaux : `demi = 3 / 2 / 2^zoom`, la règle
// d'`assietteCrop` (`main.js`) et de `repereCrop`.
function poser(g, demZoom) {
  return g.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: demZoom, tuilesParBloc: 3 })
}

async function tourner(g, cam, images = 60) {
  for (let i = 0; i < images; i++) {
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
  }
}

/** Le niveau le plus fin MAILLÉ dans l'emprise du crop. */
const zDansCrop = (g) => {
  let z = 0
  for (const t of g.tiles.values()) if (t.mesh && t.z > z && g._crop && tuileDansCrop(t.z, t.x, t.y, g._crop)) z = t.z
  return z
}
/** Le niveau le plus fin MAILLÉ HORS de l'emprise — le témoin de vivacité. */
const zHorsCrop = (g) => {
  let z = 0
  for (const t of g.tiles.values()) if (t.mesh && t.z > z && g._crop && !tuileDansCrop(t.z, t.x, t.y, g._crop)) z = t.z
  return z
}
/** Les niveaux DESSINÉS dans l'emprise, triés — l'invariant de l'affiche. */
const niveauxDansCrop = (g) => {
  const s = new Set()
  for (const t of g.tiles.values()) if (t.mesh?.visible && g._crop && tuileDansCrop(t.z, t.x, t.y, g._crop)) s.add(t.z)
  return [...s].sort((a, b) => a - b)
}
/** La largeur au sol de l'emprise du crop, en mètres. */
const empriseM = (g) => (g._crop ? g._crop.demi * 2 * CIRCONFERENCE_M * Math.cos((LAT * Math.PI) / 180) : 0)
/** Mètres de sol par texel, au niveau `z`, avec la tuile de PRODUCTION (512 px). */
const mParTexel = (z) => (CIRCONFERENCE_M * Math.cos((LAT * Math.PI) / 180)) / (2 ** z * TUILE_PX_PRODUCTION)
/** Mètres de sol par pixel d'écran, caméra au nadir à `altM`. */
const mParPixel = (altM) => (2 * altM * Math.tan(((FOV * Math.PI) / 180) / 2)) / HAUTEUR_PX
/**
 * Le niveau qu'il FAUT servir à cette altitude pour tenir le barème — borné par
 * ce que la source de la région sait faire.
 *
 * ⚠️ **DÉRIVÉ, PAS POSÉ.** `mParTexel(z) ≤ PX_PAR_TEXEL_MAX × mParPixel(alt)`
 * s'inverse en un logarithme ; on prend l'entier au-dessus. Écrire une table de
 * niveaux à la main, c'est la deuxième écriture d'une loi qui finit par diverger.
 */
const zRequis = (altM, plafondSource = PLAFOND_SOURCE_MAJORQUE) => {
  const cible = PX_PAR_TEXEL_MAX * mParPixel(altM)
  const z = Math.ceil(Math.log2((CIRCONFERENCE_M * Math.cos((LAT * Math.PI) / 180)) / (TUILE_PX_PRODUCTION * cible)))
  return Math.min(z, plafondSource)
}

// ═════ ⓪ GARDE — LE BANC N'EST PAS INERTE ══════════════════════════════════
//
// ⛔ **SANS CE TEST, TOUS LES AUTRES POURRAIENT ÊTRE VIDES.** §3 de la
// compétence : « un test de silhouette passe à vide si l'objet est hors cadre —
// prouver d'abord qu'on regarde quelque chose ». Ici la preuve est de mesurer
// la MÊME grandeur, dans les MÊMES images, à un endroit où elle DOIT bouger :
// hors de l'emprise du crop, `_traverse` décide par `chord / dist` et le niveau
// maillé monte quand la caméra descend. S'il ne monte pas là non plus, le banc
// est mort et les tests ① et ④ ne prouvent rien.
test('⓪ garde — hors de l’emprise, le niveau maillé MONTE quand la caméra descend', async () => {
  const haut = neuf(); poser(haut, 15); await tourner(haut, camera(LAT, LON, 20_000))
  const bas = neuf(); poser(bas, 15); await tourner(bas, camera(LAT, LON, 900))
  const zh = zHorsCrop(haut)
  const zb = zHorsCrop(bas)
  assert.ok(zh > 0 && zb > 0, `aucune tuile maillée hors emprise (${zh} / ${zb}) — le banc ne regarde rien`)
  assert.ok(zb > zh, `hors emprise le niveau ne bouge pas non plus (z${zh} à 20 km, z${zb} à 900 m) — le banc est inerte, les tests suivants ne prouvent RIEN`)
})

// ═════ ① LA FINESSE SERVIE DOIT SUIVRE L'ALTITUDE ══════════════════════════
//
// ⛔ **ROUGE AUJOURD'HUI.** Mesuré dans l'application sur quatre lieux : le
// niveau servi au centre du crop vaut **13 à 20 000 m comme à 600 m**, et le
// texel servi ne bouge pas d'un bit sur toute la plage. C'est la phrase
// d'Adrien, en une assertion : *« l'image ne gagne pas en détail, elle
// grossit »*.
//
// ⚠️ **UN BALAYAGE, PAS DEUX POINTS** — §2 : deux extrêmes identiques suffisent
// à révéler un plafond fantôme, mais une seule paire pourrait tomber sur une
// phase. On relève quatre altitudes, et on exige la CROISSANCE.
test('① la finesse servie dans le crop monte quand la caméra descend', async () => {
  const releve = []
  for (const altM of [20_000, 5_000, 2_000, 900]) {
    const g = neuf(); poser(g, 15); await tourner(g, camera(LAT, LON, altM))
    releve.push([altM, zDansCrop(g)])
  }
  assert.ok(releve.every(([, z]) => z > 0), `aucune tuile maillée dans l’emprise : ${JSON.stringify(releve)}`)
  const zHaut = releve[0][1]
  const zBas = releve[releve.length - 1][1]
  assert.ok(
    zBas > zHaut,
    `la finesse servie est FIGÉE : z${zHaut} à 20 000 m et z${zBas} à 900 m — ${JSON.stringify(releve)}`
  )
})

// ═════ ② UN TEXEL NE COUVRE PAS PLUS DE N PIXELS ═══════════════════════════
//
// ⛔ **ROUGE AUJOURD'HUI, ET C'EST LE CHIFFRE D'ADRIEN.** Le rapport
// `mètres par texel servi / mètres par pixel d'écran` est le nombre de pixels
// qu'un texel couvre. Au-delà de 2 (4 au banc), il manque au moins un niveau de
// détail, et l'image grossit au lieu de s'affiner.
test('② à l’altitude de travail, un texel servi ne couvre pas plus de 2 pixels', async () => {
  const echecs = []
  for (const altM of [2_000, 900, 600]) {
    const g = neuf(); poser(g, 15); await tourner(g, camera(LAT, LON, altM))
    const z = zDansCrop(g)
    assert.ok(z > 0, `aucune tuile maillée dans l’emprise à ${altM} m`)
    const attendu = zRequis(altM)
    if (z < attendu) {
      const ratio = mParTexel(z) / mParPixel(altM)
      echecs.push(`${altM} m : servi z${z}, requis z${attendu} — ${mParTexel(z).toFixed(2)} m/texel pour ${mParPixel(altM).toFixed(3)} m/px = ${ratio.toFixed(2)} px/texel (${Math.log2(ratio).toFixed(2)} niveaux de manque)`)
    }
  }
  assert.deepEqual(echecs, [], `le texel servi est trop gros :\n  ${echecs.join('\n  ')}`)
})

// ═════ ③ GARDE — UNE SEULE FINESSE PAR IMAGE ═══════════════════════════════
//
// ⛔ **L'EXIGENCE NON NÉGOCIABLE D'ADRIEN, ET ELLE EST TENUE AUJOURD'HUI.** Le
// crop est une affiche imprimable : deux résolutions visibles dans le même cadre
// sont un échec, même si elles sont plus nettes. Mesuré dans l'application :
// l'histogramme des niveaux DESSINÉS dans l'emprise vaut `{13: n}` — un seul
// niveau — à toutes les altitudes et sur les quatre lieux.
//
// ⚠️ **CE TEST EST VERT ET DOIT LE RESTER.** C'est lui qui interdit au
// correcteur de gagner en netteté en laissant le quadtree refendre par distance
// dans l'emprise.
test('③ garde — une seule finesse dessinée dans l’emprise, à chaque altitude', async () => {
  for (const altM of [20_000, 5_000, 2_000, 900, 600]) {
    const g = neuf(); poser(g, 15); await tourner(g, camera(LAT, LON, altM))
    const n = niveauxDansCrop(g)
    assert.ok(n.length > 0, `rien de dessiné dans l’emprise à ${altM} m — le test se mentirait`)
    assert.equal(n.length, 1, `${n.length} finesses dans le même cadre à ${altM} m : ${JSON.stringify(n)}`)
  }
})

// ═════ ④ LA NETTETÉ NE SE PAIE PAS EN EMPRISE ══════════════════════════════
//
// ⛔ **ROUGE AUJOURD'HUI, ET C'EST LE PIÈGE À CORRECTEUR.** `main.js:3758` le
// dit en toutes lettres : monter le zoom réduit le bloc (4,6 km à z15, 2,3 km à
// z16, 1,1 km à z17). **Et c'est MESURÉ** : passer le bloc de z13 à z15 divise
// l'emprise par 4,00 (10 209 m → 2 552 m aux Alpes) et change la résolution
// servie dans le crop de **0,03 %** (6,649 → 6,647 m par texel). Rapetisser
// l'affiche d'Adrien n'achète donc AUCUNE netteté.
//
// Les deux moitiés sont dans la même assertion **exprès** : un correctif qui
// atteindrait le seuil de netteté en rétrécissant le bloc ferait passer ② et
// tomberait ici.
test('④ le crop est net SANS que son emprise rétrécisse', async () => {
  const ALT = 900
  const g = neuf(); poser(g, 15); await tourner(g, camera(LAT, LON, ALT))
  const large = empriseM(g)
  const z = zDansCrop(g)
  assert.ok(z > 0, 'aucune tuile maillée dans l’emprise')
  assert.ok(
    large >= EMPRISE_MIN_M,
    `l’emprise a rétréci : ${Math.round(large)} m, plancher ${EMPRISE_MIN_M} m`
  )
  const ratio = mParTexel(z) / mParPixel(ALT)
  assert.ok(
    z >= zRequis(ALT),
    `à ${ALT} m, emprise ${Math.round(large)} m (bonne) mais z${z} servi pour z${zRequis(ALT)} requis, soit ${ratio.toFixed(2)} px par texel — l’affiche est à la bonne taille et floue`
  )
})

// ═════ ⑤ GARDE — LE COÛT RESTE TENABLE ════════════════════════════════════
//
// ⚡ **LE RAPPEL MESURÉ DE CE CHANTIER** : « les objets hors champ ne coûtent
// pas des appels de dessin, ils consomment les places du cache » ; et le cache
// sature à `CACHE_MAX_CONTINU = 1 700`. Mesuré au repos dans l'application
// (`scripts/sonde-cn1.mjs`, CPU ×4, quatre lieux, toutes altitudes) : le cache
// tient **246 à 273 tuiles**, `_credit` **1 524 à 1 543**, la file **0**. Il y a
// donc 1 400 places de marge — mais CULL a mesuré la pathologie à 1 470 / 1 700,
// et desserrer un budget avant d'avoir réduit ce qui entre donne ×14 sur les
// requêtes. Le plafond du barème est posé à **900** : trois fois l'état
// d'aujourd'hui, la moitié du plafond dur.
const CACHE_MAX_BAREME = 900
test('⑤ garde — le cache reste sous le plafond du barème pendant l’affinage', async () => {
  for (const altM of [5_000, 900]) {
    const g = neuf(); poser(g, 15); await tourner(g, camera(LAT, LON, altM), 80)
    assert.ok(g.tiles.size > 0, `cache vide à ${altM} m — le test se mentirait`)
    assert.ok(
      g.tiles.size <= CACHE_MAX_BAREME,
      `cache à ${g.tiles.size} tuiles à ${altM} m (barème ${CACHE_MAX_BAREME}, plafond dur ${g.cacheMax})`
    )
  }
})
// ⛔ **LA FILE N'EST PAS ASSERTÉE ICI, ET C'EST UN CONSTAT PAYÉ.** Première
// écriture de ce test : `g.queue.length <= 64`. Il rendait **120 à 5 000 m** —
// et ce n'était pas le défaut. Le banc résout ses dalles en une microtâche mais
// respecte `MAX_CONCURRENT` : 80 images ne suffisent pas à vider une file que
// l'application, elle, vide en quelques secondes de réseau réel (mesuré : file
// **0** au repos, aux quatre lieux et à toutes les altitudes). Asserter la file
// au banc, c'est mesurer la vitesse de la boucle du test. Le budget de file
// (**≤ 64**, plafond dur `PLAFOND_FILE = 256`) reste au barème, où il se mesure
// dans l'application.

// ⚠️ **CE QUE CE FICHIER NE COUVRE PAS, ET IL FAUT LE DIRE.**
//   · Le PLAFOND DE LA SOURCE. `MAX_Z = ${MAX_Z}` borne le quadtree, et
//     `getDemMaxZoom` borne la région : Mapterhorn sert du z17 en Suisse, du z16
//     en France, z15 ailleurs. Mesuré par la sonde : `dem.maxZoom` rend **17**
//     aux Alpes et en Bretagne, **16** en Beauce et à Majorque. Quand le niveau
//     servi atteint ce plafond, ② devient inatteignable et ce n'est PAS un
//     défaut — c'est la donnée qui s'arrête. Aucun test ici ne sait distinguer
//     les deux : c'est au correcteur de le rendre lisible à l'écran.
//   · Le TEMPS jusqu'à la netteté et le CLIGNOTEMENT pendant l'affinage. Le banc
//     rend ses dalles en une microtâche : il ne peut pas mesurer une latence
//     réseau. Ces deux-là sont au barème (`rapport-CN1.md`, §2), pas ici.
//   · Le RELIEF. Le banc est au nadir sur une dalle plate ; l'application rend
//     un facteur 4 sur le mètre par pixel entre la plaine et les Alpes à
//     altitude égale. Les seuils d'ici décrivent le cas FAVORABLE.
