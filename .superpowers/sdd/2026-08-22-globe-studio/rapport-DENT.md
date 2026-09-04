# RAPPORT DENT — LA MESURE LÉGUÉE EST PRISE : **MER2 EST ACQUITTÉ**

**Arbre** `C:\Dev\wt-dent` · branche `mer-dents` · serveur `127.0.0.1:9433`.
`npm test` **4 931 · 0** (4 929 avant, +2 : ⑰a et ⑰b) · `audit:tests`
**265 listés = 265 sur disque, aucun écart**.

## LES LIGNES QUE JE TOUCHE — pour `wt-b6`, `wt-porte`, `wt-cn3`

- ⛔ **`src/` : AUCUNE LIGNE.** `git diff -- src/` est **vide**. Je ne livre ni
  correctif de nuanceur ni changement d'emprise — le § ① dit pourquoi.
- `test/mer-sphere.test.js` : **ajout** de ⑰a et ⑰b, juste avant ⑯d. Aucun test
  existant modifié, aucun fichier de test neuf (`audit:tests` inchangé).
- `scripts/sonde-dent.mjs`, `scripts/dent-anneaux.mjs`,
  `scripts/dent-ab-discard.mjs`, `scripts/dent-vues-discard.mjs`,
  `scripts/dent-champ-troue.mjs`, `scripts/dent-coin-rouge.mjs`,
  `scripts/dent-molette.mjs` — sondes neuves, rejouables.
- ⚡ **À `wt-b6` en particulier** : je ne touche pas à `bathy.js`. Mais le § ⑤
  te concerne — le seul défaut que j'aie reproduit n'est **ni** le champ **ni**
  le bord de la mer.

---

## ① LA MESURE QUE VID A LÉGUÉE — PRISE, DEDANS, ET ELLE DISCULPE MER2

> **VID :** *« la boîte englobante de la calotte contre celle des parois, à
> Rodrigues, à 32 849 m. Si le ratio est < 1, MER2 est coupable. »*
> ⚠️ Son piège : *« `_mer` repasse à `null` dès qu'on quitte le crop. »*

**La pose est celle de la vidéo au bit près** — `uCropDemi = 0,000732421875`,
`uCropCentre = (0,676025390625 ; 0,555908203125)`, altitude **32 849 m**,
`_merEtat.compte = {sommets 4 225, triangles 8 192, pas 64, portée 3,
emprise 1}` — c'est-à-dire **exactement** les chiffres que VID a lus dans la
session vivante d'Adrien. Relevé **dedans**, dans la même évaluation que la
pose (`scripts/sonde-dent.mjs`, `.banc/DENT/AVANT.json`).

| grandeur | relevé |
|---|---|
| boîte englobante horizontale de la **calotte** (4 225 premiers sommets) | **0,90553** unité de scène |
| boîte englobante horizontale des **parois** | **0,94843** |
| ⚡ **le ratio de VID** | **0,9548** |

### ⛔ ET LE RATIO DE VID EST PIÉGEUX — je le dis avant de m'en servir

**La boîte des parois n'est PAS l'arête du socle.** Le solide porte un
chanfrein, un arrondi et une jupe qui pend : sa boîte englobante déborde
l'arête haute par construction. Un ratio de 0,95 ne dit donc pas « la nappe est
rentrée de 5 % » — il dit « les parois sont plus larges que leur propre arête ».
**Prise seule, cette mesure aurait fait condamner MER2 à tort.**

### LA MESURE QUI TRANCHE VRAIMENT — ANNEAU CONTRE ANNEAU, PAR SECTEUR

`scripts/dent-anneaux.mjs` compare les deux **contours**, pas les deux boîtes :
l'anneau de la calotte (`|u| = emprise` ou `|v| = emprise` dans `aCrop`, relu
dans le tampon donc **au repos**) contre l'anneau haut de `_parois`, tous deux
transformés par `matrixWorld`, puis **72 secteurs angulaires**.

| lieu (z11, crop actif) | manque relatif du bord de la nappe vs arête |
|---|---|
| **Rodrigues, 32 849 m** (la pose de la vidéo) | médian **+0,21 %** · min **−1,30 %** · max **+1,00 %** — 72/72 secteurs |
| **La Réunion, 26 000 m** | médian **+0,21 %** · min **−6,10 %** · max **+1,02 %** — 59 secteurs |

Le demi-côté vaut **0,4329 unité de scène** et couvre **≈ 430 px** à l'écran à
ce cadrage : **+0,21 % = 0,9 px**, et le pire secteur vaut **4,3 px**. Le
critère du brief — *« écart entre le bord de la nappe et l'arête du socle
≤ 1 px »* — **est tenu au médian, sur les deux lieux, sans rien corriger**.

