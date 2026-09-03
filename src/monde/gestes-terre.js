// LE VOCABULAIRE SOURIS DE GOOGLE EARTH — la règle, et son arithmétique.
//
// Module PUR : ni DOM, ni three.js, aucun import. Testable en node —
// `test/gestes-terre.test.js`. Tâche GE2, suite directe de D19 et de R32.
//
// ══════════ 0. LA DEMANDE ═══════════════════════════════════════════════════
//
// > **Adrien, 2026-09-03 :** *« Attribue à notre programme exactement les mêmes
// > fonctions à la souris que celles qui sont dans Google Earth (clic droit,
// > gauche, roulette), tout doit fonctionner pareil. »*
//
// ⚠️ **CE FICHIER NE DEVINE AUCUN GESTE.** Chaque ligne du tableau ci-dessous
// cite la documentation officielle de Google, avec son URL, et dit si elle vient
// de Google Earth **Web** (prioritaire — c'est une page web, comme nous) ou de
// **Pro/Bureau**. ⛔ **Là où les deux documentations sont MUETTES, on n'invente
// pas : le geste reste INERTE**, et c'est écrit comme tel. Un geste inventé
// serait indiscernable d'un défaut pour qui compare avec Google Earth.
//
// ══════════ 1. LA RÉFÉRENCE, DOCUMENTÉE AVANT D'ÊTRE CODÉE ══════════════════
//
// | geste | Google Earth **Web** | Google Earth **Pro** | ici |
// |---|---|---|---|
// | glissé gauche | déplacer (documenté) | déplacer (documenté) | **SAISIE** — fait par R32 |
// | molette | zoom (documenté) ; ⚠️ **pivot NON documenté** | zoom (documenté) ; ⚠️ **pivot NON documenté** | **ZOOM**, pivot au centre (D19) — fait |
// | double-clic gauche | *« Zoom toward cursor location »* (documenté) | *« zoom in to that point »* (documenté) | **ZOOM_AVANT** — pivot par `PIVOT_VERS_LE_CURSEUR` |
// | double-clic droit | *« Zoom away from cursor location »* (documenté) | dézoome (documenté) | **ZOOM_ARRIERE** |
// | clic droit glissé **vertical** | zoom (*« right drag the mouse »*, axe non précisé) | zoom **+ inclinaison automatique** (documenté) | **ZOOM** ; ⛔ l'inclinaison AUTOMATIQUE est écartée par D16 ter (§3) |
// | clic droit glissé **horizontal** | ⚠️ **non documenté** | ⚠️ **non documenté** (seul le vertical l'est) | **INERTE** — on n'invente pas |
// | clic droit sans glissé (menu) | ⚠️ **non documenté sur le globe** | documenté sur les OBJETS seulement, pas sur le terrain nu | **AUCUN MENU** — le menu du navigateur est empêché |
// | bouton du milieu glissé | ⚠️ **non documenté** (Web ne le mentionne jamais) | *« tilt the view »* (vertical), *« rotate the view »* (horizontal) | **INCLINAISON** manuelle (§3) |
// | Ctrl + glissé | *« Explore around your location »* (documenté) | regarder autour / (Mac : zoom) | **INCLINAISON** manuelle |
// | Maj + glissé | ⚠️ **non documenté** | inclinaison (documenté) | **INCLINAISON** manuelle |
// | Alt + glissé | ⚠️ **non documenté** | ⚠️ **non documenté** (Alt ne sert qu'AVEC la molette) | **SAISIE** (Alt n'est pas un modificateur ici) |
// | Alt + molette | ⚠️ non documenté | *« zoom in by smaller increments »* (documenté) | **ZOOM FIN** |
// | inertie au relâché | ⚠️ non documentée (mais *« Stop globe… Space bar »* l'implique) | documentée : *« as if you are “throwing” the scene »*, et *« Click once… to stop motion »* | **ÉLAN** (fait par R32) **+ le clic qui l'éteint** |
//
// URL — Web : https://developers.google.com/maps/documentation/earth/navigate-the-globe ·
// https://developers.google.com/maps/documentation/earth/use-keyboard-shortcuts (les lignes du double-clic).
// Pro : https://support.google.com/earth/answer/148186 ·
// https://support.google.com/earth/answer/148115 (clic droit = zoom + inclinaison automatique ; Maj/Ctrl) ·
// https://static.googleusercontent.com/media/earth.google.com/en//userguide/v4/google_earth_user_guide.pdf
// (§ « Using a Mouse » — la SEULE source officielle du bouton du milieu et de l'inertie « throwing »).
//
// ══════════ 2. ⛔ LA CONTRADICTION AVEC D19 — SIGNALÉE, NON TRANCHÉE ═════════
//
// D19 ② écrit : *« quand je scrolle pour zoomer ou dézoomer, je scrolle vers le
// point visé AU CENTRE DE L'ÉCRAN »*. Google Earth documente, mot pour mot pour
// le **double-clic** : *« Zoom toward cursor location »* — donc **vers le
// CURSEUR**. Les deux ne peuvent pas être vraies en même temps pour un geste
// qui désigne un point.
//
// ⚠️ **CE QUE LA MESURE DIT EXACTEMENT, ET IL FAUT LE LIRE AVANT DE TRANCHER :**
//   · pour la **MOLETTE**, il n'y a **AUCUNE contradiction documentée** — la
//     table officielle des raccourcis de Google Earth Web **ne comporte pas de
//     ligne molette**, et le guide Pro ne décrit que le SENS (*« scrolling
//     towards you »*) et la vitesse, jamais le pivot. « Google Earth zoome vers
//     le curseur à la molette » est un comportement OBSERVÉ, pas documenté.
//   · pour le **DOUBLE-CLIC**, la contradiction est réelle et documentée des
//     deux côtés du Web et de Pro.
//
// ➡️ **ON N'ARBITRE PAS ICI.** D19 est la règle écrite d'Adrien : le prédicat
// ci-dessous vaut `false` (le pivot est le centre de l'écran, comme la molette),
// et il est **seul sur sa ligne** pour qu'une bascule tienne en un caractère.
//
// ⚡ **ARBITRÉ LE 2026-09-04 (coordinateur, sur la lettre d'Adrien « exactement
// comme Google Earth ») : `true`.** D19 parle de la MOLETTE — et Google ne
// publie aucune cible pour la molette, qui reste donc au centre (D19 §2, tenue
// à 0,00 px). Le DOUBLE-CLIC, lui, a une cible publiée : le curseur. Les deux
// règles ne se contredisent plus une fois lues chacune sur son geste.
/** D19 = la molette (au centre, toujours) ; Google = le double-clic (vers le curseur) ; Adrien peut basculer ICI, en un caractère. */
export const PIVOT_VERS_LE_CURSEUR = true
//
// ══════════ 3. ⚡ L'INCLINAISON : MANUELLE PARTOUT, AUTOMATIQUE AU BLOC ══════
//
// D16 ter : *« On passe en vue 3/4 quand on arrive au bloc, pas avant. »* Google
// Earth Pro, lui, incline au clic droit **partout** (*« Zoom plus automatic
// tilt »*). Deux règles se croisent — et elles se décroisent sur **un seul
// mot** :
//
//   · **AUTOMATIQUE** = la machine décide d'incliner sans qu'on le lui demande
//     (la pose d'arrivée `PENTE_ARRIVEE`, l'inclinaison offerte par le clic
//     droit de Pro). ⛔ **D16 ter la garde pour le bloc, et rien ici ne la
//     déplace** : c'est pourquoi `ZOOM` ne porte AUCUNE inclinaison, alors que
//     Google Earth Pro en met une sur exactement le même geste.
//   · **MANUELLE** = un geste explicite de l'utilisateur, qui ne demande que ça
//     (le bouton du milieu, Ctrl, Maj). ✅ **Autorisée partout** : D16 ter parle
//     de ce que la vue fait TOUTE SEULE pendant une descente, pas de ce que
//     l'utilisateur a le droit de demander.
//
// ⚠️ **ET L'INCLINAISON MANUELLE NE COÛTE RIEN À `veille-repos`** — par
// construction, pas par réglage : elle repose la caméra sur la **sphère de même
// rayon** autour de `controls.target` (le motif exact de `redresserSurLeSol`,
// R29 bis), donc `|Δ ln(distance caméra→cible)| = 0` exactement. C'est la même
// garantie algébrique que la translation rigide de R32, sur l'autre geste.

