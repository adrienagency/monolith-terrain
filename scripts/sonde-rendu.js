// SONDE DE RENDU — à coller dans la console du navigateur, sur la machine qui
// montre le défaut, APRÈS que la carte se soit affichée (attendre la fin du
// chargement, laisser tourner ~15 s pour que le gouverneur ait mesuré).
// Elle ne modifie rien de durable : elle lit, elle rend un objet.
// `copy(JSON.stringify(await __sondeRendu(), null, 1))` met tout au presse-papier.
//
// ---------------------------------------------------------------------------
// POURQUOI ELLE EXISTE — le silence des shaders
// ---------------------------------------------------------------------------
// Le 28/07/2026, sur un iMac 27 pouces de 2015 (Retina 5K, Chrome, macOS) :
// « tous les rendus du sommet des maps sont inexistants ». Les captures
// montrent des blocs dont la GÉOMÉTRIE est juste — la silhouette du relief est
// là, les rivières bleues et le trait de côte s'affichent — mais dont le dessus
// est une surface plate d'une seule couleur : orange uni, ou sombre avec un
// banding rayé. Aucune rampe hypsométrique, aucun peigné de crête.
//
// ⚠️ CE N'EST PAS DE LA LENTEUR. Une machine lente rend LENTEMENT, elle ne rend
// pas FAUX. Un dessus plat pendant que les couches vectorielles sont correctes
// désigne un shader qui n'échantillonne pas ses textures, ou une texture qui
// n'est jamais montée sur la carte.
//
// ET CE GENRE DE PANNE EST MUET CÔTÉ JAVASCRIPT. Un programme qui ne compile ni
// ne lie ne lève aucune exception : three range le message dans
// `renderer.properties.get(mat).currentProgram.diagnostics`, et il faut
// `renderer.debug.checkShaderErrors = true` pour qu'il soit seulement rempli.
// Ce piège a déjà coûté une session entière ici (voir `git log --grep "quatre
// uniformes manquants"`). C'est la PREMIÈRE chose que lit cette sonde.
//
// ---------------------------------------------------------------------------
// CE QUI A DÉJÀ ÉTÉ MESURÉ, ET QU'IL NE FAUT PAS RE-SUPPOSER
// ---------------------------------------------------------------------------
// Sur une machine de développement (RTX 3080, ANGLE/D3D11), le 28/07/2026 :
//   • le shader du terrain déclare 11 samplers actifs en état de base
//     (uRampTex, uSeaMask, uCoastMask, uAnalysis, uRegionMask, uCloudShadow,
//     uAerial, envMap, directionalShadowMap[0], bumpMap, roughnessMap) ;
//   • 13 dans le PIRE cas (matériau de relief + verre : + map, + normalMap,
//     + transmissionSamplerMap) ;
//   • cette machine plafonne elle aussi à MAX_TEXTURE_IMAGE_UNITS = 16, et tout
//     lie et rend correctement.
// Donc l'épuisement des unités de texture est PEU probable — 3 unités de marge
// dans le pire cas. La sonde le vérifie quand même sur la vraie machine, parce
// que c'est cheap et que le pilote macOS peut compter autrement, mais ce n'est
// plus l'hypothèse de tête. Les champs à regarder en priorité sont désormais
// `diagnostics`, `texturesMuettes` et `rampeLue`.
//
// À LIRE EN PREMIER dans le retour : `verdict`.

