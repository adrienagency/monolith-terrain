# R21 — L'ÉCLAIRAGE DU CROP : huit réglages morts

Arbre : `C:\Dev\wt-lum` · branche `lumiere-crop` (partie de `regroupement`).
Serveur : `npm run dev` — **prends un port libre au-dessus de 5600**.

## CE QU'ADRIEN A DEMANDÉ

> *« reprends la suite de la reconstruction sur toutes les options utiles pour ce
> qui est du mode sphère. On a plein de choses qui ne fonctionnent pas encore en
> mode sphère, mais tu as la liste. »*

La liste est `inventaire-studio-2.md`, dans ce même dossier : **127 options du
studio mesurées une par une**, 72 ✅ / 8 ⚠️ / **47 ⛔**. Tu prends huit de ces
quarante-sept, celles qui forment **un seul système : la lumière**.

| n° | libellé | chemin actuel | pourquoi c'est mort |
|---|---|---|---|
| 68 | Douceur des ombres | `params.shadowSoftness` → `sun.shadow.radius` | ombres portées du **bloc plat** ; le crop n'en a pas |
| 69 | Appoint (interrupteur) | `params.fillEnabled` → `setFillEnabled` → `placeFill` | lampe d'appoint dans la **scène du BLOC** |
| 70 | Intensité | `params.fillIntensity` → `placeSun` | idem |
| 71 | Écart au soleil | `params.fillAzimuthOffset` → `placeSun` | idem |
| 72 | Hauteur | `params.fillElevation` → `placeSun` | idem |
| 73 | Couleur | `params.fillColor` → `placeSun` | idem |
| 26 | Ombrage auto | `params.shadeAuto` → `setShadeAuto` → `applyAutoShade` | écrit les uniformes d'ombrage du bloc |
| 30 | Ombrage des pentes | `params.slopeTint` → `terrain.mapUniforms.uSlopeTint` | **AUCUN côté globe** |

Point de départ des fichiers : `src/ui/light-panel.js` (les curseurs),
`src/monde/eclairage-crop.js` (ce qui existe déjà côté crop),
`src/monde/planete-eclairee.js` (la lampe de carte Imhof NO 315°/45°, livrée),
`src/monde/soleil-monde.js` (le soleil à l'heure, livré), `src/globe.js` (le
nuanceur), `src/terrain.js` + `src/daycycle.js` (le côté bloc plat).

⚠️ **`soleil-monde.js` et `planete-eclairee.js` existent déjà et pilotent la
lumière du globe.** Ta tâche n'est pas d'inventer un éclairage : c'est de faire
**arriver ces huit réglages jusqu'à eux**, ou d'établir par la mesure que l'un
d'eux n'a aucun sens sur une sphère et de le dire.

## LES RÈGLES DU CHANTIER — elles sont dans ce dossier, lis-les

- **D15** (`regle-D15.md`) — la planète ne doit plus jamais être nue, et le
  départage de ce qui peut/ne peut pas devenir global.
- **D16 / bis / ter** (`regle-D16.md`) — **une seule caméra, une seule vue**, la
  vue 3/4 n'arrive **qu'au bloc**. Ne rebranche rien qui rajoute une caméra.
- **D17** (`regle-D17.md`) — ⛔ **IL N'Y A PAS DE PRODUCTION.** Le site n'est pas
  en ligne. **N'écris jamais « production rigoureusement inchangée » comme
  étape de fin** : c'est une consigne abrogée, elle a fait perdre du temps.
- `lecons-campagne-R.md` — les pièges de mesure. Lis-le **avant** de mesurer.

## ⛔ LE DÉFAUT QUI REVIENT NEUF FOIS SUR CE CHANTIER

**La conversion d'unité entre deux espaces.** Neuf occurrences déjà : des
facteurs 121,6 · 10 · 130,4 · 6, une portée de flou de 1 465 km, des toponymes
1 830 m sous les Alpes.

