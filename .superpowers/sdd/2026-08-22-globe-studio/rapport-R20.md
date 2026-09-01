# R20 — rendre les nuages au mode sphère

Arbre `C:\Dev\wt-nua`, branche `nuages-globe`. Reprise après l'interruption
réseau du premier agent : **sa trouvaille tient, je l'ai reproduite avant de
bâtir dessus.**

---

## Étape 1 — sa mesure, reproduite

Sonde inchangée (`scripts/diag-r20-coquille.mjs`), trace `.banc/R20/verif/` :

| altitude | `uFade` | écart moyen | écart de gradient |
|---|---|---|---|
| **18 km** *(le défaut)* | **0,0000** | **0,000** | **0,000** |
| **1 200 km** | **0,0020** | **0,000** | **0,000** |
| 6 371 km | 1,0000 | 8,156 | 1,739 |
| 19 113 km | 1,0000 | 3,045 | 1,072 |
| 44 597 km | 1,0000 | 0,682 | 0,366 |
| 57 339 km | 1,0000 | 0,426 | 0,255 |

Les six lignes retombent au millième près sur son relevé. **Sa trouvaille est
confirmée.**

---

## Étape 2 — la voie prise, et pourquoi

### La voie 1 est morte à la mesure, pas à l'argument

La garde qui met `uFade` à zéro porte un commentaire d'intention — *« clouds are
a planet-view feature — fade out as the camera dives so the final approach stays
crisp »*. **Un commentaire n'est pas une mesure.** Je l'ai levée
(`scripts/diag-r20-voie1.mjs`, `.banc/R20/diag-voie1.json`) :

| ce qu'on mesure | valeur |
|---|---|
| altitude de la coquille au-dessus du rayon | **95 565 m** — la ligne de Kármán |
| un texel de sa texture 512 × 256, à l'équateur | **78 184 m** |
| altitude caméra du relevé | 36 691 m |
| **écart à l'écran, `uFade` FORCÉ à 1, vue de surface** | **0,000 / 0,000** |

**Ce n'est pas un fondu qui cache la coquille à 18 km, c'est la géométrie** :
elle est 59 km au-dessus d'une caméra qui regarde le sol, donc hors champ. Lever
la garde ne change rien, au bit près. Et même dans le cadre, un texel de 78 km
ne peut pas dessiner un cumulus de 1 km. **La garde protège bien quelque chose :
l'approche finale.**

### La voie 3 est déjà écrite — donc la voie 2 la rend gratuite

Le brief pensait la troisième « la plus chère ». **Le fondu qu'elle demande
existe déjà** : c'est `uFade`, relevé sur quatorze distances
(`.banc/R20/diag-deux-systemes.json`) — 0 jusqu'à 1 147 km, montée de 1 274 km
(0,011) à 3 186 km (1,000), 1 au-delà. **Les deux systèmes ne se disputent
aucune altitude.**

➡️ **Voie 2 : `clouds2` change de parent et reçoit la similitude du crop.** La
voie 3 tombe dedans sans une ligne de fondu à écrire. **Pas de troisième
système.**

---

## Étape 3 — le test rouge

`test/nuages-globe.test.js` — 20 tests. À l'écriture : **15 verts** (la loi que
le prédécesseur avait déjà écrite), **5 rouges** (le câblage manquant).

⛔ **Et son en-tête était faux d'un facteur deux, dans sa propre classe de
défaut.** Il annonçait « 6 595 m quand on croit l'exagération, 13 190 si on
l'oublie ». **Exécutée**, `altitudeNuageM(13,5)` rend **3 297,2 m** à
`exageration = 2` et **6 594,3 m** à `exageration = 1`. Le rapport était bon,
les deux valeurs étaient doublées. Corrigé, et un test vérifie désormais que
**le quotient des deux hauteurs vaut exactement l'exagération**.

⚡ **Et la garde de CLASSE de `visibilite-surface.test.js` a fait son travail** :
rebrancher le lecteur sans toucher au compte a fait rougir **cinq** tests d'un
coup. Troisième redistribution déclarée, après D16-b et D16-c.

---

## Étape 4 — les quinze curseurs

