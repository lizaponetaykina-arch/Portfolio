const {chromium,webkit}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const out=path.resolve(process.env.TEST_OUTPUT||'test-results/polish');fs.mkdirSync(out,{recursive:true});
const url=process.env.PORTFOLIO_URL||'http://127.0.0.1:8000/';
const checks=[];
function check(ok,label,data){checks.push({ok:!!ok,label,data});if(!ok)console.log('FAIL',label,data);}
(async()=>{
for(const [engine,type] of [['edge',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true,...(engine==='edge'?{channel:'msedge'}:{})});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,360,390,430,700,701,768,1024,1440,1920,2560]){
  await page.setViewportSize({width,height:900});await page.goto(url,{waitUntil:'networkidle'});
  const d=await page.evaluate(()=>{const h=document.querySelector('.header').getBoundingClientRect(),n=document.querySelector('nav').getBoundingClientRect(),l=document.querySelector('.wordmark').getBoundingClientRect(),r=document.querySelector('.header-contact').getBoundingClientRect();return{offset:(n.left+n.right-h.left-h.right)/2,leftGap:n.left-l.right,rightGap:r.left-n.right,overflow:document.documentElement.scrollWidth>innerWidth}});
  check(Math.abs(d.offset)<.6&&d.leftGap>=7&&d.rightGap>=7&&!d.overflow,engine+' '+width+' centered menu with clear side links',d);
 }
 for(const [width,height] of [[390,844],[768,1024],[1440,900]]){
  await page.setViewportSize({width,height});await page.goto(url,{waitUntil:'networkidle'});
  if(width===390)await page.addStyleTag({content:':root{--body:Arial,sans-serif}'});
  for(const selector of ['#compare-vr','#compare-auto','#compare-restaurant']){
   for(const progress of [0,.35,.5,.65,1,0]){
    await page.locator(selector).evaluate((e,p)=>{const header=document.querySelector('.header').offsetHeight;scrollTo({top:scrollY+e.getBoundingClientRect().top-header+(e.offsetHeight-e.querySelector('.comparison-sticky').offsetHeight)*p,behavior:'instant'});},progress);
    await page.waitForTimeout(70);
    const d=await page.locator(selector).evaluate(e=>{const s=getComputedStyle(e.querySelector('.compare-stage'));return{strength:+getComputedStyle(e).getPropertyValue('--edge-strength'),mask:s.maskImage||s.webkitMaskImage,before:e.querySelector('.compare-before').getAttribute('aria-hidden'),after:e.querySelector('.compare-after').getAttribute('aria-hidden')}});
    const rest=progress===0||progress===1;
    check((rest?d.strength<.001:d.strength>.99)&&d.mask.includes('linear-gradient'),`${engine} ${width} ${selector} fade at ${progress}`,d);
    if(rest)check(progress===0?d.before==='false':d.after==='false',`${engine} ${width} ${selector} resting frame accessible at ${progress}`,d);
    if(selector==='#compare-vr'&&[0,.35,.5,1].includes(progress))await page.screenshot({path:path.join(out,`${engine}-${width}-compare-${progress}.png`)});
   }
  }
  const spacing=await page.locator('.story-case + .story-case').evaluate(e=>{const s=getComputedStyle(e);return [s.marginTop,s.paddingTop]});
  check(spacing[0]===spacing[1],engine+' '+width+' balanced story divider',spacing);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelectorAll('.is-scroll-scene').length===0);
 check(await page.locator('.is-scroll-scene').count()===0,engine+' reduced motion restores static comparison');
 check(await page.locator('.compare-stage').first().evaluate(e=>getComputedStyle(e).maskImage==='none'),engine+' no masking on static frames');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({media:'print'});
 check(await page.locator('.compare-stage').first().evaluate(e=>getComputedStyle(e).maskImage==='none'),engine+' print has no fade');
 check(errors.length===0,engine+' no script errors',errors);
 await page.close();
 const staticPage=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});await staticPage.goto(url);
 check(await staticPage.locator('.phone-frame').evaluateAll(es=>es.length===6&&es.every(e=>e.getBoundingClientRect().width>100)),engine+' no-JS keeps all six phones');
 await staticPage.close();await browser.close();console.log('Checked',engine);
}
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} polish checks passed`);if(checks.some(c=>!c.ok))process.exitCode=1;
})();
