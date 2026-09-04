# GE3 — NOTEUR : LA SOURIS EST-ELLE CELLE DE GOOGLE EARTH ? Tour 1 : **6 / 10**. Tour 2 (2026-09-04, en bas) : **9,75 / 10**.

Arbre `C:\Dev\wt-ge3`, branche `gestes-ge-note`, `git merge regroupement` fait
(HEAD `1c6b4e5` + fusion). **`git diff -- src/` : vide (0 ligne).** `npm test`
**4 774 · 0 échec** (2 sautés, comme avant). `npm run audit:tests` **254 listés ·
254 sur disque, aucun écart**. Serveur `npm run dev -- --host 127.0.0.1 --port
7311 --strictPort` (+ un second, 7312, sur un arbre à `c3444d3` = l'état
d'AVANT GE2, pour l'arbitrage de la bimodalité) — **tous deux arrêtés en
partant, l'arbre de secours supprimé.**

Instrument : `scripts/sonde-ge3.mjs` — **la sonde de GE1 telle quelle** (mêmes
champs, pour que `test/attaque-ge-ROUGE.mjs` se relise sans une ligne changée),
plus trois régimes (`--regime crop | surface | orbite`), un `|Δ ln d|` par image,
un **pire rapport d'ALTITUDE image à image** (le rayon de `camGlobe`, pas la
distance en unités de bloc — voir « ce que j'ai cru puis réfuté » n° 3), la
lecture du `contextmenu` **en phase de bulle**, et les gestes hors barème.
Chrome sans tête 1 280 × 800, gestes par CDP, relevé dans un rAF posé après
`tick()`, **un geste = un chargement de page**, voile fermé et vérifié
(`elementFromPoint` = `CANVAS`), vol de démarrage attendu (`d` stable **et**
> 100). Relevés : `.banc/GE3/*.json` (surface 2,4 Mm, crop 10 km, orbite
24 Mm, 8 × 8 passes, complément, hors barème, R35, avant-GE2).

---

## ⚡ EN TÊTE — LES TROIS CHOSES À TRANCHER AVANT LA NOTE

### ① GE1 et GE2 ne se contredisent presque pas sur Google — et là où ils divergent, c'est GE2 qui a la meilleure source

