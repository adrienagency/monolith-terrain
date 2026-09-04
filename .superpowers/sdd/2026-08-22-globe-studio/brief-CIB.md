# CIB — LA CIBLE : le centre d'abord, la périphérie en basse définition

Arbre : `C:\Dev\wt-cib` · branche `cible-tuiles`. Serveur : port **> 7500**,
`--host 127.0.0.1`. **Lis d'abord `regle-D22.md`** (dossier sdd) — la demande
d'Adrien, mot pour mot — puis **`rapport-PF2.md`** (la priorité existante),
**`rapport-R37.md`** (le raffinement partiel, livré hier) et `rapport-PF1.md` §②.
**Invoque `/threejs-optimisation`** : elle est écrite depuis ce dépôt.

## LA DEMANDE

> *« Une cible : plus la tuile est proche du centre de l'écran, plus elle est
> prioritaire. (…) Dans un premier temps, charger uniquement une version low def
> sur les tuiles non prioritaires, qui ne se chargent que quand les tuiles
> prioritaires ont totalement terminé leur chargement. »*

## ⛔ CE QUI EXISTE DÉJÀ — ne le refais pas, c'est la sixième fois sur ce chantier

**PF2 a posé la cible** : `_priorite` (`globe.js:7978`), file triée (`8196`),
reclassement par image (`7999`), prélecture au centre (`PRELECTURE_CENTRE`,
`8987`). Mesuré : les 20 premières tuiles arrivées sont **100 % dans le champ**,
la tuile du centre arrive **au rang 0–3** par niveau (avant : rang 84–118 à z10,
**jamais** à z11–z12).

**R37 a posé le raffinement partiel** : les enfants prêts sont dessinés, le
parent ne couvre que **sous les manquants**. ⚡ **Donc une « basse définition »
de périphérie existe peut-être DÉJÀ, gratuitement** — c'est le parent.
⛔ **Mesure-le AVANT d'écrire une seconde mécanique.** Si le parent couvre déjà
la périphérie pendant que le centre charge, le point ② d'Adrien est acquis et il
ne reste que **la barrière ③**.

## CE QUE D22 AJOUTE VRAIMENT — à établir, puis à livrer

