# Rapport R6 — LA PLANÈTE NE DOIT PLUS JAMAIS ÊTRE NUE (règle D15)

**Arbre** `C:\Dev\wt-nue` · **branche** `planete-eclairee` · partie de `d366a40`
**Drapeau** `?planete=eclairee` / `?planete=nue` (`FLAGS.planeteEclairee`, **OFF**)
**Matériel de toutes les mesures** ANGLE (NVIDIA GeForce RTX 3080, D3D11), Chrome
sans tête 1280 × 800, serveur de dev port 5519.

---

## ⚠️ TOUR DE CORRECTION — CE QUI A CHANGÉ DEPUIS `d6a012a`

La relecture a rendu **trois constats critiques**, tous fondés. **La substance
tenait ; c'est la discipline de preuve qui cassait.** Ce qui a été corrigé :

| | ce qui n'allait pas | ce qui a été fait |
|---|---|---|
| **C3** | trois mutations ramenaient la lampe à un no-op strict sans qu'un seul des 4 219 tests rougisse | **section ⑦ du test** : la garde et le corps du fragment sont **extraits et exécutés** ; les trois mutations sont **TUÉES** |
| **I1** | `planeteEclaireeActive()` n'était **jamais exécutée** — quatre mutations survivaient, dont le passage du défaut à ON | test ④ réécrit sur le patron de `crop-branche` ⑦ bis ; **cinq mutations sur cinq TUÉES** |
| **C2** | « 14,053 contre 14,089 » **gravé dans le code livré**, vers un fichier inexistant, obtenu **cross-session** | chiffre **retiré** du code et du rapport, remplacé par une mesure **appariée à trois états** (mode `--triple`) |
| **C1** | six chiffres de chronométrage qui n'existaient que dans un **commentaire** | banc écrit (`scripts/diag-barriere-gpu.mjs`), mesuré, **et il contredit la conclusion publiée** — voir Étape 5 |
| **I3** | `.banc/` gitignoré : le paquet de preuves ne survivait pas au commit | les dix relevés JSON déplacés sous `traces-R6/releves/`, et la phrase de réinstallation inscrite en tête des cinq scripts |
| **④** | le plancher de bruit attribué **au grain** | cause **retirée** : `params.grain` vaut 0 dans l'application vivante, mesuré |

⚡ **ET DEUX CHOSES QUE PERSONNE N'AVAIT VUES, MESURÉES CE TOUR-CI :**
1. **La dispersion attribuée à `gl.finish()` est un artefact d'ORDRE**, pas une
   propriété de la barrière (Étape 5).
2. ⛔ **Ce banc est limité par la SOUMISSION CPU** : à 40 000 m, **multiplier les
   fragments par 35 ne change pas le temps par image**. Le coût de D15 mesuré à
   l'Étape 5 borne donc **ce que l'utilisateur subit sur cette machine à cette
   résolution**, et **pas** le coût GPU du nuanceur.

---

## EN UN PARAGRAPHE

La planète n'est plus nue. **Deux** postes deviennent l'état de repos du monde —
la normale par fragment et le zéro de la mer — et **un troisième est ajouté**,
parce que les deux premiers ne suffisaient pas : la loi de lumière de la planète
ne module qu'à **1,4:1**, donc le relief y était présent et invisible. Mesuré en
apparié, même session, mêmes tuiles, plancher de bruit **0,00** : dans la bande
du défaut d'Adrien, la dispersion de luminance monte de **+64 % à +84 %** et
**25 à 39 % des pixels bougent**. **Le temps par image ne bouge pas** — et ce
tour de correction a mesuré **jusqu'où cette phrase porte** : le banc est limité
par la soumission CPU, donc elle borne ce que l'utilisateur subit ici, **pas le
coût GPU du nuanceur** (Étape 5). ⚠️ **Et le départage de D15 est faux sur trois
postes sur quatre** — c'est démontré ci-dessous.

---

## ⛔ CE QUE JE CONTREDIS, ET POURQUOI

### ① D15 : « le peigne de crêtes se calcule depuis cette même texture de hauteur » — FAUX

Le nuanceur appelle `natPeigne(col, anl.r, anl.g, uTexShade)`, et `anl` vaut
`texture2D(uAnalysis, …)`. `uAnalysis` est **cuite par `src/terrain-analysis.js`**
— un laplacien fractionnaire de Leland Brown sur **une pile de sept flous
jusqu'au rayon 64**, calculée hors du fil principal sur le MNT **du crop**. Ce
n'est pas une dérivée locale : c'est un champ multi-échelle. **Il n'existe pas de
version « par fragment ».** Le rendre global demanderait de cuire l'analyse par
tuile de globe : un chantier, pas une ligne. **NON FAIT, et c'est délibéré.**

### ② D15 : « la rampe de couleur — `uRamp` est déjà global » — VRAI, mais hors sujet

`uRamp` est bien global. Mais `uRampCropOn` ne commande pas `uRamp` : il commande
`uRampCrop` (le LUT 2D du socle) **et indexe son axe Y sur
`natHumiditeY(anl.b, anl.a, …)`** — l'analyse, encore. Même domaine, même
empêchement. **NON FAIT.**

### ③ Le brief, étape 4 : « l'éclairage global » — l'interrupteur nommé est un NO-OP

`uEclairageOn` n'a qu'une action : `partBloc = uEclairageOn > 0.5 ? dedansCrop : 0.0`.
Or `dedansCrop` est **initialisé à `0.0`** et n'est **écrit qu'une seule fois**,
dans `if (uCropOn > 0.5)`. Sans crop, `partBloc` vaut zéro quoi qu'on pose : ni
`albedoCrop`, ni `surfaceFx`, ni `irradianceCrop` ne s'exécutent. **L'allumer
globalement ne changerait pas un pixel.** `test/planete-eclairee.test.js` (⑥)
l'évalue sur le texte du nuanceur au lieu de le croire.

➡️ **L'« éclairage global » de D15 n'est pas cet interrupteur-là.** C'est
`uNormaleFineOn`, qui nourrit `diff` et le terminateur — plus l'ombrage ajouté
ci-dessous.

### ④ Le brief, étape 3 : « `uMerZeroSousEau` peut fermer à lui seul l'essentiel du défaut » — NON. C'est un NO-OP hors du crop.

Le brief demandait de le poser en premier « parce que c'est le gain le plus grand
pour le risque le plus faible ». **Il n'y a aucun gain hors du crop, et c'est
arithmétique.** À `h = 0` les deux branches de `float t` rendent la **même**
valeur :

| branche | expression | valeur à `h = 0` |
|---|---|---|
| terre | `0.35 + 0.65 × clamp((h − uLandBas) / (uLandMax − uLandBas))` | **0,35** |
| mer | `0.35 × (1 − clamp(−h / uOceanDepth))` | **0,35** |

