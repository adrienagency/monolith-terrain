# UX P2 — L'espace « Studio » unifié (atelier)

> superpowers:executing-plans. Push + deploy à la livraison (rythme normal repris).

**Goal:** La porte « Studio » du hub ouvre un VRAI espace morphé de création
(colonne gauche + carte à droite, pattern Race Studio) qui regroupe l'habillage :
Palettes (générateur + validées + aperçu boutique), Templates (intégrés + les
vôtres), Ciel (HDRI). Boutique et Avancé = portes de sortie assumées.
Les panneaux classiques ne bougent pas (ils restent le « mode avancé » de fait).

## T1 — src/ui/atelier.js + atelier.css
- Nom interne « atelier » (collision évitée avec studio.js = Race Studio) ;
  classe body `atelier-mode`, morph partagé makeMorph, layout = miroir exact
  du Race Studio (colonne gauche min(42vw,560px), tokens --st-*).
- Header « ShibuMap. Studio » + ✕. Chips de section : Palettes · Templates ·
  Ciel. Barre basse : « Quitter » ghost + « Boutique de templates » accent.
- Sections (rendu à la volée, style .studio-* réutilisé + compléments .at-*) :
  · Palettes : Générer/Enregistrer (deps), rangée des palettes validées
    (userPalettes), grille de 8 palettes boutique (fetch /templates/data.json,
    clic = essai live via applyPaletteWithBg) + « Toute la boutique → ».
  · Templates : cartes TEMPLATES intégrées + templates utilisateur
    (apply/delete/export via deps existants).
  · Ciel : picker HDRI (deps environments/getBgEnv/setBgEnv — mêmes accès que
    le panneau Création).
- PAS de snapshot : on VIENT styliser sa carte, les changements persistent
  (contrairement à la boutique). Enter/exit = morph seulement.
- « Boutique » : atelier.exit() puis store.enter() (chaînage de morphs).

## T2 — Câblage
- Hub : porte Studio → atelier.enter() (plus store.enter()).
- main.js : buildAtelier(deps) après le store ; v28.css : body.atelier-mode
  ajouté aux listes de masquage UI (mêmes que studio-mode) ; garde clavier
  shortcuts idem ; studio.css : réutiliser les règles #app de studio-mode
  pour atelier-mode (sélecteurs doublés).

## T3 — Vérif + livraison
- Hub → Studio : morph, chips, essai palette live (fond adapté), template
  appliqué, HDRI appliqué, Boutique chaîne vers le store, Quitter garde le look.
- npm test + build, push 2 branches, deploy, miroir, mémoire.
