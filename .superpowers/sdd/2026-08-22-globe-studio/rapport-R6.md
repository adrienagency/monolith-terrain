# Rapport R6 — LA PLANÈTE NE DOIT PLUS JAMAIS ÊTRE NUE (règle D15)

**Arbre** `C:\Dev\wt-nue` · **branche** `planete-eclairee` · partie de `d366a40`
**Drapeau** `?planete=eclairee` / `?planete=nue` (`FLAGS.planeteEclairee`, **OFF**)
**Matériel de toutes les mesures** ANGLE (NVIDIA GeForce RTX 3080, D3D11), Chrome
sans tête 1280 × 800, serveur de dev port 5519.

---

## EN UN PARAGRAPHE

La planète n'est plus nue. **Deux** postes deviennent l'état de repos du monde —
la normale par fragment et le zéro de la mer — et **un troisième est ajouté**,
parce que les deux premiers ne suffisaient pas : la loi de lumière de la planète
ne module qu'à **1,4:1**, donc le relief y était présent et invisible. Mesuré en
apparié, même session, mêmes tuiles, plancher de bruit **0,00** : dans la bande
du défaut d'Adrien, la dispersion de luminance monte de **+64 % à +84 %** et
**25 à 39 % des pixels bougent**. Le coût est **indiscernable de zéro** avec un
banc qui résout une image entière. ⚠️ **Et le départage de D15 est faux sur trois
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

### ⑥ Le plancher de bruit de 8,97 transmis par R4 — c'est le plancher DU GRAIN, pas du rendu

R4 a mesuré 8,97 d'écart moyen par pixel entre deux captures d'un état identique,
et en a conclu que tout écart sous 9 est du bruit. **Avec `params.animations`
coupé — c'est-à-dire le grain de film gelé — mon plancher tombe à 0,00 sur
14 paliers sur 16** (les deux autres : 0,23 et 0,83), voir `.banc/R6/apparie.json`
et `.banc/R6/maroc.json`. Les captures sont bit-à-bit identiques.

⚠️ **Ce n'est pas une contradiction de sa mesure, c'est une contradiction de sa
règle.** « Tout écart sous 9 est du bruit » n'est vrai que si le grain tourne.
S'il retire son 43 % pour cette raison, **il peut probablement le récupérer** en
gelant le grain avant de capturer.

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

`test/planete-eclairee.test.js`, **24 tests**, six familles :
① la loi sous node · ② **le GLSL livré TRADUIT ET EXÉCUTÉ** contre le module
(72 azimuts × 7 élévations) · ③ l'unicité de l'écriture · ④ le branchement ·
⑤ l'aller-retour bit à bit · ⑥ **le départage de D15, évalué sur le nuanceur**.

⚠️ **Le traducteur GLSL→JS a lui-même eu un défaut, et je le note parce qu'il
était SILENCIEUX** : une expression régulière `[^)]*` s'arrête à la **première**
parenthèse fermante et rendait `NaN` aux 504 points du balayage. Il découpe
désormais aux parenthèses **équilibrées**.

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

### ⚡ Pourquoi un troisième poste a été nécessaire — mesuré, pas supposé

**La normale fine seule ne se voit pas.** Allumée seule : écart-type **14,053
contre 14,089** avant, à 40 000 m — soit **+0,26 %**, à comparer au plancher
inter-session de 15,6 %. Le relief est bien là (on le voit sur
`.banc/R6/vues-apres/alt-00039985.png`, les vallées se dessinent) mais il ne pèse
**rien**. La cause est écrite dans le dépôt depuis P3 : hors du crop, la seule
lumière est

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
l'empreinte du pixel a mangé le détail** — elle rend **exactement 1**. La planète
ne change donc ni de luminosité moyenne ni de teinte : **seule sa modulation
apparaît**. C'est ce qui rend la couture avec le bloc invisible, et ce qui rend le
drapeau baissé vérifiable sans GPU.

### Le départage tenu

`uCoastMask`, `uSol`, `uAnalysis`, `uRampCrop` **restent éteints hors du crop**.
`test/planete-eclairee.test.js` (④) construit un globe sous drapeau et exige
`uCropOn = uHabOn = uAnalysisOn = uRampCropOn = uEclairageOn = 0`.

---

## ÉTAPE 5 — ⚡ LE COÛT

### La méthode, et ce qu'elle a corrigé chez elle-même

`scripts/banc-relief-monde.mjs` — rendu piloté, ordre tournant (ABBA),
différences appariées, chauffe de 40 images jetée. **Trois défauts de l'instrument
ont été trouvés et corrigés avant d'annoncer le moindre chiffre :**

1. ⛔ **`gl.finish()` NE BARRE PAS LA ROUTE sous ANGLE/D3D11.** Trois blocs de
   40 images sur la **même scène** ont rendu **2,197 / 3,490 / 0,505 ms** — un
   facteur **sept**. `gl.readPixels(1×1)` sur les mêmes blocs :
   **0,657 / 0,640 / 0,700**. Le point de synchronisation est donc une lecture de
   pixel (`.banc/R6/diag.mjs`).