parce que `RAMPE_MONDE.terreBas = 0` (`src/monde/rampe-crop.js:406`). Même `t`,
donc **le même texel de rampe**. Le correctif ne mord que là où `uMerRampeOn` est
allumé — c'est-à-dire **dans le crop**, où la rampe NAUTIQUE fait diverger les
deux branches. C'est d'ailleurs ce que le commentaire de `globe.js:1552` disait
déjà, sans que personne en tire la conséquence : *« et la mer d'à côté, à
h = −1 m, prend la rampe NAUTIQUE (`uMerRampeOn` = 1) »*.

⚠️ **Je l'ai quand même rendu global**, parce qu'il ne coûte rien, qu'il est
correct, et que le jour où la rampe nautique deviendra mondiale il sera déjà en
place. **Mais il n'a fermé aucune part du défaut, et le prétendre serait faux.**
`test/planete-eclairee.test.js` (⑥) verrouille cette démonstration.

### ⑤ Le huitième interrupteur (`uEstompageOn`) — mesuré, il ne claque pas

Le coordinateur m'a transmis, vérifié par relecture indépendante, que
`uEstompage` est continu mais que **sa porte `uEstompageOn` est binaire**, et m'a
demandé de mesurer avant de traiter. **Mesuré : elle ne claque pas.**

> **4 descentes indépendantes × 16 paliers = 64 relevés, de 2 000 000 m à
> 6 000 m : `uEstompageOn` vaut 1 à TOUS**, pendant que `uEstompage` court de
> 0 à 1 (`avant.json`, `avant-bis.json`, `apres.json`, `apparie.json`).

Et la lecture du nuanceur dit pourquoi : `estompeTuile = uEstompageOn > 0.5 ? … `
vit **à l'intérieur de `if (uCropOn > 0.5)`** (`globe.js:1522`, dans le bloc
ouvert à `1421`). Sa porte est donc **imbriquée dans celle du crop** : elle ne
peut pas produire de saut que la naissance du crop ne produise déjà. Sur les
calottes et le ciel, où elle est lue hors de cette garde, sa valeur éteinte
(`0.0`) est **exactement** ce que la veille veut au-dessus du seuil (« la planète
entière »).

➡️ **Il ne relève pas du même geste. Non traité, et c'est motivé.**

### ⑥ Le plancher de bruit de 8,97 transmis par R4 — le RÉSULTAT tient, la CAUSE est retirée

R4 a mesuré 8,97 d'écart moyen par pixel entre deux captures d'un état
identique, et en a conclu que tout écart sous 9 est du bruit. **Mon plancher est
0,00** sur 14 paliers sur 16 (`.banc/R6/apparie.json`, `maroc.json`, copiés dans
`traces-R6/releves/`) : les captures sont bit-à-bit identiques. **« Tout écart
sous 9 est du bruit » n'est donc pas une règle universelle** — et ça, ça tient.

⛔ **MAIS J'AVAIS ÉCRIT QUE C'ÉTAIT LE PLANCHER DU GRAIN, ET C'EST FAUX.**
`main.js` porte `grain: 0, // off by default` : `NoiseEffect.blendMode.opacity`
vaut zéro et **le grain de film n'entre dans aucune capture** tant que personne
ne choisit le look « Doux ». Vérifié dans l'application vivante — pas sur la
source — par `scripts/diag-plancher-bruit.mjs` (trace
`traces-R6/plancher-bruit.json`) :

| altitude | `params.grain` | nuages | mer | plancher **anims ON** | plancher **anims OFF** |
|---:|---:|:--:|:--:|---:|---:|
| 1 999 996 m | **0** | invisibles | invisible | 0,015 | 0,000 |
| 119 794 m | **0** | invisibles | invisible | **0,000** | 0,000 |
| 39 854 m | **0** | invisibles | invisible | **0,000** | 0,000 |
| 4 410 m (crop posé) | **0** | invisibles | invisible | **0,000** | 0,000 |

➡️ **`params.animations = false` était une précaution sans effet sur ces scènes**,
pas ce qui a produit le 0,00 : le plancher est déjà nul animations allumées.
⚠️ **Et je ne peux pas nommer la cause du 8,97 de R4 ni du ~12 relevé par la
relecture : je ne reproduis AUCUN plancher non nul sur mon banc.** Ce que je
peux borner : ce n'est pas le grain par défaut, et rien d'animé n'est dans mes
cadres — les consommateurs de `dtAmb` (mer de Gerstner, nuages, faune) y sont
tous invisibles.

⛔ **LE CONSEIL « GELEZ LE GRAIN ET VOUS RÉCUPÉREZ VOTRE 43 % » EST RETIRÉ.** Il
reposait sur une cause que je n'avais pas vérifiée, et il a coûté un chiffre à
un tiers.

---

## ÉTAPE 1 — LA MESURE AVANT, ET L'ALTITUDE EXACTE OÙ LE STYLE S'ALLUME

Sonde : `scripts/sonde-descente-nue.mjs` — Chrome sans tête, descente pilotée
palier par palier, relève par palier l'altitude de cadrage, les sept
interrupteurs, et un condensé de **l'image composée** (moyenne, écart-type,
entropie, part du pixel le plus fréquent).

⚠️ **Deux pièges franchis, et je les note parce qu'ils feraient perdre une heure
au suivant.**
1. **Le sas d'accueil couvre l'écran et fige la caméra.** Sans un `Échap`, la
   sonde a relevé **19 paliers à 18 321 m** — c'est-à-dire un seul.
2. **`renderer.domElement` dessiné dans un canvas 2D rend du NOIR** hors de
   l'image (moyenne = 0 aux 19 paliers). Le condensé se calcule donc sur la
   **capture CDP** renvoyée dans la page.

**Relevé, `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0`**
(`.banc/R6/avant.json`) :

| altitude | crop | les sept | écart-type | entropie |
|---:|:--:|:--|---:|---:|
| 1 999 998 m | non | `.......` | 28,35 | 6,80 |
| 119 949 m | non | `.......` | 22,08 | 6,44 |
| 79 967 m | non | `.......` | 18,21 | 6,20 |
| 39 984 m | non | `.......` | 14,09 | 5,81 |
| **32 992 m** | **non** | `.......` | **14,21** | **5,82** |
| **31 997 m** | **OUI** | `1111111` | **29,01** | **6,39** |
| 6 001 m | oui | `1111111` | 26,44 | 6,66 |

➡️ **L'altitude exacte où le style s'allume est le seuil de naissance du crop, et
rien d'autre** : les sept passent de 0 à 1 **ensemble**, entre 32 992 m et
31 997 m, ce qui encadre `SEUIL_NAISSANCE_M = 32 274,3 m`. La dispersion de
luminance **double d'un palier à l'autre** (14,21 → 29,01, ×2,04).

**Et ça correspond aux images d'Adrien** : `t01` (orbite) est correct parce que la
bathymétrie porte l'image ; `t11` à `t23` sont plein cadre sur de la TERRE, où la
rampe seule ne module plus rien ; `t30` (le crop) est correct.

---

## ÉTAPE 2 — TEST ROUGE

