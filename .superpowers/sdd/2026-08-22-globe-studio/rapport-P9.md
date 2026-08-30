# Tâche P9 — LE BLEU PROFOND DE LA MER ET LE DERNIER TIERS DU RELIEF

**Statut : LIVRÉE. UN DES DEUX POSTES EST FERMÉ, L'AUTRE NON — et le brief se
trompe sur les DEUX causes, je le dis d'entrée.** · Commits **`d9dc91f`** et
**`ac58500`** sur `regroupement` (HEAD **`ac58500`**, arbre propre après commit).

`npm test` — **4 027 / 4 027** (4 021 au départ, **+6**) · `npm run audit:tests` —
**209 / 209** · campagne de mutation — **36 / 36**, dont **20 visant le
branchement** (55,6 %), **deux retirées comme NEUTRES** et **remplacées**, parce
qu'elles avaient trouvé **du CODE MORT**.

> ⛔ **UNE CORRECTION PORTÉE LE 2026-08-23, APRÈS LA RELECTURE GROUPÉE P8→P12 :**
> le §1.3 publiait **« 5 625 sommets, cent cinq fois moins que le socle »** ;
> **`S5-relief-P9.json`, produit par la MÊME exécution, porte `sommets: 29 978`**,
> et **le commentaire de ma sonde écrivait l'attente « 5 625 au plus » : la
> garde a sonné sans que je la rapporte.** ⚡ **L'argument tient** — `nduMin` est
> un minimum, donc conservateur, et le gain de 97,9 % est mesuré sur des pixels
> — **mais le chiffre est retiré et remplacé par le ×10,7 par axe, qui se
> mesure.** Détail complet au §1.3.

> **Le brief :** *« LE BLEU PROFOND — il manque en TEINTE, pas en détail »* ·
> *« Ne pars pas sur la réfraction »* · *« `grainForceM` n'est TOUJOURS PAS
> passé »* · *« la conversion en mètres reste à faire »*.

**Les deux pistes nommées sont mortes, et je les tue avec des chiffres :**

1. ⛔ **LE GRAIN N'EST PAS LE LEVIER.** Converti et POSÉ à sa valeur exacte, il
   déplace l'énergie de détail du crop de **10,972 à 10,972 — 0,000 %**.
2. ⛔ **LE BLEU PROFOND NE MANQUE PAS EN TEINTE : LA LAME D'EAU DU CROP A DÉJÀ LA
   BONNE TEINTE ET LA BONNE OPACITÉ.** Extraite du fond par un A/B à trois fonds
   (prédiction vérifiée à **0,56 octet**) : teinte **210-225°** des deux côtés,
   opacité **0,603 contre 0,609**. C'est le FOND SOUS ELLE qui était trop clair.
3. ⚡ **ET LA MÊME CAUSE FERMAIT LES DEUX POSTES** : une normale de bloc **105
   fois trop grossière**.

---

## 0. ⛔ CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

**Tout est dans `.banc/P9/` — 43 captures PNG, 11 relevés JSON, le harnais, le
pilote, le récepteur, la campagne et les dix scripts de page.** Cadre
**1 280 × 800 = 1 024 000 px**, La Réunion z12, `fov = 33`, vue isométrique 0,
**socle RALLUMÉ DANS LA MÊME PAGE**, rendu **sans compositeur** dans une cible
**à profondeur**, **boucle rAF coupée**.

### ⚡ MA COURBE DE TONALITÉ, DÉCLARÉE

**OCTET LINÉAIRE** (`N02.lookLineaire`) : `clamp[0,1]` du tampon linéaire × 255,
**sans exposition, sans ACES, sans transfert sRVB**. C'est le seul des trois
looks que la notation-02 a calibrés sur le socle (énergie 14,883 contre 16,435 ;
ACES rend 4,202). Mon harnais **IMPORTE** `../P8/harnais-P8.mjs` (→ P7 → N02 →
P5 → P4 → P3), il ne les recopie pas.

### Les paires à regarder

- **`E5-zoom-CROP-avant-int-P9.png` → `E4-zoom-CROP-livre-int-P9.png` →
  `E6-zoom-SOCLE-int-P9.png`** (×3, la même découpe, la même seconde). AVANT :
  un relief **mou, en bosses fondues**, où les ravines n'existent pas. APRÈS :
  des crêtes nettes et des ravines qui descendent, à quelques pas du socle.
  SOCLE : les mêmes ravines, plus fines encore, et en olive.
- **`E1-CROP-livre-cote-P9.png` ↔ `E3-SOCLE-apparie-cote-P9.png`** — les deux
  blocs entiers, appariés à **−0,144 %**.
- **`F3-zoom6-CROP-mer-cote-P9.png` ↔ `F4-zoom6-SOCLE-mer-cote-P9.png`** (×6) —
  les deux mers. Celle du crop n'est plus un aplat turquoise ; elle a un
  moutonnement et un dégradé vers le large.
