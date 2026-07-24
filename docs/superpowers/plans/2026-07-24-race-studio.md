# Race Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sous-app « Race Studio » : un organisateur charge son GPX, pose logo/nom/points de passage (pictos, altitudes, horaires de clôture), règle carte/transports/style, puis valide vers la carte principale, sauvegarde un projet ré-ouvrable et partage — dans une fenêtre morph miroir de la boutique (colonne de travail à GAUCHE, 3D à DROITE).

**Architecture:** Réutilise le morph boutique (extrait en helper partagé), GpxLayerManager (style/nom/tête), share `#r=` (Blobs + OG), ground-info (flancs du bloc), Overpass (peaks.js). Neuf : `race-model.js` (logique pure testée), `race-labels.js` (cartouches HTML espace-écran, taille constante, anti-chevauchement DÉBRAYABLE), `transports.js` (POI par catégories), `studio.js` (wizard 5 étapes).

**Tech Stack:** vanilla JS + vite, three.js r172, node --test.

## Global Constraints

- Repo `C:/Dev/monolith-terrain`, branche `feat/orbital-globe`. Style du fichier hôte, pas de point-virgule superflu.
- Copy française du studio : étapes « ① Identité · ② Points de passage · ③ Carte & transports · ④ Style du tracé · ⑤ Exporter & partager » ; boutons « Envoyer vers la carte », « Enregistrer le projet », « Partager », « Quitter ».
- **Anti-chevauchement débrayable** (Adrien) : toggle « Anti-chevauchement des cartouches » dans l'étape ②, ON par défaut, persisté (`gpxLabelAvoid` dans TEMPLATE_KEYS).
- Les cartouches ne rétrécissent JAMAIS avec la perspective (espace écran, px constants).
- Validation = la création RESTE sur la carte principale (pas de restauration du snapshot — contraire de la boutique). Quitter sans valider = restauration.
- Format fichier : `.shibumap-race.json` `{format:'shibumap-race', version:1, race, look, gpx}` — `race` = `{name, logo(dataURL|null), waypoints[], transports}` ; `look` = clés TEMPLATE_KEYS ; `gpx` = XML source.
- Rituel : npm test + build à chaque tâche, commit par tâche ; deploy + push 2 branches + miroir Drive en fin.

---

### Task 1: `src/race-model.js` — logique pure (TDD)

**Files:** Create `src/race-model.js`, `test/race-model.test.js` ; Modify `package.json` (liste test).

**Interfaces (Produces):**
- `snapToKm(cumKm, km)` → index du point de trace le plus proche de `km` (clamp aux bornes).
- `ascentStats(eles, {hysteresis=8})` → `{dplus, dminus}` mètres arrondis — accumulation avec seuil d'hystérésis (les micro-oscillations DEM ne comptent pas).
- `layoutCartouches(items, {avoid=true, gap=6, minY=0, maxY=Infinity})` — items `[{y, h}]` triés/poussés verticalement sans chevauchement (glouton : tri par y, chaque item posé à `max(y, prev.bottom+gap)`, clamp). `avoid:false` → retourne les y d'origine. Retourne un tableau de y.
- `serializeRace({race, look, gpxText})` → string JSON ; `parseRace(text)` → `{race, look, gpxText}` ou `null` (garde format/version, waypoints assainis : `{km:number, name:string, alt:number|null, pictos:string[], cutoff:string}`).

- [ ] **Step 1: test qui échoue** — `test/race-model.test.js` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapToKm, ascentStats, layoutCartouches, serializeRace, parseRace } from '../src/race-model.js'

test('snapToKm accroche au point le plus proche et clampe', () => {
  const cum = [0, 1, 2.5, 4, 7]
  assert.equal(snapToKm(cum, 2.4), 2)
  assert.equal(snapToKm(cum, 3.4), 3)
  assert.equal(snapToKm(cum, -5), 0)
  assert.equal(snapToKm(cum, 99), 4)
})

test('ascentStats ignore les oscillations sous hystérésis', () => {
  // 0→100 (+100), bruit ±3 ignoré, 100→40 (−60)
  const eles = [0, 50, 100, 103, 100, 97, 100, 40]
  const { dplus, dminus } = ascentStats(eles, { hysteresis: 8 })
  assert.equal(dplus, 100)
  assert.equal(dminus, 60)
})

