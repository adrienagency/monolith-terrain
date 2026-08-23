// LA PHOTO AÉRIENNE SUR LE CROP — Tâche R9 du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET POURQUOI IL EXISTE ════════════════
//
// Le bouton de photo aérienne (`ui/bars.js`) était **visible et inerte** sous
// `?terre=unique&frontiere=1` : toute la chaîne tournait — réseau compris — et
// s'arrêtait sur `terrain.setAerial`, c'est-à-dire sur le maillage plat, que la
// découpe sphérique rend invisible. Le branchement manquant est le dernier
// maillon, `contexteCrop → poserHabillage`.
//
// ⚠️⚠️ **LE RISQUE DE CETTE TÂCHE N'EST PAS LE CÂBLAGE, C'EST LE SENS DE LA
// PHOTO.** La mosaïque aérienne est une `CanvasTexture`, dont `flipY` vaut
// **true** (`map/aerial-layer.js` : « aucune des deux couches ne l'éteint,
// contrairement à tous les autres masques du projet qui posent
// `tex.flipY = false` »). Les champs cuits que le globe lit déjà — `uCoastMask`,
// `uAnalysis` — sont, eux, posés `flipY = false`. **Une photo lue avec le
// mauvais UV sort inversée nord-sud et passe tous les tests de câblage du
// monde.** C'est ce que ce fichier attrape, et c'est sa raison d'être.
//
// ══════════ COMMENT — LE SOCLE SERT D'ORACLE, PAS UNE FORMULE RECOPIÉE ══════
//
// ⑤ **traduit les deux chaînes GLSL — celle du globe ET celle du socle — et les
// EXÉCUTE l'une contre l'autre** sur une affine tirée d'`aerialUvTransform` DU
// DÉPÔT. Si les deux tombent sur le même texel pour un même point de la Terre,
// la photo est au bon endroit et dans le bon sens ; sinon elle ne l'est pas.
// Aucune constante n'est recopiée : la référence est le code de production du
// socle, qui, lui, est à l'écran depuis des mois.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, et que
// l'image obtenue ressemble à celle du socle. Seul l'écran le dit — c'est le
// compte rendu de la tâche
// (`.superpowers/sdd/2026-08-22-globe-studio/rapport-R9.md`).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { uvDrapeCrop, uvChampCrop, COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
import { CHAMPS_HABILLAGE } from '../src/monde/branchement-crop.js'
import { aerialUvTransform } from '../src/map/aerial-layer.js'

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const TERRAIN_SRC = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
const MAIN_SRC = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

/** Le fragment du globe, comme `crop-eclairage` et `crop-naturel` le découpent. */
const FRAG_GLOBE = GLOBE_SRC.slice(
  GLOBE_SRC.indexOf('const FRAG ='),
  GLOBE_SRC.indexOf('\nconst ', GLOBE_SRC.indexOf('const FRAG =') + 10)
)
/** ⚠️ SANS SES COMMENTAIRES — un commentaire n'est pas du code, et la Tâche K
 *  ter a trouvé une assertion verte parce qu'elle lisait une formule DANS un
 *  commentaire. */
const FRAG_NU = FRAG_GLOBE.replace(/\/\/[^\n]*/g, '')
const TERRAIN_NU = TERRAIN_SRC.replace(/\/\/[^\n]*/g, '')
const GLOBE_NU = GLOBE_SRC.replace(/\/\/[^\n]*/g, '')
const MAIN_NU = MAIN_SRC.replace(/\/\/[^\n]*/g, '')

/** Le bloc de lecture de la photo dans le fragment du globe. */
const BLOC_AERIEN = (() => {
  const i = FRAG_NU.indexOf('uAerialOn > 0.5')
  assert.ok(i > 0, 'le fragment du globe ne lit pas uAerialOn')
  return FRAG_NU.slice(i, FRAG_NU.indexOf('\n  }', i) + 4)
})()

// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════

