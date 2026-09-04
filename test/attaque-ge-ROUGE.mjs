// ══════════════════════════════════════════════════════════════════════════
// ATTAQUE GE — LES GESTES QUI NE SONT PAS CEUX DE GOOGLE EARTH.
// ══════════════════════════════════════════════════════════════════════════
//
// ⛔ **CE FICHIER EST ROUGE AU 2026-09-03, ET C'EST VOULU.** Il n'est PAS dans
// la liste de `package.json` : `npm test` ne le voit pas, et ne doit pas le
// voir tant que GE2 n'a pas implémenté. Il est l'énoncé exécutable du barème
// de `rapport-GE1.md`.
//
// LA COMMANDE — deux terminaux, parce qu'il faut un serveur :
//
//   1) npm run dev -- --host 127.0.0.1 --port 6771
//   2) node --test --test-concurrency=1 test/attaque-ge-ROUGE.mjs
//
//   · `GE_PORT=6771`      change le port (défaut 6771)
//   · `GE_MESURES=chemin` réutilise un relevé déjà fait au lieu de remesurer
//     (le banc met ~6 min : un chargement de page PAR GESTE, voir plus bas).
//
// ══════════ POURQUOI CE BANC-LÀ, ET PAS UN TEST UNITAIRE ═══════════════════
//
// `boutons-camera.js` est déjà couvert en unitaire : il dit quelle CONSTANTE
// est posée sur quel bouton. Ce qu'Adrien demande n'est pas une constante,
// c'est un COMPORTEMENT à l'écran — « exactement les mêmes fonctions à la
// souris que dans Google Earth ». Un test qui relit `controls.mouseButtons`
// serait vert le jour où le clic droit zoome de travers.
//
// Tous les seuils sont donc en **degrés d'angle**, en **pixels d'écran** ou en
// **rapport de distance caméra→cible** — jamais en unités de bloc. Deux seuils
// d'un barème précédent visaient 80 et 200 km à côté de ce qu'ils croyaient
// sonder, parce qu'ils lisaient `hypot(target.x, target.z)` en espace bloc.
//
// ⚠️ **DEUX PIÈGES DE MESURE PAYÉS, ET ENCODÉS DANS LA SONDE :**
//  ① Échap envoyé avant la fin du vol de présentation (3,1 s après `#loading`)
//     fige la caméra à 9,8 km au lieu de 36,7 km.
//  ② La pose de démarrage est à 30,7–33,6 km selon le chargement, et
//     `SEUIL_NAISSANCE_M` vaut 32 274,3 m : mesurer là, c'est mesurer à cheval
//     sur la naissance du crop. On mesure donc à **2 465 km**, franchement au
//     large du seuil, là où D19 vit.
//
// ⚠️ **LE TÉMOIN EST DANS LE RELEVÉ** (`temoin-sans-geste`) : 90 images sans
// aucun geste. Le socle annonçait « le globe tourne seul à ~2 °/s » ; mesuré
// ici, c'est **0,000°** sur 5 s. Si un jour ce témoin n'est plus nul, toutes
// les rotations de ce fichier sont à corriger de sa valeur avant d'être lues.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = process.env.GE_PORT || '6771'
const CHEMIN = process.env.GE_MESURES || path.join(RACINE, '.banc', 'GE1', 'mesures-2000km.json')

if (!process.env.GE_MESURES || !fs.existsSync(CHEMIN)) {
  execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'sonde-ge1.mjs'), '--port', PORT, '--alt', '2000000'],
    { cwd: RACINE, stdio: 'inherit', timeout: 900000 })
}
const M = JSON.parse(fs.readFileSync(CHEMIN, 'utf8')).gestes
const g = (nom) => { assert.ok(M[nom], `geste absent du relevé : ${nom}`); return M[nom] }
// ══════════ GE3, TOUR 2 — TROIS LECTURES DU BARÈME CORRIGÉES PAR LE NOTEUR ═══
// (le correcteur GE2 les a contestées, le noteur les a relues à la source)
//  ① L'UNITÉ : `rapportDistance` lisait `camera.position.distanceTo(controls.target)`
//     en UNITÉS DE BLOC — une grandeur qui DOUBLE quand l'escalier change de
//     palier (|Δ ln d| = 0,70 sur une image où l'altitude bouge de 0,8 %). Le
//     barème veut « le rapport de distance caméra→cible » — au nadir, c'est
//     l'ALTITUDE (le rayon de camGlobe). `zoomDe()` lit `rapportAlt`
//     (altDebut / altFin, > 1 = zoom avant) quand la sonde le fournit.
//  ② LE SENS : guide Google Earth v4 § Using a Mouse — « press the RIGHT mouse
//     button … move the mouse backward or pull toward you » = ZOOM IN ; « move
//     the mouse forward or push away from you » = ZOOM OUT. Vers le BAS de
//     l'écran = vers soi = AVANT. Le test de GE1 attendait l'inverse.
//  ③ LA VISÉE : `GE_VISEE` ne bascule que le DOUBLE-CLIC (C4, Google : « toward
//     cursor location ») ; la MOLETTE vise TOUJOURS le centre (D19 §2 — Google ne
//     publie aucune cible pour la molette).
const zoomDe = (d) => (typeof d.rapportAlt === 'number' ? d.rapportAlt : d.rapportDistance)

