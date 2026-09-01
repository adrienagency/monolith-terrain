# R31 — LE LIEN ENTRE LE CROP ET LA GRANDE ÉCHELLE

Arbre : `C:\Dev\wt-ech` · branche `echelle-rampe` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5700**.

## LA DEMANDE, DANS LES MOTS D'ADRIEN

> *« Pourquoi ce ne sont pas les couleurs de la palette qui est sélectionnée qui
> s'appliquent ? Ce sont les couleurs du template qui doivent s'appliquer, même à
> grande échelle. **Il doit y avoir un lien entre ce que l'on voit en crop et ce
> que l'on voit à grande échelle.** Applique les couleurs choisies pour la grande
> échelle aussi (vue de loin). »*

## ⛔ SA PRÉMISSE EST FAUSSE, ET C'EST LE CŒUR DE LA TÂCHE

**Les couleurs du gabarit s'appliquent DÉJÀ de loin.** Mesuré à l'écran sur
`regroupement` fusionné, en relisant le LUT vivant du globe
(`globe.uniforms.uRamp.value`) :

| position dans le LUT | couleur lue |
|---|---|
| **t = 0,355** (première terre) | **148, 161, 116** |
| t = 0,50 | 192, 188, 132 |
| t = 0,99 | 224, 211, 193 |

Et `params.rampStops[0].c` vaut **`#93a074`** = **147, 160, 115**. C'est le même
ton, au bruit de quantification du dégradé près. `globe.js` construit son LUT
depuis `params.oceanDeep / oceanMid / oceanShallow` puis
`rampColorStops(params)` — **c'est la palette du gabarit, pas une table figée**.
R28 l'avait relevé indépendamment (« la première butée de la palette »).

⚡ **Ce qui NE suit PAS le gabarit, c'est l'ÉCHELLE D'ALTITUDE.**
`src/monde/rampe-crop.js` gèle `RAMPE_MONDE` et `GRADE_MONDE`
(`Object.freeze`, commentés *« Elles ne changent JAMAIS »*), d'où `REGIME_MONDE`
= `{reliefBas, landMax, profondeur, pivot, contraste}`. Pendant ce temps, **le
crop ajuste sa rampe au relief LOCAL** — R28 a mesuré l'auto-gradation montant
jusqu'à **contraste 6,4**, soit une fenêtre utile de **112 m pour 717 m
d'amplitude**.

➡️ **Mêmes couleurs, deux échelles d'altitude différentes.** Une altitude de
300 m ne reçoit donc pas la même couleur selon qu'on la regarde de près ou de
loin. **C'est exactement le « lien » qu'Adrien réclame, et c'est ça qu'il faut
rétablir.**

⚠️ **Si tu mesures que ce départage est faux, c'est TOI qui as raison** — sur ce
chantier, l'exécutant qui mesurait a eu raison contre le coordinateur **dix-neuf
fois sur dix-neuf**. Mais alors **dis-le avec le chiffre**, en premier.

## LA CONSÉQUENCE VISIBLE, QU'ADRIEN A DÉJÀ SIGNALÉE

Sa question précédente : *« Pourquoi y a-t-il une zone verte tout autour des
côtes ? »* R28 en a nommé la cause et **ne l'a pas corrigée**, parce qu'elle
touche au design :

> `natRampT = clamp(0,5 + (hNorm − pivot)·contraste, 0, 1)` — fenêtre utile
> `1/contraste`. À La Réunion z12 (pivot 0,41 · contraste 2,2 · reliefBas 107,5 ·
> landMax 3 009,6), **`rampT` sature à 0 pour TOUTE terre de 0 à 637,8 m** → le
> premier texel du LUT, `#93a074`, un vert. **La bande est DANS le crop, pas
> dehors** (basculer le grade change 510 392 px ; la correction de R28 en change 6).

➡️ **Recoller les deux échelles doit faire disparaître cet aplat**, ou au moins
le réduire à ce qu'il devrait être : une fine bande de plaine littorale. **Si ton
correctif ne le change pas, tu n'as pas résolu la demande d'Adrien** — vérifie-le
à l'écran, pas en théorie.

⛔ **Ce qui reste du ressort d'Adrien, et que tu ne décides PAS** : changer la
couleur `#93a074` elle-même. **Tu recolles les échelles ; tu ne repeins pas sa
palette.** Si après recollage il reste du vert au niveau de la mer, c'est son
choix de palette, et tu le dis sans y toucher.

## LA VRAIE DIFFICULTÉ — et elle est double

**① Une échelle unique ne peut pas être bonne partout.** Le monde va de −11 000 m
à +8 848 m ; un crop des Pays-Bas va de −5 m à +30 m. Une rampe mondiale figée
rend un crop néerlandais **uniformément plat**, et une rampe locale rend le monde
**saturé**. C'est pour ça que les deux régimes existent.

➡️ **La sortie n'est donc probablement pas « une seule échelle », mais une
échelle CONTINUE en fonction de l'altitude de la caméra** — la même famille de
solution que `minFade` pour les courbes de niveau, ou que l'atténuation par
distance de D15. ⚠️ **Mais ne prends pas ma suggestion pour un plan** : établis
d'abord, par la mesure, l'écart de couleur entre les deux régimes au même point
du sol, aux deux altitudes. **Si l'écart est petit, il n'y a rien à faire et tu
le dis.**

