// LES NUAGES DANS L'ESPACE DU GLOBE — Tâche R20.
//
// **Adrien :** « On a plein de choses qui ne fonctionnent pas encore en mode
// sphère. » Les nuages en font partie : à 18 km d'altitude — le défaut de
// l'application — il n'y en avait AUCUN, ni le volume ni la coquille.
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LE REPÈRE — la similitude ancrée sur l'ORIGINE du bloc rend le repère du
//      crop. Mêmes six nombres que `cartouche-globe.test.js` : c'est LA MÊME
//      similitude, et ce test le prouve au lieu de le supposer.
//   ② L'ÉCHELLE — une seule homothétie porte TOUTES les longueurs du ciel.
//      C'est ce qui empêche « la couche de nuages à 860 km ».
//   ③ LES MÈTRES — les deux hauteurs, et leur quotient qui vaut l'exagération.
//      C'est le paragraphe faux d'un facteur deux que la relecture a rattrapé.
//   ④ LA CAMÉRA — la seule grandeur qui traverse dans l'autre sens, et LE SENS
//      DE SA DIVISION.
//   ⑤ LE CÂBLAGE de `main.js` et de `clouds2.js`, LU (aucun test de ce dépôt ne
//      charge `main.js`).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  ancrageNuages,
  altitudeNuageM,
  hauteurNuageEnGlobe,
  hauteurGlobeEnM,
  positionCameraEnBloc,
} from '../src/monde/nuages-globe.js'
import { ancrageCartouche } from '../src/monde/cartouche-globe.js'
import { visibiliteSurface } from '../src/monde/visibilite-surface.js'
import { R_GLOBE, ORBITAL_M_PER_UNIT } from '../src/geo.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const CLOUDS = readFileSync(new URL('../src/clouds2.js', import.meta.url), 'utf8')

// Le relevé du navigateur, La Réunion, mode sphère par défaut (`?` sans
// paramètre), z12, exagération 2 — `.banc/R20/releve.json` et
// `.banc/R20/diag-deux-systemes.json`, 2026-08-31.
const RELEVE = {
  lat: -21.248422235627014,
  lon: 55.7666015625,
  extentMeters: 27354.269019739164,
  span: 56,
  // `globe._parois` — les parois du crop, DÉJÀ POSÉES par le globe
  position: [77.05483557224011, -36.24123732749129, 52.43209925138887],
  quaternion: [0.7295304024548144, 0.2640562864582355, -0.3859942726668014, 0.4990672208675199],
  k: 0.007667070940797353,
  // le curseur « Altitude » au démarrage, et la boîte la plus haute du ciel
  ceilReglage: 13.5,
  topBloc: 14.7948,
  exageration: 2,
  // `camGlobe.position.length()` en vue de surface (`.banc/R20/verif`)
  camGlobeDist: 100.58,
}

const proche = (a, b, eps, quoi) =>
  assert.ok(Math.abs(a - b) <= eps, `${quoi} : ${a} au lieu de ${b} (écart ${Math.abs(a - b)})`)

// ═══════════════════════════════════════════════════════════════ ① le repère

test('① l’ancrage du ciel rend EXACTEMENT le repère du crop déjà posé', () => {
  const a = ancrageNuages(RELEVE)
  for (let i = 0; i < 3; i++) proche(a.position[i], RELEVE.position[i], 1e-9, `position[${i}]`)
  for (let i = 0; i < 4; i++) proche(a.quaternion[i], RELEVE.quaternion[i], 1e-12, `quaternion[${i}]`)
})

test('① c’est LA MÊME similitude que le cartouche — pas une seconde loi', () => {
  // ⛔ La dette de ce dépôt vient de systèmes parallèles jamais fusionnés. Si
  // un jour ces deux ancrages divergent, c’est qu’on en a écrit un troisième.
  const n = ancrageNuages(RELEVE)
  const c = ancrageCartouche(RELEVE)
  assert.deepEqual(n.position, c.position, 'les deux ancrages ne posent plus au même endroit')
  assert.deepEqual(n.quaternion, c.quaternion, 'les deux ancrages ne tournent plus pareil')
  assert.equal(n.echelle, c.echelle, 'les deux ancrages n’ont plus la même échelle')
})

