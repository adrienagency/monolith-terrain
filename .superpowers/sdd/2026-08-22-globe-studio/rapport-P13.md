# Tâche P13 — la dette CRLF, et le chanfrein — `ee4e479..536f7a6`

**Statut : LES DEUX POSTES SONT LIVRÉS.** Cinq commits, séparés comme le brief le
demandait — la forme d'un côté, le fond de l'autre.

| hash | ce que c'est | fichiers |
|---|---|---|
| `d1b212a` | **la dette CRLF, réparée à la racine** | **1** (`.gitattributes`) |
| `5a23c8e` | **le chanfrein et le congé, portés du socle au crop** | 4 |
| `ada3bc4` | cinq survivantes, et les tests qui ne mesuraient rien | 1 |
| `d1f946d` | l'eau et les jupes qui dépassaient du mur rentré | 5 |
| `536f7a6` | deux survivantes de plus | 1 |

**La ligne de test :** `npm test` — **4 105 / 4 105**, 0 échec, 0 sauté (4 087 au
départ, **+18**) · `npm run audit:tests` — **211 / 211, aucun écart** ·
`node --check` sur les trois modules de `src/` et les quatre fichiers de `test/`
touchés · **`git status --porcelain` vide** · **page chargée drapeau LEVÉ et
drapeau BAISSÉ, zéro `pageerror` des deux côtés** · `git ls-files --eol` :
**plus un seul `w/crlf` dans l'arbre.**

> ⚡ **CAMPAGNE DE MUTATION : 42 / 42, dont 35 visant le BRANCHEMENT (83,3 %).**
> **Sept survivantes** au fil des trois tours, **et chacune a montré un test qui
> ne mesurait pas ce qu'il annonçait** — dont une qui a démasqué un vrai trou du
> code (§4).

> ⛔ **ET DEUX CHOSES QUE JE NE FERME PAS, DITES AU §6 :** les jupes de tuiles se
> lisent maintenant comme **cinq traînées pâles sur le mur** (cause prouvée par
> extinction), et **le liseré de BASE du socle n'est pas reproduit** — le
> chanfrein d'arête haute, lui, l'est, et il se mesure à **+58,25 %**.

---

## 0. Ce que j'ai exécuté, et dans quel ordre

| commande | résultat |
|---|---|
| `npm test` au départ (`ee4e479`) | **4 087 / 4 087** — le total annoncé, retrouvé |
| `npm test` à l'arrivée (`536f7a6`) | ⚡ **4 105 / 4 105**, 0 sauté |
| `npm run audit:tests` | **211 listés · 211 sur disque · aucun écart** |
| mesure CRLF sur les 1 067 fichiers suivis | **421** en CRLF, **0** autre différence |
| `git add --renormalize .` après `.gitattributes` | ⚡ **rien mis en scène** (§1.2) |
| campagne de mutation, 3 tours | **28/34 · 40/42 · 42/42** |
| clôture, drapeau LEVÉ | `refus: []`, 256 tuiles, `uCropOn = 1`, **0 `pageerror`** |
| clôture, drapeau BAISSÉ | socle vivant, plinthe visible, `uCropOn = 0`, **0 `pageerror`** |
| `git status --porcelain` (début, entre chaque mutation, fin) | **vide** |

**Le banc vit dans `.banc/P13/`** (`.gitignore:44`) : `mesures`, `mutations-P13.mjs`,
`resultat-mutations-P13.json`, les cinq scripts de page `p1` à `p4`, le récepteur
`recois-P13.mjs`, les journaux et les onze captures. **Aucun worktree créé** ; les
mutations ont été posées en place, le test rejoué, `git checkout --` puis
`git diff --stat` vérifié vide entre chacune.

---

# ① LA DETTE CRLF

## 1.1 ⚡ LA MESURE D'ABORD — et elle est plus nette que le constat

**Je n'ai pas fait confiance à `git ls-files --eol` tout seul.** Pour chacun des
**1 067 fichiers suivis**, j'ai comparé le blob de l'index au contenu du disque,
puis au contenu du disque **une fois les CR de fin de ligne retirés**
(`.banc/P13/mesures/mesure-crlf.mjs`, hachage `blob` recalculé à la main) :

| | fichiers |
|---|---|
| identiques au blob | **646** |
| ⛔ **égaux AU CR PRÈS** (contenu strictement identique) | **421** — 147 708 octets de CR |
| **AUTRE différence** | ⚡ **0** |
| illisibles | 0 |

⚡ **ET LES DEUX INSTRUMENTS CONCORDENT EXACTEMENT** : `git ls-files --eol` compte
les **mêmes 421**, avec **zéro écart dans un sens comme dans l'autre**. La
répartition : **307 `.js`**, 60 `.md`, 22 `.mjs`, 9 `.css`, 6 `.json`, 3 `.py`,
3 `.html`, et LICENSE, `.gitignore`, `netlify.toml`, `.github/workflows/deploy.yml`…
Par dossier : **`src/` 187**, **`test/` 128**, `docs/` 45, `scripts/` 24.

