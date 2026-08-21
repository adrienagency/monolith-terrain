// LA FENÊTRE BORNÉE — Tâche 6 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ 0. CE QUE CE MODULE REMPLACE, ET POURQUOI IL EXISTE ═════════════
//
// Aujourd'hui chaque niveau de zoom **reconstruit un bloc de terrain** : c'est
// ça, le cran qu'Adrien nomme (« un Google Maps like, PAS DES CRANS »), et
// c'est ça, la seconde d'attente. Ce module remplace la reconstruction par un
// **rééchantillonnage du cache du quadtree**.
//
// ⚠️ **ON NE COUD PAS LES TUILES — il n'y a pas de jonction parce qu'il n'y a
// pas de couture.** La fenêtre porte sa PROPRE grille régulière, en Mercator,
// et va y chercher les hauteurs ; le maillage du quadtree n'est jamais découpé,
// jamais recousu, jamais lu autrement que comme une source de nombres.
//
// D'où les deux interfaces, et la seconde est la raison d'être de la première :
//
//   · `construireFenetre(...)` → la coque, UNE fois ;
//   · `majHauteurs(fenetre, flux)` → les hauteurs, à volonté, **sans
//     reconstruire la géométrie** : ni retriangulation, ni réallocation, ni
//     nouvelle boîte. On écrit des `y`, c'est tout.
//
// ══════════ 1. CE QUI EXISTE DÉJÀ ET QUE CE MODULE NE RÉÉCRIT PAS ═══════════
//
// La §1 de `/threejs-optimisation` est formelle : les gros défauts sont HORS du
// fichier audité, et le premier d'entre eux est l'abstraction réinventée. Le
// relevé, fait avant d'écrire une ligne :
//
//   · **`fenetre-clip.js`** détient la forme des coins — `pointCoin` est la
//     superellipse `a^e + b^e = 1`, `exposantCoin(lissage) = 2 + 4·lissage`.
//     ⚠️ **C'est de CETTE loi que sortent le socle (`plinth.js`) ET la mer
//     (`ocean.js`).** Ce module s'y branche : `formeCoin` ci-dessous est le
//     rayon de la MÊME superellipse, et `test/fenetre-bornee.test.js` vérifie
//     l'accord avec `pointCoin` à 1e-12 — deux copies d'une même règle finissent
//     toujours par diverger, il n'y en a qu'une.
//   · **`plinth.js:138 computeSlab` / `:232 buildSlabWalls`** portent DOUZE
//     options (congé, chanfrein, AO de contact, liner, `masqueArrondi`,
//     `bords`, `baseYFloor`…). ⚠️ **Le §7 dit exactement ce qu'elles
//     deviennent** — et pourquoi elles ne peuvent PAS être cuites ici.
//   · **`remplirHauteurs`** (`flux-terrain.js`) remplit `(n+1)²` hauteurs **en
//     une passe par tuile**. ⚠️ **PAR LOT, JAMAIS PAR PIXEL** : l'interface par
//     pixel coûtait +3,5 ms par reconstruction à n = 256 (Tâche 4 bis).
//   · **`empriseSocle`** (`seuil-socle.js`) produit l'`emprise`.
//   · **`auditerSolide`** (`audit-solide.js`) rend le verdict, et son
//     discriminant `hauteurs.distinctes` est ce qui empêche ce module de faire
//     passer un pavé droit pour un rééchantillonnage.
//
// ══════════ 2. LE REPÈRE, ET LES DEUX ÉCHELLES ══════════════════════════════
//
// Repère MONDE du bloc : `x` et `z` horizontaux dans `[-28, +28]`
// (`TERRAIN_SIZE = 56`), `y` vertical, origine au CENTRE de la fenêtre. C'est le
// repère de `terrain.js`, de `plinth.js` et d'`ocean.js` — en changer ferait de
// ce module un objet étranger dans sa propre scène.
//
// La hauteur d'un sommet, **et c'est mot pour mot la formule de
// `terrain.js:_makeDemSampler`** :
//
//     y = (hauteurEnMètres − moyenne) × (56 / largeurAuSolEnMètres) × exagération
//
// ⚠️ **La moyenne est celle du CADRE**, pas du monde — décision 8 d'Adrien :
// « les statistiques sont LISSÉES, pas rebasées sur le monde ». Une rampe calée
// sur des références mondiales rendrait monochrome toute zone à faible
// dénivelé.
//
// ══════════ 3. LES DEUX PIÈGES DE L'EMPRISE, NOMMÉS PAR LE PLAN ═════════════
//
//   · ⚠️ **`ouest > est` signifie que l'emprise franchit l'antiméridien.**
//     C'est LÉGAL (convention de `seuil-socle.js` et de `bathy-sources.js`), et
//     un test l'exige.
//   · ⚠️ **Au-delà de 85,051° de latitude l'emprise est ÉCRÊTÉE** à la limite
//     de Mercator. Le prototype y était « silencieusement faux mais fermé ».
//
// ══════════ 4. LA TOPOLOGIE, ET POURQUOI ELLE EST FERMÉE PAR CONSTRUCTION ═══
//
//   · **la nappe** : `(n+1)²` sommets sur une grille régulière en Mercator,
//     déformée aux quatre coins pour épouser la superellipse (§5) ;
//   · **les parois** : `4n` quadrilatères entre l'anneau de bord de la nappe et
//     sa copie à `baseY`. ⚠️ **LES SOMMETS HAUTS DES PAROIS *SONT* LES SOMMETS
//     DE BORD** — le même index, pas une copie recalculée. C'est ce qui rend la
//     couture exacte au bit près, et non « à epsilon près » ;
//   · **la dalle** : un éventail depuis `(0, baseY, 0)` sur le MÊME anneau bas.
//
// ⚠️ **ET C'EST PRÉCISÉMENT LE PIÈGE QUE LE PLAN NOMME** : cette coque est
// fermée et orientée **par construction**, hauteurs nulles comprises. Elle
// passerait l'audit cent fois sans que le rééchantillonnage soit touché par une
// seule assertion. Les deux assertions qui mordent sont dans le test, pas ici :
// `hauteurs.distinctes > 2`, et la hauteur relevée en un point connu.
//
// ══════════ 5. LE COIN — UNE SEULE LOI, TROIS CLIENTS, ET AUCUN LISERÉ ══════
//
// ⚠️ **REMAPPER SEULEMENT L'ANNEAU DE BORD NE MARCHE PAS**, et le chiffre le
// dit : au réglage de production (`slabCorner = 0,04` → rayon 2,24 unités,
// `slabCornerSmoothing = 0,6` → exposant 4,4), le coin du carré se déplace de
// **0,46 unité** pour rejoindre la superellipse — soit **plus de trois mailles
// à n = 384** (maille : 0,1458). Les sommets INTÉRIEURS voisins resteraient
// dehors, et la nappe déborderait de son propre mur : c'est exactement le
// « liseré de vide dans chaque coin » que `fenetre-clip.js` documente.
//
// On déforme donc le PAVÉ de coin entier, pas son bord. Dans le carré de coin
// normalisé `[0,1]²`, la superellipse est `u^e + v^e = 1` ; le point à la
// « distance carrée » `q = max(u,v)` dans la direction `d = (u,v)/q` est ramené
// à `q · ρ(d)` avec `ρ(d) = (d_u^e + d_v^e)^(-1/e)`. La transformation est
// l'IDENTITÉ sur les deux arêtes du pavé (`u = 0` ou `v = 0`), donc elle se
// raccorde sans discontinuité aux parties droites ; elle est un simple facteur
// d'échelle le long de chaque rayon, donc **elle ne peut pas replier une
// maille**. Le test le vérifie : zéro triangle dégénéré sur cent emprises.
//
// ══════════ 6. LA DÉCISION 14 — L'EXAGÉRATION VERTICALE CONTINUE ════════════
//
// Tranchée par Adrien le 2026-08-20 : « **mêmes valeurs aux mêmes altitudes,
// interpolées au lieu de sauter** ».
//
// ⚠️ **ELLE NE PEUT ÊTRE PORTÉE QUE PAR CE MODULE, ET VOICI POURQUOI.**
// Aujourd'hui `params.demExaggeration` n'est pas un réglage d'affichage : c'est
// un facteur **CUIT DANS LA GÉOMÉTRIE**, lu à douze endroits (`terrain.js`
// ×5, `ocean.js` ×2, `gpx.js`, `main.js` ×4). Le faire varier en continu sur
// l'architecture actuelle imposerait de **reconstruire la géométrie à chaque
// image**. La fenêtre étant rééchantillonnée et non cuite, l'exagération
// s'applique **au rééchantillonnage** — c'est-à-dire à une écriture de `y`.
//
// ⚠️ **LA MER, LE SOCLE ET LES TRACÉS GPX DOIVENT LIRE LA MÊME VALEUR AU MÊME
// INSTANT.** C'est la famille de défauts déjà rencontrée deux fois sur ce
// dépôt : un réglage écrit d'un côté, jamais transmis à l'autre. D'où
// `creerExagerationPartagee` (§8) — **un seul écrivain, N lecteurs**, et un
// test qui compare les trois lectures au même instant.
//
// Les ancrages sont ceux d'AUJOURD'HUI et ils sont réglables par l'utilisateur :
// `ZOOM_EXAG_DEFAULTS = {3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2}` (`main.js:3129`),
// `BASE_EXAG = 2.8` (`main.js:3114`), **plus les surcharges d'Adrien dans
// `localStorage` sous `monolith.zoomExag`** (`main.js:3130-3138`). La courbe
// passe par ces points ET honore les surcharges — les retirer casserait un
// réglage qu'il utilise.
//
// ══════════ 7. LE SORT DES DOUZE OPTIONS DE `plinth.js` — TRANCHÉ ═══════════
//
// ⚠️ **`plinth.js` N'EST NI MODIFIÉ NI REMPLACÉ, ET C'EST UN ARBITRAGE, PAS UN
// OUBLI.** `block-grid.js:768` appelle `buildSlabWalls`, et **13 fichiers
// `test/damier-*.test.js`, 243 tests, portent des empreintes BIT À BIT**
// (`damier-bords.test.js:351`). Toucher à sa signature, c'est les casser tous.
//
// **Ce que `construireFenetre` reprend** (5 sur 12) :
//
//   | option `plinth`         | ici                  |
//   |-------------------------|----------------------|
//   | `depth`                 | `profondeurDalle` ✅ |
//   | `cornerR`               | `rayonCoin` ✅       |
//   | `cornerExp`             | `puissanceCoin` ✅ ⚠️ **et non `exposantCoin`, déjà export de `fenetre-clip.js:71`** |
//   | `resolution`            | `n` ✅ (la grille EST l'anneau, §4) |
//   | `baseYFloor`            | `baseYFloor` ✅      |
//
// **Ce qui se perd, et la RAISON — une seule, et elle est mécanique.**
// `chanfrein`, `arrondi`, `arrondiSeg`, `masqueArrondi`, `bords`, `aoForce`,
// `aoBande` décrivent un **profil de paroi cuit** : le chanfrein pose un rang de
// sommets à `y − ch`, le congé en pose `arrondiSeg + 1` autour de `baseY`, l'AO
// de contact écrit une couleur par sommet à partir de `y`. **Tous dépendent des
// hauteurs.** Les cuire ici rendrait `majHauteurs` impossible : il faudrait
// redéplier le profil, donc réallouer, donc reconstruire — c'est-à-dire
// remettre le cran qu'on vient d'enlever.
//
// ⚠️ **ET LE PLAN A DÉJÀ TRANCHÉ CE PATRON, À LA DÉCISION 5** : « la gravure
// des parois ne s'écrit qu'à l'ARRÊT de la caméra ». La finition suit la même
// règle : la coque pendant le mouvement, `buildSlabWalls` à l'arrêt, **sur le
// contour que cette fenêtre publie** (`contourSocle`, §9) — même anneau, même
// `baseY`, même forme de coin. Les sept options survivent donc entières, elles
// changent seulement d'instant. `optionsSocle` les transporte telles quelles,
// sans les interpréter, pour que l'appelant de l'arrêt n'ait rien à redeviner.
//
// ⚠️ **ET `ocean.js` N'A RIEN À CHANGER, POUR UNE RAISON VÉRIFIABLE** : il tire
// `uCornerR`, `uCornerN` et `buildRimGeometry` de `rayonMurSocle` /
// `rayonCoinEau` / `exposantCoin`, tous exprimés sur `TERRAIN_SIZE` et sur la
// superellipse. **La fenêtre garde EXACTEMENT la même empreinte monde**
// (`COTE_MONDE = TERRAIN_SIZE`) et EXACTEMENT la même loi de coin : la mer
// épouse le socle sans qu'une seule constante ait été recopiée. C'est vérifié
// par test (`la mer et la fenêtre lisent la même forme`), pas affirmé.

