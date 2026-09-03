# R36 — LE GLOBE EST DÉCOUPÉ EN BANDES DE LATITUDE DÉCALÉES

Arbre : `C:\Dev\wt-band` · branche `bandes-globe` (partie de `regroupement`,
**4 745 · 0**, audit 251 = 251). Serveur : port libre **> 5800**.
**Lis d'abord** `plan-fusion.md` (l'état courant et le reste ouvert), puis
`lecons-campagne-R.md` (dont la rétractation finale).

## LE DÉFAUT — Adrien l'a vu, capture à l'appui

> *« Il semble y avoir un sacré problème d'alignement. »*

En vue orbitale sur la Terre entière, le globe est coupé en **bandes
horizontales suivant les latitudes**, et le contenu de chaque bande est
**décalé en longitude** par rapport à la bande voisine : un trait de côte entre
en haut d'une bande et ressort ailleurs en bas. Sur sa capture, l'Afrique est
tranchée ; sur la mienne, la côte d'Amérique du Sud est coupée net.

⚠️ **C'est une RÉGRESSION récente** : une capture que j'ai prise moi-même dans
la nuit du 1ᵉʳ au 2 septembre, à 5 795 km au-dessus de l'océan Indien, montrait
Madagascar et les zones de fracture de la dorsale **sans une seule bande**.

## LA REPRODUCTION — exacte, elle marche à tous les coups

Chrome sans tête (le panneau de session ne composite pas toujours), puis :
```js
document.querySelectorAll('.ce-hubveil,.ce-elemwrap').forEach(n => n.remove())
const e = window.__exp, c = e.controls, m = e.modes
m.enterOrbit(); await attendre(4000)
c.target.set(0, 0, 0)
c.object.position.normalize().multiplyScalar(260)   // ≈ 10 194 km
c.update(); m.orbAlt = m.orbAltTarget = 160
await attendre(9000)                                 // laisser les tuiles arriver
```
⚠️ **Vite doit écouter sur `--host 127.0.0.1`** — sans ça il n'écoute que sur
`[::1]` et la sonde ne dessine jamais (piège relevé par R35).

## ⛔ CE QUI EST DÉJÀ INNOCENTÉ — ne le remesure pas

| suspect | test | verdict |
|---|---|---|
| **matrices figées** (PF4 bis) | `?matrices=amont` — vérifié appliqué : **230 maillages sur 230** en `matrixAutoUpdate`, groupe et scène compris | ⛔ **bandes toujours là** |
| **matériau partagé** (PF4 bis) | `?tuiles=amont` — 0 matériau partagé | ⛔ **bandes toujours là** |
| **les nuages** | `params.cloudsEnabled = false` + groupe invisible | ⛔ **les bandes deviennent PLUS nettes** |
| le régime de rampe **par tuile** | lecture : `uReliefBas`, `uLandMax`, `uHeightPivot`, `uHeightContrast`, `uRecollage` sont **partagés**, pas par tuile | ⛔ écarté |

**Les bandes sont solidaires de la SPHÈRE, pas de l'écran** : elles suivent les
lignes de latitude et s'inclinent avec le globe. Donc géométrie, indices de
tuile ou UV — pas un effet en espace écran.

## LES SUSPECTS, PAR ORDRE — et ce ne sont que des hypothèses

**Sur ce chantier, l'exécutant qui mesurait a eu raison contre le coordinateur
vingt fois sur vingt.** Si tu établis que je me trompe partout, dis-le **avec le
chiffre**, en premier.

1. **PF2 — la priorité des tuiles** (`globe.js` : `_traverse`, `_request`,
   « sphère grasse du parent », boîte orientée, cache souple, décodage en
   **Worker**). ⚠️ **Le décodage terrarium déplacé dans un Worker est le
   changement le plus dangereux du lot** : une tuile décodée avec le mauvais
   `(z, x, y)`, ou une réponse appariée à la mauvaise requête, produit
   exactement ça — la bonne géométrie avec la mauvaise donnée. **Commence par
   là** : vérifie que la hauteur décodée correspond au `(z, x, y)` demandé, pour
   chaque tuile visible, en recalculant une hauteur connue (un sommet, une fosse).
