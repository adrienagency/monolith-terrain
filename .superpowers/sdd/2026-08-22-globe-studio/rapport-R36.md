# R36 — LES BANDES DE LATITUDE : `flipY` EST IGNORÉ POUR UNE ImageBitmap

Arbre `C:\Dev\wt-band`, branche `bandes-globe`. Serveur `npm run dev -- --host
127.0.0.1 --port 5871`. Chrome 152 sans tête, sonde `scripts/sonde-r36.mjs`.

**Base : 4 745 · 0 · audit 251 = 251 → 4 748 · 0 (2 sautés) · audit 252 = 252.**

---

## ⚡ EN UNE PHRASE

`texture.flipY` — que three écrit dans `UNPACK_FLIP_Y_WEBGL` — est **ignoré
quand la source du téléversement est une ImageBitmap**. PF2 (`57be020`) a
déplacé le décodage terrarium dans un Worker qui rend une ImageBitmap : depuis,
**la géométrie restait juste et la texture arrivait retournée en latitude**.
C'est le premier suspect du brief, et c'était le bon — mais pas par le mécanisme
annoncé : ni `(z, x, y)` ni l'appariement des réponses n'étaient en cause.

---

## ① LE CRITÈRE AUTOMATIQUE

**« L'écart, en mètres, à la couture nord-sud entre tuiles voisines, lu dans les
textures TELLES QUE LE GPU LES TIENT. »**

Deux tuiles `(z, x, y)` et `(z, x, y+1)` partagent une ligne de latitude. La
sonde attache chaque texture GL (`renderer.properties.get(tex).__webglTexture`)
à un tampon, relit la ligne `v = 0` de la tuile du haut et la ligne `v = 1` de
celle du bas, décode le terrarium en mètres, et moyenne l'écart. Elle rend en
prime `miroir` : le nombre de paires dont l'écart **tombe** si on relit la tuile
du haut à l'envers — la signature d'une texture retournée.

⚠️ **Pourquoi pas un critère sur la capture** : le brief interdisait le jugement
à l'œil, et une dérivée en espace écran dépend de l'orientation du globe. Ce
critère-ci se lit dans la scène, il est déterministe, et il vaut la **même
valeur au bit près** sur le dernier commit propre et après correctif.

⚠️ **Sa valeur propre n'est pas 0, elle est ~85 m à 10 000 km, et c'est
correct** : deux tuiles XYZ jointives ne dupliquent pas leur ligne de bord, la
couture porte donc un texel de dénivelé réel. Ce qui vaut zéro, c'est
**`miroir`**. La valeur propre monte avec l'altitude (texel plus grossier) :
22 m à 2 000 km, 85 m à 10 000, 147 m à 30 000.

| | écart moyen | miroir |
|---|---|---|
| `f8f1be6` (état vu par Adrien), Afrique 10 000 km | **2 517,9 m** | **28 / 28** |
| `c11a80f` (parent de PF2, dernier commit propre) | **85,4 m** | **0 / 28** |
| après correctif | **85,4 m** | **0 / 28** |

Le dernier commit propre et l'état corrigé rendent **le même nombre à la
décimale** : 85,40066964285714.

## ② LE COMMIT FAUTIF — bissection, pas raisonnement

Sur le premier parent de `regroupement`, puis dans la branche `perf-priorite` :

| commit | écart | miroir |
|---|---|---|
| `cd8a749` (après R32, avant la fusion PF2) | 85,4 m | **0** |
| `c11a80f` (parent de `57be020`) | 85,4 m | **0** |
| ⛔ **`57be020` — « PF2 : boîte orientée, cache souple, décodage hors du fil principal »** | **2 517,9 m** | **28** |
| `4f62fc0` (enfant) | 2 517,9 m | 28 |
| `c0c6267` (fusion PF2 dans `regroupement`) | 2 517,9 m | 28 |

## ③ LA CAUSE, À LA LIGNE

