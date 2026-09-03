# GE3 — NOTEUR : la souris est-elle celle de Google Earth ? Sur 10, et 7,5 minimum.

Arbre : `C:\Dev\wt-ge3` · branche `gestes-ge-note`. Commence par
`git merge regroupement`. Serveur : port **> 7000**, `--host 127.0.0.1`.

## ⛔ TON RÔLE : TU NOTES, TU NE CORRIGES RIEN, ET TU DOIS POUVOIR DIRE NON

> **Adrien :** *« Attribue à notre programme exactement les mêmes fonctions à la
> souris que dans Google Earth (clic droit, gauche, roulette), tout doit
> fonctionner pareil. (…) Note avec des agents pour vérifier si tout est ok. »*
> **Note minimale 7,5 / 10.**

Une note de complaisance est un échec de ta tâche. Si ça vaut 6, tu écris 6 et
ce qui manque, classé par points gagnables. `git diff -- src/` reste **vide**.

## CE QUE TU LIS

Dans le dossier sdd : **`rapport-GE1.md`** — la spécification de référence
(Web/Pro, URL), l'état d'AVANT mesuré, et **LE BARÈME que tu appliques**, avec
ses tests rouges `test/attaque-ge-ROUGE.mjs` ; **`rapport-GE2.md`** — ce que
l'implémenteur affirme avoir fait ; `socle-ge.md`, `regle-D19.md`,
`regle-D16.md` ; `rapport-R32.md` et `rapport-R35.md` (les acquis à ne pas
perdre).

⚠️ **GE1 et GE2 ont documenté la référence Google chacun de leur côté, en
aveugle.** Ta première tâche est de **confronter leurs deux lectures des sources
officielles** : là où elles divergent, va lire la source toi-même et tranche
**avec l'URL et la citation**. Deux agents qui lisent la même page peuvent en
tirer deux tables ; le barème ne vaut que si sa référence est la bonne.

## ⛔ LA VÉRIFICATION D'ARBITRAGE — avant d'appliquer le barème

GE2 rapporte deux choses que tu dois vérifier **avant** de noter, parce
qu'elles peuvent fabriquer une bonne note ou une mauvaise :

1. **« La molette : aucune contradiction documentée. »** GE2 affirme que la
   table officielle de Google Earth Web n'a **pas de ligne molette**, et que Pro
   ne décrit que sens et vitesse — donc que « zoome vers le curseur » est
   observé, pas documenté. **Vérifie sur les pages.** Si GE1 a trouvé une ligne
   molette que GE2 n'a pas vue, le barème change.
2. **« Le clic droit glissé horizontal reste inerte, parce que les deux
   documentations sont muettes. »** Ne rien faire là où la doc ne dit rien est
   un choix défendable — **mais un utilisateur de Google Earth, lui, sait ce que
   fait son clic droit horizontal**. Établis-le sur les sources, et si Google
   Earth fait quelque chose d'observable et documenté nulle part, dis-le
   comme un **écart connu**, pas comme un défaut ni comme un acquis.

## CE QUE TU MESURES TOI-MÊME — aucun chiffre recopié

Le même banc que GE1 (geste réel à la souris, sonde **au rendu**, voile fermé
et vérifié, pose de démarrage attendue — vol de 8,3 s, globe gelé ou soustrait),
sur **chaque geste** du barème, à **trois altitudes** (orbite, surface hors crop
~6 000 km, et **sur le crop** — l'exception d'Adrien, où le pivot doit rester
l'axe du bloc). GE2 s'est fait piéger une fois par un prédicat qui supprimait
les boutons du bloc : **vérifie le crop en premier.**

**Anti-triche obligatoire :**
- `git diff` de `test/attaque-ge-ROUGE.mjs` : un test verdi par modification
  du test est une fraude à signaler **en premier** ;
- **des gestes hors barème** : un glissé diagonal, un clic droit pendant une
  inertie, Ctrl+molette, un double-clic sur le crop, un relâchement hors de la
  toile ; si ça ne tient qu'aux gestes nommés, coupe les points ;
- **la non-régression est éliminatoire** (barème GE1) : D19 glissé ≤ 0,2 px,
  centre 0 px, molette ≤ 1,4 px, clic ≤ 1,023 sur huit clics, `|Δ ln d|` <
  1e-4 sur tout geste de pose, D16 ter (0° avant le crop), `npm test` ≥ 4 774 · 0,
  `audit:tests` 254 = 254. **Mesure-la toi-même**, ne la lis pas.

## PIÈGES — chacun a produit un faux constat ici

- **`enableRotate = false` ne neutralise pas le bouton gauche** dans
  OrbitControls : sous Ctrl/Maj, `MOUSE.ROTATE` bascule en PAN, gardé par
  `enablePan`. GE2 l'a payé (`|Δ ln d| = 1,88`, 18 800× le seuil).
- **Enchaîner N gestes mesure leur somme**, pas N gestes. Un geste, une mesure.
- **Une inertie se mesure sur la vitesse ARMÉE**, pas sur une cadence de banc
  irrégulière (GE2 a cru l'avoir cassée).
- **Le voile `.ce-elemwrap`** avale les gestes ; `elementFromPoint` doit rendre
  le `CANVAS`. **Vite sur `--host 127.0.0.1`.**
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**

## L'ATTENDU

1. **La confrontation GE1/GE2 sur la référence**, divergence par divergence,
   tranchée avec URL et citation.
2. **Le verdict sur les deux arbitrages** (molette, clic droit horizontal).
3. **La note critère par critère**, avec **ta** mesure, le seuil, et le total ;
   si < 7,5, **ce qui manque**, classé par points gagnables, avec le geste précis.
4. **Les écarts avec les chiffres de GE2**, et lequel des deux bancs tu crois.
5. **L'anti-triche** : `git diff` des tests rouges, gestes hors barème, crop.
6. **La liste des arbitrages qui reviennent à Adrien** — `PIVOT_VERS_LE_CURSEUR`
   (double-clic vers le curseur chez Google, vers le centre chez D19) en tête,
   avec ce que chaque choix change à l'écran.
7. `npm test`, `audit:tests`, `git diff -- src/` **vide**, `rapport-GE3.md`
   (`git add -f`).

**Note honnêtement. Un 6 argumenté vaut plus qu'un 7,5 de complaisance.**
