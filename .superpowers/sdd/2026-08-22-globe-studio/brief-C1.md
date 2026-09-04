# C1 — D21 : le crop ne meurt plus par l'altitude, et il naît dès z7

Arbre : `C:\Dev\wt-cr1` · branche `crop-intention`. Serveur : port **> 7300**,
`--host 127.0.0.1`. **Lis d'abord `regle-D21.md`** (dossier sdd) — c'est ta
spécification, écrite mot pour mot depuis la demande d'Adrien.

## LES QUATRE DEMANDES

1. **La sortie du crop devient une INTENTION**, jamais un effet de bord de
   l'altitude. Trois sorties, et rien d'autre : le **bouton « map monde »** de la
   barre du haut (`.ce-globebtn`, `ui/bars.js:130`), un **dézoom au clic droit
   maintenu**, un **dézoom à la molette**.
2. ⛔ **L'inclinaison, le cap et les boutons de caméra ne tuent plus le crop**,
   même s'ils font monter l'altitude bien au-dessus de `SEUIL_MORT_M`.
3. **Le crop naît dès z7** (`DIVE_TIERS` : `altM: 600 000`, `modes.js:107`) au
   lieu de `SEUIL_NAISSANCE_M = 32 274,3 m` (z10–z11).
4. **Les rivières sont éteintes par défaut** (l'option reste, la couche reste).

## ⚠️ CE QUI REND ③ DÉLICAT — mesure avant de poser

z7 est **dix-huit fois plus haut** que le seuil actuel, et l'emprise passe
d'environ **27 km à ~438 km**. À chiffrer **avant** de décider :
- le **nombre de tuiles** et le **poids du maillage** du bloc à z7 ;
- le **temps d'image** pendant et après la naissance, sur machine ralentie
  (`scripts/profil-pf1.mjs`, CPU ×4 et ×6) ;
- **D16 ter** : la vue de trois quarts arrive **au bloc**. Si le bloc naît à
  600 km, la vue bascule-t-elle à 600 km ? **C'est probablement indésirable** —
  mesure, et si oui, propose de séparer « naissance du crop » de « bascule de
  trois quarts » (ce sont deux choses que le code confond peut-être) ;
- le **fondu d'estompage** (`ALT_ESTOMPAGE_DEBUT_M = SEUIL_MORT_M`,
  `estompage-terre.js:115`) et les parois du bloc à cette échelle.

⛔ **Si la mesure dit que z7 est intenable, dis-le AVEC LE CHIFFRE et propose le
plus proche tenable.** Ne décide pas seul de rester à z10 : c'est une demande
explicite d'Adrien, et il arbitrera sur ton chiffre.

## ⚠️ UNE LECTURE À CONFIRMER, PAS À DEVINER

« déscroller via le bouton de scroll central » = **la molette**, en dézoom. Le
bouton du **milieu** vient d'être attribué à l'inclinaison et au cap (D19,
GE2/GE3 notés 9,75) ; lui donner aussi la sortie du crop serait contradictoire.
**Implémente la molette, et écris la réserve en tête de ton rapport** pour
qu'Adrien tranche en une ligne s'il voulait dire le bouton du milieu.

## CE QUI EXISTE — vérifie par la mesure, pas par la lecture

- `src/monde/seuil-socle.js` : `SEUIL_NAISSANCE_M` **et** `SEUIL_MORT_M`,
  tous deux dérivés d'`altitudePourFraction` (254, 259).
- `src/monde/estompage-terre.js` : `ALT_ESTOMPAGE_DEBUT_M = SEUIL_MORT_M`.
- `src/monde/exageration-continue.js` : `zoomDepuisAltitude(SEUIL_NAISSANCE_M,
  45°)` rend **exactement** une valeur — un lien à ne pas casser en silence.
- `src/modes.js` : `DIVE_TIERS`, `_franchirSiBesoin`, la porte orbitale.
- `src/monde/veille-repos.js` : `SEUIL_BOUGE_LOG = 1e-4` arme la bascule de
  trois quarts (D16 ter).
- `ui/bars.js:130` : `.ce-globebtn` — le bouton monde.
- La couche d'eau : `src/map/water-layer.js` (`OSM_MIN_ZOOM = 12`).

## LE CRITÈRE — en gestes, pas en altitude

**Chaque ligne mesurée sur huit chargements** (la leçon de toute la campagne
précédente : une passe ne prouve rien, deux bimodalités ont été trouvées ainsi) :

| situation | attendu |
|---|---|
| dans le crop, **incliner** jusqu'à faire monter l'altitude au-dessus de `SEUIL_MORT_M` | **le crop VIT**, `globe._crop` vrai, 8/8 |
| dans le crop, **boutons d'angle de caméra** | le crop vit, 8/8 |
| dans le crop, **dézoom à la molette** | le crop meurt, et **au premier cran franc** |
| dans le crop, **dézoom au clic droit maintenu** | le crop meurt |
| dans le crop, **bouton map monde** | le crop meurt, retour à l'orbite |
| dans le crop, **zoom avant** (molette ou clic droit) | le crop vit |
| descente depuis l'orbite | le crop naît **à z7**, altitude relevée |
| **non-régression** | D19 glissé ≤ 0,2 px, molette ≤ 1,4 px, clic ≤ 1,023, `\|Δ ln d\|` < 1e-4, D16 ter, crop intact (pivot = axe du bloc), `npm test` ≥ 4 799 · 0, `audit:tests` 257 = 257 |

## PIÈGES — chacun a produit un faux constat ici

- **Le voile `.ce-elemwrap`** avale les gestes ; `elementFromPoint` doit rendre
  le `CANVAS`. **Attends la fin du vol de démarrage** — Échap le **fige** où il
  en est, et la pose tombe entre **30,7 et 33,6 km**, à cheval sur le seuil
  actuel : c'est exactement ce qui a masqué une violation de D16 ter une fois
  sur deux.
- **Un geste par chargement** : enchaîner N gestes mesure leur somme.
- **Sonde au rendu**, pas dans `controls.update`.
- **Vite sur `--host 127.0.0.1`.**
- ⛔ **Ne rends JAMAIS la main « en attendant » un banc.**
- ⛔ **Ne tue que TES Chrome sans tête.**

## L'ATTENDU

1. **Les quatre demandes livrées**, chacune mesurée 8/8 selon le tableau.
2. **Le chiffre de z7** : tuiles, maillage, temps d'image à ×4 et ×6, et le
   verdict — tenable ou non, avec la contre-proposition s'il ne l'est pas.
3. **Le départage naissance du crop / bascule de trois quarts**, s'il faut les
   séparer — mesuré.
4. **La réserve sur « bouton de scroll central »**, en tête du rapport.
5. Des tests qui échouent sans le correctif, inscrits dans `package.json` ;
   `audit:tests` sans écart ; `npm test` ≥ **4 799 · 0**.
6. ⚠️ Scripts d'édition **en binaire**, **relis l'octet écrit** (`grep | cat -A`).
   Commits en français, `rapport-C1.md` (`git add -f`), avec **« ce que j'ai cru
   puis réfuté »** — sur ce chantier elle n'a **jamais** été vide.

⚠️ **Un agent lit les rivières en parallèle** (`C:\Dev\wt-riv2`, lecture seule,
il répond à une question d'Adrien sur leur lag). **Le défaut des rivières
t'appartient** (demande ④) — préviens dans ton rapport si tu changes autre chose
que le défaut. Ne lui parle pas, ne lis pas sa branche.

Ne pose pas de question : mesure, tranche, implémente, mesure encore.
