// LE SEUIL DU SOCLE — Tâche 3 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ CE QUE CE FICHIER GARDE ═════════════════════════════════════════
//
//   ① LA BASCULE — le socle naît à `SEUIL_NAISSANCE_M`, il ne meurt qu'à
//      `SEUIL_MORT_M`, et les deux seuils sont STRICTEMENT distincts ;
//   ② L'OSCILLATION — cent allers-retours autour d'un seuil ne produisent
//      qu'UNE bascule. C'est l'assertion qui compte : c'est elle que la
//      mutation « égaliser les deux seuils » doit tuer ;
//   ③ LA DÉRIVATION — les deux seuils ne sont pas des chiffres posés : ils se
//      recalculent ici, à partir de `blockExtentMeters` et du champ de vision
//      de `main.js`. Si l'un des deux bouge sans l'autre, le test tombe ;
//   ④ LE ZOOM DU SOCLE — l'arbitrage se rejoue contre la règle R3 du plan : au
//      plafond de zoom que le réseau soutient à 12 Mb/s, le socle doit compter
//      STRICTEMENT PLUS que les 48 texels que R3 disqualifie ;
//   ⑤ L'EMPRISE — `empriseSocle` est le producteur d'`emprise` des Tâches
//      4 bis, 6 et 7. Elle est CONTINUE (elle ne se cale pas sur la grille de
//      tuiles : ce serait un cran), elle franchit l'antiméridien, elle
//      s'écrête à la limite de Mercator, et elle est verrouillée contre
//      `geo.js` — la seule source de vérité du géoréférencement du dépôt ;
//   ⑥ LA RÈGLE R1 — `socleVisible` ne lit QUE l'altitude. Ni débit, ni zoom
//      effectif, ni `meanM`. Un test le vérifie par le comportement ET par le
//      texte source, parce que la régression se glisserait dans un `import`.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SEUIL_NAISSANCE_M,
  SEUIL_MORT_M,
  SEUIL_BLOC_M,
  SEUIL_BLOC_MORT_M,
  ALT_PALIER_Z7_M,
  auBloc,
  ZOOM_SOCLE,
  LARGEUR_SOCLE_M,
  LAT_REFERENCE,
  FOV_DEG,
  FRACTION_NAISSANCE,
  RAPPORT_HYSTERESIS,
  MERCATOR_LAT_MAX,
  altitudePourFraction,
  fractionEcran,
  socleVisible,
  empriseSocle,
} from '../src/monde/seuil-socle.js'

// ⚡ **L'ESPACE DE NOMS ENTIER, EN PLUS DES NOMS.** Un import nommé d'une
// constante supprimée ne rend pas `undefined` : il fait ÉCHOUER LE MODULE au
// chargement, avec une erreur de syntaxe qui ne dit rien de D23. La garde
// « les quatre constantes restent séparées » a besoin de LIRE l'objet.
import * as seuilSocle from '../src/monde/seuil-socle.js'

import { blockExtentMeters, BLOCK_TILES } from '../src/landmarks.js'
import { latLonToTile, tileToLatLon, metersPerPixel } from '../src/geo.js'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const lire = (rel) => fs.readFileSync(path.join(ICI, '..', rel), 'utf8')

// ════════════════════════════════════════════════════════════════════════════
// ① LA BASCULE
// ════════════════════════════════════════════════════════════════════════════

test('les deux seuils sont finis, positifs et STRICTEMENT ordonnés', () => {
  assert.ok(Number.isFinite(SEUIL_NAISSANCE_M) && SEUIL_NAISSANCE_M > 0)
  assert.ok(Number.isFinite(SEUIL_MORT_M) && SEUIL_MORT_M > 0)
  // ⚠️ L'hystérésis EST cette inégalité. Sans elle, tout le reste est décor.
  assert.ok(
    SEUIL_MORT_M > SEUIL_NAISSANCE_M,
    `SEUIL_MORT_M (${SEUIL_MORT_M}) doit être STRICTEMENT supérieur à SEUIL_NAISSANCE_M (${SEUIL_NAISSANCE_M})`
  )
})