test('① l’origine du bloc se pose SUR la sphère, pas dedans ni dessus', () => {
  const a = ancrageNuages(RELEVE)
  proche(Math.hypot(...a.position), R_GLOBE, 1e-9, 'rayon de l’ancre')
})

// ═══════════════════════════════════════════════════════════════ ② l’échelle

test('② ⛔ LA COUCHE À 860 km — l’échelle NE PEUT PAS être 1', () => {
  const a = ancrageNuages(RELEVE)
  proche(a.echelle, RELEVE.k, 1e-15, 'k')
  proche(1 / a.echelle, 130.42790496157883, 1e-9, '1/k')
  // la valeur de bloc portée TELLE QUELLE en unités de globe : de l’orbite
  const brut = hauteurGlobeEnM(RELEVE.ceilReglage)
  proche(brut, 860085, 1, 'plafond SANS k, en mètres')
  assert.ok(brut > 800000, 'le défaut ne se voit plus : la mesure a changé de sens')
  // la même valeur passée par l’homothétie : un plafond de cumulus
  const juste = hauteurGlobeEnM(hauteurNuageEnGlobe(RELEVE.ceilReglage, a.echelle))
  proche(juste, 6594.3, 0.1, 'plafond AVEC k, en mètres de carte')
  assert.ok(juste < 15000, 'le plafond de nuages est sorti de l’atmosphère')
})

test('② la boîte la plus HAUTE du ciel reste dans l’atmosphère', () => {
  const a = ancrageNuages(RELEVE)
  const h = hauteurGlobeEnM(hauteurNuageEnGlobe(RELEVE.topBloc, a.echelle))
  proche(h, 7226.8, 0.1, 'sommet du ciel, en mètres de carte')
  // sans `k` elle serait à 942 577 m, deux fois et demie l’altitude de la
  // station spatiale — et le ciel quitterait l’écran par le haut
  proche(hauteurGlobeEnM(RELEVE.topBloc), 942577, 1, 'sommet SANS k')
})

test('② UNE seule homothétie porte toutes les longueurs — donc elle est linéaire', () => {
  const a = ancrageNuages(RELEVE)
  proche(hauteurNuageEnGlobe(2 * RELEVE.ceilReglage, a.echelle),
    2 * hauteurNuageEnGlobe(RELEVE.ceilReglage, a.echelle), 1e-15, 'linéarité')
  assert.equal(hauteurNuageEnGlobe(0, a.echelle), 0, 'le zéro du bloc n’est plus le zéro du ciel')
})

test('② l’échelle suit l’emprise — dézoomer AGRANDIT l’unité de bloc', () => {
  const large = ancrageNuages({ ...RELEVE, extentMeters: RELEVE.extentMeters * 4 })
  proche(large.echelle, RELEVE.k * 4, 1e-15, 'k à emprise quadruplée')
})

// ═══════════════════════════════════════════════════════════════ ③ les mètres

test('③ ⛔ LE PARAGRAPHE FAUX D’UN FACTEUR DEUX — les deux valeurs, exécutées', () => {
  // L’en-tête annonçait « 6 595 m quand on croit l’exagération, 13 190 si on
  // l’oublie ». Le rapport était bon, les DEUX valeurs étaient doublées.
  const commun = { hauteurBloc: RELEVE.ceilReglage, extentMeters: RELEVE.extentMeters, span: RELEVE.span }
  proche(altitudeNuageM({ ...commun, exageration: 2 }), 3297.2, 0.1, 'altitude réelle, exagération 2')
  proche(altitudeNuageM({ ...commun, exageration: 1 }), 6594.3, 0.1, 'altitude réelle, exagération 1')
})

test('③ le quotient des deux hauteurs vaut EXACTEMENT l’exagération', () => {
  // C’est ce qui rend la §3 vérifiable : la carte est exagérée, le monde non,
  // et le seul nombre qui les sépare est l’exagération. Ni 1, ni `k`.
  const a = ancrageNuages(RELEVE)
  for (const ex of [1, 1.5, 2, 3]) {
    const carte = hauteurGlobeEnM(hauteurNuageEnGlobe(RELEVE.ceilReglage, a.echelle))
    const reel = altitudeNuageM({
      hauteurBloc: RELEVE.ceilReglage, extentMeters: RELEVE.extentMeters, span: RELEVE.span, exageration: ex,
    })
    proche(carte / reel, ex, 1e-9, `quotient à exagération ${ex}`)
  }
})

