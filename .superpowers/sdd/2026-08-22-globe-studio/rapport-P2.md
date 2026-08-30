# Tâche P2 — LA TEXTURE : le peigné du relief passe sur la sphère

**Statut : LIVRÉE.** · Commit **`06b2339`** sur `regroupement` (arbre propre après commit).
`npm test` — **3 872 / 3 872** (3 845 au départ, **+27**) · `npm run audit:tests` — **207 / 207**.

> **Adrien, 2026-08-22 :** *« Plus aucune texture sur la terre. »* · *« Je voudrais qu'on
> arrive à retrouver la texture comme elle était avant de faire la modification vers la
> sphère. Pour l'instant le détail est trop basique. »*

**La texture est là.** Ce qui manquait n'était ni un réglage ni un calcul : c'était **le fil**.

---

## 0. CE QUE J'AI VU À L'ÉCRAN, CÔTE À CÔTE AVEC LE SOCLE

**Toutes dans `.banc/vues-P2/`. Cadre 1 280 × 800, La Réunion z12, vue isométrique 1,
`fov = 33` lu en direct, cadrages APPARIÉS (§1).**

- **`FINAL-CROP-AVANT.png` → `FINAL-CROP-APRES.png`** — **c'est la paire à regarder.**
  AVANT : un dégradé brun-vert **lisse**, sans un grain ; le relief ne se lit que par
  l'éclairage, et la moitié basse de l'île est un aplat vert uniforme. APRÈS : **les crêtes
  sont peignées, les ravines creusées, les remparts du cirque se détachent un par un**, la
  couronne sommitale passe au blanc cassé, les fonds de vallon virent au vert humide, les
  croupes sèches à l'ocre.
- **`SOCLE-PROD-cible-z12-iso-apparie.png`** — le socle de production, drapeau baissé, **même
  fraction de cadre à 0,05 % près** (voir §1 — correction post-relecture).
- **`PEIGNE-SEUL-cible-z12-iso.png`** / **`RAMPE-SEULE-cible-z12-iso.png`** — les deux postes
  isolés, pour voir ce que chacun apporte.
- **`AVANT-cible-z12-iso.png`** / **`APRES-cible-z12-iso.png`** — la même paire, prise AVANT la
  correction du §3 : la texture y est déjà, mais la palette est encore fausse (tout vert sous
  1 163 m). **Je les laisse exprès : c'est la trace de la faute et de sa correction.**

### ⛔ ET NON, ÇA NE RESSEMBLE TOUJOURS PAS AU SOCLE

Ce qui sépare encore les deux images, et **aucun de ces points n'est de ma tâche** :

1. **Le socle est nettement plus CHAUD et plus CLAIR.** Il est éclairé par le soleil de la
   scène (`sunIntensity = 3,74`, `sunElevation = 34,3°`), il passe par le compositeur
   (exposition 0,94, contraste −0,03, saturation −0,10) et sa peinture est dosée contre
   l'albédo d'un `MeshStandardMaterial` par `mapTint = 0,68`. Le nuanceur des tuiles du globe
   n'a **rien de tout cela** — il sort une couleur, pas un albédo. **C'est l'écart le plus
   visible qui reste, et il n'est pas dans la rampe.**
2. **Les parois** : gris uni contre terracotta. *Autre tâche.*
3. **Le cartouche « RÉUNION / FRANCE », la rose des vents, l'ombre portée, le socle-plateau** :
   absents. *Autre tâche.*
4. **La mer** : le socle rend un bleu-vert profond avec une frange turquoise nette ; le crop
   rend un bleu moyen constellé de **plaques blanches**. ⚠️ **Elles étaient là AVANT ma tâche**
   (`FINAL-CROP-AVANT.png`, même forme, mêmes positions) et ma modification ne touche pas un
   pixel de mer (`!sousEau`, vérifié par mutation n° 30). C'est la réserve n° 1 de la Tâche
   K ter, localisée par elle au matériau `crop-mer`.
