3b332a7 tour de correction groupe : J bis, K, N, P2

 src/monde/veille-repos.js      |  13 +++--
 test/fond-crop.test.js         |  17 ++++++
 test/loi-texture-monde.test.js |  36 +++++++++++++
 test/veille-repos.test.js      | 117 ++++++++++++++++++++++++++++++++++++-----
 4 files changed, 165 insertions(+), 18 deletions(-)

diff --git a/src/monde/veille-repos.js b/src/monde/veille-repos.js
index f566ff2..33dbb58 100644
--- a/src/monde/veille-repos.js
+++ b/src/monde/veille-repos.js
@@ -43,24 +43,29 @@
 // seuil en mètres serait franchi par un frémissement à 3 000 km et jamais par un
 // vrai zoom à 12 km : **un seuil par altitude, c'est-à-dire aucun seuil.**
 //
 // ══════════ 3. LES DEUX NOMBRES, ET D'OÙ ILS VIENNENT ══════════════════════
 //
 // **Relevés le 2026-08-22 dans l'application vivante** (La Réunion,
 // `?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`, 60 Hz,
 // `fov = 33` lu en direct). Données brutes : `.banc/vues-N/AV-trace-*.json`,
 // dépouillement : `.banc/hysterese-N.mjs` → `.banc/vues-N/hysterese-brut.json`.
 //
-//   · **AU REPOS STRICT, L'ÉCART VAUT EXACTEMENT ZÉRO** : 3 216 images de suite
-//     (53 s), `altitudeCadrageM()` bit pour bit identique, caméra immobile au
-//     bit près. **Mais « non nul » n'est PAS un critère utilisable**, et c'est
-//     la mesure qui le dit : après un geste d'orbite, la traîne d'amortissement
+//   · **AU REPOS STRICT, L'ÉCART VAUT EXACTEMENT ZÉRO** — pas mesuré dans
+//     l'application vivante, ÉTABLI PAR CONSTRUCTION : deux altitudes
+//     identiques donnent `ln(1) = 0`. `test/veille-repos.test.js` ③ (« au repos
+//     STRICT ») rejoue ce raisonnement 3 216 fois de suite sur la MÊME constante
+//     (une boucle synthétique, pas un relevé de 53 s à l'écran) — ce qui
+//     prouve que la loi ne dérive pas d'elle-même sur une entrée immobile,
+//     rien de plus. **Mais « non nul » n'est PAS un critère utilisable**, et
+//     c'est la mesure, elle, réellement relevée dans l'application vivante qui
+//     le dit : après un geste d'orbite, la traîne d'amortissement
 //     est ASYMPTOTIQUE — encore `7,7 × 10⁻¹¹` par image **603 images (10 s)
 //     après la fin du geste**, en décroissance géométrique de rapport ≈ 0,970.
 //     Un seuil « strictement positif » laisserait donc les alentours allumés
 //     pour toujours après le moindre geste.
 //   · **LE GESTE DÉLIBÉRÉ LE PLUS DOUX MESURÉ** est une molette : son écart
 //     culmine à `4,67 × 10⁻⁴` par image (et `4,70 × 10⁻⁴` sur la trace
 //     saccadée). ⚠️ **C'est un PLAFOND, pas un plancher** : tout seuil au-dessus
 //     de `4,67 × 10⁻⁴` manque un vrai zoom en entier — vérifié, à `S = 10⁻³` la
 //     trace de molette ne compte **aucune** image au-dessus du seuil.
 //
diff --git a/test/fond-crop.test.js b/test/fond-crop.test.js
index 5f7743b..62facbc 100644
--- a/test/fond-crop.test.js
+++ b/test/fond-crop.test.js
@@ -73,20 +73,37 @@ test('② avec fond, la MER prend le fond et la TERRE garde la tuile', () => {
   assert.equal(altitudeSonde(0, -920.7), -920.7)
   // la frange du terrarium n'échappe pas non plus au champ : UNE autorité
   assert.equal(altitudeMaillage(-288.36328125, -1500), -1500)
 })
 
 test('② bis un champ qui dit « terre » là où la tuile dit « mer » ne fait pas sortir de butte', () => {
   assert.equal(altitudeMaillage(0, 37.5), 0, 'min(hFond, 0) : on reste au niveau de la mer')
   assert.equal(altitudeSonde(-2, 37.5), 0)
 })
 
