# Rapport de correction — P13 + P14, sur les trois constats Importants de `relecture-P1314.md`

**Statut : les trois points sont TRAITÉS.** Aucun n'était faux — les trois
constats de la relecture tiennent, et sont maintenant fermés par des tests
(vérifiés expérimentalement) et par une correction de formulation dans le
rapport concerné.

**Dépôt.** `C:\Dev\wt-merge`, branche `regroupement`. Commit de départ
`17ddd41`, commit de clôture **`4cca4e7`** — un seul commit, un seul fichier
suivi par git modifié (`test/crop-parois.test.js`, +79 lignes, aucune
suppression). Les fichiers de rapport touchés (`.superpowers/sdd/…`) et le
banc (`.banc/`) sont hors dépôt git (`*` dans `.superpowers/sdd/.gitignore`,
`.banc/` dans `.gitignore` racine) : rien à committer là-dessus, conforme à
la convention du chantier.

**Tests.** `npm test` → **4 117 / 4 117, 0 fail** (les 4 115 d'avant, plus
les 2 tests ajoutés ici). `audit:tests` → **211 / 211, aucun écart**.
`node --check` propre sur `src/globe.js`, `src/monde/parois-crop.js` et
`test/crop-parois.test.js`. Page chargée au serveur dev (`monolith-regroupement`,
port 5503) : **drapeau baissé** (racine, `?terre` absent) et **drapeau levé**
(`?terre=unique&frontiere=1`) — les deux sans erreur console, l'UI et le
chargement des tuiles se déroulent normalement dans les deux cas. Arbre
`git status --porcelain` vide après le commit.

---

## ① Test ⑬f (P13) — le garde-fou ne mordait que sur le congé — **TRAITÉ**

Confirmé : les deux seules assertions du bloc « écrasé » de ⑬f
(`ecrase.arrondi < …` et `assert.equal(ecrase.arrondi, murEcrase * PART_MUR_MAX)`)
ne lisent que `.arrondi` (congé). Rien n'y lit `.chanfrein`.

**Correction.** Nouveau test `⑬f ter LE GARDE-FOU MORD AUSSI SUR LE CHANFREIN
— SÉPARÉMENT DU CONGÉ` (`test/crop-parois.test.js`), qui répète le même bloc
écrasé (autonome de ⑬f) et ajoute les deux assertions manquantes sur
`ecrase.chanfrein`.