test('en DESCENDANT, le socle naît à SEUIL_NAISSANCE_M — et pas avant', () => {
  // au-dessus du seuil de naissance : rien, même juste au-dessus
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_NAISSANCE_M + 1, visibleAvant: false }), false)
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M - 1, visibleAvant: false }), false)
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M + 1, visibleAvant: false }), false)
  // AU seuil, il naît
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_NAISSANCE_M, visibleAvant: false }), true)
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_NAISSANCE_M - 1, visibleAvant: false }), true)
  assert.equal(socleVisible({ altitudeEllipsoideM: 0, visibleAvant: false }), true)
})

test('en REMONTANT, il ne meurt QU\'À SEUIL_MORT_M', () => {
  // toute la bande d'hystérésis : il est déjà là, il reste
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_NAISSANCE_M + 1, visibleAvant: true }), true)
  const milieu = (SEUIL_NAISSANCE_M + SEUIL_MORT_M) / 2
  assert.equal(socleVisible({ altitudeEllipsoideM: milieu, visibleAvant: true }), true)
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M - 1, visibleAvant: true }), true)
  // AU seuil de mort, il meurt
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M, visibleAvant: true }), false)
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M + 1, visibleAvant: true }), false)
})

test('une altitude non finie NE FAIT PAS clignoter : l\'état est conservé', () => {
  for (const mauvaise of [NaN, undefined, null, Infinity, -Infinity, 'douze']) {
    assert.equal(socleVisible({ altitudeEllipsoideM: mauvaise, visibleAvant: true }), true)
    assert.equal(socleVisible({ altitudeEllipsoideM: mauvaise, visibleAvant: false }), false)
  }
  assert.equal(socleVisible(), false)
  assert.equal(socleVisible({}), false)
})

// ════════════════════════════════════════════════════════════════════════════
// ② L'OSCILLATION — LE TEST QUI COMPTE
// ════════════════════════════════════════════════════════════════════════════

// Rejoue une suite d'altitudes et compte les CHANGEMENTS d'état.
function bascules(altitudes, depart = false) {
  let visible = depart
  let n = 0
  for (const a of altitudes) {
    const apres = socleVisible({ altitudeEllipsoideM: a, visibleAvant: visible })
    if (apres !== visible) n++
    visible = apres
  }
  return { bascules: n, visible }
}

test('osciller CENT FOIS autour du seuil de NAISSANCE ne produit qu\'UNE bascule', () => {
  const alt = []
  for (let i = 0; i < 100; i++) {
    alt.push(SEUIL_NAISSANCE_M + 1) // juste au-dessus
    alt.push(SEUIL_NAISSANCE_M - 1) // juste en dessous
  }
  const r = bascules(alt, false)
  assert.equal(r.bascules, 1, `cent oscillations ont produit ${r.bascules} bascules au lieu d'une`)
  assert.equal(r.visible, true)
})

test('osciller CENT FOIS autour du seuil de MORT ne produit qu\'UNE bascule', () => {
  const alt = []
  for (let i = 0; i < 100; i++) {
    alt.push(SEUIL_MORT_M - 1)
    alt.push(SEUIL_MORT_M + 1)
  }
  const r = bascules(alt, true)
  assert.equal(r.bascules, 1, `cent oscillations ont produit ${r.bascules} bascules au lieu d'une`)
  assert.equal(r.visible, false)
})

test('un bruit d\'un mètre autour du seuil de naissance ne rallume rien après la mort', () => {
  // le geste réel : on descend, on naît, on remonte de peu, on redescend.
  // Tant qu'on n'a pas franchi SEUIL_MORT_M, il n'y a AUCUNE seconde bascule.
  const alt = [SEUIL_NAISSANCE_M - 10]
  for (let i = 0; i < 100; i++) alt.push(SEUIL_NAISSANCE_M + (i % 2 ? 500 : -500))
  const r = bascules(alt, false)
  assert.equal(r.bascules, 1)
  assert.equal(r.visible, true)
})

// ════════════════════════════════════════════════════════════════════════════
// ③ LA DÉRIVATION — AUCUN CHIFFRE SANS SA SOURCE (§0)
// ════════════════════════════════════════════════════════════════════════════

