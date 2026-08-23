# Rapport R3 — ON NE CHARGE QUE LES DALLES DU SOCLE

**Statut : DONE_WITH_CONCERNS.**
Branche `dalles-crop`, arbre `C:\Dev\wt-dalles`, partie de `4cca4e7`.

---

## 0. EN UN COUP D'ŒIL

Sur l'adresse de travail **sans** `&globe=continu` — c'est-à-dire le régime
**par défaut**, `FLAGS.globeContinu` valant `false` :

| grandeur | avant | après | écart |
|---|---|---|---|
| tuiles de MNT demandées au réseau | **190** | **127** | −33,2 % |
| octets de MNT | 23,82 Mo | 18,71 Mo | −21,4 % |
| tuiles **hors du crop** | **115** | **52** | −54,8 % |
| part hors crop | 60,5 % | 40,9 % | — |
| demandes de `_traverse` hors crop | **63** | **0** | −100 % |
| entrées de cache (`globe.tiles.size`) | 175 | 112 | −36 % |
| tuiles **dessinées** | 36 | 36 | inchangé |
| premier dessin | 3 781 ms (σ 366) | 3 444 ms (σ 29) | pas de ralentissement |

Cinq tirages par régime, cache HTTP coupé, La Réunion, Chrome en fenêtre
visible sur GPU réel. **Étendue des comptes de tuiles : 0 % sur les cinq
tirages** (les octets varient de 1,1 Ko sur 23,8 Mo). Les temps, eux, sont
bruyants — voir le §7.

Sur l'adresse **avec** `&globe=continu`, le réseau ne bouge pas (120,7 contre
121,7 tuiles, étendue 3,3 % : c'est du bruit). Ce qui bouge, c'est le travail :
191 → 128 demandes, 63 → 0 hors crop, cache 175 → 112. La purge de file
absorbait déjà ces tuiles-là ; elle les absorbait **après** les avoir créées,
enfilées et triées.

⚠️ **DEUX POINTS DU BRIEF SONT CONTREDITS PAR LA MESURE** (§2 et §4). Le plus
gros, le chemin 4, est le contraire de ce qu'annonçait le brief.

---

## 1. L'INSTRUMENT (Étape 1)

`scripts/sonde-dalles.mjs` — nouveau, commit `241b673`. Chrome piloté en CDP
direct (WebSocket natif de Node, **zéro dépendance ajoutée** ;
`puppeteer-core` n'est pas installé dans ce dépôt).

Elle répond à trois questions que rien ne posait ici :

1. **combien** de tuiles de MNT partent, et pour combien d'octets — via
   `Network.requestWillBeSent` / `loadingFinished`, sur les deux seuls gabarits
   d'URL du dépôt (`tiles.mapterhorn.com/{z}/{x}/{y}.webp`,
   `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`) ;
2. **lesquelles tombent hors du crop** — le départage est fait **par la page
   elle-même** : la sonde y importe `/src/monde/crop-sphere.js` et appelle son
   `tuileDansCrop` avec le `globe._crop` vivant. Aucune copie du critère : ce
   chantier a déjà payé une formule dupliquée qui divergeait ;
3. **qui les demande** — `_request` est enveloppé au moment où `main.js` publie
   `window.__exp` (piège de `defineProperty` posé par
   `Page.addScriptToEvaluateOnNewDocument`, donc avant le moindre module).
   ⚠️ **La pile du `fetch` ne suffisait pas** : elle s'arrête à `_pump`, la
   pompe, où les quatre chemins deviennent indiscernables. La première version
   de la sonde attribuait ainsi 92 tuiles sur 122 à un « chemin 4 » qui n'en
   demandait que 9.

Deux pièges corrigés en cours de route, notés parce qu'ils auraient produit de
faux chiffres :

- **la fenêtre de repos se compte depuis la navigation, pas depuis la dernière
  requête.** Prise à `dernière − 10 s`, une page qui se tait à la 12ᵉ seconde
  voyait *toutes* ses requêtes tomber « au repos » : le débit au repos valait le
  débit de démarrage ;
