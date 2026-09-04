# LES CINQ DÉFAUTS NOMMÉS PAR ADRIEN — 2026-09-04

Ce ne sont pas des hypothèses d'agent : **c'est ce qu'Adrien voit à l'écran**,
avec deux captures à l'appui (Majorque, mode crop et vue rapprochée).

## ① Scintillement entre les deux Terres
*« On a un scintillement, ou un affichage / désaffichage des différentes couches :
celles qui correspondent à la Terre vue de l'espace, et celles qui correspondent
à la Terre vue en mode crop. »* Les deux représentations coexistent pendant la
transition et **clignotent** l'une par-dessus l'autre.

## ② La mer déborde du crop — ou ne se crope pas du tout
*« La mer prend beaucoup plus que la taille du crop, et parfois ne se crope pas
du tout. »* ⚡ Visible sur la deuxième capture : la nappe bleue déborde
largement du quadrilatère du socle, sur toute la Méditerranée.

## ③ Les deux Terres se DÉCALENT
*« Parfois la Terre vue de l'espace et la Terre vue en crop se décalent au
niveau de l'alignement. »* (capture) ⚠️ **C'est la signature de la classe de
défaut revenue dix fois ici** : deux espaces de coordonnées — bloc et globe —
dont la conversion est perdue ou appliquée une fois de trop.

## ④ Des trous aux coutures des blocs
*« On a des trous entre les blocs au niveau des coutures terrains. »*

## ⑤ Le crop met trop de temps, et tout le terrain est calculé
*« Le crop met beaucoup trop de temps à s'afficher, et on voit quasiment tout le
terrain affiché. Il me semble que ça implique que l'ordi doit calculer des choses
qui ne doivent pas être visibles à l'écran (hors crop), et que du coup on perd de
la puissance de calcul pour rien. »* ⚡ **Sa lecture rejoint la mesure de C1** :
le crop faisait passer le cache de 495 à **1 700 tuiles** — exactement
`CACHE_MAX_CONTINU`. Ce qui est hors du socle ne doit ni être maillé, ni occuper
une place de cache.