import { TERRAIN_SIZE } from '../terrain.js'
import { pointCoin } from '../fenetre-clip.js'
import { remplirHauteurs } from './flux-terrain.js'

// ══════════ LES CONSTANTES, ET LEUR SOURCE ══════════════════════════════════

/** Le côté du bloc en unités monde — `terrain.js:57`, importé et non recopié. */
export const COTE_MONDE = TERRAIN_SIZE
export const DEMI_MONDE = TERRAIN_SIZE / 2

/** La limite de couverture de Web Mercator — `geo.js:11`, `seuil-socle.js:188`. */
export const MERCATOR_LAT_MAX = 85.05112878

/**
 * La circonférence équatoriale telle que le MOTEUR la compte.
 *
 * ⚠️ **`156543,03392 × 256`, ET NON `2πR`.** Les deux diffèrent de 32 m
 * (40 074 984,68 contre 40 075 016,69, soit 8,0e-7 en relatif) et c'est la
 * PREMIÈRE qui fait foi ici : c'est celle de `landmarks.js:14`
 * (`EQUATOR_M_PER_PX`), donc celle de `blockExtentMeters`, donc celle de
 * `dem.extentMeters`. Prendre `2πR` ferait diverger la largeur au sol de la
 * fenêtre de celle du DEM — et l'échelle verticale avec elle, en silence.
 * `test/fenetre-bornee.test.js` verrouille l'accord avec `blockExtentMeters`.
 */