test('layoutCartouches pousse sans chevaucher, et sait se désactiver', () => {
  const items = [{ y: 10, h: 20 }, { y: 12, h: 20 }, { y: 80, h: 20 }]
  const ys = layoutCartouches(items, { avoid: true, gap: 6 })
  assert.equal(ys[0], 10)
  assert.equal(ys[1], 36) // 10+20+6
  assert.equal(ys[2], 80) // pas touché
  assert.deepEqual(layoutCartouches(items, { avoid: false }), [10, 12, 80])
})

test('serializeRace/parseRace round-trip et rejette le reste', () => {
  const bundle = { race: { name: '90km du Mont-Blanc', logo: null, waypoints: [{ km: 10, name: 'La Darbella', alt: 1210, pictos: ['ravito'], cutoff: '' }], transports: { cats: ['gare'], removed: [] } }, look: { gpxColor: '#ff4d00' }, gpxText: '<gpx></gpx>' }
  const parsed = parseRace(serializeRace(bundle))
  assert.equal(parsed.race.name, '90km du Mont-Blanc')
  assert.equal(parsed.race.waypoints[0].alt, 1210)
  assert.equal(parsed.gpxText, '<gpx></gpx>')
  assert.equal(parseRace('{"format":"nope"}'), null)
  assert.equal(parseRace('pas du json'), null)
})
```

- [ ] **Step 2:** `node --test test/race-model.test.js` → FAIL (module absent).
- [ ] **Step 3: implémentation**

```js
// src/race-model.js
// Race Studio — logique pure (testée en node) : accrochage km→point,
// dénivelés, résolution de chevauchement des cartouches, format .shibumap-race.

export function snapToKm(cumKm, km) {
  if (!cumKm?.length) return 0
  if (km <= cumKm[0]) return 0
  const last = cumKm.length - 1
  if (km >= cumKm[last]) return last
  let i = cumKm.findIndex((v) => v >= km)
  if (i <= 0) return 0
  return km - cumKm[i - 1] <= cumKm[i] - km ? i - 1 : i
}

// D+/D- avec hystérésis : on n'accumule un segment que quand le cumul depuis
// le dernier point de bascule dépasse le seuil (le bruit DEM ne compte pas)
export function ascentStats(eles, { hysteresis = 8 } = {}) {
  let dplus = 0
  let dminus = 0
  if (!eles?.length) return { dplus, dminus }
  let ref = eles[0]
  for (let i = 1; i < eles.length; i++) {
    const d = eles[i] - ref
    if (d >= hysteresis) { dplus += d; ref = eles[i] }
    else if (d <= -hysteresis) { dminus += -d; ref = eles[i] }
  }
  return { dplus: Math.round(dplus), dminus: Math.round(dminus) }
}

// pousse verticalement les cartouches pour qu'ils ne se chevauchent pas —
// glouton : tri par y souhaité, chacun posé sous le précédent si besoin.
// avoid:false (toggle Adrien) → positions d'origine, rien ne bouge.
export function layoutCartouches(items, { avoid = true, gap = 6, minY = 0, maxY = Infinity } = {}) {
  if (!avoid) return items.map((it) => it.y)
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.y - b.y)
  let bottom = minY
  const out = new Array(items.length)
  for (const it of order) {
    const y = Math.min(Math.max(it.y, bottom), maxY - it.h)
    out[it.i] = y
    bottom = y + it.h + gap
  }
  return out
}

