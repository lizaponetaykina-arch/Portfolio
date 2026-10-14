const {chromium,webkit}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const checks=[];
 function check(ok,label,data){checks.push({ok,label,data});if(!ok)console.log('FAIL',label,data);}
 for(const [name,type] of [['edge',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true,...(name==='edge'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await page.goto(process.env.PORTFOLIO_URL||'http://127.0.0.1:8000/',{waitUntil:'networkidle'});
  // iOS has Arial rather than Segoe UI. Recheck the mobile reading geometry with it.
  await page.addStyleTag({content:':root { --body: Arial, sans-serif; }'});
  await page.locator('[data-stat="auto"]').tap();
  const scroll=page.locator('#stats-auto .stats-scroll');
  check(await scroll.evaluate(e=>document.activeElement===e&&getComputedStyle(e).outlineStyle==='none'),name+' touch focuses content without an outline');
  await page.screenshot({path:path.resolve(process.env.TEST_OUTPUT||'test-results/release',name+'-stats-final.png')});
  await page.keyboard.press('PageDown');await page.waitForTimeout(300);
  check(await scroll.evaluate(e=>e.scrollTop>0&&getComputedStyle(e).outlineStyle!=='none'),name+' keyboard scroll has visible focus');
  await page.keyboard.press('Tab');
  // WebKit may stop on the dialog boundary before wrapping to its first button.
  if(await page.locator('#stats-auto').evaluate(e=>document.activeElement===e))await page.keyboard.press('Tab');
  const focus=await page.locator('#stats-auto .stats-close').evaluate(e=>({active:document.activeElement.className,outline:getComputedStyle(e).outlineStyle,focusVisible:e.matches(':focus-visible')}));
  check(focus.active==='stats-close'&&focus.outline!=='none',name+' keyboard close has visible focus',focus);
  await page.keyboard.press('Escape');
  check(await page.locator('[data-stat="auto"]').evaluate(e=>document.activeElement===e),name+' Escape restores focus');
  for(const width of [320,360,390,430]){
   await page.setViewportSize({width,height:844});
   await page.locator('#coffee-track').evaluate(e=>scrollTo({top:e.getBoundingClientRect().top+scrollY-64,behavior:'instant'}));await page.waitForTimeout(100);
   const meta=await page.locator('#coffee-track .story-meta').first().evaluate(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,height:r.height,width:document.documentElement.scrollWidth}});
   check(meta.left>=22&&meta.right<=width-22&&meta.width<=width&&meta.height<=28,name+' Arial '+width+' story labels fit',meta);
  }
  // Confirm the case really remains readable under a base path, including every srcset asset.
  const sources=await page.evaluate(()=>[...new Set([...document.querySelectorAll('[src],link[href],a[href]')].flatMap(e=>[e.getAttribute('src')||e.getAttribute('href'),...(e.getAttribute('srcset')||'').split(',').map(s=>s.trim().split(/\s+/)[0])]).filter(s=>s&&!/^(https?:|tel:|#)/.test(s)))]);
  const missing=[];for(const source of sources){const response=await page.request.get(new URL(source,page.url()).href);if(!response.ok())missing.push(source);}
  check(!missing.length,name+' all local assets and links load under /Portfolio/',missing);
  await page.close();await browser.close();
 }
 fs.writeFileSync(path.resolve(process.env.TEST_OUTPUT||'test-results/release','final-checks.json'),JSON.stringify(checks,null,2));
 console.log(`${checks.filter(c=>c.ok).length}/${checks.length} final checks passed`);if(checks.some(c=>!c.ok))process.exitCode=1;
})();