// ══════════ LE TÉMOIN — sans lui, rien de ce qui suit ne prouve quoi que ce soit
test('témoin : sans geste, la caméra ne bouge pas (le globe ne tourne PAS seul)', () => {
  const t = g('temoin-sans-geste')
  assert.ok(t.rotationDeg <= 0.02, `dérive sans geste : ${t.rotationDeg}° (attendu ≤ 0,02°)`)
  assert.ok(t.rapportDistance > 0.999 && t.rapportDistance < 1.001, `dérive d'altitude sans geste : ×${t.rapportDistance}`)
})

// ══════════ C1 — LE CLIC DROIT GLISSÉ VERTICALEMENT DOIT ZOOMER ════════════
// Google Earth Web, verbatim : « Zoom in and out: At the bottom right, use +/-
// or right drag the mouse. »
//   https://developers.google.com/maps/documentation/earth/discover-places-change-view
// ROUGE : chez nous il DÉPLACE la caméra (rapport de distance 1,000, et le
// point sous la caméra glisse de 2,85°).
test('C1 · clic droit glissé vers le BAS (vers soi, sens Pro) zoome (rapport ≥ 1,5), sans incliner ni tourner', () => {
  const d = g('droit-glisse-V-bas')
  assert.ok(zoomDe(d) >= 1.5, `rapport d'altitude : ${zoomDe(d)} (attendu ≥ 1,5)`)
  assert.ok(zoomDe(d) <= 3.0, `rapport d'altitude : ${zoomDe(d)} (attendu ≤ 3,0)`)
  assert.ok(Math.abs(d.dTiltDeg) <= 0.2, `inclinaison parasite : ${d.dTiltDeg}° (attendu ≤ 0,2°)`)
  assert.ok(Math.abs(d.dAzimutDeg) <= 0.2, `azimut parasite : ${d.dAzimutDeg}° (attendu ≤ 0,2°)`)
  assert.ok(d.rotationDeg <= 0.3, `c'est un déplacement, pas un zoom : ${d.rotationDeg}° de rotation (attendu ≤ 0,3°)`)
  const pire = typeof d.pireRapportAlt === 'number' ? d.pireRapportAlt : d.pireRapportImage
  assert.ok(pire <= 1.10, `saut d'altitude entre deux images : ×${pire} (attendu ≤ 1,10)`)
})
test('C1 · clic droit glissé vers le HAUT (push away) dézoome, symétrique à ±5 %', () => {
  const h = g('droit-glisse-V-haut'), b = g('droit-glisse-V-bas')
  assert.ok(zoomDe(h) < 1, `le glissé vers le haut doit dézoomer : ${zoomDe(h)}`)
  const ecart = Math.abs(Math.log(zoomDe(h) * zoomDe(b)))
  assert.ok(ecart <= 0.05, `haut et bas ne sont pas symétriques : ×${zoomDe(h)} contre ×${zoomDe(b)}`)
})

// ══════════ C2 — LE CLIC DROIT GLISSÉ HORIZONTALEMENT ══════════════════════
// Earth Web ne le documente pas ; le guide utilisateur Google Earth (Pro) lui
// donne la ROTATION du 3D Viewer. Deux issues sont acceptables — tourner
// l'azimut, ou ne rien faire — mais PAS déplacer la caméra, ce qu'il fait
// aujourd'hui (2,55° de rotation du point sous la caméra).
test('C2 · clic droit glissé horizontal : azimut OU rien, jamais un déplacement', () => {
  const d = g('droit-glisse-H')
  const tourne = Math.abs(d.dAzimutDeg) >= 20 && Math.abs(d.dTiltDeg) <= 2 && Math.abs(Math.log(d.rapportDistance)) <= 0.1
  const inerte = Math.abs(d.dAzimutDeg) <= 0.2 && d.rotationDeg <= 0.05 && Math.abs(Math.log(d.rapportDistance)) <= 0.01
  assert.ok(tourne || inerte,
    `ni rotation d'azimut ni inertie : Δazimut ${d.dAzimutDeg}°, rotation du sol ${d.rotationDeg}°, ×${d.rapportDistance}`)
})

