// LES EFFETS QUI NE SURVIVENT PAS AU PAVAGE.
//
// ⚠️ LE TEST QUI COMPTE PLUS QUE LES AUTRES est le premier : « tout effet de la
// chaîne de main.js est classé ». Ce n'est pas une liste de huit noms — c'est
// une PROPRIÉTÉ, dérivée de la source à chaque exécution. Quelqu'un ajoutera un
// effet dans six mois ; il doit faire rougir ce fichier plutôt que de tomber en
// silence dans une catégorie par défaut, parce qu'un effet mal classé ne se
// découvre que sur le papier imprimé, après paiement.
//
// La forme est celle de deux gardes déjà éprouvées de ce dépôt : « tout ce que
// le cadrage EMPRUNTE à la caméra lui est RENDU » (damier-cadre.test.js) et
// `formatsSansDensite` (export-dpi.js / export-plafond.test.js). Toutes deux
// lisent la source plutôt que d'énumérer ce qu'on connaît aujourd'hui.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CLASSEMENT_EFFETS,
  CATEGORIES,
  RENDU,
  SUR,
  NEUTRALISER,
  RECOUVRIR,
  SIGNALER,
  categorieDe,
  effetsNonClasses,
  effetsDe,
  toneMappingPavable,
  MODE_TONAL_ADAPTATIF,
  margeSmaa,
  margeBokeh,
  margeRecouvrement,
  echelleGrain,
  tailleGrainMm,
  planPavage,
  BOKEH_HAUTEUR_INTERNE,
  SMAA_PAS_RECHERCHE_MOYEN,
} from '../src/export-effets.js'
import { DPI_NOMINAL } from '../src/export-dpi.js'
import { PALIERS } from '../src/palier-machine.js'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_MAIN = fs.readFileSync(path.join(RACINE, 'src/main.js'), 'utf8')

// ═══════════════════════════════════════════════════════════════════════════
// ① LA CHAÎNE, DÉRIVÉE DE main.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Deux portes d'entrée dans le compositeur, et deux seulement :
//   · `new EffectPass(camera, a, b, c…)` — les effets d'écran ;
//   · `composer.addPass(x)` — les passes entières (le rendu, l'occlusion, et la
//     passe de profondeur de champ, ajoutée à part parce qu'elle est bâtie à la
//     demande).
// On lit les deux, on remonte chaque identifiant jusqu'au `new Classe(` qui l'a
// construit, et on exige une entrée au classement pour CHAQUE nom de classe
// trouvé. Aucune liste d'exclusion : `RenderPass` lui-même est classé (catégorie
// `RENDU`), pour qu'une passe nouvelle ne puisse pas se glisser dans un « sauf
// celle-là » écrit une fois pour toutes.

/** Le nom de classe construit pour un identifiant, ou l'identifiant tel quel. */
function classeDeLIdentifiant(nom) {
  const direct = /^new\s+([A-Za-z_$][\w$]*)\s*\(/.exec(nom)
  if (direct) return direct[1]
  const affectation = new RegExp(`(?:^|[\\s;{])(?:const|let|var)?\\s*${nom}\\s*=\\s*new\\s+([A-Za-z_$][\\w$]*)\\s*\\(`, 'm')
  const m = affectation.exec(SRC_MAIN)
  return m ? m[1] : nom
}

/** Découpe une liste d'arguments au premier niveau de parenthèses. */
function arguments1erNiveau(texte) {
  const sortie = []
  let profondeur = 0
  let courant = ''
  for (const c of texte) {
    if (c === ',' && profondeur === 0) {
      sortie.push(courant.trim())
      courant = ''
      continue
    }
    if (c === '(' || c === '[' || c === '{') profondeur++
    if (c === ')' || c === ']' || c === '}') profondeur--
    courant += c
  }
  if (courant.trim()) sortie.push(courant.trim())
  return sortie.filter(Boolean)
}

function chaineDeMain() {
  const noms = new Set()

  // ── les effets d'une EffectPass ─────────────────────────────────────────
  const passes = [...SRC_MAIN.matchAll(/new EffectPass\(([^)]*)\)/g)]
  assert.ok(passes.length >= 1, 'aucune EffectPass trouvée dans main.js : le lecteur est cassé, pas la chaîne')
  for (const p of passes) {
    const args = arguments1erNiveau(p[1])
    // le premier argument est la caméra, jamais un effet
    for (const a of args.slice(1)) noms.add(classeDeLIdentifiant(a))
  }

  // ── les passes ajoutées directement au compositeur ───────────────────────
  const ajouts = [...SRC_MAIN.matchAll(/composer\.addPass\(([\s\S]*?)\)\s*\n/g)]
  assert.ok(ajouts.length >= 1, 'aucun composer.addPass trouvé : le lecteur est cassé')
  for (const a of ajouts) {
    const premier = arguments1erNiveau(a[1])[0]
    if (!premier) continue
    const classe = classeDeLIdentifiant(premier)
    // une EffectPass a déjà livré ses effets ci-dessus
    if (classe === 'EffectPass') continue
    noms.add(classe)
  }

  return [...noms]
}

