# B3 — CORRECTEUR : rendre la bathymétrie juste, partout, jusqu'au sol

Arbre : `C:\Dev\wt-bat3` · branche `bathy-correctif`. Serveur : port libre **> 6200**.
**Lis d'abord, dans ce dossier** : `socle-bathy.md`, puis **`rapport-B1.md`
(l'audit et TON BARÈME) et `rapport-B2.md` (les sources et le prototype lac)**.
Ce sont tes deux cahiers des charges. ⚠️ Le socle porte **deux hypothèses de ma
part que B1 a réfutées** — la version qui fait foi est celle de B1.

## LA DEMANDE

> **Adrien :** *« Contrôle complet de la bathymétrie, qui semble en erreur depuis
> le passage au mode sphère. Fais en sorte que toute la zone sous-marine soit le
> plus juste possible. Si tu peux, ajoute une source de bathymétrie des lacs si
> ça n'implique pas de refondre totalement le relief des tuiles existantes.
> **Note minimale 7,5 / 10.** »*

## CE QUE B1 A ÉTABLI — le vrai défaut, et il n'est pas celui qu'on croyait

⚡ **Au repos, le globe et le crop sont d'accord** : erreur moyenne **496,5 m**
contre **488,0 m** — 8,5 m d'écart. Le terrarium AWS **porte de l'ETOPO1 jusqu'à
z10** ; le globe ne sert donc pas de l'eau plate. ⛔ **N'écris pas de correctif
fondé sur « le globe montre du terrarium mort ».**

⛔ **LE DÉFAUT EST UNE FALAISE À z11.** Même point, même session, fosse de la
Sonde : **z10 → −7 067,6 m ; z11 → 0,0 m.** Le terrarium cesse de décrire la mer
au-delà de z10, et **le globe n'a rien pour prendre le relais** — écart
globe/crop **7 105 m**. Idem mer Noire (2 200 m) et Méditerranée.
⚠️ **Le coupable n'est PAS Mapterhorn** : le zéro arrive à z11, sur une tuile de
256 px, donc **encore AWS**. Un correctif visant Mapterhorn laisserait z11 cassé.

⛔ **LE GLOBE NE DEMANDE JAMAIS `/data/bathy/`** : 189 requêtes de tuiles
d'altitude, **0** vers la bathymétrie ; au compteur `fetch` sur 54 s, **544
contre 0**. Le crop, lui, les demande (`/data/bathy/10/516/342.png → 200` en
Manche). ⚠️ **Nuance qui m'a piégé** : `flux-terrain.js` **importe bien**
`fuseBathymetry`, mais ses deux appelants sont **la fenêtre bornée et le champ de
la mer** — pas les tuiles du globe. Vérifie-le avant d'agir.

**La couverture réelle** (`public/data/bathy/index.json`, 136 octets) : **GEBCO
z8 mondial**, **EMODnet z10 sur la seule France métropolitaine**. **BlueTopo et
Copernicus sont catalogués, crédités, testés — et jamais cuits.** Et
`npm run deploy` **n'appelle jamais `build:bathytiles`**.

**Caspienne** : **−29 m dès z8** (aplat de remplissage de la source fine),
1 024 m d'erreur **deux zooms plus tôt** que le reste.

**Lacs** : ni trou ni terre — **le niveau de la surface, à ±7 m, à tous les
zooms, sur les deux chemins**. Étendue 9×9 = **0,00 m partout** : ⚡ **il n'y a
aucun relief existant à écraser, la condition d'Adrien est remplie et mesurée.**

## CE QUE B2 A ÉTABLI — les lacs, prêts à poser

**swissBATHY3D (swisstopo)** : **2 m**, 22 lacs suisses, **licence commerciale
explicite**, **3,22 Mo** de tuiles z9→z14. Prototype : fond du Léman lu à
**310,05 m contre 309,70 m** de référence CIPEL (**0,11 %**), point le plus bas
retrouvé à la position documentée sans qu'on la lui donne.

⛔ **LES QUATRE CHOSES QUI CASSERAIENT, toutes vérifiées à l'exécution par B2** :
1. **Rien ne se passerait** : `dem.js:495` appelle `fuseBathymetry(data, seaData)`
   **sans options** → `seaLevel = 0` → le Léman, à +372 m, est classé **TERRE**.
2. **`normalizeIndex` jette `waterLevelM`** — liste blanche de 7 champs. Le
   fichier serait juste, le code juste, et le nombre n'arriverait jamais.
3. **Le tuileur marin ne peut pas cuire un lac d'altitude** :
   `raw = m == null || m >= 0 ? 0 : m` aplatit tout pixel positif → `anySea`
   faux → tuile jetée.
4. ⛔ **Le plus grave** : sans sentinelle, écrire 0 hors du lac **détruit
   347,67 m de vallée du Rhône** (l'exutoire de Genève est sous la cote du lac).
   Correctif mesuré : écrire **`nappe + 1 m`** hors du lac → écart terre
   **0,0000 m**.

Les scripts de B2 sont dans `scripts/` (`build-lake-tiles.mjs`,
`pivot-swissbathy3d.mjs`, `controle-lac-b2.mjs`, `bathy-zones-lacs.b2.json`).

## TON BARÈME — B1 l'a écrit, le noteur B4 s'en servira tel quel

| # | critère | seuil acquis | pts |
|---|---|---|---|
| 1 | fond en approche (Java z11, lu **au GPU**) | **≤ −6 000 m** (auj. 0,0) | 2,5 |
| 2 | accord globe/crop (mer Noire, 3 altitudes) | **≤ 200 m** aux trois (auj. 2 200) | 2,0 |
| 3 | relief, pas aplat (étendue 9×9) | **≥ 5 m** sur Java z11, mer Noire z11 **et** z12 | 1,5 |
| 4 | cascade vivante sur le globe | **≥ 1** requête `/data/bathy/` dans les **3** zones | 1,5 |
| 5 | mers fermées + Caspienne | Caspienne ≤ −800 m ; Médit. et mer Noire ≤ 300 m **à z11 et z12, crop compris** | 1,0 |
| 6 | lacs | Baïkal **et** Léman **≥ 100 m sous la surface** | 0,5 |
| 7 | rien payé ailleurs | `npm test` **4 748 · 0**, audit sans écart, Manche z10 à **−68 ± 5 m** | 1,0 |

⛔ **Règles du barème** : mesure **au GPU uniquement** (`t.heights` est relâché) ·
valide **à z11 ET z12** · « le globe = le crop » ne suffit pas au critère 5 (le
crop rend **0 m** dans la plaine ionienne) · **le critère 7 est éliminatoire
au-dessus de 6,5**. **Adrien exige 7,5 minimum.**

## L'ORDRE DES CORRECTIFS — il compte, et ce dépôt l'a déjà payé

Mesuré ici : desserrer un budget avant de réduire ce qui entre donne **×14 de
requêtes**. Ordre proposé, à confirmer par ta mesure :
1. **La falaise z11** (critère 1, 2,5 pts) — la plus grosse. Fais descendre la
   cascade `/data/bathy/` sur le chemin du globe, avec `overzoomTile` depuis le
   plafond de la zone comme le fait déjà `loadBathyPatch`.
2. **La cascade sur le globe** (critère 4) — elle tombe souvent avec ①.
3. **Caspienne et mers fermées** (critère 5).
4. **Les lacs** (critère 6) — le plus petit poids, le plus gros risque : les
   quatre casses de B2.
5. **Le relief, pas l'aplat** (critère 3) — vérifie-le à chaque étape.

⚠️ **Le critère 7 se vérifie à CHAQUE étape, pas à la fin.** Une régression
ailleurs annule tout.

## PIÈGES — chacun a produit un faux constat ici

- **Lis la hauteur telle que le GPU la tient** (patron `scripts/sonde-r36.mjs`
  et `scripts/sonde-b1.mjs`). ⛔ `gl.getError()` peut rendre **0** sur un défaut
  majeur : une console propre ne prouve rien.
- ⛔ **La table de vérité de B1 donne des PROFONDEURS, pas des altitudes de fond** :
  le lit du Léman est à **+63 m**, pas −310. B1 a failli inverser sa conclusion.
- **Le pixel n'est déterministe qu'en orbite** ; ailleurs, A/B dans la même session.
- **Vite doit écouter sur `--host 127.0.0.1`**, sinon `[::1]` seul.
- **Le voile d'accueil avale les gestes** ; la pose de démarrage arrive après un
  **vol de 8,3 s** ; le globe tourne seul à ~2 °/s.
- **Un banc différentiel ne distingue pas « rien n'a changé » de « tout est cassé
  pareil »** — lis la console à chaque recompilation.
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**

## L'ATTENDU

1. **Les sept critères, chacun avec sa mesure avant/après**, au GPU, à z11 et z12.
2. **Ta note estimée sur 10**, honnêtement calculée — le noteur B4 la refera.
3. Les **7 tests rouges de B1** (`node --test test/attaque-b1-ROUGE.mjs`,
   serveur sur 6311) : **ton travail est fini quand ils passent.**
4. Des tests à toi, inscrits dans `package.json` (liste explicite),
   `npm run audit:tests` sans écart, `npm test` **≥ 4 748 · 0**.
5. Si `build:bathytiles` doit entrer dans `npm run deploy`, **dis-le et fais-le**.
6. ⚠️ Scripts d'édition **en binaire**, et **relis l'octet écrit** (`grep | cat -A`).
7. Commits sur `bathy-correctif`, messages en français. `rapport-B3.md`
   (`git add -f`), avec **« ce que j'ai cru puis réfuté »**.

**Aucun autre agent ne tourne : `globe.js`, `dem.js`, `bathy.js` sont à toi.**
Ne pose pas de question : mesure, tranche, corrige.
