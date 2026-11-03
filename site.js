// Shared page behaviour: sections marked .reveal fade in once as they enter the view.
// Without JavaScript, or with reduced motion, everything is simply visible.
const items = document.querySelectorAll('.reveal');
if (items.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('reveal-ready');
  const seen = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      seen.unobserve(entry.target);
    }
  }, {rootMargin: '0px 0px -12% 0px'});
  items.forEach(item => seen.observe(item));
}

// Chinese pages: the shared 3D renderer (app.js) writes English UI strings; translate them in place.
if (document.documentElement.lang.startsWith('zh')) {
  const zh = {
    'Pause rotation': '暂停旋转', 'Play rotation': '继续旋转', 'Loading structure…': '正在加载结构…',
    'The 3D view was interrupted. Reload to restore it.': '三维视图已中断，请刷新页面。',
    'Unable to load the 3D preview. Please reload in a browser with WebGL enabled.': '无法加载三维预览，请在支持 WebGL 的浏览器中刷新。',
  };
  const translate = node => { const t = zh[node.textContent.trim()]; if (t) node.textContent = t; };
  for (const id of ['motion', 'status']) {
    const node = document.getElementById(id);
    if (!node) continue;
    translate(node);
    new MutationObserver(() => translate(node)).observe(node, {childList: true, characterData: true, subtree: true});
  }
}

// Desktop header condenses once the page scrolls (CSS makes it sticky only on wide screens).
const header = document.querySelector('header');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, {passive: true});
  onScroll();
}