export const EQUATEUR_M = 156543.03392 * 256

/** `params.plinthDepth` — `main.js:541`. */
export const PROFONDEUR_DALLE = 7

/** `BASE_EXAG` — `main.js:3114`. */
export const EXAG_BASE = 2.8

/** `ZOOM_EXAG_DEFAULTS` — `main.js:3129`. ⚠️ Recopié : `main.js` ne l'exporte pas. */
export const EXAG_ANCRES = { 3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2 }

/** `ZOOM_EXAG_KEY` — `main.js:3130`. Les surcharges d'Adrien vivent là. */
export const CLE_EXAG = 'monolith.zoomExag'

/** Le zoom le plus profond que la courbe ancre. `MAX_Z` de `globe.js` vaut 15. */
export const ZOOM_EXAG_MAX = 15

/** `params.fov` — `main.js:263`, VERTICAL (le champ de three.js). */
export const FOV_DEG = 30

/**
 * La fraction d'écran qui sert de RÈGLE altitude ↔ zoom — `seuil-socle.js:178`.
 * ⚠️ Ce n'est pas un réglage de plus : c'est la MÊME que celle dont
 * `SEUIL_NAISSANCE_M` est dérivé, et c'est ce qui fait que
 * `zoomDepuisAltitude(SEUIL_NAISSANCE_M, 45°)` rend exactement `ZOOM_SOCLE`.
 */
export const FRACTION_REFERENCE = 0.6

const D2R = Math.PI / 180

// ══════════ 1. L'EMPRISE, NORMALISÉE UNE FOIS POUR TOUTES ═══════════════════

/**
 * Normalise une emprise : écrêtage des latitudes, largeur en degrés qui tient
 * compte de l'antiméridien, largeur au sol en mètres.
 *
 * ⚠️ **`ouest > est` N'EST PAS UNE ERREUR** — c'est le franchissement de
 * l'antiméridien, et la largeur vaut alors `est − ouest + 360`.
 * ⚠️ **Les latitudes sont ÉCRÊTÉES à ±85,051°**, jamais rejetées : au-delà,
 * Mercator ne couvre plus rien et le prototype y était « silencieusement faux
 * mais fermé ».
 *
 * @param {{ouest:number, sud:number, est:number, nord:number}} emprise
 * @returns {{ouest:number, sud:number, est:number, nord:number, largeurDeg:number,
 *   latCentre:number, largeurM:number, ecretee:boolean, antimeridien:boolean}}
 */
