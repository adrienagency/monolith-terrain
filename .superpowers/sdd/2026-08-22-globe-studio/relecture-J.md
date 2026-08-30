# Relecture — Tâche J (LA SURFACE PLEINE)

**Diff jugé :** `700df5e..de51c53` · **Worktree de relecture :** `C:/Dev/wt-relecJ` (pinned `de51c53`),
**retiré en fin de relecture** (`git worktree remove`). Aucune source de `C:/Dev/wt-merge` n'a été
modifiée. `git diff --stat` et `git diff --ignore-cr-at-eol --stat` rendent le MÊME résultat
(944 insertions, 24 suppressions, 8 fichiers) — pas de piège CRLF sur ce diff-ci.

## Verdict global

Les trois trous nommés sont réellement fermés, et c'est vérifiable indépendamment du rapport :
tests rejoués (3644, dont 1 échec environnemental sans rapport avec la tâche — fichier de données
gitignoré absent d'un worktree neuf), `audit:tests` 201/201 rejoué, `node --check` rejoué sur les
quatre fichiers source, tous les chiffres du rapport confirmés au bit près contre
`J-releves-bruts.json`, D5 respecté (aucun des trois fichiers interdits touché, `aussi: null`
bit-for-bit confirmé par code ET par test), captures fidèles à ce qu'elles montrent — y compris le
défaut résiduel que le rapport n'a pas caché. **Mais une des affirmations de vérification les plus
mises en avant du rapport (§1, la lecture GPU) ne résiste pas à l'inspection du code**, et ma
propre campagne de mutation a trouvé un trou dormant que les 20 mutations du rapport ne couvrent
pas.

**Décompte : 1 Critique · 2 Important · 2 Mineur.**

---

## Critique

1. **« La texture que le GPU LIT » n'est très probablement PAS une lecture GPU — c'est une
   relecture du même tableau JS.** `_cuireChampMer` construit `champ.texture` par
   `new THREE.DataTexture(demi, cote, cote, THREE.RGFormat, THREE.HalfFloatType)`
   (`src/globe.js:2337-2340`) : `demi` est le `Uint16Array` que le calcul JS de couverture/bathy a
   déjà rempli. `THREE.DataTexture` ne clone rien — `texture.image.data === demi`. `window.__exp`
   (`src/main.js:11056`) n'expose que des objets JS (`globe`, `camera`, `params`…) ; la seule
   fonction de relecture GPU du dépôt, `renderer.readRenderTargetPixels`
   (`src/main.js:8965`), sert exclusivement à la sonde matérielle (`sonderMateriel`) et n'a aucun
   rapport avec la mer. « Demi-flottants décodés à la main dans la page » décrit donc, selon toute
   vraisemblance, une lecture de `texture.image.data` — le tableau JS lui-même, pas un
   échantillonnage GPU indépendant. Le rapport présente pourtant cette mesure comme la preuve que
   « le GPU échantillonne » les bonnes données (§1, note du JSON : « le champ que le nuanceur
   échantillonne est bien celui que remplirHauteurs a produit ») — c'est exactement la classe
   d'erreur que le §0 du plan nomme sept fois (une mesure qui a l'air indépendante et ne l'est
   pas). **Atténuant, pas disculpant :** les captures finales (`J-apres-01.png`,
   `J-final-17-apres-commit.png`) montrent un dégradé de profondeur cohérent en mer, ce qui
   corrobore *indirectement* que la donnée est bien montée au GPU — mais ça ne remplace pas la
   preuve annoncée, et ça ne couvre pas un défaut d'upload silencieux (format, filtrage) qu'un
   vrai `readRenderTargetPixels` aurait pu révéler. À trancher par Adrien : le fait est établi par
   le code, l'importance qu'on lui donne est un choix.

## Important

