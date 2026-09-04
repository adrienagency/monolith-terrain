# D23 — LE CROP REVIENT À Z10, ET LA MER ANIMÉE AVEC LUI

> **Adrien, 2026-09-04 :** *« Il y a beaucoup trop de bugs, on va laisser un crop
> à partir de Z10 uniquement. La mer animée et les effets ne s'activent qu'à
> partir de ce niveau de crop. Annule le crop à Z7. »*

## ⛔ CE QUI EST ANNULÉ

**D21 ② (« le crop naît dès z7 ») est ABROGÉ.** Le crop naît de nouveau à
**z10**, c'est-à-dire à l'ancien seuil : `SEUIL_BLOC_M = 32 274,3 m`
(60 % de la hauteur), avec sa mort à `SEUIL_BLOC_MORT_M = 40 342,8 m`.

**Mesure qui justifie l'abandon** (relevée par C1 avant qu'Adrien ne tranche) :
le crop à 600 km coûtait **495 → 1 700 tuiles** et **19,9 → 129,9 ms par image à
CPU ×4** (×6,5). Les 1 700 tuiles sont **exactement `CACHE_MAX_CONTINU`** : le
cache saturait dès que le crop existait au-dessus du bloc, **à toute altitude**.
z8 et z9 ne rachetaient rien (137,3 et 109,8 ms).

## ✅ CE QUI EST GARDÉ — et il ne faut surtout pas le jeter avec z7

**D21 ① reste entière** : la sortie du crop est **une intention**, jamais un
effet de bord de l'altitude. Trois sorties : le bouton « map monde », un dézoom
au clic droit maintenu, un dézoom à la molette. **L'inclinaison, le cap et les
boutons de caméra ne tuent pas le crop**, quelle que soit l'altitude atteinte.

⚡ **Et surtout : la SÉPARATION DES TROIS GRANDEURS**, que C1 a dû faire pour
z7 mais qui vaut indépendamment de lui. Un seul seuil portait :
1. la **naissance du bloc** (`SEUIL_BLOC_M` / `SEUIL_BLOC_MORT_M`) ;
2. la **bascule de vue de trois quarts** (D16 ter) et son miroir, le retour au
   nadir (`surLeBloc`, `redresserSiHerite`) ;
3. le **régime de gestes** (`horsDuCrop`) — dont dépend le fait que le clic
   droit soit un zoom (D19) et non un pan.
Sans cette séparation, le seul fait de changer le seuil amputait D19 d'une bande
de 568 km et **faisait disparaître la deuxième sortie du crop d'Adrien**.
⛔ **Ces trois grandeurs restent séparées. On ne les refusionne pas.**

## ③ LA MER ANIMÉE ET LES EFFETS SUIVENT LE CROP

Déjà posé par PF3 : un prédicat `dedansCrop()`, une fonction `poserRegimeCrop()`
appelée à la naissance et à la mort du crop. **Avec le crop de retour à z10,
cette règle rend exactement ce qu'Adrien demande** — à vérifier, pas à supposer :
la mer simulée (houle, écume, réfraction) et les effets ne s'allument qu'au crop.
**Exception D20 : la profondeur de champ reste active à tous les zooms.**