+test('② ter LA BORNE `h > 0` D’`altitudeMaillage` — un vrai champ de fond, entre 0 et ~100 m', () => {
+  // ⚠️ **TROU DE COUVERTURE TROUVÉ PAR LA RELECTURE J bis (constat groupé ⑦).**
+  // Test ① ne combine `h` proche de zéro qu'à un fond ABSENT (`null`) — la
+  // branche `h > 0` n'y joue aucun rôle, `Math.max(h, 0)` la rend de toute
+  // façon. Test ② ne combine un fond FINI qu'à `h = 1234,5`, très loin de la
+  // frontière. Résultat : élargir `h > 0` en `h > 100` dans
+  // `src/monde/fond-crop.js` survivait à tous les tests d'alors — un défaut de
+  // COUVERTURE, pas un défaut livré : le code de production est juste.
+  for (const h of [0.0007, 12.5, 99.999]) {
+    assert.equal(
+      altitudeMaillage(h, -900), h,
+      `h=${h} avec un fond posé à −900 : la TERRE doit garder la tuile, pas basculer sur le fond`,
+    )
+    assert.equal(altitudeSonde(h, -900), h, `altitudeSonde : même contrat pour h=${h}`)
+  }
+})
+
 // ══════════ ③ LA LECTURE DU CHAMP ═══════════════════════════════════════════
 
 test('③ `uvFond` EST la formule du nuanceur de la mer, mot pour mot', () => {
   // la ligne du dépôt : `vec2 uvF = aCrop / (2.0 * uMerPortee) + 0.5;`
   assert.match(SOURCE_GLOBE, /uvF\s*=\s*aCrop\s*\/\s*\(2\.0\s*\*\s*uMerPortee\)\s*\+\s*0\.5/,
     'si cette ligne change, `uvFond` doit changer avec elle — sinon les deux fonds divergent')
   for (const portee of [1, 3, 7.25]) {
     for (const q of [{ u: 0, v: 0 }, { u: portee, v: -portee }, { u: -portee, v: portee }]) {
       const r = uvFond(q, portee)
       assert.equal(r.u, q.u / (2 * portee) + 0.5)
diff --git a/test/loi-texture-monde.test.js b/test/loi-texture-monde.test.js
index 2c68456..16076cd 100644
--- a/test/loi-texture-monde.test.js
+++ b/test/loi-texture-monde.test.js
@@ -472,20 +472,56 @@ test('⑤f le fov est LU EN DIRECT sur la caméra, jamais écrit en dur', () =>
 test('⑤g la hauteur est celle du TAMPON DE DESSIN, pas du CSS', () => {
   // ⚠️ Sur un écran Retina le tampon fait deux fois la hauteur en points.
   // `clientHeight` doublerait les mètres par pixel et effacerait les courbes de
   // niveau sur les seules machines à forte densité.
   const i = MAIN.indexOf('function majLoiTextureMonde()')
   const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
   assert.ok(/getDrawingBufferSize/.test(corps), 'la hauteur ne vient pas du tampon de dessin')
   assert.ok(!/clientHeight|innerHeight/.test(corps))
 })
 
+test('⑤g bis C’EST LA HAUTEUR DU TAMPON, PAS SA LARGEUR', () => {
+  // ⚠️ **MUTATION SURVIVANTE TROUVÉE PAR LA RELECTURE K, HORS `.banc/mutations-K.mjs`** :
+  // `hauteurPx: _tailleDessin.y` → `_tailleDessin.x` (la LARGEUR) survivait aux
+  // 33/33 tests d'alors, parce qu'aucun ne vérifiait QUEL axe du tampon est lu —
+  // seulement que `getDrawingBufferSize` est appelé (⑤g) et que le CSS ne
+  // l'est pas. Sur un cadre non carré (le cas général), cette mutation
+  // fausserait `mppEcran` d'un facteur largeur/hauteur, silencieusement.
+  const i = MAIN.indexOf('function majLoiTextureMonde()')
+  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
+  assert.ok(
+    /hauteurPx:\s*_tailleDessin\.y\b/.test(corps),
+    `la hauteur ne vient pas de \`_tailleDessin.y\` : ${corps}`,
+  )
+  assert.ok(
+    !/hauteurPx:\s*_tailleDessin\.x\b/.test(corps),
+    'la hauteur lit la LARGEUR du tampon de dessin',
+  )
+})
+
+test('⑤g ter LA LATITUDE DE L’ANCRE EST TRANSMISE, JAMAIS FORCÉE À L’ÉQUATEUR', () => {
+  // ⚠️ **DEUXIÈME MUTATION SURVIVANTE DE LA RELECTURE K** : `lat:
+  // Number.isFinite(ancre?.lat) ? ancre.lat : 0` → `lat: 0` (toujours
+  // l'équateur) survivait aux 33/33 tests d'alors — aucun ne vérifiait que
+  // `ancre.lat` est effectivement lu. Le `cos(lat)` de `resolutionRefM`
+  // deviendrait silencieusement faux à toute latitude non nulle (La Réunion,
+  // −21,115° comprise).
+  const i = MAIN.indexOf('function majLoiTextureMonde()')
+  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
+  assert.ok(
+    /lat:\s*Number\.isFinite\(ancre\?\.lat\)\s*\?\s*ancre\.lat\s*:\s*0/.test(corps),
+    `la latitude n'est pas lue sur l'ancre en direct : ${corps}`,
+  )
+  assert.ok(!/lat:\s*0\s*[,}]/.test(corps.replace(/lat:\s*Number\.isFinite\(ancre\?\.lat\)\s*\?\s*ancre\.lat\s*:\s*0/, '')),
+    'une seconde écriture force la latitude à 0 ailleurs dans le branchement')
+})
+
 test('⑤h HORS DRAPEAU, la loi est RETIRÉE — la production ne bouge pas', () => {
   const i = MAIN.indexOf('function majLoiTextureMonde()')
   const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
   assert.ok(
     /if \(!terreUniqueBranchee\) \{ globe\.retirerLoiMonde\(\); return \}/.test(corps),
     `le garde de drapeau manque ou a changé : ${corps}`
   )
 })
 
 test('⑤i aucun échafaudage de banc n’est resté dans le nuanceur', () => {
diff --git a/test/veille-repos.test.js b/test/veille-repos.test.js
index f91feaa..73eaabe 100644
--- a/test/veille-repos.test.js
+++ b/test/veille-repos.test.js
@@ -226,22 +226,27 @@ test('③ le geste de molette le plus DOUX mesuré réveille bien la vue', () =>
   // trace : à `S = 10⁻³` la molette ne compte AUCUNE image au-dessus du seuil —
   // un vrai zoom passerait pour un repos, et les alentours n'apparaîtraient
   // jamais.
   assert.ok(SEUIL_BOUGE_LOG < PIC_MOLETTE, 'le seuil manque le geste le plus doux mesuré')
   const v = creerVeilleRepos()
   v.maj(ALT_BLOC)
   v.maj(ALT_BLOC * Math.exp(PIC_MOLETTE))
   assert.equal(v.auRepos, false, 'une molette ne réveille pas la vue')
 })
 
-test('③ au repos STRICT, l’écart mesuré vaut zéro et la vue ne bouge pas', () => {
-  // Relevé : 3 216 images de suite, `altitudeCadrageM()` bit pour bit identique.
+test('③ au repos STRICT, l’écart calculé vaut zéro et la vue ne bouge pas', () => {
+  // ⚠️ **BOUCLE SYNTHÉTIQUE, PAS UN RELEVÉ.** 3 216 images de la MÊME altitude
+  // rejouée — ce n'est pas une mesure de 53 s dans l'application vivante (ce
+  // nombre n'existe nulle part dans `.banc/vues-N/*.json`, constat groupé ③).
+  // Ce que ça prouve : `ln(1) = 0` par construction, donc la loi ne dérive pas
+  // d'elle-même sur une entrée immobile — une propriété de la fonction, pas un
+  // fait relevé à l'écran.
   const v = creerVeilleRepos()
   for (let i = 0; i < 3216; i++) v.maj(ALT_BLOC)
   assert.equal(v.dernierEcart, 0)
   assert.equal(v.bascules, 0)
   assert.equal(v.auRepos, true)
 })
 
 // ═══════════════════════════════════════════════════════════════ ④ l'oubli
 
 test('④ `oublier` empêche le résidu orbital de passer pour un mouvement', () => {
@@ -336,144 +341,178 @@ function veilleEstompageFactice() {
     poserMode(v) { etat.modes.push(!!v) },
     poserRepos(v) { etat.repos = v; etat.poses++ },
   }
 }
 
 test('⑥ le repos atteint SES DEUX destinataires, et sur la même image', () => {
   // ⚠️ Séparés, on aurait un dessin sans coût ou un coût sans dessin — les deux
   // moitiés du défaut que la tâche répare.
   const g = globeDePapier()
   const est = veilleEstompageFactice()
-  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
+  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
   veille.maj(ALT_BLOC)
   assert.equal(veille.pose, true, 'le crop n’est pas posé à l’altitude de test')
   assert.equal(veille.repos, true, 'le repos n’est pas relayé')
   assert.equal(g.cropSeul, true, '`poserCropSeul` n’a pas été appelée')
   assert.equal(est.etat.repos, true, '`poserRepos` n’a pas été appelée')
 })
 
 test('⑥ SANS CROP POSÉ, le repos n’est relayé à personne', () => {
   // ⚠️ **CE N'EST PAS UNE PRUDENCE, C'EST LA LOI** : sans découpe, l'estompage
   // plein efface la planète et ne met rien à la place — un écran vide.
   const g = globeDePapier()
   const est = veilleEstompageFactice()
-  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
+  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
   // très au-dessus du seuil de mort : le socle, donc le crop, n'existe pas
   veille.maj(SEUIL_MORT_M * 4)
   assert.equal(veille.pose, false)
   assert.equal(veille.repos, false, 'le repos est relayé sans crop')
   assert.equal(g.cropSeul, null, '`poserCropSeul` appelée sans crop')
   assert.equal(est.etat.repos, null, '`poserRepos` appelée sans crop')
 })
 
 test('⑥ un mouvement RETIRE le crop seul, et le retour au calme le remet', () => {
   const g = globeDePapier()
   const est = veilleEstompageFactice()
-  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
+  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
   veille.maj(ALT_BLOC)
   assert.equal(g.cropSeul, true)
   // un geste : une seule image suffit
   veille.maj(ALT_BLOC * Math.exp(SEUIL_BOUGE_LOG * 3))
   assert.equal(g.cropSeul, false, 'le geste ne rallume pas les alentours')
   assert.equal(veille.basculesRepos, 2)
   const alt = ALT_BLOC * Math.exp(SEUIL_BOUGE_LOG * 3)
   for (let i = 0; i < IMAGES_CALME; i++) veille.maj(alt)
   assert.equal(g.cropSeul, true, 'la vue posée ne recroppe pas')
   assert.equal(veille.basculesRepos, 3)
 })
 
 test('⑥ le relais ne réécrit RIEN tant que l’état ne change pas', () => {
   const g = globeDePapier()
-  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, repos: creerVeilleRepos() })
+  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, repos: creerVeilleRepos() })
   for (let i = 0; i < 200; i++) veille.maj(ALT_BLOC)
   assert.equal(g.posesCropSeul, 1, `${g.posesCropSeul} appels de \`poserCropSeul\` pour un seul état`)
 })
 
 test('⑥ l’ORBITE éteint le crop seul et fait OUBLIER l’altitude de référence', () => {
   const g = globeDePapier()
   const oublis = []
   const repos = creerVeilleRepos()
   const espion = { maj: (a) => repos.maj(a), oublier: () => { oublis.push(1); repos.oublier() } }
-  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, repos: espion })
+  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, repos: espion })
   veille.maj(ALT_BLOC)
   assert.equal(g.cropSeul, true)
   veille.poserMode(false)
   assert.equal(g.cropSeul, false, 'le crop seul survit à l’orbite')
   assert.equal(oublis.length, 1, 'l’orbite ne fait pas oublier la référence')
   // ⚠️ **DANS LES DEUX SENS** : ne l'oublier qu'à l'aller laisserait le retour
   // comparer une altitude de surface au dernier résidu orbital.
   veille.poserMode(true)
   assert.equal(oublis.length, 2, 'le retour en surface ne fait pas oublier la référence')
 })
 
 test('⑥ l’ORBITE ne POLLUE PAS les compteurs de la veille du repos', () => {
   // ⚠️ **CE N'EST PAS UN DÉTAIL DE COMPTABILITÉ.** `veilleRepos.bascules` est
   // l'instrument par lequel on compte le BATTEMENT à l'écran ; nourri du résidu
   // orbital, il compterait des réveils qui n'existent pas et le banc mentirait
   // — la classe d'erreur que le §0 du plan énumère huit fois.
   const g = globeDePapier()
   const repos = creerVeilleRepos()
-  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, repos })
+  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, repos })
   veille.maj(ALT_BLOC)
   const avant = repos.bascules
   veille.poserMode(false)
   // le résidu orbital : `altitudeCadrageM()` y rend n'importe quoi, et il varie
   for (let i = 0; i < 200; i++) veille.maj(ALT_BLOC * (100 + i))
   assert.equal(repos.bascules, avant, `la veille du repos a compté ${repos.bascules - avant} bascules en orbite`)
   assert.equal(repos.dernierEcart, 0, 'la veille du repos a mesuré un écart sur un résidu orbital')
 })
 
 test('⑥ SANS veille de repos, le comportement est celui d’AVANT la tâche', () => {
   // ⚠️ Le patron « on élargit, on ne change pas le défaut » — il existe six fois
   // dans ce dépôt, et c'est la consigne D5 (le mode plat ne bouge pas).
   const g = globeDePapier()
   const est = veilleEstompageFactice()
-  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, estompage: est })
+  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, estompage: est })
   for (let i = 0; i < 100; i++) veille.maj(ALT_BLOC)
   assert.equal(veille.repos, false)
   assert.equal(g.cropSeul, null, '`poserCropSeul` appelée sans veille de repos')
   assert.equal(est.etat.poses, 0, '`poserRepos` appelée sans veille de repos')
 })
 
 test('⑥ le globe est LU à chaque image, jamais figé à la construction', () => {
   // ⚠️ **C'EST LA FORME QUE `main.js` EMPLOIE, ET ELLE A UNE RAISON MESURÉE** :
   // « `globe` EST DONNÉ PAR UNE FONCTION, PAS PAR SA VALEUR. Il est réassigné à
   // la perte de contexte WebGL ; une référence figée survivrait à la
   // réassignation et poserait le crop sur un globe mort, sans une erreur. » Le
   // relais du repos doit suivre la MÊME règle — sinon il parlerait au globe
   // d'avant, ou (si `globe` est la fonction elle-même) à personne.
   //
   // ⚠️ **CETTE MUTATION A SURVÉCU AU PREMIER TOUR DE CAMPAGNE**, et pour une
-  // raison instructive : tous les autres tests passent le globe PAR SA VALEUR,
-  // où `lireGlobe()` et `globe` sont le même objet. La faute était invisible
-  // sous la seule forme que la production n'emploie pas.
+  // raison instructive : à l'époque, tous les autres tests de ce fichier
+  // passaient le globe PAR SA VALEUR, où `lireGlobe()` et `globe` étaient le
+  // même objet — la faute était invisible sous la seule forme que la
+  // production n'emploie pas. ⚠️ **CE N'EST PLUS LE CAS** (relecture P2/N,
+  // constat groupé ⑤) : les huit autres appels à `creerVeilleCrop` de ce
+  // fichier passent désormais eux aussi `globe: () => g`, la forme réelle —
+  // ce test-ci reste le SEUL à faire vivre le globe DEUX FOIS (perte de
+  // contexte WebGL comprise), donc le seul indispensable, mais il n'est plus
+  // le seul rempart : n'importe lequel des neuf peut désormais mordre.
   let vivant = globeDePapier()
   const veille = creerVeilleCrop({ globe: () => vivant, contexte: ctxFactice, repos: creerVeilleRepos() })
   veille.maj(ALT_BLOC)
   assert.equal(vivant.cropSeul, true, 'le relais ne lit pas le globe à travers sa fonction')
   // la perte de contexte : le globe est remplacé, et c'est le NOUVEAU qui doit
   // recevoir la suite
   const mort = vivant
   vivant = globeDePapier()
   veille.poserMode(false)
   veille.poserMode(true)
   veille.maj(ALT_BLOC)
   assert.equal(vivant.cropSeul, true, 'le relais parle encore au globe d’avant')
   assert.equal(mort.posesCropSeul, 1, 'le globe mort a reçu un ordre après sa mort')
 })
 
