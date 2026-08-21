// LA DESCENTE BORNÉE PAR LE RÉSEAU — Tâche 4 ter du plan « globe continu »,
// règle R3.
//
// ══════════ CE QUE CE FICHIER ÉPROUVE, ET DANS QUEL ORDRE ═══════════════════
//
// 1. **L'assertion de l'Étape 1** — à débit observé faible, `zoomSoutenable`
//    rend un zoom INFÉRIEUR au demandé. ⚠️ La seconde moitié de R3 (« et la
//    caméra ne descend pas plus vite ») appartient à la Tâche 1, qui tient
//    `modes.js` ; ce fichier ne la teste pas, et `descente-bornee.js` §4 dit
//    exactement qui la posera et où.
// 2. **Le piège `null`** — un flux neuf rend `null` et NON zéro. Un `null`
//    traité comme zéro ferait passer un réseau INCONNU pour un réseau MORT.
// 3. **Les six points mesurés au banc** `.banc/zoom-soutenable.mjs` — la loi ne
//    doit JAMAIS les dépasser (surestimer, c'est « une autre carte », ce que R3
//    interdit) et ne doit pas les rater de plus d'un niveau.
// 4. **Le point d'appel** `remplirBorne` — il lit le débit du flux, rogne le
//    zoom, et ⚠️ **laisse l'emprise INTACTE** : c'est le contrat tranché par la
//    Tâche 3, « ce qui varie est le remplissage, jamais l'emprise ».
// 5. **L'indicateur discret** (décision d'Adrien du 2026-08-20) — son ÉTAT est
//    ici ; son DESSIN appartient à la Tâche 2.
//
// ⚠️ **LA MUTATION QUI DOIT TUER CE FICHIER** (Étape 4) : rendre `zoomSoutenable`
// constant — toujours `zoomDemande`. Elle tue les tests 1, 3 et 4.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ═══════════════════════════════════════ 1. LE DÉCOR MINIMAL ═════════════════
//
// Le gros du fichier est PUR (`zoomSoutenable`, `etatIndicateur`) et n'a besoin
// de rien. Seul `remplirBorne` veut un vrai `Globe`, donc un `document` et un
// `fetch` bouchonnés — et un `fetch` qui NE SE RÉSOUT JAMAIS suffit : on
// n'observe que ce qui est DEMANDÉ.

const [ER, EG, EB] = encodeTerrarium(812)
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  DALLE[i * 4] = ER
  DALLE[i * 4 + 1] = EG
  DALLE[i * 4 + 2] = EB
  DALLE[i * 4 + 3] = 255
}
class FauxCtx {
  createLinearGradient() {
    return { addColorStop() {} }
  }
  fillRect() {}
  drawImage() {}
  getImageData() {
    return { data: DALLE }
  }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FauxCtx())
    return c
  },
}
globalThis.createImageBitmap = async (b) => b
globalThis.fetch = async () => new Promise(() => {})

const globeMod = await import('../src/globe.js')
const { Globe, MAX_Z, _resetTileMemo, _resetJournalReseau, noterReponse } = globeMod
const { empriseSocle, ZOOM_SOCLE } = await import('../src/monde/seuil-socle.js')
const { creerFlux, debitObserve, tuilesEmprise } = await import('../src/monde/flux-terrain.js')
const { zoomSoutenable, remplirBorne, etatIndicateur, ZOOM_PLANCHER } = await import(
  '../src/monde/descente-bornee.js'
)

const CENTRE = { lat: 45, lon: 6.25 }

// ═══════════════════════════ 2. L'ASSERTION DE L'ÉTAPE 1 ═════════════════════

test('R3 : à débit observé faible, zoomSoutenable rend un zoom INFÉRIEUR au demandé', () => {
  // 4 Mb/s : le point bas de la règle R3, re-mesuré au banc le 2026-08-21 → z9.
  const lent = zoomSoutenable({ debitObserveMbs: 4, zoomDemande: ZOOM_SOCLE })
  assert.ok(
    lent < ZOOM_SOCLE,
    `à 4 Mb/s le remplissage doit être rogné sous z${ZOOM_SOCLE}, obtenu z${lent}`
  )
  // et plus le réseau est mauvais, plus il est rogné
  const pire = zoomSoutenable({ debitObserveMbs: 2, zoomDemande: ZOOM_SOCLE })
  assert.ok(pire < lent, `2 Mb/s doit rogner plus que 4 Mb/s (z${pire} contre z${lent})`)

  // ⚠️ ET À RÉSEAU CONFORTABLE, ON NE ROGNE PAS : la borne ne doit pas se
  // transformer en plafond permanent. 100 Mb/s soutient z13 et au-delà.
  assert.equal(
    zoomSoutenable({ debitObserveMbs: 100, zoomDemande: ZOOM_SOCLE }),
    ZOOM_SOCLE,
    'un bon réseau ne doit rien rogner du tout'
  )
})