export function normaliserEmprise (emprise) {
  const ouest = Number(emprise?.ouest)
  const est = Number(emprise?.est)
  const sudBrut = Number(emprise?.sud)
  const nordBrut = Number(emprise?.nord)
  if (![ouest, est, sudBrut, nordBrut].every(Number.isFinite)) {
    throw new TypeError('fenetre-bornee : `emprise` doit porter ouest/sud/est/nord finis')
  }
  const sud = Math.max(-MERCATOR_LAT_MAX, Math.min(MERCATOR_LAT_MAX, sudBrut))
  const nord = Math.max(-MERCATOR_LAT_MAX, Math.min(MERCATOR_LAT_MAX, nordBrut))
  const ecretee = sud !== sudBrut || nord !== nordBrut
  const antimeridien = ouest > est
  let largeurDeg = est - ouest
  if (largeurDeg <= 0) largeurDeg += 360
  const latCentre = (nord + sud) / 2
  const largeurM = (largeurDeg / 360) * EQUATEUR_M * Math.cos(latCentre * D2R)
  return { ouest, sud, est, nord, largeurDeg, latCentre, largeurM, ecretee, antimeridien }
}

// ══════════ 2. LA FORME DU COIN — LA LOI DE `fenetre-clip.js`, PAS UNE COPIE ═

/**
 * Le facteur d'échelle radial qui ramène le carré de coin normalisé `[0,1]²`
 * sur le quart de superellipse `u^e + v^e = 1`. Voir le §5.
 *
 * ⚠️ **C'EST LA MÊME COURBE QUE `pointCoin`** de `fenetre-clip.js`, écrite dans
 * l'autre sens : `pointCoin` donne le point pour un ANGLE, celle-ci donne le
 * rayon pour une DIRECTION. Le test `la forme du coin est celle de
 * fenetre-clip.js` les compare à 1e-12 sur 512 directions — deux copies d'une
 * même règle finissent toujours par diverger, il n'y en a qu'une.
 *
 * @param {number} du composante ≥ 0, `max(du, dv) === 1`
 * @param {number} dv idem
 * @param {number} e exposant de la superellipse (2 = arc de cercle)
 */
export function formeCoin (du, dv, e) {
  const n = Math.max(2, e)
  return Math.pow(Math.pow(du, n) + Math.pow(dv, n), -1 / n)
}

/**
 * Le point `(x, z)` de la grille carrée, ramené sur l'empreinte à coins
 * arrondis. Identité partout sauf dans les quatre pavés de coin.
 */
function versEmpreinte (x, z, interieur, rayon, expo, sortie) {
  const ax = Math.abs(x)
  const az = Math.abs(z)
  if (!(rayon > 0) || ax <= interieur || az <= interieur) {
    sortie[0] = x
    sortie[1] = z
    return sortie
  }
  const u = (ax - interieur) / rayon
  const v = (az - interieur) / rayon
  const q = Math.max(u, v)
  const k = formeCoin(u / q, v / q, expo)
  sortie[0] = Math.sign(x) * (interieur + rayon * u * k)
  sortie[1] = Math.sign(z) * (interieur + rayon * v * k)
  return sortie
}

// ══════════ 3. CONSTRUIRE LA FENÊTRE ═══════════════════════════════════════

/**
 * L'anneau de bord de la grille, dans l'ordre du parcours des parois.
 *
 * ⚠️ **CE SONT DES INDEX DE LA NAPPE, PAS DE NOUVEAUX SOMMETS.** Le sommet haut
 * d'une paroi EST le sommet de bord de la nappe — c'est ce qui rend la couture
 * exacte au bit près. Un anneau recalculé, si juste soit-il, rouvre la classe de
 * défaut « on voit le jour sous la carte ».
 */
function anneauDeBord (n) {
  const parCote = n + 1
  const T = (i, j) => j * parCote + i
  const out = new Uint32Array(4 * n)
  let k = 0
  for (let i = 0; i < n; i++) out[k++] = T(i, 0)
  for (let j = 0; j < n; j++) out[k++] = T(n, j)
  for (let i = n; i > 0; i--) out[k++] = T(i, n)
  for (let j = n; j > 0; j--) out[k++] = T(0, j)
  return out
}

/**
 * Construit la coque de la fenêtre : nappe rééchantillonnable, parois, dalle.
 *
 * ⚠️ **Elle sort à hauteurs NULLES tant que `majHauteurs` n'est pas passé** —
 * c'est-à-dire fermée, orientée, et parfaitement inutile. C'est délibéré : la
 * construction et le remplissage sont deux instants différents, et c'est le
 * second qu'on répète.
 *
 * @param {object} arg
 * @param {{ouest:number, sud:number, est:number, nord:number}} arg.emprise — `empriseSocle`
 * @param {number} [arg.n] mailles par côté (production : 384 en mouvement, 768 au repos)
 * @param {number} [arg.rayonCoin] rayon d'arrondi des coins verticaux, en unités monde
 * @param {number} [arg.puissanceCoin] exposant de la superellipse (2 = cercle).
 *   ⚠️ **`puissanceCoin` et NON `exposantCoin`** : ce dernier est déjà un export
 *   de `fenetre-clip.js:71`, et c'est lui qui CALCULE cette valeur depuis
 *   `slabCornerSmoothing`.
 * @param {number} [arg.profondeurDalle] `baseY = pointLePlusBas − profondeurDalle`
 * @param {number} [arg.exageration] l'exagération verticale — voir le §6 et
 *   `exagerationContinue`
 * @param {number|null} [arg.baseYFloor] plancher imposé (le damier partage le sien)
 * @param {number|null} [arg.largeurM] la largeur au sol, si l'appelant la
 *   connaît mieux que l'emprise (défaut : dérivée de l'emprise)
 * @param {object} [arg.optionsSocle] les 7 options de finition de `plinth.js`,
 *   transportées telles quelles — voir le §7
 * @returns {object} la fenêtre
 */
