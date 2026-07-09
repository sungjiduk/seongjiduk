import { chromium } from 'playwright-core';
const SC = process.cwd();
const OUT = SC + '/rendered';
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-gl=angle','--use-angle=swiftshader'] });
const ctx = await b.newContext({ viewport:{width:1600,height:900}, deviceScaleFactor:2 });
const p = await ctx.newPage();
await p.goto('file://'+SC+'/slides.html', { waitUntil:'networkidle', timeout:30000 });
try { await p.evaluate(()=>document.fonts.ready); } catch{}
await p.waitForTimeout(1200);
for (let i=1;i<=18;i++){
  const id='#s'+i, n=String(i).padStart(2,'0');
  await p.locator(id).screenshot({ path:`${OUT}/slide-${n}.png` });
  console.log('✅ slide-'+n);
}
await b.close();