- **fenêtre visible, pas mode sans écran.** Sans écran, Chrome retombe sur
  SwiftShader, que `src/palier-machine.js:200` classe `logiciel` et rabat au
  palier 3 — lequel change le damier chargé (`test/damier-palier.test.js`). Le
  relevé se fait donc sur `ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 …, D3D11)`.

Relevés bruts : `.banc/R3/*.json` (répertoire ignoré par git, comme le veut
`.gitignore`). Tous les chiffres de ce rapport en sortent.

### L'ÉTAT DE DÉPART

**Adresse A** — `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0`
(3 tirages, 45 s, fenêtre de repos 15 s) :

| | valeur | étendue |
|---|---|---|
| tuiles de MNT | 121,67 [121–122] | 0,8 % |
| octets de MNT | 18,571 Mo | 0,0 % |
| hors crop | 46,67 [46–47] → **38,4 %** | 2,1 % |
| **demandes réseau au repos** | **0,00 / s** | — |
| `globe.queue.length` au repos | **0** | — |
| `globe.inFlight` au repos | **0** | — |
| `globe.tiles.size` | 175 | 0 % |
| `_drawn` | 36 | 0 % |
| `_refusFile` | **0** | — |

**Adresse B** — la même **sans** `&globe=continu` (5 tirages) :

| | valeur | étendue |
|---|---|---|
| tuiles de MNT | **190** | 0 % |
| octets de MNT | 23,82 Mo | 0 % |
| hors crop | **115** → **60,5 %** | 0 % |
| demandes au repos | **0,00 / s** | — |
| `tiles.size` / `_drawn` / `_refusFile` | 175 / 36 / 0 | — |

⚠️ **PREMIER RÉSULTAT, ET IL DÉPLACE LA QUESTION : AU REPOS, L'APPLICATION NE
DEMANDE RIEN.** Zéro requête par seconde, file vide, rien en vol, dans les deux
régimes. Le symptôme d'Adrien n'est **pas** un ruissellement permanent : c'est
une **bouffée de démarrage**. Les « 473 tuiles en chargement, file à 462 » du
plan du 2026-08-08 ne se reproduisent pas sur cette scène.

⚠️ **SECOND RÉSULTAT : LE RÉGIME CHANGE TOUT.** 190 tuiles contre 122, 60,5 %
hors crop contre 38,4 %. Et **c'est l'adresse B qui est le régime par défaut** :
`FLAGS.globeContinu = false` (`src/flags.js:60`). L'enquête n'avait pas pu
trancher quelle adresse Adrien utilisait ; le défaut du produit, lui, est
tranché.

---

## 2. ⛔ LE DIAGNOSTIC DU BRIEF EST FAUX SUR SON POINT PRINCIPAL

> **Brief, §1 :** « ⚡ **LE PLUS GROS, ET LE PLUS SIMPLE** — `bootInitialView`
> (`main.js:11599`), INCONDITIONNEL. ➡️ L'application télécharge le relief
> complet du bloc plat à chaque chargement, pour un bloc qu'elle rend invisible
> juste après. »

**Mesuré, chemin par chemin, sur un chargement de l'adresse A :**

| chemin | demandes de tuiles | dont hors crop |
|---|---|---|
| ④ `loadRealTerrain` → `dem.js:loadDem` | **9** (z12) | **0** |
| sondage de couverture (`probeMaxZoom`) | 6 (z12→z17) | 0 |
| ① `_traverse` | 109 | 63 |
| ③ `demanderEmprise` | 82 | 69 |
| ② racines z2 | 16 | 15 |

Le chemin 4 pèse **9 tuiles sur 122 (7,4 %)**, **toutes dans le crop**, et ce
sont exactement les 9 tuiles z12 du bloc 3×3 sur lequel le crop est découpé.
Ce n'est pas « le relief complet du bloc plat » : c'est le socle du crop.

