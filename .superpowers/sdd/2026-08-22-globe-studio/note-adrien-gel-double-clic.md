# NOTE D'ADRIEN — le freeze arrive au DOUBLE-CLIC pour zoomer, 2026-09-05

> **Adrien, mot pour mot :** *« Pour le freeze, j'ai remarqué que ça arrive
> principalement, voire tout le temps, lors d'un double-clic pour zoomer. »*

Le correctif GEL (attente entre raffinements proportionnelle à leur coût) a été
fusionné SANS reproduction du gel : 30 chargements par `flyTo`, crans et molette,
0 gel. **Le double-clic n'avait pas été testé.** C'est la piste qui manquait.

Le double-clic est un geste D19 (Google Earth) : clic gauche double = zoom vers le
point ; clic droit double = dézoom (avec une rotation parasite de 3,7–3,9°
notée en réserve à l'époque). Il déclenche probablement un **vol** (`flyTo` /
animation de caméra) ET un **raffinement** en même temps — deux chemins qui se
disputent le fil, ou une promesse qui attend l'autre.