Et le signe compte : le **min est NÉGATIF** aux deux lieux, c'est-à-dire que
dans certains secteurs la nappe va **au-delà** de l'arête relevée. Une nappe
« bien trop petite » ne fait pas ça.

➡️ ⚡ **VERDICT : la nappe COUVRE le socle. MER2 (`emprise = 1`) n'est pas la
cause du bassin d'Adrien.** J'ai donc, comme VID l'ordonnait,
**⛔ NE PAS TOUCHÉ `EMPRISE_MER_CROP`** — et je recommande à qui me lira de ne
pas le toucher non plus sans refaire cette mesure-ci, pas celle des boîtes.

---

## ② LES DEUX SYMPTÔMES, CHIFFRÉS SÉPARÉMENT — ET LE SECOND NE SE REPRODUIT PAS

| symptôme | chiffre | cause |
|---|---|---|
| ① **la nappe ne rejoint plus les parois** | **+0,21 % du demi-côté (0,9 px)**, min négatif | ⛔ **ne se reproduit pas** — la nappe rejoint l'arête |
| ② **le bord est crénelé** | **aucune denture mesurable** au-dessus du bruit de houle : résidu pic-à-creux moyen **2,5 à 4,0 px** sur la silhouette, sur un bord que la houle fait bouger de plusieurs pixels par image | ⛔ **ne se reproduit pas** à la pose de la vidéo |

⚠️ **ET JE DIS LA LIMITE DE ② PLUTÔT QUE DE MAQUILLER UN ZÉRO** : à ce cadrage
la nappe couvre **838 340 px sur 1 024 000**, ses bords **sortent de l'écran**
sur trois côtés, et la mesure « pic-à-creux » y porte donc surtout sur le
liseré d'écume. Elle est **honnête sur l'ordre de grandeur** (pas de créneaux
de dizaines de pixels comme sur `z_019`), **pas** sur un « 0 exact ».

**La capture de la pose est dans `.banc/DENT/vues/AVANT-32849.png`** : Rodrigues,
vue de trois quarts, **la mer couvre le bloc d'un bord à l'autre, le bord est
franc, aucune encoche**. C'est la même pose que `z_019` et `f_033`.

---

## ③ ⚡ COMMENT PRENDRE LA POSE DE LA VIDÉO — le piège qui m'a coûté quatre tours

> ⛔ **`gotoCtl.go('-19.7253, 63.3691')` NE MET PAS À LA POSE D'ADRIEN, et rien
> ne le dit à l'écran.** Il atterrit au **zoom fin** : `uCropDemi` y vaut
> **0,00002288818359375**, soit **32 fois plus serré** que la vidéo
> (0,000732421875). L'altitude, elle, a l'air juste — j'ai relevé
> **32 962 m avec le mauvais crop** et failli publier la mesure dessus.

Et on n'en sort pas à la molette :

- `porter()` (poser la caméra par script) change `altitudeCadrageM` sans bouger
  `uCropDemi` **d'un bit**, et la boucle de zoom **ramène** la caméra ensuite ;
- ⚡ **`sortie-molette.js` exige TROIS crans en MOINS D'UNE SECONDE**
  (`FENETRE_SORTIE_MS = 1000`). Mes crans étaient espacés de 1 200 ms : **14
  crans arrière, altitude figée à 1 585,947 m**, `uCropDemi` inchangé. C'est
  exactement le relevé que VID attribuait à la base d'avant — **il se produit
  aussi sur `regroupement` dès qu'on scrolle trop lentement**, et ce n'est pas
  un bug, c'est la confirmation d'intention de SORTIE qui fait son travail.
  ⛔ **Ne conclus pas « la molette ne sort pas » sans avoir serré l'intervalle.**
- signe mesuré, pas supposé : `deltaY = +120` **dézoome**, `−120` zoome.

➡️ **LA SEULE ENTRÉE QUI MARCHE, ET ELLE EST EXACTE :**

```js
await __exp.modes.flyTo(-19.7253, 63.3691, 11)   // → uCropDemi = 0,000732421875
```

`modes.flyTo(lat, lon, zoom)` rend **le crop de la vidéo au bit près**. C'est le
chemin de `gotoCtl.go`, mais avec le zoom d'Adrien au lieu du zoom
d'atterrissage. **Toutes mes sondes passent par là.**

---

## ④ CE QUE J'AI CRU, PUIS RÉFUTÉ — cinq pistes payées

