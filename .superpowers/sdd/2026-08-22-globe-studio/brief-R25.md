# R25 — LES DIX-SEPT MATIÈRES DE SURFACE

Arbre : `C:\Dev\wt-mat` · branche `matieres-sphere` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5600**.

## CE QU'ADRIEN A DEMANDÉ

> *« reprends la suite de la reconstruction sur toutes les options utiles pour ce
> qui est du mode sphère. On a plein de choses qui ne fonctionnent pas encore en
> mode sphère, mais tu as la liste. »*

La liste est `inventaire-studio-2.md`. Après la vague R20→R24, **tu prends la
plus grosse pièce qui reste** — une seule ligne de l'inventaire, mais dix-sept
vignettes derrière :

| n° | libellé | chemin | ce qu'a relevé l'inventaire |
|---|---|---|---|
| **38** | **le sélecteur de matière (17 vignettes)** | `params.terrainSurfaceMat` → `terrain.setSurfaceMaterial` + `blockGrid` | ⛔ **« le globe n'a pas de matière PBR de relief »** |

Points de départ : `src/terrain.js:3478` (`setMaterialMode`), `src/terrain.js:188`
(le `MeshPhysicalMaterial` et sa transmission — le verre), `src/material-presets.js`
(les préréglages : `ruby`, `emerald`… avec `ior`, `transmission`, `thickness`,
`attenuation`), `src/main.js:7341` (le câblage), `src/ui/create-panel.js` (les
vignettes), `src/globe.js` (le nuanceur du globe), `src/socle-env.js`.

## ⛔ CE QUE JE T'AI ÉCRIT EST UNE HYPOTHÈSE, PAS UN CONSTAT

**Sur ce chantier, l'exécutant qui mesurait a eu raison contre mon départage
dix-sept fois sur dix-sept.** Les cinq dernières tâches ont chacune réfuté au
moins un point de mon brief — dont une où **mon avertissement sur les unités
était lui-même une erreur d'unité**, et une autre où l'option que je donnais pour
morte **était déjà réparée depuis deux tâches**.

➡️ **Commence par établir ce qui est vrai**, avant d'écrire une ligne :

1. **Les dix-sept sont-elles dix-sept ?** Combien de vignettes existent
   réellement, et combien sont des variantes d'un même chemin (`material-presets.js`
   suggère une famille « verre coloré » où seuls `color` et `attenuation` changent) ?
2. **« Le globe n'a pas de matière PBR » — est-ce encore vrai ?** R18, R20, R21 et
   R22 ont ajouté de l'éclairage, un appoint, un ombrage des pentes et des parois
   au nuanceur du globe depuis ce relevé. ⚠️ **L'inventaire s'est déjà contredit
   une fois** : son option 21 était donnée ⛔ dans le tableau alors que sa propre
   ligne 131 disait « FAIT ». **Le tableau brut est un relevé DATÉ.**
3. **Que fait `setMaterialMode` exactement** — remplace-t-il le matériau, ou pose-t-il
   des uniformes ? Les deux réponses mènent à des tâches complètement différentes.

## ⚠️ LE PIÈGE PROPRE À CETTE TÂCHE : LA TRANSMISSION N'EST PAS UN UNIFORME

`terrain.js:191` construit un `MeshPhysicalMaterial` avec `transmission`. ⛔ **La
transmission de three.js exige une passe de rendu supplémentaire** (le
`transmissionRenderTarget`) : ce n'est pas une ligne de nuanceur, c'est un second
rendu de la scène. Sur le crop c'était acceptable — un bloc. **Sur le globe, la
scène est la Terre entière.**

