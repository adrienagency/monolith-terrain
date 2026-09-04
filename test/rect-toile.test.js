// LA BOÎTE DE LA TOILE, LUE UNE FOIS — Tâche FLU, postes ① et ②.
//
// Ces tests MORDENT sur le cache : un élément factice COMPTE ses lectures de
// `getBoundingClientRect` / `clientHeight`. Sans cache, mille appels font mille
// lectures forcées — c'est le défaut mesuré (9,6 % du glissé, 15 % du crop).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creerCacheToile } from '../src/monde/rect-toile.js'

function toileFactice() {
  const el = {
    lecturesRect: 0,
    lecturesHauteur: 0,
    _rect: { left: 10, top: 20, width: 1600, height: 1000 },
    _hauteur: 1000,
    getBoundingClientRect() { this.lecturesRect++; return { ...this._rect } },
    get clientHeight() { this.lecturesHauteur++; return this._hauteur },
  }
  return el
}

function fenetreFactice() {
  const ecouteurs = {}
  return {
    ecouteurs,
    addEventListener(nom, f) { (ecouteurs[nom] ||= []).push(f) },
    declenche(nom) { for (const f of ecouteurs[nom] || []) f() },
  }
}

class ObservateurFactice {
  static instances = []
  constructor(cb) { this.cb = cb; ObservateurFactice.instances.push(this) }
  observe(el) { this.el = el }
}

test('mille projections de pointeur ne coûtent qu UNE mise en page', () => {
  const el = toileFactice()
  let t = 0
  const cache = creerCacheToile(el, { Observateur: ObservateurFactice, fenetre: fenetreFactice(), maintenant: () => t })
  for (let i = 0; i < 1000; i++) {
    const r = cache.rect()
    assert.equal(r.width, 1600)
    t += 16 // 16 s en tout : sous le filet d une relecture par seconde ? non — voir plus bas
  }
  // 1000 images à 16 ms = 16 s, et le filet relit au plus une fois par seconde :
  // 17 lectures au plus, jamais 1 000. C est le rapport qui compte.
  assert.ok(el.lecturesRect <= 17, `${el.lecturesRect} lectures pour 1 000 appels`)
  assert.ok(el.lecturesRect >= 1)
})

test('sans le filet temporel, une seule lecture pour mille appels', () => {
  const el = toileFactice()
  const cache = creerCacheToile(el, { Observateur: ObservateurFactice, fenetre: fenetreFactice(), maintenant: () => 0 })
  for (let i = 0; i < 1000; i++) cache.rect()
  for (let i = 0; i < 1000; i++) cache.hauteurClient()
  assert.equal(el.lecturesRect, 1)
  assert.equal(el.lecturesHauteur, 1)
})

test('un redimensionnement (observateur, resize, scroll) invalide et fait relire', () => {
  const el = toileFactice()
  const fenetre = fenetreFactice()
  ObservateurFactice.instances.length = 0
  const cache = creerCacheToile(el, { Observateur: ObservateurFactice, fenetre, maintenant: () => 0 })
  assert.equal(ObservateurFactice.instances[0].el, el, 'la toile est observée')
  cache.rect(); cache.hauteurClient()
  el._rect = { left: 0, top: 0, width: 800, height: 500 }
  el._hauteur = 500
  // rien n a été invalidé : la valeur gardée est l ancienne
  assert.equal(cache.rect().width, 1600)
  assert.equal(cache.hauteurClient(), 1000)
  ObservateurFactice.instances[0].cb()
  assert.equal(cache.rect().width, 800, 'après l observateur, relu')
  assert.equal(cache.hauteurClient(), 500)
  el._rect.width = 640
  fenetre.declenche('resize')
  assert.equal(cache.rect().width, 640, 'après resize, relu')
  el._rect.width = 320
  fenetre.declenche('scroll')
  assert.equal(cache.rect().width, 320, 'après scroll, relu')
  assert.equal(el.lecturesRect, 4)
})

test('le contrat de contexteCrop est gardé : `undefined` sans toile ou à hauteur nulle', () => {
  const sans = creerCacheToile(null, { Observateur: ObservateurFactice, fenetre: fenetreFactice() })
  assert.equal(sans.hauteurClient(), undefined)
  assert.equal(sans.rect(), null)
  const plate = toileFactice(); plate._hauteur = 0
  const cache = creerCacheToile(plate, { Observateur: ObservateurFactice, fenetre: fenetreFactice(), maintenant: () => 0 })
  assert.equal(cache.hauteurClient(), undefined, '`clientHeight || undefined`, comme avant')
})
