# NET — LE NETTOYAGE : CE QUI EST PARTI, ET CE QUE J'AI REFUSÉ D'ENLEVER

Arbre `C:\Dev\wt-net`, branche `nettoyage`, partie de `5c73e06` (« Fusion CULL »).
Six commits, un par grappe, `npm test` + `npm run audit:tests` verts après chacun.

## ⚠️ LES FICHIERS QUE J'AI TOUCHÉS — pour `wt-sortie` et `wt-plf`

**`src/globe.js` : UNE ligne** (l'uniforme mort `uMerMaille`, aucun lecteur).
C'est la seule ligne que j'y touche, et je le signale parce que `wt-plf` y
travaille.
Aucun geste, aucune molette, aucun fichier de `monde/gestes-*` n'est touché :
`wt-sortie` n'a rien à craindre de moi.

Autres fichiers modifiés : `src/drag.js`, `src/export.js`, `src/ocean.js`,
`src/nuit.js`, `src/arch.js`, `src/material-textures.js`, `src/pilote.js`,
`src/compte.js`, `src/ui/compte.js`, `src/dem.js`, `src/drone-cam.js`,
`src/pdf-affiche.js`, `src/compositeur-affiche.js`, `src/map/aerial-layer.js`,
`src/map/draped-line.js`, `src/monde/photo-monde.js`, `src/ui/bars.js`,
`package.json`, `scripts/audit-tests.mjs`, `test/course-bar.test.js`,
`test/veille-repos.test.js`.
Supprimés : `src/accordion.js`, `src/pilote-banc.js`, `src/poursuite-banc.js`,
`test/accordion.test.js`, `test/draped-line.test.js`,
`public/demo/grande-traversee.gpx`, 18 fichiers de `scripts/`.

---

## ① LA GARDE, D'ABORD — elle mord, c'est prouvé

`test/course-bar.test.js:186` écrivait :

```js
assert.equal(t.portee, `+${PORTEE_PENTES} km`)
```

Les deux côtés de l'égalité bougeaient ensemble : **l'assertion ne pouvait pas
échouer**. Passer `PORTEE_PENTES` de 2 à 4 laissait `course-bar` *et*
`carnet-course` verts, alors que `carnet-course.js:15-19` explique en toutes
lettres pourquoi la constante est exportée — « écrite en dur dans le rendu, elle
devenait fausse en silence ».

La garde exerce désormais la contrainte réelle, en deux temps :
① le libellé affiché dit le nombre **littéral** (`'+2 km'`, `/2 prochains
kilomètres/`) ; ② la bande **réellement calculée** par défaut est celle de 2 km
(`fenetreDePentes(…)` sans argument comparée à `{ porteeKm: 2 }`, et distincte de
`{ porteeKm: 4 }` — vérifié : les deux fenêtres donnent des classes différentes,
le jeu d'essai n'est pas dégénéré). Changer la constante casse ① ; débrancher le
défaut casse ②.

Second trou, comblé : **`IMAGES_CALME = 30`**. Les tests existants pilotent leur
boucle avec la constante *et* affirment avec la constante, et passent toujours
`imagesCalme` en argument explicite quand ils veulent mordre — **le défaut du
module n'était exercé nulle part**. Nouvelle garde dans
`test/veille-repos.test.js` : 30 écrit en clair, automate exercé **sans**
argument.

### La preuve de morsure

| état | `course-bar` + `carnet-course` + `veille-repos` + `cadence-repos` |
|---|---|
| avant mutation | 123 · 0 |
| `PORTEE_PENTES` 2→4 **et** `IMAGES_CALME` 30→45 | **121 · 2 — les deux nouvelles gardes rougissent** |
| après `git checkout --` | `md5sum -c` **OK** sur les deux fichiers, `git diff -- src/` **vide** |

Restauration vérifiée **à l'octet**, pas à l'œil.

---

## ② LE TABLEAU DES OCTETS

### Le dépôt

| grappe | octets | note |
|---|---:|---|
| ① la garde réparée | **+2 731** | on *ajoute* du test pour fermer deux portes |
| ② `public/demo/grande-traversee.gpx` | **832 390** | un fichier, zéro ligne de code |
| ③ l'audit voit les `.mjs` | **+3 918** | on *ajoute* une garde, on ne supprime rien |
| ④ 18 sondes jetables de `scripts/` | **119 007** | |
| ⑤ 22 symboles morts + 2 uniformes + MP4 doublon | **4 071** | |
| ⑥ modules orphelins (bancs, accordion, drapage) | **24 078** | |
| **total dépôt** | **972 897** | 209 620 070 → 208 647 173 octets |

**84 % du gain est un seul fichier de données.** C'est exactement ce
qu'annonçait INV1, et il faut le dire ainsi plutôt que de gonfler le reste.

### Le paquet livré — `npx vite build` avant et après

| | avant | après | gain |
|---|---:|---:|---:|
| `assets/main-*.js` | 2 311 467 | 2 311 344 | **123** |
| entrée `index-*.js` | 13 077 | 13 077 | 0 |
| les deux CSS + `index.html` | 146 283 | 146 283 | 0 |
| **total au démarrage** | **2 470 827** | **2 470 704** | **123 o — 0,005 %** |

⚡ **CENT VINGT-TROIS OCTETS.** Sur 2,4 Mo. INV3 avait prévenu que le gain serait
faible ; il est **plus faible encore que ça**, et je ne le maquille pas. La
raison est mesurée, pas supposée : Rollup **secouait déjà** presque tout ce que
j'ai enlevé — les huit modules orphelins de `src/` n'étaient pas dans le paquet,
`VideoExporter` non plus une fois son seul appelant mort. Ce qui reste, ce sont
deux uniformes et quelques constantes réellement embarquées.

Le vrai gain de paquet est ailleurs : **`dist/` perd les 832 390 octets du `.gpx`**,
qui partaient à chaque déploiement (vérifié : `dist/demo/` ne contient plus que
le `.json`).

**La leçon à écrire noir sur blanc : sur ce dépôt, nettoyer du code ne rend pas
de bande passante.** Le gain est un gain de lecture humaine et de gardes qui
mordent. Le poids, lui, est dans le MNT en vol (≈ 24 Mo par vol hors crop, INV3
§2.3) — c'est le terrain de `wt-cull`, pas le mien.

---

## ③ ⚠️ CE QUE J'AI REFUSÉ DE SUPPRIMER, ET POURQUOI

**Cette section vaut le reste du rapport.** Sur ce dépôt, la liste de ce qu'on
n'enlève pas est aussi précieuse que celle de ce qu'on enlève.

### Les six `test/attaque-*.mjs` — 93 326 o que je laisse **entiers**

INV3 (rang 2) proposait d'en supprimer trois (52 772 o) comme « sans aucune
référence ». **Vérification faite fichier par fichier, je refuse les six.**

| fichier | ce qui le tient en vie |
|---|---|
| `attaque-r30-ROUGE.mjs` | `test/pivot-molette.test.js`, **inscrit et vert**, se déclare comme sa moitié PURE ; les 5 gardes restantes lisent `.banc/` |
| `attaque-bt-ROUGE.mjs` | `test/bathy-bluetopo-bt-i.test.js`, **inscrit**, dit « la mesure au GPU vit dans `attaque-bt-ROUGE.mjs` » |
| `attaque-ge-ROUGE.mjs` | c'est le barème qui a produit la note **9,75/10 de `rapport-GE3.md`, datée d'aujourd'hui**, et GE3 tient `scripts/sonde-ge3.mjs` inchangé « pour qu'il se relise sans une ligne changée ». Supprimer le barème des gestes pendant que `wt-sortie` modifie les gestes serait exactement le mauvais geste. |
| `attaque-b1` / `attaque-b3` | moitiés GPU de la campagne B, moitiés pures inscrites (`bathy.test.js`, `bathy-nappe-b3.test.js`, `bathy-platier-b5.test.js`) ; `b1` est cité par `scripts/sonde-b1.mjs` |
| `attaque-r33-ROUGE.mjs` | cité par `scripts/lit-sonde-r33.mjs`, lit `.banc/R33` |

Et **aucun ne peut être inscrit** non plus : chacun exige un serveur `vite`, un
Chrome piloté par CDP, ou lit `.banc/` qui est gitignoré. Les inscrire rendrait
`npm test` rouge sur tout dépôt frais.

➡️ Le vrai défaut n'était pas leur existence, c'était que **`audit:tests`
annonçait « aucun écart » au-dessus de 93 KB de fichiers noirs**. Corrigé :
l'audit voit les `.mjs`, et exige que chacun soit **inscrit ou déclaré** dans une
table `HORS_SUITE` avec sa raison. Un `.mjs` non déclaré fait sortir l'audit en 1
(éprouvé), et une déclaration sans fichier aussi (éprouvé).

### `maybeStartTutorial` — un bug, pas un déchet

Zéro référence, donc « certain » au sens d'INV2. **Mais** : `DONE_KEY` est
toujours écrit à la fin du tour (`tutorial.js:91`), et le bouton « ? » dit
explicitement *replays* the guided tour. Autrement dit **la machinerie du
« premier lancement seulement » est intacte, et plus personne ne l'appelle au
démarrage** : un nouveau visiteur n'a plus de visite guidée automatique.

C'est le même cas que la grappe du ruban GPX qu'Adrien a mise hors périmètre :
**une fonctionnalité débranchée, pas du code mort.** Supprimer la fonction
cimenterait la perte. ➡️ **À trancher par Adrien** : la visite au premier
lancement doit-elle revenir ?

### `altitudePourDistance` (`src/loi-altitude.js`)

Zéro lecteur, mais c'est **l'inverse mathématique** d'une fonction vivante, qui
se documente par référence à elle (« C'est l'inverse de `altitudePourDistance`
ci-dessous »). INV2 §5c range ces fonctions pures dans « la production a cessé
d'appeler » et exige qu'Adrien tranche, parce que plusieurs ont été débranchées
**par accident**. Je m'y tiens.

### La grappe B d'INV1 — `zoomCadrage` / `majExagerationCadrage` (6 960 o)

Le brief la listait, et je la laisse. Quatre raisons, dans l'ordre de poids :
1. le module **demande lui-même** qu'on garde la mesure ;
2. INV1 (ordre #5) dit « poser la question à Adrien **avant** » ;
3. la supprimer oblige à **amputer des cas nommés** d'un
   `test/fenetre-branchee.test.js` de 102 871 octets qui est **mixte** — ses
   autres cas gardent le socle vivant. C'est précisément « une grappe à moitié »,
   que le brief interdit ;
4. c'est le pilote de cadrage de la **fenêtre continue, qu'Adrien a choisi de
   garder**.
6 960 octets ne valent pas ce risque-là.

### `audit-solide.js` (22 157 o) et `descente-bornee.js` (12 633 o)

Hors paquet, mais **oracles de cinq et quatre tests** — et l'épreuve de mutation
d'INV3 montre qu'ils **mordent** (`crop-parois.test.js` rougit). INV3 les cote
« moyen » et « moyen-fort » et dit : à trancher **avec `wt-cull`**, pas seul.

### Le reste, en une ligne chacun

- **`LQ_PAD`** — référencé **depuis le CSS** (`ui/v28.css:630`). Un grep JS
  l'aurait tué ; c'est l'avertissement du brief, et il s'est déclenché.
- **`STORE_COMMERCE`**, **`PIVOT_VERS_LE_CURSEUR`**, les drapeaux `false` de
  `flags.js`, la **grappe du ruban GPX**, la **fenêtre continue `?f3=1`** —
  hors périmètre par décision d'Adrien. Pas touchés, même partiellement.
- **15 fichiers de `scripts/`** sur les 33 injoignables : bancs et outils
  réutilisables. Voir le commit `Nettoyage 3/5` pour la ligne de justification de
  chacun. Les plus importants : `ge2-edit.mjs` (l'éditeur **binaire** — c'est
  l'antidote au bug CRLF que deux agents ont payé aujourd'hui),
  `profil-testouille.mjs` (profil de vérification des **comptes**, chantier en
  cours), `sonde-rendu.js` / `sonde-cadrage.js` (sondes de terrain à coller dans
  la console de la machine qui montre le défaut), `pivot-grandslacs.mjs` /
  `pivot-puget-ncei.mjs` (produisent le pivot que lisent `build-bathy-tiles.mjs`
  et `build-lake-tiles.mjs`, **vivants**).
- **Les 120 `export` superflus** (classe C d'INV2) — sans risque unitaire mais
  large ; INV2 dit « une passe séparée, jamais mélangée ». Pas faite.

---

## ④ CE QUE J'AI CRU, PUIS RÉFUTÉ

**① « Un fichier de `scripts/` sans référence hors de `scripts/` est mort. »**
C'est le critère d'INV1, et **il est faux**. `scripts/capture-b5.mjs` lit
`scripts/gpu-tuiles-b5.page.js` par `fs.readFileSync`, et trois `diag-r20-*`
lisent `scripts/instrument-r20.js` de la même façon. Un fichier invisible depuis
`src/` peut être l'outil d'un script vivant. J'ai donc calculé la **fermeture**
(quatre tours, en retirant les morts au fur et à mesure) : **33 fichiers**
réellement injoignables, pas 38. Sans ça je cassais deux chaînes de mesure.

**② « Les six `attaque-*.mjs` sont des tests oubliés. »** Faux, et c'était la
conclusion confortable. Chacun dit **en capitales dans son en-tête** qu'il est
hors de `package.json` **délibérément**, et cinq sur six sont cités par un test
inscrit ou un script vivant. Ce n'était pas une zone d'oubli, c'était une zone
**non déclarée** — deux choses différentes, qui appellent deux remèdes opposés
(supprimer / déclarer). J'ai déclaré.

**③ « Le nettoyage va alléger le démarrage. »** 123 octets. J'ai construit avant
et après, et le chiffre est celui-là. La chaîne de raisonnement « ce code est
mort donc il pèse » est fausse sur un dépôt où Rollup secoue l'arbre : ce qui est
vraiment mort n'était **déjà pas** dans le paquet. Même leçon qu'INV2 sur
`mediabunny` : *on ne déduit pas le poids d'un graphe d'imports, on le lit dans
`dist/`.*

**④ « Mes fichiers sont passés en CRLF. »** Frayeur réelle : mon contrôle
`grep -c $'\r'` a rendu 484 CR sur `arch.js`, 10 198 sur `globe.js`. **C'était le
contrôle qui était faux**, pas les fichiers — le motif s'était dégradé en motif
vide et comptait *toutes* les lignes. `cat -A` montrait des `$` propres, et un
comptage binaire (`open(f,'rb').read().count(b'\r')`) rend **0 CR sur les 16
fichiers touchés**. Leçon : quand un contrôle annonce une catastrophe, **vérifier
le contrôle avant de réparer la catastrophe** — j'ai failli « corriger » des
fichiers parfaitement sains, ce qui les aurait vraiment cassés.

**⑤ « `ATTRIBUTION_MONDE` est gardée par un test qui compare les deux chaînes. »**
C'est ce qu'affirmait son propre commentaire. **Ce test n'existe pas.** Le crédit
affiché passe par les littéraux de `PROVIDERS` (`aerial-layer.js:273, 278, 375`).
J'ai corrigé le commentaire au lieu de le laisser mentir à l'agent suivant.

**⑥ « `PORTEE_PENTES` est comparée à elle-même par négligence. »** Non : le test
avait un **titre juste** (« DÉRIVE de la constante ») et une intention juste.
C'est la traduction en assertion qui a inversé le sens — dériver le *test* de la
constante au lieu de vérifier que le *rendu* en dérive. Le piège est subtil et
peut se refaire ; c'est pour ça que le nouveau test porte l'explication en tête.

---

## ⑤ LA PREUVE QUE L'APPLICATION VOLE ENCORE

Vol scripté (`vol-net.mjs`, Chrome CDP, `vite` sur `127.0.0.1:5931`) :
chargement → Échap → **orbite** (12 rotations d'azimut de 0,30 rad) →
**descente** 2 000 000 → 800 000 → 300 000 → 120 000 → 45 000 → 18 000 m →
**crop** + repos.

| jalon | `tiles` | `_drawn` |
|---|---:|---:|
| après chargement | 16 | 0 |
| après orbite | 16 | 0 |
| après crop | **50** | **16** |

**Erreurs console : 0.** Avertissements : 0.
Capture `vol-net.png` : le terrain, le trait de côte et la bathymétrie sont
peints, toute l'interface répond — et **les crédits sont intacts** en bas à
gauche : « made by @AdrienAgency · © OpenStreetMap contributors · © Mapterhorn ·
Bathymétrie GEBCO_2026 ». C'est la vérification à l'écran qu'INV1 exigeait avant
de toucher aux trois constantes d'attribution : **aucun crédit n'a disparu.**

⚠️ Chiffres pris en `--headless` SwiftShader : c'est un vol de fumée, pas un banc.
Ils ne se comparent pas à ceux d'INV3 (RTX 3080).

---

## ⑥ VÉRIFICATIONS DE SORTIE

- `npm test` : **4 911 · 0** (4 917 au départ ; +2 gardes ajoutées, −8 assertions
  emportées par les deux fichiers de test supprimés avec leur sujet).
- `npm run audit:tests` : **263 listés · 263 sur disque · 6 hors suite tous
  déclarés · aucun écart**.
- `npx vite build` : **✓ built in 3m 8s**, 691 modules, aucune erreur.
- 0 CR dans les 16 fichiers `src/` touchés (comptage binaire).
- Un commit par grappe, suite verte après chacun.

## ⑦ À FAIRE REMONTER À ADRIEN

1. **La visite guidée au premier lancement n'existe plus** (`maybeStartTutorial`
   n'est appelée par personne). Bug ou choix ?
2. **`rapport-INV3.md` n'est commité sur aucune branche** — il n'existe que dans
   la copie de travail de `C:\Dev\wt-inv3`. C'est le rapport qui porte l'épreuve
   de mutation et toutes les mesures de poids. Un `git add -f` là-bas, avant que
   l'arbre ne serve à autre chose.
3. `altitudePourDistance` et la grappe B (`zoomCadrage`) attendent son arbitrage.
