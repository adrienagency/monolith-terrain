# Mode avancé v2 — « La Table lumineuse » (proposition 2, EN ATTENTE DE VALIDATION)

> Seconde passe demandée par Adrien : idées puisées dans les apps les mieux
> aimées de leurs utilisateurs. NE PAS EXÉCUTER avant validation.
> La proposition 1 (rangement 9→8 panneaux) reste valable comme lot préparatoire.

**Goal :** remplacer les 8-9 panneaux flottants par DEUX rails fixes + une
palette de commandes — le modèle mental des outils que les créatifs adorent,
appliqué à la carte comme Lightroom l'applique à la photo.

## D'où viennent les idées (apps de référence)

| App | Ce que ses utilisateurs adorent | Ce qu'on transpose |
|---|---|---|
| **Lightroom** | LE rail droit unique : les sections se lisent comme une recette de développement (Base → Couleur → Effets → Détail), une seule ouverte à la fois | Rail droit « Développement de la carte » ordonné : Bibliothèque → Couleurs → Matières → Lumière → Atmosphère → Image |
| **Figma** | UN seul panneau propriétés, contextuel à la sélection ; jamais 9 fenêtres | 2 rails fixes, zéro panneau flottant/déplaçable ; le rail gauche saute à « Parcours » quand une course est active |
| **Linear / Raycast** | La palette ⌘K : tout réglage/action retrouvable en 2 frappes | Recherche de réglages en tête de rail + palette (taper « bloom » → la section s'ouvre, le contrôle pulse) |
| **DaVinci Resolve / Blender** | Espaces de travail par TÂCHE (Edit/Color/Deliver) | Déjà fait chez nous (Explorer/Studio/Parcours) — le mode avancé devient le 4ᵉ espace cohérent, pas un tiroir |
| **Procreate** | Le chrome disparaît, l'œuvre reste | Les rails se replient d'un clic (chevron) → carte pleine, mêmes raccourcis |

## Architecture cible

**Rail GAUCHE — « Le monde »** (fixe, une section ouverte à la fois) :
1. `Explorer` (recherche, lieux)
2. `Carte` (Calques · Courbes & grille · Repères)
3. `Caméra` (Objectif & mise au point · Automatisations)
4. `Parcours` (Trace · Mes courses · Lecture) — s'ouvre seul quand une course est chargée

**Rail DROIT — « Le développement »** (l'ordre EST la recette, comme Lightroom) :
1. `Bibliothèque` — templates + palettes + Boutique + Réinitialiser (le point de départ)
2. `Couleurs` — rampe, océans, fond & ciel (HDRI)
3. `Matières` — terrain, socle, matière du relief, effets de surface (shaders), labo
4. `Lumière` — soleil, heure, ombres (sort du fourre-tout Création — c'est LA section que Lightroom appellerait « Base »)
5. `Atmosphère` — nuages, brume, mer
6. `Image` — rendu (SSAO, bloom), objectif (expo, vignette, grain, flou), scanner, performance

**En tête du rail droit : un champ « Rechercher un réglage »** (filtre instantané
sur les labels — l'app a ~200 contrôles, c'est LA réponse Linear au problème).
Raccourci `K` / `⌘K` → même champ en palette plein écran avec actions
(« Exporter une vidéo », « Ouvrir le Studio », « Mode simple »).

**Chrome :** chaque rail a un chevron de repli (état persisté) ; replié = carte
pleine. Les hairlines remplacent les boîtes-cartes ; chiffres en mono ; un seul
accent ; 100 % français, jargon en parenthèses.

## Ce que ça change vs proposition 1

| | Prop 1 (rangement) | Prop 2 (table lumineuse) |
|---|---|---|
| Effort | ~2 h | ~1,5-2 jours |
| Risque | quasi nul | moyen (refonte du shell des panneaux) |
| Résultat | mode avancé propre | mode avancé au niveau des outils qu'on admire |
| Compatibilité | — | la prop 1 est le LOT 1 de la prop 2 (renommages/fusions identiques) |

## Lots d'exécution

### T1 — Lot préparatoire = proposition 1 (renommages FR, fusions Scanner→Image, Performance→Image)
Voir plan 2026-07-24-ux-mode-avance-rangement.md — inchangé, tout est réutilisé.

### T2 — Le shell « rails »
**Fichiers :** src/ui/shell.js (Panel → RailSection), src/ui/rails.css (nouveau), main.js (ordre de montage)
- [ ] Deux conteneurs fixes .ce-rail-left / .ce-rail-right (largeur 280 px, scroll interne, hairlines)
- [ ] Les panneaux existants deviennent des sections du rail (leur API interne `addSection` inchangée — seule la coquille change)
- [ ] Accordéon exclusif par rail (déjà le comportement des docks — conservé)
- [ ] Chevrons de repli par rail, état localStorage `shibumap-rail-left/right`
- [ ] Drag de panneau SUPPRIMÉ (les rails sont fixes — la liberté de déplacement était un coût de cohérence sans usage réel)
- [ ] Vérif navigateur + tests + commit

### T3 — Réordonnancement « recette » du rail droit
**Fichiers :** create-panel.js (éclatement : Lumière et Atmosphère en sortent), effects-panel.js, main.js
- [ ] Sections Soleil/heure/ombres regroupées sous `Lumière` ; nuages/brume/mer sous `Atmosphère`
- [ ] Ordre de montage = Bibliothèque → Couleurs → Matières → Lumière → Atmosphère → Image
- [ ] Parcours : ouverture auto de la section quand une course se charge (hook onChange déjà chaîné)
- [ ] Vérif navigateur + tests + commit

### T4 — Recherche de réglages + palette K
**Fichiers :** src/ui/settings-search.js (nouveau), shell.js (indexe les labels au build), shortcuts.js
- [ ] Index {label, section, élément} construit au montage des sections (gratuit : les labels existent)
- [ ] Champ en tête du rail droit : filtre → sections non-correspondantes masquées, contrôle correspondant surligné (pulse 1,2 s)
- [ ] `K` ouvre la palette plein écran (même index + actions : Studio, Race Studio, Boutique, Publier, Mode simple)
- [ ] Vérif navigateur + tests + commit

### T5 — Polish premium + livraison
- [ ] Hairlines/typo/espacements passés au crible (mono pour les valeurs, 1 accent, pas de boîtes)
- [ ] Tutoriel resynchronisé ; raccourcis affichés dans la palette
- [ ] 241 tests, build, push 2 branches, deploy, miroir, mémoire
