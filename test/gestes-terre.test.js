import test from 'node:test'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {
  GESTE, REGIME, PIVOT_VERS_LE_CURSEUR, PX_PAR_CRAN_ZOOM, CRAN, MAX_CRANS_PAR_PAS,
  CRANS_DOUBLE_CLIC, DEG_PAR_PIXEL, INCLINAISON_MAX_DEG, INCLINAISON_MIN_DEG,
  DOUBLE_CLIC_MAX_MS, DOUBLE_CLIC_SLOP_PX,
  gesteDuBouton, inclinaisonPermise, regimeTerreActif, plafonnerElan, FRACTION_ELAN_MAX, CRANS_UN_NIVEAU, zoomDuGlisseDroit, zoomDuDoubleClic,
  pasInclinaison, estDoubleClic,
} from '../src/monde/gestes-terre.js'

// ══════════ CE QUE CE FICHIER EMPÊCHE DE REVENIR — Tâche GE2 ════════════════
//
// > **Adrien, 2026-09-03 :** *« Attribue à notre programme exactement les mêmes
// > fonctions à la souris que celles qui sont dans Google Earth (clic droit,
// > gauche, roulette), tout doit fonctionner pareil. »*
//
// Les nombres cités ci-dessous viennent de `.banc/GE2/avant-surface.json` et
// `.banc/GE2/apres-surface.json` (Chrome sans tête 1280 × 800, gestes CDP,
// relevé au rendu sur la caméra qui rend). ⛔ **Aucun n'est un réglage choisi :
// chacun est soit une mesure, soit une ligne de la documentation de Google.**

test('GE2 ① — le clic droit ZOOME, il ne déplace pas (le 527 × du seuil)', () => {
  // MESURÉ AVANT : le clic droit tombait sur le déplacement d'OrbitControls, et
  // un glissé de 200 px hors du crop produisait |Δ ln(distance caméra→cible)| =
  // 5,27e-2 — 527 fois le seuil 1e-4 de `veille-repos`, le signal même qui arme
  // la bascule de trois quarts de D16 ter. Google Earth, lui, documente le clic
  // droit comme un ZOOM (Web : « right drag the mouse » ; Pro : « move the mouse
  // backward or pull toward you »).
  for (const regime of [REGIME.ORBITE, REGIME.SURFACE]) {
    assert.equal(gesteDuBouton({ bouton: 2, regime }), GESTE.ZOOM, `régime ${regime}`)
  }
})

test('GE2 ② — le SENS du clic droit est celui de Google Earth Pro, pas l’intuitif', () => {
  // « pull toward you » — tirer la souris vers soi, donc vers le BAS de l'écran
  // (dy > 0) — zoome AVANT. Dans la langue de la molette (gestes.js), zoomer
  // avant c'est deltaY NÉGATIF.
  assert.ok(zoomDuGlisseDroit(+40) < 0, 'glisser vers soi (bas) = zoom avant = deltaY < 0')
  assert.ok(zoomDuGlisseDroit(-40) > 0, 'pousser (haut) = zoom arrière = deltaY > 0')
  assert.equal(zoomDuGlisseDroit(-PX_PAR_CRAN_ZOOM), CRAN, 'un cran vaut exactement PX_PAR_CRAN_ZOOM pixels')
  assert.equal(zoomDuGlisseDroit(0), 0)
})

test('GE2 ③ — un pas de zoom est PLAFONNÉ : une image sautée ne franchit pas cinq paliers', () => {
  // Le garde-fou de `gestes.js`, mot pour mot : « un doigt perdu puis retrouvé,
  // ou une image sautée sous la charge, peut faire bondir l'écartement d'un
  // facteur dix ; sans plafond la machine à modes franchirait plusieurs paliers
  // de relief en une seule image. » Un `pointermove` avalé pendant un
  // chargement produit exactement le même saut.
  assert.equal(zoomDuGlisseDroit(100000), -MAX_CRANS_PAR_PAS * CRAN)
  assert.equal(zoomDuGlisseDroit(-100000), MAX_CRANS_PAR_PAS * CRAN)
  for (const v of [NaN, Infinity, undefined, null, '40', {}]) assert.equal(zoomDuGlisseDroit(v), 0, `entrée ${String(v)}`)
})