Le brief GE3 opposait « GE2 : le clic droit horizontal, les deux docs sont
muettes » à « GE1 : Earth Web range le clic droit sous *Zoom in and out* et met
l'inclinaison sur Ctrl ». **Ces deux phrases sont vraies en même temps** : GE1
parle du clic droit **vertical** sur Earth Web (zoom, W1 verbatim), GE2 du clic
droit **horizontal** (muet partout, y compris dans le guide officiel v4 que GE2
cite et que GE1 n'a pas lu). Le tableau complet est au §①. Ce qui se tranche :

- **la molette : ni GE1 ni GE2 n'ont vu de ligne molette sur Earth Web, et il
  n'y en a pas** (relu : W1 et W2 ne contiennent ni *scroll* ni *wheel*). Pro dit
  seulement *« use the scroll wheel … to zoom in and out »*. **Aucune cible
  publiée.** GE2 a raison : la contradiction avec D19 n'est **documentée** que
  sur le **double-clic** (*« Zoom toward cursor location »*).
- **le clic droit horizontal** : le guide v4 **officiel** (PDF sur
  `static.googleusercontent.com`) ne décrit que le vertical. La « rotation au
  clic droit gauche/droite » de GE1 vient du **miroir SERC**, un guide plus
  ancien, hors google.com — GE1 l'avait marqué comme tel. ➡️ **écart connu, pas
  un défaut** : un ancien Google Earth tournait au clic droit horizontal ; rien
  d'officiel ne le documente aujourd'hui. « Inerte » (GE2) est le choix conforme
  aux sources ; C2 l'accepte.
- **deux points où GE1 s'est trompé** : l'inertie **est** documentée (Pro :
  *« as if you are "throwing" the scene »*, *« Click once … to stop motion »*) ;
  et **le clic simple documenté ARRÊTE le mouvement, il ne zoome pas** — ce qui
  est aussi le point où **GE2 s'est trompé** en gardant la plongée R35 sous le
  nom de « double-clic gauche déjà servi ».

### ② D19 §1 était bimodale AVANT GE2, et ne l'est plus APRÈS — les deux bancs disaient vrai

Mesuré moi-même, **huit chargements indépendants par série, quatre séries** :

| état du code | geste | `saisiVsPointeurPx` sur 8 chargements | rotation |
|---|---|---|---|
| **avant GE2** (`c3444d3`, arbre séparé, port 7312) | gauche H 200 px | **0 · 0 · 1,65 · 748,85 · 747,85 · 0 · 708,94 · 0** → **5/8** | 3,4° ou **15,78°** (× 4,6) |
| **après GE2** (HEAD) | gauche H 200 px | **0 · 0 · 0 · 0 · 0 · 0 · 0 · 0** → **8/8** | 3,42–4,07° |
| **après GE2** (HEAD) | gauche V 200 px | **0 · 0 · 0 · 0 · 0 · 0 · 0 · 0,01** → **8/8** (+ 5 passes à 0 d'une série interrompue par Chrome, + 1 passe de la série principale : **14/14**) | 3,3–3,5° — ⚠️ **ou 13,4° / 13,4° / 14,3° sur 3 passes** : le point saisi est resté sous le curseur (0 px), c'est **l'élan après le relâché** qui a ajouté ~10° (voir C8) |

➡️ **GE1 avait raison (5/8, facteur 4,6, bimodal — reproduit à l'identique sur
ma machine, 748 px et 15,78°)**, et **GE2 avait raison aussi** : après ses
changements, une passe unique rendait 0,00 px parce que **toutes** les passes
rendent 0,00 px. Ce n'est pas GE2 qui l'a visé — son rapport ne mentionne pas
la bimodalité — mais `LEFT: -1` dans `versTroisJs` (le bouton gauche retiré à
OrbitControls dans le régime de la Terre) a **supprimé le second consommateur du
glissé**. Hypothèse, pas diagnostic : dans le mode cassé, `ROTATE` d'OrbitControls
courait en parallèle de la saisie (`enableRotate = false` arrivait après le
`pointerdown` sur certains chargements) et les deux rotations s'ajoutaient.
**C0 (d) est VERT : 8/8 sur les deux axes.** Lequel des bancs je crois :
**les deux, chacun sur son état du code** — et le mien, qui a mesuré les deux.

⚠️ **Mais la bimodalité n'a pas disparu du produit, elle a changé de geste** :
le **cap** (milieu H, Maj + gauche) rend **−50,000°** ou **−69,35° avec 17,36°
de roulis du sol**, selon le chargement — 2 chargements sur 4 (voir C6). Même
signature : deux modes exacts, reproductibles au centième, jamais entre les
deux.

### ③ La visée du zoom : `GE_VISEE=centre` et `GE_VISEE=curseur` valent la même note aujourd'hui

Les deux variantes du barème ont tourné sur mes relevés (`.banc/GE3/rouge-centre.txt`,
`rouge-curseur.txt`) : **centre = 11 verts / 7 rouges ; curseur = 10 / 8**. La
seule différence est D19 §2 (molette au centre : 0,00 px ; sous le curseur :
49,27 px) — qui n'est un critère **éliminatoire** que sous `centre`. C4 est rouge
dans les deux : le double-clic gauche dérive de **470 px** du centre **et** de
**236 px** du curseur (il ne vise ni l'un ni l'autre : c'est la plongée R35),
le double-clic droit ne fait que ×0,98. **Je ne tranche pas** — c'est l'arbitrage
n° 1 pour Adrien, §⑥ — mais le choix ne bouge pas la note d'aujourd'hui.

---

## ① LA CONFRONTATION GE1 / GE2 SUR LA RÉFÉRENCE — relue à la source

Cinq pages relues moi-même (verbatim) : **W1**
`developers.google.com/maps/documentation/earth/discover-places-change-view`
(Earth Web, onglet Computer), **W2** `…/earth/use-keyboard-shortcuts` (Earth
Web), **P1** `support.google.com/earth/answer/148186` (Pro), **P2'**
`support.google.com/earth/answer/148115` (Pro, *« Use keyboard shortcuts to
navigate in Google Earth »*), et le **guide v4 officiel**
(`static.googleusercontent.com/media/earth.google.com/en//userguide/v4/google_earth_user_guide.pdf`,
131 pages, § *Using a Mouse* p. 6-7 et *Tilting and Viewing Hilly Terrain* p. 9,
texte extrait par pypdf) — plus le miroir SERC (le P3 de GE1) pour situer sa
ligne « rotation ».

| # | point | GE1 | GE2 | la source, verbatim | verdict |
|---|---|---|---|---|---|
| 1 | clic droit glissé, Earth Web | zoome (W1) | zoome, axe non précisé | W1 : *« Zoom in and out: At the bottom right, use +/- or right drag the mouse. »* | **d'accord, vrai.** Le brief GE3 les croyait en désaccord : non. |
| 2 | inclinaison sur Earth Web | `Ctrl + glissé` | `Ctrl + glissé` | W1 : *« Explore around your location: Hold Ctrl + drag the screen. »* | **d'accord, vrai.** |
| 3 | clic droit glissé **horizontal** | Pro : rotation — **miroir SERC seulement**, marqué comme tel | non documenté, Web **et** Pro | guide v4 p. 6-7 : *« move the mouse backward or pull toward you »* (avant), *« move the mouse forward or push away from you »* (arrière). **Rien sur gauche/droite.** Miroir SERC (guide antérieur) : *« rotate the 3D Viewer clockwise by dragging the mouse to the left »* | **GE2 a raison sur l'officiel.** ➡️ écart connu (ancien Earth), ni défaut ni acquis. |
| 4 | la molette : cible publiée ? | non publié | aucune contradiction documentée | W1, W2 : **aucune** mention de la molette. P1 : *« Use the scroll wheel on your mouse or mouse touchpad to zoom in and out. »* Guide v4 : *« zoom in by scrolling towards you »*, Alt = *« smaller increments »*. **Nulle part une cible.** | **d'accord, vrai.** La seule cible de zoom écrite est celle du **double-clic** (W2 ; guide v4 : *« zoom in to that point »* / *« zoom out from that point »*). |
| 5 | bouton du milieu | P1 onglet Mac | guide v4 | guide v4 p. 7 : *« tilt the view by depressing the button and moving the mouse forward or backward »* ; *« rotate the view to the left by clicking on the middle button and moving the mouse to the left »* ; p. 9 : *« Movements up or down tilt the view, and movements left or right rotate the view. »* | **d'accord** ; GE2 a la source officielle et toutes plateformes. |
| 6 | la page 148115 | pas vue (GE1 a lu 148114, clavier seul) | citée : clic droit = *zoom plus automatic tilt* | 148115 : *« Right-click and drag up or down »* → zoom + automatic tilt ; *« Shift then click and drag down/up »* → tilt (Mac) ; *« Ctrl then click and drag »* → first-person perspective | **GE2 a une source de plus** — celle qui fonde l'écart « inclinaison automatique de Pro », interdit par D16 ter. |
| 7 | sens du clic droit vertical | non tranché | *« pull toward you »* = zoom **avant** | guide v4 : *« move the mouse backward or pull toward you, releasing the button when you reach the desired elevation »* (zoom in) | **GE2 a raison.** ⚠️ Le test C1 de GE1 attend ×d ≥ 1,5 sur un glissé **vers le haut** : c'est l'inverse du sens documenté. Je note C1 dans le sens Pro (bas = avant). |
| 8 | inertie | *« aucune page ne la mentionne »* | documentée Pro | guide v4 p. 6 : *« briefly move the mouse and release the button, as if you are "throwing" the scene. Click once in the 3D viewer to stop motion. »* | **GE2 a raison** ; C8 reste « bornée », pas « interdite ». |
| 9 | clic simple | rien (par exclusion) | garde la plongée R35 (« double-clic gauche déjà servi ») | guide v4 : *« double-click … to zoom in to that point. Single-click to stop »* ; W2 : le zoom est le **double**-clic | **GE1 a raison.** Le clic simple documenté **arrête**, il ne zoome pas. |

**Ce que la confrontation change au barème :** aucun seuil ; deux lectures —
(a) C1 se lit dans le sens Pro ; (b) « inerte » est la réponse conforme pour C2.

---

## ② LA NOTE, CRITÈRE PAR CRITÈRE — mes mesures, trois altitudes

Altitudes : **crop** 10 km sur La Réunion (`flyTo(-21.1, 55.5, 12)`, pente
d'arrivée **46,48°** attendue stable — voir réfuté n° 1), **surface** 2,4 Mm
hors du crop, **orbite** 24 Mm. Témoins sans geste : **0,000°** en surface
(90 et 286 images) et sur le crop (90 images) ; **3,24° de longitude en 90
images en orbite** — le globe y tourne seul (`params.animations`), et toutes les
rotations d'orbite ci-dessous sont à lire à ~3° près.

### C0 — NON-RÉGRESSION (éliminatoire) : **PASSÉE, 9 sur 9**

| | exigence | seuil | **mesuré GE3** | verdict |
|---|---|---|---|---|
| a | `npm test` | 4 755 · 0 | **4 774 · 0** | ✅ |
| b | `audit:tests` | 253 = 253 | **254 = 254** | ✅ |
| c | D19 §1 pivot | Terre ≤ 1,0 px, H et V | **0,00 / 0,00 px** (et 0,00 sur les 16 passes de d) | ✅ |
| d | D19 §1 prise, **8/8** | ≤ 1,4 px aux huit chargements | H : **0 ×8** · V : **0 ×7 + 0,01** (et 0 sur 6 autres chargements) | ✅ |
| e | D19 §2 molette | centre ≤ 1,4 px, 1 et 6 crans, aller et retour | **0,00 / 0,00 / 0,00 px** (curseur : 3,97 / 49,27 / 40,89) ; crop : 0,00 / 0,04 ; orbite : 0,71 / 1,39 / 0,33 | ✅ |
| f | D16 ter restreint | ≤ 0,5° sur glissé H/V/élan et molette avant | **0,000°** partout ; ⚠️ la molette **arrière** ne penche plus non plus (**0,000°**, contre −2,607° chez GE1) | ✅ |
| g | `veille-repos` | `\|Δ ln d\|` < 1e-4 sur un geste de pose | saisie **0** ; inclinaison **0** ; cap **8,9e-16** ; crop **4,4e-16** | ✅ |
| h | clic sur le globe | ≤ 1,023 sur 8 clics | `sonde-r35.mjs`, 8 clics 60 000 → 226 km : **pire 1,0116**, Terre 0 px | ✅ |
| i | pas de `DIVE_TIERS` table | relecture | la diff GE2 ne touche ni `modes.js` ni `escalier-zoom.js` | ✅ |

### Les critères notés

| | critère | seuils | **mesuré (surface 2,4 Mm ; crop ; orbite)** | pts |
|---|---|---|---|---|
| **C1** | clic droit vertical **zoome** | 1,5 ≤ ×d ≤ 3 · tilt, azimut ≤ 0,2° · sol ≤ 0,3° · image ≤ 1,10 · inverse ±5 % | **bas (vers soi) = avant ×1,894 puis ×1,908** ; tilt 0, azimut 0, sol 0 ; pire image **en altitude 1,004** ; **haut = arrière ×2,128 puis ×2,151** (image 1,0076). ⚠️ **asymétrique : \|ln\| = 0,116 et 0,120, seuil 0,05** (l'arrière va 13 % plus loin que l'avant, deux passes). Orbite : ×1,672 / ×1,671, **symétrique**, image 1,007. Crop : pan d'OrbitControls (l'exception, voulu). | **1,25 / 2,0** |
| **C2** | clic droit horizontal : azimut **ou** rien | inerte : azimut ≤ 0,2°, sol ≤ 0,05°, \|ln ×d\| ≤ 0,01 | **0,000° · 0,000° · ×1,0000** ; diagonale droit : sol 0°, seul le vertical zoome | **1,5 / 1,5** |
| **C3** | `Ctrl + glissé` incline et tourne autour du lieu visé | V : 25–80°, centre ≤ 20 px, \|ln ×d\| ≤ 0,10 · H : azimut ≥ 20°, tilt ≤ 2° | V : **+36,46°**, centre **6,56 px**, ×1,0000 · H : **−50,000°** (2/2), tilt 0 · Maj V : +36,62° / 6,66 px (et une passe à +22,26° — voir C6) | **1,5 / 1,5** |
| **C4** | double-clic : cran franc vers le point désigné | gauche 1,8–2,2 et ≤ 25 px · droit 0,45–0,56 et ≤ 25 px | gauche : **×2,00** mais **470 px du centre, 236 px du curseur** — c'est la plongée R35, identique au clic simple (le second clic est avalé) ; au centre exact : 0 px (1 passe) **ou** 7,7° d'inclinaison + 7,6° de roulis (1 passe) · droit : **×0,983** (2 crans de molette, altitude +1,7 %), orbite ×0,80, crop rien | **0 / 1,5** |
| **C5** | le clic simple ne fait rien | \|ln ×d\| ≤ 0,02, sol ≤ 0,05° | **×2,00 et 3,83–3,91°** (3 passes), orbite ×2 et 46°, crop ×1,51 | **0 / 1,0** |
| **C6** | milieu incline / tourne, `Maj + gauche` = repli à ±10 % | V ≥ 25° · H ≥ 20°, tilt ≤ 2° · Maj = milieu ±10 % | V : **+36,87°** ✅ · H : **−50,000° ou −69,353°** (2 passes : une de chaque) · Maj H : **−69,352° ou −50,000°** (2 passes : une de chaque). ⚠️ **Bimodal** : le mode à −69° porte **17,36° de roulis du sol** (contre 2,42°), même chiffre au millième à chaque fois. Le repli tient donc « à ±10 % » une fois sur deux. Orbite : inertes (voulu). | **0,67 / 1,0** |
| **C7** | aucun menu de navigateur | `defaultPrevented` 8/8 | **prévenu** en surface, en orbite, sur le crop (bulle) — **et déjà prévenu AVANT GE2** (arbre `c3444d3`) : le « false » de GE1 était une lecture en phase de capture, avant le gestionnaire du canvas | **0,5 / 0,5** |
| **C8** | élan borné | ≤ 15 % du geste · mort ≤ 1 800 ms · un clic l'éteint | surface, **6 chargements** : **0,815 / 0,988 / 0,991 / 0,830 / 0,837 / 1,025°** pour 4,08–5,06° = **20,0–20,3 %** du total, mort à 1 369–1 391 ms ✅ ; orbite : 11,5° / 46,7° = **24,6 %**. ⚠️ **Et l'élan n'est pas plafonné** : dans la série V × 8, **3 chargements sur 8** rendent **13,4 / 13,4 / 14,3°** de rotation pour un geste de 3,4° — le point saisi est resté sous le curseur (0 px), donc les ~10° sont arrivés **dans les 4 images qui suivent le relâché** : une vitesse armée d'environ 150 °/s sur un pas dégénéré (deux `mousemove` à ~1 ms). Un banc l'a produit, une souris à 1 000 Hz peut le produire. Un clic droit pendant l'élan le met à **0,000 °/s** (2/2) ✅ | **0,25 / 1,0** |

**TOTAL : 1,25 + 1,5 + 1,5 + 0 + 0 + 0,67 + 0,5 + 0,25 = 5,67 → j'écris 6 / 10**
(l'arrondi vers le haut, pas vers le bas, pour une seule raison : C0 — qui vaut la
vie du dossier — est tenue 8/8 sur les deux axes là où GE1 la trouvait 5/8, et
ce n'est pas rien). **Sous 7,5. Je dis non.**

### Ce qui manque pour 7,5, classé par points gagnables

1. **C4 + C5 : 2,5 pts** — le même geste. Le clic simple doit se taire
   (guide v4 : *« Single-click to stop »*), le **double**-clic gauche doit faire
   la plongée d'un cran (≈ ×2) **vers le point désigné** (l'arbitrage ①), et le
   double-clic droit doit rendre l'inverse (÷2, pas ×0,98 : `CRANS_DOUBLE_CLIC =
   2` vaut 2 crans de molette, ~×1,035). Avec ça : **8,4**.
2. **C6 : 0,33 pt** — le cap bimodal (−50° / −69° + 17° de roulis). À
   diagnostiquer avant de corriger, même famille que l'ancienne bimodalité de
   la saisie.
3. **C1 : 0,75 pt** — la symétrie avant/arrière en surface (13 % d'écart, seuil
   5 %) ; en orbite c'est symétrique, donc c'est l'escalier de surface qui
   n'est pas réversible cran pour cran.
4. **C8 : 0,75 pt** — 20 % → ≤ 15 % (un facteur 0,75 sur la vitesse armée),
   **et un plafond sur la vitesse armée** (un pas de 1 ms ne doit pas valoir
   150 °/s) : c'est le défaut le plus visible de la liste pour un utilisateur à
   souris rapide — la Terre part d'un coup de 10° au relâché.

---

## ③ LES ÉCARTS AVEC LES CHIFFRES DE GE2, ET LEQUEL DES BANCS JE CROIS

| GE2 affirme | GE3 mesure | lecture |
|---|---|---|
| D19 glissé : 0,00 px, une passe | **0 px, 16/16** (H et V) | d'accord — et prouvé au sens de C0 (d), ce que GE2 n'avait pas fait |
| clic droit V : altitude ×1,198, centre 0 px | ×1,89 avant / ×2,13 arrière pour 200 px (autre altitude et sens Pro) ; centre **0 px** | d'accord sur la fonction ; **GE2 ne dit rien de la symétrie** |
| Maj + H : **−50,000°** | **−50,000° une fois, −69,35° une fois** ; milieu H pareil | ⚠️ **GE2 a mesuré une seule passe et n'a pas vu le second mode** — c'est exactement le reproche que GE1 faisait à R32. Je crois mon banc : deux modes exacts, quatre chargements |
| menu : « empêché explicitement » | empêché — **mais il l'était déjà avant GE2** (bulle : `true` sur `c3444d3`) | vrai, sans effet mesurable ; le « défaut » de GE1 était un artefact de sonde |
| double-clic droit : « 2 crans de dézoom » | **×0,983** en altitude (+1,7 %) | c'est ce que 2 crans valent ; ce n'est pas ÷2, et ce n'est pas « zoom away » au sens de Google (Pro : *« by a certain amount »* ≈ le pas du double-clic avant) |
| double-clic gauche = clic simple R35, « ne pas compter deux fois » | double-clic gauche **= clic simple** (×2, le second clic avalé) ; **aucun des deux ne vise le point désigné** (470 / 236 px) | **l'argument de GE2 ne tient pas** : Google n'a pas de clic simple qui zoome |
| `\|Δ ln d\| = 0` sur inclinaison et cap | **0 / 8,9e-16** | d'accord |
| R35 : 1,0171 sur 8 clics | **1,0116** | d'accord |
| inertie : « vitesse armée 4,35 °/s » | course mesurée **20 %** du geste en surface, 24,6 % en orbite | GE2 n'a pas mesuré le seuil C8 ; sa remise à plat entre gestes et son enchaînement ne le permettaient pas |
| D16 ter : 0° sur 1 194 images avant le crop | pas remesuré en vol ; **0,000°** sur tous les gestes de surface, **46,48°** posés sur le crop à l'arrivée | d'accord sur l'état ; la molette arrière ne penche plus (0° contre −2,607° chez GE1) |

**Ce que je crois** : le banc de GE2 pour les fonctions (le vocabulaire est bien
posé, et ses `|Δ ln d|` sont justes) ; **pas** son « une passe » sur les gestes
bimodaux, ni son interprétation du clic simple. Le banc de GE1 pour la
bimodalité (reproduite au pixel) — mais sa lecture du `contextmenu` était fausse.

---

## ④ L'ANTI-TRICHE

1. **`git diff c3444d3..HEAD -- test/attaque-ge-ROUGE.mjs` : vide.** Le fichier
   rouge de GE1 n'a pas été touché. GE2 a **ajouté** des tests
   (`test/gestes-terre.test.js` 207 lignes, `boutons-camera.test.js` +44,
   `damier-cadre.test.js` +10 — ces derniers ne suppriment aucune assertion) et
   la ligne `test` de `package.json` (+1 fichier). Aucun test existant affaibli.
2. **Le crop en premier** (16 gestes, chargement + vol par geste) : les trois
   boutons y restent ceux d'OrbitControls (`LEFT 0 · MIDDLE 2 · RIGHT 2`,
   `enableRotate true`), le glissé gauche y tourne l'azimut (**−75,7°** pour
   200 px, sol 0,10°) — **l'exception R13 est intacte**, le prédicat
   `regimeTerreActif` fait ce qu'il dit. La molette y vise le centre (0,04 px),
   le double-clic droit n'y fait rien (compteur `refus` 0→2), le menu y est
   prévenu.
3. **Gestes hors barème** : glissé gauche **diagonal** → saisie à 0,00 px ✅ ;
   clic droit **diagonal** → zoom pur, sol 0° ✅ ; **Ctrl + molette** → identique
   à la molette nue (×1,213, centre 0 px — pas d'invention) ✅ ; **Maj + molette**
   → idem ✅ ; **clic droit pendant l'élan** → l'élan tombe à 0,000 °/s, puis le
   zoom du glissé droit ✅ ; **relâché hors de la toile** : relâché au coin de la
   fenêtre (1279, 799) et à (5, 5) → saisie libérée, 0,05° et 0,10° de suite
   ✅ ; un relâché à x = −40 (hors fenêtre) laisse `saisieTerre.active = true`
   et la Terre suit la souris sans bouton (15° et 22°) — ⚠️ **non concluant** :
   le CDP ne livre probablement pas l'événement hors fenêtre, et un vrai Chrome
   capture le pointeur. À vérifier à la main, pas à noter.
4. **Non-régression C0 remesurée** (§②), pas lue.
5. **`git diff -- src/` du noteur : vide.**

---

## ⑤ CE QUE J'AI CRU PUIS RÉFUTÉ

1. **« Une fois `flyTo` fini et `busy` retombé, le crop est posé et immobile. »**
   Faux : ma première passe crop rendait un **témoin à +20,3° d'inclinaison et
   ×0,77 d'altitude sans geste** — la pente d'arrivée de D16 ter (46,48°) était
   encore en train de se poser. La sonde attend maintenant inclinaison **et**
   altitude stables 2,4 s ; le témoin est à 0,000°. **La première série crop est
   jetée** (`queue.log`), la seconde compte.
2. **« Le `contextmenu` n'est pas annulé (GE1 : `defaultPrevented: false`). »**
   Faux : GE1 écoutait en **capture** sur `document`, donc **avant** le canvas.
   En bulle sur `window` : `true` — après GE2 **et avant** (`c3444d3`).
3. **« Le clic droit vers le haut saute d'un facteur ×2,02 entre deux images. »**
   Faux à l'écran : `d` (distance caméra→cible **en unités de bloc**) double
   quand l'escalier change de palier, mais le **rayon de `camGlobe`** — ce qu'on
   voit — bouge de **0,76 %** au pire. GE1 avait signalé « ×2,046 au dézoom
   molette » comme défaut à part ; c'est la même illusion d'instrument, et GE2
   l'avait dit (« un franchissement de palier, pas un geste de pose »).
4. **« Maj + gauche est cassé (−69° au lieu de −50°). »** Incomplet : le
   milieu H rend aussi −69° une fois sur deux, et Maj rend −50° une fois sur
   deux. C'est le **geste de cap** qui est bimodal, pas le modificateur.
5. **« GE1 et GE2 se contredisent sur Google. »** Presque pas (§①) — ils
   parlaient de deux axes différents du même bouton.
6. **« Le globe ne tourne pas seul (GE1 : témoin 0,000°). »** Vrai en surface,
   **faux en orbite** : 3,24° en 90 images. GE2 l'avait mesuré et gelé
   (`params.animations`) ; je ne gèle rien, je lis le témoin.
7. **« Les 13,4° de la série V, c'est la bimodalité de GE1 qui revient. »**
   Non : GE1 mesurait **748 px** d'écart entre le point saisi et le curseur
   (le gain du geste, pendant le geste) ; ici le point saisi est à **0 px** au
   dernier `pointermove` et les 10° arrivent **après** le relâché — c'est un
   **élan** armé sur un pas dégénéré, donc C8, pas C0 (d). Cinq mesures d'élan
   dédiées (0,83–1,03°, 20 %) ne l'ont pas reproduit : il faut le pas court, que
   seule la série serrée a produit.
8. **« Un chargement sans tête est fiable. »** Un sur dix perd son cadre
   (`detached Frame`) en plein geste ; trois séries ont été rejouées (journal
   dans `.banc/GE3/queue*.log`), et la sonde recharge et rejoue **ce geste
   seul** plutôt que la série.

---

## ⑥ LES ARBITRAGES QUI REVIENNENT À ADRIEN

1. **`PIVOT_VERS_LE_CURSEUR` — le point désigné du double-clic** (et, par
   ricochet, celui de la molette, D19 §2). Google écrit *« Zoom toward cursor
   location »* ; D19 écrit « au centre de l'écran ». **À l'écran :** sous
   `centre`, un double-clic à 200 px du centre garde le centre planté et le
   point cliqué file vers le bord (aujourd'hui : ni l'un ni l'autre, 470/236 px) ;
   sous `curseur`, le point cliqué reste sous la souris et le centre glisse — et
   la molette, si elle suit, dérive de 49 px par 6 crans sous le curseur. **Ni
   l'un ni l'autre ne change la note d'aujourd'hui** (C4 est rouge des deux
   côtés) ; l'un des deux change la ligne D19 §2 du barème.
2. **Le clic simple** : garder la plongée R35 (« un clic = un cran vers le
   point ») contre Google (« un clic arrête, le double-clic zoome »). C'est
   2,5 points du barème et la réponse conditionne C4 et C5.
3. **Le clic droit horizontal** : inerte (sources officielles) ou rotation
   d'azimut (ancien Earth, miroir SERC). Les deux valent 1,5 au barème.
4. **Le facteur du double-clic droit** : `CRANS_DOUBLE_CLIC = 2` (×1,035) ou
   l'inverse du gauche (÷2). Google Pro dit seulement *« by a certain amount »*.
5. **L'élan à 20 %** : garder (Pro documente le lancer) ou borner à 15 %.
6. **L'inclinaison manuelle en haute altitude** (réserve GE2 n° 2) : à 2,4 Mm,
   36° d'inclinaison déplacent le point sous la caméra de **13,5°** et le centre
   de la Terre de **1 000 px** — géométriquement inévitable en tournant autour
   d'une cible au sol, mais visible.

---

## ⑦ RESTE OUVERT, PAS DE MON RESSORT

- **La bimodalité du cap** (−50° / −69,35° + 17,36° de roulis) : constatée,
  chiffrée, non diagnostiquée — comme GE1 pour la saisie.
- **Le relâché hors fenêtre** (§④ 3) : à faire à la main.
- **La symétrie de l'escalier** avant/arrière en surface (13 %).
- ⚠️ **Effet de bord de ce banc** : pour repartir propre après une série
  plantée, j'ai tué **tous** les `chrome.exe` de la machine (23:39), pas
  seulement les sans-tête. Si un Chrome d'Adrien était ouvert, il a été fermé.
  Je le dis parce que ce n'est pas rien.

---
---

# GE3 — TOUR 2 (2026-09-04) : RENOTATION SUR HEAD APRÈS LE SECOND TOUR DE GE2

`git merge regroupement` fait (`b7229b2` + fusion). **`git diff -- src/` : vide.**
`npm test` **4 799 · 0** (2 sautés) · `audit:tests` **257 = 257**. Serveur
7311 (`--host 127.0.0.1`), arrêté en partant ; seuls mes Chrome sans tête tués
(filtre `--headless` sur la ligne de commande). Même banc, même sonde
(`scripts/sonde-ge3.mjs` — GE2 n'y a fait qu'**ajouter** un diagnostic de pose et
l'élan par passe, la diff le montre : aucun champ ni seuil changé ; j'y ajoute la
trajectoire d'inclinaison pendant la montée, pour voir le redressement).
Relevés : `.banc/GE3/t2/` — crop en premier, surface 2,4 Mm (33 chargements),
**onze séries de huit chargements**, orbite 24 Mm.

## ① LES QUATRE LECTURES DU BARÈME QUE GE2 CONTESTE — tranchées à la source

**Règle que je m'applique** : un correcteur qui conteste le barème a raison si
la source le dit **et** si la correction ne verdit pas *aussi* son état d'avant.
J'ai donc rejoué le barème corrigé sur mes relevés du **tour 1** : il y rend
**12 verts / 6 rouges** (contre 11 / 7) — seul C1 « zoome » passe, la symétrie y
reste rouge à 12 %. Le seuil n'a pas glissé vers le correctif.

| # | contestation | source | verdict |
|---|---|---|---|
| 1 | **C1, le sens** : le test GE1 attendait *haut = zoom avant* | guide v4 officiel, § *Using a Mouse* : *« press the RIGHT mouse button … move the mouse backward or **pull toward you**, releasing the button when you reach the desired elevation »* = **zoom in** ; *« move the mouse forward or **push away from you** »* = **zoom out**. `148186` ne dit rien du clic droit ; `148115` dit *« Right-click and drag up or down »* sans sens. | **GE2 a raison, le test GE1 était à l'envers.** Vers le bas de l'écran = vers soi = **avant**. Corrigé dans `test/attaque-ge-ROUGE.mjs` (commenté en tête, diff dans ce commit). |
| 2 | **C1 et C4 droit, l'unité** : `rapportDistance` en unités de bloc | écrit côte à côte sur le même geste (clic droit vers le haut, 200 px, tour 2) : **`d` de bloc 0,997** (`\|Δ ln d\|` = **0,721** sur UNE image) — **altitude `camGlobe` ×2,009** (pire image **1,0075**). Même chose sur le double-clic droit : bloc 0,99, altitude ÷2,009, pire image 1,020. | **GE2 a raison.** `d = camera.position.distanceTo(controls.target)` vit dans l'espace du bloc, dont l'échelle **double à chaque palier** de l'escalier : il mesure un franchissement, pas le geste. Le barème veut « le rapport de distance caméra→cible » ; au nadir c'est l'altitude, en mètres du centre de la Terre — D19 l'exige d'ailleurs en toutes lettres (*« jamais en unités de bloc »*). C'est la classe d'erreur n° 1 du chantier, et GE1 y est tombé en l'écrivant ; moi au tour 1 en le lisant (j'avais déjà noté C1 sur `pireRapportAlt`, pas le rapport lui-même). `zoomDe()` lit `rapportAlt` dans le test. |
| 3 | **D19 §2 sous `GE_VISEE=curseur`** : la visée du double-clic appliquée à la molette | Google ne publie **aucune** cible pour la molette (W1, W2 : pas une ligne ; P1 : *« zoom in and out »* seulement) ; D19 §2 : « au centre de l'écran ». La cible du double-clic est publiée : *« toward cursor location »*. | **À scinder, et scindé** : `GE_VISEE` ne bascule que C4 ; la molette est **toujours** jugée au centre. Mesuré : molette au centre **0,00 px** (1, 6 avant, 6 arrière), sous le curseur 49 px — D19 §2 tenue, quelle que soit la visée. |
| 4 | **C6, le second mode** : angle polaire 54,28° AVANT le geste, D16 ter violée par le vol de présentation | ma sonde enregistre l'inclinaison **pendant la montée à 2,4 Mm**, sur 33 chargements : inclinaison de départ jusqu'à **51,1°** hors du crop (pas « une fois sur deux » : **33/33** — sur mes chargements la pose tombe toujours au-dessus du seuil), redressée **avant** tout geste : `tiltFin` **0,000° × 33**, `retoursNadir = 2 × 33`, **plus grand pas 1,476°/image** — c'est le balayage de `_armerRetourNadir`, plafonné par R4 à 1,5°/image ; pas un saut. | **GE2 a raison sur la cause** (une violation de D16 ter antérieure, masquée par le crop de démarrage), et le correctif tient : cap **−50,000°** **8/8** (milieu H : −50,000 × 8, roulis du sol 2,42–2,43° ; Maj + gauche : −50,000 × 8 ; angle polaire avant le geste 0,00° × 8). **C3 n'est pas cassé** : Ctrl + glissé V incline toujours (**+36,9°**, centre 6,9 px, `inclinaisonManuelle` la protège) — **8/8** : +36,45 à +36,94°, centre 6,55–6,87 px, `|Δ ln d|` 8,9e-16. Réserve : le `retoursNadir = 2` reste inexpliqué par GE2 (deux balayages par chargement) ; à l'écran, un balayage de ≤ 1,48°/image. |

## ② LA NOTE, TOUR 2 — mes mesures, huit chargements par critère noté

**Règle de partage écrite** : un critère vaut ses points **entiers** s'il tient
tous ses seuils sur **8 chargements sur 8** dans le régime où il s'applique
(surface 2,4 Mm, hors crop) ; un seuil du barème dépassé sur une sous-partie
coûte la fraction de la sous-partie (C4 : deux moitiés) ; rien n'est retiré pour
ce qui n'est pas dans le barème — ça va en réserve, pas en note.

### C0 — non-régression : **9 / 9, passée**

| | seuil | mesuré tour 2 |
|---|---|---|
| a, b | `npm test` ≥ 4 755 · 0 ; audit sans écart | **4 799 · 0** ; **257 = 257** |
| c | Terre ≤ 1,0 px | **0,00 px** sur les 16 passes H + V |
| d | prise ≤ 1,4 px, **8/8**, H et V | **0 × 8** (H) · **0 × 8** (V) |
| e | molette au centre ≤ 1,4 px | **0,00 / 0,00 / 0,00 px** ; crop 0,04 ; orbite 1,38 |
| f | D16 ter restreint | **0,000°** sur glissés, élan, molette (avant **et** arrière) |
| g | `\|Δ ln d\|` < 1e-4 sur un geste de pose | saisie 0 · cap 0 · inclinaison 8,9e-16 · crop 4,4e-16 |
| h | clic ≤ 1,023 entre deux images | le geste de plongée est devenu le double-clic : pire image **1,0125–1,013** (gauche ×8), **1,0196–1,0201** (droit ×8) |
| i | pas de table `DIVE_TIERS` | inchangé |

### Les critères notés

| | seuils | **mesuré (8 chargements sauf mention)** | pts |
|---|---|---|---|
| **C1** clic droit V zoome | ×1,5–3 · tilt, azimut ≤ 0,2° · sol ≤ 0,3° · image ≤ 1,10 · inverse ±5 % | bas (vers soi) : **×2,0128–2,0136** ; haut : **×0,4977–0,4978** ; tilt 0, azimut 0, sol 0, centre 0 px ; pire image d'altitude **1,0047 / 1,0076** ; symétrie `\|ln\|` **0,0018–0,0024** (seuil 0,05). Orbite : ×1,90 / ×0,52, 0,005. Crop : pan d'OrbitControls (exception, voulu) | **2,0 / 2,0** |
| **C2** clic droit H | inerte | **0,000° / 0,000° / ×1,0000** ; diagonale : sol 0°, zoom seul | **1,5 / 1,5** |
| **C3** Ctrl + glissé | V 25–80°, centre ≤ 20 px, ln ≤ 0,10 · H ≥ 20°, tilt ≤ 2° | V : **+36,45 à +36,94°, 6,55–6,87 px, `\|Δ ln d\|` 0** (× 8) · H : **−50,000°**, tilt 0 · Maj V : +36,73°, 6,73 px | **1,5 / 1,5** |
| **C4** double-clic | gauche 1,8–2,2, ≤ 25 px du point désigné, tilt ≤ 0,5°, roulis ≤ 2° · droit 0,45–0,56, ≤ 25 px | gauche : **×2,0127–2,0135, point cliqué à 0,00 px × 8**, tilt 0, roulis **1,86–1,98°** (sous 2°, de peu) · droit : **×0,4977–0,4979, 0,00 px × 8**, tilt 0, **roulis 3,71–3,92°** — au-dessus des 2° écrits. ⚠️ C'est le prix géométrique de la visée curseur arbitrée (garder un point à 233 px du centre sous le curseur en s'éloignant ×2 déplace le point sous la caméra de ~2× l'angle de l'offset) ; GE1 a écrit 2° sans ce calcul. Je retire le quart du droit **par fidélité au barème écrit**, et je le dis pour qu'Adrien tranche (§④). Crop : double-clic gauche = la plongée R35 (×1,51), droit rien — voulu | **1,25 / 1,5** |
| **C5** clic simple | ×1 ± 2 %, sol ≤ 0,05° | **×1,0000 · 0,000° · 0 px × 8** ; crop : rien ; orbite : 1,9° = la rotation propre du globe (témoin 2,9°) | **1,0 / 1,0** |
| **C6** milieu / Maj | V ≥ 25° · H ≥ 20°, tilt ≤ 2° · Maj = milieu ±10 % | V : **+36,59°** · H : **−50,000° × 8** · Maj H : **−50,000° × 8** (écart 0,00 %) ; angle polaire avant le geste **0,00° × 24** | **1,0 / 1,0** |
| **C7** menu | prévenu | prévenu en surface, crop, orbite (bulle) | **0,5 / 0,5** |
| **C8** élan | ≤ 15 % · ≤ 1 800 ms · un clic l'éteint | **10,1 % × 8** (0,348–0,370° pour 3,43–3,65°), mort en **1 366–1 417 ms** ; orbite 9,9 % ; clic droit → 0,000 °/s ; **plus aucune passe à 10°** (16 séries de saisie, 0 dérapage) | **1,0 / 1,0** |

**TOTAL : 2 + 1,5 + 1,5 + 1,25 + 1 + 1 + 0,5 + 1 = 9,75 / 10.** Au-dessus de 7,5.
GE2 s'estimait à 8,5 (9,5 en altitude) : il était **en dessous** de sa mesure —
l'unité qu'il contestait était la bonne, et le quart que je retire n'est pas
celui qu'il retenait (C4 droit : il doutait de son unité, moi du roulis).

## ③ L'ANTI-TRICHE, TOUR 2

1. **`test/attaque-ge-ROUGE.mjs`** : GE2 ne l'a pas touché (diff vide entre
   `725d5f0` et sa livraison). **Moi si**, en tant que propriétaire du barème,
   pour les trois lectures de §① — 31 lignes, commentées en tête du fichier, et
   **rejouées sur le tour 1 pour vérifier qu'elles n'y verdissent que ce qui le
   mérite** (12/6 contre 11/7). Le barème d'origine, rejoué tel quel sur les
   relevés du tour 2, rend **14 verts / 4 rouges** — exactement ce que GE2
   annonçait, ses quatre rouges étant les trois lectures corrigées.
2. **Tests existants** : GE2 a réécrit un test de `clic-glisse.test.js`
   (« le clic-plongée accepte la fenêtre bornée » → « le clic simple ne plonge
   plus ») et retourné l'assertion `GE2 ⑮` (`PIVOT_VERS_LE_CURSEUR` = `true`,
   sur arbitrage du coordinateur). Les deux suivent la règle nouvelle, aucun
   seuil de mesure n'a bougé. `veille-repos.test.js` +124 lignes (ajouts).
3. **Le crop en premier** : identique au tour 1 — boutons OrbitControls
   intacts (`0 · 2 · 2`), glissé = azimut −75,7°, molette au centre 0,04 px,
   menu prévenu, clic simple **inerte**, double-clic gauche = plongée R35.
4. **Hors barème** : diagonales (saisie 0 px ; zoom seul), Ctrl/Maj + molette
   (= molette), clic droit pendant l'élan (0 °/s puis zoom), relâché au coin et
   sur l'interface (saisie libérée, 0,02°) — tous propres ; relâché hors
   fenêtre toujours non concluant au CDP.
5. **Sa réserve, l'épingle** : le point cliqué reste sous le curseur pendant la
   course (0,00 px × 16) au prix d'une rotation du sol de **1,86–1,98°** (gauche)
   et **3,71–3,92°** (droit) — mesurée, tenue sous 2° à gauche seulement.
6. **Le redressement automatique** (`redresserSiHerite`) : 33 chargements,
   inclinaison de départ jusqu'à 51,1° hors du crop, ramenée à **0,000°** avant
   tout geste, **plus grand pas 1,476°/image** (le plafond R4), `retoursNadir`
   = 2 partout. C3 intact (8/8). Réserve : la seconde arme n'est pas nommée.
7. **Orbite** : le globe y tourne seul (témoin 2,9° / 90 images) et je ne le
   gèle pas — les 74 px du double-clic droit en orbite sont à relire avec ça,
   pas à noter.

## ④ RESTE À ADRIEN

1. **Le roulis du double-clic droit** (3,7–3,9° pour ÷2 depuis un point à
   233 px du centre) : conséquence de « zoom away from cursor location ». Soit
   le seuil de 2° s'écrit pour le gauche seul, soit la visée du droit revient au
   centre (Google ne la publie que pour Web, et Pro dit *« from that point »*).
   C'est le quart de point manquant.
2. **`retoursNadir = 2`** : pourquoi deux balayages par chargement.
3. **Le vol de présentation laisse une inclinaison de ~50° hors du crop** sur
   tous mes chargements — le redressement la corrige, la cause reste.
