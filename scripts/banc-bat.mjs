// BANC BAT — « la bathymétrie est-elle peinte ? », chiffré, en surface et en crop.
//
// Charge l'application, `modes.flyTo(lat, lon, zoom)` (PAS de lien profond : il
// cuit la mer vide), attend, puis mesure TROIS choses indépendantes :
//   · HAUTEURS : sur les tuiles du globe autour du point qui tiennent encore
//     `t.heights`, la part de texels < 0 (fusion bathy faite ou non) ;
//   · GPU : la même chose lue sur la texture téléversée (framebuffer) ;
//   · ÉCRAN : sur la capture PNG (seule chose fiable d'après les pièges), l'écart
//     type de luminance et le nombre de couleurs distinctes dans la zone
//     centrale — une mer unie rend un écart type proche de 0.
//
//   node scripts/banc-bat.mjs --port 10931 --lat 39.95 --lon 4.05 --zoom 10 --png .banc/BAT/minorque-z10.png
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import { spawn } from 'node:child_process'
const A = process.argv.slice(2); const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] != null ? A[i + 1] : d }
const PORT = Number(opt('--port', '10931')), DBG = Number(opt('--dbg', String(10940 + Math.floor(Math.random() * 50))))
const LAT = +opt('--lat', '39.95'), LON = +opt('--lon', '4.05'), ZOOM = +opt('--zoom', '10'), PNG = opt('--png', 'banc-bat.png'), ATT = +opt('--attente', '20000')
const dors = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
const getJson = (u) => new Promise((res, rej) => { http.get(u, (r) => { let s = ''; r.on('data', (d) => (s += d)); r.on('end', () => { try { res(JSON.parse(s)) } catch (e) { rej(e) } }) }).on('error', rej) })
class Cdp { constructor(ws) { this.ws = ws; this.id = 0; this.att = new Map(); ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id != null && this.att.has(m.id)) { const w = this.att.get(m.id); this.att.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result) } } }
  send(method, params = {}, sessionId) { const id = ++this.id; const msg = { id, method, params }; if (sessionId) msg.sessionId = sessionId; this.ws.send(JSON.stringify(msg)); return new Promise((res, rej) => this.att.set(id, { res, rej })) } }

const SONDE = `(()=>{
  const e=window.__exp,g=e.globe,gl=e.renderer.getContext(),props=e.renderer.properties
  const lat=${LAT},lon=${LON}
  const n=(z)=>Math.pow(2,z),wx=(z)=>((lon+180)/360)*n(z)
  const wy=(z)=>{const r=lat*Math.PI/180;return((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2)*n(z)}
  const out={mode:e.modes&&e.modes.mode,crop:g._crop?{zoom:g._crop.zoom,demi:g._crop.demi}:null,tuiles:[]}
  for(const t of g.tiles.values()){
    if(t.state!=='ready'||!t.mesh||t.z<8)continue
    if(Math.abs(t.x+0.5-wx(t.z))>2.5||Math.abs(t.y+0.5-wy(t.z))>2.5)continue
    const r={z:t.z,x:t.x,y:t.y,px:t.size,visible:t.mesh.visible}
    if(t.heights){let neg=0,z0=0,pos=0,mn=Infinity;for(let i=0;i<t.heights.length;i++){const h=t.heights[i];if(h<0){neg++;if(h<mn)mn=h}else if(h===0)z0++;else pos++}r.h={neg,z0,pos,min:+mn.toFixed(1)}}
    const p=t.texture&&props.get(t.texture),gt=p&&p.__webglTexture
    if(gt){const px=t.size,fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,gt,0)
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE){const a=new Uint8Array(px*px*4);gl.readPixels(0,0,px,px,gl.RGBA,gl.UNSIGNED_BYTE,a);let neg=0,z0=0,pos=0,mn=Infinity;for(let i=0;i<px*px;i++){const h=a[i*4]*256+a[i*4+1]+a[i*4+2]/256-32768;if(h<0){neg++;if(h<mn)mn=h}else if(h===0)z0++;else pos++}r.gpu={neg,z0,pos,min:+mn.toFixed(1)}}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fb)}
    out.tuiles.push(r)}
  out.tuiles.sort((a,b)=>a.z-b.z||a.x-b.x||a.y-b.y)
  return out})()`

