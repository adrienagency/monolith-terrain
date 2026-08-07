#!/usr/bin/env node
// LA CARTE DE L'ÉCOSYSTÈME — lue dans le code, jamais dessinée à la main.
//
// Pourquoi un programme et pas un schéma : `main.js` fait plus de dix mille
// lignes, le projet compte 165 fichiers de tests et une vingtaine de sources
// géographiques externes. Un diagramme dessiné à la main serait faux en une
// semaine, et un schéma faux est pire que pas de schéma — on lui fait
// confiance. Celui-ci se régénère à chaque build : il ne peut se tromper que
// si le code se trompe.
//
//   npm run carte           régénère docs/carte-ecosysteme.json + .html
//
// Ce qu'il sait lire, et donc ce qu'il ne peut pas oublier :
//   - les modules de src/ et leurs dépendances réelles (les imports)
//   - les fonctions serveur, leurs variables d'environnement et leurs magasins
//   - les hôtes externes appelés, extraits des URL du code
//   - la couverture de tests, comparée au disque
//
// Ce qu'il NE sait PAS lire, et qui est donc tenu à la main plus bas :
// les surfaces publiques, les prestataires et les flux d'argent. Ces
// choses-là ne sont écrites nulle part dans le code — elles vivent dans des
// tableaux de bord et des contrats.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const lire = (p) => readFileSync(join(RACINE, p), 'utf8')

// ── Parcours de fichiers ────────────────────────────────────────────────────

function fichiers(dossier, ext) {
  const sortie = []
  const marcher = (d) => {
    for (const e of readdirSync(join(RACINE, d))) {
      const chemin = `${d}/${e}`
      if (statSync(join(RACINE, chemin)).isDirectory()) marcher(chemin)
      else if (ext.some((x) => e.endsWith(x))) sortie.push(chemin)
    }
  }
  marcher(dossier)
  return sortie
}

// ── Ce que le code dit de lui-même ──────────────────────────────────────────

const RE_IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g
const RE_HOTE = /https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi
const RE_ENV = /process\.env\.([A-Z0-9_]+)/g
const RE_MAGASIN = /getStore\(\s*(?:\{\s*name:\s*)?['"]([^'"]+)['"]/g

const motifs = (texte, re) => [...texte.matchAll(re)].map((m) => m[1])

// Un import relatif résolu en chemin de dépôt, pour tracer une vraie arête.
function resoudre(depuis, spec) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(join(RACINE, depuis)), spec)
  const rel = relative(RACINE, base).replace(/\\/g, '/')
  return rel.endsWith('.js') || rel.endsWith('.mjs') ? rel : `${rel}.js`
}

function analyser(chemin) {
  const texte = lire(chemin)
  return {
    chemin,
    lignes: texte.split('\n').length,
    // ⚠️ On dédoublonne : un même hôte cité trois fois est UNE dépendance,
    // pas trois. Compter les occurrences donnerait un classement qui reflète
    // le style d'écriture et non l'architecture.
    hotes: [...new Set(motifs(texte, RE_HOTE))],
    env: [...new Set(motifs(texte, RE_ENV))],
    magasins: [...new Set(motifs(texte, RE_MAGASIN))],
    importe: [...new Set(motifs(texte, RE_IMPORT).map((s) => resoudre(chemin, s)).filter(Boolean))],
    externes: [...new Set(motifs(texte, RE_IMPORT).filter((s) => !s.startsWith('.')))],
  }
}

// ── Ce que le code ne dit pas, et qu'il faut donc tenir à jour ici ──────────
//
// ⚠️ SEULE PARTIE ÉCRITE À LA MAIN DE TOUT CE FICHIER. Si vous ajoutez un
// prestataire, une surface ou un flux d'argent, c'est ici — et nulle part
// ailleurs. Tout le reste se déduit du code.

