"""Run with a static server: PORTFOLIO_URL=http://127.0.0.1:8765/portfolio/.
Install playwright and a browser; BROWSER_CHANNEL=msedge can use an installed Edge.
Optional AXE_PATH enables an axe-core WCAG 2.2 AA scan.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright

URL = os.environ.get('PORTFOLIO_URL', 'http://127.0.0.1:8765/portfolio/')
OUT = Path(os.environ.get('TEST_OUTPUT', 'test-results'))
OUT.mkdir(parents=True, exist_ok=True)
report = {'checks': [], 'errors': []}

def check(name, condition):
    report['checks'].append({'name': name, 'passed': bool(condition)})
    assert condition, name

def scroll(page, top):
    page.evaluate('(top)=>window.scrollTo({top,behavior:"instant"})', top)
    page.wait_for_timeout(120)

def load_visible(page):
    page.wait_for_function('''() => [...document.images].filter(img => {
      const b=img.getBoundingClientRect(); return b.bottom>0 && b.top<innerHeight && b.width>0 && b.left<innerWidth && b.right>0;
    }).every(img=>img.complete && img.naturalWidth>0)''')

with sync_playwright() as pw:
    options={'headless': True}
    if os.environ.get('BROWSER_CHANNEL'):
        options['channel']=os.environ['BROWSER_CHANNEL']
    browser=pw.chromium.launch(**options)
    try:
        for width,height in [(360,800),(390,844),(430,932),(844,390),(1440,1000)]:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=width<900)
            page=context.new_page()
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.goto(URL,wait_until='networkidle')
            check(f'{width}: no page overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            check(f'{width}: no missing primary portrait', page.locator('.hero-portrait img').evaluate('(e)=>e.complete && e.naturalWidth>0'))
            check(f'{width}: results follow hero',page.locator('main > section').nth(1).get_attribute('id')=='cases')
            check(f'{width}: ten stories',page.locator('.story-card').count()==10)
            check(f'{width}: split interactions',page.locator('[data-comparison="buttons"] .compare-controls').count()==2 and page.locator('[data-comparison="scroll"] button').count()==0)
            if width in [390,1440]:
                page.screenshot(path=str(OUT/f'hero-{width}.png'))
            # Discrete comparisons never react to scroll.
            vr=page.locator('#compare-vr')
            vr.locator('[data-state="after"]').click()
            check(f'{width}: button shows after', vr.locator('.compare-after').is_visible() and not vr.locator('.compare-before').is_visible())
            scroll(page,page.evaluate('scrollY+80'))
            check(f'{width}: button state survives scroll',not vr.locator('.compare-before').is_visible())
            vr.locator('[data-state="before"]').click()
            check(f'{width}: button restores before',vr.locator('.compare-before').is_visible())

            if width==390:
                rail=page.locator('#coffee-track')
                rail.scroll_into_view_if_needed()
                load_visible(page)
                page.locator('[aria-label="Следующая сторис: Кофейня"]').click()
                page.wait_for_timeout(500)
                check('rail next button', rail.evaluate('(e)=>e.scrollLeft')>100)
                rail.focus()
                page.keyboard.press('Home')
                page.wait_for_timeout(100)
                check('rail keyboard home',rail.evaluate('(e)=>e.scrollLeft')<2)
                page.screenshot(path=str(OUT/'stories-390.png'))
                # Load and examine gallery before modifying scroll.
                opening=rail.locator('a').first
                opening.scroll_into_view_if_needed()
                y=page.evaluate('scrollY')
                opening.click()
                page.wait_for_selector('.pswp--open')
                page.wait_for_timeout(350)
                check('gallery caption', 'Кофейня' in page.locator('.pswp__caption').inner_text())
                check('gallery traps background',page.locator('main').evaluate('(e)=>e.inert'))
                page.screenshot(path=str(OUT/'gallery-390.png'))
                image=page.locator('.pswp__item').nth(1).locator('img.pswp__img').last
                before_box=image.bounding_box()
                page.get_by_role('button',name='Увеличить или уменьшить').click()
                page.wait_for_timeout(350)
                after_box=image.bounding_box()
                check('gallery zoom button enlarges',after_box['width']>before_box['width']*1.5)
                page.get_by_role('button',name='Увеличить или уменьшить').click()
                page.wait_for_timeout(350)
                page.get_by_role('button',name='Следующее изображение').click()
                page.wait_for_timeout(350)
                check('gallery next', page.locator('.pswp__counter').inner_text().startswith('2'))
                page.keyboard.press('ArrowLeft')
                page.wait_for_timeout(350)
                check('gallery keyboard previous',page.locator('.pswp__counter').inner_text().startswith('1'))
                page.keyboard.press('Escape')
                page.wait_for_selector('.pswp',state='detached')
                page.wait_for_timeout(60)
                check('gallery restores scroll',abs(page.evaluate('scrollY')-y)<3)
                check('gallery restores focus',opening.evaluate('(e)=>e===document.activeElement'))
                check('gallery releases background',not page.locator('main').evaluate('(e)=>e.inert'))
                # Scroll scene: verify both ends and reversibility using actual geometry.
                auto=page.locator('#compare-auto')
                check('mobile animated scene enabled','is-scroll-scene' in auto.get_attribute('class'))
                geometry=auto.evaluate('''e=>({start:e.getBoundingClientRect().top+scrollY-document.querySelector('.header').offsetHeight,
                  distance:e.offsetHeight-e.querySelector('.comparison-sticky').offsetHeight})''')
                def transform():
                    return auto.locator('.compare-after').evaluate('(e)=>new DOMMatrix(getComputedStyle(e).transform).m41')
                scroll(page,geometry['start'])
                first=transform()
                load_visible(page)
                page.screenshot(path=str(OUT/'scroll-before-390.png'))
                scroll(page,geometry['start']+geometry['distance']*.5)
                middle=transform()
                page.screenshot(path=str(OUT/'scroll-middle-390.png'))
                scroll(page,geometry['start']+geometry['distance'])
                last=transform()
                page.screenshot(path=str(OUT/'scroll-after-390.png'))
                check('scroll before-middle-after',first>middle>last and abs(last)<1)
                scroll(page,geometry['start'])
                check('scroll reverses',abs(transform()-first)<1)
                # Turning reduced motion on at runtime removes the pinned section.
                page.emulate_media(reduced_motion='reduce')
                page.wait_for_timeout(150)
                check('reduced motion removes pin','is-scroll-scene' not in auto.get_attribute('class'))
                check('reduced motion exposes both images',auto.locator('.compare-before').is_visible() and auto.locator('.compare-after').is_visible())
                check('reduced motion removes transform',auto.locator('.compare-after').evaluate('(e)=>getComputedStyle(e).transform')=='none')
                page.emulate_media(reduced_motion='no-preference')
                # Visible loading error and usable fallback URL.
                page.route('**/clinic-1.webp',lambda route:route.abort())
                page.locator('#clinic-track a').first.click()
                page.wait_for_selector('.pswp__error-msg')
                check('gallery error fallback',page.locator('.pswp__caption a').get_attribute('href').endswith('clinic-1.webp'))
                page.get_by_role('button',name='Закрыть',exact=True).click()
                page.wait_for_selector('.pswp',state='detached')
                page.unroute('**/clinic-1.webp')
                # Accessibility scan after loading all sections.
                if os.environ.get('AXE_PATH'):
                    page.add_script_tag(path=os.environ['AXE_PATH'])
                    result=page.evaluate('''async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})''')
                    report['axe_violations']=result['violations']
                    check('axe WCAG scan',not result['violations'])
            if height<620:
                check('landscape uses static comparison','is-scroll-scene' not in page.locator('#compare-auto').get_attribute('class'))
            context.close()
        context=browser.new_context(viewport={'width':390,'height':844},java_script_enabled=False)
        page=context.new_page(); page.goto(URL)
        check('no JS original image links',page.locator('a[data-viewer]').count()>=20)
        check('no JS all comparison images accessible',page.locator('.compare-layer[hidden]').count()==0)
        check('no JS no empty pin space',page.locator('.is-scroll-scene').count()==0)
        context.close()
        check('no JS runtime errors',not report['errors'])
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
        browser.close()
print(f"Passed {len(report['checks'])} browser checks.")