**Et couper ce chemin n'économise pas 9 tuiles, il éteint le produit.**
Expérience faite (garde `&& !terreUniqueBranchee` posée sur la ligne 11599,
un chargement, puis `git checkout`) :

| | avec le chargement | sans |
|---|---|---|
| `globe._crop` | posé | **`null` — le crop n'existe jamais** |
| `globe._cropSeul` | `true` | `false` |
| tuiles **dessinées** | 36 | **0** |
| voile `#loading` retiré | 4,2 s | **jamais** |
| tuiles de MNT quand même téléchargées | 122 | **80 (6,6 Mo)** |

La chaîne est directe et vérifiée à la ligne :

- `majSeuilSocle` (`main.js`) sort à `!(largeurBlocM() > 0)` tant qu'il n'y a
  pas de MNT → `veilleCrop.maj()` n'est jamais appelée → `poserCrop` non plus ;
- `contexteCrop()` (`main.js:4905`) lit `terrain.mapUniforms.uCoastMask`,
  `uSol`, `uAnalysis`, `uRampTex` et `terrain.fenetreBornee.min/maxM` : tout
  vient de ce chargement. Sans lui, on rejoue à l'identique le défaut que la
  Tâche P2 a réparé (« plus aucune texture sur la terre ») ;
- `socleEmprise()` (`main.js:3300`) exige `dem`.

➡️ **Le chemin 4 n'est pas touché. Ce n'est pas une omission, c'est un refus
motivé et mesuré.** L'application reste sur son écran de chargement pour
toujours si on le coupe.

---

## 3. LE VRAI CHEMIN, QUE LE BRIEF NE NOMMAIT PAS (Étapes 2 et 3)

Le tableau du brief marque le chemin ① « ✅ gardé par `_horsCropSeul` ».
**Il l'est — mais seulement une fois le crop posé.** Première ligne de
`_horsCropSeul` : `if (!this._crop) return false`.

Relevé, `_request` instrumenté, adresse A :

- **114 des 191 demandes de tuiles partent avant que `poserCrop` ait été
  appelé** (60 %) ;
- dernière demande sans crop : **image 11** ; première demande avec crop :
  **image 41** ;
- parmi elles, **les 64 tuiles z3, c'est-à-dire la planète entière**, dont 63
  hors du futur crop. La caméra est déjà à l'altitude du bloc, donc le ratio
  `chord/dist` réclame z13 ; le quadtree ne sait pas encore qu'on ne lui
  demandera qu'un carré de trois tuiles.

Sur l'adresse B ces 64 tuiles partent **toutes** sur le réseau. Sur l'adresse A,
`_purgerFile` en absorbe 63 — après les avoir créées, enfilées et triées.

### Le correctif

`cropAttendu`, option de construction posée par `main.js` sous `?terre=unique` :
*« ce globe ne servira jamais qu'un crop, ne descends pas tant que tu ne sais
pas où il est. »*

- `_horsCropSeul` : `if (!this._crop) return this._cropAttendu && z > ROOT_Z`.
  **Les racines passent** — sans elles il n'y aurait pas de planète du tout.
- `_traverse` : `if (this._cropAttendu && !this._crop) wantSplit = false`.

⛔ **ET LA COUPE EST SUR `wantSplit`, PAS DANS `_children` — LE PIÈGE A ÉTÉ VU
AVANT D'ÊTRE ÉCRIT.** `_children` filtre déjà par `_horsCropSeul` : il rendrait
une liste **vide**, or `[].every(…)` vaut `true`, la descente « réussit » dans
le vide, et le `return` qui suit **saute le dessin de la racine**. La planète
disparaîtrait pendant tout le démarrage, sans une erreur nulle part. C'est
exactement le `kids.length > 0 &&` que la Tâche P14 a retiré comme code mort :
il l'était, et il cesse de l'être si l'on coupe trop bas.
Gardé par le test ① ter.