test('le champ de vision est celui de `main.js`, pas une recopie qui dérive', () => {
  // ⚠️ Se tromper d'axe (largeur au lieu de hauteur) déplacerait le seuil du
  // rapport d'aspect — 1,7 en 16/9. Le champ de three.js EST vertical.
  const src = lire('src/main.js')
  assert.match(src, /\n\s*fov:\s*30\s*,/, '`main.js` ne pose plus `fov: 30` — la dérivation du seuil est à refaire')
  assert.equal(FOV_DEG, 30)
})

test('les deux seuils DU BLOC SE RECALCULENT depuis la largeur du socle et le champ de vision', () => {
  // ⚠️ **D21 A SÉPARÉ DEUX GRANDEURS QUE CE TEST CONFONDAIT.** Ce sont les
  // seuils de l'ARRIVÉE AU BLOC (une fraction d'écran) qui se dérivent ainsi ;
  // la naissance du crop, elle, est désormais un PALIER — test suivant.
  const attenduBloc = LARGEUR_SOCLE_M / (2 * FRACTION_NAISSANCE * Math.tan((FOV_DEG * Math.PI) / 360))
  assert.ok(Math.abs(SEUIL_BLOC_M - attenduBloc) < 1e-6)
  const attenduBlocMort =
    LARGEUR_SOCLE_M / (2 * FRACTION_NAISSANCE * RAPPORT_HYSTERESIS * Math.tan((FOV_DEG * Math.PI) / 360))
  assert.ok(Math.abs(SEUIL_BLOC_MORT_M - attenduBlocMort) < 1e-6)
})

test('D23 — la NAISSANCE du crop est REVENUE à la paire z10, et le palier z7 ne la porte plus', async () => {
  // ⛔ **D21 ② EST ABROGÉ** (D23, mesure de C1 : 495 → 1 700 tuiles, 19,9 →
  // 129,9 ms à CPU ×4). La naissance du crop est de nouveau la fraction d'écran.
  assert.equal(SEUIL_NAISSANCE_M, SEUIL_BLOC_M)
  assert.equal(SEUIL_MORT_M, SEUIL_BLOC_MORT_M)
  assert.ok(Math.abs(SEUIL_NAISSANCE_M - 32274.3) < 0.1)
  assert.ok(Math.abs(SEUIL_MORT_M - 40342.8) < 0.1)
  // la mort garde l'HYSTÉRÉSIS — le rapport est intact des deux côtés
  assert.ok(Math.abs(SEUIL_MORT_M - SEUIL_NAISSANCE_M / RAPPORT_HYSTERESIS) < 1e-9)
  // ⛔ et le palier z7 ne PORTE plus aucun seuil
  assert.notEqual(SEUIL_NAISSANCE_M, ALT_PALIER_Z7_M)

  // ⚠️ **LE CHIFFRE RESTE RECOPIÉ DANS UN MODULE PUR : ON LE REJOUE CONTRE SA
  // SOURCE.** `modes.js` tire three.js, donc `seuil-socle.js` ne peut pas
  // l'importer. La garde SURVIT à l'abrogation : c'est la seule vérification
  // pure du dépôt contre `DIVE_TIERS`, la retirer avec le seuil serait la perdre.
  const { DIVE_TIERS } = await import('../src/modes.js')
  const z7 = DIVE_TIERS.find((t) => t.zoom === 7)
  assert.ok(z7, '`DIVE_TIERS` n’a plus de palier z7')
  assert.equal(ALT_PALIER_Z7_M, z7.altM, 'le palier z7 recopié a dérivé de `DIVE_TIERS`')
  assert.equal(ALT_PALIER_Z7_M, 600_000)
})

