# VIE — LE CROP NE MOURAIT PAS : C'EST LE DEHORS QUI REVENAIT, PAR LA PORTE DU REPOS

Arbre `C:\Dev\wt-vie`, branche `crop-vie`. Serveur : `npm run dev -- --host
127.0.0.1 --port 9601 --strictPort`, **arrêté en partant**. Le témoin « avant »
a tourné sur un second arbre détaché (`C:\Dev\wt-vie-avant`, HEAD `6275e62`,
port 9602, arrêté par son PID), pour que mes éditions ne rechargent pas la page
du banc en pleine passe. Les Chrome sans tête sont ceux de `puppeteer-core`,
lancés et fermés par mes scripts ; **aucun autre n'a été touché**. `npm install`
n'a pas été lancé.

## ① LE GESTE QUI FAIT REVENIR LA TERRE — NOMMÉ, REPRODUIT 8/8, ET C'EST (b)

> *« Quand on entre en mode crop, on ne puisse plus revoir la terre complète si
> la caméra remonte via un déplacement autre qu'un scroll à la roulette.
> Notre correction n'avait pas fonctionné. »*

⚡ **D21 ① tenait. Le crop ne mourait sur AUCUN geste.** Ce qu'Adrien voyait
est le chemin **(b)** du brief : **le crop vit, et le globe est redessiné
autour**. Mesuré au rendu, une image = une ligne, `pose` / `globe._crop` /
`_cropSeul` / `porteRepos` / `estompage posé` relevés ensemble
(`scripts/sonde-vie.mjs`, `.banc/VIE/avant-*.json`), **8 chargements par
geste, un geste par chargement**, depuis la naissance du crop (24,7 – 27,4 km,
entrée par le haut comme dans la vidéo) :

| geste dans le crop, AVANT | crop | altitude de cadrage | **images avec la Terre dessinée** | estompage posé (min) |
|---|---|---|---|---|
| **bouton de caméra** (`.ce-isobtn`, 4 vues iso) | **vit 8/8** | 25 km → **205 162 m** | **498 – 542 / ~700** (≈ 8 s) 8/8 | **0** — la planète entière |
| **glissé gauche vers le nadir** (« vers le bas ») | vit 8/8 | 25 km → **40 345 – 41 242 m** | **167 – 285 / ~600** 8/8 | **0** |
| glissé gauche vers l'horizon (« vers le haut ») | vit 8/8 | 25 km → 1,3 km | 49 – 65 8/8 | 0,60 – 0,75 (partiel) |
| inclinaison au bouton du milieu (un PAN dans le crop) | vit 8/8 | 25 km → 9 – 11 km | 115 – 151 8/8 | 0,60 – 0,75 (partiel) |
| `goto` / vol aller-retour | meurt **par le MODE** (orbite), renaît à l'atterrissage 8/8 | 25 km → 125 km → 3,7 km | **0 – 1 en surface** ; la Terre se voit **en orbite**, c'est le vol | — |
| molette, 3 crans < 1 s | meurt 8/8 (sortie) | — | toute la sortie (c'est le but) | — |
| bouton monde | meurt 8/8, `orbital` | — | orbite | — |

**Le mécanisme, ligne par ligne.** La veille du repos (`veille-repos.js`)
surveille `|Δ ln d|` : **tout** mouvement de la distance caméra→cible la
réveille — c'est sa loi depuis la Tâche N (« on redessine le dehors dès la
première image du geste »). Elle relaie `poserRepos(false)` ; la porte du repos
tombe à 0 en 30 images ; l'estompage posé retombe alors sur la **loi
d'altitude** (`estompage-terre.js`), qui vaut **0 au-dessus de
`ALT_ESTOMPAGE_DEBUT_M` = 40 343 m** et n'est partielle qu'entre 40 343 et
19 364 m. Dès que le geste porte la caméra dans cette bande ou au-dessus, la
planète est **redessinée en entier** autour d'un crop vivant, et `_cropSeul`
retombe à faux (le quadtree la parcourt et la demande). Puis, 30 images calmes
plus tard, elle s'éteint de nouveau. **Adrien voit la Terre revenir ; le crop
n'a jamais cessé d'exister.** C'est exactement ce que le brief soupçonnait en
(b) — `_cropSeul`, `porteRepos`, `poserCropSeul(false)` pendant un geste.

