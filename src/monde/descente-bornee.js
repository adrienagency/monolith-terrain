// LA DESCENTE BORNÉE PAR LE RÉSEAU — règle R3 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`, Tâche 4 ter).
//
// ══════════ 0. CE QUE CE MODULE DÉCIDE, ET CE QU'IL NE DÉCIDE PAS ═══════════
//
// R3 : « La descente est bornée par ce que le réseau soutient. » À froid, le
// zoom réellement obtenu plafonne bien en dessous du zoom demandé ; descendre
// quand même amène la caméra dans un endroit qu'elle ne peut pas montrer.
// ⚠️ **Ce n'est pas le flou accepté par la décision 13 : c'est une autre carte.**
//
// Ce module rend **un nombre** : le zoom auquel il est raisonnable de remplir.
// Il ne touche ni à la caméra, ni au DOM, ni au réseau. Trois conséquences :
//
//   · ⚠️ **`empriseSocle` ne bouge PAS.** Ce qui varie est le REMPLISSAGE,
//     jamais l'emprise — le socle garde toujours la largeur de `ZOOM_SOCLE`, et
//     l'appelant le remplit à `min(ZOOM_SOCLE, zoomSoutenable(...))`. C'est le
//     contrat d'appel, tranché par la Tâche 3.
//   · ⚠️ **LE SEUIL D'ALTITUDE NE SE DÉCALE PAS.** Un seuil qui dépendrait du
//     débit fermerait la boucle socle → trafic → débit → seuil : c'est
//     l'oscillateur que R1 interdit, et le précédent Cesium est exact.
//   · La moitié CAMÉRA de R3 — « la caméra ne descend pas plus vite que le
//     flux » — appartient à la Tâche 1, qui tient `modes.js`. Voir le §4.
//
// ══════════ 1. LA LOI, ET LES SIX POINTS QUI LA FIXENT ══════════════════════
//
// ⚠️ **LES DEUX POINTS DU PLAN (« z11 à 12 Mb/s, z9 à 4 Mb/s ») AVAIENT ÉTÉ
// MESURÉS SUR L'ANCIEN QUADTREE.** Depuis, quatre tâches ont changé ce qu'il
// demande : `MAX_Z` 11 → 15 (Tâche 4 quater), cache 420 → 1 700 (4 sexies),
// plancher de `dist` levé (4 quater), file plafonnée à 256 (4 bis). Ils ont donc
// été **rejoués**, et quatre points neufs mesurés avec eux.
//
// **Banc `.banc/zoom-soutenable.mjs`** — même modèle de latence que
// `.banc/pano-latence.mjs`, celui qui reproduit le navigateur à 2 % près (558 au
// banc contre 568 au navigateur). Vol de référence du §0 : 45 s, Atlantique
// 260 km → Mont-Blanc 2,2 km, 60 Hz, cache FROID ; puis la caméra reste en
// place, **on jette 17 images** (protocole de banc du §0) et on relève la
// **médiane du zoom dessiné sur 300 images**.
//
// | débit | z soutenu (mesuré) | la loi ci-dessous |
// |---|---|---|
// | 2 Mb/s  | **z7**  | 7 ✅ |
// | 4 Mb/s  | **z9**  | 9 ✅ — *et c'est le point du plan, retrouvé à l'identique* |
// | 8 Mb/s  | **z11** | 10 ⚠️ *−1, le seul écart* |
// | 12 Mb/s | **z11** | 11 ✅ — *l'autre point du plan, retrouvé à l'identique* |
// | 30 Mb/s | **z13** | 13 ✅ — *le troisième point exigé par le plan* |
// | 64 Mb/s | **z14** | 14 ✅ |
//
// ⚠️ **LES DEUX POINTS DU PLAN SURVIVENT AUX QUATRE TÂCHES.** C'était le risque
// annoncé, et la mesure l'écarte : ils n'étaient pas des artefacts de `MAX_Z=11`.
//
// **La loi retenue :** `z = ⌊6,2 + 1,4 × log₂(débit en Mb/s)⌋`.
//
// Elle n'est pas ajustée aux moindres carrés : les six mesures sont des
// **planchers** (un z11 mesuré veut dire « la grandeur continue est dans
// [11, 12) »), et un ajustement au centre des points sortirait des bandes. Les
// deux coefficients sont pris dans le **polytope des six bandes**, qui se réduit
// à `pente ∈ ]1 ; 1,667[` — et, à pente 1,4, à `ordonnée ∈ [5,8 ; 6,6[`.
//
// ⚠️ **L'ÉCART DE 8 Mb/s EST DU BON CÔTÉ, ET C'EST DÉLIBÉRÉ.** C'est aussi le
// point dont la mesure est la plus dispersée (médiane 11, mais 9 en basse
// altitude et 13 au maximum). Sous-estimer d'un niveau donne du flou —
// exactement ce que la décision 13 accepte. Surestimer donne « une autre
// carte », ce que R3 interdit. **En cas de doute, la loi descend.**
//
// ⚠️ **ET LA LOI CESSE D'ÊTRE LA VÉRITÉ AU-DESSUS DE ~30 Mb/s** — mesuré : à
// 30 et 64 Mb/s la file colle à `PLAFOND_FILE = 256` et le cache à 1 700. Ce
// n'est plus le réseau qui borne, c'est le budget. La loi le suit par accident
// (sa pente s'aplatit du bon côté), **elle ne l'explique pas.** Le jour où le
// budget bouge, ces deux points-là sont à reprendre ; les quatre premiers non.
//
// ══════════ 2. `null` N'EST PAS ZÉRO — ET C'EST LE PIÈGE PRINCIPAL ══════════
//
// ⚠️ **`debitObserve(flux)` REND `null` SUR UN FLUX NEUF, JAMAIS `0`** — c'est
// écrit dans `flux-terrain.js` et c'est délibéré. **Le manque de mesure et la
// mesure d'un manque sont deux choses.** Un `null` traité comme zéro clouerait
// la descente au zoom le plus grossier au tout premier instant, c'est-à-dire
// exactement quand on n'a encore rien à reprocher au réseau.
//
// Donc : **débit inconnu ⇒ on rend le zoom demandé.** Un réseau qu'on n'a pas
// mesuré n'est pas un réseau mort ; il se mesurera à la réponse suivante.
//
// ══════════ 3. LE DÉBIT S'OBSERVE, IL NE SE DEVINE PAS ══════════════════════
//
// ⚠️ **JAMAIS `navigator.connection`.** Il ment (il rend une classe théorique,
// pas un débit), il n'existe pas sur Safari ni sur Firefox, et il est
// explicitement interdit par la Tâche 4 ter. La seule source est
// `debitObserve(flux)` — des octets RÉELLEMENT reçus, divisés par du temps
// mural.