5. **Les deux défauts que le brief me demandait de ne pas feindre d'ignorer sont toujours là** :
   la nappe de mer et le dessus du bloc ne sont pas la même surface (deux arêtes, un
   porte-à-faux, très visible au bord est) ; et je n'ai pas descendu sous 3 km.

---

## 1. LE PIÈGE DE CADRAGE — APPARIÉ, ET PROUVÉ

⛔ **`applyIsoView` n'est même pas nécessaire pour que le piège morde : à camera
RIGOUREUSEMENT IDENTIQUE, les deux blocs n'occupent pas la même fraction du cadre.**

Protocole : même position, même cible, `fov = 33`, même cadre 1 280 × 800 ; la fraction du
cadre se mesure en **CACHANT le bloc et en comptant ce qui change** (§0 du plan, défaut n° 2 :
`getClearAlpha()` vaut 1, donc compter l'alpha rendrait 1 024 000 / 1 024 000).

| | pixels du bloc | fraction du cadre |
|---|---|---|
| crop, `?terre=unique` | **251 157** | 24,527 % |
| socle de production, MÊME caméra | **393 827** | 38,456 % |

➡️ **×1,568 en aire, ×1,252 en taille linéaire.** Comparer là aurait mesuré du cadrage.

La distance de la caméra du socle est donc multipliée par un facteur **`k`, balayé jusqu'à
égaliser les deux comptes** (`.banc/vues-P2/cadrage-apparie.json`, cinq essais consignés) :

| k | 1,20 | 1,25 | 1,26 | **1,266** | 1,27 | 1,28 |
|---|---|---|---|---|---|---|
| pixels du bloc | 279 679 | 257 674 | 253 588 | **251 135** | 249 585 | 245 707 |
| écart au crop | +11,31 % | +2,55 % | +0,93 % | **−0,05 %** | −0,67 % | −2,21 % |

➡️ **Les cadrages sont appariés à 0,05 %**, vingt fois mieux que le 1 % demandé. Toutes les
paires du §0 sont prises là.

> ⚠️ **Correction post-relecture (constat groupé ①, relecture P2 C1) :** cette ligne disait
> auparavant *« 0,009 %, cent fois mieux »*. Ce chiffre substituait, sans le dire, une
> référence prise ~15 minutes plus tard dans une mesure séparée (`bilan-final-P2.json`,
> `fractionBloc.changes = 251157`) à la place de la référence de `cadrage-apparie.json`
> lui-même (`cropPixelsBloc: 251258`). Recalculé contre sa propre source —
> `(251135 − 251258) / 251258` — l'écart vaut **−0,05 %**, pas −0,009 %. La conclusion de
> fond reste intacte : 0,05 % est encore vingt fois sous la barre de 1 % que le brief
> demandait, et les comparaisons visuelles du §0 restent valides.

---

## 2. LE DIAGNOSTIC, ET IL EST PLUS SIMPLE QUE PRÉVU

`src/terrain-analysis.js` fait 546 lignes et **n'a aucune importation** : la texture
d'analyse (R peigné, G ombrage, B humidité, A exposition) **existait, était cuite pour le
bloc, et était payée**. Personne ne la passait au globe : `contexteCrop` ne transmettait ni
elle, ni la table de couleur, ni un seul des dix curseurs d'Atlas.

⚠️ **ET L'APPLICATION LES DEMANDE À FOND, PAR DÉFAUT.** Le gabarit d'ouverture
(`public/templates/defaults/shibustart.json`, chargé par `main.js` via `STARTUP_LOOK`) pose
`colorMode: "natural"`, **`texShade: 1`**, `wetK: 0,96`, `rampDry: 0,84`, `rampWet: 1`,
`heightContrast: 1,5`, `heightPivot: 0,6`. Relevé dans l'application vivante ce jour :
`terrain.mapUniforms.uAnalysisOn = 1`, `uTexShade = 1`. **Le socle qu'Adrien compare est en
mode Naturel à l'intensité maximale ; le globe n'en portait rien.**

---

## 3. ⛔ CE QUE LE CADRAGE APPARIÉ A RÉVÉLÉ, ET QUI N'ÉTAIT PAS DANS LE BRIEF

**Une première version portait le peigné et les curseurs et rendait une image FAUSSE** —
texturée, mais verte partout sous les sommets (`APRES-cible-z12-iso.png`). Mise à côté du
socle, la cause s'est nommée toute seule :

> ⚠️ **`hNorm` n'est pas la même grandeur des deux côtés.**

Le socle normalise sur `uHeightRange`, l'amplitude **complète** de son MNT, **fond marin
compris** : relevé dans l'application, La Réunion z12, il couvre **−2 116 → 2 626 m**, donc le
**niveau de la mer y tombe à `hNorm = 0,4462`**, pas à zéro. Le `hNorm` de la Tâche D, lui,
part de `uLandBas` (le minimum de la **terre**) — le bon choix pour `float t`, où la mer a son
propre segment `[0 ; 0,35]`, et **le mauvais pour `uHeightPivot`, `uTreeLine` et `uHazeAlt`,
qui sont des réglages d'utilisateur posés dans l'échelle du socle.**

Avec les valeurs vivantes (`pivot = 0,65`, `contraste = 2,5`) :

| altitude | rampT socle | rampT « hNorm terre » | rampT `hNormRelief` |
|---|---|---|---|
| 0 m | 0,000 | 0,000 | 0,000 |
| 200 m | 0,096 | **0,000** | 0,104 |
| 500 m | 0,254 | **0,000** | 0,264 |
| 1 000 m | 0,518 | **0,000** | 0,531 |
| 1 500 m | 0,781 | 0,326 | 0,797 |
| 2 000 m | 1,000 | 0,810 | 1,000 |

➡️ **`rampT` valait ZÉRO pour tout ce qui est sous 1 163 m — l'aplat olive sur toute l'île.**
Et la limite des arbres tombait à 2 378 m au lieu de 2 247 m.

**La conversion est exacte et ne demande aucune mesure neuve** : le minimum du relief du crop
**EST** `−uOceanDepth` (`rampe-crop.js` : `profondeur = −min(0, minM)`) et son maximum
`uLandMax`. Relevé le même jour : **−2 106,8 et 2 584,4** côté globe contre **−2 116 et 2 626**
côté socle, soit **0,0029** d'écart sur le `hNorm` du niveau de la mer. C'est la même grandeur,
mesurée par deux balayages de finesse différente (128² points contre le champ entier).

`test/crop-naturel.test.js` ⑤d **rejoue les deux conventions** et exige que celle du nuanceur
suive le socle à 0,02 près **et** que la fausse s'en écarte de plus de 0,05 — sans quoi le test
ne distinguerait rien.

---

## 4. CE QUI A ÉTÉ FAIT — UNE EXTRACTION, PAS UNE TRANSCRIPTION

⚠️ **Le brief demandait de « transcrire » le bloc de `terrain.js:1063-1092`. J'ai fait mieux,
et je crois que c'est le bon geste** (D13 §③ : « ① adapter · **② extraire en module pur
partagé** · ③ copier en dernier recours »).

