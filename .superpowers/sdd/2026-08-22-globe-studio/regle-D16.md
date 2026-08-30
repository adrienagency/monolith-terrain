# D16 — UNE SEULE VUE, DE L'ORBITE AU BLOC

> **Adrien, 2026-08-24 :** *« On va faire disparaître la transition entre tous les
> zooms. Depuis le mode orbital jusqu'au premier crop de bloc, la caméra doit
> être unique et sans chargement ni saut de position. La Terre et la vue doivent
> rester au même endroit, sans changer d'axe. Une seule vue qui zoome
> progressivement — seul le chargement des dalles et leur amélioration
> s'effectue au fur et à mesure qu'on zoome. »*

⚠️ **C'est la formulation la plus complète de l'objectif du chantier depuis son
début. Elle arbitre par avance tous les compromis.**

---

## LES QUATRE EXIGENCES, SÉPARÉES — elles ne se corrigent pas au même endroit

| | exigence | ce qui la viole aujourd'hui |
|---|---|---|
| **① une seule caméra** | pas deux mondes reliés par une similitude | `camera` (espace bloc) et `camGlobe` (espace globe), liées par `poseFond()`, facteur `k = extentMeters / span / ORBITAL_M_PER_UNIT` |
| **② pas de saut de position** | le zoom est un rapprochement, rien d'autre | le balayage de plongée, **~1,9 s de caméra pilotée** |
| **③ ⚡ PAS DE CHANGEMENT D'AXE** | la visée ne tourne pas | **46,548° de bascule à la plongée** (identité `90° − atan(18/19)`), ramenés par R4 à **1,5°/image sur ~1,9 s — mais TOUJOURS 46,5° au total** |
| **④ pas de rechargement** | seules les dalles s'affinent | reste à mesurer sous cette exigence |

⚠️ **③ EST LA NOUVEAUTÉ, ET C'EST ELLE QUI REND LA TÂCHE R4 INSUFFISANTE.**
R4 a **lissé** la bascule ; Adrien demande de la **supprimer**. Sa propre réserve
n° 2 l'avait anticipé, mot pour mot :

> *« Ce qu'Adrien verra, à lui poser dans ces termes : ~1,9 s de caméra pilotée,
> 1,5°/image au pire. **Il a accepté « une transition », pas celle-là.** »*

**Il vient de répondre.**

---

## CE QUE ÇA ABROGE

⛔ **La notion même de « plongée » comme geste** — choisir une cible, s'orienter
vers elle, y voler. D16 dit : **on ne vise pas, on se rapproche.**

⛔ **`DIVE_TIERS`** (`modes.js:77-92`), la table discrète qui choisit le zoom
d'arrivée d'un clic sur le globe. Déjà signalée comme réserve ouverte par R4.

⛔ **`PENTE_ARRIVEE`** en tant qu'orientation IMPOSÉE à l'arrivée. ⚠️ **C'est
elle, les 46,548°.**

## CE QUE ÇA N'ABROGE PAS

✅ **Le chargement progressif des dalles** — Adrien le nomme explicitement comme
le SEUL changement admis : *« seul le chargement des dalles et leur amélioration
s'effectue au fur et à mesure qu'on zoome »*.
✅ **L'apparition du crop** — mais **fondue**, pas claquée. R6 a déjà retiré
**56,7 %** du saut de style en éclairant la planète des deux côtés du seuil.

---

## CE QUI EST DÉJÀ ACQUIS ET MESURÉ — ne pas le refaire

- **La descente ne saute plus en ALTITUDE** : Tâche M, 1 158 images, pire rapport
  image à image **1,026**.
