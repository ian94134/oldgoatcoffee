import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { original, Component, values } from './source.mjs';
import { fontCSS } from './fonts.mjs';

const root = new URL('../', import.meta.url);
const base = 'https://ian94134.github.io/oldgoatcoffee/';
const routes = Object.fromEntries(Component.PAGES.map(p => [p, p === 'home' ? './' : p + '/']));
const manifest = JSON.parse(await readFile(new URL('assets/optimized/manifest.json', root), 'utf8'));
const hoverRules = new Map();
const evaluate = (text, scope) => Function('scope', `with(scope){return (${text})}`)(scope);
const expression = text => text.match(/^\s*{{\s*([\s\S]*?)\s*}}\s*$/)?.[1];
const interpolate = (text, scope) => text.replace(/{{\s*([\s\S]*?)\s*}}/g, (_, expr) => String(evaluate(expr, scope) ?? ''));
const optimized = name => manifest[name]?.src || name;
const assetURLs = text => text.replace(/assets\/[\w./-]+\.(?:png|jpe?g)/g, optimized);
let target;

function render(node, scope = {}) {
  if (node.nodeType === 3) return target.createTextNode(interpolate(node.textContent, scope));
  if (node.nodeType !== 1) return target.createDocumentFragment();
  const tag = node.localName;
  if (tag === 'x-import' && node.getAttribute('component-from-global-scope') === 'image-slot') {
    const el = target.createElement('img');
    const source = node.getAttribute('src');
    const image = manifest[source];
    el.setAttribute('src',optimized(source));
    el.setAttribute('id',node.getAttribute('id'));
    el.setAttribute('alt',node.getAttribute('placeholder'));
    el.setAttribute('loading','lazy'); el.setAttribute('decoding','async');
    el.setAttribute('width',image.width); el.setAttribute('height',image.height);
    el.setAttribute('srcset',image.variants.map(v=>`${v.src} ${v.width}w`).join(', '));
    el.setAttribute('sizes','(max-width: 900px) 100vw, 540px');
    el.setAttribute('style',`display:block;width:100%;height:${node.getAttribute('hint-size').split(',')[1]};object-fit:cover;border-radius:${node.getAttribute('radius')}px;`);
    return el;
  }
  const fragment = () => {
    const result = target.createDocumentFragment();
    for (const child of node.childNodes) result.append(render(child, scope));
    return result;
  };
  if (tag === 'helmet') return target.createDocumentFragment();
  if (tag === 'sc-if') {
    if (expression(node.getAttribute('value')) === 'day.today') {
      const result = fragment();
      for (const el of result.children) { el.hidden = true; el.setAttribute('data-today', ''); }
      return result;
    }
    return evaluate(expression(node.getAttribute('value')), scope) ? fragment() : target.createDocumentFragment();
  }
  if (tag === 'sc-for') {
    const result = target.createDocumentFragment();
    const list = expression(node.getAttribute('list'));
    const entries = evaluate(list, scope) || [];
    entries.forEach((value, index) => {
      const childScope = {...scope, [node.getAttribute('as')]:value, _list:list, _index:index};
      for (const child of node.childNodes) result.append(render(child, childScope));
    });
    return result;
  }
  const action = expression([...node.attributes].find(attr=>attr.name.toLowerCase()==='onclick')?.value || '');
  const navigation = {goHome:'home',goMenu:'menu',goAbout:'about',goContact:'contact',goRental:'rental','it.go':'menu'};
  const destination = navigation[action];
  const el = node.cloneNode(false);
  let out = el;
  if (destination) {
    out = target.createElement('a');
    for (const attr of el.attributes) out.setAttribute(attr.name, attr.value);
    out.setAttribute('href', routes[destination]);
    out.classList.add('nav-link');
    if (scope.page === destination && node.parentElement?.localName === 'nav') out.setAttribute('aria-current','page');
  }
  for (const attr of [...out.attributes]) {
    if (/^on/i.test(attr.name) || attr.name === 'ref' || attr.name.startsWith('hint-')) out.removeAttribute(attr.name);
    else if (attr.name !== 'style-hover') out.setAttribute(attr.name, assetURLs(interpolate(attr.value, scope)));
  }
  if (action && !destination) {
    const actions = {'s.go':scope._list === 'heroSlides' ? 'heroTo' : 'rentalTo','r.toggle':'quoteToggle','popPrev':'popPrev','popNext':'popNext','heroPrev':'heroPrev','heroNext':'heroNext','quotePrev':'quotePrev','quoteNext':'quoteNext','g.go':'popTo'};
    out.setAttribute('data-action', actions[action] || (action.endsWith('.go') ? 'popTo' : action));
    out.setAttribute('data-index', scope._index ?? 0);
  }
  if (out.hasAttribute('style-hover')) {
    const hover = interpolate(out.getAttribute('style-hover'), scope);
    if (!hoverRules.has(hover)) hoverRules.set(hover, 'hover-' + hoverRules.size);
    out.classList.add(hoverRules.get(hover));
    out.removeAttribute('style-hover');
  }
  if (out.localName === 'button') out.setAttribute('type','button');
  if (action === 'it.go') out.removeAttribute('aria-label');
  if (out.hasAttribute('data-q')) out.setAttribute('data-review-index', scope._index);
  if (scope._list === 'days' && node.parentElement.localName === 'sc-for') out.setAttribute('data-day',scope.day.i);
  if (out.getAttribute('role') === 'group' && out.getAttribute('aria-label')?.includes('照片輪播')) {
    out.setAttribute('data-carousel', scope.page === 'home' ? 'hero' : 'rental');
  }
  if (out.getAttribute('role') === 'img' && ['heroSlides','rentalSlides'].includes(scope._list)) {
    out.setAttribute('data-slide', scope._index);
    out.setAttribute('aria-hidden', String(scope._index !== 0));
  }
  for (const child of node.childNodes) out.append(render(child, scope));
  if (out.localName === 'img') {
    const source = node.getAttribute('src') ? interpolate(node.getAttribute('src'),scope) : '';
    const image = manifest[source];
    if (image) {
      out.setAttribute('width', image.width); out.setAttribute('height', image.height);
      if (!source.includes('logo')) {
        out.setAttribute('srcset', image.variants.map(v => `${v.src} ${v.width}w`).join(', '));
        out.setAttribute('sizes', source.includes('/menu/') ? '66px' : '(max-width: 600px) 100vw, (max-width: 900px) 50vw, 400px');
      }
    }
    out.setAttribute('decoding','async');
    if (source === 'assets/logo-horizontal-clean.png') out.setAttribute('fetchpriority','high');
    if (out.getAttribute('style')?.includes('aspect-ratio:') && !/(?:^|;)\s*height\s*:/.test(out.getAttribute('style'))) out.style.height='auto';
  }
  if (node.getAttribute('style')?.includes('{{ it.bg }}')) {
    const background=out.style.backgroundImage;
    out.setAttribute('data-lazy-bg',background);
    out.style.setProperty('--lazy-bg',background);
    out.style.removeProperty('background-image');
  }
  if (out.getAttribute('data-action') === 'quoteToggle') out.setAttribute('aria-expanded','false');
  return out;
}