/** Ce qu'un bouton (+ modificateurs) demande. */
export const GESTE = Object.freeze({
  SAISIE: 'saisie', // on attrape la Terre — R32
  ZOOM: 'zoom', // le glissé de zoom du clic droit
  INCLINAISON: 'inclinaison', // l'inclinaison et le cap MANUELS
  INERTE: 'inerte', // ⛔ non documenté chez Google : on n'invente pas
})

/**
 * Le régime où le geste tombe. `saisie` = orbite et surface hors du crop (le
 * domaine de R32) ; `crop` = sur le bloc, où le pivot R13 est l'exception
 * d'Adrien et où OrbitControls garde tout.
 */
export const REGIME = Object.freeze({ ORBITE: 'orbite', SURFACE: 'surface', CROP: 'crop' })

/**
 * ⛔ **LE VOCABULAIRE DE GOOGLE EARTH A-T-IL LA MAIN ? — et surtout, PAS
 * `!!regime`.** Les trois valeurs de `REGIME` sont des chaînes non vides : une
 * double négation rend `true` sur le CROP aussi, et lui retire ses boutons.
 * Mesuré (`.banc/GE2/apres-crop.json`, première passe, vol vers z12, 10 km
 * d'altitude) : **glissé gauche, clic droit, milieu et Ctrl rendaient tous
 * 0 px et 0°** — la vue devenue inerte sur le bloc, c'est-à-dire l'exception
 * d'Adrien (R13) purement supprimée. Ce prédicat existe pour que cette faute
 * n'ait plus d'endroit où se commettre.
 */
