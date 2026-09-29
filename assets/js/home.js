(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Thanh điều hướng: trong suốt trên hero, trắng khi cuộn ---------- */
  const nav = document.getElementById('nav');
  const hero = document.querySelector('.hero');
  const setNav = () => nav.classList.toggle('solid', scrollY > hero.offsetHeight - 80);
  addEventListener('scroll', setNav, { passive: true });
  setNav();

  const menuBtn = document.getElementById('menuBtn');
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.textContent = open ? 'Đóng' : 'Menu';
  });
  nav.querySelectorAll('ul a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', false);
    menuBtn.textContent = 'Menu';
  }));

  /* ---------- Hero: trình chiếu ảnh chậm (Ken Burns) ---------- */
  const slides = [...document.querySelectorAll('#slides .slide')];
  let cur = 0;
  if (!reduce && slides.length > 1) {
    setInterval(() => {
      const prev = slides[cur];
      cur = (cur + 1) % slides.length;
      slides[cur].classList.add('on');
      setTimeout(() => prev.classList.remove('on'), 2300);
    }, 6500);
  }

  /* ---------- Hiện dần khi cuộn ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  /* ---------- Đường dẫn uốn lượn nối các dự án ---------- */
  const works = document.getElementById('works');
  const svg = document.getElementById('spine');
  const trail = document.getElementById('spineTrail');
  const reveal = document.getElementById('spineReveal');
  const linksG = document.getElementById('spineLinks');
  const entries = [...works.querySelectorAll('.entry')];
  let pathLen = 0, nodes = [];

  function build() {
    const box = works.getBoundingClientRect();
    const W = box.width, H = box.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const mobile = innerWidth <= 760;

    nodes = entries.map(en => {
      const n = en.querySelector('.node').getBoundingClientRect();
      const info = en.querySelector('.info').getBoundingClientRect();
      return {
        el: en.querySelector('.node'),
        x: n.left + n.width / 2 - box.left,
        y: n.top + n.height / 2 - box.top,
        info, flip: en.classList.contains('flip')
      };
    });

    // điểm đầu & cuối của đường
    const startX = mobile ? nodes[0].x : W / 2;
    const pts = [{ x: startX, y: 0 }, ...nodes, { x: mobile ? startX : W / 2, y: H }];

    // cong chữ S với tiếp tuyến thẳng đứng giữa các nút
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], k = (b.y - a.y) * 0.5;
      d += ` C${a.x},${a.y + k} ${b.x},${b.y - k} ${b.x},${b.y}`;
    }
    trail.setAttribute('d', d);
    reveal.setAttribute('d', d);
    pathLen = reveal.getTotalLength();
    reveal.style.strokeDasharray = pathLen;

    // nét đứt ngang nối nút với cụm thông tin
    linksG.innerHTML = '';
    if (!mobile) {
      nodes.forEach(n => {
        const edge = n.flip ? n.info.left - box.left - 18 : n.info.right - box.left + 18;
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', n.x + (n.flip ? 8 : -8)); l.setAttribute('y1', n.y);
        l.setAttribute('x2', edge); l.setAttribute('y2', n.y);
        l.setAttribute('class', 'link');
        linksG.appendChild(l);
        n.link = l;
      });
    }
    progress();
  }

  function progress() {
    const box = works.getBoundingClientRect();
    const p = reduce ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.72 - box.top) / box.height));
    reveal.style.strokeDashoffset = pathLen * (1 - p);
    const yNow = p * box.height;
    nodes.forEach(n => {
      const on = n.y <= yNow + 4;
      n.el.classList.toggle('lit', on);
      if (n.link) n.link.classList.toggle('lit', on);
    });
  }

  let raf = 0;
  addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(progress); }, { passive: true });
  new ResizeObserver(() => build()).observe(works);
  addEventListener('load', build);

  /* ---------- CV: Dạng văn bản / Dòng thời gian ---------- */
  const tabs = [...document.querySelectorAll('.toggle [role=tab]')];
  const panels = { text: document.getElementById('view-text'), time: document.getElementById('view-time') };
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(o => o.setAttribute('aria-selected', o === t));
    Object.entries(panels).forEach(([k, el]) => {
      el.hidden = k !== t.dataset.view;
      if (!el.hidden) el.querySelectorAll('.rv').forEach(r => r.classList.add('in'));
    });
  }));
})();
