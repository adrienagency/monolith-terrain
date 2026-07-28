# Démarrage — rapport de mesure et plan

**Date** : 2026-07-28
**Branche** : `demarrage-fluide` (worktree `C:\Dev\monolith-demarrage`, jamais poussée)
**Demande d'Adrien** : « l'accès à la page de démarrage le plus rapidement et sans lag », puis, à la question *plus court ou plus fluide ?* — « **être plus fluide et agréable** ».

---

## Le résultat en une phrase

**Le démarrage n'était pas lent, il était ARRÊTÉ.** Sur les ~7 s qui séparaient le premier octet de la carte, **1 760 ms d'un seul tenant ne produisaient pas une seule image** — écran strictement immobile, planète du chargement à l'arrêt. Ce n'était ni le réseau, ni le JavaScript : c'était le pilote graphique qui compilait les shaders sur le fil principal, au premier dessin. **C'est livré et corrigé** : le pire gel passe à 354 ms et la carte apparaît à 3 873 ms au lieu de 7 129 ms.

| cache froid, build de prod, réseau neutralisé | avant | après |
|---|---:|---:|
| **plus long gel visuel** (aucune image produite) | **1 760 ms** | **354 ms** |
| gel visuel cumulé | 2 742 ms | 705 ms |
| trous dans le flux d'images | 4–5 | 2 |
| carte visible | 7 129 ms | 3 873 ms |

---

## 1. Comment j'ai mesuré, et ce que je n'ai PAS pu mesurer

Harnais dans `%TEMP%\claude\…\scratchpad\demarrage\` : `probe.cjs` (instrumentation injectée avant le premier octet), `mesure.mjs`, `profil.mjs` (profil CPU V8), `tranches.mjs`, `film.mjs`, `vue.mjs`.

- **Chrome réel, avec écran, jamais headless.** Headless bascule sur SwiftShader et tout chiffre de shader serait faux. GPU relevé : `ANGLE (NVIDIA GeForce RTX 3080, D3D11)`, `KHR_parallel_shader_compile` **disponible**.
- **Cible « ressenti » : `Page.screencast`.** Le navigateur ne livre une image que lorsque le compositeur en produit une. **Un trou dans le flux est une preuve directe d'écran figé** — pas une inférence depuis le fil principal. C'est la mesure qui parle de ce que voit Adrien.
- Quatre bases séparées : production `shibumap.com` (3 runs froid, 3 runs chaud), build de prod servi en local (réseau ≈ 0), serveur de dev (noms de fonctions lisibles), portable simulé.

### Ce que je n'ai pas pu mesurer — dit franchement

1. **Le circuit graphique du vieux portable d'Adrien.** CDP sait brider le **processeur**, pas le GPU. Toute la partie « taux de remplissage » de son problème reste donc **non mesurée** — je dis plus bas ce qui est factuel et ce qui est hypothèse.
2. **La compilation des shaders programme par programme.** J'ai relevé le `#define SHADER_NAME` de three, mais le **premier** appel bloquant paie tout l'arriéré du pilote : lui attribuer 1 878 ms serait faux. Seul l'agrégat est solide.
3. **Un vrai réseau de visiteur.** Tout est en fibre depuis Paris. Le DNS mesuré (§2) dépend du résolveur.
4. **Le cache chaud en local reste inexpliqué.** Sur `shibumap.com`, un profil chaud divise le blocage GPU par 5 (3 440 → 692 ms). Sur `localhost`, le même protocole ne donne **aucun** gain (gel 1 821 ms contre 1 760 ms à froid). Je n'ai pas d'explication vérifiée — je le signale plutôt que d'inventer.

### Deux fois où j'allais écrire une fausseté

- **CDP m'a fait croire que les sondes de couverture DEM prenaient 3,5 s** (`net::ERR_ABORTED`, 6 requêtes). Le *resource timing* de la page dit **73 ms**. Le `ERR_ABORTED` est le comportement normal d'un `HEAD`. **La sonde de couverture n'est pas un problème.**
- **J'ai d'abord comparé mon correctif à un build de `C:\Dev\monolith-terrain`**, qui porte le travail non commité d'une autre session (`water-layer.js`). La « régression de la mer » que je croyais avoir introduite venait de là. Refait contre un worktree propre sur `f210caf` : **mon correctif ne change rien** (§4).

