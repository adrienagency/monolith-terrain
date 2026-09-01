// LE PIVOT RESTE LE CENTRE DE LA TERRE JUSQU'AU CROP — Tâche R27.
//
// Module PUR : ni DOM, ni three.js. Testable en node — `test/pivot-terre.test.js`.
//
// ══════════ LA DEMANDE, ET CE QUE LA MESURE EN A FAIT ══════════════════════
//
// > **Adrien, 2026-08-31 :** *« Le point d'orbite n'est toujours pas le bon dès
// > qu'on passe en mode surface. Il doit toujours viser le centre de la Terre.
// > Il change uniquement quand on passe en mode bloc croppé. Si on dézoome
// > depuis le mode croppé, la caméra revient automatiquement avec une orbite
// > autour du centre de la Terre. »*
//
// ⛔ **R13 bis AVAIT RÉPONDU « IL N'Y A RIEN À FAIRE », ET LA MESURE LE
// DÉMENT.** Son raisonnement — *« une rotation autour d'un axe vertical ne
// connaît pas le `y` du pivot, donc l'axe du bloc EST l'axe du centre de la
// Terre »* — est **juste**, et il ne couvre que l'AZIMUT. Il laissait ouvert le
// seul terme qui manquait : **`controls.target` n'est pas SUR cet axe.**
//
// Relevé DANS la boucle (`scripts/sonde-pivot-r27.mjs`, `.banc/R27/avant.json`,
// descente complète de 60 000 km au bloc, 902 images) :
//
//   | régime                       | `controls.target`            | écart à l'axe |
//   |------------------------------|------------------------------|---------------|
//   | orbite                       | (0, 0, 0)                    | **0**         |
//   | surface z3, sans crop        | (−2,891 · −0,300 · −0,305)   | 2,908 u       |
//   | surface z4, sans crop        | (3,552 · −0,300 · 8,724)     | 9,420 u       |
//   | surface z6, sans crop        | (4,874 · −0,300 · 6,895)     | 8,442 u       |
//   | **pire de la descente**      | —                            | **12,898 u**  |
//
// ⚡ **ET LE CHIFFRE QUI TRANCHE EST EN PIXELS.** À la naissance du crop, caméra
// au nadir, `d = 32,34` : le centre du bloc — l'aplomb du centre de la Terre —
// se projette à **(622,5 · 212,1)** sur un canevas de 1280 × 800, c'est-à-dire
// **188,7 px du centre de l'écran, soit 23,6 % de sa hauteur.** La caméra
// tourne autour d'un point qui n'est pas le sujet ; en orbite elle tourne autour
// du sujet. C'est exactement l'écart qu'Adrien décrit.
//
// ══════════ POURQUOI x ET z, ET PAS y ══════════════════════════════════════
//
// ⚠️ **LE `y` N'EST PAS CORRIGÉ, ET C'EST UNE DÉCISION MESURÉE, PAS UN OUBLI.**
// Le centre de la Terre est sur la **verticale** du centre du bloc : *tout*
// point de la droite `x = z = 0` le vise. Le `y` ne change donc rien à la visée,
// et `pivot-bloc.js` porte déjà l'algèbre qui le dit (`Ry` laisse la composante
// verticale intacte).
//
// ⛔ **Et le forcer à 0 déplacerait `camera.position.y`** — le pas est rigide,
// voir plus bas —, or `altitudeCadrageM()` vaut `camY × emprise / span` :
// à `camY = 32` un `Y_CIBLE = −0,3` vaut **0,94 % d'altitude**, c'est-à-dire que
// le correctif bougerait le seuil de naissance du crop **contre lequel il est
// jugé**. On ne mesure pas une bascule avec un instrument qu'on vient de
// déplacer. `Y_CIBLE` reste donc où R23 l'a laissée (sa réserve n° 2).
//
// ══════════ LE PAS EST RIGIDE — LA MÊME ALGÈBRE QUE R13 ════════════════════
//
// ⛔ **ÉCRIRE `controls.target` SEUL EST INTERDIT.** `veille-repos.js` surveille
// `|Δ ln(distance caméra→cible)|` au seuil `SEUIL_BOUGE_LOG = 1e-4`, et c'est ce
// signal qui arme la bascule de trois quarts de D16 ter. Déplacer la seule cible
// de 4,46 u à `d = 32,34` produit `|Δ ln d| ≈ 1,4 × 10⁻²` — **140 fois le
// seuil**.
//
// ➡️ **LE DÉCALAGE S'AJOUTE DONC À LA CAMÉRA *ET* À LA CIBLE.** Une translation
// commune ne change pas un vecteur différence :
//
//     (P + δ) − (T + δ) = P − T
//
// La distance est invariante **par construction**, pas par réglage — au bit
// près, et non « en dessous du seuil ». C'est le même argument que la rotation
// rigide de `pivot-bloc.js`, et il vaut ici sans aucune hypothèse sur δ.
//
// ══════════ LE PAS EST BORNÉ EN ANGLE, DONC EN PIXELS ══════════════════════
//
// ⚠️ **UNE TRANSLATION RIGIDE DÉPLACE L'IMAGE**, et c'est même tout son objet :
// c'est elle qui ramène le sujet au centre du cadre. Ce qui est interdit, c'est
// qu'elle le fasse **en une image**. Le pas est donc plafonné en ANGLE VU :
// une translation `δ` perpendiculaire à la visée, à la distance `d`, sous-tend
// `δ/d` radians.
//
//   pixels = (δ/d) × (H/2) / tan(fov/2)
//
// À `H = 800` et `fov = 33°` (le défaut du dépôt), cela vaut **1 350 px par
// radian**. `PAS_RECENTRAGE_RAD = 3 × 10⁻³` borne donc le déplacement à
// **4,05 px par image** — « quelques pixels », et l'ordre de grandeur des
// balayages de pose que D16 ter emploie déjà.
//
// ⚠️ **ET C'EST UN PLAFOND, PAS UNE VITESSE** : le pas vaut `pasRad × distance`,
// donc il rétrécit en même temps que la distance. Le glissement dure le même
// nombre d'images qu'on soit à 6 unités ou à 150 — ce qui est la seule façon
// pour que le geste se sente pareil aux deux bouts.
//
// ⚠️ **LE DERNIER PAS EST EXACT.** Quand ce qui reste tient sous le plafond, on
// pose la cible SUR l'axe (`fini`) au lieu de l'en approcher géométriquement :
// sans ça la correction ne convergerait jamais et la sonde relèverait un résidu
// qui décroît sans finir. `x` et `z` valent alors **exactement** 0.
//
// ⚠️ **AUCUNE LECTURE D'AZIMUT, ET C'EST LA LEÇON DE R23.** Un échantillonnage
// qui partait de la cible variait de **0,25 unité par tour** ; ici le pas ne
// dépend que de coordonnées ABSOLUES (`cible − axe`) et de la distance, donc
// tourner autour du bloc ne le change pas d'un bit. Un test le verrouille.