⚠️ **CE N'EST PAS `_cropSeul`.** `_cropSeul` est un **état de repos** que la
veille lève et baisse au fil de l'altitude ; `cropAttendu` est une **promesse de
naissance**, posée une fois, jamais retirée.

---

## 4. CHEMIN 3 — `demanderEmprise` : la garde NE S'Y APPLIQUE PAS (Étape 4)

Le brief demandait la garde du crop, « ou dis pourquoi elle ne s'y applique
pas ». Voici pourquoi, avec les tuiles.

`demanderEmprise` sépare ses deux emprises par la priorité (`1e9` le bloc,
`9e8` la seconde). Relevé, adresse B, un chargement :

| | tuiles | dans le crop | hors du crop |
|---|---|---|---|
| emprise **primaire** (le socle), z12 | 25 (5×5, x 2680→2684, y 2293→2297) | 9 | **16** |
| emprise **seconde** (la mer), z11 | 25 | 4 | **21** |

- La **seconde emprise est dehors par construction** : `empriseZoomMer` demande
  `empriseCalotte(rep, PORTEE_CROP = 3)`, trois fois plus large que le crop,
  bornée à `TUILES_MER_MAX = 25`. C'est la nappe qui peint la mer *autour* de
  l'île. Lui appliquer `tuileDansCrop` la réduirait à 4 tuiles et rendrait le
  champ de mer que la Tâche J a mesuré à 0,7 % de couverture — l'aplat gris.
- L'**emprise primaire est un 5×5 autour d'un crop de 3×3** : un anneau de
  marge d'une tuile tout autour. `tuileDansCrop` est un test sur le **centre**
  de la tuile ; l'anneau est précisément ce que la frontière du crop lit (les
  parois échantillonnent `latLonDeLocal(±1, ±1)`). Et ces 25 clés sont celles
  que `globe.gardeHauteurs` réserve : `_purgerFile` et `_evictJusqua` les
  exemptent explicitement, avec le motif écrit dans `globe.js` — « les évincer
  rendrait le socle intrinsèquement irremplissable ».

➡️ **Aucune modification de `src/monde/flux-terrain.js`.** Ces 37 tuiles
restent le premier poste hors crop après correctif (37 des 52). **Je n'ai pas
mesuré ce que leur retrait ferait au bord du crop, aux parois et à la mer** :
c'est une tâche à part, avec un budget de vérification visuelle. Voir §9.

---

## 5. LA CONTRE-PRESSION — ÉLARGIE, PAS LEVÉE (Étape 5)

Le brief demandait de lever les trois gardes `this.continu`. **Je ne les ai pas
levées, et voici l'objection.**

`FLAGS.globeContinu` vaut **`false`** (`src/flags.js:60`). Le « globe ordinaire »
que le brief craignait de changer **est la production**. Lever les gardes la
change donc — ce que l'Étape 8 interdit explicitement (« drapeau baissé, la
production doit être RIGOUREUSEMENT inchangée »). Les deux consignes du brief
sont contradictoires ; j'ai suivi la seconde.

Forme retenue : `_contrePression() { return this.continu || this._cropAttendu }`,
appliquée aux trois mécanismes nommés — `PLAFOND_FILE` (`_request`),
`_purgerFile`, rang 0 d'éviction (`_evictJusqua`) — **plus la quarantaine**
(`_ensureTile` et `_request`). La quarantaine n'est pas un quatrième mécanisme :
le commentaire du dépôt le dit lui-même — « le tri spatial seul rend les tuiles
bloquées évinçables, hors de lui la question ne se pose pas ». En armant le
rang 0, la question **se pose** : sans quarantaine, une `error` évincée
renaîtrait `empty` et repartirait aussitôt sur le réseau.

⚠️ **CE QUE LA MESURE DIT DES TROIS, ET C'EST TRÈS INÉGAL** — à écrire pour que
personne ne leur attribue les 63 tuiles :

- **`_purgerFile` paie**, et elle est la seule : c'est elle, et elle seule, qui
  fait la différence 190 → 122 entre les adresses B et A avant correctif ;