// ══════════ C3 — L'INCLINAISON EST SUR Ctrl + GLISSÉ ═══════════════════════
// Earth Web, verbatim : « Explore around your location: Hold Ctrl + drag the
// screen. » ROUGE : chez nous Ctrl + glissé est un PAN (OrbitControls bascule
// ROTATE → PAN dès que ctrl/meta/shift est tenu, OrbitControls.js:1271-1280),
// mesuré 0,000° d'inclinaison.
test('C3 · Ctrl + glissé vertical incline d’au moins 25°, autour de ce qu’on regarde', () => {
  const d = g('ctrl-gauche-glisse-V')
  assert.ok(Math.abs(d.dTiltDeg) >= 25, `inclinaison : ${d.dTiltDeg}° (attendu ≥ 25°)`)
  assert.ok(Math.abs(d.dTiltDeg) <= 80, `inclinaison : ${d.dTiltDeg}° (attendu ≤ 80°)`)
  assert.ok(d.centre0DerivePx !== null && d.centre0DerivePx <= 20,
    `le point visé au centre s'échappe de ${d.centre0DerivePx} px (attendu ≤ 20 px) : on n'orbite pas autour de lui`)
  assert.ok(Math.abs(Math.log(d.rapportDistance)) <= 0.10, `l'inclinaison ne doit pas zoomer : ×${d.rapportDistance}`)
})

// ══════════ C4 — LE DOUBLE-CLIC ═══════════════════════════════════════════
// Earth Web, verbatim, page « Use keyboard shortcuts on your computer » :
//   « Zoom toward cursor location — Double click (left) »
//   « Zoom away from cursor location — Double click (right) »
//   https://developers.google.com/maps/documentation/earth/use-keyboard-shortcuts
//
// ⚠️ **LE SEUIL « CURSEUR » EST SOUS ARBITRAGE.** D19 §2 dit « le point visé au
// centre de l'écran ». Si Adrien tranche « centre », remplacer dans les deux
// tests `curseur0DerivePx` par `centre0DerivePx` — et RIEN d'autre.
// Défaut = `centre`, parce que D19 est la règle EN VIGUEUR tant qu'Adrien n'a
// pas arbitré. `GE_VISEE=curseur` bascule vers la lettre de la page Google.
const VISEE = process.env.GE_VISEE === 'curseur' ? 'curseur0DerivePx' : 'centre0DerivePx'
test('C4 · double-clic GAUCHE : ×2 de distance, vers le point désigné', () => {
  const d = g('double-clic-gauche')
  assert.ok(zoomDe(d) >= 1.8 && zoomDe(d) <= 2.2, `rapport d'altitude : ${zoomDe(d)} (attendu 1,8–2,2)`)
  assert.ok(d[VISEE] !== null && d[VISEE] <= 25, `le point visé (${VISEE}) dérive de ${d[VISEE]} px (attendu ≤ 25 px)`)
  assert.ok(Math.abs(d.dTiltDeg) <= 0.5, `inclinaison parasite : ${d.dTiltDeg}° (attendu ≤ 0,5°)`)
  assert.ok(d.rotationDeg <= 2, `la Terre ne doit pas rouler sous le double-clic : ${d.rotationDeg}°`)
})
test('C4 · double-clic DROIT : ÷2 de distance, depuis le point désigné', () => {
  const d = g('double-clic-droit')
  assert.ok(zoomDe(d) >= 0.45 && zoomDe(d) <= 0.56, `rapport d'altitude : ${zoomDe(d)} (attendu 0,45–0,56)`)
  assert.ok(d[VISEE] !== null && d[VISEE] <= 25, `le point visé (${VISEE}) dérive de ${d[VISEE]} px (attendu ≤ 25 px)`)
})

