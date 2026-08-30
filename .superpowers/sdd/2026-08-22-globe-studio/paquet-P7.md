6373339 tache P7 : les trois trous que la campagne de mutation a trouves sur la jupe
f7a2adb tache P7 : la jupe des tuiles etait dans la monnaie du globe, pas dans celle du bloc
dd5ab52 tache P7 : le rideau d eau du crop tournait a l envers — c etait le tablier de mer

 src/globe.js                 | 108 ++++++++++++++++++++-
 src/monde/mer-sphere.js      |  39 ++++++--
 src/monde/parois-crop.js     |  49 ++++++++++
 test/crop-parois.test.js     |  62 ++++++++++++
 test/ecume-mer.test.js       | 146 +++++++++++++++++++++++++++++
 test/fond-crop.test.js       |  10 ++
 test/globe-precision.test.js | 219 +++++++++++++++++++++++++++++++++++++++++++
 7 files changed, 626 insertions(+), 7 deletions(-)

diff --git a/src/globe.js b/src/globe.js
index 670821b..2e54664 100644
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
-import { construireSolideCrop } from './monde/parois-crop.js'
+import { construireSolideCrop, rabattementBorne } from './monde/parois-crop.js'
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
@@ -2155,20 +2155,25 @@ export class Globe {
     this.continu = params.globeContinu ?? false
     // LA FRONTIÈRE DE RENDU — Tâche 1b bis. Posé par `main.js` quand le globe
     // passe dans sa propre scène de fond ; voir `setVisible`, qui cesse alors
     // d'être l'interrupteur. Déclaré ici pour qu'il ne naisse pas `undefined`
     // au détour d'une lecture.
     this.frontiereFond = false
     // LE CROP — Tâche A. `null` = pas de découpe, et c'est l'état de production.
     // Écrit par `poserCrop`, lu par `_traverse` (le raffinement uniforme) ; la
     // découpe elle-même se fait au fragment, par les uniformes `uCrop*`.
     this._crop = null
+    // LE FOND DU BLOC — Tâche P4 pour le rideau d'eau, Tâche P7 pour la jupe des
+    // tuiles. Déclaré ici pour la raison écrite trois lignes plus haut : qu'il ne
+    // naisse pas `undefined` au détour d'une lecture. Écrit par `poserParoisCrop`,
+    // REMIS À NUL par `retirerParoisCrop`.
+    this._baseYCrop = null
     // LE CROP SEUL — Tâche N, « LE STUDIO SUR LE GLOBE ». `false` = le parcours
     // d'avant, au bit près, et c'est l'état de production. Écrit par
     // `poserCropSeul`, lu par `_traverse` et par lui seul.
     //
     // ⚠️ **CE N'EST PAS UN DOUBLON DE `uEstompage = 1`, ET C'EST TOUTE LA
     // TÂCHE.** L'estompage plein fait mourir le FRAGMENT hors crop ; la tuile,
     // elle, est quand même chargée, maillée et soumise au GPU. Mesuré dans
     // l'application vivante le 2026-08-22 (La Réunion, `?terre=unique`, altitude
     // de bloc 12 686 m, `uEstompage = 1`) : **351 tuiles dessinées, dont 315
     // entièrement hors du crop** — 89,7 % des appels de dessin ne montrent pas
@@ -4412,30 +4417,121 @@ export class Globe {
     M.decompose(mesh.position, mesh.quaternion, mesh.scale)
     this.group.add(mesh)
     this._parois = mesh
     // ⚠️ **LE FOND DU BLOC EST RETENU POUR LE RIDEAU D'EAU — Tâche P4.** Le
     // ruban de mer descend jusqu'à LUI, pas jusqu'à une profondeur à part : deux
     // fonds auraient laissé un jour ou un chevauchement sur tout le périmètre.
     // `MAILLONS` met `parois` AVANT `mer`, donc la valeur est là quand `poserMer`
     // la lit ; si les parois ont refusé, elle est nulle et le rideau n'est pas
     // bâti (dit dans `_merEtat.jupe`) plutôt que posé sur un fond deviné.
     this._baseYCrop = solide.baseY
+    // ⚠️ **ET LES JUPES DES TUILES SE RETAILLENT DESSUS — Tâche P7.** C'est ici
+    // et pas dans `_buildMesh` parce que l'ordre l'impose : les parois exigent
+    // des tuiles bâties (`couverture`), donc les tuiles du premier bloc sont
+    // toujours plus vieilles que son fond. `_retaillerJupe` est idempotente et
+    // recalcule depuis l'anneau de bord — la rappeler ne creuse rien.
+    this._retaillerJupes()
     return { mesh, solide, couverture: solide.couverture, refus: null }
   }
 
   /** Retire les parois — le crop redevient une peau flottante. */
   retirerParoisCrop() {
     if (!this._parois) return
     this.group.remove(this._parois)
     this._parois.geometry.dispose()
     this._parois.material.dispose()
     this._parois = null
+    // ⚠️ **ET LE FOND DU BLOC PART AVEC LUI — Tâche P7.** Il ne l'était pas :
+    // `_baseYCrop` survivait au retrait des parois, et deux lecteurs le
+    // consultent maintenant (`poserMer` pour le rideau, `_rayonPlancherCrop`
+    // pour la jupe des tuiles). Sans cette ligne, une tuile bâtie APRÈS le
+    // retrait du crop se serait fait tailler sa jupe sur un bloc qui n'existe
+    // plus. La garde de `poserMer` (`Number.isFinite(basY)`) devient donc vraie
+    // pour la même raison qu'elle a été écrite.
+    this._baseYCrop = null
+    // et les jupes reprennent leur pleine longueur : sans bloc, plus de plancher
+    this._retaillerJupes()
+  }
+
+  /**
+   * Le rayon du fond du bloc pour la jupe d'une tuile — `0` s'il n'y a pas de
+   * bloc, ou si la tuile ne le touche pas. Tâche P7.
+   *
+   * ⚠️ **DEUX GARDES, ET CHACUNE EMPÊCHE UNE FAUTE DIFFÉRENTE.**
+   *   ① `this._parois` : sans parois posées il n'y a **pas de plancher**, et
+   *      borner sur une valeur périmée raccourcirait la jupe de tout le globe.
+   *   ② `tuileDansCrop` : c'est un test d'INTERSECTION D'EMPRISES, le même que
+   *      celui du raffinement (`zoomCropPrescrit`). Sans lui, une tuile à
+   *      l'autre bout de la planète — dont le rayon vaut lui aussi ~100 — verrait
+   *      sa jupe bornée par un plancher qui n'a rien à voir avec elle.
+   *
+   * ⚠️ **`R_GLOBE + baseY`, ET C'EST LE RAYON DE L'ORIGINE LOCALE DU CROP** :
+   * `repereLocalCrop` place cette origine à `surSphere(centre, R_GLOBE)` et
+   * mesure `baseY` le long de la verticale de ce centre. L'écart entre ce rayon
+   * et le PLAN du fond est la flèche du crop — chiffrée dans `rabattementBorne`.
+   */
+  _rayonPlancherCrop(t) {
+    if (!this._parois || !this._crop || !Number.isFinite(this._baseYCrop)) return 0
+    if (!tuileDansCrop(t.z, t.x, t.y, this._crop)) return 0
+    return R_GLOBE + this._baseYCrop
+  }
+
+  /**
+   * Retaille la jupe d'UNE tuile sur le plancher du bloc courant — Tâche P7.
+   *
+   * ⚠️ **IDEMPOTENTE, ET C'EST LA PROPRIÉTÉ QUI LA REND SÛRE.** Elle recalcule
+   * chaque sommet de jupe **depuis son sommet de BORD**, jamais depuis sa
+   * position courante : l'appeler deux fois, ou l'appeler après un déplacement
+   * de bloc, ou l'appeler quand le bloc a disparu (le plancher rend alors `0`,
+   * donc la jupe pleine) rend exactement le même tampon. Une version qui
+   * rabattrait « encore un peu » à chaque passage creuserait à chaque image.
+   *
+   * @returns {boolean} vrai si une jupe a été retaillée
+   */
+  _retaillerJupe(t) {
+    const mesh = t?.mesh
+    const d = mesh?.geometry?.userData?.jupe
+    if (!d) return false
+    const rPlancher = this._rayonPlancherCrop(t)
+    const attr = mesh.geometry.attributes.position
+    const a = attr.array
+    const o = mesh.position
+    for (let bi = 0; bi < d.bord.length; bi++) {
+      const src = d.bord[bi]
+      const X = a[src * 3] + o.x
+      const Y = a[src * 3 + 1] + o.y
+      const Z = a[src * 3 + 2] + o.z
+      const rayon = Math.hypot(X, Y, Z)
+      const inv = 1 - rabattementBorne(d.rabattement, rayon, rPlancher) / rayon
+      const dst = d.nV + bi
+      a[dst * 3] = X * inv - o.x
+      a[dst * 3 + 1] = Y * inv - o.y
+      a[dst * 3 + 2] = Z * inv - o.z
+    }
+    attr.needsUpdate = true
+    mesh.geometry.computeBoundingSphere()
+    return true
+  }
+
+  /**
+   * Retaille les jupes de TOUTES les tuiles — appelée quand le fond du bloc
+   * change (parois posées) ou disparaît (parois retirées).
+   *
+   * ⚠️ **TOUTES, PAS SEULEMENT CELLES DU CROP.** Le tri est dans
+   * `_rayonPlancherCrop` (`tuileDansCrop`), et il doit l'être : une tuile qui
+   * SORT de l'emprise quand le bloc se déplace doit retrouver sa jupe pleine, et
+   * seule une passe qui la visite peut la lui rendre.
+   */
+  _retaillerJupes() {
+    let n = 0
+    for (const t of this.tiles.values()) if (this._retaillerJupe(t)) n++
+    return n
   }
 
   // La matière du bloc : la recette d'éclairage des calottes polaires, mot pour
   // mot (`_buildPoleCaps`) — même terminateur, même fondu vers `uShadowColor`.
   // ⚠️ UNE SEULE RECETTE, N LECTEURS : un mur éclairé autrement que la surface
   // qu'il porte se lirait comme un objet rapporté, et c'est exactement le défaut
   // qu'`Adrien` a signalé une fois sur le congé du socle (« la base du socle est
   // traitée comme un objet séparé »).
   // ⚠️ **`DoubleSide` EST VOULU, ET IL REND UN SOLIDE RETOURNÉ VISUELLEMENT
   // IDENTIQUE — IL FAUT DONC DIRE CE QUE L'INVARIANT D'ORIENTATION GARDE COMME
@@ -5175,27 +5271,37 @@ export class Globe {
       indices.push(a, a2, b, b, a2, b2)
     }
 
     const geo = new THREE.BufferGeometry()
     geo.setAttribute('position', new THREE.BufferAttribute(pos2, 3))
     geo.setAttribute('normal', new THREE.BufferAttribute(nrm2, 3))
     geo.setAttribute('uv', new THREE.BufferAttribute(uv2, 2))
     geo.setAttribute('latlon', new THREE.BufferAttribute(ll2, 2))
     geo.setIndex(indices)
     geo.computeBoundingSphere()
+    // ⚠️ **DE QUOI RETAILLER LA JUPE PLUS TARD — Tâche P7, ET L'ORDRE L'EXIGE.**
+    // Le fond du bloc n'existe qu'une fois les parois posées, et les parois
+    // exigent des tuiles bâties : quand `_buildMesh` tourne pour le premier
+    // bloc, `_baseYCrop` est encore nul. Borner ICI ne toucherait donc que les
+    // tuiles arrivées APRÈS, et le bloc d'ouverture garderait ses langues. On
+    // garde de quoi RECALCULER la jupe depuis son anneau de bord — jamais depuis
+    // sa position courante, pour que `_retaillerJupe` soit idempotente.
+    geo.userData.jupe = { nV, bord: border, rabattement: skirtDrop }
 
     const mesh = new THREE.Mesh(geo, this._materialFor(t.texture, t.size))
     mesh.position.copy(origine) // la position mondiale vit ICI, plus dans les sommets
     mesh.visible = false
     mesh.name = t.key
     t.mesh = mesh
     this.group.add(mesh)
+    // le bloc est peut-être DÉJÀ là (déplacement de fenêtre, tuile de remplacement)
+    this._retaillerJupe(t)
 
     // ⚠️ LES HAUTEURS SONT RELÂCHÉES ICI, ET C'EST LEUR DERNIER LECTEUR (plan
     // « globe continu », Tâche 4 sexies, Étape 1). `t.heights` est un
     // `Float32Array(256 × 256)` = 256 Kio par tuile, soit **105 Mo à 420 tuiles
     // en cache**. Le maillage vient de le consommer en entier ; le seul autre
     // lecteur du dépôt était `setExaggeration`, qui n'avait AUCUN appelant
     // (vérifié sur tout `src/` et `test/`).
     //
     // ⚠️ CE N'EST PAS UN CACHE QU'ON JETTE : c'est un tampon de construction
     // qu'on cessait de rendre. `setExaggeration` reste utilisable — il passe
diff --git a/src/monde/mer-sphere.js b/src/monde/mer-sphere.js
index 5b9b5f7..daa2a2e 100644
--- a/src/monde/mer-sphere.js
+++ b/src/monde/mer-sphere.js
@@ -635,30 +635,57 @@ export function construireJupeMer({
     const y = d[0] * haut[0] + d[1] * haut[1] + d[2] * haut[2]
     const z = d[0] * sud[0] + d[1] * sud[1] + d[2] * sud[2]
     positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z
     positions[(n + i) * 3] = x; positions[(n + i) * 3 + 1] = basY; positions[(n + i) * 3 + 2] = z
     uv[i * 2] = u; uv[i * 2 + 1] = v
     uv[(n + i) * 2] = u; uv[(n + i) * 2 + 1] = v
     jupe[i] = 0
     jupe[n + i] = 1
   }
 
-  // ⚠️ **`DoubleSide` N'EST PAS UNE OPTION ICI** : le rideau se regarde de
-  // l'extérieur, mais un crop vu de l'autre bord montre sa face interne. Le sens
-  // de parcours suit celui des parois (l'anneau est horaire vu du dessus, donc
-  // haut → bas → suivant sort vers le DEHORS).
+  // ⛔ **LE SENS DE PARCOURS ÉTAIT RETOURNÉ, ET C'EST LE TABLIER DE MER —
+  // Tâche P7, VU À L'ÉCRAN PUIS PROUVÉ EN LE BOUGEANT.** La Tâche P4 avait bâti
+  // ce ruban et écrit ici « le sens de parcours suit celui des parois » ; il ne
+  // le suivait pas. `construireSolideCrop` (`parois-crop.js` §④), sur le MÊME
+  // anneau, avec le MÊME agencement (0…n−1 en haut, n…2n−1 en bas), pose
+  // `(k, j, n+k)` puis `(j, n+j, n+k)` — et il le DÉMONTRE ligne à ligne, puis
+  // `auditerSolide` exige un volume signé POSITIF. Ces deux lignes-ci posaient
+  // `(i, n+i, j)` et `(j, n+i, n+j)`, c'est-à-dire **l'exact inverse** : les
+  // faces avant du rideau pointaient vers l'INTÉRIEUR du bloc.
+  //
+  // ⚠️ **ET LE MATÉRIAU DE LA CALOTTE EST EN `FrontSide`** (relevé sur la page
+  // vivante : `side = 0`, quand la jupe du socle est en `DoubleSide`). Sur
+  // chaque flanc TOURNÉ VERS LA CAMÉRA le rideau était donc **éliminé au
+  // culling**, et par le trou on voyait la lèvre nue du fond marin passer
+  // par-dessus l'arête haute de la paroi : le « tablier pâle à bord festonné »
+  // du noteur.
+  //
+  // ⚡ **A/B à témoin nul dans la même page, boucle gelée, La Réunion z12,
+  // cadrage côte de la notation-01 :** en retournant le ruban DANS LE TAMPON
+  // D'INDEX, le liséré de fond marin nu entre la nappe et l'arête haute tombe
+  // de **5 314 px à 186 px** sur les 210 colonnes où le socle, lui, amène son
+  // eau jusqu'à son mur (le socle en rend **441**) ; le rideau visible passe de
+  // **1 519 px à 6 642 px**. Retour au sens d'origine : **les trois chiffres
+  // reviennent au pixel.** (`.banc/P7/S5-ab-rideau-P7.json`.)
+  //
+  // ⚠️ **`DoubleSide` RENDRAIT LA MÊME IMAGE, ET N'EST PAS LA RÉPARATION.**
+  // Mesuré aussi : `side = DoubleSide` sur le sens fautif rend **exactement le
+  // même liséré (186 px)** — il ne fait que rattraper le culling. Le ruban est
+  // un anneau FERMÉ autour d'un bloc opaque : d'un point de vue extérieur, la
+  // moitié lointaine est de toute façon cachée par le bloc. On répare le sens,
+  // on ne paie pas la seconde face.
   const indices = new Uint32Array(n * 6)
   let m = 0
   for (let i = 0; i < n; i++) {
     const j = (i + 1) % n
-    indices[m++] = i; indices[m++] = n + i; indices[m++] = j
-    indices[m++] = j; indices[m++] = n + i; indices[m++] = n + j
+    indices[m++] = i; indices[m++] = j; indices[m++] = n + i
+    indices[m++] = j; indices[m++] = n + j; indices[m++] = n + i
   }
   return { positions, uv, jupe, indices, compte: { anneau: n, sommets: n * 2, triangles: n * 2 } }
 }
 
 /**
  * La couleur du rideau d'eau — **UNE SEULE ÉCRITURE, DEUX LECTEURS.**
  *
  * Ce sont les six lignes de `SKIRT_FRAG` (`ocean.js`), extraites plutôt que
  * recopiées : la calotte du crop en a besoin mot pour mot, et ce chantier a déjà
  * payé quatre fois une loi de mer écrite deux fois.
diff --git a/src/monde/parois-crop.js b/src/monde/parois-crop.js
index 8acd221..8d01d8b 100644
--- a/src/monde/parois-crop.js
+++ b/src/monde/parois-crop.js
@@ -246,20 +246,69 @@ const D2R = Math.PI / 180
  * qu'importée : ce module doit rester pur ». Et comme là-bas, **la recopie est
  * tenue par un test** qui la confronte à l'originale.
  */
 export function occlusionContact(y, baseY, bande, force = FORCE_AO) {
   if (!(bande > 0) || !(force > 0)) return 1
   const t = Math.max(0, Math.min(1, (y - baseY) / bande))
   const k = 1 - t
   return 1 - force * k * k
 }
 
+/**
+ * Le rabattement d'une jupe de tuile, BORNÉ PAR LE PLANCHER DU BLOC — Tâche P7.
+ *
+ * ⛔ **LE DÉFAUT, MESURÉ AVANT D'ÊTRE RÉPARÉ.** `globe.js` rabat le contour de
+ * chaque tuile vers le centre de la planète pour cacher les fentes entre niveaux
+ * de détail (`skirtDrop`, borné entre **0,1 et 0,9 unité de scène**). Ce
+ * rabattement est dans la monnaie du GLOBE ; le bloc du crop, lui, ne fait que
+ * **0,0507 à 0,0955 unité d'épaisseur** au relevé de La Réunion. **La jupe
+ * traverse donc le fond du bloc et pend dessous** — c'est le manque n° 5 du
+ * noteur, et c'est la même faute que la tavelure de P4, que le budget de fond de
+ * P5 et que la houle de P6 : *une valeur juste dans la mauvaise monnaie.*
+ *
+ * ⚡ **A/B à témoin nul dans la page vivante** (La Réunion z12, cadrage intérieur
+ * de la notation-01, boucle gelée) : en remontant les sommets de jupe au
+ * plancher DANS LE TAMPON DE POSITIONS, les pixels de tuile qui pendent sous
+ * l'arête basse de la paroi tombent de **2 186 px en 12 langues à 1 px en
+ * 1 langue** — le socle en rend **0**. Retour : **2 186 px et 12 langues,
+ * colonne pour colonne.** (`.banc/P7/S7-ab-jupes--21.115-P7.json`.)
+ * ⚠️ **Et les 2 186 px / 12 langues sont EXACTEMENT le relevé du noteur**
+ * (`F-jupes-N02.json`), aux douze colonnes près : la convention de mesure de ce
+ * banc et la sienne sont donc la même.
+ *
+ * ⚠️ **ON BORNE, ON NE SUPPRIME PAS.** Les deux sorties que le noteur nommait
+ * étaient « couper la jupe par sa hauteur » et « ne pas bâtir de jupe sur une
+ * tuile de frontière ». La seconde ne peut pas marcher : **les douze langues ne
+ * viennent PAS des tuiles de frontière** — mesuré, **168 tuiles sur 168** ont
+ * des sommets de jupe sous le plancher, y compris en plein milieu du bloc ; ce
+ * qu'on voit est ce qui dépasse de la SILHOUETTE. La première est celle-ci, et
+ * elle garde à la jupe toute la longueur que le bloc lui laisse — donc son
+ * service anti-fente à l'intérieur.
+ *
+ * ⚠️ **LE PLANCHER EST UN PLAN, ON LE BORNE PAR UNE SPHÈRE, ET L'ÉCART EST
+ * CHIFFRÉ.** Le fond du bloc est le plan `y = baseY` du repère local ; ce qu'on
+ * compare ici est un RAYON. Les deux se touchent au centre du crop et divergent
+ * de la flèche du crop — **3,68 m à La Réunion, soit 5,8·10⁻⁵ unité de scène,
+ * 0,06 % de l'épaisseur du bloc**, c'est-à-dire **six centièmes de pixel** au
+ * cadrage de ce banc. Dit plutôt que caché.
+ *
+ * @param {number} rabattement le `skirtDrop` du globe, en unités de scène
+ * @param {number} rayonSommet le rayon du sommet de BORD, depuis le centre
+ * @param {number} rayonPlancher le rayon du fond du bloc — `0` (ou non fini)
+ *   quand aucun bloc n'est posé : le rabattement est alors rendu TEL QUEL
+ * @returns {number} le rabattement à appliquer
+ */
+export function rabattementBorne(rabattement, rayonSommet, rayonPlancher) {
+  if (!(rayonPlancher > 0) || !(rayonSommet > 0)) return rabattement
+  return Math.min(rabattement, Math.max(0, rayonSommet - rayonPlancher))
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
index a9a4a07..c81bfd0 100644
--- a/test/crop-parois.test.js
+++ b/test/crop-parois.test.js
@@ -52,20 +52,21 @@
 import test from 'node:test'
 import assert from 'node:assert/strict'
 import { readFileSync } from 'node:fs'
 
 import {
   contourCrop,
   construireSolideCrop,
   occlusionContact,
   FRACTION_PROFONDEUR,
   PAS_CONTOUR,
+  rabattementBorne,
 } from '../src/monde/parois-crop.js'
 import { repereCrop, coinNormalise, latLonDeLocal, localCrop } from '../src/monde/crop-sphere.js'
 // ⚠️ ON APPELLE LES MÉTHODES DU GLOBE PAR `.call` SUR UN OBJET MINIMAL, patron
 // de `test/globe-precision.test.js` : monter un `Globe` réclamerait le DOM.
 import { Globe, sampleHeights } from '../src/globe.js'
 import { auditerSolide } from '../src/monde/audit-solide.js'
 import { dansDalle } from '../src/damier-bords.js'
 import { dansFenetre, exposantCoin } from '../src/fenetre-clip.js'
 import { ZOOM_SOCLE, LARGEUR_SOCLE_M } from '../src/monde/seuil-socle.js'
 import { contactAO, bandeContact, SOCLE_AO_BANDE, SOCLE_AO_FORCE } from '../src/plinth.js'
@@ -795,10 +796,71 @@ function margeOctogone(p) {
   const dx = (p.u * HALF) / r0
   const dz = (p.v * HALF) / r0
   let lo = r0, hi = 2 * HALF
   for (let i = 0; i < 200; i++) {
     const m = (lo + hi) / 2
     if (dansFenetre(m * dx, m * dz, HALF, CORNER, EXPO)) lo = m
     else hi = m
   }
   return (lo + hi) / 2 - r0
 }
+
+
+// ══════════ LE RABATTEMENT DES JUPES DE TUILE — Tâche P7 ════════════════════
+//
+// ⛔ **`skirtDrop` (`globe.js`) EST DANS LA MONNAIE DU GLOBE.** Entre 0,1 et
+// 0,9 unité de scène sur une planète de rayon 100 ; le bloc du crop, lui, fait
+// **0,0507 à 0,0955 unité d'épaisseur** au relevé de La Réunion. La jupe
+// traversait donc le fond du bloc et pendait dessous : **2 186 px en 12 langues**
+// contre **0** au socle, mesuré dans la page vivante (`.banc/P7/`).
+
+test('P7 · le rabattement est BORNÉ par le plancher, et par lui seul', () => {
+  // au-dessus du plancher, le rabattement passe entier
+  assert.equal(rabattementBorne(0.1, 100.5, 100.0), 0.1)
+  // sous le plancher, il s arrête dessus — au bit près
+  assert.equal(rabattementBorne(0.1, 100.05, 100.0), 100.05 - 100.0)
+  // pile au plancher : plus rien à rabattre, et surtout PAS un nombre négatif
+  assert.equal(rabattementBorne(0.1, 100.0, 100.0), 0)
+  assert.equal(rabattementBorne(0.1, 99.9, 100.0), 0)
+  // et jamais plus que ce que l appelant demande
+  assert.equal(rabattementBorne(0.02, 100.5, 100.0), 0.02)
+})
+
+test('P7 · SANS plancher, le rabattement est rendu TEL QUEL — le neutre est exact', () => {
+  // ⚠️ **C EST LE DÉFAUT DE TOUT LE GLOBE**, et il doit être exact au bit près :
+  // hors crop, `_rayonPlancherCrop` rend `0`, et rien ne doit bouger.
+  for (const rien of [0, -1, NaN, null, undefined]) {
+    assert.equal(rabattementBorne(0.37, 100.5, rien), 0.37, `plancher ${rien}`)
+  }
+  // un rayon de sommet absurde ne fabrique pas non plus une borne silencieuse
+  for (const rien of [0, -1, NaN]) {
+    assert.equal(rabattementBorne(0.37, rien, 100), 0.37, `rayon ${rien}`)
+  }
+})
+
+test('P7 · la borne est MONOTONE, et un plancher plus profond rend plus de jupe', () => {
+  // ⚠️ Une inversion `Math.min`/`Math.max` — la mutation la plus banale de ce
+  // dépôt — rendrait cette suite décroissante ou constante.
+  let precedent = -1
+  for (let d = 0; d <= 0.2; d += 0.01) {
+    const r = rabattementBorne(0.5, 100, 100 - d)
+    assert.ok(r >= precedent, `rabattement non croissant à ${d} : ${r} < ${precedent}`)
+    assert.ok(r <= 0.5, 'la borne ne doit jamais AJOUTER du rabattement')
+    precedent = r
+  }
+  assert.equal(rabattementBorne(0.5, 100, 100 - 0.2).toFixed(6), '0.200000')
+})
+
+test('P7 · `globe.js` APPELLE la borne, et il ne la réécrit pas', () => {
+  const g = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
+  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT DE COMPTER** — ceux de ligne ET
+  // ceux de bloc. La Tâche K ter a eu une mutation survivante parce qu une
+  // assertion lisait une formule dans un pavé de prose ; ici c est l inverse,
+  // un pavé de prose faisait compter une occurrence de trop.
+  const corps = g.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
+  assert.match(corps, /rabattementBorne\(d\.rabattement, rayon, rPlancher\)/)
+  assert.match(corps, /import \{ construireSolideCrop, rabattementBorne \}/)
+  // une seconde écriture de la loi — un `Math.min` sur le rabattement ailleurs —
+  // est exactement ce que ce chantier a payé quatre fois sur la mer.
+  const occurrences = (corps.match(/rabattementBorne/g) || []).length
+  assert.equal(occurrences, 2, 'la borne doit être IMPORTÉE une fois et APPELÉE une fois')
+})
diff --git a/test/ecume-mer.test.js b/test/ecume-mer.test.js
index 80aa5f3..1e020e6 100644
--- a/test/ecume-mer.test.js
+++ b/test/ecume-mer.test.js
@@ -64,20 +64,22 @@ import {
   GLINT_TAVELURE,
 } from '../src/monde/ecume-mer.js'
 import {
   construireJupeMer,
   GLSL_JUPE_MER,
   RETRAIT_EAU_CROP,
   bordDeMer,
   PORTEE_CROP,
 } from '../src/monde/mer-sphere.js'
 import { COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
+import { construireSolideCrop } from '../src/monde/parois-crop.js'
+import { auditerSolide } from '../src/monde/audit-solide.js'
 
 const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
 const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
 const SRC_MAIN = new URL('../src/main.js', import.meta.url)
 const ocean = () => readFileSync(SRC_OCEAN, 'utf8')
 const globe = () => readFileSync(SRC_GLOBE, 'utf8')
 
 /**
  * Le corps d'un `const NOM = /* glsl *\/ ` … `` de `globe.js`.
  * ⚠️ Les COMMENTAIRES sont retirés avant toute recherche de formule : la Tâche
@@ -517,20 +519,164 @@ test('⑤b le RETRAIT est celui de `plinth.js`, et il rentre DANS le crop', () =
   for (let i = 0; i < plein.uv.length; i += 2) {
     maxPlein = Math.max(maxPlein, Math.abs(plein.uv[i]), Math.abs(plein.uv[i + 1]))
     maxRentre = Math.max(maxRentre, Math.abs(rentre.uv[i]), Math.abs(rentre.uv[i + 1]))
   }
   assert.ok(Math.abs(maxPlein - 1) < 1e-6, `sans retrait le ruban doit toucher la frontière : ${maxPlein}`)
   assert.ok(Math.abs(maxRentre - (1 - RETRAIT_EAU_CROP)) < 1e-6, `avec retrait : ${maxRentre}`)
   // 0,22 unité de socle, exactement le chanfrein + la marge d'eau du mode plat
   assert.ok(Math.abs((1 - maxRentre) * (COTE_CROP_UNITES / 2) - 0.22) < 1e-4)
 })
 
+// ══════════ ⑤bis LE SENS DE PARCOURS DU RIDEAU — Tâche P7 ══════════════════
+//
+// ⛔ **LE DÉFAUT QUE CES QUATRE TESTS FERMENT.** La Tâche P4 a bâti le rideau
+// avec `(i, n+i, j)` / `(j, n+i, n+j)` en écrivant à côté « le sens de parcours
+// suit celui des parois » — c'était **l'exact inverse** du sens des parois, donc
+// des faces avant tournées vers l'INTÉRIEUR. Le matériau de la calotte étant en
+// `FrontSide` (relevé sur la page vivante : `side = 0`, quand la jupe du socle
+// est en `DoubleSide`), le rideau était **éliminé au culling sur chaque flanc
+// tourné vers la caméra**, et le fond marin nu passait par-dessus l'arête haute
+// de la paroi — le « tablier » du noteur.
+//
+// ⚠️ **AUCUN TEST NE REGARDAIT LE SENS**, et c'est pour ça que ça a tenu deux
+// tâches : ⑤a compte les triangles, ⑤b mesure le retrait, ⑤c les erreurs. Un
+// ruban retourné a exactement le même compte, le même retrait et les mêmes
+// erreurs.
+
+/** Le solide des parois sur le MÊME anneau — c'est lui, l'étalon de sens. */
+function solideCrop(basY = -0.12) {
+  return construireSolideCrop({
+    repere: REPERE,
+    rayon: 100,
+    forme: { coin: 0.08, expo: 4.4 },
+    echelle: 1,
+    hauteur: () => 0,
+    profondeur: Math.abs(basY),
+  })
+}
+
+test('⑤bis-a le rideau pose EXACTEMENT le même tableau d indices que les PAROIS', () => {
+  // ⚠️ **L ÉTALON N EST PAS UNE CONVENTION RECOPIÉE, C EST L AUTRE PIÈCE.**
+  // `construireSolideCrop` (`parois-crop.js` §④) DÉMONTRE son orientation ligne
+  // à ligne, et `test/crop-parois.test.js` l exige par volume signé. Les deux
+  // pièces tracent le même anneau (`contourCrop`, même pas, même forme) et
+  // rangent leurs sommets pareil (0…n−1 en haut, n…2n−1 en bas) : leurs
+  // triangles de mur DOIVENT donc être les mêmes entiers, dans le même ordre.
+  const j = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } })
+  const s = solideCrop()
+  const n = j.compte.anneau
+  assert.equal(s.compte.anneau, n, 'les deux anneaux doivent avoir la même longueur, sinon on ne compare rien')
+  const mur = Array.from(s.indices.subarray(0, n * 6))
+  const rideau = Array.from(j.indices)
+  assert.deepEqual(rideau, mur, 'le rideau et les parois ne tournent plus dans le même sens')
+})
+
+test('⑤bis-b chaque triangle du rideau regarde DEHORS — la normale, calculée', () => {
+  const j = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } })
+  const p = j.positions
+  const som = (k) => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]
+  let dedans = 0
+  let horizontales = 0
+  let minDot = Infinity
+  for (let t = 0; t < j.indices.length; t += 3) {
+    const A = som(j.indices[t]), B = som(j.indices[t + 1]), C = som(j.indices[t + 2])
+    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
+    const e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
+    // three.js : face AVANT = parcours anti-horaire vu de la face, donc
+    // e1 × e2 pointe vers l observateur de la face avant.
+    const N = [
+      e1[1] * e2[2] - e1[2] * e2[1],
+      e1[2] * e2[0] - e1[0] * e2[2],
+      e1[0] * e2[1] - e1[1] * e2[0],
+    ]
+    const L = Math.hypot(N[0], N[1], N[2])
+    assert.ok(L > 0, 'triangle dégénéré dans le rideau')
+    // la direction du DEHORS au barycentre : le rayon horizontal depuis l axe
+    // du crop (le contour est convexe et contient l origine, donc le radial
+    // suffit à trancher le signe).
+    const cx = (A[0] + B[0] + C[0]) / 3
+    const cz = (A[2] + B[2] + C[2]) / 3
+    const r = Math.hypot(cx, cz)
+    const dot = (N[0] * cx + N[2] * cz) / (L * r)
+    if (dot <= 0) dedans++
+    if (Math.abs(N[1] / L) < 1e-6) horizontales++
+    if (dot < minDot) minDot = dot
+  }
+  assert.equal(dedans, 0, `${dedans} triangles du rideau sur ${j.compte.triangles} regardent DEDANS`)
+  // ⚠️ **ET LE RUBAN EST VERTICAL** : sa normale n a pas de composante `y`. Sans
+  // cette seconde assertion, un ruban couché à plat passerait le signe.
+  assert.equal(horizontales, j.compte.triangles, 'la normale du rideau doit être horizontale')
+  // ⚠️ **0,7 ET PAS 0,9, ET LA RAISON EST GÉOMÉTRIQUE** : sur les quatre coins
+  // de la superellipse, le rayon depuis l axe et la normale sortante divergent —
+  // mesuré ici, le pire vaut **0,7321**, c est-à-dire 42,9°, un peu moins que les
+  // 45° du coin d un carré. Exiger 0,9 refuserait les coins ; le signe, lui, est
+  // exact partout (`dedans === 0`).
+  assert.ok(minDot > 0.7, `la normale la plus obliquement sortante fait ${minDot} avec le radial`)
+})
+
+test('⑤bis-c MUTATION — le ruban RETOURNÉ tombe sur le volume signé, pas sur la fermeture', () => {
+  // ⚠️ **LA DÉMONSTRATION DU §1 D `audit-solide.js`, REJOUÉE SUR LE RIDEAU** :
+  // on lui pose ses deux couvercles pour en faire une coque close, et on audite.
+  // Ā ne voit PAS un solide retourné ; seul le volume signé l attrape. C est
+  // exactement l instrument que `test/crop-parois.test.js` emploie sur les
+  // parois — on ne s en écrit pas un second.
+  const j = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } })
+  const n = j.compte.anneau
+  // sommets : le ruban, puis le centre BAS (2n) et le centre HAUT (2n+1)
+  const pos = new Float64Array((2 * n + 2) * 3)
+  pos.set(j.positions)
+  let hautMoyen = 0
+  for (let i = 0; i < n; i++) hautMoyen += j.positions[i * 3 + 1]
+  hautMoyen /= n
+  pos[2 * n * 3 + 1] = j.positions[n * 3 + 1] // le fond, plat
+  pos[(2 * n + 1) * 3 + 1] = hautMoyen
+  const capot = (indices) => {
+    const idx = new Uint32Array(indices.length + n * 6)
+    idx.set(indices)
+    let w = indices.length
+    for (let k = 0; k < n; k++) {
+      const q = (k + 1) % n
+      idx[w++] = 2 * n; idx[w++] = n + k; idx[w++] = n + q          // le fond
+      idx[w++] = 2 * n + 1; idx[w++] = q; idx[w++] = k              // le couvercle
+    }
+    return idx
+  }
+  const sain = auditerSolide({ geometrie: pos, indices: capot(j.indices), axeHauteur: 'y' })
+  assert.equal(sain.ferme, true, `non fermé : ‖Ā‖/aire = ${sain.fermetureRelative}`)
+  assert.equal(sain.oriente, true, `volume signé ${sain.volume} : le rideau est retourné`)
+  assert.equal(sain.sain, true, sain.raison)
+
+  // ⚠️ **ON RETOURNE LA COQUE ENTIÈRE, COUVERCLES COMPRIS.** Ne retourner que le
+  // ruban ouvrirait la fermeture, et le test tomberait alors sur ‖Ā‖ — c est-à-
+  // dire sur autre chose que ce qu il prétend prouver. (Essayé : `ferme` passe à
+  // `false`, et la démonstration s effondre.)
+  const envers = new Uint32Array(capot(j.indices))
+  for (let t = 0; t < envers.length; t += 3) { const x = envers[t + 1]; envers[t + 1] = envers[t + 2]; envers[t + 2] = x }
+  const retourne = auditerSolide({ geometrie: pos, indices: envers, axeHauteur: 'y' })
+  assert.equal(retourne.ferme, true, 'un ruban retourné reste FERMÉ — c est tout le piège')
+  assert.equal(retourne.oriente, false, 'le volume signé ne voit pas le ruban retourné : il ne mesure rien')
+})
+
+test('⑤bis-d la SOURCE ne porte plus le sens fautif, et la calotte garde le sien', () => {
+  // ⚠️ Garde-fou de SOURCE, DÉCLARÉ COMME TEL : les trois tests ci-dessus
+  // prouvent le comportement ; celui-ci empêche seulement le sens fautif de
+  // revenir par un copier-coller, et vérifie qu on n a pas retourné LA CALOTTE
+  // au passage — elle, elle regarde vers le HAUT, et son sens est justifié dans
+  // `construireCalotte`.
+  const s = readFileSync(new URL('../src/monde/mer-sphere.js', import.meta.url), 'utf8')
+  const corps = s.replace(/\/\/[^\n]*/g, '')
+  assert.ok(!/indices\[m\+\+\] = i; indices\[m\+\+\] = n \+ i; indices\[m\+\+\] = j/.test(corps),
+    'le sens fautif du rideau est revenu')
+  assert.match(corps, /indices\[m\+\+\] = i; indices\[m\+\+\] = j; indices\[m\+\+\] = n \+ i/)
+  assert.match(corps, /indices\[m\+\+\] = a; indices\[m\+\+\] = c; indices\[m\+\+\] = b/)
+})
+
 test('⑤c un `basY` absent est une ERREUR, pas un zéro silencieux', () => {
   // ⚠️ Le §7 de `parois-crop.js` en toutes lettres : un point inconnu posé à
   // zéro, c'est-à-dire au NIVEAU DE LA MER, creuse une encoche muette. Ici
   // ce serait un rideau de hauteur nulle sur tout le périmètre.
   assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 100 }), /basY/)
   assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 100, basY: NaN }), /basY/)
   assert.throws(() => construireJupeMer({ rayon: 100, basY: 0 }), /repere/)
   assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 0, basY: 0 }), /rayon/)
 })
 
