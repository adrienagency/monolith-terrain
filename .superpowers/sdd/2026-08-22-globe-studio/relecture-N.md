# Relecture — Tâche N : LE CROP SEUL

**Diff jugé** : `9d6f8fd..62c05fc` (commit unique, arbre propre). **CRLF** : `git diff --stat`
et `git diff --ignore-cr-at-eol --stat` rendent EXACTEMENT les mêmes chiffres sur ce diff —
aucun gonflement, pas de faux positif à corriger.

**Isolement** : travaillé dans trois worktrees dédiés, tous retirés en fin de relecture —
`C:/Dev/wt-relecN`, `C:/Dev/wt-relecN-mut`, `C:/Dev/wt-relecN-checks` (tous pinnés sur
`62c05fc`, `node_modules` lié par jonction NTFS vers `wt-merge`, jamais copié). Aucune source
modifiée dans `C:\Dev\wt-merge` ; les trois worktrees étaient à `git status` propre avant
retrait. Trois sous-agents ont travaillé en parallèle (hystérésis/chiffres, campagne de
mutation, captures/loi d'estompage/casse neuve), chacun contraint par la même règle
d'isolement ; j'ai revérifié une partie de leurs trouvailles moi-même (chiffres bruts,
invariant de pavage des tuiles, images, mutations sur le branchement).

---

## Verdict global

**Le travail est bon, et rare dans sa rigueur.** Le chiffre qui fonde la tâche est vérifié au
bit près depuis les JSON bruts (pas de mélange de dénominateurs). L'hystérésis est mesurée,
motivée, et sa constante-clé (`SEUIL_BOUGE_LOG`) est correctement bornée par les deux mesures
qui la contraignent. La campagne de mutation est réelle (25 mutations, 3 tours, journaux sur
disque qui correspondent exactement au récit du rapport) et les deux code-morts retirés sont
vérifiés morts par moi indépendamment (test de pavage sur 200 000 tirages aléatoires : 0
violation). Les aveux du rapport (mer/bloc désaccordés, liseré de côte, parois nues, gain qui
rétrécit au cran) sont fidèles aux captures, pas embellis — je les ai regardées moi-même.

Deux réserves m'empêchent de signer un CONFORMITÉ sans réserve : un chiffre du rapport
(« 3 216 images, écart exactement nul, 53 s ») est présenté comme un relevé de l'application
vivante alors qu'aucune trace de cette longueur n'existe sur le disque — c'est une boucle de
test synthétique qui rejoue 3216 fois la même constante, pas une mesure ; et ma propre chasse
aux mutations sur le branchement/traversal a trouvé une survivante réelle et reproductible
(`kids.every` → `kids.some` dans la règle sans-trou de `_traverse`), confirmée par moi sur 181
tests au total. Ni l'un ni l'autre ne remet en cause le mécanisme livré — le premier est un
défaut de preuve, le second un trou de couverture préexistant que la tâche n'a pas créé mais
que sa propre campagne aurait dû trouver puisqu'elle vise explicitement cette ligne.

**CONFORMITÉ ✅ avec réserves** — les deux points Importants ci-dessous méritent un correctif
avant de considérer le dossier totalement clos, mais aucun des deux n'est un défaut du
mécanisme livré ni une régression cachée.

## Décompte par gravité

- **Critique : 0**
- **Important : 3**
- **Mineur : 5**

---

## ① Le chiffre qui fonde la tâche — CONFORME, revérifié depuis les JSON bruts

Refait à la main, indépendamment du rapport, depuis `.banc/vues-N/AV-repos-bloc.json` et
`AP-repos-bloc.json` :

| | tout | dont hors crop |
|---|---:|---:|
| AVANT — dessinées | 351 | 315 |
| APRÈS — dessinées | 36 | 0 |
| AVANT — parcourues (`_visites`) | 688 | — |
| APRÈS — parcourues | 60 | — |

Tout correspond au bit près. L'A/B apparié à 26 594 m (`AV-apparie-26km.json` /
`AP-repos-26km.json`) partage la MÊME altitude au dix-millième près et la MÊME signature de
lieu (`-21.207458730482653|55.810546875|11|3`) — c'est une vraie paire caméra-figée, pas deux
prises indépendantes : 326→144 dessinées, 182→0 hors crop, 652→202 parcourues, 681→490 en
cache. **Pas de mélange de dénominateurs** : « dessinée » = `mesh.visible` (appel de dessin
soumis) dans les deux colonnes, jamais confondu avec « parcourue » (`_visites`, une monnaie
différente et documentée comme telle par le rapport lui-même).

