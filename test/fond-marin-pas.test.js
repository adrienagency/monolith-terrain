// LE PAS DU GRADIENT DU FOND MARIN — Tâche R17.
//
// ══════════ CE QUE CE FICHIER VERROUILLE, ET POURQUOI IL EXISTE ═════════════
//
// > **Adrien** : « Les fonds marins semblent aussi ne pas être cartographiés
// > correctement, alors qu'avant, en mode plat, nous avions quelque chose de très
// > propre. Je te laisse adapter ce que nous avions en mode plat à ce mode
// > sphère. »
//
// ⚡ **CE QUI CLOCHAIT ÉTAIT UNE CONVERSION D'UNITÉ, LA CLASSE DE DÉFAUT LA PLUS
// FRÉQUENTE DE CE CHANTIER.** La Tâche P12 avait sorti le fond marin de
// l'empreinte d'écran — à raison — et reposé son pas de gradient sur le TEXEL DU
// MNT (`1.0 / uTilePx`). Mais sous l'eau, la hauteur ne vient pas du MNT : elle
// vient du champ cuit, qui porte `CHAMP_FOND` intervalles sur `2 × PORTEE_CROP`
// demi-côtés de crop. **Le texel du MNT en est le SIXIÈME** — le nuanceur
// dérivait donc une bilinéaire au sixième de sa cellule, ce qui ne peut rendre
// qu'une chose : la FACETTE de la bilinéaire, plate à l'intérieur de chaque
// cellule et cassée à chaque bord.
//
// **Mesuré au banc R17** (La Réunion z12, cadrage côte de R5, fond nu, au large,
// 40 278 px à 16 px au moins de tout bord, appariement −0,0095 %) :
// l'autocorrélation de |d²L| pique à **6 px pour une cellule de champ mesurée à
// 3,237 px** (le second harmonique), amplitude normalisée **0,3133**, reproduite
// à **0,3136** au relevé de retour. Pas porté à une cellule : **0,0195**, sans
// pic. Le socle, la cible : **0,0471**. Les images sont dans `.banc/R17/`.
//
// ⚡ **ET LE SOCLE NE FAIT PAS AUTREMENT** : ses normales sont celles de
// `computeVertexNormals` sur SA grille de sommets (771², 35,58 m relevés), donc
// une dérivée prise À LA MAILLE, jamais à l'intérieur d'une cellule. Le dépôt
// documente déjà le même défaut et le même remède du côté du socle
// (`loadBathyPatch`, `src/dem.js` : « agrandir une tuile z8 par drawImage se
// faisait en bilinéaire, dont la pente casse à chaque bord de cellule »).
//
// ⚠️ **LE FICHIER EXÉCUTE LE NUANCEUR, IL NE LE GREPPE PAS.** C'est la leçon
// n° 1 du tour de correction de R5 : cinq mutations avaient survécu à un fichier
// entièrement en assertions sur le texte source, dont deux qui éteignaient la
// livraison entière. Le bloc du pas est donc DÉCOUPÉ dans `src/globe.js` et
// COURU, et **l'interrupteur est éprouvé DANS LES DEUX SENS** : sous l'eau il
// prend la cellule du champ, sur la terre il ne bouge pas d'un bit.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { Globe } from '../src/globe.js'
import { repereCrop } from '../src/monde/crop-sphere.js'
import { PORTEE_CROP } from '../src/monde/mer-sphere.js'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const SOURCE_GLOBE = fs.readFileSync(path.join(ICI, '..', 'src', 'globe.js'), 'utf8')
const FRAG_GLOBE = (() => {
  const i = SOURCE_GLOBE.indexOf('const FRAG = /* glsl */ `')
  if (i < 0) throw new Error('le nuanceur de fragment a disparu de globe.js')
  return SOURCE_GLOBE.slice(i, SOURCE_GLOBE.indexOf('\n`\n', i))
})()

// ⚠️ **LUE DANS LA SOURCE, JAMAIS RECOPIÉE.** Un chiffre recopié dans un test ne
// rougit pas quand la source change sous lui — c'est la discipline que
// `test/globe-profondeur.test.js` applique déjà à `MAX_Z`. `CHAMP_FOND` n'est
// pas exporté (c'est un détail interne), donc on la lit à sa seule écriture.
const CHAMP_FOND = (() => {
  const m = SOURCE_GLOBE.match(/^const CHAMP_FOND = (\d+)$/m)
  if (!m) throw new Error('CHAMP_FOND a disparu de globe.js, ou a changé de forme')
  return Number(m[1])
})()

// ══════════ ① LE BLOC DU PAS, DÉCOUPÉ DANS LA SOURCE ET EXÉCUTÉ ═════════════