2. **Trou dormant trouvé par ma propre campagne de mutation, absent des 20 du rapport.**
   J'ai posé 5 mutations sémantiques de mon cru dans mon worktree isolé (restauré à l'identique
   ensuite, `git diff` vide confirmé) :
   - inverser le sens de l'estompage dans `bordDeMer` (`mer-sphere.js:715`, `(1 - e)` → `e`) → **tuée** (4 tests, ⑪b/⑪c/⑪d/⑪h)
   - décaler la borne de `zoomPourEmprise` (`flux-terrain.js:276`, `<=` → `<`) → **tuée**
   - `&&` → `||` dans le refus `exigerBathy` de `poserMer` (`globe.js:2125`) → **tuée** (⑪j)
   - retirer la garde `uEstompageOn` dans `_majBordMer` (`globe.js:2268`) → **tuée** (⑪h)
   - **`flux-terrain.js:458`, remplacer `secondes.has(t.key) ? 9e8 : 1e9` par `1e9`** (annuler la
     priorité réduite des tuiles de la mer face à celles du bloc dans la file de requêtes) →
     **SURVIT**, sur toute la suite (3643 passent / 3644, l'unique échec restant est le fichier de
     données gitignoré, sans rapport). Ce comportement est pourtant explicitement voulu et
     commenté dans le diff même (« le bloc est ce que l'utilisateur regarde ; le fond marin de la
     mer lointaine ne doit pas lui passer devant dans la file ») mais n'est testé nulle part —
     aucune des 20 mutations listées au §8 du rapport (« aussi ignoré », « aussi réservé mais pas
     demandé », etc.) ne cible cette valeur de priorité. C'est un trou **dormant** : il ne se
     manifeste que sous contention réelle de la file (plusieurs tuiles en attente en même temps),
     précisément le scénario « réseau lent » que la réserve n° 3 du rapport dit elle-même ne pas
     avoir éprouvé.
3. **Le script de mutation et le protocole de lecture GPU vivent hors du dépôt**
   (`…/scratchpad/mutations-J.py`, chemin tronqué, scratchpad de session), donc le chiffre « 20/20
   tuées » n'est pas vérifiable indépendamment à partir du dépôt seul — contrairement à tous les
   autres chiffres du rapport, qui remontent à `J-releves-bruts.json` (committé) ou aux assertions
   des tests (committées). Le choix de mener la campagne EN PLACE plutôt que dans un
   `git worktree` séparé est documenté et justifié (évite précisément le piège CRLF qui a déjà
   attrapé quatre agents de ce chantier) — ce n'est donc pas une faute en soi, mais l'auditabilité
   en pâtit et vaut d'être signalée.

## Mineur

4. Le test `⑩h` (`test/fenetre-branchee.test.js`) qui défend « les deux appelants passent le même
   `aussi` » est une correspondance de texte source (regex sur `main.js` désassemblé de ses
   commentaires), pas un test comportemental. Il tue bien une régression textuelle réelle (vérifié :
   compte exactement 2 appels, exige `aussi: empriseZoomMer()` littéral dans chacun), mais resterait
   aveugle à une reformulation qui préserve la chaîne recherchée tout en changeant le comportement.
5. Le test `⑪g` (`test/mer-sphere.test.js`) vérifie la formule de superellipse du bord de mer et le
   rejet anticipé par correspondance de chaîne exacte sur le source GLSL extrait plutôt que par une
   exécution du nuanceur — cohérent avec le fait que le pipeline WebGL n'est pas exerçable sous
   node, mais une preuve plus faible que la mesure numérique que le rapport fournit par ailleurs
   pour le champ (elle ne couvre pas le rendu réel du fragment).

## Ce qui a été vérifié et tient

