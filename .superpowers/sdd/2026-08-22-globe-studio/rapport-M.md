# Rapport — Tâche M : LA MORT DES PALIERS

**Statut : LIVRÉE.**
**Hash : `a0e0499`** (branche `regroupement`, **commit unique**, arbre propre après).
**Diff : 1 603 insertions, 74 suppressions, 10 fichiers** — ⚠️ **et `git diff --stat` rend
EXACTEMENT le même compte que `git diff --ignore-cr-at-eol --stat`** : pas une ligne de gonflage
CRLF (382 des 533 fichiers de l'arbre sont CRLF, tous les blobs sont LF ; deux rapports de ce
chantier ont annoncé 1 541 lignes pour 87 réelles et 710 pour 34).
**Tests : `npm test` → 3 845 verts, 0 rouge** (3 806 avant, **+39**) · **`npm run audit:tests` → 206/206**
· `node --check` sur les cinq fichiers de `src/` touchés · page chargée **drapeau levé ET baissé**
(relevés au §9).
**Mutation : 42/42 tuées au troisième tour**, témoin vert — worktree `C:/Dev/wt-mut-M`, **retiré en partant**.

---

## 0. Le résultat, en une ligne

**Une descente complète de l'orbite au sol — 1 600 km → 506 m, 1 158 images relevées dans
l'application vivante — ne contient AUCUN saut d'altitude et AUCUN rechargement de tuile déjà
prête.** Le pire rapport d'une image à la suivante sur toute la descente vaut **1,026**, et il
tombe pendant le glissé orbital ordinaire, **pas** à une transition.

Le même trajet, drapeau basculé **en direct dans la même session**, rend **deux discontinuités
franches** — **×3,2000** et **×1,1429** — et **616 tuiles prêtes rendues au réseau**.

---

## 1. ① LA LOI DE ZOOM — ET LE DÉPÔT CONFONDAIT DEUX GRANDEURS

`STEP_IN = STEP_OUT = Math.LN2 / 2` (`src/modes.js`), comme le cahier des charges le demande.

⚠️ **MAIS LA CAUSE DU « deux fois trop » N'EST PAS UN CHIFFRE MAL CHOISI : C'EST UN NOM POUR DEUX
CHOSES.** `STEP_IN` servait à la fois de **budget de niveau de MNT** et de **pas de cran**, et une
seule des deux est libre :

| grandeur | valeur | libre ? |
|---|---|---|
| **le CRAN** — `STEP_IN`, `STEP_OUT` | **`Math.LN2 / 2`** = ×√2 | **oui — c'est la mesure d'Adrien** |
| **le NIVEAU de MNT** — `BUDGET_NIVEAU` (nouveau) | `Math.LN2` = ×2 | **non — c'est la grille de tuiles** |

Le commentaire du dépôt le démontrait lui-même sans en tirer la conséquence : *« un cran de zoom
divise l'emprise du bloc par deux — soit `ln 2` de distance, et rien d'autre »*. C'est vrai **du
niveau**, et c'est ce qui rendait `Math.LN2` indéboulonnable tant que les deux partageaient un nom.
➡️ **Les deux sont séparés ; `Math.LN2 / 2` est posé là où il devait l'être.**

⚠️ **LA MOLETTE N'A PAS BOUGÉ D'UN BIT.** `ZOOM_IMPULSE` dérive désormais de `BUDGET_NIVEAU` : le
cahier des charges dit *« le réglage porte sur le CRAN, pas sur le tour de molette »*, et le dériver
du cran l'aurait divisée par deux sans que personne l'ait demandé. Les « vingt crans par niveau »
d'Adrien sont conservés à l'identique.

**Ce que le test vérifie, en RECALCULANT au lieu de recopier** (`test/zoom-continu.test.js` ①) : des
deux seules bornes publiées du relevé (63 170 km, 126 km) et des 18 intervalles, la moyenne
géométrique se recalcule à **1,412 56**, et √2 en est à **0,117 %**. Le rapport est **constant** au
bit près ; ce qui rétrécit est l'écart en kilomètres — **18 502 km au premier cran, 51 km au
dernier**.
⚠️ **Ces deux derniers chiffres sont ceux du √2 PUR, pas du relevé.** Adrien a compté 18 153 et 51 ;
le modèle √2 rend 18 502 et 51. **C'est pour cela que le relevé n'est pas recopié dans le test.**

---

## 2. ③ D10 — L'EXAGÉRATION FIXE, ET CE QU'ELLE SUPPRIME

