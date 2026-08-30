# Relecture — Tâche J bis (LE FOND DU CROP)

**Diff jugé :** `de51c53..a5b188e` · **Worktree de relecture :** `C:/Dev/wt-relJbis2` (pinned
`a5b188e`), **retiré en fin de relecture** (`git worktree remove --force`, confirmé absent du
disque et de `git worktree list`). Aucune source de `C:/Dev/wt-merge` n'a été modifiée — seul ce
fichier y a été écrit. `git diff --stat` et `git diff --ignore-cr-at-eol --stat` rendent le MÊME
résultat (1493 insertions, 31 suppressions, 11 fichiers) : pas de piège CRLF sur ce diff. Le fichier
plan (`docs/superpowers/plans/2026-08-22-globe-studio.md`) a son blob ET son worktree en LF (0
caractère `\r` des deux côtés) — la correction que le rapport revendique tient.

## Verdict global

L'affirmation d'architecture centrale tient : `flux-terrain.js` dit bien, en toutes lettres,
qu'une fusion bathymétrique par tuile « retirerait les neuf dixièmes de ses sondes » à
`fuseBathymetry` — donc fausse, et lire le champ que `poserMer` cuit déjà (385² sur
`fuseBathymetry`) est le bon geste. L'ordre des maillons (`crop, fond, parois, habillage, rampe,
mer`) et le rejeu ciblé des lecteurs (`LECTEURS_DU_FOND = ['parois', 'rampe']`) sont exactement
ceux du diff, et je les ai fait échouer par mutation pour vérifier qu'ils sont réellement gardés,
pas seulement écrits. **Tous les chiffres du rapport — les huit avancés dans la consigne de
relecture compris — sont exacts au dénominateur près contre `Jbis-releves-bruts.json`**, y compris
les deux qui touchent à un code que j'ai vérifié séparément dans les sources (`exposantCoin(0.6) =
4,4`, `uSlabCorner = 0,04 × 56 = 2,24` sur un demi-côté de 28). `npm test` rejoué : 3683 (3682
passent, le seul échec est un fichier de données gitignoré absent d'un worktree neuf, sans rapport
avec la tâche). `npm run audit:tests` rejoué : 202/202. `node --check` propre sur les cinq fichiers
source touchés. D5 est respecté : `terrain.js`, `plinth.js`, `ocean.js` n'apparaissent nulle part
dans le diff ; seul `parois-crop.js` est élargi côté fichiers partagés, et son défaut par défaut
(`plancherMer = 0`) reste verrouillé par un test que j'ai fait échouer et confirmé.

J'ai rejoué 8 mutations tirées du rapport (toutes tuées) et posé 3 mutations sémantiques de mon
cru ciblant spécifiquement le branchement (toutes tuées, diagnostics clairs). En sondant plus loin
la même fonction, **j'ai trouvé un trou dormant que ni les 36 mutations du rapport ni mes 3
mutations ciblées ne couvrent** : la frontière `h > 0` d'`altitudeMaillage` (la loi qui décide si
un point garde la hauteur de sa tuile ou passe sous l'autorité du champ) n'est testée qu'aux valeurs
0, 1234.5, -288.36 — jamais entre les deux. Élargir la frontière à `h > 100` survit à l'intégralité
des 275 tests des quatre fichiers concernés.

Les deux captures citées dans ma consigne (`Jbis-00-avant-etat-J.png`,
`Jbis-20-page-rechargee-12km.png`) montrent bien ce que le rapport dit : un marbrage bleu-vert
avant, une nappe bleue continue après — et la capture « après » montre elle-même, sans les cacher,
les défauts que le rapport liste comme non réparés (jupes qui pendent en bas à droite, aspect
délavé). Ce n'est pas un rapport qui embellit ses preuves.

**Décompte : 0 Critique · 1 Important · 1 Mineur.**

---

## Important

1. **Trou dormant trouvé par ma propre campagne de mutation, absent des 36 du rapport et de mes 3
   mutations dédiées au branchement.** Dans `src/monde/fond-crop.js:89`
   (`altitudeMaillage`), la ligne `if (h > 0) return h` décide : au-dessus de zéro, la surface
   garde la hauteur de sa TUILE (256 px/tuile) au lieu du champ bathymétrique (6× plus grossier,
   385 nœuds sur 3 largeurs de crop) — c'est exactement la garde documentée « LA TERRE GARDE LA
   TUILE ». J'ai élargi cette frontière à `if (h > 100) return h` (worktree isolé, revert
   `git checkout --` confirmé par `git status --short` vide) et rejoué les quatre fichiers de test
   concernés (`fond-crop`, `crop-branche`, `mer-sphere`, `crop-habillage`, 275 tests) puis élargi
   encore à `globe-precision`, `globe-profondeur`, `crop-sphere`, `crop-parois`, `crop-rampe` :
   **aucun test ne rougit.** Cause : tous les appels à `altitudeMaillage`/`altitudeSonde` avec un
   fond réel n'exercent que h ∈ {0, 1234.5, -288.36} (tests ②, ②bis, ④bis, ④ter, ⑤) — jamais une
   valeur de terre basse (1 à 100 m, le cas d'une plage ou d'un polder). Les tests ⑨ (le miroir
   GLSL du nuanceur) n'aident pas ici : ils exécutent une transcription mécanique du bloc de
   fragment shader, un texte séparé, qui n'appelle pas la fonction JS mutée. **C'est un trou
   dormant, pas un bug livré** : le code du dépôt applique la bonne loi (`h > 0`), et rien dans le
   comportement actuel n'est faux. Mais un futur refactor qui déplacerait cette frontière (une
   faute de frappe `0` → `10`, une« simplification » qui fusionne les deux branches) corromprait en
   silence le relief de toute côte basse à l'intérieur d'un crop où un fond est posé, sans qu'aucun
   des 275 tests ne le signale. Une sonde à h ∈ {1, 12.5, 50} avec un `hFond` réel comblerait le
   trou.

## Mineur

2. **La campagne de mutation a tourné EN PLACE plutôt que dans un `git worktree` séparé**, à
   rebours de la lettre du §0 du plan (« campagnes dans un `git worktree` à part, retiré en
   partant »). Le rapport (§8) justifie ce choix — un `worktree add` extrairait les fichiers en
   CRLF (`core.autocrlf` système `true`, dépôt `false`) et produirait de faux survivants,
   précisément le piège que la consigne visait à éviter — et documente une vérification SHA-256
   octet par octet à chaque mutation. Le raisonnement est sain et l'intention de la consigne
   (empêcher les faux survivants CRLF) est préservée par un moyen plus robuste que sa lettre. Signalé
   pour traçabilité, pas comme une faute : le script (`…/scratchpad/mutations-Jbis.py`) reste hors
   dépôt, donc le chiffre « 36/36 » n'est vérifiable qu'en rejouant soi-même une campagne
   équivalente — ce que j'ai fait pour 11 mutations (8 reprises du rapport + 3 de mon cru), toutes
   tuées.

## Ce qui a été vérifié et tient

- **① L'architecture.** `src/monde/flux-terrain.js:743-749` dit littéralement qu'appeler
  `fuseBathymetry` par tuile « lui retirerait les neuf dixièmes de ses sondes » — la fusion par
  tuile serait bien fausse, confirmant l'affirmation du rapport et de `fond-crop.js`. `CHAMP_FOND =
  384` (`globe.js`) est bien réutilisé tel quel par `poserFondCrop` (`N = CHAMP_FOND`), donc « le
  même champ que la mer lit » est vrai au sens fort : même cuisson, même résolution, pas une
  seconde fusion. Ordre : `MAILLONS = ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer']`
  confirmé dans le source ; `LECTEURS_DU_FOND = ['parois', 'rampe']` confirmé. J'ai fait échouer par
  mutation : `retirerCrop` sans l'appel à `retirerFondCrop` (tué, test ⑪bis) ; `LECTEURS_DU_FOND`
  vidé (tué) ; le garde anti-double-rejeu retiré (tué, test ⑥ ter ter) ; `main.js` qui recopie
  `portee: 3` au lieu de dériver `ctx.mer.portee` (tué, test ⑧ nonies) ; `plancherMer` figé à 0 dans
  `globe.js` (tué, test ⑦ ter) ; le nuanceur GLSL qui ignore le clamp `min(hFond, 0.0)` (tué par les
  tests ⑨, qui EXÉCUTENT une transcription mécanique du bloc GLSL). Mes trois mutations dédiées au
  branchement : `neuf: rebati > 0` affaibli en `rebati >= 0` (tué, ⑥ ter bis) ; le maillon `fond`
  qui avale son propre refus (`refus: null` toujours) (tué, ⑥ ter ter) ; la condition de
  reconstruction `cle !== this._cleFondPosee` inversée (tué, deux tests distincts). Onze mutations
  posées sur le branchement et les méthodes du globe, onze tuées.