1. **La loi de priorité est-elle une vraie cible ?** Lis `_priorite` et
   **trace-la** : priorité en fonction de la distance au centre, en pixels, sur
   une image réelle. Adrien veut une **décroissance continue**. Si c'est un
   seuil binaire (dans/hors d'un disque), c'est à changer ; si c'est déjà
   continu, dis-le avec la courbe.
2. **La barrière d'ordonnancement** — **c'est le cœur, et ça n'existe pas** :
   tant qu'une tuile prioritaire est en vol ou en file, **aucune tuile de
   périphérie ne prend un créneau pour sa version fine**.
3. **Le rayon de la cible** : à partir d'où une tuile est-elle « périphérie » ?
   Ne le pose pas en dur — **dérive-le** (une fraction de la diagonale de
   l'écran, ou le disque qui couvre N % des pixels) et écris la dérivation.

## ⚠️ CE QUI PEUT ANNULER LE GAIN — mesure-le, ne le suppose pas

- **Le vol est plafonné à six créneaux** (`MAX_CONCURRENT`) et le gain de PF2
  est venu de **vider la file, pas du vol** : *« annuler six requêtes ne rachète
  rien ; vider la file rachète tout »*. Une barrière mal posée **laisse des
  créneaux vides** pendant que le centre finit. ➡️ **Mesure le taux d'occupation
  des créneaux**, pas seulement l'ordre d'arrivée. Si la barrière fait tomber
  l'occupation, elle coûte plus qu'elle ne rapporte.
- **La famine** : si le centre ne finit jamais (réseau lent, tuile absente,
  404 de couverture), la périphérie doit quand même finir par se raffiner.
  **Il faut une échéance**, et elle doit être mesurée sur une session où le
  centre échoue.
- **Le pixel n'est déterministe qu'en orbite** : A/B **dans la même session**
  ailleurs.

## LE QUATRIÈME CORRECTIF, DANS TON PÉRIMÈTRE

**Router les descendants d'un 404 vers AWS — 40 % des requêtes** (`rapport-PF2.md`
§5). ⚠️ **Un 404 Mapterhorn n'est PAS une panne** : `dem-source.js` le dit en
toutes lettres, c'est la façon normale de dire « je ne couvre pas ici ». Il ne
faut donc **pas** basculer la source globale — il faut que **les descendants
d'une tuile 404 aillent directement chez AWS** sans repasser par Mapterhorn.
Mesure les requêtes économisées sur une descente.

## LE CRITÈRE — l'expérience d'Adrien, en chiffres

Descente scriptée **z8 → z13**, trois lieux, et un banc **CPU ×4** (le profil dit
que l'image est bornée par le CPU) :

| grandeur | avant | attendu |
|---|---|---|
| **temps jusqu'à la première image nette au CENTRE** | mesuré | **en baisse** — c'est le chiffre d'Adrien |
| rang d'arrivée de la tuile du centre, par niveau | 0–3 | **0–1** |
| **taux d'occupation des six créneaux** | mesuré | **pas de baisse** ⚠️ |
| surface d'écran en retard (p50, p90, max) | R37 : 3,9 % / 0 / 100 | **pas de régression** |
| requêtes et octets par descente | R37 : 610 | **en baisse** (le 404→AWS) |
| famine : centre qui échoue | — | la périphérie se raffine quand même, **échéance mesurée** |
| `_traverse` p50/p99 | 0,4 / 1,4 ms | **pas de régression** |

## PIÈGES — chacun a produit un faux constat ici

- **Un relevé sur UNE image ne prouve rien** (cycle de période 4 documenté) :
  20 images consécutives, stabilité exigée ; et **huit chargements** pour tout
  ce qui dépend du démarrage.
- **Une sonde après la fonction lit un état écrasé** — instrumente **dans**
  `_traverse` et `_pump`, au moment de la décision.
- `getEntriesByType('resource')` plafonne à **250** — protocole CDP.
- **Vite sur `--host 127.0.0.1`** ; le voile `.ce-elemwrap` avale les gestes ;
  la pose de démarrage arrive après un vol de plusieurs secondes.
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**
- ⛔ **Ne tue que TES Chrome sans tête.**

## L'ATTENDU

1. **La courbe de priorité tracée** (avant/après), et le verdict : la cible
   existait-elle déjà ?
2. **La basse définition de périphérie** : acquise par R37, ou à écrire ? Avec
   la mesure qui tranche.
3. **La barrière livrée**, avec le taux d'occupation des créneaux et l'échéance
   anti-famine.
4. **Le 404 → AWS**, requêtes économisées.
5. Le tableau du critère, 3 lieux, CPU ×4, session neuve.
6. Tests inscrits dans `package.json`, `audit:tests` sans écart,
   `npm test` ≥ **4 799 · 0**. ⚠️ Scripts **en binaire**, **relis l'octet écrit**.
7. `rapport-CIB.md` (`git add -f`), avec **« ce que j'ai cru puis réfuté »**.

⚠️ **Deux autres agents tournent** : `C:\Dev\wt-cr1` (sortie du crop, crop dès
**z7** — il change la naissance du crop, donc **le moment où ta cible se
remplit** ; ne touche pas à `modes.js` ni aux seuils) et `C:\Dev\wt-riv3`
(rivières, `water-layer.js` / `overpass.js`). **Ton terrain : `globe.js`
(`_priorite`, `_request`, `_pump`, la file) et `dem-source.js`.** Ne leur parle
pas, ne lis pas leurs branches.

Ne pose pas de question : mesure, tranche, implémente, mesure encore.
