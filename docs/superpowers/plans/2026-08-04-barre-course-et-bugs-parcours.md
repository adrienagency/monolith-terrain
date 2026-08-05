# Barre de course, lecture et bugs du parcours — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser `superpowers:subagent-driven-development`
> ou `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes
> utilisent des cases à cocher (`- [ ]`).

**Objectif :** corriger quatre régressions du mode Parcours, stabiliser la barre de
course, et ajouter trois gestes de lecture demandés par Adrien.

**Architecture :** la logique pure va dans `src/*.js` (testée avec `node --test`,
sans DOM ni three.js) ; le câblage 3D reste dans `src/gpx.js` / `src/drone-cam.js` ;
l'habillage dans `src/ui/`. Aucune nouvelle dépendance.

**Pile :** three.js 0.172, Vite 6, `node --test`, CSS natif avec les jetons `--ce-*`.

## Contraintes globales

- **TDD obligatoire.** Toute logique pure part d'un test qu'on a VU échouer.
- **Tout nouveau fichier de test doit être ajouté à la ligne `test` de `package.json`.**
  Un test non listé ne tourne jamais — c'est le piège maison. Auditer disque contre
  liste après ajout.
- Commentaires en français, expliquant le POURQUOI et les pièges vécus, jamais le QUOI.
- Messages de commit : sujet court **sans accents**, corps qui explique la cause.
- Aucune régression : `npm test` puis `npx vite build` verts avant chaque commit.
- Vérification navigateur obligatoire pour tout ce qui se voit — les tests DOM ne
  voient pas les erreurs WebGL (leçon de la barre de course).
- Ne jamais laisser `public/_gpx/` (GPX de test) dans un commit.

## Structure des fichiers

| Fichier | Responsabilité | Tâches |
|---|---|---|
| `src/casse-titre.js` | **créé** — casse de nom propre pour les titres de course | 6 |
| `src/vue-ensemble.js` | **créé** — pose caméra isométrique cadrant un tracé | 10 |
| `src/gpx.js` | ruban, arche, lecture, largeur | 1, 3, 9 |
| `src/drone-cam.js` | amortissement de la visée | 4 |
| `src/main.js` | câblage suivi / fin de parcours / clic profil | 2, 9, 10 |
| `src/ui/course-bar.js` + `.css` | titre, marge, bouton Stop, largeurs stables | 5, 6, 7 |
| `src/ui/carnet-course.js` + `.css` | libellé « D− restant », largeurs stables | 5, 8 |

---

### Task 1: L'épaisseur du tracé ne fait plus rien (régression)

**Cause établie.** `setWidth()` ne touche que `lineMat.linewidth` et `glowMat`,
c'est-à-dire l'ancienne `Line2`. La largeur du ruban, elle, est **cuite dans la
géométrie** (`largeur = RUBAN_DEMI_LARGEUR * gpxWidth`, lue au rebuild). Depuis que
le ruban est le tracé par défaut, le réglage n'a plus aucun effet visible.

**Fichiers :**
- Modifier : `src/gpx.js` (`setWidth`, ~ligne 1795)
- Test : `test/gpx-largeur.test.js` (**créé**)
- Modifier : `package.json` (ligne `test`)

**Interfaces :**
- Produit : `largeurRuban(demiLargeurBase, gpxWidth)` → nombre (demi-largeur monde)

- [ ] **Étape 1 : écrire le test qui échoue**

```js
// test/gpx-largeur.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { largeurRuban, RUBAN_DEMI_LARGEUR_BASE } from '../src/ruban-trace.js'

test('la largeur du ruban suit le reglage du panneau', () => {
  assert.ok(largeurRuban(0.022, 3) > largeurRuban(0.022, 1.5))
  assert.equal(largeurRuban(0.022, 3), 0.066)
})

test('largeurRuban : reglage absurde ou absent retombe sur le defaut', () => {
  assert.equal(largeurRuban(0.022, null), largeurRuban(0.022, 3))
  assert.equal(largeurRuban(0.022, 0), largeurRuban(0.022, 3))
  assert.ok(Number.isFinite(largeurRuban(0.022, NaN)))
})
```

- [ ] **Étape 2 : vérifier l'échec**

`node --test test/gpx-largeur.test.js` → ÉCHEC, `largeurRuban` n'est pas exporté.

- [ ] **Étape 3 : implémenter dans `src/ruban-trace.js`**

```js
// La demi-largeur EFFECTIVE du ruban. Isolée ici parce que deux endroits en
// dépendent (la géométrie et le rayon du nez arrondi) et qu'ils doivent lire la
// MÊME valeur, sinon la pointe ne colle plus à la largeur.
export const RUBAN_DEMI_LARGEUR_BASE = 0.022
export function largeurRuban(base, reglage) {
  const k = Number.isFinite(reglage) && reglage > 0 ? reglage : 3
  return base * k
}
```

- [ ] **Étape 4 : vérifier le vert** — `node --test test/gpx-largeur.test.js` → PASS.

- [ ] **Étape 5 : brancher le rebuild**

Dans `src/gpx.js`, remplacer `setWidth` :

```js
  // ⚠️ LE RUBAN SE RECONSTRUIT, LA LIGNE SE RÈGLE. La largeur du ruban est CUITE
  // dans sa géométrie (voir _construitRuban) : changer un uniforme n'y suffit pas.
  // C'est la régression qu'Adrien a vue — depuis que le ruban a remplacé Line2,
  // les puces Fine/Classique/Épaisse ne changeaient plus rien.
  setWidth(v) {
    if (this.lineMat) this.lineMat.linewidth = v
    if (this.glowMat) this.glowMat.linewidth = v * 2.4
    if (this.ruban && this.track) this.rebuild()
  }
```

Et dans `_construitRuban`, utiliser `largeurRuban(RUBAN_DEMI_LARGEUR_BASE, this.params.gpxWidth)`.

- [ ] **Étape 6 : enregistrer le test** — ajouter ` test/gpx-largeur.test.js` à la
      ligne `test` de `package.json`, puis auditer disque contre liste.

- [ ] **Étape 7 : vérifier dans le navigateur**

Charger un GPX, mesurer la largeur du ruban, cliquer « Fine », re-mesurer :

```js
const l = (g) => { const p = g.attributes.position.array; return Math.hypot(p[0]-p[14*3], p[2]-p[14*3+2]) }
```

Attendu : la largeur change réellement (≈ 0,066 → 0,033).

- [ ] **Étape 8 : `npm test` + `npx vite build` + commit**

```
Parcours : le reglage d epaisseur du trace remarche
```

---

### Task 2: Le suivi ne repart pas après une relecture (régression)

**Cause à établir par reproduction.** `engageGpxFollow()` sort tôt si
`!gpxLayer.isPlaying()` ou si `modes.mode !== 'surface'`, et délègue à
`pilote.lancerPoursuite()` quand le suivi hélico est actif. Après une lecture
menée à son terme, `gpx.js tick()` fait `this.playing = false` (auto-pause). Un
des trois est en cause ; il faut mesurer lequel avant de corriger.

**Fichiers :**
- Modifier : `src/main.js` (`engageGpxFollow`, ~ligne 5029)
- Test : `test/suivi-relance.test.js` (**créé**)
- Modifier : `package.json`

- [ ] **Étape 1 : REPRODUIRE et instrumenter dans le navigateur**

```js
const e = window.__exp, g = e.gpxLayer, x = g.layers[0].gpx
x.headT = 0.995; g.play()
await new Promise(r => setTimeout(r, 2000))     // laisser finir
const apresFin = { playing: g.isPlaying(), headT: x.headT, drone: e.drone?.active,
                   pilote: e.pilote?.active, mode: e.modes?.mode }
g.play(); e.startFollow?.()
const apresRelance = { playing: g.isPlaying(), headT: x.headT, drone: e.drone?.active,
                       pilote: e.pilote?.active, mode: e.modes?.mode }
JSON.stringify({ apresFin, apresRelance }, null, 1)
```

Noter LEQUEL des trois verrous est faux à la relance. Ne pas corriger avant.

- [ ] **Étape 2 : écrire le test qui échoue, sur la garde isolée**

```js
// test/suivi-relance.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { peutEngagerLeSuivi } from '../src/suivi-course.js'

test('LE SUIVI REPART APRES UNE LECTURE TERMINEE', () => {
  // l'etat exact releve a l'etape 1 : la lecture vient d'etre relancee
  assert.equal(peutEngagerLeSuivi({ suiviDemande: true, enLecture: true, mode: 'surface' }), true)
})

test('le suivi ne s engage pas sans lecture, ni hors mode surface', () => {
  assert.equal(peutEngagerLeSuivi({ suiviDemande: true, enLecture: false, mode: 'surface' }), false)
  assert.equal(peutEngagerLeSuivi({ suiviDemande: true, enLecture: true, mode: 'globe' }), false)
  assert.equal(peutEngagerLeSuivi({ suiviDemande: false, enLecture: true, mode: 'surface' }), false)
})

test('cas degeneres : jamais de plantage', () => {
  assert.equal(peutEngagerLeSuivi(undefined), false)
  assert.equal(peutEngagerLeSuivi({}), false)
})
```

- [ ] **Étape 3 : vérifier l'échec** — module absent.

- [ ] **Étape 4 : créer `src/suivi-course.js`**

```js
// La garde d'engagement du suivi, extraite pour être testable. Elle vivait en
// ligne dans engageGpxFollow, donc personne ne pouvait vérifier qu'elle laisse
// bien repasser une SECONDE lecture — le bug qu'Adrien a vu.
export function peutEngagerLeSuivi(etat) {
  if (!etat) return false
  return !!etat.suiviDemande && !!etat.enLecture && etat.mode === 'surface'
}
```

- [ ] **Étape 5 : vérifier le vert.**

- [ ] **Étape 6 : brancher dans `main.js` ET corriger la cause relevée à l'étape 1**

Remplacer la garde en ligne par `peutEngagerLeSuivi({ suiviDemande: params.gpxFollow, enLecture: gpxLayer.isPlaying(), mode: modes.mode })`, puis appliquer le correctif que l'étape 1 a désigné (réarmer `pilote`/`drone` selon le cas).

- [ ] **Étape 7 : re-jouer le scénario de l'étape 1** — le suivi doit se réengager.

- [ ] **Étape 8 : `package.json`, tests, build, commit**

```
Parcours : le suivi se reengage apres une lecture terminee
```

---

### Task 3: L'arche vole loin du sol (bug)

**Ce qui est écarté.** Mesuré sur le Grand Raid : les deux arches sont dans le bloc
central et posées correctement (−0,003 et +0,075 unité). Le repli sur le bloc voisin
n'est donc PAS la cause ici.

**Piste restante.** La capture d'Adrien est à fort zoom. L'arche est enregistrée dans
`_ponctuels`, qui ne gère que sa **visibilité** (`gpx.js:2118`), pas son altitude. Si
le terrain est recuit plus fin après la construction de l'arche, le sol descend ou
monte sous elle sans qu'elle suive.

**Fichiers :**
- Modifier : `src/gpx.js` (`_ponctuels`, `_buildArches`)
- Test : `test/arch.test.js` (existe déjà — y ajouter)

- [ ] **Étape 1 : REPRODUIRE au zoom d'Adrien**

Charger le GPX, zoomer jusqu'au niveau de détail fin, puis mesurer :

```js
const x = window.__exp.gpxLayer.layers[0].gpx, fen = window.__exp.terrain.fenetre
x._archGroups.map(g => { const p = g.children[0]?.position; return p &&
  ({ y: +p.y.toFixed(3), sol: +window.__exp.terrain.sample(p.x-fen.x, p.z-fen.z).toFixed(3) }) })
```

Attendu si la piste est bonne : un grand écart APRÈS zoom, nul avant.

- [ ] **Étape 2 : écrire le test qui échoue**

```js
test('une arche se REPOSE quand le sol change sous elle', () => {
  let sol = 5
  const arche = { position: { x: 0, y: 0, z: 0 } }
  reposeArche(arche, () => sol, 0)     // pose initiale
  assert.equal(arche.position.y, 5)
  sol = 12                              // le terrain a ete recuit plus fin
  reposeArche(arche, () => sol, 0)
  assert.equal(arche.position.y, 12, 'l’arche doit suivre le nouveau sol')
})
```

- [ ] **Étape 3 : vérifier l'échec, puis implémenter `reposeArche` dans `src/arch.js`**

```js
// Repose une arche déjà construite sur le sol COURANT. Nécessaire parce qu'un
// recuit de terrain plus fin déplace le relief sous un objet déjà placé : sans
// ce rappel, l'arche reste à l'altitude du terrain grossier et se met à voler.
export function reposeArche(obj, sampleGround, decalage = 0) {
  const y = sampleGround(obj.position.x, obj.position.z)
  if (Number.isFinite(y)) obj.position.y = y + decalage
}
```

- [ ] **Étape 4 : vérifier le vert, puis appeler `reposeArche` là où `_ponctuels` est parcouru** (`gpx.js:2118`), avec le même échantillonneur que le ruban (repli damier compris).

- [ ] **Étape 5 : re-mesurer au zoom d'Adrien** — écart attendu ≈ 0.

- [ ] **Étape 6 : tests, build, commit**

```
Parcours : l arche se repose quand le terrain est recuit plus fin
```

---

### Task 4: La caméra doit être plus fluide dans les virages

**Cause établie.** `DroneCam._aim()` ne comporte **aucun** amortissement, par
décision explicite : « la tête est TOUJOURS pile au centre […] l'aim, lui, ne lague
jamais ». Toute la douceur vient de l'amortissement de POSITION. Résultat : chaque
petit changement de direction de la tête fait pivoter la vue instantanément.

**Compromis TRANCHÉ PAR ADRIEN (2026-08-04) : « tu peux relâcher un peu la pression
sur la caméra pour fluidifier ».** La visée sera donc amortie, et la tête de course
ne sera plus rigoureusement au centre pendant un virage — elle dérive un peu puis se
recentre. Cela renverse la décision commentée dans `_aim()` (« l'aim ne lague
jamais ») ; ce commentaire doit être RÉÉCRIT, pas supprimé, en disant pourquoi la
règle a changé.

**Dosage :** « un peu » — viser une demi-vie de visée d'environ 0,28 s, soit la
moitié de l'amortissement horizontal de position (0,55 s). La visée reste donc plus
réactive que la position : on relâche, on ne débraye pas.

**Fichiers :**
- Modifier : `src/drone-cam.js` (`_aim`, constructeur)
- Test : `test/drone-cam.test.js` (existe)

- [ ] **Étape 1 : écrire le test qui échoue**

```js
test('LA VISEE EST AMORTIE : elle ne saute pas sur la nouvelle direction', () => {
  const vise = { x: 0, y: 0, z: 0 }
  const cible = { x: 10, y: 0, z: 0 }
  amortisVisee(vise, cible, 0.4, 1/60)
  assert.ok(vise.x > 0 && vise.x < 10, `rattrapage partiel attendu, obtenu ${vise.x}`)
})

test('la visee amortie finit par rattraper une cible fixe', () => {
  const vise = { x: 0, y: 0, z: 0 }, cible = { x: 10, y: 0, z: 0 }
  for (let i = 0; i < 600; i++) amortisVisee(vise, cible, 0.4, 1/60)
  assert.ok(Math.abs(vise.x - 10) < 0.01)
})
```

- [ ] **Étape 2 : vérifier l'échec ; Étape 3 : implémenter `amortisVisee` (même loi `1 − 2^(−dt/T)` que `damp` du fichier) ; Étape 4 : vérifier le vert.**

- [ ] **Étape 5 : brancher dans `_aim`**, avec une demi-vie `aimHalfLife = 0.28`
      exposée sur l'instance, et un `_viseDisp` initialisé sur la tête au `start()`
      (sinon la première image part de l'origine).

- [ ] **Étape 6 : vérifier en lecture** — relever l'écart angulaire image à image
      avant/après ; il doit chuter nettement.

- [ ] **Étape 7 : tests, build, commit**

```
Camera de poursuite : la visee est amortie, plus d a-coups dans les virages
```

---

### Task 5: La barre ne doit plus bouger horizontalement

**Cause.** Les valeurs (« 21,7 km », « 1 201 m ») changent de largeur au fil de la
lecture, et les blocs se recalent à chaque image. Deux corrections, indépendantes :
chiffres à chasse fixe, et gouttières figées.

**Fichiers :**
- Modifier : `src/ui/carnet-course.css`, `src/ui/course-bar.css`

- [ ] **Étape 1 : chiffres tabulaires sur toute valeur numérique**

```css
.cb-bar .cb-valeur,
.cb-bar .carnet-chiffre,
.cb-bar .cb-hero {
  /* ⚠️ SANS CECI LA BARRE DANSE. Les chiffres proportionnels n'ont pas la même
     largeur (un « 1 » est deux fois plus étroit qu'un « 8 ») : à chaque image la
     valeur changeait de largeur et poussait ses voisins. */
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}
```

- [ ] **Étape 2 : figer les gouttières** — remplacer les zones auto par une grille
      à colonnes fixes : `grid-template-columns: 1fr auto minmax(320px, 26rem)`
      pour `.cb-body`, et `min-width` sur chaque valeur d'après son gabarit le plus
      large (`ch` plutôt que `px`).

- [ ] **Étape 3 : vérifier dans le navigateur** — mesurer sur 120 images :

```js
const b = document.querySelector('.cb-bar')
const zones = [...b.querySelectorAll('.cb-zone')]
// relever offsetLeft de chaque zone a chaque image ; l ecart-type doit valoir 0
```

Critère : **zéro** variation d'`offsetLeft` pendant une lecture complète.

- [ ] **Étape 4 : build, commit**

```
Barre de course : les chiffres cessent de faire danser la mise en page
```

---

### Task 6: Titre en casse de nom propre, et marge au-dessus

**Fichiers :**
- Créer : `src/casse-titre.js`, `test/casse-titre.test.js`
- Modifier : `src/ui/course-bar.js`, `src/ui/course-bar.css`, `package.json`

- [ ] **Étape 1 : écrire le test qui échoue**

```js
import { casseDeNom } from '../src/casse-titre.js'