**Le piège, reproduit avant d'être réparé.** `README.md` n'apparaît pas dans
`git status`. On lui touche sa seule date de modification, rien d'autre :

```
$ python -c "os.utime('README.md', (a, m+1))"
$ git status --porcelain          →  M README.md
$ git diff --stat -- README.md    →  204 +++---   102 insertions(+), 102 deletions(-)
$ git diff --ignore-cr-at-eol --stat -- README.md  →  (vide)
```

⛔ **102 lignes ajoutées et 102 retirées pour ZÉRO ligne modifiée.** Le cache de
`stat` de l'index portait la taille CRLF enregistrée à la sortie ; tant que
personne ne touchait le fichier, git le donnait propre.

## 1.2 ⚡ CE QUE J'AI DÉCIDÉ — ET LE CAHIER DES CHARGES SE TROMPAIT SUR LE COÛT

Le brief prévenait : *« Un `git add --renormalize` sur 421 fichiers produit un
commit énorme : c'est attendu. »* ⚡ **Il ne l'a pas produit, et la raison est
instructive : l'index était DÉJÀ en LF partout.** Aucun `i/crlf` dans l'arbre —
seulement des `i/lf w/crlf`. La dette ne vivait pas dans le dépôt, elle vivait
dans la **copie de travail**. Une fois `.gitattributes` posé, la commande met en
scène **exactement rien** :

```
$ git add --renormalize .
$ git status --porcelain
?? .gitattributes
```

**Le commit `d1b212a` porte donc UN fichier, 42 lignes.**

**Ce que j'ai fait, dans cet ordre :**

1. **`.gitattributes` : `* text=auto eol=lf`**, plus dix-huit extensions binaires
   déclarées explicitement. ⚠️ **C'est `eol=lf` qui compte** : `text=auto` seul
   suffirait ici (`core.autocrlf = false`), mais il laisserait un `git clone` ou
   un `git worktree add` fait avec `core.autocrlf = true` **refabriquer la dette
   entière** — c'est très exactement le piège dont le §0 du plan dit qu'il a fait
   tomber quatre agents. Le dépôt n'a **ni `.bat`, ni `.cmd`, ni `.ps1`** :
   aucun fichier n'exige CRLF, vérifié.
2. **Les 421 fichiers réécrits en LF dans la copie de travail**, par un script
   dont le critère est un **hachage**, pas une extension : il ne réécrit un
   fichier que si son contenu, CR retirés, redonne **exactement** le blob de
   l'index. **420 réécrits** (le 421ᵉ, `README.md`, l'avait déjà été par le
   `git checkout --` de la démonstration), **647 déjà identiques, 0 refusé**.
3. **Vérification** : les 1 067 fichiers hachent désormais **exactement** leur
   blob, `git ls-files --eol` rend **0 `w/crlf`**, et `git diff --stat` est
   **identique** à `git diff --ignore-cr-at-eol --stat` sur tout le travail de
   cette tâche.

⚠️ **DEUX CHOSES QUE J'AI APPRISES EN ROUTE, ET QUI COÛTERAIENT AU SUIVANT :**

- ⛔ **`git checkout-index -f -a` NE RÉÉCRIT RIEN.** Je l'avais essayé d'abord,
  comme geste git-natif : le compte de fichiers CRLF n'a pas bougé d'un. Ce sont
  `git rm --cached -r . && git reset --hard`, ou une réécriture explicite, qui
  marchent.
- ⛔ **MON PREMIER SCRIPT DE MESURE A MENTI, ET DANS LE SENS RASSURANT.** Sa
  lecture de `git ls-files --eol` annonçait **0 `w/crlf`** juste après la pose de
  `.gitattributes`, ce qui aurait pu passer pour « c'est réglé ». C'était une
  **expression régulière à moi** qui ne supportait pas le champ `attr/` devenu
  non vide (`attr/text=auto eol=lf`, avec une espace). Le hachage, lui, disait
  toujours 420. **Deux instruments, et c'est le plus simple qui avait raison.**

## 1.3 ⚠️ CE QUE ÇA CHANGE POUR QUELQU'UN QUI A DÉJÀ UN CHECKOUT

- **Rien ne bouge tant qu'il ne retouche pas ses fichiers.** Son arbre reste
  CRLF, `git status` reste vide, comme avant.
- **Au premier `git pull` qui touche un fichier**, git le ressort en **LF** :
  aucun conflit, aucun diff fantôme.
- **Pour aligner tout de suite sa copie** : `git rm --cached -r . && git reset --hard`
  (rien de non commité ne doit traîner), ou une réécriture en LF des fichiers
  concernés. **Aucune de ces deux opérations ne change un octet de contenu.**
- **Le vrai gain est pour l'agent suivant** : un `git worktree add` pour une
  campagne de mutation sort désormais en LF **quel que soit `core.autocrlf`** —
  c'est ce chemin-là qui a fabriqué de faux survivants.