- **② Les chiffres.** Comparés un par un à `.banc/vues-Jbis/Jbis-releves-bruts.json` (lu dans
  `C:/Dev/wt-merge`, en lecture seule) : 3 105 sondes en eau, écart 920,7 → 2,85 m, max 2 116,27 →
  310,01 m, surface à zéro exact 90,4 % → 1,9 %, `uOceanDepth` 130,359375 → 2 106,7706909…,
  `baseY` ×2,718 (−0,054132… → −0,147117…), z12 288,36/2 116,3 = 13,6 %, masque de côte 67 084 vs
  5 761 = 11,6×. Tous exacts, tous avec leur dénominateur nommé — pas de mélange de monnaies trouvé.
  Vérifié séparément dans les sources : `poserCrop({..., corner = 0, expo = 2})` et aucun appelant
  ne passe autre chose (`branchement-crop.js:116` est le seul site d'appel) — le crop est bien un
  carré. `exposantCoin(0.6) = 2 + 4×0,6 = 4,4` (`fenetre-clip.js:73`) et `uSlabCorner = 0,04 × 56 =
  2,24` sur `TERRAIN_SIZE/2 = 28` (`terrain.js:61,245`) — les deux chiffres du socle cités par le
  rapport sont exacts, pas approximés.
- **③ La campagne de mutation.** 181/181 sur les quatre fichiers de test touchés, 3683 (3682 + 1
  échec environnemental) sur la suite complète, rejoués tels quels dans mon worktree. Voir
  « Important » ci-dessus pour le trou trouvé au-delà de la campagne du rapport.
- **④ D5.** `terrain.js`, `plinth.js`, `ocean.js` absents du diff (confirmé par `git diff --stat`
  sur ces trois chemins : vide). `git diff --stat` global == `git diff --ignore-cr-at-eol --stat`
  global, à la ligne près. `parois-crop.js` seul fichier partagé élargi ; son défaut par défaut
  (`plancherMer = 0`, test « vaut ZÉRO par défaut — le dépôt au bit près ») passe, et je l'ai fait
  échouer en mutant `Math.max(h, plancherMer)` → `Math.min(...)` (tué, message : « l'écart vaut 0,
  attendu 0,0659… »).
- **⑤ Ce qui est déclaré non fait.** Frange d'écume à 5,5 km : confirmée à l'écran
  (`Jbis-21-descente-5-5km.png`), bande blanche large et tachetée, cohérente avec « défaut
  dominant ». Bloc 2,7× plus profond : chiffre exact (voir ②), et la réserve §9.2 du rapport le
  formule explicitement comme décision produit non tranchée, pas comme un fait accompli — pas de
  minimisation. `uCropCoin`/`uCropCoinN` : vérifié faux-positif du carré (voir ②) — le rapport ne
  prétend pas avoir corrigé la forme, seulement réveillé la lecture, et le dit. `uCoastMaskOn = 0` :
  `poserHabillage` fixe `uCoastMaskOn.value = coastMask ? 1 : 0` à l'instant de l'appel et « ne
  refuse jamais » (`branchement-crop.js`), donc la reprise ne le rejoue pas si le masque du socle
  arrive après — c'est bien un rafraîchissement manquant, pas un branchement manquant, et les
  chiffres 67 084/5 761 le confirment.
- **⑥ Casse neuve.** Aucun `console.log`/`debugger` dans les cinq fichiers source touchés ni les
  quatre fichiers de test. Aucune assertion triviale, aucun `.only`/`.skip`, aucun TODO/FIXME.
  `.banc/vues-Jbis/` et son JSON existent bel et bien sur le disque de `C:/Dev/wt-merge` (gitignorés
  par construction, absents de mon worktree pinné — c'est attendu et pas une faute). Trois lignes de
  production cassées au hasard, en plus de celle du point Important : `construireSolideCrop`
  (`Math.max`→`Math.min` dans `lire()`) → tuée, diagnostic clair (« l'écart vaut 0, attendu
  0,0659… ») ; `echantillonnerFond` (borne stricte retirée) → tuée, diagnostic clair.
- **⑦ Les captures.** `Jbis-00-avant-etat-J.png` montre un marbrage bleu-vert net sur la moitié
  basse du bloc. `Jbis-20-page-rechargee-12km.png` montre une mer bleue continue avec un bassin
  visible, ET montre elle-même — sans les masquer — les jupes qui pendent (coin bas droit) et
  l'aspect délavé que le rapport liste comme non réparé. Comparaison avec `Jbis-40` (mode plat,
  socle riche : grain, terre cuite, lagon turquoise, coins arrondis) confirme l'écart de richesse
  visuelle que le rapport décrit au §6.4.

## CONFORMITÉ ✅