export function construireFenetre ({
  emprise,
  n = 384,
  rayonCoin = 0,
  puissanceCoin = 2,
  profondeurDalle = PROFONDEUR_DALLE,
  exageration = EXAG_BASE,
  baseYFloor = null,
  largeurM = null,
  optionsSocle = null,
} = {}) {
  const emp = normaliserEmprise(emprise)
  const mailles = Math.max(1, Math.floor(n))
  const parCote = mailles + 1
  const nbGrille = parCote * parCote
  const rayon = Math.max(0, Math.min(Number(rayonCoin) || 0, DEMI_MONDE))
  const expo = Math.max(2, Number(puissanceCoin) || 2)
  const interieur = DEMI_MONDE - rayon

  const anneau = anneauDeBord(mailles)
  const nbAnneau = anneau.length
  // sommets : la nappe, puis l'anneau BAS, puis le centre de la dalle
  const iBas = nbGrille
  const iCentre = nbGrille + nbAnneau
  const nbSommets = iCentre + 1
  const geometrie = new Float32Array(nbSommets * 3)

  // ── les x/z, posés une fois : ils ne bougent plus jamais ──────────────────
  const pas = COTE_MONDE / mailles
  const tampon = [0, 0]
  for (let j = 0; j < parCote; j++) {
    const z0 = -DEMI_MONDE + j * pas
    for (let i = 0; i < parCote; i++) {
      const x0 = -DEMI_MONDE + i * pas
      versEmpreinte(x0, z0, interieur, rayon, expo, tampon)
      const t = (j * parCote + i) * 3
      geometrie[t] = tampon[0]
      geometrie[t + 2] = tampon[1]
    }
  }
  for (let s = 0; s < nbAnneau; s++) {
    const haut = anneau[s] * 3
    const bas = (iBas + s) * 3
    geometrie[bas] = geometrie[haut]
    geometrie[bas + 2] = geometrie[haut + 2]
  }
  // le centre de l'éventail : sur l'axe, par construction
  geometrie[iCentre * 3] = 0
  geometrie[iCentre * 3 + 2] = 0

  // ── les indices, posés une fois : la topologie ne bouge plus jamais ───────
  const nbTriangles = mailles * mailles * 2 + nbAnneau * 2 + nbAnneau
  const indices = new Uint32Array(nbTriangles * 3)
  let k = 0
  const T = (i, j) => j * parCote + i
  // la nappe : deux triangles par maille, normale vers +Y
  for (let j = 0; j < mailles; j++) {
    for (let i = 0; i < mailles; i++) {
      indices[k++] = T(i, j); indices[k++] = T(i, j + 1); indices[k++] = T(i + 1, j)
      indices[k++] = T(i + 1, j); indices[k++] = T(i, j + 1); indices[k++] = T(i + 1, j + 1)
    }
  }
  // les parois : pour l'arête p → q de l'anneau, [p, q, p_bas] et [q, q_bas, p_bas]
  for (let s = 0; s < nbAnneau; s++) {
    const s2 = (s + 1) % nbAnneau
    const p = anneau[s]
    const q = anneau[s2]
    const pb = iBas + s
    const qb = iBas + s2
    indices[k++] = p; indices[k++] = q; indices[k++] = pb
    indices[k++] = q; indices[k++] = qb; indices[k++] = pb
  }
  // la dalle : un éventail sur le MÊME anneau bas, normale vers −Y
  for (let s = 0; s < nbAnneau; s++) {
    const s2 = (s + 1) % nbAnneau
    indices[k++] = iCentre; indices[k++] = iBas + s; indices[k++] = iBas + s2
  }

  const fenetre = {
    geometrie,
    indices,
    boiteEnglobante: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    // ── ce dont `majHauteurs` a besoin, et rien de décoratif ──────────────
    emprise: { ouest: emp.ouest, sud: emp.sud, est: emp.est, nord: emp.nord },
    empriseNormalisee: emp,
    n: mailles,
    parCote,
    nbGrille,
    anneau,
    iBas,
    iCentre,
    largeurM: Number.isFinite(largeurM) && largeurM > 0 ? largeurM : emp.largeurM,
    exageration: Number.isFinite(exageration) ? exageration : EXAG_BASE,
    profondeurDalle: Number.isFinite(profondeurDalle) ? profondeurDalle : PROFONDEUR_DALLE,
    baseYFloor: Number.isFinite(baseYFloor) ? baseYFloor : null,
    rayonCoin: rayon,
    puissanceCoin: expo,
    // les hauteurs BRUTES, en mètres. ⚠️ Réutilisées à chaque `majHauteurs` :
    // c'est la `sortie` de `remplirHauteurs`, donc zéro allocation par image.
    hauteursM: new Float32Array(nbGrille),
    moyenneM: 0,
    minM: 0,
    maxM: 0,
    baseY: 0,
    echelleVerticale: 0,
    remplis: 0,
    manquants: nbGrille,
    // les 7 options de finition de `plinth.js`, transportées sans être
    // interprétées — voir le §7
    optionsSocle: optionsSocle || null,
  }
  appliquerHauteurs(fenetre)
  return fenetre
}

// ══════════ 4. LES HAUTEURS, SANS RECONSTRUIRE LA GÉOMÉTRIE ════════════════

