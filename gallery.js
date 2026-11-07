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
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const angstrom = r => r == null ? '' : `${r.toFixed(Number.isInteger(r * 10) ? 1 : 2)} Å`;
  const visible = () => cards.filter(c => !c.parentElement.hidden);

  const art = $('.sd-art'), layers = [...art.querySelectorAll('.sd-layer')];
  const base = art.dataset.entries || 'assets/papers/structures/entries/';
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const videoSrcFor = pdb => base + pdb + (isDark() ? '-dark.mp4?v=5' : '.mp4');
  const layerHTML = e => `<div class="sd-layer" data-pdb="${esc(e.pdb)}"><img src="${base}${esc(e.pdb)}.webp" alt="${esc(e.label || e.pdb)}" width="528" height="456"><video muted loop playsinline preload="none" aria-hidden="true" data-pdb="${esc(e.pdb)}" data-src="${esc(videoSrcFor(e.pdb))}"></video></div>`;

  // Dual-mode WebGL2 keyer for Dark Mode:
  // 1. Fast Path (<PDB>-dark.mp4): 1-pass premultiplied dark stage silhouette alpha reconstruction.
  // 2. Fallback Path (<PDB>.mp4): 3-pass GLSL ES 3.00 physical color unmixing shader.
  function createVideoKeyer(video, layer) {
    const canvas = el('canvas', 'sd-video-canvas');
    canvas.width = 792; canvas.height = 684;
    canvas.setAttribute('aria-hidden', 'true');
    layer.append(canvas);
    const gl = canvas.getContext('webgl2', {alpha: true, premultipliedAlpha: true});
    if (!gl) return {start(cb) { if (cb) cb(); }, stop() {}, clear() {}, isActive: () => false};
    const W = canvas.width, H = canvas.height;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return s;
    };
    const makeProg = (vsSrc, fsSrc) => {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(p);
      return p;
    };
    const makeFBO = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return {fbo, tex};
    };

    const VS = `#version 300 es
      in vec2 a;
      out vec2 v;
      void main() {
        v = a * 0.5 + 0.5;
        gl_Position = vec4(a, 0.0, 1.0);
      }`;

    // Fast Path: 1-Pass Premultiplied Dark Stage Shader for <PDB>-dark.mp4
    const progDark = makeProg(VS, `#version 300 es
      precision highp float;
      in vec2 v;
      out vec4 fragColor;
      uniform sampler2D uTex;
      uniform vec2 uPx;
      void main() {
        vec2 uv = vec2(v.x, 1.0 - v.y);
        vec3 c = texture(uTex, uv).rgb;
        // 3x3 neighborhood max to suppress any H.264 4:2:0 ringing at the 1.5px silhouette edge
        float m0 = max(c.r, max(c.g, c.b));
        float mN = m0 * 0.4;
        mN += max(texture(uTex, uv + vec2( uPx.x, 0.0)).b, texture(uTex, uv + vec2(-uPx.x, 0.0)).b) * 0.15;
        mN += max(texture(uTex, uv + vec2(0.0,  uPx.y)).b, texture(uTex, uv + vec2(0.0, -uPx.y)).b) * 0.15;
        float sig = max(m0, mN);
        float alpha = smoothstep(2.5 / 255.0, 20.0 / 255.0, sig);
        // c is already premultiplied by alpha at the outer boundary during offline mastering;
        // multiply by smoothstep(2.5/255.0, 8.0/255.0, sig) to zero out any <2 LSB YUV block noise outside the silhouette
        float cleanEdge = smoothstep(2.5 / 255.0, 8.0 / 255.0, sig);
        fragColor = vec4(c * cleanEdge, alpha);
      }`);

    // Fallback Path: 3-Pass GLSL ES 3.00 Physical Color Unmixing Shader for white-stage <PDB>.mp4
    const prog1 = makeProg(VS, `#version 300 es
      precision highp float;
      in vec2 v;
      out vec4 o;
      uniform sampler2D uTex;
      uniform vec2 uPx;

      const vec3 STAGE = vec3(247.0, 248.0, 249.0);

      void main() {
        vec2 uv = vec2(v.x, 1.0 - v.y);
        vec3 c0 = texture(uTex, uv).rgb * 255.0;

        vec3 cBlur = c0 * 0.25;
        cBlur += texture(uTex, uv + vec2( uPx.x, 0.0)).rgb * 255.0 * 0.125;
        cBlur += texture(uTex, uv + vec2(-uPx.x, 0.0)).rgb * 255.0 * 0.125;
        cBlur += texture(uTex, uv + vec2(0.0,  uPx.y)).rgb * 255.0 * 0.125;
        cBlur += texture(uTex, uv + vec2(0.0, -uPx.y)).rgb * 255.0 * 0.125;
        cBlur += texture(uTex, uv + vec2( uPx.x,  uPx.y)).rgb * 255.0 * 0.0625;
        cBlur += texture(uTex, uv + vec2(-uPx.x,  uPx.y)).rgb * 255.0 * 0.0625;
        cBlur += texture(uTex, uv + vec2( uPx.x, -uPx.y)).rgb * 255.0 * 0.0625;
        cBlur += texture(uTex, uv + vec2(-uPx.x, -uPx.y)).rgb * 255.0 * 0.0625;

        float dBg = length(c0 - STAGE);
        float dBgBlur = length(cBlur - STAGE);
        float minBlur = min(cBlur.r, min(cBlur.g, cBlur.b));
        float maxBlur = max(cBlur.r, max(cBlur.g, cBlur.b));
        float chroma = maxBlur - minBlur;

        float fgRaw = max(smoothstep(4.2, 10.5, dBgBlur), smoothstep(3.8, 8.5, chroma));
        float porcScore = clamp(
          0.5 + 0.5 * (
            smoothstep(4.5, 11.0, dBgBlur) * smoothstep(185.0, 215.0, minBlur) * (1.0 - smoothstep(11.0, 18.0, chroma))
            - 2.2 * smoothstep(14.0, 24.0, chroma)
          ),
          0.0, 1.0
        );

        o = vec4(fgRaw, porcScore, clamp(dBg / 120.0, 0.0, 1.0), minBlur / 255.0);
      }`);

    const prog2 = makeProg(VS, `#version 300 es
      precision highp float;
      in vec2 v;
      out vec4 o;
      uniform sampler2D uPass1;
      uniform vec2 uPx;

      void main() {
        vec4 c = texture(uPass1, v);
        float fgCenter = c.r;

        float ring2 = 0.0, ring4 = 0.0, ring7 = 0.0, ring11 = 0.0;
        float porcSum = (c.g - 0.5) * 2.0;
        float denseSum = step(0.12, c.b);

        for (int i = 0; i < 12; i++) {
          float ang = float(i) * 0.5235987756;
          vec2 dir = vec2(cos(ang), sin(ang));
          vec4 s2  = texture(uPass1, v + dir * uPx * 2.0);
          vec4 s4  = texture(uPass1, v + dir * uPx * 4.0);
          vec4 s7  = texture(uPass1, v + dir * uPx * 7.0);
          vec4 s11 = texture(uPass1, v + dir * uPx * 11.0);

          ring2  += s2.r;
          ring4  += s4.r;
          ring7  += s7.r;
          ring11 += s11.r;

          porcSum += ((s2.g - 0.5) + (s4.g - 0.5) + (s7.g - 0.5) + (s11.g - 0.5)) * 2.0;
          denseSum += step(0.12, s2.b) + step(0.12, s4.b) + step(0.12, s7.b);
        }
        ring2  /= 12.0;
        ring4  /= 12.0;
        ring7  /= 12.0;
        ring11 /= 12.0;

        float porcNet = porcSum / 49.0;
        float denseFrac = denseSum / 37.0;

        float cleanFg = fgCenter * smoothstep(0.08, 0.25, max(ring2, ring4));
        float pinholeHeal = smoothstep(0.12, 0.32, porcNet) * max(
          smoothstep(0.50, 0.75, ring4),
          max(smoothstep(0.55, 0.78, ring7), smoothstep(0.58, 0.80, ring11))
        );
        float solidMask = smoothstep(0.78, 0.94, denseFrac) * smoothstep(0.75, 0.92, ring2) * smoothstep(0.70, 0.88, ring4);

        float glassField = max(max(ring2, ring4 * 0.92), max(ring7 * 0.78, ring11 * 0.55));
        float glassEnvelope = smoothstep(0.12, 0.48, glassField);

        o = vec4(cleanFg, solidMask, pinholeHeal, glassEnvelope);
      }`);

    const prog3 = makeProg(VS, `#version 300 es
      precision highp float;
      in vec2 v;
      out vec4 fragColor;
      uniform sampler2D uTex;
      uniform sampler2D uPass1;
      uniform sampler2D uPass2;
      uniform vec2 uPx;
      uniform float uEase;

      const vec3 STAGE = vec3(247.0, 248.0, 249.0) / 255.0;
      const vec3 DARK_STAGE = vec3(9.0, 19.0, 28.0) / 255.0;

      void main() {
        vec2 uv = vec2(v.x, 1.0 - v.y);
        vec3 cLight = texture(uTex, uv).rgb;
        vec4 p1 = texture(uPass1, v);
        vec4 p2 = texture(uPass2, v);

        float cleanFg = p2.r;
        float solidMask = p2.g;
        float pinholeHeal = p2.b;
        float glassEnv = p2.a;
        float minBlur = p1.a * 255.0;

        float dBg = length(cLight * 255.0 - vec3(247.0, 248.0, 249.0));
        float chroma = (max(cLight.r, max(cLight.g, cLight.b)) - min(cLight.r, min(cLight.g, cLight.b))) * 255.0;

        float alphaRib = clamp((dBg - 3.5) / 80.0 + chroma / 42.0, 0.0, 1.0) * max(cleanFg, pinholeHeal * 0.5);
        float isOpaqueSurface = max((1.0 - uEase) * max(cleanFg, pinholeHeal), solidMask);
        float edgeDenom = clamp(248.0 - minBlur, 20.0, 110.0);
        float alphaOpaque = clamp((dBg - 2.5) / edgeDenom + pinholeHeal, 0.0, 1.0) * max(cleanFg, pinholeHeal);

        float alphaFg = mix(alphaRib, max(alphaOpaque, alphaRib), isOpaqueSurface);

        vec3 cUnmixed = cLight - (1.0 - alphaFg) * (STAGE - DARK_STAGE);

        float fadingRib = alphaRib * (1.0 - isOpaqueSurface) * uEase;
        cUnmixed -= vec3(fadingRib * (20.0 / 255.0));
        cUnmixed = clamp(cUnmixed, DARK_STAGE, vec3(1.0));

        float glassShellAlpha = glassEnv * uEase * (1.0 - isOpaqueSurface) * (1.0 - 0.65 * alphaRib) * 0.16;
        vec3 glassTint = vec3(162.0, 190.0, 212.0) / 255.0;

        float finalAlpha = clamp(alphaFg + glassShellAlpha, 0.0, 1.0);
        vec3 finalRgb = mix(DARK_STAGE, cUnmixed, alphaFg / max(finalAlpha, 1e-4)) * (alphaFg / max(finalAlpha, 1e-4))
                      + glassTint * (glassShellAlpha / max(finalAlpha, 1e-4));

        fragColor = vec4(finalRgb * finalAlpha, finalAlpha);
      }`);

    const fbo1 = makeFBO(), fbo2 = makeFBO();
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const vidTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, vidTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const uDarkTex = gl.getUniformLocation(progDark, 'uTex');
    const uDarkPx = gl.getUniformLocation(progDark, 'uPx');
    const uP1Tex = gl.getUniformLocation(prog1, 'uTex');
    const uP1Px = gl.getUniformLocation(prog1, 'uPx');
    const uP2Pass1 = gl.getUniformLocation(prog2, 'uPass1');
    const uP2Px = gl.getUniformLocation(prog2, 'uPx');
    const uP3Tex = gl.getUniformLocation(prog3, 'uTex');
    const uP3Pass1 = gl.getUniformLocation(prog3, 'uPass1');
    const uP3Pass2 = gl.getUniformLocation(prog3, 'uPass2');
    const uP3Px = gl.getUniformLocation(prog3, 'uPx');
    const uP3Ease = gl.getUniformLocation(prog3, 'uEase');

    const smooth = x => { const k = Math.min(Math.max(x, 0), 1); return k * k * (3 - 2 * k); };
    const isDarkVideo = () => (video.currentSrc || video.src || '').includes('-dark.mp4');
    const bindQuad = p => {
      gl.useProgram(p);
      const loc = gl.getAttribLocation(p, 'a');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    };

    let active = false, raf = 0, onFirstFrame = null;

    const renderFrame = () => {
      gl.viewport(0, 0, W, H);
      if (isDarkVideo()) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        bindQuad(progDark);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, vidTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.uniform1i(uDarkTex, 0);
        gl.uniform2f(uDarkPx, 1.0 / W, 1.0 / H);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else {
        const t = video.currentTime || 0;
        const glass = smooth((t - 1.5) / 1.5) - smooth((t - 10.0) / 1.5);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.fbo);
        bindQuad(prog1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, vidTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.uniform1i(uP1Tex, 0);
        gl.uniform2f(uP1Px, 1.0 / W, 1.0 / H);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2.fbo);
        bindQuad(prog2);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fbo1.tex);
        gl.uniform1i(uP2Pass1, 0);
        gl.uniform2f(uP2Px, 1.0 / W, 1.0 / H);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        bindQuad(prog3);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, vidTex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fbo1.tex);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, fbo2.tex);
        gl.uniform1i(uP3Tex, 0);
        gl.uniform1i(uP3Pass1, 1);
        gl.uniform1i(uP3Pass2, 2);
        gl.uniform2f(uP3Px, 1.0 / W, 1.0 / H);
        gl.uniform1f(uP3Ease, glass);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (onFirstFrame) {
        const cb = onFirstFrame;
        onFirstFrame = null;
        cb();
      }
    };

    const draw = () => {
      if (!active || !isDark()) { raf = 0; return; }
      if (video.readyState >= 2 && !video.seeking) {
        renderFrame();
      }
      raf = requestAnimationFrame(draw);
    };

    return {
      start(cb) {
        active = true;
        onFirstFrame = cb || null;
        if (isDark() && video.readyState >= 2 && !video.seeking) {
          renderFrame();
        }
        if (!raf && isDark()) raf = requestAnimationFrame(draw);
      },
      stop() {
        active = false;
        onFirstFrame = null;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      },
      clear() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      },
      isActive: () => active
    };
  }

  // Image panel: two layers cross-fade between structures; each shows the entry's still, then its
  // rotating loop once it plays. Reduced motion keeps the stills.
  const keyers = new Map(layers.map(l => {
    const v = l.querySelector('video');
    const k = createVideoKeyer(v, l);
    v.addEventListener('error', () => {
      const cur = v.getAttribute('src') || '';
      if (cur.includes('-dark.mp4')) {
        const fallback = cur.replace(/-dark\.mp4.*$/, '.mp4');
        v.dataset.src = fallback;
        v.src = fallback;
        if (l._wantPlay) v.play().catch(() => {});
      }
    });
    return [l, k];
  }));
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let front = 0, shownPdb = null;

  const markPlaying = (layer, v) => {
    if (!layer._wantPlay) return;
    v.classList.add('is-playing');
    layer.classList.add('is-playing');
  };

  const play = layer => {
    if (calm.matches) return;
    const v = layer.querySelector('video');
    const pdb = v.dataset.pdb || layer.dataset.pdb;
    if (!pdb) return;
    v.dataset.pdb = pdb;
    v.preload = 'auto';
    const targetSrc = videoSrcFor(pdb);
    v.dataset.src = targetSrc;
    if (v.getAttribute('src') !== targetSrc) {
      v.src = targetSrc;
    }
    layer._wantPlay = true;

    const ensurePlaying = () => {
      if (layer._wantPlay && v.paused) v.play().catch(() => {});
    };
    if (v.readyState < 2) {
      v.addEventListener('loadeddata', ensurePlaying, {once: true});
      v.addEventListener('canplay', ensurePlaying, {once: true});
    }

    if (isDark()) {
      keyers.get(layer).start(() => markPlaying(layer, v));
    } else {
      keyers.get(layer).stop();
      if (v.readyState >= 2 && !v.seeking) {
        markPlaying(layer, v);
      } else {
        v.addEventListener('loadeddata', () => markPlaying(layer, v), {once: true});
        v.addEventListener('playing', () => markPlaying(layer, v), {once: true});
      }
    }
    ensurePlaying();
  };

  const pauseLayer = layer => {
    layer._wantPlay = false;
    const v = layer.querySelector('video');
    keyers.get(layer).stop();
    v.classList.remove('is-playing');
    layer.classList.remove('is-playing');
    v.pause();
    if (v.readyState >= 1) {
      try { v.currentTime = 0; } catch (e) {}
    }
  };
  const stopAll = () => layers.forEach(pauseLayer);

  addEventListener('themechange', () => {
    for (const layer of layers) {
      const v = layer.querySelector('video');
      const pdb = v.dataset.pdb || layer.dataset.pdb;
      if (!pdb) continue;
      v.dataset.pdb = pdb;
      const nextSrc = videoSrcFor(pdb);
      v.dataset.src = nextSrc;
      const wasActive = Boolean(layer._wantPlay);
      if (v.getAttribute('src')) {
        if (wasActive) {
          pauseLayer(layer);
          v.src = nextSrc;
          play(layer);
        } else {
          v.src = nextSrc;
        }
      } else if (wasActive) {
        pauseLayer(layer);
        play(layer);
      }
    }
  });

  function stage(pdb, label, turn) {
    if (pdb !== shownPdb) {
      const next = layers[1 - front], prev = layers[front], v = next.querySelector('video');
      pauseLayer(next);
      keyers.get(next).clear();
      const img = next.querySelector('img');
      img.src = `${base}${pdb}.webp`; img.alt = label;
      next.dataset.pdb = pdb;
      v.dataset.pdb = pdb;
      v.dataset.src = videoSrcFor(pdb);
      next.classList.add('is-on'); next.removeAttribute('aria-hidden');
      prev.classList.remove('is-on'); prev.setAttribute('aria-hidden', 'true'); pauseLayer(prev);
      front = 1 - front; shownPdb = pdb;
    }
    if (turn) play(layers[front]); else pauseLayer(layers[front]);
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
