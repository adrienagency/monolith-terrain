# Tâche R9 — remettre en route l'imagerie satellite sur la découpe sphérique

**Statut : FAIT, TOUR DE CORRECTION COMPRIS.** Le bouton de photo aérienne peint
la découpe, dans le bon sens, avec son fondu côtier, sous son crédit de licence,
et s'éteint. Vérifié à l'écran, contre-épreuves comprises.

- Arbre : `C:\Dev\wt-sat`, branche `satellite-crop`, partie de `d366a40`
- Commits du tour 1 : `77121b9` + `57293bd`
- Commits du **tour de correction** : `360c6e0` (C1+C2), `ce025f7` (C3+m8),
  `2eca7d9` (I4), et celui-ci (I5, m6, m7, compte rendu)
- Tests : **4 218 passent, 0 échec** (4 206 avant le tour de correction, +12) ·
  audit **218 = 218**
- Serveur de mesure : `localhost:5517` (5503 / 5519 / 5521 / 5523 / 5529 / 5531
  non touchés)

⚠️ **CE RAPPORT PORTE DES AFFIRMATIONS DU TOUR 1 QUI ÉTAIENT FAUSSES.** Elles
sont corrigées **en place**, marquées ⛔ CORRIGÉ, et le §7 dit ce que le tour de
correction a fait. Ne pas lire les §1 à §6 sans lui.

---

## 1. Le diagnostic du brief était juste — sauf sur un point, et l'erreur allait dans le bon sens

Tout ce que le brief annonçait a été **vérifié avant d'écrire une ligne** :

| Affirmation du brief | Vérifié | Comment |
|---|---|---|
| Patron déjà présent 3× (`uCoastMask`, `uSol`, `uAnalysis`) | ✔ | lecture de `globe.js` |
| « six samplers sur seize » est périmé, l'état réel est 8 | ✔ | compté : `uTex, uRamp, uCoastMask, uSol, uSolLut, uFondChamp, uAnalysis, uRampCrop` |
| La loi d'UV de position est partagée (`cmUv = qCrop*0.5+0.5`) | ✔ | `habillage-crop.js:17-50` + `globe.js:1576` |
| L'aérien est `flipY = true`, les champs cuits `flipY = false` | ✔ | `aerial-layer.js:646-651`, `coast-mask.js:189`, `terrain.js:3266`,`:3286` |
| **Sans le flip, la photo sort inversée nord-sud** | ✔ **et photographié** | voir §3 |
| Le chemin s'arrête sur `terrain.setAerial` | ✔ | `main.js` |
| Base 4 195 tests / 0 échec / audit 216 | ✔ | `npm test` avant toute édition |
| Le crop est une découpe **unique** | ✔ | `globe._crop` est un objet, pas un tableau ; `poserCrop` singulier. **Mesuré à chaud** : `uMaskSpan = 56 = 2 × uSlabHalf`. **La question du 3×3 sur le globe ne se pose pas.** |

### ⚠️ Le point où le brief se trompe

> « **MAIS** l'aérien conserve `flipY = true`, **alors que les trois masques que le
> globe lit aujourd'hui sont tous cuits avec `flipY = false`** […] personne ne l'a
> jamais écrite ni testée côté globe. »

**C'est faux sur les deux moitiés, et l'erreur rendait la tâche plus risquée
qu'elle ne l'est.**

1. **`uSol` n'est pas un champ cuit `flipY = false`** : c'est une mosaïque de
   tuiles Web Mercator, `CanvasTexture`, donc `flipY = true` — la **même famille**
   que la photo aérienne. Seuls `uCoastMask` et `uAnalysis` sont des champs cuits.
2. **Le flip est déjà écrit côté globe, et déjà testé.** `globe.js`, bloc de
   l'occupation du sol :

   ```glsl
   vec2 sUv = vec2(qCrop.x * 0.5 + 0.5, 1.0 - (qCrop.y * 0.5 + 0.5));
   sUv = uSolOffset + sUv * uSolScale;
   ```

   et `test/crop-habillage.test.js` ⑩h l'évalue **sur 441 points** contre
   `uvDrapeCrop`, une loi **pure et exportée** de `monde/habillage-crop.js`.

**Conséquence pratique** : l'aérien n'est pas « la seule vraie pièce neuve ».
C'est le **quatrième** emploi du patron de texture et le **second** emploi du
flip, avec un précédent exact à recopier et une loi pure déjà écrite. La route
était encore plus courte que le brief ne le croyait.

Le brief avait cependant **entièrement raison sur le fond** : sans ce flip la
photo sort à l'envers, et il fallait le vérifier à l'écran.

---

## 2. Ce qui a été écrit