const num = (v, d = null) => (Number.isFinite(+v) ? +v : d)
export function serializeRace({ race, look, gpxText }) {
  return JSON.stringify({ format: 'shibumap-race', version: 1, race, look, gpx: gpxText })
}
export function parseRace(text) {
  try {
    const j = JSON.parse(text)
    if (j?.format !== 'shibumap-race' || !j.race) return null
    const r = j.race
    return {
      race: {
        name: String(r.name || ''),
        logo: typeof r.logo === 'string' ? r.logo : null,
        waypoints: (Array.isArray(r.waypoints) ? r.waypoints : []).map((w) => ({
          km: num(w.km, 0),
          name: String(w.name || ''),
          alt: num(w.alt),
          pictos: Array.isArray(w.pictos) ? w.pictos.map(String) : [],
          cutoff: String(w.cutoff || ''),
        })),
        transports: { cats: Array.isArray(r.transports?.cats) ? r.transports.cats.map(String) : [], removed: Array.isArray(r.transports?.removed) ? r.transports.removed.map(String) : [] },
      },
      look: j.look && typeof j.look === 'object' ? j.look : {},
      gpxText: typeof j.gpx === 'string' ? j.gpx : '',
    }
  } catch { return null }
}
```

- [ ] **Step 4:** test → PASS. **Step 5:** ajouter ` test/race-model.test.js` au script `test` de package.json, `npm test` → PASS.
- [ ] **Step 6:** `git add … && git commit -m "feat(studio): race-model pur (snap km, D+/D-, layout cartouches, format .shibumap-race)"`

---

### Task 2: `src/race-labels.js` + CSS — cartouches espace-écran

**Files:** Create `src/race-labels.js`, `src/ui/race-labels.css` ; Modify `src/main.js` (instancier + update dans la boucle ~l.2772 près de `clouds.update`), `src/templates-user.js` (TEMPLATE_KEYS += `'gpxCartouches', 'gpxLabelAvoid'`), `src/main.js` params defaults (`gpxCartouches: true, gpxLabelAvoid: true`).

**Interfaces:**
- Consumes: `layoutCartouches` (T1) ; caméra + container ; une source `getItems()` fournie par main.js → `[{world:Vector3, km, name, alt, pictos[], cutoff, kind:'waypoint'|'transport'|'start'|'finish', id}]`.
- Produces: `buildRaceLabels({container, camera, getItems, params})` → `{ update(), setDirty(), dispose() }`. `update()` chaque frame : projette chaque item (world→NDC→px), cache si derrière (`v.z>1`) ou hors cadre, applique `layoutCartouches` par bande horizontale (gauche/droite du point d'ancrage : le cartouche se place à droite de l'ancre si l'ancre est dans la moitié gauche, sinon à gauche — flèche CSS orientée), taille px CONSTANTE.

**DOM d'un cartouche** (style Transju : badge km + nom + pictos, altitude en dessous) :
```html
<div class="rl-cart" data-id>
  <span class="rl-km">30</span><span class="rl-name">PRÉMANON</span><span class="rl-picto">…svg…</span>
  <span class="rl-sub">1 042 m · barrière 14h30</span>
  <i class="rl-leader"></i>
</div>
```
Transport = `.rl-chip` (picto + nom court, plus petit, ✕ au hover en mode studio via callback `onRemove`).

**Pictos** : objet `PICTOS = { ravito, eau, repas, dodo, wc, vue, col, secours, arrivee, gare, bus, telepherique, aeroport, metro, bateau }` — inline SVG 14×14 monochrome `currentColor`, dessinés simples (fourchette-couteau, goutte, bol, lit, WC, œil, chevron col, croix, drapeau damier, train, bus, cabine, avion, M, ancre).

**CSS clés** : `.rl-root { position:absolute; inset:0; pointer-events:none; overflow:hidden }` monté DANS `#app` (suit le cadre en mode studio/boutique) ; cartouches `position:absolute; transform:translate(x,y); font: 600 11px var(--ce-mono, monospace)` fond `#fff`/encre `hudInk`, liseré `hudAccent` ; AUCUNE mise à l'échelle par distance.

- [ ] Step 1: CSS. Step 2: module (projection : `v.copy(world).project(camera)` → `x=(v.x*0.5+0.5)*w`, `y=(-v.y*0.5+0.5)*h` ; regrouper par côté, construire items `{y,h}`, `layoutCartouches(items,{avoid:params.gpxLabelAvoid})`). Step 3: câblage main.js — `getItems()` construit depuis `raceState.waypoints` (T5) résolus via la track du layer actif (`world[idx]`, `alt = wp.alt ?? eles[idx]`), + transports (T3) ; `raceLabels.update()` dans la boucle. Masquer les vieux sprites waypoints quand `params.gpxCartouches && raceState.waypoints.length` (les sprites ne se reconstruisent pas : `layer.gpx.group` — les sprites `waypoints[]` reçoivent `visible=false` via une méthode `setSpritesMuted(v)` ajoutée à gpx.js). Step 4: build + test manuel. Step 5: commit.

---

### Task 3: `src/transports.js` — POI Overpass par catégories

**Files:** Create `src/transports.js`, `test/transports.test.js` (pur : parsing/catégorisation) ; Modify `src/main.js`.

