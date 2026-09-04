# RAPPORT SOC — LE SOCLE : LA PLAQUE SUIT LA DÉCOUPE, ET LE MUR COUVRE LA BANDE

Arbre `C:\Dev\wt-soc`, branche `socle-plaque`, serveur `npx vite --host 127.0.0.1
--port 9651`. Chrome sans tête 1280 × 720, DPR 1, ANGLE, **grain éteint pour la
mesure** (deux captures identiques diffèrent de 115 000 px avec lui).

> **`npm test` : 5 005 tests · 5 005 réussis · 0 échec** (5 000 + 5).
> **`npm run audit:tests` : 272 listés · 272 sur disque, 6 hors suite déclarés, aucun écart.**

## 0. LES LIGNES QUE JE TOUCHE — pour `wt-flu` en particulier (`globe.js` partagé)

| fichier | ce que je touche |
|---|---|
| `src/globe.js` | **retrait** de la constante `TOLERANCE_BLOC` (≈ l. 923, remplacée par un encart) · **neuves** `tuilesAvecMaillage` et `hauteurMaillee` (après `hauteurDessinee`, ≈ l. 7808–7862) · `construireParoisCrop` (≈ l. 7935–8035) : le solide est bâti par une fermeture `batir(hauteur)`, le refus de couverture appelle la plaque provisoire ; **neuves** `_paroisProvisoires` et `_poserSolideParois` (la pose du mesh, extraite telle quelle, plus l'étiquette `userData.repere` / `userData.provisoire`) · `retirerParoisCrop` gagne `{ retailler }` · `_effacementLateralActif` (≈ l. 8300) : le domaine devient « un mur bâti pour CE repère ». **Rien dans `_traverse`, `update`, le nuanceur, la file, le crédit, la caméra.** |
| `src/monde/branchement-crop.js` | `POSEURS.parois` rend `provisoire` · `poserChaineCrop` rend `provisoires` · `creerVeilleCrop` : un état `paroisProvisoires`, et `reprendre` rejoue la mer **une fois** quand la plaque définitive remplace la provisoire |
| `test/crop-emprise-ecran.test.js` | ⑤ réécrit sur le nouveau domaine (mutation ci-dessous) |
| `test/mer-sphere.test.js` | ⑫h : la chaîne cherchée dans la source (`if (solide.refus) {`), le sens est inchangé |
| `package.json` | `test/socle-plaque.test.js` inscrit |
| neufs | `test/socle-plaque.test.js` (5 tests), `scripts/sonde-soc.mjs`, `scripts/diff-soc.py` |

Rien dans `parois-crop.js`, `plinth.js`, `crop-sphere.js`, `mer-sphere.js`, `main.js`.

## 1. LES QUATRE POINTS, MESURÉS — ET LE VERDICT : DEUX CAUSES, PAS QUATRE

Lieu de la vidéo : **Provence, 44,2149 / 5,797**, `modes.flyTo(lat, lon, z)`
(la seule entrée qui reproduit la pose, DENT §③), puis la vue de trois quarts
d'Adrien (altitude de cadrage 1,1 × largeur du crop, 35°, cap 15°). Relevés
DANS `globe.update` (hook), jamais après. `.banc/SOC/*/journal.json`,
`images.json` (une ligne par image), captures PNG.

### ① Les traits blancs verticaux sur les parois — ÉTABLI : les jupes des tuiles à travers le mur, effacement P14 éteint à z11

A/B à la même seconde, z11 au repos, `.banc/SOC/avant-z11/` :

| paire | px différents (seuil 24) | colonnes marquées |
|---|---|---|
| capture / **témoin** (même état, 0,4 s plus tard — les nuages) | **589** | 19 |
| capture / **jupes cachées** (`setDrawRange` sur toutes les tuiles) | **15 308** | **365** |
| capture / **effacement latéral forcé** (`jupeDomaine = false`, le levier de CULL) | 16 337 | 365 |
| jupes cachées / effacement forcé | **532** | 16 |

Les traînées sont **entièrement** les jupes (les cacher les enlève ; les deux
« sans traits » se confondent au niveau du témoin), et **l'effacement latéral de
P14 les enlève toutes** dès qu'on l'allume. Il était éteint : `_effacementLateralActif`
lisait `rep.zoom ≥ ZOOM_SOCLE − TOLERANCE_BLOC` = 11,5, et le crop d'Adrien est à
**z11** (42 km de large ; relevé `lateral: false`). Au z12 de la même descente,
`lateral: true` et le mur est net (`05-palier-*.png`, avant comme après).

⚠️ Ce que je n'avais pas vu sur les images d'Adrien et que le banc montre : à
z11 vu de trois quarts, ce ne sont pas des « traits », **c'est tout le mur qui
est rayé** (`.banc/SOC/avant-z11/01-repos-z11.png`) — 143 tuiles dessinées dans
le crop à z13, donc une jupe de couture toutes les 3 tuiles de mur.

**Après** (`.banc/SOC/apres-z11/`) : capture / jupes cachées = **67 px**, sous le
témoin (524). `lateral: true`. **0 trait.**

### ② et ③ Le relief minuscule dans une plaque immense, puis il « grandit » — ÉTABLI : la plaque attend les hauteurs réservées, la découpe non

Deux boîtes, en mètres, à chaque image : `cropM` (l'emprise de la découpe,
`2 · demi · 2πR · cos lat`) et `paroisM` (le repère avec lequel `_parois` a été
bâti, étiqueté par la sonde), plus `maillageM` (union des tuiles dessinées dans
le crop, bornée à l'emprise). `boiteM` (la boîte de géométrie des parois) vaut
`paroisM` + le chanfrein, à 0,3 % près — les deux mesures concordent.

| geste (z13, latence réseau 800 ms émulée) | avant (`--provisoire 0`) | **après** |
|---|---|---|
| images de crop **sans parois** à l'arrivée du `flyTo` | **210** (3,5 s ; couverture 0 → 0,585 → 0,867 → 1 sur 7 reprises) | **0** |
| images où `paroisM ≠ cropM` | 0 | 0 |
| écart max plaque / découpe | — | **0 m** |
| plaque posée dans l'image de la pose | non | oui (provisoire, 20 ms ; reprises sans rebâti 2–6 ms) |

Sans latence (`avant-z11/12/13`) : 30 à 150 images sans parois à l'arrivée
(z11 : 150, couverture 0,933 pendant cinq reprises — une tuile qui tarde).

**Le mécanisme, lu dans le code et confirmé par le relevé :** `poserCrop` écrit
`uCropDemi` dans l'image de la pose (la découpe est aussitôt à la nouvelle
largeur) ; `construireParoisCrop` refuse tant que `hauteurDessinee` — qui ne lit
que `t.heights`, c'est-à-dire les tuiles **réservées** par `gardeHauteurs` —
ne couvre pas l'anneau ; et « le refus ne touche pas aux parois déjà posées ».
Résultat : la plaque **du repère d'avant** (ou aucune, après un `flyTo` qui a
retiré le crop en orbite) autour d'un relief à la nouvelle largeur. C'est
exactement `m_050` (le petit bloc dont les « parois » sont ses propres jupes,
sur la grande plaque grise) et `m_078` → `m_084` → `m_090` (« REFINING z13 »,
6 s, puis la plaque rejoint le relief). Le « grandissement » de ③ est la plaque
qui rétrécit, pas la terre qui grandit — à l'écran c'est la même chose.