1. ⛔ **« La bande grise au bord lointain du bloc, c'est la nappe qui n'atteint
   pas l'arête. »** **Faux, et c'est la mesure du § ① qui me l'a dit, pas l'œil.**
   Les deux contours coïncident à 0,21 %. Cette bande grise est la **terre
   estompée autour du crop**, pas le dessus du bloc. J'ai bâti `dent-anneaux.mjs`
   pour ça, et j'aurais « corrigé » une emprise qui n'a rien.
2. ⛔ **« Un trou de bathymétrie fait un trou dans la nappe. »** Le raisonnement
   était bon (`brut` est un `Float32Array` neuf → **zéro** → `profondeur = 0` →
   `if (profondeur <= 0.0) discard`), **et la mesure l'a réfuté** : champ mis
   **entièrement à zéro** dans la texture vivante
   (`.banc/DENT/troue/toutZero.png`) — la nappe **ne disparaît pas**, elle
   devient **turquoise pâle**. ⚡ **Et ce turquoise pâle est EXACTEMENT la
   couleur de l'eau dans `z_019` et `f_033`** : la session d'Adrien avait donc
   très probablement un **champ de mer vide ou quasi vide** (le défaut « champ
   cuit VIDE » signalé par MER §8 / MER2 §8). **C'est le meilleur indice que je
   laisse, et je ne l'ai pas prouvé.**
3. ⛔ **« Le champ vaut 50 % de terre dans l'emprise. »** **Artefact
   d'indexation** : la texture est **RG demi-flottant**, donc **stride 2**. Lue
   au stride 4 elle rend `8 321 / 16 641`, soit exactement la moitié + 1 — un
   damier qui n'existe pas. Relue au bon pas : **4,3 % de terre** (l'île),
   **0 texel exactement nul**, fond le plus bas **−0,1024**. Le champ est sain.
4. ⛔ **« La molette ne sort pas du crop sur cette branche. »** **Faux** : mes
   crans étaient trop espacés (§ ③). J'allais le rapporter comme une régression
   de SORTIE.
5. ⛔ **« La distance horizontale, c'est `hypot(x, z)`. »** **Non — douzième et
   treizième occurrence du piège des trois espaces.** Le bloc est à
   `(84,1 ; −33,7 ; 42,2)` sur une sphère de rayon 100 : la verticale locale
   n'est pas `Y` du monde. Mon premier anneau rendait un **rayon min de 0,0014
   pour un rayon max de 0,889** — un carré qui passerait par son propre centre.
   La décomposition se fait sur `up = normalize(centre − centre du globe)`,
   et **le facteur est écrit en commentaire dans la sonde**.
   Variante du même piège, payée juste après : l'anneau haut des parois pris à
   un **seuil en Y** ne ramasse que **9 points sur 1 020** et rend un socle
   **rond**. L'anneau suit le RELIEF (Tâche P11, 18,94 m le long de l'anneau) :
   il faut la moitié haute, pas le sommet.

---

## ⑤ LE SEUL DÉFAUT QUE J'AIE REPRODUIT — ET IL N'EST NI LE CHAMP NI LE BORD

À **La Réunion, z11, 26 000 m, vue oblique** (`.banc/DENT/pour-adrien/
REUNION-26000.png`), un **coin triangulaire ROUGE** s'ouvre sur le flanc
sud-est : la paroi y est visible **par-dessus l'eau**. C'est, en petit, ce
qu'Adrien filme — et c'est le secteur où le profil du § ① rend son **−6,10 %**.

**A/B par RETRAIT DE LIGNE, dans la même page, sur le nuanceur vivant**
(`scripts/dent-vues-discard.mjs`) — on retire une ligne, on recompile, on
regarde :

| variante | le coin rouge |
|---|---|
| référence | présent |
| `if (profondeur <= 0.0) discard;` **retiré** | **toujours présent** |
| `if (bord <= 0.0) discard;` **retiré** | **toujours présent** |

➡️ ⚡ **Ce n'est donc NI le champ de bathymétrie (wt-b6), NI le bord de la mer
(D24/MER2).** Aucun fragment n'y est rejeté : **il n'y a pas de géométrie de mer
à cet endroit-là, ou l'arête y passe au-dessus d'elle.** Les deux candidats qui
restent, et que je n'ai pas départagés :

- l'**arête du socle** y monte au-dessus du niveau d'eau (relevé : l'anneau haut
  des parois est en moyenne **0,00157 unité de scène SOUS** la nappe, mais c'est
  une moyenne — localement il peut la percer) ;
