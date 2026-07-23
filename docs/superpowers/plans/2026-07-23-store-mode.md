# Boutique in-app « morph » (store mode) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un bouton « View templates » dans le panneau Templates morphe l'app (sans reload) en boutique : le canvas 3D glisse dans un cadre vitrine (Yakushima verrouillée), une colonne droite propose Styles (looks complets) et Couleurs (palettes) testables en live et cochables ; « Intégrer à ShibuMap » les range dans les stores localStorage existants, puis l'app reprend sa forme et l'état de travail exact.

**Architecture:** Aucun iframe, aucun postMessage : le même contexte WebGL est re-cadré par CSS (FLIP sur `#app`), les essais appellent directement `applyUserTemplate` / `applyPaletteWithBg`. Le catalogue est le `data.json` dérivé de l'actuel `data.js` de la boutique publique, fetché à la demande. Le site public `/templates` devient une redirection Netlify vers `/?store=1`.

**Tech Stack:** vanilla JS + vite, three.js r172, CSS transitions, `node --test` pour les tests.

## Global Constraints

- Repo : `C:/Dev/monolith-terrain`, branche `feat/orbital-globe`. JS sans point-virgule superflu, style du fichier hôte.
- Copy EXACTE (décidée par Adrien) : bouton **« View templates »** ; sections **« Styles »** (looks complets) puis **« Couleurs »** (palettes) ; panneau de validation **« Intégrer à ShibuMap »** ; bouton **« Valider »**.
- Renommages : bouton create-panel `'Shuffle style'` → `'Shuffle look'` ; section create-panel `'Map Style'` → `'Shading'`.
- Zone vitrine : réutiliser `EMBED_SHOWCASE` (main.js:434, Yakushima `{lat:30.3435, lon:130.5, zoom:11}`) + `modes.locked`.
- Commerce caché : constante `STORE_COMMERCE = false` dans store.js — aucun prix affiché tant que false.
- Le protocole embed postMessage (main.js:3616-3640) est un contrat STABLE : ne pas y toucher.
- Tests : `npm test` (node --test). Build : `npm run build`. Jamais de nouveau fichier CSS chargé depuis index.html — les CSS sont importés par les modules JS (vite les extrait).

---

### Task 1: Module catalogue pur `src/store-catalog.js` (TDD)

**Files:**
- Create: `src/store-catalog.js`
- Test: `test/store-catalog.test.js`
- Modify: `package.json` (ajouter le test à la liste `npm test`)

**Interfaces:**
- Consumes: `parseTemplate` de `src/templates-user.js` (déjà exporté).
- Produces (utilisé par Task 3/4) :
  - `paletteRecordFromShop(entry)` → `{ id: 'shop_'+slug, name, rampStops, oceanShallow, oceanMid, oceanDeep }`
  - `styleTemplateText(entry)` → string JSON au format `.shibumap-template` (consommable par `importTemplateText`)
  - `mergeShopPalettes(existing, records)` → `{ list, added }` (dédup par `id`)
  - `notOwnedStyles(existingTemplates, entries)` → entries dont le `name` n'est pas déjà dans la liste user

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/store-catalog.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paletteRecordFromShop, styleTemplateText, mergeShopPalettes, notOwnedStyles } from '../src/store-catalog.js'
import { parseTemplate } from '../src/templates-user.js'

const SHOP_PALETTE = {
  slug: 'toundra', name: 'Toundra', family: 'terre', price: 4,
  rampStops: [{ c: '#5d6b4e', p: 0 }, { c: '#f2f4f2', p: 1 }],
  oceanShallow: '#c4ddd7', oceanMid: '#6ea6ab', oceanDeep: '#2c5c66',
}
const SHOP_STYLE = {
  slug: 'isolated', name: 'isolated', price: 12,
  strip: ['#fafafa', '#fafaff'],
  look: { rampStops: [{ c: '#fafafa', p: 0 }, { c: '#fafaff', p: 1 }], oceanShallow: '#c8f2e4', oceanMid: '#62cfc1', oceanDeep: '#136e7d', mapTint: 0.8 },
}

test('paletteRecordFromShop shapes a user-palette record', () => {
  const r = paletteRecordFromShop(SHOP_PALETTE)
  assert.equal(r.id, 'shop_toundra')
  assert.equal(r.name, 'Toundra')
  assert.deepEqual(r.rampStops, SHOP_PALETTE.rampStops)
  assert.equal(r.oceanDeep, '#2c5c66')
})

