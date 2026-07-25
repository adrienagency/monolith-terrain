# Nuages v2 — d'un champ de bruit à un système météo

**Date** : 2026-07-25 · **Statut** : plan proposé, EN ATTENTE DE VALIDATION ADRIEN
**Demande** : « plusieurs nuages totalement distincts au lieu d'un bruit qui se divise »,
« répondent parfaitement à l'éclairage », « se butent aux montagnes »,
« se comportent comme un vrai système météorologique ».

---

## 1. Ce qu'on a vraiment aujourd'hui (audit `src/clouds.js`, 675 lignes)

| Brique | État | Verdict |
|---|---|---|
| Rendu | UNE boîte raymarchée sur toute la carte, 64 pas + 5 pas soleil | Solide |
| Forme | Volume Perlin-Worley 64³ (R = billows, G = couverture 2D) | Correct |
| « Plusieurs nuages » | **Champ de couverture global seuillé** (`coverAt` : Worley basse fréquence → `smoothstep(gate)`) | **C'est LE problème signalé** |
| Caractère par nuage | `cloudCell()` échantillonné **une seule fois par rayon**, à l'entrée de la boîte | Trompe-l'œil : ne survit pas à une caméra basse |
| Éclairage | Beer-Lambert + double lobe Henyey-Greenstein + approximation multi-octave du multiple scattering + marche soleil | **Déjà à l'état de l'art temps réel** |
| Relief | `terrainH()` sert **uniquement à l'occlusion** (le rayon s'arrête dans la montagne) | Aucune interaction physique |
| Météo | Dérive rigide `uDrift` + oscillation bornée par cellule | Pas de naissance/mort/croissance |
| Ombres au sol | Texture 128² bakée **en dupliquant la formule de densité côté CPU** | Piège de maintenance |

### Deux mesures qui cadrent le sujet

1. **Le deck traverse déjà les montagnes.** Boîte nuages Y ∈ [4.5, 14.3] ; sommets à
   Y = 10.29. Les crêtes percent la couche de 5.8 unités — la géométrie de la
   rencontre existe, seule la *réaction* manque.
2. **Aux réglages par défaut, il n'y a presque rien** : la texture d'ombre au sol
   n'est couverte qu'à **0.6 %**. La porte de couverture (0.62) est si haute que
   les nuages sont quasi absents — d'où l'impression de système inabouti.
3. **Coût actuel invisible** : 60 fps verrouillés avec et sans nuages sur la
   machine de test (16.7 ms vs 17.3 ms, plafond vsync). On a de la marge GPU.

---

## 2. Verdict franc

**On peut améliorer, largement — et le point faible n'est pas celui qu'on croit.**

- L'**éclairage** est déjà bon : le retravailler ne rendra que des gains marginaux.
- Ce qui manque vraiment, par ordre de gain visuel décroissant :
  1. **Toute interaction physique avec le relief** (le plus gros écart de réalisme,
     et paradoxalement le moins cher : le champ de hauteurs est **déjà** baké en
     256² côté CPU *et* déjà lié au shader — `_bakeHeightfield`, `uTerrainTex`).
  2. **Des nuages réellement individuels** (architecture à changer, mais sans
     toucher au rendu).
  3. **Un comportement météo** (naissance, croissance, dissipation, advection).

