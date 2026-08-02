// LE GARDE-FOU DES PLANS D'EAU — il compte, sur du VRAI relief, combien de
// terre ShibuMap peint en eau, et il REFUSE au-delà. Dans les deux sens.
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
// Le quatrième — celui qui est revenu à Brest — porte sur les plans d'eau
// d'altitude, et il n'était tenu par RIEN de mesuré : sa règle (« longueur
// >= 3 km ») avait été posée à l'œil, sur une capture, sans chiffre derrière.
//
// ⚠️ ET test/lake.test.js NE POUVAIT PAS L'ATTRAPER. Ses douze cas sont des
// reliefs SYNTHÉTIQUES : des plateaux rectangulaires posés à la main sur une
// rampe rugueuse. Or le défaut ne vient pas d'une forme qu'on aurait mal
// dessinée, il vient de la STATISTIQUE d'un vrai sol — une pente de quelques
// mètres au kilomètre, coupée en tranches d'un mètre entier par dem-quant.js,
// fabrique des dentelles de plusieurs kilomètres. On ne devine pas ça, on ne
// peut que le mesurer sur du terrain qui existe.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES TROIS REFUS, ET POURQUOI IL EN FAUT TROIS
// ═══════════════════════════════════════════════════════════════════════════
//
// Un garde-fou qui n'interdirait que la noyade serait à moitié écrit : « un
// garde-fou qui assèche la Caspienne serait pire que le défaut » (Adrien). Et
// la tentative annulée du 2026-08-02 a montré qu'il en manquait un TROISIÈME,
// celui qui a coûté le revert :
//
//   · PLAFOND — Rhône (deux finesses), Brest, Paris, Camargue, Flevoland,
//     Étretat : la part du bloc peinte en eau animée ne dépasse pas le plafond.
//     Rougit si l'eau reprend du terrain.
//   · PLANCHER — Serre-Ponçon, Sognefjord, Annecy : le vrai plan d'eau est
//     TOUJOURS là, avec au moins son aire mesurée. Rougit si un durcissement
//     assèche un lac.
//   · ⚠️ INVARIANCE PAR FINESSE — Annecy z12 contre Annecy z15, la MÊME eau à
//     deux pas au sol. C'est le refus qui manquait : un seuil peut sembler
//     invariant (« il est en mètres, donc… ») et ne pas l'être, et personne ne
//     s'en aperçoit tant qu'un seul zoom est testé. C'est exactement le reproche
//     fait à la tentative annulée — « au-delà de z10, plus aucun lac ».
//
// ⚠️ AUCUN ACCÈS RÉSEAU. Les onze MNT sont cuits sur le disque
// (test/fixtures/relief, voir scripts/cuire-fixtures-relief.mjs) : un test qui
// téléchargerait son relief ne tournerait ni hors ligne ni en intégration,
// donc ne protègerait rien. C'est la leçon de scripts/verifie-dist.mjs.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectLakes } from '../src/lake.js'
import {
  plansEauRetenus,
  partSurfaceEau,
  mesurePlanEau,
  longueurMinM,
  LARGEUR_MIN_M,
  LONGUEUR_MIN_M,
} from '../src/plan-eau.js'
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

function eauDe(zone, options = {}) {
  const dem = chargeRelief(zone)
  const cellM = zone.extentMeters / (dem.size - 1)
  const retenus = plansEauRetenus(detectLakes(dem), { cellM, blocM: zone.extentMeters, ...options })
  return { dem, cellM, retenus, part: partSurfaceEau(retenus, dem.size) }
}

const zone = (nom) => {
  const z = MANIFESTE.find((x) => x.nom === nom)
  assert.ok(z, `fixture ${nom} absente du manifeste`)
  return z
}