- **`PLAFOND_FILE` ne se déclenche jamais** sur cette scène : `_refusFile` relevé
  à **0** sur tous les tirages, avant comme après ;
- **le rang d'éviction n'est jamais atteint** : 112 à 175 tuiles en cache pour un
  budget de 1 700 — `_evictJusqua` ne passe pas.

Ces deux-là sont le **filet** (un panoramique rapide, un dézoom), pas le gain.
Ils sont couverts par des tests qui **forcent** leurs conditions à la main
(256 entrées de file, un cache saturé d'une tuile), parce que la scène ne les
atteint pas.

### Les tests (Étape 2, et Étape 5)

`test/dalles-crop.test.js`, **16 tests neufs**, sur un vrai quadtree (harnais de
`test/veille-repos.test.js` ⑦ : DOM bouché, réseau qui compte, caméra complète).

⛔ **Aucune assertion ne lit le texte source** — ce chantier a vu une mutation
survivre à 4 082 tests parce qu'une garde était vérifiée par une expression
régulière. Tout se mesure sur un globe qui tourne : des URL demandées, des états
de tuile, des longueurs de file.

⛔ **Chaque garde est prouvée dans les deux sens** : sept tests `bis` vérifient
que, drapeau baissé, le mécanisme ne fait **rien**.

**Rouge avant, vert après**, vérifié par `git stash` du seul correctif :
**7 des 16 tombent** sans lui (①, ②, ③, ④, ⑤, ⑥, ⑦ bis), les 9 autres — les
témoins négatifs et le contrôle de déterminisme — restent verts, comme ils le
doivent.

---

## 6. LA MESURE APRÈS (Étape 6)

Même sonde, même scène, même durée, cache HTTP coupé.

**Adresse B (sans `globe=continu`), 5 tirages avant / 5 après :**

| | avant | après |
|---|---|---|
| tuiles de MNT | 190 (étendue 0 %) | **127** (étendue 0 %) |
| octets | 23,818 Mo | **18,712 Mo** |
| hors crop | 115 | **52** |
| `tiles.size` | 175 | **112** |
| dessinées | 36 | **36** |
| demandes `_request` | 159 | **96** |
| dont `_traverse` hors crop | 63 | **0** |

**Adresse A (avec `globe=continu`), 3 tirages avant / 3 après :**

| | avant | après |
|---|---|---|
| tuiles de MNT | 121,67 [121–122] | 120,67 [118–122] — **bruit** |
| hors crop | 46,67 | 45,67 — **bruit** |
| `tiles.size` | 175 | **112** |
| demandes `_request` | 191 | **128** |
| dont `_traverse` hors crop | 63 | **0** |

⚠️ **DIT FRANCHEMENT : sur l'adresse A, le gain réseau est nul.** La purge
absorbait déjà ces tuiles. Ce qui est gagné là-bas, c'est le travail (63
créations d'objets, 63 entrées de file, 63 tris) et 36 % du cache.

### Où sont les 52 tuiles hors crop qui restent (adresse B)

| origine | tuiles | verdict |
|---|---|---|
| ② racines z2 | 15 | hors périmètre par le brief — et c'est le filet de la transition |
| ③ seconde emprise (la mer), z11 | 21 | dehors **par construction** (§4) |
| ③ anneau de marge du socle, z12 | 16 | la frontière du crop le lit (§4) |

### LA VÉRITÉ SUR LE PLANCHER

Le brief demandait de le dire. **Le plancher n'est pas « une dalle »**, et il
n'est même pas « les 36 tuiles du crop » : la règle sans-trou exige les parents
jusqu'à la racine, et le socle exige ses hauteurs. Décompte mesuré des 127
tuiles restantes :

- 36 à z13 — le crop lui-même, exactement ce qui est dessiné ;
- 25 à z12 — l'emprise du socle (9 dans le crop, 16 d'anneau) ;
- 25 à z11 — la nappe de mer ;
- 16 à z2 — les racines ;
- 9 à z12 — `loadDem`, le MNT du bloc ;
- ~10 — la chaîne d'ancêtres z3→z10 et 6 sondes de couverture z12→z17.