import { PIVOT_BLOC_X, PIVOT_BLOC_Z } from './pivot-bloc.js'

/**
 * Le plafond du pas de recentrage, en radians d'angle vu.
 *
 * ⚠️ Mesuré en pixels, pas choisi : voir l'en-tête — 1 350 px par radian sur le
 * canevas du dépôt, donc **4,05 px par image**.
 */
export const PAS_RECENTRAGE_RAD = 3e-3

const fini = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * Le décalage à ajouter À LA FOIS à la caméra et à la cible pour ramener le
 * pivot sur la verticale du centre de la Terre, d'une image.
 *
 * ⚠️ **`y` VAUT TOUJOURS 0** — voir l'en-tête, § « pourquoi x et z, et pas y ».
 *
 * ⚠️ **UNE ENTRÉE NON FINIE NE BOUGE RIEN**, même contrat que `veille-repos.js`
 * et que `decalagePivot` : une panne d'instrument ne peut pas être une raison de
 * déplacer la caméra. Elle rend `fini: false` — il reste quelque chose à faire,
 * l'image suivante réessaiera.
 *
 * @param {object} a
 * @param {number} a.cibleX `controls.target.x`
 * @param {number} a.cibleZ `controls.target.z`
 * @param {number} a.distance la distance caméra → cible (elle borne le pas)
 * @param {number} [a.pasRad] voir `PAS_RECENTRAGE_RAD`
 * @param {number} [a.axeX] l'axe visé — paramétré pour le test, jamais en production
 * @param {number} [a.axeZ]
 * @returns {{x:number, y:number, z:number, fini:boolean}}
 */
export function decalageRecentrage({
  cibleX,
  cibleZ,
  distance,
  pasRad = PAS_RECENTRAGE_RAD,
  axeX = PIVOT_BLOC_X,
  axeZ = PIVOT_BLOC_Z,
} = {}) {
  const rien = (f) => ({ x: 0, y: 0, z: 0, fini: f })
  if (!fini(cibleX) || !fini(cibleZ) || !fini(axeX) || !fini(axeZ)) return rien(false)
  const ux = axeX - cibleX
  const uz = axeZ - cibleZ
  // déjà sur l'axe : il n'y a rien à corriger, et `fini` le dit.
  if (ux === 0 && uz === 0) return rien(true)
  if (!fini(distance) || !fini(pasRad) || !(distance > 0) || !(pasRad > 0)) return rien(false)
  const reste = Math.hypot(ux, uz)
  const plafond = pasRad * distance
  // ⚠️ **LE DERNIER PAS EST EXACT** — voir l'en-tête. `<=` et non `<` : à
  // égalité, finir coûte le même déplacement et évite une image de plus.
  if (reste <= plafond) return { x: ux, y: 0, z: uz, fini: true }
  const k = plafond / reste
  return { x: ux * k, y: 0, z: uz * k, fini: false }
}
