// LES PAROIS ET LA BASE DU CROP — Tâche B du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// La Tâche A a livré la découpe : les tuiles du globe sont coupées à la forme du
// crop par un `discard` en lat/lon. **Le crop est donc une peau flottante.** Il
// lui manque ses parois et sa base ; c'est l'objet de cette tâche.
//
// Trois choses se vérifient ici, et une quatrième ne le peut pas :
//
//   ① LE SOLIDE EST FERMÉ — `auditerSolide` (`monde/audit-solide.js`) rend
//      `‖Ā‖ < ε`. ⚠️ **Et l'audit se fait sur les sommets LIVRÉS**, parois et
//      fond, refermés par un couvercle-témoin qui partage EXACTEMENT leur
//      anneau : un mur manquant, un fond absent ou un anneau qui ne coïncide
//      plus font monter Ā, quelle que soit l'origine.
//   ② LA GÉOMÉTRIE OBÉIT À LA DÉCISION 2 D'ADRIEN — parois **verticales et
//      parallèles**, base **de la même taille que le dessus**, base **plate**.
//   ③ LA FORME EST LA MÊME QUE CELLE DE LA SURFACE — la superellipse exacte de
//      `dansDalle`, **pas** l'octogone circonscrit de `dansFenetre`. ⚠️ **Et le
//      test est posé à 44,3°, PAS à 45°** : voir le §« l'angle » plus bas.
//   ④ CE QUI RESTE HORS DE PORTÉE : que le GPU exécute la couverture douce.
//      Le nuanceur est vérifié comme TEXTE, patron de `crop-sphere.test.js` et
//      de `fenetre-coin-exposant.test.js`. Seul l'écran dit le reste, et
//      l'Étape 7 de la tâche est là pour ça.
//
// ══════════ L'ANGLE — POURQUOI 44,3° ET PAS 45° ════════════════════════════
//
// ⚠️ **L'ÉCART ENTRE LA SUPERELLIPSE ET SON OCTOGONE CIRCONSCRIT EST NUL À 45°**
// — le plan diagonal y est tangent, mesuré à 1,4·10⁻¹⁴ par la Tâche A. **Un test
// de forme posé à 45° ne distingue donc PAS les deux lois.** Il est maximal à
// **44,3°, où il vaut 0,129 unité, soit 23,9 m au sol** à `ZOOM_SOCLE`.
//
// Les deux faits sont rejoués ici, en tête de fichier, **avant** de servir : le
// test ⑦ les mesure et les affirme. Un anneau retracé sur l'octogone tombe sur
// l'assertion « chaque point de l'anneau est SUR la frontière de `dansDalle` »,
// parce qu'à 44,3° l'octogone est 0,129 unité DEHORS.
//
// ══════════ LE PIÈGE QUE LE PLAN NOMME, ET CE QU'IL EN COÛTE ═══════════════
//
// ⚠️ **`hauteurs.distinctes > 2` NE MORD PAS ICI, ET C'EST MESURÉ.** Le plan le
// prescrit — il vient de la Tâche 6 du chantier précédent, où un pavé droit à
// hauteurs nulles serait passé cent fois. Rejoué contre CE solide-ci : **un crop
// à relief RIGOUREUSEMENT NUL rend déjà des centaines de hauteurs distinctes**,
// parce que la nappe suit la SPHÈRE et que la sagitta du crop (2,1 m sur
// 10,4 km, §3 du plan) est cinq ordres de grandeur au-dessus du quantum de
// l'audit. L'assertion est gardée — elle est au plan, et elle attrape un
// couvercle plat — mais **elle est doublée d'une assertion qui, elle, mord** :
// l'amplitude verticale du solide à relief doit dépasser celle du solide plat
// d'un facteur mesuré. Les deux chiffres sont relevés par le test ⑤.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  contourCrop,
  construireSolideCrop,
  normalesParois,
  occlusionContact,
  FRACTION_PROFONDEUR,
  FRACTION_CHANFREIN,
  FRACTION_ARRONDI,
  ARRONDI_SEG,
  PART_MUR_MAX,
  PAS_CONTOUR,
  rabattementBorne,
} from '../src/monde/parois-crop.js'
import { repereCrop, coinNormalise, latLonDeLocal, localCrop } from '../src/monde/crop-sphere.js'
// ⚠️ ON APPELLE LES MÉTHODES DU GLOBE PAR `.call` SUR UN OBJET MINIMAL, patron
// de `test/globe-precision.test.js` : monter un `Globe` réclamerait le DOM.
import { Globe, sampleHeights } from '../src/globe.js'
import { auditerSolide } from '../src/monde/audit-solide.js'
import { dansDalle } from '../src/damier-bords.js'
import { dansFenetre, exposantCoin } from '../src/fenetre-clip.js'
import { ZOOM_SOCLE, LARGEUR_SOCLE_M } from '../src/monde/seuil-socle.js'
import {
  contactAO, bandeContact, SOCLE_AO_BANDE, SOCLE_AO_FORCE,
  SOCLE_CHANFREIN, SOCLE_ARRONDI, SOCLE_ARRONDI_SEG, SOCLE_MARGE_EAU,
} from '../src/plinth.js'
import { RETRAIT_EAU_CROP } from '../src/monde/mer-sphere.js'
import { COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
import * as THREE from 'three'
import { tileToLatLon, R_GLOBE, EARTH_RADIUS_M } from '../src/geo.js'

// Les réglages par défaut du produit — `main.js:588` et `main.js:590`, les mêmes
// que ceux dont `test/crop-sphere.test.js` se sert.
const HALF = 28
const CORNER = 0.04 * 56 // slabCorner × TERRAIN_SIZE, borné par plinth.js:855
const EXPO = exposantCoin(0.6) // slabCornerSmoothing = 0,6 → 4,4
const COIN = coinNormalise(CORNER, HALF) // le rayon, en fraction du demi-côté

// Le repère du globe, tel que `globe.js` le pose. R_GLOBE = 100 pour 6 371 km.
const RAYON = 100
const RAYON_TERRE_M = 6371000
const EXAG = 18 // `globe.js`, `params.globeExaggeration ?? 18`
const ECHELLE = (RAYON / RAYON_TERRE_M) * EXAG // unités par mètre d'altitude

const CENTRE = { lat: 45, lon: 6.25 } // la station du protocole A (bilan-4-quater)
const REPERE = repereCrop({ centre: CENTRE })
const FORME = { coin: COIN, expo: EXPO }

// ── les deux champs de relief du banc ──────────────────────────────────────
//
// ⚠️ SYNTHÉTIQUES ET DÉTERMINISTES, ET C'EST DÉLIBÉRÉ : un test qui lit le
// réseau ne mesure pas une géométrie, il mesure une connexion. Le champ « relief
// » a une pente forte et une composante à courte longueur d'onde, pour que
// l'écart entre « la surface exacte au point de coupe » et « le nœud de grille
// le plus proche » soit LISIBLE — c'est le liseré que l'Étape 3 de la tâche
// annonce.
const relief = (lat, lon) =>
  1200 + 900 * Math.sin((lon - CENTRE.lon) * 700) + 700 * Math.cos((lat - CENTRE.lat) * 820)
const plat = () => 0

// Le témoin de l'accrochage : la même loi, mais lue au nœud le plus proche d'une
// grille de tuiles z13 à 512 px — exactement ce que « le sommet de tuile le plus
// proche » veut dire.
const PAS_NOEUD = 1 / (2 ** ZOOM_SOCLE * 512)
const reliefAccroche = (lat, lon) => {
  const { u, v } = localCrop(lat, lon, REPERE)
  const mu = Math.round((REPERE.cx + u * REPERE.demi) / PAS_NOEUD) * PAS_NOEUD
  const mv = Math.round((REPERE.cy + v * REPERE.demi) / PAS_NOEUD) * PAS_NOEUD
  const p = latLonDeLocal((mu - REPERE.cx) / REPERE.demi, (mv - REPERE.cy) / REPERE.demi, REPERE)
  return relief(p.lat, p.lon)
}

const commun = { repere: REPERE, forme: FORME, rayon: RAYON, echelle: ECHELLE }
const SOLIDE = construireSolideCrop({ ...commun, hauteur: relief })
const SOLIDE_PLAT = construireSolideCrop({ ...commun, hauteur: plat })

/** L'audit du solide COMPLET : parois + fond + couvercle-témoin. */
function auditer(s) {
  const idx = new Uint32Array(s.indices.length + s.indicesCouvercle.length)
  idx.set(s.indices)
  idx.set(s.indicesCouvercle, s.indices.length)
  return auditerSolide({ geometrie: s.positions, indices: idx, axeHauteur: 'y' })
}

// ══════════ ① LE SOLIDE EST FERMÉ ═══════════════════════════════════════════

test('LE SOLIDE EST FERMÉ — ‖Ā‖ sous le seuil, et orienté vers le dehors', () => {
  const v = auditer(SOLIDE)
  assert.equal(v.vide, false, 'l audit ne voit rien : il n y a pas de géométrie')
  assert.equal(v.nan, false)
  assert.equal(v.indicesInvalides, 0)
  assert.equal(v.degeneres, 0, `${v.degeneres} triangle(s) dégénéré(s)`)
  assert.equal(v.ferme, true, `non fermé : ‖Ā‖/aire = ${v.fermetureRelative}`)
  // ⚠️ **LE VOLUME RESTE, EN PLUS** (§1 d'`audit-solide.js`) : Ā est nulle sur un
  // solide RETOURNÉ, et lui seul l'attrape. Une paroi bâtie à l'envers passerait
  // la fermeture et se dessinerait de dos.
  assert.equal(v.oriente, true, `volume signé ${v.volume} : le solide est retourné`)
  assert.equal(v.sain, true, v.raison)
})

test('le solide PLAT est fermé lui aussi — la fermeture ne dépend pas du relief', () => {
  const v = auditer(SOLIDE_PLAT)
  assert.equal(v.sain, true, v.raison)
})

// ══════════ ② LES MUTATIONS, POSÉES POUR DE BON ═════════════════════════════
//
// ⚠️ Étape 6 de la tâche. Elles sont ÉCRITES ici plutôt que passées à la main :
// une mutation qu'on retire ne protège plus rien le lendemain.

test('MUTATION — retirer UNE paroi tue la fermeture', () => {
  // le premier quad de mur : deux triangles, six indices
  const s = SOLIDE
  const idx = new Uint32Array(s.indices.length + s.indicesCouvercle.length - 6)
  idx.set(s.indices.subarray(6))
  idx.set(s.indicesCouvercle, s.indices.length - 6)
  const v = auditerSolide({ geometrie: s.positions, indices: idx, axeHauteur: 'y' })
  assert.equal(v.ferme, false, 'un mur en moins et l audit dit encore « fermé » : il ne mesure rien')
  assert.ok(v.fermetureRelative > 1e-6, `écart de fermeture ${v.fermetureRelative} : trop petit pour être vu`)
})

test('MUTATION — retirer le FOND tue la fermeture', () => {
  const s = SOLIDE
  const idx = new Uint32Array(s.compte.parois * 3 + s.indicesCouvercle.length)
  idx.set(s.indices.subarray(0, s.compte.parois * 3))
  idx.set(s.indicesCouvercle, s.compte.parois * 3)
  const v = auditerSolide({ geometrie: s.positions, indices: idx, axeHauteur: 'y' })
  assert.equal(v.ferme, false, 'le fond absent passe pour sain')
})

test('MUTATION — les parois RETOURNÉES passent la fermeture et tombent sur le volume', () => {
  // ⚠️ LA DÉMONSTRATION DU §1 D'`audit-solide.js`, rejouée sur CE solide :
  // retourner toutes les faces change le signe de chaque terme d'une somme déjà
  // nulle. Ā ne bouge pas ; seul le volume signé le voit.
  //
  // ⚠️ **ET IL FAUT DIRE CE QUE CET INVARIANT NE DÉFEND PAS : LE RENDU LE
  // NEUTRALISE.** `globe.js` pose les parois en `DoubleSide` et retourne la
  // normale par `gl_FrontFacing` — un solide retourné se dessine donc **au pixel
  // près comme le bon**. `DoubleSide` est voulu (la caméra entre dans le bloc
  // pendant la descente) et le motif est écrit devant `_materiauParois`.
  // L invariant garde son sens ailleurs : la carte d ombre (`castShadow` sur le
  // socle) et l export de fichiers d impression consomment le sens de parcours,
  // et surtout **un audit qui accepte un solide retourné n est pas un audit**.
  const s = SOLIDE
  const tout = new Uint32Array(s.indices.length + s.indicesCouvercle.length)
  tout.set(s.indices)
  tout.set(s.indicesCouvercle, s.indices.length)
  const envers = new Uint32Array(tout.length)
  for (let t = 0; t < tout.length; t += 3) {
    envers[t] = tout[t]
    envers[t + 1] = tout[t + 2]
    envers[t + 2] = tout[t + 1]
  }
  const v = auditerSolide({ geometrie: s.positions, indices: envers, axeHauteur: 'y' })
  assert.equal(v.ferme, true, 'retourner un solide ne crée aucun bord libre — c est le point')
  assert.equal(v.oriente, false, 'le volume signé ne voit pas le retournement')
  assert.equal(v.sain, false)
})

// ══════════ ③ LA DÉCISION 2 D'ADRIEN — VERTICALES, PARALLÈLES, MÊME TAILLE ══

/** L'étendue horizontale d'un rang du profil. */
function etendueRang(s, r) {
  const n = s.compte.anneau
  const { positions } = s
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (let k = 0; k < n; k++) {
    const p = (r * n + k) * 3
    x0 = Math.min(x0, positions[p]); x1 = Math.max(x1, positions[p])
    z0 = Math.min(z0, positions[p + 2]); z1 = Math.max(z1, positions[p + 2])
  }
  return { largeur: x1 - x0, profondeur: z1 - z0 }
}

test('LES PAROIS SONT VERTICALES ET PARALLÈLES — pas radiales', () => {
  // ⚠️ **LA DÉCISION D'ADRIEN, ET ELLE PRIME SUR LA JUSTESSE PHYSIQUE.** Dans le
  // repère local du crop, `y` EST la verticale (le rayon au centre du crop) :
  // une paroi verticale a donc, sur toute sa hauteur, exactement les mêmes `x` et
  // `z`. Des parois RADIALES les feraient converger vers le centre de la
  // planète, et l'écart serait de `profondeur / rayon` — mesuré plus bas.
  //
  // ⚠️ **CE QUE LA TÂCHE P13 A CHANGÉ, ET CE QU'ELLE N'A PAS CHANGÉ.** Le mur
  // ne part plus du rang 0 (la surface) mais du rang 1 (le pied du chanfrein) ;
  // il court du rang 1 au rang `rangArc`, c'est-à-dire au départ du congé. **Sur
  // toute cette hauteur l'empreinte est IDENTIQUE AU BIT** — c'est ce que la
  // décision 2 interdit de perdre, et c'est plus exigeant qu'avant, parce que le
  // test porte maintenant sur TROIS rangs au lieu de deux.
  const { positions, anneau, rangArc } = SOLIDE
  const n = anneau.length
  let pire = 0
  for (let r = 2; r <= rangArc; r++) {
    for (let k = 0; k < n; k++) {
      const a = (n + k) * 3
      const b = (r * n + k) * 3
      pire = Math.max(pire, Math.abs(positions[a] - positions[b]), Math.abs(positions[a + 2] - positions[b + 2]))
    }
  }
  assert.equal(pire, 0, `l empreinte se déplace de ${pire} unité le long du mur`)
  // et le mur porte bien de la hauteur : un test sur des rangs confondus ne
  // prouverait rien
  const hautMur = positions[(n + 0) * 3 + 1] - positions[(rangArc * n) * 3 + 1]
  assert.ok(hautMur > 0, `le mur est de hauteur nulle : ${hautMur}`)
})

test('LA BASE EST PLATE, ET SON RETRAIT EST CELUI DU SOCLE — pas une convergence radiale', () => {
  const { positions, anneau, baseY, rangs, chanfrein, arrondi, largeur } = SOLIDE
  const n = anneau.length
  // plate : tous les sommets du DERNIER rang sont exactement à `baseY`.
  // ⚠️ `Math.fround` parce que `positions` est un Float32Array : sans lui
  // l'assertion mesurerait l'arrondi du tampon, pas la planéité du fond.
  const plancher = Math.fround(baseY)
  const dernier = rangs - 1
  for (let k = 0; k < n; k++) {
    assert.equal(positions[(dernier * n + k) * 3 + 1], plancher, `le sommet bas ${k} n est pas sur le plan de base`)
  }
  // ⚠️ **CE QUE LA DÉCISION 2 INTERDIT RESTE INTERDIT, ET CE QUE LE SOCLE FAIT
  // EST DÉSORMAIS FAIT.** La base rentre de `chanfrein + congé` — un retrait
  // CONSTANT, le même que celui du socle d'Adrien — et surtout PAS de la
  // convergence radiale, qui serait proportionnelle à la profondeur.
  //
  // ⚠️ **LE RETRAIT SE MESURE PAR SOMMET, PAS SUR LA BOÎTE ENGLOBANTE, ET
  // L'ÉCART EST INSTRUCTIF.** Sur la boîte, le relevé rend **2,836·10⁻³** au
  // lieu de **3,104·10⁻³** — non parce que le retrait varie, mais parce que le
  // MAXIMUM en `x` change de sommet entre les deux rangs : le côté du crop est
  // presque plat dans le repère local (la projection sphérique le courbe à
  // peine), et l'argmax glisse de 24 points pour un écart de 3·10⁻⁵ d'altitude
  // horizontale. **Une assertion sur la boîte aurait mesuré ce glissement et
  // l'aurait imputé à la bissectrice.**
  //
  // ⚠️ **ET C'EST UN RETRAIT PERPENDICULAIRE, PAS UNE LONGUEUR DE DÉPLACEMENT —
  // C'EST TOUT L'OBJET DE L'ONGLET.** La bissectrice est allongée de
  // `1/cos(θ/2)` pour que la rentrée PERPENDICULAIRE vaille `d` sur les DEUX
  // faces voisines ; le déplacement, lui, vaut `d/cos(θ/2)` et dépasse donc `d`
  // dans les coins — relevé **+1,07 % au pire**, soit un angle de 16,7° au
  // raccord du côté droit et de l'arc. **Une assertion sur la longueur du
  // déplacement aurait pris l'onglet pour une erreur ; c'est la mesure
  // perpendiculaire qui décrit ce que le mur fait.** Sans onglet, un coin droit
  // se creuserait d'un cran de `d·(1 − 1/√2)`, soit 29 %.
  const normaleSeg = (a, b) => {
    const dx = positions[b * 3] - positions[a * 3]
    const dz = positions[b * 3 + 2] - positions[a * 3 + 2]
    const L = Math.hypot(dx, dz)
    return [-dz / L, dx / L] // vers le DEDANS (cf. §③ bis de parois-crop.js)
  }
  let pirePerp = 0
  let pireDeplacement = 0
  for (let k = 0; k < n; k++) {
    const p = (k - 1 + n) % n
    const s = (k + 1) % n
    const ox = positions[(dernier * n + k) * 3] - positions[k * 3]
    const oz = positions[(dernier * n + k) * 3 + 2] - positions[k * 3 + 2]
    pireDeplacement = Math.max(pireDeplacement, Math.hypot(ox, oz))
    for (const [a, b] of [[p, k], [k, s]]) {
      const nn = normaleSeg(a, b)
      pirePerp = Math.max(pirePerp, Math.abs(ox * nn[0] + oz * nn[1] - (chanfrein + arrondi)))
    }
  }
  // ⚠️ **LE SEUIL EST LE QUANTUM DU TAMPON, PAS UN CONFORT.** `positions` est un
  // `Float32Array` : à la magnitude de ces coordonnées (~0,082 unité) le pas
  // représentable vaut `2⁻²³ × 0,082 ≈ 9,8·10⁻⁹`. Le résidu relevé est
  // **7,97·10⁻⁹** — l'arrondi du tampon, et rien d'autre. Un seuil plus serré
  // mesurerait le `Float32`, pas la géométrie.
  assert.ok(pirePerp < 3e-8,
    `la rentrée perpendiculaire s écarte de ${pirePerp} de chanfrein + congé (${chanfrein + arrondi})`)
  assert.ok(pireDeplacement > chanfrein + arrondi,
    'le déplacement ne dépasse jamais la rentrée : l onglet ne fait rien, le test ne prouve rien')
  const retraitMesure = chanfrein + arrondi
  // et la base est STRICTEMENT plus petite que le dessus, sur les DEUX axes
  const haut = etendueRang(SOLIDE, 0)
  const bas = etendueRang(SOLIDE, dernier)
  assert.ok(bas.largeur < haut.largeur && bas.profondeur < haut.profondeur,
    `la base ne rentre pas : ${JSON.stringify({ haut, bas })}`)
  // ⚡ ET LES PROPORTIONS SONT CELLES DU SOCLE, pas des nombres d'ici :
  // 2 × 0,16 / 56 = 0,571 % pour le chanfrein, 2 × 0,9 / 56 = 3,214 % pour le congé
  assert.ok(Math.abs((2 * chanfrein) / largeur - (2 * SOCLE_CHANFREIN) / 56) < 1e-9)
  assert.ok(Math.abs((2 * arrondi) / largeur - (2 * SOCLE_ARRONDI) / 56) < 1e-9)
  // ⚠️ **LE TÉMOIN RADIAL — ET IL NE SE DISTINGUE PAS PAR SA TAILLE, IL SE
  // DISTINGUE PAR SA DÉPENDANCE.** Au relevé, la convergence radiale vaudrait
  // **1,323·10⁻³** contre un retrait de **3,104·10⁻³** : même ordre de grandeur,
  // rapport 2,35. **Un test qui les séparerait par un seuil ne prouverait rien.**
  // Ce qui les sépare, c'est que le retrait du chanfrein est CONSTANT et que la
  // convergence radiale est PROPORTIONNELLE À LA PROFONDEUR. On triple donc la
  // profondeur : le retrait ne bouge pas, le témoin radial triple.
  const radial = haut.largeur * ((SOLIDE.hautMax - baseY) / RAYON)
  assert.ok(radial > 1e-6, `le témoin radial est trop petit pour valoir preuve : ${radial}`)
  // ⚠️ **SUR LE SOLIDE PLAT, PARCE QUE LÀ LE MUR EST EXACTEMENT LA PROFONDEUR.**
  // Sur le relief, `hautMax − baseY` est dominé par l'amplitude du terrain
  // (0,808 pour 0,020 de profondeur à ×18) : tripler la profondeur n'y bougerait
  // le témoin que de 5 %, et le test ne mesurerait pas ce qu'il annonce.
  const creux = construireSolideCrop({ ...commun, hauteur: plat, fractionProfondeur: FRACTION_PROFONDEUR * 3 })
  const radialPlat = etendueRang(SOLIDE_PLAT, 0).largeur * ((SOLIDE_PLAT.hautMax - SOLIDE_PLAT.baseY) / RAYON)
  const radialCreux = etendueRang(creux, 0).largeur * ((creux.hautMax - creux.baseY) / RAYON)
  assert.ok(radialCreux / radialPlat > 2.9,
    `le témoin radial ne suit pas la profondeur (${radialPlat} → ${radialCreux}) : il ne témoigne de rien`)
  const retraitPlat = SOLIDE_PLAT.chanfrein + SOLIDE_PLAT.arrondi
  const retraitCreux = creux.chanfrein + creux.arrondi
  assert.ok(Math.abs(retraitCreux - retraitPlat) / retraitPlat < 1e-3,
    `le retrait suit la profondeur (${retraitPlat} → ${retraitCreux}) : ce n est pas un chanfrein, c est une convergence`)
})

// ══════════ ④ LA PAROI S'APPUIE SUR LA SURFACE EXACTE AU POINT DE COUPE ═════

const SOLIDE_ACCROCHE = construireSolideCrop({ ...commun, hauteur: reliefAccroche })

test('LA PAROI S APPUIE SUR LA SURFACE EXACTE — pas sur le nœud de tuile le plus proche', () => {
  // ⚠️ **LA FRONTIÈRE TOMBE AU MILIEU DES TUILES** (Étape 3 de la tâche). Un
  // sommet de paroi accroché au nœud voisin laisse un liseré : la surface est
  // dessinée à une hauteur, le mur commence à une autre.
  //
  // ⚠️ **LA COMPARAISON SE FAIT ENTRE DEUX SOLIDES, PAS CONTRE UNE FORMULE
  // ÉCRITE ICI.** Une hauteur locale recalculée dans le test aurait oublié la
  // SAGITTA de la sphère (mesurée : 6,468e-5 unité au coin du crop, soit 4,1 m
  // de creusement géométrique — deux fois la sagitta de 2,1 m que le §3 du plan
  // donne au MILIEU d un bord, le coin étant racine de deux fois plus loin), et
  // l assertion
  // aurait mesuré la courbure au lieu de l échantillonnage. Les deux solides la
  // portent à l identique : leur différence est donc EXACTEMENT celle des deux
  // champs de hauteur, et rien d autre.
  const n = SOLIDE.anneau.length
  let pireResidu = 0
  let pireEcart = 0
  for (let k = 0; k < n; k++) {
    const { lat, lon } = latLonDeLocal(SOLIDE.anneau[k].u, SOLIDE.anneau[k].v, REPERE)
    const attendu = (Math.max(relief(lat, lon), 0) - Math.max(reliefAccroche(lat, lon), 0)) * ECHELLE
    const vu = SOLIDE.positions[k * 3 + 1] - SOLIDE_ACCROCHE.positions[k * 3 + 1]
    pireResidu = Math.max(pireResidu, Math.abs(vu - attendu))
    pireEcart = Math.max(pireEcart, Math.abs(attendu))
  }
  // ⚠️ SI LE MODULE ACCROCHAIT AU NŒUD, `vu` VAUDRAIT ZÉRO : les deux champs
  // rendraient la même valeur au point accroché, et le résidu vaudrait l écart
  // tout entier. Le résidu mesuré est de l ordre de 6e-8 — l arrondi du float32
  // à la magnitude du solide.
  assert.ok(pireResidu < 2e-6, `le sommet ne suit pas la surface exacte : résidu ${pireResidu} unité`)
  // et l écart entre les deux lectures est assez grand pour que la distinction
  // ait un sens, face à un texel de socle de 6,76 m à ZOOM_SOCLE.
  const ecartM = pireEcart / ECHELLE
  assert.ok(ecartM > 20, `le témoin accroché ne diffère que de ${ecartM} m : il ne prouve rien`)
})

// ══════════ ⑤ LE RELIEF — CE QUI MORD, ET CE QUI NE MORD PAS ════════════════

test('hauteurs.distinctes > 2 — l assertion du plan, ET LA MESURE QUI DIT QU ELLE NE MORD PAS', () => {
  const avecRelief = auditer(SOLIDE)
  const sansRelief = auditer(SOLIDE_PLAT)
  // l'assertion que le plan prescrit
  assert.ok(avecRelief.hauteurs.distinctes > 2, 'le solide est un pavé droit')
  // ⚠️ ET VOICI POURQUOI ELLE NE SUFFIT PAS ICI : un crop à relief NUL en rend
  // déjà des centaines, parce que la nappe suit la SPHÈRE.
  assert.ok(
    sansRelief.hauteurs.distinctes > 2,
    `le crop plat rend ${sansRelief.hauteurs.distinctes} hauteurs distinctes — ` +
      'si ce nombre tombait à 2, l assertion du plan mordrait, et ce commentaire serait à réécrire'
  )
  // CE QUI MORD : l'amplitude. Le relief du banc couvre 3 200 m ; la sphère
  // seule, sur 10,4 km de crop, ne couvre que sa sagitta (2,1 m, §3 du plan).
  // MESURÉ SUR CE BANC : **38,9**. Le seuil est posé à 20, entre le solide à
  // relief (38,9) et le pavé du test suivant (**1,003**). ⚠️ **ET LA MARGE N EST
  // PAS SYMÉTRIQUE, contrairement à ce que la première version de ce commentaire
  // affirmait** : 38,9 / 20 = **1,95 au-dessus**, 20 / 1,003 = **19,9 en
  // dessous**. C est le côté RELIEF qui est serré, et c est lui qui casserait
  // d abord si le champ du banc changeait d amplitude.
  const rapport = avecRelief.hauteurs.amplitude / sansRelief.hauteurs.amplitude
  assert.ok(rapport > 20, `le relief n ajoute qu un facteur ${rapport} à l amplitude`)
})

test('MUTATION — un anneau posé à hauteur CONSTANTE tue l assertion d amplitude', () => {
  // le sabotage : toutes les hauteurs de bord écrasées sur la moyenne. Le solide
  // reste fermé, orienté, sain — et n'est plus qu'un pavé.
  const fige = construireSolideCrop({ ...commun, hauteur: () => 1200 })
  const v = auditer(fige)
  assert.equal(v.sain, true, 'le pavé est un solide PARFAITEMENT SAIN — c est tout le piège')
  const rapport = v.hauteurs.amplitude / auditer(SOLIDE_PLAT).hauteurs.amplitude
  assert.ok(rapport < 20, `le pavé rend encore un facteur ${rapport} : l assertion ne mord pas`)
})

// ══════════ ⑥ LA FORME — LA SUPERELLIPSE EXACTE, TESTÉE AU BON ANGLE ════════

test('CHAQUE POINT DE L ANNEAU EST SUR LA FRONTIÈRE DE `dansDalle`', () => {
  // ⚠️ C'EST L'ASSERTION QUI TUE LE RETOUR À L'OCTOGONE. Elle ne dit pas « près
  // de » : elle dit que le point est dedans à (1 − 1e-9) du rayon et dehors à
  // (1 + 1e-9). Un anneau tracé sur `plansFenetre` serait 0,129 unité dehors
  // dans les coins, donc dehors des deux côtés.
  for (const { u, v } of SOLIDE.anneau) {
    assert.equal(dansDalle(u * (1 - 1e-9), v * (1 - 1e-9), 1, COIN, EXPO, null), true,
      `le point (${u}, ${v}) n est pas SUR la frontière : il est déjà dehors`)
    assert.equal(dansDalle(u * (1 + 1e-9), v * (1 + 1e-9), 1, COIN, EXPO, null), false,
      `le point (${u}, ${v}) est EN DEDANS de la frontière : la paroi laisserait un liseré`)
  }
})

test('L ANGLE — à 45° les deux lois sont CONFONDUES, à 44,3° elles diffèrent de 23,9 m', () => {
  // ⚠️ **REJOUÉ ICI AVANT DE SERVIR.** Les deux chiffres viennent de la Tâche A ;
  // ce test les recalcule, et c'est lui qui justifie l'angle du test suivant.
  const mParUnite = LARGEUR_SOCLE_M / 56 // 1 unité de socle au sol, à ZOOM_SOCLE
  const rayonDe = (angleDeg, dedans) => {
    const a = (angleDeg * Math.PI) / 180
    let lo = 0, hi = 2
    for (let i = 0; i < 200; i++) {
      const m = (lo + hi) / 2
      if (dedans(m * Math.cos(a) * HALF, m * Math.sin(a) * HALF)) lo = m
      else hi = m
    }
    return ((lo + hi) / 2) * HALF
  }
  const superellipse = (deg) => rayonDe(deg, (x, z) => dansDalle(x, z, HALF, CORNER, EXPO, null))
  const octogone = (deg) => rayonDe(deg, (x, z) => dansFenetre(x, z, HALF, CORNER, EXPO))

  assert.ok(Math.abs(octogone(45) - superellipse(45)) < 1e-9,
    'à 45° les deux formes devraient coïncider — le plan diagonal y est tangent')
  const ecart = octogone(44.3) - superellipse(44.3)
  assert.ok(Math.abs(ecart - 0.129) < 0.01, `écart à 44,3° : ${ecart} unité au lieu de 0,129`)
  assert.ok(Math.abs(ecart * mParUnite - 23.9) < 2, `soit ${ecart * mParUnite} m au lieu de 23,9`)
})

test('L ANNEAU EST DANS LA SUPERELLIPSE À 44,3°, PAS DANS L OCTOGONE', () => {
  // Le point d'anneau le plus proche de 44,3°, et celui le plus proche de 45° :
  // le premier sépare les deux lois, le second NON — et c'est écrit pour qu'on
  // ne repose jamais ce test au mauvais endroit.
  const proche = (deg) => {
    const cible = (deg * Math.PI) / 180
    let best = null, dBest = Infinity
    for (const p of SOLIDE.anneau) {
      if (p.u <= 0 || p.v >= 0) continue // le quadrant nord-est, où vit le coin
      const a = Math.atan2(-p.v, p.u)
      if (Math.abs(a - cible) < dBest) { dBest = Math.abs(a - cible); best = p }
    }
    return best
  }
  const p443 = proche(44.3)
  const p45 = proche(45)
  // à 44,3° : dans la superellipse (par construction), et STRICTEMENT dedans
  // l'octogone — c'est-à-dire qu'un anneau tracé sur l'octogone serait dehors.
  assert.equal(dansFenetre(p443.u * HALF, p443.v * HALF, HALF, CORNER, EXPO), true)
  // MESURE : **0,1145 unite** au point d anneau le plus proche de 44,3° (il tombe
  // a 44,273°), soit **21,2 m au sol**. Le maximum theorique de 0,129 se prend
  // ENTRE deux points d anneau ; c est la valeur ATTEIGNABLE qu on exige ici.
  const marge = margeOctogone(p443)
  assert.ok(marge > 0.1, `à 44,3° l anneau n est qu à ${marge} unité de l octogone : le test ne sépare rien`)
  // a 45° : la marge s effondre a **0,0068**, soit dix-sept fois moins.
  // **Un test pose la ne prouverait presque rien.**
  assert.ok(margeOctogone(p45) < 0.02, 'à 45° les deux lois se touchent — c est le piège de la Tâche A')
})

// ══════════ ⑦ LES OPTIONS PORTÉES DE `buildSlabWalls` ═══════════════════════

test('la PROFONDEUR par défaut vient de `plinth.js` — 7 sur 56, pas d un chiffre inventé', () => {
  assert.equal(FRACTION_PROFONDEUR, 7 / 56)
  const largeur = SOLIDE.largeur
  assert.ok(Math.abs((SOLIDE.minY - SOLIDE.baseY) - FRACTION_PROFONDEUR * largeur) < 1e-9,
    'la base ne tombe pas à `profondeur` sous le point le plus bas')
})

test('`baseYFloor` force le fond plus bas, jamais plus haut', () => {
  const bas = construireSolideCrop({ ...commun, hauteur: relief, baseYFloor: SOLIDE.baseY - 1 })
  assert.equal(bas.baseY, SOLIDE.baseY - 1)
  const haut = construireSolideCrop({ ...commun, hauteur: relief, baseYFloor: SOLIDE.baseY + 1 })
  assert.equal(haut.baseY, SOLIDE.baseY, 'un plancher plus HAUT percerait le relief')
  assert.equal(auditer(bas).sain, true)
})

test('LE FOND NE PEUT PAS ÊTRE PERCÉ PAR UNE CUVETTE INTÉRIEURE', () => {
  // le balayage intérieur de `computeSlab` (« basin guard »), porté : un creux
  // qui ne touche aucun bord doit quand même faire descendre la base.
  // ⚠️ LA CUVETTE RESTE AU-DESSUS DU NIVEAU DE LA MER : le globe pose ses
  // sommets à `max(h, 0)` (« oceans stay on the sphere »), donc une cuvette
  // NÉGATIVE serait écrasée à zéro et ne prouverait rien du balayage intérieur.
  const creux = (lat, lon) => {
    const { u, v } = localCrop(lat, lon, REPERE)
    return Math.hypot(u, v) < 0.3 ? 100 : 1500
  }
  const s = construireSolideCrop({ ...commun, hauteur: creux })
  // sans le balayage, la base serait tombée à `1500 − profondeur` : bien
  // au-dessus du fond de la cuvette, qui est à 100 m.
  assert.ok(s.baseY < hauteurLocale(100), 'la base passe AU-DESSUS du fond de la cuvette')
  assert.ok(hauteurLocale(1500) - hauteurLocale(100) > s.profondeur,
    'la cuvette est trop peu creuse pour que le balayage change quoi que ce soit')
  assert.equal(auditer(s).sain, true)
})

test('l OCCLUSION DE CONTACT est celle de `plinth.js`, recopiée et VERROUILLÉE', () => {
  // ⚠️ RECOPIÉE PLUTÔT QU'IMPORTÉE — `plinth.js` tire three.js et `terrain.js`,
  // et ce module doit rester pur (précédent explicite : `dem-emprise.js:428`).
  // La recopie n'est acceptable QUE tenue par un test, et le voici.
  for (const [y, base, bande, force] of [
    [0, 0, 1, 0.2], [0.5, 0, 1, 0.2], [1, 0, 1, 0.2], [3, 0, 1, 0.2],
    [-1, 0, 1, 0.2], [0.25, 0, 0, 0.2], [0.25, 0, 1, 0],
  ]) {
    assert.equal(occlusionContact(y, base, bande, force), contactAO(y, base, bande, force),
      `désaccord en (${y}, ${base}, ${bande}, ${force})`)
  }
  // et la bande par défaut est celle du socle
  assert.equal(SOCLE_AO_BANDE, 0.12)
  assert.equal(SOCLE_AO_FORCE, 0.2)
  assert.equal(SOLIDE.bande, bandeContact(SOLIDE.hautMax, SOLIDE.baseY))
})

test('les couleurs de sommet portent l occlusion, et elles sont SOMBRES au pied', () => {
  const { couleurs, positions, anneau, baseY, bande, rangs } = SOLIDE
  const n = anneau.length
  assert.equal(couleurs.length, positions.length / 3 * 3)
  // ⚠️ **LE PIED DU MUR EST LE DERNIER RANG, PAS LE RANG `n`** — depuis la Tâche
  // P13 le profil en compte sept, et `n` est le pied du CHANFREIN, tout en haut.
  const pied = (rangs - 1) * n
  assert.equal(positions[pied * 3 + 1], Math.fround(baseY), 'le dernier rang n est pas le fond')
  const aoPied = couleurs[pied * 3] / 255
  assert.ok(aoPied < 0.85, `le pied du mur n est pas assombri : ${aoPied}`)
  // très au-dessus de la bande : plein jour
  let clair = 0
  for (let k = 0; k < n; k++) if (positions[k * 3 + 1] > baseY + bande * 2) clair++
  assert.ok(clair > n * 0.5, 'moins de la moitié de l anneau haut est hors de la bande de contact')
})

test('⑬0 LA BANDE D OCCLUSION CONTIENT DES SOMMETS — le rang que la Tâche B n avait pas', () => {
  // ⛔ **LE DÉFAUT QUE LE RANG ② FERME, ET IL SE MESURE.** L'occlusion voyage en
  // couleur de sommet : avec DEUX rangs seulement (la surface et le fond), elle
  // s'interpolait linéairement sur toute la hauteur du mur — la bande de 12 %
  // ne contenait aucun sommet, donc elle n'existait pas. `plinth.js` écrit le
  // même constat sur le socle. Le témoin : à mi-hauteur de la bande, un mur à
  // deux rangs rend une occlusion QUASI PLEINE, le profil à sept rangs rend
  // celle que `occlusionContact` prescrit.
  const { couleurs, positions, anneau, baseY, bande, rangs } = SOLIDE
  const n = anneau.length
  let dansLaBande = 0
  for (let i = 0; i < positions.length / 3; i++) {
    const y = positions[i * 3 + 1]
    if (y > baseY && y <= baseY + bande) dansLaBande++
  }
  assert.ok(dansLaBande >= n, `${dansLaBande} sommets dans la bande de contact, il en faut au moins un rang`)
  // et l'octet cuit est bien celui de la loi, au sommet le plus proche du milieu
  // de la bande — pas un point d'une droite tendue du haut au fond
  const cible = baseY + bande * 0.5
  let meilleur = -1
  let ecart = Infinity
  for (let i = 0; i < positions.length / 3; i++) {
    const d = Math.abs(positions[i * 3 + 1] - cible)
    if (d < ecart) { ecart = d; meilleur = i }
  }
  const attendu = Math.round(255 * occlusionContact(positions[meilleur * 3 + 1], baseY, bande, 0.2))
  assert.equal(couleurs[meilleur * 3], attendu)
  // ⚠️ **LE TÉMOIN À DEUX RANGS, ET IL VA DANS LE SENS QU'IL FAUT REGARDER.**
  // Avec le seul rang du haut et le seul rang du fond, l'octet cuit à cette
  // altitude serait celui d'une DROITE tendue de 1 (le haut) à `1 − force` (le
  // fond) : l'assombrissement s'étale alors sur tout le mur, et à mi-bande il
  // est BEAUCOUP TROP SOMBRE. Relevé : **207 contre 243** — c'est-à-dire un
  // contact qui bave sur 100 % de la hauteur au lieu de 12 %.
  const t = (positions[meilleur * 3 + 1] - baseY) / (SOLIDE.hautMax - baseY)
  const naif = 255 * (occlusionContact(baseY, baseY, bande, 0.2) * (1 - t) + t)
  assert.ok(attendu - naif > 20,
    `le rang ② ne change rien : profil ${attendu}, interpolation à deux rangs ${naif.toFixed(1)}`)
  assert.equal(rangs, 7, 'le profil livré compte sept rangs')
})

// ══════════ ⑧ LE NUANCEUR — LA COUVERTURE DOUCE, VÉRIFIÉE COMME TEXTE ═══════
//
// ⚠️ **QUATRE ASSERTIONS DE LA PREMIÈRE VERSION ÉTAIENT VERTES DES DEUX CÔTÉS,
// ET C'EST MESURÉ** (`.banc/rejoue-B.mjs`, rejoué contre `git show 69b32e5`) :
//   · `/smoothstep/` sur tout ce qui suit la garde du crop — le nuanceur en
//     portait **déjà deux**, pour les courbes de niveau et le graticule ;
//   · `/discard;/`, `/uCropOn > 0.5/` et `/uCropOn: { value: 0/` — vraies avant,
//     et **déjà posées mot pour mot** par `crop-sphere.test.js:236,244,245`.
// **Une assertion qui ne distingue rien coûte de la confiance sans en donner.**
// Les huit qui suivent ont toutes été rejouées : **fausses avant, vraies
// après**, et le banc les rejoue à la demande.
//
// ⚠️ **ET LE BLOC EST BORNÉ DES DEUX CÔTÉS.** L'ancienne tranche courait jusqu'à
// la fin du fichier ; c'est elle qui laissait passer les `smoothstep` du reste
// du nuanceur.

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const DEBUT_CROP = GLOBE_SRC.indexOf('if (uCropOn > 0.5) {')
// ⚠️ **LA BORNE BASSE EST LA PREMIÈRE LIGNE D'APRÈS LE BLOC, ET ELLE A BOUGÉ
// À LA TÂCHE P10** : `float h = decodeMetersAA(vUv);` est devenu
// `float h = hauteurFond(qCrop, decodeMetersAA(vUv));`, parce que la loi du fond
// marin est désormais une FONCTION — la normale par fragment la rappelle quatre
// fois. Si cette ligne disparaît à son tour, `FIN_CROP` vaut −1 et la première
// assertion du test le dit.
const FIN_CROP = GLOBE_SRC.indexOf('float h = hauteurFond(', DEBUT_CROP)
const BLOC = GLOBE_SRC.slice(DEBUT_CROP, FIN_CROP)

test('le bloc de découpe est BORNÉ — sans quoi tout le reste du nuanceur y entre', () => {
  assert.ok(DEBUT_CROP > 0, 'la garde `if (uCropOn > 0.5) {` a disparu du nuanceur')
  assert.ok(FIN_CROP > DEBUT_CROP, 'la borne basse du bloc a disparu')
  // le témoin de ce qui rendait l'ancienne assertion inutile : hors du bloc, le
  // nuanceur porte d'autres `smoothstep` (contours, graticule, terminateur).
  const dehors = GLOBE_SRC.slice(FIN_CROP)
  assert.ok((dehors.match(/smoothstep/g) || []).length >= 2,
    'plus aucun `smoothstep` hors du bloc : le piège a disparu, ce commentaire est à revoir')
})

test('LE `discard` BINAIRE EST DEVENU UNE COUVERTURE DOUCE', () => {
  // ⚠️ MESURÉ, PAS JUGÉ À L ŒIL : `gl.getContextAttributes().antialias === false`
  // (relevé de la Tâche A, reproduit par la Tâche B sur ce contexte). Un
  // `discard` donne une frontière binaire, donc les coins crénellent.
  // ⚠️ **LA TÂCHE G A INTERCALÉ DES NOMS, PAS UNE AUTRE LOI.** La couverture
  // douce s appelle désormais `dedans` et passe par `couvertureTuile` avant
  // d atteindre `couvertureCrop`, parce que l estompage doit pouvoir interpoler
  // ENTRE la planète entière et le crop seul. **On vérifie donc la CHAÎNE
  // ENTIÈRE, ce qui est plus fort que l assertion d avant** : n importe lequel
  // des trois maillons coupé tombe ici, alors qu une seule ligne était gardée.
  assert.ok(/dedans\s*=\s*1\.0\s*-\s*smoothstep\(/.test(BLOC),
    'la couverture n est pas un `smoothstep` de la distance signée')
  assert.ok(/couvertureTuile\s*=\s*mix\(\s*1\.0\s*,\s*dedans\s*,/.test(BLOC),
    'la couverture douce n alimente plus la couverture de la tuile')
  assert.ok(/couvertureCrop\s*=\s*couvertureTuile\s*;/.test(BLOC),
    'la couverture de la tuile n atteint plus `couvertureCrop`')
  // ⚠️ ET ELLE DOIT SORTIR DU NUANCEUR : une couverture calculée puis jetée
  // serait exactement le `discard` binaire d avant, avec un `smoothstep` mort à
  // côté pour rassurer le lecteur.
  assert.ok(/gl_FragColor\s*=\s*vec4\(\s*col\s*,\s*couvertureCrop\s*\)/.test(GLOBE_SRC),
    'la couverture ne part pas dans l alpha du fragment')
})

test('LA LARGEUR DU FONDU VIENT DE `fwidth`, JAMAIS D UNE CONSTANTE', () => {
  // ⚠️ **UNE CONSTANTE NE SERAIT JUSTE QU À UNE SEULE ALTITUDE.** La largeur se
  // mesure en unités-monde à partir de la dérivée d écran. Mesuré à l écran :
  // 1 à 2 px à `dist` 2,0 ET à 1,05 — un zoom de ×2,76 qui ne l élargit pas.
  assert.ok(/float\s+w\s*=\s*max\(\s*fwidth\(\s*d\s*\)/.test(BLOC),
    'la largeur du fondu n est pas dérivée de `fwidth`')
  assert.ok(/smoothstep\(\s*-\s*0\.5\s*\*\s*w\s*,\s*0\.5\s*\*\s*w\s*,\s*d\s*\)/.test(BLOC),
    'le `smoothstep` ne s appuie pas sur la largeur mesurée, des deux côtés de la frontière')
})

test('LE `discard` RESTE — au-delà d un demi-pixel, on ne paie pas le mélange', () => {
  // ⚠️ Le plan est explicite : « Le `discard` reste au-delà d un pixel, sinon on
  // paie le mélange sur toute la tuile. » L assertion porte donc sur la GARDE,
  // pas sur la présence du mot : `discard` était là avant.
  //
  // ⚠️ **LA TÂCHE G A DÛ DÉPLACER CETTE GARDE, ET SON ÉQUIVALENCE EST PROUVÉE,
  // PAS AFFIRMÉE.** L estompage doit pouvoir GARDER les fragments du dehors
  // pendant le fondu ; le `discard` ne peut donc plus lire `d` seul, il lit la
  // couverture. Les deux formes coupent le même ensemble : `dedans` est un
  // `smoothstep` qui sature à EXACTEMENT 0 dès `d >= 0.5 * w`, et à estompage
  // plein `couvertureCrop` vaut `dedans` (`mix(a, b, 1.0) === b`). Le seul écart
  // est le fragment où `d` vaut exactement `0.5 * w` : il était gardé avec une
  // couverture NULLE, il est désormais coupé. Invisible, et moins cher.
  assert.ok(/if\s*\(\s*couvertureCrop\s*<=\s*0\.0\s*\)\s*discard\s*;/.test(BLOC),
    'le `discard` n est plus gardé par la couverture')
  // et la couverture, elle, descend bien de la largeur mesurée — sans ce
  // maillon la garde ci-dessus ne prouverait plus rien sur `fwidth`
  assert.ok(/dedans\s*=\s*1\.0\s*-\s*smoothstep\(\s*-\s*0\.5\s*\*\s*w\s*,\s*0\.5\s*\*\s*w\s*,\s*d\s*\)/.test(BLOC),
    'la couverture qui garde le `discard` ne descend plus de la largeur mesurée')
  // LE REJEU NUMÉRIQUE DE L ÉQUIVALENCE — à estompage plein, la nouvelle garde
  // coupe exactement là où l ancienne coupait.
  const SS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
  const MIX = (a, b, t) => a * (1 - t) + b * t
  const w = 0.004
  for (const d of [-1, -w, -0.5 * w, 0, 0.25 * w, 0.499 * w, 0.5 * w, 0.5001 * w, w, 1]) {
    const couverture = MIX(1, 1 - SS(-0.5 * w, 0.5 * w, d), 1)
    assert.equal(couverture <= 0, d >= 0.5 * w, `les deux gardes divergent à d = ${d}`)
  }
})

test('SANS CROP, L ALPHA VAUT EXACTEMENT 1 — la production est intouchée', () => {
  // ⚠️ L ASSERTION QUI PROTÈGE LA PRODUCTION, et elle ne se contente pas de
  // constater que `uCropOn` naît à zéro (`crop-sphere.test.js` le fait déjà) :
  // elle vérifie que la couverture est DÉCLARÉE à 1 avant la garde, et qu elle
  // n est affectée qu à un seul autre endroit — dedans.
  const dec = GLOBE_SRC.indexOf('float couvertureCrop = 1.0;')
  assert.ok(dec > 0, 'la couverture n est pas déclarée')
  assert.ok(dec < DEBUT_CROP, 'la couverture est déclarée APRÈS la garde : hors crop elle serait indéfinie')
  assert.equal((GLOBE_SRC.match(/couvertureCrop\s*=/g) || []).length, 2,
    'la couverture est affectée ailleurs que dans le bloc de découpe')
})

test('LE MÉLANGE SUIT LE CROP, ET SEULEMENT LUI', () => {
  // ⚠️ L ALPHA NE VEUT RIEN DIRE SANS MÉLANGE — et le mélange coûte : il fait
  // passer les tuiles dans la liste TRIÉE arrière-avant, donc leur surdessin
  // perd le rejet Z précoce. Il ne doit s armer que sous crop.
  assert.ok(/transparent:\s*!!this\._crop/.test(GLOBE_SRC), 'le mélange ne suit pas le crop')
  assert.ok(/_melangeCrop\s*\(/.test(GLOBE_SRC), 'les matériaux déjà créés ne sont pas repris')
  // ⚠️ ET LA PROFONDEUR RESTE ÉCRITE : sans elle, les tuiles se mélangeraient
  // les unes aux autres au lieu de s occulter.
  assert.ok(/depthWrite:\s*true/.test(GLOBE_SRC), 'la profondeur n est plus écrite')
})

test('le globe expose la pose ET LE RETRAIT des parois', () => {
  assert.ok(/construireParoisCrop\s*\(/.test(GLOBE_SRC), 'pas de `construireParoisCrop`')
  assert.ok(/retirerParoisCrop\s*\(/.test(GLOBE_SRC), 'pas de `retirerParoisCrop` — les parois seraient irréversibles')
  assert.ok(/from '\.\/monde\/parois-crop\.js'/.test(GLOBE_SRC), 'globe.js ne lit pas la loi des parois')
})

// ══════════ ⑨ LE CONTOUR, ET SON COÛT ═══════════════════════════════════════

test('le contour est FERMÉ et SANS DOUBLON — un doublon serait un triangle dégénéré', () => {
  const a = contourCrop(COIN, EXPO, PAS_CONTOUR)
  assert.ok(a.length > 200, `contour de ${a.length} points : trop grossier pour un bord de crop`)
  for (let k = 0; k < a.length; k++) {
    const b = a[(k + 1) % a.length]
    assert.ok(Math.hypot(b.u - a[k].u, b.v - a[k].v) > 1e-12, `doublon à l index ${k}`)
  }
})

test('un coin VIF (rayon nul) reste un carré, et le solide reste sain', () => {
  const s = construireSolideCrop({ ...commun, hauteur: relief, forme: { coin: 0, expo: 2 } })
  assert.equal(auditer(s).sain, true)
  for (const { u, v } of s.anneau) {
    assert.ok(Math.abs(Math.abs(u) - 1) < 1e-12 || Math.abs(Math.abs(v) - 1) < 1e-12,
      `le point (${u}, ${v}) n est sur aucun côté du carré`)
  }
})

// ══════════ ⑩ `globe.hauteurSurface` — TESTÉE, PAS JUSTE NOMMÉE ═════════════
//
// ⚠️ **LA PREMIÈRE VERSION DE CE FICHIER NE LA VÉRIFIAIT QUE PAR UN `grep` DE
// SON NOM.** L'interpolation bilinéaire, le choix de la tuile la plus fine et le
// repli d'antiméridien n'étaient démontrés par rien — et le « 29,96 m » du
// compte rendu avait été mesuré à travers `construireSolideCrop`, pas à travers
// elle. Les quatre tests qui suivent l'exercent directement.
//
// ⚠️ **ON L'APPELLE PAR `.call` SUR UN OBJET MINIMAL**, patron de
// `test/globe-precision.test.js` : monter un `Globe` entier réclamerait le DOM
// (rampe de couleurs, calottes, atmosphère, coquille de nuages).

/** Une tuile factice : `size²` hauteurs, et rien d'autre que ce que la méthode lit. */
function tuile(z, x, y, size, f) {
  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) heights[j * size + i] = f(i, j)
  return { z, x, y, size, heights, key: `${z}/${x}/${y}` }
}

/** (mercator normalisé) → (lat, lon). Le repère unité rend `latLonDeLocal` direct. */
const UNITE = { cx: 0, cy: 0, demi: 1 }
const deMerc = (mx, my) => latLonDeLocal(mx, my, UNITE)

// ⚠️ **`_tuileLaPlusFine` FAIT PARTIE DU `this` MINIMAL DEPUIS LA TÂCHE P11** :
// la recherche de tuile est sortie de `hauteurSurface` le jour où
// `hauteurDessinee` en a eu besoin, pour qu'il n'y ait qu'UN repli
// d'antiméridien — celui que ce fichier teste juste en dessous.
const lisSurface = (liste, lat, lon) =>
  Globe.prototype.hauteurSurface.call(
    { tuilesAvecHauteurs: () => liste, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine },
    lat, lon,
  )

test('hauteurSurface INTERPOLE — elle ne s accroche pas au nœud le plus proche', () => {
  // une rampe franche sur 4 texels : le nœud voisin vaut 300 m de plus
  const t = tuile(13, 4300, 4600, 4, (i) => 100 * i)
  const n = 2 ** 13
  // un point choisi ENTRE deux nœuds : (u, v) = (0,3125 ; 0,5625)
  const u = 0.3125
  const v = 0.5625
  const { lat, lon } = deMerc((4300 + u) / n, (4600 + v) / n)
  const vu = lisSurface([t], lat, lon)
  // la valeur EXACTE que rend l échantillonnage bilinéaire du dépôt
  const attendu = sampleHeights(t.heights, u, v, 4)
  assert.ok(Math.abs(vu - attendu) < 1e-9, `${vu} au lieu de ${attendu}`)
  // ⚠️ ET LE TÉMOIN : le nœud le plus proche donne autre chose. Sans lui,
  // l assertion passerait aussi sur une méthode qui accroche.
  const noeud = sampleHeights(t.heights, (Math.round(u * 4 - 0.5) + 0.5) / 4, (Math.round(v * 4 - 0.5) + 0.5) / 4, 4)
  assert.ok(Math.abs(vu - noeud) > 10, `l accrochage rendrait ${noeud}, l interpolation ${vu} : trop proche pour prouver quoi que ce soit`)
})

test('hauteurSurface prend LA PLUS FINE des tuiles qui couvrent le point', () => {
  // ⚠️ C EST LE REPLI SUR L ANCÊTRE, celui qui rend le §7 de `parois-crop.js`
  // tenable : quand la fine n est pas là, la grossière répond ; quand elle est
  // là, elle gagne.
  const n = 2 ** 13
  const { lat, lon } = deMerc((4300 + 0.5) / n, (4600 + 0.5) / n)
  const grossiere = tuile(6, 4300 >> 7, 4600 >> 7, 4, () => 111)
  const fine = tuile(13, 4300, 4600, 4, () => 999)
  assert.equal(lisSurface([grossiere], lat, lon), 111, 'la grossière seule doit répondre')
  assert.equal(lisSurface([grossiere, fine], lat, lon), 999, 'la fine doit gagner')
  assert.equal(lisSurface([fine, grossiere], lat, lon), 999, 'et l ordre de la liste ne doit rien y faire')
})

test('hauteurSurface rend `null` quand PERSONNE ne couvre — jamais zéro', () => {
  // ⚠️ **ZÉRO EST LE NIVEAU DE LA MER.** Le confondre avec « je ne sais pas »
  // creuse une encoche dans la paroi, exactement à la hauteur de la mer. C est
  // le défaut que le §7 de `parois-crop.js` raconte.
  const n = 2 ** 13
  const loin = deMerc((4300 + 0.5) / n, (4600 + 0.5) / n)
  const ailleurs = tuile(13, 1, 1, 4, () => 500)
  assert.equal(lisSurface([ailleurs], loin.lat, loin.lon), null)
  assert.equal(lisSurface([], loin.lat, loin.lon), null)
})

test('LE REPLI D ANTIMÉRIDIEN DE hauteurSurface — le `round` avait un trou, le modulo non', () => {
  // ⚠️ **REJOUÉ AVANT D ÊTRE ÉCRIT** (`.banc/repli-B.mjs`) : la forme
  // `tx -= round(tx / n) * n` replie dans `(−n/2, n/2]`, ce qui est FAUX dès que
  // `n` vaut 1 — la tuile unique d un z0 rejette alors tout point au-delà de
  // mx = 0,5, soit la moitié de la planète. Ce test tombe sur cette forme-là.
  const z0 = tuile(0, 0, 0, 4, () => 777)
  const est = deMerc(0.7, 0.5) // mx > 0,5 : c est là que le `round` cassait
  assert.equal(lisSurface([z0], est.lat, est.lon), 777, 'la tuile unique d un z0 doit couvrir TOUTE la planète')
  const ouest = deMerc(0.2, 0.5)
  assert.equal(lisSurface([z0], ouest.lat, ouest.lon), 777)
  // ⚠️ ET UNE TUILE D INDICE HORS BORNES est la même que son repli : c est la
  // convention que `remplirHauteurs` emploie déjà (sa boucle `dxMonde`).
  const n = 4
  const p = deMerc((0 + 0.5) / n, (1 + 0.5) / n)
  assert.equal(lisSurface([tuile(2, 4, 1, 4, () => 42)], p.lat, p.lon), 42, 'x = 4 à z2 est la tuile x = 0')
  const q = deMerc((3 + 0.5) / n, (1 + 0.5) / n)
  assert.equal(lisSurface([tuile(2, -1, 1, 4, () => 43)], q.lat, q.lon), 43, 'x = −1 à z2 est la tuile x = 3')
})

// ══════════ ⑪ LA TUILE ABSENTE — LE REFUS, ET SON MOTIF (§7) ════════════════

test('UN SEUL TROU ET LA PAROI REFUSE DE SE BÂTIR', () => {
  // ⚠️ **LE DÉFAUT QUE CE TEST FERME** : la première version rendait `0` sur un
  // point non couvert — le niveau de la mer — et creusait une encoche muette
  // dans le flanc du bloc. `couverture` sortait bien de la fonction, et personne
  // ne la lisait.
  let appels = 0
  const troue = (lat, lon) => (++appels === 40 ? null : relief(lat, lon))
  const s = construireSolideCrop({ ...commun, hauteur: troue })
  assert.equal(s.refus, 'couverture', 'un trou est passé sans que rien ne le dise')
  assert.equal(s.positions, undefined, 'le refus a quand même posé des sommets')
  assert.ok(s.couverture > 0.99 && s.couverture < 1, `couverture rendue : ${s.couverture}`)
  assert.equal(s.manquants, 1)
})

test('le seuil s ABAISSE, et l appelant achète alors les encoches', () => {
  let appels = 0
  const troue = (lat, lon) => (++appels === 40 ? null : relief(lat, lon))
  const s = construireSolideCrop({ ...commun, hauteur: troue, couvertureMin: 0.9 })
  assert.equal(s.refus, null, 'le seuil abaissé devrait laisser passer')
  assert.equal(s.manquants, 1)
  // le solide reste FERMÉ — l encoche est une encoche, pas un trou
  assert.equal(auditer(s).sain, true)
})

test('un solide COMPLET rend une couverture de 1 et aucun refus', () => {
  assert.equal(SOLIDE.refus, null)
  assert.equal(SOLIDE.couverture, 1)
  assert.equal(SOLIDE.manquants, 0)
})

// ══════════ ⑫ LES DEUX CONVERSIONS SE COMPOSENT — ET LE TÉMOIN EST CONFRONTÉ ═
//
// ⚠️ **`crop-sphere.js` AFFIRMAIT QUE CE FICHIER VÉRIFIAIT LA COMPOSITION EN
// IDENTITÉ. IL NE LE FAISAIT PAS.** Et le « témoin indépendant » de
// `crop-sphere.test.js:284` **n'a pas le repli de longitude** : les deux
// formules divergent exactement là où ça compte — sur un crop à cheval sur 180°
// — sans avoir jamais été confrontées. Les deux tests qui suivent ferment ça.

/** La copie privée de `crop-sphere.test.js:284`, SANS repli. Recopiée telle quelle. */
function latLonDeLocalSansRepli(u, v, rep) {
  const mx = rep.cx + u * rep.demi
  const my = rep.cy + v * rep.demi
  return {
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI,
    lon: mx * 360 - 180,
  }
}

test('`latLonDeLocal` ∘ `localCrop` = l identité, sur 2 500 points', () => {
  let pireLat = 0
  let pireLon = 0
  for (let i = 0; i < 50; i++) {
    for (let j = 0; j < 50; j++) {
      const u = -1 + (2 * (i + 0.5)) / 50
      const v = -1 + (2 * (j + 0.5)) / 50
      const { lat, lon } = latLonDeLocal(u, v, REPERE)
      const r = localCrop(lat, lon, REPERE)
      pireLon = Math.max(pireLon, Math.abs(r.u - u))
      pireLat = Math.max(pireLat, Math.abs(r.v - v))
    }
  }
  assert.ok(pireLon < 1e-12, `écart en u : ${pireLon}`)
  assert.ok(pireLat < 1e-12, `écart en v : ${pireLat}`)
})

test('SUR L ANTIMÉRIDIEN, LE REPLI EST LOAD-BEARING — et le témoin de la Tâche A ne l a pas', () => {
  // ⚠️ **C EST LA CONFRONTATION.** À lon 6,25 les deux formules coïncident au
  // bit ; à cheval sur 180°, celle sans repli rend une longitude qui n existe
  // pas. Un témoin qu on ne confronte jamais n est pas un témoin.
  const rep = repereCrop({ centre: { lat: 0, lon: 179.99 } })
  let vus = 0
  let divergents = 0
  let pire = 0
  for (let i = 0; i < 200; i++) {
    const u = -1 + (2 * (i + 0.5)) / 200
    const avec = latLonDeLocal(u, 0, rep)
    const sans = latLonDeLocalSansRepli(u, 0, rep)
    assert.ok(avec.lon >= -180 && avec.lon < 180, `longitude hors bornes : ${avec.lon}`)
    // la composition tient AVEC le repli
    assert.ok(Math.abs(localCrop(avec.lat, avec.lon, rep).u - u) < 1e-12, 'la composition casse sur l antiméridien')
    vus++
    const ecart = Math.abs(sans.lon - avec.lon)
    if (ecart > 1e-9) { divergents++; pire = Math.max(pire, ecart) }
  }
  assert.equal(vus, 200)
  // sur ce crop, la moitié ouest passe la ligne : la formule sans repli y sort
  // de [−180, 180[ de 360° EXACTEMENT.
  assert.ok(divergents > 0, 'les deux formules ne divergent nulle part : le repli ne servirait à rien')
  assert.ok(Math.abs(pire - 360) < 1e-9, `divergence maximale ${pire}° au lieu de 360`)
})

// ── outils du fichier ──────────────────────────────────────────────────────

/** Une altitude en mètres, exprimée dans le repère local du crop. */
function hauteurLocale(m) {
  return Math.max(m, 0) * ECHELLE
}

/**
 * De combien le point d'anneau est-il EN DEDANS de l'octogone circonscrit, en
 * unités de socle ? Zéro = les deux lois se touchent (c'est le cas à 45°).
 */
function margeOctogone(p) {
  // le rayon du point, et la direction de sa demi-droite depuis le centre
  const r0 = Math.hypot(p.u, p.v) * HALF
  const dx = (p.u * HALF) / r0
  const dz = (p.v * HALF) / r0
  let lo = r0, hi = 2 * HALF
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2
    if (dansFenetre(m * dx, m * dz, HALF, CORNER, EXPO)) lo = m
    else hi = m
  }
  return (lo + hi) / 2 - r0
}


// ══════════ LE RABATTEMENT DES JUPES DE TUILE — Tâche P7 ════════════════════
//
// ⛔ **`skirtDrop` (`globe.js`) EST DANS LA MONNAIE DU GLOBE.** Entre 0,1 et
// 0,9 unité de scène sur une planète de rayon 100 ; le bloc du crop, lui, fait
// **0,0507 à 0,0955 unité d'épaisseur** au relevé de La Réunion. La jupe
// traversait donc le fond du bloc et pendait dessous : **2 186 px en 12 langues**
// contre **0** au socle, mesuré dans la page vivante (`.banc/P7/`).

test('P7 · le rabattement est BORNÉ par le plancher, et par lui seul', () => {
  // au-dessus du plancher, le rabattement passe entier
  assert.equal(rabattementBorne(0.1, 100.5, 100.0), 0.1)
  // sous le plancher, il s arrête dessus — au bit près
  assert.equal(rabattementBorne(0.1, 100.05, 100.0), 100.05 - 100.0)
  // pile au plancher : plus rien à rabattre, et surtout PAS un nombre négatif
  assert.equal(rabattementBorne(0.1, 100.0, 100.0), 0)
  assert.equal(rabattementBorne(0.1, 99.9, 100.0), 0)
  // et jamais plus que ce que l appelant demande
  assert.equal(rabattementBorne(0.02, 100.5, 100.0), 0.02)
})

test('P7 · SANS plancher, le rabattement est rendu TEL QUEL — le neutre est exact', () => {
  // ⚠️ **C EST LE DÉFAUT DE TOUT LE GLOBE**, et il doit être exact au bit près :
  // hors crop, `_rayonPlancherCrop` rend `0`, et rien ne doit bouger.
  for (const rien of [0, -1, NaN, null, undefined]) {
    assert.equal(rabattementBorne(0.37, 100.5, rien), 0.37, `plancher ${rien}`)
  }
  // un rayon de sommet absurde ne fabrique pas non plus une borne silencieuse
  for (const rien of [0, -1, NaN]) {
    assert.equal(rabattementBorne(0.37, rien, 100), 0.37, `rayon ${rien}`)
  }
})

test('P7 · la borne est MONOTONE, et un plancher plus profond rend plus de jupe', () => {
  // ⚠️ Une inversion `Math.min`/`Math.max` — la mutation la plus banale de ce
  // dépôt — rendrait cette suite décroissante ou constante.
  let precedent = -1
  for (let d = 0; d <= 0.2; d += 0.01) {
    const r = rabattementBorne(0.5, 100, 100 - d)
    assert.ok(r >= precedent, `rabattement non croissant à ${d} : ${r} < ${precedent}`)
    assert.ok(r <= 0.5, 'la borne ne doit jamais AJOUTER du rabattement')
    precedent = r
  }
  assert.equal(rabattementBorne(0.5, 100, 100 - 0.2).toFixed(6), '0.200000')
})

test('P7 · `globe.js` APPELLE la borne, et il ne la réécrit pas', () => {
  const g = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT DE COMPTER** — ceux de ligne ET
  // ceux de bloc. La Tâche K ter a eu une mutation survivante parce qu une
  // assertion lisait une formule dans un pavé de prose ; ici c est l inverse,
  // un pavé de prose faisait compter une occurrence de trop.
  const corps = g.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
  assert.match(corps, /rabattementBorne\(d\.rabattement, rayon, rPlancher\)/)
  assert.match(corps, /import \{ construireSolideCrop, normalesParois, rabattementBorne \}/)
  // une seconde écriture de la loi — un `Math.min` sur le rabattement ailleurs —
  // est exactement ce que ce chantier a payé quatre fois sur la mer.
  const occurrences = (corps.match(/rabattementBorne/g) || []).length
  assert.equal(occurrences, 2, 'la borne doit être IMPORTÉE une fois et APPELÉE une fois')
})

// ══════════ ⑬ LE CHANFREIN ET LE CONGÉ — LA PERTE DE LA TÂCHE B, REPRISE ════
//
// ⛔ **CE POSTE EST LE SEUL INCHANGÉ DEPUIS LA PREMIÈRE NOTATION**, et le noteur
// l'a réécrit quatre fois dans les mêmes termes : « un fin liseré lumineux court
// sur toute l'arête haute du mur du socle ; sur le crop, pris à la même seconde,
// rien ». C'est un geste qu'Adrien avait lui-même demandé sur son socle : « il
// est vraiment arrondi, et c'est un vrai chanfrein dessous ».
//
// ⚠️ **CE QUE CETTE SECTION NE PROUVE PAS** : que ça se VOIT. Aucun test sous
// node ne rend un pixel. Elle prouve que la géométrie et les normales sont
// celles du socle, dans la bonne monnaie ; l'écran est dans le rapport.

/** Le solide, avec les réglages du banc et les surcharges qu'on veut. */
const solideAvec = (options) => construireSolideCrop({ ...commun, hauteur: relief, ...options })

/** L'écart angulaire, en degrés, entre deux normales unitaires. */
const angleEntre = (a, b) => {
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return (Math.acos(d) * 180) / Math.PI
}

test('⑬a LES DEUX VALEURS VIENNENT DE `plinth.js`, ET LA MONNAIE EST LA LARGEUR', () => {
  // ⚠️ **RECOPIÉES, PAS IMPORTÉES** — `plinth.js` tire three.js et `terrain.js`.
  // La recopie n'est acceptable QUE tenue par un test, et le voici : il lit les
  // constantes du socle et refuse la divergence.
  assert.equal(SOCLE_CHANFREIN, 0.16)
  assert.equal(SOCLE_ARRONDI, 0.9)
  assert.equal(SOCLE_ARRONDI_SEG, 3)
  assert.equal(FRACTION_CHANFREIN, SOCLE_CHANFREIN / 56)
  assert.equal(FRACTION_ARRONDI, SOCLE_ARRONDI / 56)
  assert.equal(ARRONDI_SEG, SOCLE_ARRONDI_SEG)
  // ⛔ **ET LE PIÈGE QUE CETTE MONNAIE ÉVITE, CHIFFRÉ.** Recopier `0.16` tel quel
  // dans un crop large de 0,164 unité aurait posé un chanfrein nettement PLUS
  // LARGE que le bloc : c'est la faute de monnaie que ce chantier a payée cinq
  // fois. La fraction, elle, rend 4,69·10⁻⁴.
  const brut = SOCLE_CHANFREIN / SOLIDE.largeur
  assert.ok(brut > 0.9, `le témoin de monnaie ne mord pas : ${brut}`)
  assert.ok(Math.abs(SOLIDE.chanfrein / SOLIDE.largeur - SOCLE_CHANFREIN / 56) < 1e-12)
})

test('⑬b LE CHANFREIN RENTRE LE MUR — et le SOMMET du mur ne bouge pas d un bit', () => {
  const vif = solideAvec({ fractionChanfrein: 0, fractionArrondi: 0 })
  const n = SOLIDE.compte.anneau
  // ⚠️ **LE SOMMET DU MUR NE BOUGE PAS.** Il doit rester exactement sur le bord
  // du relief : c'est le pied du chanfrein qui rentre, jamais sa tête. Sinon on
  // voit le jour sous la carte, et c'est la classe de défaut que tout ce module
  // passe son temps à éviter.
  for (let k = 0; k < n * 3; k++) {
    assert.equal(SOLIDE.positions[k], vif.positions[k], `le rang 0 a bougé à l indice ${k}`)
  }
  // ⚡ **ET ON LE PROUVE EN LE BOUGEANT, DANS LES DEUX SENS.**
  for (const facteur of [0.5, 2, 4]) {
    const s = solideAvec({ fractionChanfrein: FRACTION_CHANFREIN * facteur })
    assert.ok(Math.abs(s.chanfrein / SOLIDE.chanfrein - facteur) < 1e-9,
      `chanfrein ×${facteur} rend ${s.chanfrein / SOLIDE.chanfrein}`)
    // le pied du chanfrein descend d'autant, et le sommet ne bouge toujours pas
    const chuteAttendue = SOLIDE.chanfrein * facteur
    const chute = s.positions[0 * 3 + 1] - s.positions[(n + 0) * 3 + 1]
    assert.ok(Math.abs(chute - chuteAttendue) < 1e-7, `la chute du chanfrein vaut ${chute} pour ${chuteAttendue}`)
  }
  // et à zéro, le rang du chanfrein DISPARAÎT — pas un rang plat de plus
  assert.equal(vif.rangs, 3, 'sans chanfrein ni congé, le profil doit tomber à trois rangs')
  assert.equal(SOLIDE.rangs, 7)
  // ⚡ **LA GÉOMÉTRIE D'AVANT LA TÂCHE P13 EST EXACTEMENT RÉCUPÉRABLE** : à
  // fractions nulles, la base a de nouveau la taille du dessus, au bit près.
  const hautVif = etendueRang(vif, 0)
  const basVif = etendueRang(vif, vif.rangs - 1)
  assert.equal(basVif.largeur, hautVif.largeur)
  assert.equal(basVif.profondeur, hautVif.profondeur)
  assert.equal(auditer(vif).sain, true, auditer(vif).raison)
})

test('⑬c LE CONGÉ SUIT UN ARC DE CERCLE, et ses segments se comptent', () => {
  const n = SOLIDE.compte.anneau
  const { positions, baseY, chanfrein, arrondi, rangArc, rangs } = SOLIDE
  assert.equal(rangs - rangArc, ARRONDI_SEG + 1, 'le congé doit porter segArc + 1 rangs')
  // le profil, rang par rang : y = baseY + r(1 − sin θ), rentrée = ch + r(1 − cos θ)
  for (let m = 0; m <= ARRONDI_SEG; m++) {
    const th = (Math.PI / 2) * (m / ARRONDI_SEG)
    const r = rangArc + m
    const yVoulu = baseY + arrondi - arrondi * Math.sin(th)
    const dVoulu = chanfrein + arrondi - arrondi * Math.cos(th)
    let pireY = 0
    let pireD = 0
    for (let k = 0; k < n; k++) {
      pireY = Math.max(pireY, Math.abs(positions[(r * n + k) * 3 + 1] - yVoulu))
      // la rentrée, mesurée PERPENDICULAIREMENT au segment suivant de l'anneau
      const s = (k + 1) % n
      const dx = positions[s * 3] - positions[k * 3]
      const dz = positions[s * 3 + 2] - positions[k * 3 + 2]
      const L = Math.hypot(dx, dz)
      const nx = -dz / L
      const nz = dx / L
      const ox = positions[(r * n + k) * 3] - positions[k * 3]
      const oz = positions[(r * n + k) * 3 + 2] - positions[k * 3 + 2]
      pireD = Math.max(pireD, Math.abs(ox * nx + oz * nz - dVoulu))
    }
    assert.ok(pireY < 3e-8, `rang d arc ${m} : altitude à ${pireY} de l arc`)
    assert.ok(pireD < 3e-8, `rang d arc ${m} : rentrée à ${pireD} de l arc`)
  }
  // le dernier rang est le fond, exactement
  assert.equal(positions[((rangs - 1) * n) * 3 + 1], Math.fround(baseY))
  // ⚡ **BOUGÉ DANS LES DEUX SENS** : le compte de rangs suit `arrondiSeg`.
  for (const seg of [1, 2, 6]) {
    const s = solideAvec({ arrondiSeg: seg })
    assert.equal(s.rangs - s.rangArc, seg + 1, `arrondiSeg ${seg} rend ${s.rangs - s.rangArc} rangs d arc`)
    assert.equal(auditer(s).sain, true)
  }
  // et le congé à zéro rend l'arête vive : un seul rang d'arc, posé au fond
  const sansConge = solideAvec({ fractionArrondi: 0 })
  assert.equal(sansConge.arrondi, 0)
  assert.equal(sansConge.rangs - sansConge.rangArc, 1)
  assert.equal(auditer(sansConge).sain, true)
})

test('⑬d LES NORMALES — le congé est LISSE, le reste est de FACE, et three l arbitre', () => {
  // ⚠️ **L APPARIEMENT DES DEUX ÉCRITURES, PAS UN NOMBRE RECOPIÉ.** `globe.js`
  // dé-indexe puis pose `normalesParois` ; l ORACLE est `computeVertexNormals`
  // de three sur la même géométrie dé-indexée. Là où le congé n est pas en jeu,
  // les deux doivent coïncider ; sur le congé, elles doivent DIFFÉRER — sinon
  // le portage n a rien porté.
  const s = SOLIDE
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(s.positions.slice(), 3))
  geo.setIndex(new THREE.BufferAttribute(s.indices.slice(), 1))
  const plate = geo.toNonIndexed()
  plate.computeVertexNormals()
  const face = plate.getAttribute('normal').array
  const notre = normalesParois(s)
  assert.equal(notre.length, face.length)

  let pireHorsArc = 0
  let pireSurArc = 0
  let arcsFacettes = 0
  for (let t = 0; t < s.indices.length; t += 3) {
    const tri = t / 3
    const surArc = tri >= s.triArc && tri < s.compte.parois
    const lus = []
    for (let c = 0; c < 3; c++) {
      const i = (t + c) * 3
      const a = [notre[i], notre[i + 1], notre[i + 2]]
      const b = [face[i], face[i + 1], face[i + 2]]
      lus.push(a)
      const ecart = angleEntre(a, b)
      if (surArc) pireSurArc = Math.max(pireSurArc, ecart)
      else pireHorsArc = Math.max(pireHorsArc, ecart)
    }
    // ⚠️ **LA DÉFINITION MÊME DE « FACETTE » : les trois coins d un triangle
    // portent la MÊME normale.** Sur le congé, AUCUN triangle ne doit être dans
    // ce cas, sinon les trois segments se liront comme trois facettes —
    // « l inverse exact de l intention » (`plinth.js`).
    //
    // ⛔ **L ÉGALITÉ SE TESTE SUR LES OCTETS, PAS SUR UN ANGLE, ET UNE
    // SURVIVANTE L A MONTRÉ.** Un seuil de 1·10⁻⁶ degré ne tient pas : les
    // normales sont des `Float32`, et `acos` du produit scalaire d un vecteur
    // par LUI-MÊME rend jusqu à 0,015° d écart. La mutation « prendre la
    // normale du premier sommet pour les trois » ne rendait que **1 944 des
    // 6 120 triangles** sous ce seuil, et SURVIVAIT.
    const memeNormale = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
    if (surArc && memeNormale(lus[0], lus[1]) && memeNormale(lus[0], lus[2])) arcsFacettes++
  }
  assert.ok(pireHorsArc < 0.05,
    `hors du congé, nos normales s écartent de celles de three de ${pireHorsArc}°`)
  assert.ok(pireSurArc > 5,
    `sur le congé, nos normales valent celles de face à ${pireSurArc}° près : le congé est facetté`)
  const arcs = s.compte.parois - s.triArc
  assert.ok(arcs > 0, 'le congé ne porte aucun triangle')
  assert.equal(arcsFacettes, 0,
    `${arcsFacettes} triangles de congé sur ${arcs} portent trois normales identiques : c est une facette`)

  // ⚠️ **`triArc` BORNE EXACTEMENT LE CONGÉ, ET ON LE VÉRIFIE PLUTÔT QUE DE LE
  // CROIRE.** Le reste de ce test lit `s.triArc` ; si cette borne était fausse,
  // le test découperait « le congé » ailleurs qu où il est et resterait vert.
  // **Une mutation qui pose `triArc: 0` a survécu pour exactement cette
  // raison.** Le critère indépendant : un triangle est sur le congé si et
  // seulement si ses TROIS sommets sont sur un rang d arc.
  const n = s.compte.anneau
  const premierArc = s.rangArc * n
  for (let t = 0; t < s.compte.parois * 3; t += 3) {
    const surArcGeo = s.indices[t] >= premierArc && s.indices[t + 1] >= premierArc && s.indices[t + 2] >= premierArc
    assert.equal(t / 3 >= s.triArc, surArcGeo,
      `le triangle ${t / 3} : \`triArc\` dit ${t / 3 >= s.triArc}, la géométrie dit ${surArcGeo}`)
  }

  // ⚡ **LES DEUX SOUDURES, MESURÉES.** À θ = 0 la normale du congé vaut celle
  // du MUR (raccord invisible) ; à θ = 90° elle vaut celle du FOND, (0, −1, 0).
  // ⚠️ **ET « HORIZONTALE » NE SUFFIT PAS — UNE SURVIVANTE L A MONTRÉ.** Retourner
  // le SIGNE de l horizontale laisse la normale horizontale ; elle regarde
  // simplement DEDANS. On la confronte donc à la normale de face du mur, pas à
  // un axe.
  const N = s.normales
  const bas = (s.rangs - 1) * n
  // la normale de face du dernier bandeau de MUR, par sommet d anneau
  const murFace = new Map()
  for (let t = (s.triArc - n * 2) * 3; t < s.triArc * 3; t += 3) {
    if (t < 0) continue
    const i = t * 3
    murFace.set(s.indices[t] % n, [face[i], face[i + 1], face[i + 2]])
  }
  let pireRaccord = 0
  for (let k = 0; k < n; k += 97) {
    const debut = [N[(premierArc + k) * 3], N[(premierArc + k) * 3 + 1], N[(premierArc + k) * 3 + 2]]
    assert.ok(Math.abs(debut[1]) < 1e-6, `à θ = 0 la normale du congé n est pas horizontale : ${debut}`)
    const mf = murFace.get(k)
    if (mf) pireRaccord = Math.max(pireRaccord, angleEntre(debut, mf))
    const fin = [N[(bas + k) * 3], N[(bas + k) * 3 + 1], N[(bas + k) * 3 + 2]]
    assert.ok(angleEntre(fin, [0, -1, 0]) < 1e-3, `à θ = 90° la normale du congé vaut ${fin}`)
  }
  assert.ok(murFace.size > n / 2, `le témoin du mur ne couvre que ${murFace.size} sommets sur ${n}`)
  assert.ok(pireRaccord < 1.5,
    `à θ = 0 le congé s écarte de ${pireRaccord}° de la normale du mur : le raccord se verrait`)
  // ⚠️ **ET LE SENS EST VÉRIFIÉ, PAS SUPPOSÉ.** `plinth.js` raconte la version où
  // seule la moitié de la normale était retournée : « la base du socle est
  // traitée comme un objet séparé », a lu Adrien. La normale du fond du crop est
  // vers le BAS — c est ce que la face du fond rend, et le congé doit l épouser.
  const premierFond = s.compte.parois * 3
  const nf = [face[premierFond * 3], face[premierFond * 3 + 1], face[premierFond * 3 + 2]]
  assert.ok(angleEntre(nf, [0, -1, 0]) < 1e-3, `la face du fond regarde ${nf}, pas vers le bas`)
})

test('⑬e L EAU DU CROP ÉTAIT RENTRÉE D UN CHANFREIN QUI N EXISTAIT PAS', () => {
  // ⛔ **LE CONSTAT QUI A DÉCIDÉ LA MONNAIE.** `mer-sphere.js` rentre le rideau
  // d eau de `RETRAIT_EAU_CROP = (0,16 + 0,06) / 28`, « recopié de `plinth.js` »
  // où l eau se pose à `HALF − SOCLE_CHANFREIN − SOCLE_MARGE_EAU`, c est-à-dire
  // DANS le mur. **Tant que le mur du crop n était pas rentré du chanfrein,
  // cette eau était rentrée d un chanfrein de trop** : les deux pièces se
  // lisaient dans deux géométries différentes.
  assert.equal(COTE_CROP_UNITES, 56)
  assert.equal(RETRAIT_EAU_CROP, (SOCLE_CHANFREIN + SOCLE_MARGE_EAU) / (COTE_CROP_UNITES / 2))
  // ⚡ **L INVARIANT QUI APPARIE LES DEUX CONVERSIONS** : le retrait de l eau,
  // moins celui du mur, doit valoir exactement la marge d eau du socle — les
  // deux exprimés en demi-côtés de crop.
  const murEnDemiCotes = 2 * FRACTION_CHANFREIN // 0,16/56 en pleine largeur → 0,16/28 en demi-côté
  assert.ok(Math.abs((RETRAIT_EAU_CROP - murEnDemiCotes) - SOCLE_MARGE_EAU / (COTE_CROP_UNITES / 2)) < 1e-15,
    `l eau et le mur ne se répondent pas : ${RETRAIT_EAU_CROP - murEnDemiCotes}`)
  // et l eau reste STRICTEMENT dans le mur, pas dessus
  assert.ok(RETRAIT_EAU_CROP > murEnDemiCotes)
  // ⚠️ **LE TÉMOIN DE CE QUI ÉTAIT FAUX** : sans chanfrein, l écart entre l eau
  // et le mur valait le chanfrein PLUS la marge — soit 3,67 fois trop.
  const avant = RETRAIT_EAU_CROP / (RETRAIT_EAU_CROP - murEnDemiCotes)
  assert.ok(avant > 3.6 && avant < 3.8, `le témoin d avant vaut ${avant}`)
})

test('⑬f LE GARDE-FOU DU QUART DE MUR — sa marge est MESURÉE, et il mord quand on l y force', () => {
  // ⚠️ **LA TROISIÈME RAISON DE LA TÂCHE B VIVAIT ICI**, et c était la datante :
  // « leur garde-fou est calibré sur un socle à exagération 2,8, le globe est à
  // 18 ». L exagération est FIXE À 2 depuis D10, et surtout les deux valeurs
  // sont ancrées à la LARGEUR, que l exagération ne touche pas. Seul le
  // garde-fou dépend de la hauteur du mur. **On mesure de combien il est loin de
  // mordre, aux deux exagérations, plutôt que de l affirmer.**
  assert.equal(PART_MUR_MAX, 0.25)
  for (const exag of [2, 18]) {
    const s = construireSolideCrop({ ...commun, echelle: (RAYON / RAYON_TERRE_M) * exag, hauteur: relief })
    const mur = s.hautMax - s.baseY
    assert.ok(Math.abs(s.chanfrein - FRACTION_CHANFREIN * s.largeur) < 1e-12,
      `à ×${exag} le chanfrein est rogné : ${s.chanfrein}`)
    assert.ok(Math.abs(s.arrondi - FRACTION_ARRONDI * s.largeur) < 1e-12,
      `à ×${exag} le congé est rogné : ${s.arrondi}`)
    // la marge : de combien le mur devrait s écraser pour que la borne morde
    const margeConge = (mur * PART_MUR_MAX) / s.arrondi
    const margeChanfrein = (mur * PART_MUR_MAX) / s.chanfrein
    assert.ok(margeConge > 5, `à ×${exag} le congé n est qu à ×${margeConge.toFixed(1)} de la borne`)
    assert.ok(margeChanfrein > margeConge, 'le chanfrein doit être plus loin de la borne que le congé')
  }
  // ⚡ **ET IL MORD QUAND ON L Y FORCE** — sans quoi on ne saurait pas qu il est
  // branché. Un bloc plat, profondeur ramenée à un centième : le mur devient
  // plus petit que quatre congés, et les deux rentrées tombent au quart du mur.
  const ecrase = construireSolideCrop({ ...commun, hauteur: plat, fractionProfondeur: FRACTION_PROFONDEUR / 100 })
  const murEcrase = ecrase.hautMax - ecrase.baseY
  assert.ok(ecrase.arrondi < FRACTION_ARRONDI * ecrase.largeur, 'le garde-fou ne rogne rien')
  assert.equal(ecrase.arrondi, murEcrase * PART_MUR_MAX)
  assert.equal(auditer(ecrase).sain, true, auditer(ecrase).raison)
})

test('⑬f bis LE COUVERCLE-TÉMOIN S APPUIE SUR LA SURFACE, pas sur le fond', () => {
  // ⛔ **UNE SURVIVANTE A DÉMASQUÉ CE TROU.** Le couvercle-témoin n est pas
  // livré (§6) : il ne sert qu à refermer la coque pour `auditerSolide`. Mais
  // son sommet est le point de SURFACE au centre du crop, et **`Ā` ne le voit
  // pas** — la fermeture ne dépend que du bord, pas de la position de l apex.
  // Déplacer l apex sur le centre du FOND laissait donc l audit vert, avec un
  // solide qui se traverse lui-même et un VOLUME faux.
  const s = SOLIDE
  const n = s.compte.anneau
  const apex = s.rangs * n + 1
  const centreFond = s.rangs * n
  // l apex est au-dessus du fond, et haut d au moins un quart du mur
  const mur = s.hautMax - s.baseY
  assert.ok(s.positions[apex * 3 + 1] > s.baseY + mur * 0.25,
    `l apex du couvercle est à ${s.positions[apex * 3 + 1]} pour un fond à ${s.baseY}`)
  assert.equal(s.positions[centreFond * 3 + 1], Math.fround(s.baseY))
  // et le couvercle s appuie SUR LUI, pas sur le centre du fond
  for (let c = 0; c < s.indicesCouvercle.length; c += 3) {
    assert.equal(s.indicesCouvercle[c], apex, `le couvercle part du sommet ${s.indicesCouvercle[c]}`)
  }
  // ⚡ **ET LE VOLUME LE MESURE** : posé au fond, l apex ferait perdre au bloc
  // tout le volume de son chapeau. On le rejoue pour le montrer.
  const idxBon = new Uint32Array(s.indices.length + s.indicesCouvercle.length)
  idxBon.set(s.indices)
  idxBon.set(s.indicesCouvercle, s.indices.length)
  const idxFaux = idxBon.slice()
  for (let c = s.indices.length; c < idxFaux.length; c += 3) idxFaux[c] = centreFond
  const vBon = auditerSolide({ geometrie: s.positions, indices: idxBon, axeHauteur: 'y' })
  const vFaux = auditerSolide({ geometrie: s.positions, indices: idxFaux, axeHauteur: 'y' })
  assert.ok(Math.abs(vFaux.volume - vBon.volume) / vBon.volume > 0.05,
    `l apex déplacé ne change le volume que de ${((vFaux.volume - vBon.volume) / vBon.volume) * 100} %`)
})

test('⑬g LE SOLIDE RESTE SAIN AVEC LE CHANFREIN ET LE CONGÉ — aucun triangle dégénéré', () => {
  // ⚠️ **`plinth.js` LAISSE `pousse` JETER LES TRIANGLES DÉGÉNÉRÉS ; ICI ILS
  // SERAIENT COMPTÉS.** Deux rangs peuvent coïncider en un point — un bloc plat
  // dont le congé est plus haut que la bande d occlusion, un bord si bas que son
  // chanfrein tombe déjà sous elle. `auditerSolide` exige `degeneres === 0`.
  for (const [nom, s] of [
    ['relief', SOLIDE],
    ['plat', SOLIDE_PLAT],
    ['accroché', SOLIDE_ACCROCHE],
    ['coin vif', solideAvec({ forme: { coin: 0, expo: 2 } })],
    ['congé large', solideAvec({ fractionArrondi: FRACTION_ARRONDI * 4 })],
    ['un seul segment', solideAvec({ arrondiSeg: 1 })],
  ]) {
    const v = auditer(s)
    assert.equal(v.degeneres, 0, `${nom} : ${v.degeneres} triangle(s) dégénéré(s)`)
    assert.equal(v.sain, true, `${nom} : ${v.raison}`)
    assert.equal(v.oriente, true, `${nom} : volume signé ${v.volume}`)
  }
  // ⚡ **ET LES DEUX SOLIDES EN PORTENT VRAIMENT, EN NOMBRE DIFFÉRENT** : c est
  // la preuve que la garde sert, et qu elle ne sert pas à vide.
  //   · sur le RELIEF : **212 triangles jetés sur 12 240** — les bords les plus
  //     bas, dont le pied de chanfrein tombe déjà sous la bande d occlusion ;
  //   · sur le PLAT : **exactement un bandeau, 2 040** — sa bande d occlusion
  //     (0,12 × mur) est plus basse que son congé (0,129 × mur), donc le rang ②
  //     et le départ du congé se confondent PARTOUT.
  const plein = SOLIDE.compte.anneau * 2 * (SOLIDE.rangs - 1)
  assert.equal(plein, 12240)
  assert.ok(SOLIDE.compte.parois < plein && SOLIDE.compte.parois > plein * 0.9,
    `relief : ${SOLIDE.compte.parois} triangles de paroi sur ${plein}`)
  assert.equal(SOLIDE_PLAT.compte.parois, plein - SOLIDE_PLAT.compte.anneau * 2,
    `plat : ${SOLIDE_PLAT.compte.parois} triangles, il en manque autre chose qu un bandeau`)
  assert.ok(SOLIDE_PLAT.compte.parois < SOLIDE.compte.parois,
    `le solide plat porte ${SOLIDE_PLAT.compte.parois} triangles de paroi, autant que le solide en relief`)
})

test('⑬h `globe.js` POSE nos normales sur la géométrie — EXÉCUTÉ, pas cherché dans le texte', () => {
  // ⛔⛔ **LA LEÇON LA PLUS RÉCENTE DE CE CHANTIER, APPLIQUÉE ICI.** Le tour de
  // correction P8-P12 a démasqué une mutation qui échangeait deux valeurs dans
  // l objet RETOURNÉ et qui a survécu à 4 082 tests, parce que le seul garde
  // était un `assert.match` sur le texte source. **Le trou vivait là où le
  // module exige un renderer — donc là où personne ne l avait exécuté.**
  //
  // ⚠️ **CE CHEMIN-CI N EXIGE PAS DE RENDERER**, seulement three : on peut donc
  // l EXÉCUTER, et c est ce que fait ce test. Il monte le `Globe` minimal du
  // patron de `test/maillage-tuile.test.js` ⑤d, appelle `construireParoisCrop`
  // pour de bon, et confronte l attribut `normal` de la géométrie POSÉE à
  // `normalesParois` du solide bâti à part. **Remettre `computeVertexNormals`
  // dans `globe.js` tombe ici, et nulle part ailleurs.**
  const t = { z: 12, x: 2094, y: 2270, key: '12/2094/2270' }
  const cote = 32
  t.size = cote
  t.heights = new Float32Array(cote * cote)
  for (let j = 0; j < cote; j++) {
    for (let i = 0; i < cote; i++) t.heights[j * cote + i] = 400 + 900 * Math.sin(i * 0.7) * Math.cos(j * 0.5)
  }
  const { lat, lon } = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
  const repere = repereCrop({ centre: { lat, lon }, zoom: t.z, tuilesParBloc: 1 })
  let pose = null
  const faux = {
    _crop: repere,
    _fondCrop: null,
    _parois: null,
    _baseYCrop: null,
    exaggeration: 2,
    tiles: new Map([[t.key, t]]),
    tuilesAvecHauteurs: () => [t],
    uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
    group: { add(m) { pose = m }, remove() {} },
    hauteurDessinee: Globe.prototype.hauteurDessinee,
    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
    _retaillerJupes: () => 0,
    retirerParoisCrop() { this._parois = null },
    _materiauParois: () => null,
  }
  const rendu = Globe.prototype.construireParoisCrop.call(faux, { couvertureMin: 0 })
  assert.ok(rendu && rendu.mesh, `les parois n ont pas été bâties : ${JSON.stringify(rendu && rendu.refus)}`)
  assert.ok(pose, 'la géométrie n a pas été ajoutée au groupe')

  // l ORACLE : le même solide, bâti à part, et NOS normales
  const attendu = construireSolideCrop({
    repere,
    forme: { coin: 0.08, expo: 4.4 },
    hauteur: (la, lo) => faux.hauteurDessinee(la, lo, [t]),
    rayon: R_GLOBE,
    echelle: (R_GLOBE / EARTH_RADIUS_M) * faux.exaggeration,
    plancherMer: 0,
    couvertureMin: 0,
  })
  assert.equal(attendu.refus, null)
  const voulu = normalesParois(attendu)
  const obtenu = pose.geometry.getAttribute('normal').array
  assert.equal(obtenu.length, voulu.length,
    `la géométrie porte ${obtenu.length / 3} normales, le solide en veut ${voulu.length / 3}`)
  let pire = 0
  for (let i = 0; i < voulu.length; i++) pire = Math.max(pire, Math.abs(obtenu[i] - voulu[i]))
  assert.equal(pire, 0, `les normales posées s écartent de ${pire} de `
    + `celles de \`normalesParois\` — \`globe.js\` en calcule d autres`)

  // ⚡ **ET LE TÉMOIN QUI REND CE TEST DISCRIMINANT** : `computeVertexNormals`
  // rendrait AUTRE CHOSE sur le congé. Sans cet écart, l assertion du dessus
  // serait vraie quelle que soit la ligne écrite dans `globe.js`.
  const temoin = pose.geometry.clone()
  temoin.computeVertexNormals()
  const face = temoin.getAttribute('normal').array
  let ecartTemoin = 0
  for (let i = 0; i < face.length; i++) ecartTemoin = Math.max(ecartTemoin, Math.abs(face[i] - voulu[i]))
  assert.ok(ecartTemoin > 0.05,
    `\`computeVertexNormals\` rend la même chose à ${ecartTemoin} près : le test ne distingue rien`)

  // ⛔ **ET L OCCLUSION DE CONTACT AUSSI, PARCE QU UNE SURVIVANTE A MONTRÉ QUE
  // PERSONNE NE LA SUIVAIT JUSQU À LA GÉOMÉTRIE.** Remplacer `solide.couleurs`
  // par un tableau plein de 255 dans `globe.js` — c est-à-dire éteindre l ombre
  // de contact, « ce qui fait lire objet posé plutôt que carte flottante » —
  // passait au travers des 4 095 tests. L attribut porte un NOM PROPRE (`aoCrop`,
  // pas `color`) : c est le nuanceur des parois qui le lit.
  const ao = pose.geometry.getAttribute('aoCrop')
  assert.ok(ao, 'la géométrie posée ne porte pas l attribut `aoCrop`')
  assert.equal(ao.normalized, true, '`aoCrop` doit être normalisé : le nuanceur lit des réels')
  assert.equal(ao.count, obtenu.length / 3)
  let pireAo = 0
  let sombres = 0
  for (let t = 0; t < attendu.indices.length; t++) {
    const src = attendu.indices[t] * 3
    for (let c = 0; c < 3; c++) pireAo = Math.max(pireAo, Math.abs(ao.array[t * 3 + c] - attendu.couleurs[src + c]))
    if (ao.array[t * 3] < 235) sombres++
  }
  assert.equal(pireAo, 0, `l occlusion posée s écarte de ${pireAo} de celle du solide`)
  assert.ok(sombres > attendu.indices.length * 0.05,
    `seuls ${sombres} sommets sur ${attendu.indices.length} portent une ombre de contact : l attribut est plat`)
})

test('⑬i `construireParoisCrop` TRANSMET les trois réglages — l instrument de banc est BRANCHÉ', () => {
  // ⚡ **UN DRAPEAU D INSTRUMENT, PAS UN RÉGLAGE PRODUIT.** La règle D13 retire
  // le cérémonial du « défaut au bit près » mais lui garde une vertu : *« un
  // drapeau qui éteint un changement permet un A/B à témoin nul, et c est ce qui
  // a produit les meilleures preuves du chantier »*. À `fractionChanfrein: 0` et
  // `fractionArrondi: 0`, le bloc retrouve ses arêtes vives d avant la Tâche
  // P13, DANS LA MÊME PAGE — c est ainsi que le liseré a été mesuré à l écran.
  //
  // ⚠️ **ET UN PARAMÈTRE QUI N ARRIVE PAS EST UNE MESURE QUI MENT.** Le §5 bis
  // le rappelle : `FRACTION_PROFONDEUR` était GELÉE parce que `globe.js` ne
  // transmettait pas la tirette, et ça avait l air juste parce que ça coïncidait
  // avec le réglage d usine. On l EXÉCUTE donc, dans les deux sens.
  const t = { z: 12, x: 2094, y: 2270, key: '12/2094/2270' }
  const cote = 32
  t.size = cote
  t.heights = new Float32Array(cote * cote)
  for (let j = 0; j < cote; j++) {
    for (let i = 0; i < cote; i++) t.heights[j * cote + i] = 400 + 900 * Math.sin(i * 0.7) * Math.cos(j * 0.5)
  }
  const { lat, lon } = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
  const repere = repereCrop({ centre: { lat, lon }, zoom: t.z, tuilesParBloc: 1 })
  const bati = (arg) => {
    const faux = {
      _crop: repere,
      _fondCrop: null,
      _parois: null,
      _baseYCrop: null,
      exaggeration: 2,
      tiles: new Map([[t.key, t]]),
      tuilesAvecHauteurs: () => [t],
      uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
      group: { add() {}, remove() {} },
      hauteurDessinee: Globe.prototype.hauteurDessinee,
      _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
      _retaillerJupes: () => 0,
      retirerParoisCrop() { this._parois = null },
      _materiauParois: () => null,
    }
    return Globe.prototype.construireParoisCrop.call(faux, { couvertureMin: 0, ...arg })
  }
  const defaut = bati({}).solide
  assert.equal(defaut.rangs, 7)
  assert.ok(Math.abs(defaut.chanfrein - FRACTION_CHANFREIN * defaut.largeur) < 1e-12,
    'le défaut du module ne traverse pas `construireParoisCrop`')

  // ⚡ DANS UN SENS : on ÉTEINT.
  const vif = bati({ fractionChanfrein: 0, fractionArrondi: 0 }).solide
  assert.equal(vif.chanfrein, 0)
  assert.equal(vif.arrondi, 0)
  assert.equal(vif.rangs, 3)

  // ⚡ DANS L AUTRE : on DOUBLE, et les deux valeurs bougent séparément.
  const gros = bati({ fractionChanfrein: FRACTION_CHANFREIN * 2 }).solide
  assert.ok(Math.abs(gros.chanfrein / defaut.chanfrein - 2) < 1e-9,
    `le chanfrein doublé rend ${gros.chanfrein / defaut.chanfrein}`)
  assert.equal(gros.arrondi, defaut.arrondi, 'doubler le chanfrein a bougé le congé')
  const rond = bati({ fractionArrondi: FRACTION_ARRONDI * 2 }).solide
  assert.ok(Math.abs(rond.arrondi / defaut.arrondi - 2) < 1e-9)
  assert.equal(rond.chanfrein, defaut.chanfrein, 'doubler le congé a bougé le chanfrein')
  const fin = bati({ arrondiSeg: 6 }).solide
  assert.equal(fin.rangs - fin.rangArc, 7, '`arrondiSeg` n atteint pas le module')
})
