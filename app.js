'use strict';
/* =========================================================================
   PES AI PRO — تطبيق Firebase في 3 ملفات
   index.html + styles.css + app.js + images/
   يعمل على Firebase Hosting (Auth + Realtime Database + Storage)
   وعند تعذر تحميل Firebase SDK (معاينة محلية) يعمل بوضع تجريبي عبر الخادم المحلي
   ========================================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBzHHBny7xzUMyi8EouXtf1BFk7_5Qo8tg",
  authDomain: "hamo-8132e.firebaseapp.com",
  projectId: "hamo-8132e",
  storageBucket: "hamo-8132e.firebasestorage.app",
  messagingSenderId: "791335303883",
  appId: "1:791335303883:web:ce5b38db63f4e92eb4b94e",
  measurementId: "G-SG25P8MMEG",
  /* عنوان Realtime Database — راجعه من Firebase Console ← Realtime Database
     (لو قاعدتك في منطقة تانية بيكون الشكل: https://hamo-8132e-default-rtdb.<region>.firebasedatabase.app) */
  databaseURL: "https://hamo-8132e-default-rtdb.firebaseio.com"
};

/* تحميل Firebase بشكل آمن: لو فشل تحميل SDK (شبكة/حجب) لا تتوقف الصفحة كلها */
const SDK_OK = (typeof firebase !== 'undefined') && !!firebase && !!firebase.apps;
if (SDK_OK && !firebase.apps.length) firebase.initializeApp(firebaseConfig);
const fb = { auth: null, db: null };
if (SDK_OK) {
  try { fb.auth = firebase.auth(); } catch (e) { console.error('Auth init failed', e); }
  try {
    fb.db = firebase.database();          /* Realtime Database — كاش محلي مدمج يعمل أوفلاين تلقائيًا */
  } catch (e) {
    console.error('Realtime Database init failed', e);
    fb.db = null;
  }
}
/* firebase-storage (~150KB) لا يُحمَّل إلا عند رفع صورة — أسرع في التحميل الأول */
let _storageSdkPromise = null;
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('فشل تحميل مكتبة التخزين'));
    document.head.appendChild(s);
  });
}
async function storageService() {
  if (!SDK_OK) throw new Error('خدمات Firebase غير متاحة حاليًا');
  if (!_storageSdkPromise) {
    _storageSdkPromise = window.firebase.storage
      ? Promise.resolve()
      : loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js');
  }
  await _storageSdkPromise;
  return window.firebase.app().storage();
}

/* ------------------------------- helpers ------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (Number(n) || 0).toLocaleString('en-US') + ' ج.م';
const nowStr = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (days, from) => new Date(new Date(from || Date.now()).getTime() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
const dateAr = s => { if (!s) return '—'; try { const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('T') ? '' : 'Z')); return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return s; } };
const dateTimeAr = s => { if (!s) return '—'; try { const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('T') ? '' : 'Z')); return d.toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Realtime Database بيرجّع المصفوفات أحيانًا كـ object (لو فيها فراغات/null) — نوحّدها لمصفوفة */
const toArr = v => Array.isArray(v) ? v
  : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => Number(a) - Number(b)).map(k => v[k]) : []);

/* ------------------------- أدوات الأداء ورسائل الأخطاء ------------------------- */
/* توحيد رقم الهاتف للصيغة الدولية (يمنع فشل OTP بسبب الصيغة المحلية) */
function normalizePhone(raw) {
  let p = String(raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('+')) return p;
  if (/^01\d{9}$/.test(p)) return '+20' + p.slice(1);      // 01xxxxxxxxx مصري
  if (/^1\d{9}$/.test(p)) return '+20' + p;                 // 1xxxxxxxxx بدون صفر
  if (/^20\d{10}$/.test(p)) return '+' + p;                 // 20xxxxxxxxxx
  if (/^0\d{8,10}$/.test(p)) return '+20' + p.slice(1);
  return p ? '+' + p : '';
}
/* تحويل أخطاء Firebase إلى رسالة عربية مفهومة بدل صمت أو إنجليزي */
function fbErrMsg(err) {
  const code = String((err && (err.code || err.message)) || '').toLowerCase().replace(/_/g, '-');
  const table = [
    ['timeout', 'الخدمة تأخرت في الرد (شبكة ضعيفة). جرّب مرة أخرى — لا تُغلق الصفحة.'],
    ['unavailable', 'تعذر الوصول لخدمات Firebase (شبكة/حجب إعلانات). تحقق من الاتصال وأعد المحاولة.'],
    ['auth/invalid-phone-number', 'رقم الهاتف غير صحيح. اكتبه بالصيغة الدولية: +201012345678.'],
    ['auth/missing-phone-number', 'اكتب رقم الهاتف أولًا.'],
    ['auth/too-many-requests', 'محاولات كثيرة على هذا الرقم. انتظر بضع دقائق ثم أعد المحاولة.'],
    ['auth/quota-exceeded', 'تم استهلاك حد رسائل التحقق اليومي للمنصة. جرّب لاحقًا أو استخدم الدخول بحساب Google.'],
    ['auth/operation-not-allowed', 'الدخول بالهاتف غير مفعّل في Firebase (Phone sign-in). فعّله من Firebase Console أو استخدم الدخول بحساب Google.'],
    ['auth/unauthorized-domain', 'هذا النطاق غير مصرّح به في Firebase. أضفه من Authentication ← Settings ← Authorized domains.'],
    ['auth/captcha-check-failed', 'فشل التحقق الأمني (reCAPTCHA). حدّث الصفحة وأعد المحاولة.'],
    ['auth/invalid-app-credential', 'فشل التحقق الأمني للجهاز. حدّث الصفحة أو جرّب متصفحًا آخر (لا تستخدم وضع التصفح الخاص).'],
    ['auth/invalid-verification-code', 'رمز التحقق غير صحيح. راجع الرقم وأعد المحاولة.'],
    ['auth/code-expired', 'انتهت صلاحية رمز التحقق. اضغط إعادة الإرسال.'],
    ['auth/network-request-failed', 'الشبكة ضعيفة أو مقطوعة. تحقق من الإنترنت وأعد المحاولة.'],
    ['auth/web-storage-unsupported', 'المتصفح يمنع التخزين (وضع خاص/إعدادات صارمة). اسمح بالملفات المؤقتة.'],
    ['auth/popup-blocked', 'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة وأعد المحاولة.'],
    ['auth/popup-closed-by-user', 'أُغلقت نافذة Google قبل إكمال الدخول.'],
    ['auth/cancelled-popup-request', 'تم إلغاء نافذة Google. أعد المحاولة.'],
    ['auth/internal-error', 'خطأ داخلي من خدمة المصادقة. أعد المحاولة بعد تحديث الصفحة.'],
    ['auth/user-disabled', 'الحساب موقوف. تواصل مع الدعم.'],
    ['auth/wrong-password', 'كلمة المرور غير صحيحة.'],
    ['auth/user-not-found', 'لا يوجد حساب بهذا البريد.'],
    ['auth/email-already-in-use', 'البريد مستخدم بالفعل.'],
    ['auth/invalid-email', 'البريد الإلكتروني غير صحيح.'],
    ['permission-denied', 'ليس لديك صلاحية لهذا الإجراء (قواعد قاعدة البيانات).'],
    ['failed-precondition', 'قاعدة البيانات تحتاج فهرسًا (index) لهذا الاستعلام.']
  ];
  for (const [k, msg] of table) if (code.includes(k)) return msg;
  const raw = (err && (err.message || err.code)) || 'حدث خطأ غير متوقع';
  return String(raw);
}
/* تقرير أخطاء قاعدة البيانات بدل السكوت التام (كانت كل الأخطاء تُبتلع وترجع null) */
let _dbIssueAt = 0, _dbIssueKey = '';
const DB_NET_CODES = /unavailable|network|offline|disconnect|deadline|timeout|internal|exhausted|cancelled/i;
const normDbErr = e => String((e && (e.code || e.message)) || 'unknown').toLowerCase().replace(/_/g, '-');
function reportDbIssue(where, err) {
  const code = normDbErr(err);
  console.warn('[rtdb]', where, '→', code, (err && err.message) || '');
  const key = code.split('/').pop();
  if (key === _dbIssueKey && Date.now() - _dbIssueAt < 45000) return;   /* مانع تكرار نفس التنبيه */
  _dbIssueKey = key; _dbIssueAt = Date.now();
  try { state.dbIssue = key; } catch (e) { }
  const msg = key === 'permission-denied'
    ? 'ليس لديك صلاحية قراءة هذه البيانات (قواعد قاعدة البيانات).'
    : (key === 'unavailable' || key === 'network-request-failed')
      ? 'تعذر الاتصال بقاعدة البيانات — تحقق من الإنترنت، وسنعيد المحاولة تلقائيًا.'
      : fbErrMsg(err);
  try { toast(msg, 'err'); } catch (e) { }
}
/* زر يتغيّر لشكل "جارٍ التنفيذ" ويمنع الضغط المزدوج */
function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '.75';
    btn.innerHTML = `<span class="spinner" style="width:15px;height:15px;display:inline-block;vertical-align:-3px;margin-inline-end:7px"></span>${esc(label || 'جارٍ التنفيذ...')}`;
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    if (btn.dataset.label) { btn.innerHTML = btn.dataset.label; delete btn.dataset.label; }
  }
}
function persistSession() {
  try {
    if (state.user) localStorage.setItem('pesai_user', JSON.stringify(state.user)); else localStorage.removeItem('pesai_user');
    if (state.user && state.plan) localStorage.setItem('pesai_plan', JSON.stringify(state.plan)); else localStorage.removeItem('pesai_plan');
  } catch (e) { }
}
function clearSession() {
  try { localStorage.removeItem('pesai_user'); localStorage.removeItem('pesai_plan'); } catch (e) { }
}

function toast(msg, type = 'ok') {
  const root = $('#toast-root'); if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'err' ? 'err' : '');
  el.innerHTML = `${type === 'err' ? '<span class="svg-icon">' + I.warning + '</span>' : '<span class="svg-icon">' + I.check + '</span>'}<span>${esc(msg)}</span>`;
  root.appendChild(el); setTimeout(() => el.remove(), 4200);
}
function openModal(title, html) {
  const root = $('#modal-root'); if (!root) return;
  root.innerHTML = `<div class="modal open" id="modal"><div class="modal-box"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close-modal>✕</button></div>${html}</div></div>`;
  $('#modal').onclick = e => { if (e.target.id === 'modal' || e.target.closest('[data-close-modal]')) closeModal(); };
}
function closeModal() { const m = $('#modal'); if (m) m.classList.remove('open'); }
function loading(on) { let l = $('#loading'); if (!l) { l = document.createElement('div'); l.id = 'loading'; l.className = 'loading'; l.innerHTML = '<div class="spinner" style="width:28px;height:28px"></div>'; document.body.appendChild(l); } l.classList.toggle('on', !!on); }
function statusPill(status) {
  const map = { active: ['نشط', 'green'], suspended: ['موقوف', 'red'], pending_review: ['قيد المراجعة', ''], completed: ['مكتمل', 'green'], rejected: ['مرفوض', 'red'], expired: ['منتهي', 'gray'], pending: ['معلق', ''] };
  const [label, cls] = map[status] || [status, 'gray'];
  return `<span class="pill ${cls}">${esc(label)}</span>`;
}

/* ------------------------------- icons ------------------------------- */
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  pitch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 9h3v6H3M21 9h-3v6h3"/><circle cx="12" cy="12" r="2.5"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M12 13v4M9 21h6M10 17h4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14.5c2.7.4 4.5 2.2 4.5 5.5"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h16l-1 11H5L4 9Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h9"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l18-8L3 4l4 8-4 8Z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 0 1 0 16.2 8 8 0 0 1-4.1-1.1l-.3-.2-3 .9.9-2.9-.2-.3a8.1 8.1 0 0 1 6.7-12.6Zm-3.1 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.5 3.9 2.2.8 2.7.7 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.1-.2 0-.4.1-.5l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.6Z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.3 12.9l-4.8-1.5c-1-.3-1-1 .2-1.5l18.8-7.2c.9-.3 1.6.2 1.4 1.6Z"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V5a2 2 0 0 0-4 0v8.5a7 7 0 0 0 14 0v-4.5a2 2 0 0 0-4 0Z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  party: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 20v-2a7 7 0 0 1 14 0v2"/><circle cx="12" cy="7" r="4"/><path d="m5 10 2 2m12-2-2 2"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4.5 16.5c-1.5 1.5-2 3-2 3s1.5-.5 3-2l3-3m5.5-5.5a9.5 9.5 0 0 0-8.5-8.5c1 4 3 6 8.5 8.5Z"/><path d="M12 12l3 3m-6 3 2 2m4-8-2-2"/></svg>',
  puzzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M19.439 7.85c-.049.322-.059.648-.029.975a3 3 0 0 0 3 3.325v3.35a2 2 0 0 1-2 2h-3.35a3 3 0 0 0-3.325 3c-.327.03-.653.02-.975-.029a3 3 0 0 0-3.325-3H6.8a2 2 0 0 1-2-2v-3.35a3 3 0 0 0-3-3.325c-.03-.327-.02-.653.029-.975a3 3 0 0 0 3-3.325V3.8a2 2 0 0 1 2-2h3.35a3 3 0 0 0 3.325-3c.327-.03.653-.02.975.029a3 3 0 0 0 3.325 3H17.2a2 2 0 0 1 2 2v3.35a3 3 0 0 0 3 3.325Z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  memo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="9" cy="16" r="1"/><circle cx="15" cy="16" r="1"/><path d="M12 11V7M10 7h4M12 3v1"/></svg>'
};

/* ------------------------------- seed data ------------------------------- */
const FORMATIONS = [
  { name: '4-3-3', description: 'هجومي متوازن', slots: [{ role: 'GK', x: 50, y: 92 }, { role: 'LB', x: 14, y: 74 }, { role: 'CB', x: 36, y: 78 }, { role: 'CB', x: 64, y: 78 }, { role: 'RB', x: 86, y: 74 }, { role: 'CM', x: 30, y: 54 }, { role: 'CM', x: 50, y: 60 }, { role: 'CM', x: 70, y: 54 }, { role: 'LW', x: 18, y: 30 }, { role: 'ST', x: 50, y: 20 }, { role: 'RW', x: 82, y: 30 }] },
  { name: '4-2-3-1', description: 'صلابة دفاعية وهجوم منظم', slots: [{ role: 'GK', x: 50, y: 92 }, { role: 'LB', x: 14, y: 74 }, { role: 'CB', x: 36, y: 78 }, { role: 'CB', x: 64, y: 78 }, { role: 'RB', x: 86, y: 74 }, { role: 'CM', x: 34, y: 60 }, { role: 'CM', x: 66, y: 60 }, { role: 'LW', x: 18, y: 38 }, { role: 'CAM', x: 50, y: 40 }, { role: 'RW', x: 82, y: 38 }, { role: 'ST', x: 50, y: 18 }] },
  { name: '4-4-2', description: 'كلاسيكي متوازن', slots: [{ role: 'GK', x: 50, y: 92 }, { role: 'LB', x: 14, y: 74 }, { role: 'CB', x: 36, y: 78 }, { role: 'CB', x: 64, y: 78 }, { role: 'RB', x: 86, y: 74 }, { role: 'LW', x: 16, y: 52 }, { role: 'CM', x: 38, y: 56 }, { role: 'CM', x: 62, y: 56 }, { role: 'RW', x: 84, y: 52 }, { role: 'ST', x: 38, y: 22 }, { role: 'ST', x: 62, y: 22 }] },
  { name: '3-5-2', description: 'سيطرة وسط الملعب', slots: [{ role: 'GK', x: 50, y: 92 }, { role: 'CB', x: 28, y: 78 }, { role: 'CB', x: 50, y: 80 }, { role: 'CB', x: 72, y: 78 }, { role: 'LW', x: 12, y: 54 }, { role: 'CM', x: 32, y: 58 }, { role: 'CM', x: 50, y: 62 }, { role: 'CM', x: 68, y: 58 }, { role: 'RW', x: 88, y: 54 }, { role: 'ST', x: 38, y: 22 }, { role: 'ST', x: 62, y: 22 }] },
  { name: '4-3-2-1', description: 'هجوم مثلثي', slots: [{ role: 'GK', x: 50, y: 92 }, { role: 'LB', x: 14, y: 74 }, { role: 'CB', x: 36, y: 78 }, { role: 'CB', x: 64, y: 78 }, { role: 'RB', x: 86, y: 74 }, { role: 'CM', x: 30, y: 56 }, { role: 'CM', x: 50, y: 62 }, { role: 'CM', x: 70, y: 56 }, { role: 'CAM', x: 36, y: 34 }, { role: 'CAM', x: 64, y: 34 }, { role: 'ST', x: 50, y: 16 }] }
];
const PLAYERS = [
  ['Lionel Messi','RW','الأرجنتين',88,80,88,90,92,45,60],['Cristiano Ronaldo','ST','البرتغال',86,82,90,78,85,40,78],['Kylian Mbappé','ST','فرنسا',90,97,90,80,92,45,78],['Erling Haaland','ST','النرويج',91,89,94,66,80,45,90],['Kevin De Bruyne','CAM','بلجيكا',88,72,86,94,88,64,74],['Rodri','CM','إسبانيا',89,68,78,88,86,88,84],['Jude Bellingham','CAM','إنجلترا',87,80,84,86,88,78,84],['Vinícius Júnior','LW','البرازيل',89,95,82,78,92,40,70],['Mohamed Salah','RW','مصر',89,90,88,82,90,45,76],['Harry Kane','ST','إنجلترا',89,72,92,84,86,50,82],['Robert Lewandowski','ST','بولندا',87,76,91,78,84,45,84],['Alisson Becker','GK','البرازيل',89,86,30,78,40,50,88],['Thibaut Courtois','GK','بلجيكا',89,80,25,70,35,45,90],['Virgil van Dijk','CB','هولندا',88,78,60,78,72,90,88],['Antonio Rüdiger','CB','ألمانيا',86,82,50,72,70,87,86],['William Saliba','CB','فرنسا',85,84,45,70,68,86,82],['Achraf Hakimi','RB','المغرب',86,92,76,80,84,78,78],['Alphonso Davies','LB','كندا',84,94,68,78,82,76,74],['Trent Alexander-Arnold','RB','إنجلترا',86,76,78,90,84,76,72],['Luka Modrić','CM','كرواتيا',85,70,76,89,88,76,66],['Toni Kroos','CM','ألمانيا',86,62,80,92,86,78,66],['Federico Valverde','CM','أوروغواي',87,84,82,86,84,82,86],['Pedri','CM','إسبانيا',85,72,70,88,90,70,64],['Florian Wirtz','CAM','ألمانيا',87,82,82,88,90,60,68],['Jamal Musiala','CAM','ألمانيا',86,86,80,84,92,58,64],['Bukayo Saka','RW','إنجلترا',86,84,82,84,88,54,70],['Phil Foden','LW','إنجلترا',86,86,82,84,90,54,66],['Cole Palmer','CAM','إنجلترا',84,76,84,86,88,58,66],['Victor Osimhen','ST','نيجيريا',87,94,88,70,84,42,84],['Lautaro Martínez','ST','الأرجنتين',87,84,88,78,86,52,82],['Julián Álvarez','ST','الأرجنتين',85,86,86,80,86,50,76],['Antoine Griezmann','ST','فرنسا',86,78,86,86,88,52,70],['Neymar Jr','LW','البرازيل',86,88,82,86,94,42,62],['Luis Suárez','ST','أوروغواي',82,70,86,78,84,44,78],['Karim Benzema','ST','فرنسا',86,78,88,82,86,48,78],['Son Heung-min','LW','كوريا الجنوبية',86,88,86,80,86,44,72],['Rafael Leão','LW','البرتغال',84,92,80,76,88,40,70],['Khvicha Kvaratskhelia','LW','جورجيا',85,88,82,80,90,42,68],['Martin Ødegaard','CAM','النرويج',86,76,80,88,88,62,64],['Bruno Fernandes','CAM','البرتغال',86,74,84,88,86,62,72],['Declan Rice','CM','إنجلترا',85,78,74,84,80,84,82],['Alexis Mac Allister','CM','الأرجنتين',85,74,78,86,82,80,76],['Rúben Dias','CB','البرتغال',87,72,50,76,70,89,86],['Alessandro Bastoni','CB','إيطاليا',86,76,48,76,70,87,84],['Theo Hernández','LB','فرنسا',85,92,76,80,84,78,80],['Denzel Dumfries','RB','هولندا',84,88,74,78,80,78,82],['Mike Maignan','GK','فرنسا',86,82,25,72,38,48,86],['Ederson Moraes','GK','البرازيل',86,84,30,76,40,46,84],['Mohamed Elneny','CM','مصر',78,68,70,80,78,74,68],['Omar Marmoush','ST','مصر',82,90,82,76,84,44,74],['Mohamed Abdelmonem','CB','مصر',79,78,45,70,66,80,78],['Ahmed Hegazi','CB','مصر',77,66,48,68,64,79,80]
].map((p, i) => ({ id: 'p' + (i + 1), name: p[0], position: p[1], nation: p[2], rating: p[3], pace: p[4], shooting: p[5], passing: p[6], dribbling: p[7], defending: p[8], physical: p[9] }));
const SEED_PLANS = [
  { id: 'free', code: 'free', name: 'FREE', tagline: 'ابدأ مجانًا', price: 0, durationDays: 365, features: ['تحليل أساسي للتشكيلة', 'بناء التشكيلة على الملعب', 'نصائح محدودة (3 يوميًا)', 'حفظ تشكيلة واحدة', 'سجل مباريات أساسي'], isActive: true, isPublic: true, sortOrder: 1 },
  { id: 'pro', code: 'pro', name: 'PRO', tagline: 'القوة الكاملة للذكاء الاصطناعي', price: 149, durationDays: 30, features: ['تحليل متقدم للتشكيلة والصور', 'مساعد ذكي متقدم غير محدود', 'تقارير مفصلة قابلة للحفظ', 'حفظ تشكيلات متعددة', 'سجل مباريات متقدم + تحليل', 'أدوات تحليل إضافية ومقارنة الفرق'], isActive: true, isPublic: true, sortOrder: 2 }
];
const SEED_PRODUCTS = [
  { id: 's1', name: 'تحليل تشكيلة متقدم + تقرير', shortDescription: 'تقرير مفصّل بنقاط القوة والضعف وخطة اللعب', description: 'خدمة تحليل رقمية متكاملة لتشكيلتك.', details: ['تحليل كامل لكل خط', 'تقييم التوافق بين المراكز', 'خطة لعب مقترحة', 'تقرير منظم'], price: 99, imageUrl: 'images/service-analysis.jpg', category: 'analysis', badge: 'الأكثر طلبًا', isActive: true, sortOrder: 1 },
  { id: 's2', name: 'مراجعة فيديو مباراة', shortDescription: 'شاهد مبارياتك وحلّلها مع خبير تكتيكي', description: 'مراجعة فيديو احترافية لمبارياتك.', details: ['مراجعة فيديو حتى 10 دقائق', 'تحديد أخطاء المباراة', 'توصيات تكتيكية', 'ملاحظات مكتوبة'], price: 149, imageUrl: 'images/efootball-hero.jpg', category: 'analysis', badge: '', isActive: true, sortOrder: 2 },
  { id: 's3', name: 'بناء تشكيلة احترافية مخصصة', shortDescription: 'تشكيلة كاملة مبنية على لاعبك وأسلوبك', description: 'تشكيلة مخصصة بالكامل.', details: ['اختيار الخطة المناسبة', 'توزيع اللاعبين', 'بدائل مقترحة', 'شرح طريقة اللعب'], price: 79, imageUrl: 'images/bg-stadium.jpg', category: 'squad', badge: '', isActive: true, sortOrder: 3 },
  { id: 's4', name: 'خطة تطوير لاعبين 30 يوم', shortDescription: 'هدف أسبوعي وتمارين عملية لكل لاعب', description: 'خطة تطوير عملية لمدة شهر.', details: ['خطة 4 أسابيع', 'تدريبات يومية', 'متابعة أسبوعية', 'تعديل الخطة'], price: 199, imageUrl: 'images/service-training.jpg', category: 'coaching', badge: 'PRO', isActive: true, sortOrder: 4 },
  { id: 's5', name: 'تحليل صورة تشكيلة + خطة لعب', shortDescription: 'ارفع صورة تشكيلتك واحصل على خطة جاهزة', description: 'تحليل صورة تشكيلة.', details: ['قراءة المراكز', 'تقييم عام', 'أفضل توزيع', 'خطة لعب'], price: 49, imageUrl: 'images/icon.png', category: 'analysis', badge: '', isActive: true, sortOrder: 5 },
  { id: 's6', name: 'جلسة استشارية تكتيكية 30 دقيقة', shortDescription: 'جلسة أونلاين مع خبير eFootball', description: 'جلسة استشارية مباشرة.', details: ['جلسة 30 دقيقة', 'مناقشة فريقك', 'خطة مكتوبة', 'متابعة أسبوع'], price: 249, imageUrl: 'images/service-consultation.jpg', category: 'coaching', badge: 'مباشر', isActive: true, sortOrder: 6 }
];
const SEED_SETTINGS = {
  platformName: 'PES AI PRO', tagline: 'YOUR TEAM. YOUR POWER. YOUR AI.', whatsappNumber: '', telegramUrl: '', supportEmail: 'support@pesai.pro',
  announcement: 'مرحبًا بك في PES AI PRO — منصة تحليل الفرق والتشكيلات بالذكاء الاصطناعي.',
  paymentsNote: 'الدفع الحالي يدوي بالمراجعة: أرسل رقم العملية بعد التحويل وسيتم تفعيل الطلب من الإدارة.',
  instapayHandle: 'pesai.pro@instapay', vodafoneCash: '01000000000', aiModel: 'gpt-4o-mini', aiEnabled: false
};