test('D23 — LES QUATRE CONSTANTES RESTENT SÉPARÉES, malgré deux valeurs égales', () => {
  // ⚡ **LA GARDE CENTRALE DE D23**, et elle est de forme inhabituelle : elle ne
  // vérifie pas des nombres, elle vérifie que le MODULE EXPORTE ENCORE QUATRE
  // NOMS. Les deux paires coïncident en valeur depuis le revert — c'est
  // exactement la situation où quelqu'un « simplifie » en supprimant deux
  // constantes, et rouvre au premier seuil redéplacé le défaut que C1 a payé :
  // D19 amputé de 568 km, la deuxième sortie du crop d'Adrien disparue.
  for (const nom of ['SEUIL_BLOC_M', 'SEUIL_BLOC_MORT_M', 'SEUIL_NAISSANCE_M', 'SEUIL_MORT_M']) {
    assert.equal(typeof seuilSocle[nom], 'number',
      `\`${nom}\` a disparu du module — les grandeurs ont été refusionnées`)
    assert.ok(Number.isFinite(seuilSocle[nom]) && seuilSocle[nom] > 0)
  }
  // et les DEUX automates existent toujours, chacun sur SA paire
  assert.equal(typeof seuilSocle.socleVisible, 'function')
  assert.equal(typeof seuilSocle.auBloc, 'function')
  // ⚡ Ce qui les distingue quand les NOMBRES ne les distinguent plus :
  // `socleVisible` demande une intention (D21 ①), `auBloc` n'en demande jamais.
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M + 1, visibleAvant: true, sortieArmee: false }), true)
  assert.equal(auBloc({ altitudeEllipsoideM: SEUIL_BLOC_MORT_M + 1, auBlocAvant: true }), false)
})

test('D21 ① — la MORT demande une INTENTION : sans elle, l’altitude ne tue plus le crop', () => {
  // ⛔ Le défaut qu'Adrien nomme : incliner fait monter l'altitude, et le crop
  // mourait « sans que personne ne l'ait demandé ».
  for (const alt of [SEUIL_MORT_M + 1, SEUIL_MORT_M * 2, 4_000_000, 60_000_000]) {
    assert.equal(
      socleVisible({ altitudeEllipsoideM: alt, visibleAvant: true, sortieArmee: false }), true,
      `le crop meurt à ${alt} m sans intention — D21 ① tombe`
    )
    assert.equal(socleVisible({ altitudeEllipsoideM: alt, visibleAvant: true, sortieArmee: true }), false)
  }
  // ⚠️ L'INTENTION NE PORTE QUE SUR LA MORT : elle ne fait naître personne.
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M + 1, visibleAvant: false, sortieArmee: false }), false)
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M + 1, visibleAvant: false, sortieArmee: true }), false)
  // ⚠️ ET LE DÉFAUT RESTE LA LOI D'ALTITUDE NUE — l'automate de la Tâche 3.
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M + 1, visibleAvant: true }), false)
})

test('D23 — `auBloc` reste un SECOND automate, sur sa propre paire', () => {
  // ⚠️ C'est lui qui arme la bascule de trois quarts (D16 ter) et son miroir, le
  // retour au nadir. Posé pour D21 ② ; **gardé après D23** alors même que sa
  // paire vaut de nouveau celle du crop — c'est le sens qui diffère, pas le
  // nombre.
  assert.equal(auBloc({ altitudeEllipsoideM: SEUIL_BLOC_M + 1, auBlocAvant: false }), false)
  assert.equal(auBloc({ altitudeEllipsoideM: SEUIL_BLOC_M, auBlocAvant: false }), true)
  assert.equal(auBloc({ altitudeEllipsoideM: SEUIL_BLOC_MORT_M - 1, auBlocAvant: true }), true)
  assert.equal(auBloc({ altitudeEllipsoideM: SEUIL_BLOC_MORT_M, auBlocAvant: true }), false)
  // une altitude non finie conserve l'état — même contrat que `socleVisible`
  assert.equal(auBloc({ altitudeEllipsoideM: NaN, auBlocAvant: true }), true)
  assert.equal(auBloc({}), false)
  // ⚠️ **DEPUIS D23 LA NAISSANCE DU CROP EST AUSSI L'ARRIVÉE AU BLOC**, et
  // l'automate le dit — mais il le dit par SON seuil à lui, pas en lisant celui
  // du crop. Sous D21 cette ligne rendait `false` (600 km ≠ 32 km) ; c'est la
  // valeur qui a changé, pas la séparation.
  assert.equal(auBloc({ altitudeEllipsoideM: SEUIL_NAISSANCE_M, auBlocAvant: false }), true)
  // ⛔ et la preuve que la séparation tient : `auBloc` ignore `sortieArmee`,
  // que `socleVisible` honore. Même altitude, deux réponses.
  assert.equal(auBloc({ altitudeEllipsoideM: SEUIL_MORT_M + 1, auBlocAvant: true }), false)
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M + 1, visibleAvant: true, sortieArmee: false }), true)
})

