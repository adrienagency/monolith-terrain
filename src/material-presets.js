// Socle (plinth) materials — a curated bank the user can give to the base block.
//
// Two families, both driven onto a single MeshPhysicalMaterial:
//   PBR_PRESETS   — 25 solid finishes (metals, stone, ceramics, wood).
//   GLASS_PRESETS — 25 transmissive glasses. Each behaves like real glass:
//                   physical transmission + IOR + thickness, a `diffusion`
//                   (roughness) knob for frost, and a tint that Beer–Lambert
//                   attenuation carries through the volume AND that we pool onto
//                   the ground below as coloured light (three's transmission
//                   can't cast coloured shadows on its own).
//
// Fields map 1:1 onto THREE.MeshPhysicalMaterial. Keep values physically sane:
// metals metalness=1, dielectrics metalness=0, ior ~1.5, transmission in [0,1].

export const PBR_PRESETS = [
  // --- default matte stone (the block's original look) ---
  { id: 'stone',      name: 'Matte stone',     color: '#d8d4cc', roughness: 0.95, metalness: 0 },
  // --- metals ---
  { id: 'chrome',     name: 'Polished chrome', color: '#f4f6f8', roughness: 0.04, metalness: 1 },
  { id: 'steel',      name: 'Stainless steel', color: '#c9ccd1', roughness: 0.18, metalness: 1 },
  { id: 'brushed',    name: 'Brushed steel',   color: '#b8bcc2', roughness: 0.42, metalness: 1 },
  { id: 'aluminium',  name: 'Aluminium',       color: '#d6d8db', roughness: 0.28, metalness: 1 },
  { id: 'gold',       name: 'Gold',            color: '#ffd27a', roughness: 0.14, metalness: 1 },
  { id: 'rosegold',   name: 'Rose gold',       color: '#e8b7a3', roughness: 0.16, metalness: 1 },
  { id: 'copper',     name: 'Copper',          color: '#d98a5b', roughness: 0.2,  metalness: 1 },
  { id: 'brass',      name: 'Brass',           color: '#d9b46a', roughness: 0.24, metalness: 1 },
  { id: 'bronze',     name: 'Bronze',          color: '#a9784a', roughness: 0.32, metalness: 1 },
  { id: 'titanium',   name: 'Titanium',        color: '#a8a6a3', roughness: 0.4,  metalness: 1 },
  { id: 'nickel',     name: 'Nickel',          color: '#b0aca5', roughness: 0.25, metalness: 1 },
  { id: 'gunmetal',   name: 'Gunmetal',        color: '#4b4e55', roughness: 0.35, metalness: 1 },
  { id: 'anodblack',  name: 'Anodised black',  color: '#2a2c30', roughness: 0.45, metalness: 0.9 },
  // --- coated / composite ---
  { id: 'carbon',     name: 'Carbon fibre',    color: '#1b1d22', roughness: 0.35, metalness: 0.2, clearcoat: 1,   clearcoatRoughness: 0.15 },
  { id: 'porcelain',  name: 'Porcelain',       color: '#f3f1ec', roughness: 0.25, metalness: 0,   clearcoat: 0.6, clearcoatRoughness: 0.2 },
  { id: 'ceramic',    name: 'Glossy ceramic',  color: '#e9e4dc', roughness: 0.3,  metalness: 0,   clearcoat: 0.5, clearcoatRoughness: 0.25 },
  // --- stone / mineral ---
  { id: 'wmarble',    name: 'White marble',    color: '#eceae4', roughness: 0.35, metalness: 0,   clearcoat: 0.4, clearcoatRoughness: 0.4 },
  { id: 'bmarble',    name: 'Black marble',    color: '#23252a', roughness: 0.3,  metalness: 0,   clearcoat: 0.5, clearcoatRoughness: 0.35 },
  { id: 'granite',    name: 'Granite',         color: '#8f8b86', roughness: 0.7,  metalness: 0 },
  { id: 'slate',      name: 'Slate',           color: '#4a4f55', roughness: 0.8,  metalness: 0 },
  { id: 'concrete',   name: 'Concrete',        color: '#b8b4ad', roughness: 0.9,  metalness: 0 },
  { id: 'sandstone',  name: 'Sandstone',       color: '#d8c4a0', roughness: 0.85, metalness: 0 },
  { id: 'terracotta', name: 'Terracotta',      color: '#c06a44', roughness: 0.8,  metalness: 0 },
  // --- warm ---
  { id: 'oak',        name: 'Oak wood',        color: '#b08a55', roughness: 0.6,  metalness: 0,   clearcoat: 0.2, clearcoatRoughness: 0.5 },
]

