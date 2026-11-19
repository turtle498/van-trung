/* Worker `van-trung`: phục vụ website + cầu nối /api/... giữa trang admin và GitHub.
   Chỉ cần đặt 2 SECRET trong Cloudflare:  GITHUB_TOKEN  và  ADMIN_PASSWORD.
   (Thông tin repo bên dưới đã điền sẵn cho repo turtle498/van-trung.) */

const DEFAULTS = {
  owner: 'turtle498',
  repo: 'van-trung',
  branch: 'main',
  origin: 'https://turtle498.github.io'   // nơi đặt trang admin (nhiều nơi thì ngăn cách bằng dấu phẩy)
};
const FILES = { 'home': 'data/home.json', 'du-an': 'data/du-an.json' };
const KEY_RE = /^([hd]\d{3}|email|phone)$/;
const SHARED = new Set(['email', 'phone']);
const IMG_PATH_RE = /^\/assets\/img\/up-[a-z0-9-]+\.jpg$/;
const MAX_TEXT = 3000;
const MAX_IMG_B64 = 6000000;

function cfg(env) {
  return {
    owner: env.GH_OWNER || DEFAULTS.owner,
    repo: env.GH_REPO || DEFAULTS.repo,
    branch: env.GH_BRANCH || DEFAULTS.branch,
    origins: (env.ALLOWED_ORIGIN || DEFAULTS.origin).split(',').map(function (s) { return s.trim(); }).filter(Boolean)
  };
}

function httpErr(status, msg) { return Object.assign(new Error(msg), { status: status, publicMessage: msg }); }

function corsHeaders(request, env) {
  var origin = request.headers.get('Origin') || '';
  var h = { 'Vary': 'Origin' };
  if (cfg(env).origins.indexOf(origin) !== -1) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status: status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors) });
}

