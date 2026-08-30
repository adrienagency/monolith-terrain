# Tâche R10 — la mise au point du flou doit suivre le curseur

**Statut : ARRÊTÉE À L'ÉTAPE 1, ET C'EST LE RÉSULTAT QUE LE BRIEF DEMANDAIT.**
Aucune ligne de `src/` n'a été touchée.

> **La consigne d'arrêt du brief, mot pour mot :** *« ⚠️ Si l'image ne bouge pas,
> la mise au point au curseur serait du polissage sur un effet invisible — dis-le
> et arrête-toi, ce serait le bon résultat. »*

**L'image ne bouge pas.** Sous `?terre=unique`, faire varier `params.focusDistance`
de **0,5 à 400** — d'un extrême à l'autre de la portée utile — change **0 pixel
sur 1 024 000**. Pas un seul, à aucun des sept réglages essayés. Le témoin de la
mesure (deux rendus au même réglage) vaut lui aussi 0 : le compteur est propre,
et il compte zéro. Le même balayage rejoué à la main dans un navigateur ouvert,
à une autre taille de tampon (1 014 × 914 = 926 796 pixels), rend le même zéro.

- Arbre : `C:\Dev\wt-flou`, branche `flou-curseur`, partie de `6157862`
- Tests : **4 293 passent, 0 échec** · audit **221 = 221** — inchangés, et c'est
  attendu : aucun fichier de `src/` n'a été modifié
- Serveur de mesure : `localhost:5535` (5503 non touché)
- Relevés : `traces-R10/flou-focus.json`, `traces-R10/flou-curseur.json` ;
  captures dans le même dossier et dans `.banc/R10/` (⚠️ `.banc/` est gitignoré,
  `.gitignore:44` — les traces qui comptent sont **dans le dépôt**)

**ET LE BRIEF SE TROMPE SUR TROIS POINTS**, dont deux qui auraient fait écrire du
code inutile et un qui aurait fait accuser le mauvais coupable. Ils sont au §2,
§3 et §5, chacun avec sa mesure.

---

## 1. Étape 1 — le flou ne fait plus la mise au point, il barbouille

### La mesure

`scripts/sonde-flou-focus.mjs` (neuf, commité). Chrome sans tête, ANGLE/D3D11,
1280 × 800. Elle allume le bokeh **par l'interrupteur de l'interface**, épingle
l'optique (`bokehScale = 16`, `focusRange = 23` — `main.js` les TIRE AU SORT au
démarrage, sans épinglage les configurations ne compareraient pas la même
optique), coupe le grain, fige l'ambiance, puis balaie `focusDistance` et
**compte les pixels qui changent** par `readPixels`.

⚠️ **Le grain seul mettait 60 % des pixels au-dessus du seuil.** `NoiseEffect`
repose un bruit neuf à chaque rendu : mesuré, le témoin valait **60,273 %** avec
le grain, **0 %** sans. Sans cette coupure, la mesure ne disait rien.

⚠️ **CE BANC MESURE DU PIXEL, PAS DU TEMPS.** L'avertissement de méthode de ce
chantier — « les bancs d'ici mesurent le temps de SOUMISSION CPU » — vise les
mesures GPU et **ne s'applique pas** : ce qui est lu ici est le contenu du tampon
après `composer.render()`, c'est-à-dire le résultat.

### Trois configurations, même caméra (distance 145,50), même optique

Pixels qui changent quand la mise au point quitte 0,5, sur 1 024 000 pixels :

| `focusDistance` | production (aucun drapeau) | `frontiere=1&terre=deux` | **`frontiere=1&terre=unique`** |
|---|---|---|---|
| **TÉMOIN** (même réglage) | 0 | 0 | 0 |
| 100 | 0 | 0 | **0** |
| 130 | 175 049 (17,10 %) | 150 630 (14,71 %) | **0** |
| **142,26** | **248 345 (24,25 %)** | **200 909 (19,62 %)** | **0** |
| 160 | 91 224 (8,91 %) | 98 581 (9,63 %) | **0** |
| 200 | 9 883 (0,97 %) | 45 781 (4,47 %) | **0** |
| 400 | 4 | 2 | **0** |