test('⚠️ TOUT effet de la chaîne de main.js est CLASSÉ — un effet nouveau doit rougir ici', () => {
  const chaine = chaineDeMain()
  // Le lecteur doit vraiment lire : s'il ne rendait rien, le test passerait
  // pour de mauvaises raisons. On exige au moins les deux familles.
  assert.ok(chaine.length >= 6, `la chaîne dérivée est suspecte : ${JSON.stringify(chaine)}`)
  assert.ok(chaine.includes('RenderPass'), 'le rendu de scène doit être dans la chaîne dérivée')

  const orphelins = effetsNonClasses(chaine)
  assert.deepEqual(
    orphelins,
    [],
    `effet(s) dans la chaîne sans classement dans src/export-effets.js : ${orphelins.join(', ')}.\n` +
      'Ajoutez une entrée à CLASSEMENT_EFFETS — sûr, à neutraliser, à recouvrir, ou signalé —\n' +
      'plutôt que de retirer ce test.'
  )
})

test('le classement ne garde pas de mort : chaque entrée existe dans main.js', () => {
  // Le bloom est parti de main.js le 2026-08-02 ; une entrée périmée ici
  // décrirait une chaîne qui n'existe plus, et personne ne le verrait.
  const chaine = new Set(chaineDeMain())
  for (const nom of Object.keys(CLASSEMENT_EFFETS)) {
    assert.ok(chaine.has(nom), `« ${nom} » est classé mais ne figure plus dans la chaîne de main.js`)
  }
})

test('chaque classement porte une catégorie connue et une raison écrite', () => {
  for (const [nom, e] of Object.entries(CLASSEMENT_EFFETS)) {
    assert.ok(CATEGORIES.includes(e.categorie), `« ${nom} » : catégorie inconnue « ${e.categorie} »`)
    assert.ok(typeof e.raison === 'string' && e.raison.length > 30, `« ${nom} » : raison absente ou creuse`)
  }
})

test('un effet inconnu n\'hérite d\'aucune catégorie par défaut', () => {
  assert.equal(categorieDe('EffetDeDemain'), null)
  assert.deepEqual(effetsNonClasses(['SMAAEffect', 'EffetDeDemain']), ['EffetDeDemain'])
})

// ═══════════════════════════════════════════════════════════════════════════
// ② LES QUATRE SÛRS — ET LE MAPPAGE TONAL, VÉRIFIÉ
// ═══════════════════════════════════════════════════════════════════════════

test('les quatre effets par pixel sont declarés sûrs', () => {
  for (const nom of ['ExposureEffect', 'ToneMappingEffect', 'HueSaturationEffect', 'BrightnessContrastEffect']) {
    assert.equal(categorieDe(nom), SUR, `« ${nom} » devrait survivre au pavage`)
  }
})

