6fba7dd tache J, tour 1 : la preuve GPU n en etait pas une, et le trou de la file est couvert

 test/flux-terrain.test.js | 42 ++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 42 insertions(+)

diff --git a/test/flux-terrain.test.js b/test/flux-terrain.test.js
index 05d1de9..1aeb298 100644
--- a/test/flux-terrain.test.js
+++ b/test/flux-terrain.test.js
@@ -1049,20 +1049,62 @@ test('deux appels avec le MÊME `aussi` n annulent rien — c est la garde de la
   // ⚠️ **ET LE TÉMOIN NÉGATIF** : celui qui OUBLIE `aussi` reprend les tuiles de
   // la mer. C'est la raison pour laquelle `main.js` doit le passer aux DEUX
   // appelants — sans ce test, la règle serait un commentaire.
   demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE })
   const perdues = tuilesEmprise(merEmprise, zMer)
     .filter(({ z, x, y }) => !g.gardeHauteurs.has(`${z}/${x}/${y}`))
   assert.ok(perdues.length > 0, 'un appel sans `aussi` DOIT reprendre les tuiles de la mer')
   g.dispose()
 })
 
+test('la mer passe APRÈS le bloc dans la file : `9e8` contre `1e9` — relecture Tâche J, tour 1', async () => {
+  // ⚠️ **TROU DORMANT SIGNALÉ PAR LE RELECTEUR** (`relecture-J.md`, Important
+  // n°2) : retirer `secondes.has(t.key) ? 9e8 : 1e9` au profit de `1e9` partout
+  // (`flux-terrain.js:458`) NE CASSAIT AUCUN TEST. Le commentaire du dépôt est
+  // clair sur l'intention (« le bloc est ce que l'utilisateur regarde ; le fond
+  // marin de la mer lointaine ne doit pas lui passer devant dans la file ») mais
+  // aucune des 20 mutations d'origine ne ciblait cette valeur. Ce test-ci vise
+  // exactement l'argument passé à `_request`, pas un effet indirect sur la file
+  // (`_pump` re-trie de toute façon à chaque tour, donc observer `g.queue` après
+  // coup mesurerait le tri, pas la valeur posée ici).
+  const g = neuf()
+  const flux = creerFlux({ globe: g })
+  const emprise = empriseSocle({ centre: CENTRE })
+  const merEmprise = empriseSocle({ centre: CENTRE, tuilesParBloc: 9 })
+  const zMer = zoomPourEmprise(merEmprise, { zoomMax: ZOOM_SOCLE, tuilesMax: 25 })
+  assert.ok(zMer < ZOOM_SOCLE, `le témoin n a de sens que si le zoom de la mer diffère (z${zMer})`)
+
+  const appels = []
+  const requestOrig = g._request.bind(g)
+  g._request = (t, priority) => {
+    appels.push({ key: t.key, priority })
+    requestOrig(t, priority)
+  }
+
+  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE, aussi: { emprise: merEmprise, zoom: zMer } })
+
+  const duBloc = tuilesEmprise(emprise, ZOOM_SOCLE)
+  const clesDuBloc = new Set(duBloc.map(({ z, x, y }) => `${z}/${x}/${y}`))
+  const deLaMerSeule = tuilesEmprise(merEmprise, zMer)
+    .filter(({ z, x, y }) => !clesDuBloc.has(`${z}/${x}/${y}`))
+  assert.ok(deLaMerSeule.length > 0, 'le témoin a besoin de tuiles de mer qui ne recoupent pas le bloc')
+
+  const parClef = new Map(appels.map((a) => [a.key, a.priority]))
+  for (const { z, x, y } of duBloc) {
+    assert.equal(parClef.get(`${z}/${x}/${y}`), 1e9, `tuile de BLOC ${z}/${x}/${y} doit être demandée à 1e9`)
+  }
+  for (const { z, x, y } of deLaMerSeule) {
+    assert.equal(parClef.get(`${z}/${x}/${y}`), 9e8, `tuile de MER ${z}/${x}/${y} doit être demandée à 9e8, pas 1e9`)
+  }
+  g.dispose()
+})
+
 test('remplirHauteurs DIT si la fusion a eu lieu — sans quoi la mer se croit remplie', async () => {
   // ⚠️ **LE DÉFAUT MUET QUE CE DRAPEAU FERME** : la nappe arrive de façon
   // asynchrone, et `poserMer` ne cuit son champ qu'une fois. Sans un `bathy`
   // honnête, la première cuisson — celle d'avant la nappe — se déclarerait
   // bathymétrique et la mer resterait d'un bleu uniforme pour toujours.
   const g = neuf()
   const flux = creerFlux({ globe: g })
   const emprise = empriseSocle({ centre: CENTRE })
   // aucune nappe demandée : `flux.bathy` est vide
   const sansNappe = remplirHauteurs(flux, { emprise, n: 8 })