`test/planete-eclairee.test.js`, **29 tests**, sept familles :
① la loi sous node · ② **le GLSL livré TRADUIT ET EXÉCUTÉ** contre le module
(72 azimuts × 7 élévations) · ③ l'unicité de l'écriture · ④ le branchement,
**drapeau ÉVALUÉ** · ⑤ l'aller-retour bit à bit · ⑥ **le départage de D15, évalué
sur le nuanceur** · ⑦ ⚡ **la garde et le corps du fragment, EXTRAITS ET
EXÉCUTÉS** — c'est la section née du constat C3, voir « campagne de mutation ».

⚠️ **Le traducteur GLSL→JS a lui-même eu un défaut, et je le note parce qu'il
était SILENCIEUX** : une expression régulière `[^)]*` s'arrête à la **première**
parenthèse fermante et rendait `NaN` aux 504 points du balayage. Il découpe
désormais aux parenthèses **équilibrées** — et la section ⑦ réemploie ce même
découpage équilibré pour extraire la garde du fragment.

Inscrit dans la liste explicite de `package.json`. **`npm run audit:tests` :
217 listés · 217 sur disque · aucun écart.**

---

## ÉTAPE 3 — LE CORRECTIF DU ZÉRO

Fait (`uMerZeroSousEau` = état de repos du monde). **Il ne ferme aucune part du
défaut hors du crop** — démonstration au point ④ ci-dessus, verrouillée par test.

---

## ÉTAPE 4 — L'ÉCLAIRAGE ET LE RELIEF, GLOBAUX

### Ce qui est fait

| poste | ce que c'est | pourquoi c'est globalisable |
|---|---|---|
| `uNormaleFineOn` | la normale par fragment | ne lit que `uTex` (256², **propre à la tuile**, déjà échantillonnée par la couleur), `uUvParMonde`, `uTilePx` et `uUnitesParMetre` — l'échelle verticale **du globe**. Rien de cuit sur le crop. |
| `uMerZeroSousEau` | `h <= 0` au lieu de `h < 0` | comparaison pure, aucune donnée. |
| **`uReliefMondeGain`** *(nouveau)* | l'ombrage de relief | ne lit que la normale ci-dessus et le repère local, déjà calculés. |

### ⚡ Pourquoi un troisième poste a été nécessaire — mesuré EN APPARIÉ

⛔ **LE CHIFFRE DU PREMIER TOUR EST RETIRÉ — c'est le constat C2.** J'avais écrit
« écart-type 14,053 contre 14,089 à 40 000 m, soit +0,26 % », en renvoyant à un
`.banc/R6/apres-normale-seule.json` **qui n'existe pas**, et — pire — en
comparant **deux sessions différentes**, exactement ce que l'Étape 7 ci-dessous
déclare ne rien prouver. **La conclusion était bonne pour de mauvaises raisons.**

**La voici mesurée dans une SEULE session**, sur le même jeu de tuiles, grain
gelé, avec le plancher de bruit du palier — `scripts/sonde-descente-nue.mjs
--triple` bascule les trois états (nue → normale fine SEULE → D15 entier) sans
recharger. Traces : `traces-R6/triple-defaut.json`, `triple-maroc.json`,
`triple-maroc-bis.json`.

| lieu | altitude | plancher | nue | **normale fine SEULE** | **D15 entier** |
|---|---:|---:|---:|---:|---:|
| défaut | 119 997 m | 0,298 | 22,653 | 22,554 (**−0,4 %**) | 22,760 (+0,5 %) |
| défaut | 79 934 m | 1,259 | 18,187 | 18,516 (**+1,8 %**) | 21,526 (+18,4 %) |
| défaut | 39 902 m | **0,000** | 15,971 | 15,700 (**−1,7 %**) | 21,795 (**+36,5 %**) |
| Maroc | 59 891 m | **0,000** | 18,053 | 19,071 (**+5,6 %**) | 32,651 (**+80,9 %**) |
| Maroc | 39 927 m | 0,292 | 17,590 | 18,234 (**+3,7 %**) | 32,205 (**+83,1 %**) |
| Maroc *(2ᵉ session)* | 39 854 m | **0,000** | 17,708 | 18,241 (**+3,0 %**) | 32,451 (**+83,3 %**) |

➡️ **La normale fine seule pèse de −2 % à +6 % là où D15 entier pèse +18 % à
+83 % : un rapport de dix à vingt.** Le relief est bien là — les vallées se
dessinent sur `vues-apres/alt-00039985.png` — mais **il ne se LIT pas**. La lampe
n'est pas une réinvention : sans elle, D15 ne referme pas le défaut d'Adrien.

⚠️ **Une réserve honnête sur ce tableau** : le palier 119 997 m au Maroc rend
+8,5 % et +8,9 % sur les deux sessions, mais son plancher de bruit y vaut 3,3 et
5,5 (le quadtree charge encore, 883 à 906 tuiles). **Je ne le publie pas comme
acquis** ; les quatre lignes à plancher ≤ 0,3 sont celles qui portent la
conclusion.

⚡ **Reproduction indépendante** : mes trois lignes du Maroc retombent au
centième sur celles de la relecture (19,071 contre 19,066 ; 18,234 ; 32,651 ;
32,205 ; 29,832 au palier haut).

**La cause, elle, est inchangée et écrite dans le dépôt depuis P3** : hors du
crop, la seule lumière est

```glsl
float diff = max(dot(nMonde, uSunDir), 0.0);
vec3 colPlanete = col * (0.74 + 0.30 * diff);
```

— **un rapport de 1,4:1 là où un vrai Lambert va de 0 à 1** — et `uSunDir` n'est
pas le soleil de la scène : `main.js` le repose **à chaque image** sur la position
de la caméra tournée de 42°. **Au nadir, il éclaire de face** : l'angle qui écrase
le relief au lieu de le révéler.

### La loi ajoutée : une lampe de carte, et son neutre est exact

`src/monde/planete-eclairee.js` — module **pur**, une seule écriture, son propre
texte GLSL injecté :

```glsl
vec3 lampeReliefMonde(vec3 est, vec3 nord, vec3 haut, float azRad, float elRad);
float ombrageReliefMonde(vec3 n, vec3 haut, vec3 L, float gain) {
  float nduPlat = clamp(dot(haut, L), 0.0, 1.0);
  float ndu     = clamp(dot(n,    L), 0.0, 1.0);
  return max(0.0, 1.0 + gain * (ndu - nduPlat));
}
```

Azimut **315°** (nord-ouest), élévation **45°**, gain **0,9** — **dans le repère
LOCAL de chaque fragment**, seul choix qui ait un sens sur une sphère : une
direction fixe en repère monde laisserait un hémisphère entier éclairé
par-dessous.

⚡ **La forme `1 + gain × (n·L − haut·L)` n'est pas cosmétique.** Là où la normale
fine vaut la sphère — partout où la tuile ne porte pas de relief, **et partout où
l'empreinte du pixel a mangé le détail** — elle rend **1**. La planète ne change
donc ni de luminosité moyenne ni de teinte : **seule sa modulation apparaît**, et
la couture avec le bloc reste invisible.