test('③ des entrées absurdes rendent zéro, pas NaN', () => {
  const commun = { hauteurBloc: 13.5, extentMeters: RELEVE.extentMeters, span: 56, exageration: 2 }
  assert.equal(altitudeNuageM({ ...commun, extentMeters: 0 }), 0)
  assert.equal(altitudeNuageM({ ...commun, span: 0 }), 0)
  assert.equal(altitudeNuageM({ ...commun, exageration: 0 }), 0)
})

// ═══════════════════════════════════════════════════════════════ ④ la caméra

test('④ ⛔ LE SENS DE LA DIVISION — multiplier met la caméra DANS le nuage', () => {
  const a = ancrageNuages(RELEVE)
  // la caméra du relevé : sur la verticale de l’ancre, à 100,58 unités de globe
  const r = Math.hypot(...a.position)
  const cam = a.position.map((v) => (v / r) * RELEVE.camGlobeDist)
  const bloc = positionCameraEnBloc(cam, a)
  // au-dessus de l’origine du bloc, donc x et z quasi nuls
  proche(bloc[0], 0, 1e-9, 'x en unités de bloc')
  proche(bloc[2], 0, 1e-9, 'z en unités de bloc')
  // ⚡ ET LE NOMBRE SE RECOUPE PAR UN AUTRE CHEMIN : la caméra du bloc PLAT est
  // relevée à `y = 72,72` en vue posée sur le crop (`visibilite-surface.js`
  // §3). 75,6 en est à 4 %. Multiplier au lieu de diviser rendrait 0,0059.
  proche(bloc[1], 75.6482, 1e-3, 'y en unités de bloc')
  assert.ok(bloc[1] > 20, 'la caméra est tombée DANS le ciel : la division est à l’envers')
  const aEnvers = { ...a, echelle: 1 / a.echelle }
  assert.ok(positionCameraEnBloc(cam, aEnvers)[1] < 0.01,
    'la mutation « échelle inversée » ne tue pas : le test ne garde rien')
})

test('④ la caméra passe par l’ANCRE — la translation compte autant que l’échelle', () => {
  const a = ancrageNuages(RELEVE)
  // la caméra POSÉE sur l’ancre est à l’origine du bloc, exactement
  const bloc = positionCameraEnBloc(a.position, a)
  for (let i = 0; i < 3; i++) proche(bloc[i], 0, 1e-6, `origine[${i}]`)
})

test('④ sans ancre valable, la position revient telle quelle — pas NaN', () => {
  const p = positionCameraEnBloc([1, 2, 3], { position: [0, 0, 0], quaternion: [0, 0, 0, 1], echelle: 0 })
  assert.deepEqual(p, [1, 2, 3])
  assert.deepEqual(positionCameraEnBloc([1, 2, 3], null), [1, 2, 3])
})

test('④ un aller-retour par le repère du bloc est l’identité', () => {
  const a = ancrageNuages(RELEVE)
  // la hauteur du plafond, portée en globe puis relue en bloc par la caméra
  const haut = hauteurNuageEnGlobe(RELEVE.ceilReglage, a.echelle)
  const enGlobe = [
    a.position[0] + haut * (a.position[0] / R_GLOBE),
    a.position[1] + haut * (a.position[1] / R_GLOBE),
    a.position[2] + haut * (a.position[2] / R_GLOBE),
  ]
  proche(positionCameraEnBloc(enGlobe, a)[1], RELEVE.ceilReglage, 1e-6, 'aller-retour du plafond')
})

// ═══════════════════════════════════════════════ ⑤ la visibilité et le câblage

test('⑤ `visibiliteSurface` rend un verdict `nuages`, et il n’est PAS borné', () => {
  // ⛔ C’est le défaut : `clouds.setVisible(vue.socle)`, et `socle` est borné à
  // faux sous le drapeau. Les nuages répondent à la question des BOUTONS.
  const sousDrapeau = visibiliteSurface({ terreUnique: true, surface: true })
  assert.equal(sousDrapeau.socle, false, 'le maillage plat doit rester éteint')
  assert.equal(sousDrapeau.nuages, true, 'les nuages sont encore accrochés au maillage du bloc plat')
  assert.equal(visibiliteSurface({ terreUnique: true, surface: false }).nuages, false,
    'les nuages resteraient allumés en orbite : on les paierait pour rien')
  assert.equal(visibiliteSurface({ terreUnique: false, surface: true }).nuages, true,
    'hors drapeau le comportement du dépôt doit être inchangé')
})