// ═══════════════════════════════════════════════════════════════════════════
// LE PLAFOND — l'eau ne monte pas sur les terres
// ═══════════════════════════════════════════════════════════════════════════
//
// RELEVÉ DU 2026-08-02, part du bloc peinte en surface d'eau animée :
//
//   zone           | pas au sol | avant    | après   | plafond posé ici
//   ---------------|------------|----------|---------|------------------
//   rhone-valence  |   27,1 m   |  4,41 %  | 0,00 %  | 0,5 %
//   rhone-fin      |   13,5 m   | 23,19 %  | 0,00 %  | 0,5 %
//   brest          |   12,7 m   |  3,95 %  | 0,00 %  | 0,5 %
//   paris-idf      |   25,2 m   |  1,01 %  | 0,00 %  | 0,5 %
//   camargue       |   27,8 m   |  0,66 %  | 0,00 %  | 0,5 %
//   flevoland      |   23,3 m   |  0,00 %  | 0,00 %  | 0,5 %
//   etretat        |   24,8 m   |  0,00 %  | 0,00 %  | 0,5 %
//
// ⚠️ LIRE LES DEUX LIGNES DU RHÔNE ENSEMBLE. La même vallée noie 4,41 % à
// 27 m/cellule et 23,19 % à 13,5 m : la finesse ne dilue pas la dentelle, elle
// en fabrique cinq fois plus. Un garde-fou calibré sur la seule vue grossière
// aurait été calibré cinq fois trop bas, et serait resté vert pendant que
// l'écran, lui, se couvrait d'eau.
//
// Le plafond est à 0,5 % et non à zéro : ces zones n'ont pas d'étendue d'eau
// douce notable, mais un plafond EXACT obligerait à rééditer ce fichier au
// moindre changement légitime de détecteur — donc à le contourner, donc à le
// perdre. On borne largement ; ce qu'on attrape c'est le retour de la nappe,
// pas la variation d'un pixel.
const PLAFONDS = {
  'rhone-valence': 0.005,
  'rhone-fin': 0.005,
  brest: 0.005,
  'paris-idf': 0.005,
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
// 🔴 LE DÉFAUT OUVERT — Dijon/Dole, et le garde-fou qui ne le voyait pas
// ═══════════════════════════════════════════════════════════════════════════
//
// Ces deux zones NE SONT PAS dans PLAFONDS, et ce n'est pas un oubli : le
// défaut d'Adrien y est ENCORE PRÉSENT, personne ne sait le corriger sans
// perdre le Rhône (voir le mur des quatre critères en tête de plan-eau.js), et
// un plafond rouge en permanence serait un plafond qu'on finirait par retirer.
//
// ⚠️ CE QUI EST TENU ICI, C'EST LA FIDÉLITÉ DE LA FIXTURE, PAS LE PRODUIT. Le
// garde-fou a été AVEUGLE à ce défaut jusqu'au 2026-08-02 : ses fixtures
// venaient d'AWS quand la production sert mapterhorn, et le champ AWS (EU-DEM
// 25 m surzoomé) hache les bandes de contour que le champ mapterhorn (RGE ALTI
// 1 m moyenné) rend larges et d'un seul tenant. Au MÊME pas au sol :
//
//   fixture               | source     | retenues | part du bloc | largeurs
//   ----------------------|------------|----------|--------------|----------
//   dijon-large (25,9 m)  | AWS        |     0    |    0,00 %    | max 128 m
//   dijon-large (25,9 m)  | mapterhorn |    14    |    4,08 %    | 150-215 m
//   l'ÉCRAN d'Adrien, z11 | mapterhorn |    14    |    4,08 %    | 150-215 m
//
// La ligne mapterhorn et la ligne de l'écran sont IDENTIQUES, au chiffre près.
// C'est ce que ces tests verrouillent : le jour où quelqu'un recuit ces
// fixtures depuis une autre source, ou déplace le seuil de largeur, ils
// rougissent — et le garde-fou ne pourra pas redevenir vert sur un monde qui
// n'est pas celui de l'écran.
//
// ⚠️ QUAND LE DÉFAUT SERA CORRIGÉ, CES DEUX TESTS ROUGIRONT. C'est voulu :
// c'est le signal qu'on peut les remplacer par une entrée dans PLAFONDS. Ne
// les supprime pas sans poser le plafond à la place.
const DEFAUT_OUVERT = [
  { nom: 'dijon-large', retenues: 14, part: 0.0408, largeurMin: 150, largeurMax: 215 },
  { nom: 'dijon-dole', retenues: 3, part: 0.0165, largeurMin: 153, largeurMax: 182 },
]

for (const attendu of DEFAUT_OUVERT) {
  const z = zone(attendu.nom)
  test(`${attendu.nom} (${z.quoi}) : la fixture reproduit EXACTEMENT l’écran d’Adrien`, () => {
    // La source est la PREMIÈRE chose vérifiée : c'est elle qui a rendu le
    // garde-fou aveugle, et un `source` retombé sur AWS remettrait tout le
    // reste à zéro en donnant l'impression que le défaut a disparu.
    assert.equal(z.source, 'mapterhorn', `${attendu.nom} : cuite depuis « ${z.source} » — la production sert mapterhorn`)
    const { retenus, part } = eauDe(z)
    assert.equal(retenus.length, attendu.retenues, `${attendu.nom} : ${retenus.length} étendues au lieu de ${attendu.retenues}`)
    assert.ok(
      Math.abs(part - attendu.part) < 0.001,
      `${attendu.nom} : ${(part * 100).toFixed(2)} % du bloc, relevé à l'écran ${(attendu.part * 100).toFixed(2)} %`
    )
    const w = retenus.map((r) => r.mesure.largeurM)
    assert.ok(
      Math.min(...w) >= attendu.largeurMin - 2 && Math.max(...w) <= attendu.largeurMax + 2,
      `${attendu.nom} : largeurs ${Math.min(...w).toFixed(0)}-${Math.max(...w).toFixed(0)} m, relevé ${attendu.largeurMin}-${attendu.largeurMax} m`
    )
  })
}

// ⚠️ ET LE SEUIL DE LARGEUR EST MUET ICI — c'est LE fait qui a coûté trois
// tentatives. Les dentelles de Dijon ne CONTOURNENT pas la règle des 150 m,
// elles la SATISFONT, parce qu'une bande de contour vaut 1 m ÷ pente et que la
// plaine de la Saône descend de 5 m au kilomètre.
//
// CE TEST EXISTE POUR QUI ARRIVE ICI AVEC L'IDÉE DE « JUSTE REMONTER LE SEUIL ».
// Balayage mesuré sur cette fixture, le Rhône à Valence faisant 170 m de large
// (relevé sur l'instance vivante, z12 comme z14) :
//
//   seuil  | dentelles gardées à Dijon | part du bloc | le Rhône ?
//   -------|---------------------------|--------------|------------
//   150 m  |          14               |    4,08 %    | gardé
//   171 m  |           7               |    2,11 %    | PERDU
//   200 m  |           3               |    1,16 %    | PERDU
//   215 m  |           0               |    0,00 %    | PERDU
//
// Il faut 215 m pour vider Dijon et le fleuve en fait 170 : les deux camps se
// CHEVAUCHENT, il n'y a pas de seuil entre eux. Au plus haut seuil qui garde
// encore le Rhône, la plaine reste à 2,11 % — quatre fois le plafond de 0,5 %
// que toutes les autres plaines tiennent.
const PLAFOND_PLAINES = 0.005
const RHONE_VALENCE_M = 170

test('aucun seuil de largeur ne vide Dijon sans effacer le Rhône', () => {
  const z = zone('dijon-large')
  const dem = chargeRelief(z)
  const cellM = z.extentMeters / (dem.size - 1)
  const lacs = detectLakes(dem)
  // le seuil le plus exigeant qui laisse encore passer le Rhône
  const retenus = plansEauRetenus(lacs, { cellM, blocM: z.extentMeters, largeurMinM: RHONE_VALENCE_M })
  const part = partSurfaceEau(retenus, dem.size)
  assert.ok(
    part > PLAFOND_PLAINES,
    `à ${RHONE_VALENCE_M} m — le seuil le plus haut qui garde le Rhône — Dijon ne peint plus que ` +
      `${(part * 100).toFixed(2)} % du bloc, sous le plafond des plaines. Le mur décrit en tête de ` +
      `plan-eau.js s'est ouvert : reprends la mesure, et si elle tient, remplace ce test par une ` +
      `entrée dans PLAFONDS.`
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// LE PLANCHER — et les vrais lacs restent des lacs
// ═══════════════════════════════════════════════════════════════════════════
//
// RELEVÉ DU 2026-08-02 : Serre-Ponçon ressort en UNE composante de 31 980
// cellules à 771 m (23,8 km² au sol pour un lac de 28,2 km² — le détecteur le
// dessine au pixel près, en Y, avec ses deux bras), le lac d'altitude du
// Sognefjord en 1 397 cellules à 1 060 m (1,9 km²), et le lac d'Annecy en
// 36 264 cellules à 444 m (25,8 km² pour 27,6 km² réels).
//
// Les planchers sont posés à ~85 % du relevé : ils tolèrent qu'un futur
// détecteur grignote un liseré de rive, ils REFUSENT qu'il perde le lac.
const PLANCHERS = [
  { nom: 'serre-poncon', cellulesMin: 27000, elevM: 771 },
  { nom: 'sognefjord', cellulesMin: 1150, elevM: 1060 },
  { nom: 'annecy-z12', cellulesMin: 30000, elevM: 444 },
  // ⚠️ CELUI-CI ÉTAIT ROUGE AVANT CE CORRECTIF, et c'est tout le sujet : à z15
  // le bloc ne fait plus que 2,6 km, le plancher absolu de 3 km devenait
  // INSATISFIABLE, et le lac d'Annecy — 27 km² — n'avait plus de surface d'eau
  // du tout. Mesuré sur l'instance vivante avant toute modification : z12 → 1
  // plan d'eau, z13 → 1, z14 → 1, z15 → **0**.
  { nom: 'annecy-z15', cellulesMin: 350000, elevM: 444 },
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
// L'INVARIANCE PAR FINESSE — le refus qui manquait
// ═══════════════════════════════════════════════════════════════════════════
//
// Le MÊME lac, vu à 26,7 m/cellule et à 3,3 m/cellule. Les deux mesures ne
// peuvent pas être égales — à z15 on ne voit qu'un tiers du lac, et la fixture
// le coupe de tous les côtés — mais la LARGEUR, elle, doit rester du même ordre
// (820 m contre 1 032 m au relevé) : c'est la grandeur sur laquelle le seuil est
// posé, et un seuil qui bouge d'un facteur deux avec la finesse est un piège.
//
// ⚠️ SI CE TEST ROUGIT, LE SEUIL DE LARGEUR N'EST PLUS INVARIANT ET IL FAUT
// CHANGER DE CRITÈRE, PAS DÉPLACER LE SEUIL. C'est la leçon du 2026-08-02 :
// une règle qui paraît invariante parce qu'elle s'exprime en mètres peut
// parfaitement ne pas l'être, et le seul moyen de le savoir est de la mesurer
// deux fois sur la même eau.
test('le lac d’Annecy a la même largeur à z12 et à z15 (invariance par finesse)', () => {
  const large = (nom) => {
    const { retenus } = eauDe(zone(nom))
    const lac = retenus.find((r) => Math.abs(r.lac.elevM - 444) <= 2)
    assert.ok(lac, `${nom} : le lac d'Annecy n'est pas retenu`)
    return lac.mesure.largeurM
  }
  const a = large('annecy-z12')
  const b = large('annecy-z15')
  const rapport = Math.max(a, b) / Math.min(a, b)
  assert.ok(
    rapport < 2,
    `largeur mesurée ${a.toFixed(0)} m à z12 contre ${b.toFixed(0)} m à z15 (rapport ${rapport.toFixed(2)}) : ` +
      `le critère n'est pas invariant par finesse, le seuil de ${LARGEUR_MIN_M} m ne veut plus rien dire`
  )
  // et les deux restent très au-dessus du seuil, avec une marge d'au moins 3×
  assert.ok(Math.min(a, b) > 3 * LARGEUR_MIN_M, `marge trop faible : ${Math.min(a, b).toFixed(0)} m`)
})

// ⚠️ LE PLANCHER DE LONGUEUR NE DOIT JAMAIS ÊTRE INSATISFIABLE. C'est la faute
// exacte du plancher absolu : une composante ne peut pas être plus longue que
// le bloc qui la contient, donc exiger 3 km dans un bloc de 2,6 km revient à
// tout refuser sans le dire. La règle bornée rend cette faute impossible par
// construction, à toute taille de bloc.
test('le plancher de longueur reste atteignable quelle que soit la taille du bloc', () => {
  for (const blocM of [50000, 20000, 5000, 3750, 2560, 1200, 400]) {
    const p = longueurMinM(blocM)
    assert.ok(p < blocM, `bloc de ${blocM} m : plancher ${p} m, donc insatisfiable`)
    assert.ok(p <= LONGUEUR_MIN_M, `bloc de ${blocM} m : plancher ${p} m au-dessus de l'absolu`)
  }
  // au-dessus de 3,75 km de bloc, la règle d'Adrien de la v40 est rendue au mètre près
  assert.equal(longueurMinM(20000), LONGUEUR_MIN_M)
  assert.equal(longueurMinM(0), LONGUEUR_MIN_M) // appelant qui ne sait pas : l'absolu d'avant
})

// ⚠️ ET LE PLANCHER NE DÉPEND PAS DE L'EMPRISE. En mode continu `extentMeters`
// couvre TROIS blocs : servir cette valeur telle quelle multiplierait le
// plancher par trois sur les vues rapprochées, et ferait disparaître, en mode
// continu seulement, les lacs que ce correctif existe pour sauver. ocean.js
// divise donc par `empriseCote` — ce test dit ce qui se passerait sinon.
test('le plancher se lit sur un bloc, pas sur l’emprise 3×3', () => {
  const bloc = 2560 // Annecy z15
  assert.ok(longueurMinM(bloc) <= bloc, 'plancher du bloc')
  assert.ok(longueurMinM(bloc * 3) > bloc, "sur l'emprise, le plancher redeviendrait insatisfiable pour un bloc")
})

// ═══════════════════════════════════════════════════════════════════════════
// L'INVARIANT — la règle elle-même, pas seulement ses effets
// ═══════════════════════════════════════════════════════════════════════════
//
// Les plafonds et planchers ci-dessus disent CE QUI SORT. Celui-ci dit POURQUOI,
// et c'est lui qui tiendra encore si les onze zones changent : rien de ce qui
// est posé en eau animée ne peut être plus étroit que la règle. Une future
// exception glissée dans ocean.js — « juste pour ce cas-là » — le fait rougir.
test('aucune étendue retenue n’est plus étroite ni plus courte que la règle', () => {
  for (const z of MANIFESTE) {
    const { retenus } = eauDe(z)
    const planche = longueurMinM(z.extentMeters)
    for (const { lac, mesure } of retenus) {
      assert.ok(
        mesure.largeurM >= LARGEUR_MIN_M,
        `${z.nom} : étendue à ${lac.elevM} m large de ${mesure.largeurM.toFixed(0)} m (< ${LARGEUR_MIN_M})`
      )
      assert.ok(
        mesure.longueurM >= planche,
        `${z.nom} : étendue à ${lac.elevM} m longue de ${mesure.longueurM.toFixed(0)} m (< ${planche.toFixed(0)})`
      )
    }
  }
})

// ⚠️ LE DÉFAUT DOIT RESTER REPRODUCTIBLE. Sans ce test, quelqu'un qui rebâtirait
// les fixtures depuis une autre source d'altimétrie — ou à un pas au sol plus
// grossier, ce qui suffit : Brest cuit à 25 m/cellule ne porte AUCUNE dentelle —
// pourrait sans le savoir cuire des MNT où le défaut n'existe plus, et les sept
// plafonds passeraient au vert en ne protégeant plus rien. On vérifie donc que
// chacune des trois zones du défaut noie encore ses terres SANS le filtre de
// largeur : c'est la preuve que les fixtures portent ce qu'on prétend interdire.
for (const [nom, minPart] of [
  ['rhone-valence', 0.02],
  ['rhone-fin', 0.1],
  ['brest', 0.02],
]) {
  test(`la fixture ${nom} porte toujours le défaut — sinon le plafond ne prouve rien`, () => {
    const z = zone(nom)
    // largeur minimale à 0 = l'ancienne règle, la longueur absolue seule
    const { part } = eauDe(z, { largeurMinM: 0, longueurMinM: LONGUEUR_MIN_M })
    assert.ok(
      part > minPart,
      `sans le filtre de largeur, ${nom} ne noie plus que ${(part * 100).toFixed(2)} % du bloc ` +
        `(plancher ${(minPart * 100).toFixed(0)} %) — la fixture ne porte plus le défaut`
    )
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// LA MESURE ELLE-MÊME
// ═══════════════════════════════════════════════════════════════════════════
//
// `largeur = 2 × aire / périmètre` rend exactement la largeur d'un ruban. Si
// cette identité se casse, tous les seuils ci-dessus deviennent du bruit — d'où
// des témoins analytiques, indépendants de toute donnée.
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

// ⚠️ LE TÉMOIN DU FLEUVE, ET IL EST ANALYTIQUE À DESSEIN. Aucune fixture ne
// peut le tenir : le Rhône se découpe en biefs de moins de 3 km sur du
// terrarium brut, alors qu'il ressort d'un seul tenant sur le MNT rééchantillonné
// de la production (mesuré au navigateur : 16,4 km de long, 170 m de large à
// z12 et 173 m à z14, gardé aux deux). On rejoue donc SA GÉOMÉTRIE MESURÉE, à
// deux pas au sol, et on exige qu'elle passe — pendant qu'une dentelle de la
// même vallée (64 à 81 m) est refusée aux deux.
for (const cellM of [13.5, 3.4]) {
  test(`un fleuve de 170 m de large et 16 km de long reste de l’eau (pas ${cellM} m)`, () => {
    const ruban = (largeurM, longueurM) => {
      const size = Math.ceil((longueurM * 1.1) / cellM)
      const w = Math.max(1, Math.round(largeurM / cellM))
      const h = Math.max(1, Math.round(longueurM / cellM))
      const cells = []
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push(y * size + x)
      return { cells: Int32Array.from(cells), size, elevM: 104 }
    }
    const opts = { cellM, blocM: 20000 }
    assert.equal(plansEauRetenus([ruban(170, 16400)], opts).length, 1, 'le Rhône a été refusé')
    assert.equal(plansEauRetenus([ruban(70, 4000)], opts).length, 0, 'une dentelle a été acceptée')
  })
}

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

// ⚠️ SANS PAS AU SOL, ON LAISSE PASSER — ON N'EFFACE PAS. Le contraire est ce
// qu'on écrit d'instinct, et c'est le reproche exact fait à la tentative
// annulée : un `extentMeters` manquant sur un chemin oublié y rendait une liste
// vide, c'est-à-dire une carte sans le moindre lac, sans la moindre erreur en
// console. Un garde-fou qui ne sait pas juger doit s'abstenir.
test('sans pas au sol valide, le tri s’abstient au lieu de tout effacer', () => {
  const size = 64
  const cells = []
  for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) cells.push(y * size + x)
  const lacs = [{ cells: Int32Array.from(cells), size, elevM: 300 }]
  for (const cellM of [undefined, 0, NaN, -1]) {
    const r = plansEauRetenus(lacs, { cellM })
    assert.equal(r.length, 1, `cellM=${cellM} : ${r.length} plan d'eau au lieu de 1`)
    assert.equal(r[0].lac, lacs[0])
  }
  // et la part de surface reste calculable dans ce mode dégradé
  assert.ok(partSurfaceEau(plansEauRetenus(lacs, { cellM: NaN }), size) > 0)
})
