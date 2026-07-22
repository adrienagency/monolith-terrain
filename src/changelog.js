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