⚠️ **Et « exactement 1 » est vrai de la LOI, pas du nuanceur — m2 de la relecture,
et la borne est publiée ici.** Sous node, `ombrageRelief(x, x, gain)` rend 1 au
bit près, et le test ① l'exige. Dans le fragment, la normale fine sur sol plat
vaut `normaleParGradientSol(0, 0, …)` = `haut / length(haut)`
(`eclairage-crop.js:670-674`), donc `n ≈ haut` à ~1 ulp et le facteur s'écarte de
1 d'environ **1e-7 × gain**. Invisible sur huit bits par canal — mais ce n'est
pas « au bit près ».
➡️ **Ce qui rend le drapeau baissé vérifiable au bit près, c'est la garde
`uReliefMondeGain > 0.0`, pas la loi** : à gain nul le bloc n'est pas exécuté et
`ombreRelief` garde sa valeur de repos, `1.0`. C'est cette garde-là que la
section ⑦ du test **exécute** désormais.

### Le départage tenu

`uCoastMask`, `uSol`, `uAnalysis`, `uRampCrop` **restent éteints hors du crop**.
`test/planete-eclairee.test.js` (④) construit un globe sous drapeau et exige
`uCropOn = uHabOn = uAnalysisOn = uRampCropOn = uEclairageOn = 0`.

---

## ÉTAPE 5 — ⚡ LE COÛT

### La méthode, et ce qu'elle a corrigé chez elle-même

`scripts/banc-relief-monde.mjs` — rendu piloté, ordre tournant (ABBA),
différences appariées, chauffe de 40 images jetée. **Deux défauts de l'instrument
ont été trouvés et corrigés avant d'annoncer le moindre chiffre :**

1. ⛔ **Tuer `requestAnimationFrame` tue la chaîne de rendu de l'application**, et
   `tick()` n'en est pas le seul appelant : le dernier inscrit écrasait `tick`.
   Les trois altitudes ont alors été mesurées **sur le quadtree de la première** —
   `151` tuiles, `18` appels, `134 373` triangles **aux trois lignes**, y compris
   à 2 000 000 m. La boucle est désormais **capturée dans une file**, pas tuée.
   *(Ce défaut-là est réel, et `.banc/R6/diag.mjs` le montre.)*
2. ⛔ **`renderer.info` se remet à zéro à chaque `renderer.render()`**, et
   `composer.render()` en enchaîne plusieurs : lu tel quel, il annonçait
   **`appels = 1`** — la dernière passe plein écran, et rien d'autre.

### ⛔ LE TROISIÈME « DÉFAUT » N'EN ÉTAIT PAS UN — je retire ma correction de méthode

**Ce que j'avais publié** : que `gl.finish()` ne barre pas la route sous
ANGLE/D3D11 (2,197 / 3,490 / 0,505 ms contre 0,657 / 0,640 / 0,700 pour
`readPixels(1×1)`), et **qu'il fallait requalifier les coûts du chantier mesurés
à `finish`**. ⚠️ **Ces six chiffres n'existaient que dans un COMMENTAIRE** d'un
script qui ne chronomètre rien — c'est le constat C1, et il est fondé.

**Le banc qui les mesure existe maintenant** : `scripts/diag-barriere-gpu.mjs`.
Il compare **trois** barrières — `finish`, `readPixels(1×1)` et **aucune** — sur
le même bloc, en triplets d'**ordre tournant**, à trois charges, sur deux
altitudes et **deux sessions**. Traces : `traces-R6/barriere-gpu.json` et
`barriere-gpu-bis.json` (plus les journaux `.txt`).

| ce qu'il mesure | ce qu'il trouve |
|---|---|
| **part du temps réel capturée** (somme des blocs ÷ temps de pendule du train, clos par une lecture franche) | **98 à 99 % SANS AUCUNE BARRIÈRE.** Dans une boucle serrée de `composer.render()`, la contre-pression du pilote synchronise seule : **il n'y a pas de travail caché à révéler.** |
| **les trois barrières** | même temps à quelques pour cent près, aux deux altitudes, aux trois charges |
| **la dispersion de `finish`** | **un artefact d'ORDRE.** Sur les deux sessions, les **cinq** blocs aberrants sont tombés sur le **PREMIER train du triplet**, quelle que soit la barrière (`aucune` mesurée en tête en a produit deux). `finish` mesuré en troisième est la série **la plus stable du relevé** : max/min = **1,02**. |

➡️ **JE RETIRE « `gl.finish()` NE BARRE PAS LA ROUTE ».** Ce que je peux dire, et
c'est borné à ce que j'ai mesuré : *sur ce banc* (Chrome sans tête 1280 × 800,
ANGLE/D3D11, RTX 3080, boucle serrée de `composer.render(0)` sur 52 à 583 appels
de dessin), **les trois barrières sont indiscernables, et le premier train mesuré
paie un surcoût quelle que soit la barrière.** Je n'universalise pas : un autre
chemin de rendu peut se comporter autrement.
⛔ **Et par conséquent : AUCUN coût du chantier n'est à requalifier au motif
qu'il a été pris à `gl.finish()`.** Ma phrase précédente était fausse ; elle a
été répercutée, et je la retire nommément.

`readPixels(1×1)` **reste** le point de synchronisation du banc : il est stable
(±0,03 ms) et, quand il diffère, il **surestime** — une borne haute de coût reste
une borne haute.

### ⛔ ⚡ ET VOICI CE QUE PERSONNE N'AVAIT MESURÉ : CE BANC EST LIMITÉ PAR LA SOUMISSION CPU

Le coordinateur a transmis l'hypothèse ; elle se tranche, elle ne se suppose pas.
`scripts/diag-charge-fragment.mjs` garde **exactement** le protocole du banc et
fait varier **le nombre de FRAGMENTS à nombre d'APPELS DE DESSIN CONSTANT**, en
redimensionnant le rendu — avec pour témoin `gl.drawingBufferWidth/Height` relu
**après** le redimensionnement. Trace : `traces-R6/charge-fragment.json`.

| altitude | appels | 0,26 Mpx | 1,02 Mpx | 4,1 Mpx | 9,22 Mpx |
|---:|---:|---:|---:|---:|---:|
| **39 998 m** | 583 | 5,655 ms | 5,575 | 5,405 | **5,425** |
| **2 000 000 m** | 52 | 0,650 ms | 0,650 | 0,818 | **1,515** |

