# REV — D23 : le crop revient à z10, et les quatre grandeurs restent séparées

Arbre `C:\Dev\wt-z10`, branche `crop-z10`. Serveur : `npm run dev -- --host
127.0.0.1 --port 7731 --strictPort`, **arrêté en partant**. Les Chrome sans tête
sont ceux de `puppeteer-core`, lancés et fermés par mes scripts ; aucun autre
n'a été touché.

---

## ⚠️ LA RÉSERVE, EN TÊTE — **LA DEUXIÈME SORTIE DU CROP D'ADRIEN N'EXISTE PLUS**

**C'est la conséquence la plus lourde du revert, elle est mesurée, et elle n'est
pas rattrapable sans une décision d'Adrien.**

D21 ① donne trois sorties au crop : le bouton « map monde », **un dézoom au clic
droit maintenu**, un dézoom à la molette. ⛔ **La deuxième ne fonctionne plus.**

| où | régime | `mouseButtons` | ce que fait le clic droit | mesuré |
|---|---|---|---|---|
| **dans le crop** (≈ 10 km) | `crop` | `{LEFT: 0, MIDDLE: 2, RIGHT: 2}` | **un PAN** — pas un zoom | `cropPose` **true→true 8/8**, altitude 10 457 → 8 589 m (elle *descend*), `\|Δ ln d\| = 0` |
| **hors du crop** (≈ 250 km) | `surface` | `{LEFT: −1, MIDDLE: −1, RIGHT: −1}` | **un zoom** (D19) | altitude 251 956 → **726 014 m 8/8**, `\|Δ ln d\| = 0,69` — le geste marche parfaitement… mais il n'y a plus de crop à tuer |

**Le mécanisme, et il n'est pas neuf :** GE2 a mesuré que « le régime de la Terre
s'ARRÊTE au crop » (`main.js:3163`) — le rendre à gestes-terre sur le bloc avait
laissé la vue **totalement inerte**, 0 px et 0° sur les quatre gestes. C1 l'avait
écrit en réserve n° 2 : « sous 32 km, sur le bloc, le clic droit est rendu à
OrbitControls ».

⚡ **Ce que D21 ② faisait sans qu'on le dise :** en faisant naître le crop à
600 km, il créait **une bande de 568 km où l'on était DANS le crop et pourtant
en régime `surface`** — et c'est là, et là seulement, que le clic droit servait
de sortie. **Annuler z7 supprime la bande, donc la sortie.** Ce n'est pas une
régression que j'aurais introduite : c'est l'état d'avant D21, restauré.

➡️ **Adrien, ça se tranche en une phrase, et je ne devine pas :**
1. **soit** les sorties du crop sont *la molette et le bouton monde* (les deux
   qui ne dépendent pas du régime de gestes) — alors D21 ① est à amender ;
2. **soit** le clic droit doit rester une sortie sur le bloc — alors c'est
   **R13/GE2 à rouvrir**, et il faut redonner le clic droit à gestes-terre dans
   le crop **sans** rendre la vue inerte, ce qui est un vrai chantier et se
   mesure.

---

## ① LE REVERT — et la preuve que les quatre constantes restent séparées

`src/monde/seuil-socle.js` :

```
SEUIL_BLOC_M       = 32 274,3 m   (altitudePourFraction, 60 %)   inchangé
SEUIL_BLOC_MORT_M  = 40 342,8 m   (×1,25)                        inchangé
SEUIL_NAISSANCE_M  = SEUIL_BLOC_M       ← était ALT_PALIER_Z7_M (600 000)
SEUIL_MORT_M       = SEUIL_BLOC_MORT_M  ← était 750 000
```

**Quatre constantes, deux valeurs, et c'est voulu.** Elles coïncident en valeur
et **pas en sens** : `SEUIL_NAISSANCE_M`/`SEUIL_MORT_M` décident de la
**géométrie du crop** et du **régime de gestes** (`horsDuCrop`, donc D19) ;
`SEUIL_BLOC_M`/`SEUIL_BLOC_MORT_M` décident de l'**arrivée au bloc** (D16 ter :
la bascule de trois quarts et son miroir, le retour au nadir) et de
l'**estompage**.

