# R22 — LES PAROIS DU BLOC ET LA GRILLE : quatre réglages morts

Arbre : `C:\Dev\wt-par` · branche `parois-grille` (partie de `regroupement`).
Serveur : `npm run dev` — **prends un port libre au-dessus de 5700**.

## CE QU'ADRIEN A DEMANDÉ

> *« reprends la suite de la reconstruction sur toutes les options utiles pour ce
> qui est du mode sphère. On a plein de choses qui ne fonctionnent pas encore en
> mode sphère, mais tu as la liste. »*

La liste est `inventaire-studio-2.md`, dans ce même dossier : **127 options du
studio mesurées une par une**, 72 ✅ / 8 ⚠️ / **47 ⛔**. Tu en prends quatre, qui
forment **le mobilier du bloc** : ce qui borde la découpe, et ce qui la quadrille.

| n° | libellé | chemin actuel | ce qu'a relevé l'inventaire |
|---|---|---|---|
| 48 | Afficher le socle | `params.plinth` → `plinth.setVisible` | ⛔ **le socle plat n'est plus rendu ; les parois du crop viennent de `parois-crop.js`** |
| 50 | Couleur de la tranche | `params.plinthColor` → `plinth.setColors` → `wallMat.color` | habillage crop (`paroiCouleur`), **LU SUR LE MATÉRIAU** — donc le chemin existe à moitié |
| 19 | Taille de la grille | `params.gridStep` → `terrain.mapUniforms.uGridStep` | ⛔ **AUCUN côté globe — pas de grille dans le nuanceur du crop** |
| 20 | Opacité de la grille | `params.gridOpacity` → `terrain.mapUniforms.uGridOpacity` | ⛔ **AUCUN côté globe** |

