// LE CROP SEUL AU REPOS — Tâche N du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// **Adrien, 2026-08-22** : « Tout ce qui est en dehors du crop ne doit pas
// s'afficher. Ça ne s'affiche que si on dézoome, puis ça recrop quand la vue est
// stabilisée. On ne calcule donc pas les éléments hors crop sauf si dézoom ou
// zoom pour faire la transition. »
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LA LOI DU REPOS — l'écart est LOGARITHMIQUE (une échelle, pas des
//      mètres), une altitude non finie ou non positive CONSERVE l'état, et
//      l'automate démarre AU REPOS.
//   ② L'HYSTÉRÉSIS EST ASYMÉTRIQUE — une image pour réveiller, `IMAGES_CALME`
//      pour rendormir. C'est le seul paramètre qui décide du battement, et le
//      seuil du socle a déjà produit **onze bascules là où il en fallait une**.
//   ③ LES DEUX NOMBRES TIENNENT LA MESURE — rejeu d'une traîne d'amortissement
//      calée sur la trace de l'application vivante (pic `2,22 × 10⁻²`, rapport
//      0,970 par image, encore `7,7 × 10⁻¹¹` après 603 images) : **DEUX
//      bascules, pas quatre**. Et le geste de molette le plus doux mesuré
//      (`4,67 × 10⁻⁴`) RÉVEILLE — un seuil qui le manquerait serait un seuil qui
//      ne sert à rien.
//   ④ `oublier` — l'orbite ne laisse pas de référence derrière elle.
//   ⑤ L'ESTOMPAGE — `poserRepos` force 1, l'ORBITE PRIME, et **la loi n'est pas
//      touchée** : `estompageTerre` rend exactement ce qu'elle rendait.
//   ⑥ LE BRANCHEMENT — le repos atteint SES DEUX destinataires (l'estompage ET
//      `globe.poserCropSeul`), jamais sans crop posé, jamais hors surface.
//   ⑦ LE GLOBE — sur un VRAI quadtree, avec un vrai réseau bouché : hors crop,
//      une tuile n'est ni parcourue, ni demandée, ni maillée, ni dessinée. Et le
//      drapeau éteint rend le parcours d'avant, tuile pour tuile.
//   ⑧ LE BRANCHEMENT DE `main.js` — vérifié sur le TEXTE, comme les Tâches G et
//      I le font déjà : **aucun test de ce dépôt ne charge `main.js`**.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que l'image qui en
// sort soit belle, et que la transition ne se voie pas comme un à-coup. Seul
// l'écran le dit — l'Étape 6 de la tâche est là pour ça, et son compte rendu
// aussi.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

import {
  IMAGES_CALME,
  SEUIL_BOUGE_LOG,
  creerVeilleRepos,
} from '../src/monde/veille-repos.js'
import { creerVeilleEstompage, estompageTerre } from '../src/monde/estompage-terre.js'
import { creerVeilleCrop } from '../src/monde/branchement-crop.js'
import { ALT_ESTOMPAGE_FIN_M } from '../src/monde/estompage-terre.js'
import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// ⚠️ **L'ALTITUDE DE TEST DOIT SATISFAIRE DEUX CONDITIONS À LA FOIS, ET ELLES
// NE SONT PAS LA MÊME.** Le crop n'existe que SOUS `SEUIL_NAISSANCE_M`
// (32 274 m), et l'estompage n'est strictement entre 0 et 1 qu'AU-DESSUS de
// `ALT_ESTOMPAGE_FIN_M` (19 365 m). C'est l'intersection des deux qui montre le
// défaut : un crop posé, et des alentours dessinés AUTOUR, au repos.
const ALT_BLOC = (ALT_ESTOMPAGE_FIN_M + SEUIL_NAISSANCE_M) / 2

// ══════════════════════════════════════════════════════════════════ ① la loi

test('① l’écart est LOGARITHMIQUE : le même rapport réveille à toute altitude', () => {
  // ⚠️ **UN SEUIL EN MÈTRES SERAIT UN SEUIL PAR ALTITUDE.** Le même facteur
  // multiplicatif doit compter pareil à 12 km et à 3 000 km — sinon le même
  // geste de molette réveille en haut et pas en bas.
  const facteur = Math.exp(SEUIL_BOUGE_LOG * 4)
  for (const base of [12_000, 40_000, 3_000_000]) {
    const v = creerVeilleRepos()
    v.maj(base)
    for (let i = 0; i < IMAGES_CALME + 5; i++) v.maj(base)
    assert.equal(v.auRepos, true, `${base} m : la veille ne se pose pas`)
    v.maj(base * facteur)
    assert.equal(v.auRepos, false, `${base} m : le même rapport ne réveille pas`)
  }
})

test('① un écart SOUS le seuil ne réveille pas, si grand soit-il en mètres', () => {
  // 3 000 km × (e^(S/2) − 1) ≈ 150 m d'écart absolu : énorme en mètres, nul en
  // échelle. C'est exactement l'inverse à 12 km, et c'est le point.
  const v = creerVeilleRepos()
  const base = 3_000_000
  v.maj(base)
  v.maj(base * Math.exp(SEUIL_BOUGE_LOG / 2))
  assert.equal(v.auRepos, true, 'un demi-seuil réveille')
})

test('① une altitude non finie, nulle ou négative CONSERVE l’état', () => {
  // ⚠️ Même contrat que `socleVisible` et `estompageTerre` : une panne de
  // mesure ne peut pas être une raison de rallumer la Terre autour. Et un
  // `log(0)` ferait `−Infinity`, donc un écart infini, donc un mouvement
  // PERMANENT — l'exact contraire de ce que la panne devrait produire.
  for (const mauvais of [NaN, Infinity, -Infinity, undefined, null, '12000', 0, -1]) {
    const v = creerVeilleRepos()
    v.maj(ALT_BLOC)
    assert.equal(v.maj(mauvais), true, `${String(mauvais)} : l’état n’est pas conservé`)
    assert.equal(v.auRepos, true)
  }
  // et depuis l'état « en mouvement », il reste en mouvement
  const v = creerVeilleRepos()
  v.maj(ALT_BLOC)
  v.maj(ALT_BLOC * 2)
  assert.equal(v.auRepos, false)
  assert.equal(v.maj(NaN), false, 'un NaN rendort la vue')
})

test('① l’automate DÉMARRE au repos, et la première image n’a pas d’écart', () => {
  // ⚠️ Démarrer « en mouvement » ferait dessiner la planète entière autour du
  // crop pendant la demi-seconde qui suit l'arrivée — l'image qu'Adrien refuse,
  // au moment où elle se voit le plus.
  const v = creerVeilleRepos()
  assert.equal(v.auRepos, true, 'la veille démarre en mouvement')
  assert.equal(v.maj(ALT_BLOC), true, 'la première altitude réveille')
  assert.equal(v.bascules, 0, 'l’arrivée compte comme une bascule')
})

// ═══════════════════════════════════════════════════════ ② l'hystérésis

test('② UNE image au-dessus du seuil suffit à réveiller', () => {
  // ⚠️ **LA SORTIE DU REPOS EST INSTANTANÉE, ET C'EST LA MOITIÉ QUI COMPTE À
  // L'ŒIL** : les alentours doivent être là dès la première image du geste,
  // sinon la transition commence par un trou.
  const v = creerVeilleRepos()
  v.maj(ALT_BLOC)
  assert.equal(v.maj(ALT_BLOC * Math.exp(SEUIL_BOUGE_LOG * 2)), false)
  assert.equal(v.bascules, 1)
})

