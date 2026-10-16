import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { parseHTML } from 'linkedom';
const base='http://127.0.0.1:4173/oldgoatcoffee/';
const names=['home','menu','rental','about','contact'];
const normalize=text=>text.replace(/\s+/g,'');
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={pages:[],checks:[]};
for (const width of [1440,390]) {
  const baseline=JSON.parse(await readFile(`.cache/baseline-${width}.json`,'utf8'));
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for (const name of Object.keys(baseline)) {
    const url=base+(name==='home'?'':name+'/');
    const response=await page.goto(url,{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    const actual=await page.evaluate(()=>({text:document.body.innerText,title:document.title,description:document.querySelector('meta[name="description"]').content,mainText:document.querySelector('main').innerText,width:document.documentElement.scrollWidth,viewport:innerWidth}));
    if (normalize(actual.text)!==normalize(baseline[name].text)) {
      await writeFile(`.cache/text-diff-${name}-${width}.json`,JSON.stringify({before:baseline[name].text,after:actual.text},null,2));
    }
    assert.equal(normalize(actual.text),normalize(baseline[name].text),`Visible text changed on ${name} at ${width}px`);
    assert.equal(actual.title,baseline[name].title);
    assert.equal(actual.description,baseline[name].description);
    assert.equal(await page.locator('h1').count(),1);
    assert.ok(actual.width<=actual.viewport+1,`Horizontal overflow ${name}`);
    for (const image of await page.locator('img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(()=>image.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
      try { await image.evaluate(img=>img.decode()); }
      catch (error) { throw new Error(`Image decode failed on ${name}: ${await image.evaluate(img=>img.currentSrc || img.src)}`,{cause:error}); }
    }
    await page.evaluate(()=>scrollTo(0,0));
    if(name==='home') {
      const popular=page.locator('[data-pop-current]');
      await popular.scrollIntoViewIfNeeded();
      await expect.poll(()=>popular.locator('[data-lazy-bg]').count()).toBe(0);
      await page.evaluate(()=>scrollTo(0,0));
    }
    await page.screenshot({path:`.cache/after-${name}-${width}.png`,fullPage:true});
    const raw=await (await fetch(url)).text();
    const doc=parseHTML(raw).document;
    assert.equal(doc.querySelector('head [rel="canonical"]').getAttribute('href'),'https://ian94134.github.io/oldgoatcoffee/'+(name==='home'?'':name+'/'));
    assert.equal(doc.querySelectorAll('head meta[name="viewport"]').length,1);
    assert.equal(doc.querySelectorAll('x-dc,sc-if,sc-for,helmet').length,0);
    assert.ok(!raw.includes('{{'));
    for (const ld of doc.querySelectorAll('script[type="application/ld+json"]')) JSON.parse(ld.textContent);
    for (const link of doc.querySelectorAll('a[href]')) {
      const href=new URL(link.getAttribute('href'),new URL(doc.querySelector('base').getAttribute('href'),url));
      if (href.origin===new URL(base).origin) assert.equal((await fetch(href)).status,200,`Broken link ${href}`);
    }
    report.pages.push({name,width,status:response.status(),textPreserved:true});
  }
  assert.deepEqual(errors,[]);
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('[data-action="heroNext"]').click();
  assert.equal(await page.locator('[data-slide="1"]').getAttribute('aria-hidden'),'false');
  await page.locator('[data-action="heroTo"][data-index="4"]').click();
  assert.equal(await page.locator('[data-slide="4"]').getAttribute('aria-hidden'),'false');
  await page.locator('[data-action="popNext"]').click();
  assert.equal(await page.locator('[data-pop-current]').getAttribute('data-pop-current'),'1');
  await page.locator('[data-action="popTo"][data-index="3"]').click();
  assert.equal(await page.locator('[data-pop-current]').getAttribute('data-pop-current'),'3');
  assert.equal(await page.locator('[data-action="popTo"][data-index="3"] span').evaluate(el=>el.style.width),'20px');
  assert.equal(await page.locator('[data-action="popTo"][data-index="0"] span').evaluate(el=>el.style.width),'8px');
  const toggle=page.locator('[data-action="quoteToggle"]').first();
  await toggle.click(); assert.equal(await toggle.textContent(),'收合');
  await toggle.click(); assert.equal(await toggle.textContent(),'顯示全文');
  await context.close();
}
const nojs=await browser.newContext({javaScriptEnabled:false});
const page=await nojs.newPage();
for (const name of names) {
  await page.goto(base+(name==='home'?'':name+'/'));
  assert.equal(await page.locator('h1').count(),1);
  assert.ok((await page.locator('main').innerText()).length>100);
  if(name==='home') assert.notEqual(await page.locator('[data-pop-current] a > div').first().evaluate(el=>getComputedStyle(el).backgroundImage),'none');
}
await nojs.close();
const legacy=await browser.newPage();
await legacy.goto(base);
await legacy.goto(base+'#menu');
await legacy.waitForURL(base+'menu/');
for (const name of ['menu','rental','about','contact','home']) {
  await legacy.goto(base+'#'+name);
  await legacy.waitForURL(base+(name==='home'?'':name+'/'));
}
const homeLegacy=await browser.newPage({reducedMotion:'reduce'});
await homeLegacy.goto(base+'#home');
await homeLegacy.waitForURL(base);
await homeLegacy.locator('[data-action="heroNext"]').click();
assert.equal(await homeLegacy.locator('[data-slide="1"]').getAttribute('aria-hidden'),'false','Initial #home must initialize interactions');
const memory=await browser.newPage({reducedMotion:'reduce'});
await memory.addInitScript(()=>{
  const Native=window.IntersectionObserver;
  window.observedNodes=new Set();
  window.IntersectionObserver=class extends Native {
    observe(el){window.observedNodes.add(el);super.observe(el);}
    unobserve(el){window.observedNodes.delete(el);super.unobserve(el);}
  };
});
await memory.goto(base,{waitUntil:'networkidle'});
await memory.evaluate(()=>{
  for(let i=0;i<10;i++) document.querySelector('[data-action="popNext"]').click();
});
assert.equal(await memory.evaluate(()=>[...window.observedNodes].filter(el=>!el.isConnected).length),0,'Detached popular cards remain observed');
assert.equal((await fetch(base+'missing/')).status,404);
await browser.close();
report.checks=['Visible text and metadata unchanged on all five pages at desktop/mobile','Images decode; internal links return 200','Carousel controls, popular groups and review toggles work','Five pages remain readable without JavaScript','Legacy hashes resolve; missing pages return 404'];
await writeFile('.cache/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