**Vérification expérimentale, comme exigé.** Retiré `Math.min(frCh * largeur,
mur * PART_MUR_MAX)` du calcul de `ch` SEUL dans `src/monde/parois-crop.js:803`
(en laissant celui de `rd` intact — exactement la mutation du relecteur) :
- ⑬f (l'ancien test) reste **vert** — confirme le constat de la relecture au
  bit près, le trou était réel.
- ⑬f ter (le nouveau) **rougit** : `AssertionError: 'le garde-fou du chanfrein
  ne rogne rien'`.
- `node --test test/crop-parois.test.js` : **62 pass, 1 fail** — exactement le
  nouveau test, rien d'autre.
Restauré la ligne, rejoué : **63 pass, 0 fail**. `git diff --stat` **vide**
avant le commit du test.

---

## ② Rapport P14 §2.3 — « poste unique » que le JSON contredit — **TRAITÉ**

Confirmé sur `.banc/P14/D5-energie-P14.json` : `éclairage du crop éteint` rend
un rapport de **0,863** (< 1,00), en plus de `normale fine éteinte` (**0,7746**).
Les deux traversent 1,00 ; la phrase « c'est l'unique poste dont l'extinction
traverse 1,00 » (§2.3) est fausse au sens strict.

**Correction.** `.superpowers/sdd/2026-08-22-globe-studio/rapport-P14.md`,
§2.3 réécrit : la phrase nomme maintenant explicitement la ligne « éclairage du
crop éteint » (0,863) et explique pourquoi cet état est dégénéré plutôt que
comparable — le **rosé** (même JSON, colonne `rose`) s'y effondre à **0,003**
(quasi achromatique, contre 1,384 pour la normale fine éteinte et 1,424 pour
l'état livré) : couper l'éclairage éteint la scène elle-même, ce n'est plus une
comparaison à isopoids. La conclusion de fond ne bouge pas — la normale fine
reste « le seul LEVIER isolable à un seul bouton dont l'extinction traverse
1,00 sur un état comparable » — mais elle est maintenant formulée pour
survivre à la lecture du tableau qui la précède de trois lignes.

Pas de test associé : c'est une correction de texte dans un document hors
dépôt git, pas un défaut de code ni de couverture.

---

## ③ `_retaillerJupe` (P14) — mutation R4 du relecteur, survivante — **TRAITÉ**

Confirmé dans `src/globe.js:5082-5083` : la première boucle de `_retaillerJupe`
construit `locaux` en lisant `d.bord` — si sa borne est décalée d'un cran
(`d.bord.length - 1`), le DERNIER sommet de l'anneau de bord n'est jamais
inséré dans `locaux` (le tableau garde un trou à cet indice). `jupesEffacees`
ignore silencieusement un trou (`if (l && …)`, `parois-crop.js:511`), donc le
marquage « brut » du dernier sommet n'est jamais calculé. La dilatation d'un
cran peut le rattraper via un voisin marqué — c'est pourquoi les tests P14
existants (qui trouvent des runs entiers de ≥ 24 sommets de frontière
consécutifs) ne le voient jamais : il y a toujours un voisin marqué pour
dilater dessus.

**Correction — test de COMPORTEMENT, pas de texte source.** Nouveau test
`P14 · ⛔ LE DERNIER SOMMET DE L ANNEAU DE BORD S EFFACE AUSSI — lecture
COMPLÈTE de \`d.bord\`` (`test/crop-parois.test.js`). Construit un anneau
synthétique de 8 sommets (une VRAIE `THREE.BufferGeometry`, un `userData.jupe`
minimal, positions réelles sur la sphère via `latLonDeLocal` + conversion
sphérique) où **seul le dernier indice** (`bi = N - 1`) tombe dans la bande du
garde-fou latéral, ses deux voisins cycliques (`bi = N - 2` et `bi = 0`) restant
au sec — puis appelle la VRAIE `Globe.prototype._retaillerJupe`, jamais une
lecture de texte. Vérifie que la jupe du dernier sommet s'efface (et, par
dilatation attendue, celle de ses deux voisins cycliques aussi), et qu'un
sommet du milieu de l'anneau, loin de tout, n'efface rien.

**Vérification expérimentale, comme exigé.** Décalé la borne de la première
boucle à `bi < d.bord.length - 1` dans `src/globe.js:5083` (exactement la
mutation R4 du relecteur) :
- `node --test test/crop-parois.test.js` : **62 pass, 1 fail** — le nouveau
  test rougit seul (`AssertionError: 'le DERNIER sommet de l anneau
  (bi = d.bord.length - 1 = 7), seul sur la frontière : sa jupe doit
  s effacer'`), aucun autre test ne bouge.
Restauré la ligne, rejoué : **63 pass, 0 fail** (l'ensemble complet passe à
**4 117 / 4 117**). `git diff --stat` **vide** avant le commit.

---

## Ce que je n'ai PAS touché

Conforme à la consigne : aucune ligne de `src/` n'est modifiée dans le commit
final — les deux mutations ci-dessus ont été appliquées, vérifiées comme
tueuses, puis restaurées avant de committer. Je n'ai pris aucun des trois
manques classés hors de proportion par le noteur (silhouette, pavage,
éclairage des parois) : ils restent à l'arbitrage d'Adrien, comme demandé.

## Onze codes morts trouvés par des survivantes ici — vérification faite

Les deux tests neufs ont été relus pour s'assurer qu'aucun n'exerce du code
mort avant d'être acceptés comme tueurs : dans les deux cas, le code touché par
la mutation restaurée (`ch` dans `parois-crop.js:803`, la boucle de lecture de
`globe.js:5083`) est le même code que la relecture a identifié comme vivant et
branché (elle a elle-même vérifié la mutation en aveugle et le comportement
réel de l'application) — aucune survivante ici n'a pointé vers du code mort.