test('② il faut EXACTEMENT `IMAGES_CALME` images calmes pour se rendormir', () => {
  const v = creerVeilleRepos()
  v.maj(ALT_BLOC)
  const alt = ALT_BLOC * Math.exp(SEUIL_BOUGE_LOG * 2)
  v.maj(alt)
  assert.equal(v.auRepos, false)
  for (let i = 1; i < IMAGES_CALME; i++) {
    assert.equal(v.maj(alt), false, `rendormi à la ${i}ᵉ image calme, il en faut ${IMAGES_CALME}`)
  }
  assert.equal(v.maj(alt), true, `pas rendormi à la ${IMAGES_CALME}ᵉ image calme`)
  assert.equal(v.bascules, 2, 'un aller-retour doit compter DEUX bascules')
})

test('② une image agitée au milieu du calme REMET le compteur à zéro', () => {
  const v = creerVeilleRepos()
  v.maj(ALT_BLOC)
  let alt = ALT_BLOC
  const bouge = () => { alt *= Math.exp(SEUIL_BOUGE_LOG * 2); return v.maj(alt) }
  bouge()
  for (let i = 0; i < IMAGES_CALME - 1; i++) v.maj(alt)
  bouge() // une secousse à la dernière image avant le repos
  for (let i = 0; i < IMAGES_CALME - 1; i++) {
    assert.equal(v.maj(alt), false, 'le compteur de calme n’a pas été remis à zéro')
  }
  assert.equal(v.maj(alt), true)
})

test('② les deux nombres sont RÉGLABLES, et l’automate les respecte', () => {
  // ⚠️ Sans ce test, un `imagesCalme` ignoré (recopié depuis la constante du
  // module) survivrait à une campagne de mutation.
  const v = creerVeilleRepos({ seuilBougeLog: 1e-2, imagesCalme: 3 })
  v.maj(1000)
  // un écart de 5e-3 : au-dessus du seuil du module, SOUS celui qu'on passe
  assert.equal(v.maj(1000 * Math.exp(5e-3)), true, 'le seuil passé n’est pas lu')
  v.maj(1000 * Math.exp(0.05))
  assert.equal(v.auRepos, false)
  v.maj(1000 * Math.exp(0.05))
  v.maj(1000 * Math.exp(0.05))
  assert.equal(v.auRepos, false, 'rendormi avant les trois images demandées')
  assert.equal(v.maj(1000 * Math.exp(0.05)), true, 'le nombre d’images calmes passé n’est pas lu')
})

// ═══════════════════════════════════════════ ③ les nombres tiennent la mesure

// La traîne d'amortissement d'OrbitControls, telle qu'elle a été RELEVÉE dans
// l'application vivante le 2026-08-22 (`.banc/vues-N/AV-trace-orbite.json`) :
// géométrique, de rapport ≈ 0,970 par image, et **elle n'atteint jamais zéro** —
// encore `7,7 × 10⁻¹¹` par image 603 images (10 s) après la fin du geste.
const PIC_ORBITE = 2.2214692928630937e-2
const RAPPORT_TRAINE = 0.9704
// Le pic du geste DÉLIBÉRÉ le plus doux mesuré — une molette
// (`.banc/vues-N/AV-trace-molette.json`). ⚠️ C'est un PLAFOND pour le seuil.
const PIC_MOLETTE = 4.673510453424828e-4

function rejouerTraine(v, { alt0 = ALT_BLOC, pic, rapport, images }) {
  let alt = alt0
  let e = pic
  const journal = []
  for (let i = 0; i < images; i++) {
    alt *= Math.exp(e)
    journal.push(v.maj(alt))
    e *= rapport
  }
  return journal
}

test('③ une traîne d’amortissement ne fait que DEUX bascules, pas quatre', () => {
  // ⚠️ **C'EST LE TEST DU BATTEMENT, ET C'EST CELUI QUI COMPTE.** Le seuil du
  // socle a produit onze bascules là où il en fallait une ; ici la traîne est
  // MONOTONE, donc elle ne peut traverser le seuil qu'une fois — mais seulement
  // si l'hystérésis existe. Un `IMAGES_CALME` à zéro rendrait la vue « au repos »
  // à chaque image où la décroissance passe sous le seuil.
  const v = creerVeilleRepos()
  v.maj(ALT_BLOC)
  rejouerTraine(v, { pic: PIC_ORBITE, rapport: RAPPORT_TRAINE, images: 900 })
  assert.equal(v.auRepos, true, 'la traîne asymptotique laisse la vue éveillée pour toujours')
  assert.equal(v.bascules, 2, 'un geste doit faire un réveil et un endormissement, pas plus')
})

test('③ la traîne se calme en moins de six secondes à 60 Hz', () => {
  // ⚠️ **UNE BORNE, PAS UN CHIFFRE EXACT** : la mesure donne 140 images de
  // traîne au-dessus du seuil, plus `IMAGES_CALME`, soit 170. On garde 360 (six
  // secondes) pour que le test dise « ça se pose » et non « ça se pose à
  // l'image près », ce qui rendrait un réglage impossible à bouger.
  const v = creerVeilleRepos()
  v.maj(ALT_BLOC)
  const journal = rejouerTraine(v, { pic: PIC_ORBITE, rapport: RAPPORT_TRAINE, images: 600 })
  const posee = journal.indexOf(true)
  assert.ok(posee > 0, 'la vue ne se pose jamais')
  assert.ok(posee <= 360, `la vue met ${posee} images à se poser`)
})

test('③ le geste de molette le plus DOUX mesuré réveille bien la vue', () => {
  // ⚠️ **C'EST LA CONTRAINTE QUI FIXE LE PLAFOND DU SEUIL.** Vérifié sur la
  // trace : à `S = 10⁻³` la molette ne compte AUCUNE image au-dessus du seuil —
  // un vrai zoom passerait pour un repos, et les alentours n'apparaîtraient
  // jamais.
  assert.ok(SEUIL_BOUGE_LOG < PIC_MOLETTE, 'le seuil manque le geste le plus doux mesuré')
  const v = creerVeilleRepos()
  v.maj(ALT_BLOC)
  v.maj(ALT_BLOC * Math.exp(PIC_MOLETTE))
  assert.equal(v.auRepos, false, 'une molette ne réveille pas la vue')
})

test('③ au repos STRICT, l’écart calculé vaut zéro et la vue ne bouge pas', () => {
  // ⚠️ **BOUCLE SYNTHÉTIQUE, PAS UN RELEVÉ.** 3 216 images de la MÊME altitude
  // rejouée — ce n'est pas une mesure de 53 s dans l'application vivante (ce
  // nombre n'existe nulle part dans `.banc/vues-N/*.json`, constat groupé ③).
  // Ce que ça prouve : `ln(1) = 0` par construction, donc la loi ne dérive pas
  // d'elle-même sur une entrée immobile — une propriété de la fonction, pas un
  // fait relevé à l'écran.
  const v = creerVeilleRepos()
  for (let i = 0; i < 3216; i++) v.maj(ALT_BLOC)
  assert.equal(v.dernierEcart, 0)
  assert.equal(v.bascules, 0)
  assert.equal(v.auRepos, true)
})

