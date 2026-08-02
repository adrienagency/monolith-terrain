import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  volcanDeLigne, volcansDansEmprise, volcansAMontrer, légendeVolcan, VOLCANS_MAX,
} from '../src/volcans.js'

const v = (nom, lat, lon, alt = 1000, type = 'Stratovolcano', an = null) =>
  volcanDeLigne([nom, lat, lon, alt, type, an])

// ── Le catalogue cuit ───────────────────────────────────────────────────────

test('le fichier cuit est là, complet, et porte son attribution', () => {
  // L'attribution du Smithsonian est une OBLIGATION, pas une politesse : ce
  // test est le seul endroit qui empêche qu'elle disparaisse silencieusement
  // lors d'une recuisson.
  const doc = JSON.parse(readFileSync('public/data/volcans.json', 'utf-8'))
  assert.ok(doc.volcans.length > 1100, `${doc.volcans.length} volcans`)
  assert.match(doc.attribution, /Smithsonian/)
  assert.match(doc.url, /volcano\.si\.edu/)
})

test('zéro n’est jamais gardé comme année d’éruption', () => {
  // Le GVP code « inconnu » par 0. Le laisser passer aurait affiché « éruption
  // en 0 » sur des centaines de volcans — et surtout les aurait classés parmi
  // les datés, donc devant des volcans réellement actifs.
  const doc = JSON.parse(readFileSync('public/data/volcans.json', 'utf-8'))
  assert.equal(doc.volcans.filter((l) => l[5] === 0).length, 0)
})

// ── L'emprise, et l'antiméridien ────────────────────────────────────────────

test('une emprise ordinaire garde ce qu’elle contient', () => {
  const liste = [v('dedans', 45, 6), v('trop au nord', 60, 6), v('trop à l’est', 45, 30)]
  const dedans = volcansDansEmprise(liste, { minLon: 5, maxLon: 7, minLat: 44, maxLat: 46 })
  assert.deepEqual(dedans.map((x) => x.nom), ['dedans'])
})

test('une emprise à cheval sur ±180° trouve ses volcans — la moitié du monde y est', () => {
  // ⚠️ LE PIÈGE QUI COMPTE. La ceinture de feu traverse le Pacifique : c'est
  // EXACTEMENT là que les emprises s'enroulent. Une comparaison directe
  // (minLon <= lon <= maxLon) rend faux pour TOUS les points quand
  // minLon = 170 et maxLon = -170, et la couche serait vide là où elle a le
  // plus à dire.
  const bbox = { minLon: 170, maxLon: -170, minLat: -10, maxLat: 10 }
  const liste = [v('Fidji', 0, 178), v('Samoa', 0, -175), v('Alpes', 45, 6), v('Andes', 0, -70)]
  const noms = volcansDansEmprise(liste, bbox).map((x) => x.nom).sort()
  assert.deepEqual(noms, ['Fidji', 'Samoa'])
})

test('le bord ouest exact est dedans, le bord est aussi', () => {
  const bbox = { minLon: 10, maxLon: 20, minLat: 0, maxLat: 10 }
  const noms = volcansDansEmprise([v('ouest', 5, 10), v('est', 5, 20), v('dehors', 5, 20.1)], bbox)
  assert.deepEqual(noms.map((x) => x.nom), ['ouest', 'est'])
})

// ── Le choix ────────────────────────────────────────────────────────────────

test('un petit volcan qui a craché hier passe devant un géant endormi', () => {
  // Le critère n'est PAS l'altitude. Un volcan intéresse parce qu'il est
  // vivant : le Stromboli fait 924 m et entre en éruption presque en continu,
  // une caldeira endormie de 4 000 m ne raconte rien.
  const bbox = { minLon: 0, maxLon: 20, minLat: 0, maxLat: 20 }
  const liste = [
    v('géant endormi', 5, 5, 4000, 'Caldera', -5000),
    v('petit actif', 6, 6, 924, 'Stratovolcano', 2024),
  ]
  assert.equal(volcansAMontrer(liste, bbox)[0].nom, 'petit actif')
})

test('les volcans sans date passent en dernier, mais ne disparaissent pas', () => {
  // « Pas de date » n'est pas « éteint » : c'est « personne n'était là pour le
  // voir ». Les exclure serait affirmer quelque chose que le catalogue ne dit
  // pas.
  const bbox = { minLon: 0, maxLon: 20, minLat: 0, maxLat: 20 }
  const liste = [v('sans date', 5, 5, 3000), v('daté', 6, 6, 100, 'Cone', 1900)]
  const out = volcansAMontrer(liste, bbox)
  assert.deepEqual(out.map((x) => x.nom), ['daté', 'sans date'])
})

test('le nombre est plafonné : quarante étiquettes ne valent pas quarante fois une', () => {
  const bbox = { minLon: 0, maxLon: 40, minLat: 0, maxLat: 40 }
  const liste = Array.from({ length: 40 }, (_, i) => v(`v${i}`, 10, i, 1000, 'Cone', 1900 + i))
  const out = volcansAMontrer(liste, bbox)
  assert.equal(out.length, VOLCANS_MAX)
  assert.equal(out[0].nom, 'v39', 'le plus récent en tête')
})

// ── La légende ──────────────────────────────────────────────────────────────

test('un volcan sous-marin le dit, il n’affiche pas une altitude négative', () => {
  assert.match(légendeVolcan(v('x', 0, 0, -1200, 'Submarine', 1952)), /1200 m sous la mer/)
})

test('l’absence de date se dit, elle ne s’invente pas', () => {
  assert.match(légendeVolcan(v('x', 0, 0, 800)), /aucune éruption datée/)
})

test('une éruption avant notre ère se lit comme telle', () => {
  assert.match(légendeVolcan(v('x', 0, 0, 800, 'Cone', -8300)), /8300 av\. J\.-C\./)
})

test('une ligne illisible ne casse rien', () => {
  assert.equal(volcanDeLigne(null), null)
  assert.equal(volcanDeLigne(['nom']), null)
  assert.equal(volcanDeLigne(['nom', 'x', 'y', 1, 'a', null]), null)
  assert.deepEqual(volcansDansEmprise(null, {}), [])
  assert.deepEqual(volcansDansEmprise([], null), [])
})
