// LES RÉGLAGES DES COUCHES — la partie PURE : ce qu'une tirette vaut dans un
// uniforme, et quand une couche a le droit de s'allumer toute seule.
//
// Module pur : ni three.js, ni DOM, ni réseau. Même découpage que
// src/nuit.js et src/occupation-sol.js — la règle ici, la matière à côté.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CES CONVERSIONS EXISTENT AU LIEU D'ÊTRE ÉCRITES SUR PLACE
// ═══════════════════════════════════════════════════════════════════════════
//
// Trois raisons, et la troisième est celle qui coûte cher.
//
//   1. UNE TIRETTE NE PARLE PAS LA LANGUE DU SHADER. Adrien demande « l'opacité
//      de l'assombrissement » ; le nuanceur, lui, veut « ce qui RESTE du sol ».
//      Ce sont deux nombres opposés (0,78 d'un côté, 0,22 de l'autre). La
//      conversion est le seul endroit où cette inversion vit, et elle est
//      testée — parce qu'une inversion oubliée rend une carte qui s'éclaircit
//      quand on demande à l'assombrir, ce qui se lit comme une panne.
//
//   2. LE DOUBLE-CLIC DOIT REVENIR AU RÉGLAGE D'USINE. Le kit d'interface
//      (`slider`) mémorise la valeur de CONSTRUCTION. Les défauts doivent donc
//      être des constantes nommées et partagées, pas des littéraux recopiés
//      dans le panneau ET dans les params.
//
//   3. ⚠️ UN NaN DANS UN UNIFORME REND LA CARTE NOIRE, SANS UNE ERREUR. Le kit
//      laisse saisir une valeur au clavier (clic sur le chiffre) ; un champ
//      vidé rend `parseFloat('')`, c'est-à-dire NaN. Posé tel quel dans
//      `uSolOpacite`, il contamine tout le fragment : la carte entière devient
//      noire et la console reste muette. Chaque conversion retombe donc sur son
//      défaut plutôt que de laisser passer un non-nombre.

import { NON } from './gardien.js'

// ═══════════════════════════════════════════════════════════════════════════
// OCCUPATION DU SOL — UNE SEULE TIRETTE, ET C'EST UN CHOIX
// ═══════════════════════════════════════════════════════════════════════════
//
// Adrien : « je ne vois pas à quoi sert l'occupation des sols telle quelle, ça
// ne fait presque aucun changement sur la map, mets des tirettes de réglage
// aussi. » La question posée était : une force globale, ou une force par
// famille ? C'est UNE force globale, pour trois raisons.
//
//   · LE DOSAGE RELATIF EST L'ARGUMENT ÉDITORIAL DE LA COUCHE. Le boisé et le
//     gelé parlent fort, l'ouvert parle plus bas, l'eau se tait : c'est ce
//     rapport-là qui sépare ShibuMap d'un atlas scolaire (voir l'en-tête de
//     src/occupation-sol.js). Six tirettes invitent à mettre la prairie à fond,
//     c'est-à-dire à fabriquer exactement l'aplat que la couche a été écrite
//     pour éviter. Une force globale déplace le tout SANS toucher au rapport.
//
//   · SIX TIRETTES SOUS UNE LIGNE, DANS UN PANNEAU À INTERRUPTEURS SEULS, CE
//     N'EST PLUS UNE SOUS-OPTION, C'EST UN SECOND PANNEAU. L'en-tête de
//     couches-panel.js dit pourquoi ce panneau est nu ; y greffer un pupitre
//     ferait de la vitrine du Gardien une console de rendu.
//
//   · ET LE VRAI DÉFAUT N'ÉTAIT PAS LE DOSAGE RELATIF, C'ÉTAIT LE NIVEAU. La
//     prairie peignait à 0,18 × 0,5 = 9 % : sous le seuil de perception. Le
//     correctif est de remonter le plancher (fait dans occupation-sol.js) et de
//     donner UN bouton pour en sortir dans les deux sens.
//
// ⚠️ LA FORCE A ÉTÉ DOUBLÉE LE 2026-08-02 — Adrien : « multiplie par 2 la force
// de la tirette d'occupation des sols (de 1 à 4) ». Le défaut passe de 1 à 2 et
// la course de 2 à 4.
//
// Ce n'est pas une simple mise à l'échelle : la course haute SERT, et elle sert
// aux classes FAIBLES. Le nuanceur plafonne le mélange à 1 de son côté (au-delà,
// `mix` extrapolerait hors gamme et fabriquerait des couleurs fluorescentes).
// À force 2, la prairie (0,42) peint à 0,84 et le boisé (0,90) sature déjà ;
// à force 4 la prairie atteint enfin le plafond à son tour. Autrement dit,
// monter la tirette resserre progressivement l'écart entre les familles — la
// hiérarchie boisé/ouvert s'estompe à mesure qu'on pousse, ce qui est le
// comportement attendu d'un bouton « je veux voir plus fort ».
//
// La course va jusqu'à 4 et pas 2 : le défaut est déjà « ça se voit », donc une
// tirette bornée au défaut n'offrirait que le recul.
export const SOL_FORCE_DEFAUT = 2
export const SOL_FORCE_MAX = 4

