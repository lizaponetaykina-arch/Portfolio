const {chromium,webkit}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const url=process.env.PORTFOLIO_URL||'http://127.0.0.1:8000/';
const out=path.resolve(process.env.TEST_OUTPUT||'test-results/comparison-loading');fs.mkdirSync(out,{recursive:true});
const results=[];
function check(ok,label,data){results.push({ok:!!ok,label,data});if(!ok)console.log('FAIL',label,data);}
async function ready(page,selector){
 await page.waitForFunction(sel=>[...document.querySelectorAll(sel+' img')].every(i=>i.complete&&i.naturalWidth>0),selector,{timeout:15000});
 await page.locator(selector+' img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
}
async function delayedPage(browser,options={}){
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,...options});
 // A repeatable 650 ms response delay, not a simulated bandwidth or CWV measurement.
 await page.route('**/*-phone-*.webp',async route=>{await new Promise(r=>setTimeout(r,650));await route.continue()});
 return page;
}
(async()=>{
 for(const [engine,type] of [['edge',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true,...(engine==='edge'?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
  for(const width of [390,1440]){
   const page=await delayedPage(browser,width===1440?{viewport:{width,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}:{});
   const requests=[],errors=[];page.on('request',r=>{if(r.url().includes('-phone-'))requests.push(r.url().split('/').pop())});page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url,{waitUntil:'networkidle'});
   check(requests.length===0,`${engine} ${width} hero does not fetch distant phones`,requests.slice());
   const scenes=await page.locator('[data-comparison]').evaluateAll(es=>es.map(e=>'#'+e.id));
   for(const scene of scenes){
    await page.locator(scene).evaluate(e=>scrollTo({top:scrollY+e.getBoundingClientRect().top-1300,behavior:'instant'}));
    await ready(page,scene);
    const data=await page.locator(scene).evaluate(e=>({top:e.getBoundingClientRect().top,height:innerHeight,images:[...e.querySelectorAll('img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.currentSrc.split('/').pop()}))}));
    check(data.top>data.height&&data.images.length===2&&data.images.every(i=>i.loaded),`${engine} ${width} ${scene} both decoded before scene enters screen`,data);
    await page.locator(scene).evaluate(e=>scrollTo({top:scrollY+e.getBoundingClientRect().top-document.querySelector('.header').offsetHeight+(e.offsetHeight-e.querySelector('.comparison-sticky').offsetHeight)*.95,behavior:'instant'}));
    await page.waitForTimeout(80);
    const after=await page.locator(scene+' .compare-after').evaluate(e=>({visible:!e.inert,loaded:e.querySelector('img').complete&&e.querySelector('img').naturalWidth>0,box:e.querySelector('img').getBoundingClientRect().width}));
    check(after.visible&&after.loaded&&after.box>100,`${engine} ${width} ${scene} first after view already loaded`,after);
    if(width===390)await page.screenshot({path:path.join(out,`${engine}-${scene.slice(1)}-first-after.png`)});
   }
   check(errors.length===0,`${engine} ${width} no script errors`,errors);
   await page.close();
  }
  // Cold deep link: keep completely still while the response is delayed.
  const deep=await delayedPage(browser);await deep.goto(url+'#compare-ribay',{waitUntil:'domcontentloaded'});
  await ready(deep,'#compare-ribay');
  check(await deep.locator('#compare-ribay img').evaluateAll(es=>es.every(i=>i.complete&&i.naturalWidth>0)),engine+' cold deep link loads both without extra scrolling');await deep.close();
  for(const options of [{reducedMotion:'reduce'},{javaScriptEnabled:false}]){
   const page=await delayedPage(browser,options);await page.goto(url,{waitUntil:'domcontentloaded'});
   // With scripting disabled, deferred browser polling does not run; wait for
   // the document's image loads before evaluating the static fallback.
   if(options.javaScriptEnabled===false)await page.waitForLoadState('load');
   await page.locator('#compare-frau').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-64,behavior:'instant'}));
   await ready(page,'#compare-frau');
   check(await page.locator('.is-scroll-scene').count()===0,engine+' '+JSON.stringify(options)+' static images load');await page.close();
  }
  const fallback=await delayedPage(browser);await fallback.addInitScript(()=>{delete window.IntersectionObserver});await fallback.goto(url,{waitUntil:'domcontentloaded'});await ready(fallback,'#compare-ribay');
  check(await fallback.locator('.phone-frame img').evaluateAll(es=>es.every(i=>i.loading==='eager')),engine+' no IntersectionObserver loads images normally');await fallback.close();
  await browser.close();console.log('Checked',engine);
 }
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));
 console.log(`${results.filter(r=>r.ok).length}/${results.length} loading checks passed`);if(results.some(r=>!r.ok))process.exitCode=1;
})();
