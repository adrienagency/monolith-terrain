# PLAN DE FUSION — la campagne R

> **Adrien, 2026-08-23 :** *« Quand tu auras fini tu mergeras toutes les
> avancées. »*

⚠️ **Ce fichier est la carte de secours.** S'il y a coupure, il dit où est chaque
travail et comment le recoudre — les branches, elles, survivent dans git.

---

## L'ÉTAT DES BRANCHES

**Base commune : `d366a40`** (`regroupement`, après la fusion de la première
vague : repos + boutons + dalles + mer).

| tâche | branche | arbre | état |
|---|---|---|---|
| R9 — imagerie satellite | `satellite-crop` | `C:\Dev\wt-sat` | livré, **en relecture** |
| R4 — saut de pose caméra + surcouche sombre | *(sur `regroupement`)* | `C:\Dev\wt-merge` | en cours |
| R6 — la planète plus jamais nue (D15) | `planete-eclairee` | `C:\Dev\wt-nue` | en cours |
| R5 — trait de côte en escalier | `cote-crop` | `C:\Dev\wt-cote2` | en cours |
| R7 — l'heure du jour des deux côtés | `jour-nuit` | `C:\Dev\wt-jn2` | en cours |
| R8 — le chargement qui ne s'arrête pas | — | — | enquête |

⚠️ **R4 travaille DIRECTEMENT sur `regroupement`** dans l'arbre principal : il n'y
a rien à fusionner pour lui, mais **il faut fusionner les autres PAR-DESSUS son
travail**, pas l'inverse.

---

## L'ORDRE DE FUSION, ET IL N'EST PAS ARBITRAIRE

Trois des cinq touchent le nuanceur de `src/globe.js`. **Fusionner du plus
structurant au plus local** limite les conflits à des ajouts, pas à des
réécritures.

1. **R6 (`planete-eclairee`)** — ⚠️ **EN PREMIER.** Il déplace les sept
   interrupteurs de style hors de la chaîne du crop : c'est le changement le plus
   structurant du lot, et les autres doivent atterrir sur son état, pas l'inverse.
2. **R7 (`jour-nuit`)** — l'éclairage, juste après R6 qui l'a réorganisé.
   ⚠️ **Si R7 signale que jour/nuit passe par les mêmes interrupteurs que R6,
   c'est le SEUL cas où l'ordre est à revoir** : fusionner R7 d'abord et laisser
   R6 s'y adapter.
3. **R5 (`cote-crop`)** — le champ de la mer, local à `_cuireChampMer`.
4. **R9 (`satellite-crop`)** — **quatre insertions purement ADDITIVES** déclarées
   par son rapport (uniformes fragment après `uHazeColor`, `this.uniforms` après
   `uContourWeight`, bloc fragment entre `albedoCrop` et « LA COUCHE APPARENCE »,
   `poserHabillage`/`retirerHabillage`). ⚠️ **Le plus tolérant du lot — donc le
   dernier**, il se posera sur ce que les autres auront laissé.

---

## LE CONFLIT CERTAIN, ET SA RÉSOLUTION

⚠️ **`package.json`, la ligne `test`, à CHAQUE fusion.** C'est une **liste
explicite de fichiers**, pas un glob : un test absent de la liste **ne tourne
jamais**. Ce défaut a déjà frappé ce dépôt.

**Résolution : l'UNION, jamais un choix de camp.** Le script est écrit et
vérifié :
`C:\Users\adrie\AppData\Local\Temp\claude\G--My-Drive--GITHUB\ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0\scratchpad\fusion-test-line.py`
Il prend le fichier en argument, fait l'union dans l'ordre, et **échoue
bruyamment si un fichier est perdu**.

⛔ **Après CHAQUE fusion : `npm run audit:tests`**, qui compare la liste au
contenu du disque. Un écart = un test qui ne tourne pas.

---

## LA VÉRIFICATION DE FIN — non négociable

1. `npm test` — **base à battre : 4 195 · 0 échec** (avant R9)
2. `npm run audit:tests` — **aucun écart**
3. ⚠️ **DRAPEAU BAISSÉ, LA PRODUCTION DOIT ÊTRE RIGOUREUSEMENT INCHANGÉE.**
   C'est la garantie que tout ce chantier a tenue, et la barre est haute :
   la Tâche P2 a tenu **0 pixel d'écart sur 1 024 000**, trois chargements,
   `git stash` à l'appui.
4. **À L'ÉCRAN, drapeau levé**, et **comparé aux 39 images d'Adrien**
   (`…/scratchpad/video/t01.jpg` … `t39.jpg`). ⚠️ **C'est le seul juge** : elles
   sont l'état AVANT de cette campagne.
5. **Un agent noteur** sur l'état fusionné, protocole `brief-noteur.md`.

⚠️ **Le panneau navigateur de session ne composite pas toujours** — un banc a
compté « 0 image en 3,7 s ». **Un Chrome sans tête capture l'image composée**
quel que soit `preserveDrawingBuffer` ; patron dans `scripts/sonde-demarrage.mjs`.

---

## CE QUI RESTE OUVERT APRÈS LA FUSION — à ne pas oublier

- **le voile gris** : **nommé** (le rideau d'eau, `vJupe > 0`, 163 des 164 pixels
  peints hors silhouette), **pas corrigé** — sa géométrie relève d'un autre
  périmètre ;
- **le crédit d'orthophoto faux en PRODUCTION** (sans drapeau) — défaut
  préexistant, **laissé exprès à l'arbitrage d'Adrien** ;
- **le bouton ciné éteint** sous le drapeau : le danger est réglé, la
  fonctionnalité manque (`shots` est nourri de `terrain.sample`) ;
- **les couches vectorielles** (plans d'eau, rivières, étiquettes) ne suivent pas
  sur le crop ;
- **37 tuiles hors crop** venant de `demanderEmprise` (anneau de marge + nappe de
  mer) — refus assumé faute de budget de vérification visuelle au bord ;
- **`uAerialCoastFade` non porté** : au large, photo pleine côté globe là où le
  socle estompe. **Écart non mesuré.**
