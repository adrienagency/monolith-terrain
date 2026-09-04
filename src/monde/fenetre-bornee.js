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
//
// ══════════ 10. LES QUATRE ATTRIBUTS — Tâche 6 ter ══════════════════════════
//
// ⚠️ **LA TÂCHE 6 AVAIT POUR PÉRIMÈTRE LA COQUE, ET LA COQUE N'EST PAS UN
// MAILLAGE AFFICHABLE.** `construireFenetre` rendait `{ geometrie, indices }` —
// des positions et des index, rien d'autre. Le maillage de production porte
// QUATRE attributs (`position`, `uv`, `normal`, `color`, vérifié à l'exécution
// sur un `Terrain` réel). Posée telle quelle à la place du bloc, la fenêtre
// aurait donné **une forme sans relief éclairé ni palette**.
//
// **Ce que la 6 ter ajoute, et pourquoi chacun est là où il est :**
//
//   · **`uv` — POSÉE UNE FOIS, dans `construireFenetre`.** Elle ne dépend que
//     des `x`/`z`, et les `x`/`z` ne bougent JAMAIS (§4). La recalculer par
//     image serait payer un parcours complet pour réécrire les mêmes nombres.
//     ⚠️ Convention `grid-template.js:102-103` — `u = i/n`, **`v = 1 − j/n`** :
//     un test exige l'égalité BIT À BIT avec `gridTemplate` à `rayonCoin = 0`,
//     sans quoi la rampe et les masques se retourneraient en silence.
//
//   · **`normales` — RÉÉCRITES EN PLACE, dans `appliquerHauteurs`.** Elles
//     suivent les hauteurs, donc elles changent à chaque passe.
//     ⚠️ **ET PAS PAR `computeVertexNormals()` :** `terrain.js` mesure **83,8 ms
//     à Chamonix et 120,5 ms à La Réunion** pour cet appel de three, soit **81 %
//     de la fabrication d'une dalle** — plus de cinq fois le budget d'une image
//     à 60 Hz. `src/grid-normals.js` fait le même travail en **4,6 ms** sur une
//     grille régulière, en forme fermée, **bord et coins compris** (ce n'est pas
//     un schéma dégradé au bord : le nombre de faces présentes EST le `Y` du
//     vecteur). C'est lui qu'on branche.
//     ⚠️ **SA SEULE HYPOTHÈSE EST LE PAS RÉGULIER**, et elle tombe dans les
//     quatre pavés de coin quand `rayonCoin > 0` : `versEmpreinte` y contracte
//     la grille sur la superellipse. Le test ⑨ MESURE cet écart au lieu de le
//     supposer, et le branchement de la Tâche 6 ter prend `rayonCoin = 0` — la
//     forme du coin restant celle de `plinth.js`, exactement comme aujourd'hui.
//
//   · **`color` — NON, ET C'EST UN ARBITRAGE ÉCRIT.** La teinte par sommet de
//     `terrain.js:_ecrireRelief` est le produit de trois choses qui n'existent
//     pas ici : `uHeightRange` (l'amplitude de l'EMPRISE, pas de la fenêtre —
//     le piège n° 1 de l'étude 3×3, « la vallée se repeint quand un sommet plus
//     haut entre dans le cadre »), le champ de grain pré-cuit `tintField(seed)`,
//     et la palette. Les recopier ici en ferait une SECONDE source de vérité
//     pour la couleur du terrain — la famille de défauts que ce plan poursuit.
//     La fenêtre fournit donc la GÉOMÉTRIE ; `terrain.js` garde la couleur et
//     l'écrit dans le tampon qu'il alloue, comme il le fait déjà.
//
// ⚠️ **LA JUPE PARTAGE SES SOMMETS, DONC SES NORMALES — dit ici pour que
// personne ne le découvre à l'écran.** Le sommet HAUT d'une paroi **est** le
// sommet de bord de la nappe (c'est ce qui rend la couture exacte au bit près,
// §3) : il ne peut donc pas porter à la fois « vers le haut » pour la nappe et
// « vers l'extérieur » pour la paroi. Il porte celle de la nappe, et la paroi se
// lit comme un congé qui bascule vers l'horizontale en descendant. De même,
// l'anneau BAS sert à la fois la paroi et la dalle : il porte la sortante de la
// paroi, la dalle regardant le sol. **Sous le branchement de la 6 ter la jupe
// n'est même pas dessinée** — `trianglesNappe` borne le tirage à la nappe et
// `plinth.js` continue de fournir les parois, chanfrein et congé compris.