➡️ **À 40 000 m, multiplier les fragments par 35 ne change RIEN au temps par
image** (×0,96). À l'orbite, il faut passer **au-delà de ~2 mégapixels** pour que
le remplissage se voie ; à 1 280 × 800, **les deux altitudes sont limitées par la
soumission.** *(Le ×2,33 de l'orbite à 9,2 Mpx est le **témoin positif** :
l'instrument SAIT voir des fragments quand ils dominent — le plateau plat de
40 000 m n'est donc pas un `setSize` sans effet.)*

⚠️ **CE QUE ÇA FAIT AU RÉSULTAT DE CETTE ÉTAPE, ET IL FAUT LE LIRE COMME ÇA :**
« le coût de D15 est indiscernable de zéro » **borne ce que l'utilisateur subit**
sur cette machine à cette résolution — c'est vrai, c'est mesuré, et c'est la
grandeur qui décide de la fluidité. **Mais ça ne borne PAS le coût GPU du
nuanceur** : un ajout purement fragmentaire est **invisible par construction** sur
un banc limité par la soumission. ➡️ **La réserve n° 5 (une seule machine) passe
d'une intuition à un mécanisme mesuré** : sur une machine limitée par le
remplissage — le cas que `palier-machine.js` couvre — ou en très haute
résolution, le même ajout **peut** se voir. Ce n'est pas mesuré, et ça reste à
mesurer.

### ⚡ Le témoin — l'instrument voit-il quelque chose ?

À chaque palier, le **même protocole apparié** est rejoué sur une différence
**connue** : un bloc qui rend **une image de plus** que l'autre. Sa réponse
attendue est le coût d'une image entière.

| altitude | image mesurée | témoin (1 image de plus) |
|---:|---:|---:|
| 2 000 000 m | 0,601 ms | **0,568 ± 0,034** |
| 118 655 m | 1,019 ms | **1,080 ± 0,065** |
| 40 002 m | 1,345 ms | **1,255 ± 0,045** |
| 6 020 m | 0,610 ms | **0,629 ± 0,024** |

➡️ **L'instrument retrouve le coût d'une image entière aux quatre altitudes.**

### Le résultat

**D15 en entier** (normale fine + ombrage), 40 paires × 60 images, deux sessions
indépendantes (`.banc/R6/chrono.json`, `chrono-bis.json`) :

| altitude | crop | tuiles | appels | image | **Δ apparié** |
|---:|:--:|---:|---:|---:|---:|
| 2 000 000 m | non | 225 | 58 | 0,60–0,65 ms | **+0,013 / +0,016 ± 0,015–0,061 ms** |
| ~119 000 m | non | 436–444 | 97 | 1,02–1,05 ms | **−0,020 / +0,013 ± 0,026–0,056 ms** |
| 40 002 m | non | 646–654 | 125 | 1,35 ms | **+0,009 / +0,017 ± 0,050–0,067 ms** |

**Décomposé**, 40 paires × 60 images :

| poste coupé | 2 000 000 m | ~119 000 m | 40 000 m | 6 000 m |
|---|---:|---:|---:|---:|
| **la normale fine seule** (`chrono-normale.json`) | −0,000 ± 0,011 | +0,010 ± 0,016 | −0,003 ± 0,010 | — |
| **l'ombrage de relief seul** (`chrono-gain.json`) | +0,016 ± 0,031 | −0,002 ± 0,028 | −0,007 ± 0,025 | +0,003 ± 0,018 |

➡️ **Le coût de D15 est indiscernable de zéro**, avec un banc dont l'intervalle
apparié descend à **±0,010 ms/image** et qui résout sans peine une image entière
(0,53 à 1,26 ms). **Borne haute honnête : moins de 0,07 ms par image**, soit
**moins de 5 %** d'une image à 40 000 m.

⛔ ⚠️ **ET VOICI EXACTEMENT CE QUE CETTE PHRASE VEUT DIRE — corrigé ce tour-ci.**
Ce banc est **limité par la soumission CPU** (mesuré ci-dessus : ×35 de fragments
à 40 000 m ⇒ ×0,96 de temps par image). Donc :
- ✅ **ce qui est prouvé** : allumer D15 **ne change pas le temps par image** que
  cette application produit sur cette machine à 1 280 × 800. C'est la grandeur
  qui décide de la fluidité, et c'est celle qu'Adrien subit.
- ⛔ **ce qui n'est PAS prouvé** : que le nuanceur ajouté soit gratuit **sur le
  GPU**. Un ajout purement fragmentaire est **invisible par construction** sur un
  banc limité par la soumission. Le témoin « une image de plus » ne le sauve pas :
  une image de plus ajoute aussi une soumission de plus.
➡️ **La borne vaut pour cette machine et cette résolution. Voir la réserve 5.**

⚠️ **UN CHIFFRE À NE PAS ME FAIRE DIRE.** À **6 020 m**, couper les deux postes
ensemble rend **+0,082 ± 0,011 ms/image**. **Ce n'est PAS un coût de D15** : à
cette altitude le crop est posé et `uNormaleFineOn` valait **déjà 1** depuis la
Tâche P9. C'est le prix que le bloc payait avant moi. Ce que D15 ajoute là est
l'ombrage seul : **+0,003 ± 0,018 ms**.

### Pourquoi c'est si peu

Les quatre lectures supplémentaires tapent une texture **déjà en cache** (le
fragment décode `uTex` cinq fois pour `decodeMetersAA`), et le nuanceur du globe
est déjà lourd — rampe, courbes, graticule.

⚡ **Et la vraie raison est celle-là, et elle est maintenant MESURÉE, pas
supposée : le globe n'est pas limité par le remplissage à ces cadrages.** Le
premier tour l'écrivait en se fondant sur le nombre d'appels de dessin (58 à
125, pas 283) ; `scripts/diag-charge-fragment.mjs` le montre directement — à
40 000 m, **passer de 0,26 à 9,22 mégapixels ne coûte rien**. ⛔ **Ce qui est une
explication du résultat EST AUSSI SA LIMITE** : le remplissage est justement ce
que ce banc ne pèse pas.

⚠️ **Le « 283 tuiles en orbite » du brief ne décrit pas ce qui est dessiné.**
Mesuré au compteur de three à 2 000 000 m : **225 tuiles en cache, 58 appels de
dessin, 175 429 triangles**.

---

## ÉTAPE 6 — L'ATTÉNUATION PAR LA DISTANCE

**Le coût n'étant pas réel, l'étape n'était pas déclenchée.** Mais l'atténuation
**existe déjà, elle est portante, et je l'ai mesurée** — ce n'est pas une
promesse.

C'est `pasEmpreinte` (Tâches K et P10) :
`pas = max(1 / uTilePx, vProfCam × uMppFacteur / metresParUv)`. Le pas du gradient
ne descend **jamais sous le pixel d'écran** : à distance, le relief sous-pixel
n'est pas calculé, il est moyenné.

**Mesure appariée, même session, mêmes tuiles** (`.banc/R6/apparie.json`) — gain
d'écart-type de luminance apporté par D15 :

| altitude | crop | nue | éclairée | **gain** | écart/pixel | pixels bougés |
|---:|:--:|---:|---:|---:|---:|---:|
| 1 999 993 m | non | 30,35 | 30,41 | **+0,2 %** | 1,23 | 1,4 % |
| 999 817 m | non | 33,76 | 33,84 | **+0,2 %** | 1,17 | 1,8 % |
| 499 817 m | non | 26,63 | 26,57 | **−0,2 %** | 2,05 | 4,0 % |
| 249 817 m | non | 21,34 | 21,07 | **−1,3 %** | 1,99 | 3,4 % |
| 119 810 m | non | 25,08 | 24,83 | **−1,0 %** | 3,19 | 7,0 % |
| 79 878 m | non | 23,02 | 23,34 | **+1,4 %** | 4,61 | 10,1 % |
| 59 909 m | non | 19,78 | 21,84 | **+10,4 %** | 5,77 | 14,1 % |
| 47 927 m | non | 17,37 | 21,92 | **+26,2 %** | 7,42 | 20,7 % |
| 39 939 m | non | 18,71 | 23,41 | **+25,1 %** | 7,11 | 22,9 % |
| 35 964 m | non | 18,54 | 23,82 | **+28,5 %** | 6,94 | 22,2 % |
| 32 970 m | non | 18,57 | 24,25 | **+30,6 %** | 7,73 | 25,6 % |
| 31 989 m | **oui** | 31,36 | 31,48 | **+0,4 %** | 0,59 | 1,5 % |
| 6 012 m | oui | 25,16 | 26,34 | **+4,7 %** | 4,60 | 13,9 % |

*(plancher de bruit par palier : **0,00** à 14 paliers sur 16 ; 0,23 et 0,83 aux
deux autres — grain gelé.)*

➡️ **L'effet est nul en orbite et croît monotonement en descendant.** C'est
exactement l'atténuation par distance que D15 réclame, et elle n'a demandé
**aucune ligne** : elle est portée par le pas d'empreinte. **Vérifié à l'œil** :
`.banc/R6/vues-avant/alt-01999998.png` et `vues-apres/alt-01999998.png` sont
quasi superposables — la vue orbitale d'Adrien (`t01`, qu'il juge correcte) n'est
pas touchée.

