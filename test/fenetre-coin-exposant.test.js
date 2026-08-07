// L'OCTOGONE DE COUPE ET LA SUPERELLIPSE DU NUANCEUR DOIVENT PARLER DU MÊME COIN.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE FICHIER EXISTE POUR ATTRAPER
// ═══════════════════════════════════════════════════════════════════════════
// « Ça fait deux fois que je relève le même bug : la mer se découpe sans
// raison » (Adrien, deux captures). La nappe d'eau s'arrête net le long d'une
// LIGNE DROITE en diagonale qui ne suit aucun trait de côte ; au-delà, le
// relief sous-marin est à nu ; le socle et le terrain, eux, vont jusqu'au bord.
//
// La forme du coin du bloc a DEUX lecteurs, et un seul connaissait l'exposant :
//
//   · le NUANCEUR (terrain.js, le clip de socle) dessine une superellipse
//     d'exposant `uSlabCornerN` = `exposantCoin(slabCornerSmoothing)` — 4,4 au
//     réglage par défaut d'Adrien ;
//   · les PLANS DE COUPE (`Terrain.plansFenetre()` → `plansFenetre()`), huit
//     demi-plans posés sur les matériaux des calques drapés en mode continu
//     (map/water-layer.js `_coupeALaFenetre`, gpx.js), appelaient
//     `plansFenetre(half, corner)` — deux arguments, donc exposant 2.
//
// Un squircle est PLUS PLEIN qu'un cercle : sa bissectrice atteint
// `r·2^(1/2−1/n)` au lieu de `r`. Les quatre plans diagonaux tombaient donc
// DEDANS. Mesuré dans l'application (La Réunion z12, fenêtre continue, réglages
// par défaut) : plans à 38,670 141 contre 39,136 262 pour le relief, soit
// **0,466 unité de manque** dans chacun des quatre coins — une corde droite de
// ~1,8 unité qui remplace l'arc, et huit degrés d'arc seulement qui survivent
// de part et d'autre. Le manque vaut `r·(2^(1/2−1/n) − 1)` : il MONTE avec le
// rayon d'arrondi, jusqu'à ~5,8 unités sur un bloc très arrondi.
//
// Date d'apparition : c9b23f6, 2026-08-03 — le commit qui a justement AJOUTÉ le
// troisième paramètre à `plansFenetre` et branché `exposantCoin` dans le
// nuanceur. Le site d'appel de production n'a jamais été mis à jour.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI AUCUN TEST NE L'AVAIT VU, ET CE QU'ON VÉRIFIE DONC ICI
// ═══════════════════════════════════════════════════════════════════════════
// Il en existait pourtant un, et il énonce la BONNE propriété :
// `test/socle-matiere.test.js` — « l'octogone de la fenêtre continue reste
// DEHORS, squircle compris ». Il est vert depuis le premier jour. Il appelle
// `dansFenetre(x, z, half, r, n)` en LUI PASSANT l'exposant : il vérifie que la
// fonction pure sait faire, jamais que l'application le lui demande.
//
// C'est la faille de famille, pas celle d'un réglage : une règle pure, testée,
// juste — et un site d'appel qui retombe sur le défaut de signature. On vérifie
// donc les deux moitiés, et la seconde se lit sur la SOURCE (terrain.js tire
// three.js, il n'est pas importable sous node — même choix, et mêmes limites,
// que test/damier-uniformes.test.js) :
//
//   ① LA PROPRIÉTÉ GÉOMÉTRIQUE, sur toute la plage des deux réglages — avec son
//      TÉMOIN : à exposant 2 imposé, elle doit ÉCHOUER. Sans le témoin, le test
//      resterait vert le jour où quelqu'un neutralise `porteeCoin`.
//   ② LE SITE D'APPEL : tout appel de production à `plansFenetre` passe un
//      exposant DÉRIVÉ des uniformes, et cet exposant figure dans la clé de
//      mémoïsation — sinon bouger la tirette de lissage rendrait les plans
//      d'avant, et le défaut ne se corrigerait qu'au prochain coup sur le rayon.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { plansFenetre, dansFenetre, exposantCoin } from '../src/fenetre-clip.js'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')

