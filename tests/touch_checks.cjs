const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.goto(process.env.PORTFOLIO_URL||'http://127.0.0.1:8000/',{waitUntil:'networkidle'});
 const cdp=await page.context().newCDPSession(page);
 const checks=[];
 function check(ok,label){checks.push({ok,label});if(!ok)console.log('FAIL',label);}
 async function swipe(){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:700}]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:700-i*35}]});await page.waitForTimeout(16);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(450);
 }
 for(const sel of ['#coffee-track','#compare-vr']){
  await page.locator(sel).evaluate(e=>scrollTo({top:scrollY+e.getBoundingClientRect().top-64,behavior:'instant'}));await page.waitForTimeout(100);
  const before=await page.evaluate(()=>scrollY);await swipe();
  check(await page.evaluate(()=>scrollY)>before+100,sel+' native upward swipe advances page');
 }
 for(const type of ['auto','pub']){
  await page.locator(`[data-stat="${type}"]`).click();await page.waitForTimeout(200);
  const y=await page.evaluate(()=>scrollY);const scroll=page.locator(`#stats-${type} .stats-scroll`);
  await swipe();
  const movement=await scroll.evaluate(e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight}));
  check(movement.max>0&&movement.top>Math.min(100,movement.max*.5),type+' finger scrolls statistics '+JSON.stringify(movement));
  check(await page.evaluate(()=>scrollY)===y,type+' page stays locked');
  await page.locator(`#stats-${type} .stats-close`).click();
  check(await page.evaluate(()=>scrollY)===y,type+' closing preserves position');
 }
 await page.locator('[data-stat="auto"]').focus();await page.keyboard.press('Enter');
 check(await page.locator('#stats-auto .stats-scroll').evaluate(e=>document.activeElement===e),'keyboard opens at statistics');
 await page.keyboard.press('PageDown');await page.waitForTimeout(300);
 check(await page.locator('#stats-auto .stats-scroll').evaluate(e=>e.scrollTop>0),'PageDown scrolls statistics');
 await page.keyboard.press('Tab');
 check(await page.locator('#stats-auto .stats-close').evaluate(e=>document.activeElement===e),'Tab reaches close');
 await page.keyboard.press('Enter');
 check(await page.locator('[data-stat="auto"]').evaluate(e=>document.activeElement===e),'keyboard close restores focus');
 await browser.close();
 console.log(`${checks.filter(x=>x.ok).length}/${checks.length} touch and keyboard checks passed`);
 if(checks.some(x=>!x.ok))process.exitCode=1;
})();