+test('⑥ bis LA DÉRIVATION DE `lireGlobe` NE FIGE RIEN — structurel, indépendant du test ci-dessus', () => {
+  // ⚠️ **CE TEST NE DÉPEND PAS DE CELUI D'AU-DESSUS.** Le constat groupé ⑤
+  // (`.superpowers/sdd/2026-08-22-globe-studio/constats-groupes.md`) relève
+  // qu'un seul test comportemental gardait « le globe est lu à chaque image » —
+  // fragile au premier refactor de CE test précis. Celui-ci lit le TEXTE de
+  // `creerVeilleCrop` (même patron que `test/loi-texture-monde.test.js` ⑤f/⑤g
+  // pour du code que node ne peut pas exécuter en contexte réel) et interdit
+  // STRUCTURELLEMENT la forme fautive : appeler `globe()` DÈS LA DÉRIVATION
+  // fige sa valeur pour la vie du closure, exactement la faute qui a survécu
+  // au premier tour de mutation avant d'être détectée par la forme réelle.
+  const src = readFileSync(new URL('../src/monde/branchement-crop.js', import.meta.url), 'utf8')
+  const i = src.indexOf('const lireGlobe =')
+  assert.ok(i >= 0, '`lireGlobe` a disparu ou changé de nom dans branchement-crop.js')
+  const ligne = src.slice(i, src.indexOf('\n', i))
+  assert.ok(
+    !/\bglobe\(\)/.test(ligne),
+    `la dérivation appelle \`globe()\` à la construction — la valeur serait figée pour toujours : ${ligne}`,
+  )
+  assert.ok(
+    /typeof globe === 'function' \? globe : \(\) => globe/.test(ligne),
+    `la dérivation a changé de forme, à revérifier : ${ligne}`,
+  )
+  // et les trois points d'usage connus rappellent bien `lireGlobe()` — pas une
+  // variable qui l'aurait mis en cache entre-temps
+  const appels = src.match(/lireGlobe\(\)/g) || []
+  assert.ok(appels.length >= 3, `\`lireGlobe()\` n'est rappelé que ${appels.length} fois dans le fichier`)
+})
+
 test('⑥ un globe SANS `poserCropSeul` n’est pas une panne', () => {
   // Même contrat que `poserFondCrop` (Tâche J bis) : ce module se vérifie sous
   // node contre un globe de papier, qui ne porte que ce qu'il exerce.
   const g = globeDePapier()
   delete g.poserCropSeul
-  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, repos: creerVeilleRepos() })
+  const veille = creerVeilleCrop({ globe: () => g, contexte: ctxFactice, repos: creerVeilleRepos() })
   assert.doesNotThrow(() => veille.maj(ALT_BLOC))
   assert.equal(veille.repos, true)
 })
 
 // ═══════════════════════════════════════════════════════════════ ⑦ le globe
 //
 // ⚠️ **SUR UN VRAI QUADTREE, PAS SUR UNE MAQUETTE.** Le harnais est celui de
 // `test/globe-eviction.test.js` : un DOM bouché, un réseau qui COMPTE, et une
 // caméra complète (sans `projectionMatrix`, le tri spatial n'a rien à trier et
 // le parcours mesuré serait l'ancien).
