# GE1 — LA SPÉCIFICATION DES GESTES DE SOURIS, ET LE BARÈME

Arbre `C:\Dev\wt-ge1`, branche `gestes-ge-specif`. **`git diff -- src/` : vide
(0 octet).** `npm test` **4 755 · 0**. `audit:tests` **253 listés · 253 sur
disque, aucun écart**. Serveur `npm run dev -- --host 127.0.0.1 --port 6771`,
arrêté en partant.

---

## ⚡ EN TÊTE — DEUX CONTRADICTIONS ENTRE D19 ET GOOGLE EARTH. JE NE TRANCHE PAS.

### ① LA VISÉE DU ZOOM : « CENTRE DE L'ÉCRAN » (D19) CONTRE « CURSEUR » (GOOGLE)

**D19, mot pour mot :** *« quand je scrolle pour zoomer ou dézoomer, je scrolle
vers le point visé au centre de l'écran »*, et le texte insiste : *« Ni vers le
curseur… : vers la surface au milieu du cadre. »*

**Google Earth Web, mot pour mot**, page officielle *« Use keyboard shortcuts on
your computer »*, mise à jour le **2026-09-01** :

| Action | Keystroke combination |
|---|---|
| **Zoom toward cursor location** | **Double click (left)** |
| **Zoom away from cursor location** | **Double click (right)** |