test('GE2 ④ — le clic droit glissé HORIZONTAL ne fait RIEN : Google ne le documente pas', () => {
  // ⛔ Ni l'aide de Google Earth Web ni le guide Pro ne décrivent d'axe
  // horizontal au clic droit — Pro ne documente que le vertical. Un geste
  // inventé serait indiscernable d'un défaut pour qui compare avec Google Earth.
  // La preuve exécutable : `zoomDuGlisseDroit` ne prend QUE `dy`, il n'a pas de
  // paramètre horizontal à ignorer.
  assert.equal(zoomDuGlisseDroit.length, 1, 'un seul paramètre : le vertical')
})

test('GE2 ⑤ — l’inclinaison MANUELLE est permise, l’AUTOMATIQUE reste à D16 ter', () => {
  // D16 ter : « On passe en vue 3/4 quand on arrive au bloc, pas avant. »
  // Google Earth Pro incline au clic droit PARTOUT (« Zoom plus automatic
  // tilt »). Les deux se décroisent sur un mot : l'inclinaison qu'on DEMANDE
  // (milieu, Ctrl, Maj) est permise ; celle que la machine DÉCIDE ne l'est pas.
  // ⛔ Le test qui compte : `GESTE.ZOOM` ne porte AUCUNE inclinaison, alors que
  // Google Earth en met une sur exactement le même geste.
  assert.equal(gesteDuBouton({ bouton: 2, regime: REGIME.SURFACE }), GESTE.ZOOM)
  assert.equal(gesteDuBouton({ bouton: 1, regime: REGIME.SURFACE }), GESTE.INCLINAISON, 'bouton du milieu')
  assert.equal(gesteDuBouton({ bouton: 0, ctrl: true, regime: REGIME.SURFACE }), GESTE.INCLINAISON, 'Ctrl + gauche')
  assert.equal(gesteDuBouton({ bouton: 0, maj: true, regime: REGIME.SURFACE }), GESTE.INCLINAISON, 'Maj + gauche')
})

test('GE2 ⑥ — en ORBITE il n’y a rien à incliner, et c’est géométrique', () => {
  // `controls.target` y est le CENTRE DE LA TERRE : tourner la caméra autour de
  // lui n'incline rien, c'est très exactement le glissé gauche de D19. Le geste
  // y serait un doublon silencieux du bouton gauche — et Google Earth Web ne
  // documente de toute façon jamais le bouton du milieu.
  assert.equal(inclinaisonPermise(REGIME.ORBITE), false)
  assert.equal(inclinaisonPermise(REGIME.SURFACE), true)
  assert.equal(inclinaisonPermise(REGIME.CROP), false)
  assert.equal(gesteDuBouton({ bouton: 1, regime: REGIME.ORBITE }), GESTE.INERTE)
  assert.equal(gesteDuBouton({ bouton: 0, ctrl: true, regime: REGIME.ORBITE }), GESTE.INERTE)
})

test('GE2 ⑦ — sur le CROP, rien de tout ceci ne s’applique : c’est l’exception d’Adrien', () => {
  // R13 : sur le bloc croppé, le pivot est l'axe du bloc, et OrbitControls garde
  // ses boutons. D19 le redit : « L'exception du crop pour le pivot (règle
  // d'Adrien du matin) ».
  for (const bouton of [0, 1, 2]) {
    for (const mod of [{}, { ctrl: true }, { maj: true }, { alt: true }]) {
      assert.equal(gesteDuBouton({ bouton, ...mod, regime: REGIME.CROP }), GESTE.INERTE, `bouton ${bouton} ${JSON.stringify(mod)}`)
    }
  }
})

test('GE2 ⑧ — Alt n’est PAS un modificateur de glissé : la saisie garde le bouton', () => {
  // MESURÉ AVANT (`.banc/GE2/avant-surface.json`) : Alt + glissé gauche
  // déclenchait les DEUX à la fois — la saisie de R32 (qui n'exclut que
  // ctrl/meta/shift) ET le déplacement d'OrbitControls. Résultat, 322 px de
  // dérive du centre contre 200 px pour un glissé gauche nu, et 22,9° de
  // longitude contre 8,6°. Google, de son côté, ne documente Alt qu'AVEC la
  // molette (« zoom in by smaller increments »), jamais avec un glissé.
  assert.equal(gesteDuBouton({ bouton: 0, alt: true, regime: REGIME.SURFACE }), GESTE.SAISIE)
  assert.equal(gesteDuBouton({ bouton: 0, alt: true, regime: REGIME.ORBITE }), GESTE.SAISIE)
})

