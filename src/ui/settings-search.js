// Recherche de réglages — la palette « K » (plan table lumineuse, inspirée
// de Linear/Raycast) : l'app compte ~200 contrôles, taper « bloom » doit
// suffire. L'index se construit en SCANNANT le DOM des panneaux à l'ouverture
// (les labels existent déjà — zéro duplication), le choix ouvre le panneau et
// la section, fait défiler jusqu'au contrôle et le fait pulser.
import { el } from './kit.js'

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function buildSettingsSearch({ actions = [] } = {}) {
  const veil = el('div', 'ce-ksearch-veil')
  const box = el('div', 'ce-ksearch ce-glassbox')
  const input = el('input', 'ce-ksearch-input')
  input.type = 'text'
  input.placeholder = 'Rechercher un réglage ou une action…'
  input.spellcheck = false
  const list = el('div', 'ce-ksearch-list')
  box.append(input, list)
  veil.append(box)
  document.body.append(veil)

  let entries = []
  let sel = 0

  // l'index est refait à CHAQUE ouverture : les panneaux re-rendent leurs
  // contrôles librement (pickers, visibleWhen), un index figé mentirait
  function buildIndex() {
    entries = []
    for (const a of actions) entries.push({ kind: 'action', text: a.label, hint: 'Action', run: a.run })
    for (const p of document.querySelectorAll('.ce-panel')) {
      const panelTitle = p.querySelector('.ce-panel-title span')?.textContent?.trim() || ''
      for (const sec of p.querySelectorAll('.ce-section')) {
        const secTitle = sec.querySelector('.ce-section-title')?.textContent?.trim() || ''
        entries.push({ kind: 'section', text: secTitle, hint: panelTitle, p, sec, node: sec })
        for (const lab of sec.querySelectorAll('.ce-label')) {
          // texte du label SEUL — sans le readout de valeur (span enfant)
          const text = [...lab.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() || lab.textContent?.trim()
          if (!text || text.length < 2) continue
          entries.push({ kind: 'setting', text, hint: `${panelTitle} › ${secTitle}`, p, sec, node: lab.parentElement || lab })
        }
      }
    }
  }

  function reveal(entry) {
    // la palette peut être appelée depuis le mode simple : naviguer vers un
    // réglage EST un choix de mode avancé — on le persiste (règle : jamais
    // d'UI fantôme, le réglage montré doit être réellement visible)
    if (document.body.classList.contains('ce-simple')) {
      try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {}
      document.body.classList.remove('ce-simple')
      document.querySelector('.ce-advbtn')?.classList.add('on')
    }
    // ouvrir le panneau (accordéon exclusif : replier les voisins du dock)
    const dock = entry.p.parentElement
    for (const sib of dock.querySelectorAll('.ce-panel')) sib.classList.add('collapsed')
    entry.p.classList.remove('collapsed')
    // ouvrir la section (exclusif dans le panneau)
    for (const s of entry.p.querySelectorAll('.ce-section')) s.classList.remove('open')
    entry.sec.classList.add('open')
    entry.node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    entry.node.classList.add('ce-kpulse')
    setTimeout(() => entry.node.classList.remove('ce-kpulse'), 1600)
  }

  function render(q) {
    const nq = norm(q)
    const hits = !nq
      ? entries.filter((e) => e.kind !== 'setting').slice(0, 12)
      : entries
          .map((e) => ({ e, i: norm(e.text).indexOf(nq) }))
          .filter((x) => x.i >= 0)
          .sort((a, b) => (a.e.kind === 'action' ? -1 : 0) - (b.e.kind === 'action' ? -1 : 0) || a.i - b.i || a.e.text.length - b.e.text.length)
          .slice(0, 12)
          .map((x) => x.e)
    sel = 0
    list.replaceChildren()
    hits.forEach((e, i) => {
      const row = el('button', 'ce-ksearch-row' + (i === sel ? ' sel' : ''))
      row.type = 'button'
      row.innerHTML = `<b></b><i></i>`
      row.querySelector('b').textContent = e.text
      row.querySelector('i').textContent = e.hint
      row.addEventListener('click', () => pick(e))
      list.append(row)
    })
    list._hits = hits
  }

  function pick(e) {
    close()
    if (e.kind === 'action') e.run()
    else reveal(e)
  }

  function openPalette() {
    buildIndex()
    veil.classList.add('open')
    input.value = ''
    render('')
    input.focus()
  }
  function close() {
    veil.classList.remove('open')
    input.blur()
  }
  const isOpen = () => veil.classList.contains('open')

  input.addEventListener('input', () => render(input.value))
  input.addEventListener('keydown', (e) => {
    const hits = list._hits || []
    if (e.key === 'Escape') { e.stopPropagation(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, hits.length - 1); syncSel() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); syncSel() }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[sel]) pick(hits[sel]) }
    e.stopPropagation() // le clavier de l'app n'entend rien pendant la frappe
  })
  function syncSel() {
    ;[...list.children].forEach((r, i) => r.classList.toggle('sel', i === sel))
    list.children[sel]?.scrollIntoView({ block: 'nearest' })
  }
  veil.addEventListener('click', (e) => { if (e.target === veil) close() })

  // K (ou ⌘K/Ctrl+K) — jamais dans un champ texte ni dans les espaces morphés
  window.addEventListener('keydown', (e) => {
    const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable
    const inMode = ['store-mode', 'studio-mode', 'atelier-mode', 'shibu-view'].some((c) => document.body.classList.contains(c))
    if (isOpen() && e.key === 'Escape') { close(); return }
    if (inField || inMode) return
    if ((e.key === 'k' || e.key === 'K') && !e.altKey) {
      e.preventDefault()
      isOpen() ? close() : openPalette()
    }
  })

  return { open: openPalette, close }
}
