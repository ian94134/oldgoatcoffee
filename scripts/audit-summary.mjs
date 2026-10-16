import { readFile } from 'node:fs/promises';
for (const name of ['before','after']) {
  try {
    const r=JSON.parse(await readFile(`.cache/lighthouse-${name}.json`,'utf8'));
    console.log(JSON.stringify({name,scores:Object.fromEntries(Object.entries(r.categories).map(([k,v])=>[k,Math.round(v.score*100)])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift','total-byte-weight'].map(k=>[k,r.audits[k]?.displayValue]))},null,2));
  } catch(error) {console.log(name,error.message);}
}
