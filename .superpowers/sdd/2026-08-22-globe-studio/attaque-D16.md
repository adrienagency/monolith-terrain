# ATTAQUE D16 — CE QUI SAUTE ENCORE

> **Rôle : attaquant.** Mission : casser *« De l'orbite au bloc, la caméra ne
> saute plus. Ni en position, ni en axe, ni au retour. »*
> ⛔ **Aucune ligne de `src/` n'a été touchée.** `git status` sur `src/` est
> vide ; les seuls fichiers ajoutés sont deux sondes (`scripts/`) et des traces
> (`.banc/D16/`).

**Arbre** `C:\Dev\wt-merge`, branche `regroupement`, sommet `2c9b458`.
**Matériel** ANGLE (NVIDIA RTX 3080, D3D11), Chrome sans tête 1280 × 800,
serveur `npm run dev -- --port 5551 --strictPort`, **mode sphère par défaut**
(aucun paramètre d'URL).
**Instruments** `scripts/sonde-attaque-d16.mjs` (copie étendue de
`scripts/sonde-d16.mjs` — scénarios `clic-suite`, `pano-descente`,
`resize-descente`, `va-et-vient`, `z16`, options `--cpu`, `--lieu`, `--grille`)
et `scripts/diag-attaque-vide.mjs` (neuf). ⚠️ **`sonde-d16.mjs` et
`lit-sonde-d16.mjs` n'ont PAS été modifiés** : les traces d'origine restent
rejouables au bit près.

---

# ⚡ LE RÉSULTAT EN UNE LIGNE

> **La phrase est vraie POUR LA MOLETTE, ET SEULEMENT POUR ELLE.**
> **Au clic, la caméra de rendu saute onze fois : ×2,2287 d'altitude et 99,4 %
> de déplacement relatif en UNE image au premier clic, puis ×1,38 à ×1,4304 à
> chacun des dix paliers suivants — contre ×1,0281 et 2,18 % pour la molette,
> que je reproduis.**

**5 ruptures trouvées.** Et un défaut plus grave que toutes, hors du périmètre
« caméra » mais sur le chemin de l'usager : **au-dessus de tout relief de plus
de ~1 000 m, la descente traverse le bloc et finit sur un écran vide.**

---

# ① LA LIGNE DE BASE — je reproduis les chiffres attaqués, sinon rien ne vaut

Trace `.banc/D16/ATT-ref.json` — descente à la molette depuis `MAX_ALT_M`,
1 384 images, **0 erreur de page**.

| affirmation du rapport | son chiffre | **le mien** |
|---|---|---|
| aucune bascule pendant la descente | 0,000 057° | **0,000 057 298°** |
| balayage plafonné | 1,5000°/image | **1,5000°** |
| balayage court | 1 093 ms | **1 096 ms sur 62 images** |
| dernière molette → bascule | 5 558 ms | **5 300 ms** |
| rapport d'altitude de fond MAX | 1,0322 | **1,0281** |
| déplacement relatif du fond MAX | 0,021987 | **0,021775** |
| sortie d'orbite, rapport d'altitude | 1,0063 | **1,0063** (`ATT-remontee`, n992) |
| sortie d'orbite, rotation de visée | 0,882° | **0,952°** |
| ancre-centre au pire cran | 15,2215° | **15,2215°** |

➡️ **Tout est reproduit.** Les cinq franchissements ont bien disparu du relevé :
sur mes 1 384 images, `dViseeG` ne dépasse 0,5° qu'au balayage voulu.
**Je pars de là, et je n'en discute plus.**

---

# ⚡ RUPTURE 1 — LE CLIC SUR LE GLOBE SAUTE ONZE FOIS

**C'est l'angle mort n° 1 du brief, et il tombe.**

## Le premier clic — orbite → surface

Traces `.banc/D16/ATT-clic1.json` et `.banc/D16/ATT-clicsuite.json`
(**deux sessions, même chiffre**), image `n3`, marque `CLIC` :

| grandeur, en UNE image | valeur | la même sur la molette |
|---|---|---|
| **rapport d'altitude de fond** | **2,2287** (60 000 → 26 921 km) | 1,0281 |
| **déplacement relatif de `camGlobe`** | **0,99357** | 0,021775 |
| durée de l'image | 134,9 / 138,6 ms | — |
| rotation de visée de `camGlobe` | 0,000° | — |
| axe de la caméra du BLOC | 111,260° | 111,26° (traversée) |

⚠️ **L'axe ne bouge pas** — la correction de D16 ter tient. **C'est la POSITION
qui saute** : la caméra tombe de 519,2 unités de globe (33 079 km) d'une image à
la suivante, radialement.

## Les dix clics suivants — surface → surface

`ATT-clicsuite`, 2 368 images, 0 erreur de page. **Onze clics enchaînés
descendent de l'orbite au crop, un palier par clic.** Toutes les images dont le
rapport d'altitude de fond dépasse 1,05 :

| image | altitude de fond après | **rapport en 1 image** | déplacement relatif | durée |
|---|---|---|---|---|
| n3 | 26 921 489 m | **2,2287** | **0,9936** | 134,9 ms |
| n450 | 9 655 446 m | **1,3830** | 0,2307 | 167,2 ms |
| n631 | 4 744 690 m | **1,4076** | 0,1740 | 259,3 ms |
| n857 | 2 350 577 m | **1,4207** | 0,1134 | 174,8 ms |
| n1065 | 1 169 852 m | **1,4275** | 0,0663 | 169,7 ms |
| n1278 | 586 181 m | **1,4242** | 0,0357 | 175,4 ms |
| n1496 | 292 763 m | **1,4256** | 0,0187 | 300,7 ms |
| n1712 | 146 300 m | **1,4273** | 0,0096 | 383,8 ms |
| n1898 | 73 130 m | **1,4280** | 0,0049 | 345,6 ms |
| n2093 | 36 560 m | **1,4304** | 0,0025 | 368,2 ms |

**Et ce sont bien des sauts, pas un mouvement voulu.** Les six images qui
précèdent `n450` rendent 1,0147 / 1,0120 / 1,0095 / 1,0073 / 1,0039 / 1,0013 —
une approche qui ralentit ; puis **une image à 1,3830**, puis **1,0000 pendant
les six suivantes**. Le geste s'arrête net sur son propre saut.

➡️ **`DIVE_TIERS` est abrogée sur le papier ; à l'écran elle gouverne toujours
le clic.** `_niveauDePlongee` sort à sa première ligne quand `zoomImpose != null`
— c'est-à-dire pour tout clic — et ne voit jamais la branche continue
(`src/modes.js:830-833`). **Lecture de code, donnée ici comme piste, pas comme
mesure.**

⚠️ **Ce que je n'ai PAS mesuré** : le clic sur un point *au bord du disque* (le
mien tombe au centre de l'écran), et le clic sur une machine bridée.

---

# ⚡ RUPTURE 2 — LE PAS PAR IMAGE N'A PAS DE PLAFOND : IL SUIT LA DURÉE DE L'IMAGE

Trois attaques indépendantes rendent le **même** mécanisme : sur une image
longue, le lissage du zoom orbital rattrape tout son retard d'un coup.

| ce que j'ai fait | rapport d'altitude MAX | déplacement relatif MAX | l'image coupable |
|---|---|---|---|
| **rien** (`ATT-ref`) | 1,0281 | 0,021775 | — |
| **CPU bridé ×4** (`ATT-cpu4`) | **1,0486** | **0,031546** | — |
| **CPU bridé ×10** (`ATT-cpu10`) | **1,0560** | **0,038086** | — |
| **molette PENDANT un glissement** (`ATT-pano2`) | **1,0527** | **0,046504** | n17, **124,8 ms** |
| **aller-retour sans pause** (`ATT-vav`) | **1,1005** | **0,067345** | n2490, **642,7 ms** |

⚡ **Le pire : ×1,1005 d'altitude et 6,73 % de déplacement en UNE image**, sur
une image de 642,7 ms, en orbite à 12 954 963 m. **C'est trois fois l'excédent
publié** (1,0281 → 1,1005 : 2,81 % → 10,05 %).

⚠️ **Il ne diverge pas** : à ×10 de bridage, l'image la plus longue vaut
5 362 ms et le rapport reste 1,0560. Le lissage sature. **Je publie donc ceci
comme une DÉGRADATION mesurée, pas comme un effondrement.**

⚠️ **L'axe tient partout** : `dViseeG` MAX vaut 1,4696° / 1,5000° / 1,3922° —
jamais au-dessus du plafond de R4. **La moitié « axe » de l'affirmation résiste
à tout ce que je lui ai fait.**

---

# ⚡ RUPTURE 3 — SUR UNE MACHINE LENTE, LA BASCULE S'ÉTIRE ×3,97 ET LE DÉLAI FRANCHIT LA BARRE

Le brief de D16 pose la barre : ⛔ *« Une descente qui ne saute pas mais qui met
dix secondes n'est pas une réussite. »*

`ATT-ref` (libre) contre `ATT-cpu10b` (`Emulation.setCPUThrottlingRate ×10`,
même geste, même attente de 60 s) :

| | libre | **CPU ×10** |
|---|---|---|
| durée de la bascule de trois quarts | **1 096 ms** sur 62 images | **4 356 ms** sur 34 images — **×3,97** |
| pire rotation par image | 1,5000° | **1,5000°** — le plafond tient |
| **dernière molette → bascule** | **5,30 s** | **11,98 s** — **×2,26** |
| durée d'image p95 | 105,6 ms | 2 010 ms |
| durée d'image MAX | 425 ms | **5 362 ms** |

⚡ **11,98 s entre le dernier cran et la vue de trois quarts.** La réserve n° 2
du rapport disait *« je ne sais pas si Adrien trouvera ce délai juste »* pour
5,558 s. **Sur une machine quatre fois plus lente que la sienne, il double.**

⚠️ À ×4 la bascule **n'est jamais tombée** dans les 9 s d'attente que je lui ai
laissées (`attente34` armée 89,5 s, `fondu34` jamais vrai) : **la mesure ×4 de
la bascule manque, et je ne l'invente pas.**

---

# ⚡ RUPTURE 4 — LA MORT DU CROP VAUT 106,61 AILLEURS, CONTRE 45,73 PUBLIÉ

C'est une rupture de CONTENU — la famille que le brief exclut. **Je la donne
quand même parce que le chiffre publié est celui d'un seul lieu, en pleine mer,
et qu'il est ×2,33 trop petit.**

Descente + remontée au Spitzberg (78,22 N · 15,65 E), `ATT-svalbard`, 2 250
images, 0 erreur de page :

| | La Réunion (`ATT-remontee`) | **Spitzberg** |
|---|---|---|
| écart d'image à la **mort** du crop | 45,33 | **106,61** |
| écart d'image à la **naissance** du crop | 51,03 (`ATT-ref`) | **90,48** |

⚠️ **La caméra, elle, ne bouge pas** sur ces images : `dViseeG` 0,000°,
déplacement relatif 1,09 · 10⁻⁴, rapport d'altitude 1,0061. **C'est bien du
contenu, et c'est bien deux fois pire qu'annoncé.**

---

# ⚡ RUPTURE 5 — LA BORNE DE 11,863° N'EST PAS UNE BORNE : J'AI TROUVÉ 17,5885°

Angle mort n° 6. La sonde relève, par image, le déplacement d'arc de l'ancre du
dépôt (**centre du bloc**) — la grandeur qui PRODUISAIT les franchissements
avant la correction d'ancre.

| trace | pire arc de l'**ancre-centre** en 1 image | pire arc de l'**ancre-cible** | `dViseeG` qui en sort |
|---|---|---|---|
| `ATT-ref` (molette, La Réunion) | 15,2215° | 7,8618° | **1,5000°** (le balayage) |
| `ATT-desc-montblanc` | 14,3867° | 7,8805° | **0,0942°** |
| `ATT-svalbard` | 4,4480° | 2,0738° | 1,4796° |
| **`ATT-pano2`** (molette + glissement) | ⚡ **17,5885°** | 9,9855° | **0,1758°** |

⚡ **17,5885° au franchissement `n385`** — **48 % au-dessus des 11,863° que le
rapport cite comme la pire valeur**, et à portée de la borne théorique ≈ 21°.
**La réserve n° 1 de l'étape 2 (« 11,863 est une valeur, pas un maximum ») est
confirmée par la mesure.**

✅ **ET LA CORRECTION TIENT QUAND MÊME** : sur cette même image, la caméra qui
rend tourne de **0,1758°**. **C'est un renfort de l'affirmation, pas une
attaque** — je le dis parce que la consigne l'exige.

⚠️ Les 9,9855° d'ancre-cible tombent à la **traversée orbite → surface** (`n91`,
naissance du bloc), là où le rapport avait déjà 7,6643° : **ce n'est pas un
franchissement**, et `dViseeG` n'y vaut que 0,1077°.