/** Capture une expression du texte, ou échoue en NOMMANT ce qui manque. */
function capture(src, re, quoi) {
  const m = src.match(re)
  assert.ok(m, `introuvable dans le nuanceur : ${quoi}`)
  return m
}

/**
 * Traduit une expression GLSL scalaire en fonction JS des variables nommées.
 *
 * ⚠️ **`vec2(a, b)` DEVIENT UN COUPLE, ET `x`/`y` LE LISENT** : c'est tout ce
 * dont ces deux lignes-ci ont besoin, et une machine plus générale serait une
 * seconde implémentation de GLSL à tenir juste.
 */
function loi2(expr, noms) {
  const js = expr
    .replace(/\bvec2\s*\(/g, 'V2(')
    .replace(/([A-Za-z_][A-Za-z0-9_]*)\.x\b/g, '$1[0]')
    .replace(/([A-Za-z_][A-Za-z0-9_]*)\.y\b/g, '$1[1]')
  // eslint-disable-next-line no-new-func
  const f = new Function('V2', ...noms, `return ${js};`)
  const V2 = (a, b) => [a, b]
  return (...args) => f(V2, ...args)
}

/** Le produit/somme composante par composante que GLSL fait sur les vec2. */
const affine = (uv, offset, scale) => [offset[0] + uv[0] * scale[0], offset[1] + uv[1] * scale[1]]

// ══════════ ① LES UNIFORMES EXISTENT, ET AU REPOS ILS NE FONT RIEN ═════════

test('① les cinq uniformes sont déclarés dans le fragment ET dans this.uniforms', () => {
  // ⚠️ **DEUX LISTES, ET ELLES DOIVENT S'ACCORDER.** Un uniforme déclaré dans le
  // GLSL mais absent de `this.uniforms` n'est jamais posé (three ne le lie même
  // pas) ; l'inverse est un objet mort. Aucune erreur ne se lève dans les deux
  // cas.
  for (const [decl, nom] of [
    ['uniform sampler2D uAerial;', 'uAerial'],
    ['uniform float uAerialOn;', 'uAerialOn'],
    ['uniform float uAerialOpacity;', 'uAerialOpacity'],
    ['uniform vec2 uAerialOffset;', 'uAerialOffset'],
    ['uniform vec2 uAerialScale;', 'uAerialScale'],
  ]) {
    assert.ok(FRAG_NU.includes(decl), `le fragment ne déclare pas ${nom}`)
    assert.match(GLOBE_NU, new RegExp(`\\n\\s+${nom}: \\{ value:`), `this.uniforms ne porte pas ${nom}`)
  }
})

test('① au repos la photo est ÉTEINTE et sa texture est LÂCHÉE — la production est intouchée', async () => {
  // ⚠️ **MÊME GARDE ET MÊME RAISON QUE `uCropOn`, `uHabOn` ET `uSolOn`** : sans
  // `poserHabillage`, la vue orbitale en production doit rendre exactement ce
  // qu'elle rendait. Un défaut à 1 aurait peint la texture liée par three sur la
  // planète entière.
  assert.match(GLOBE_NU, /uAerialOn: \{ value: 0 \}/)
  assert.match(GLOBE_NU, /uAerial: \{ value: null \}/)
})

// ══════════ ② L'ORDRE DU MÉLANGE CONCORDE AVEC CELUI DU SOCLE ══════════════

test('② la photo passe APRÈS la peinture et AVANT l’apparence, les traits et la lumière', () => {
  // ⚠️ **C'EST L'ORDRE QUI SÉPARE UNE CARTE EN RELIEF D'UN VISUALISEUR
  // SATELLITE.** `terrain.js` l'écrit en toutes lettres : « over the hypsometric
  // paint but UNDER the contours, grid and labels below — so the drawn
  // cartography still sits on top of the photograph rather than being buried by
  // it. That ordering is most of what keeps this from becoming a plain satellite
  // viewer. » Le globe doit tenir la même suite, sinon les deux Terres ne se
  // ressemblent plus.
  const iAlbedo = FRAG_NU.indexOf('albedoCrop(col, uAlbedoBase')
  const iSol = FRAG_NU.indexOf('uSolOn > 0.5')
  const iAerien = FRAG_NU.indexOf('uAerialOn > 0.5')
  const iFx = FRAG_NU.indexOf('fxBlend(col, fxc, uFxBlend)')
  const iCote = FRAG_NU.indexOf('col = mix(col, uInk, cote * 0.55);')
  const iContour = FRAG_NU.indexOf('col = mix(col, uInk, contour);')
  const iLumiere = FRAG_NU.indexOf('vec3 colBloc = col * irradianceCrop(')
  assert.ok(iSol > 0 && iAerien > iSol, 'la photo passe AVANT l’occupation du sol')
  assert.ok(iAerien > iAlbedo, 'la photo passe AVANT que le bloc devienne un albédo')
  assert.ok(iFx > iAerien, 'l’apparence passe AVANT la photo — elle serait repeinte')
  assert.ok(iCote > iAerien, 'le trait de côte passe SOUS la photo')
  assert.ok(iContour > iCote, 'les courbes passent sous le trait de côte')
  assert.ok(iLumiere > iContour, 'la lumière ne multiplie plus en dernier')

  // ⚠️ **ET LE SOCLE TIENT BIEN CETTE SUITE-LÀ**, sinon c'est lui qui a changé
  // d'avis et ce test-ci verrouillerait une concordance périmée.
  const jAerien = TERRAIN_NU.indexOf('uAerialOn > 0.5')
  const jFx = TERRAIN_NU.indexOf('fxBlend(diffuseColor.rgb, fxc, uFxBlend)')
  assert.ok(jAerien > 0 && jFx > jAerien, 'le socle ne pose plus la photo avant l’apparence')
})

// ══════════ ③ LA MODULATION EST CELLE DU SOCLE, ÉVALUÉE ════════════════════

test('③ la photo MODULE la luminance de la peinture, elle ne l’écrase pas', () => {
  // ⚠️ **`0.6 + 0.8 x shade` N'EST PAS UN NOMBRE DÉCORATIF.** C'est ce qui laisse
  // l'ombrage et la rampe se lire À TRAVERS la photo. Le remplacer par la photo
  // nue (mix vers `aerien`) rendrait une image plate que rien d'autre ne
  // signalerait — et les deux valeurs sont ÉVALUÉES, pas cherchées par leur nom.
  const g = capture(BLOC_AERIEN, /aerien \* \(([^)]+)\)/, 'la modulation de la photo du globe')
  const s = capture(TERRAIN_NU, /aerial \* \(([^)]+)\)/, 'la modulation de la photo du socle')
  const fg = loi2(g[1], ['shadeA'])
  const fs = loi2(s[1], ['shade'])
  for (let i = 0; i <= 20; i++) {
    const x = i / 20
    assert.ok(Math.abs(fg(x) - fs(x)) < 1e-15, `la modulation diffère du socle en shade = ${x}`)
  }
  // et elle est bien une MODULATION : à peinture noire il reste 0,6 de photo, à
  // peinture blanche 1,4 — jamais 0, jamais la photo nue.
  assert.ok(Math.abs(fg(0) - 0.6) < 1e-15)
  assert.ok(Math.abs(fg(1) - 1.4) < 1e-15)

  // ⚠️ **ET LA LUMINANCE EST LA MÊME REC.601, SUR LA MÊME ENTRÉE** : la couleur
  // DÉJÀ peinte. La prendre sur la photo aurait fait une boucle sur elle-même.
  assert.match(BLOC_AERIEN, /float shadeA = dot\(col, vec3\(0\.299, 0\.587, 0\.114\)\);/)
  assert.match(TERRAIN_NU, /float shade = dot\(diffuseColor\.rgb, vec3\(0\.299, 0\.587, 0\.114\)\);/)
})

