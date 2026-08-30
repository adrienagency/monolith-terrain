# D15 — LA PLANÈTE NE DOIT PLUS JAMAIS ÊTRE NUE

> **Adrien, 2026-08-23 :** *« Non, la planète ne doit plus jamais être nue. »*

En réponse à la question posée après l'enquête R6 : *« est-ce que la planète nue
doit rester nue ? »* La réponse est **non, et sans condition**.

---

## CE QUE ÇA ABROGE

Le code portait le choix inverse, écrit noir sur blanc (`globe.js:1743-1744`) :

> *« L'agent noteur, 2026-08-22 : Le socle est un materiau ECLAIRE. La tuile du
> globe est une COULEUR NUE. »*

⛔ **Cette phrase est abrogée.** Elle décrivait un état, elle est devenue une
consigne par accident, et elle a produit le défaut qu'Adrien a filmé :
**treize secondes d'aplat olive sur trente-neuf.**

## CE QUE ÇA N'ABROGE PAS

⚠️ **D15 ne dit pas « allumer les sept interrupteurs ».** Les sept ne sont pas de
même nature, et les confondre ferait échouer la tâche. Départage établi :

### Ce qui PEUT être global — la donnée existe déjà par tuile

| poste | pourquoi c'est possible |
|---|---|
| **la normale par fragment** | chaque tuile porte **sa propre** texture de hauteur (256²), déjà lue par le fragment (`globe.js:1211-1227`) |
| **le peigne de crêtes** (`uTexShade`) | se calcule depuis cette même texture de hauteur |
| **le correctif du zéro** (`uMerZeroSousEau`) | un test de comparaison, **aucune donnée requise** |
| **la rampe de couleur** | `uRamp` est **déjà** global |

### ⛔ Ce qui NE PEUT PAS être global tel quel — la donnée n'existe que sur le crop

`uCoastMask`, `uSol`, `uAnalysis` sont **une seule texture cuite sur l'emprise du
crop**. Elles ne couvrent **pas** la planète. Les allumer hors du crop ferait lire
un masque hors de son domaine — donc du bruit, ou pire, un motif répété.

➡️ **La bonne lecture de D15 : rendre la planète ÉCLAIRÉE et RELIEFÉE partout.
Pas : plaquer les habillages du crop sur toute la Terre.**

⚠️ **Si l'exécutant trouve que ce départage est faux, c'est lui qui a raison
jusqu'à preuve du contraire** — quinze sur quinze sur ce chantier.

---

## LE COÛT, ET C'EST LA VRAIE QUESTION

La normale par fragment et le peigne de crêtes tournent aujourd'hui sur
**36 tuiles** (le crop seul, mesuré). Les rendre globaux les fait tourner sur
**tout ce qui est traversé** — mesuré à **283 tuiles en orbite** (z2→z13).

⚡ **CETTE FOIS, LE COÛT EST MESURABLE, ET LA MÉTHODE EXISTE** — `rapport-R2.md` :
rendu piloté au lieu de subir la boucle, `gl.finish()` aux deux bouts,
**40 rendus de chauffe jetés après chaque recompilation** (sans eux la première
mesure vaut ×6), ordre des variantes tournant, différences appariées.
Elle a rendu **±0,034 ms/image** sur la réfraction, après que **huit rapports
d'affilée** eurent déclaré ne pas savoir chronométrer un rendu.

⛔ **Une tâche D15 qui ne chronomètre pas est une tâche non finie.** Si le coût
est réel, la sortie n'est pas « tant pis » : c'est **une atténuation par
distance** — le relief fin près de la caméra, dégradé au loin, ce que le globe
fait déjà pour les courbes de niveau via `minFade` (`globe.js:1972-1976`).

---

## CE QUE ÇA CHANGE POUR LA TÂCHE R4

R4 lisse la **naissance du crop**. D15 supprime la plus grosse partie de ce qu'il
y avait à lisser : si la planète est éclairée des deux côtés du seuil, **le saut
de style disparaît de lui-même**, et il ne reste à fondre que **la géométrie du
bloc** (la découpe, les parois).

⚠️ **Les deux autres défauts de R4 sont INDÉPENDANTS de D15 et restent entiers** :
le **saut de pose de la caméra** (verticale → rasante, filmé entre t23 et t26) et
**la surcouche sombre qui assombrit le DOM**.