// ═══════════════════════════════════════════════════════════════ ④ l'oubli

test('④ `oublier` empêche le résidu orbital de passer pour un mouvement', () => {
  const v = creerVeilleRepos()
  v.maj(ALT_BLOC)
  v.oublier()
  // le résidu orbital est d'un TOUT AUTRE ordre de grandeur (`veille-socle.js`,
  // §2) : sans l'oubli, cette image ferait un écart énorme
  assert.equal(v.maj(ALT_BLOC * 1000), true, 'le retour d’orbite réveille la vue')
  assert.equal(v.bascules, 0)
})

// ═════════════════════════════════════════════════════════════ ⑤ l'estompage

test('⑤ `poserRepos(true)` force UN — le crop seul', () => {
  const vus = []
  const v = creerVeilleEstompage({ appliquer: (f) => vus.push(f) })
  v.maj(ALT_BLOC)
  const loi = v.valeur
  assert.ok(loi > 0 && loi < 1, `l’altitude de test doit être DANS la bande (${loi})`)
  v.poserRepos(true)
  assert.equal(v.valeur, 1, 'le repos ne force pas le crop seul')
  v.poserRepos(false)
  assert.equal(v.valeur, loi, 'la sortie du repos ne rend pas la main à la loi')
  assert.deepEqual(vus, [loi, 1, loi])
})

test('⑤ l’ORBITE prime sur le repos — la Terre y est le sujet', () => {
  // ⚠️ Un repos qui primerait effacerait la planète au moment précis où elle
  // redevient le sujet : un écran vide. C'est le §6 du module, et il ne se
  // rediscute pas.
  const v = creerVeilleEstompage({ appliquer: () => {} })
  v.maj(ALT_BLOC)
  v.poserRepos(true)
  assert.equal(v.valeur, 1)
  v.poserMode(false)
  assert.equal(v.valeur, 0, 'le repos survit à l’orbite')
  v.poserMode(true)
  assert.equal(v.valeur, 1, 'le repos ne revient pas avec la surface')
})

test('⑤ `appliquer` n’est rappelé que sur CHANGEMENT, repos compris', () => {
  let n = 0
  const v = creerVeilleEstompage({ appliquer: () => { n++ } })
  v.maj(ALT_BLOC)
  const apresLoi = n
  for (let i = 0; i < 50; i++) v.poserRepos(true)
  assert.equal(n, apresLoi + 1, 'le repos réécrit l’uniforme à chaque image')
})

test('⑤ LA LOI N’EST PAS TOUCHÉE — `estompageTerre` rend ce qu’elle rendait', () => {
  // ⚠️ **C'EST LA GARDE DE LA TÂCHE G, ET ELLE EST EXPLICITE DANS LE CAHIER DES
  // CHARGES DE LA TÂCHE N** : « tu changes QUAND il s'applique, jamais sa loi ».
  // La loi est une fonction PURE de l'altitude : elle ne peut pas connaître le
  // repos, et ce test le dit en toutes lettres.
  assert.equal(estompageTerre({ altitudeEllipsoideM: SEUIL_MORT_M }), 0)
  assert.equal(estompageTerre({ altitudeEllipsoideM: SEUIL_MORT_M * 2 }), 0)
  const dedans = estompageTerre({ altitudeEllipsoideM: ALT_BLOC })
  assert.ok(dedans > 0 && dedans < 1)
  // et `auSeuil` — ce que l'altitude dit — ignore le repos, il n'y a qu'un
  // seul endroit où les deux se rencontrent, et c'est `poser()`
  const v = creerVeilleEstompage({ appliquer: () => {} })
  v.maj(ALT_BLOC)
  v.poserRepos(true)
  assert.equal(v.auSeuil, dedans, 'le repos a contaminé la loi')
})

// ═══════════════════════════════════════════════════════════ ⑥ le branchement

function globeDePapier() {
  const g = {
    cropSeul: null,
    posesCropSeul: 0,
    poserCrop: () => ({ cx: 0.5, cy: 0.5, demi: 0.01 }),
    construireParoisCrop: () => ({ refus: null }),
    poserHabillage: () => {},
    poserRampe: () => ({ refus: null }),
    poserMer: async () => ({ refus: null }),
    retirerCrop: () => {},
    poserCropSeul(v) { g.cropSeul = v; g.posesCropSeul++; return v },
  }
  return g
}

const ctxFactice = () => ({ centre: { lat: -21, lon: 55 }, zoom: 12, tuilesParBloc: 3, habillage: {} })

function veilleEstompageFactice() {
  const etat = { repos: null, poses: 0, modes: [] }
  return {
    etat,
    maj() {},
    poserMode(v) { etat.modes.push(!!v) },
    poserRepos(v) { etat.repos = v; etat.poses++ },
  }
}

test('⑥ le repos atteint SES DEUX destinataires, et sur la même image', () => {
  // ⚠️ Séparés, on aurait un dessin sans coût ou un coût sans dessin — les deux
  // moitiés du défaut que la tâche répare.
  const g = globeDePapier()
  const est = veilleEstompageFactice()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
  veille.maj(ALT_BLOC, 145.5)
  assert.equal(veille.pose, true, 'le crop n’est pas posé à l’altitude de test')
  assert.equal(veille.repos, true, 'le repos n’est pas relayé')
  assert.equal(g.cropSeul, true, '`poserCropSeul` n’a pas été appelée')
  assert.equal(est.etat.repos, true, '`poserRepos` n’a pas été appelée')
})

test('⑥ SANS CROP POSÉ, le repos n’est relayé à personne', () => {
  // ⚠️ **CE N'EST PAS UNE PRUDENCE, C'EST LA LOI** : sans découpe, l'estompage
  // plein efface la planète et ne met rien à la place — un écran vide.
  const g = globeDePapier()
  const est = veilleEstompageFactice()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
  // très au-dessus du seuil de mort : le socle, donc le crop, n'existe pas
  veille.maj(SEUIL_MORT_M * 4, 145.5)
  assert.equal(veille.pose, false)
  assert.equal(veille.repos, false, 'le repos est relayé sans crop')
  assert.equal(g.cropSeul, null, '`poserCropSeul` appelée sans crop')
  assert.equal(est.etat.repos, null, '`poserRepos` appelée sans crop')
})

test('⑥ un mouvement RETIRE le crop seul, et le retour au calme le remet', () => {
  const g = globeDePapier()
  const est = veilleEstompageFactice()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
  // ⚠️ **LE GESTE SE JOUE SUR LA DISTANCE DEPUIS LA TÂCHE R1**, pas sur
  // l'altitude : c'est elle que la veille du repos surveille (§1 du module).
  const D = 145.5
  veille.maj(ALT_BLOC, D)
  assert.equal(g.cropSeul, true)
  // un geste : une seule image suffit
  const D2 = D * Math.exp(SEUIL_BOUGE_LOG * 3)
  veille.maj(ALT_BLOC, D2)
  assert.equal(g.cropSeul, false, 'le geste ne rallume pas les alentours')
  assert.equal(veille.basculesRepos, 2)
  for (let i = 0; i < IMAGES_CALME; i++) veille.maj(ALT_BLOC, D2)
  assert.equal(g.cropSeul, true, 'la vue posée ne recroppe pas')
  assert.equal(veille.basculesRepos, 3)
})

