# Mode avancé — rangement premium (plan d'exécution, EN ATTENTE DE VALIDATION)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.
> NE PAS EXÉCUTER avant validation d'Adrien (demande explicite : « ne lance rien »).

**Goal :** aligner le mode avancé sur le tri du reste du site (Explorer / Studio / Parcours / Publier) — moins de panneaux, des noms français cohérents, un ordre par fréquence d'usage, zéro doublon avec les espaces.

**Architecture :** aucun nouveau système — on renomme, fusionne et réordonne les 9 panneaux existants (shell.js/Panel + sections) en 8, on déplace 2 sections, on supprime les doublons couverts par le Studio/la boutique.

**Tech stack :** vanilla JS existant (src/ui/*-panel.js), aucune dépendance.

## État des lieux (audit)

| Dock | Panneau | Sections actuelles | Problèmes |
|---|---|---|---|
| G | Explorer | (recherche, lieux) | ok |
| G | Carte | Layers · Contours & Grid · Markers | titres EN |
| G | Scanner | Scanner | 1 section = panneau entier ; c'est un EFFET, pas un outil carto |
| G | Caméra | Lens & Focus · Automation · Performance | titres EN ; Performance n'est pas de la caméra |
| G | Parcours | Trace · Mes courses · Playback options | « Playback options » EN ; Race Studio doublonne la porte du hub (ok de garder, c'est le raccourci pro) |
| D | Templates | Boutique · Reset map · Palettes · Templates | recouvre ~80 % de l'onglet Studio (atelier) ; « Reset map » EN ; Save/Load/Mono en EN |
| D | Création | Couleurs · Fond · Shading · Terrain · Block | Shading/Block EN ; « Fond » devrait annoncer le ciel (HDRI) |
| D | Effets | Render · Post · Clouds · Sea | tous les titres EN |
| D | Shaders | Shaders · Relief material · Fancy | « Fancy » ne dit rien ; Relief material = matière, proche de Création › Terrain |

**Diagnostic global :** le tri récent (hub, Studio, Publier) a créé une hiérarchie claire côté simple ; le mode avancé est resté un tiroir 2024 — anglais résiduel, panneau Scanner orphelin, frontière Création/Shaders floue, Templates qui refait le Studio.

## Cible proposée (8 panneaux)

**Dock gauche — le monde & la course** (ordre haut→bas) :
1. **Explorer** — inchangé
2. **Carte** — sections : `Calques` (routes, eau, aérien, villes) · `Courbes & grille` · `Repères`
3. **Caméra** — `Objectif & mise au point` · `Automatisations` ; la section Performance MIGRE vers Effets→Image (c'est du rendu)
4. **Parcours** — `Trace` · `Mes courses` · `Lecture` (ex-Playback options)

**Dock droit — le look, du plus courant au plus pointu** :
1. **Templates** (bibliothèque d'application rapide) — garde : bouton Boutique, `Réinitialiser la carte`, `Palettes`, `Templates` ; boutons `Enregistrer` / `Charger…` / `Mono clair` / `Mono sombre` traduits. Doublon assumé avec le Studio : ici c'est le raccourci 1-clic des pros, là-bas l'espace guidé.
2. **Création** — `Couleurs` · `Fond & ciel (HDRI)` · `Ombrage` · `Terrain` · `Socle`
3. **Matières & shaders** (fusion de l'actuel Shaders) — `Matière du relief` · `Effets de surface (shaders)` · `Labo` (ex-Fancy — assume le côté expérimental)
4. **Image** (ex-Effets, + 2 arrivées) — `Rendu (SSAO, bloom)` · `Objectif (exposition, vignette, grain)` · `Scanner` (le panneau Scanner DISPARAÎT, sa section vient ici) · `Nuages` · `Mer` · `Performance` (depuis Caméra)

**Ce qui saute :** panneau Scanner (fusionné), section Performance de Caméra (déplacée). 9 → 8 panneaux, 2 docks de 4 — symétrie propre.

**Règles premium transverses :**
- 100 % français, jargon technique entre parenthèses (règle Adrien) ; MÊME casse partout (Majuscule initiale seule).
- Une seule section ouverte par défaut par panneau (la première) — l'accordéon existant fait déjà l'exclusivité par colonne.
- Tooltips des panneaux traduits (il reste ~8 tips EN dans les `new Panel({tip})`).
- Ordre des docks fixé par fréquence (ci-dessus) — l'ordre de construction dans main.js EST l'ordre visuel.

---

### T1 — Renommage français (zéro risque, aucun déplacement)
**Fichiers :** map-panel.js, camera-panel.js, route-panel.js, effects-panel.js, create-panel.js, shaders-panel.js, templates-panel.js
- [ ] Sections : Layers→Calques ; Contours & Grid→Courbes & grille ; Markers→Repères ; Lens & Focus→Objectif & mise au point ; Automation→Automatisations ; Playback options→Lecture ; Render→Rendu (SSAO, bloom) ; Post→Objectif ; Clouds→Nuages ; Sea→Mer ; Shading→Ombrage ; Block→Socle ; Fond→Fond & ciel (HDRI) ; Shaders(section)→Effets de surface (shaders) ; Relief material→Matière du relief ; Fancy→Labo
- [ ] Boutons Templates : Reset map→Réinitialiser la carte (déjà fait pour l'un, l'autre reste EN) ; Save→Enregistrer ; Load…→Charger… ; Mono white/dark→Mono clair/sombre ; placeholder « Name this look… »→« Nommer ce look… »
- [ ] Tips des 9 panneaux → français
- [ ] Vérif navigateur (mode avancé ON), npm test, commit

### T2 — Fusions & migrations
**Fichiers :** scan-panel.js (supprimé), effects-panel.js, camera-panel.js, main.js (construction/ordre)
- [ ] Section Scanner → effects-panel (après Objectif) ; suppression de scan-panel.js + import/main.js ; le raccourci clavier scanner pointe vers la section
- [ ] Section Performance (camera-panel) → effects-panel (dernière position)
- [ ] Panneau Shaders renommé « Matières & shaders »
- [ ] Ordre de construction main.js = ordre cible ci-dessus (gauche : Explorer, Carte, Caméra, Parcours ; droite : Templates, Création, Matières & shaders, Image)
- [ ] Effets renommé « Image » (+ raccourcis/tutorial re-ciblés si besoin)
- [ ] Vérif navigateur : chaque contrôle déplacé fonctionne (scanner, perf), accordéons, npm test, commit

### T3 — Polish premium + livraison
- [ ] Une section ouverte par défaut max par panneau (audit des `{ open: true }`)
- [ ] Tutoriel (tutorial.js) re-synchronisé avec les nouveaux noms/panneaux
- [ ] Vérif responsive + dark mode, 241 tests, build, push 2 branches, deploy, miroir, mémoire

**Estimation : T1 ~30 min, T2 ~1 h, T3 ~30 min — livrable en une session.**
