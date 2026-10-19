import { execFileSync } from 'node:child_process';

// Original, already-published photographs; dimensions describe these exact files.
export const socialImages = {
  home: {path:'assets/hero/brunch-spread-hero.jpg', width:1400, height:933, alt:'老山羊咖啡的早午餐、三明治、沙拉與咖啡'},
  menu: {path:'assets/food-hero.jpg', width:2048, height:1366, alt:'老山羊咖啡的漢堡、三明治、厚片、沙拉與飲品'},
  rental: {path:'assets/rental/loft-seating.jpg', width:1477, height:1108, alt:'老山羊咖啡二樓共享空間的桌椅與投影設備'},
  about: {path:'assets/craft-espresso.jpg', width:1616, height:1080, alt:'老山羊咖啡的義式咖啡製作'},
  contact: {path:'assets/storefront-wide.jpg', width:644, height:362, alt:'老山羊咖啡林口長庚店的招牌與店門口'},
};

export function applyPageSEO(document, page, base, vals) {
  const url = base + (page === 'home' ? '' : page + '/');
  const image = socialImages[page];
  function meta(attribute, key, value) {
    let node = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(attribute, key);
      document.head.append(node);
    }
    node.setAttribute('content', String(value));
  }
  meta('property', 'og:image', base + image.path);
  meta('property', 'og:image:width', image.width);
  meta('property', 'og:image:height', image.height);
  meta('property', 'og:image:alt', image.alt);
  meta('name', 'twitter:image', base + image.path);
  meta('name', 'twitter:image:alt', image.alt);

  for (const node of document.head.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(node.textContent);
    if (data['@type'] === 'CafeOrCoffeeShop') {
      // Keep the existing address, coordinates, phone, hours, price range and images.
      data.url = base;
      data.sameAs = [vals.igUrl, vals.fbUrl].filter(Boolean);
      data.hasMenu = {'@id':base + 'menu/#menu'};
      for (const hours of data.openingHoursSpecification) {
        hours.dayOfWeek = hours.dayOfWeek.map(day => day.startsWith('https://schema.org/') ? day : 'https://schema.org/' + day);
      }
    }
    if (data['@type'] === 'WebSite') data.mainEntity = {'@id':base + '#cafe'};
    if (data['@type'] === 'Service' || data['@type'] === 'Menu') {
      data['@id'] = url + (page === 'rental' ? '#service' : '#menu');
      data.url = url;
      data.mainEntityOfPage = {'@id':url + '#webpage'};
    }
    node.textContent = JSON.stringify(data);
  }
  const webpage = document.createElement('script');
  webpage.type = 'application/ld+json';
  webpage.textContent = JSON.stringify({
    '@context':'https://schema.org', '@type':'WebPage', '@id':url + '#webpage',
    url, name:document.title, description:document.head.querySelector('meta[name="description"]').getAttribute('content'),
    inLanguage:'zh-Hant-TW', isPartOf:{'@id':base + '#website'}, about:{'@id':base + '#cafe'},
    mainEntity:{'@id':page === 'menu' ? url + '#menu' : page === 'rental' ? url + '#service' : base + '#cafe'},
    primaryImageOfPage:{'@type':'ImageObject', url:base + image.path, width:image.width, height:image.height, caption:image.alt},
  });
  document.head.append(webpage);
}

export function sourceLastmod(root, page) {
  // Every route shares the template, renderer and client; include its selected photo too.
  // Git dates are stable across rebuilds. Never substitute the build machine's clock.
  const sources = ['src/template.html', 'src/site.js', 'scripts/source.mjs', 'scripts/build.mjs', 'scripts/seo.mjs', 'scripts/fonts.mjs', 'assets/optimized/manifest.json', 'assets/fonts/manifest.json', socialImages[page].path];
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...sources], {cwd:root, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch { /* A source archive can supply an explicit, reproducible timestamp below. */ }
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined && /^\d+$/.test(epoch)) {
    const date = new Date(Number(epoch) * 1000);
    if (Number.isFinite(date.getTime())) return date.toISOString().slice(0,10);
  }
  throw new Error('Sitemap lastmod requires Git source history or a valid SOURCE_DATE_EPOCH.');
}

export function buildSitemap(pages, base, root) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map(page => `  <url><loc>${base}${page === 'home' ? '' : page + '/'}</loc><lastmod>${sourceLastmod(root, page)}</lastmod></url>`).join('\n') + '\n</urlset>\n';
}
