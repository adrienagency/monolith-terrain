// DIAG GRA — L'ÉCART DE LOI ENTRE DEUX CHEMINS, SUR LA TRANCHE RÉELLE DU BLOC
//
// ⛔ **POURQUOI CE BANC EXISTE, ET CE QU'IL REMPLACE.** Le brief demande
// « l'écart d'image entre deux zooms, en pixels, pleine résolution ». **Cet
// instrument-là a été construit (`diag-gra-pixels.mjs`), lancé, et il ne
// décide RIEN** — c'est écrit au §« ce que j'ai cru puis réfuté » du rapport :
//
//   · sans `params.animations = false`, **69,4 %** des pixels diffèrent entre
//     deux captures que la loi rend IDENTIQUES ;
//   · avec, il en reste **14 à 22 %**, et surtout **81 à 84 %** entre les
//     captures z13 « avant » et « après » de La Réunion, **dont le pivot rendu
//     et la fenêtre utile sont pourtant égaux au dixième de mètre**.
//
// La cause est nommée par le brief lui-même (« le pixel n'est déterministe
// qu'en orbite ») : nuages, houle, écume, champ d'étoiles et ordre d'arrivée
// des tuiles ne se rejouent pas d'une session à l'autre. **Un banc qui bouge
// de 84 % là où la grandeur mesurée ne bouge pas de zéro ne mesure pas la
// grandeur.**
//
// ⚡ **CE QUI EST DÉTERMINISTE, C'EST LA LOI**, et c'est elle qui décide de la
// couleur : `rampT = clamp(0,5 + (hNormRelief − pivot) × contraste, 0, 1)`,
// l'INDICE avec lequel la terre lit le LUT (R31 : « les deux régimes lisent la
// MÊME table ; ce qui ne suivait pas, c'est l'indice »). Ce banc rejoue cette
// ligne — plancher de pivot compris — depuis les uniformes VIVANTS relevés à
// l'arrivée de chaque chemin, sur **la tranche d'altitude qui existe vraiment
// dans le bloc** (R31 §① : un balayage large surestime).
//
//     écart = max sur h de |rampT_cheminA(h) − rampT_cheminB(h)|
//
// Un écart de 1 texel sur un LUT de 512 vaut **0,00195**.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLAFOND_PIVOT, MARGE_PIVOT } from '../src/monde/naturel-crop.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PAS_LUT = 1 / 512

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

// la ligne du nuanceur, mot pour mot (globe.js, bloc `uRampCropOn`)
function loi(G) {
  const amp = Math.max(G.landMax - G.reliefBas, G.plancher)
  const hNormMer = (0 - G.reliefBas) / amp
  const pivot = Math.max(G.pivot, Math.min(Math.max(hNormMer, 0), PLAFOND_PIVOT) + MARGE_PIVOT)
  return (h) => clamp01(0.5 + (clamp01((h - G.reliefBas) / amp) - pivot) * G.contraste)
}

const rapport = { quand: new Date().toISOString(), pasLut: PAS_LUT, lignes: [] }
for (const etiquette of ['avant', 'apres']) {
  const f = path.join(RACINE, '.banc/GRA', etiquette, 'chemins.json')
  if (!fs.existsSync(f)) { console.log('(manquant : ' + f + ')'); continue }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'))
  const parLieu = new Map()
  for (const l of j.lignes) {
    if (!parLieu.has(l.lieu)) parLieu.set(l.lieu, [])
    parLieu.get(l.lieu).push(l)
  }
  for (const [lieu, lignes] of parLieu) {
    const ref = lignes.find((l) => l.depart === 13)
    if (!ref) continue
    // ⚠️ LA TRANCHE RÉELLE DU BLOC D'ARRIVÉE, pas un balayage large — R31 §①.
    // ⚠️ **REPLI SUR `[max(0, uReliefBas) ; uLandMax]` — LA BORNE DE R31 §①.**
    // `_mesureBloc` n'existe QUE dans la version corrigée : sans repli, le banc
    // ne rendrait aucune ligne « avant » et l'A/B serait muet d'un seul côté —
    // « un banc différentiel ne distingue pas rien-n'a-changé de tout-est-cassé ».
    const bas = Math.max(0, ref.mesureBloc?.minTerreM ?? ref.globe.reliefBas)
    const haut = ref.mesureBloc?.maxTerreM ?? ref.globe.landMax
    if (!(haut > bas)) continue
    const fRef = loi(ref.globe)
    for (const l of lignes) {
      if (l.depart === 13) continue
      const fL = loi(l.globe)
      let pire = 0, hPire = bas
      for (let i = 0; i <= 2000; i++) {
        const h = bas + ((haut - bas) * i) / 2000
        const d = Math.abs(fRef(h) - fL(h))
        if (d > pire) { pire = d; hPire = h }
      }
      rapport.lignes.push({ etiquette, lieu, paire: `z13 vs depuis-z${l.depart}`, tranche: [bas, haut], ecartMax: pire, hPireM: hPire, texels: pire / PAS_LUT })
      console.log(`[${etiquette}] ${lieu.padEnd(8)} z13 vs depuis-z${l.depart} · tranche [${bas.toFixed(0)} ; ${haut.toFixed(0)}] m`
        + ` → ecart max de rampT = ${pire.toFixed(5)} (${(pire / PAS_LUT).toFixed(1)} texels) a ${hPire.toFixed(0)} m`)
    }
  }
}
fs.writeFileSync(path.join(RACINE, '.banc/GRA/loi.json'), JSON.stringify(rapport, null, 1))
console.log('\necrit : .banc/GRA/loi.json')
