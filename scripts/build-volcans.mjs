#!/usr/bin/env node
// CUISSON DES VOLCANS — Smithsonian Global Volcanism Program, Volcanoes of the
// World (les volcans de l'Holocène, ~12 000 dernières années).
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI ON CUIT AU LIEU D'INTERROGER EN DIRECT
// ═══════════════════════════════════════════════════════════════════════════
//
// Le service WFS du Smithsonian rend 2,4 Mo de GeoJSON pour 1 196 volcans : un
// résumé géologique par volcan, des liens de photos, la tectonique. Tout cela
// est précieux — et rien de tout cela ne sert à poser un repère sur une carte.
//
// On garde SIX champs et on tombe sous 100 Ko. Le fichier ne bouge plus qu'à
// chaque éruption nouvelle, c'est-à-dire quelques fois par an : le télécharger
// à chaque visite serait payer 2,4 Mo pour une donnée qui, elle, ne change pas.
//
// Et il y a un motif plus dur : le service est un GeoServer public sans
// engagement de disponibilité. Une carte dont un calque dépend d'un serveur
// tiers en direct tombe quand ce serveur tombe. Cuit, il ne tombe jamais.
//
// ⚠️ ATTRIBUTION OBLIGATOIRE. Le GVP demande d'être cité, avec la version de la
// base et sa date. Elle est écrite dans le fichier produit et affichée par le
// calque — pas laissée à la mémoire de celui qui l'intègre.
//
// Relance :  node scripts/build-volcans.mjs

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const URL_WFS =
  'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0' +
  '&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json'

const SORTIE = 'public/data/volcans.json'

console.log('  Téléchargement du catalogue GVP…')
const rep = await fetch(URL_WFS)
if (!rep.ok) {
  console.error(`  ✗ le service a répondu ${rep.status}. Rien n'a été écrit.`)
  process.exit(1)
}
const brut = await rep.json()
const entrees = brut.features ?? []
if (entrees.length < 900) {
  // Un catalogue qui maigrit brutalement est un service en panne, pas une
  // extinction de volcans. On refuse plutôt que d'écraser un bon fichier.
  console.error(`  ✗ seulement ${entrees.length} volcans reçus (attendu ~1 200). Rien n'a été écrit.`)
  process.exit(1)
}

const volcans = []
for (const f of entrees) {
  const p = f.properties ?? {}
  const lat = Number(p.Latitude)
  const lon = Number(p.Longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
  volcans.push([
    p.Volcano_Name ?? '?',
    Math.round(lat * 1e4) / 1e4,
    Math.round(lon * 1e4) / 1e4,
    // ⚠️ L'ALTITUDE PEUT ÊTRE NÉGATIVE, et ce n'est pas une erreur de saisie :
    // les volcans sous-marins sont dans ce catalogue, et ils sont nombreux.
    Number.isFinite(Number(p.Elevation)) ? Math.round(Number(p.Elevation)) : null,
    p.Primary_Volcano_Type ?? '',
    // Année de la dernière éruption connue. Négative = avant notre ère.
    //
    // ⚠️ ZÉRO EST LE CODE « INCONNU » DU GVP, PAS L'AN ZÉRO — qui n'existe pas
    // dans le calendrier julien de toute façon. Le laisser passer aurait
    // affiché « dernière éruption : an 0 » sur des centaines de volcans, et
    // surtout les aurait classés parmi les datés. `null` dit la vérité :
    // aucune éruption datée, ce qui n'est PAS « éteint » — le catalogue ne
    // couvre que ce qui a été observé.
    Number.isFinite(Number(p.Last_Eruption_Year)) && Number(p.Last_Eruption_Year) !== 0
      ? Number(p.Last_Eruption_Year)
      : null,
  ])
}

volcans.sort((a, b) => a[1] - b[1] || a[2] - b[2])

const doc = {
  source: 'Smithsonian Institution, Global Volcanism Program — Volcanoes of the World',
  attribution: 'Smithsonian Institution · Global Volcanism Program',
  url: 'https://volcano.si.edu/',
  cuit: new Date().toISOString().slice(0, 10),
  champs: ['nom', 'lat', 'lon', 'altitude_m', 'type', 'derniere_eruption'],
  volcans,
}

mkdirSync(path.dirname(SORTIE), { recursive: true })
writeFileSync(SORTIE, JSON.stringify(doc))
const ko = (JSON.stringify(doc).length / 1024).toFixed(1)
console.log(`  ✓ ${volcans.length} volcans → ${SORTIE} (${ko} Ko, contre 2 353 Ko de source)`)
