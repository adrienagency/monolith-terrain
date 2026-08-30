4a182a3 tache P5 : les tests du fond marin et de l etat de mer, plus la poignee des uniformes rendue
61de597 tache P5 : le fond marin du crop prend la palette et le budget du bloc, et l etat de mer du socle

 src/globe.js            | 145 ++++++++++++++++----
 src/main.js             |  35 ++++-
 src/monde/ecume-mer.js  |  67 ++++++++++
 src/monde/mer-sphere.js |  92 +++++++++++++
 src/ocean.js            |  10 +-
 test/ecume-mer.test.js  | 118 ++++++++++++++++-
 test/mer-sphere.test.js | 341 +++++++++++++++++++++++++++++++++++++++++++++++-
 7 files changed, 769 insertions(+), 39 deletions(-)

diff --git a/src/globe.js b/src/globe.js
index c71c672..19f6336 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -59,20 +59,27 @@ import {
   RAMPE_NAUTIQUE,
   epsilonMerDuCrop,
   budgetProfondeurM,
   echelleHouleM,
   seuilTraitEauM,
   empriseCalotte,
   porteeHorizon,
   PORTEE_DEFAUT,
   construireJupeMer,
   GLSL_JUPE_MER,
+  // ⚠️ **TÂCHE P5 — LES DEUX ENTRÉES DU FOND MARIN QUE PERSONNE NE POSAIT.**
+  // `couleursFondDuSocle` LIT la palette vivante du socle (la calotte gelait le
+  // défaut de `terrain.js`) ; `profondeurMaxDuCrop` mesure le budget sur le
+  // CROP et non sur la calotte (×1,658 à La Réunion). Les deux en-têtes portent
+  // les relevés bruts.
+  couleursFondDuSocle,
+  profondeurMaxDuCrop,
 } from './monde/mer-sphere.js'
 // ⚠️ **LE FOV CANONIQUE, PAS UNE CONSTANTE RECOPIÉE.** Tour de correction 1 de
 // la Tâche F : le défaut de `poserMer` portait `33`, une valeur qui n'existe
 // nulle part ailleurs dans le dépôt. `FOV_DEG` est LA source du DÉFAUT — la
 // ligne `fov: 30` des réglages de `main.js` (⚠️ **PAS `main.js:263`, qui parle du
 // maillage du bloc central : citation fausse dans le commentaire même qui
 // réparait une source fausse, corrigée le 2026-08-21 par la Tâche I**), et c'est
 // elle qui alimente `SEUIL_NAISSANCE_M` (32 274 m), le chiffre auquel la bascule
 // de la mer se compare.
 // ⚠️ **ET CE N'EST QU'UN DÉFAUT.** Relevé sur l'application VIVANTE le
@@ -121,21 +128,21 @@ import {
   irradianceAmbiante,
 } from './monde/eclairage-crop.js'
 // ══════════ L'ÉCUME DE LA MER — Tâche P4 ═══════════════════════════════════
 //
 // > **Le noteur, 2026-08-22 :** « l'écume est 7,7 fois trop étendue — et elle
 // > est en PLAQUES. »
 //
 // Même patron encore : la loi vit une seule fois dans un module PUR, `ocean.js`
 // et ce fichier injectent le MÊME texte. L'en-tête d'`ecume-mer.js` nomme les
 // quatre entrées qui manquaient et donne leur mesure.
-import { GLSL_ECUME, FREQ_TAVELURE, BLANC_ECUME, ACCALMIE_NEUTRE } from './monde/ecume-mer.js'
+import { GLSL_ECUME, FREQ_TAVELURE, BLANC_ECUME, ACCALMIE_NEUTRE, ETAT_MER_NEUTRE } from './monde/ecume-mer.js'
 import {
   DEM_SOURCES,
   DemSourceError,
   activeDemSource,
   fallbackToAws,
   peekRegionMaxZoom,
   regionKey,
   resolveRegionMaxZoom,
 } from './dem-source.js'
 
@@ -167,20 +174,25 @@ uniform float uMerChop;
 uniform float uMerVitesse;
 uniform float uMerLambda;  // unités LOCALES par mètre de spectre
 uniform float uMerPortee;
 uniform float uMerDebut;   // début de la bande de dégradation, en unités de scène
 uniform float uMerFin;     // fin de la bande : au-delà, on ne calcule PLUS RIEN
 uniform sampler2D uMerChamp; // R : altitude du fond (unités locales), G : rivage
 // ⚠️ UNITÉS DE SCÈNE PAR UNITÉ DE SOCLE — Tâche P4. C'est le facteur qui rend
 // la profondeur du crop comparable à celle du socle, la SEULE monnaie dans
 // laquelle le déclin côtier d'ocean.js a un sens. Un seul écrivain : poserMer.
 uniform float uMerUnite;
+// ⚠️ L ACCALMIE DE VUE, ET ELLE SERT DES DEUX COTES — Tache P5. Le fragment la
+// lit deja pour l ecume (Tache P4) ; le vertex en a besoin pour la HOULE, parce
+// qu ocean.js multiplie son amplitude par uViewCalm avant d appeler Gerstner.
+// C est le MEME uniforme, pas un second : un seul ecrivain, majReglagesMer.
+uniform float uMerCalmeVue;
 __GERSTNER__
 __SHORE_SURF__
 ${GLSL_ECUME}
 varying vec2 vCrop;
 varying vec2 vLocal;
 varying float vProfondeur;
 // ⚠️ CE N EST PLUS LA DISTANCE BRUTE, ET LE NOM LE DIT — Tache P4. Elle portait
 // champ.g tel quel pendant que les seuils qui la lisent (0,002 / 0,03 / 0,10 /
 // 0,75) sont ceux d ocean.js, cales sur vFade, c est-a-dire sur le declin
 // FONDU. C etait ca, l ecume 7,7 fois trop etendue. (Aucun accent grave ni
