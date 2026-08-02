// LE GARDE-FOU DES PLANS D'EAU — il compte, sur du VRAI relief, combien de
// terre ShibuMap peint en eau, et il REFUSE au-delà.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE, et pourquoi les tests synthétiques ne suffisaient pas
// ═══════════════════════════════════════════════════════════════════════════
//
// « Règle-moi une fois pour toutes le problème des mers qui rentrent dans les
// terres avec un garde-fou » — Adrien, 2026-08-02. Une fois pour toutes, parce
// que c'était la QUATRIÈME occurrence :
//
//   · sea-mask.js    — les fausses mers intérieures au zoom grossier ;
//   · bathy.js       — les plateaux rectangulaires en mer (La Ciotat, 6c619db) ;
//   · mer-emprise.js — le seuil de grand bassin sur l'emprise 3×3 ;
//   · ocean.js v40   — « detectLakes prenait des zones plates urbaines pour des
//                       plans d'eau » (les taches bleues d'Annecy).
//
// Les trois premiers portent sur LA MER et sont tenus par test/sea-mask.test.js.
// Le quatrième — celui qui est revenu — porte sur les plans d'eau d'altitude,
// et il n'était tenu par RIEN de mesuré : sa règle (« longueur >= 3 km ») avait
// été posée à l'œil, sur une capture, sans chiffre derrière.
//
// ⚠️ ET test/lake.test.js NE POUVAIT PAS L'ATTRAPER. Ses douze cas sont des
// reliefs SYNTHÉTIQUES : des plateaux rectangulaires posés à la main sur une
// rampe rugueuse. Or le défaut ne vient pas d'une forme qu'on aurait mal
// dessinée, il vient de la STATISTIQUE d'un vrai sol — une plaine alluviale
// dont la pente de quelques mètres au kilomètre, coupée en tranches d'un mètre
// entier par dem-quant.js, fabrique des dentelles de plusieurs kilomètres. On
// ne devine pas ça, on ne peut que le mesurer sur du terrain qui existe.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CE GARDE-FOU REFUSE — DANS LES DEUX SENS
// ═══════════════════════════════════════════════════════════════════════════
//
// Un garde-fou qui n'interdirait que la noyade serait à moitié écrit : « un
// garde-fou qui assèche la Caspienne serait pire que le défaut » (Adrien). Les
// six zones se répartissent donc en deux camps, et chacun a son refus :
//
//   · PLAFOND — Rhône, Camargue, Flevoland, Étretat : la part du bloc peinte en
//     eau animée ne doit pas dépasser le plafond de la zone. Ce test rougit si
//     l'eau reprend du terrain.
//   · PLANCHER — Serre-Ponçon, Sognefjord : le vrai plan d'eau doit TOUJOURS
//     être là, avec au moins son aire mesurée. Ce test rougit si un futur
//     durcissement assèche un lac.
//
// ⚠️ AUCUN ACCÈS RÉSEAU. Les six MNT sont cuits sur le disque
// (test/fixtures/relief, voir scripts/cuire-fixtures-relief.mjs) : un test qui
// téléchargerait son relief ne tournerait ni hors ligne ni en intégration,
// donc ne protègerait rien. C'est la leçon de scripts/verifie-dist.mjs.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectLakes } from '../src/lake.js'
import { plansEauRetenus, partSurfaceEau, mesurePlanEau, LARGEUR_MIN_M, LONGUEUR_MIN_M } from '../src/plan-eau.js'
// ⚠️ LE DÉCODEUR VIENT DU SCRIPT DE CUISSON, il n'est pas recopié ici : deux
// implémentations du même codec finiraient par diverger d'un signe, et un
// relief décodé de travers ne lève AUCUNE erreur — il rend d'autres plans
// d'eau, et le garde-fou se met à protéger un monde qui n'existe pas.
import { decodeRelief } from '../scripts/cuire-fixtures-relief.mjs'

const DOSSIER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'relief')
const MANIFESTE = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'manifeste.json'), 'utf8'))

function chargeRelief(zone) {
  const data = decodeRelief(fs.readFileSync(path.join(DOSSIER, `${zone.nom}.bin.gz`)), zone.cote)
  assert.equal(data.length, zone.cote * zone.cote, `${zone.nom} : taille inattendue`)
  return { data, size: zone.cote }
}

function eauDe(zone) {
  const dem = chargeRelief(zone)
  const cellM = zone.extentMeters / (dem.size - 1)
  const retenus = plansEauRetenus(detectLakes(dem), { cellM })
  return { dem, cellM, retenus, part: partSurfaceEau(retenus, dem.size) }
}