⚠️ **CE QUE JE N'AI PAS TOUCHÉ, ET QUI RESTE À SAVOIR** : `test/share-page.test.js`
contient un **octet nul** à l'offset 3 514 (une chaîne de test :
`cleanRaceName('Trail\0des\x1bAiguilles')`). Git le classe **binaire**, et
`text=auto` le classera pareil. Il est déjà en LF, il ne pose aucun problème de
fin de ligne — mais **ses diffs s'afficheront comme binaires**. Signalé, non
traité : le changer voudrait dire changer le test.

---

# ② LE CHANFREIN ET LE CONGÉ

## 2.1 ⚡ LES TROIS RAISONS DE LA TÂCHE B, REPRISES UNE PAR UNE

La Tâche B avait écrit trois raisons dans l'en-tête de `parois-crop.js`. **Je ne
les efface pas, je dis ce qu'elles sont devenues.**

### ⚡ La troisième — la datante — est périmée, et elle l'est DEUX FOIS

Elle disait : *« leur garde-fou `min(x, (topMax − baseY) × 0,25)` est calibré sur
un socle à exagération 2,8. **Le globe est à 18**, donc tout rayon posé
maintenant serait à reposer. »*

1. ⚠️ **L'exagération du globe est FIXE À 2**, décision D10 (`EXAGERATION_UNIQUE`,
   `zoom-continu.js` §1 ter — Adrien, 2026-08-22 : *« une exagération d'altitude
   unique à ×2 sur toute la map »*). Vérifié sur le chemin vivant :
   `terreUniqueBranchee` entraîne `exagContinue`, qui entraîne
   `lireExageration(params)`, qui rend **2**. Il n'y a plus rien à reposer.
2. ⚡ **ET SURTOUT, LES DEUX VALEURS SONT ANCRÉES À LA LARGEUR, QUE L'EXAGÉRATION
   NE TOUCHE PAS.** Seul le garde-fou dépend de la hauteur du mur — et **il ne
   mord ni à ×2 ni à ×18** :

| relevé (relief d'essai, centre 45° N) | ×2 | ×18 |
|---|---|---|
| hauteur de mur `topMax − baseY` | 0,107 909 | 0,808 432 |
| garde-fou (¼ du mur) | 0,026 977 | 0,202 108 |
| congé demandé | 2,618·10⁻³ | 2,635·10⁻³ |
| chanfrein demandé | 4,654·10⁻⁴ | 4,685·10⁻⁴ |
| **il faudrait un mur ×N plus écrasé pour que la borne morde** | **×10,3** (congé) · **×58** (chanfrein) | ×76 · ×431 |

**Le test ⑬f mesure ces marges au lieu de les supposer, et vérifie que la borne
mord quand on l'y force** (bloc plat, profondeur au centième : `arrondi` tombe
**exactement** sur `mur × 0,25`).

### ⚡ La première est payée — la machinerie EST là

Bissectrice, onglet (`1/cos(θ/2)`) et normales analytiques du congé sont portés.
⚠️ **Sans les normales analytiques, trois segments d'arc se liraient comme trois
facettes** — « l'inverse exact de l'intention » (`plinth.js`). C'est pourquoi
`globe.js` n'appelle plus `computeVertexNormals` (§2.3).

### ⚠️ La deuxième est réelle — et je la CHIFFRE plutôt que de l'arbitrer

Elle disait que le chanfrein **entame la décision 2** (« LA BASE A LA MÊME TAILLE
QUE LE DESSUS »).

➡️ **Ce que la décision 2 interdit, c'est la CONVERGENCE RADIALE, et elle reste
interdite** : le mur garde exactement la même empreinte du pied du chanfrein au
départ du congé, **au bit près** (test ⑬b, désormais sur **trois** rangs au lieu
de deux). Ce que le chanfrein retire, c'est un retrait **CONSTANT** :

| | par côté | sur la largeur |
|---|---|---|
| chanfrein | 0,16 / 56 = **0,286 %** | **0,571 %** |
| congé | 0,9 / 56 = **1,607 %** | **3,214 %** (sur la seule hauteur du congé) |

⚡ **Ce sont les proportions EXACTES du socle d'Adrien** — c'est lui, l'objet de
référence, et c'est lui qui porte le liseré que le noteur réclame depuis la note
01. **Garder l'arête vive pour préserver une base au millimètre, ce serait
préserver la lettre contre l'objet qu'elle décrit.**

⚠️ **ET LE TÉMOIN RADIAL NE SE DISTINGUE PAS PAR SA TAILLE.** Au relevé, la
convergence radiale vaudrait **1,323·10⁻³** contre un retrait de **3,104·10⁻³** :
même ordre, rapport 2,35. **Un test qui les séparerait par un seuil ne prouverait
rien.** Ce qui les sépare, c'est que **le retrait est CONSTANT** et la convergence
**PROPORTIONNELLE À LA PROFONDEUR** ; le test triple la profondeur sur un bloc
plat — le témoin radial triple (**×3,0**), le retrait ne bouge pas (**< 0,1 %**).