import { debitObserve, demanderEmprise } from './flux-terrain.js'
import { ZOOM_SOCLE } from './seuil-socle.js'
import { MAX_Z } from '../globe.js'

/**
 * L'ordonnée à l'origine de la loi, en niveaux de zoom. Voir le §1 : prise dans
 * `[5,8 ; 6,6[`, le polytope des six bandes mesurées à pente 1,4.
 */
export const ZOOM_A_1_MBS = 6.2

/**
 * La pente, en niveaux de zoom par DOUBLEMENT de débit. Voir le §1 : le
 * polytope des six bandes mesurées la borne à `]1 ; 1,667[`.
 */
export const NIVEAUX_PAR_DOUBLEMENT = 1.4

/**
 * Le plancher. ⚠️ **z2, parce que c'est la racine du quadtree** — `globe.js`
 * pose seize tuiles racines, c'est-à-dire 4² = 2², et rien de plus grossier
 * n'existe. Rendre z0 ou z1 désignerait des tuiles qui ne seront jamais
 * demandées, et le socle resterait vide au lieu d'être grossier.
 */
export const ZOOM_PLANCHER = 2

function borner(z) {
  return Math.max(ZOOM_PLANCHER, Math.min(MAX_Z, Math.floor(z)))
}

/**
 * Le zoom que le réseau observé soutient, borné par le zoom demandé.
 *
 * ⚠️ **C'EST UNE BORNE, PAS UNE CONSIGNE** : la fonction ne rend jamais plus que
 * `zoomDemande`. Un réseau rapide n'autorise pas à descendre plus bas que ce que
 * la caméra a demandé — c'est la caméra qui décide de la finesse voulue, le
 * réseau ne fait que la rogner.
 *
 * @param {{debitObserveMbs: number|null|undefined, zoomDemande: number}} arg
 *   `debitObserveMbs` vient de `debitObserve(flux)` — voir le §3.
 *   ⚠️ `null` (flux neuf, rien encore mesuré) rend le zoom demandé : §2.
 * @returns {number} un niveau de zoom entier, dans `[ZOOM_PLANCHER, MAX_Z]`
 */
