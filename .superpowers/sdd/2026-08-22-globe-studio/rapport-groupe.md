# Rapport — TOUR DE CORRECTION GROUPÉ (J bis · K · N · P2)

**Statut : LIVRÉ.** Commit **`3b332a7`** sur `regroupement` (arbre propre après commit),
HEAD avant ce tour `0700848` (tâche P3).
`npm test` — **3 910 / 3 910** (3 905 au départ, **+5**) · `npm run audit:tests` — **208 / 208**
(inchangé, aucun fichier de test ajouté) · `node --check` propre sur les quatre fichiers
touchés · arbre `git status --short` limité aux quatre fichiers modifiés · page chargée
vérifiée drapeau **levé** ET **baissé** (`hasExp`, `terrain.mesh`, `globe` tous présents,
`uCropOn` observé à 1 sous le drapeau, 0 erreur applicative en console).

**Fichiers modifiés (suivis par git) :**
- `src/monde/veille-repos.js` — requalification d'un commentaire (point ③)
- `test/veille-repos.test.js` — points ③④⑤
- `test/loi-texture-monde.test.js` — point ⑥
- `test/fond-crop.test.js` — point ⑦

**Fichiers de preuve, hors dépôt (`.banc/`, gitignoré)** :
`.banc/vues-P3/GARANTIE-SOCLE-REJOUEE.json`, `AVANT-P3{,-B}-socle.png`,
`APRES-P3{,-B}-socle.png` (point ②).

**Rapports narratifs corrigés (`.superpowers/sdd/`, gitignoré, hors commit)** :
`rapport-P2.md` (point ①), `rapport-P3.md` (point ②), `progress.md` (annotation point ①).

---

## ① ⛔ CRITIQUE — P2, chiffre-titre non traçable → **TRAITÉ**

`.banc/vues-P2/cadrage-apparie.json` confirmé : **5 essais** (pas 10), `cropPixelsBloc:
251258`, et pour k = 1,266 le fichier calcule lui-même `ecartPct: -0.05`. Le rapport
publiait `-0,009 %` en substituant silencieusement `bilan-final-P2.json`
(`fractionBloc.changes: 251157`, une mesure séparée ~15 min plus tard) comme référence.

**Corrigé dans `rapport-P2.md` §1** : la ligne du tableau (k = 1,266) et la phrase de
conclusion portent maintenant **0,05 %**, « vingt fois mieux que le 1 % demandé » (au lieu
de « cent fois »), « cinq essais consignés » (au lieu de dix), avec un encart signé qui
explique la substitution trouvée par la relecture. La seconde mention (§0, « même fraction
de cadre ») est alignée. `progress.md` porte une annotation similaire à l'endroit où le
chiffre d'origine était journalisé, sans réécrire l'historique. La conclusion de fond
(cadrages appariés très en dessous de la barre de 1 %) est explicitement confirmée
intacte.

## ② ⛔ CRITIQUE DE FAIT — garantie « socle bit-identique » non rejouée après P3 → **TRAITÉ**

Rejouée en conditions réelles (dev server + navigateur, `window.__exp`, harnais
`.banc/harnais-P3.mjs`), caméra figée identique à `cadrage-apparie.json`, socle seul,
1280×800, cible à profondeur — même protocole que P2 §6, étendu aux deux endroits que P3 a
touchés dans `src/terrain.js` (extraction `fxShade`→`natOmbrePeinture`/`GLSL_OMBRE_PEINTURE`
+`GLSL_MELANGE`, et la valeur par sommet →`natGris`).

**Constat, chiffré** : ce n'est **plus** le 0 pixel / 1 024 000 de P2 — même le même code,
chargé deux fois (page fraîche, jamais de HMR), ne rend plus une image strictement
identique (bruit de fond ~2,2 % des pixels, amplitude moyenne ~2/255). Mais ce bruit existe
**déjà sur l'ancien `terrain.js`** (AVANT vs AVANT-B : 22 318 px) — il n'est donc pas causé
par cette tâche. La moyenne des quatre paires à code DIFFÉRENT (21 306 px, amplitude 2,62)
n'est **pas plus grande** que la moyenne des deux paires à code IDENTIQUE (22 821 px,
amplitude 2,36) — légèrement plus basse, même. **Conclusion : le socle n'a pas mesurablement
bougé sous l'effet des deux retouches de P3** ; la différence AVANT/APRÈS se confond avec le
bruit de chargement à chargement, préexistant. Vérifié aussi à l'œil (captures PNG
indiscernables). Documenté avec le protocole complet et les six paires de chiffres dans
`rapport-P3.md` §6 et `.banc/vues-P3/GARANTIE-SOCLE-REJOUEE.json`.

## ③ ⚠️ N — nature de preuve surdéclarée (« 3 216 images, 53 s ») → **TRAITÉ**

Confirmé : le nombre 3216 n'existe dans aucune trace de `.banc/vues-N/`. C'est
`test/veille-repos.test.js` (le test « au repos STRICT ») qui rejoue 3216 fois la MÊME
altitude constante — une boucle synthétique prouvant `ln(1) = 0` par construction, pas un
relevé de 53 s dans l'application vivante. Requalifié aux trois endroits où l'affirmation
vivait : le commentaire de `src/monde/veille-repos.js` §3 (ne prétend plus à un relevé),
le titre et le commentaire du test dans `test/veille-repos.test.js`, et le tableau de
`rapport-N.md` (ligne retirée du tableau des mesures, remplacée par un encart explicatif).
La propriété qualitative elle-même reste vraie et n'a besoin d'aucune mesure.