Les deux premières colonnes dessinent une cloche centrée sur **142,26** — la
distance réelle de la caméra au relief. C'est une mise au point qui fonctionne.
La troisième est **plate à zéro**.

Captures : `traces-R10/production-focus-0_5.png` (bouillie) contre
`production-focus-142_26.png` (relief net, arrière-plan fondu — l'effet qu'Adrien
veut) ; puis `terre-unique-focus-0_5.png` et `terre-unique-focus-142_26.png`,
**qui sont la même image**.

### La cause, établie par une expérience réversible

Sous `?terre=unique`, le compositeur est
`PasseFond → ClearPass → RenderPass → EffectPass(DoF) → EffectPass(finition)`.

1. ① `PasseFond` rend `sceneGlobe` avec **`camGlobe`** — c'est là que vit la
   découpe sphérique, la seule chose que l'utilisateur voit.
2. ② `ClearPass(false, true, false)` **efface la profondeur** (`main.js:4569`).
3. ③ `passeSurface` rend `scene` — où le bloc plat est **éteint** (mesuré :
   `terrain.mesh.visible === false`, contre `true` dans les deux autres
   configurations).

➡️ **Plus rien n'écrit de profondeur sous les pixels de la carte.** Le tampon
vaut 1,0 partout ; le cercle de confusion sature ; le flou devient **uniforme**,
insensible au réglage.

**L'expérience qui le prouve, et elle se rejoue en une ligne** : couper la passe
② (`composer.passes[1].enabled = false`), même image, même caméra (navigateur
ouvert, tampon 1 014 × 914 = 926 796 pixels, `focusRange` posé à 23 pour coller
au banc sans tête) —

| `focusDistance` | avec ② (production du drapeau) | sans ② |
|---|---|---|
| 100 → 200 | **0 pixel** | **257 992 pixels (27,84 %)** |