test('styleTemplateText round-trips through parseTemplate', () => {
  const parsed = parseTemplate(styleTemplateText(SHOP_STYLE))
  assert.ok(parsed)
  assert.equal(parsed.name, 'isolated')
  assert.equal(parsed.look.mapTint, 0.8)
  assert.deepEqual(parsed.strip, ['#fafafa', '#fafaff'])
})

test('mergeShopPalettes dedupes by id and is idempotent', () => {
  const rec = paletteRecordFromShop(SHOP_PALETTE)
  const first = mergeShopPalettes([], [rec])
  assert.equal(first.added, 1)
  const second = mergeShopPalettes(first.list, [rec])
  assert.equal(second.added, 0)
  assert.equal(second.list.length, 1)
})

test('notOwnedStyles filters by name', () => {
  const owned = [{ id: 'ut_x', name: 'isolated', look: {} }]
  assert.equal(notOwnedStyles(owned, [SHOP_STYLE]).length, 0)
  assert.equal(notOwnedStyles([], [SHOP_STYLE]).length, 1)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/store-catalog.test.js`
Expected: FAIL — `Cannot find module '.../src/store-catalog.js'`

- [ ] **Step 3: Implémenter le module**

```js
// src/store-catalog.js
// Boutique in-app (« store mode ») — mapping du catalogue /templates/data.json
// vers les stores utilisateur existants. Tout est pur (testable en node) :
// la partie DOM vit dans src/ui/store.js, l'écriture localStorage dans main.js.

// entrée « Couleurs » du catalogue → enregistrement compatible user-palettes.js
export function paletteRecordFromShop(entry) {
  return {
    id: `shop_${entry.slug}`,
    name: entry.name,
    rampStops: entry.rampStops.map((s) => ({ c: s.c, p: s.p })),
    oceanShallow: entry.oceanShallow,
    oceanMid: entry.oceanMid,
    oceanDeep: entry.oceanDeep,
  }
}

// entrée « Styles » (look complet) → texte .shibumap-template, le format que
// importTemplateText (main.js) sait déjà ranger dans les templates user.
export function styleTemplateText(entry) {
  return JSON.stringify({
    format: 'shibumap-template',
    version: 1,
    name: entry.name,
    strip: entry.strip ?? (entry.look.rampStops || []).map((s) => s.c),
    look: entry.look,
  })
}

// dédup par id : réintégrer une palette déjà possédée est un no-op silencieux
export function mergeShopPalettes(existing, records) {
  const have = new Set(existing.map((p) => p.id))
  const fresh = records.filter((r) => !have.has(r.id))
  return { list: existing.concat(fresh), added: fresh.length }
}

// styles déjà possédés (même nom) — on ne crée pas de doublon
export function notOwnedStyles(existingTemplates, entries) {
  const have = new Set(existingTemplates.map((t) => t.name))
  return entries.filter((e) => !have.has(e.name))
}
```

- [ ] **Step 4: Vérifier que ça passe**

Run: `node --test test/store-catalog.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Ajouter au script test**

Dans `package.json`, ligne `"test"`, ajouter ` test/store-catalog.test.js` à la fin de la liste. Run: `npm test` → tout PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store-catalog.js test/store-catalog.test.js package.json
git commit -m "feat(store): module catalogue pur (records palettes/styles + dédup)"
```

---

### Task 2: Catalogue JSON + remplacement du site public

**Files:**
- Create: `public/templates/data.json` (généré depuis data.js)
- Delete: `public/templates/index.html`, `public/templates/data.js`
- Modify: `netlify.toml`
- Keep: `public/templates/assets/*.json` (téléchargements, URLs stables)

**Interfaces:**
- Produces: `GET /templates/data.json` → `{ palettes: [36], templates: [2] }` (mêmes shapes qu'aujourd'hui dans `window.SHIBU_SHOP`).

- [ ] **Step 1: Générer data.json**

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('public/templates/data.js','utf8');const m=s.match(/window\.SHIBU_SHOP\s*=\s*(\{[\s\S]*\})\s*$/m);const j=JSON.parse(m[1]);fs.writeFileSync('public/templates/data.json',JSON.stringify(j));console.log('ok',j.palettes.length,'palettes')"
```
Expected: `ok 36 palettes`

- [ ] **Step 2: Supprimer le site statique**

```bash
git rm public/templates/index.html public/templates/data.js
```

- [ ] **Step 3: Redirection Netlify**

Ajouter à la fin de `netlify.toml` :

```toml
# /templates : l'ancienne vitrine statique est remplacée par la boutique
# in-app (décision Adrien 2026-07-23) — l'app s'ouvre en mode boutique.
# force=true : prime sur tout fichier statique résiduel. Les assets
# téléchargeables restent servis sous /templates/assets/.
[[redirects]]
  from = "/templates"
  to = "/?store=1"
  status = 302
  force = true

[[redirects]]
  from = "/templates/"
  to = "/?store=1"
  status = 302
  force = true
```

- [ ] **Step 4: Vérifier**

Run: `node -e "const j=require('./public/templates/data.json');console.log(j.palettes.length, j.templates.length)"`
Expected: `36 2`
Run: `npm run build` → succès.

- [ ] **Step 5: Commit**

```bash
git add -A public/templates netlify.toml
git commit -m "feat(store): catalogue data.json + /templates redirige vers ?store=1"
```

---

### Task 3: UI boutique `src/ui/store.js` + `src/ui/store.css`

**Files:**
- Create: `src/ui/store.js`, `src/ui/store.css`
- Modify: `src/ui/v28.css` (2 listes de sélecteurs : masquage UI en store-mode)

**Interfaces:**
- Consumes: `paletteRecordFromShop`, `styleTemplateText`, `mergeShopPalettes`, `notOwnedStyles` (Task 1).
- Produces: `buildStore(deps)` → `{ enter, exit, isOpen }`. `deps` (fournis par main.js en Task 4) :
  - `captureState()` → snapshot `{ look, lat, lon, zoom, loc, cam }`
  - `restoreState(snap)` → Promise
  - `gotoShowcase()` → Promise (charge Yakushima)
  - `setLocked(bool)` — `modes.locked`
  - `applyLook(look)`, `applyPalette(p)` — essais live
  - `getUserPalettes()`, `saveShopPalettes(list)`, `refreshPaletteRow()`
  - `getUserTemplates()`, `importTemplateText(text)`, `refreshTemplateRow()`

- [ ] **Step 1: CSS store.css**

```css
/* Boutique in-app (« store mode ») — le canvas 3D glisse dans un cadre
   vitrine, la colonne boutique arrive de la droite. Chorégraphie : les
   classes body.store-mode / body.store-anim sont posées par store.js. */

/* baseline explicite pour que la transition FLIP ait des valeurs de départ */
body.store-ready #app { position: fixed; inset: 0; z-index: 0; }

body.store-anim #app {
  transition: top .6s cubic-bezier(.22, .9, .26, 1), left .6s cubic-bezier(.22, .9, .26, 1),
    right .6s cubic-bezier(.22, .9, .26, 1), bottom .6s cubic-bezier(.22, .9, .26, 1),
    width .6s cubic-bezier(.22, .9, .26, 1), border-radius .6s cubic-bezier(.22, .9, .26, 1),
    box-shadow .6s ease;
}
body.store-mode #app {
  top: 28px; left: 28px; bottom: 28px; right: auto;
  width: min(50vw, 800px);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(20, 18, 14, .28), 0 2px 10px rgba(20, 18, 14, .12);
}
/* pendant le morph le canvas garde sa taille px : recadrage centré, pas de
   distorsion ; store.js resize le renderer aux transitionend */
