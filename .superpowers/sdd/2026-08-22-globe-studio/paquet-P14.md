17ddd41 tache P14 : la garde morte que la mutation M11 a montree, et le test de la voisine DEHORS
bafb04f tache P14 : les 23 trainees de jupe, et la route que deux noteurs nommaient etait vide

 src/globe.js                 |  51 ++++++-
 src/monde/parois-crop.js     | 143 +++++++++++++++++-
 test/crop-parois.test.js     | 335 ++++++++++++++++++++++++++++++++++++++++++-
 test/globe-precision.test.js |  14 +-
 4 files changed, 533 insertions(+), 10 deletions(-)

diff --git a/src/globe.js b/src/globe.js
index 21743f6..cb1d12f 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -14,21 +14,21 @@
 import * as THREE from 'three'
 import { R_GLOBE, MERCATOR_MAX_LAT, EARTH_RADIUS_M, tileToLatLon, latLonToSphere } from './geo.js'
 import { rampColorStops } from './palette.js'
 import { GlobeClouds } from './globe-clouds.js'
 import { overzoomTile } from './bathy.js'
 // LA FORME DU CROP — Tâche A, « UNE SEULE TERRE ». Module PUR : il n'apporte ni
 // three ni DOM, et c'est lui qui lit `empriseSocle`, pas ce fichier.
 import { repereCrop, coinNormalise, zoomCropPrescrit, tuileDansCrop, mercX, mercY } from './monde/crop-sphere.js'
 // LES PAROIS ET LA BASE — Tâche B. Pur lui aussi : il ne rend que des nombres,
 // c'est ce fichier-ci qui en fait une géométrie three.
-import { construireSolideCrop, normalesParois, rabattementBorne } from './monde/parois-crop.js'
+import { construireSolideCrop, normalesParois, rabattementBorne, localDeAbsolu, jupesEffacees } from './monde/parois-crop.js'
 import { margeCoteDuCrop, intervalleCourbes, HABILLAGE_MONDE, CIRCONFERENCE_M, COTE_CROP_UNITES } from './monde/habillage-crop.js'
 import {
   RAMPE_MONDE,
   PAS_MESURE,
   mesurerRelief,
   echelleRampe,
   plancherRampeDuCrop,
 } from './monde/rampe-crop.js'
 // L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis. Pur lui aussi : il ne rend que
 // des nombres. ⚠️ **C'EST LUI QUI TIENT LES QUATRE NOMBRES DE RAMPE, ET PLUS
@@ -4958,20 +4958,31 @@ export class Globe {
     // ⛔ **ET LE PLANCHER DES JUPES MONTE AU SOMMET DU CONGÉ — même cause, autre
     // conséquence.** La jupe d'une tuile pend à l'aplomb du bord de la tuile ;
     // sous le sommet du congé, la silhouette du mur RENTRE, donc la jupe
     // dépasse par le bas. Mesuré à l'écran : **82 px de tuile sous le bas du
     // mur, en 4 langues**, contre **0** avant P13 — et **0 quand on éteint les
     // jupes par `setDrawRange`**, ce qui les désigne sans les supposer
     // (`.banc/P13/P4-trainees-P13.json`). ⚠️ **C'est la même dette que le
     // rideau d'eau, et la même parade** : la jupe s'arrête là où le mur cesse
     // d'être vertical.
     this._plancherJupeCrop = solide.baseY + solide.arrondi
+    // ⛔ **ET LE RETRAIT LATÉRAL DU MUR — Tâche P14, LA MOITIÉ QUE P13 N'A PAS
+    // FAITE.** `_plancherJupeCrop` a corrigé la LONGUEUR de la jupe ; il ne
+    // pouvait rien contre son DÉCALAGE LATÉRAL, et P13 le dit elle-même
+    // (« aucun réglage de la LONGUEUR ne peut réparer un décalage LATÉRAL »).
+    // Sous le chanfrein le mur est à `d = ch` **à toute hauteur** ; la jupe pend
+    // à `d = 0`. **Le mur est passé derrière elle**, et le noteur compte
+    // **23 traînées pâles contre 4 au socle** (`notation-05.md` §7.2).
+    // ⚠️ **MÊME MONNAIE QUE `_retraitBaseCrop` ET QUE `mer-sphere.js`** : une
+    // FRACTION DU DEMI-CÔTÉ, parce que c'est celle où `jupeHorsDuMur` compare —
+    // les coordonnées locales du crop valent ±1 sur l'emprise.
+    this._retraitJupeCrop = solide.largeur > 0 ? solide.chanfrein / (solide.largeur / 2) : 0
     // ⚠️ **ET LES JUPES DES TUILES SE RETAILLENT DESSUS — Tâche P7.** C'est ici
     // et pas dans `_buildMesh` parce que l'ordre l'impose : les parois exigent
     // des tuiles bâties (`couverture`), donc les tuiles du premier bloc sont
     // toujours plus vieilles que son fond. `_retaillerJupe` est idempotente et
     // recalcule depuis l'anneau de bord — la rappeler ne creuse rien.
     this._retaillerJupes()
     return { mesh, solide, couverture: solide.couverture, refus: null }
   }
 
   /** Retire les parois — le crop redevient une peau flottante. */