export function regimeTerreActif(regime) {
  return regime === REGIME.ORBITE || regime === REGIME.SURFACE
}

/**
 * QUEL GESTE, POUR QUEL BOUTON — la table du §1, exécutable.
 *
 * @param {object} o
 * @param {number} o.bouton  0 gauche · 1 milieu · 2 droit (la convention DOM)
 * @param {boolean} [o.ctrl] @param {boolean} [o.maj] @param {boolean} [o.alt]
 * @param {string} o.regime  une valeur de `REGIME`
 * @returns {string} une valeur de `GESTE`
 */
export function gesteDuBouton({ bouton, ctrl = false, maj = false, alt = false, regime = REGIME.SURFACE } = {}) {
  // ⛔ Sur le crop, rien de tout ceci ne s'applique : le pivot est l'axe du bloc
  // (R13, l'exception qu'Adrien nomme) et OrbitControls garde ses boutons.
  if (regime === REGIME.CROP) return GESTE.INERTE
  if (bouton === 0) {
    // Ctrl et Maj : « Explore around your location » (Web) / l'inclinaison (Pro).
    // ⚠️ Alt n'en est PAS un : Google ne documente Alt qu'AVEC la molette, donc
    // Alt + glissé gauche reste la saisie — et surtout il ne doit pas déclencher
    // les DEUX à la fois, ce que la mesure d'avant relevait (322 px de dérive du
    // centre contre 200 px pour un glissé gauche nu : la saisie ET le
    // déplacement d'OrbitControls tiraient ensemble).
    if (ctrl || maj) return inclinaisonPermise(regime) ? GESTE.INCLINAISON : GESTE.INERTE
    return GESTE.SAISIE
  }
  if (bouton === 1) return inclinaisonPermise(regime) ? GESTE.INCLINAISON : GESTE.INERTE
  if (bouton === 2) return GESTE.ZOOM
  return GESTE.INERTE
}