Autrement dit : **on est à environ 1,3 fois un plancher qu'aucune règle du
moteur ne permet de descendre plus bas sans toucher au bord du crop ou à la
mer.** Avant, on était à 2,0 fois.

---

## 7. LE COÛT DE DÉMARRAGE (Étape 7)

⚠️ **UNE MESURE DE TEMPS MENT PLUS FACILEMENT QU'UNE MESURE DE TUILES.** Cinq
tirages par état, adresse B :

| jalon | avant | après |
|---|---|---|
| premier dessin du crop (`_crop` posé **et** `_drawn > 0`) | **3 780,8 ms** — [3 393,9 ; 4 263,6], σ 366,3, étendue **23 %** | **3 444,4 ms** — [3 409,3 ; 3 497,6], σ 28,9, étendue **2,6 %** |
| voile `#loading` retiré | 5 856,3 ms, σ 558,6, étendue 30 % | 5 878,4 ms, σ 52,6, étendue 2,2 % |

**Verdict : aucun ralentissement.** L'écart de −337 ms sur le premier dessin est
du même ordre que l'écart-type d'avant (366 ms) : **je ne le compte pas comme un
gain.** Le voile est identique à 22 ms près, sur des dispersions de 559 et 53 ms.

Le seul effet que je tiens pour réel est la **stabilité** : l'étendue passe de
23 % à 2,6 % sur le premier dessin, et de 30 % à 2,2 % sur le voile — ce à quoi
on s'attend en retirant 63 requêtes qui se disputaient les six créneaux de
`MAX_CONCURRENT` avec le MNT dont la carte, elle, a besoin.

---

## 8. CLÔTURE — DRAPEAU BAISSÉ (Étape 8)