test('un titre tout en capitales redevient un nom propre', () => {
  assert.equal(casseDeNom('GRAND RAID REUNION 2025 - DIAGONALE DES FOUS 2025'),
               'Grand Raid Reunion 2025 - Diagonale des Fous 2025')
})

test('les petits mots restent en minuscules, SAUF en tete', () => {
  assert.equal(casseDeNom('LES 100 KM DE MILLAU'), 'Les 100 km de Millau')
  // ⚠️ CORRIGÉ EN COURS D'EXÉCUTION. Ce test attendait « De bout en Bout »,
  // ce qui est FAUX : capitaliser le dernier mot d'une locution est une
  // convention anglophone (title case), pas française. La composition
  // française capitalise le premier mot et les noms propres, rien d'autre.
  // Cette attente erronée avait forcé l'implémenteur à inscrire « bout » dans
  // la liste des mots mineurs, et produisait « Trail des 100 Km » — une unité
  // de mesure capitalisée, jamais correcte.
  // ⚠️ LE CAS « DE BOUT EN BOUT » A ÉTÉ RETIRÉ, deuxième correction de ce test.
  // Sans dictionnaire de noms propres, une règle praticable capitalise tout
  // sauf les mots de liaison — « bout » retombe donc en capitale. Le garder
  // exigeait de l'inscrire en dur parmi les mots mineurs, et cette liste ad hoc
  // a un vrai coût : « TRAIL DU BOUT DU MONDE » sortait « Trail du bout du
  // Monde », incohérent sur un toponyme réel. Aucune course ne s'appelle « de
  // bout en bout » : le cas synthétique ne valait pas la règle qu'il imposait.
  assert.equal(casseDeNom('TRAIL DES 100 KM'), 'Trail des 100 km')
  assert.equal(casseDeNom('TRAIL DU BOUT DU MONDE'), 'Trail du Bout du Monde')
})