const TAILLE = 56 // TERRAIN_SIZE
const HALF = TAILLE / 2

// Le rayon que le nuanceur reçoit, mot pour mot comme terrain.js le calcule.
const rayonSocle = (slabCorner) => Math.min(HALF - 0.05, Math.max(0.05, slabCorner * TAILLE))

// Un point du coin que le NUANCEUR dessine : superellipse d'exposant n, centrée
// sur (half − r, half − r). Transcription de `cq`/`pn` du clip de socle.
function pointDuCoinDessine(angle, half, r, n) {
  return [
    half - r + Math.pow(Math.cos(angle), 2 / n) * r,
    half - r + Math.pow(Math.sin(angle), 2 / n) * r,
  ]
}

// ── ① la propriété géométrique, et son témoin ────────────────────────────────

test('les plans de coupe ne mordent JAMAIS dans le coin que le nuanceur dessine', () => {
  // toute la plage des deux réglages, bornes comprises — 0,04 est le défaut
  // d'Adrien, 0,5 le bloc « pastille » que les gabarits peuvent poser.
  for (const slabCorner of [0, 0.01, 0.04, 0.12, 0.25, 0.4, 0.5, 1]) {
    const r = rayonSocle(slabCorner)
    for (const lissage of [0, 0.15, 0.3, 0.6, 0.85, 1]) {
      const n = exposantCoin(lissage)
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * (Math.PI / 2)
        const [x, z] = pointDuCoinDessine(a, HALF, r, n)
        assert.ok(
          dansFenetre(x, z, HALF, r, n),
          `arrondi ${slabCorner}, lissage ${lissage}, angle ${i} : le plan coupe dans le relief`
        )
      }
    }
  }
})

test('TÉMOIN — oublier l’exposant COUPE, et de combien', () => {
  // Si ce test devenait vert, la propriété ci-dessus ne prouverait plus rien :
  // elle passerait aussi avec un `plansFenetre` qui ignore son exposant.
  const r = rayonSocle(0.04) // 2,24 — le réglage par défaut
  const n = exposantCoin(0.6) // 4,4 — le lissage par défaut
  let coupes = 0
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * (Math.PI / 2)
    const [x, z] = pointDuCoinDessine(a, HALF, r, n)
    if (!dansFenetre(x, z, HALF, r, 2)) coupes++ // 2 = la signature d'avant
  }
  assert.ok(coupes > 60, `l'oubli devrait couper la majeure partie de l'arc, il n'en coupe que ${coupes}`)

  // et le manque mesuré, au chiffre : c'est lui qu'on a lu dans l'application.
  const diag = (plans) => plans.find((p) => Math.abs(p.normal[0]) > 0.1 && Math.abs(p.normal[2]) > 0.1).constant
  const manque = diag(plansFenetre(HALF, r, n)) - diag(plansFenetre(HALF, r, 2))
  assert.ok(Math.abs(manque - 0.46612) < 1e-5, `manque attendu 0,466 12 unité, obtenu ${manque}`)

  // et il MONTE avec le rayon : un bloc arrondi se ferait trancher bien plus.
  const rGros = rayonSocle(0.5)
  const manqueGros = diag(plansFenetre(HALF, rGros, n)) - diag(plansFenetre(HALF, rGros, 2))
  assert.ok(manqueGros > 5, `sur un bloc arrondi le manque devrait dépasser 5 unités, il vaut ${manqueGros}`)
})

// ── ② le site d'appel : ce que la fonction pure sait, l'application le demande ─

// Les fichiers de production qui posent des plans de coupe. `fenetre-clip.js`
// est exclu : c'est lui qui DÉFINIT la règle, ses appels internes portent déjà
// l'exposant reçu (`dansFenetre` le transmet).
const SOURCES = ['src/terrain.js', 'src/map/water-layer.js', 'src/gpx.js', 'src/block-grid.js', 'src/plinth.js', 'src/main.js']

