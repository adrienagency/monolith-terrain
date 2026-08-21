// LA VEILLE DU SOCLE — l'automate qui tient l'état d'une image à l'autre.
// Suite de la Tâche 3 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il n'importe que `seuil-socle.js`,
// qui n'importe que `landmarks.js`. Tout se vérifie sous node
// (`test/seuil-branche.test.js`).
//
// ══════════ 0. POURQUOI CE MODULE EXISTE, ET PAS UNE LIGNE DANS `main.js` ═══
//
// La Tâche 3 a livré `socleVisible({ altitudeEllipsoideM, visibleAvant })` —
// une FONCTION, donc sans mémoire. Son compte rendu le dit en toutes lettres :
// « `visibleAvant` n'est pas un confort : c'est l'hystérésis ». Quelqu'un doit
// donc porter `visibleAvant` d'une image à l'autre, et ce quelqu'un ne peut pas
// être `src/main.js` : le §0 du plan écrit qu'**aucun test ne charge ce
// fichier**, et l'état inter-images est précisément ce qui se casse en silence.
//
// ⚠️ **CE QUE CE MODULE AJOUTE À `socleVisible`, ET QUI N'Y ÉTAIT PAS :**
//   ① la mémoire de l'hystérésis, donc le comptage des bascules ;
//   ② le **ET avec le mode** de `modes.js` — le socle n'existe qu'en surface ;
//   ③ la garantie qu'on **n'applique que sur changement**, sans quoi quatorze
//      calques seraient repassés à chaque image ;
//   ④ le **gel en orbite**, expliqué au §2 ci-dessous.
//
// ══════════ 1. L'ENTRÉE EST UNE ALTITUDE, ET RIEN D'AUTRE — RÈGLE R1 ════════
//
// `maj()` prend l'**altitude géométrique de la caméra au-dessus de
// l'ellipsoïde**, en mètres. Dans `main.js` c'est `altitudeCadrageM()`, dont la
// Tâche 1b a sorti `dem.meanM` EXPRÈS (voir le hook `surfaceCamAltCadrageM`) :
//
//   fraction d'écran → distance au sol → terrain chargé → `meanM` (lissé)
//   → seuil → emprise → `meanM` …
//
// Gain plus retard font un oscillateur, et le précédent Cesium est exact (règle
// R1 du plan). **Ne branchez jamais ce module sur une fraction d'écran, un zoom
// effectif ou un débit observé** : les trois sont dérivés du chargé.
//
// ══════════ 2. POURQUOI L'ORBITE GÈLE LE SEUIL ══════════════════════════════
//
// ⚠️ **CE N'EST PAS UNE ÉCONOMIE, C'EST UNE CORRECTION.** En mode orbital la
// caméra vit sur la sphère du globe (`R_GLOBE = 100`, `geo.js`), pas au-dessus
// de la dalle : `altitudeCadrageM()` y divise un `camera.position.y` orbital par
// l'échelle du DERNIER bloc chargé. Le nombre qui en sort n'est pas une
// altitude, c'est un résidu — et le laisser piloter l'automate ferait décider la
// naissance du socle sur du bruit. La veille conserve donc son état tant que le
// mode n'est pas « surface », et la première image de surface tranche.
//
// ⚠️ **CONSÉQUENCE ASSUMÉE :** au retour de l'orbite, la veille rend d'abord
// l'état d'AVANT le départ, puis la première `maj()` corrige. Les deux tombent
// dans la même image de `tick()` (`modes.update(dt)` puis `majSeuilSocle()`),
// donc rien n'est dessiné entre les deux.

import { socleVisible } from './seuil-socle.js'

/**
 * L'automate du socle, avec sa mémoire.
 *
 * @param {{
 *   appliquer: (visible:boolean) => void,
 *   socleAuDepart?: boolean,
 *   modeSurfaceAuDepart?: boolean,
 * }} arg
 *
 * `appliquer` n'est appelé QUE lorsque l'état affiché change. Les deux valeurs
 * de départ décrivent l'application au chargement : le socle est là, le mode est
 * « surface » — donc rien n'est appliqué tant que rien ne bouge, et un drapeau
 * éteint laisse la production au bit près.
 */
export function creerVeilleSocle({
  appliquer,
  socleAuDepart = true,
  modeSurfaceAuDepart = true,
} = {}) {
  if (typeof appliquer !== 'function') {
    throw new TypeError('creerVeilleSocle : `appliquer` est obligatoire — un branchement muet est un branchement absent')
  }
  // l'état de l'hystérésis : ce que le SEUIL dit, indépendamment du mode
  let auSeuil = !!socleAuDepart
  // ce que `modes.js` dit : surface ou orbite
  let modeSurface = !!modeSurfaceAuDepart
  // ce qui est réellement POSÉ à l'écran — le ET des deux
  let pose = modeSurface && auSeuil
  let bascules = 0

  function poser() {
    const voulu = modeSurface && auSeuil
    if (voulu === pose) return pose
    pose = voulu
    bascules++
    appliquer(voulu)
    return pose
  }

  return {
    /**
     * Le mode de `modes.js`. ⚠️ Il PRIME : en orbite le socle n'existe pas,
     * quelle que soit l'altitude.
     */
    poserMode(surface) {
      modeSurface = !!surface
      return poser()
    },

    /**
     * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
     * au-dessus de l'ellipsoïde — voir le §1. Une altitude non finie conserve
     * l'état : elle ne peut pas être une raison de faire naître ou mourir le
     * socle (même contrat que `socleVisible`).
     */
    maj(altitudeEllipsoideM) {
      if (!modeSurface) return pose
      auSeuil = socleVisible({ altitudeEllipsoideM, visibleAvant: auSeuil })
      return poser()
    },

    /** Ce qui est posé à l'écran. */
    get visible() { return pose },
    /** Ce que le seuil dit, mode mis à part — pour les sondes et les bancs. */
    get auSeuil() { return auSeuil },
    /** Combien de fois le socle a changé d'état depuis le chargement. */
    get bascules() { return bascules },
  }
}
