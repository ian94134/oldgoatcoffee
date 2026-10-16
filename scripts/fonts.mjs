import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
const directory=new URL('assets/fonts/',root);
await mkdir(directory,{recursive:true});
let manifest={};
try {manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));}catch{}
const hash=text=>createHash('sha256').update(text).digest('hex').slice(0,12);
export async function fontCSS(document) {
  const glyphs={sans:new Set('0123456789今天收合顯示全文'),serif:new Set()};
  function walk(node,family='sans') {
    if (node.nodeType===3) {for(const char of node.textContent) glyphs[family].add(char);return;}
    if (node.nodeType!==1 || ['script','style'].includes(node.localName)) return;
    if (node.getAttribute('style')?.includes('Noto Serif TC')) family='serif';
    else if(node.getAttribute('style')?.includes('Noto Sans TC')) family='sans';
    for(const child of (node.localName==='template'?node.content:node).childNodes) walk(child,family);
  }
  walk(document.body);
  const rules=[];
  for(const [kind,set] of Object.entries(glyphs)) {
    const text=[...set].sort().join('');
    const family=kind==='sans'?'Noto Sans TC':'Noto Serif TC';
    const weights=kind==='sans'?'300..700':'400..900';
    const key=kind+'-'+hash(text);
    if(!manifest[key]) {
      const url='https://fonts.googleapis.com/css2?family='+family.replaceAll(' ','+')+':wght@'+weights+'&display=swap&text='+encodeURIComponent(text);
      const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'}});
      if(!response.ok) throw Error('Font stylesheet failed: '+response.status);
      const css=await response.text();
      const source=css.match(/src:\s*url\(([^)]+)\) format\('woff2'\)/)?.[1];
      if(!source) throw Error('Expected variable WOFF2 font');
      const font=await fetch(source);
      if(!font.ok) throw Error('Font download failed');
      const data=Buffer.from(await font.arrayBuffer());
      const path=`assets/fonts/${kind}.${hash(data)}.woff2`;
      await writeFile(new URL(path,root),data);
      manifest[key]={path,bytes:data.length,characters:set.size,family,weights};
    }
    const item=manifest[key];
    rules.push(`@font-face{font-family:'${family}';font-style:normal;font-weight:${weights.replace('..',' ')};font-display:swap;src:url('${item.path}') format('woff2');}`);
  }
  await writeFile(new URL('manifest.json',directory),JSON.stringify(manifest,null,2)+'\n');
  return rules.join('\n');
}