⚡ **Pourquoi PORTE, C1 et REV ne pouvaient pas le voir** : leurs bancs partaient
du **fond** du crop (460 m – 18 km), **sous `ALT_ESTOMPAGE_FIN_M` = 19 364 m**,
où la loi d'altitude vaut **1** et masque la porte du repos par construction
(`voulu = auSeuil + (1 − auSeuil) · g` = 1 quel que soit `g`). Ils mesuraient
« le crop vit 8/8 », ce qui était vrai, et concluaient « la Terre ne revient
pas », ce qui ne suivait pas. **Mon banc entre par le haut** — `enterOrbit(80 km)`
puis des crans de zoom avant jusqu'à la naissance, l'entrée de la vidéo
(`m_020` → `m_025`) — et le premier glissé la fait remonter.

## ② LE CORRECTIF — LA PORTE DU REPOS DEMANDE UNE PERMISSION, ET SEULE LA MOLETTE LA DONNE

**Voie retenue : la deuxième du brief** — *laisser la caméra monter mais ne
jamais redessiner le globe tant que le crop vit*. Pas de bornage de caméra : la
sensation D19 ne bouge pas (§ ④), et le socle « flotte sur le fond » au-dessus
de 40 km, ce que le brief accepte.

| fichier | ce que j'y fais |
|---|---|
| `src/monde/branchement-crop.js` | `dehorsPermis` (nouvel état) ; `appliquerRepos` : `voulu = pose && (auRepos \|\| (repos && !dehorsPermis))` ; front montant du repos → permission consommée ; `armerSortie` la lève, `desarmerSortie`, la naissance et la mort la retirent ; accesseur `dehorsPermis` |
| `test/vie-crop.test.js` | **NEUF**, 7 tests, inscrit dans `package.json` |
| `test/veille-repos.test.js` | ⑥ « un mouvement retire le crop seul » devient « un DÉZOOM À LA MOLETTE qui bouge… » + un test neuf « un mouvement SANS molette laisse le crop seul » ; ⑨ arme la molette avant de bouger |
| `test/estompage-fondu.test.js` | ④ : le geste est un dézoom molette, il arme avant la première image |
| `scripts/sonde-vie.mjs` | **NEUF** — le banc, 8 gestes |

⛔ **Aucune ligne de `main.js`, de `modes.js`, de `sortie-molette.js`, de
`estompage-terre.js` ni de `veille-repos.js`.** `intentionZoom` reste le seul
appelant d'`armerSortie` (test ⑦ le verrouille) : la permission ne peut venir
que d'un dézoom à la molette — ou d'un dézoom au clic droit / double-clic droit
hors du crop, où il n'y a rien à redessiner.

**La règle, en une phrase** : *le dehors ne se rallume que sous la molette en
dézoom, et il se rééteint au repos* — Adrien, 2026-08-23 : « si je dézoome EN
SCROLLANT, alors là tu peux faire réapparaître le reste ». Le zoom AVANT à la
molette ne le rallume plus non plus (il désarme, comme D21 ①).

⚠️ **`dehorsPermis` n'est PAS `sortieArmee`, et le test ⑥ le garde** :
l'intention de D21 ① survit au repos (un cran isolé la laisse armée jusqu'au
zoom avant suivant), la permission meurt avec le geste. Portée par
`sortieArmee`, un cran isolé suivi d'un glissé une minute plus tard rallumerait
la Terre sur le glissé.

## ③ LE TABLEAU DU CRITÈRE — 8 chargements par ligne, APRÈS (`.banc/VIE/apres-*.json`)

