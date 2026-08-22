// ═══════════ L'ÉCUME DE LA MER — UNE SEULE ÉCRITURE, DEUX LECTEURS ═════════
//
// **Tâche P4.** Le noteur : *« l'écume est 7,7 fois trop étendue — et elle est
// en PLAQUES »*. Son brief attribuait l'écart aux **trois constantes 1,8 / 1,1 /
// 0,96** de `globe.js`.
//
// ⛔ **CE N'EST PAS ELLES, ET LA SOURCE LE DIT** : `1.8`, `1.1` et `vec3(0.96)`
// sont **identiques** des deux côtés (`ocean.js:565` et `:594` contre
// `globe.js`, écume de la calotte). Aucune n'a jamais divergé. Ce qui a divergé,
// ce sont **quatre entrées** que la calotte du globe ne fournissait pas :
//
//   ① `ocean.js` ne lit pas la distance au rivage brute : il lit
//      **`vFade = smoothstep(0, 0.35, max(2 × profondeur, distance))`**
//      (`ocean.js:255` et `:270`). La calotte passait `champ.g` TEL QUEL, donc
//      la distance brute, à des seuils (0,002 / 0,03 / 0,10 / 0,75) calés pour
//      la grandeur fondue. **Mesuré sur le champ vivant de La Réunion : la bande
//      de ressac couvrait 68,72 % des nœuds d'eau du crop ; avec la grandeur
//      d'`ocean.js`, 10,41 %.** Le terme de PROFONDEUR est ce qui tue la bande à
//      quelques centaines de mètres d'une île volcanique.
//   ② `ocean.js` multiplie le ressac et le liseré par **`uViewCalm × uSurfCalm`**
//      (`:562` et `:564`) et les moutons par **`uViewCalm`** (`:554`). **Relevé
//      le 2026-08-22 dans la page vivante : `uViewCalm = 0,4039`,
//      `uSurfCalm = 0,08`** — soit un facteur **0,0323** sur le ressac, que la
//      calotte remplaçait par **1**. **Trente et une fois trop.**
//   ③ le ressac porte aussi `(0,5 + 0,5 × uFoamScale)` (`:562`), absent.
//   ④ la tavelure d'`ocean.js` est indexée sur `xz` **en unités de socle**
//      (`:537`) ; la calotte l'indexait en espace de spectre avec un facteur
//      `0,08` écrit à la main. **Cellules 5,25 fois trop larges : LES PLAQUES.**
//
// ➡️ **Ce module porte la loi UNE SEULE FOIS**, en JS (les jumeaux testables) et
// en GLSL (`GLSL_ECUME`). **`ocean.js` ET `globe.js` injectent ce même texte.**
// C'est le patron de `naturel-crop.js` (Tâche P2), pour la même raison : deux
// écritures jumelles divergent, et celle-ci avait déjà divergé sur quatre points.
//
// ⚠️ **AUCUNE IMPORTATION** : ce module doit rester chargeable sous node pour
// que `test/ecume-mer.test.js` exécute ses jumeaux sans WebGL.
//
// ⚠️ **CE QUI N'EST PAS ICI, ET POURQUOI** : l'atténuation par le masque côtier
// (`foam *= 1 − smoothstep(0.35, 0.65, coastLand)`, `ocean.js:569`) reste chez
// son lecteur. Elle est sous `#ifndef IS_LAKE` là-bas et n'a pas d'équivalent
// sur la calotte, où la terre est écartée par un `discard` franc
// (`vProfondeur <= 0.0`) plutôt que par un masque flou. **La porter demanderait
// de brancher un second échantillonneur sur la mer du globe pour un service que
// le `discard` rend déjà ; on le dit plutôt que de le faire à moitié.**