test('⑥ le relais ne réécrit RIEN tant que l’état ne change pas', () => {
  const g = globeDePapier()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, repos: creerVeilleRepos() })
  for (let i = 0; i < 200; i++) veille.maj(ALT_BLOC, 145.5)
  assert.equal(g.posesCropSeul, 1, `${g.posesCropSeul} appels de \`poserCropSeul\` pour un seul état`)
})

test('⑥ l’ORBITE éteint le crop seul et fait OUBLIER l’altitude de référence', () => {
  const g = globeDePapier()
  const oublis = []
  const repos = creerVeilleRepos()
  const espion = { maj: (a) => repos.maj(a), oublier: () => { oublis.push(1); repos.oublier() } }
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, repos: espion })
  veille.maj(ALT_BLOC, 145.5)
  assert.equal(g.cropSeul, true)
  veille.poserMode(false)
  assert.equal(g.cropSeul, false, 'le crop seul survit à l’orbite')
  assert.equal(oublis.length, 1, 'l’orbite ne fait pas oublier la référence')
  // ⚠️ **DANS LES DEUX SENS** : ne l'oublier qu'à l'aller laisserait le retour
  // comparer une altitude de surface au dernier résidu orbital.
  veille.poserMode(true)
  assert.equal(oublis.length, 2, 'le retour en surface ne fait pas oublier la référence')
})

test('⑥ l’ORBITE ne POLLUE PAS les compteurs de la veille du repos', () => {
  // ⚠️ **CE N'EST PAS UN DÉTAIL DE COMPTABILITÉ.** `veilleRepos.bascules` est
  // l'instrument par lequel on compte le BATTEMENT à l'écran ; nourri du résidu
  // orbital, il compterait des réveils qui n'existent pas et le banc mentirait
  // — la classe d'erreur que le §0 du plan énumère huit fois.
  const g = globeDePapier()
  const repos = creerVeilleRepos()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, repos })
  veille.maj(ALT_BLOC, 145.5)
  const avant = repos.bascules
  veille.poserMode(false)
  // ⚠️ **LE RÉSIDU ORBITAL SE JOUE SUR LA DISTANCE DEPUIS LA TÂCHE R1** : en
  // orbite `controls.target` est le centre de la planète, la distance devient un
  // rayon orbital et elle VARIE à chaque image. Nourrir une distance constante
  // — ou pas de distance du tout — rendrait ce test vert sans rien lire.
  for (let i = 0; i < 200; i++) veille.maj(ALT_BLOC * (100 + i), 145.5 * (100 + i))
  assert.equal(repos.bascules, avant, `la veille du repos a compté ${repos.bascules - avant} bascules en orbite`)
  assert.equal(repos.dernierEcart, 0, 'la veille du repos a mesuré un écart sur un résidu orbital')
})

test('⑥ SANS veille de repos, le comportement est celui d’AVANT la tâche', () => {
  // ⚠️ Le patron « on élargit, on ne change pas le défaut » — il existe six fois
  // dans ce dépôt, et c'est la consigne D5 (le mode plat ne bouge pas).
  const g = globeDePapier()
  const est = veilleEstompageFactice()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est })
  for (let i = 0; i < 100; i++) veille.maj(ALT_BLOC, 145.5)
  assert.equal(veille.repos, false)
  assert.equal(g.cropSeul, null, '`poserCropSeul` appelée sans veille de repos')
  assert.equal(est.etat.poses, 0, '`poserRepos` appelée sans veille de repos')
})

test('⑥ le globe est LU à chaque image, jamais figé à la construction', () => {
  // ⚠️ **C'EST LA FORME QUE `main.js` EMPLOIE, ET ELLE A UNE RAISON MESURÉE** :
  // « `globe` EST DONNÉ PAR UNE FONCTION, PAS PAR SA VALEUR. Il est réassigné à
  // la perte de contexte WebGL ; une référence figée survivrait à la
  // réassignation et poserait le crop sur un globe mort, sans une erreur. » Le
  // relais du repos doit suivre la MÊME règle — sinon il parlerait au globe
  // d'avant, ou (si `globe` est la fonction elle-même) à personne.
  //
  // ⚠️ **CETTE MUTATION A SURVÉCU AU PREMIER TOUR DE CAMPAGNE**, et pour une
  // raison instructive : à l'époque, tous les autres tests de ce fichier
  // passaient le globe PAR SA VALEUR, où `lireGlobe()` et `globe` étaient le
  // même objet — la faute était invisible sous la seule forme que la
  // production n'emploie pas. ⚠️ **CE N'EST PLUS LE CAS** (relecture P2/N,
  // constat groupé ⑤) : les huit autres appels à `creerVeilleCrop` de ce
  // fichier passent désormais eux aussi `globe: () => g`, la forme réelle —
  // ce test-ci reste le SEUL à faire vivre le globe DEUX FOIS (perte de
  // contexte WebGL comprise), donc le seul indispensable, mais il n'est plus
  // le seul rempart : n'importe lequel des neuf peut désormais mordre.
  let vivant = globeDePapier()
  const veille = creerVeilleCrop({ globe: () => vivant, contexte: ctxFactice, repos: creerVeilleRepos() })
  veille.maj(ALT_BLOC, 145.5)
  assert.equal(vivant.cropSeul, true, 'le relais ne lit pas le globe à travers sa fonction')
  // la perte de contexte : le globe est remplacé, et c'est le NOUVEAU qui doit
  // recevoir la suite
  const mort = vivant
  vivant = globeDePapier()
  veille.poserMode(false)
  veille.poserMode(true)
  veille.maj(ALT_BLOC, 145.5)
  assert.equal(vivant.cropSeul, true, 'le relais parle encore au globe d’avant')
  assert.equal(mort.posesCropSeul, 1, 'le globe mort a reçu un ordre après sa mort')
})

test('⑥ bis LA DÉRIVATION DE `lireGlobe` NE FIGE RIEN — structurel, indépendant du test ci-dessus', () => {
  // ⚠️ **CE TEST NE DÉPEND PAS DE CELUI D'AU-DESSUS.** Le constat groupé ⑤
  // (`.superpowers/sdd/2026-08-22-globe-studio/constats-groupes.md`) relève
  // qu'un seul test comportemental gardait « le globe est lu à chaque image » —
  // fragile au premier refactor de CE test précis. Celui-ci lit le TEXTE de
  // `creerVeilleCrop` (même patron que `test/loi-texture-monde.test.js` ⑤f/⑤g
  // pour du code que node ne peut pas exécuter en contexte réel) et interdit
  // STRUCTURELLEMENT la forme fautive : appeler `globe()` DÈS LA DÉRIVATION
  // fige sa valeur pour la vie du closure, exactement la faute qui a survécu
  // au premier tour de mutation avant d'être détectée par la forme réelle.
  const src = readFileSync(new URL('../src/monde/branchement-crop.js', import.meta.url), 'utf8')
  const i = src.indexOf('const lireGlobe =')
  assert.ok(i >= 0, '`lireGlobe` a disparu ou changé de nom dans branchement-crop.js')
  const ligne = src.slice(i, src.indexOf('\n', i))
  assert.ok(
    !/\bglobe\(\)/.test(ligne),
    `la dérivation appelle \`globe()\` à la construction — la valeur serait figée pour toujours : ${ligne}`,
  )
  assert.ok(
    /typeof globe === 'function' \? globe : \(\) => globe/.test(ligne),
    `la dérivation a changé de forme, à revérifier : ${ligne}`,
  )
  // et les trois points d'usage connus rappellent bien `lireGlobe()` — pas une
  // variable qui l'aurait mis en cache entre-temps
  const appels = src.match(/lireGlobe\(\)/g) || []
  assert.ok(appels.length >= 3, `\`lireGlobe()\` n'est rappelé que ${appels.length} fois dans le fichier`)
})