---

## ÉTAPE 7 — À L'ÉCRAN, COMPARÉ AUX IMAGES D'ADRIEN

⛔ **Une comparaison entre DEUX SESSIONS ne prouve rien, et je l'ai mesuré.** Deux
descentes du même dépôt (`avant.json` contre `avant-bis.json`) diffèrent de
**15,6 % au pire** sur l'écart-type : le quadtree ne charge pas les mêmes tuiles.
Toutes les comparaisons ci-dessus et ci-dessous sont donc **appariées dans une
seule session**, en basculant les uniformes, sur **le même jeu de tuiles**, grain
gelé.

**Descente rejouée au lieu d'Adrien** (30,88 N / −5,59 E, le lat/lon que ses
étiquettes REFINING affichent en `t20`), `.banc/R6/maroc.json`, vues dans
`.banc/R6/vues-maroc/` (deux fichiers par palier, `-nue` et `-eclairee`) :

| altitude | correspond à | nue | éclairée | **gain** | pixels bougés |
|---:|---|---:|---:|---:|---:|
| 399 997 m | avant `t11` | 14,61 | 16,66 | **+14,0 %** | 16,3 % |
| 199 891 m | ~ `t11` | 16,59 | 27,27 | **+64,4 %** | 24,8 % |
| 119 913 m | ~ `t15` | 17,85 | 30,18 | **+69,1 %** | 31,7 % |
| 79 927 m | ~ `t18` | 17,73 | 30,35 | **+71,2 %** | 36,6 % |
| 59 945 m | ~ `t20` | 18,05 | 32,62 | **+80,8 %** | 39,0 % |
| 47 956 m | ~ `t22` | 18,09 | 32,74 | **+81,0 %** | 36,8 % |
| 39 964 m | ~ `t23` | 17,59 | 32,22 | **+83,1 %** | 35,0 % |
| 32 962 m | juste avant le crop | 16,75 | 30,88 | **+84,3 %** | 32,0 % |
| 30 987 m | **le crop** (`t30`) | 23,48 | 23,97 | +2,1 % | 3,3 % |

*(plancher : 0,00 à huit paliers sur neuf ; 2,94 au premier.)*

**À l'œil, ce que ces chiffres décrivent** — `vues-maroc/alt-00119913-*.png` et
`alt-00039964-*.png` : la version nue est un aplat crémeux traversé de taches
sombres floues ; la version éclairée est **une carte en relief**, chaque vallée,
chaque crête et chaque combe modelée. **C'est le passage de `t20` à `t30` obtenu
SANS attendre le crop.**

### ⚡ Un gain que mon brief ne m'annonçait pas : le claquement d'entrée

Le coordinateur me demandait de le mesurer. **Mesuré, en apparié**
(`apparie.json`) — le bond de dispersion à la naissance du crop, d'un palier à
l'autre :

| | 32 970 m → 31 989 m |
|---|---|
| planète **nue** | 18,57 → 31,36 = **×1,689** (+68,9 %) |
| planète **éclairée** | 24,25 → 31,48 = **×1,298** (+29,8 %) |

➡️ **Le saut de style à la naissance du crop est réduit de 57 %.** La moitié
*entrante* du claquement que R4 traite disparaît d'elle-même.

---

## ÉTAPE 8 — CLÔTURE, DRAPEAU LEVÉ ET BAISSÉ

**Drapeau baissé, la production est rigoureusement inchangée**, et ça se vérifie
de trois façons :

1. **Par construction.** Les trois uniformes naissent à `0` (`styleMonde(false)`),
   et le seul ajout au nuanceur est un facteur `* ombreRelief` déclaré `1.0`,
   écrit sous **deux** gardes imbriquées. `x * 1.0 == x` en IEEE 754 : la
   multiplication est **exacte**, pas approchée.
2. **Par test.** ⑤ de `test/planete-eclairee.test.js` : globe par défaut, puis
   **une vie de crop entière** (`retirerHabillage` + `retirerRampe`) qui doit
   rendre l'état d'avant à l'identique. Et `crop-eclairage` ⑤c exige que la ligne
   de planète porte ses deux constantes historiques ET ce facteur-là.
3. **Au navigateur.** Descente complète sous `?planete=nue`
   (`.banc/R6/drapeau-baisse.json`, 16 paliers de 2 000 000 m à 6 000 m) :
   - `uReliefMondeGain` vaut **0 aux 16 paliers**, sans exception ;
   - aux **11 paliers sans crop**, **les sept valent 0** — c'est l'aplat d'avant,
     rendu à l'identique ;
   - aux **5 paliers avec crop**, **les sept valent 1** — c'est la chaîne du crop
     qui les allume, exactement comme avant D15.

**Drapeau levé** : `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee`.
⚠️ **Le drapeau exige `terre unique`**, et c'est une mesure qui l'exige : sans
`poserLoiMonde`, `uMppFacteur` vaut 0 et le pas du gradient retombe **au texel** —
c'est-à-dire le scintillement que la Tâche K a fermé.

---

## TESTS