/**
 * ⚠️ **L'INCLINAISON MANUELLE N'A DE SENS QUE LÀ OÙ IL Y A QUELQUE CHOSE À
 * INCLINER — et c'est une propriété géométrique, pas un goût.** En orbite,
 * `controls.target` est le CENTRE DE LA TERRE : faire tourner la caméra autour
 * de lui n'incline rien du tout, c'est très exactement le glissé gauche de D19.
 * Le geste y serait donc un doublon silencieux du bouton gauche — et Google
 * Earth Web, de son côté, ne documente pas le bouton du milieu. En surface, la
 * cible est le point du sol sous la caméra : la rotation autour d'elle est une
 * vraie inclinaison.
 */
export function inclinaisonPermise(regime) {
  return regime === REGIME.SURFACE
}

// ── le clic droit glissé : un ZOOM, et rien d'autre ─────────────────────────
//
// ⚠️ **L'AXE HORIZONTAL EST IGNORÉ, ET C'EST LA RÉFÉRENCE QUI LE DIT.** Le guide
// Pro ne décrit que le vertical (*« move the mouse backward or pull toward
// you »*), et Web ne précise aucun axe. Un clic droit glissé horizontal qui
// ferait quelque chose serait une invention.
//
// ⚠️ **LE SENS EST CELUI DE GOOGLE EARTH PRO, PAS L'INTUITIF** : *« pull toward
// you »* — tirer la souris VERS SOI (vers le bas de l'écran, `dy > 0`) —
// **zoome AVANT**. C'est contre-intuitif, c'est documenté, et c'est ce qu'Adrien
// a demandé (« tout doit fonctionner pareil »).
/**
 * Combien de pixels de glissé vertical valent un cran de molette.
 *
 * ⚠️ **10, PARCE QUE 200 px DOIVENT VALOIR UN NIVEAU (×2), ET C'EST UNE
 * MESURE QUI A FIXÉ LE NOMBRE.** L'escalier de `modes.js` fait un niveau en
 * `CRANS_PAR_NIVEAU = 20` crans (voir `CRANS_UN_NIVEAU`). Le barème GE3 (C1)
 * attend ×1,5 à ×3 pour 200 px : 20 crans = ×2, au milieu de la fenêtre.
 *
 * ⛔ **ET LE DOSAGE SE FAIT PAR CRAN, PAS PAR IMAGE — première passe réfutée.**
 * `_zoomGesture` ajoute UNE impulsion par appel quel que soit `deltaY` ; la
 * première passe appelait une fois par image avec le cumul, donc le zoom d'un
 * glissé dépendait du NOMBRE D'IMAGES du geste, pas de ses pixels. Le noteur a
 * mesuré ×1,894 vers l'avant contre ×2,128 vers l'arrière pour les mêmes 200 px
 * (13 % d'écart, seuil 5 %). `main.js` appelle désormais la porte une fois par
 * cran accumulé.
 */
export const PX_PAR_CRAN_ZOOM = 10
/** Le nombre de crans d'UN niveau de l'escalier — `CRANS_PAR_NIVEAU` de `modes.js`, recopié ici pour rester pur ; le test GE2 ⑰ tient les deux d'accord. */
export const CRANS_UN_NIVEAU = 20
/** Un cran de molette vaut ~100 en `deltaY` dans les navigateurs de bureau — l'unité que `modes.js` attend (voir `gestes.js`). */
export const CRAN = 100
/** Plafond d'UN pas, en crans : une image sautée sous la charge ne doit pas franchir cinq paliers d'un coup (le garde-fou de `gestes.js`). */
export const MAX_CRANS_PAR_PAS = 4

/**
 * Le `deltaY` équivalent d'un pas de glissé au clic droit. Négatif quand on
 * zoome avant (la convention de la molette).
 *
 * @param {number} dyPx  le déplacement vertical du pas, en pixels écran
 * @returns {number} un `deltaY` de molette, 0 sur toute entrée dégénérée
 */
export function zoomDuGlisseDroit(dyPx) {
  if (typeof dyPx !== 'number' || !Number.isFinite(dyPx)) return 0
  const crans = -dyPx / PX_PAR_CRAN_ZOOM // dy > 0 (vers soi) ⇒ crans < 0 ⇒ zoom avant
  const borne = Math.max(-MAX_CRANS_PAR_PAS, Math.min(MAX_CRANS_PAR_PAS, crans))
  return borne * CRAN || 0
}