test('L APOSTROPHE SE COMPORTE COMME LE TRAIT D UNION', () => {
  // même piège que le tiret, trouvé en relecture : le filtre de détection des
  // capitales ne reconnaissait pas l'apostrophe, donc le segment de tête
  // n'était jamais composé
  assert.equal(casseDeNom("L'ULTRA-TRAIL DU MONT-BLANC"), "L'Ultra-Trail du Mont-Blanc")
  assert.equal(casseDeNom("L'ECHAPPEE BELLE"), "L'Echappee Belle")
})

test('UNE APOSTROPHE NE COUPE PAS TOUJOURS UN MOT', () => {
  // ⚠️ RÈGLE TROUVÉE EN RELECTURE, à la troisième correction de ce test.
  // Traiter l'apostrophe comme un séparateur universel casse les contractions
  // internes : « AUJOURD'HUI » devenait « Aujourd'Hui ». La règle juste tient
  // en une phrase — on ne recommence un mot après l'apostrophe QUE si ce qui
  // précède fait UNE SEULE LETTRE (l', d', j', n', s', c', m', t'), c'est-à-dire
  // une élision. Au-delà, l'apostrophe est INTERNE au mot.
  assert.equal(casseDeNom("AUJOURD'HUI"), "Aujourd'hui")
  assert.equal(casseDeNom("LA PRESQU'ILE SAUVAGE"), "La Presqu'ile Sauvage")
  assert.equal(casseDeNom("QUELQU'UN"), "Quelqu'un")
})