Il y a **deux espaces** ici :
- l'espace du bloc, `TERRAIN_SIZE = 56` unités pour l'emprise entière ;
- l'espace du globe, `R_GLOBE` pour le rayon terrestre.

Une hauteur de lampe, un rayon d'ombre, un écart azimutal : **chacun a une unité,
et personne ne la vérifie.** `sun.shadow.radius` est en unités-monde. Si tu le
recopies tel quel côté globe, tu te trompes du rapport des deux échelles.

➡️ **Pour chaque valeur que tu déplaces, écris la conversion dans le code, en
commentaire, avec le facteur chiffré.** Une valeur transportée sans sa conversion
écrite est un défaut, même si elle a l'air de marcher.

## COMMENT MESURER — sinon tu écriras un faux constat

`lecons-campagne-R.md` catalogue les instruments qui mentent. Les plus coûteux
ici :

- **`gl.finish()` mesure la soumission CPU, pas les fragments.** Un rapport a été
  réfuté là-dessus. Si tu chronomètres, établis la vérité terrain **sans
  barrière** d'abord.
- **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas.** Un banc a compté « 0 image en 3,7 s ». Patron qui marche :
  `scripts/sonde-demarrage.mjs` (Chrome sans tête).
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité. Toute mesure
  qui compare deux images doit tenir compte de ça, ou geler la rotation.
- **Un condensé 64×40 annule les motifs fins.** Un ombrage se juge sur les pixels,
  pas sur une vignette.
- **Certains curseurs ne valident qu'au relâchement.** Pose la valeur par le code,
  pas par un clic simulé, sauf si tu vérifies que le clic a pris.
- **`Input.dispatchMouseEvent` type `mouseWheel` n'atteint pas le gestionnaire de
  l'appli** — 0 cran sur 175. Ne pilote pas le zoom comme ça.
- **Le grain est éteint par défaut** (`main.js:466`, `grain: 0`).
- **Un relevé sur UNE image ne prouve rien** si le système oscille : 20 images
  consécutives, et exige la stabilité.

⚠️ **La règle du chantier, quinze fois sur quinze : si tu trouves que mon
départage est faux, c'est TOI qui as raison.** Mesure, et dis-le.

## L'ATTENDU

1. Pour **chacune des huit**, une des trois issues, **avec le chiffre** :
   - **branchée** — le réglage change l'image côté globe, mesuré (moyenne et/ou
     gradient sur des pixels, avant/après, à l'écran) ;
   - **sans objet sur une sphère** — et alors **la raison mesurée**, pas une
     opinion, plus ce qu'il faut faire du curseur (le cacher hors mode bloc) ;
   - **hors périmètre** — coût mesuré à l'appui.
2. **Aucun curseur ne doit rester affiché en mode sphère s'il n'agit pas.** Un
   réglage mort visible est pire qu'un réglage absent — c'est ce qui a produit
   cet inventaire.
3. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent de la liste **ne tourne jamais**. Ajoute les tiens à
   la liste, puis `npm run audit:tests` — **aucun écart**.
4. `npm test` — **base à battre : 4 422 · 0 échec**.
5. ⚠️ **Écris tes scripts d'édition en BINAIRE** (ou `newline='\n'`). Le mode
   texte de Windows met les fichiers en CRLF contre le `.gitattributes` du dépôt
   — **c'est déjà tombé, deux tests sont morts dessus**.
6. Commits sur `lumiere-crop`, messages en français.
7. Un rapport `rapport-R21.md` dans ce dossier : ce qui est branché, ce qui ne
   l'est pas et **pourquoi, chiffré**, les conversions d'unité écrites, et **ce
   que tu as cru puis réfuté** — cette section-là est la plus utile du rapport.

Travaille jusqu'au bout. Ne pose pas de question : tranche, mesure, et écris ce
que la mesure a dit.