test('⑥ un globe SANS `poserCropSeul` n’est pas une panne', () => {
  // Même contrat que `poserFondCrop` (Tâche J bis) : ce module se vérifie sous
  // node contre un globe de papier, qui ne porte que ce qu'il exerce.
  const g = globeDePapier()
  delete g.poserCropSeul
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, repos: creerVeilleRepos() })
  assert.doesNotThrow(() => veille.maj(ALT_BLOC, 145.5))
  assert.equal(veille.repos, true)
})

// ═══════════════════════════════════════════════════════════════ ⑦ le globe
//
// ⚠️ **SUR UN VRAI QUADTREE, PAS SUR UNE MAQUETTE.** Le harnais est celui de
// `test/globe-eviction.test.js` : un DOM bouché, un réseau qui COMPTE, et une
// caméra complète (sans `projectionMatrix`, le tri spatial n'a rien à trier et
// le parcours mesuré serait l'ancien).

const ELEV = 812
const [ER, EG, EB] = encodeTerrarium(ELEV)
const dalles = new Map()
function dalleDe(cote) {
  let d = dalles.get(cote)
  if (!d) {
    d = new Uint8ClampedArray(cote * cote * 4)
    for (let i = 0; i < cote * cote; i++) {
      d[i * 4] = ER; d[i * 4 + 1] = EG; d[i * 4 + 2] = EB; d[i * 4 + 3] = 255
    }
    dalles.set(cote, d)
  }
  return d
}
class FauxCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData(x, y, w) { return { data: dalleDe(w) } }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FauxCtx())
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

const urls = new Set()
function servir() {
  urls.clear()
  globalThis.fetch = async (url) => {
    urls.add(url)
    await new Promise((r) => setTimeout(r, 0))
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
  }
}

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE } = await import('../src/geo.js')
const { _resetDemSource } = await import('../src/dem-source.js')
const { tuileDansCrop, zoomCropPrescrit } = await import('../src/monde/crop-sphere.js')

const LAT = -21.115
const LON = 55.53
// ⚠️ **LE `fov` EST UNE ENTRÉE, ET LE DÉPÔT L'A PAYÉ DEUX FOIS.** Le code dit
// 30, l'application vivante tourne à 33 (relevé à la console le 2026-08-22 :
// `camera.fov = 33`, `camGlobe.fov = 33`). Ici c'est un harnais, pas une loi :
// on prend le défaut, et rien dans la tâche n'en dérive un seuil.
const FOV = 30

function poserCamera(camera, rayon) {
  latLonToSphere(LAT, LON, rayon, camera.position)
  camera.near = Math.min(Math.max((rayon - R_GLOBE) * 0.2, 0.01), 0.5)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

async function calme(globe, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (!globe.inFlight && !globe.queue.length && !globe._sondes.size) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

// ⚠️ **LE GLOBE EST AMENÉ À L'ALTITUDE DU BLOC AVANT TOUTE MESURE**, sinon on
// comparerait deux quadtrees qui n'ont pas eu le temps de descendre.
async function globeAuBloc({ cropSeulDesLeDepart = false } = {}) {
  servir()
  _resetTileMemo()
  _resetDemSource()
  const globe = new Globe({ globeContinu: true })
  globe.setVisible(true)
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)
  // ⚠️ **`cropSeulDesLeDepart` N'EST PAS UN CONFORT DE TEST.** Poser le drapeau
  // APRÈS la descente laisse en cache tout ce que la descente a chargé — ce qui
  // est exactement ce qu'on veut vérifier ailleurs (la transition est gratuite),
  // et ce qui MASQUE ici la question posée : un quart au bord du crop
  // attend-il des enfants qui ne naîtront jamais ? Avec le drapeau levé dès la
  // première image, ils ne sont jamais nés.
  if (cropSeulDesLeDepart) {
    globe.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 12, tuilesParBloc: 3 })
    globe.poserCropSeul(true)
  }
  for (const r of [140, 120, 108, 103, 101.5, 100.6, 100.3, 100.2]) {
    poserCamera(camera, r)
    for (let k = 0; k < 6; k++) { globe.update(camera, 0.016); await calme(globe) }
  }
  if (!cropSeulDesLeDepart) globe.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 12, tuilesParBloc: 3 })
  for (let k = 0; k < 8; k++) { globe.update(camera, 0.016); await calme(globe) }
  return { globe, camera }
}

// ══════ LA COUVERTURE DU CROP, POINT PAR POINT — R37 ═══════════════════════
//
// ⚠️ **CE QUE ⑦ GARDAIT PAR « LES MÊMES TUILES », IL LE GARDE DÉSORMAIS PAR
// « CHAQUE POINT DESSINÉ EXACTEMENT UNE FOIS ».** Le raffinement partiel (R37)
// change l'ensemble des tuiles dessinées par construction — un parent peut ne
// dessiner que sous ses enfants manquants — mais ce qu'on voulait garder
// n'était pas la liste, c'était l'absence de trou (et de double). On le mesure
// donc là où il se voit : sur une grille de points DANS le crop, la tuile (ou
// le quadrant de parent) qui dessine chaque point.
const R2D = 180 / Math.PI
function tuileXY(lat, lon, z) {
  const n = 2 ** z
  const la = lat / R2D
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)]
}
function dessinentSous(globe, lat, lon) {
  const out = []
  for (let z = 2; z <= 15; z++) {
    const [x, y] = tuileXY(lat, lon, z)
    const t = globe.tiles.get(`${z}/${x}/${y}`)
    if (!t || !t.mesh || !t.mesh.visible) continue
    if (t._partiel) {
      const [cx, cy] = tuileXY(lat, lon, z + 1)
      if (!(t._partiel & (1 << ((cx & 1) + ((cy & 1) << 1))))) continue
    }
    out.push(t.key)
  }
  return out
}
const mercLat = (my) => Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * R2D
function couvertureCrop(globe, pas = 24) {
  const rep = globe._crop
  if (!rep) return null
  let trous = 0, doubles = 0, points = 0, zMin = 99
  for (let j = 0; j < pas; j++) for (let i = 0; i < pas; i++) {
    const mx = rep.cx - rep.demi + (2 * rep.demi * (i + 0.5)) / pas
    const my = rep.cy - rep.demi + (2 * rep.demi * (j + 0.5)) / pas
    const qui = dessinentSous(globe, mercLat(my), mx * 360 - 180)
    points++
    if (qui.length === 0) trous++
    else if (qui.length > 1) doubles++
    for (const k of qui) zMin = Math.min(zMin, +k.split('/')[0])
  }
  return { points, trous, doubles, zMin }
}

