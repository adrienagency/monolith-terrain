# GX4 — second tour du tracé GPX (branche `gpx-correctif-2`)

> État : **complet.** Cinq sessions ont été coupées par des limites d'usage
> AVANT d'écrire ce fichier, alors que six commits de travail existaient déjà :
> tout ce travail était invisible. Il a donc été écrit **en premier**, à partir
> des commits et des journaux `.banc/GX4/`, commité, puis complété mesure par
> mesure avec un commit à chaque fois.

Base de la branche : `bf54801` (`git merge-base HEAD regroupement`).
`regroupement` a beaucoup avancé de son côté (gel du double-clic, transport de
la pose, crop d'abord) : **rien n'est fusionné ici**, on donne les lignes.

---

## EN TÊTE — les lignes touchées

`src/globe.js` : **AUCUNE LIGNE TOUCHÉE.** Le tracé lit le globe, il ne le
modifie pas ; les uniformes de crop sont partagés *par référence*, pas copiés.

Ensemble du chantier, `git diff --stat bf54801..HEAD -- src/` :

| fichier | lignes |
|---|---|
| `src/gpx.js` | +466 |
| `src/main.js` | +194 |
| `src/monde/sol-globe.js` | +184 |
| `src/monde/similitude-groupe.js` | +58 (nouveau) |
| `src/gpx-layers.js` | +37 |
| `src/drone-cam.js` | +19 |
| **total** | **910 insertions, 48 suppressions, 6 fichiers** |

### `src/main.js` — points d'insertion (numérotation d'arrivée)

| ligne | ce qui s'y passe |
|---|---|
| 111 | import de `visibiliteSurface` |
| 5152–5171 | l'empreinte des tuiles **dessinées** relevée dans la passe de fusion |
| 5259, 5266–5291 | la même empreinte suivie quand les passes fusionnent |
| 5884–5904 | `poserVisibiliteSocle` — le crop vivant transmis au calque GPX |
| **8952–9017** | **le cœur** : `gpxLayer` reçoit le poseur de sol du globe, `poserScene(sceneGlobe)`, la caméra du globe, et le re-drapage sur changement d'empreinte stabilisé à 350 ms |
| 10841–10860 | `regionFrameScale` — échelle du repère de région |
| 10862 | `syncBoats` : `boats.group` adopté par `sceneGlobe` |
| 14267–14292 | `redresserSurLeSol` — **ne touche à rien pendant un vol de poursuite** (GX6 ③) |
| 15504–15506, 15557 | appels dans `tick()` |

### `src/gpx.js` — points d'insertion (numérotation d'arrivée)

| ligne | ce qui s'y passe |
|---|---|
| 18 | import |
| 506–565 | `DRAPE_LIFT`, `MARGE_SOL_M = 2`, et **`GLSL_BORD_CROP`** : le morceau de nuanceur qui lit `aMerc`, le rapporte à `uCropCentre`/`uCropDemi`, replie l'antiméridien et `discard` au bord — gaîné par `uCropOn` |
| 661–682 | le poseur de sol et la scène déposés sur le calque |
| **905–1119** | **le cœur** : `_versScene`, `_sol` (lu sur le globe hors bloc), `aMerc` par sommet sur le ruban ET le sillage, ponctuels cachés hors socle, `ORDRE_VOILE = 34` |
| 1130–1595 (essaim) | rebranchements de la construction du ruban, du sillage, de la tête, du curseur et du profil sur `_versScene`/`_sol` |
| 1758–1854 | tête, curseur, profil à la marge du sol dessiné |

---

## Le critère du noteur (`rapport-GX3.md`, 7,5/10) — avant / après

| critère | avant (GX3) | après (HEAD `297dfbd`) | source |
|---|---|---|---|
| écart vertical / surface **rendue**, 2 335 sommets Mont-Blanc — moy ≤ +3 m | **+9,5 m** | **+2,00 m** | `.banc/GX4/gx7-drapage-mb-B.log` |
| … min ≥ −1 m | **−176 m** | **+2,00 m** | idem |
| … max | +160 m | **+2,01 m** | idem |
| … sommets enterrés > 5 m | **673** | **0** | `sousSol5: 0` |
| … sommets sous la surface | — | **0** | `sousSol: 0` |
| **Chamonix**, 401 sommets sous la surface | **138 / 401** | **0** (moy +2,00 · min +2,00 · max +2,00) | `.banc/GX4/gx7-drapage-chamonix.log` |
| **Camargue**, 501 sommets sous le plan de mer | **106 / 501** | **0** (moy +1,85 · min +1,71 · max +2,00) | `.banc/GX4/gx7-drapage-camargue.log` |
| 0 px hors socle à z13 | **358 px** | **0 px de ruban** — 227 px hors du POLYGONE, dont 131 sur une tuile du socle et 96 posés par une étiquette ancrée dans le socle ; le polygone exclut 8,7 % du socle lui-même | `.banc/GX4/gx8-bord.log`, `gx8-vide.log`, `gx8-etiquette3.log` |
| lecture au clic : 40 img × 3 tracés × 2 vols, 0 image sans ruban | 1/40 à 0 px (2ᵉ vol MB) ; Chamonix « ruban absent » | **0/40 sur les six vols — 240 images, zéro sans tracé** | `.banc/GX4/gx8-lecture-*.log` |
| … tête jamais derrière la caméra | 1 image tête derrière | **40/40 au tiers central** (MB, deux vols) ; caméra sous le sol 0/40 partout | idem |
| position horizontale ≤ 2,3 px / ≤ 14 m | ≤ 2,3 px / ≤ 14 m | **0 m** d'écart lat/lon sur 20 lignes ; rayon du sommet **identique au bit** à celui du noteur, 20/20 | `.banc/GX4/gx8-position-comparaison.log` |
| `boats` prouvé par pixels | passe **éteinte**, 0 px, projeté à (586, 2114) hors écran | **2 725 px**, témoin 0, parent = `sceneGlobe` que `PasseFond` dessine | `.banc/GX4/gx8-bateaux.log` |
| coût — pas de régression | 15,9 / 16,0 / 15,9 ms | **17,0 / 17,0 / 17,1 ms** — écart allumé/éteint **nul**, 0 requête | `.banc/GX4/gx8-cout.log` |
| `npm test` ≥ 5 081 · 0 | base `bf54801` : **5 081 · 0 fail · 2 ignorés** | **5 105 · 0 fail · 0 ignoré** (+24 tests) | `.banc/GX4/gx8-npm-test.log`, `gx8-npm-test-base.log` |
| `npm run audit:tests` | — | **284 listés · 284 sur disque · aucun écart** | `.banc/GX4/gx8-audit-tests.log` |
| les 7 mutations mordent | **5 sur 7 NE MORDAIENT PAS** | **10 sur 10 mordent** | `.banc/GX4/gx7-mutations.log` |

Le détail du drapage Mont-Blanc, tel que rendu par le banc du noteur
(`scripts/banc-gx3-drapage.mjs`), sur la **surface que le GPU dessine** :

```
"rendu": { "n": 2335, "moy": 2, "min": 2, "max": 2.01, "p05": 2, "p95": 2 }
"sousSol": 0, "sousSol5": 0, "dessus50": 0
```

Le même banc donne aussi l'écart au **bloc** (`"bloc"` : moy −4,41 · min −71,05
· max +58,22). C'est justement la mesure que GX3 prenait pour la bonne : le
bloc n'est PAS la surface dessinée, et c'est là que se logeaient les −176 m.