@@ -4984,20 +4995,24 @@ export class Globe {
     // ⚠️ **ET LE FOND DU BLOC PART AVEC LUI — Tâche P7.** Il ne l'était pas :
     // `_baseYCrop` survivait au retrait des parois, et deux lecteurs le
     // consultent maintenant (`poserMer` pour le rideau, `_rayonPlancherCrop`
     // pour la jupe des tuiles). Sans cette ligne, une tuile bâtie APRÈS le
     // retrait du crop se serait fait tailler sa jupe sur un bloc qui n'existe
     // plus. La garde de `poserMer` (`Number.isFinite(basY)`) devient donc vraie
     // pour la même raison qu'elle a été écrite.
     this._baseYCrop = null
     this._retraitBaseCrop = null
     this._plancherJupeCrop = null
+    // ⚠️ **ET LE RETRAIT LATÉRAL AUSSI — Tâche P14, même motif que les trois
+    // au-dessus** : sans mur, il n'y a plus rien qui couvre une jupe, donc plus
+    // rien qui autorise à la couper.
+    this._retraitJupeCrop = null
     // et les jupes reprennent leur pleine longueur : sans bloc, plus de plancher
     this._retaillerJupes()
   }
 
   /**
    * Le rayon du fond du bloc pour la jupe d'une tuile — `0` s'il n'y a pas de
    * bloc, ou si la tuile ne le touche pas. Tâche P7.
    *
    * ⚠️ **DEUX GARDES, ET CHACUNE EMPÊCHE UNE FAUTE DIFFÉRENTE.**
    *   ① `this._parois` : sans parois posées il n'y a **pas de plancher**, et
@@ -5028,38 +5043,70 @@ export class Globe {
   /**
    * Retaille la jupe d'UNE tuile sur le plancher du bloc courant — Tâche P7.
    *
    * ⚠️ **IDEMPOTENTE, ET C'EST LA PROPRIÉTÉ QUI LA REND SÛRE.** Elle recalcule
    * chaque sommet de jupe **depuis son sommet de BORD**, jamais depuis sa
    * position courante : l'appeler deux fois, ou l'appeler après un déplacement
    * de bloc, ou l'appeler quand le bloc a disparu (le plancher rend alors `0`,
    * donc la jupe pleine) rend exactement le même tampon. Une version qui
    * rabattrait « encore un peu » à chaque passage creuserait à chaque image.
    *
+   * ⛔ **ET DEPUIS LA TÂCHE P14 ELLE BORNE DANS LES DEUX SENS.** La hauteur par
+   * `rabattementBorne` (P7 puis P13) ; **le côté par `jupeHorsDuMur`** — un
+   * sommet de bord posé sur la frontière du crop est un sommet que le mur ne
+   * couvre plus depuis qu'il est rentré de `ch`, et sa jupe **s'efface** (elle
+   * se replie sur son propre sommet de bord, donc en triangles d'aire nulle).
+   * ⚠️ **L'IDEMPOTENCE SURVIT** : l'effacement se calcule, lui aussi, depuis le
+   * sommet de BORD, et `_retraitJupeCrop` nul rend exactement le tampon d'avant.
+   *
    * @returns {boolean} vrai si une jupe a été retaillée
    */
   _retaillerJupe(t) {
     const mesh = t?.mesh
     const d = mesh?.geometry?.userData?.jupe
     if (!d) return false
     const rPlancher = this._rayonPlancherCrop(t)
+    // ⚠️ **LE MÊME TRI QUE LE PLANCHER, ET IL EST OBLIGATOIRE** : `rPlancher`
+    // vaut 0 hors du crop (pas de parois, ou `tuileDansCrop` faux), et une tuile
+    // à l'autre bout du monde n'a pas de mur pour couvrir sa jupe. Sans cette
+    // garde, les ancêtres grossiers (z2, z3) — dont la BOÎTE contient l'emprise
+    // du crop, donc dont `tuileDansCrop` est vrai — perdraient leur jupe.
+    const retrait = rPlancher > 0 && Number.isFinite(this._retraitJupeCrop) ? this._retraitJupeCrop : 0
     const attr = mesh.geometry.attributes.position
     const a = attr.array
     const o = mesh.position
+    // ⚠️ **L'ANNEAU EST LU EN ENTIER AVANT D'ÊTRE COUPÉ**, parce que la coupe
+    // est un VOISINAGE (`jupesEffacees` dilate d'un cran) et qu'un voisinage ne
+    // se décide pas sommet par sommet en avançant.
+    let efface = null
+    if (retrait > 0) {
+      const locaux = new Array(d.bord.length)
+      for (let bi = 0; bi < d.bord.length; bi++) {
+        const src = d.bord[bi]
+        locaux[bi] = localDeAbsolu(a[src * 3] + o.x, a[src * 3 + 1] + o.y, a[src * 3 + 2] + o.z, this._crop)
+      }
+      efface = jupesEffacees(locaux, retrait)
+    }
     for (let bi = 0; bi < d.bord.length; bi++) {
       const src = d.bord[bi]
+      const dst = d.nV + bi
+      if (efface && efface[bi]) {
+        a[dst * 3] = a[src * 3]
+        a[dst * 3 + 1] = a[src * 3 + 1]
+        a[dst * 3 + 2] = a[src * 3 + 2]
+        continue
+      }
       const X = a[src * 3] + o.x
       const Y = a[src * 3 + 1] + o.y
       const Z = a[src * 3 + 2] + o.z
       const rayon = Math.hypot(X, Y, Z)
       const inv = 1 - rabattementBorne(d.rabattement, rayon, rPlancher) / rayon
-      const dst = d.nV + bi
       a[dst * 3] = X * inv - o.x
       a[dst * 3 + 1] = Y * inv - o.y
       a[dst * 3 + 2] = Z * inv - o.z
     }
     attr.needsUpdate = true
     mesh.geometry.computeBoundingSphere()
     return true
   }
 
   /**
diff --git a/src/monde/parois-crop.js b/src/monde/parois-crop.js
index fea2245..e08a346 100644
--- a/src/monde/parois-crop.js
+++ b/src/monde/parois-crop.js
@@ -251,21 +251,21 @@
 //      lui, comme un chargement.
 //   ③ **Le refus est RÉVERSIBLE et sans effet de bord** : `globe.js` ne touche
 //      pas aux parois déjà en place quand il refuse. Le bloc précédent reste à
 //      l'écran jusqu'à ce que la donnée arrive.
 //
 // ⚠️ **ET SI L'APPELANT ABAISSE LE SEUIL, IL ACHÈTE LES ENCOCHES** : les points
 // manquants se posent alors au plancher de mer. C'est écrit ici pour que ce ne
 // soit jamais une surprise.
 
 import { arcCoin } from '../fenetre-clip.js' // pur : aucune importation
-import { latLonDeLocal } from './crop-sphere.js'
+import { latLonDeLocal, localCrop } from './crop-sphere.js'
 
 /** Le pas de l'anneau, ramené au demi-côté 1. `plinth.js` : TERRAIN_SIZE / 256. */
 export const PAS_CONTOUR = 2 / 256
 
 /**
  * La profondeur du bloc, en FRACTION de sa largeur.
  * ⚠️ **7 / 56, ET LES DEUX CHIFFRES SONT AU DÉPÔT** : `depth = 7` par défaut
  * dans `buildSlabWalls`, `TERRAIN_SIZE = 56` dans `terrain.js`. Ce n'est pas un
  * goût, c'est la proportion du socle d'aujourd'hui.
  */
