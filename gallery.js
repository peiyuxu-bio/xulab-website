// Structure gallery: one card per paper in Selected and Full sections, group filters,
// and a dialog that lists every PDB entry of the paper, with previous/next between papers.
// Pointing at an entry (or tapping it once on a touch screen) cross-fades the image to that structure, turning.
const gallery = document.querySelector('.structure-gallery');
if (gallery) {
  const cards = [...gallery.querySelectorAll('.structure-card')];
  const filters = [...gallery.querySelectorAll('.gallery-filters button')];
  const sections = [...gallery.querySelectorAll('.structure-section')];
  const dialog = gallery.querySelector('.structure-dialog');
  const entries = JSON.parse(gallery.querySelector('.structure-data').textContent);
  const $ = sel => dialog.querySelector(sel);
  let current = 0;
  // Links to #structures open the drawer.
  const drawer = gallery.querySelector('.structure-drawer');
  const openFromHash = () => { if (location.hash === '#structures' && drawer) drawer.open = true; };
  addEventListener('hashchange', openFromHash);
  openFromHash();

  filters.forEach(button => button.addEventListener('click', () => {
    const g = button.dataset.group;
    filters.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    cards.forEach(card => { card.parentElement.hidden = g !== 'all' && card.parentElement.dataset.group !== g; });
    sections.forEach(sec => { sec.hidden = !sec.querySelector('li:not([hidden])'); });
  }));

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const angstrom = r => r == null ? '' : `${r.toFixed(Number.isInteger(r * 10) ? 1 : 2)} Å`;
  const visible = () => cards.filter(c => !c.parentElement.hidden);

  // Image panel: two layers cross-fade between structures; each shows the entry's still, then its
  // rotating loop once it plays. Reduced motion keeps the stills.
  const art = $('.sd-art'), layers = [...art.querySelectorAll('.sd-layer')], base = art.dataset.entries;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let front = 0, shownPdb = null;
  const play = layer => {
    if (calm.matches) return;
    const v = layer.querySelector('video');
    if (!v.getAttribute('src')) {
      v.src = `${base}${layer.dataset.pdb}.mp4`;
      v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
    }
    v.play().catch(() => {});
  };
  const stopAll = () => layers.forEach(l => l.querySelector('video').pause());
  function stage(pdb, label, turn) {
    if (pdb !== shownPdb) {
      const next = layers[1 - front], prev = layers[front], v = next.querySelector('video');
      v.pause(); v.classList.remove('is-playing'); v.removeAttribute('src'); v.load();
      const img = next.querySelector('img');
      img.src = `${base}${pdb}.webp`; img.alt = label;
      next.dataset.pdb = pdb;
      next.classList.add('is-on'); next.removeAttribute('aria-hidden');
      prev.classList.remove('is-on'); prev.setAttribute('aria-hidden', 'true'); prev.querySelector('video').pause();
      front = 1 - front; shownPdb = pdb;
    }
    if (turn) play(layers[front]); else layers[front].querySelector('video').pause();
  }
  const list = $('.sd-list');
  let back = 0, lastPointer = 'mouse';
  const activate = li => {
    clearTimeout(back);
    list.querySelectorAll('.is-active').forEach(r => r.classList.remove('is-active'));
    li.classList.add('is-active');
    stage(li.dataset.pdb, li.dataset.label, true);
  };
  const settle = () => {  // back to the paper's pictured structure, still
    back = setTimeout(() => {
      list.querySelectorAll('.is-active').forEach(r => r.classList.remove('is-active'));
      const li = list.querySelector('.is-pictured');
      if (li) stage(li.dataset.pdb, li.dataset.label, false);
    }, 300);
  };
  list.addEventListener('pointerdown', e => { lastPointer = e.pointerType; });
  list.addEventListener('pointerover', e => { const li = e.target.closest('.sd-row'); if (li && e.pointerType !== 'touch') activate(li); });
  list.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') settle(); });
  list.addEventListener('focusin', e => { const li = e.target.closest('.sd-row'); if (li) activate(li); });
  list.addEventListener('focusout', e => { if (!list.contains(e.relatedTarget)) settle(); });
  // On a touch screen the first tap shows the structure; a second tap opens its PDB page.
  list.addEventListener('click', e => {
    const li = e.target.closest('.sd-row');
    if (li && lastPointer === 'touch' && !li.classList.contains('is-active')) { e.preventDefault(); activate(li); }
  });

  function show(card) {
    current = visible().indexOf(card);
    const d = card.dataset, rows = entries[d.doi] || [];
    stage(d.pdb, `${d.alt}, PDB ${d.pdb}`, false);
    $('.sd-pdb').textContent = rows.length > 1 ? dialog.dataset.count.replace('{n}', rows.length) : `PDB ${d.pdb}`;
    $('#sd-title').textContent = d.short;
    $('.sd-paper').textContent = d.title;
    $('.sd-venue').textContent = d.venue;
    $('.sd-doi').href = `https://doi.org/${d.doi}`;
    // Each entry links to its RCSB page; the one in the picture is marked and listed first.
    list.replaceChildren(...rows.map(([pdb, title, method, res]) => {
      const li = el('li', `sd-row${pdb === d.pdb ? ' is-pictured' : ''}`), a = el('a');
      li.dataset.pdb = pdb; li.dataset.label = pdb === d.pdb ? `${d.alt}, PDB ${pdb}` : `${title}, PDB ${pdb}`;
      a.href = `https://www.rcsb.org/structure/${pdb}`; a.target = '_blank'; a.rel = 'noopener';
      const name = el('span', 'sd-name', title);
      if (pdb === d.pdb) name.append(el('span', 'sd-tag', dialog.dataset.pictured));
      a.append(el('span', 'sd-id', pdb), name, el('span', 'sd-res', [method, angstrom(res)].filter(Boolean).join(' · ')));
      li.append(a);
      return li;
    }));
    list.scrollTop = 0;
    $('.sd-copy').scrollTop = 0;
  }
  const step = n => { const list = visible(); show(list[(current + n + list.length) % list.length]); };

  if (typeof dialog.showModal === 'function') {
    cards.forEach(card => card.addEventListener('click', () => { show(card); dialog.showModal(); }));
    $('.sd-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', stopAll);
    $('.sd-prev').addEventListener('click', () => step(-1));
    $('.sd-next').addEventListener('click', () => step(1));
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  } else {
    // Older browsers: open the paper directly.
    cards.forEach(card => card.addEventListener('click', () => open(`https://doi.org/${card.dataset.doi}`, '_blank', 'noopener')));
  }
}
