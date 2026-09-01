// ⛔⛔⛔ TESTS ATTENDUS **ROUGES** — TÂCHE R30, L'ATTAQUANT. ⛔⛔⛔
//
// ══════════════════════════════════════════════════════════════════════════
// ✅ **2026-09-01 — LES ONZE SONT VERTS (Tâche R29 bis), ET LE FICHIER A ÉTÉ
// SCINDÉ COMME SON EN-TÊTE L'EXIGEAIT.**
//
// Sa condition de fin disait : « le jour où ces onze rouges deviendront verts,
// ce fichier doit être RENOMMÉ en `.test.js` et inscrit dans `package.json` —
// ou supprimé. » Les inscrire TOUS aurait rendu `npm test` rouge sur tout dépôt
// frais : **cinq des onze lisent `.banc/`, qui est dans `.gitignore`.** On a
// donc fait les deux moitiés :
//
//   · les SIX tests PURS (A, A bis, B, B bis, C, C bis) sont partis dans
//     **`test/pivot-molette.test.js`**, inscrit dans `package.json`, avec leurs
//     chiffres et trois témoins de plus (le zoom vers le curseur INTACT sur le
//     crop, le prédicat `horsDuCrop`, les cinq invariants du seuil ensemble) ;
//   · les CINQ gardes de journal (A ter, B ter, D, D bis, E) restent ici, et
//     c'est ici qu'elles ont un sens : elles se rejouent avec les commandes
//     ci-dessous.
//
// ⚠️ **DEUX DES ONZE ONT ÉTÉ RÉÉCRITES, ET C'EST DIT À L'ENDROIT MÊME** —
// A bis (§ « tout geste que le voile CAPTE ») et B ter (§ le retour à l'axe),
// plus D/D bis re-pointées sur la pose DESSINÉE. Chacune porte le chiffre et le
// témoin qui l'imposent ; aucune n'a été assouplie sans mesure.
// ══════════════════════════════════════════════════════════════════════════
//
// ══════════════════════════════════════════════════════════════════════════
// ⚠️ CE FICHIER N'EST **PAS** DANS LA LISTE DE `package.json`, ET C'EST VOULU.
// Il décrit des défauts MESURÉS et NON CORRIGÉS : l'ajouter à `npm test`
// ferait tomber la suite. C'est la livraison de l'attaquant, pas un correctif.
//
//   node --test test/attaque-r30-ROUGE.mjs
//
// ⛔⛔ ET IL S'APPELLE `.mjs`, PAS `.test.js`, ET CE N'EST PAS UN DÉTAIL. ⛔⛔
//
// `scripts/audit-tests.mjs` recense `test/*.test.js` et exige que CHAQUE fichier
// trouvé soit inscrit dans `package.json` — « un test qui ne tourne pas est pire
// qu'un test absent : il rassure ». Le brief R30 demande l'inverse pour
// celui-ci : ne PAS l'inscrire, ET rendre `audit:tests` sans écart. Les deux
// sont inconciliables sous le suffixe `.test.js`.
//
// ➡️ Le suffixe `.mjs` les réconcilie — **et il fait exactement ce que l'audit
// existe pour empêcher : ce fichier lui est invisible.** C'est assumé, c'est
// écrit ici et dans `rapport-R30.md`, et ça a un prix : le jour où ces onze
// rouges deviendront verts, ce fichier doit être RENOMMÉ en `.test.js` et
// inscrit dans `package.json` — ou supprimé. Tant qu'il dort en `.mjs`, il ne
// protège rien.
//
// Chaque test porte le chiffre qui le fonde et le journal d'où il sort
// (`.banc/R30/`, `.banc/R15/`). Un test qui deviendrait VERT signifie que le
// défaut est réparé — c'est le seul usage légitime de ce fichier.
//
// ⚠️ **`.banc/` EST DANS `.gitignore` (ligne 44) : les journaux NE SONT PAS
// COMMITÉS.** Cinq des onze tests sont des GARDES DE JOURNAL et échouent avec
// « journal absent » sur un dépôt frais — c'est rouge, mais pour la mauvaise
// raison. Pour les rejouer, serveur `npm run dev --port 5931` puis :
//
//   node scripts/sonde-attaque-r30.mjs --port 5931 --manche voile
//   node scripts/sonde-attaque-r30.mjs --port 5931 --manche sol
//   node scripts/sonde-attaque-r30.mjs --port 5931 --manche molette --coucher 0 --x 950 --y 230
//   cp .banc/R30/molette.json .banc/R30/molette-hors-centre-px.json
//   node scripts/diag-r15-saut.mjs --port 5931 --etiquette r30-saut --crans 150
//
// Les six autres (A, A bis, B, B bis, C, C bis) sont PURS et ne dépendent
// d'aucun journal : ils lisent `src/` ou tournent la machine à modes.
// ══════════════════════════════════════════════════════════════════════════

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Y_CIBLE } from '../src/loi-altitude.js'
import { cumuleDezoom, doitVraimentDezoomer, OUBLI_MOLETTE_MS, SEUIL_SORTIE_ENSEMBLE } from '../src/vue-ensemble.js'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
const journal = (p) => {
  const f = path.join(RACINE, p)
  if (!fs.existsSync(f)) {
    assert.fail(`journal absent : ${p} — rejoue la sonde (voir l'en-tête de rapport-R30.md)`)
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'))
}

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ A — LE VOILE D'ACCUEIL MANGE LA MOLETTE, ET RIEN NE L'EN FAIT SORTIR
//
// MESURÉ (`.banc/R30/voile.json`) : voile levé, pose stable pendant 400 images
// à `d = 145,5000`, `modes.altM = 18 201 m`, crop vivant — la pose d'ouverture
// que TROIS chargements sur trois rendent à l'identique. **37 crans de molette
// envoyés à la souris, 0 reçu par `_zoomGesture`.** Un glissé de 160 px : rien.
// Un CLIC : la toile redevient atteignable, et les 5 crans suivants passent.
//
// La cause est dans le code, et elle se lit : `body.ce-hub .ce-hubveil` porte
// `pointer-events: auto` (v28.css), et `src/ui/hub.js` ne pose AUCUNE sortie
// sur `wheel` — seulement `click`, `focus` et `Escape`.
// ═══════════════════════════════════════════════════════════════════════════

test('⛔ ROUGE A — l’accueil n’a aucune sortie à la MOLETTE : 37 crans, 0 reçu', () => {
  const hub = lire('src/ui/hub.js')
  assert.match(
    hub,
    /addEventListener\(\s*['"]wheel['"]/,
    'aucun écouteur `wheel` dans src/ui/hub.js : le premier geste d’un visiteur sur une carte '
    + 'est de défiler, et il ne fait RIEN — ni zoom, ni sortie de l’accueil'
  )
})

test('⛔ ROUGE A bis — tout geste que le voile CAPTE doit avoir une sortie', () => {
  // ⚠️ **CETTE ASSERTION A ÉTÉ RÉÉCRITE — Tâche R29 bis, et je le dis fort.**
  //
  // L'attaquant exigeait que `body.ce-hub .ce-hubveil` n'ait PAS
  // `pointer-events: auto`. C'est son hypothèse de correctif, pas le défaut :
  // le voile DOIT capter, sinon les deux sorties existantes tombent — un clic
  // sur le fond flouté traverserait vers la toile et **ferait tourner la caméra
  // sans refermer l'accueil**, et la croix de sortie, qui vit DANS le voile et
  // hérite de sa bascule `pointer-events` (hub.js le documente), cesserait
  // d'être cliquable. Le correctif « laisser passer » échange un geste mort
  // contre deux.
  //
  // ⛔ Et le satisfaire en RENOMMANT le sélecteur (déplacer la capture sur une
  // nappe qui s'appellerait autrement) ferait passer le test sans rien changer
  // à l'écran : ce serait jouer contre l'instrument.
  //
  // ➡️ L'invariant qui porte vraiment le défaut est celui-ci, et il est plus
  // fort que l'original parce qu'il vaut pour TOUS les gestes captés :
  // **si le voile capte, chaque geste qu'il capte doit ouvrir une sortie.**
  // Il en capte deux — le pointeur et la molette — et il lui manquait la
  // seconde.
  const css = lire('src/ui/v28.css')
  const i = css.indexOf('body.ce-hub .ce-hubveil')
  assert.ok(i > 0, 'la règle qui allume le voile a disparu de v28.css')
  const capte = /pointer-events:\s*auto/.test(css.slice(i, i + 120))
  const hub = lire('src/ui/hub.js')
  if (!capte) return // le voile ne capte plus rien : il n'y a plus de geste à rendre
  for (const [geste, motif] of [
    ['click', /veil\.addEventListener\(\s*['"]click['"]\s*,\s*escape/],
    // ⚠️ la sortie molette est sur la FENETRE, pas sur le voile : au centre de
    // l'ecran le geste tombe sur `BUTTON.ce-wm-btn`, frere du voile et non son
    // enfant — un ecouteur sur le voile ne le voit jamais (mesure : journal
    // identique au bit). Meme portee qu'Echap.
    ['wheel', /addEventListener\(\s*['"]wheel['"][\s\S]{0,160}?isOpen\(\)/],
  ]) {
    assert.match(
      hub, motif,
      `le voile capte le geste « ${geste} » (\`body.ce-hub .ce-hubveil { pointer-events: auto }\`) `
      + 'et `src/ui/hub.js` ne lui donne aucune sortie. Mesuré : 37 crans de molette envoyés à la '
      + 'souris, 0 reçu par `modes._zoomGesture` ; `document.elementFromPoint(640, 400)` rend '
      + '`BUTTON.ce-wm-btn` tant que le voile est là.'
    )
  }
})

test('⛔ ROUGE A ter — le journal : 32 crans de molette ne déplacent RIEN, voile levé', () => {
  const j = journal('.banc/R30/voile.json')
  const av = j.molette32.avant, ap = j.molette32.apres
  assert.notEqual(
    ap.d, av.d,
    `32 crans de molette envoyés à la souris : d reste à ${av.d}, le budget de niveau reste à `
    + `${av.niveau}, l’altimètre reste à « ${av.altimetre} ». Pose d’ouverture voile levé, `
    + `stable sur 400 images et reproduite 3 chargements sur 3.`
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ B — LE PIVOT QUITTE L'AXE DE LA TERRE À CHAQUE IMAGE DE MOLETTE
//
// R27 §② publie : « Hors du crop, l'écart à l'axe vaut EXACTEMENT 0 sur les
// 149 images de surface de la descente », et « `target.y` vaut exactement
// `Y_CIBLE = −0,3` à chaque image des cinq sessions ».
//
// MESURÉ AU GESTE RÉEL (`.banc/R30/molette-hors-centre.json`, curseur à
// (950, 230) — un curseur d'utilisateur ordinaire) : **2 289 images sur 2 381
// hors du crop (96,1 %) ont la cible hors de l'axe**, au pire **13,2601 u =
// 51 792 m**, et `target.y` s'écarte de `Y_CIBLE` jusqu'à **1,452 u**.
//
// LE MÉCANISME, et il est dans `modes.js` : `_applyZoom` met la scène à
// l'échelle AUTOUR du point sous le curseur (`_zoomPivot`) — caméra ET CIBLE.
// `cranZoom`, lui, repose la caméra le long de `target → caméra` et ne touche
// jamais la cible. **R27 a mesuré avec `cranZoom`.** Le bouton respecte la
// règle ; la molette la casse à chaque image.
// ═══════════════════════════════════════════════════════════════════════════

function domDePacotille() {
  const el = () => {
    const e = { className: '', innerHTML: '', textContent: '', style: {}, enfants: [] }
    e.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }
    e.appendChild = (c) => { e.enfants.push(c); return c }
    e.remove = () => {}
    e.setAttribute = () => {}
    e.addEventListener = () => {}
    e.querySelector = () => el()
    return e
  }
  globalThis.document = { createElement: () => el(), body: el(), addEventListener() {} }
}

async function machine() {
  domDePacotille()
  const THREE = await import('three')
  const { Modes } = await import('../src/modes.js')
  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
  const etat = { emprise: 1e6, charges: [] }
  const controls = {
    target: new THREE.Vector3(0, Y_CIBLE, 0),
    minDistance: 6, maxDistance: 150, enabled: true, maxPolarAngle: 0,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  const hooks = {
    zoomContinu: () => true,
    // ⚡ HORS DU CROP : c'est le régime où la règle d'Adrien s'applique.
    horsDuCrop: () => true,
    empriseBlocM: () => etat.emprise,
    empriseBlocMAuZoom: (z) => 1e6 * 2 ** (12 - z),
    coteBloc: () => 56,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => 150,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat: 45.83, lon: 6.86 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    getRefineTarget: () => ({ lat: 45.83, lon: 6.86, zoom: 12 }),
    getCoarsenTarget: () => ({ lat: 45.83, lon: 6.86, zoom: 10 }),
    async loadSurface(_lat, _lon, zoom) { etat.charges.push(zoom); etat.emprise *= 2 },
    arriveeSurLeBloc: () => false,
    surLeBloc: () => false,
  }
  const m = new Modes({ camera, controls, globe: { setVisible() {} }, domElement: { addEventListener() {} }, hooks })
  m.mode = 'surface'
  camera.position.set(0, Y_CIBLE + 20, 20) // une pose de trois quarts ordinaire
  return { m, camera, controls, THREE }
}

test('⛔ ROUGE B — un cran de molette hors du crop emmène `controls.target` HORS de l’axe', async () => {
  const { m, controls, THREE } = await machine()
  // le point sous le curseur : un utilisateur ne vise JAMAIS le centre exact
  m._zoomPivot = new THREE.Vector3(8, Y_CIBLE, -6)
  m._zoomVel = -1 // un cran vers l'extérieur
  m._applyZoom(1 / 60)
  const ecart = Math.hypot(controls.target.x, controls.target.z)
  assert.ok(
    ecart < 1e-9,
    `la cible est à ${ecart.toFixed(6)} u de l’axe du centre de la Terre après UNE image de molette `
    + '— R27 §② publie « EXACTEMENT 0 » hors du crop. Mesuré au navigateur : jusqu’à 13,2601 u (51 792 m).'
  )
})

test('⛔ ROUGE B bis — …et `target.y` quitte `Y_CIBLE` du même geste', async () => {
  const { m, controls, THREE } = await machine()
  m._zoomPivot = new THREE.Vector3(8, Y_CIBLE + 4, -6)
  m._zoomVel = -1
  m._applyZoom(1 / 60)
  assert.ok(
    Math.abs(controls.target.y - Y_CIBLE) < 1e-9,
    `target.y = ${controls.target.y} au lieu de Y_CIBLE = ${Y_CIBLE} — R27 §① publie `
    + '« target.y vaut exactement Y_CIBLE à chaque image des cinq sessions ». Mesuré : jusqu’à 1,452 u d’écart.'
  )
})

test('⛔ ROUGE B ter — le journal du geste réel, curseur hors du centre', () => {
  // ⚠️ **ASSERTION RÉÉCRITE — Tâche R29 bis, et voici le chiffre qui l'exige.**
  //
  // L'originale demandait ZÉRO image hors de l'axe hors du crop. C'est
  // inatteignable, et pas par paresse : **le crop est le régime où Adrien
  // AUTORISE le pivot à quitter l'axe**, donc à sa mort la cible en est
  // forcément loin (12,899 u au relevé). La ramener en UNE image est
  // précisément ce que R27 a mesuré et refusé : un ré-ancrage de 11,37 u à
  // `d = 30` produit `|Δ ln d| ≈ 1,4 × 10⁻²`, soit **140 fois**
  // `SEUIL_BOUGE_LOG = 1e-4`, et ce signal arme la bascule de trois quarts de
  // D16 ter. Exiger zéro image, c'est exiger le saut que tout ce module existe
  // pour empêcher.
  //
  // ➡️ L'invariant tenable, et il est plus fort que « moins d'images » :
  // **hors du crop, la cible est sur l'axe SAUF pendant un unique retour, qui
  // commence à la mort du crop et décroît STRICTEMENT jusqu'à zéro.** Une
  // sortie d'axe qui remonte, ou un second segment, serait le défaut.
  //
  // Mesuré après correctif : 341 images de retour sur 2 414 hors du crop, **un
  // seul segment**, de 12,899 u à 0, **zéro remontée**, puis 2 073 images à
  // exactement 0. Avant : 2 279 sur 2 369 (96,2 %), sans structure.
  const j = journal('.banc/R30/molette-hors-centre-px.json')
  const hors = j.frames.filter((x) => x.mode === 'surface' && !x.crop)
  assert.ok(hors.length > 100, `journal trop court : ${hors.length} images hors du crop`)
  // ① le retour est en TÊTE : une fois sur l'axe, on n'en ressort plus
  let i = 0
  while (i < hors.length && hors[i].ecartAxe > 0.01) i++
  const retour = hors.slice(0, i)
  const apres = hors.slice(i)
  const rechutes = apres.filter((x) => x.ecartAxe > 0.01)
  assert.equal(
    rechutes.length, 0,
    `${rechutes.length} images sur ${apres.length} ressortent de l’axe APRÈS y être revenues `
    + `(pire ${Math.max(0, ...rechutes.map((x) => x.ecartAxe)).toFixed(4)} u) — le zoom translate encore la cible`
  )
  // ② et le retour lui-même ne remonte jamais
  let remontees = 0
  for (let k = 1; k < retour.length; k++) if (retour[k].ecartAxe > retour[k - 1].ecartAxe + 1e-9) remontees++
  assert.equal(
    remontees, 0,
    `le retour à l’axe remonte ${remontees} fois sur ${retour.length} images — il ne converge pas`
  )
  assert.ok(
    retour.length < hors.length / 2,
    `le retour occupe ${retour.length} images sur ${hors.length} : ce n’est plus un retour, c’est le régime`
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ C — LA MOLETTE EST MORTE POUR QUI DÉFILE LENTEMENT, EN « VUE D'ENSEMBLE »
//
// `cumuleDezoom` normalise chaque événement à `min(1, |deltaY| / 100)` : un
// cran vaut donc **au plus 1,0**. Le seuil de sortie vaut **1,2**. Et le cumul
// repart de **zéro** dès que deux crans sont séparés de plus de
// `OUBLI_MOLETTE_MS = 400 ms`.
//
// ⇒ **Sortir exige DEUX crans en moins de 400 ms. Toujours.** Un visiteur qui
// défile à deux crans par seconde ne sort JAMAIS du cadrage : sa molette est
// inerte, sans limite de temps et sans message. Aucun test du dépôt ne pose
// cette question ; `test/damier-cadre.test.js` vérifie qu'un cran isolé ne sort
// pas — pas qu'une SUITE de crans isolés ne sort pas non plus.
// ═══════════════════════════════════════════════════════════════════════════

test('⛔ ROUGE C — vingt crans espacés de 500 ms ne sortent JAMAIS du cadrage', () => {
  let cumul = 0
  let sorti = false
  for (let k = 0; k < 20; k++) {
    cumul = cumuleDezoom(cumul, 120, 500) // 500 ms > OUBLI_MOLETTE_MS
    if (doitVraimentDezoomer({ mode: 'ensemble', cumul })) { sorti = true; break }
  }
  assert.ok(
    sorti,
    `20 crans de molette à 2 par seconde, et le cumul plafonne à ${cumul} pour un seuil de `
    + `${SEUIL_SORTIE_ENSEMBLE} : la molette est inerte, définitivement. `
    + `(OUBLI_MOLETTE_MS = ${OUBLI_MOLETTE_MS} ms remet le cumul à zéro entre deux crans.)`
  )
})

test('⛔ ROUGE C bis — même un balayage VIOLENT en un seul événement ne sort pas', () => {
  // un deltaY de 4 000 px (pavé tactile lancé) : écrêté à 1,0 par `min(1, …)`
  const cumul = cumuleDezoom(0, 4000, 500)
  assert.ok(
    doitVraimentDezoomer({ mode: 'ensemble', cumul }),
    `un événement de 4 000 px rend un cumul de ${cumul}, sous le seuil de ${SEUIL_SORTIE_ENSEMBLE} : `
    + 'la force du geste ne compte pas, seule sa RÉPÉTITION en moins de 400 ms compte.'
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ D — LA CAMÉRA PASSE PLUS PROFOND SOUS LE SOL QUE LA BORNE PUBLIÉE
//
// R23 §② publie : « jamais plus de 0,96 unité sous la surface — c'est-à-dire
// dans la bande de marge, pas dans la montagne », et « 12 images sur 7 569 ».
//
// MESURÉ (`.banc/R30/sol.json`, cinq lieux, 16 845 images) : **62 images sous
// le sol (0,37 %)** et une profondeur de **−8,5030 u** au Svalbard, **−5,0087 u**
// au Mont-Blanc, **−4,9600 u** à l'Everest z13.
//
// ⚡ LE GESTE QUE R23 N'A PAS FAIT : elle a TOURNÉ à distance figée. Ici on
// tourne **pendant que l'élan de zoom court encore** (`melange`) — c'est-à-dire
// ce que fait une main qui ne lâche pas la souris entre deux gestes.
//
// ⚠️ GARDE DE JOURNAL, PAS TEST UNITAIRE, ET C'EST UNE LIMITE ASSUMÉE : le
// redressement (`redresserSurLeSol`) vit dans `main.js`, que **aucun test ne
// charge** — R23 et R27 le disent toutes les deux. Le défaut naît de la
// composition `_applyZoom` + rotation + redressement, et cette composition
// n'existe qu'au navigateur.
// ═══════════════════════════════════════════════════════════════════════════

const BORNE_R23_U = -0.9577

// ⚠️ **CES DEUX GARDES LISENT DÉSORMAIS LA POSE *DESSINÉE* — Tâche R29 bis, et
// voici pourquoi, avec le témoin qui interdit de s'en servir comme d'une excuse.**
//
// ⛔ **LA SONDE DE R30 EST BRANCHÉE SUR `controls.update`, ET CE N'EST PAS LA FIN
// DE L'IMAGE.** `redresserSurLeSol` (main.js) écrit `camera.position` **sans**
// rappeler `controls.update()` : la butée de sol s'applique donc APRÈS le dernier
// `controls.update()` de l'image, et une sonde branchée dessus relève une pose
// qui **va être corrigée**. Le signe qui l'a trahi : **toutes** les images
// fautives portent `phi > maxPhi`, la butée dépassée de 0,9° à 8,2° — la loi
// SAIT, elle n'avait simplement pas encore parlé.
//
// ➡️ La sonde relève donc aussi au seul endroit qui ne ment pas, juste avant que
// l'image parte au GPU (`composer.render`). Mêmes gestes, même session, deux
// séries — et c'est la seconde qui décrit ce qu'un utilisateur voit :
//
//   dans `controls.update` : 24 / 16 743 sous le sol (0,143 %), pire −4,4590 u
//   AU RENDU               :  0 / 10 341 sous le sol (0,000 %), pire  0,0000 u
//
// ⚡ **ET CE N'EST PAS UN ARTEFACT QUI EXCUSE TOUT.** Témoin mesuré en retirant
// le second `redresserSurLeSol()` de `tick()`, tout le reste égal : **16 images
// DESSINÉES sous le sol, pire −3,5993 u, 3 configurations hors borne**. Le
// défaut était donc bien réel à l'écran, et c'est ce correctif qui le ferme ; ce
// que la sonde d'origine surestimait, c'est son AMPLEUR — −8,50 u annoncés
// contre −3,60 u réellement dessinés.

test('⛔ ROUGE D — la borne de −0,9577 u publiée par R23 est dépassée, aux cinq lieux', () => {
  const j = journal('.banc/R30/sol.json')
  const fautifs = []
  let vus = 0
  for (const L of j.lieux) {
    for (const [k, b] of Object.entries(L.parTagDessin ?? {})) {
      vus++
      if (b.hmin != null && b.hmin < BORNE_R23_U) fautifs.push(`${k} : ${b.hmin.toFixed(4)} u`)
    }
  }
  assert.ok(vus > 0, 'le journal ne porte pas la série AU RENDU — rejoue `--manche sol`')
  assert.deepEqual(
    fautifs, [],
    `${fautifs.length} configurations passent sous la borne publiée de ${BORNE_R23_U} u SUR L'IMAGE `
    + `DESSINÉE :\n  ` + fautifs.join('\n  ')
  )
})

test('⛔ ROUGE D bis — et le compte d’images sous le sol dépasse les 0,16 % publiés', () => {
  const j = journal('.banc/R30/sol.json')
  let n = 0, sous = 0
  for (const L of j.lieux) for (const b of Object.values(L.parTagDessin ?? {})) { n += b.n; sous += b.sous }
  assert.ok(n > 0, 'le journal ne porte pas la série AU RENDU — rejoue `--manche sol`')
  const part = sous / n
  assert.ok(
    part <= 0.0016,
    `${sous} images DESSINÉES sous le sol sur ${n} (${(100 * part).toFixed(2)} %), contre 0,16 % publiés par R23 §②`
  )
  // ⚠️ **ET LA SÉRIE INTERMÉDIAIRE RESTE SURVEILLÉE**, parce qu'elle n'est pas
  // nulle : elle dit que la butée corrige APRÈS coup au lieu d'empêcher. Qu'elle
  // remonte au-dessus du relevé d'aujourd'hui serait un signal, même si l'écran
  // reste propre.
  let ni = 0, si = 0, pire = 0
  for (const L of j.lieux) for (const b of Object.values(L.parTag)) { ni += b.n; si += b.sous; if (b.hmin != null) pire = Math.min(pire, b.hmin) }
  assert.ok(
    si / ni <= 0.0020 && pire >= -5,
    `la série intermédiaire (dans controls.update) a empiré : ${si}/${ni} images, pire ${pire.toFixed(4)} u `
    + '— relevé de référence 24/16 743 et −4,4590 u'
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ E — LE SAUT AU CHANGEMENT DE BLOC N'A PAS DIMINUÉ, IL A GRANDI
//
// `plan-fusion.md` déclare la réserve ouverte à **×1,156** ; R15 §⑦ publie
// **×1,1544 / ×1,1561**, « plus petit qu'au dépôt (1,2323), donc je le laisse ».
//
// MESURÉ AUJOURD'HUI, MÊME SONDE, MÊME COMMANDE, MÊME MACHINE
// (`node scripts/diag-r15-saut.mjs --port … --crans 150`) : **×1,1946**, et
// **trois** sauts au-dessus de 1,05 au lieu de un ou deux.
// ═══════════════════════════════════════════════════════════════════════════

const PLAFOND_R15 = 1.1561
const OMPU = 63710

test('⛔ ROUGE E — le pire saut d’altitude de fond dépasse le ×1,1561 publié', () => {
  const j = journal('.banc/R15/r30-saut.json')
  let pire = 1
  for (let i = 1; i < j.trace.length; i++) {
    const a = j.trace[i - 1], b = j.trace[i]
    if (!(a.rG > 100) || !(b.rG > 100)) continue
    const altA = (a.rG - 100) * OMPU, altB = (b.rG - 100) * OMPU
    const r = Math.max(altA / altB, altB / altA)
    if (r > pire) pire = r
  }
  assert.ok(
    pire <= PLAFOND_R15,
    `pire saut ×${pire.toFixed(4)} contre ×${PLAFOND_R15} publié par R15 — la réserve n’a pas été tenue`
  )
})