test('LES MOTS A TRAIT D UNION SONT TRAITES, pas laisses tels quels', () => {
  // le motif le plus courant des noms de course francais, et il manquait
  // entierement : « MONT-BLANC » restait crie parce que le filtre de
  // detection des capitales ignorait le tiret
  assert.equal(casseDeNom('MARATHON DU MONT-BLANC'), 'Marathon du Mont-Blanc')
  assert.equal(casseDeNom('ULTRA-TRAIL DU MONT-BLANC'), 'Ultra-Trail du Mont-Blanc')
})

test('les sigles gardent leurs capitales', () => {
  assert.equal(casseDeNom('UTMB 2026'), 'UTMB 2026')
  assert.equal(casseDeNom('GR20 INTEGRALE'), 'GR20 Integrale')
})

test('un titre deja bien casse n est pas abime', () => {
  assert.equal(casseDeNom('Marathon du Mont-Blanc'), 'Marathon du Mont-Blanc')
})

test('cas degeneres', () => {
  assert.equal(casseDeNom(''), '')
  assert.equal(casseDeNom(null), '')
})
```

- [ ] **Étape 2 : vérifier l'échec ; Étape 3 : implémenter** (règle : on ne
      retouche QUE les mots entièrement en capitales et de plus de 3 lettres —
      un sigle court reste intact ; petits mots `de du des la le les et en à sur
      d' l'` en minuscules sauf en première position).

- [ ] **Étape 4 : vérifier le vert ; Étape 5 : appliquer dans `course-bar.js`** au
      titre affiché — **pas** aux données sources (le nom d'origine reste celui de
      l'organisateur, seul l'affichage change).

- [ ] **Étape 6 : la marge manquante**

```css
.cb-head {
  /* la marge haute manquait entierement : le titre touchait le bord du bloc */
  padding-block-start: var(--cb-gutter);
}
```

- [ ] **Étape 7 : `package.json`, vérif navigateur, tests, build, commit**

```
Barre de course : titre en casse de nom, et une marge au-dessus
```

---

### Task 7: Un bouton Stop dans la barre

**Fichiers :** `src/ui/course-bar.js`, `src/ui/course-bar.css`, `test/course-bar.test.js`

- [ ] **Étape 1 : test qui échoue** — la barre construite expose un bouton
      `[data-role="stop"]`, son `aria-label` vaut « Arrêter la lecture », et un clic
      appelle `onStop`.
- [ ] **Étape 2 : vérifier l'échec ; Étape 3 : ajouter le bouton** dans le groupe de
      transport, à droite de Pause, même gabarit `.ce-icon-btn`, icône carré plein.
- [ ] **Étape 4 : vérifier le vert ; Étape 5 : câbler `onStop` → `gpx.stop()` +
      `stopFollow()` dans `main.js`.**
- [ ] **Étape 6 : vérif navigateur, tests, build, commit**

```
Barre de course : un bouton Stop a cote de Pause
```

---

### Task 8: « Sommet restant » devient « D− restant »

**Fichiers :** `src/ui/carnet-course.js`, `test/carnet-course.test.js`

- [ ] **Étape 1 : test qui échoue** — le libellé rendu vaut exactement `D− restant`
      (avec le signe moins U+2212, comme `D+`), et la chaîne `Sommet restant`
      n'apparaît nulle part.
- [ ] **Étape 2 : vérifier l'échec ; Étape 3 : renommer le libellé ; Étape 4 : vert.**
- [ ] **Étape 5 : vérifier que la VALEUR affichée est bien un dénivelé négatif
      restant** et non une altitude de sommet — si la donnée sous-jacente est un
      sommet, la remplacer par `D− restant` réellement calculé.
- [ ] **Étape 6 : vérif navigateur, tests, build, commit**

```
Carnet : Sommet restant devient D- restant
```

---

### Task 9: Cliquer sur le tracé pour y reprendre la lecture

**Fichiers :** `src/gpx.js` (profil + picking 3D), `src/main.js`

- [ ] **Étape 1 : test qui échoue** sur la conversion pure

```js
test('un clic sur le profil rend la fraction de DISTANCE, pas de largeur', () => {
  // le profil est gradue en abscisse curviligne : x/largeur EST deja la fraction
  assert.equal(fractionAuClic(0, 800, 0), 0)
  assert.equal(fractionAuClic(400, 800, 0), 0.5)
  assert.equal(fractionAuClic(900, 800, 0), 1, 'hors bornes : on borne')
})
```

- [ ] **Étape 2 : vérifier l'échec ; Étape 3 : implémenter `fractionAuClic(x, largeur, padX)` ; Étape 4 : vert.**
- [ ] **Étape 5 : brancher le clic** sur le canevas du profil ET sur le survol du
      ruban en 3D : `gpx.headT = f`, `_applyReveal(f)`, puis `play()` + `startFollow()`.
      Le curseur passe en `pointer` au survol pour annoncer que c'est cliquable.
- [ ] **Étape 6 : vérif navigateur** — cliquer à 30 %, la lecture doit reprendre là.
- [ ] **Étape 7 : tests, build, commit**

```
Parcours : cliquer sur le trace y reprend la lecture
```

---

### Task 10: À l'arrivée, la caméra s'élève sur une vue d'ensemble

**⚠️ REQUALIFIÉE EN COURS D'EXÉCUTION — LIRE AVANT DE COMMENCER.** Le plan
supposait qu'aucun finale n'existait. C'est faux : l'enquête de la tâche 2 a
trouvé un finale **déjà en place** dans `src/main.js` (~ligne 7916, bloc
« FINALE (Adrien) »). Cette tâche n'est donc PAS une création, c'est une
correction de l'existant. Trois défauts à traiter, et rien d'autre :

1. **Il ne se déclenche que si la course a des points de passage**
   (`&& raceState.waypoints.length`). Adrien a demandé le recul « une fois le
   tracé terminé », sans condition. Un GPX simple n'en profite pas — c'est
   d'ailleurs pourquoi le GPX de test ne reproduisait pas le bug de la tâche 2.
   Retirer cette condition.
2. **La direction n'est pas isométrique.** Le code utilise
   `new THREE.Vector3(0.5, 0.85, 0.6)`, qui n'est ni à 45° en plan
   (0,5 ≠ 0,6) ni à 35,26° en site. Adrien a écrit « en isométrique ».
   La remplacer par la vraie direction isométrique.
3. **Le cadrage est en ligne dans `main.js`**, donc non testable. L'extraire
   dans `src/vue-ensemble.js` (module pur) et le tester.

**NE PAS** réécrire le déclenchement (`_wasPlaying`, `headT >= 0.999`) : il
marche. **NE PAS** toucher au `params.gpxFollow = false` du finale : la
tâche 2 en dépend et l'a déjà traité.

**Fichiers :** `src/vue-ensemble.js` (**créé**), `test/vue-ensemble.test.js` (**créé**), `src/main.js` (~7916), `package.json`

- [ ] **Étape 1 : test qui échoue**

```js
import { poseIsometrique } from '../src/vue-ensemble.js'

