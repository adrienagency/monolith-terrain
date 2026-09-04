# D24 — LA MER SE COUPE À PLAT, AU NIVEAU DE LA JUPE DU SOCLE

> **Adrien, 2026-09-04**, capture à l'appui (angle du socle, vagues qui débordent
> en langues violettes au-delà de l'arête) :
> *« Pour la mer, je pense que l'effet latéral de vagues pose problème. Il
> faudrait que le crop se fasse de façon plate, au niveau de la jupe du socle,
> ça évitera de calculer cette déformation inutile. »*

## ① LE DIAGNOSTIC D'ADRIEN — et pourquoi il est vraisemblable

Sur sa capture, la nappe **déborde en pointes** au-delà de l'arête du socle : ce
ne sont pas des vagues qui dépassent un peu, ce sont les **crêtes déplacées
latéralement** par l'effet de houle, qui sortent de l'emprise. ➡️ **Le déplacement
latéral est appliqué APRÈS l'écrêtage**, ou l'écrêtage ne connaît que la
géométrie au repos. C'est la même signature que le défaut ② de sa liste
(« la mer prend beaucoup plus que la taille du crop »).

## ② LA DÉCISION

**La coupe de la mer est PLATE, et elle tombe exactement sur la jupe du socle.**
Au bord de l'emprise :
- **pas de déformation latérale** — la houle ne déplace plus les sommets vers
  l'extérieur ;
- **le bord de la nappe coïncide avec l'arête du socle**, franc et rectiligne ;
- ⚡ **et cette déformation n'est plus CALCULÉE** : Adrien ne demande pas de la
  masquer, il demande de **ne plus la payer**. Un écrêtage qui rejette le
  fragment après l'avoir déplacé ne répond qu'à la moitié de sa demande.

## ③ CE QUI N'EST PAS DEMANDÉ

⛔ **La mer au CENTRE du crop ne change pas.** Houle, écume, réfraction,
caustiques : intactes. Adrien a déjà signalé une régression de qualité de la mer
une fois — c'est son affiche. **Captures avant/après exigées** : si le large perd
en beauté pendant qu'on répare le bord, c'est un échec.

⛔ Ne touche pas au prédicat qui allume la mer (`dedansCrop()` /
`poserRegimeCrop()`, `main.js`) : **quand** la mer existe est une autre question
(D23 ③), traitée ailleurs. D24 ne parle que de **son étendue et de son bord**.

## ④ LE CRITÈRE

| grandeur | attendu |
|---|---|
| pixels de mer **au-delà de l'arête du socle** | **0**, sur 20 images consécutives (la houle bouge : une seule image ne prouve rien) |
| bord de la nappe contre arête du socle | **coïncident**, ≤ 1 px, sur les quatre côtés |
| **coût du déplacement latéral hors emprise** | **plus calculé** — mesuré, pas supposé |
| la mer au large | **inchangée**, captures avant/après |