function bilan(globe) {
  let dessinees = 0
  let dessineesHors = 0
  let maillees = 0
  let horsCrop = 0
  const dedansDessinees = new Set()
  for (const [cle, t] of globe.tiles) {
    const dehors = globe._crop ? !tuileDansCrop(t.z, t.x, t.y, globe._crop) : false
    if (dehors) horsCrop++
    if (t.mesh) maillees++
    if (t.mesh?.visible) {
      dessinees++
      if (dehors) dessineesHors++
      else dedansDessinees.add(cle)
    }
  }
  return { dessinees, dessineesHors, maillees, horsCrop, dedansDessinees, visites: globe._visites, cache: globe.tiles.size, couverture: couvertureCrop(globe) }
}

test('⑦ AVANT : le `discard` laisse dessiner des tuiles entièrement hors crop', async () => {
  // ⚠️ **C'EST LE DÉFAUT, ÉCRIT COMME UN TEST.** Le nuanceur jette le fragment,
  // mais l'appel de dessin est déjà parti. Mesuré dans l'application vivante
  // (La Réunion, altitude de bloc, `uEstompage = 1`) : **351 tuiles dessinées,
  // dont 315 entièrement hors crop**.
  const { globe, camera } = await globeAuBloc()
  globe.update(camera, 0.016)
  const av = bilan(globe)
  assert.ok(av.dessineesHors > 0, 'le harnais ne reproduit pas le défaut : rien n’est dessiné hors crop')
  assert.ok(av.dessinees > av.dessinees - av.dessineesHors, 'le crop dessinerait tout à lui seul')
})

test('⑦ APRÈS : hors crop, plus rien n’est parcouru ni dessiné', async () => {
  const { globe, camera } = await globeAuBloc()
  globe.update(camera, 0.016)
  const av = bilan(globe)
  globe.poserCropSeul(true)
  globe.update(camera, 0.016)
  await calme(globe)
  globe.update(camera, 0.016)
  const ap = bilan(globe)
  assert.equal(ap.dessineesHors, 0, `${ap.dessineesHors} tuiles hors crop sont encore dessinées`)
  assert.ok(ap.visites < av.visites, `le parcours n’a pas diminué (${av.visites} → ${ap.visites})`)
  assert.ok(ap.dessinees > 0, 'le crop lui-même a disparu')
  // ⚠️ **AUCUN TROU, ET C'EST LA MOITIÉ DU CONTRAT.** Un quart de quadtree
  // dont les quatre enfants tombent hors du crop alors que lui-même y touche
  // descendrait dans le vide et ouvrirait une encoche d'une tuile. Ce test
  // demandait « EXACTEMENT les mêmes tuiles qu'avant » ; depuis R37 (le
  // raffinement partiel) l'ensemble dessiné n'est plus une constante — un
  // parent dessine sous ses enfants manquants — et ce qu'on garde est ce qu'on
  // voulait garder : **chaque point du crop dessiné exactement une fois**,
  // avec et sans le drapeau, et pas plus grossier qu'avant.
  assert.ok(av.couverture.points >= 500)
  assert.equal(av.couverture.trous, 0, `${av.couverture.trous} point(s) du crop sans tuile AVANT le drapeau`)
  assert.equal(av.couverture.doubles, 0, `${av.couverture.doubles} point(s) du crop dessinés deux fois AVANT le drapeau`)
  assert.equal(ap.couverture.trous, 0, `${ap.couverture.trous} point(s) du crop sans tuile : le crop seul a ouvert un trou`)
  assert.equal(ap.couverture.doubles, 0, `${ap.couverture.doubles} point(s) du crop dessinés deux fois`)
  assert.ok(ap.couverture.zMin >= av.couverture.zMin, `le crop seul dessine plus grossier (z${ap.couverture.zMin} contre z${av.couverture.zMin})`)
})

test('⑦ un quart au BORD n’attend pas les enfants qu’il ne créera jamais', async () => {
  // ⚠️ **SANS CETTE RÈGLE, L'ADMISSION PAIE DES TUILES FANTÔMES.** Un quart qui
  // chevauche la frontière du crop n'aura jamais que deux enfants sur quatre ;
  // les compter dans `_enfantsPresents` ferait débiter quatre crédits pour deux
  // tuiles, à chaque image, pour toujours.
  const { globe } = await globeAuBloc({ cropSeulDesLeDepart: true })
  let bord = null
  for (const t of globe.tiles.values()) {
    if (globe._horsCropSeul(t.z, t.x, t.y)) continue
    const enfants = globe._children(t)
    if (enfants.length > 0 && enfants.length < 4) { bord = { t, enfants } ; break }
  }
  assert.ok(bord, 'le harnais ne produit aucun quart à cheval sur le bord du crop')
  assert.equal(globe._enfantsPresents(bord.t), true, 'le quart attend des enfants qui ne naîtront pas')
})

test('⑦ MI-CHARGEMENT : UN SEUL enfant manquant sur quatre — le parent reste dessiné SOUS lui, les trois autres dessinent (raffinement partiel, R37)', async () => {
  // ⚠️ **CE QUE CE TEST MORD, ET RIEN D'AUTRE NE LE MORDAIT** : l'instant de
  // MI-CHARGEMENT, où 1 à 3 enfants sur 4 sont prêts. Aucun test de repos ne
  // le voit. Avant R37 la règle était tout ou rien (le parent couvrait tout le
  // quadrant tant qu'un enfant manquait — c'est le flou qu'Adrien a filmé) ;
  // une mutation en `kids.some(...)` aurait ouvert une encoche d'une tuile.
  // Depuis R37 le contrat est : **les enfants prêts dessinent, le parent
  // dessine exactement les quadrants des manquants, et aucun point n'est
  // dessiné zéro ou deux fois.** Une mutation qui dessinerait le parent entier
  // (double) ou l'éteindrait (trou) rougit ici.
  const { globe, camera } = await globeAuBloc({ cropSeulDesLeDepart: true })
  let cible = null
  for (const t of globe.tiles.values()) {
    if (globe._horsCropSeul(t.z, t.x, t.y)) continue
    if (t.state !== 'ready' || !t.mesh) continue
    const zCrop = zoomCropPrescrit(t.z, t.x, t.y, globe._crop)
    if (!zCrop || t.z >= zCrop) continue
    const enfants = globe._children(t)
    if (enfants.length === 4) { cible = { t, enfants }; break }
  }
  assert.ok(cible, 'le harnais ne produit aucune tuile candidate sous le zoom prescrit du crop')
  const { t, enfants } = cible

  // trois enfants prêts, LE QUATRIÈME ENCORE EN CHARGEMENT — l'état de
  // mi-chargement exact que `every` distingue de `some`.
  for (let i = 0; i < 3; i++) {
    enfants[i].state = 'ready'
    enfants[i].mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
  }
  enfants[3].state = 'loading'
  enfants[3].mesh = null
  t.refined = false
  t.mesh.visible = false // simule : pas encore redessiné à cette image

  const camPos = camera.position
  const camDir = camPos.clone().normalize()
  // ce que `update()` fait avant chaque parcours : tout s'éteint, le parcours rallume
  for (const k of globe.tiles.values()) if (k.mesh) k.mesh.visible = false
  globe._traverse(t, camPos, camDir)

  assert.equal(t.refined, false, '`refined` veut dire « les quatre dessinent » : pas à mi-chargement')
  assert.equal(t.mesh.visible, true, 'le parent doit rester dessiné sous l’enfant manquant — sinon un trou d’une tuile')
  const bit = 1 << ((enfants[3].x & 1) + ((enfants[3].y & 1) << 1))
  assert.equal(t._partiel, bit, 'le parent doit ne dessiner QUE le quadrant du manquant')
  // un enfant prêt HORS du champ n'est ni dessiné ni couvert : aucun pixel n'en dépend
  const dansChamp = enfants.map((k) => globe._dansLeChamp(k, camDir))
  assert.ok(dansChamp[3], 'le harnais a choisi un manquant hors champ : rien n’est mesuré')
  // un enfant prêt dessine — ou, s'il a lui-même ses quatre enfants en cache (le
  // crop prescrit z13), ce sont eux qui dessinent sous lui
  for (let i = 0; i < 3; i++) if (dansChamp[i]) assert.ok(enfants[i].mesh.visible || enfants[i].refined, `l’enfant prêt ${enfants[i].key} n’est pas dessiné`)
  // le point-par-point : sous les trois prêts, UNE tuile et pas plus grossière
  // que l'enfant ; sous le manquant, le parent seul
  const centre = (k) => { const n = 2 ** k.z; return [mercLat((k.y + 0.5) / n), ((k.x + 0.5) / n) * 360 - 180] }
  for (let i = 0; i < 3; i++) {
    if (!dansChamp[i]) continue
    const qui = dessinentSous(globe, ...centre(enfants[i]))
    assert.equal(qui.length, 1, `sous ${enfants[i].key} : ${qui.join(', ')}`)
    assert.ok(+qui[0].split('/')[0] >= enfants[i].z, `sous ${enfants[i].key}, c’est ${qui[0]} qui dessine`)
  }
  assert.deepEqual(dessinentSous(globe, ...centre(enfants[3])), [t.key])
})