**4 224 tests · 0 échec · audit 217 = 217** (livré : 4 219 / 217 · base : 4 195 /
216). **Cinq tests ajoutés au tour de correction**, tous dans
`test/planete-eclairee.test.js` : quatre en section ⑦ (C3) et un en ⑥ (m1). Le
test ④ a été **réécrit**, pas ajouté.

### ⚡ LA CAMPAGNE DE MUTATION — celle qui manquait

⛔ **Elle était non négociable et elle n'avait pas été menée.** Voici la mienne,
rejouée après correctif. **Une mutation est « TUÉE » quand au moins un test
rougit** ; le harnais applique un remplacement littéral, lance
`node --test test/planete-eclairee.test.js`, puis restaure.

**C3 — le gain de la lampe (trois survivantes chez le relecteur, trois TUÉES ici) :**

| mutation | avant | après |
|---|---|---|
| `RELIEF_MONDE.gain: 0.9 → 0` | **SURVIT** (4 219 verts) | **TUÉE** — 2 rouges |
| `if (uReliefMondeGain > 0.0)` → `> 1000.0` | **SURVIT** (4 219 verts) | **TUÉE** — 3 rouges |
| `ombrageReliefMonde(…, uReliefMondeGain)` → `(…, 0.0)` | **SURVIT** | **TUÉE** — 3 rouges |
| *(témoin ajouté)* la loi JS → `return 1` | — | **TUÉE** — 3 rouges |
| *(témoin)* le GLSL de l'ombrage → `return 1.0;` | — | **TUÉE** — 4 rouges |
| *(témoin)* l'uniforme forcé à `RELIEF_MONDE_NUL` | — | **TUÉE** — 3 rouges |
| *(témoin)* `float ombreRelief = 1.0;` → `0.5` | — | **TUÉE** — 2 rouges |
| `> 0.0` → `>= 0.0` | SURVIT | **SURVIT — et c'est assumé** ⚠️ |

⚠️ **La seule survivante est inoffensive, et je dis pourquoi plutôt que de la
cacher** : à gain nul la loi rend `max(0, 1 + 0 × …)` = **1 exactement** (test ①),
donc `colPlanete × 1.0` est le dépôt au bit près. Le seul effet de `>= 0.0` est
de faire calculer une lampe inutile par fragment, drapeau baissé — **un coût, pas
une régression d'image**. Je ne l'ai pas fermée par une assertion de texte, parce
qu'une assertion de texte ne prouve rien.

**I1 — le branchement du drapeau (quatre survivantes chez le relecteur, cinq TUÉES ici) :**

| mutation | avant | après |
|---|---|---|
| `planeteEclairee: false → true` *(le défaut de production)* | **SURVIT** | **TUÉE** |
| échappatoire `?planete=nue` supprimée | **SURVIT** | **TUÉE** |
| branche `?planete=eclairee` supprimée | **SURVIT** | **TUÉE** |
| nom du paramètre d'adresse cassé (`'planete' → 'planetee'`) | **SURVIT** | **TUÉE** |
| garde `if (!terreUniqueActive()) return false` supprimée | *(non essayée)* | **TUÉE** |

⚡ **Ce qui a fermé C3, et pourquoi c'est du COMPORTEMENT et pas du texte.** La
section ⑦ **extrait du fragment livré** sa valeur de repos (`float ombreRelief =
1.0;`), sa **garde** et son **corps**, les traduit et les **exécute** avec les
uniformes d'un `new Globe({ planeteEclairee: true })` réel et la loi du module
**injecté** — puis exige que le facteur sorte de 1 sur une pente (`> 1,02` face à
la lampe, `< 0,98` dos à elle) et vaille **exactement 1** drapeau baissé.
**Neutraliser n'importe lequel des trois maillons ramène le facteur à 1**, donc
rougit. Un `return` muet ne peut pas rendre ce test vert : la valeur comparée est
calculée depuis le texte livré, pas lue dedans.

### Les assertions d'autres fichiers, inchangées et acquittées

⚠️ **Trois assertions d'autres fichiers ont été mises à jour, et la relecture a
vérifié par mutation qu'aucune n'a été affaiblie (m3, m4 : ACQUITTÉS) :**

| fichier | ce qui a changé | pourquoi |
|---|---|---|
| `test/crop-habillage.test.js` ⑤ bis | `uMerZeroSousEau: { value: 0 }` → la nouvelle expression **+ `assert.equal(styleMonde(false).merZeroSousEau, 0)`** | l'exigence (« il naît à 0 sans drapeau ») est désormais vérifiée sur la **valeur**, pas sur le texte : **plus fort** qu'avant |
| `test/crop-eclairage.test.js` ⑤c | la ligne `colPlanete` porte `* ombreRelief` | les deux constantes historiques sont gardées, **et** le facteur ajouté doit être celui-là, déclaré neutre |
| `src/main.js` (commentaire) | une occurrence de `terreUniqueActive()` retirée d'un commentaire | voir **m5** ci-dessous |

⚠️ **m5 — et c'est une dette du dépôt, pas de R6.** `crop-branche` ⑧ septies
compte les occurrences de `terreUniqueActive()` **dans le texte du fichier,
commentaires compris**, et en exige exactement deux. Une troisième, **fût-elle en
prose**, le fait rougir. **Cette assertion vient de coûter une modification à un
fichier de production pour une raison qui n'est pas technique**, et elle
recommencera. Elle est antérieure à R6 et je ne l'ai pas touchée — mais elle
devrait compter les occurrences du **code**, pas du fichier.

---

## CE QUE JE TOUCHE (pour la fusion)

**Livré en `d6a012a`** — `src/globe.js` (+~150 l.), `src/flags.js` (+35 l.),
`src/main.js` (+21 l., **uniquement** le bloc de drapeau et un commentaire),
`package.json` (un nom de test), `test/crop-eclairage.test.js` (une assertion),
`test/crop-habillage.test.js` (une assertion + un import).
**Nouveaux** — `src/monde/planete-eclairee.js`, `test/planete-eclairee.test.js`,
`scripts/sonde-descente-nue.mjs`, `scripts/banc-relief-monde.mjs`.

**Ajouté au tour de correction** — `test/planete-eclairee.test.js` (section ⑦,
test ④ réécrit, un test en ⑥) ; `src/monde/planete-eclairee.js` et `src/globe.js`
**en COMMENTAIRE uniquement** (C2 et m2 — **aucune ligne de rendu ne bouge**) ;
`scripts/sonde-descente-nue.mjs` (mode `--triple`) ;
`scripts/banc-relief-monde.mjs` (en-tête ② et phrase I3) ; trois scripts neufs —
`scripts/diag-barriere-gpu.mjs`, `scripts/diag-charge-fragment.mjs`,
`scripts/diag-plancher-bruit.mjs` ; et
`.superpowers/sdd/2026-08-22-globe-studio/traces-R6/` (traces + les dix relevés).

