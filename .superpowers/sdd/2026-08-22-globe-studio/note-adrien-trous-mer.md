# NOTE D'ADRIEN — les « trous » de la mer, 2026-09-05 (capture à l'appui)

> **Adrien, mot pour mot :** *« Pour info, pour les trous de la mer, c'est
> simplement le quadtree qui met le sol à zéro, créant une espèce d'arche, car
> le sol ne s'aligne pas avec les dalles de sol qui sont à côté. »*

## CE QUE ÇA VEUT DIRE — c'est une CITATION, à vérifier mais à prendre au sérieux

Les rectangles rouges dans la mer ne sont **pas** des tuiles manquantes ni des
parois visibles à travers une nappe absente : ce sont des **dalles de fond marin
dont la hauteur vaut ZÉRO** — le niveau de la mer — alors que leurs voisines
sont à leur vraie profondeur (−500, −2 000 m…). Une dalle à 0 m **affleure la
surface** et se dessine en rouge/brun (le matériau du sol) **à travers la
nappe**, pendant que ses voisines restent sous l'eau. Entre les deux, une
**marche verticale** de plusieurs centaines de mètres : l'« arche ».

Sa capture le montre : des rectangles rouges nets, alignés sur la grille des
tuiles, **au ras de la nappe**, avec des bords en marche.

## LE LIEN AVEC CE QUI EST DÉJÀ MESURÉ

- **B6** : *« le terrarium rend 0,000 m PILE sur 262 144 pixels sur 262 144 »*
  là où le tuileur bathymétrique a écarté l'abysse — **une tuile sans donnée
  bathymétrique a un sol à 0 m**, pas un sol absent.
- **GEB** : la recuisson additive n'a couvert que **z4 → z7** ; **z8 et au-delà
  sont restés troués** (B6 : 68 tuiles manquantes sur 81 à z8 autour de
  Rodrigues). À la Réunion en crop (z11–z13), les tuiles fines sans bathy
  **tombent sur le terrarium à 0 m**.
- **B6, cinquième porte** : `s >= level → out[i] = l` rendait le zéro muet du
  terrarium ; le garde `merFranche` a été posé — **vérifier qu'il couvre ce
  cas** (une dalle entière à 0 m en pleine mer, pas un pixel isolé).

➡️ **Le correctif n'est donc pas dans le rendu de la nappe ni dans les parois :
c'est le sol qui doit ne JAMAIS valoir 0 m en pleine mer** quand la bathymétrie
manque — il doit prendre **l'ancêtre bathymétrique** (le plancher z7 existe
maintenant partout) ou, à défaut, la profondeur des dalles voisines, **jamais le
zéro du terrarium**.