// ══════════ C5 — LE CLIC SIMPLE NE PLONGE PAS ══════════════════════════════
// Aucune des quatre pages officielles n'attribue d'action au clic simple sur le
// globe ; le zoom y est explicitement le DOUBLE-clic. ROUGE : chez nous un clic
// simple descend de 2 465 km à 1 225 km (×2,00) et fait rouler la Terre de
// 3,88°.
test('C5 · le clic simple sur le globe ne fait rien', () => {
  const d = g('clic-simple')
  assert.ok(Math.abs(Math.log(zoomDe(d))) <= 0.02, `le clic simple zoome de ×${zoomDe(d)} (attendu ×1,00 ± 2 %)`)
  assert.ok(d.rotationDeg <= 0.05, `le clic simple fait rouler la Terre de ${d.rotationDeg}° (attendu ≤ 0,05°)`)
})

// ══════════ C6 — LE BOUTON DU MILIEU ET LE REPLI Maj ═══════════════════════
// Google Earth (Pro, page « Explore the Earth on your computer », onglet Mac) :
// « Press and hold the scroll button. Then, move the mouse forward or backward »
// pour incliner. ROUGE : chez nous le milieu est un PAN — et le commentaire en
// tête de `boutons-camera.js` (« le bouton du milieu ne fait donc RIEN dans
// cette application ») est **faux depuis qu'il pose MOUSE.PAN dessus** :
// `enableZoom = false` neutralise DOLLY, pas PAN. Mesuré : 3,06° de rotation
// du point sous la caméra sur un glissé horizontal de 200 px.
test('C6 · bouton du milieu glissé vertical : incline (≥ 25°)', () => {
  const d = g('milieu-glisse-V')
  assert.ok(Math.abs(d.dTiltDeg) >= 25, `inclinaison : ${d.dTiltDeg}° (attendu ≥ 25°)`)
})
test('C6 · bouton du milieu glissé horizontal : tourne l’azimut (≥ 20°)', () => {
  const d = g('milieu-glisse-H')
  assert.ok(Math.abs(d.dAzimutDeg) >= 20, `azimut : ${d.dAzimutDeg}° (attendu ≥ 20°)`)
  assert.ok(Math.abs(d.dTiltDeg) <= 2, `inclinaison parasite : ${d.dTiltDeg}°`)
})
test('C6 · Maj + gauche est le repli du milieu sur un portable, à ±10 %', () => {
  const m = g('milieu-glisse-H'), s = g('maj-gauche-glisse')
  assert.ok(Math.abs(m.dAzimutDeg) > 1, 'le milieu doit d’abord tourner (voir le test précédent)')
  assert.ok(Math.abs(s.dAzimutDeg / m.dAzimutDeg - 1) <= 0.10,
    `Maj + gauche rend ${s.dAzimutDeg}° là où le milieu rend ${m.dAzimutDeg}°`)
})

// ══════════ C7 — PAS DE MENU CONTEXTUEL SUR LE GLOBE ═══════════════════════
// Google Earth n'ouvre aucun menu du navigateur sur le globe, et il ne le peut
// pas : le clic droit y est un geste de caméra. ROUGE : `main.js:3140` n'appelle
// `preventDefault()` que si `fenetreContinueActive() && mode === 'surface'` — le
// drapeau `fenetreContinue` est ÉTEINT (`flags.js`), donc le menu natif s'ouvre.
// Mesuré : 1 événement `contextmenu`, `defaultPrevented: false`.
test('C7 · le clic droit sur le canvas n’ouvre pas le menu du navigateur', () => {
  const d = g('menu-contextuel')
  assert.equal(d.menu.evenements, 1, 'un et un seul contextmenu doit être vu par la sonde')
  assert.equal(d.menu.defaultPrevented, true, 'le contextmenu doit être annulé (preventDefault) sur le canvas')
})

// ══════════ C8 — L'INERTIE RESTE BORNÉE ════════════════════════════════════
// ⚠️ **AUCUNE page officielle de Google ne documente d'inertie** : elle n'est ni
// exigée ni interdite. Ce test ne demande donc pas qu'elle existe — il demande
// qu'elle ne prenne pas la main. Mesuré aujourd'hui : 0,976° après le relâché
// pour un geste de 16,3°, éteinte en 1 419 ms. C'est déjà conforme ; le test est
// ici pour que GE2 ne le casse pas en réécrivant le glissé.
test('C8 · après le relâché, l’élan ajoute ≤ 15 % du geste et meurt en ≤ 1 800 ms', () => {
  const d = g('gauche-elan')
  assert.ok(d.elanDeg <= d.rotationDeg * 0.15,
    `élan ${d.elanDeg}° pour un geste de ${d.rotationDeg}° (attendu ≤ 15 %)`)
  assert.ok(d.elanDureeMs <= 1800, `élan encore vivant après ${d.elanDureeMs} ms (attendu ≤ 1 800 ms)`)
})