test('à SEUIL_BLOC_M le socle occupe 60 % de la HAUTEUR de l\'image', () => {
  const f = fractionEcran({ largeurM: LARGEUR_SOCLE_M, altitudeM: SEUIL_BLOC_M })
  assert.ok(Math.abs(f - 0.6) < 1e-9, `fraction ${f} au lieu de 0,60`)
  const fMort = fractionEcran({ largeurM: LARGEUR_SOCLE_M, altitudeM: SEUIL_BLOC_MORT_M })
  assert.ok(Math.abs(fMort - 0.48) < 1e-9, `fraction ${fMort} au lieu de 0,48`)
  // aller-retour : `altitudePourFraction` est bien l'inverse de `fractionEcran`
  const a = altitudePourFraction({ largeurM: LARGEUR_SOCLE_M, fraction: 0.37 })
  assert.ok(Math.abs(fractionEcran({ largeurM: LARGEUR_SOCLE_M, altitudeM: a }) - 0.37) < 1e-12)
})

test('le rapport d\'hystérésis est celui de `globe.js`, pas un chiffre neuf', () => {
  const src = lire('src/globe.js')
  assert.match(
    src,
    /MERGE_RATIO\s*=\s*SPLIT_RATIO\s*\*\s*0\.8/,
    '`globe.js` ne porte plus `MERGE_RATIO = SPLIT_RATIO * 0.8` — le rapport du socle est à re-sourcer'
  )
  assert.equal(RAPPORT_HYSTERESIS, 0.8)
  assert.ok(Math.abs(SEUIL_MORT_M / SEUIL_NAISSANCE_M - 1 / 0.8) < 1e-12)
})

// ════════════════════════════════════════════════════════════════════════════
// ④ LE ZOOM DU SOCLE, ET SON ARBITRAGE
// ════════════════════════════════════════════════════════════════════════════

test('la largeur du socle vient de `blockExtentMeters`, jamais d\'une constante recopiée', () => {
  assert.equal(LARGEUR_SOCLE_M, blockExtentMeters(ZOOM_SOCLE, LAT_REFERENCE))
  assert.equal(LAT_REFERENCE, 45) // la latitude de référence du plan
  // et le « socle de 3,56 km » réfuté par le plan ne peut pas revenir
  assert.ok(LARGEUR_SOCLE_M > 4000, 'le fantôme des 3,56 km est de retour')
})

test('R3 — au plafond de zoom soutenu à 12 Mb/s, le socle reste une CARTE FLOUE, pas une autre carte', () => {
  // Mesuré au plan (§2, R3) : à froid, le zoom effectif plafonne à z11 sur
  // 12 Mb/s et z9 sur 4 Mb/s. R3 disqualifie 48 texels sur la largeur du socle
  // — « ce n'est plus le flou accepté par la décision 13, c'est une autre carte ».
  const TEXELS_DISQUALIFIANTS = 48
  const texelsA = (zoomReseau) => LARGEUR_SOCLE_M / metersPerPixel(LAT_REFERENCE, zoomReseau)
  assert.ok(
    texelsA(11) > TEXELS_DISQUALIFIANTS,
    `à z11 le socle ne compte que ${texelsA(11).toFixed(0)} texels — au plafond de 12 Mb/s, R3 le refuse`
  )
  // et la borne haute : le socle ne peut pas dépasser le plafond du quadtree
  const globe = lire('src/globe.js')
  const maxZ = Number(globe.match(/export const MAX_Z\s*=\s*(\d+)/)[1])
  assert.ok(ZOOM_SOCLE <= maxZ, `ZOOM_SOCLE ${ZOOM_SOCLE} dépasse MAX_Z ${maxZ} : le quadtree ne peut pas le remplir`)
  assert.ok(maxZ - ZOOM_SOCLE >= 1, 'le socle doit garder au moins un niveau de marge sous le plafond du quadtree')
})

// ════════════════════════════════════════════════════════════════════════════
// ⑤ L'EMPRISE — LE PRODUCTEUR DES TÂCHES 4 bis, 6 ET 7
// ════════════════════════════════════════════════════════════════════════════

const CHAMONIX = { lat: 45.9237, lon: 6.8694 }

