// Progressive enhancement: all navigation and page content work without JavaScript.
(() => {
  function redirectLegacy() {
    const legacy = location.hash.slice(1);
    if (!['home','menu','rental','about','contact'].includes(legacy)) return false;
    location.replace(new URL(legacy === 'home' ? './' : legacy + '/',document.baseURI));
    return true;
  }
  window.addEventListener('hashchange',redirectLegacy);
  if (redirectLegacy()) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const loadBackground=el=>{
    el.style.backgroundImage=el.dataset.lazyBg;
    el.removeAttribute('data-lazy-bg');
  };
  const backgroundObserver='IntersectionObserver' in window ? new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting){loadBackground(entry.target);backgroundObserver.unobserve(entry.target);}});
  },{rootMargin:'150px'}) : null;
  const observeBackgrounds=root=>root.querySelectorAll('[data-lazy-bg]').forEach(el=>backgroundObserver?backgroundObserver.observe(el):loadBackground(el));
  observeBackgrounds(document);
  const carousels = [...document.querySelectorAll('[data-carousel]')].map(root => {
    const slides = [...root.querySelectorAll('[data-slide]')];
    const buttons = [...root.querySelectorAll('[data-action$="To"]')];
    let index = 0, timer;
    const load = slide => {
      for (const layer of [slide,...slide.querySelectorAll('[data-bg]')]) {
        if (layer.dataset.bg) layer.style.backgroundImage = layer.dataset.bg;
      }
    };
    const go = next => {
      index = (next + slides.length) % slides.length;
      load(slides[index]);
      slides.forEach((slide,i) => {
        slide.style.opacity = i === index ? '1' : '0';
        slide.setAttribute('aria-hidden',String(i !== index));
      });
      buttons.forEach((button,i) => {
        button.setAttribute('aria-pressed',String(i === index));
        const dot = button.firstElementChild;
        if (!dot) return;
        dot.style.background = i === index ? '#F6F1E8' : 'rgba(246,241,232,0.45)';
        if (root.dataset.carousel === 'hero') dot.style.width = i === index ? '22px' : '8px';
      });
    };
    const start = () => {
      clearInterval(timer);
      if (!document.hidden && !reduced.matches && !root.matches(':hover, :focus-within')) timer=setInterval(()=>go(index+1),root.dataset.carousel==='hero'?6400:4200);
    };
    root.addEventListener('mouseenter',()=>clearInterval(timer));
    root.addEventListener('mouseleave',start);
    root.addEventListener('focusin',()=>clearInterval(timer));
    root.addEventListener('focusout',()=>setTimeout(start,0));
    go(0); start();
    return {name:root.dataset.carousel,go,next:dir=>go(index+dir),start};
  });
  const popular = document.querySelector('[data-pop-current]');
  const templates = [...document.querySelectorAll('template[data-pop-page]')];
  let popIndex=0, popTimer;
  const popDots = [...document.querySelectorAll('[data-action="popTo"]')];
  function popTo(next) {
    if (!popular || !templates.length) return;
    popIndex=(next+templates.length)%templates.length;
    popular.querySelectorAll('[data-lazy-bg]').forEach(el=>backgroundObserver?.unobserve(el));
    popular.replaceChildren(templates[popIndex].content.cloneNode(true));
    observeBackgrounds(popular);
    popular.dataset.popCurrent=popIndex;
    popDots.forEach((button,i)=>{
      button.setAttribute('aria-pressed',String(i===popIndex));
      button.firstElementChild.style.width=i===popIndex?'20px':'8px';
      button.firstElementChild.style.background=i===popIndex?'#A6503B':'#DFD5C3';
    });
  }
  function startPop() {
    clearInterval(popTimer);
    if (popular && !document.hidden && !reduced.matches && !popular.parentElement.matches(':hover, :focus-within')) popTimer=setInterval(()=>popTo(popIndex+1),6500);
  }
  popular?.parentElement.addEventListener('mouseenter',()=>clearInterval(popTimer));
  popular?.parentElement.addEventListener('mouseleave',startPop);
  popular?.parentElement.addEventListener('focusin',()=>clearInterval(popTimer));
  popular?.parentElement.addEventListener('focusout',()=>setTimeout(startPop,0));
  startPop();
  document.addEventListener('click', event => {
    const button=event.target.closest('[data-action]');
    if (!button) return;
    const action=button.dataset.action, index=Number(button.dataset.index);
    if (action.startsWith('hero') || action.startsWith('rental')) {
      const carousel=carousels.find(c=>action.startsWith(c.name));
      if (action.endsWith('To')) carousel?.go(index);
      else carousel?.next(action.endsWith('Next')?1:-1);
      carousel?.start();
    } else if (action.startsWith('pop')) {
      popTo(action==='popTo'?index:popIndex+(action==='popNext'?1:-1)); startPop();
    } else if (action==='quoteToggle') {
      const open=button.getAttribute('aria-expanded')!=='true';
      button.setAttribute('aria-expanded',String(open));
      button.textContent=open?'收合':'顯示全文';
      button.closest('[data-q]').querySelector('p').style.webkitLineClamp=open?'none':'9';
    } else if (action.startsWith('quote')) {
      const track=document.querySelector('[data-rsp="quotes"]');
      const step=track.querySelector('[data-q]').getBoundingClientRect().width+16;
      track.scrollBy({left:step*(action==='quoteNext'?1:-1),behavior:reduced.matches?'instant':'smooth'});
    }
  });
  const resume=()=>{carousels.forEach(c=>c.start());startPop();};
  document.addEventListener('visibilitychange',resume);
  reduced.addEventListener('change',resume);
  function updateDate() {
    const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',weekday:'short'}).format(new Date());
    const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(weekday);
    document.querySelectorAll('[data-day]').forEach(row=>{row.querySelector('[data-today]').hidden=Number(row.dataset.day)!==day;});
    const year=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric'}).format(new Date());
    document.querySelectorAll('[data-copyright]').forEach(el=>{el.textContent=el.textContent.replace(/©\s*\d{4}/,'© '+year);});
  }
  updateDate(); setInterval(updateDate,60000);
})();
