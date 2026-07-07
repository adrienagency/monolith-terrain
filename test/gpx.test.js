import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Node has no DOMParser — a minimal GPX-shaped shim lets parseGpx's real
// logic run (selection order, decimation, NaN filtering, ele/name fallbacks).
class FakeNode {
  constructor(attrs, ele) {
    this._attrs = attrs
    this._ele = ele
  }
  getAttribute(k) {
    return this._attrs[k] ?? null
  }
  querySelector(sel) {
    return sel === 'ele' && this._ele != null ? { textContent: this._ele } : null
  }
}

class FakeDoc {
  constructor(text) {
    this.text = text
    this.invalid = !/^\s*<\??\s*[a-zA-Z?]/.test(text)
  }
  querySelectorAll(tag) {
    const out = []
    const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>|<${tag}\\b([^>]*)/>`, 'g')
    let m
    while ((m = re.exec(this.text))) {
      const attrStr = m[1] ?? m[3] ?? ''
      const inner = m[2] ?? ''
      const attrs = {}
      for (const a of attrStr.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2]
      const ele = inner.match(/<ele>([^<]*)<\/ele>/)?.[1] ?? null
      out.push(new FakeNode(attrs, ele))
    }
    return out
  }
  querySelector(sel) {
    if (sel === 'parsererror') return this.invalid ? {} : null
    if (sel.includes('name')) {
      const m = this.text.match(/<name>([^<]*)<\/name>/)
      return m ? { textContent: m[1] } : null
    }
    return null
  }
}

let parseGpx
before(async () => {
  globalThis.DOMParser = class {
    parseFromString(text) {
      return new FakeDoc(text)
    }
  }
  ;({ parseGpx } = await import('../src/gpx.js'))
})

const wrap = (inner) => `<?xml version="1.0"?><gpx><trk><name>Test Trk</name><trkseg>${inner}</trkseg></trk></gpx>`
const pt = (lat, lon, ele) => `<trkpt lat="${lat}" lon="${lon}">${ele != null ? `<ele>${ele}</ele>` : ''}</trkpt>`

test('parses the committed fixture', async () => {
  const text = await readFile(new URL('./fixtures-montenvers.gpx', import.meta.url), 'utf8')
  const { points, name } = parseGpx(text)
  assert.equal(name, 'Montenvers Climb')
  assert.equal(points.length, 80)
  assert.ok(points.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.ele)))
  assert.ok(points[0].ele < points[points.length - 1].ele, 'climbs')
})

test('decimates long tracks to the budget', () => {
  const pts = Array.from({ length: 6000 }, (_, i) => pt(45 + i * 1e-5, 6 + i * 1e-5, 1000 + i))
  const { points } = parseGpx(wrap(pts.join('')))
  assert.ok(points.length <= 2400, `${points.length} <= 2400`)
  assert.ok(points.length >= 1800, 'keeps most of the budget')
})

test('missing <ele> yields null (terrain fallback downstream)', () => {
  const { points } = parseGpx(wrap(pt(45, 6) + pt(45.001, 6.001)))
  assert.equal(points[0].ele, null)
})

test('skips malformed points, keeps valid ones', () => {
  const { points } = parseGpx(wrap(pt('abc', 6, 1) + pt(45, 6, 1) + pt(45.001, 6.001, 2)))
  assert.equal(points.length, 2)
})

test('throws on non-GPX input', () => {
  assert.throws(() => parseGpx('hello, not xml'), /not a valid GPX/)
})

test('throws when under two usable points', () => {
  assert.throws(() => parseGpx(wrap(pt(45, 6, 1))), /no track points|no usable/)
})
