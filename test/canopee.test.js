import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ARRETS_CANOPEE,
  FORCES_CANOPEE,
  CANOPEE_SOL_NU,
  CANOPEE_H_ABSURDE,
  CANOPEE_ZOOM_MAX,
  CANOPEE_ATTRIBUTION,
  couleurCanopee,
  forceCanopee,
  tableLutCanopee,
  urlTuileCanopee,
  zoomCanopeeBorne,
  normaliseIndexCanopee,
  zoneCanopeePour,
} from '../src/canopee.js'

// ═══════════ LA RAMPE DE COULEUR ═══════════════════════════════════════════

test('la rampe s’assombrit ET se refroidit quand l’arbre monte', () => {
  // Les deux gestes de la direction graphique, vérifiés sur toute la rampe et
  // pas seulement à ses bouts : c'est ce qui rend la couche lisible SANS
  // légende (le plus foncé est le plus haut) et ce qui la fait survivre au
  // mélange par luminance du nuanceur (la teinte porte l'info elle aussi).
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
  // « Chaleur » : combien le rouge l'emporte sur le bleu. Elle doit décroître.
  const chaleur = (c) => c[0] - c[2]
  let precLum = Infinity
  let precChaleur = Infinity
  for (let h = 0; h <= 45; h++) {
    const c = couleurCanopee(h)
    assert.ok(lum(c) <= precLum + 1e-9, `à ${h} m la rampe s'éclaircit au lieu de s'assombrir`)
    assert.ok(chaleur(c) <= precChaleur + 1e-9, `à ${h} m la rampe se réchauffe au lieu de se refroidir`)
    precLum = lum(c)
    precChaleur = chaleur(c)
  }
})

test('la rampe reste sous 45 % de saturation — pas d’atlas scolaire', () => {
  // La garde de toute la maison : le vert de légende à 100 % de saturation est
  // exactement ce que ShibuMap n'est pas.
  for (const { h, couleur } of ARRETS_CANOPEE) {
    const [r, g, b] = couleur
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    assert.ok(sat <= 0.45, `l'arrêt ${h} m est à ${(sat * 100).toFixed(0)} % de saturation`)
  }
})

test('la couleur est BORNÉE aux deux bouts, elle n’extrapole pas', () => {
  // Au-delà du dernier arrêt on garde sa couleur. Extrapoler donnerait des
  // valeurs négatives sur les rares forêts de 60 m, donc du noir puis du
  // rebouclage — un défaut qui ne se voit que sur trois endroits du globe.
  const dernier = ARRETS_CANOPEE[ARRETS_CANOPEE.length - 1]
  assert.deepEqual(couleurCanopee(dernier.h + 40), dernier.couleur)
  assert.deepEqual(couleurCanopee(-5), ARRETS_CANOPEE[0].couleur)
  for (const h of [0, 3, 17, 45, 200]) {
    for (const v of couleurCanopee(h)) assert.ok(v >= 0 && v <= 255, `${v} hors [0,255] à ${h} m`)
  }
})

test('entre deux arrêts on INTERPOLE — la hauteur est un champ continu', () => {
  // ⚠️ C'est le point où cette couche est l'exact inverse de l'occupation du
  // sol. Là-bas, interpoler entre deux codes fabrique une classe qui n'existe
  // pas. Ici, entre 5 m et 12 m il y a 8,5 m, et 8,5 m est une hauteur réelle.
  const a = ARRETS_CANOPEE[1] // 5 m
  const b = ARRETS_CANOPEE[2] // 12 m
  const milieu = couleurCanopee((a.h + b.h) / 2)
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(milieu[k] - (a.couleur[k] + b.couleur[k]) / 2) < 1e-9)
  }
})

// ═══════════ LA FORCE ══════════════════════════════════════════════════════

