# D27 — LE CROP NAÎT AVANT QUE TERRE OU MER NE S'AFFICHENT

> **Adrien, 2026-09-05, 7 h 27, vidéo d'un dézoom à la Réunion :**
> *« Voilà la vidéo d'un dézoom, honnêtement, c'est bourré de bugs.
> **On ne peut pas lancer le crop avant même d'afficher la terre ou la mer ?**
> Ça évite d'afficher des éléments qui sont hors crop. »*

## CE QU'ON VOIT — 26 images, `…\scratchpad\video8\r_001…r_026.png`
Au dézoom, entre deux paliers (`r_014`, `r_020` : « WIDENING … Z11 ») :
- **la planète entière est dessinée autour du socle** — terre et mer du globe
  bien au-delà de l'emprise, pendant que le socle n'est qu'une **plaque grise
  partiellement posée** ;
- **du relief de globe dépasse au-dessus du bloc**, hors emprise ;
- la mer du globe (nappe plate turquoise) **entoure** le crop ;
- puis tout se remet en place (`r_025`) : socle complet, parois, mer croppée.

## LA RÈGLE — citation transformée en exigence

**Le crop est posé AVANT que quoi que ce soit ne soit affiché à sa nouvelle
échelle.** À chaque changement de palier (dans les deux sens), l'ordre est :
1. **l'emprise du crop** est connue et posée (socle, parois, découpe de la mer) ;
2. **seulement ensuite** le terrain et la mer sont dessinés — **et uniquement
   à l'intérieur de cette emprise** ;
3. **rien de ce qui est hors crop n'est jamais affiché** pendant la transition :
   ni relief de globe, ni mer de globe, ni tuile grossière qui déborde.

Corollaire : entre l'ancien palier et le nouveau, on affiche **l'ancien crop
complet** (ou le nouveau socle vide, à trancher par la mesure) — **jamais un
état mixte** où le globe apparaît.

## CE QUI EXISTE ET QUI DOIT ÊTRE RÉCONCILIÉ
- `_cropSeul` (MIX/VIE) : le dehors est éteint dans le crop **au repos** et
  n'est redessiné que sur intention (molette). ⚡ **Pendant le WIDENING, cette
  règle est violée** : c'est ce qu'Adrien filme.
- La **plaque provisoire** (SOC) : posée dès l'image d'arrivée pour un vol ;
  **au palier**, la vidéo montre qu'elle reste partielle.
- `poserCrop` / `_zoomCropEcran` (CULL, CN2) : l'emprise est bornée par l'écran
  — mais **quand** est-elle posée par rapport au dessin ?
- Le raffinement par tuile (TUILE, D25) : les tuiles arrivent une à une — **il
  ne doit pas laisser paraître le globe sous les manquantes** ; le parent doit
  couvrir (R37), **à l'intérieur de l'emprise seulement**.