---

# ⛔ LE VERDICT SUR « LE CROP ABSENT À z16 » — REPRODUIT, ET BIEN PLUS LARGE QUE ÇA

**Réserve ① de `rapport-D16c.md` : reproduite, puis généralisée.**
⚠️ **Ce n'est ni un défaut de `gotoCtl.go`, ni un défaut de z16 : c'est un défaut
d'ALTITUDE DU SOL, et la molette seule y mène.**

## ① Reproduit, tel quel

`ATT-z16` : `gotoCtl.go('45.8326, 6.8652')` puis captures à **5 s, 15 s, 30 s et
60 s** — `.banc/D16/img-ATT-z16/01-apres-go-*.png`. **Écran vide aux quatre**,
message d'application *« détail en cours… 1 niveau de retard »*, et pourtant
`uCropOn = 1`, `veilleCrop.pose = true`, `veilleCrop.refus = []`, signature
`45.83071305019325|6.86370849609375|16|3`. **La machinerie du crop se croit
allumée.** 0 erreur de page.

## ② Ce n'est pas `gotoCtl` — la molette y mène aussi

Même session, étape `05` : `flyTo(45.8326, 6.8652, 12)` — **bloc visible**
(`02-flyto-z12.png`) — puis **60 crans de molette avant, rien d'autre** →
z15, **écran vide** (`05-molette-depuis-z12.png`).

