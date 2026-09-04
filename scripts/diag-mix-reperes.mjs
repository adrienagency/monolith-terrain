// DIAG MIX — les REPÈRES qui doivent coïncider, relevés au même instant.
//
// ③ dit « la Terre vue de l'espace et la Terre vue en crop se décalent ». Il y a
// plus d'un couple de repères qui peut produire ça. Celui-ci les relève TOUS au
// même instant, dans l'application vivante, et donne l'écart en mètres :
//
//   · l'emprise du bloc (`terrain.fenetreBornee.emprise`) — la loi du MNT, du
//     masque de côte, de l'analyse, des toponymes et du drapage ;
//   · le repère du crop (`globe._crop` : cx, cy, demi) — la loi du NUANCEUR ;
//   · l'empreinte du MNT (`dem`) — celle sur laquelle les habillages sont CUITS.
//
// EMPLOI : node scripts/diag-mix-reperes.mjs --port 7931 --lat 39.57 --lon 2.65

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] != null ? A[i + 1] : d }
const PORT = Number(opt('--port', '7931'))
const LAT = Number(opt('--lat', '39.5696'))
const LON = Number(opt('--lon', '2.6502'))
const ZOOM = Number(opt('--zoom', '11'))
const DBG_PORT = Number(opt('--dbg', '9402'))
const dors = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const t = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].filter(Boolean).find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
function getJson(url) { return new Promise((res, rej) => { http.get(url, (r) => { let s = ''; r.on('data', (d) => (s += d)); r.on('end', () => { try { res(JSON.parse(s)) } catch (e) { rej(e) } }) }).on('error', rej) }) }
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.attente = new Map(); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id != null && this.attente.has(m.id)) { const { res, rej } = this.attente.get(m.id); this.attente.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result) } } }
  send(method, params = {}, sessionId) { const id = ++this.id; const msg = { id, method, params }; if (sessionId) msg.sessionId = sessionId; this.ws.send(JSON.stringify(msg)); return new Promise((res, rej) => this.attente.set(id, { res, rej })) }
}
const chrome = trouverChrome()
const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'mixrep-'))
const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--no-first-run', `--remote-debugging-port=${DBG_PORT}`, `--user-data-dir=${profil}`, '--window-size=1280,800', '--enable-unsafe-swiftshader', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let version = null
for (let i = 0; i < 150 && !version; i++) { try { version = await getJson(`http://127.0.0.1:${DBG_PORT}/json/version`) } catch { await dors(100) } }
if (!version) { proc.kill(); throw new Error('Chrome ne répond pas') }
const ws = new WebSocket(version.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
const cdp = new Cdp(ws)
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
const { sessionId: s } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
await cdp.send('Page.enable', {}, s); await cdp.send('Runtime.enable', {}, s)
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, s)
const evaluer = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, s); if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }

const RELEVE = `(() => {
  const e = window.__exp, g = e.globe, D2R = Math.PI/180, R2D = 180/Math.PI, TERRE = 6371000
  const mercXn = (lon) => (lon + 180) / 360
  const mercYn = (lat) => { const r = lat*D2R; return (1 - Math.log(Math.tan(r) + 1/Math.cos(r))/Math.PI)/2 }
  const emp = e.terrain.fenetreBornee?.emprise || null
  const dem = e.terrain?.dem || null
  const rep = g._crop ? { cx: g._crop.cx, cy: g._crop.cy, demi: g._crop.demi, zoom: g._crop.zoom } : null
  const u = g.uniforms || {}
  const uCentre = u.uCropCentre ? [u.uCropCentre.value.x, u.uCropCentre.value.y] : null
  const empCrop = rep ? {
    ouest: (rep.cx - rep.demi)*360 - 180, est: (rep.cx + rep.demi)*360 - 180,
    nord: Math.atan(Math.sinh(Math.PI*(1 - 2*(rep.cy - rep.demi))))*R2D,
    sud: Math.atan(Math.sinh(Math.PI*(1 - 2*(rep.cy + rep.demi))))*R2D,
  } : null
  const mParDeg = TERRE*Math.PI/180
  const ecart = (emp && empCrop) ? {
    ouestM: (empCrop.ouest - emp.ouest)*mParDeg*Math.cos(emp.sud*D2R),
    estM: (empCrop.est - emp.est)*mParDeg*Math.cos(emp.sud*D2R),
    nordM: (empCrop.nord - emp.nord)*mParDeg,
    sudM: (empCrop.sud - emp.sud)*mParDeg,
  } : null
  return {
    alt: e.altitudeCadrageM?.(), zoomDem: e.params.demZoom,
    emprise: emp, empriseCrop: empCrop, rep, uCentre, ecartM: ecart,
    demiMercX: emp ? (() => { let l = emp.est - emp.ouest; if (l <= 0) l += 360; return l/720 })() : null,
    demiMercY: emp ? (mercYn(emp.sud) - mercYn(emp.nord))/2 : null,
    demLat: e.params.demLat, demLon: e.params.demLon,
    dem: dem ? { lat: dem.lat, lon: dem.lon, zoom: dem.zoom, extentMeters: dem.extentMeters, empriseCote: dem.empriseCote } : null,
    largeurBlocM: (() => { try { return e.terrain.fenetreBornee?.largeurM } catch { return null } })(),
    exagGlobe: g.exaggeration, uSlabHalf: e.terrain.mapUniforms.uSlabHalf?.value,
    uCoastMaskOn: e.terrain.mapUniforms.uCoastMaskOn?.value, uAnalysisOn: e.terrain.mapUniforms.uAnalysisOn?.value,
  }
})()`

try {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }, s)
  for (let i = 0; i < 400; i++) { if (await evaluer(`!!(window.__exp && window.__exp.globe && document.getElementById('loading')?.classList.contains('hidden'))`)) break; await dors(250) }
  await dors(9000)
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, s)
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, s)
  await evaluer(`document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove()`)
  await evaluer(`window.__exp.modes.flyTo(${LAT}, ${LON}, ${ZOOM})`)
  await dors(9000)
  for (let k = 0; k < 6; k++) {
    console.log(JSON.stringify(await evaluer(RELEVE), null, 1))
    await evaluer(`window.__exp.modes.cranZoom(-1)`)
    await dors(2500)
  }
} finally {
  try { ws.close() } catch { /* rien */ }
  proc.kill(); await dors(300); try { fs.rmSync(profil, { recursive: true, force: true }) } catch { /* rien */ }
}