- ⚡ **`H1-carte-sansfond-P9.png`** — **la carte qui a retourné le poste n° 2** :
  en ROUGE, les **14,51 %** de l'intersection où le SOCLE compose sa mer sur du
  VIDE.

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Ce qui sépare encore les deux images, sur MES deux cadrages :

1. ⛔ **LA MER DU CROP RESTE 16,8 % TROP CLAIRE** là où les deux côtés ont
   vraiment un fond marin (78,02 contre 66,79), et **son détail vaut 84 %** du
   socle (2,829 contre 3,369). J'ai fermé une part de l'écart, pas le poste.
2. ⛔ **SA LAME D'EAU EST 1,34 FOIS TROP CLAIRE À OPACITÉ ET TEINTE ÉGALES** —
   mesuré (§3.2), **cause non identifiée**. C'est ma réserve la plus gênante.
3. ⛔ **LA NAPPE DÉBORDE TOUJOURS LA PAROI ET PEND EN LAMES** — visible en bas à
   gauche de `E1`. C'est le poste n° 1 du noteur, pas ma tâche ; il n'a pas bougé.
4. ⛔ **LE RELIEF DU CROP RESTE BRUN-ROSÉ LÀ OÙ LE SOCLE EST OLIVE** — le
   critère ② du noteur (saturation 0,1712 contre 0,2013). Autre tâche.
5. ⚠️ **LA MER DU CROP MONTRE UN LÉGER PAVAGE RECTANGULAIRE** au large sur
   `E1` : les 128 nœuds du champ de fond en travers du bloc. Non traité.
6. ⚠️ **LA NORMALE FINE EST UNE DÉRIVÉE PAR PIXEL — ELLE PEUT SCINTILLER EN
   MOUVEMENT, ET JE N'AI RIEN MESURÉ EN MOUVEMENT.** Réserve n° 4.

---

## 1. LE MANQUE N° 5 — LA DÉCOMPOSITION QUI RETOURNE LE DIAGNOSTIC

### 1.1 ⚡ LA MOITIÉ QUI MANQUE N'EST PAS CELLE QU'ON CROYAIT

Cadrage **intérieur** (celui du noteur), masques de surface appariés à
**−0,155 %**, octet linéaire, tout dans la même page
(`.banc/P9/S5-relief-P9.json`) :

| | allumé | lumière coupée | part de la lumière |
|---|---|---|---|
| **socle** | **16,086** | **8,723** | **45,8 %** *(le noteur : 45,39 %)* |
| **crop** | 10,972 | **10,250** | **6,6 %** *(le noteur : 4,22 %)* |

⛔ **LA COULEUR DU CROP EST DÉJÀ PLUS RICHE QUE CELLE DU SOCLE — 10,250 contre
8,723, soit +17,5 %.** Ce qui manque n'est pas du détail de peinture : c'est
**l'ombrage, en entier**. Le chantier cherchait à ajouter de la matière à une
image qui en avait déjà trop.

### 1.2 ⛔ LE GRAIN, CONVERTI ET POSÉ : 0,000 %

Le brief nomme `grainForceM`. Je l'ai converti et posé au lieu d'en parler.

**La conversion, dérivée du dépôt** : `_makeDemSampler` ajoute `detail × fbm` en
UNITÉS DE SCÈNE sur `scale = (span / dem.extentMeters) × exagération`. À la
valeur vivante (`detail = 0,02`, `span = 56`, `extentMeters = 27 381`,
`exagération = 2`, donc `scale = 0,004 090`), le grain du socle vaut **6,60 m de
relief**, de longueur d'onde **611 m**. Côté crop : `grainForceM = 4,89`,
`grainEchelle = detailScale × 28 = 22,4`.

| posé sur le crop | énergie de détail |
|---|---|
| départ (`grainForceM = 0`) | **10,972** |
| ⚡ **la conversion exacte** (4,89 m) | **10,972 — 0,000 %** |
| ×10 (48,9 m) | 10,993 (+0,19 %) |
| ×50 (244,5 m, 37 fois le socle) | 11,455 (+4,4 %) |

**Aller-retour à 0 canal.** Et le curseur est plafonné à
`NATURAL_DETAIL_MAX = 0,15` en mode Naturel, soit **36,7 m** — encore sous le
seuil de mesure.

➡️ ⛔ **NON PORTÉ, ET C'EST UNE DÉCISION, PAS UN OUBLI.** Une cinquième monnaie à
convertir pour un zéro mesuré, dans un chantier qui a payé quatre fois cette
famille de fautes. **La recette exacte est écrite dans `main.js`**, à la place du
commentaire qui disait « sans une mesure qu'on n'a pas faite ».

### 1.3 ⚡ LA CAUSE, ET ELLE EST ARITHMÉTIQUE

Un ombrage qui ne module pas, c'est une NORMALE qui ne varie pas.