⚠️ **MAIS « sans ② » N'EST PAS UN CORRECTIF, et il faut le dire tout de suite** :
la réponse y est **rigoureusement constante** (257 992 aux cinq distances 100,
130, 142,26, 160, 200 — le même nombre à l'unité près). La profondeur qui survit
est celle de **`camGlobe`**, dont les plans valent 0,112 / 201,56 quand le
matériau de CoC est réglé sur ceux de `camera` (0,5 / 290). Ça change l'image,
ça ne fait pas le point. **Enlever ② rendrait un défaut différent, pas une mise
au point.**

### Le commentaire du dépôt disait déjà l'inverse de ce qui se passe

`main.js:4502-4507` :

> *« DOF et occlusion ambiante — INCHANGÉS, et c'est arithmétique : ils lisent le
> tampon de profondeur. ② l'efface, donc les pixels du globe y valent 1,0 —
> exactement la valeur qu'y avait le CIEL avant […] Le globe prend la place du
> ciel, à la même profondeur : les deux passes d'écran le traitent donc à
> l'identique. »*

Le raisonnement est juste **tant que le bloc plat est dessiné** : le globe n'est
alors qu'un fond, et le sujet, lui, écrit sa profondeur en ③. Sous
`?terre=unique`, ③ ne dessine plus le sujet — et la phrase « à l'identique »
devient « le sujet est traité comme du ciel ». **C'est une régression de la Tâche
I, pas de la frontière de rendu** : la table ci-dessus le sépare, `terre=deux`
garde ② et garde sa mise au point (19,62 %).

---

## 2. ⛔ Le brief se trompe : la mise au point suit DÉJÀ le curseur, en permanence

> **Le brief :** *« La mise au point existe DÉJÀ, mais au CLIC : `_clickNdc` est
> posé sur un `pointerup` gardé par `isTap` […] L'ÉVÉNEMENT doit changer. »*

**Faux depuis le commit `0cbc647`.** `main.js:12323-12338`, dans `tick()` :

```js
if (params.autoFocus && modes.mode === 'surface') {
  ...
  focusRay.setFromCamera(mouse, camera)
  const hit = focusRayHit(focusRay.ray.origin, focusRay.ray.direction, terrain.sample, {
    halfExtent: TERRAIN_SIZE / 2,
  })
  if (hit != null) params.focusDistance += (hit - params.focusDistance) * Math.min(1, dt * 8)
}
```

`mouse` est posé par le `pointermove` de `window` (`main.js:2566`), qui ne fait
**que** `mouse.set(nx, ny)`. `params.autoFocus` vaut **`true` par défaut**
(`main.js:362`, vérifié à chaud).

**Les deux exigences de qualité « non négociables » de l'étape 4 sont donc déjà
tenues, et mesurées** (`scripts/sonde-flou-curseur.mjs`, neuf, commité) :

| exigence du brief | état mesuré |
|---|---|
| « Ne raycaste pas à chaque `pointermove` » | ✔ l'événement n'écrit qu'un `Vector2` ; la marche de rayon est **dans `tick`**, une fois par image |
| « Lisse la transition, mesure le temps d'amortissement » | ✔ loi `+= écart × min(1, dt × 8)`. **Mesuré** à 16,8–17,1 ms/image : **t63 = 117,1 ms · t90 = 283,4 ms · t95 = 350,5 ms** (valeurs les moins favorables des deux configurations) |
| « curseur hors carte / ciel → garder la dernière mise au point valide » | ✔ `if (hit != null)`. **Mesuré** en production : ciel en haut d'écran, 144,113 → **144,113**, inchangé ; trois points d'écran sur sept ratent le bloc et **tiennent 130,434** |
| « en orbite » | ✔ le bloc entier est gardé par `modes.mode === 'surface'` |
| « le clic fait AUSSI autre chose » | ✔ intact — le chemin du `pointerup` (`main.js:2599-2688`) désigne un lieu et plonge ; il n'a jamais été le chemin de la mise au point |

**Le suivi, mesuré à caméra rigoureusement immobile** (`cameraImmobile: true` aux
sept points, distance caméra constante) :

| position curseur (fraction d'écran) | production | `terre=unique` |
|---|---|---|
| 0,50 ; 0,15 | 142,256 | 30,593 |
| 0,50 ; 0,30 | 159,390 | 27,159 |
| 0,50 ; 0,45 | 144,119 | 24,798 |
| 0,50 ; 0,60 | 134,354 | 22,288 |
| 0,50 ; 0,75 | 130,434 *(raté, tient)* | 21,004 |
| 0,15 ; 0,50 | 130,434 *(raté, tient)* | 19,332 |
| 0,85 ; 0,50 | 130,434 *(raté, tient)* | 30,089 |
| **étendue** | **28,956** | **11,261** |

➡️ **Il n'y a rien à écrire pour l'étape 4.** Le nombre bouge avec le curseur,
sous les deux drapeaux, amorti. Il ne va simplement **nulle part**.

⚠️ **Réserve sur une case du tableau** : sous `terre=unique`, la sonde a trouvé la
caméra à 26,40 (et non 145,50) ; le point d'écran « ciel » y touchait encore du
relief, donc le cas du ciel n'est **prouvé qu'en production**. Le code étant le
même — un seul `if (hit != null)` — l'écart est de couverture, pas de
comportement, mais il est déclaré.

---

## 3. ⛔ Le brief se trompe sur le « piège principal » — et l'erreur va dans le mauvais sens

> **Le brief :** *« `terrain.sample` est le champ de hauteur du BLOC PLAT […]
> invisible […] La mise au point vise donc probablement une géométrie que personne
> ne regarde. Si c'est le cas, c'est le cœur de ta tâche. »*

**La moitié factuelle est vraie, la conclusion est fausse.**

**Vrai, et mesuré** : sous le drapeau, `terrain.mesh.visible === false`, et le
rayon marche bien `terrain.sample`, le champ de ce bloc éteint. Le taux de touche
de la marche vaut **1,000** : le champ est toujours chargé, il rend des valeurs.

**Faux** : ce n'est pas « une géométrie que personne ne regarde ». La caméra de
fond est posée par une **similitude** bloc → globe (`monde/frontiere-rendu.js`,
`poseFond`) : la découpe sphérique est l'image du bloc plat par cette similitude,
bâtie sur le **même MNT**. À l'écran, le rayon **tombe au bon endroit**. Ce n'est
pas la cible qui est fausse, c'est qu'**il n'y a pas de profondeur pour la
recevoir** (§1).

**Ce qui est vrai et qui compte pour la suite — le facteur de la similitude,
résolu sur la pose réelle de `camGlobe`, pas recopié d'un module :**

```
k = 0,0076671        1/k = 130,4
```

Mesuré : l'autofocus remet **23,597** unités de scène pour un sujet qui est à
**0,1809** unité de la caméra qui le dessine réellement. ➡️ **Qui rebranchera la
profondeur du crop devra convertir**, sinon il aura une mise au point fausse d'un
facteur 130 — et une image qui ne changera toujours pas, cette fois pour une
autre raison. **C'est le vrai piège, et ce n'est pas celui du brief.**

---

## 4. Étape 6 — le coût, mesuré, et il ne bloque rien

⚠️ **Et c'est du CPU, ce qui est dit ici exprès.** L'avertissement de méthode du
chantier vise le GPU ; la marche de rayon est du JavaScript pur sur un
échantillonneur de hauteur, **aucune file GPU au milieu** : le temps de pendule
autour de N appels **est** le coût.

20 000 appels, 32 directions balayant l'écran, après chauffe :

| configuration | µs / appel | taux de touche |
|---|---|---|
| production, caméra à 145,50 | **24,74** | 0,313 |
| `terre=unique`, caméra à 26,40 | 1,06 | 1,000 |

**On publie 24,74 µs**, la valeur la moins favorable. À la cadence mesurée
(17,12 ms/image), c'est **0,14 % de l'image**, une fois par image. Le budget
n'est pas le sujet ; l'écart de 23× entre les deux lignes vient de la longueur de
marche (caméra loin, beaucoup de ratés qui vont jusqu'à `maxDist`), et il vaut la
peine d'être connu de qui touchera à `step` / `maxDist`.

---

## 5. ⛔ Le `GL_INVALID_OPERATION` de R5 est réel — et il n'est PAS le coupable

Le brief demandait de « borner le défaut R5 ». Voici la borne, mesurée.

**Le défaut existe, exactement comme décrit** : une erreur `1282`
(`GL_INVALID_OPERATION`) par image composée. Vérifié à chaud :
`composer.inputBuffer.depthTexture === null` (donc un `RENDERBUFFER`
`DEPTH_COMPONENT24`) pendant que `composer.outputBuffer.depthTexture` est une
`DepthTexture` `FloatType` (type `1015`, format `1026`) — un blit de profondeur
entre deux formats différents, refusé.

**Mais il se produit dans LES TROIS configurations, y compris celles où la mise
au point marche parfaitement :**

| configuration | erreurs GL par image | la mise au point marche-t-elle ? |
|---|---|---|
| production | `[1282]` | **oui** — 248 345 pixels |
| `frontiere=1&terre=deux` | `[1282]` | **oui** — 200 909 pixels |
| `frontiere=1&terre=unique` | `[1282]` | **non** — 0 pixel |

➡️ **La profondeur n'est pas « morte » : elle arrive au compositeur.** La phrase
du brief — *« La profondeur n'arrive JAMAIS dans le compositeur — et le flou
d'arrière-plan travaille dessus »* — est **contredite par la mesure**. Le blit
raté n'empêche pas le `DepthOfFieldEffect` de lire une profondeur juste ; c'est
la Tâche R10 qui l'établit, et ça rétrécit le périmètre de la future tâche R5.

⚠️ **Ce qui n'est PAS dit ici** : rien sur le SSAO. Hors périmètre, non mesuré,
aucune affirmation. Le rapport R5 cité par le brief
(`rapport-R5.md` §8bis) **n'existe pas dans cet arbre** — le §8bis n'a donc pas
pu être relu, et les quatre vérifications qu'il contient n'ont pas été suivies
telles quelles. Ce qui est écrit ci-dessus a été remesuré de zéro.

---

## 6. Ce qu'il faudra faire, et ce n'est pas cette tâche

La demande d'Adrien — *« toujours focus à l'endroit où le curseur passe »* — est
**déjà écrite, déjà amortie, déjà bornée aux ratés**. Ce qui manque est
en-dessous. Par ordre de coût croissant, sans en recommander aucune ici :

1. **Faire écrire au crop une profondeur lisible par `camera`.** C'est la voie
   directe, et c'est là que `k = 0,0076671` mord : la profondeur écrite par
   `camGlobe` doit être **reprojetée**, pas seulement conservée.
2. **Ne pas effacer ② quand `terre=unique`**, puis accorder les plans de coupe des
   deux caméras. Mesuré ci-dessus : **seul, ça ne suffit pas** (réponse constante
   à 257 992 pixels).
3. **Piloter le flou sans profondeur** : le `DepthOfFieldEffect` de la
   bibliothèque n'en sait pas faire ; ce serait un autre effet.

⚠️ **Et un préalable qui n'est pas technique :** aujourd'hui, sous
`?terre=unique`, allumer « Flou de profondeur (bokeh) » rend la carte
**illisible** — voir `terre-unique-focus-142_26.png`. Tant que le point 1 ou 2
n'est pas fait, la question « faut-il laisser cet interrupteur allumable sous le
drapeau ? » se pose avant toute finition. Elle est pour Adrien, pas pour moi.

---

## 7. Ce qui a été touché

| fichier | quoi |
|---|---|
| `scripts/sonde-flou-focus.mjs` | **neuf** — le balayage de mise au point, trois configurations, comptage de pixels + captures |
| `scripts/sonde-flou-curseur.mjs` | **neuf** — suivi au curseur, ratés, amortissement, facteur `k`, coût CPU |
| `.superpowers/sdd/.../traces-R10/` | **neuf** — les deux relevés JSON et quatre captures |
| `.superpowers/sdd/.../rapport-R10.md` | ce fichier |

**Rien dans `src/`. Rien dans `test/`. Rien dans `package.json`.** Drapeau levé
comme drapeau baissé, la production est **rigoureusement inchangée** — au sens
strict : aucun octet de code exécuté n'a bougé.

⚠️ **Les deux sondes ne démarrent pas après un `npm ci`** — même réserve que
`scripts/diag-barriere-gpu.mjs` : `puppeteer-core` n'est pas une dépendance
produit. La phrase à rejouer est `npm i --no-save puppeteer-core@25.8.0`.

---

## 8. Réserves

1. **Une machine, un pilote.** Tout est mesuré sur ANGLE/D3D11, Chrome sans tête,
   1280 × 800. Le zéro de la troisième colonne est structurel (un tampon de
   profondeur effacé l'est sur toute machine), mais les nombres de pixels des
   deux autres colonnes sont propres à ce rendu.
2. **Le cas du ciel n'est prouvé qu'en production** (§2, réserve déclarée) : sous
   le drapeau la sonde a trouvé la caméra à 26,40 et le haut d'écran touchait
   encore du relief.
3. **Le tirage au sort du look** (`bokehScale`, `focusRange`, `autoFocus` brassés
   au démarrage) a été **épinglé** dans les sondes. Sans cet épinglage, deux
   exécutions ne comparent pas la même optique — un relevé fait sans lui ne
   vaudrait rien.
4. **Le coût de 24,74 µs/appel n'est pas le coût de l'image** : c'est le coût d'un
   appel dans une boucle serrée, cache chaud. Le coût réel d'un appel par image,
   cache froid, n'a pas été mesuré et serait plus élevé.
5. **`rapport-R5.md` est absent de cet arbre.** Le §5 ci-dessus a été remesuré
   entièrement ; si le §8bis dit autre chose, c'est la mesure qui tranche, mais
   la confrontation n'a pas pu être faite.
6. **Rien n'a été vérifié en mode orbital** : le bloc d'autofocus est gardé par
   `modes.mode === 'surface'`, ce qui a été lu, pas exercé.