test('la pose cadre TOUT le trace, avec une marge', () => {
  const pts = [{x:-10,y:0,z:-10},{x:10,y:5,z:10}]
  const p = poseIsometrique(pts, { fovDeg: 30, marge: 1.25 })
  assert.deepEqual([+p.cible.x.toFixed(3), +p.cible.z.toFixed(3)], [0, 0])
  assert.ok(p.position.y > 5, 'la camera doit etre AU-DESSUS du point haut')
  const rayon = Math.hypot(10, 10)
  assert.ok(p.distance > rayon, 'assez loin pour tout contenir')
})

test('la pose est ISOMETRIQUE : 45 deg en plan, 35,26 deg en site', () => {
  const p = poseIsometrique([{x:-1,y:0,z:-1},{x:1,y:0,z:1}], {})
  const d = { x: p.position.x - p.cible.x, y: p.position.y - p.cible.y, z: p.position.z - p.cible.z }
  assert.ok(Math.abs(Math.abs(d.x) - Math.abs(d.z)) < 1e-9, 'plan a 45 deg')
  const site = Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180 / Math.PI
  assert.ok(Math.abs(site - 35.264) < 0.01, `site ${site}, attendu 35,264`)
})

test('cas degeneres : trace vide ou a un point', () => {
  assert.equal(poseIsometrique([], {}), null)
  assert.ok(poseIsometrique([{x:0,y:0,z:0}], {}))
})
```

- [ ] **Étape 2 : vérifier l'échec ; Étape 3 : implémenter** (boîte englobante,
      centre, rayon, distance = rayon·marge / tan(fov/2), direction isométrique
      vraie : azimut 45°, site atan(1/√2) = 35,264°).
- [ ] **Étape 4 : vérifier le vert.**
- [ ] **Étape 5 : déclencher à l'arrivée** — dans `gpx.js tick()`, là où
      `if (this.headT >= 1) this.playing = false`, notifier `onArrivee?.()` ;
      `main.js` désengage le suivi et lance un `tween` vers `poseIsometrique(world)`
      sur ~2,5 s en ease-in-out.
- [ ] **Étape 6 : vérif navigateur** — laisser une lecture aller au bout, la caméra
      doit s'élever et cadrer tout le parcours.
- [ ] **Étape 7 : `package.json`, tests, build, commit**

```
Parcours : a l arrivee la camera s eleve sur une vue d ensemble
```

---

### Task 11: Un interrupteur unique pour couper les animations

**Demandé par Adrien en cours d'exécution du plan** : « Je voudrais pouvoir gérer
les animations qui interviennent dans ShibuMap. Il faudrait un toggle pour les
activer et les désactiver. » Puis, sur la question maître-ou-par-famille :
« interrupteur d'animations complet, pas de famille. » **UN SEUL interrupteur.**

**Ce qu'il couvre** — le mouvement AMBIANT, celui qui vit sans que l'utilisateur
touche à rien : la dérive des nuages, la houle et l'eau, la faune (poissons,
baleine), le scintillement du sillage de tête de course, et toute animation
décorative qui tourne en boucle.

**Ce qu'il NE couvre PAS, et c'est délibéré** : la lecture d'un parcours GPX et
les mouvements de caméra déclenchés par l'utilisateur. Ce ne sont pas des
animations décoratives, c'est le produit lui-même — les couper viderait
l'application de sa fonction. Si Adrien veut aussi les inclure, il le dira.

**Deux bénéfices en plus du réglage** : c'est une aide performance réelle sur les
machines faibles (à rapprocher de la table des paliers de `palier-machine.js`), et
c'est la réponse correcte à `prefers-reduced-motion`, que le système d'exploitation
expose pour les personnes que le mouvement gêne physiquement.

**Fichiers :**
- Créer : `src/animations.js`, `test/animations.test.js`
- Modifier : `src/main.js` (état + câblage), `src/ui/effects-panel.js` (l'interrupteur), `package.json`

**Interfaces :**
- Produit : `animationsActives({ reglage, reduitParSysteme })` → booléen
- Produit : `reglageInitial(reduitParSysteme)` → booléen (valeur de départ)

- [ ] **Étape 1 : écrire le test qui échoue**

```js
// test/animations.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { animationsActives, reglageInitial } from '../src/animations.js'

