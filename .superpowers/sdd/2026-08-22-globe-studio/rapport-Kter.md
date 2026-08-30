# Tâche K ter — LES QUATRE DÉFAUTS VISIBLES

**Statut : LIVRÉE.** Commit unique **`6ec0094`** sur `regroupement`.
`npm test` **3 770 / 3 770** (3 745 au départ, **+25**) · `npm run audit:tests` **204 / 204** ·
`node --check` vert sur les six fichiers touchés · page chargée **drapeau levé ET baissé**,
aucune erreur JS ni de nuanceur en console · campagne de mutation **24 / 24**, dont **15 visent
le BRANCHEMENT**.

⚠️ **L'ARBRE N'EST PAS TOTALEMENT PROPRE, ET CE N'EST PAS MOI.**
`docs/superpowers/plans/2026-08-22-globe-studio.md` était **déjà modifié quand j'ai pris
l'arbre** (ajout de la décision **D9** à la Tâche M, sur le pas de zoom mesuré par Adrien). Je
ne l'ai ni touché ni commité : il n'est pas de ma tâche et le commiter l'attribuerait à tort.
⚠️ **Deux choses à signaler au contrôleur sur ce fichier :** la phrase « Le réglage porte sur le
CRAN, pas sur le tour de molette » **y est écrite deux fois de suite**, et le fichier a été
réécrit avec d'autres fins de ligne — `git diff --stat` annonce **710 lignes** là où
`--ignore-cr-at-eol` en compte **34**. C'est le piège CRLF du §0, en vrai, sur cet arbre.

---

## 0. LE BANC — DEUX FAÇONS DE MENTIR, DONT UNE NEUVE

⛔ **LE CANEVAS DE LA PAGE N'A PAS DE TAMPON DE PROFONDEUR.** Relevé :
`gl.getContextAttributes()` rend **`depth: false`** (et `autoClear` vaut `false`, le piège n° 1
du §0). L'application, elle, rend dans les cibles du compositeur, qui en ont un
(`composer.inputBuffer.depthBuffer === true`). **Un `renderer.render(sceneGlobe, camGlobe)`
dirigé vers le canevas dessine donc SANS AUCUN TEST DE PROFONDEUR** : tout se superpose dans
l'ordre de la liste, et **un bloc parfaitement opaque y ressemble à du verre**.
⚠️ **Ce chemin a failli emporter le diagnostic de cette tâche** — j'ai passé une demi-heure à
conclure des choses fausses sur les parois et les jupes à partir de quatre captures qui ne
prouvaient rien. **Les captures issues de ce chemin ont été effacées du disque**, et aucun
chiffre de ce rapport n'en vient.

**Ce qui donne les chiffres** est une **cible à profondeur** (`WebGLRenderTarget`,
`depthBuffer: true`), lue par `readRenderTargetPixels`, **sans post-traitement**.

| chemin | témoin (deux rendus synchrones, même instant) |
|---|---|
| **compositeur** — ce qu'Adrien REGARDE | **98,542 % · 98,567 % · 98,560 % · 98,571 %** sur 4 prises |
| **cible à profondeur** — ce qui MESURE | **0 % · 0 % · 0 % · 0 %** sur 4 prises |

Le grain de pellicule est **animé** (`NoiseEffect`, opacité **0,26**, relevé) : c'est la
huitième façon de mentir du brief, confirmée. **Aucun chiffre ne vient du compositeur.**

⚠️ **ET JE GARDE UNE PRISE ABERRANTE PLUTÔT QUE DE LA CHOISIR.** Le témoin du compositeur
relevé pendant `AV-releves.json` vaut **0 %**, contre ~98,55 % sur les quatre prises ci-dessus.
**Je ne l'explique pas.** C'est une raison de plus de ne rien tirer de ce chemin — pas une
raison de retenir la prise qui arrange. Les deux sont sur le disque.

⚠️ **UNE TROISIÈME ERREUR DE BANC, CORRIGÉE EN COURS DE ROUTE ET DITE ICI** : la première
version de la cible se dimensionnait sur `canvas.width` sans garde, et le gouverneur de
performance change le rapport de pixels (**0,85** : le canevas passe de 1 600 × 900 à
1 360 × 765). Une cible restée à 1 600 × 900 rendait un cadre **vide**, dont une première
mesure a tiré un « 100 % des pixels changent ». **Ce chiffre est retiré**, la garde de taille
est dans le harnais, et toutes les mesures ci-dessous ont été refaites après.

