import pptxgen from 'pptxgenjs';
const R = process.cwd()+'/rendered';
const OUT = '/Users/teo/Project/3차 백엔드 프로젝트/발표자료/성지덕_발표.pptx';
const p = new pptxgen();
p.defineLayout({name:'W',width:13.333,height:7.5}); p.layout='W';
for(let i=1;i<=19;i++){ const n=String(i).padStart(2,'0'); const s=p.addSlide();
  s.addImage({path:`${R}/slide-${n}.png`,x:0,y:0,w:13.333,h:7.5}); }
await p.writeFile({fileName:OUT});
console.log('✅ '+OUT);