/**
 * Réécrit les `y` de la fenêtre depuis `fenetre.hauteursM`.
 *
 * ⚠️ **AUCUNE ALLOCATION, AUCUNE RETRIANGULATION, AUCUN NOUVEAU TABLEAU.** Les
 * `x`/`z` et les indices sont posés une fois pour toutes par
 * `construireFenetre` ; ici on n'écrit que des `y`. C'est toute la raison d'être
 * de ce module : c'est ce geste-là qui remplace le cran.
 */
export function appliquerHauteurs (fenetre) {
  const { geometrie, hauteursM, nbGrille, anneau, iBas, iCentre } = fenetre
  let somme = 0
  let minM = Infinity
  let maxM = -Infinity
  for (let g = 0; g < nbGrille; g++) {
    const h = hauteursM[g]
    somme += h
    if (h < minM) minM = h
    if (h > maxM) maxM = h
  }
  const moyenneM = nbGrille > 0 ? somme / nbGrille : 0
  if (!Number.isFinite(minM)) { minM = 0; maxM = 0 }
  // ⚠️ MOT POUR MOT LA FORMULE DE `terrain.js:_makeDemSampler` — voir le §2.
  const echelle = (COTE_MONDE / Math.max(1e-9, fenetre.largeurM)) * fenetre.exageration

  let minY = Infinity
  let maxY = -Infinity
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let g = 0; g < nbGrille; g++) {
    const y = (hauteursM[g] - moyenneM) * echelle
    const t = g * 3
    geometrie[t + 1] = y
    const x = geometrie[t]
    const z = geometrie[t + 2]
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  // ⚠️ `baseY` se prend sur le point le plus bas de TOUTE la nappe, pas du bord
  // seulement : un bassin intérieur profond percerait sinon le fond du socle.
  // C'est la règle de `plinth.js:computeSlab` (« not just the border »), sauf
  // qu'ici on l'a exactement, sans balayage grossier — la grille EST le relevé.
  let baseY = minY - fenetre.profondeurDalle
  if (fenetre.baseYFloor != null) baseY = Math.min(fenetre.baseYFloor, baseY)

  for (let s = 0; s < anneau.length; s++) geometrie[(iBas + s) * 3 + 1] = baseY
  geometrie[iCentre * 3 + 1] = baseY

  fenetre.moyenneM = moyenneM
  fenetre.minM = minM
  fenetre.maxM = maxM
  fenetre.echelleVerticale = echelle
  fenetre.baseY = baseY
  const b = fenetre.boiteEnglobante
  b.min.x = minX; b.min.y = baseY; b.min.z = minZ
  b.max.x = maxX; b.max.y = maxY; b.max.z = maxZ
  return fenetre
}

/**
 * Met à jour les hauteurs de la fenêtre depuis le flux du quadtree —
 * **sans reconstruire la géométrie**. ⚠️ **C'est toute sa raison d'être.**
 *
 * ⚠️ **PAR LOT, JAMAIS PAR PIXEL** : `remplirHauteurs` fait une passe par
 * TUILE, pas une recherche par sommet. L'interface par pixel coûtait +3,5 ms
 * par reconstruction à n = 256 (Tâche 4 bis, mesuré).
 *
 * ⚠️ **`gardeHauteurs` RÉSERVE LES TUILES DU SOCLE** (`flux-terrain.js:268`) :
 * depuis la Tâche 4 sexies, `globe.js:1424` relâche `t.heights` au maillage.
 * Sans cette réserve il n'y aurait plus rien à lire ici — et le défaut serait
 * silencieux, la fenêtre rendant simplement un pavé plat.
 *
 * @param {object} fenetre la fenêtre rendue par `construireFenetre`
 * @param {object|ArrayLike<number>} fluxTerrain le flux (`creerFlux`), **ou**
 *   un tableau de `(n+1)²` hauteurs en mètres — le chemin des tests et des
 *   bancs, qui n'ont pas de globe.
 * @returns {void}
 */
export function majHauteurs (fenetre, fluxTerrain) {
  if (!fenetre || !fenetre.hauteursM) {
    throw new TypeError('majHauteurs : il faut une fenêtre de `construireFenetre`')
  }
  if (ArrayBuffer.isView(fluxTerrain) || Array.isArray(fluxTerrain)) {
    const src = fluxTerrain
    const cible = fenetre.hauteursM
    if (src.length !== cible.length) {
      throw new RangeError(`majHauteurs : ${src.length} hauteurs pour une grille de ${cible.length}`)
    }
    let remplis = 0
    for (let g = 0; g < cible.length; g++) {
      const h = Number(src[g])
      cible[g] = Number.isFinite(h) ? h : 0
      if (Number.isFinite(h)) remplis++
    }
    fenetre.remplis = remplis
    fenetre.manquants = cible.length - remplis
    appliquerHauteurs(fenetre)
    return
  }
  const { remplis, manquants } = remplirHauteurs(fluxTerrain, {
    emprise: fenetre.emprise,
    n: fenetre.n,
    sortie: fenetre.hauteursM,
  })
  fenetre.remplis = remplis
  fenetre.manquants = manquants
  appliquerHauteurs(fenetre)
}

// ══════════ 5. LE CONTOUR QUE `plinth.js` ATTEND, À L'ARRÊT ═════════════════

/**
 * L'anneau de la fenêtre au format de `computeSlab` — `{ ring, borderMin,
 * globalMin, baseY }`.
 *
 * ⚠️ **C'EST LE PONT DE LA DÉCISION 5** (« la gravure des parois ne s'écrit
 * qu'à l'arrêt de la caméra ») : pendant le mouvement la coque suffit ; à
 * l'arrêt, l'appelant passe ce contour à `buildSlabWalls` avec
 * `fenetre.optionsSocle` et récupère le socle COMPLET — chanfrein, congé, AO de
 * contact, masque, bords. Même anneau, même `baseY`, même forme de coin : il n'y
 * a rien à redeviner, donc rien à faire diverger.
 */