@@ -371,20 +371,161 @@ export function occlusionContact(y, baseY, bande, force = FORCE_AO) {
  * @param {number} rayonSommet le rayon du sommet de BORD, depuis le centre
  * @param {number} rayonPlancher le rayon du fond du bloc — `0` (ou non fini)
  *   quand aucun bloc n'est posé : le rabattement est alors rendu TEL QUEL
  * @returns {number} le rabattement à appliquer
  */
 export function rabattementBorne(rabattement, rayonSommet, rayonPlancher) {
   if (!(rayonPlancher > 0) || !(rayonSommet > 0)) return rabattement
   return Math.min(rabattement, Math.max(0, rayonSommet - rayonPlancher))
 }
 
+/**
+ * (x, y, z) ABSOLUS → coordonnées LOCALES du crop (±1 sur son emprise).
+ * Tâche P14. **L'inverse exact de `surSphere` composé avec `localCrop`** — c'est
+ * la seule façon de savoir où tombe un sommet de JUPE, qui n'est indexé nulle
+ * part sur l'emprise du crop : il est bâti dans le repère RTC de SA tuile.
+ *
+ * ⚠️ **ON PASSE PAR LA SPHÈRE NUE, ET C'EST VOULU.** La latitude est lue sur le
+ * rayon du point (relief compris) : un sommet à 3 000 m d'altitude a la même
+ * (lat, lon) que son pied, et c'est bien cette (lat, lon)-là que la frontière du
+ * crop compare — `uCropCentre` / `uCropDemi` sont en mercator, sans altitude.
+ *
+ * @returns {{u:number,v:number}|null} `null` si le point est au centre du globe
+ */
+export function localDeAbsolu(x, y, z, repere) {
+  const r = Math.hypot(x, y, z)
+  if (!(r > 0) || !repere) return null
+  const lat = Math.asin(Math.max(-1, Math.min(1, y / r))) / D2R
+  const lon = Math.atan2(x, z) / D2R
+  return localCrop(lat, lon, repere)
+}
+
+/**
+ * Le sommet de jupe tombe-t-il **HORS DU MUR** ? — Tâche P14.
+ *
+ * ⛔ **LE DÉFAUT, MESURÉ AVANT D'ÊTRE RÉPARÉ, ET IL EST LATÉRAL.** La Tâche P13
+ * a rentré le mur de `FRACTION_CHANFREIN` **à toute hauteur sous le chanfrein**
+ * (rang ① et au-delà, `d = ch`). La jupe d'une tuile, elle, pend **à l'aplomb du
+ * bord de la tuile**, donc au rayon de l'anneau, `d = 0`. **Le mur est passé
+ * DERRIÈRE la jupe**, et les jupes des tuiles de bord se lisent depuis comme des
+ * traînées pâles verticales sur l'aplat du mur : **23 traînées sur 68 colonnes
+ * contre 4 sur 10 au socle et 7 sur 10 avant P13**, résidu de colonne 0,961
+ * contre 0,336 au socle (relevé du noteur, `notation-05.md` §7.2, reproduit au
+ * bit près par cette tâche).
+ *
+ * ⚡ **ET LA CAUSE EST DÉSIGNÉE PAR EXTINCTION, TUILE PAR TUILE** — c'est ce qui
+ * distingue cette borne-ci de celle que P13 et le noteur proposaient. Les deux
+ * écrivaient « supprimer la jupe des tuiles que la frontière du crop TRAVERSE » :
+ * ⛔ **cette route est VIDE, et elle est mesurée vide.** L'emprise du crop est
+ * celle du socle (`assietteCrop` → `terrain.fenetreBornee.emprise`), donc
+ * **alignée sur la grille de tuiles par construction** : au relevé de La Réunion
+ * z12, la boîte du crop tombe exactement sur les tuiles z13 5356…5361 × 4584…4589,
+ * **aucune tuile n'est traversée**, et éteindre les jupes des 14 tuiles que mon
+ * test de traversée désigne (des ancêtres grossiers, z2/z3/z12) laisse
+ * **23 traînées sur 23** (`.banc/P14/D1-jupes-qui-P14.json`). Ce qui raye le mur,
+ * ce sont les jupes des tuiles **entièrement dedans dont le BORD est la
+ * frontière** : les éteindre rend 10 traînées, exactement le compte de
+ * l'extinction totale.
+ *
+ * ➡️ **ON COUPE DONC PAR SOMMET, PAS PAR TUILE.** Un sommet de bord à moins de
+ * `retrait` de la frontière est un sommet que le mur ne couvre plus : sa jupe
+ * n'a plus de service anti-fente à rendre (le mur, lui, part de la surface
+ * DESSINÉE — `hauteurDessinee`, Tâche P11 — donc il n'y a aucun jour à combler
+ * sous l'arête), et elle ne peut plus que dépasser. Tous les autres sommets
+ * gardent leur jupe entière, **donc son service à l'intérieur du bloc**, exactement
+ * comme `rabattementBorne` la garde en hauteur.
+ *
+ * ⛔ **C'EST UNE BANDE, PAS UN DEMI-PLAN, ET LA BORNE DU DEHORS N'EST PAS UN
+ * ORNEMENT.** `tuileDansCrop` est un test d'INTERSECTION DE BOÎTES : les
+ * ancêtres grossiers du quadtree le passent tous, puisque leur boîte CONTIENT
+ * l'emprise du crop. Relevé dans ma page (`.banc/P14/D3-uv-bord-P14.json`) : la
+ * tuile z2 (2, 2) a des sommets de bord à **|u| = 519**, la z3 à **261**, la z8
+ * à **7**. Un test « `|u| ≥ 1 − retrait` » seul leur effacerait **toute** leur
+ * jupe, sur tout le globe, pour un mur qui est à cinq cents demi-côtés de là.
+ * ➡️ **On coupe donc dans la bande `1 ± retrait`, et nulle part ailleurs.**
+ *
+ * ⚠️ **`retrait = 0` NE COUPE RIEN, AU BIT PRÈS**, et c'est l'instrument de banc
+ * de la règle D13 : il permet l'A/B à témoin nul dans une seule page.
+ *
+ * @param {number} u coordonnée locale du crop, ±1 sur l'emprise
+ * @param {number} v idem
+ * @param {number} retrait le retrait du mur, **en fraction du demi-côté** —
+ *   la monnaie de `_retraitBaseCrop` et de `mer-sphere.js`
+ * @returns {boolean} vrai si la jupe de ce sommet doit être supprimée
+ */
+export function jupeHorsDuMur(u, v, retrait) {
+  if (!(retrait > 0) || !Number.isFinite(u) || !Number.isFinite(v)) return false
+  const q = Math.max(Math.abs(u), Math.abs(v))
+  return q >= 1 - retrait && q <= 1 + retrait
+}
+
+/**
+ * Les sommets de jupe à EFFACER le long de l'anneau de bord — Tâche P14.
+ *
+ * ⛔ **LA DILATATION D'UN CRAN N'EST PAS UNE PRÉCAUTION, ELLE EST LA MOITIÉ DU
+ * GAIN, ET LE BALAYAGE LA DÉSIGNE.** Effacer les seuls sommets de la frontière
+ * laisse en place le **QUAD DE TRANSITION** : celui qui joint un sommet effacé
+ * (jupe de longueur nulle, sur la frontière) à son voisin resté entier (jupe
+ * pleine, un pas de maillage en dedans). Ce quad est un triangle qui descend en
+ * biais **à cheval sur la face interne du mur**, et il se lit exactement comme
+ * la traînée qu'on retire.
+ *
+ * ⚡ **MESURÉ, DANS UNE SEULE PAGE, PAR BALAYAGE DU RETRAIT**
+ * (`.banc/P14/D2-balayage-retrait-P14.json`, dix valeurs, retour 0 canal) : le
+ * compte de traînées est un ESCALIER à deux marches, et les marches tombent
+ * exactement sur les anneaux de sommets du maillage de tuile
+ * (`1`, puis `1 − 1/72` au relevé de La Réunion, soit un pas de
+ * `segmentsTuile = 24` sur un crop de 3 tuiles de demi-côté) :
+ *
+ * | retrait | traînées | colonnes | résidu |
+ * |---|---|---|---|
+ * | `0` *(le dépôt)* | **23** | 68 | 0,961 |
+ * | `0,25·ch` … `2·ch` — la frontière seule | **17** | 23 | 0,641 |
+ * | `3·ch` … `8·ch` — la frontière **et son voisin** | ⚡ **9** | **13** | **0,604** |
+ *
+ * ➡️ **La seconde marche vaut autant que la première**, et elle passe SOUS le
+ * plancher de l'extinction totale des jupes (10 / 14 / 0,665). ⚡ **C'est donc
+ * le voisinage d'anneau qu'il faut couper, pas une distance** : dilater d'un
+ * cran atteint la seconde marche **sans dépendre de la finesse du maillage**,
+ * là où un `3 × ch` en dur ne la tiendrait qu'à `segmentsTuile = 24`.
+ *
+ * ⚠️ **ET LA DILATATION EST CYCLIQUE** : l'anneau de bord de `_buildMesh` se
+ * referme (nord, est, sud, ouest, puis retour au premier), et le dernier quad
+ * joint le dernier sommet au premier.
+ *
+ * @param {Array<{u:number,v:number}|null>} locaux les sommets de BORD en
+ *   coordonnées locales du crop, **dans l'ordre de l'anneau**
+ * @param {number} retrait en fraction du demi-côté
+ * @returns {Uint8Array} 1 = jupe à effacer
+ */
+export function jupesEffacees(locaux, retrait) {
+  const n = locaux ? locaux.length : 0
+  const brut = new Uint8Array(n)
+  // ⚠️ **PAS DE GARDE `retrait > 0` ICI, ET C'EST UNE SURVIVANTE QUI L'A DIT.**
+  // La mutation M11 de la campagne P14 la retirait et personne ne mourait :
+  // `jupeHorsDuMur` porte déjà son propre neutre, donc `aucun` reste vrai et on
+  // rend le tableau nul par le chemin d'en dessous. **Une garde qu'aucun test ne
+  // peut distinguer est du code mort** — c'est la dixième de ce chantier.
+  if (n === 0) return brut
+  let aucun = true
+  for (let i = 0; i < n; i++) {
+    const l = locaux[i]
+    if (l && jupeHorsDuMur(l.u, l.v, retrait)) { brut[i] = 1; aucun = false }
+  }
+  if (aucun) return brut
+  const dilate = new Uint8Array(n)
+  for (let i = 0; i < n; i++) {
+    if (brut[i] || brut[(i + 1) % n] || brut[(i - 1 + n) % n]) dilate[i] = 1
+  }
+  return dilate
+}
+
 /**
  * L'anneau du crop, en coordonnées LOCALES (±1), sens horaire vu du dessus.
  *
  * ⚠️ **LE TRACÉ EST CELUI DE `computeSlab`, RAMENÉ AU DEMI-CÔTÉ 1** — mêmes
  * côtés droits, mêmes arcs par `arcCoin`, même ordre de parcours. Les points
  * d'arc vont de `a0` INCLUS à `a1` EXCLU (convention d'`arcCoin`), donc aucun
  * doublon avec le côté droit qui suit : un doublon serait un triangle dégénéré
  * de paroi, et `auditerSolide` le refuserait.
  *
  * @param {number} coin - rayon d'arrondi, en FRACTION du demi-côté (0 = carré)
diff --git a/test/crop-parois.test.js b/test/crop-parois.test.js
index 5ec7ddb..aba2206 100644
--- a/test/crop-parois.test.js
+++ b/test/crop-parois.test.js
@@ -58,20 +58,23 @@ import {
   construireSolideCrop,
   normalesParois,
   occlusionContact,
   FRACTION_PROFONDEUR,
   FRACTION_CHANFREIN,
   FRACTION_ARRONDI,
   ARRONDI_SEG,
   PART_MUR_MAX,
   PAS_CONTOUR,
   rabattementBorne,
+  localDeAbsolu,
+  jupeHorsDuMur,
+  jupesEffacees,
 } from '../src/monde/parois-crop.js'
 import { repereCrop, coinNormalise, latLonDeLocal, localCrop } from '../src/monde/crop-sphere.js'
 // ⚠️ ON APPELLE LES MÉTHODES DU GLOBE PAR `.call` SUR UN OBJET MINIMAL, patron
 // de `test/globe-precision.test.js` : monter un `Globe` réclamerait le DOM.
 import { Globe, sampleHeights } from '../src/globe.js'
 import { auditerSolide } from '../src/monde/audit-solide.js'
 import { dansDalle } from '../src/damier-bords.js'
 import { dansFenetre, exposantCoin } from '../src/fenetre-clip.js'
 import { ZOOM_SOCLE, LARGEUR_SOCLE_M } from '../src/monde/seuil-socle.js'
 import {
@@ -1012,21 +1015,23 @@ test('P7 · la borne est MONOTONE, et un plancher plus profond rend plus de jupe
 })
 
 test('P7 · `globe.js` APPELLE la borne, et il ne la réécrit pas', () => {
   const g = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
   // ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT DE COMPTER** — ceux de ligne ET
   // ceux de bloc. La Tâche K ter a eu une mutation survivante parce qu une
   // assertion lisait une formule dans un pavé de prose ; ici c est l inverse,
   // un pavé de prose faisait compter une occurrence de trop.
   const corps = g.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
   assert.match(corps, /rabattementBorne\(d\.rabattement, rayon, rPlancher\)/)
-  assert.match(corps, /import \{ construireSolideCrop, normalesParois, rabattementBorne \}/)
+  // ⚠️ **LA LISTE D IMPORT A GRANDI AVEC LA TÂCHE P14** (`localDeAbsolu`,
+  // `jupesEffacees`) : on exige que la borne y soit, pas que la liste soit figée.
+  assert.match(corps, /import \{ construireSolideCrop, normalesParois, rabattementBorne,[^}]*\} from '\.\/monde\/parois-crop\.js'/)
   // une seconde écriture de la loi — un `Math.min` sur le rabattement ailleurs —
   // est exactement ce que ce chantier a payé quatre fois sur la mer.
   const occurrences = (corps.match(/rabattementBorne/g) || []).length
   assert.equal(occurrences, 2, 'la borne doit être IMPORTÉE une fois et APPELÉE une fois')
 })
 
 // ══════════ ⑬ LE CHANFREIN ET LE CONGÉ — LA PERTE DE LA TÂCHE B, REPRISE ════
 //
 // ⛔ **CE POSTE EST LE SEUL INCHANGÉ DEPUIS LA PREMIÈRE NOTATION**, et le noteur
 // l'a réécrit quatre fois dans les mêmes termes : « un fin liseré lumineux court
@@ -1519,10 +1524,338 @@ test('⑬i `construireParoisCrop` TRANSMET les trois réglages — l instrument
   const gros = bati({ fractionChanfrein: FRACTION_CHANFREIN * 2 }).solide
   assert.ok(Math.abs(gros.chanfrein / defaut.chanfrein - 2) < 1e-9,
     `le chanfrein doublé rend ${gros.chanfrein / defaut.chanfrein}`)
   assert.equal(gros.arrondi, defaut.arrondi, 'doubler le chanfrein a bougé le congé')
   const rond = bati({ fractionArrondi: FRACTION_ARRONDI * 2 }).solide
   assert.ok(Math.abs(rond.arrondi / defaut.arrondi - 2) < 1e-9)
   assert.equal(rond.chanfrein, defaut.chanfrein, 'doubler le congé a bougé le chanfrein')
   const fin = bati({ arrondiSeg: 6 }).solide
   assert.equal(fin.rangs - fin.rangArc, 7, '`arrondiSeg` n atteint pas le module')
 })
+
+// ══════════ P14 · LE RETRAIT LATÉRAL DE LA JUPE ═════════════════════════════
+//
+// ⛔ **CE QUE P13 A LAISSÉ OUVERT, ET LE NOTEUR L'A CHIFFRÉ.** P13 a rentré le
+// mur de `FRACTION_CHANFREIN` **à toute hauteur sous le chanfrein** ; la jupe
+// d'une tuile, elle, pend à l'aplomb du BORD de la tuile. Le mur est donc passé
+// DERRIÈRE elle, et les jupes de bord se lisent depuis comme des traînées pâles
+// verticales : **23 traînées / 68 colonnes / résidu 0,961** contre **4 / 10 /
+// 0,336** au socle dans la MÊME page (`notation-05.md` §7.2).
+//
+// ⚠️ **`_plancherJupeCrop` A CORRIGÉ LA LONGUEUR, PAS LE DÉCALAGE LATÉRAL** —
+// P13 l'écrit elle-même. Ce bloc-ci vérifie la borne latérale, et il la vérifie
+// **par le COMPORTEMENT** : on bâtit un vrai maillage de tuile, on appelle la
+// vraie `_retaillerJupe`, et on regarde le tampon de positions.
+
+const P14_ZOOM = 12
+const P14_X = 2679
+const P14_Y = 2293
+
+// le centre du crop = le CENTRE de la tuile (P14_X, P14_Y) : l'emprise 3×3 tombe
+// alors exactement sur les bords de tuiles, ce qui est le cas de l'application
+// (`assietteCrop` lit `terrain.fenetreBornee.emprise`, la fenêtre du socle).
+const P14_CENTRE = tileToLatLon(P14_X + 0.5, P14_Y + 0.5, P14_ZOOM)
+const P14_REPERE = repereCrop({ centre: P14_CENTRE, zoom: P14_ZOOM })
+
+function surSphereP14(lat, lon, rayon) {
+  const la = (lat * Math.PI) / 180
+  const lo = (lon * Math.PI) / 180
+  return [rayon * Math.cos(la) * Math.sin(lo), rayon * Math.sin(la), rayon * Math.cos(la) * Math.cos(lo)]
+}
+
+function tuileP14(z, x, y) {
+  const nw = tileToLatLon(x, y, z)
+  const se = tileToLatLon(x + 1, y + 1, z)
+  const vec = (lat, lon) => {
+    const p = surSphereP14(lat, lon, R_GLOBE)
+    return new THREE.Vector3(p[0], p[1], p[2])
+  }
+  return {
+    key: `${z}/${x}/${y}`, z, x, y, state: 'ready',
+    heights: new Float32Array(256 * 256), size: 256,
+    texture: null, mesh: null, lastUsed: 0,
+    center: vec((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2),
+    chord: vec(nw.lat, nw.lon).distanceTo(vec(se.lat, se.lon)),
+  }
+}
+
+// un globe de papier qui porte les VRAIES méthodes de jupe et un bloc posé
+function globeP14({ retrait = 0, profondeur = 0.06 } = {}) {
+  return {
+    exaggeration: 2,
+    group: new THREE.Group(),
+    tiles: new Map(),
+    _materialFor: () => new THREE.MeshBasicMaterial(),
+    _fondCrop: null,
+    _parois: {}, // truthy : le bloc est posé
+    _crop: P14_REPERE,
+    _baseYCrop: -profondeur,
+    _plancherJupeCrop: -profondeur,
+    _retraitJupeCrop: retrait,
+    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
+    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
+  }
+}
+
+function batirP14(g, t) {
+  Globe.prototype._buildMesh.call(g, t)
+  return t.mesh
+}
+
+// le sommet de jupe est-il EFFACÉ ? — il s'est replié sur son sommet de bord
+function jupeEffacee(mesh, d, bi) {
+  const a = mesh.geometry.attributes.position.array
+  const src = d.bord[bi]
+  const dst = d.nV + bi
+  return a[dst * 3] === a[src * 3] && a[dst * 3 + 1] === a[src * 3 + 1] && a[dst * 3 + 2] === a[src * 3 + 2]
+}
+
+// les coordonnées locales du crop d'un sommet de BORD
+function localBord(mesh, d, bi) {
+  const a = mesh.geometry.attributes.position.array
+  const o = mesh.position
+  const src = d.bord[bi]
+  return localDeAbsolu(a[src * 3] + o.x, a[src * 3 + 1] + o.y, a[src * 3 + 2] + o.z, P14_REPERE)
+}
+
+const qLocal = (l) => Math.max(Math.abs(l.u), Math.abs(l.v))
+
+test('P14 · `jupeHorsDuMur` coupe DANS LA BANDE de la frontière, et nulle part ailleurs', () => {
+  const r = 2 * FRACTION_CHANFREIN // le retrait du mur, en fraction du DEMI-côté
+  // sur la frontière : coupé
+  assert.equal(jupeHorsDuMur(1, 0, r), true)
+  assert.equal(jupeHorsDuMur(0, -1, r), true)
+  assert.equal(jupeHorsDuMur(1 - r / 2, 0.2, r), true)
+  // ⛔ ET LE DEHORS N EST PAS COUPÉ — c est la garde des ancêtres grossiers du
+  // quadtree, dont la BOÎTE contient l emprise du crop (`tuileDansCrop` vrai) :
+  // relevé dans la page, la tuile z2 a des sommets de bord à |u| = 519.
+  assert.equal(jupeHorsDuMur(519, 0, r), false)
+  assert.equal(jupeHorsDuMur(0, -261.7, r), false)
+  assert.equal(jupeHorsDuMur(1 + 2 * r, 0, r), false)
+  // au milieu du bloc : rien à couper
+  assert.equal(jupeHorsDuMur(0, 0, r), false)
+  assert.equal(jupeHorsDuMur(0.5, -0.5, r), false)
+  // ⚠️ LE NEUTRE EST EXACT : `retrait = 0` ne coupe RIEN, nulle part
+  for (const rien of [0, -1, NaN, null, undefined]) {
+    assert.equal(jupeHorsDuMur(1, 1, rien), false, `retrait ${rien}`)
+  }
+  // et un sommet illisible n invente pas une coupe
+  assert.equal(jupeHorsDuMur(NaN, 0, r), false)
+})
+
+test('P14 · `jupesEffacees` DILATE d un cran, et l anneau est CYCLIQUE', () => {
+  const r = 0.01
+  // un anneau de 8 sommets dont un seul est sur la frontière
+  const anneau = [
+    { u: 0, v: 0 }, { u: 0.2, v: 0 }, { u: 1, v: 0 }, { u: 0.2, v: 0.2 },
+    { u: 0, v: 0.2 }, { u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 },
+  ]
+  assert.deepEqual([...jupesEffacees(anneau, r)], [0, 1, 1, 1, 0, 0, 0, 0],
+    'le quad de transition joint un sommet effacé à son voisin : il faut les deux')
+  // ⚠️ CYCLIQUE : le dernier quad joint le dernier sommet au premier
+  const bout = [{ u: 1, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }]
+  assert.deepEqual([...jupesEffacees(bout, r)], [1, 1, 0, 1],
+    'la dilatation doit repasser par le début de l anneau')
+  // le neutre, et l anneau qui ne touche pas la frontière
+  assert.deepEqual([...jupesEffacees(anneau, 0)], [0, 0, 0, 0, 0, 0, 0, 0])
+  assert.deepEqual([...jupesEffacees([{ u: 0, v: 0 }, { u: 0.5, v: 0.5 }], r)], [0, 0])
+  assert.equal(jupesEffacees(null, r).length, 0)
+})
+
+test('P14 · `localDeAbsolu` est l INVERSE de la pose sphérique — au crop près', () => {
+  // ⚠️ On ne lit pas une formule : on repart d un point de la frontière connu,
+  // on le pose sur la sphère, et on exige de le retrouver.
+  for (const [u, v] of [[1, 0], [0, 1], [-1, 0], [0.5, -0.25], [0, 0]]) {
+    const { lat, lon } = latLonDeLocal(u, v, P14_REPERE)
+    const P = surSphereP14(lat, lon, R_GLOBE * 1.0004) // avec du relief : sans effet
+    const l = localDeAbsolu(P[0], P[1], P[2], P14_REPERE)
+    assert.ok(Math.abs(l.u - u) < 1e-9 && Math.abs(l.v - v) < 1e-9,
+      `(${u}, ${v}) rendu (${l.u}, ${l.v})`)
+  }
+  assert.equal(localDeAbsolu(0, 0, 0, P14_REPERE), null)
+  assert.equal(localDeAbsolu(1, 1, 1, null), null)
+})
+
+test('P14 · la jupe s efface SUR la frontière et RESTE ENTIÈRE en dedans', () => {
+  // la tuile de BORD EST du crop : son côté est tombe sur `u = +1`
+  const r = 2 * FRACTION_CHANFREIN
+  const g = globeP14({ retrait: r })
+  const t = tuileP14(P14_ZOOM, P14_X + 1, P14_Y)
+  const mesh = batirP14(g, t)
+  const d = mesh.geometry.userData.jupe
+  assert.ok(g._rayonPlancherCrop(t) > 0, 'la tuile doit être DANS le crop, sinon le test ne mesure rien')
+
+  let surFrontiere = 0
+  let dedans = 0
+  for (let bi = 0; bi < d.bord.length; bi++) {
+    const q = qLocal(localBord(mesh, d, bi))
+    if (q > 1 - r) {
+      surFrontiere++
+      assert.ok(jupeEffacee(mesh, d, bi), `sommet ${bi} sur la frontière (q=${q}) : jupe non effacée`)
+    } else if (q < 1 - 3 / 72) {
+      // un sommet à plus de DEUX pas de maillage de la frontière garde sa jupe
+      dedans++
+      assert.ok(!jupeEffacee(mesh, d, bi), `sommet ${bi} en plein dedans (q=${q}) : jupe effacée à tort`)
+    }
+  }
+  assert.ok(surFrontiere >= 24, `la tuile de bord doit poser un côté sur la frontière (${surFrontiere})`)
+  assert.ok(dedans >= 24, `il doit rester des sommets francs du dedans (${dedans})`)
+})
+
+test('P14 · le VOISIN d un sommet de frontière perd sa jupe AUSSI — le quad de transition', () => {
+  const r = 2 * FRACTION_CHANFREIN
+  const g = globeP14({ retrait: r })
+  const t = tuileP14(P14_ZOOM, P14_X + 1, P14_Y)
+  const mesh = batirP14(g, t)
+  const d = mesh.geometry.userData.jupe
+  const n = d.bord.length
+  let voisins = 0
+  for (let bi = 0; bi < n; bi++) {
+    if (qLocal(localBord(mesh, d, bi)) > 1 - r) continue
+    const colle = qLocal(localBord(mesh, d, (bi - 1 + n) % n)) > 1 - r ||
+      qLocal(localBord(mesh, d, (bi + 1) % n)) > 1 - r
+    if (!colle) continue
+    voisins++
+    assert.ok(jupeEffacee(mesh, d, bi),
+      `sommet ${bi} : voisin d un sommet de frontière, son quad enjambe la face interne du mur`)
+  }
+  assert.ok(voisins >= 2, `le balayage doit trouver des voisins de frontière (${voisins})`)
+})
+
+test('P14 · UNE TUILE DU MILIEU ne perd AUCUNE jupe', () => {
+  const r = 2 * FRACTION_CHANFREIN
+  const g = globeP14({ retrait: r })
+  const t = tuileP14(P14_ZOOM, P14_X, P14_Y)
+  const mesh = batirP14(g, t)
+  const d = mesh.geometry.userData.jupe
+  assert.ok(g._rayonPlancherCrop(t) > 0)
+  for (let bi = 0; bi < d.bord.length; bi++) {
+    assert.ok(!jupeEffacee(mesh, d, bi), `sommet ${bi} : la tuile du milieu garde son service anti-fente`)
+  }
+})
+
+test('P14 · ⛔ UN ANCÊTRE GROSSIER GARDE TOUTE SA JUPE, et `tuileDansCrop` le dit DEDANS', () => {
+  // ⚠️ C est la faute que la borne latérale pouvait introduire, et elle est
+  // GRANDE : `tuileDansCrop` est un test d INTERSECTION DE BOÎTES, donc la tuile
+  // z2 qui CONTIENT l emprise du crop le passe. Sans la borne du dehors, tout le
+  // quadtree grossier perdrait sa jupe pour un mur à cinq cents demi-côtés de là.
+  const r = 2 * FRACTION_CHANFREIN
+  const g = globeP14({ retrait: r })
+  const t = tuileP14(2, Math.floor((P14_X + 0.5) / 2 ** 10), Math.floor((P14_Y + 0.5) / 2 ** 10))
+  const mesh = batirP14(g, t)
+  const d = mesh.geometry.userData.jupe
+  assert.ok(g._rayonPlancherCrop(t) > 0,
+    'si l ancêtre ne passait PAS `tuileDansCrop`, ce test ne mesurerait rien')
+  let loin = 0
+  for (let bi = 0; bi < d.bord.length; bi++) {
+    if (qLocal(localBord(mesh, d, bi)) > 10) loin++
+    assert.ok(!jupeEffacee(mesh, d, bi), `sommet ${bi} d un ancêtre z2 : jupe effacée à tort`)
+  }
+  assert.ok(loin > 50, `les sommets de l ancêtre doivent être TRÈS loin du crop (${loin})`)
+})
+
+test('P14 · ⛔ LA TUILE JUSTE DEHORS, QUI PARTAGE LA FRONTIÈRE, GARDE SA JUPE', () => {
+  // ⚠️ **C EST CE QUE LA GARDE `rPlancher > 0` PROTÈGE, ET RIEN D AUTRE NE LE
+  // FAIT.** La voisine immédiate du crop pose son côté ouest EXACTEMENT sur la
+  // frontière (`u = +1`), donc la bande de `jupeHorsDuMur` la désigne. Mais elle
+  // est DEHORS : aucun mur ne couvre sa jupe, qui pend sur la sphère. Sans le
+  // tri par `tuileDansCrop`, on lui retirerait son service anti-fente au bord
+  // même du bloc, là où le niveau de détail change.
+  const r = 2 * FRACTION_CHANFREIN
+  const g = globeP14({ retrait: r })
+  const dehors = tuileP14(P14_ZOOM, P14_X + 2, P14_Y)
+  assert.equal(g._rayonPlancherCrop(dehors), 0,
+    'la voisine doit être HORS du crop, sinon ce test ne mesure rien')
+  const mesh = batirP14(g, dehors)
+  const d = mesh.geometry.userData.jupe
+  let surLaFrontiere = 0
+  for (let bi = 0; bi < d.bord.length; bi++) {
+    if (jupeHorsDuMur(localBord(mesh, d, bi).u, localBord(mesh, d, bi).v, r)) surLaFrontiere++
+    assert.ok(!jupeEffacee(mesh, d, bi), `sommet ${bi} de la voisine DEHORS : jupe effacée à tort`)
+  }
+  assert.ok(surLaFrontiere >= 24,
+    `la voisine doit poser un côté SUR la frontière (${surLaFrontiere}) — sinon la garde n est pas exercée`)
+})
+
+test('P14 · le retrait NUL reproduit le dépôt AU BIT PRÈS, et l aller-retour aussi', () => {
+  // ⚡ L instrument de banc de la règle D13 : c est lui qui permet l A/B à témoin
+  // nul dans une seule page, et c est par lui que le balayage a été fait.
+  const g0 = globeP14({ retrait: 0 })
+  const t0 = tuileP14(P14_ZOOM, P14_X + 1, P14_Y)
+  const a = Float32Array.from(batirP14(g0, t0).geometry.attributes.position.array)
+
+  const g1 = globeP14({ retrait: 2 * FRACTION_CHANFREIN })
+  const t1 = tuileP14(P14_ZOOM, P14_X + 1, P14_Y)
+  const mesh1 = batirP14(g1, t1)
+  const b = mesh1.geometry.attributes.position.array
+  let bouges = 0
+  for (let k = 0; k < a.length; k++) if (!Object.is(a[k], b[k])) bouges++
+  assert.ok(bouges > 60, `le retrait doit DÉPLACER des sommets, il en bouge ${bouges}`)
+
+  // ⚠️ **DANS LES DEUX SENS** : on éteint la borne sur le MÊME maillage et on
+  // exige le tampon de départ, au bit près. C est ce qui prouve que la borne
+  // est bien branchée sur `_retraitJupeCrop` et sur rien d autre.
+  g1._retraitJupeCrop = 0
+  g1._retaillerJupe(t1)
+  const c = mesh1.geometry.attributes.position.array
+  for (let k = 0; k < a.length; k++) {
+    assert.ok(Object.is(a[k], c[k]), `sommet ${k} : l aller-retour ne rend pas le dépôt`)
+  }
+
+  // ⚠️ ET L IDEMPOTENCE SURVIT À L EFFACEMENT : deux passages, même tampon.
+  g1._retraitJupeCrop = 2 * FRACTION_CHANFREIN
+  g1._retaillerJupe(t1)
+  const d1 = Float32Array.from(mesh1.geometry.attributes.position.array)
+  g1._retaillerJupe(t1)
+  const d2 = mesh1.geometry.attributes.position.array
+  for (let k = 0; k < d1.length; k++) {
+    assert.ok(Object.is(d1[k], d2[k]), `sommet ${k} : la retaille n est plus idempotente`)
+  }
+})
+
+test('P14 · `construireParoisCrop` POSE le retrait, et dans la MONNAIE du demi-côté', () => {
+  // ⚠️ Une concordance au défaut n est pas un branchement : on BOUGE le
+  // chanfrein, dans les deux sens, et on exige que le retrait suive.
+  const tp = { z: 12, x: 2094, y: 2270, key: '12/2094/2270', size: 32 }
+  tp.heights = new Float32Array(32 * 32)
+  for (let j = 0; j < 32; j++) {
+    for (let i = 0; i < 32; i++) tp.heights[j * 32 + i] = 400 + 900 * Math.sin(i * 0.7) * Math.cos(j * 0.5)
+  }
+  const c = tileToLatLon(tp.x + 0.5, tp.y + 0.5, tp.z)
+  const rp = repereCrop({ centre: c, zoom: tp.z, tuilesParBloc: 1 })
+  const bati = (arg) => {
+    const faux = {
+      _crop: rp,
+      _fondCrop: null,
+      _parois: null,
+      _baseYCrop: null,
+      exaggeration: 2,
+      tiles: new Map([[tp.key, tp]]),
+      tuilesAvecHauteurs: () => [tp],
+      uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
+      group: { add() {}, remove() {} },
+      hauteurDessinee: Globe.prototype.hauteurDessinee,
+      _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
+      _retaillerJupes: () => 0,
+      retirerParoisCrop() { this._parois = null },
+      _materiauParois: () => null,
+    }
+    const r = Globe.prototype.construireParoisCrop.call(faux, { couvertureMin: 0, ...arg })
+    return { solide: r.solide, retrait: faux._retraitJupeCrop }
+  }
+  const d = bati({})
+  assert.ok(Math.abs(d.retrait - d.solide.chanfrein / (d.solide.largeur / 2)) < 1e-15,
+    'le retrait doit être le chanfrein, EN FRACTION DU DEMI-CÔTÉ')
+  assert.ok(Math.abs(d.retrait - 2 * FRACTION_CHANFREIN) < 1e-9,
+    `le retrait livré doit valoir 2 × ${FRACTION_CHANFREIN}, il vaut ${d.retrait}`)
+  // ⚡ ON BOUGE, DANS LES DEUX SENS
+  const gros = bati({ fractionChanfrein: FRACTION_CHANFREIN * 2 })
+  assert.ok(Math.abs(gros.retrait / d.retrait - 2) < 1e-9, `doublé : ${gros.retrait / d.retrait}`)
+  const vif = bati({ fractionChanfrein: 0 })
+  assert.equal(vif.retrait, 0, 'sans chanfrein, le mur ne rentre pas : rien à couper')
+  // et le retrait DISPARAÎT avec les parois
+  const faux2 = { _parois: {}, _retraitJupeCrop: 0.5, _retaillerJupes: () => 0, group: new THREE.Group() }
+  faux2._parois = { geometry: { dispose() {} }, material: { dispose() {} } }
+  faux2.group.remove = () => {}
+  Globe.prototype.retirerParoisCrop.call(faux2)
+  assert.equal(faux2._retraitJupeCrop, null, 'sans mur, plus rien n autorise à couper une jupe')
+})
diff --git a/test/globe-precision.test.js b/test/globe-precision.test.js
index 36a617a..0b405c5 100644
--- a/test/globe-precision.test.js
+++ b/test/globe-precision.test.js
@@ -531,20 +531,22 @@ test('P7 · `_retaillerJupe` est IDEMPOTENTE, et elle rend la jupe pleine quand
   assert.equal(g._retaillerJupes(), 1, 'une tuile sans jupe ne doit pas être comptée')
 })
 
 test('P7 · `poserParoisCrop` retaille, `retirerParoisCrop` rend — lecture de SOURCE', () => {
   // ⚠️ Garde-fou de SOURCE, DÉCLARÉ : les quatre tests ci-dessus prouvent le
   // comportement des méthodes ; celui-ci garde les DEUX appels qui les mettent
   // sur le chemin vivant, et la remise à nul du fond du bloc — le trou par
   // lequel un `_baseYCrop` périmé revenait.
   const s = fs.readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
   const corps = s.replace(/\/\/[^\n]*/g, '')