test('le reglage de l utilisateur decide', () => {
  assert.equal(animationsActives({ reglage: true, reduitParSysteme: false }), true)
  assert.equal(animationsActives({ reglage: false, reduitParSysteme: false }), false)
})

test('UN CHOIX EXPLICITE PRIME SUR LE SYSTEME, dans les deux sens', () => {
  // quelqu'un qui a demande le mouvement reduit a son systeme mais qui rallume
  // ICI a dit ce qu'il voulait : on ne le contredit pas
  assert.equal(animationsActives({ reglage: true, reduitParSysteme: true }), true)
  assert.equal(animationsActives({ reglage: false, reduitParSysteme: false }), false)
})

test('LE SYSTEME DECIDE DU DEPART, pas de la suite', () => {
  // prefers-reduced-motion n'est pas un caprice : on demarre eteint
  assert.equal(reglageInitial(true), false)
  assert.equal(reglageInitial(false), true)
})

test('cas degeneres : jamais undefined, toujours un booleen', () => {
  assert.equal(animationsActives(undefined), true)
  assert.equal(animationsActives({}), true)
  assert.equal(typeof reglageInitial(undefined), 'boolean')
})
```

- [ ] **Étape 2 : vérifier l'échec** — `node --test test/animations.test.js` → module absent.

- [ ] **Étape 3 : implémenter `src/animations.js`**

```js
// L'INTERRUPTEUR D'ANIMATIONS — un seul, pour tout le mouvement ambiant.
//
// ⚠️ LE CHOIX EXPLICITE PRIME TOUJOURS SUR LE SYSTÈME. `prefers-reduced-motion`
// décide de l'état de DÉPART, jamais de la suite : quelqu'un qui a demandé le
// mouvement réduit à son système d'exploitation et qui rallume ici a dit ce
// qu'il voulait, et le contredire à chaque visite serait une réponse absurde à
// un réglage d'accessibilité.
export function animationsActives(etat) {
  if (!etat || etat.reglage === undefined) return true
  return !!etat.reglage
}