`creerExagerationPartagee({ constante })` : posée, **les trois écrivains rendent la main sans
écrire**. `globe.majExageration` n'appelle `setExaggeration` — donc `_rechargeTuiles`, donc la
planète entière rendue au réseau — **que si la valeur a bougé**. Une constante ne bouge pas.

- La constante est posée **à la construction du partage**, et `globe.js` lit
  `lireExageration(params)` **à la construction du globe** : il naît donc déjà à ×2. Naître à 2,8
  pour être posé à 2 à la première image aurait coûté **un rechargement complet au démarrage** — le
  seul qu'on ne voit pas passer, et le plus cher.
- ⚠️ **`terreUniqueBranchee` a dû REMONTER dans `main.js`** (avant `exagPartage`) : un `const`
  déclaré à son ancienne place était dans la **zone morte** au moment de
  `creerExagerationPartagee`. **Le drapeau reste lu UNE seule fois** — `test/crop-branche.test.js`
  ⑧ septies l'exige, et passe.
- **`src/monde/exageration-continue.js` n'est PAS supprimé** : sa courbe, ses ancres et ses
  quatorze lecteurs servent au chemin plat et sont gardés par des tests. **Il rend la constante sur
  ce chemin-là, et rien d'autre.**
- ⚠️ **Le portage du relief au nuanceur de sommets est DIFFÉRÉ, pas abandonné.** Il redeviendrait
  nécessaire le jour où l'exagération redeviendrait un réglage vivant. **Le piège central reste
  vrai et mérite d'être noté pour ce jour-là** : le RTC du globe pose son origine sur la surface
  **DÉPLACÉE** (`globe.js:2993`) ; si le déplacement passe au GPU, **le CPU ne connaît plus la
  hauteur dont l'origine dépend**. Ce n'est pas un détail d'implémentation, c'est la question à
  trancher en premier.

**Mesuré dans l'application vivante**, même session, drapeau basculé en direct
(`__exp.params.exagPartage.constante = null`) :

| | `_rechargeTuiles` | tuiles PRÊTES rendues au réseau | exagération vue |
|---|---:|---:|---|
| **AVANT** — descente à rafales | **2** | **616** | 2,8 → 3,2 |
| **AVANT** — même geste continu | **1** | **1 700** | 2 → 2,8 |
| **APRÈS** | **0** | **0** | **2 partout** |

⚠️ **DÉNOMINATEUR.** « Tuiles rendues au réseau » = le nombre de tuiles à l'état `ready` **au moment
où `_rechargeTuiles` est appelée**, compté par un crochet posé sur elle. Ce n'est **pas** un nombre
d'octets, et **pas** le nombre de requêtes qui suivront (`_tileMemo` en rachète une part). Données
brutes : `.banc/vues-M/AV-rafales.json`, `.banc/vues-M/AV-continu-echec.json`,
`.banc/vues-M/AP-descente.json`.

⚠️ **`rechargeApresContexte()` est intact** — second appelant de `_rechargeTuiles`, légitime et
rare ; un test le garde.

---

## 3. ② LA MORT DES PALIERS — ET OÙ ÉTAIT VRAIMENT L'ACCROCHAGE

### 3.1 L'inventaire, ligne par ligne

| ce que le cahier des charges nomme | ce qui a été fait |
|---|---|
| `DIVE_TIERS` / `pickDiveTier` | **plus consultés** sous le drapeau pour la plongée à la molette : la porte orbitale devient **géométrique** (`niveauDArrivee`), et l'attente de stabilisation (`settled`, ±6 %) disparaît avec elle |
| l'indicateur `ORB` / `Z{n}` | **plus construit** sous le drapeau (`zoomStepper` vaut `null`) |
| `_orbitNotch(dir)` et son facteur **1,7** | **SUPPRIMÉ**, remplacé par `cranZoom(dir)` — la même loi ×√2 en orbite et en surface, ce qui est la moitié de « une seule caméra » |
| `poseCranContinu()` | **plus appelée** sous le drapeau (voir §3.3) |
| `escalier-zoom.js` **entier** | ⛔ **NON — et deux de ses cinq exports n'ont rien à voir avec les paliers.** Voir §6 |
| `niveauDePlongee()` — « à vérifier avant retrait » | **conservée** : elle sert au chemin plat et à `test/camera-continue.test.js` |

### 3.2 Ce qui produisait la sensation de cran, et qui n'était pas dans la liste