diff --git a/test/fond-crop.test.js b/test/fond-crop.test.js
index 62facbc..3b8d5b7 100644
--- a/test/fond-crop.test.js
+++ b/test/fond-crop.test.js
@@ -200,20 +200,26 @@ function tuileDeTest(z, lat, lon, heights) {
     chord: latLonToSphere(nw.lat, nw.lon).distanceTo(latLonToSphere(se.lat, se.lon)),
   }
 }
 
 function construis(t, fond) {
   const faux = {
     exaggeration: EXAGERATION,
     group: new THREE.Group(),
     _materialFor: () => new THREE.MeshBasicMaterial(),
     _fondCrop: fond ?? null,
+    // les vraies méthodes de jupe (Tâche P7) : sans parois, plancher nul
+    _parois: null,
+    _crop: null,
+    _baseYCrop: null,
+    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
+    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
   }
   Globe.prototype._buildMesh.call(faux, t)
   return t.mesh
 }
 
 // le rayon MONDIAL d'un sommet : `_buildMesh` écrit du relatif, la position
 // mondiale vit dans `mesh.position` (RTC — `test/globe-precision.test.js`)
 function rayonDuSommet(mesh, s) {
   const p = mesh.geometry.attributes.position
   return new THREE.Vector3(p.getX(s), p.getY(s), p.getZ(s)).add(mesh.position).length()
@@ -421,20 +427,24 @@ function globeNu({ crop = null, fond = null, exageration = EXAGERATION } = {}) {
   return {
     uniforms: u,
     exaggeration: exageration,
     _crop: crop,
     _fondCrop: fond,
     _cleFondPosee: '',
     tiles: new Map(),
     group: new THREE.Group(),
     gardeHauteurs: new Set(),
     _materialFor: () => new THREE.MeshBasicMaterial(),
+    _parois: null,
+    _baseYCrop: null,
+    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
+    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
     _buildMesh(t) { return Globe.prototype._buildMesh.call(this, t) },
     _refaireMaillagesDuFond() { return Globe.prototype._refaireMaillagesDuFond.call(this) },
     _poserTextureFond(f) { return Globe.prototype._poserTextureFond.call(this, f) },
   }
 }
 
 const CENTRE_REUNION = { lat: -21.248422235627014, lon: 55.7666015625 }
 const REPERE_REUNION = repereCrop({ centre: CENTRE_REUNION, zoom: 12 })
 
 // un `remplir` de papier : il remplit `sortie` d'une profondeur constante et dit
diff --git a/test/globe-precision.test.js b/test/globe-precision.test.js
index 5819bd7..fa28d75 100644
--- a/test/globe-precision.test.js
+++ b/test/globe-precision.test.js
@@ -48,20 +48,22 @@ import assert from 'node:assert/strict'
 import * as THREE from 'three'
 import { Globe } from '../src/globe.js'
 import {
   R_GLOBE,
   EARTH_RADIUS_M,
   ORBITAL_M_PER_UNIT,
   latLonToTile,
   tileToLatLon,
   latLonToSphere,
 } from '../src/geo.js'
+import fs from 'node:fs'
+import { repereCrop } from '../src/monde/crop-sphere.js'
 
 // ---------------------------------------------------------------- outillage
 
 // Le pas représentable du float32 au voisinage de `valeur`, rendu en MÈTRES au
 // sol. On avance d'un motif binaire : c'est la définition, pas une estimation.
 const _tampon = new ArrayBuffer(4)
 const _f32 = new Float32Array(_tampon)
 const _u32 = new Uint32Array(_tampon)
 function pasRepresentableM(valeur) {
   _f32[0] = Math.fround(Math.abs(valeur))
@@ -109,20 +111,30 @@ function tuileDeTest(z, lat, lon, heights = HAUTEURS_PLATES) {
 }
 
 // On construit avec LA VRAIE MÉTHODE. Monter un `Globe` entier réclamerait le
 // DOM (rampe de couleurs, calottes, atmosphère, coquille de nuages) ; `.call`
 // sur un objet minimal exerce le code qu'on veut prouver, et lui seul.
 function construis(t) {
   const faux = {
     exaggeration: EXAGERATION,
     group: new THREE.Group(),
     _materialFor: () => new THREE.MeshBasicMaterial(),
+    // ⚠️ **LES VRAIES MÉTHODES DE JUPE — Tâche P7.** `_buildMesh` retaille sa
+    // jupe sur le fond du bloc en sortant ; sans parois ni crop, le plancher
+    // vaut 0 et la jupe garde sa pleine longueur. Poser ici les vraies méthodes
+    // plutôt que des bouchons, c'est EXERCER ce chemin neutre au lieu de le
+    // contourner — et c'est lui que ce fichier prouve « au bit près ».
+    _parois: null,
+    _crop: null,
+    _baseYCrop: null,
+    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
+    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
   }
   Globe.prototype._buildMesh.call(faux, t)
   return t.mesh
 }
 
 // La grille par tuile n'est pas exportée ; on la retrouve depuis le nombre de
 // sommets — (G+1)² pour la nappe, 4G pour la jupe — et on VÉRIFIE le compte.
 function grilleDe(mesh) {
   const total = mesh.geometry.attributes.position.count
   for (let G = 4; G <= 128; G++) if ((G + 1) ** 2 + 4 * G === total) return G
@@ -288,10 +300,217 @@ test('la jupe descend toujours vers le centre de la planète', () => {
   // premier sommet de jupe : la copie du coin nord-ouest, tirée vers le bas
   p.fromBufferAttribute(attr, nV).applyMatrix4(mesh.matrixWorld)
   const rJupe = p.length()
   p.fromBufferAttribute(attr, 0).applyMatrix4(mesh.matrixWorld)
   const rBord = p.length()
 
   assert.ok(rJupe < rBord, `la jupe (${rJupe.toFixed(4)}) ne descend pas sous le bord (${rBord.toFixed(4)})`)
   const chute = rBord - rJupe
   assert.ok(chute > 0.09 && chute < 0.91, `chute de jupe hors bornes : ${chute.toFixed(4)}`)
 })
+
+// ══════════ LA JUPE ET LE PLANCHER DU BLOC — Tâche P7 ═══════════════════════
+//
+// ⛔ **LE DÉFAUT.** Le rabattement de jupe (`skirtDrop`) vit dans la monnaie du
+// GLOBE — entre 0,1 et 0,9 unité de scène sur une planète de rayon 100. Le bloc
+// du crop, lui, fait **0,0507 à 0,0955 unité d'épaisseur** au relevé de La
+// Réunion : la jupe traversait son fond et pendait dessous. Mesuré dans la page
+// vivante, cadrage intérieur de la notation-01 : **2 186 px de tuile en
+// 12 langues** sous l'arête basse de la paroi, contre **0** au socle — et c'est
+// au pixel et à la colonne près le relevé du noteur (`F-jupes-N02.json`).
+//
+// ⚠️ **L'ORDRE EST LE PIÈGE, ET C'EST LUI QUE CES TESTS GARDENT.** Les parois
+// exigent des tuiles bâties, donc le fond du bloc naît APRÈS les tuiles :
+// borner dans `_buildMesh` seulement n'aurait rien changé au bloc d'ouverture.
+
+/** Un globe factice qui porte les VRAIES méthodes de jupe. */
+function globeFactice(crop = null, baseY = null, parois = null) {
+  return {
+    exaggeration: EXAGERATION,
+    group: new THREE.Group(),
+    tiles: new Map(),
+    _materialFor: () => new THREE.MeshBasicMaterial(),
+    _crop: crop,
+    _baseYCrop: baseY,
+    _parois: parois,
+    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
+    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
+    _retaillerJupes() { return Globe.prototype._retaillerJupes.call(this) },
+    _buildMesh(t) { return Globe.prototype._buildMesh.call(this, t) },
+  }
+}
+
+/** Le rayon mondial du sommet de jupe `bi`, et celui de son sommet de bord. */
+function rayonsJupe(mesh, bi = 0) {
+  mesh.updateMatrixWorld(true)
+  const G = grilleDe(mesh)
+  const nV = (G + 1) ** 2
+  const attr = mesh.geometry.attributes.position
+  const p = new THREE.Vector3()
+  p.fromBufferAttribute(attr, nV + bi).applyMatrix4(mesh.matrixWorld)
+  const jupe = p.length()
+  p.fromBufferAttribute(attr, mesh.geometry.userData.jupe.bord[bi]).applyMatrix4(mesh.matrixWorld)
+  return { jupe, bord: p.length() }
+}
+
+const CENTRE_P7 = { lat: 45.8326, lon: 6.8652 }
+const REPERE_P7 = repereCrop({ centre: CENTRE_P7, zoom: 11 })
+
+test('P7 · sans bloc, la jupe garde sa longueur AU BIT PRÈS — le défaut est neutre', () => {
+  const t1 = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
+  const t2 = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
+  const nu = globeFactice()
+  nu._buildMesh(t1)
+  // le même maillage, bâti par le chemin d'avant : rabattement plein, sans garde
+  const avecCrop = globeFactice(REPERE_P7, null, null) // un crop, mais AUCUNE paroi
+  avecCrop._buildMesh(t2)
+  const a = t1.mesh.geometry.attributes.position.array
+  const b = t2.mesh.geometry.attributes.position.array
+  assert.equal(a.length, b.length)
+  let differents = 0
+  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differents++
+  assert.equal(differents, 0, 'un crop SANS parois ne doit pas toucher un seul bit de jupe')
+  const r = rayonsJupe(t1.mesh)
+  const chute = r.bord - r.jupe
+  assert.ok(chute > 0.09 && chute < 0.91, `chute de jupe hors bornes : ${chute.toFixed(4)}`)
+
+  // ⚠️ **CHAQUE SOMMET DE JUPE EST SOUS LE SIEN, PAS SOUS UN AUTRE.** Sans cette
+  // assertion, une PERMUTATION des sommets de jupe (`dst = nV + bi + 1`) survit :
+  // elle est appliquée partout, donc tous les comptes, toutes les distances et
+  // même la comparaison « avant / après » restent d accord avec eux-mêmes.
+  // Trouvée par la campagne de mutation de P7 (survivante 4c).
+  const mesh = t1.mesh
+  mesh.updateMatrixWorld(true)
+  const G = grilleDe(mesh)
+  const nV = (G + 1) ** 2
+  const bord = mesh.geometry.userData.jupe.bord
+  const attr = mesh.geometry.attributes.position
+  const A = new THREE.Vector3()
+  const Bv = new THREE.Vector3()
+  let pireEcart = 0
+  for (let bi = 0; bi < bord.length; bi++) {
+    A.fromBufferAttribute(attr, bord[bi]).applyMatrix4(mesh.matrixWorld)
+    Bv.fromBufferAttribute(attr, nV + bi).applyMatrix4(mesh.matrixWorld)
+    // colinéaires depuis le CENTRE de la planète : le sinus de l angle entre les
+    // deux rayons doit être nul.
+    const sin = A.clone().cross(Bv).length() / (A.length() * Bv.length())
+    if (sin > pireEcart) pireEcart = sin
+  }
+  assert.ok(pireEcart < 1e-6, `un sommet de jupe n est pas sous SON sommet de bord : sinus ${pireEcart}`)
+})
+
+test('P7 · avec un bloc, la jupe s ARRÊTE au plancher, et pas un pouce plus bas', () => {
+  const t = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
+  // ⚠️ **LE PLANCHER EST DÉRIVÉ DU BORD MESURÉ, PAS POSÉ AU HASARD — ET C EST
+  // UNE LEÇON PAYÉE ICI MÊME.** Premier jet : `baseY = −0,05`. Le bord de cette
+  // tuile vit à **100,2825** (1 000 m d altitude × exagération 18), le
+  // rabattement plein vaut **0,1**, la marge valait donc **0,3325** : la borne
+  // ne mordait PAS et le test passait au vert sans rien garder. On pose donc le
+  // fond à **0,06 sous le bord**, c est-à-dire dans la plage où la loi agit.
+  const nu = globeFactice()
+  nu._buildMesh(t)
+  const rBord = rayonsJupe(t.mesh).bord
+  const MARGE = 0.06 // < le rabattement plein (0,1) : la borne doit mordre
+  const baseY = rBord - R_GLOBE - MARGE
+  const plancher = R_GLOBE + baseY
+
+  const t2 = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
+  const g = globeFactice(REPERE_P7, baseY, { faux: true })
+  g._buildMesh(t2)
+  const mesh = t2.mesh
+  const G = grilleDe(mesh)
+  const nV = (G + 1) ** 2
+  const bord = mesh.geometry.userData.jupe.bord
+  mesh.updateMatrixWorld(true)
+  const attr = mesh.geometry.attributes.position
+  const pt = new THREE.Vector3()
+  let sousLePlancher = 0
+  let touchent = 0
+  for (let bi = 0; bi < bord.length; bi++) {
+    pt.fromBufferAttribute(attr, nV + bi).applyMatrix4(mesh.matrixWorld)
+    const r = pt.length()
+    if (r < plancher - 1e-4) sousLePlancher++
+    if (Math.abs(r - plancher) < 1e-4) touchent++
+  }
+  assert.equal(sousLePlancher, 0, `${sousLePlancher} sommets de jupe passent SOUS le fond du bloc`)
+  assert.equal(touchent, bord.length, 'la jupe ne s arrête pas AU plancher : elle a été supprimée, ou pas bornée')
+})
+
+test('P7 · `_rayonPlancherCrop` a DEUX gardes, et chacune empêche une faute', () => {
+  const t = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
+  const baseY = -0.05
+  const attendu = R_GLOBE + baseY
+  assert.equal(globeFactice(REPERE_P7, baseY, { faux: true })._rayonPlancherCrop(t), attendu)
+  // ① sans parois posées, PAS de plancher — sinon un `_baseYCrop` périmé
+  //    raccourcirait la jupe de tout le globe
+  assert.equal(globeFactice(REPERE_P7, baseY, null)._rayonPlancherCrop(t), 0)
+  // ② une tuile HORS de l emprise du crop garde sa jupe : son rayon vaut lui
+  //    aussi ~100, elle passerait sans ce tri
+  const loin = tuileDeTest(11, -33.86, 151.21) // Sydney
+  assert.equal(globeFactice(REPERE_P7, baseY, { faux: true })._rayonPlancherCrop(loin), 0)
+  // ③ un `baseY` non fini n est pas un zéro silencieux
+  assert.equal(globeFactice(REPERE_P7, NaN, { faux: true })._rayonPlancherCrop(t), 0)
+  assert.equal(globeFactice(REPERE_P7, null, { faux: true })._rayonPlancherCrop(t), 0)
+})
+
+test('P7 · `_retaillerJupe` est IDEMPOTENTE, et elle rend la jupe pleine quand le bloc part', () => {
+  const t = tuileDeTest(11, CENTRE_P7.lat, CENTRE_P7.lon)
+  const g = globeFactice()
+  g._buildMesh(t)
+  const pleine = Float32Array.from(t.mesh.geometry.attributes.position.array)
+  const rBord = rayonsJupe(t.mesh).bord
+
+  // le bloc arrive APRÈS la tuile — l ordre réel, et c est TOUT le sujet
+  g._crop = REPERE_P7
+  g._baseYCrop = rBord - R_GLOBE - 0.06 // la borne mord — voir le test précédent
+  g._parois = { faux: true }
+  g.tiles.set(t.key, t)
+  // ⚠️ **LE TAMPON DOIT ÊTRE DÉCLARÉ SALE, SINON LE GPU GARDE L ANCIEN.** Une
+  // retaille qui écrit dans le tableau sans lever `needsUpdate` ne change RIEN à
+  // l écran, et aucune comparaison de tampon ne peut le voir : `version` est le
+  // seul témoin. Trouvée par la campagne de mutation de P7 (survivante 4d).
+  const versionAvant = t.mesh.geometry.attributes.position.version
+  assert.equal(g._retaillerJupes(), 1)
+  assert.ok(t.mesh.geometry.attributes.position.version > versionAvant,
+    'la retaille n a pas levé `needsUpdate` : le GPU garde la jupe d avant')
+  const borne = Float32Array.from(t.mesh.geometry.attributes.position.array)
+  let bouges = 0
+  for (let i = 0; i < pleine.length; i++) if (pleine[i] !== borne[i]) bouges++
+  assert.ok(bouges > 0, 'la retaille n a bougé AUCUN sommet : elle ne fait rien')
+
+  // ⚠️ IDEMPOTENTE : rappelée, elle rend le MÊME tampon. Une version qui
+  // rabattrait depuis la position COURANTE creuserait à chaque appel.
+  g._retaillerJupes()
+  g._retaillerJupes()
+  const encore = t.mesh.geometry.attributes.position.array
+  for (let i = 0; i < borne.length; i++) assert.equal(encore[i], borne[i], `sommet ${i} a bougé au second appel`)
+
+  // le bloc part : la jupe reprend sa pleine longueur, AU BIT PRÈS
+  g._parois = null
+  g._baseYCrop = null
+  g._retaillerJupes()
+  const rendue = t.mesh.geometry.attributes.position.array
+  for (let i = 0; i < pleine.length; i++) assert.equal(rendue[i], pleine[i], `sommet ${i} n est pas revenu`)
+
+  // ⚠️ **UNE TUILE SANS JUPE N EST PAS UNE TUILE RETAILLÉE.** Le compte que rend
+  // `_retaillerJupes` est ce qui dit combien de jupes ont bougé ; le rendre vrai
+  // pour un maillage sans `userData.jupe` en ferait un compte de TUILES.
+  // Trouvée par la campagne de mutation de P7 (survivante 4e).
+  assert.equal(g._retaillerJupe({ mesh: null }), false)
+  assert.equal(g._retaillerJupe({ mesh: { geometry: { userData: {} } } }), false)
+  assert.equal(g._retaillerJupe(undefined), false)
+  g.tiles.set('sans-jupe', { mesh: { geometry: { userData: {} } } })
+  assert.equal(g._retaillerJupes(), 1, 'une tuile sans jupe ne doit pas être comptée')
+})
+
+test('P7 · `poserParoisCrop` retaille, `retirerParoisCrop` rend — lecture de SOURCE', () => {
+  // ⚠️ Garde-fou de SOURCE, DÉCLARÉ : les quatre tests ci-dessus prouvent le
+  // comportement des méthodes ; celui-ci garde les DEUX appels qui les mettent
+  // sur le chemin vivant, et la remise à nul du fond du bloc — le trou par
+  // lequel un `_baseYCrop` périmé revenait.
+  const s = fs.readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
+  const corps = s.replace(/\/\/[^\n]*/g, '')
+  assert.match(corps, /this\._baseYCrop = solide\.baseY\s*\n\s*this\._retaillerJupes\(\)/)
+  assert.match(corps, /this\._parois = null\s*\n\s*this\._baseYCrop = null\s*\n\s*this\._retaillerJupes\(\)/)
+  assert.match(corps, /geo\.userData\.jupe = \{ nV, bord: border, rabattement: skirtDrop \}/)
+  assert.match(corps, /this\._retaillerJupe\(t\)/)
+})