// ══════════ ④ LES DEUX GARDES, ET LA FRONTIÈRE DU BLOC ═════════════════════

test('④ la photo ne peint QUE la découpe, et pas seulement quand l’éclairage est allumé', () => {
  // ⚠️ **`dedansCrop` ET NON `partBloc`.** `partBloc` vaut
  // `uEclairageOn > 0.5 ? dedansCrop : 0.0` : borner la photo à lui l'éteindrait
  // avec l'éclairage du crop, alors que la photo est une couche de CARTE. Et
  // `dedansCrop` vaut zéro hors découpe, donc la planète reste intouchée.
  assert.match(BLOC_AERIEN, /uAerialOn > 0\.5 && uAerialOpacity > 0\.001 && dedansCrop > 0\.0/)
  assert.ok(!/partBloc/.test(BLOC_AERIEN), 'la photo est bornée à partBloc — elle s’éteindra avec l’éclairage')
  assert.match(BLOC_AERIEN, /uAerialOpacity \* dedansCrop\)/)
})

// ══════════ ⑤ ⚡ LE SENS DE LA PHOTO — LE SOCLE SERT D'ORACLE ═══════════════

test('⑤a l’UV de la photo ÉGALE uvDrapeCrop — le retournement compris, sur 441 points', () => {
  // ⚠️ **MUTATION QUI SURVIVRAIT À TOUT LE RESTE DE CE FICHIER** : le
  // retournement en y perdu. La photo à l'envers nord-sud, et rien qui lève
  // d'erreur. C'est la MÊME loi que l'occupation du sol emploie — les deux
  // couches sont des mosaïques de tuiles Web Mercator drapées.
  const m = capture(FRAG_NU, /vec2 aUv = (vec2\([^;]+\));/, 'l’UV drapé de la photo aérienne')
  const f = loi2(m[1], ['qCrop'])
  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const q = [i / 10, j / 10]
      const attendu = uvDrapeCrop(q[0], q[1])
      const vu = f(q)
      assert.ok(Math.abs(vu[0] - attendu.x) < 1e-15, `x en (${q[0]}, ${q[1]})`)
      assert.ok(Math.abs(vu[1] - attendu.y) < 1e-15, `y en (${q[0]}, ${q[1]})`)
    }
  }
  // ⚠️ **ET CE N'EST PAS L'AUTRE FAMILLE.** Hors de l'équateur du crop, l'UV
  // drapé et l'UV des champs CUITS diffèrent en y — c'est exactement l'écart qui
  // retourne la photo.
  assert.notEqual(f([0, 0.6])[1], uvChampCrop(0, 0.6).y)
  assert.equal(Math.abs(f([0, 0.6])[1] - uvChampCrop(0, 0.6).y).toFixed(1), '0.6')
})