⚠️ **TROIS DES QUATRE CAUSES N'ÉTAIENT PAS DANS L'INVENTAIRE, ET CE SONT CELLES QU'ON SENT :**

1. **le glissé BUTAIT** au bout du niveau (`atInLimit` / `atOutLimit`) et il fallait **re-défiler**
   pour franchir — c'est écrit noir sur blanc dans `modes.js` : *« le zoom s'arrête au max de la
   zone, on re-scroll pour passer »*. **Mesuré : avec un défilement CONTINU, le chemin d'avant ne
   franchit JAMAIS un niveau** (§4.3) ;
2. **`_resetZoom()` tuait l'élan à chaque cran** — le glissé repartait de zéro de l'autre côté ;
3. **`busy` gelait le zoom** pendant tout le `loadSurface` du franchissement ;
4. **le rideau blanc** de `_whiteout` — 480 ms d'aller, 480 ms de retour, à chaque traversée.

Les quatre sont débranchées sous le drapeau. Le franchissement devient **automatique**
(`_franchirSiBesoin` : une division par `PAS_NIVEAU`, aucune table), avec une **hystérésis
symétrique d'un facteur 2 donnée par la troncature** — aucun seuil à régler, aucun battement
possible.

### 3.3 ⚠️ L'ACCROCHAGE N'EST PAS CELUI QUE LE CAHIER DES CHARGES DÉSIGNE

Le cahier des charges dit : *« `poseCranContinu()` […] repose la caméra à `camY × facteurEchelle` à
chaque cran : c'est LUI l'accrochage. »* **La reposition est nécessaire** — l'unité du monde vient
de changer, un cran divise l'emprise du bloc par deux. **Ce qui est faux, c'est la GRANDEUR qu'elle
conserve.**

Sous `?terre=unique`, la caméra qu'on voit n'est pas celle du bloc : c'est **`camGlobe`**, posée par
la similitude de `monde/frontiere-rendu.js`, dont le facteur est **horizontal**. L'altitude qu'elle
occupe vaut `camY × emprise / span` — c'est **`altitudeFondM`**, déjà exportée par ce module et déjà
décrite comme « ici pour être mesurable et mutable », et **c'est la seule grandeur dont un saut se
voit à l'écran**.

`poseCranContinu` conserve l'**autre** : `camY × (échelle verticale après / avant)`, où l'échelle
**porte l'exagération**. L'altitude de fond est donc multipliée par le **rapport des exagérations** :

| cran | exagérations | saut de la vue |
|---|---|---:|
| z4 → z5 | 2,5 → 5 | **×2** |
| z5 → z6 | 5 → 4 | ×0,8 |
| z6 → z7 | 4 → 3,2 | ×0,8 |
| z7 → z8 | 3,2 → 2,8 | ×0,875 |

**Et la plongée conservait la mauvaise altitude elle aussi** — `loi-altitude.js` le savait et
l'appelait *« une question, pas un oubli »* : le champ visuel saute d'un facteur `exagération(z)` à
la traversée. **Sous D10 il vaudrait encore ×2.** ➡️ **`_posePlongee` conserve désormais l'altitude
de FOND sur ce chemin.**

➡️ **L'invariant posé par cette tâche est `altitudeFondM`, donc le rapport des EMPRISES, donc plus
du tout l'exagération. La continuité survivrait si D10 était un jour rapportée.**

### 3.4 ⚠️ ET LA CONVERSION A CHANGÉ DE PLACE — ce qui ferme au passage un défaut mesuré ailleurs

Elle vit maintenant dans **`_suivreEmprise()`**, appelée **en tête de `modes.update(dt)`**, et elle
se déclenche sur **tout** changement d'emprise, quel qu'en soit l'auteur : cran, plongée, vol,
gabarit, ou l'arrivée du MNT derrière la fenêtre (écart mesuré par le dépôt : 6,9·10⁻⁵ à z12,
**3,5 % à z5** — un vrai changement d'unité, pas du bruit).

**Pourquoi là** : `main.js` documente, journal par image à l'appui, que **`largeurBlocM()` est
divisée par deux UNE IMAGE AVANT que `_rescale` ne double `camera.position.y`** — et que cette
image-là a produit **onze bascules du seuil du socle au lieu d'une**. En suivant l'emprise image par
image, la conversion tombe sur **la même image** que le changement. `modes.update(dt)` court avant
`majSeuilSocle()` et `majCameraFond()` : **personne ne lit l'altitude à moitié.**