test('GE2 ⑨ — le glissé gauche nu reste la SAISIE partout : R32 n’est pas touché', () => {
  for (const regime of [REGIME.ORBITE, REGIME.SURFACE]) {
    assert.equal(gesteDuBouton({ bouton: 0, regime }), GESTE.SAISIE, `régime ${regime}`)
  }
})

test('GE2 ⑩ — le double-clic DROIT dézoome, le gauche n’est pas réécrit', () => {
  // Google Earth Web, mot pour mot : « Zoom away from cursor location — Double
  // click (right) ». Le gauche (« Zoom toward cursor location ») est DÉJÀ servi
  // par le clic simple de R35 — un glissé d'un niveau vers le point visé — et
  // R35 est un acquis verrouillé : y ajouter un troisième zoom le compterait
  // deux fois.
  assert.ok(zoomDuDoubleClic(2) > 0, 'droit = dézoom = deltaY > 0')
  assert.equal(zoomDuDoubleClic(2), CRANS_DOUBLE_CLIC * CRAN)
  assert.ok(zoomDuDoubleClic(0) < 0, 'gauche = zoom = deltaY < 0')
  assert.equal(zoomDuDoubleClic(1), 0, 'le milieu ne double-clique pas')
})

test('GE2 ⑪ — le double-clic se reconnaît au DÉLAI et à la DÉRIVE, pas au seul délai', () => {
  const p = { t: 1000, x: 640, y: 400, bouton: 2 }
  assert.equal(estDoubleClic({ precedent: p, t: 1200, x: 641, y: 401, bouton: 2 }), true)
  assert.equal(estDoubleClic({ precedent: p, t: 1000 + DOUBLE_CLIC_MAX_MS + 1, x: 640, y: 400, bouton: 2 }), false, 'trop tard')
  assert.equal(estDoubleClic({ precedent: p, t: 1200, x: 640 + DOUBLE_CLIC_SLOP_PX + 1, y: 400, bouton: 2 }), false, 'la main a bougé')
  assert.equal(estDoubleClic({ precedent: p, t: 1200, x: 640, y: 400, bouton: 0 }), false, 'pas le même bouton')
  assert.equal(estDoubleClic({ precedent: null, t: 1200, x: 640, y: 400, bouton: 2 }), false, 'pas de précédent')
  assert.equal(estDoubleClic({ precedent: p, t: 900, x: 640, y: 400, bouton: 2 }), false, 'horloge à rebours')
})

test('GE2 ⑫ — l’inclinaison est BORNÉE des deux côtés, et les bornes sont exactes', () => {
  // La butée haute n'est pas un goût : au-delà, l'axe optique passe sous
  // l'horizon et la vue ne montre plus que le ciel. La butée basse est le nadir,
  // d'où D16 ter part et où elle revient.
  const haut = pasInclinaison({ dyPx: -100000, inclinaisonDeg: 30 })
  assert.equal(+(30 + haut.dInclinaisonDeg).toFixed(9), INCLINAISON_MAX_DEG)
  const bas = pasInclinaison({ dyPx: +100000, inclinaisonDeg: 30 })
  assert.equal(+(30 + bas.dInclinaisonDeg).toFixed(9), INCLINAISON_MIN_DEG)
  // et à la butée, un pas de plus ne rend RIEN — pas une valeur négative
  assert.equal(pasInclinaison({ dyPx: -50, inclinaisonDeg: INCLINAISON_MAX_DEG }).dInclinaisonDeg, 0)
  assert.equal(pasInclinaison({ dyPx: +50, inclinaisonDeg: INCLINAISON_MIN_DEG }).dInclinaisonDeg, 0)
})

