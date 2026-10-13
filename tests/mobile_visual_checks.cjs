// Mobile composition and actual touch scroll. Screenshot review remains required.
const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const out=path.resolve(process.env.TEST_OUTPUT || path.join(__dirname,'../../audit/mobile-final'));fs.mkdirSync(out,{recursive:true});
const url=process.env.PORTFOLIO_URL || 'http://127.0.0.1:8000/';
const results=[];
function check(ok,label,data){results.push({ok:!!ok,label,data});if(!ok)console.error('FAIL',label,data);}
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
 for(const [width,height] of [[360,800],[390,844],[430,932],[844,390],[1440,1000]]) {
  const page=await browser.newPage({viewport:{width,height},isMobile:width<900,hasTouch:width<900});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.hero-portrait img').complete);
  const hero=await page.locator('.hero-portrait').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,animations:el.getAnimations().map(a=>a.effect.getTiming().duration)}));
  if(width<=430)check(hero.bottom<height && hero.animations.includes(1100),`${width} portrait visible and animating before scroll`,hero);
  await page.waitForTimeout(1150);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} no horizontal overflow`);
  await page.screenshot({path:path.join(out,`${width}-hero.png`)});
  for(const sel of ['#coffee-track','#clinic-track','#clinic-recovery','#compare-vr','#compare-auto','#compare-restaurant','#services']) {
   await page.locator(sel).evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-document.querySelector('.header').offsetHeight,behavior:'instant'}));
   await page.waitForTimeout(1150);
   await page.screenshot({path:path.join(out,`${width}-${sel.slice(1)}.png`)});
   if(width<=430 && sel.includes('track')){
    const data=await page.locator(sel+' .story-card').first().evaluate(el=>{const img=el.querySelector('img').getBoundingClientRect();const title=el.querySelector('strong').getBoundingClientRect();const count=el.querySelector('.story-count').getBoundingClientRect();return {left:img.left,right:img.right,width:img.width,countGap:count.left-title.right,bottom:img.bottom};});
    check(data.left<=9&&data.right>=width-9&&data.countGap<=12&&data.bottom<=height,`${width} ${sel} large complete story with adjacent counter`,data);
   }
   if(sel.includes('compare') && height>620){
    const data=await page.locator(sel).evaluate(el=>{const img=el.querySelector('.compare-before img');const r=img.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,ratio:r.width/r.height,native:img.naturalWidth/img.naturalHeight};});
    check(data.left>=0&&data.right<=width&&data.bottom<=height+1&&Math.abs(data.ratio-data.native)<.002,`${width} ${sel} entire feed without distortion`,data);
    await page.locator(sel).evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-document.querySelector('.header').offsetHeight+(el.offsetHeight-el.querySelector('.comparison-sticky').offsetHeight)*.95,behavior:'instant'}));await page.waitForTimeout(100);
    await page.screenshot({path:path.join(out,`${width}-${sel.slice(1)}-after.png`)});
   }
  }
  check(await page.locator('.service-card').evaluateAll(els=>els.length===4&&els.every(el=>el.tagName==='A'&&!el.querySelector('a,button'))),`${width} service card has one full-card link`);
  check(await page.locator('.case-reels a, [data-viewer], .pswp').count()===0,`${width} no duplicate gallery or Reels opening`);
  for(const type of ['auto','pub']){
   await page.locator(`[data-stat="${type}"]`).click();await page.waitForTimeout(250);
   const dialog=page.locator(`#stats-${type}`);const scroll=dialog.locator('.stats-scroll');
   const y=await page.evaluate(()=>scrollY);const before=await dialog.locator('.stats-toolbar').boundingBox();
   if(width===390){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:700}]});
    for(let i=1;i<=12;i++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:700-i*35}]});await page.waitForTimeout(16);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
    const touch=await scroll.evaluate(el=>({position:el.scrollTop,max:el.scrollHeight-el.clientHeight}));
    check(touch.position>Math.min(100,touch.max*.5)&&touch.max>0,`${type} finger swipe scrolls modal`,touch);
   }
   await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForTimeout(100);
   const data=await dialog.evaluate(el=>{const header=el.querySelector('.stats-toolbar').getBoundingClientRect();const close=el.querySelector('.stats-close');const r=close.getBoundingClientRect();const last=el.querySelector('.evidence-piece:last-child img').getBoundingClientRect();return {top:header.top,closeClear:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===close,lastBottom:last.bottom,dialogBottom:el.getBoundingClientRect().bottom};});
   check(data.top===before.y&&data.closeClear&&data.lastBottom<=data.dialogBottom,`${width} ${type} fixed clear close and complete last image`,data);
   const during=await page.evaluate(()=>scrollY);
   check(during===y,`${width} ${type} background stays still`,{before:y,during});
   await page.screenshot({path:path.join(out,`${width}-modal-${type}-end.png`)});
   await dialog.locator('.stats-close').click();
   const after=await page.evaluate(()=>scrollY);
   check(after===y,`${width} ${type} returns to same page position`,{before:y,after});
  }
  await page.evaluate(()=>scrollTo({top:document.body.scrollHeight,behavior:'instant'}));await page.waitForTimeout(1000);
  const join=await page.evaluate(()=>{const c=document.querySelector('.contact'),f=document.querySelector('footer');return{gap:f.getBoundingClientRect().top-c.getBoundingClientRect().bottom,radius:getComputedStyle(c).borderBottomLeftRadius,color:getComputedStyle(c).backgroundColor,footer:getComputedStyle(f).backgroundColor};});
  check(join.gap===0&&join.radius==='0px'&&join.color===join.footer,`${width} continuous footer background`,join);
  await page.screenshot({path:path.join(out,`${width}-footer.png`)});
  check(errors.length===0,`${width} no script errors`,errors);await page.close();
 }
 for(const options of [{javaScriptEnabled:false},{reducedMotion:'reduce'}]){
  const page=await browser.newPage({viewport:{width:390,height:844},...options});await page.goto(url);
  const label=options.javaScriptEnabled===false?'no-js':'reduced-motion';
  await page.locator('#compare-vr').scrollIntoViewIfNeeded();
  check(await page.locator('.is-scroll-scene').count()===0,`${label} comparisons show both static frames`);
  check(await page.locator('.story-card').first().evaluate(el=>getComputedStyle(el).opacity)==='1',`${label} stories remain visible`);
  await page.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));
 console.log(`${results.filter(x=>x.ok).length}/${results.length} checks passed`);if(results.some(x=>!x.ok))process.exitCode=1;
})();
