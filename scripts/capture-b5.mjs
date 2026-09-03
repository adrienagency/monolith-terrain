// CAPTURE B5 — une vue crop de trois quarts, par flyTo, en PNG.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import { spawn } from 'node:child_process'
const A=process.argv.slice(2); const opt=(n,d)=>{const i=A.indexOf(n);return i>=0&&A[i+1]!=null?A[i+1]:d}
const PORT=Number(opt('--port','6311')), DBG=Number(opt('--dbg','9353')), LAT=+opt('--lat','42.995'), LON=+opt('--lon','6.21'), ZOOM=+opt('--zoom','13'), PNG=opt('--png','capture.png'), ATT=+opt('--attente','25000')
const dors=(ms)=>new Promise(r=>setTimeout(r,ms))
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p))
const getJson=(u)=>new Promise((res,rej)=>{http.get(u,r=>{let s='';r.on('data',d=>s+=d);r.on('end',()=>{try{res(JSON.parse(s))}catch(e){rej(e)}})}).on('error',rej)})
class Cdp{constructor(ws){this.ws=ws;this.id=0;this.att=new Map();ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id!=null&&this.att.has(m.id)){const w=this.att.get(m.id);this.att.delete(m.id);m.error?w.rej(new Error(m.error.message)):w.res(m.result)}}}
 send(method,params={},sessionId){const id=++this.id;const msg={id,method,params};if(sessionId)msg.sessionId=sessionId;this.ws.send(JSON.stringify(msg));return new Promise((res,rej)=>this.att.set(id,{res,rej}))}}
async function main(){
 const profil=fs.mkdtempSync(path.join(os.tmpdir(),'b5c-'))
 const proc=spawn(chrome,['--headless=new','--no-sandbox','--no-first-run','--remote-debugging-port='+DBG,'--user-data-dir='+profil,'--window-size=1280,800','--enable-unsafe-swiftshader','--hide-scrollbars','about:blank'],{stdio:'ignore'})
 let v=null;for(let i=0;i<200&&!v;i++){try{v=await getJson('http://127.0.0.1:'+DBG+'/json/version')}catch{await dors(100)}}
 const ws=new WebSocket(v.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 const cdp=new Cdp(ws);const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});const {sessionId:s}=await cdp.send('Target.attachToTarget',{targetId,flatten:true})
 await cdp.send('Page.enable',{},s);await cdp.send('Runtime.enable',{},s)
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},s)
 const ev=async(e)=>{const r=await cdp.send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true,timeout:300000},s);if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
 try{
  await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/'},s)
  const t0=Date.now();while(Date.now()-t0<180000){if(await ev('(()=>{const e=window.__exp;return !!(e&&e.renderer&&e.renderer.info.render.frame>3&&document.getElementById("loading")?.classList.contains("hidden"))})()'))break;await dors(250)}
  await ev('document.querySelectorAll(".ce-hubveil,.ce-elemwrap").forEach(n=>n.remove());"ok"')
  await dors(9000)
  await ev(`window.__exp.modes.flyTo(${LAT},${LON},${ZOOM}).then(()=>"ok").catch(e=>String(e))`)
  await dors(ATT)
  const DIAG=`(()=>{const e=window.__exp;const g=e.globe;const cles=Object.keys(g).filter(k=>/mer|fond|champ|flux|crop/i.test(k));
    const f=e.fluxSocle||e.flux||(e.fenetre&&e.fenetre.flux)||(g.flux)||null;
    const out={mode:e.modes&&e.modes.mode, clesGlobe:cles, fluxTrouve:!!f};
    if(f){out.flux={bathy:f.bathy?{cle:f.bathy.cle,peintes:f.bathy.peintes,prete:f.bathy.prete}:null, revision:f.bathyRevision, tuiles: f.tuiles? (f.tuiles.size??f.tuiles.length):undefined, cles:Object.keys(f).slice(0,25)}}
    for(const k of cles){const v=g[k]; if(v&&typeof v==='object'){out[k]={cles:Object.keys(v).slice(0,20), couverture:v.couverture, bathy:v.bathy, profMaxM:v.profMaxM, portee:v.portee, refus:v.refus};
      const eau=v.eau||v.masque; if(eau&&eau.length){let z=0;for(let i=0;i<eau.length;i++)if(!eau[i])z++;out[k].eauNon=z;out[k].eauTotal=eau.length}
      const val=v.valeurs||v.brut; if(val&&val.length){let z=0,n=0,p=0;for(let i=0;i<val.length;i++){const h=val[i];if(h===0)z++;else if(h<0)n++;else p++}out[k].valeurs={zero:z,neg:n,pos:p}}}}
    return out})()`
  await ev('window.__b5lat='+LAT+';window.__b5lon='+LON+';"ok"')
  const GPU=fs.readFileSync('scripts/gpu-tuiles-b5.page.js','utf8')
  const tuiles=await ev(GPU)
  console.error('GPU tuiles pretes autour du point :'); for(const t of tuiles) console.error('  z'+t.z+'/'+t.x+'/'+t.y+' '+t.px+'px  0exact '+String(t.z0).padStart(7)+'  <0 '+String(t.neg).padStart(7)+' (dont ]-0.5,0[ '+t.ras+')  >0 '+String(t.pos).padStart(7)+'  mat '+t.matId+' '+t.ku+' '+t.udk+' crop='+JSON.stringify(t.crop)+(t.visible?'':'  (invisible)'))
  const DUMP=opt('--dump-fond',null); if(DUMP){ const v=await ev('(()=>{const f=window.__exp.globe._fondCrop;return f?{cote:f.cote,emprise:f.emprise,portee:f.portee,valeurs:Array.from(f.valeurs)}:null})()'); fs.writeFileSync(DUMP,JSON.stringify(v)); console.error('fond dumpe ->',DUMP) }
  console.error('SOMMETS', JSON.stringify(await ev(fs.readFileSync('scripts/sommets-b5.page.js','utf8'))))
  console.error('FONDCHAMP', JSON.stringify(await ev(fs.readFileSync('scripts/fondchamp-b5.page.js','utf8'))))
  console.error('MER', JSON.stringify(await ev(fs.readFileSync('scripts/merchamp-b5.page.js','utf8'))))
  console.error('FOND', JSON.stringify(await ev(fs.readFileSync('scripts/fond-b5.page.js','utf8'))))
  console.error('POKE', JSON.stringify(await ev(fs.readFileSync('scripts/poke-b5.page.js','utf8'))))
  const SCENE="(()=>{const g=window.__exp.globe;const out=[];const compte={};g.group.traverse(o=>{if(!o.isMesh)return;const k=(o.name||'')+'|'+o.type+'|'+(o.material&&o.material.type)+'|'+(o.material&&o.material.uniforms?Object.keys(o.material.uniforms).length:0)+'|vis='+o.visible+'|ro='+o.renderOrder;compte[k]=(compte[k]||0)+1});return compte})()"
  console.error('SCENE', JSON.stringify(await ev(SCENE)))
  const etat=await ev(DIAG)
  console.error('DIAG t+'+(ATT/1000)+'s', JSON.stringify(etat))

  const EVAL=opt('--eval',null); if(EVAL){ console.error('eval ->', JSON.stringify(await ev(EVAL))); await dors(3000) }
  fs.writeFileSync(PNG,Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'},s)).data,'base64'))
  console.error(PNG, JSON.stringify(etat))
 } finally { try{ws.close()}catch{} proc.kill(); await dors(300); try{fs.rmSync(profil,{recursive:true,force:true})}catch{} }
}
main().catch(e=>{console.error(e);process.exit(1)})