window.__sondeRendu = async function () {
  const exp = window.__exp
  if (!exp) return { erreur: 'window.__exp absent — l’app n’a pas fini de démarrer, ou ce n’est pas ShibuMap.' }
  const r = exp.renderer
  const gl = r.getContext()
  const v = []
  const round = (n, k = 3) => (typeof n === 'number' ? Math.round(n * 10 ** k) / 10 ** k : n)

  // -------------------------------------------------------------- la machine
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const P = (n) => { try { return gl.getParameter(gl[n]) } catch { return null } }
  const limites = {
    MAX_TEXTURE_IMAGE_UNITS: P('MAX_TEXTURE_IMAGE_UNITS'), // ← le fragment
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: P('MAX_VERTEX_TEXTURE_IMAGE_UNITS'),
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: P('MAX_COMBINED_TEXTURE_IMAGE_UNITS'),
    MAX_VARYING_VECTORS: P('MAX_VARYING_VECTORS'),
    MAX_FRAGMENT_UNIFORM_VECTORS: P('MAX_FRAGMENT_UNIFORM_VECTORS'),
    MAX_VERTEX_UNIFORM_VECTORS: P('MAX_VERTEX_UNIFORM_VECTORS'),
    MAX_TEXTURE_SIZE: P('MAX_TEXTURE_SIZE'),
    MAX_RENDERBUFFER_SIZE: P('MAX_RENDERBUFFER_SIZE'),
    MAX_SAMPLES: P('MAX_SAMPLES'),
  }
  // La PRÉCISION du fragment. Si `highp` n'est pas disponible, three retombe en
  // `mediump` — 10 bits de mantisse. `vWorldPos` porte des coordonnées monde
  // jusqu'à ±28 : en mediump, la résolution y tombe vers 0,03, ce qui QUANTIFIE
  // la rampe hypsométrique en bandes et fait exploser tous les `fwidth()`
  // (courbes de niveau, trait de côte). C'est un candidat direct au « banding
  // rayé » décrit dans les captures.
  const sp = (t, p) => { const f = gl.getShaderPrecisionFormat(gl[t], gl[p]); return f ? f.precision : null }
  const precision = {
    threeChoisit: r.capabilities.precision, // 'highp' attendu ; 'mediump' = alarme
    fragHighFloat: sp('FRAGMENT_SHADER', 'HIGH_FLOAT'), // 0 = pas de highp
    fragMediumFloat: sp('FRAGMENT_SHADER', 'MEDIUM_FLOAT'),
    vertHighFloat: sp('VERTEX_SHADER', 'HIGH_FLOAT'),
  }
  // Les formats de repli. Les ombres sont en VSM (main.js) : three cuit alors
  // ses cartes d'ombre dans une cible HALF-FLOAT et les FILTRE en linéaire.
  // Sur un pilote qui ne sait pas rendre en half-float, le framebuffer est
  // incomplet — silencieusement — et le masque d'ombre revient constant.
  const extensions = {
    colorBufferHalfFloat: !!gl.getExtension('EXT_color_buffer_half_float'),
    colorBufferFloat: !!gl.getExtension('EXT_color_buffer_float'),
    textureFloatLinear: !!gl.getExtension('OES_texture_float_linear'),
    textureFilterAnisotropic: !!gl.getExtension('EXT_texture_filter_anisotropic'),
    perdues: gl.isContextLost(),
    toutes: gl.getSupportedExtensions?.()?.length ?? null,
  }

  // ------------------------------------------- les programmes, et leur silence
  const etaitVerif = r.debug.checkShaderErrors
  r.debug.checkShaderErrors = true // ⚠️ sans ça, `diagnostics` reste vide

  const TYPES = {}
  for (const k of ['SAMPLER_2D', 'SAMPLER_CUBE', 'SAMPLER_2D_ARRAY', 'SAMPLER_2D_SHADOW', 'SAMPLER_CUBE_SHADOW'])
    if (gl[k] !== undefined) TYPES[gl[k]] = k

  function scanner(mat, nom) {
    const props = r.properties.get(mat)
    const p = props?.currentProgram
    // ⚠️ PAS DE PROGRAMME ≠ PROGRAMME CASSÉ, et confondre les deux rend la
    // sonde inutilisable. Trois quarts des matériaux d'une scène ShibuMap ne
    // sont compilés qu'au premier rendu qui les utilise : calques masqués,
    // sprites d'étiquette, coiffes du globe, coque de nuages. Les compter comme
    // des pannes noyait le VRAI cassé sous 13 faux (mesuré en testant la sonde).
    if (!p) return { nom, etat: 'jamais-compile', note: 'normal pour un calque masqué / pas encore rendu' }
    const prog = p.program
    const lie = prog ? gl.getProgramParameter(prog, gl.LINK_STATUS) : null
    const samplers = []
    if (prog && lie) {
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
      for (let i = 0; i < n; i++) {
        const u = gl.getActiveUniform(prog, i)
        if (TYPES[u.type]) samplers.push({ nom: u.name, taille: u.size })
      }
    }
    const unites = samplers.reduce((a, s) => a + s.taille, 0)
    const d = p.diagnostics
    return {
      nom,
      etat: lie ? 'lie' : 'CASSE',
      lie,
      unitesTexture: unites,
      samplers: samplers.map((s) => s.nom + (s.taille > 1 ? `[${s.taille}]` : '')),
      // ⚠️ LA LIGNE QUI COMPTE. Non nul = le pilote a quelque chose à dire.
      diagnostics: d
        ? {
          runnable: d.runnable,
          programLog: d.programLog || '',
          vertexLog: d.vertexShader?.log || '',
          fragmentLog: d.fragmentShader?.log || '',
        }
        : null,
    }
  }

  // Tous les matériaux VISIBLES de la scène, plus le terrain et ses voisins.
  const vus = new Set()
  const programmes = []
  const ajoute = (m, nom) => {
    if (!m || vus.has(m)) return
    vus.add(m)
    programmes.push(scanner(m, nom))
  }
  ajoute(exp.terrain?.material, 'TERRAIN (dalle centrale)')
  let iCell = 0
  for (const cell of exp.blockGrid?.cells?.values?.() ?? []) ajoute(cell.terrain?.material, `damier #${iCell++}`)
  exp.scene.traverse((o) => {
    if (!o.visible || !o.material) return
    for (const m of [].concat(o.material)) ajoute(m, `${o.name || o.type}/${m.type}`)
  })
  // Seuls comptent les programmes que la carte a REFUSÉS. Ceux qui n'ont jamais
  // été compilés sont rangés à part, pour information.
  const casses = programmes.filter((p) => p.lie === false || p.diagnostics?.runnable === false)
  const bavards = programmes.filter((p) => p.diagnostics && (p.diagnostics.programLog || p.diagnostics.vertexLog || p.diagnostics.fragmentLog))
  const jamaisCompiles = programmes.filter((p) => p.etat === 'jamais-compile').map((p) => p.nom)
  const dessus = programmes.filter((p) => p.unitesTexture > (limites.MAX_TEXTURE_IMAGE_UNITS ?? 16))

  // ------------------------------------------- les textures du dessus du bloc
  // On lit l'ÉTAT RÉEL de chaque sampler du terrain : la texture est-elle là,
  // a-t-elle une image, three l'a-t-il effectivement téléversée ? Une texture
  // dont `__webglTexture` manque après un rendu n'est jamais montée sur la
  // carte, et l'échantillonner rend du noir — sans un mot en console.
  const u = exp.terrain?.mapUniforms ?? {}
  const etatTex = (t) => {
    if (!t) return { present: false }
    const props = r.properties.get(t)
    const img = t.image
    return {
      present: true,
      taille: img ? [img.width, img.height] : null,
      classe: t.constructor?.name,
      type: t.type,
      format: t.format,
      colorSpace: t.colorSpace,
      flipY: t.flipY,
      needsUpdate: t.version !== props?.__version,
      // ⚠️ LE CHAMP DÉCISIF : sans objet GL, cette texture n'existe pas côté carte
      surLaCarte: !!props?.__webglTexture,
    }
  }
  const samplersTerrain = {
    uRampTex: etatTex(u.uRampTex?.value),
    uAnalysis: etatTex(u.uAnalysis?.value),
    uSeaMask: etatTex(u.uSeaMask?.value),
    uCoastMask: etatTex(u.uCoastMask?.value),
    uRegionMask: etatTex(u.uRegionMask?.value),
    uAerial: etatTex(u.uAerial?.value),
    uCloudShadow: etatTex(u.uCloudShadow?.value),
    roughnessMap: etatTex(exp.terrain?.material?.roughnessMap),
    bumpMap: etatTex(exp.terrain?.material?.bumpMap),
    map: etatTex(exp.terrain?.material?.map),
  }
  const texturesMuettes = Object.entries(samplersTerrain)
    .filter(([, t]) => t.present && !t.surLaCarte)
    .map(([k]) => k)

  // Les interrupteurs qui décident de ce qui se peint. Un dessus plat peut
  // aussi venir d'un uniforme resté à 0 — pas seulement d'une texture morte.
  const interrupteurs = {
    uTint: u.uTint?.value, // 0 = la peinture cartographique ne s'applique PAS du tout
    uColorMode: u.uColorMode?.value, // 1 = Naturel (peigné, humidité)
    uAnalysisOn: u.uAnalysisOn?.value, // 0 = pas de peigné de crête (le Worker n'a rien rendu ?)
    uSeaMaskOn: u.uSeaMaskOn?.value,
    uCoastMaskOn: u.uCoastMaskOn?.value,
    uRegionOn: u.uRegionOn?.value,
    uAerialOn: u.uAerialOn?.value,
    uHeightRange: u.uHeightRange?.value ? [round(u.uHeightRange.value.x), round(u.uHeightRange.value.y)] : null,
    uHeightContrast: u.uHeightContrast?.value,
    uHeightPivot: u.uHeightPivot?.value,
    uSeaY: round(u.uSeaY?.value),
    uSurfaceFx: u.uSurfaceFx?.value,
    uTexShade: u.uTexShade?.value,
    materialMode: exp.terrain?.materialMode ?? null,
    transmission: exp.terrain?.material?.transmission,
    vertexColors: exp.terrain?.material?.vertexColors,
  }

  // LA RAMPE, RELUE DEPUIS LA CARTE GRAPHIQUE. C'est la seule façon de savoir
  // si la palette est bien arrivée sur le GPU : on la redessine dans une cible
  // hors écran et on relit les pixels. Une rampe qui revient uniforme (ou
  // noire) EST le dessus plat d'une seule couleur.
  // On lit les octets SOURCE de la rampe (une DataTexture RGBA fabriquée par
  // buildRamp2D) : cinq échantillons le long de l'axe altitude. Si ces cinq
  // couleurs sont identiques, la palette est plate AVANT même d'atteindre le
  // GPU, et le défaut est en amont — inutile de chercher côté pilote.
  let rampeLue = null
  try {
    const t = u.uRampTex?.value
    const d = t?.image?.data
    const w = t?.image?.width ?? 0
    const h = t?.image?.height ?? 0
    if (!t) rampeLue = { erreur: 'uRampTex est nul — la rampe n’a jamais été construite' }
    else if (!d || !w) rampeLue = { erreur: 'pas de données lisibles (texture non-DataTexture ?)', taille: [w, h] }
    else {
      const my = Math.floor(h / 2)
      const ech = [0, 0.25, 0.5, 0.75, 1].map((f) => {
        const i = (my * w + Math.round(f * (w - 1))) * 4
        return [d[i], d[i + 1], d[i + 2]]
      })
      const plate = ech.every((c) => c.every((v, k) => v === ech[0][k]))
      rampeLue = { taille: [w, h], echantillons: ech, plate }
    }
  } catch (e) { rampeLue = { erreur: String(e) } }

  // -------------------------------------------------- le cadrage et le coût
  const el = r.domElement
  const cssW = el.clientWidth
  const cssH = el.clientHeight
  const px = el.width * el.height
  const cadrage = {
    dpr: window.devicePixelRatio,
    canevasCss: [cssW, cssH],
    canevasTampon: [el.width, el.height],
    megapixelsRendus: round(px / 1e6, 2),
    densiteVoulue: exp.params?.pixelRatio,
    densiteServie: r.getPixelRatio(),
    // notre plafond du 28/07 (viewport.js/fitDrawingBuffer) a-t-il seulement
    // eu à agir ici ? Si `raboté` est faux, il est HORS DE CAUSE pour la
    // pixellisation signalée — ne pas le défendre, le vérifier.
    rabote: !!(limites.MAX_TEXTURE_SIZE && Math.max(el.width, el.height) >= limites.MAX_TEXTURE_SIZE),
    margeAvantRabotage: limites.MAX_TEXTURE_SIZE
      ? round(limites.MAX_TEXTURE_SIZE / Math.max(el.width, el.height, 1), 2) + '×'
      : null,
  }
  // L'IMAGE D'ACCUEIL : elle est en CSS (`background: cover` sur #loading-bg),
  // elle n'a rien à voir avec le tampon WebGL. Le rapport ci-dessous est son
  // agrandissement réel — au-delà de ~1,5 elle se voit pixellisée.
  const fond = document.getElementById('loading-bg')
  const imageAccueil = fond
    ? {
      source: [1400, 1400], // taille réelle de public/loading-bg.webp, mesurée
      afficheCss: [fond.clientWidth, fond.clientHeight],
      // `cover` sur une source carrée : le facteur est porté par le grand côté
      agrandissement: round(
        (Math.max(fond.clientWidth, fond.clientHeight) / 1400) * (window.devicePixelRatio || 1), 2
      ),
    }
    : null

  // Les images par seconde, mesurées ici et maintenant sur 2 secondes.
  // ⚠️ FILET DE SÉCURITÉ OBLIGATOIRE. `requestAnimationFrame` ne tire PAS dans
  // un onglet en arrière-plan : sans ce `setTimeout`, la promesse ne se résout
  // jamais et la sonde entière reste pendue — mesuré le 28/07/2026 en la
  // testant, panneau masqué. Une sonde qui se bloque ne rapporte rien, ce qui
  // est le seul défaut qu'elle n'a pas le droit d'avoir.
  const fps = await new Promise((res) => {
    let n = 0
    let fini = false
    const t0 = performance.now()
    let pireDt = 0
    let prev = t0
    const rendre = () => {
      if (fini) return
      fini = true
      const dur = performance.now() - t0
      res({
        moyen: round((n * 1000) / Math.max(dur, 1), 1),
        imagePireCas_ms: round(pireDt, 0),
        images: n,
        ongletCache: document.hidden || n < 2,
      })
    }
    setTimeout(rendre, 3000) // l'onglet peut être caché : on rend quand même
    const boucle = () => {
      const t = performance.now()
      pireDt = Math.max(pireDt, t - prev)
      prev = t
      n++
      if (t - t0 < 2000) requestAnimationFrame(boucle)
      else rendre()
    }
    requestAnimationFrame(boucle)
  })

  const info = r.info
  const gouverneur = {
    palier: exp.aq?.tier,
    palierDeDepart: exp.aq?.startTier,
    leviersRepris: exp.aq?.dirty,
    // ce que le palier a effectivement posé
    ombres: exp.params?.shadowMode,
    grain: exp.params?.grain,
    aoAutorise: exp.params?._aoTierOk,
    bloomAutorise: exp.params?._bloomTierOk,
  }
  const cout = {
    appelsDeRendu: info.render.calls,
    triangles: info.render.triangles,
    programmes: info.programs?.length ?? null,
    textures: info.memory.textures,
    geometries: info.memory.geometries,
  }

  const erreurGl = (() => { const e = []; for (let i = 0; i < 8; i++) { const c = gl.getError(); if (!c) break; e.push(c) } return e })()
  r.debug.checkShaderErrors = etaitVerif

  // ---------------------------------------------------------------- verdict
  if (casses.length)
    v.push(`⛔ ${casses.length} PROGRAMME(S) REFUSÉ(S) PAR LA CARTE — c'est la cause, lire \`programmes\` : ${casses.map((c) => c.nom).join(', ')}`)
  if (bavards.length)
    v.push(`⚠️ le pilote a écrit quelque chose sur ${bavards.length} programme(s) : ${bavards.map((b) => b.nom).join(', ')} — lire leurs \`diagnostics\`, même « runnable: true » peut cacher un repli silencieux.`)
  if (dessus.length)
    v.push(`⛔ UNITÉS DE TEXTURE DÉPASSÉES sur ${dessus.map((d) => `${d.nom} (${d.unitesTexture})`).join(', ')} — limite ${limites.MAX_TEXTURE_IMAGE_UNITS}`)
  if (texturesMuettes.length)
    v.push(`⛔ TEXTURES JAMAIS MONTÉES SUR LA CARTE : ${texturesMuettes.join(', ')} — les échantillonner rend du noir, sans un mot en console.`)
  if (rampeLue?.plate)
    v.push('⛔ LA RAMPE EST PLATE À LA SOURCE : la palette n’a jamais été fabriquée correctement — le défaut est en amont du GPU.')
  if (precision.threeChoisit !== 'highp')
    v.push(`⛔ PRÉCISION ${precision.threeChoisit} EN FRAGMENT — vWorldPos porte des coordonnées jusqu'à ±28 ; en mediump la rampe se quantifie en BANDES et tous les fwidth() (courbes, trait de côte) partent en vrille.`)
  if (!extensions.colorBufferHalfFloat)
    v.push('⚠️ PAS DE RENDU EN HALF-FLOAT : les ombres VSM (main.js) cuisent dans une cible half-float. Framebuffer incomplet = masque d’ombre constant, donc surface uniformément sombre.')
  if (interrupteurs.uTint === 0)
    v.push('⚠️ uTint = 0 : la peinture cartographique n’est PAS appliquée du tout — c’est un réglage, pas une panne de GPU.')
  // uSeaY = -9999 signifie « terrain procédural » : l'analyse de relief n'est
  // cuite que sur un VRAI MNT, donc uAnalysisOn à 0 y est normal. Ne le signaler
  // que sur une carte réelle, sinon la sonde alarme sur la démo de démarrage.
  if (interrupteurs.uAnalysisOn === 0 && interrupteurs.uColorMode === 1 && interrupteurs.uSeaY > -9000)
    v.push('⚠️ Mode Naturel sur une carte RÉELLE mais uAnalysisOn = 0 : le Worker d’analyse de relief n’a rien livré → aucun peigné de crête, aucune humidité. Chercher une erreur de Worker en console.')
  if (erreurGl.length) v.push(`⚠️ erreurs WebGL en attente : ${erreurGl.join(', ')} (1282 = INVALID_OPERATION, 1285 = OUT_OF_MEMORY)`)
  if (extensions.perdues) v.push('⛔ LE CONTEXTE WEBGL EST PERDU — plus rien ne rend, tout le reste est à ignorer.')
  if (fps.ongletCache)
    v.push('ℹ️ images/s NON MESURÉES : l’onglet était en arrière-plan (requestAnimationFrame ne tire pas). Relancer la sonde avec la fenêtre au premier plan.')
  else if (fps.moyen < 20)
    v.push(`🔥 ${fps.moyen} images/s pour ${cadrage.megapixelsRendus} Mpx de tampon (densité ${cadrage.densiteServie}). Gouverneur au palier ${gouverneur.palier}/3, pire image ${fps.imagePireCas_ms} ms.`)
  if (imageAccueil && imageAccueil.agrandissement > 1.5)
    v.push(`🖼️ IMAGE D'ACCUEIL agrandie ${imageAccueil.agrandissement}× (source 1400², CSS \`cover\`) — c'est du CSS, RIEN à voir avec le tampon WebGL ni avec le plafond de densité. Il faut un asset plus grand.`)
  if (!cadrage.rabote)
    v.push(`✅ le plafond de tampon (fitDrawingBuffer) n'a PAS agi ici : marge ${cadrage.margeAvantRabotage} avant la limite. Il est donc hors de cause pour la pixellisation.`)
  if (!v.length) v.push('rien d’anormal détecté par cette sonde — joindre une capture et le contenu de `programmes`.')

  return {
    verdict: v,
    machine: {
      carte: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      fabricant: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      coeurs: navigator.hardwareConcurrency,
      memoireGo: navigator.deviceMemory ?? null,
      ua: navigator.userAgent,
      ecranCss: [screen.width, screen.height],
    },
    limites,
    precision,
    extensions,
    cadrage,
    imageAccueil,
    fps,
    gouverneur,
    cout,
    interrupteurs,
    samplersTerrain,
    texturesMuettes,
    rampeLue,
    erreurGl,
    jamaisCompiles,
    programmes: programmes.filter((p) => p.etat !== 'jamais-compile'),
  }
}

// eslint-disable-next-line no-console
window.__sondeRendu().then((r) => console.log(r))