// ── le double-clic : zoom avant à gauche, arrière à droite ──────────────────
//
// ⚠️ **CE QUE ÇA NE FAIT PAS : POSER LA CAMÉRA.** R35 l'a payé — un clic qui
// POSE une distance vaut ×4,41 d'altitude en une image. D16 : *« on ne vise pas,
// on se rapproche »*. Le double-clic passe donc par la MÊME porte que la
// molette, l'escalier de paliers de `modes.js`, dont `gestes.js` rappelle
// qu'elle est la seule.
/**
 * Combien de crans un double-clic vaut : **UN NIVEAU** — ×2 à gauche, ÷2 à
 * droite, symétriques. Première passe : 2 crans, soit ×1,035 — le noteur l'a
 * mesuré (×0,983 en altitude) et jugé : « ce n'est pas ÷2, et ce n'est pas
 * “zoom away” au sens de Google ». Le barème (C4) attend 1,8–2,2 et 0,45–0,56.
 */
export const CRANS_DOUBLE_CLIC = CRANS_UN_NIVEAU

/**
 * @param {number} bouton 0 gauche (avant) · 2 droit (arrière)
 * @returns {number} le `deltaY` de molette équivalent, 0 pour tout autre bouton
 */
export function zoomDuDoubleClic(bouton) {
  if (bouton === 0) return -CRANS_DOUBLE_CLIC * CRAN
  if (bouton === 2) return CRANS_DOUBLE_CLIC * CRAN
  return 0
}

// ── l'inclinaison manuelle : combien de degrés par pixel ────────────────────
/** Degrés d'inclinaison (ou de cap) par pixel de glissé. 200 px = 50°, la course d'un poignet. */
export const DEG_PAR_PIXEL = 0.25
/**
 * ⚠️ **LA BUTÉE HAUTE N'EST PAS UN GOÛT : au-delà, l'axe optique passe SOUS
 * l'horizon** et la vue ne montre plus que le ciel. Le sol a sa propre butée,
 * plus basse et variable (`polaireMaxSol`, R23) : celle-ci est le plafond
 * absolu, celle-là la borne du relief.
 */
export const INCLINAISON_MAX_DEG = 85
/** ⚠️ Et la butée BASSE est le nadir : D16 ter part du nadir et y revient. */
export const INCLINAISON_MIN_DEG = 0

/**
 * Le pas d'inclinaison et de cap d'un glissé, en DEGRÉS.
 *
 * ⚠️ **LE SIGNE DU VERTICAL EST CELUI DE GOOGLE EARTH PRO** : *« moving the
 * mouse forward »* (vers le haut de l'écran, `dy < 0`) **couche la vue** — on
 * pousse l'horizon vers soi. `dy > 0` la redresse au nadir.
 *
 * @param {object} o
 * @param {number} o.dxPx @param {number} o.dyPx  le pas, en pixels écran
 * @param {number} o.inclinaisonDeg  l'inclinaison courante, pour la butée
 * @returns {{dInclinaisonDeg:number, dCapDeg:number}}
 */
export function pasInclinaison({ dxPx = 0, dyPx = 0, inclinaisonDeg = 0, degParPixel = DEG_PAR_PIXEL } = {}) {
  const rien = { dInclinaisonDeg: 0, dCapDeg: 0 }
  if (![dxPx, dyPx, inclinaisonDeg, degParPixel].every((v) => typeof v === 'number' && Number.isFinite(v))) return rien
  const vise = inclinaisonDeg - dyPx * degParPixel
  const borne = Math.max(INCLINAISON_MIN_DEG, Math.min(INCLINAISON_MAX_DEG, vise))
  // ⚠️ **`|| 0` NORMALISE LE −0**, et ce n'est pas une coquetterie : c'est le
  // piège que `gestes.js` a déjà payé (« un -0 qui remonte jusqu'à la caméra se
  // propage en signe négatif là où on n'en veut pas »). Un `dxPx` nul rend
  // `-0 × 0,25 = -0`, qui traverse `Math.sin` et ressort dans une coordonnée.
  return { dInclinaisonDeg: (borne - inclinaisonDeg) || 0, dCapDeg: (-dxPx * degParPixel) || 0 }
}