---

## 2. La séquence réelle sur shibumap.com (3 runs, médiane)

| jalon | froid | chaud |
|---|---:|---:|
| DNS | **1 037** | 0 |
| TTFB | 1 114 | 25 |
| **First Contentful Paint** (l'écran de chargement) | **1 420** | **116** |
| bundle `main.js` reçu (552 Ko gzip) | 1 462 | cache |
| tuiles d'altitude z12 demandées | 6 238 | ~1 700 |
| LCP | 6 604 | 2 532 |
| **carte visible** | **8 900** | **3 567** |
| **temps de blocage total (TBT)** | **5 390** | **2 178** |
| **plus longue tâche** | **3 984** | **1 444** |
| `getProgramInfoLog` cumulé (blocage pilote) | **3 440** | 692 |
| requêtes / octets | 96 / 8,2 Mo | 96 / ~1,6 Mo |

**L'écran de chargement lui-même est très rapide** : peint à 1,4 s à froid, 116 ms à chaud. Il n'est pas le problème — il est la seule chose qui marche bien.

**Le DNS à 1 037 ms** est le tiers du chemin critique à froid. C'est de l'environnement, pas du code ; je le note sans en faire un poste d'optimisation.

---

## 3. Où passait vraiment le temps (profil CPU, tranches de 250 ms)

Build de prod local, cache froid. Le fil principal est occupé à **100 %** de 0 à ~4 s.

```
   0– 500 ms  analyse + évaluation du bundle
 500–1000 ms  noise.js — relief PROCÉDURAL, jeté dès l'arrivée du MNT
1000–1500 ms  cloud-volume.js — bakeCloudVolume, 64³ Perlin-Worley sur le CPU
1750–4250 ms  ############ 2 500 ms de compilation de shaders, BLOQUANTE ############
4250–5000 ms  three (rendu) + reste de compilation
5250–6250 ms  construction du relief RÉEL (noise, rebuild)
      7 129   carte visible
```

Postes mesurés (serveur de dev, temps propre) : `noise.js` **798 ms**, `cloud-volume.js` **434 ms** (`bakeCloudVolume` 460 ms tout compris), constructeur `Terrain` **515 ms**, `fx-thumbs.js` ~**200 ms**.

### Le gel dominant, et sa mécanique exacte

Pile capturée sur le serveur de dev :

```
getProgramInfoLog < onFirstUse < WebGLProgram.getUniforms < setProgram
  < renderBufferDirect < renderObject < renderScene < WebGLRenderer.render
  < RenderPass.render
```

Dans `three/src/renderers/webgl/WebGLProgram.js` : `gl.linkProgram()` rend la main tout de suite, mais `onFirstUse()` — déclenchée par `getUniforms()` **à la première image qui utilise le matériau** — appelle `gl.getProgramInfoLog()`, et **cette requête bloque jusqu'à la fin de la compilation**. Tout l'arriéré se paie d'un coup, sur le fil principal.

### La piste évidente, essayée et rejetée avec des chiffres

`renderer.debug.checkShaderErrors = false` est le correctif d'une ligne que tout le monde propose. **Il ne gagne rien.** En neutralisant `getProgramInfoLog`/`getShaderInfoLog` (A/B, 2 runs chacun) :

| | gel total (TBT) | plus longue tâche | où bloque-t-on |
|---|---:|---:|---|
| base | 5 724 ms | 4 185 ms | `getProgramInfoLog` 3 469 ms |
| infoLog neutralisé | 5 604 ms | 4 101 ms | `getProgramParameter` **3 372 ms** |

Le gel se **déplace**, il ne disparaît pas. Ce n'est pas la vérification d'erreurs qui coûte, c'est la compilation. On perdrait toutes les erreurs GLSL pour zéro milliseconde.

---

## 4. Ce qui est LIVRÉ

`src/warmup.js` (+ `test/warmup.test.js`, 9 tests) et 2 points d'accroche dans `src/main.js`. Commit `c0d9599`.

`renderer.compileAsync()` fait le même travail **sans bloquer** : il sonde l'état via `KHR_parallel_shader_compile`. Le pilote compile sur ses propres fils pendant que le fil principal reste libre — les tuiles d'altitude arrivent et le relief se construit pendant ce temps. Le premier **dessin** attend que les programmes soient prêts ; la toile est de toute façon cachée sous l'écran de chargement.

**Vérifié à l'écran, worktree propre contre worktree propre, 3 runs chacun :** même lieu (La Réunion z12), même MNT 1536², même maillage (591 361 sommets), même cadrage isométrique, mêmes uniformes (`uSeaY`, `uSeaRange`, `uHeightContrast`, `uHeightPivot`), même masque de côte. **Rien ne bouge d'un pixel.**

**Deux pièges payés, écrits dans le code :**

1. **Différer `tick()` en entier casse la carte.** La vue isométrique d'ouverture ne partait plus (`applyIsoView` passe par un tween que plus personne n'avançait) : la carte démarrait plus vite **et fausse**. Seul le **dessin** doit attendre, jamais la logique.
2. **Compiler contre le canevas plutôt que contre le tampon HDR gaspille 9 programmes** (les clés de programme de three portent l'espace colorimétrique de sortie). En visant `composer.inputBuffer` : 3 au lieu de 9, à fluidité identique.

Préchauffer aussi la chaîne de post-traitement a été essayé : **aucun gain** (354 → 363 ms). Écarté, et la raison est dans le module.

`npm test` : **940 / 940** sur la branche (931 à `f210caf` + 9). `npx vite build` : vert.
*Note : les « 993 tests » du brief incluent le travail non commité de l'autre session.*

---

## 5. Le vieux portable Windows

Simulation : bridage processeur **6×**, 1920×1080 à **150 %** de mise à l'échelle.

| | carte visible | pire gel | toile | palier |
|---|---:|---:|---|---:|
| base | **22 718 ms** | 1 746 ms | 3840×2160 | **0** |
| avec préchauffage | 21 382 ms | **356 ms** | 3840×2160 | 0 |
| demi-résolution (test) | 20 971 ms | 366 ms | 1920×1080 | 0 |

**Trois faits mesurés :**

1. **Le chargement est limité par le processeur, pas par le remplissage.** Diviser la résolution de rendu par deux ne change que **2 %** du temps d'affichage (20 971 contre 21 382 ms). L'hypothèse « taux de remplissage » est **fausse pour la phase de chargement**. ⚠️ Elle reste **plausible et non mesurée pour la fluidité APRÈS affichage** : CDP ne bride pas le GPU.

2. **`params.pixelRatio` vaut `2` EN DUR** (`main.js:308`) — `devicePixelRatio` n'est jamais lu. Sur ce portable la toile fait 3840×2160 alors que l'écran physique en affiche 2880×1620 : **1,78× plus de pixels que l'écran ne peut en montrer**, avec SSAO, bloom, profondeur de champ, grain et SMAA par-dessus. Le gâchis est factuel ; son coût en images/s sur un circuit intégré ne l'est pas.

3. **Le gouverneur de qualité ne descend jamais.** `perf.js` démarre tout ce qui n'est pas tactile au palier **T0 pleine qualité**, ignore les **5 premières secondes**, exige 2,5 s sous 30 img/s, puis **20 s entre deux crans** : atteindre T3 demande **~47 s**. Relevé après 25 s d'observation avec des pointes à 5,5 img/s (p95 = 183 ms) : **palier 0**. Il n'inspecte jamais `WEBGL_debug_renderer_info`.

---

## 6. Plan chiffré — temps gagné sur risque

### Rang 1 — borner la résolution de rendu à l'écran réel *(≈ 1 ligne, risque faible)*
`renderer.setPixelRatio(Math.min(params.pixelRatio, devicePixelRatio))`. Sur le portable simulé : **−44 % de pixels** (3840×2160 → 2880×1620) **sans aucune perte visible** — on ne cesse que de dessiner des pixels que l'écran ne montre pas. Sur le RTX rien ne change. **Aucun risque esthétique** : c'est la définition du suréchantillonnage inutile. À faire en premier.

### Rang 2 — choisir le palier de départ d'après le circuit graphique *(risque faible, mesurable)*
Lire `WEBGL_debug_renderer_info` au démarrage ; `Intel HD/UHD Graphics`, `Mali`, `Adreno` → démarrer à **T1**, pas T0. Et raccourcir la première descente (les 5 s d'aveuglement + 20 s d'écart sont faits pour éviter les faux positifs, mais ils font payer **~47 s** à une machine qui rame dès la première image). Gain attendu : la machine faible n'endure plus une minute de pleine qualité. ⚠️ T1 ne coupe **aucun effet** — il borne la résolution à 1,5 et passe les taps de verre de 6 à 4 : **invisible**, ce n'est pas une dégradation qui se voit.

### Rang 3 — ne pas construire le relief deux fois *(≈ 176 ms, risque faible)*
`new Terrain(params)` (`main.js:989`) appelle `this.rebuild()` (`terrain.js:846`) sur un relief **procédural**, intégralement jeté quand le MNT arrive. Visible au profil (`rebuild@terrain.js` à 500–750 ms, `loadDem` à 2 000 ms). Le rapport damier avait déjà chiffré ce même gâchis à **176 ms** côté dalles. Sur un portable bridé 6×, ≈ **1 s**.

### Rang 4 — sortir `bakeCloudVolume` du chemin critique *(460 ms, risque moyen)*
64³ de Perlin-Worley cuits sur le CPU pendant le chargement (`cloud-volume.js`, mesuré **460 ms**, soit ≈ **2,8 s** bridé 6×). Deux voies : le déporter dans un travailleur (comme l'analyse de relief l'a été), ou le cuire une fois et le livrer en `.bin`. ⚠️ Le résultat doit être **bit-identique** — les nuages sont l'identité de la scène.

### Rang 5 — repousser les vignettes du panneau Effets *(≈ 200 ms, risque faible)*
`fx-thumbs.js` rend des vignettes et les encode en PNG (`toDataURL`) pendant le démarrage. Il utilise déjà `requestIdleCallback`, mais avec `{ timeout: 300 }` — donc il **force** son passage même quand le fil est saturé. Personne n'a encore ouvert le panneau Effets à ce moment-là. Monter le délai, ou n'amorcer la file qu'à la première ouverture du panneau.

### Rang 6 — `places.json` (2,6 Mo) et `lakes.json` (936 Ko) *(≈ 750 ms, risque moyen)*
Demandés **après** l'affichage de la carte, ils produisent deux tâches longues de **480 ms** et **277 ms** : la carte est visible mais ne répond pas encore. Découper par emprise, ou analyser dans un travailleur.

### À surveiller — le plancher de 2 s
`LOADING_MIN_MS = 2000` ne coûtait **rien** avant (le relief n'était jamais prêt avant 3,5 s). Avec le préchauffage on descend à 3,9 s en local ; sur un rechargement à chaud avec les rangs 1–5, on **passera sous 2 s** et le plancher deviendra alors le facteur limitant. Ce n'est pas une raison de le retirer — c'est une raison de le savoir.

---

## 7. Plus court, ou plus fluide ? — la réponse par les chiffres

Adrien a tranché « plus fluide », et **les mesures lui donnent raison sur le fond** : le pire du démarrage n'était pas sa durée mais ses **1 760 ms d'image absolument immobile**. Un chargement de 7 s qui vit se supporte ; 1,8 s d'écran mort au milieu, non.

Ce qui est livré supprime ce gel **et** raccourcit — les deux, parce que le gel bloquait aussi le téléchargement des tuiles. Il ne reste que **deux trous de ~360 ms**, à la limite du perceptible.

**Sur l'idée d'un fondu pour adoucir l'arrivée : je ne le recommande pas maintenant.** L'écran de chargement fait déjà très bien ce travail — fond de relief, phrase d'info, marque, flou de transition — et il est peint dès **1,4 s à froid, 116 ms à chaud**. Le problème n'était jamais qu'il soit laid ou brutal : c'est qu'il **s'arrêtait de bouger**. Un fondu par-dessus un écran figé n'aurait rien racheté — il aurait masqué le symptôme. Maintenant que la planète tourne pendant tout le chargement, la question du fondu se reposera honnêtement, sur une séquence saine. **Ne rien couper à l'écran de chargement** : c'est la seule partie du démarrage qui n'a jamais failli.