## ④ ⚠️ N — `kids.every` → `kids.some` survit dans `_traverse` → **TRAITÉ**

Nouveau test dans `test/veille-repos.test.js` (« MI-CHARGEMENT : UN SEUL enfant manquant
sur quatre garde le parent dessiné »armé sur un vrai quadtree via `globeAuBloc()`) : trouve
une tuile sous le zoom prescrit du crop avec ses 4 enfants réels, force 3 enfants `ready` et
UN SEUL `loading`, appelle `_traverse` directement, et exige que le parent reste dessiné
(`t.refined === false`, `t.mesh.visible === true`). **Vérifié expérimentalement** : la
mutation `kids.every` → `kids.some` fait échouer ce test précis (`t.refined` passe à `true`,
le parent cesse d'être dessiné) ; reverti immédiatement après vérification, `git diff
--stat src/globe.js` vide.

## ⑤ ⚠️ N — correction « globe par valeur vs par fonction » fragile à un seul test → **TRAITÉ**

Deux mesures complémentaires :
1. Les huit autres appels à `creerVeilleCrop` de `test/veille-repos.test.js` sont passés de
   `globe: g` (valeur) à `globe: () => g` (fonction), la forme réelle de production —
   cosmétique pour ces tests-là (`g` n'y est jamais réassigné) mais aligne le texte sur la
   production.
2. **Ce qui protège vraiment** : un nouveau test structurel indépendant
   (« LA DÉRIVATION DE `lireGlobe` NE FIGE RIEN — indépendant du test ci-dessus ») qui lit
   le TEXTE de `src/monde/branchement-crop.js` et interdit que la dérivation de `lireGlobe`
   appelle `globe()` à la construction — exactement la faute qui fige la valeur pour la vie
   du closure. **Vérifié expérimentalement** : une mutation qui cache le résultat de
   `globe()` à la construction (`const _gCache = ...; const lireGlobe = () => _gCache`) fait
   échouer CE nouveau test — et lui seul continue de mordre même si le test comportemental
   historique (« le globe est lu à chaque image ») disparaissait dans un futur refactor,
   puisqu'il ne dépend d'aucune réassignation de `g` en cours de test. Reverti après
   vérification, `git diff --stat src/monde/branchement-crop.js` vide.

## ⑥ ⚠️ K — deux mutations survivantes (tampon largeur/hauteur, latitude forcée) → **TRAITÉ**

Deux nouveaux tests texte-sur-`main.js` dans `test/loi-texture-monde.test.js`
(« ⑤g bis », « ⑤g ter »), même patron que les tests ⑤f/⑤g existants (le fichier ne peut
pas exécuter `main.js`, §0 du plan) : l'un exige `hauteurPx: _tailleDessin.y` et interdit
`.x`, l'autre exige `lat: Number.isFinite(ancre?.lat) ? ancre.lat : 0` et interdit un `lat:
0` en dur ailleurs dans le branchement. **Vérifié expérimentalement** contre les deux
mutations exactes nommées par la relecture K (`_tailleDessin.y`→`.x` et
`Number.isFinite(...)`→`0`) : les deux font échouer le test correspondant. Revertis après
vérification, `git diff --stat src/main.js` vide.

## ⑦ ⚠️ J bis — borne `h > 0` d'`altitudeMaillage` non couverte entre 0 et ~100 m → **TRAITÉ**

Nouveau test dans `test/fond-crop.test.js` (« ② ter ») : `altitudeMaillage`/`altitudeSonde`
avec `h ∈ {0,0007 ; 12,5 ; 99,999}` et un fond fini (`hFond = -900`), exigeant que la TERRE
garde la valeur de la tuile (pas le fond). **Vérifié expérimentalement** : la mutation
`h > 0` → `h > 100` dans `src/monde/fond-crop.js:89` fait échouer ce test (h = 0,0007
retombe sur le fond au lieu de la tuile). Revertie après vérification, `git diff --stat
src/monde/fond-crop.js` vide. Confirmé au passage : le code de production reste juste, ce
n'était qu'un trou de couverture.

---

## Méthode de vérification, pour les cinq points de couverture (④⑤⑥⑦ + partiellement ①③)

Pour chaque nouveau test destiné à fermer une mutation survivante nommée par une relecture,
la mutation exacte a été **réappliquée sur le disque, le test rejoué pour confirmer l'échec,
puis la mutation revertie et `git diff --stat` vérifié vide** avant de passer au point
suivant. Ceci a été fait un point à la fois, jamais en lot, pour ne jamais laisser un état
mutant non revenu entre deux vérifications.

## Ce qui n'a pas été traité (hors périmètre, par consigne explicite)

Les mineurs de toutes les relectures d'origine (J, Jbis, K, N, P2) et les manques n° 3 à 5
du noteur (écume, nappe de mer désaccordée, jupes pendantes, ombre portée absente) —
consignes du brief : ce sont des tâches à part entière, pas des corrections de ce tour.

## Aucun constat réfuté

Les sept points du tour ont tous été confirmés exacts par la relecture d'origine et traités
comme tels — aucune contestation à faire valoir sur ce lot.