test('l\'emprise fait BLOCK_TILES tuiles de côté au zoom demandé', () => {
  const e = empriseSocle({ centre: CHAMONIX, zoom: ZOOM_SOCLE })
  const largeurDeg = (BLOCK_TILES / 2 ** ZOOM_SOCLE) * 360
  assert.ok(Math.abs(e.est - e.ouest - largeurDeg) < 1e-9)
  assert.ok(e.nord > e.sud)
  for (const v of [e.ouest, e.sud, e.est, e.nord]) assert.ok(Number.isFinite(v))
})

test('l\'emprise est CENTRÉE sur le centre demandé', () => {
  const e = empriseSocle({ centre: CHAMONIX, zoom: ZOOM_SOCLE })
  assert.ok(Math.abs((e.ouest + e.est) / 2 - CHAMONIX.lon) < 1e-9)
  // en latitude le centre est celui de MERCATOR, pas la moyenne des degrés
  const t = latLonToTile(CHAMONIX.lat, CHAMONIX.lon, ZOOM_SOCLE)
  const tn = latLonToTile(e.nord, e.ouest, ZOOM_SOCLE)
  const ts = latLonToTile(e.sud, e.ouest, ZOOM_SOCLE)
  assert.ok(Math.abs((tn.y + ts.y) / 2 - t.y) < 1e-9)
})

test('l\'emprise est VERROUILLÉE contre `geo.js` — pas une trigonométrie réinventée', () => {
  // `geo.js` est la source de vérité du géoréférencement du dépôt. Ce module
  // reste PUR (geo.js tire three.js et terrain.js) : la recopie est donc
  // gardée ici, numériquement, et non par un espoir.
  for (const centre of [CHAMONIX, { lat: 0, lon: 0 }, { lat: -33.9, lon: 151.2 }, { lat: 71, lon: -8.3 }]) {
    for (const zoom of [9, 13, 15]) {
      const e = empriseSocle({ centre, zoom })
      const t = latLonToTile(centre.lat, centre.lon, zoom)
      const demi = BLOCK_TILES / 2
      const attendu = {
        ouest: tileToLatLon(t.x - demi, t.y, zoom).lon,
        est: tileToLatLon(t.x + demi, t.y, zoom).lon,
        nord: tileToLatLon(t.x, t.y - demi, zoom).lat,
        sud: tileToLatLon(t.x, t.y + demi, zoom).lat,
      }
      assert.ok(Math.abs(e.nord - attendu.nord) < 1e-9, `nord ${e.nord} vs ${attendu.nord}`)
      assert.ok(Math.abs(e.sud - attendu.sud) < 1e-9, `sud ${e.sud} vs ${attendu.sud}`)
      assert.ok(Math.abs(e.ouest - attendu.ouest) < 1e-9, `ouest ${e.ouest} vs ${attendu.ouest}`)
      assert.ok(Math.abs(e.est - attendu.est) < 1e-9, `est ${e.est} vs ${attendu.est}`)
    }
  }
})

test('la largeur au sol de l\'emprise EST `blockExtentMeters` — les deux vérités ne divergent pas', () => {
  const R = 6378137 // `landmarks.js`, `R_EARTH`
  for (const lat of [0, 45, 60, -33.9]) {
    const e = empriseSocle({ centre: { lat, lon: 12 }, zoom: ZOOM_SOCLE })
    const largeurM = ((e.est - e.ouest) * Math.PI) / 180 * R * Math.cos((lat * Math.PI) / 180)
    const attendu = blockExtentMeters(ZOOM_SOCLE, lat)
    assert.ok(Math.abs(largeurM / attendu - 1) < 1e-6, `à ${lat}° : ${largeurM} m contre ${attendu} m`)
  }
})

test('⚠️ L\'EMPRISE EST CONTINUE — elle NE SE CALE PAS sur la grille de tuiles', () => {
  // C'est le pivot lui-même : « un Google Maps like, PAS DES CRANS ». Une
  // emprise calée sur les origines entières de tuiles sauterait d'UN TIERS de
  // socle d'un coup. `originesEmprise` (dem-emprise.js) fait exactement ce
  // calage-là — c'est pourquoi elle ne peut pas tenir ce rôle.
  const pas = 1e-5 // degrés
  let precedent = null
  for (let i = 0; i < 400; i++) {
    const e = empriseSocle({ centre: { lat: 45.9, lon: 6.8 + i * pas }, zoom: ZOOM_SOCLE })
    if (precedent) {
      const d = e.ouest - precedent
      assert.ok(Math.abs(d - pas) < 1e-9, `saut de ${d}° au lieu de ${pas}° : l'emprise se cale sur une grille`)
    }
    precedent = e.ouest
  }
})