Base de mesure : les défauts **plus un plafond au-dessus du relief**
(`cloudAltitude` 16, `cloudAltSpread` 0,12, `cloudOpacity` 1,4). Sans ça on
mesure quinze fois le plancher — le ciel par défaut à La Réunion z12 est quasi
vide **dans les deux modes** (cible : 4 grappes, plafond 13,5 avec étalement
0,97 = à hauteur de sommet, le relief montant à 8,87 unités de bloc).

Plancher de bruit vérifié à **0,0000** avant chaque campagne. Capture après
chacun : `.banc/R20/curseurs/`.

| # | curseur | écart moyen | gradient | verdict |
|---|---|---|---|---|
| 1 | Interrupteur | 0,0338 | 0,0361 | ✅ |
| 2 | Opacité | 0,0354 | 0,0347 | ✅ |
| 3 | Trouées (`cloudCoverage`) | 0,0342 | 0,0360 | ✅ |
| 4 | Altitude | 0,0611 | 0,0636 | ✅ |
| 5 | Luminosité | 0,0432 | 0,0309 | ✅ |
| 6 | Étalement | 0,0640 | 0,0725 | ✅ |
| 7 | Bourgeonnement | 0,0029 | 0,0055 | ✅ (faible) |
| 8 | Coton (`cloudTexMix`) | 0,0097 | 0,0146 | ✅ |
| 9 | Grain (`cloudScale`) | 0,0054 | 0,0087 | ✅ |
| 10 | Contraste | 0,0329 | 0,0411 | ✅ |
| 11 | Translucidité | 0,0857 | 0,0488 | ✅ |
| 12 | Direction du vent | 0,1461 | 0,1198 | ✅ |
| 13 | Force du vent | **0,000** | **0,000** | ⚠️ voir ci-dessous |
| 14 | Vitesse de dérive | **0,000** | **0,000** | ⚠️ voir ci-dessous |
| 15 | Variation de dérive | **0,000** | **0,000** | ⛔ **MORT** |

⚠️ **Les trois derniers sont des curseurs de MOUVEMENT, et le banc coupe le
mouvement pour descendre son plancher à 0,0000. Ils valent zéro PAR
CONSTRUCTION.** Mouvement remis, l'image bouge de 0,95 d'une capture à l'autre —
mer, soleil, faune — et leur signal s'y noie (0,847/0,963 · 0,951/0,950 ·
0,982/0,915 : du bruit, pas un verdict).

⚡ **Mesurés sur les entités elles-mêmes** — déplacement sur 3 s, 20 nuages,
`.banc/R20/cout/diag-vent.json` :

| curseur | déplacement bas | déplacement haut | rapport |
|---|---|---|---|
| `windSpeed` 0,1 → 6 | 0,0618 | 2,6218 | **×42,4** ✅ |
| `cloudDrift` 0,05 → 2 | 0,0920 | 2,0375 | **×22,2** ✅ |
| `cloudDriftVar` 0 → 1 | 0,6715 | 0,6681 | **×0,99** ⛔ |

⛔ **`cloudDriftVar` EST MORT, et je le dis au lieu de l'empiler.** Il est
déclaré dans `params`, sauvegardé dans les templates, servi dans le panneau —
et **aucune ligne de `clouds2.js` ni de `clouds-sim.js` ne le lit**
(`grep -rn cloudDriftVar src/` : trois occurrences, aucune de lecture).
⚠️ **La moyenne ne suffisait pas à le juger** : il porte la VARIANCE, à laquelle
une moyenne est aveugle. C'est la **dispersion** qui tranche — 0,4972 contre
0,4941, ×0,99. Il est **déclaré dans `src/ui/effects-panel.js`** avec sa mesure,
pas retiré (`templates-user.js` le sérialise).

**Bilan : 14 sur 15 marchent, 1 est mort et déclaré.**

---

## Étape 5 — les unités

⚡ **La conversion n'est écrite qu'UNE FOIS : c'est l'homothétie du groupe.** Le
volume continue de vivre, de se peupler, de dériver et de se dessiner **en
unités de bloc**. Pas quinze conversions, pas de constante recopiée dans le
nuanceur, aucun réglage sauvegardé à ré-échelonner.

| ce qu'on écrit | plafond du ciel | boîte la plus haute |
|---|---|---|
| ⛔ la valeur de bloc telle quelle en unités de globe | **860 085 m** | **942 577 m** |
| ✅ la valeur de bloc × `k` | **6 594 m** | **7 227 m** |