@@ -513,21 +552,21 @@ function servir() {
   globalThis.fetch = async (url) => {
     urls.add(url)
     await new Promise((r) => setTimeout(r, 0))
     return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
   }
 }
 
 const { Globe, _resetTileMemo } = await import('../src/globe.js')
 const { latLonToSphere, R_GLOBE } = await import('../src/geo.js')
 const { _resetDemSource } = await import('../src/dem-source.js')
-const { tuileDansCrop } = await import('../src/monde/crop-sphere.js')
+const { tuileDansCrop, zoomCropPrescrit } = await import('../src/monde/crop-sphere.js')
 
 const LAT = -21.115
 const LON = 55.53
 // ⚠️ **LE `fov` EST UNE ENTRÉE, ET LE DÉPÔT L'A PAYÉ DEUX FOIS.** Le code dit
 // 30, l'application vivante tourne à 33 (relevé à la console le 2026-08-22 :
 // `camera.fov = 33`, `camGlobe.fov = 33`). Ici c'est un harnais, pas une loi :
 // on prend le défaut, et rien dans la tâche n'en dérive un seuil.
 const FOV = 30
 
 function poserCamera(camera, rayon) {
@@ -640,20 +679,70 @@ test('⑦ un quart au BORD n’attend pas les enfants qu’il ne créera jamais'
   let bord = null
   for (const t of globe.tiles.values()) {
     if (globe._horsCropSeul(t.z, t.x, t.y)) continue
     const enfants = globe._children(t)
     if (enfants.length > 0 && enfants.length < 4) { bord = { t, enfants } ; break }
   }
   assert.ok(bord, 'le harnais ne produit aucun quart à cheval sur le bord du crop')
   assert.equal(globe._enfantsPresents(bord.t), true, 'le quart attend des enfants qui ne naîtront pas')
 })
 
