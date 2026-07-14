// Known-race info bubble. When a GPX loads over a place with a notable race,
// a discreet badge appears; clicking it opens a closable card. If several races
// match, the card lists them so the visitor picks the one they care about — or
// just closes it. Everything is sourced live from Wikipedia (race-info.js).

import { el } from './kit.js'
import { fetchRaceDetail } from '../race-info.js'

export function buildRacePanel() {
  const badge = el('button', 'ce-race-badge hidden')
  badge.type = 'button'
  badge.innerHTML = '<span class="ce-race-flag">🏁</span> Course détectée — voir les infos'
  const card = el('div', 'ce-race-card ce-glassbox hidden')
  document.body.append(badge, card)

  let candidates = []

  const hide = () => { badge.classList.add('hidden'); card.classList.add('hidden'); card.replaceChildren() }
  const closeCard = () => { card.classList.add('hidden'); card.replaceChildren() }

  function head(title, onBack) {
    const h = el('div', 'ce-race-head')
    if (onBack) {
      const b = el('button', 'ce-race-back', '‹')
      b.type = 'button'
      b.title = 'Back'
      b.addEventListener('click', onBack)
      h.append(b)
    }
    h.append(el('div', 'ce-race-title', title))
    const x = el('button', 'ce-race-x', '✕')
    x.type = 'button'
    x.title = 'Close'
    x.addEventListener('click', hide)
    h.append(x)
    return h
  }

  function renderList() {
    card.replaceChildren(head('Courses à cet endroit', null))
    const list = el('div', 'ce-race-list')
    for (const c of candidates) {
      const row = el('button', 'ce-race-row')
      row.type = 'button'
      const thumb = c.thumb ? `<img class="ce-race-thumb" src="${c.thumb}" alt="">` : '<span class="ce-race-thumb"></span>'
      const meta = c.participants ? `${c.participants.toLocaleString('fr-FR')} participants` : ''
      row.innerHTML = `${thumb}<span class="ce-race-rowtxt"><b>${esc(c.title)}</b><small>${meta}</small></span>`
      row.addEventListener('click', () => openDetail(c))
      list.append(row)
    }
    card.append(list)
    card.classList.remove('hidden')
  }

  async function openDetail(c) {
    const back = candidates.length > 1 ? renderList : null
    card.replaceChildren(head(c.title, back), el('div', 'ce-race-body', 'Chargement…'))
    card.classList.remove('hidden')
    const d = await fetchRaceDetail(c)
    const body = el('div', 'ce-race-body')
    if (c.participants) body.append(el('div', 'ce-race-tag', `${c.participants.toLocaleString('fr-FR')} participants`))
    if (d.description) body.append(el('p', 'ce-race-desc', d.description))
    if (d.winners?.length) {
      body.append(el('div', 'ce-race-sub', 'Palmarès'))
      const ul = el('ul', 'ce-race-win')
      for (const w of d.winners) ul.append(el('li', null, w))
      body.append(ul)
    }
    const link = el('a', 'ce-race-link', 'Article Wikipédia ↗')
    link.href = d.url
    link.target = '_blank'
    link.rel = 'noopener'
    body.append(link)
    card.replaceChildren(head(c.title, back), body)
  }

  // called by main.js after a GPX loads with the candidates from race-info
  function offer(cands) {
    candidates = cands || []
    card.classList.add('hidden')
    card.replaceChildren()
    if (!candidates.length) { badge.classList.add('hidden'); return }
    badge.classList.remove('hidden')
  }
  badge.addEventListener('click', () => {
    badge.classList.add('hidden')
    if (candidates.length === 1) openDetail(candidates[0])
    else renderList()
  })

  return { offer, hide }
}

function esc(s = '') {
  return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
}
