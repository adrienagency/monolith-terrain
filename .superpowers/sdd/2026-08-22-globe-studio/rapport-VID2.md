# RAPPORT VID2 — CE QUE LA VIDÉO MONTRE, ET CE QU'AUCUN DES CINQ CORRECTEURS NE COUVRE

**Arbre** `C:\Dev\wt-vid2` · branche `chasse-video2` · HEAD `6275e62` (Fusion RAMP) ·
serveur `127.0.0.1:10512`. `git diff -- src/` **vide (0 octet)** · `npm test`
**5 000 · 0** · `audit:tests` **271 listés = 271 sur disque, aucun écart**.
Banc : `scripts/banc-vid2.mjs` (Chrome sans tête, GPU d3d11, 1280 × 800, sonde
`requestAnimationFrame` à chaque image + rafales de captures à 300 ms).

⛔ **Aucune correction.** Ce rapport reproduit, attribue, classe. Temps ② (la
note) viendra quand les correcteurs auront rendu.

---

## ⓪ LA VIDÉO TOURNE SUR CET ARBRE, AU CARACTÈRE PRÈS

Le serveur de la vidéo écoute encore (`127.0.0.1:5599`, pid 36472, une
connexion établie — **je n'y ai pas touché**). Sept modules servis, diffés
ligne à ligne contre l'arbre, imports de Vite exclus :

| module | lignes servies / locales | écarts |
|---|---|---|
| `src/modes.js` | 2 133 / 2 133 | **0** |
| `src/globe.js` | 10 155 / 10 155 | **0** |
| `src/main.js` | 14 887 / 14 887 | **0** |
| `src/clouds2.js` · `ground-info-layer.js` · `monde/nuages-globe.js` · `monde/rampe-crop.js` | identiques | **0** |

Le seul indice de chronologie : `rampe-crop.js?t=1788557776860` = **23 h 36 min 16 s**,
l'instant de la fusion RAMP, rechargé à chaud APRÈS la vidéo (22 h 30). La page
d'Adrien a donc aujourd'hui la rampe fixe ; la vidéo ne l'avait pas. Tout le
reste est cet arbre. ⚠️ Les libellés « Studio / Parcours » de sa barre ne sont
pas une autre branche : `bars.js:557-567` porte les deux libellés (long / court).

---

## ① LE CATALOGUE — les non-couverts EN TÊTE

Lieu de toutes les reproductions : **Provence, `modes.flyTo(44.3425, 5.7777, 9)`**
(le lieu du cartouche de la vidéo), accueil fermé par `Échap`, puis **caméra
montée à `controls.maxDistance` posé** (68,8 unités, 102 km — c'est le cadrage
d'Adrien, qui arrive d'en haut : le bloc entier tient à l'écran et y reste
palier après palier, `_suivreEmprise` conservant le rapport crop/écran), puis
`modes.cranZoom(1)` **deux fois par palier**. Captures `run3/` du banc.

| # | ce qu'on voit (image) | reproduction | attribué à | cause établie / hypothèse | gravité pour Adrien |
|---|---|---|---|---|---|
| **N1** | **Les nuages descendent avec le zoom** : posés sur le bloc (`m_050`), à hauteur de la paroi (`m_060`, zoom), au ras du bord du terrain (`m_078`–`m_080`), **taches grises dans les vallées** à z14 (`m_089`, zoom) | flyTo z9, caméra à maxDistance, 8 crans → z13 : `07-sortie-00.png`, cinq nuages **collés au relief** ; à z13 au repos, alt 3 115 m, **la moitié droite de l'écran est un nuage** (`05-z14-repos.png`) | **PERSONNE** | **ÉTABLIE, au chiffre.** `main.js:5419` `groupeNuages.scale.setScalar(a.echelle)` : l'homothétie du crop porte AUSSI la verticale (`nuages-globe.js` §3 le revendique) ; `cloudAltitude = 13,5` unités de BLOC, or le bloc mesure 170 km à z9 et 10 km à z13. Plafond mesuré par palier : **z9 20 464 m · z10 10 152 m · z11 5 066 m · z12 2 530 m · z13 1 264 m · z14 632 m**. Les sommets de Provence font 1 000–2 000 m : dès z13 le ciel est SOUS les crêtes | **haute** — visible à chaque palier, et à z13–z14 la caméra vole dans la couche |
| **N2** | **Un nuage flotte hors du socle**, sur le fond vide (`m_060` en 1090,300 ; `m_069` en 1050,330) | même vol, 3 crans arrière depuis z13 : `09-sortie2-00.png`, nuage entier à (230,350) hors crop ; `07-sortie-00.png` nuage (1030,560) qui déborde du bord droit | **PERSONNE** | le volume `clouds2` n'est pas borné à l'emprise du crop : il se peuple sur 56 unités de bloc, le crop en montre moins, et rien ne coupe à la paroi | **moyenne** — c'est « un truc qui flotte hors du bloc », la classe qu'Adrien nomme |
| **N3** | **Le cartouche ment après un palier** : `m_089`–`m_091` affichent `44.3167°N · 44°19'00"` sous « REFINING — 44.3434 · Z14 » | après REFINING Z10 vers 44.4011/5.7368, le cartouche réapparaît avec **44.3425** (l'ancien centre) et le garde **1,5 s** (`04-z11-02` → `04-z11-05`) ; run 1 : **4 895 ms** ; run 2 : **3 765 ms** après réapparition. Et à l'arrivée à Provence il montre **« 21.2600°S 55.7400°E · Réunion » pendant 74–600 ms** | **PERSONNE** | **ÉTABLIE.** `majCartoucheGlobe` (`main.js:5369`) remontre le groupe dès que `dem` revient ; `groundInfo.load` (`ground-info-layer.js:509`) attend `fonts` + **Nominatim + Wikipédia** (`ground-info.js:171`) avant `render(info)` : les anciennes mailles restent affichées tout le temps du réseau | **moyenne** — en changeant de région le cartouche porte le mauvais nom pendant le temps du réseau |
| **N4** | **Cartouche et nuages clignotent à chaque cran** (à 2 i/s la vidéo ne peut pas le montrer ; sonde rAF) | cachés **1 130 ms** (z10), **900 ms** (z11), **140 ms** (z12), **560 ms** (z13), **500 ms** (WIDENING), puis réapparaissent d'un coup | **PERSONNE** | choix documenté `main.js:5364` (`!!dem` dans le prédicat, `entrerEnVol` met `dem` à null) — mais c'est un claquement par cran, exactement ce que D18 interdit aux sommets | **basse-moyenne** |
| **N5** | **Cartouche à 2× le socle pendant WIDENING** | `09-sortie2-00.png` : rapport cartouche/parois **2,000**, cartouche VISIBLE ; run 2 (`09-sortie-2-tot`) : **4,001** (z13 → z11 d'un coup), 300–500 ms | **PERSONNE** (recoupe wt-soc ③, mais le cartouche n'est pas dans son brief) | `majCartoucheGlobe` lit `largeurBlocM()` (nouveau MNT) alors que `_parois` et `baseYCrop` gardent l'ancienne taille jusqu'à `poserCrop` (mesuré : `baseYCrop = −0,00214` = z13 avec `cropDemi` déjà z11) | **basse** |
| **N6** | **Fragments orange de l'ancien bord du crop** sur le terrain pendant WIDENING (à rapprocher des lamelles sombres de `m_092`) | run 2 `09-sortie-2-tot.png` : ≈ 20 traits orange **disposés sur le rectangle de l'ancien crop z13** ; run 3 `09-sortie2-00`…`-03`, disparus à `-04` (**≤ 1,2 s**) | **PERSONNE** (ou wt-soc si c'est la même famille que `m_092`) | hypothèse : le contour de grille (`applyGridContour`, `uGridColor` accent, `main.js:7798`) de l'ancien palier reste peint sur les tuiles jusqu'au retaillage — `zoom-bord-run3.png` montre ce même trait orange le long de l'arête du socle au repos | **basse-moyenne** |
| **N7** | **Console / réseau** | 2 avertissements HLSL par chargement (`f_surfaceFx_int` non initialisée, lignes 204 et 566 du programme), **0 pageerror, 0 HTTP ≥ 400**, **30 `ERR_ABORTED`** sur tuiles mapterhorn — dont des **z15–z17 demandées à z11** puis abandonnées | **PERSONNE** (la sur-demande touche wt-flu) | l'abandon est normal ; la demande de z17 à z11 ne l'est pas | **basse** |
| **N8** | **Cotes d'altitude** (« 808 m » `m_018`, « 1041 » coupé en haut `m_019`) énormes et coupées par le bord (« 661 m » 50 px coupé, run 1 `02-z13`), quand les toponymes font 3 px (§ N-réfuté 4) | visible sur toutes les captures z10–z13 | **PERSONNE** | text-label drapé, taille en unités de bloc | **basse** |
| ⑥ | **La Terre entière revient** hors molette | à 10° d'inclinaison le fond reste plat (`03-z09-incline`) ; à z13 après 3 crans arrière, **les coins bas montrent la mer du globe** (teal, `07-sortie-00`, `09-sortie2-00`) | **wt-vie** | — | haute |
| ①②③⑤⑦ | traits sur parois (`m_030`, `m_060` zoom : lignes blanches sur le mur noir), terre minuscule / plaque (`m_071`–`m_088` : **la « plaque » a le profil crénelé de l'ancien terrain**, c'est le socle du palier précédent), lamelles sous le terrain en WIDENING (`m_092` zoom), bande vide | non refait — sonde : **la caméra prend trois poses en 1,1 s à chaque cran** (`camY` 7,70 → 15,43 → 10,80 à z10 ; 7,55 → 15,11 → 10,59 à z11 ; 7,25 → 14,51 → 10,17 à z13), `cropDemi` change **349 ms** après `demZoom` | **wt-soc** | ③ : la caméra est re-exprimée dans les unités du nouveau bloc avant `_suivreEmprise` | haute |
| ④ | terrain blanc/délavé z11–z14 ; **couture diagonale brun / rose** entre deux régions de teinte (`m_037` zoom) ; bascule brutale à z9 sans REFINING (`m_011` → `m_012`) | non refait (RAMP est postérieur à la vidéo) | **wt-bla** | TUILE raffine par tuile, SUR renormalisait par bloc : deux rampes côte à côte | haute |
| flu | REFINING affiché 3–4 s (`m_005`–`m_011`, `m_041`–`m_047`, `m_070`–`m_077`) | `busy` ne dure que **339–379 ms** ; le label vit `MSG_MS = 3 600 ms` (`modes.js:149`). **fps : 60 à z9–z10, 43–55 à z11+, 24,6 pendant WIDENING** | **wt-flu** | l'étiquette dure dix fois plus que le chargement : elle fait croire à une attente | moyenne |

**Ce que je n'ai pas mesuré :** les toponymes sous le relief (ils font 3 px, on
ne peut pas le voir) ; la mer (aucune dans ce vol — wt-eau) ; la profondeur de
champ (`bokehEnabled: false` par défaut, `main.js:415` — la vidéo ne l'a pas
allumée : le flou de `m_037` et `m_099` est celui de l'encodage, voir § ③).

---

## ② VU UNE FOIS, NON REPRODUIT

- `m_030`–`m_033` : **« PROVENCE-ALPES-CÔTE D'AZUR » et « DIGNE-LES-BAINS » en
  double**, décalés, pendant le glissé de côté. La sonde dit que le groupe du
  cartouche est CACHÉ pendant qu'il change (N4), donc l'application ne peut pas
  en montrer deux : plutôt une traînée d'encodage sur un glissé. Non refait.
- `m_024`–`m_027` : tout le cartouche (nom, rose, description) **à très faible
  opacité** derrière les panneaux, sur le fond gris. Chez moi il est opaque.
  Peut-être le fondu d'entrée (`estompage-fondu`) vu en train de monter.
- `m_044` : un **petit panneau fantôme** translucide (1205–1260 × 555–630), en
  bas à droite. Rien de tel au banc.
- `m_095` : en WIDENING Z10, **le monde hors crop apparaît en rectangles bruns
  disjoints sur fond blanc** — des dalles qui arrivent une à une. C'est le
  retour de la Terre (wt-vie) vu pendant le chargement (wt-flu). Mon banc
  s'arrête à Z11.

---

## ③ CE QUE J'AI CRU, PUIS RÉFUTÉ

1. ⛔ **« Deux cartouches superposés, l'ancien et le nouveau » (`m_065`)** —
   `44.3630°N` et `44°21'47"N` sont **le même point**, décimal et sexagésimal :
   un seul cartouche, deux lignes (`ground-info-layer.js:406`, `coord` + `coordDMS`).
2. ⛔ **« Tout l'écran est flou : un filtre CSS ou la profondeur de champ »
   (`m_037`, `m_099`)** — le zoom de `m_037` montre **l'onglet Chrome et la barre
   d'adresse flous aussi**. C'est la capture/l'encodage. `m_099` est le fondu de
   fin d'enregistrement.
3. ⛔ **« La vidéo tourne sur une autre branche » (libellés Studio / Parcours)**
   — non : mêmes modules au caractère près (§ ⓪), et les deux libellés vivent
   dans `bars.js`.
4. ⛔ **« Les toponymes sont devenus minuscules — un bug » (GAP `m_021` ≈ 7 px,
   LARAGNE-MONTÉGLIN `m_091` ≈ 5 px ; mesuré au banc `sprite.scale.y × H/2` :
   5 px à z9, 3,2 px à z10–z13)** — c'est le choix d'Adrien du 2026-08-02
   (`places-layer.js:41-47`, `BASE_H = 0,007`, `sizeAttenuation:false`).
   ⚠️ Mais la note annonce « village 5,8–6,5 px, capitale 14 px » et je mesure
   **3,2 px** : soit ma formule, soit la note, est fausse d'un facteur ~2. À
   trancher avant de toucher.
5. ⛔ **« Un glissé de 160 px plonge la caméra à 206 m d'altitude : bug »**
   (run 1, `04-z14-glisse`) — c'est la loi d'OrbitControls (`rotateSpeed = 1`,
   160/800 × 2π ≈ 72°), la caméra orbite autour de la cible au sol. Pas un défaut.
6. ⛔ **« Le refine dure 3–4 s »** — `busy` dure 339–379 ms ; c'est l'étiquette
   qui vit 3,6 s (ligne « flu » du tableau).

---

## ④ LA RECETTE, EN SIX LIGNES

```
npx vite --host 127.0.0.1 --port 10512          # ⛔ pas de npm install
node scripts/banc-vid2.mjs 10512 .banc/VID2/run # tout le vol, captures + journal.json
→ N1 : 05-z14-repos.png (nuage sur la moitié de l'écran), 07-sortie-00.png (nuages posés)
→ N2 : 09-sortie2-00.png (nuage hors crop, à gauche)
→ N3 : journal.json, étapes 04-z11-02…05 (cartCoord = 44.3425 sous REFINING 44.4011)
→ N6 : 09-sortie2-00…03.png (traits orange), zoom-bord (arête orange au repos)
```

Les états qui comptent, tous vérifiés : `__exp.params.cloudAltitude` (13,5),
`__exp.globe._parois` (boîte × `matrixWorld` → largeur du bloc en unités de
globe, × 63 710 = mètres), `__exp.groundInfo.lastInfo.coord`,
`__exp.groundInfo.group.visible`, `__exp.clouds.group.visible`,
`__exp.modes.msgEl.textContent`. ⚠️ `cranZoom(1)` ne franchit un niveau qu'un
cran sur deux (budget continu) : deux appels par palier.
