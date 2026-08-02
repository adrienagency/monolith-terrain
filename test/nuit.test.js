import test from 'node:test'
import assert from 'node:assert/strict'
import {
  urlTuileNuit, zoomNuitBorne, intensiteNuit,
  NUIT_ZOOM_MAX, NUIT_COUCHE_GIBS, facteurEchelleNuit, largeurEmpriseKm,
} from '../src/nuit.js'

// ── L'adresse des tuiles ────────────────────────────────────────────────────

test('l’adresse suit la convention WMTS {z}/{y}/{x}, pas celle d’OSM', () => {
  // Le piège coûteux : inverser x et y ne casse RIEN. Ça rend une tuile
  // valide, prise ailleurs sur Terre. Ce test est le seul endroit où
  // l'inversion se voit autrement qu'à l'œil.
  const u = urlTuileNuit(6, 33, 22)
  assert.ok(u.endsWith('/6/22/33.png'), u)
})

test('l’adresse vise la composition annuelle, pas le produit quotidien', () => {
  // Le produit quotidien rend 404 au-delà de z2 sur cette matrice (sondé le
  // 2026-08-02), et porterait de toute façon les nuages du jour.
  assert.equal(NUIT_COUCHE_GIBS, 'VIIRS_Black_Marble')
  assert.ok(urlTuileNuit(3, 1, 1).includes('/VIIRS_Black_Marble/'))
  assert.ok(urlTuileNuit(3, 1, 1).includes('GoogleMapsCompatible_Level8'))
})

// ── Le plafond de zoom ──────────────────────────────────────────────────────

test('le zoom est borné au capteur, pas au budget de texture', () => {
  // 600 m/px est la résolution native de VIIRS. Demander plus haut ne rend pas
  // plus de détail : ça rend une erreur.
  assert.equal(zoomNuitBorne(12), NUIT_ZOOM_MAX)
  assert.equal(zoomNuitBorne(8), 8)
  assert.equal(zoomNuitBorne(5), 5)
})

test('un zoom absurde retombe sur une valeur utilisable, jamais sur NaN', () => {
  // Une couche décorative ne doit jamais faire tomber la carte : sans réponse
  // exploitable, on prend le plafond plutôt que de propager un NaN dans une
  // adresse.
  assert.equal(zoomNuitBorne(NaN), NUIT_ZOOM_MAX)
  assert.equal(zoomNuitBorne(undefined), NUIT_ZOOM_MAX)
  assert.equal(zoomNuitBorne(-3), 0)
  assert.equal(zoomNuitBorne(6.7), 6)
})

// ── Le couplage à l'heure ───────────────────────────────────────────────────

test('les villes ne brillent pas à midi', () => {
  // Zéro STRICT, pas « presque zéro » : à zéro l'appelant saute le rendu.
  assert.equal(intensiteNuit(12), 0)
  assert.equal(intensiteNuit(7), 0)
  assert.equal(intensiteNuit(15), 0)
})

test('plein feu au cœur de la nuit, des deux côtés de minuit', () => {
  assert.equal(intensiteNuit(23), 1)
  assert.equal(intensiteNuit(0), 1)
  assert.equal(intensiteNuit(3), 1)
  assert.equal(intensiteNuit(21), 1)
})

test('les crépuscules sont des rampes, pas des interrupteurs', () => {
  // Sans rampe, traîner la tirette d'heure ferait CLIGNOTER la carte au
  // passage du seuil. Et Adrien traîne cette tirette.
  assert.equal(intensiteNuit(20), 0.5)
  assert.equal(intensiteNuit(6), 0.5)
  assert.ok(intensiteNuit(19.5) > 0 && intensiteNuit(19.5) < 0.5)
  assert.ok(intensiteNuit(5.5) > 0.5 && intensiteNuit(5.5) < 1)
})

test('la courbe est continue : aucun saut le long des 24 heures', () => {
  // Une discontinuité, c'est exactement ce qu'on voit à l'écran comme un
  // clignotement. On la cherche donc par le calcul plutôt qu'à l'œil.
  let precedent = intensiteNuit(0)
  for (let h = 0.01; h <= 24; h += 0.01) {
    const v = intensiteNuit(h)
    assert.ok(Math.abs(v - precedent) < 0.02, `saut à ${h.toFixed(2)} h : ${precedent} → ${v}`)
    precedent = v
  }
})

test('l’heure déborde proprement — 25 h vaut 1 h, −1 h vaut 23 h', () => {
  assert.equal(intensiteNuit(25), intensiteNuit(1))
  assert.equal(intensiteNuit(-1), intensiteNuit(23))
  assert.equal(intensiteNuit(24), intensiteNuit(0))
})