⛔ **Je n'ai touché ni `src/modes.js`, ni `src/monde/zoom-continu.js`** (R4), **ni
le bloc aérien de `src/globe.js`** (R9), ni l'imagerie satellite, ni la mer, **ni
la ligne du terminateur `globe.js:2073`** (R7 — voir la réserve 3).
⛔ **`package.json` n'est pas modifié par ce tour** — voir la réserve 6.

---

## RÉSERVES

1. ⛔ **Le peigne de crêtes reste absent de la planète nue**, et il ne peut pas y
   arriver par ce chantier (point ① ci-dessus). La planète est **éclairée et
   reliéfée**, elle n'est **pas peignée** : la différence se voit encore entre
   `alt-00032962-eclairee.png` et le bloc de `t30`.
2. ⚠️ **Le gain de 0,9 et l'azimut 315° n'ont pas été arbitrés par Adrien.** Ce
   sont des valeurs de convention cartographique (Imhof), pas un réglage validé à
   l'œil par lui. Un seul nombre à changer : `RELIEF_MONDE.gain` — et il est
   désormais **testé non nul**, donc on peut le discuter sans risquer de le
   perdre en silence.
3. ⛔ ⚡ **LE TERMINATEUR ET L'HEURE — CE QUE MON TRAVAIL DEVIENT QUAND R7 AURA
   RELEVÉ LE PLANCHER.** *(Requalifiée de « mineure » en importante par la
   relecture. **Je ne corrige rien ici : la ligne appartient à R7.**)*

   **L'état des lieux.** `globe.js:2073` écrit
   `colPlanete = mix(uShadowColor, colPlanete, 0.10 + 0.90 * day)`. Mon
   `ombreRelief` multiplie `colPlanete` **avant** ce mélange
   (`vec3 colPlanete = col * (0.74 + 0.30 * diff) * ombreRelief;`). **Les deux
   lumières ne se battent donc pas : elles se composent** — l'une multiplie ce
   que l'autre atténue. Mais la fraction conservée sur la face nocturne vaut
   **0,10**, donc **toute modulation de relief y est divisée par dix**.
   Aujourd'hui ça ne se voit pas, parce que `main.js` repose `uSunDir` à chaque
   image sur la caméra tournée de 42° : **la face regardée n'est jamais dans la
   nuit.** Dès que R7 branche le soleil sur l'heure du monde, « plus jamais nue »
   ne vaudrait **que de jour**.

   ⚡ **Et R7 corrige exactement ce plancher** : sa relecture lui demande de le
   relever de **0,10 à 0,45–0,60** avec un refroidissement de teinte. **Ce que
   mon travail devient alors, et c'est arithmétique** : la modulation de relief
   sur la face nocturne passe de **10 %** à **45–60 %** de sa force de jour,
   c'est-à-dire **×4,5 à ×6**. Une pente qui module la luminance de ±20 % au
   soleil module ±2 % aujourd'hui dans la nuit — deux à trois niveaux sur 255, à
   la limite du visible — et **±9 à ±12 %** après. ➡️ **Le plancher relevé ne
   gêne pas D15 : il est ce qui la rend vraie de nuit.** Rien à changer chez moi.

   ⛔ **CE QUI RESTE À ARBITRER, ET CE N'EST PAS ARITHMÉTIQUE** : ma lampe est
   **fixe dans le repère local (nord-ouest, 45°)**. Elle ne tournera pas avec
   l'heure. Une fois le soleil de R7 posé, **le terminateur dira une heure et
   l'ombrage en dira une autre** — crépuscule au couchant, hachures toujours au
   nord-ouest. Les deux lectures possibles :
   - **garder la lampe fixe** — c'est une **hachure cartographique**, pas une
     lumière ; c'est la convention d'Imhof, et le terminateur porte l'heure tout
     seul. ⚡ **C'est ce que je recommande**, et pour une raison mesurable :
   - **asservir l'azimut au soleil** rendrait `n·L − haut·L` nul partout où le
     soleil est au zénith et **borné à zéro partout où il est sous l'horizon** —
     c'est-à-dire **rouvrir le défaut de D15 sur toute la face nocturne, et au
     nadir de midi**. L'angle qui écrase le relief au lieu de le révéler est
     précisément celui que l'Étape 4 documente.

   ➡️ **À trancher à la fusion R6/R7, pas après.**
4. ⚠️ **Les coutures de bord de tuile n'ont pas été mesurées.** Le gradient lit
   `vUv ± pas` ; au bord d'une tuile, le mode ClampToEdge répète le dernier texel
   et la pente y est sous-estimée sur un texel. **Rien de visible aux dix-neuf
   captures**, mais c'est un examen que je n'ai pas fait à la loupe.
5. ⛔ **UNE SEULE MACHINE — ET CETTE RÉSERVE A CHANGÉ DE NATURE.** Elle était une
   intuition ; elle est maintenant **un mécanisme mesuré** (Étape 5) : à
   1 280 × 800, ce banc est **limité par la soumission CPU**, et **×35 de
   fragments à 40 000 m ne bouge pas le temps par image**. ➡️ Le « coût
   indiscernable de zéro » borne **ce que l'utilisateur subit ici**, pas le coût
   GPU du nuanceur. Sur une machine limitée par le remplissage — le cas que
   `palier-machine.js` couvre — ou en très haute résolution, **le même ajout peut
   se voir. Ce n'est pas mesuré.**
6. ⚠️ **`puppeteer-core` reste hors de `package.json` — mais le paquet de
   preuves, lui, n'en est plus absent.** `.banc/` est gitignoré
   (`.gitignore:44`) : après un `npm ci`, aucune des cinq sondes ne démarrait
   **et aucun chiffre de ce rapport n'était re-dérivable**. ➡️ Les **dix relevés
   JSON** sont désormais commités sous `traces-R6/releves/`, avec les traces du
   tour de correction à côté ; les captures PNG (~40 Mo) restent hors dépôt, ce
   sont des illustrations, pas des sources de chiffres.
   **La phrase à rejouer, inscrite en tête des cinq scripts et dans leur message
   d'erreur :**

   ```
   npm i --no-save puppeteer-core@25.8.0
   ```

   ⚠️ `package.json` **n'a pas** été modifié : alourdir le `npm ci` de tout le
   monde pour trois sondes de diagnostic n'est pas un arbitrage que R6 doit
   prendre seul.
7. ⛔ **UN CONFLIT DE MESURE RESTE OUVERT, ET JE NE L'AI PAS TRANCHÉ.** Une autre
   tâche lit `finish` à 0,445–0,455 ms là où mon banc lit 0,49 à 0,85 ms au même
   geste : **un facteur que la barrière n'explique pas**, puisque mes trois
   barrières sont indiscernables entre elles. L'hypothèse la plus probable reste
   que **nos deux bancs ne mesurent pas la même charge** — la mienne est écrite
   noir sur blanc à l'Étape 5 (52 à 583 appels de dessin, 1 280 × 800,
   ANGLE/D3D11, RTX 3080), et **mes scripts sont maintenant dans le dépôt**, ce
   qui la rend enfin rejouable ailleurs. **Je n'universalise rien.**
