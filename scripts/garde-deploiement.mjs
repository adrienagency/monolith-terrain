#!/usr/bin/env node
// LE GARDE-DÉPLOIEMENT — dire à voix haute ce qu'on s'apprête à écraser.
//
// Né d'une vraie erreur, le 2026-08-07 : deux dépôts voisins (`monolith-terrain`
// et `shibumap-site`), deux sites Netlify, et AUCUN des deux ne se déploie
// depuis git. Un `netlify deploy` lancé depuis le mauvais dossier publie l'autre
// site, réussit, affiche « Deploy complete » — et on croit avoir mis en ligne
// quelque chose qui n'y est pas. Il a fallu une heure pour s'en apercevoir.
//
// Ce garde ne rend pas l'erreur impossible : rien n'empêchera jamais quelqu'un
// de taper `netlify deploy` à la main ailleurs. Il rend l'erreur VISIBLE, en
// annonçant la cible avant de partir plutôt qu'après. C'est tout ce qu'on peut
// honnêtement promettre, et c'était ce qui manquait.
//
// Il passe EN PREMIER dans la chaîne de `npm run deploy`, avant la construction :
// découvrir qu'on visait le mauvais site après cinq minutes de build serait une
// punition, pas un garde-fou.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { execSync } from 'node:child_process'

// Ce dépôt-ci, et le site qu'il a le droit de publier. Les deux doivent
// concorder — c'est la seule paire autorisée.
export const PAQUET_ATTENDU = 'monolith-terrain-experiment'
export const SITE_ATTENDU = 'adrien-clean-earth'
export const URL_ATTENDUE = 'https://shibumap.com'

/**
 * Le jugement, séparé de sa collecte pour être testable sans réseau ni git.
 *
 * ⚠️ LA DISTINCTION QUI COMPTE : on REFUSE quand la cible est fausse, on se
 * contente d'AVERTIR quand elle est juste mais l'état douteux. Un garde qui
 * bloque sur des broutilles est un garde qu'on finit par contourner, et un
 * garde contourné ne protège plus de rien.
 */
export function juger({ paquet, site, url, branche, propre, enRetard }) {
  const refus = []
  const alertes = []

  if (paquet !== PAQUET_ATTENDU) {
    refus.push(`Ce dossier n'est pas le bon dépôt : « ${paquet} » au lieu de « ${PAQUET_ATTENDU} ».`)
  }
  if (site && site !== SITE_ATTENDU) {
    refus.push(`Le site relié est « ${site} », pas « ${SITE_ATTENDU} ». Refus : ce dépôt ne publie que shibumap.com.`)
  }
  if (!site) {
    // Sans réseau on ne peut pas vérifier la cible. On le DIT plutôt que de
    // laisser croire que la vérification a eu lieu.
    alertes.push("Site non vérifié (Netlify injoignable) — la cible n'a pas pu être confirmée.")
  }
  if (propre === false) {
    alertes.push('Des modifications ne sont pas commitées : ce qui part en ligne ne sera pas retrouvable dans git.')
  }
  if (enRetard) {
    alertes.push("Des commits locaux ne sont pas poussés — si cette machine tombe, ce déploiement n'existe nulle part ailleurs.")
  }

  return { ok: refus.length === 0, refus, alertes, branche, url }
}

// ── Collecte ────────────────────────────────────────────────────────────────

const silencieux = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function collecter() {
  const paquet = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name
  const branche = silencieux('git branch --show-current') || '?'
  const commit = silencieux('git log --oneline -1') || '?'
  const propre = silencieux('git status --porcelain') === ''
  // « ahead » dans la sortie courte de git : des commits locaux non poussés.
  const enRetard = /ahead/.test(silencieux('git status -sb') || '')

  let site = null
  const brut = silencieux('npx netlify status --json')
  if (brut) {
    try {
      // ⚠️ La clé est `site-name`, AVEC UN TIRET — pas `name`. Écrite à
      // l'instinct, elle rendait `undefined`, donc « non vérifié », donc un
      // garde qui n'avait jamais rien à dire sur la seule chose qu'il devait
      // vérifier. Trouvé en inspectant la sortie réelle de la CLI.
      site = JSON.parse(brut).siteData?.['site-name'] || null
    } catch { /* sortie inattendue : on reste sur « non vérifié » */ }
  }

  return { paquet, site, url: URL_ATTENDUE, branche, commit, propre, enRetard }
}

// ── Sortie ──────────────────────────────────────────────────────────────────

// ⚠️ `pathToFileURL`, PAS une concaténation à la main. Sous Windows le chemin
// devient « file:///C:/… » avec TROIS barres ; la comparaison naïve échouait
// donc toujours, et ce garde sortait en silence avec le code 0 — câblé dans la
// chaîne de déploiement, et parfaitement inerte. Trouvé en l'exécutant, pas en
// le relisant : un garde qui ne se déclenche jamais a l'air d'un garde qui
// n'a rien à signaler.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const faits = collecter()
  const verdict = juger(faits)

  console.log('')
  console.log('  ┌─ DÉPLOIEMENT EN PRODUCTION ────────────────────────────')
  console.log(`  │  Dépôt   ${faits.paquet}`)
  console.log(`  │  Branche ${faits.branche} — ${faits.commit}`)
  console.log(`  │  Site    ${faits.site || '(non vérifié)'} → ${faits.url}`)
  console.log('  └────────────────────────────────────────────────────────')
  console.log('')

  for (const a of verdict.alertes) console.log(`  ⚠️  ${a}`)
  if (verdict.alertes.length) console.log('')

  if (!verdict.ok) {
    for (const r of verdict.refus) console.error(`  ⛔ ${r}`)
    console.error('')
    console.error('  Déploiement interrompu AVANT la construction. Rien n\'a été touché.')
    console.error('')
    process.exit(1)
  }
}
