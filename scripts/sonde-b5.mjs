// SONDE B5 — les zeros exacts du damier autour des iles d'Hyeres et de Marseille.
// Plomberie CDP reprise de sonde-b1.mjs. Scenario unique : pour chaque vue,
// loadDem au zoom demande avec et sans bathy, et on COMPTE.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import { spawn } from 'node:child_process'
const A=process.argv.slice(2); const opt=(n,d)=>{const i=A.indexOf(n);return i>=0&&A[i+1]!=null?A[i+1]:d}
const PORT=Number(opt('--port','6311')), SORTIE=opt('--sortie',null), DBG=Number(opt('--dbg','9352'))
const ZOOMS=(opt('--zooms','12,13')).split(',').map(Number)
const dors=(ms)=>new Promise(r=>setTimeout(r,ms))
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p))
const getJson=(u)=>new Promise((res,rej)=>{http.get(u,r=>{let s='';r.on('data',d=>s+=d);r.on('end',()=>{try{res(JSON.parse(s))}catch(e){rej(e)}})}).on('error',rej)})
class Cdp{constructor(ws){this.ws=ws;this.id=0;this.att=new Map();ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id!=null&&this.att.has(m.id)){const w=this.att.get(m.id);this.att.delete(m.id);m.error?w.rej(new Error(m.error.message)):w.res(m.result)}}}
 send(method,params={},sessionId){const id=++this.id;const msg={id,method,params};if(sessionId)msg.sessionId=sessionId;this.ws.send(JSON.stringify(msg));return new Promise((res,rej)=>this.att.set(id,{res,rej}))}}
const VUES=[
 ['Porquerolles',42.995,6.21],['Port-Cros',43.005,6.39],['Le Levant',43.03,6.47],['Marseille / Frioul',43.27,5.30],['Hyeres large',43.02,6.35],
 ['Polders NL (Flevoland)',52.45,5.45],
]
const LIRE=`(async (lat,lon,zoom)=>{
  const m=window.__b5dem
  const d=await m.loadDem({lat,lon,zoom,tilesAcross:3,bathy:true,memo:false})
  const b=await m.loadDem({lat,lon,zoom,tilesAcross:3,bathy:false,memo:false})
  let z0=0,neg=0,pos=0,brutZ0=0,brutNeg=0,brutPos=0, z0brutNeg=0, z0brutZ0=0, negBrutPos=0, posBrutNeg=0, brutGe1=0, terreSurMer=0, merSurTerre=0
  for(let i=0;i<d.data.length;i++){const v=d.data[i],w=b.data[i]
    if(v===0)z0++;else if(v<0)neg++;else pos++
    if(w===0)brutZ0++;else if(w<0)brutNeg++;else brutPos++
    if(v===0&&w<0)z0brutNeg++; if(v===0&&w===0)z0brutZ0++; if(v<0&&w>0)negBrutPos++; if(v>0&&w<0)posBrutNeg++
    // la TERRE VRAIE : le terrarium brut a >= 1 m (au-dessus du bruit de remplissage) ; tout le reste est mer ou absence
    if(w>=1){brutGe1++; if(v<0)merSurTerre++} else { if(v>=0)terreSurMer++ } }
  // classe sous-echantillonnee (1 px sur 4) : 0 = h<0 (mer nuanceur), 1 = h==0, 2 = h>0 ; + la geographie du bloc
  const PAS=4, cote=Math.floor(d.size/PAS), cls=[]
  for(let y=0;y<cote;y++)for(let x=0;x<cote;x++){const v=d.data[(y*PAS)*d.size+x*PAS];cls.push(v<0?0:v===0?1:2)}
  const n=Math.pow(2,zoom)
  const geo={originTileX:d.originTileX,originTileY:d.originTileY,tilesAcross:d.tilesAcross,tilePx:d.tilePx,n}
  return {zoom,source:d.demSource,size:d.size,tilePx:d.tilePx,fuse:{z0,neg,pos},brut:{z0:brutZ0,neg:brutNeg,pos:brutPos,ge1:brutGe1},terreSurMer,merSurTerre,z0brutNeg,z0brutZ0,negBrutPos,posBrutNeg,minM:d.minM,maxM:d.maxM,cls:cls.join(''),cote,pas:PAS,geo}
})`
async function main(){
 const profil=fs.mkdtempSync(path.join(os.tmpdir(),'b5-'))
 const proc=spawn(chrome,['--headless=new','--no-sandbox','--no-first-run','--remote-debugging-port='+DBG,'--user-data-dir='+profil,'--window-size=1280,800','--enable-unsafe-swiftshader','about:blank'],{stdio:'ignore'})
 let v=null;for(let i=0;i<200&&!v;i++){try{v=await getJson('http://127.0.0.1:'+DBG+'/json/version')}catch{await dors(100)}}
 const ws=new WebSocket(v.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 const cdp=new Cdp(ws);const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});const {sessionId:s}=await cdp.send('Target.attachToTarget',{targetId,flatten:true})
 await cdp.send('Page.enable',{},s);await cdp.send('Runtime.enable',{},s)
 const ev=async(e)=>{const r=await cdp.send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true,timeout:300000},s);if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
 const res={vues:[]}
 try{
  await cdp.send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/'},s)
  const t0=Date.now();while(Date.now()-t0<180000){if(await ev('(()=>{const e=window.__exp;return !!(e&&e.renderer&&e.renderer.info.render.frame>3)})()'))break;await dors(250)}
  await ev('import("/src/dem.js").then(m=>{window.__b5dem=m;return "ok"})')
  await ev('window.__b5lire='+LIRE+';"ok"')
  for(const [nom,lat,lon] of VUES) for(const z of ZOOMS){
    let r;try{r=await ev(`window.__b5lire(${lat},${lon},${z})`)}catch(e){r={erreur:String(e).slice(0,200)}}
    res.vues.push({nom,lat,lon,...r})
    console.error(nom.padEnd(24),'z'+z, r.erreur? r.erreur : (r.cls?'':'')+ `TERRE rendue sur mer ${String(r.terreSurMer).padStart(7)} · mer rendue sur terre vraie ${String(r.merSurTerre).padStart(6)} · terre vraie ${r.brut.ge1} · fusion 0:${r.fuse.z0} <0:${r.fuse.neg} >0:${r.fuse.pos} · brut 0:${r.brut.z0} <0:${r.brut.neg} >0:${r.brut.pos} · [0 fusion & brut<0]:${r.z0brutNeg} · [0&0]:${r.z0brutZ0} · min ${r.minM}`)
  }
 } finally { if(SORTIE)fs.writeFileSync(SORTIE,JSON.stringify(res,null,1)); try{ws.close()}catch{} proc.kill(); await dors(300); try{fs.rmSync(profil,{recursive:true,force:true})}catch{} }
}
main().catch(e=>{console.error(e);process.exit(1)})
