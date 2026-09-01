# R30 — ATTAQUANT : la chaîne caméra tient-elle, du geste réel jusqu'à l'orbite ?

Arbre : `C:\Dev\wt-att` · branche `attaque-camera` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5900**.

## ⛔ TON RÔLE : TU NE CORRIGES RIEN. TU DÉMONTRES QUE C'EST FAUX.

Trois tâches ont travaillé la caméra cette nuit et **chacune a déclaré son
périmètre réparé**. Adrien vient d'écrire :

> *« Pourquoi la problématique d'axe de rotation de la caméra n'est toujours pas
> résolue ? »*

⚡ **Quelqu'un s'est trompé, et les rapports ne le disent pas.** Ta tâche est de
trouver où, en mesurant **comme un utilisateur**, pas comme un banc.

⛔ **Tu ne commites aucun correctif de comportement.** Tu peux écrire des sondes,
des scripts de banc et des tests. Si tu trouves un défaut, tu le **prouves** ;
tu ne le répares pas. Un agent corrige en parallèle dans `C:\Dev\wt-sor` :
**ne lis pas sa branche, ne lui parle pas** — ton indépendance est tout ce que
vaut ta mesure.

## LES TROIS AFFIRMATIONS À ATTAQUER, TEXTUELLEMENT

**① `rapport-R23.md`** — le geste et le sol :
> *« Rapport maximal entre images consécutives au franchissement : ×1,0000 avant
> comme après sur la descente réelle (1 810 puis 1 809 images). »*
> *« −11,8422 u avant (…) → −0,9577 u après, 12 images sur 7 569 (0,16 %). »*
> *« Après : 338 images, orbite atteinte, 12 niveaux. »*

**② `rapport-R27.md`** — le pivot :
> *« Pire écart avant : 11,366 u (…) APRÈS : 0 »* sur 22 jalons.
> *« Retour isolé : 12,72 u ramenés à exactement 0 en 89 images, saut max
> 4,076 px, 0 bascule de `veille-repos`. »*
> *« `ZOOM_PALIER_MIN` : 3 → 4. »*

**③ `rapport-R26.md`** — la porte du banc :
> *« Les 45 s n'achetaient rien : 0 tuile arrivée, 0 requête, `tuilesEnVol` max 0. »*

## CE QUE J'AI DÉJÀ MESURÉ, ET QUE TU DOIS D'ABORD REPRODUIRE

Sur `regroupement` fusionné, molette et glissés **envoyés à la souris**, sonde
**dans la boucle** (`controls.update` enveloppé) :

```
d = 150,000 = controls.maxDistance   ← contre la butée
altM = 18 717 m      emprise = 27 354 m      crop = true      mode = "surface"
```

Puis huit `cranZoom(-1)` : emprise **27 354 → 54 713 m** (un seul niveau pour
huit crans), altitude **18 717 → 17 554 m** (elle **baisse**), crop **toujours
vivant**. Le crop meurt à `SEUIL_MORT_M = 40 342,8 m` : on plafonne à **46 %**.

Un dézoom continu de 32 crans à la molette : altitude **18 201 → 18 325 m**,
`_levelZoom` de 0 à 0,008.

⚠️ **Reproduis-le d'abord.** Si tu ne le reproduis pas, **c'est MOI qui ai tort**
et c'est le résultat le plus utile que tu puisses rendre — dis-le en premier,
avec en quoi ton banc diffère du mien.

## LES QUESTIONS, PAR ORDRE DE VALEUR

1. **Pourquoi les bancs de R23 et R27 disaient-ils « orbite atteinte » ?**
   Hypothèses non vérifiées : leurs bancs pilotaient par API et la molette passe
   par `_zoomGesture` / `_applyZoom` sans passer par `cranZoom` ; ou leurs deux
   correctifs sur le **même compteur de niveau** se sont annulés à la fusion ; ou
   la butée `maxDistance` jette l'intention avant le compteur.
   ➡️ **Chiffre le chemin réellement emprunté par un cran de molette**, fonction
   par fonction.
2. **Le pivot revient-il au centre de la Terre à l'usage ?** R27 le prouve sur
   une descente scriptée. **Fais le trajet inverse, à la main** : crop → dézoom →
   orbite, et relève `controls.target` à chaque étape. S'il ne revient jamais
   parce qu'on ne sort pas du crop, **dis-le comme ça** : le correctif est juste,
   la règle est invérifiable.
3. **Le sol tient-il ?** R23 annonce 12 images sur 7 569 sous le terrain.
   **Cherche le contre-exemple** : montagne (Mont-Blanc, Cervin, Everest), butée
   polaire, vue de trois quarts, changement de bloc.