➡️ **Chiffre le coût AVANT de porter quoi que ce soit.** Si la transmission
double le temps d'image en orbite, la bonne réponse n'est pas « tant pis » :
c'est **borner la matière au crop** et le dire, ou trouver l'approximation qui
tient (une réfraction d'écran, comme `eau-refraction.js` en porte déjà une).

⚠️ **`gl.finish()` NE PÈSE PAS LES FRAGMENTS** — un rapport de ce chantier a été
réfuté là-dessus. Pour peser un nuanceur : `EXT_disjoint_timer_query_webgl2`,
**avec un témoin de validité** (multiplier les fragments par 16 doit multiplier
le temps ; R20 a mesuré ×16 ⇒ ×8,2 avec la bonne minuterie, contre ×35 ⇒ ×0,96
avec un banc CPU).

## ⛔ LE DÉFAUT QUI EST REVENU NEUF FOIS

**La conversion d'unité entre l'espace du bloc (`TERRAIN_SIZE = 56`) et celui du
globe (`R_GLOBE`).** Facteurs déjà attrapés : 121,6 · 10 · 130,4 · 6, une portée
de flou de 1 465 km, des toponymes 1 830 m sous les Alpes, et **toute une colonne
de nuages sous le niveau de la mer au large du Pacifique**.

Ta matière porte au moins trois grandeurs qui traversent : `thickness` (une
épaisseur), `attenuation` (une distance), et l'échelle d'une `bumpMap`. **Écris
la conversion en commentaire avec son facteur chiffré.** Les facteurs mesurés à
La Réunion, exagération 2, sont dans `rapport-R24.md` : mètres→bloc
**4,094425e−3**, mètres→globe **3,139225e−5**.

## ⚠️ LE BARÈME DE L'INVENTAIRE EST PARTIELLEMENT SOUS LE BRUIT

R21 a établi que le banc porte un **transitoire de ~0,17 / 0,33**, une mesure sur
douze, cause non identifiée. Le barème déclare ✅ dès **0,06**.

➡️ **RÈGLE : entre 0,06 et 0,19, un relevé unique ne décide de rien.** Répète, ou
prouve autrement (capture, différence par construction).

✅ **Et voici la manœuvre qui marche quand ce que tu mesures est trop petit pour
une moyenne d'image** — R21 l'a inventée pour les parois : **ne cherche pas ta
matière, fais-la se désigner.** Deux images **au même instant**, l'uniforme de la
seule matière mis à zéro dans la seconde : tout pixel qui diffère **est** un pixel
de matière, par construction. Témoin : 0 pixel sur 1 024 000.

## LES AUTRES INSTRUMENTS QUI MENTENT

- **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas** — patron qui marche : `scripts/sonde-demarrage.mjs`.
- **Un condensé 64×40 annule les motifs fins** — une matière EST un motif fin.
  Pleine résolution, toujours.
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité.
- ✅ **La molette simulée MARCHE** (40/40) — l'ancien avertissement contraire est
  **rétracté**, voir `lecons-campagne-R.md`. Ce qui bloquait était le voile
  d'accueil `.ce-hubveil`, qui mange **tous** les gestes. **Ferme-le (Échap)
  avant tout banc d'interaction.**
- **Relève `window.__palierMachine` DANS chaque relevé** : il pilote ombres,
  grain et `pixelRatio` avant tes curseurs. Et **un ralentissement qui ne mesure
  pas la cadence ne teste rien** (R21 : une tentative à ×8 n'a rien testé).
- **Certains curseurs ne valident qu'au relâchement.**
- **La suite de tests peut verrouiller le défaut** : relis les assertions qui
  bordent `setMaterialMode` avant de corriger.

## LES RÈGLES — dans ce dossier

- **D15** — la planète ne doit plus jamais être nue, et ⛔ le départage de ce qui
  **ne peut pas** devenir global : les masques cuits sur l'emprise du crop ne
  couvrent pas la planète.
- **D16 / bis / ter** — une seule caméra, une seule vue, la vue 3/4 n'arrive
  qu'au bloc. **N'ajoute ni caméra ni passe de rendu sans l'avoir chiffrée.**
- **D17** — ⛔ **IL N'Y A PAS DE PRODUCTION.** N'écris jamais « production
  rigoureusement inchangée » en étape de fin : consigne abrogée.

## L'ATTENDU

1. **Un verdict par vignette**, avec le chiffre : vivante sur la sphère · bornée
   au crop volontairement (**avec le coût mesuré qui le justifie**) · ou sans
   objet (**avec la raison mesurée**).
2. **Aucun curseur ni vignette affiché en mode sphère s'il n'agit pas.**
3. **Le coût en temps GPU**, minuterie du pilote, témoin de validité, à au moins
   deux altitudes (orbite et crop).
4. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent ne tourne **jamais**. Ajoute les tiens, puis
   `npm run audit:tests` — aucun écart.
5. `npm test` — **base à battre : 4 573 · 0 échec**.
6. ⚠️ **Scripts d'édition en BINAIRE**, et **relis l'octet écrit**
   (`grep | cat -A`) quand tu poses une expression régulière : j'ai écrit un `\b`
   qui est devenu un **retour arrière** cette nuit, et le test trouvait 0 sur 68
   en restant vert.
7. Commits sur `matieres-sphere`, messages en français.
8. Rapport `rapport-R25.md` ici, avec les conversions écrites, le coût chiffré,
   et une section **« ce que j'ai cru puis réfuté »** — sur ce chantier c'est la
   section la plus utile, et **elle n'a jamais été vide**.

Travaille jusqu'au bout, ne pose pas de question : tranche, mesure, corrige.