const SURFACES = [
  { nom: 'L\'application', url: 'shibumap.com', quoi: 'le générateur de cartes trois dimensions', etat: 'en ligne' },
  { nom: 'Le site vitrine', url: 'shibumap.com (pages)', quoi: 'la présentation défilante, entièrement pré-rendue', etat: 'en ligne', depot: 'C:\\Dev\\shibumap-site' },
  { nom: 'La boutique', url: 'shibumap.com/?store=1', quoi: 'les gabarits, dans l\'application elle-même', etat: 'en ligne, commerce caché' },
  { nom: 'Le Race Studio', url: 'shibumap.com/?studio=1', quoi: 'la sous-application des organisateurs', etat: 'en ligne' },
  { nom: 'L\'affiche imprimable', url: 'dans l\'application', quoi: 'le PDF vendu, du rendu tuilé aux traits de coupe', etat: 'en ligne, à 0 € pour l\'instant' },
]

const PRESTATAIRES = [
  { nom: 'Netlify', role: 'hébergement, fonctions, magasin, diffusion mondiale', cout: '20 $/mois (Pro)', etat: 'en service' },
  { nom: 'Stripe', role: 'encaissement, factures, fiches clients', cout: 'à la commission', etat: 'en service, mode réel' },
  { nom: 'Resend', role: 'courriels transactionnels', cout: 'offre gratuite', etat: 'en service, domaine authentifié' },
  { nom: 'Supabase', role: 'comptes et données utilisateurs', cout: '25 $/mois (Pro)', etat: 'à ouvrir — bloque toute la Phase 1' },
]

const ARGENT = [
  'Le visiteur clique « Recevoir le fichier » dans l\'application',
  'La caisse (paiement.mjs) demande une session à Stripe — le prix vient du catalogue serveur, jamais du navigateur',
  'Le visiteur paie sur une page hébergée par Stripe : aucune donnée de carte ne touche ce serveur',
  'Stripe rappelle le webhook, dont la signature est vérifiée',
  'La commande est écrite au journal AVANT tout envoi — si le courriel échoue, la vente reste tracée',
  'Resend porte le lien de téléchargement',
]

const CHANTIERS = [
  { quoi: 'Comptes utilisateurs', ou: 'Phase 0 faite et commitée', bloque: 'ouverture du projet Supabase' },
  { quoi: 'Conformité PDF/X', ou: 'jamais validée', bloque: 'un passage Acrobat Preflight — vérifier, ne pas convertir' },
  { quoi: 'Impression en dropshipping', ou: 'option grisée dans l\'interface', bloque: 'choix du prestataire' },
]

// ── La planche ──────────────────────────────────────────────────────────────
//
// Le tableau de bord est produit par le même programme que les chiffres :
// c'est ce qui garantit qu'il ne peut pas dériver d'eux. Une planche
// cartographique, puisque c'est le métier — annotations en chasse fixe comme
// sur une carte d'état-major, et la profondeur de dépendance lue comme une
// échelle d'altitude.

const ech = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ETATS = {
  'en service': 'bon',
  'en ligne': 'bon',
  'en ligne, commerce caché': 'bon',
  'en ligne, mode réel': 'bon',
  'en ligne, domaine authentifié': 'bon',
}
const teinteEtat = (e) => ETATS[e] || (/bloque|à ouvrir|jamais|grisée/i.test(e) ? 'attente' : /0 €|caché/i.test(e) ? 'tiede' : 'bon')

