// LE TRACÉ GPX DOIT ÊTRE DESSINÉ — la garde de la Tâche GX1.
//
// ⛔ **CES TESTS SONT ROUGES AU MOMENT OÙ ILS SONT ÉCRITS, ET C'EST LEUR
// RAISON D'ÊTRE.** Ils décrivent le défaut mesuré au navigateur le 2026-09-04
// (banc `scripts/banc-gx1-position.mjs`, relevés dans `.banc/GX1/`) :
//
// > **Au régime de production (mode sphère), le calque GPX pose ZÉRO pixel à
// > l'écran** — 6 relevés sur 6, témoin de bruit A/A à 0 pixel, là où la
// > géométrie du ruban en prédit **2 019** (1 324 px de tracé à l'écran ×
// > 1,52 px de large). Sous `?terre=deux`, le même tracé au même cadrage en
// > pose **1 053**. Le tracé n'est pas mal placé : **il n'est pas dessiné**.
//
// ══════════ LA CAUSE, ET ELLE EST ÉCRITE DANS `main.js` LUI-MÊME ═══════════
//
// La Tâche D16-a a supprimé la passe de surface sous `terre unique` :
//
//     const fusionDesPasses = frontiereActive && terreUniqueBranchee
//     if (fusionDesPasses) { passeSurface.enabled = false ... }
//
// **La scène du bloc plat n'est donc plus rendue du tout.** Chaque calque qui
// devait survivre a été DÉMÉNAGÉ, un par un, dans `sceneGlobe` :
// `sunDisc.sprite` (D16-a), `groupeCartouche` (D16-c), `groupeNuages` (R20),
// `groupeCotes` (R24), et la cartographie par `mapLayers.poserScene` (D16-b).
// Le commentaire de D16-b décrit mot pour mot ce qui arrive aujourd'hui au
// tracé : *« Ils n'étaient pas cachés : ils étaient dessinés dans un tampon que
// plus personne ne regarde. »*
//
// **Le calque GPX a été oublié dans ce déménagement.** `src/gpx.js` fait
// toujours `scene.add(this.group)` dans son constructeur — la scène éteinte.
//
// Preuve directe, une image du régime de production, chaque appel à
// `renderer.render` identifié par l'uuid de sa scène
// (`scripts/diag-gx1-scene.mjs`, `.banc/GX1/scene.json`) :
//
//   | # | scène | caméra | vers |
//   |---|---|---|---|
//   | ① | `sceneGlobe` (uuid 0d759b58, 7 objets) | perspective, near 0,168 far 201,9 | cible |
//   | ②③④ | passes plein écran du compositeur | orthographique | ④ → ÉCRAN |
//
// `__exp.scene` — uuid **8685cd6b**, 10 objets, **parent du groupe `gpx`** —
// n'apparaît dans **aucune** des quatre passes.
//
// ══════════ ⚠️ CE QU'UN CORRECTIF NE DOIT PAS FAIRE ════════════════════════
//
// ⛔ **`sceneGlobe.add(couche.group)` TOUT SEUL NE SUFFIT PAS, ET SE VOIT.**
// Le ruban est cuit en coordonnées de BLOC (`latLonToWorld`, demi-emprise 28
// unités autour de l'origine) ; le crop, lui, est une découpe de la sphère de
// rayon `R_GLOBE = 100` posée à ~100 unités de l'origine. Les deux espaces
// n'ont pas la même échelle : au cadrage du banc, **727,6 m par unité de bloc
// contre 63 710,1 m par unité de globe — un facteur 87,56**. Reparenter sans
// poser la similitude mettrait le tracé à des milliers de kilomètres du crop.
// C'est pour ça que `mapLayers` reçoit AUSSI un fabricant de poseur
// (`poseurPourReconstruction`, `monde/sol-globe.js`) et la caméra du globe.
//
// ══════════ CE QUI N'EST **PAS** EN CAUSE — mesuré, pas supposé ════════════
//
//   · la conversion lat/lon → monde : **aller-retour de 0,00 m** (moyenne et
//     max, 60 points) ;
//   · l'échelle et la forme : **déformation 0,01 % en moyenne, 0,13 % au max**
//     sur 40 paires de points comparées à la géodésique ;
//   · le drapage : **−4,7 m en moyenne** (min −68,2, max +52,2) au Mont-Blanc,
//     **+2,6 m** (−1,2 / +3,6) sur un tracé plat de Camargue ;
//   · la lecture elle-même : `headT` avance bien de 0 à 1, la barre de course
//     répond, le suivi caméra s'engage. **Rien de tout cela n'est cassé.**

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const GPX = readFileSync(new URL('../src/gpx.js', import.meta.url), 'utf8')