4. **Le geste est-il continu ?** R23 annonce ×1,0000 entre images consécutives.
   **Attaque les latitudes** : il a lui-même trouvé ×2,027 à 80° et ×3,367 à 84°
   avant correction. Va voir 85°, 88°, et les pôles.
5. **Reste-t-il le saut ×1,156 au changement de bloc** que le dossier déclare
   ouvert ?

## LES INSTRUMENTS QUI MENTENT — chacun a produit un faux constat ici

- ⛔ **Une sonde posée APRÈS la fonction lit un état déjà écrasé.** Une variable
  de budget a rendu **404** là où sa vraie valeur était **0** — plausible, et de
  la mauvaise grandeur. R23 a relevé une butée à **59,330° sur six mesures à
  quatre lieux** : c'était la pose d'ouverture, jamais touchée. **Instrumente
  DANS la boucle.**
- ✅ **La molette simulée MARCHE** (40/40, et je viens de m'en servir). L'ancien
  avertissement contraire est **rétracté**. Le coupable était le voile d'accueil
  `.ce-hubveil`, qui mange **tous** les gestes — **ferme-le (Échap) d'abord**.
- **Le lieu de départ est PLAT** : un défaut de sol y est structurellement
  invisible.
- **Le globe tourne tout seul** à ~1,88–2 °/s après 3 s d'inactivité.
- **Un relevé sur UNE image ne prouve rien** si le système oscille : 20 images
  consécutives, exige la stabilité. Ce dépôt a déjà vu un cycle de **période 4**.
- **R23 a mesuré la LATITUDE en croyant mesurer l'inclinaison** (21,26°).
  Vérifie la grandeur que tu lis, pas seulement sa valeur.
- ⚠️ **Le barème des mesures de ce dépôt est partiellement sous le bruit** :
  R21 a établi un transitoire de **~0,17 / 0,33**, une mesure sur douze, cause
  non identifiée. **Entre 0,06 et 0,19, un relevé unique ne décide de rien.**
- **Un banc différentiel ne distingue pas « rien n'a changé » de « tout est cassé
  pareil »** — un agent a cassé la liaison du fragment sans que sa mesure le
  voie. **Lis la console.**

## CE QUI FAIT UN BON RAPPORT D'ATTAQUANT

⛔ **Une affirmation réfutée vaut plus qu'une confirmée.** Sur ce chantier,
l'exécutant qui mesurait a eu raison contre le coordinateur **dix-neuf fois sur
dix-neuf**, et la section « ce que j'ai cru puis réfuté » n'a **jamais** été vide.

Pour chacune des cinq questions, rends **l'un des trois** :
- ✅ **tient** — avec le contre-exemple que tu as cherché **et pas trouvé**, décrit
  précisément (« j'ai essayé X, Y, Z ») ;
- ⛔ **faux** — avec la reproduction, les chiffres, et le banc décrit ;
- ⚠️ **indécidable** — avec ce qui manque pour trancher. C'est un résultat.

⛔ **N'écris pas « probablement ».** Mesure, ou déclare indécidable.

## LES RÈGLES — dans ce dossier

- **D16 / bis / ter** (`regle-D16.md`) — la règle attaquée.
- **D17** — ⛔ **IL N'Y A PAS DE PRODUCTION.**
- `plan-fusion.md` — l'état courant. `lecons-campagne-R.md` — dont la
  **rétractation** en fin de fichier : un faux constat y a survécu à quatre
  tâches parce qu'il avait l'air d'une leçon durement acquise. **Ta tâche est
  d'empêcher le prochain.**

## L'ATTENDU

1. Les **cinq questions tranchées**, chacune ✅ / ⛔ / ⚠️, avec les chiffres et
   **le banc décrit** — en quoi il diffère du geste d'un utilisateur.
2. **La reproduction de ma mesure**, ou sa réfutation.
3. Des tests **qui échouent aujourd'hui** pour chaque défaut confirmé — c'est ta
   livraison, pas le correctif. ⚠️ Marque-les clairement comme attendus rouges,
   **et ne les ajoute PAS à la liste de `package.json`** : ils feraient tomber la
   suite. Donne la commande pour les lancer à la main.
4. `npm test` — **la base doit rester 4 641 · 0 échec** ; `npm run audit:tests`
   sans écart.
5. ⚠️ **Scripts en BINAIRE**, et **relis l'octet écrit** (`grep | cat -A`) :
   quatre incidents cette nuit, dont une garde restée muette tout en étant verte.
6. Commits sur `attaque-camera`, messages en français.
7. Rapport `rapport-R30.md` ici.

Travaille jusqu'au bout, ne pose pas de question. **Cherche à avoir tort sur mes
chiffres — c'est ce pour quoi tu es là.**