- **La pose ne dérive plus** : R4, **11 franchissements de 0,970° à 10,394° → 0
  sur 11**, plus grand pas **0,0215°**, et le balayage plafonné à **1,5°/image**
  (mesuré sur GPU réel : 4,135° avant, 1,500° après, et le balayage **ne
  s'allonge pas** — 34 images/1 974 ms → 54 images/1 912 ms).
- **Le saut de STYLE est réduit de 56,7 %** : R6, **×1,689 → ×1,298**.
- **Le saut de LUMIÈRE est réduit de 30 %** : R7, **×5,89 → ×4,11**.
- **`_suivreEmprise()` compense déjà le facteur `k` par morceaux**, dans la MÊME
  image que le changement de niveau (Tâche M §3.4).

⚠️ **Tout ça reste vrai. D16 ne dit pas que c'est faux — elle dit que ça ne
suffit pas**, parce que ça lisse au lieu de supprimer.

---

## LE SEGMENT QUE PERSONNE N'A JAMAIS MESURÉ À L'ÉCRAN

⚠️ **`MAX_ALT_M = 60 000 000` m** (`modes.js:121`). **La descente de la Tâche M
partait de 1 600 km.** Le segment **de 60 000 km à 1 600 km n'a JAMAIS été
vérifié à l'écran** — la lecture du code dit qu'il devrait être continu, personne
ne l'a regardé.

➡️ **D16 dit « depuis le mode orbital ». Le banc doit donc partir de
`MAX_ALT_M`, pas de 1 600 km.**

---

## LA MÉTHODE IMPOSÉE — Adrien l'a demandée nommément

> *« Utilise des sous-agents pour vérifier le travail : attaquants et
> défenseurs, et correcteurs. »*

**Après l'implémentation, des ATTAQUANTS** dont la mission n'est pas de relire
mais de **casser l'affirmation** : trouver un geste, un chemin, une vitesse, une
machine, un lieu où **ça saute encore**. ⚠️ **Un attaquant qui ne trouve rien
doit dire ce qu'il a essayé**, sinon son silence ne prouve rien.

⚠️ **Ce que les attaquants doivent essayer en priorité, parce que ce sont les
angles morts CONNUS de ce chantier :**
- **le segment 60 000 → 1 600 km**, jamais regardé ;
- **le clic sur le globe** (`DIVE_TIERS`), et non la seule molette ;
- **le panoramique et l'orbite PENDANT la descente**, pas seulement la descente
  pure ;
- **une machine lente** — R4 borne son résultat à une seule RTX 3080, et *« sur
  une machine lente le balayage s'étirerait »*, **non mesuré** ;
- **un autre lieu** — la décomposition de R4 ne vaut que pour le lieu de
  démarrage par défaut, **en pleine mer** ;
- **le sens INVERSE** — remonter du bloc à l'orbite.

---

## LES INSTRUMENTS, ET LEURS PIÈGES DÉJÀ PAYÉS

⚠️ **Mesurer l'altitude ne suffit pas** — la Tâche M l'a fait et a conclu « aucun
saut » alors qu'Adrien filmait une bascule. **Il faut relever, par image :
position, ORIENTATION (vecteur de visée), échelle, et un condensé de l'image.**

⚠️ **Le panneau navigateur de session ne composite pas toujours.** Un Chrome sans
tête capture l'image composée quel que soit `preserveDrawingBuffer` — patron dans
`scripts/sonde-demarrage.mjs`.

⚠️ **Les bancs de ce dépôt mesurent le temps de SOUMISSION CPU**, indiscernable
du temps sans barrière. `gl.finish()` **synchronise bien** (vérité 0,36–0,40 ms
établie sans barrière, `finish` rend 0,383) — mais **il ne pèse pas les
fragments** : ×35 de fragments ⇒ ×0,96 de temps par image.

⚠️ **Le grain est ÉTEINT par défaut** (`main.js:466`, `grain: 0`) : il n'entre
dans aucune capture. **Le plancher de bruit de 8,97 n'était pas le grain**, et sa
cause reste non identifiée. **Mesure ton propre plancher, avec deux témoins.**

⛔ **Tout script d'édition doit écrire en BINAIRE ou forcer `newline='\n'`** :
sous Windows, le mode texte met le fichier en CRLF contre le `.gitattributes`, et
**deux tests sont tombés là-dessus il y a une heure**.

---

## LA BARRE

**Le juge est la vidéo d'Adrien** — 39 images, une par seconde :
`…/scratchpad/video/t01.jpg` … `t39.jpg`.

⛔ **Une descente qui ne saute pas mais qui met dix secondes n'est pas une
réussite.** ⛔ **Une descente continue qui change d'axe non plus.**

---

## ⚡ D16 bis — UNE SEULE CAMÉRA, ET C'EST UN ORDRE

> **Adrien, 2026-08-24 :** *« Il ne faut pas deux caméras, il n'en faut plus
> qu'une seule et unique. »*

⚠️ **Ceci ferme la question que l'inventaire allait poser.** `camera` (espace
bloc, `TERRAIN_SIZE = 56`) et `camGlobe` (espace globe) doivent devenir **une**,
et la similitude `poseFond()` doit disparaître. **La réécriture n'est plus une
option à chiffrer : c'est la commande.**

### ⛔ LE RISQUE QUI PEUT DÉCIDER À NOTRE PLACE — LA PRÉCISION

C'est très probablement la raison d'être des deux espaces, **même si personne ne
l'a jamais écrite**.

Si l'espace unique est **métrique à l'échelle de la Terre**, une position de
caméra vaut ~6,4 × 10⁶ m, et un `float32` n'y porte qu'environ **0,5 m de
résolution** — pendant qu'on demande à la caméra de se poser à **500 m** du sol
et d'y bouger en douceur.