## Le « 0 px hors socle » : ce que le polygone du noteur mesure vraiment

Le banc du noteur projette **les quatre coins** du socle et compte les pixels de
tracé hors du quadrilatère obtenu. Sur HEAD il en compte encore 227 à z13. On ne
l'a pas réécrit — on a recopié son `dedans()` **au caractère**
(`scripts/banc-gx8-bord.mjs`) et on lui a posé deux questions.

### ① Le socle ne tient pas dans son propre polygone

On échantillonne la **surface dessinée** du socle (grille 96 × 96, hauteur lue
par `c._sol`, c'est-à-dire `hauteurMaillee` sur les tuiles allumées) et on la
compte contre ce même polygone :

| cran | points de la surface dessinée à l'écran | dedans | **HORS** | dépassement |
|---|---|---|---|---|
| z11 (41 km) | 644 | 0 | **644 (100 %)** | empreinte dégénérée : deux coins passent derrière la caméra, à **−191 880 px** |
| z12 (20 km) | 2 890 | 2 645 | **245 (8,5 %)** | jusqu'à 3 542 px au-dessus du plus haut sommet du polygone |
| z13 (10 km) | 7 267 | 6 637 | **630 (8,7 %)** | jusqu'à 979 px |

Un quadrilatère plat passant par quatre coins ne peut pas contenir un relief de
3 000 m. **« Hors polygone » n'est donc pas « hors socle »**, et le seuil « 0 »
est inatteignable par construction — un tracé parfait le manquerait aussi. Le
cran z11 le rend criant : le banc y annonçait « 100 % dehors » depuis GX3.

### ② Ce qui reste n'est pas du ruban

Chaque pixel de tracé hors polygone reçoit un rayon depuis la caméra du globe :

| cran | hors polygone | sur une tuile **du socle** | sur `crop-*` | sur une tuile **hors socle** | ne touchant rien |
|---|---|---|---|---|---|
| z11 | 20 176 | 20 175 | 1 | **0** | 0 |
| z12 | 415 | 415 | 0 | **0** | 0 |
| z13 | 227 | 131 | 0 | **0** | 96 |

**Zéro pixel de tracé sur une tuile hors socle, aux trois crans.** Les 96 de z13
sont attribués **par différence** (`scripts/banc-gx8-vide.mjs`, la méthode du
noteur) : on éteint un enfant du groupe GPX à la fois et on recompte le jeu de
pixels visé. Un seul enfant les porte — **91 sur 91** disparaissent ; les cinq
autres n'en retirent que 3, le bruit. C'est une **étiquette de texte**, ancrée
en `(15,49 · −27,7)` ; le rayon tiré à son ancre frappe la tuile de socle
`13/4254/2913`, et le sprite est dessiné **16 px au-dessus de son ancre**
(`yb = v.y + 1,25`, le décalage voulu du libellé) — au-dessus de la ligne de
crête, donc sur le ciel. Ce n'est pas un débordement : c'est un nom qui flotte
au-dessus du sommet qu'il nomme.

La sonde du bord (`scripts/banc-gx8-etiquette.mjs`) le confirme des deux côtés :
le repère de crop tenu par le poseur est **identique** à celui du globe aux
trois crans (et l'uniforme partagé aussi), et **0 ponctuel visible sur 11 n'est
hors du socle vivant**.

## La lecture — six vols au clic, 240 images relevées, zéro sans tracé

`scripts/banc-gx3-lecture.mjs`, le banc du noteur : clic souris sur
« ▶ Lecture » du panneau Parcours (pas `dispatchEvent` sur `.cb-play`, qui est
hors écran), studio fermé, temps gelé aux relevés, deux relevés concordants par
image, témoin A/A.

| vol | images sans tracé | médiane · min | tête au tiers central | caméra sous le sol | ce que le noteur mesurait |
|---|---|---|---|---|---|
| MB 90 km, poursuite, 1ᵉʳ vol | **0 / 40** | 14 940 · **2 159 px** | **40 / 40** | 0 / 40 | 0/40, mais **min 174 px** |
| MB 90 km, poursuite, 2ᵉ vol | **0 / 40** | 14 893 · **2 091 px** | **40 / 40** | 0 / 40 | ⛔ **1/40 à 0 px**, tête DERRIÈRE la caméra |
| Chamonix 4 km, poursuite | **0 / 40** | 2 390 · 2 390 px | 5 / 40 (le finale) | 0 / 40 | ⛔ **191 px d'étiquettes seules, ruban absent** |
| Camargue 5 km, poursuite | **0 / 40** | 3 724 · 3 724 px | **40 / 40** | 0 / 40 | min **83 px = le bruit du témoin** (sous le plan de mer) |
| MB, figée | **0 / 40** | 848 · 331 px | 20 / 40 | 0 / 40 | 0/40 |
| Chamonix, figée | **0 / 40** | 402 · 207 px | 35 / 40 | 0 / 40 | ⛔ **plat à 242 px** — « les seuls pixels du calque sont les étiquettes » |
| Camargue, figée | **0 / 40** | 1 109 · 452 px | 28 / 40 | 0 / 40 | 0/40, monotone |

**Les deux reproches de fond du noteur tombent, et ils ne tombent pas par la
lettre.** Il avait écrit « 0/40 par la lettre, mais le ruban est invisible » :
c'est le compte qui le dit maintenant. À Chamonix figée, il restait **plat à
242 px** de headT 0,14 à 0,46 ; sur HEAD il **croît** avec le dévoilement —
207 → 724 → 843 → 979 px. Et le second vol du Mont-Blanc, celui qui perdait le
tracé une image sur quarante avec la tête hors du cadre, ne le perd plus : le
minimum passe de **0 px** à **2 091 px**, et la tête est au tiers central 40 fois
sur 40 (contre 39/40).

⚠️ Deux chiffres restent bas et ne sont **pas** le tracé : « tête au tiers
central 5/40 » à Chamonix en poursuite, et 20/40 au Mont-Blanc figé. Le premier
est le **finale** — la lecture d'un 4 km dure cinq relevés, les 35 suivants
regardent la pose de fin de course, exactement comme chez le noteur (« 5/5 en
lecture ; 0/35 après le finale »). Le second est la phase figée, où la caméra ne
suit rien par construction. Aucun des deux ne compte une image sans ruban.

## La preuve de morsure — 10 mutations sur 10

`scripts/banc-gx3-mutations.sh` (M1…M10). Chaque mutation est appliquée, la
suite tourne, le fichier est restauré, et **le md5 avant/restauré est comparé**.
Journal : `.banc/GX4/gx7-mutations.log`, qui se termine par `diff src vide : OUI`.

| # | mutation | fail | garde qui devient rouge |
|---|---|---|---|
| témoin | produit intact | **0** | — |
| M1 | la similitude retirée | 5 | ①②③④ |
| M2 | `gpxLayer.poserScene(sceneGlobe)` retirée de `main.js` | **1** | ④ M2 — la ligne d'adoption de `main.js`, EXÉCUTÉE |
| M3 | visibilité rebranchée sur `vue.socle` | 1 | ③ le compte des lecteurs |
| M4 | fabrique de poseur non transmise au calque ajouté ensuite | 1 | ④ M4 |
| M5 | le ruban ne passe plus par `_versScene` | 4 | ①②③④ |
| M6 | la caméra du globe n'est plus déposée | 1 | ④ M6 |
| M7 | le sol lu sur le bloc au lieu du globe | 5 | ①①③③④ |
| M8 | le ruban repasse AVANT le voile nuageux (renderOrder 6) | 1 | ⑤ ordre après le voile |
| M9 | le recalage de la visée retiré | 1 | DroneCam : la tête jamais derrière la caméra |
| M10 | le redressement au sol recombat le vol | 1 | ④ le redressement ne touche PAS au vol |

**M2 est le cas emblématique.** Le noteur de GX3 avait mesuré que commenter
`poserScene(sceneGlobe)` laissait *tout vert* : la garde regardait un objet de
test, jamais la ligne de `main.js`. Elle EXÉCUTE maintenant cette ligne.

## Les cinq causes trouvées, chacune attribuée par une mesure

1. **Le drapage lisait les hauteurs réservées z11, pas les tuiles allumées**
   (`60751d9`). Le poseur lit `hauteurMaillee` sur les tuiles que le socle
   dessine. C'est là que meurent les −176 m et les 673 sommets enterrés.
2. **Le bord du socle ne suivait pas le crop vivant** (`ce75b5d`). `aMerc` par
   sommet + uniformes du globe **partagés par référence** : un socle recentré
   en vol ne rejette plus le ruban.
3. **Un repli à plat pendant un recentrage** (`242da26`). Le poseur plat ne vaut
   plus que sans AUCUNE surface. Sans cela le ruban tombait à 6 371 km — 0 pixel.
4. **L'écrêtage était MORT : le nuanceur lisait `aCrop`, la géométrie posait
   `aMerc`** (`994a8d3`). WebGL ne signale pas un attribut non lié : il rend
   `(0,0)`, soit le CENTRE du socle — donc `distanceBordCrop < 0` partout, donc
   **aucun fragment n'était jamais écarté**. Le `discard` tournait à vide à
   chaque image. Seconde moitié : même bien lié, un mercator ABSOLU reste dans
   `[-1,1]` ; il faut le rapporter au centre COURANT.
5. **Les images sans ruban n'étaient ni le drapage ni l'écrêtage** (`297dfbd`) :
   ① le voile nuageux repeignait le ruban (retirer les nuages rend **5 664 px**
   de tracé ; `uCropOn = 0` en rend **0**) → `ORDRE_VOILE = 34` ;
   ② `redresserSurLeSol` déplaçait la caméra de 39 unités **sans la ré-viser**
   (176,5° de sa propre cible, avant·tête −0,13) → la butée rend la main au vol.

## La position, les bateaux, le coût, la suite

### La position — le produit n'a pas bougé d'un ulp

`scripts/banc-gx3-position.mjs`, 5 points × 4 zooms. Sa colonne de console
affiche une distance **à l'écran**, qui mélange l'écart horizontal et l'écart de
rayon. Lue telle quelle, elle semble s'être dégradée aux cols (z10 col 1 :
3,3 px chez le noteur, **74,6 px** chez moi). Le JSON du banc tranche, en
confrontant son propre relevé de GX3 (`mb-position.json`) au mien
(`gx8-mb-position.json`) :

| grandeur | verdict |
|---|---|
| `ecartLatLonM` — l'écart **horizontal** | **0 m sur les 40 lignes** (20 du noteur, 20 du jour) |
| `rayonProduit` — où le produit pose le sommet | **identique au bit, 20 lignes sur 20** |
| `hDess` — la **vérité que le banc se donne** (`globe.hauteurDessinee`) | a bougé sur **4 lignes sur 20**, jusqu'à **−300,9 m** (z10 col 1) |

Autrement dit : **ce n'est pas le produit qui a bougé, c'est la règle.**
`hauteurDessinee` choisit « la tuile la plus fine qui a encore ses hauteurs »
— exactement la fonction que GX4 ① a désignée comme lisant les hauteurs
réservées au lieu des tuiles dessinées. Elle n'est pas stable d'un lancement à
l'autre, donc la colonne « sommet du produit » ne mesure pas le produit seul. La
surface **rendue**, elle, se mesure au rayon (`banc-gx3-drapage.mjs`) : +2,00 m
de moyenne, min +2,00, 0 sommet enterré.

### Les bateaux — par les pixels, plus par la structure

Le noteur avait prouvé le défaut par la **structure** :
`boats.group.parent === __exp.scene`, dont la seule passe est
`RenderPass(enabled: false)` ; un bateau semé n'atteignait pas l'écran, et sa
position projetée était (586, 2114), hors écran. Sur HEAD, par les **pixels** :

- `parentEstSceneGlobe: true`, et cette scène (`8bbd119f`) est celle que
  `PasseFond(enabled: true)` dessine ;
- le groupe pose **2 725 px**, témoin A/A **0** ;
- sa boîte `[494–639 × 340–409]` contient la position attendue `(566, 390)`.

### Le coût

| | image médiane | p95 | max | requêtes |
|---|---|---|---|---|
| allumé | 17,0 ms | 17,8 | 18,7 | +0 |
| éteint | 17,0 ms | 17,6 | 17,8 | +0 |
| rallumé | 17,1 ms | 17,8 | 17,9 | +0 |

Géométrie du calque : 20 objets, 2,33 Mo, 25 500 sommets de ruban.
**L'écart allumé / éteint est nul** — c'est le critère (« pas de régression »).
⚠️ Le niveau absolu est 1,1 ms au-dessus des 15,9 ms du noteur : la machine a
enchaîné des bancs pendant des heures et porte des serveurs de développement
d'autres chantiers. La comparaison qui vaut est allumé/éteint au même instant
sur la même machine, et elle donne 0.

### La suite

| | tests | pass | fail | ignorés |
|---|---|---|---|---|
| base `bf54801` (`git merge-base HEAD regroupement`) | 5 081 | 5 079 | **0** | **2** |
| HEAD | **5 105** | **5 105** | **0** | **0** |

**+24 tests, +26 verts, 0 rouge, et les deux ignorés levés.** La base a été
mesurée dans un arbre de travail jetable avec une **jonction** vers
`node_modules` — aucun `npm install`, et la jonction retirée avant de détruire
l'arbre pour ne pas emporter le vrai dossier.
`npm run audit:tests` : **284 listés · 284 sur disque · aucun écart.**

## Ce que j'ai cru, puis réfuté

- « Le ruban est mal drapé parce que le DEM est faux. » **Réfuté** : le DEM est
  bon, c'est la SURFACE LUE qui était la mauvaise (hauteurs réservées z11 contre
  tuiles dessinées). Deux surfaces, deux chiffres — `"rendu"` et `"bloc"` dans
  le même journal.
