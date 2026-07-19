// GET /r/<id> — the crawler-visible face of a published race.
//
// WHY THIS EXISTS: share links are `#r=<id>`, and a URL fragment is NEVER sent
// to the server. So when someone pastes a ShibuMap race into WhatsApp,
// Instagram or Slack, the crawler fetches the bare site and every card is
// identical and generic — no race name, nothing to click for. For a product
// whose whole loop is "an organiser shares their course", that is the loop's
// weakest link.
//
// This route puts the id in the PATH, so the server sees it, can read the
// race, and can answer with tags describing that specific course. A human who
// follows the link is bounced straight on to the app.
//
// SECURITY — read before editing. This is the only place ShibuMap returns
// text/html containing a string a stranger typed (see race.mjs's header on why
// returning attacker bytes as HTML is the danger). Three things keep it safe,
// and all three have to stay true:
//   1. ONLY the race name crosses over — never the GPX, never the logo. The
//      logo is a data: URL and could not be an og:image anyway (crawlers must
//      be able to FETCH the image), so the card uses the static site image.
//   2. The name is cleaned (bounded, control characters stripped) and then
//      HTML-escaped at every insertion point.
//   3. The page contains NO script — a human is forwarded by <meta refresh> —
//      which lets the response carry a CSP that forbids scripting outright.
//      That is the belt to the escaping's braces: even a mistake in (2) has
//      nothing to execute with. Do not add a script to this page.

import { getStore } from '@netlify/blobs'

export const config = { path: '/r/:id' }

const ID_RE = /^[A-Za-z0-9]{6,16}$/
const MAX_NAME_CHARS = 120
const SITE = 'https://shibumap.com'

// Ampersand FIRST — escaping it after the others would re-escape the escapes.
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// A race name is a short human label, so treat it as one: collapse anything
// that behaves like a line break into a space, drop control characters, bound
// the length. This runs BEFORE escaping — it limits what we're escaping, it
// does not replace escaping.
export function cleanRaceName(name) {
  if (typeof name !== 'string') return ''
  return name
    .replace(/[\r\n\t]+/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_CHARS)
}

export function sharePageHtml({ id, raceName, origin = SITE }) {
  const name = cleanRaceName(raceName)
  const title = name ? `${name} — ShibuMap` : 'A race on ShibuMap'
  const desc = name
    ? `See the course of ${name} as a 3D relief map.`
    : 'See this course as a 3D relief map.'
  const url = `${origin}/r/${id}`
  const target = `${origin}/#r=${id}`

  const t = escapeHtml(title)
  const d = escapeHtml(desc)
  const u = escapeHtml(url)
  const to = escapeHtml(target)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ShibuMap">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${escapeHtml(origin)}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${escapeHtml(origin)}/og.png">
<meta http-equiv="refresh" content="0; url=${to}">
<style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
background:linear-gradient(180deg,#f4f3f0,#e7e5e0);font-family:'Bricolage Grotesque',system-ui,sans-serif;color:#1c1e22;text-align:center;padding:32px}
a{color:#e8622c}
</style>
</head>
<body>
<div style="font-size:22px;font-weight:700">◍ ShibuMap</div>
<div style="font-size:15px;max-width:340px;line-height:1.5">${t}</div>
<div style="font-size:13px"><a href="${to}">Open the map</a></div>
</body>
</html>`
}

function htmlResponse(html, status) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      // No script anywhere on this page, so forbid scripting outright. This is
      // the structural guard behind the escaping — see the header.
      'content-security-policy':
        "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'referrer-policy': 'no-referrer',
      // Short cache: a crawler re-fetch shouldn't hammer Blobs, but a renamed
      // race should refresh its card the same day.
      'cache-control': 'public, max-age=300, s-maxage=3600',
    },
  })
}

export default async (req, context) => {
  const id = context?.params?.id || ''
  // An invalid id is not worth a storage round-trip, and echoing it back in any
  // form is exactly what we don't do here.
  if (!ID_RE.test(id)) return htmlResponse(sharePageHtml({ id: '', raceName: '', origin: SITE }), 404)

  let payload = null
  try {
    const store = getStore({ name: 'race-payloads', consistency: 'strong' })
    payload = await store.get(id, { type: 'json' })
  } catch (err) {
    console.error('share GET blobs error:', err)
    // Storage trouble must not produce a dead link: fall through with no name,
    // and the visitor still reaches the app.
  }

  const html = sharePageHtml({ id, raceName: payload?.raceName ?? '', origin: SITE })
  return htmlResponse(html, payload ? 200 : 404)
}