⛔ **CORRIGÉ (m6).** Le tour 1 annonçait « 59 lignes de code (hors commentaires),
sur 250 lignes de diff ». Recompté au tour de correction sur
`git diff --numstat d366a40..57293bd -- src/ package.json` :

| | annoncé au tour 1 | **recompté** |
|---|---|---|
| lignes ajoutées | 250 | **206** |
| dont hors commentaires et blancs | 59 | **39** |

**39 lignes de code**, sur **206 lignes de diff**.

### (a) Transcription — le patron, recopié

| Fichier | Ce qui entre |
|---|---|
| `src/globe.js` | 5 uniformes déclarés dans le fragment (`uAerial`, `uAerialOn`, `uAerialOpacity`, `uAerialOffset`, `uAerialScale`) ; 5 défauts dans `this.uniforms` (`uAerialOn: 0`, texture `null` — la convention **du globe**, pas celle du socle) ; pose dans `poserHabillage` ; libération dans `retirerHabillage` |
| `src/main.js` | `contexteCrop` lit **l'interrupteur** du socle, pas la texture seule |
| `src/monde/branchement-crop.js` | `'aerial'` et `'aerialOpacite'` dans `CHAMPS_HABILLAGE` ; **pas** les vecteurs offset/scale (mêmes exemption et raison que `solOffset`/`solScale` : mutés en place) |

⚠️ **Une garde qui ne se voit pas et qui décide de tout** : `terrain.setAerial(null)`
ne touche **que** `uAerialOn` — la texture reste liée. Lire `uAerial.value` sans
la garde aurait donné au globe une texture toujours vraie, et **la photo ne se
serait jamais éteinte**. Vérifié à l'écran (§3, aller-retour).

### (b) Neuf — le bloc fragment

Porté depuis `terrain.js:1240-1271`, réécrit en `qCrop`, **avec le flip** :

```glsl
if (uAerialOn > 0.5 && uAerialOpacity > 0.001 && dedansCrop > 0.0) {
  vec2 aUv = vec2(qCrop.x * 0.5 + 0.5, 1.0 - (qCrop.y * 0.5 + 0.5));
  aUv = uAerialOffset + aUv * uAerialScale;
  vec3 aerien = texture2D(uAerial, aUv).rgb;
  float shadeA = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, aerien * (0.6 + 0.8 * shadeA), uAerialOpacity * dedansCrop);
}
```

Trois décisions, chacune argumentée dans le code :

- **L'affine passe APRÈS le retournement**, jamais avant : les deux ne commutent
  pas, et `aerialUvTransform` mesure son offset depuis le bord **sud** en le
  supposant déjà fait.
- **`dedansCrop` et non `partBloc`** : `partBloc` vaut
  `uEclairageOn > 0.5 ? dedansCrop : 0.0`. Borner la photo à lui l'aurait éteinte
  avec l'éclairage du crop, alors que c'est une couche de **carte**.
- **Ordre du mélange, fait concorder avec le socle** :
  `rampe → occupation du sol → albédo → PHOTO → apparence → trait de côte →
  courbes → graticule → lumière`. Le socle pose la photo sur la peinture et sous
  l'apparence et les traits ; le globe fait pareil. Le test ⑤e de
  `crop-eclairage` et le nouveau ② de `crop-aerien` verrouillent la suite **des
  deux côtés** — si c'est le socle qui change d'avis, le test rougit aussi.

---

## 3. ⚡ CE QUE L'ÉCRAN DIT — quatre captures, `.banc/vues-R9/`

⛔ **CORRIGÉ (I5 et m7).** Ces captures sont **toutes au lieu par DÉFAUT**, et la
légende « Annecy z12 » décrit une commande qui n'a **jamais pris** — coïncidence
heureuse, le défaut EST Annecy. La cause n'est pas les drapeaux (ce que le §5
disait, à tort) : le payload des sondes n'avait ni `format` ni `v`, donc
`parseShareState` (`share-link.js:163`) rendait `null` **dans tous les modes, la
production comprise**. `reunion-crop.png` est **octet pour octet** `crop-A.png`,
et `reunion-socle.png` montre le lac d'Annecy, son étiquette « ANNECY » lisible.
➡️ **Les deux captures qui prétendaient montrer La Réunion sont refaites au §7.**