`1/k` = **130,43** à La Réunion, et dépasse 3 700 aux zooms continentaux.

**La seule grandeur qui traverse dans l'autre sens est la position de la
caméra** — le nuanceur lance son rayon depuis l'œil. `uCamBloc` remplace
`cameraPosition` aux **quatre** endroits du nuanceur, `vLocalPos` remplace
`vWorldPos`, et **le tri arrière→avant reçoit le même espace** (sinon il devient
muet et deux nuages transparents laissent une couture).

⚡ **Recoupement indépendant, à l'exécution** : la caméra du globe convertie
donne `[88,4922 · 74,5172 · 88,4922]`, celle du bloc plat vaut
`[88,4922 · 72,7193 · 88,4922]`. **x et z identiques à quatre décimales.**
Multiplier au lieu de diviser donnerait 0,0059.

---

## Étape 6 — le coût, pesé en FRAGMENTS

⛔ **Le banc CPU de ce dépôt ne pèse pas les fragments** : ×35 de fragments donne
×0,96 de temps par image (`diag-charge-fragment.mjs`, R6). Y mesurer un effet
volumétrique, ce serait mesurer zéro par construction.

⚡ **J'ai donc utilisé `EXT_disjoint_timer_query_webgl2`** — la minuterie du
pilote, qui compte le temps passé DANS le GPU. Elle est disponible ici :
*ANGLE (NVIDIA GeForce RTX 3080, Direct3D11)*. Le témoin de disjonction est
vérifié à chaque bloc ; tout relevé disjoint est jeté.

**Témoin de validité — la minuterie voit-elle les fragments ?** Surface de rendu
variée à nombre d'appels de dessin CONSTANT :

| mégapixels | ms par image |
|---|---|
| 0,064 | 0,2659 |
| 1,024 | 0,3954 |
| 16,384 | 3,2288 |

**×16 de fragments ⇒ ×8,2 de temps.** Contre ×35 ⇒ ×0,96 pour le banc CPU.
**Cette minuterie-là pèse les fragments ; l'autre non.**

**Le coût du ciel**, 1 280 × 800, médiane de 5 blocs de 40 images :

| | ms par image |
|---|---|
| avec les nuages | **0,4001** |
| sans | **0,2750** |
| avec, deuxième passage *(reproductibilité)* | **0,4001** |

➡️ **+0,125 ms par image, soit +45 % du temps GPU de la scène**, sur une RTX
3080 à 1,02 Mpx, avec 20 boîtes et **12,1 pas de marche en moyenne** (min 8, max
26). La surface couverte, boîtes peintes en rouge franc, vaut **1,597** d'écart
moyen — de l'ordre de **1 % de l'écran**.

⚠️ **Réserve** : sur une machine de bas palier, le coût est fragmentaire, donc
il suit la surface couverte. Un ciel qui remplirait 20 % de l'écran coûterait
~20× ce relevé. Le garde-fou de remplissage de `clouds2` (6 à 10 pas quand la
caméra est dans le nuage) est ce qui l'empêche, et il n'a **pas** été éprouvé
ici : la campagne s'est faite à une seule altitude de caméra.

---

## Étape 7 — à l'écran

`.banc/R20/curseurs/altitude-*.png`

| altitude | mode | volume | `uFade` coquille | ce qu'on voit |
|---|---|---|---|---|
| **18 km** *(le défaut)* | surface | **visible** | 0,0000 | **trois bouffées blanches au-dessus du crop** — première fois |
| 1 200 km | orbital | éteint | 0,0020 | ni l'un ni l'autre — la relève n'a pas commencé |
| **12 742 km** *(globe entier)* | orbital | éteint | 1,0000 | **les bandes de la coquille sur l'océan Indien et l'Afrique** |

⚠️ **La bande 1 147 → 1 274 km reste sans nuages** : le volume s'éteint avec la
vue de surface, la coquille ne s'allume qu'à 1 274 km. C'est une réserve, pas
une régression — c'était déjà le cas avant, et ce n'est visible qu'en orbite
basse.

---

## Ce qui a été mesuré et qui n'était pas demandé

⛔ **Le ciel par défaut est quasi vide à La Réunion z12, ET IL L'EST AUTANT EN
MODE PLAT.** Sonde par étapes du nuanceur, même réglage, les deux modes
(`.banc/R20/diag-cmp.json`) :