⚠️ **Ce que je n'ai PAS reproduit** : le retard sur le geste du CRAN (z11→12,
12→13, 13→14, avec ou sans latence) — au banc la plaque est rebâtie dans
l'image même de la pose, parce que les tuiles du niveau précédent gardent leurs
hauteurs en cache et couvrent l'anneau. Le retard de la vidéo au cran (`m_078`,
6 s) suppose des hauteurs absentes à ce moment-là (cache sous pression, ou
tuiles jamais réservées) ; je ne l'ai pas provoqué. **Le correctif ne dépend pas
du chemin** : la plaque provisoire se bâtit sur le maillage dessiné, présent
pour toute tuile à l'écran, racines comprises — `test/socle-plaque.test.js` ②
le prouve avec zéro hauteur réservée.

### ④ La bande pâle vide entre le relief et l'arête — HYPOTHÈSE : ② en vol

Non mesurée à part. `m_040` est pris **en vol** (« REFINING z11 », estompage
< 1) : la bande a la teinte de la terre estompée, elle est bordée par l'arête
biseautée de la plaque d'avant, et le relief net est la découpe neuve. C'est ②
pendant le fondu, et le correctif est le même. Je ne l'ai pas prouvé par une
capture à `uEstompage < 1` ; je le dis.

### Verdict