⚠️ **Et le dossier compte plus qu'il ne montre** : douze fichiers pour **sept
images distinctes** (md5 recomptés au tour de correction — la relecture en
annonce cinq, c'est **sept**, voir §7).

Chrome sans tête (patron `scripts/sonde-demarrage.mjs`), 1280×800, Annecy z12
(par défaut, pas par commande).

| Capture | Ce qu'elle montre |
|---|---|
| `crop-A.png` | **La photo est là, et elle est au bon endroit.** Le lac d'Annecy, la ville en tête de lac au nord-ouest, le lac vers le sud-est. |
| `crop-B-globe-eteint.png` | `globe.uniforms.uAerialOn = 0` **seul** (le socle reste à 1) : la photo **disparaît entièrement**. ⇒ **c'est bien le nuanceur du globe qui la peint**, pas le maillage plat. |
| `crop-C-sans-flip.png` | ⚡ **La contre-épreuve.** Retournement neutralisé par l'affine (`offset.y = 1`, `scale.y = -1`, ce qui rend exactement l'UV **non** retourné) : **le lac remonte sur les crêtes et la vallée reste vide**. C'est l'inversion nord-sud, photographiée. |
| `socle-A.png` | Le socle, drapeau baissé, même lieu : **même géographie, même orientation, même calage**. |

**Aller-retour par le vrai chemin du bouton** (`params.aerialEnabled` +
`refreshAerial`), relevé dans la page :

```
repos   : {params:false, socle:0, globe:0, globeTex:false}
allumé  : {params:true,  socle:1, globe:1, globeTex:true }
éteint  : {params:false, socle:0, globe:0, globeTex:false}
```

et `globe_memeTexture: true` — le globe reçoit **le même objet `THREE.Texture`**
que le socle, pas une seconde copie.

⚠️ **La veille par image fonctionne** : la photo apparaît **sans changement de
lieu**, uniquement par `refreshAerial`. C'est ce que `'aerial'` dans
`CHAMPS_HABILLAGE` achète, et c'est vérifié à chaud, pas seulement en test.

---

## 4. Le test — il exécute, il ne cherche pas des noms

⛔ **CORRIGÉ (C3). CE TITRE EST VRAI DE ⑤, ET FAUX DE TOUT LE ⑥.** Le branchement
était grepé (`assert.match(GLOBE_NU, …)`, `assert.match(MAIN_NU, …)`) — dans le
fichier même où le tour 1 est allé ajouter cinq uniformes au harnais
`poserHab` / `retirerHab` qui EXERCE ces fonctions. Résultat mesuré par la
relecture : **trois mutations du corps de pose survivaient à la suite entière**,
dont l'annulation complète de la pose de la photo (4 206/4 206 verts). Réparé
au §7 — `crop-habillage` ⑨j et ⑨h étendu, cinq mutants, cinq tués.

`test/crop-aerien.test.js`, **11 tests**, ajouté à la liste explicite de
`package.json` (audit 217 = 217).

L'assertion qui décide de la tâche est **⑤c** : les **deux** chaînes GLSL — celle
du globe **et celle du socle** — sont traduites en JS et **exécutées l'une contre
l'autre** sur 441 points, avec une affine tirée d'`aerialUvTransform` **du
dépôt** (pas un couple choisi pour arranger le test). Le socle sert d'oracle.

⚠️ **Et la contre-épreuve est dans le test lui-même** : il vérifie qu'une chaîne
sans retournement **diverge**, faute de quoi l'assertion serait verte pour un
test qui ne compare rien.

**Mutation jouée pour de bon** — retournement retiré de `globe.js`, suite
relancée : **3 assertions rougissent** (`crop-aerien` ⑤a et ⑤c, `crop-habillage`
②). Restauré, tout revient vert.

Deux tests existants mis à jour, plus deux stubs :

- `crop-eclairage` ⑤f : 8 → **9** samplers ;
- `crop-habillage` ① : 8 → **9**, plus l'exigence que le pavé de `globe.js` dise
  le même nombre ;
- `crop-habillage` ② renommé « les **DEUX** couches drapées » et il vérifie
  maintenant le flip de l'aérien aussi ;
- les stubs d'uniformes de `crop-habillage` et `crop-naturel` (ce sont des
  **secondes copies** de la liste de `globe.js` — un uniforme oublié y tombe en
  `TypeError`, pas en assertion).

---

## 5. Réserves

1. ⛔ **CORRIGÉ — `uAerialCoastFade` EST porté** (§7, constat I4). La raison du
   refus ne tenait pas : elle était vraie des **noms** (`uSeaY`, `uSeaRange`,
   `vWorldPos.y`) et fausse de la **notion**. Le globe a une mer, et la
   correspondance était **déjà écrite dans `globe.js`**, au bloc du fond marin.
   ⚠️ **Et l'écart déclaré « non mesuré » était mesurable en une sonde** : il
   vaut **25,168 % des pixels sur le crop**, mesuré au §7.