/* ------------------------------- analysis engine ------------------------------- */
const ROLE_FIT = {
  GK: { GK: 100 }, CB: { CB: 100, LB: 74, RB: 74, CM: 58, CAM: 45, ST: 32, LW: 30, RW: 30 },
  LB: { LB: 100, RB: 80, CB: 72, LW: 70, CM: 62, CAM: 55, ST: 35, RW: 45, GK: 15 },
  RB: { RB: 100, LB: 80, CB: 72, RW: 70, CM: 62, CAM: 55, ST: 35, LW: 45, GK: 15 },
  CM: { CM: 100, CAM: 84, CB: 60, LB: 62, RB: 62, LW: 64, RW: 64, ST: 52, GK: 15 },
  CAM: { CAM: 100, CM: 84, ST: 72, LW: 78, RW: 78, LB: 55, RB: 55, CB: 45, GK: 12 },
  LW: { LW: 100, RW: 84, ST: 80, CAM: 74, CM: 60, LB: 62, RB: 58, CB: 32, GK: 10 },
  RW: { RW: 100, LW: 84, ST: 80, CAM: 74, CM: 60, RB: 62, LB: 58, CB: 32, GK: 10 },
  ST: { ST: 100, LW: 82, RW: 82, CAM: 68, CM: 48, CB: 30, LB: 28, RB: 28, GK: 8 }
};
const ATTACK_ROLES = ['ST', 'LW', 'RW', 'CAM'], MID_ROLES = ['CM', 'CAM', 'LW', 'RW'], DEF_ROLES = ['CB', 'LB', 'RB'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const r0 = n => Math.round(n);
const fit = (p, role) => (ROLE_FIT[role] && ROLE_FIT[role][p] != null ? ROLE_FIT[role][p] : 40);
function effective(p, role) {
  const base = p.rating != null ? p.rating : 75, f = fit(p.position, role) / 100;
  const atk = avg([p.shooting, p.pace, p.dribbling].map(v => v || base));
  const mid = avg([p.passing, p.dribbling, p.defending].map(v => v || base));
  const def = avg([p.defending, p.physical].map(v => v || base));
  const roleScore = role === 'GK' ? (p.rating || 75) : (ATTACK_ROLES.includes(role) ? atk : MID_ROLES.includes(role) ? mid : def);
  return clamp(base * 0.45 + roleScore * 0.55, 30, 99) * (0.62 + 0.38 * f);
}
function analyzeLineup(formation, players) {
  const slots = (formation && formation.slots) || [], arr = Array.isArray(players) ? players : [];
  const aligned = slots.map((s, i) => (arr[i] && arr[i].name ? arr[i] : null));
  const filled = aligned.filter(Boolean);
  const bySlot = slots.map((s, i) => ({ ...s, index: i, player: aligned[i] }));
  const missing = bySlot.filter(s => !s.player).length;
  const eff = bySlot.filter(s => s.player).map(s => effective(s.player, s.role));
  const fits = bySlot.filter(s => s.player).map(s => fit(s.player.position, s.role));
  const outOfPosition = bySlot.filter(s => s.player && fit(s.player.position, s.role) < 70).map(s => ({ slot: s.role, player: s.player.name, natural: s.player.position, fit: fit(s.player.position, s.role) }));
  const unit = roles => { const arr2 = bySlot.filter(s => s.player && roles.includes(s.role)); return arr2.length ? r0(avg(arr2.map(s => effective(s.player, s.role)))) : 0; };
  const attack = unit(ATTACK_ROLES), midfield = unit(MID_ROLES), defense = unit(DEF_ROLES);
  const gkSlot = bySlot.find(s => s.role === 'GK'); const gk = gkSlot && gkSlot.player ? r0(effective(gkSlot.player, 'GK')) : 0;
  const nations = {}, leagues = {};
  bySlot.forEach(s => { if (s.player) { nations[s.player.nation] = (nations[s.player.nation] || 0) + 1; leagues[s.player.league] = (leagues[s.player.league] || 0) + 1; } });
  const links = Object.values(nations).reduce((a, n) => a + Math.max(0, n - 1) * 2, 0) + Object.values(leagues).reduce((a, n) => a + Math.max(0, n - 1), 0);
  const chemistry = clamp(r0(avg(fits) * 0.82 + Math.min(14, links) - missing * 4), 25, 99);
  const overall = clamp(r0((attack * 0.3 + midfield * 0.28 + defense * 0.27 + gk * 0.15) * (0.9 + chemistry / 1000) - missing * 2.5), 20, 99);
  const strengths = [], weaknesses = [], suggestions = [];
  const sortedUnits = [{ n: 'الهجوم', v: attack }, { n: 'الوسط', v: midfield }, { n: 'الدفاع', v: defense }, { n: 'حراسة المرمى', v: gk }].sort((a, b) => b.v - a.v);
  if (sortedUnits[0].v > 0) strengths.push(`أقوى خط في فريقك هو ${sortedUnits[0].n} بتقييم ${sortedUnits[0].v}.`);
  const stars = bySlot.filter(s => s.player && (s.player.rating || 0) >= 86).map(s => s.player.name);
  if (stars.length) strengths.push(`لاعبون من الطراز الأول: ${stars.slice(0, 4).join('، ')}.`);
  if (chemistry >= 78) strengths.push(`انسجام كيميائي مرتفع (${chemistry}).`);
  if (sortedUnits[3].v > 0 && sortedUnits[3].v < 72) weaknesses.push(`خط ${sortedUnits[3].n} يحتاج تدعيم (تقييم ${sortedUnits[3].v}).`);
  if (outOfPosition.length) weaknesses.push(`${outOfPosition.length} لاعب خارج مركزه الطبيعي: ${outOfPosition.map(o => `${o.player} (${o.natural}→${o.slot})`).join('، ')}.`);
  if (missing) weaknesses.push(`لديك ${missing} مركز فارغ.`);
  if (chemistry < 65) weaknesses.push('الانسجام منخفض — جرّب توحيد الدوري أو المركز.');
  if (!weaknesses.length) weaknesses.push('لا توجد نقاط ضعف جوهرية — حافظ على الانسجام.');
  outOfPosition.forEach(o => suggestions.push({ title: `أعد ${o.player} إلى ${o.natural}`, detail: `تدرج ${o.player} من ${o.slot} إلى ${o.natural} يرفع التوافق.`, priority: 'high' }));
  if (missing) suggestions.push({ title: 'أكمل المراكز الفارغة', detail: 'اختر لاعبًا لكل مركز متبقٍ.', priority: 'high' });
  if (attack > 0 && attack < 78) suggestions.push({ title: 'تدعيم الهجوم', detail: 'أضف مهاجمًا/جناحًا بتقييم أعلى من 82.', priority: 'medium' });
  if (midfield > 0 && midfield < 78) suggestions.push({ title: 'تدعيم الوسط', detail: 'لاعب وسط بصناعة لعب جيدة يرفع التحكم.', priority: 'medium' });
  if (defense > 0 && defense < 78) suggestions.push({ title: 'تدعيم الدفاع', detail: 'قلب دفاع بسرعة وتدخلات جيدة.', priority: 'medium' });
  if (gk > 0 && gk < 80) suggestions.push({ title: 'تدعيم حراسة المرمى', detail: 'حارس بتقييم أعلى يقلل الأهداف السهلة.', priority: 'low' });
  const paceAvg = r0(avg(filled.map(p => p.pace || 70)));
  const style = paceAvg >= 85 ? 'هجوم سريع بالضغط العالي' : paceAvg >= 78 ? 'هجوم متوازن مع بناء من الخلف' : 'بناء بطيء وسيطرة على الاستحواذ';
  const plan = `خطة مقترحة: ${style}. ابدأ بضغط متوسط، واستغل الأطراف في الهجمات المرتدة. ركّز على التمريرات القصيرة في الوسط.`;
  const confidence = clamp(r0(55 + (filled.length / Math.max(1, slots.length)) * 40 - outOfPosition.length * 2), 35, 97);
  return { overall, attack, midfield, defense, gk, chemistry, confidence, formation: formation ? formation.name : null, filled: filled.length, totalSlots: slots.length, missing, strengths, weaknesses, suggestions, plan, style, outOfPosition, verdict: overall >= 85 ? 'فريق من الطراز العالمي' : overall >= 76 ? 'فريق قوي ينافس على البطولات' : overall >= 66 ? 'فريق جيد يحتاج بعض اللمسات' : overall >= 55 ? 'فريق متوسط يحتاج تدعيمًا' : 'فريق في مرحلة البناء' };
}
function bestXI(pool, formation) {
  const slots = (formation && formation.slots) || [], used = new Set(), result = slots.map(() => null);
  const order = [...slots.keys()].sort((a, b) => (slots[a].role === 'GK' ? -1 : slots[b].role === 'GK' ? 1 : 0));
  for (const i of order) {
    let best = null, bestScore = -1;
    for (const p of pool) { if (used.has(p.id)) continue; const sc = effective(p, slots[i].role) + fit(p.position, slots[i].role) * 0.25; if (sc > bestScore) { bestScore = sc; best = p; } }
    if (best) { used.add(best.id); result[i] = best; }
  }
  return result;
}
function compareTeams(a, b) {
  const A = analyzeLineup(a.formationData, a.players), B = analyzeLineup(b.formationData, b.players);
  const rows = [{ label: 'التقييم العام', a: A.overall, b: B.overall }, { label: 'الهجوم', a: A.attack, b: B.attack }, { label: 'الوسط', a: A.midfield, b: B.midfield }, { label: 'الدفاع', a: A.defense, b: B.defense }, { label: 'المرمى', a: A.gk, b: B.gk }, { label: 'الانسجام', a: A.chemistry, b: B.chemistry }];
  const wins = rows.filter(r => r.a > r.b).length;
  return { a: A, b: B, rows, winner: wins > rows.length / 2 ? 'a' : wins < rows.length / 2 ? 'b' : 'draw', winsA: wins, winsB: rows.filter(r => r.b > r.a).length };
}

/* ------------------------------- normalizers ------------------------------- */
const normPlan = p => ({ id: p.id, code: p.code, name: p.name, tagline: p.tagline, price: p.price, durationDays: p.durationDays != null ? p.durationDays : p.duration_days, features: typeof p.features === 'string' ? JSON.parse(p.features || '[]') : toArr(p.features), isActive: p.isActive != null ? p.isActive : p.is_active, isPublic: p.isPublic != null ? p.isPublic : p.is_public, sortOrder: p.sortOrder != null ? p.sortOrder : p.sort_order });
const normProduct = p => ({ id: p.id, name: p.name, shortDescription: p.shortDescription != null ? p.shortDescription : p.short_description, description: p.description, details: typeof p.details === 'string' ? JSON.parse(p.details || '[]') : toArr(p.details), price: p.price, imageUrl: p.imageUrl != null ? p.imageUrl : p.image_url, category: p.category, badge: p.badge, isActive: p.isActive != null ? p.isActive : p.is_active, sortOrder: p.sortOrder != null ? p.sortOrder : p.sort_order });
const normTeam = t => ({ id: t.id, name: t.name, formation: t.formation, style: t.style, players: typeof t.players === 'string' ? JSON.parse(t.players || '[]') : (t.players || []), rating: t.rating, chemistry: t.chemistry, updated_at: t.updated_at != null ? t.updated_at : t.updatedAt });
const normMatch = m => ({ id: m.id, opponent: m.opponent, goals_for: m.goals_for != null ? m.goals_for : m.goalsFor, goals_against: m.goals_against != null ? m.goals_against : m.goalsAgainst, competition: m.competition, match_date: m.match_date != null ? m.match_date : m.matchDate, notes: m.notes, image_url: m.image_url != null ? m.image_url : m.imageUrl, created_at: m.created_at != null ? m.created_at : m.createdAt });
const normOrder = o => ({ ...o, product_name: o.product_name != null ? o.product_name : o.productName, plan_name: o.plan_name != null ? o.plan_name : o.planName, payment_method: o.payment_method != null ? o.payment_method : o.paymentMethod, payment_reference: o.payment_reference != null ? o.payment_reference : o.paymentReference, admin_note: o.admin_note != null ? o.admin_note : o.adminNote, created_at: o.created_at != null ? o.created_at : o.createdAt });
const normNotification = n => ({ ...n, is_read: n.is_read != null ? n.is_read : n.isRead, created_at: n.created_at != null ? n.created_at : n.createdAt });
const normSettings = s => ({ platformName: s.platformName != null ? s.platformName : s.platform_name, tagline: s.tagline, whatsappNumber: s.whatsappNumber != null ? s.whatsappNumber : s.whatsapp_number, telegramUrl: s.telegramUrl != null ? s.telegramUrl : s.telegram_url, supportEmail: s.supportEmail != null ? s.supportEmail : s.support_email, announcement: s.announcement, paymentsNote: s.paymentsNote != null ? s.paymentsNote : s.payments_note, instapayHandle: s.instapayHandle != null ? s.instapayHandle : s.instapay_handle, vodafoneCash: s.vodafoneCash != null ? s.vodafoneCash : s.vodafone_cash, aiModel: s.aiModel != null ? s.aiModel : s.ai_model, aiEnabled: s.aiEnabled != null ? s.aiEnabled : s.ai_enabled });

/* ------------------------------- Firebase backend ------------------------------- */
class FirebaseBackend {
  constructor() { this.mode = 'firebase'; this._reg = null; this._login = null; this._recover = null; }
  db() { return fb.db; }
  auth() { return fb.auth; }
  user() { return this.auth() ? this.auth().currentUser : null; }
  /* ================== طبقة البيانات: Realtime Database ==================
     كل التعامل مع البيانات يمر من هنا: مسار → قراءة/كتابة.
     - once('value') بدل get()
     - orderByChild(...).equalTo(...) بدل where(...)
     - push() بدل add() مع مفاتيح تلقائية
     ==================================================================== */
  ref(path) { return this.db() ? this.db().ref(path) : null; }

  /* قراءة مستند واحد */
  async doc(path, retried) {
    const r = this.ref(path);
    if (!r) return null;
    try {
      const snap = await r.once('value');
      const v = snap.val();
      if (v === null || typeof v !== 'object') return null;
      return { id: path.split('/').pop(), ...v };
    } catch (e) {
      if (!retried && DB_NET_CODES.test(normDbErr(e))) { await sleep(1200); return this.doc(path, true); }
      reportDbIssue('read:' + path, e);
      return null;
    }
  }

  /* قراءة قائمة مفلترة (مكافئ where(child, '==', value)) */
  async list(path, child, value, retried) {
    const r = this.ref(path);
    if (!r) return [];
    try {
      const snap = await r.orderByChild(child).equalTo(value).once('value');
      const out = [];
      snap.forEach(c => { out.push({ id: c.key, ...c.val() }); });
      return out;
    } catch (e) {
      if (!retried && DB_NET_CODES.test(normDbErr(e))) { await sleep(1200); return this.list(path, child, value, true); }
      reportDbIssue('query:' + path, e);
      return [];
    }
  }

  async _set(path, data) { const r = this.ref(path); if (r) await r.set(data); return path.split('/').pop(); }
  async _update(path, data) { const r = this.ref(path); if (r) await r.update(data); return true; }
  async _push(path, data) { const r = this.ref(path).push(); await r.set(data); return r.key; }
  async _remove(path) { const r = this.ref(path); if (r) await r.remove(); return true; }
  /* حذف/تعديل عدة مسارات في عملية واحدة */
  async _multi(updates) {
    const keys = Object.keys(updates);
    if (!keys.length) return false;
    await this.db().ref().update(updates);
    return true;
  }
  async profile() {
    try {
      const u = this.user();
      return u ? this.doc('users/' + u.uid) : null;
    } catch (e) {
      return null;
    }
  }
  async settings() {
    try {
      const s = await this.doc('settings/public');
      return s || { ...SEED_SETTINGS };
    } catch (e) {
      return { ...SEED_SETTINGS };
    }
  }
  async planInfo(profile) {
    if (!profile) return { plan: SEED_PLANS[0], subscription: null, isPro: false };
    const plans = await this.getPlans();
    const isPro = profile.plan === 'pro' && profile.plan_expires_at && new Date(profile.plan_expires_at.replace(' ', 'T')) > new Date();
    const plan = plans.find(p => p.code === (isPro ? 'pro' : 'free')) || plans[0];
    return { plan, subscription: isPro ? { status: 'active', expires_at: profile.plan_expires_at } : null, isPro };
  }
  async publicUser(profile) {
    if (!profile) return null;
    return { id: profile.id || this.user()?.uid, name: profile.name, phone: profile.phone, email: profile.email, has_pin: !!profile.pin_hash, status: profile.status || 'active', plan: profile.plan || 'free', plan_expires_at: profile.plan_expires_at || null, ai_usage_count: profile.ai_usage_count || 0, created_at: profile.created_at, last_login_at: profile.last_login_at };
  }
  async bootstrap() {
    try {
      const [s, plans, products] = await Promise.all([this.settings(), this.getPlans(), this.getProducts()]);
      return { settings: this.normSettings(s), plans, products, auth: { user: null } };
    } catch (e) {
      return { settings: this.normSettings(SEED_SETTINGS), plans: SEED_PLANS, products: SEED_PRODUCTS, auth: { user: null } };
    }
  }
  normSettings(s) {
    return { platform_name: s.platformName || s.platform_name || 'PES AI PRO', tagline: s.tagline || 'YOUR TEAM. YOUR POWER. YOUR AI.', whatsapp_number: s.whatsappNumber || s.whatsapp_number || '', telegram_url: s.telegramUrl || s.telegram_url || '', support_email: s.supportEmail || s.support_email || 'support@pesai.pro', announcement: s.announcement || '', payments_note: s.paymentsNote || s.payments_note || '', instapay_handle: s.instapayHandle || s.instapay_handle || '', vodafone_cash: s.vodafoneCash || s.vodafone_cash || '', ai_model: s.aiModel || s.ai_model || 'gpt-4o-mini', ai_enabled: !!s.aiEnabled };
  }
  async me() {
    try {
      const u = this.user(); if (!u) return { user: null };
      const p = await this.profile(); if (!p) return { user: null };
      return { user: await this.publicUser(p), plan: await this.planInfo(p) };
    } catch (e) {
      return { user: null };
    }
  }
  async hashPin(pin, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async makePin(pin) { const salt = uid(); return { pin_hash: await this.hashPin(pin, salt), pin_salt: salt }; }
  async verifyPin(pin, hash, salt) { return hash === (await this.hashPin(pin, salt)); }
  recaptcha() {
    if (!SDK_OK) throw new Error('خدمات Firebase غير متاحة');
    if (!document.getElementById('recaptcha-container')) {
      const box = document.createElement('div');
      box.id = 'recaptcha-container';
      box.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:1px;overflow:hidden';
      document.body.appendChild(box);
    }
    if (this._verifier) { try { this._verifier.clear(); } catch (e) { } }
    this._verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
    return this._verifier;
  }
  /* غلاف موحّد لطلبات الهاتف: يمنع تعليق الواجهة ويرجّع رسالة مفهومة */
  async _phoneStart(phone) {
    try {
      if (!SDK_OK) return { error: 'خدمات Firebase لم تُحمَّل. تحقق من الاتصال بالإنترنت ثم حدّث الصفحة.' };
      const verifier = this.recaptcha();
      const confirmation = await withTimeout(this.auth().signInWithPhoneNumber(phone, verifier), 45000);
      return { confirmation };
    } catch (err) {
      return { error: fbErrMsg(err) };
    }
  }
  async startRegister(data) {
    const r = await this._phoneStart(data.phone);
    if (r.error) return { error: r.error };
    this._reg = { confirmation: r.confirmation, data };
    return { requires_otp: true, delivery: { delivered: true, channel: 'sms' }, message: 'أدخل رمز التحقق المرسل إلى هاتفك' };
  }
  async confirmRegister(code) {
    if (!this._reg) return { error: 'انتهت جلسة التحقق، أعد المحاولة من البداية' };
    let cred;
    try { cred = await withTimeout(this._reg.confirmation.confirm(code), 30000); }
    catch (err) { return { error: fbErrMsg(err) }; }
    const u = cred.user, d = this._reg.data;
    try {
      const existing = await withTimeout(this.doc('users/' + u.uid), 8000);
      if (existing) {
        await this.auth().signOut();
        this._reg = null;
        return { error: 'هذا الرقم مسجّل بالفعل — استخدم تبويب «تسجيل الدخول».' };
      }
      const pin = d.pin ? await this.makePin(d.pin) : {};
      const profile = { id: u.uid, name: d.name, phone: d.phone, email: d.email, pin_hash: pin.pin_hash || null, pin_salt: pin.pin_salt || null, status: 'active', plan: 'free', plan_expires_at: null, ai_usage_count: 0, created_at: nowStr(), last_login_at: nowStr() };
      await this._set('users/' + u.uid, profile);
      await this._set('userSettings/' + u.uid, { notify_orders: true, notify_subscription: true, notify_platform: true, notify_ai: true, public_stats: false, marketing: false }).catch(() => { });
      await this._push('notifications', { userId: u.uid, type: 'welcome', title: `أهلًا بك في PES AI PRO <span class="svg-icon">${I.party}</span>`, body: 'تم إنشاء حسابك بنجاح. ابدأ ببناء تشكيلتك أو حلّل فريقك.', link: '#/builder', is_read: false, created_at: nowStr() }).catch(() => { });
      this._reg = null;
      return { user: await this.publicUser(profile), plan: await this.planInfo(profile) };
    } catch (err) {
      return { error: fbErrMsg(err) };
    }
  }
  async startLogin(data) {
    const r = await this._phoneStart(data.phone);
    if (r.error) return { error: r.error };
    this._login = { confirmation: r.confirmation, name: data.name, phone: data.phone, pin: data.pin };
    return { requires_otp: true, delivery: { delivered: true, channel: 'sms' }, message: 'أدخل رمز التحقق المرسل إلى هاتفك' };
  }
  async confirmLogin(code) {
    if (!this._login) return { error: 'انتهت جلسة التحقق، أعد المحاولة من البداية' };
    let cred;
    try { cred = await withTimeout(this._login.confirmation.confirm(code), 30000); }
    catch (err) { return { error: fbErrMsg(err) }; }
    try {
      const u = cred.user, p = await withTimeout(this.doc('users/' + u.uid), 8000);
      if (!p) { await this.auth().signOut(); return { error: 'لا يوجد ملف شخصي لهذا الرقم. أنشئ حسابًا جديدًا.' }; }
      if (p.status === 'suspended') { await this.auth().signOut(); return { error: 'الحساب موقوف. تواصل مع الدعم.' }; }
      /* الرقم موثّق بـ OTP بالفعل: اختلاف كتابة الاسم لا يجب أن يمنع الدخول */
      if (p.pin_hash) {
        if (!this._login.pin) { this._login.uid = u.uid; this._login.profile = p; return { requires_pin: true, name: p.name }; }
        if (!(await this.verifyPin(this._login.pin, p.pin_hash, p.pin_salt))) { await this.auth().signOut(); return { error: 'الرمز السري غير صحيح' }; }
      }
      await this._update('users/' + u.uid, { last_login_at: nowStr() }).catch(() => { });
      this._login = null;
      return { user: await this.publicUser(p), plan: await this.planInfo(p) };
    } catch (err) {
      return { error: fbErrMsg(err) };
    }
  }
  async verifyLoginPin(pin) {
    if (!this._login || !this._login.profile) return { error: 'انتهت الجلسة، أعد المحاولة' };
    const p = this._login.profile;
    if (!/^\d{4}$/.test(String(pin || ''))) return { error: 'الرمز السري 4 أرقام' };
    if (!(await this.verifyPin(pin, p.pin_hash, p.pin_salt))) { await this.auth().signOut(); return { error: 'الرمز السري غير صحيح' }; }
    try { await this._update('users/' + this._login.uid, { last_login_at: nowStr() }); } catch (e) { }
    const res = { user: await this.publicUser(p), plan: await this.planInfo(p) };
    this._login = null; return res;
  }
  async logout() { if (this.auth()) await this.auth().signOut(); }
  async loginWithGoogle() {
    try {
      if (!SDK_OK) return { error: 'خدمات Firebase لم تُحمَّل. تحقق من الاتصال ثم حدّث الصفحة.' };
      try { await this.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) { }
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await withTimeout(this.auth().signInWithPopup(provider), 90000);
      const u = cred.user;
      let p = null;
      try {
        const existing = await withTimeout(this._once('users/' + u.uid), 4000).catch(() => null);
        if (!existing) {
          p = { id: u.uid, name: u.displayName || 'مستخدم Google', phone: u.phoneNumber || '', email: u.email || '', pin_hash: null, pin_salt: null, status: 'active', plan: 'free', plan_expires_at: null, ai_usage_count: 0, created_at: nowStr(), last_login_at: nowStr() };
          await this._set('users/' + u.uid, p).catch(() => { });
          await this._set('userSettings/' + u.uid, { notify_orders: true, notify_subscription: true, notify_platform: true, notify_ai: true, public_stats: false, marketing: false }).catch(() => { });
          await this._push('notifications', { userId: u.uid, type: 'welcome', title: `أهلًا بك في PES AI PRO <span class="svg-icon">${I.party}</span>`, body: 'تم إنشاء حسابك عبر Google بنجاح. ابدأ ببناء تشكيلتك أو حلّل فريقك.', link: '#/builder', is_read: false, created_at: nowStr() }).catch(() => { });
        } else {
          p = existing;
          await this._update('users/' + u.uid, { last_login_at: nowStr() }).catch(() => { });
        }
      } catch (e) {
        p = { id: u.uid, name: u.displayName || 'مستخدم Google', phone: u.phoneNumber || '', email: u.email || '', status: 'active', plan: 'free', created_at: nowStr(), last_login_at: nowStr() };
      }
      const pub = await this.publicUser(p);
      const planInfo = await this.planInfo(p);
      const res = { user: pub, plan: planInfo };
      localStorage.setItem('pesai_user', JSON.stringify(pub));
      return res;
    } catch (err) {
      return { error: fbErrMsg(err) || 'فشل تسجيل الدخول بواسطة Google' };
    }
  }
  async updateProfile(d) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    await this._update('users/' + u.uid, { name: d.name, email: d.email, phone: d.phone });
    return { user: await this.publicUser(await this.profile()), plan: await this.planInfo(await this.profile()) };
  }
  async setPin(d) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const p = await this.profile();
    if (p.pin_hash && !(await this.verifyPin(d.current, p.pin_hash, p.pin_salt))) return { error: 'الرمز الحالي غير صحيح' };
    const pin = await this.makePin(d.pin);
    await this._update('users/' + u.uid, { pin_hash: pin.pin_hash, pin_salt: pin.pin_salt });
    return { message: 'تم حفظ الرمز السري' };
  }
  async removePin(d) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const p = await this.profile();
    if (p.pin_hash && !(await this.verifyPin(d.current, p.pin_hash, p.pin_salt))) return { error: 'الرمز الحالي غير صحيح' };
    await this._update('users/' + u.uid, { pin_hash: null, pin_salt: null });
    return { message: 'تمت إزالة الرمز' };
  }
  async getPlans() {
    try {
      const plans = await this.list('plans', 'isActive', true);
      return plans.length ? plans.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) : SEED_PLANS;
    } catch (e) {
      return SEED_PLANS;
    }
  }
  async getProducts() {
    try {
      const prods = await this.list('products', 'isActive', true);
      return prods.length ? prods.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) : SEED_PRODUCTS;
    } catch (e) {
      return SEED_PRODUCTS;
    }
  }
  async getFormations() { return { formations: FORMATIONS }; }
  async getPlayers(q) { return { players: PLAYERS.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.position.includes(q.toUpperCase())) }; }
  async getTeams() {
    const u = this.user(); if (!u) return { teams: [] };
    const teams = await this.list('teams', 'userId', u.uid);
    return { teams: teams.map(t => ({ ...t, players: toArr(t.players) })).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))) };
  }
  async saveTeam(t) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const f = FORMATIONS.find(x => x.name === t.formation) || FORMATIONS[0];
    const players = Array.isArray(t.players) ? t.players.slice(0, 11).map(p => p ? { name: p.name, position: p.position, rating: p.rating, pace: p.pace, shooting: p.shooting, passing: p.passing, dribbling: p.dribbling, defending: p.defending, physical: p.physical, nation: p.nation || '', league: p.league || '' } : null) : [];
    if (!players.some(p => p && p.name)) return { error: 'أضف لاعبًا واحدًا على الأقل' };
    const a = analyzeLineup(f, players);
    const data = { userId: u.uid, name: t.name || 'تشكيلتي', formation: t.formation, style: t.style || '', players, rating: a.overall, chemistry: a.chemistry, updated_at: nowStr() };
    if (t.id) { await this._update('teams/' + t.id, data); return { id: t.id, analysis: a, message: 'تم تحديث التشكيلة' }; }
    const key = await this._push('teams', { ...data, created_at: nowStr() });
    return { id: key, analysis: a, message: 'تم حفظ التشكيلة' };
  }
  async deleteTeam(id) { await this._remove('teams/' + id); return { message: 'تم الحذف' }; }
  async compareTeams(a, b) {
    const [ta, tb] = await Promise.all([this.doc('teams/' + a), this.doc('teams/' + b)]);
    if (!ta || !tb) return { error: 'التشكيلة غير موجودة' };
    ta.players = toArr(ta.players); tb.players = toArr(tb.players);
    const fa = FORMATIONS.find(x => x.name === ta.formation) || FORMATIONS[0], fb2 = FORMATIONS.find(x => x.name === tb.formation) || FORMATIONS[0];
    return { comparison: compareTeams({ formationData: fa, players: ta.players }, { formationData: fb2, players: tb.players }), a: ta, b: tb };
  }
  async suggestTeam(formation) { const f = FORMATIONS.find(x => x.name === formation) || FORMATIONS[0]; const players = bestXI(PLAYERS, f); return { formation: f.name, players, analysis: analyzeLineup(f, players) }; }
  async getMatches() {
    const u = this.user(); if (!u) return { matches: [], stats: { played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 } };
    const matches = (await this.list('matches', 'userId', u.uid)).sort((a, b) => String(b.match_date || '').localeCompare(String(a.match_date || '')));
    return { matches, stats: this.matchStats(matches) };
  }
  matchStats(matches) {
    const wins = matches.filter(m => m.goals_for > m.goals_against).length, draws = matches.filter(m => m.goals_for === m.goals_against).length, losses = matches.filter(m => m.goals_for < m.goals_against).length;
    return { played: matches.length, wins, draws, losses, goals_for: matches.reduce((a, m) => a + (m.goals_for || 0), 0), goals_against: matches.reduce((a, m) => a + (m.goals_against || 0), 0) };
  }
  async saveMatch(m) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const key = await this._push('matches', { userId: u.uid, opponent: m.opponent, goals_for: m.goals_for, goals_against: m.goals_against, competition: m.competition || '', match_date: m.match_date || todayStr(), notes: m.notes || '', image_url: m.image_url || '', created_at: nowStr() });
    return { id: key, message: 'تم حفظ المباراة' };
  }
  async deleteMatch(id) { await this._remove('matches/' + id); return { message: 'تم الحذف' }; }
  async analyzeMatches() {
    const { matches } = await this.getMatches();
    if (!matches.length) return { error: 'سجّل مباراة واحدة على الأقل أولًا' };
    const s = this.matchStats(matches), wins = s.wins, draws = s.draws, losses = s.losses, gf = s.goals_for, ga = s.goals_against;
    const report = { record: { played: s.played, wins, draws, losses }, goals: { scored: gf, conceded: ga, avg_scored: +(gf / s.played).toFixed(2), avg_conceded: +(ga / s.played).toFixed(2) }, win_rate: Math.round(wins / s.played * 100), weaknesses: [ga > gf ? 'خط الدفاع يستقبل أهدافًا أكثر مما يسجل الفريق.' : 'الدفاع في مستوى جيد.', losses > wins ? 'الخسائر أكثر من الانتصارات؛ جرّب خطة أكثر توازنًا.' : 'سجل النتائج إيجابي.', matches.length < 5 ? 'سجل المباريات صغير — سجّل المزيد لدقة أعلى.' : 'سجل المباريات كافٍ لتحليل موثوق.'], suggestions: ['سجّل كل مباراة فور انتهائها.', 'حسّن التشكيلة بناءً على تحليل الفريق.', 'حدد هدفًا أسبوعيًا لتقليل الأهداف المستقبلة.'], team: null, engine: 'local-rules' };
    const u = this.user();
    await this._push('reports', { userId: u.uid, kind: 'match', title: 'تحليل سجل المباريات', input_summary: JSON.stringify({ matches: matches.length }), result: report, confidence: 80, engine: 'local-rules', created_at: nowStr() });
    return { report };
  }
  async usageToday() {
    const u = this.user(); if (!u) return 0;
    const reports = await this.list('reports', 'userId', u.uid);
    const today = todayStr();
    return reports.filter(d => String(d.created_at || '').slice(0, 10) === today).length;
  }
  async analyzeTeam(formation, players) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const p = await this.profile(); const pro = p.plan === 'pro' && p.plan_expires_at && new Date(p.plan_expires_at.replace(' ', 'T')) > new Date();
    const used = await this.usageToday();
    if (!pro && used >= 5) return { error: 'وصلت للحد المجاني (5 تحليلات يوميًا). قم بالترقية إلى PRO.', upgrade: true };
    const f = FORMATIONS.find(x => x.name === formation) || FORMATIONS[0];
    const a = analyzeLineup(f, players);
    await this._push('reports', { userId: u.uid, kind: 'team', title: 'تحليل تشكيلة ' + f.name, input_summary: JSON.stringify(players.map(x => ({ n: x.name, p: x.position }))), result: a, confidence: a.confidence, engine: 'rules-engine', created_at: nowStr() });
    await this._update('users/' + u.uid, { ai_usage_count: (p.ai_usage_count || 0) + 1 });
    return { analysis: a, engine: 'rules-engine', remaining: pro ? null : Math.max(0, 5 - used - 1) };
  }
  async assistant(message) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const p = await this.profile(); const pro = p.plan === 'pro' && p.plan_expires_at && new Date(p.plan_expires_at.replace(' ', 'T')) > new Date();
    const used = await this.usageToday();
    if (!pro && used >= 3) return { error: 'وصلت للحد المجاني (3 رسائل يوميًا). قم بالترقية إلى PRO.', upgrade: true };
    const [teams, { matches, stats }, plans] = await Promise.all([this.getTeams(), this.getMatches(), this.getPlans()]);
    const team = teams.teams[0]; const f = team ? (FORMATIONS.find(x => x.name === team.formation) || FORMATIONS[0]) : null;
    const reply = localAssistant(message, { user: p, plans, team, formationData: f, players: team?.players || [], record: stats, isPro: pro });
    await this._push('reports', { userId: u.uid, kind: 'assistant', title: 'محادثة المساعد', input_summary: message, result: reply, confidence: 60, engine: 'local-rules', created_at: nowStr() });
    return { reply, remaining: pro ? null : Math.max(0, 3 - used - 1) };
  }
  async createOrder(d) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const key = await this._push('orders', { userId: u.uid, type: d.type || 'product', product_id: d.product_id || null, plan_id: d.plan_id || null, quantity: d.quantity || 1, total: d.total, status: 'pending_review', payment_method: d.payment_method || 'manual', payment_reference: d.payment_reference || '', admin_note: '', created_at: nowStr(), updated_at: nowStr() });
    await this._push('notifications', { userId: u.uid, type: 'order', title: 'تم استلام طلبك', body: 'طلب #' + key + ' قيد مراجعة الدفع.', link: '#/account', is_read: false, created_at: nowStr() }).catch(() => { });
    return { order_id: key, message: 'تم إنشاء الطلب بنجاح' };
  }
  async getOrders() {
    const u = this.user(); if (!u) return { orders: [] };
    const orders = await this.list('orders', 'userId', u.uid);
    const prods = await this.getProducts(), plans = await this.getPlans();
    orders.forEach(o => { o.product_name = prods.find(p => p.id === o.product_id)?.name; o.plan_name = plans.find(p => p.id === o.plan_id)?.name; });
    return { orders: orders.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))) };
  }
  async subscribe(d) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const plans = await this.getPlans(); const plan = plans.find(p => p.id === d.plan_id);
    if (!plan) return { error: 'الباقة غير متاحة' };
    if (plan.code === 'free') return { error: 'الباقة المجانية مفعّلة تلقائيًا' };
    const key = await this._push('orders', { userId: u.uid, type: 'subscription', plan_id: plan.id, quantity: 1, total: plan.price, status: 'pending_review', payment_method: d.payment_method || 'manual', payment_reference: d.reference || '', admin_note: '', created_at: nowStr(), updated_at: nowStr() });
    await this._push('notifications', { userId: u.uid, type: 'order', title: 'طلب اشتراك قيد المراجعة', body: 'طلب #' + key + ' — ' + plan.name + '. سيتم التفعيل بعد تأكيد الدفع.', link: '#/account', is_read: false, created_at: nowStr() }).catch(() => { });
    return { order_id: key, message: 'تم إرسال الطلب. الاشتراك لا يُفعّل قبل تأكيد الدفع.' };
  }
  async getNotifications() {
    const u = this.user(); if (!u) return { notifications: [], unread: 0 };
    const notifications = (await this.list('notifications', 'userId', u.uid)).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return { notifications, unread: notifications.filter(n => !n.is_read).length };
  }
  async markNotification(id) { await this._update('notifications/' + id, { is_read: true }); return { message: 'تم' }; }
  async markAllNotifications() {
    const u = this.user(); if (!u) return { message: 'تم' };
    const items = await this.list('notifications', 'userId', u.uid);
    /* التحديث بيتم على مسار الإشعار نفسه (مش على الحقل الفرعي) عشان قواعد الأمان تقدر تقرأ userId */
    await Promise.all(items.filter(n => !n.is_read)
      .map(n => this._update('notifications/' + n.id, { is_read: true }).catch(() => { })));
    return { message: 'تم' };
  }
  async uploadImage(file) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    if (file && file.size > 4 * 1024 * 1024) return { error: 'حجم الصورة أكبر من 4MB — اضغطها أولًا.' };
    try {
      const path = `uploads/${u.uid}/${Date.now()}-${file.name}`;
      const storage = await storageService();
      const s = await withTimeout(storage.ref(path).put(file), 45000);
      return { url: await s.ref.getDownloadURL() };
    } catch (err) {
      return { error: fbErrMsg(err) };
    }
  }
  async analyzeImage() { return { needs_key: true, error: 'تحليل الصور بالذكاء الاصطناعي يحتاج دالة خادم (Firebase Function) مع مفتاح AI. يمكنك إدخال التشكيلة يدويًا والحصول على التحليل الكامل.' }; }
  async getReports() { const u = this.user(); if (!u) return { reports: [] }; const reports = await this.list('reports', 'userId', u.uid); return { reports: reports.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 40) }; }
  async updateSettings(d) { const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' }; await this._update('userSettings/' + u.uid, d); return { settings: d, message: 'تم حفظ الإعدادات' }; }
  async getSettings() { const u = this.user(); if (!u) return { settings: {} }; const s = await this.doc('userSettings/' + u.uid); return { settings: s || {} }; }
  async deleteAccount(d) {
    const u = this.user(); if (!u) return { error: 'يجب تسجيل الدخول' };
    const p = await this.profile();
    if (p.pin_hash && !(await this.verifyPin(d.pin || '', p.pin_hash, p.pin_salt))) return { error: 'الرمز السري غير صحيح' };
    const uid = u.uid;
    const updates = {};
    for (const col of ['teams', 'matches', 'orders', 'notifications', 'reports']) {
      const items = await this.list(col, 'userId', uid);
      items.forEach(x => { updates[col + '/' + x.id] = null; });
    }
    updates['users/' + uid] = null;
    updates['userSettings/' + uid] = null;
    await this._multi(updates);
    await u.delete();
    return { message: 'تم حذف الحساب' };
  }
  async recoverRequest(d) {
    const r = await this._phoneStart(d.phone);
    if (r.error) return { error: r.error };
    this._recover = { confirmation: r.confirmation, phone: d.phone };
    return { requires_otp: true, delivery: { delivered: true, channel: 'sms' }, message: 'أدخل رمز التحقق' };
  }
  async recoverVerify(d) {
    if (!this._recover) return { error: 'انتهت جلسة التحقق، أعد المحاولة من البداية' };
    let cred;
    try { cred = await withTimeout(this._recover.confirmation.confirm(d.otp), 30000); }
    catch (err) { return { error: fbErrMsg(err) }; }
    try {
      const p = await withTimeout(this.doc('users/' + cred.user.uid), 8000);
      if (!p) { await this.auth().signOut(); return { error: 'لا يوجد حساب بهذا الرقم' }; }
      if (d.pin) { const pin = await this.makePin(d.pin); await this._update('users/' + cred.user.uid, { pin_hash: pin.pin_hash, pin_salt: pin.pin_salt }); }
      else await this._update('users/' + cred.user.uid, { pin_hash: null, pin_salt: null });
      this._recover = null;
      return { user: await this.publicUser(p), plan: await this.planInfo(p), message: 'تمت استعادة الحساب' };
    } catch (err) {
      return { error: fbErrMsg(err) };
    }
  }
}
let Backend = new FirebaseBackend();
function withTimeout(p, ms) { try { p.catch(() => {}); } catch (e) { } return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms))]); }
/* ------------------------------- state + routing ------------------------------- */
const state = { user: null, plan: null, settings: {}, plans: [], products: [], formations: FORMATIONS, players: PLAYERS, teams: [], matches: [], orders: [], notifications: [], cart: JSON.parse(localStorage.getItem('pesai_cart') || '[]'), route: 'home', params: {}, booted: false, authReady: false };
const PROTECTED = ['analyzer', 'builder', 'assistant', 'matches', 'account', 'player'];
const set = (k, v) => { state[k] = v; };
let pendingRoute = null;
function saveCart() { localStorage.setItem('pesai_cart', JSON.stringify(state.cart)); }
function isPro() { return !!(state.user && state.user.plan === 'pro' && state.plan?.isPro); }
function navigate(route) { if (location.hash === '#/' + route) { renderRoute(); } else { location.hash = '#/' + route; } }
function goProtected(route) {
  if (state.user) { navigate(route); return; }
  if (!state.authReady) { pendingRoute = route; toast('لحظة… جارٍ التحقق من جلستك'); renderRoute(); return; }
  toast('سجّل الدخول أولًا للوصول إلى هذه الأداة', 'err');
  navigate('auth?next=' + route);
}
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [route, qs] = raw.split('?');
  return { route: route || 'home', params: new URLSearchParams(qs || '') };
}
async function boot() {
  if (state.booted) return; state.booted = true;
  loading(false);

  state.settings = Backend.normSettings(SEED_SETTINGS);
  state.plans = SEED_PLANS;
  state.products = SEED_PRODUCTS;
  state.formations = FORMATIONS;
  state.players = PLAYERS;

  /* 1) عرض فوري من الكاش المحلي — بدون انتظار أي طلب شبكة */
  try {
    const cachedBoot = JSON.parse(localStorage.getItem('pesai_boot') || 'null');
    if (cachedBoot && (Date.now() - (cachedBoot.at || 0) < 6 * 3600e3)) {
      if (cachedBoot.settings) state.settings = cachedBoot.settings;
      if (cachedBoot.plans && cachedBoot.plans.length) state.plans = cachedBoot.plans;
      if (cachedBoot.products && cachedBoot.products.length) state.products = cachedBoot.products;
    }
  } catch (e) { }
  try {
    const cachedUser = localStorage.getItem('pesai_user');
    if (cachedUser) {
      state.user = JSON.parse(cachedUser);
      const cachedPlan = localStorage.getItem('pesai_plan');
      if (cachedPlan) state.plan = JSON.parse(cachedPlan);
    }
  } catch (e) { }

  initSplash();
  renderShell();
  renderRoute();

  if (!SDK_OK) {
    state.authReady = true;
    toast('تعذر تحميل خدمات Firebase (شبكة/حجب). تحقق من الاتصال ثم حدّث الصفحة', 'err');
    renderRoute();
    return;
  }
  if (!fb.db) {
    toast('تعذر الاتصال بـ Realtime Database — راجع databaseURL في إعدادات المشروع', 'err');
  }

  /* 2) بالتوازي: بيانات المنصة + التحقق من الجلسة (بدل التسلسل البطيء) */
  refreshPublicData();
  watchAuth();

  /* 3) صمّام أمان: لا نُبقي المستخدم على شاشة "جارٍ التحقق" أكثر من 9 ثوانٍ */
  setTimeout(() => {
    if (!state.authReady) { state.authReady = true; renderShell(); renderRoute(); }
  }, 9000);
}

