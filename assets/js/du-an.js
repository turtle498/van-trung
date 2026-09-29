(() => {
  const $ = s => document.querySelector(s);

  /* ---------- Cuộn mượt có quán tính như video mẫu (Lenis) ----------
     Chỉ áp cho chuột/bàn di; cảm ứng giữ cuộn gốc của máy. Không tải được thư viện thì dùng cuộn thường. */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lenis = window.Lenis && !reduce
    ? new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, autoRaf: true })
    : null;

  // link neo (#du-an-01, #lien-he, #top…) trượt êm tới nơi; Lenis tự tính scroll-margin-top để chừa chỗ thanh menu
  if (lenis) {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href') === '#') return;
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
      history.replaceState(null, '', a.getAttribute('href'));
    });
  }

  /* ---------- Tự dừng đúng mép dưới thanh menu khi cuộn tới đầu một dự án ----------
     Chỉ hít khi đầu dự án đã ở gần (trong ~1/4 màn hình) và người dùng vừa dừng lăn chuột;
     cuộn xa vẫn tự do để đọc hết ảnh trong dự án dài. */
  if (lenis) {
    const works = [...document.querySelectorAll('.work')];
    const barEl = document.querySelector('.bar');
    let lastWheel = 0, idle = 0;
    addEventListener('wheel', () => { lastWheel = performance.now(); }, { passive: true });
    lenis.on('scroll', () => {
      clearTimeout(idle);
      idle = setTimeout(snap, 120);
    });
    function snap() {
      if (performance.now() - lastWheel > 1600) return;      // chỉ sau khi lăn chuột, không can thiệp link neo
      if (document.body.classList.contains('lb-open')) return;
      const line = barEl.getBoundingClientRect().bottom;
      const range = Math.min(innerHeight * 0.25, 240);
      let best = null, bestD = Infinity;
      for (const w of works) {
        const d = w.getBoundingClientRect().top - line;
        if (Math.abs(d) < Math.abs(bestD)) { bestD = d; best = w; }
      }
      if (!best || Math.abs(bestD) < 1.5 || Math.abs(bestD) > range) return;
      lenis.scrollTo(best, { duration: 0.8, easing: t => 1 - Math.pow(1 - t, 3) });
    }
  }

  /* ---------- Thanh tiến trình đọc ---------- */
  const bar = $('#progress');
  const setProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = `calc((100% - var(--fx)) * ${max > 0 ? scrollY / max : 0})`;
  };
  addEventListener('scroll', setProgress, { passive: true });
  addEventListener('resize', setProgress);
  setProgress();

  /* ---------- Menu điện thoại ---------- */
  const head = $('#bar');
  const btn = $('#menuBtn');
  btn.addEventListener('click', () => {
    const open = head.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    btn.textContent = open ? 'Đóng' : 'Menu';
  });
  head.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => {
    head.classList.remove('open');
    btn.setAttribute('aria-expanded', false);
    btn.textContent = 'Menu';
  }));

  /* ---------- Hiện dần khi cuộn ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.fx').forEach(el => io.observe(el));

  /* ---------- Xem ảnh lớn: trước / sau, phóng to / thu nhỏ ---------- */
  const lb = $('#lb'), stage = $('#lbStage'), view = $('#lbImg');
  const capEl = $('#lbCap'), countEl = $('#lbCount'), zoomEl = $('#lbZoom');
  const btnIn = $('#lbIn'), btnOut = $('#lbOut');
  const imgs = [...document.querySelectorAll('.gallery img')];
  const MIN = 1, MAX = 5, STEP = 1.5, TAP_ZOOM = 2.5;
  let idx = 0, scale = 1, tx = 0, ty = 0, lastFocus = null;

  function apply(anim) {
    stage.classList.toggle('anim', !!anim);
    view.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    stage.classList.toggle('zoomed', scale > MIN + 0.001);
    zoomEl.textContent = `${Math.round(scale * 100)}%`;
    btnOut.disabled = scale <= MIN + 0.001;
    btnIn.disabled = scale >= MAX - 0.001;
  }

  // giữ ảnh không trôi ra khỏi khung khi đang phóng to
  function clamp() {
    const mx = Math.max(0, (view.offsetWidth * scale - stage.clientWidth) / 2);
    const my = Math.max(0, (view.offsetHeight * scale - stage.clientHeight) / 2);
    tx = Math.min(mx, Math.max(-mx, tx));
    ty = Math.min(my, Math.max(-my, ty));
  }

  // phóng to quanh điểm (px, py) tính từ tâm khung
  function zoomTo(s, px = 0, py = 0, anim = true) {
    s = Math.min(MAX, Math.max(MIN, s));
    tx = px - (px - tx) * (s / scale);
    ty = py - (py - ty) * (s / scale);
    scale = s;
    if (scale === MIN) { tx = 0; ty = 0; }
    clamp();
    apply(anim);
  }

  function pointOf(x, y) {
    const r = stage.getBoundingClientRect();
    return [x - r.left - r.width / 2, y - r.top - r.height / 2];
  }

  function show(i) {
    idx = (i + imgs.length) % imgs.length;
    const img = imgs[idx];
    scale = 1; tx = 0; ty = 0; apply(false);
    view.src = img.currentSrc || img.src;
    view.alt = img.alt;

    const fc = img.closest('figure').querySelector('figcaption');
    const work = img.closest('.work');
    const small = document.createElement('small');
    small.textContent = `${work.querySelector('.num').textContent} — ${work.querySelector('h2').textContent}`;
    capEl.replaceChildren(fc ? fc.textContent : img.alt, small);
    countEl.textContent = `${idx + 1} / ${imgs.length}`;

    // tải trước ảnh kế bên cho lúc bấm tiếp/lùi
    [idx + 1, idx - 1].forEach(j => { new Image().src = imgs[(j + imgs.length) % imgs.length].src; });
  }

  function open(i) {
    lastFocus = imgs[i];
    show(i);
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('lb-open');
    lenis && lenis.stop();
    $('#lbClose').focus();
  }
  function close() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    document.body.classList.remove('lb-open');
    lenis && lenis.start();
    lastFocus && lastFocus.focus({ preventScroll: true });
  }
  const next = () => show(idx + 1);
  const prev = () => show(idx - 1);

  imgs.forEach((img, i) => {
    img.tabIndex = 0;
    img.addEventListener('click', () => open(i));
    img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
  });

  $('#lbNext').addEventListener('click', next);
  $('#lbPrev').addEventListener('click', prev);
  $('#lbClose').addEventListener('click', close);
  btnIn.addEventListener('click', () => zoomTo(scale * STEP));
  btnOut.addEventListener('click', () => zoomTo(scale / STEP));
  $('#lbFit').addEventListener('click', () => zoomTo(MIN));
  view.addEventListener('load', () => { clamp(); apply(false); });
  addEventListener('resize', () => { if (lb.classList.contains('open')) { clamp(); apply(false); } });

  // lăn chuột để phóng to / thu nhỏ tại vị trí con trỏ
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const [px, py] = pointOf(e.clientX, e.clientY);
    zoomTo(scale * Math.exp(-e.deltaY * 0.0015), px, py, false);
  }, { passive: false });

  // kéo để di chuyển, chụm 2 ngón để phóng, vuốt ngang để chuyển ảnh, chạm để phóng nhanh
  const pts = new Map();
  let g = null;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const mid = () => { const [a, b] = [...pts.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2]; };

  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      g = { type: 'tap', x: e.clientX, y: e.clientY, tx, ty, onImg: e.target === view };
    } else if (pts.size === 2) {
      g = { type: 'pinch', d: dist(), s: scale };
    }
  });

  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !g) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.type === 'pinch' && pts.size === 2) {
      const [mx, my] = mid();
      const [px, py] = pointOf(mx, my);
      zoomTo(g.s * dist() / g.d, px, py, false);
      return;
    }
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (g.type === 'tap' && Math.hypot(dx, dy) > 6) g.type = scale > MIN ? 'pan' : 'swipe';
    if (g.type === 'pan') {
      tx = g.tx + dx; ty = g.ty + dy;
      clamp(); apply(false);
      stage.classList.add('dragging');
    }
  });

  function endPointer(e) {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    stage.classList.remove('dragging');
    if (!g) return;

    if (g.type === 'pinch') {
      // còn một ngón: tiếp tục kéo từ vị trí hiện tại, không bị giật
      if (pts.size === 1) { const [q] = [...pts.values()]; g = { type: 'pan', x: q.x, y: q.y, tx, ty }; }
      else g = null;
      return;
    }
    if (e.type === 'pointerup') {
      const dx = p.x - g.x, dy = p.y - g.y;
      if (g.type === 'swipe' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        dx < 0 ? next() : prev();
      } else if (g.type === 'tap') {
        if (g.onImg) {
          const [px, py] = pointOf(p.x, p.y);
          scale > MIN ? zoomTo(MIN) : zoomTo(TAP_ZOOM, px, py);
        } else if (scale <= MIN) {
          close();      // chạm vào nền trống để đóng
        }
      }
    }
    g = null;
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    switch (e.key) {
      case 'Escape': close(); break;
      case 'ArrowRight': next(); break;
      case 'ArrowLeft': prev(); break;
      case '+': case '=': zoomTo(scale * STEP); break;
      case '-': case '_': zoomTo(scale / STEP); break;
      case '0': zoomTo(MIN); break;
      default: return;
    }
    e.preventDefault();
  });
})();
