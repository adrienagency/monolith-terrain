# UX P3 — Mode simple par défaut + barre contextuelle + interrupteur Mode avancé

> Concept validé dans le plan UX global (Adrien) : « barre contextuelle flottante
> type Figma par mode, interrupteur Mode avancé ». Exécution directe.

**Goal :** par défaut, la carte est PURE : aucun dock de panneaux. Les deux
espaces (Studio / Race Studio) portent la création. Une barre flottante
bottom-center donne les deux portes en permanence. « Mode avancé » (topbar)
ré-affiche tous les panneaux pour les power users — choix persisté.

## T1 — Mode simple / avancé
- Clé localStorage `shibumap-ui-advanced` ('1' = avancé). Défaut : simple.
- Body class `ce-simple` quand simple. v28.css : `body.ce-simple .ce-dock { display:none }`.
- Bouton topbar « Avancé » (pill, état .on) à côté de l'œil masquer-UI ;
  data-tip explique. Togglé → classe + localStorage.
- Restent en mode simple : topbar, bottombar (recherche + GPX), pilule heure,
  zoom stepper, iso/ciné, toggle aérien, profil GPX.

## T2 — Barre contextuelle flottante (.ce-quickbar)
- bars.js `buildQuickBar({ openAtelier, openStudio })` : pill glassbox fixe
  bottom-center (au-dessus de la bottombar), 2 actions :
  « Habiller ma carte » (accent → atelier) · « Ma course » (→ Race Studio).
- Visible UNIQUEMENT en mode simple sur la carte nue : masquée en
  store-mode / studio-mode / atelier-mode / ce-noui / ce-embed (CSS).

## T3 — Vérif + livraison
- Défaut = simple : docks absents, quickbar visible, portes fonctionnent,
  toggle Avancé ré-affiche les panneaux et persiste au reload.
- Modes morphés : quickbar disparaît, revient en sortant.
- npm test + build, commit, push 2 branches, deploy, miroir, mémoire.
