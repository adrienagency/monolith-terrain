import { section, toggle, slider, visibleWhen, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { marqueEtape } from './etape.js'

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>'

export function buildMapPanel(ctx) {
  const { params, u } = ctx // u() → terrain.mapUniforms
  // Ce panneau ouvre le rail gauche du STUDIO (au-dessus de Terrain) : ses
  // calques habillent la carte, ils ne servent pas à s'y déplacer. Il a
  // longtemps vécu dans Explorer, et `ce-panel-map` lui servait à s'échapper
  // du filtre du mode simple (v28.css) — ce n'est plus le cas : le dock
  // « Explorer » ne montre QUE le panneau Explorer. La classe reste le seul
  // nom stable du panneau dans le DOM (le titre, lui, est du texte affiché).
  const panel = new Panel({ title: 'Carte', icon: ICON, side: 'left', width: 268, tip: 'Les calques cartographiques drapés sur le relief.', cls: 'ce-panel-map' })

  const sLayers = panel.addSection(section('Calques'))
  // PLUS de « Routes » ici (interrupteur, opacité, détail, couleur) : le calque
  // a quitté le site (Adrien : « très lourd, très mauvais »). Quatre réglages
  // qui ne pilotent plus rien valent moins que pas de réglage du tout.
  const waterToggle = toggle({ label: 'Rivières & eau', get: () => params.waterEnabled, set: (v) => { params.waterEnabled = v; ctx.rebuildMapLayers(); refreshAll() } })
  const waterOpacity = slider({ label: 'Opacité de l’eau', min: 0, max: 1, step: 0.02, get: () => params.waterOpacity, set: (v) => { params.waterOpacity = v; ctx.mapLayers.setOpacity('water', v) } })
  // PLUS de « Remplir lacs & mers » ici. Adrien, 2026-08-02 : « pas besoin, ça
  // doit TOUJOURS être rempli ». Le remplissage n'est donc plus un réglage mais
  // le comportement — water-layer.js remplit sans condition. Un interrupteur
  // dont une seule position est acceptable n'est pas un réglage, c'est un piège.
  // PLUS de « Trait de côte » ici : le liseré Natural Earth a quitté le site
  // (voir water-layer.js). Le « Fondu à la côte » plus bas appartient à la
  // photo aérienne — même mot, autre sujet.
  // Aerial photo — IGN (France) and swisstopo (Switzerland), off by default.
  // Outside covered ground the layer says so in the middle of the screen and
  // switches itself back off (see main.js refreshAerial).
  const aerialToggle = toggle({ label: 'Photo aérienne', get: () => params.aerialEnabled, set: (v) => { params.aerialEnabled = v; ctx.refreshAerial(); refreshAll() } })
  // BÊTA — et les DEUX motifs d'origine ont changé de nature. Ce qui suit est
  // maintenant chronométré, plus dérivé.
  //
  // 1. LE COÛT N'EST PLUS CELUI QU'ON ANNONÇAIT, ET IL EST PLUS BAS. L'ancien
  //    texte multipliait par neuf le coût d'un bloc en le disant lui-même « pas
  //    un chronomètre ». MESURÉ depuis, Chamonix z12, même machine et même
  //    connexion, en chronométrant `AerialLayer.build()` sur les deux emprises :
  //
  //      le bloc central seul (l'ancien) : 156 tuiles, z14, 3072×3328, 39,0 Mo, 6 821 ms
  //      L'EMPRISE ENTIÈRE (le nouveau)  :  81 tuiles, z12, 2304×2304, 20,3 Mo, 4 592 ms
  //
  //    NEUF FOIS la surface pour 48 % de tuiles en moins, 48 % de mémoire en
  //    moins et 33 % de temps en moins. La raison est que le budget de texture
  //    borne le CANEVAS, pas le nombre de tuiles : une emprise trois fois plus
  //    large au même budget descend de deux crans d'imagerie, et une tuile d'un
  //    cran plus grossier couvre quatre fois la surface (voir demBounds).
  // 2. L'INACHÈVEMENT, qui reste le vrai motif du mot « bêta » — mais il ne
  //    porte plus sur la COUVERTURE (les neuf dalles sont peintes), seulement
  //    sur l'AFFINAGE. `AerialLayer.build()` fait toujours une passe unique : le
  //    « grossier d'abord, puis amélioration alors que la vue est déjà chargée »
  //    qu'Adrien a tranché a son premier terme, pas son second. Le cran suivant
  //    sur l'emprise dépasse le budget de texture ; il demandera une SECONDE
  //    texture sur la dalle regardée, mesurée à +36 Mo.
  marqueEtape(aerialToggle, {
    etape: 'bêta',
    raison:
      'Environ 80 tuiles et 5 secondes, mesurées. En mode continu 3×3 elle couvre désormais les neuf dalles, à deux crans de zoom plus grossiers : l’affinage progressif au centre de la vue reste à faire.',
  })
  const aerialOpacity = slider({ label: 'Opacité de la photo', min: 0, max: 1, step: 0.02, get: () => params.aerialOpacity, set: (v) => { params.aerialOpacity = v; ctx.terrain.setAerialOpacity(v); ctx.blockGrid?.setAerialOpacity?.(v) } })
  // v49 : la photo ne vit qu'à la côte, puis s'estompe vers le fond marin. 0 = pleine partout.
  const aerialCoastFade = slider({ label: 'Fondu à la côte', min: 0, max: 0.4, step: 0.01, get: () => params.aerialCoastFade, set: (v) => { params.aerialCoastFade = v; ctx.terrain.setAerialCoastFade(v); ctx.blockGrid?.setAerialCoastFade?.(v) } })
  const placesToggle = toggle({ label: 'Villes & lieux', get: () => params.placesEnabled, set: (v) => { params.placesEnabled = v; ctx.rebuildMapLayers(); refreshAll() } })
  // PLUS de « Densité des lieux », « Taille des lieux » ni « Halo du texte ».
  // Adrien, 2026-08-02 : pour les deux tirettes « ça reste comme c'est au
  // lancement par défaut » (densité 1, taille 1 — les valeurs sont maintenant
  // écrites en dur dans places-layer.js) ; pour le halo, « on enlève, par défaut
  // pas de halo ». Le halo est SUPPRIMÉ, pas désactivé : places-layer.js ne le
  // demande plus du tout à makeLabelTexture.
  //
  // ⚠️ text-label.js garde sa mécanique de halo, et c'est volontaire : elle sert
  // à d'autres appelants et elle est tenue par test/text-label.test.js. Ce qui a
  // disparu, c'est la DEMANDE, pas la capacité.
  sLayers.body.append(
    waterToggle, waterOpacity,
    aerialToggle, aerialOpacity, aerialCoastFade,
    placesToggle
  )
  visibleWhen(waterOpacity, () => params.waterEnabled)
  for (const row of [aerialOpacity, aerialCoastFade]) visibleWhen(row, () => params.aerialEnabled)

  const sContour = panel.addSection(section('Courbes & grille'))
  // ══════ ✅ CE QUE CES CINQ CURSEURS FONT SOUS LA SPHÈRE — Tâche R19 ═══════
  //
  // ⚡ **TROIS SONT VIVANTS DEPUIS R19, ET DEUX N'ONT TOUJOURS PAS DE RECEVEUR.**
  //
  //   · `contourOpacity`, `contourInterval` et `contourColor` **gravent
  //     désormais les terres du crop**. Le défaut unique était `minFade`, le
  //     fondu de minification du nuanceur de tuile : sous le crop il rendait
  //     **3,57/255 en moyenne** (mesuré, sonde de nuanceur), donc zéro, alors
  //     que les bandes de courbe, elles, existaient (`minor` : 255 au maximum).
  //     Le socle, qui est le modèle, n'a **aucun** fondu de ce genre. Il est
  //     neutralisé dans le crop et intouché au-dehors (`globe.js`, bloc R19).
  //     Mesuré au banc (condensé 256 × 160, plancher 0,0000) : opacité 0 → 1
  //     **1,2275** (avant : 0,0146), intervalle 0,29 → 0,10 **1,3202**, couleur
  //     noir → rouge **0,6677**. Captures : `.banc/R19/`.
  //   · `contourInterval` passe par une CONVERSION — la tirette est en unités
  //     de BLOC, le globe en MÈTRES : `intervalleCourbesBloc`
  //     (`monde/habillage-crop.js`), dérivée de `echelleBloc` et non posée.
  //     ⚠️ Elle PREND LE PAS sur la calibration automatique du crop
  //     (`intervalleCourbes` sur l'amplitude), qui reste le repli sans MNT.
  //   · `contourWeight` traverse (`uContourWeight`) et porte le trait des deux
  //     côtés — même `1.4 × uContourWeight` que `terrain.js`.
  // ══════ ✅ ET LES DEUX DERNIERS SONT VIVANTS DEPUIS R22 ═══════════════════
  //
  // ⛔ **LA NOTE QUI VIVAIT ICI DISAIT « la grille du bloc n'existe pas », ET
  // C'ÉTAIT VRAI AU MOT PRÈS : le nuanceur du crop n'en portait pas une ligne.**
  // L'inventaire en concluait qu'elle n'avait « aucun sens » sur la sphère, au
  // motif que le graticule lat/lon en tenait lieu. ⚡ **C'est le départage que
  // R22 a réfuté, et par la mesure** : le graticule est une grille de PLANÈTE
  // (tous les 10°, du pôle à l'équateur, son propre uniforme) ; le carroyage est
  // une grille de BLOC (un pas au sol, en travers de la découpe). Ce sont deux
  // objets, pas deux noms du même — et le socle, qui est le modèle, trace les
  // DEUX. Le crop en trace désormais deux aussi.
  //
  //   · `gridOpacity` et `gridStep` peignent le carroyage sur la découpe
  //     (`globe.js`, bloc « LA GRILLE DE RELEVE DU BLOC »). Avant R22 :
  //     **0,0000 et 0,0000** sur une fenêtre 1:1 de 512 × 320, c'est-à-dire le
  //     plancher de bruit lui-même. Les chiffres d'après sont dans
  //     `rapport-R22.md`.
  //   · `gridStep` passe par une CONVERSION — la tirette est en unités de BLOC,
  //     le nuanceur en MÈTRES au sol : `pasGrilleBloc`
  //     (`monde/habillage-crop.js`), **sans exagération**, contrairement à
  //     l'intervalle des courbes : l'une est une longueur horizontale, l'autre
  //     une longueur verticale. Le nombre de cellules en travers du bloc est
  //     celui du socle, exactement.
  //   · La couleur « Grille » (panneau Fonds) traverse aussi, par `uGridColor`.
  // ⚠️ CES CINQ CURSEURS ÉCRIVENT LES UNIFORMES DU BLOC CENTRAL EN DIRECT —
  // `u()` est `terrain.mapUniforms`, pas un réglage de `params` qu'une fonction
  // de main.js redistribuerait ensuite. Ils court-circuitent donc
  // `applyGridContour` ET son rappel au damier : sans le `diffuseDuCentre()` de
  // chaque ligne, traîner l'un d'eux laissait les dalles voisines avec les
  // courbes d'avant, jusqu'au prochain changement de palette ou de fond.
  // La diffusion ne recopie que des scalaires du centre — 8,0 µs pour 24 dalles,
  // mesuré, rien de recuit, rien de recompilé : elle tient sur un curseur traîné.
  const encre = () => ctx.blockGrid?.diffuseDuCentre()
  const contourWeight = slider({ label: 'Épaisseur des courbes', min: 0.3, max: 1.6, step: 0.05, get: () => params.contourWeight, set: (v) => { params.contourWeight = v; if (!params.darkMode) u().uContourWeight.value = v; encre() } })
  sContour.body.append(
    slider({ label: 'Intervalle des courbes', min: 0.04, max: 0.6, step: 0.01, get: () => params.contourInterval, set: (v) => { params.contourInterval = v; u().uContourInterval.value = v; encre() } }),
    slider({ label: 'Opacité des courbes', min: 0, max: 1, step: 0.02, get: () => params.contourOpacity, set: (v) => { params.contourOpacity = v; u().uContourOpacity.value = v; encre() } }),
    contourWeight,
    slider({ label: 'Taille de la grille', min: 2, max: 14, step: 0.5, get: () => params.gridStep, set: (v) => { params.gridStep = v; u().uGridStep.value = v; encre() } }),
    slider({ label: 'Opacité de la grille', min: 0, max: 1, step: 0.02, get: () => params.gridOpacity, set: (v) => { params.gridOpacity = v; u().uGridOpacity.value = v; encre() } })
  )
  // dead in dark mode — main.js pins the uniform to 0.5 there (setDarkMode); the
  // readout would keep moving with nothing rendering, so hide rather than honour
  visibleWhen(contourWeight, () => !params.darkMode)

  const sMarkers = panel.addSection(section('Repères'))
  sMarkers.body.append(
    toggle({ label: 'Sommets', get: () => params.peaksEnabled ?? false, set: (v) => { params.peaksEnabled = v; ctx.peaksLayer.setEnabled(v) } }),
    toggle({ label: 'Points cotés', get: () => params.labels, set: (v) => { params.labels = v; ctx.setLabelsVisible(v) } })
  )
  return panel
}
