import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { EXPORT_SIZES, EXPORT_RATIOS, DEFAULT_SIZE, exportDims, targetBytes } from '../src/export-presets.js'

const ROOT = path.join(import.meta.dirname, '..')
const label = (v) => EXPORT_SIZES.find((s) => s.value === v)?.label ?? ''

// ---------------------------------------------------------------------------
// « 2K » EST UN MOT AMBIGU — ce que l'échelle décide à sa place
// ---------------------------------------------------------------------------
// Le cinéma appelle 2K le DCI 2048×1080 ; le grand public appelle 2K le QHD
// 2560×1440. Les deux usages sont défendables dans l'absolu, mais PAS ici :
// l'échelle du projet est 1280 / 1920 / 2560 / 3840, c'est-à-dire 720p, 1080p,
// 1440p, 2160p — l'échelle grand public, exprimée en côté LONG. Y glisser
// 2048×1080 casserait la progression (un « 2K » plus petit que le 1080p en
// hauteur) et donnerait deux crans quasi identiques. D'où 2560.

test('« 2K » désigne le QHD 2560×1440, pas le DCI 2048×1080', () => {
  assert.deepEqual(exportDims('16:9', '2560'), { width: 2560, height: 1440 })
  assert.match(label('2560'), /2K/, 'le cran 2560 doit être ÉTIQUETÉ 2K, sinon l’option est invisible')
  for (const s of EXPORT_SIZES) {
    const { width, height } = exportDims('16:9', s.value)
    assert.notDeepEqual({ width, height }, { width: 2048, height: 1080 }, 'aucun cran ne doit valoir le DCI 2K')
  }
})

test('l’échelle reste la progression grand public, croissante et sans doublon', () => {
  const values = EXPORT_SIZES.map((s) => Number(s.value))
  assert.deepEqual(values, [1280, 1920, 2560, 3840])
  assert.deepEqual(values, [...values].sort((a, b) => a - b))
  assert.equal(new Set(values).size, values.length)
  assert.ok(EXPORT_SIZES.some((s) => s.value === DEFAULT_SIZE), 'le défaut doit exister dans l’échelle')
})

// ---------------------------------------------------------------------------
// LE CHIFFRE EST UN CÔTÉ LONG, PAS UNE LARGEUR
// ---------------------------------------------------------------------------
// C'est ce qui fait qu'un seul menu sert les cinq ratios. Le confondre avec une
// largeur donnerait un 9:16 de 2560×4551 — quatre fois les pixels attendus.

test('en portrait, le cran s’applique à la HAUTEUR', () => {
  assert.deepEqual(exportDims('9:16', '2560'), { width: 1440, height: 2560 })
  assert.deepEqual(exportDims('4:5', '2560'), { width: 2048, height: 2560 })
  assert.deepEqual(exportDims('1:1', '2560'), { width: 2560, height: 2560 })
})

// Le format des vidéos de com : 1080×1920. Il ne vient PAS d'un préréglage
// dédié mais du croisement 9:16 × 1920 — donc toute réécriture de exportDims
// peut le perdre sans que rien d'autre ne le signale.
test('le vertical de com 1080×1920 reste accessible (9:16 × 1920)', () => {
  assert.deepEqual(exportDims('9:16', '1920'), { width: 1080, height: 1920 })
})

test('« Screen » suit l’aspect du canevas au lieu d’un ratio figé', () => {
  assert.deepEqual(exportDims('Screen', '2560', 16 / 9), { width: 2560, height: 1440 })
  assert.deepEqual(exportDims('Screen', '2560', 1 / 2), { width: 1280, height: 2560 })
  // aspect inconnu (canevas 0×0, onglet caché) : on ne propage pas de NaN
  assert.deepEqual(exportDims('Screen', '2560', 0 / 0), { width: 2560, height: 2560 })
})

// ---------------------------------------------------------------------------
// DEUX GARDE-FOUS QUI ONT DÉJÀ COÛTÉ CHER AILLEURS
// ---------------------------------------------------------------------------

