# RIV-C — LES RIVIÈRES : ne plus attendre un service qui ne répond pas

Arbre : `C:\Dev\wt-riv3` · branche `riv-correctif`. Serveur : port **> 7400**,
`--host 127.0.0.1`. **Lis d'abord `rapport-RIV.md`** (dossier sdd) — c'est le
diagnostic mesuré, ton point de départ, et il contient déjà tes chiffres d'avant.

## LE DÉFAUT, MESURÉ

Sous 24 km, la couche d'eau appelle Overpass. **Depuis cette machine
`overpass-api.de` ne répond jamais** (expiration à 12,1–12,8 s). Session neuve,
vol sur le Rhône, les quatre reconstructions :

| # | durée | produit |
|---|---|---|
| 1 | **6 009,9 ms** | **rien** |
| 2 | **7 715,5 ms** | **rien** |
| 3 | 45,8 ms | rien |
| 4 | 334,1 ms | les rivières Natural Earth (**locales, disponibles depuis le début**) |

**13,7 s d'attente à vide, puis 380 ms pour dessiner ce qu'on avait déjà.**
Réseau **97,3 %** · décodage 2,3 % · géométrie **0,02 %**.
La ligne qui bloque : `src/map/water-layer.js:567` —
`await Promise.all([fetchOverpassLines, fetchOverpassAreas])`.
L'attente est `OVERPASS_ATTENTE_MS = 6000` (`src/map/overpass.js:134`).

⚠️ **Et ce que le diagnostic ne dit pas, que j'ai vérifié moi-même** :
`overpass-api.de` → **rien en 14 s** ; **`overpass.kumi.systems` → 200 en 4,5 s**.
Un miroir répond. **Vérifie-le toi-même avant d'en faire quoi que ce soit**, et
regarde s'il y en a d'autres (`overpass.osm.ch`, `maps.mail.ru/osm/tools/overpass`).

## LES TROIS CORRECTIFS, DANS CET ORDRE

**① Dessiner Natural Earth AVANT d'attendre Overpass — le gros du gain (≈ 13,3 s).**
Le repli existe, il marche, il est **local** : il doit peindre **tout de suite**,
et Overpass, s'il arrive, **remplace** ensuite. C'est un changement d'ordre, pas
de mécanique. ⚠️ Le remplacement ne doit pas faire clignoter : mesure les pixels
entre les deux états, et si le saut se voit, fonds-le.

**② Partager l'échéance entre reconstructions (≈ 7,7 s).**
La deuxième reconstruction rouvre **un budget de 6 s sur une requête déjà en
vol**. Une seule échéance par emprise, partagée ; une reconstruction qui arrive
pendant l'attente **hérite** de ce qui reste, elle ne redémarre pas le compteur.

**③ Le disjoncteur, plus tôt et mieux.**
Il se ferme aujourd'hui **après** avoir payé deux attentes pleines. Après un
échec réseau franc (pas un 404, pas un « pas de données »), **la deuxième
tentative ne devrait pas coûter 6 s**. Et si un miroir répond, un basculement de
serveur vaut mieux qu'un abandon — **mais mesure-le, et garde le repli local
comme premier rendu de toute façon** : un miroir peut tomber demain.

⛔ **Ce que tu ne fais PAS** : baisser `OSM_MIN_ZOOM` (piège chiffré : ça
étendrait l'attente à **tous** les zooms) · un Worker pour la géométrie d'eau
(l'A/B la plafonne à **+72 ms**, ça ne vaut pas le chantier) · toucher au reste
de la couche.

## ⚠️ CE QUI EST DÉJÀ RÉFUTÉ — ne le repars pas

- **Les rivières ne sont PAS la cause de la saccade.** A/B allumées/éteintes :
  plus longue tâche 275 vs 203 ms, fil bloqué **887 vs 894 ms** (−7 ms), image
  p99 20,1 vs 22,4. **Seuls +72 ms leur sont imputables.** La saccade appartient
  au globe qui maille son relief (tâche unique de **1 627 ms**, 688 requêtes,
  88 Mo dans la même fenêtre). ⛔ **N'annonce aucun gain de fluidité.**
- **La couche ne se reconstruit pas à chaque emprise** : six gestes enchaînés →
  **2 reconstructions** (le gel de carte coalesce).
- `densifyWorld` / `drapeWorld` **ne sont appelés par personne**.

## LE CRITÈRE — en secondes jusqu'au premier trait d'eau

**Session neuve à chaque mesure** (le disjoncteur fausse tout : il se ferme 60 s
et rend l'application rapide — c'est pourquoi le défaut est insaisissable), sur
**trois lieux** (Rhône, un delta, un désert) et **deux zooms** :

| grandeur | avant | attendu |
|---|---|---|
| **délai jusqu'au premier trait d'eau dessiné** | ~13,7 s | **< 1 s** |
| durée des reconstructions à vide | 6 010 + 7 716 ms | mesuré |
| plus longue tâche unique **imputable à l'eau** (A/B) | +72 ms | **≤ +72 ms** |
| requêtes et octets par arrivée | mesuré | **pas de régression** |
| pixels d'eau dessinés une fois stabilisé | mesuré | **identiques** (le repli local rend la même chose qu'avant) |

## PIÈGES

`getEntriesByType('resource')` plafonne à **250** — compte au protocole CDP ·
**sonde dans la boucle**, pas autour · **Vite sur `--host 127.0.0.1`** · le voile
`.ce-elemwrap` avale les gestes · ⛔ **ne rends JAMAIS la main en attendant un
banc** · ⛔ **ne tue que TES Chrome sans tête**.

## L'ATTENDU

1. Les trois correctifs, avec le tableau du critère, **session neuve**, 3 lieux
   × 2 zooms.
2. **L'état du miroir** vérifié par toi, et ta recommandation (basculer ou non),
   avec le risque écrit.
3. Des tests qui échouent sans le correctif, inscrits dans `package.json` ;
   `audit:tests` sans écart ; `npm test` ≥ **4 799 · 0**.
4. ⚠️ Scripts d'édition **en binaire**, **relis l'octet écrit** (`grep | cat -A`).
   `rapport-RIV-C.md` (`git add -f`), avec **« ce que j'ai cru puis réfuté »**.

⚠️ **Deux autres agents tournent** : `C:\Dev\wt-cr1` (règles de sortie du crop,
crop dès z7, **le défaut des rivières lui appartient** — ne touche pas au
`params` par défaut) et `C:\Dev\wt-cib` (priorité des tuiles, `globe.js`). **Ton
terrain : `src/map/water-layer.js` et `src/map/overpass.js`.** Ne leur parle pas.

Ne pose pas de question : mesure, corrige, mesure encore.