Le chiffre du cran z10 (« le crop fait 576 tuiles, la station AVANT en dessinait 746, gain ~
un quart ») est également sourcé — pas dans un fichier dédié comme je m'y attendais, mais dans
`AP-film-transition.json`, où `drawn` vaut exactement 746 sur les 7 images `repos:false` qui
suivent la sortie du repos à ce cran, puis se stabilise à 576. Gain réel : 1 − 576/746 = 22,8 %,
et « environ un quart » est un arrondi honnête, pas gonflé.

## ② L'hystérésis — CONFORME sur presque tous les chiffres, UN chiffre sans source vérifiable

Recalculé indépendamment (par un sous-agent, sur les traces `.banc/vues-N/AV-trace-*.json`,
méthode identique bit à bit à `veille-repos.js`) :

| chiffre | rapport | recalculé |
|---|---|---|
| pic orbite | 2,22×10⁻² | 0,022214692928630937 — exact |
| rapport de décroissance | ≈0,970 | 0,96999 mesuré, 0,9704 utilisé dans les tests |
| traîne après 603 images | 7,7×10⁻¹¹ | 7,28×10⁻¹¹ (écart ≈5 %, ordre de grandeur confirmé) |
| pic molette | 4,67×10⁻⁴ | 0,0004673510453424828 — exact |
| images au-dessus du seuil (molette, 1e-4=1e-5=1e-6=1e-8) | 48 | 48/48/48/48 — exact |
| zéro image au-dessus à 10⁻³ | confirmé | confirmé |
| trous saccadés 1900 ms / 1666 ms | confirmés | 114 et 100 images exactement (1900 ms / 1666,7 ms) |
| « onze bascules » (citation) | présente dans `main.js` | trouvée aux lignes 4610, 4705, 4765 |
| bascule aller/retour du dézoom filmé | 1 + 1 | exactement 2 transitions, aux index 193 et 269 sur 1663 images (le rapport dit 1664, écart d'une unité, non significatif) |
| transition 1346 ms | confirmé | 1345,9 ms |

**⚠️ Important — « au repos strict, 3 216 images d'écart exactement nul (53 s) » n'a pas de
source vérifiable.** Le nombre 3216 n'apparaît NULLE PART dans `.banc/vues-N/*.json` (recherche
faite sur tous les fichiers, y compris `hysterese-brut.json` où la trace d'orbite ne compte que
2958 images). Le seul endroit où il existe est `test/veille-repos.test.js:239`, une boucle
synthétique (`for (let i = 0; i < 3216; i++) v.maj(ALT_BLOC)`) qui rejoue 3216 fois la MÊME
altitude — ce qui prouve trivialement que `ln(1) = 0`, pas un relevé de 53 secondes dans
l'application. Or le commentaire de `veille-repos.js` §3 ET le rapport présentent tous deux ce
chiffre comme un « Relevé le 2026-08-22 dans l'application vivante ». C'est exactement le
défaut endémique que le §0 du plan documente : un chiffre présenté comme mesuré qui ne l'est
pas. La propriété qualitative sous-jacente est correcte et n'a pas besoin d'être mesurée
(deux altitudes identiques donnent un log nul, par construction) — mais le present ne devrait
pas revendiquer une mesure là où il y a un raisonnement.

