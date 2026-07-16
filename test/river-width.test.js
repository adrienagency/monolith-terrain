import { test } from 'node:test'
import assert from 'node:assert/strict'
import { riverWidthPx } from '../src/map/river-width.js'

test('riverWidthPx: min strokeweight (0) gives the floor width', () => {
  assert.equal(riverWidthPx(0), 0.8)
})

test('riverWidthPx: max strokeweight (9) gives the ceiling width', () => {
  assert.equal(riverWidthPx(9), 3.2)
})

test('riverWidthPx: undefined strokeweight falls back to a mid-weight default', () => {
  assert.ok(Math.abs(riverWidthPx(undefined) - 1.333) < 0.01)
})

test('riverWidthPx: mid-range strokeweight interpolates', () => {
  assert.equal(riverWidthPx(4.5), 2.0)
})

test('riverWidthPx: clamps out-of-range values', () => {
  assert.equal(riverWidthPx(-5), 0.8)
  assert.equal(riverWidthPx(20), 3.2)
})
