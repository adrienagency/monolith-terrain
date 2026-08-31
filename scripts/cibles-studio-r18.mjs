// LES CIBLES DU STUDIO — le MÊME constructeur pour les deux sondes.
//
// ⚠️ **UN SEUL NUMÉROTAGE, ET C'EST TOUT L'INTÉRÊT.** La sonde d'image dit
// « l'écran bouge », la sonde d'uniformes dit « la valeur traverse » : les deux
// tableaux ne se joignent que si `[12]` désigne le même contrôle des deux
// côtés. Deux copies auraient divergé au premier réglage ajouté.
//
// ⛔ Cette fonction est SÉRIALISÉE et exécutée DANS LA PAGE : elle ne doit
// fermer sur rien de ce module.
export function poserCibles() {
  const cibles = []
  const txt = (n) => (n?.textContent || '').trim()
  const conteneurs = [
    ...document.querySelectorAll('.ce-panel'),
    ...document.querySelectorAll('.ce-settings'),
  ]
  for (const p of conteneurs) {
    const titre = txt(p.querySelector('.ce-panel-title')) || txt(p.querySelector('.ce-settings-head b')) || p.className
    const horsMode = p.classList.contains('wm-off')
    let section = ''
    const push = (o) => cibles.push({ panneau: titre, section, horsMode, ...o })
    const walk = (n) => {
      for (const c of n.children) {
        if (c.classList?.contains('ce-section')) section = txt(c.querySelector('.ce-section-title')) || section
        // ---- une ligne de kit.js
        if (c.classList?.contains('ce-row')) {
          const lab = c.querySelector('.ce-label')
          const nom = lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
          const rng = c.querySelector('input[type=range]')
          const col = c.querySelector('input[type=color]')
          const sel = c.querySelector('select')
          const tog = c.querySelector('button.ce-toggle')
          const seg = c.querySelector('.ce-seg')
          const cache = () => c.style.display === 'none'
          if (rng) {
            let orig = null
            push({ nom, type: 'slider', cache, plage: [rng.min, rng.max], apply: (ph) => {
              if (ph === 0) orig = rng.value
              rng.value = ph === 0 ? rng.min : ph === 1 ? rng.max : orig
              rng.dispatchEvent(new Event('input', { bubbles: true }))
              // ⛔ **`input` NE SUFFIT PAS, ET TROIS OPTIONS EN SONT MORTES À
              // TORT AU PREMIER TOUR.** « Échelle fine », « Détail fin » et
              // « Échelle du détail » ne COMMITENT qu'au relâchement : leur
              // panneau écoute `change` pour rebâtir le terrain. Une sonde qui
              // n'émet que `input` bouge le curseur et ne déclenche jamais le
              // travail — elle mesure un curseur qu'on traîne sans le lâcher.
              rng.dispatchEvent(new Event('change', { bubbles: true }))
              return rng.value
            } })
          } else if (col) {
            let orig = null
            push({ nom, type: 'color', cache, apply: (ph) => {
              if (ph === 0) orig = col.value
              col.value = ph === 0 ? '#ff2000' : ph === 1 ? '#00e0ff' : orig
              col.dispatchEvent(new Event('input', { bubbles: true }))
              return col.value
            } })
          } else if (sel) {
            let orig = null
            const opts = [...sel.options].map((o) => o.value)
            push({ nom, type: 'select', cache, plage: [opts[0], opts[opts.length - 1]], apply: (ph) => {
              if (ph === 0) orig = sel.value
              sel.value = ph === 0 ? opts[0] : ph === 1 ? opts[opts.length - 1] : orig
              sel.dispatchEvent(new Event('change', { bubbles: true }))
              return sel.value
            } })
          } else if (tog) {
            let orig = null
            push({ nom, type: 'toggle', cache, apply: (ph) => {
              if (ph === 0) orig = tog.classList.contains('on')
              if (ph === 2) { if (tog.classList.contains('on') !== orig) tog.click() }
              else tog.click()
              return tog.classList.contains('on') ? 'on' : 'off'
            } })
          } else if (seg) {
            let orig = -1
            const btns = () => [...seg.querySelectorAll('.ce-seg-btn')]
            push({ nom: nom || txt(c.querySelector('.ce-label')) || 'segments', type: 'segmented', cache, apply: (ph) => {
              const b = btns()
              if (ph === 0) orig = b.findIndex((x) => x.classList.contains('on'))
              if (ph === 2) { if (orig >= 0) b[orig]?.click(); return orig >= 0 ? txt(b[orig]) : '(rien)' }
              const t = ph === 0 ? b[0] : b[b.length - 1]
              t?.click()
              return txt(t)
            } })
          }
        }
        // ---- un picker de vignettes (matières, effets, fonds, ciels, fonds marins…)
        if (c.classList?.contains('ce-mat-pick') || c.classList?.contains('ce-mat-grid')) {
          if (!c.closest('.ce-mat-pick') || c.classList.contains('ce-mat-pick')) {
            const vigs = () => [...c.querySelectorAll('.ce-mat-vig')]
            if (vigs().length >= 2) {
              let orig = -1
              push({ nom: 'picker (' + vigs().length + ' vignettes)', type: 'picker', cache: () => c.style.display === 'none',
                apply: (ph) => {
                  const v = vigs()
                  if (ph === 0) orig = v.findIndex((x) => x.classList.contains('on'))
                  if (ph === 2) { if (orig >= 0) v[orig]?.click(); return orig >= 0 ? 'retour' : '(rien)' }
                  const t = ph === 0 ? v[0] : v[v.length - 1]
                  t?.click()
                  return (t?.getAttribute('data-tip') || txt(t) || '?').slice(0, 40)
                } })
            }
          }
        }
        // ---- une rangée de chips (presets)
        if (c.classList?.contains('ce-chiprow')) {
          const chips = () => [...c.querySelectorAll('.ce-chip')]
          if (chips().length >= 2) {
            let orig = -1
            push({ nom: 'chips (' + chips().map(txt).join('/') + ')', type: 'chips', cache: () => c.style.display === 'none',
              apply: (ph) => {
                const b = chips()
                if (ph === 0) orig = b.findIndex((x) => x.classList.contains('on'))
                // ⛔ AUCUNE CHIP ALLUMEE AU DEPART = AUCUNE A REMETTRE. Cliquer
                // la premiere « pour faire quelque chose » laissait la scene sur
                // un etat qui n'etait pas celui d'avant — c'est ce qui a
                // contamine toute la fin de la premiere passe (Nuit, 65 lignes).
                if (ph === 2) { if (orig >= 0) b[orig]?.click(); return orig >= 0 ? txt(b[orig]) : '(rien)' }
                const t = ph === 0 ? b[0] : b[b.length - 1]
                t?.click()
                return txt(t)
              } })
          }
        }
        // ---- une rampe de nuanciers nus (palette du relief)
        if (c.classList?.contains('ce-ramp')) {
          const sw = () => [...c.querySelectorAll('input.ce-swatch')]
          if (sw().length >= 2) {
            let orig = []
            push({ nom: 'rampe (' + sw().length + ' arrêts)', type: 'rampe', cache: () => c.style.display === 'none',
              apply: (ph) => {
                const s = sw()
                if (ph === 0) orig = s.map((x) => x.value)
                s.forEach((x, i) => {
                  x.value = ph === 0 ? '#ff2000' : ph === 1 ? '#00e0ff' : orig[i]
                  x.dispatchEvent(new Event('input', { bubbles: true }))
                })
                return s[0].value
              } })
          }
        }
        walk(c)
      }
    }
    walk(p)
  }
  window.__r18.cibles = cibles
  return cibles.map((c, i) => ({ i, panneau: c.panneau, section: c.section, nom: c.nom, type: c.type, horsMode: c.horsMode, cache: c.cache?.() ?? false, plage: c.plage || null }))
}

