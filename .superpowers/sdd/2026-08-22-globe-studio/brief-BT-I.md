# BT-I — INTÉGRATEUR : cuire BlueTopo et le brancher dans la cascade

Arbre : `C:\Dev\wt-bt2` · branche `bluetopo-integration`. Serveur : port **> 6600**.
**Lis d'abord** `socle-bathy.md`, puis **`rapport-B2.md`** (la recherche de
sources, la procédure de cuisson d'une source fine, les quatre casses), **`rapport-B3.md`**
(l'intégration du Léman et de la Caspienne, faite la nuit dernière — **ton
patron**) et **`rapport-B4.md`** (la notation, 9,33/10).

## LA DEMANDE

> **Adrien :** *« Tu peux lancer l'intégration de BlueTopo avec des sous-agents. »*

**BlueTopo** (NOAA Office of Coast Survey) : **2 à 16 m** sur les eaux
américaines, contre **464 m** pour GEBCO. **Déjà déclarée** dans
`src/bathy-sources.js` — `resolutionM: 16`, **licence CC0-1.0**, crédit écrit,
plafond visé **z12**. **Il ne manque que les tuiles.** Le S3 est public, sans
compte. **Le téléchargement est AUTORISÉ** — Adrien a écrit « tu as les mains
libres, ne me demande pas de validation », et c'est de la donnée du domaine
public américain.

## ① LA RECONNAISSANCE D'ABORD — c'est le vrai risque

⚠️ **B2 a relevé que l'index gpkg de BlueTopo est HORODATÉ : « tout chemin figé
pourrira ».** Ta première tâche est donc de **lire l'index vivant** et d'écrire
un script qui le relit à chaque cuisson, **jamais une URL en dur**.

Établis, avant de télécharger quoi que ce soit : la structure du bucket, le
format et le système de coordonnées des dalles, la **couverture réelle**
(BlueTopo est **trouée** — c'est structurel, `bathy-sources.js` le dit :
*« une source fine est TOUJOURS trouée »*), le **poids total**, et ce que tu
peux prendre en premier. ⚡ **Ne télécharge pas tout** : commence par **une
région d'essai** — la **baie de Chesapeake** est le meilleur candidat (B1
l'avait sondée, le contraste avec GEBCO y est maximal).

## ② LA CUISSON — réutilise, ne réécris pas

`scripts/build-bathy-tiles.mjs` existe et sait cuire. B2 a écrit
`scripts/build-lake-tiles.mjs` pour swissBATHY3D. **Regarde d'abord si l'un des
deux fait déjà le travail** avec une option ; n'écris un troisième cuiseur que
si tu peux dire pourquoi.

⛔ **LE FILTRE QUI A DÉJÀ COÛTÉ UNE PLAINE ENTIÈRE** : `SHELF = −500` —
le tuileur **n'écrit pas les tuiles sans plateau**. B3 a découvert que les
tuiles purement abyssales n'avaient **jamais été cuites** (la plaine ionienne
rendait 0 m). Vérifie ce que ce filtre fait de tes dalles BlueTopo **avant** de
lancer la cuisson complète, et dis-le.

## ③ LE BRANCHEMENT — quatre choses qui ont cassé la dernière fois

B2 les a toutes vérifiées à l'exécution sur le Léman. Les tiennes seront
différentes (BlueTopo est **marin**, pas un lac d'altitude), mais **le motif se
répète** :
1. **`normalizeIndex` a une liste blanche de champs** — tout champ nouveau est
   jeté en silence. Le fichier serait juste, le code juste, et le nombre
   n'arriverait jamais.
2. **Un plafond de zone ne peut jamais descendre sous le socle**
   (`normalizeIndex` le relève d'office).
3. **La descente niveau par niveau existe déjà** (`loadBathyPatch` jusqu'à
   `BATHY_ZMIN`) : relever un plafond de 8 à 12 n'ajoute que des essais devant
   un chemin qui marche. **Ne réécris pas la descente.**
4. **Le crédit est obligatoire** : `creditsForBounds` doit rendre le crédit
   BlueTopo sur les emprises couvertes. L'entrée existe déjà dans `SOURCES` —
   **vérifie qu'elle sort à l'écran**, ne le suppose pas.

⚡ **Et la garantie structurelle à ne pas casser** : `fuseBathymetry` rend le
relief terrarium tel quel dès que le pixel est émergé — *« la source marine ne
peut que creuser sous le niveau, jamais émerger »*. **Changer de source marine
ne peut pas déplacer un rivage d'un pixel.** C'est la leçon des polders, payée
une session entière. **Mesure-le, ne le promets pas.**

## ④ LE DÉPLOIEMENT

B3 a fait entrer `build:bathyindex` dans `npm run deploy`. **`build:bathytiles`
n'y est toujours pas.** Si ta cuisson doit en faire partie, dis-le et fais-le —
et **chiffre le poids ajouté au site** (le Léman a coûté 3,22 Mo pour 404
tuiles ; BlueTopo couvre un littoral entier).

## PIÈGES — chacun a produit un faux constat ici

- **Lis au GPU** (`scripts/sonde-b1.mjs`, `sonde-r36.mjs`) ; `gl.getError()`
  peut rendre **0** sur un défaut majeur.
- **Ne compare pas des tuiles de tailles différentes** : à z11 le globe sert du
  **256 px**, le damier du **512**. B3 a cru à ×1,7–2 d'excès de relief avant de
  comprendre qu'il mesurait la tuile.
- **`find public/data/bathy` rend 0** — `find` ne suit pas les jonctions
  Windows. Utilise `find public/data/bathy/8`, qui doit rendre **13 891**.
- **Vite doit écouter sur `--host 127.0.0.1`**, sinon `[::1]` seul.
- ⛔ **Ne rends JAMAIS la main « en attendant » un téléchargement ou un banc** :
  attends dans la même exécution, sinon tu ne reprends jamais.

## L'ATTENDU

1. **La reconnaissance ①** : structure, couverture, poids, et le script qui
   **relit l'index vivant**.
2. **Chesapeake cuit et branché**, avec **avant/après au GPU à z11, z12, z13** et
   la **pente par kilomètre** — c'est la résolution qui est le sujet, pas
   seulement la profondeur moyenne.
3. **Le verdict sur `SHELF`** appliqué à BlueTopo.
4. **La preuve qu'aucun rivage n'a bougé d'un pixel**, et que les zones non
   couvertes (Europe, France, Léman) sont **identiques au bit**.
5. **Le poids ajouté**, et l'extension possible au reste du littoral américain
   avec son coût.
6. Tests inscrits dans `package.json` (liste explicite), `audit:tests` sans
   écart, `npm test` **≥ 4 755 · 0**.
7. ⚠️ Scripts d'édition **en binaire**, et **relis l'octet écrit**
   (`grep | cat -A`). Commits en français, `rapport-BT-I.md` (`git add -f`),
   avec **« ce que j'ai cru puis réfuté »**.

⚠️ **Un attaquant mesure l'état d'avant en parallèle** dans `C:\Dev\wt-bt1` et
écrit le barème sur lequel tu seras noté (**7,5/10 minimum**). **Ne lui parle
pas, ne lis pas sa branche.** Ne pose pas de question : reconnais, cuis,
branche, mesure.
