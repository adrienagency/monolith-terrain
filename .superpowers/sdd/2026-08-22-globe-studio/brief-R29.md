# R29 — SORTIR DU CROP À LA MOLETTE. POUR DE BON.

Arbre : `C:\Dev\wt-sor` · branche `sortie-crop` (partie de `regroupement`).
Serveur : `npm run dev` — **port libre au-dessus de 5800**.

## ⛔ DEUX TÂCHES ONT DÉJÀ DÉCLARÉ CE DÉFAUT RÉPARÉ. IL NE L'EST PAS.

> **Adrien, à l'instant :** *« Pourquoi la problématique d'axe de rotation de la
> caméra n'est toujours pas résolue ? »*

Sa règle, écrite ce matin :

> *« Le point d'orbite doit toujours viser le centre de la Terre. Il change
> uniquement quand on passe en mode bloc croppé. **Si on dézoome depuis le mode
> croppé, la caméra revient automatiquement avec une orbite autour du centre de
> la Terre.** »*

⚡ **Le pivot lui-même est réparé** (R27 : l'écart à l'axe passe de 11,366 u à 0
sur 22 jalons). **Ce qui ne l'est pas, c'est qu'on n'atteint jamais l'état où le
pivot doit revenir** : on ne sort pas du crop. La règle est donc invérifiable à
l'usage, et Adrien voit « l'axe pas résolu ».

## LA MESURE, PRISE SUR LE GESTE RÉEL, SUR `regroupement` FUSIONNÉ

Molette et glissés envoyés à la souris, sonde posée **DANS la boucle** en
enveloppant `controls.update` :

```
d      = 150,000   ← controls.maxDistance = 150. On est CONTRE la butée.
altM   = 18 717 m
emprise= 27 354 m
crop   = true      mode = "surface"
```

Puis **huit** `cranZoom(-1)` d'affilée, appelés directement :

| | `d` | altitude | emprise | crop | mode |
|---|---|---|---|---|---|
| avant | **150,000** | 18 717 m | 27 354 m | oui | surface |
| après 8 crans | 73,932 | **17 554 m** ↓ | **54 713 m** | **oui** | surface |

⛔ **Trois faits, et chacun compte :**
1. **Huit crans n'ont avancé que d'UN niveau** (l'emprise double une fois :
   27 354 → 54 713 m). Sept crans sur huit n'ont rien fait.
2. **L'altitude a BAISSÉ** en dézoomant — 18 717 → 17 554 m.
3. **Le crop meurt à `SEUIL_MORT_M = 40 342,8 m`.** On plafonne à 18,7 km, soit
   **46 % du seuil**. Le crop ne peut donc **jamais** mourir à la molette.

Un dézoom continu à la molette (32 crans) ne fait bouger l'altitude que de
**18 201 → 18 325 m**, et `_levelZoom` de 0 à 0,008.

## ⚠️ CE QUE LES DEUX PASSES PRÉCÉDENTES ONT ANNONCÉ — à confronter, pas à croire

- **`rapport-R23.md` §④** : *« 1 500 images, orbite jamais atteinte, budget figé
  à 0,68782 pour 0,69315 ; facteur établi avant de décider — 21,9× (cos 88,2°
  contre cos 46,5°) ; je n'ai touché ni `maxDistance` ni `SEUIL_MORT_M`, le
  correctif est sur le compteur de niveau. Après : 338 images, orbite atteinte,
  12 niveaux. »*
- **`rapport-R27.md` §⑥** : *« j'ai failli attribuer au pivot un déblocage qui
  vient d'ailleurs : `cranZoom` gelait son compteur de niveau au plafond
  (1 174 images bloquées à z8, orbite jamais atteinte) — le §④ de R23 sur le
  chemin qu'elle n'avait pas mesuré, corrigé et testé à part. »*

➡️ **Deux correctifs sur le même compteur, deux « orbite atteinte », et le geste
réel reste bloqué.** Ta première tâche est donc de comprendre **pourquoi leurs
bancs disaient oui**. Trois hypothèses, aucune vérifiée :

1. **Leurs bancs n'appelaient pas le même chemin que la molette.** R23 pilotait
   par API ; la molette passe par `_zoomGesture` / `_applyZoom`, pas forcément
   par `cranZoom`.
2. **Les deux correctifs se sont annulés à la fusion** — ils touchent le même
   compteur, et aucun des deux n'a vu l'autre.
3. **La butée `maxDistance = 150` mord avant le compteur** : une intention de
   dézoom qui ne peut pas s'exprimer en distance est peut-être jetée avant
   d'atteindre le compteur.

⚠️ **Ce dépôt a déjà vu trois audits rendre trois plafonds différents pour la
seule raison que leurs bancs différaient sans le dire.** Écris **en quoi ton banc
diffère du geste réel** avec chaque chiffre. Un relevé qui ne décrit pas son banc
ne se compare à rien.

## ⛔ CE QUE TU NE DOIS PAS FAIRE