test('GE2 ⑬ — le SENS de l’inclinaison est celui de Google Earth Pro', () => {
  // « you can tilt the view by depressing the button and moving the mouse
  // forward » — pousser la souris (vers le HAUT de l'écran, dy < 0) COUCHE la
  // vue ; la tirer la redresse au nadir.
  assert.ok(pasInclinaison({ dyPx: -40, inclinaisonDeg: 30 }).dInclinaisonDeg > 0, 'pousser couche la vue')
  assert.ok(pasInclinaison({ dyPx: +40, inclinaisonDeg: 30 }).dInclinaisonDeg < 0, 'tirer la redresse')
  assert.equal(pasInclinaison({ dyPx: -40, inclinaisonDeg: 30 }).dInclinaisonDeg, 40 * DEG_PAR_PIXEL)
  // l'horizontal fait tourner le CAP, et rien d'autre
  const h = pasInclinaison({ dxPx: 40, inclinaisonDeg: 30 })
  assert.equal(h.dInclinaisonDeg, 0, 'un glissé horizontal n’incline pas')
  assert.equal(h.dCapDeg, -40 * DEG_PAR_PIXEL)
})

test('GE2 ⑭ — aucune entrée dégénérée ne fait jamais un NaN dans la caméra', () => {
  for (const v of [NaN, Infinity, -Infinity, undefined, null, '30', {}]) {
    const a = pasInclinaison({ dxPx: v, dyPx: 10, inclinaisonDeg: 30 })
    const b = pasInclinaison({ dxPx: 10, dyPx: v, inclinaisonDeg: 30 })
    const c = pasInclinaison({ dxPx: 10, dyPx: 10, inclinaisonDeg: v })
    for (const r of [a, b, c]) {
      assert.ok(Number.isFinite(r.dInclinaisonDeg) && Number.isFinite(r.dCapDeg), `entrée ${String(v)}`)
    }
  }
  assert.deepEqual(pasInclinaison(), { dInclinaisonDeg: 0, dCapDeg: 0 })
  assert.deepEqual(pasInclinaison({}), { dInclinaisonDeg: 0, dCapDeg: 0 })
})

test('GE2 ⑮ — ⛔ LA CONTRADICTION AVEC D19 N’EST PAS TRANCHÉE PAR L’EXÉCUTANT', () => {
  // D19 ② : « quand je scrolle pour zoomer ou dézoomer, je scrolle vers le point
  // visé AU CENTRE DE L'ÉCRAN ». Google Earth documente son double-clic comme
  // « Zoom toward CURSOR location ». Les deux ne peuvent pas être vraies pour un
  // geste qui désigne un point.
  // ⚠️ Pour la MOLETTE il n'y a aucune contradiction DOCUMENTÉE : la table des
  // raccourcis de Google Earth Web n'a pas de ligne molette, et le guide Pro ne
  // décrit que le sens et la vitesse. « Google Earth zoome vers le curseur à la
  // molette » est OBSERVÉ, pas documenté.
  // ➡️ Le prédicat vaut D19, et il est SEUL sur sa ligne pour qu'Adrien bascule
  // en un caractère. Ce test le fige : si quelqu'un le retourne, il devra
  // toucher ce fichier et lire ce commentaire.
  // ⚡ ARBITRÉ LE 2026-09-04 (coordinateur, sur la lettre d'Adrien) : D19 = la
  // MOLETTE, qui reste au centre ; Google = le DOUBLE-CLIC, vers le curseur. Les
  // deux règles ne se contredisent plus lues chacune sur son geste. Le prédicat
  // reste seul sur sa ligne : Adrien peut le retourner en un caractère.
  assert.equal(PIVOT_VERS_LE_CURSEUR, true, 'arbitrage du 2026-09-04 : le double-clic vise le curseur')
})

test('GE2 ⑯ — ⛔ « !!regime » EST FAUX : le crop n’est pas le régime de la Terre', () => {
  // MESURÉ (`.banc/GE2/apres-crop.json`, première passe) : `terre: !!regimeGeste()`
  // rendait `true` sur le crop — les trois valeurs de REGIME sont des chaînes non
  // vides — et lui retirait ses trois boutons. Vol vers z12, altitude 10 km :
  // glissé gauche, clic droit, milieu et Ctrl rendaient TOUS 0 px et 0°. La vue
  // était devenue inerte sur le bloc, c'est-à-dire l'exception d'Adrien (R13)
  // purement et simplement supprimée. Ce test est l'endroit où ça ne repasse pas.
  assert.equal(regimeTerreActif(REGIME.ORBITE), true)
  assert.equal(regimeTerreActif(REGIME.SURFACE), true)
  assert.equal(regimeTerreActif(REGIME.CROP), false, 'le régime de la Terre s’ARRÊTE au crop')
  assert.equal(regimeTerreActif(null), false, 'régime hérité : on ne touche à rien')
  assert.equal(regimeTerreActif(undefined), false)
  // et le piège lui-même, nommé : la double négation ne dit PAS la même chose
  assert.notEqual(regimeTerreActif(REGIME.CROP), !!REGIME.CROP, '« !!regime » est le défaut que ce prédicat remplace')
})