## 2.2 ⛔ LA MONNAIE — LE PIÈGE PRINCIPAL DE CE PORTAGE

`SOCLE_CHANFREIN` vaut **0,16 unité de scène** sur un socle **large de 56**. Le
crop fait **0,163 unité de large**. ⛔ **Recopier `0.16` y aurait posé un
chanfrein PLUS LARGE QUE LE BLOC** (le test ⑬a mesure le témoin : `0,16 / largeur`
> 0,9). C'est la faute payée **cinq fois** sur ce chantier.

➡️ **Les deux valeurs sont donc des FRACTIONS DE LA LARGEUR**, comme
`FRACTION_PROFONDEUR = 7 / 56`, et comme `RETRAIT_EAU_CROP = (0,16 + 0,06) / 28`
de `mer-sphere.js` — **qui est déjà dans cette monnaie-là.**

⚡ **ET LA FRACTION EST LA BONNE MONNAIE POUR UNE RAISON D'ÉCRAN, PAS SEULEMENT
D'ALGÈBRE.** `plinth.js` calibre 0,16 pour que le liseré fasse *« ~3 px au cadrage
large »* sur un socle qui occupe ~1 000 px. **Les deux blocs sont cadrés pour
remplir la même fraction d'image** : à fraction de largeur égale, le liseré fait
le même nombre de pixels. Une valeur en unités de scène ne voudrait rien dire
d'un bloc à l'autre.

⚡ **ET LE VOISIN PROUVE QUE LE CHANFREIN MANQUAIT.** `RETRAIT_EAU_CROP` rentre le
rideau d'eau de **chanfrein + marge**, c'est-à-dire de la distance qui le met
**DANS le mur du socle** (`rayonEauDansSocle() = HALF − SOCLE_CHANFREIN −
SOCLE_MARGE_EAU`). **Tant que le mur du crop n'était pas rentré du chanfrein,
cette eau était rentrée d'un chanfrein DE TROP** : les deux pièces se lisaient
dans deux géométries différentes, avec un écart **3,67 fois** celui voulu. Le
test ⑬e est l'invariant qui **apparie les deux conversions** :
`RETRAIT_EAU_CROP − 2 × FRACTION_CHANFREIN` doit valoir **exactement**
`SOCLE_MARGE_EAU / 28`.

## 2.3 CE QUI A CHANGÉ DANS LA GÉOMÉTRIE