2. **R28 / R31 — la colorisation** (`style-monde` `91ca80f`, `echelle-rampe`
   `f37a1ff`) : peigne de crêtes recalculé depuis `uTex` avec **une lecture de
   texture de plus**, budget du fond marin global, recollage des échelles.
3. **R32 — le pivot** : la translation rigide bouge caméra **et** cible ; si un
   calcul de tuile lit la cible au lieu de la caméra, l'ancrage dérive.

## LA MÉTHODE QUI TRANCHE — bissection, pas raisonnement

Les points de bissection sont prêts, tous sur `regroupement` (premier parent) :
`91ca80f` (après style-monde) · `b3b4821` (après attaque-camera) ·
`f37a1ff` (après echelle-rampe) · `651d951` (après sortie-crop) ·
puis les fusions PF1/PF4/R32/PF2/PF4bis/PF3/R35 de la nuit du 2 au 3.

⛔ **Ne bissecte pas à l'œil sur une capture floue** : un condensé annule les
motifs fins, et un rapport de ce dépôt a déjà conclu de travers en lisant une
vignette. **Écris un critère automatique** — par exemple : sur une colonne de
pixels traversant plusieurs bandes, la dérivée verticale de la teinte doit être
continue ; ou mesure le **décalage en longitude** entre deux bandes en
retrouvant un même trait de côte. Ce critère doit rendre un nombre, et **valoir
zéro sur la capture propre du 1ᵉʳ septembre**.

## LES INSTRUMENTS QUI MENTENT — chacun a produit un faux constat ici

- **Le pixel n'est déterministe qu'en orbite** — c'est ton cas, tant mieux ;
  ailleurs, A/B **dans la même session** (mer, nuages, caustiques déphasés).
- **Un banc différentiel ne distingue pas « rien n'a changé » de « tout est
  cassé pareil »** — lis la console à chaque recompilation de nuanceur.
- **Le globe tourne tout seul** à ~2 °/s après 3 s : gèle-le ou soustrais-le.
- **La pose de démarrage arrive après un vol de 8,3 s**, précédé de 5 s
  d'immobilité : « stable » ≠ « final ».
- **Une sonde dans `controls.update` lit trop tôt** ; relève **au rendu**.
- ⛔ **Ne rends jamais la main « en attendant » un banc** — attends dans la même
  exécution, sinon tu ne reprends jamais.

## L'ATTENDU

1. **Le critère automatique**, avec sa valeur sur l'état actuel et sur le
   dernier commit propre.
2. **Le commit fautif nommé**, par bissection.
3. **La cause à la ligne**, et le correctif **à la source**.
4. **Avant/après** : la mesure du décalage à trois altitudes orbitales
   (2 000 / 10 000 / 30 000 km) et sur deux lieux (Afrique, Amérique du Sud).
5. **Un test qui échoue sans le correctif.** ⚠️ `package.json` porte une **liste
   explicite** — `npm run audit:tests`, aucun écart. `npm test` : base
   **4 745 · 0**.
6. ⚠️ **Scripts d'édition en binaire**, et **relis l'octet écrit**
   (`grep | cat -A`) : quatre incidents en une nuit (`\b` → 0x08, `\n` réel).
7. Commits sur `bandes-globe`, messages en français. `rapport-R36.md`
   (`git add -f`), avec **« ce que j'ai cru puis réfuté »** — elle n'a jamais
   été vide.

**Aucun autre agent ne tourne : `globe.js` et `modes.js` sont à toi.**
Ne pose pas de question : reproduis, bissecte, trace, corrige, mesure.