/** La tirette « Force » → `uSolOpacite`. */
export function opaciteSol(v) {
  if (!Number.isFinite(v)) return SOL_FORCE_DEFAUT
  return Math.max(0, Math.min(SOL_FORCE_MAX, v))
}

// ═══════════════════════════════════════════════════════════════════════════
// HAUTEUR DE CANOPÉE — LA MÊME TIRETTE, ET C'EST VOLONTAIRE
// ═══════════════════════════════════════════════════════════════════════════
//
// Même nom (« Force »), même course (0 à 4), même défaut (2) que l'occupation
// du sol. Ce n'est pas une recopie faute d'idée : les deux couches sont des
// lavis drapés qui modulent la même chose au même endroit du nuanceur, et deux
// courses différentes obligeraient à réapprendre le bouton en changeant de ligne
// dans le panneau. Un réglage qui se comporte pareil doit se graduer pareil.
//
// ⚠️ CE QUE LA COURSE HAUTE SERT ICI N'EST PAS CE QU'ELLE SERT LÀ-BAS, et ça
// vaut d'être su avant de retoucher les chiffres. Pour l'occupation du sol,
// pousser la tirette amène les classes FAIBLES (la prairie) à saturation et
// resserre la hiérarchie boisé/ouvert. Ici, elle amène les COUVERTS BAS —
// taillis, jeunes plantations — à peser autant que la futaie. Dans les deux cas
// monter le bouton APLATIT la lecture ; c'est le comportement attendu d'un « je
// veux voir plus fort », et c'est pour ça que le défaut n'est pas la butée.
//
// Ce qu'aucune valeur de tirette ne peut faire revenir, en revanche, c'est le
// sol nu : sous 2 m la force est nulle DANS LA TABLE (voir CANOPEE_SOL_NU dans
// src/canopee.js), et multiplier zéro par 4 rend zéro. C'est délibéré — c'est ce
// qui empêche la tirette de ramener le voile paille sur toutes les cultures du
// monde, que la rampe de force a justement été écrite pour éviter.
export const CANOPEE_FORCE_DEFAUT = 2
export const CANOPEE_FORCE_MAX = 4

/** La tirette « Force » → `uCanopeeOpacite`. */
export function opaciteCanopee(v) {
  if (!Number.isFinite(v)) return CANOPEE_FORCE_DEFAUT
  return Math.max(0, Math.min(CANOPEE_FORCE_MAX, v))
}

// ═══════════════════════════════════════════════════════════════════════════
// LUMIÈRES NOCTURNES — LES DEUX TIRETTES DEMANDÉES
// ═══════════════════════════════════════════════════════════════════════════
//
// Elles étaient deux CONSTANTES du nuanceur de src/terrain.js. Leurs
// commentaires d'origine restent la meilleure explication de ce que chacune
// fait ; ce qui suit dit seulement pourquoi la tirette n'a pas la même échelle
// que la constante.

// L'ancien `NUIT_GAIN`. Black Marble est un produit scientifique dont la
// dynamique est calée pour qu'aucune ville ne sature le capteur : peint tel
// quel, même Tokyo ne montait qu'au tiers du blanc. 3,4 est la valeur calibrée
// contre cette dynamique-là.
export const NUIT_GAIN_BASE = 3.4

// La tirette est un GAIN RELATIF : 1 = le réglage calibré, 2 = deux fois plus,
// 0 = plus de lueur du tout. Graduer la tirette en unités de shader (0 à 8)
// obligerait à savoir que 3,4 est « normal » — et le double-clic ne voudrait
// plus rien dire.
export const NUIT_FORCE_DEFAUT = 1
export const NUIT_FORCE_MAX = 2

// L'ancien `NUIT_FOND` valait 0,22 : ce qui RESTE du sol là où personne
// n'habite. La tirette, elle, dit l'inverse — « à quel point on éteint » —
// parce que c'est ce qu'Adrien a demandé (« l'opacité de l'assombrissement »)
// et parce qu'une opacité qui monte quand on pousse est le seul sens qu'une
// tirette d'opacité puisse avoir. 1 − 0,22 = 0,78.
export const NUIT_ASSOMBRISSEMENT_DEFAUT = 0.78