## ③ Ce n'est pas z16 — c'est l'altitude du sol

`scripts/diag-attaque-vide.mjs`, `flyTo(lieu, 16)`, attente 14 s (et 35 s en
contre-essai), captures dans `.banc/D16/img-ATT-alt-*/` :

| lieu | altitude moyenne du sol | z16 |
|---|---|---|
| Amsterdam | **1 m** | ✅ bloc dessiné |
| Nice | **5 m** | ✅ bloc dessiné |
| Sahara (New Valley) | **884 m** | ✅ bloc dessiné |
| **Denver** | **1 600 m** | ⛔ **écran vide** (revérifié à 35 s) |
| **Mexico** | **2 235 m** | ⛔ écran vide |
| **Cusco** | **3 360 m** | ⛔ écran vide |
| **Lhassa** | **3 659 m** | ⛔ écran vide |
| **Mont-Blanc** | **4 483 m** | ⛔ écran vide |

➡️ **Le seuil est entre 884 m et 1 600 m d'altitude moyenne.** Au-dessus, le
bloc n'est plus dessiné, quel que soit le chemin.

## ④ La cause mesurée : la caméra passe SOUS le bloc

`camGlobe` est à **`(|position| − 100) × 63 710` mètres au-dessus du niveau de la
MER**. Relevé :