test('la borne ne rend JAMAIS plus que le zoom demandé — c est une borne, pas une consigne', () => {
  for (const debitObserveMbs of [0.5, 4, 12, 30, 1000]) {
    const z = zoomSoutenable({ debitObserveMbs, zoomDemande: 8 })
    assert.ok(z <= 8, `${debitObserveMbs} Mb/s a rendu z${z} pour une demande de z8`)
    assert.ok(z >= ZOOM_PLANCHER && z <= MAX_Z, `z${z} sort de [${ZOOM_PLANCHER}, ${MAX_Z}]`)
    assert.equal(z, Math.floor(z), 'un niveau de zoom est entier')
  }
})

test('monotone : un meilleur débit ne rend jamais un zoom plus grossier', () => {
  let precedent = -1
  for (const d of [0.5, 1, 2, 4, 8, 12, 16, 30, 64, 200]) {
    const z = zoomSoutenable({ debitObserveMbs: d, zoomDemande: MAX_Z })
    assert.ok(z >= precedent, `${d} Mb/s rend z${z} après z${precedent} : la loi n est pas monotone`)
    precedent = z
  }
})

// ═════════════════ 3. LE PIÈGE `null` — INCONNU N'EST PAS MORT ═══════════════

test('debit inconnu (null) : on rend le zoom DEMANDÉ, pas le plancher', () => {
  assert.equal(
    zoomSoutenable({ debitObserveMbs: null, zoomDemande: ZOOM_SOCLE }),
    ZOOM_SOCLE,
    'null traité comme zéro ferait passer un réseau INCONNU pour un réseau MORT'
  )
  assert.equal(zoomSoutenable({ debitObserveMbs: undefined, zoomDemande: ZOOM_SOCLE }), ZOOM_SOCLE)
  assert.equal(zoomSoutenable({ debitObserveMbs: NaN, zoomDemande: ZOOM_SOCLE }), ZOOM_SOCLE)

  // ⚠️ ET C'EST BIEN CE QUE REND UN FLUX NEUF : l'assertion se rejoue contre le
  // dépôt plutôt que de croire le commentaire de `flux-terrain.js`.
  _resetTileMemo()
  _resetJournalReseau()
  const g = new Globe({ globeContinu: true })
  const flux = creerFlux({ globe: g })
  assert.equal(debitObserve(flux), null, 'un flux neuf doit rendre null, pas zéro')
  assert.equal(
    zoomSoutenable({ debitObserveMbs: debitObserve(flux), zoomDemande: ZOOM_SOCLE }),
    ZOOM_SOCLE,
    'au premier instant, on n a rien à reprocher au réseau'
  )
  g.dispose()
})

test('un débit mesuré à ZÉRO, lui, cloue au plancher — ce n est pas le même cas', () => {
  assert.equal(zoomSoutenable({ debitObserveMbs: 0, zoomDemande: ZOOM_SOCLE }), ZOOM_PLANCHER)
  assert.equal(zoomSoutenable({ debitObserveMbs: -3, zoomDemande: ZOOM_SOCLE }), ZOOM_PLANCHER)
})

// ═══════════ 4. LES SIX POINTS MESURÉS, ET CE QUE LA LOI EN FAIT ═════════════
//
// Banc `.banc/zoom-soutenable.mjs`, 2026-08-21 — vol de référence du §0 (45 s,
// Atlantique 260 km → Mont-Blanc 2,2 km, cache froid), puis 17 images jetées et
// médiane du zoom dessiné sur 300 images. ⚠️ **Les deux points du plan (z11 à
// 12 Mb/s, z9 à 4 Mb/s) sont retrouvés à l'identique sur le quadtree
// d'aujourd'hui** — `MAX_Z = 15`, cache 1 700, file plafonnée à 256.
const MESURES = [
  { debit: 2, z: 7 },
  { debit: 4, z: 9 }, // ⚠️ point du plan
  { debit: 8, z: 11 },
  { debit: 12, z: 11 }, // ⚠️ point du plan
  { debit: 30, z: 13 }, // ⚠️ le troisième point, exigé par la Tâche 4 ter
  { debit: 64, z: 14 },
]

test('la loi ne SURESTIME jamais un point mesuré — surestimer donne « une autre carte »', () => {
  for (const { debit, z } of MESURES) {
    const rendu = zoomSoutenable({ debitObserveMbs: debit, zoomDemande: MAX_Z })
    assert.ok(
      rendu <= z,
      `à ${debit} Mb/s le banc soutient z${z} ; la loi promet z${rendu} — R3 est violée`
    )
  }
})