// mesure d'écran : écart type de luminance et couleurs distinctes (quantifiées
// à 4 bits) dans la fenêtre centrale de la capture
const ECRAN = (dataUrl) => `(async()=>{const im=new Image();im.src=${JSON.stringify(dataUrl)};await im.decode()
  const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0)
  const x0=Math.floor(im.width*0.2),x1=Math.floor(im.width*0.8),y0=Math.floor(im.height*0.2),y1=Math.floor(im.height*0.8)
  const d=g.getImageData(x0,y0,x1-x0,y1-y0).data;let s=0,s2=0,n=0;const cols=new Set()
  for(let i=0;i<d.length;i+=4){const l=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];s+=l;s2+=l*l;n++;cols.add(((d[i]>>4)<<8)|((d[i+1]>>4)<<4)|(d[i+2]>>4))}
  const m=s/n
  // relief à l'échelle de 8 px : moyenne par bloc 8×8 (le grain disparaît), puis
  // écart type et gradient moyen entre blocs voisins — une mer unie rend ~0
  const W=x1-x0,H=y1-y0,bw=Math.floor(W/8),bh=Math.floor(H/8),bl=new Float32Array(bw*bh)
  for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){let a=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=((by*8+y)*W+bx*8+x)*4;a+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]}bl[by*bw+bx]=a/64}
  let bs=0,bs2=0,gr=0,gn=0;for(let i=0;i<bl.length;i++){bs+=bl[i];bs2+=bl[i]*bl[i];const x=i%bw;if(x+1<bw){gr+=Math.abs(bl[i+1]-bl[i]);gn++}if(i+bw<bl.length){gr+=Math.abs(bl[i+bw]-bl[i]);gn++}}
  const bm=bs/bl.length
  return{w:im.width,h:im.height,n,moy:+m.toFixed(2),ecartType:+Math.sqrt(Math.max(0,s2/n-m*m)).toFixed(2),couleurs:cols.size,bloc8:{ecartType:+Math.sqrt(Math.max(0,bs2/bl.length-bm*bm)).toFixed(2),gradMoy:+(gr/gn).toFixed(3)}}})()`

async function main() {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-'))
  const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--no-first-run', '--remote-debugging-port=' + DBG, '--user-data-dir=' + profil, '--window-size=1280,800', '--enable-unsafe-swiftshader', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
  let v = null; for (let i = 0; i < 200 && !v; i++) { try { v = await getJson('http://127.0.0.1:' + DBG + '/json/version') } catch { await dors(100) } }
  const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  const cdp = new Cdp(ws); const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }); const { sessionId: s } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  await cdp.send('Page.enable', {}, s); await cdp.send('Runtime.enable', {}, s)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, s)
  const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }, s); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
  const erreurs = []
  cdp.ws.addEventListener('message', (m) => { const j = JSON.parse(m.data); if (j.method === 'Runtime.exceptionThrown') erreurs.push(j.params.exceptionDetails.exception?.description?.split('\n')[0] || j.params.exceptionDetails.text) })
  try {
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/' }, s)
    const t0 = Date.now(); while (Date.now() - t0 < 180000) { if (await ev('(()=>{const e=window.__exp;return !!(e&&e.renderer&&e.renderer.info.render.frame>3&&document.getElementById("loading")?.classList.contains("hidden"))})()')) break; await dors(250) }
    await ev('document.querySelectorAll(".ce-hubveil,.ce-elemwrap").forEach(n=>n.remove());"ok"')
    await dors(6000)
    await ev(`window.__exp.modes.flyTo(${LAT},${LON},${ZOOM}).then(()=>"ok").catch(e=>String(e))`)
    await dors(ATT)
    const sonde = await ev(SONDE)
    const shot = (await cdp.send('Page.captureScreenshot', { format: 'png' }, s)).data
    fs.mkdirSync(path.dirname(PNG), { recursive: true }); fs.writeFileSync(PNG, Buffer.from(shot, 'base64'))
    const ecran = await ev(ECRAN('data:image/png;base64,' + shot))
    // A/B dans la MÊME page : `--ab "<js>"` est évalué, puis une seconde capture
    // (suffixe -ab.png) et sa mesure — le témoin est l'image A, même état.
    const LIRE = opt('--lire', null); if (LIRE) console.log('LIRE', JSON.stringify(await ev(LIRE)))
    const AB = opt('--ab', null); let ecranAB = null
    if (AB) { await ev(AB + ';"ok"'); await dors(2500); const shot2 = (await cdp.send('Page.captureScreenshot', { format: 'png' }, s)).data; fs.writeFileSync(PNG.replace(/\.png$/, '-ab.png'), Buffer.from(shot2, 'base64')); ecranAB = await ev(ECRAN('data:image/png;base64,' + shot2)) }
    // bilan
    let hNeg = 0, hTot = 0, gNeg = 0, gTot = 0, avecH = 0
    for (const t of sonde.tuiles) { if (t.h) { avecH++; hNeg += t.h.neg; hTot += t.h.neg + t.h.z0 + t.h.pos } if (t.gpu) { gNeg += t.gpu.neg; gTot += t.gpu.neg + t.gpu.z0 + t.gpu.pos } }
    const bilan = { lieu: `${LAT},${LON}`, zoom: ZOOM, mode: sonde.mode, crop: sonde.crop, tuiles: sonde.tuiles.length, tuilesAvecHauteurs: avecH, partNegHauteurs: hTot ? +(100 * hNeg / hTot).toFixed(1) : null, partNegGpu: gTot ? +(100 * gNeg / gTot).toFixed(1) : null, ecran, ecranAB, erreurs: erreurs.slice(0, 5) }
    console.log(JSON.stringify(bilan))
    if (A.includes('--detail')) for (const t of sonde.tuiles) console.log('  ', JSON.stringify(t))
  } finally { try { ws.close() } catch {} proc.kill(); await dors(300); try { fs.rmSync(profil, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error(e); process.exit(1) })