**La preuve est un test, pas une promesse** — `test/seuil-socle.test.js`,
« D23 — LES QUATRE CONSTANTES RESTENT SÉPARÉES, malgré deux valeurs égales ». Il
est de forme inhabituelle et c'est délibéré : **il lit l'espace de noms du
module** (`import * as seuilSocle`) au lieu de comparer des nombres, parce que
c'est la SUPPRESSION d'un nom qu'il doit attraper, pas une dérive de valeur.

> ⚠️ Un import nommé d'une constante supprimée ne rend pas `undefined` : il fait
> échouer le module au chargement avec une erreur de syntaxe qui ne dit rien de
> D23. Sans l'espace de noms, la garde ne garde rien.

Il vérifie aussi ce qui distingue les deux paires **quand les nombres ne les
distinguent plus** : `socleVisible` honore `sortieArmee` (D21 ①), `auBloc`
l'ignore. Même altitude, deux réponses.

`ALT_PALIER_Z7_M` **reste exporté et verrouillé contre `DIVE_TIERS`**, bien que
plus aucun seuil n'en descende : c'est la seule vérification pure du dépôt
contre cette table, et la retirer avec le seuil, c'était la perdre.

### Ce qui a rougi, et ce que ça dit

**Huit tests, tous des assertions de D21 ②, aucun ailleurs.** Le revert est
chirurgical : `estompage`, `rampe-crop`, `fenetre-bornee`, `veille-repos`,
`crop-rampe`, `regime-crop`, `dalles-crop` sont passés sans une ligne touchée.
Les huit sont réécrits en D23 et **trois d'entre eux ont changé de PREUVE, pas
de sens** — voir « ce que j'ai cru puis réfuté », n° 2.

---

## ② LA MER ET LES EFFETS SUIVENT LE CROP — mesuré à l'écran, 8 chargements

Sonde neuve : `scripts/sonde-rev-mer.mjs`. Trace : `.banc/REV/mer-effets.json`.
Elle sort du crop **comme l'utilisateur** — un dézoom à la molette, qui ARME
l'intention (D21 ①) et laisse le seuil TRANCHER — et relève les deux régimes
dans la même session. Voile fermé (`elementFromPoint` rend le `CANVAS`) et vol
de démarrage **immobile 1,5 s avec `d > 100`** avant tout geste.

| grandeur | DANS le crop | HORS du crop | verdict |
|---|---|---|---|
| altitude de cadrage | 3 680 – 4 196 m | **40 461 – 41 791 m** (seuil 40 343) | ✅ |
| `cropPose` · `dedansCrop()` | **8/8** vrai | **8/8** faux | ✅ |
| **mer simulée** (`globe._mer`) | **8/8 allumée** | **8/8 éteinte** | ✅ |
| **réfraction** (`_merRefractRT`) | **8/8 allumée** | **8/8 éteinte** | ✅ |
| **occlusion ambiante** (N8AO) | **8/8 allumée** | **8/8 éteinte** | ✅ |
| **grain** | **8/8 à 0,2** | **8/8 à 0** | ✅ |
| `uCropOn` (le nuanceur lui-même) | **8/8 à 1** | **8/8 à 0** | ✅ |
| **profondeur de champ — D20** | **8/8 allumée** | **8/8 allumée** | ✅ **l'exception tient** |
| tuiles | 435 – 644 | 714 – 809 | — |

**Aucun effet ne fuit hors du prédicat** : rien à rattacher. La demande d'Adrien
est rendue par construction, et la construction est vérifiée.

⚠️ **LES EFFETS SONT ALLUMÉS PAR LES PORTES DE L'UTILISATEUR** (`params`, puis
la bascule bokeh de l'interface, comme `profil-pf3.mjs`). Sans ça la sonde
rendait `ao: null, dof: null` **des deux côtés** — ce qui aurait dit qu'on
n'avait rien allumé, pas que le prédicat range bien les effets. Premier tour
jeté pour cette raison.

### La naissance, cran par cran

