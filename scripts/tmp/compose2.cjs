const sharp=require(require.resolve('sharp',{paths:[require.resolve('next')]}));
(async()=>{
const W=1200,H=900,s=0.74,cx=1000,cw=1100,ch=900;
const fw=Math.round(cw*s),fh=Math.round(ch*s);
const fx=Math.round(770-(1230-cx)*s),fy=H-fh;
const bg=await sharp('banner.png').extract({left:0,top:0,width:900,height:900}).resize(W,H,{fit:'fill'}).blur(20).removeAlpha().raw().toBuffer();
const fg=await sharp('banner.png').extract({left:cx,top:0,width:cw,height:ch}).resize(fw,fh).removeAlpha().raw().toBuffer();
const ss=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const featherX=fw*0.32, featherY=fh*0.3;
for(let y=0;y<fh;y++){const Y=fy+y;if(Y>=H)continue;
 for(let x=0;x<fw;x++){const X=fx+x;if(X>=W)continue;
  const a=ss(x/featherX)*ss(y/featherY);
  const bi=(Y*W+X)*3, fi=(y*fw+x)*3;
  for(let c=0;c<3;c++) bg[bi+c]=Math.round(bg[bi+c]*(1-a)+fg[fi+c]*a);
 }}
await sharp(bg,{raw:{width:W,height:H,channels:3}}).webp({quality:80}).toFile('mobile.webp');
await sharp('mobile.webp').png().toFile('mobile.png');
const m=await sharp('mobile.webp').metadata();console.log(m.width,m.height,m.size);
})();
