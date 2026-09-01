# D20 — LA PROFONDEUR DE CHAMP : même flou apparent à tout zoom, mise au point sous le pointeur

> **Adrien, 2026-09-01 :** *« Le flou doit être proportionnel en fonction du
> niveau de zoom. Il ne sera donc pas le même quand on est en vue croppée que
> quand on voit la Terre en entier. Il existe déjà un focus sur le point
> terrestre qui est le plus proche de la caméra sur l'axe caméra > pointeur >
> Terre ; il faut le corriger car il semble mal fonctionner. La profondeur de
> champ sélectionnée est la même à toutes les distances, mais sa distance de
> bokeh est proportionnelle à la distance de la caméra avec la Terre. »*

Trois réponses données le même jour, à trois questions posées :

1. **Le flou est L'EXCEPTION à « les effets n'apparaissent qu'en mode crop »** :
   il est actif à tous les zooms — orbite, surface, crop. Les autres effets (mer
   simulée, occlusion, grain…) restent bornés au crop.
2. **La mise au point se fait sous le pointeur** — le point terrestre le plus
   proche de la caméra sur l'axe caméra → pointeur → Terre — **avec repli au
   centre de l'écran** quand le pointeur quitte la toile ou passe sur un
   panneau : la mise au point glisse vers le centre, elle ne reste pas figée.
3. **À réglage égal, le flou APPARENT à l'écran est le même à tout zoom.** La
   plage de netteté autour du point de focus vaut `k × distance(caméra → point
   de focus)` ; le curseur du studio règle `k`, et il produit le même rendu
   visuel à 5 km comme à 5 000 km.

⚠️ **La règle s'exprime en distances RÉELLES (mètres) ou à l'écran (pixels de
flou), jamais en unités de bloc** : la mise au point automatique a déjà porté
un facteur de conversion faux de **130,4** et une portée de flou de **1 465 km**
— deux occurrences de la classe « unités » qui est revenue neuf fois.
