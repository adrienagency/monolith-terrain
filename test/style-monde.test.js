// R28 — UN SEUL STYLE POUR TOUTE LA TERRE, ET LA BANDE VERTE DES CÔTES
//
// ══════════ CE QUE CE FICHIER VÉRIFIE ══════════════════════════════════════
//
// > **Adrien, 2026-09-01 :** *« Pourquoi y a-t-il une zone verte tout autour des
// > côtes ? »* · *« Je veux que ce soit le style qui est utilisé en dessous de
// > Z10 qui habille toute la Terre — excepté l'eau, qu'on simule au-dessus de
// > Z10 comme tu le fais avec la vue orbitale. »*
//
// ⛔ **LA CAUSE EST `natRampT`, ET ELLE EST MESURÉE.** Quatre uniformes de
// colorisation — `uHeightPivot`, `uHeightContrast`, `uReliefBas`, `uLandMax` —
// sont mesurés SUR LE CROP et **partagés par les 1 700 matériaux de tuile** du
// globe. Relevé dans l'application vivante (`scripts/diag-r28-bande.mjs`, pilote
// NVIDIA RTX 3080) :
//
// | | La Réunion z12 | Bornéo z10 | Bornéo z13 |
// |---|---|---|---|
// | `uReliefBas` / `uLandMax` | 107,5 / 3 009,6 m | −93,2 / 3 957,3 m | −66,7 / 650,6 m |
// | pivot / contraste | 0,41 / 2,2 | 0,14 / 3,3 | 0,44 / 6,4 |
// | `natRampT` saturé à 0 jusqu'à | **637,8 m** | — | **192,9 m** |
//
// ➡️ **Toute terre sous 637,8 m — PARTOUT SUR LA PLANÈTE — recevait le PREMIER
// texel du LUT**, c'est-à-dire la première butée de la palette : `#93a074`,
// relevé `rgb(147, 160, 115)`. Un olive vert. **C'est la bande.**
//
// ══════════ LE DÉPARTAGE, QUI EST LE CŒUR DE LA TÂCHE ══════════════════════
//
// D15 range les postes en deux : ce qui se RECALCULE depuis la tuile peut
// devenir global ; ce qui exige une texture CUITE sur l'emprise du crop ne le
// peut pas. Ce fichier vérifie les deux côtés :
//   · le régime de rampe, le budget du fond marin et le peigne des crêtes
//     deviennent GLOBAUX — chacun a une source qui existe partout ;
//   · le voile aérien et l'occupation du sol sont BORNÉS au crop — le premier
//     parce que sa distance `fd` n'a pas de sens hors de l'emprise, la seconde
//     parce que sa mosaïque n'y existe pas.
//
// ⚠️ **PROTOCOLE : ON EXÉCUTE, ON NE CHERCHE PAS UN NOM.** Le texte GLSL est
// extrait du nuanceur, traduit mécaniquement et ÉVALUÉ contre les jumeaux JS —
// c'est la discipline de `crop-rampe` et de `crop-naturel`, et c'est ce qui a
// évité huit assertions vertes sur de la prose.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  RAMPE_MONDE,
  GRADE_MONDE,
  REGIME_MONDE,
  GLSL_REGIME_MONDE,
  rampeTMonde,
} from '../src/monde/rampe-crop.js'
import {
  GLSL_NATUREL,
  NATUREL_MONDE,
  GAIN_PEIGNE_MONDE,
  GAIN_OMBRE_MONDE,
  peigneMondeCanal,
  plancherPivot,
  rampeT,
} from '../src/monde/naturel-crop.js'
import { MONDE_NU, MONDE_ECLAIRE, POSTES_MONDE } from '../src/monde/planete-eclairee.js'

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')

/**
 * Le nuanceur, commentaires RETIRÉS.
 *
 * ⚠️ **CE N'EST PAS UNE COQUETTERIE.** La Tâche K ter a trouvé une assertion
 * verte parce qu'elle lisait une formule DANS UN COMMENTAIRE, et ce fichier-ci
 * cite ses propres formules dans les siens. Tout ce qui suit lit le CODE.
 */
const FRAG_NU = (() => {
  const i = GLOBE_SRC.indexOf('void main() {')
  assert.ok(i > 0, 'le main() du fragment est introuvable')
  return GLOBE_SRC.slice(i)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
})()