| geste dans le crop | attendu | mesuré, 8 chargements | verdict |
|---|---|---|---|
| glissé gauche vers le nadir (la caméra monte, 25 → 36 – 38 km) | Terre jamais visible, crop vit | **0 image sur 646 – 717**, crop vit 8/8, `cropSeul` true et `porteRepos` 1 d'un bout à l'autre | ✅ |
| glissé gauche vers l'horizon (jusqu'à la butée `minDistance`) | idem | **0 / 605 – 713**, crop vit 8/8 | ✅ |
| inclinaison au bouton du milieu (×3) | idem | **0 / ~500**, crop vit 8/8 | ✅ |
| **bouton de caméra** (4 vues iso, jusqu'à **205 162 m**, soit 5 × `SEUIL_MORT_M`) | idem | **0 / 729 – 740**, crop vit 8/8, `porteRepos` 1 | ✅ |
| `goto` / retour de vol | idem en surface | **0 image en surface** 8/8 ; le crop meurt par le mode en orbite (le vol) et renaît à l'atterrissage (3,7 km) | ✅ |
| molette 3 crans < 1 s | sort | **sort 8/8 au 3ᵉ cran** (départ 24,8 – 26,7 km, à 1,4 nat du seuil), mort à **41 169 – 41 212 m** ; le dehors est bien redessiné PENDANT la sortie (11 – 16 images sur 14 – 19 avant la mort) | ✅ |
| bouton monde | sort | `pose` false, `orbital` **8/8** | ✅ |
| **puis rentrer** (molette) | renaît ≤ 22 crans | **19 – 20 crans**, renaissance à **30 849 – 31 788 m** 8/8 | ✅ |
| PORTE `retour` (depuis le fond, ~460 m) | sortie 8 – 10, retour ≤ 22 | voir § ④ | |
| D19 | glissé ≤ 0,2 px, molette ≤ 1,4 px, `\|Δ ln d\|` < 1e-4 | voir § ④ | |
| `npm test` | ≥ 5 000 · 0 | **5 008 · 0** | ✅ |
| `audit:tests` | sans écart | **272 = 272, aucun écart** | ✅ |

⚠️ **Le stepper vertical (`.zs-minus`, `modes.stepWider`) n'existe pas dans
cette interface** (`bouton absent` sur les deux arbres) : la ligne n'est pas
mesurable, et ce n'est pas un bouton qu'Adrien peut presser. Si un jour il
revient, il appelle `cranZoom(−1)` **sans** `intentionZoom` : il ne rallumerait
pas le dehors (pas de permission), mais il ne sortirait pas non plus du crop
avant la porte orbitale. À trancher ce jour-là.

## ④ D19 ET LA PORTE — LA NON-RÉGRESSION

*(§ ①–③ et ⑤ sont de l'agent VIE, tué par une limite d'usage ; § ④, la
vérification par mutation à l'octet et la fin du § ⑥ sont de VIE-2, qui a
d'abord relu `git diff` et recompté les JSON de `.banc/VIE/` — les chiffres
du § ③ sont ceux des fichiers, pas ceux du rapport.)*

**La porte de PORTE** (`scripts/sonde-porte.mjs`, port 9601, lieu 43,05/6,15,
départ au fond du crop après 30 crans) — `.banc/PORTE/vie-retour.json` et
`vie-ar3.json` :

| épreuve | attendu | mesuré | verdict |
|---|---|---|---|
| `retour`, 8 chargements | sortie 8 – 10 crans, retour ≤ 22 | **8/21 × 8** — mort à 41 159 – 41 429 m, repos 44 947 – 45 408 m, renaissance 30 967 – 31 752 m | ✅ identique à PORTE (8/21) |
| `ar3`, 3 chargements × 3 tours | 3 A/R sans dérive | `8/22 · 4/20 · 3/18` · `8/21 · 4/20 · 4/20` · `9/20 · 4/20 · 3/19` | ✅ le même motif que PORTE (`8/21 4/20 4/20`) : le 2ᵉ et le 3ᵉ tour partent de la renaissance (31 km), à 4 crans du seuil, pas du fond |

⚠️ Le dehors est bien redessiné PENDANT la sortie molette (§ ③, 11 – 16 images
avant la mort) : la permission est levée par `intentionZoom` avant la première
image, comme le test ④ l'exige.

**D19 dans le crop** (`scripts/sonde-ge3.mjs --regime crop --lieu 44.2,5.78,12
--repete 8 --geste …`, **un processus et un Chrome par geste**,
`.banc/VIE/ge3-crop8-<geste>.json` ; témoin : `traces-REV/ge3-crop8.json`,
même sonde, mêmes six gestes, même régime, AVANT le correctif). Le crop est
posé à 9,3 – 10,1 km, inclinaison 46,5° (l'arrivée du `flyTo`), 8 chargements
par geste :

| geste | critère | mesuré, 8 chargements | témoin REV (avant) | verdict |
|---|---|---|---|---|
| glissé gauche 100 px | `terreDerivePx` ≤ 0,2 | **0 × 8** ; `rapportAlt` 1,000 × 8 ; `\|Δ ln d\|` 0 – 4,44e-16 ; crop true→true 8/8 | 0 ; 1 ; 4,44e-16 | ✅ |
| molette 1 cran (avant) | `centre0DerivePx` ≤ 1,4 | **0,00 × 8** (curseur 2,72) ; `rapportAlt` 1,013 ; `\|Δ ln d\|` 5,2e-4 (c'est un zoom, la distance DOIT changer) ; crop true→true 8/8 | 0,00 (curseur 2,13) ; 1,010 ; 5,1e-4 | ✅ |
| inclinaison forte (milieu, un PAN dans le crop) | `\|Δ ln d\|` < 1e-4 | **4,44e-16 max** ; `terreDerivePx` 0 ; `rapportAlt` 1,27 ; crop true→true 8/8 | 4,44e-16 ; 0 ; 1,25 | ✅ |
| clic droit maintenu (dézoom) | crop vit, `\|Δ ln d\|` < 1e-4 | 4,44e-16 max ; 9 349 – 10 065 → 7 597 – 8 146 m ; crop true→true 8/8 | 4,44e-16 ; 1,22 | ✅ |
| boutons de caméra (iso 4 puis 6) | crop vit | crop **true→true 8/8**, 9 346 – 10 121 → **29 473 m** × 8 ; `\|Δ ln d\|` 0,035 – 0,038 (un vrai changement d'échelle, c'est le bouton) | true→true ; 0,087 | ✅ |
| bouton monde | sort | mesuré par `apres-monde.json` (§ ③) : `orbital` 8/8 | true→false, orbital | ✅ |

⚠️ `saisiVsPointeurPx` (236 – 252 px) et `centre0DerivePx` (169 px) sur le
glissé **ne sont pas des critères dans le crop** : là, le bouton gauche est la
ROTATION d'OrbitControls autour de l'axe du bloc (D13), pas la saisie de la
Terre — le témoin REV donnait déjà 160 et 64 px, et le rapport REV lisait D19
sur `terreDerivePx` et `centre0` de la molette, comme ici. L'écart 160 → 252
vient de l'inclinaison de pose (46,5° ici : la sonde n'attend plus le
redressement, comme le témoin), pas du correctif — le correctif ne touche ni la
caméra ni les contrôles (`git diff` : `branchement-crop.js` seul dans `src/`).

**Le geste de la vidéo d'Adrien, rejoué sur cette pose inclinée** : le glissé
gauche de 100 px tourne le bloc, altitude ×1,000, `|Δ ln d|` = 0 — la veille du
repos ne se réveille même pas, et si elle se réveillait, le relais resterait
à `true` sans permission (§ ②).

## ⑤ LES TESTS MORDENT — vérifié par mutation, md5 à l'appui (VIE-2)

`test/vie-crop.test.js`, 7 tests. Rejoué par VIE-2 sur une **copie isolée**
de `src/` + `test/` (jonction vers `node_modules`), pour ne pas faire recharger
par Vite la page du banc D19 encore en cours ; témoin
`branchement-crop.js` = `c114911bbb2ef01b4fa5e0632d294923`, suite des trois
fichiers (`vie-crop`, `veille-repos`, `estompage-fondu`) = **63 · 0** avant
chaque mutation, témoin remis et md5 revérifié après :

| mutation | md5 du fichier muté | rouge |
|---|---|---|
| le relais redevient `pose && auRepos` (le terme `!dehorsPermis` retiré) | `ab565302…049d5` | ⛔ vie ①, ②, ③ + veille-repos ⑥ « SANS molette » — **4** |
| la permission consommée à CHAQUE image de repos (`if (auRepos)`), pas au front montant | `cb8088d2…4c81` | ⛔ vie ④ — *la molette ne rallumerait plus jamais le dehors* |
| la permission jamais consommée au repos (`if (false)`) | `97ea8b75…2170` | ⛔ vie ②, ⑥ |
| `armerSortie` ne donne plus la permission (ligne `dehorsPermis = true` ôtée) | `c7549e1e…15cd` | ⛔ vie ②, ④ + veille-repos ⑥, ⑨ + estompage-fondu ④ — **5** |

Aucune mutation ne passe ; les tests adaptés (`veille-repos` ⑥/⑨,
`estompage-fondu` ④) mordent aussi, dans les deux sens.

Et la suite existante a rougi là où elle devait, **trois fois**, avant que je
la remette d'accord : `veille-repos` ⑥ (« un mouvement retire le crop seul ») et
⑨ (« une distance qui change réveille la vue ») supposaient que tout mouvement
rallume le dehors — c'est la règle qu'Adrien vient d'abroger ; `estompage-fondu`
④ aussi. Et `veille-repos` ⑥ « SANS veille de repos, le comportement est celui
d'avant » a attrapé une vraie faute de ma première écriture : sans veille,
`auRepos` vaut toujours faux et ma permission basse aurait *inventé* un repos.
D'où le `repos &&` dans le relais.

## ⛔ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le crop meurt par un chemin non couvert — chemin (a). »** ⛔ Faux, sur les
   sept gestes × 8 chargements : `pose` ne tombe que sur la molette confirmée,
   le bouton monde et l'orbite du `goto`. Si je l'avais cru, j'aurais cherché un
   `retirerCrop` fantôme dans `modes.js` ; la mesure des quatre grandeurs
   ENSEMBLE (`pose` vrai, `estompage` 0) a tranché à la première passe.

2. **« Le glissé vers le HAUT fait monter la caméra. »** ⛔ Faux : dans le crop
   c'est la rotation d'OrbitControls, et un glissé vers le haut **incline vers
   l'horizon** (angle polaire 2° → 83°, `d` collée à `minDistance`, altitude
   3 822 → 146 m). C'est le glissé vers le **bas** qui ramène au nadir et fait
   monter l'altitude à `d`. Le banc joue les deux sens, et la vidéo d'Adrien
   (`m_089` → `m_094`) va bien de la vue de trois quarts au nadir.

3. **« PORTE avait raison : l'inclinaison ne peut pas atteindre le seuil, donc
   la ligne est invérifiable. »** ⛔ Faux à moitié : depuis le **haut** du crop
   le glissé vers le nadir atteint **40 345 – 41 242 m** (8/8), et le bouton de
   caméra **205 km**. PORTE ne montait pas parce qu'il partait du fond — et le
   seuil qui compte pour la Terre visible n'est pas `SEUIL_MORT_M` mais
   **`ALT_ESTOMPAGE_FIN_M` = 19 364 m**, le bas de la bande d'estompage. Au-dessus,
   un simple PAN au bouton du milieu (qui fait *baisser* l'altitude, comme PORTE
   l'a mesuré) suffit à montrer le dehors à 60 – 75 %.

4. **« Un `goto` fait revenir la Terre dans le crop. »** ⛔ Faux : il la montre
   **en orbite**, pendant le vol, et le crop meurt par `poserMode(false)` — le
   même chemin que le bouton monde, une intention. 0 – 1 image en surface avant,
   0 après. Je ne présente pas cette ligne comme un défaut corrigé.

5. **« Un relais `pose && (auRepos \|\| !dehorsPermis)` suffit. »** ⛔ Faux — un
   test existant l'a attrapé : sans veille de repos il inventait un repos. Et
   ma première consommation de la permission (à chaque image de repos) aurait
   tué la molette elle-même : le cran arrive au DOM **avant** la première image
   du glissement, la vue est encore posée. Front montant, et le test ④ l'exige.

### Ajouts de VIE-2 — cru, puis réfuté

6. **« Le banc D19 hérité (PID 24152, lancé par VIE sans `--gestes`) va finir,
   il suffit d'attendre. »** ⛔ Faux : il jouait les **31** gestes de la sonde
   × 8 chargements dans **un seul Chrome**, sans journal lisible (son parent
   était mort), et son fichier n'est écrit qu'à la toute fin. Sondé en lecture
   seule par le port DevTools de son Chrome après 100 min : page en `orbital`,
   sur un geste sans rapport avec D19. Tué (lui et son Chrome, par PID), rejoué
   sur les **six gestes du témoin REV**. Et le second essai a montré pourquoi
   le premier n'aurait jamais fini : au **8ᵉ chargement** du même Chrome, la
   page ne répond plus (`Runtime.callFunctionOn timed out`, puis trois
   `Navigation timeout`), et la sonde meurt sur `window.__exp` absent. D'où
   **un processus et un Chrome par geste** ; les cinq ont fini en 3 – 4 min
   chacun, sans un seul « chargement raté ».

7. **« `saisiVsPointeurPx = 252 px` sur le glissé viole D19. »** ⛔ Faux dans
   le crop — voir § ④ : le témoin REV rendait 160 px sur le même geste avant
   tout correctif, et le glissé gauche y est la rotation du bloc. Le critère
   D19 du glissé est `terreDerivePx`, 0 × 8.

8. **« Les tours 2 et 3 de `ar3` sortent en 3 – 4 crans : la porte de PORTE
   a régressé. »** ⛔ Faux : PORTE mesurait exactement `8/21 4/20 4/20` — le
   deuxième tour part de la renaissance (31 km), à 4 crans de la mort
   (41 km), pas du fond du crop.

## LES OCTETS, ET LES OUTILS

- **Fins de ligne relues à l'octet, en binaire** (`Buffer` → comptage de
  `0x0D`) : **CR = 0** sur `src/monde/branchement-crop.js`, `package.json`
  (édité en binaire, `latin1` aller-retour), `test/vie-crop.test.js`,
  `test/veille-repos.test.js`, `test/estompage-fondu.test.js`,
  `scripts/sonde-vie.mjs`.
- **Un banc neuf** : `scripts/sonde-vie.mjs` — 8 gestes, `127.0.0.1`, vol de
  démarrage attendu, voile levé, **entrée par le haut** (`enterOrbit(80 km)` puis
  crans jusqu'à la naissance), enregistreur `rAF` dans la page (une ligne par
  image), « Terre visible » = surface ∧ (crop mort ∨ estompage posé < 1).
- ⚠️ **`--capture` photographie à la FIN de la passe, pas au pic** : ces PNG
  montrent l'état posé, pas la Terre revenue ; la preuve est dans les courbes
  JSON, image par image. Je le dis pour qu'on ne les lise pas comme la preuve.
- **Aucune ligne de `src/` touchée par les bancs.**

## LES TRACES

`.banc/VIE/` — `avant-{glisse-bas,glisse,inclin,iso,goto,molette,monde}.json`
(sur l'arbre témoin `wt-vie-avant`, recopiés ici), `apres-*.json` (8 chargements
chacun, courbe complète par image), `ge3-crop8-{gauche-glisse-H-100px,
molette-1cran,c1-inclinaison-forte,c1-droit-dezoom,c1-boutons-camera}.json`
(D19, VIE-2), `.banc/PORTE/vie-retour.json` et `vie-ar3.json` (VIE-2).

Suite finale sous VIE-2, sur cette branche (base `6275e62`, sans la base du
jour) : **`npm test` 5 008 · 0** (5 001 avant + 7 de `vie-crop`),
**`audit:tests` 272 = 272, aucun écart**. En partant : le Vite de 9601 et les
Chrome `puppeteer_dev_chrome_profile` dont le parent était mon `node` sont
arrêtés par PID ; deux Chrome sans tête orphelins sur le port **9471** (un
autre arbre) ont été laissés en place, ils ne sont pas à moi.