// Glass — `diffusion` seeds the roughness (frost); the Block panel exposes it as
// a live slider. `attenuation` is the distance (world units) over which the tint
// deepens; smaller = more saturated glass.
export const GLASS_PRESETS = [
  { id: 'clear',     name: 'Clear',        color: '#ffffff', diffusion: 0.0,  transmission: 1.0,  ior: 1.5,  thickness: 4, attenuation: 40 },
  { id: 'satin',     name: 'Satin',        color: '#f2f4f6', diffusion: 0.28, transmission: 1.0,  ior: 1.5,  thickness: 4, attenuation: 30 },
  { id: 'frosted',   name: 'Frosted',      color: '#ffffff', diffusion: 0.6,  transmission: 1.0,  ior: 1.5,  thickness: 5, attenuation: 24 },
  { id: 'smoked',    name: 'Smoked grey',  color: '#6d7075', diffusion: 0.06, transmission: 0.96, ior: 1.5,  thickness: 6, attenuation: 8 },
  { id: 'graphiteg', name: 'Graphite',     color: '#3a3d42', diffusion: 0.12, transmission: 0.9,  ior: 1.52, thickness: 6, attenuation: 6 },
  { id: 'obsidian',  name: 'Obsidian',     color: '#1b1d22', diffusion: 0.08, transmission: 0.72, ior: 1.55, thickness: 7, attenuation: 4 },
  { id: 'amber',     name: 'Amber',        color: '#d98a2b', diffusion: 0.05, transmission: 0.98, ior: 1.51, thickness: 5, attenuation: 9 },
  { id: 'honey',     name: 'Honey',        color: '#d8a13a', diffusion: 0.1,  transmission: 0.97, ior: 1.5,  thickness: 5, attenuation: 8 },
  { id: 'champagne', name: 'Champagne',    color: '#e8d3a8', diffusion: 0.14, transmission: 1.0,  ior: 1.5,  thickness: 4, attenuation: 16 },
  { id: 'bronzeg',   name: 'Bronze glass', color: '#8a6a3a', diffusion: 0.05, transmission: 0.94, ior: 1.52, thickness: 6, attenuation: 7 },
  { id: 'peach',     name: 'Peach',        color: '#f0b48a', diffusion: 0.16, transmission: 1.0,  ior: 1.5,  thickness: 4, attenuation: 14 },
  { id: 'rose',      name: 'Rose',         color: '#e6a9be', diffusion: 0.12, transmission: 1.0,  ior: 1.5,  thickness: 5, attenuation: 12 },
  { id: 'ruby',      name: 'Ruby',         color: '#c0304a', diffusion: 0.04, transmission: 0.97, ior: 1.54, thickness: 6, attenuation: 6 },
  { id: 'wine',      name: 'Wine',         color: '#7a2438', diffusion: 0.05, transmission: 0.92, ior: 1.53, thickness: 7, attenuation: 5 },
  { id: 'amethyst',  name: 'Amethyst',     color: '#9b6ec0', diffusion: 0.1,  transmission: 0.98, ior: 1.53, thickness: 5, attenuation: 8 },
  { id: 'cobalt',    name: 'Cobalt blue',  color: '#2b56c0', diffusion: 0.05, transmission: 0.96, ior: 1.52, thickness: 6, attenuation: 6 },
  { id: 'sapphire',  name: 'Sapphire',     color: '#1f3f8a', diffusion: 0.04, transmission: 0.94, ior: 1.55, thickness: 7, attenuation: 5 },
  { id: 'sky',       name: 'Sky',          color: '#7fb2e6', diffusion: 0.14, transmission: 1.0,  ior: 1.5,  thickness: 4, attenuation: 14 },
  { id: 'ice',       name: 'Ice blue',     color: '#cfe6f2', diffusion: 0.22, transmission: 1.0,  ior: 1.5,  thickness: 5, attenuation: 22 },
  { id: 'aqua',      name: 'Aqua',         color: '#4fc0c8', diffusion: 0.08, transmission: 0.98, ior: 1.51, thickness: 5, attenuation: 10 },
  { id: 'teal',      name: 'Teal',         color: '#2a8a8a', diffusion: 0.07, transmission: 0.96, ior: 1.52, thickness: 6, attenuation: 7 },
  { id: 'emerald',   name: 'Emerald',      color: '#2ba05a', diffusion: 0.05, transmission: 0.97, ior: 1.54, thickness: 6, attenuation: 6 },
  { id: 'jade',      name: 'Jade',         color: '#7fbf9a', diffusion: 0.18, transmission: 0.98, ior: 1.52, thickness: 5, attenuation: 10 },
  { id: 'forest',    name: 'Forest',       color: '#256b3a', diffusion: 0.06, transmission: 0.93, ior: 1.53, thickness: 7, attenuation: 5 },
  { id: 'seagreen',  name: 'Sea green',    color: '#4a9e7a', diffusion: 0.1,  transmission: 0.97, ior: 1.51, thickness: 5, attenuation: 9 },
]

export const PBR_BY_ID = Object.fromEntries(PBR_PRESETS.map((p) => [p.id, p]))
export const GLASS_BY_ID = Object.fromEntries(GLASS_PRESETS.map((p) => [p.id, p]))