⚠️ **ET UN `retour` NON NUL, DIT AUSSI** : une première passe d'A/B a rendu un retour à
**8,51 %** parce qu'un `await` laissait la boucle d'image avancer entre le témoin et le
retour. Le protocole a été resserré à **une seule tâche synchrone** ; les mesures retenues ont
toutes un retour à **0 pixel**, sauf une (voir §1).

**Données brutes :** `.banc/vues-Kter/AV-releves.json`, `AV-apparie-releves.json`,
`AP-releves.json`, `AV-orbite.json`, `AP-orbite.json`, `SOCLE-PROD-releves.json`,
`temoins.json`. **Dépouillement :** `.banc/bilan-Kter.mjs`. **Harnais :**
`.banc/harnais-Kter.js` (il reprend la pompe de la Tâche K bis). **Mutations :**
`.banc/mutations-Kter.mjs`.

---

## 1. ⛔ DÉFAUT n° 1 — LE BLOC TRANSLUCIDE : LA CAUSE EST PLUS PROFONDE QUE LE BRIEF

**Le brief soupçonnait `transparent: true`. Ce n'est pas ça, et couper la transparence aurait
cassé l'estompage sans réparer l'image.** La cause est **arithmétique**, dans le nuanceur :

```
vec2 cq = max(abs(q) - (1.0 - uCropCoin), 0.0);      // <- ÉCRÊTÉ À ZÉRO au dedans
float pn = pow(pow(cq.x, N) + pow(cq.y, N), 1.0/N);  // <- vaut donc EXACTEMENT 0 au dedans
float d  = pn - uCropCoin;
float w  = max(fwidth(d), 1e-12);                    // <- fwidth d'une CONSTANTE = 0
float dedans = 1.0 - smoothstep(-0.5*w, 0.5*w, d);
```

`dansDalle` écrête `pn` à zéro dans tout le rectangle intérieur. Au dedans, `d` valait donc la
**constante `-uCropCoin`**, et `fwidth(d)` valait **zéro** avec elle.

