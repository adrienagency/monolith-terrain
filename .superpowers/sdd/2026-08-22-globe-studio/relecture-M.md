# Relecture — Tâche M : la mort des paliers

**Méthode.** Worktree isolé `C:/Dev/wt-relecM` sur `a0e0499`, jonction NTFS vers
`node_modules` de `wt-merge` (piège du worktree sans `node_modules` évité — vérifié : sans la
jonction, `npm test` échoue immédiatement). `git diff --stat` et `git diff --ignore-cr-at-eol
--stat` rendent EXACTEMENT le même compte (1603/74/10 fichiers) — confirmé, aucun gonflage CRLF.
`npm test` exécuté réellement : **3845 tests, 3844 verts, 1 rouge** — le rouge
(`test/occupation-sol.test.js`) est un `ENOENT` sur `public/data/sol/index.json`, un fichier
**gitignored** (`.gitignore:24`) absent d'un worktree neuf ; le fichier de test n'a pas été
touché par ce diff (dernier commit `f46cb09`, hors plage). Ce n'est pas un défaut de la Tâche M.
`node --check` passe sur les cinq fichiers `src/` touchés. Le worktree a été retiré en partant
(`--force`).

## ① Le critère — vérifié depuis les relevés bruts, pas recopié

Recalculé moi-même depuis `.banc/vues-M/AP-descente.json` (1158 lignes de trace, avec compteurs
réseau `requetes`/`pretes` — c'est un relevé de l'application vivante, pas un banc synthétique) :
départ `alt=1600000`, arrivée `alt=505.57` (≈506 m), **1158 points**, pire rapport
image-à-image = **1.02622…** (≈1,026), **zéro recharge** (`rc` reste à 0 partout), **zéro
recul**. Tout correspond au chiffre par chiffre.

Depuis `.banc/vues-M/AV-rafales.json` (le régime « avant ») : pire discontinuité **exactement
3.2000000000000006** à la transition `orbital z7 → surface z7`, seconde **exactement 1.1429**
(vérifié `3.2/2.8 = 1.142857…`) à `surface z7 → surface z8`, et `c.tuilesRendues = 616`. Les
trois chiffres du rapport sont exacts au dernier chiffre publié.

Le rapport dit bien partout où le chiffre « après » du volet ④ apparaît qu'il vient d'un banc
hors réseau à témoin nul (429 du fournisseur) — vérifié en 3 endroits du texte (§0 implicite via
§5.3, réserve n°3), jamais présenté comme un relevé vivant.

## ② Les trois trouvailles — vérifiées dans le code

1. **`STEP_IN` faisait deux métiers** : confirmé dans le diff — avant, `STEP_IN = STEP_OUT =
   Math.LN2` servait à la fois de borne du glissé (`atInLimit`/`atOutLimit`) et de dérivation de
   `ZOOM_IMPULSE`. Après, `STEP_IN = PAS_CRAN = Math.LN2/2` (le cran, ×√2) et
   `BUDGET_NIVEAU = PAS_NIVEAU = Math.LN2` (le niveau de MNT, ×2) sont deux constantes
   distinctes, `ZOOM_IMPULSE` dérive de `BUDGET_NIVEAU` — dont la valeur numérique (`Math.LN2`)
   est **bit-identique** à l'ancien `STEP_IN` : la molette est belle et bien inchangée au bit
   près. Confirmé aussi par le test `escalier-surface.test.js` mis à jour en conséquence.