// L'état de départ, la toute première fois. C'est le SEUL endroit où le système
// a voix au chapitre.
export function reglageInitial(reduitParSysteme) {
  return !reduitParSysteme
}
```

- [ ] **Étape 4 : vérifier le vert.**

- [ ] **Étape 5 : recenser les consommateurs AVANT de câbler**

Ne devine pas la liste. Cherche dans `src/` tout ce qui avance avec `dt` ou une
horloge et qui n'est pas déclenché par l'utilisateur, et écris la liste trouvée
dans le rapport. Points de départ connus : `clouds2.js` / `clouds-sim.js` (vent),
la mer et sa houle, `sea-*.js`, la faune (poissons, baleine), et
`_tempsSillage` dans `src/gpx.js`. Il y en a probablement d'autres.

- [ ] **Étape 6 : câbler** — `params.animations`, initialisé par
      `reglageInitial(window.matchMedia('(prefers-reduced-motion: reduce)').matches)`,
      et chaque consommateur recensé cesse d'avancer son horloge quand
      `animationsActives` rend faux. **Figer, pas cacher** : la mer reste visible,
      elle ne bouge plus. Une animation coupée ne doit jamais faire disparaître
      un objet.

- [ ] **Étape 7 : l'interrupteur dans le panneau Effets**, même gabarit que les
      autres bascules du panneau. Libellé « Animations », infobulle expliquant
      que les couper allège aussi les machines lentes.

- [ ] **Étape 8 : `package.json`, audit disque contre liste.**

- [ ] **Étape 9 : vérifier dans le navigateur** — couper l'interrupteur, puis
      relever sur ~60 images qu'aucun des objets recensés ne bouge plus, et
      qu'aucun n'a disparu. Rallumer, vérifier que tout repart.

- [ ] **Étape 10 : `npm test` + `npx vite build` + commit**

```
Effets : un interrupteur unique pour couper les animations
```

---

### Task 12: Le repere de survol du profil, et le fond du bouton Stop

**Demandé par Adrien après avoir essayé la barre** : « quand je survole la zone du
profil, je dois voir une petite barre verticale d'une couleur différente de celles
qui sont déjà sur le profil et qui suit exactement ma souris, comme ça je peux voir
où je vais relancer la lecture si je clique sur le profil. Le bouton stop doit avoir
un fond car sinon l'ui est bizarre. »

**Pourquoi c'est nécessaire, pas cosmétique.** La tâche 9 a rendu le profil
cliquable, mais rien n'annonce OÙ le clic emmène. On clique à l'aveugle, on
découvre après coup. Le repère est ce qui transforme un clic au jugé en un geste
visé.

⚠️ **LA COULEUR EST LE CŒUR DE LA DEMANDE.** Adrien insiste : « d'une couleur
différente de celles qui sont déjà sur le profil ». Le profil porte déjà, en accent,
le réticule de LECTURE, les repères de points de passage et la pastille de survol —
et l'en-tête de `course-bar.css` pose la règle : « L'ACCENT EST RÉSERVÉ À LA POSITION
DE LECTURE ». Le repère de survol ne dit pas *où on est* mais *où on irait* : il ne
doit donc pas parler la langue de l'accent. Une encre atténuée, ou un trait
discontinu, distingue l'intention du réel. Choisis, mesure le contraste sur les deux
thèmes (clair et sombre), et écris la raison du choix.

⚠️ « QUI SUIT EXACTEMENT MA SOURIS » — au pixel, pas accroché au point de tracé le
plus proche. Le réticule de lecture, lui, se cale sur un sommet ; ce repère-ci
suit le curseur. Les deux coexistent à l'écran et ne doivent pas se confondre.

**Fichiers :**
- Modifier : `src/gpx.js` (`_drawProfile`, et le suivi de la souris sur le canevas)
- Modifier : `src/ui/course-bar.css` (fond du bouton Stop)
- Test : `test/gpx.test.js`

- [ ] **Étape 1 : écrire le test qui échoue**

La conversion pixel → fraction existe déjà (`fractionAuClic`, tâche 9). Ce qui
manque est l'état de survol et son effacement. Test sur la fonction pure :

```js
test('le repere de survol suit le pixel, il ne s aimante pas a un sommet', () => {
  // fractionAuClic est deja la conversion ; ce test verrouille que le repere
  // utilise la MEME et rend une fraction continue, pas un index arrondi
  const a = fractionAuClic(400, 800, 0)
  const b = fractionAuClic(401, 800, 0)
  assert.notEqual(a, b, 'un pixel de plus doit deplacer le repere')
})