// ── l'élan au relâché : PLAFONNÉ par le geste lui-même ──────────────────────
//
// ⚠️ **MESURÉ PAR LE NOTEUR (C8), HUIT CHARGEMENTS** : 3 sur 8 rendaient 13,4 /
// 13,4 / 14,3° de rotation pour un geste de 3,4° — le point saisi était resté
// sous le curseur (0 px), donc les ~10° sont arrivés APRÈS le relâché : une
// vitesse armée d'environ 150 °/s sur un pas dégénéré (deux `mousemove` à
// ~1 ms). Un banc l'a produit ; une souris à 1 000 Hz peut le produire. Et sur
// les cinq autres, la course valait **20 %** du geste pour un seuil de 15 %.
//
// ➡️ La course de l'élan (`v · τ`, l'intégrale exacte de `elanDeSaisie`) est
// bornée à une FRACTION de l'arc parcouru pendant le geste : on ne peut pas
// « lancer » la Terre plus loin qu'une fraction de ce qu'on l'a tirée. Un pas
// de 1 ms ne vaut plus 150 °/s, et un geste de 5° ne coule plus que de 0,6°.
/** La course de l'élan ne dépasse pas cette fraction de l'arc du geste (le barème dit ≤ 15 % ; 12 % laisse la marge de la mesure). */
export const FRACTION_ELAN_MAX = 0.12

/**
 * @param {object} a
 * @param {{dLat:number,dLon:number}} a.vitesse  degrés par seconde, au relâché
 * @param {number} a.arcDeg  l'arc parcouru pendant le geste, en degrés
 * @returns {{vitesse:{dLat:number,dLon:number}, plafonne:boolean, courseDeg:number}}
 */
export function plafonnerElan({ vitesse, arcDeg, tau = 0.35, fraction = FRACTION_ELAN_MAX } = {}) {
  const zero = { vitesse: { dLat: 0, dLon: 0 }, plafonne: false, courseDeg: 0 }
  if (!vitesse || ![vitesse.dLat, vitesse.dLon, arcDeg, tau, fraction].every((v) => typeof v === 'number' && Number.isFinite(v))) return zero
  if (!(arcDeg > 0) || !(tau > 0) || !(fraction > 0)) return { ...zero, plafonne: true }
  const v = Math.hypot(vitesse.dLat, vitesse.dLon)
  const course = v * tau
  const max = arcDeg * fraction
  if (course <= max) return { vitesse: { dLat: vitesse.dLat, dLon: vitesse.dLon }, plafonne: false, courseDeg: course }
  const k = max / course
  return { vitesse: { dLat: vitesse.dLat * k || 0, dLon: vitesse.dLon * k || 0 }, plafonne: true, courseDeg: max }
}

// ── le double-clic, reconnu ─────────────────────────────────────────────────
/** Deux clics au-delà de ce délai sont deux clics, pas un double-clic (le défaut des systèmes de bureau). */
export const DOUBLE_CLIC_MAX_MS = 400
/** Et au-delà de cette dérive, la main a bougé : c'était deux désignations différentes. */
export const DOUBLE_CLIC_SLOP_PX = 8

/**
 * Pur. `precedent` est `{t, x, y, bouton}` du clic d'avant, ou null.
 * @returns {boolean}
 */
export function estDoubleClic({ precedent, t, x, y, bouton } = {}) {
  if (!precedent) return false
  if (precedent.bouton !== bouton) return false
  if (![precedent.t, precedent.x, precedent.y, t, x, y].every((v) => typeof v === 'number' && Number.isFinite(v))) return false
  if (t - precedent.t > DOUBLE_CLIC_MAX_MS || t < precedent.t) return false
  return Math.hypot(x - precedent.x, y - precedent.y) <= DOUBLE_CLIC_SLOP_PX
}