**Ce qu'on n'ira PAS chercher** (annoncé d'avance pour ne rien survendre) :
simulation fluide type Navier-Stokes en direct, multiple scattering path-tracé,
et le détail à 2 m quand on vole *au travers* d'un nuage — un raymarch de
navigateur restera doux de près, quoi qu'on fasse.

---

## 3. La vérité technique à poser d'abord (recherche, sources en §7)

**Aucun moteur AAA n'a « un objet = un nuage » dans le ciel.** Nubis (Guerrilla),
Frostbite, Red Dead Redemption 2 : tous rendent un **champ de densité continu**
raymarché. Ce qui les fait *lire* comme des masses séparées, c'est la
combinaison carte météo basse résolution + modèle enveloppe + profil vertical
explicite — pas une architecture d'entités.

**Mais** la voie « vraies entités » existe et est parfaitement faisable en
WebGL2 : les **impostors volumétriques** (un nuage = une boîte englobante
raymarchée localement) et les **nuages en SDF composés**. C'est ce qu'il nous
faut, et c'est ce qui répond littéralement à la demande.

À dire honnêtement à Adrien : chaque nuage aura **sa boîte, sa graine, sa vie,
sa taille** — mais le grain *à l'intérieur* restera le même bruit procédural que
son voisin, décalé par sa graine. Personne ne peint chaque nuage à la main.

## 4. L'architecture retenue (révisée après recherche)

Trois briques, dont **deux seulement sont nouvelles** — le rendu et l'éclairage
existants sont conservés tels quels.

```
  ① AUTOMATE CELLULAIRE 2D          DEM 256² (déjà baké)
     (Dobashi, SIGGRAPH 2000)       pente · orientation
     grille 128², ping-pong FBO           │
     naissance → croissance →             │  soulèvement
     maturité → dissipation  ◄────────────┘  orographique
                    │
                    ▼  carte météo (où et quand un nuage existe)
  ② N NUAGES = InstancedMesh de boîtes englobantes
     un seul draw call · attributs par instance :
     centre, échelle, graine, âge, vitesse propre
                    │
                    ▼  chaque boîte raymarchée LOCALEMENT (24-40 pas)
  ③ RENDU + ÉCLAIRAGE EXISTANTS (inchangés)
     volume Perlin-Worley 64³ · Beer-Lambert · HG double lobe ·
     scatter multi-octave · marche soleil · ombre au sol
```

**Pourquoi cette version bat celle du premier jet** (carte météo seule) :
- Une boîte englobante est une **frontière dure de calcul** : les nuages sont
  séparés par construction, plus par un seuil qui peut « recoller » deux masses.
- Chaque instance porte son âge → apparition et disparition **individuelles**.
- **Le coût baisse plutôt qu'il ne monte** : 24-40 pas dans une petite boîte au
  lieu de 64 pas dans une boîte qui couvre toute la carte, avec culling et LOD
  par distance gratuits (ce sont des objets de scène).
- Un seul draw call (`InstancedMesh`), et le volume de bruit déjà baké est
  réutilisé tel quel par toutes les instances.

**L'automate cellulaire** (référence publiée : Dobashi et al., SIGGRAPH 2000,
étendu en 2010 avec rendu par impostors — exactement notre combinaison) tourne
sur une grille 128², par ping-pong de framebuffers, **toutes les 200-500 ms**
seulement : un système météo n'a pas besoin de 60 fps. Coût négligeable.

**Bonus d'architecture** : le bake d'ombre au sol lit la même carte météo → fin
de la duplication de la formule de densité entre le CPU et le GLSL (dette
actuelle). Il devra en revanche être **rafraîchi à la cadence de l'automate**
(aujourd'hui il n'est baké qu'au `build()`, ce qui suffisait à des nuages qui ne
faisaient que dériver, mais deviendra faux avec des nuages qui naissent et
meurent).

---

## 5. Le plan, en 4 phases livrables séparément

### P1 — Les nuages deviennent des objets (le cœur)
- `src/clouds-sim.js`, **module pur et testé** (node, sans DOM) : entités
  (position, échelle, graine, âge, vitesse), advection par le vent, cycle de vie
  naissance → croissance → maturité → dissipation.
- `clouds.js` : la boîte unique devient un `InstancedMesh` de boîtes ; le
  raymarch actuel est réécrit en **espace local d'instance** (mêmes formules,
  bornes différentes) ; attributs d'instance pour graine/âge/densité.
- Bake d'ombre alimenté par la même source → suppression du miroir CPU.
- **Livrable visible** : des nuages qu'on peut compter, qui naissent et meurent.
- *Point de vigilance* : éviter le « pop » à l'apparition (fondu par l'âge) et
  le chevauchement disgracieux de deux boîtes voisines (distance minimale au
  spawn).

### P2 — Le relief entre dans l'équation (le plus gros gain visuel)
Alimenté par le DEM déjà baké en 256² :
- **Base plate au niveau de condensation** : les nuages partagent une altitude
  de base → la couche « coupe » les sommets net, le classique alpin.
- **Soulèvement orographique** : là où `∇h · vent > 0` (versant au vent), la
  probabilité de naissance et le plafond montent → les nuages **s'empilent
  contre la montagne**.
- **Effet de foehn** : versant sous le vent, dissipation accélérée → le ciel se
  dégage derrière la crête.
- **Accrochage aux crêtes** : la base d'un nuage est remontée par la hauteur du
  terrain sous son centre (lecture de `uTerrainTex`, déjà liée).
- **Mer de nuages / brouillard de vallée** : seconde population basse et plate,
  spawn conditionné par altitude faible + vent faible, plus dense au petit matin.
- ⚠️ **Honnêteté** : aucune publication graphique ne documente une
  implémentation temps réel de l'orographie pour les nuages. Cette recette est
  **une conception originale**, extrapolée de principes météo connus — à valider
  par itération visuelle, pas par confiance dans une technique établie.

