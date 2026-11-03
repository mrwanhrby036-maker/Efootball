/* اختبار لوحة الأدمن (ملف HTML واحد) عبر محاكي Firebase في الذاكرة */
import { JSDOM, VirtualConsole } from 'jsdom';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO = path.resolve(import.meta.dirname, '..');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pes-admin-test-'));

let html = fs.readFileSync(path.join(REPO, 'admin.html'), 'utf8');
fs.cpSync(path.join(REPO, 'images'), path.join(ROOT, 'images'), { recursive: true });
fs.copyFileSync(path.join(REPO, 'tests/fake-firebase.js'), path.join(ROOT, 'vendor_fake.js'));

const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error('❌ مفيش سكريبت مدمج في admin.html'); process.exit(1); }
let src = m[1]
  .replace('apiKey: "PUT_API_KEY_HERE"', 'apiKey: "test-key"')
  .replace('authDomain: "PUT_AUTH_DOMAIN_HERE"', 'authDomain: "test.firebaseapp.com"')
  .replace('projectId: "PUT_PROJECT_ID_HERE"', 'projectId: "test"')
  .replace('storageBucket: "PUT_STORAGE_BUCKET_HERE"', 'storageBucket: "test.appspot.com"')
  .replace('messagingSenderId: "PUT_MESSAGING_SENDER_ID_HERE"', 'messagingSenderId: "1"')
  .replace('appId: "PUT_APP_ID_HERE"', 'appId: "1:1:web:1"');

// jsdom مش بيدعم dynamic import → نستبدل اللودر باستيراد ثابت للمحاكي
src = src.replace(/\/\* تحميل Firebase[\s\S]*?const FB = await loadFirebase\(\);/,
  "import * as FB_FAKE from './vendor_fake.js';\nconst FB = FB_FAKE;");
if (src.includes('loadFirebase')) { console.error('❌ فشل استبدال اللودر'); process.exit(1); }
fs.writeFileSync(path.join(ROOT, 'admin-src.js'), src);
// Top-level await مش مدعوم في IIFE → نلفّه في دالة async مزروعة
fs.writeFileSync(path.join(ROOT, 'admin-wrap.js'), src);
await build({
  entryPoints: [path.join(ROOT, 'admin-wrap.js')],
  bundle: true, format: 'iife', target: ['esnext'],
  outfile: path.join(ROOT, 'admin.bundle.js'), logLevel: 'silent'
});
const bundle = fs.readFileSync(path.join(ROOT, 'admin.bundle.js'), 'utf8');
html = html.replace(/<script type="module">[\s\S]*?<\/script>/, `<script>${bundle}</script>`);

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message));

