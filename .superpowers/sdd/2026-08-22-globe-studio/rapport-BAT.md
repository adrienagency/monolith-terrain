# RAPPORT BAT — « la bathymétrie a totalement sauté » (2026-09-05)

> **Adrien, mot pour mot :** *« J'ai l'impression que la bathymétrie a encore
> totalement sauté, j'ai des dalles de flou complètes dans la mer ? Ici Minorque,
> mais c'est partout. »*

Arbre `C:\Dev\wt-bat`, branche `bathy-disparue`, base `regroupement` à `4199e52`.
Vite sur `127.0.0.1:10931`. Banc : `scripts/banc-bat.mjs`.

## EN UNE PHRASE

**Le chemin qui peint la bathymétrie est intact. Ce qui a sauté, c'est la
LECTURE du fond à travers la nappe : la fusion EAU (`71fadd0`) a remplacé le lobe
de Blinn-Phong `pow(N·H, uMerBrillance)` par un Beckmann normalisé huit à treize
fois plus faible au pic, et c'est ce lobe qui faisait scintiller la mer sur le
plateau et s'éteindre sur la fosse.** Sans lui il ne reste que la teinte de
profondeur — une bathy z8 agrandie seize fois : « des dalles de flou ».

⚠️ **Le coupable n'est PAS dans `fondMarinTuile` ni dans `bathy.js`** : `wt-tro`
peut continuer sans crainte de collision. La seule ligne touchée est dans
`MER_FRAG` (`src/globe.js`), branche `uMerVraieEau`.

## 1. LA MESURE — trois grandeurs indépendantes (`scripts/banc-bat.mjs`)

Entrée par `modes.flyTo(lat, lon, zoom)` (jamais de lien profond), attente 20 s,
puis :

- **HAUTEURS** : part de texels < 0 dans `t.heights` des tuiles autour du point ;
- **GPU** : la même chose lue sur la texture téléversée (framebuffer) ;
- **ÉCRAN** : sur la capture PNG (seule chose fiable), la zone centrale 60 %
  moyennée par blocs 8×8 (le grain disparaît), puis le **gradient moyen entre
  blocs voisins** (`grad8`). Une mer unie rend ≈ 1,8 ; une mer où le fond se lit
  rend 5 à 7.

Témoin (deux captures sans rien changer, même page) : **1,786 → 1,788**. Le
signal (1,8 ↔ 6,4) est vingt fois le bruit du témoin.

### Minorque, mer au sud de l'île (39,78 / 4,10), avant tout correctif

| commit | z10 grad8 | z12 grad8 | HAUTEURS < 0 | GPU < 0 |
|---|---|---|---|---|
| `6275e62` (RAMP, base présumée saine) | **3,81** | **7,36** | 94 % | 80 % |
| `71fadd0` (EAU, première fusion) | 2,02 | 1,83 | — | — |
| `4199e52` (VIE, tête) | 1,68 | 1,84 | 95 % | 79 % |

**La bathymétrie est là** (80–95 % de texels négatifs dans les tuiles de mer, sur
les hauteurs ET au GPU, à la tête comme à la base). **Elle ne se voit plus** dès
la PREMIÈRE fusion de la nuit : la bissection s'arrête à EAU sans avoir besoin
des cinq autres.

## 2. LA LIGNE — dichotomie dans le nuanceur, A/B dans la même page

Un uniforme temporaire `uBat` (bits) a gardé chaque changement d'EAU seul, les
autres remis à la loi d'avant, Minorque z12, capture A (tout EAU) puis B :

| seul changement d'EAU actif | grad8 |
|---|---|
| cascades de clapot r3/r4 | 5,40 |
| Fresnel de Schlick | 7,18 |
| ciel réfléchi (`mix(col, ciel, fres)`) | 6,38 |
| **Beckmann à la place du lobe `pow(N·H, uMerBrillance)`** | **2,12** |
| lueur sous-surface | 6,79 |
| crête moutonnante | 6,51 |
| tout EAU sauf le remplacement du lobe | 5,05 |
| tout EAU (tête) | 1,80 |

