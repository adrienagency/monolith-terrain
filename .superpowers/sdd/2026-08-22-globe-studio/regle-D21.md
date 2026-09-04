# D21 — LE CROP EST UNE PIÈCE, PAS UN SEUIL D'ALTITUDE

> ⛔ **AMENDÉE DEUX FOIS LE 2026-09-04.** ① ne compte plus **QUE DEUX
> SORTIES** (le clic droit est retiré — voir le § ① et sa mesure) ; ② est
> abrogé par [D23](regle-D23.md).
> Le crop ne naît plus « dès Z7 » : il est **revenu à z10**, `SEUIL_BLOC_M` =
> 32 274,3 m, mort à 40 342,8 m. Adrien : *« il y a beaucoup trop de bugs, on va
> laisser un crop à partir de Z10 uniquement. Annule le crop à Z7. »*
> La mesure qui l'a fait abroger (C1) : **495 → 1 700 tuiles** à la naissance —
> 1 700 étant exactement `CACHE_MAX_CONTINU`, le cache saturé — et
> **19,9 → 129,9 ms par image à CPU ×4**, sans que z8 ni z9 rachètent rien.
>
> ✅ **Le reste de cette règle tient, et il faut le lire comme tel :**
> **① reste entière** (la sortie du crop est une intention, pas un effet de bord
> de l'altitude — l'inclinaison et le cap qui ne tuent pas), **mais ses sorties
> sont passées de trois à deux** ;
> **③ reste posé** (les rivières éteintes par défaut) ; et surtout la
> **séparation des trois grandeurs** que ② a rendue nécessaire est **gardée**,
> alors même que les deux paires de seuils coïncident de nouveau en valeur —
> voir D23 et le §6 bis de `src/monde/seuil-socle.js`.

> **Adrien, 2026-09-04 :** *« Je voudrais que lorsqu'on passe en mode crop, on ne
> puisse plus revenir en mode non crop uniquement par l'altitude (exemples :
> déplacement de hauteur via l'inclinaison de la caméra, changement de l'angle de
> caméra via les boutons). Les seuls moyens de sortir du mode crop seraient :*
> *· de cliquer sur la map monde dans la barre de menu ShibuMap en haut ;*
> *· de zoomer dézoomer à l'aide du clic droit gardé enfoncé ;*
> *· de déscroller via le bouton de scroll central.*
> *Le mode crop doit s'activer dès Z7. Les rivières par défaut ne sont pas
> activées. »*

## ① LA SORTIE DU CROP EST UNE INTENTION, JAMAIS UN EFFET DE BORD

⛔ **L'altitude ne tue plus le crop.** Aujourd'hui `SEUIL_MORT_M = 40 342,8 m`
suffit : **incliner la caméra fait monter l'altitude**, et le crop meurt sans
que personne ne l'ait demandé. C'est le défaut qu'Adrien nomme, et il cite deux
chemins : l'inclinaison, et les boutons d'angle de caméra.

**LES DEUX SEULES SORTIES, et rien d'autre — amendé le 2026-09-04 :**
1. **le bouton « map monde »** de la barre du haut (`.ce-globebtn`, `ui/bars.js`) ;
2. **un dézoom à la molette**.

## ⛔ LA TROISIÈME SORTIE EST RETIRÉE — LE CLIC DROIT EST UN PAN DANS LE CROP

> **Adrien, 2026-09-04 :** ‹ les sorties du crop sont désormais **deux** — le
> dézoom à la molette et le bouton map monde. › ⛔ **Ne recodez pas le clic
> droit : il reste un pan dans le crop, c'est acté.**

**La raison est chiffrée, et elle est dans `rapport-REV.md`** (mesure de REV,
huit chargements par ligne) :

| où | `mouseButtons` | ce que fait le clic droit | mesuré |
|---|---|---|---|
| **dans le crop** (≈ 10 km) | `{LEFT: 0, MIDDLE: 2, RIGHT: 2}` | **un PAN** | `cropPose` **true→true 8/8**, altitude 10 457 → 8 589 m (elle *descend*), `\|Δ ln d\| = 0` |
| **hors du crop** (≈ 250 km) | `{−1, −1, −1}` | un zoom (D19) | 251 956 → **726 014 m 8/8** — le geste marche… mais il n'y a plus de crop à tuer |

⚡ **Ce que D21 ② faisait sans qu'on le dise :** en faisant naître le crop à
600 km, il créait une bande de 568 km où l'on était DANS le crop et pourtant en
régime `surface` — et c'est là, et là seulement, que le clic droit servait de
sortie. **Annuler z7 (D23) supprime la bande, donc la sortie.**

