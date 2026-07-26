// The public changelog — a curated, user-facing history of ShibuMap, newest
// first. This is DATA ONLY (the overlay renders it): short lines a visitor
// understands, not commit messages. Adrien curates; keep entries honest and
// dated from the real git history.
//
// APP_STAGE feeds the ALPHA chip in the top bar — flip it to 'beta' / '' as
// the product matures and the chip follows (empty string hides it).

export const APP_STAGE = 'alpha'

export const CHANGELOG = [
  {
    date: '2026-07-26',
    title: 'One bar, all the way down',
    items: [
      'The welcome screen is gone — or rather, it became the bar itself. The three doors now sit in the menu bar, large and centred; pick one and the bar flows down to its place at the bottom of the screen and opens what you asked for.',
      'The mode bar and the search bar are no longer two objects: one column of liquid joins them under whichever mode is active, and travels with it.',
      'Pick Parcours and the search folds away — you do not look up a place to build a race — leaving GPX alone, centred under its own bridge.',
      'The interface now takes its colours from the map. Change the palette and the whole chrome follows, with the contrast checked on every palette so nothing ever becomes hard to read.',
    ],
  },
  {
    date: '2026-07-26',
    title: 'Atlas',
    items: [
      'A second way to colour the relief, next to the height ramp. Ridges get the combed texture of a printed shaded-relief map, hollows that collect water turn greener than the dry spurs beside them at the same altitude, and low ground veils into the distance.',
      'Two points at the same height stop receiving the same colour — which is what made the old ramp read as stacked layers.',
      'The sea sits at its true level again. Waves used to lift the whole surface so their troughs would never touch the bottom; now they carve down instead, and shoal and break as the water shallows, the way real swell does.',
    ],
  },
  {
    date: '2026-07-26',
    title: 'Sharper ground',
    items: [
      'Elevation now comes from Mapterhorn, which stitches national surveys together — IGN RGE ALTI in France, swissALTI3D in Switzerland — instead of a worldwide model frozen in 2017.',
      'Four times more elevation samples per tile, so ridges, gullies and terraces read as themselves instead of as smoothed averages.',
      'How far the fine data reaches depends on where you are: z17 in Switzerland, z16 in France, z12 elsewhere. Past that the block keeps its footprint and simply stops getting sharper.',
      'Elevation: © Mapterhorn — https://mapterhorn.com/attribution. The older AWS Terrain Tiles (Mapzen / Tilezen) stay in reserve and take over on their own if Mapterhorn is unreachable.',
    ],
  },
  {
    date: '2026-07-26',
    title: 'The sea floor, for real',
    items: [
      'Coasts and sea beds now use GEBCO_2026 bathymetry — roughly four times finer than what the terrain tiles carried before, so shelves, canyons and seamounts show up instead of a smooth basin.',
      'Dry land is untouched: the finer data may only deepen the sea, never move a coastline by a single pixel.',
      'Bathymetry: GEBCO Compilation Group, GEBCO_2026 Grid (public domain). NOT FOR NAVIGATION — these maps are made to be looked at, not to be sailed by.',
    ],
  },
  {
    date: '2026-07-22',
    title: 'Moving around',
    items: [
      'Click anywhere on the map to dive one level onto that exact spot — the view leans in, then the finer terrain loads.',
      'New zoom stepper under the top bar: + and − step the map one scale at a time.',
      'The wheel now glides with real momentum and stops at the edge of each scale; scroll again to cross into the next one.',
      'Tidier top bar — Export on the right, floating readouts, quieter chrome.',
    ],
  },
  {
    date: '2026-07-21',
    title: 'The living sea',
    items: [
      'Underwater life: a few clownfish wander the coastal waters when the sea is on.',
      'See-through water fixed — the seabed truly reads through the surface again, and the Refraction slider bends it.',
      'Shore surf: wavefronts follow the coastline, wrap around islands, swell and break near the beach.',
      'Brighter, wider foam where the sea meets the land.',
    ],
  },
  {
    date: '2026-07-20',
    title: 'Render upgrades',
    items: [
      'Real ambient occlusion and bloom, riding the adaptive quality ladder — weak machines shed effects gracefully.',
      'The animated sea arrives: a random 16-wave spectrum, seabed presets, and a sea seed that travels in share links.',
      'Aerial photo skin: 14 national imagery providers plus a worldwide satellite floor.',
    ],
  },
  {
    date: '2026-07-19',
    title: 'Sun & sky',
    items: [
      'A real 24-hour day/night cycle — the sun stands where it actually stands for the place and the season.',
      'The GPX follow camera rebuilt as a precomputed rail: steady, cinematic, never buried in a hillside.',
      'Share links unfurl with a proper preview when pasted in a chat.',
      'Unsupported browsers now get a clear message instead of an endless loader.',
    ],
  },
  {
    date: '2026-07-17',
    title: 'Trail routes',
    items: [
      'GPX tracks drape on the relief with a slope colour ramp, start/finish gates and a playback marker.',
      'Summit markers with hover info cards; lakes on by default.',
    ],
  },
  {
    date: '2026-07-14',
    title: 'Water groundwork',
    items: [
      'Real water simulation foundations: ocean detection, sea mask, translucent shallows and dark depths.',
    ],
  },
  {
    date: '2026-07-07',
    title: 'ShibuMap is born',
    items: [
      'Any place on Earth rises as a quiet relief block — orbital globe, surface dives, templates, shaders, image and video export.',
    ],
  },
]