| lieu, z16 | sol moyen | **`camGlobe` au-dessus de la mer** | marge |
|---|---|---|---|
| Sahara | 884 m | 3 093 m | +2 209 m |
| Denver | 1 600 m | 2 592 m | +992 m |
| Mont-Blanc | 4 483 m | **2 348 m** | **−2 135 m** |
| Lhassa | 3 659 m | **2 929 m** | **−730 m** |

⚡ **Au Mont-Blanc la caméra est 1 431 m sous le POINT LE PLUS BAS du bloc**
(le relevé donne `min 3 779 m`, `max 4 807 m`) — **et l'application annonce
`altitudeCadrageM() = 1 174 m`.**

**Et c'est visible en images pendant une descente ORDINAIRE.** Descente à la
molette depuis 60 000 km au-dessus de l'Himalaya (`ATT-himalaya`, arrivée à
29,8176 N · 91,1246 E, sol ≈ 3 700 m), captures tous les six crans :

| altitude de cadrage | ce qu'on voit |
|---|---|
| 5 749 m | ⚠️ la **paroi terracotta du socle** remplit 5/6 de l'écran, le terrain n'est plus qu'une bande à droite |
| 4 684 m | ⛔ **terracotta plein cadre** — la caméra est DANS le socle |
| 3 268 m | ⛔ **écran vide** — elle est passée dessous |
| 392 m (z17) | ⛔ écran vide |