**Deux causes.** ①, une seule : le domaine en niveaux de CULL, qui exclut z11.
②③④, une seule : la plaque n'a pas le repère de la découpe pendant l'aller
réseau de la réservation. ⚠️ Et elles se tiennent : le domaine juste de ① est
« un mur couvre la bande », qui n'est vrai à toute image que si ② est réglé.

## 2. LES CORRECTIFS

**② ③ ④ — la plaque provisoire.** Quand la couverture par les hauteurs
réservées refuse, `construireParoisCrop` rebâtit le **même** solide (même
fermeture `batir`, même forme, même profondeur, même chanfrein) avec
`hauteurMaillee` — la hauteur **lue dans le maillage dessiné** (rayon du sommet
moins `R_GLOBE`, divisé par l'échelle de `_buildMesh`, interpolée par
`interpolerMaille` aux mêmes nœuds). Le refus est rendu tel quel : la reprise
rebâtit la définitive (P11) quand les hauteurs sont là, et remplace la
provisoire ; une provisoire déjà posée pour ce repère n'est pas rebâtie. La mer
est rejouée **une fois** quand la définitive remplace la provisoire (son rideau
descend jusqu'au fond de la plaque). `hauteurMaillee` = `hauteurDessinee` à
0,05 m près sur 1 681 points (test ①) — même loi, autre disponibilité.

**① — le domaine de l'effacement.** `_effacementLateralActif` compare le
repère étiqueté sur `_parois` à `_crop`. Actif dès qu'un mur (provisoire
compris) couvre la bande, éteint sinon ; `TOLERANCE_BLOC` retirée.

Coût : la plaque provisoire coûte 8–75 ms **une fois par pose** (75 ms avant le
filtre `tuileDansCrop` sur les candidates, 20 ms après), et 2–6 ms par reprise
sans rebâti. `_retaillerJupes` n'est plus fait deux fois par pose
(`retirerParoisCrop({ retailler: false })` depuis `_poserSolideParois`).

## 3. CE QUI NE RÉGRESSE PAS

- **Trous de CULL ④ en vol** (`scripts/sonde-cull.mjs`, Majorque, CPU ×4, 900 → 20 km) — c'est le risque nommé du nouveau domaine, puisque l'effacement est désormais actif en vue continentale :

  | tirage | trous en vol max / moy | repos (20 images) |
  |---|---|---|
  | après, tirage 1 | 40 px / 10 | **0** |
  | après, tirage 2 | **0 px / 0** | **0** |
  | après, **effacement latéral débrayé** (`--lateral 0`, le levier qui rendait 0 chez CULL) | 54 px / 13,4 | **0** |

  Les trous qui restent en vol (0 à 54) sont là **avec et sans** l'effacement :
  ils ne lui sont plus attribuables. CULL relevait 0 / 33 / 17 après son
  correctif et une dispersion « du même ordre que l'effet » ; c'est ce qu'on
  retrouve. Au repos, 0 partout.
- **Crop net, raffinement par tuile, D19, mer** : `_traverse`, `update`, la
  prescription, `mer-sphere.js` et la caméra ne sont pas touchés ; `zServi`
  relevé 13 / 13 / 13 → 14 aux paliers, `maillageM = cropM` à toutes les images.
- Les tests P14 (`crop-parois.test.js`) passent inchangés : un globe de papier
  sans membre `_parois` rejoue l'effacement d'avant (`_parois === undefined`).

## 4. LES TESTS — ET ILS MORDENT

`test/socle-plaque.test.js`, 5 tests, inscrit : ① `hauteurMaillee` contre
`hauteurDessinee` (balayage 41 × 41, écart < 0,05 m, `null` hors couverture) ;
② sans hauteurs réservées, refus **et** plaque provisoire dans le même appel,
sur le repère de la découpe, largeur = celle du repère à 2 % ; ③ pas de rebâti
pour rien, la définitive remplace ; ④ l'effacement suit le mur, la jupe d'une
tuile de bord est effacée, la découpe change → éteint → la plaque suit → actif ;
⑤ `reprendre` rejoue la mer une fois avec la plaque définitive.
`crop-emprise-ecran.test.js` ⑤ réécrit sur le nouveau domaine.

Mutations (`src/` seul, une à la fois) — voir §6 pour les rouges relevés.

## 5. CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« ①, ② et ③ ont une cause »** (l'hypothèse du brief). Deux : les traits
   sont les jupes sous un domaine trop étroit ; la plaque en retard est la
   réservation. Elles se rejoignent par le correctif, pas par la cause.