body.store-mode #app canvas, body.store-anim #app canvas {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
}

.store-caption {
  position: fixed; left: 30px; bottom: 6px; z-index: 30;
  font: 500 10px/1.6 ui-monospace, monospace; letter-spacing: .14em;
  text-transform: uppercase; color: #8a8478; opacity: 0;
  transition: opacity .4s ease .35s; pointer-events: none;
}
body.store-mode .store-caption { opacity: 1; }

.store-col {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 40;
  width: min(42vw, 560px);
  background: #f4f1ea; color: #2a2620;
  box-shadow: -18px 0 50px rgba(20, 18, 14, .14);
  transform: translateX(110%);
  transition: transform .6s cubic-bezier(.22, .9, .26, 1);
  display: flex; flex-direction: column;
}
body.store-mode .store-col { transform: translateX(0); }

.store-head { display: flex; align-items: baseline; gap: 10px; padding: 26px 26px 14px; }
.store-head h2 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -.02em; }
.store-head .store-sub { font-size: 12px; color: #8a8478; }
.store-close {
  margin-left: auto; border: 0; background: none; cursor: pointer;
  font-size: 20px; line-height: 1; color: #8a8478; padding: 4px 8px;
}
.store-close:hover { color: #2a2620; }

.store-body { flex: 1; overflow-y: auto; padding: 0 26px 90px; }
.store-sec { margin-top: 14px; }
.store-sec-head {
  display: flex; align-items: center; gap: 8px; width: 100%;
  border: 0; background: none; cursor: pointer; padding: 8px 0;
  font: 600 11px/1 ui-monospace, monospace; letter-spacing: .16em;
  text-transform: uppercase; color: #6d675c;
}
.store-sec-head .count { color: #b3ac9e; font-weight: 500; }
.store-sec-head .chev { margin-left: auto; transition: transform .25s ease; }
.store-sec.open .chev { transform: rotate(180deg); }

.store-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.store-card {
  position: relative; border: 1px solid rgba(42, 38, 32, .1); border-radius: 12px;
  background: #fbf9f4; cursor: pointer; padding: 0 0 10px; overflow: hidden;
  text-align: left; transition: border-color .15s ease, transform .15s ease;
}
.store-card:hover { transform: translateY(-1px); border-color: rgba(42, 38, 32, .28); }
.store-card.live { border-color: #ff4d00; }
.store-card .strip { display: flex; height: 44px; }
.store-card .strip i { flex: 1; }
.store-card .meta { display: flex; align-items: center; gap: 6px; padding: 8px 10px 0; }
.store-card .nm { font-size: 13px; font-weight: 600; }
.store-card .sea { display: flex; gap: 3px; margin-left: auto; }
.store-card .sea i { width: 9px; height: 9px; border-radius: 50%; border: 1px solid rgba(42, 38, 32, .12); }
.store-check {
  position: absolute; top: 8px; right: 8px; width: 22px; height: 22px;
  border-radius: 7px; border: 1px solid rgba(42, 38, 32, .25);
  background: rgba(251, 249, 244, .92); cursor: pointer;
  display: grid; place-items: center; font-size: 13px; color: transparent;
}
.store-card.picked .store-check { background: #2a2620; border-color: #2a2620; color: #fbf9f4; }

/* fermé = 4 cartes visibles ; le chevron ouvre la section entière */
.store-sec:not(.open) .store-card:nth-child(n + 5) { display: none; }

.store-bar {
  position: absolute; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; gap: 12px;
  padding: 14px 26px; background: #efece3;
  border-top: 1px solid rgba(42, 38, 32, .08);
}
.store-bar .n { font-size: 13px; color: #6d675c; }
.store-bar button {
  margin-left: auto; border: 0; border-radius: 10px; cursor: pointer;
  background: #2a2620; color: #fbf9f4; font-weight: 600; font-size: 14px;
  padding: 11px 22px;
}
.store-bar button:disabled { opacity: .35; cursor: default; }

.store-modal-veil {
  position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
  background: rgba(30, 27, 22, .45); opacity: 0; pointer-events: none;
  transition: opacity .25s ease;
}
.store-modal-veil.on { opacity: 1; pointer-events: auto; }
.store-modal {
  width: min(88vw, 420px); border-radius: 16px; background: #fbf9f4;
  padding: 24px; box-shadow: 0 30px 80px rgba(20, 18, 14, .35);
}
.store-modal h3 { margin: 0 0 6px; font-size: 19px; }
.store-modal .hint { font-size: 12px; color: #8a8478; margin: 0 0 14px; }
.store-modal ul { margin: 0 0 18px; padding: 0 0 0 18px; font-size: 13px; }
.store-modal .row { display: flex; gap: 10px; justify-content: flex-end; }
.store-modal .row .ghost { background: none; border: 1px solid rgba(42, 38, 32, .25); color: #2a2620; }
.store-modal .row button { border: 0; border-radius: 10px; cursor: pointer; padding: 10px 18px; font-weight: 600; font-size: 13px; background: #2a2620; color: #fbf9f4; }

@media (max-width: 900px) {
  body.store-mode #app { left: 12px; top: 12px; bottom: 46vh; width: auto; right: 12px; }
  .store-col { width: 100vw; top: auto; height: 44vh; }
}
```

- [ ] **Step 2: Masquer l'UI de travail en store-mode (v28.css)**

Dans `src/ui/v28.css`, ajouter `body.store-mode` aux DEUX listes existantes :
1. La liste `body.ce-noui .ce-topbar, ...` (ligne ~929) : dupliquer chaque sélecteur avec `body.store-mode` (topbar, bottombar, panel, hud, altimeter, credits, gpx-profile).
2. La liste `body.ce-embed .ce-eye, ...` (ligne ~956) : ajouter `body.store-mode .ce-eye, body.store-mode .ce-hourpill, body.store-mode .zoom-stepper, body.store-mode .ce-changelog-btn`.
Faire pareil pour `.ce-isobtn` (ligne ~1062) et `.ce-mapbtn` (ligne ~1114) : ajouter le variant `body.store-mode`.

- [ ] **Step 3: store.js**

```js
// src/ui/store.js
// Boutique in-app — « View templates » morphe l'app en vitrine (canvas dans un
// cadre, Yakushima verrouillée) + colonne Styles/Couleurs testable en live.
// Décisions Adrien (2026-07-23) : pas d'iframe, essais par appels directs,
// intégration = stores localStorage existants, commerce caché.
import './store.css'
import { paletteRecordFromShop, styleTemplateText, mergeShopPalettes, notOwnedStyles } from '../store-catalog.js'

const STORE_COMMERCE = false // futur paiement — aucun prix tant que false
const CATALOG_URL = '/templates/data.json'

export function buildStore(deps) {
  let open = false
  let snap = null
  let catalog = null // { palettes, templates } — fetché au premier enter
  const picked = { styles: new Map(), colors: new Map() } // slug → entry

  document.body.classList.add('store-ready')

  // ---- DOM (construit une fois, monté au premier enter) ------------------
  const col = document.createElement('aside')
  col.className = 'store-col'
  col.innerHTML = `
    <div class="store-head">
      <h2>ShibuMap<span style="color:#ff4d00">.</span> Templates</h2>
      <span class="store-sub">testez en live, cochez, intégrez</span>
      <button class="store-close" title="Fermer">✕</button>
    </div>
    <div class="store-body"></div>
    <div class="store-bar"><span class="n">0 sélectionné</span><button disabled>Valider</button></div>`
  const body = col.querySelector('.store-body')
  const barN = col.querySelector('.store-bar .n')
  const barBtn = col.querySelector('.store-bar button')

  const caption = document.createElement('div')
  caption.className = 'store-caption'
  caption.textContent = 'Projection en direct — Yakushima · Japon'

  const veil = document.createElement('div')
  veil.className = 'store-modal-veil'

  function pickCount() { return picked.styles.size + picked.colors.size }
  function syncBar() {
    const n = pickCount()
    barN.textContent = n > 1 ? `${n} sélectionnés` : `${n} sélectionné`
    barBtn.disabled = n === 0
  }

  function card(entry, kind) {
    const stops = kind === 'styles' ? (entry.strip ?? entry.look.rampStops.map((s) => s.c)) : entry.rampStops.map((s) => s.c)
    const sea = kind === 'styles'
      ? [entry.look.oceanShallow, entry.look.oceanMid, entry.look.oceanDeep]
      : [entry.oceanShallow, entry.oceanMid, entry.oceanDeep]
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'store-card'
    el.innerHTML = `
      <span class="strip">${stops.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="meta"><span class="nm">${entry.name}</span>
        <span class="sea">${sea.map((c) => `<i style="background:${c}"></i>`).join('')}</span></span>
      <span class="store-check">✓</span>`
    // clic carte = ESSAI LIVE (la vue s'adapte, fond compris)
    el.addEventListener('click', () => {
      col.querySelectorAll('.store-card.live').forEach((c) => c.classList.remove('live'))
      el.classList.add('live')
      if (kind === 'styles') deps.applyLook(entry.look)
      else deps.applyPalette({ rampStops: entry.rampStops, oceanShallow: entry.oceanShallow, oceanMid: entry.oceanMid, oceanDeep: entry.oceanDeep })
    })
    // coche = sélection (sans déclencher l'essai)
    el.querySelector('.store-check').addEventListener('click', (e) => {
      e.stopPropagation()
      const bag = picked[kind]
      if (bag.has(entry.slug)) { bag.delete(entry.slug); el.classList.remove('picked') }
      else { bag.set(entry.slug, entry); el.classList.add('picked') }
      syncBar()
    })
    return el
  }

  function sectionEl(title, entries, kind) {
    const sec = document.createElement('div')
    sec.className = 'store-sec'
    const head = document.createElement('button')
    head.type = 'button'
    head.className = 'store-sec-head'
    head.innerHTML = `<span>${title}</span><span class="count">${entries.length}</span><span class="chev">▾</span>`
    head.addEventListener('click', () => sec.classList.toggle('open'))
    const grid = document.createElement('div')
    grid.className = 'store-grid'
    for (const e of entries) grid.append(card(e, kind))
    sec.append(head, grid)
    return sec
  }

  function renderCatalog() {
    body.innerHTML = ''
    body.append(
      sectionEl('Styles', catalog.templates, 'styles'),
      sectionEl('Couleurs', catalog.palettes, 'colors'),
    )
  }

  // ---- validation → « Intégrer à ShibuMap » ------------------------------
  function openIntegrate() {
    const names = [...picked.styles.values(), ...picked.colors.values()].map((e) => e.name)
    veil.innerHTML = `
      <div class="store-modal">
        <h3>Intégrer à ShibuMap</h3>
        <p class="hint">Vos sélections rejoignent vos palettes et vos templates, prêtes à l'emploi.</p>
        <ul>${names.map((n) => `<li>${n}</li>`).join('')}</ul>
        <div class="row"><button class="ghost">Annuler</button><button class="go">Intégrer</button></div>
      </div>`
    veil.classList.add('on')
    veil.querySelector('.ghost').addEventListener('click', () => veil.classList.remove('on'))
    veil.querySelector('.go').addEventListener('click', () => {
      // Couleurs → store user-palettes (dédup par id shop_<slug>)
      const records = [...picked.colors.values()].map(paletteRecordFromShop)
      const { list } = mergeShopPalettes(deps.getUserPalettes(), records)
      deps.saveShopPalettes(list)
      deps.refreshPaletteRow()
      // Styles → même chemin que l'import de fichier .shibumap-template
      for (const e of notOwnedStyles(deps.getUserTemplates(), [...picked.styles.values()])) {
        deps.importTemplateText(styleTemplateText(e))
      }
      deps.refreshTemplateRow()
      veil.classList.remove('on')
      exit() // « ShibuMap reprend sa forme initiale »
    })
  }

  // ---- morph -------------------------------------------------------------
  function onMorphEnd(e) {
    if (e.target.id !== 'app') return
    document.body.classList.remove('store-anim')
    window.dispatchEvent(new Event('resize')) // renderer/composer → nouvelle box
  }

  // écoute unique (PAS dans enter() — sinon les listeners s'empilent)
  document.getElementById('app').addEventListener('transitionend', onMorphEnd)

  async function enter() {
    if (open) return
    open = true
    snap = deps.captureState()
    if (!col.isConnected) document.body.append(col, caption, veil)
    document.body.classList.add('store-anim', 'store-mode')
    deps.setLocked(true)
    deps.gotoShowcase().catch(() => {}) // vole vers Yakushima pendant le morph
    if (!catalog) {
      try { catalog = await (await fetch(CATALOG_URL)).json() } catch { catalog = { palettes: [], templates: [] } }
      renderCatalog()
    }
    syncBar()
  }

  async function exit() {
    if (!open) return
    open = false
    picked.styles.clear(); picked.colors.clear()
    col.querySelectorAll('.picked, .live').forEach((c) => c.classList.remove('picked', 'live'))
    veil.classList.remove('on')
    document.body.classList.add('store-anim')
    document.body.classList.remove('store-mode')
    deps.setLocked(false)
    try { await deps.restoreState(snap) } catch {}
    snap = null
  }

  barBtn.addEventListener('click', openIntegrate)
  col.querySelector('.store-close').addEventListener('click', exit)
  window.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') exit() })

  return { enter, exit, isOpen: () => open }
}
```

- [ ] **Step 4: Build sanity**

Run: `npm run build` → succès (store.js pas encore importé, vite ne le voit pas — normal).

- [ ] **Step 5: Commit**

```bash
git add src/ui/store.js src/ui/store.css src/ui/v28.css
git commit -m "feat(store): UI boutique morph (colonne, cartes, validation, CSS)"
```

---

### Task 4: Câblage main.js + bouton panneau + renommages

**Files:**
- Modify: `src/main.js` (imports ~55-75, evenSize/resize ~3652, après le bloc EMBED ~3640, panelCtx ~2980-3100, setTimeout tour ~3641)
- Modify: `src/ui/templates-panel.js` (bouton en tête, registre refresh)
- Modify: `src/ui/create-panel.js` (2 renommages)

**Interfaces:**
- Consumes: `buildStore(deps)` (Task 3) ; `loadUserPalettes`, `saveUserPalettes` (`src/user-palettes.js`) ; `captureLook` ; `loadRealTerrain` ; `EMBED_SHOWCASE` ; `applyPaletteWithBg` ; `importTemplateText` ; `paletteRefreshFn`.
- Produces: `panelCtx.openStore()` ; `panelCtx.registerUserTplRefresh(fn)` ; boot `?store=1`.

- [ ] **Step 1: Refresh de la rangée templates user (miroir de paletteRefreshFn)**

Dans `src/main.js`, sous `let paletteRefreshFn = () => {}` (ligne 1893), ajouter :
```js
let userTplRefreshFn = () => {} // re-rend la rangée des templates user (boutique → intégration)
```
Dans `panelCtx`, à côté de `registerPaletteRefresh` (ligne ~2987), ajouter :
```js
registerUserTplRefresh: (fn) => { userTplRefreshFn = fn },
```
Dans `src/ui/templates-panel.js`, après la définition de `renderUserTemplates` (ligne ~129), ajouter :
```js
ctx.registerUserTplRefresh?.(renderUserTemplates)
```

- [ ] **Step 2: evenSize suit le container (pas la window)**

Localiser `evenSize` dans main.js (`grep -n "evenSize" src/main.js`). Remplacer sa source `window.innerWidth/innerHeight` par `container.clientWidth/clientHeight` (fallback window si 0). En store-mode, `#app` EST la box du cadre → le même handler resize sert les deux mondes. Vérifier que le listener resize (ligne 3652) met aussi `camera.aspect` à jour depuis ces mêmes dimensions ; sinon l'y ajouter :
```js
camera.aspect = container.clientWidth / container.clientHeight
camera.updateProjectionMatrix()
```

- [ ] **Step 3: Construire le store (main.js, APRÈS le bloc EMBED ~ligne 3640)**

```js
// ---- boutique in-app (« View templates ») --------------------------------
// Voir src/ui/store.js. Réutilise EMBED_SHOWCASE + modes.locked (la zone de
// test Yakushima limite le chargement, comme l'embed).
import { buildStore } from './ui/store.js' // ← en tête de fichier avec les autres imports
import { loadUserPalettes, saveUserPalettes } from './user-palettes.js' // déjà importé ? compléter

const store = buildStore({
  captureState: () => ({
    look: captureLook(params),
    lat: params.demLat, lon: params.demLon, zoom: params.demZoom, loc: params.demLocation,
    cam: { pos: camera.position.clone(), target: controls.target.clone() },
  }),
  restoreState: async (s) => {
    if (!s) return
    applyUserTemplate({ look: s.look })
    if (s.lat !== params.demLat || s.lon !== params.demLon || s.zoom !== params.demZoom) {
      params.demLat = s.lat; params.demLon = s.lon; params.demZoom = s.zoom
      params.demLocation = s.loc
      await loadRealTerrain()
    }
    camera.position.copy(s.cam.pos)
    controls.target.copy(s.cam.target)
    controls.update()
    refreshAll()
  },
  gotoShowcase: async () => {
    params.demLat = EMBED_SHOWCASE.lat; params.demLon = EMBED_SHOWCASE.lon; params.demZoom = EMBED_SHOWCASE.zoom
    params.demLocation = 'Yakushima'
    await loadRealTerrain()
  },
  setLocked: (v) => { modes.locked = v },
  applyLook: (look) => { applyUserTemplate({ look }); refreshAll() },
  applyPalette: (p) => { applyPaletteWithBg(p); refreshAll() },
  getUserPalettes: () => loadUserPalettes(),
  saveShopPalettes: (list) => saveUserPalettes(list),
  refreshPaletteRow: () => paletteRefreshFn(),
  getUserTemplates: () => userTemplates,
  importTemplateText,
  refreshTemplateRow: () => userTplRefreshFn(),
})
```
NOTE : les `import` vont en tête de fichier ; si `loadUserPalettes/saveUserPalettes` sont déjà importés (grep), ne pas dupliquer. `panelCtx.openStore = () => store.enter()` — ajouter la clé dans panelCtx OU, si panelCtx est déjà construit avant ce point, faire `panelCtx.openStore = () => store.enter()` après coup (panelCtx est un objet littéral — l'affectation après coup marche car templates-panel lit `ctx.openStore?.()` au clic, pas au build).

- [ ] **Step 4: Boot `?store=1` + garde des raccourcis clavier**

À côté de `IS_EMBED` (ligne 433) :
```js
const IS_STORE_BOOT = new URLSearchParams(location.search).has('store')
```
Dans le `setTimeout` du tour (ligne ~3641, qui commence par `if (EMBED) return`), ajouter juste après :
```js
if (IS_STORE_BOOT) { store.enter(); return } // /templates → boutique directe, jamais le tour
```
Raccourcis clavier : localiser le listener global (`grep -n "addEventListener('keydown'" src/main.js src/shortcuts.js`) et ajouter en tête de handler :
```js
if (document.body.classList.contains('store-mode')) return // boutique ouverte : clavier app off (Échap géré par store.js)
```

- [ ] **Step 5: Bouton « View templates » (templates-panel.js)**

Dans `buildTemplatesPanel` (src/ui/templates-panel.js), juste AVANT le bloc « Reset map » (le commentaire `// ---- Reset map` ligne ~25), insérer — même mécanisme `panel.body.append` que la rangée Reset, mais ajouté en premier donc premier dans le DOM :
```js
// ------------------------------------------------------------- Boutique
// « View templates » — morphe l'app en vitrine boutique (src/ui/store.js) :
// essais live sur Yakushima verrouillée, intégration vers les rangées
// Palettes / templates user ci-dessous.
const storeWrap = el('div', 'ce-btn-row')
const storeBtn = button('View templates', () => ctx.openStore?.(), { accent: true })
storeBtn.setAttribute('data-tip', 'Browse Styles & Couleurs, try them live, bring back what you like.')
storeWrap.append(storeBtn)
panel.body.append(storeWrap)
```

- [ ] **Step 6: Renommages (create-panel.js)**

- Ligne 63 : `button('Shuffle style', ...)` → `button('Shuffle look', ...)`
- Ligne 127 : `section('Map Style')` → `section('Shading')`

- [ ] **Step 7: Tests + build**

Run: `npm test` → tout PASS. Run: `npm run build` → succès.

- [ ] **Step 8: Commit**

```bash
git add src/main.js src/ui/templates-panel.js src/ui/create-panel.js
git commit -m "feat(store): câblage app — bouton View templates, boot ?store=1, snapshot/restore"
```

---

### Task 5: Vérification navigateur + déploiement

**Files:** aucun nouveau — vérification + rituel de livraison.

- [ ] **Step 1: Vérif live (dev server `monolith`, port 5199)**

1. Charger `http://localhost:5199/` — état normal, bouton « View templates » en tête du panneau Templates.
2. Cliquer → morph : canvas dans le cadre arrondi à gauche, caption « Projection en direct — Yakushima · Japon », colonne boutique à droite, AUCUNE UI de travail, Yakushima charge.
3. Cliquer une carte Couleur → la vue ET le fond changent. Cliquer une carte Style → look complet appliqué.
4. Cocher 1 style + 2 couleurs → barre « 3 sélectionnés » → Valider → panneau « Intégrer à ShibuMap » → Intégrer.
5. Sortie automatique : morph inverse, zone/caméra/look de départ restaurés, les 2 palettes dans la rangée Palettes, le style dans les templates user.
6. Rouvrir/fermer par ✕ et par Échap sans valider → restauration, rien d'ajouté.
7. `http://localhost:5199/?store=1` → boutique directe après le boot.
8. Console : zéro erreur (read_console_messages).

- [ ] **Step 2: Livraison (rituel du projet)**

```bash
npm test && npm run build
git push adrien HEAD:feat/orbital-globe && git push adrien HEAD:main
npx netlify deploy --prod --dir=dist
```
Puis sync du miroir Drive (`G:/My Drive/_GITHUB/monolith-terrain` : `git pull`) et vérifier `https://shibumap.com/templates` → redirige vers la boutique.

- [ ] **Step 3: Mémoire**

Mettre à jour `shibumap-templates-site.md` : site statique remplacé par la boutique in-app (`?store=1`), `/templates` = redirection, catalogue = `data.json`, protocole embed conservé mais plus utilisé par le site.