2. ⛔ **CORRIGÉ — C'EST L'INVERSE, ET C'ÉTAIT LE DÉFAUT LE PLUS GRAVE DE CE
   TOUR.** Le tour 1 écrivait que le branchement « rend le crédit sans objet
   sous le drapeau, puisqu'il y a désormais une vraie photo ». **C'est l'inverse
   exact.** La garde `if (aerialAttribution && !terreUniqueBranchee)` avait été
   posée par la Tâche R1 ② **au motif que sous `terre unique` l'orthophoto n'est
   JAMAIS à l'écran** — prémisse que R9 rend fausse. Résultat mesuré : sous le
   drapeau, photo peinte sur la sphère, **l'attribution IGN était absente**.
   Une mention de licence doit décrire l'écran. Corrigée au §7.
   ⚠️ **Le défaut de PRODUCTION, lui, reste intact et à l'arbitrage d'Adrien.**

3. **Les couches vectorielles ne suivent pas.** En comparant `crop-A` et
   `socle-A` : le socle repeint le lac en bleu vif (couche plans d'eau), affiche
   les rivières et les étiquettes ; le globe laisse la photo brute. **Ce n'est pas
   un défaut de R9** — ce sont d'autres couches, non branchées sur le crop, et
   c'est hors périmètre. Mais c'est visible et il faut le savoir.

4. **Le mode continu 3×3 sur le globe est hors périmètre, et il ne se pose pas** :
   le crop est une découpe **unique** (`globe._crop` est un objet), et `uMaskSpan`
   valait **56 = 2 × uSlabHalf** au relevé, donc hors emprise continue. Si un jour
   le crop est bâti sur l'emprise 3×3, l'équivalence
   `cmUv = qCrop*0.5+0.5 ↔ champXZ()/uMaskSpan+0.5` devrait tenir par le même
   argument — **mais je ne l'ai pas mesuré et je ne l'affirme pas.**

5. **`aIn` (le fondu de bord d'emprise du socle) n'est pas porté.** Il vaut 1 hors
   mode continu — donc sans effet dans le cas mesuré — et n'a de sens qu'avec
   l'emprise 3×3, hors périmètre.

---

## 6. Fusion — ce que j'ai touché

Trois autres tâches touchent ces fichiers. Voici **exactement** mes points
d'insertion.

**`src/globe.js`** — 4 endroits, tous additifs, aucun existant modifié :
- bloc d'uniformes du fragment, **après `uniform vec3 uHazeColor;`** (fin du bloc
  « colorisation naturelle »), avant « L'ECLAIRAGE DU CROP » ;
- `this.uniforms`, **après `uContourWeight`** ;
- fragment, **entre le `if (partBloc > 0.0)` d'`albedoCrop` et le bloc
  « LA COUCHE APPARENCE »** ;
- `poserHabillage` : 4 paramètres après `solTexel`, et 5 poses après
  `if (solTexel) …` ; `retirerHabillage` : 5 lignes après `u.uSolTexel.value.set`.

**`src/main.js`** — 2 endroits, dans `contexteCrop` :
- une const `aerien` **après la const `sol`** ;
- 4 champs dans l'objet `habillage`, **après `solTexel` et avant `amplitudeM`**.

**`src/monde/branchement-crop.js`** — 1 endroit : `'aerial'` et `'aerialOpacite'`
dans `CHAMPS_HABILLAGE`, **après `'solOpacite'`**.

**`package.json`** — **une seule ligne** modifiée (la liste `test`), insertion de
`test/crop-aerien.test.js` **juste après `test/crop-eclairage.test.js`**.

**Tests** : `test/crop-aerien.test.js` (neuf), plus 4 retouches localisées dans
`crop-eclairage`, `crop-habillage` (×3) et `crop-naturel`.

⚠️ **Si une autre tâche ajoute un sampler au fragment du globe**, deux tests
doivent bouger ensemble : `crop-eclairage` ⑤f et `crop-habillage` ①, plus le pavé
de `globe.js` que ① vérifie comme texte.

**Hors dépôt** : `.banc/sonde-r9*.mjs` et `.banc/vues-R9/` (`.banc/` est ignoré).
`puppeteer-core` installé avec `--no-save` : `package.json` n'en porte pas trace.

---

# 7. LE TOUR DE CORRECTION — 2026-08-23

Trois constats critiques, deux importants, trois mineurs. **Tous traités.** Un
constat de la relecture est **faux**, et je le prouve (m7).

- Base du tour : `57293bd` · Tests au départ : **4 206** · à l'arrivée :
  **4 218**, 0 échec · audit **218 = 218**
- Mes traces : `.banc/vues-correction-R9/`, sondes
  `.banc/sonde-correction-credit.mjs`, `.banc/sonde-correction-fondu.mjs`,
  `.banc/sonde-correction-lieux.mjs`

## ⛔ C1 — le crédit d'orthophoto suit désormais la PHOTO, plus le drapeau

**Commit `360c6e0`.** Le constat est juste, et le rapport du tour 1 disait
l'inverse. La garde de R1 ② reposait sur « sous `terre unique` l'orthophoto n'est
JAMAIS à l'écran » ; R9 a rendu cette prémisse fausse, donc la garde est devenue
le défaut qu'elle réparait.

**La loi vit dans `src/monde/credit-orthophoto.js`**, module pur, deux fonctions :

- `orthophotoPeinteSurLeCrop(globe.uniforms)` — la transcription de la garde du
  nuanceur (`uCropOn > 0.5 && uAerialOn > 0.5 && uAerialOpacity > 0.001`) ;
- `creditOrthophoto({ terreUnique, attribution, peinte })` — sans drapeau,
  **intact** (le défaut de production est laissé à l'arbitrage d'Adrien, et une
  assertion l'exige) ; sous le drapeau, le crédit suit la photo, **dans les deux
  sens**.

⚠️ **UNE RESYNCHRONISATION PAR IMAGE ÉTAIT NÉCESSAIRE, ET CE N'EST PAS DU
CONFORT.** `refreshOsmCredit` est appelée sur ÉVÉNEMENT. À l'instant où
`refreshAerialCore` pose la mosaïque et appelle le crédit, **le globe ne l'a pas
encore** : `veilleCrop` la lui donne à l'image SUIVANTE (`CHAMPS_HABILLAGE`, la
course de la Tâche K ter). Sans resynchronisation, le crédit se calculait sur un
crop vierge et **plus rien ne le redemandait** — la correction n'aurait jamais
été visible. Elle est posée dans `majSeuilSocle`, sous garde de changement (une
comparaison de booléens par image, jamais d'appel au DOM sans transition).

### ⚡ MESURÉ À L'ÉCRAN — `.banc/vues-correction-R9/credit.json`

Chrome sans tête, 1280×800, `localhost:5517`, aller-retour par le vrai chemin
(`params.aerialEnabled` + `refreshAerial`).

| | `socle_uAerialOn` | `globe_uAerialOn` | la ligne « Orthophotos © IGN · NASA GIBS » |
|---|---|---|---|
| **crop, `?terre=unique&frontiere=1`, repos** | 0 | 0 | **absente** ✔ |
| **crop, photo ALLUMÉE** | 1 | **1** | **PRÉSENTE** ✔ (elle était absente avant) |
| **crop, photo ÉTEINTE** | 0 | 0 | **absente** ✔ |
| production, repos | 0 | 0 | absente |
| **production, photo allumée** | 1 | 0 | **présente — INTACT** |
| production, éteinte | 0 | 0 | absente |

**La production rend exactement ce qu'elle rendait**, défaut d'orbite compris :
il n'est pas corrigé en passant.

## ⛔ C2 — le test qui verrouillait la régression est requalifié

**Même commit.** `test/visibilite-surface.test.js` ③ exigeait par expression
régulière le TEXTE de la garde : **il rougissait sur la correction juste**. C'est
la classe de défaut la plus coûteuse de ce chantier, prise par l'autre bout —
d'ordinaire le grep laisse passer une mutation, ici il interdisait la réparation.

- ③ ne garde plus que ce qu'aucune loi ne peut porter : que `main.js` **appelle**
  la loi, avec les **trois entrées vivantes** (un `peinte: true` en dur rendrait
  la loi verte et l'écran menteur), et qu'il ne pousse pas l'attribution à côté ;
- un second ③ garde la resynchronisation (son ordre après `veilleCrop.maj`, sa
  garde de changement, sa mémoire initiale) ;
- le COMPORTEMENT est dans `test/credit-orthophoto.test.js`, **8 tests**.

⚡ **L'assertion qui décide : ② EXTRAIT la garde du bloc aérien de `globe.js`, la
traduit et l'EXÉCUTE** contre la loi, sur la table de vérité complète
(2 × 2 × 4 combinaisons), avec la substitution `dedansCrop → uCropOn` **prouvée**
(`dedansCrop` part à zéro et ne reçoit sa valeur que dans la branche
`if (uCropOn > 0.5)` — deux écritures en tout, et le test compte). Le nuanceur
sert d'oracle : si l'un des deux change d'avis, le test rougit **dans les deux
sens**.

**4 mutants joués, 4 tués** : loi ramenée à l'ancien comportement · `peinte: true`
en dur dans `main.js` · garde du nuanceur relâchée (`> 0.0` → `>= 0.0`) ·
resynchronisation retirée.

## ⛔ C3 + m8 — `poserHabillage` est EXERCÉE, plus grepée

**Commit `ce025f7`.** Le constat est juste, et le harnais était bien là, dans le
fichier que le tour 1 avait modifié. `test/crop-habillage.test.js` gagne :

- **⑨j** (neuf) : l'interrupteur par absence de donnée (allumage ET extinction,
  texture LÂCHÉE), la tirette d'opacité, **son défaut**, l'affine recopiée
  composante par composante, le non-partage de l'objet de l'appelant, le fondu
  côtier, et la conservation de l'affine sur une pose muette ;
- **⑨h** : les **cinq** uniformes aériens entrent dans l'aller-retour bit à bit —
  `retirerHabillage` pouvait les oublier sans qu'une assertion tombe.

**m8 : les deux mutants « bénins » sont COUVERTS, pas déclarés.** La tirette
était écrite **trois fois en littéral** — constructeur, défaut de signature,
`retirerHabillage` : exactement les « deux littéraux jumeaux » que ⑨i existe pour
interdire. Elle passe dans `HABILLAGE_MONDE.aerialOpacite`, **une seule
écriture**, et ⑨i l'exige comme pour les sept autres.

**Campagne de mutation rejouée, 5 mutants, 5 TUÉS** :

| mutation | avant le tour | après |
|---|---|---|
| corps de pose en branche morte (`if (1) {…} else {…texte intact…}`) | **survit** (188/188) | **tuée** |
| `u.uAerialOpacity.value = aerialOpacite` retirée | **survit** (4 206/4 206) | **tuée** |
| les deux `if (aerialOffset/Scale) …set()` retirées | **survit** (4 206/4 206) | **tuée** |
| défaut de signature `aerialOpacite` → 0 | **survit** | **tuée** |
| défaut du constructeur `uAerialOpacity` → 0 | **survit** | **tuée** |

## ⚠️ I4 — le fondu côtier EST portable, et il est porté

**Commit `2eca7d9`.** ⚠️ **La raison du refus ne tenait pas, et le constat avait
raison de le demander.** Elle était vraie des NOMS et fausse de la NOTION : le
globe a une mer, donc un niveau d'eau — et **la correspondance était déjà écrite
dans `globe.js`**, au bloc du fond marin, quarante lignes au-dessus :

> « le socle mesure sa profondeur en unités de scène (`uSeaY - y` sur
> `uSeaRange`), le globe en MÈTRES BRUTS (`-h` sur `uMerFondBudgetM`) »

Substitution, terme à terme : `uSeaY → 0.0` · `uSeaY - y → -h` ·
`uSeaRange → uMerFondBudgetM`. Le socle écrit
`smoothstep(uSeaY - band, uSeaY, y)` ; le globe écrit donc
`smoothstep(-bandeM, 0.0, h)`. **Ce n'est pas une seconde loi de niveau d'eau,
c'est la première, relue.**

### ⛔ UNE GARDE DE PLUS QUE LE SOCLE, ET ELLE EST OBLIGATOIRE

`terrain.js` pose `uSeaY` **sous le terrain** quand le bloc n'a pas de donnée
sous-marine (« then uSeaY simply sits below the terrain ») : son fondu rend 1
partout, par construction. **Le globe, lui, mesure depuis `h = 0` écrit en dur** :
dans une cuvette sous le niveau de la mer — vallée de la Mort −86 m, mer Morte
−430 m, un polder −7 m — il effacerait la photo d'une **TERRE**.

Le témoin existe déjà : le budget **au plancher**, le repli que `poserMer` écrit
lui-même (`Math.max(champ.profMaxCropM || champ.profMaxM, 1)`).
⚡ **MESURÉ** : Annecy z12, drapeau levé — `uMerRampeOn = 1` **et**
`uMerFondBudgetM = 1`. Le crop continental prend bien le repli, et sans cette
garde sa bande de fondu vaudrait **dix centimètres**. La garde est donc
`uAerialCoastFade > 0.0 && uMerRampeOn > 0.5 && uMerFondBudgetM > 1.0`.

### ⚡ MESURÉ SUR LE CROP — La Réunion, côte ouest, z11

1280×800, **grain de film GELÉ** (`params.animations = false`), synchronisation
par `readPixels(1×1)` — **pas** `gl.finish()`, qui ne synchronise pas sous
ANGLE/D3D11. Relevé : `globe_uAerialOn = 1`, `globe_uAerialCoastFade` suit la
tirette, `uMerFondBudgetM = 2 077,85 m`, `globe_meme_texture = true`.

| | pixels différents | part | écart moyen | écart max |
|---|---|---|---|---|
| **fondu 0 contre 0,1 (l'effet)** | 257 716 | **25,168 %** | **7,16/255** | 97 |
| **0,1 contre 0,1 (plancher de bruit)** | **0** | **0,000 %** | **0,0000** | **0** |

⚠️ **Les deux captures à paramètres égaux sont IDENTIQUES AU MD5** — le gel du
grain rend le banc parfaitement déterministe, et les 25 % sont donc
**entièrement** le fondu.

**À l'écran** (`REU-fade0.png` contre `REU-fade01.png`) : sans le fondu, des
**plaques rectangulaires bleu marine à coutures de tuiles** couvrent la mer le
long du rivage et au large — c'est exactement ce que la relecture décrivait.
Avec, la rampe bathymétrique turquoise revient au large et **la terre est
inchangée**. Le crop rend alors la même image que le socle (`REU-socle.png`).

### Le test

`test/crop-aerien.test.js` gagne **⑦a / ⑦b / ⑦c**. ⚡ **⑦a traduit les DEUX
chaînes GLSL — celle du globe et celle du socle — et les EXÉCUTE l'une contre
l'autre** sur toute la colonne d'eau : 5 budgets × 4 fondus × 41 profondeurs, à
`uSeaY` **non nul** côté socle (si les deux ne se correspondaient que pour
`uSeaY = 0`, l'égalité ne prouverait rien), plus une contre-épreuve de **sens**
(un fondu inversé effacerait la photo de la terre et la garderait sur la mer).

**7 mutants joués, 7 tués** : `aFade` calculé mais non appliqué · fondu inversé ·
budget remplacé par le plancher · pose retirée · `retirerHabillage` oublieux ·
`contexteCrop` amputé · `'aerialCoastFade'` retiré de `CHAMPS_HABILLAGE`.

⚠️ **`aerialCoastFade` EST une tirette** (« Fondu à la côte », `ui/map-panel.js`,
0 → 0,4) : sans sa place dans `CHAMPS_HABILLAGE`, elle bougeait le bloc plat et
laissait le crop couvrir la mer.

## ⚠️ I5 — le diagnostic était faux, les captures sont refaites

Le constat est juste. Le payload de mes sondes du tour 1 était
`b64url({ loc: {…} })`, **sans `format` ni `v`** ; `parseShareState`
(`share-link.js:163`) exige les deux, donc il rendait `null` **dans tous les
modes**. Ce n'était pas les drapeaux.

**Captures refaites, `.banc/vues-correction-R9/`**, payload complet :

| capture | preuve de lieu, CHIFFRÉE | ce qu'elle montre |
|---|---|---|
| `REU-fade0.png` / `REU-fade01.png` (crop) | `uMerFondBudgetM = 2 077,85 m` | La Réunion, côte ouest — les plaques, puis le fondu |
| `REU-socle.png` (socle) | `uSeaRange = 5,947` (unités de scène) | La Réunion, étiquette **SAINT-PAUL** lisible |
| `ANN-crop.png` (crop) | `uMerFondBudgetM = 1` (le plancher) | Annecy, crédit **« Orthophotos © IGN · NASA GIBS » présent** |
| `ANN-socle.png` (socle) | `uSeaRange = 0,001` | Annecy |

⚠️ **La preuve de lieu est un NOMBRE, pas une légende** : un crop continental
prend le repli de budget (1 m), une île volcanique sort de 2 077 m d'eau. Les
deux ne peuvent pas être la même vue.

## m6 — les deux chiffres, recomptés

`git diff --numstat d366a40..57293bd -- src/ package.json` : **206 lignes
ajoutées**, dont **39** hors commentaires et blancs. Le tour 1 annonçait 59 / 250.
La relecture annonçait 39 / 206 : **je confirme les deux**.

## ⛔ m7 — LE CONSTAT EST FAUX SUR SON CHIFFRE, ET LE RESTE EST JUSTE

La relecture écrit : « "12 captures" sont **5 images distinctes** (md5) ».
**Ce sont SEPT.** Recompté :

```
$ md5sum .banc/vues-R9/*.png | awk '{print $1}' | sort -u | wc -l
7
$ ls .banc/vues-R9/*.png | wc -l
12
```

Les sept : `071b1f7…` (`socle-1-avant`) · `4b59d09…` (`reunion-socle`) ·
`4d8eb63…` (`bascule-1-allume` = `crop-2-apres` = `crop-A` = **`reunion-crop`**) ·
`727f9a3…` (`socle-A`) · `8c57e2d…` (`socle-2-apres`) · `9ac6230…`
(`crop-C-sans-flip`) · `bd6cdb5…` (`bascule-2-eteint` = `crop-1-avant` =
`crop-B-globe-eteint`).

⚠️ **Le fond du constat, lui, tient entièrement** : douze fichiers pour sept
images, et `reunion-crop.png` est bien **octet pour octet** `crop-A.png`. Le
dossier comptait presque deux fois ce qu'il montrait. J'ajoute que
`reunion-socle.png`, bien qu'unique au md5, **montre Annecy** — l'étiquette
« ANNECY » y est lisible : la sonde Réunion avait rephotographié Annecy **des
deux côtés**, pas seulement sur le crop.

## 8. Fusion — ce que le tour de correction a touché

⚠️ **`src/modes.js` et `src/monde/zoom-continu.js` : PAS TOUCHÉS.**

| fichier | ce qui entre |
|---|---|
| `src/monde/credit-orthophoto.js` | **NEUF** — la loi du crédit |
| `src/monde/habillage-crop.js` | **2 clés** dans `HABILLAGE_MONDE`, après `solOpacite` : `aerialOpacite: 1`, `aerialCoastFade: 0` |
| `src/globe.js` | **fragment** : `uniform float uAerialCoastFade;` à la fin du bloc R9, et le fondu **DANS** le bloc aérien ; `this.uniforms` : `uAerialCoastFade` après `uAerialScale`, et `uAerialOpacity` lit `HABILLAGE_MONDE` ; `poserHabillage` : un paramètre + une pose ; `retirerHabillage` : une ligne. **Aucune autre partie du nuanceur du globe n'est touchée** — ni éclairage de la planète, ni trait de côte, ni soleil horaire. |
| `src/main.js` | l'`import` de la loi ; le corps du crédit dans `refreshOsmCredit` ; `let orthophotoPeinteDerniere` avant `majSeuilSocle` ; la resynchronisation **dans** `majSeuilSocle`, juste après `veilleCrop.maj` ; `aerialCoastFade` dans `contexteCrop.habillage`, après `aerialScale` |
| `src/monde/branchement-crop.js` | `'aerialCoastFade'` dans `CHAMPS_HABILLAGE`, après `'aerialOpacite'` |
| `test/credit-orthophoto.test.js` | **NEUF**, 8 tests |
| `test/visibilite-surface.test.js` | ③ requalifié + un ③ neuf |
| `test/crop-habillage.test.js` | ⑨j neuf · ⑨h étendu · ⑨i une ligne · le stub, 2 lignes |
| `test/crop-aerien.test.js` | ① et ④ étendus · ⑦a/⑦b/⑦c neufs |
| `test/crop-naturel.test.js` | le stub, un uniforme |
| `package.json` | **une seule ligne** (la liste `test`), `test/credit-orthophoto.test.js` après `test/visibilite-surface.test.js` |

⚠️ **`uAerialCoastFade` N'EST PAS UN SAMPLER** (c'est un `float`) : le compte
reste **9**, et `crop-eclairage` ⑤f / `crop-habillage` ① ne bougent pas.

**Hors dépôt** : `.banc/sonde-correction-*.mjs` et `.banc/vues-correction-R9/`.

## 9. Réserves du tour de correction

1. ⛔ **Le défaut de crédit en PRODUCTION n'est pas corrigé**, et c'est une
   décision : en orbite, sans aucun drapeau, `terrain.mesh.visible` est faux et
   le crédit s'affiche quand même. Une assertion de `credit-orthophoto.test.js`
   **l'exige explicitement**, pour qu'elle rougisse le jour où quelqu'un le
   corrigera sans le dire. À l'arbitrage d'Adrien.

2. ⚠️ **Le fondu côtier n'a pas d'équivalent d'`aIn`** (le fondu de bord
   d'emprise du socle), inchangé depuis le tour 1 : il vaut 1 hors mode continu.

3. ⚠️ **La resynchronisation du crédit ne tourne que sous `terre unique`** — elle
   vit dans la branche `if (terreUniqueBranchee)` de `majSeuilSocle`. C'est
   voulu : sans drapeau, rien à resynchroniser, et la production doit rester au
   bit près.

4. ⚠️ **`uMerFondBudgetM > 1.0` est un test de SENTINELLE**, comme
   `uSeaY > -9000.0` l'est côté socle. Le `1` est le plancher que `poserMer`
   applique lui-même, et le test le lit dans la source plutôt que de le
   recopier — mais si ce plancher change un jour, **les deux doivent bouger
   ensemble**, et c'est `⑦b` qui le dira.

5. ⚠️ **Ce que le banc ne sait toujours pas dire** : que la photo du crop et
   celle du socle sont la MÊME image au pixel près. Les deux captures de La
   Réunion se ressemblent à l'œil, et les lois GLSL sont prouvées égales en
   nombres — mais je n'ai pas mesuré la différence pixel à pixel entre les deux
   rendus, qui n'ont ni la même caméra ni la même géométrie. **Je ne l'affirme
   donc pas.**
