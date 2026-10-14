const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const engine=process.env.BROWSER_ENGINE||'chromium';
const out=path.resolve(process.env.TEST_OUTPUT||'test-results/release');fs.mkdirSync(out,{recursive:true});
const checks=[];
function check(ok,label,data){checks.push({ok:!!ok,label,data});if(!ok)console.log('FAIL',label,JSON.stringify(data));}
async function position(page,selector){await page.locator(selector).first().evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-document.querySelector('.header').offsetHeight,behavior:'instant'}));await page.waitForTimeout(950);}
(async()=>{
 const browser=await (engine==='webkit'?webkit:chromium).launch({...(engine==='webkit'?{}:{channel:process.env.BROWSER_CHANNEL||'msedge'}),headless:true});
 const url=process.env.PORTFOLIO_URL||'http://127.0.0.1:8000/';
 for(const [width,height] of [[360,780],[390,844],[430,932],[393,659],[375,553],[844,390],[768,1024],[820,1180],[1024,1366],[1100,800],[1440,900],[1920,1080],[2560,1440]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<=1100,isMobile:width<=700});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForTimeout(1200);
  const tag=`${width}x${height}`;
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),tag+' no horizontal overflow');
  if(width<=430)check(await page.locator('.hero-portrait').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight),tag+' portrait above fold');
  const stories=await page.locator('.story-card img').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,left:e.getBoundingClientRect().left})));
  check(Math.max(...stories.map(e=>e.w))-Math.min(...stories.map(e=>e.w))<1,tag+' equal story widths',stories);
  check(stories.every(e=>e.h+64<=height),tag+' story frame fits viewport',stories);
  const reels=await page.locator('.case-reels img').evaluate(e=>e.getBoundingClientRect().height);
  check(reels<=height-100,tag+' Reels fits viewport',reels);
  const pub=await page.locator('.case-pub').evaluate(e=>{const a=e.querySelector('.case-copy').getBoundingClientRect(),b=e.querySelector('.stat-sheet').getBoundingClientRect();return{copyTop:a.top,statTop:b.top,copyLeft:a.left,statLeft:b.left}});
  if(width>700)check(Math.abs(pub.copyTop-pub.statTop)<1&&pub.statLeft<pub.copyLeft,tag+' mirrored pub in same row',pub);
  if(width>=1600){
   const edges=await page.locator('.wordmark,.hero-copy,.section,.contact-copy,footer,.comparison-sticky').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().left+parseFloat(getComputedStyle(e).paddingLeft)));
   check(Math.max(...edges)-Math.min(...edges)<1,tag+' common content edge',edges);
   check(await page.locator('.hero').evaluate(e=>Math.abs(e.getBoundingClientRect().width-document.body.clientWidth)<1),tag+' full-width hero');
  }
  if([390,820,1440,1920].includes(width))await page.screenshot({path:path.join(out,tag+'-hero.png')});
  for(const sel of ['#compare-vr','#compare-auto','#compare-restaurant']){
   await position(page,sel);
   const data=await page.locator(sel).evaluate(el=>{
    const active=el.classList.contains('is-scroll-scene');const layer=el.querySelector('.compare-before');const frame=layer.querySelector('.phone-frame'),img=frame.querySelector('img');const r=frame.getBoundingClientRect(),heading=el.querySelector('h3').getBoundingClientRect();
    return{active,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,titleBottom:heading.bottom,source:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth===1920};
   });
   check(data.width>90&&data.left>=0&&data.right<=width&&data.loaded,tag+' '+sel+' complete source phone loaded',data);
   if(data.active)check(data.bottom<=height+1,tag+' '+sel+' entire phone fits',data);
   if(width<=700 || (width<=1100&&height>width))check(data.top>=data.titleBottom&&data.top-data.titleBottom<=13,tag+' '+sel+' title above phone',data);
   if([390,820,1440].includes(width))await page.screenshot({path:path.join(out,tag+sel+'-before.png')});
   if(data.active){
    await page.locator(sel).evaluate(e=>scrollTo({top:scrollY+e.getBoundingClientRect().top-document.querySelector('.header').offsetHeight+(e.offsetHeight-e.querySelector('.comparison-sticky').offsetHeight)*.95,behavior:'instant'}));
    await page.waitForTimeout(100);
    check(await page.locator(sel+' .compare-after').evaluate(e=>!e.inert&&e.getAttribute('aria-hidden')==='false'),tag+' '+sel+' after on scroll');
    if(width===390)await page.screenshot({path:path.join(out,tag+sel+'-after.png')});
   }
  }
  if([390,820,1440].includes(width)){
   for(const sel of ['#coffee-track','#clinic-recovery','#services','#contact']){
    await position(page,sel);await page.screenshot({path:path.join(out,tag+sel+'.png')});
   }
  }
  for(const type of ['auto','pub']){
   await page.locator(`[data-stat="${type}"]`).click();
   const dialog=page.locator('#stats-'+type),scroll=dialog.locator('.stats-scroll');
   check(await scroll.evaluate(e=>document.activeElement===e),tag+' '+type+' initial content focus');
   const y=await page.evaluate(()=>scrollY);
   await scroll.evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(100);
   check(await dialog.locator('.stats-close').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e}),tag+' '+type+' close stays accessible');
   if(width===390)await page.screenshot({path:path.join(out,tag+'-'+type+'-stats.png')});
   await page.keyboard.press('Escape');
   check(await page.evaluate(()=>scrollY)===y,tag+' '+type+' preserves page scroll');
   check(await page.locator(`[data-stat="${type}"]`).evaluate(e=>document.activeElement===e),tag+' '+type+' restores opener focus');
  }
  check(errors.length===0,tag+' no script errors',errors);
  await page.close();console.log('Checked',tag);
 }
 // Simulate toolbar and keyboard height changes on a touch device without rotating it.
 for(const [initial,next] of [[610,670],[670,610]]){
  const page=await browser.newPage({viewport:{width:375,height:initial},hasTouch:true,isMobile:true});
  await page.goto(url,{waitUntil:'networkidle'});await position(page,'#compare-vr');
  const snapshot=()=>page.locator('#compare-vr').evaluate(e=>({mode:e.className,top:e.getBoundingClientRect().top,height:e.offsetHeight,y:scrollY,story:document.querySelector('.story-card').getBoundingClientRect().height}));
  const a=await snapshot();await page.setViewportSize({width:375,height:next});await page.waitForTimeout(150);const b=await snapshot();
  check(a.mode===b.mode&&a.height===b.height&&Math.abs(a.top-b.top)<2&&a.story===b.story,`toolbar ${initial}->${next} preserves reading geometry`,{a,b});
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(150);
  check(await page.locator('.is-scroll-scene').count()===0,`rotation ${initial} switches to static landscape`);
  await page.close();
 }
 for(const options of [{javaScriptEnabled:false},{reducedMotion:'reduce'}]){
  const page=await browser.newPage({viewport:{width:390,height:844},...options});await page.goto(url,{waitUntil:'networkidle'});await position(page,'#compare-vr');
  const label=options.javaScriptEnabled===false?'no-js':'reduced-motion';
  check(await page.locator('.is-scroll-scene').count()===0,label+' static comparisons');
  const frames=await page.locator('.phone-frame').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));
  check(frames.every(w=>w>90),label+' all six phones have width',frames);
  check(await page.locator('.story-card').first().evaluate(e=>getComputedStyle(e).position!=='sticky'),label+' static stories');
  await page.screenshot({path:path.join(out,label+'.png')});await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(url,{waitUntil:'networkidle'});
 for(let i=1;i<=4;i++)await position(page,`.service-card:nth-child(${i})`);
 await page.waitForTimeout(1000);
 await position(page,'#top');
 check(await page.locator('#services .reveal-wait').count()===0,'read services never hidden again');
 await position(page,'#contact');await page.waitForTimeout(1500);await position(page,'#top');
 check(await page.locator('#contact .reveal-wait,#contact .motif-wait').count()===0,'read contact never hidden again');
 await page.close();await browser.close();
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));
 console.log(`${checks.filter(c=>c.ok).length}/${checks.length} checks passed`);if(checks.some(c=>!c.ok))process.exitCode=1;
})();