test('⑤ `main.js` n’accroche PLUS les nuages au maillage du bloc plat', () => {
  assert.ok(!/clouds\.setVisible\(vue\.socle\)/.test(MAIN),
    'clouds.setVisible(vue.socle) est encore là : les nuages sont éteints sous le drapeau')
  assert.ok(/clouds\.setVisible\(vue\.nuages\)/.test(MAIN),
    'les nuages ne lisent pas le verdict `nuages`')
})

test('⑤ le ciel est ADOPTÉ par la scène du globe — sinon rien n’est dessiné', () => {
  // ⛔ Mesuré : forcé visible dans la scène du bloc, l’écart à l’écran vaut
  // 0,000 / 0,000. Le drapeau ne suffit pas ; il faut un PARENT.
  assert.ok(/sceneGlobe\.add\(groupeNuages\)/.test(MAIN),
    'la scène du globe n’adopte pas le groupe du ciel')
  assert.ok(/new Clouds2\(groupeNuages,/.test(MAIN),
    'Clouds2 pend encore de `scene` : il dessine dans un tampon que personne ne regarde')
})

test('⑤ l’ancrage du ciel se REPOSE à chaque image, par la loi et pas à la main', () => {
  const corps = MAIN.slice(MAIN.indexOf('function majNuagesGlobe'))
  assert.ok(corps.length > 0, 'majNuagesGlobe n’existe pas')
  const bloc = corps.slice(0, 2600)
  assert.ok(/ancrageNuages\(\{/.test(bloc), 'la loi n’est pas appelée : le repère est refait à la main')
  assert.ok(/groupeNuages\.scale\.setScalar\(/.test(bloc),
    'l’échelle n’est pas posée : la couche de nuages serait à 860 km')
  assert.ok(/positionCameraEnBloc\(/.test(bloc),
    'la caméra ne traverse pas la frontière : le rayon partirait du mauvais espace')
  assert.ok(/if \(!fusionDesPasses\) return/.test(bloc),
    'hors mode sphère la fonction doit rendre la main tout de suite')
})

test('⑤ le nuanceur marche en unités de BLOC, pas en unités de monde', () => {
  // ⚠️ Toutes ses constantes sont en unités de bloc (`world / 0.42`,
  // `near * 3.0`, `smoothstep(1.5, 4.0, …)`, `uMapMin` / `uMapSize`). Les
  // laisser lire un espace 130 fois plus petit les rendrait toutes fausses
  // d’un coup, sans erreur ni message.
  assert.ok(!/vec3 ro = cameraPosition;/.test(CLOUDS),
    'la marche part encore de `cameraPosition` : c’est l’espace MONDE, pas celui du ciel')
  assert.ok(/uniform vec3 uCamBloc;/.test(CLOUDS), 'le nuanceur n’a pas de caméra en unités de bloc')
  assert.ok(/vec3 ro = uCamBloc;/.test(CLOUDS), 'la marche ne part pas de la caméra en unités de bloc')
  assert.ok(/vLocalPos/.test(CLOUDS), 'la position interpolée est restée en unités de monde')
  assert.ok(!/\bvWorldPos\b/.test(CLOUDS),
    'il reste une position de MONDE dans le nuanceur : deux espaces cohabitent')
})

test('⑤ hors mode sphère, la caméra de bloc est servie TELLE QUELLE', () => {
  // ⚠️ Neutralité au bit près : sans frontière de rendu, `uCamBloc` doit valoir
  // exactement `camera.position`, sans quoi le mode plat change de rendu.
  const corps = CLOUDS.slice(CLOUDS.indexOf('update(dt, params, camera'))
  assert.ok(/uCamBloc\.value\.set\(/.test(corps.slice(0, 4000)),
    '`update` ne pose pas `uCamBloc` : il resterait figé à sa valeur de départ')
  assert.ok(/camBloc \?\? camera\?\.position/.test(corps.slice(0, 4000)),
    'sans `camBloc`, `update` ne retombe pas sur `camera.position` : le mode plat change de rendu')
  // ⚠️ le TRI arrière→avant doit lire le MÊME espace, sinon il devient muet et
  // deux nuages transparents laissent une couture
  assert.ok(/_writeInstances\(cam\)/.test(corps.slice(0, 4000)),
    'le tri des instances lit encore la caméra de MONDE : deux espaces mélangés')
})

// ═══════════════════════════ ⑥ LE CIEL PAR DÉFAUT — arbitrage du 2026-09-01
//
// **Le ciel par défaut doit se voir.** Un système allumé, correctement peuplé
// et invisible à l'écran, c'est un réglage qui ne fait rien sous une autre
// forme — et c'est précisément ce dont Adrien vient de faire relever les 127
// options une par une.

import { cloudCountForTier, CLOUD_COUNT_MAX, CLOUD_HARD_MAX } from '../src/clouds-sim.js'

const DEPART = JSON.parse(
  readFileSync(new URL('../public/templates/defaults/shibustart.json', import.meta.url), 'utf8')
)

test('⑥ ⛔ LE DÉFAUT N’EST PAS DANS `main.js` — c’est `shibustart.json`', () => {
  // ⛔ Le littéral `params` de `main.js` pose `cloudsEnabled: false`,
  // `cloudAltitude: 1`, `cloudOpacity: 2.25` — et l’application démarre avec
  // `true`, `13,5`, `0,6`. **Mesuré au navigateur, profil vierge, aucun
  // `localStorage`.** Le gabarit d’ouverture écrase le littéral : régler le
  // littéral n’aurait RIEN changé à l’écran. Ce test garde le chemin réel.
  assert.ok(/import SHIBU_START from '.*shibustart\.json'/.test(MAIN),
    'main.js n’importe plus le gabarit d’ouverture : le défaut a changé de source')
  assert.equal(DEPART.look.cloudsEnabled, true, 'le ciel d’ouverture est éteint')
})

test('⑥ le ciel d’ouverture porte les trois valeurs de l’arbitrage', () => {
  // ⚠️ **CE SONT LES DEUX LEVIERS QUE LA MESURE ACCUSE**, et rien d’autre :
  //   · l’opacité — le ciel était transparent (0,6) ;
  //   · l’étalement — à 0,97 la colonne peuplée descend jusqu’au sol, donc la
  //     moitié du ciel était ENTERRÉE dans le relief (le sommet de La Réunion
  //     monte à 8,87 unités de bloc, le plafond est à 13,5).
  //   · les trouées — 0,80 est le bout « masses pleines » de la tirette.
  assert.equal(DEPART.look.cloudOpacity, 1.4)
  assert.equal(DEPART.look.cloudAltSpread, 0.45)
  assert.equal(DEPART.look.cloudCoverage, 0.8)
  // ⛔ LA MUTATION QUI REMET L’ANCIEN CIEL DOIT TUER
  assert.notEqual(DEPART.look.cloudOpacity, 0.6, 'l’opacité d’avant est revenue')
  assert.notEqual(DEPART.look.cloudAltSpread, 0.97, 'l’étalement d’avant est revenu')
})

test('⑥ le ciel CHEVAUCHE les sommets — ni enterré, ni détaché', () => {
  // La base de la colonne peuplée vaut `plafond × (1 − étalement)`
  // (`clouds2.js`, `build`). Le relief de La Réunion monte à **8,875** unités
  // de bloc (relevé du 2026-08-31 : `uTerrainMin` −10,447 + `uTerrainRange`
  // 19,322), et le niveau de la mer y est à **−1,80**.
  //
  // ⛔ **UNE PREMIÈRE VERSION DE CE TEST EXIGEAIT QUE TOUT LE CIEL PASSE
  // AU-DESSUS DU SOMMET. Elle était rouge, et elle avait tort.** Le réglage
  // retenu met la base à 7,425 — SOUS le sommet, délibérément : le dépôt écrit
  // en toutes lettres « clouds — thick and low, clinging to the summits », et
  // un pont de nuages entièrement au-dessus du point culminant se lit comme un
  // décor décollé. ⚡ Ce que la mesure reprochait à l'ancien réglage n'était pas
  // le contact avec le relief, c'était que la base tombait à **0,405** — sous
  // le niveau de la mer, donc la moitié du ciel enterrée.
  const base = (spr) => DEPART.look.cloudAltitude * (1 - spr)
  const SOMMET = 8.875
  const MER = -1.8
  assert.ok(base(0.97) < MER + 2.5,
    'le témoin est faux : l’ancien étalement devait poser la base au ras de la mer')
  const b = base(DEPART.look.cloudAltSpread)
  assert.ok(b > MER + 5, `la base du ciel (${b}) est encore au ras de l’eau`)
  assert.ok(b < SOMMET, `la base du ciel (${b}) passe au-dessus des sommets : ciel décollé`)
  assert.ok(DEPART.look.cloudAltitude > SOMMET,
    'le plafond est passé sous les sommets : le ciel serait entièrement dans le relief')
  // et la colonne peuplée reste une VRAIE colonne, pas un plan
  assert.ok(DEPART.look.cloudAltitude - b > 4, 'la couche est devenue une galette')
})

test('⑥ SEUL le palier 0 monte — les trois autres ne paient pas ce choix', () => {
  // ⚠️ Le coût est un coût de FRAGMENT : le ciel passe de ×1,57 à ×2,04 du
  // temps GPU de la scène (minuterie du pilote, mesure appariée). Une machine
  // déjà délestée ne doit pas le payer.
  const d = 0.65 + DEPART.look.cloudOpacity * 0.18 // le facteur de densité
  assert.equal(cloudCountForTier(0, d), 6, 'le palier 0 ne rend plus 6 grappes')
  assert.equal(cloudCountForTier(1, d), 3, 'le palier 1 a bougé : il ne devait pas')
  assert.equal(cloudCountForTier(2, d), 2, 'le palier 2 a bougé : il ne devait pas')
  assert.equal(cloudCountForTier(3, d), 2, 'le palier 3 a bougé : il ne devait pas')
})

test('⑥ le peuplement reste MONOTONE et sous le plafond dur', () => {
  const d = 0.65 + DEPART.look.cloudOpacity * 0.18
  const l = [0, 1, 2, 3].map((t) => cloudCountForTier(t, d))
  for (let i = 1; i < l.length; i++) assert.ok(l[i] <= l[i - 1], `palier ${i} dépasse ${i - 1}`)
  assert.ok(l[0] <= CLOUD_COUNT_MAX, 'le palier 0 dépasse son propre plafond')
  // ⛔ 6 grappes pleines = 42 entités > CLOUD_HARD_MAX. Le plafond dur DOIT
  // rester en travers : c’est lui qui empêche les recouvrements de 48 boîtes
  // que ce fichier chiffre à 3 fps. Mesuré : 6 grappes rendent 19 à 34 entités.
  assert.ok(l[0] * 7 > CLOUD_HARD_MAX,
    'le témoin est faux : à ce compte, le plafond dur ne mord plus jamais')
  assert.equal(CLOUD_HARD_MAX, 34, 'le plafond dur a bougé sans mesure')
})

test('⑥ la tirette de densité MODULE encore le peuplement au palier 0', () => {
  // ⚠️ Un palier 0 qui rendrait 6 quoi qu’il arrive ferait un DIX-SEPTIÈME
  // curseur mort. Aux deux bouts de la tirette, le compte doit différer.
  const bas = cloudCountForTier(0, 0.65 + 0.05 * 0.18)
  const haut = cloudCountForTier(0, 0.65 + 2.5 * 0.18)
  assert.ok(bas < haut, `la densité ne module plus rien au palier 0 (${bas} = ${haut})`)
})

// ═══════════════ ⑦ LA COLONNE AU-DESSUS DE LA MER — la classe « unités », 9ᵉ
//
// ⛔ **UNE ALTITUDE EN UNITÉS DE BLOC N'EST PAS LA MÊME ALTITUDE PARTOUT.** Le
// bloc normalise sa verticale sur l'amplitude LOCALE du relief, donc la surface
// de l'eau ne tombe pas au même endroit selon le lieu. Relevé au navigateur,
// même réglage, trois lieux (`.banc/R20/preuve/`, uniforme `uWaterY`).

const CLOUDS2 = readFileSync(new URL('../src/clouds2.js', import.meta.url), 'utf8')

// niveau de la mer, en unités de BLOC, mesuré le 2026-09-01
const MER = { reunion: -1.8007, alpes: -6.9056, pacifique: 13.0489 }

// la loi telle que `clouds2.build` l'écrit
const colonne = (ceil, spread, eau) => {
  const baseVoulue = ceil * (1 - spread)
  const epaisseur = Math.max(ceil - baseVoulue, 1e-3)
  const baseY = Number.isFinite(eau) ? Math.max(baseVoulue, eau + 0.5) : baseVoulue
  return { baseY, topY: baseY + epaisseur, epaisseur }
}

test('⑦ ⛔ AU LARGE, LA COLONNE DEMANDÉE EST SOUS L’EAU', () => {
  // C'est le défaut : au Pacifique le fond est de la bathymétrie pure
  // (amplitude 3,9 unités contre 19,3 à La Réunion) et le zéro marin remonte à
  // +13,05 — au-dessus du plafond de nuages, qui est à 13,5.
  const ceil = DEPART.look.cloudAltitude
  const spread = DEPART.look.cloudAltSpread
  assert.ok(ceil * (1 - spread) < MER.pacifique,
    'le témoin est faux : la colonne demandée devait plonger sous la mer au large')
  assert.ok(ceil * (1 - spread) > MER.reunion,
    'le témoin est faux : à La Réunion la colonne était déjà au-dessus de l’eau')
})

test('⑦ le plancher marin est NEUTRE là où la mer est déjà dessous', () => {
  // ⚡ C'est ce qui rend le geste sûr : partout où il y a du relief émergé, la
  // colonne ne bouge pas d'un flottant. Mesuré à l'écran : La Réunion 12 881
  // pixels avant le plancher, 12 881 après ; les Alpes 12 871 puis 12 860.
  const ceil = DEPART.look.cloudAltitude
  const spread = DEPART.look.cloudAltSpread
  const nu = colonne(ceil, spread, undefined)
  for (const lieu of ['reunion', 'alpes']) {
    const c = colonne(ceil, spread, MER[lieu])
    assert.equal(c.baseY, nu.baseY, `${lieu} : la base a bougé, le geste n'est plus neutre`)
    assert.equal(c.topY, nu.topY, `${lieu} : le plafond a bougé, le geste n'est plus neutre`)
  }
})

test('⑦ au large, la colonne remonte EN BLOC et garde son épaisseur', () => {
  const ceil = DEPART.look.cloudAltitude
  const spread = DEPART.look.cloudAltSpread
  const nu = colonne(ceil, spread, undefined)
  const c = colonne(ceil, spread, MER.pacifique)
  assert.ok(c.baseY > MER.pacifique, 'la base est encore sous la mer')
  // ⚠️ **L'ÉPAISSEUR EST LA GRANDEUR QUI DOIT SURVIVRE.** Relever la base sans
  // relever le plafond écraserait la colonne en galette — et une grappe
  // entièrement plate se lit comme une flaque.
  assert.ok(Math.abs(c.epaisseur - nu.epaisseur) < 1e-9,
    `l'épaisseur a changé : ${c.epaisseur} au lieu de ${nu.epaisseur}`)
  assert.ok(c.epaisseur > 4, 'la couche est devenue une galette')
})

test('⑦ le plancher lit le niveau de la mer du TERRAIN, pas une constante', () => {
  // ⛔ Une constante marcherait à La Réunion et serait fausse au large : c'est
  // exactement le défaut qu'on répare. Le niveau vient de `uSeaY`, relu à
  // chaque construction.
  assert.ok(CLOUDS2.includes('const eau = this.terrain?.mapUniforms?.uSeaY?.value'),
    'le niveau de la mer n’est plus lu sur le terrain')
  assert.ok(CLOUDS2.includes('Math.max(baseVoulue, eau + 0.5)'),
    'le plancher marin a disparu de build()')
  assert.ok(CLOUDS2.includes('const topY = baseY + epaisseur'),
    'le plafond ne suit plus la base : la colonne peut s’écraser en galette')
})

test('⑦ sans terrain, la loi rend la colonne d’avant — pas NaN', () => {
  const nu = colonne(13.5, 0.45, undefined)
  assert.equal(nu.baseY, 13.5 * 0.55)
  assert.equal(nu.topY, 13.5)
  const nul = colonne(13.5, 0.45, NaN)
  assert.equal(nul.baseY, 13.5 * 0.55, 'un niveau de mer non fini doit être ignoré')
})
