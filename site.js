// Theme persistence and footer dark-mode toggle (Yosemite Night).
(() => {
  const root = document.documentElement;
  const isZh = root.lang.startsWith('zh');
  let ambientCanvas = null, ambientCtx = null, lastW = 0, lastH = 0, raf = 0;

  const renderAmbient = () => {
    raf = 0;
    if (root.dataset.theme !== 'dark') return;
    if (!ambientCanvas && document.body) {
      ambientCanvas = document.createElement('canvas');
      ambientCanvas.className = 'ambient-bg';
      ambientCanvas.setAttribute('aria-hidden', 'true');
      document.body.prepend(ambientCanvas);
      ambientCtx = ambientCanvas.getContext('2d', {alpha: false});
    }
    if (!ambientCtx) return;
    const w = Math.max(320, Math.min(2560, window.innerWidth || 1440));
    const h = Math.max(320, Math.min(2800, window.innerHeight || 900));
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    ambientCanvas.width = w;
    ambientCanvas.height = h;

    const gx1 = new Float32Array(w);
    const gx2 = new Float32Array(w);
    const invRx1 = 1 / (0.78 * w);
    const invRx2 = 1 / (0.88 * w);
    for (let x = 0; x < w; x++) {
      const d1 = (x - 0.66 * w) * invRx1;
      const d2 = (x - 0.26 * w) * invRx2;
      gx1[x] = Math.exp(-1.15 * d1 * d1);
      gx2[x] = Math.exp(-1.15 * d2 * d2);
    }

    const img = ambientCtx.createImageData(w, h);
    const data = img.data;
    const invRy1 = 1 / (0.78 * h);
    const invRy2 = 1 / (0.88 * h);
    let s = 0x76b19a2d;
    let p = 0;

    for (let y = 0; y < h; y++) {
      const dy1 = (y - 0.34 * h) * invRy1;
      const dy2 = (y - 0.74 * h) * invRy2;
      const gy1 = Math.exp(-1.15 * dy1 * dy1);
      const gy2 = Math.exp(-1.15 * dy2 * dy2);

      for (let x = 0; x < w; x++) {
        const g1 = gy1 * gx1[x];
        const g2 = gy2 * gx2[x];
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        const dither = (((s & 0xffff) - ((s >>> 16) & 0xffff)) * (0.95 / 65535)) + 0.5;

        data[p]     = (6.0  + 7.8  * g1 + 3.6 * g2 + dither) | 0;
        data[p + 1] = (19.0 + 21.5 * g1 + 9.8 * g2 + dither) | 0;
        data[p + 2] = (28.0 + 32.0 * g1 + 14.8 * g2 + dither) | 0;
        data[p + 3] = 255;
        p += 4;
      }
    }
    ambientCtx.putImageData(img, 0, 0);
  };

  const applyTheme = (dark, persist = false) => {
    if (dark) root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    if (persist) {
      try { localStorage.setItem('xulab-theme', dark ? 'dark' : 'light'); } catch (e) {}
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', dark ? '#06131c' : '#ffffff');
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      const label = dark ? (isZh ? '切换浅色模式' : 'Switch to light mode') : (isZh ? '切换深色模式' : 'Switch to dark mode');
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
    if (dark) renderAmbient();
    dispatchEvent(new CustomEvent('themechange', {detail: {dark}}));
  };

  let saved = null;
  try { saved = localStorage.getItem('xulab-theme'); } catch (e) {}
  applyTheme(saved === 'dark' || root.dataset.theme === 'dark', false);

  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(root.dataset.theme !== 'dark', true));
  });

  const copyText = async text => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(text); return; } catch (e) {}
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  };

  document.querySelectorAll('.copy-email').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      const email = btn.dataset.email || 'peiyu.xu@hotmail.com';
      await copyText(email);
      const status = btn.querySelector('.copy-status');
      if (status) status.textContent = isZh ? '已复制' : 'Copied';
      btn.classList.add('is-copied');
      clearTimeout(btn._copyTimer);
      btn._copyTimer = setTimeout(() => {
        btn.classList.remove('is-copied');
        if (status) status.textContent = '';
      }, 1800);
    });
  });

  addEventListener('resize', () => {
    if (root.dataset.theme === 'dark' && !raf) raf = requestAnimationFrame(renderAmbient);
  }, {passive: true});
})();

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
