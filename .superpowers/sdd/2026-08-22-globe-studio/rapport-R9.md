# Tâche R9 — remettre en route l'imagerie satellite sur la découpe sphérique

**Statut : FAIT.** Le bouton de photo aérienne peint désormais la découpe, dans
le bon sens, et s'éteint. Vérifié à l'écran, contre-épreuve comprise.

- Arbre : `C:\Dev\wt-sat`, branche `satellite-crop`, partie de `d366a40`
- Commit : `77121b9`
- Tests : **4 206 passent, 0 échec** (4 195 avant, +11) · audit **217 = 217**
- Serveur de mesure : `localhost:5517` (5503 / 5507 / 5509 non touchés)

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

**59 lignes de code** (hors commentaires), sur 250 lignes de diff.

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

Chrome sans tête (patron `scripts/sonde-demarrage.mjs`), 1280×800, Annecy z12.

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

1. ⛔ **`uAerialCoastFade` n'est PAS porté** (le brief le laissait facultatif).
   Il dépend de `uSeaY`, `uSeaRange` et `vWorldPos.y`, qui n'existent pas sous
   cette forme dans le nuanceur du globe ; les porter aurait été une seconde
   tâche, avec le risque de fabriquer une seconde loi. **Conséquence attendue** :
   au large, le globe garde la photo pleine là où le socle l'estompe
   (`uAerialCoastFade = 0,1` relevé en production). ⚠️ **Cet écart n'est PAS
   mesuré** : mes tentatives de placer la sonde sur une île (La Réunion) n'ont pas
   abouti — le hash de lieu n'a pas été pris sous ce jeu de drapeaux et la vue est
   restée sur Annecy. Je ne l'affirme donc pas, je le signale à vérifier.

2. ⛔ **Le crédit faux n'est pas touché**, comme demandé. Le branchement ne
   l'aggrave pas — il le rend même **sans objet sous le drapeau**, puisqu'il y a
   désormais une vraie photo derrière le crédit. Le défaut subsiste tel quel hors
   drapeau, à l'arbitrage d'Adrien.

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