| | maillage du bloc | segments par côté de bloc | sommets |
|---|---|---|---|
| socle | `resMaillage = 768` | **768** | **594 434** *(relevé dans la page)* |
| crop | `segmentsTuile(12) = 24` quads **par tuile**, 3 × 3 tuiles | **72** | **29 978** *(relevé dans la page)* · 5 625 *(calcul de géométrie, voir ci-dessous)* |

⛔ **DIX VIRGULE SEPT FOIS PLUS GROSSIER PAR AXE** — **768 segments contre 72**
sur le côté du bloc. Relevé au même instant, la dispersion de `N · haut` :
écart-type **0,2447** au socle contre **0,1994** au crop, et surtout un minimum
de **−1** contre **0,2126** — **le crop n'avait AUCUNE face raide**, elles
étaient toutes moyennées.

> ⛔ **CORRECTION DU 2026-08-23 — J'AVAIS PUBLIÉ « 5 625 sommets, CENT CINQ FOIS
> MOINS », ET LE RELEVÉ DE MA PROPRE EXÉCUTION DIT 29 978.**
> `S5-relief-P9.json`, produit par le run qui porte les 594 434, enregistre
> **`crop.sommets = 29 978`**, **`tuilesTouchees = 66`**, **`quadsParTuile = 64`**
> et `sommetsTotal = 170 304`. **Le 5 625 était un calcul à la main
> (9 × 25 × 25), pas une mesure.**
>
> ⛔ **ET LA GARDE AVAIT SONNÉ SANS ÊTRE RAPPORTÉE.** Le commentaire de ma
> propre sonde écrit l'attente noir sur blanc — `.banc/P9/s5-relief.js:78` :
> *« le compte de sommets retenus doit tomber sur les 9 tuiles du bloc, soit
> 9 x 25 x 25 = 5 625 au plus »*. **La mesure l'a démentie d'un facteur 5,3, et
> ni le relevé ni le démenti n'étaient dans ce rapport.**
>
> ⚡ **LA CAUSE EST IDENTIFIÉE, ET ELLE EST DANS LE BANC, PAS DANS LE CODE
> LIVRÉ** : `tuilesCrop()` (`.banc/P7/harnais-P7.mjs:96`) rend **TOUTES** les
> tuiles du globe, **tous niveaux confondus** ; le filtre Mercator de la sonde
> admet donc la pyramide EMPILÉE, d'où **66 tuiles** pour un bloc qui en a 9.
> Le témoin est dans le fichier même : `quadsParTuile = 64` est
> `segmentsTuile(z ≤ 2)`, pas les 24 de z12 — la première tuile de la liste est
> une tuile continentale.
>
> ➡️ **CE QUE JE RETIRE, ET CE QUE JE GARDE.**
> · **RETIRÉ : « cent cinq fois moins ».** Il comparait **une mesure**
> (594 434 sommets du socle) à **un calcul de géométrie** (5 625) — deux
> monnaies, le défaut endémique que le §0 du plan nomme. Et 9 × 25² compte deux
> fois les sommets des arêtes partagées, ce que 768² ne fait pas.
> · **GARDÉ : le ×10,7 PAR AXE**, qui est le rapport de deux comptes de
> segments (768 contre 3 × 24 = 72) et ne dépend d'aucun compte de sommets.
> C'est la lecture que `rapport-P11.md` réserve n° 2 fait indépendamment.
> · **BORNÉ : `nduEcartType = 0,1994` N'EST PAS CELUI DU BLOC.** Il est calculé
> sur la population empilée ; je ne le défends plus comme la dispersion des 9
> tuiles.
> · ⚡ **L'ARGUMENT, LUI, SURVIT — et il survit du bon côté.** `nduMin` est un
> **MINIMUM** : la population mesurée CONTIENT les sommets du bloc, donc le
> minimum du bloc est **nécessairement ≥ 0,2126**. « Aucune face raide » tient
> de façon **conservatrice**. Et le gain final (**97,9 %**) est mesuré sur des
> **PIXELS** (`S7-livre-int-P9.json`), pas sur des sommets : il ne touche à rien.
> *(Relecture groupée P8→P12, constat I-1.)*

⚡ **Et la donnée, elle, était là** : la texture de hauteur d'une tuile fait
**256 × 256**, et le fragment la lit DÉJÀ (`decodeMetersAA`) pour la rampe et
pour les courbes de niveau. **La couleur voyait le relief fin ; la lumière ne le
voyait pas.**

### 1.4 CE QUI EST LIVRÉ, ET CE QUE ÇA REND

La normale du bloc est reconstruite **au fragment** depuis cette hauteur — loi de
Mikkelsen, celle que porte `three` (`bumpmap_pars_fragment.glsl.js`), écrite une
seule fois dans `monde/eclairage-crop.js` §6 et **injectée**.

**Trois décisions, chacune argumentée dans le module :**