⚠️ **Et les uniformes GLSL sont en `float32` quoi qu'il arrive**, même quand
JavaScript calcule en double.

➡️ **À MESURER, PAS À DÉDUIRE** : le tremblement de position et d'orientation en
`float32` **aux deux bouts** de la descente — 60 000 km et 500 m.
➡️ **Si la précision interdit l'espace métrique nu, le dire AVEC LES CHIFFRES et
proposer ce qui la contourne** (origine flottante recentrée près de la caméra,
espace relatif à l'œil). ⛔ **C'est un résultat, pas un échec.**

### CE QUI DÉPEND DE LA SÉPARATION — à inventorier

Les lecteurs de `camGlobe`, `poseFond`, `k = extentMeters / span /
ORBITAL_M_PER_UNIT`, `_suivreEmprise()` et `altitudeFondM`.

⚠️ **Une dépendance piégeuse est déjà mesurée** : l'autofocus rend **23,597
unités** pour un sujet à **0,1809** de la caméra qui le dessine — **facteur
130,4**. **Chercher les autres conversions du même genre** : c'est la classe de
défaut la plus fréquente de ce chantier, **six occurrences**.

### UN DÉFAUT QUI DISPARAÎTRAIT PEUT-ÊTRE AVEC LA RÉÉCRITURE

Sous `?terre=unique`, la profondeur du sujet est **effacée par une passe
intermédiaire** (`ClearPass(false, true, false)`, `main.js:4569`) : le sujet est
dessiné par la passe de fond, la passe de surface ne dessine plus rien, et le
tampon vaut 1,0 partout. **Le flou d'arrière-plan est totalement inerte —
0 pixel sur 1 024 000 quand la mise au point balaie 0,5 → 400.**

➡️ **Une caméra unique a-t-elle encore besoin de deux passes ?** Si la réécriture
les fusionne, **ce défaut tombe avec**. Ça pèse dans l'arbitrage.

---

## ⚡ D16 ter — LA VUE DE TROIS QUARTS ARRIVE AVEC LE BLOC, PAS AVANT

> **Adrien, 2026-08-24**, en réponse au choix « orbite oblique » contre
> « arrivée au nadir » : *« On passe en vue 3/4 quand on arrive au bloc, pas
> avant. »*

⚠️ **Il refuse les deux options proposées, et il a raison : elles posaient toutes
deux la question au mauvais endroit.** Ni « incliner l'orbite », ni « renoncer à
la vue de trois quarts » — **déplacer le moment**.

### CE QUE ÇA ORDONNE

| segment | axe |
|---|---|
| de l'orbite jusqu'au bloc | ⚡ **NADIR, inchangé — aucune bascule pendant la descente** |
| à l'arrivée sur le bloc | **la vue de trois quarts, et là seulement** |

➡️ **La bascule n'est pas supprimée : elle est SORTIE de la descente.**
Aujourd'hui elle tombe **à 32 km**, en plein milieu du trajet, sur ~1,9 s de
caméra pilotée. Elle doit tomber **à l'arrivée**, quand le bloc est là.

### LA QUESTION QUE L'EXÉCUTANT DOIT TRANCHER — par la mesure

⚠️ **« Arriver au bloc » n'a pas de définition dans le code.** Trois candidats,
et ils ne sont pas au même endroit :
- la **naissance du crop** (`SEUIL_NAISSANCE_M = 32 274,3 m`) — ⛔ **c'est là que
  ça tombe AUJOURD'HUI, et c'est précisément ce qu'Adrien refuse** ;
- la **fin de la descente**, quand la molette s'arrête et que la vue se pose
  (`veille-repos.js` sait déjà dire « la vue est posée ») ;
- **l'altitude finale** du bloc.

➡️ **Il faut choisir celui qui met la bascule LE PLUS TARD possible sans la
rendre surprenante**, et **le justifier par une mesure**, pas par un principe.

### CE QUE ÇA PRÉSERVE, ET QUI A DÉCIDÉ

✅ **La vue de trois quarts** — la signature du produit : silhouette, parois,
relief. Elle n'est ni perdue ni déplacée en orbite.
✅ **L'orbite reste frontale**, donc `enterOrbit`, `_zoomGesture`,
`altitudeOrbitaleM` et les butées **ne tombent pas**.
✅ **Les 31 % de champ au sol** que l'arrivée au nadir aurait coûtés.

⚠️ **Mais le +32,6 % d'altitude parasite du balayage NE disparaît PAS tout
seul** — c'était le bénéfice de l'option nadir. **Il reste à traiter séparément.**