test('⑦ APRÈS : plus une seule URL hors crop n’est demandée', async () => {
  // ⚠️ **C'EST L'EXIGENCE DURE — « pas dessinés, pas maillés, pas chargés ».**
  // Sans le filtrage dans `_children`, la règle sans-trou continuerait de
  // demander les enfants hors crop de chaque quart qui chevauche le bord.
  //
  // ⚠️ **CE QUI EST DÉJÀ EN CACHE Y RESTE, ET C'EST VOULU** — c'est ce qui rend
  // la transition gratuite (test suivant). Ce qu'on garde ici, c'est qu'il n'en
  // NAÎT plus une seule.
  const { globe, camera } = await globeAuBloc()
  globe.poserCropSeul(true)
  for (let k = 0; k < 4; k++) { globe.update(camera, 0.016); await calme(globe) }
  const connues = new Set(globe.tiles.keys())
  urls.clear()
  for (let k = 0; k < 8; k++) { globe.update(camera, 0.016); await calme(globe) }
  const neuves = [...globe.tiles.keys()].filter((k) => !connues.has(k))
  for (const cle of neuves) {
    const t = globe.tiles.get(cle)
    assert.ok(
      !globe._horsCropSeul(t.z, t.x, t.y),
      `la tuile z${t.z}/${t.x}/${t.y}, hors crop, a été créée après la bascule`,
    )
  }
  assert.equal(urls.size, 0, `${urls.size} tuiles demandées au réseau au repos`)
})

test('⑦ le drapeau ÉTEINT rend le parcours d’avant, tuile pour tuile', async () => {
  // ⚠️ La garde de `uCropOn`, `uHabOn`, `uMerRampeOn` — et la consigne D5 : le
  // parcours du globe ne bouge pas d'un bit tant que le crop seul est baissé.
  // ⚡ Le drapeau de production est LEVÉ depuis le 2026-08-30 (mode sphère au
  // démarrage) ; ce test ne lit aucun défaut, il pose `poserCropSeul(false)` à
  // la main — c'est le chemin `?terre=deux`, et il doit rester intact.
  const { globe, camera } = await globeAuBloc()
  globe.update(camera, 0.016)
  const a = bilan(globe)
  assert.equal(globe._cropSeul, false, 'le globe naît avec le crop seul allumé')
  globe.poserCropSeul(false)
  globe.update(camera, 0.016)
  const b = bilan(globe)
  assert.deepEqual(b, a, 'un `poserCropSeul(false)` change le parcours')
})

test('⑦ SANS CROP POSÉ, le drapeau ne coupe RIEN', async () => {
  // ⚠️ Couper sur un repère absent ferait disparaître la planète entière.
  const { globe, camera } = await globeAuBloc()
  globe.retirerCrop()
  globe.poserCropSeul(true)
  globe.update(camera, 0.016)
  const b = bilan(globe)
  assert.ok(b.dessinees > 0, 'la planète a disparu faute de crop')
  assert.equal(globe._horsCropSeul(2, 0, 0), false)
})

test('⑦ le crop RETROUVÉ ne repasse pas par le réseau — la transition est gratuite', async () => {
  // ⚠️ **LE CAHIER DES CHARGES LE DEMANDE EXPLICITEMENT** : « le cache ne doit
  // pas évincer ce qu'il faudra pour la transition — sinon chaque dézoom
  // redéclenchera un chargement, ce qu'Adrien refuse ». Ici c'est
  // arithmétique : au repos le cache ne DÉBORDE pas, donc `_evict` ne passe
  // jamais, donc rien n'est rendu au réseau.
  const { globe, camera } = await globeAuBloc()
  const cache = globe.tiles.size
  assert.ok(cache < globe.cacheMax, `le cache déborde déjà (${cache} / ${globe.cacheMax})`)
  globe.poserCropSeul(true)
  for (let k = 0; k < 30; k++) { globe.update(camera, 0.016); await calme(globe) }
  const restant = globe.tiles.size
  urls.clear()
  // la transition : on rend la main aux alentours
  globe.poserCropSeul(false)
  globe.update(camera, 0.016)
  assert.equal(urls.size, 0, `${urls.size} tuiles redemandées au réseau à la première image du dézoom`)
  assert.ok(restant >= cache * 0.9, `le repos a rendu ${cache - restant} tuiles sur ${cache}`)
})

// ══════════════════════════════════════════════════════ ⑧ le texte de main.js

test('⑧ la veille du repos est CONSTRUITE et BRANCHÉE dans `main.js`', () => {
  // ⚠️ **AUCUN TEST DE CE DÉPÔT NE CHARGE `main.js`** (§0 du plan), et c'est
  // exactement ce qui a laissé la Tâche I passer six méthodes sans appelant.
  assert.ok(/import \{ creerVeilleRepos \} from '\.\/monde\/veille-repos\.js'/.test(MAIN), 'le module n’est pas importé')
  assert.ok(/const veilleRepos = creerVeilleRepos\(\)/.test(MAIN), 'la veille n’est pas construite')
  assert.ok(/\n  repos: veilleRepos,/.test(MAIN), 'la veille n’atteint pas `creerVeilleCrop`')
})

test('⑧ la veille du repos est EXPOSÉE, comme les trois autres', () => {
  assert.ok(/\n  veilleRepos,/.test(MAIN), '`veilleRepos` n’est pas dans `__exp` : rien ne se vérifie à l’écran')
})