test('la loi ne SOUS-ESTIME pas de plus d un niveau — sinon elle floute pour rien', () => {
  for (const { debit, z } of MESURES) {
    const rendu = zoomSoutenable({ debitObserveMbs: debit, zoomDemande: MAX_Z })
    assert.ok(
      rendu >= z - 1,
      `à ${debit} Mb/s le banc soutient z${z} ; la loi n en promet que z${rendu}`
    )
  }
  // ⚠️ ET QUATRE DES SIX SONT EXACTS — dont les deux points du plan. Si un jour
  // ce compte tombe, c'est la LOI qu'il faut reprendre, pas cette assertion.
  const exacts = MESURES.filter(
    ({ debit, z }) => zoomSoutenable({ debitObserveMbs: debit, zoomDemande: MAX_Z }) === z
  ).length
  assert.ok(exacts >= 5, `${exacts} points exacts sur ${MESURES.length} — la loi a dérivé`)
})

// ═══════════════════════════ 5. LE POINT D'APPEL ═════════════════════════════

test('remplirBorne : le point d appel demande au zoom ROGNÉ, et l emprise ne bouge pas', () => {
  _resetTileMemo()
  _resetJournalReseau()
  const g = new Globe({ globeContinu: true })
  const flux = creerFlux({ globe: g })

  // un débit CONNU et lent : 250 000 octets en 500 ms = 4 Mb/s
  noterReponse({ octets: 250_000, debut: 0, fin: 500 })
  const vu = debitObserve(flux)
  assert.ok(Math.abs(vu - 4) < 1e-9, `le décor doit poser 4 Mb/s, il en pose ${vu}`)

  const emprise = empriseSocle({ centre: CENTRE })
  const avant = { ...emprise }
  const r = remplirBorne(flux, { emprise, zoomDemande: ZOOM_SOCLE })

  assert.equal(r.zoomDemande, ZOOM_SOCLE)
  assert.ok(r.zoom < ZOOM_SOCLE, `le remplissage devait être rogné, il est resté à z${r.zoom}`)
  assert.equal(r.zoom, zoomSoutenable({ debitObserveMbs: 4, zoomDemande: ZOOM_SOCLE }))

  // ⚠️ L'EMPRISE EST INTACTE — c'est le contrat de la Tâche 3 : ce qui varie est
  // le remplissage, jamais l'emprise. Un socle qui rétrécirait avec le réseau
  // changerait de sujet à chaque hoquet de connexion.
  assert.deepEqual({ ...emprise }, avant, 'remplirBorne a modifié l emprise')

  // et les tuiles réclamées sont bien celles du zoom rogné, et aucune autre
  const attendues = new Set(tuilesEmprise(emprise, r.zoom).map((t) => `${t.z}/${t.x}/${t.y}`))
  assert.ok(attendues.size > 0)
  assert.equal(flux.reclamees.size, attendues.size, 'le flux ne réclame pas le bon nombre de tuiles')
  for (const cle of flux.reclamees.keys()) {
    assert.ok(attendues.has(cle), `${cle} n appartient pas à l emprise au zoom ${r.zoom}`)
  }
  g.dispose()
})

test('remplirBorne : débit inconnu, on remplit au zoom demandé', () => {
  _resetTileMemo()
  _resetJournalReseau()
  const g = new Globe({ globeContinu: true })
  const flux = creerFlux({ globe: g })
  const r = remplirBorne(flux, { emprise: empriseSocle({ centre: CENTRE }), zoomDemande: ZOOM_SOCLE })
  assert.equal(r.debitObserveMbs, null)
  assert.equal(r.zoom, ZOOM_SOCLE, 'un flux neuf ne doit pas se rogner lui-même')
  g.dispose()
})

// ═════════════════════ 6. L'INDICATEUR DISCRET — SON ÉTAT ════════════════════

test('etatIndicateur : éteint quand le réseau suit ou n est pas encore mesuré', () => {
  assert.deepEqual(etatIndicateur({ debitObserveMbs: null, zoomDemande: ZOOM_SOCLE }), {
    enRetard: false,
    niveaux: 0,
    zoom: ZOOM_SOCLE,
  })
  assert.equal(etatIndicateur({ debitObserveMbs: 100, zoomDemande: ZOOM_SOCLE }).enRetard, false)
})

test('etatIndicateur : allumé, et il dit de COMBIEN DE NIVEAUX — pas un pourcentage', () => {
  const e = etatIndicateur({ debitObserveMbs: 4, zoomDemande: ZOOM_SOCLE })
  assert.equal(e.enRetard, true)
  assert.equal(e.niveaux, ZOOM_SOCLE - e.zoom)
  assert.ok(e.niveaux > 0)
  // plus le réseau est mauvais, plus le retard est grand
  assert.ok(etatIndicateur({ debitObserveMbs: 1, zoomDemande: ZOOM_SOCLE }).niveaux > e.niveaux)
})