| | mesuré, 8 chargements |
|---|---|
| crans de molette pour SORTIR (depuis ≈ 3,7 km) | **85 – 91** |
| crans pour RENAÎTRE (depuis ≈ 41 km) | **16 – 20** |
| altitude de renaissance | **25 708 – 28 369 m** (seuil 32 274) |
| la mer revient après la renaissance | **5 – 43 ms** (7 fois), 4 361 ms une fois — **8/8 allumée** |

⚠️ **UN FAUX CONSTAT ÉVITÉ, ET IL EST INSTRUCTIF.** Le premier tour relevait
`cropPose: true` **avec `mer: false`** à la renaissance — trait pour trait un
prédicat cassé. C'est faux : **la chaîne (`crop`, `fond`, `parois`, `habillage`,
`rampe`, `mer`) est posée À LA SUITE de la bascule, pas dans la même image.** La
sonde attend désormais la mer et **chronomètre l'attente** ; le chiffre ci-dessus
est le résultat. Une milliseconde de patience séparait le constat du faux constat.

---

## ③ LE PRIX DE z7 EST BIEN PARTI

Banc `scripts/profil-pf1.mjs`, 60 images après 40 de chauffe, minuterie GPU avec
témoin de validité, palier machine fixé à 0, ralentissement CPU **mesuré**
(×4 demandé → **×4,17** relevé). Poste neuf `cropnaissance` (32 000 m, z11) :
**c'est la seule façon de comparer**, la mesure de C1 étant prise à la naissance
du crop, qui a déménagé de 600 km à 32 km. Traces : `.banc/REV/pf1-D23.json`,
`pf1-D23-sanscrop.json`.

### À LA NAISSANCE DU CROP — avant / après

| | **avant (D21 ②, 600 km)** | **après (D23, 32 km)** | gain |
|---|---|---|---|
| **tuiles** | **1 700** — *exactement* `CACHE_MAX_CONTINU` | **335 – 344** | **÷ 5,0** |
| géométries | 1 342 | 182 | ÷ 7,4 |
| triangles | 1 385 323 | 287 353 | ÷ 4,8 |
| **ms/image, CPU ×4** (p50/p99) | **129,9 / 202,5** | **30,9 / 49,6** | **÷ 4,2** |
| ms/image, ma machine | 21,7 / 35,5 | **3,3 / 8,8** | ÷ 6,6 |
| poste dominant CPU à ×4 | `rendu.objets` 64,78 ms | `rendu.objets` **13,94 ms** | ÷ 4,6 |

➡️ **VERDICT : les 1 700 ne persistent PAS à z10, et le cache n'est plus
saturé.** 344 tuiles, c'est **20 % du plafond** au lieu de 100 %. Le mécanisme
que C1 avait identifié — prescrire `ZOOM_SOCLE = 13` sur une emprise de 440 km —
disparaît avec l'emprise : à 32 km elle fait ~27 km, pas 440.

**7,7 im/s à ×4 sont devenues 32 im/s.** C'est ce qu'Adrien demandait.

### ⚠️ MAIS LES 1 700 EXISTENT ENCORE, ET C'EST LE SECOND DÉFAUT QUE LE BRIEF ANTICIPAIT

**Il est indépendant de z7, et il est précieux.** Relevé par `profil-pf3.mjs`,
poste `surface` (trace `.banc/PF3/D23-effets.json`), altitude **de cadrage**
129 999,99 m :

```
mode surface · altM 130 000 · pose TRUE · crop TRUE · mer TRUE · ao TRUE
cropOn 1 · grain 0.2 · tuiles 1700 · rAF p50 44,10 ms (contre 11,90 dans le crop)
```

**Le crop est vivant à 130 km, avec sa mer et ses effets, et il y sature le cache
au plafond — exactement comme sous z7.**

⚡ **Et ce n'est pas un défaut du prédicat : c'est D21 ① qui fonctionne.** Le banc
porte la caméra à 130 km **en écrivant sa position**, donc sans geste de dézoom,
donc **sans intention** — et D21 ① dit mot pour mot que l'altitude seule ne tue
plus le crop. L'inclinaison, le cap et les boutons de caméra font exactement la
même chose : `c1-boutons-camera` monte de 10 km à **38 473 m** (espace globe)
avec `cropPose: true→true` **8/8**.

