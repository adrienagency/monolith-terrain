// ShibuMap entry gate. Phones get a quiet card pointing to a bigger screen;
// desktop and tablet lazy-load the real app (which keeps the heavy bundle
// entirely off phones and splits it out of the first request everywhere).

const coarse = matchMedia('(pointer: coarse)').matches
const shortSide = Math.min(screen.width, screen.height)
const isPhone = coarse && shortSide < 600 // tablets (iPad mini 744+) pass

if (isPhone) {
  const gate = document.createElement('div')
  gate.setAttribute(
    'style',
    [
      'position:fixed', 'inset:0', 'z-index:999', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:14px', 'padding:32px',
      'background:linear-gradient(180deg,#f4f3f0,#e7e5e0)', 'text-align:center',
      "font-family:'Bricolage Grotesque',system-ui,sans-serif", 'color:#1c1e22',
    ].join(';')
  )
  gate.innerHTML =
    '<div style="font-size:22px;font-weight:700"><span style="color:#e8622c">◍</span> ShibuMap</div>' +
    '<div style="font-size:15px;max-width:300px;line-height:1.5">These maps need room to breathe. Open ShibuMap on a computer or a tablet to explore the relief.</div>' +
    '<div style="font-size:12px;color:rgba(28,30,34,.55)">shibumap.com</div>'
  document.body.append(gate)
  const loading = document.getElementById('loading')
  if (loading) loading.remove()
} else {
  import('./main.js')
}
