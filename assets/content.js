/* Nạp nội dung từ file JSON rồi thay vào trang.
   HTML gốc vẫn có sẵn nội dung mặc định, nên lỗi JSON thì web vẫn hiện bình thường.
   Khi mở bằng admin.html (?edit=1 trong khung iframe) thì nạp thêm editor.js để sửa trực tiếp. */
(function () {
  var me = document.currentScript;
  var url = me && me.getAttribute('data-src');
  if (!url) return;
  var page = url.replace(/^.*\//, '').replace(/\.json$/, '');

  var editMode = false, parentContent = null;
  try {
    editMode = /[?&]edit=1(&|$)/.test(location.search) && window.parent !== window && !!window.parent.cmsStore;
    if (editMode) parentContent = window.parent.cmsContent && window.parent.cmsContent[page];
  } catch (e) { editMode = false; }
  window.__cmsPage = page;

  function flat(o, out) {
    for (var k in o) {
      var v = o[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, out); else out[k] = v;
    }
    return out;
  }
  function rel(p) { return /^(https?:|data:)/.test(p) ? p : p.replace(/^\/+/, ''); }

  var timer;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      window.dispatchEvent(new Event('resize'));
      if (document.readyState === 'complete') window.dispatchEvent(new Event('load'));
    }, 80);
  }

  function setLinkText(el, v) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = v + ' '; return; }
    }
  }

  function setImgSrc(el, s) {
    el.removeAttribute('srcset');
    el.removeAttribute('loading');
    el.addEventListener('load', function () {
      if (el.naturalWidth) {
        el.setAttribute('width', el.naturalWidth);
        el.setAttribute('height', el.naturalHeight);
        var fig = el.closest('figure');
        if (fig && fig.style.getPropertyValue('--r'))
          fig.style.setProperty('--r', (el.naturalWidth / el.naturalHeight).toFixed(3));
      }
      refresh();
    }, { once: true });
    el.setAttribute('src', s);
  }
  window.__cmsImg = setImgSrc;
  window.__cmsSetLinkText = setLinkText;

  function apply(map) {
    var changed = false;
    document.querySelectorAll('[data-k]').forEach(function (el) {
      var k = el.getAttribute('data-k');
      if (!(k in map) || typeof map[k] !== 'string') return;
      var v = map[k];

      if (el.tagName === 'IMG') {
        if (!v) return;
        var s = rel(v);
        if (el.getAttribute('src') === s) return;
        setImgSrc(el, s); changed = true;
      } else if (el.getAttribute('data-kind') === 'mail') {
        v = v.trim(); if (!v) return;
        el.setAttribute('href', 'mailto:' + v); setLinkText(el, v); changed = true;
      } else if (el.getAttribute('data-kind') === 'tel') {
        v = v.trim(); if (!v) return;
        el.setAttribute('href', 'tel:' + v.replace(/[^\d+]/g, '')); setLinkText(el, v); changed = true;
      } else if (el.textContent.trim() !== v.trim()) {
        el.textContent = v; changed = true;
      }
    });
    if (changed) refresh();
  }

  function done() {
    window.__cmsApplied = true;
    document.dispatchEvent(new Event('cms:applied'));
  }

  var source = parentContent
    ? Promise.resolve(parentContent)
    : fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });

  source
    .then(function (j) { apply(flat(j, {})); })
    .catch(function (e) { console.warn('Không nạp được ' + url + ' — dùng nội dung mặc định.', e); })
    .then(done);

  if (editMode) {
    var s = document.createElement('script');
    s.src = 'assets/js/editor.js';
    (document.body || document.documentElement).appendChild(s);
  }
})();