test('sous le plancher de sol nu, la force est RIGOUREUSEMENT nulle', () => {
  // Le voile paille sur la moitié des terres émergées : la source rend 1-2 m
  // sur les cultures et les buissons, et la tirette « Force » monte à 4.
  for (const h of [0, 0.5, 1, 1.9, CANOPEE_SOL_NU]) {
    assert.equal(forceCanopee(h), 0, `${h} m ne doit rien peindre`)
  }
  assert.ok(forceCanopee(CANOPEE_SOL_NU + 1) > 0, 'juste au-dessus du plancher, la couche doit exister')
})

test('la force MONTE avec la hauteur et sature — jamais de bosse', () => {
  let prec = -1
  for (let h = 0; h < CANOPEE_H_ABSURDE; h++) {
    const f = forceCanopee(h)
    assert.ok(f >= prec - 1e-9, `la force redescend à ${h} m`)
    assert.ok(f >= 0 && f <= 1, `force ${f} hors [0,1] à ${h} m`)
    prec = f
  }
  assert.equal(forceCanopee(FORCES_CANOPEE[FORCES_CANOPEE.length - 1].h), 1)
  assert.equal(forceCanopee(80), 1, 'au-delà du dernier arrêt la force reste au plafond')
})

test('au-dessus du plafond de vraisemblance, la force retombe à zéro', () => {
  // ⚠️ Le garde-fou qui empêche un « pas de donnée » à 255 de peindre un océan
  // entier dans la couleur la plus sombre de la rampe. Le plus grand arbre du
  // monde monte à 116 m : 200 n'est pas une forêt, c'est un octet abîmé.
  assert.ok(forceCanopee(CANOPEE_H_ABSURDE - 1) > 0)
  assert.equal(forceCanopee(CANOPEE_H_ABSURDE), 0)
  assert.equal(forceCanopee(200), 0)
  assert.equal(forceCanopee(255), 0)
})

test('un non-nombre ne peint rien — il ne devient pas NaN dans un uniforme', () => {
  // Un NaN posé dans un alpha rend la carte noire sans lever la moindre erreur
  // (le dossier est écrit en tête de src/reglages-couches.js).
  for (const v of [NaN, undefined, null, Infinity, -Infinity, 'quinze']) {
    assert.equal(forceCanopee(v), 0)
  }
})

// ═══════════ LA TABLE DE CORRESPONDANCE ════════════════════════════════════

test('la table fait 256 entrées et son INDEX EST LA HAUTEUR EN MÈTRES', () => {
  const lut = tableLutCanopee()
  assert.equal(lut.length, 256 * 4)
  // ⚠️ Le piège que cette table évite : ranger les arrêts de la rampe de 0 à 5
  // et indexer par le RANG. L'entrée 22 doit être la couleur de 22 mètres, pas
  // la couleur du 22e arrêt (qui n'existe pas).
  for (const h of [3, 12, 22, 45]) {
    const [r, g, b] = couleurCanopee(h).map((v) => Math.round(v))
    assert.equal(lut[h * 4], r, `entrée ${h} : rouge`)
    assert.equal(lut[h * 4 + 1], g, `entrée ${h} : vert`)
    assert.equal(lut[h * 4 + 2], b, `entrée ${h} : bleu`)
  }
})

test('l’alpha de la table PORTE LA FORCE, y compris ses deux zéros', () => {
  const lut = tableLutCanopee()
  assert.equal(lut[0 * 4 + 3], 0, '0 m : pas d’arbre = pas de donnée = rien')
  assert.equal(lut[1 * 4 + 3], 0, '1 m : sol nu')
  assert.equal(lut[2 * 4 + 3], 0, '2 m : encore le plancher')
  assert.ok(lut[30 * 4 + 3] > 240, '30 m : une vraie forêt pèse son poids')
  for (let h = CANOPEE_H_ABSURDE; h < 256; h++) {
    assert.equal(lut[h * 4 + 3], 0, `l’octet absurde ${h} doit peser zéro`)
  }
})

