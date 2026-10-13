// Touch emulation via Chromium CDP; this is not a real-device Safari test.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const report = {};
const out = process.env.TEST_OUTPUT || 'test-results';
function check(name, value) { report[name]=!!value; assert.ok(value,name); }
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const client=await context.newCDPSession(page);
  async function touch(type,points) {
   await client.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id,radiusX:3,radiusY:3}))});
  }
  for(const [name,selector] of [['story','#coffee-track .story-card'],['comparison','#compare-auto .compare-before a']]) {
   await page.goto(process.env.PORTFOLIO_URL || 'http://127.0.0.1:8000/',{waitUntil:'networkidle'});
   const opener=page.locator(selector).first();
   await opener.evaluate(el=>{
    const target=el.closest('.comparison-scene') || el;
    scrollTo({top:target.getBoundingClientRect().top+scrollY-64,behavior:'instant'});
   });
   await page.waitForTimeout(700);
   await opener.click();
   await page.locator('.pswp--open').waitFor();
   await page.waitForTimeout(250);
   const image=page.locator('.pswp__item').nth(1).locator('img.pswp__img').last();
   const initial=await image.boundingBox();
   await touch('touchStart',[[150,350],[240,350]]);
   for(let i=1;i<10;i++) { await touch('touchMove',[[150-i*12,350],[240+i*12,350]]); await page.waitForTimeout(25); }
   await touch('touchEnd',[]);
   await page.waitForTimeout(350);
   const enlarged=await image.boundingBox();
   check(`${name}: pinch zoom`,enlarged.width>initial.width*1.5);
   await touch('touchStart',[[180,400]]);
   for(let i=1;i<8;i++) { await touch('touchMove',[[180+i*15,400+i*8]]); await page.waitForTimeout(25); }
   await touch('touchEnd',[]);
   await page.waitForTimeout(350);
   const moved=await image.boundingBox();
   check(`${name}: pan`,Math.abs(moved.x-enlarged.x)>25 || Math.abs(moved.y-enlarged.y)>25);
   check(`${name}: pan preserves slide`,(await page.locator('.pswp__counter').innerText()).startsWith('1'));
   await page.getByRole('button',{name:'Увеличить или уменьшить'}).click();
   await page.waitForTimeout(300);
   await touch('touchStart',[[325,400]]);
   for(let i=1;i<11;i++) { await touch('touchMove',[[325-i*27,400]]); await page.waitForTimeout(20); }
   await touch('touchEnd',[]);
   await page.waitForTimeout(450);
   check(`${name}: swipe next`,(await page.locator('.pswp__counter').innerText()).startsWith('2'));
   await page.getByRole('button',{name:'Закрыть',exact:true}).click();
   await page.locator('.pswp').waitFor({state:'detached'});
   await page.waitForTimeout(80);
   check(`${name}: focus restored`,await opener.evaluate(el=>el===document.activeElement));
   await opener.click();
   await page.getByRole('button',{name:'Закрыть',exact:true}).click();
   await page.locator('.pswp').waitFor({state:'detached'});
   check(`${name}: immediate close`,true);
  }
 } finally {
  await browser.close();
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'touch-report.json'),JSON.stringify(report,null,2));
 }
 console.log(`Passed ${Object.keys(report).length} touch checks`);
})().catch(e=>{console.error(e);process.exitCode=1});