const CLAMP = (x, a, b) => Math.min(b, Math.max(a, x))
const MIX = (a, b, t) => a * (1 - t) + b * t

// ══════════ ① LE RÉGIME DU MONDE EST DÉRIVÉ, JAMAIS ÉCRIT EN DUR ═══════════

test('①a REGIME_MONDE ne porte aucun littéral — il sort de RAMPE_MONDE et GRADE_MONDE', () => {
  // ⚠️ **C'EST LA DISCIPLINE QUE LA TÂCHE P11 A POSÉE SUR `uReliefBas`** : `5 600`,
  // `6 000`, `4,5` et `0,56` n'ont qu'UNE écriture. Deux littéraux jumeaux
  // divergent en silence — ce dépôt en porte déjà la cicatrice sur
  // `uContourInterval`.
  assert.equal(REGIME_MONDE.reliefBas, RAMPE_MONDE.terreBas - RAMPE_MONDE.creux)
  assert.equal(REGIME_MONDE.landMax, RAMPE_MONDE.terreHaut)
  assert.equal(REGIME_MONDE.profondeur, RAMPE_MONDE.profondeur)
  assert.equal(REGIME_MONDE.pivot, GRADE_MONDE.heightPivot)
  assert.equal(REGIME_MONDE.contraste, GRADE_MONDE.heightContrast)
  // et les valeurs relevées, pour que la table de l'en-tête soit vérifiable
  assert.equal(REGIME_MONDE.reliefBas, -6000)
  assert.equal(REGIME_MONDE.landMax, 5600)
})

test('①b le texte GLSL porte EXACTEMENT ces nombres — la source JS et le GPU s’accordent', () => {
  const lire = (nom) => {
    const m = new RegExp(`const float ${nom} = ([^;]+);`).exec(GLSL_REGIME_MONDE)
    assert.ok(m, `${nom} absent du texte GLSL`)
    return Number(m[1])
  }
  assert.equal(lire('MONDE_RELIEF_BAS'), REGIME_MONDE.reliefBas)
  assert.equal(lire('MONDE_LAND_MAX'), REGIME_MONDE.landMax)
  assert.equal(lire('MONDE_PROFONDEUR'), REGIME_MONDE.profondeur)
  assert.equal(lire('MONDE_CONTRASTE'), REGIME_MONDE.contraste)
  // ⚠️ **LE PIVOT DU TEXTE EST LE PIVOT PLANCHÉ, PAS LE PIVOT BRUT.** Le plancher
  // est évalué en JS parce que toutes ses entrées sont constantes : le GPU
  // calculerait soixante fois par seconde un nombre connu à la compilation.
  const amplitude = REGIME_MONDE.landMax - REGIME_MONDE.reliefBas
  const attendu = Math.max(REGIME_MONDE.pivot, plancherPivot((0 - REGIME_MONDE.reliefBas) / amplitude))
  assert.equal(lire('MONDE_PIVOT'), attendu)
  // et le plancher NE MORD PAS aux valeurs livrées — il est là pour une palette
  // future qui abaisserait le pivot, exactement ce qu'il existe pour empêcher
  assert.equal(attendu, REGIME_MONDE.pivot)
  assert.ok(plancherPivot((0 - REGIME_MONDE.reliefBas) / amplitude) < REGIME_MONDE.pivot)
})