const css = original.querySelector('helmet style').textContent
  .replaceAll('[data-rsp="nav"] > button','[data-rsp="nav"] > .nav-link')
  .replaceAll('[data-rsp="nav"] > a { display: none','[data-rsp="nav"] > a:not(.nav-link) { display: none');
const extras = `
  .nav-link { box-sizing: border-box; line-height: normal; }
  [hidden] { display: none !important; }
  [data-slide] { pointer-events: none; }
  [data-slide][aria-hidden="true"] > div { animation-play-state: paused !important; }
  [data-slide] > div { will-change: auto !important; }
  [data-slide] { will-change: auto !important; }
  [data-today] { font-size:11px; letter-spacing:.14em; background:#A6503B; color:#F6F1E8; padding:2px 8px; border-radius:999px; }
  html { color-scheme: light; }
  [style*="color: #8A7660"] { color: #806C58 !important; }
  footer [style*="color: #8A7660"] { color: #BCA98F !important; }
  footer [style*="color: #A6503B"] { color: #D9A441 !important; }
  [style*="border: 1px dashed #A6503B"] > span:first-child { color: #A04A36 !important; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
`;
const client = await readFile(new URL('src/site.js',root),'utf8');
const scriptName = `assets/site.${createHash('sha256').update(client).digest('hex').slice(0,10)}.js`;
await writeFile(new URL(scriptName,root),client);
const outputs = [];
for (const page of Component.PAGES) {
  target = parseHTML('<!doctype html><html lang="zh-Hant-TW"><head></head><body></body></html>').document;
  const {component,vals} = values(page);
  const scope = {...vals,page};
  const url = base + (page === 'home' ? '' : page + '/');
  for (const node of original.head.children) {
    if (['script','title','link','meta'].includes(node.localName) && (node.localName !== 'script')) target.head.append(node.cloneNode(true));
  }
  for (const node of original.querySelector('helmet').children) {
    if (node.localName === 'style' || node.matches('meta[name="viewport"]')) continue;
    if (node.localName === 'link' && /fonts\.(googleapis|gstatic)\.com/.test(node.getAttribute('href') || '')) continue;
    if (node.matches('script[type="application/ld+json"]')) {
      const data = JSON.parse(node.textContent);
      if (data['@type'] === 'FAQPage' || (data['@type'] === 'Service' && page !== 'rental')) continue;
      if (data['@type'] === 'Service') data.url = url;
      if (data['@type'] === 'CafeOrCoffeeShop') {
        data.sameAs = [vals.igUrl, vals.fbUrl];
        data.hasMenu = base + 'menu/';
      }
      const json = node.cloneNode(false); json.textContent = JSON.stringify(data); target.head.append(json);
    } else target.head.append(node.cloneNode(true));
  }
  target.title = Component.META[page][0];
  target.querySelector('meta[name="description"]').setAttribute('content',Component.META[page][1]);
  target.querySelector('[rel="canonical"]').setAttribute('href',url);
  for (const node of target.querySelectorAll('[hreflang]')) node.setAttribute('href',url);
  for (const key of ['og:url','og:title','og:description','twitter:title','twitter:description']) {
    target.querySelector(`meta[property="${key}"],meta[name="${key}"]`).setAttribute('content',key.endsWith('url') ? url : Component.META[page][key.endsWith('title') ? 0 : 1]);
  }
  for (const node of original.querySelector('x-dc').childNodes) target.body.append(render(node,scope));
  // Serve all page resources relative to the project root, including on inner pages.
  const baseElement = target.createElement('base'); baseElement.setAttribute('href',page === 'home' ? './' : '../');
  target.head.prepend(baseElement);
  const charset = target.querySelector('meta[charset]'); target.head.prepend(charset);
  if (page === 'menu') {
    const json = target.createElement('script'); json.type = 'application/ld+json';
    json.textContent = JSON.stringify({'@context':'https://schema.org','@type':'Menu','@id':base+'menu/#menu',name:'老山羊咖啡 林口長庚店 菜單',inLanguage:'zh-Hant-TW',provider:{'@id':base+'#cafe'},hasMenuSection:vals.sections.map(s=>({'@type':'MenuSection',name:s.t,hasMenuItem:s.items.map(i=>({'@type':'MenuItem',name:i.n,description:i.d,offers:{'@type':'Offer',price:String(i.p),priceCurrency:'TWD'}}))}))});
    target.head.append(json);
  }
  if (page === 'home') {
    const active = target.querySelector('[data-rsp="pop"]:not([aria-hidden])');
    active.setAttribute('data-pop-current','0');
    const sourcePop = original.querySelector('[data-rsp="pop"]:not([aria-hidden])');
    component.popPages().forEach((_,i) => {
      const {vals:group} = values(page,{popIdx:i});
      const tpl = target.createElement('template'); tpl.setAttribute('data-pop-page',i);
      tpl.innerHTML = render(sourcePop,{...group,page}).innerHTML;
      target.body.append(tpl);
    });
    // Outgoing popular cards are created only during transitions.
    target.querySelector('[data-rsp="pop"][aria-hidden]').remove();
  }
  for (const carousel of target.querySelectorAll('[data-carousel]')) {
    const slides = [...carousel.querySelectorAll('[data-slide]')];
    slides.forEach((slide,i) => {
      for (const layer of [slide,...slide.querySelectorAll('[style]')]) {
        const style = layer.getAttribute('style') || '';
        const match = style.match(/background-image:\s*(url\([^)]+\));/);
        if (match) {
          layer.setAttribute('data-bg',match[1]);
          if (i !== 0) layer.setAttribute('style',style.replace(match[0],''));
        }
      }
    });
    const image = optimized((page === 'home' ? Component.HERO : Component.RENTAL)[0].src);
    const preload = target.createElement('link'); preload.rel='preload'; preload.setAttribute('as','image'); preload.href=image; preload.setAttribute('fetchpriority','high'); target.head.append(preload);
  }
  for (const p of target.querySelectorAll('footer p')) if (p.textContent.includes('©')) p.setAttribute('data-copyright','');
  const fonts = target.createElement('style'); fonts.textContent=await fontCSS(target); target.head.append(fonts);
  const nojs=target.createElement('noscript');nojs.innerHTML='<style>[data-lazy-bg]{background-image:var(--lazy-bg) !important}</style>';target.head.append(nojs);
  const icon=target.createElement('link');icon.rel='icon';icon.href=optimized('assets/logo-square.png');icon.setAttribute('type','image/webp');target.head.append(icon);
  const script = target.createElement('script'); script.src=scriptName; script.defer=true; target.head.append(script);
  const path = page === 'home' ? 'index.html' : `${page}/index.html`;
  outputs.push({path,document:target});
}
let styles = css + extras + [...hoverRules].map(([rule,name]) => `.${name}:hover{${rule.replace(/([^:;]+):([^;]+);?/g,(_,key,value)=>`${key}:${value.trim()} !important;`)}}`).join('\n');
const cssName = `assets/site.${createHash('sha256').update(styles).digest('hex').slice(0,10)}.css`;
await writeFile(new URL(cssName,root),styles);
for (const {path,document} of outputs) {
  const link = document.createElement('link'); link.rel='stylesheet'; link.href=cssName; document.head.append(link);
  await mkdir(new URL(path.includes('/') ? path.slice(0,path.lastIndexOf('/')+1) : './',root),{recursive:true});
  await writeFile(new URL(path,root),document.toString().replace(/[ \t]+$/gm,'')+'\n');
}
await writeFile(new URL('sitemap.xml',root),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+Component.PAGES.map(p=>`  <url><loc>${base}${p==='home'?'':p+'/'}</loc><lastmod>2026-10-16</lastmod></url>`).join('\n')+'\n</urlset>\n');
await writeFile(new URL('.nojekyll',root),'\n');
for(const file of await readdir(new URL('assets/',root))) {
  if(/^site\.[a-f0-9]{10}\.(css|js)$/.test(file) && ![scriptName,cssName].includes('assets/'+file)) await unlink(new URL('assets/'+file,root));
}
console.log(`Built ${outputs.length} static pages; ${scriptName}; ${cssName}`);
