# D22 — LA CIBLE : le centre de l'écran se charge en premier, la périphérie en basse définition

> **Adrien, 2026-09-04 :** *« Les tuiles à charger en priorité sont celles au
> centre de l'écran. Il faut imaginer un cercle concentrique à partir du centre
> de l'écran, une sorte de cible. Plus la tuile est proche du centre de la cible,
> plus elle est prioritaire. Celles qui sont plus loin du centre ont une priorité
> qui diminue avec leur éloignement. Dans un premier temps, on peut charger
> uniquement une version low def sur les tuiles non prioritaires, qui ne se
> chargent que quand les tuiles prioritaires ont totalement terminé leur
> chargement. »*

## LES TROIS RÈGLES

1. **La priorité est une fonction continue de la distance au centre de l'écran** —
   une cible, pas une case. Elle **décroît** avec l'éloignement, sans palier
   arbitraire.
2. **La périphérie se contente d'abord d'une version basse définition** — un
   niveau plus grossier, déjà en cache ou moins cher, suffit à couvrir l'écran.
3. ⛔ **La pleine définition de la périphérie n'est demandée QU'APRÈS que le
   centre a totalement fini.** C'est un ordonnancement, pas une préférence :
   tant qu'une tuile prioritaire est en vol, aucune tuile de périphérie ne prend
   un créneau pour sa version fine.

## CE QUI EXISTE DÉJÀ, ET QU'IL NE FAUT PAS REFAIRE

**PF2 a déjà posé la priorité par distance au centre** (`_priorite`,
`globe.js:7978`), la file triée (`8196`), le reclassement par image (`7999`) et
la prélecture au centre (`PRELECTURE_CENTRE`, `8987`). Mesuré : les 20 premières
tuiles arrivées sont **100 % dans le champ**, et la tuile du centre arrive
**au rang 0–3** de chaque niveau (avant : rang 84–118 à z10, jamais à z11–12).

⚡ **Ce que D22 ajoute, et qui n'existe pas** : les deux **paliers de
définition** (basse d'abord en périphérie) et surtout **la barrière
d'ordonnancement** — la périphérie fine attend que le centre soit fini.

## ⚠️ CE QUI PEUT ANNULER LE GAIN — à mesurer, pas à supposer

- **Le vol est plafonné à six créneaux** (`MAX_CONCURRENT`) ; le gain de PF2 est
  venu de **vider la file**, pas du vol. Une barrière mal posée peut **laisser
  des créneaux vides** pendant que le centre finit : mesure le **taux
  d'occupation des créneaux**, pas seulement l'ordre d'arrivée.
- **La règle sans-trou et le raffinement partiel de R37** dessinent déjà le
  parent sous les enfants manquants : une « basse définition » de périphérie est
  peut-être **déjà là**, gratuitement. **Vérifie-le avant d'écrire une seconde
  mécanique** — c'est la sixième fois sur ce chantier qu'on allait construire ce
  qui existait.
- **La famine** : si le centre ne finit jamais (réseau lent, tuile absente), la
  périphérie ne doit pas rester grossière indéfiniment. Il faut une **échéance**.
