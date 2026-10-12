from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os

results={}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, **({'channel':os.environ['BROWSER_CHANNEL']} if os.environ.get('BROWSER_CHANNEL') else {}))
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page()
    page.goto(os.environ.get('PORTFOLIO_URL','http://127.0.0.1:8765/portfolio/'),wait_until='networkidle')
    page.locator('#coffee-track a').first.click()
    page.wait_for_selector('.pswp--open')
    page.wait_for_timeout(250)
    image=page.locator('.pswp__item').nth(1).locator('img.pswp__img').last
    client=context.new_cdp_session(page)
    def touch(kind, points):
        client.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i,'radiusX':3,'radiusY':3} for i,(x,y) in enumerate(points)]})
    initial=image.bounding_box()
    touch('touchStart',[(150,350),(240,350)])
    for step in range(1,10):
        touch('touchMove',[(150-step*12,350),(240+step*12,350)])
        page.wait_for_timeout(25)
    touch('touchEnd',[])
    page.wait_for_timeout(350)
    enlarged=image.bounding_box()
    results['pinch_zoom']=enlarged['width']>initial['width']*1.5
    touch('touchStart',[(180,400)])
    for step in range(1,8):
        touch('touchMove',[(180+step*15,400+step*8)])
        page.wait_for_timeout(25)
    touch('touchEnd',[])
    page.wait_for_timeout(350)
    moved=image.bounding_box()
    results['pan_zoomed_image']=abs(moved['x']-enlarged['x'])>25 or abs(moved['y']-enlarged['y'])>25
    results['pan_does_not_change_slide']=page.locator('.pswp__counter').inner_text().startswith('1')
    page.get_by_role('button',name='Увеличить или уменьшить').click()
    page.wait_for_timeout(300)
    touch('touchStart',[(325,400)])
    for step in range(1,11):
        touch('touchMove',[(325-step*27,400)])
        page.wait_for_timeout(20)
    touch('touchEnd',[])
    page.wait_for_timeout(450)
    results['swipe_next']=page.locator('.pswp__counter').inner_text().startswith('2')
    page.get_by_role('button',name='Закрыть',exact=True).click()
    page.wait_for_selector('.pswp',state='detached')
    page.locator('#coffee-track a').first.click()
    page.get_by_role('button',name='Закрыть',exact=True).click()
    page.wait_for_selector('.pswp',state='detached')
    results['immediate_close']=True
    browser.close()
out=Path(os.environ.get('TEST_OUTPUT','test-results')); out.mkdir(parents=True,exist_ok=True)
(out/'gestures.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results))
assert all(results.values())
