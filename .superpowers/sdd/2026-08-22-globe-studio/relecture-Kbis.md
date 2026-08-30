# Relecture — Tâche K bis (`92b8da6..d6d6478`)

Méthode : worktree isolé `C:/Dev/wt-relecKbis` pinné sur `d6d6478` (+ un second worktree
`C:/Dev/wt-mut-Kbis-relec` pour la campagne de mutation), tous deux **retirés (`--force`)
en partant** — aucune trace laissée dans `git worktree list`. Aucune source de `wt-merge`
n'a été modifiée ; seul ce fichier a été écrit.

## Verdict global

**CONFORMITÉ ✅.** Rapport honnête, chiffres vérifiés au bit/au texel près depuis les
données brutes, D5 et le périmètre respectés (débordement justifié et déclaré), défauts
non fermés correctement caractérisés et non minimisés. Un point Important sur la
campagne de mutation (des mutations de branchement plausibles, hors du jeu de l'auteur,
survivent encore) mérite un tour de plus mais ne remet pas en cause la livraison.

## Décompte par gravité

- Critique : 0
- Important : 2
- Mineur : 3

## Constats

### Important

- **La campagne de mutation, bien qu'à 35/35 sur son propre jeu, a un angle mort
  reproductible.** J'ai rejoué les 35 mutations de `.banc/mutations-Kbis.mjs` dans un
  worktree neuf : 35/35 tuées, confirmé indépendamment. J'ai ensuite écrit 3 mutations de
  branchement de mon cru, non présentes dans le jeu de l'auteur : **2 sur 3 survivent**.
  (1) Dans `poserCrop` (`globe.js`), remplacer le `||` par un `&&` dans le test de
  déménagement (`Math.abs(rep.cx-avant.cx) > marge || Math.abs(rep.cy-avant.cy) > marge`)
  **survit** — aucun test n'exerce un déplacement sur un seul axe (`test ③h` ne bouge
  qu'en diagonale ou d'un bout à l'autre du monde, jamais un seul axe). (2) Dans
  `valeurChamp` (`echelle-continue.js`), durcir la borne basse `x <= k0` en `x < k0`
  **survit** aussi (round-trip `log1p`/`expm1` assez précis pour rester sous la
  tolérance `1e-9` du test). Seule ma 3ᵉ mutation (`champsUtiles`, `>` → `>=` sur le
  plancher) a été tuée. C'est exactement le motif que le rapport lui-même documente comme
  faiblesse récurrente du chantier ; il n'est pas éteint, seulement réduit.
- **Le défaut d'orbite (`uCropOn` reste posé, la planète entière hérite de la rampe du
  dernier bloc) est vérifié réel et correctement diagnostiqué — pas plus grave que ce qui
  est écrit, mais pas moins non plus.** Vérification code : `veilleCrop.poserMode` n'est
  appelé **nulle part** dans `src/` (seuls `veilleSocle.poserMode` et
  `veilleEstompage.poserMode` le sont, dans `main.js:5014/5020`) — le doute exprimé par le
  rapport (« apparemment jamais appelé ») est donc confirmé, pas surinterprété. Et j'ai
  vérifié dans le nuanceur que `float t = sousEau ? … : …` n'est gardé par **aucun test
  sur `uCropOn`** : `uLandBas/uLandMax/uOceanDepth` sont des uniformes PARTAGÉS qui
  s'appliquent à CHAQUE fragment du globe, donc la rampe locale du dernier crop peint bien
  toute la planète, comme annoncé. Le défaut préexiste au diff (aucun fichier qui le
  porterait — `branchement-crop.js` — n'est touché par ce commit) : correctement hors
  périmètre, correctement non minimisé.

### Mineur

- **`AV-Z06`/`AP-Z06` ne sont pas des captures pixel-identiques**, contrairement à ce que
  « superposables » pourrait laisser entendre au sens strict : les ombres de nuages
  diffèrent de position entre les deux prises (scène animée, capturée à des instants
  différents). L'île elle-même (relief, teintes) est bien identique à l'œil. Le mot
  « superposable » est employé pour la partie pertinente (terrain/mer), pas pour le cadre
  entier — ce n'est pas une capture embellie, juste une formulation qui aurait gagné à le
  préciser.
- **`poserRampe({ zeroSousEau: false })` n'éteint pas `uMerZeroSousEau` si l'uniforme
  était déjà à 1** — seul `retirerRampe` le fait. Vérifié dans le code : la ligne est
  `if (zeroSousEau) u.uMerZeroSousEau.value = 1` sans `else`. Sans conséquence en
  production (`contexteCrop` est le seul site appelant, toujours avec `zeroSousEau: true`
  — confirmé par le test ③j et par grep), donc pas un défaut vivant ; à surveiller si un
  second appelant apparaît un jour.
- **`public/data/sol/index.json` absent dans mon worktree** a fait échouer un test hors
  périmètre (`test/occupation-sol.test.js`) lors de mon `npm test` complet (3745 passent,
  1 échoue) — c'est un artefact de mon worktree isolé (fichier généré non versionné, pas
  copié par `git worktree add`), pas un défaut du diff. Signalé par honnêteté de méthode,
  aucune action requise.