**Interfaces:**
- `TRANSPORT_CATS = [{key:'gare', label:'Gares', q:'node["railway"="station"]'}, {key:'bus'…'node["amenity"="bus_station"]'}, {key:'telepherique'…'node["aerialway"~"station"]'|way aerialway=cable_car/gondola → station nodes}, {key:'aeroport'…'node["aeroway"="aerodrome"]|way…'}, {key:'metro'…'node["station"="subway"]'}, {key:'bateau'…'node["amenity"="ferry_terminal"]'}]`
- `fetchTransports(bounds, cats)` → `[{id, cat, name, lat, lon}]` (POST vers `https://overpass-api.de/api/interpreter` comme peaks.js:10-26, `[out:json]`, union des requêtes par cat, dédup par id, cache Map par `bounds+cats`).
- Pur/testé : `parseOverpassTransports(json)` → liste catégorisée (fixtures inline dans le test).
- main.js : `raceState.transports = {cats:Set, removed:Set, pois:[]}` ; à l'activation d'une cat (studio T5) → fetch + `raceLabels.setDirty()` ; les POI passent dans `getItems()` (kind 'transport', filtrés par `removed`).

- [ ] Steps : test parsing FAIL → module → PASS → intégration main.js → `npm test` + build → commit.

---

### Task 4: flancs du bloc — logo + infos course (capture Hawaii)

**Files:** Modify `src/ground-info-layer.js`, `src/ground-info.js`, `src/main.js`.

- Étendre `GroundInfoLayer` d'une méthode `setRace({logo, name, dplus, dminus, start, finish})` : sur le canvas de CHAQUE flanc, dessiner le logo (Image depuis dataURL) **centré** (hauteur ~55 % du flanc, ratio préservé), et **en haut à droite** un bloc texte : nom de la course (grand), `D+ 757 M · D− 805 M`, `LAMOURA → LES ROUSSES`. `setRace(null)` restaure la gravure standard. Textures régénérées via le même chemin `_addPlaneAt`/canvas que l'existant.
- Tête de parcours : au chargement du logo, `gpxLayer.setCustomIcon(activeId, texture)` (API existante gpx-layers.js:244).
- Câblage : `applyRaceToBlock()` dans main.js appelé quand raceState change (T5) et après rebuild du terrain (même hook que `groundInfo.load`).

- [ ] Steps : implémentation → build → vérif visuelle différée en T6 → commit.

---

### Task 5: `src/ui/studio.js` + `studio.css` + morph partagé — le wizard

**Files:** Create `src/ui/studio.js`, `src/ui/studio.css`, `src/ui/panel-morph.js` ; Modify `src/ui/store.js` (utilise panel-morph), `src/ui/store.css` (rien — les classes restent), `src/main.js` (raceState + buildStudio + boot `?studio=1` + garde clavier déjà générique via classes), `src/ui/route-panel.js` (bouton « Race Studio » accent en tête), `src/ui/v28.css` (masquage UI : ajouter `body.studio-mode` aux mêmes listes que store-mode).

**panel-morph.js** (extrait du pattern boutique) :
```js
export function makeMorph({ modeClass, onSettle }) {
  let t = 0
  const settle = () => { clearTimeout(t); document.body.classList.remove('morph-anim'); onSettle?.() }
  document.getElementById('app').addEventListener('transitionend', (e) => { if (e.target.id === 'app' && document.body.classList.contains('morph-anim')) settle() })
  return {
    enter() { document.body.classList.add('morph-anim', modeClass); clearTimeout(t); t = setTimeout(settle, 750) },
    exit() { document.body.classList.add('morph-anim'); document.body.classList.remove(modeClass); clearTimeout(t); t = setTimeout(settle, 750) },
  }
}
```
`onSettle` = `window.dispatchEvent(new Event('resize'))`. store.js migre dessus (remplace armSettle/onMorphEnd/settleMorph, `store-anim` → `morph-anim` dans store.css). studio.css : miroir — `body.studio-mode #app { top:22px; right:22px; bottom:34px; left: calc(min(42vw,560px) + 22px) }`, colonne `.studio-col { left:0; transform:translateX(-110%) }`, thème `--st-*` réutilisé tel quel (mêmes tokens, la colonne studio reprend les styles de cartes/chips/bar en préfixe `.studio-` qui composent les classes store existantes quand c'est identique — factoriser en copiant sobrement, pas d'abstraction de plus).

