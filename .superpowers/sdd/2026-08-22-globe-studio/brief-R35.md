# R35 — LES DEUX RESTES DE CAMÉRA : `flyTo` → NaN, et le clic qui saute

Arbre : `C:\Dev\wt-cam2` · branche `camera-restes` (partie de `regroupement`,
4 732 · 0, audit 249 = 249). Serveur : port libre **> 5800**.
**Lis d'abord** `plan-fusion.md` (section « 2026-09-03, ~06 h »), `regle-D16.md`,
`regle-D19.md`, `rapport-R32.md`, `rapport-PF4.md` §④, `rapport-PF3.md` (le NaN).

## ① `flyTo` met la caméra à `NaN` — trouvé par PF3, non tracé
Reproduis d'abord (quel lieu, quel mode, quelle altitude de départ), sonde **au
rendu**, puis trace à la ligne : d'où vient le premier NaN (division par une
distance nulle ? `acos` hors [−1,1] ? une pose d'arrivée sans emprise ?). Corrige
à la source, pas par un `isFinite` en aval, et un test qui échoue sans le
correctif. ⚠️ `modes.js` a été réécrit par R32 cette nuit (saisie de la Terre,
rotation rigide) : relis-le, ne te fie à aucun rapport antérieur à R32.

## ② Le clic sur le globe saute — tracé par PF4, à corriger
PF4 : clic 1 → **×4,41 en une image** (60 000 → 13 613 km) parce que
`_posePlongee` (modes.js ~973–977) borne la distance à `surfaceMaxDistance()`
= 150 u (main.js ~6789), abrogeant la continuité ; clics suivants → `diveTo` ne
lisse que 30 % (~1501) puis `_loadDive` repose à `distancePresentation` fixe
(~1529–1533) : les 70 % restants en une image (×1,43–1,45 par clic).
Critère : **aucun rapport de distance > 1,5 entre deux images consécutives** sur
huit clics depuis l'orbite (le même critère que R23 pour la molette), Terre
plantée (centre à l'écran, px), `|Δ ln d|` < 1e-4 hors des poses volontaires,
D16 ter tenu (vue 3/4 au bloc seulement). Google Earth fait foi (D19) : un
double-clic zoome vers le point cliqué, progressivement.

## Pièges — chacun a produit un faux constat ici
Sonde dans `controls.update` = trop tôt (relève au rendu) · le voile
`.ce-elemwrap` avale les gestes (ferme, vérifie) · la pose de démarrage arrive
après un vol de 8,3 s · le pixel n'est déterministe qu'en orbite (A/B en session)
· **ne rends jamais la main en attendant un banc**. Tests : liste explicite de
`package.json`, `audit:tests`. Scripts d'édition en binaire, relis l'octet écrit.
Commits en français, `rapport-R35.md` (`git add -f`), section « cru puis réfuté ».