// Découpe les arguments de premier niveau d'un appel, à partir de la parenthèse
// ouvrante. Suffisant ici : ces appels ne portent ni chaîne ni littéral objet.
function arguments1erNiveau(texte, iOuvrante) {
  const args = []
  let prof = 0
  let debut = iOuvrante + 1
  for (let i = iOuvrante; i < texte.length; i++) {
    const c = texte[i]
    if (c === '(' || c === '[' || c === '{') prof++
    else if (c === ')' || c === ']' || c === '}') {
      prof--
      if (prof === 0) {
        const dernier = texte.slice(debut, i).trim()
        if (dernier) args.push(dernier)
        return args
      }
    } else if (c === ',' && prof === 1) {
      args.push(texte.slice(debut, i).trim())
      debut = i + 1
    }
  }
  return args
}

// Les appels à la FABRIQUE de plans, sous le nom que ce fichier-là lui donne.
//
// ⚠️ ON PART DE L'IMPORT, PAS DU NOM. Chercher « plansFenetre » attraperait la
// MÉTHODE `Terrain.plansFenetre()` — qui porte le même nom, ne fabrique rien, et
// dont la signature vide est parfaitement légitime. Le nom sous lequel la
// fabrique entre dans un fichier est écrit dans son import, et lui seul.
function appelsAuxPlans(src) {
  const alias = new Set()
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*fenetre-clip\.js['"]/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim()
      const ren = t.match(/^plansFenetre\s+as\s+(\w+)$/)
      if (ren) alias.add(ren[1])
      else if (t === 'plansFenetre') alias.add('plansFenetre')
    }
  }
  const out = []
  for (const nom of alias) {
    const re = new RegExp(`(?<![.\\w])${nom}\\s*\\(`, 'g')
    for (const m of src.matchAll(re)) {
      const i = m.index + m[0].length - 1
      out.push({ nom, args: arguments1erNiveau(src, i) })
    }
  }
  return out
}

test('tout appel de production aux plans de coupe passe l’exposant du coin', () => {
  let vus = 0
  for (const f of SOURCES) {
    const src = lire(f)
    for (const appel of appelsAuxPlans(src)) {
      vus++
      assert.equal(
        appel.args.length,
        3,
        `${f} : ${appel.nom}(${appel.args.join(', ')}) — l'exposant du coin manque, les plans retomberont sur 2 (cercle) et trancheront le squircle`
      )
      assert.match(
        appel.args[2],
        /CornerN|exposantCoin|expo/,
        `${f} : le troisième argument « ${appel.args[2]} » ne vient pas de l'exposant du coin`
      )
    }
  }
  // canari : si l'appel disparaît (renommage, extraction), ce test ne doit pas
  // devenir vert en ayant cessé de regarder.
  assert.ok(vus >= 1, 'aucun appel aux plans de coupe trouvé — la propriété ne regarde plus rien')
})

test('l’exposant figure dans la clé qui mémoïse les plans', () => {
  // Sans lui, bouger la tirette de lissage rendrait les plans d'AVANT : le coin
  // du relief change, la coupe non — le même défaut, en différé.
  const src = lire('src/terrain.js')
  const i = src.indexOf('plansFenetre() {')
  assert.ok(i > 0, 'la méthode Terrain.plansFenetre() est introuvable — ce test a perdu sa cible')
  const corps = src.slice(i, i + 900)
  const cle = corps.match(/const cle = `([^`]*)`/)
  assert.ok(cle, 'aucune clé de mémoïsation dans Terrain.plansFenetre()')
  const expo = corps.match(/const (\w+)\s*=\s*u\.uSlabCornerN\.value/)
  assert.ok(expo, 'Terrain.plansFenetre() ne lit pas uSlabCornerN')
  assert.ok(
    cle[1].includes(`\${${expo[1]}}`),
    `la clé « ${cle[1]} » ne contient pas l'exposant « ${expo[1]} » : un changement de lissage rendrait les plans d'avant`
  )
})
