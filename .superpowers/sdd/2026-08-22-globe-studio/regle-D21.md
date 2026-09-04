# D21 — LE CROP EST UNE PIÈCE, PAS UN SEUIL D'ALTITUDE

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

**Les TROIS seules sorties, et rien d'autre :**
1. **le bouton « map monde »** de la barre du haut (`.ce-globebtn`, `ui/bars.js`) ;
2. **un dézoom au clic droit maintenu** (le geste de zoom de D19/Google Earth) ;
3. **un dézoom à la molette**.

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

## ② LE CROP NAÎT DÈS Z7

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
pivot du crop est l'axe du bloc). ⚠️ **D21 ① et D19 se croisent au clic droit**
et à la molette : ce sont les mêmes gestes, avec une conséquence de plus.
