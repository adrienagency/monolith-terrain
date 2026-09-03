// Évalué dans la page : sur les six emprises, LE TRAIT DE CÔTE A-T-IL BOUGÉ ?
//   terre vraie = terrarium brut ≥ 2 m (Int16 : au-dessus de la bande de bruit, arrondi compris)
//   mer/absence = terrarium brut ≤ 0
//   noyée  = terre vraie rendue < 0 par la fusion   (le rivage recule)  → doit valoir 0
//   émergée = mer/absence rendue ≥ 0                 (le plateau)        → le défaut
(async () => {
  const m = window.__b5dem || (await import('/src/dem.js'))
  const VUES = [['Porquerolles', 42.995, 6.21], ['Port-Cros', 43.005, 6.39], ['Le Levant', 43.03, 6.47], ['Marseille / Frioul', 43.27, 5.30], ['Hyeres large', 43.02, 6.35], ['Polders NL (Flevoland)', 52.45, 5.45]]
  const out = []
  for (const [nom, lat, lon] of VUES) for (const zoom of [12, 13]) {
    const d = await m.loadDem({ lat, lon, zoom, tilesAcross: 3, bathy: true, memo: false })
    const b = await m.loadDem({ lat, lon, zoom, tilesAcross: 3, bathy: false, memo: false })
    let terreVraie = 0, noyee = 0, merOuAbs = 0, emergee = 0, bande = 0
    for (let i = 0; i < d.data.length; i++) {
      const v = d.data[i], w = b.data[i]
      if (w >= 2) { terreVraie++; if (v < 0) noyee++ }
      else if (w <= 0) { merOuAbs++; if (v >= 0) emergee++ }
      else bande++
    }
    out.push({ nom, zoom, terreVraie, noyee, merOuAbs, emergee, bande })
  }
  return out
})()