export function contourSocle (fenetre) {
  const { geometrie, anneau } = fenetre
  const ring = new Array(anneau.length)
  let borderMin = Infinity
  for (let s = 0; s < anneau.length; s++) {
    const t = anneau[s] * 3
    const y = geometrie[t + 1]
    if (y < borderMin) borderMin = y
    ring[s] = { x: geometrie[t], y, z: geometrie[t + 2] }
  }
  const globalMin = (fenetre.minM - fenetre.moyenneM) * fenetre.echelleVerticale
  return { ring, borderMin, globalMin, baseY: fenetre.baseY }
}

// ══════════ 6. LA COURBE D'EXAGÉRATION — DÉCISION 14 ═══════════════════════

/**
 * La table d'exagération d'AUJOURD'HUI, surcharges comprises, en fonction en
 * escalier — celle que la courbe doit traverser.
 *
 * ⚠️ **C'est `exagForZoom` de `main.js:3138`, à la ligne près** :
 * `surcharges[z] ?? ZOOM_EXAG_DEFAULTS[z] ?? BASE_EXAG`.
 */
export function exagPalier (zoom, { surcharges = null, ancres = EXAG_ANCRES, base = EXAG_BASE } = {}) {
  const z = Math.round(zoom)
  const s = surcharges?.[z]
  if (Number.isFinite(s)) return s
  const a = ancres?.[z]
  return Number.isFinite(a) ? a : base
}

/**
 * Les pentes de Fritsch–Carlson : une interpolation cubique **monotone par
 * morceaux**, donc SANS DÉPASSEMENT.
 *
 * ⚠️ **POURQUOI PAS UN `smoothstep`, ET POURQUOI PAS DU LINÉAIRE.** Le linéaire
 * passe par les ancres mais casse la PENTE à chacune : la vitesse de
 * l'exagération saute, et c'est encore un cran, plus petit. Le `smoothstep`
 * annule la pente à chaque ancre — donc il rend un escalier ADOUCI, ce qui est
 * exactement ce que la décision 14 refuse. Fritsch–Carlson est C¹, passe
 * exactement par les ancres, et ne peut pas dépasser : entre 2,5 et 5 la courbe
 * reste dans [2,5 ; 5], ce qu'un Catmull-Rom nu ne garantit pas.
 */
function pentesMonotones (ys) {
  const m = ys.length
  const d = new Array(m - 1)
  for (let i = 0; i < m - 1; i++) d[i] = ys[i + 1] - ys[i] // pas = 1 zoom
  const p = new Array(m)
  p[0] = d[0]
  p[m - 1] = d[m - 2]
  for (let i = 1; i < m - 1; i++) p[i] = (d[i - 1] + d[i]) / 2
  // ⚠️ **L'ÉTAPE QUE J'AVAIS SAUTÉE, ET LE TEST L'A ATTRAPÉE** : à un EXTREMUM
  // local, la pente doit être annulée. Sans elle la courbe montait à **5,000746
  // à z = 5,001** — au-dessus de l'ancre la plus haute, alors qu'aucune ancre ne
  // le demande. Un relief plus haut que le palier le plus haut, pour un demi-
  // millième de zoom : invisible en lecture, et c'est exactement ce que le §0
  // veut dire par « une assertion se rejoue contre le dépôt ».
  for (let i = 1; i < m - 1; i++) if (d[i - 1] * d[i] <= 0) p[i] = 0
  for (let i = 0; i < m - 1; i++) {
    if (d[i] === 0) { p[i] = 0; p[i + 1] = 0; continue }
    const a = p[i] / d[i]
    const b = p[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      p[i] = t * a * d[i]
      p[i + 1] = t * b * d[i]
    }
  }
  return p
}

/**
 * Fabrique la courbe d'exagération continue.
 *
 * ⚠️ **ELLE PASSE EXACTEMENT PAR LES ANCRES**, surcharges comprises : à zoom
 * ENTIER elle rend la valeur d'aujourd'hui au bit près (test). C'est la
 * décision 14 mot pour mot — « mêmes valeurs aux mêmes altitudes, interpolées
 * au lieu de sauter ».
 *
 * @param {{surcharges?:object, ancres?:object, base?:number, zoomMax?:number}} [arg]
 * @returns {(zoom:number) => number}
 */
export function courbeExageration ({ surcharges = null, ancres = EXAG_ANCRES, base = EXAG_BASE, zoomMax = ZOOM_EXAG_MAX } = {}) {
  const zMax = Math.max(1, Math.floor(zoomMax))
  const ys = new Array(zMax + 1)
  for (let z = 0; z <= zMax; z++) ys[z] = exagPalier(z, { surcharges, ancres, base })
  const p = pentesMonotones(ys)
  return (zoom) => {
    const z = Number(zoom)
    if (!Number.isFinite(z)) return base
    if (z <= 0) return ys[0]
    if (z >= zMax) return ys[zMax]
    const i = Math.floor(z)
    const t = z - i
    // Hermite cubique, pas = 1
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    return h00 * ys[i] + h10 * p[i] + h01 * ys[i + 1] + h11 * p[i + 1]
  }
}

/** La courbe par défaut, sans surcharge. Mémoïsée : elle ne dépend de rien. */
const COURBE_DEFAUT = courbeExageration()

/**
 * L'exagération verticale à un zoom RÉEL (non entier).
 *
 * ⚠️ Rebâtit la courbe si des surcharges sont données — c'est un coup de calcul
 * sur 16 valeurs, à faire au CHANGEMENT DE RÉGLAGE, pas par image. Le chemin par
 * image est `creerExagerationPartagee`, qui garde sa courbe.
 */