- ⛔ **SANS la normalisation de `sigma` que fait `three`.** Son propre
  commentaire dit pourquoi il la fait — *« regardless of the texture's scale »* —
  et c'est une convention d'ARTISTE : elle rend la pente proportionnelle au
  dénivelé **par PIXEL D'ÉCRAN** au lieu du dénivelé **par mètre de sol**. Sous
  elle, la même montagne s'aplatirait en s'éloignant. **Le test ⑧b l'assert : la
  loi livrée est invariante par changement d'échelle d'écran, celle de `three`
  ne l'est pas** — et le contre-exemple est rejoué à côté.
- ⛔ **LA BASE EST LA SPHÈRE NUE, JAMAIS `vNormalW`**, qui porte déjà la pente du
  maillage : la perturber par le gradient COMPLET compterait deux fois la
  composante grossière. Le globe est *« une sphère de rayon `R_GLOBE` = 100
  centrée à l'origine »* (`monde/frontiere-rendu.js`), **et je l'ai vérifié**
  (`globe.group.matrixWorld` a une translation de **(0, 0, 0)**), donc le centre
  en espace de vue est `viewMatrix × (0,0,0,1)` — pas d'uniforme de plus.
- ⚠️ **LE REPÈRE EST CELUI DE LA VUE, ET C'EST LA PRÉCISION QUI LE DICTE.** `VERT`
  écrit déjà pourquoi les sommets sont en RTC : *« ne pas payer l'ulp float32 à
  magnitude 100 »*. Une coordonnée MONDE de magnitude 100 a un ulp de 0,38 m
  quand `dFdx(P)` vaut ici quelques dizaines de mètres par pixel : la tangente
  serait bruitée de plusieurs pour cent. `vVue = mv.xyz` est relatif à la caméra.

**MESURÉ, cadrage intérieur, aller-retour d'UNIFORME à 0 canal**
(`.banc/P9/S7-livre-int-P9.json`) :

| | avant | **après** | socle |
|---|---|---|---|
| énergie de détail | 10,963 | **15,721** | **16,056** |
| **rapport au socle** | **68,3 %** | ⚡ **97,9 %** | — |
| part de la lumière dans le modelé | 6,50 % | **19,91 %** | 45,57 % |
| écart-type de luminance | 51,397 | **52,776** | 51,548 |
| luminance moyenne | 103,54 | 101,46 | 113,30 |

**401 550 canaux changent ; l'aller-retour rend 0.** Au cadrage **côte** (masques
appariés à −0,337 %), le rapport passe de **79,6 % à 101,4 %**.

⚠️ **ET LA PART DE LA LUMIÈRE RESTE DEUX FOIS PLUS FAIBLE QU'AU SOCLE (19,9 %
contre 45,6 %) ALORS QUE L'ÉNERGIE TOTALE Y EST.** Je ne prétends donc pas que le
crop et le socle fabriquent leur modelé de la même façon : le crop en met plus
dans la couleur et moins dans l'ombre. **Le poste est fermé sur la MESURE du
noteur, pas sur la mécanique.**

---

## 2. ⛔ LE MANQUE N° 2 — TROIS CHOSES SONT FAUSSES DANS LE DIAGNOSTIC

### 2.1 Le bleu profond ne vient PAS du fond marin — des deux côtés

Première mesure, cadrage côte, intersection des deux masques de mer
(**75 086 px**, `.banc/P9/S1-etat-P9.json`) :

| sur l'intersection | crop | socle |
|---|---|---|
| mer composée, luminance | 81,67 | 59,63 (**+36,96 %**) |
| mer composée, bleu profond (210-240°) | **247** | **11 324** |
| ⚡ **FOND MARIN SEUL** (nappe éteinte), luminance | **145,37** | **107,91** |
| ⚡ **FOND MARIN SEUL, bleu profond** | **0** | **0** |

➡️ ⛔ **ZÉRO PIXEL DE BLEU PROFOND SUR LES DEUX FONDS MARINS.** Le bleu profond
vient **entièrement de la lame d'eau**. Le fond, lui, était **34,7 % trop clair**
sur le crop.

### 2.2 ⚡ LA LAME D'EAU DU CROP A DÉJÀ LA BONNE TEINTE ET LA BONNE OPACITÉ

**L'expérience** (`.banc/P9/S3-lame-P9.json`) : un calque translucide composé sur
un fond vérifie `I = Cp + (1 − a)·BG`. On rend donc **le même calque sur trois
fonds** (rampe nautique forcée à trois albédos plats : 0 / 0,12 / 0,24), on tire
`a` et `Cp` des deux premiers, et **on PRÉDIT le troisième**.

| | crop | socle |
|---|---|---|
| **opacité effective** (R, V, B) | **0,6028 · 0,6029 · 0,6032** | **0,6089 · 0,6095 · 0,6098** |
| **teinte de la lame** (24 secteurs) | **210-225°** (61 085 px) | **210-225°** (47 506 px) |
| couleur de la lame, démultipliée | **15,84 · 42,10 · 69,85** | 10,72 · 31,77 · 52,30 |
| ⚡ **écart de PRÉDICTION sur le 3ᵉ fond** | **0,558 octet** | 0,601 octet |
| aller-retour | **0 canal** | 0 canal |