`src/globe.js:3426` — `texture = new THREE.Texture(r.image)` où `r.image` est
l'`ImageBitmap` rendue par `src/monde/decodeur-terrarium.js:54`
(`c.transferToImageBitmap()`).

`THREE.Texture.flipY` vaut **vrai** par défaut ; `WebGLTextures` le pousse dans
`UNPACK_FLIP_Y_WEBGL` (`three.module.js:11284`). **Chrome ignore ce drapeau
quand la source est une ImageBitmap**, et **`gl.getError()` rend 0** : aucune
erreur, aucun avertissement, aucun test rouge.

**Mesuré au pixel, pas déduit** (`node scripts/sonde-r36.mjs --scenario flip`,
une dalle 2×2 ligne du haut rouge, `UNPACK_FLIP_Y_WEBGL = true` dans les deux
cas) :

| source | `v = 0` (lu par `readPixels` ligne 0) | `v = 1` | erreur GL |
|---|---|---|---|
| canevas | **bleu** = ligne du BAS | rouge | 0 |
| **ImageBitmap** | **rouge** = ligne du HAUT | bleu | 0 |

Le chemin canevas (repli, et tout le code d'avant PF2) pose donc `v = 0` au SUD
de la tuile — ce que `_buildMesh` suppose, commentaire à l'appui
(`globe.js:3072` : *« canvas row 0 = north = uv v 1 (flipY texture) »*). Le
chemin Worker posait `v = 0` au NORD.

**Les hauteurs, elles, n'ont jamais bougé** : elles sortent de `getImageData`,
que le GPU ne touche pas. D'où la forme exacte du défaut — **la bonne géométrie
avec la mauvaise donnée**, une couture à chaque ligne de latitude (bord de
tuile), aucune couture aux méridiens (le miroir préserve `x`), et un trait de
côte oblique qui paraît glisser en longitude parce qu'il est retourné.

### Le correctif, à la source

1. `src/monde/decodeur-terrarium.js` : le Worker rend la dalle **déjà
   retournée** — `await createImageBitmap(c, { imageOrientation: 'flipY' })` au
   lieu de `c.transferToImageBitmap()`. Le retournement est fait **hors du fil
   principal**, donc le gain de PF2 est intact. ⚠️ Les **hauteurs sont lues
   avant** : elles restent indexées du nord au sud, comme `sampleHeights`.
2. `src/globe.js` : `texture.flipY = false` sur ce chemin. Le drapeau est ignoré
   aujourd'hui ; le poser rend le code **juste dans les deux cas**, si un
   navigateur se met à l'honorer.

## ④ AVANT / APRÈS — trois altitudes, deux lieux

Pose forcée dans `composer.render` (le dernier écrivain avant l'image), donc la
rotation propre à ~2 °/s est neutralisée et le pixel est déterministe.

| lieu | altitude | paires | avant | après | miroir avant → après |
|---|---|---|---|---|---|
| Afrique (0°, 20° E) | 2 000 km | 40 | 483,4 m | **22,4 m** | 40 → **0** |
| Afrique | 10 000 km | 28 | 2 517,9 m | **85,4 m** | 28 → **0** |
| Afrique | 30 000 km | 12 | 3 409,6 m | **147,1 m** | 12 → **0** |
| Amérique du Sud (15° S, 60° O) | 2 000 km | 32 | 718,5 m | **30,3 m** | 32 → **0** |
| Amérique du Sud | 10 000 km | 21 | 2 213,2 m | **102,2 m** | 21 → **0** |
| Amérique du Sud | 30 000 km | 12 | 3 024,1 m | **135,0 m** | 12 → **0** |

**145 paires sur 145 en miroir avant, 0 sur 145 après.** Captures : le globe
d'Adrien (Afrique tranchée en quatre bandes) et le même cadrage sans une seule
bande.

## ⑤ LE TEST QUI ÉCHOUE SANS LE CORRECTIF

`test/orientation-tuile.test.js`, **3 tests, 3 rouges sans le correctif**
(vérifié en remettant les deux fichiers d'avant) :

① le corps du Worker, monté sous node avec des globales de papier qui portent la
**vraie sémantique** de `createImageBitmap(src, { imageOrientation })`, doit
rendre une dalle retournée en Y ;
② les **hauteurs** doivent, elles, rester dans l'ordre de l'image — retourner
les deux annulerait le correctif, et le test le dit ;
③ `globe.js` déclare `flipY = false` à l'endroit exact où il fabrique la texture
du Worker (garde de cohérence entre les deux moitiés du correctif).

`package.json` : la ligne `test` est une **liste explicite**, le fichier y a été
ajouté ; `npm run audit:tests` → **252 listés · 252 sur disque, aucun écart**.
`npm test` → **4 748 · 0 échec**.

## ⑥ CE QUE J'AI CRU PUIS RÉFUTÉ

- ⛔ **« Les bandes sont décalées en LONGITUDE, donc l'erreur est en x. »** J'ai
  d'abord cherché du côté de `(z, x, y)` et de l'appariement des réponses du
  Worker — le suspect n° 1 nommé par le brief. **Les deux sont sains** :
  `decoderHorsFil` porte un identifiant croissant et une `Map` d'attentes, et
  `hauteursTerrarium` est bien une formule unique partagée par les deux chemins.
  L'erreur est **entièrement en y**, et le décalage apparent en longitude est ce
  que produit un miroir vertical sur un trait de côte oblique. **Le symptôme
  décrit par l'œil désignait le mauvais axe.**
- ⛔ **« La sous-fenêtre de surzoom du Worker est fausse »** (`ox * px` alors que
  la source fait `px` de large). Lu de près : le code du Worker est **copié à
  l'identique** du chemin de repli et de `src/dem.js`. Rien à y reprendre — et
  de toute façon le surzoom ne concerne pas les tuiles d'orbite.
- ⛔ **« Le critère doit valoir exactement 0 sur une capture propre. »** C'est ce
  que demandait le brief ; c'est faux pour un critère de couture. Deux tuiles
  XYZ jointives ne partagent pas leur ligne de bord, la couture porte un texel de
  dénivelé réel : **85,4 m à 10 000 km, et c'est la valeur du dernier commit
  propre**. Ce qui vaut zéro, et qui décide, c'est le compteur `miroir`.
- ⛔ **« Le drapeau lèverait une erreur GL. »** La spécification WebGL 2 laisse
  entendre qu'un `UNPACK_FLIP_Y_WEBGL` sur une ImageBitmap est une erreur. **Non,
  mesuré : `gl.getError()` rend 0.** Le défaut était donc structurellement
  invisible à tout banc qui lit la console — dont plusieurs de ce chantier.
- ✅ **Ce que je confirme du brief** : les quatre suspects innocentés le sont
  bien, et *« les nuages coupés rendent les bandes PLUS nettes »* était le bon
  indice — il disait que le défaut vit dans la couleur du terrain, pas dans une
  passe d'écran.

## ⑦ RESTE OUVERT / À SURVEILLER

- ⚠️ **La classe de défaut est ouverte ailleurs** : tout `new THREE.Texture(…)`
  nourri d'une `ImageBitmap` porte le même piège. `grep` sur `src/` en rend
  **deux** ; le second (`globe.js:3081`, `chargerPhotoTuile`) est un
  `HTMLImageElement`, donc sain, et son commentaire documente déjà la
  convention. Rien d'autre à corriger aujourd'hui — mais un futur passage à
  `createImageBitmap` pour la photo ré-ouvrirait le défaut à l'identique.
- La sonde `scripts/sonde-r36.mjs` reste : `--scenario flip` (le test
  d'orientation, 2 s, ne touche pas la scène), `--scenario vue` (une pose + PNG),
  `--scenario serie` (les six poses du tableau ④).