### 3.5 Un défaut d'ordre trouvé par le banc, pas par la relecture

`_niveauDePlongee` plaçait la branche continue **après** une garde qui exige
`hooks.echelleVerticaleAuZoom` — un crochet que cette branche **n'emploie pas** (c'est tout son
objet : l'exagération n'entre plus dans la traversée). Le repli de cette garde était le **zoom
FIN** : sans le crochet, la plongée depuis 1 600 km atterrissait à **z15**. La branche passe
désormais avant. ⚠️ **En production le crochet existe, donc ce n'était pas visible à l'écran** — je
ne le compte pas comme un défaut corrigé, mais comme une fragilité retirée.

---

## 4. LE COMPTAGE DES SAUTS — le patron de la Tâche 1a, refait

### 4.1 Le banc, et pourquoi il en fallait un nouveau

⚠️ **`test/camera-continue.test.js` ET `test/escalier-surface.test.js` NE POUVAIENT PLUS RIEN
VOIR** : ils rejouent `altitudeSurfaceM`, que le cran **conserve par construction** depuis la
Tâche 2 bis. Le nouveau banc (`profilDescenteFond`, `test/zoom-continu.test.js` ⑤) rejoue
**`altitudeFondM`**. Les deux régimes passent par **le même code de parcours** ; seule la loi change.

| profil rejoué (Mont-Blanc, 1 600 km → sol) | sauts ≥ 1,15 | sauts ≥ 1,003 |
|---|---:|---:|
| régime « paliers » (le dépôt) | **≥ 4** | **≥ 4** |
| régime « continu » (cette tâche) | **0** | **0** |

⚠️ **DÉNOMINATEUR DU SEUIL.** Le profil échantillonne les segments continus à ×1,002 d'un point au
suivant : **un seuil sous 1,002 compterait l'échantillonnage lui-même comme un saut** — essayé à
1,001, il rend **360 « sauts », tous faux**. **1,003 est le plus fin que cet instrument résolve**,
et c'est écrit dans le test.

### 4.2 L'application vivante — A/B apparié, même session, drapeau basculé en direct

Protocole : `http://localhost:5503/?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`,
fenêtre 1 280 × 800, **`fov = 33` lu en direct** (le code dit 30), départ `enterOrbit(1 600 km)`,
molette synthétique sur le canevas, **une trace par image**. Données brutes :
`.banc/vues-M/AP-descente.json`, `.banc/vues-M/AV-rafales.json`.
Dépouillement : `.banc/analyse-M.mjs`, `.banc/glisse-vs-transition-M.mjs`.

⚠️ **ON PARTITIONNE LE GESTE ET LA DISCONTINUITÉ**, sinon un glissé rapide se lirait comme un saut.
« Glissé » = les paires d'images où **ni** le zoom **ni** le mode ne changent ; « transition » =
celles où l'un des deux change.

| | images | pire rapport du **glissé** | transitions | pire rapport d'une **transition** |
|---|---:|---:|---:|---:|
| **APRÈS** | 1 158 | 1,019 6 | 13 | **1,026 2** — le glissé orbital, pas une traversée |
| **AVANT** (rafales) | 1 318 | 1,063 4 | 12 | **3,200 0** |

**AVANT, les deux discontinuités et leur cause, à la quatrième décimale :**

- `orbital z7 → surface z7` : **×3,2000** — c'est **exactement `exagération(z7) = 3,2`**, la
  prédiction de `loi-altitude.js`, retrouvée à l'écran ;
- `surface z7 → surface z8` : **×1,1429** — c'est **exactement 3,2 / 2,8**, le palier d'exagération ;
- **les neuf autres crans rendent 1,0000** : `poseCranContinu` compense parfaitement **là où
  l'exagération ne change pas**. C'est ce qui rendait le défaut si difficile à voir.