⛔ **La caméra traverse le bloc par le flanc, puis passe dessous.** Le
« crop absent » n'est pas un crop absent : **c'est une caméra enterrée.**

⚠️ **Ce que je n'ai PAS fait** : trouver la ligne fautive. `poseFond` pose le
plan `y = 0` du bloc sur la sphère de rayon 100 (le niveau de la mer) ; le relief
du globe, lui, déplace la surface vers le haut. **C'est une hypothèse cohérente
avec les huit lieux, ce n'est pas une lecture de code vérifiée. Non mesuré :
l'exagération verticale appliquée au crop du globe.**

⚠️ **Contre-essai fait et négatif** : reculer la caméra du bloc ×4 à la main
(`--recul 4`, puis `controls.update()` et `majCameraFond()`) ne change PAS
`camGlobe` — 2 348 m avant, 2 348 m après. **Quelque chose replafonne la
distance dans la même image.** Symptôme voisin de la réserve ② de D16-c
(« la molette arrière ne change pas de palier »).

---

# ✅ CE QUE J'AI ESSAYÉ SANS RIEN CASSER — le silence ne prouve rien, la liste si

1. **L'axe pendant la descente, à trois lieux** — La Réunion, Mont-Blanc,
   Spitzberg. `dIncl` de la caméra du bloc : **0,000 057 298°** partout.
   `dViseeG` MAX : 1,5000° / **0,0942°** / 1,4796°. ⛔ **Aucune bascule
   pendant la descente, nulle part.**
2. **Le redimensionnement de la fenêtre pendant la descente** (`ATT-resize`,
   cinq changements : 1024×640, 1280×800, 800×900, 1440×700, 1280×800).
   Déplacement relatif MAX **0,026841** contre 0,021775, rapport d'altitude
   **1,0323** contre 1,0281, `dViseeG` MAX **1,3922°** — **sous** la ligne de
   base. ⛔ **Rien.**
3. **La remontée, à deux lieux.** Sortie d'orbite : rapport d'altitude
   **1,0063** aux deux (le chiffre exact du rapport), rotation de visée
   **0,952°** (La Réunion) et **0,139°** (Spitzberg). ⛔ **La moitié « retour »
   de l'affirmation tient.**
4. **Les cinq franchissements**, cherchés dans **neuf** traces. **Aucun ne
   revient** : `dViseeG` aux crans vaut 0,1087° / 0,1758° / 0,0299° / 0,0526°.
5. **L'aller-retour rapide sans pause** (5 sens enchaînés, période 45 ms —
   réserve ③ de l'étape ①). La porte de replongée **n'a pas été franchie à
   tort** ; le seul dégât est la rupture 2.
6. **Le glissement seul, en événements de page** : 44 `NotFoundError:
   setPointerCapture` et une trace **indiscernable** de la ligne de base. ⚠️
   **Instrument insuffisant — refait par CDP `Input.dispatchMouseEvent`**, et
   c'est cette seconde version qui donne la rupture 2. **Le premier essai ne
   prouvait rien et je ne le compte pas.**
7. **Le condensé d'image affiné à 64 × 40** (option `--grille`) : écrit, testé
   au démarrage, **mais aucune de mes ruptures n'était assez petite pour en
   avoir besoin.** ⚠️ **Aucun résultat de ce rapport n'a été pris à 64 × 40.**
8. **Chercher un lieu où l'axe casse.** Quatre lieux, quatre latitudes
   (−21°, +23°, +46°, +78°). **Rien.**
9. **Le bridage CPU ×4 sur l'axe** : `dViseeG` MAX **0,1388°**, `dIncl` bloc
   **0,000 057°**. ⛔ **Rien sur l'axe.**
