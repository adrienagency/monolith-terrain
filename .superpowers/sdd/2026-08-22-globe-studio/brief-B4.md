# B4 — NOTEUR : la bathymétrie mérite-t-elle 7,5 sur 10 ?

Arbre : `C:\Dev\wt-bat4` · branche `bathy-note`. Serveur : port libre **> 6400**.

## ⛔ TON RÔLE : TU NE CORRIGES RIEN. TU NOTES, ET TU DOIS POUVOIR DIRE NON.

> **Adrien :** *« Fais en sorte que toute la zone sous-marine soit le plus juste
> possible. (…) **Note minimale 7,5 / 10.** »*

**Une note complaisante est un échec de ta tâche**, pas un service. Si le
correctif vaut 6, tu écris 6, tu dis exactement ce qui manque pour atteindre
7,5, et le correcteur repart. Si tu ne peux pas mesurer un critère, il vaut
**zéro** — pas « on suppose que ça marche ».

## LE BARÈME — écrit par l'attaquant B1, tu l'appliques TEL QUEL

| # | critère | seuil acquis | pts |
|---|---|---|---|
| 1 | fond en approche (Java z11, lu **au GPU**) | **≤ −6 000 m** (avant : 0,0) | 2,5 |
| 2 | accord globe/crop (mer Noire, 3 altitudes) | **≤ 200 m** aux trois (avant : 2 200) | 2,0 |
| 3 | relief, pas aplat (étendue 9×9) | **≥ 5 m** sur Java z11, mer Noire z11 **et** z12 | 1,5 |
| 4 | cascade vivante sur le globe | **≥ 1** requête `/data/bathy/` dans les **3** zones | 1,5 |
| 5 | mers fermées + Caspienne | Caspienne **≤ −800 m** ; Médit. et mer Noire **≤ 300 m** à z11 **et** z12, **crop compris** | 1,0 |
| 6 | lacs | Baïkal **et** Léman **≥ 100 m sous la surface** | 0,5 |
| 7 | rien payé ailleurs | `npm test` **≥ 4 748 · 0**, audit sans écart, Manche z10 à **−68 ± 5 m** | 1,0 |

⛔ **Règles non négociables du barème :**
- **mesure au GPU uniquement** — `t.heights` côté code est relâché et ment ;
- **valide à z11 ET z12**, pas à l'un des deux ;
- « le globe = le crop » **ne suffit pas** au critère 5 : le crop rend **0 m**
  dans la plaine ionienne, s'aligner dessus n'est pas être juste ;
- **le critère 7 est ÉLIMINATOIRE au-dessus de 6,5** : une régression ailleurs
  plafonne la note à 6,5 quoi qu'il arrive.
- **Barème partiel autorisé** : un critère à moitié tenu vaut la moitié des
  points, **si** tu écris la règle de partage que tu as appliquée.

## CE QUE TU DOIS LIRE

Dans ce dossier : `rapport-B1.md` (l'audit de 25 points, l'état d'AVANT — c'est
ta ligne de base), `rapport-B2.md` (les sources de lacs), `rapport-B3.md` (ce que
le correcteur affirme avoir fait), `socle-bathy.md` (⚠️ il porte **deux
hypothèses du coordinateur que B1 a réfutées** : la version de B1 fait foi).

## ⛔ TU REMESURES TOUT. TU NE RECOPIES AUCUN CHIFFRE DE B3.

C'est le cœur de ta tâche. Sur ce chantier, **des chiffres flatteurs ont été
publiés une dizaine de fois** et démontés ensuite. Ton banc est le tien.

**Attaque en priorité les endroits où un correctif peut tricher :**
1. **Un correctif qui vise le point de mesure et pas le monde.** Les seuils
   nomment Java, la mer Noire, le Léman. **Vérifie sur des points que le barème
   ne nomme PAS** : fosse des Kouriles, plaine abyssale du Cap, mer Rouge,
   Grands Lacs, lac Titicaca. Si ça ne tient qu'aux points nommés, dis-le et
   coupe les points.
2. **Un fond « juste » mais plat.** Le critère 3 existe pour ça — mais mesure
   aussi le **gradient**, pas seulement l'étendue : un escalier de 5 m entre
   deux plateaux passe l'étendue et n'est pas un relief.
3. **Une profondeur juste au GPU mais fausse à l'œil.** Fais **trois captures
   pleine résolution** (une fosse, un plateau, un lac) et compare-les à celles
   de B1. ⚠️ Un condensé annule les motifs fins : pleine résolution.
4. **Un gain payé ailleurs** : temps d'image, requêtes réseau, mémoire. Compare
   avec `scripts/profil-pf1.mjs` si tu peux. Le critère 7 n'est pas qu'un
   `npm test`.
5. **Les 7 tests rouges de B1** (`node --test test/attaque-b1-ROUGE.mjs`,
   serveur sur **6311**) : **relance-les toi-même.** S'ils sont verts parce que
   le test a été modifié plutôt que le code, c'est une fraude — vérifie
   `git diff` sur `test/attaque-b1-ROUGE.mjs` et **dis-le en premier**.

## PIÈGES DE MESURE — ils ont tous produit un faux constat ici

- ⛔ `gl.getError()` peut rendre **0** sur un défaut majeur ; une console propre
  ne prouve rien.
- ⛔ **La table de vérité de B1 donne des PROFONDEURS, pas des altitudes de
  fond** : le lit du Léman est à **+63 m**, pas −310. B1 a failli inverser sa
  conclusion là-dessus.
- **Le pixel n'est déterministe qu'en orbite** ; ailleurs, A/B dans la même
  session (mer, nuages, caustiques déphasés).
- **Vite doit écouter sur `--host 127.0.0.1`**, sinon `[::1]` seul et rien ne
  se dessine.
- **Le voile d'accueil avale les gestes** ; la pose de démarrage arrive après un
  **vol de 8,3 s** ; le globe tourne seul à ~2 °/s.
- ⚠️ **`find public/data/bathy` rend 0** — `find` ne suit pas les jonctions
  Windows. Utilise `find public/data/bathy/8`, qui doit rendre **13 891**.
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**

## L'ATTENDU — un rapport que le correcteur puisse suivre s'il doit repartir

1. **La note sur 10**, critère par critère, avec **ta** mesure (pas celle de B3)
   et le seuil en regard. Le total, et s'il atteint 7,5.
2. **Les écarts entre tes chiffres et ceux de B3**, s'il y en a, avec ton banc
   décrit en une ligne. ⚠️ Un écart n'est pas forcément une fraude : dis lequel
   des deux bancs tu crois, et pourquoi.
3. **Ce qui manque pour atteindre 7,5**, si ce n'est pas atteint : classé par
   points gagnables, avec le geste précis. C'est ce que le correcteur lira.
4. **Ta vérification anti-triche** (points hors barème, gradient, captures,
   `git diff` des tests rouges).
5. `npm test`, `audit:tests`, et **`git diff -- src/` VIDE** : tu ne corriges
   rien. Rapport `rapport-B4.md` (`git add -f`).

**Note honnêtement. Une note de complaisance à 7,5 vaut moins qu'un 6 argumenté.**