let _publicBusy = false;
async function refreshPublicData() {
  if (_publicBusy) return; _publicBusy = true;
  try {
    const data = await withTimeout(Backend.bootstrap(), 12000);
    if (!data) return;
    if (data.settings) state.settings = data.settings;
    if (data.plans && data.plans.length) state.plans = data.plans;
    if (data.products && data.products.length) state.products = data.products;
    try {
      localStorage.setItem('pesai_boot', JSON.stringify({ at: Date.now(), settings: state.settings, plans: state.plans, products: state.products }));
    } catch (e) { }
    renderShell();
    safeRerenderView();
  } catch (e) {
    console.warn('bootstrap skipped:', e && e.message);
  } finally { _publicBusy = false; }
}

/* إعادة رسم الصفحة الحالية بأمان — لا تمسح نموذجًا يكتب فيه المستخدم */
function safeRerenderView() {
  const el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  if (state.route === 'auth') return;
  renderRoute();
}

let _authWatchStarted = false;
function watchAuth() {
  if (!SDK_OK || !fb.auth || _authWatchStarted) { state.authReady = true; return; }
  _authWatchStarted = true;
  let firstCallback = true;
  fb.auth.onAuthStateChanged(async user => {
    const prevId = state.user ? state.user.id : null;
    /* مهم: أول نداء قد يكون null قبل أن يُكمل Firebase استرجاع الجلسة من الجهاز.
       لا نُسجّل خروج المستخدم فورًا — ننتظر ونعيد التحقق. */
    if (!user && firstCallback && state.user) {
      firstCallback = false;
      state.authReady = true;
      renderShell();
      const cur0 = parseHash().route;
      if (cur0 !== 'auth') renderRoute();
      setTimeout(() => {
        if (fb.auth && !fb.auth.currentUser) {
          state.user = null; state.plan = null; clearSession();
          renderShell(); renderRoute();
        }
      }, 3500);
      return;
    }
    firstCallback = false;
    try {
      if (user) {
        if (!prevId || prevId !== user.uid) {
          const p = await withTimeout(Backend.doc('users/' + user.uid), 8000).catch(() => null);
          if (p) {
            state.user = await Backend.publicUser(p);
            state.plan = await Backend.planInfo(p);
            persistSession();
          } else if (!state.user && !Backend._reg) {
            /* حساب Firebase بدون ملف شخصي (فشل إنشاء الملف سابقًا) — نُنشئه الآن بدون مسح بيانات موجودة */
            const fallback = { id: user.uid, name: user.displayName || 'مستخدم', phone: user.phoneNumber || '', email: user.email || '', status: 'active', plan: 'free', created_at: nowStr(), last_login_at: nowStr() };
            await withTimeout(Backend._update('users/' + user.uid, fallback), 8000).catch(() => { });
            state.user = await Backend.publicUser(fallback);
            state.plan = await Backend.planInfo(fallback);
            persistSession();
          }
        } else {
          /* نفس المستخدم: تحديث الباقة في الخلفية بدون تعطيل الواجهة */
          Backend.doc('users/' + user.uid)
            .then(p => p && Backend.planInfo(p).then(pl => { state.plan = pl; persistSession(); }).catch(() => { }))
            .catch(() => { });
        }
      } else {
        state.user = null; state.plan = null; clearSession();
      }
    } catch (e) {
      console.warn('auth sync failed:', e && e.message);
      /* لا نمسح الجلسة المحفوظة عند فشل الشبكة المؤقت */
    } finally {
      state.authReady = true;
      renderShell();
      const cur = parseHash().route;
      if (cur !== 'auth') renderRoute();
      else if (state.user) navigate('home');
      if (state.user && pendingRoute) { const r = pendingRoute; pendingRoute = null; navigate(r); }
    }
  }, err => {
    console.warn('auth listener error:', err && err.message);
    state.authReady = true;
    renderRoute();
  });
}
function renderShell() {
  const bg = $('#bg-root');
  if (bg && !bg.dataset.done) { bg.dataset.done = '1'; bg.innerHTML = `<div class="bg-layer"><img src="images/bg-stadium.jpg" alt="خلفية الملعب"></div><div class="orb g1"></div><div class="orb g2"></div>`; }
  const u = state.user, s = state.settings;
  const top = $('#topbar');
  if (top) top.innerHTML = `<div class="topbar"><div class="container topbar-in">
    <a class="brand" href="#/home"><img src="images/icon.png" alt="PES AI PRO"><div>${esc(s.platformName || 'PES AI PRO')}<small>${esc(s.tagline || 'YOUR TEAM. YOUR POWER. YOUR AI.')}</small></div></a>
    <div class="top-actions">
      ${u ? `<button class="icon-btn" id="bellBtn" aria-label="الإشعارات">${I.bell}<span class="badge-dot hidden" id="bellDot">0</span></button><a class="avatar" href="#/account" title="${esc(u.name)}">${esc((u.name || 'U')[0])}</a>` : `<a class="btn btn-gold btn-sm" href="#/auth">دخول / إنشاء حساب</a>`}
    </div></div></div>`;
  if (u) {
    loadBell();
    const bell = $('#bellBtn');
    if (bell) bell.onclick = () => navigate('account');
  }
  const an = $('#announcement');
  if (an) an.innerHTML = s.announcement ? `<div class="announce">${I.spark}<span>${esc(s.announcement)}</span></div>` : '';
  const nav = $('#bottom-nav');
  if (nav) {
    const items = [['home', 'الرئيسية', 'home'], ['analyzer', 'تحليل الفريق', 'chart'], ['assistant', 'المساعد', 'spark'], ['store', 'المتجر', 'bag'], ['account', 'حسابي', 'user']];
    nav.innerHTML = `<div class="bottom-nav"><div class="nav-in">${items.map(([r, label, ic]) => `<a class="nav-item ${state.route === r ? 'active' : ''}" href="#/${r}">${I[ic]}<span>${label}</span></a>`).join('')}</div></div>`;
  }
}
let _bellAt = 0, _bellBusy = false;
async function loadBell(force) {
  if (!state.user || _bellBusy) return;
  if (!force && Date.now() - _bellAt < 30000) return;   /* لا نكرر نفس الطلب مع كل رسم */
  _bellBusy = true;
  try {
    const r = await withTimeout(Backend.getNotifications(), 8000);
    _bellAt = Date.now();
    const dot = $('#bellDot');
    if (dot) { dot.textContent = r.unread || 0; dot.classList.toggle('hidden', !r.unread); }
  } catch (e) { }
  finally { _bellBusy = false; }
}
function renderSessionCheck() {
  renderShell();
  const app = $('#app');
  if (!app) return;
  app.innerHTML = `<div class="container section"><div class="card center-x" style="padding:34px">
    <div class="spinner" style="width:30px;height:30px;margin:0 auto"></div>
    <p class="muted small mt12" style="margin-top:14px">جارٍ التحقق من جلستك…</p></div></div>`;
}
function renderRoute() {
  const { route, params } = parseHash();
  state.route = route; state.params = params;
  if (PROTECTED.includes(route) && !state.user) {
    /* لا نطرد المستخدم لشاشة الدخول قبل التأكد من جلسته (كان يحدث عند كل تحديث) */
    if (!state.authReady) { renderSessionCheck(); return; }
    location.replace('#/auth?next=' + route); return;
  }
  if (route === 'auth' && state.user) { location.replace('#/home'); return; }
  const views = { home: renderHome, auth: renderAuth, analyzer: renderAnalyzer, builder: renderBuilder, assistant: renderAssistant, store: renderStore, subscriptions: renderSubscriptions, matches: renderMatches, account: renderAccount, player: renderPlayer };
  const fn = views[route] || renderHome;
  renderShell();
  fn(params);
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { }
}
function initSplash() {
  const s = $('#splash'); if (!s) return;
  if (parseHash().route !== 'home' || sessionStorage.getItem('pesai_splash') === '1') { s.remove(); return; }
  const close = () => { sessionStorage.setItem('pesai_splash', '1'); s.classList.add('hide'); setTimeout(() => s.remove(), 600); };
  const skip = $('#skipIntro'); if (skip) skip.onclick = close;
  /* 3 ثوانٍ كانت تحجب المنصة بلا داعٍ — صارت ثانية واحدة */
  setTimeout(close, 1000);
}
function socialsHtml() {
  const s = state.settings, wa = String(s.whatsappNumber || '').replace(/[^\d]/g, ''), tg = s.telegramUrl || '';
  return `<div class="socials">
    ${wa ? `<a class="social-btn" href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp">${I.whatsapp}</a>` : `<button class="social-btn" data-need="whatsapp" aria-label="WhatsApp" title="لم يُضبط رقم واتساب بعد">${I.whatsapp}</button>`}
    ${tg && !tg.includes('t.me/') || (tg && tg !== 'https://t.me/') ? `<a class="social-btn" href="${esc(tg)}" target="_blank" rel="noopener" aria-label="Telegram">${I.telegram}</a>` : `<button class="social-btn" data-need="telegram" aria-label="Telegram" title="لم يُضبط رابط تليجرام بعد">${I.telegram}</button>`}
  </div>`;
}
function footerHtml() {
  return `<footer class="container footer"><div>© ${new Date().getFullYear()} ${esc(state.settings.platformName || 'PES AI PRO')} — جميع الحقوق محفوظة.</div>
    <div class="flex center gap"><span class="small muted">تواصل معنا:</span>${socialsHtml()}</div>
    <div class="small muted">مدعوم بـ Firebase Auth + Realtime Database · الأسعار بالجنيه المصري</div></footer>`;
}
function planCard(p) {
  const current = (p.code === 'pro') === isPro();
  return `<div class="card ${p.code === 'pro' ? 'pulse' : ''}">
    <div class="flex between center"><div><div class="card-title" style="margin:0">${esc(p.name)}</div><div class="small muted">${esc(p.tagline || '')}</div></div><div class="price" style="font-size:22px">${p.price === 0 ? 'مجانًا' : money(p.price)}</div></div>
    <ul class="list-clean mt12">${(p.features || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <div class="flex between center mt16"><span class="small muted">${p.durationDays || 30} يوم</span>${p.price === 0 ? `<span class="pill gray">مفعّلة تلقائيًا</span>` : current ? `<span class="pill green">مشترك ✓</span>` : `<button class="btn btn-gold btn-sm" onclick="subscribeModal('${esc(p.id)}')">اشترك — ${money(p.price)}</button>`}</div>
  </div>`;
}
function productCard(p) {
  return `<div class="card product-card"><div class="pimg"><img src="${esc(p.imageUrl || 'images/efootball-hero.jpg')}" alt="${esc(p.name)}"><span class="price">${money(p.price)}</span>${p.badge ? `<span class="pill" style="position:absolute;top:8px;inset-inline-end:8px">${esc(p.badge)}</span>` : ''}</div>
    <div class="card-title">${esc(p.name)}</div><div class="card-sub">${esc(p.shortDescription || '')}</div>
    <div class="flex between center mt12"><button class="btn btn-ghost btn-sm" onclick="productModal('${esc(p.id)}')">التفاصيل</button><button class="btn btn-gold btn-sm" onclick="addToCart('${esc(p.id)}')">أضف للسلة</button></div></div>`;
}

/* ------------------------------- home ------------------------------- */
function renderHome() {
  const u = state.user, s = state.settings;
  const cards = [
    ['analyzer', 'AI TEAM ANALYZER', 'ارفع صورة تشكيلتك أو أدخلها يدويًا واحصل على تقييم القوة والانسجام وخطة اللعب.', 'chart', 'تحليل فوري'],
    ['assistant', 'PRO AI ASSISTANT', 'مساعد ذكي باللهجة المصرية، صوتيًا وكتابيًا، يتابع فريقك ويقترح خطط تطوير.', 'spark', 'للمشتركين PRO'],
    ['player', 'PLAYER ANALYSIS', 'حلّل أي لاعب: أفضل مراكزه، نقاط قوته، ومقارنته بغيره مع خطة تطوير عملية.', 'user', 'كتالوج اللاعبين'],
    ['builder', 'TEAM BUILDER', 'ملعب تفاعلي، 5 خطط لعب، تقييم فوري، حفظ ومقارنة التشكيلات واقتراح أفضل فريق.', 'pitch', 'حفظ ومقارنة'],
    ['store', 'PRO STORE', 'خدمات رقمية احترافية: تحليل متقدم، مراجعة مباريات، خطط تطوير، واستشارات تكتيكية.', 'bag', 'خدمات رقمية', true],
    ['subscriptions', 'SUBSCRIPTIONS', 'باقة FREE وباقة PRO، تفعيل بعد تأكيد الدفع من الإدارة، وإدارة كاملة للاشتراك.', 'card', 'FREE / PRO', true],
    ['matches', 'MATCH ANALYSIS', 'سجّل نتائج مبارياتك، ارفع صور النتائج، واحصل على إحصاءات وتحليل لنقاط الضعف.', 'trophy', 'سجل المباريات']
  ];
  $('#app').innerHTML = `
  <section class="hero container"><div class="hero-grid">
    <div><span class="eyebrow">⚡ منصة eFootball الأولى بالذكاء الاصطناعي</span>
      <h1>فريقك. قوتك.<br><span class="gold-text">ذكاؤك الاصطناعي.</span></h1>
      <p class="lead">${u ? `أهلًا ${esc(u.name.split(' ')[0])} <span class="svg-icon">${I.wave}</span> — ` : ''}${esc(s.platformName || 'PES AI PRO')} تحلل تشكيلتك، تقيّم لاعبيك، تقترح خطة اللعب الأنسب، وتتابع نتائج مبارياتك — بدون أي بيانات دخول للعبة.</p>
      <div class="hero-cta"><button class="btn btn-gold" onclick="goProtected('analyzer')"><span class="svg-icon">${I.rocket}</span> ابدأ تحليل فريقك</button><button class="btn btn-ghost" onclick="goProtected('builder')"><span class="svg-icon">${I.puzzle}</span> ابنِ تشكيلتك</button><a class="btn btn-ghost" href="#/subscriptions"><span class="svg-icon">${I.crown}</span> باقات PRO</a></div>
      <div class="stats mt16"><div class="stat"><b>5</b><span>خطط لعب جاهزة</span></div><div class="stat"><b>${state.players.length}+</b><span>لاعبًا في الكتالوج</span></div><div class="stat"><b>7</b><span>أدوات تحليل</span></div><div class="stat"><b>100%</b><span>عربي RTL</span></div></div>
    </div>
    <div class="hero-art"><img src="images/efootball-hero.jpg" alt="eFootball — تحليل احترافي"><div class="art-tag">تحليل بالذكاء الاصطناعي · بدون تدخل في اللعبة</div></div>
  </div></section>
  <section class="section container"><div class="section-head"><div><h2 class="section-title">أدوات <span>PES AI PRO</span></h2><p class="section-sub">كل أداة تعمل فعليًا — بدون أزرار وهمية.</p></div>${u ? `<span class="pill green">مسجل الدخول</span>` : `<button class="btn btn-ghost btn-sm" onclick="navigate('auth')">إنشاء حساب مجاني</button>`}</div>
    <div class="grid cards">${cards.map(([r, title, sub, ic, pill, pub]) => `<div class="card card-link" onclick="${pub ? `navigate('${r}')` : `goProtected('${r}')`}"><div class="icon-3d">${I[ic]}</div><div class="card-title">${title}</div><div class="card-sub">${sub}</div><div class="mt8"><span class="pill">${pill}</span></div></div>`).join('')}</div></section>
  <section class="section container"><div class="section-head"><div><h2 class="section-title">كيف <span>تعمل</span> المنصة؟</h2></div></div><div class="grid cards">
    <div class="card"><div class="icon-3d">1</div><div class="card-title">أنشئ حسابك</div><div class="card-sub">الاسم ورقم الهاتف والبريد، مع رمز سري اختياري أو تحقق OTP.</div></div>
    <div class="card"><div class="icon-3d">2</div><div class="card-title">ابنِ أو ارفع تشكيلتك</div><div class="card-sub">اختر خطة اللعب وأضف اللاعبين، أو ارفع صورة تشكيلتك لتحليلها.</div></div>
    <div class="card"><div class="icon-3d">3</div><div class="card-title">احصل على خطة واضحة</div><div class="card-sub">تقييم القوة، نقاط الضعف، أفضل توزيع للمراكز، وخطة لعب جاهزة.</div></div></div></section>
  <section class="section container"><div class="section-head"><div><h2 class="section-title">الباقات <span>والاشتراك</span></h2><p class="section-sub">الأسعار الحالية — التفعيل بعد تأكيد الدفع.</p></div><a class="btn btn-ghost btn-sm" href="#/subscriptions">كل الباقات</a></div><div class="grid two">${state.plans.map(planCard).join('')}</div></section>
  <section class="section container"><div class="section-head"><div><h2 class="section-title">من <span>المتجر</span></h2><p class="section-sub">خدمات رقمية يضيفها فريق PES AI PRO.</p></div><a class="btn btn-ghost btn-sm" href="#/store">المتجر كامل</a></div><div class="grid cards">${state.products.slice(0, 3).map(productCard).join('')}</div></section>
  <section class="container"><div class="card pulse center-x" style="padding:28px"><h2 class="section-title">جاهز ترتقي بمستوى فريقك؟</h2><p class="muted small mt8">انضم إلى PES AI PRO وابدأ بتحليل فريقك خلال دقيقة — بدون أي بيانات دخول إلى اللعبة.</p><div class="hero-cta" style="justify-content:center">${u ? `<button class="btn btn-gold" onclick="goProtected('analyzer')">ابدأ التحليل</button>` : `<button class="btn btn-gold" onclick="navigate('auth')">إنشاء حساب الآن</button>`}<a class="btn btn-ghost" href="#/store">تصفح الخدمات</a></div></div></section>
  ${footerHtml()}`;
  $$('[data-need]').forEach(b => b.onclick = () => toast('سيتم تفعيل هذا الزر بعد ضبط بيانات التواصل', 'err'));
}

/* ------------------------------- auth ------------------------------- */
let authFlow = null;
function renderAuth(params) {
  const next = params.get('next') || 'home';
  $('#app').innerHTML = `<div class="container section"><div class="form-wrap">
    <div class="center-x mb16"><img src="images/icon.png" alt="PES AI PRO" style="width:74px;height:74px;border-radius:20px;margin:0 auto 10px;box-shadow:0 0 40px rgba(212,175,55,.3)"><h1 class="section-title">مرحبًا بك في <span>PES AI PRO</span></h1><p class="muted small">حساب واحد لكل أدوات التحليل والمتجر والاشتراكات.</p></div>
    <div class="card">
      <div class="mb16"><button class="btn btn-ghost btn-block" id="googleLoginBtn" style="display:flex;align-items:center;justify-content:center;gap:10px;border-color:rgba(212,175,55,.3)"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.0L1.9 16.3C3.7 20.1 7.5 23 12 23z"/></svg>تسجيل الدخول باستخدام Google</button></div>
      <div style="text-align:center;margin:12px 0;color:rgba(255,255,255,.4);font-size:13px">— أو عبر الهاتف —</div>
      <div class="tabs"><button class="active" data-authtab="login">تسجيل الدخول</button><button data-authtab="register">حساب جديد</button><button data-authtab="recover">استعادة الحساب</button></div>
      <div id="authBody"></div>
      <div id="recaptcha-container" style="position:fixed;bottom:0;left:0;width:1px;height:1px;overflow:hidden"></div>
    </div>
    <p class="center-x small muted mt12">هذه الصفحة لحسابات المستخدمين فقط — حساب واحد لكل الأدوات.</p>
  </div></div>${footerHtml()}`;
  $('#googleLoginBtn').onclick = async e => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    setBusy(btn, true, 'جارٍ فتح Google...');
    try {
      const r = await Backend.loginWithGoogle();
      if (r.error) return toast(r.error, 'err');
      if (r.user) return authSuccess(r, next);
      toast('تعذر إكمال الدخول بـ Google', 'err');
    } catch (err) {
      toast(fbErrMsg(err), 'err');
    } finally {
      setBusy(btn, false);
    }
  };
  $$('[data-authtab]').forEach(b => b.onclick = () => { $$('[data-authtab]').forEach(x => x.classList.toggle('active', x === b)); authFlow = null; renderAuthForm(b.dataset.authtab, next); });
  renderAuthForm('login', next);
}
function renderAuthForm(tab, next) {
  const body = $('#authBody'); if (!body) return;
  if (tab === 'login') body.innerHTML = `<form id="loginForm">
    <div class="field"><label>رقم الهاتف</label><input class="input" name="phone" type="tel" autocomplete="tel" placeholder="01012345678 أو +201012345678" inputmode="tel" required><div class="hint">يمكنك كتابة الرقم بالصيغة المصرية المحلية وسنحوّله تلقائيًا للصيغة الدولية.</div></div>
    <div class="field"><label>الاسم (اختياري)</label><input class="input" name="name" placeholder="اسمك"></div>
    <div class="field"><label>الرمز السري (4 أرقام — اختياري)</label><input class="input" name="pin" placeholder="اتركه فارغًا إذا لم يكن لديك رمز" inputmode="numeric" maxlength="4" pattern="[0-9]*"><div class="hint">الدخول يتم برمز تحقق SMS على هاتفك. جهازك يبقى مسجّلًا بعد أول دخول ناجح.</div></div>
    <div id="loginStep" class="hidden"></div>
    <div class="error-text" id="authError"></div>
    <button class="btn btn-gold btn-block" type="submit">دخول</button></form>`;
  if (tab === 'register') body.innerHTML = `<form id="registerForm">
    <div class="field"><label>الاسم</label><input class="input" name="name" minlength="3" required></div>
    <div class="form-row"><div class="field"><label>رقم الهاتف</label><input class="input" name="phone" type="tel" autocomplete="tel" placeholder="01012345678" inputmode="tel" required></div><div class="field"><label>البريد الإلكتروني</label><input class="input" name="email" type="email" autocomplete="email" required></div></div>
    <div class="field"><label>رمز سري اختياري (4 أرقام)</label><input class="input" name="pin" inputmode="numeric" maxlength="4" pattern="[0-9]*"><div class="hint">يمكنك إضافته أو تغييره لاحقًا من الإعدادات.</div></div>
    <label class="small muted" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="terms" required style="margin-top:5px"> أوافق على الشروط، وأقر بأن المنصة لا تطلب بيانات دخول اللعبة.</label>
    <div id="registerStep" class="hidden"></div><div class="error-text" id="authError"></div><button class="btn btn-gold btn-block mt12" type="submit">إنشاء الحساب</button></form>`;
  if (tab === 'recover') body.innerHTML = `<form id="recoverForm">
    <div class="note warn mb12"><div>استعادة الحساب تتم بالتحقق من رقم الهاتف عبر OTP، ثم تعيين رمز سري جديد أو إزالته.</div></div>
    <div class="field"><label>الاسم</label><input class="input" name="name" required></div>
    <div class="field"><label>رقم الهاتف</label><input class="input" name="phone" inputmode="tel" required></div>
    <div id="recoverStep" class="hidden"></div><div class="error-text" id="authError"></div><button class="btn btn-gold btn-block mt12" type="submit">استعادة الحساب</button></form>`;
  bindAuthForm(tab, next);
}
function authError(msg) {
  const e = $('#authError'); if (!e) return;
  if (!msg) { e.textContent = ''; e.style.display = 'none'; return; }
  e.textContent = msg; e.style.display = 'block';
}
function bindAuthForm(tab, next) {
  const form = $('#' + tab + 'Form'); if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  form.onsubmit = async e => {
    e.preventDefault();
    if (form.dataset.busy === '1') return;
    const f = e.target;
    const val = k => (f.elements[k] ? String(f.elements[k].value || '').trim() : '');
    const data = { name: val('name'), phone: normalizePhone(val('phone')), pin: val('pin'), email: val('email') };
    authError('');
    if (tab !== 'recover' && data.phone.replace(/\D/g, '').length < 9) return authError('اكتب رقم هاتف صحيحًا — مثال: 01012345678 أو +201012345678');
    if (tab === 'register' && f.elements.terms && !f.elements.terms.checked) return authError('يجب الموافقة على الشروط');
    if (tab === 'register' && data.name.length < 3) return authError('الاسم يجب أن يكون 3 أحرف على الأقل');

    form.dataset.busy = '1';
    setBusy(submitBtn, true, tab === 'register' ? 'جارٍ إرسال رمز التحقق...' : 'جارٍ الاتصال...');
    try {
      if (tab === 'login') {
        const r = await Backend.startLogin(data);
        if (r.error) return authError(r.error);
        if (r.requires_otp) { authFlow = { mode: 'login', data }; showOtpStep('loginStep', r, next); return; }
        if (r.requires_pin) { authFlow = { mode: 'login-pin' }; showPinStep('loginStep', next); return; }
        if (r.user) return authSuccess(r, next);
        return authError('تعذر إكمال الدخول');
      }
      if (tab === 'register') {
        const r = await Backend.startRegister(data);
        if (r.error) return authError(r.error);
        if (r.requires_otp) { authFlow = { mode: 'register', data }; showOtpStep('registerStep', r, next); return; }
        if (r.user) return authSuccess(r, next);
        return authError('تعذر إنشاء الحساب');
      }
      if (tab === 'recover') {
        const r = await Backend.recoverRequest({ phone: data.phone });
        if (r.error) return authError(r.error);
        if (r.requires_otp) { authFlow = { mode: 'recover', data }; showOtpStep('recoverStep', r, next); return; }
        return authError('تعذر إرسال رمز التحقق');
      }
    } catch (err) {
      authError(fbErrMsg(err));
    } finally {
      form.dataset.busy = '0';
      setBusy(submitBtn, false);
    }
  };
}
function showOtpStep(boxId, r, next) {
  const box = $('#' + boxId); if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `<div class="field"><label>رمز التحقق OTP</label><input class="input" id="otpInput" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 أرقام"></div>
    <div class="note info">${r.dev_code ? `رمز التحقق للتجربة: <b>${esc(r.dev_code)}</b>` : '📩 أدخل رمز التحقق المرسل إلى هاتفك (قد يتأخر حتى دقيقة).'}</div>
    <button class="btn btn-gold btn-block mt8" id="otpSubmit">تأكيد الرمز</button>`;
  const inp = $('#otpInput'); if (inp) inp.focus();
  const btn = $('#otpSubmit');
  if (!btn) return;
  btn.onclick = async () => {
    if (btn.disabled) return;
    const code = ($('#otpInput')?.value || '').trim();
    if (code.length < 4) return toast('أدخل رمز التحقق', 'err');
    authError('');
    setBusy(btn, true, 'جارٍ التحقق...');
    try {
      if (authFlow?.mode === 'register') {
        const r = await Backend.confirmRegister(code);
        if (r.error) return authError(r.error);
        if (r.user) return authSuccess(r, next);
      } else if (authFlow?.mode === 'recover') {
        const r = await Backend.recoverVerify({ otp: code, pin: '' });
        if (r.error) return authError(r.error);
        if (r.user) return authSuccess(r, next);
      } else {
        const r = await Backend.confirmLogin(code);
        if (r.error) return authError(r.error);
        if (r.requires_pin) { authFlow = { mode: 'login-pin' }; showPinStep(boxId, next); return; }
        if (r.user) return authSuccess(r, next);
      }
      authError('تعذر إكمال التحقق');
    } catch (err) {
      authError(fbErrMsg(err));
    } finally {
      setBusy(btn, false);
    }
  };
}
function showPinStep(boxId, next) {
  const box = $('#' + boxId); if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `<div class="field"><label>الرمز السري (4 أرقام)</label><input class="input" id="pinInput" inputmode="numeric" autocomplete="one-time-code" maxlength="4" placeholder="4 أرقام"></div><button class="btn btn-gold btn-block mt8" id="pinSubmit">تأكيد الرمز</button>`;
  const inp = $('#pinInput'); if (inp) inp.focus();
  const btn = $('#pinSubmit');
  if (!btn) return;
  btn.onclick = async () => {
    if (btn.disabled) return;
    const pin = ($('#pinInput')?.value || '').trim();
    if (!/^\d{4}$/.test(pin)) return toast('الرمز السري 4 أرقام', 'err');
    setBusy(btn, true, 'جارٍ التحقق...');
    try {
      const r = await Backend.verifyLoginPin(pin);
      if (r.error) return authError(r.error);
      if (r.user) return authSuccess(r, next);
      authError('تعذر إكمال الدخول');
    } catch (err) {
      authError(fbErrMsg(err));
    } finally {
      setBusy(btn, false);
    }
  };
}
function authSuccess(r, next) {
  state.user = r.user;
  state.plan = r.plan || state.plans[0];
  state.authReady = true;
  persistSession();          /* كانت الجلسة تضيع عند أول تحديث للصفحة */
  authFlow = null;
  _bellAt = 0;
  toast('تم تسجيل الدخول بنجاح');
  renderShell();
  const dest = next && next !== 'home' && next !== 'auth' ? next : 'home';
  if (location.hash === '#/' + dest) renderRoute(); else navigate(dest);
}
/* ------------------------------- analyzer ------------------------------- */
const an = { formation: '4-3-3', lineup: [], result: null };
function roleLabel(r) { return ({ GK: 'حارس', CB: 'قلب دفاع', LB: 'ظهير أيسر', RB: 'ظهير أيمن', CM: 'وسط', CAM: 'صانع لعب', LW: 'جناح أيسر', RW: 'جناح أيمن', ST: 'مهاجم' }[r] || r); }
function renderAnalyzer() {
  $('#app').innerHTML = `<div class="container section">
    <div class="section-head"><div><h1 class="section-title">AI <span>TEAM ANALYZER</span></h1><p class="section-sub">ارفع صورة تشكيلتك أو أدخلها يدويًا — تحليل كامل بدرجة ثقة واضحة.</p></div><span class="pill ${isPro() ? '' : 'gray'}">${isPro() ? 'PRO' : 'FREE'}</span></div>
    <div class="grid two" style="align-items:start">
      <div class="card"><h3 class="card-title" style="margin-top:0">1) صورة التشكيلة</h3>
        <div id="dropZone" style="border:1.5px dashed rgba(212,175,55,.4);border-radius:16px;padding:22px;text-align:center;cursor:pointer;background:rgba(212,175,55,.03)" onclick="document.getElementById('anImage').click()"><div style="font-size:30px"><span class="svg-icon" style="width:30px;height:30px">${I.image}</span></div><div class="small mt8">اضغط لرفع صورة تشكيلة eFootball (JPG/PNG/WebP — حتى 6MB)</div><input type="file" id="anImage" accept="image/*" class="hidden" onchange="anImageChange(this)"></div>
        <div id="anPreview" class="hidden mt12" style="border-radius:14px;overflow:hidden"><img id="anPreviewImg" alt="معاينة" style="width:100%;max-height:220px;object-fit:cover"></div>
        <div class="flex gap mt12 wrap"><button class="btn btn-gold btn-sm" onclick="anAnalyzeImage()">تحليل الصورة</button><button class="btn btn-ghost btn-sm" onclick="anClearImage()">إزالة</button></div>
        <div class="note info mt12" id="anVisionNote">تحليل الصور يحتاج Firebase Function + مفتاح AI. يمكنك إدخال التشكيلة يدويًا والحصول على التحليل الكامل.</div>
        <div class="divider"></div><h3 class="card-title" style="margin-top:0">2) أو أدخل التشكيلة يدويًا</h3>
        <div class="form-row"><div class="field"><label>خطة اللعب</label><select class="input" id="anFormation" onchange="anBuildSlots(this.value)">${state.formations.map(f => `<option value="${esc(f.name)}">${esc(f.name)} — ${esc(f.description || '')}</option>`).join('')}</select></div><div class="field"><label>اسم التشكيلة</label><input class="input" id="anTeamName" value="تشكيلتي الأساسية"></div></div>
        <div class="flex gap wrap mb12"><button class="btn btn-ghost btn-sm" onclick="anLoadSaved()">تحميل آخر تشكيلة</button><button class="btn btn-ghost btn-sm" onclick="anSuggest()">اقترح أفضل تشكيلة</button><button class="btn btn-ghost btn-sm" onclick="anClear()">مسح اللاعبين</button></div>
        <datalist id="playersList">${state.players.map(p => `<option value="${esc(p.name)}">${p.position} · ${p.rating}</option>`).join('')}</datalist>
        <div id="anSlots"></div><div class="error-text" id="anError"></div>
        <button class="btn btn-gold btn-block mt12" onclick="anAnalyze()">⚡ حلّل التشكيلة الآن</button>
        <div class="hint center-x mt8">التقييم يعتمد على مراكز اللاعبين وتوافقهم — بدون بيانات مخترعة.</div>
      </div>
      <div class="card"><h3 class="card-title" style="margin-top:0">نتيجة التحليل</h3><div id="anResult"><div class="empty">لم يتم التحليل بعد. املأ 11 مركزًا ثم اضغط تحليل، أو ارفع صورة تشكيلتك.</div></div></div>
    </div>
    <div class="section-head mt16"><div><h2 class="section-title">تقارير <span>التحليل</span> السابقة</h2></div></div><div class="grid cards" id="anHistory"></div>
  </div>${footerHtml()}`;
  an.formation = '4-3-3'; an.lineup = []; anBuildSlots('4-3-3'); anLoadHistory();
}
function anBuildSlots(formationName) {
  const f = state.formations.find(x => x.name === formationName) || state.formations[0];
  an.formation = f.name;
  const old = an.lineup;
  an.lineup = f.slots.map((s, i) => (old[i] && old[i].slot === s.role ? old[i] : { slot: s.role, name: '', position: s.role, rating: 75, pace: 75, shooting: 75, passing: 75, dribbling: 75, defending: 75, physical: 75, nation: '', league: '' }));
  const box = $('#anSlots'); if (!box) return;
  box.innerHTML = f.slots.map((s, i) => `<div class="form-row" style="grid-template-columns:64px 1fr 92px;gap:8px;align-items:center;margin-bottom:8px"><span class="pill" style="justify-content:center">${s.role}</span><input class="input" list="playersList" data-an-i="${i}" data-an-k="name" placeholder="اسم اللاعب (${roleLabel(s.role)})" value="${esc(an.lineup[i].name)}" style="padding:9px 11px" oninput="anSlotInput(this)" onchange="anSlotChange(this)"><select class="input" data-an-i="${i}" data-an-k="position" style="padding:9px 6px;font-size:12px" onchange="anSlotChange(this)">${['GK','CB','LB','RB','CM','CAM','LW','RW','ST'].map(p => `<option ${an.lineup[i].position === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>`).join('');
}
function anSlotInput(el) {
  const i = +el.dataset.anI, k = el.dataset.anK; an.lineup[i][k] = el.value;
  if (k === 'name') { const p = state.players.find(x => x.name === el.value); if (p) { Object.assign(an.lineup[i], p, { slot: an.lineup[i].slot }); const pos = $(`select[data-an-i="${i}"]`); if (pos) pos.value = p.position; } }
}
function anSlotChange(el) { const i = +el.dataset.anI; an.lineup[i][el.dataset.anK] = el.value; }
function anClearImage() { const i = $('#anImage'); if (i) i.value = ''; $('#anPreview')?.classList.add('hidden'); }
function anImageChange(input) { const file = input.files[0]; if (!file) return; const img = $('#anPreviewImg'); if (img) img.src = URL.createObjectURL(file); $('#anPreview')?.classList.remove('hidden'); }
async function anAnalyzeImage() {
  const file = $('#anImage')?.files[0]; if (!file) return toast('اختر صورة أولًا', 'err');
  loading(true); const r = await Backend.analyzeImage(file); loading(false);
  if (r.error || r.needs_key) { toast(r.error || 'تعذر تحليل الصورة', 'err'); return; }
  if (r.formation) { const f = state.formations.find(x => x.name === r.formation.name); if (f) { $('#anFormation').value = f.name; anBuildSlots(f.name); } }
  (r.players || []).forEach((pl, i) => { if (!an.lineup[i]) return; const cat = state.players.find(c => c.name.toLowerCase() === String(pl.name).toLowerCase()); Object.assign(an.lineup[i], { name: pl.name, position: pl.position || an.lineup[i].slot, rating: pl.rating || cat?.rating || 75, ...(cat || {}) }, { slot: an.lineup[i].slot }); });
  anBuildSlots(an.formation); toast(`تم قراءة ${r.players?.length || 0} لاعبًا بثقة ${r.confidence}%`);
  $('#anResult').innerHTML = `<div class="note info mb12"><div><b>قراءة الصورة:</b> ${esc(r.formation?.name || 'غير محددة')} — الثقة ${r.confidence}%</div></div><div class="table-wrap"><table><thead><tr><th>اللاعب</th><th>المركز</th><th>التقييم</th></tr></thead><tbody>${(r.players || []).map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.position)}</td><td>${esc(p.rating || '—')}</td></tr>`).join('') || '<tr><td colspan="3">لم يتم التعرف على لاعبين — استخدم الإدخال اليدوي.</td></tr>'}</tbody></table></div>`;
}
async function anAnalyze() {
  const err = $('#anError'); if (err) err.style.display = 'none';
  const empty = an.lineup.filter(p => !p.name.trim()).length;
  if (empty) { if (err) { err.textContent = `أكمل ${empty} مركزًا متبقيًا قبل التحليل`; err.style.display = 'block'; } return; }
  loading(true); const r = await Backend.analyzeTeam(an.formation, an.lineup); loading(false);
  if (r.error) return toast(r.error, 'err');
  an.result = r.analysis; anRenderResult(r.analysis, r.engine, r.remaining); anLoadHistory();
}
function anBar(label, val) { return `<div class="bar-row"><span class="lbl">${label}</span><div class="bar"><i style="width:${val}%"></i></div><b>${val}</b></div>`; }
function anRenderResult(a, engine, remaining) {
  $('#anResult').innerHTML = `<div class="flex center gap mb12" style="align-items:flex-start"><div class="score-ring" style="--p:${a.overall}"><b>${a.overall}<small>/100</small></b></div><div style="flex:1"><div class="pill mb8">${esc(a.formation)} · ${esc(a.verdict)}</div><div class="small muted">المراكز: ${a.filled}/${a.totalSlots} · الثقة: ${a.confidence}%</div><div class="small muted">المحرك: ${engine === 'rules-engine' ? 'محرك التحليل المحلي' : esc(engine)} ${remaining != null ? `· متبقٍ اليوم: ${remaining}` : '· PRO'}</div></div></div>
    ${anBar('الهجوم', a.attack)}${anBar('الوسط', a.midfield)}${anBar('الدفاع', a.defense)}${anBar('المرمى', a.gk)}${anBar('الانسجام', a.chemistry)}
    <div class="divider"></div><h4 class="gold mb8">نقاط القوة</h4><ul class="list-clean">${a.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h4 class="gold mb8 mt12">نقاط الضعف</h4><ul class="list-clean">${a.weaknesses.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h4 class="gold mb8 mt12">التغييرات المقترحة</h4>${a.suggestions.map(s => `<div class="note ${s.priority === 'high' ? 'warn' : ''}" style="margin-bottom:8px"><div><b>${esc(s.title)}</b><br>${esc(s.detail)}</div></div>`).join('')}
    <div class="note info mt12"><div><b>خطة اللعب:</b><br>${esc(a.plan)}</div></div>
    <div class="flex gap mt12 wrap"><button class="btn btn-ghost btn-sm" onclick="navigate('builder')">افتح TEAM BUILDER</button><button class="btn btn-ghost btn-sm" onclick="navigate('assistant')">اسأل المساعد</button></div>`;
}
async function anLoadSaved() { const r = await Backend.getTeams(); if (!r.teams?.length) return toast('لا توجد تشكيلة محفوظة', 'err'); const t = r.teams[0]; $('#anFormation').value = t.formation; $('#anTeamName').value = t.name; anBuildSlots(t.formation); t.players.forEach((pl, i) => { if (an.lineup[i] && pl) Object.assign(an.lineup[i], pl, { slot: an.lineup[i].slot }); }); anBuildSlots(t.formation); toast('تم تحميل التشكيلة'); }
async function anSuggest() { loading(true); const r = await Backend.suggestTeam(an.formation); loading(false); if (r.error) return toast(r.error, 'err'); r.players.forEach((pl, i) => { if (an.lineup[i]) Object.assign(an.lineup[i], pl, { slot: an.lineup[i].slot }); }); anBuildSlots(an.formation); toast('تم اقتراح أفضل تشكيلة'); }
function anClear() { an.lineup = []; anBuildSlots(an.formation); }
async function anLoadHistory() {
  const r = await Backend.getReports(); const box = $('#anHistory'); if (!box) return;
  const items = (r.reports || []).filter(x => x.kind === 'team' || x.kind === 'vision').slice(0, 6);
  box.innerHTML = items.map(x => `<div class="card"><div class="flex between center"><span class="pill">${x.kind === 'vision' ? 'صورة' : 'تشكيلة'}</span><span class="small muted">${dateTimeAr(x.created_at)}</span></div><div class="card-title">${esc(x.title)}</div><div class="card-sub">التقييم: <b class="gold">${x.result?.overall ?? '—'}</b> · الثقة: ${x.confidence}%</div></div>`).join('') || '<div class="empty">لا توجد تقارير بعد.</div>';
}

/* ------------------------------- builder ------------------------------- */
const builder = { formation: '4-3-3', lineup: [], selected: null, editingId: null };
function renderBuilder() {
  $('#app').innerHTML = `<div class="container section">
    <div class="section-head"><div><h1 class="section-title">TEAM <span>BUILDER</span></h1><p class="section-sub">اضغط على أي مركز لاختيار لاعب، أو اضغط لاعبين لتبديل مركزيهم.</p></div><span class="pill ${isPro() ? '' : 'gray'}">${isPro() ? 'PRO' : 'FREE'}</span></div>
    <div class="grid two" style="align-items:start"><div class="card">
      <div class="form-row"><div class="field"><label>خطة اللعب</label><select class="input" id="bFormation" onchange="bBuildSlots(this.value)">${state.formations.map(f => `<option value="${esc(f.name)}">${esc(f.name)} — ${esc(f.description || '')}</option>`).join('')}</select></div><div class="field"><label>اسم التشكيلة</label><input class="input" id="bTeamName" value="تشكيلتي الأساسية"></div></div>
      <div class="flex gap wrap mb12"><button class="btn btn-gold btn-sm" onclick="bSave()"><span class="svg-icon">${I.save}</span> حفظ التشكيلة</button><button class="btn btn-ghost btn-sm" onclick="bSuggest()"><span class="svg-icon">${I.spark}</span> اقترح أفضل تشكيلة</button><button class="btn btn-ghost btn-sm" onclick="bClear()">مسح</button></div>
      <div class="pitch-wrap"><div class="pitch" id="pitch"><div class="pitch-box top"></div><div class="pitch-box bottom"></div><div class="pitch-legend">PES AI PRO · ${new Date().getFullYear()}</div></div></div>
      <div class="flex between center mt12"><div class="small muted">متوسط التقييم: <b class="gold" id="bAvg">0</b></div><div class="small muted">عدد اللاعبين: <b class="gold" id="bCount">0</b>/11</div></div>
      <div class="note info mt12">الملعب تفاعلي: اضغط على المركز الفارغ لاختيار لاعب، أو أضف لاعبًا مخصصًا. اضغط على لاعبين لتبديل مكانيهما.</div>
    </div><div><div class="card mb12"><h3 class="card-title" style="margin-top:0">تشكيلاتي المحفوظة</h3><div id="bSaved" class="empty">لا توجد تشكيلات محفوظة بعد.</div></div>
      <div class="card"><h3 class="card-title" style="margin-top:0">مقارنة تشكيلتين</h3><div class="form-row"><div class="field"><label>الأولى</label><select class="input" id="bCmpA"></select></div><div class="field"><label>الثانية</label><select class="input" id="bCmpB"></select></div></div><button class="btn btn-ghost btn-block" onclick="bCompare()">قارن الآن</button><div id="bCmpResult" class="mt12"></div></div></div>
    </div></div>${footerHtml()}`;
  builder.formation = '4-3-3'; builder.lineup = []; builder.selected = null; builder.editingId = null; bBuildSlots('4-3-3'); bLoadTeams();
}
function bBuildSlots(name) {
  const f = state.formations.find(x => x.name === name) || state.formations[0]; builder.formation = f.name;
  const old = builder.lineup; builder.lineup = f.slots.map((s, i) => (old[i] && old[i].slot === s.role ? old[i] : null)); builder.selected = null; bRenderPitch(); bUpdateStats();
}
function bRenderPitch() {
  const pitch = $('#pitch'); if (!pitch) return; pitch.querySelectorAll('.token').forEach(t => t.remove());
  const f = state.formations.find(x => x.name === builder.formation) || state.formations[0];
  f.slots.forEach((s, i) => { const p = builder.lineup[i]; const el = document.createElement('div'); el.className = 'token' + (p ? '' : ' empty') + (builder.selected === i ? ' sel' : ''); el.style.left = s.x + '%'; el.style.top = s.y + '%'; el.innerHTML = `<div class="pc">${p ? esc(p.rating || 75) : '+'}<small>${s.role}</small></div><div class="tn">${p ? esc(p.name) : 'أضف لاعبًا'}</div>`; el.onclick = () => bTokenClick(i); pitch.appendChild(el); });
}
function bUpdateStats() { const filled = builder.lineup.filter(Boolean); const c = $('#bCount'), a = $('#bAvg'); if (c) c.textContent = filled.length; if (a) a.textContent = filled.length ? Math.round(filled.reduce((x, p) => x + (p.rating || 75), 0) / filled.length) : 0; }
function bTokenClick(i) {
  if (builder.selected === null) { builder.selected = i; bRenderPitch(); bOpenPicker(i); return; }
  if (builder.selected === i) { builder.selected = null; bRenderPitch(); return; }
  const a = builder.lineup[builder.selected], b = builder.lineup[i]; builder.lineup[builder.selected] = b; builder.lineup[i] = a; builder.selected = null; bRenderPitch(); bUpdateStats(); toast('تم تبديل المركزين');
}
function bOpenPicker(i) {
  const f = state.formations.find(x => x.name === builder.formation) || state.formations[0], slot = f.slots[i];
  openModal('اختر لاعبًا لمركز ' + slot.role, `<div class="field"><input class="input" id="bSearch" placeholder="ابحث بالاسم أو المركز..." oninput="bRenderResults(this.value)"></div><div id="bResults" style="max-height:300px;overflow:auto"></div><div class="divider"></div><h4 class="gold small mb8">إضافة لاعب مخصص</h4><div class="form-row"><div class="field"><input class="input" id="bCustomName" placeholder="اسم اللاعب"></div><div class="field"><select class="input" id="bCustomPos">${['GK','CB','LB','RB','CM','CAM','LW','RW','ST'].map(p => `<option ${p === slot.role ? 'selected' : ''}>${p}</option>`).join('')}</select></div></div><div class="field"><label>التقييم (1-99)</label><input class="input" id="bCustomRating" type="number" min="1" max="99" value="80"></div><button class="btn btn-gold btn-block btn-sm" onclick="bAddCustom(${i})">إضافة اللاعب المخصص</button><button class="btn btn-ghost btn-block btn-sm mt8" onclick="bRemoveSlot(${i})">إزالة اللاعب</button>`);
  bRenderResults('');
}
function bRenderResults(q) {
  const list = state.players.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.position.includes(q.toUpperCase())).slice(0, 40);
  const box = $('#bResults'); if (!box) return;
  box.innerHTML = list.map(p => `<div class="cart-row"><div><b>${esc(p.name)}</b><div class="small muted">${p.position} · ${esc(p.nation || '')}</div></div><div class="flex center gap"><span class="pill">${p.rating}</span><button class="btn btn-ghost btn-sm" onclick="bPick('${esc(p.id)}')">اختيار</button></div></div>`).join('') || '<div class="empty">لا نتائج</div>';
}
function bPick(id) { const p = state.players.find(x => String(x.id) === String(id)); if (!p) return; builder.lineup[builder.selected] = { ...p }; builder.selected = null; closeModal(); bRenderPitch(); bUpdateStats(); toast('تم إضافة ' + p.name); }
function bAddCustom(i) { const name = ($('#bCustomName')?.value || '').trim(); if (!name) return toast('اكتب اسم اللاعب', 'err'); builder.lineup[i] = { name, position: $('#bCustomPos').value, rating: Math.max(1, Math.min(99, +$('#bCustomRating').value || 80)), pace: 75, shooting: 75, passing: 75, dribbling: 75, defending: 75, physical: 75, nation: '', league: '' }; builder.selected = null; closeModal(); bRenderPitch(); bUpdateStats(); toast('تمت إضافة اللاعب'); }
function bRemoveSlot(i) { builder.lineup[i] = null; builder.selected = null; closeModal(); bRenderPitch(); bUpdateStats(); }
async function bSave() {
  if (!builder.lineup.filter(Boolean).length) return toast('أضف لاعبين أولًا', 'err');
  loading(true); const r = await Backend.saveTeam({ id: builder.editingId, name: $('#bTeamName').value, formation: builder.formation, players: builder.lineup }); loading(false);
  if (r.error) return toast(r.error, 'err');
  builder.editingId = r.id; toast(r.message + ' — تقييم ' + r.analysis.overall); bLoadTeams();
}
async function bLoadTeams() {
  const r = await Backend.getTeams(); const teams = r.teams || [];
  const box = $('#bSaved'); if (box) box.innerHTML = teams.map(t => `<div class="cart-row"><div><b>${esc(t.name)}</b><div class="small muted">${esc(t.formation)} · تقييم ${t.rating} · كيمياء ${t.chemistry}</div></div><div class="flex gap"><button class="btn btn-ghost btn-sm" onclick="bLoadTeam('${esc(t.id)}')">تحميل</button><button class="btn btn-danger btn-sm" onclick="bDeleteTeam('${esc(t.id)}')">حذف</button></div></div>`).join('') || '<div class="empty">لا توجد تشكيلات محفوظة بعد.</div>';
  const opts = teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)} (${esc(t.formation)})</option>`).join('');
  const a = $('#bCmpA'), b = $('#bCmpB'); if (a) a.innerHTML = opts; if (b) b.innerHTML = opts; if (teams[1] && b) b.value = teams[1].id;
}
function bLoadTeam(id) {
  const r = Backend.getTeams(); r.then(res => { const t = (res.teams || []).find(x => String(x.id) === String(id)); if (!t) return; builder.editingId = t.id; $('#bTeamName').value = t.name; $('#bFormation').value = t.formation; builder.formation = t.formation; builder.lineup = t.players.map(p => p ? { ...p } : null); builder.selected = null; bRenderPitch(); bUpdateStats(); toast('تم تحميل ' + t.name); });
}
async function bDeleteTeam(id) { if (!confirm('حذف هذه التشكيلة؟')) return; const r = await Backend.deleteTeam(id); if (r.error) return toast(r.error, 'err'); toast('تم الحذف'); bLoadTeams(); }
async function bSuggest() { loading(true); const r = await Backend.suggestTeam(builder.formation); loading(false); if (r.error) return toast(r.error, 'err'); builder.lineup = r.players.map(p => ({ ...p })); builder.selected = null; bRenderPitch(); bUpdateStats(); toast('تم اقتراح أفضل تشكيلة — تقييم ' + r.analysis.overall); }
function bClear() { builder.lineup = state.formations.find(x => x.name === builder.formation).slots.map(() => null); builder.selected = null; builder.editingId = null; $('#bTeamName').value = 'تشكيلة جديدة'; bRenderPitch(); bUpdateStats(); }
async function bCompare() {
  const a = $('#bCmpA')?.value, b = $('#bCmpB')?.value; if (!a || !b) return toast('اختر تشكيلتين', 'err'); if (a === b) return toast('اختر تشكيلتين مختلفتين', 'err');
  loading(true); const r = await Backend.compareTeams(a, b); loading(false); if (r.error) return toast(r.error, 'err');
  const c = r.comparison; $('#bCmpResult').innerHTML = `<div class="note mb12"><div>النتيجة: <b>${c.winner === 'a' ? esc(r.a.name) : c.winner === 'b' ? esc(r.b.name) : 'تعادل'}</b> (${c.winsA} - ${c.winsB})</div></div>${c.rows.map(row => `<div class="bar-row"><span class="lbl">${row.label}</span><div class="bar"><i style="width:${row.a}%"></i></div><b>${row.a}</b><span class="small muted">×</span><div class="bar"><i style="width:${row.b}%;background:linear-gradient(90deg,#3b82f6,#93c5fd)"></i></div><b>${row.b}</b></div>`).join('')}`;
}

