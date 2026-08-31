# D17 — IL N'Y A PAS DE PRODUCTION

> **Adrien, 2026-08-24 :** *« Arrête de penser en termes de modification d'un
> site live. Le site n'est pas live, il n'est pas partagé, on ne cassera rien.
> Quand ce sera le cas, je te le dirai. »*

C'est la **deuxième fois** qu'il le dit. La premiere, le 2026-08-22 :
*« On se moque que ShibuMap tourne, il est en version alpha et personne ne
l'utilise encore, tu peux modifier tout ce que tu veux. »*

## CE QUE ÇA ABROGE, ET C'ETAIT PARTOUT

⛔ **La garantie « drapeau baissé, la production est rigoureusement inchangée ».**
Elle figurait comme étape de cloture dans **presque tous les briefs** de cette
campagne, et plusieurs taches ont dépensé du temps de mesure a la prouver — dont
une au pixel pres, 0 sur 1 024 000, trois chargements.

⛔ **Les étapes « dis ce qui casse ailleurs ».** Sans utilisateurs, il n'y a rien
a prévenir.

⛔ **Les réserves rédigées du point de vue d'un utilisateur** qui subirait une
régression. Il n'y en a pas.

⛔ **Les drapeaux posés PAR PRUDENCE.** Un drapeau se justifie s'il sert a
comparer deux états ou a revenir en arriere pendant un chantier — **pas a
protéger un public qui n'existe pas.**

## CE QUE ÇA N'ABROGE PAS — et la distinction est nette

✅ **Les tests.** Ils ne protegent pas des utilisateurs, ils protegent **nous**
d'une régression qu'on ne verrait pas. La campagne de mutation reste la mesure de
leur valeur.

✅ **La discipline de mesure.** Ne rien annoncer qu'on n'a pas mesuré, publier la
valeur la moins favorable quand il y en a deux, retirer un chiffre qu'on ne
reproduit pas. **Trente-et-un chiffres retirés par leurs propres auteurs** : ça
n'a jamais servi a protéger la production, ça sert a ce que les rapports soient
croyables.

✅ **Le fait de DIRE ce qu'on casse volontairement.** Adrien doit savoir ce qui a
changé — pas parce que c'est risqué, mais parce que c'est son produit.

## LA LEÇON POUR MOI, ET ELLE EST DÉSAGRÉABLE

J'ai continué a écrire cette garantie dans les briefs **apres** qu'il ait dit une
premiere fois qu'elle ne servait a rien. Ce n'était pas de la rigueur, c'était un
réflexe — et il a coûté du temps de mesure, des étapes de cloture, et une étape 5
entiere annulée en cours de tache.

⚠️ **Une prudence qui ne protege personne n'est pas de la prudence : c'est du
gaspillage bien habillé.**