10. **Le premier clic depuis une autre altitude** : non essayé (voir réserves).
11. **`gl` erreurs de page** : **0** sur toutes mes traces sauf l'essai n° 6.
    ⚠️ Je n'ai **pas** re-relevé les `erreurs GL [1282]` du rapport — la sonde
    ne les compte pas.

---

# ⚠️ MES RÉSERVES — ce qui rendrait mes chiffres faux

1. ⛔ **UN SEUL POSTE.** RTX 3080 / D3D11 / Chrome sans tête. Le bridage CPU est
   du **fil principal seulement** : il ne simule pas un GPU lent, ni un lien
   réseau lent. **Une vraie machine lente n'est pas mesurée.**
2. ⚠️ **LA DÉRIVE DE VEILLE ORBITALE M'A COÛTÉ UN ESSAI.** `poserOrbite` attend
   5,5 s ; la planète tourne pendant ce temps (le brief l'annonce à 1,876°/s).
   Ma descente « Mont-Blanc depuis l'orbite » a atterri **10,65° plus à l'est**
   (45,79 N · 17,52 E). **Je n'ai pas gelé la planète** — j'ai contourné en
   visant l'Himalaya, assez large pour absorber la dérive. **Toute conclusion de
   `ATT-desc-montblanc` sur le LIEU est donc nulle ; ses chiffres d'AXE, non.**
3. ⚠️ **`altitudeCadrageM()` vaut exactement la MOITIÉ de l'altitude de
   `camGlobe` au-dessus de la mer**, dans les huit relevés, à 4 décimales.
   **Je ne sais pas si c'est une définition ou un défaut, et je ne le
   revendique pas.**
4. ⚠️ **Le seuil « ~1 000 m » est encadré, pas mesuré** : 884 m marche, 1 600 m
   ne marche pas. **Je n'ai pas dichotomisé entre les deux.**
5. ⚠️ **Mon jugement « écran vide » est OCULAIRE**, sur des captures PNG pleine
   résolution. **Je n'ai pas construit de mesure de pixels du fond** : le
   condensé de la sonde n'était pas branché sur le diagnostic. Les captures sont
   dans `.banc/D16/img-ATT-*/` et se relisent.
6. ⚠️ **La cause de la rupture 2 est une CORRÉLATION** : les trois pires images
   durent 124,8 / 642,7 / 5 362 ms. **Je n'ai pas isolé le lissage en le
   pilotant à `dt` imposé.**
7. ⚠️ **La bascule sous bridage ×4 manque** (voir rupture 3).
8. ⚠️ **Le clic n'a été mesuré qu'au CENTRE de l'écran et depuis 60 000 km.**
   Le brief de `plongeDepuisGlobe` insiste sur le clic au **bord du disque** :
   **non mesuré.**
9. ⚠️ **Je n'ai pas mesuré le tremblement `float32`** aux deux bouts (D16 bis),
   ni le flou, ni l'occlusion ambiante. **Hors de mon mandat, et non fait.**
10. ⚠️ **Les traces `ATT-cpu4` / `ATT-cpu10` s'arrêtent avant la bascule** : leur
    `dViseeG` MAX (0,1388° / 0,1355°) **ne dit rien du balayage**, seulement de
    la descente.

---

# CE QUE J'AI AJOUTÉ AU DÉPÔT

- `scripts/sonde-attaque-d16.mjs` — copie de `sonde-d16.mjs`, **rien retiré** :
  `--cpu`, `--lieu` / `--zoom-lieu`, `--grille`, et les scénarios `clic-suite`,
  `pano-descente`, `resize-descente`, `va-et-vient`, `z16`.
- `scripts/diag-attaque-vide.mjs` — neuf : pose de `camGlobe`, altitude au-dessus
  de la mer, altitude du sol, inventaire de la scène du globe, captures.
- `.banc/D16/ATT-*.json` (**31 traces**) et `.banc/D16/img-ATT-*/` (**19 dossiers
  de captures**) — **0 erreur de page partout sauf l'essai n° 6 déclaré
  ci-dessus.**

⛔ **`src/` n'a pas été touché. `scripts/sonde-d16.mjs` et
`scripts/lit-sonde-d16.mjs` non plus.**