// Les passes de post-traitement construisent des cibles à la moitié et au quart
// de la taille : une dimension IMPAIRE y devient fractionnaire, et c'est
// exactement le bug du rectangle noir documenté dans main.js (evenSize).
test('aucune combinaison ne produit de dimension impaire', () => {
  for (const s of EXPORT_SIZES) {
    for (const r of [...Object.keys(EXPORT_RATIOS), 'Screen']) {
      const { width, height } = exportDims(r, s.value, 1512 / 945) // aspect biscornu exprès
      assert.equal(width % 2, 0, `${r} × ${s.value} : largeur impaire`)
      assert.equal(height % 2, 0, `${r} × ${s.value} : hauteur impaire`)
    }
  }
})

// Un lien partagé, un vieux réglage, un ratio renommé : la valeur qui arrive
// n'est pas toujours dans la table. Un NaN qui sort d'ici finit dans
// composer.setSize() et dans camera.aspect — et un aspect NaN ne se répare pas
// tout seul (voir viewport.js). Mieux vaut une image au format par défaut.
test('une valeur hors table retombe sur le défaut au lieu de propager un NaN', () => {
  for (const [r, s] of [['16:9', 'énorme'], ['sepia', '1920'], [undefined, undefined], ['16:9', null]]) {
    const { width, height } = exportDims(r, s)
    assert.ok(Number.isFinite(width) && width > 0, `exportDims(${r}, ${s}) : largeur non finie`)
    assert.ok(Number.isFinite(height) && height > 0, `exportDims(${r}, ${s}) : hauteur non finie`)
  }
  assert.deepEqual(exportDims('16:9', 'énorme'), exportDims('16:9', DEFAULT_SIZE))
})

// ---------------------------------------------------------------------------
// LE PRIX EN MÉMOIRE — pourquoi monter d'un cran n'est pas gratuit
// ---------------------------------------------------------------------------
// La chaîne compose en HalfFloat (main.js : frameBufferType HalfFloatType),
// soit 8 octets par pixel et par cible. Pendant un export, composer.setSize()
// RÉALLOUE toutes les cibles à la taille demandée — profondeur de champ
// comprise, dont les six cibles sont déjà le plus gros poste du moteur
// (voir le commentaire de style.css). D'où ce test : il fige l'ordre de
// grandeur pour quiconque voudra ajouter un cran au-dessus de 4K.
test('une cible plein écran coûte 1,78× plus en 2K qu’en 1080p', () => {
  const hd = targetBytes(1920, 1080)
  const qhd = targetBytes(2560, 1440)
  assert.equal(hd, 16_588_800) // 15,8 Mo
  assert.equal(qhd, 29_491_200) // 28,1 Mo
  assert.ok(Math.abs(qhd / hd - 1.777) < 0.01)
  // et 4K coûte encore 2,25× le 2K : c'est le cran qui fait mal, pas le 2K
  assert.ok(Math.abs(targetBytes(3840, 2160) / qhd - 2.25) < 0.01)
})

// ---------------------------------------------------------------------------
// LES DEUX APPELANTS — verrouillés dans la source
// ---------------------------------------------------------------------------
// export-modal.js et export-recorder.js touchent au DOM et à WebGL : ils ne
// sont pas importables ici. On relit donc leur source pour empêcher la dérive
// la plus probable — quelqu'un qui rétablit une table locale « vite fait » et
// laisse le 2K sortir de l'une des deux voies.

test('la modale ne redéclare pas sa propre table de tailles', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/ui/export-modal.js'), 'utf8')
  assert.match(src, /from '\.\.\/export-presets\.js'/)
  assert.doesNotMatch(src, /const SIZES = \[/, 'la table doit rester dans export-presets.js')
})

test('l’enregistreur vidéo accepte bien une taille de rendu', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/export-recorder.js'), 'utf8')
  assert.match(src, /start\(\s*\{/, 'start() doit prendre des options (la taille d’enregistrement)')
  assert.match(src, /restoreState/, 'toute sortie doit rendre au canevas sa taille d’écran')
})