export function exagerationContinue (zoom, options = null) {
  if (!options) return COURBE_DEFAUT(zoom)
  return courbeExageration(options)(zoom)
}

// ══════════ 7. LE PONT ALTITUDE ↔ ZOOM ═════════════════════════════════════
//
// ⚠️ **DÉRIVÉ, PAS POSÉ.** La décision 14 dit « courbe continue de
// l'ALTITUDE », et les ancres sont indexées par ZOOM. Il faut donc une règle qui
// relie les deux, et une seule existe déjà dans ce dépôt : celle dont
// `seuil-socle.js` tire ses deux seuils — l'altitude à laquelle un bloc de zoom
// `z` occupe `FRACTION_REFERENCE` de la HAUTEUR de l'image.
//
//     largeur(z, lat) = 156543,03392 · cos(lat) · 768 / 2^z      (landmarks.js:22)
//     altitude        = largeur / (2 · fraction · tan(fov/2))    (seuil-socle.js:210)
//
// ⚠️ **CE CHOIX EST VÉRIFIABLE, ET IL EST VÉRIFIÉ** :
// `zoomDepuisAltitude(SEUIL_NAISSANCE_M, {lat: 45})` rend exactement
// `ZOOM_SOCLE = 13`. Ce n'est pas une coïncidence — c'est la même équation lue
// dans l'autre sens, et le test l'exige.

const PX_BLOC = 768 // `BLOCK_GROUND_PX` — `landmarks.js:15`, 3 tuiles de 256

/** L'altitude à laquelle un bloc de zoom `z` occupe `fraction` de l'image. */
export function altitudeDepuisZoom (zoom, { lat = 45, fovDeg = FOV_DEG, fraction = FRACTION_REFERENCE } = {}) {
  const largeur = (156543.03392 * Math.cos(lat * D2R) * PX_BLOC) / 2 ** zoom
  return largeur / (2 * fraction * Math.tan((fovDeg * D2R) / 2))
}

/** L'inverse — le zoom RÉEL (non entier) que cette altitude désigne. */
export function zoomDepuisAltitude (altitudeM, { lat = 45, fovDeg = FOV_DEG, fraction = FRACTION_REFERENCE } = {}) {
  const alt = Number(altitudeM)
  if (!(alt > 0)) return ZOOM_EXAG_MAX
  const largeur = alt * 2 * fraction * Math.tan((fovDeg * D2R) / 2)
  return Math.log2((156543.03392 * Math.cos(lat * D2R) * PX_BLOC) / largeur)
}

// ══════════ 8. LA VALEUR PARTAGÉE — UN ÉCRIVAIN, N LECTEURS ════════════════

/**
 * ⚠️ **LA MER, LE SOCLE ET LES TRACÉS GPX DOIVENT LIRE LA MÊME VALEUR AU MÊME
 * INSTANT.** C'est la famille de défauts déjà rencontrée deux fois sur ce
 * dépôt : un réglage écrit d'un côté, jamais transmis à l'autre. Aujourd'hui
 * `params.demExaggeration` est lu à DOUZE endroits (`terrain.js` ×5,
 * `ocean.js` ×2, `gpx.js`, `main.js` ×4) — douze occasions de diverger dès que
 * la valeur bouge par image.
 *
 * D'où cet objet : **un seul écrivain** (`majExageration`, une fois par image,
 * depuis l'altitude), **N lecteurs** (`partage.valeur`). Un lecteur ne peut pas
 * calculer sa propre valeur : il n'a pas la courbe.
 *
 * @param {{surcharges?:object, lat?:number, fovDeg?:number, fraction?:number}} [arg]
 */
export function creerExagerationPartagee ({ surcharges = null, ancres = EXAG_ANCRES, base = EXAG_BASE, lat = 45, fovDeg = FOV_DEG, fraction = FRACTION_REFERENCE } = {}) {
  const courbe = surcharges ? courbeExageration({ surcharges, ancres, base }) : COURBE_DEFAUT
  return {
    courbe,
    lat,
    fovDeg,
    fraction,
    // ⚠️ La valeur de DÉPART est celle du zoom du socle, pas `base` : une
    // fenêtre construite avant la première image ne doit pas naître à la
    // mauvaise échelle puis sauter.
    valeur: courbe(zoomDepuisAltitude(altitudeDepuisZoom(13, { lat, fovDeg, fraction }), { lat, fovDeg, fraction })),
    zoom: 13,
    altitudeM: null,
  }
}

/** L'unique écrivain. Appelé une fois par image, avant tout lecteur. */
export function majExageration (partage, altitudeM) {
  const z = zoomDepuisAltitude(altitudeM, partage)
  partage.zoom = z
  partage.altitudeM = Number(altitudeM)
  partage.valeur = partage.courbe(z)
  return partage.valeur
}

/**
 * Les surcharges d'Adrien, lues dans `localStorage` sous `monolith.zoomExag`.
 * ⚠️ **Les retirer casserait un réglage qu'il utilise.** Rend `null` hors
 * navigateur ou si le stockage est illisible — jamais une exception.
 */
export function surchargesStockees (stockage = null) {
  try {
    const s = stockage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    if (!s) return null
    const brut = s.getItem(CLE_EXAG)
    if (!brut) return null
    const obj = JSON.parse(brut)
    if (!obj || typeof obj !== 'object') return null
    const out = {}
    let vu = false
    for (const [k, v] of Object.entries(obj)) {
      const z = Number(k)
      const val = Number(v)
      if (Number.isInteger(z) && Number.isFinite(val) && val > 0) { out[z] = val; vu = true }
    }
    return vu ? out : null
  } catch {
    return null
  }
}