Une seule ligne fait tout l'écart. `uMerVraieEau = 0` dans la même page : 1,82 →
6,49 (la base rend 7,36).

Pourquoi le Beckmann ne remplace pas le lobe : même largeur (~6°) mais pic bien
plus bas — `F(V·H) ≈ 0,02` et le diviseur `4 N·V`. Table (10 m/s, brillance 110) :

| N·V | lobe au pic | Beckmann au pic | rapport | rapport à N·H = 0,99 |
|---|---|---|---|---|
| 0,4 | 0,624 | 0,075 | 8,4 | 3,9 |
| 0,6 | 0,516 | 0,050 | 10,4 | 4,8 |
| 0,8 | 0,501 | 0,037 | 13,4 | 6,2 |

Et ce lobe accroche les pentes des **vagues de côte** (`shoreSurf`, la houle qui
se lève sur le haut fond) : la mer scintille sur le plateau, pas sur la fosse —
c'est exactement le dessin de la bathymétrie que montre la base.

## 3. LE CORRECTIF

`src/globe.js`, `MER_FRAG`, branche `vraieEau` : **le lobe est remis, en plus du
Beckmann** (les deux s'ajoutent ; la traînée du soleil de l'EAU est gardée). Rien
d'autre n'est touché : Fresnel de Schlick, ciel, lueur, crête restent ceux d'EAU.
`uMerVraieEau = 0` reste l'image d'avant au bit.

## 4. LA PREUVE — 3 lieux × surface (z10) et crop (z13) × 8 chargements

Chemin fixe : chargement à froid, `flyTo`, 20 s, capture. « Avant » = tête
`4199e52` (correctif remisé), 2 chargements ; « après » = correctif, 8 chargements.

| lieu | zoom | grad8 AVANT | grad8 APRÈS min / médiane / max (8) | HAUTEURS < 0 | GPU < 0 |
|---|---|---|---|---|---|
| Minorque 39,78 / 4,10 | z10 surface | 2,29 / 1,64 | **3,23 / 3,54 / 3,92** | 94 % | 78–80 % |
| Minorque | z13 crop | 1,88 / 1,88 | **4,91 / 4,99 / 5,05** | 79–82 % | 97–98 % |
| Bretagne 48,70 / −2,00 | z10 surface | 3,39 / 3,96 | 3,01 / 4,09 / 4,52 | 41–45 % | 75–77 % |
| Bretagne | z13 crop | 3,56 / 3,90 | **4,26 / 5,40 / 5,76** | 69–76 % | 60–64 % |
| Rodrigues −19,62 / 63,30 | z10 surface | 1,42 / 1,48 | 1,10 / 1,54 / 1,73 | 96–100 % | 98–99 % |
| Rodrigues | z13 crop | 1,99 | **3,42 / 3,53 / 3,56** | 95–97 % | 99–100 % |