function page(c) {
  const nf = (n) => n.toLocaleString('fr-FR')
  const maxDep = Math.max(...c.code.piliers.map((p) => p.dependants))

  return `<title>ShibuMap — la planche de l'écosystème</title>
<style>
:root {
  /* Teintes prises dans le produit : le turquoise de la mer, le brun des
     courbes de niveau, le papier légèrement verdi d'une carte d'état-major. */
  --papier: #F1F3EF;
  --papier-creux: #E7EAE4;
  --encre: #16221F;
  --encre-douce: #5C6862;
  --trait: #CDD3CA;
  --mer: #1F7A73;
  --mer-pale: #D6E7E4;
  --relief: #8A7550;
  --bon: #3F7A4B;
  --attente: #A85B22;
  --tiede: #8A7550;
  --ombre: 0 1px 2px rgba(22,34,31,.06), 0 8px 24px -12px rgba(22,34,31,.18);
}
@media (prefers-color-scheme: dark) {
  :root {
    --papier: #101917; --papier-creux: #16221F; --encre: #E8EDE9;
    --encre-douce: #93A29B; --trait: #2A3833; --mer: #5FBDB2; --mer-pale: #1B302D;
    --relief: #B79C6E; --bon: #6FB37C; --attente: #D98A45; --tiede: #B79C6E;
    --ombre: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"] {
  --papier: #101917; --papier-creux: #16221F; --encre: #E8EDE9;
  --encre-douce: #93A29B; --trait: #2A3833; --mer: #5FBDB2; --mer-pale: #1B302D;
  --relief: #B79C6E; --bon: #6FB37C; --attente: #D98A45; --tiede: #B79C6E;
  --ombre: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6);
}
:root[data-theme="light"] {
  --papier: #F1F3EF; --papier-creux: #E7EAE4; --encre: #16221F;
  --encre-douce: #5C6862; --trait: #CDD3CA; --mer: #1F7A73; --mer-pale: #D6E7E4;
  --relief: #8A7550; --bon: #3F7A4B; --attente: #A85B22; --tiede: #8A7550;
  --ombre: 0 1px 2px rgba(22,34,31,.06), 0 8px 24px -12px rgba(22,34,31,.18);
}

body {
  background: var(--papier); color: var(--encre);
  font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
  line-height: 1.6; margin: 0; padding: 0 clamp(1rem, 4vw, 3rem) 6rem;
  -webkit-font-smoothing: antialiased;
}
.feuille { max-width: 68rem; margin: 0 auto; }

/* L'en-tête porte le graticule — le quadrillage d'une carte. Nulle part
   ailleurs : un fond texturé sous du texte dense le rend illisible. */
header {
  padding: clamp(2.5rem, 7vw, 5rem) 0 2.5rem; margin-bottom: 3rem;
  border-bottom: 2px solid var(--encre); position: relative;
}
header::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background:
    repeating-linear-gradient(to right, var(--trait) 0 1px, transparent 1px 4.5rem),
    repeating-linear-gradient(to bottom, var(--trait) 0 1px, transparent 1px 4.5rem);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,.5), transparent 78%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,.5), transparent 78%);
}
header > * { position: relative; }

h1 {
  font-size: clamp(2.1rem, 6vw, 3.4rem); line-height: 1.04; margin: 0 0 .6rem;
  letter-spacing: -.03em; font-weight: 620; text-wrap: balance;
}
h1 em { font-style: normal; color: var(--mer); }
.sous { max-width: 46ch; color: var(--encre-douce); margin: 0; font-size: 1.05rem; }

.cote {
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  font-size: .68rem; letter-spacing: .16em; text-transform: uppercase;
  color: var(--encre-douce);
}

/* Le cartouche de chiffres : ce qu'on lit avant tout le reste. */
.releve { display: flex; flex-wrap: wrap; gap: 2.5rem; margin-top: 2.2rem; }
.releve div { display: flex; flex-direction: column; gap: .15rem; }
.releve b {
  font-size: 1.9rem; font-weight: 600; letter-spacing: -.02em;
  font-variant-numeric: tabular-nums; line-height: 1;
}

section { margin-bottom: 3.5rem; }
h2 {
  font-size: 1.28rem; font-weight: 600; letter-spacing: -.015em;
  margin: 0 0 .35rem; display: flex; align-items: baseline; gap: .8rem;
}
h2 .cote { flex: none; }
.chapeau { color: var(--encre-douce); margin: 0 0 1.4rem; max-width: 62ch; }

.grille { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); }

.bloc {
  background: var(--papier-creux); border: 1px solid var(--trait);
  border-radius: 3px; padding: 1rem 1.1rem; box-shadow: var(--ombre);
  display: flex; flex-direction: column; gap: .3rem;
}
.bloc h3 { margin: 0; font-size: .98rem; font-weight: 600; }
.bloc p { margin: 0; color: var(--encre-douce); font-size: .89rem; }

.jeton {
  align-self: flex-start; font-family: ui-monospace, Consolas, monospace;
  font-size: .68rem; letter-spacing: .05em; padding: .16rem .5rem;
  border-radius: 2px; margin-top: .35rem;
}
.jeton.bon { background: color-mix(in srgb, var(--bon) 16%, transparent); color: var(--bon); }
.jeton.attente { background: color-mix(in srgb, var(--attente) 18%, transparent); color: var(--attente); }
.jeton.tiede { background: color-mix(in srgb, var(--tiede) 18%, transparent); color: var(--tiede); }

/* L'échelle d'altitude : la barre dit de combien de modules dépend celui-ci. */
.pile { display: flex; flex-direction: column; gap: 1px; }
.strate {
  display: grid; grid-template-columns: 1fr auto auto; align-items: center;
  gap: 1rem; padding: .5rem .8rem; background: var(--papier-creux);
  border-left: 3px solid var(--mer); position: relative; overflow: hidden;
}
.strate .fond {
  position: absolute; inset: 0; background: var(--mer-pale);
  transform-origin: left; z-index: 0;
}
.strate > * { position: relative; z-index: 1; }
.strate code {
  font-family: ui-monospace, Consolas, monospace; font-size: .84rem;
  overflow-wrap: anywhere;
}
.strate .n { font-variant-numeric: tabular-nums; font-size: .82rem; color: var(--encre-douce); white-space: nowrap; }

ol.chaine { counter-reset: e; list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .55rem; }
ol.chaine li {
  counter-increment: e; display: grid; grid-template-columns: auto 1fr;
  gap: .9rem; align-items: start;
}
ol.chaine li::before {
  content: counter(e, decimal-leading-zero);
  font-family: ui-monospace, Consolas, monospace; font-size: .72rem;
  color: var(--mer); padding-top: .28rem; font-variant-numeric: tabular-nums;
}

.nuage { display: flex; flex-wrap: wrap; gap: .3rem; }
.nuage span {
  font-family: ui-monospace, Consolas, monospace; font-size: .74rem;
  background: var(--papier-creux); border: 1px solid var(--trait);
  padding: .2rem .5rem; border-radius: 2px; color: var(--encre-douce);
}

/* Le schéma : un SVG en ligne, pas de bibliothèque. Il doit rester lisible
   dans les deux thèmes, donc toutes ses couleurs passent par les jetons. */
.schema { margin: 0; }
.schema svg { width: 100%; height: auto; display: block; }
.schema .bande rect { fill: var(--papier-creux); stroke: var(--trait); stroke-width: 1; }
.schema .boite rect { fill: var(--papier); stroke: var(--mer); stroke-width: 1.5; }
.schema .boite.creux rect { stroke: var(--relief); }
.schema .boite.pointille rect { stroke: var(--encre-douce); stroke-dasharray: 4 3; }
.schema .etiquette {
  font-family: ui-monospace, Consolas, monospace; font-size: 11px;
  letter-spacing: .12em; text-transform: uppercase; fill: var(--encre-douce);
}
.schema .titre { font-size: 14px; font-weight: 600; fill: var(--encre); }
.schema .detail { font-size: 11.5px; fill: var(--encre-douce); }
.schema .lien path { fill: none; stroke: var(--encre-douce); stroke-width: 1.2; }
.schema .lien.pointille path { stroke-dasharray: 4 3; }
figcaption { color: var(--encre-douce); font-size: .88rem; margin-top: .8rem; max-width: 62ch; }

footer { border-top: 1px solid var(--trait); padding-top: 1.2rem; color: var(--encre-douce); font-size: .86rem; }
footer code { font-family: ui-monospace, Consolas, monospace; background: var(--papier-creux); padding: .1rem .35rem; border-radius: 2px; }
</style>

<div class="feuille">
<header>
  <p class="cote">Planche de l'écosystème · relevée le ${c.genereLe}</p>
  <h1>Tout ce qui fait vivre <em>ShibuMap</em></h1>
  <p class="sous">Cette page n'est pas dessinée : elle est <strong>lue dans le code</strong> à chaque build. Les chiffres ci-dessous sont ceux du dépôt au moment du relevé, pas ceux dont on se souvient.</p>
  <div class="releve">
    <div><b>${nf(c.code.lignes)}</b><span class="cote">lignes, ${c.code.modules} modules</span></div>
    <div><b>${c.code.fonctions}</b><span class="cote">fonctions serveur</span></div>
    <div><b>${c.sources.length}</b><span class="cote">sources externes</span></div>
    <div><b>${c.tests.listes}</b><span class="cote">fichiers de tests</span></div>
  </div>
</header>

<section>
  <h2><span class="cote">A</span> Les surfaces publiques</h2>
  <p class="chapeau">Ce qu'un visiteur peut atteindre aujourd'hui. Tout part du même dépôt et du même déploiement.</p>
  <div class="grille">
    ${c.surfaces.map((s) => `<article class="bloc">
      <h3>${ech(s.nom)}</h3>
      <p class="cote">${ech(s.url)}</p>
      <p>${ech(s.quoi)}</p>
      <span class="jeton ${teinteEtat(s.etat)}">${ech(s.etat)}</span>
    </article>`).join('\n    ')}
  </div>
</section>

<section>
  <h2><span class="cote">B</span> Comment ça tient ensemble</h2>
  <p class="chapeau">Le navigateur fait tout le rendu ; le serveur ne sert qu'à trois choses — garder les cartes publiées, encaisser, et envoyer des courriels. C'est ce qui permet à ShibuMap de tenir sur un hébergement à vingt dollars.</p>
  <figure class="schema">
  <svg viewBox="0 0 800 428" role="img" aria-labelledby="schema-titre">
    <title id="schema-titre">Trois étages : le navigateur fait tout le rendu, le serveur ne tient que la publication, l'encaissement et le courriel, et le dehors fournit le relief et les paiements.</title>
    <defs>
      <marker id="fleche" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L8,4 L0,8 z" fill="var(--encre-douce)"/>
      </marker>
    </defs>

    <g class="bande"><rect x="8" y="8" width="784" height="116" rx="3"/></g>
    <text class="etiquette" x="20" y="28">Dans le navigateur du visiteur — tout le travail lourd</text>
    <g class="boite"><rect x="24" y="40" width="240" height="68" rx="3"/></g>
    <text class="titre" x="40" y="66">L'application</text>
    <text class="detail" x="40" y="86">three.js, WebGL2</text>
    <text class="detail" x="40" y="100">relief, tracé, rendu, export PDF</text>
    <g class="boite"><rect x="288" y="40" width="220" height="68" rx="3"/></g>
    <text class="titre" x="304" y="66">Le Race Studio</text>
    <text class="detail" x="304" y="86">la sous-application</text>
    <text class="detail" x="304" y="100">des organisateurs</text>
    <g class="boite"><rect x="532" y="40" width="236" height="68" rx="3"/></g>
    <text class="titre" x="548" y="66">La boutique de gabarits</text>
    <text class="detail" x="548" y="86">dans l'application,</text>
    <text class="detail" x="548" y="100">sans rechargement</text>

    <g class="bande"><rect x="8" y="156" width="784" height="104" rx="3"/></g>
    <text class="etiquette" x="20" y="176">Sur le serveur — ${c.code.fonctions} fonctions, et rien d'autre</text>
    <g class="boite"><rect x="24" y="188" width="176" height="56" rx="3"/></g>
    <text class="titre" x="40" y="212">race.mjs</text>
    <text class="detail" x="40" y="230">publier, corriger, lire</text>
    <g class="boite"><rect x="224" y="188" width="176" height="56" rx="3"/></g>
    <text class="titre" x="240" y="212">paiement.mjs</text>
    <text class="detail" x="240" y="230">la caisse</text>
    <g class="boite"><rect x="424" y="188" width="200" height="56" rx="3"/></g>
    <text class="titre" x="440" y="212">paiement-webhook.mjs</text>
    <text class="detail" x="440" y="230">signature vérifiée</text>
    <g class="boite creux"><rect x="648" y="188" width="120" height="56" rx="3"/></g>
    <text class="titre" x="664" y="212">2 magasins</text>
    <text class="detail" x="664" y="230">${ech(c.code.magasins.join(', '))}</text>

    <g class="bande"><rect x="8" y="292" width="784" height="128" rx="3"/></g>
    <text class="etiquette" x="20" y="312">Au dehors — ce qui ne nous appartient pas</text>
    <g class="boite"><rect x="24" y="324" width="220" height="80" rx="3"/></g>
    <text class="titre" x="40" y="348">${c.sources.length} sources géographiques</text>
    <text class="detail" x="40" y="368">relief, images, lieux, mer</text>
    <text class="detail" x="40" y="384">appelées par le navigateur</text>
    <g class="boite"><rect x="268" y="324" width="176" height="80" rx="3"/></g>
    <text class="titre" x="284" y="348">Stripe</text>
    <text class="detail" x="284" y="368">page hébergée chez eux :</text>
    <text class="detail" x="284" y="384">aucune carte ici</text>
    <g class="boite"><rect x="468" y="324" width="140" height="80" rx="3"/></g>
    <text class="titre" x="484" y="348">Resend</text>
    <text class="detail" x="484" y="368">les courriels</text>
    <g class="boite pointille"><rect x="632" y="324" width="136" height="80" rx="3"/></g>
    <text class="titre" x="648" y="348">Supabase</text>
    <text class="detail" x="648" y="368">les comptes —</text>
    <text class="detail" x="648" y="384">pas encore ouvert</text>

    <g class="lien">
      <!-- L'application publie et corrige ses cartes, et ouvre la caisse. -->
      <path d="M112 108 V188" marker-end="url(#fleche)"/>
      <path d="M200 108 H312 V188" marker-end="url(#fleche)"/>
      <!-- ⚠️ Les sources remontent jusqu'au NAVIGATEUR, pas jusqu'au serveur :
           c'est toute la thèse du schéma, et la flèche doit donc contourner
           l'étage du milieu par la gouttière plutôt que s'y arrêter. -->
      <path d="M24 364 H16 V74 H24" marker-end="url(#fleche)"/>
      <!-- La caisse ouvre une session chez Stripe, qui rappelle le webhook. -->
      <path d="M312 244 V324" marker-end="url(#fleche)"/>
      <path d="M440 324 V244" marker-end="url(#fleche)"/>
      <!-- Le webhook écrit la commande, PUIS fait partir le courriel. -->
      <path d="M624 216 H648" marker-end="url(#fleche)"/>
      <path d="M524 244 V324" marker-end="url(#fleche)"/>
      <!-- race.mjs range les cartes dans le même magasin. -->
      <path d="M112 244 V252 H690 V244" marker-end="url(#fleche)"/>
    </g>
    <g class="lien pointille"><path d="M730 324 V244" marker-end="url(#fleche)"/></g>
  </svg>
  <figcaption>Le navigateur parle directement aux sources géographiques : rien de tout ce poids ne transite par le serveur. C'est ce qui permet à ShibuMap de tenir sur un hébergement à vingt dollars.</figcaption>
  </figure>
</section>

<section>
  <h2><span class="cote">C</span> Les prestataires</h2>
  <p class="chapeau">Quatre, dont un pas encore ouvert. Aucune donnée de carte bancaire ne touche jamais ce serveur : c'est la seule raison pour laquelle un site sans compte peut encaisser.</p>
  <div class="grille">
    ${c.prestataires.map((p) => `<article class="bloc">
      <h3>${ech(p.nom)}</h3>
      <p>${ech(p.role)}</p>
      <p class="cote">${ech(p.cout)}</p>
      <span class="jeton ${teinteEtat(p.etat)}">${ech(p.etat)}</span>
    </article>`).join('\n    ')}
  </div>
</section>

<section>
  <h2><span class="cote">D</span> Le chemin de l'argent</h2>
  <p class="chapeau">Six étapes, dans cet ordre exact. L'ordre n'est pas une commodité : écrire la commande avant d'envoyer le courriel est ce qui fait qu'un paiement ne se perd jamais.</p>
  <ol class="chaine">${c.argent.map((e) => `<li><span>${ech(e)}</span></li>`).join('')}</ol>
</section>

<section>
  <h2><span class="cote">E</span> Les piliers du code</h2>
  <p class="chapeau">Classés par ce qui dépend d'eux, pas par leur taille. La barre est l'emprise : plus elle est longue, plus casser ce module casse de choses ailleurs.</p>
  <div class="pile">
    ${c.code.piliers.map((p) => `<div class="strate">
      <div class="fond" style="transform: scaleX(${(p.dependants / maxDep).toFixed(3)})"></div>
      <code>${ech(p.chemin)}</code>
      <span class="n">${p.dependants} dépendants</span>
      <span class="n">${nf(p.lignes)} l.</span>
    </div>`).join('\n    ')}
  </div>
</section>

<section>
  <h2><span class="cote">F</span> Les sources géographiques</h2>
  <p class="chapeau">Toutes publiques, toutes appelées depuis le navigateur du visiteur. Chacune est une dépendance qui peut tomber sans prévenir — et une licence à vérifier avant usage.</p>
  <div class="nuage">${c.sources.map((s) => `<span>${ech(s.hote)}</span>`).join('')}</div>
</section>

<section id="vivant" hidden>
  <h2><span class="cote">G</span> Le relevé du jour</h2>
  <p class="chapeau">Compté à 6 h, 12 h et 18 h. Contrairement à tout ce qui précède, ces chiffres-là bougent entre deux déploiements.</p>
  <div class="releve" id="vivant-chiffres"></div>
  <p class="cote" id="vivant-heure"></p>
</section>

<section>
  <h2><span class="cote">H</span> Ce qui est en chantier</h2>
  <div class="grille">
    ${c.chantiers.map((t) => `<article class="bloc">
      <h3>${ech(t.quoi)}</h3>
      <p>${ech(t.ou)}</p>
      <span class="jeton attente">bloqué : ${ech(t.bloque)}</span>
    </article>`).join('\n    ')}
  </div>
</section>

<footer>
  <p>Régénérée par <code>npm run carte</code>, et automatiquement à chaque <code>npm run build</code>. Les surfaces, les prestataires et le chemin de l'argent sont les seules parties tenues à la main — elles ne sont écrites nulle part dans le code. Tout le reste est relevé sur le dépôt.</p>
  <p class="cote">Variables d'environnement attendues : ${c.code.env.map((e) => ech(e)).join(' · ')}</p>
</footer>
</div>

<script>
// Le relevé vivant, s'il est joignable. Il ne l'est que sur shibumap.com et
// seulement avec la clé dans l'adresse : /tableau-de-bord/?k=…
//
// ⚠️ TOUT ÉCHEC EST SILENCIEUX, ET C'EST VOULU. Cette même page est aussi
// publiée en Artifact, où le réseau est fermé par sécurité — la carte du code
// doit y rester entièrement lisible sans qu'une erreur vienne salir l'écran.
(async () => {
  const cle = new URLSearchParams(location.search).get('k')
  if (!cle) return
  try {
    const r = await fetch('/.netlify/functions/tableau?k=' + encodeURIComponent(cle))
    if (!r.ok) return
    const d = await r.json()
    if (d.enAttente) return
    const cases = []
    if (d.cartesPubliees != null) cases.push(['' + d.cartesPubliees, 'cartes publiées'])
    if (d.commandes != null) cases.push(['' + d.commandes, 'commandes'])
    if (!cases.length) return
    document.getElementById('vivant-chiffres').innerHTML =
      cases.map(([n, l]) => '<div><b>' + n + '</b><span class="cote">' + l + '</span></div>').join('')
    const t = new Date(d.faitLe)
    document.getElementById('vivant-heure').textContent =
      'Relevé de ' + t.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long' }) +
      (d.erreurs && d.erreurs.length ? ' — ' + d.erreurs.join(' ; ') : '')
    document.getElementById('vivant').hidden = false
  } catch {
    /* hors ligne, hors site, ou réseau fermé : la carte du code se suffit */
  }
})()
</script>`
}

