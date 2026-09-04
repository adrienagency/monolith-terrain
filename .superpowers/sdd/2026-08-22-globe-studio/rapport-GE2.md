# GE2 — LE VOCABULAIRE SOURIS DE GOOGLE EARTH : LA RÉFÉRENCE D'ABORD, PUIS LA MESURE

Arbre `C:\Dev\wt-ge2`, branche `gestes-ge-impl`. Serveur `npm run dev -- --port
6841 --strictPort --host 127.0.0.1` (arrêté à la fin). Instrument :
`scripts/sonde-ge2.mjs` — **neuf**, Chrome sans tête 1280 × 800, gestes envoyés à
la souris (CDP `Input.dispatchMouseEvent`), relevé **au rendu**
(`composer.render` enveloppé) sur **la caméra qui rend** (`camGlobe` sous la
frontière, `camera` en orbite) : inclinaison et cap en **degrés**, dérive du
point du centre et du point saisi en **pixels**, altitude en **mètres**,
`|Δ ln(distance caméra→cible)|` par image. Journaux `.banc/GE2/` :
`avant-orbite.json`, `avant-surface.json`, `apres-surface.json`,
`apres-bas.json`, `apres-crop.json`, `d16ter.json`, `clic-apres.json`.
`npm test` **4 774 · 0 échec** (base 4 755) · `npm run audit:tests`
**254 = 254**.

---

## ⓪ ⛔ LA CONTRADICTION AVEC D19 — SIGNALÉE, NON TRANCHÉE

**D19 ②** : *« quand je scrolle pour zoomer ou dézoomer, je scrolle vers le point
visé AU CENTRE DE L'ÉCRAN »*.
**Google Earth Web**, table officielle des raccourcis, mot pour mot :
*« Zoom toward cursor location — Double click (left) »* — donc **vers le
CURSEUR**.

⚠️ **Ce que la documentation dit exactement, et il faut le lire avant de
trancher :**

| geste | contradiction ? |
|---|---|
| **la MOLETTE** | ⚠️ **AUCUNE contradiction DOCUMENTÉE.** La table officielle des raccourcis de Google Earth Web **n'a pas de ligne molette du tout** ; le guide Pro ne décrit que le SENS (*« scrolling towards you »*) et la vitesse. « Google Earth zoome vers le curseur à la molette » est un comportement **observé**, jamais documenté. Le brief redoutait cette contradiction : **elle n'existe pas sur le papier.** |
| **le DOUBLE-CLIC** | ✅ **contradiction réelle, documentée des deux côtés** (Web *« toward cursor location »*, Pro *« zoom in to that point »*). |

➡️ **Je n'arbitre pas.** `PIVOT_VERS_LE_CURSEUR` vaut **`false`** (D19 : le centre
de l'écran), il est **seul sur sa ligne** dans `src/monde/gestes-terre.js`, et le
test `GE2 ⑮` le fige pour qu'un retournement oblige à lire le commentaire.
**Un caractère suffit à basculer.**

---

## ① LA RÉFÉRENCE, DOCUMENTÉE AVANT D'ÊTRE CODÉE — Web prioritaire, écart Pro noté

⛔ **Là où les deux documentations sont MUETTES, je n'invente pas : le geste
reste inerte.** Un geste inventé serait indiscernable d'un défaut pour qui
compare avec Google Earth.