test('⑤b l’affine passe APRÈS le retournement — les deux NE COMMUTENT PAS', () => {
  // ⚠️ **C'EST LE DOSSIER D'`aerialUvTransform`, ET IL A COÛTÉ 131 km.** « Un
  // retournement et une affine NE COMMUTENT PAS : c'est pour ça que
  // `aerialUvTransform` mesure son offset vertical depuis le bord SUD de la
  // grille de tuiles, et pas depuis son nord. » L'offset rendu par le dépôt
  // suppose donc que le retournement est DÉJÀ fait quand il s'applique.
  const iFlip = BLOC_AERIEN.indexOf('vec2 aUv = vec2(')
  const iAffine = BLOC_AERIEN.indexOf('aUv = uAerialOffset + aUv * uAerialScale;')
  const iLecture = BLOC_AERIEN.indexOf('texture2D(uAerial, aUv)')
  assert.ok(iFlip >= 0 && iAffine > iFlip, 'l’affine est posée AVANT le retournement')
  assert.ok(iLecture > iAffine, 'la photo est lue AVANT que l’affine soit posée')
  // et le socle enchaîne bien dans cet ordre-là, lui aussi
  const jDrape = TERRAIN_NU.indexOf('vec2 aUv = uvSolDrape(aIn);')
  const jAffine = TERRAIN_NU.indexOf('aUv = uAerialOffset + aUv * uAerialScale;')
  assert.ok(jDrape > 0 && jAffine > jDrape, 'le socle a changé l’ordre des deux')
  assert.match(TERRAIN_NU, /uv\.y = 1\.0 - uv\.y;/) // le retournement vit DANS uvSolDrape
})