// ⚠️ **LE DÉCOUPAGE EST PARESSEUX, ET C'EST DÉLIBÉRÉ.** Fait au chargement du
// module, un échec d'extraction ferait tomber le FICHIER ENTIER en une seule
// ligne rouge — et une campagne de mutation ne saurait plus dire QUELLE loi a
// été cassée. Ici chaque test porte son propre échec.
function blocPasGlsl() {
  const debut = FRAG_GLOBE.indexOf('float qParUv = uUvParMonde / max(uCropDemi, 1e-9);')
  if (debut < 0) throw new Error('la monnaie qCrop/uv a disparu du nuanceur')
  const ancre = FRAG_GLOBE.indexOf('float pas = fondMarin', debut)
  if (ancre < 0) {
    throw new Error(
      'le pas du gradient ne suit pas la monnaie qCrop/uv : soit il a disparu, '
      + 'soit il est calculé AVANT elle — donc il ne peut pas être exprimé dans '
      + 'la cellule du champ (Tâche R17)'
    )
  }
  const fin = FRAG_GLOBE.indexOf(';', ancre)
  if (fin < 0) throw new Error('le pas du gradient n a pas de fin')
  return FRAG_GLOBE.slice(debut, fin + 1)
}

// GLSL → JS, mécaniquement. ⚠️ Aucune formule n'est réécrite : seuls les mots
// `float` et `max` changent de langue.
const traduire = (glsl) => glsl
  .replace(/\bfloat\s+/g, 'let ')
  .replace(/\bmax\(/g, 'Math.max(')
  .replace(/\bmin\(/g, 'Math.min(')

const ARGS_PAS = ['uUvParMonde', 'uCropDemi', 'uFondPasQ', 'uTilePx', 'fondMarin', 'pasEmpreinte']
let _pas = null
const pasDuNuanceur = (...a) => {
  // eslint-disable-next-line no-new-func
  if (!_pas) _pas = new Function(...ARGS_PAS, traduire(blocPasGlsl()) + '\n  return { pas, qParUv };')
  return _pas(...a)
}

// Le cadrage de référence du banc R17 : La Réunion, z12, crop de 3 tuiles.
// ⚠️ **AUCUN DE CES TROIS NOMBRES N'EST INVENTÉ** : `uUvParMonde` vaut `1 / 2^z`
// (son en-tête dans le nuanceur), `uCropDemi` est le demi-côté du crop en
// mercator normalisé — 3 tuiles z12 font `3 / 2^12` de tour, donc 1,5 / 4 096 —
// et `uTilePx` vaut 256 (la tuile d'altitude AWS).
const Z = 12
const U_UV_PAR_MONDE = 1 / 2 ** Z
const U_CROP_DEMI = 1.5 / 2 ** Z
const U_TILE_PX = 256
// la cellule du champ, en demi-côtés de crop : `2 × portée / N intervalles`
const CELLULE_Q = (2 * PORTEE_CROP) / CHAMP_FOND

test('① sous l eau, le pas VAUT la cellule du champ — la conversion, dans les deux sens', () => {
  const r = pasDuNuanceur(U_UV_PAR_MONDE, U_CROP_DEMI, CELLULE_Q, U_TILE_PX, true, 0)
  // le pas est en UV ; reconverti en demi-côtés de crop par `qParUv`, il doit
  // rendre la cellule EXACTEMENT — sinon la dérivée ne tombe pas sur les nœuds.
  assert.ok(Math.abs(r.pas * r.qParUv - CELLULE_Q) < 1e-12,
    `pas ${r.pas} uv × ${r.qParUv} = ${r.pas * r.qParUv} demi-côtés, attendu ${CELLULE_Q}`)
})

test('① bis LE RAPPORT AU TEXEL DU MNT VAUT SIX, ET C EST LUI QUI NOMME LE DÉFAUT', () => {
  const r = pasDuNuanceur(U_UV_PAR_MONDE, U_CROP_DEMI, CELLULE_Q, U_TILE_PX, true, 0)
  const rapport = r.pas / (1 / U_TILE_PX)
  // 6/384 demi-côtés pour la cellule, (2/3)/256 pour le texel du MNT : 6,0 pile.
  assert.ok(Math.abs(rapport - 6) < 1e-9,
    `le pas du fond marin vaut ${rapport} texel(s) de MNT, attendu 6 — si ce rapport bouge, c est que CHAMP_FOND ou PORTEE_CROP a bougé sans que le pas suive`)
})

test('② SANS FOND POSÉ, LE PAS EST CELUI DU DÉPÔT AU BIT PRÈS', () => {
  // `uFondPasQ` vaut 0 tant que `_poserTextureFond` n'a pas écrit : le nuanceur
  // doit alors rendre EXACTEMENT `1 / uTilePx`, le pas de la Tâche P12.
  const r = pasDuNuanceur(U_UV_PAR_MONDE, U_CROP_DEMI, 0, U_TILE_PX, true, 0)
  assert.ok(Object.is(r.pas, 1 / U_TILE_PX),
    `sans fond, le pas doit rester ${1 / U_TILE_PX} ; il vaut ${r.pas}`)
})

test('② bis LE PLANCHER DE P10 TIENT : un champ PLUS FIN que le texel ne descend pas sous lui', () => {
  // un champ hypothétique de 4 096 intervalles : sa cellule vaut moins qu'un
  // texel de MNT. Le pas ne doit PAS descendre — c'est le scintillement que la
  // Tâche K a fermé.
  const celluleFine = (2 * PORTEE_CROP) / 8192
  const r = pasDuNuanceur(U_UV_PAR_MONDE, U_CROP_DEMI, celluleFine, U_TILE_PX, true, 0)
  assert.ok(Object.is(r.pas, 1 / U_TILE_PX),
    `le plancher du texel doit tenir ; le pas vaut ${r.pas}`)
})

test('③ SUR LA TERRE, RIEN NE BOUGE — l interrupteur éprouvé dans l AUTRE sens', () => {
  // ⚠️ **C'EST CETTE MOITIÉ-LÀ QUI TUE `fondMarin ? A : B` → `!fondMarin ? A :
  // B`.** Sans elle, une inversion du sens de la garde rendrait la livraison
  // silencieusement réversible — la faute exacte que le tour de correction de R5
  // s'est reprochée.
  for (const pasEmpreinte of [0, 1 / 512, 1 / 256, 1 / 64, 0.5]) {
    const r = pasDuNuanceur(U_UV_PAR_MONDE, U_CROP_DEMI, CELLULE_Q, U_TILE_PX, false, pasEmpreinte)
    assert.ok(Object.is(r.pas, Math.max(1 / U_TILE_PX, pasEmpreinte)),
      `terre, pasEmpreinte ${pasEmpreinte} : pas ${r.pas}, attendu ${Math.max(1 / U_TILE_PX, pasEmpreinte)}`)
  }
})

test('③ bis et la TERRE ne lit pas `uFondPasQ` du tout', () => {
  // quel que soit le champ posé, la terre garde son pas : le fond marin ne peut
  // pas déborder sur le relief.
  const ref = pasDuNuanceur(U_UV_PAR_MONDE, U_CROP_DEMI, 0, U_TILE_PX, false, 1 / 128).pas
  for (const q of [CELLULE_Q, CELLULE_Q * 10, 1, 1e-9]) {
    assert.ok(Object.is(pasDuNuanceur(U_UV_PAR_MONDE, U_CROP_DEMI, q, U_TILE_PX, false, 1 / 128).pas, ref))
  }
})

// ══════════ ④ L UNIFORME EST DÉCLARÉ, SINON IL EST MORT EN SILENCE ══════════

test('④ `uFondPasQ` est DÉCLARÉ dans le nuanceur de fragment', () => {
  // ⚠️ Un uniforme posé côté JS mais absent du texte GLSL est ignoré sans la
  // moindre erreur : `getUniformLocation` rend `null` et three n'en dit rien.
  assert.match(FRAG_GLOBE, /uniform\s+float\s+uFondPasQ\s*;/,
    'sans déclaration, l uniforme est silencieusement mort')
})

// ══════════ ⑤ `_poserTextureFond` ÉCRIT LA CELLULE, DÉRIVÉE ═════════════════
//
// Même précédent que `test/fond-crop.test.js` ⑧ : `Globe.prototype.X.call(faux)`,
// parce que monter un `Globe` entier réclamerait le DOM.

function globeNu() {
  return {
    uniforms: {
      uCropOn: { value: 1 },
      uFondChamp: { value: null },
      uFondOn: { value: 0 },
      uFondPortee: { value: PORTEE_CROP },
      uFondMetres: { value: 1 },
      uFondPasQ: { value: 0 },
    },
    exaggeration: 2.8,
    _crop: repereCrop({ centre: { lat: -21.0845, lon: 55.2393 }, zoom: 12 }),
    _fondCrop: null,
    _cleFondPosee: '',
    tiles: new Map(),
    group: new THREE.Group(),
    gardeHauteurs: new Set(),
    _materialFor: () => new THREE.MeshBasicMaterial(),
    _parois: null,
    _baseYCrop: null,
    _poserTextureFond(f) { return Globe.prototype._poserTextureFond.call(this, f) },
    _refaireMaillagesDuFond() { return Globe.prototype._refaireMaillagesDuFond.call(this) },
  }
}

const remplirFactice = (profondeur = -1500) => (emprise, n, sortie) => {
  sortie.fill(profondeur)
  return { remplis: sortie.length, manquants: 0, bathy: true, sortie }
}

test('⑤ `poserFondCrop` écrit `uFondPasQ` = 2 × portée / N — pour TOUTE portée et TOUT N', () => {
  // ⚠️ **LES DEUX FACTEURS SONT BALAYÉS SÉPARÉMENT**, parce qu'une écriture qui
  // oublierait l'un des deux passerait un balayage sur l'autre. Un `champN`
  // explicite existe pour la mesure ; le produit n'en pose aucun.
  for (const portee of [1, 2, PORTEE_CROP, 5]) {
    for (const champN of [null, 96, 384, 1152]) {
      const g = globeNu()
      const r = Globe.prototype.poserFondCrop.call(g, { remplir: remplirFactice(), portee, champN })
      assert.equal(r.refus, null)
      const N = champN ?? CHAMP_FOND
      const attendu = (2 * portee) / N
      assert.ok(Math.abs(g.uniforms.uFondPasQ.value - attendu) < 1e-12,
        `portée ${portee}, N ${N} : uFondPasQ = ${g.uniforms.uFondPasQ.value}, attendu ${attendu}`)
      // et la cohérence avec la portée réellement posée : les deux uniformes
      // décrivent le MÊME champ, ou le pas dérive d'une autre emprise que la
      // lecture.
      assert.equal(g.uniforms.uFondPortee.value, portee)
      assert.equal(g.uniforms.uFondChamp.value.image.width, N + 1,
        'la texture et le pas doivent décrire la même grille')
    }
  }
})

test('⑤ bis `retirerFondCrop` REMET LE DÉPÔT — `uFondPasQ` retombe à zéro', () => {
  // ⚠️ Même raison que `uFondMetres` qui revient à 1 : un uniforme laissé
  // derrière ferait dériver le gradient d'une planète qui n'a plus de fond.
  const g = globeNu()
  g.retirerFondCrop = (arg) => Globe.prototype.retirerFondCrop.call(g, arg)
  Globe.prototype.poserFondCrop.call(g, { remplir: remplirFactice() })
  assert.ok(g.uniforms.uFondPasQ.value > 0)
  g.retirerFondCrop()
  assert.equal(g.uniforms.uFondPasQ.value, 0,
    'sans fond, le nuanceur doit retrouver `max(1 / uTilePx, 0)` — le pas de P12')
  assert.equal(g.uniforms.uFondOn.value, 0)
})

test('⑤ ter le DÉFAUT du constructeur est zéro — la planète sans crop est intouchée', () => {
  // ⚠️ **ASSERTION SUR LE TEXTE, ET ELLE EST DÉCLARÉE COMME TELLE** : monter un
  // `Globe` entier réclamerait le DOM (le §⑧ de `fond-crop.test.js` le dit).
  // Ce que les tests exécutables couvrent, eux, c'est ce que ce zéro PRODUIT :
  // le §② ci-dessus montre qu'à `uFondPasQ = 0` le pas est celui du dépôt.
  assert.match(SOURCE_GLOBE, /uFondPasQ:\s*\{\s*value:\s*0\s*\}/,
    'sans `poserFondCrop`, RIEN ne doit changer — même garde que `uFondOn`')
})

// ══════════ ⑥ LA CELLULE EN MÈTRES, CONTRE LE RELEVÉ DU BANC ════════════════

test('⑥ la cellule du champ vaut 214 m au sol à La Réunion z12 — le chiffre du banc', () => {
  // ⚠️ **LA CONVERSION, ÉCRITE** : le crop fait 3 tuiles z12, donc
  // `3 / 2^12` de tour de Mercator ; la calotte en fait `PORTEE_CROP` fois
  // autant ; un tour de Mercator vaut `40 075 016,686 × cos(latitude)` mètres de
  // sol. Divisé par `CHAMP_FOND` intervalles.
  const TOUR = 40075016.686
  const cosLat = Math.cos((-21.0845 * Math.PI) / 180)
  const largeurM = (3 / 2 ** Z) * PORTEE_CROP * TOUR * cosLat
  const celluleM = largeurM / CHAMP_FOND
  assert.ok(Math.abs(celluleM - 214.01) < 0.5,
    `cellule ${celluleM.toFixed(2)} m, relevé au banc 214,01 m`)
  // et le MNT du socle, sur le MÊME bloc : 1 536 px sur une largeur de crop
  const mntM = (largeurM / PORTEE_CROP) / 1536
  assert.ok(Math.abs(mntM - 17.83) < 0.1,
    `MNT du socle ${mntM.toFixed(2)} m, relevé au banc 17,83 m`)
})