### P3 — Finition d'éclairage (peu cher, gains ciblés)
- **Beer-Powder manquant** (Schneider 2015) : `(1 - exp(-2d)) * beer(d)` sur le
  terme direct → l'effet poudreux caractéristique sur les bords épais. Une ligne.
- **Liseré argenté renforcé** : un lobe étroit isolé autour du contre-jour
  (`cosA ≈ 1`) plutôt que de compter sur le seul lobe HG négatif.
- Ambiante du ciel **variable en altitude** (dessous sombre, dessus au ton du
  ciel) au lieu d'une couleur unique.

### P4 — UI (section Nuages, déjà en chips)
Les chips deviennent des **régimes météo** au lieu de réglages :
`Dégagé · Cumulus de beau temps · Ciel de traîne · Front · Mer de nuages`.
Le technique reste en « Réglages fins ». Sauvegarde dans les templates.

---

## 6. Coût, risque, garde-fous

| | Estimation |
|---|---|
| Coût GPU | **~neutre voire inférieur** — marches bornées par boîte (24-40 pas) au lieu de 64 pas dans une boîte pleine carte, + culling/LOD gratuits |
| Coût simulation | Négligeable — grille 128², une passe toutes les 200-500 ms |
| Risque technique | **Faible-moyen** — le rendu et l'éclairage ne bougent pas ; le raymarch passe en espace local d'instance |
| Risque réel | **Le dosage visuel** : pop à l'apparition, chevauchement des boîtes, LOD par distance |

**Garde-fous**
- Chaque phase est livrable seule et réversible.
- Le champ de bruit actuel reste en repli tant que P1 n'est pas validé à l'œil.
- Les fonctions de simulation sont pures → testées en node comme le reste du repo.
- Aucun changement des `TEMPLATE_KEYS` existants (ajouts seulement).

### Écarté explicitement : l'architecture « ambitieuse » (voxels façon Nubis³)
Grille de voxels 3D évolutive, accélérée par SDF compressés. **Hors de portée
WebGL2** : pas de compute shaders, donc toute mise à jour de texture 3D passe
par du ping-pong de framebuffers slice par slice — goulot connu, budget explosé
avec SSAO/bloom/DoF déjà actifs. Et le gain serait invisible depuis les
altitudes de caméra d'une carte topographique (ce n'est pas un jeu où l'on vole
à travers les nuages). Également hors de portée : simulation fluide
Navier-Stokes, multiple scattering path-tracé, ombres volumétriques 3D vraies.

---

## 7. Ce qui reste à trancher avec Adrien

1. **Le vent** : un réglage utilisateur (direction + force) ou dérivé de l'heure
   et du lieu ? Il pilote toute l'orographie.
2. **Densité de peuplement** : combien de nuages au maximum sur un bloc ? (24 est
   ma proposition — au-delà, ils se recouvrent et l'individualité se perd.)
3. **La mer de nuages** est un effet spectaculaire mais qui masque la carte :
   régime météo à choisir explicitement, ou jamais automatique ?

---

## 8. Sources

- Schneider, *The Real-Time Volumetric Cloudscapes of Horizon Zero Dawn*,
  SIGGRAPH 2015 — modèle enveloppe, base + érosion, Beer-Powder.
- Schneider, *Nubis* (2017), *Nubis Evolved*, *Nubis³* (SIGGRAPH 2023) — voxels
  et SDF compressés ; méthodologie publique, code propriétaire.
- Hillaire, *Physically Based Sky, Atmosphere and Cloud Rendering in Frostbite*,
  SIGGRAPH 2016.
- Wrenninge, *Art-Directable Multiple Volumetric Scattering*, SIGGRAPH 2015 —
  l'approximation multi-octave **déjà implémentée** dans `scatter()`.
- **Dobashi et al., *A Simple, Efficient Method for Realistic Animation of
  Clouds*, SIGGRAPH 2000** — l'automate cellulaire retenu ; étendu en 2010
  (*Dynamic cloud simulation using cellular automata and texture splatting*),
  soit exactement la combinaison automate + impostors proposée ici.
- Bauer (Rockstar), *Creating the Atmospheric World of Red Dead Redemption 2*,
  SIGGRAPH 2019.
- Maxime Heckel, *Real-time dreamy Cloudscapes with Volumetric Raymarching* —
  nuages en SDF composés (inspiration à réécrire, licence non précisée).
- `leoawen/volumetric-clouds` (MIT) — seule base Three.js à licence propre, mais
  c'est un champ global comme l'existant : à auditer, pas à adopter.
- `FarazzShaikh/three-volumetric-clouds` — déclaré non prod-ready par son auteur,
  sans licence : **à ne pas intégrer**.