test('①c `natRampTMonde` du nuanceur EST `rampeTMonde` — traduit et EXÉCUTÉ sur un balayage', () => {
  // ⚠️ **ON EXÉCUTE LE TEXTE, ON NE LE LIT PAS.** Une mutation qui remplacerait
  // `MONDE_PIVOT` par `MONDE_CONTRASTE` dans le corps passerait n'importe quelle
  // recherche de nom ; elle ne passe pas ceci.
  const corps = /float natRampTMonde\(float h\) \{([\s\S]*?)\n\}/.exec(GLSL_REGIME_MONDE)
  assert.ok(corps, 'natRampTMonde est introuvable dans le texte GLSL')
  const js = corps[1]
    .replace(/\bfloat\s+(\w+)\s*=/g, 'let $1 =')
    .replace(/\bclamp\s*\(/g, 'CLAMP(')
  const constantes = [...GLSL_REGIME_MONDE.matchAll(/const float (\w+) = ([^;]+);/g)]
  // eslint-disable-next-line no-new-func
  const f = new Function(
    'h', 'CLAMP', 'natRampT',
    `${constantes.map(([, n, v]) => `const ${n} = ${v};`).join('\n')}\n${js}`
  )
  let vus = 0
  for (let h = -6500; h <= 6000; h += 25) {
    assert.equal(f(h, CLAMP, rampeT), rampeTMonde(h), `h = ${h}`)
    vus++
  }
  assert.ok(vus > 400, `le balayage doit être dense : ${vus} points`)
})

// ══════════ ② LA BANDE VERTE — LE CHIFFRE, ET CE QUI LA SUPPRIME ═══════════

test('②a LE CHIFFRE DE LA BANDE : au régime du CROP, toute terre sous 637,8 m rend le PREMIER texel', () => {
  // ⚡ **RELEVÉ DANS L'APPLICATION VIVANTE**, La Réunion z12, `.banc/R28/bande.json`.
  // Ce test rejoue la loi du nuanceur sur ces quatre uniformes-là et retrouve la
  // saturation. Il ne prouve pas que la bande était verte — la palette le dit —
  // mais il prouve qu'elle était PLATE, et sur quelle épaisseur.
  const U = { reliefBas: 107.4638671875, landMax: 3009.6416015625, pivot: 0.41, contraste: 2.2 }
  const amplitude = U.landMax - U.reliefBas
  const hNorm = (h) => CLAMP((h - U.reliefBas) / amplitude, 0, 1)
  const pivot = Math.max(U.pivot, plancherPivot((0 - U.reliefBas) / amplitude))
  assert.equal(pivot, U.pivot, 'le plancher de pivot ne mord pas ici — sinon le chiffre change')
  const rampTCrop = (h) => rampeT(hNorm(h), pivot, U.contraste)
  for (const h of [0, 100, 300, 500, 600, 630]) {
    assert.equal(rampTCrop(h), 0, `${h} m devrait saturer à zéro`)
  }
  // la sortie de saturation, au mètre près
  const seuil = (pivot - 0.5 / U.contraste) * amplitude + U.reliefBas
  assert.ok(Math.abs(seuil - 637.8) < 0.5, `le seuil vaut ${seuil} m`)
  assert.ok(rampTCrop(seuil + 1) > 0, 'juste au-dessus du seuil la rampe doit repartir')
  // ⛔ **ET LE RÉGIME DU MONDE, LUI, NE SATURE PAS SUR LA MÊME TRANCHE.** C'est
  // ce que la correction rend aux alentours : de 0 à 637,8 m il étale 0,31 → 0,55.
  assert.ok(rampeTMonde(0) > 0.3, `au monde, le rivage vaut ${rampeTMonde(0)}`)
  assert.ok(rampeTMonde(637.8) - rampeTMonde(0) > 0.2,
    'le régime du monde doit ÉTALER la tranche que celui du crop écrase')
})

test('②b le nuanceur MÉLANGE les deux régimes sur `dedansCrop` — exécuté, pas cherché', () => {
  // ⚠️ **LA LIGNE DU CROP N'A PAS BOUGÉ**, et `crop-naturel` ⑤d continue de
  // l'exiger : R28 lui ADJOINT le régime du monde, il ne la remplace pas.
  assert.match(FRAG_NU, /float rampT = natRampT\(hNormRelief, pivot, uHeightContrast\);/)
  assert.match(FRAG_NU, /rampT = mix\(natRampTMonde\(h\), rampT, dedansCrop\);/)
  // et on l'EXÉCUTE aux deux bouts : dedans c'est le crop, dehors c'est le monde
  const m = /rampT = mix\(([^;]+)\);/.exec(FRAG_NU)
  // eslint-disable-next-line no-new-func
  const f = new Function('rampT', 'h', 'dedansCrop', 'MIX', 'natRampTMonde',
    `return MIX(${m[1].replace(/mix\(/g, 'MIX(')})`)
  assert.equal(f(0.77, 1234, 1, MIX, rampeTMonde), 0.77, 'dans le crop, la loi du crop, exactement')
  assert.equal(f(0.77, 1234, 0, MIX, rampeTMonde), rampeTMonde(1234), 'hors du crop, la loi du monde')
})

// ══════════ ③ L'EAU GARDE LE RENDU DE L'ORBITE AU LOIN ═════════════════════

test('③ le fond marin prend le budget du MONDE hors découpe, celui du crop dedans', () => {
  // > Adrien : « excepté l'eau, qu'on simule au-dessus de Z10 comme tu le fais
  // > avec la vue orbitale. »
  //
  // ⚡ **RELEVÉ : `uMerFondBudgetM = 113,3 m` à Bornéo z10.** Toute la planète
  // peignait donc son océan sur 113 mètres — tout ce qui dépasse le plateau
  // continental saturait sur `uOceanDeep`, d'un seul aplat.
  assert.match(FRAG_NU, /float dMerCrop = clamp\(-h \/ max\(uMerFondBudgetM, uPlancherRampeM\), 0\.0, 1\.0\);/)
  assert.match(FRAG_NU, /float dMerMonde = clamp\(-h \/ MONDE_PROFONDEUR, 0\.0, 1\.0\);/)
  assert.match(FRAG_NU, /float dMer01 = pow\(mix\(dMerMonde, dMerCrop, dedansCrop\), 0\.55\);/)
  // ⚠️ **UN SEUL `pow` PAR FRAGMENT**, comme avant : on mélange la profondeur
  // NORMALISÉE, pas la couleur ni le budget. Mélanger le budget aurait mis un
  // `mix` à l'intérieur d'une division.
  const bloc = /if \(uMerRampeOn > 0\.5 && sousEau\) \{(.*?)\} vec3 fondCrop|if \(uMerRampeOn > 0\.5 && sousEau\) \{(.*?)\}/.exec(FRAG_NU)
  assert.ok(bloc, 'le bloc du fond marin est introuvable')
  assert.equal((bloc[0].match(/pow\(/g) || []).length, 1, 'le bloc du fond marin ne doit faire qu’UN pow')
  // et le budget du monde EST celui de RAMPE_MONDE, pas un littéral de plus
  assert.match(GLSL_REGIME_MONDE, new RegExp(`const float MONDE_PROFONDEUR = ${RAMPE_MONDE.profondeur.toFixed(1)};`))
})

// ══════════ ④ CE QUI RESTE BORNÉ AU CROP, ET POURQUOI ══════════════════════

test('④a le voile aérien ne sort plus de la découpe — sa distance n’a pas de sens dehors', () => {
  // ⛔ `fd = clamp(length(qCrop), 0, 1)` est une distance au CENTRE DU CROP en
  // demi-côtés : hors de l'emprise elle dépasse 1, le clamp la fige à 1, et le
  // voile s'applique À PLEINE DISTANCE sur toute la planète. `retirerHabillage`
  // le dit déjà pour le crop MORT ; personne ne l'avait tiré pour le crop VIVANT.
  //
  // ⚡ MESURE, Bornéo z10, témoin nul à 0 pixel (`scripts/diag-r28-fuites.mjs`) :
  // éteindre `uHazeAmt` changeait **509 975 pixels — 49,80 % de l'image** — d'un
  // écart moyen de **20,54/255**, et l'écart-type de luminance MONTAIT de 32,66 à
  // 35,21 : le voile ne teintait pas, il APLATISSAIT.
  assert.match(FRAG_NU, /float hazeIci = uHazeAmt \* dedansCrop;/)
  assert.match(FRAG_NU, /natVoile\(hNormRelief, fd, hazeIci, uHazeAlt, uHazeDist\)/)
  assert.match(FRAG_NU, /natBrume\(col, natLuminance\(col\), veil, uHazeColor, hazeIci\)/)
  // ⚠️ **LES DEUX ENTRÉES, PAS UNE** : `natBrume` relève le contraste par
  // `hazeAmt` INDÉPENDAMMENT du voile (`lift = (1 − veil) · hazeAmt · 0,35`).
  // Ne borner que `veil` aurait laissé le relèvement de contraste sur la planète.
  assert.ok(!/natBrume\([^)]*uHazeAmt\)/.test(FRAG_NU), 'natBrume reçoit encore uHazeAmt brut')
})

test('④b l’occupation du sol reste bornée au crop — sa mosaïque n’existe pas ailleurs', () => {
  // D15 range `uSol` parmi ce qui NE PEUT PAS devenir global : `sUv` est bâti sur
  // `qCrop`, et la mosaïque est en ClampToEdge — hors emprise, sa dernière ligne
  // se prolongerait sur toute la planète estompée sans qu'aucune erreur ne soit
  // levée. C'est le piège que `uFondChamp` et `uAnalysis` documentent déjà.
  assert.match(FRAG_NU, /float k = min\(1\.0, lavis\.a \* uSolOpacite\) \* dedansCrop;/)
})

test('④c l’analyse CUITE garde la main dans le crop — les deux peignes ne s’additionnent jamais', () => {
  // ⚠️ Le laplacien fractionnaire du socle est meilleur que celui d'ici, et il
  // est déjà payé : là où `uAnalysis` existe, c'est elle qui peint.
  assert.match(FRAG_NU, /float partAnalyse = uAnalysisOn > 0\.5 \? dedansCrop : 0\.0;/)
  assert.match(FRAG_NU, /col = natPeigne\(col, peigneMondeRG\.x, peigneMondeRG\.y, uTexShade \* \(1\.0 - partAnalyse\)\);/)
  // et le peigne du CROP n'a pas bougé d'une ligne
  assert.match(FRAG_NU, /if \(uAnalysisOn > 0\.5 && uTexShade > 0\.001 && !sousEau\) \{ col = natPeigne\(col, anl\.r, anl\.g, uTexShade\); \}/)
})

// ══════════ ⑤ LE PEIGNE DU MONDE — LA LOI, ET SON PRIX EN LECTURES ═════════

test('⑤a `natPeigneMonde` du texte GLSL EST `peigneMondeCanal` — exécuté sur un balayage', () => {
  const corps = /float natPeigneMonde\(float ecart, float gain\) \{([\s\S]*?)\n\}/.exec(GLSL_NATUREL)
  assert.ok(corps, 'natPeigneMonde est introuvable dans GLSL_NATUREL')
  // eslint-disable-next-line no-new-func
  const f = new Function('ecart', 'gain', 'CLAMP', corps[1].replace(/\bclamp\s*\(/g, 'CLAMP('))
  let vus = 0
  for (let e = -2; e <= 2; e += 0.01) {
    for (const g of [0, 0.25, 1.1, 8]) {
      assert.equal(f(e, g, CLAMP), peigneMondeCanal(e, g), `ecart ${e} gain ${g}`)
      vus++
    }
  }
  assert.ok(vus > 1000, `balayage trop maigre : ${vus}`)
  // ⚠️ **LE NEUTRE EST EXACT** : à gain nul le canal vaut 0,5, `natEcartPeigne`
  // rend 0,5, et `natSoftLight(c, 0,5)` rend `c` AU BIT PRÈS. C'est la garde du
  // poste, et elle est dans la VALEUR autant que dans la garde de branche.
  assert.equal(f(12345, 0, CLAMP), 0.5)
})

test('⑤b les gains sont NEUTRES À ZÉRO, et ceux qui sont livrés ne le sont pas', () => {
  assert.equal(peigneMondeCanal(3.7, 0), 0.5)
  assert.ok(GAIN_PEIGNE_MONDE > 0, 'le peigne du monde est éteint')
  assert.ok(GAIN_OMBRE_MONDE > 0, 'l’ombrage du peigne du monde est éteint')
  // et ils arrivent au nuanceur en FLOTTANTS GLSL : un entier nu ne se lie pas.
  // ⛔ C'est arrivé — `8` au lieu de `8.0` a rendu « no matching overloaded
  // function found », le fragment refusait de se lier, et PLUS AUCUNE tuile ne se
  // dessinait. Le banc différentiel n'y voyait rien : c'est la console qui l'a dit.
  assert.match(GLOBE_SRC, /natPeigneMonde\(courbure, \$\{GAIN_PEIGNE_MONDE\.toFixed\(2\)\}\)/)
  assert.match(GLOBE_SRC, /natPeigneMonde\(ecartOmbre, \$\{GAIN_OMBRE_MONDE\.toFixed\(2\)\}\)/)
  assert.match(GAIN_PEIGNE_MONDE.toFixed(2), /\./)
})

test('⑤c LE PRIX EST UNE SEULE LECTURE DE PLUS — les quatre voisins sont RÉUTILISÉS', () => {
  // ⚡ **C'EST TOUT L'ARGUMENT DE D15 SUR CE POSTE** : la normale par fragment lit
  // déjà les quatre voisins ; un laplacien discret demande les mêmes quatre PLUS
  // le centre. Si quelqu'un refait des lectures au lieu de réutiliser, ce test
  // rougit — et le coût mesuré (+0,013 à +0,017 ms) cesse d'être vrai.
  const i = FRAG_NU.indexOf('if (uNormaleFineOn > 0.5) {')
  assert.ok(i > 0, 'le bloc de la normale fine est introuvable')
  const bloc = FRAG_NU.slice(i, FRAG_NU.indexOf('float partAnalyse', i))
  assert.equal((bloc.match(/hauteurEchant\(/g) || []).length, 5,
    'le bloc doit faire EXACTEMENT cinq lectures : les quatre voisins et le centre')
  assert.match(bloc, /float hCentre = hauteurEchant\(vUv, qCrop\);/)
  // ⚠️ **LE SIGNE : POSITIF SUR UNE CRÊTE.** `Σvoisins − 4·centre` est positif
  // dans un TALWEG ; le canal du socle est positif sur une croupe CONVEXE.
  assert.match(bloc, /float courbure = \(4\.0 \* hCentre - hUp - hUm - hVp - hVm\) \* k;/)
  // ⚠️ **ET C'EST LE MÊME `k` QUE LA PENTE** : la courbure sort en écart de pente,
  // sans dimension. Un laplacien laissé en mètres changerait de force à chaque
  // frontière de niveau de tuile.
  assert.match(bloc, /float k = uUnitesParMetre \/ \(2\.0 \* pas \* uniteParUv\);/)
  // ⚠️ **UNE SEULE LAMPE, HISSÉE** — deux lampes à tenir d'accord, c'est la faute
  // que ce fichier a payée sur `uContourInterval`.
  assert.equal((bloc.match(/lampeReliefMonde\(/g) || []).length, 1)
})

// ══════════ ⑥ LE PEIGNE SURVIT AU CROP — sinon la moitié ④ ne se voit pas ══

test('⑥a `MONDE_NU.texShade` EST `NATUREL_MONDE.texShade` — deux écritures ne peuvent pas diverger', () => {
  assert.equal(MONDE_NU.texShade, NATUREL_MONDE.texShade)
  assert.equal(MONDE_NU.texShade, 0, 'drapeau baissé, le peigne du monde doit être éteint')
})

test('⑥b drapeau LEVÉ, `retirerHabillage` REND le peigne au repos du monde, pas à zéro', () => {
  // ⛔ **C'EST ICI QUE LA MOITIÉ ④ SE REFERMAIT.** `retirerHabillage` est appelé à
  // CHAQUE mort du crop, c'est-à-dire chaque fois qu'on remonte au-dessus de
  // 32 274 m — donc précisément dans la vue qu'Adrien appelle « au-dessus de
  // Z10 ». Rendre zéro y aurait éteint le peigne du monde au moment même où on le
  // regarde. Même patron, même raison et même ligne que `uNormaleFineOn`.
  assert.equal(MONDE_ECLAIRE.texShade, 1)
  assert.match(GLOBE_SRC, /u\.uTexShade\.value = styleMonde\(this\.planeteEclairee\)\.texShade/)
  assert.match(GLOBE_SRC, /uTexShade: \{ value: styleMonde\(this\.planeteEclairee\)\.texShade \}/)
})

test('⑥c le départage de D15 est mis à jour, et il porte son motif', () => {
  // ⚠️ **LE TABLEAU EST UN RELEVÉ DATÉ, PAS UN ÉTAT COURANT** — `plan-fusion.md`
  // le dit après que R24 y eut trouvé une contradiction. R28 en corrige deux
  // lignes, avec la mesure qui les fonde.
  assert.equal(POSTES_MONDE.uTexShade?.global, true)
  assert.match(POSTES_MONDE.uTexShade.motif, /uTex|hauteur|laplacien/i)
  assert.equal(POSTES_MONDE.uRampCropOn.global, true)
  assert.equal(POSTES_MONDE.uAnalysisOn.global, false)
  assert.equal(POSTES_MONDE.uHabOn.global, false)
})