Fichiers de départ : `src/plinth.js` (le socle plat, l'ancien),
`src/monde/parois-crop.js` (**les parois du crop, le nouveau — c'est là que ça se
passe**), `src/monde/habillage-crop.js` (le pont des réglages vers le crop),
`src/globe.js` (le nuanceur), `src/ui/map-panel.js` + `src/ui/create-panel.js`
(les curseurs), `src/terrain.js` (le côté bloc plat).

⚠️ **48 et 50 ne sont pas de même nature que 19 et 20, et les confondre te fera
échouer :**
- **48 et 50 pilotent un objet qui EXISTE** (`parois-crop.js` est livré et
  rendu) — il manque le **branchement** du curseur jusqu'à lui, et pour 50 le
  chemin est déjà à moitié là (`paroiCouleur` est lu sur le matériau).
- **19 et 20 pilotent quelque chose qui N'EXISTE PAS** : il n'y a pas une ligne
  de grille dans le nuanceur du globe. C'est une **écriture**, pas un
  rebranchement.

➡️ Fais 48 et 50 **d'abord** : c'est le travail sûr, et il te fait connaître le
chemin `habillage-crop` que 19/20 vont réemprunter.

## POUR LA GRILLE (19, 20) — le précédent qui te sert de patron

R19 vient de rendre vivantes **les courbes de niveau** du crop, exactement le
même genre d'objet : un motif périodique tracé par le fragment. Deux choses de
son rapport te concernent directement :

1. **Les courbes ne mouraient pas là où tout le monde regardait.** Elles
   existaient (`minor` mesuré à **12,26 sur 255**), et se faisaient annuler plus
   loin par un facteur d'atténuation : `minFade = clamp(1,6 − texel×0,55)` avec
   `texel = 3,00` → **exactement zéro**. Correctif : **une ligne**,
   `mix(clamp(...), 1.0, dedansCrop)`.
   ➡️ **Ta grille passera par le même `minFade`.** Vérifie-le avant d'écrire
   quoi que ce soit d'autre, sinon tu écriras une grille parfaite et invisible.
2. **La méthode d'instrumentation qui a marché** : forcer une sortie de débogage
   à chaque étage du nuanceur et la relire **sur une passe brute de `sceneGlobe`,
   HORS du compositeur**. Lu *après* le compositeur, un témoin binaire 0/1
   revenait entre 34 et 128 — donc illisible. Reprends ce protocole.

`intervalleCourbesBloc` est déjà exporté de `habillage-crop.js` **avec sa
conversion écrite** — c'est le modèle à copier pour `gridStep`.

## ⛔ LE DÉFAUT QUI REVIENT NEUF FOIS SUR CE CHANTIER

**La conversion d'unité entre deux espaces.** Neuf occurrences : facteurs
121,6 · 10 · 130,4 · 6, une portée de flou de 1 465 km, des toponymes 1 830 m
sous les Alpes.

`uGridStep` est **un pas au sol** exprimé dans l'espace du bloc
(`TERRAIN_SIZE = 56` unités pour l'emprise entière). Côté globe, l'espace est
celui de `R_GLOBE`. **Une grille dont le pas n'est pas converti donnera un
quadrillage de la bonne allure et de la mauvaise taille** — et ça ne se verra
qu'en comparant à une distance connue.

➡️ **Écris la conversion en commentaire, avec le facteur chiffré.** Et **vérifie
la grille contre une distance connue au sol** (un méridien, une échelle), pas à
l'œil.

## LES RÈGLES DU CHANTIER — dans ce dossier, lis-les

- **D16 / bis / ter** (`regle-D16.md`) — une seule caméra, une seule vue, la vue
  3/4 **n'arrive qu'au bloc**.
- **D17** (`regle-D17.md`) — ⛔ **IL N'Y A PAS DE PRODUCTION.** Le site n'est pas
  en ligne. **N'écris jamais « production rigoureusement inchangée » comme étape
  de fin** : consigne abrogée, elle a fait perdre du temps.
- `lecons-campagne-R.md` — les instruments qui mentent.

## LES PIÈGES DE MESURE QUI ONT DÉJÀ PRODUIT DE FAUX CONSTATS ICI

- **`requestAnimationFrame` ne se déclenche pas dans un panneau qui ne
  composite pas** — un banc a compté « 0 image en 3,7 s ». Patron qui marche :
  `scripts/sonde-demarrage.mjs` (Chrome sans tête).
- **Un condensé 64×40 annule les motifs fins.** ⚠️ **Une grille EST un motif
  fin** : juge-la en pleine résolution, jamais sur une vignette. Un rapport a
  déjà conclu de travers en lisant une vignette réduite.
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité.
- **Un relevé sur UNE image ne prouve rien** si le système oscille : 20 images
  consécutives, et exige la stabilité.
- **Certains curseurs ne valident qu'au relâchement.**
- **La suite de tests peut verrouiller le défaut** : avant de corriger, relis les
  assertions qui bordent la zone.

⚠️ **Règle du chantier, quinze fois sur quinze : si tu trouves que mon départage
est faux, c'est TOI qui as raison.** Mesure, et dis-le.

## L'ATTENDU

1. Les quatre réglages **vivants en mode sphère**, chacun prouvé par un chiffre
   avant/après **sur des pixels à l'écran**, en pleine résolution.
2. **Aucun curseur affiché en mode sphère s'il n'agit pas.**
3. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent de la liste **ne tourne jamais**. Ajoute les tiens,
   puis `npm run audit:tests` — **aucun écart**.
4. `npm test` — **base à battre : 4 422 · 0 échec**.
5. ⚠️ **Scripts d'édition en BINAIRE** (ou `newline='\n'`) : le mode texte de
   Windows met les fichiers en CRLF contre le `.gitattributes` — **c'est déjà
   tombé, deux tests sont morts dessus**.
6. Commits sur `parois-grille`, messages en français.
7. Un rapport `rapport-R22.md` dans ce dossier, avec **la conversion d'unité
   écrite** pour le pas de grille, et une section **« ce que j'ai cru puis
   réfuté »**.

Travaille jusqu'au bout. Ne pose pas de question : tranche, mesure, écris ce que
la mesure a dit.