- **Minorque** (le lieu d'Adrien) : ×2 en surface, ×2,7 en crop, les huit
  chargements serrés (4,91–5,05). Capture `.banc/BAT/preuve-apres-minorque-z13-3.png` :
  le plateau scintille, la fosse reste sombre, la côte se lit.
- **Bretagne z10** : pas de recul avant, pas de gain après — à ce cadrage la
  moitié de l'écran est de la terre (41–45 % de texels négatifs), le gradient est
  celui du relief terrestre. Le crop z13, sur l'eau, gagne ×1,4.
- **Rodrigues z10** : inchangé, et c'est **attendu** — plein océan à −4 000 m,
  aucune vague de côte, aucun plateau : il n'y a pas de fond à lire, avant comme
  après. Le crop z13 (au ras de l'île) gagne ×1,8.
- **HAUTEURS et GPU** : inchangés entre avant et après — le correctif ne touche
  pas la donnée, il touche ce qu'on en voit.
- Zéro erreur de page sur les 48 chargements.

## 5. LE TEST QUI MORD — `test/bathy-visible-bat.test.js` (inscrit dans `package.json`, `npm run audit:tests` : aucun écart)

- ① **une tuile bathy PRÉSENTE est peinte** : faux serveur (pas d'index, une
  tuile z8 à −1 000 m), `peindreBathyTuile` rend 8 et 65 536 texels à −1 000,
  `fuseBathymetry` sur terrarium muet rend > 90 % sous −500 m ; la tuile absente
  rend −1 et ne fabrique rien.
- ② la branche `vraieEau` de `MER_FRAG` porte le lobe APRÈS `glitterSoleil`, et
  la branche d'avant garde le sien (deux occurrences).
- ③ la table ci-dessus, recalculée avec les deux lois du dépôt.

**Mutations** : la ligne remise retirée de `src/globe.js` (octets
restaurés ensuite, `cmp` identique) ⇒ ② rouge « le lobe large qui fait lire le
fond y est aussi » ; `return -1` en tête de `peindreBathyTuile` (`src/dem.js`,
restauré de même) ⇒ ① rouge « la tuile z8 servie est celle qui est peinte ».

Suite complète : **5 093 / 5 093** ; les cinq tests du nuanceur de mer (217) verts.

## 6. CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Une fusion a cassé le chemin qui peint la bathymétrie »** (la déduction de
   l'assistant, pas les mots d'Adrien) — non : 80–95 % de texels négatifs dans les
   tuiles de mer, hauteurs et GPU, à la tête. Le chemin `fetchTile →
   fondMarinTuile → peindreBathyTuile → fuseBathymetry` est intact.
2. **« `6275e62` n'est pas forcément sain (LISS, B6, VETO, PLAT) »** — vérifié :
   la base rend 7,36, la tête 1,84 ; le recul est entre les deux, pas avant.
3. **« C'est le spéculaire »** puis **« ce n'est PAS le spéculaire »** : mes deux
   premiers A/B posaient `uMerSoleilFx = 0` et `uMerEcume = 0` par uniforme, et
   concluaient que ni le soleil ni l'écume n'y étaient pour rien. Faux :
   `majReglagesMer` **réécrit ces uniformes à chaque image** depuis le socle
   (`globe.js:7736`, `:7766`), la mutation ne durait pas une image. Un uniforme
   posé à la main n'est une mesure que s'il n'est pas resynchronisé — d'où
   `uBat`, un uniforme que rien ne réécrit.
4. **« Le Beckmann rend quatre fois moins »** — non, huit à treize fois au pic ;
   le premier chiffre venait d'un calcul de tête à N·H = 0,98 (rapport 2,2), pas
   au pic. Le test ③ porte la table calculée, pas l'estimation.
5. **« Le lissage LISS (rayon 5 px à z8) fait les dalles de flou »** — non : il
   est antérieur à `6275e62`, où le fond se lit encore.

## 7. CE QUI RESTE HORS DE CE TICKET

- Le **rectangle gris à bord horizontal** visible à Minorque z10 (capture
  `.banc/BAT/mer-minorque-z10-avant.png`) est aligné sur la grille des tuiles :
  c'est le sujet de `wt-tro` (dalles de sol à zéro), pas celui-ci.
- Les **plaques pâles polygonales** dans la mer (base comme tête) ne sont pas non
  plus de ce ticket.

## FICHIERS

- `src/globe.js` — la ligne remise, commentée avec la mesure.
- `test/bathy-visible-bat.test.js` — inscrit dans `package.json`.
- `scripts/banc-bat.mjs` — le banc (`--ab`, `--lire`, `--detail`).
- `.banc/BAT/` — captures et journaux (`preuve-avant.log`, `preuve-apres.log`), git-ignoré.