**Le profil passe de 2 rangs à 7** (`n = 1 020` points d'anneau) :

| rang | ce que c'est | rentrée |
|---|---|---|
| ⓪ | la surface — ⚠️ **le sommet du mur NE BOUGE PAS** | 0 |
| ① | le pied du chanfrein | `ch` |
| ② | **le haut de la bande d'occlusion** — voir plus bas | `ch` |
| ③ | le départ du congé (θ = 0) | `ch` |
| ④⑤⑥ | l'arc, θ = 30° · 60° · 90° | `ch + r(1 − cos θ)` |

**39 780 sommets dé-indexés** dans la page vivante, contre 9 180 avant.

⚠️ **LE RANG ② EST UN TROISIÈME CHANGEMENT, ET IL FAUT LE DÉCLARER.** Le profil
n'avait que deux rangs : l'occlusion de contact, portée en couleur de sommet,
**s'interpolait linéairement sur TOUTE la hauteur du mur** — la bande de 12 % ne
contenait aucun sommet, donc elle n'existait pas. `plinth.js` écrit le même
constat sur le socle (*« sur un mur de 33 unités l'assombrissement s'étalait sur
33 »*). Relevé à mi-bande : l'octet cuit vaut **243** avec le rang ②, **207** avec
l'interpolation à deux rangs — c'est-à-dire **un contact qui bavait sur 100 % du
mur au lieu de 12 %**.

⚠️ **LES NORMALES NE VIENNENT PLUS DE `computeVertexNormals`.** `normalesParois`
rend la normale de **FACE** partout (c'est elle qui donne au liseré sa cassure
nette) et la normale **ANALYTIQUE** sur le congé. **Elle vit dans le module PUR**,
pas dans `globe.js`, **pour une raison de preuve** : écrite là-bas, elle n'aurait
été gardée que par un `assert.match` — le trou que le tour de correction P8-P12 a
démasqué. Le test ⑬d la confronte à `computeVertexNormals` **de three** :

- hors du congé, les deux coïncident à **< 0,05°** ;
- sur le congé, elles diffèrent de **> 5°**, et **aucun** triangle d'arc ne porte
  trois normales identiques (la définition d'une facette) ;
- à θ = 0 la normale du congé vaut celle du **mur** (raccord invisible, **< 1,5°**),
  à θ = 90° celle du **fond** (`(0, −1, 0)`, à 10⁻³ près).

## 2.4 ⛔ LE MUR RENTRÉ A REOUVERT DEUX DETTES DU SOCLE — VU À L'ÉCRAN, PUIS RÉPARÉ

**REGARDE L'ÉCRAN.** Le chanfrein posé, `P5-zoom6-CROP-base-AVEC-P13.png` portait
des **langues bleues DANS le mur** et des traînées **sous son bas** ;
`P6-…-SANS-P13.png`, rebâti **à la même seconde dans la même page** avec
`fractionChanfrein: 0, fractionArrondi: 0`, n'en portait aucune.

⚡ **C'est mot pour mot le défaut que `plinth.js` raconte sur le socle** : *« LE
DÉFAUT DU 2026-08-03, on voit l'eau à travers le bloc — élargir le chanfrein à
0,16 a ramené le mur à 27,840, donc DERRIÈRE l'eau »*. **Rentrer le mur rouvre
tout ce qui pendait au rayon d'avant.**

**Mesuré avec l'instrument du noteur (`bandeDuMur`, P7), SOUS le bas du mur :**

| état | mer | tuiles |
|---|---|---|
| avant P13 (arêtes vives) | **0 px** | **0 px** |
| chanfrein seul | 0 px | 10 px / 4 langues |
| congé seul | **465 px / 4 langues** | 38 px / 4 langues |
| ⛔ **livré, avant réparation** | ⛔ **792 px / 4 langues** | ⛔ **82 px / 4 langues** |
| ⚡ **livré, après réparation** | ⚡ **0 px / 0 langue** | ⚡ **0 px / 0 langue** |

➡️ **Deux réparations, et la parade est celle de `plinth.js` : une définition de
« où finit le bloc », LUE et non devinée.**

1. **LE RIDEAU D'EAU.** `construireJupeMer` accepte un `retraitBas` : son haut
   reste soudé au bord de la calotte (`bordDeMer` lit le même `retrait`), son bas
   se glisse derrière le congé. Sans `retraitBas`, le rideau est **DROIT au bit
   près** ; un `retraitBas` plus petit que `retrait` est **BORNÉ** — il ne peut
   jamais faire RESSORTIR le rideau. `construireParoisCrop` publie
   `_retraitBaseCrop`, `poserMer` y ajoute `MARGE_EAU_CROP`.
2. **LE PLANCHER DES JUPES.** `_rayonPlancherCrop` lit désormais le **SOMMET DU
   CONGÉ**. ⚡ **La cause a été PROUVÉE PAR EXTINCTION** : les jupes éteintes par
   `setDrawRange`, `sousLeMur` tombe de **82 à 0**, et **l'image revient au canal**
   quand on les rallume.

---

## 3. ⚡ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

**Protocole, celui du noteur, sans une ligne de plus** : socle **rallumé dans la
même page** (`montrerSocle`), appariement sur un **CLONE de caméra** balayé
jusqu'au même compte de pixels, **octet linéaire** déclaré, masques par
**extinction**. Appariement du bloc entier : cible **210 914**, socle **210 856**,
écart **−0,0275 %**.

⚡ **L'A/B DU CROP EST À TÉMOIN NUL, DANS LA MÊME EXÉCUTION JS** : on rebâtit les
parois avec les deux fractions à zéro — les arêtes vives d'avant P13 — puis on
remet. **Témoin : 45 365 canaux sur 4 096 000. Retour : 574 canaux (0,014 %),
soit 1,3 % du témoin.** ⚠️ **Je ne prétends pas que le retour est nul** : il ne
l'est pas depuis que le rebâtissage retaille les jupes, probablement parce que
l'ordre de dessin des tuiles à couverture douce change quand le maillage des
parois quitte et rejoint le groupe. **Cet écart borne la précision de cet A/B, et
il est 79 fois plus petit que ce qu'il mesure.**

### 3.1 ⚡ LE LISERÉ D'ARÊTE HAUTE — IL EST LÀ, ET IL SE MESURE

Pour chaque colonne d'écran où le mur est présent, luminance moyenne à `d` lignes
sous son **sommet**, normalisée par la **médiane du mur** (728 colonnes) :

| d = | 0 | 1 | 2 | 3 | 4 | **excès de la ligne de crête** |
|---|---|---|---|---|---|---|
| ⚡ **CROP, livré** | **1,583** | 0,766 | 0,718 | 0,705 | 0,705 | ⚡ **+58,25 %** |
| CROP, arêtes vives (même seconde) | 0,942 | 0,683 | 0,677 | 0,675 | 0,675 | **−5,80 %** |
| SOCLE (arête haute) | 0,572 | 0,642 | 0,647 | 0,650 | 0,654 | −42,81 % |

➡️ ⚡ **LE CROP PORTE MAINTENANT UNE LIGNE DE CRÊTE DE UN PIXEL, 58 % PLUS CLAIRE
QUE SON MUR, LÀ OÙ IL N'AVAIT RIEN.** Le profil retombe dès la ligne 1 : c'est
**un fin liseré**, pas une facette.

**Ce que ça donne à l'œil** (`P5-zoom6-CROP-base-AVEC-P13.png`, ×6) : une ligne
**orange-rouge** court le long de l'arête haute du mur. ⚠️ **Elle est POINTILLÉE,
pas continue** — le chanfrein fait ~2 px de profondeur à ce cadrage, et la
rastérisation en perd la moitié. Sur `P6-…-SANS-P13.png`, pris à la même seconde :
**rien, une arête franche sur un aplat**.

### 3.2 ⛔ ET CE QUI NE MARCHE PAS : LE LISERÉ DE **BASE** DU SOCLE

⚠️ **J'AI REGARDÉ LA CAPTURE DU NOTEUR AVANT DE CONCLURE.** Sur son
`D2-zoom-SOCLE-arete-N03.png`, la ligne orange qu'il décrit court **le long de
l'arête BASSE**, pas de la haute — c'est son **congé**. Mesurer la seule arête
haute aurait comparé deux choses différentes. J'ai donc mesuré les deux bords :

| profil depuis l'arête BASSE, d = | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **SOCLE** | 0,711 | ⚡ **0,961** | 0,691 | 0,626 |
| CROP livré | 0,370 | 0,551 | 0,654 | 0,662 |
| CROP arêtes vives | 0,582 | 0,586 | 0,590 | 0,599 |

➡️ ⛔ **LE SOCLE A UN VRAI PIC À LA LIGNE 1 (0,711 → 0,961 → 0,691) ; LE CROP N'EN
A PAS.** Son congé rend une montée monotone. **Le geste du bas n'est donc PAS
reproduit**, et je ne prétends pas le contraire.

⚠️ **Et je ne sais pas pourquoi, honnêtement.** La géométrie est la même (arc à
3 segments, rayon 0,9/56, normales analytiques vérifiées). Ce qui diffère, c'est
**l'éclairage** : la paroi du socle est un `MeshPhysicalMaterial` sous les trois
sources de studio, celle du crop un nuanceur qui applique `irradianceCrop`. **Le
critère ⑤ du noteur porte déjà cet écart** (p20 ×1,125, contraste ×1,224, non
fermés). **Le congé du crop est de la géométrie qui attend son éclairage.**

### 3.3 ⛔ LES CINQ TRAÎNÉES PÂLES — CE QUE JE NE FERME PAS

Sur `P5-zoom6-CROP-base-AVEC-P13.png`, **cinq traînées verticales pâles** courent
sur toute la hauteur du mur. ⚡ **Cause PROUVÉE, pas supposée** : les jupes de
tuiles éteintes par `setDrawRange`, **elles disparaissent entièrement**
(`P9-zoom6-CROP-sans-jupes-P13.png`) — et le chanfrein, lui, reste.

⚠️ **ET LE COMPTE DIT QUELQUE CHOSE QUE L'ŒIL NE DIT PAS.** Les jupes cachent
**6 110 px** de mur dans l'état livré et **6 560 px** dans l'état d'avant P13 :
**elles n'en couvrent pas plus.** Ce qui a changé, c'est qu'avec le mur rentré
elles **gagnent proprement le test de profondeur** et se lisent comme cinq lignes
continues, au lieu d'une poignée de pixels en lutte. **C'est une régression
d'apparence, pas de surface**, et elle est **au crédit du chanfrein**.

➡️ **Je ne la ferme pas, et je dis pourquoi.** La jupe pend **à l'aplomb du bord
de la tuile**, donc au rayon de l'anneau ; le mur est **`ch` en dedans à toute
hauteur**. Aucun réglage de la LONGUEUR de jupe ne peut réparer un décalage
LATÉRAL. Les sorties possibles, aucune mesurée : supprimer la jupe des tuiles que
la frontière du crop TRAVERSE (leur service anti-fente y est couvert par le mur),
ou rentrer les tuiles de `ch` — **ce qui rouvrirait l'accord surface/paroi que le
§3 de `parois-crop.js` protège**. C'est une tâche, pas une correction.

---

## 4. LA CAMPAGNE DE MUTATION — 42 / 42, ET SEPT SURVIVANTES QUI ONT SERVI

**42 mutations sémantiques, 35 visant le BRANCHEMENT (83,3 %)**, posées EN PLACE,
test rejoué sur cinq fichiers, `git checkout --` puis `git diff --stat` vérifié
**vide** entre chacune. Trois tours : **28/34 · 40/42 · 42/42**.

| | mutation survivante | ce qu'elle a montré |
|---|---|---|
| **M20** | le couvercle-témoin s'accroche au centre du FOND | ⛔ **UN VRAI TROU DU CODE.** `Ā` ne dépend que du **BORD** de la coque : la fermeture restait verte sur un solide qui se traverse lui-même, avec un **volume faux**. Nouveau test ⑬f bis — le volume audité doit changer de **> 5 %** quand on déplace l'apex |
| **M27** | le SIGNE de l'horizontale de la normale du congé | mon test ne vérifiait que *« la normale à θ = 0 est horizontale »* — **ce que la normale RETOURNÉE est aussi**, elle regarde simplement DEDANS. Elle est désormais confrontée à la normale de FACE du mur |
| **M29** | la normale du PREMIER sommet recopiée sur les trois | ⚡ **UNE FAUTE DE PRÉCISION DANS MON PROPRE TEST** : le détecteur de facette comparait un ANGLE à 10⁻⁶ degré, et `acos` du produit scalaire d'un vecteur `Float32` **par lui-même** rend jusqu'à **0,015°**. La mutation ne rendait que **1 944 des 6 120** triangles sous ce seuil. L'égalité se teste maintenant **sur les octets** |
| **M30** | `triArc: 0` dans l'objet retourné | ⛔ **L'ORACLE SUIVAIT LA MUTATION** : le test LISAIT `s.triArc` pour décider où est le congé. Il est maintenant vérifié contre un critère **indépendant** — un triangle est sur le congé ssi ses trois sommets sont sur un rang d'arc |
| **M33** | l'occlusion de contact remplacée par un tableau plein de 255 | **personne ne suivait `aoCrop` jusqu'à la géométrie POSÉE** — c'est pourtant elle qui *« fait lire objet posé plutôt que carte flottante »* |
| **M38** | `retraitBas` posé **sans** `MARGE_EAU_CROP` | le bas rentrait quand même (le congé pèse 3,9 fois la marge), mais venait se poser **EXACTEMENT sur le mur** au lieu de rester dedans, et mon test ne vérifiait que le **SIGNE**. Il exige maintenant le **rapport exact** des deux homothéties |
| **M41** | `_plancherJupeCrop` posé **sans** le congé | **personne ne lisait ce champ**, celui qui empêche les jupes de dépasser sous le mur |

⚠️ **Et une mutation (M24) n'avait pas été POSÉE** — chaîne cible mal indentée, le
banc l'a dit au lieu de la compter en survivante. Corrigée, puis tuée.

⚡ **LE TEST ⑬h EST CELUI QUE LA LEÇON N° 3 EXIGEAIT.** Il monte le `Globe`
minimal et **APPELLE `construireParoisCrop`** ; il compare l'attribut `normal` de
la géométrie **posée** à `normalesParois`, et porte son propre témoin
(`computeVertexNormals` doit rendre autre chose). **Remettre `computeVertexNormals`
dans `globe.js` tombe là, et nulle part ailleurs** — M31 et M32 le vérifient.

---

## 5. ⚡ LA MESURE EN MOUVEMENT — PUBLIÉE, PARCE QUE J'AI TOUCHÉ À LA GÉOMÉTRIE

Scripts du noteur **rejoués tels quels** (`n3-mouvement.js`, `n5-…js`), même
protocole : `setViewOffset` d'un nombre **entier** de pixels, recalage cherché de
−3 à +3, masques érodés de 4 px.

**Plancher à `dx = 0` : 0,000 des DEUX côtés. Le recalage tombe sur le décalage
demandé dans les 24 cas. Retour exact à 0 canal dans les 24 séries.**

**Cadrage intérieur, masque des tuiles** (crop 134 716 px, socle 136 343) :

| décalage | SOCLE | **CROP ON** | CROP OFF | | ⚡ état attendu | noteur, note 04 |
|---|---|---|---|---|---|---|
| **dx = 1 px** | **0,0287** | ⚡ **0,8248** | 0,8717 | | **≈ 0,82** · socle **≈ 0,03** | 0,8180 · 0,0321 |
| dx = 2 px | 0,0010 | 0,7922 | 0,8380 | | | 0,7798 · 0,0014 |
| **dx = 3 px** | 0,0287 | **0,8255** | 0,8726 | | | 0,8196 · 0,0324 |
| pixels instables à dx = 1 | 53 | ⚡ **10** | 7 | | | 11 · 66 |

➡️ ⚡ **L'ÉTAT ATTENDU EST RETROUVÉ.** `0,8248` pour ≈ 0,82 (**+0,8 %**), socle
`0,0287` pour ≈ 0,03. ⚡ **AUCUNE SIGNATURE DE PARITÉ** : le micro-écart
pair/impair du crop (0,8248 · 0,7922 · 0,8255) est **exactement celui de la
colonne OFF** (0,8717 · 0,8380 · 0,8726) — c'est le plancher du reste du
nuanceur, pas une signature de maillage.

**Et sur la mer, cadrage côte** (crop 64 698 px, socle 64 567) : dx = 1 → socle
**0,0079**, crop **0,3887** (noteur : 0,0076 · 0,3617, soit **+3,9 %** et
**+7,5 %**, dans la bande de bruit inter-chargement que le noteur déclare lui-même
à **+6,3 %** sur son propre témoin) ; pixels instables **1** contre 9 chez lui.

---

## 6. ⛔ NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

**Mettez `P1-CROP-bloc-P13.png` à côté de `P1-SOCLE-bloc-apparie-P13.png`.** La
famille de couleurs est la même, la paroi est du même rouge, le relief est le
même. Ce qui sépare encore les deux images, **sur MES captures** :

- ⛔ **le crop porte cinq traînées pâles verticales sur son mur**, le socle
  aucune (§3.3 — cause prouvée : les jupes de tuiles) ;
- ⛔ **le liseré du BAS du socle n'est pas reproduit** (§3.2) ;
- ⚠️ **le liseré du HAUT du crop est POINTILLÉ**, celui du socle est continu ;
- **le contraste inter-faces reste ×1,22 en faveur du socle** (2,4828 contre
  3,0321) — inchangé, ce n'était pas ma tâche ;
- **sa mer reste une plaque à pavage rectangulaire**, sa silhouette une courbe
  lisse contre les aiguilles du socle, son relief sans rivière. **Rien de tout
  cela n'a bougé.**

### Ce que je ne ferme pas

**Le pavage rectangulaire** (`CHAMP_FOND`, neuf fois `remplirHauteurs`) · **la
silhouette** (29 978 sommets, ×10,7 par axe) · **la lame d'eau 1,34× trop claire**
· **les 50 matières de parois** · **le cartouche** · **les cinq traînées de jupe**
(§3.3, neuve, mesurée, cause nommée) · **le liseré de base** (§3.2, neuve).
⚖️ `uContourOpacity = 0` **des deux côtés**, **ombre portée 0 px des deux côtés**.

---

## 7. MES RÉSERVES

1. ⚠️ **Le retour de l'A/B n'est pas nul : 574 canaux sur 4 096 000 (0,014 %).**
   Il l'était avant que le rebâtissage des parois retaille les jupes. Je ne l'ai
   pas expliqué au-delà d'une hypothèse (l'ordre de dessin des tuiles à couverture
   douce). **Il borne la précision de la comparaison avec/sans**, et il vaut
   **1,3 %** de ce que cette comparaison mesure.
2. ⚠️ **Le banc de `test/crop-parois.test.js` tourne encore à l'exagération 18**,
   alors que **le chemin livré est à 2**. C'est un choix conservateur (mur plus
   haut, garde-fou plus loin), pas une erreur — mais son commentaire
   `EXAG = 18 // globe.js, params.globeExaggeration ?? 18` **décrit le chemin
   SANS `?terre=unique`**, pas celui du crop. Le test ⑬f mesure aux **deux**
   exagérations pour cette raison. **Je n'ai pas changé le banc** : cela toucherait
   des dizaines d'assertions écrites sur ces chiffres.