**APRÈS : la traversée `orbital → surface` rend 1,0000, et les douze crans rendent 1,015 à 1,020 —
c'est-à-dire le glissé lui-même, pas le cran.** Zéro recul d'altitude sur 1 158 images (le dépôt en
avait : *« 685 623 m rendus à l'envers sur une descente de 1 600 km »*). **12 images sur 1 158**
portent `busy` — et le glissé y court quand même.

### 4.3 ⚠️ UN CONSTAT QUE JE N'ATTENDAIS PAS, ET IL EST GRAVE

**Avec un défilement CONTINU — le geste le plus naturel qui soit —, le chemin d'avant ne descend
pas : il s'écrase sur la planète en mode orbital.** Mesuré : `orbAltTarget` tombe à
**1,4 × 10⁻⁹ m** et la caméra reste collée à `distance = R_GLOBE`, **sans jamais plonger**, parce
que le dive exige que le zoom se **pose** (`settled`, ±6 %) — ce qu'un défilement continu ne fait
jamais. Quand le défilement s'arrête, elle plonge d'un coup et atterrit à **z17, distance 6, la
butée dure**, avec une altitude d'altimètre de **−3 945 m : sous le sol.**

⚠️ **CE N'EST PAS UNE RÉGRESSION DE CETTE TÂCHE** — la branche fautive est celle du dépôt, laissée
intacte, et `ALT_PLANCHER_ORBITALE_M = 0` est antérieur (Tâche 1b). **Mais c'est le défaut v42 qui
revient, et il est atteignable par un geste ordinaire.** Le chemin continu n'y tombe pas : la porte
est géométrique et ne demande aucune stabilisation.

⚠️ **CE RUN N'EST PAS COMPARÉ AU NÔTRE.** Son trajet n'est pas le même — la caméra ne fait pas la
même chose —, donc ses « 969 sauts » ne sont **pas une monnaie commune** avec les 0 du régime
continu, et ils ne sont écrits nulle part comme tels. **C'est un constat séparé.** Données brutes :
`.banc/vues-M/AV-continu-echec.json`.

---

## 5. ④ N'AMÉLIORER QUE LA ZONE VISÉE

### 5.1 La mesure AVANT, dans l'application vivante

Descente complète 1 600 km → 3 km, chaque appel à `globe._request` classé par `tuileDansCrop` :

| | tuiles demandées | part |
|---|---:|---:|
| **hors du crop** | **5 081** | **53,7 %** |
| dans le crop | 3 474 | 36,7 % |
| aucun crop posé (orbite, au-dessus du seuil) | 901 | 9,5 % |
| **total** | **9 456** | |

⚠️ **DÉNOMINATEUR.** Ce sont des **appels à `_request`**, pas des octets : une tuile évincée puis
redemandée compte deux fois. « Hors du crop » est le test de **BOÎTE** `tuileDansCrop`, le même que
`zoomCropPrescrit` — donc « entièrement hors de l'emprise ». Données brutes :
`.banc/vues-M/AV4-trafic.json`.

### 5.2 Ce qui est posé

**`globe.estompePlein()`** : à `uEstompage = 1`, le nuanceur rend
`couvertureTuile = mix(1.0, dedans, 1.0)`, c'est-à-dire `dedans`, **qui vaut exactement 0 hors du
crop** → `discard`. **Tout ce qui est dehors est déjà invisible.** `_horsCropSeul` coupe donc le
parcours dans ce cas, **en plus** du repos de la Tâche N.

⚠️ **CE N'EST PAS UN DOUBLON DE LA TÂCHE N, ET LES DEUX SE CUMULENT PAR UN OU.** `poserCropSeul`
coupe **au repos** ; celle-ci coupe **sous estompage plein**, c'est-à-dire précisément **pendant**
une descente, où la vue n'est jamais au repos.
⚠️ **`uEstompageOn` est lu EN PREMIER** : `uEstompage` vaut **1 par défaut**, donc lire la valeur
seule couperait le dehors sur une planète où l'estompage n'a jamais été posé — la vue orbitale de
`shibumap.com`.

### 5.3 La mesure APRÈS — hors réseau, et avec un témoin NUL

⚠️ **LA MESURE DANS L'APPLICATION VIVANTE A ÉTÉ COMMENCÉE PUIS COUPÉE.** Après une dizaine de
descentes, le fournisseur de tuiles s'est mis à rendre des **429 Too Many Requests** et des
`ERR_CONNECTION_TIMED_OUT`, et la boucle s'est bloquée sur un `loadSurface` en vol. **Le chiffre
« après » n'a donc PAS été relevé dans l'application vivante, et il n'est écrit nulle part comme
s'il l'avait été.**

Il est mesuré à la place sur le **même code de parcours**, faux réseau qui compte
(`.banc/trafic-M.mjs`, harnais de `test/veille-repos.test.js`), **même trajet des deux côtés**, et
le témoin est **`poserEstompage(0,999)` contre `poserEstompage(1)`** — à 0,999 la couverture hors
crop vaut 0,001, **invisible à l'œil**, mais `estompePlein()` rend `false` et le parcours est celui
d'avant :

| | demandées | dont hors crop | **dont dans le crop** | parcourues / image | cache |
|---|---:|---:|---:|---:|---:|
| AVANT (`0,999`) | 1 280 | 1 185 | **95** | 628,0 | 1 260 |
| APRÈS (`1`) | **95** | **0** | **95** | **70,3** | 95 |
| | **−92,6 %** | −100 % | **identique** | **−88,8 %** | |

**LE CONTRÔLE QUI COMPTE : le crop est dessiné par EXACTEMENT les mêmes 49 tuiles des deux côtés**
— comparaison de la **liste des clés**, pas du compte. Sans lui, « moins de trafic » pourrait
vouloir dire « moins d'image ».

⚠️ **ET LES DEUX CHIFFRES DE CE § NE SE MULTIPLIENT PAS.** Le banc tient l'estompage plein sur
**tout** le trajet ; l'application ne l'a plein que **sous la bande d'estompage** (≈19 km). Le
−92,6 % est donc un **plafond sur le segment concerné**, pas le gain d'une descente entière.
**Je n'ai pas mesuré ce dernier, et je ne l'annonce pas.**

⚠️ **Et le tri par `chord / dist` n'a PAS été borné.** Ce qui borne l'affinage est
l'**invisibilité**, pas une nouvelle règle de distance. Au-dessus de la bande d'estompage, les
alentours se raffinent comme avant.

---

## 6. ⚠️ CE QUE LE CAHIER DES CHARGES DEMANDE ET QUE JE N'AI PAS FAIT — avec la raison

### `escalier-zoom.js` **entier** : NON — deux de ses cinq exports n'ont rien à voir avec les paliers

- **`intersectionGlobe(origine, direction, rayon)`** — l'intersection rayon/sphère du **clic sur le
  globe**. Pure géométrie, et c'est elle qui empêche de plonger à l'**antipode**.
- **`viseeArrivee(monde, demiSocle, marge)`** — « mon point reste au centre », la correction qui a
  supprimé **700 km de dérive** sur sept crans.

Les supprimer casserait deux gestes qui ne sont pas des paliers. Des trois autres, `paliersRetenus`
et `palierDeClic` ne servent plus qu'au clic (voir la réserve n° 7) ; **`pasEscalier` reste le
« niveau de MNT suivant »** — `z ± 1` borné, la chose qu'un zoom continu **franchit**, pas un palier
où l'on se **pose**. ➡️ **Le module reste, allégé de son rôle de table.**

### Les deux boutons `+` / `−` partent avec l'indicateur

`modes.cranZoom(±1)` existe, applique la loi mesurée, et **n'a plus d'appelant d'IHM sous ce
drapeau**. ⚠️ **C'est une perte fonctionnelle assumée** au regard de D3 (« aucune option ne se
perd ») : il n'y a plus de zoom discret au doigt sur ce chemin. Le remède est d'une ligne
(rebrancher le `zoom-stepper` avec une étiquette d'**altitude** au lieu de `Z{n}`) ; il n'est pas
fait ici parce que le cahier des charges demande la mort de l'indicateur, pas sa réécriture.

---

## 7. CE QUE J'AI VU À L'ÉCRAN — franchement

Captures : `.banc/vues-M/`. ⚠️ **Le volet de navigateur n'a jamais pu être affiché dans cette
session** : les captures sont des `toDataURL` pris **à l'intérieur du crochet de `composer.render`**,
donc juste après le dessin réel, et déposées sur un petit serveur local
(`.banc/serveur-vues-M.mjs`, port 5593).

⚠️ **PREMIER PIÈGE, ET IL AURAIT FAIT CONCLURE À UN ÉCRAN NOIR.** Volet caché, **`camera.aspect`
valait `NaN`** (la mise en page était à 0 de haut au chargement). La matrice de projection rendait
alors **`x = NaN` et `y` juste** — donc **rien** ne se dessinait, et la première capture était un
dégradé de ciel vide, sans une erreur en console. Un `dispatchEvent(new Event('resize'))` l'a
réparé. **Ce n'était pas le code de la tâche, et j'ai failli le prendre pour lui.**

- **`M-99-final-drapeau-leve.png`** et **`M-01-depart.png`** (bloc La Réunion, ~13–17 km) : le bloc
  est là — parois, base, relief du Piton, littoral, mer. **C'est ce qu'Adrien attend d'un bloc au
  repos.**
  ⚠️ **Et on voit exactement ce que la Tâche N signale : la nappe de mer et le dessus du bloc ne
  sont pas la même surface.** Deux arêtes distinctes le long du bord droit, la nappe qui déborde en
  **porte-à-faux** au-delà de la paroi, et un décrochement net. **Hors périmètre, non corrigé, mais
  bien présent et bien visible.**
- **`M-st0-791680m-z5-surface.png`** (791 km) : la planète, la bathymétrie, aucun bloc — l'altitude
  est au-dessus du seuil du crop. **Deux traits sombres traversent l'image** (un maillage de
  frontières) ; **constaté, pas creusé.**