import { TERRAIN_SIZE } from '../terrain.js'
import { pointCoin } from '../fenetre-clip.js'
// ⚠️ **PAS `computeVertexNormals()`, ET CE N'EST PAS UN GOÛT DE STYLE** — voir
// le §10 ci-dessous : 83,8 ms mesurés in situ à Chamonix pour l'appel de three,
// contre 4,6 ms pour celui-ci. `grid-normals.js` n'importe RIEN, donc aucun
// cycle n'est ouvert ici.
import { gridNormals } from '../grid-normals.js'
import { remplirHauteurs } from './flux-terrain.js'
// ⚠️ Importé EN PLUS d'être ré-exporté : un `export … from` ne crée aucune
// liaison locale, et `construireFenetre` s'en sert comme valeur par défaut.
import { EXAG_BASE } from './exageration-continue.js'

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

// ⚠️ **LES §6, §7 ET §8 ONT DÉMÉNAGÉ DANS `exageration-continue.js`, ET LEUR
// SURFACE PUBLIQUE EST INCHANGÉE.** Raison unique et mécanique : les DOUZE
// lecteurs de l'exagération vivent dans `terrain.js` (×5), `ocean.js` (×2),
// `gpx.js` et `main.js` (×4) ; ce fichier-ci importe `TERRAIN_SIZE` de
// `terrain.js`, donc leur faire importer CE fichier aurait fermé le cycle
// `terrain.js → fenetre-bornee.js → terrain.js` et jeté un `ReferenceError` sur
// `COTE_MONDE` au chargement, **en production seulement** (aucun test ne charge
// `main.js`). Le nouveau module n'importe RIEN du tout. Les ré-exports
// ci-dessous gardent les 29 tests de la Tâche 6 valides sans qu'une ligne y
// change.
export {
  EXAG_BASE,
  EXAG_ANCRES,
  CLE_EXAG,
  ZOOM_EXAG_MAX,
  FOV_DEG,
  FRACTION_REFERENCE,
  exagPalier,
  courbeExageration,
  exagerationContinue,
  altitudeDepuisZoom,
  zoomDepuisAltitude,
  zoomCadrage,
  creerExagerationPartagee,
  majExageration,
  majExagerationCadrage,
  poserExageration,
  lireExageration,
  surchargesStockees,
} from './exageration-continue.js'

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
  // ⚠️ **LES `uv` NE DÉPENDENT QUE DES `x`/`z`, QUI NE BOUGENT JAMAIS** — voir
  // le §10 : elles se posent ici, une fois, et `majHauteurs` n'y touche plus.
  const uv = new Float32Array(nbSommets * 2)
  // Les normales, elles, suivent les hauteurs : `appliquerHauteurs` réécrit la
  // NAPPE à chaque passe (`gridNormals`), et la JUPE — anneau bas et centre de
  // dalle — est posée ici une fois pour toutes, parce qu'elle ne dépend que des
  // `x`/`z`. Voir le §10.
  const normales = new Float32Array(nbSommets * 3)

  // ── les x/z, posés une fois : ils ne bougent plus jamais ──────────────────
  const pas = COTE_MONDE / mailles
  const tampon = [0, 0]
  for (let j = 0; j < parCote; j++) {
    const z0 = -DEMI_MONDE + j * pas
    // ⚠️ `v = 1 − j/n`, PAS `j/n` : c'est la convention de `grid-template.js:103`,
    // donc celle de toutes les textures du bloc. L'inverser retournerait la
    // rampe et les masques du haut en bas, sans une seule erreur.
    const v = 1 - j / mailles
    for (let i = 0; i < parCote; i++) {
      const x0 = -DEMI_MONDE + i * pas
      versEmpreinte(x0, z0, interieur, rayon, expo, tampon)
      const g = j * parCote + i
      const t = g * 3
      geometrie[t] = tampon[0]
      geometrie[t + 2] = tampon[1]
      uv[g * 2] = i / mailles
      uv[g * 2 + 1] = v
    }
  }
  for (let s = 0; s < nbAnneau; s++) {
    const haut = anneau[s] * 3
    const bas = (iBas + s) * 3
    geometrie[bas] = geometrie[haut]
    geometrie[bas + 2] = geometrie[haut + 2]
    // le sommet bas d'une paroi porte les `uv` du sommet de bord qu'il double :
    // la paroi est ainsi peinte dans le prolongement exact du bord de la nappe.
    uv[(iBas + s) * 2] = uv[anneau[s] * 2]
    uv[(iBas + s) * 2 + 1] = uv[anneau[s] * 2 + 1]
  }
  // le centre de l'éventail : sur l'axe, par construction
  geometrie[iCentre * 3] = 0
  geometrie[iCentre * 3 + 2] = 0
  uv[iCentre * 2] = 0.5
  uv[iCentre * 2 + 1] = 0.5

  // ── les normales de la JUPE, posées une fois : elles ne dépendent que des x/z
  //
  // ⚠️ **L'ANNEAU BAS EST PARTAGÉ ENTRE LA PAROI ET LA DALLE**, et un sommet n'a
  // qu'une normale : on lui donne celle de la PAROI (horizontale, vers
  // l'extérieur), parce que la dalle regarde le sol et n'est jamais vue. Le
  // sommet HAUT de la paroi, lui, EST le sommet de bord de la nappe (§3) : il
  // porte donc la normale de la nappe, et la paroi se lit comme un congé — c'est
  // la conséquence assumée de la couture exacte, pas un oubli.
  //
  // La direction sortante se prend sur la TANGENTE de l'anneau (`suivant −
  // précédent`), pas sur la position : elle reste juste sur les coins en
  // superellipse, où « vers l'extérieur » n'est ni `±x` ni `±z`.
  for (let s = 0; s < nbAnneau; s++) {
    const av = anneau[(s + 1) % nbAnneau] * 3
    const ar = anneau[(s - 1 + nbAnneau) % nbAnneau] * 3
    const tx = geometrie[av] - geometrie[ar]
    const tz = geometrie[av + 2] - geometrie[ar + 2]
    // l'anneau tourne dans le sens de `anneauDeBord` : la sortante est (tz, 0, −tx)
    const inv = 1 / Math.max(1e-12, Math.hypot(tz, tx))
    const b = (iBas + s) * 3
    normales[b] = tz * inv
    normales[b + 1] = 0
    normales[b + 2] = -tx * inv
  }
  normales[iCentre * 3 + 1] = -1

  // ── les indices, posés une fois : la topologie ne bouge plus jamais ───────
  const nbTriangles = mailles * mailles * 2 + nbAnneau * 2 + nbAnneau
  const indices = new Uint32Array(nbTriangles * 3)
  let k = 0
  const T = (i, j) => j * parCote + i
  // la nappe : deux triangles par maille, normale vers +Y
  for (let j = 0; j < mailles; j++) {
    for (let i = 0; i < mailles; i++) {
      // ⚠️ **L'ORDRE EST CELUI DE `grid-template.js:113-114`, AU BIT PRÈS** —
      // `a,b,d` puis `b,c,d`. La 6 ter écrivait `d,b,c` : même triangle, même
      // enroulement, même normale, mais **pas le même tampon d'index**. Or le
      // branchement remplace le gabarit de production par celui-ci : deux
      // tampons « équivalents » se comparent mal et divergent sans bruit. Un
      // test les compare index pour index (⑨a).
      indices[k++] = T(i, j); indices[k++] = T(i, j + 1); indices[k++] = T(i + 1, j)
      indices[k++] = T(i, j + 1); indices[k++] = T(i + 1, j + 1); indices[k++] = T(i + 1, j)
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
    // ⚠️ **LES TROIS ATTRIBUTS QUI MANQUAIENT AU MAILLAGE DE PRODUCTION.**
    // `uv` est posée une fois (elle ne dépend que des `x`/`z`) ; `normales` est
    // réécrite EN PLACE par `appliquerHauteurs`. La quatrième, `color`, reste
    // celle de `terrain.js` — voir le §10, ce n'est pas un oubli.
    uv,
    normales,
    // le nombre de TRIANGLES de la seule nappe, pour qui ne veut dessiner
    // qu'elle et laisser les parois à `plinth.js` (§10)
    trianglesNappe: mailles * mailles * 2,
    nbSommets,
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
export function appliquerHauteurs (fenetre, { normales = true } = {}) {
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

  // ── LES NORMALES, RÉÉCRITES EN PLACE ─────────────────────────────────────
  //
  // ⚠️ **JAMAIS `computeVertexNormals()`** — 83,8 ms mesurés in situ à Chamonix
  // contre 4,6 ms ici (`grid-normals.js`), soit **cinq fois le budget d'une
  // image à 60 Hz** pour le seul appel de three : il remettrait le cran qu'on
  // enlève. `gridNormals` n'écrit QUE les `nbGrille` premiers sommets et ne lit
  // que ceux-là : la jupe, posée une fois par `construireFenetre`, n'est pas
  // touchée. Et `out` est le tampon existant : **zéro allocation**.
  //
  // ⚠️ **CE QU'ELLE SUPPOSE, ET CE QUE ÇA COÛTE AUX COINS — MESURÉ, PAS ESTIMÉ.**
  // La formule fermée est écrite pour un pas RÉGULIER `COTE_MONDE / n`. C'est
  // exact partout sauf dans les quatre pavés de coin, où `versEmpreinte`
  // contracte les `x`/`z` sur la superellipse. Écart à `computeVertexNormals`
  // au réglage de PRODUCTION du coin (`rayonCoin` 2,24, `puissanceCoin` 4,4) :
  // **63,1° au pire et 4,49° en moyenne sur 1 024 sommets à n = 384**, et
  // **1,47° même hors des pavés**, sur leurs voisins immédiats (test ⑨d).
  // À coins vifs : **0,022°**, l'arrondi Float32 et rien d'autre — c'est
  // pourquoi le branchement de la Tâche 6 ter prend `rayonCoin = 0` et laisse la
  // forme du coin à `plinth.js`, exactement comme aujourd'hui.
  // ⚠️ **`normales: false` — Tâche FLU.** Quand le grain FBM va s'ajouter aux `y`
  // juste après (`_ecrireRelief`, chemin du flux), celui-ci REFAIT les normales
  // sur la surface finale : les calculer ici, c'est les calculer deux fois par
  // raffinement (594 ms de `gridNormals` sur une descente à CPU ×4, pour moitié
  // jetés). L'appelant qui le sait le dit ; sans rien dire, le comportement est
  // celui d'avant, au bit près.
  if (normales) gridNormals(geometrie, fenetre.n, COTE_MONDE, fenetre.normales)

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
 * Repose la fenêtre sur une AUTRE emprise — **sans toucher à un seul sommet**.
 *
 * ⚠️ **SANS ELLE, LE SOCLE RESTE COLLÉ AU PREMIER LIEU CHARGÉ, ET ÇA A ÉTÉ
 * MESURÉ À L'ÉCRAN** (Tâche 6 quinquies, Étape 7) : quatre lieux chargés à la
 * suite — Réunion, Chamonix, Nice, Everest — rendaient les MÊMES `minM`, `maxM`
 * et `moyenneM`, au mètre près, parce que `_geometrieRebuild` garde la fenêtre
 * en place tant que sa résolution est bonne et que `fenetre.emprise` était figée
 * à la CONSTRUCTION. Tant que les hauteurs venaient du MNT (Tâche 6 ter),
 * l'emprise ne servait à rien — à `rayonCoin = 0` la nappe est le gabarit de
 * `gridTemplate`, et seule `largeurM` portait quelque chose. Dès qu'elle décide
 * QUELLES TUILES on lit, elle devient porteuse, et elle doit suivre le cadrage.
 * **C'est la décision 3 du plan** (« le socle suit le cadrage en continu »).
 *
 * ⚠️ **AUCUNE ALLOCATION, AUCUNE RETRIANGULATION.** Les `x`/`z`, les `uv` et les
 * index ne dépendent QUE de `n` : ils survivent au recadrage tels quels. Ce qui
 * change est ce qui décide des `y` — l'emprise lue, la largeur au sol, et
 * l'exagération du palier où l'on vient d'arriver.
 *
 * ⚠️ **L'EXAGÉRATION EN FAIT PARTIE, ET L'OUBLIER SE VOIT.** Elle change à
 * chaque cran (`syncExagToZoom`) : figée à la construction, le socle garderait
 * l'échelle verticale du premier zoom pour toujours.
 *
 * @param {object} fenetre la fenêtre rendue par `construireFenetre`
 * @param {object} arg — les seuls champs passés sont mis à jour
 * @returns {object} la même fenêtre
 */
export function recadrerFenetre (fenetre, { emprise, largeurM, exageration, profondeurDalle, baseYFloor } = {}) {
  if (!fenetre || !fenetre.hauteursM) {
    throw new TypeError('recadrerFenetre : il faut une fenêtre de `construireFenetre`')
  }
  if (emprise) {
    const emp = normaliserEmprise(emprise)
    fenetre.emprise = { ouest: emp.ouest, sud: emp.sud, est: emp.est, nord: emp.nord }
    fenetre.empriseNormalisee = emp
    // ⚠️ La largeur au sol suit l'emprise par DÉFAUT : sans ça, un recadrage
    // vers un autre zoom garderait l'échelle verticale de l'ancien, et le relief
    // doublerait ou se tasserait de moitié en silence.
    fenetre.largeurM = emp.largeurM
  }
  if (Number.isFinite(largeurM) && largeurM > 0) fenetre.largeurM = largeurM
  if (Number.isFinite(exageration) && exageration > 0) fenetre.exageration = exageration
  if (Number.isFinite(profondeurDalle)) fenetre.profondeurDalle = profondeurDalle
  if (baseYFloor !== undefined) fenetre.baseYFloor = baseYFloor
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
export function majHauteurs (fenetre, fluxTerrain, { normales = true } = {}) {
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
    appliquerHauteurs(fenetre, { normales })
    return
  }
  const { remplis, manquants } = remplirHauteurs(fluxTerrain, {
    emprise: fenetre.emprise,
    n: fenetre.n,
    sortie: fenetre.hauteursM,
  })
  fenetre.remplis = remplis
  fenetre.manquants = manquants
  appliquerHauteurs(fenetre, { normales })
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
// ══════════ 6, 7 ET 8 — DÉMÉNAGÉS DANS `exageration-continue.js` ═══════════
//
// ⚠️ **RIEN N'A ÉTÉ PERDU NI RÉÉCRIT** : la courbe de Fritsch–Carlson, le pont
// altitude ↔ zoom et le partage « un écrivain, N lecteurs » vivent désormais
// dans `./exageration-continue.js`, **au caractère près**, et sont ré-exportés
// en tête de ce fichier. La raison est un CYCLE D'IMPORT, écrite là-haut.
