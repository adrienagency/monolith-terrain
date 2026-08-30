# INVENTAIRE D16 — L'ÉTAT DES LIEUX, CHIFFRÉ

> **Tâche D16, inventaire. ⛔ AUCUNE LIGNE DE `src/` N'A ÉTÉ TOUCHÉE.**
> Livrés : `scripts/sonde-d16.mjs` (l'instrument) et `scripts/lit-sonde-d16.mjs`
> (le lecteur). Traces : `.banc/D16/*.json` — 7 sessions, **0 erreur de page**.
> Matériel : ANGLE (NVIDIA RTX 3080, D3D11), Chrome sans tête 1280 × 800, port 5537.
> URL : `?terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee&soleil=heure`

## ⚡ CE QUI A CHANGÉ EN COURS D'INVENTAIRE

**Adrien, en cours de tâche :** *« Il ne faut pas deux caméras, il n'en faut plus
qu'une seule et unique. »* L'étape 8 ne demande donc plus *si* la réécriture est
nécessaire : **elle est la commande.** Le §8 est devenu **la carte de la
réécriture**. ⚠️ **Et une mesure y contredit une intuition largement partagée :
le choix de l'UNITÉ n'a aucun effet sur la précision. Voir §8.2.**

---

# 1. L'INSTRUMENT, ET LA PREUVE QU'IL VOIT

`scripts/sonde-d16.mjs` relève **par image RENDUE** — le relevé est fait dans une
enveloppe autour de `composer.render`, donc **après** `modes.update` et
`majCameraFond`, et sur le tampon de dessin qui va s'afficher :

| famille | ce qui est relevé |
|---|---|
| ① position | `camera.position` ET `camGlobe.position`, déplacement rapporté à la distance à la cible |
| ② axe | vecteur de visée monde des DEUX caméras, angle image à image, inclinaison au nadir local |
| ③ échelle | emprise du bloc, altitude de cadrage, altitude de FOND (`\|camGlobe\| − R_GLOBE`), distance, fov, near/far |
| ④ contenu | condensé 16 × 10 du tampon de dessin, par **chaîne de `blitFramebuffer` divisant par deux à chaque étage** (moyenne de boîte, pas un point échantillonné) |
| + | quelle caméra a rendu et dans quel ordre, `uCropOn`, `dem.zoom`, `dem.lat/lon`, requêtes réseau depuis l'image précédente |

⚠️ **DEUX DISTANCES D'IMAGE, ET LA SECONDE EST LÀ POUR MONTRER QU'ELLE EST
AVEUGLE** : `dImg` (écart absolu moyen par tuile de condensé, 0-255) et `dLum`
(écart de luminance moyenne). Le §3 rupture ④ donne le cas où `dLum` n'en voit
que 8 %.

## 1.1 Témoin nul — deux relevés d'un état identique

**En surface, 142 images consécutives, aucune entrée** (`.banc/D16/temoins2.json`) :

| grandeur | médiane | MAX |
|---|---|---|
| déplacement caméra (bloc et fond) | **0,000** | **0,000** |
| rotation de visée (bloc et fond) | **0,000°** | **0,000°** |
| rapport d'altitude de fond | **1,0000** | **1,0000** |
| `dImg` | 0,210 | **0,2542** |
| `dLum` | 0,0187 | 0,0667 |

➡️ **Le plancher de bruit de l'instrument sur les familles ①②③ est EXACTEMENT
zéro** ; sur ④ il vaut **0,2542** (scène animée : mer, nuages).

**En orbite, 144 images, aucune entrée** : ①②③ ne sont PAS nuls — déplacement
**0,000 571 relatif/image**, visée **0,0327°/image** (MAX 0,0348°), `dImg` ≤ 0,0167.
⚠️ **Ce n'est pas du bruit d'instrument, c'est le produit** : `src/main.js:12157-12159`
fait tourner la planète de `dtAmb × 0,035` rad/s après 3 s sans entrée. Mesuré
séparément, caméra libre : **7,5059° puis 7,5055° par tranche de 4 s, soit
1,876°/s, constant** (`controls.autoRotate` vaut pourtant `false`).
**En orbite, « la Terre reste au même endroit » est déjà faux au repos, par décision.**

## 1.2 Témoin positif — une rupture connue, dont la valeur se calcule d'avance

On rejoue la plongée d'AVANT la Tâche R4 **sans toucher à `src/`** : au milieu du
balayage de pose, la page appelle `modes._avancerFonduPose(1)` — la caméra saute
en UNE image à la pose oblique finale.

| | valeur |
|---|---|
| `angleTotalDeg` lu sur `modes._fonduPose` | **46,548 157 698 977 96°** (= `90° − atan(18/19)`) |
| avancement `e` avant le saut | 0,023 014 876 |
| **angle ATTENDU** = `angleTotalDeg × (1 − e)` | **45,613 8°** |
| **angle MESURÉ** (`dIncl` bloc, `dVisee` bloc, `dVisee` fond) | **45,614°** |
| écart | **< 0,001°** |
| `dImg` sur la même image | **14,22** (56 × le plancher) |
| `dLum` sur la même image | 1,95 |
| déplacement relatif de la caméra de fond | 0,201 |
| rapport d'altitude de fond | 1,1768 |

✅ **L'instrument retrouve à moins d'un millième de degré une rupture dont la
valeur était calculée d'avance, et la voit simultanément dans les quatre
familles.** Rythme : **dt médian 16,6 ms dans les deux témoins** — la lecture de
tampon ne coûte pas une image.

---

# 2. LA DESCENTE COMPLÈTE, DEPUIS `MAX_ALT_M = 60 000 000` m

Quatre sessions à la molette depuis 60 000 km (`enterOrbit(60e6)` puis
`orbAlt = orbAltTarget` forcé, molette dispatchée sur `renderer.domElement`) :

| trace | images | arrivée | MAX axe (fond) | MAX `dImg` | MAX rapport alt. fond | MAX dépl. rel. fond | MAX dt |
|---|---|---|---|---|---|---|---|
| `desc60000` | 1 249 | crop, 32,1 km | **11,863°** | 29,00 | 1,0822 | 0,1312 | 429,3 ms |
| `desc60000b` | 1 030 | crop, 32,0 km | **11,863°** | 29,01 | 1,0860 | 0,1303 | **1 849,7 ms** |
| `remontee1` (aller) | 1 056 | crop | **11,863°** | 29,30 | 1,0884 | 0,1306 | 382,4 ms |
| `desc-sol` | 1 555 | **397 m, z16** | — | — | — | — | — |

## ⚡ LE FAIT NEUF DU SEGMENT JAMAIS REGARDÉ

⛔ **LA TRAVERSÉE ORBITE → SURFACE N'A PAS LIEU À 1 600 km. ELLE A LIEU À
12 000 km.** Mesuré aux trois sessions : altitude de fond **12 024 690 m**,
**12 011 275 m**, **11 838 992 m** au moment où `modes.mode` passe à `surface`.

➡️ Conséquences, toutes mesurées :

- **le segment 60 000 → 12 000 km est du mode orbital pur** — 0 rupture ; la
  seule chose qui bouge est la rotation de veille de `main.js:12158` ;
- **le segment 12 000 → 1 600 km, jamais regardé, est déjà du mode SURFACE**,
  avec un bloc **z3 de 14 005 386 m de côté** posé devant la planète ;
- **c'est dans ce segment que tombent les deux plus grosses ruptures d'axe et de
  position de toute la descente** (ruptures ① et ③) ;
- la Tâche M croyait partir du haut du mode surface en partant de 1 600 km : elle
  partait en réalité **sept fois trop bas**, après la traversée et après les deux
  franchissements les plus violents.

---

# 3. LE CATALOGUE DES RUPTURES — **DIX**

Seuils, justifiés par les témoins : axe > **1,5°** (le plafond que R4 s'est donné,
`PAS_POSE_MAX_DEG`, `src/modes.js:216`) ; contenu `dImg` > **3** (12 × le plancher
de 0,2542) ; échelle : résidu > **1,01** après retrait de la glisse (§4.3).

---

## ① LA PLONGÉE ORBITE → SURFACE — la plus grosse rupture de CONTENU de la descente

| | `desc60000b` n77 | `desc60000` n99 | `remontee1` n81 |
|---|---|---|---|
| altitude de fond | **12 024 690 m** | 12 011 275 m | 11 838 992 m |
| `dImg` | **29,01** | 29,00 | 29,30 |
| `dLum` | **27,01** | 27,02 | — |
| luminance du condensé | **148,8 → 175,8** (+18,1 %) | — | — |
| axe (caméra de fond) | **4,262°** | 3,219° | 3,297° |
| déplacement relatif (fond) | 0,0473 | 0,0357 | — |
| résidu d'échelle (glisse retirée) | **×1,0447** | — | ×1,0455 |
| dt | 117,8 ms | 186,4 ms | 155,0 ms |

⚠️ **L'axe vaut 3,2° à 4,3° en UNE image — 2,1 à 2,8 fois le plafond de 1,5° que
R4 s'est donné.** Le balayage de pose ne couvre pas CETTE image-là : il ne s'arme
qu'APRÈS (`src/modes.js:988`).

Ce qui change dans l'image, vu sur les captures `.banc/D16/img-desc60000/d012` →
`d018` : le fond de ciel passe du dégradé sombre au beige clair, **le grain
apparaît**, **les étiquettes de villes apparaissent**, la coquille de nuages du
globe disparaît, le bandeau `FX ONLINE` s'affiche.

**Lignes** : `src/modes.js:949-951` (`globe.setVisible(false)`,
`setSurfaceVisible(true)`, `setEffectsEnabled(true)` — les trois dans la même
image) ; `src/main.js:4609-4617` vs `4631-4651` (bascule de régime de
`majCameraFond` : recopie → similitude) ; `src/modes.js:664` (`_whiteout` est un
**no-op** sous le drapeau — il n'y a AUCUN fondu ici).

---

## ② LE BALAYAGE DE POSE FAIT MONTER LA CAMÉRA DE RENDU DE **+32,6 %**

⛔ **R4 a publié : « L'ALTITUDE NE BOUGE PAS D'UN MÈTRE PENDANT LE BALAYAGE ».
C'est vrai de `camY`. C'est faux de la caméra qui rend.**

Mesuré sur `clic1` (balayage isolé, aucune molette pendant la séquence) :

| | valeur |
|---|---|
| altitude de fond au début du balayage | **11 718 603 m** |
| altitude de fond à la fin | **15 541 225 m** |
| **rapport** | **×1,3262** |
| durée | 43 images |
| somme des rotations de visée sur la séquence | **45,448°** |

**Pourquoi** : `poseFonduArrivee` (`src/monde/zoom-continu.js:274-293`) tient
`camY` constant et fait croître le **rayon horizontal**
`r = (camY − cible.y) / tan(élévation)` de 0 à ≈ 1,056 × camY. Or `poseFond`
(`src/monde/frontiere-rendu.js:159-171`) transforme un déport horizontal dans le
bloc en **éloignement du centre de la Terre** :
`|camGlobe| = √((R_GLOBE + k·camY)² + k²·r²)`. À 12 000 km d'altitude,
`k·camY ≈ 184` unités contre `R_GLOBE = 100` : le terme horizontal domine.

⚠️ **L'effet s'éteint près du sol** : à 30 km d'altitude le même balayage rend
**×1,0026**. **La traversée a lieu à 12 000 km — c'est-à-dire exactement là où
l'effet est maximal.**

**Lignes** : `src/monde/zoom-continu.js:274-293` (`poseFonduArrivee`),
`src/modes.js:1044-1057` (`_avancerFonduPose`), `src/modes.js:1475-1489`
(l'avancement dans `update`), `src/monde/frontiere-rendu.js:164` (la ligne qui
convertit le déport en altitude).

---

## ③ LE FRANCHISSEMENT DE NIVEAU FAIT PIVOTER LA CAMÉRA DE RENDU — **JUSQU'À 11,863°**, LA CAMÉRA DU BLOC NE BOUGEANT PAS D'UN MILLIÈME

⚡ **C'EST LA RUPTURE LA PLUS GRAVE, ET C'EST AUSSI CELLE QUI REJOUE L'ERREUR DE
MÉTHODE DE TOUTE LA CAMPAGNE.** R4 a mesuré `camera` (espace bloc) et publié
« 11 franchissements → **0 sur 11** ». **C'est exact.** Mais la caméra qui peint
la planète est `camGlobe`, et elle, elle pivote.

| franchissement | axe **fond** | axe **bloc** | dépl. rel. fond | résidu d'échelle | `dImg` | altitude de fond |
|---|---|---|---|---|---|---|
| z3 → z4 | **11,863°** | **0,000°** | **0,1303** | **×1,0436 / ×1,0449** | 11,64 | 7 996 667 m |
| z4 → z5 | **6,117°** | 0,000° | 0,0587 | **×0,9763 / ×0,9759** | 8,42 | 3 643 476 m |
| z5 → z6 | **2,935°** | 0,000° | 0,0167 | ×0,9917 | 3,16 | 1 676 268 m |
| z6 → z7 | **1,435°** | 0,000° | 0,0086 | ×1,0043 | 1,85 | 786 000 m |
| z7 → z8 | **0,710°** | 0,000° | 0,0034 | ×1,0040 | 1,07 | 380 000 m |

⚠️ **Ces cinq valeurs sont IDENTIQUES AU MILLIÈME dans les quatre sessions,
descente ET remontée.** Ce n'est pas un hasard de session : c'est de la
géométrie, et le rapport entre deux crans vaut **2,0** — l'emprise du bloc est
divisée par deux.

**MÉCANISME, ÉTABLI PAR LA MESURE ELLE-MÊME** (`desc60000b`, n235 → n236) :

```
n235  busy=1  cam=(−1,862 ; 23,974 ; 25,317)  cible=(−1,862 ; −0,182 ; −0,180)
n236  busy=0  cam=( 5,489 ; 44,586 ; 56,206)  cible=( 5,489 ; −0,295 ;  8,831)
      → la CIBLE saute de 9,01 unités en z = 20,7 % de la largeur du bloc
      → axe BLOC = 0,000°   (donc `camera.quaternion` est INCHANGÉ)
      → axe FOND = 11,863°
```

`camGlobe.quaternion = quaternionDeBase(ancre) ⊗ quaternionBloc`
(`src/monde/frontiere-rendu.js:168`). `quaternionBloc` est inchangé.
**Les 11,863° viennent donc ENTIÈREMENT de `quaternionDeBase`, c'est-à-dire du
déplacement de l'ANCRE.** L'ancre est `latLonOrigineBloc()`
(`src/main.js:4578-4586`) : le lat/lon de l'ORIGINE du bloc, **snappé sur la
grille de tuiles slippy**. À z3 une tuile fait 4 668 km : le snap peut déplacer
l'ancre de **jusqu'à 2 334 km, soit ≈ 21° d'arc**. Mesuré : 11,863° = 1 319 km.

**Lignes** : `src/main.js:4578-4586` (`latLonOrigineBloc`), `src/main.js:4631-4640`
(l'ancre passée telle quelle à `poseFond`), `src/monde/frontiere-rendu.js:161`
et `:168` (`repereGlobe` → `quaternionDeBase`), `src/modes.js:1103-1143`
(`_rescale`, qui recharge le bloc à un lat/lon voisin), `src/modes.js:422-448`
(`_suivreEmprise`, qui compense dans l'espace bloc — **et n'a aucun moyen de voir
l'ancre**).

---

## ④ LA NAISSANCE DU CROP — et le gel de **1,85 s**

| trace | `dImg` | `dLum` | part vue par la luminance | dt | altitude |
|---|---|---|---|---|---|
| `desc60000b` n919 | **13,49** | 2,99 | **22 %** | **1 849,7 ms** | 32,1 km |
| `desc60000` n1126 | 11,24 | 0,91 | **8 %** | 429,3 ms | 32,1 km |
| `remontee1` (aller) | 17,2 | — | — | 382,4 ms | 32 km |

⚠️ **C'est l'angle mort annoncé par le brief, et il est chiffré : un instrument
de LUMINANCE n'aurait vu que 8 % à 22 % de cette rupture.**
⛔ **Et l'image de 1 849,7 ms est la plus longue de tout l'inventaire** — 111
images perdues à 60 Hz, sur la seule image où le crop s'allume.

**Lignes** : `src/globe.js:3385` (`u.uCropOn.value = 1`) + `_melangeCrop(true)`.

---

## ⑤ LA MORT DU CROP (remontée) — **`dImg` = 57,60**, la plus grosse rupture de contenu mesurée

`remontee1` n154, z11, 40 460 m, dt 61 ms : `dImg` **57,60**, `dLum` **53,05**,
`uCropOn` 1 → 0, en **une image**. **4,3 fois la naissance du crop.**
**Lignes** : `src/globe.js:3543-3551` (`retirerCrop()`).

---

## ⑥ LA SORTIE D'ORBITE (remontée) — **47,668° en UNE image de 17,1 ms**

`remontee1` n997 :

| grandeur | valeur |
|---|---|
| rotation de visée (fond) | **47,668°** |
| rotation de visée (bloc) | 87,031° |
| déplacement relatif de la caméra de fond | **0,8467** (85 % de sa distance au centre) |
| rapport d'altitude de fond | **×1,3783** |
| `dImg` | 8,76 |
| dt | **17,1 ms** — une image normale |

⛔ **AUCUN LISSAGE. R4 n'a traité QUE la plongée.** `enterOrbit` repose la caméra
à `latLonToSphere(lat, lon, R_GLOBE + orbAlt)` puis `camera.lookAt(0,0,0)` dans
la même image. **Lignes** : `src/modes.js:704-727`, en particulier `:716-718` et
`:723`, et `src/main.js:4609-4617` (retour au régime de recopie).

---

## ⑦ LE CLIC SUR LE GLOBE — **÷2,2285 d'altitude en UNE image**

⚠️ **Le clic n'est atteignable qu'au-dessus de la porte géométrique** : dès qu'on
touche la molette, `_diveArmed` s'arme et la plongée part seule à 12 000 km.
Mesuré depuis 60 000 km (`clic2` n2) :

| grandeur | valeur |
|---|---|
| altitude de fond | **60 000 000 → 26 923 397 m** |
| **rapport** | **×2,2285** |
| déplacement relatif de la caméra de fond | **0,9954** |
| rotation de visée (fond) | 3,172° |
| `dImg` | 4,23 |
| dt | 180,1 ms |
| puis, balayage | **×1,326** de plus, jusqu'à 35 674 432 m |

**Cause** : `zoomImpose` court-circuite la déduction du niveau
(`src/modes.js:806`) et `_posePlongee` **écrête** la distance à
`surfaceMaxDistance()` (`src/modes.js:873-877`). **C'est l'écrêtage qui produit
le ÷2,23.** Point d'entrée : `src/modes.js:1248-1258` (`plongeDepuisGlobe`).

---

## ⑧ TROIS RECHARGEMENTS DE CONTENU EN REMONTÉE

`remontee1` : n148 `dImg` **32,00** (+23 tuiles dans l'image), n177 `dImg`
**27,74** (dt 223,8 ms), n192 `dImg` **22,04** (+11 tuiles). **Aucun équivalent à
la descente.**

---

## ⑨ LA ROTATION DE VEILLE ORBITALE — **1,876°/s, en permanence**

`src/main.js:12157-12159`. Mesurée : 7,5059° puis 7,5055° par tranche de 4 s.
Ce n'est pas une rupture (elle est continue) mais elle contredit littéralement
« La Terre et la vue doivent rester au même endroit ». **À arbitrer avec Adrien,
pas à corriger en silence.**

---

## ⑩ LE CHARGEMENT HORS-CHAMP — **63,6 % du trafic** (voir §6)

---

# 4. LA QUESTION DES DEUX CAMÉRAS

## 4.1 Laquelle rend, à quel moment ?

**Les DEUX, à CHAQUE image, dans les DEUX modes.** Relevé sur les 5 000+ images
des sept sessions, l'ordre des passes est **invariablement** `fond + bloc + …` :

- passe ① `PasseFond(sceneGlobe, camGlobe)` — `src/main.js:4564-4567`
- passe ② `ClearPass(false, true, false)` — `src/main.js:4569`
- passe ③ `passeSurface(scene, camera)` — `src/main.js:4570-4572`

En mode **orbital**, `camGlobe` est une **recopie bit à bit** de `camera`
(`src/main.js:4611-4616`) : mesuré, déplacement et rotation relatifs entre les
deux caméras = **0,000 sur les 144 images du témoin nul orbital**. La passe ③
dessine une scène masquée.

En mode **surface**, `camGlobe` est la similitude `poseFond(camera)`. **La caméra
que l'utilisateur VOIT est `camGlobe`** — c'est elle qui peint la planète, le
bloc n'étant qu'une découpe posée devant.

## 4.2 Le passage de l'une à l'autre est-il visible ?

**Oui, et il est chiffré** : rupture ①. **Mais ce n'est pas le passage de caméra
qui se voit, c'est ce qui l'accompagne** : sur cette image, l'axe de la caméra de
rendu ne bouge que de **3,2° à 4,3°** et l'altitude de fond de **×1,0004
seulement** — pendant que le contenu change de **29,01** (114 fois le plancher).
**La similitude, elle, est bonne à la traversée. C'est le changement de SCÈNE qui
claque.**

## 4.3 ⚠️ LA COMPENSATION DE `k` PAR `_suivreEmprise()` N'EST PAS EXACTE

Vérifiée, pas crue. Méthode : sur chaque image longue (dt ≥ 80 ms), on retire la
glisse inertielle attendue — taux logarithmique médian mesuré sur les 18 images
voisines PROPRES (4 ms < dt < 40 ms), **appliqué sur `min(dt, 50 ms)` puisque
`src/main.js:12097` écrête `dt` à 0,05 s** — et on lit le résidu.

| | `desc60000b` | `remontee1` |
|---|---|---|
| images longues analysées | 57 | 70 |
| **médiane du résidu** | **×1,0002** | **×1,0003** |
| plongée orbite → surface | **×1,0447** | **×1,0455** |
| franchissement z3 → z4 | **×1,0436** | **×1,0449** |
| franchissement z4 → z5 | **×0,9763** | **×0,9759** |

➡️ **La compensation est excellente en régime courant (2 · 10⁻⁴) et laisse
+4,5 % / −2,4 % aux deux franchissements les plus larges et à la traversée.**
Reproduit à 0,1 % près sur deux sessions indépendantes ; **200 fois le bruit
propre de la méthode.**

---

# 5. LE CHANGEMENT D'AXE — LE CŒUR

## 5.1 D'où vient l'orientation d'arrivée, et qui l'impose

`PENTE_ARRIVEE = { y: 18, z: 19 }` — `src/loi-altitude.js:53`, d'où
`_ARRIVAL_DIR = (0, 18, 19).normalize()` — `src/modes.js:286`. Elle est lue en
**six** endroits : `_arrivalPose` (`:838`), `_posePlongee` (`:869`, `:878`,
`:892`), `_niveauDArrivee` (`:462`), `_rescale` (`:1144`), `diveTo` (`:1298`).
`90° − atan(18/19) = 46,548 157 698 977 96°` — **identité géométrique**, vérifiée
par mon témoin positif à moins de 0,001°.

**Qui l'impose : personne d'autre que le produit.** Ce n'est ni une contrainte
géométrique, ni une contrainte de chargement, ni une contrainte de `controls`.

## 5.2 ⚠️ CE N'EST PAS LA PLONGÉE QUI CHANGE D'AXE — CE SONT DEUX CONVENTIONS QUI NE SE PARLENT PAS

- **En orbite**, `controls.target = (0,0,0)` et `camera.lookAt(0,0,0)`
  (`src/modes.js:717`, `:723`), et `update` force
  `camera.position = direction × (R_GLOBE + orbAlt)` (`src/modes.js:1389-1390`).
  **La caméra est mécaniquement au nadir, toujours.** Mesuré : inclinaison au
  nadir local **0,000°** sur toutes les images orbitales des sept sessions.
- **En surface**, la caméra est posée le long de `_ARRIVAL_DIR` depuis une cible
  à son aplomb. **Inclinaison 46,548°, toujours.**

➡️ **Les 46,548° ne sont produits par aucun geste : c'est l'écart FIXE entre les
deux conventions. Tant qu'il y a deux modes, il faut bien le franchir un jour.**
R4 l'a étalé ; le supprimer veut dire **choisir une seule convention**.

## 5.3 Qu'est-ce qui casse si la caméra garde son axe ?

**Mesuré, pas déduit.** J'ai figé la caméra au nadir à 13 342 m, z11, en
rappelant les méthodes existantes depuis la page (`_armerFonduPose` puis
`_fonduPose = null` à l'avancement 0) — **aucune ligne de `src/` touchée**.
Captures : `.banc/D16/vue-oblique-13342m-z11.jpg` et `vue-nadir-13342m-z11.jpg`.

**Rien ne casse au sens du code.** Ce qui disparaît :

1. **le bord du bloc et ses parois** — la découpe n'a plus de silhouette : la vue
   devient une carte plate, **exactement l'image `t23` d'Adrien** ;
2. **le relief** — l'exagération verticale ×2,8 est invisible de dessus, il ne
   reste que l'ombrage ;
3. **31 % du champ au sol** : à `camY` constant, passer à l'aplomb ramène la
   distance à la cible de `camY / sin(43,45°)` à `camY`, soit **×0,6878** —
   mesuré 39,65 → 27,27 unités sur la capture ci-dessus.

⚠️ **Et un effet de bord qui n'est pas cosmétique** : `_niveauDArrivee`
(`src/modes.js:454-470`) choisit le niveau d'arrivée en comparant
`distance = (altitude − yCible) / pente` à un plafond. Avec `pente = 1` au lieu
de 0,687 75, **la distance requise chute de 31 % et la porte orbitale s'ouvre
1,45 fois plus haut** : la traversée, déjà à 12 000 km, monterait vers 17 000 km.

## 5.4 ➡️ MA RÉPONSE

**Le bloc est parfaitement regardable au nadir — il n'est simplement plus
ShibuMap.** La question n'est donc pas technique, elle est produit, et elle a
**deux réponses possibles, pas trois** :

- **(A) le bloc arrive au NADIR.** L'axe devient continu avec l'orbite, D16 ③ est
  satisfaite **exactement, pas approximativement**, le balayage disparaît — et
  avec lui la rupture ② (+32,6 %), qui est **entièrement causée par le balayage**.
  Prix : la vue de trois quarts n'est plus donnée, elle devient un geste de
  l'utilisateur (`controls.maxPolarAngle = π × 0,49` l'autorise déjà) ou un
  réglage qui s'applique **une fois posé, pas pendant la descente**.
- **(B) l'ORBITE devient oblique.** La caméra orbitale cesse de viser le centre de
  la sphère et vise un point de surface avec le même déport. D16 ③ est satisfaite
  aussi, et le produit est conservé de bout en bout. **Prix : `controls` orbite
  autour de `(0,0,0)` et `update` reprojette la caméra sur le rayon à chaque
  image — les deux hypothèses tombent, et avec elles `enterOrbit`,
  `_zoomGesture`, `altitudeOrbitaleM` et les butées.**

⛔ **Étaler ne sera jamais supprimer.** Toute solution qui garde les deux
conventions gardera les 46,548°. **(A) est la seule qui les supprime sans
réécrire le mode orbital ; (B) est la seule qui les supprime sans rien perdre du
produit. Il n'y en a pas d'autre.**

---

# 6. LE CHARGEMENT

Compté par `PerformanceObserver('resource')`, fenêtre = la descente seule
(`desc60000b`, **26 s**, 60 000 km → 32 km) :

| nature | requêtes | part |
|---|---|---|
| **tuiles d'eau** (`/data/water-tiles/8/…`) | **3 332** | **63,6 %** |
| MNT (`terrarium`) | 492 | 9,4 % |
| bathymétrie | 134 | 2,6 % |
| **total tuiles** | **5 235** | |
| toutes requêtes confondues | 5 255 | |
| **dont en mode orbital** | **1** | |
| doublons (même URL deux fois) | 15 | 0,3 % |

## ⛔ CE QUI SE CHARGE ET NE DEVRAIT PAS

**Les 3 332 tuiles d'eau sont TOUTES demandées à z8**, quel que soit le niveau du
bloc affiché :

| niveau du bloc au moment de la demande | tuiles d'eau z8 demandées | largeur du bloc |
|---|---|---|
| z3 | **515** | 14 005 km |
| bloc en cours de rechargement | **601** | — |
| z4 | **469** | 6 989 km |
| z5 | 424 | 3 498 km |
| z6 | 426 | 1 748 km |
| z7 | 433 | 874 km |
| z8 | 335 | 437 km |
| z9 | 130 | 218 km |

➡️ **1 585 requêtes (30,3 % du trafic total de la descente) partent pendant que
le bloc fait 6 989 à 14 005 km de large, ou n'existe pas.** Une tuile d'eau z8
couvre ≈ 156 km : à z3 elle occupe **1/90ᵉ de la largeur du bloc, moins de
15 pixels à l'écran**. Elles ne peuvent rien montrer.

**Ce qu'Adrien admet — « le chargement des dalles et leur amélioration » — c'est
le MNT : 492 requêtes, 9,4 % du trafic. Les 90,6 % restants ne sont pas des
dalles qui s'affinent.**

---

# 7. LE SENS INVERSE — **PIRE, ET DE LOIN**

| | descente | remontée |
|---|---|---|
| MAX rotation de visée (fond) | 11,863° | **47,668°** |
| MAX `dImg` | 29,01 | **57,60** |
| MAX rapport d'altitude de fond | 1,0860 | **1,3783** |
| MAX déplacement relatif (fond) | 0,1303 | **0,8467** |
| ruptures `dImg` > 20 | **1** | **4** (57,6 · 32,0 · 27,7 · 22,0) |

Les cinq franchissements rendent **exactement les mêmes angles** dans les deux
sens (11,863 / 6,117 / 2,935 / 1,435 / 0,710°) — **la rupture ③ est symétrique**.
Tout le reste ne l'est pas :

- la **sortie d'orbite** n'a **aucun** équivalent du balayage de R4 : 47,668° en
  une image de 17,1 ms, contre 46,548° étalés sur ~1,9 s à la descente ;
- la **mort du crop** vaut **4,3 fois** sa naissance (57,60 contre 13,49) ;
- **trois rechargements de contenu** (32,0 / 27,7 / 22,0) sans équivalent à l'aller.

---

# 8. LA CARTE DE LA RÉÉCRITURE — UNE SEULE CAMÉRA

## 8.1 Quel espace survit ?

| | espace BLOC | espace GLOBE |
|---|---|---|
| unité | `TERRAIN_SIZE = 56` pour `extentMeters` | `R_GLOBE = 100` pour 6 371 000 m |
| occurrences dans `src/` | **191, dans 32 fichiers** | **78, dans 11 fichiers** |
| origine | le centre du bloc | le centre de la Terre |
| ce qui y vit | `terrain.js`, `plinth`, tout le crop, l'export, le drag, la fenêtre continue, **tout `loi-altitude.js`** (`Y_CIBLE = −0,3`, `minDistance = 6`, `maxDistance = 150`) | `globe.js`, `geo.js`, la plongée orbitale |

## 8.2 ⚡ LA PRÉCISION — ET ELLE CONTREDIT L'INTUITION

**Mesuré sur la trajectoire RÉELLE** (`desc-sol`, 1 555 images, 60 000 km → 397 m,
z16), en quantifiant chaque position relevée en `float32` (`Math.fround`) et en
lisant l'ulp exprimé en mètres :

| altitude | espace GLOBE (R = 100) | espace MÉTRIQUE Terre-centré | espace BLOC actuel | déplacement réel/image |
|---|---|---|---|---|
| 1 000 km | 0,4861 m | 0,5000 m | 2,38 · 10⁻¹ m | 17 091 m |
| 100 km | 0,4861 m | 0,5000 m | 1,49 · 10⁻² m | 2 034 m |
| 30 km | 0,4861 m | 0,5000 m | 7,44 · 10⁻³ m | 531 m |
| 10 km | 0,4861 m | 0,5000 m | 1,86 · 10⁻³ m | 139 m |
| 3 km | 0,4861 m | 0,5000 m | 4,65 · 10⁻⁴ m | 60,2 m |
| 1 km | 0,4861 m | 0,5000 m | 2,33 · 10⁻⁴ m | 19,1 m |
| **600 m** | **0,4861 m** | **0,5000 m** | **1,16 · 10⁻⁴ m** | 9,84 m |

⛔ **PREMIER RÉSULTAT, ET IL ANNULE LA MOITIÉ DE LA QUESTION : LE CHOIX DE
L'UNITÉ NE CHANGE RIEN.** Espace globe et espace métrique donnent **0,4861 m
contre 0,5000 m — 3 % d'écart.** La précision `float32` est **relative**
(≈ 6 · 10⁻⁸) : multiplier toutes les coordonnées par 63 710 ne fait que déplacer
l'exposant. **« Unités de globe ou mètres » est un débat de coût de migration,
pas un débat de précision.**

⛔ **SECOND RÉSULTAT : ce qui compte, c'est l'ORIGINE, et l'écart est de 4 310.**
À 600 m d'altitude, l'espace bloc rend **0,116 mm** contre **0,50 m** pour tout
espace centré sur la Terre. **C'est très probablement la raison d'être des deux
espaces, et personne ne l'avait écrite.**

### Où les 0,5 m mordent-ils vraiment ?

⚠️ **Pas sur la position de la caméra.** three.js compose `modelViewMatrix` en
double et n'envoie au GPU que le PRODUIT, qui est petit ; et le déplacement réel
par image vaut **19,7 quanta à 600 m** — la caméra ne craquellerait pas pendant
un zoom.

⛔ **Ils mordent sur les ATTRIBUTS DE SOMMETS, qui sont des `Float32Array` par
construction, et sur les UNIFORMES GLSL, qui sont `float32` quoi qu'il arrive.**
Avec `RES_FENETRE_CONTINUE = 384` (`src/terrain.js:89`) :

| niveau | emprise du bloc | pas de maille | quantum 0,5 m en % du pas |
|---|---|---|---|
| z10 | 109 238 m | 284,5 m | 0,2 % |
| z12 | 27 309 m | 71,1 m | 0,7 % |
| z15 | 3 414 m | 8,89 m | **5,6 %** |
| **z16 (atteint, mesuré)** | **1 707 m** | **4,45 m** | **11,2 %** |
| z17 | 853 m | 2,22 m | **22,5 %** |

➡️ **À z16 — le niveau que la descente ATTEINT réellement (mesuré : `desc-sol`,
emprise 1 707 m, altitude 397 m) — un espace unique centré sur la Terre
quantifierait les sommets du relief à 11,2 % du pas de maille.** Sur un relief
ombré, c'est un escalier visible. **L'espace bloc actuel y rend 0,0026 % :
4 300 fois mieux.**

### ➡️ MA RECOMMANDATION

**Une seule caméra : OUI. Un seul espace ABSOLU : NON — la mesure l'interdit.**

**Espace unique à ORIGINE FLOTTANTE (RTC).** Une origine `O` recentrée près de la
caméra (ou par tuile / par bloc), toutes les positions stockées **relativement à
`O`**, et `O` reposé quand la caméra s'en éloigne. Il n'y a **plus qu'une caméra,
plus qu'une matrice de vue, plus de similitude `poseFond`** — mais les nombres
restent petits, donc la précision reste celle de l'espace bloc.

**Unité recommandée : le MÈTRE.** La précision est identique aux deux (mesuré,
3 % d'écart) ; le mètre supprime en revanche **`ORBITAL_M_PER_UNIT`,
`echelleBloc`, `facteurEchelle`, `altitudeFondM` et `altitudeSurfaceM`** — les
cinq conversions qui produisent la classe de défaut du §8.3. Coût : les 191
occurrences de `TERRAIN_SIZE` et les 78 de `R_GLOBE`/`ORBITAL_M_PER_UNIT`, plus
**tout `loi-altitude.js` (486 lignes), `zoom-continu.js` (537),
`escalier-zoom.js` (163) et `modes.js` (1 504)**, dont les constantes
(`Y_CIBLE = −0,3`, `DISTANCE_MIN_SURFACE = 6`, `DISTANCE_MAX_SURFACE = 150`) sont
en unités de bloc.

⚠️ **Si le mètre est jugé trop cher, l'unité de globe fait aussi bien côté
précision. Mais alors le RTC reste obligatoire : sans lui, l'unité de globe donne
0,4861 m, c'est-à-dire exactement le même défaut.**

## 8.3 Qui dépend de la séparation ? — et la classe de défaut à chasser

**55 occurrences** de `camGlobe` / `poseFond` / `plansFond` / `sceneGlobe` dans
`src/`. Les sites qui font vraiment un choix :

| site | ce qu'il fait |
|---|---|
| `src/main.js:4609-4617` | régime orbital : `camGlobe` recopie `camera` |
| `src/main.js:4631-4651` | régime surface : `poseFond` + `plansFond` |
| `src/main.js:4985` | `const cam = frontiereActive ? camGlobe : camera` → `globe.poserLoiMonde({ fovDeg })` |
| `src/main.js:12201`, `:12226` | `globe.update(camGlobe, dtAmb)` — le LOD du globe |
| `src/main.js:12219` / `:12240` | `uSunDir` reposé sur `camGlobe.position` (surface) ou `camera.position` (orbite, où les deux sont identiques) |
| `src/main.js:5435` | `fovDeg: camGlobe?.fov ?? camera.fov` |
| `src/main.js:4607-4608` | recopie de `camera.view` (export pavé) |
| `src/modes.js:377-382`, `:422-448` | `_altitudeFondM`, `_suivreEmprise` — la compensation de `k` |
| `src/monde/zoom-continu.js:118-141` | l'invariant `altitudeFondM` |
| `src/loi-altitude.js:181`, `:447` | `poseCranContinu({ facteurEchelle })` |

**Tests concernés : 26 fichiers sur 223.**

### ⚠️ LA CLASSE DE DÉFAUT — « une longueur mesurée dans un espace, employée dans l'autre »

Le défaut de l'autofocus (**23,597 unités pour un sujet à 0,1809 de la caméra qui
le dessine, facteur 130,4** — chiffre de la tâche du flou, pas de moi) en est un
cas. **Le facteur 130,4 EST `1/k`** : `k = extentMeters / span / ORBITAL_M_PER_UNIT`.
**Toute longueur calculée sur `camera` et consommée par un objet posé par
`camGlobe` est fausse d'un facteur `1/k` — et `1/k` varie de ≈ 4,5 à z3 à
≈ 3 700 à z16.** Voilà pourquoi ce défaut a six occurrences.

**Sites à auditer en priorité, tous porteurs d'une LONGUEUR** — je les nomme, je
ne les ai pas tous mesurés (réserve 7) :

1. **profondeur de champ / autofocus** — le cas connu ;
2. **`near` / `far`** — deux lois différentes, écart assumé mais réel :
   `planProche` plancher **0,01 unité = 637 m** (`NEAR_MIN`, `src/loi-altitude.js`)
   contre `plansFond` plancher **1 · 10⁻⁵** (`src/monde/frontiere-rendu.js:195`)
   — **un rapport 1 000** ;
3. **`globe.poserLoiMonde`** (`src/main.js:4981-4991`) — mélange `cam.fov` du fond
   et `latLonOrigineBloc()` du bloc dans la même expression ;
4. **carte d'ombre, AO, brume** — tous paramétrés en distances de scène ;
5. **`sampleGroundY` / `_solSous` + la garde « clearance margin 3 »**
   (`src/modes.js:840`, `:882`, `:895`) — une garde **en unités de bloc**, donc
   valant `3 × extentMeters / 56` mètres, soit **≈ 750 km à z3 et ≈ 91 m à z16** ;
6. **les butées de `controls`** (`minDistance = 6`, `maxDistance = 150`) — idem.

⚠️ **Une caméra unique supprime la classe entière, parce qu'il n'y a plus deux
espaces où se tromper. C'est le principal bénéfice technique de la décision.**

## 8.4 L'ordre des passes — **une caméra unique n'en demande plus qu'une**

Aujourd'hui : ① fond (efface couleur ET profondeur) → ② `ClearPass(false, true, false)`
qui **remet la profondeur à 1** (`src/main.js:4569`) → ③ surface, qui n'efface
plus rien.

⚠️ La passe ② existe **uniquement** parce que le bloc et le globe vivent dans deux
espaces dont les profondeurs ne sont pas comparables. Sous `?terre=unique`, le
sujet est peint par la passe ① ; **sa profondeur est donc effacée par ② avant que
le moindre effet d'écran ne puisse la lire** — c'est la cause structurelle du flou
d'arrière-plan inerte relevé par la tâche du flou (**0 pixel sur 1 024 000** ;
chiffre de cette tâche-là, pas de moi).

➡️ **Avec une caméra unique, globe et bloc se dessinent dans le MÊME espace, avec
le MÊME tampon de profondeur, en UNE passe.** `PasseFond`, `ClearPass`,
`skipShadowMapUpdate`, la sauvegarde de `shadowMap.needsUpdate`
(`src/main.js:4553-4560`), `passeSurface.ignoreBackground` et la recopie de
`camera.view` disparaissent ensemble. **Le flou redevient possible sans une ligne
écrite pour lui. Ça pèse dans l'arbitrage, et dans le bon sens.**

## 8.5 Ce que la réécriture coûte, chiffré

| poste | volume |
|---|---|
| `src/modes.js` (les deux modes fusionnent) | **1 504 lignes** |
| `src/loi-altitude.js` (tout en unités de bloc) | 486 |
| `src/monde/zoom-continu.js` | 537 |
| `src/monde/frontiere-rendu.js` (**supprimé**) | 237 |
| `src/escalier-zoom.js` | 163 |
| branchements `mode === 'orbital' / 'surface'` | **52, dans 5 fichiers** |
| sites `camGlobe` / `poseFond` / `sceneGlobe` | **55** |
| `TERRAIN_SIZE` (si passage au mètre) | **191, dans 32 fichiers** |
| `R_GLOBE` / `ORBITAL_M_PER_UNIT` | **78, dans 11 fichiers** |
| fichiers de test à reprendre | **26 sur 223** |
| **à ajouter** | l'origine flottante : recentrage, seuil de bascule, et la reprise des attributs de sommets du terrain ET du globe |

⚠️ **Et un poste que personne n'a chiffré : le globe est un quadtree de tuiles
avec sa propre origine par tuile** (`src/globe.js:2993`, « l'origine est posée sur
la surface DÉPLACÉE »). **Le RTC du globe existe donc déjà, et il a un piège
connu.** La réécriture doit le rejoindre, pas le doubler.

---

# 9. RÉSERVES

1. ⚠️ **Une seule machine.** RTX 3080, Chrome sans tête, 1280 × 800, un seul lieu
   (La Réunion, −21,26 / 55,74, puis dérive vers l'est). **Aucun chiffre de ce
   rapport n'est transposable à une machine lente sans être remesuré.** Le seul
   chiffre indépendant du matériel est la précision `float32` du §8.2
   (arithmétique exacte sur une trajectoire relevée).
2. ⚠️ **Le résidu d'échelle du §4.3 dépend d'un MODÈLE de glisse**, pas d'une
   mesure directe. Sa médiane sur 127 images longues vaut ×1,0002 : c'est mon
   estimation du bruit de la méthode. **Le +4,5 % vaut 200 fois cela, mais il
   n'est pas mesuré à molette gelée.** Un banc qui figerait la molette pendant un
   franchissement trancherait.
3. ⛔ **Le condensé 16 × 10 est une signature, pas une mesure perceptuelle.** Il
   voit un changement global mieux qu'un changement local : **une rupture qui
   n'occuperait que 2 % de l'écran passerait sous mon seuil de 3.**
4. ⚠️ **Mon instrument appelle `renderer.resetState()` après chaque lecture de
   tampon.** dt médian mesuré 16,6 ms dans les deux témoins, 0 erreur de page sur
   7 sessions — **mais je n'ai pas mesuré ce coût en A/B apparié.**
5. ⚠️ **Le clic sur le globe n'a été mesuré qu'à 60 000 km**, parce que la porte
   géométrique s'ouvre à 12 000 km dès qu'on touche la molette. **Le clic depuis
   une orbite basse n'est pas atteignable au geste** : je n'ai pas mesuré ce que
   `palierDeClic(DIVE_TIERS, …)` rend entre 12 000 et 60 000 km.
6. ⚠️ **Le déclenchement de la plongée à 12 000 km dépend du lieu** (l'emprise du
   bloc porte un `cos(lat)`). Mes trois relevés vont de 11 838 992 à 12 024 690 m
   au même endroit ; **à l'équateur la porte s'ouvrira plus haut.** Non mesuré.
7. ⛔ **Les six sites du §8.3 sont NOMMÉS, pas mesurés** — seuls l'autofocus (par
   une autre tâche) et les deux planchers de `near` (par lecture du code) sont
   chiffrés. **Ne pas les compter comme des défauts établis.**
8. ⚠️ **La rupture ③ (11,863°) est reproductible aux quatre sessions, au même
   lieu. Je n'ai pas vérifié qu'elle vaut 11,863° AILLEURS** — l'angle dépend de
   l'alignement du point de descente sur la grille de tuiles, et sa **borne
   théorique à z3 est un demi-carreau, soit ≈ 21°**. **Publier 11,863° comme
   valeur, pas comme maximum.**
9. ⚠️ **`.banc/` est ignoré par git.** Les traces de cet inventaire sont sur
   disque uniquement ; **les deux scripts, eux, sont dans `scripts/`.**
10. ⛔ **Je n'ai touché aucune ligne de `src/` et n'ai lancé aucun test** :
    l'inventaire ne change rien, la base reste **4 293 tests / 0 échec / audit
    221 = 221** telle qu'annoncée au brief. **Je ne l'ai pas revérifiée.**