- « L'écrêtage marche, le banc du tour précédent le dit. » **Réfuté** : le banc
  avait été réécrit ; celui du noteur comptait toujours 154 à 358 px dehors. Un
  banc réécrit n'est plus le juge.
- « Les images sans tracé viennent de l'écrêtage au bord du socle. » **Réfuté
  par différence** : `uCropOn = 0` ne rend aucun pixel de tracé. Ce sont les
  nuages (5 664 px) et la caméra (4 images sur 40 à Chamonix).
- « `_aim` recale la visée, c'est donc lui la cause du décadrage. » **Réfuté** :
  c'est un invariant de dernier recours ; la cause est `redresserSurLeSol`,
  attribuée par pile d'appel (`banc-gx6-pile.mjs`) — 0 appel à `followPivot` et
  `controls.update` contre 330 `updateAt`.
- « Une garde verte prouve que le chemin est exécuté. » **Réfuté par le noteur
  lui-même** : 5 gardes sur 7 restaient vertes sous mutation. Une garde ne vaut
  que si elle EXÉCUTE le chemin du produit, et la mutation le prouve.
- « Les 96 px restants viennent d'un repère de crop FIGÉ : `sol-globe.js` copie
  `{cx, cy, demi}` par VALEUR là où les uniformes sont partagés par référence —
  c'est le même défaut que GX5, du côté processeur cette fois. » **Réfuté par la
  mesure** : le repère du poseur est identique à celui du globe aux trois crans,
  et aucun ponctuel visible n'est hors du socle vivant. Le copié-par-valeur est
  réel dans le code, mais le re-drapage refait le poseur : il ne produit aucun
  écart au repos. La cause est ailleurs — une étiquette qui flotte au-dessus de
  sa crête. J'allais éditer `src/` sur une hypothèse plausible et fausse.