test('sortir du canevas efface le repere', () => {
  assert.equal(repereDeSurvol(null), null)
  assert.equal(repereDeSurvol(undefined), null)
})
```

- [ ] **Étape 2 : vérifier l'échec.**

- [ ] **Étape 3 : implémenter.** Un état `_survolFraction` (null quand la souris est
      sortie), posé par `pointermove` sur le canevas et effacé par `pointerleave`,
      redessiné par `_drawProfile`. Le trait se dessine APRÈS la courbe et AVANT la
      pastille de survol, pour ne masquer ni l'une ni l'autre.

- [ ] **Étape 4 : vérifier le vert.**

- [ ] **Étape 5 : le fond du bouton Stop.** Il est aujourd'hui sans fond, ce qui le
      détache de ses voisins. Reprends le gabarit de fond déjà employé par les
      autres boutons du groupe de lecture — ne compose pas une couleur nouvelle,
      lis les jetons existants. Vérifie en clair ET en sombre.

- [ ] **Étape 6 : vérifier dans le navigateur.** Déplacer la souris sur le profil et
      relever que le trait suit bien le curseur au pixel (échantillonne plusieurs
      positions et compare à `fractionAuClic`), qu'il disparaît en sortie de zone,
      qu'il se distingue à l'œil du réticule de lecture, et que le bouton Stop a un
      fond dans les deux thèmes.

- [ ] **Étape 7 : `npm test` + `npx vite build` + commit**

```
Barre de course : un repere de survol sur le profil, et un fond au bouton Stop
```

---

### Task 13: Le reticule de survol du profil ne s affiche plus hors lecture

**RÉGRESSION DE CE PLAN, pas une dette héritée.** C'est le point important, et il
justifie une tâche à part plutôt qu'une note de bas de rapport.

Avant la tâche 9, la garde de `pointerMove()` exigeait `this.line` — l'ancienne
`Line2`, qui n'est jamais construite sous le ruban, c'est-à-dire sous le rendu par
DÉFAUT. Le picking 3D ne se déclenchait donc jamais, et l'écouteur global
`pointermove` de `src/main.js` (~ligne 2011) était inoffensif. La tâche 9 a levé
cette garde à juste titre — et a réveillé l'écouteur.

**Ce qui se passe maintenant.** L'écouteur `window` et celui du canevas du profil
s'exécutent dans le MÊME tick (bulle DOM), avant tout repaint. Hors lecture,
`hoverIdx` est donc écrasé à `-1` **systématiquement**, à chaque mouvement de souris
sur le profil. Conséquence mesurée par la relecture : le réticule accent, la sphère
de curseur 3D, l'infobulle et le hook `onHoverIndex` (donc le carnet) ne s'affichent
**jamais** hors lecture. Pendant la lecture, `setHeadAt` corrige à chaque image et
rien ne se voit — d'où la découverte tardive.

**Ce qui n'est PAS touché**, vérifié : le repère de survol de la tâche 12 (il vit
dans `_survolFraction`, que le picking 3D n'écrit jamais) et le clic-pour-reprendre
(il relit la position depuis l'événement de clic, pas depuis `hoverIdx`).

**Fichiers :**
- Modifier : `src/main.js` (~2011, l'écouteur global)
- Test : `test/gpx.test.js` ou un nouveau fichier — dans ce cas, l'ajouter à
  `package.json`

**Le piège à éviter.** La correction évidente — « ignorer les événements venant du
panneau » — se fait mal si elle teste un nom de classe : la barre de course, le HUD
flottant et le panneau Parcours ont chacun leur profil, et un jour il y en aura un
quatrième. Cherche une règle qui ne dépende pas d'une liste de sélecteurs.

- [ ] **Étape 1 : REPRODUIRE d'abord.** Hors lecture, survoler le profil et relever
      `hoverIdx` sur plusieurs mouvements. Il doit rester à `-1`. C'est la preuve
      que le défaut existe, avant toute correction.

- [ ] **Étape 2 : écrire le test qui échoue** sur la règle pure — « cet événement de
      souris doit-il piloter le picking 3D ? » — plutôt que sur le comportement DOM
      complet. Une fonction pure testée vaut mieux qu'une simulation d'événement.

- [ ] **Étape 3 : vérifier l'échec ; Étape 4 : implémenter ; Étape 5 : vérifier le vert.**

- [ ] **Étape 6 : vérifier dans le navigateur, les DEUX régimes** — hors lecture, le
      réticule, l'infobulle et le carnet suivent le survol du profil ; PENDANT la
      lecture, rien n'a changé et la tête commande toujours. Et le survol du tracé
      en 3D fonctionne toujours : c'est ce que la tâche 9 avait réparé, ne le
      recasse pas en corrigeant celui-ci.

- [ ] **Étape 7 : `npm test` + `npx vite build` + commit**

```
Parcours : le reticule du profil survit au picking 3D hors lecture
```

---

## Auto-relecture

**Couverture.** Les dix demandes d'Adrien sont couvertes : largeurs stables (5),
casse du titre + marge (6), bouton Stop (7), clic pour reprendre (9), vue d'ensemble
à l'arrivée (10), « D− restant » (8), arche qui vole (3), caméra plus fluide (4),
épaisseur du tracé (1), suivi qui ne repart pas (2).

**Ordre conseillé :** 1, 2, 3 (régressions d'abord — elles cassent l'usage), puis 4,
puis 5 à 8 (habillage), puis 9 et 10 (gestes nouveaux).

**Deux tâches partent d'une reproduction** (2 et 3) parce que leur cause n'est pas
établie : leur étape 1 est une mesure, pas une correction. C'est délibéré — corriger
avant d'avoir mesuré, c'est deviner.

**Point à trancher avec Adrien**, tâche 4 : une visée amortie signifie que la tête
n'est plus exactement au centre pendant un virage. C'est un renversement d'une
décision antérieure explicitement commentée dans `drone-cam.js`.