const zone = (nom) => MANIFESTE.find((z) => z.nom === nom)

// ═══════════════════════════════════════════════════════════════════════════
// LE PLAFOND — l'eau ne monte pas sur les terres
// ═══════════════════════════════════════════════════════════════════════════
//
// RELEVÉ DU 2026-08-02, part du bloc peinte en surface d'eau animée :
//
//   zone           | avant   | après   | plafond posé ici
//   ---------------|---------|---------|------------------
//   rhone-valence  | 4,41 %  | 0,00 %  | 0,5 %
//   camargue       | 0,66 %  | 0,00 %  | 0,5 %
//   flevoland      | 0,00 %  | 0,00 %  | 0,5 %
//   etretat        | 0,00 %  | 0,00 %  | 0,5 %
//
// (le même bloc de Valence mesuré EN PRODUCTION, à 1 536² au lieu des 768² de
// la fixture, donnait 8,44 % — la fixture sous-estime le défaut, elle ne
// l'invente pas.)
//
// Le plafond est à 0,5 % et non à zéro : ces quatre zones n'ont pas d'étendue
// d'eau douce notable, mais un plafond EXACT obligerait à rééditer ce fichier
// au moindre changement légitime de détecteur — donc à le contourner, donc à le
// perdre. On borne largement, et ce qu'on attrape c'est le retour de la nappe,
// pas la variation d'un pixel.
const PLAFONDS = {
  'rhone-valence': 0.005,
  camargue: 0.005,
  flevoland: 0.005,
  etretat: 0.005,
}