+test('⑦ MI-CHARGEMENT : UN SEUL enfant manquant sur quatre garde le parent dessiné (règle sans-trou)', async () => {
+  // ⚠️ **CE QUE CE TEST MORD, ET RIEN D'AUTRE NE LE MORDAIT** : `_traverse`
+  // ne descend que si `kids.every((k) => k.state === 'ready' && k.mesh)` — LES
+  // QUATRE, PAS « AU MOINS UN ». Une mutation en `kids.some(...)` passait les
+  // 181 tests de ce fichier ET des cinq autres qui touchent `_traverse`, parce
+  // qu'aucun d'eux n'inspecte l'état à MI-CHARGEMENT (avant que `calme()` n'ait
+  // laissé le réseau tout terminer) : ils comparent tous un état de REPOS à un
+  // autre état de REPOS, jamais l'instant où 1 à 3 enfants sur 4 sont prêts.
+  // C'est justement l'instant où `every` et `some` divergent : sous `some`, le
+  // parent se raffine (`t.refined = true`, il ARRÊTE de se dessiner) alors que
+  // l'enfant manquant, encore `state !== 'ready'`, ne dessine rien non plus —
+  // une encoche d'exactement une tuile s'ouvre dans le crop, précisément ce que
+  // le commentaire du code invoque pour justifier le retrait du `kids.length >
+  // 0 &&` voisin.
+  const { globe, camera } = await globeAuBloc({ cropSeulDesLeDepart: true })
+  let cible = null
+  for (const t of globe.tiles.values()) {
+    if (globe._horsCropSeul(t.z, t.x, t.y)) continue
+    if (t.state !== 'ready' || !t.mesh) continue
+    const zCrop = zoomCropPrescrit(t.z, t.x, t.y, globe._crop)
+    if (!zCrop || t.z >= zCrop) continue
+    const enfants = globe._children(t)
+    if (enfants.length === 4) { cible = { t, enfants }; break }
+  }
+  assert.ok(cible, 'le harnais ne produit aucune tuile candidate sous le zoom prescrit du crop')
+  const { t, enfants } = cible
+
+  // trois enfants prêts, LE QUATRIÈME ENCORE EN CHARGEMENT — l'état de
+  // mi-chargement exact que `every` distingue de `some`.
+  for (let i = 0; i < 3; i++) {
+    enfants[i].state = 'ready'
+    enfants[i].mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
+  }
+  enfants[3].state = 'loading'
+  enfants[3].mesh = null
+  t.refined = false
+  t.mesh.visible = false // simule : pas encore redessiné à cette image
+
+  const camPos = camera.position
+  const camDir = camPos.clone().normalize()
+  globe._traverse(t, camPos, camDir)
+
+  assert.equal(t.refined, false, 'un enfant manquant ne doit pas déclencher le raffinement du parent')
+  assert.equal(
+    t.mesh.visible, true,
+    'le parent doit rester dessiné tant que les 4 enfants ne sont pas TOUS prêts — sinon la tuile ' +
+      'manquante ouvre un trou d’une tuile dans le crop',
+  )
+})
+
 test('⑦ APRÈS : plus une seule URL hors crop n’est demandée', async () => {
   // ⚠️ **C'EST L'EXIGENCE DURE — « pas dessinés, pas maillés, pas chargés ».**
   // Sans le filtrage dans `_children`, la règle sans-trou continuerait de
   // demander les enfants hors crop de chaque quart qui chevauche le bord.
   //
   // ⚠️ **CE QUI EST DÉJÀ EN CACHE Y RESTE, ET C'EST VOULU** — c'est ce qui rend
   // la transition gratuite (test suivant). Ce qu'on garde ici, c'est qu'il n'en
   // NAÎT plus une seule.
   const { globe, camera } = await globeAuBloc()
   globe.poserCropSeul(true)
