// Run against an HTTP server with Playwright available to Node (see README).
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const URL = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8000/';
const out = process.env.TEST_OUTPUT || 'test-results';
fs.mkdirSync(out, {recursive:true});
const report = {checks:[], errors:[]};
function check(name, value) {
  report.checks.push({name, passed:!!value});
  assert.ok(value, name);
}
async function jump(page, top, delay=720) {
  await page.evaluate(y => scrollTo({top:y,behavior:'instant'}), top);
  await page.waitForTimeout(delay);
}
async function topOf(locator) {
  return locator.evaluate(el => el.getBoundingClientRect().top+scrollY-document.querySelector('.header').offsetHeight);
}
async function close(page) {
  await page.keyboard.press('Escape');
  await page.locator('.pswp').waitFor({state:'detached'});
  await page.waitForTimeout(60);
}
(async () => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try {
    for(const [width,height] of [[360,800],[390,844],[430,932],[844,390],[1440,1000]]) {
      const context = await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:true});
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(URL,{waitUntil:'networkidle'});
      await page.waitForTimeout(600);
      check(`${width}: portrait visible without scrolling`,await page.locator('.hero-portrait').evaluate(el=>getComputedStyle(el).opacity==='1'&&scrollY===0));
      check(`${width}: one clear hero action`,await page.locator('.hero a').count()===1 && await page.locator('.hero a').getAttribute('href')==='https://t.me/lizzza_aa');
      check(`${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
      await page.screenshot({path:path.join(out,`hero-${width}.png`)});
      const cards = page.locator('.media-card');
      for(let i=0;i<await cards.count();i++) {
        const card=cards.nth(i);
        await jump(page,await topOf(card),1050);
        check(`${width}: result card ${i+1} visible`,await card.evaluate(el=>getComputedStyle(el).opacity==='1' && el.scrollWidth<=el.clientWidth));
        check(`${width}: result card ${i+1} labelled`,(await card.locator('.stat-header').innerText()).length>5);
        if(width===390) await page.screenshot({path:path.join(out,`result-${i+1}.png`)});
      }
      for(const slug of ['coffee','clinic']) {
        const slides = page.locator(`#${slug}-track .story-card`);
        for(let i=0;i<5;i++) {
          // Reset before measuring because a previously pinned slide's top
          // no longer represents its normal-flow start.
          await jump(page,0,20);
          const slide=slides.nth(i);
          await jump(page,await topOf(slide));
          check(`${width}: ${slug} ${i+1} retains project name`,await slide.locator('.story-meta strong').innerText()===(slug==='coffee'?'Кофейня':'Клиника'));
          check(`${width}: ${slug} ${i+1} correct count`,await slide.locator('.story-count').innerText()===`${i+1} / 5`);
          if(height>620) {
            check(`${width}: ${slug} ${i+1} image fits below label`,await slide.evaluate(el=>{
              const image=el.querySelector('img').getBoundingClientRect(),meta=el.querySelector('.story-meta').getBoundingClientRect();
              return image.bottom<=innerHeight+2 && meta.bottom<=image.top && meta.top>=document.querySelector('.header').offsetHeight;
            }));
            check(`${width}: ${slug} ${i+1} is topmost`,await slide.evaluate(el=>{
              const r=el.querySelector('img').getBoundingClientRect();
              return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
            }));
          }
          if(width===390 && [0,3].includes(i)) await page.screenshot({path:path.join(out,`${slug}-${i+1}.png`)});
        }
      }
      for(const slug of ['vr','auto','restaurant']) {
        const scene=page.locator('#compare-'+slug);
        await jump(page,0,20);
        const start=await topOf(scene);
        const distance=await scene.evaluate(el=>el.offsetHeight-el.querySelector('.comparison-sticky').offsetHeight);
        for(const [stage,fraction] of [['before',0],['after',1]]) {
          await jump(page,start+distance*fraction);
          const link=scene.locator(`.compare-${stage} a`);
          check(`${width}: ${slug}/${stage} frame ratio`,await link.evaluate(el=>Math.abs(el.clientWidth/el.clientHeight-.5)<.005));
          if(height>620) {
            check(`${width}: ${slug}/${stage} active`,await scene.locator(`.compare-${stage}`).getAttribute('aria-hidden')==='false');
            check(`${width}: ${slug}/${stage} caption fits`,await scene.locator(`.compare-${stage} figcaption`).evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+2));
            if(width===390) await page.screenshot({path:path.join(out,`${slug}-${stage}.png`)});
            await link.click();
            await page.locator('.pswp--open').waitFor();
            await page.waitForTimeout(150);
            const visibleImage=page.locator('.pswp__item').nth(1).locator('img.pswp__img').last();
            check(`${width}: ${slug}/${stage} gallery uses normalized crop`,await visibleImage.evaluate(el=>el.complete&&el.naturalWidth>0&&getComputedStyle(el).clipPath!=='none'));
            if(width===390) await page.screenshot({path:path.join(out,`gallery-${slug}-${stage}.png`)});
            await close(page);
            check(`${width}: ${slug}/${stage} focus restored`,await link.evaluate(el=>el===document.activeElement));
            check(`${width}: ${slug}/${stage} scroll restored`,Math.abs(await page.evaluate(()=>scrollY)-(start+distance*fraction))<3);
          }
        }
        if(height>620) {
          await jump(page,start);
          check(`${width}: ${slug} reverse scroll`,await scene.locator('.compare-before').getAttribute('aria-hidden')==='false');
        } else check(`${width}: ${slug} static in landscape`,!await scene.evaluate(el=>el.classList.contains('is-scroll-scene')));
      }
      await jump(page,0,20);
      const first=page.locator('#coffee-track .story-card').first();
      await jump(page,await topOf(first));
      await first.click();
      await page.locator('.pswp--open').waitFor();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(400);
      check(`${width}: gallery next story`,(await page.locator('.pswp__counter').innerText()).startsWith('2'));
      await close(page);
      check(`${width}: gallery restores story focus`,await first.evaluate(el=>el===document.activeElement));
      await context.close();
      console.log(`Checked ${width}×${height}`);
    }
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(URL,{waitUntil:'networkidle'});
    const card=page.locator('.media-card').first();
    check('result prepared offscreen',await card.evaluate(el=>getComputedStyle(el).opacity==='0'));
    await jump(page,await topOf(card),100);
    const motion=await card.evaluate(el=>({x:new DOMMatrix(getComputedStyle(el).transform).m41,y:new DOMMatrix(getComputedStyle(el).transform).m42,opacity:+getComputedStyle(el).opacity}));
    check('result appears from side, without vertical motion',motion.x<0&&motion.y===0&&motion.opacity>0&&motion.opacity<1);
    await page.waitForTimeout(750);
    check('result settles visible',await card.evaluate(el=>getComputedStyle(el).opacity==='1'));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForTimeout(100);
    check('reduced motion clears scroll scenes and reveals',await page.locator('.is-scroll-scene,.reveal-wait').count()===0);
    check('reduced motion unpins stories',await page.locator('.story-card').first().evaluate(el=>getComputedStyle(el).position==='relative'));
    await page.screenshot({path:path.join(out,'reduced-motion.png')});
    await page.close();
    const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
    const fallback=await nojs.newPage();
    await fallback.goto(URL,{waitUntil:'networkidle'});
    check('no JS: portrait visible',await fallback.locator('.hero-portrait').evaluate(el=>getComputedStyle(el).opacity==='1'));
    check('no JS: all comparison links accessible',await fallback.locator('.compare-layer a').count()===6 && await fallback.locator('[inert],.reveal-wait').count()===0);
    check('no JS: story labels retained',await fallback.locator('.story-meta').count()===10);
    await nojs.close();
    check('no browser exceptions',report.errors.length===0);
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out,'refresh-report.json'),JSON.stringify(report,null,2));
  }
  console.log(`Passed ${report.checks.length} checks`);
})().catch(e=>{console.error(e);process.exitCode=1});