test('ACES est inoffensif — et main.js construit bien le mappage tonal en ACES_FILMIC', () => {
  // ⚠️ LE FAIT DONT TOUT LE RESTE DÉPEND. `ToneMappingEffect` construit
  // TOUJOURS ses passes de luminance, mais `update()` est gardé par
  // `adaptiveLuminancePass.enabled`, que `set mode` n'allume QUE pour
  // REINHARD2_ADAPTIVE. En ACES la moyenne n'est jamais calculée, et le
  // fragment n'échantillonne `luminanceBuffer` que sous TONE_MAPPING_MODE == 3.
  //
  // Ce test verrouille les deux bouts : le mode réellement demandé par main.js,
  // et la règle du module. Passer la chaîne en adaptatif ferait de chaque tuile
  // une exposition à elle — un damier de luminosités — et ce test le dirait.
  assert.match(
    SRC_MAIN,
    /new ToneMappingEffect\(\{\s*mode:\s*ToneMappingMode\.ACES_FILMIC\s*\}\)/,
    'main.js ne construit plus le mappage tonal en ACES_FILMIC : le classement « sûr » ne tient plus tel quel'
  )
  assert.equal(toneMappingPavable(6), true, 'ACES_FILMIC (6) se pave')
  assert.equal(toneMappingPavable(MODE_TONAL_ADAPTATIF), false, 'le mode adaptatif dépend de la luminance de la CIBLE')
  assert.equal(CLASSEMENT_EFFETS.ToneMappingEffect.sousReserve, 'mode non adaptatif')
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ NEUTRALISER N'EST PAS CORRIGER
// ═══════════════════════════════════════════════════════════════════════════

test('vignettage et grain sont à neutraliser — et AUCUN ne peut l\'être sans consigne de réapplication', () => {
  // C'est la propriété, pas la paire d'aujourd'hui : neutraliser sans
  // réappliquer livrerait une AUTRE affiche que celle validée à l'écran, ce qui
  // est un second défaut et non une correction.
  const aEteindre = effetsDe(NEUTRALISER)
  assert.ok(aEteindre.includes('VignetteEffect') && aEteindre.includes('NoiseEffect'))
  for (const nom of aEteindre) {
    const r = CLASSEMENT_EFFETS[nom].reappliquer
    assert.ok(
      typeof r === 'string' && r.length > 30,
      `« ${nom} » est neutralisé sans consigne de réapplication : l'affiche sortirait différente de l'aperçu`
    )
  }
})

test('la consigne du grain impose une ÉCHELLE, pas un simple « remettez-le »', () => {
  assert.match(CLASSEMENT_EFFETS.NoiseEffect.reappliquer, /échelle/i)
})

test('le grain garde une taille PHYSIQUE, quelle que soit la densité', () => {
  // Un grain d'un pixel à 300 dpi mesure 0,085 mm : invisible, et incompressible.
  // La cellule doit rester autour du pixel de 150 dpi (0,169 mm) — c'est le
  // plancher argumenté d'export-dpi.js, importé plutôt que recopié.
  for (const dpi of Object.values(DPI_NOMINAL)) {
    const mm = tailleGrainMm(dpi)
    assert.ok(mm >= 0.12 && mm <= 0.22, `à ${dpi} dpi la cellule de grain mesure ${mm.toFixed(3)} mm`)
  }
  assert.equal(echelleGrain(300), 2, 'à 300 dpi, une cellule de 2 × 2 pixels')
  assert.equal(echelleGrain(150), 1)
  assert.equal(echelleGrain(75), 1, 'jamais moins d\'un pixel')
  assert.equal(echelleGrain(0), null)
  assert.equal(echelleGrain('300'), null, 'on ne devine pas une densité')
})

// ═══════════════════════════════════════════════════════════════════════════
// ④ LES MARGES DE RECOUVREMENT
// ═══════════════════════════════════════════════════════════════════════════

test('la marge de SMAA est une constante en pixels d\'affiche', () => {
  // Les trois matériaux de SMAA travaillent en texels de LEUR cible : un texel
  // de tuile est un pixel d'affiche, donc la hauteur de tuile n'entre pas.
  const a = margeRecouvrement({ hauteurTuile: 720, smaaActif: true })
  const b = margeRecouvrement({ hauteurTuile: 8192, smaaActif: true })
  assert.equal(a, b, 'la marge SMAA ne doit pas dépendre de la taille de la tuile')
  // 2 × 8 pas de recherche + 2 (détection) + 3,25 (correction) + 1 (mélange)
  assert.equal(margeSmaa(), 23)
  assert.equal(margeSmaa({ pasRecherche: 16 }), 39, 'le préréglage HIGH cherche deux fois plus loin')
  assert.ok(margeSmaa({ pasRecherche: 32 }) > margeSmaa({ pasRecherche: 8 }), 'plus de pas, plus de marge')
})

test('⚠️ la marge du bokeh N\'EST PAS une constante : elle croît avec la hauteur de tuile', () => {
  // C'est le piège de la tâche. `height: 720` (main.js) verrouille la résolution
  // interne de la profondeur de champ ; un demi-texel de ses tampons mesure
  // `hauteurTuile / 720` pixels d'affiche. Prendre la marge d'une taille pour
  // une autre laisse une couture.
  const scale = 3.7 // params.bokehScale, main.js
  const m720 = margeBokeh({ hauteurTuile: 720, bokehScale: scale })
  const m2048 = margeBokeh({ hauteurTuile: 2048, bokehScale: scale })
  const m8192 = margeBokeh({ hauteurTuile: 8192, bokehScale: scale })
  assert.ok(m720 < m2048 && m2048 < m8192, `marge non croissante : ${m720}, ${m2048}, ${m8192}`)
  assert.ok(m8192 - m720 >= 40, 'l\'écart entre une tuile de 720 et une de 8 192 doit être franc')

  // La formule, terme à terme : 2·bokehScale + 6 (Kawase MEDIUM) + 4·h/720.
  const attendu = (h, s) => Math.ceil(2 * s + 6 + 4 * (h / BOKEH_HAUTEUR_INTERNE))
  for (const h of [720, 1024, 2048, 4096, 8192]) {
    assert.equal(margeBokeh({ hauteurTuile: h, bokehScale: scale }), attendu(h, scale), `hauteur ${h}`)
  }

  // Et elle croît aussi avec l'ouverture du bokeh, à hauteur constante.
  assert.ok(
    margeBokeh({ hauteurTuile: 2048, bokehScale: 8 }) > margeBokeh({ hauteurTuile: 2048, bokehScale: 1 }),
    'un bokeh plus large lit plus loin'
  )
})

test('un bokeh à zéro ne lit aucun voisinage, et une hauteur illisible ne rend pas un nombre', () => {
  // `coc == 0.0` rend le pixel tel quel dans convolution.bokeh.frag : rien à
  // recouvrir. Ce n'est pas de l'indulgence, c'est le shader.
  assert.equal(margeBokeh({ hauteurTuile: 2048, bokehScale: 0 }), 0)
  // Et on ne devine pas une marge sur une taille absurde — même règle que
  // `degradePour` avec un plafond matériel illisible.
  for (const h of [0, -1, NaN, Infinity, undefined, '2048']) {
    assert.equal(margeBokeh({ hauteurTuile: h, bokehScale: 3.7 }), null, `hauteur ${String(h)}`)
  }
})

test('la marge d\'une tuile est le PLUS GRAND besoin, pas la somme', () => {
  const h = 2048
  const smaa = margeSmaa()
  const bokeh = margeBokeh({ hauteurTuile: h, bokehScale: 3.7 })
  const deux = margeRecouvrement({ hauteurTuile: h, smaaActif: true, bokehActif: true, bokehScale: 3.7 })
  assert.equal(deux, Math.max(smaa, bokeh))
  assert.ok(deux < smaa + bokeh, 'sommer gonflerait chaque tuile pour rien')
  // SMAA éteint et bokeh éteint : plus rien à recouvrir.
  assert.equal(margeRecouvrement({ hauteurTuile: h, smaaActif: false, bokehActif: false }), 0)
  // Le bokeh éteint ne doit pas emporter la marge de SMAA avec lui.
  assert.equal(margeRecouvrement({ hauteurTuile: h, smaaActif: true, bokehActif: false }), smaa)
  assert.equal(margeRecouvrement({ hauteurTuile: 0 }), null)
})

test('les deux effets à recouvrir désignent la fonction qui les mesure', () => {
  for (const nom of effetsDe(RECOUVRIR)) {
    const m = CLASSEMENT_EFFETS[nom].marge
    assert.ok(m === 'margeSmaa' || m === 'margeBokeh', `« ${nom} » demande un recouvrement sans dire lequel`)
  }
  assert.deepEqual(effetsDe(RECOUVRIR).sort(), ['DepthOfFieldEffect', 'SMAAEffect'])
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ L'OCCLUSION AMBIANTE — SIGNALÉE, PAS TRAITÉE
// ═══════════════════════════════════════════════════════════════════════════

test('l\'occlusion ambiante est signalée, avec son rayon en unités monde, et n\'est pas traitée', () => {
  assert.equal(categorieDe('N8AOPostPass'), SIGNALER)
  assert.match(CLASSEMENT_EFFETS.N8AOPostPass.raison, /unités monde/i)
  // Elle est bien éteinte par défaut aux quatre paliers, et bien activable à la
  // main : c'est ce qui la rend digne d'un signalement plutôt que d'un oubli.
  assert.equal(PALIERS.length, 4, 'quatre paliers attendus')
  assert.ok(
    PALIERS.every((p) => p.ssao === false),
    'un palier allume l\'occlusion : le signalement devient un traitement à écrire'
  )
  assert.match(SRC_MAIN, /aoPass\.configuration\.aoRadius = [\d.]+/, 'le rayon monde est bien celui de la passe')

  const plan = planPavage({ hauteurTuile: 2048, dpi: 300, occlusionActive: true })
  assert.equal(plan.signalements.length, 1)
  assert.match(plan.signalements[0], /Non traitée/)
  assert.equal(planPavage({ hauteurTuile: 2048, dpi: 300 }).signalements.length, 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ LE PLAN COMPLET
// ═══════════════════════════════════════════════════════════════════════════

test('le plan n\'éteint que ce qui est allumé, et promet de rendre ce qu\'il éteint', () => {
  const nu = planPavage({ hauteurTuile: 2048, dpi: 300, vignette: 0, grain: 0 })
  assert.deepEqual(nu.neutraliser, [], 'un vignettage à zéro n\'a rien produit : rien à éteindre')
  assert.deepEqual(nu.reappliquer, [], 'et rien à réappliquer — le promettre serait une invention')

  const habille = planPavage({ hauteurTuile: 2048, dpi: 300, vignette: 0.6, grain: 0.35, bokehActif: true, bokehScale: 3.7 })
  assert.deepEqual(habille.neutraliser.sort(), ['NoiseEffect', 'VignetteEffect'])
  // ⚠️ AUTANT DE RÉAPPLICATIONS QUE DE NEUTRALISATIONS : c'est la propriété qui
  // empêche « on éteint et on verra plus tard ».
  assert.equal(habille.reappliquer.length, habille.neutraliser.length)
  for (const n of habille.neutraliser) {
    assert.ok(habille.reappliquer.some((r) => r.effet === n), `« ${n} » éteint sans être rendu`)
  }
  const grain = habille.reappliquer.find((r) => r.effet === 'NoiseEffect')
  assert.equal(grain.opacite, 0.35, 'l\'intensité validée à l\'écran est reportée telle quelle')
  assert.equal(grain.echellePx, 2, 'et à 300 dpi le grain se réapplique par cellules de 2 px')
  assert.equal(habille.reappliquer.find((r) => r.effet === 'VignetteEffect').darkness, 0.6)
  assert.equal(habille.recouvrementPx, margeRecouvrement({ hauteurTuile: 2048, bokehActif: true, bokehScale: 3.7 }))

  assert.equal(planPavage({ hauteurTuile: -1, dpi: 300 }), null)
})

test('le plan par défaut suppose SMAA allumé — il l\'est dans main.js', () => {
  // `new SMAAEffect()` sans option : préréglage MEDIUM, 8 pas de recherche.
  assert.match(SRC_MAIN, /new SMAAEffect\(\)/)
  assert.equal(SMAA_PAS_RECHERCHE_MOYEN, 8)
  assert.equal(planPavage({ hauteurTuile: 2048, dpi: 300 }).recouvrementPx, margeSmaa())
})

test('les catégories ne se recouvrent pas, et chacune est peuplée', () => {
  const total = CATEGORIES.reduce((n, c) => n + effetsDe(c).length, 0)
  assert.equal(total, Object.keys(CLASSEMENT_EFFETS).length, 'un effet appartient à une catégorie et une seule')
  for (const c of [RENDU, SUR, NEUTRALISER, RECOUVRIR, SIGNALER]) {
    assert.ok(effetsDe(c).length > 0, `la catégorie « ${c} » est vide : elle ne sert plus à rien`)
  }
})