async function sha256(s) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
async function safeEqual(a, b) {
  var x = await sha256(a), y = await sha256(b), d = 0;
  for (var i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
async function authed(request, env) {
  if (!env.ADMIN_PASSWORD) throw httpErr(500, 'Chưa cài ADMIN_PASSWORD trong Cloudflare');
  if (!env.GITHUB_TOKEN) throw httpErr(500, 'Chưa cài GITHUB_TOKEN trong Cloudflare');
  var h = request.headers.get('Authorization') || '';
  if (h.indexOf('Bearer ') !== 0) return false;
  return safeEqual(h.slice(7), env.ADMIN_PASSWORD);
}

function utf8ToB64(str) {
  var bytes = new TextEncoder().encode(str), bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToUtf8(b64) {
  var bin = atob(b64.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function gh(env, path, init) {
  init = init || {};
  return fetch('https://api.github.com' + path, Object.assign({}, init, {
    headers: Object.assign({
      'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'van-trung-admin'
    }, init.headers || {})
  }));
}

async function getFile(env, path) {
  var c = cfg(env);
  var r = await gh(env, '/repos/' + c.owner + '/' + c.repo + '/contents/' + path + '?ref=' + encodeURIComponent(c.branch));
  if (!r.ok) throw httpErr(502, 'GitHub báo lỗi ' + r.status + ' khi đọc ' + path + (r.status === 401 || r.status === 403 ? ' (kiểm tra lại GITHUB_TOKEN)' : ''));
  var j = await r.json();
  return { sha: j.sha, data: JSON.parse(b64ToUtf8(j.content)) };
}

async function putRaw(env, path, bodyStr) {
  var c = cfg(env);
  return gh(env, '/repos/' + c.owner + '/' + c.repo + '/contents/' + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: bodyStr });
}

async function readAll(env) {
  var out = {}, pages = Object.keys(FILES);
  var res = await Promise.all(pages.map(function (p) { return getFile(env, FILES[p]); }));
  pages.forEach(function (p, i) { out[p] = res[i].data; });
  return out;
}

function setKey(obj, key, val) {
  var hit = false;
  Object.keys(obj).forEach(function (k) {
    var v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) { if (setKey(v, key, val)) hit = true; }
    else if (k === key) { obj[k] = val; hit = true; }
  });
  return hit;
}

// Nhận ảnh dạng chữ base64 (JPEG), đẩy lên assets/img, trả đường dẫn
async function uploadImage(request, env) {
  var len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (len > MAX_IMG_B64 + 1000) throw httpErr(413, 'Ảnh quá lớn');
  var b64 = (await request.text()).trim();
  if (!b64 || b64.length > MAX_IMG_B64) throw httpErr(413, 'Ảnh trống hoặc quá lớn');
  var head;
  try { head = atob(b64.slice(0, 8)); } catch (e) { throw httpErr(400, 'Ảnh không hợp lệ'); }
  if (head.charCodeAt(0) !== 0xFF || head.charCodeAt(1) !== 0xD8) throw httpErr(400, 'Chỉ nhận ảnh JPEG');
  var name = 'up-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
  var c = cfg(env);
  var body = '{"message":"Tải ảnh mới (admin)","branch":' + JSON.stringify(c.branch) + ',"content":"' + b64 + '"}';
  var r = await putRaw(env, 'assets/img/' + name, body);
  if (!r.ok) throw httpErr(502, 'GitHub báo lỗi ' + r.status + ' khi tải ảnh lên');
  return { path: '/assets/img/' + name };
}

async function save(request, env) {
  var body;
  try { body = await request.json(); } catch (e) { body = null; }
  if (!body || typeof body.files !== 'object' || !body.files) throw httpErr(400, 'Dữ liệu gửi lên không hợp lệ');

  var edits = {}, shared = {};
  Object.keys(body.files).forEach(function (page) {
    if (!FILES[page]) throw httpErr(400, 'Trang không hợp lệ: ' + page);
    var f = body.files[page] || {}, texts = f.texts || {}, images = f.images || {};
    var t = {}, im = {};
    Object.keys(texts).forEach(function (k) {
      if (!KEY_RE.test(k)) throw httpErr(400, 'Mã ô không hợp lệ: ' + k);
      if (typeof texts[k] !== 'string' || texts[k].length > MAX_TEXT) throw httpErr(400, 'Nội dung ô ' + k + ' không hợp lệ hoặc quá dài');
      if (SHARED.has(k)) shared[k] = texts[k]; else t[k] = texts[k];
    });
    Object.keys(images).forEach(function (k) {
      if (!KEY_RE.test(k) || SHARED.has(k)) throw httpErr(400, 'Mã ảnh không hợp lệ: ' + k);
      if (typeof images[k] !== 'string' || !IMG_PATH_RE.test(images[k])) throw httpErr(400, 'Đường dẫn ảnh không hợp lệ');
      im[k] = images[k];
    });
    edits[page] = { texts: t, images: im };
  });

  var pages = Object.keys(FILES);
  var hasShared = Object.keys(shared).length > 0;
  var current = {}, written = {};
  for (var i = 0; i < pages.length; i++) current[pages[i]] = await getFile(env, FILES[pages[i]]);

  for (var j = 0; j < pages.length; j++) {
    var p = pages[j], e = edits[p] || { texts: {}, images: {} };
    var dirty = hasShared || Object.keys(e.texts).length || Object.keys(e.images).length;
    if (!dirty) continue;
    var file = current[p];
    for (var attempt = 0; attempt < 2; attempt++) {
      var data = file.data;
      Object.keys(e.texts).forEach(function (k) { if (!setKey(data, k, e.texts[k])) throw httpErr(400, 'Không tìm thấy ô ' + k); });
      Object.keys(e.images).forEach(function (k) { if (!setKey(data, k, e.images[k])) throw httpErr(400, 'Không tìm thấy ảnh ' + k); });
      Object.keys(shared).forEach(function (k) { setKey(data, k, shared[k]); });
      var c = cfg(env);
      var put = JSON.stringify({
        message: 'Cập nhật nội dung ' + p + ' (admin)',
        content: utf8ToB64(JSON.stringify(data, null, 2) + '\n'),
        sha: file.sha,
        branch: c.branch
      });
      var r = await putRaw(env, FILES[p], put);
      if (r.ok) { written[p] = true; break; }
      if (r.status === 409 && attempt === 0) { file = await getFile(env, FILES[p]); current[p] = file; continue; }
      throw httpErr(502, 'GitHub báo lỗi ' + r.status + ' khi lưu ' + FILES[p]);
    }
  }
  var out = {};
  pages.forEach(function (p) { out[p] = current[p].data; });
  return { content: out, saved: Object.keys(written) };
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url), cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    // Mọi đường dẫn không phải /api/... là file của website: giao cho kho file tĩnh
    if (url.pathname.indexOf('/api/') !== 0) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    try {
      if (!(await authed(request, env))) return json({ error: 'Sai mật khẩu' }, 401, cors);
      if (url.pathname === '/api/content' && request.method === 'GET') return json(await readAll(env), 200, cors);
      if (url.pathname === '/api/image' && request.method === 'POST') return json(await uploadImage(request, env), 200, cors);
      if (url.pathname === '/api/save' && request.method === 'POST') return json(await save(request, env), 200, cors);
      return json({ error: 'Không tìm thấy' }, 404, cors);
    } catch (e) {
      return json({ error: e.publicMessage || 'Lỗi máy chủ' }, e.status || 500, cors);
    }
  }
};