Le script `.banc/hysterese-N.mjs` existe bien sur le disque (n'a pas disparu), et sa formule
est identique à la production — pas de biais de méthode détecté. Petit gap d'outillage
signalé par un des sous-agents : ce script ne recalcule pas lui-même les deux trous de 1900/1666
ms (il ne garde que le plus long palier) ; le chiffre est réel (revérifié à la main sur la
trace brute) mais pas reproductible tel quel par l'outil committé — Mineur.

## ③ La campagne de mutation — REJOUÉE, code mort confirmé mort, UNE survivante réelle trouvée

Les trois journaux sur disque (`mutations-N-{brut,tour2,tour3}.txt`) correspondent exactement
au récit du rapport : 19/24 → 24/25 → 25/25, les mêmes numéros de mutation survivent puis
meurent aux mêmes tours, et les deux mutations retirées (garde `kids.length > 0` et garde
`modeSurface &&`) disparaissent bien de la liste au lieu d'être « testées à vide ». Décompte
16 mutations sur le branchement / 9 sur le cœur (globe.js, veille-repos.js) confirmé
(①-⑮+⑬b = 16, ⑯-㉔ = 9).

**Les deux code-morts sont vérifiés morts, indépendamment du raisonnement écrit à côté :**
- `modeSurface &&` dans `appliquerRepos` : confirmé par lecture du contrôle de flux —
  `pose` ne peut être vrai que si `modeSurface` l'était au moment où `decider()` l'a posé, et
  tout passage de `modeSurface` à faux force `pose` à faux avant qu'`appliquerRepos` ne
  s'exécute. `cropAuDepart`/`modeSurfaceAuDepart` (les seuls paramètres qui pourraient créer
  un état initial contradictoire) ne sont jamais passés en dehors de leurs défauts, ni par
  `main.js`, ni par aucun test — le cas mort est mort dans TOUT l'usage actuel du dépôt
  (Mineur : c'est un angle mort théorique de l'API, pas un défaut vivant).
- `kids.length > 0 &&` dans `_traverse` : confirmé par un test de pavage que j'ai fait tourner
  moi-même — 200 000 tirages aléatoires de crop et de tuile, jamais un parent qui recoupe le
  crop sans qu'au moins un enfant le recoupe (0 violation sur 3 249 cas pertinents). Le
  raisonnement écrit dans le code (intersection d'intervalles + pavage exact des 4 enfants)
  est correct.

**Ma propre chasse, trois mutations visant le branchement (`branchement-crop.js`), toutes
tuées** :
1. Inverser l'ordre `decider()` / `appliquerRepos()` dans `maj()` → **TUÉE** (5 tests cassent,
   messages précis).
2. Retirer `estompage?.poserRepos(voulu)` en gardant `g?.poserCropSeul?.(voulu)` (un seul des
   deux destinataires) → **TUÉE** (assertion dédiée au double destinataire).