test('⑤c ⚡ pour un même point de la Terre, le globe et le socle tombent sur le MÊME texel de la MOSAÏQUE', () => {
  // ⚠️⚠️ **C'EST L'ASSERTION QUI DÉCIDE DE LA TÂCHE.** Les deux chaînes GLSL sont
  // TRADUITES ET EXÉCUTÉES l'une contre l'autre, sur une affine tirée
  // d'`aerialUvTransform` DU DÉPÔT — pas d'un couple choisi pour arranger le
  // test. Le socle est à l'écran depuis des mois : il sert d'oracle.
  //
  // La chaîne du socle est `uvSolDrape` — `(champXZ() - uBlockOffset) / uMaskSpan
  // + 0.5`, puis `uv.y = 1 - uv.y` — hors mode continu, donc `uBlockOffset = 0`
  // et `uMaskSpan = 2 x uSlabHalf = 56`. Celle du globe part de `qCrop`, et
  // `x = 28 q.x`, `z = 28 q.y` (démontré en tête de `monde/habillage-crop.js`,
  // rejoué contre `latLonToWorld` par `test/crop-habillage.test.js` ③).
  const mGlobe = capture(FRAG_NU, /vec2 aUv = (vec2\([^;]+\));/, 'l’UV drapé de la photo aérienne')
  const fGlobe = loi2(mGlobe[1], ['qCrop'])

  // l'affine du dépôt, sur une emprise réelle : un bloc autour d'Annecy, et une
  // grille de tuiles qui DÉBORDE du bloc — le cas où l'offset n'est pas nul, et
  // donc le seul qui puisse distinguer les deux sens.
  const patch = { minLon: 6.05, maxLon: 6.25, minLat: 45.82, maxLat: 45.96 }
  const grille = { minX: 0.5155, maxX: 0.5180, minY: 0.3405, maxY: 0.3430 }
  const uv = aerialUvTransform(patch, grille)
  const offset = uv.offset
  const scale = uv.scale
  assert.ok(Math.abs(offset[1]) > 1e-6, 'l’offset vertical est nul : ce cas ne distingue rien')

  // la chaîne du socle, en nombres
  const demi = COTE_CROP_UNITES / 2 // 28
  const socle = (q) => {
    const x = demi * q[0]
    const z = demi * q[1]
    let u = x / COTE_CROP_UNITES + 0.5
    let v = z / COTE_CROP_UNITES + 0.5
    v = 1 - v // uvSolDrape : « les lignes de texture vont nord→sud, le +Z du monde va sud→nord »
    return affine([u, v], offset, scale)
  }

  let ecartMax = 0
  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const q = [i / 10, j / 10]
      const a = affine(fGlobe(q), offset, scale)
      const b = socle(q)
      ecartMax = Math.max(ecartMax, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))
    }
  }
  assert.ok(ecartMax < 1e-15, `le globe et le socle divergent de ${ecartMax} en UV de mosaïque`)

  // ⚠️ **ET LA MUTATION EST NOMMÉE : SANS LE RETOURNEMENT, ÇA DIVERGE.** Sans
  // cette contre-épreuve, l'assertion ci-dessus serait verte pour un test qui ne
  // compare rien.
  const sansFlip = (q) => affine([q[0] * 0.5 + 0.5, q[1] * 0.5 + 0.5], offset, scale)
  let ecartFaux = 0
  for (let j = -10; j <= 10; j++) {
    const q = [0, j / 10]
    ecartFaux = Math.max(ecartFaux, Math.abs(sansFlip(q)[1] - socle(q)[1]))
  }
  assert.ok(ecartFaux > 1e-3, 'la photo sans retournement tomberait au même endroit — le test ne prouve rien')
})