## Vérifications qui confirment le rapport (pour mémoire, aucun défaut)

- **CRLF** : `git diff --stat` et `git diff --ignore-cr-at-eol --stat` rendent le même
  compte exact (1242 insertions, 21 suppressions, 11 fichiers) — pas de faux diff.
- **① Les trois découvertes** : confirmées dans le code. `profondeur = Math.max(-Math.min(0,
  mesure.minM), p)` s'effondre bien au plancher quand `minM >= 0` (`rampe-crop.js:288`) ;
  `terreBas = mesure.minTerreM` explique le saut à 533,7 m ; et le nuanceur
  (`globe.js:1006-1011`) écrase bien `col` par la rampe nautique indexée sur
  `uMerFondBudgetM` dès `uMerRampeOn > 0.5 && sousEau`, sans repasser par `uRamp` —
  l'affirmation « le nombre qui peint la mer n'était pas dans le périmètre » est exacte.
- **② La loi et son honnêteté** : `exageration-continue.js` n'importe toujours rien (test
  `⑦` de `fenetre-branchee.test.js`, exécuté, vert) ; `pentesMonotones` y est bien la seule
  écriture, exportée et réutilisée par `echelle-continue.js` sans être recopiée. Le défaut
  à zéro (`uMerZeroSousEau: 0`, pas d'altitude) rend le dépôt au bit près — vérifié par
  test ①d (`Object.is` sur 2001 hauteurs) exécuté et vert.
- **③ Les chiffres** : recalculés depuis `.banc/vues-Kbis/AV-descente.json` et
  `AP-descente.json` bruts (pas depuis le rapport). Avec le jeu de hauteurs exact du test
  `②a`, j'obtiens `t` AVANT 0,349938 → APRÈS 0,072706 (37 texels), `dMer01` 0,139371 →
  0,012118, et pour Z9/Z11/Z13 seules `t` APRÈS 0,006396 (≈3 texels) — tout correspond au
  texel/à la décimale près. Le refus de reprendre le « 163/368, ×2,26 » de la Tâche C est
  justifié : la loi actuelle rend bien 182 texels pour la rampe mondiale (vérifié par
  exécution du test `②c`), pas 163, et le rapport de la Tâche C ne donne pas l'altitude
  utilisée — impossible à réconcilier, donc à raison écarté plutôt que réutilisé à tort.
  Le premier A/B GPU (témoin 0/1 241 595, variante 3457, retour 0) est confirmé dans
  `.banc/vues-Kbis/GPU-Kbis.json` brut ; le second A/B est bien retiré avec sa raison
  (témoin sale à 98,6 %) documentée dans le même fichier.
- **④ La campagne de mutation** : 35/35 rejouées indépendamment dans un worktree neuf,
  toutes tuées (voir le point Important ci-dessus pour la nuance).
- **⑤ D5 et le périmètre** : `terrain.js`, `plinth.js`, `ocean.js` absents de
  `git diff --name-only 92b8da6..d6d6478` — confirmé. Le débordement sur `poserMer` /
  `sousEauCrop` est justifié par la mesure citée (`uMerFondBudgetM` porte l'essentiel de
  la couleur de mer) et reste dans le commit unique, sans toucher au chemin bloc.
- **⑥ Ce qui n'est pas fermé** : chiffres et captures cohérents avec les affirmations —
  `AV-Z13`/`AP-Z13` montrent bien le champ gris disparaître au profit d'un relief lisible ;
  `AV-Z06` montre bien le « champ presque blanc troué de flaques bleu foncé » déjà présent
  avant toute intervention.
- **⑦ Casse neuve** : 3 tests cassés au hasard (suppression de la déclaration de
  `uMerZeroSousEau` dans le GLSL, réordonnancement des clés de `ctx.rampe` dans `main.js`,
  suppression de l'arrondi dans `cranAncre`) échouent tous avec un diagnostic clair et
  exploitable, pas de faux vert. Aucun `console.log`/sonde ajouté par le diff (grep sur les
  lignes `+` du diff). Une seule constante exportée par le nouveau module
  (`CHAMPS`), utilisée partout — pas de constante morte trouvée.
- `npm test` rejoué en entier : **3745/3745** (le seul échec observé, `occupation-sol.test.js`,
  vient d'un fichier généré absent dans mon worktree, sans rapport avec ce diff — voir
  Mineur). `npm run audit:tests` rejoué : **204 listés · 204 sur disque · aucun écart**.
  `node --check` vert sur les cinq fichiers touchés.
