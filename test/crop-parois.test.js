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
  occlusionContact,
  FRACTION_PROFONDEUR,
  PAS_CONTOUR,
} from '../src/monde/parois-crop.js'
import { repereCrop, coinNormalise, latLonDeLocal, localCrop } from '../src/monde/crop-sphere.js'
import { auditerSolide } from '../src/monde/audit-solide.js'
import { dansDalle } from '../src/damier-bords.js'
import { dansFenetre, exposantCoin } from '../src/fenetre-clip.js'
import { ZOOM_SOCLE, LARGEUR_SOCLE_M } from '../src/monde/seuil-socle.js'
import { contactAO, bandeContact, SOCLE_AO_BANDE, SOCLE_AO_FORCE } from '../src/plinth.js'

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

test('LES PAROIS SONT VERTICALES ET PARALLÈLES — pas radiales', () => {
  // ⚠️ **LA DÉCISION D'ADRIEN, ET ELLE PRIME SUR LA JUSTESSE PHYSIQUE.** Dans le
  // repère local du crop, `y` EST la verticale (le rayon au centre du crop) :
  // une paroi verticale a donc, en haut et en bas, exactement les mêmes `x` et
  // `z`. Des parois RADIALES les feraient converger vers le centre de la
  // planète, et l'écart serait de `profondeur / rayon` — mesuré plus bas.
  const { positions, anneau } = SOLIDE
  const n = anneau.length
  let pire = 0
  for (let k = 0; k < n; k++) {
    const h = k * 3
    const b = (n + k) * 3
    pire = Math.max(pire, Math.abs(positions[h] - positions[b]), Math.abs(positions[h + 2] - positions[b + 2]))
  }
  assert.equal(pire, 0, `l empreinte se déplace de ${pire} unité entre le haut et le bas`)
})

test('LA BASE A LA MÊME TAILLE QUE LE DESSUS, et elle est PLATE', () => {
  const { positions, anneau, baseY } = SOLIDE
  const n = anneau.length
  // plate : tous les sommets du bas sont exactement à `baseY`. ⚠️ `Math.fround`
  // parce que `positions` est un Float32Array : sans lui l'assertion mesurerait
  // l'arrondi du tampon, pas la planéité du fond.
  const plancher = Math.fround(baseY)
  for (let k = 0; k < n; k++) {
    assert.equal(positions[(n + k) * 3 + 1], plancher, `le sommet bas ${k} n est pas sur le plan de base`)
  }
  // même taille : l'étendue horizontale du bas est celle du haut, au bit près
  const etendue = (offset) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (let k = 0; k < n; k++) {
      const p = (offset + k) * 3
      x0 = Math.min(x0, positions[p]); x1 = Math.max(x1, positions[p])
      z0 = Math.min(z0, positions[p + 2]); z1 = Math.max(z1, positions[p + 2])
    }
    return { largeur: x1 - x0, profondeur: z1 - z0 }
  }
  const haut = etendue(0)
  const bas = etendue(n)
  assert.equal(bas.largeur, haut.largeur, 'la base n a pas la largeur du dessus')
  assert.equal(bas.profondeur, haut.profondeur, 'la base n a pas la profondeur du dessus')
  // et le témoin : des parois RADIALES auraient rétréci la base de ce facteur-là
  const retrait = haut.largeur * ((SOLIDE.hautMax - baseY) / RAYON)
  assert.ok(retrait > 1e-6, `le témoin radial est trop petit pour valoir preuve : ${retrait}`)
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
  // MESURE SUR CE BANC : **38,9**. Le seuil est pose a 20, entre le solide a
  // relief (38,9) et le pave du test suivant (**1,003**) — un ordre de grandeur
  // de marge de chaque cote, et les deux chiffres sont dans les messages.
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
  const { couleurs, positions, anneau, baseY, bande } = SOLIDE
  const n = anneau.length
  assert.equal(couleurs.length, positions.length / 3 * 3)
  // au pied du mur : l'assombrissement plein
  const aoPied = couleurs[n * 3] / 255
  assert.ok(aoPied < 0.85, `le pied du mur n est pas assombri : ${aoPied}`)
  // très au-dessus de la bande : plein jour
  let clair = 0
  for (let k = 0; k < n; k++) if (positions[k * 3 + 1] > baseY + bande * 2) clair++
  assert.ok(clair > n * 0.5, 'moins de la moitié de l anneau haut est hors de la bande de contact')
})