/** La tirette « Assombrissement » → `uNuitFond` (ce qui reste du sol). */
export function fondNuit(v) {
  const a = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : NUIT_ASSOMBRISSEMENT_DEFAUT
  return 1 - a
}

/** La tirette « Éclairage » → `uNuitGain`. */
export function gainNuit(v) {
  if (!Number.isFinite(v)) return NUIT_GAIN_BASE * NUIT_FORCE_DEFAUT
  return NUIT_GAIN_BASE * Math.max(0, Math.min(NUIT_FORCE_MAX, v))
}

// ═══════════════════════════════════════════════════════════════════════════
// L'ALLUMAGE AUTOMATIQUE DES LUMIÈRES NOCTURNES
// ═══════════════════════════════════════════════════════════════════════════
//
// Adrien : « déclenche l'éclairage nocturne automatiquement dès qu'on passe en
// mode lecture temporelle ou que la nuit se lève. »
//
// Deux déclencheurs, et TROIS garde-fous. Les garde-fous sont l'essentiel du
// fichier : un automatisme qui allume est facile, un automatisme qui sait ne
// PAS allumer est ce qui le rend supportable.
//
//   ⚠️ 1. LA NUIT NE SE DÉCIDE PAS ICI. `nuit` arrive tout cuit de
//      `darkModeFor(sunElevation, dejaSombre)` (src/daycycle.js), qui porte une
//      HYSTÉRÉSIS (bascule à −3°, retour à 0°) écrite précisément parce qu'un
//      seuil nu faisait battre l'interface quand on traîne la tirette d'heure.
//      Écrire « si elevation < −3 » ici fabriquerait un SECOND seuil, désaccordé
//      du premier : l'interface passerait en sombre et la couche s'allumerait à
//      deux instants différents, et le battement reviendrait par la fenêtre.
//
//   ⚠️ 2. LE GARDIEN GARDE LA MAIN. Une couche qui s'allume toute seule sans
//      budget est exactement ce que le Gardien existe pour empêcher — et
//      l'automatisme est le pire cas, puisque personne n'a cliqué. `verdict`
//      vient d'`evaluerCouche`. Sur un refus on n'allume pas, et `refus` sort à
//      part pour que l'appelant le DISE : un automatisme qui renonce en silence
//      se lit comme une couche cassée. Un verdict absent, en revanche, ne
//      refuse pas — c'est la règle de toute la maison (palier-machine,
//      machinePorteContinu) : pas d'information, pas de sanction.
//
//   ⚠️ 3. UN CHOIX DE L'UTILISATEUR NE S'ANNULE PAS. S'il vient d'éteindre la
//      couche à la main, la nuit qui tombe ne doit pas la rallumer sous son
//      doigt. `eteinteAlaMain` est un VETO, et il tient contre les DEUX
//      déclencheurs : le cas douloureux est celui de la lecture temporelle, où
//      un crépuscule repasse toutes les quelques secondes. L'appelant lève le
//      veto quand — et seulement quand — l'utilisateur rallume la couche
//      lui-même : c'est le seul geste qui dise sans ambiguïté « je la veux ».

export const MOTIF_LECTURE = 'lecture'
export const MOTIF_NUIT = 'nuit'

/**
 * Faut-il allumer les lumières nocturnes toutes seules, maintenant ?
 *
 * @param {object} o
 * @param {boolean} o.active - la couche est-elle déjà allumée
 * @param {boolean} o.eteinteAlaMain - l'utilisateur l'a-t-il éteinte à la main
 * @param {boolean} o.nuit - fait-il nuit (⚠️ sortie de `darkModeFor`, hystérésis comprise)
 * @param {boolean} o.lecture - la lecture temporelle tourne-t-elle
 * @param {string} [o.verdict] - le verdict du Gardien (`evaluerCouche`)
 * @returns {{allumer:boolean, motif:string|null, refus:boolean}}
 */
export function allumageAutoNuit({ active = false, eteinteAlaMain = false, nuit = false, lecture = false, verdict = null } = {}) {
  const rien = { allumer: false, motif: null, refus: false }
  // Déjà allumée : il n'y a rien à faire, et surtout rien à REFAIRE. La lecture
  // temporelle appelle ceci à chaque image ; rallumer une couche allumée
  // relancerait la construction de la mosaïque soixante fois par seconde.
  if (active) return rien
  const motif = lecture ? MOTIF_LECTURE : nuit ? MOTIF_NUIT : null
  if (!motif) return rien
  if (eteinteAlaMain) return rien // garde-fou 3 : le choix de l'utilisateur prime
  if (verdict === NON) return { allumer: false, motif, refus: true } // garde-fou 2
  return { allumer: true, motif, refus: false }
}