⚠️ **Le clic droit continue d'ARMER l'intention** (`intentionZoom(zoomDuGlisseDroit(dy))`)
là où il est un zoom, c'est-à-dire hors du crop : c'est cette ligne qui reste,
et elle ne contredit rien — elle n'a simplement plus de crop à tuer.

## ⚡ ET LA MOLETTE DEVIENT UNE DES DEUX — IL A FALLU LA RENDRE UTILISABLE

**Elle était une sortie sur le papier seulement.** Mesuré deux fois, par deux
agents et deux dispositifs : **241 à 260 crans** (CHASSE) et **161 à 162 crans**
(SORTIE, `.banc/SORTIE/avant-sortie-2.json`) — dont **23 crans morts d'affilée**
(crans 21 → 43 : `d` collée à `maxDistance = 150`, **altitude figée à 616 m**).

⛔ **La cause n'est PAS le pas de molette** : le plafond clippe le déplacement,
le compteur de niveau encaisse l'intention (R23), et le franchissement qui
libère la caméra **conserve l'altitude** — c'est sa définition.

➡️ **Correctif (tâche SORTIE) : une POUSSÉE DE SORTIE**, armée par trois crans
de dézoom d'affilée dans le crop (`monde/sortie-molette.js`,
`modes.armerPousseeSortie`). Elle **ne décide de rien** : elle pompe l'intention
jusqu'à ce que l'altitude franchisse `SEUIL_MORT_M`, et **c'est la loi de ① qui
tue le crop**. Mesuré après, huit chargements : **8 à 9 crans**, confirmés au
**3ᵉ 8/8** ; un cran isolé ne sort **jamais** (8/8) ; le pas de molette est
inchangé au bit (D19 tient). Voir `rapport-SORTIE.md`.

⚠️ **Lecture de « bouton de scroll central »** : la **molette**, en dézoom —
`déscroller` est du vocabulaire de molette, et le bouton du milieu vient d'être
attribué à l'inclinaison et au cap (D19, GE2/GE3 notés 9,75). Si Adrien voulait
dire le bouton du milieu enfoncé, **c'est une ligne à changer**, et il faut le
lui dire plutôt que deviner deux fois.

➡️ **La règle générale, et c'est elle qui compte** : la mort du crop est armée
par **un geste de dézoom explicite** ou par **le bouton monde**. Tout le reste —
inclinaison, cap, boutons de caméra, redressement automatique, vol de
présentation, recalage — peut faire varier l'altitude autant qu'il veut : **le
crop reste**. La naissance, elle, garde son seuil.

## ⛔ ② LE CROP NAÎT DÈS Z7 — **ABROGÉ LE 2026-09-04 PAR D23**

*(Conservé pour la trace : c'est le raisonnement qui a produit la séparation des
trois grandeurs, laquelle survit à l'abrogation. Tout ce qui suit dans ce §
décrit un état du code qui n'existe plus — le seuil est revenu à 32 274,3 m.)*

Aujourd'hui `SEUIL_NAISSANCE_M = 32 274,3 m`, soit z10–z11. Adrien veut **z7**,
qui vaut `altM: 600 000` dans `DIVE_TIERS` (`modes.js:107`) — **dix-huit fois
plus haut**, et une emprise d'environ **438 km** au lieu de 27.

⚠️ **C'est le changement le plus lourd des quatre, et il faut le mesurer avant
de le poser** : coût des tuiles, poids du maillage, tenue de la vue de trois
quarts (D16 ter : elle arrive **au bloc** — si le bloc naît à 600 km, la vue
bascule-t-elle à 600 km ?), et ce que devient le fondu d'estompage
(`ALT_ESTOMPAGE_DEBUT_M = SEUIL_MORT_M`). **Si la mesure dit que z7 est
intenable, le dire avec le chiffre et proposer le plus proche tenable** — mais
ne pas décider seul de rester à z10.

## ③ LES RIVIÈRES SONT ÉTEINTES PAR DÉFAUT

Simple, et lié : elles coûtent un temps de chargement qu'Adrien a signalé.
Éteindre le **défaut**, sans retirer l'option ni la couche.

## CE QUE ÇA N'ABROGE PAS

**D16 ter** (la vue de trois quarts arrive au bloc), **D19** (les contrôles de
Google Earth : glissé = la Terre autour de son centre, molette = vers le centre
de l'écran, clic droit = zoom, milieu/Ctrl/Maj = inclinaison et cap), **D13** (le
pivot du crop est l'axe du bloc). ⚠️ **D21 ① et D19 se croisent à la molette**
(et se croisaient au clic droit, jusqu'au retrait de cette sortie) : ce sont les mêmes gestes, avec une conséquence de plus.
