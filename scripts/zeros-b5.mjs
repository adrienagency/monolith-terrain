// B5 — compte des pixels EXACTEMENT a 0 dans nos tuiles bathy sur une emprise.
import fs from 'node:fs'
import { lireCascade } from './releve-tuiles-b3.mjs'
import zlib from 'node:zlib'
function decodePng(buf){let o=8,w=0,h=0,bpp=3;const idat=[]
 while(o<buf.length){const len=buf.readUInt32BE(o);const t=buf.toString('ascii',o+4,o+8);const d=buf.subarray(o+8,o+8+len)
  if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bpp=d[9]===6?4:d[9]===2?3:1}else if(t==='IDAT')idat.push(d);else if(t==='IEND')break;o+=12+len}
 const raw=zlib.inflateSync(Buffer.concat(idat));const s=w*bpp;const out=Buffer.alloc(h*s)
 for(let y=0;y<h;y++){const f=raw[y*(s+1)];const line=raw.subarray(y*(s+1)+1,y*(s+1)+1+s)
  for(let i=0;i<s;i++){const a=i>=bpp?out[y*s+i-bpp]:0;const b=y>0?out[(y-1)*s+i]:0;const c=i>=bpp&&y>0?out[(y-1)*s+i-bpp]:0
   let v=line[i];if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c}
   out[y*s+i]=v&0xff}}
 return {w,h,bpp,data:out}}
const lon2x=(lon,z)=>((lon+180)/360)*2**z
const lat2y=(lat,z)=>{const r=lat*Math.PI/180;return((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2)*2**z}
for (const [nom,w,s,e,n] of [['Hyeres',6.1,42.95,6.55,43.15],['Marseille',5.2,43.15,5.5,43.35]]) {
  for (const z of [9,10]) {
    const x0=Math.floor(lon2x(w,z)),x1=Math.floor(lon2x(e,z)),y0=Math.floor(lat2y(n,z)),y1=Math.floor(lat2y(s,z))
    let pres=0,abs=[],zeros=0,neg=0,m1=0,hist={}
    for(let tx=x0;tx<=x1;tx++)for(let ty=y0;ty<=y1;ty++){
      const f=`public/data/bathy/${z}/${tx}/${ty}.png`
      if(!fs.existsSync(f)){abs.push(`${tx}/${ty}`);continue}
      pres++;const p=decodePng(fs.readFileSync(f))
      for(let i=0;i<p.w*p.h;i++){const o=i*p.bpp;const m=p.data[o]*256+p.data[o+1]+p.data[o+2]/256-32768
        if(m===0)zeros++;else if(m<0){neg++;if(m>=-1)m1++;const k=Math.max(-10,Math.ceil(m));hist[k]=(hist[k]||0)+1}}
    }
    console.log(`${nom} z${z}: ${pres} tuiles presentes, ${abs.length} absentes ${abs.slice(0,6).join(' ')} · pixels =0 : ${zeros} · <0 : ${neg} · dans ]-1,0[ : ${m1}`)
    console.log('   histogramme (plafond, m) :', JSON.stringify(hist))
  }
}
