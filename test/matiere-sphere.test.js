// LA MATIÈRE DU RELIEF, CÔTÉ SPHÈRE — Tâche R25
// (`.superpowers/sdd/2026-08-22-globe-studio/brief-R25.md`).
//
// L'option 38 de `inventaire-studio-2.md` : *« picker (17 vignettes) »*, notée
// ✅ 3,560 en colonne « sphère », avec en colonne « lu par » le commentaire
// **« le globe n'a pas de matière PBR de relief »**.
//
// ⛔ **ET LA MESURE DIT PIRE QUE LE COMMENTAIRE** : les quinze matières opaques
// rendaient LA MÊME image (0,025 à 0,338 d'écart entre elles, médiane **0,231**,
// c'est-à-dire le plancher de bruit du banc au millième près), parce que la
// seule chose qui traversait était `material.color` mis à BLANC et `uTint` mis à
// ZÉRO. Le sélecteur était un interrupteur à deux positions.
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même protocole que `lumiere-sphere`, `grille-crop` et `crop-eclairage` :
//   ① LA LOI vit dans un module PUR et se vérifie sous node ;
//   ② LE TEXTE GLSL est **TRADUIT ET EXÉCUTÉ**, jamais cherché par son nom ;
//   ③ **L'UNICITÉ DE L'ÉCRITURE** est elle-même une assertion ;
//   ④ le BRANCHEMENT — `contexteCrop` → `poserHabillage` → uniforme ;
//   ⑤ **L'ALLER-RETOUR BIT À BIT** de `poserHabillage` / `retirerHabillage` ;
//   ⑥ **LA TABLE DES VERDICTS COMMANDE L'INTERFACE**.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, de combien
// l'image bouge, et que les quinze soient enfin distinctes. Seul l'écran le dit
// — c'est `rapport-R25.md` et `.banc/R25/`, pas ce fichier.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  BANDE_ZERO_BLOC,
  COUT_TRANSMISSION,
  MATIERE_MONDE_ETEINTE,
  POSTES_MATIERE_SPHERE,
  GLSL_MATIERE,
  bandeZeroMatiereM,
  champMatiere,
  longueurVerreM,
  matiereAgit,
  teinteMatiere,
  tuilageMatiere,
  vignetteAgit,
} from '../src/monde/matiere-crop.js'
import { intervalleCourbesBloc, COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
import { CHAMPS_HABILLAGE } from '../src/monde/branchement-crop.js'
import { MATERIALS, MATERIAL_BY_ID, materialsByCategory } from '../src/material-catalog.js'

const GLOBE = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const TERRAIN = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
const PANNEAU = readFileSync(new URL('../src/ui/shaders-panel.js', import.meta.url), 'utf8')
const ECLAIRAGE = readFileSync(new URL('../src/monde/eclairage-crop.js', import.meta.url), 'utf8')

// ══════════ ① LE CATALOGUE — « DIX-SEPT » EST-IL DIX-SEPT ? ════════════════
//
// ⚠️ **PREMIÈRE QUESTION DU BRIEF, ET LA RÉPONSE N'EST PAS CELLE DU LIBELLÉ.**
// Le picker rend **17 tuiles**, mais ce sont **16 matières + « Aucune »** ; et
// des 16, **une seule est du verre**, quatorze sont des jeux PBR CC0 sur disque
// et une est procédurale. Le libellé « 17 vignettes » de l'inventaire compte
// donc la tuile de retrait comme une matière.

test('① le picker rend 17 tuiles : 16 matières + « Aucune »', () => {
  assert.equal(MATERIALS.length, 16, 'le catalogue a bougé — le verdict par vignette du rapport est à refaire')
  assert.equal(MATERIALS.length + 1, 17, '16 matières + la tuile « Aucune » = les 17 vignettes de l’inventaire')
  const parCat = materialsByCategory()
  assert.equal(parCat.reduce((n, c) => n + c.items.length, 0), 16, 'une matière est tombée hors de toute catégorie')
})

test('① les 16 se répartissent en 1 verre, 14 jeux PBR sur disque, 1 procédurale', () => {
  const n = (k) => MATERIALS.filter((m) => m.kind === k).length
  assert.equal(n('glass'), 1)
  assert.equal(n('dir'), 14)
  assert.equal(n('tex'), 1)
  assert.equal(n('glass') + n('dir') + n('tex'), MATERIALS.length, 'une matière porte un `kind` inconnu')
})

// ⛔ **ET DEUX MATIÈRES PARTAGENT LEURS IMAGES, LE CATALOGUE LE DIT LUI-MÊME.**
// L'albâtre est copié du jeu `onyx002` (« copiées dans leur propre dossier pour
// que la matière soit AUTONOME »). Ce qui les sépare est la RUGOSITÉ (0,52 contre
// 0,32) et le terme `sss` — **deux postes sans receveur sur la sphère**. C'est
// pourquoi le rapport ne peut PAS déclarer les seize mutuellement distinctes, et
// c'est une propriété du catalogue, pas du portage : le test la fige.
test('① albâtre et onyx partagent leur jeu d’images — ce qui les sépare n’a pas de receveur', () => {
  const a = MATERIAL_BY_ID.albatre
  const o = MATERIAL_BY_ID.onyx002
  assert.ok(a && o)
  assert.notEqual(a.roughness, o.roughness, 'seule la rugosité les sépare — et elle est sans receveur')
  assert.ok(a.sss, 'l’albâtre porte le seul champ `sss` du catalogue')
  assert.equal(MATERIALS.filter((m) => m.sss).length, 1, 'un second `sss` changerait le verdict de la vignette')
})

// ══════════ ② LES TROIS CONVERSIONS D'UNITÉ, AVEC LEUR FACTEUR ═════════════
//
// La classe de défaut n° 1 de ce chantier. Facteurs déjà payés ailleurs :
// 121,6 · 10 · 130,4 · 6 · 28 · 18.

test('② le tuilage est SANS DIMENSION — facteur 1, et la valeur vient du matériau', () => {
  // `repeat.x` du socle porte déjà `preset.repeat × scale × zoomRepeat(demZoom)`
  assert.equal(tuilageMatiere(30), 30)
  assert.equal(tuilageMatiere(5), 5)
  // et un zéro / un NaN ne devient pas 1 par accident : il devient 0, que
  // `poserHabillage` refuse d'écrire (le repeat de repos, 1, reste en place).
  assert.equal(tuilageMatiere(0), 0)
  assert.equal(tuilageMatiere(NaN), 0)
  assert.equal(tuilageMatiere(undefined), 0)
})

test('② la bande du niveau zéro est VERTICALE : 0,05 unité de bloc = 12,21 m à La Réunion', () => {
  const m = bandeZeroMatiereM({ extentMeters: 27356.4, exageration: 2, span: COTE_CROP_UNITES })
  // (56 / 27 356,4) × 2 = 4,094 106e−3 unités de scène par mètre → 0,05 / ça
  assert.ok(Math.abs(m - 12.21268) < 0.0005, `attendu ≈ 12,2127 m, obtenu ${m}`)

  // ⚠️ **ET LE FACTEUR N'EST PAS EXACTEMENT CELUI DE `rapport-R24.md`, PARCE QUE
  // LE BLOC A DEUX LARGEURS.** R24 publie **4,094 425e−3** ; le nôtre vaut
  // **4,094 106e−3**. L'écart, **+7,8e−5 en relatif**, est exactement celui que
  // le plan de fusion nomme entre `dem.extentMeters` (**27 356,4 m**) et
  // `_empriseVue` (**27 354,269 m**) — *« les deux largeurs diffèrent de
  // 0,0079 % »*. R24 est parti de la seconde, `matiereDuCrop` de la première,
  // et c'est le bon choix : `dem.extentMeters` est la largeur du MNT que le
  // socle a effectivement drapé, donc celle sur laquelle son 0,05 s'applique.
  // ⚡ **Sur une demi-bande de 12,21 m, l'écart vaut 0,001 m.** Il est écrit
  // parce qu'un chiffre repris d'un autre rapport sans vérifier sa source est
  // exactement ce qui a coûté neuf fautes d'unité à ce chantier.
  const echelle = BANDE_ZERO_BLOC / m
  assert.ok(Math.abs(echelle - 4.094106e-3) < 1e-9, `l’échelle doit valoir 4,094106e−3, obtenue ${echelle}`)
  const avecEmpriseVue = BANDE_ZERO_BLOC / bandeZeroMatiereM({ extentMeters: 27354.269, exageration: 2, span: COTE_CROP_UNITES })
  assert.ok(Math.abs(avecEmpriseVue - 4.094425e-3) < 1e-9, `sur _empriseVue on doit retrouver R24 : ${avecEmpriseVue}`)
  assert.ok(Math.abs(avecEmpriseVue / echelle - 1) < 1e-4, 'les deux largeurs ne diffèrent que de 0,0079 %')
})

// ⛔ **ET LA FAUTE SYMÉTRIQUE EST CELLE QU'IL FALLAIT ÉVITER** : recopier 0,05
// tel quel aurait donné **cinq centimètres** de bande là où le socle en a 12,2 m
// — un rapport de **244**, c'est-à-dire une marche franche au lieu d'un fondu
// sur toute la ligne de côte.
test('② recopier 0,05 sans convertir se serait trompé d’un facteur 244', () => {
  const m = bandeZeroMatiereM({ extentMeters: 27356.4, exageration: 2 })
  assert.ok(Math.abs(m / BANDE_ZERO_BLOC - 244.25) < 0.5, `le facteur oublié vaut ≈ 244, obtenu ${m / BANDE_ZERO_BLOC}`)
})

// ⚡ **ELLE PORTE L'EXAGÉRATION, ET C'EST CE QUI LA SÉPARE DU PAS DE GRILLE.**
// `intervalleCourbesBloc` (vertical) la porte aussi ; le pas de grille
// (horizontal) ne la porte PAS. Le test compare les deux lois plutôt que de
// croire les deux commentaires.
test('② la bande suit la MÊME loi que l’intervalle des courbes (toutes deux verticales)', () => {
  const a = { extentMeters: 27356.4, exageration: 2, span: COTE_CROP_UNITES }
  const bande = bandeZeroMatiereM({ bandeBloc: 0.05, ...a })
  const courbe = intervalleCourbesBloc({ valeurBloc: 0.05, ...a })
  assert.equal(bande, courbe, 'deux longueurs verticales, une seule loi')
  // et l'exagération divise : doubler l'exagération divise la bande par deux
  const x4 = bandeZeroMatiereM({ ...a, exageration: 4 })
  assert.ok(Math.abs(x4 * 2 - bande) < 1e-9, 'l’exagération doit diviser')
})

test('② le champ du bruit est en UNITÉS DE SCÈNE — facteur uSlabHalf, pas 1', () => {
  // ⛔ qCrop = 1 vaut 28 unités de scène, pas 1. Le confondre aurait rendu des
  // taches VINGT-HUIT fois trop grandes : à uMatNoiseScale = 0,5, une demi-période
  // en travers du bloc au lieu de quatorze.
  assert.deepEqual(champMatiere([1, 0], 28), [28, 0])
  assert.deepEqual(champMatiere([-1, 1], 28, [3, -5]), [-25, 23])
  // la fenêtre continue déplace le champ, comme pour la couche d'apparence
  assert.deepEqual(champMatiere([0, 0], 28, [7, 9]), [7, 9])
  const periodesBonnes = 2 * 28 * 0.5
  const periodesSiOnOublie = 2 * 1 * 0.5
  assert.equal(periodesBonnes / periodesSiOnOublie, 28, 'le facteur oublié vaut 28')
})

test('② les deux longueurs du verre en mètres — 1 954 m et 2 931 m à La Réunion', () => {
  const a = { extentMeters: 27356.4, exageration: 2, span: COTE_CROP_UNITES }
  const ep = longueurVerreM({ valeurBloc: 8, ...a })
  const at = longueurVerreM({ valeurBloc: 12, ...a })
  assert.ok(Math.abs(ep - 1954.0) < 1, `épaisseur attendue ≈ 1 954 m, obtenue ${ep}`)
  assert.ok(Math.abs(at - 2931.0) < 1, `atténuation attendue ≈ 2 931 m, obtenue ${at}`)
  // les deux valeurs sont bien celles que `_makeGlassMaterial` pose
  assert.match(TERRAIN, /thickness:\s*8,/)
  assert.match(TERRAIN, /attenuationDistance:\s*12,/)
})

// ══════════ ③ LA RÉVÉLATION — LE JUMEAU JS CONTRE LE TEXTE DU SOCLE ════════

test('③ la révélation combine le bruit et le niveau zéro comme `terrain.js`', () => {
  // teinte 0 (une matière est posée) : la révélation EST la teinte
  assert.equal(teinteMatiere(0, 0, 0), 0)
  assert.equal(teinteMatiere(0, 1, 0), 1)
  assert.equal(teinteMatiere(0, 0, 1), 1)
  assert.equal(teinteMatiere(0, 0.3, 0.7), 0.7, 'le maximum des deux, comme le `max(effTint, below)` du socle')
  // teinte non nulle (pas de matière) : le mix reste celui d'origine
  assert.equal(teinteMatiere(0.68, 0, 0), 0.68)
  assert.ok(Math.abs(teinteMatiere(0.5, 0.5, 0) - 0.75) < 1e-12)
})

// ⚠️ **LE SOCLE EST LA SOURCE, ET ON LE RELIT** plutôt que de croire ce
// commentaire — c'est la leçon de la Tâche K ter (une assertion verte qui
// lisait une formule DANS UN COMMENTAIRE).
test('③ la loi de révélation du socle est bien celle qu’on a transcrite', () => {
  assert.match(TERRAIN, /effTint = mix\(uTint, 1\.0, reveal\)/)
  assert.match(TERRAIN, /effTint = max\(effTint, below\)/)
  assert.match(TERRAIN, /1\.0 - smoothstep\(uSeaY - 0\.05, uSeaY \+ 0\.05, vWorldPos\.y\)/)
})

// ══════════ ④ LE TEXTE GLSL — TRADUIT ET EXÉCUTÉ, PAS CHERCHÉ ══════════════
//
// ⚠️ **`uvMatiere` EST LA CONVERSION DE TUILAGE, ET ON L'EXÉCUTE.** Le texte est
// extrait du module, traduit en JS, et évalué contre la loi attendue.
function traduireUvMatiere(glsl) {
  const m = glsl.match(/vec2 uvMatiere\(vec2 qCrop\)\s*\{\s*return ([^;]+);\s*\}/)
  assert.ok(m, 'uvMatiere a changé de forme — cette garde est à réécrire')
  // `(qCrop * 0.5 + 0.5) * uMatRepeat` — une expression vectorielle terme à terme
  const corps = m[1].trim()
  return (q, repeat) => {
    const f = new Function('qx', 'qy', 'uMatRepeat', `
      const mul = (a, b) => Array.isArray(a) ? (Array.isArray(b) ? [a[0]*b[0], a[1]*b[1]] : [a[0]*b, a[1]*b]) : [a*b[0], a*b[1]]
      const add = (a, b) => Array.isArray(a) ? (Array.isArray(b) ? [a[0]+b[0], a[1]+b[1]] : [a[0]+b, a[1]+b]) : [a+b[0], a+b[1]]
      const qCrop = [qx, qy]
      return ${corps.replace(/\(qCrop \* 0\.5 \+ 0\.5\) \* uMatRepeat/, 'mul(add(mul(qCrop, 0.5), 0.5), uMatRepeat)')}
    `)
    return f(q[0], q[1], repeat)
  }
}

test('④ `uvMatiere` traduit et EXÉCUTÉ : qCrop [−1,1] → uv [0,1] × repeat', () => {
  const uv = traduireUvMatiere(GLSL_MATIERE)
  assert.deepEqual(uv([-1, -1], 1), [0, 0], 'le coin sud-ouest du bloc est l’UV (0,0)')
  assert.deepEqual(uv([1, 1], 1), [1, 1], 'le coin nord-est est l’UV (1,1)')
  assert.deepEqual(uv([0, 0], 1), [0.5, 0.5], 'le centre est le milieu de la texture')
  // et le tuilage MULTIPLIE : 30 répétitions en travers du bloc
  assert.deepEqual(uv([1, 1], 30), [30, 30])
  assert.deepEqual(uv([-1, -1], 30), [0, 0])
})

// ⚠️ **C'EST LA MÊME CONVERSION QUE `cmUv` POUR LES MASQUES CUITS**, et le test
// le vérifie dans `globe.js` plutôt que de le dire.
test('④ la conversion qCrop → uv est celle que le globe emploie déjà', () => {
  assert.match(GLOBE, /cmUv = qCrop \* 0\.5 \+ 0\.5/)
  assert.match(GLSL_MATIERE, /\(qCrop \* 0\.5 \+ 0\.5\) \* uMatRepeat/)
})

// ⛔ **LA CICATRICE DE CETTE TÂCHE, FIGÉE.** J'ai recopié `mnHash`/`mnNoise` de
// `terrain.js` en croyant les apporter : `globe.js` les portait DÉJÀ. Le
// fragment refusait alors de se lier (« function already has a body »), plus une
// tuile ne se dessinait — et le banc différentiel, lui, n'a rien vu : dix-sept
// images cassées de la même façon s'écartent de 0,12 à 0,33, c'est-à-dire du
// bruit. Une redéclaration ne doit plus jamais partir.
test('④ le module ne redéclare AUCUNE fonction que `globe.js` porte déjà', () => {
  const declareesModule = [...GLSL_MATIERE.matchAll(/^\s*(?:float|vec2|vec3|vec4)\s+(\w+)\s*\(/gm)].map((m) => m[1])
  assert.ok(declareesModule.length >= 2, 'garde inopérante : aucune fonction trouvée dans GLSL_MATIERE')
  const reste = GLOBE.replace(/\$\{GLSL_MATIERE\}/, '')
  for (const nom of declareesModule) {
    const dejaLa = new RegExp(`^\\s*(?:float|vec2|vec3|vec4)\\s+${nom}\\s*\\(`, 'm').test(reste)
    assert.equal(dejaLa, false, `\`${nom}\` est déjà déclarée dans globe.js — le fragment ne se liera pas, et AUCUN banc différentiel ne le verra`)
  }
  // et les deux qu'on a failli redéclarer sont bien là, dans globe.js
  assert.match(GLOBE, /float mnHash\(vec2 p\)/)
  assert.match(GLOBE, /float mnNoise\(vec2 p\)/)
})

// ══════════ ⑤ L'UNICITÉ DE L'ÉCRITURE ══════════════════════════════════════

test('⑤ `albedoCrop` DÉLÈGUE à `albedoCropMat` — une seule écriture du mix', () => {
  assert.match(ECLAIRAGE, /vec3 albedoCropMat\(vec3 mapCol, vec3 base, float gris, float teinte, float ombre\)\s*\{\s*return mix\(base \* gris, mapCol \* ombre, teinte\);/)
  assert.match(ECLAIRAGE, /return albedoCropMat\(mapCol, base, gris, teinte, natOmbrePeinture\(natLuminance\(fond\)\)\);/)
  // ⛔ et le `mix` ne doit exister qu'UNE fois dans la fonction déléguée
  const mixs = (ECLAIRAGE.match(/mix\(fond, mapCol \* natOmbrePeinture/g) || []).length
  assert.equal(mixs, 0, 'l’ancienne écriture directe est encore là — deux lois à tenir d’accord')
})

test('⑤ le nuanceur du globe est INJECTÉ, pas recopié', () => {
  assert.match(GLOBE, /\$\{GLSL_MATIERE\}/)
  assert.equal((GLOBE.match(/vec2 uvMatiere/g) || []).length, 0, 'uvMatiere est recopiée dans globe.js — deux écritures')
  assert.equal((GLOBE.match(/vec3 normaleMatiere/g) || []).length, 0, 'normaleMatiere est recopiée dans globe.js')
})

// ══════════ ⑥ LE BRANCHEMENT — UN UNIFORME QUE PERSONNE NE TRANSMET ════════
//
// ⚠️ **C'EST LA FAIBLESSE RÉCURRENTE DE CE CHANTIER**, et c'était EXACTEMENT la
// panne de cette option : `setMaterialMode` posait bien la texture sur le socle,
// et rien ne la portait au globe.

test('⑥ `contexteCrop` lit le MATÉRIAU vivant, jamais `params`', () => {
  const m = MAIN.match(/function matiereDuCrop\(\) \{[\s\S]*?\n\}/)
  assert.ok(m, '`matiereDuCrop` a disparu — le sélecteur ne traverse plus')
  const corps = m[0]
  for (const champ of ['matMap: m.map', 'matNormal: m.normalMap', 'matRepeat: m.map.repeat?.x', 'matBump: m.normalScale?.x']) {
    assert.ok(corps.includes(champ), `\`${champ}\` manque : le globe ne recevrait pas cette grandeur`)
  }
  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT LA GARDE** : ils NOMMENT `params`
  // pour expliquer pourquoi on ne le lit pas, et une garde qui les compterait
  // serait rouge pour la raison inverse de celle qu'elle surveille.
  // ⚠️ PAS DE CLASSE « TOUT SAUF LE SAUT DE LIGNE » ÉCRITE AVEC UNE SÉQUENCE
  // D'ÉCHAPPEMENT : mon script d'édition en a déjà mangé deux ce soir (le « \n »
  // du journal de la sonde, puis celle-ci), et un retour à la ligne véritable
  // dans une expression régulière fait mourir tout le fichier de test — 29
  // assertions perdues d'un coup, sur une erreur de syntaxe. On découpe.
  const code = corps.split('\n').map((l) => l.replace(/\s*\/\/.*$/, '')).join('\n')
  assert.equal(/params\.terrainMat|params\.terrainSurfaceBump/.test(code), false,
    'il lit `params` — or `repeat.x` porte déjà `preset.repeat × scale × zoomRepeat`, et `params` ne le porte pas')
})

// ⛔ **LE VERRE DOIT SORTIR PAR LE HAUT**, sinon choisir « Verre » après une
// matière opaque laisserait le globe peindre la matière PRÉCÉDENTE :
// `setMaterialMode('glass')` remplace `mesh.material` et ne touche pas `map`.
test('⑥ le verre est refusé par `matiereDuCrop`, et la raison est le matériau non muté', () => {
  const m = MAIN.match(/function matiereDuCrop\(\) \{[\s\S]*?\n\}/)[0]
  assert.match(m, /terrain\.materialMode === 'glass'/)
  assert.match(m, /!m\?\.map/, 'sans cette garde, une texture pas encore chargée passerait pour posée')
  // et `setMaterialMode` sort bien avant de toucher `map` / `uTint` sur le verre
  const sm = TERRAIN.match(/setMaterialMode\(id, params = \{\}\) \{[\s\S]*?\n {4}\}/)
  assert.ok(sm, 'setMaterialMode a changé de forme')
  const avantRetour = sm[0].slice(0, sm[0].indexOf('this.mesh.material = this.glassMaterial'))
  assert.equal(/m\.map =|uTint\.value/.test(avantRetour), false,
    'la branche verre ne touche ni `map` ni `uTint` — c’est pourquoi le globe doit la refuser lui-même')
})

test('⑥ les dix champs sont sous surveillance par image (`CHAMPS_HABILLAGE`)', () => {
  for (const c of ['matMap', 'matNormal', 'matRepeat', 'matBump', 'matNoiseOn', 'matNoiseCut', 'matNoiseSoft', 'matNoiseScale', 'matAboveZero', 'matBandeM']) {
    assert.ok(CHAMPS_HABILLAGE.includes(c), `\`${c}\` absent : la vignette resterait inerte jusqu’au prochain changement de LIEU`)
  }
})

test('⑥ `poserHabillage` reçoit les dix et écrit les douze uniformes', () => {
  const debut = GLOBE.indexOf('  poserHabillage({')
  const fin = GLOBE.indexOf('  retirerHabillage()', debut)
  assert.ok(debut > 0 && fin > debut)
  const corps = GLOBE.slice(debut, fin)
  for (const a of ['matMap = null', 'matNormal = null', 'matRepeat = null', 'matBump = null', 'matNoiseOn = null', 'matBandeM = null']) {
    assert.ok(corps.includes(a), `l’argument \`${a}\` manque à poserHabillage`)
  }
  for (const u of ['uMatOn', 'uMatMap', 'uMatNormal', 'uMatNormalOn', 'uMatRepeat', 'uMatBump', 'uMatNoiseOn', 'uMatNoiseCut', 'uMatNoiseSoft', 'uMatNoiseScale', 'uMatAboveZero', 'uMatBandeM']) {
    assert.ok(corps.includes(`u.${u}.value`), `\`${u}\` n’est pas posé`)
  }
})

// ══════════ ⑦ L'ALLER-RETOUR : L'ÉTAT DE REPOS EST UNE SEULE ÉCRITURE ══════

test('⑦ `retirerHabillage` rend les douze uniformes à `MATIERE_MONDE_ETEINTE`', () => {
  const debut = GLOBE.indexOf('  retirerHabillage()')
  assert.ok(debut > 0)
  const corps = GLOBE.slice(debut, debut + 12000)
  for (const [u, cle] of [['uMatOn', 'on'], ['uMatNormalOn', 'normalOn'], ['uMatRepeat', 'repeat'], ['uMatBump', 'bump'],
    ['uMatNoiseOn', 'noiseOn'], ['uMatNoiseCut', 'noiseCut'], ['uMatNoiseSoft', 'noiseSoft'], ['uMatNoiseScale', 'noiseScale'],
    ['uMatAboveZero', 'aboveZero'], ['uMatBandeM', 'bandeM']]) {
    assert.ok(corps.includes(`u.${u}.value = MATIERE_MONDE_ETEINTE.${cle}`),
      `\`${u}\` n’est pas rendu depuis le module — un littéral recopié finit par diverger (contrat ⑨i)`)
  }
  assert.ok(corps.includes('u.uMatMap.value = null') && corps.includes('u.uMatNormal.value = null'),
    'les deux textures doivent être relâchées : sinon elles restent en mémoire vidéo sur un crop mort')
})

test('⑦ le constructeur part du MÊME objet, pas d’un littéral', () => {
  for (const cle of ['on', 'normalOn', 'repeat', 'bump', 'noiseOn', 'noiseCut', 'noiseSoft', 'noiseScale', 'aboveZero', 'bandeM']) {
    assert.ok(GLOBE.includes(`MATIERE_MONDE_ETEINTE.${cle}`), `le défaut \`${cle}\` est recopié en dur quelque part`)
  }
  // ⚠️ `repeat` vaut 1 et non 0 : un 0 laissé traîner étirerait UN texel sur tout
  // le bloc le jour où quelqu'un allume la matière sans poser l'habillage.
  assert.equal(MATIERE_MONDE_ETEINTE.repeat, 1)
  assert.equal(MATIERE_MONDE_ETEINTE.on, 0)
  assert.equal(MATIERE_MONDE_ETEINTE.normalOn, 0)
})

// ⚠️ **LA GARDE DU BIT PRÈS** : `uMatOn` à 0, le nuanceur doit retomber sur la
// ligne d'origine. Le test lit le TEXTE de la branche plutôt que de l'espérer.
test('⑦ `uMatOn` à 0 laisse `baseMat`, `teinteMat` et `nMat` au repos', () => {
  const i = GLOBE.indexOf('vec3 baseMat = uAlbedoBase;')
  assert.ok(i > 0, 'la branche de matière a bougé')
  const bloc = GLOBE.slice(i, GLOBE.indexOf('float nduCrop', i))
  assert.match(bloc, /vec3 baseMat = uAlbedoBase;/)
  assert.match(bloc, /float teinteMat = uAlbedoTeinte;/)
  assert.match(bloc, /vec3 nMat = nMonde;/)
  assert.match(bloc, /if \(uMatOn > 0\.5 && dedansCrop > 0\.0\)/)
})

// ⚠️ **ET L'ÉCLAIRAGE DOIT PASSER PAR `nMat`**, sinon « Relief de la matière »
// n'aurait rien à moduler : c'est la normale perturbée qui reçoit le soleil.
test('⑦ le soleil et l’appoint du crop lisent `nMat`, pas `nMonde`', () => {
  assert.match(GLOBE, /irradianceCrop\(dot\(nMat, uSoleilDir\), nduCrop/)
  assert.match(GLOBE, /irradianceAppoint\(dot\(nMat, uAppointDir\), uAppointIrr\)/)
  assert.match(GLOBE, /float nduCrop = dot\(nMat, uHemiHaut\);/)
  // ⛔ mais le TERMINATEUR de la planète reste sur nMonde : la nuit n'est pas
  // une affaire de matière, et la donner à nMat ferait vibrer la ligne d'ombre
  // au grain de la toile.
  assert.match(GLOBE, /float day = smoothstep\(-0\.22, 0\.16, dot\(nMonde, uSunDir\)\);/)
})

// ══════════ ⑧ LA TABLE DES VERDICTS COMMANDE L'INTERFACE ═══════════════════

test('⑧ la table dit ce qui agit, et chaque refus porte son MOTIF', () => {
  for (const [cle, p] of Object.entries(POSTES_MATIERE_SPHERE)) {
    assert.equal(typeof p.surSphere, 'boolean', `${cle} : verdict manquant`)
    assert.ok(p.motif && p.motif.length > 20, `${cle} : un refus sans motif écrit est un refus qu’on ne peut pas contester`)
    assert.ok(p.label, `${cle} : libellé manquant`)
  }
  // hors sphère, TOUT agit — le socle a un vrai matériau PBR
  for (const cle of Object.keys(POSTES_MATIERE_SPHERE)) assert.equal(matiereAgit(cle, false), true)
  // sur la sphère : la rugosité et les cinq du verre se cachent
  assert.equal(matiereAgit('terrainMatRoughness', true), false)
  assert.equal(matiereAgit('terrainGlassFrost', true), false)
  assert.equal(matiereAgit('terrainMatScale', true), true)
  assert.equal(matiereAgit('terrainSurfaceBump', true), true)
  assert.equal(matiereAgit('terrainMatNoise', true), true)
  assert.equal(matiereAgit('terrainMatAboveZero', true), true)
  // un réglage inconnu agit — on ne cache jamais par défaut
  assert.equal(matiereAgit('inconnu', true), true)
})

test('⑧ seul le verre perd sa vignette sur la sphère, et les quinze autres la gardent', () => {
  assert.equal(vignetteAgit('glass', true), false)
  assert.equal(vignetteAgit('glass', false), true)
  for (const m of MATERIALS) {
    if (m.id === 'glass') continue
    assert.equal(vignetteAgit(m.id, true), true, `${m.id} ne doit pas se cacher`)
  }
  assert.equal(vignetteAgit('', true), true, '« Aucune » reste toujours offerte : c’est le retrait')
})

// ⚠️ **LE PANNEAU EXÉCUTE LA TABLE, IL NE LA PARAPHRASE PAS.** Le test lit le
// source du panneau : c'est le seul moyen de garantir qu'un curseur ajouté
// demain ne réapparaisse pas inerte.
test('⑧ le panneau branche `visibleWhen` sur la table pour chaque réglage', () => {
  assert.match(PANNEAU, /import \{ matiereAgit, vignetteAgit \} from '\.\.\/monde\/matiere-crop\.js'/)
  assert.match(PANNEAU, /visibleWhen\(t, \(\) => vignetteAgit\(m\.id, ctx\.surSphere\?\.\(\) === true\)\)/)
  for (const cle of ['terrainMatScale', 'terrainSurfaceBump', 'terrainMatRoughness', 'terrainMatNoise', 'terrainMatAboveZero']) {
    assert.ok(PANNEAU.includes(`'${cle}'`), `le curseur \`${cle}\` n’est pas rattaché à la table`)
  }
  assert.match(PANNEAU, /visibleWhen\(row, \(\) => matiereAgit\(c\.k, ctx\.surSphere\?\.\(\) === true\)\)/)
  // ⚠️ le piège de R21 : `visibleWhen` NE REND PAS le nœud
  assert.match(PANNEAU, /const siAgit = \(row, cle\) => \{ visibleWhen\(row, [\s\S]{0,120}\); return row \}/)
})

test('⑧ `main.js` fournit le même prédicat de sphère aux DEUX panneaux', () => {
  const n = (MAIN.match(/surSphere: \(\) => terreUniqueBranchee,/g) || []).length
  assert.equal(n, 2, 'lumière et matière doivent répondre au MÊME drapeau — deux prédicats divergeraient')
})

// ══════════ ⑨ LE COÛT MESURÉ, FIGÉ POUR QUE LE REFUS SOIT CONTESTABLE ══════
//
// ⚠️ **UN REFUS SANS CHIFFRE EST UN GOÛT.** La constante porte la mesure qui
// borne le verre ; si quelqu'un la conteste, il sait quoi remesurer.
test('⑨ le coût de la transmission est écrit, aux deux altitudes', () => {
  for (const alt of ['crop', 'orbite']) {
    const c = COUT_TRANSMISSION[alt]
    assert.ok(c.baseMs > 0 && c.avecMs > c.baseMs, `${alt} : mesure incohérente`)
    assert.ok(Math.abs(c.avecMs / c.baseMs - c.facteur) < 0.01, `${alt} : le facteur ne correspond pas à ses deux termes`)
    assert.ok(c.facteur > 3, `${alt} : un facteur sous 3 ne justifierait plus le refus — remesurer avant de conclure`)
  }
})