- **Chiffres (①) :** tous les chiffres cités par le rapport (portée 29,39 → 3, couverture
  0,0125 → 1, `bathy` false → true, 148 225 nœuds/0 manquant/97,6 %/min −4970 m, 73 m de houle)
  confirmés au chiffre près contre `J-releves-bruts.json`, elle-même interne cohérente
  (385² = 148 225, arithmétique vérifiée). `npm test` rejoué : **3644** tests exactement (3643
  passent, 1 échec dû à `public/data/sol/index.json` absent — fichier gitignoré, non présent dans
  un `worktree add` neuf, sans rapport avec la Tâche J, confirmé présent et non versionné dans
  `C:/Dev/wt-merge`). `npm run audit:tests` rejoué : **201/201**. `node --check` rejoué sur les
  quatre fichiers source touchés : propre.
- **D5 (②) :** `git diff --stat` confirme qu'aucun des trois fichiers interdits
  (`terrain.js`, `plinth.js`, `ocean.js`) n'apparaît dans le diff. Le patron `aussi: null` a été lu
  dans le code (`demanderEmprise` : le bloc `if (aussi?.emprise)` est sauté, `pourBathy` retombe
  exactement sur l'appel du dépôt) et confirmé par un test dédié qui passe
  (`` `aussi: null` reproduit le dépôt : mêmes tuiles, même réservation ``). Capture
  `J-drapeau-baisse-mode-plat.png` et son relevé JSON (`terreUniqueBranchee: false`,
  `globe._mer` absent, `terrain.mesh.visible: true`) cohérents avec un mode plat qui tourne sans
  rien du neuf.
- **Constantes neuves (⑤) :** `PORTEE_CROP`, `RETRAIT_EAU_CROP`, `FRACTION_BANDE_BORD`,
  `COUVERTURE_MER_MIN`, `TUILES_MER_MAX` — toutes les cinq effectivement lues quelque part
  (vérifié par grep dédié). `uCropCoin`/`uCropCoinN` : vérifié qu'ils sont désormais réellement lus
  dans `MER_FRAG` (`globe.js:255-257`) ET que le même objet uniforme est partagé avec le nuanceur
  des tuiles (`uCropCoin: u.uCropCoin` à la ligne 2204 — pas une seconde écriture). Aucun
  `console.log`/`debugger` dans le diff.
- **Captures (⑥) :** `J-avant-01-temoin.png` montre bien la nappe blanchâtre sans fond ET la
  seconde nappe détachée flottant à gauche du bloc, hors de lui — conforme à la description du
  rapport. `J-final-17-apres-commit.png` montre le marbrage bleu/vert non corrigé, **et le rapport
  le montre sans le cacher** plutôt que de choisir une capture plus flatteuse. Le protocole
  d'élimination (§6 du rapport) a été vérifié image par image :
  `J-temoin-11-fond-du-crop-estompage1.png` montre bien un plateau vert uniforme,
  `J-diag-15-houle-eteinte.png` montre bien une mer lisse sans marbrage,
  `J-diag-16-houle-rallumee.png` montre bien le marbrage revenir. Le diagnostic tient.
- **Non-fait (④) :** les six réserves du §9 (pas de chronométrage, `COUVERTURE_MER_MIN` posé pas
  mesuré, un seul lieu regardé, budget de lagon dépassé à 96 %, `uCoastMaskOn` à 0,
  bathymétrie du bloc cuite au zoom de la mer) sont énoncées avec leur portée précise, pas
  minimisées. `BATHY_BASE_ZMAX = 8` (cité en réserve 6) confirmé présent dans
  `src/bathy-sources.js:49`.

---

## CONFORMITÉ ❌ NON-CONFORMITÉ

Le travail livré referme réellement les trois trous nommés, et la quasi-totalité du rapport est
honnête et vérifiable. Mais le point 1 (Critique) est exactement la classe d'erreur que ce
chantier a payée le plus cher et le plus souvent — une mesure de vérification présentée comme
indépendante du code qu'elle prétend prouver, qui probablement ne l'est pas — et le point 2
(Important) montre que la campagne de mutation, malgré son 20/20 annoncé, laisse un trou réel et
non trivial. Les deux méritent la décision d'Adrien avant clôture, pas une validation silencieuse.