`src/monde/naturel-crop.js` — **module pur, aucune importation** — porte la loi **une seule
fois**, en JS (les jumeaux testables) **et en GLSL** (`GLSL_NATUREL`). **`terrain.js` ET
`globe.js` INJECTENT ce même texte.** Il n'y a donc pas deux écritures à garder d'accord :
il y en a une.

- `natPlancherPivot`, `natRampT`, `natHumiditeY`, `natEcartPeigne`, `natSoftLight`,
  `natPeigne`, `natLuminance`, `natVoile`, `natBrume`.
- `terrain.js` les appelle (`③c` l'exige), et **son `fxBlend` mode 10 délègue au soft light
  partagé** — c'était la seule autre écriture du soft light du dépôt.
- `③b` **interdit** qu'une des sept formules reparaisse dans `terrain.js` ou `globe.js`,
  **commentaires retirés avant de chercher** (la survivante de la Tâche K ter lisait une
  formule dans un pavé de prose).

### Le fil, maillon par maillon

`contexteCrop` (`main.js`) → `habillage.analyse` (`uAnalysisOn > 0.5 ? uAnalysis : null`,
même patron que `coastMask` et `sol`), `habillage.rampe2D` (**`terrain.mapUniforms.uRampTex`,
LE MÊME OBJET**), et les dix curseurs **lus dans les uniformes du socle, jamais dans `params`**
(`applyColorParams` porte deux règles que `params` ne porte pas : les défauts, et `uHemi`, que
le socle dérive de la LATITUDE du MNT — relevé à **−1** ici, hémisphère sud).

⚡ **`rampDry`, `rampWet` et `rampOklab` arrivent sur la sphère SANS UN SEUL UNIFORME** : ils
sont cuits dans la table 2D qu'on partage. C'est la raison d'être du partage.

`CHAMPS_HABILLAGE` (`branchement-crop.js`) → **treize champs de plus**, surveillés par image.
⚠️ **`analyse` est le champ le plus en retard de toute la liste** : elle sort d'un travailleur
~464 ms après la naissance du crop (mesure de `terrain.js`). Sans surveillance, le peigné
n'apparaîtrait qu'au prochain changement de LIEU. **`rampe2D` change d'identité à chaque
palette** (`rebuildRamp` DISPOSE l'ancienne texture) : absent d'ici, le globe aurait gardé un
`THREE.Texture` disposé.

`globe.js` → quatorze uniformes, **deux samplers de plus : six à huit**, pour un plafond de
seize. Le pavé qui annonce le compte est vérifié par une assertion (`crop-habillage` ①), parce
qu'un commentaire qui dit six pendant que le nuanceur déclare huit est exactement le genre de
prose que la Tâche K ter a trouvée verte à tort.

### Étape 4 — LES CURSEURS MORTS

| curseur | état |
|---|---|
| `texShade`, `wetK`, `expoK`, `treeLine`, `hazeAmt` (+ `hazeAlt`, `hazeDist`, `hazeColor`) | **vivants**, uniformes |
| `rampDry`, `rampWet`, `rampOklab` | **vivants**, cuits dans la table partagée |
| `heightContrast`, `heightPivot` | **vivants**, dans l'échelle du socle (§3) |
| **`mapTint`** | ⛔ **LAISSÉ.** Il dose la peinture **contre l'albédo d'un `MeshStandardMaterial`** et contre les matières de relief (`diffuseColor.rgb = mix(diffuseColor.rgb, mapCol · paintShade, effTint)`). Le nuanceur des tuiles du globe est un `ShaderMaterial` **nu** : ni albédo, ni matière de surface, ni bruit de révélation. **Il n'y a rien contre quoi doser.** Lui donner un sens ici serait inventer une seconde loi. |
| **`slopeTint`** | ⛔ **LAISSÉ.** C'est la branche `else` du mode **Classique**, et elle lit `slope`, tiré de la **normale du relief** (`vNormal` du maillage du bloc). Les tuiles du globe ne portent que `vNormalW`, la normale de la **sphère** : la pente du terrain n'existe pas dans ce nuanceur. La fabriquer par dérivées d'écran serait une seconde loi de pente, dans une autre unité, pour un poste **mort** dans le gabarit d'ouverture (`colorMode: "natural"`). |

**Les deux sont déclarés dans l'en-tête du module, pas cachés.**

---

## 5. LES MESURES — ET LEURS DÉNOMINATEURS

**Toutes les données brutes sont sur le disque** : `.banc/vues-P2/bilan-final-P2.json`,
`postes-P2.json`, `cout-P2.json` (les 800 chronos bruts inclus), `cadrage-apparie.json`,
`mesures-P2.json`, `etat-apres.json`, `.banc/resultat-mutations-P2.json`.

### Le banc rend-il quelque chose ? — la question du §0

- **Témoin** : deux cadres consécutifs, rien touché → **0 pixel** sur 1 024 000.
- **Et ce zéro est une PREUVE, pas un banc vide** : cacher le globe change **251 157 pixels**.
  Le chemin de mesure est le **rendu du globe seul dans une cible À PROFONDEUR**, jamais le
  canevas de la page (⚠️ `gl.getContextAttributes().depth === false` — un rendu dirigé vers lui
  dessine sans test de profondeur), et **sans compositeur**, donc **sans le grain de pellicule
  animé** qui fait diverger deux prises consécutives.
- **Aller-retour** : après extinction puis rallumage des deux interrupteurs → **0 pixel**.

### Ce que la tâche déplace

Cadre 1 280 × 800. **Deux dénominateurs, nommés : le CADRE (1 024 000 px) et le BLOC
(251 157 px).**

| poste | pixels changés | % du cadre | **% du BLOC** | amplitude moyenne | max |
|---|---|---|---|---|---|
| peigné + ombrage seuls | 101 319 | 9,894 % | **40,34 %** | 30,22 / 255 | 87 |
| table + pivot/contraste seuls | 101 411 | 9,903 % | **40,38 %** | 50,53 / 255 | 210 |
| **les deux** | **101 423** | **9,905 %** | **40,38 %** | **62,49 / 255** | **249** |

⚠️ **Les deux postes touchent presque exactement le MÊME ensemble de pixels** (101 319 et
101 411 pour 101 423 en union) : c'est la signature d'un poste **terre seule** — la mer est
exclue par construction, et la mutation n° 30 le vérifie.

📎 **Point de comparaison, et la monnaie est la même** : la Tâche C avait mesuré que les quatre
postes d'habillage portés ne déplacent que **1,01 % des pixels**. Celui-ci en déplace **9,90 %
du même cadre**. ⚠️ **Je n'ai pas rejoué la mesure de la Tâche C** : je reprends son chiffre tel
qu'elle l'a publié, sur un cadre et un lieu qui ne sont pas forcément les miens. **Le rapport
9,8× est donc indicatif, pas mesuré.**

### Étape 5 — LE COÛT

⛔ **MA PREMIÈRE CAMPAGNE EST RETIRÉE.** En séries séparées (allumé, éteint, allumé, éteint)
les médianes tombaient à **3,4 / 2,2 / 2,1 / 1,5 ms** : une dérive monotone où **l'ordre pesait
plus que le poste mesuré**. Le chiffre qu'elle donnait (+0,132 ms) est **faux, et je ne le
remplace pas par lui-même**.

Campagne retenue : **paires ABBA alternées**, boucle rAF **coupée**, `readPixels` d'un pixel
après chaque rendu pour **forcer la synchronisation**, 60 tours de chauffe jetés,
**400 paires** :

| | moyenne | médiane | Q1 | Q3 |
|---|---|---|---|---|
| allumé | 1,340 ms | 1,10 | 0,90 | 1,70 |
| éteint | 1,300 ms | 1,10 | 0,90 | 1,50 |
| **différence appariée** | **+0,0395 ms** | **0,00** | −0,10 | +0,20 |

**Écart-type 0,300 ms, erreur type 0,0150 ms → l'effet vaut 2,6 écarts-types.** Sur un cadre de
**1,024 Mpx** et **41 appels de dessin**, cela fait **≈ +0,039 ms/Mpx**, soit **+3,0 %** de la
passe du globe. ⚠️ **La médiane est nulle** : le pas du chronomètre est de 0,1 ms sur ce
navigateur, donc l'effet est **sous le quantum**, et c'est la moyenne sur 400 paires qui le
distingue du bruit. **Il est au-dessus du bruit, mais de peu, et il faut le dire.**

⛔ **CE QUE JE N'AI PAS MESURÉ, ET JE NE LE DEVINE PAS** : **le coût de LIAISON des deux
samplers ajoutés.** Il se paie que l'uniforme soit à 0 ou à 1 — cet A/B ne peut donc pas le
voir. Le mesurer demanderait **deux builds**. C'est précisément le poste que la Tâche C a
trouvé dominant côté socle (0,660 ms sur 1,087 pour douze liens), **et je n'en dis rien plutôt
que d'en dire un chiffre faux.**

---

## 6. LE SOCLE DE PRODUCTION EST INTOUCHÉ — BIT À BIT

J'ai refactorisé le nuanceur du socle. **Ce n'est pas une promesse, c'est une mesure.**

Protocole : socle seul (nuages, bateaux, trafic, lieux, plateau, eau **cachés** — deux
chargements ne les remettent pas au même état), taille du canevas **forcée** à 1 280 × 800 (⚠️
le volet du navigateur la change entre deux chargements : 1 088 × 680 puis 1 280 × 800 relevés,
et deux images de tailles différentes ne se comparent pas), caméra posée à la main, rendu dans
une cible à profondeur, comparaison PNG hors ligne (`.banc/diff-png-P2.mjs`).

`git stash push -- src/terrain.js` → chargement → capture `SOCLE-AVANT-P2` → `git stash pop` →
deux chargements → captures `SOCLE-P2-B` et `SOCLE-P2-C`.

| paire | pixels différents sur 1 024 000 |
|---|---|
| AVANT-P2 (sans l'extraction) **vs** P2-B (avec) | **0** |
| AVANT-P2 **vs** P2-C (avec) | **0** |
| P2-B **vs** P2-C (les deux avec) | **0** |

⚠️ **UNE QUATRIÈME CAPTURE, `SOCLE-P2-A`, DIFFÈRE DES TROIS AUTRES DE 3,11 % (31 850 px,
amplitude moyenne 32,79) — ET JE DIS POURQUOI PLUTÔT QUE DE LA CACHER.** Elle a été prise dans
une page que j'avais **déjà manipulée** (harnais posé, objets cachés puis rendus, caméra
déplacée, renderer redimensionné) ; les trois autres sortent d'un chargement propre. **Elle
mesure ma manipulation, pas le code.** Elle reste sur le disque.

➡️ **L'extraction laisse le socle bit-identique sur 1 024 000 pixels, vérifié sur trois
chargements.**

---

## 7. LES TESTS ET LA CAMPAGNE DE MUTATION

`test/crop-naturel.test.js` — **+27 tests**, en cinq sections :

- **①** la loi pure, et **chaque constante remonte à `terrain.js`** ;
- **②** le **TEXTE GLSL traduit et EXÉCUTÉ** contre les jumeaux JS, canal par canal
  (3 528 combinaisons pour l'humidité seule — **le dénominateur est compté par la boucle,
  pas annoncé par le titre**) ;
- **③** **l'unicité de l'écriture**, formule par formule ;
- **④** le **branchement** (`contexteCrop`, `CHAMPS_HABILLAGE`, `poserHabillage`,
  `retirerHabillage`, le constructeur) ;
- **⑤** les gardes du nuanceur, **exécutées** (la borne du crop est évaluée sur six points).

⚠️ **DEUX ASSERTIONS ONT ÉTÉ CORRIGÉES PARCE QU'ELLES ÉTAIENT FAUSSES, PAS PARCE QU'ELLES
ÉCHOUAIENT :**

1. **« `natRampT` rend `hNorm` AU BIT PRÈS » était FAUX.** `0,5 + (hNorm − 0,5) · 1` n'est pas
   `hNorm` en virgule flottante. Mesuré sur 100 001 valeurs : **2,78 × 10⁻¹⁷** en float64,
   **1,49 × 10⁻⁸** en float32 (la précision du GPU). Un texel de LUT vaut **1,95 × 10⁻³** :
   l'écart est **131 000 fois plus petit qu'un texel**, donc neutre à l'écran et **pas** au bit.
   Le vrai filet bit-à-bit de la production reste `uRampCropOn = 0`.
2. **« la brume est l'identité exacte à force nulle » était FAUX** aussi
   (`(c − 0,5) · 1 + 0,5` rend 0,020000000000000018 pour 0,02). Affirmé à l'ULP près, et le
   nuanceur ne franchit ce bloc que sous `uHazeAmt > 0.001`.

### La campagne — `.banc/mutations-P2.mjs`, worktree `C:/Dev/wt-p2-mut`, **retiré en partant**

⚠️ **`node_modules` était une JONCTION vers l'arbre principal** — un worktree sans lui rendrait
« tout vert » alors que tout échouerait déjà. Et **`core.autocrlf = false`** dans ce dépôt :
les cinq fichiers touchés sortent en **LF pur** dans le worktree (vérifié : 0 CRLF), donc pas
de faux survivant.

**34 mutations sémantiques, dont 20 visant le BRANCHEMENT** (le fil, la liste de surveillance,
les deux poseurs, le constructeur).

**Premier tour : 30 / 34.** Trois motifs n'avaient pas été appliqués (le GLSL du module
**interpole ses constantes**, `${PART_OMBRAGE.toFixed(2)}` : mes motifs cherchaient `0.35`) —
elles ne prouvaient donc rien, et **le script le dit à voix haute plutôt que de les compter
comme mortes.**

⛔ **Une seule VRAIE survivante, et elle a trouvé un trou réel : `u.uHemi.value = hemi` figé à
`1`.** Mon ④c ne vérifiait que trois curseurs sur dix. **`uHemi` renverse l'adret et l'ubac de
tout l'hémisphère SUD — c'est-à-dire du lieu de référence de tout ce chantier** (La Réunion,
`uHemi = −1` relevé). L'assertion pose maintenant **les dix curseurs à des valeurs distinctes
de leur défaut**, et exige que chacun soit posé (elle vérifie même qu'aucune valeur d'essai
n'est égale au défaut — sans quoi la mutation ne se verrait pas).

**Second tour : 34 / 34.** `.banc/resultat-mutations-P2.json`.

---

## 8. CLÔTURE

- `npm test` — **3 872 / 3 872** (3 845 au départ, **+27**).
- `npm run audit:tests` — **207 / 207**, aucun écart.
- `node --check` — vert sur `src/globe.js`, `src/terrain.js`, `src/main.js`,
  `src/monde/naturel-crop.js`, `src/monde/branchement-crop.js`, `test/crop-naturel.test.js`,
  `test/crop-habillage.test.js`, `test/crop-rampe.test.js`.
- **CRLF** — `git diff --cached --stat` et `git diff --cached --ignore-cr-at-eol --stat`
  rendent **exactement le même compte** : **1 523 insertions, 68 suppressions, 9 fichiers**.
  Aucun faux diff.
- **Arbre propre après commit** (`git status --porcelain` vide), **worktree de mutation
  retiré** (`git worktree list` ne le porte plus, le dossier n'existe plus).
- **Page chargée, drapeau BAISSÉ** (`?globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`) :
  `terreUniqueBranchee = false`, socle plat visible, `uAnalysisOn = 0`, `uAnalysis = null`,
  `uRampCropOn = 0`, `uRampCrop = null`, `uTexShade = 0`, `uWetK = 0`, `uExpoK = 0`,
  `uHemi = 1`, `uTreeLine = 0,62`, `uHeightContrast = 1`, `uHeightPivot = 0,5`,
  `uHazeAmt = 0`, `uHazeColor = b9c6d6`, `uLandMax = 5 600`, `uOceanDepth = 6 000`,
  `uContourInterval = 500`, `veilleCrop.rafraichissements = 0`. **La production est intouchée.**
- **Page chargée, drapeau LEVÉ** (`?terre=unique&…`) : chaîne posée, `refus` **vide**,
  `uAnalysisOn = 1`, `uRampCropOn = 1`, `uTexShade = 1`, `uWetK = 0,96`, `uHemi = −1`,
  `uHeightContrast = 2,5`, `uHeightPivot = 0,65`, et — **la vérification qui compte** —
  `terrain.mapUniforms.uAnalysis.value === globe.uniforms.uAnalysis.value` et
  `terrain.mapUniforms.uRampTex.value === globe.uniforms.uRampCrop.value` : **le globe tient
  les MÊMES objets `three` que le socle**, pas des copies.
- **Aucune erreur JS, aucune erreur de compilation de nuanceur**, des deux côtés du drapeau
  (recherche par motif `uncaught|TypeError|ReferenceError|shader|GLSL|program` : zéro
  résultat ; `renderer.info.programs.length` passe de 20 à 24 selon l'état, aucun échec de
  validation). **Les seules erreurs de console sont des `404` et des délais réseau sur les
  tuiles**, présents des deux côtés.

---

## 9. MES RÉSERVES

1. ⚠️ **UN SEUL LIEU, UN SEUL CADRAGE.** Tout est sur La Réunion, z12, vue isométrique 1.
   Un crop **continental** (pas de mer, donc `uOceanDepth` au plancher) ferait de
   `hNormRelief` presque exactement `hNormTerre` — la conversion du §3 y est bénigne, mais
   **je ne l'ai pas vérifiée à l'écran**. Un crop de **haute latitude** (`uHemi = +1`) non plus.
2. ⚠️ **LA COUTURE POSSIBLE AU BORD DU CROP, ET JE NE L'AI PAS CHERCHÉE À L'ÉCRAN.** L'analyse
   est bornée par un `step` net (`dansCrop`) : hors du crop, `anl` retombe d'un coup sur son
   neutre. **C'est le patron de la maison** (`uFondChamp` fait exactement pareil avec
   `uFondPortee`) et l'alternative — laisser le `ClampToEdge` prolonger la dernière ligne —
   peindrait les Andes avec les crêtes de La Réunion, ce que la Tâche K ter a déjà vu arriver
   au masque de côte. **Mais un liseré d'un pixel au moment du fondu reste possible**, et mes
   captures sont toutes prises **au repos**, où les alentours ne sont pas dessinés.
3. ⚠️ **LE COÛT DE LIAISON DES DEUX SAMPLERS N'EST PAS MESURÉ** (§5). C'est le poste que la
   Tâche C a trouvé dominant côté socle, et il se paie **par tuile** sur une sphère.
4. ⚠️ **L'ÉCART DE LUMIÈRE RESTE ENTIER, ET C'EST LUI QUI SAUTE AUX YEUX MAINTENANT.** La
   texture est portée ; ce qui sépare encore les deux images, c'est que le socle est un
   `MeshStandardMaterial` éclairé, dosé par `mapTint`, passé au compositeur, et que la tuile du
   globe est une couleur nue. **Aucune rampe ne comblera cet écart-là.** Je le signale parce
   que la prochaine tâche qui cherchera « pourquoi ce n'est pas encore le socle » le trouvera
   là, et pas dans le peigné.
5. ⚠️ **`uContourOpacity` vaut 0 dans le gabarit d'ouverture** : les courbes de niveau — dont
   l'intervalle est bien calé à 250 m — ne se voient pas. Réserve héritée de la Tâche K ter,
   toujours ouverte.

---

## 10. CE QUI RESTE SUR LE DISQUE

`.banc/serveur-vues-P2.mjs` (port 5599) · `.banc/mutations-P2.mjs` ·
`.banc/diff-png-P2.mjs` (comparateur PNG sans dépendance) ·
`.banc/resultat-mutations-P2.json` · `.banc/vues-P2/` — **20 captures et 6 fichiers de relevés
bruts**, dont les 800 chronos de la campagne de coût.