- **`M-st2-49653m-z10-surface.png`** (49,6 km) et **`M-st3-11885m-z12-surface.png`** (11,9 km) : le
  crop seul, cohérent, **sans couture interne**, avec son libellé de lieu. **C'est ce qu'on veut.**
- ⛔ **`M-st4-2972m-z14-surface.png`** (2,97 km) : **une bande grise franche coupe le relief en
  travers, en plein milieu du crop.** Le lancer de rayon dit que l'objet touché juste après la tuile
  est **`crop-mer`** — la nappe de mer, à l'intérieur des hautes terres malgaches, ~1 000 m sous le
  sol. **C'est la même famille que le constat de la Tâche N.**
- ⛔ **`M-st5-898m-z15-surface.png`** (898 m) : la caméra est **contre une paroi** ; l'image ne
  montre plus rien d'utilisable.

⚠️ **ET LA RÉSERVE HONNÊTE QUI VA AVEC : c'est la descente continue qui rend ces altitudes
atteignables.** Le chemin d'avant n'y arrivait pas — il se collait à la butée ou passait sous le
sol. **En dessous de ~3 km, l'image n'est pas composée** : la nappe de mer coupe le relief et les
parois entrent dans le cadre. **Je ne prétends donc PAS que la descente soit belle jusqu'au sol —
elle est CONTINUE jusqu'au sol. Les deux ne sont pas la même affirmation.**