/** `smooth01` d'`ocean.js:75`, au caractère près. */
export function lisse01(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** `smoothstep` du GLSL, pour les jumeaux. */
export function pas0a1(a, b, t) {
  return lisse01((t - a) / (b - a))
}

// ── ① LE DÉCLIN CÔTIER ─────────────────────────────────────────────────────

/**
 * Le facteur de la profondeur dans le déclin côtier. `ocean.js:255` : `* 2.0`.
 * ⚠️ **C'EST LUI QUI MANQUAIT**, et c'est le plus gros des quatre écarts.
 */
export const POIDS_PROFONDEUR = 2

/** La fin de la rampe du repère côtier LARGE. `ocean.js:270` : `0.35`. */
export const FONDU_RESSAC_FIN = 0.35

/** La fin de la rampe qui tue la houle au rivage. `ocean.js:268` : `0.10`. */
export const FONDU_HOULE_FIN = 0.1

/**
 * Le déclin côtier : la PROFONDEUR d'abord, la distance au rivage en secours.
 *
 * ⚠️ **LES DEUX SONT EN UNITÉS DE SOCLE** — `ocean.js` compare
 * `(uWaterY − f.r) * 2.0`, une hauteur du repère du socle, à `f.g`, la distance
 * normalisée sur quinze de ces mêmes unités. La calotte doit donc convertir sa
 * profondeur (unités de scène) avant d'appeler : c'est `uMerUnite`.
 *
 * @param {number} profondeur en unités de socle
 * @param {number} distance canal G du champ, déjà normalisé
 */
export function declinRivage(profondeur, distance) {
  return Math.max(profondeur * POIDS_PROFONDEUR, distance)
}

/** Le repère côtier LARGE que l'écume lit. `ocean.js:270`. */
export function fonduRessac(declin) {
  return pas0a1(0, FONDU_RESSAC_FIN, declin)
}

/** Le fondu qui tue la houle au rivage. `ocean.js:268`. */
export function fonduHoule(declin) {
  return pas0a1(0, FONDU_HOULE_FIN, declin)
}

// ── ② LES DEUX ACCALMIES ───────────────────────────────────────────────────

/**
 * ⚠️ **LES DEUX ACCALMIES NE SONT PAS RECALCULÉES ICI, ELLES SONT LUES.**
 * `ocean.js` les pose par image dans `setView` à partir de l'altitude de la
 * caméra et du rayon d'orbite ; les redériver sur le globe aurait fait **deux
 * lois** pour une seule grandeur — exactement la faute que D13 §③ nomme. La
 * calotte prend donc **les valeurs vivantes des uniformes du socle**, comme P2
 * prend `terrain.mapUniforms.uRampTex` plutôt que de recuire une rampe.
 *
 * Ce couple-ci n'est que le NEUTRE : ce que valent les deux facteurs quand il
 * n'y a pas de mer de socle à lire (crop continental, banc). **`1` des deux
 * côtés, c'est-à-dire le globe d'avant cette tâche, au bit près** — la vertu
 * d'instrument de banc que D13 §① demande de garder.
 */
export const ACCALMIE_NEUTRE = Object.freeze({ vue: 1, surface: 1 })

/**
 * Les deux accalmies vivantes du socle, ou le neutre s'il n'y en a pas.
 *
 * ⚠️ **ELLE NE CALCULE RIEN** : elle LIT. Le seul écrivain de ces deux valeurs
 * reste `Ocean.setView` (`ocean.js`), appelé par image depuis `main.js`.
 *
 * @param {{uViewCalm?:{value:number}, uSurfCalm?:{value:number}}|null} uniformes
 */
export function accalmieDuSocle(uniformes) {
  const v = uniformes?.uViewCalm?.value
  const s = uniformes?.uSurfCalm?.value
  return {
    vue: Number.isFinite(v) ? v : ACCALMIE_NEUTRE.vue,
    surface: Number.isFinite(s) ? s : ACCALMIE_NEUTRE.surface,
  }
}

// ── ②bis L'ÉTAT DE MER — Tâche P5 ──────────────────────────────────────────
//
// ⛔ **LA RÉSERVE N° 1 DE LA TÂCHE P4, FERMÉE.** Elle l'avait relevé au même
// instant dans la page vivante et n'avait pas refermé le trou : *« le socle vit
// à `uChop = 1`, `uWaveH = 2`, `uFoam = 1,9`, `uFoamScale = 1` ; la calotte
// prend les défauts de `poserMer` — `chop = 0,7`, `houle = 0,5`,
// `ecumeEchelle = 0,35` — parce que `contexteCrop().mer` ne passe aucun des
// cinq. Ce sont deux MERS différentes. »*
//
// ⚡ **ET IL Y EN AVAIT UN SIXIÈME, QUE P4 N'AVAIT PAS NOMMÉ** : la VITESSE.
// `ocean.js` pose `uSpeedMul = (params.seaSpeed ?? 1) × 0,4` — relevé à **0,4**
// — et `poserMer` codait `uMerVitesse: { value: 1 }` **en dur**. La houle du
// crop défilait **2,5 fois trop vite**, ce qui ne se voit pas sur une capture au
// repos et se voit tout de suite en mouvement.
//
// ⚠️ **ON LIT `uFoam` ET `uGloss`, ON NE LES RECALCULE PAS.** `poserMer`
// transcrivait `chopLook` (`1,9 × chop²` et `240 − 130 × chop`) : avec le chop
// du socle la transcription rend le même nombre, mais elle resterait une SECONDE
// écriture d'une loi qui vit dans `ocean.js`, et le panneau « Effets » peut y
// écrire autre chose (`ocean.js` repose `uFoam`/`uGloss` sur un changement de
// look). On prend donc les uniformes vivants — le patron des deux accalmies.

/**
 * L'état de mer NEUTRE : ce que `poserMer` posait avant la Tâche P5.
 *
 * ⚠️ **CES SIX NOMBRES SONT LE DÉPÔT AU BIT PRÈS**, et c'est ce qui rend l'A/B à
 * témoin nul possible (D13 §①) : sans mer de socle à lire — crop continental,
 * banc, test — la calotte rend exactement l'image d'avant. `ecume` et
 * `brillance` sont `chopLook(0,7)`, la transcription qui vivait dans `poserMer`.
 */
export const ETAT_MER_NEUTRE = Object.freeze({
  houle: 0.5,
  chop: 0.7,
  ecume: 1.9 * 0.7 * 0.7,
  ecumeEchelle: 0.35,
  brillance: 240 - 130 * 0.7,
  vitesse: 1,
})

/**
 * L'état de mer VIVANT du socle, ou le neutre s'il n'y en a pas.
 *
 * ⚠️ **ELLE NE CALCULE RIEN** : elle LIT. Les écrivains restent `ocean.js`
 * (`_applySea`, `setSeaLook`, `_refreshWaveScale`) et personne d'autre.
 *
 * ⚠️ **TOUT OU RIEN, CHAMP PAR CHAMP.** Un uniforme absent rend SA valeur
 * neutre, pas celle du voisin : un socle qui n'exposerait que la moitié de son
 * état de mer donnerait sinon une mer hybride, qui n'est celle de personne.
 *
 * @param {object|null} uniformes les uniformes du matériau de mer du socle
 * @returns {{houle:number, chop:number, ecume:number, ecumeEchelle:number, brillance:number, vitesse:number}}
 */
export function etatMerDuSocle(uniformes) {
  const lire = (nom, neutre) => {
    const v = uniformes?.[nom]?.value
    return Number.isFinite(v) ? v : neutre
  }
  return {
    houle: lire('uWaveH', ETAT_MER_NEUTRE.houle),
    chop: lire('uChop', ETAT_MER_NEUTRE.chop),
    ecume: lire('uFoam', ETAT_MER_NEUTRE.ecume),
    ecumeEchelle: lire('uFoamScale', ETAT_MER_NEUTRE.ecumeEchelle),
    brillance: lire('uGloss', ETAT_MER_NEUTRE.brillance),
    vitesse: lire('uSpeedMul', ETAT_MER_NEUTRE.vitesse),
  }
}

// ── ②ter LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ───────────────────
//
// ⛔ **QUATRE RÉGLAGES D'`ocean.js` QUE LA CALOTTE N'A JAMAIS REÇUS, ET AUCUN
// PARAMÈTRE NE LES PORTAIT.** P5 avait mesuré le symptôme sans pouvoir
// l'attribuer : *« la concentration de luminance vaut 80,97 % côté crop contre
// 30,33 % au socle ; sur le fond marin NU, 40,14 % contre 38,73 %. Presque tout
// l'écart vit dans la NAPPE. »* Relevé le 2026-08-22 **au même instant, dans la
// même page** (La Réunion z12) :
//
//   ① **`uTransp = 0,57`** (`params.waterTransparency`) — le nuanceur de la
//      calotte n'a **aucun terme de transparence**. `ocean.js` multiplie son
//      opacité d'eau par `mix(1,15 ; 0,26 ; uTransp)`, soit **0,6427** ici : la
//      lame du crop est **1,556 fois trop opaque**, et à tirette pleine elle le
//      serait **3,85 fois**. ⚡ **C'est le « plus sombre et plus opaque » de la
//      réserve n° 2 de P5, chiffré et attribué.**
//   ② **`uSunFx = 0,72`** (`params.waterSunFx`) — la calotte ne dose pas son
//      reflet solaire : **28 % de glint de trop**.
//   ③ **`uDetail = 0,75`** (`chopLook(seaChop).detail`) — `ocean.js` perturbe la
//      normale de sa surface par deux bruits (`vNorm + uDetail × 0,6 ×
//      uViewCalm × …`). **La calotte n'en avait pas un seul.** ⚡ **C'est la
//      mesure que P5 laissait ouverte** : « la mer du socle AJOUTE de la
//      variation (2,46 → 3,36) ; celle du crop en RETIRE (1,55 → 1,37) ».
//   ④ **`uDayLight`** — la mer du socle S'ÉTEINT la nuit (corps multiplié par
//      `(0,10 · 0,16 · 0,30)`, écume par 0,14). Celle du crop reste en plein
//      jour à minuit. Vaut 1 au relevé, donc **invisible aujourd'hui et faux
//      dès qu'on touche la tirette d'heure**.
//
// ⚠️ **LE NEUTRE EST CELUI D'`ocean.js`, PAS « LA CALOTTE D'AVANT ».** Il
// n'existe AUCUNE valeur de `transparence` qui reproduise le nuanceur d'avant :
// il portait `mix(0,45 ; 0,95)` **sans le facteur de tirette** (donc
// `transparence ≈ 0,1685`) **et** le glacis de lagon à plein régime (donc
// `transparence ≥ 0,35`). Les deux ne peuvent pas être vraies ensemble — **c'est
// la signature d'une loi tronquée, pas d'un réglage.** Le neutre retenu est donc
// celui des `??` de `waterMaterial` : `0,4`, `1`, `1` et `chopLook(0,7).detail`,
// exactement la famille d'`ETAT_MER_NEUTRE`. ⚠️ **Et il ne touche pas la
// production** : `poserMer` n'est appelée que sous `?terre=unique` ; drapeau
// baissé il n'y a pas de mer de crop du tout.

/** Le `detail` de `chopLook(c)` d'`ocean.js` : `0,25 + 0,5 c`. */
export function detailClapot(chop) {
  return 0.25 + 0.5 * chop
}

/**
 * La lame d'eau NEUTRE : les défauts de `waterMaterial` d'`ocean.js`.
 *
 * ⚠️ **LES QUATRE SONT DES `??` DU DÉPÔT**, pas des nombres choisis ici :
 * `params.waterTransparency ?? 0.4`, `params.waterSunFx ?? 1`,
 * `uDayLight: { value: 1 }`, `chopLook(params.seaChop ?? 0.7).detail`.
 */
export const LAME_EAU_NEUTRE = Object.freeze({
  transparence: 0.4,
  soleilFx: 1,
  jour: 1,
  detail: detailClapot(0.7),
})

/**
 * La lame d'eau VIVANTE du socle, ou le neutre s'il n'y en a pas.
 *
 * ⚠️ **ELLE NE CALCULE RIEN** : elle LIT, champ par champ, exactement comme
 * `etatMerDuSocle` juste au-dessus et pour la même raison — un uniforme absent
 * rend SA valeur neutre, jamais celle du voisin.
 *
 * @param {object|null} uniformes les uniformes du matériau de mer du socle
 * @returns {{transparence:number, soleilFx:number, jour:number, detail:number}}
 */
export function lameEauDuSocle(uniformes) {
  const lire = (nom, neutre) => {
    const v = uniformes?.[nom]?.value
    return Number.isFinite(v) ? v : neutre
  }
  return {
    transparence: lire('uTransp', LAME_EAU_NEUTRE.transparence),
    soleilFx: lire('uSunFx', LAME_EAU_NEUTRE.soleilFx),
    jour: lire('uDayLight', LAME_EAU_NEUTRE.jour),
    detail: lire('uDetail', LAME_EAU_NEUTRE.detail),
  }
}

/** Le seuil du glacis de lagon. `ocean.js` : `smoothstep(0.0, 0.35, uTransp)`. */
export const LAGON_FIN = 0.35

/** Le poids du glacis de lagon, tiré de la tirette de transparence. */
export function poidsLagon(transparence) {
  return pas0a1(0, LAGON_FIN, transparence)
}

/** L'exposant du dégradé de lagon. `ocean.js` : `pow(dRt, 0.7)`. */
export const LAGON_EXPO = 0.7

/** Les trois bornes de l'opacité d'eau brute. `ocean.js` : `mix(0.45, 0.95, pow(d, 0.55))`. */
export const OPACITE_EAU = Object.freeze({ bas: 0.45, haut: 0.95, expo: 0.55 })

/** Les deux bornes du facteur de tirette. `ocean.js` : `mix(1.15, 0.26, uTransp)`. */
export const TIRETTE_EAU = Object.freeze({ opaque: 1.15, clair: 0.26 })

/** L'écrêtage de l'opacité d'eau. `ocean.js` : `clamp(…, 0.05, 0.97)`. */
export const OPACITE_ECRETAGE = Object.freeze({ bas: 0.05, haut: 0.97 })

/**
 * L'opacité de la lame d'eau — `wOp` d'`ocean.js`, transcrite terme pour terme.
 *
 * ⚠️ **LES QUATRE LIGNES SONT DANS L'ORDRE D'`ocean.js`, ET L'ORDRE COMPTE** :
 * l'écrêtage tombe AVANT le plancher de Fresnel, et le glacis de lagon ferme la
 * marche. Les intervertir change le résultat sur les bords et sur les eaux
 * peintes (`transparence < 0,35`, où la lame redevient une PEINTURE pleine).
 */
export function opaciteEau(dLagon, transparence, fresnel) {
  const lagon = poidsLagon(transparence)
  let w = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(Math.max(dLagon, 0), OPACITE_EAU.expo)
  w *= TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * transparence
  w = Math.min(OPACITE_ECRETAGE.haut, Math.max(OPACITE_ECRETAGE.bas, w))
  w = Math.max(w, fresnel * 0.5)
  return 1 + (w - 1) * lagon
}

/** L'assombrissement nocturne du corps de l'eau. `ocean.js` : `vec3(0.10, 0.16, 0.30)`. */
export const NUIT_EAU = Object.freeze([0.1, 0.16, 0.3])

/** L'assombrissement nocturne de l'écume. `ocean.js` : `mix(0.14, 1.0, uDayLight)`. */
export const NUIT_ECUME = 0.14

/** Le facteur et le biais du clapot de normale. `ocean.js` : `uDetail * 0.6 * uViewCalm * vec3(n1-0.5, 0.9, n2-0.5)`. */
export const CLAPOT_NORMALE = Object.freeze({ gain: 0.6, haut: 0.9, freq: 6 })

/** La modulation du glint par la tavelure. `ocean.js` : `(0.35 + 0.85 * patchy)`. */
export const GLINT_TAVELURE = Object.freeze({ base: 0.35, gain: 0.85 })

// ── ③ LA TAVELURE ET LE BRUIT ──────────────────────────────────────────────

/**
 * La fréquence de la tavelure, **PAR UNITÉ DE SOCLE**. `ocean.js:537` :
 * `vnoise(xz * 0.33 + …)` où `xz = vWorld.xz`, donc des unités de socle.
 *
 * ⚠️ **LA CALOTTE ÉCRIVAIT `vLocal * 0.33 / uMerLambda * 0.08`**, c'est-à-dire
 * en espace de SPECTRE avec un facteur `0,08` qui n'existe nulle part dans
 * `ocean.js`. Relevé sur la page vivante (La Réunion z12,
 * `uMerLambda = 0,0032204`, largeur du crop `0,429` unité de scène) : la cellule
 * de tavelure faisait **28,4 % de la largeur du bloc** contre **5,41 %** sur le
 * socle (`1 / 0,33 / 56`). **5,25 fois trop large — ce sont les plaques.**
 */
export const FREQ_TAVELURE = 0.33

/** Les deux bornes du seuil de tavelure. `ocean.js:537`. */
export const TAVELURE_SEUIL = Object.freeze({ bas: 0.32, haut: 0.72 })

// ── ④ L'ÉCUME ──────────────────────────────────────────────────────────────

/** Les poids des trois termes. `ocean.js:565` : `crestFoam + shoreFoam * 1.8 + swash * 1.1`. */
export const POIDS_RESSAC = 1.8
export const POIDS_LISERE = 1.1

/** Le blanc de l'écume. `ocean.js:594` : `vec3(0.96)`. */
export const BLANC_ECUME = 0.96

/** Les moutons : `ocean.js:554`. */
export function ecumeMoutons({ foam, foamEchelle, calmeVue, crete, bruit2, tavelure }) {
  return foam * foamEchelle * calmeVue * pas0a1(0.3, 0.6, crete) * pas0a1(0.35, 0.75, bruit2) * (0.5 + 0.5 * tavelure)
}

/** La largeur de la bande de ressac : `ocean.js:562`, premier facteur. */
export function largeurRessac(fade) {
  return (1 - pas0a1(0.1, 0.75, fade)) * pas0a1(0.002, 0.03, fade)
}

/** Les fronts qui arrivent vers la côte : `ocean.js:558`. */
export function frontsRessac(fade, temps, bruit1) {
  return 0.5 + 0.5 * Math.sin(fade * 14 - temps * 1.6 + bruit1 * 4)
}

/** Le ressac : `ocean.js:562`. */
export function ecumeRessac({ fade, temps, bruit1, foamEchelle, calmeVue, calmeSurface }) {
  const fronts = frontsRessac(fade, temps, bruit1)
  return largeurRessac(fade) * pas0a1(0.22, 0.55, bruit1 * 0.6 + fronts * 0.4) * (0.5 + 0.5 * foamEchelle) * calmeVue * calmeSurface
}

/** Le liseré de ressac : `ocean.js:564`. */
export function ecumeLisere({ fade, bruit1, calmeVue, calmeSurface }) {
  return (1 - pas0a1(0, 0.02, fade)) * pas0a1(0.25, 0.6, bruit1 + 0.2) * calmeVue * calmeSurface
}

/** L'écume totale : `ocean.js:565`. */
export function ecumeMer(a) {
  const m = ecumeMoutons(a)
  const r = ecumeRessac(a)
  const l = ecumeLisere(a)
  return Math.min(1, Math.max(0, m + r * POIDS_RESSAC + l * POIDS_LISERE))
}

// ── LE JUMEAU GLSL — LE MÊME TEXTE POUR LES DEUX LECTEURS ──────────────────
//
// ⚠️ **L'ORDRE DES FACTEURS EST CELUI D'`ocean.js`, FACTEUR PAR FACTEUR.** La
// multiplication flottante n'est pas associative : réordonner `a * b * c` en
// `a * (b * c)` changerait des bits, et la preuve bit-à-bit du socle (§6 du
// rapport P2, refaite ici) le verrait.
//
// ⚠️ **LES CONSTANTES SONT INTERPOLÉES DEPUIS LES EXPORTS CI-DESSUS**, pas
// réécrites : c'est ce qui permet à `test/ecume-mer.test.js` d'exiger qu'aucune
// des sept formules ne reparaisse ailleurs dans `ocean.js` ou `globe.js`.
// (Une campagne de mutation de P2 a survécu parce que ses motifs cherchaient
// `0.35` dans un texte qui portait `${PART_OMBRAGE.toFixed(2)}` : les motifs de
// ce module-ci visent les NOMS, pas les chiffres.)
// ══════════ LA LAME D'EAU EN GLSL — Tâche P6, UNE ÉCRITURE, DEUX LECTEURS ══
//
// ⚠️ **MÊME PATRON QUE `GLSL_ECUME` JUSTE DESSOUS, ET POUR LA MÊME RAISON.**
// Ces trois lois vivaient **uniquement** dans `ocean.js` ; la calotte du globe
// n'en portait qu'un fragment tronqué (`mix(uMerPeu, uMerFond, pow(d, 0.7))` et
// `mix(0.45, 0.95, pow(d, 0.55))`, sans la tirette, sans le glacis, sans la
// nuit). Les recopier aurait fait une seconde écriture de plus ; **on les
// extrait, et `ocean.js` INJECTE le même texte.**
export const GLSL_LAME_EAU = /* glsl */ `
// ── ecume-mer.js — INJECTÉ, PAS RECOPIÉ ────────────────────────────────────
float poidsLagonEau(float transparence) {
  return smoothstep(0.0, ${LAGON_FIN.toFixed(2)}, transparence);
}
vec3 corpsEau(vec3 peu, vec3 fond, float dLagon, float lagon, float jour) {
  vec3 c = mix(fond, mix(peu, fond, pow(dLagon, ${LAGON_EXPO.toFixed(1)})), lagon);
  return c * mix(vec3(${NUIT_EAU[0].toFixed(2)}, ${NUIT_EAU[1].toFixed(2)}, ${NUIT_EAU[2].toFixed(2)}), vec3(1.0), jour);
}
float opaciteEau(float dLagon, float transparence, float fresnel) {
  float lagon = poidsLagonEau(transparence);
  float w = mix(${OPACITE_EAU.bas.toFixed(2)}, ${OPACITE_EAU.haut.toFixed(2)}, pow(dLagon, ${OPACITE_EAU.expo.toFixed(2)}));
  w = clamp(w * mix(${TIRETTE_EAU.opaque.toFixed(2)}, ${TIRETTE_EAU.clair.toFixed(2)}, transparence), ${OPACITE_ECRETAGE.bas.toFixed(2)}, ${OPACITE_ECRETAGE.haut.toFixed(2)});
  w = max(w, fresnel * 0.5);
  return mix(1.0, w, lagon);
}
vec3 clapotNormale(vec3 normale, float detail, float calmeVue, float b1, float b2) {
  return normalize(normale + detail * ${CLAPOT_NORMALE.gain.toFixed(1)} * calmeVue * vec3(b1 - 0.5, ${CLAPOT_NORMALE.haut.toFixed(1)}, b2 - 0.5));
}
float glintTavelureMer(float tavelure) {
  return ${GLINT_TAVELURE.base.toFixed(2)} + ${GLINT_TAVELURE.gain.toFixed(2)} * tavelure;
}
vec3 blanchirEcume(vec3 col, float ecume, float jour) {
  return mix(col, vec3(${BLANC_ECUME.toFixed(2)}) * mix(${NUIT_ECUME.toFixed(2)}, 1.0, jour), ecume);
}
`

export const GLSL_ECUME = /* glsl */ `
// ── ecume-mer.js — INJECTÉ, PAS RECOPIÉ ────────────────────────────────────
float declinRivageMer(float profondeur, float distance) {
  return max(profondeur * ${POIDS_PROFONDEUR.toFixed(1)}, distance);
}
float fonduRessacMer(float declin) {
  return smoothstep(0.0, ${FONDU_RESSAC_FIN.toFixed(2)}, declin);
}
float fonduHouleMer(float declin) {
  return smoothstep(0.0, ${FONDU_HOULE_FIN.toFixed(2)}, declin);
}
float tavelureMer(float bruit) {
  return smoothstep(${TAVELURE_SEUIL.bas.toFixed(2)}, ${TAVELURE_SEUIL.haut.toFixed(2)}, bruit);
}
float largeurRessacMer(float fade) {
  return (1.0 - smoothstep(0.10, 0.75, fade)) * smoothstep(0.002, 0.03, fade);
}
float ecumeMer(
  float crete, float fade, float bruit1, float bruit2, float tavelure, float temps,
  float foam, float foamEchelle, float calmeVue, float calmeSurface
) {
  float moutons = foam * foamEchelle * calmeVue * smoothstep(0.30, 0.60, crete) * smoothstep(0.35, 0.75, bruit2) * (0.5 + 0.5 * tavelure);
  float fronts = 0.5 + 0.5 * sin(fade * 14.0 - temps * 1.6 + bruit1 * 4.0);
  float ressac = largeurRessacMer(fade) * smoothstep(0.22, 0.55, bruit1 * 0.6 + fronts * 0.4) * (0.5 + 0.5 * foamEchelle) * calmeVue * calmeSurface;
  float lisere = (1.0 - smoothstep(0.0, 0.02, fade)) * smoothstep(0.25, 0.6, bruit1 + 0.2) * calmeVue * calmeSurface;
  return clamp(moutons + ressac * ${POIDS_RESSAC.toFixed(1)} + lisere * ${POIDS_LISERE.toFixed(1)}, 0.0, 1.0);
}
`