-  // ⚠️ **L'ORDRE, PAS L'ADJACENCE — corrigé à la Tâche P13.** La ligne
-  // `this._retraitBaseCrop = …` s'est intercalée entre les deux (le retrait de
-  // la base du bloc, que le rideau d'eau lit). Une assertion qui exigeait deux
-  // lignes COLLÉES aurait interdit toute écriture entre elles ; ce qu'elle
-  // garde, c'est que le fond soit posé AVANT que les jupes se retaillent.
-  assert.match(corps, /this\._baseYCrop = solide\.baseY[\s\S]{0,400}?this\._retaillerJupes\(\)/)
+  // ⚠️ **L'ORDRE, PAS L'ADJACENCE — corrigé à la Tâche P13, ÉLARGI À LA P14.**
+  // Trois lignes se sont intercalées entre les deux : `_retraitBaseCrop` (le
+  // rideau d'eau, P13), `_plancherJupeCrop` (la longueur de jupe, P13) et
+  // `_retraitJupeCrop` (le retrait LATÉRAL, P14). Une assertion qui exigeait
+  // deux lignes COLLÉES aurait interdit toute écriture entre elles, et une
+  // fenêtre trop serrée interdit la suivante ; ce qu'elle garde, c'est que le
+  // fond soit posé AVANT que les jupes se retaillent.
+  assert.match(corps, /this\._baseYCrop = solide\.baseY[\s\S]{0,900}?this\._retaillerJupes\(\)/)
   assert.match(corps, /this\._parois = null[\s\S]{0,600}?this\._baseYCrop = null[\s\S]{0,400}?this\._retaillerJupes\(\)/)
   assert.match(corps, /geo\.userData\.jupe = \{ nV, bord: border, rabattement: skirtDrop \}/)
   assert.match(corps, /this\._retaillerJupe\(t\)/)
 })