- la **superellipse** de la nappe (`uCropCoin = 0,08`, `uCropCoinN = 4,4`,
  rentrée de `RETRAIT_EAU_CROP`) coupe le coin **plus court** que le solide des
  parois, qui prend la même forme mais **sans** ce retrait.

⛔ **Je ne tranche pas, et je ne corrige pas à l'aveugle** — c'est précisément
l'instruction que VID m'a laissée et que le § ① vient de justifier. Mon A/B de
hauteur (`scripts/dent-coin-rouge.mjs`, monter la nappe de 0,002 puis 0,01) a
été **invalidé par la dérive de cadrage** : la boucle de zoom repose la caméra
entre deux captures, et les trois images ne sont pas comparables. **Le prochain
agent doit geler le cadrage avant de rejouer cette sonde** — c'est le seul pas
qui manque, et il est petit.

---

## ⑥ LES TESTS — ⑰a ET ⑰b, ET ILS MORDENT

Inscrits dans `test/mer-sphere.test.js`, **déjà dans la liste explicite de
`package.json`** : `audit:tests` **265 = 265**, aucun fichier neuf.
`npm test` **4 931 · 0**.

Ils ferment **l'erreur que le § ① vient d'éviter, et que le prochain agent fera
s'il n'est pas retenu** : voyant « la nappe ne couvre plus », élargir l'emprise
ou déplacer le bord en le faisant dépendre de la houle.

| test | ce qu'il ferme |
|---|---|
| **⑰a** | le bord DESSINÉ est posé par `bordDeMer()` **seul** — il ne prend aucun argument, il vaut **exactement** `−RETRAIT_EAU_CROP`, et il tombe **dans** le crop |
| **⑰b** | la bande d'extinction est **contenue** dans la nappe : sur **cent bandes balayées jusqu'au plafond de 0,5 demi-côté**, la houle est éteinte **exactement** au bord (coupe plate) et la mer est intacte **exactement** avant la bande (le large ne bouge pas) |

**Deux mutations rejouées, `src/` seul, tests inchangés :**

| mutation | rouges |
|---|---|
| `bordDeMer(bande)` fait dépendre le bord de la bande | **⑰a** (⑯a-f restent vertes : aucune ne le couvrait) |
| `Math.min(0.5, …)` → `Math.max(0.5, …)` dans `bandeHouleBord` | **⑰b**, ⑯b, ⑯f |

⚠️ **Et ⑰b a rougi sur son propre premier jet, deux fois** : la marge « juste
avant la bande » doit être prise sur la bande **effective** (`max(bande, 1e-7)`)
— à bande nulle un `1e-9` tombe dans le plancher et rend **0,0003** au lieu de
1 — et « la bande commence strictement avant le bord » est **faux à bande
nulle** (la mer d'huile). **C'est le balayage qui l'a dit, pas l'algèbre.**

---

## ⑦ CE QUE JE NE RENDS PAS — le gain de MER2 est intact par construction

- ⛔ **0 pixel de mer au-delà de l'arête** : `git diff -- src/` est **vide**,
  donc le chiffre de MER2 tient **au bit près**. Je n'ai rien à re-mesurer,
  et je ne prétends pas l'avoir re-mesuré.
- ⛔ **`emprise = 1`, `portee = 3`, `pas = 64`, 4 225 sommets / 8 192
  triangles** : relevés vivants à Rodrigues et à La Réunion, **inchangés**.
  Aucun retour en arrière sur les −84 % de sommets.
- ⛔ **La mer au large** : inchangée pour la même raison. Les captures
  `.banc/DENT/pour-adrien/` et `.banc/DENT/vues/` sont donc des captures
  **d'état**, pas un avant/après — **il n'y a pas d'après**, et le dire est plus
  utile que de livrer deux images identiques sous deux noms.

## ⑧ À DONNER AUX AUTRES

- ⚡ **`modes.flyTo(lat, lon, 11)` est la façon de reproduire la vidéo d'Adrien.**
  `gotoCtl.go` ne l'est pas. Écris-le dans ta recette.
- ⚡ **Le ratio de boîtes englobantes ne mesure pas « la nappe contre l'arête ».**
  Utilise `dent-anneaux.mjs` : profil radial par secteur, sur la verticale
  **locale**.
- **`dent-vues-discard.mjs` est générique** : il retire une ligne d'un nuanceur
  vivant, recompile et capture. Il répond à « qui mange ces pixels ? » sans
  toucher au dépôt.
- **À `wt-b6`** : le coin rouge du § ⑤ **survit au retrait du `discard` de
  terre**. Si tu cherchais à te l'attribuer, la mesure dit non.
