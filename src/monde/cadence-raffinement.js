// LA CADENCE DU RAFFINEMENT DU SOCLE — Tâche GEL (mission du 2026-09-05 b).
//
// Module PUR : ni DOM, ni three.js, ni état. Il rend des nombres et des
// booléens. Tout se vérifie sous node (`test/cadence-raffinement.test.js`).
//
// ══════════ 0. LE DÉFAUT — « LE LOGICIEL SE FIGE À Z7 » ═════════════════════
//
// > **Adrien, 2026-09-05 :** *« j'ai des freezes complets du logiciel qui me
// > forcent à actualiser (comme par exemple dans la vidéo quand j'arrive à Z7,
// > je ne peux plus rien faire). »*
//
// ⛔ **CE N'EST NI UNE BOUCLE INFINIE NI UNE PROMESSE PERDUE : C'EST LE FIL
// PRINCIPAL SATURÉ PAR LE RAFFINEMENT DU SOCLE.** Mesuré (`scripts/sonde-gel.mjs`,
// Sulawesi −4,4349 / 121,7735, molette depuis l'orbite jusqu'à z7, Chrome sans
// tête, CPU ×4, DPR 2, profil CDP, `.banc/GEL/base-x4-dpr2-prof/`) :
//
//   | palier | fil occupé | `rafraichirFenetre` | `plinth.rebuild` |
//   |---|---|---|---|
//   | z5 | **97 %** (7,9 s sur 8,1) | 13 × 2 703 ms | 15 × 1 071 ms |
//   | z6 | **99 %** | 26 × 6 308 ms | 28 × 2 004 ms |
//   | z7 (15 s après l'arrivée) | **76 %** (11,4 s sur 15) | 14 × 3 713 ms | 16 × 1 089 ms |
//
// Et sur la base d'AVANT les neuf fusions (`6275e62`, même banc) : **99 % à
// chaque palier**, 21 × 9 832 ms à z5, 15 × 7 088 ms à z7. Le défaut est plus
// vieux que les fusions ; FLU l'a réduit (le coût unitaire ÷ 1,8), pas fermé.
//
// Le mécanisme : `socleRaffine` (main.js) rejoue `terrain.rafraichirFenetre`
// — 591 361 sommets rééchantillonnés, bathymétrie fusionnée, normales — puis
// `plinth.rebuild`, **à chaque tuile qui atterrit**, avec pour seule borne un
// écart FIXE de 350 ms entre deux départs. Vingt-cinq tuiles sont réservées par
// palier (9 + la marge des parois) ; sur une machine où un raffinement coûte
// plus que l'écart — un iMac 2015 à DPR 2, la machine d'Adrien —, le fil ne
// rend jamais la main : la molette est avalée (`busy`, `_zoomGesture`), la
// caméra ne bouge plus, et seuls les minuteurs DOM passent entre deux tâches
// (le cartouche s'efface à l'heure dans la vidéo, `p_031`, MSG_MS = 3 600 ms —
// c'est ce qui prouve que le fil n'était PAS dans une boucle infinie).
//
// ══════════ 1. LA LOI — L'ÉCART SUIT LE COÛT, PAS L'HORLOGE ═══════════════
//
// ⚡ **Le raffinement ne peut prendre plus d'une part bornée du fil.** Si le
// dernier raffinement (nappe + socle) a coûté `c` ms, le suivant ne part pas
// avant `c / part` ms après le DÉPART du précédent (c'est depuis le départ que
// `socleRaffine` compte, et le coût est dedans) : avec `part = 1/4`, un
// raffinement de 300 ms ouvre un cycle de 1 200 ms — 900 ms de fil libre —, un
// de 1 200 ms un cycle de 4 800 ms. Le plancher de FLU (350 ms) reste : à coût
// nul, la loi est celle de FLU au bit près.
//
// ⚠️ **RIEN N'EST SAUTÉ, TOUT EST RETARDÉ.** `socleRaffine` compare la révision
// du flux à chaque image ; une révision non servie reste due, et part dès que
// l'attente est écoulée. Le premier raffinement (aucun coût connu) part au
// plancher ; le dernier part toujours (§ test « le dernier part toujours »).
// Ce qui change à l'écran : la cadence des raffinements INTERMÉDIAIRES pendant
// qu'un palier charge — pas l'état final, pas la première image.

export const RAFFINEMENT_SOCLE_MS = 350 // le plancher de FLU, inchangé
export const PART_DU_FIL = 0.25 // au plus un quart du fil principal pour le socle

/**
 * L'attente minimale (ms) entre deux départs de raffinement.
 * @param {{ dernierCoutMs?: number, plancherMs?: number, part?: number }} o
 */
export function attenteRaffinement({ dernierCoutMs = 0, plancherMs = RAFFINEMENT_SOCLE_MS, part = PART_DU_FIL } = {}) {
  const c = Number.isFinite(dernierCoutMs) && dernierCoutMs > 0 ? dernierCoutMs : 0
  const p = Number.isFinite(part) && part > 0 && part < 1 ? part : PART_DU_FIL
  return Math.max(plancherMs, c / p)
}

/**
 * Le raffinement peut-il partir maintenant ?
 * @param {{ maintenant: number, dernierDepart: number, dernierCoutMs?: number, plancherMs?: number, part?: number }} o
 */
export function raffinementDu({ maintenant, dernierDepart, dernierCoutMs, plancherMs, part }) {
  return maintenant - dernierDepart >= attenteRaffinement({ dernierCoutMs, plancherMs, part })
}

/**
 * Le banc de la loi : des tuiles qui atterrissent (une révision par arrivée),
 * un raffinement qui coûte `coutMs` de fil, une horloge simulée. Rend le nombre
 * de raffinements, l'occupation du fil et la révision servie à la fin.
 *
 * ⚠️ C'est la même machine d'états que `socleRaffine` (main.js) : la révision
 * comparée à chaque image, l'attente, le départ, le coût qui s'écoule.
 * @param {{ arrivees: number[], coutMs: number, dureeMs: number, pasMs?: number, loi?: (o: object) => number }} o
 */
export function simulerCadence({ arrivees, coutMs, dureeMs, pasMs = 16, loi = attenteRaffinement }) {
  let t = 0
  let revision = 0
  let servie = -1
  let dernierDepart = -Infinity
  let dernierCout = 0
  let occupe = 0
  let raffinements = 0
  let k = 0
  while (t < dureeMs) {
    while (k < arrivees.length && arrivees[k] <= t) { revision++; k++ }
    if (revision !== servie && t - dernierDepart >= loi({ dernierCoutMs: dernierCout })) {
      servie = revision
      dernierDepart = t
      dernierCout = coutMs
      occupe += coutMs
      raffinements++
      t += coutMs // le fil est pris pendant tout le raffinement
      continue
    }
    t += pasMs
  }
  return { raffinements, occupation: occupe / t, servie, revision, dureeMs: t }
}
