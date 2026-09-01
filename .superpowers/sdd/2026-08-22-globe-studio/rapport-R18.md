# RAPPORT R18 — LES OPTIONS DU STUDIO SOUS LE MODE SPHÈRE

> **Arbre** `C:\Dev\wt-stu`, branche `studio-sphere`.
> **Livrable principal** : `.superpowers/sdd/2026-08-22-globe-studio/inventaire-studio-2.md`
> **Traces** : `.banc/R18/` — trois sondes, six passes, 127 options, captures.

---

## 1. LE TABLEAU DE L'ÉTAPE 1, EN RÉSUMÉ

**127 options recensées, mesurées à l'écran option par option.**

| | ✅ marche | ⚠️ à moitié | ⛔ écrit dans le vide |
|---|---|---|---|
| **les 127 du DOM** | **72** | **8** | **47** |
| **les six panneaux demandés** (Carte, Terrain, Fonds, Éléments, Effets, Paramètres) | **68** | **6** | **35** |

Par panneau :

| panneau | ✅ | ⚠️ | ⛔ | total |
|---|---|---|---|---|
| Carte | 4 | 4 | 5 | 13 |
| Terrain | 30 | 0 | 4 | 34 |
| Fonds | 3 | 0 | 0 | 3 |
| Éléments | 18 | 1 | 22 | 41 |
| Effets | 10 | 1 | 2 | 13 |
| Paramètres (Avancé) | 3 | 0 | 2 | 5 |
| *Caméra / Couches / Parcours / Mes créations (hors Studio)* | 4 | 2 | 12 | 18 |

⚠️ **DEUX RÉSERVES SUR CE COMPTE, ET JE LES DIS PARCE QU'ELLES LE GONFLENT.**
Les sept options de « Parcours » sont mesurées **sans aucun tracé GPX chargé** et
trois curseurs de « Couches » avec leur couche éteinte : leur 0,000 ne dit rien
de leur branchement. Ils sont comptés ⛔ parce que la règle est mécanique ; ils
ne sont pas la cible de cette tâche.

## 2. CE QUI M'A DÉTROMPÉ EN COURS DE ROUTE — TROIS FOIS

⛔ **MA PREMIÈRE PASSE DÉCLARAIT 66 OPTIONS MORTES. IL Y EN A 47.** Les
dix-neuf de différence ne sont pas des corrections de code, ce sont **trois
défauts de MESURE**, chacun trouvé parce qu'une observation contredisait un
chiffre. Le détail complet est dans l'inventaire ; l'essentiel :

1. **Une moyenne de boîte annule un motif fin.** « Hauteur des vagues » rendait
   1,45 × le plancher — c'est-à-dire « ne fait rien » — pendant que **deux
   captures côte à côte montrent des crêtes sur toute la nappe**. Grille portée
   de 64 × 40 à **256 × 160**, plus une seconde grandeur : le **gradient** local.
2. **Un curseur qu'on ne lâche jamais ne commite rien.** La sonde n'émettait que
   `input` ; trois curseurs ne commitent qu'au **relâchement** (`change`). Ils
   étaient déclarés morts : re-mesurés, ils rendent **0,188 · 0,191 · 0,184**.
3. **Une remise à l'origine qui n'en était pas une.** Une rangée de chips sans
   chip allumée « revenait » sur la première : la scène est restée de nuit et
   **65 lignes ont été mesurées dans le noir**. La sonde MESURE désormais le
   retour et **recharge la page** quand il n'a pas eu lieu.

⚡ **ET LE MOUVEMENT AMBIANT EST COUPÉ PENDANT LA MESURE.** La scène devient
reproductible **au bit près** : le plancher de bruit tombe de **0,3693 à
0,0000 sur six relevés consécutifs**. ⛔ Corollaire assumé : les options de
MOUVEMENT (vitesses de dérive, vent, mouvements de caméra) rendent zéro par
construction sous ce protocole et sont jugées à la traversée, pas à l'écran.

## 3. CE QUI CONTREDIT LE BRIEF, ET LA MESURE GAGNE

⚡ **« la mer et la matière écrivent dans `realWater` et `terrain`, donc dans le
vide » — CE N'EST PLUS VRAI POUR LA MER.** Sur les douze options de la section
Mer : **dix marchent, une à moitié, une écrit dans le vide.** Transparence du
fond **6,032**, fond marin **2,485**, mer animée **1,685**, couleur de l'eau
**0,694**, givre **0,548**, tranche de verre **0,431**, état de mer **0,334**,
clapot **0,243**, hauteur des vagues **0,140**, réfraction **0,081**. Les tâches
P4 à R2 ont posé le pont : `globe.majReglagesMer({...realWater.reglagesMer})` est
appelé **à chaque image** et LIT les uniformes du socle.