| étape | sphère | plat |
|---|---|---|
| boîtes peintes en rouge | 1,588 | 1,581 |
| après `boxSpan` | 1,588 | 1,581 |
| après l'occlusion du relief | 1,588 | 1,581 |

**0,4 % d'écart : le relogement est géométriquement exact.** Ce qui reste — un
ciel clairsemé aux réglages d'usine — est **une propriété du peuplement et de la
tirette d'étalement, identique dans les deux modes**, pas un défaut de sphère.
➡️ **Réglage, pas rendu.** Ce n'est pas dans le périmètre de R20 et je ne l'ai
pas touché.

## Deux pièges d'instrument, tous deux miens

① **`setVisible(false)` de sonde ne tient pas une image.** `majNuagesGlobe`
réapplique la visibilité à chaque image, comme le cartouche. Ma première mesure
de présence rendait 0,000 parce que l'extinction était annulée avant la capture.
**Il faut couper `params.cloudsEnabled`.**

② **J'ai poussé `cloudCoverage` dans le mauvais sens.** Le nuanceur l'écrit :
« 0 = masses pleines, 0.8 = dentelle trouée ». À 2,6, en croyant rendre le ciel
franc, je l'effaçais — et je mesurais alors 0,0001 des deux côtés. La compétence
`shibu-clouds` prévenait exactement de ça.

⛔ **Et le piège n° 1 de la compétence m'a coûté une exécution de banc** : un
backtick dans un commentaire GLSL termine le template literal. La page ne démarre
plus, et l'erreur lue est *« Unexpected identifier 'k' »*. Note posée au-dessus
du nuanceur pour le suivant.

---

## Tests

`npm test` : **4 432 / 4 432, 0 échec** (base 4 412 — +20 de R20).
`npm run audit:tests` : **229 listés · 229 sur disque, aucun écart.**

## Fichiers touchés

| fichier | ce qui change |
|---|---|
| `src/monde/nuages-globe.js` | §0 bis (voie 1 morte), §0 ter (voie choisie), correction du facteur deux |
| `src/monde/visibilite-surface.js` | verdict `nuages`, non borné (§7) |
| `src/clouds2.js` | nuanceur en unités de bloc : `vLocalPos`, `uCamBloc`, tri dans le même espace ; note sur le backtick GLSL |
| `src/main.js` | `groupeNuages`, adoption par `sceneGlobe`, `majNuagesGlobe()`, `camNuagesBloc()`, `vue.nuages` |
| `src/ui/effects-panel.js` | `cloudDriftVar` **déclaré mort**, avec sa mesure |
| `test/nuages-globe.test.js` | **nouveau**, 20 tests |
| `test/visibilite-surface.test.js` | troisième redistribution déclarée (compte 9 → 8 + `nuages` = 1) |
| `package.json` | registre des tests |
| `scripts/diag-r20-voie1.mjs`, `-ecran`, `-garde`, `-curseurs`, `-cout`, `-vent` | les sondes |

⚠️ **Je n'ai touché ni `src/globe.js` ni le bloc `uContourWeight`/`minFade`** —
la tâche des courbes de niveau n'est pas gênée.
⚠️ **Aucune unité de texture ajoutée** : le nuanceur des nuages est le sien,
les 10 sur 16 du nuanceur des tuiles sont intactes.

## Réserves

1. **La bande 1 147 → 1 274 km reste sans nuages** (voir Étape 7).
2. **Le coût n'a été relevé qu'à UNE altitude de caméra** (18 km, ciel couvrant
   ~1 % de l'écran). Le garde-fou de remplissage n'a pas été éprouvé.
3. **Le peuplement par défaut (4 grappes) et l'étalement 0,97 rendent le ciel
   invisible aux réglages d'usine**, dans les deux modes. Réglage à trancher
   avec Adrien ; je ne l'ai pas décidé seul.
4. **Le banc tourne sous ANGLE/D3D11 sur RTX 3080.** Les chiffres de coût ne se
   transposent pas tels quels sur un palier bas.
5. **`clouds2` porte encore la texture d'ombre vers `terrain.mapUniforms`**, le
   nuanceur du bloc PLAT. Sous la sphère le crop ne la lit pas : **les nuages ne
   projettent pas d'ombre sur le crop.** C'est mesuré (c'est une partie de
   l'écart du mode plat), et c'est hors périmètre de R20.