2. ⛔ **Tuer `requestAnimationFrame` tue la chaîne de rendu de l'application**, et
   `tick()` n'en est pas le seul appelant : le dernier inscrit écrasait `tick`.
   Les trois altitudes ont alors été mesurées **sur le quadtree de la première** —
   `151` tuiles, `18` appels, `134 373` triangles **aux trois lignes**, y compris
   à 2 000 000 m. La boucle est désormais **capturée dans une file**, pas tuée.
3. ⛔ **`renderer.info` se remet à zéro à chaque `renderer.render()`**, et
   `composer.render()` en enchaîne plusieurs : lu tel quel, il annonçait
   **`appels = 1`** — la dernière passe plein écran, et rien d'autre.

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

⚠️ **UN CHIFFRE À NE PAS ME FAIRE DIRE.** À **6 020 m**, couper les deux postes
ensemble rend **+0,082 ± 0,011 ms/image**. **Ce n'est PAS un coût de D15** : à
cette altitude le crop est posé et `uNormaleFineOn` valait **déjà 1** depuis la
Tâche P9. C'est le prix que le bloc payait avant moi. Ce que D15 ajoute là est
l'ombrage seul : **+0,003 ± 0,018 ms**.

### Pourquoi c'est si peu

Les quatre lectures supplémentaires tapent une texture **déjà en cache** (le
fragment décode `uTex` cinq fois pour `decodeMetersAA`), et le nuanceur du globe
est déjà lourd — rampe, courbes, graticule, grain. Le globe n'est pas limité par
le remplissage à ces nombres de tuiles : **58 à 125 appels de dessin**, pas 283.

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

**4 219 tests · 0 échec · audit 217 = 217** (base : 4 195 / 216).

⚠️ **Trois assertions d'autres fichiers ont été mises à jour, et aucune n'a été
affaiblie :**

| fichier | ce qui a changé | pourquoi |
|---|---|---|
| `test/crop-habillage.test.js` ⑤ bis | `uMerZeroSousEau: { value: 0 }` → la nouvelle expression **+ `assert.equal(styleMonde(false).merZeroSousEau, 0)`** | l'exigence (« il naît à 0 sans drapeau ») est désormais vérifiée sur la **valeur**, pas sur le texte : **plus fort** qu'avant |
| `test/crop-eclairage.test.js` ⑤c | la ligne `colPlanete` porte `* ombreRelief` | les deux constantes historiques sont gardées, **et** le facteur ajouté doit être celui-là, déclaré neutre |
| `src/main.js` (commentaire) | une occurrence de `terreUniqueActive()` retirée d'un commentaire | `crop-branche` ⑧ septies **compte** ces occurrences et en exige deux ; une troisième, fût-elle en commentaire, le faisait rougir |

---

## CE QUE JE TOUCHE (pour la fusion)

**Modifiés** — `src/globe.js` (+~150 l.), `src/flags.js` (+35 l.), `src/main.js`
(+21 l., **uniquement** le bloc de drapeau et un commentaire), `package.json`
(un nom de test), `test/crop-eclairage.test.js` (une assertion),
`test/crop-habillage.test.js` (une assertion + un import).

**Nouveaux** — `src/monde/planete-eclairee.js`, `test/planete-eclairee.test.js`,
`scripts/sonde-descente-nue.mjs`, `scripts/banc-relief-monde.mjs`, `.banc/R6/`.

⛔ **Je n'ai touché ni `src/modes.js`, ni `src/monde/zoom-continu.js`** (R4), ni
l'imagerie satellite, ni la mer.

---

## RÉSERVES

1. ⛔ **Le peigne de crêtes reste absent de la planète nue**, et il ne peut pas y
   arriver par ce chantier (point ① ci-dessus). La planète est **éclairée et
   reliéfée**, elle n'est **pas peignée** : la différence se voit encore entre
   `alt-00032962-eclairee.png` et le bloc de `t30`.
2. ⚠️ **Le gain de 0,9 et l'azimut 315° n'ont pas été arbitrés par Adrien.** Ce
   sont des valeurs de convention cartographique (Imhof), pas un réglage validé à
   l'œil par lui. Un seul nombre à changer : `RELIEF_MONDE.gain`.
3. ⚠️ **Le terminateur jour/nuit lit désormais la normale FINE** (`day` dérive du
   même `nMonde`). Aucun artefact vu aux paliers d'orbite, mais **je n'ai pas
   cadré la ligne du crépuscule exprès** pour l'examiner.
4. ⚠️ **Les coutures de bord de tuile n'ont pas été mesurées.** Le gradient lit
   `vUv ± pas` ; au bord d'une tuile, le mode ClampToEdge répète le dernier texel
   et la pente y est sous-estimée sur un texel. **Rien de visible aux dix-neuf
   captures**, mais c'est un examen que je n'ai pas fait à la loupe.
5. ⚠️ **Une seule machine** (RTX 3080). Le coût peut être différent sur une
   machine limitée par le remplissage — c'est justement le cas que
   `palier-machine.js` couvre, et je ne l'ai pas essayé.
6. ⚠️ **`puppeteer-core` est installé `--no-save`.** Les deux sondes le disent
   dans leur en-tête et échouent avec le message d'installation s'il manque.
   `package.json` n'a **pas** été modifié pour lui.