3. `pose && auRepos` → `pose || auRepos` → **TUÉE** (le test « le globe est LU à chaque image »
   détecte l'incohérence en aval).

Le sous-agent dédié à la campagne a testé sept autres mutations sur ce même fichier (ordre
d'écriture dans `poserMode`, gardes de changement inversées, oubli de référence, etc.) — toutes
tuées également.

**⚠️ Important — une survivante réelle, trouvée en élargissant la chasse à `_traverse` (règle
sans-trou), confirmée par moi indépendamment.** `kids.every((k) => k.state === 'ready' &&
k.mesh)` → `kids.some(...)` (globe.js:4157) survit aux 36 tests de `veille-repos.test.js` ET
aux 145 tests des fichiers `globe-eviction`, `globe-reseau`, `globe-precision`,
`globe-profondeur`, `globe-source`, `exageration-globe`, `crop-branche`, `crop-sphere` — je l'ai
vérifié moi-même sur les deux ensembles. Cette ligne gouverne littéralement la garantie « pas
de trou » que le commentaire du diff invoque pour justifier le retrait de la garde
`kids.length > 0` (« ce qui garde réellement l'absence de trou est l'assertion d'ensemble » —
or cette assertion ne s'exécute qu'après `calme()`, un idle réseau complet, donc jamais pendant
l'état transitoire « 1 à 3 enfants sur 4 prêts » que `every` vs `some` distingue). **Cette ligne
n'est PAS touchée par le diff N** (contexte inchangé, visible telle quelle avant et après) —
ce n'est donc pas une régression introduite par cette tâche, mais un trou de couverture
préexistant sur une invariant que Tâche N s'appuie explicitement dessus pour justifier une de
ses suppressions de code. Mérite un test dédié qui inspecte l'état à mi-chargement (avant
`calme()`), hors du périmètre strict de N mais découvert par sa propre méthode.

**Vérification « globe passé par valeur vs par fonction »** : sur 9 appels à
`creerVeilleCrop(` dans `test/veille-repos.test.js`, **8 passent `globe: g` (objet direct)** et
**1 seul passe `globe: () => vivant` (fonction)** — le test dédié à la ligne 450. Reproduit :
une mutation qui fige `lireGlobe` à la construction (au lieu de relire `globe` à chaque appel)
casse EXACTEMENT ce test et aucun autre sur les 36. La correction fonctionne — mais c'est une
couverture à point unique : rien n'empêche qu'un futur refactor de ce test précis (copier-coller
vers la forme objet, suppression) fasse disparaître silencieusement toute détection de cette
classe de régression. **Mineur** — le défaut trouvé est corrigé et gardé, mais pas rendu
structurellement robuste au-delà de ce point.

## ④ Ce qui est déclaré non fait — fidèle, pas minimisé

- **Mer/bloc désaccordés, débordement en porte-à-faux** : confirmé à l'œil sur
  `AP-repos-26km.png` (le plan d'eau bleu déborde nettement à droite et à l'arrière, au-delà
  des parois grises) et `AP-repos-apres-dezoom.png` (deux arêtes distinctes sur le flanc
  gauche). Ce n'est pas inventé, et le rapport a raison de dire que c'est maintenant LE premier
  défaut visible du bloc au repos, puisque la Terre autour ne le masque plus.
- **Cache non débordant (« pas eu besoin d'être protégé »)** : le raisonnement est correct et
  vérifiable dans le code (`_evict` n'est appelée qu'au-delà de `cacheMax`), et la réserve
  « non mesuré sur un crop continental » est écrite honnêtement, pas cachée.
- **Gain qui rétrécit au cran (z10, ~un quart)** : vérifié ①, chiffre réel et correctement
  arrondi.
- **Habillage non porté (parois nues, liseré énorme)** : confirmé à l'œil sur les quatre
  captures — parois blanc-gris uniformes sans texture, anneau de côte disproportionné, losanges
  et coutures visibles pendant la transition.

**Une nuance mineure relevée sur une seule légende** : pour `AP-transition-i20.png`, le rapport
dit « les alentours sont bien revenus — l'océan, la côte au loin, les losanges de tuiles ». À
l'image, le pavage en losanges pâles n'occupe que les coins haut-gauche/haut-droit ; le reste du
cadre est dominé par la nappe bleue du crop lui-même. Ce n'est pas une description fausse (les
alentours SONT visibles), mais elle est un peu plus généreuse que l'image ne le montre au
premier coup d'œil. **Mineur.**

## ⑤ La loi d'estompage (Tâche G) — INTACTE, vérifié par diff textuel

`estompageTerre({ altitudeEllipsoideM, estompageAvant })` est **byte pour byte identique**
entre `9d6f8fd` et `62c05fc` (`diff` vide sur les 190 premières lignes du fichier, qui
contiennent la fonction pure en entier). Seule `creerVeilleEstompage` a changé, par l'ajout
légitime de `poserRepos`/`auRepos` — hors de la fonction pure, exactement comme annoncé. Les
priorités (orbite → 0, repos → 1, loi en dernier) sont bien celles du code :
`!modeSurface ? 0 : auRepos ? 1 : auSeuil`.

## ⑥ Casse neuve — un test au titre trop généreux, sinon propre

- Aucun `console.log`, aucune sonde de debug oubliée dans le diff.
- Aucune constante neuve exportée-mais-morte : `SEUIL_BOUGE_LOG` et `IMAGES_CALME` sont lues
  comme défauts de paramètres et actives en production.
- Trois casses délibérées (faites par un sous-agent, sur des lignes de production réelles)
  cassent chacune avec un diagnostic net : `calme >= imagesCalme` → `>`, retrait de
  `poserCropSeul` dans le relais, retrait du `return` de coupure dans `_traverse` — dans les
  trois cas, les bons tests cassent et le message pointe la bonne cause.
- **Mineur — un test au titre plus large que ce qu'il vérifie** :
  `test('⑦ le drapeau ÉTEINT rend le parcours d'avant, tuile pour tuile')` ne compare que
  `false→false` (idempotence triviale) à l'état `false` déjà présent, jamais la vraie
  transition `true→false` avec une comparaison de bilan complet. Le titre promet la
  transition ; le corps ne la fait pas. Rien d'autre dans le fichier ne couvre ce cas au niveau
  du bilan (`dessinees`/`dessineesHors`/`maillees`) — seule la partie réseau de cette même
  transition (« la transition est gratuite ») est testée ailleurs.

## ⑦ Les captures — fidèles, pas embellies

Regardées personnellement (`AV-apparie-26km.png`, `AP-repos-26km.png`,
`AP-transition-i20.png`, `AP-repos-apres-dezoom.png`) en plus du sous-agent dédié. Les deux
lectures concordent : la description « AVANT noyé / APRÈS détaché » est fidèle à l'écran, tout
comme les quatre défauts avoués (mer/bloc, liseré, parois nues, alentours laids pendant la
transition). Aucun signe d'un rapport qui enjolive ses propres preuves — la seule réserve est
la légende légèrement généreuse notée en ④.

## Tests et environnement

`npm test` rejoué dans un worktree isolé : **3 806 tests, 3 805 verts, 1 échec** — et cet
échec (`test/occupation-sol.test.js`, `ENOENT` sur `public/data/sol/index.json`) est un
artefact d'environnement (fichier généré par `npm run build:sol`, absent d'un worktree neuf,
gitignoré) sans rapport avec le diff jugé — `occupation-sol.test.js` n'est touché par aucun
fichier de ce paquet. `npm run audit:tests` → **205 listés, 205 sur disque, aucun écart**,
confirmé. Le nombre total (3 806) correspond exactement au « 3 770 avant + 36 » du rapport.

---

## Décompte détaillé

**Important (3)**
1. « 3 216 images, écart nul, 53 s » présenté comme un relevé vivant alors qu'aucune trace de
   cette longueur n'existe sur disque — c'est une boucle de test synthétique. Défaut de preuve,
   pas de mécanisme.
2. `kids.every` → `kids.some` dans `_traverse` (règle sans-trou) : mutation survivante,
   confirmée par moi sur 181 tests. Préexistante au diff N, mais directement invoquée par son
   raisonnement de retrait de code mort — mérite un test dédié à l'état mi-chargement.
3. Couverture « globe par fonction » à point unique (1 test sur 9 usages dans le fichier) : la
   régression ciblée est bien gardée aujourd'hui, mais la garde ne tient qu'à un seul test
   nommément désigné.

**Mineur (5)**
1. Angle mort théorique de `modeSurface &&` retiré : ne serait faux que si `cropAuDepart` et
   `modeSurfaceAuDepart` étaient un jour passés en contradiction — inusité partout aujourd'hui.
2. `.banc/hysterese-N.mjs` ne reproduit pas lui-même les deux trous de 1900/1666 ms qu'il cite
   (garde seulement le plus long palier) — chiffres réels, non rejouables tels quels par l'outil.
3. Légende de `AP-transition-i20.png` un peu plus généreuse que l'image sur l'étendue visible
   des alentours.
4. Titre de test `⑦ le drapeau ÉTEINT rend le parcours d'avant, tuile pour tuile` plus large
   que ce que le corps vérifie (idempotence `false→false`, pas la transition `true→false`).
5. Écart d'une image entre « 1 664 images » (rapport) et 1 663 échantillons réels dans
   `AP-film-transition.json` — non significatif.

---

## CONFORMITÉ ✅