export function zoomSoutenable({ debitObserveMbs, zoomDemande = ZOOM_SOCLE } = {}) {
  const demande = borner(Number.isFinite(zoomDemande) ? zoomDemande : ZOOM_SOCLE)
  // §2 — débit inconnu : on ne rogne rien.
  if (debitObserveMbs == null || !Number.isFinite(debitObserveMbs)) return demande
  // Un débit nul ou négatif ne vient PAS de `debitObserve` (qui rend `null`),
  // mais un appelant maladroit peut l'inventer. `log₂(0)` vaut `-Infinity` :
  // `borner` le ramène au plancher, ce qui est la lecture juste d'un réseau
  // qu'on a mesuré à zéro.
  if (debitObserveMbs <= 0) return ZOOM_PLANCHER
  const soutenu = borner(ZOOM_A_1_MBS + NIVEAUX_PAR_DOUBLEMENT * Math.log2(debitObserveMbs))
  return Math.min(demande, soutenu)
}

// ══════════ 4. LE POINT D'APPEL ═════════════════════════════════════════════
//
// ⚠️ **R3 N'AVAIT AUCUN PROPRIÉTAIRE, ET LA TÂCHE 1c QUI DEVAIT LE POSER A ÉTÉ
// ABANDONNÉE** (elle déverrouillait une reconstruction que le pivot supprime).
// R3 a donc deux moitiés, et elles n'ont pas le même propriétaire :
//
//   1. **LE REMPLISSAGE — c'est ICI, et c'est fait.** `remplirBorne` ci-dessous
//      est le point d'appel : il lit le débit du flux, le passe à
//      `zoomSoutenable`, et demande l'emprise au zoom rogné. **L'emprise, elle,
//      ne change pas** (contrat de la Tâche 3).
//   2. **LA CAMÉRA — c'est la TÂCHE 1, et elle n'est pas faite.** Le chemin de
//      descente vit dans `src/modes.js` : `_dive` (`:566`), `pickDiveTier`
//      (`:80`) et `DIVE_TIERS` (`:62`) — repères relevés le 2026-08-21,
//      `grep -n` avant de s'y fier. C'est là que se pose la seconde moitié : ne
//      pas laisser la caméra franchir un palier que `zoomSoutenable` refuse.
//      ⚠️ **Tant que la Tâche 1 n'est pas faite, R3 borne CE QU'ON DEMANDE, pas
//      la VITESSE à laquelle on le demande.** C'est dit plutôt que sous-entendu.
//
// ⚠️ **ET `remplirBorne` NE MODIFIE PAS `flux-terrain.js`** — la Tâche 4 ter
// l'interdit explicitement. Elle l'enveloppe : `demanderEmprise` garde sa
// signature et son contrat, et l'appelant choisit lequel des deux il appelle.