/* ------------------------------- player analysis ------------------------------- */
function pRoleScore(p, role) {
  const w = { GK: { rating: .5, physical: .2, pace: .15, passing: .15 }, CB: { defending: .4, physical: .3, pace: .15, passing: .15 }, LB: { pace: .3, defending: .3, passing: .2, physical: .2 }, RB: { pace: .3, defending: .3, passing: .2, physical: .2 }, CM: { passing: .35, defending: .2, dribbling: .2, physical: .15, shooting: .1 }, CAM: { passing: .35, dribbling: .3, shooting: .2, pace: .15 }, LW: { pace: .3, dribbling: .3, shooting: .25, passing: .15 }, RW: { pace: .3, dribbling: .3, shooting: .25, passing: .15 }, ST: { shooting: .4, pace: .25, dribbling: .2, physical: .15 } }[role];
  return Math.round(Object.entries(w).reduce((a, [k, v]) => a + (p[k] || 70) * v, 0));
}
function renderPlayer() {
  $('#app').innerHTML = `<div class="container section"><div class="section-head"><div><h1 class="section-title">PLAYER <span>ANALYSIS</span></h1><p class="section-sub">اختر لاعبًا من الكتالوج لتحليل مراكزه الأفضل ونقاط قوته وخطة تطويره.</p></div></div>
    <div class="grid two" style="align-items:start"><div class="card"><div class="field"><label>ابحث عن لاعب</label><input class="input" id="pSearch" placeholder="اسم اللاعب..." oninput="pRenderList(this.value)"></div><div id="pList" style="max-height:420px;overflow:auto"></div></div><div class="card" id="pDetail"><div class="empty">اختر لاعبًا من القائمة لعرض التحليل.</div></div></div>
    <div class="card mt16"><h3 class="card-title" style="margin-top:0">مقارنة سريعة بين لاعبين</h3><div class="form-row"><div class="field"><label>الأول</label><select class="input" id="pCmpA">${state.players.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${p.position})</option>`).join('')}</select></div><div class="field"><label>الثاني</label><select class="input" id="pCmpB">${state.players.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${p.position})</option>`).join('')}</select></div></div><button class="btn btn-gold btn-block btn-sm" onclick="pCompare()">قارن اللاعبين</button><div id="pCmpOut" class="mt12"></div></div></div>${footerHtml()}`;
  pRenderList(''); if (state.players[0]) pSelect(state.players[0].id);
}
function pRenderList(q) { const list = state.players.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.position.includes(q.toUpperCase())).slice(0, 50); const box = $('#pList'); if (!box) return; box.innerHTML = list.map(p => `<div class="cart-row"><div><b>${esc(p.name)}</b><div class="small muted">${p.position} · ${esc(p.nation || '')}</div></div><div class="flex center gap"><span class="pill">${p.rating}</span><button class="btn btn-ghost btn-sm" onclick="pSelect('${esc(p.id)}')">تحليل</button></div></div>`).join('') || '<div class="empty">لا نتائج</div>'; }
function pSelect(id) {
  const p = state.players.find(x => String(x.id) === String(id)); if (!p) return; const roles = ['GK','CB','LB','RB','CM','CAM','LW','RW','ST'].map(r => ({ role: r, score: pRoleScore(p, r) })).sort((a, b) => b.score - a.score).slice(0, 3);
  const attrs = [['rating','التقييم العام'],['pace','السرعة'],['shooting','التسديد'],['passing','التمرير'],['dribbling','المراوغة'],['defending','الدفاع'],['physical','البدني']].map(([k, label]) => ({ k, label, v: p[k] || 0 })).sort((a, b) => b.v - a.v);
  const plan = []; if ((p.pace || 0) < 75) plan.push('تمارين سرعة وتحمل (30 متر × 6).'); if ((p.shooting || 0) < 75) plan.push('تدريب تسديد من حدود المنطقة 20 كرة يوميًا.'); if ((p.passing || 0) < 75) plan.push('تمارين تمرير بقدم واحدة تحت الضغط.'); if ((p.dribbling || 0) < 75) plan.push('تمارين مراوغة بين الأقماع.'); if ((p.defending || 0) < 75) plan.push('تدريب على التمركز والضغط الخلفي.'); if ((p.physical || 0) < 75) plan.push('تمارين قوة وتحمل.'); if (!plan.length) plan.push('اللاعب مكتمل — ركّز على القرارات في المباريات الكبيرة.');
  $('#pDetail').innerHTML = `<div class="flex between center mb12"><div><h3 class="card-title" style="margin:0">${esc(p.name)}</h3><div class="small muted">${esc(p.nation || '')} · ${esc(p.league || '')}</div></div><div class="score-ring" style="--p:${p.rating};width:92px;height:92px"><b style="font-size:24px">${p.rating}</b></div></div><div class="flex gap wrap mb12">${roles.map((r, i) => `<span class="pill ${i === 0 ? '' : 'gray'}">${r.role} · ${r.score}</span>`).join('')}</div>${attrs.map(a => `<div class="bar-row"><span class="lbl">${a.label}</span><div class="bar"><i style="width:${a.v}%"></i></div><b>${a.v}</b></div>`).join('')}<div class="divider"></div><h4 class="gold small mb8">أفضل المراكز</h4><p class="small">المركز الطبيعي: <b>${esc(p.position)}</b> — أفضل توزيع: ${roles.map(r => `${r.role} (${r.score})`).join('، ')}.</p><h4 class="gold small mb8 mt12">خطة تطوير</h4><ul class="list-clean">${plan.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="flex gap mt12 wrap"><button class="btn btn-ghost btn-sm" onclick="navigate('builder')">أضفه إلى تشكيلتك</button><button class="btn btn-gold btn-sm" onclick="pAsk('${esc(p.name)}','${esc(p.position)}')">اسأل المساعد عنه</button></div>`;
}
function pAsk(name, position) { sessionStorage.setItem('pesai_prompt', `أعطني خطة تطوير عملية للاعب ${name} في مركز ${position} خلال 30 يومًا.`); navigate('assistant'); }
function pCompare() { const a = state.players.find(p => String(p.id) === String($('#pCmpA').value)), b = state.players.find(p => String(p.id) === String($('#pCmpB').value)); if (!a || !b) return; const rows = [['rating','التقييم'],['pace','السرعة'],['shooting','التسديد'],['passing','التمرير'],['dribbling','المراوغة'],['defending','الدفاع'],['physical','البدني']].map(([k, label]) => ({ label, a: a[k] || 0, b: b[k] || 0 })); const winsA = rows.filter(r => r.a > r.b).length, winsB = rows.filter(r => r.b > r.a).length; $('#pCmpOut').innerHTML = `<div class="note mb12"><div><b>${esc(a.name)}</b> ${winsA} — ${winsB} <b>${esc(b.name)}</b></div></div>${rows.map(r => `<div class="bar-row"><span class="lbl">${r.label}</span><div class="bar"><i style="width:${r.a}%"></i></div><b>${r.a}</b><span class="small muted">×</span><div class="bar"><i style="width:${r.b}%;background:linear-gradient(90deg,#3b82f6,#93c5fd)"></i></div><b>${r.b}</b></div>`).join('')}`; }
/* ------------------------------- assistant ------------------------------- */
let chatMessages = [];
function renderAssistant() {
  chatMessages = [];
  $('#app').innerHTML = `<div class="container section"><div class="section-head"><div><h1 class="section-title">PRO <span>AI ASSISTANT</span></h1><p class="section-sub">مساعد eFootball باللهجة المصرية — كتابة وصوتًا، مع متابعة فريقك ونتائجك.</p></div><div class="flex gap"><span class="pill ${isPro() ? '' : 'gray'}">${isPro() ? 'PRO' : 'FREE'}</span><span class="pill gray" id="aRemain">—</span></div></div>
    <div class="grid two" style="align-items:start"><div class="card"><div class="flex between center mb12"><h3 class="card-title" style="margin:0">المحادثة</h3><button class="btn btn-ghost btn-sm" onclick="aClear()">محادثة جديدة</button></div><div class="chat" id="aChat"></div>
      <div class="chat-input"><button class="mic-btn" id="aMic" title="تحدث">${I.mic}</button><textarea id="aMsg" placeholder="اكتب سؤالك... مثال: كيف أطوّر خط دفاعي؟"></textarea><button class="send-btn" id="aSend" title="إرسال">${I.send}</button></div>
      <div class="flex between center mt8 wrap gap"><label class="small muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="aVoice" checked> نطق الردود صوتيًا</label><span class="small muted" id="aVoiceStatus">الصوت: جاهز</span></div>
      <div class="flex gap wrap mt12">${['كيف أطوّر فريقي؟','أفضل خطة لتشكيلتي','حلّل نتائج مبارياتي','اقترح أهدافًا للأسبوع القادم','ما هي باقات الاشتراك؟'].map(q => `<button class="btn btn-ghost btn-sm" onclick="aSend('${esc(q)}')">${q}</button>`).join('')}</div>
    </div><div><div class="card mb12"><h3 class="card-title" style="margin-top:0">سياق فريقك</h3><div id="aContext"><div class="empty">جارٍ التحميل...</div></div></div>
      <div class="card"><h3 class="card-title" style="margin-top:0">حدود مهمة</h3><ul class="list-clean small"><li>لا نطلب كلمة مرور Konami ID أو بيانات دخول اللعبة.</li><li>لا ننفذ تسجيل دخول آلي أو تحريك لاعبين أو شراء عملات.</li><li>التحليل يعتمد على الصور والبيانات التي تقدمها أنت.</li><li>أي تحكم باللعبة لا يُفعّل إلا بتكامل رسمي مصرح به من Konami.</li></ul><div class="note info mt12"><div>المساعد يدعم الكتابة والصوت. التعرف على الكلام يحتاج إذن الميكروفون ومتصفح داعم.</div></div></div></div></div></div>${footerHtml()}`;
  aAddMsg(`أهلًا ${state.user.name.split(' ')[0]} <span class="svg-icon">${I.wave}</span>\nأنا مساعد PES AI PRO. اسألني عن تشكيلتك، تطوير لاعبيك، نتائج مبارياتك، أو خطط اللعب.`, 'ai', isPro() ? 'PRO' : 'FREE');
  aLoadContext();
  const pre = sessionStorage.getItem('pesai_prompt'); if (pre) { sessionStorage.removeItem('pesai_prompt'); $('#aMsg').value = pre; }
  $('#aSend').onclick = () => aSend();
  $('#aMsg').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aSend(); } });
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $('#aMic').onclick = () => toast('التعرف على الكلام غير مدعوم في هذا المتصفح', 'err'); $('#aVoiceStatus').textContent = 'المتصفح لا يدعم الميكروفون'; }
  else { const rec = new SR(); rec.lang = 'ar-EG'; rec.interimResults = false; rec.maxAlternatives = 1; $('#aMic').onclick = () => { if (rec.running) { rec.stop(); return; } try { rec.start(); $('#aMic').classList.add('rec'); $('#aVoiceStatus').textContent = 'أستمع إليك...'; rec.onresult = e => { const t = e.results[0][0].transcript; $('#aMsg').value = t; aSend(t); }; rec.onerror = () => { $('#aMic').classList.remove('rec'); $('#aVoiceStatus').textContent = 'تعذر استخدام الميكروفون'; toast('تعذر الوصول للميكروفون', 'err'); }; rec.onend = () => { $('#aMic').classList.remove('rec'); $('#aVoiceStatus').textContent = 'الصوت: جاهز'; }; } catch (e) { toast('تعذر تشغيل الميكروفون', 'err'); } }; }
}
function aAddMsg(text, who, meta) { const el = document.createElement('div'); el.className = 'msg ' + who; el.innerHTML = esc(text) + (meta ? `<span class="meta">${esc(meta)}</span>` : ''); $('#aChat').appendChild(el); $('#aChat').scrollTop = $('#aChat').scrollHeight; return el; }
function aSpeak(text) { if (!$('#aVoice')?.checked || !window.speechSynthesis) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/[•#*_`>]/g, '').slice(0, 900)); u.lang = 'ar-EG'; const v = speechSynthesis.getVoices().find(v => v.lang?.startsWith('ar')); if (v) u.voice = v; u.rate = .98; speechSynthesis.speak(u); } catch (e) { } }
async function aSend(text) {
  const m = (text || $('#aMsg').value).trim(); if (!m) return;
  aAddMsg(m, 'me'); $('#aMsg').value = ''; const pending = aAddMsg('جارٍ التفكير...', 'ai');
  const r = await Backend.assistant(m);
  if (r.error) { pending.innerHTML = '<span class="svg-icon">' + I.warning + '</span> ' + esc(r.error); toast(r.error, 'err'); if (r.upgrade) navigate('subscriptions'); return; }
  const rep = r.reply; pending.innerHTML = esc(rep.text) + `<span class="meta">${rep.isLocal ? 'محرك محلي' : esc(rep.engine || 'AI')} ${r.remaining != null ? '· متبقٍ اليوم: ' + r.remaining : '· PRO'}</span>`;
  $('#aRemain').textContent = r.remaining != null ? `متبقٍ ${r.remaining} اليوم` : 'PRO غير محدود';
  aSpeak(rep.text);
}
function aClear() { chatMessages = []; $('#aChat').innerHTML = ''; aAddMsg('محادثة جديدة — كيف أقدر أساعدك؟', 'ai'); if (window.speechSynthesis) speechSynthesis.cancel(); }
async function aLoadContext() {
  const [t, m] = await Promise.all([Backend.getTeams(), Backend.getMatches()]); const team = t.teams?.[0], stats = m.stats;
  $('#aContext').innerHTML = `${team ? `<div class="kv"><span>التشكيلة</span><b>${esc(team.name)} (${esc(team.formation)})</b></div><div class="kv"><span>التقييم / الكيمياء</span><b>${team.rating} / ${team.chemistry}</b></div>` : `<div class="note warn mb8"><div>لا توجد تشكيلة محفوظة — <a href="#/builder" class="gold">ابنِ واحدة الآن</a>.</div></div>`}<div class="kv"><span>المباريات</span><b>${stats?.played || 0}</b></div><div class="kv"><span>فوز / تعادل / خسارة</span><b>${stats ? `${stats.wins} / ${stats.draws} / ${stats.losses}` : '0 / 0 / 0'}</b></div><div class="kv"><span>الباقة</span><b>${isPro() ? 'PRO' : 'FREE'}</b></div>`;
}

/* ------------------------------- store ------------------------------- */
function renderStore() {
  $('#app').innerHTML = `<div class="container section"><div class="section-head"><div><h1 class="section-title">PRO <span>STORE</span></h1><p class="section-sub">خدمات رقمية احترافية — لا نبيع حسابات ولا ننقل ملكيتها.</p></div><button class="btn btn-ghost btn-sm" onclick="sOpenCart()">🛒 السلة (<span id="sCartCount">${state.cart.reduce((a, i) => a + i.qty, 0)}</span>)</button></div>
    <div class="card mb16"><div class="form-row"><div class="field"><label>ابحث في المتجر</label><input class="input" id="sSearch" placeholder="اسم الخدمة..." oninput="sRender()"></div><div class="field"><label>التصنيف</label><select class="input" id="sCat" onchange="sRender()"><option value="all">الكل</option><option value="analysis">تحليل</option><option value="squad">تشكيلات</option><option value="coaching">تدريب واستشارة</option></select></div></div><div class="note"><div><span class="svg-icon">${I.info}</span> جميع الخدمات رقمية وتُسلّم داخل المنصة. لا تشمل بيع أو نقل لحسابات اللعبة.</div></div></div>
    <div class="grid cards" id="sGrid"></div><div class="card mt16"><h3 class="card-title" style="margin-top:0">طلباتي</h3><div id="sOrders" class="empty">سجّل الدخول لعرض طلباتك.</div></div></div>${footerHtml()}`;
  sRender(); sLoadOrders();
}
function sRender() {
  const q = ($('#sSearch')?.value || '').toLowerCase(), cat = $('#sCat')?.value || 'all';
  const list = state.products.filter(p => (!q || (p.name + ' ' + (p.shortDescription || '')).toLowerCase().includes(q)) && (cat === 'all' || p.category === cat));
  const grid = $('#sGrid'); if (!grid) return; grid.innerHTML = list.map(productCard).join('') || '<div class="empty">لا توجد خدمات مطابقة.</div>';
}
function productModal(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  openModal(p.name, `<img src="${esc(p.imageUrl || 'images/efootball-hero.jpg')}" alt="" style="width:100%;height:170px;object-fit:cover;border-radius:14px;margin-bottom:12px"><div class="price mb8" style="font-size:20px">${money(p.price)}</div><p class="small" style="color:#cfcfcf">${esc(p.description || p.shortDescription || '')}</p><h4 class="gold small mt12 mb8">ما تحصل عليه</h4><ul class="list-clean small">${(p.details || []).map(d => `<li>${esc(d)}</li>`).join('')}</ul><div class="note mt12"><div>يتم تنفيذ الخدمة بعد تأكيد الدفع من الإدارة.</div></div><button class="btn btn-gold btn-block mt12" onclick="addToCart('${esc(p.id)}')">أضف إلى السلة</button>`);
}
function addToCart(id) {
  if (!state.user) { toast('سجّل الدخول أولًا حتى تتمكن من الشراء', 'err'); navigate('auth?next=store'); return; }
  const item = state.cart.find(i => i.id === id); if (item) item.qty = Math.min(5, item.qty + 1); else state.cart.push({ id, qty: 1 }); saveCart(); toast('تمت الإضافة إلى السلة'); const c = $('#sCartCount'); if (c) c.textContent = state.cart.reduce((a, i) => a + i.qty, 0);
}
function sOpenCart() {
  if (!state.user) { toast('سجّل الدخول أولًا للوصول إلى السلة', 'err'); navigate('auth?next=store'); return; }
  const rows = state.cart.map(i => ({ ...i, p: state.products.find(p => p.id === i.id) })).filter(i => i.p); const total = rows.reduce((a, i) => a + i.p.price * i.qty, 0);
  openModal('سلة الطلبات', `${rows.length ? rows.map(i => `<div class="cart-row"><div><b>${esc(i.p.name)}</b><div class="small muted">${money(i.p.price)}</div></div><div class="flex center gap"><div class="qty"><button onclick="sQty('${esc(i.id)}',-1)">−</button><span>${i.qty}</span><button onclick="sQty('${esc(i.id)}',1)">+</button></div><button class="btn btn-danger btn-sm" onclick="sRemove('${esc(i.id)}')">إزالة</button></div></div>`).join('') : '<div class="empty">السلة فارغة.</div>'}<div class="kv mt12"><span>الإجمالي</span><b>${money(total)}</b></div><div class="field mt12"><label>طريقة الدفع</label><select class="input" id="sPayMethod"><option value="instapay">InstaPay — ${esc(state.settings.instapayHandle || '')}</option><option value="vodafone">Vodafone Cash — ${esc(state.settings.vodafoneCash || '')}</option><option value="manual">تحويل يدوي آخر</option></select></div><div class="field"><label>رقم عملية الدفع / المرجع</label><input class="input" id="sPayRef" placeholder="مثال: 123456789"></div><div class="note warn"><div>${esc(state.settings.paymentsNote || '')}</div></div><button class="btn btn-gold btn-block mt12" onclick="sCheckout()" ${rows.length ? '' : 'disabled'}>إرسال الطلب (${money(total)})</button><div class="hint center-x mt8">لن يتم تفعيل الطلب قبل تأكيد الدفع.</div>`);
}
function sQty(id, d) { const i = state.cart.find(x => String(x.id) === String(id)); if (!i) return; i.qty += d; if (i.qty <= 0) state.cart = state.cart.filter(x => x.id !== id); saveCart(); sOpenCart(); const c = $('#sCartCount'); if (c) c.textContent = state.cart.reduce((a, x) => a + x.qty, 0); }
function sRemove(id) { state.cart = state.cart.filter(x => String(x.id) !== String(id)); saveCart(); sOpenCart(); const c = $('#sCartCount'); if (c) c.textContent = state.cart.reduce((a, x) => a + x.qty, 0); }
async function sCheckout() {
  if (!state.user) { navigate('auth?next=store'); return; }
  const rows = state.cart.map(i => ({ ...i, p: state.products.find(p => p.id === i.id) })).filter(i => i.p); if (!rows.length) return;
  const ref = ($('#sPayRef')?.value || '').trim(), method = $('#sPayMethod')?.value || 'manual'; if (ref.length < 4) return toast('أدخل رقم عملية الدفع', 'err');
  loading(true); let last = null;
  for (const i of rows) { const r = await Backend.createOrder({ product_id: i.p.id, quantity: i.qty, total: i.p.price * i.qty, payment_method: method, payment_reference: ref }); if (r.error) { loading(false); return toast(r.error, 'err'); } last = r; }
  loading(false); state.cart = []; saveCart(); closeModal(); toast('تم إرسال الطلب #' + last.order_id + ' بنجاح'); sLoadOrders(); const c = $('#sCartCount'); if (c) c.textContent = '0';
}
async function sLoadOrders() {
  const box = $('#sOrders'); if (!box) return;
  if (!state.user) { box.innerHTML = '<div class="empty">سجّل الدخول لعرض طلباتك.</div>'; return; }
  const r = await Backend.getOrders();
  const rows = (r.orders || []).filter(o => o.type === 'product');
  box.innerHTML = rows.map(o => `<div class="cart-row"><div><b>${esc(o.product_name || 'خدمة')}</b><div class="small muted">#${o.id} · ${dateTimeAr(o.created_at)} · ${money(o.total)}</div></div>${statusPill(o.status)}</div>`).join('') || '<div class="empty">لا توجد طلبات بعد.</div>';
}

/* ------------------------------- subscriptions ------------------------------- */
function renderSubscriptions() {
  const p = state.plan;
  $('#app').innerHTML = `<div class="container section"><div class="section-head"><div><h1 class="section-title">الباقات <span>والاشتراك</span></h1><p class="section-sub">اختر الباقة المناسبة — التفعيل بعد تأكيد الدفع من الإدارة فقط.</p></div><span class="pill ${isPro() ? '' : 'gray'}">${isPro() ? 'PRO' : 'FREE'}</span></div>
    <div class="card mb16"><div class="flex between center wrap gap"><div><h3 class="card-title" style="margin:0">حالة اشتراكك الحالية</h3><div class="small muted" id="subStatus">${isPro() ? `باقة PRO مفعّلة — تنتهي ${dateAr(state.user.plan_expires_at)}` : 'الباقة المجانية FREE — يمكنك الترقية إلى PRO.'}</div></div><div class="flex gap wrap"><a class="btn btn-ghost btn-sm" href="#/account">طلباتي</a><button class="btn btn-ghost btn-sm" onclick="navigate('assistant')">افتح المساعد</button></div></div></div>
    <div class="grid two" id="subPlans">${state.plans.map(planCard).join('')}</div>
    <div class="card mt16"><h3 class="card-title" style="margin-top:0">سجل طلبات الاشتراك</h3><div id="subOrders" class="empty">لا توجد طلبات اشتراك بعد.</div></div>
    <div class="note info mt16"><div>🔒 لا يتم تفعيل PRO قبل تأكيد الدفع. رقم العملية يُراجع من الإدارة، وبعدها يصل إشعار التفعيل.</div></div></div>${footerHtml()}`;
  subLoadOrders();
}
function subscribeModal(planId) {
  if (!state.user) { toast('سجّل الدخول أولًا للاشتراك', 'err'); navigate('auth?next=subscriptions'); return; }
  const plan = state.plans.find(p => p.id === planId); if (!plan) return;
  openModal('إتمام الاشتراك — ' + plan.name, `<div class="note mb12"><div>أرسل رقم عملية الدفع بعد التحويل. <b>لن يتم التفعيل قبل تأكيد الإدارة.</b></div></div><div class="field"><label>طريقة الدفع</label><select class="input" id="subMethod"><option value="instapay">InstaPay — ${esc(state.settings.instapayHandle || '')}</option><option value="vodafone">Vodafone Cash — ${esc(state.settings.vodafoneCash || '')}</option><option value="manual">تحويل يدوي آخر</option></select></div><div class="field"><label>رقم عملية الدفع / المرجع</label><input class="input" id="subRef" placeholder="رقم العملية"></div><div class="note warn"><div>${esc(state.settings.paymentsNote || '')}</div></div><button class="btn btn-gold btn-block mt12" onclick="subConfirm('${esc(plan.id)}')">إرسال طلب الاشتراك</button>`);
}
async function subConfirm(planId) {
  const reference = ($('#subRef')?.value || '').trim(), method = $('#subMethod')?.value || 'manual'; if (reference.length < 4) return toast('أدخل رقم عملية الدفع', 'err');
  loading(true); const r = await Backend.subscribe({ plan_id: planId, payment_method: method, reference }); loading(false);
  if (r.error) return toast(r.error, 'err'); closeModal(); toast('تم إرسال الطلب — بانتظار تأكيد الدفع'); subLoadOrders();
}
async function subLoadOrders() {
  const box = $('#subOrders'); if (!box) return;
  if (!state.user) { box.innerHTML = '<div class="empty">سجّل الدخول لعرض طلباتك.</div>'; return; }
  const r = await Backend.getOrders(); const rows = (r.orders || []).filter(o => o.type === 'subscription');
  box.innerHTML = rows.map(o => `<div class="cart-row"><div><b>اشتراك ${esc(o.plan_name || '')}</b><div class="small muted">#${o.id} · ${dateTimeAr(o.created_at)} · ${money(o.total)} · ${esc(o.payment_method || '')}</div>${o.admin_note ? `<div class="small muted">ملاحظة الإدارة: ${esc(o.admin_note)}</div>` : ''}</div>${statusPill(o.status)}</div>`).join('') || '<div class="empty">لا توجد طلبات اشتراك بعد.</div>';
}

/* ------------------------------- matches ------------------------------- */
let mImage = '';
function renderMatches() {
  mImage = '';
  $('#app').innerHTML = `<div class="container section"><div class="section-head"><div><h1 class="section-title">MATCH <span>ANALYSIS</span></h1><p class="section-sub">سجّل نتائج مبارياتك وحلّل أداءك — بدون أي اتصال مباشر بحساب اللعبة.</p></div><button class="btn btn-gold btn-sm" onclick="mAnalyze()">🧠 حلّل سجل مبارياتي</button></div>
    <div class="stats mb16" id="mStats"></div>
    <div class="grid two" style="align-items:start"><div class="card"><h3 class="card-title" style="margin-top:0">تسجيل مباراة جديدة</h3><form id="mForm" onsubmit="mSave(event)"><div class="field"><label>اسم الخصم</label><input class="input" name="opponent" placeholder="اسم الفريق الخصم" required></div><div class="form-row"><div class="field"><label>أهدافنا</label><input class="input" name="goals_for" type="number" min="0" max="99" value="0" required></div><div class="field"><label>أهداف الخصم</label><input class="input" name="goals_against" type="number" min="0" max="99" value="0" required></div></div><div class="form-row"><div class="field"><label>البطولة</label><input class="input" name="competition" placeholder="دوري / ودية"></div><div class="field"><label>التاريخ</label><input class="input" name="match_date" type="date"></div></div><div class="field"><label>ملاحظات</label><textarea class="input" name="notes" placeholder="ما الذي حدث؟"></textarea></div><div class="field"><label>صورة النتيجة (اختياري)</label><input class="input" type="file" accept="image/*" onchange="mUpload(this)"></div><div class="error-text" id="mError"></div><button class="btn btn-gold btn-block" type="submit">حفظ المباراة</button></form></div>
    <div class="card"><h3 class="card-title" style="margin-top:0">تحليل الأداء</h3><div id="mReport" class="empty">اضغط "حلّل سجل مبارياتي" للحصول على تحليل مبني على نتائجك الفعلية.</div></div></div>
    <div class="section-head mt16"><div><h2 class="section-title">سجل <span>المباريات</span></h2></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>الخصم</th><th>النتيجة</th><th>البطولة</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody id="mRows"></tbody></table></div></div>
    <div class="note info mt16"><div><span class="svg-icon">${I.info}</span> التحليل يعتمد فقط على المباريات التي تسجلها بنفسك. لا ندّعي اتصالًا مباشرًا بحساب اللعبة.</div></div></div>${footerHtml()}`;
  mLoad();
}
async function mLoad() {
  const r = await Backend.getMatches(); const s = r.stats || { played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 };
  const stats = $('#mStats'); if (stats) stats.innerHTML = `<div class="stat"><b>${s.played}</b><span>مباريات</span></div><div class="stat"><b style="color:#86efac">${s.wins}</b><span>فوز</span></div><div class="stat"><b style="color:#fcd34d">${s.draws}</b><span>تعادل</span></div><div class="stat"><b style="color:#fca5a5">${s.losses}</b><span>خسارة</span></div><div class="stat"><b>${s.goals_for}</b><span>أهداف لنا</span></div><div class="stat"><b>${s.goals_against}</b><span>أهداف علينا</span></div>`;
  const rows = $('#mRows'); if (!rows) return;
  rows.innerHTML = (r.matches || []).map(m => { const res = m.goals_for > m.goals_against ? 'فوز' : m.goals_for === m.goals_against ? 'تعادل' : 'خسارة'; const cls = res === 'فوز' ? 'green' : res === 'خسارة' ? 'red' : 'gray'; return `<tr><td>${esc(m.opponent)}${m.image_url ? ` <a href="${esc(m.image_url)}" target="_blank" class="small gold">📷</a>` : ''}</td><td>${m.goals_for} - ${m.goals_against}</td><td>${esc(m.competition || '—')}</td><td>${dateAr(m.match_date)}</td><td><span class="pill ${cls}">${res}</span></td><td><button class="btn btn-danger btn-sm" onclick="mDelete('${esc(m.id)}')">حذف</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">لا توجد مباريات مسجلة.</td></tr>';
}
async function mSave(e) {
  e.preventDefault(); const f = e.target; const err = $('#mError'); if (err) err.style.display = 'none';
  const r = await Backend.saveMatch({ opponent: f.opponent.value, goals_for: f.goals_for.value, goals_against: f.goals_against.value, competition: f.competition.value, match_date: f.match_date.value, notes: f.notes.value, image_url: mImage });
  if (r.error) { if (err) { err.textContent = r.error; err.style.display = 'block'; } return; }
  mImage = ''; f.reset(); f.goals_for.value = 0; f.goals_against.value = 0; toast('تم حفظ المباراة'); mLoad();
}
async function mUpload(input) { const file = input.files[0]; if (!file) return; loading(true); const r = await Backend.uploadImage(file); loading(false); if (r.error) return toast(r.error, 'err'); mImage = r.url; toast('تم رفع الصورة'); }
async function mDelete(id) { if (!confirm('حذف المباراة؟')) return; const r = await Backend.deleteMatch(id); if (r.error) return toast(r.error, 'err'); toast('تم الحذف'); mLoad(); }
async function mAnalyze() {
  loading(true); const r = await Backend.analyzeMatches(); loading(false); if (r.error) return toast(r.error, 'err');
  const rep = r.report; const box = $('#mReport'); if (!box) return; box.classList.remove('hidden'); box.classList.add('card');
  box.innerHTML = `<div class="flex between center mb12"><div><div class="card-title" style="margin:0">تقرير تحليل الأداء</div><div class="small muted">آخر ${rep.record.played} مباراة</div></div><div class="score-ring" style="--p:${rep.win_rate};width:88px;height:88px"><b style="font-size:22px">${rep.win_rate}%<small>نسبة الفوز</small></b></div></div><div class="stats mb12"><div class="stat"><b>${rep.record.wins}</b><span>فوز</span></div><div class="stat"><b>${rep.record.draws}</b><span>تعادل</span></div><div class="stat"><b>${rep.record.losses}</b><span>خسارة</span></div><div class="stat"><b>${rep.goals.avg_scored}</b><span>أهداف/مباراة</span></div><div class="stat"><b>${rep.goals.avg_conceded}</b><span>استقبل/مباراة</span></div></div><h4 class="gold small mb8">نقاط الضعف</h4><ul class="list-clean">${rep.weaknesses.map(x => `<li>${esc(x)}</li>`).join('')}</ul><h4 class="gold small mb8 mt12">تحسينات مقترحة</h4><ul class="list-clean">${rep.suggestions.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

/* ------------------------------- account ------------------------------- */
async function renderAccount() {
  $('#app').innerHTML = `<div class="container section"><div class="section-head"><div><h1 class="section-title">حسابي</h1><p class="section-sub">الملف الشخصي، الأمان، الاشتراك، الطلبات، والإشعارات.</p></div><div class="flex gap"><span class="pill ${isPro() ? '' : 'gray'}">${isPro() ? 'PRO' : 'FREE'}</span><button class="btn btn-danger btn-sm" onclick="aLogout()">خروج</button></div></div>
    <div class="grid two" style="align-items:start"><div>
      <div class="card mb12"><div class="flex between center mb12"><h3 class="card-title" style="margin:0">الملف الشخصي</h3><span class="pill green">نشط</span></div><div id="acProfile"></div><form id="acProfileForm" onsubmit="acSaveProfile(event)" class="mt12"><div class="field"><label>الاسم</label><input class="input" name="name" required></div><div class="form-row"><div class="field"><label>رقم الهاتف</label><input class="input" name="phone" required></div><div class="field"><label>البريد الإلكتروني</label><input class="input" name="email" type="email" required></div></div><div class="error-text" id="acProfileError"></div><button class="btn btn-gold btn-block btn-sm" type="submit">حفظ التعديلات</button></form></div>
      <div class="card mb12"><h3 class="card-title" style="margin-top:0">الأمان — الرمز السري</h3><div id="acPin" class="small muted mb8"></div><div class="form-row"><div class="field"><label>الرمز الحالي</label><input class="input" id="acCurrentPin" inputmode="numeric" maxlength="4" pattern="[0-9]*"></div><div class="field"><label>الرمز الجديد (4 أرقام)</label><input class="input" id="acNewPin" inputmode="numeric" maxlength="4" pattern="[0-9]*"></div></div><div class="flex gap wrap"><button class="btn btn-ghost btn-sm" onclick="acSetPin()">تعيين / تغيير</button><button class="btn btn-danger btn-sm" onclick="acRemovePin()">إزالة</button></div><div class="hint mt8">بدون رمز سري، يتم التحقق عند الدخول برمز OTP.</div></div>
      <div class="card"><h3 class="card-title" style="margin-top:0">إعدادات الإشعارات والخصوصية</h3><div id="acSettings"></div><button class="btn btn-gold btn-block btn-sm mt12" onclick="acSaveSettings()">حفظ الإعدادات</button></div>
    </div><div>
      <div class="card mb12"><h3 class="card-title" style="margin-top:0">اشتراكي</h3><div id="acSub"></div><a class="btn btn-gold btn-block btn-sm mt12" href="#/subscriptions">إدارة الاشتراك</a></div>
      <div class="card mb12" id="notifications"><div class="flex between center mb12"><h3 class="card-title" style="margin:0">الإشعارات</h3><button class="btn btn-ghost btn-sm" onclick="acReadAll()">تعليم الكل كمقروء</button></div><div id="acNotifs"></div></div>
      <div class="card mb12"><h3 class="card-title" style="margin-top:0">طلباتي</h3><div id="acOrders"></div></div>
      <div class="card"><h3 class="card-title" style="margin-top:0">منطقة الخطر</h3><p class="small muted">حذف الحساب يحذف كل بياناتك نهائيًا، ويحتاج تأكيدًا آمنًا.</p><button class="btn btn-danger btn-block btn-sm mt12" onclick="acDelete()">حذف الحساب نهائيًا</button></div>
    </div></div></div>${footerHtml()}`;
  acLoadAll();
}
async function acLoadAll() {
  const u = state.user;
  const profile = $('#acProfile'); if (profile) profile.innerHTML = `<div class="kv"><span>الاسم</span><b>${esc(u.name)}</b></div><div class="kv"><span>الهاتف</span><b>${esc(u.phone)}</b></div><div class="kv"><span>البريد</span><b>${esc(u.email)}</b></div><div class="kv"><span>عضو منذ</span><b>${dateAr(u.created_at)}</b></div>`;
  const f = $('#acProfileForm'); if (f) { f.elements.name.value = u.name; f.elements.phone.value = u.phone; f.elements.email.value = u.email; }
  const pin = $('#acPin'); if (pin) pin.innerHTML = u.has_pin ? '<span class="svg-icon">' + I.lock + '</span> لديك رمز سري مفعّل.' : '<span class="svg-icon">' + I.info + '</span> لا يوجد رمز سري — الدخول بـ OTP.';
  const [st, notif, orders] = await Promise.all([Backend.getSettings(), Backend.getNotifications(), Backend.getOrders()]);
  const settings = st.settings || {};
  const map = [['notify_orders','إشعارات الطلبات'],['notify_subscription','إشعارات الاشتراك'],['notify_platform','تحديثات المنصة'],['notify_ai','نتائج تحليل الذكاء الاصطناعي'],['public_stats','إظهار إحصاءاتي بشكل عام'],['marketing','رسائل تسويقية']];
  const sb = $('#acSettings'); if (sb) sb.innerHTML = map.map(([k, label]) => `<label class="flex between center small" style="padding:7px 0;border-bottom:1px dashed rgba(255,255,255,.07)"><span>${label}</span><input type="checkbox" data-set="${k}" ${settings[k] ? 'checked' : ''}></label>`).join('');
  const sub = $('#acSub'); if (sub) sub.innerHTML = `<div class="kv"><span>الباقة</span><b>${isPro() ? 'PRO' : 'FREE'}</b></div><div class="kv"><span>الحالة</span><b>${state.plan?.subscription ? 'مفعّل حتى ' + dateAr(state.plan.subscription.expires_at) : 'الباقة الأساسية'}</b></div><div class="kv"><span>تاريخ الانضمام</span><b>${dateAr(u.created_at)}</b></div>`;
  const nb = $('#acNotifs'); if (nb) nb.innerHTML = (notif.notifications || []).map(x => `<div class="cart-row" style="align-items:flex-start"><div><b>${esc(x.title)}</b><div class="small muted">${esc(x.body || '')}</div><div class="small muted">${dateTimeAr(x.created_at)}</div></div>${x.is_read ? '<span class="pill gray">مقروء</span>' : `<button class="btn btn-ghost btn-sm" onclick="acReadOne('${esc(x.id)}')">تعليم كمقروء</button>`}</div>`).join('') || '<div class="empty">لا إشعارات.</div>';
  const ob = $('#acOrders'); if (ob) ob.innerHTML = (orders.orders || []).map(x => `<div class="cart-row"><div><b>${esc(x.product_name || x.plan_name || 'طلب')}</b><div class="small muted">#${x.id} · ${money(x.total)} · ${dateTimeAr(x.created_at)}</div></div>${statusPill(x.status)}</div>`).join('') || '<div class="empty">لا طلبات.</div>';
}
async function acSaveProfile(e) { e.preventDefault(); const f = e.target; const err = $('#acProfileError'); if (err) err.style.display = 'none'; const r = await Backend.updateProfile({ name: f.elements.name.value, phone: f.elements.phone.value, email: f.elements.email.value }); if (r.error) { if (err) { err.textContent = r.error; err.style.display = 'block'; } return; } state.user = r.user; state.plan = r.plan; toast('تم تحديث البيانات'); renderShell(); renderAccount(); }
async function acSetPin() { const pin = ($('#acNewPin')?.value || '').trim(), current = ($('#acCurrentPin')?.value || '').trim(); if (!/^\d{4}$/.test(pin)) return toast('الرمز يجب أن يكون 4 أرقام', 'err'); const r = await Backend.setPin({ pin, current }); if (r.error) return toast(r.error, 'err'); toast('تم حفظ الرمز'); renderAccount(); }
async function acRemovePin() { if (!confirm('إزالة الرمز السري؟')) return; const r = await Backend.removePin({ current: ($('#acCurrentPin')?.value || '').trim() }); if (r.error) return toast(r.error, 'err'); toast('تمت الإزالة'); renderAccount(); }
async function acSaveSettings() { const body = {}; $$('[data-set]').forEach(cb => body[cb.dataset.set] = cb.checked); const r = await Backend.updateSettings(body); if (r.error) return toast(r.error, 'err'); toast('تم حفظ الإعدادات'); }
async function acReadAll() { await Backend.markAllNotifications(); acLoadAll(); loadBell(true); }
async function acReadOne(id) { await Backend.markNotification(id); acLoadAll(); loadBell(true); }
async function aLogout() {
  try { await Backend.logout(); } catch (e) { }
  state.user = null; state.plan = null; state.cart = []; saveCart(); clearSession();
  _bellAt = 0; toast('تم تسجيل الخروج'); renderShell(); navigate('home');
}
function acDelete() {
  openModal('تأكيد حذف الحساب', `<div class="note warn mb12"><div>سيتم حذف جميع بياناتك نهائيًا. لا يمكن التراجع.</div></div><div class="field"><label>اكتب كلمة "حذف" للتأكيد</label><input class="input" id="acDelConfirm"></div><div class="field"><label>الرمز السري (للتأكيد)</label><input class="input" id="acDelOtp" inputmode="numeric" maxlength="6"></div><div class="note info" id="acDelInfo"></div><button class="btn btn-danger btn-block mt12" id="acDelBtn">حذف نهائي</button>`);
  let stage = 0;
  $('#acDelBtn').onclick = async () => {
    const confirmText = ($('#acDelConfirm')?.value || '').trim(); if (confirmText !== 'حذف') return toast('اكتب كلمة "حذف"', 'err');
    const payload = { confirm: 'حذف', pin: ($('#acDelOtp')?.value || '').trim() };
    const r = await Backend.deleteAccount(payload);
    if (r.requires_otp) { stage = 1; $('#acDelInfo').innerHTML = r.dev_code ? `رمز التحقق للتجربة: <b>${esc(r.dev_code)}</b>` : 'أدخل رمز التحقق المرسل لهاتفك'; return; }
    if (r.error) return toast(r.error, 'err');
    toast('تم حذف الحساب'); state.user = null; state.plan = null; renderShell(); navigate('home');
  };
}
/* ------------------------------- init ------------------------------- */
document.addEventListener('click', e => {
  const need = e.target.closest('[data-need]');
  if (need) { toast('سيتم تفعيل هذا الزر بعد ضبط بيانات التواصل', 'err'); }
});
window.addEventListener('hashchange', () => { renderRoute(); });
window.addEventListener('offline', () => toast('انقطع الاتصال بالإنترنت — المنصة هتعرض بياناتك المحفوظة', 'err'));
window.addEventListener('online', () => {
  toast('رجع الاتصال — جارٍ تحديث البيانات');
  _dbIssueKey = ''; _dbIssueAt = 0;
  try { refreshPublicData(); } catch (e) { }
  if (state.user) {
    loadBell(true);
    Backend.doc('users/' + state.user.id)
      .then(p => p && Backend.planInfo(p).then(pl => { state.plan = pl; persistSession(); renderShell(); }).catch(() => { }))
      .catch(() => { });
  }
});
function startApp() {
  const app = $('#app'); if (app && !app.dataset.ready) { app.dataset.ready = '1'; app.innerHTML = '<div class="container section"><div class="card"><div class="empty">جارٍ تحميل منصة PES AI PRO...</div></div></div>'; }
  boot().catch(e => { console.error('BOOT ERROR', e); toast('خطأ في تحميل الصفحة: ' + e.message, 'err'); });
}
window.addEventListener('unhandledrejection', e => {
  console.error('UNHANDLED', e.reason);
  /* أي خطأ غير معالج يظهر للمستخدم برسالة عربية بدل صمت تام */
  try { toast(fbErrMsg(e.reason || {}), 'err'); } catch (x) { }
});
document.addEventListener('DOMContentLoaded', startApp);
if (document.readyState !== 'loading') startApp();