// ══════════ NON-RÉGRESSION — LES ACQUIS DE D19, EN PIXELS ══════════════════
// ⛔ Ce bloc est ÉLIMINATOIRE dans le barème de `rapport-GE1.md` : un seul
// échec ici met la note à 0, quels que soient C1–C8.
test('D19 §1 · le glissé gauche laisse le centre de la Terre planté (≤ 1,0 px)', () => {
  for (const nom of ['gauche-glisse-H', 'gauche-glisse-V']) {
    const d = g(nom)
    assert.ok(d.terreDerivePx <= 1.0, `${nom} : le centre de la Terre dérive de ${d.terreDerivePx} px`)
    assert.equal(d.dTiltDeg, 0, `${nom} : le glissé ne doit pas incliner (D16 ter) — ${d.dTiltDeg}°`)
  }
})
test('D19 §1 · le point saisi reste sous le curseur (≤ 1,4 px) — les DEUX axes', () => {
  // ⚡ ROUGE SUR L'AXE HORIZONTAL, ET C'EST LA TROUVAILLE DE CE FICHIER.
  // Vertical : 0,00 px, parfait. Horizontal : **747 px** pour un glissé de
  // 200 px — la Terre tourne de 15,80° là où le geste en demande ~3,9°, soit
  // un facteur ~4. R32 a été validée 10/10 à « 0,2 px » ; ce n'était donc pas
  // sur ce geste-là, ou pas à cette altitude-là.
  for (const nom of ['gauche-glisse-V', 'gauche-glisse-H']) {
    const d = g(nom)
    assert.ok(d.saisiVsPointeurPx !== null && d.saisiVsPointeurPx <= 1.4,
      `${nom} : le point saisi est à ${d.saisiVsPointeurPx} px du curseur (attendu ≤ 1,4 px)`)
  }
})
test('D19 §2 · la molette vise le point au CENTRE de l’écran (≤ 1,4 px)', () => {
  // ⚠️ SOUS ARBITRAGE, comme C4 : si Adrien tranche « curseur », c'est
  // `curseur0DerivePx` qu'il faut lire, et ce test devient ROUGE (49,25 px).
  for (const nom of ['molette-avant-6crans', 'molette-arriere-6crans', 'molette-1cran']) {
    const d = g(nom)
    // ③ (GE3 tour 2) : la molette vise TOUJOURS le centre, quelle que soit GE_VISEE
    assert.ok(d.centre0DerivePx !== null && d.centre0DerivePx <= 1.4, `${nom} : centre0DerivePx = ${d.centre0DerivePx} px`)
  }
})
test('D16 ter · le glissé gauche et la molette avant n’inclinent pas (acquis, VERT)', () => {
  // ⚠️ **PORTÉE VOLONTAIREMENT RESTREINTE, ET C'EST UN RÉSULTAT.** D16 ter est
  // DÉJÀ violée aujourd'hui par deux gestes, mesuré à 2,4 Mm — bien au-dessus
  // du bloc : le **clic simple** incline de **7,684°** (c'est sa plongée), et la
  // **molette arrière** de **−2,607°**. Un critère de non-régression ne peut pas
  // être rouge au départ : ces deux-là sont notés ailleurs (C5, et la réserve du
  // rapport), pas ici. Ici on verrouille ce qui est vert.
  for (const nom of ['gauche-glisse-H', 'gauche-glisse-V', 'gauche-elan', 'molette-1cran', 'molette-avant-6crans']) {
    const d = g(nom)
    assert.ok(Math.abs(d.dTiltDeg) <= 0.5, `${nom} incline de ${d.dTiltDeg}° à 2,4 Mm, loin du bloc`)
  }
})
test('⚠️ RÉSERVE · D16 ter est déjà violée par le clic simple et la molette arrière', () => {
  // Ce test n'est PAS dans le critère éliminatoire : il documente l'état.
  // Il passera au vert quand C5 aura supprimé la plongée du clic simple.
  const c = g('clic-simple'), m = g('molette-arriere-6crans')
  assert.ok(Math.abs(c.dTiltDeg) <= 0.5, `le clic simple incline de ${c.dTiltDeg}° hors du bloc`)
  assert.ok(Math.abs(m.dTiltDeg) <= 0.5, `la molette arrière incline de ${m.dTiltDeg}° hors du bloc`)
})