/**
 * Le point d'appel de R3, côté remplissage : demander l'emprise au zoom que le
 * réseau soutient.
 *
 * ⚠️ **`emprise` EST CELLE D'`empriseSocle`, INCHANGÉE.** Ce qui varie est le
 * zoom des tuiles qu'on va chercher pour la remplir, jamais sa largeur.
 *
 * @param {object} flux — de `creerFlux({ globe })`
 * @param {{emprise: object, zoomDemande?: number}} arg
 * @returns {{zoom: number, zoomDemande: number, debitObserveMbs: number|null}}
 *   ce qui a été demandé, et sur quelle mesure — l'appelant s'en sert pour
 *   l'indicateur discret (§5).
 */
export function remplirBorne(flux, { emprise, zoomDemande = ZOOM_SOCLE } = {}) {
  const debitObserveMbs = debitObserve(flux)
  const zoom = zoomSoutenable({ debitObserveMbs, zoomDemande })
  demanderEmprise(flux, { emprise, zoom })
  return { zoom, zoomDemande, debitObserveMbs }
}

// ══════════ 5. L'INDICATEUR DISCRET — CE QUE CE MODULE EN PORTE ═════════════
//
// **Décision d'Adrien, 2026-08-20 :** « quand le réseau ne suit pas,
// l'utilisateur voit UN INDICATEUR DISCRET ». Pas de voile, pas de message
// bloquant, pas de silence total.
//
// ⚠️ **CE MODULE NE LE DESSINE PAS, ET C'EST VOULU** : il est pur (ni DOM, ni
// three, ni CSS), et le dessin appartient à la **Tâche 2**, celle qui retire la
// carte `#loading` — c'est le plan lui-même qui le dit au §9 (« à dessiner dans
// la Tâche 2, et à réutiliser par la Tâche 4 ter »). Ce qu'il porte, c'est
// l'**état** que l'indicateur affichera, pour que la Tâche 2 n'ait pas à
// redécider quand il s'allume.
//
// ⚠️ **LA PLACE OÙ IL IRA, VÉRIFIÉE SUR LE DÉPÔT LE 2026-08-21 :**
// `src/main.js:3413-3416` — un `setTimeout(… , 2600)` qui garde la carte de
// chargement 2,6 s **alors que `demBusy` est relâché à la ligne 3418**, dans le
// `finally` qui s'exécute tout de suite. L'application est libre et l'écran ne
// le dit pas. ⚠️ *(Le plan écrivait « 3408-3411 » ; les lignes ont bougé, la
// thèse est intacte — corrigée en place dans le plan.)*

/**
 * L'état de l'indicateur discret : le réseau suit-il, et de combien est-il en
 * retard ?
 *
 * ⚠️ **`enRetard` EST FAUX QUAND LE DÉBIT EST INCONNU.** Un flux neuf n'a rien
 * mesuré : allumer l'indicateur là-dessus serait afficher « ça rame » avant la
 * première réponse. Même raison que le §2, appliquée au visible.
 *
 * @param {{debitObserveMbs: number|null|undefined, zoomDemande: number}} arg
 * @returns {{enRetard: boolean, niveaux: number, zoom: number}}
 *   `niveaux` : de combien de niveaux le remplissage est rogné (0 = le réseau
 *   suit). C'est aussi la grandeur à ne PAS transformer en pourcentage : un
 *   niveau vaut un facteur deux de résolution, pas un pour cent.
 */
export function etatIndicateur({ debitObserveMbs, zoomDemande = ZOOM_SOCLE } = {}) {
  const demande = borner(Number.isFinite(zoomDemande) ? zoomDemande : ZOOM_SOCLE)
  const zoom = zoomSoutenable({ debitObserveMbs, zoomDemande })
  const niveaux = Math.max(0, demande - zoom)
  return { enRetard: niveaux > 0, niveaux, zoom }
}