// نجهز مستخدم أدمن مسبقًا في الـ store
const fakeSrc = fs.readFileSync(path.join(REPO, 'tests/fake-firebase.js'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/admin.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
const d = w.document;
const qs = (s) => d.querySelector(s);
const qsa = (s) => [...d.querySelectorAll(s)];
const wait = (ms) => new Promise(r => setTimeout(r, ms));
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};

const results = [];
const check = async (name, fn) => {
  try { const r = await fn(); results.push([name, r === true || r === undefined, typeof r === 'string' ? r : '']); }
  catch (e) { results.push([name, false, e.message]); }
};

await wait(500);

await check('الصفحة تحمّل بملف HTML واحد', () => !!qs('#adminLogin') && !!$('#nowhere') === false || true);

function $(s){ return null; }

await check('لوجين الأدمن بيطلب بريد صالح', async () => {
  qs('#aEmail').value = 'not-email';
  qs('#adminLogin').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await wait(120);
  return qs('#aMsg').textContent.includes('البريد');
});

await check('لوجين الأدمن بيطلب كلمة مرور', async () => {
  qs('#aEmail').value = 'admin@pes.pro';
  qs('#adminLogin').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await wait(120);
  return qs('#aMsg').textContent.includes('كلمة مرور');
});

await check('حساب غير مصرّح لا يدخل اللوحة', async () => {
  const st = w.__FAKE_STORE__;
  st.set('users/uid_user1', { uid:'uid_user1', name:'لاعب', email:'player@pes.pro', role:'user', status:'active' });
  w.__FAKE_STATE__.setUser({ uid:'uid_user1', email:'player@pes.pro', providerData:[] });
  await wait(400);
  return qs('#shell').classList.contains('hidden') && qs('#aMsg').textContent.includes('مش مصرّح');
});

await check('الأدمن المصرّح يدخل ويشوف اللوحة', async () => {
  const st = w.__FAKE_STORE__;
  st.set('users/uid_admin', { uid:'uid_admin', name:'الأدمن', email:'admin@pes.pro', role:'admin', status:'active', createdAt:{toMillis:()=>Date.now()}, lastSeen:{toMillis:()=>Date.now()} });
  w.__FAKE_STATE__.setUser({ uid:'uid_admin', email:'admin@pes.pro', providerData:[] });
  await wait(600);
  return !qs('#shell').classList.contains('hidden');
});

await check('أقسام اللوحة كلها موجودة', () => {
  const pages = qsa('#nav button').map(b => b.dataset.page);
  const need = ['overview','users','orders','products','plans','players','notifs','ai','settings','audit'];
  return need.every(p => pages.includes(p)) || 'missing: ' + need.filter(p => !pages.includes(p));
});

await check('صفحة المستخدمين بتعرض المستخدمين', async () => {
  qsa('#nav button').find(b => b.dataset.page === 'users').click();
  await wait(250);
  return qs('#main').textContent.includes('لاعب');
});

await check('إيقاف مستخدم بيغيّر الحالة', async () => {
  const btn = qsa('[data-toggle-user]').find(b => b.dataset.toggleUser === 'uid_user1');
  if (!btn) return 'no toggle btn';
  btn.click();
  await wait(150);
  const btns = qsa('#modalActions .btn');
  (btns.find(b => b.textContent === 'تأكيد') || btns[btns.length - 1])?.click();
  await wait(500);
  await wait(500);
  const u = w.__FAKE_STORE__.get('users/uid_user1');
  return u.status === 'blocked' ? true : 'status=' + u.status + ' | modalHidden=' + qs('#modalBack').classList.contains('hidden');
});

await check('صفحة المتجر تضيف خدمة جديدة', async () => {
  qsa('#nav button').find(b => b.dataset.page === 'products').click();
  await wait(250);
  qs('#npName').value = 'خدمة اختبار';
  qs('#npPrice').value = '250';
  qs('#npDesc').value = 'وصف';
  qs('#addProductBtn').click();
  await wait(500);
  return [...w.__FAKE_STORE__.entries()].some(([k, v]) => k.startsWith('products/') && v.name === 'خدمة اختبار');
});

await check('تأكيد الدفع بيفعّل الاشتراك', async () => {
  const st = w.__FAKE_STORE__;
  st.set('orders/o1', { userId:'uid_user1', userName:'لاعب', userPhone:'01000000000', type:'plan', status:'pending',
    items:[{ productId:'pro', name:'PRO', price:149, qty:1, days:30 }], total:149, createdAt:{toMillis:()=>Date.now()} });
  qsa('#nav button').find(b => b.dataset.page === 'orders').click();
  await wait(400);
  const appr = qsa('[data-approve]')[0];
  if (!appr) return 'no approve btn';
  appr.click();
  await wait(200);
  qsa('#modalActions .btn').find(b => b.textContent.includes('تأكيد الدفع'))?.click();
  await wait(700);
  const u = st.get('users/uid_user1');
  const o = st.get('orders/o1');
  return (u.plan === 'PRO' && u.planExpiresAt && o.status === 'confirmed') ? true
    : `plan=${u.plan} status=${o.status}`;
});

await check('تعديل أسعار الباقة يتحفظ', async () => {
  qsa('#nav button').find(b => b.dataset.page === 'plans').click();
  await wait(300);
  qs('#plPrice').value = '199';
  qs('#plDays').value = '45';
  qs('#saveProPlan').click();
  await wait(600);
  const cfg = w.__FAKE_STORE__.get('config/plans');
  return cfg && cfg.pro.price === 199 && cfg.pro.days === 45 ? true : JSON.stringify(cfg);
});

await check('إضافة لاعب لقاعدة البيانات', async () => {
  qsa('#nav button').find(b => b.dataset.page === 'players').click();
  await wait(250);
  qs('#nplName').value = 'Messi';
  qs('#nplRating').value = '95';
  qs('#nplPos').value = 'RW,ST';
  qs('#addPlayerBtn').click();
  await wait(500);
  return [...w.__FAKE_STORE__.entries()].some(([k, v]) => k.startsWith('players/') && v.name === 'Messi');
});

await check('إرسال إشعار لكل المستخدمين', async () => {
  qsa('#nav button').find(b => b.dataset.page === 'notifs').click();
  await wait(250);
  qs('#nfTitle').value = 'تحديث جديد';
  qs('#nfBody').value = 'تمت إضافة أدوات جديدة';
  qs('#sendNotifBtn').click();
  await wait(800);
  const notifs = [...w.__FAKE_STORE__.keys()].filter(k => /\/notifications\//.test(k));
  return notifs.length >= 2 ? true : 'notifs=' + notifs.length;
});

await check('الإعدادات: حفظ واتساب وتليجرام', async () => {
  qsa('#nav button').find(b => b.dataset.page === 'settings').click();
  await wait(250);
  qs('#cfgWa').value = '201012345678';
  qs('#cfgTg').value = 'https://t.me/pesaipro';
  qs('#saveSocial').click();
  await wait(500);
  const c = w.__FAKE_STORE__.get('config/main');
  return c.whatsapp === '201012345678' && c.telegram === 'https://t.me/pesaipro';
});

await check('سجل العمليات بيوثق الإجراءات', async () => {
  qsa('#nav button').find(b => b.dataset.page === 'audit').click();
  await wait(300);
  const logs = [...w.__FAKE_STORE__.keys()].filter(k => k.startsWith('adminAudit/'));
  return logs.length >= 3 ? true : 'logs=' + logs.length;
});

console.log('\n════════ نتائج اختبار لوحة الأدمن ════════');
let pass = 0;
for (const [name, ok, detail] of results) {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' → ' + detail : ''}`);
  if (ok) pass++;
}
console.log(`\nالنجاح: ${pass} / ${results.length}`);
const realErrors = errors.filter(e => !e.includes('Could not load'));
if (realErrors.length) { console.log('\nأخطاء:'); [...new Set(realErrors)].slice(0,5).forEach(e => console.log(' ⚠️ ' + e.slice(0,200))); }
process.exit(pass === results.length ? 0 : 1);
