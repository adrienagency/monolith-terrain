# L'AGENT NOTEUR — conformité visuelle avec le socle d'AVANT la sphère

> **Adrien, 2026-08-22 :** *« Utilise des agents noteurs qui jugeront la conformité visuelle
> avec celle précédant le passage en mode sphère. »*

**Le juge de référence n'est pas une intention, c'est une IMAGE : le socle de production,
drapeau baissé, au même endroit et au même cadrage.**

## ⛔ LE PIÈGE À RÉGLER AVANT TOUTE NOTATION

La Tâche K ter l'a relevé et **il invalide toute comparaison faite sans lui** :

> *« À vue isométrique identique, le crop et le socle de production n'occupent pas la même
> fraction du cadre (`applyIsoView` dérive de `controls.maxDistance`). »*

➡️ **Un noteur qui compare deux images de tailles apparentes différentes note du cadrage, pas
du rendu.** **Établis d'abord l'appariement, prouve-le (fraction du cadre occupée par le bloc,
à 1 % près), et seulement ensuite note.** Si tu ne peux pas apparier, **dis-le et ne note
pas** — une note fausse est pire que pas de note.

## Le protocole

1. **Deux prises, même lieu, même heure, même cadrage** : `?terre=unique` levé, puis baissé.
2. **Témoin obligatoire** : deux prises du MÊME état doivent différer de **0 pixel**.
   ⚠️ **Le grain de film est ANIMÉ** — deux prises consécutives diffèrent si tu ne le gèles
   pas (deux bancs cassés là-dessus). ⚠️ **Et le canevas de la page a `depth: false`** : un
   rendu vers lui dessine sans profondeur et **un bloc opaque y ressemble à du verre**.
   **Rends dans une cible à profondeur.**
3. **Note sur 10, par critère**, chacun avec sa mesure :

| critère | ce qu'on regarde |
|---|---|
| **Richesse du relief** | le texture shading, l'analyse de crêtes, le grain fin |
| **Palette et contraste** | la rampe, les teintes, la lisibilité des altitudes |
| **Trait et bordure** | courbes de niveau, trait de côte, arêtes du bloc |
| **La mer** | fond, frange côtière, teinte, écume |
| **Les parois et la base** | matière, chanfrein, occlusion de contact |
| **Propreté** | plaques, coutures, clignotement, jupes qui pendent |

4. **Une note globale**, et **la liste ordonnée de ce qui manque le plus** — c'est elle qui
   sert, plus que la note.

## Ce que tu ne dois pas faire

- ⛔ **Ne note pas sur une capture que tu n'as pas prise toi-même.**
- ⛔ **Ne compare pas des cadrages différents.** Voir le piège ci-dessus.
- ⛔ **N'invente aucun chiffre.** ⚠️ **Neuf chiffres ont été retirés par leurs propres auteurs
  sur ce chantier** parce qu'ils ne remontaient à aucune donnée. **Tout ce que tu avances
  remonte à un relevé que tu laisses dans `.banc/`.**
- ⛔ **Ne conclus pas au succès par politesse.** **Six tâches ont écrit « non, ça ne ressemble
  toujours pas au socle »**, et c'est ce qui a rendu leurs rapports utilisables. **Une note
  généreuse ne sert personne.**

## Ce que le chantier sait déjà, et que tu dois pouvoir retrouver ou réfuter

- La Tâche C a mesuré que les quatre postes d'habillage portés **ne déplacent que 1,01 % des
  pixels**, et a écrit : *« ce qui fait la richesse de l'image du socle, c'est le texture
  shading et la rampe locale »*.
- **L'habillage n'était pas portable tant que `terrain.js` était interdit — l'interdiction est
  levée (D13).** Si ta note est basse, **dis PRÉCISÉMENT lequel de ces postes manque**, pas
  « c'est fade ».