**L'habillage n'est pas porté, et ce n'était pas ma tâche.**

---

## 8. ⚠️ LE BANC QUI A MENTI — HUITIÈME FAÇON, ET C'EST LA MIENNE

**La première campagne de mutation a rendu 42/42 « tuées ». Elle ne prouvait rien.**

`git worktree add` ne copie pas `node_modules` : dans l'arbre de mutation, **les onze fichiers
cibles échouaient déjà, sans une seule mutation**, sur un `ERR_MODULE_NOT_FOUND: three`. Toutes les
mutations rendaient donc exactement les **deux mêmes** fichiers rouges — **et c'est cette
uniformité, pas le score, qui l'a trahie** : `globe.js/estompePlein` n'a aucune raison de faire
tomber `escalier-surface.test.js`.

**Un banc qui ne rend rien ressemble à un banc qui prouve tout.** Le lanceur refuse désormais de
commencer si le **témoin** n'est pas vert (`.banc/mutations-M.mjs`, en tête), et la jonction
`node_modules` est posée dans l'arbre de mutation.

**Second tour, témoin vert (302 tests verts sans mutation) : 34/42 tuées, 8 survivantes** — et
**les cinq survivantes de `modes.js` disaient toutes la même chose : AUCUN TEST DE CE DÉPÔT NE
CONSTRUISAIT `Modes`**, parce que la classe appelle `document.createElement` et que le dépôt n'a pas
de jsdom. On lui a donné un **DOM de pacotille** et on l'instancie (`test/zoom-continu.test.js` ⑨).
⚠️ **C'est ce harnais qui a trouvé le défaut d'ordre du §3.5** — et il l'a trouvé parce qu'il
n'avait pas le crochet que la garde exigeait.

**Troisième tour, après le harnais : 42/42 TUÉES.** Journal complet :
`.banc/mut-M-tour2.txt`. Les quarante-deux mutations sont **sémantiques** — elles changent un
comportement, jamais une chaîne qu'une assertion cherche — et elles se répartissent ainsi :