**studio.js — buildStudio(deps)** → `{enter, exit}`. État : `draft = {race:{name:'', logo:null, waypoints:[], transports:{cats:[],removed:[]}}, step:1}` autosauvé dans localStorage `shibumap-race-draft` à chaque mutation (JSON), restauré à l'enter.

Colonne : header wordmark « ShibuMap. *Race Studio* » + ✕ ; **rail** `① … ⑤` cliquable (étape courante accentuée) ; corps = l'étape courante ; barre basse : « Quitter » (ghost) · « Précédent/Suivant » · à l'étape ⑤ « Envoyer vers la carte » (accent).

- **① Identité** : champ nom ; input file logo (accept image/*, FileReader→dataURL, aperçu 96px, bouton retirer) ; bouton « Charger un GPX… » (réutilise `deps.loadGpx()`) ou « Ouvrir un projet… » (.shibumap-race.json → parseRace → restaure draft+look+gpx via `deps.importRace(bundle)`) ; dès qu'une track existe : carte récap D+/D- (`ascentStats(track.eles)`) + départ→arrivée (premier/dernier nom de waypoint ou « Départ »/« Arrivée »).
- **② Points de passage** : liste de lignes `[km] [nom] [alt auto (input, prérempli eles[snapToKm(...)])] [pictos toggle-chips] [clôture (input time optionnel)] [✕]` + « + Ajouter un point » ; **toggle « Anti-chevauchement des cartouches »** (params.gpxLabelAvoid) et toggle « Cartouches » (params.gpxCartouches). Chaque mutation → `deps.syncRace(draft.race)` (main.js pousse dans raceState + raceLabels.setDirty + applyRaceToBlock).
- **③ Carte & transports** : toggle villes (params.placesEnabled + densité) ; chips par TRANSPORT_CATS (activer → fetch) ; note « survolez un POI sur la carte pour le retirer » (✕ sur chip carte via onRemove → draft.transports.removed).
- **④ Style du tracé** : couleur (`gpxColor`), épaisseur (`gpxWidth`), dégradé (`gpxGradient` + mode), glow — réutiliser les setters que route-panel utilise (exposés via deps).
- **⑤ Exporter & partager** : « Enregistrer le projet » → `serializeRace({race:draft.race, look:captureLook(params), gpxText:deps.currentGpxText()})` → download `<slug>.shibumap-race.json` ; « Partager » → `deps.share()` (le flux `#r=` existant) ; « Envoyer vers la carte » → exit SANS restauration (la création reste), draft conservé pour y revenir.
- Quitter/✕/Échap → restauration snapshot (comme boutique) mais draft conservé.

main.js : `raceState` module-scope `{waypoints:[], transports:{...}, name, logo}` ; `syncRace` résout km→idx (`snapToKm`) et world ; `currentGpxText()` = le texte GPX source du layer actif (gpx-layers garde-t-il le texte ? sinon le stocker au addLayer — vérifier `addLayer(text…)` et conserver `layer.sourceText`).

- [ ] Steps : panel-morph + migration store → build → studio.css → studio.js (étapes une à une) → câblages → `npm test` + build → commit (2 commits : morph partagé ; studio).

---

### Task 6: Vérification navigateur + livraison

- [ ] Parcours complet en dev (`monolith`, :5199) : bouton Race Studio → morph miroir (colonne gauche, 3D droite) ; GPX chargé → D+/D- ; 3 waypoints avec pictos + 1 clôture → cartouches taille constante, anti-chevauchement ON puis OFF (toggle) ; transports gare+téléphérique sur une zone alpine ; logo → flancs + tête ; style tracé ; Enregistrer → fichier ; rouvrir le projet → état restauré ; Envoyer vers la carte → création conservée, UI revenue ; `?studio=1` ; Quitter sans valider → restauration. Console : zéro erreur.
- [ ] `npm test` + `npm run build` → verts. Commit final, push `adrien HEAD:feat/orbital-globe` + `HEAD:main`, `npx netlify deploy --prod --dir=dist`, `git pull` du miroir Drive.
- [ ] Mémoire : nouveau fichier `shibumap-race-studio.md` (+ ligne MEMORY.md) — architecture, format .shibumap-race, toggle anti-chevauchement, réutilisations.
