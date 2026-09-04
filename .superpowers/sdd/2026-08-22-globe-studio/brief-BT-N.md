# BT-N — NOTEUR : BlueTopo mérite-t-il 7,5 sur 10 ?

Arbre : `C:\Dev\wt-bt3` · branche `bluetopo-note`. Commence par
`git merge regroupement`. Serveur : port **> 7100**, `--host 127.0.0.1`.
Données : `find public/data/bathy/8 -type f | wc -l` → 13 891 ;
`find public/data/bathy/13 -type f | wc -l` doit être **> 0** (les tuiles
BlueTopo cuites par BT-I) — ⚠️ `find public/data/bathy` sans sous-dossier rend 0.

## ⛔ TON RÔLE : TU NOTES, TU NE CORRIGES RIEN, ET TU DOIS POUVOIR DIRE NON

> **Adrien :** *« Tu peux lancer l'intégration de BlueTopo avec des sous-agents. »*
> Note minimale **7,5 / 10**. Une note de complaisance est un échec de ta tâche.
> `git diff -- src/` reste **vide**.

## CE QUE TU LIS

`rapport-BT-A.md` — l'audit d'AVANT et **LE BARÈME que tu appliques** (7 critères,
C7 **éliminatoire**), avec ses tests rouges `test/attaque-bt-ROUGE.mjs` ;
`rapport-BT-I.md` — ce que l'intégrateur affirme ; `rapport-B4.md` et
`rapport-B5.md` — la campagne bathymétrie qui vient d'obtenir 9,33/10, et le
zéro lossy du terrarium (0 ± 0,5 m, des deux côtés du signe) ; `socle-bathy.md`
(⚠️ il porte deux hypothèses du coordinateur réfutées depuis).

## ⛔ L'ARBITRAGE AVANT LA NOTE — c'est le cœur de ta tâche

BT-I déclare **BT-2, BT-7 et la moitié de BT-4 « réfutés sur la donnée source »**,
et BT-1 à **0,687 pour un seuil de 0,70**. Un correcteur qui déclare le barème
faux peut avoir raison — B3 l'a eu sur deux seuils, et le noteur B4 l'a validé
avec une source **hors du dépôt**. Il peut aussi déplacer le seuil vers là où
son correctif marche. **Ta première tâche est de trancher, critère par
critère, avec une mesure indépendante :**
- **BT-2 (fond dégelé entre z11 et z13, ≥ 1 m aux deux points)** : BT-I dit
  que la donnée source ne bouge pas entre ces niveaux à cet endroit. Vérifie
  **dans le GeoTIFF BlueTopo lui-même** (`scripts/recon-bluetopo.mjs` sait le
  lire), pas dans nos tuiles : si la dalle 4 m est plate là, le seuil visait
  un point plat et BT-I a raison ; si elle ne l'est pas, c'est la cuisson.
- **BT-4 (pente des plateaux ≥ 2 m/km ×4)** : même méthode, sur les quatre points.
- **BT-7 (lacs)** : BT-I a corrigé le tuileur pour les lacs d'altitude (il
  rendait zéro tuile sans erreur) et cuit Érié et Michigan à z10. Mesure Érié
  au GPU : sous la nappe, ou toujours +174 ?
- **BT-1 (0,687 contre 0,70)** : BT-I a établi que cuire en 512 px **baisse** le
  rapport (0,857 → 0,667) — l'instrument mesure aussi la taille de tuile.
  Décide si 0,687 est « à 2 % du seuil » ou « un instrument qui ne mesure pas
  ce qu'il croit », et dis-le. Un barème partiel est permis **si tu écris la
  règle de partage**.

⚠️ **Une chose que BT-I a corrigée peut avoir déplacé le zéro pour tout le
monde** : l'arrondi au mètre inconditionnel du tuileur. Vérifie que la France
(fr-metro), le Léman et la Manche (**−72 ± 5 m**) sont identiques au bit — BT-I
dit **21 960 tuiles identiques, SHA-256 par tuile** ; refais l'empreinte sur un
échantillon que **tu** choisis, pas le sien.

## TU REMESURES TOUT — aucun chiffre recopié

Au GPU (`scripts/sonde-b1.mjs`, `sonde-bt-a.mjs`), **z11, z12 et z13**, en
**pente par kilomètre** et **rapport d'étendue z12→z13** (la profondeur moyenne
est déjà à 6 m, ce n'est pas le sujet) — en **divisant par le pixel réel** (256
contre 512). Les cinq témoins hors USA. Puis **des points hors barème** :
Galveston, Cape Cod, les Keys, Mobile Bay, San Francisco (⚠️ Puget Sound n'est
pas dans BlueTopo — BT-I l'a remplacé par NCEI : mesure ce remplacement à
part, c'est une **autre source**, avec sa propre licence à vérifier).

**Anti-triche** : `git diff` de `test/attaque-bt-ROUGE.mjs` (verdir un test en
le modifiant = fraude, à dire en premier) ; aucune coordonnée du barème câblée
dans `src/` ; le poids annoncé (**21,17 Mo**) recompté sur le disque ;
`build:bathytiles` **absent** de `npm run deploy`.

## PIÈGES

`gl.getError()` peut rendre 0 sur un défaut majeur · le pixel n'est
déterministe qu'en orbite (A/B en session ailleurs) · **des tableaux d'un pixel
ne déclenchent jamais `detectFillLevels`/`detectNoiseFill`** (BT-I s'y est fait
prendre, B2 l'avait écrit trois rapports plus haut) · **Vite sur
`--host 127.0.0.1`** · les boucles d'attente actives affament SwiftShader ·
⛔ **ne rends JAMAIS la main « en attendant » un banc** · ⛔ **ne tue jamais
tous les `chrome.exe` de la machine** — seulement les sans-tête que tu as
lancés (GE3 a fermé le Chrome d'Adrien).

## L'ATTENDU

1. **L'arbitrage des quatre critères contestés**, tranché avec une mesure sur la
   donnée source, et la règle de partage écrite.
2. **La note critère par critère**, avec **ta** mesure, le seuil, le total ; si
   < 7,5, **ce qui manque**, classé par points gagnables.
3. **La non-régression remesurée** (échantillon d'empreintes à toi, Manche,
   témoins, `npm test` ≥ 4 797 · 0, `audit:tests` 257 = 257).
4. **Les écarts avec les chiffres de BT-I**, et lequel des deux bancs tu crois.
5. **Les arbitrages qui reviennent à Adrien** : l'étendue (21 Mo aujourd'hui ;
   92 / 273 / 959 Mo selon le choix), le remplacement NCEI pour Puget Sound
   (licence), les 233 dalles de 16 m du large que `SHELF` jette.
6. `git diff -- src/` **vide**, `rapport-BT-N.md` (`git add -f`).

**Note honnêtement. Un 6 argumenté vaut plus qu'un 7,5 de complaisance.**