@@ -242,21 +254,29 @@ void main() {
   // le fragment : deux rampes sur la MEME grandeur, pas l une sur l autre.
   float fade = fonduHouleMer(declin) * richesseMer;
   vec3 nAcc = vec3(0.0);
   float crete = 0.0;
   // ⚠️ ON PASSE uMerLambda EN lenScale, ET LES COORDONNÉES TELLES QUELLES —
   // exactement comme ocean.js. La premiere ecriture divisait xz par lambda et
   // passait lenScale = 1,0 : le deplacement sortait alors en METRES DE SPECTRE
   // pendant que le critere de deferlement ci-dessous compare a une profondeur en
   // UNITES DE SCENE. Deux unites dans la meme soustraction, et rien ne l'aurait
   // dit. (Aucun accent grave dans ce bloc : template literal.)
-  vec3 disp = oceanGerstner(vec2(p.x, p.z), uMerTemps, uMerHoule, uMerChop, uMerVitesse, uMerLambda, fade, nAcc, crete);
+  // ⚠️ LA HOULE PORTE L ACCALMIE DE VUE, ET C EST L EXPRESSION D ocean.js —
+  // Tache P5. La-bas : oceanGerstner(xz, t, uWaveH * uViewCalm, ...) au vertex,
+  // et shoreSurf recoit uWaveH BRUT. Ici uMerCalmeVue EST uViewCalm, pose par
+  // majReglagesMer depuis l uniforme vivant du socle. Sans ce facteur, brancher
+  // uMerHoule sur uWaveH aurait rendu une houle 2,5 fois trop haute (uWaveH = 2,
+  // uViewCalm = 0,4039 releves le meme instant). ⚠️ Le NEUTRE de l accalmie vaut
+  // 1 (ACCALMIE_NEUTRE), donc sans socle a lire ce facteur ne change rien.
+  // (Aucun accent grave ni apostrophe dans ce bloc : template literal.)
+  vec3 disp = oceanGerstner(vec2(p.x, p.z), uMerTemps, uMerHoule * uMerCalmeVue, uMerChop, uMerVitesse, uMerLambda, fade, nAcc, crete);
   float creteS = 0.0;
   vec3 surf = shoreSurf(uvF, uMerChamp, uMerTemps, uMerHoule, uMerChop, uMerVitesse, uMerLambda, richesseMer, creteS);
   disp.y += surf.x;
   nAcc.x += surf.y;
   nAcc.z += surf.z;
   crete = max(crete, creteS);
 
   // ---- CRITÈRE DE DÉFERLEMENT, porté de ocean.js : une vague ne dépasse pas
   // 0,78 fois sa profondeur. Limite DOUCE, pas un écrêtage : cap(1 − e^(−a/cap))
   // vaut a en eau profonde et tend vers cap en eau basse.
@@ -3376,25 +3396,35 @@ export class Globe {
     portee = null,
     couvertureMin = 0,
     exigerBathy = false,
     pas = 192,
     hauteurPx = 900,
     fovDeg = FOV_DEG,
     largeurBande = 4,
     altitudeM = 32274,
     couleurs = null,
     graine = 0,
-    couleursFond = null,
-    houle = 0.5,
-    chop = 0.7,
-    ecumeEchelle = 0.35,
   } = {}) {
+    // ⛔ **`couleursFond`, `houle`, `chop` ET `ecumeEchelle` NE SONT PLUS DES
+    // PARAMÈTRES — Tâche P5.** Ils l'étaient depuis les Tâches F et M, et
+    // **aucun appelant ne les a jamais passés** : le fond marin et l'état de mer
+    // du crop vivaient donc sur les défauts de ce module pendant que le socle
+    // vivait sur sa palette et sur les curseurs de l'utilisateur. Deux
+    // écrivains pour une grandeur, dont un muet, c'est la faute que D13 §③
+    // nomme ; la mer prend désormais ses six réglages et ses trois couleurs de
+    // fond par `majReglagesMer`, **par image, depuis les uniformes VIVANTS du
+    // socle** — le maillon que la Tâche P4 a posé pour les deux accalmies.
+    // `ETAT_MER_NEUTRE` porte les valeurs d'avant, au bit près.
+    const etat = ETAT_MER_NEUTRE
+    const houle = etat.houle
+    const chop = etat.chop
+    const ecumeEchelle = etat.ecumeEchelle
     if (!this._crop) return null
     const rep = this._crop
     const exag = this.exaggeration
     const echelle = (R_GLOBE / EARTH_RADIUS_M) * exag
     // la portée : l'HORIZON GÉOMÉTRIQUE, pas une constante (§5 de
     // /threejs-optimisation — un seuil d'horizon en dur y vaut une calotte
     // jusqu'à mille fois trop large ; ici l'erreur laisserait un TROU).
     const p = Number.isFinite(portee) && portee > 0
       ? portee
       : Math.min(PORTEE_DEFAUT, Math.max(1, porteeHorizon(rep, altitudeM, EARTH_RADIUS_M)))
@@ -3531,30 +3561,35 @@ export class Globe {
         uWaveB: { value: spectre.b },
         // ⚠️ LE BUDGET, PAS LA PROFONDEUR RÉELLE — voir `budgetProfondeurM`.
         // Posé sur le maximum du champ (4 310 m), le glacis de lagon couvrait
         // tout ce qui est sous 646 m et peignait la côte en cyan pâle.
         uMerProfMax: { value: budgetProfondeurM(rep, exag) * echelle },
         // ⚠️ CONVERTI, PAS RECOPIÉ — voir `seuilTraitEauM` : `0,02` unité de socle
         // vaudrait 455 m d'eau ici, et toute la côte serait semi-transparente.
         uMerSeuilEau: { value: seuilTraitEauM(rep, exag) * echelle },
         uMerPeu: { value: cols.shallowT },
         uMerFond: { value: cols.deep },
-        // ⚠️ `chopLook` d'`ocean.js`, transcrit : écume quadratique, brillance
-        // décroissante. Mer d'huile à 0, mer agitée généreuse.
-        uMerEcume: { value: 1.9 * chop * chop },
-        // ⚠️ LE FACTEUR D'ÉCHELLE D'ÉCUME D'`ocean.js`, QUI MANQUAIT. Là-bas il
-        // vaut `smooth01((waveScale − 0,12)/0,2)` et il éteint l'écume des vues
-        // continentales ; ici la calotte couvre déjà 164 km, donc il est posé à
-        // sa valeur de vue LARGE. Sans lui, la côte vue de 7,6 km était une masse
-        // blanche trouée de bleu — relevé à l'écran, `.banc/vues/M-mer-seule-cote.jpg`.
+        // ⛔ **PLUS DE TRANSCRIPTION DE `chopLook` ICI — Tâche P5.** Ces deux
+        // lignes portaient `1.9 * chop * chop` et `240 - 130 * chop`, c'est-à-dire
+        // une SECONDE écriture d'une loi qui vit dans `ocean.js` — et le panneau
+        // « Effets » peut y écrire autre chose. Les deux valeurs arrivent
+        // désormais par `majReglagesMer`, LUES sur `uFoam` et `uGloss` ; ce qui
+        // est posé ici n'est plus que le NEUTRE, c'est-à-dire `chopLook(0,7)`,
+        // la mer d'avant cette tâche au bit près.
+        uMerEcume: { value: etat.ecume },
+        // ⚠️ LE FACTEUR D'ÉCHELLE D'ÉCUME D'`ocean.js`. Là-bas il vaut
+        // `smooth01((waveScale − 0,12)/0,2)` — relevé à **1** sur la page vivante
+        // — et il éteint l'écume des vues continentales. Il arrive maintenant par
+        // `majReglagesMer` ; le `0,35` du neutre était la valeur posée à la main
+        // par la Tâche M, et c'est un des six écarts que P4 avait relevés.
         uMerEcumeEchelle: { value: ecumeEchelle },
-        uMerBrillance: { value: 240 - 130 * chop },
+        uMerBrillance: { value: etat.brillance },
         uCropCoin: u.uCropCoin,
         uCropCoinN: u.uCropCoinN,
         // ⚠️ **PROPRE À LA MER, PAS PARTAGÉ** : les deux bornes sont exprimées
         // dans la mesure de la découpe, mais leur AMPLITUDE dépend de `portee`,
         // qui est une grandeur de la calotte. Posé juste après, par
         // `_majBordMer` — un seul écrivain, celui que `poserEstompage` rappelle.
         uMerBord: { value: new THREE.Vector2(0, 1) },
       },
       vertexShader: MER_VERT
         .replace('__GERSTNER__', mod.GERSTNER_GLSL)
@@ -3572,33 +3607,38 @@ export class Globe {
     // Relevé sur la descente de La Réunion (`.banc/vues-Kbis/AV-descente.json`) :
     // 6 000 → 6 228 → 6 028 → 6 028 → **4 415,2 m**. Sur `dMer01`, qui indexe la
     // rampe nautique, cela déplace la couleur d'une profondeur donnée de
     // **0,248** au maximum — plus que tout le reste de la mer réuni. Le laisser
     // hors de la courbe aurait laissé le turquoise d'Adrien intact.
     //
     // ⚠️ **ET IL EST ANCRÉ SOUS LA MÊME ALTITUDE QUE LA RAMPE**, pas sous une
     // seconde : `poserMer` et `poserRampe` reçoivent tous deux `altitudeM` du
     // MÊME `contexteCrop`, et deux crans qui divergeraient rouvriraient le
     // désaccord que la Tâche J bis a fermé (`LECTEURS_DU_FOND`).
+    //
+    // ⛔ **ET IL SE MESURE SUR LE CROP, PLUS SUR LA CALOTTE — Tâche P5.** Le
+    // socle pose `uSeaRange = −dem.minM`, mesuré sur SON BLOC ; on prenait
+    // `champ.profMaxM`, mesuré sur une calotte trois fois plus large.
+    // **3 510,49 m contre 2 116 m** au même instant, et le segment clair de la
+    // rampe passait de 19,82 % à **38,89 %** des nœuds d'eau du crop : la frange
+    // pâle en doublait de largeur. ⚠️ **Le repli reste `profMaxM`** — un crop
+    // dont le champ n'aurait aucune eau à l'intérieur (lagune hors frontière,
+    // banc) rendrait sinon un budget nul, donc une mer d'un seul bleu.
+    const budgetFond = Math.max(champ.profMaxCropM || champ.profMaxM, 1)
     ancrerMesure(this._echelleContinue, altitudeM, {
-      fondBudget: Math.max(champ.profMaxM, 1),
+      fondBudget: budgetFond,
       plancherM: u.uPlancherRampeM.value,
     })
     const _v = majEchelle(this._echelleContinue, altitudeM)
     u.uMerFondBudgetM.value = Number.isFinite(_v?.fondBudget)
       ? Math.max(_v.fondBudget, 1)
-      : Math.max(champ.profMaxM, 1)
-    if (couleursFond) {
-      u.uOceanShallow.value.set(couleursFond.peu ?? RAMPE_NAUTIQUE.peu)
-      u.uOceanMid.value.set(couleursFond.moyen ?? RAMPE_NAUTIQUE.moyen)
-      u.uOceanDeep.value.set(couleursFond.fond ?? RAMPE_NAUTIQUE.fond)
-    }
+      : budgetFond
     const mesh = new THREE.Mesh(geo, mat)
     mesh.name = 'crop-mer'
     mesh.frustumCulled = false // les vagues la déplacent, et elle est immense
     mesh.renderOrder = 18 // le même que la mer du socle
     const M = new THREE.Matrix4().makeBasis(
       new THREE.Vector3(cal.base.est[0], cal.base.est[1], cal.base.est[2]),
       new THREE.Vector3(cal.base.haut[0], cal.base.haut[1], cal.base.haut[2]),
       new THREE.Vector3(cal.base.sud[0], cal.base.sud[1], cal.base.sud[2])
     )
     M.setPosition(cal.origine[0], cal.origine[1], cal.origine[2])
@@ -3722,20 +3762,27 @@ export class Globe {
     tex.magFilter = THREE.LinearFilter
     tex.minFilter = THREE.LinearFilter
     tex.needsUpdate = true
     return {
       texture: tex,
       couverture,
       bathy,
       unite,
       profMaxUnites: Math.max(profMaxM * echelle, 1e-6),
       profMaxM,
+      // ⚠️ **LA PROFONDEUR DU CROP, PAS CELLE DE LA CALOTTE — Tâche P5.** Le
+      // socle normalise sa rampe nautique sur l'amplitude de SON BLOC
+      // (`uSeaRange = −dem.minM`) ; `poserMer` prenait `profMaxM`, mesuré sur
+      // une calotte trois fois plus large. **3 510,49 m contre 2 116 m** à La
+      // Réunion, et la frange pâle en doublait de largeur. L'en-tête de
+      // `profondeurMaxDuCrop` porte les deux relevés.
+      profMaxCropM: profondeurMaxDuCrop(brut, cote, portee),
     }
   }
 
   // ═══════════ LE FOND DU CROP — Tâche J bis ════════════════════════════════
   //
   // **Ce que ce maillon ferme, et il a été établi PAR ÉLIMINATION, pas supposé**
   // (Tâche J, §6) : « le champ de la mer a un fond ; la SURFACE du crop n'en a
   // pas ». Les chiffres sont dans l'en-tête de `src/monde/fond-crop.js` et leurs
   // relevés bruts sur le disque (`.banc/vues-Jbis/Jbis-releves-bruts.json`) :
   // **920,7 m d'écart moyen**, **2 116,27 m au maximum**, contre **73 m** de
@@ -3892,34 +3939,82 @@ export class Globe {
    * **1**. Trente et une fois.
    *
    * ⚠️ **UN ARGUMENT ABSENT OU INCOMPLET REND LE NEUTRE**, c'est-à-dire la mer
    * d'avant cette tâche au bit près : un demi-couple (une accalmie posée,
    * l'autre pas) serait pire que pas d'accalmie du tout.
    *
    * ⚠️ **ET LE GIVRE ET LE CIEL PASSENT PAR LÀ AUSSI**, pour la même raison :
    * `poserMer` codait `uSky` en dur (`#bcd8ea` contre `#85c2eb` vivant) et le
    * rideau d'eau n'avait aucun givre alors que le socle vit à **0,56**.
    *
-   * @param {{vue:number, surface:number, givre?:number, ciel?:object}|null} [reglages]
-   * @returns {{vue:number, surface:number, givre:number}|null} ce qui a été posé
+   * ⚠️ **ET DEPUIS LA TÂCHE P5, L'ÉTAT DE MER ET LE FOND MARIN PASSENT PAR ICI
+   * AUSSI**, pour exactement la même raison, et parce qu'ils changent SANS que
+   * la mer soit rebâtie : une palette, un fond de `SEABEDS`, un curseur du
+   * panneau « Sea ». Re-poser la mer à chaque fois coûterait un champ de 385².
+   * **Six réglages** (`etatMerDuSocle`, `monde/ecume-mer.js`) et **trois
+   * couleurs** (`couleursFondDuSocle`, `monde/mer-sphere.js`) — tous LUS sur les
+   * uniformes vivants du socle, aucun redérivé.
+   *
+   * ⚠️ **LES TROIS COULEURS DE FOND VIVENT SUR `this.uniforms`, PAS SUR LA
+   * MER** : elles peignent les TUILES (la rampe nautique du fragment), pas la
+   * lame d'eau. Elles restent malgré tout derrière la garde `this._mer` :
+   * `retirerMer` éteint `uMerRampeOn` et remet `RAMPE_NAUTIQUE`, donc sans mer
+   * ces trois-là ne peignent rien et ne doivent pas bouger.
+   *
+   * @param {{vue:number, surface:number, givre?:number, ciel?:object,
+   *   etat?:{houle:number,chop:number,ecume:number,ecumeEchelle:number,brillance:number,vitesse:number},
+   *   fond?:{peu:object,moyen:object,fond:object}}|null} [reglages]
+   * @returns {{vue:number, surface:number, givre:number, etat:object, fond:boolean}|null}
+   *   ce qui a été posé
    */
   majReglagesMer(reglages = null) {
     if (!this._mer) return null
     const ok = reglages && Number.isFinite(reglages.vue) && Number.isFinite(reglages.surface)
     const a = ok ? reglages : ACCALMIE_NEUTRE
     const u = this._mer.material.uniforms
     u.uMerCalmeVue.value = a.vue
     u.uMerCalmeSurf.value = a.surface
     const givre = Number.isFinite(reglages?.givre) ? reglages.givre : 0
     u.uMerGivre.value = givre
     if (reglages?.ciel?.isColor) u.uSky.value.copy(reglages.ciel)
-    return { vue: a.vue, surface: a.surface, givre }
+
+    // ══════ L'ÉTAT DE MER — Tâche P5, la réserve n° 1 de P4 ═════════════════
+    //
+    // ⚠️ **TOUT OU RIEN, ET LE TOUT EST SIX.** Un état incomplet — la houle du
+    // socle avec le chop du module — serait la mer de personne : c'est le
+    // raisonnement du demi-couple d'accalmies, appliqué à six. `etatMerDuSocle`
+    // rend déjà six nombres finis par construction, et sans socle à lire il rend
+    // `ETAT_MER_NEUTRE`, c'est-à-dire ce que `poserMer` posait.
+    const e = reglages?.etat
+    const etat = e && [e.houle, e.chop, e.ecume, e.ecumeEchelle, e.brillance, e.vitesse].every(Number.isFinite)
+      ? e
+      : ETAT_MER_NEUTRE
+    u.uMerHoule.value = etat.houle
+    u.uMerChop.value = etat.chop
+    u.uMerEcume.value = etat.ecume
+    u.uMerEcumeEchelle.value = etat.ecumeEchelle
+    u.uMerBrillance.value = etat.brillance
+    u.uMerVitesse.value = etat.vitesse
+
+    // ══════ LES TROIS COULEURS DU FOND — Tâche P5 ═══════════════════════════
+    //
+    // ⚠️ **`copy`, PAS `set`** : ce sont les objets `Color` VIVANTS du socle, et
+    // les recopier plutôt que les partager est délibéré. Partager l'objet
+    // ferait qu'un `retirerMer` remettant `RAMPE_NAUTIQUE` REPEINDRAIT le socle.
+    const f = reglages?.fond
+    const fond = !!(f?.peu?.isColor && f?.moyen?.isColor && f?.fond?.isColor)
+    if (fond) {
+      this.uniforms.uOceanShallow.value.copy(f.peu)
+      this.uniforms.uOceanMid.value.copy(f.moyen)
+      this.uniforms.uOceanDeep.value.copy(f.fond)
+    }
+    return { vue: a.vue, surface: a.surface, givre, etat, fond }
   }
 
   /** Retire la mer — le globe redevient une planète sans eau animée. */
   retirerMer() {
     // ⚠️ LA RAMPE NAUTIQUE S'ÉTEINT MÊME SANS MAILLAGE, et c'est le défaut C-3
     // de la Tâche C appliqué d'avance : là-bas `retirerHabillage` ne rendait
     // que quatre uniformes sur seize, et la planète entière gardait l'intervalle
     // de courbes du crop. Ici l'uniforme est PARTAGÉ par toutes les tuiles :
     // le laisser allumé repeindrait tous les océans du monde.
     const u = this.uniforms
diff --git a/src/main.js b/src/main.js
index d7b3a85..b078761 100644
--- a/src/main.js
+++ b/src/main.js
@@ -105,21 +105,23 @@ import { EXAGERATION_UNIQUE } from './monde/zoom-continu.js'
 // `fenetre-bornee.js` importe `TERRAIN_SIZE` de `terrain.js`, donc l'import
 // inverse fermerait le cycle. `main.js` est en bout de chaîne, il n'en ouvre
 // aucun. Voir `terrain.adopterFenetre`.
 import { construireFenetre, majHauteurs, recadrerFenetre } from './monde/fenetre-bornee.js'
 // ⚠️ **LE FLUX EST LE CACHE DU QUADTREE, PAS UN SECOND CHARGEUR** (Tâche 6
 // quinquies) : `creerFlux` ne demande RIEN à sa naissance, et `remplirBorne`
 // borne le remplissage au débit RÉELLEMENT observé (règle R3, Tâche 4 ter).
 import { creerFlux, zoomEffectif, demanderEmprise, debitObserve, revisionFlux, remplirHauteurs, zoomPourEmprise } from './monde/flux-terrain.js'
 // LA MER DU CROP — Tâche J. ⚠️ **`empriseCalotte` ET `repereCrop` SONT PURS** :
 // ils ne tirent ni three.js ni le DOM, donc les importer ici n'ouvre aucun cycle.
-import { empriseCalotte, PORTEE_CROP } from './monde/mer-sphere.js'
+// ⚠️ **`couleursFondDuSocle` EST PURE ELLE AUSSI — Tâche P5** : elle LIT trois
+// uniformes et n'en écrit aucun. C'est `majReglagesMer` qui pose.
+import { empriseCalotte, PORTEE_CROP, couleursFondDuSocle } from './monde/mer-sphere.js'
 import { repereCrop } from './monde/crop-sphere.js'
 // `fractionSurTrace` : le pont d'indices qui remet la tête de course sous
 // l'objectif de la poursuite (voir son commentaire dans poursuite.js).
 import { fractionSurTrace } from './poursuite.js'
 import { ATLAS_COTE, EMPRISE_EN_VOL_MAX, enVolBorne, originesEmprise, recollerEmprise } from './dem-emprise.js'
 import { COURSE_ELASTIQUE, avanceFenetre, rappelElastique, poseDansLaCourse, fenetreQuiCentre } from './fenetre-course.js'
 import { dansFenetre } from './fenetre-clip.js'
 import { vitesseAuLache, pasElan } from './fenetre-elan.js'
 import { forceUrl, continuActif, etatInterrupteur } from './fenetre-reglage.js'
 import { pasFinesse, finesseInitiale, resDeFinesse, resFinesses, REPOS_S } from './fenetre-finesse.js'
@@ -11916,21 +11918,50 @@ function tick() {
   // ══════════ LES DEUX ACCALMIES PASSENT AU CROP — Tâche P4 ═══════════════════
   //
   // ⚠️ **JUSTE APRÈS `setView`, ET C'EST TOUT LE POINT** : `setView` est le SEUL
   // écrivain des deux facteurs, et le crop les LIT à la même image. Les
   // recalculer côté globe aurait fait deux lois pour une seule grandeur — la
   // faute que D13 §③ nomme et que ce chantier a déjà payée sur `hNorm` (P2 §3).
   //
   // ⚠️ **SANS MER DE SOCLE, `accalmie` REND LE NEUTRE (1, 1)**, c'est-à-dire la
   // calotte d'avant cette tâche au bit près. Un crop continental ne s'en plaint
   // pas : il n'a pas de mer à calmer.
-  if (terreUniqueBranchee) globe?.majReglagesMer(realWater?.reglagesMer)
+  // ══════════ ET LE FOND MARIN AVEC — Tâche P5 ═══════════════════════════════
+  //
+  // ⛔ **LES TROIS COULEURS DE LA RAMPE NAUTIQUE NE VENAIENT DE NULLE PART.**
+  // `poserMer` portait un paramètre `couleursFond` que **personne n'a jamais
+  // passé** : la calotte gelait donc le défaut de `terrain.js` (`#dce8ec` /
+  // `#7fa8b8` / `#31576b`) pendant que le socle vit sur la palette ET sur le
+  // fond de `SEABEDS` choisi dans le panneau « Sea » — relevé le 2026-08-22 à
+  // `#c8f2e4` / `#62cfc1` / `#136e7d`. Même faute que la couleur des parois
+  // (manque n° 2 du noteur) et que `uSky` (P4).
+  //
+  // ⚠️ **ICI ET PAS DANS `contexteCrop`, ET C'EST UNE QUESTION DE FRAÎCHEUR** :
+  // une palette ou un fond de mer changent SANS déplacer le crop, donc sans
+  // rejouer `poserMer`. Passer par le contexte aurait laissé la mer sur
+  // l'ancienne palette jusqu'au prochain déplacement — c'est exactement ce que
+  // `rampe2D` a coûté à la Tâche P2. Par image, c'est trois `Color.copy`.
+  //
+  // ⚠️ **LES TROIS UNIFORMES SE LISENT UN PAR UN, JAMAIS EN BLOC**, et ce n'est
+  // pas un goût : `test/damier-uniformes.test.js` ③ interdit de céder
+  // `terrain.mapUniforms` à qui que ce soit. Il a attrapé la première écriture
+  // de cette tâche, qui passait la poignée entière.
+  if (terreUniqueBranchee) {
+    globe?.majReglagesMer({
+      ...realWater?.reglagesMer,
+      fond: couleursFondDuSocle(
+        terrain.mapUniforms.uOceanShallow.value,
+        terrain.mapUniforms.uOceanMid.value,
+        terrain.mapUniforms.uOceanDeep.value,
+      ),
+    })
+  }
   // PRÉCHAUFFAGE DES SHADERS — voir warmup.js et le rendez-vous en bas de tick.
   // Tant que les programmes ne sont pas compilés on fait tourner TOUTE la
   // logique de l'image (caméra, tweens, nuages, mer, dalles voisines) mais on
   // ne DESSINE pas : c'est le premier dessin qui bloquait le fil principal.
   // ⚠️ Ne pas remonter ce test plus haut. Une première version coupait `tick()`
   // en entier ; la vue isométrique d'ouverture ne s'appliquait alors plus
   // (applyIsoView passe par un tween, et un tween que personne n'avance ne part
   // jamais) et l'ombrage auto lisait un relief qui n'avait pas fini d'arriver.
   // La carte démarrait plus vite ET fausse. Seul le DESSIN doit attendre.
   // ⚠️ La qualité adaptative attend aussi : sans dessin, la cadence mesurée est
diff --git a/src/monde/ecume-mer.js b/src/monde/ecume-mer.js
index b91d60b..c1a655a 100644
--- a/src/monde/ecume-mer.js
+++ b/src/monde/ecume-mer.js
@@ -120,20 +120,87 @@ export const ACCALMIE_NEUTRE = Object.freeze({ vue: 1, surface: 1 })
  */
 export function accalmieDuSocle(uniformes) {
   const v = uniformes?.uViewCalm?.value
   const s = uniformes?.uSurfCalm?.value
   return {
     vue: Number.isFinite(v) ? v : ACCALMIE_NEUTRE.vue,
     surface: Number.isFinite(s) ? s : ACCALMIE_NEUTRE.surface,
   }
 }
 
+// ── ②bis L'ÉTAT DE MER — Tâche P5 ──────────────────────────────────────────
+//
+// ⛔ **LA RÉSERVE N° 1 DE LA TÂCHE P4, FERMÉE.** Elle l'avait relevé au même
+// instant dans la page vivante et n'avait pas refermé le trou : *« le socle vit
+// à `uChop = 1`, `uWaveH = 2`, `uFoam = 1,9`, `uFoamScale = 1` ; la calotte
+// prend les défauts de `poserMer` — `chop = 0,7`, `houle = 0,5`,
+// `ecumeEchelle = 0,35` — parce que `contexteCrop().mer` ne passe aucun des
+// cinq. Ce sont deux MERS différentes. »*
+//
+// ⚡ **ET IL Y EN AVAIT UN SIXIÈME, QUE P4 N'AVAIT PAS NOMMÉ** : la VITESSE.
+// `ocean.js` pose `uSpeedMul = (params.seaSpeed ?? 1) × 0,4` — relevé à **0,4**
+// — et `poserMer` codait `uMerVitesse: { value: 1 }` **en dur**. La houle du
+// crop défilait **2,5 fois trop vite**, ce qui ne se voit pas sur une capture au
+// repos et se voit tout de suite en mouvement.
+//
+// ⚠️ **ON LIT `uFoam` ET `uGloss`, ON NE LES RECALCULE PAS.** `poserMer`
+// transcrivait `chopLook` (`1,9 × chop²` et `240 − 130 × chop`) : avec le chop
+// du socle la transcription rend le même nombre, mais elle resterait une SECONDE
+// écriture d'une loi qui vit dans `ocean.js`, et le panneau « Effets » peut y
+// écrire autre chose (`ocean.js` repose `uFoam`/`uGloss` sur un changement de
+// look). On prend donc les uniformes vivants — le patron des deux accalmies.
+
+/**
+ * L'état de mer NEUTRE : ce que `poserMer` posait avant la Tâche P5.
+ *
+ * ⚠️ **CES SIX NOMBRES SONT LE DÉPÔT AU BIT PRÈS**, et c'est ce qui rend l'A/B à
+ * témoin nul possible (D13 §①) : sans mer de socle à lire — crop continental,
+ * banc, test — la calotte rend exactement l'image d'avant. `ecume` et
+ * `brillance` sont `chopLook(0,7)`, la transcription qui vivait dans `poserMer`.
+ */
+export const ETAT_MER_NEUTRE = Object.freeze({
+  houle: 0.5,
+  chop: 0.7,
+  ecume: 1.9 * 0.7 * 0.7,
+  ecumeEchelle: 0.35,
+  brillance: 240 - 130 * 0.7,
+  vitesse: 1,
+})
+
+/**
+ * L'état de mer VIVANT du socle, ou le neutre s'il n'y en a pas.
+ *
+ * ⚠️ **ELLE NE CALCULE RIEN** : elle LIT. Les écrivains restent `ocean.js`
+ * (`_applySea`, `setSeaLook`, `_refreshWaveScale`) et personne d'autre.
+ *
+ * ⚠️ **TOUT OU RIEN, CHAMP PAR CHAMP.** Un uniforme absent rend SA valeur
+ * neutre, pas celle du voisin : un socle qui n'exposerait que la moitié de son
+ * état de mer donnerait sinon une mer hybride, qui n'est celle de personne.
+ *
+ * @param {object|null} uniformes les uniformes du matériau de mer du socle
+ * @returns {{houle:number, chop:number, ecume:number, ecumeEchelle:number, brillance:number, vitesse:number}}
+ */
+export function etatMerDuSocle(uniformes) {
+  const lire = (nom, neutre) => {
+    const v = uniformes?.[nom]?.value
+    return Number.isFinite(v) ? v : neutre
+  }
+  return {
+    houle: lire('uWaveH', ETAT_MER_NEUTRE.houle),
+    chop: lire('uChop', ETAT_MER_NEUTRE.chop),
+    ecume: lire('uFoam', ETAT_MER_NEUTRE.ecume),
+    ecumeEchelle: lire('uFoamScale', ETAT_MER_NEUTRE.ecumeEchelle),
+    brillance: lire('uGloss', ETAT_MER_NEUTRE.brillance),
+    vitesse: lire('uSpeedMul', ETAT_MER_NEUTRE.vitesse),
+  }
+}
+
 // ── ③ LA TAVELURE ET LE BRUIT ──────────────────────────────────────────────
 
 /**
  * La fréquence de la tavelure, **PAR UNITÉ DE SOCLE**. `ocean.js:537` :
  * `vnoise(xz * 0.33 + …)` où `xz = vWorld.xz`, donc des unités de socle.
  *
  * ⚠️ **LA CALOTTE ÉCRIVAIT `vLocal * 0.33 / uMerLambda * 0.08`**, c'est-à-dire
  * en espace de SPECTRE avec un facteur `0,08` qui n'existe nulle part dans
  * `ocean.js`. Relevé sur la page vivante (La Réunion z12,
  * `uMerLambda = 0,0032204`, largeur du crop `0,429` unité de scène) : la cellule
diff --git a/src/monde/mer-sphere.js b/src/monde/mer-sphere.js
index b7daf60..21f4255 100644
--- a/src/monde/mer-sphere.js
+++ b/src/monde/mer-sphere.js
@@ -272,20 +272,112 @@ export function echelleHouleM(repere) {
  * littoral. Cette frange n'est pas la lame d'eau : c'est le FOND, vu au travers.
  * Le globe peignait le même fond avec le bas de sa propre table hypsométrique —
  * un olive sombre sans frange.
  */
 export const RAMPE_NAUTIQUE = Object.freeze({
   peu: '#dce8ec',
   moyen: '#7fa8b8',
   fond: '#31576b',
 })
 
+/**
+ * Les trois couleurs VIVANTES du fond marin du socle — Tâche P5.
+ *
+ * ⛔ **`RAMPE_NAUTIQUE` CI-DESSUS N'EST PAS LA PALETTE : C'EST LE DÉFAUT DE
+ * `terrain.js`** (`params.oceanShallow ?? '#dce8ec'`). Le socle ne vit JAMAIS
+ * dessus en production : `main.js` y écrit `params.ocean*` à chaque palette, et
+ * le panneau « Sea » y écrit en plus un fond de `SEABEDS` (le gabarit
+ * d'ouverture pose « lagoon »). Relevé le 2026-08-22 dans la page vivante, La
+ * Réunion z12 : le socle porte **`#c8f2e4` / `#62cfc1` / `#136e7d`**, la calotte
+ * **`#dce8ec` / `#7fa8b8` / `#31576b`** — les défauts.
+ *
+ * ⚠️ **C'EST LA MÊME FAUTE QUE LA COULEUR DES PAROIS (manque n° 2 du noteur) ET
+ * QUE `uSky` (Tâche P4), AU MÊME ENDROIT DU MÊME OBJET** : un défaut de module
+ * gelé dans un uniforme que personne ne repose. `poserMer` portait bien un
+ * paramètre `couleursFond` — **aucun appelant ne l'a jamais passé**, et c'est
+ * pourquoi il disparaît au profit d'un écrivain unique par image.
+ *
+ * ⚠️ **ELLE NE CALCULE RIEN, ELLE LIT.** Les seuls écrivains de ces trois
+ * valeurs restent `applyPalette` et le panneau « Sea » ; les redériver ici
+ * ferait deux palettes à garder d'accord — la faute que D13 §③ nomme, et celle
+ * que P2 a évitée en prenant `terrain.mapUniforms.uRampTex` tel quel.
+ *
+ * ⚠️ **ELLE PREND TROIS COULEURS, PAS LA POIGNÉE DES UNIFORMES DU SOCLE**, et
+ * ce n'est pas un goût : `test/damier-uniformes.test.js` ③ INTERDIT de céder
+ * `terrain.mapUniforms` en bloc — « un module qui la reçoit écrit dedans quand
+ * il veut, et aucune des deux autres propriétés de ce fichier ne le voit
+ * passer ». C'est la même règle que `contexteCrop` suit déjà (« les uniformes se
+ * lisent un par un, jamais en bloc »). Le test l'a attrapé à la première
+ * écriture de cette tâche.
+ *
+ * @param {object|null} peu la couleur du haut-fond (`uOceanShallow`)
+ * @param {object|null} moyen la couleur intermédiaire (`uOceanMid`)
+ * @param {object|null} fond la couleur d'abysse (`uOceanDeep`)
+ * @returns {{peu:object, moyen:object, fond:object}|null} les trois `Color`
+ *   VIVANTES du socle, ou `null` si l'une des trois manque — **on ne pose jamais
+ *   un demi-triplet** : deux couleurs du socle et une du défaut seraient pires
+ *   que les trois du défaut, exactement comme le demi-couple d'accalmies de P4.
+ */
+export function couleursFondDuSocle(peu, moyen, fond) {
+  if (!peu?.isColor || !moyen?.isColor || !fond?.isColor) return null
+  return { peu, moyen, fond }
+}
+
+/**
+ * La profondeur maximale du champ **DANS LE CROP**, en mètres — Tâche P5.
+ *
+ * ⛔ **LE BUDGET DU FOND ÉTAIT CELUI DE LA CALOTTE, ET LE SOCLE PREND CELUI DE
+ * SON BLOC.** `terrain.js` pose `uSeaRange = (0 − dem.minM) × demScale`, et
+ * `dem` couvre EXACTEMENT le bloc. `poserMer`, lui, posait `champ.profMaxM`,
+ * mesuré sur la calotte — trois fois plus large. Relevé le 2026-08-22, La
+ * Réunion z12 : **3 510,49 m contre 2 116 m**, soit **×1,658**.
+ *
+ * ⚠️ **ET CE N'EST PAS UN DÉTAIL DE NORMALISATION : ÇA DOUBLE LA FRANGE PÂLE.**
+ * Le segment clair de la rampe nautique (`d01 < 0,45`, `uOceanShallow` →
+ * `uOceanMid`) couvrait **38,89 %** des 5 449 nœuds d'eau du crop avec le budget
+ * de la calotte, et **19,82 %** avec celui du crop. Ce sont les « gradins pâles »
+ * de la Tâche P4.
+ *
+ * ⚠️ **MESURÉE SUR LE CHAMP DÉJÀ CUIT, PAS SUR UN SECOND BALAYAGE, ET PAS SUR
+ * `uOceanDepth`.** `poserRampe` mesure la même grandeur sur SA grille (relevé à
+ * 2 106,77 m, soit 0,44 % du socle) — mais elle peut REFUSER faute de
+ * couverture, et son refus laisse le défaut MONDIAL de 6 000 m, c'est-à-dire une
+ * frange encore plus pâle qu'aujourd'hui. C'est le piège que l'en-tête de
+ * `uMerFondBudgetM` nomme déjà. On mesure donc sur le champ de la mer, qui est
+ * là par construction.
+ *
+ * @param {Float32Array|Array<number>} valeurs - le champ, ligne-major
+ * @param {number} cote - côté du champ, en nœuds
+ * @param {number} portee - demi-largeur du champ, en demi-côtés de crop
+ * @returns {number} la profondeur maximale (positive) dans `|q| <= 1`, ou 0
+ */
+export function profondeurMaxDuCrop(valeurs, cote, portee) {
+  if (!valeurs || !(cote > 1) || !(portee > 0)) return 0
+  const n = cote - 1
+  let max = 0
+  for (let j = 0; j < cote; j++) {
+    // ⚠️ **LA MÊME CONVENTION QUE `uvFond` ET QUE `MER_VERT`, À L'ENVERS** : le
+    // nœud `i` porte `q = (2 i / (cote − 1) − 1) × portee`. Une seconde
+    // convention ici, et le budget serait mesuré ailleurs que là où il sert.
+    const qv = (2 * j) / n - 1
+    if (Math.abs(qv * portee) > 1) continue
+    const base = j * cote
+    for (let i = 0; i < cote; i++) {
+      const qu = (2 * i) / n - 1
+      if (Math.abs(qu * portee) > 1) continue
+      const h = valeurs[base + i]
+      if (h < 0 && -h > max) max = -h
+    }
+  }
+  return max
+}
+
 /**
  * La loi de couleur du fond marin — la transcription de `terrain.js:1019-1023`.
  *
  * ⚠️ **EXPOSANT 0,55 ET COUDE À 0,45 : LES DEUX VIENNENT DU SOCLE.** L'exposant
  * écrase la profondeur pour que la frange côtière occupe une part visible de la
  * rampe ; le coude place le bleu moyen aux 45 % du budget. Les changer, c'est
  * changer la mer du socle, pas la porter.
  *
  * @param {number} profondeurM - profondeur en mètres (positive)
  * @param {number} budgetM - la profondeur qui vaut « abysse »
diff --git a/src/ocean.js b/src/ocean.js
index 2d1915f..d099519 100644
--- a/src/ocean.js
+++ b/src/ocean.js
@@ -31,21 +31,21 @@ import { plansEauRetenus } from './plan-eau.js'
 // pour la mesure d'avant/après et le pourquoi de chaque choix.
 import { resChamp, spanChamp } from './mer-emprise.js'
 // LA DISTANCE AU RIVAGE — une seule loi, deux lecteurs (voir _bakeField).
 // ⚠️ AUCUN CYCLE : `monde/mer-sphere.js` est PUR (ni three ni DOM) et n'importe
 // que `crop-sphere`, `parois-crop` et `habillage-crop`, dont aucun ne remonte
 // jusqu'ici. Vérifié : `grep -rn "from '.*ocean" src/monde/` ne rend RIEN (le nom
 // du fichier n'y apparaît que dans des commentaires).
 import { distanceRivage, GLSL_JUPE_MER } from './monde/mer-sphere.js'
 // L'ÉCUME — une seule loi, deux lecteurs (Tâche P4). Même motif, même absence
 // de cycle : `monde/ecume-mer.js` n'importe RIEN du tout.
-import { GLSL_ECUME, FREQ_TAVELURE, accalmieDuSocle } from './monde/ecume-mer.js'
+import { GLSL_ECUME, FREQ_TAVELURE, accalmieDuSocle, etatMerDuSocle } from './monde/ecume-mer.js'
 // L'emprise du DAMIER — même machinerie, autre cause : ici la mer s'étend parce
 // que des cases voisines sont posées, pas parce que le relief défile.
 import { empriseDeMer, coteGeometrique, geometrieDeMer } from './damier-carre.js'
 // wave engine shared with ocean-lab (C:\Dev\ocean-lab) — the Vite alias
 // resolves to the LIVE ocean-lab source when it's cloned next to this repo,
 // to the committed src/vendor/ocean-waves copy otherwise (npm run sync:waves)
 import { makeSeaState, seaStateToUniforms, GERSTNER_GLSL } from 'ocean-waves'
 
 const FIELD_RES = 384 // height/shore field over the whole slab
 
@@ -1831,20 +1831,28 @@ export class RealWater {
     // Le rideau du crop bâti sans lui rendait un voile PÂLE sur la paroi
     // terracotta (alpha 0,55 au lieu de 0,768) : vu à l'écran, pas déduit.
     const j = this.materials.find((m) => m?.uniforms?.uFrost)?.uniforms ?? null
     return {
       ...accalmieDuSocle(u),
       givre: Number.isFinite(j?.uFrost?.value) ? j.uFrost.value : 0,
       // ⚠️ **ET LE CIEL AUSSI** : `poserMer` codait `#bcd8ea` en dur là où le
       // socle vit à `#85c2eb`. Même faute que la couleur des parois du crop
       // (manque n° 2 du noteur), au même endroit du même objet.
       ciel: u?.uSky?.value ?? null,
+      // ⚠️ **ET L'ÉTAT DE MER — Tâche P5, la réserve n° 1 de P4.** Six nombres,
+      // LUS ici et recalculés nulle part. Relevé le 2026-08-22 dans la page
+      // vivante : le socle vit à `uWaveH = 2`, `uChop = 1`, `uFoam = 1,9`,
+      // `uFoamScale = 1`, `uGloss = 110`, `uSpeedMul = 0,4` ; la calotte vivait
+      // sur les défauts de `poserMer` — `0,5 / 0,7 / 0,931 / 0,35 / 149 / 1`.
+      // **Six sur six différents**, dont la VITESSE, que P4 n'avait pas nommée
+      // et qui faisait défiler la houle du crop 2,5 fois trop vite.
+      etat: etatMerDuSocle(u),
     }
   }
 
   // Le Y de la surface de mer courante, ou null tant qu'aucune mer n'est
   // construite.
   get seaY() {
     return this.meshes.length ? this._seaBase : null
   }
 
   update(dt, sun) {
diff --git a/test/ecume-mer.test.js b/test/ecume-mer.test.js
index 382cd84..8672b0a 100644
--- a/test/ecume-mer.test.js
+++ b/test/ecume-mer.test.js
@@ -36,20 +36,23 @@ import {
   POIDS_RESSAC,
   POIDS_LISERE,
   BLANC_ECUME,
   ecumeMoutons,
   largeurRessac,
   frontsRessac,
   ecumeRessac,
   ecumeLisere,
   ecumeMer,
   GLSL_ECUME,
+  // ⚠️ **Tâche P5** : l'état de mer, LU sur le socle et jamais recalculé.
+  ETAT_MER_NEUTRE,
+  etatMerDuSocle,
 } from '../src/monde/ecume-mer.js'
 import {
   construireJupeMer,
   GLSL_JUPE_MER,
   RETRAIT_EAU_CROP,
   bordDeMer,
   PORTEE_CROP,
 } from '../src/monde/mer-sphere.js'
 import { COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
 
@@ -319,22 +322,34 @@ test('③a aucune des formules d écume ne reparaît dans ocean.js ni dans globe
   for (const src of [sansCommentaires(ocean()), sansCommentaires(globe())]) {
     for (const [re, quoi] of cibles) {
       assert.ok(!re.test(src), `${quoi} est réécrit hors du module partagé`)
     }
   }
 })
 
 test('③b les deux fichiers INJECTENT le texte partagé, ils ne le recopient pas', () => {
   const o = ocean()
   const g = globe()
-  assert.match(o, /import \{ GLSL_ECUME, FREQ_TAVELURE, accalmieDuSocle \} from '\.\/monde\/ecume-mer\.js'/)
-  assert.match(g, /import \{ GLSL_ECUME, FREQ_TAVELURE, BLANC_ECUME, ACCALMIE_NEUTRE \} from '\.\/monde\/ecume-mer\.js'/)
+  // ⚠️ **LA LISTE EXACTE N'EST PLUS EXIGÉE, LES NOMS LE SONT — Tâche P5.**
+  // Cette assertion cassait à chaque nom ajouté au module sans rien prouver de
+  // plus : ce qui compte est qu'il n'y ait qu'UNE importation, et qu'elle porte
+  // ce dont chaque fichier se sert.
+  const importOcean = o.match(/import \{([^}]*)\} from '\.\/monde\/ecume-mer\.js'/)
+  const importGlobe = g.match(/import \{([^}]*)\} from '\.\/monde\/ecume-mer\.js'/)
+  assert.ok(importOcean, "ocean.js doit importer monde/ecume-mer.js")
+  assert.ok(importGlobe, "globe.js doit importer monde/ecume-mer.js")
+  for (const nom of ['GLSL_ECUME', 'FREQ_TAVELURE', 'accalmieDuSocle', 'etatMerDuSocle']) {
+    assert.ok(importOcean[1].includes(nom), `ocean.js doit importer ${nom}`)
+  }
+  for (const nom of ['GLSL_ECUME', 'FREQ_TAVELURE', 'BLANC_ECUME', 'ACCALMIE_NEUTRE', 'ETAT_MER_NEUTRE']) {
+    assert.ok(importGlobe[1].includes(nom), `globe.js doit importer ${nom}`)
+  }
   // injecté dans les DEUX nuanceurs de chaque fichier
   // ⚠️ **TROIS, ET LE TROISIÈME EST LE VERTEX DE LA JUPE DU SOCLE** : il portait
   // lui aussi sa propre copie du déclin côtier (`max((uWaterY − f.r) * 2.0, f.g)`
   // et `smoothstep(0.0, 0.10, shoreD)`). ③a l'a trouvée — trois écritures, pas
   // deux. C'est la neuvième constante muette de ce chantier.
   assert.equal((o.match(/\$\{GLSL_ECUME\}/g) || []).length, 3,
     'ocean.js doit injecter dans son vertex, son fragment ET le vertex de sa jupe')
   assert.equal((g.match(/\$\{GLSL_ECUME\}/g) || []).length, 2, 'globe.js doit injecter dans MER_VERT ET MER_FRAG')
   assert.equal((o.match(/\$\{GLSL_JUPE_MER\}/g) || []).length, 1)
   assert.equal((g.match(/\$\{GLSL_JUPE_MER\}/g) || []).length, 1)
@@ -382,24 +397,31 @@ test('④b `ocean.js` expose ses réglages vivants, GIVRE et CIEL compris', () =
   // le givre vit sur le matériau de la JUPE, pas sur celui de la surface :
   // le chercher sur `materials[0]` aurait rendu 0 sans un mot.
   assert.match(s, /this\.materials\.find\(\(m\) => m\?\.uniforms\?\.uFrost\)/)
   assert.match(s, /ciel: u\?\.uSky\?\.value \?\? null/)
   assert.ok(!/get accalmie\(\)/.test(s), 'l ancien accesseur doit avoir disparu')
 })
 
 test('④c `main.js` pose les réglages à CHAQUE image, juste après `setView`', () => {
   const s = readFileSync(SRC_MAIN, 'utf8')
   const i = s.indexOf('realWater?.setView(')
-  const j = s.indexOf('globe?.majReglagesMer(realWater?.reglagesMer)')
+  const j = s.indexOf('globe?.majReglagesMer(')
   assert.ok(i > 0 && j > i, 'l appel doit suivre setView, seul écrivain des deux accalmies')
   // ⚠️ et il est GARDÉ par le drapeau : sans `terre unique`, rien n'est posé
-  assert.match(s.slice(i, j + 80), /if \(terreUniqueBranchee\) globe\?\.majReglagesMer/)
+  assert.match(s.slice(i, j + 200), /if \(terreUniqueBranchee\) \{\s+globe\?\.majReglagesMer\(/)
+  // ⚠️ **ET IL PORTE LES RÉGLAGES VIVANTS DES DEUX SOURCES — Tâche P5** : la mer
+  // du socle (`reglagesMer`, qui contient l'état de mer) ET les trois couleurs
+  // de fond, qui vivent sur `terrain.mapUniforms` et non sur `realWater`.
+  const appel = s.slice(j, j + 400)
+  assert.match(appel, /\.\.\.realWater\?\.reglagesMer/)
+  // ⚠️ **UN PAR UN, JAMAIS LA POIGNÉE** — `test/damier-uniformes.test.js` ③.
+  assert.match(appel, /fond: couleursFondDuSocle\(\s+terrain\.mapUniforms\.uOceanShallow\.value,/)
   // ⚠️ **ET IL N'Y EN A QU'UN** : deux sites poseraient deux valeurs d'une même
   // image, et c'est le genre d'écart qu'on met des soirées à lire.
   assert.equal((s.match(/majReglagesMer\(/g) || []).length, 1)
 })
 
 test('④d le nuanceur de la calotte LIT les quatre uniformes neufs', () => {
   const frag = sansCommentaires(blocGlsl(globe(), 'MER_FRAG'))
   const vert = sansCommentaires(blocGlsl(globe(), 'MER_VERT'))
   for (const u of ['uMerCalmeVue', 'uMerCalmeSurf', 'uMerGivre', 'uMerUnite']) {
     assert.match(frag, new RegExp(`uniform float ${u};`), `${u} non déclaré`)
@@ -536,10 +558,98 @@ test('⑥b `dBord` est SIGNÉ — sans quoi le retrait ne peut pas exister', ()
   // tout l'intérieur rendait exactement 0 — donc un `fin` négatif discardait la
   // mer ENTIÈRE. C'est ce qui est arrivé au premier essai, à l'écran.
   const ancien = (u, v, coin, n) => {
     const cq = [Math.max(Math.abs(u) - (1 - coin), 0), Math.max(Math.abs(v) - (1 - coin), 0)]
     return Math.pow(Math.pow(cq[0], n) + Math.pow(cq[1], n), 1 / n) - coin
   }
   assert.equal(ancien(0.5, 0, 0, 2), 0)
   assert.equal(ancien(0, 0, 0, 2), 0)
   assert.ok(bordDeMer(1).fin < ancien(0.5, 0, 0, 2), 'le fondu tomberait entièrement sous la mesure')
 })
+
+// ══════════ ⑦ L'ÉTAT DE MER — Tâche P5, la réserve n° 1 de P4 ══════════════
+//
+// ⛔ **P4 L'AVAIT MESURÉ ET NE L'AVAIT PAS FERMÉ** : *« le socle vit à
+// `uChop = 1`, `uWaveH = 2`, `uFoam = 1,9`, `uFoamScale = 1` ; la calotte prend
+// les défauts de `poserMer` […] Ce sont deux MERS différentes. »*
+// ⚡ Et il y en avait un **sixième**, non nommé : la VITESSE (`uSpeedMul = 0,4`
+// contre `uMerVitesse: { value: 1 }` codé en dur — la houle du crop défilait
+// **2,5 fois trop vite**).
+
+test('⑦a `etatMerDuSocle` LIT les six uniformes vivants', () => {
+  const socle = {
+    uWaveH: { value: 2 }, uChop: { value: 1 }, uFoam: { value: 1.9 },
+    uFoamScale: { value: 1 }, uGloss: { value: 110 }, uSpeedMul: { value: 0.4 },
+  }
+  assert.deepEqual(etatMerDuSocle(socle),
+    { houle: 2, chop: 1, ecume: 1.9, ecumeEchelle: 1, brillance: 110, vitesse: 0.4 })
+})
+
+test('⑦b sans socle à lire, `etatMerDuSocle` rend le NEUTRE — la mer d avant P5', () => {
+  assert.deepEqual(etatMerDuSocle(null), ETAT_MER_NEUTRE)
+  assert.deepEqual(etatMerDuSocle(undefined), ETAT_MER_NEUTRE)
+  assert.deepEqual(etatMerDuSocle({}), ETAT_MER_NEUTRE)
+})
+
+test('⑦c un uniforme absent ou NaN rend SA valeur neutre, jamais celle du voisin', () => {
+  // ⚠️ **CHAMP PAR CHAMP** : une lecture qui retomberait en bloc sur le neutre
+  // dès qu'un seul uniforme manque jetterait cinq valeurs justes ; une qui
+  // prendrait le voisin fabriquerait une mer que personne n'a réglée. Les deux
+  // fautes passent un `deepEqual` global si on ne teste pas séparément.
+  const noms = {
+    houle: 'uWaveH', chop: 'uChop', ecume: 'uFoam',
+    ecumeEchelle: 'uFoamScale', brillance: 'uGloss', vitesse: 'uSpeedMul',
+  }
+  for (const [champ, uni] of Object.entries(noms)) {
+    const seul = etatMerDuSocle({ [uni]: { value: 0.987654 } })
+    assert.equal(seul[champ], 0.987654, `${uni} n atteint pas ${champ}`)
+    for (const [autre, v] of Object.entries(ETAT_MER_NEUTRE)) {
+      if (autre === champ) continue
+      assert.equal(seul[autre], v, `${uni} a débordé sur ${autre}`)
+    }
+    // ⚠️ **UN NaN NE PASSE PAS** : il éteint la moitié d'un GPU sans un mot.
+    assert.equal(etatMerDuSocle({ [uni]: { value: NaN } })[champ], ETAT_MER_NEUTRE[champ])
+    assert.equal(etatMerDuSocle({ [uni]: {} })[champ], ETAT_MER_NEUTRE[champ])
+  }
+})
+
+test('⑦d les deux valeurs dérivées du NEUTRE remontent à `chopLook` d `ocean.js`', () => {
+  // ⚠️ **LU SUR LE DISQUE, PAS RECOPIÉ ICI.** `poserMer` transcrivait
+  // `chopLook` (`1,9 × c²` et `240 − 130 × c`) ; `ETAT_MER_NEUTRE` en porte
+  // l'image à `c = 0,7`, et ce test la re-dérive depuis la SOURCE d'`ocean.js`.
+  const src = ocean()
+  const m = src.match(/function chopLook\(c\) \{\s*\n?\s*return \{ detail: [^,]+, foam: ([\d.]+) \* c \* c, gloss: ([\d.]+) - ([\d.]+) \* c \}/)
+  assert.ok(m, 'chopLook doit rester lisible dans ocean.js')
+  const [, foamK, glossA, glossB] = m.map(Number)
+  assert.equal(ETAT_MER_NEUTRE.ecume, foamK * ETAT_MER_NEUTRE.chop * ETAT_MER_NEUTRE.chop)
+  assert.equal(ETAT_MER_NEUTRE.brillance, glossA - glossB * ETAT_MER_NEUTRE.chop)
+  // et le neutre reste bien celui du dépôt d'avant P5 : chop 0,7, écume 0,35
+  assert.equal(ETAT_MER_NEUTRE.chop, 0.7)
+  assert.equal(ETAT_MER_NEUTRE.houle, 0.5)
+  assert.equal(ETAT_MER_NEUTRE.ecumeEchelle, 0.35)
+  assert.equal(ETAT_MER_NEUTRE.vitesse, 1)
+})
+
+test('⑦e `ocean.js` REMONTE son état de mer par `reglagesMer`, et par lui seul', () => {
+  const src = ocean()
+  // un seul accesseur, et il appelle la lecture partagée
+  assert.match(src, /get reglagesMer\(\)/)
+  assert.equal((src.match(/get reglagesMer\(\)/g) || []).length, 1)
+  assert.match(src, /etat: etatMerDuSocle\(u\),/)
+  // ⚠️ **ET `globe.js` NE REDÉRIVE RIEN** : plus une seule transcription de
+  // `chopLook` dans le nuanceur ni dans `poserMer`. C'était deux écritures
+  // d'une loi qui vit dans `ocean.js`.
+  const g = sansCommentaires(globe())
+  assert.ok(!/1\.9 \* chop \* chop/.test(g), 'globe.js ne doit plus transcrire foam')
+  assert.ok(!/240 - 130 \* chop/.test(g), 'globe.js ne doit plus transcrire gloss')
+})
+
+test('⑦f `majReglagesMer` est le SEUL écrivain des six uniformes d état de mer', () => {
+  // ⚠️ **DEUX ÉCRIVAINS POUR UNE GRANDEUR, C EST LA FAUTE QUE D13 §③ NOMME**, et
+  // ce chantier l'a payée sur `hNorm`, sur `uMerUnite` et sur le déclin côtier.
+  // Chaque uniforme n'est ASSIGNÉ qu'une fois hors de sa déclaration.
+  const g = sansCommentaires(globe())
+  for (const uni of ['uMerHoule', 'uMerChop', 'uMerEcume', 'uMerEcumeEchelle', 'uMerBrillance', 'uMerVitesse']) {
+    const ecritures = (g.match(new RegExp(`u\\.${uni}\\.value = `, 'g')) || []).length
+    assert.equal(ecritures, 1, `${uni} doit avoir UN seul écrivain, pas ${ecritures}`)
+  }
+})
diff --git a/test/mer-sphere.test.js b/test/mer-sphere.test.js
index 8d8a1c6..c5b2d31 100644
--- a/test/mer-sphere.test.js
+++ b/test/mer-sphere.test.js
@@ -52,24 +52,26 @@ import {
   SEUIL_TRAIT_EAU_UNITES,
   seuilTraitEauM,
   ECHELLE_HOULE_UNITES,
   echelleHouleM,
   RAMPE_NAUTIQUE,
   abscisseNautique,
   PORTEE_CROP,
   RETRAIT_EAU_CROP,
   FRACTION_BANDE_BORD,
   bordDeMer,
+  couleursFondDuSocle,
+  profondeurMaxDuCrop,
 } from '../src/monde/mer-sphere.js'
 // ⚠️ **Tâche P4** : le fondu de rivage n'est plus écrit dans `globe.js`, il est
 // INJECTÉ depuis le module partagé — le test suit donc la valeur à sa source.
-import { FONDU_HOULE_FIN, GLSL_ECUME, accalmieDuSocle } from '../src/monde/ecume-mer.js'
+import { FONDU_HOULE_FIN, GLSL_ECUME, accalmieDuSocle, ETAT_MER_NEUTRE, etatMerDuSocle } from '../src/monde/ecume-mer.js'
 import { zoomPourEmprise } from '../src/monde/flux-terrain.js'
 // ⚠️ L'ALIAS QUE VITE POSE (`vite.config.js`), RÉSOLU SANS VITE — le patron de
 // `test/damier-mer-runtime.test.js` : la copie vendorée fait foi ici, et cinq
 // lignes suffisent. Sans ce hook, `Globe.prototype.poserMer` ne peut être
 // exercée QUE jusqu'à sa clause de refus (`await import('./ocean.js')` lève),
 // ce qui est exactement le trou du Tour de correction 1 (constat I1/F-3) :
 // ~150 lignes de corps de méthode — la dérivation de portée, la cuisson du
 // champ, la construction du maillage — n'étaient exercées par PERSONNE.
 registerHooks({
   resolve(spec, ctx, suivant) {
@@ -954,20 +956,47 @@ test('⑩d le nuanceur du globe garde la rampe nautique DERRIÈRE son interrupte
 // ⚠️ **L'ALIAS `ocean-waves` EST LA SEULE RAISON POUR LAQUELLE ⑩c S'ARRÊTAIT
 // LÀ.** `poserMer` fait `await import('./ocean.js')` en COURS de route
 // (après la portée, la calotte et le champ, mais avant le matériau) ; sous
 // node nu cet import lève, parce qu'`ocean.js` tire `ocean-waves` par un
 // alias que seul Vite résout. Le `registerHooks` en tête de ce fichier —
 // le patron exact de `test/damier-mer-runtime.test.js` — le résout aussi
 // sous node : tout ce qui précède cet import est du vrai three.js
 // (`BufferGeometry`, `DataTexture`, `ShaderMaterial`), et aucune de ces
 // classes n'a besoin d'un contexte WebGL pour être CONSTRUITE.
 
+// ⚠️ **Tâche P5 — UNE COULEUR BOUCHON QUI COPIE VRAIMENT.** L'ancien bouchon ne
+// portait qu'un `set()` VIDE : une `majReglagesMer` qui n'aurait rien copié
+// serait passée sans un mot. Celui-ci porte les trois canaux, `set`, `copy` et
+// `getHexString`, donc le test peut LIRE ce qui a été posé.
+function couleurBouchon(hex = '#000000') {
+  const c = {
+    isColor: true,
+    r: parseInt(hex.slice(1, 3), 16) / 255,
+    g: parseInt(hex.slice(3, 5), 16) / 255,
+    b: parseInt(hex.slice(5, 7), 16) / 255,
+    set(v) {
+      if (typeof v === 'string') {
+        c.r = parseInt(v.slice(1, 3), 16) / 255
+        c.g = parseInt(v.slice(3, 5), 16) / 255
+        c.b = parseInt(v.slice(5, 7), 16) / 255
+      }
+      return c
+    },
+    copy(o) { c.r = o.r; c.g = o.g; c.b = o.b; return c },
+    getHexString() {
+      const h = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
+      return h(c.r) + h(c.g) + h(c.b)
+    },
+  }
+  return c
+}
+
 function globeAvecCrop(overrides = {}) {
   // Un `Globe` minimal qui porte exactement ce que `poserMer` lit et écrit —
   // même discipline que `globeMinimal()` ci-dessus, élargie au corps de la
   // méthode : `_crop` un VRAI repère, `exaggeration`, un `group` qui accepte
   // vraiment un maillage, et les uniformes que le matériau referme dessus.
   const val = (v) => ({ value: v })
   return {
     _crop: REPERE,
     exaggeration: EXAG_SOCLE_NOMINALE,
     group: {
@@ -982,23 +1011,23 @@ function globeAvecCrop(overrides = {}) {
       uCropCoin: val(0),
       uCropCoinN: val(2),
       uMerRampeOn: val(0),
       uMerFondBudgetM: val(6000),
       // ⚠️ **AJOUTÉS PAR LA TÂCHE K bis** : `poserMer` n'écrit plus le budget du
       // fond en direct, il l'ANCRE dans l'échelle continue puis lit la courbe.
       // Le faux globe porte donc le plancher de division et le partage — même
       // discipline que le reste de ce bâtisseur : ce que la méthode exerce, il
       // le porte pour de vrai.
       uPlancherRampeM: val(0),
-      uOceanShallow: val({ set() {} }),
-      uOceanMid: val({ set() {} }),
-      uOceanDeep: val({ set() {} }),
+      uOceanShallow: val(couleurBouchon(RAMPE_NAUTIQUE.peu)),
+      uOceanMid: val(couleurBouchon(RAMPE_NAUTIQUE.moyen)),
+      uOceanDeep: val(couleurBouchon(RAMPE_NAUTIQUE.fond)),
       // Tâche J : le bord de la mer les lit — VRAIS uniformes, pas des bouchons,
       // pour que `poserEstompage` et `_majBordMer` s'exercent l'un sur l'autre.
       uEstompageOn: val(0),
       uEstompage: val(1),
     },
     _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
     retirerMer: Globe.prototype.retirerMer,
     _cuireChampMer: Globe.prototype._cuireChampMer,
     _majBordMer: Globe.prototype._majBordMer,
     _melangeCalottes() {},
@@ -1277,21 +1306,28 @@ function merPosee(arg = {}) {
 test('⑫a `majReglagesMer` pose les DEUX accalmies, le givre et le ciel', () => {
   return merPosee().then(({ g, u }) => {
     const ciel = { isColor: true }
     const cible = { isColor: true, copy(c) { this.recu = c } }
     u.uSky.value = cible
     const pose = Globe.prototype.majReglagesMer.call(g, { vue: 0.4039, surface: 0.08, givre: 0.56, ciel })
     assert.equal(u.uMerCalmeVue.value, 0.4039)
     assert.equal(u.uMerCalmeSurf.value, 0.08, 'la seconde accalmie doit être posée AUSSI')
     assert.equal(u.uMerGivre.value, 0.56, 'le givre du socle de verre doit être posé')
     assert.equal(cible.recu, ciel, 'le ciel doit être COPIÉ, pas remplacé')
-    assert.deepEqual(pose, { vue: 0.4039, surface: 0.08, givre: 0.56 })
+    assert.deepEqual(pose, {
+      vue: 0.4039, surface: 0.08, givre: 0.56,
+      // ⚠️ **SANS `etat`, LE NEUTRE — la mer d'avant P5 au bit près.** Le retour
+      // le DIT plutôt que de le taire : un appelant qui ne passe pas d'état de
+      // mer doit pouvoir lire dans le résultat qu'il a hérité du neutre.
+      etat: ETAT_MER_NEUTRE,
+      fond: false,
+    })
   })
 })
 
 test('⑫b un demi-couple retombe sur le NEUTRE — pas sur une moitié d accalmie', () => {
   return merPosee().then(({ g, u }) => {
     // ⚠️ **UN DEMI-COUPLE EST PIRE QUE PAS D ACCALMIE DU TOUT** : le ressac
     // serait multiplié par 0,08 pendant que les moutons resteraient à 1.
     for (const mauvais of [{ vue: 0.4, surface: NaN }, { vue: NaN, surface: 0.08 }, {}, null, undefined]) {
       Globe.prototype.majReglagesMer.call(g, mauvais)
       assert.equal(u.uMerCalmeVue.value, 1, `${JSON.stringify(mauvais)}`)
@@ -1423,16 +1459,307 @@ test('⑫j `reglagesMer` d `ocean.js` LIT vraiment ses trois réglages — exéc
   // rendrait 0 sans un mot. Le faux socle le reproduit exprès.
   const d = Object.getOwnPropertyDescriptor(RealWater.prototype, 'reglagesMer')
   assert.equal(typeof d?.get, 'function', 'reglagesMer doit être un accesseur')
   const ciel = { isColor: true }
   const socle = {
     materials: [
       { uniforms: { uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 }, uSky: { value: ciel } } },
       { uniforms: { uFrost: { value: 0.56 } } },
     ],
   }
-  assert.deepEqual(d.get.call(socle), { vue: 0.4039, surface: 0.08, givre: 0.56, ciel })
+  assert.deepEqual(d.get.call(socle), {
+    vue: 0.4039, surface: 0.08, givre: 0.56, ciel,
+    // ⚠️ **Tâche P5** : le faux socle ci-dessus ne porte AUCUN des six uniformes
+    // d'état de mer, donc l'accesseur doit rendre le neutre — champ par champ.
+    etat: ETAT_MER_NEUTRE,
+  })
   // sans mer construite : le NEUTRE, c'est-à-dire la calotte d'avant P4
-  assert.deepEqual(d.get.call({ materials: [] }), { vue: 1, surface: 1, givre: 0, ciel: null })
+  assert.deepEqual(d.get.call({ materials: [] }),
+    { vue: 1, surface: 1, givre: 0, ciel: null, etat: ETAT_MER_NEUTRE })
   // un givre non fini ne remonte pas
   assert.equal(d.get.call({ materials: [{ uniforms: { uFrost: { value: NaN } } }] }).givre, 0)
+  // ⛔ **ET L'ÉTAT DE MER REMONTE VRAIMENT — la réserve n° 1 de P4, exécutée.**
+  // Les six valeurs sont celles RELEVÉES le 2026-08-22 sur la page vivante.
+  const agite = {
+    materials: [
+      {
+        uniforms: {
+          uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 },
+          uWaveH: { value: 2 }, uChop: { value: 1 }, uFoam: { value: 1.9 },
+          uFoamScale: { value: 1 }, uGloss: { value: 110 }, uSpeedMul: { value: 0.4 },
+        },
+      },
+    ],
+  }
+  assert.deepEqual(d.get.call(agite).etat,
+    { houle: 2, chop: 1, ecume: 1.9, ecumeEchelle: 1, brillance: 110, vitesse: 0.4 })
+  // ⚠️ **ET CHACUN DES SIX SÉPARÉMENT** : un accesseur qui n'en lirait que cinq
+  // rendrait une mer hybride, et un `deepEqual` global ne dirait pas lequel.
+  for (const [nom, champ, valeur] of [
+    ['uWaveH', 'houle', 2], ['uChop', 'chop', 1], ['uFoam', 'ecume', 1.9],
+    ['uFoamScale', 'ecumeEchelle', 1], ['uGloss', 'brillance', 110], ['uSpeedMul', 'vitesse', 0.4],
+  ]) {
+    const un = { materials: [{ uniforms: { [nom]: { value: valeur } } }] }
+    assert.equal(d.get.call(un).etat[champ], valeur, `${nom} n atteint pas ${champ}`)
+  }
+})
+
+// ══════════ ⑬ LE FOND MARIN DU CROP — Tâche P5 ═════════════════════════════
+//
+// ⛔ **LE DÉFAUT NOMMÉ PAR LA TÂCHE P4** : *« le fond marin du crop est EN
+// TERRASSES […] gradins pâles à bords droits »*. Mesuré dans la page vivante
+// (La Réunion z12, `.banc/vues-P5/bilan-P5.json`), il n'y avait **ni terrasse ni
+// quantification de la donnée** : le champ rend **5 303 valeurs distinctes sur
+// 5 449 nœuds d'eau**, et sa PENTE moyenne est celle du MNT du socle à 1-3 %
+// près. Ce qui était faux, ce sont **deux entrées de la loi de couleur** — et
+// aucune des deux n'était calculée : elles étaient POSÉES, à des défauts.
+
+test('⑬a `profondeurMaxDuCrop` mesure le CROP, pas la calotte', () => {
+  // un champ de portée 3 : le crop occupe le tiers central. On creuse le
+  // DEHORS beaucoup plus profond que le dedans — c'est exactement la situation
+  // de La Réunion (calotte à −3 510,49 m, crop à −2 116,27 m).
+  const cote = 13
+  const portee = 3
+  const v = new Float32Array(cote * cote)
+  const n = cote - 1
+  for (let j = 0; j < cote; j++) {
+    for (let i = 0; i < cote; i++) {
+      const qu = ((2 * i) / n - 1) * portee
+      const qv = ((2 * j) / n - 1) * portee
+      v[j * cote + i] = Math.abs(qu) <= 1 && Math.abs(qv) <= 1 ? -2116.27 : -3510.49
+    }
+  }
+  assert.ok(Math.abs(profondeurMaxDuCrop(v, cote, portee) - 2116.27) < 1e-2)
+  // ⚠️ **ET LE TÉMOIN QUI DIT QUE LE TEST DISTINGUE QUELQUE CHOSE** : le maximum
+  // du champ ENTIER, lui, vaut 3 510,49. Sans lui, un `profondeurMaxDuCrop` qui
+  // rendrait bêtement le maximum global passerait la ligne du dessus le jour où
+  // les deux valeurs coïncideraient.
+  let global = 0
+  for (const h of v) if (-h > global) global = -h
+  assert.ok(Math.abs(global - 3510.49) < 1e-2)
+  assert.ok(global / profondeurMaxDuCrop(v, cote, portee) > 1.65,
+    'le dehors doit être NETTEMENT plus profond, sinon le test ne prouve rien')
+})
+
+test('⑬b la borne du crop est la MÊME que celle du nuanceur et d `uvFond`', () => {
+  // ⚠️ Le nœud `i` porte `q = (2 i / (cote − 1) − 1) × portee` — la convention de
+  // `uvFond` (`fond-crop.js`) et de `MER_VERT`. Une seconde convention ici et le
+  // budget serait mesuré ailleurs que là où il sert.
+  const cote = 7
+  const portee = 3
+  const v = new Float32Array(cote * cote).fill(0)
+  // le nœud du CENTRE seul, à −100 m : dedans, donc compté
+  v[3 * cote + 3] = -100
+  assert.equal(profondeurMaxDuCrop(v, cote, portee), 100)
+  // le nœud voisin (q = ±1 exactement) est encore DEDANS (borne inclusive)
+  const w = new Float32Array(cote * cote).fill(0)
+  w[3 * cote + 2] = -50 // q.u = (4/6 − 1) × 3 = −1
+  assert.equal(profondeurMaxDuCrop(w, cote, portee), 50)
+  // celui d'après (q = −2) est DEHORS
+  const y = new Float32Array(cote * cote).fill(0)
+  y[3 * cote + 1] = -50
+  assert.equal(profondeurMaxDuCrop(y, cote, portee), 0)
+})
+
+test('⑬c un champ sans eau, un champ vide ou une portée nulle rendent 0', () => {
+  assert.equal(profondeurMaxDuCrop(new Float32Array(9).fill(120), 3, 1), 0, 'la terre ne compte pas')
+  assert.equal(profondeurMaxDuCrop(null, 3, 1), 0)
+  assert.equal(profondeurMaxDuCrop(new Float32Array(9), 1, 1), 0)
+  assert.equal(profondeurMaxDuCrop(new Float32Array(9), 3, 0), 0)
+})
+
+// le champ qui SÉPARE les deux mesures : creusé au dehors, moins au dedans
+const creuseDehors = (emprise, n, sortie) => {
+  const cote = n + 1
+  for (let j = 0; j < cote; j++) {
+    for (let i = 0; i < cote; i++) {
+      const qu = ((2 * i) / n - 1) * PORTEE_CROP
+      const qv = ((2 * j) / n - 1) * PORTEE_CROP
+      sortie[j * cote + i] = Math.abs(qu) <= 1 && Math.abs(qv) <= 1 ? -2116.27 : -3510.49
+    }
+  }
+  return { remplis: sortie.length }
+}
+
+test('⑬d `poserMer` pose le budget du CROP, jamais celui de la calotte', async () => {
+  // le bouchon des autres tests remplit à −500 m PARTOUT : les deux mesures y
+  // coïncident, et c'est le cas dégénéré. Celui-ci les sépare.
+  const g = globeAvecCrop()
+  const r = await Globe.prototype.poserMer.call(g, { remplir: creuseDehors, portee: PORTEE_CROP })
+  assert.ok(r && !r.refus, `poserMer a refusé : ${r && r.refus}`)
+  // ⛔ **2 116,27 ET NON 3 510,49** : le socle normalise sur SON bloc
+  // (`uSeaRange = −dem.minM`), et l'écart mesuré à La Réunion vaut ×1,658.
+  assert.ok(Math.abs(g.uniforms.uMerFondBudgetM.value - 2116.27) < 1,
+    `budget ${g.uniforms.uMerFondBudgetM.value} : il doit être celui du CROP`)
+  assert.ok(g.uniforms.uMerFondBudgetM.value < 3510,
+    'le budget de la CALOTTE ne doit pas atteindre l uniforme')
+})
+
+test('⑬e un crop SANS eau à l intérieur retombe sur le champ, pas sur zéro', async () => {
+  // ⚠️ **UN BUDGET NUL PEINDRAIT TOUTE LA MER D UN SEUL BLEU** : `d01` saturerait
+  // à 1 partout. Le repli n'est donc pas décoratif.
+  const g = globeAvecCrop()
+  const terreDedans = (emprise, n, sortie) => {
+    const cote = n + 1
+    for (let j = 0; j < cote; j++) {
+      for (let i = 0; i < cote; i++) {
+        const qu = ((2 * i) / n - 1) * PORTEE_CROP
+        const qv = ((2 * j) / n - 1) * PORTEE_CROP
+        sortie[j * cote + i] = Math.abs(qu) <= 1 && Math.abs(qv) <= 1 ? 300 : -3510.49
+      }
+    }
+    return { remplis: sortie.length }
+  }
+  await Globe.prototype.poserMer.call(g, { remplir: terreDedans, portee: PORTEE_CROP })
+  assert.ok(Math.abs(g.uniforms.uMerFondBudgetM.value - 3510.49) < 1,
+    `le repli doit être la profondeur du champ : ${g.uniforms.uMerFondBudgetM.value}`)
+})
+
+test('⑬f `couleursFondDuSocle` LIT les trois couleurs vivantes — jamais un demi-triplet', () => {
+  const peu = { isColor: true, n: 'peu' }
+  const moyen = { isColor: true, n: 'moyen' }
+  const fond = { isColor: true, n: 'fond' }
+  assert.deepEqual(couleursFondDuSocle(peu, moyen, fond), { peu, moyen, fond })
+  // ⚠️ **DEUX SUR TROIS = RIEN.** Deux couleurs du socle et une du défaut
+  // seraient pires que les trois du défaut — le raisonnement du demi-couple
+  // d'accalmies de P4, appliqué à trois.
+  assert.equal(couleursFondDuSocle(peu, moyen, null), null)
+  assert.equal(couleursFondDuSocle(peu, null, fond), null)
+  assert.equal(couleursFondDuSocle(null, moyen, fond), null)
+  assert.equal(couleursFondDuSocle(peu, moyen, {}), null)
+  assert.equal(couleursFondDuSocle(), null)
+  // ⚠️ **ET ELLE NE PREND PAS LA POIGNÉE DES UNIFORMES DU SOCLE** :
+  // `test/damier-uniformes.test.js` ③ l'interdit, et il a attrapé la première
+  // écriture de cette tâche.
+  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
+  assert.ok(!/couleursFondDuSocle\(terrain\.mapUniforms\)/.test(main),
+    'la poignée entière ne doit jamais être cédée')
+  assert.match(main, /couleursFondDuSocle\(\s+terrain\.mapUniforms\.uOceanShallow\.value,\s+terrain\.mapUniforms\.uOceanMid\.value,\s+terrain\.mapUniforms\.uOceanDeep\.value,/)
+})
+
+test('⑬g `majReglagesMer` COPIE les trois couleurs du socle dans les uniformes des TUILES', () => {
+  return merPosee().then(({ g }) => {
+    const u = g.uniforms
+    // le témoin : à la naissance, la calotte porte le DÉFAUT du module
+    assert.equal('#' + u.uOceanShallow.value.getHexString(), RAMPE_NAUTIQUE.peu)
+    const peu = { isColor: true, r: 0.78, g: 0.95, b: 0.89 }
+    const moyen = { isColor: true, r: 0.38, g: 0.81, b: 0.76 }
+    const fond = { isColor: true, r: 0.07, g: 0.43, b: 0.49 }
+    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, fond: { peu, moyen, fond } })
+    assert.equal(pose.fond, true)
+    for (const [uni, src] of [[u.uOceanShallow, peu], [u.uOceanMid, moyen], [u.uOceanDeep, fond]]) {
+      assert.ok(Math.abs(uni.value.r - src.r) < 1e-6, 'canal R')
+      assert.ok(Math.abs(uni.value.g - src.g) < 1e-6, 'canal V')
+      assert.ok(Math.abs(uni.value.b - src.b) < 1e-6, 'canal B')
+      // ⚠️ **COPIÉ, PAS PARTAGÉ** : partager l'objet ferait qu'un `retirerMer`
+      // remettant `RAMPE_NAUTIQUE` REPEINDRAIT la mer du socle.
+      assert.notEqual(uni.value, src)
+    }
+    // ⛔ et un triplet incomplet ne pose RIEN — pas deux couleurs sur trois
+    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1 })
+    assert.ok(Math.abs(u.uOceanShallow.value.r - peu.r) < 1e-6, 'sans fond, on ne touche à rien')
+    const pose2 = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, fond: { peu, moyen } })
+    assert.equal(pose2.fond, false)
+    assert.ok(Math.abs(u.uOceanShallow.value.r - peu.r) < 1e-6, 'un demi-triplet ne pose rien')
+  })
+})
+
+const SIX = [
+  ['houle', 'uMerHoule'], ['chop', 'uMerChop'], ['ecume', 'uMerEcume'],
+  ['ecumeEchelle', 'uMerEcumeEchelle'], ['brillance', 'uMerBrillance'], ['vitesse', 'uMerVitesse'],
+]
+
+test('⑬h `majReglagesMer` pose les SIX réglages d état de mer, un par un', () => {
+  return merPosee().then(({ g, u }) => {
+    // le témoin : à la naissance, la mer porte le NEUTRE, c'est-à-dire la mer
+    // d'avant la Tâche P5, au bit près.
+    for (const [champ, uni] of SIX) assert.equal(u[uni].value, ETAT_MER_NEUTRE[champ], uni)
+    // les valeurs RELEVÉES sur le socle vivant le 2026-08-22
+    const etat = { houle: 2, chop: 1, ecume: 1.9, ecumeEchelle: 1, brillance: 110, vitesse: 0.4 }
+    Globe.prototype.majReglagesMer.call(g, { vue: 0.4039, surface: 0.08, etat })
+    for (const [champ, uni] of SIX) assert.equal(u[uni].value, etat[champ], uni)
+    // ⚠️ **ET CHACUN SÉPARÉMENT, PARCE QU UNE ASSERTION GROUPÉE NE DIT PAS
+    // LEQUEL** : on ne change qu'un champ à la fois, et on vérifie que les cinq
+    // autres n'ont pas bougé. C'est ce qui tue une mutation qui échangerait deux
+    // affectations.
+    for (const [champ, uni] of SIX) {
+      const seul = { ...ETAT_MER_NEUTRE, [champ]: 0.123456 }
+      Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, etat: seul })
+      assert.equal(u[uni].value, 0.123456, `${champ} n atteint pas ${uni}`)
+      for (const [autre, autreUni] of SIX) {
+        if (autre === champ) continue
+        assert.equal(u[autreUni].value, ETAT_MER_NEUTRE[autre], `${champ} a débordé sur ${autreUni}`)
+      }
+    }
+  })
+})
+
+test('⑬i un état de mer INCOMPLET retombe sur le neutre entier, pas sur une mer hybride', () => {
+  return merPosee().then(({ g, u }) => {
+    const bon = { houle: 2, chop: 1, ecume: 1.9, ecumeEchelle: 1, brillance: 110, vitesse: 0.4 }
+    for (const champ of Object.keys(bon)) {
+      const casse = { ...bon, [champ]: NaN }
+      Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, etat: casse })
+      for (const [c, uni] of SIX) {
+        assert.equal(u[uni].value, ETAT_MER_NEUTRE[c], `${champ} NaN doit rendre TOUT le neutre`)
+        // ⚠️ **AUCUN NaN NE PEUT ATTEINDRE UN UNIFORME** : il éteint la moitié
+        // d'un GPU sans un mot (même contrat que `poserEstompage`).
+        assert.ok(Number.isFinite(u[uni].value), `${uni} porte un NaN`)
+      }
+    }
+    for (const mauvais of [null, undefined, {}, 'oui']) {
+      Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, etat: mauvais })
+      assert.equal(u.uMerEcumeEchelle.value, ETAT_MER_NEUTRE.ecumeEchelle)
+    }
+  })
+})
+
+test('⑬j la HOULE porte l accalmie de vue — l expression d `ocean.js`, pas une seconde loi', () => {
+  const src = readFileSync(SRC_GLOBE, 'utf8')
+  const ocean = readFileSync(SRC_OCEAN, 'utf8')
+  // `ocean.js` : oceanGerstner(xz, uTime, uWaveH * uViewCalm, …) au vertex …
+  assert.match(ocean, /oceanGerstner\(xz, uTime, uWaveH \* uViewCalm, uChop, uSpeedMul, uLenScale/)
+  // … et uWaveH BRUT dans shoreSurf.
+  assert.match(ocean, /shoreSurf\(uvF, uField, uTime, uWaveH, uChop, uSpeedMul, uLenScale, uViewCalm/)
+  // la calotte fait le MÊME partage, avec ses propres noms
+  assert.match(src, /oceanGerstner\(vec2\(p\.x, p\.z\), uMerTemps, uMerHoule \* uMerCalmeVue, uMerChop, uMerVitesse, uMerLambda/)
+  assert.match(src, /shoreSurf\(uvF, uMerChamp, uMerTemps, uMerHoule, uMerChop, uMerVitesse, uMerLambda, richesseMer/)
+  // ⚠️ **ET L UNIFORME EST DÉCLARÉ DANS LE VERTEX**, sinon la compilation tombe.
+  const vert = src.slice(src.indexOf('const MER_VERT'), src.indexOf('const MER_FRAG'))
+  assert.match(vert, /uniform float uMerCalmeVue;/)
+  // ⚠️ **UNE SEULE DÉCLARATION** : deux `uniform float uMerCalmeVue` dans le
+  // même nuanceur ne compilent pas, et le banc ne le dirait qu'à l'écran.
+  assert.equal((vert.match(/uniform float uMerCalmeVue;/g) || []).length, 1)
+})
+
+test('⑬k `poserMer` n accepte PLUS les quatre paramètres que personne ne passait', () => {
+  const src = readFileSync(SRC_GLOBE, 'utf8')
+  const i = src.indexOf('async poserMer({')
+  const signature = src.slice(i, src.indexOf('} = {}) {', i))
+  for (const mort of ['couleursFond', 'houle =', 'chop =', 'ecumeEchelle =']) {
+    assert.ok(!signature.includes(mort), `${mort} doit avoir quitté la signature de poserMer`)
+  }
+  // ⚠️ **ET AUCUN APPELANT NE LES PASSAIT — C EST CE QUI RENDAIT LE TROU MUET.**
+  // Le garde reste : si quelqu'un les remettait dans le contexte, il faudrait
+  // décider QUI écrit, et ce test est l'endroit où la question se pose.
+  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
+  const j = main.indexOf('    mer: {')
+  const bloc = main.slice(j, main.indexOf('\n  }\n', j))
+  for (const mort of ['couleursFond', 'houle:', 'chop:', 'ecumeEchelle:']) {
+    assert.ok(!bloc.includes(mort), `contexteCrop().mer ne doit pas porter ${mort}`)
+  }
+})
+
+test('⑬l `retirerMer` rend les trois couleurs au défaut du module', () => {
+  return merPosee().then(({ g }) => {
+    const peu = { isColor: true, r: 0.1, g: 0.2, b: 0.3 }
+    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, fond: { peu, moyen: peu, fond: peu } })
+    assert.ok(Math.abs(g.uniforms.uOceanShallow.value.r - 0.1) < 1e-6)
+    Globe.prototype.retirerMer.call(g)
+    // ⚠️ L'UNIFORME EST PARTAGÉ PAR TOUTES LES TUILES : le laisser sur la
+    // palette du crop repeindrait tous les océans du monde en vue orbitale.
+    assert.equal('#' + g.uniforms.uOceanShallow.value.getHexString(), RAMPE_NAUTIQUE.peu)
+    assert.equal('#' + g.uniforms.uOceanMid.value.getHexString(), RAMPE_NAUTIQUE.moyen)
+    assert.equal('#' + g.uniforms.uOceanDeep.value.getHexString(), RAMPE_NAUTIQUE.fond)
+    assert.equal(g.uniforms.uMerRampeOn.value, 0)
+  })
 })