2. **L'accrochage est la grandeur conservée par `poseCranContinu`, pas la fonction elle-même** :
   vérifié `exagPourZoom` en direct (`node -e`) — `z4..z8 → 2.5, 5, 4, 3.2, 2.8` — donc
   `exagération(z7) = 3.2` exactement et `3.2/2.8 = 1.142857…` exactement, les deux
   correspondant aux deux discontinuités mesurées à la 4ᵉ décimale. Le nouvel invariant
   `altitudeFondM = camY × emprise / span` ne dépend plus de l'exagération — vérifié par lecture
   du module et par le test `③` de `zoom-continu.test.js` (rapport = 1 exactement pour tous les
   crans, contre les rapports d'exagération sinon).
3. **`escalier-zoom.js` ne peut pas disparaître entier** : `intersectionGlobe` et `viseeArrivee`
   restent exportés ET **réellement appelés** — `main.js:33` les importe, `main.js:2509` et
   `main.js:5293/5298` les utilisent en dehors de tout chemin de paliers (clic sur le globe,
   correction de dérive). Le brief demandait le module entier ; la contradiction est fondée.

## ③ La campagne de mutation — rejouée, pas seulement relue

`wt-mut-M` n'existe plus dans `git worktree list` (retiré comme annoncé). `.banc/mut-M-tour2.txt`
existe et son décompte final correspond à « 42/42 TUEE » (dernière ligne du journal : mutation
42/42 sur `main.js`, tuée par le test `⑥` de l'indicateur `ORB`/`Z{n}`).

J'ai posé **trois mutations de mon cru visant le branchement**, dans mon propre worktree isolé
(jamais dans `wt-merge`) :
1. Débrancher `_continu()` (`return false && …`) → **tuée**, 7 tests rouges.
2. Débrancher le crochet dans `main.js` (`zoomContinu: () => false`) → **tuée** (assertion sur
   le texte source de `main.js`).
3. Retirer l'appel `this._suivreEmprise()` en tête de `update(dt)` → **tuée**, mais **par une
   seule assertion, et elle est purement textuelle** (`assert.match(SRC_MODES,
   /update\(dt\) \{[\s\S]{0,700}?this\._suivreEmprise\(\)/)`) — aucun test de la suite `⑨`
   (celle qui instancie `Modes` avec le DOM de pacotille) n'appelle `m.update(dt)` pour vérifier
   *comportementalement* que le suiveur d'unités tourne à chaque image. La mutation est bien
   tuée aujourd'hui, mais par le type de garde le plus fragile de ce chantier (une regex sur le
   texte source), pas par le type que la Tâche elle-même dit avoir ajouté pour sortir de cette
   faiblesse. Voir constat Mineur ci-dessous.

## ④ Ce qui est déclaré non fait — vérifié, pas minimisé

- Screenshot `M-st4-2972m-z14-surface.png` inspecté : une bande grise franche coupe bien le
  relief en plein travers, exactement comme décrit. `M-st5-898m-z15-surface.png` : la caméra est
  bien contre une paroi, image inutilisable, exactement comme décrit. `M-st0-791680m-z5-surface`
  : les deux traits sombres traversant l'image sont bien visibles. Aucune capture n'enjolive ce
  que le texte annonce — si quoi que ce soit, le texte est plus dur que les images ne le
  montrent.
- `altitudeCadrageM()` divise bien par `lireExageration(params)` (`echelleBloc`, donc
  `camY / ((span/extentMeters) × exagération)`) — le facteur 2,8/2 = 1,4 annoncé est
  arithmétiquement exact et directionnellement cohérent (tous les seuils dérivés se déplacent).
- Clic sur le globe : `plongeDepuisGlobe` appelle bien `palierDeClic(DIVE_TIERS, this.altM)` —
  la table est réellement encore consultée sur ce chemin, exactement comme la réserve n°7
  l'admet. `zoomStepper = terreUniqueBranchee ? null : buildZoomStepper(...)` confirmé — les
  boutons `+`/`−` disparaissent bien sous le drapeau.

## ⑤ Casse neuve — rien trouvé

Aucune constante inatteignable, aucun `console.log`/sonde oublié dans le diff, aucune assertion
vide repérée dans `test/zoom-continu.test.js` (39 tests, tous vérifiés porter une assertion
substantielle). Tous les exports de `src/monde/zoom-continu.js` sont consommés (production ou
test) — aucun mort. Les cinq fichiers `.banc/` cités (`analyse-M.mjs`, `glisse-vs-transition-M.mjs`,
`mutations-M.mjs`, `trafic-M.mjs`, `mut-M-tour2.txt`) existent tous sur le disque. `npm test`
+39 tests (3806 → 3845) correspond exactement aux 39 `test(` de `test/zoom-continu.test.js`
(les autres fichiers modifiés renomment des identifiants, n'ajoutent aucun test).

## Constats

**Mineur.** Le test qui garde l'appel de `_suivreEmprise()` dans `update(dt)` (test `⑥`, « la
conversion d'unités tombe sur la MÊME image que le changement ») ne mord que sur le texte
source, pas sur le comportement — alors que la suite `⑨` a justement été construite pour sortir
de ce défaut sur les *autres* méthodes de `Modes`. Un futur refactor qui déplacerait l'appel tout
en gardant la ligne littérale ailleurs dans le fichier romprait le contrat sans faire rougir ce
test. Aucune mutation n'a survécu aujourd'hui, donc ce n'est pas une preuve manquante — c'est une
fragilité de méthode, à durcir dans une tâche future (par ex. un test qui construit `Modes`,
appelle `update(dt)` deux fois avec une emprise qui change entre les deux, et vérifie
`camera.position.y`).

**Mineur.** `brief-M.md` renvoie, sous D12, à « la règle d'arbitrage au bas de ce fichier » —
cette règle ne s'y trouve pas (elle vit dans `regle-D12.md`, qui contient en réalité D13 et
remplace D12). Sans conséquence sur le code livré : l'implémenteur a suivi l'ordre
adapter/extraire/copier de D13 (`zoom-continu.js` est un module pur extrait dans `src/monde/`,
conforme à l'option ②), mais la référence croisée du brief est cassée.

**Mineur.** Un `npm test` sur un worktree fraîchement cloné rend 3844/3845 et non 3845/3845 tel
qu'annoncé, à cause d'un fichier gitignored absent (`public/data/sol/index.json`) — sans lien
avec cette tâche (fichier de test non touché par le diff). À noter pour la prochaine relecture
qui rejouerait `npm test` sur un worktree neuf, pour ne pas le confondre avec une régression.

Aucun constat Critique ni Important. Chaque chiffre-clé du rapport (le critère du §0, les deux
discontinuités « avant », les 616 tuiles, le +39 tests, le facteur 1,4, les captures) a été
recalculé ou revérifié depuis une source indépendante (relevé brut, code, capture) et a résisté à
la vérification jusqu'à la décimale publiée. Les trois trouvailles qui corrigent le brief sont
fondées en code. La campagne de mutation est rejouable et tient — y compris contre trois
mutations supplémentaires ciblant spécifiquement le branchement. Les aveux (réserves 1 à 7) ne
minimisent rien de ce que j'ai pu vérifier indépendamment ; sur au moins deux points (le
screenshot z14, le clic-sur-globe) ils sont même plus sévères que ce que l'inspection directe
aurait exigé.

## Verdict

**CONFORMITÉ ✅**
