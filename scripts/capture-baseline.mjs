import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
for (const width of [1440,390]) {
const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();
page.on('pageerror',error=>console.log('Browser error:',error.message));
await page.goto('http://127.0.0.1:4173/baseline/',{waitUntil:'networkidle'});
await page.waitForSelector('#dc-root main',{timeout:60000});
await mkdir('.cache',{recursive:true});
const result={};
for (const name of ['home','menu','rental','about','contact']) {
  await page.evaluate(name=>{location.hash=name==='home'?'':name;},name);
  await page.waitForTimeout(300);
  result[name]=await page.evaluate(()=>({text:document.body.innerText,title:document.title,description:document.querySelector('meta[name="description"]').content,mainText:document.querySelector('main').innerText}));
  await page.screenshot({path:`.cache/baseline-${name}-${width}.png`,fullPage:true});
}
await writeFile(`.cache/baseline-${width}.json`,JSON.stringify(result,null,2));
await context.close();
}
console.log('Captured five original rendered pages.');
await browser.close();