| geste | Google Earth **Web** | Google Earth **Pro** | ici, après GE2 | pivot |
|---|---|---|---|---|
| **glissé gauche** | déplacer (documenté) | déplacer (documenté) | **saisie** — R32, intact | centre de la Terre |
| **molette** | zoom ; ⚠️ **pivot non documenté** | zoom ; ⚠️ **pivot non documenté** | **zoom**, intact | **centre de l'écran** (D19) |
| **double-clic gauche** | *« Zoom toward cursor location »* | *« zoom in to that point »* | déjà servi par le **clic simple de R35** — non réécrit | centre de l'écran (D19) |
| **double-clic droit** | *« Zoom away from cursor location »* | dézoome | **NEUF** : 2 crans de dézoom | centre de l'écran (D19) |
| **clic droit glissé VERTICAL** | zoom (*« right drag the mouse »*, axe non précisé) | zoom **+ inclinaison automatique** | **NEUF** : zoom. ⛔ **l'inclinaison automatique est écartée par D16 ter** | centre de l'écran |
| **clic droit glissé HORIZONTAL** | ⚠️ **non documenté** | ⚠️ **non documenté** | **INERTE** — mesuré à 0 px / 0° | — |
| **clic droit sans glissé (menu)** | ⚠️ non documenté sur le globe | documenté sur les **objets** seulement | **aucun menu**, `preventDefault` explicite | — |
| **bouton du milieu glissé** | ⚠️ **jamais mentionné** | *« tilt the view »* (vert.) / *« rotate the view »* (horiz.) | **NEUF** : inclinaison + cap MANUELS | `controls.target` |
| **Ctrl + glissé** | *« Explore around your location »* | regarder autour ; **Mac : zoom** (⚠️ trois sens documentés pour le même accord) | **NEUF** : comme le milieu | `controls.target` |
| **Maj + glissé** | ⚠️ **non documenté** | inclinaison (documenté) | **NEUF** : comme le milieu | `controls.target` |
| **Alt + glissé** | ⚠️ non documenté | ⚠️ **non documenté** (Alt ne sert qu'avec la molette) | **saisie** — Alt n'est pas un modificateur | centre de la Terre |
| **inertie au relâché** | ⚠️ non documentée (mais *« Stop globe… Space bar »* l'implique) | documentée : *« as if you are “throwing” the scene »*, *« Click once… to stop motion »* | **élan** (R32) **+ le clic qui l'éteint** (NEUF) | — |

**URL — Web** (prioritaire ; `support.google.com/earth/answer/7364447` et
`/7365025` redirigent en 301 vers ces pages) :
`https://developers.google.com/maps/documentation/earth/navigate-the-globe` ·
`https://developers.google.com/maps/documentation/earth/use-keyboard-shortcuts`
(les deux lignes du double-clic) ·
`https://developers.google.com/maps/documentation/earth/discover-places-change-view`

**URL — Pro/Bureau** :
`https://support.google.com/earth/answer/148186` ·
`https://support.google.com/earth/answer/148115` (clic droit = *zoom plus
automatic tilt* ; Maj et Ctrl) ·
`https://static.googleusercontent.com/media/earth.google.com/en//userguide/v4/google_earth_user_guide.pdf`
(§ *« Using a Mouse »* — **la seule source officielle** du bouton du milieu et de
l'inertie ; guide Google Earth 4.x, toujours publié sur les serveurs de Google).

### Les écarts Web / Pro, nommés au lieu d'être choisis en silence

1. **Le clic droit n'a pas le même sens.** Web : geste de zoom **primaire**, sans
   axe ni inclinaison. Pro : zoom **+ inclinaison automatique**, et **inversé**
   (*« pull toward you »* = zoomer AVANT). ➡️ j'ai pris le **zoom de Web** avec le
   **sens de Pro** (le seul documenté), et **refusé l'inclinaison automatique de
   Pro** — voir §③.
2. **Ctrl + glissé a trois sens documentés** : Web « explorer autour », Pro
   Win/Linux « regarder autour », Pro **Mac** « zoom + inclinaison automatique ».
   ➡️ j'ai pris l'inclinaison, la seule qui ne double aucun autre bouton.
3. **Le bouton du milieu n'existe que dans les docs Pro** — Web ne le mentionne
   jamais.
4. **Maj + glissé n'existe que dans Pro.**
5. **L'inertie est explicite chez Pro, absente chez Web** — mais Web documente
   une barre d'espace qui « arrête le globe », ce qui implique un mouvement qui
   continue.

---

## ② ⚡ L'INCLINAISON — MANUELLE PARTOUT, AUTOMATIQUE AU BLOC

D16 ter dit que la vue de trois quarts n'arrive **qu'au bloc**. Google Earth Pro
incline au clic droit **partout**. Les deux se décroisent sur **un mot**, et la
distinction est écrite dans le code (`gestes-terre.js` §3, `main.js`
« L'INCLINAISON MANUELLE ») :

- **AUTOMATIQUE** = la machine incline sans qu'on le lui demande (`PENTE_ARRIVEE`,
  l'*« automatic tilt »* du clic droit de Pro). ⛔ **Réservée au bloc.** C'est
  pourquoi **`GESTE.ZOOM` ne porte aucune inclinaison**, alors que Google Earth
  en met une sur exactement le même geste.
- **MANUELLE** = un geste explicite qui ne demande que ça (milieu, Ctrl, Maj).
  ✅ **Permise dans tout le régime de la Terre.**

**Mesuré — `.banc/GE2/d16ter.json`**, vol de contrôle vers La Réunion z12 depuis
l'orbite, relevé image par image avec l'état du crop :

| | |
|---|---|
| images **avant** que le crop soit posé | **1 194** |
| inclinaison max sur ces 1 194 images | **0,000°** |
| première image à plus de 1° d'inclinaison | image 6 066, **10,0 km**, `cropPose: true` |
| inclinaison à l'arrivée | **46,477°** (`PENTE_ARRIVEE`, inchangée) |

➡️ **La bascule automatique arrive toujours au bloc, et nulle part avant.**

---

## ③ CHAQUE GESTE, AVANT / APRÈS — en degrés et en pixels

Glissé de **200 px** par pas de 20 px, en **surface hors du crop** (~6 000 km),
globe figé (voir §⑤), vue remise à plat entre deux gestes.
`.banc/GE2/avant-surface.json` → `.banc/GE2/apres-surface.json`.

| geste | AVANT | APRÈS |
|---|---|---|
| **clic droit glissé V** | déplacement d'OrbitControls : −8,09° de latitude, centre à **186 px**, **`\|Δ ln d\| = 5,27e-2` (527 × le seuil)** | **ZOOM** : altitude ×1,198, centre à **0 px**, `\|Δ ln d\|` = 2,41e-3 (le zoom lui-même) |
| **clic droit glissé H** | déplacement : −9,98° de longitude, centre à **182 px** | **INERTE** : 0° / 0° / **0 px** / `\|Δ ln d\| = 0` |
| **bouton du milieu V** | déplacement : −7,48°, centre à **172 px**, **aucune inclinaison (0°)** | **INCLINAISON : +20,31°**, `\|Δ ln d\| = 0` |
| **bouton du milieu H** | déplacement : −9,98° de longitude | **CAP : −50,000°** exactement (200 px × 0,25 °/px), `\|Δ ln d\| = 0` |
| **Ctrl + glissé V** | déplacement, **`\|Δ ln d\| = 1,88e-1` (1 880 ×)** | **+20,31°** d'inclinaison, `\|Δ ln d\| = 0` |
| **Ctrl + glissé H** | déplacement, centre à **758 px** | **−50,000°** de cap, `\|Δ ln d\| = 0` |
| **Maj + glissé H** | déplacement, **`\|Δ ln d\| = 1,15e-1` (1 150 ×)** | **−50,000°** de cap, `\|Δ ln d\| = 0` |
| **Alt + glissé H** | saisie **ET** déplacement à la fois : centre à **322 px** (contre 200 px pour un glissé nu), −22,94° de longitude (contre −8,58°) | **saisie seule** : point saisi à **0,06 px** du curseur |
| **double-clic droit** | rien | **dézoom de 2 crans** |
| **menu contextuel** | empêché — mais par le gestionnaire interne d'OrbitControls | empêché **explicitement**, 0 px / 0° |
| **inertie au relâché** | présente (R32) | présente, **vitesse armée 4,35 °/s** en surface, **54,14 °/s** en orbite, course **1,46°** puis **3,13°** d'arc en 1,5 s, décroissance en exp(−t/τ) |

**Le bouton du milieu, Ctrl et Maj rendent des nombres IDENTIQUES au centième**
(20,31° et −50,000°) : c'est la preuve qu'ils passent par le même code, pas par
trois chemins qui se ressemblent.

**En orbite** (`.banc/GE2/avant-orbite.json`, et la passe `apres` à 24 109 km) :
milieu, Ctrl, Maj sont **inertes** — 0 px, 0°, `|Δ ln d| = 0`. C'est voulu et
c'est géométrique : `controls.target` y est le centre de la Terre, donc tourner
autour de lui n'incline rien — c'est très exactement le glissé gauche de D19.
Google Earth Web ne documente d'ailleurs jamais le bouton du milieu.

**Amplitude de l'inclinaison manuelle** : 200 px demandent 50°, la butée du sol
(`polaireMaxSol`, R23) en rend **20,31° à 8 987 km** et **27,67° à 5 135 km** —
elle s'ouvre à mesure qu'on descend. **Le pas est plafonné, jamais tronqué** : le
reste se fait au glissé suivant.

---

## ④ LA PREUVE DE NON-RÉGRESSION

| exigence | seuil | mesuré après GE2 |
|---|---|---|
| **D19 glissé** — point saisi sous le curseur | ≤ 0,2 px | **0,00 px** (H et V), `.banc/GE2/apres-surface.json` |
| **D19 glissé** — centre de la Terre | 0 px | **0 px** (déplacement du centre = 200 px, la course du geste) |
| **D19 molette** — point du centre | ≤ 1,4 px | **0,00 px** sur 3 crans |
| **clic sur le globe** — rapport image à image | ≤ 1,023 | **1,0171** sur 8 clics, `scripts/sonde-r35.mjs`, `.banc/GE2/clic-apres.json` |
| **`veille-repos`** — `\|Δ ln d\|` par image sur un geste de pose | < 1e-4 | **0** (glissé, inclinaison, cap) ; **4,44e-16** sur le crop |
| **D16 ter** — bascule automatique | au bloc seulement | **0,000° sur 1 194 images avant le crop** ; première > 1° avec `cropPose: true` ; arrivée à **46,477°** |
| **le crop garde son pivot propre** (R13) | inchangé | glissé gauche = **−90,027° de cap**, clic droit / milieu / Ctrl = déplacement (150 à 197 px), `\|Δ ln d\| = 4,44e-16` — `.banc/GE2/apres-crop.json` |
| `npm test` | ≥ 4 755 · 0 | **4 774 · 0 échec** |
| `npm run audit:tests` | sans écart | **254 = 254** |

⚠️ **Le `|Δ ln d|` élevé (0,65) que la sonde du clic relève en surface n'est PAS
un geste de pose** : c'est un franchissement de palier — un changement d'échelle
réel, que `veille-repos` DOIT voir. Le seuil 1e-4 vaut pour un panoramique, une
orbite ou une inclinaison, qui ne changent aucune échelle ; c'est le critère de
R35 (rapport ≤ 1,023) qui gouverne une descente, et il tient.

---

## ⑤ CE QUE J'AI CRU PUIS RÉFUTÉ — cinq fois, et deux ont changé le code

1. ⛔ **« `controls.enableRotate = false` suffit à neutraliser le bouton
   gauche. »** **FAUX, et ça a coûté le pire chiffre de la campagne.** Lu dans la
   source vendue (`OrbitControls.js`, `case MOUSE.ROTATE`) : un ctrl / meta /
   shift tenu bascule en **PAN**, et **ce PAN-là est gardé par `enablePan`, pas
   par `enableRotate`**. Maj + glissé faisait donc l'inclinaison manuelle **et**
   le déplacement d'OrbitControls en même temps : `|Δ ln d| = 1,88` — **18 800
   fois le seuil** —, altitude 4 651 → 418 km, centre de la vue à **49 142 px**
   (`apres-surface.json`, première passe). ➡️ `LEFT: -1` dans le régime de la
   Terre. Ironie : l'en-tête de `boutons-camera.js` **célébrait** ce repli
   (« Maj + clic gauche déplace NATIVEMENT ») — c'était vrai, et c'est
   exactement ce qu'il fallait couper ici.

2. ⛔ **« `terre: !!regimeGeste()` dit ce que je veux. »** **FAUX, et c'est le
   banc qui l'a attrapé, pas la relecture.** `regimeGeste()` rend **trois**
   valeurs non vides — orbite, surface, **et crop** —, donc `!!` valait `true`
   sur le crop et lui retirait ses trois boutons. Mesuré
   (`apres-crop.json`, première passe, vol vers z12, 10 km) : **glissé gauche,
   clic droit, milieu et Ctrl rendaient TOUS 0 px et 0°** — la vue devenue
   inerte sur le bloc, c'est-à-dire **l'exception d'Adrien (R13) purement
   supprimée**. ➡️ le prédicat `regimeTerreActif()` est parti vivre dans le
   module pur, où le test `GE2 ⑯` le tient.

3. ⛔ **« Google Earth zoome vers le curseur à la molette, donc D19 le
   contredit. »** **NON DOCUMENTÉ, ni dans un sens ni dans l'autre.** La table
   officielle des raccourcis de Google Earth Web **n'a aucune ligne molette**, et
   le guide Pro ne décrit que le sens et la vitesse. C'est la contradiction que
   le brief m'annonçait, et **elle n'existe pas sur le papier** — celle qui
   existe est sur le **double-clic**. Je l'ai déplacée au bon endroit au lieu de
   l'implémenter là où on me l'annonçait.

4. ⛔ **« J'ai cassé l'inertie. »** La sonde rendait `0,0000°` de course après le
   relâché, trois passes de suite, alors que la mesure d'avant donnait 2,77°.
   **C'était le banc.** L'élan dure τ = 0,35 s et la cadence d'un Chrome sans
   tête sous SwiftShader est irrégulière : `relacherSaisie` exige un pas de moins
   de 100 ms avant le relâché, et un banc lent le manque. ➡️ la sonde lit
   maintenant **`saisieTerre.elan` à la source** — la vitesse ARMÉE, qu'un banc
   ne peut pas manquer : **4,35 °/s** en surface, **54,14 °/s** en orbite.

5. ⛔ **« Enchaîner les quatorze gestes sur la même caméra mesure quatorze
   gestes. »** **Non : ça mesure leur SOMME.** L'inclinaison héritée du bouton du
   milieu faussait tout ce qui suivait — `double-clic` rendait −11,6°
   d'inclinaison qu'il n'avait pas produits, et la saisie sous 55° d'inclinaison
   héritée finissait à **3 225 px** du curseur. ➡️ remise à plat entre deux
   gestes (par le même motif que le code mesuré : rotation à rayon constant),
   **sauf sur le crop**, où elle écrasait les 46,477° d'arrivée et faisait
   mesurer au banc une vue que l'application ne montre jamais.

⚠️ **Et le 3 225 px n'était pas qu'un artefact de banc : il désignait un vrai
défaut.** `deplacementDeSaisie` itère sur `poseNadir`, un modèle de caméra **au
nadir** — et l'inclinaison manuelle que GE2 vient d'autoriser le rend faux. ➡️
au-delà d'un degré d'inclinaison, la saisie **n'itère plus** : elle part de la
pose RÉELLE (celle qui a dessiné l'image qu'on regarde) et laisse le résidu se
résorber à l'image suivante — l'argument du premier ordre que `saisie-terre.js`
écrit déjà. Mesuré après : **0,06 px**.

---

## ⑥ RÉSERVES OUVERTES — dites, pas cachées

1. **La sonde ne sait pas lire l'inclinaison sur le crop autrement que par
   `camGlobe`.** Elle y rend le bon chiffre (46,477° à l'arrivée), mais la
   non-régression du crop est prouvée par trois voies convergentes plutôt que par
   une mesure d'inclinaison : le test exhaustif d'égalité de la table des boutons
   (`GE2 — hors du régime de la Terre, RIEN ne change`), les 46,477° d'arrivée
   intacts, et les gestes remesurés sur le bloc (§④).
2. **L'inclinaison manuelle en haute altitude fait une grande course.** À
   8 987 km, 20,3° d'inclinaison déplacent le point sous la caméra de 29,7° —
   c'est géométriquement inévitable quand on tourne autour d'une cible posée au
   sol à 9 000 km sous soi. Google Earth verrouille l'inclinaison en vue globale ;
   ici c'est l'orbite qui la rend inerte, mais **la bande 32 km – 8 000 km garde
   cette course**. À chiffrer contre l'œil d'Adrien.
3. **`PIVOT_VERS_LE_CURSEUR` attend son arbitrage** (§⓪).
4. **La vitesse d'inclinaison (0,25 °/px) et le pas du zoom au clic droit
   (40 px/cran) sont les deux seuls nombres de ce rapport qui ne sont ni une
   mesure ni une ligne de documentation** — Google ne publie aucune sensibilité.
   Ils sont isolés, nommés et commentés comme tels dans `gestes-terre.js`.


---
---

# GE2 — TOUR 2 (2026-09-04) : LES 1,5 POINT DU NOTEUR, ET CE QU'ILS ONT RÉVÉLÉ

Repris après la note GE3 (**6 / 10**) et les arbitrages du coordinateur (C5, C4,
C6, C1, C8). `git merge regroupement` fait (R37, B5, BT-I, GE3). Instruments :
**`scripts/sonde-ge3.mjs` du noteur, tel quel** (mêmes champs, pour que
`test/attaque-ge-ROUGE.mjs` se relise sans une ligne changée) + un diagnostic de
pose par chargement (`phi`, azimut, `camera.up`, cible, `retoursNadir`) et
l'élan par passe en `--repete` ; `scripts/ge2-series8.mjs` lit les huit valeurs.
⚠️ **Tout ce qui est chiffré ci-dessous l'est sur HUIT CHARGEMENTS** — la leçon
de la campagne, et le reproche du noteur à mon premier tour (« une passe »).
Relevés : `.banc/GE2/c6-avant.json`, `series8-apres.json`, `s8*-*.json`,
`s8-diag-herite.json`, `rouge-apres.json`, `rouge-apres2.json`. `npm test`
**4 799 · 0** (base 4 797), `audit:tests` **257 = 257**.

## ① Les cinq correctifs, mesurés avant / après — huit chargements chacun

| critère | avant (GE3) | après, 8 chargements | ce qui a changé |
|---|---|---|---|
| **C5** clic simple | ×2,00 et 3,83–3,91° (la plongée R35) | **×1,0000 · 0,000° · 0 px — 8/8** | le clic simple ÉTEINT (élan, glissé de zoom, épingle) ; la plongée R35 est devenue le double-clic du crop |
| **C4** double-clic gauche | ×2,00 mais **470 px** du centre, **236 px** du curseur | **×2,000 · point cliqué à 0,0 px du curseur — 8/8** · inclinaison 0 · Terre 1,85–1,96° | ×2 exact par l'intégrateur, point cliqué ÉPINGLÉ par la saisie de R32 (`PIVOT_VERS_LE_CURSEUR = true`) |
| **C4** double-clic droit | ×0,983 (2 crans) | **÷2,008 en altitude · point cliqué à 0,0 px — 8/8** | symétrique ; ⚠️ le test rouge lit `rapportDistance` en unités de BLOC (0,99 : un palier franchi), pas l'altitude — voir §③ |
| **C6** cap (milieu H, Maj H) | **−50° ou −69,35° + 17,36° de roulis** (2/4) | **−50,000° — 8/8** milieu, et 8/8 sur le diagnostic | le second mode trouvé et corrigé — §② |
| **C1** clic droit V | ×1,894 avant / ×2,128 arrière (13 %) — puis, à mon premier correctif, ×1,000 vers le bas 8/8 | **haut ×2,009 (écart 0,02 %) · bas ×2,013 — 8/8 · symétrie \|ln\| = 0,002** (seuil 0,05) | trois causes, trois mesures — §④ |
| **C8** élan | 20 % du geste, et 3/8 à ~150 °/s (10° au relâché) | **10,1–10,2 % — 8/8 · mort en 1 371–1 392 ms · saisi 0 px 8/8** | plafonné par l'ARC du geste (`plafonnerElan`, 12 %) |

Tout le reste tenu : molette au centre **0,00 px** (D19 §2), clic droit horizontal
**inerte** (0° / ×1,0000), crop intact, `|Δ ln d| = 0` sur saisie, cap, inclinaison.

## ② C6 — le second mode était dans la POSE, pas dans le geste (et c'est une violation de D16 ter)

`.banc/GE2/c6-avant.json`, huit chargements, `milieu-glisse-H`, avec l'angle
polaire lu AVANT le geste :

| chargement | angle polaire avant | cap rendu |
|---|---|---|
| 1 | **54,28°** | **−69,356°** |
| 2 à 8 | 0,00° | **−50,000°** (×7) |

Le second mode est un chargement où **la caméra est déjà inclinée de 54° à
2,4 Mm hors du crop**. Pourquoi seulement parfois : la pose de démarrage tombe
à **30,7–33,6 km selon le chargement** (le piège ② du noteur) et
`SEUIL_NAISSANCE_M = 32 274 m`. **Au-dessous**, le crop naît, puis meurt au
dézoom, et `_armerRetourNadir` — armé **sur sa mort seulement** — redresse la
vue. **Au-dessus** (33,05 km sur ce chargement), le crop ne naît jamais, donc ne
meurt jamais, donc **l'inclinaison oblique du vol de présentation reste posée
hors du crop jusqu'à 2 400 km**. Un cap tourné sur un cône de 54° n'est pas un
cap tourné au nadir : −69° contre −50°, avec le « roulis du sol » de 17°.

⛔ **C'est une violation de D16 ter antérieure à GE2** (« la vue de trois quarts
arrive au bloc, pas avant »), masquée une fois sur deux par le crop de démarrage.
Correctif : `redresserSiHerite()` (`main.js`) arme le redressement automatique
**hors du crop, quand la vue est inclinée et que personne ne l'a inclinée à la
main** (`gestesTerre.inclinaisonManuelle`) — la distinction manuelle /
automatique de `gestes-terre.js` §3, appliquée dans l'autre sens. Mesuré
(`s8-diag-herite.json`, 8 chargements) : **angle polaire 0,00° sur 8/8, avec
`retoursNadir = 2` sur chacun** — le redressement s'est armé à chaque
chargement, et la vue est à plat quand le geste arrive.

## ③ Le banc rouge du noteur, rejoué sans y toucher (`rouge-apres.json`, `GE_VISEE=curseur` et `centre`)

**14 verts / 4 rouges** dans les deux visées, sur 18. Verts : témoin, C2, C3,
**C4 gauche** (curseur), **C5**, C6 ×3, C7, **C8**, D19 §1 ×2, D16 ter ×2.

Les quatre rouges, et ce qu'ils mesurent vraiment :
- **C1 haut / bas** : le test attend *haut = zoom avant* — **l'inverse du sens
  documenté** (Pro : *« pull toward you »* = avant), que le noteur a dit lire
  dans le sens Pro ; et il lit `rapportDistance` **en unités de bloc** (0,997
  vers le haut : un palier franchi, `|Δ ln d| = 0,72`) là où **l'altitude fait
  ×2,009**. En altitude et dans le sens Pro : haut ×2,009, bas ×2,013,
  symétrie 0,2 %.
- **C4 droit** : ÷2,008 en altitude, 0,0 px du curseur, mais `rapportDistance`
  de bloc = 0,99 (palier franchi). Même instrument.
- **D19 §2 sous `GE_VISEE=curseur`** : la molette vise le centre (0,00 px) — le
  test applique la même visée aux deux gestes, alors que l'arbitrage les
  sépare (molette = centre, double-clic = curseur). Sous `centre`, vert.
➡️ **Je n'ai pas touché `test/attaque-ge-ROUGE.mjs`** (anti-triche) : ces trois
lectures sont à corriger dans le barème, pas dans le code.

## ④ Ce que j'ai cru puis réfuté — tour 2, cinq fois, huit chargements à chaque fois

1. ⛔ **« Le clic simple de R35 fait déjà le double-clic de Google. »** Faux — le
   noteur l'a montré (470 / 236 px) : la plongée recentre, elle ne vise ni le
   centre ni le curseur. Réécrit.
2. ⛔ **« Passer les crans du clic droit par la porte de la molette dose le
   zoom. »** Trois fois faux, et chaque fois une mesure : (a) **`Math.round(−0,5)
   = −0`** en JavaScript — 5 px par image font un demi-cran, le glissé vers le bas
   le perdait à chaque image : **×1,0000 sur 8/8** pendant que le haut comptait
   un cran entier par image (×2,3) ; (b) les crans reçus pendant `busy` sont
   **jetés** par `_zoomGesture` : ×1,42 à ×1,60 selon le chargement ; (c) même
   sans rechargement, 20 impulsions étalées sur 40 images ne rendaient que
   **×1,366 (8/8)** — la course amortie se fait couper en route. ➡️ le glissé
   intègre EXACTEMENT son log de distance par `_applyZoom`, sans course
   (Google Pro : *« releasing the button when you reach the desired
   elevation »*) : **×2,009 / ×2,013, écart 0,02 %**.
3. ⛔ **« Le double-clic, lui, peut garder la course de la molette (×1,96 8/8). »**
   Vrai vers l'avant, faux vers l'arrière : **÷1,75** quand le dézoom franchit
   un palier (`_coarsen` coupe la course). Même chemin exact que le glissé,
   ±ln 2 sur 15 images : **÷2,008 8/8**.
4. ⛔ **« Le cap bimodal vient de `lookAt` dégénéré au nadir. »** Théorie
   séduisante, fausse : le diagnostic par chargement a montré `phi = 54,28°`
   AVANT le geste sur le chargement fautif. La cause était trois couches plus
   haut, dans le vol de présentation et le seuil de naissance du crop (§②).
5. ⛔ **« Un banc sans tête, c'est reproductible. »** Trois runs perdus à des
   `detached Frame` / `Target closed`, un fichier de résultats **écrasé par un
   second run lancé par un relanceur oublié** (les « 59,33° » d'une passe lus
   puis disparus), et deux fois ma propre coquille tuée par un `Stop-Process`
   dont le motif regex apparaissait dans ma propre ligne de commande. Chaque
   geste est maintenant une invocation séparée, sous `timeout`, et les motifs
   de nettoyage sont construits pour ne pas se matcher eux-mêmes.

## ⑤ Réserves ouvertes

1. Les trois lectures du barème (§③) — sens de C1, unité de C1/C4 (bloc contre
   altitude), visée unique de D19 §2 / C4 — à trancher côté noteur.
2. `retoursNadir = 2` par chargement : le redressement s'arme deux fois (le
   second après un rechargement de palier qui repose la caméra obliquement hors
   du crop ?). La vue finit à plat 8/8 ; la seconde cause n'est pas nommée.
3. L'épingle du double-clic fait tourner la Terre de 1,85–1,96° (le point
   cliqué reste sous le curseur, le reste glisse) — sous les 2° du barème, mais
   de peu.

## ⑥ La note que j'estime honnêtement

Sur le barème GE3 tel qu'écrit, rejoué sans y toucher : **C0 9/9 vert** ;
C1 **1,25 → 1,5** si lu en altitude et dans le sens Pro (symétrie 0,2 %), sinon
0 ; C2 1,5 ; C3 1,5 ; C4 **1,5** en altitude (0 sur l'instrument de bloc) ;
C5 **1,0** ; C6 **1,0** (8/8, cause nommée et corrigée) ; C7 0,5 ; C8 **1,0**
(10,1 %, 8/8, plafonné). **Total : 9,5 / 10 si le noteur lit l'altitude ; 7,5
s'il garde `rapportDistance` en unités de bloc** — et dans ce second cas c'est
l'instrument qui mesure un palier, pas le geste. Je dis **8,5**, en retenant le
demi-point sur C4 droit tant qu'un attaquant n'a pas relu mes deux unités.