⚡ **Et la MATIÈRE du relief se voit** (**3,561** sur le picker de dix-sept
vignettes) : `terrain.material.color` traverse par `albedoBase`. La **couleur**
d'une matière arrive, sa **texture** non — un ⚠️ déguisé en ✅.

⚡ **LE PAQUET (a) EST PETIT, ET C'EST LA BONNE NOUVELLE DE CETTE TÂCHE.**
`CHAMPS_HABILLAGE` transporte déjà **une cinquantaine de champs** du socle vers
le crop, par image et sur changement. Tout ce qui passe par
`terrain.mapUniforms` et existe dans le nuanceur du globe est **déjà branché**.
Ce n'est pas « beaucoup à rebrancher » : c'est **un pont posé, et une poignée
d'oubliés**.

## 4. LE CLASSEMENT — LES 35 MORTS DES SIX PANNEAUX, EN 2 + 25 + 6 + 2

| paquet | combien | quoi |
|---|---|---|
| **(a) déplacer une écriture** | 2 | **Sommets** (fait), **Couleur de la tranche** (arbitrage de priorité : le préréglage PBR écrase le choix explicite) |
| **(b) transcrire une loi** | 25 | Nuages + Vent (**15**), Appoint + douceur des ombres (**6**), Points cotés (1), Intervalle des courbes (1), SSS (2) |
| **(c) aucun sens sur la sphère** | 6 | Taille / Opacité de la grille, Ombrage des pentes, Ombres + Résolution des ombres, Ombrage auto |
| **(d) traverse et ne se voit pas** | 2 | Reflet du soleil, Speed des effets de surface |

## 5. CE QUE J'AI REBRANCHÉ

### ✅ **Les Sommets reviennent sur la sphère** (paquet a, entier)

`socleAffiche()` répond à « le maillage du bloc **plat** est-il dessiné » — non,
sous la sphère, à toutes les altitudes. Les sommets répondent à la même question
que les boutons du bas et le cartouche : **« sommes-nous devant un bloc »**.

Trois choses, pas une :
- `visibiliteSurface` rend `reperes` (`src/monde/visibilite-surface.js`, §6) ;
- `reperesAffiches()` lit **`globe.baseYCrop != null`** et **jamais
  `veilleSocle`**, qui n'est pas nourrie sous la sphère et resterait fausse pour
  toujours ;
- les marqueurs sont projetés avec **`camGlobe`** et passent par **l'adaptateur
  bloc ↔ globe du dépôt** (`monde/sol-globe.js`) — celui des rivières et des
  toponymes. ⚠️ **Aucune conversion d'unité n'est recopiée** : la loi est
  extraite dans `pointDuMarqueur` et exercée sous node.

**Preuve à l'écran** : ⛔ Overpass est injoignable depuis ce banc (**3 requêtes,
3 échecs**), donc pas de sommet réel. Un sommet **témoin** est posé au centre du
bloc : il atterrit **sur la pente du volcan** (`.banc/R18/sommets-apres.png`,
`translate(640px, 373,6px)`, opacité 1). Avant, la mesure aux deux bouts de
l'interrupteur rendait **0,000 / 0,000**.

### ✅ **Les curseurs morts sont DÉCLARÉS dans l'interface** (étape 5)

Trois notes posées là où l'inventaire a mesuré zéro, chacune avec sa raison
**écrite dans le code** : Nuages + Vent, Appoint + douceur des ombres, Courbes &
grille. ⛔ **On ne retire rien** : ces réglages pilotent toujours le bloc plat
sans le drapeau et voyagent dans les gabarits. Capture :
`.banc/R18/note-nuages.png`.

## 6. LE DÉFAUT UNIQUE QUE JE N'AI PAS RÉPARÉ, ET SA MESURE

⛔ **LES COURBES DE NIVEAU NE SE GRAVENT PAS SUR LES TERRES DU CROP.** Poussé à
bout **par le chemin réel** (pas par une écriture directe sur le globe) :
opacité 1, intervalle forcé, évanouissement de minification neutralisé,
graticule à 1 — **l'écran ne bouge que de 0,014 niveau de gris moyen et aucune
courbe n'apparaît sur la terre** (`.banc/R18/courbes2-reel-1.png`,
`.banc/R18/courbes-graticule1.png`). Les lignes visibles dans la mer viennent du
nuanceur de la mer, pas de ce bloc.

➡️ **C'est UN défaut derrière TROIS curseurs** (16, 17, 18). Régler l'intervalle
avant de l'avoir trouvé, ce serait empiler un réglage sur une panne — et le
brief le dit : *« si une option ne se voit pas, dis-le au lieu de l'empiler »*.