➡️ ⛔ **LE BRIEF ET LE NOTEUR SE TROMPENT : LA TEINTE EST LÀ, ET L'OPACITÉ EST À
1 % DE CELLE DU SOCLE.**

**Et l'ÉCHANGE tranche** : la lame du crop, INCHANGÉE, recomposée sur le fond
marin DU SOCLE rend **9 644 pixels de bleu profond (12,90 %)** contre **27
(0,036 %)** sur son propre fond.

⚠️ **Réserve sur cette expérience** : le modèle affine est exact pour le crop
(reconstruction 81,659 contre 81,672 mesuré) mais **pas pour le socle**, dont la
réfraction (`uRefract = 0,34`, passe de capture) échantillonne un pixel DÉPLACÉ :
sa recomposition rend 66,64 quand la mesure directe donne 59,68. **Les chiffres
du socle de ce tableau sont donc des ordres de grandeur, pas des valeurs que je
défends.** Le verdict, lui, ne repose que sur le côté crop.

### 2.3 ⛔ ET LA CAUSE DU FOND TROP CLAIR EST LA MÊME QUE CELLE DU RELIEF

**La décomposition affine du fond marin** (`pixel = A + B · albedo`, mesurée
pixel par pixel sur trois albédos plats, **affinité vérifiée sur le troisième à
0,25 octet**, `.banc/P9/S4` puis `S8`) :

| sur les pixels exploitables des DEUX côtés (64 037) | crop | socle | rapport |
|---|---|---|---|
| **gain de lumière `B`** — avant la tâche | 223,9 | 181,4 | ⛔ **1,234** |
| **gain de lumière `B`** — après | **193,5** | **181,4** | **1,065** |
| **albédo retrouvé** (donc la couleur de rampe peinte) | 0,1754 · 0,5342 · 0,4824 | 0,1680 · 0,5304 · 0,4781 | **1,01 à 1,04** |
| **profondeur lue `d01`** | **0,5275** | **0,5350** | **0,986** |

➡️ ⚡ **LE CROP PEIGNAIT SON FOND MARIN AVEC LA BONNE COULEUR À LA BONNE
PROFONDEUR** (albédo à 4 % près, `d01` à 1,4 % près) : **c'était sa LUMIÈRE qui
était 1,234 fois trop forte**, pour la raison du §1.3 — un fond marin lisse
prend l'hémisphère de face partout. **La normale par fragment en ferme 72 %.**