3. ⚠️ **La ligne de crête est mesurée sur UN cadrage, UNE heure, UN lieu** — La
   Réunion z12, cadrage côte de la notation-01. Le chanfrein fait ~2 px là ; à un
   cadrage plus large il passera sous le pixel, comme `plinth.js` le dit du socle
   à 0,05.
4. ⚠️ **`chanfreinSeul` n'est PAS un état propre** : sans congé, le plancher de
   jupe retombe sur le fond du bloc et les jupes dépassent de **10 px / 4 langues**.
   **L'état livré est propre parce que le congé est là.** Si quelqu'un met
   `fractionArrondi` à 0, il rachète ces 10 px. Dit ici pour que ce ne soit pas
   une surprise.
5. ⚠️ **Je n'ai pas mesuré le coût en mémoire ni en temps** des 39 780 sommets
   (contre 9 180). La géométrie ne se rebâtit qu'à l'arrêt — mais je n'ai pas
   chronométré `construireSolideCrop`, qui balaie désormais 7 rangs au lieu de 2.
6. ⚠️ **Je n'ai pas rejoué les campagnes de mutation des tâches précédentes**, ni
   audité les centaines d'`assert.match` du dépôt. Mes 42 mutations ne bornent que
   ce qu'elles couvrent.
7. ⚠️ **Deux assertions de SOURCE ont été assouplies** (`globe-precision` P7,
   `mer-sphere` ⑭i). Elles exigeaient deux lignes **COLLÉES** et interdisaient donc
   toute écriture entre elles ; elles gardent désormais l'**ORDRE**. C'est un
   affaiblissement réel, et je le dis : ce qu'elles gardaient de plus était
   l'adjacence, qui n'est pas une propriété du programme.
8. ⛔ **Je n'ai rien mesuré sur les autres postes du noteur** — la mer, la
   silhouette, le pavage, la rampe. Les chiffres de profil de paroi que je publie
   (p20, contraste) sont **inchangés au millième** par rapport à la note 04, ce qui
   est cohérent avec le fait que je n'ai touché ni à la couleur ni à l'éclairage.

---

## 8. Isolement — état rendu

- **Aucun worktree créé** ; mutations posées en place, rendues immédiatement,
  `git diff --stat` vérifié vide entre chacune.
- **`git status --porcelain` vide** au début, entre chaque mutation, et à la fin.
- **Le banc est dans `.banc/P13/`** (`.gitignore:44`) : rien n'en sort.
- **Le serveur de développement (5503) et le récepteur (5613) ont été arrêtés**,
  `netstat` vérifié ensuite.
- **Cinq commits**, tous en `i/lf w/lf`, et l'arbre entier ne porte plus un seul
  fichier `w/crlf`.