test('GE2 ⑰ — 200 px de clic droit = UN niveau = ×2, et le niveau est celui de modes.js', () => {
  // Le noteur (C1) attend ×1,5 à ×3 pour 200 px, et une symétrie avant/arrière
  // à 5 %. Un niveau de l'escalier fait CRANS_PAR_NIVEAU crans ; 200 px doivent
  // en valoir exactement autant — et `CRANS_UN_NIVEAU`, recopié ici pour rester
  // pur, doit rester égal à la constante de `modes.js`. Ce test lit le texte.
  const modes = fs.readFileSync(new URL('../src/modes.js', import.meta.url), 'utf8')
  const m = modes.match(/export const CRANS_PAR_NIVEAU = (\d+)/)
  assert.ok(m, 'modes.js exporte CRANS_PAR_NIVEAU')
  assert.equal(CRANS_UN_NIVEAU, Number(m[1]), 'CRANS_UN_NIVEAU (gestes-terre) = CRANS_PAR_NIVEAU (modes)')
  assert.equal(200 / PX_PAR_CRAN_ZOOM, CRANS_UN_NIVEAU, '200 px = un niveau')
  assert.equal(CRANS_DOUBLE_CLIC, CRANS_UN_NIVEAU, 'le double-clic vaut un niveau : ×2 à gauche, ÷2 à droite')
  assert.equal(zoomDuDoubleClic(0), -zoomDuDoubleClic(2), 'symétrique')
})

test('GE2 ⑱ — l’élan est plafonné par l’arc du geste, jamais par un réglage de vitesse', () => {
  // C8, huit chargements du noteur : 3 sur 8 armaient ~150 °/s sur un pas de
  // 1 ms et la Terre partait de 10° pour un geste de 3,4°. La course v·τ ne
  // dépasse plus FRACTION_ELAN_MAX de l'arc tiré.
  const tau = 0.35
  const fou = plafonnerElan({ vitesse: { dLat: 0, dLon: 150 }, arcDeg: 3.4, tau })
  assert.equal(fou.plafonne, true)
  assert.ok(Math.abs(fou.courseDeg - 3.4 * FRACTION_ELAN_MAX) < 1e-12, `course ${fou.courseDeg}° pour 3,4° de geste`)
  assert.ok(Math.hypot(fou.vitesse.dLat, fou.vitesse.dLon) * tau <= 3.4 * 0.15 + 1e-12, 'sous les 15 % du barème')
  // un lancer modéré passe intact
  const doux = plafonnerElan({ vitesse: { dLat: 0.3, dLon: 0.4 }, arcDeg: 10, tau })
  assert.equal(doux.plafonne, false)
  assert.deepEqual(doux.vitesse, { dLat: 0.3, dLon: 0.4 })
  // la direction est conservée quand on plafonne
  const p = plafonnerElan({ vitesse: { dLat: 30, dLon: 40 }, arcDeg: 1, tau })
  assert.ok(Math.abs(p.vitesse.dLat / p.vitesse.dLon - 0.75) < 1e-12, 'même direction')
  // sans arc (un clic sans mouvement), pas d'élan du tout
  assert.deepEqual(plafonnerElan({ vitesse: { dLat: 5, dLon: 5 }, arcDeg: 0, tau }).vitesse, { dLat: 0, dLon: 0 })
  // aucune entrée dégénérée ne produit de NaN
  for (const v of [NaN, Infinity, undefined, null]) {
    const r = plafonnerElan({ vitesse: { dLat: v, dLon: 1 }, arcDeg: 5, tau })
    assert.ok(Number.isFinite(r.vitesse.dLat) && Number.isFinite(r.vitesse.dLon), `entrée ${String(v)}`)
  }
})