// ── Assemblage ──────────────────────────────────────────────────────────────

const modules = fichiers('src', ['.js']).map(analyser)
const fonctions = fichiers('netlify/functions', ['.mjs']).map(analyser)
const tousLesFichiers = [...modules, ...fonctions]

// Le degré entrant : combien de modules dépendent de celui-ci. C'est la mesure
// qui dit ce qu'on ne peut pas casser sans tout casser — bien plus parlante
// que le nombre de lignes.
const entrants = new Map()
for (const f of tousLesFichiers) for (const cible of f.importe) entrants.set(cible, (entrants.get(cible) || 0) + 1)

const hotes = new Map()
for (const f of tousLesFichiers) {
  for (const h of f.hotes) {
    if (h.endsWith('example') || h === 'shibumap.com' || h === 'adrienagency.com') continue
    if (!hotes.has(h)) hotes.set(h, [])
    hotes.get(h).push(f.chemin)
  }
}

const listeTests = (JSON.parse(lire('package.json')).scripts.test.match(/test\/[\w.-]+\.test\.js/g) || [])
const testsDisque = readdirSync(join(RACINE, 'test')).filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`)

const carte = {
  genereLe: new Date().toISOString().slice(0, 10),
  surfaces: SURFACES,
  prestataires: PRESTATAIRES,
  argent: ARGENT,
  chantiers: CHANTIERS,
  code: {
    modules: modules.length,
    lignes: modules.reduce((s, m) => s + m.lignes, 0),
    fonctions: fonctions.length,
    // Les piliers : ce dont beaucoup de choses dépendent, ou ce qui est gros.
    piliers: [...tousLesFichiers]
      .map((f) => ({ chemin: f.chemin, lignes: f.lignes, dependants: entrants.get(f.chemin) || 0 }))
      .sort((a, b) => b.dependants - a.dependants || b.lignes - a.lignes)
      .slice(0, 14),
    env: [...new Set(fonctions.flatMap((f) => f.env))].sort(),
    magasins: [...new Set(fonctions.flatMap((f) => f.magasins))].sort(),
  },
  sources: [...hotes.entries()].map(([hote, ou]) => ({ hote, ou })).sort((a, b) => a.hote.localeCompare(b.hote)),
  tests: {
    listes: listeTests.length,
    surDisque: testsDisque.length,
    // ⚠️ L'écart qui compte. Des tests commités mais absents de la liste ne
    // tournent JAMAIS, et rien ne le signale — c'est déjà arrivé sur ce dépôt.
    orphelins: testsDisque.filter((t) => !listeTests.includes(t)),
    fantomes: listeTests.filter((t) => !testsDisque.includes(t)),
  },
}

writeFileSync(join(RACINE, 'docs/carte-ecosysteme.json'), JSON.stringify(carte, null, 2))

// Deux sorties, un seul corps. La version Artifact est livrée sans enveloppe
// (l'hôte pose lui-même doctype et en-tête) ; celle du site en a besoin.
const corps = page(carte)
writeFileSync(join(RACINE, 'docs/carte-ecosysteme.html'), corps)

// ⚠️ `public/` est recopié TEL QUEL par vite : écrire ici, c'est publier sur
// shibumap.com au prochain déploiement. Le `noindex` n'est pas une pudeur —
// cette page décrit l'architecture, les prestataires et les noms de variables
// d'environnement. Rien de secret, mais rien qui ait à vivre dans un moteur de
// recherche. Les chiffres d'affaires, eux, sont derrière une clé (tableau.mjs).
mkdirSync(join(RACINE, 'public/tableau-de-bord'), { recursive: true })
writeFileSync(join(RACINE, 'public/tableau-de-bord/index.html'), `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<style>*,*::before,*::after{box-sizing:border-box}img,svg{max-width:100%}</style>
${corps}
</html>
`)

const { code, tests } = carte
console.log(`Carte régénérée — ${code.modules} modules (${code.lignes.toLocaleString('fr-FR')} lignes), ${code.fonctions} fonctions serveur, ${carte.sources.length} sources externes.`)
if (tests.orphelins.length || tests.fantomes.length) {
  console.warn(`⚠️  ${tests.orphelins.length} test(s) sur disque ne tournent pas, ${tests.fantomes.length} listé(s) sans fichier.`)
} else {
  console.log(`Tests : ${tests.listes} listés, ${tests.surDisque} sur disque, aucun écart.`)
}
