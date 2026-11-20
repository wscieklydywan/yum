const sharp=require(require.resolve('sharp',{paths:[require.resolve('next')]}));
(async()=>{
const W=1200,H=900,s=0.74;
const src='banner.png';
const bg=await sharp(src).extract({left:0,top:0,width:900,height:900}).resize(W,H,{fit:'fill'}).blur(20).toBuffer();
const cx=1000,cw=1100,ch=900;
const fw=Math.round(cw*s),fh=Math.round(ch*s);
const fx=Math.round(770-(1230-cx)*s),fy=H-fh;
const fg=await sharp(src).extract({left:cx,top:0,width:cw,height:ch}).resize(fw,fh).ensureAlpha().toBuffer();
const mask=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fw}" height="${fh}"><defs>
<linearGradient id="l" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="0.3" stop-color="#fff"/></linearGradient>
<linearGradient id="t" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="0.28" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
<rect width="${fw}" height="${fh}" fill="url(#l)"/><rect width="${fw}" height="${fh}" fill="url(#t)"/></svg>`);
const alpha=await sharp(mask).flatten({background:'#000'}).resize(fw,fh).extractChannel(0).toBuffer();
const fgA=await sharp(fg).removeAlpha().joinChannel(alpha).png().toBuffer();
const left=Math.min(fx,W), extraW=Math.max(0,fx+fw-W);
const fgCrop=extraW?await sharp(fgA).extract({left:0,top:0,width:fw-extraW,height:fh}).toBuffer():fgA;
await sharp(bg).composite([{input:fgCrop,left:fx,top:fy}]).webp({quality:80}).toFile('mobile.webp');
await sharp('mobile.webp').png().toFile('mobile.png');
console.log({fx,fy,fw,fh,burgerFrom:fx+(1230-cx)*s,burgerTo:fx+(1780-cx)*s});
})();