| ce qu'elles visent | nombre |
|---|---:|
| la loi de zoom (`STEP_IN`, `STEP_OUT`, `BUDGET_NIVEAU`, `PAS_CRAN`, `PAS_NIVEAU`, `ZOOM_IMPULSE`) | 6 |
| **le branchement du régime continu** (le crochet, les trois crochets d'emprise, `_continu()` forcé aux deux valeurs) | 5 |
| le suiveur d'unités et la pose du cran | 5 |
| le franchissement automatique et la butée du glissé | 7 |
| la traversée (rideau, niveau, pose, sortie d'orbite, mémoire d'emprise, `_altitudeFondM`) | 6 |
| le cran et les boutons | 2 |
| **D10** (la constante, ses trois gardes, sa valeur de départ, sa valeur) | 5 |
| **le volet ④** (`estompePlein`, `_horsCropSeul`, la garde de crop) | 5 |
| l'indicateur `ORB` / `Z{n}` | 1 |

⚠️ **AUCUN CODE MORT TROUVÉ CETTE FOIS.** Les huit survivantes du second tour ne l'étaient pas
parce que le code ne servait à rien : elles l'étaient parce que **rien ne pouvait les voir**. Le
remède était un banc, pas une suppression.

---

## 9. La clôture, vérifiée à l'écran

**Drapeau BAISSÉ** (`http://localhost:5503/`, aucun paramètre) : `terreUniqueBranchee = false`,
`frontiereActive = false`, **exagération 2,8 (bloc) / 18 (globe)**, `zoom-stepper` présent avec son
étiquette **`Z12`**, `uEstompageOn = 0`, `_horsCropSeul(2,0,0) = false`, `_continu() = false`.
**Aucune exception en console** (seulement des 404 de tuiles optionnelles et les délais d'attente
du fournisseur, qui me limite depuis les campagnes).

**Drapeau LEVÉ** : `terreUniqueBranchee = true`, **exagération 2 des deux côtés**, `zoom-stepper`
**absent**, `_continu() = true`, `estompePlein() = true`, crop posé, **aucun refus**
(`veilleCrop.refus = []`), **36 tuiles dessinées pour 60 parcourues** — contre les **688 parcourues**
que la Tâche N relevait avant elle.

---

## 10. Réserves

1. ⛔ **En dessous de ~3 km, l'image n'est pas composée** (§7) : la nappe de mer coupe le relief,
   les parois entrent dans le cadre. **Nouvellement atteignable, non réparé, hors périmètre.**
2. ⚠️ **L'élan orbital ne traverse pas la porte.** À la plongée, l'inertie du geste vit dans
   `orbAltTarget` (mode orbital) et pas dans `_zoomVel` (mode surface) : elle est **perdue à la
   traversée**. L'altitude, elle, est continue — mais un geste très rapide marque une reprise.
   **Constaté par lecture du code, non mesuré.**
3. ⚠️ **Le chiffre « après » du volet ④ n'existe pas dans l'application vivante** (§5.3), pour cause
   de limitation de débit du fournisseur de tuiles. Ce qui est publié vient d'un banc hors réseau,
   et c'est dit à chaque fois.
4. ⚠️ **`altitudeCadrageM()` divise par l'exagération.** En la figeant de 2,8 à 2, **tous les seuils
   d'altitude qui en dérivent — naissance du crop, bande d'estompage — se déplacent d'un facteur
   1,4** : le crop naît **plus haut** qu'avant. C'est une conséquence directe de D10, elle n'a pas
   été recalibrée, et personne ne l'a demandée. **À trancher avec Adrien.**
5. ⚠️ **Le chemin plat voit deux changements**, assumés sous D13 : le notch orbital passe de ×1,7 à
   ×√2, et `stepFiner`/`stepWider` passent par `cranZoom`. **Le budget de niveau et la molette, eux,
   sont inchangés au bit près.**
6. ⚠️ **Le curseur d'exagération de l'IHM n'est pas neutralisé** sous le drapeau : le bouger écrit
   `params.demExaggeration`, donc `poserExageration`, qui **rend la main** (la constante gagne). Le
   curseur est donc **sans effet** sur ce chemin — il ne recharge rien, mais il ne fait rien non
   plus, et **rien ne le dit à l'écran.**
7. ⚠️ **Le clic sur le globe reste un geste qui DÉSIGNE un palier.** `plongeDepuisGlobe` passe par
   `palierDeClic(DIVE_TIERS, …)` avec `zoomImpose: true` : la table est donc encore consultée **sur
   ce chemin-là**, et la traversée peut y sauter. C'était déjà écrit comme assumé dans le dépôt
   (« le geste choisit un cadrage, il ne le déduit pas ») ; **je ne l'ai pas changé, mais il faut
   savoir qu'il reste.**
