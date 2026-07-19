// What, if anything, stops this browser from running ShibuMap — decided as
// pure data so it can be tested without a GPU, a phone, or a DOM.
//
// The rule that matters: NEVER let a browser sit on the loading planet
// forever. Before this, a device without WebGL2 fetched the whole Three.js
// bundle, failed to make a renderer, and spun on "generating terrain…"
// indefinitely with no explanation. Silence reads as "broken app", and the
// visitor leaves without ever learning the fix is one tap away.
//
// WebGL2 covers ~94.7% of traffic, so the common case here is NOT an ancient
// machine — it is an in-app WebView (Instagram, Facebook, TikTok), which is
// exactly where a shared race link gets opened. That audience has a real fix:
// open the link in the actual browser. So the message says so.

export const GATE_PHONE = 'phone'
export const GATE_WEBGL = 'webgl'

// `caps` is what we could observe: { isPhone, hasWebGL2, inAppBrowser }.
// Returns null when the app should boot, else { reason, title, body, hint }.
export function gateFor({ isPhone = false, hasWebGL2 = true, inAppBrowser = false } = {}) {
  // Screen size first: on a phone the WebGL story is irrelevant — we wouldn't
  // run there even with a perfect GPU, so telling someone to switch browsers
  // would send them to a second dead end.
  if (isPhone) {
    return {
      reason: GATE_PHONE,
      title: 'ShibuMap',
      body: 'These maps need room to breathe. Open ShibuMap on a computer or a tablet to explore the relief.',
      hint: 'shibumap.com',
    }
  }

  if (!hasWebGL2) {
    return {
      reason: GATE_WEBGL,
      title: 'ShibuMap',
      // Two different situations, two different fixes. Telling someone inside
      // an Instagram WebView to "update their browser" is useless advice —
      // their browser is fine, they just aren't in it.
      body: inAppBrowser
        ? 'ShibuMap needs a full browser to draw its 3D relief. Tap the ⋯ menu and choose “Open in browser”.'
        : 'ShibuMap needs WebGL2 to draw its 3D relief, and this browser doesn’t support it. Try the latest Chrome, Edge, Firefox or Safari.',
      hint: 'shibumap.com',
    }
  }

  return null
}

// Does this look like an in-app WebView? Deliberately narrow: only the ones
// whose share traffic actually matters here, and only by the tokens those apps
// genuinely put in the UA string. A false positive gives bad advice, so when
// unsure we say no and fall back to the generic message.
export function looksInApp(ua = '') {
  return /\b(FBAN|FBAV|FB_IAB|Instagram|Line|TikTok)\b/i.test(ua)
}

// WebGL2 support, as observed rather than assumed. Wrapped in try/catch
// because a browser with WebGL disabled entirely can THROW here rather than
// return null, and an exception at boot would produce the very blank screen
// this whole module exists to prevent.
export function detectWebGL2(doc = document) {
  try {
    const canvas = doc.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}