2. **« Les traits sont les coutures entre segments de paroi, la paroi étant
   bâtie par tuile. »** Non : la paroi est d'un seul tenant (un mesh) ; cacher
   les jupes des tuiles enlève 15 308 px, forcer l'effacement en enlève autant.
3. **« Le retard se voit au cran de zoom. »** Au banc, jamais — même sous
   latence : les hauteurs du niveau d'avant couvrent l'anneau. Il se voit à
   l'arrivée (30 à 210 images), et la vidéo le montre au cran ; le mécanisme est
   le même, le déclencheur du cran ne m'est pas acquis (§1 ②③).
4. **« Une pose de crop a coûté 75 ms à cause de la plaque provisoire. »** Oui —
   et c'était `_tuileLaPlusFine` parcourant tout le cache pour chacun des 1 140
   points. Filtré sur la boîte du crop (dilatée d'un cheveu : un point sur le
   bord est/sud tombe dans la voisine, `test` ② l'a attrapé) : 20 ms.
5. **« Le diff d'images mesure les traits. »** Pas avec le grain (115 000 px
   entre deux captures identiques), ni sans témoin (les nuages : 524–589 px).
6. **« `retirerParoisCrop` puis pose = une retaille de jupes. »** Deux : l'une
   remettait les jupes pleines pour une image que personne ne dessine.

## 6. MUTATIONS — relevé (`src/` seul, une à la fois, sources restaurées au md5)

| mutation | rouges (sur `socle-plaque` + `crop-emprise-ecran`) |
|---|---|
| `_paroisProvisoires` rend `null` sans bâtir | ②, ③, ④ |
| `_effacementLateralActif` rend `!!p` (un mur, n'importe lequel) | ④, `crop-emprise-ecran` ⑤ |
| `hauteurMaillee` lit `a[k]` sans `+ o.x` (le RTC oublié) | ① |
| `reprendre` ne rejoue plus la mer avec la plaque définitive | ⑤ |

Tout le reste vert à chaque fois (7 / 8 / 9 / 9 réussis). Aucune survivante.

## 6 bis. LES CAPTURES — les mêmes instants que la vidéo

- **① `m_030` / `m_060` (le mur rayé)** : `.banc/SOC/avant-z11/01-repos-z11.png`
  (rayé de bout en bout) contre `.banc/SOC/apres-z11/01-repos-z11.png` (mur
  plein) — même lieu, même vue, même altitude (38 494 m), grain éteint ; les
  masques de différence `d-jupes.png` dans chaque dossier.
- **②③ `m_048` → `m_050` (le bloc sans plaque, puis la plaque d'avant)** : à
  l'arrivée du `flyTo` z13 sous 800 ms de latence,
  `.banc/SOC/arr-avant-z13/00-arrivee-1000ms.png` — **une feuille de terrain qui
  flotte, sans aucun mur** — contre `.banc/SOC/arr-apres-z13/00-arrivee-1000ms.png`
  — **le bloc avec ses parois provisoires, à la même milliseconde, la même
  feuille dessus**. Relevé au même instant : avant `parois null` à
  +0/+300/+1 000/+2 500 ms ; après `parois 10 504 m = crop 10 504 m,
  provisoire true` aux quatre.
- **`m_080` → `m_090` (le cran)** : `05-palier-*.png` dans `avant-z13` et
  `apres-z13` — identiques des deux côtés, parce que le banc ne reproduit pas
  le retard au cran (§1 ②③). Je ne fournis pas de « après » à une image dont je
  n'ai pas d'« avant » mesuré.

⚠️ `.banc` est ignoré par git : les PNG ne voyagent pas avec la branche.

## 7. CE QUI RESTE

- **Le déclencheur du retard au cran** dans la session d'Adrien (§1 ②③) n'est
  pas reproduit ; le correctif le couvre par construction, pas par mesure.
- **La paroi définitive suit les hauteurs réservées à `demZoom`**, pas le
  maillage le plus fin dessiné (z16 au repos). La provisoire, elle, lit le
  maillage : elle est donc, au repos, **plus fidèle à la surface dessinée** que
  la définitive qui la remplace. Faire de la lecture du maillage LA paroi, et
  la rebâtir quand les tuiles de l'anneau se raffinent, fermerait le drapé de
  P11 (18,94 m) pour de bon — à mesurer avant de le poser.
- **Les trous en vol de CULL** (0–54 px, dispersion) ne sont ni fermés ni
  attribués : ils survivent au débrayage de l'effacement.
- ④ n'a pas sa capture à estompage < 1.