**② La continuité doit être VISUELLE, pas seulement arithmétique.** Le juge est :
**la même terre, au même endroit, doit avoir la même couleur de près et de
loin** — ou évoluer sans marche visible. Mesure un ΔE entre deux rendus du même
lieu à deux altitudes, **pas** un écart à zéro.

⚡ **La leçon qui vient de coûter cher à une autre tâche** : les quinze vignettes
de matière ont été déclarées vivantes pendant des semaines parce qu'on comparait
*une matière contre l'absence de matière*. Comparées **entre elles**, la médiane
des 105 paires valait **0,2312** — le plancher de bruit à la troisième décimale :
elles rendaient la même image. **Compare ce qui doit différer, pas ce qui doit
exister.**

## LES INSTRUMENTS QUI MENTENT — chacun a produit un faux constat ici

- **Un banc différentiel ne distingue pas « rien n'a changé » de « tout est cassé
  pareil ».** Un agent a recopié deux fonctions que `globe.js` avait déjà, le
  fragment a refusé de se lier, **plus une tuile n'était dessinée**, et son banc
  n'a rien vu (17 images cassées pareil s'écartent comme du bruit). **Lis la
  console à chaque recompilation de nuanceur.**
- **`majEchelleRampe` réécrit les uniformes à chaque image** — R28 s'est fait
  effacer ses valeurs de sonde et a relevé un faux 0 px au premier tour.
- **Un condensé 64×40 annule les motifs fins. Pleine résolution, toujours.**
- **Le compte de samplers est passé de 10 à 12, plafond 16** : tu n'as que
  **quatre unités de texture** libres. Compte avant de concevoir.
- ⚠️ **Le barème des mesures de ce dépôt est partiellement sous le bruit** : R21
  a établi un transitoire de **~0,17 / 0,33**, une mesure sur douze, cause non
  identifiée. **Entre 0,06 et 0,19, un relevé unique ne décide de rien.**
- **La garde des tables d'uniformes factices couvre les TROIS fichiers de test.**
  Si tu ajoutes un uniforme posé par `poserHabillage`, elle te le dira **par son
  nom** — complète la table, ne la contourne pas.
- ✅ **La molette simulée MARCHE** (40/40). Le coupable était le voile d'accueil
  `.ce-hubveil` — **ferme-le (Échap) avant tout banc.**

## LES RÈGLES — dans ce dossier

- **D15** (`regle-D15.md`) — ⚠️ **à lire en entier** : le départage de ce qui peut
  devenir global. `uCoastMask`, `uSol`, `uAnalysis` sont **cuites sur l'emprise
  du crop** et ne couvrent pas la planète.
- **D16 / bis / ter** — n'ajoute ni caméra ni passe de rendu sans l'avoir chiffrée.
- **D17** — ⛔ **IL N'Y A PAS DE PRODUCTION.** N'écris jamais « production
  rigoureusement inchangée » en étape de fin : consigne abrogée.
- `rapport-R28.md` — la passe précédente sur exactement ce nuanceur, avec son
  départage mesuré et ses deux points laissés ouverts. **Lis-le avant de coder.**

## L'ATTENDU

1. **L'écart de couleur entre les deux régimes, chiffré**, au même point du sol,
   à au moins trois altitudes et sur **trois lieux d'amplitudes très
   différentes** (une île volcanique, une plaine, une haute montagne). C'est ce
   chiffre qui décide s'il y a une tâche.
2. **Le recollage**, avec sa loi écrite : comment l'échelle passe du régime
   mondial au régime local, et **à quelle altitude**. Une marche visible est un
   échec.
3. **L'aplat vert des basses terres mesuré avant/après**, en pleine résolution,
   à La Réunion et à Bornéo — les deux lieux qu'Adrien a montrés.
4. **Le coût GPU**, minuterie du pilote (`EXT_disjoint_timer_query_webgl2`) avec
   **témoin de validité**, 40 rendus de chauffe jetés après chaque recompilation.
5. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent ne tourne **jamais**. `npm run audit:tests`, aucun
   écart.
6. `npm test` — **base à battre : 4 641 · 0 échec**.
7. ⚠️ **Scripts d'édition en BINAIRE**, et **relis l'octet écrit**
   (`grep | cat -A`) : **quatre** incidents cette nuit — trois `\b` devenus
   `0x08`, un `\n` devenu retour à la ligne. Une garde en est restée muette tout
   en étant verte.
8. Commits sur `echelle-rampe`, messages en français.
9. Rapport `rapport-R31.md` ici, avec une section **« ce que j'ai cru puis
   réfuté »** — sur ce chantier elle n'a **jamais** été vide.

⚠️ **Deux agents travaillent sur la caméra** (`C:\Dev\wt-sor` et `C:\Dev\wt-att`,
`modes.js` / `zoom-continu.js` / `pivot-bloc.js`). **N'y touche pas.** Ton
terrain est `rampe-crop.js`, la colorisation de `globe.js`, `palette.js`.

Travaille jusqu'au bout, ne pose pas de question : tranche, mesure, corrige.