<https://developers.google.com/maps/documentation/earth/use-keyboard-shortcuts>
(redirection permanente depuis <https://support.google.com/earth/answer/7365025>)

**C'est la SEULE phrase que Google publie sur la cible d'un geste de zoom, et
elle dit « cursor location », deux fois.** Google ne publie **rien** sur la cible
de la molette — ni « curseur », ni « centre ». Il n'y a donc pas de citation qui
oppose directement molette-centre à molette-curseur ; il y a une **doctrine
maison** — le zoom d'Earth Web vise ce que le curseur désigne — et D19 dit
l'inverse.

**Ce que ça coûte, chiffré, dans les deux sens** (mesuré aujourd'hui à 2,44 Mm,
curseur posé à 200 px à droite et 120 px au-dessus du centre) :

| | le point qui était au **centre** dérive de | le point qui était sous le **curseur** dérive de |
|---|---|---|
| 1 cran de molette | **0,00 px** | 3,97 px |
| 6 crans vers l'avant | **0,00 px** | 49,29 px |
| 6 crans vers l'arrière | **0,00 px** | 35,65 px |

➡️ **Notre molette tient D19 à 0,00 px — exactement, pas « à 1,4 px près ».**
Et c'est exactement pour cette raison qu'elle **ne peut pas** être « comme Google
Earth » : les deux règles sont incompatibles dès que le curseur quitte le centre.

**Les deux issues, et ce qu'elles emportent :**

- **Adrien maintient D19 (centre).** Alors « exactement les mêmes fonctions que
  Google Earth » devient « les mêmes fonctions, la même cible de zoom qu'à
  D19 » : le double-clic devra viser le **centre** lui aussi, contre la lettre
  de la page Google. Rien à défaire : l'acquis R32 tient tel quel. **Il faut
  alors réécrire la phrase 3 de D19** (« la référence est Google Earth ») pour y
  inscrire l'exception, sinon la prochaine passe rouvrira la question.
- **Adrien tranche pour Google Earth (curseur).** Alors D19 §2 est **abrogé**,
  l'acquis « molette ≤ 1,4 px vers le centre » devient une **régression à
  produire**, et le critère de non-régression du barème change de colonne (il est
  écrit ci-dessous pour basculer d'un mot, `GE_VISEE=curseur`).

⛔ **C'est un arbitrage de produit, pas une mesure. Je ne le prends pas.**

### ② L'INCLINAISON AUTOMATIQUE : D16 TER CONTRE LE « SMART TILT » DE GOOGLE

Moins visible, mais elle mordra. Google Earth **incline tout seul** quand on
approche du sol — le clic droit y bascule en inclinaison près du terrain.
⚠️ **Ma seule source est P3, un miroir hors google.com** : je ne le donne donc
pas pour verbatim officiel. **D16 ter interdit exactement cela** : *« On passe en vue 3/4 quand on
arrive au bloc, pas avant. »* Les deux ne peuvent pas être vraies pendant la
descente.

D19 avait déjà anticipé et tranché ce point-là (*« D16 ter : la vue de trois
quarts arrive au bloc… ici l'inclinaison automatique reste réservée au crop »*).
**Je le signale sans le rouvrir** : c'est l'écart connu, il est arbitré, et le
barème le protège au lieu de le noter. Mais un implémenteur qui lit « exactement
comme Google Earth » sans lire D16 ter va le casser.

---

## ① LA RÉFÉRENCE — CE QUE FAIT LA SOURIS DANS GOOGLE EARTH

### Les sources, et laquelle fait foi

| clé | page | produit | URL | date de la page |
|---|---|---|---|---|
| **W1** | *Navigate the globe*, onglet **Computer** | **Earth Web** (earth.google.com) | <https://developers.google.com/maps/documentation/earth/discover-places-change-view> (redirection depuis <https://support.google.com/earth/answer/7364447>) | 2026-09-01 |
| **W2** | *Use keyboard shortcuts on your computer* | **Earth Web** | <https://developers.google.com/maps/documentation/earth/use-keyboard-shortcuts> (redirection depuis <https://support.google.com/earth/answer/7365025>) | 2026-09-01 |
| **P1** | *Explore the Earth on your computer* | **Earth Pro / application de bureau** | <https://support.google.com/earth/answer/148186?hl=en> | — |
| **P2** | *Use your keyboard to navigate Google Earth* | Earth Pro | <https://support.google.com/earth/answer/148114?hl=en> | — (⚠️ **clavier seulement, aucun geste souris** — vérifié) |
| **P3** | *Google Earth User Guide* (v4), miroir universitaire | Earth Pro, guide historique | <https://serc.carleton.edu/sp/library/google_earth/UserGuide.html> | ⚠️ **hors domaine google.com** — miroir, à ne pas citer comme officiel |

➡️ **C'est W1 + W2 qui font foi**, et pour la raison qu'Adrien donne lui-même :
il a Earth **dans un navigateur**, et notre produit est **une page web**. P1 sert
à combler ce que Google ne documente pas pour le Web (bouton du milieu,
molette), en le marquant comme **Pro**.

### Le tableau, verbatim quand c'est verbatim

| geste | action | pivot | bornes / cas limites | source |
|---|---|---|---|---|
| **clic gauche glissé** | *« Move around: Drag with your mouse. »* — on attrape le globe, il tourne sous le doigt | le **centre de la Terre** (le globe roule, il ne se déplace pas dans le cadre) | pas de butée en longitude ; en latitude on butte aux pôles | **W1** |
| **clic gauche relâché avec élan** | ⚠️ **AUCUNE page de Google ne mentionne d'inertie.** Earth Web glisse en pratique après un lancer ; ce n'est pas documenté | — | ⛔ **ni exigée ni interdite** : à borner, pas à copier | **aucune** |
| **double-clic gauche** | *« **Zoom toward cursor location** »* | le **point sous le curseur** | pas de facteur publié ; un cran franc, pas un vol | **W2** |
| **double-clic droit** | *« **Zoom away from cursor location** »* | le **point sous le curseur** | idem, en sens inverse | **W2** |
| **clic droit glissé — vertical** | *« Zoom in and out: … or **right drag the mouse** »* | Web : non précisé. **Pro** : le point visé, avec bascule en inclinaison près du sol | Earth Web l'annonce comme l'équivalent des boutons +/− du coin bas droit | **W1** (Web) · P3 (Pro : « up/down zooms ») |
| **clic droit glissé — horizontal** | ⚠️ **Earth Web ne le documente pas.** **Pro** : rotation du 3D Viewer (gauche = sens horaire) | l'axe de visée | — | P3 uniquement (**miroir**) |
| **molette** | *« Use the scroll wheel on your mouse or mouse touchpad to zoom in and out. »* | ⚠️ **NON PUBLIÉ** — ni curseur ni centre | continue au geste ; pas de facteur publié | **P1** (Pro). ⚠️ **W1 ne cite pas la molette du tout** |
| **molette enfoncée + glissé** | *« Press and hold the scroll button. Then, move the mouse forward or backward »* → **incline** ; gauche/droite → **tourne** | le point visé | documenté **Mac** ; non documenté pour Earth Web | **P1** (onglet Mac) |
| **Ctrl + glissé** | *« **Explore around your location: Hold Ctrl + drag the screen.** »* → incline et tourne autour du lieu visé | **le point visé**, pas la caméra | **c'est LA liaison d'inclinaison d'Earth Web** | **W1** |
| **Maj + glissé gauche** | *« To tilt: Press **Shift** + Left-click. Then, drag in any direction. »* (Windows & Linux) | le point visé | ⚠️ **Pro seulement.** Sur Earth Web c'est Ctrl | **P1** |
| **Maj + molette** | *« Press **Shift** and scroll forward or backward to tilt up and down. »* | le point visé | ⚠️ **Pro / Mac** | **P1** |
| **clic simple** | ⚠️ **AUCUNE page ne lui attribue d'action de caméra.** Le zoom est explicitement le **double**-clic | — | ➡️ **un clic simple sur le globe ne doit rien faire** | **W2**, par exclusion |
| **menu contextuel** | Google Earth n'ouvre **aucun** menu de navigateur sur le globe — il ne le peut pas, le clic droit y est un geste de caméra | — | ➡️ `contextmenu` doit être **annulé** sur le canvas | W1 (le clic droit est pris) |
| *(clavier, pour mémoire)* | `n` nord · `u` vue de dessus · `r` réinitialise · `o` 2D/3D · Maj+flèches tourne · Maj+PgUp/PgDn altitude · Espace stoppe la rotation | | | **W2** |

### Les quatre réponses nettes que le brief demande

1. **Le clic droit : incline-t-il ou zoome-t-il ?** → **IL ZOOME.** Et sur Earth
   Web, pas seulement sur Pro : W1 le range noir sur blanc sous *« Zoom in and
   out »*, à égalité avec les boutons +/−. **L'inclinaison d'Earth Web est sur
   `Ctrl + glissé`**, pas sur le clic droit. Le clic droit horizontal n'est
   documenté que côté Pro (rotation) — c'est le seul point du tableau où il faut
   choisir sans source Web.
2. **Qui tourne l'azimut, qui incline ?** → **Ctrl + glissé fait les deux** sur
   Earth Web (*« explore around your location »* : on orbite autour du lieu, ce
   qui incline en vertical et tourne en horizontal). Sur Pro : **Maj + gauche**
   incline, **molette enfoncée** incline (vertical) et tourne (horizontal),
   **clic droit horizontal** tourne.
3. **Le double-clic** → **vers le point sous le CURSEUR**, verbatim, gauche pour
   entrer, droit pour sortir. **Le facteur n'est pas publié.** Je propose ×2 /
   ÷2 par cohérence avec l'usage observé et avec `Page up/down`, et je le dis
   comme un choix, pas comme une citation.
4. **La molette : crans ou continu, curseur ou centre ?** → Google dit seulement
   *« use the scroll wheel to zoom in and out »* (**Pro**). **Ni la granularité
   ni la cible ne sont publiées.** ⚠️ C'est précisément le trou par lequel passe
   la contradiction ① : je ne peux pas la trancher par la documentation.
5. **L'inertie ?** → **rien de publié.** Notre élan mesuré (0,74° après un geste
   de 4,00°, éteint en 1 384 ms) ne contredit aucune source. À borner.
6. **Le menu contextuel ?** → **il ne doit pas s'ouvrir.** Chez nous il s'ouvre
   (mesuré ci-dessous). C'est un correctif d'une ligne et une condition à lever.

---

## ② NOTRE ÉTAT — MESURÉ, GESTE PAR GESTE

**Le banc** : `scripts/sonde-ge1.mjs` (nouveau, hors `src/`). Chrome sans tête
1 280 × 800, gestes envoyés par CDP `Input.dispatchMouseEvent`, relevé dans un
`requestAnimationFrame` posé **après** celui de `tick()` — donc après
`majCameraFond()`, sur la caméra qui rend. Relevés bruts :
`.banc/GE1/mesures-2000km.json`, `mesures-5km.json`,
`stabilite-gaucheH-8x.json`.

**Altitude de mesure : 2,44–2,55 Mm**, et ce choix est un résultat (voir §④).
Course de 200 px depuis le centre ; curseur de contrôle à (+200, −120) px du
centre. Colonnes : `rot` = rotation du point sous la caméra en grand cercle
(degrés) ; `saisi` = distance en pixels entre le point saisi au `pointerdown` et
le curseur au relâché ; `centre0` / `curseur0` = de combien de pixels s'échappe
le point qui était au centre de l'écran / sous le curseur au début du geste ;
`×d` = rapport de distance caméra→cible.

| geste | ce qu'il fait **chez nous**, mesuré | attendu (Google Earth Web) | **verdict** |
|---|---|---|---|
| **gauche glissé H** (200 px) | la Terre roule de **3,39°**, centre de la Terre **0,00 px**, `saisi` **0,00 px**, `centre0` 207,8 px pour 200 px de course, tilt **0,000°** | on attrape le globe | ⚡ **CONFORME… 5 fois sur 8.** Voir la réserve ci-dessous |
| **gauche glissé V** (200 px) | rot **3,40°**, `saisi` **0,00 px**, tilt **0,000°**, centre de la Terre **0,00 px** | idem | **conforme** |
| **gauche relâché avec élan** | **+0,79°** après le relâché pour un geste de **3,94°** — **20 %** — éteint en **1 383 ms**. Un cran de molette l'éteint sur-le-champ (`main.js:13761`) | non documenté | **rien à contredire**, mais **au-dessus du plafond que je propose** (15 %) : C8 est rouge |
| **double-clic gauche** | **×2,000** de distance, **3,84°** de roulis, `curseur0` **236,3 px**, `centre0` **469,7 px**, tilt 0,000°. ⚠️ **Résultat IDENTIQUE au clic simple** : le second clic est avalé | ×N vers le **curseur**, `curseur0` ≈ 0 | **DIFFÉRENT** — le facteur ×2 est bon, la **cible est fausse de 236 px** |
| **double-clic droit** | **rien du tout** : ×1,000, 0,00°, 0,00 px sur 190 images | *« Zoom away from cursor location »* | **ABSENT** |
| **clic droit glissé vertical** | un **déplacement latéral** : ×d **1,000**, rot **2,56°**, `saisi` 51,6 px, `centre0` **154,2 px** — la signature du pan | **ZOOM** | **DIFFÉRENT** (fonction complètement autre) |
| **clic droit glissé horizontal** | le **même pan** : rot 2,61°, `centre0` 154,6 px, azimut **0,000°** | rotation d'azimut (Pro) ou rien | **DIFFÉRENT** |
| **molette** | zoome. 1 cran **×1,0171** ; 6 crans **×1,2109** ; `centre0` **0,00 px** aux trois essais ; `curseur0` 4,0 / 49,2 / 40,9 px | zoom ; cible non publiée | **conforme à D19**, **non conforme à la doctrine curseur** — c'est la contradiction ① |
| **molette (dézoom)** | ⚠️ deux défauts propres : un pire rapport entre deux images de **×2,046** (à comparer au ×1,026 de la Tâche M), et une **inclinaison parasite de −2,607°** hors du bloc — **une violation de D16 ter** | — | **défauts à part entière**, indépendants du vocabulaire des gestes |
| **molette enfoncée + glissé** | ⚠️ **le commentaire en tête de `boutons-camera.js` est FAUX** : il annonce que « le bouton du milieu ne fait donc RIEN », or `versTroisJs` lui pose `MOUSE.PAN` et `enablePan` vaut `true`. Mesuré : **pan**, `centre0` 154,5 px, azimut 0,58°, tilt 0,000° | incliner (V) et tourner (H) | **DIFFÉRENT** — et la documentation du dépôt ment sur ce point |
| **Ctrl + glissé** | **pan**, exactement la même signature : `saisi` 51,2 px, `centre0` **154,6 px** ; tilt **−0,707°** seulement | **incliner et tourner autour du lieu visé** | **DIFFÉRENT** — c'est l'écart le plus visible du tableau |
| **Maj + glissé gauche** | **pan** (`centre0` 154,6 px, tilt 0,000°) | (Pro : incliner) | **DIFFÉRENT** |
| **Alt + glissé gauche** | **strictement identique au glissé nu** (`saisi` 0,00 px, rot 3,35°) : Alt n'est intercepté par personne | pas d'action Alt documentée | **conforme** (rien à faire) |
| **Maj + molette** | **identique à la molette nue** (×1,2109) : Maj n'est pas lu | (Pro : incliner) | **ABSENT** |
| **clic simple** | **plonge** : ×d **2,000 à 2,083**, la Terre roule de **3,90°** ou **13,96°** selon la passe, et **incline de 0° ou 7,684°** — ⚠️ **il est bimodal lui aussi** ; `centre0` 469,6 à 766,2 px | **rien** | **DIFFÉRENT** — un geste de trop |
| **menu contextuel** | 1 événement `contextmenu`, **`defaultPrevented: false`** → **le menu du navigateur s'ouvre**. `main.js:3140` n'annule que si `fenetreContinueActive() && mode === 'surface'`, et `fenetreContinue` est **éteint** (`flags.js`) | aucun menu | **DIFFÉRENT** |

### ⚡ LA RÉSERVE QUI PÈSE PLUS QUE LE RESTE — D19 §1 EST TENUE 5 FOIS SUR 8

`scripts/sonde-ge1.mjs --geste gauche-glisse-H --repete 8`, **huit chargements de
page indépendants**, même geste, même altitude :

```
saisiVsPointeurPx = 0 · 752,04 · 0 · 0 · 0 · 752,76 · 751,26 · 0
rotation          = 3,39° · 15,78° · 3,40° · 3,44° · 3,39° · 15,78° · 15,78° · 3,32°
```

⚠️ **Ce n'est PAS propre à l'axe horizontal.** Un `alt-gauche-glisse-V` (un
glissé gauche nu, Alt n'étant lu par personne) a rendu **386,53 px** et 5,06° de
rotation dans le dernier lot, là où les autres passes rendaient 0,00 px et 3,35°.
Et le **clic simple** est bimodal de la même façon (3,90°/0° d'inclinaison contre
13,96°/7,684°). C'est donc **le glissé gauche et la plongée**, sur les deux axes.

**C'est bimodal, pas bruité** : soit **0,00 px et 3,4°**, soit **≈ 752 px et
15,78°** — un facteur **4,65** exactement reproductible, **3 fois sur 8**. Le
centre de la Terre reste à 0,00 px dans les deux modes, donc le pivot est bon ;
c'est le **gain** du geste qui saute. Un premier lot (avant l'étage d'altitude)
avait donné le mode cassé sur les trois glissés horizontaux d'affilée.

⚠️ **R32 a été validée 10/10 avec « 0,2 px ».** Ce n'est pas contredit — c'est
**sous-échantillonné** : une passe unique a 5 chances sur 8 de tomber sur le bon
mode. **Toute mesure de D19 §1 faite en une seule passe ne prouve rien.**
Je n'ai pas cherché la cause : ce n'est pas mon rôle ici, et le noteur doit
pouvoir la constater sans moi. Elle est dans le barème comme **critère
éliminatoire**, exigée **8 fois sur 8**.

### Et au bloc (4,4 km), pour mémoire

Le glissé gauche n'y attrape plus la Terre : il fait tourner **l'azimut**
(−12,3° pour 50 px, −38,3° pour 100 px) avec un déplacement du sol de **0,007°**.
C'est **l'exception du crop, explicitement autorisée par D19** (*« sur le bloc
croppé, le pivot est l'axe du bloc (R13) »*). **À ne pas noter comme un défaut**,
et à ne pas « corriger » : GE2 doit laisser ce régime tranquille.

### Ce que le banc dit des réglages

`controls.mouseButtons = { LEFT: 0 (ROTATE), MIDDLE: 2 (PAN), RIGHT: 2 (PAN) }`,
`enableZoom: false`, `enablePan: true`, `enableRotate: **false**` (éteint par
`appliquerSaisieTerre` dès que le régime de saisie tient le globe),
`enableDamping: true`, `dampingFactor: 0,03`.

➡️ **Le vocabulaire actuel se résume à trois mots** : gauche = attraper la Terre,
**tout le reste = le même pan**, molette = zoom. Google Earth en a **sept**.

---

## ③ LE BARÈME — sur 10, avec un critère éliminatoire

⚠️ **Toutes les grandeurs sont observables** : pixels d'écran, degrés d'angle,
rapport de distance caméra→cible entre deux images. **Aucune unité de bloc.**
Tous les seuils se lisent dans `.banc/GE1/mesures-*.json` produit par
`node scripts/sonde-ge1.mjs --port <p> --alt 2000000`.

### C0 — NON-RÉGRESSION · **ÉLIMINATOIRE** · un seul manquement ⇒ **note 0/10**

| | exigence | seuil | où le lire |
|---|---|---|---|
| a | suite verte | `npm test` **4 755 · 0** | sortie |
| b | tests tous branchés | `audit:tests` **253 = 253** | sortie |
| c | **D19 §1, pivot** | centre de la Terre ≤ **1,0 px** sur un glissé de 200 px, H et V | `terreDerivePx` |
| d | ⚡ **D19 §1, prise — 8 PASSES SUR 8** | `saisiVsPointeurPx` ≤ **1,4 px** aux **huit** chargements, H et V | `--repete 8` |
| e | **D19 §2, molette** | `centre0DerivePx` ≤ **1,4 px** sur 1 cran et sur 6 crans, aller **et** retour | `molette-*` |
| f | **D16 ter**, ⚠️ **portée restreinte, et c'est un résultat** | le **glissé gauche** (H, V, avec élan) et la **molette avant** n'inclinent pas de plus de **0,5°** au-dessus de 32 274,3 m | `dTiltDeg` |
| g | **`veille-repos`** | `\|Δ ln(distance caméra→cible)\|` < **1e-4** au repos ; écriture de `controls.target` uniquement en **translation rigide** (caméra ET cible du même vecteur) | test existant |
| h | **clic sur le globe** | pire rapport de distance entre deux images ≤ **1,023** sur **huit** clics | tâche R35 |
| i | pas de code mort | `git diff -- src/` de GE2 ne réintroduit pas `DIVE_TIERS` comme table de paliers | relecture |

⚠️ **Si Adrien tranche « curseur » (contradiction ①), le critère (e) devient :
`curseur0DerivePx` ≤ 1,4 px**, aux mêmes valeurs. Le fichier de tests bascule
d'une variable d'environnement, `GE_VISEE=centre` ou rien.

⚠️ **POURQUOI (f) EST RESTREINTE.** Un critère de non-régression doit être VERT
au départ, sinon il n'élimine rien : il condamne. Or **D16 ter est déjà violée
aujourd'hui, hors du bloc, par deux gestes** — le **clic simple** incline de
**7,684°** à 2,45 Mm (c'est sa plongée), la **molette arrière** de **−2,607°**.
Ces deux-là sont notés ailleurs (C5 pour le premier, réserve ouverte pour le
second), pas dans la porte éliminatoire. Le test `⚠️ RÉSERVE` les garde sous les
yeux du noteur et passera au vert quand C5 sera tenu.

⛔ **(d) est neuf et il est ROUGE aujourd'hui : 5/8.** Un candidat qui ne le
répare pas ne peut pas dépasser 0, quoi qu'il fasse d'autre. C'est délibéré :
le geste le plus utilisé du produit ne peut pas être juste cinq fois sur huit.

### Les critères notés — 10 points

| | critère | seuils chiffrés | pts |
|---|---|---|---|
| **C1** | **Le clic droit glissé verticalement ZOOME** (W1) | 200 px vers le haut : rapport de distance **1,5 ≤ ×d ≤ 3,0** · `\|Δtilt\|` ≤ **0,2°** · `\|Δazimut\|` ≤ **0,2°** · rotation du sol ≤ **0,3°** (sinon c'est resté un pan) · pire rapport image à image ≤ **1,10** · le geste inverse rend l'inverse à **±5 %** | **2,0** |
| **C2** | **Le clic droit glissé horizontalement** — Web muet, Pro dit « rotation » | **au choix, et il faut choisir** : soit `\|Δazimut\|` ≥ **20°** avec `\|Δtilt\|` ≤ 2° et `\|ln ×d\|` ≤ 0,1 ; soit **inerte** : `\|Δazimut\|` ≤ 0,2°, rotation du sol ≤ **0,05°**, `\|ln ×d\|` ≤ 0,01. ⛔ **Un pan (rot ≥ 0,3°) vaut 0** | **1,5** |
| **C3** | **`Ctrl + glissé` incline et tourne autour du lieu visé** (W1, verbatim) | vertical 200 px : **25° ≤ \|Δtilt\| ≤ 80°**, monotone · le point visé au centre s'échappe de ≤ **20 px** (on orbite **autour de lui**) · `\|ln ×d\|` ≤ **0,10** (incliner n'est pas zoomer). Horizontal 200 px : `\|Δazimut\|` ≥ **20°**, `\|Δtilt\|` ≤ **2°** | **1,5** |
| **C4** | **Le double-clic zoome d'un cran franc vers le point désigné** (W2, verbatim) | gauche : **1,8 ≤ ×d ≤ 2,2** et le point désigné dérive ≤ **25 px** · droit : **0,45 ≤ ×d ≤ 0,56**, même contrainte · `\|Δtilt\|` ≤ 0,5° · roulis ≤ **2,0°**. 0,75 pt chacun. ⚠️ « point désigné » = **curseur** ou **centre** selon l'arbitrage ① — **rien d'autre ne change** | **1,5** |
| **C5** | **Le clic simple ne fait plus rien** (W2, par exclusion : le zoom est le DOUBLE-clic) | `\|ln ×d\|` ≤ **0,02** et rotation du sol ≤ **0,05°** dans les **3 s** qui suivent. Aujourd'hui : ×2,000 et 3,90° | **1,0** |
| **C6** | **Le bouton du milieu incline/tourne, et `Maj + gauche` est son repli** (P1, onglet Mac ; un pavé tactile n'a pas de bouton du milieu) | milieu vertical : `\|Δtilt\|` ≥ **25°** · milieu horizontal : `\|Δazimut\|` ≥ **20°** avec `\|Δtilt\|` ≤ 2° · `Maj + gauche` rend le même Δazimut à **±10 %** | **1,0** |
| **C7** | **Aucun menu de navigateur sur le globe** | `contextmenu` avec `defaultPrevented === true` **8 fois sur 8**, drapeau `fenetreContinue` **éteint** (le défaut) comme allumé ; et le glissé droit qui suit démarre bien | **0,5** |
| **C8** | **L'élan reste borné** — aucune source ne l'exige, aucune ne l'interdit | après le relâché : rotation ajoutée ≤ **15 %** de celle du geste · éteinte (< 2 % du premier pas) en ≤ **1 800 ms** · un cran de molette ou un nouvel appui l'éteint en ≤ **2 images**. Aujourd'hui : **20 % / 1 383 ms → rouge sur le premier seuil, vert sur le second** | **1,0** |

**Total 10,0.** Adrien exige **7,5**. Avec ce barème, 7,5 n'est atteignable
qu'en passant C0 **entièrement** puis en emportant au moins **C1 + C3 + C4 + C5 +
C6** (7,0) plus l'un de C2/C7/C8. Autrement dit : **le clic droit doit zoomer,
Ctrl doit incliner, le double-clic doit marcher dans les deux sens, le clic
simple doit se taire et le milieu doit servir.** C'est exactement la liste des
gestes qu'Adrien a nommés. La note est méritée ou elle n'est pas.

⛔ **Ce que le noteur ne doit PAS compter comme un défaut** : au bloc croppé, le
glissé gauche tourne l'azimut au lieu d'attraper la Terre (mesuré : 38,3° pour
100 px, 0,007° de sol). **C'est l'exception du crop, écrite dans D19.**

⛔ **Et ce qu'il doit refuser** : une note obtenue en écrivant `controls.target`
d'un coup. Le socle chiffre la faute — **66 × le seuil de `veille-repos`**. Le
motif autorisé reste la translation rigide.

---

## ④ LES TESTS ROUGES

**`test/attaque-ge-ROUGE.mjs`** — **hors** de la liste de `package.json` (vérifié :
`audit:tests` rend toujours **253 = 253** avec le fichier présent), commande en
tête du fichier :

```
1) npm run dev -- --host 127.0.0.1 --port 6771
2) node --test --test-concurrency=1 test/attaque-ge-ROUGE.mjs
   · GE_PORT=6771        change le port
   · GE_MESURES=chemin   réutilise un relevé (le banc met ~9 min)
   · GE_VISEE=centre     bascule C4 et D19 §2 du curseur vers le centre
```

**État au 2026-09-03, avec `GE_MESURES=.banc/GE1/mesures-2000km.json` :
13 rouges, 5 verts.** Les cinq verts sont le **témoin**, **D19 §1** (pivot et
prise), **D19 §2** (molette au centre) et **D16 ter restreint** — c'est-à-dire
exactement les acquis que le critère éliminatoire C0 protège. Les treize rouges
sont C1 (×2), C2, C3, C4 (×2), C5, C6 (×3), C7, C8, et la réserve D16 ter.

⚠️ **`GE_VISEE` a pour défaut `centre`** : D19 est la règle en vigueur tant
qu'Adrien n'a pas arbitré. `GE_VISEE=curseur` bascule C4 **et** D19 §2 vers la
lettre de la page Google — et rend alors D19 §2 rouge (49,29 px). C'est
littéralement la contradiction ①, exécutable.

Un test par geste non conforme, tous en pixels, degrés ou rapports de distance :
**C1** (deux tests : le zoom, puis la symétrie haut/bas), **C2**, **C3**, **C4**
(deux), **C5**, **C6** (trois : milieu V, milieu H, repli Maj), **C7**, **C8**,
plus le bloc de non-régression D19 §1 / D19 §2 / D16 ter restreint, la réserve
D16 ter, et le **témoin sans geste**. Le témoin passe en premier : sans lui, aucune rotation mesurée ne prouve
quoi que ce soit.

---

## CE QUE J'AI CRU, PUIS RÉFUTÉ

1. **« Le globe tourne seul à ~2 °/s après 3 s, gèle-le ou soustrais-le »**
   (socle-ge.md). **Réfuté, deux fois** : témoin de 90 images → **0,000°** ;
   témoin de 5 s (301 images) → **0,000°**, à 2,44 Mm comme à 4,4 km. Le globe ne
   tourne **pas** seul dans cet état. J'avais préparé une soustraction de dérive :
   elle aurait *ajouté* une erreur. **Le témoin reste dans le banc** — si un jour
   il n'est plus nul, tout le tableau ② est à relire.
2. **« Le clic droit d'Earth Web incline, c'est Pro qui zoome »** — l'hypothèse
   que le brief propose lui-même. **Faux** : W1, la page Web, range le clic droit
   glissé sous *« Zoom in and out »*, à côté des boutons +/−. C'est **Ctrl +
   glissé** qui explore/incline sur le Web. J'ai failli écrire l'inverse.
3. **« Le bouton du milieu ne fait rien »** — affirmé en toutes lettres dans
   l'en-tête de `src/boutons-camera.js`, et le brief demandait de le vérifier.
   **Faux.** Le raisonnement du commentaire (« `enableZoom = false` neutralise
   `MOUSE.DOLLY` ») est juste, mais le fichier ne pose **pas** DOLLY sur le
   milieu : `versTroisJs` y pose **`MOUSE.PAN`**, et `enablePan` vaut `true`.
   Mesuré : pan franc, `centre0` **154,5 px**. **Le milieu n'est pas une place
   vide, c'est une place occupée.**
4. **« La pose de démarrage, c'est ce qu'on voit une fois `#loading` caché »**.
   **Faux, et ça m'a coûté un lot entier.** Un vol de présentation court encore
   3,1 s après (d : 26,7 → 68,5 → 132,3 → **145,5**) et **Échap le fige où il
   en est** : mon premier lot mesurait depuis **9,8 km** au lieu de 36,7 km.
   La condition juste est `d` **stable ET `d > 100`**.
5. **« Il suffit d'enchaîner les gestes dans la même page »**. **Faux** : le
   premier lot a fini à **−385 m d'altitude**, sous la mer, chaque geste partant
   d'où le précédent l'avait laissé. **Un geste = un chargement de page.**
6. **« La pose de démarrage est un bon point de mesure »**. **Faux, et c'est un
   piège à ajouter au socle** : elle est à **30,7–33,6 km selon le chargement**,
   et `SEUIL_NAISSANCE_M` vaut **32 274,3 m**. Deux gestes voisins ne tombaient
   pas dans le même régime. D'où l'étage d'altitude explicite à **2,44 Mm**.
7. **« D19 §1 est acquise, R32 l'a mesurée à 0,2 px »**. **Vrai cinq fois sur
   huit.** Voir la réserve du §②. Je n'ai pas cru trouver ça, et je n'ai pas
   cherché la cause.
8. **« Google publie où vise sa molette »**. **Non.** J'ai lu les quatre pages :
   aucune ne le dit. La seule cible de zoom que Google écrit est celle du
   double-clic, et c'est **« cursor location »**. C'est de là que vient la
   contradiction ① — et c'est pourquoi elle ne se règle pas par une citation.

---

## CE QUI RESTE OUVERT, ET QUI N'EST PAS DE MON RESSORT

- **L'arbitrage ① — curseur ou centre.** Tout le barème est écrit pour basculer
  d'un mot ; il attend Adrien.
- **Le facteur du double-clic** : ×2 / ÷2 est **mon choix**, pas une citation.
- **Le clic droit horizontal** (C2) : aucune source Web. Le barème accepte les
  deux réponses défendables et refuse la troisième (le pan actuel).
- **Le ×2,046 entre deux images au dézoom molette** : un saut réel, sans rapport
  avec le vocabulaire des gestes. Il mérite sa propre tâche.
- **La bimodalité 0 px / 752 px du glissé gauche** : constatée, chiffrée, non
  diagnostiquée.