// ─────────────────────────────────────────────── ① le déménagement de la scène

test('① le calque GPX est ADOPTÉ par la scène du globe quand la passe de surface est éteinte', () => {
  // La ligne qui éteint la passe existe toujours : c'est elle qui rend ce test
  // nécessaire. Si elle disparaissait (retour à deux passes), ce test devrait
  // être relu, pas contourné.
  assert.ok(/passeSurface\.enabled = false/.test(MAIN),
    'la passe de surface n’est plus éteinte : relire cette garde avant de la modifier')

  // ⛔ LE CŒUR. Le groupe du tracé doit changer de scène, exactement comme
  // `groupeCartouche`, `groupeNuages`, `groupeCotes` et `mapLayers`.
  const adopte =
    /sceneGlobe\.add\(\s*gpx/i.test(MAIN) ||
    /gpxLayer\.poserScene\(\s*sceneGlobe/.test(MAIN) ||
    /gpxLayer\.poserScene\(\s*\{\s*scene: sceneGlobe/.test(MAIN)
  assert.ok(adopte,
    'le calque GPX n’est pas adopté par `sceneGlobe` : la passe de surface est éteinte, ' +
    'le tracé est dessiné dans un tampon que plus personne ne regarde (0 pixel mesuré sur 6 relevés)')
})

test('① l’adoption est CONDITIONNELLE au régime, jamais inconditionnelle', () => {
  // Sous `?terre=deux` la passe de surface existe encore et le tracé s'y
  // dessine (1 053 pixels mesurés) : déménager inconditionnellement
  // casserait ce régime-là, comme la fusion des passes l'avait fait pour le
  // bloc (PSNR 17,80 dB — le bloc avait disparu, voir `main.js`).
  //
  // ⚠️ **ET L'ADOPTION NE PEUT PAS VIVRE DANS LE BLOC `if (fusionDesPasses)`
  // DE LA CHAÎNE DE PASSES — MESURÉ, LA PAGE NE DÉMARRE PLUS.** `gpxLayer` est
  // construit ligne ~8 487, trois mille lignes APRÈS cette chaîne (~5 100) :
  // l'essai qui l'y avait mise n'a jamais atteint la première image (zone morte
  // du `const`). Ce test garde donc la CONDITION, pas l'emplacement.
  const i = MAIN.search(/(sceneGlobe\.add\(\s*gpx|gpxLayer\.poserScene)/i)
  assert.ok(i > 0, 'aucune adoption du calque GPX à garder')
  const autour = MAIN.slice(Math.max(0, i - 900), i + 300)
  assert.ok(/fusionDesPasses|terreUnique/i.test(autour),
    'l’adoption du calque GPX n’est gardée par aucune condition de régime : ' +
    'sous `?terre=deux` la passe de surface dessine encore le bloc, et déménager ' +
    'le tracé l’en ferait disparaître')
})

// ─────────────────────────────────────────────── ② la similitude bloc → globe

test('② le tracé reçoit la POSE du globe, pas seulement une nouvelle scène', () => {
  // 727,6 m/unité de bloc contre 63 710,1 m/unité de globe : reparenter sans
  // poser la similitude déplace le tracé de plusieurs milliers de kilomètres.
  // `mapLayers` reçoit `poserFabricantDePoseur` + `setCamera` ; le tracé a le
  // même besoin, et par le même chemin (`monde/sol-globe.js`).
  const i = MAIN.indexOf('if (fusionDesPasses)')
  const bloc = i > 0 ? MAIN.slice(i, i + 6000) : ''
  const pose = /(gpx\w*)\s*\.\s*(poserFabricantDePoseur|poserPoseur|setCamera|poserCamera)/i.test(bloc)
  assert.ok(pose,
    'le calque GPX n’est adopté par aucune pose bloc → globe : ' +
    'la similitude n’est pas appliquée, le tracé ne peut pas tomber sur le crop')
})

// ─────────────────────────────────────────────── ③ gpx.js ne fige plus sa scène

test('③ `gpx.js` sait changer de scène — il ne capture plus la scène du bloc pour toujours', () => {
  assert.ok(/scene\.add\(this\.group\)/.test(GPX),
    'la ligne de rattachement a changé de forme : relire cette garde')
  assert.ok(/poserScene\s*\(/.test(GPX),
    '`GpxLayer` n’expose aucun `poserScene()` : le groupe reste attaché à la scène ' +
    'du bloc plat, celle que `passeSurface.enabled = false` a cessé de dessiner')
})
