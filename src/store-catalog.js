// Boutique in-app (« store mode ») — mapping du catalogue /templates/data.json
// vers les stores utilisateur existants. Tout est pur (testable en node) :
// la partie DOM vit dans src/ui/store.js, l'écriture localStorage dans main.js.

// entrée « Couleurs » du catalogue → enregistrement compatible user-palettes.js
export function paletteRecordFromShop(entry) {
  return {
    id: `shop_${entry.slug}`,
    name: entry.name,
    rampStops: entry.rampStops.map((s) => ({ c: s.c, p: s.p })),
    oceanShallow: entry.oceanShallow,
    oceanMid: entry.oceanMid,
    oceanDeep: entry.oceanDeep,
  }
}

// entrée « Styles » (look complet) → texte .shibumap-template, le format que
// importTemplateText (main.js) sait déjà ranger dans les templates user.
export function styleTemplateText(entry) {
  return JSON.stringify({
    format: 'shibumap-template',
    version: 1,
    name: entry.name,
    strip: entry.strip ?? (entry.look.rampStops || []).map((s) => s.c),
    look: entry.look,
  })
}

// dédup par id : réintégrer une palette déjà possédée est un no-op silencieux
export function mergeShopPalettes(existing, records) {
  const have = new Set(existing.map((p) => p.id))
  const fresh = records.filter((r) => !have.has(r.id))
  return { list: existing.concat(fresh), added: fresh.length }
}

// styles déjà possédés (même nom) — on ne crée pas de doublon
export function notOwnedStyles(existingTemplates, entries) {
  const have = new Set(existingTemplates.map((t) => t.name))
  return entries.filter((e) => !have.has(e.name))
}