test('l\'antiméridien est LÉGAL : `ouest > est` le signale', () => {
  const e = empriseSocle({ centre: { lat: 0, lon: 179.995 }, zoom: ZOOM_SOCLE })
  assert.ok(e.ouest > e.est, `ouest ${e.ouest} devrait dépasser est ${e.est}`)
  for (const v of [e.ouest, e.est]) assert.ok(v >= -180 && v <= 180)
  // et hors antiméridien, jamais
  const n = empriseSocle({ centre: CHAMONIX, zoom: ZOOM_SOCLE })
  assert.ok(n.ouest < n.est)
})

test('au-delà de la limite de Mercator, la latitude est ÉCRÊTÉE', () => {
  for (const lat of [85.1, 88, 89.999, -85.1, -89.999]) {
    const e = empriseSocle({ centre: { lat, lon: 10 }, zoom: ZOOM_SOCLE })
    assert.ok(e.nord <= MERCATOR_LAT_MAX + 1e-9, `nord ${e.nord}`)
    assert.ok(e.sud >= -MERCATOR_LAT_MAX - 1e-9, `sud ${e.sud}`)
    assert.ok(e.nord > e.sud)
  }
})

test('aux zooms où trois tuiles font le tour du monde, l\'emprise couvre le monde', () => {
  for (const zoom of [0, 1]) {
    const e = empriseSocle({ centre: CHAMONIX, zoom })
    assert.equal(e.ouest, -180)
    assert.equal(e.est, 180)
  }
})

test('empriseSocle rend le socle par défaut, sans qu\'on ait à répéter le zoom', () => {
  const a = empriseSocle({ centre: CHAMONIX })
  const b = empriseSocle({ centre: CHAMONIX, zoom: ZOOM_SOCLE })
  assert.deepEqual(a, b)
})

// ════════════════════════════════════════════════════════════════════════════
// ⑥ LA RÈGLE R1 — LE SEUIL NE LIT QUE L'ALTITUDE
// ════════════════════════════════════════════════════════════════════════════

test('R1 — ni le débit, ni le zoom effectif, ni `meanM` ne changent la bascule', () => {
  const alt = SEUIL_NAISSANCE_M - 1
  const nu = socleVisible({ altitudeEllipsoideM: alt, visibleAvant: false })
  for (const bruit of [
    { debitObserveMbs: 0.01, zoomEffectif: 2 },
    { debitObserveMbs: 1000, zoomEffectif: 15 },
    { meanM: 4808, altitudeSolM: 12 },
  ]) {
    assert.equal(socleVisible({ altitudeEllipsoideM: alt, visibleAvant: false, ...bruit }), nu)
  }
})

test('R1 — le module n\'importe RIEN qui dérive du terrain chargé ou du réseau', () => {
  const src = lire('src/monde/seuil-socle.js')
  const imports = [...src.matchAll(/^import[^\n]*from\s*'([^']+)'/gm)].map((m) => m[1])
  for (const i of imports) {
    assert.ok(
      /landmarks\.js$/.test(i),
      `import interdit : « ${i} ». Ce module reste PUR et ne lit que la largeur du socle.`
    )
  }
  // et le CORPS ne nomme aucune grandeur lissée ni réseau
  const corps = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const interdit of ['meanM', 'debit', 'zoomEffectif', 'zoomSoutenable', 'THREE']) {
    assert.ok(!corps.includes(interdit), `le corps du module nomme « ${interdit} » — R1 l'interdit`)
  }
})

test('le module est branché sur le plan, et le plan le sait', () => {
  const plan = lire('docs/superpowers/plans/2026-08-08-globe-continu.md')
  for (const nom of ['socleVisible', 'empriseSocle', 'SEUIL_NAISSANCE_M', 'SEUIL_MORT_M']) {
    assert.ok(plan.includes(nom), `le plan ne nomme plus « ${nom} »`)
  }
})