// ═══════════ ADRESSES ET ZOOMS ═════════════════════════════════════════════

test('l’adresse d’une tuile suit {z}/{x}/{y} et reste RELATIVE', () => {
  // ⚠️ Deux pièges d'un coup. L'ordre WMTS inverse {z}/{y}/{x} de la couche
  // nocturne rendrait une tuile VALIDE prise ailleurs sur Terre, sans erreur en
  // console. Et une barre oblique en tête casse les aperçus Netlify, qui
  // servent le site sous un sous-chemin.
  assert.equal(urlTuileCanopee(12, 2130, 1470), 'data/canopee/12/2130/1470.png')
  assert.ok(!urlTuileCanopee(9, 1, 2).startsWith('/'))
})

test('le zoom demandé est borné par la résolution native de la source', () => {
  assert.equal(zoomCanopeeBorne(18), CANOPEE_ZOOM_MAX)
  assert.equal(zoomCanopeeBorne(11.7), 11)
  assert.equal(zoomCanopeeBorne(-3), 0)
  assert.equal(zoomCanopeeBorne(NaN), CANOPEE_ZOOM_MAX)
})

test('l’attribution est portée par le module — c’est une obligation de licence', () => {
  assert.match(CANOPEE_ATTRIBUTION, /ETH/)
})

// ═══════════ LE MANIFESTE DES ZONES CUITES ═════════════════════════════════

test('un manifeste absent ou abîmé rend un objet sur lequel on peut s’appuyer', () => {
  for (const doc of [null, undefined, {}, { zones: 'oui' }, { zones: [{ bbox: [1, 2] }] }]) {
    const i = normaliseIndexCanopee(doc)
    assert.ok(Array.isArray(i.zones))
    assert.equal(i.zones.length, 0)
  }
})

test('CHAQUE ZONE porte son plafond de zoom, et il est borné', () => {
  // ⚠️ Sans plafond par zone, une vue posée sur un socle cuit en z9 réclamerait
  // du z14 jamais écrit : mosaïque vide, interrupteur allumé, et l'utilisateur
  // lit « il n'y a pas d'arbres ici », ce qui est faux.
  const i = normaliseIndexCanopee({
    zmax: 13,
    zones: [
      { nom: 'monde', bbox: [-180, -60, 180, 84], zmax: 9 },
      { nom: 'vosges', bbox: [6, 47.5, 7.5, 48.5] }, // sans zmax → celui du manifeste
      { nom: 'trop', bbox: [0, 0, 1, 1], zmax: 99 }, // borné par CANOPEE_ZOOM_MAX
    ],
  })
  assert.equal(i.zones[0].zmax, 9)
  assert.equal(i.zones[1].zmax, 13)
  assert.equal(i.zones[2].zmax, CANOPEE_ZOOM_MAX)
})

test('la zone la PLUS PETITE gagne, et c’est le CENTRE de l’emprise qui décide', () => {
  // La règle est celle de l'occupation du sol, réutilisée telle quelle : deux
  // copies d'une règle divergent, et celle-ci divergerait SANS ERREUR.
  const i = normaliseIndexCanopee({
    zones: [
      { nom: 'monde', bbox: [-180, -60, 180, 84], zmax: 9 },
      { nom: 'vosges', bbox: [6, 47.5, 7.5, 48.5], zmax: 14 },
    ],
  })
  const dedans = zoneCanopeePour(i, { minLon: 6.8, maxLon: 7.0, minLat: 48.0, maxLat: 48.2 })
  assert.equal(dedans.nom, 'vosges', 'la plus petite emprise est la mieux cuite')
  const ailleurs = zoneCanopeePour(i, { minLon: -100, maxLon: -99, minLat: 40, maxLat: 41 })
  assert.equal(ailleurs.nom, 'monde')
  assert.equal(zoneCanopeePour(i, null), null)
  assert.equal(zoneCanopeePour(null, { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 }), null)
})