⛔ **ET `uCropCoin` VAUT ZÉRO EN PRODUCTION.** `poserCrop` a `corner = 0` pour défaut et
`branchement-crop.js` ne lui en passe pas. Relevé dans l'application vivante : **`uCropCoin =
0`**. Alors `d = 0`, `w = 1e-12`, et le `smoothstep` est évalué **au milieu exact de son
intervalle** : il rend **0,5**. ➡️ **TOUTE la surface du crop était dessinée à une couverture
de 0,5.** Parois, mer et fond se mélangeaient ; on traversait le bloc du regard.

⚠️ **Tant que `coin > 0`, personne ne le voit** (`d = -coin` sature le `smoothstep`) — c'est
pourquoi la Tâche B, qui a écrit cette ligne, l'a validée de bonne foi.

**La réparation ne touche pas au matériau.** `distanceCrop` (nouveau, dans `crop-sphere.js`,
pur et testé) ajoute `min(max(ex, ey), 0)`, **nul dès qu'une composante est positive** —
c'est-à-dire sur toute la frontière, dans tous les coins et dans tout le dehors, où la loi rend
donc **au bit près** ce qu'elle rendait (`Object.is` sur un balayage de plus de 3 000 points,
test ④d). Il n'est non nul que **strictement dedans**, là où l'ancienne écriture rendait une
constante qui ne mesurait rien.

⚠️ **`transparent: !!this._crop` EST CONSERVÉ, ET UN TEST L'EXIGE** (④j) : l'estompage de la
Tâche G en a besoin pour les ALENTOURS — `couvertureTuile = mix(1.0, dedans, estompage)` vaut
`1 - estompage` hors du crop. **La distinction qui manquait était dans la distance, pas dans le
matériau.** C'est bien ce que le brief soupçonnait, mais un cran plus bas.

### La mesure, APPARIÉE

A/B `uCropCoin` **0 → 0,2** — la variante rend au dedans la couverture à 1, ce que la loi
réparée fait désormais toute seule ; ce qui **reste** après est la forme des coins.
⚠️ **MÊME CADRE, MÊME CADRAGE, MÊME CHEMIN** : l'AVANT a été **repris après avoir retiré le
correctif par `git stash`**, pas emprunté à une session antérieure. C'est ce qui autorise à
soustraire les deux pourcentages.

| | pixels changés | % du cadre (1 440 000 px) | amplitude moyenne | témoin | retour |
|---|---|---|---|---|---|
| **AVANT** (`d6d6478`) | **255 093** | **17,7148 %** | 18,84 / 255 | **0 px** | **0 px** |
| **APRÈS** (`6ec0094`) | **5 594** | **0,3885 %** | 50,31 / 255 | 11 px | **0 px** |

➡️ **17,33 points de cadre étaient de la translucidité.**
⚠️ **Le témoin APRÈS n'est pas nul : 11 pixels sur 1 440 000, amplitude 1/255.** Je ne le
maquille pas ; il ne change aucune conclusion, et je ne l'explique pas.

---

## 2 et 3. ⛔ DÉFAUTS n° 2 ET n° 3 — UNE SEULE CAUSE, ET LE BRIEF EN VOYAIT DEUX

**Le masque de côte éteint et l'occupation du sol éteinte sont le MÊME défaut : l'habillage
n'est jamais rafraîchi.** Il « ne refuse jamais », donc `reprendre` ne le rejoue jamais ; et la
chaîne ne se repose que si la **signature du LIEU** change. Tout ce qui arrive après la
première pose n'atteignait donc jamais le nuanceur.

**Relevé dans l'application vivante, La Réunion z12 :**

| ce que `contexteCrop()` PORTE | ce que le globe ALLUMAIT |
|---|---|
| `habillage.coastMask` **non nul** | `uCoastMaskOn` = **0** |
| `habillage.amplitudeM` = **4 737,2 m** | `uContourInterval` = **500** (le défaut mondial) |
| `habillage.sol` + `solLut` posés (couche allumée à la main, `terrain.mapUniforms.uSolOn = 1`) | `uSolOn` = **0** |

⚠️ **C'EST UNE COURSE, ET C'EST CE QUI L'A CACHÉE.** Sur un chargement où le masque arrive
avant la première pose, l'image est juste ; sur un autre, non. **Les deux ont été observés le
même jour, sur la même machine, à la même URL** — et sur un chargement, l'intervalle des
courbes était bon (250) pendant que le masque, lui, était éteint.

**La réparation** : `habillageDifferent` compare les **dix champs surveillés** par `Object.is`,
et `rafraichirHabillage` ne repose que **sur changement** — la garde de
`creerVeilleEstompage`, mot pour mot. `poserHabillage` n'écrit que des uniformes : c'est le
maillon le moins cher de la chaîne, et le seul qu'on puisse surveiller par image.

**Après, au chargement :** `uCoastMaskOn = 1`, `uContourInterval = 250`,
`veilleCrop.rafraichissements = 1`.

**Ce que vaut le trait de côte à l'écran**, A/B `uCoastMaskOn` sur le cadre APRÈS :
**3 962 px, 0,2751 % du cadre, amplitude moyenne 59,28 / 255**, témoin 0, retour 0.
*(La Tâche J bis prévoyait 5 761 px ; je ne reprends pas son chiffre, je donne le mien, mesuré
sur mon cadre et sur mon cadrage. Ils sont du même ordre.)*

⚠️ **ET L'INTERVALLE DES COURBES NE CHANGE RIEN AUJOURD'HUI — MESURÉ.** A/B
`uContourInterval` 250 → 500 : **ZÉRO pixel**. Parce que `uContourOpacity = 0` : **le gabarit
de l'utilisateur a les courbes de niveau ÉTEINTES**. Le rafraîchissement les servira dès
qu'elles seront rallumées ; il ne se voit pas maintenant. **Le dire vaut mieux que de compter
ce correctif comme un gain visible.**

### ⛔ L'occupation du sol reste ÉTEINTE, et je le dis avec la mesure

**Elle n'est pas éteinte par oubli du globe : elle est éteinte parce que la COUCHE est
éteinte, dans le mode plat aussi.** `couchesActives` part **VIDE** (`main.js:7477`) ; le
panneau « Couches » l'affiche éteinte au chargement. Le globe reflétait donc fidèlement la
production.

Ce qui était cassé, c'est le **branchement** : allumée à la main, la couche est arrivée dans
`terrain.mapUniforms` (`uSolOn = 1`, `sol` et `solLut` posés) et **le globe est resté à 0**.
C'est réparé et testé (⑨b, ⑨b bis — la TABLE seule qui change doit suffire ; une mutation a
survécu là-dessus au premier tour).

⛔ **MAIS SON IMAGE SUR LE GLOBE N'A PAS ÉTÉ VUE, ET JE NE PRÉTENDS PAS L'AVOIR VUE.** J'ai
réussi à allumer la couche **une seule fois** ; les trois tentatives suivantes sur la même
page l'ont vue **se rééteindre toute seule** (l'interrupteur repasse à l'état éteint —
c'est le comportement documenté de `refreshSol`, « can't deliver here? say so and switch the
layer back off »). Je n'ai donc **ni capture ni mesure de pixels** de l'occupation du sol sur
le crop. **Son coût mesuré par la Tâche C (+0,1781 ms) reste le seul chiffre qu'on ait sur
elle. C'est une réserve, pas une preuve.**

---

## 4. ⛔ DÉFAUT n° 4 — À L'ORBITE, LE CROP RESTAIT POSÉ

**`veilleCrop.poserMode` était écrite, testée, et appelée de NULLE PART.** `maj` sort à sa
première ligne utile sur `if (!modeSurface) return pose` — mais rien ne lui disait jamais qu'on
avait quitté la surface. `veilleSocle` et `veilleEstompage` recevaient le mode depuis
`setSurfaceVisible` ; celle-ci, non.

**Relevé à 3 000 km, mode `orbital`** (`.banc/vues-Kter/AV-orbite.json` / `AP-orbite.json`) :

| | `uCropOn` | `uHabOn` | `uCoastMaskOn` | `uLandMax` | `uOceanDepth` | `uMerFondBudgetM` | parois | mer |
|---|---|---|---|---|---|---|---|---|
| **AVANT** | **1** | **1** | **1** | **2 584,4 m** | **1 262,0 m** | **3 510,5 m** | **oui** | **oui** |
| **APRÈS** | 0 | 0 | 0 | **5 600** | **6 000** | **6 000** | non | non |

`5 600 / 6 000 / 6 000` est **`RAMPE_MONDE`** : la planète a repris son échelle. Avant, tout
sommet au-dessus de **2 584 m** saturait en blanc sur la sphère entière, tout océan plus
profond que **1 262 m** saturait de même, **et le masque de côte cuit pour La Réunion, lu en
`ClampToEdge`, décidait de la terre et de la mer sur toute la planète.** Les parois et la nappe
de mer du bloc flottaient en orbite. **Capture : `CIB-AV-ORB.png` contre `AP-ORB.png`.**

⚠️ **AUCUN SEUIL D'ALTITUDE N'EST INTRODUIT — LA CONSIGNE « ZÉRO SAUT » TIENT.** On branche le
**même interrupteur de mode** que les deux autres veilles reçoivent déjà, sur la **même bascule
surface/orbite** de `modes.js`, franche depuis toujours. La loi continue de l'estompage n'est
pas touchée. Un test le garde par le comportement (⑩d : à altitude **identique**, seul le mode
décide).

⚠️ **Et sous `terre unique`, l'estompage n'a qu'UN écrivain** : `veilleCrop.poserMode` relaie
`estompage.poserMode` lui-même. Un test refuse l'appel direct à côté (⑩b).

**Le retour en surface est vérifié à l'écran** (`AP-retour-surface.png`) : la chaîne revient,
`refus` vide, 3 bascules, 3 rafraîchissements.

---

## 5. CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE DE PRODUCTION

**Toutes dans `.banc/vues-Kter/`, même lieu, même cadrage, même vue isométrique 1.**

- **`AV-apparie-Z12-iso.png` → `AP-Z12-iso.png`** — **c'est la paire à regarder.** AVANT : le
  bloc est **du verre** ; on voit la face arrière de la montagne à travers la face avant, les
  parois sont fantomatiques, les couleurs sont délavées, et le fond beige traverse le coin
  bas-droit. APRÈS : **le bloc est solide.** Le relief se lit, la rampe est saturée, les parois
  sont opaques, **et le liseré blanc de côte est là** — il n'y était pas.
- **`AB2-coin020.png`** — la démonstration de terrain qui a nommé la cause avant qu'une ligne
  soit écrite : poser `uCropCoin = 0,2` à la main rendait le bloc opaque, uniquement par
  l'alpha.
- **`AP-Z12-nadir.png` / `AP-Z12-nadir-sans-mer.png`** — la vue au nadir, que la Tâche K bis
  avait laissée en réserve. **Le grand aplat vert n'y est pas** ; la terre et la mer se
  séparent nettement, le trait de côte court tout le long.
- **`SOCLE-PROD-Z12-iso.png`** — **le socle de production, drapeau baissé, même cadrage.**

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Le socle de production porte, et le crop **ne porte pas** : le **texture shading** (le relief y
est modelé par la lumière, avec ses crêtes et ses ravines — le crop, lui, est une rampe lisse),
**l'analyse de relief**, **la matière des parois** (terracotta contre un gris uni), le
**cartouche « RÉUNION / FRANCE »**, la **rose des vents**, le **socle-plateau**, le **grain
fin**. La Tâche C avait mesuré que les quatre postes portés ne déplacent que **1,01 %** des
pixels ; rien de ce que je livre ne change ce compte. **C'est l'Acte III, et cette tâche ne le
ferme pas.**

⚠️ **Une différence que je n'ai pas creusée et qu'il faut signaler** : à vue isométrique 1
identique, **le bloc n'occupe pas la même fraction du cadre** dans les deux régimes — le socle
de production remplit l'image, le crop est nettement plus petit. `applyIsoView` dérive sa
distance de `controls.maxDistance`, qui n'est pas la même sous le drapeau. **Ce n'est pas de
cette tâche, mais toute comparaison côte à côte en souffrira tant que ce ne sera pas réglé.**

---

## 6. CE QUE JE NE FERME PAS

1. ⛔ **LA MER EST UN PATCHWORK DE PLAQUES DROITES AU NADIR, ET J'AI LOCALISÉ LA SOURCE.**
   Très visible sur `AP-Z12-nadir.png`. **En cachant la nappe de mer, elles DISPARAISSENT**
   (`AP-Z12-nadir-sans-mer.png` : la surface du crop rend un fond marin lisse et un littoral
   propre). ➡️ **Les plaques viennent du matériau `crop-mer`, pas de la surface du crop ni de la
   rampe.** La dégradation par distance n'est pas en cause : `bascule = 5,468` unités, soit
   ~348 km, quand la caméra est à 13 km — la mer est à richesse pleine. **Non diagnostiqué
   au-delà de ça, non touché.** C'est la réserve n° 1 de la Tâche K bis, désormais **localisée**.
2. ⛔ **DES TROUS DANS LA SURFACE DU CROP, côté mer et sur le bord est.** Visibles en beige à
   travers la nappe (`AP-Z12-iso-sans-mer.png`, bas-droite). **Ils étaient là AVANT** — même
   forme sur `AV-apparie-Z12-iso.png`. Ce n'est donc pas une régression, mais c'est le
   deuxième défaut le plus visible après les plaques.
3. ⛔ **LES JUPES DES TUILES DÉBORDENT SOUS LE BLOC.** Franchement visible sur
   `AP-retour-surface.png` : des coulées de terrain pendent sous la paroi, hors du solide.
   Pré-existant, hors périmètre.
4. ⚠️ **L'OCCUPATION DU SOL N'A JAMAIS ÉTÉ VUE SUR LE GLOBE** — voir le §3. Branchée, testée,
   **jamais rendue à l'écran**.
5. ⚠️ **L'INTERVALLE DES COURBES NE SE VOIT PAS AUJOURD'HUI** (`uContourOpacity = 0` dans le
   gabarit) — voir le §2.
6. ⚠️ **UN SEUL LIEU, UN SEUL CADRAGE MESURÉ.** Tout est sur La Réunion, z12, vue iso 1 (plus
   un nadir et un retour de vol). **Un crop continental, un crop sans mer et un crop à cheval
   sur l'antiméridien n'ont pas été vus.** Le terme ajouté à la distance est nul hors du
   rectangle intérieur, donc la frontière et les coins sont inchangés au bit près par
   construction — mais **je ne l'ai pas vu à l'écran ailleurs qu'ici.**
7. ⚠️ **RIEN N'EST MESURÉ SUR LE COÛT.** Le rafraîchissement ajoute une comparaison de dix
   champs par image et, au plus, une écriture d'uniformes par changement. **Je n'ai pas
   chronométré.** Un test garantit qu'il n'y a pas de repose par image (⑨c, ⑨c bis) ; c'est un
   argument, pas une mesure de temps.

---

## 7. UN CODE MORT RETIRÉ, TROUVÉ PAR LA CAMPAGNE

`retirer()` portait un `habillagePose = null` avec un commentaire plausible. **Une mutation qui
l'enlevait SURVIVAIT** : `pose` retombe à faux et `signature` à `null` avec, donc la première
image qui repose passe forcément par `poserTout`, qui réécrit l'instantané avant que quiconque
puisse le lire. **Aucun chemin ne l'atteignait. Retiré plutôt que testé à vide**, comme la
garde `if (nom === 'crop') continue` que le même fichier raconte déjà. **Cinquième code mort de
ce chantier.**

---

## 8. LA CAMPAGNE DE MUTATION — 24 / 24, ET CINQ SURVIVANTES AU PREMIER TOUR

`.banc/mutations-Kter.mjs`, dans un `git worktree` à part (`C:/Dev/wt-kter-mut`), **retiré en
partant** (`git worktree list` le confirme). **15 des 24 visent le BRANCHEMENT.**

**Premier tour : 19 / 24.** Les cinq survivantes étaient toutes des **tests insuffisants**, pas
des lois manquantes :

- ⛔ **une assertion de source qui trouvait la formule DANS UN COMMENTAIRE.** Le pavé de
  `globe.js` qui explique le terme intérieur **cite** `min(max(eq.x, eq.y), 0.0)` : l'assertion
  restait verte alors que le CODE avait été muté en `max(min(...), 0.0)`. **C'est exactement la
  définition d'une assertion qui garde une chaîne au lieu d'un comportement**, et le §0 du plan
  l'annonçait. Les commentaires sont désormais retirés avant de chercher (le patron vient de
  `crop-branche.test.js` ⑧ bis, qui le documentait déjà).
- **le plancher de largeur** (`max(largeurPixel, 1e-12)`) : jamais atteint, parce que je
  n'appelais qu'avec `1e-12`. Avec **0**, la division rend un NaN pour `d = 0`.
- **l'instantané jamais revérifié APRÈS** : ne pas le mettre à jour laissait le test « rien ne
  bouge » vert, et faisait reposer l'habillage **à chaque image pour toujours** une fois le
  premier changement passé.
- **la TABLE de l'occupation du sol jamais changée SEULE** : mon test faisait bouger `sol` et
  `solLut` ensemble. `terrain.js` écrit pourtant que poser la première sans la seconde « ne
  casse rien de VISIBLE — la couche s'allume et ne peint RIEN ».
- **la ligne de code mort** ci-dessus, remplacée par une mutation qui mord.

**Second tour : 24 / 24.**

---

## 9. VÉRIFICATIONS DE CLÔTURE

- `npm test` — **3 770 / 3 770** (3 745 au départ, **+25**).
- `npm run audit:tests` — **204 / 204**, aucun écart.
- `node --check` — vert sur `src/globe.js`, `src/main.js`, `src/monde/branchement-crop.js`,
  `src/monde/crop-sphere.js`, `test/crop-branche.test.js`, `test/crop-sphere.test.js`.
- **CRLF** — `git diff --cached --stat` et `git diff --cached --ignore-cr-at-eol --stat`
  rendent **exactement le même compte** : **773 insertions, 3 suppressions, 6 fichiers**.
  **Aucun faux diff dans mon travail** (le faux diff de 710 lignes est dans le fichier de plan,
  qui n'est pas de moi — voir l'en-tête).
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  `terreUniqueBranchee = false`, socle plat **visible**, `uCropOn = 0`, `uHabOn = 0`,
  `uCoastMaskOn = 0`, `uSolOn = 0`, `uMppFacteur = 0`, `uMerZeroSousEau = 0`,
  `uLandMax = 5 600`, `uOceanDepth = 6 000`, `uContourInterval = 500`,
  `veilleCrop.rafraichissements = 0`. **La production est intouchée**, et aucune erreur JS ni
  de nuanceur en console.
- **Page chargée, drapeau LEVÉ** : la chaîne se pose, `refus` vide, `uCoastMaskOn = 1`,
  `uContourInterval = 250`, **un** rafraîchissement, bloc opaque. Aucune erreur.
  ⚠️ **Les seules erreurs de console sont des `404` de tuiles** (ressources réseau chez le
  fournisseur), **présentes des deux côtés du drapeau** ; aucune erreur JS, aucune erreur de
  compilation de nuanceur (recherche par motif : `uncaught|TypeError|ReferenceError|shader|
  GLSL|program`, zéro résultat).
- **Mutation** — **24 / 24**, worktree retiré en partant.

## 10. CE QUI RESTE SUR LE DISQUE

`.banc/harnais-Kter.js` · `.banc/serveur-vues-Kter.mjs` (port 5598 — le 5597 de la Tâche K
était déjà occupé par un serveur laissé tournant, qui écrivait dans `.banc/vues-K/`) ·
`.banc/bilan-Kter.mjs` · `.banc/mutations-Kter.mjs` · `.banc/vues-Kter/` (17 captures et
7 fichiers de relevés bruts).