test('une heure illisible éteint la couche au lieu de la casser', () => {
  assert.equal(intensiteNuit(NaN), 0)
  assert.equal(intensiteNuit(undefined), 0)
  assert.equal(intensiteNuit(null), 0)
})

// ── Le garde d'échelle ──────────────────────────────────────────────────────

test('à z16 sur Tokyo la couche s’efface : elle n’a plus rien à dire', () => {
  // Le défaut CONSTATÉ qui a motivé ce garde : un bloc de 1,5 km couvre deux
  // pixels et demi de Black Marble, et rend un voile gris uniforme — pire que
  // la couche éteinte, parce qu'on lit un défaut de rendu comme une donnée.
  assert.equal(facteurEchelleNuit(1.5), 0)
  assert.equal(facteurEchelleNuit(20), 0)
})

test('à l’échelle régionale la couche est pleine', () => {
  assert.equal(facteurEchelleNuit(60), 1)
  assert.equal(facteurEchelleNuit(200), 1)
})

test('le fondu est continu : pas de clignotement au passage du seuil', () => {
  let precedent = facteurEchelleNuit(0.5)
  for (let km = 1; km <= 120; km += 0.5) {
    const v = facteurEchelleNuit(km)
    assert.ok(Math.abs(v - precedent) < 0.02, `saut à ${km} km`)
    assert.ok(v >= 0 && v <= 1)
    precedent = v
  }
})

test('une largeur illisible éteint la couche', () => {
  assert.equal(facteurEchelleNuit(NaN), 0)
  assert.equal(facteurEchelleNuit(0), 0)
  assert.equal(facteurEchelleNuit(-10), 0)
})

test('la largeur tient compte du rétrécissement des longitudes', () => {
  // Un degré de longitude vaut 111 km à l'équateur et environ 56 à 60°.
  // Ignorer ce cosinus rendrait un bloc scandinave DEUX FOIS trop large, et
  // le garde le laisserait passer alors qu'il ne montre rien.
  const equateur = largeurEmpriseKm({ minLon: 0, maxLon: 1, minLat: -0.5, maxLat: 0.5 })
  const nordique = largeurEmpriseKm({ minLon: 0, maxLon: 1, minLat: 59.5, maxLat: 60.5 })
  assert.ok(equateur > 110 && equateur < 112, `équateur : ${equateur}`)
  // À 60° la longitude ne porte plus que ~56 km : c'est la HAUTEUR (110 km)
  // qui devient le plus grand côté.
  assert.ok(nordique > 109 && nordique < 112, `nordique : ${nordique}`)
})

test('la largeur prend le plus grand côté, pas la longitude seule', () => {
  const aplatie = largeurEmpriseKm({ minLon: 0, maxLon: 0.1, minLat: 0, maxLat: 1 })
  assert.ok(aplatie > 109, `une emprise haute garde son information : ${aplatie}`)
})

test('une emprise absente ou illisible rend zéro, pas NaN', () => {
  assert.equal(largeurEmpriseKm(null), 0)
  assert.equal(largeurEmpriseKm({}), 0)
  assert.equal(largeurEmpriseKm({ minLon: NaN, maxLon: 1, minLat: 0, maxLat: 1 }), 0)
})

// ── L'antiméridien ──────────────────────────────────────────────────────────

test('une emprise qui franchit ±180° garde sa VRAIE largeur, pas son complément', () => {
  // LE DÉFAUT DU 2026-08-02, en un test. `demBounds` triait ses deux
  // longitudes au lieu de rendre ouest puis est, et un bloc pacifique de 67,5°
  // ressortait à 292,5° — son complément. Le masque de mer, la plage
  // d'altitude, les tuiles et tout placement par lat/lon s'en trouvaient faux.
  const aCheval = { minLon: 150, maxLon: -142.5, minLat: 0, maxLat: 0.001 }
  const km = largeurEmpriseKm(aCheval)
  // 67,5° à l'équateur ≈ 7 514 km. Le complément (292,5°) en ferait 32 561.
  assert.ok(km > 7000 && km < 8000, `attendu ~7 514 km, obtenu ${km.toFixed(0)}`)
})

test('une emprise ordinaire n’est pas touchée par la règle d’enroulement', () => {
  const normale = { minLon: 5, maxLon: 7, minLat: 45, maxLat: 45.001 }
  const km = largeurEmpriseKm(normale)
  assert.ok(km > 155 && km < 160, `attendu ~157 km, obtenu ${km.toFixed(0)}`)
})