// ══════════ ⑧ LE NUANCEUR — LA COUVERTURE DOUCE, VÉRIFIÉE COMME TEXTE ═══════

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const CORPS = GLOBE_SRC.slice(GLOBE_SRC.indexOf('uCropOn > 0.5'))

test('LE `discard` BINAIRE EST DEVENU UNE COUVERTURE DOUCE', () => {
  // ⚠️ MESURÉ, PAS JUGÉ À L ŒIL : `gl.getContextAttributes().antialias === false`
  // (relevé de la Tâche A). Un `discard` donne une frontière binaire, donc les
  // coins crénellent. La surface passe à un `smoothstep` sur la distance signée.
  assert.ok(/smoothstep/.test(CORPS), 'aucun `smoothstep` après la garde du crop')
  assert.ok(/couvertureCrop/.test(GLOBE_SRC), 'la couverture n est pas nommée')
  // ⚠️ ET ELLE DOIT SORTIR DU NUANCEUR : une couverture calculée puis jetée
  // serait exactement le `discard` binaire d avant, avec un `smoothstep` mort à
  // côté pour rassurer le lecteur.
  assert.ok(/gl_FragColor\s*=\s*vec4\(\s*col\s*,\s*couvertureCrop\s*\)/.test(GLOBE_SRC),
    'la couverture ne part pas dans l alpha du fragment')
  // ⚠️ ET L ALPHA NE VEUT RIEN DIRE SANS MÉLANGE : il faut que le matériau des
  // tuiles passe en `transparent` quand le crop est posé — et SEULEMENT alors.
  assert.ok(/transparent:\s*!!this\._crop/.test(GLOBE_SRC), 'le mélange ne suit pas le crop')
  assert.ok(/_melangeCrop\s*\(/.test(GLOBE_SRC), 'les matériaux déjà créés ne sont pas repris')
  // ⚠️ ET LA PROFONDEUR RESTE ÉCRITE : sans elle, 750 tuiles transparentes se
  // mélangeraient les unes aux autres au lieu de s occulter.
  assert.ok(/depthWrite:\s*true/.test(GLOBE_SRC), 'la profondeur n est plus écrite')
})

test('LA LARGEUR DU FONDU VIENT DE `fwidth`, JAMAIS D UNE CONSTANTE', () => {
  // ⚠️ **UNE CONSTANTE NE SERAIT JUSTE QU À UNE SEULE ALTITUDE.** La largeur se
  // mesure en unités-monde à partir de la dérivée d écran.
  const fondu = CORPS.slice(0, CORPS.indexOf('float h = decodeMetersAA'))
  assert.ok(/fwidth\s*\(/.test(fondu), 'la largeur du fondu n est pas dérivée de `fwidth`')
  assert.ok(/smoothstep\([^)]*w[^)]*\)/.test(fondu) || /smoothstep\(\s*-\s*\w+/.test(fondu),
    'le `smoothstep` ne s appuie pas sur la largeur mesurée')
})

test('LE `discard` RESTE — au-delà d un pixel, on ne paie pas le mélange', () => {
  // ⚠️ Le plan est explicite : « Le `discard` reste au-delà d un pixel, sinon on
  // paie le mélange sur toute la tuile. »
  assert.ok(/\bdiscard\s*;/.test(CORPS), 'le `discard` a disparu : toute la tuile paierait le fondu')
  // et il reste GARDÉ par l interrupteur — la production est intouchée
  assert.ok(/uCropOn\s*>\s*0\.5/.test(GLOBE_SRC), 'le discard n est plus gardé par uCropOn')
  assert.ok(/uCropOn:\s*\{\s*value:\s*0\b/.test(GLOBE_SRC), 'uCropOn ne naît plus à zéro')
})

test('le globe expose la pose ET LE RETRAIT des parois', () => {
  assert.ok(/construireParoisCrop\s*\(/.test(GLOBE_SRC), 'pas de `construireParoisCrop`')
  assert.ok(/retirerParoisCrop\s*\(/.test(GLOBE_SRC), 'pas de `retirerParoisCrop` — les parois seraient irréversibles')
  assert.ok(/from '\.\/monde\/parois-crop\.js'/.test(GLOBE_SRC), 'globe.js ne lit pas la loi des parois')
  assert.ok(/hauteurSurface\s*\(/.test(GLOBE_SRC), 'pas de lecture de la surface exacte au point de coupe')
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