⚠️ **Deux faits utiles pour celui qui le reprendra** : `uContourOpacity` vaut
**0 au repos** (le gabarit d'ouverture éteint les courbes), et
`uContourInterval` du globe vaut **250 m**, calé sur l'amplitude du crop — il ne
lit **pas** la tirette, et la brancher demanderait la conversion bloc → mètres.

## 7. COMMITS

| | |
|---|---|
| `cd83095` | étapes 1 + 3 — l'inventaire des 127 options, et les sommets reviennent sur la sphère |
| `f407744` | étape 2 — le classement, et trois verdicts corrigés par une re-mesure |
| `f6594b6` | étape 5 — les curseurs morts sont déclarés dans l'interface, avec la mesure |

## 8. TESTS

**4 376 tests, 4 376 pass, 0 fail** — `npm test`.
**`npm run audit:tests` : 226 listés · 226 sur disque, aucun écart.**
Base annoncée par le brief : 4 369 / 225. Les sept tests neufs sont
`test/peak-globe.test.js` (5) et les deux ajouts à `test/visibilite-surface.test.js`.

⚠️ **UN TEST EXISTANT A CHANGÉ DE CHIFFRE, ET C'EST LUI QUI M'A ATTRAPÉ.**
`test/fenetre-branchee.test.js` compte les lecteurs de `lireExageration` par
fichier : le poseur des sommets en ajoute un dans `main.js` (6 → 7). C'est
exactement la garde de classe qu'il existe pour tenir — le poseur DOIT lire
l'exagération vivante, sinon les repères se posent à une autre altitude que le
relief qu'ils désignent, au facteur `exagAvant / exagApres`.

## 9. FICHIERS TOUCHÉS

**`src/`** — et je le dis précisément, `main.js` étant partagé :
- `src/main.js` : **trois ajouts, aucune suppression.** ① `reperesAffiches()`
  (nouveau, après `cartoucheAffiche()`) ; ② `poseurDesReperes()` (nouveau,
  juste après) ; ③ l'appel `peaksLayer.update(…)` dans la boucle d'image, qui
  passe désormais la caméra, le prédicat et le poseur.
  ⛔ **Je n'ai touché ni `refreshAerial`/`aerial-layer` ni `poserFondCrop` /
  `CHAMP_FOND` / `segmentsTuile`** — les deux chantiers parallèles.
- `src/peaks.js` : `pointDuMarqueur` (nouveau, exporté), `update()` prend un
  cinquième argument optionnel.
- `src/monde/visibilite-surface.js` : la loi rend `reperes` (§6).
- `src/ui/effects-panel.js`, `src/ui/light-panel.js`, `src/ui/map-panel.js` :
  les trois notes de déclaration.

**tests** : `test/peak-globe.test.js` (neuf), `test/visibilite-surface.test.js`,
`test/fenetre-branchee.test.js`, `package.json` (la ligne `test`).

**outils** (aucun effet sur l'application) : `scripts/sonde-studio-r18.mjs`,
`scripts/cibles-studio-r18.mjs`, `scripts/sonde-uniformes-r18.mjs`,
`scripts/captures-r18.mjs`, `scripts/table-r18.mjs`, `scripts/diag-r18-*.mjs`.

## 10. RÉSERVES

1. ⚠️ **TOUT EST MESURÉ SUR UN SEUL LIEU ET UN SEUL CADRAGE** : La Réunion, z12,
   altitude 18 201 m, heure 15,1. Une option peut être invisible ICI et visible
   ailleurs — c'est précisément le cas de plusieurs ⚠️. Le verdict ⛔ à
   **exactement 0,000** ne souffre pas de cette réserve (l'image est identique au
   bit près) ; les ⚠️ à 0,008-0,046, si.
2. ⛔ **LES SOMMETS NE SONT PAS PROUVÉS SUR DE VRAIES DONNÉES.** Overpass est
   injoignable depuis ce banc. La projection est prouvée (loi sous node + témoin
   à l'écran) ; **la chaîne complète, non.** À rejouer sur une machine qui atteint
   `overpass-api.de`.
3. ⚠️ **« Points cotés » n'est PAS réparé**, et un test le grave pour que
   personne ne croie le contraire. Le prédicat ne suffit pas : c'est de la
   géométrie dans la scène du bloc plat, il lui faut l'adoption de
   `cartouche-globe.js`.
4. ⚠️ **Les notes d'interface sont un choix réversible**, pas une suppression.
   Si Adrien préfère que les curseurs disparaissent, c'est une ligne par bloc.
5. ⚠️ **Le seuil de visibilité (0,06 / 0,12) est étalonné sur DEUX captures**,
   pas sur une étude de perception. Il sépare correctement les deux cas connus ;
   une option qui tombe juste dessous mérite qu'on la regarde plutôt qu'on la
   croie.
6. ⛔ **Je n'ai pas touché au cadran 3D ni aux plans de cinéma**, conformément au
   brief.
