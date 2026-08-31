// LE FOND DU CROP — Tâche J bis.
//
// Ce que ces tests verrouillent, et pourquoi ils existent : la Tâche J a montré
// PAR ÉLIMINATION que « le champ de la mer a un fond, la surface du crop n'en a
// pas ». Les chiffres du désaccord sont relevés dans l'application vivante et
// déposés sur le disque (`.banc/vues-Jbis/Jbis-releves-bruts.json`) ; ce fichier-ci
// verrouille la LOI qui le ferme, et surtout **son défaut** : sans fond posé,
// la surface est celle du dépôt au bit près.
//
// ⚠️ **DEUX LOIS, ET C'EST VOULU** — voir l'en-tête de `src/monde/fond-crop.js` :
// `_buildMesh` écrête à zéro et `hauteurSurface` ne l'a JAMAIS fait. Une loi
// unique aurait changé un des deux côtés sans fond posé.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import {
  altitudeMaillage,
  altitudeSonde,
  uvFond,
  echantillonnerFond,
  cleFond,
} from '../src/monde/fond-crop.js'
import { repereCrop, localCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
import { construireSolideCrop } from '../src/monde/parois-crop.js'
import { Globe } from '../src/globe.js'
import { R_GLOBE, EARTH_RADIUS_M, latLonToTile, tileToLatLon, latLonToSphere } from '../src/geo.js'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const SOURCE_GLOBE = fs.readFileSync(path.join(ICI, '..', 'src', 'globe.js'), 'utf8')
// Le nuanceur de FRAGMENT du globe, extrait de la source — meme procede que
// test/crop-habillage.test.js : on lit ce que le GPU recevra, pas une copie.
const FRAG_GLOBE = (() => {
  const i = SOURCE_GLOBE.indexOf('const FRAG = /* glsl */ `')
  return SOURCE_GLOBE.slice(i, SOURCE_GLOBE.indexOf('\n`\n', i))
})()

// ══════════ ① LES DEUX LOIS, ET LEUR DÉFAUT ═════════════════════════════════

test('① sans fond, `altitudeMaillage` EST `Math.max(h, 0)` — le dépôt au bit près', () => {
  for (const h of [-4297, -288.36328125, -0.7, 0, 1e-7, 12.5, 2975.25, 8848]) {
    assert.ok(Object.is(altitudeMaillage(h, null), Math.max(h, 0)),
      `${h} : la surface sans fond doit rester celle d'« oceans stay on the sphere »`)
    assert.ok(Object.is(altitudeMaillage(h, undefined), Math.max(h, 0)))
    assert.ok(Object.is(altitudeMaillage(h, NaN), Math.max(h, 0)),
      'un champ non fini est une ABSENCE de mesure, pas un zéro')
  }
})

test('① bis sans fond, `altitudeSonde` rend la valeur BRUTE — négatifs compris', () => {
  for (const h of [-288.36328125, -0.7, 0, 12.5, 2975.25]) {
    assert.ok(Object.is(altitudeSonde(h, null), h),
      'les parois suivent aujourd’hui la frange négative du terrarium ; on ne la leur retire pas')
  }
})

test('① ter `null` traverse `altitudeSonde` — le §7 de `parois-crop.js`', () => {
  assert.equal(altitudeSonde(null, -1200), null, 'un fond posé ne rend pas la couverture meilleure')
  assert.equal(altitudeSonde(undefined, -1200), null)
})

test('② avec fond, la MER prend le fond et la TERRE garde la tuile', () => {
  // la terre : le champ est six fois plus grossier que la tuile, il ne doit pas
  // la remplacer au-dessus de zéro
  assert.equal(altitudeMaillage(1234.5, -900), 1234.5)
  assert.equal(altitudeSonde(1234.5, -900), 1234.5)
  // la mer : la tuile dit zéro (51,1 % de ses échantillons le disent), le champ
  // dit −920,7 m — c'est le champ qui gagne
  assert.equal(altitudeMaillage(0, -920.7), -920.7)
  assert.equal(altitudeSonde(0, -920.7), -920.7)
  // la frange du terrarium n'échappe pas non plus au champ : UNE autorité
  assert.equal(altitudeMaillage(-288.36328125, -1500), -1500)
})

test('② bis un champ qui dit « terre » là où la tuile dit « mer » ne fait pas sortir de butte', () => {
  assert.equal(altitudeMaillage(0, 37.5), 0, 'min(hFond, 0) : on reste au niveau de la mer')
  assert.equal(altitudeSonde(-2, 37.5), 0)
})

test('② ter LA BORNE `h > 0` D’`altitudeMaillage` — un vrai champ de fond, entre 0 et ~100 m', () => {
  // ⚠️ **TROU DE COUVERTURE TROUVÉ PAR LA RELECTURE J bis (constat groupé ⑦).**
  // Test ① ne combine `h` proche de zéro qu'à un fond ABSENT (`null`) — la
  // branche `h > 0` n'y joue aucun rôle, `Math.max(h, 0)` la rend de toute
  // façon. Test ② ne combine un fond FINI qu'à `h = 1234,5`, très loin de la
  // frontière. Résultat : élargir `h > 0` en `h > 100` dans
  // `src/monde/fond-crop.js` survivait à tous les tests d'alors — un défaut de
  // COUVERTURE, pas un défaut livré : le code de production est juste.
  for (const h of [0.0007, 12.5, 99.999]) {
    assert.equal(
      altitudeMaillage(h, -900), h,
      `h=${h} avec un fond posé à −900 : la TERRE doit garder la tuile, pas basculer sur le fond`,
    )
    assert.equal(altitudeSonde(h, -900), h, `altitudeSonde : même contrat pour h=${h}`)
  }
})

// ══════════ ③ LA LECTURE DU CHAMP ═══════════════════════════════════════════

test('③ `uvFond` EST la formule du nuanceur de la mer, mot pour mot', () => {
  // la ligne du dépôt : `vec2 uvF = aCrop / (2.0 * uMerPortee) + 0.5;`
  assert.match(SOURCE_GLOBE, /uvF\s*=\s*aCrop\s*\/\s*\(2\.0\s*\*\s*uMerPortee\)\s*\+\s*0\.5/,
    'si cette ligne change, `uvFond` doit changer avec elle — sinon les deux fonds divergent')
  for (const portee of [1, 3, 7.25]) {
    for (const q of [{ u: 0, v: 0 }, { u: portee, v: -portee }, { u: -portee, v: portee }]) {
      const r = uvFond(q, portee)
      assert.equal(r.u, q.u / (2 * portee) + 0.5)
      assert.equal(r.v, q.v / (2 * portee) + 0.5)
    }
  }
  assert.deepEqual(uvFond({ u: 0, v: 0 }, 3), { u: 0.5, v: 0.5 }, 'le centre du crop est le centre du champ')
  assert.deepEqual(uvFond({ u: -3, v: -3 }, 3), { u: 0, v: 0 }, 'le coin nord-ouest est l’origine du tableau')
})

test('③ bis le nuanceur du GLOBE lit le fond avec EXACTEMENT la même formule', () => {
  assert.match(SOURCE_GLOBE, /qCrop\s*\/\s*\(2\.0\s*\*\s*uFondPortee\)\s*\+\s*0\.5/,
    'la transcription GPU du fond doit être celle de `uvFond`')
})

// un champ jouet : une pente en u, pour que la bilinéaire se lise
function fondJouet({ portee = 3, cote = 5, valeurs = null } = {}) {
  const repere = repereCrop({ centre: { lat: -21.25, lon: 55.7666015625 }, zoom: 12 })
  const v = valeurs ?? new Float32Array(cote * cote)
  if (!valeurs) {
    for (let j = 0; j < cote; j++) for (let i = 0; i < cote; i++) v[j * cote + i] = -100 * i - 1000 * j
  }
  return { valeurs: v, cote, repere, portee, bathy: true, profMaxM: 4000 }
}

test('③ ter `echantillonnerFond` interpole — elle ne s’accroche pas au nœud', () => {
  const f = fondJouet()
  const centre = latLonDeLocal(0, 0, f.repere)
  // le centre du crop tombe pile au centre du champ (nœud 2,2 d'une grille 5×5)
  assert.equal(echantillonnerFond(f, centre.lat, centre.lon), -100 * 2 - 1000 * 2)
  // un demi-pas plus à l'est : la moitié du chemin vers le nœud suivant
  const demiPas = latLonDeLocal(f.portee / (f.cote - 1), 0, f.repere)
  const attendu = -100 * 2.5 - 1000 * 2
  assert.ok(Math.abs(echantillonnerFond(f, demiPas.lat, demiPas.lon) - attendu) < 1e-6,
    'un fond marin en marches est le défaut que la Tâche B a déjà mesuré sur les parois')
})

test('③ ter bis le champ n’est pas lu TRANSPOSÉ — et il faut sortir de la diagonale pour le voir', () => {
  // ⚠️ **CE TEST EXISTE PARCE QU'UNE MUTATION A SURVÉCU.** La campagne a
  // transposé la lecture (`valeurs[i0 * c + j0]` au lieu de `valeurs[j0 * c + i0]`)
  // et AUCUN test n'a rougî : tous mes points de sonde tombaient sur la DIAGONALE
  // du champ, où une transposition ne change rien par construction. C'est
  // exactement le piège du §0 (« une mutation change le COMPORTEMENT, pas la
  // chaîne ») retourné contre moi : la mutation changeait bien le comportement,
  // c'est ma SONDE qui était aveugle.
  //
  // Un fond marin lu transposé, c'est le relief sous-marin en miroir diagonal.
  const f = fondJouet()
  // ⚠️ **UN PAS DE CHAMP FAIT `2 × portee / (cote − 1)`, PAS `portee / (cote − 1)`** :
  // le champ s'étend sur `[−portee, +portee]`, donc sur DEUX portées.
  const pas = (2 * f.portee) / (f.cote - 1)
  // DEUX pas à l'est, UN pas au sud : hors diagonale, donc la transposition mord
  const p = latLonDeLocal(2 * pas, 1 * pas, f.repere)
  const attendu = -100 * (2 + 2) - 1000 * (2 + 1) // nœud (i = 4, j = 3)
  const lu = echantillonnerFond(f, p.lat, p.lon)
  assert.ok(Math.abs(lu - attendu) < 1e-6, `lu ${lu}, attendu ${attendu}`)
  // et le témoin : la valeur TRANSPOSÉE est un autre nombre, donc la sonde mord
  const transposee = -100 * (2 + 1) - 1000 * (2 + 2)
  assert.notEqual(attendu, transposee, 'la sonde doit être HORS de la diagonale, sinon elle ne prouve rien')
})

test('③ quater HORS du champ, `echantillonnerFond` rend `null` — jamais le bord prolongé', () => {
  const f = fondJouet()
  const dehors = latLonDeLocal(f.portee * 1.001, 0, f.repere)
  assert.equal(echantillonnerFond(f, dehors.lat, dehors.lon), null)
  const dedans = latLonDeLocal(f.portee * 0.999, 0, f.repere)
  assert.ok(Number.isFinite(echantillonnerFond(f, dedans.lat, dedans.lon)))
  assert.equal(echantillonnerFond(null, 0, 0), null)
})

test('③ quinquies la clé du fond change quand la BATHYMÉTRIE arrive', () => {
  const a = fondJouet()
  const b = { ...fondJouet(), bathy: false, profMaxM: 12 }
  assert.notEqual(cleFond(a), cleFond(b),
    'la nappe est asynchrone : une clé sur la seule emprise laisserait la surface plate pour toujours')
  assert.equal(cleFond(a), cleFond(fondJouet()))
})

// ══════════ ④ LA SURFACE DESSINÉE — LA VRAIE MÉTHODE ════════════════════════

const EXAGERATION = 2.8 // la valeur relevée dans l'application vivante
const HAUTEURS_MER = new Float32Array(256 * 256) // zéro partout : la mer du terrarium

function tuileDeTest(z, lat, lon, heights) {
  const brut = latLonToTile(lat, lon, z)
  const x = Math.floor(brut.x)
  const y = Math.floor(brut.y)
  const nw = tileToLatLon(x, y, z)
  const se = tileToLatLon(x + 1, y + 1, z)
  return {
    key: `${z}/${x}/${y}`, z, x, y, state: 'ready', heights, size: 256,
    texture: null, mesh: null, lastUsed: 0,
    center: latLonToSphere((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2),
    chord: latLonToSphere(nw.lat, nw.lon).distanceTo(latLonToSphere(se.lat, se.lon)),
  }
}

function construis(t, fond) {
  const faux = {
    exaggeration: EXAGERATION,
    group: new THREE.Group(),
    _materialFor: () => new THREE.MeshBasicMaterial(),
    _fondCrop: fond ?? null,
    // les vraies méthodes de jupe (Tâche P7) : sans parois, plancher nul
    _parois: null,
    _crop: null,
    _baseYCrop: null,
    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
  }
  Globe.prototype._buildMesh.call(faux, t)
  return t.mesh
}

// le rayon MONDIAL d'un sommet : `_buildMesh` écrit du relatif, la position
// mondiale vit dans `mesh.position` (RTC — `test/globe-precision.test.js`)
function rayonDuSommet(mesh, s) {
  const p = mesh.geometry.attributes.position
  return new THREE.Vector3(p.getX(s), p.getY(s), p.getZ(s)).add(mesh.position).length()
}

test('④ SANS fond, la mer reste sur la sphère — le dépôt au bit près', () => {
  const t = tuileDeTest(12, -21.25, 55.9, HAUTEURS_MER)
  const mesh = construis(t, null)
  for (const s of [0, 12, 300, 624]) {
    assert.ok(Math.abs(rayonDuSommet(mesh, s) - R_GLOBE) < 1e-4,
      'sans fond posé, `posAt` doit rendre exactement `R_GLOBE`')
  }
})

test('④ bis AVEC un fond, la surface DESCEND — c’est le désaccord que la Tâche J a mesuré', () => {
  const PROFONDEUR_M = -1500
  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
  const cote = 5
  const fond = {
    valeurs: new Float32Array(cote * cote).fill(PROFONDEUR_M),
    cote, repere, portee: 3, bathy: true, profMaxM: 1500,
  }
  // une tuile au CENTRE du crop, donc entièrement dans le champ
  const t = tuileDeTest(12, -21.248422235627014, 55.7666015625, HAUTEURS_MER)
  const mesh = construis(t, fond)
  const echelle = (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION
  const attendu = R_GLOBE + PROFONDEUR_M * echelle
  const r = rayonDuSommet(mesh, 312) // un sommet du milieu de la nappe
  assert.ok(Math.abs(r - attendu) < 1e-4,
    `la surface doit descendre à ${attendu}, elle est à ${r}`)
  assert.ok(r < R_GLOBE - 1e-3, 'un fond marin au-dessus de la sphère n’est pas un fond marin')
})

test('④ ter la TERRE ne bouge pas d’un bit quand un fond est posé', () => {
  const hautes = new Float32Array(256 * 256).fill(1200)
  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
  const cote = 5
  const fond = {
    valeurs: new Float32Array(cote * cote).fill(-1500),
    cote, repere, portee: 3, bathy: true, profMaxM: 1500,
  }
  const sans = construis(tuileDeTest(12, -21.248422235627014, 55.7666015625, hautes), null)
  const avec = construis(tuileDeTest(12, -21.248422235627014, 55.7666015625, hautes), fond)
  const a = sans.geometry.attributes.position.array
  const b = avec.geometry.attributes.position.array
  assert.equal(a.length, b.length)
  for (let k = 0; k < a.length; k++) {
    assert.ok(Object.is(a[k], b[k]), `sommet ${k} : la terre garde la finesse de la tuile`)
  }
})

// ══════════ ⑤ LA SONDE — parois, rampe, champ de repli ══════════════════════

test('⑤ `hauteurSurface` rend le FOND en mer quand il est posé', () => {
  const t = tuileDeTest(12, -21.248422235627014, 55.7666015625, HAUTEURS_MER)
  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
  const cote = 5
  const fond = {
    valeurs: new Float32Array(cote * cote).fill(-1500),
    cote, repere, portee: 3, bathy: true, profMaxM: 1500,
  }
  const nu = { tuilesAvecHauteurs: () => [t], _fondCrop: null, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine }
  const garni = { tuilesAvecHauteurs: () => [t], _fondCrop: fond, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine }
  const lat = -21.248422235627014
  const lon = 55.7666015625
  assert.equal(Globe.prototype.hauteurSurface.call(nu, lat, lon), 0,
    'sans fond, la sonde lit la tuile — zéro, et c’est le défaut mesuré')
  assert.ok(Math.abs(Globe.prototype.hauteurSurface.call(garni, lat, lon) + 1500) < 1e-6,
    'avec le fond, les parois et la rampe voient la même surface que le maillage')
})

test('⑤ bis hors couverture, la sonde rend TOUJOURS `null`, fond ou pas', () => {
  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
  const fond = {
    valeurs: new Float32Array(25).fill(-1500),
    cote: 5, repere, portee: 3, bathy: true, profMaxM: 1500,
  }
  const garni = { tuilesAvecHauteurs: () => [], _fondCrop: fond, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine }
  assert.equal(Globe.prototype.hauteurSurface.call(garni, -21.25, 55.77), null,
    'un fond posé ne remplace pas une tuile absente : `null`, jamais zéro')
  // ⚡ **ET LA SECONDE SONDE A LE MÊME CONTRAT — Tâche P11.** `hauteurDessinee`
  // sert la PAROI ; si elle rendait zéro là où la tuile manque, le refus de
  // couverture du §7 de `parois-crop.js` cesserait de mordre et le bloc
  // reprendrait ses encoches au niveau de la mer.
  assert.equal(Globe.prototype.hauteurDessinee.call(garni, -21.25, 55.77), null,
    'la sonde du maillage doit rendre `null` elle aussi')
})

// ══════════ ⑥ LE REPÈRE DU CHAMP EST CELUI DE LA CALOTTE ════════════════════

test('⑥ la grille du champ est régulière en MERCATOR, comme `remplirHauteurs`', () => {
  // `uvFond` suppose que le nœud (i, j) du champ tombe à la coordonnée locale
  // `-portee + 2·portee·i/(cote-1)`. C'est vrai si et seulement si la grille de
  // `remplirHauteurs` (régulière en mercator sur `boiteMerc(empriseCalotte)`)
  // coïncide avec le repère local du crop, qui est mercator lui aussi.
  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
  const portee = 3
  const cote = 385
  for (const i of [0, 1, 192, 383, 384]) {
    const uLocal = -portee + (2 * portee * i) / (cote - 1)
    const p = latLonDeLocal(uLocal, 0, repere)
    const q = localCrop(p.lat, p.lon, repere)
    assert.ok(Math.abs(q.u - uLocal) < 1e-9, 'aller-retour local → lat/lon → local')
    const uv = uvFond(q, portee)
    assert.ok(Math.abs(uv.u * (cote - 1) - i) < 1e-6, `le nœud ${i} doit se relire en ${i}`)
  }
})

// ══════════ ⑦ LES PAROIS SUIVENT LA SURFACE ═════════════════════════════════

test('⑦ `plancherMer` décide si la base du bloc voit le fond marin', () => {
  // ⚠️ **RELEVÉ À L'ÉCRAN AVANT CE CORRECTIF, ET C'EST CE QUI L'A FAIT ÉCRIRE** :
  // `baseY` valait **−0,054 132 359 8 unité** avec ET sans fond, au millionième
  // près, pour une surface descendue de **2 116,3 m**. Le §4 de `parois-crop.js`
  // posait `plancherMer = 0` parce que le globe écrêtait sa mer sur la sphère ;
  // depuis que le crop porte son fond, c'est ce zéro-là qui fait passer la paroi
  // AU-DESSUS de sa propre surface.
  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
  const commun = {
    repere,
    forme: { coin: 0, expo: 2 },
    hauteur: () => -1500,
    rayon: R_GLOBE,
    echelle: (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION,
    pas: 32,
  }
  const ecrete = construireSolideCrop({ ...commun, plancherMer: 0 })
  const libre = construireSolideCrop({ ...commun, plancherMer: -1500 })
  assert.equal(ecrete.refus, null)
  assert.equal(libre.refus, null)
  // ⚠️ **ON COMPARE L'ÉCART DES DEUX, PAS LEUR VALEUR ABSOLUE.** Le point le
  // plus bas d'un crop plat n'est pas à zéro mais à la FLÈCHE de son arc — la
  // sphère s'éloigne du plan tangent —, soit 4,6·10⁻⁴ unité ici, environ 29 m.
  // L'inclure dans l'oracle en ferait une constante recopiée ; l'écart, lui,
  // ne dépend que du plancher, et c'est ce que cette tâche change.
  const chute = 1500 * commun.echelle
  // ⚠️ **TOLÉRANCE RELATIVE, ET ELLE EST MOTIVÉE** : descendre la surface change
  // aussi, d'un cheveu, sa projection dans le repère local du crop (la flèche
  // se mesure sur un rayon plus court). L'écart résiduel vaut 3,6·10⁻⁵ unité,
  // soit **0,054 % de la chute** — la loi est la bonne, pas la géométrie plate.
  assert.ok(Math.abs((ecrete.baseY - libre.baseY) / chute - 1) < 1e-3,
    `l'écart vaut ${ecrete.baseY - libre.baseY}, attendu ${chute}`)
  // la profondeur est une FRACTION DE LA LARGEUR : elle ne suit pas le fond
  // (l'anneau se resserre d'un cheveu sur un rayon plus court — 0,03 %)
  assert.ok(Math.abs(ecrete.profondeur / libre.profondeur - 1) < 1e-3,
    `profondeurs ${ecrete.profondeur} et ${libre.profondeur}`)
  assert.ok(libre.baseY < ecrete.baseY - 1e-6, 'un fond marin doit faire descendre la base')
})

test('⑦ bis `plancherMer` vaut ZÉRO par défaut — le dépôt au bit près', () => {
  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
  const commun = {
    repere,
    forme: { coin: 0, expo: 2 },
    hauteur: () => -1500,
    rayon: R_GLOBE,
    echelle: (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION,
    pas: 32,
  }
  const defaut = construireSolideCrop({ ...commun })
  const zero = construireSolideCrop({ ...commun, plancherMer: 0 })
  assert.ok(Object.is(defaut.baseY, zero.baseY), 'sans argument, la paroi doit rester celle du dépôt')
})

test('⑦ ter le globe DÉRIVE son plancher du fond posé, il ne le recopie pas', () => {
  // assertion de SOURCE, déclarée comme telle : le comportement est mesuré dans
  // l'application (`.banc/vues-Jbis/Jbis-releves-bruts.json`), pas ici — `construireParoisCrop`
  // demande three, un globe monté et des tuiles.
  assert.match(SOURCE_GLOBE, /plancherMer:\s*this\._fondCrop\s*\?\s*-Math\.max\(this\._fondCrop\.profMaxM,\s*0\)\s*:\s*0/,
    'le plancher des parois doit suivre le fond, et valoir zéro sans lui')
})

test('⑦ quater un point INCONNU retombe au niveau de la mer, jamais au plancher', () => {
  // ⚠️ Sans ça, un fond posé enverrait un point non couvert au fond de la fosse
  // — et `couvertureMin` ne le rattrape que parce qu'il vaut 1 par défaut.
  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
  let n = 0
  const r = construireSolideCrop({
    repere,
    forme: { coin: 0, expo: 2 },
    hauteur: () => (++n % 7 === 0 ? null : -1500),
    rayon: R_GLOBE,
    echelle: (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION,
    pas: 32,
    plancherMer: -1500,
    couvertureMin: 0, // on TOLÈRE les trous, pour voir où ils tombent
  })
  assert.equal(r.refus, null)
  assert.ok(Number.isFinite(r.baseY), 'un repli au plancher aurait donné un baseY de la fosse')
  const y = []
  for (let k = 0; k < r.positions.length; k += 3) y.push(r.positions[k + 1])
  assert.ok(Math.max(...y) >= -1e-9, 'les points inconnus doivent se poser au niveau de la mer, c’est-à-dire à zéro')
})

// ══════════ ⑧ `poserFondCrop` — LA VRAIE MÉTHODE, EMPRUNTÉE ═════════════════
//
// ⚠️ **CES TESTS N'EXISTENT QUE PARCE QUE DOUZE MUTATIONS ONT SURVÉCU.** Le
// premier tour de campagne a tué 19 mutations sur 35 : tout ce qui vivait dans
// les MÉTHODES du globe passait à travers, parce qu'aucun test ne les appelait.
// `Globe.prototype.X.call(faux, …)` est le précédent de
// `test/globe-precision.test.js` — monter un `Globe` entier réclamerait le DOM.

function globeNu({ crop = null, fond = null, exageration = EXAGERATION } = {}) {
  const u = {
    uCropOn: { value: crop ? 1 : 0 },
    uFondChamp: { value: null },
    uFondOn: { value: 0 },
    uFondPortee: { value: 3 },
    uFondMetres: { value: 1 },
    // ⚠️ **LE BOUCHON DOIT PORTER CE QUE LE CONSTRUCTEUR PORTE — Tâche R17.**
    // `_poserTextureFond` écrit désormais la CELLULE du champ, en demi-côtés de
    // crop, pour que le gradient de la normale fine dérive à la maille et non
    // au sixième de maille. Un bouchon en retard sur le constructeur ne fait pas
    // rougir la loi : il fait rougir le bouchon.
    uFondPasQ: { value: 0 },
  }
  return {
    uniforms: u,
    exaggeration: exageration,
    _crop: crop,
    _fondCrop: fond,
    _cleFondPosee: '',
    tiles: new Map(),
    group: new THREE.Group(),
    gardeHauteurs: new Set(),
    _materialFor: () => new THREE.MeshBasicMaterial(),
    _parois: null,
    _baseYCrop: null,
    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
    _buildMesh(t) { return Globe.prototype._buildMesh.call(this, t) },
    _refaireMaillagesDuFond() { return Globe.prototype._refaireMaillagesDuFond.call(this) },
    _poserTextureFond(f) { return Globe.prototype._poserTextureFond.call(this, f) },
  }
}

const CENTRE_REUNION = { lat: -21.248422235627014, lon: 55.7666015625 }
const REPERE_REUNION = repereCrop({ centre: CENTRE_REUNION, zoom: 12 })

// un `remplir` de papier : il remplit `sortie` d'une profondeur constante et dit
// ce qu'on lui demande de dire
function remplirFactice({ profondeur = -1500, remplis = null, bathy = true } = {}) {
  return (emprise, n, sortie) => {
    sortie.fill(profondeur)
    return { remplis: remplis ?? sortie.length, manquants: 0, bathy, sortie }
  }
}

const pose = (g, arg) => Globe.prototype.poserFondCrop.call(g, arg)

test('⑧ `poserFondCrop` REFUSE sans crop, et sans `remplir`', () => {
  // ⚠️ Un fond posé sans découpe n'a pas de repère : il creuserait la planète
  // entière. Et sans `remplir` il n'y a PAS de repli — celui de `_cuireChampMer`
  // (lire `hauteurSurface`) serait CIRCULAIRE, la sonde rendant déjà le fond posé.
  const sansCrop = pose(globeNu(), { remplir: remplirFactice() })
  assert.equal(sansCrop.refus, 'crop')
  const sansRemplir = pose(globeNu({ crop: REPERE_REUNION }), {})
  assert.equal(sansRemplir.refus, 'remplir')
  assert.equal(sansRemplir.rebati, 0, 'un refus ne touche à rien')
})

test('⑧ bis `poserFondCrop` REFUSE une couverture insuffisante', () => {
  // ⚠️ Poser un fond à moitié rempli creuserait des marches là où la donnée
  // manque — et rebâtirait cinquante maillages pour les dessiner.
  const g = globeNu({ crop: REPERE_REUNION })
  const r = pose(g, { remplir: remplirFactice({ remplis: 100 }), couvertureMin: 0.99 })
  assert.equal(r.refus, 'champ')
  assert.ok(r.couverture < 0.99)
  assert.equal(g.uniforms.uFondOn.value, 0, 'un refus ne doit rien allumer')
  assert.equal(g._fondCrop, null)
  // le même champ passe quand le seuil est celui du dépôt (0)
  const passant = pose(globeNu({ crop: REPERE_REUNION }), { remplir: remplirFactice({ remplis: 100 }) })
  assert.equal(passant.refus, null)
})

test('⑧ ter `poserFondCrop` REFUSE tant que la bathymétrie n a pas fusionné', () => {
  // ⚠️ La nappe est ASYNCHRONE : sans ce refus, la première cuisson serait la
  // dernière et la surface resterait plate en se croyant remplie.
  const g = globeNu({ crop: REPERE_REUNION })
  const r = pose(g, { remplir: remplirFactice({ bathy: false }), exigerBathy: true })
  assert.equal(r.refus, 'champ')
  assert.equal(r.bathy, false)
  assert.equal(g.uniforms.uFondOn.value, 0)
  // et il prend dès que la fusion a eu lieu
  const g2 = globeNu({ crop: REPERE_REUNION })
  assert.equal(pose(g2, { remplir: remplirFactice({ bathy: true }), exigerBathy: true }).refus, null)
  assert.equal(g2.uniforms.uFondOn.value, 1)
  // ⚠️ et `exigerBathy` faux LAISSE PASSER une nappe absente — c'est le cas
  // NORMAL d'un crop continental, pas une panne
  const g3 = globeNu({ crop: REPERE_REUNION })
  assert.equal(pose(g3, { remplir: remplirFactice({ bathy: false }) }).refus, null)
})

test('⑧ quater il ne rebâtit QUE si la surface a changé', () => {
  // ⚠️ `poserFondCrop` est rappelé à chaque cran ET à chaque reprise :
  // reconstruire les maillages pour un champ identique coûterait une planète par
  // reprise. Et l'inverse — ne jamais rebâtir — laisserait la surface plate.
  const g = globeNu({ crop: REPERE_REUNION })
  const t = tuileDeTest(12, CENTRE_REUNION.lat, CENTRE_REUNION.lon, HAUTEURS_MER)
  g.tiles.set(t.key, t)
  g.gardeHauteurs.add(t.key) // sous réservation : ses hauteurs survivent au maillage
  Globe.prototype._buildMesh.call(g, t)
  assert.ok(t.mesh, 'la tuile doit avoir un maillage avant qu on parle de le rebâtir')

  const premier = pose(g, { remplir: remplirFactice({ profondeur: -1500 }) })
  assert.equal(premier.refus, null)
  assert.equal(premier.rebati, 1, 'le premier fond doit rebâtir la tuile')

  const identique = pose(g, { remplir: remplirFactice({ profondeur: -1500 }) })
  assert.equal(identique.rebati, 0, 'un champ identique ne doit rebâtir personne')

  // ⚠️ la nappe s approfondit (elle arrive par morceaux) : la clé change
  const plusProfond = pose(g, { remplir: remplirFactice({ profondeur: -2116 }) })
  assert.equal(plusProfond.rebati, 1, 'une profondeur nouvelle DOIT rebâtir')
})

test('⑧ quinquies le maillage rebâti PORTE le fond, et `retirerFondCrop` le rend', () => {
  const g = globeNu({ crop: REPERE_REUNION })
  const t = tuileDeTest(12, CENTRE_REUNION.lat, CENTRE_REUNION.lon, HAUTEURS_MER)
  g.tiles.set(t.key, t)
  g.gardeHauteurs.add(t.key)
  Globe.prototype._buildMesh.call(g, t)
  assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - R_GLOBE) < 1e-4)

  pose(g, { remplir: remplirFactice({ profondeur: -1500 }) })
  const echelle = (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION
  const creuse = rayonDuSommet(t.mesh, 312)
  assert.ok(Math.abs(creuse - (R_GLOBE - 1500 * echelle)) < 1e-4,
    `la surface rebâtie doit porter le fond ; elle est à ${creuse}`)

  const rendus = Globe.prototype.retirerFondCrop.call(g)
  assert.equal(rendus, 1, '`retirerFondCrop` doit rebâtir ce qu il a creusé')
  assert.equal(g._fondCrop, null)
  assert.equal(g.uniforms.uFondOn.value, 0)
  assert.equal(g.uniforms.uFondChamp.value, null)
  assert.equal(g.uniforms.uFondMetres.value, 1, '`uFondMetres` est un DIVISEUR : il revient à 1, pas à 0')
  assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - R_GLOBE) < 1e-4,
    'le fond retiré, la mer doit remonter sur la sphère')
})

test('⑧ sexies les uniformes du fond portent l ÉCHELLE INVERSE et la PORTÉE du champ', () => {
  // ⚠️ **`uFondMetres` EST L INVERSE DE L ÉCHELLE, ET UNE CONFUSION NE SE VOIT
  // PAS** : le champ est cuit en unités locales (`brut × echelle`), le nuanceur
  // le relit en mètres. Porter l échelle au lieu de son inverse rendrait un fond
  // marin de deux milliardièmes de mètre — c est-à-dire zéro, c est-à-dire le
  // défaut d avant la tâche, en silence.
  for (const exageration of [1, 2.8, 18]) {
    const g = globeNu({ crop: REPERE_REUNION, exageration })
    const r = pose(g, { remplir: remplirFactice(), portee: 5 })
    assert.equal(r.refus, null)
    const echelle = (R_GLOBE / EARTH_RADIUS_M) * exageration
    assert.ok(Math.abs(g.uniforms.uFondMetres.value - 1 / echelle) < 1e-9,
      `exagération ${exageration} : uFondMetres = ${g.uniforms.uFondMetres.value}, attendu ${1 / echelle}`)
    assert.equal(g.uniforms.uFondPortee.value, 5,
      'la portée de l uniforme est celle du CHAMP POSÉ, pas le défaut du module')
    assert.equal(g.uniforms.uFondOn.value, 1)
    assert.ok(g.uniforms.uFondChamp.value?.isTexture)
  }
})

test('⑧ septies la texture du fond relit EXACTEMENT ce que le champ portait', () => {
  // l aller-retour complet : mètres → unités locales → demi-flottant → mètres.
  // ⚠️ La tolérance n est pas choisie, elle est MESURÉE : un demi-flottant vaut
  // 2^-15 près de 0,218 unité, soit 2,8 m au sol à l exagération 2,8.
  const g = globeNu({ crop: REPERE_REUNION })
  pose(g, { remplir: remplirFactice({ profondeur: -2116.3 }) })
  const tex = g.uniforms.uFondChamp.value
  const relu = THREE.DataUtils.fromHalfFloat(tex.image.data[0]) * g.uniforms.uFondMetres.value
  assert.ok(Math.abs(relu - -2116.3) < 3,
    `relu ${relu} m, attendu −2 116,3 m — au demi-flottant près (2,8 m mesurés)`)
})

// ══════════ ⑨ LE NUANCEUR — EXTRAIT DE LA SOURCE ET CONFRONTÉ À LA LOI ══════
//
// ⚠️ **PAS UNE ASSERTION DE CHAÎNE : ON EXÉCUTE LE BLOC GLSL.** Trois mutations
// du premier tour ont survécu ici (nuanceur qui ignore le fond, qui le laisse
// déborder du champ, qui fait sortir une butte de l'eau) parce que RIEN ne lisait
// ce bloc. Le précédent est `test/mer-sphere.test.js`, qui « EXTRAIT cette
// expression pour la confronter à elle » : on translittère mécaniquement le
// GLSL en JavaScript et on l'oppose à `altitudeSonde`, la loi qu'il transcrit.
//
// ⚠️ **LA TRANSLITTÉRATION EST MÉCANIQUE, ET C'EST TOUT SON INTÉRÊT** : elle ne
// réécrit pas la loi, elle remplace `min`/`max`/`abs` par leurs jumeaux de
// `Math`, `&&` reste `&&`, et le `texture2D(...).r * uFondMetres` devient un
// échantillonneur de papier. Ce qui change dans la source change donc dans la
// fonction, et le test rougit sur le COMPORTEMENT.

// ⚠️ **LE BLOC EXTRAIT COMMENCE À `surLeFond` DEPUIS LA TÂCHE P12** : la
// condition qui décidait de la hauteur a un SECOND lecteur — le PAS du gradient
// de la normale fine — et elle est donc nommée. Extraire `hauteurFond` seule
// laisserait la condition, c'est-à-dire toute la loi, hors du test.
const BLOC_FOND_GLSL = (() => {
  const debut = FRAG_GLOBE.indexOf('bool surLeFond(vec2 qCrop, float h)')
  if (debut < 0) throw new Error('le bloc du fond a disparu du nuanceur')
  const ancre = FRAG_GLOBE.indexOf('float hauteurFond(vec2 qCrop, float h)', debut)
  if (ancre < 0) throw new Error('hauteurFond a disparu du nuanceur')
  const fin = FRAG_GLOBE.indexOf('\n}', ancre)
  return FRAG_GLOBE.slice(debut, fin + 2)
})()

// GLSL → JS, mécaniquement.
const traduire = (glsl) => glsl
  .replace(/\bbool surLeFond\(vec2 qCrop, float h\)/, 'function surLeFond(qCrop, h)')
  .replace(/\bfloat hauteurFond\(vec2 qCrop, float h\)/, 'function hauteurFond(qCrop, h)')
  .replace(/\bfloat\s+/g, 'let ')
  .replace(/\bmin\(/g, 'Math.min(')
  .replace(/\bmax\(/g, 'Math.max(')
  .replace(/\babs\(/g, 'Math.abs(')
  // ⚠️ **NON GOURMAND, ET LA PARENTHÈSE INTERNE EST LA RAISON** : l'argument
  // porte `(2.0 * uFondPortee)`, donc un `[^)]*` s'arrêterait au MAUVAIS `)`.
  .replace(/texture2D\(uFondChamp,[\s\S]*?\)\.r/g, 'echantillon')

const ARGS_FOND = ['uFondOn', 'uCropOn', 'uFondPortee', 'uFondMetres', 'qCrop', 'h', 'echantillon']
// eslint-disable-next-line no-new-func
const fondDuNuanceur = new Function(...ARGS_FOND, traduire(BLOC_FOND_GLSL) + '\n  return hauteurFond(qCrop, h);')
// ⚡ **ET LA CONDITION ELLE-MÊME, EXÉCUTABLE** : c'est elle que le pas du
// gradient relit dans `main()`, et son contrat — être STABLE par la composition
// avec `hauteurFond` — n'est vérifiable qu'en la faisant tourner.
// eslint-disable-next-line no-new-func
const surLeFondDuNuanceur = new Function(...ARGS_FOND, traduire(BLOC_FOND_GLSL) + '\n  return surLeFond(qCrop, h);')

test('⑨ le bloc du nuanceur EST `altitudeSonde` — translittéré, puis exécuté', () => {
  const portee = 3
  const echelleInverse = 22753.57142857143 // 1 / echelle, relevé dans l'application
  for (const h of [-288.36, -0.7, 0, 12.5, 2975.25]) {
    for (const fondM of [-2116.3, -920.7, -0.5, 0, 37.5]) {
      for (const q of [{ x: 0, y: 0 }, { x: 2.9, y: -1 }, { x: -3, y: 3 }]) {
        const echantillon = fondM / echelleInverse // ce que la texture porte : des unités locales
        const rendu = fondDuNuanceur(1, 1, portee, echelleInverse, q, h, echantillon)
        const attendu = altitudeSonde(h, fondM)
        assert.ok(Math.abs(rendu - attendu) < 1e-6,
          `h=${h} fond=${fondM} q=(${q.x},${q.y}) : le nuanceur rend ${rendu}, la loi ${attendu}`)
      }
    }
  }
})

test('⑨ bis le nuanceur ÉTEINT (uFondOn ou uCropOn à zéro) rend la hauteur du dépôt', () => {
  const echantillon = -2116.3 / 22753.57142857143
  for (const [on, crop] of [[0, 1], [1, 0], [0, 0]]) {
    for (const h of [-288.36, 0, 1200]) {
      assert.equal(fondDuNuanceur(on, crop, 3, 22753.57142857143, { x: 0, y: 0 }, h, echantillon), h,
        'sans crop ou sans fond, la production est intouchée AU BIT PRÈS')
    }
  }
})

test('⑨ ter HORS du champ, le nuanceur ne prolonge PAS le bord', () => {
  // ⚠️ Le champ ne couvre que `uFondPortee` demi-côtés. Au-delà, la texture est
  // en `ClampToEdge` : sans cette borne, le fond marin du bord de calotte se
  // répandrait sur toute la planète estompée, sans qu'aucune erreur ne se lève.
  const echelleInverse = 22753.57142857143
  const echantillon = -2116.3 / echelleInverse
  const portee = 3
  // dedans : le fond mord
  assert.ok(fondDuNuanceur(1, 1, portee, echelleInverse, { x: 2.99, y: 0 }, 0, echantillon) < -2000)
  assert.ok(fondDuNuanceur(1, 1, portee, echelleInverse, { x: 0, y: -3 }, 0, echantillon) < -2000)
  // dehors : rien ne bouge, sur les DEUX axes et dans les DEUX sens
  for (const q of [{ x: 3.01, y: 0 }, { x: -3.01, y: 0 }, { x: 0, y: 3.01 }, { x: 0, y: -3.01 }, { x: 2.9, y: 4 }]) {
    assert.equal(fondDuNuanceur(1, 1, portee, echelleInverse, q, 0, echantillon), 0,
      `hors du champ en (${q.x}, ${q.y}), la hauteur ne doit pas bouger`)
  }
})

test('⑨ quater le nuanceur ne fait pas sortir de butte de l eau', () => {
  // le champ dit « terre » là où la tuile dit « mer » : on reste au niveau de la
  // mer, comme `altitudeSonde` — jamais au-dessus.
  const echelleInverse = 22753.57142857143
  const rendu = fondDuNuanceur(1, 1, 3, echelleInverse, { x: 0, y: 0 }, 0, 37.5 / echelleInverse)
  assert.equal(rendu, 0, 'min(hFond, 0.0) : un champ positif ne soulève pas la mer')
})

// ══════════ ⑩ LA FORMULE D UV EST LA MÊME DES DEUX CÔTÉS ════════════════════

test('⑩ le nuanceur et `uvFond` lisent le champ AU MÊME TEXEL', () => {
  // ⚠️ Deux conventions d uv, et le fond du CROP et le fond de la MER se
  // liraient à deux endroits différents du même tableau — le désaccord
  // reviendrait par la porte de derrière.
  const m = BLOC_FOND_GLSL.match(/texture2D\(uFondChamp,\s*([\s\S]*?\+ 0\.5)\)\.r/)
  assert.ok(m, 'la lecture de `uFondChamp` a changé de forme')
  const expression = m[1].replace(/\s+/g, ' ').trim()
  assert.equal(expression, 'qCrop / (2.0 * uFondPortee) + 0.5')
  // et le comportement : la transcription JS de cette expression EST `uvFond`
  for (const portee of [1, 3, 7.25]) {
    for (const q of [{ u: 0, v: 0 }, { u: portee, v: -portee }, { u: -portee, v: portee / 3 }]) {
      const glsl = { u: q.u / (2.0 * portee) + 0.5, v: q.v / (2.0 * portee) + 0.5 }
      assert.deepEqual(uvFond(q, portee), glsl)
    }
  }
})

// ══════════ ⑪ LES DEUX DERNIERS SURVIVANTS DE LA CAMPAGNE ═══════════════════

test('⑪ le champ n est pas lu TRANSPOSÉ — et il faut sortir de la diagonale ET du bord', () => {
  // ⚠️ **DEUXIÈME ÉCRITURE DE CE TEST, ET LA PREMIÈRE NE MORDAIT PAS.** La
  // mutation « lire `valeurs[i0 * c + j0]` au lieu de `valeurs[j0 * c + i0]` » a
  // survécu DEUX fois :
  //   ① d'abord parce que toutes mes sondes tombaient sur la DIAGONALE du champ,
  //      où une transposition ne change rien par construction ;
  //   ② puis parce que la sonde « hors diagonale » tombait sur le BORD, où
  //      l'écrêtage de `i0` (`min(floor(fx), cote − 2)`) la ramenait sur la
  //      diagonale sans que ça se voie.
  // C'est le §0 retourné contre moi : la mutation changeait bien le
  // COMPORTEMENT ; c'est la sonde qui était aveugle, deux fois.
  //
  // Un fond marin lu transposé, c'est le relief sous-marin en miroir diagonal :
  // le talus se retrouve du mauvais côté de l'île.
  const cote = 9
  const f = fondJouet({ cote })
  const n = cote - 1
  // on VISE le carré (i0 = 5, j0 = 2), au milieu du champ et loin de la diagonale
  const uLocal = ((5.5 / n) - 0.5) * 2 * f.portee
  const vLocal = ((2.5 / n) - 0.5) * 2 * f.portee
  const p = latLonDeLocal(uLocal, vLocal, f.repere)
  const val = (i, j) => -100 * i - 1000 * j
  const bilin = (i0, j0) => {
    const haut = (val(i0, j0) + val(i0 + 1, j0)) / 2
    const bas = (val(i0, j0 + 1) + val(i0 + 1, j0 + 1)) / 2
    return (haut + bas) / 2
  }
  const attendu = bilin(5, 2)
  const transposee = bilin(2, 5)
  assert.notEqual(attendu, transposee, 'la sonde doit distinguer les deux lectures, sinon elle ne prouve rien')
  const lu = echantillonnerFond(f, p.lat, p.lon)
  assert.ok(Math.abs(lu - attendu) < 1e-6,
    `lu ${lu}, attendu ${attendu} (la lecture transposée aurait donné ${transposee})`)
})

test('⑪ bis `retirerCrop` retire AUSSI le fond — sinon la mer reste creusée sans crop', () => {
  // ⚠️ **UNE MUTATION A SURVÉCU ICI** : retirer l'appel à `retirerFondCrop` dans
  // `retirerCrop` ne faisait rougir personne. Le globe redevenait entier avec un
  // fond marin posé sur une découpe qui n'existe plus — donc des tuiles bâties
  // AVEC le fond, et une mer creusée au milieu de l'océan Indien.
  //
  // ⚠️ **ET L'ORDRE COMPTE** : `retirerFondCrop` rebâtit les maillages, donc il
  // doit passer APRÈS `_crop = null`. On le vérifie par le comportement, pas par
  // la lecture : la tuile rebâtie doit être revenue SUR la sphère.
  const g = globeNu({ crop: REPERE_REUNION })
  const journal = []
  // les cinq autres retraits sont hors sujet ici : ils ont leurs propres tests
  for (const nom of ['_melangeCrop', 'retirerParoisCrop', 'retirerHabillage', 'retirerRampe', 'retirerMer', 'retirerEstompage']) {
    g[nom] = () => journal.push(nom)
  }
  g.retirerFondCrop = function () { journal.push('retirerFondCrop'); return Globe.prototype.retirerFondCrop.call(this) }
  const t = tuileDeTest(12, CENTRE_REUNION.lat, CENTRE_REUNION.lon, HAUTEURS_MER)
  g.tiles.set(t.key, t)
  g.gardeHauteurs.add(t.key)
  Globe.prototype._buildMesh.call(g, t)
  pose(g, { remplir: remplirFactice({ profondeur: -1500 }) })
  assert.ok(rayonDuSommet(t.mesh, 312) < R_GLOBE - 1e-3, 'le fond est bien posé avant qu on le retire')

  Globe.prototype.retirerCrop.call(g)

  assert.ok(journal.includes('retirerFondCrop'), '`retirerCrop` doit appeler `retirerFondCrop`')
  assert.equal(g._crop, null)
  assert.equal(g._fondCrop, null)
  assert.equal(g.uniforms.uFondOn.value, 0)
  assert.equal(g.uniforms.uFondChamp.value, null)
  assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - R_GLOBE) < 1e-4,
    'le crop retiré, la surface doit être revenue SUR la sphère')
})

// ══════════ ⑩ LE PAS DU GRADIENT SUIT LA SOURCE — Tâche P12 ═════════════════
//
// ⛔ CE QUE CES TESTS EXISTENT POUR EMPÊCHER. `hauteurFond` ÉCRASE la hauteur du
// MNT par le champ cuit dès qu'on est sous l'eau. Le pas du gradient de la
// normale fine, lui, était borné par l'EMPREINTE DU PIXEL — une borne dont
// l'argument (P10 §2.4) porte sur la MINIFICATION du MNT, et qui ne veut rien
// dire pour un champ six fois plus grossier que le MNT. Le prix mesuré :
// **24,6 % du grain du fond marin** (notation 04 §5-④), et **+22 % sur la
// frange côtière en marches**.
//
// La condition est donc NOMMÉE (`surLeFond`) et LUE DEUX FOIS. Ce qui suit
// vérifie qu'elle ne peut pas diverger d'un lecteur à l'autre.

test('⑩a ⚡ `surLeFond` est STABLE PAR LA COMPOSITION — c’est ce qui permet de la relire APRÈS `hauteurFond`', () => {
  // ⛔ `main()` appelle `surLeFond(qCrop, h)` sur un `h` qui a DÉJÀ traversé
  // `hauteurFond`. Si la condition changeait de valeur au passage, le pas
  // basculerait sur la mauvaise loi une bande de fragments sur deux — sans
  // qu'aucune erreur ne soit levée.
  const echelleInverse = 22753.57142857143
  let vus = { vrai: 0, faux: 0 }
  for (const uFondOn of [0, 1]) {
    for (const uCropOn of [0, 1]) {
      for (const h of [-2000, -288.36, -0.7, 0, 1e-7, 12.5, 2975.25]) {
        for (const fondM of [-2116.3, -920.7, -0.5, 0, 37.5]) {
          for (const q of [{ x: 0, y: 0 }, { x: 2.9, y: -1 }, { x: 3, y: 0 }, { x: -3.01, y: 3 }, { x: 5, y: 5 }]) {
            const ech = fondM / echelleInverse
            const avant = surLeFondDuNuanceur(uFondOn, uCropOn, 3, echelleInverse, q, h, ech)
            const hh = fondDuNuanceur(uFondOn, uCropOn, 3, echelleInverse, q, h, ech)
            const apres = surLeFondDuNuanceur(uFondOn, uCropOn, 3, echelleInverse, q, hh, ech)
            assert.equal(apres, avant,
              `surLeFond change de valeur au passage de hauteurFond : uFondOn=${uFondOn} uCropOn=${uCropOn} h=${h} fond=${fondM} q=(${q.x},${q.y})`)
            vus[avant ? 'vrai' : 'faux']++
          }
        }
      }
    }
  }
  // ⚠️ **ET LE BALAYAGE VOIT LES DEUX CÔTÉS** : un test qui ne rencontrerait
  // jamais `vrai` passerait aussi sur un `surLeFond` qui rend toujours faux.
  assert.ok(vus.vrai > 50, `la condition n'est jamais vraie dans ce balayage (${vus.vrai})`)
  assert.ok(vus.faux > 50, `la condition n'est jamais fausse dans ce balayage (${vus.faux})`)
})

test('⑩b `surLeFond` EST la condition qui décide de la hauteur — exécutée, pas lue', () => {
  // ⛔ Une mutation qui relâche la condition d'un seul côté (par exemple
  // `h < 0.0` ici et `h <= 0.0` là) ferait basculer le pas sur des fragments
  // dont la hauteur vient encore du MNT. On l'oppose au COMPORTEMENT de
  // `hauteurFond` : quand la condition est fausse, la hauteur ne bouge PAS ;
  // quand elle est vraie, elle vaut `min(champ, 0)`.
  const echelleInverse = 22753.57142857143
  for (const h of [-288.36, -0.7, 0, 12.5, 2975.25]) {
    for (const fondM of [-2116.3, -0.5, 0, 37.5]) {
      for (const q of [{ x: 0, y: 0 }, { x: 3, y: 3 }, { x: 3.0001, y: 0 }]) {
        const ech = fondM / echelleInverse
        const cond = surLeFondDuNuanceur(1, 1, 3, echelleInverse, q, h, ech)
        const rendu = fondDuNuanceur(1, 1, 3, echelleInverse, q, h, ech)
        if (cond) assert.ok(Math.abs(rendu - Math.min(fondM, 0)) < 1e-6, `h=${h} fond=${fondM} q=(${q.x},${q.y})`)
        else assert.equal(rendu, h, `h=${h} fond=${fondM} q=(${q.x},${q.y}) : la hauteur a bougé hors condition`)
      }
    }
  }
  // ⛔ **ET LES DEUX GARDES DE PRODUCTION SONT DES ET, PAS DES OU.** `uFondOn`
  // et `uCropOn` valent ZÉRO drapeau baissé (relevé dans la page) : si l'un
  // d'eux cessait de couper, la vue orbitale de production lirait un champ
  // qu'elle n'a pas — et un `&&` changé en `||` ne se voit sur aucune capture
  // du crop, où les deux valent 1.
  for (const [uFondOn, uCropOn] of [[0, 1], [1, 0], [0, 0]]) {
    const ech = -2116.3 / 22753.57142857143
    assert.equal(surLeFondDuNuanceur(uFondOn, uCropOn, 3, 22753.57142857143, { x: 0, y: 0 }, -50, ech), false,
      `uFondOn=${uFondOn} uCropOn=${uCropOn} : la condition doit être FAUSSE`)
    assert.equal(fondDuNuanceur(uFondOn, uCropOn, 3, 22753.57142857143, { x: 0, y: 0 }, -50, ech), -50,
      `uFondOn=${uFondOn} uCropOn=${uCropOn} : la hauteur du MNT doit passer intacte`)
  }
  // et le témoin : les deux à 1, la même entrée bascule bien
  assert.equal(surLeFondDuNuanceur(1, 1, 3, 22753.57142857143, { x: 0, y: 0 }, -50, -2116.3 / 22753.57142857143), true)
})

test('⑩c la condition n’est écrite QU’UNE FOIS, et `hauteurFond` la lit', () => {
  // ⚠️ « Deux écritures jumelles finiraient par diverger » (`terrain.js`). La
  // condition a deux lecteurs depuis P12 : elle doit avoir UN seul auteur.
  assert.equal((FRAG_GLOBE.match(/uFondOn > 0\.5 && uCropOn > 0\.5/g) || []).length, 1,
    'la condition du fond marin est écrite deux fois dans le nuanceur')
  const nu = FRAG_GLOBE.replace(/\s+/g, ' ')
  assert.match(nu, /float hauteurFond\(vec2 qCrop, float h\) \{ if \(surLeFond\(qCrop, h\)\) \{/)
  assert.match(nu, /bool fondMarin = surLeFond\(qCrop, h\);/)
})

test('⑩d ⛔ `fondMarin` EST RELEVÉ AVANT LE GRAIN — le grain change le SIGNE de h', () => {
  // ⛔ `hauteurGrain` ajoute un bruit SIGNÉ (`(g1 − 0,5) × 2 + (g2 − 0,5) × 0,7`)
  // multiplié par `uGrainForceM`. Une butte de terre à un mètre au-dessus de
  // l'eau peut donc en ressortir NÉGATIVE — et le pas basculerait sur la loi du
  // fond marin en pleine terre. Relever `fondMarin` après le grain est une
  // mutation qui ne se voit sur AUCUNE capture sans grain (`uGrainForceM = 0`
  // au cadrage de la notation) : on la tue par l'ordre.
  const nu = FRAG_GLOBE.replace(/\s+/g, ' ')
  const iFond = nu.indexOf('bool fondMarin = surLeFond(qCrop, h);')
  const iHauteur = nu.indexOf('float h = hauteurFond(qCrop, decodeMetersAA(vUv));')
  const iGrain = nu.indexOf('h = hauteurGrain(qCrop, h);')
  assert.ok(iHauteur > 0 && iFond > iHauteur, '`fondMarin` doit être relevé APRÈS la composition de la hauteur')
  assert.ok(iGrain > iFond, '`fondMarin` doit être relevé AVANT le grain')
  // ⛔ **ET IL N'EST ÉCRIT QU'UNE FOIS — UNE SURVIVANTE L'A EXIGÉ.** La campagne
  // a AJOUTÉ un second `fondMarin = surLeFond(qCrop, h)` après le grain, et le
  // test n'a pas rougi : le premier était toujours là, et l'ordre tenait. Ce
  // qu'il faut interdire n'est pas « une lecture après le grain », c'est
  // « plus d'une lecture ».
  assert.equal((nu.match(/fondMarin = surLeFond/g) || []).length, 1,
    '`fondMarin` est affecté plusieurs fois : la dernière affectation gagne, et elle peut être après le grain')
  assert.equal((nu.match(/\bfondMarin\b/g) || []).length, 2,
    '`fondMarin` doit avoir exactement UN auteur et UN lecteur')
  // et le grain PEUT bien retourner le signe : ce n'est pas une précaution
  // théorique — on l'exécute sur la loi du dépôt
  const g = (a, b) => a + 12 * ((b - 0.5) * 2 + (0.3 - 0.5) * 0.7)
  assert.ok(g(1, 0) < 0, 'le grain doit pouvoir faire passer une hauteur positive sous zéro')
})

test('⑩e le PAS du gradient, EXÉCUTÉ : la mer prend LA CELLULE DU CHAMP, la terre l’empreinte', () => {
  // ⚡ **PAS UNE ASSERTION DE CHAÎNE : ON ÉVALUE LA LOI.** On extrait la ligne du
  // nuanceur et on la fait tourner — c'est la seule façon de tuer une mutation
  // qui échangerait les deux branches, ou qui retirerait le plancher du texel de
  // l'une des deux.
  //
  // ⛔ **CE TEST VERROUILLAIT LA LOI DE P12 (« la mer prend le texel »), ET LA
  // TÂCHE R17 L'A REMPLACÉE.** P12 avait raison de sortir le fond marin de
  // l'empreinte d'écran, et s'est arrêtée un cran trop tôt : sous l'eau la
  // hauteur vient du champ cuit, dont la maille vaut SIX texels de MNT
  // (`2 × PORTEE_CROP / CHAMP_FOND = 6/384` demi-côtés de crop, contre
  // `qParUv / uTilePx = 0,6667/256`). Dériver au sixième d'une bilinéaire ne
  // rend que sa FACETTE — la grille de plaques sombres que la relecture de R5 a
  // vue et que le banc R17 a mesurée (pic à 6 px pour une cellule de 3,237 px,
  // amplitude 0,3133 → 0,0195 une fois le pas porté à la cellule, socle 0,0471).
  // **Ce qui ne change pas, et que ce test continue de garder : le plancher du
  // texel, sur les DEUX branches, et le fait que les deux branches diffèrent.**
  const bloc = FRAG_GLOBE.match(/float pasChamp = (.+);\s*\n\s*float pas = ([\s\S]+?);/)
  assert.ok(bloc, 'la loi du pas a disparu du nuanceur, ou ne lit plus la cellule du champ')
  const js = (bloc[1] + '|' + bloc[2]).replace(/\bmax\(/g, 'Math.max(')
  const [expChamp, expPas] = js.split('|')
  // eslint-disable-next-line no-new-func
  const pas = new Function('fondMarin', 'uTilePx', 'pasEmpreinte', 'uFondPasQ', 'qParUv',
    `const pasChamp = ${expChamp}; return ${expPas};`)
  // la monnaie du cadrage de référence : 3 tuiles z12, donc `qCrop` par unité
  // d'uv = (1/2^12) / (1,5/2^12) = 2/3.
  const Q = 2 / 3
  for (const uTilePx of [256, 512]) {
    const texel = 1 / uTilePx
    const cellule = 6 / 384 // 2 × PORTEE_CROP / CHAMP_FOND, en demi-côtés de crop
    const attendu = Math.max(texel, cellule / Q)
    // ⛔ sous l'eau : la cellule du champ, quelle que soit l'empreinte
    for (const e of [0, texel / 2, texel, 4 * texel, 40 * texel]) {
      assert.equal(pas(true, uTilePx, e, cellule, Q), attendu, `mer, uTilePx=${uTilePx}, empreinte=${e}`)
    }
    // ⛔ et SANS champ posé (`uFondPasQ = 0`), la mer retombe sur le texel : le
    // dépôt d'avant R17, au bit près.
    assert.equal(pas(true, uTilePx, 40 * texel, 0, Q), texel,
      'sans fond posé, la mer doit retrouver le pas de P12')
    // ⛔ sur terre : le PLUS GRAND des deux, jamais moins que le texel
    assert.equal(pas(false, uTilePx, 0, cellule, Q), texel, 'sans uMppFacteur, la terre retombe sur le texel')
    assert.equal(pas(false, uTilePx, texel / 2, cellule, Q), texel, 'le texel est un PLANCHER')
    assert.equal(pas(false, uTilePx, 4 * texel, cellule, Q), 4 * texel, 'l’empreinte l’emporte quand elle est plus grande')
    // ⚡ et les deux branches DIFFÈRENT là où ça compte — sinon la loi serait morte
    assert.notEqual(pas(true, uTilePx, 4 * texel, cellule, Q), pas(false, uTilePx, 4 * texel, cellule, Q),
      'les deux branches rendent le même pas : la bascule ne sert à rien')
  }
})
