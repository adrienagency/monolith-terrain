# D19 — LES CONTRÔLES SONT CEUX DE GOOGLE EARTH. EXACTEMENT.

> **Adrien, 2026-09-01, après avoir filmé deux fois le pivot faux :**
>
> *« Je décris mieux ce que je veux. Je souhaite que :*
> *· quand je déplace et fais tourner la Terre au clic, la Terre se déplace
>   autour de son centre ;*
> *· quand je scrolle pour zoomer ou dézoomer, je scrolle vers le point visé
>   au centre de l'écran ;*
> *· je veux que les contrôles soient exactement les mêmes que pour Google
>   Earth. »*

## CE QUE ÇA TRANCHE

1. **Glisser = faire tourner la Terre autour de SON centre.** Pas un lacet
   autour de la verticale locale, pas une rotation autour du point visé. Le
   point saisi suit le curseur (« on attrape la Terre »), la Terre reste plantée
   dans le cadre. C'est le geste de l'orbite, **étendu jusqu'au crop**.
2. **La molette zoome vers le point visé AU CENTRE DE L'ÉCRAN.** Ni vers le
   curseur, ni radialement « vers le centre de la Terre » en tant que tel : vers
   la surface au milieu du cadre. Quand la vue passe par le centre de la Terre
   (pas d'inclinaison), c'est la même chose que le zoom radial. Quand la vue est
   inclinée, ce n'est plus la même chose — et c'est le point du cadre qui gagne.
   ⚠️ **Ceci remplace l'arbitrage du matin** (« je garde » le zoom radial) : le
   zoom radial n'en était qu'un cas particulier.
3. **La référence est Google Earth**, pas une interprétation. En cas de doute
   sur un geste (glissé, molette, double-clic, Maj+glissé pour incliner/tourner,
   clic droit ou molette enfoncée, flèches), **c'est le comportement de Google
   Earth qui fait foi**, et il faut le décrire avant de le coder.

## CE QUE ÇA NE CHANGE PAS

- **D16 ter** : la vue de trois quarts arrive **au bloc**, pas avant. Google
  Earth incline aussi ; ici l'inclinaison automatique reste réservée au crop.
- **L'exception du crop pour le pivot** (règle d'Adrien du matin) : sur le bloc
  croppé, le pivot est l'axe du bloc (R13). Le zoom, lui, obéit à la règle 2
  partout, sauf mesure contraire **dite et chiffrée**.

## POURQUOI CETTE RÈGLE A DÛ ÊTRE ÉCRITE

Quatre passes ont déclaré le pivot réglé en mesurant **l'axe du bloc** — le point
de la surface sous la caméra, dans l'espace du bloc plat — et en l'appelant
« l'axe de la Terre ». Adrien a filmé le défaut **trois fois**. La règle est
donc écrite dans l'espace où elle se vérifie : **en mètres du centre de la
Terre, en espace globe, ou en pixels à l'écran** — jamais en unités de bloc.