➡️ **La conséquence, dite net :** D23 borne la naissance du crop à z10, **il ne
borne pas sa VIE**. Un utilisateur qui incline fort, ou qui use des boutons
d'angle de caméra, emporte le crop — et son coût — aussi haut qu'il veut.
**Le levier que C1 avait chiffré reste le bon et reste à faire : un plafond de
finesse fonction de l'altitude** (le crop haut se remplit à z9, pas à z13). Il
vise le même facteur, il ne touche à aucun seuil, et **il est maintenant le seul
chemin qui reste vers les 1 700**.

### ⚠️ UN TÉMOIN QUE JE DONNE AVEC SA RÉSERVE

`?terre=deux` (l'ancien bloc plat), même lieu, même altitude de 32 km :

| | tuiles | triangles | ma machine | **CPU ×4** |
|---|---|---|---|---|
| **avec le crop** (D23) | 335 – 344 | 287 353 | 3,3 ms | **30,9 ms** |
| témoin `?terre=deux` | 539 – 567 | **1 510 129** | 2,2 ms | **183,2 ms** |

⛔ **Je n'en conclus PAS « le crop fait gagner ×5,9 ».** À 600 km, C1 comparait
deux scènes proches et l'écart isolait le crop ; **à 32 km les deux
architectures ne font pas la même chose** — le témoin dessine le bloc plat cuit
à pleine finesse (1,5 M de triangles) **en plus** du globe. Ce tableau dit une
chose et une seule, mais il la dit : **à l'altitude où le crop est conçu pour
vivre, il ne coûte pas plus cher que ce qu'il remplace.** C'est l'inverse exact
de ce que z7 mesurait, et ça suffit à justifier le revert.

---

## LE TABLEAU DU CRITÈRE — huit chargements par ligne

Bancs : `scripts/sonde-rev-mer.mjs` (mer, effets, seuils) et
`scripts/sonde-ge3.mjs --repete 8` (gestes), un geste par chargement.
Traces : `.banc/REV/mer-effets.json`, `ge3-crop8.json`, `ge3-hors8.json`.

| situation | attendu | mesuré, 8 chargements | verdict |
|---|---|---|---|
| descente depuis l'orbite | le crop naît **à z10** | naissance relevée entre **25 708 et 28 369 m** (seuil 32 274) **8/8** ; ligne de partage rejouée entre **z10 (51 340 m)** et **z11 (25 670 m)** | ✅ |
| dans le crop, **incliner** au-delà de `SEUIL_MORT_M` | le crop **VIT** | `cropPose` **true→true** avec l'altitude de **cadrage** portée à **130 000 m** (`profil-pf3`), soit **3,2 × `SEUIL_MORT_M`** | ✅ |
| dans le crop, **boutons d'angle de caméra** | le crop vit | `cropPose` **true→true 8/8**, 10 019 → 38 473 m (espace globe), `\|Δ ln d\|` jusqu'à 0,087 — un vrai changement d'échelle, et le crop reste | ✅ |
| **dézoom molette** | le crop meurt | `cropPose` **true→false 8/8**, au **85ᵉ–91ᵉ cran**, mort entre **40 461 et 41 791 m** (seuil 40 343) | ✅ |
| **bouton map monde** | le crop meurt | `cropPose` **true→false 8/8**, `mode` **surface→orbital 8/8**, retour au nadir **−46,47° 8/8** | ✅ |
| **dézoom clic droit maintenu** | le crop meurt | ⛔ **`cropPose` true→true 8/8** — le clic droit est un PAN dans le crop | ⛔ **voir la réserve en tête** |
| zoom avant dans le crop | le crop vit | `cropPose` **true→true 8/8** (`molette-1cran`, `\|Δ ln d\|` 4,9e-4) | ✅ |
| **mer + effets hors crop / dans le crop** | éteints / allumés | **8/8 des deux côtés, sur les six témoins** (mer, réfraction, occlusion, grain, `uCropOn`, tuiles) | ✅ |
| **profondeur de champ (D20)** | active des deux côtés | **8/8 allumée hors crop ET dans le crop**, plus **8/8 en orbite** (`profil-pf3`) | ✅ |
| tuiles et ms/image à la naissance, CPU ×4 | retour au niveau d'avant z7 | **1 700 → 344 tuiles**, **129,9 → 30,9 ms** | ✅ |

### La non-régression

| garde | attendu | mesuré |
|---|---|---|
| `npm test` | ≥ 4 869 · 0 | **4 870 · 0** |
| `audit:tests` | 261 = 261 | **261 = 261, aucun écart** |
| **D19 — le glissé attrape la Terre** | ≤ 0,2 px | **`saisiVsPointeurPx = 0` sur les 8**, `terreDerivePx = 0` sur les 8 |
| **D19 — la molette vise le CENTRE** | ≤ 1,4 px | **`centre0DerivePx = 0` sur les 8** (`rapportDistance` 1,0171 constant) |
| **D19 — le régime hors crop** | la bibliothèque inerte | `mouseButtons` **`{−1, −1, −1}`** à 250 km, `enableRotate: false` — gestes-terre a la main |
| `\|Δ ln d\|` — glissé gauche | < 1e-4 | **0 sur les 8** |
| `\|Δ ln d\|` — inclinaison dans le crop | < 1e-4 | **4,44e-16 sur les 8** |
| **D16 ter — la vue de trois quarts** | arrive au bloc | `tiltDeg = 46,548°` à la pose du bloc — l'identité `90° − atan(18/19)`, au millième |
| **D16 ter — le retour au nadir** | au bloc | **−46,47° sur les 8**, bouton monde depuis le bloc |
| **D16 ter — le nadir pendant la descente** | aucune bascule | `tiltDeg = 0,000057°` à 250 km |
| l'estompage | inchangé au bit près | `ALT_ESTOMPAGE_DEBUT_M = SEUIL_BLOC_MORT_M` = 40 342,8 m, **et le test épingle le NOM dans la source**, pas seulement la valeur |
| `zoomDepuisAltitude(SEUIL_BLOC_M, 45°) === ZOOM_SOCLE` | intact | intact, rend **exactement 13** |

⚠️ **`molette-1cran` rend `curseur0DerivePx = 4,11 px`, et ce n'est PAS un
échec** : D19 pose que la molette zoome **vers le centre de l'écran**, pas vers
le curseur (c'est la règle de Google Earth, et elle est écrite dans D21 « ce que
ça n'abroge pas »). La grandeur à lire est `centre0DerivePx`, et elle vaut **0**.
J'ai failli reporter le mauvais chiffre.

---

## LES COMMENTAIRES REMIS D'ACCORD AVEC LE CODE

Relus un par un. **Deux classes, et elles ne se réparent pas pareil.**

**① Des chiffres devenus faux sous D21, redevenus vrais avec D23.** Ils ne
demandaient aucune correction de fond — seulement de dire qu'ils ont été faux,
pour qu'on ne croie pas qu'ils n'ont jamais bougé :

| fichier | ce qu'il citait | traitement |
|---|---|---|
| `flags.js:180` | « naît sous 32 274 m, meurt au-dessus de 40 343 m » | ✅ exact de nouveau — **estampillé** « faux entre D21 et D23 », plus un rappel que D21 ① ajoute l'intention |
| `rampe-crop.js:977` | idem, pour justifier `2¹⁵ = 32 768` | ✅ exact de nouveau — estampillé |
| `main.js:14197` | la pose de démarrage à cheval sur le seuil | ✅ **et ce paragraphe REDEVIENT VIVANT** — voir ci-dessous |

**② Des NOMS faux, que la coïncidence de valeur allait faire passer.** Ceux-là
sont de vraies corrections : ils nommaient `SEUIL_NAISSANCE_M` là où l'équation
porte sur `SEUIL_BLOC_M`. C'était faux sous D21 (la naissance était un palier de
600 km, qui ne descend d'aucune fraction d'écran ni d'aucun fov) et ce serait
**redevenu faux au prochain déplacement du seuil de naissance** :

- `exageration-continue.js:66,67` et `:209` — `FRACTION_REFERENCE` et
  `zoomDepuisAltitude(…) === ZOOM_SOCLE` portent sur **`SEUIL_BLOC_M`** ;
- `globe.js:112` et `:6217` — le fov qui alimente le seuil de bascule de la mer
  alimente **`SEUIL_BLOC_M`** ;
- `seuil-socle.js:184` — la conséquence du fov à 33° porte sur **`SEUIL_BLOC_M`**.

**Bonus, trouvé en relisant :** `exageration-continue.js:61` citait
`main.js:264` pour la ligne `fov: 30`. C'est la **même citation fausse** que
`seuil-socle.js` dément depuis le 2026-08-21 (« pas `main.js:263`, qui parle du
maillage du bloc central ») — le démenti avait été posé dans un fichier et pas
dans l'autre. Corrigé.

### ⚡ `main.js:14197` — le paragraphe qui redevient vivant, et c'est un piège

Le défaut bimodal de GE2 tour 2 (−50° ou −69° de cap selon le chargement) tenait
à ce que **la pose de démarrage tombe parfois AU-DESSUS du seuil de naissance**
(33,05 km contre 32,27) : le crop ne naît pas, donc ne meurt pas, donc
`_armerRetourNadir` ne part pas, et l'inclinaison héritée du vol de présentation
reste posée.

**Sous D21 ②, ce défaut était masqué de bout en bout** : le seuil valait 600 km,
très au-dessus de toute pose de démarrage, donc le crop naissait **toujours**.
**D23 le ramène à 32 274,3 m — de nouveau à cheval sur la pose de démarrage
(30,7 – 33,6 km).** Le redressement automatique reprend du service, et **toute
mesure prise avant que le vol de démarrage soit immobile redevient un faux
constat en puissance**. C'est écrit dans le fichier, et c'est la raison pour
laquelle ma sonde attend `d > 100` et 1,5 s d'immobilité.

`regle-D21.md` est **amendée** : bandeau en tête (② abrogé, ① et ③ intacts, la
séparation gardée), et le § ② marqué ABROGÉ tout en étant conservé — c'est lui
qui a produit la séparation qui, elle, survit.

---

## CE QUE J'AI CRU, PUIS RÉFUTÉ

Elle n'est pas vide, et trois des cinq ont changé ce que je livre.

1. **« Le poste `surface` de `profil-pf3` mesure "hors crop". »** ⛔ **Faux, et
   c'était mon premier constat — j'ai failli le livrer comme un défaut.** À
   130 km il rend `pose: true`, `mer: true`, `ao: true`, **1 700 tuiles** : la
   mer allumée très au-dessus du seuil ressemble trait pour trait à un prédicat
   cassé. Le banc **place la caméra en écrivant sa position**, donc sans geste,
   donc **sans intention** — et D21 ① dit que l'altitude seule ne tue plus le
   crop. J'ai dû écrire une sonde qui sort **à la molette** pour mesurer ce que
   le brief demandait. ⚡ **Et le "défaut" réfuté est devenu le résultat n° 2 du
   rapport** : c'est par là que les 1 700 restent atteignables.

2. **« Le départage `pose` / `auBloc` ne sert plus à rien puisque les deux
   paires valent pareil. »** ⛔ **Faux, et c'est ce qui a sauvé le test ④ de
   `crop-intention`.** Ma première réécriture allait le vider de sa substance,
   faute d'altitude qui sépare encore les deux automates. **Il en existe une, et
   c'est D21 ① qui la crée** : sans intention le crop SURVIT au-dessus de
   `SEUIL_MORT_M` tandis qu'`auBloc`, qui n'a pas d'intention, redescend à
   `false`. **Les deux divergent donc toujours en vol, à la même altitude.** Le
   test mesure désormais cette divergence-là ; si `arriveeSurLeBloc` relisait
   `repos`, la vue de trois quarts se rallumerait à 60 km et D16 ter tomberait —
   **encore aujourd'hui**.

3. **« Un `mer: false` avec `cropPose: true` à la renaissance est un défaut. »**
   ⛔ Faux : la chaîne du crop est posée **à la suite** de la bascule, pas dans
   la même image. Mesuré : la mer arrive **5 à 43 ms** après. La sonde attend et
   chronomètre au lieu de conclure.

4. **« `altDebutM` / `altFinM` du banc de gestes disent si l'on a franchi
   `SEUIL_MORT_M`. »** ⛔ **Faux, et c'est le piège que C1 a déjà payé une
   fois.** Ces champs sont `altFondM`, en **espace GLOBE** ; la loi du crop lit
   `altitudeCadrageM()`, en **espace BLOC**, et `altFondM ≈ 2 × altCadrageM`.
   Les 38 473 m de `c1-boutons-camera` valent ~19 km de cadrage — **sous** le
   seuil de mort. J'allais écrire « le crop survit au-delà de 40 343 m » sur ce
   chiffre-là. La preuve correcte vient de `profil-pf3`, qui lit
   `altitudeCadrageM()` et rend **130 000 m avec le crop vivant**.

5. **« `curseur0DerivePx = 4,11 px` viole le critère molette ≤ 1,4 px. »**
   ⛔ Faux : D19 pose que la molette zoome vers le **centre de l'écran**, pas
   vers le curseur. La grandeur juste est `centre0DerivePx`, et elle vaut **0**.

**Et une faute de méthode, qui n'a rien réfuté mais qu'il faut dire :** j'ai
inséré un paragraphe de commentaire **au milieu d'une phrase** de
`main.js:14197` (entre « le » et « crop ne naît jamais »). Rattrapé à la
relecture, avant tout commit. **Le scalpel, pas la hache** — la règle du
chantier, lue trop vite une fois de plus.

---

## LES OCTETS, ET LES OUTILS

- ⚠️ **Toutes les éditions relues au niveau de l'octet** : `git diff` filtré sur
  `[\x00-\x08\x0b\x0c\x0e-\x1f]` puis `cat -A` — **aucun octet de contrôle**.
  Les remplacements mécaniques sont faits en binaire (`io.open(..., newline='')`)
  et le résultat est relu par `grep | cat -A`.
- **Deux bancs corrigés, et c'était une vraie panne** : `profil-pf3.mjs` et
  `profil-pf1.mjs` chargeaient `http://localhost:${PORT}`. Vite écoutant sur
  `--host 127.0.0.1` comme l'exige le chantier, `localhost` partait sur `::1` et
  **`profil-pf3` mourait sur `Waiting failed: 180000ms exceeded`** sans jamais
  dire pourquoi. Les deux tirent désormais `127.0.0.1`.
- **Un poste neuf** au catalogue de `profil-pf1.mjs` : `cropnaissance`
  (32 000 m, z11) — sans lui l'avant/après comparait deux altitudes.
- **Une sonde neuve** : `scripts/sonde-rev-mer.mjs`.
- **Aucune ligne de `src/` touchée par les bancs.**

## LES TESTS INSCRITS

`package.json` porte une **liste explicite** ; un test absent n'y tourne jamais.
Les deux tests neufs de D23 sont dans des fichiers **déjà inscrits**
(`test/seuil-socle.test.js`, `test/crop-intention.test.js`), donc aucun ajout à
la liste — et `npm run audit:tests` rend **261 = 261, aucun écart**, ce qui le
confirme au lieu de le supposer.

## LES TRACES

`.banc/REV/` — `mer-effets.json` (8 chargements, les deux régimes cran par
cran), `pf1-D23.json` et `pf1-D23-sanscrop.json` (tuiles et ms, ×1 et ×4),
`ge3-crop8.json` et `ge3-hors8.json` (6 gestes × 8, dans et hors du crop).
`.banc/PF3/D23-effets.json` (les trois postes, passe par passe).

## LES COMMITS

| | |
|---|---|
| `2f18350` | **D23** — le crop revient à z10, les quatre constantes restent séparées, les commentaires remis d'accord, `regle-D21.md` amendée |
| *(celui-ci)* | le rapport, les traces, la sonde neuve et les deux bancs réparés |