- « `Raycaster` nomme l'objet qui pose un pixel. » **Réfuté** : three.js
  raycaste les objets **invisibles** aussi. Le premier passage désignait un
  `Line` de marqueur de village éteint depuis toujours. L'attribution ne vaut
  que **par différence** — allumé / éteint / rallumé.
- « `poseur.versLatLon` convertit bloc → lat/lon. » **Réfuté** : c'est un
  ARGUMENT de `creerPoseurGlobe`, pas une clé de `etat`. L'appeler rendait
  `undefined`, et ma sonde répondait « dans le socle » pour tout point : une
  colonne vide qui avait l'air verte. Exactement la faute de GX5 (`aCrop` contre
  `aMerc`), dans un banc au lieu d'un nuanceur.
- « **La position horizontale a régressé aux cols** : 3,3 px chez le noteur,
  74,6 px chez moi à z10 col 1. » **Réfuté par le JSON du banc lui-même** : le
  `rayonProduit` est identique **au bit** sur les 20 lignes, et `ecartLatLonM`
  vaut 0 sur les 40. C'est `hDess` — la vérité que le banc se donne — qui a
  bougé de 300 m. Une colonne de console qui mélange deux grandeurs (l'écart
  horizontal et l'écart de rayon) n'est pas une mesure : il a fallu ouvrir le
  JSON.
- « Le coût a monté de 15,9 à 17,0 ms, c'est le calque. » **Réfuté** : éteindre
  le calque ne rend rien du tout — 17,0 ms allumé, 17,0 éteint. Le niveau
  absolu est celui de la machine à cette heure-là, pas celui du tracé. Comparer
  à un chiffre relevé sur une autre machine à un autre moment n'est pas une
  mesure de régression.

## Ce qui reste discutable, et je le dis plutôt que de le cacher

1. **Le « 0 px hors socle » n'est pas atteignable au sens littéral du banc du
   noteur**, et je l'ai montré avec son propre `dedans()` : son polygone exclut
   8,7 % de la surface dessinée du socle à z13, et 100 % à z11. Ce que je
   revendique est plus fort et plus vérifiable : **0 pixel de tracé sur une
   tuile hors socle**, aux trois crans, mesuré au rayon. Si le noteur tient au
   chiffre littéral, c'est son banc qu'il faut corriger, pas le tracé — et la
   mesure du socle contre lui-même est là pour en décider.
2. **Le coût absolu est à 17,0 ms** contre 15,9 chez lui. L'écart
   allumé/éteint est nul, mais un relevé sur machine au repos serait plus propre.
3. **« Tête au tiers central » à 5/40 à Chamonix en poursuite** : c'est le
   finale, déjà constaté tel quel par le noteur (5/5 en lecture, 0/35 après).
   Aucune image sans ruban ne s'y cache, mais la pose de fin de course reste un
   sujet à elle seule.
4. **Rien n'est fusionné vers `regroupement`**, qui a beaucoup avancé (gel du
   double-clic, transport de la pose, crop d'abord). Les lignes touchées sont
   en tête de ce rapport ; `src/globe.js` n'en fait pas partie.

## Comment rejouer

```bash
node_modules/.bin/vite --host 127.0.0.1 --port 10471 --strictPort
node scripts/banc-gx3-drapage.mjs  --port 10471 --etiquette mb --regime B
node scripts/banc-gx3-lecture.mjs  --port 10471 --etiquette mb --phase suivi   # ×2
node scripts/banc-gx3-lecture.mjs  --port 10471 --etiquette mb --phase figee
node scripts/banc-gx3-position.mjs --port 10471 --etiquette mb
node scripts/banc-gx3-horscrop.mjs --port 10471 --etiquette mb --crans 2       # le banc du noteur
node scripts/banc-gx8-bord.mjs     --port 10471 --crans 2   # son polygone, contre le socle lui-même
node scripts/banc-gx8-vide.mjs     --port 10471 --cran 2    # attribution PAR DIFFÉRENCE
node scripts/banc-gx8-etiquette.mjs --port 10471 --cran 2
node scripts/banc-gx4-bateaux.mjs  --port 10471
node scripts/banc-gx3-cout.mjs     --port 10471
bash scripts/banc-gx3-mutations.sh && npm test && npm run audit:tests
```
