# LES LEÇONS DE LA CAMPAGNE R — 2026-08-23

⚠️ **Ce fichier ne raconte pas ce qui a été corrigé. Il note ce qui a été appris
sur la façon de mesurer** — c'est-à-dire ce qui servira aux tâches suivantes,
longtemps après que les correctifs seront devenus du code ordinaire.

---

## ① LE DÉFAUT SYSTÉMIQUE : « le chiffre le plus favorable »

Relevé par un relecteur, sur trois occurrences vérifiées d'un seul rapport :

> **« Quand deux chiffres existaient, c'est le plus favorable qui a été publié.
> Aucun n'est faux. Chacun est incomplet à l'endroit où l'auteur s'était
> explicitement interdit de l'être. »**

- une métrique publiée **à une seule échelle** — à l'échelle voisine, l'écart au
  socle est **multiplié par 2,26** ;
- **un tour sur deux** présents sur le disque de l'auteur — le second disait
  l'inverse (6,01 contre 5,65), non publié ;
- **179×** publié, alors que le même relevé contient **105×** et que la valeur
  basse figurait déjà dans le fichier de départ.

⚠️ **C'est plus insidieux que l'invention d'un chiffre**, et **indétectable en
recalculant** : chaque valeur remonte bien à sa source. Seul un relecteur qui
**ouvre les autres fichiers du même banc** peut le voir.

➡️ **Parade : quand deux valeurs existent, publier les DEUX, ou la moins
favorable.** À porter dans tous les briefs.

---

## ② LES BANCS DE COÛT MESURAIENT LA MAUVAISE GRANDEUR

Deux agents se sont opposés sur `gl.finish()` ; un troisième a établi la vérité
**sans aucune barrière**, par deux voies indépendantes :
- **saturation** — 2 000 rendus soumis à 0,3634 ms/rendu, puis vidange par
  lecture complète en **3,1 ms au total** : le GPU n'est pas en retard ;
- **différences de lectures complètes** — 0,22 à 0,555 ms/rendu.

**Vérité ≈ 0,36–0,40 ms. `gl.finish()` rend 0,383 : le bon niveau.**

⛔ **La correction « `gl.finish()` ne synchronise pas », propagée à tout le
chantier, est RETIRÉE.** Elle reposait sur une mesure honnête mais non
reproductible ailleurs.

⚡ **ET VOICI CE QUE PERSONNE N'AVAIT VU, qui vaut plus que l'arbitrage :**

> **Ces bancs mesurent le temps de SOUMISSION CPU**, indiscernable du temps sans
> barrière — **alors que les correctifs mesurés n'ajoutaient que du GPU.**

➡️ **Plusieurs « coûts indiscernables de zéro » de cette campagne mesuraient une
grandeur qui ne pouvait pas bouger.** Un « plancher à ±0,005 ms » n'est pas un
plancher sur le coût créé.

⚠️ **Un faible coefficient de variation ne prouve PAS la synchronisation.**

---

## ③ UN INSTRUMENT QUI SE MESURE LUI-MÊME

Le même arbitre a **jeté sa propre première mesure**, et c'est le plus instructif :
une clôture `fenceSync`/`clientWaitSync` donnait `finish` = 0,000 ms et clôture =
120 ms — un résultat spectaculaire. **Son témoin de contrôle a montré qu'une
SECONDE clôture coûte aussi 121,9 ms** : `clientWaitSync` en scrutation **se
mesure lui-même**.

➡️ **Sans ce témoin, il condamnait un collègue à tort.**

---

## ④ LE GRAIN N'EXISTAIT PAS

**`main.js:466` porte `grain: 0, // off by default`**, et les six templates
aussi. `NoiseEffect.blendMode.opacity.value = 0`.

➡️ **Le grain n'entre dans AUCUNE capture** tant que le look « Doux » n'est pas
choisi. Le plancher de bruit de **8,97** publié par une tâche — **au nom duquel
un chiffre de 43 % a été retiré** — **n'était pas le grain**. Quelque chose
d'autre bouge dans la scène et n'a pas été identifié.

⚠️ **Le chiffre reste retiré à raison** (remesuré depuis : les parois déplacent
3,2–3,6 % des pixels). **Mais la prémisse était fausse.**

---

## ⑤ UN INSTRUMENT AVEUGLE À CE QU'IL DEVAIT VOIR

Une tâche a chiffré **tout son coût visuel en LUMINANCE**. Le défaut qu'elle a
laissé passer : à l'antisolaire, **la carte s'efface** — chroma **28,5 → 7,5** —
**pendant que la luminance MONTE (163 → 178)**.

➡️ **L'instrument était structurellement aveugle à un effacement qui éclaircit.**
Elle pouvait mesurer honnêtement et ne rien voir.

⚠️ **Choisir la grandeur mesurée est une décision de conception, pas une
formalité.**

---

## ⑥ CE QUE LES CHIFFRES ONT COÛTÉ, ET CE QU'ILS ONT RAPPORTÉ

**Trente-et-un chiffres retirés par leurs propres auteurs** sur ce chantier,
dont **trois par le donneur d'ordre le seul 2026-08-23** (« 46 bascules », « le
ciné est réversible », « le relief du bloc plat chargé pour rien »), et **une
lecture d'image fausse** (« DEM : chargement » lu sur une vignette réduite — le
texte disait « OSM »).

**Seize exécutants sur seize ont contredit leur brief. Les seize avaient raison.**

➡️ **C'est le seul indicateur qui compte** : un chantier où l'exécutant a
toujours tort n'est pas un chantier discipliné, c'est un chantier où personne ne
vérifie.

---

## ⑦ UNE TROUVAILLE DE PRODUCTION, HORS PÉRIMÈTRE ET OUVERTE

**`GL_INVALID_OPERATION` à CHAQUE IMAGE COMPOSÉE.** Tracé :
`blitFramebuffer` ← `EffectComposer.blitDepthBuffer` ← `tick` (`main.js:12243`).

➡️ **La profondeur n'arrive jamais dans le compositeur — et SSAO et la
profondeur de champ travaillent dessus.**

⚠️ **Ce n'est pas deux erreurs au chargement : c'est soixante fois par seconde.**
**Tâche à ouvrir.**