for (const [nom, plafond] of Object.entries(PLAFONDS)) {
  const z = zone(nom)
  test(`${nom} (${z.quoi}) : l'eau animée ne déborde pas sur les terres`, () => {
    const { part, retenus } = eauDe(z)
    assert.ok(
      part <= plafond,
      `${nom} : ${(part * 100).toFixed(2)} % du bloc peint en eau animée, plafond ${(plafond * 100).toFixed(2)} % ` +
        `(${retenus.length} étendues : ${retenus.map((r) => `${r.lac.elevM} m / ${Math.round(r.mesure.largeurM)} m de large`).join(', ')})`
    )
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// LE PLANCHER — et les vrais lacs restent des lacs
// ═══════════════════════════════════════════════════════════════════════════
//
// RELEVÉ DU 2026-08-02 : Serre-Ponçon ressort en UNE composante de 31 980
// cellules à 771 m (23,3 km² au sol pour un lac de 28,2 km² — le détecteur le
// dessine au pixel près, en Y, avec ses deux bras), et le lac d'altitude du
// Sognefjord en 1 397 cellules à 1 060 m (1,9 km²).
//
// Les planchers sont posés à ~85 % du relevé : ils tolèrent qu'un futur
// détecteur grignote un liseré de rive, ils REFUSENT qu'il perde le lac.
const PLANCHERS = [
  { nom: 'serre-poncon', cellulesMin: 27000, elevM: 771 },
  { nom: 'sognefjord', cellulesMin: 1150, elevM: 1060 },
]

for (const attendu of PLANCHERS) {
  const z = zone(attendu.nom)
  test(`${attendu.nom} (${z.quoi}) : le vrai plan d'eau survit au garde-fou`, () => {
    const { retenus } = eauDe(z)
    const trouve = retenus.find((r) => Math.abs(r.lac.elevM - attendu.elevM) <= 2)
    assert.ok(
      trouve,
      `${attendu.nom} : plus de plan d'eau vers ${attendu.elevM} m — le garde-fou a asséché un vrai lac ` +
        `(restant : ${retenus.map((r) => `${r.lac.elevM} m`).join(', ') || 'aucun'})`
    )
    assert.ok(
      trouve.lac.cells.length >= attendu.cellulesMin,
      `${attendu.nom} : ${trouve.lac.cells.length} cellules, plancher ${attendu.cellulesMin}`
    )
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// L'INVARIANT — la règle elle-même, pas seulement ses effets
// ═══════════════════════════════════════════════════════════════════════════
//
// Les plafonds et planchers ci-dessus disent CE QUI SORT. Celui-ci dit POURQUOI,
// et c'est lui qui tiendra encore si les six zones changent : rien de ce qui est
// posé en eau animée ne peut être plus étroit que la règle. Une future
// exception glissée dans ocean.js — « juste pour ce cas-là » — le fait rougir.
test('aucune étendue retenue n’est plus étroite ni plus courte que la règle', () => {
  for (const z of MANIFESTE) {
    const { retenus } = eauDe(z)
    for (const { lac, mesure } of retenus) {
      assert.ok(
        mesure.largeurM >= LARGEUR_MIN_M,
        `${z.nom} : étendue à ${lac.elevM} m large de ${mesure.largeurM.toFixed(0)} m (< ${LARGEUR_MIN_M})`
      )
      assert.ok(
        mesure.longueurM >= LONGUEUR_MIN_M,
        `${z.nom} : étendue à ${lac.elevM} m longue de ${mesure.longueurM.toFixed(0)} m (< ${LONGUEUR_MIN_M})`
      )
    }
  }
})

// ⚠️ LE DÉFAUT DOIT RESTER REPRODUCTIBLE. Sans ce test, quelqu'un qui rebâtirait
// les fixtures depuis une autre source d'altimétrie pourrait, sans le savoir,
// cuire des MNT où la dentelle n'existe plus — et les quatre plafonds
// passeraient au vert en ne protégeant plus rien. On vérifie donc que la vallée
// du Rhône, SANS le filtre de largeur, noie encore ses terres : c'est la preuve
// que la fixture porte bien le défaut qu'on prétend interdire.
test('la fixture du Rhône porte toujours le défaut — sinon le plafond ne prouve rien', () => {
  const z = zone('rhone-valence')
  const dem = chargeRelief(z)
  const cellM = z.extentMeters / (dem.size - 1)
  // largeur minimale à 0 = l'ancienne règle, la longueur seule
  const avant = plansEauRetenus(detectLakes(dem), { cellM, largeurMinM: 0 })
  const part = partSurfaceEau(avant, dem.size)
  assert.ok(
    part > 0.02,
    `sans le filtre de largeur, la vallée du Rhône ne noie plus que ${(part * 100).toFixed(2)} % du bloc ` +
      `(4,41 % au relevé du 2026-08-02) — la fixture ne porte plus le défaut, le plafond ne prouve plus rien`
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// LA MESURE ELLE-MÊME
// ═══════════════════════════════════════════════════════════════════════════
//
// `largeur = 2 × aire / périmètre` rend exactement la largeur d'un ruban. Si
// cette identité se casse, tous les seuils ci-dessus deviennent du bruit — d'où
// deux témoins analytiques, indépendants de toute donnée.
test('la largeur moyenne d’un ruban est sa largeur, au sens propre', () => {
  const size = 64
  const cellules = []
  for (let y = 20; y < 28; y++) for (let x = 5; x < 45; x++) cellules.push(y * size + x) // 40 × 8
  const m = mesurePlanEau({ cells: Int32Array.from(cellules), size }, 10)
  assert.equal(m.aire, 320)
  assert.equal(m.longueurM, 400) // 40 cellules × 10 m
  // périmètre = 2 × (40 + 8) = 96 arêtes → 2 × 320 × 10 / 96 = 66,67 m ≈ 8 × 10
  assert.ok(Math.abs(m.largeurM - 80) < 14, `largeur ${m.largeurM.toFixed(1)} m, attendu ~80 m`)
})

test('une dentelle d’un pixel de large est mesurée comme telle', () => {
  const size = 64
  const cellules = []
  for (let x = 2; x < 62; x++) cellules.push(30 * size + x) // 60 × 1
  const m = mesurePlanEau({ cells: Int32Array.from(cellules), size }, 10)
  // périmètre = 2 × 60 + 2 = 122 → 2 × 60 × 10 / 122 = 9,8 m
  assert.ok(m.largeurM < 12, `largeur ${m.largeurM.toFixed(1)} m, attendu ~10 m`)
  assert.equal(plansEauRetenus([{ cells: Int32Array.from(cellules), size, elevM: 300 }], { cellM: 100 }).length, 0)
})

// ⚠️ LE TAMPON DE MARQUAGE EST PARTAGÉ ENTRE LACS, et il doit être rendu propre.
// Un seul bit oublié et le lac suivant verrait un voisin fantôme : son périmètre
// baisserait, sa largeur monterait, et une dentelle passerait — en silence.
test('deux étendues mesurées de suite ne se contaminent pas', () => {
  const size = 64
  const a = [], b = []
  for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++) a.push(y * size + x)
  for (let y = 5; y < 25; y++) for (let x = 25; x < 45; x++) b.push(y * size + x) // COLLÉ au premier
  const lacs = [
    { cells: Int32Array.from(a), size, elevM: 100 },
    { cells: Int32Array.from(b), size, elevM: 200 },
  ]
  const r = plansEauRetenus(lacs, { cellM: 200, longueurMinM: 0, largeurMinM: 0 })
  assert.equal(r.length, 2)
  assert.equal(r[0].mesure.largeurM.toFixed(3), r[1].mesure.largeurM.toFixed(3))
})