**Ne remonte pas `maxDistance` à l'aveugle**, et ne touche pas `SEUIL_MORT_M`
sans avoir écrit le facteur. **La butée est en unités de bloc, le seuil est en
mètres** — c'est la classe de défaut qui est revenue **neuf fois** sur ce
chantier (facteurs attrapés : 121,6 · 10 · 130,4 · 6 · 244, une portée de flou de
1 465 km, des toponymes 1 830 m sous les Alpes, une colonne de nuages sous la
mer). R23 a établi le facteur **21,9×** avant de décider : fais pareil, ou
établis que le sien est faux.

**Écrire `controls.target` est interdit.** `veille-repos.js` surveille
`|Δ ln(distance caméra→cible)|` avec `SEUIL_BOUGE_LOG = 1e-4` ; c'est ce signal
qui arme la bascule de trois quarts de **D16 ter**. R27 a tenu le recentrage à
**0,00000** par l'algèbre `(P+δ)−(T+δ) = P−T`, pas par réglage. Ne dépense pas ça.

## LES INSTRUMENTS QUI MENTENT — chacun a produit un faux constat ici

- ⛔ **Une sonde posée APRÈS la fonction lit un état déjà écrasé.** Une variable
  de budget a rendu **404** là où sa vraie valeur était **0** — plausible, et de
  la mauvaise grandeur. R23 a relevé sa butée à 59,330° sur six mesures à quatre
  lieux : c'était la pose d'ouverture, jamais touchée. **Instrumente DANS la
  boucle**, en enveloppant `controls.update`.
- ✅ **La molette simulée MARCHE** (40/40 mesuré, et je viens de m'en servir).
  L'ancien avertissement contraire est **rétracté** (`lecons-campagne-R.md`). Le
  coupable était le voile d'accueil `.ce-hubveil`, qui mange **tous** les gestes.
  **Ferme-le (Échap) avant tout banc.**
- **Un banc différentiel ne distingue pas « rien n'a changé » de « tout est
  cassé pareil ».** Un agent a cassé la liaison du fragment — plus une tuile
  dessinée — et son banc n'a rien vu. **Lis la console à chaque recompilation.**
- **Un relevé sur UNE image ne prouve rien** si le système oscille : 20 images
  consécutives, et exige la stabilité.
- **La suite de tests peut verrouiller le défaut** : relis les assertions qui
  bordent `cranZoom`, `_applyZoom`, `_levelZoom` et `maxDistance`. R24 en a
  trouvé une qui **exigeait** le défaut.

## LES RÈGLES — dans ce dossier

- **D16 / bis / ter** (`regle-D16.md`) — *« une seule vue qui zoome
  progressivement »*. C'est ta tâche entière, dans le sens du retour.
- **D17** — ⛔ **IL N'Y A PAS DE PRODUCTION.** N'écris jamais « production
  rigoureusement inchangée » en étape de fin : consigne abrogée.

## L'ATTENDU

1. **On sort du crop à la molette**, prouvé par un relevé **sur des événements de
   molette réels** (pas un appel d'API) : une table altitude / emprise / `crop` /
   mode / `_levelZoom` à chaque cran, du bloc jusqu'à l'orbite.
2. **Le nombre de crans nécessaires** pour aller du crop à l'orbite, et il doit
   être raisonnable — aujourd'hui c'est l'infini.
3. **L'altitude monte quand on dézoome.** Aujourd'hui elle baisse ; c'est un
   critère à part entière.
4. **Le pivot revient au centre de la Terre** dès la mort du crop, et **sans
   saut** : position de la Terre à l'écran en pixels sur les images qui encadrent
   la bascule.
5. **`veille-repos` ne voit rien** (`|Δ ln d|` relevé contre 1e-4) et **D16 ter
   tient** (la bascule de trois quarts arrive au bloc, pas avant).
6. **Explique pourquoi R23 et R27 ont conclu que c'était réparé.** Si l'un des
   deux correctifs est à retirer, retire-le et dis-le. C'est un résultat.
7. Des tests. ⚠️ **`package.json` porte une LISTE EXPLICITE de fichiers de
   test** : un test absent ne tourne **jamais**. `npm run audit:tests`, aucun
   écart.
8. `npm test` — **base à battre : 4 641 · 0 échec**.
9. ⚠️ **Scripts d'édition en BINAIRE**, et **relis l'octet écrit**
   (`grep | cat -A`) : **quatre** incidents cette nuit — trois `\b` devenus
   `0x08` et un `\n` devenu retour à la ligne. Une garde en est restée muette
   tout en étant verte.
10. Commits sur `sortie-crop`, messages en français.
11. Rapport `rapport-R29.md` ici, avec une section **« ce que j'ai cru puis
    réfuté »** — sur ce chantier elle n'a **jamais** été vide.

⚠️ **Un agent attaquant travaille en parallèle** dans `C:\Dev\wt-att` : il mesure
le même défaut **sans rien corriger**, pour dire si ton correctif tient. Ne
communique pas avec lui, ne regarde pas sa branche — son indépendance est le
seul intérêt de sa mesure.

Travaille jusqu'au bout, ne pose pas de question : tranche, mesure, corrige.
