# Tactile — ce qui reste après la première passe

Branche `feat/annuler-et-tactile`. Ce document ne liste que ce qui N'A PAS été
fait, et pourquoi ça n'a pas été fait en même temps. Ce qui est livré est dans
les trois commits de la branche.

## Le verdict mémoire, d'abord — parce qu'il commande le reste

Mesuré le 2026-07-28, Chrome piloté en CDP, vraie émulation d'appareil
(`Emulation.setDeviceMetricsOverride` + `setTouchEmulationEnabled`), ramassage
forcé entre les prises. Tas JS (`usedJSHeapSize`) :

| scénario | téléphone 390×844 dpr3 | tablette 820×1180 dpr2 |
|---|---|---|
| vue d'ouverture, damier vide | 185 Mo | 156 Mo |
| une course chargée (damier toujours vide) | — | 201 Mo |
| **« Isoler la zone », damier peuplé (21-22 dalles)** | **pic 760 Mo, plateau 661 Mo** | **pic 837 Mo, plateau 745 Mo** |

Face à un plafond pratique de 256 à 512 Mo sur un Chrome Android d'entrée de
gamme, et à un iPhone qui tue souvent l'onglet entre 200 et 400 Mo :

- **Le damier ne tient pas sur un téléphone.** Ce n'est pas une marge à grappiller,
  c'est un facteur deux à trois.
- **La vue d'ouverture, elle, tient** — mais à 185 Mo elle est déjà dans la bande
  basse d'iOS, sans aucune réserve.

⚠️ **Ce que l'émulation NE dit PAS** : elle reproduit l'écran, la densité de
pixels et le tactile, jamais le budget mémoire de l'appareil. Chrome annonçait
ici une limite de 4 192 Mo. Le verdict ci-dessus vient donc du CHIFFRE mesuré
comparé à des plafonds connus, pas d'un onglet qu'on aurait vu mourir. La seule
mesure qui trancherait vraiment demande un téléphone réel branché en USB
(`chrome://inspect`) — une demi-heure, à faire avant toute décision d'ouvrir
l'éditeur aux téléphones.

**Nuance qui compte pour la décision produit :** l'éditeur est DÉJÀ refusé sur
téléphone (`boot-gate.js`, `GATE_PHONE` : écran court + pointeur grossier).
Le seul chemin téléphone existant est le lien partagé `#s=` / `#r=`, qui ouvre le
viewer épuré — et ce chemin-là mesure 185 à 200 Mo, pas 700, parce qu'aucun de
ses gestes ne peuple le damier. Autrement dit : **le tactile livré sert d'abord
la tablette et le viewer de course sur téléphone, et le chiffre à 700 Mo est un
argument pour NE PAS ouvrir l'éditeur aux téléphones — pas pour renoncer aux
gestes.**

## Ce qui reste à faire, par ordre de valeur

### 1. Les deux pills de la barre du haut se touchent (tablette portrait)

Mesuré sur 820 px de large : pill gauche 340 px, pill droite 366 px, soit 706 px
sur 820. Il reste 74 px. **Sur un iPad en portrait (768 px), elles se
chevauchent.** Et la barre gauche vient de gagner deux boutons (annuler,
rétablir).

Piste : sous `(pointer: coarse) and (max-width: 900px)`, replier la pill droite
sur un bouton « ⋯ » qui ouvre les icônes en menu — la mécanique de `ce-pubmenu`
existe déjà et sait s'ouvrir/se fermer, il n'y a pas de machinerie à écrire.

### 2. Les panneaux mangent l'écran

Un dock mesure 294 × 968 px sur une tablette 820 × 1180 : 36 % de la largeur,
82 % de la hauteur, et il est posé PAR-DESSUS la carte. En mode simple les docks
sont masqués, donc le problème ne touche que le mode avancé — mais c'est
exactement le mode où l'on règle, donc celui où l'on veut voir ce qu'on règle.

Piste : sur écran tactile étroit, faire glisser les panneaux depuis le bas en
demi-hauteur (feuille modale) plutôt qu'en colonne latérale. Grosse tâche,
UX à instruire avec Adrien avant de coder.

### 3. Dix-sept cibles restent sous 44 × 44 px

Après le passage des icônes de 38 à 44, il reste : le pas-à-pas de zoom
(`zs-btn`, 34 × 34), la croix des raccourcis (`ce-shortcuts-close`, 26 × 26),
les poignées de rail (`ce-railtoggle`, 20 px de large), le badge ALPHA
(45 × 18). Chacune se règle en CSS dans le bloc `(pointer: coarse)` ; c'est du
travail de couture, sans risque, mais il faut le faire élément par élément parce
que certains sont volontairement discrets.

### 4. Le glissé des panneaux au doigt (`drag.js`)

`makeDraggable` écoute des événements POINTER, donc il fonctionne déjà au doigt
— vérifié en lisant le code, PAS mesuré. Ce qui n'est pas vérifié : le
`e.preventDefault()` sur `pointerdown` n'empêche pas le navigateur de faire
défiler pendant le glissé (seul `touch-action` le fait), et les poignées n'ont
pas de `touch-action: none`. À tester au doigt avant de conclure.

### 5. Les infobulles : rien à réparer, mais à remplacer un jour

Mesuré : sur un appui tactile, aucune bulle n'apparaît — l'ordre des événements
fait que `pointerdown` annule le minuteur posé par `pointerover`. Donc pas de
bulle fantôme collée à l'écran, tant mieux. **Mais tout ce que ces bulles
expliquent est invisible au doigt**, et elles portent de vraies phrases
(« Reculer jusqu'à la planète entière… »). Un appui long qui les affiche serait
le geste attendu ; ce n'est pas une correction, c'est une fonctionnalité.

### 6. Le double-appui pour plonger d'un palier

Le geste universel des cartes tactiles (double-tap = zoomer d'un cran) n'existe
pas. `isTap()` dans `src/gestes.js` donne déjà la brique : il suffirait de
compter deux appuis à moins de 300 ms et 30 px l'un de l'autre, et d'appeler le
même `_refine()` que le clic-pour-plonger. Une heure, TDD compris.

## Le piège qui a été trouvé en route et qui n'est PAS corrigé

**Le dédoublonnage de `History.record()` ne dédoublonne rien.** Le cycle
jour/nuit fait tourner le soleil en continu, donc `captureLook(params)` rend un
instantané DIFFÉRENT à chaque appel, même quand l'utilisateur n'a touché à rien
(mesuré au démarrage : `sunAzimuth` 309,81 → 309,40 entre deux prises espacées
de quelques dizaines de millisecondes). Conséquence : un clic sans effet dans un
panneau crée quand même un pas d'annulation, qui ne défait rien de visible.

`History.reset()` masque le symptôme le plus visible (« Annuler » allumé au
chargement), il ne traite pas la cause. La vraie correction — exclure les
paramètres dérivés du soleil de l'instantané, ou les arrondir avant comparaison —
change ce qu'annuler VEUT DIRE pour un réglage de lumière. C'est une décision,
pas un correctif.