// ══════════ ⑥ LE BRANCHEMENT — LA FAIBLESSE RÉCURRENTE DE CE CHANTIER ══════

test('⑥a `contexteCrop` lit l’INTERRUPTEUR du socle, pas la texture seule', () => {
  // ⛔ **`terrain.setAerial(null)` NE TOUCHE QUE `uAerialOn`** : la texture reste
  // liée. Passer `uAerial.value` sans la garde donnerait au globe une texture
  // toujours vraie, et **la photo ne s'éteindrait jamais**.
  assert.match(MAIN_NU, /const aerien = terrain\.mapUniforms\.uAerialOn\.value > 0\.5 \? terrain\.mapUniforms\.uAerial\.value : null/)
  assert.match(MAIN_NU, /\n\s+aerial: aerien,/)
  assert.match(MAIN_NU, /aerialOpacite: terrain\.mapUniforms\.uAerialOpacity\.value,/)
  assert.match(MAIN_NU, /aerialOffset: terrain\.mapUniforms\.uAerialOffset\.value,/)
  assert.match(MAIN_NU, /aerialScale: terrain\.mapUniforms\.uAerialScale\.value,/)
})

test('⑥b la veille SURVEILLE la photo — sinon le bouton reste inerte à l’œil', () => {
  // ⛔ **C'EST LA COURSE DE LA TÂCHE K ter, AGGRAVÉE D'UN ALLER-RETOUR RÉSEAU.**
  // L'habillage n'est reposé QUE lorsqu'un champ surveillé change. La mosaïque
  // arrive du réseau, longtemps après la naissance du crop, et l'utilisateur
  // l'allume quand il veut : absente de cette liste, elle ne serait vue qu'au
  // prochain changement de LIEU.
  assert.ok(CHAMPS_HABILLAGE.includes('aerial'), 'la photo n’est pas surveillée')
  assert.ok(CHAMPS_HABILLAGE.includes('aerialOpacite'), 'la tirette d’opacité n’est pas surveillée')
  // ⚠️ **ET LES DEUX VECTEURS N'Y SONT PAS**, même exemption que
  // `solOffset` / `solScale` : `terrain.setAerial` les MUTE EN PLACE, donc leur
  // identité ne bouge jamais et `Object.is` — la seule comparaison de ce module —
  // ne les verrait jamais changer.
  assert.ok(!CHAMPS_HABILLAGE.includes('aerialOffset'))
  assert.ok(!CHAMPS_HABILLAGE.includes('aerialScale'))
})

test('⑥c `poserHabillage` allume par l’ABSENCE DE DONNÉE, et `retirerHabillage` LÂCHE la texture', () => {
  // ⚠️ **UN SEUL INTERRUPTEUR, ET IL EST L'ABSENCE DE DONNÉE** — le patron de
  // `coastMask` et de `sol`. Et la texture est LÂCHÉE au retrait, pas seulement
  // débranchée : une mosaïque aérienne pèse plusieurs milliers de pixels de côté
  // et vit dans un uniforme PARTAGÉ par tous les matériaux de tuile.
  assert.match(GLOBE_NU, /u\.uAerial\.value = aerial\n\s+u\.uAerialOn\.value = aerial \? 1 : 0/)
  assert.match(GLOBE_NU, /u\.uAerial\.value = null\n\s+u\.uAerialOn\.value = 0/)
  assert.match(GLOBE_NU, /u\.uAerialOffset\.value\.set\(0, 0\)/)
  assert.match(GLOBE_NU, /u\.uAerialScale\.value\.set\(1, 1\)/)
})