⚠️ **ET CETTE MESURE CORRIGE UN DÉFAUT DE MÉTHODE QUE J'AI COMMIS** : `S4`
publiait `d01 = 0,282 contre 0,260` avec un modèle purement MULTIPLICATIF qui
**échouait à son propre test de reconstruction (92 octets d'écart)**. **Ce chiffre
est RETIRÉ.** Le socle mélange `mix(diffuseColor, mapCol · paintShade, uTint)` —
un terme AFFINE, pas un produit. Le relevé fautif reste sur le disque
(`S2-fond-P9.json`, champ `sondeProfondeur`).

### 2.4 ⛔ ET LE CHIFFRE-TITRE DU NOTEUR EST DOMINÉ PAR UNE RÉGION QUI N'EST PAS UNE MER

⚡ **LA MESURE QUI A RETOURNÉ LE POSTE** (`.banc/P9/S9-fondnoir-P9.json`,
`H1-carte-sansfond-P9.png`). Sur l'intersection des deux masques de mer, on
sépare selon un critère qui ne se devine pas — **le socle a-t-il quelque chose
sous sa mer ?** (nappe éteinte, les trois canaux à zéro) :

| | pixels | socle lum. | socle bleu profond | crop lum. | crop bleu profond |
|---|---|---|---|---|---|
| ⛔ **le socle compose sur du VIDE** | **10 895 (14,51 %)** | **17,79** | ⛔ **10 401** | 65,28 | 238 |
| **les deux ont un fond marin** | 64 191 | **66,79** | **864** | **78,02** | ⚡ **2 824** |
| tout le masque | 75 086 | 59,68 | 11 265 | 76,17 | 3 062 |

- **Le crop, lui, A un fond sur ces pixels-là** (luminance 112,81 ; seulement
  **175 px** vides sur 10 895).
- ⛔ **92,3 % du « bleu profond » du socle (10 401 sur 11 265) vit là où il
  compose sa lame d'eau sur RIEN** — c'est-à-dire sur la couleur pure de `uDeep`,
  donc dans le secteur 210-240° par construction.
- ⚡ **Sur la région où les deux côtés ont vraiment un fond marin, LE CROP A PLUS
  DE BLEU PROFOND QUE LE SOCLE : 2 824 contre 864.**
- Et son excès de clarté y vaut **+16,8 %**, pas +36,9 %.

⚠️ **CE QUE JE NE DIS PAS, ET LA RÉSERVE QUI BORNE CE PARAGRAPHE.** Le « vide »
est la couleur de nettoyage DU BANC ; dans l'application, cette bande composerait
sur le FOND DE PAGE, pas sur du noir. **Je n'affirme donc pas que le socle a un
défaut là** — et **je n'ai pas identifié pourquoi son plan d'eau dépasse la
silhouette de son bloc au bord lointain** (`geometrieDeMer` l'arrête pourtant à
`rayonEau`, EN DEÇÀ du bloc). ⛔ **Ce que j'affirme est plus étroit et suffit :
sur 14,51 % de l'intersection, on ne compare pas deux mers, on compare une mer à
une silhouette — et c'est là que vit le chiffre-titre.**

### 2.5 CE QUE LA TÂCHE REND SUR LA MER, ET CE QU'ELLE NE REND PAS

Cadrage côte, appariement du bloc à **−0,144 %**, intersection 75 118 px,
aller-retour d'uniforme à **0 canal** (`.banc/P9/S7-livre-cote-P9.json`) :

| | avant | **après** | socle |
|---|---|---|---|
| ⚡ **fond marin, énergie de détail** | 2,089 | **4,848** | **4,839** |
| fond marin, luminance | 145,38 | **130,15** | 107,91 |
| mer composée, luminance | 81,70 | **76,19** | 59,68 |
| mer composée, **bleu profond** | 246 (0,33 %) | **3 063 (4,08 %)** | 11 281 (15,02 %) |
| mer composée, énergie de détail | 1,896 | **2,731** | 3,401 |

➡️ ⚡ **L'ÉNERGIE DE DÉTAIL DU FOND MARIN TOMBE PILE SUR CELLE DU SOCLE : 4,848
contre 4,839, +0,2 %.** Le « fond parfaitement lisse » que P8 photographiait
(`G2-zoom6-CROP-sans-nappe-P8.png`) n'existe plus.

⛔ **ET LE POSTE N'EST PAS FERMÉ POUR AUTANT** : la mer composée reste **+16,8 %**
trop claire sur la région comparable, et son détail vaut **84 %**. **P8 déclarait
une régression de −8,0 % d'énergie de mer due à son repli de frange ; je la
retrouve dans l'état d'avant (1,896) et je publie qu'elle est plus que
compensée (2,731) sans que le repli ait bougé.**

---

## 3. MES RÉSERVES

1. ⛔ **LE MANQUE N° 2 N'EST PAS FERMÉ, ET J'AI UNE CAUSE MESURÉE QUE JE N'AI PAS
   TROUVÉE.** La lame d'eau du crop est **1,34 fois plus claire** que celle du
   socle **à opacité (0,603 / 0,609) et à teinte (210-225°) égales**, et cet
   écart est un facteur UNIFORME sur les trois canaux (1,48 · 1,33 · 1,34). Les
   deux lames lisent le même `uDeep`, le même `uMerTransp = 0,57`, le même
   `uMerJour = 1`. **Je n'ai pas identifié le terme.** C'est la piste n° 1 pour
   la suite, et elle vaut probablement les 16,8 % qui restent.
2. ⛔ **UN CHIFFRE RETIRÉ, PAR SON PROPRE TEST.** `S4` publiait
   `d01 = 0,282 contre 0,260` sous un modèle multiplicatif ; sa reconstruction
   ratait de **92 octets**. Retiré, remplacé par la décomposition AFFINE de `S8`
   (0,25 octet d'écart, vérifié sur un troisième point).
3. ⛔ **DEUX MUTATIONS RETIRÉES COMME NEUTRES, ET ELLES AVAIENT RAISON.** `1f` et
   `1g` retiraient / retournaient la projection des tangentes sur le plan de la
   base. **Toutes deux ont SURVÉCU** ; l'algèbre dit pourquoi
   (`(sy − n(sy·n)) × n = sy × n`, et `det` ne voit pas la part radiale puisque
   `R1 ⟂ n`). **Trois lignes de JS et deux de GLSL, mortes, retirées de la
   source** — et ⛔ **le commentaire qui les justifiait était FAUX** : ce n'est
   pas la projection que l'oracle exigeait, c'est l'oracle qui décrivait une
   autre surface. **L'invariance est désormais une ASSERTION (⑧a-④).** Le dixième
   code mort de ce chantier trouvé par une survivante.
4. ⚠️ **JE N'AI RIEN MESURÉ EN MOUVEMENT, ET C'EST LA RÉSERVE QUI PORTE LE PLUS DE
   RISQUE SUR CE QUE JE LIVRE.** Une normale dérivée par pixel d'une texture lue
   en minification **peut scintiller**. `decodeMetersAA` moyenne cinq points sur
   l'empreinte du pixel, ce qui l'atténue, et **je vois un léger crénelage sur
   `E4-zoom-CROP-livre-int-P9.png`** ; mais toutes mes prises sont **au repos,
   boucle gelée**. Un plan de caméra en mouvement dira ce que je ne dis pas.
5. ⚠️ **LE COÛT N'EST PAS CHRONOMÉTRÉ.** La normale fine ajoute **un varying**
   (`vVue`), **deux `dFdx`/`dFdy` de vec3**, deux de scalaire, deux produits
   vectoriels et deux normalisations **par fragment de tuile**, sous une garde
   d'uniforme. Je préfère le dire que d'annoncer « négligeable ». La production
   (drapeau baissé) n'en paie rien : `uNormaleFineOn` y vaut **0**, relevé.
6. ⚠️ **LE « VIDE » DU §2.4 EST CELUI DU BANC.** Dans l'application, la bande où
   le socle compose sa mer sans fond composerait sur le fond de page. **Je n'ai
   pas cherché pourquoi le plan d'eau du socle dépasse sa silhouette là**, et je
   ne le compte pas comme un défaut du socle.
7. ⚠️ **UN BRUIT INTER-MESURE DE 795 CANAUX SUR 4 096 000, DÉCLARÉ.** L'A/B par
   RUSTINE de nuanceur (`S6`, avant que le code ne soit dans la source) rendait
   **795 canaux** au retour au lieu de zéro — 0,019 %, contre 401 748 canaux pour
   l'effet mesuré, soit **505 fois moins**. ⚡ **L'A/B final, lui, passe par un
   ALLER-RETOUR D'UNIFORME et rend 0 canal** ; c'est sur celui-là que reposent
   tous les verdicts publiés.
8. ⚠️ **UN SEUL LIEU, DEUX CADRAGES.** Tout est sur La Réunion z12, aux deux
   endroits de notation-01/02. Un crop continental (donc sans mer), un crop de
   haute latitude, un crop à plateau peu profond ne sont pas jugés ici.
9. ⚠️ **DEUX AVERTISSEMENTS DE COMPILATION, ET ILS NE SONT PAS À MOI.** La page
   journalise `warning X4000: use of potentially uninitialized variable
   (f_surfaceFx_int)` — la fonction `surfaceFx` de `monde/melange-crop.js`
   (Tâche P3). ⚡ **Preuve qu'ils me précèdent : ils apparaissent AUSSI drapeau
   BAISSÉ**, dans une page où la chaîne du crop ne tourne jamais (quatre
   occurrences). **Aucune erreur, des deux côtés du drapeau.**
10. ⛔ **CE BANC N'EST PAS LA PAGE QU'ADRIEN REGARDE** — Chrome piloté, autre
    profil, même code, même GPU, même cadre (§7 de P8, repris tel quel).

---

## 4. LES TESTS ET LA CAMPAGNE DE MUTATION

**+6 tests**, tous dans `test/crop-eclairage.test.js` (⑧a à ⑧f), plus **une
assertion ajoutée** à `test/exageration-globe.test.js` ③.

- **⑧a — contre un ORACLE INDÉPENDANT.** La surface déplacée y est construite
  point par point et sa normale prise par un vrai produit vectoriel : le jumeau
  JS n'est **pas** comparé à lui-même. 48 comparaisons sur quatre repères, dont
  un non orthogonal et un à tangentes minuscules. Plus l'invariance par
  projection (§3.3) et **le cas dégénéré** (tangentes colinéaires → la normale de
  base, pas un vecteur nul).
- **⑧b — l'invariance d'échelle d'écran**, la propriété pour laquelle on s'écarte
  de `three`, **avec le contre-exemple** : la version de `three` rejouée à côté
  ne l'a pas.
- **⑧c — la référence est LUE DANS `node_modules/three`.** Les cinq termes de
  Mikkelsen y sont exigés, **et le `normalize( dFdx( surf_pos` aussi** : le jour
  où `three` cesse de normaliser, ce test rougit et le commentaire du module
  devient faux.
- **⑧d — la transcription GLSL**, sur le texte **sans ses commentaires**, plus
  l'interdiction d'y remettre la projection morte.
- **⑧e / ⑧f — LE BRANCHEMENT**, des deux côtés : garde, base (`vNormalW` interdit
  dans le bloc), échelle sur les DEUX dérivées, **appariement des quatre
  arguments dans l'ordre**, varying des deux côtés, injection ; puis
  `poserHabillage` dans les deux sens, **`poserHabillage({})` sans le champ**,
  `retirerHabillage`, `CHAMPS_HABILLAGE`, `contexteCrop`, `setExaggeration`.

### La campagne — `.banc/P9/mutations-P9.mjs`, worktree `C:/Dev/wt-p9-mut`, **retiré en partant**

`node_modules` en **jonction** ; **`git ls-files --eol` vérifié `i/lf w/lf`** sur
les **neuf** fichiers en jeu — aucun faux survivant possible.

**36 mutations sémantiques, dont 20 visant le BRANCHEMENT (55,6 %).**

- **Premier tour : 31 / 36**, cinq survivantes.
  - ⛔ **`1f` et `1g` ont trouvé du CODE MORT** → retirées comme NEUTRES,
    **la source corrigée** (commit `ac58500`), **remplacées** par deux mutations
    qui mordent. Les compter aurait fait croire à un trou de test.
  - **`1j`** (cas dégénéré), **`3e`** (les deux tangentes échangées à l'appel) et
    **`4d`** (le défaut du paramètre qui s'allume) étaient **trois vrais trous** :
    trois assertions ajoutées.
- **Second tour : 36 / 36, aucune survivante, aucune non appliquée.**
  `.banc/P9/resultat-mutations-P9.json`.
- **Chaque mutation est remise sur le disque, les tests rejoués pour confirmer
  l'échec, puis le fichier restauré** ; `git diff --stat` du worktree vérifié
  **vide** avant retrait.

---

## 5. CLÔTURE

- `npm test` — **4 027 / 4 027** (4 021 au départ, **+6**).
- `npm run audit:tests` — **209 / 209**, aucun écart.
- `node --check` — vert sur les neuf fichiers touchés.
- **CRLF, SUR TOUTE LA PLAGE DE MES COMMITS** — `git diff --stat a0a600a..HEAD`
  et `git diff --ignore-cr-at-eol --stat a0a600a..HEAD` rendent **exactement le
  même compte** : **592 insertions, 4 suppressions, 9 fichiers**.
- **Arbre propre après commit**, **worktree de mutation retiré** (`git worktree
  list` ne le porte plus, le dossier n'existe plus, la jonction non plus).
- **Page chargée, drapeau LEVÉ** (`?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  `refus = []`, **256 tuiles**, mer et parois bâties, fond posé,
  `_baseYCrop = −0,095 512 4`, **`uNormaleFineOn = 1`**,
  **`uUnitesParMetre = 3,139 224 6·10⁻⁵` = la valeur attendue au dernier bit**,
  `contexteCrop().habillage.normaleFine === true` (**appelé, pas lu dans le
  texte**), 23 programmes, **0 erreur**.
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  terrain visible, plinthe visible, `real-water` visible avec ses **deux**
  maillages, **aucune mer ni paroi de crop**, `_baseYCrop = null`, **698 tuiles**,
  ⚡ **`uNormaleFineOn = 0` — la production est intouchée au bit près**,
  `uUnitesParMetre` juste pour l'exagération 18, 31 programmes, **0 erreur**.
- **Appariements**, balayés sur un **CLONE** de la caméra du socle, dans la même
  exécution JS que la mesure : surface intérieure **−0,155 %**, surface côte
  **−0,337 %**, bloc entier côte **−0,144 %**.
- ⚡ **PLANCHER DE BRUIT MESURÉ : 0 canal sur 4 096 000** après vingt rendus
  intercalés, et **`uMerTemps` identique au dernier chiffre** avant et après —
  le treizième piège de P8 (`geler()` qui ne gèle rien dans un onglet caché) est
  écarté par mesure, pas par confiance. Témoin nul : **0 canal**.

---

## 6. CE QUI RESTE SUR LE DISQUE

`.banc/P9/` — **43 captures PNG**, **11 relevés JSON**, `harnais-P9.mjs` (il
**IMPORTE** `../P8/harnais-P8.mjs` → P7 → N02 → P5 → P4 → P3 ; il n'écrit que
`rendreCache`, `histoTeinte`, `mesuresMerP9`, `decompoMer` et
`energieDetailMasque`), `pilote-P9.mjs`, `recois-P9.mjs` (port 5612),
`mutations-P9.mjs`, `resultat-mutations-P9.json`, et les dix scripts de page
`s1` à `s10`.

**Les paires à regarder d'abord :**

- `E5-zoom-CROP-avant-int-P9.png` ↔ `E4-zoom-CROP-livre-int-P9.png` ↔
  `E6-zoom-SOCLE-int-P9.png` — **le relief mou, le relief modelé, et le socle**
- `E1-CROP-livre-cote-P9.png` ↔ `E3-SOCLE-apparie-cote-P9.png` — les deux blocs
- `F3-zoom6-CROP-mer-cote-P9.png` ↔ `F4-zoom6-SOCLE-mer-cote-P9.png` — les mers
- ⚡ `H1-carte-sansfond-P9.png` — **les 14,51 % où le socle compose sur du vide**
- `A3-CROP-fond-seul-P9.png` ↔ `A4-SOCLE-fond-seul-P9.png` — **les deux fonds
  marins AVANT**, l'un turquoise uniforme, l'autre sombre et ravineux
- `G1-CROP-fond-livre-P9.png` ↔ `G2-SOCLE-fond-P9.png` — les deux fonds APRÈS
