"""Checks for the scroll-first portfolio; run against an HTTP server."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
URL=os.environ.get('PORTFOLIO_URL','http://127.0.0.1:8000/')
OUT=Path(os.environ.get('TEST_OUTPUT','test-results')); OUT.mkdir(parents=True,exist_ok=True)
report={'checks':[], 'errors':[]}
def check(name,value):
    report['checks'].append({'name':name,'passed':bool(value)})
    assert value,name
def jump(page,y):
    page.evaluate('(y)=>scrollTo({top:y,behavior:"instant"})',y);page.wait_for_timeout(850)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,**({'channel':os.environ['BROWSER_CHANNEL']} if os.environ.get('BROWSER_CHANNEL') else {}))
    try:
        for width,height in [(360,800),(390,844),(430,932),(844,390),(1440,1000)]:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=width<900)
            page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.goto(URL,wait_until='networkidle')
            check(f'{width}: no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'))
            check(f'{width}: viewport not expanded',abs(page.evaluate('innerWidth')-width)<2)
            check(f'{width}: no redundant controls',page.locator('.compare-controls,.story-controls,.evidence-links,.image-label').count()==0)
            page.screenshot(path=str(OUT/f'hero-{width}.png'))
            for selector,name in [('.case-image','evidence'),('#coffee-track','stories'),('#compare-vr','comparison'),('#contact','contact')]:
                jump(page,page.locator(selector).first.evaluate('el=>el.getBoundingClientRect().top+scrollY-80'))
                page.screenshot(path=str(OUT/f'{name}-{width}.png'))
            if width<700:check(f'{width}: large story images',page.locator('.story-card img').first.bounding_box()['width']>=width-48)
            for id in ['vr','auto','restaurant']:
                scene=page.locator('#compare-'+id)
                if height>620:
                    g=scene.evaluate('el=>({start:el.getBoundingClientRect().top+scrollY-document.querySelector(".header").offsetHeight,distance:el.offsetHeight-el.querySelector(".comparison-sticky").offsetHeight})')
                    jump(page,g['start'])
                    check(f'{width}/{id}: before visible',scene.locator('.compare-before').get_attribute('aria-hidden')=='false')
                    jump(page,g['start']+g['distance'])
                    check(f'{width}/{id}: after visible',scene.locator('.compare-after').get_attribute('aria-hidden')=='false')
                    scene.locator('.compare-after a').click();page.wait_for_selector('.pswp--open')
                    page.keyboard.press('Escape');page.wait_for_selector('.pswp',state='detached');page.wait_for_timeout(50)
                    check(f'{width}/{id}: focus restored',scene.locator('.compare-after a').evaluate('el=>el===document.activeElement'))
                    check(f'{width}/{id}: scroll restored',abs(page.evaluate('scrollY')-g['start']-g['distance'])<3)
                    jump(page,g['start'])
                    check(f'{width}/{id}: reverse scroll',scene.locator('.compare-before').get_attribute('aria-hidden')=='false')
                else:check(f'{width}/{id}: landscape fallback',not scene.evaluate('el=>el.classList.contains("is-scroll-scene")'))
            page.locator('#coffee-track a').first.click();page.wait_for_selector('.pswp--open')
            check(f'{width}: gallery clean',page.locator('.pswp__caption').count()==0)
            page.keyboard.press('ArrowRight');page.wait_for_timeout(400)
            check(f'{width}: gallery next',page.locator('.pswp__counter').inner_text().startswith('2'))
            page.keyboard.press('Escape');page.wait_for_selector('.pswp',state='detached');context.close()
        page=browser.new_page(viewport={'width':390,'height':844});page.goto(URL,wait_until='networkidle')
        target=page.locator('.service-grid article').first
        check('motion: prepared offscreen',target.evaluate('el=>getComputedStyle(el).opacity')=='0')
        y=target.evaluate('el=>el.getBoundingClientRect().top+scrollY-600')
        page.evaluate('(y)=>scrollTo({top:y,behavior:"instant"})',y);page.wait_for_timeout(120)
        measure='el=>({opacity:+getComputedStyle(el).opacity,y:new DOMMatrix(getComputedStyle(el).transform).m42})'
        first=target.evaluate(measure);page.wait_for_timeout(200);second=target.evaluate(measure)
        check('motion: rises visibly',0<first['opacity']<second['opacity']<=1 and first['y']>second['y']>=0)
        page.wait_for_timeout(600)
        check('motion: ends visible',target.evaluate('el=>getComputedStyle(el).opacity')=='1')
        page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(100)
        check('reduced motion: static content',page.locator('.reveal-wait,.is-scroll-scene').count()==0);page.close()
        context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844});page=context.new_page();page.goto(URL)
        check('no JS: six accessible frames',page.locator('.compare-layer a').count()==6 and page.locator('.compare-layer[inert]').count()==0)
        check('no JS: no hidden content',page.locator('.reveal-wait').count()==0)
        check('no JS: no overflow',page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'));context.close()
        check('no browser exceptions',not report['errors'])
    finally:
        browser.close();(OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(f"Passed {len(report['checks'])} checks")
