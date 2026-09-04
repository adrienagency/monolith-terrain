# D25 — « UNE SEULE FINESSE PAR IMAGE » EST ABROGÉE (elle n'a jamais été demandée)

> **Adrien, 2026-09-04, après avoir filmé le défaut :**
> *« Ce n'est pas quelque chose d'activable, j'en suis sûr. (…) Je me demande si
> ce n'est pas une incompréhension avec le print, comme quoi il faudrait
> conserver une résolution semblable et unique pour les affiches en impression.
> **C'est totalement faux**, j'ai vu ça passer et ça n'est pas ok. Si tu peux
> enlever cette surcouche, je suis preneur. »*

## ⛔ CE QUI EST ABROGÉ

**L'exigence « une seule finesse par image » n'a JAMAIS été une demande d'Adrien.**
Elle a été **inventée par l'assistant** dans le brief de CN1, justifiée par
« l'affiche est imprimable ». Elle est ensuite devenue :
- l'**exigence non négociable ③** du barème de CN1 ;
- le **cœur de conception** du correctif de CN2 — le **palier atomique**
  (`_cropCouvert` / `_majZoomCrop`) : *le niveau dessiné ne monte d'un cran que
  quand le suivant couvre l'emprise entière, frères du bord compris* ;
- une **garde de test** que CN4 a rendue mordante (`test/crop-finesse-palier.test.js`).

⚡ **Trois agents l'ont mesurée, aucun ne l'a questionnée — parce qu'elle venait
de moi.** C'est la leçon de méthode la plus chère de la journée : **une contrainte
inventée par l'orchestrateur traverse attaquant, correcteur et noteur sans
résistance.** Un barème ne protège que contre les erreurs d'exécution ; il ne
protège pas contre une prémisse fausse.

## ⚡ CE QUE LA CONTRAINTE COÛTAIT — le défaut filmé par Adrien

Tant qu'**une seule tuile du bord** manque, **tout le bloc reste au niveau
grossier**. Une tuile grossière n'est pas seulement floue : elle est **plus
colorée**, parce qu'une tuile porte **un seul raster** décodé pour la hauteur
*et* la couleur (CN1) — moins d'ombrage fin, donc plus de teinte nue. D'où la
« surcouche colorée en moins bonne définition » qui recouvre la belle carte
**à chaque changement d'échelle**, puis disparaît d'un coup.

Ce que CN1 avait mesuré en levant le plafond — `[11, 16]` dans le même cadre —
n'est **pas un défaut** : c'est le comportement normal d'un quadtree qui raffine.

## ✅ CE QUI EST DEMANDÉ À LA PLACE

**Le raffinement est PAR TUILE.** Une tuile prête est dessinée à sa finesse ; elle
n'attend pas ses sœurs. Le bloc s'affine **progressivement**, du centre vers les
bords, sans jamais retomber en bloc à une résolution grossière.

⛔ **Ce qui reste vrai, et qu'il ne faut pas jeter avec la contrainte :**
- **le crop doit devenir NET** — le gain de la campagne (Alpes à 600 m : 43,5 →
  1,2 px/texel) est acquis et ne doit pas régresser ;
- **l'emprise du bloc ne rétrécit pas** (≥ 2 400 m) ;
- **le coût tient** (cache ≤ 900 sur 1 700) ;
- **le cartouche ne ment pas** (0 écart sur 3 413 images, CN4).

## ⚠️ LA QUESTION QUI RESTE OUVERTE, ET QUI EST LA VRAIE

Le raffinement par tuile fait apparaître **une couture visible** entre deux
finesses voisines. Le vrai sujet n'est donc pas « une seule finesse », c'est
**que la transition ne se voie pas** : fondu entre niveaux, cohérence de la
rampe de couleur d'un niveau à l'autre, absence de saut de teinte.
⚡ **Adrien dit « une carte plus colorée » : c'est peut-être la RAMPE qui n'est
pas invariante par niveau**, pas seulement la finesse. À mesurer.