test('⑧ `main.js` ne lit PAS l’altitude une seconde fois pour le repos', () => {
  // ⚠️ **UNE SEULE LECTURE D'ALTITUDE, TROIS CONSOMMATEURS** — l'argument est
  // déjà écrit deux fois dans `main.js`, et le chantier l'a payé trois fois.
  assert.ok(!/veilleRepos\.maj\(/.test(MAIN), '`main.js` nourrit la veille du repos en direct : deux chemins pour un geste')
})

// ══════════════════════ ⑨ LA GRANDEUR SURVEILLÉE — Tâche R1 ═════════════════
//
// **Adrien, 2026-08-23 :** « si je modifie la hauteur de la caméra SANS
// SCROLLER et en me déplaçant, il ne faut pas que le reste de ce qui est autour
// du socle réapparaisse. Si je dézoome EN SCROLLANT, alors là tu peux faire
// réapparaître le reste. »
//
// La Tâche N avait choisi l'altitude au-dessus de l'ellipsoïde. Mesuré le
// 2026-08-23 dans l'application vivante (`.banc/R1/mesure-R1.json`) : un vrai
// cliquer-glisser d'inclinaison, cible immobile et distance rigoureusement
// constante, fait tomber cette altitude de 17 624 m à 2 861 m — écart
// logarithmique de pic `3,86 × 10⁻¹`, **15 images sur 15 au-dessus du seuil**,
// et `auRepos` bascule réellement de vrai à faux. La distance caméra↔cible, à
// la même image, bouge de `4,4 × 10⁻¹⁶` : le zéro de la machine.
//
// ⚠️ **CES DEUX TESTS MORDENT SUR LE COMPORTEMENT, PAS SUR LE TEXTE SOURCE.**
// Une expression régulière sur `main.js` a déjà laissé survivre une mutation à
// 4 082 tests sur ce chantier.

test('⑨ une ALTITUDE qui s’effondre à DISTANCE CONSTANTE ne réveille pas la vue', () => {
  // C'est l'orbite : l'inclinaison écrase `camera.position.y`, donc l'altitude,
  // sans rien changer à l'échelle. Le crop doit rester seul.
  const g = globeDePapier()
  const est = veilleEstompageFactice()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
  const D = 145.5 // la distance relevée à l'écran, tenue constante par l'orbite
  veille.maj(ALT_BLOC, D)
  assert.equal(g.cropSeul, true, 'le crop seul n’est pas posé au départ')
  const basculesAvant = veille.basculesRepos
  // le profil MESURÉ : l'altitude divisée par 6,16 en quinze images
  let alt = ALT_BLOC
  for (let i = 0; i < 15; i++) {
    alt *= Math.exp(-0.12) // bien au-delà du seuil, à chaque image
    veille.maj(alt, D)
  }
  assert.equal(g.cropSeul, true, 'une orbite a rallumé les alentours — le défaut d’Adrien')
  assert.equal(veille.basculesRepos, basculesAvant, `l’orbite a fait ${veille.basculesRepos - basculesAvant} bascules`)
  assert.equal(est.etat.repos, true, 'l’estompage a reçu « la vue bouge » sur une orbite')
})

test('⑨ une DISTANCE qui change à ALTITUDE CONSTANTE réveille la vue', () => {
  // C'est la molette : l'échelle change, les alentours doivent revenir DÈS la
  // première image, sinon la transition commence par un trou.
  const g = globeDePapier()
  const est = veilleEstompageFactice()
  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
  veille.maj(ALT_BLOC, 145.5)
  assert.equal(g.cropSeul, true)
  // une seule image suffit — l'hystérésis est asymétrique À DESSEIN (§3)
  veille.maj(ALT_BLOC, 145.5 * Math.exp(SEUIL_BOUGE_LOG * 3))
  assert.equal(g.cropSeul, false, 'un dézoom n’a pas rendu la main aux alentours')
  assert.equal(veille.basculesRepos, 2)
  assert.equal(est.etat.repos, false, 'l’estompage n’a pas su que la vue bouge')
})

test('⑨ `SEUIL_BOUGE_LOG` capte encore la molette — le geste qui l’a calibré', () => {
  // ⛔ **CE TEST ÉTAIT À MOITIÉ TAUTOLOGIQUE, ET LA RELECTURE L'A VU.** Il
  // comparait `PIC_DIST / PIC_ALT < 1.1` — deux littéraux écrits deux lignes
  // plus haut, dans ce fichier. Aucune modification du code ne pouvait faire
  // rougir cette ligne : elle ne gardait rien, elle décorait. Elle est retirée,
  // et son contenu remis là où il a sa place — le §3 du module, qui PORTE la
  // mesure et n'a pas à la faire semblant de la vérifier.
  //
  // ⚠️ **CE QUI RESTE MORD, ET C'EST CE QUI A TUÉ LA MUTATION `10⁻⁴ → 10⁻³`** :
  // le seuil est lu dans le module, et confronté aux deux pics RELEVÉS le
  // 2026-08-23 sur six crans de molette réels, cible immobile
  // (`.banc/R1/mesure-R1.json`, C). Un seuil au-dessus de l'un ou l'autre
  // manquerait le geste en entier — c'est un PLAFOND, pas un plancher.
  const PIC_ALT_MESURE = 6.592700138422678e-3
  const PIC_DIST_MESURE = 7.112215240894834e-3
  assert.ok(SEUIL_BOUGE_LOG < PIC_ALT_MESURE,
    `le seuil (${SEUIL_BOUGE_LOG}) est passé au-dessus du pic d’altitude de la molette : le geste serait manqué`)
  assert.ok(SEUIL_BOUGE_LOG < PIC_DIST_MESURE,
    `le seuil (${SEUIL_BOUGE_LOG}) est passé au-dessus du pic de distance de la molette : le geste serait manqué`)
  // ⚠️ **ET IL RESTE SOUS LE PIC AVEC DE LA MARGE** — la mesure du tour 1 a été
  // prise à cadence réduite (~25 img/s) ; à 60 Hz chaque écart par image est
  // plus petit, donc le seuil doit être pris franchement en dessous, pas de
  // justesse. Marge mesurée par la relecture à 57 img/s : 66 ×.
  assert.ok(PIC_ALT_MESURE / SEUIL_BOUGE_LOG > 10,
    'le seuil est trop près du pic mesuré : une cadence plus haute lui ferait manquer la molette')
})

test('⑨ `main.js` nourrit le repos avec la DISTANCE, sur la même image que l’altitude', () => {
  // ⚠️ **UNE SEULE LECTURE DE CHAQUE GRANDEUR, ET LES DEUX À LA MÊME IMAGE** —
  // même argument que la Tâche K bis, deux lignes plus haut dans `main.js`.
  assert.ok(/function distanceCadrageM\(\)/.test(MAIN), '`distanceCadrageM` n’existe pas')
  assert.ok(/veilleCrop\.maj\(alt, dist\)/.test(MAIN), 'la distance n’atteint pas la chaîne du crop')
  assert.ok(/\n  veilleSocle, seuilSocleBranche, altitudeCadrageM, distanceCadrageM,/.test(MAIN),
    '`distanceCadrageM` n’est pas exposée : rien ne se vérifie à l’écran')
})
