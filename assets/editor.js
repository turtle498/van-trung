/* Chế độ sửa trực tiếp trên trang — chỉ chạy khi trang nằm trong admin.html (?edit=1).
   Mọi thay đổi được ghi vào window.parent.cmsStore, admin.html lo việc bấm Lưu. */
(function () {
  var P;
  try { P = window.parent; if (P === window || !P.cmsStore) return; } catch (e) { return; }
  var page = window.__cmsPage;
  var store = P.cmsStore[page];
  if (!store) return;

  var base = {};
  function changed() { try { P.cmsChanged && P.cmsChanged(); } catch (e) {} }

  function linkText(a) {
    for (var n = a.firstChild; n; n = n.nextSibling)
      if (n.nodeType === 3 && n.nodeValue.trim()) return n.nodeValue.trim();
    return '';
  }

  function css() {
    var st = document.createElement('style');
    st.textContent =
      '[data-k]:not(img):not([data-kind]){cursor:text;transition:outline-color .15s}' +
      '[data-k]:not(img):not([data-kind]):hover{outline:1px dashed rgba(36,99,235,.9);outline-offset:3px}' +
      '[data-k]:not(img):not([data-kind]):focus{outline:2px solid #2463eb!important;outline-offset:3px}' +
      'img[data-k]{cursor:pointer}' +
      'img[data-k]:hover{outline:3px solid #2463eb;outline-offset:-3px}' +
      '[data-kind]{cursor:pointer}[data-kind]:hover{outline:1px dashed #2463eb;outline-offset:3px}' +
      '.cms-changed{outline:2px solid #16a34a!important;outline-offset:3px}' +
      '.hero,.hero *{cursor:pointer}';
    document.head.appendChild(st);
  }

  function toJpeg(file, cb) {
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      URL.revokeObjectURL(url);
      var tries = [[2200, 0.86], [1800, 0.75], [1400, 0.68]];
      for (var i = 0; i < tries.length; i++) {
        var max = tries[i][0], q = tries[i][1];
        var w = im.naturalWidth, h = im.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        var x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        var d;
        try { d = c.toDataURL('image/jpeg', q); } catch (e) { return cb(e); }
        if (d.length < 4500000 || i === tries.length - 1) return cb(null, d);
      }
    };
    im.onerror = function () { URL.revokeObjectURL(url); cb(new Error('bad image')); };
    im.src = url;
  }

  function pickImg(t) {
    var img = t.closest && t.closest('img[data-k]');
    if (img) return img;
    var hero = t.closest('.hero');
    if (hero) return hero.querySelector('img.slide.on[data-k]') || hero.querySelector('img[data-k]');
    var box = t.closest('a.pic,figure');
    return box ? box.querySelector('img[data-k]') : null;
  }

  function chooseImage(img) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      toJpeg(f, function (err, dataUrl) {
        if (err) { alert('Không đọc được ảnh này. Hãy thử ảnh khác (jpg hoặc png).'); return; }
        var k = img.getAttribute('data-k');
        store.images[k] = dataUrl;
        window.__cmsImg(img, dataUrl);
        img.classList.add('cms-changed');
        changed();
      });
    };
    inp.click();
  }

  function editLink(a) {
    var k = a.getAttribute('data-k'), kind = a.getAttribute('data-kind');
    var cur = store.texts[k] != null ? store.texts[k] : (base[k] || linkText(a));
    var v = window.prompt(kind === 'mail' ? 'Nhập email mới:' : 'Nhập số điện thoại mới:', cur);
    if (v == null) return;
    v = v.trim();
    if (!v) return;
    document.querySelectorAll('[data-k="' + k + '"]').forEach(function (el) {
      el.setAttribute('href', (kind === 'mail' ? 'mailto:' : 'tel:') + (kind === 'mail' ? v : v.replace(/[^\d+]/g, '')));
      window.__cmsSetLinkText(el, v);
      el.classList.toggle('cms-changed', v !== base[k]);
    });
    if (v === base[k]) delete store.texts[k]; else store.texts[k] = v;
    changed();
  }

  function start() {
    css();
    var els = [].slice.call(document.querySelectorAll('[data-k]'));

    // giá trị gốc để biết cái nào thật sự bị sửa
    els.forEach(function (el) {
      var k = el.getAttribute('data-k');
      if (el.tagName === 'IMG' || (k in base)) return;
      var v = el.hasAttribute('data-kind') ? linkText(el) : el.textContent.trim();
      if (el.hasAttribute('data-kind') && !v) return; // nút biểu tượng không có chữ
      base[k] = v;
    });

    // phục hồi những gì client đã sửa trước đó (khi chuyển tab)
    [store.saved, store.images].forEach(function (m, idx) {
      for (var k in m) document.querySelectorAll('img[data-k="' + k + '"]').forEach(function (img) {
        window.__cmsImg(img, m[k]);
        if (idx === 1) img.classList.add('cms-changed');
      });
    });
    for (var k in store.texts) {
      document.querySelectorAll('[data-k="' + k + '"]').forEach(function (el) {
        if (el.hasAttribute('data-kind')) {
          var kind = el.getAttribute('data-kind'), v = store.texts[k];
          el.setAttribute('href', (kind === 'mail' ? 'mailto:' : 'tel:') + (kind === 'mail' ? v : v.replace(/[^\d+]/g, '')));
          window.__cmsSetLinkText(el, v);
        } else el.textContent = store.texts[k];
        el.classList.add('cms-changed');
      });
    }

    // chữ: sửa trực tiếp
    els.forEach(function (el) {
      if (el.tagName === 'IMG' || el.hasAttribute('data-kind')) return;
      el.setAttribute('contenteditable', 'plaintext-only');
      if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true'); // trình duyệt cũ
      el.spellcheck = false;
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
      el.addEventListener('paste', function (e) {
        e.preventDefault();
        var t = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\s*[\r\n]+\s*/g, ' ');
        document.execCommand('insertText', false, t);
      });
      el.addEventListener('input', function () {
        var k = el.getAttribute('data-k'), v = el.textContent.trim();
        if (v === base[k]) { delete store.texts[k]; el.classList.remove('cms-changed'); }
        else { store.texts[k] = v; el.classList.add('cms-changed'); }
        changed();
      });
    });

    // gỡ link để bấm không bị chuyển trang
    [].forEach.call(document.querySelectorAll('a[href]'), function (a) {
      if (!a.hasAttribute('data-kind')) { a.setAttribute('data-href-off', a.getAttribute('href')); a.removeAttribute('href'); }
    });

    // bấm vào ảnh / email / sđt
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      e.stopPropagation(); // chặn lightbox, menu... của trang
      var link = t.closest('[data-kind]');
      if (link) { e.preventDefault(); editLink(link); return; }
      var tk = t.closest('[data-k]');
      if (tk && tk.tagName !== 'IMG') return; // đang sửa chữ
      var img = pickImg(t);
      if (img) { e.preventDefault(); chooseImage(img); }
    }, true);

    changed();
  }

  if (window.__cmsApplied) start();
  else document.addEventListener('cms:applied', start, { once: true });
})();