Barre de la Tâche P2 : « 0 pixel d'écart sur 1 024 000, trois chargements, `git
stash` à l'appui ». Je n'ai pas d'instrument de pixels ; j'ai celui des tuiles,
et il est plus sévère sur la dimension que cette tâche touche.

`?f3=0` (production, ni `terre=unique`, ni `frontiere`), **3 chargements avant**
(par `git stash` du correctif) **et 3 après** :

- 31 tuiles de MNT à chaque tirage, des deux côtés ;
- **le jeu de tuiles `(source, z, x, y)` est IDENTIQUE au caractère près**
  (`diff` des six listes triées : aucune différence).

Et par construction : les six sites modifiés dans `globe.js` sont tous gardés
par `_cropAttendu`, qui vaut `false` partout sauf sous `?terre=unique`. Les
tests `bis` (③ bis, ④ bis, ⑤ bis, ⑥ bis, ⑦) le vérifient par le comportement,
mécanisme par mécanisme.

**Drapeau levé**, les deux adresses tournent et rendent 36 tuiles dessinées —
le même nombre qu'avant, ce qui est le contrôle qui compte : on a retiré du
réseau, pas de l'image.

**Suite complète : `4 131 pass · 0 fail · 2 skipped`** (`npm test`, 212 fichiers,
32 s). `npm run audit:tests` : « 212 listés · 212 sur disque · aucun écart ».

---

## 9. RÉSERVES

1. **Le premier poste hors crop n'est pas traité** : 37 des 52 tuiles restantes
   viennent de `demanderEmprise` (§4). Je refuse d'y toucher **sans budget de
   vérification visuelle** — l'anneau de marge et la nappe de mer sont lus par
   la frontière du crop, et je n'ai pas mesuré ce que leur retrait fait au bord.
   C'est la tâche suivante évidente, et elle a besoin d'un œil, pas d'un
   compteur.
2. **Si le MNT ne charge jamais sous `?terre=unique`, le globe reste à z2.**
   `poserCrop` n'est appelé qu'une fois `largeurBlocM() > 0`. C'est une décision
   assumée et écrite dans le code : sous ce drapeau le bloc plat est éteint pour
   de bon, et une planète grossière vaut mieux que le téléchargement d'un
   hémisphère que personne n'a demandé. **Mais c'est un changement de
   comportement en cas de panne réseau**, et il n'est couvert par aucun test.
3. **Deux des trois mécanismes de contre-pression ne sont pas exercés par la
   scène mesurée** (`_refusFile` = 0, cache à 112 pour un budget de 1 700). Leur
   extension est un filet, testé par des conditions forcées à la main, **pas un
   gain mesuré**. Ne leur attribuez aucun des chiffres du §0.
4. **Une seule machine, un seul lieu, une seule pose.** RTX 3080 / ANGLE D3D11,
   Chrome en fenêtre visible, **serveur de dev** (pas le build de production —
   l'en-tête de `scripts/sonde-demarrage.mjs` avertit que le dev peut rendre un
   faux négatif sur les défauts de préchauffage ; les comptes de tuiles n'en
   dépendent pas, les temps du §7 si), La Réunion (le lieu par défaut), caméra
   au démarrage. **Non mesuré : le panoramique, le dézoom, les transitions de
   crop, une autre zone géographique.**
5. **`package.json` : j'ai ajouté `test/dalles-crop.test.js` à la ligne `test`.**
   Si une tâche parallèle ajoute aussi un fichier de test, cette ligne
   entrera en conflit — c'est un conflit d'une ligne, à résoudre en gardant les
   deux fichiers, puis `npm run audit:tests` pour vérifier.
6. **Écart de périmètre à connaître pour la fusion** : le brief plaçait mon
   point d'entrée à `main.js:11599`. Je n'y ai pas touché (§2) ; j'ai touché
   **`main.js:4112`** à la place, la construction du `Globe`. C'est loin des
   zones 4564-4600 et 4750-4780 que les tâches parallèles occupent.
7. **J'ai ajouté une ligne dans `_traverse`** (`wantSplit = false` sous
   `cropAttendu && !_crop`). Le brief disait de ne pas toucher au travail de la
   Tâche N : je ne l'ai pas modifié — le tri spatial, l'horizon, le frustum, la
   règle sans-trou et `_horsCropSeul` dans `_children` sont intacts. Mais la
   ligne est **dans** sa fonction, et le relecteur doit le savoir.
8. `_rechargeTuiles` n'est ni appelée ni modifiée. `_purgerFile` conserve sa
   propriété de sûreté — elle ne touche jamais une tuile prête — et le test
   ④ ter la garde explicitement.

---

## 10. CE QUI A ÉTÉ TOUCHÉ

| fichier | nature |
|---|---|
| `src/globe.js` | `_cropAttendu` au constructeur ; `_horsCropSeul` (1 ligne) ; `_contrePression()` (neuve) ; 5 gardes `this.continu` → `this._contrePression()` (quarantaine ×2, `PLAFOND_FILE`, `_purgerFile`, rang 0) ; 1 ligne dans `_traverse` |
| `src/main.js` | **une seule ligne**, 4112 : `cropAttendu: terreUniqueBranchee` à la construction du `Globe` |
| `test/dalles-crop.test.js` | **neuf** — 16 tests |
| `scripts/sonde-dalles.mjs` | **neuf** — l'instrument |
| `package.json` | ligne `test` : un fichier ajouté |

**Non touchés**, alors qu'ils sont dans le sujet :
`src/monde/flux-terrain.js`, `src/monde/veille-repos.js`,
`src/monde/branchement-crop.js`, `src/ocean.js`, `src/monde/mer-sphere.js`,
le nuanceur de `src/globe.js`, `main.js:11599`, `main.js:4564-4600`,
`main.js:4750-4780`.

## 11. COMMITS

- `241b673` — l'instrument (`scripts/sonde-dalles.mjs`)
- `b08352f` — le correctif + les 16 tests + `package.json`
