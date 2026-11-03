/* ═══════════════════════════════════════════════════════════════
   PES AI PRO — app.js
   YOUR TEAM. YOUR POWER. YOUR AI.
   Firebase Auth + Firestore + Gemini (Firebase AI Logic)
   ═══════════════════════════════════════════════════════════════ */

import {
  initializeApp, getApps, deleteApp,
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  linkWithPopup, sendPasswordResetEmail, updatePassword, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential,
  RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber, PhoneAuthProvider, updateProfile,
  setPersistence, browserLocalPersistence
} from './vendor/firebase.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp, increment, writeBatch, deleteField
} from './vendor/firebase.js';
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from './vendor/firebase.js';

/* ═══════════════════════════════════════════════════════════════
   ١) إعدادات Firebase — الصق بيانات مشروعك هنا (٥ دقايق — شوف FIREBASE-SETUP.md)
   ═══════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "PUT_API_KEY_HERE",
  authDomain: "PUT_AUTH_DOMAIN_HERE",
  projectId: "PUT_PROJECT_ID_HERE",
  storageBucket: "PUT_STORAGE_BUCKET_HERE",
  messagingSenderId: "PUT_MESSAGING_SENDER_ID_HERE",
  appId: "PUT_APP_ID_HERE"
};

const CONFIGURED = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('PUT_');

/* ═══════════════════════════════════════════════════════════════
   ٢) أدوات عامة
   ═══════════════════════════════════════════════════════════════ */
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const lc = (s) => String(s || '').toLowerCase().trim();
const digitsOnly = (s) => String(s || '').replace(/[^\d+]/g, '');
const normPhone = (s) => String(s || '').replace(/[^\d]/g, '');
const isPhoneLike = (s) => /^\+?\d{8,15}$/.test(digitsOnly(s).trim());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const money = (n) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`;

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

/* ── إشعارات Toasts ── */
function toast(msg, type = '') {
  const box = qs('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span>${type === 'err' ? '⚠️' : type === 'ok' ? '✅' : 'ℹ️'}</span><span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 280); }, 4200);
}

/* ── Modal ── */
function modal({ title, body, actions = [], closable = true }) {
  return new Promise((resolve) => {
    const back = qs('#modalBack');
    qs('#modalTitle').textContent = title;
    qs('#modalBody').innerHTML = body;
    const act = qs('#modalActions');
    act.innerHTML = '';
    const close = (val) => { back.hidden = true; resolve(val); };
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || 'ghost');
      b.type = 'button';
      b.textContent = a.label;
      b.onclick = () => close(a.value);
      act.appendChild(b);
    });
    if (!actions.length) {
      const b = document.createElement('button');
      b.className = 'btn gold'; b.textContent = 'حسناً';
      b.onclick = () => close(true);
      act.appendChild(b);
    }
    back.hidden = false;
    back.onclick = (e) => { if (e.target === back && closable) close(false); };
    back._close = close;
  });
}
const ask = (title, body, okLabel = 'تأكيد', okCls = 'gold') =>
  modal({ title, body, actions: [{ label: 'إلغاء', value: false, cls: 'ghost' }, { label: okLabel, value: true, cls: okCls }] });
const info = (title, body) => modal({ title, body, actions: [{ label: 'تم', value: true, cls: 'gold' }] });

function confirmBox(title, body, danger = false) {
  return modal({ title, body, actions: [{ label: 'إلغاء', value: false }, { label: danger ? 'نعم، متأكد' : 'تأكيد', value: true, cls: danger ? 'danger' : 'gold' }] });
}

/* ── Crypto: تشفير الرمز السري PBKDF2 ── */
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function pbkdf2(secret, saltB64, iterations = 120000) {
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return b64(bits);
}
async function makePinHash(pin) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await pbkdf2(pin, salt), iterations: 120000 };
}
async function checkPin(pin, rec) {
  if (!rec?.salt || !rec?.hash) return true;
  return (await pbkdf2(pin, rec.salt, rec.iterations || 120000)) === rec.hash;
}

/* ═══════════════════════════════════════════════════════════════
   ٣) Firebase init
   ═══════════════════════════════════════════════════════════════ */
let app, auth, db, ai, model;
if (CONFIGURED) {
  app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  try { ai = getAI(app, { backend: new GoogleAIBackend() }); } catch (e) { console.warn('AI init failed', e); }
}

/* ═══════════════════════════════════════════════════════════════
   ٤) الحالة
   ═══════════════════════════════════════════════════════════════ */
const state = {
  user: null,
  profile: null,
  config: {},
  plans: {},
  products: [],
  teams: [],
  matches: [],
  analyses: [],
  notifications: [],
  orders: [],
  cart: [],
  route: 'home',
  currentProduct: null,
  phoneConfirmation: null,
  recaptcha: null,
  unlocked: false,
  aiBusy: false
};

const DEFAULT_CONFIG = {
  whatsapp: '',
  telegram: '',
  paymentPhone: '',
  paymentMethods: 'فودافون كاش / إنستاباي',
  geminiModel: 'gemini-2.5-flash',
  currency: 'EGP',
  adminEmail: '',
  adminPhone: '',
  aiLimits: { freeDailyAnalyze: 3, freeDailyChat: 3, proDailyAnalyze: 40, proDailyChat: 120 }
};
const DEFAULT_PLANS = {
  free: { id: 'free', name: 'FREE', price: 0, days: 0, tagline: 'ابدأ من هنا', perks: ['تحليل أساسي للتشكيلة (٣ يوميًا)', 'بناء التشكيلة وحفظ ٢ تشكيلات', 'المساعد الذكي: ٣ رسائل يوميًا', 'سجل مباريات أساسي', 'متجر الخدمات'] },
  pro: { id: 'pro', name: 'PRO', price: 149, days: 30, tagline: 'الأدوات الكاملة', perks: ['تحليل متقدم غير محدود تقريبًا', 'مساعد ذكي متقدم بالمصري + صوت', 'تقارير دورية ومتابعة تقدم', 'تشكيلات ومباريات متعددة', 'أولوية في الطلبات والدعم'] }
};

/* ═══════════════════════════════════════════════════════════════
   ٥) التنقل
   ═══════════════════════════════════════════════════════════════ */
const VIEWS = ['home', 'analyzer', 'assistant', 'builder', 'matches', 'store', 'product', 'cart', 'pro', 'account', 'settings', 'notifications', 'orders', 'legal'];
const NAV_MAP = { home: 'home', analyzer: 'analyzer', assistant: 'assistant', store: 'store', product: 'store', cart: 'store', account: 'account', settings: 'account', notifications: 'account', orders: 'account', pro: 'account', builder: 'home', matches: 'home', legal: 'home' };

function navigate(route, opts = {}) {
  const r = String(route || 'home');
  state.route = r;
  VIEWS.forEach(v => {
    const el = qs('#view-' + v);
    if (el) el.hidden = v !== r;
  });
  qsa('#bottomNav button').forEach(b => b.classList.toggle('active', b.dataset.nav === NAV_MAP[r]));
  qsa('[data-nav]').forEach(b => {
    if (b.closest('#bottomNav')) return;
  });
  if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  history.replaceState(null, '', '#/' + r);
  renderRoute(r);
}

function renderRoute(r) {
  switch (r) {
    case 'home': renderHome(); break;
    case 'analyzer': renderAnalyzer(); break;
    case 'assistant': renderAssistant(); break;
    case 'builder': renderBuilder(); break;
    case 'matches': renderMatches(); break;
    case 'store': renderStore(); break;
    case 'product': renderProduct(); break;
    case 'cart': renderCart(); break;
    case 'pro': renderPro(); break;
    case 'account': renderAccount(); break;
    case 'settings': renderSettings(); break;
    case 'notifications': renderNotifications(); break;
    case 'orders': renderOrders(); break;
    case 'legal': break;
  }
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { e.preventDefault(); navigate(nav.dataset.nav); }
});

/* ═══════════════════════════════════════════════════════════════
   ٦) الإقلاع
   ═══════════════════════════════════════════════════════════════ */
function boot() {
  // خلفيات
  qs('#bgImage').style.backgroundImage = `url('images/bg-stadium.jpg')`;
  qs('#heroPhoto').style.backgroundImage = `url('images/efootball-hero.jpg')`;
  qs('#splashPhoto').style.backgroundImage = `url('images/efootball-hero.jpg')`;
  const ap = qs('#authPhoto'); if (ap) ap.style.backgroundImage = `url('images/bg-stadium.jpg')`;

  // أداء الأجهزة الضعيفة
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) document.documentElement.classList.add('low-power');

  if (!CONFIGURED) {
    qs('#setupScreen').hidden = false;
    return;
  }

  qs('#skipSplash').onclick = hideSplash;
  qs('#tabLogin').onclick = () => switchAuthTab('login');
  qs('#tabRegister').onclick = () => switchAuthTab('register');
  bindAuthUI();
  bindGlobalUI();

  getRedirectResult(auth).catch(() => {});

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        state.user = null; state.profile = null;
        showAuth();
        return;
      }
      state.user = user;
      await setPersistence(auth, browserLocalPersistence).catch(() => {});
      const prof = await loadProfile(user);
      if (!prof) { await signOut(auth); return; }
      if (prof.status === 'blocked') {
        await signOut(auth);
        toast('الحساب موقوف — تواصل مع الإدارة', 'err');
        showAuth();
        return;
      }
      state.profile = prof;
      await touchLastSeen();
      await loadPlatformConfig();
      await loadUserData();
      showApp();
      maybeShowSplash();
      await gatePin();
      renderRoute(state.route === 'product' ? 'store' : state.route);
    } catch (err) {
      console.error(err);
      toast('حدث خطأ في تحميل الحساب: ' + (err?.message || err), 'err');
      showAuth();
    }
  });
}

function showAuth() {
  qs('#authShell').hidden = false;
  qs('#main').hidden = true;
  qs('#topbar').hidden = true;
  qs('#bottomNav').hidden = true;
  qs('#planChip').hidden = true;
  qs('#setupScreen').hidden = true;
}
function showApp() {
  qs('#authShell').hidden = true;
  qs('#setupScreen').hidden = true;
  qs('#main').hidden = false;
  qs('#topbar').hidden = false;
  qs('#bottomNav').hidden = false;
  qs('#planChip').hidden = false;
  const name = state.profile?.name || 'صديقي';
  qs('#helloName').textContent = name.split(' ')[0];
  qs('#avatarInitial').textContent = (name[0] || '؟').toUpperCase();
  const isPro = isProUser();
  const chip = qs('#planChip');
  chip.textContent = isPro ? 'PRO MEMBER' : 'FREE PLAN';
  chip.style.color = isPro ? '#0b0902' : '';
  chip.style.background = isPro ? 'linear-gradient(135deg,#8a6d1f,#F5D778)' : '';
  chip.style.borderColor = isPro ? 'transparent' : '';
  renderSocials();
  refreshBell();
}

/* ── Splash ── */
let splashDone = false;
function maybeShowSplash() {
  if (splashDone) return;
  splashDone = true;
  if (sessionStorage.getItem('pes_splash_seen') === '1') return;
  sessionStorage.setItem('pes_splash_seen', '1');
  const sp = qs('#splash');
  sp.hidden = false;
  document.body.classList.add('locked');
  const t = setTimeout(hideSplash, 3000);
  qs('#skipSplash').onclick = () => { clearTimeout(t); hideSplash(); };
}
function hideSplash() {
  const sp = qs('#splash');
  if (!sp || sp.hidden) return;
  sp.style.transition = 'opacity .55s ease';
  sp.style.opacity = '0';
  setTimeout(() => { sp.hidden = true; sp.style.opacity = ''; document.body.classList.remove('locked'); }, 560);
}

/* ── قفل الرمز السري ── */
async function gatePin() {
  const p = state.profile;
  if (!p?.pin?.hash) return;
  if (sessionStorage.getItem('pes_unlocked_' + state.user.uid) === '1') return;
  let ok = false;
  while (!ok) {
    const res = await modal({
      title: 'الرمز السري',
      body: `<p>أدخل رمزك السري المكوّن من ٤ أرقام لفتح التطبيق.</p>
             <input id="pinGateInput" class="input" inputmode="numeric" maxlength="4" placeholder="••••" style="text-align:center;font-size:22px;letter-spacing:.5em" />`,
      actions: [{ label: 'خروج', value: 'out', cls: 'ghost' }, { label: 'فتح', value: 'ok', cls: 'gold' }],
      closable: false
    });
    if (res === 'out') { await signOut(auth); return; }
    const val = qs('#pinGateInput')?.value || '';
    if (await checkPin(val, p.pin)) {
      sessionStorage.setItem('pes_unlocked_' + state.user.uid, '1');
      ok = true;
    } else {
      toast('رمز غير صحيح', 'err');
      await sleep(300);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   ٧) المصادقة
   ═══════════════════════════════════════════════════════════════ */
function switchAuthTab(which) {
  qs('#tabLogin').classList.toggle('active', which === 'login');
  qs('#tabRegister').classList.toggle('active', which === 'register');
  qs('#loginForm').hidden = which !== 'login';
  qs('#registerForm').hidden = which !== 'register';
  setMsg('loginMsg', ''); setMsg('registerMsg', '');
}
function setMsg(id, txt, type = '') {
  const el = qs('#' + id);
  if (!el) return;
  el.textContent = txt || '';
  el.className = 'auth-msg' + (txt ? ' show ' + type : '');
}
function authError(e) {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': 'البيانات غير صحيحة — راجع الإيميل/الرقم وكلمة المرور.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/user-not-found': 'مفيش حساب بالبيانات دي.',
    'auth/email-already-in-use': 'الإيميل ده متسجل قبل كده — جرّب تسجيل الدخول.',
    'auth/weak-password': 'كلمة المرور ضعيفة — ٨ حروف على الأقل.',
    'auth/invalid-email': 'الإيميل مش صالح.',
    'auth/too-many-requests': 'محاولات كتير — استنى شوية وجرب تاني.',
    'auth/popup-blocked': 'المتصفح منع نافذة جوجل — اسمح بالنوافذ المنبثقة.',
    'auth/popup-closed-by-user': 'أُغلقت نافذة جوجل قبل إتمام الدخول.',
    'auth/operation-not-allowed': 'الطريقة دي مش مفعّلة في Firebase — فعّلها من Authentication → Sign-in method.',
    'auth/invalid-phone-number': 'رقم الموبايل لازم يكون بالصيغة الدولية مثل +201012345678.',
    'auth/quota-exceeded': 'تجاوزنا حد رسائل الـ SMS المجانية — جرّب بعد شوية أو سجّل دخول بالإيميل.',
    'auth/captcha-check-failed': 'فشل التحقق من reCAPTCHA — أعد تحميل الصفحة.',
    'auth/requires-recent-login': 'لازم تسجل دخول تاني عشان العملية الحساسة دي.',
    'auth/unauthorized-domain': 'الدومين مش مصرح في Firebase — أضفه من Authentication → Settings → Authorized domains.',
    'auth/network-request-failed': 'مشكلة في الاتصال بالإنترنت.',
    'permission-denied': 'الصلاحيات في Firestore مش منشورة صح — راجع firestore.rules.'
  };
  for (const k in map) if (code.includes(k)) return map[k];
  return e?.message || 'حصل خطأ غير متوقع';
}

async function loadProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data();
    return { uid: user.uid, ...d };
  }
  // مستخدم جديد (جوجل/تليفون) — نكمّل بياناته
  const needsPhone = !user.phoneNumber;
  const suggestedName = user.displayName || (user.email ? user.email.split('@')[0] : 'لاعب');
  const ok = await modal({
    title: 'كمّل بياناتك',
    body: `<p>مرحباً ${esc(suggestedName)}! محتاجين اسمك ورقم موبايلك مرة واحدة بس.</p>
      <label>الاسم<input id="obName" class="input" value="${esc(suggestedName)}" /></label>
      <label>رقم الموبايل<input id="obPhone" class="input" inputmode="tel" placeholder="01xxxxxxxxx" /></label>`,
    actions: [{ label: 'خروج', value: false, cls: 'ghost' }, { label: 'متابعة', value: true, cls: 'gold' }],
    closable: false
  });
  if (!ok) { await signOut(auth); return null; }
  const name = (qs('#obName')?.value || suggestedName).trim();
  const phone = normPhone(qs('#obPhone')?.value || '');
  if (!phone) { toast('رقم الموبايل مطلوب', 'err'); return loadProfile(user); }
  const profile = {
    uid: user.uid,
    name,
    phone,
    email: user.email || '',
    provider: user.phoneNumber ? 'phone' : (user.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password'),
    plan: 'FREE',
    planExpiresAt: null,
    status: 'active',
    role: 'user',
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
    settings: { notifOrders: true, notifUpdates: true, notifAi: true, privHistory: true, privHidePhone: true },
    usage: { aiDayKey: '', aiCount: 0, chatDayKey: '', chatCount: 0 }
  };
  await setDoc(ref, profile);
  await addDoc(collection(ref, 'notifications'), {
    type: 'welcome', title: 'أهلاً بيك في PES AI PRO 🎉',
    body: 'حسابك جاهز. ابدأ بتحليل تشكيلتك أو ابنِ فريقك من الصفحة الرئيسية.',
    read: false, createdAt: serverTimestamp()
  });
  return { ...profile, uid: user.uid };
}

async function touchLastSeen() {
  try { await updateDoc(doc(db, 'users', state.user.uid), { lastSeen: serverTimestamp() }); } catch {}
}

async function doRegister(e) {
  e.preventDefault();
  const name = qs('#regName').value.trim();
  const phone = normPhone(qs('#regPhone').value);
  const email = lc(qs('#regEmail').value);
  const pass = qs('#regPass').value;
  const pass2 = qs('#regPass2').value;
  const pin = qs('#regPin').value.trim();
  const terms = qs('#regTerms').checked;

  if (name.length < 2) return setMsg('registerMsg', 'اكتب اسمك (حرفين على الأقل)', 'err');
  if (phone.length < 10) return setMsg('registerMsg', 'رقم الموبايل غير صحيح (١٠ أرقام على الأقل)', 'err');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg('registerMsg', 'الإيميل غير صحيح', 'err');
  if (pass.length < 8) return setMsg('registerMsg', 'كلمة المرور ٨ حروف على الأقل', 'err');
  if (pass !== pass2) return setMsg('registerMsg', 'كلمتا المرور غير متطابقتين', 'err');
  if (pin && !/^\d{4}$/.test(pin)) return setMsg('registerMsg', 'الرمز السري ٤ أرقام بالظبط', 'err');
  if (!terms) return setMsg('registerMsg', 'لازم توافق على الشروط والخصوصية', 'err');

  const btn = qs('#registerBtn'); btn.disabled = true; btn.textContent = 'جارٍ الإنشاء…';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    const pinRec = pin ? await makePinHash(pin) : null;
    const ref = doc(db, 'users', cred.user.uid);
    await setDoc(ref, {
      uid: cred.user.uid, name, phone, email, provider: 'password',
      plan: 'FREE', planExpiresAt: null, status: 'active', role: 'user',
      pin: pinRec, createdAt: serverTimestamp(), lastSeen: serverTimestamp(),
      settings: { notifOrders: true, notifUpdates: true, notifAi: true, privHistory: true, privHidePhone: true },
      usage: { aiDayKey: '', aiCount: 0, chatDayKey: '', chatCount: 0 }
    });
    await addDoc(collection(ref, 'notifications'), {
      type: 'welcome', title: 'أهلاً بيك في PES AI PRO 🎉',
      body: 'حسابك جاهز. ابدأ بتحليل تشكيلتك أو ابنِ فريقك.',
      read: false, createdAt: serverTimestamp()
    });
    setMsg('registerMsg', 'تم إنشاء الحساب ✅', 'ok');
  } catch (err) {
    setMsg('registerMsg', authError(err), 'err');
  } finally { btn.disabled = false; btn.textContent = 'إنشاء الحساب'; }
}

async function doLogin(e) {
  e.preventDefault();
  const id = qs('#loginEmail').value.trim();
  const pass = qs('#loginPass').value;
  const pin = qs('#loginPin').value.trim();
  if (!id) return setMsg('loginMsg', 'اكتب الإيميل أو الرقم', 'err');
  if (!pass) return setMsg('loginMsg', 'اكتب كلمة المرور', 'err');
  if (pin && !/^\d{4}$/.test(pin)) return setMsg('loginMsg', 'الرمز السري ٤ أرقام', 'err');

  const btn = qs('#loginBtn'); btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
  try {
    let email = lc(id);
    if (isPhoneLike(id)) {
      // حساب مسجّل بالرقم → معرّف داخلي ثابت (بدون كشف أي بيانات)
      email = `${normPhone(id).replace(/^\+/, '')}@phone.pes-ai-pro.app`;
    }
    await signInWithEmailAndPassword(auth, email, pass);
    setMsg('loginMsg', '');
  } catch (err) {
    setMsg('loginMsg', authError(err), 'err');
  } finally { btn.disabled = false; btn.textContent = 'دخول'; }
}

async function doGoogle(mode) {
  const btn = mode === 'register' ? qs('#googleRegisterBtn') : qs('#googleLoginBtn');
  btn.disabled = true;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
      try { await signInWithRedirect(auth, provider); return; } catch (e2) { return setMsg(mode === 'register' ? 'registerMsg' : 'loginMsg', authError(e2), 'err'); }
    }
    setMsg(mode === 'register' ? 'registerMsg' : 'loginMsg', authError(err), 'err');
  } finally { btn.disabled = false; }
}

function ensureRecaptcha() {
  if (state.recaptcha) return state.recaptcha;
  state.recaptcha = new RecaptchaVerifier(auth, 'recaptchaHost', { size: 'invisible' });
  return state.recaptcha;
}

async function sendOtp() {
  const phone = digitsOnly(qs('#loginPhone').value).trim();
  if (!/^\+\d{10,15}$/.test(phone)) {
    return setMsg('loginMsg', 'اكتب الرقم بالصيغة الدولية: +201012345678', 'err');
  }
  const btn = qs('#sendOtpBtn'); btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
  try {
    state.phoneConfirmation = await signInWithPhoneNumber(auth, phone, ensureRecaptcha());
    qs('#otpBox').hidden = false;
    setMsg('loginMsg', 'تم إرسال الكود ✅', 'ok');
  } catch (err) {
    setMsg('loginMsg', authError(err), 'err');
    try { ensureRecaptcha().clear(); state.recaptcha = null; } catch {}
  } finally { btn.disabled = false; btn.textContent = 'أرسل كود التحقق'; }
}
async function verifyOtp() {
  const code = qs('#otpCode').value.trim();
  if (!state.phoneConfirmation) return setMsg('loginMsg', 'اطلب كود الأول', 'err');
  if (code.length < 6) return setMsg('loginMsg', 'الكود ٦ أرقام', 'err');
  const btn = qs('#verifyOtpBtn'); btn.disabled = true;
  try {
    await state.phoneConfirmation.confirm(code);
    setMsg('loginMsg', '');
  } catch (err) {
    setMsg('loginMsg', authError(err), 'err');
  } finally { btn.disabled = false; }
}

async function forgotPassword() {
  const id = qs('#loginEmail').value.trim();
  const email = lc(id);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return info('استعادة الحساب', `اكتب إيميلك في خانة الدخول الأول، وبعدها اضغط "نسيت كلمة المرور" وهيوصلك رابط إعادة التعيين.<br><br>
      <b>لو حسابك مسجّل برقم موبايل بس:</b> سجّل دخول من تبويب "رقم + كود" بنفس الرقم، وبعدها تقدر تحدد كلمة مرور جديدة أو تفضل داخل بالكود.`);
  }
  try {
    await sendPasswordResetEmail(auth, email);
    info('تم الإرسال ✅', `بعتنالك رابط إعادة تعيين كلمة المرور على <b>${esc(email)}</b>. راجع صندوق الوارد والـ Spam.`);
  } catch (err) {
    setMsg('loginMsg', authError(err), 'err');
  }
}

/* ── ربط الـ UI ── */
function bindAuthUI() {
  qs('#registerForm').onsubmit = doRegister;
  qs('#loginForm').onsubmit = doLogin;
  qs('#googleLoginBtn').onclick = () => doGoogle('login');
  qs('#googleRegisterBtn').onclick = () => doGoogle('register');
  qs('#forgotBtn').onclick = forgotPassword;
  qs('#sendOtpBtn').onclick = sendOtp;
  qs('#verifyOtpBtn').onclick = verifyOtp;
  qsa('.seg[data-login]').forEach(b => b.onclick = () => {
    qsa('.seg[data-login]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const mode = b.dataset.login;
    qs('#loginEmailBlock').hidden = mode !== 'email';
    qs('#loginGoogleBlock').hidden = mode !== 'google';
    qs('#loginPhoneBlock').hidden = mode !== 'phone';
  });
}

/* ═══════════════════════════════════════════════════════════════
   ٨) تحميل بيانات المنصة والمستخدم
   ═══════════════════════════════════════════════════════════════ */
async function loadPlatformConfig() {
  try {
    const c = await getDoc(doc(db, 'config', 'main'));
    state.config = c.exists() ? { ...DEFAULT_CONFIG, ...c.data() } : { ...DEFAULT_CONFIG };
  } catch { state.config = { ...DEFAULT_CONFIG }; }
  try {
    const p = await getDoc(doc(db, 'config', 'plans'));
    state.plans = p.exists() ? p.data() : { ...DEFAULT_PLANS };
  } catch { state.plans = { ...DEFAULT_PLANS }; }
  try {
    const snap = await getDocs(query(collection(db, 'products'), where('visible', '==', true)));
    state.products = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.sort || 99) - (b.sort || 99));
  } catch { state.products = []; }
}

async function loadUserData() {
  const uid = state.user.uid;
  const uref = doc(db, 'users', uid);
  const [teams, matches, analyses, notifs, orders] = await Promise.all([
    getDocs(collection(uref, 'teams')).catch(() => ({ docs: [] })),
    getDocs(collection(uref, 'matches')).catch(() => ({ docs: [] })),
    getDocs(collection(uref, 'analyses')).catch(() => ({ docs: [] })),
    getDocs(collection(uref, 'notifications')).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, 'orders'), where('userId', '==', uid))).catch(() => ({ docs: [] }))
  ]);
  const byTime = (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
  state.teams = teams.docs.map(d => ({ id: d.id, ...d.data() })).sort(byTime);
  state.matches = matches.docs.map(d => ({ id: d.id, ...d.data() })).sort(byTime);
  state.analyses = analyses.docs.map(d => ({ id: d.id, ...d.data() })).sort(byTime);
  state.notifications = notifs.docs.map(d => ({ id: d.id, ...d.data() })).sort(byTime);
  state.orders = orders.docs.map(d => ({ id: d.id, ...d.data() })).sort(byTime);
}

function isProUser() {
  const p = state.profile;
  if (!p) return false;
  if (p.plan !== 'PRO') return false;
  if (!p.planExpiresAt) return true;
  const exp = p.planExpiresAt.toDate ? p.planExpiresAt.toDate() : new Date(p.planExpiresAt);
  return exp.getTime() > Date.now();
}

function todayKey() { return new Date().toISOString().slice(0, 10); }

function quotaStatus(kind) {
  const limits = state.config.aiLimits || DEFAULT_CONFIG.aiLimits;
  const pro = isProUser();
  const max = kind === 'chat'
    ? (pro ? limits.proDailyChat : limits.freeDailyChat)
    : (pro ? limits.proDailyAnalyze : limits.freeDailyAnalyze);
  const usage = state.profile?.usage || {};
  const key = kind === 'chat' ? usage.chatDayKey : usage.aiDayKey;
  const count = key === todayKey() ? (kind === 'chat' ? usage.chatCount : usage.aiCount) || 0 : 0;
  return { used: count, max, left: Math.max(0, max - count), pro };
}

async function useAiQuota(kind) {
  const q = quotaStatus(kind);
  if (q.left <= 0) {
    throw new Error(q.pro
      ? 'وصلت للحد اليومي — جرّب تاني بكرة 🌙'
      : 'خلصت حدك المجاني النهاردة. ترقّى لـ PRO عشان حد أعلى، أو استنى بكرة 🌙');
  }
  const field = kind === 'chat'
    ? { chatCount: increment(1), chatDayKey: todayKey() }
    : { aiCount: increment(1), aiDayKey: todayKey() };
  await updateDoc(doc(db, 'users', state.user.uid), Object.fromEntries(
    Object.entries(field).map(([k, v]) => ['usage.' + k, v])
  )).catch(() => {});
  const u = state.profile.usage || {};
  const keyField = kind === 'chat' ? 'chatDayKey' : 'aiDayKey';
  const cntField = kind === 'chat' ? 'chatCount' : 'aiCount';
  const sameDay = u[keyField] === todayKey();
  state.profile.usage = { ...u, [keyField]: todayKey(), [cntField]: (sameDay ? (u[cntField] || 0) : 0) + 1 };
  return quotaStatus(kind);
}

/* ═══════════════════════════════════════════════════════════════
   ٩) Gemini — طبقة الذكاء الاصطناعي
   ═══════════════════════════════════════════════════════════════ */
/* ملاحظة مهمة: Gemini Flash عبر Firebase AI Logic مش بيدعم responseMimeType=application/json
   للصور (inlineData) في بعض المشاريع، فبنجيب نص حُر ونستخرج منه JSON بأمان،
   وبنستخدم responseSchema للنصوص بس. */
function getModel(opts = {}) {
  if (!ai) throw new Error('الذكاء الاصطناعي غير مهيّأ. فعّل Firebase AI Logic من لوحة Firebase.');
  const { jsonSchema = null, temperature = 0.35, maxTokens = 4096 } = opts;
  const generationConfig = { temperature, maxOutputTokens: maxTokens };
  if (jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = jsonSchema;
  }
  return getGenerativeModel(ai, {
    model: state.config.geminiModel || 'gemini-2.5-flash',
    generationConfig
  });
}

const AI_ERRORS = {
  'permission-denied': 'خدمة الذكاء الاصطناعي مش مفعّلة في مشروع Firebase. فعّل Firebase AI Logic من الـ Console.',
  'not-found': 'الموديل غير متاح لمشروعك. جرّب تغيير اسم الموديل من إعدادات الأدمن (مثلاً gemini-2.5-flash).',
  'unauthenticated': 'لازم تكون مسجل دخول عشان تستخدم الذكاء الاصطناعي.',
  'resource-exhausted': 'الحد اليومي للذكاء الاصطناعي اتعدّى على مستوى المشروع — جرّب بعد شوية أو راجع حدود Firebase AI Logic.',
  'failed-precondition': 'محتاج تفعيل الخدمة أو ربط الفاتورة في Firebase للموديل ده.',
  'invalid-argument': 'الصورة أو الطلب غير صالح. جرّب صورة أوضح.'
};
function aiError(e) {
  const code = String(e?.code || e?.message || '');
  for (const k in AI_ERRORS) if (code.includes(k)) return new Error(AI_ERRORS[k]);
  if (String(e?.message || '').includes('API key')) return new Error('مفتاح Firebase AI غير مضبوط — راجع إعدادات المشروع في Firebase Console.');
  return new Error(e?.message || 'فشل الاتصال بالذكاء الاصطناعي');
}

function parseJson(txt) {
  if (!txt) throw new Error('رد فارغ من الموديل');
  let t = String(txt).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); }
  catch { throw new Error('رد الموديل مش JSON صالح — جرّب تاني.'); }
}

async function fileToInlineData(file, maxSide = 1280, quality = 0.85) {
  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error('فشل قراءة الملف'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('الملف مش صورة صالحة'));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const out = c.toDataURL('image/jpeg', quality);
  return { mimeType: 'image/jpeg', data: out.split(',')[1] };
}

/* ── ٩.أ: قراءة صورة التشكيلة ── */
async function readTeamImage(file) {
  const model = getModel();
  const inline = await fileToInlineData(file);
  const prompt = `أنت محلل صور متخصص في لعبة eFootball / PES.
اقرأ هذه الصورة (شاشة تشكيلة أو فريق) واستخرج فقط ما تراه بوضوح.

قواعد صارمة:
- لا تخترع أسماء لاعبين غير ظاهرة في الصورة.
- لا تخترع تقييمات أو إحصائيات غير مكتوبة فعليًا.
- لو الاسم مقطوع أو غير واضح، اكتب أفضل قراءة ممكنة وقيمة الثقة أقل من 0.5.
- درجة الثقة confidence رقم من 0 إلى 1 لكل لاعب.

أرجع JSON بالشكل:
{"formation":"4-3-3 أو غير معروف","confidence":0.0,"imageType":"تشكيلة/نتيجة/غير واضح","players":[{"slot":"مركز اللاعب إن ظهر","name":"الاسم كما يظهر","confidence":0.0,"ratingOnCard":null}],"warnings":["ملاحظات عن جودة الصورة أو أسماء غير مقروءة"]}`;

  const res = await model.generateContent([{ inlineData: inline }, { text: prompt }]);
  const data = parseJson(res.response.text());
  if (!Array.isArray(data.players)) data.players = [];
  data.players = data.players.slice(0, 18).map(p => ({
    slot: String(p.slot || '').slice(0, 6),
    name: String(p.name || '').slice(0, 40),
    confidence: clamp(Number(p.confidence) || 0, 0, 1),
    ratingOnCard: p.ratingOnCard ? clamp(Number(p.ratingOnCard) || 0, 1, 110) : null
  }));
  data.confidence = clamp(Number(data.confidence) || 0, 0, 1);
  data.warnings = Array.isArray(data.warnings) ? data.warnings.slice(0, 6).map(w => String(w).slice(0, 200)) : [];
  return data;
}

/* ── ٩.ب: التحليل الكامل ── */
async function deepAnalysis({ players, formation, source = 'manual' }) {
  const model = getModel();
  const known = players.filter(p => p.name);
  const list = known.map((p, i) => `${i + 1}. ${p.name}${p.slot ? ' — مركز: ' + p.slot : ''}${p.rating ? ' — تقييم: ' + p.rating : ' — تقييم غير متاح'}`).join('\n');

  const prompt = `أنت محلل تكتيكي محترف في eFootball، بتتكلم مع لاعب مصري بطريقة مباشرة وواضحة.
الخطة المعلنة: ${formation || 'غير محددة'}
قائمة اللاعبين المتاحة (واللي انت هتحللها):
${list}

قواعد صارمة:
- حلل فقط اللاعبين المذكورين. ممنوع اختراع أسماء أو تقييمات.
- لو التقييم غير متاح، قيّم المركز والانسجام فقط وبيّن إن التقييم تقديري.
- أي رقم تقييم تعطيه لازم يكون واضح إنه تقديري (estimated=true).
- بالعربي المصري البسيط، بدون مبالغة.

أرجع JSON:
{
 "overall": 0-100,
 "estimated": true,
 "formationSuggestion": {"formation":"4-2-3-1","reason":"سبب مختصر"},
 "strengths": ["..."],
 "weaknesses": ["..."],
 "positionFixes": [{"player":"اسم","current":"مركز","better":"مركز","why":"سبب"}],
 "tactics": {"playStyle":"","defensiveLine":"","pressing":"","buildUp":"","instructions":["..."]},
 "chemistry": {"score":0-100,"notes":["..."]},
 "transfers": [{"need":"مركز","why":"سبب","profile":"مواصفات اللاعب المطلوب"}],
 "training": ["نصيحة تطوير"],
 "confidence": 0.0-1.0
}`;

  const res = await model.generateContent(prompt);
  const data = parseJson(res.response.text());
  return normalizeAnalysis(data);
}

function normalizeAnalysis(d) {
  const arr = (v, n = 8) => Array.isArray(v) ? v.slice(0, n).map(x => typeof x === 'string' ? x.slice(0, 400) : x) : [];
  return {
    overall: clamp(Number(d.overall) || 0, 0, 100),
    estimated: d.estimated !== false,
    formationSuggestion: {
      formation: String(d.formationSuggestion?.formation || '').slice(0, 20),
      reason: String(d.formationSuggestion?.reason || '').slice(0, 300)
    },
    strengths: arr(d.strengths),
    weaknesses: arr(d.weaknesses),
    positionFixes: Array.isArray(d.positionFixes) ? d.positionFixes.slice(0, 11).map(p => ({
      player: String(p.player || '').slice(0, 40),
      current: String(p.current || '').slice(0, 10),
      better: String(p.better || '').slice(0, 10),
      why: String(p.why || '').slice(0, 220)
    })) : [],
    tactics: {
      playStyle: String(d.tactics?.playStyle || '').slice(0, 200),
      defensiveLine: String(d.tactics?.defensiveLine || '').slice(0, 120),
      pressing: String(d.tactics?.pressing || '').slice(0, 160),
      buildUp: String(d.tactics?.buildUp || '').slice(0, 200),
      instructions: arr(d.tactics?.instructions, 6)
    },
    chemistry: { score: clamp(Number(d.chemistry?.score) || 0, 0, 100), notes: arr(d.chemistry?.notes, 6) },
    transfers: Array.isArray(d.transfers) ? d.transfers.slice(0, 5).map(t => ({
      need: String(t.need || '').slice(0, 30), why: String(t.why || '').slice(0, 220), profile: String(t.profile || '').slice(0, 200)
    })) : [],
    training: arr(d.training, 6),
    confidence: clamp(Number(d.confidence) || 0.7, 0, 1)
  };
}

/* ── ٩.ج: تحليل مباراة ── */
async function analyzeMatch(m) {
  const model = getModel();
  const prompt = `أنت محلل أداء في eFootball. حلل هذه المباراة بالعربي المصري.
النتيجة: ${m.scoreFor} - ${m.scoreAgainst} (${m.result === 'W' ? 'فوز' : m.result === 'L' ? 'خسارة' : 'تعادل'})
عدد أهدافي: ${m.goals}
الخصم: ${m.opponent || 'غير محدد'}
ملاحظاتي: ${m.notes || 'لا يوجد'}
${m.imageRead ? 'قراءة صورة النتيجة: ' + m.imageRead : ''}

قواعد: لا تخترع إحصائيات (استحواذ/تسديدات) مش مذكورة. حلل من النتيجة والملاحظات فقط.
أرجع JSON: {"summary":"","strengths":[],"weaknesses":[],"improvements":[],"nextMatchPlan":"","rating":0-100}`;
  const res = await model.generateContent(prompt);
  const d = parseJson(res.response.text());
  const arr = (v) => Array.isArray(v) ? v.slice(0, 6).map(x => String(x).slice(0, 300)) : [];
  return {
    summary: String(d.summary || '').slice(0, 800),
    strengths: arr(d.strengths), weaknesses: arr(d.weaknesses), improvements: arr(d.improvements),
    nextMatchPlan: String(d.nextMatchPlan || '').slice(0, 600),
    rating: clamp(Number(d.rating) || 0, 0, 100)
  };
}

/* ── ٩.د: المساعد (streaming) ── */
let chatHistory = [];
async function assistantReply(userText, onChunk) {
  if (!ai) throw new Error('الذكاء الاصطناعي غير مهيّأ.');
  const model = getGenerativeModel(ai, {
    model: state.config.geminiModel || 'gemini-2.5-flash',
    generationConfig: { temperature: 0.7, maxOutputTokens: 1600 },
    systemInstruction: `أنت "كابتن AI" — مساعد تكتيكي في منصة PES AI PRO للعبة eFootball.
- بتتكلم مصري بسيط وودود، مختصر ومفيد، من غير حشو.
- متقولش أبداً إنك لعبت أو دخلت اللعبة، أو إنك شفت حسابه.
- ممنوع تطلب Konami ID أو بيانات دخول اللعبة.
- لو المستخدم سأل عن أرقام لاعبين مش عنده، قوله إن ده تقديري.
- ساعد في: التكتيك، التشكيلات، المراكز، تطوير اللاعبين، تحليل النتائج.
- إجاباتك منظمة بنقط لما تحتاج.`
  });
  chatHistory.push({ role: 'user', parts: [{ text: userText }] });
  const chat = model.startChat({ history: chatHistory.slice(-10, -1) });
  const stream = await chat.sendMessageStream(userText);
  let full = '';
  for await (const chunk of stream.stream) {
    const t = chunk.text();
    full += t;
    onChunk(t);
  }
  chatHistory.push({ role: 'model', parts: [{ text: full }] });
  if (chatHistory.length > 24) chatHistory = chatHistory.slice(-24);
  return full;
}

/* ═══════════════════════════════════════════════════════════════
   ١٠) الصفحة الرئيسية
   ═══════════════════════════════════════════════════════════════ */
const FEATURES = [
  { key: 'analyzer', title: 'AI TEAM ANALYZER', desc: 'ارفع صورة تشكيلتك والذكاء الاصطناعي يقراها ويحللها.', ico: '🧠', img: 'images/service-analysis.jpg', tag: 'VISION ANALYSIS' },
  { key: 'assistant', title: 'PRO AI ASSISTANT', desc: 'كابتن AI يرد عليك بالمصري — كتابة وصوت.', ico: '🤖', tag: 'LIVE COACH' },
  { key: 'matches', title: 'MATCH ANALYSIS', desc: 'سجّل نتائجك وشوف نقاط ضعفك وخطة المباراة الجاية.', ico: '📊', img: 'images/service-training.jpg', tag: 'PERFORMANCE' },
  { key: 'builder', title: 'TEAM BUILDER', desc: 'ابنِ تشكيلتك على ملعب حقيقي وقارن بين تشكيلتين.', ico: '🧩', tag: 'SQUAD LAB' },
  { key: 'store', title: 'PRO STORE', desc: 'خدمات رقمية يقدمها فريق المنصة لك.', ico: '🛍️', img: 'images/service-consultation.jpg', tag: 'SERVICES' },
  { key: 'pro', title: 'SUBSCRIPTIONS', desc: 'قارن بين FREE و PRO واختار اللي يناسبك.', ico: '💎', tag: 'MEMBERSHIP' }
];

function renderHome() {
  qs('#statAi').textContent = state.analyses.length;
  qs('#statTeams').textContent = state.teams.length;
  qs('#statMatches').textContent = state.matches.length;

  const wrap = qs('#homeCards');
  wrap.innerHTML = FEATURES.map((f, i) => `
    <button class="card gold-ring" data-nav="${f.key}" style="animation-delay:${i * 55}ms" type="button">
      <div class="card-ico">${f.ico}</div>
      <h3>${f.title}</h3>
      <p>${f.desc}</p>
      <span class="tagline">${f.tag} ›</span>
    </button>`).join('');
  renderSocials();
}

function renderSocials() {
  const wa = (state.config.whatsapp || '').replace(/[^\d]/g, '');
  const tg = (state.config.telegram || '').trim();
  const waBtn = qs('#waBtn'), tgBtn = qs('#tgBtn');
  if (waBtn) {
    if (wa) {
      waBtn.hidden = false;
      waBtn.href = `https://wa.me/${wa}?text=${encodeURIComponent('أهلاً، محتاج مساعدة في PES AI PRO')}`;
      waBtn.target = '_blank'; waBtn.rel = 'noopener';
    } else waBtn.hidden = true;
  }
  if (tgBtn) {
    if (tg && /^(https?:\/\/)?(t\.me|telegram\.me)\//i.test(tg)) {
      tgBtn.hidden = false;
      tgBtn.href = tg.startsWith('http') ? tg : 'https://' + tg;
      tgBtn.target = '_blank'; tgBtn.rel = 'noopener';
    } else tgBtn.hidden = true;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ١١) AI TEAM ANALYZER
   ═══════════════════════════════════════════════════════════════ */
let analyzerState = { file: null, readback: null, analysis: null };

function renderAnalyzer() {
  const q = quotaStatus('analyze');
  qs('#aiQuotaLine').textContent = `عندك ${q.left} تحليل من ${q.max} النهاردة${q.pro ? ' (PRO)' : ' — FREE'}`;
  const dz = qs('#dropZone');
  const input = qs('#teamImage');
  if (!dz.dataset.bound) {
    dz.dataset.bound = '1';
    dz.onclick = () => input.click();
    dz.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); };
    input.onchange = () => setTeamFile(input.files[0]);
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) setTeamFile(f); });
    qs('#analyzeBtn').onclick = startReadback;
    qs('#clearAnalyzer').onclick = resetAnalyzer;
    qs('#resetAnalyzer').onclick = resetAnalyzer;
    qs('#confirmNamesBtn').onclick = runFullAnalysis;
  }
  renderAnalyzerHistory();
}

function setTeamFile(f) {
  if (!f) return;
  if (!f.type.startsWith('image/')) return toast('اختار صورة صالحة', 'err');
  if (f.size > 8 * 1024 * 1024) return toast('الصورة كبيرة — أقل من ٨ ميجا', 'err');
  analyzerState.file = f;
  const pv = qs('#dzPreview');
  pv.src = URL.createObjectURL(f);
  pv.hidden = false;
  qs('#analyzeBtn').disabled = false;
  qs('#readbackPanel').hidden = true;
  qs('#analyzerResult').hidden = true;
}

function resetAnalyzer() {
  analyzerState = { file: null, readback: null, analysis: null };
  qs('#dzPreview').hidden = true; qs('#dzPreview').src = '';
  qs('#teamImage').value = '';
  qs('#analyzeBtn').disabled = true;
  qs('#readbackPanel').hidden = true;
  qs('#analyzerResult').hidden = true;
}

async function startReadback() {
  if (!analyzerState.file) return;
  const btn = qs('#analyzeBtn');
  btn.disabled = true; btn.textContent = 'بقرأ الصورة…';
  try {
    const rb = await readTeamImage(analyzerState.file);
    analyzerState.readback = rb;
    renderReadback(rb);
    qs('#readbackPanel').hidden = false;
    qs('#readbackPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (rb.warnings.length) toast(rb.warnings[0], '');
  } catch (e) {
    toast(aiError(e).message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'ابدأ قراءة الصورة';
  }
}

function renderReadback(rb) {
  const conf = Math.round((rb.confidence || 0) * 100);
  const badge = conf >= 70 ? 'high' : conf >= 45 ? 'mid' : 'low';
  qs('#readbackList').innerHTML = `
    <div class="ai-meta">
      <span class="chip">الخطة المقروءة: ${esc(rb.formation || 'غير معروفة')}</span>
      <span class="chip ${badge === 'high' ? 'ok' : badge === 'low' ? 'bad' : ''}">ثقة القراءة ${conf}%</span>
      <span class="chip">${rb.players.length} لاعب</span>
    </div>
    ${rb.warnings.length ? `<div class="ai-block"><h4>ملاحظات على الصورة</h4><ul>${rb.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
    ${rb.players.length === 0 ? `<p class="fine">مقدرتش أقرأ أسماء واضحة. اكتب الأسماء بنفسك تحت أو جرّب صورة أوضح.</p>` : ''}
    ${rb.players.map((p, i) => `
      <div class="rb-row">
        <input data-rb-name="${i}" value="${esc(p.name)}" placeholder="اسم اللاعب ${i + 1}" />
        <input data-rb-slot="${i}" value="${esc(p.slot)}" placeholder="المركز" style="max-width:74px;text-align:center" />
        <span class="rb-conf ${p.confidence >= .7 ? 'high' : p.confidence >= .45 ? 'mid' : 'low'}">${Math.round(p.confidence * 100)}%</span>
      </div>`).join('')}
    <button class="link-btn" id="addRbRow" type="button">+ ضيف لاعب ناقص</button>`;
  qs('#addRbRow').onclick = () => {
    const list = qs('#readbackList');
    const i = list.querySelectorAll('[data-rb-name]').length;
    const row = document.createElement('div');
    row.className = 'rb-row';
    row.innerHTML = `<input data-rb-name="${i}" placeholder="اسم اللاعب" /><input data-rb-slot="${i}" placeholder="المركز" style="max-width:74px;text-align:center" /><span class="rb-conf mid">يدوي</span>`;
    list.insertBefore(row, qs('#addRbRow'));
  };
  qs('#confirmNamesBtn').disabled = rb.players.length === 0;
}

async function runFullAnalysis() {
  const names = qsa('[data-rb-name]').map((el, i) => ({
    name: el.value.trim(),
    slot: (qs(`[data-rb-slot="${i}"]`)?.value || '').trim(),
    rating: null
  })).filter(p => p.name);
  if (!names.length) return toast('محتاج اسم لاعب واحد على الأقل', 'err');

  const btn = qs('#confirmNamesBtn');
  btn.disabled = true; btn.textContent = 'بحلل الفريق…';
  try {
    await useAiQuota('analyze');
    const analysis = await deepAnalysis({ players: names, formation: analyzerState.readback?.formation, source: 'image' });
    analyzerState.analysis = analysis;
    renderAnalysis(analysis, names, analyzerState.readback);
    qs('#analyzerResult').hidden = false;
    qs('#analyzerResult').scrollIntoView({ behavior: 'smooth', block: 'start' });

    const uref = doc(db, 'users', state.user.uid);
    if (state.profile.settings?.privHistory !== false) {
      await addDoc(collection(uref, 'analyses'), {
        formation: analyzerState.readback?.formation || '',
        players: names, report: analysis, confidence: analysis.confidence,
        readConfidence: analyzerState.readback?.confidence || 0,
        createdAt: serverTimestamp()
      });
      await addDoc(collection(uref, 'notifications'), {
        type: 'ai', title: 'تحليل فريقك جاهز ✅',
        body: `التقييم العام ${analysis.overall}/100 — افتح التحليل من صفحة تحليل الفريق.`,
        read: false, createdAt: serverTimestamp()
      });
      await loadUserData();
      refreshBell();
      renderAnalyzerHistory();
      qs('#statAi').textContent = state.analyses.length;
    }
    toast('التحليل جاهز ✅', 'ok');
  } catch (e) {
    toast(aiError(e).message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'التحليل الكامل';
  }
}

function analysisHtml(a) {
  const li = (arr) => arr?.length ? `<ul>${arr.map(x => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul>` : '<p class="fine">لا توجد ملاحظات.</p>';
  return `
    <div class="ai-meta">
      <span class="chip ok">التقييم العام ${a.overall}/100${a.estimated ? ' · تقديري' : ''}</span>
      <span class="chip">انسجام ${a.chemistry.score}/100</span>
      <span class="chip">ثقة ${Math.round(a.confidence * 100)}%</span>
      ${a.formationSuggestion.formation ? `<span class="chip">الخطة المقترحة ${esc(a.formationSuggestion.formation)}</span>` : ''}
    </div>
    ${a.formationSuggestion.reason ? `<div class="ai-block"><h4>ليه الخطة دي؟</h4><p>${esc(a.formationSuggestion.reason)}</p></div>` : ''}
    <div class="ai-block"><h4>💪 نقاط القوة</h4>${li(a.strengths)}</div>
    <div class="ai-block"><h4>⚠️ نقاط الضعف</h4>${li(a.weaknesses)}</div>
    ${a.positionFixes.length ? `<div class="ai-block"><h4>🔁 أفضل توزيع للمراكز</h4><ul>${a.positionFixes.map(p => `<li><b>${esc(p.player)}</b>: ${esc(p.current)} ← ${esc(p.better)} — ${esc(p.why)}</li>`).join('')}</ul></div>` : ''}
    <div class="ai-block"><h4>🎯 خطة اللعب</h4>
      <ul>
        ${a.tactics.playStyle ? `<li>أسلوب اللعب: ${esc(a.tactics.playStyle)}</li>` : ''}
        ${a.tactics.defensiveLine ? `<li>الخط الدفاعي: ${esc(a.tactics.defensiveLine)}</li>` : ''}
        ${a.tactics.pressing ? `<li>الضغط: ${esc(a.tactics.pressing)}</li>` : ''}
        ${a.tactics.buildUp ? `<li>بناء الهجمة: ${esc(a.tactics.buildUp)}</li>` : ''}
        ${a.tactics.instructions.map(x => `<li>${esc(x)}</li>`).join('')}
      </ul>
    </div>
    <div class="ai-block"><h4>🤝 الانسجام</h4>${li(a.chemistry.notes)}</div>
    ${a.transfers.length ? `<div class="ai-block"><h4>🔄 اقتراحات تدعيم</h4><ul>${a.transfers.map(t => `<li><b>${esc(t.need)}</b>: ${esc(t.why)} ${t.profile ? '— ' + esc(t.profile) : ''}</li>`).join('')}</ul></div>` : ''}
    <div class="ai-block"><h4>📈 تطوير</h4>${li(a.training)}</div>
    <p class="fine">كل الأرقام دي تقديرية من تحليل الذكاء الاصطناعي بناءً على البيانات اللي أدخلتها — مش بيانات رسمية من اللعبة.</p>`;
}

function renderAnalysis(a, players, rb) {
  qs('#analyzerResult').innerHTML = `
    <h3>نتيجة التحليل <small>${players.length} لاعب</small></h3>
    ${analysisHtml(a)}
    <div class="row-actions">
      <button class="btn ghost sm" id="saveAnalysisTeam" type="button">حوّل التشكيلة لـ Team Builder</button>
    </div>`;
  qs('#saveAnalysisTeam').onclick = () => {
    sessionStorage.setItem('pes_seed_team', JSON.stringify({
      formation: a.formationSuggestion.formation || rb?.formation || '4-3-3',
      players: players.map(p => ({ name: p.name, slot: p.slot, rating: null }))
    }));
    navigate('builder');
    setTimeout(() => toast('التشكيلة جاهزة في الباني — راجعها واحفظها', 'ok'), 300);
  };
}

function renderAnalyzerHistory() {
  const wrap = qs('#analyzerHistory');
  const panel = qs('#analyzerHistoryPanel');
  if (!state.analyses.length) { panel.hidden = true; return; }
  panel.hidden = false;
  wrap.innerHTML = state.analyses.slice(0, 10).map(a => `
    <div class="list-item">
      <div class="li-main">
        <b>${esc(a.formation || 'تحليل تشكيلة')} — ${a.report?.overall || '—'}/100</b>
        <small>${fmtDateTime(a.createdAt)} · ${(a.players || []).length} لاعب</small>
      </div>
      <div class="li-act">
        <button data-view-analysis="${a.id}" type="button">عرض</button>
        <button class="del" data-del-analysis="${a.id}" type="button">حذف</button>
      </div>
    </div>`).join('');
  qsa('[data-view-analysis]').forEach(b => b.onclick = () => {
    const a = state.analyses.find(x => x.id === b.dataset.viewAnalysis);
    if (!a) return;
    qs('#analyzerResult').innerHTML = `<h3>تحليل محفوظ</h3>${analysisHtml(normalizeAnalysis(a.report))}`;
    qs('#analyzerResult').hidden = false;
    qs('#analyzerResult').scrollIntoView({ behavior: 'smooth' });
  });
  qsa('[data-del-analysis]').forEach(b => b.onclick = async () => {
    if (!await confirmBox('حذف التحليل', 'مش هينفع ترجعه.', true)) return;
    await deleteDoc(doc(db, 'users', state.user.uid, 'analyses', b.dataset.delAnalysis));
    await loadUserData(); renderAnalyzerHistory();
    toast('تم الحذف', 'ok');
  });
}

/* ═══════════════════════════════════════════════════════════════
   ١٢) المساعد الذكي
   ═══════════════════════════════════════════════════════════════ */
function renderAssistant() {
  const q = quotaStatus('chat');
  qs('#chatQuota').textContent = `المتبقي النهاردة: ${q.left} من ${q.max} رسالة${q.pro ? ' (PRO)' : ''} — المساعد اقتراحات مش ضمان.`;
  if (!chatHistory.length && !qs('#chatBody').dataset.init) {
    qs('#chatBody').dataset.init = '1';
    addMsg('bot', `أهلاً ${state.profile?.name?.split(' ')[0] || 'يا كابتن'} 👋\nأنا كابتن AI — مساعدك التكتيكي في eFootball.\nاسألني عن أي حاجة: خطة اللعب، مراكز اللاعبين، إزاي تحسن الفريق، أو حلل نتيجة مباراة.`);
  }
  if (!qs('#chatShell').dataset.bound) {
    qs('#chatShell').dataset.bound = '1';
    qs('#sendBtn').onclick = sendChat;
    qs('#chatText').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
    qs('#chatText').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 110) + 'px';
    });
    qs('#micBtn').onclick = toggleMic;
    qs('#clearChat').onclick = async () => {
      if (!await confirmBox('مسح المحادثة', 'هتمسح كل الرسائل من الشاشة (المحادثة مش محفوظة على السيرفر).')) return;
      chatHistory = [];
      qs('#chatBody').innerHTML = '';
      qs('#chatBody').dataset.init = '';
      renderAssistant();
    };
  }
}

function addMsg(type, text) {
  const el = document.createElement('div');
  el.className = 'msg ' + type;
  el.textContent = text;
  qs('#chatBody').appendChild(el);
  qs('#chatBody').scrollTop = qs('#chatBody').scrollHeight;
  return el;
}

async function sendChat() {
  const ta = qs('#chatText');
  const txt = ta.value.trim();
  if (!txt) return;
  if (state.aiBusy) return;
  state.aiBusy = true;
  ta.value = ''; ta.style.height = 'auto';
  addMsg('user', txt);
  const typing = addMsg('typing', '');
  typing.innerHTML = '<span></span><span></span><span></span>';
  try {
    await useAiQuota('chat');
    const bubble = document.createElement('div');
    bubble.className = 'msg bot';
    qs('#chatBody').appendChild(bubble);
    let acc = '';
    await assistantReply(txt, (chunk) => {
      if (typing.isConnected) typing.remove();
      acc += chunk;
      bubble.textContent = acc;
      qs('#chatBody').scrollTop = qs('#chatBody').scrollHeight;
    });
    if (!acc) bubble.textContent = 'معلش، مقدرتش أرد دلوقتي — جرّب تاني.';
    renderAssistant();
  } catch (e) {
    typing.remove();
    addMsg('sys', '⚠️ ' + aiError(e).message);
  } finally {
    state.aiBusy = false;
    renderAssistant();
  }
}

/* ── إدخال صوتي ── */
let recognition = null, micOn = false;
function toggleMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    return info('الإدخال الصوتي غير مدعوم', 'متصفحك مش بيدعم التحدث للنص. استخدم Chrome أو Edge على Android/كمبيوتر، أو اكتب سؤالك.');
  }
  if (micOn && recognition) { recognition.stop(); return; }
  recognition = new SR();
  recognition.lang = 'ar-EG';
  recognition.interimResults = true;
  recognition.continuous = false;
  const btn = qs('#micBtn');
  recognition.onstart = () => { micOn = true; btn.classList.add('rec'); qs('#chatStatus').textContent = 'بسمعك…'; };
  recognition.onend = () => { micOn = false; btn.classList.remove('rec'); qs('#chatStatus').textContent = 'جاهز'; };
  recognition.onerror = (e) => {
    micOn = false; btn.classList.remove('rec'); qs('#chatStatus').textContent = 'جاهز';
    if (e.error === 'not-allowed') toast('اسمح بالميكروفون من المتصفح', 'err');
    else if (e.error !== 'no-speech') toast('تعذر السماع — جرّب تاني', 'err');
  };
  recognition.onresult = (ev) => {
    let t = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript;
    qs('#chatText').value = t;
    qs('#chatText').style.height = 'auto';
    qs('#chatText').style.height = Math.min(qs('#chatText').scrollHeight, 110) + 'px';
  };
  try { recognition.start(); } catch { }
}

/* ═══════════════════════════════════════════════════════════════
   ١٣) TEAM BUILDER
   ═══════════════════════════════════════════════════════════════ */
const FORMATIONS = {
  '4-3-3': [['GK', 50, 91], ['LB', 13, 71], ['CB', 37, 76], ['CB', 63, 76], ['RB', 87, 71], ['CM', 28, 52], ['DM', 50, 60], ['CM', 72, 52], ['LW', 18, 27], ['ST', 50, 16], ['RW', 82, 27]],
  '4-2-3-1': [['GK', 50, 91], ['LB', 13, 71], ['CB', 37, 76], ['CB', 63, 76], ['RB', 87, 71], ['DM', 38, 58], ['DM', 62, 58], ['LW', 16, 36], ['AMF', 50, 40], ['RW', 84, 36], ['ST', 50, 16]],
  '4-4-2': [['GK', 50, 91], ['LB', 13, 71], ['CB', 37, 76], ['CB', 63, 76], ['RB', 87, 71], ['LM', 15, 48], ['CM', 38, 52], ['CM', 62, 52], ['RM', 85, 48], ['ST', 38, 20], ['ST', 62, 20]],
  '3-5-2': [['GK', 50, 91], ['CB', 28, 74], ['CB', 50, 77], ['CB', 72, 74], ['LM', 12, 50], ['CM', 33, 54], ['DM', 50, 60], ['CM', 67, 54], ['RM', 88, 50], ['ST', 38, 20], ['ST', 62, 20]],
  '4-1-4-1': [['GK', 50, 91], ['LB', 13, 71], ['CB', 37, 76], ['CB', 63, 76], ['RB', 87, 71], ['DM', 50, 60], ['LM', 15, 44], ['CM', 38, 47], ['CM', 62, 47], ['RM', 85, 44], ['ST', 50, 18]]
};

let builder = {
  formation: '4-3-3',
  slots: [],
  activeSlot: null,
  editId: null,
  compareMode: false
};

function renderBuilder() {
  const playerNames = state.profile?.plan === 'PRO';
  const sel = qs('#formationSelect');
  if (!sel.dataset.bound) {
    sel.dataset.bound = '1';
    sel.innerHTML = Object.keys(FORMATIONS).map(f => `<option value="${f}">${f}</option>`).join('');
    sel.value = builder.formation;
    sel.onchange = () => {
      if (builder.slots.some(s => s.player)) {
        confirmBox('تغيير الخطة', 'تغيير الخطة هيعيد ترتيب المراكز — اللاعبين هيتوزعوا من جديد. تكمل؟').then(ok => {
          if (ok) { builder.formation = sel.value; builder.slots = []; buildPitch(); }
          else sel.value = builder.formation;
        });
      } else { builder.formation = sel.value; builder.slots = []; buildPitch(); }
    };
    qs('#saveTeamBtn').onclick = saveTeam;
    qs('#suggestBtn').onclick = suggestLineup;
    qs('#compareBtn').onclick = openCompare;
    qs('#pickerClose').onclick = () => { qs('#playerPicker').hidden = true; };
    qs('#playerSearch').oninput = () => filterPlayers(qs('#playerSearch').value);
    qs('#manualAddBtn').onclick = addManualPlayer;
  }
  hydrateBuilderFromStorage();
  buildPitch();
  renderSavedTeams();
}

function hydrateBuilderFromStorage() {
  const seed = sessionStorage.getItem('pes_seed_team');
  if (seed) {
    sessionStorage.removeItem('pes_seed_team');
    try {
      const d = JSON.parse(seed);
      builder.formation = FORMATIONS[d.formation] ? d.formation : '4-3-3';
      qs('#formationSelect').value = builder.formation;
      const template = FORMATIONS[builder.formation];
      builder.slots = template.map((t, i) => {
        const p = d.players[i];
        return { pos: t[0], x: t[1], y: t[2], player: p ? { name: p.name, rating: null, slot: p.slot || t[0] } : null };
      });
    } catch {}
  }
  if (!builder.slots.length) {
    builder.slots = FORMATIONS[builder.formation].map(t => ({ pos: t[0], x: t[1], y: t[2], player: null }));
  }
}

function buildPitch() {
  // لو المراكز فاضية (بعد تغيير خطة) نعيد بناءها من قالب الخطة
  if (!builder.slots.length) {
    const tpl = FORMATIONS[builder.formation] || FORMATIONS['4-3-3'];
    builder.slots = tpl.map(t => ({ pos: t[0], x: t[1], y: t[2], player: null }));
  }
  const pitch = qs('#pitch');
  const marks = '<div class="box-top"></div><div class="box-bot"></div><div class="midline"></div>';
  pitch.innerHTML = marks + builder.slots.map((s, i) => `
    <div class="slot ${s.player ? '' : 'empty'}" data-slot="${i}" style="left:${s.x}%;top:${s.y}%">
      <div class="pc">${s.player ? (s.player.rating || '★') : '+'}</div>
      <div class="pn">${s.player ? esc(s.player.name) : s.pos}</div>
      ${s.player ? `<div class="pr">${s.pos}</div>` : ''}
    </div>`).join('');
  qsa('.slot').forEach(el => el.onclick = () => openPicker(Number(el.dataset.slot)));
  renderLineup();
}

function teamStrength() {
  const players = builder.slots.map(s => s.player).filter(Boolean);
  const rated = players.filter(p => p.rating);
  const avg = rated.length ? rated.reduce((a, p) => a + p.rating, 0) / rated.length : 0;
  const coverage = builder.slots.length ? players.length / builder.slots.length : 0;
  // التقييم بيعتمد على المتوسط الحقيقي + نسبة المراكز المكتملة — مفيش أرقام مخترعة
  const score = rated.length ? Math.round(avg * 0.82 + coverage * 18) : Math.round(coverage * 55);
  return { score, rated: rated.length, total: players.length, coverage };
}

function renderLineup() {
  const st = teamStrength();
  qs('#teamStrength').textContent = st.score ? st.score : '—';
  qs('#strengthBar').style.width = clamp(st.score, 0, 100) + '%';
  const filled = builder.slots.filter(s => s.player).length;
  qs('#strengthHint').textContent = st.rated === 0
    ? `${filled}/${builder.slots.length} مركز — أضف تقييمات لتحصل على قوة دقيقة (التقييم الحالي تقديري)`
    : `${st.rated} لاعب بتقييم من ${st.total} — متوسط حقيقي`;

  qs('#lineupList').innerHTML = builder.slots.map((s, i) => `
    <div class="lineup-row">
      <span class="pos">${s.pos}</span>
      <span class="nm">${s.player ? esc(s.player.name) : '<em style="color:#6f6c64;font-style:normal">فاضي</em>'}</span>
      <span class="rt">${s.player?.rating || (s.player ? 'تقديري' : '')}</span>
      ${s.player ? `<button data-clear-slot="${i}" type="button" aria-label="إزالة">✕</button>` : ''}
    </div>`).join('');
  qsa('[data-clear-slot]').forEach(b => b.onclick = () => {
    builder.slots[Number(b.dataset.clearSlot)].player = null;
    buildPitch();
  });
}

async function openPicker(idx) {
  builder.activeSlot = idx;
  qs('#playerPicker').hidden = false;
  qs('#pickerTitle').textContent = `اختار لاعب — ${builder.slots[idx].pos}`;
  qs('#playerSearch').value = '';
  qs('#manualName').value = '';
  qs('#manualRating').value = '';
  await loadPlayersPool();
  filterPlayers('');
  qs('#playerPicker').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

let playersPool = null;
async function loadPlayersPool() {
  if (playersPool) return;
  try {
    const snap = await getDocs(collection(db, 'players'));
    playersPool = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { playersPool = []; }
  if (!playersPool.length) {
    qs('#pickerList').innerHTML = '<p class="fine">قاعدة اللاعبين لسه فاضية — الأدمن يضيفها من لوحة التحكم. تقدر تضيف أي لاعب يدويًا تحت 👇</p>';
  }
}

function filterPlayers(q) {
  const list = qs('#pickerList');
  if (!playersPool?.length) return;
  const term = lc(q);
  const items = playersPool.filter(p => !term || lc(p.name).includes(term)).slice(0, 60);
  list.innerHTML = items.length ? items.map(p => `
    <button class="picker-item" data-pick="${esc(p.name)}" data-rating="${p.rating || ''}" type="button">
      <b>${esc(p.name)}</b>
      <i>${(p.positions || []).join(' · ')}</i>
      <span>${p.rating || '—'}</span>
    </button>`).join('') : '<p class="fine">مفيش نتائج — ضيفه يدويًا تحت.</p>';
  qsa('[data-pick]').forEach(b => b.onclick = () => {
    const rating = b.dataset.rating ? Number(b.dataset.rating) : null;
    builder.slots[builder.activeSlot].player = { name: b.dataset.pick, rating, slot: builder.slots[builder.activeSlot].pos };
    qs('#playerPicker').hidden = true;
    buildPitch();
  });
}

function addManualPlayer() {
  const name = qs('#manualName').value.trim();
  const ratingRaw = qs('#manualRating').value.trim();
  const rating = ratingRaw ? clamp(Number(ratingRaw), 1, 110) : null;
  if (name.length < 2) return toast('اكتب اسم اللاعب', 'err');
  if (ratingRaw && (!rating || !Number.isFinite(rating))) return toast('التقييم رقم من ١ لـ ١١٠', 'err');
  builder.slots[builder.activeSlot].player = { name, rating, slot: builder.slots[builder.activeSlot].pos };
  qs('#playerPicker').hidden = true;
  buildPitch();
  toast(rating ? 'تمت الإضافة' : 'تمت الإضافة (بدون تقييم — هيظهر تقديري)', 'ok');
}

async function saveTeam() {
  const players = builder.slots.map(s => s.player).filter(Boolean);
  if (players.length < 7) return toast('لازم ٧ لاعبين على الأقل', 'err');
  const name = await modal({
    title: 'اسم التشكيلة',
    body: `<label>اسم مختصر<input id="teamNameInput" class="input" value="${esc(builder.editId ? '' : 'تشكيلتي ' + (state.teams.length + 1))}" placeholder="مثلاً: خطة الدوري" /></label>`,
    actions: [{ label: 'إلغاء', value: false }, { label: 'حفظ', value: true, cls: 'gold' }]
  });
  if (!name) return;
  const teamName = (qs('#teamNameInput')?.value || 'تشكيلة').trim().slice(0, 40);
  const st = teamStrength();
  const payload = {
    name: teamName,
    formation: builder.formation,
    slots: builder.slots.map(s => ({ pos: s.pos, x: s.x, y: s.y, player: s.player || null })),
    strength: st.score,
    updatedAt: serverTimestamp()
  };

  if (!isProUser() && state.teams.length >= 2 && !builder.editId) {
    return info('حد الباقة المجانية', 'FREE بيسمح بحفظ تشكيلتين. امسح واحدة قديمة أو ترقّى لـ PRO لتشكيلات غير محدودة.');
  }

  try {
    const uref = collection(db, 'users', state.user.uid, 'teams');
    if (builder.editId) {
      await updateDoc(doc(uref, builder.editId), payload);
      toast('تم تحديث التشكيلة ✅', 'ok');
    } else {
      await addDoc(uref, { ...payload, createdAt: serverTimestamp() });
      toast('تم حفظ التشكيلة ✅', 'ok');
    }
    builder.editId = null;
    await loadUserData();
    renderSavedTeams();
    qs('#statTeams').textContent = state.teams.length;
  } catch (e) { toast('فشل الحفظ: ' + e.message, 'err'); }
}

function renderSavedTeams() {
  const panel = qs('#savedTeamsPanel');
  panel.hidden = false;
  const wrap = qs('#savedTeams');
  if (!state.teams.length) {
    wrap.innerHTML = '<p class="fine">مفيش تشكيلات محفوظة لسه — ابنِ واحدة واضغط "حفظ التشكيلة".</p>';
    return;
  }
  wrap.innerHTML = state.teams.map(t => `
    <div class="list-item">
      <div class="li-main">
        <b>${esc(t.name)} · ${esc(t.formation)}</b>
        <small>قوة ${t.strength || '—'} · ${fmtDate(t.updatedAt || t.createdAt)}</small>
      </div>
      <div class="li-act">
        <button data-load-team="${t.id}" type="button">تحميل</button>
        <button data-del-team="${t.id}" class="del" type="button">حذف</button>
      </div>
    </div>`).join('');
  qsa('[data-load-team]').forEach(b => b.onclick = () => {
    const t = state.teams.find(x => x.id === b.dataset.loadTeam);
    builder.formation = FORMATIONS[t.formation] ? t.formation : '4-3-3';
    qs('#formationSelect').value = builder.formation;
    builder.slots = (t.slots || []).map(s => ({ pos: s.pos, x: s.x, y: s.y, player: s.player }));
    builder.editId = t.id;
    buildPitch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('تم تحميل التشكيلة — أي حفظ هيكتب فوقها', 'ok');
  });
  qsa('[data-del-team]').forEach(b => b.onclick = async () => {
    if (!await confirmBox('حذف التشكيلة', 'مش هينفع ترجعها.', true)) return;
    await deleteDoc(doc(db, 'users', state.user.uid, 'teams', b.dataset.delTeam));
    await loadUserData(); renderSavedTeams();
    toast('تم الحذف', 'ok');
  });
}

async function suggestLineup() {
  const players = builder.slots.map(s => s.player).filter(Boolean);
  if (players.length < 5) return toast('حط ٥ لاعبين على الأقل الأول', 'err');
  const btn = qs('#suggestBtn'); btn.disabled = true; btn.textContent = 'بفكر…';
  try {
    const model = getModel();
    const prompt = `أنت مدرب eFootball. عندي اللاعبين دول:
${players.map(p => `- ${p.name}${p.rating ? ' (تقييم ' + p.rating + ')' : ''}${p.slot ? ' — حالياً ' + p.slot : ''}`).join('\n')}

رتّبهم في خطة 4-3-3 أو 4-2-3-1 بأسلوب عملي. ممنوع تخترع لاعبين جدد.
أرجع JSON: {"formation":"4-3-3","assignments":[{"player":"الاسم","position":"GK|LB|CB|RB|DM|CM|AMF|LM|RM|LW|RW|ST"}],"why":"سبب مختصر"}`;
    const res = await model.generateContent(prompt);
    const d = parseJson(res.response.text());
    const map = {};
    (d.assignments || []).forEach(a => { map[lc(a.player)] = String(a.position || '').toUpperCase(); });
    const used = new Set();
    const formation = FORMATIONS[d.formation] ? d.formation : '4-3-3';
    const slots = FORMATIONS[formation].map(t => ({ pos: t[0], x: t[1], y: t[2], player: null }));
    // وزّع حسب توصية AI ثم أكمل الباقي
    (d.assignments || []).forEach(a => {
      const pl = players.find(p => lc(p.name) === lc(a.player) && !used.has(lc(p.name)));
      if (!pl) return;
      const target = slots.find(s => s.pos === String(a.position || '').toUpperCase() && !s.player) || slots.find(s => !s.player);
      if (target) { target.player = { ...pl, slot: target.pos }; used.add(lc(pl.name)); }
    });
    players.forEach(p => {
      if (used.has(lc(p.name))) return;
      const free = slots.find(s => !s.player);
      if (free) { free.player = { ...p, slot: free.pos }; used.add(lc(p.name)); }
    });
    builder.formation = formation;
    qs('#formationSelect').value = formation;
    builder.slots = slots;
    buildPitch();
    info('أفضل تشكيلة مقترحة', `${esc(d.why || '')}<br><br>الخطة: <b>${esc(formation)}</b> — راجعها واحفظها لو عجبتك.`);
  } catch (e) {
    toast(aiError(e).message, 'err');
  } finally { btn.disabled = false; btn.textContent = 'اقترح أفضل تشكيلة'; }
}

function openCompare() {
  if (state.teams.length < 2) return info('مقارنة', 'محتاج تشكيلتين محفوظتين على الأقل.');
  const opts = state.teams.map((t, i) => `<option value="${i}">${esc(t.name)} — ${esc(t.formation)} (${t.strength || '—'})</option>`).join('');
  modal({
    title: 'اختار تشكيلتين للمقارنة',
    body: `<label>التشكيلة الأولى<select id="cmpA" class="select" style="width:100%;margin-top:6px">${opts}</select></label>
           <label>التشكيلة التانية<select id="cmpB" class="select" style="width:100%;margin-top:6px">${opts}</select></label>`,
    actions: [{ label: 'إلغاء', value: false }, { label: 'قارن', value: true, cls: 'gold' }]
  }).then(ok => {
    if (!ok) return;
    const a = state.teams[Number(qs('#cmpA').value)];
    const b = state.teams[Number(qs('#cmpB').value)];
    if (!a || !b) return;
    renderCompare(a, b);
  });
}

function renderCompare(a, b) {
  const panel = qs('#comparePanel');
  panel.hidden = false;
  const line = (label, av, bv, higherBetter = true) => {
    const aw = higherBetter ? av > bv : av < bv;
    return `<div class="list-item"><div class="li-main"><b>${label}</b></div>
      <span class="chip ${aw ? 'ok' : ''}">${esc(a.name)}: ${av ?? '—'}</span>
      <span class="chip ${!aw && av !== bv ? 'ok' : ''}">${esc(b.name)}: ${bv ?? '—'}</span></div>`;
  };
  const avgRating = (t) => {
    const r = (t.slots || []).map(s => s.player).filter(p => p?.rating);
    return r.length ? Math.round(r.reduce((x, p) => x + p.rating, 0) / r.length) : null;
  };
  const filled = (t) => (t.slots || []).filter(s => s.player).length;
  panel.innerHTML = `
    <h3>مقارنة: ${esc(a.name)} vs ${esc(b.name)}</h3>
    ${line('قوة الفريق', a.strength, b.strength)}
    ${line('متوسط تقييم اللاعبين', avgRating(a), avgRating(b))}
    ${line('عدد اللاعبين', filled(a), filled(b))}
    ${line('الخطة', a.formation, b.formation, true)}
    <p class="fine">القوة محسوبة من متوسط التقييمات الحقيقية + اكتمال المراكز. اللاعبين بدون تقييم مش داخلين في المتوسط.</p>
    <div class="row-actions"><button class="btn ghost sm" id="closeCompare" type="button">إغلاق</button></div>`;
  qs('#closeCompare').onclick = () => { panel.hidden = true; };
  panel.scrollIntoView({ behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════════════════════
   ١٤) تحليل المباريات
   ═══════════════════════════════════════════════════════════════ */
let matchImageRead = null;

function renderMatches() {
  const stats = state.matches.reduce((acc, m) => {
    acc.played++;
    if (m.result === 'W') acc.w++; else if (m.result === 'L') acc.l++; else acc.d++;
    acc.gf += Number(m.scoreFor) || 0; acc.ga += Number(m.scoreAgainst) || 0;
    return acc;
  }, { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
  const sr = qs('#matchStats');
  if (state.matches.length) {
    sr.hidden = false;
    sr.innerHTML = `
      <div class="stat-box"><b>${stats.played}</b><span>مباراة</span></div>
      <div class="stat-box"><b>${stats.w}</b><span>فوز</span></div>
      <div class="stat-box"><b>${stats.d}</b><span>تعادل</span></div>
      <div class="stat-box"><b>${stats.l}</b><span>خسارة</span></div>
      <div class="stat-box"><b>${stats.gf}</b><span>أهداف ليا</span></div>
      <div class="stat-box"><b>${stats.ga}</b><span>ضدي</span></div>`;
  } else sr.hidden = true;

  const wrap = qs('#matchHistory');
  if (!state.matches.length) {
    wrap.innerHTML = '<p class="fine">مفيش مباريات مسجلة — سجّل أول مباراة فوق.</p>';
  } else {
    wrap.innerHTML = state.matches.slice(0, 20).map(m => `
      <div class="list-item">
        <span class="badge ${m.result === 'W' ? 'active' : m.result === 'L' ? 'rejected' : 'pending'}">${m.result === 'W' ? 'فوز' : m.result === 'L' ? 'خسارة' : 'تعادل'}</span>
        <div class="li-main">
          <b>${m.scoreFor} - ${m.scoreAgainst} ${m.opponent ? '· ' + esc(m.opponent) : ''}</b>
          <small>${fmtDateTime(m.createdAt)}${m.report?.rating ? ' · تقييم الأداء ' + m.report.rating : ''}</small>
        </div>
        <div class="li-act">
          ${m.report ? `<button data-view-match="${m.id}" type="button">التحليل</button>` : ''}
          <button class="del" data-del-match="${m.id}" type="button">حذف</button>
        </div>
      </div>`).join('');
  }
  if (!qs('#view-matches').dataset.matchBound) {
    qs('#view-matches').dataset.matchBound = '1';
    qs('#saveMatchBtn').onclick = saveMatch;
    qs('#matchImageBtn').onclick = () => qs('#matchImage').click();
    qs('#matchImage').onchange = async () => {
      const f = qs('#matchImage').files[0];
      if (!f) return;
      qs('#matchImageBtn').textContent = 'بقرأ الصورة…';
      try {
        const model = getModel();
        const inline = await fileToInlineData(f);
        const res = await model.generateContent([{ inlineData: inline }, {
          text: `اقرأ صورة نتيجة مباراة eFootball دي. أرجع JSON فقط:
{"scoreFor":0,"scoreAgainst":0,"goals":0,"opponent":"","visibleStats":["أي إحصائيات ظاهرة فعلاً"],"confidence":0.0,"notes":"لو الصورة مش واضحة"}
ممنوع تخترع أرقام غير ظاهرة.`
        }]);
        const d = parseJson(res.response.text());
        matchImageRead = d;
        if (d.scoreFor != null) qs('#mScoreFor').value = d.scoreFor;
        if (d.scoreAgainst != null) qs('#mScoreAgainst').value = d.scoreAgainst;
        if (d.goals != null) qs('#mGoals').value = d.goals;
        if (d.opponent) qs('#mOpponent').value = d.opponent;
        toast(`قرأت النتيجة — راجعها قبل الحفظ (ثقة ${Math.round((d.confidence || 0) * 100)}%)`, 'ok');
      } catch (e) {
        toast(aiError(e).message, 'err');
      } finally { qs('#matchImageBtn').textContent = 'رفع صورة النتيجة'; qs('#matchImage').value = ''; }
    };
  }
  qsa('[data-del-match]').forEach(b => b.onclick = async () => {
    if (!await confirmBox('حذف المباراة', 'مش هترجع تاني.', true)) return;
    await deleteDoc(doc(db, 'users', state.user.uid, 'matches', b.dataset.delMatch));
    await loadUserData(); renderMatches();
  });
  qsa('[data-view-match]').forEach(b => b.onclick = () => {
    const m = state.matches.find(x => x.id === b.dataset.viewMatch);
    if (m?.report) showMatchReport(m);
  });
}

function showMatchReport(m) {
  const r = m.report;
  const box = qs('#matchAiResult');
  box.hidden = false;
  box.innerHTML = `
    <h3>تحليل المباراة <small>${m.scoreFor}-${m.scoreAgainst}</small></h3>
    <div class="ai-meta"><span class="chip ok">تقييم الأداء ${r.rating}/100</span></div>
    <div class="ai-block"><h4>الخلاصة</h4><p>${esc(r.summary)}</p></div>
    <div class="ai-block"><h4>💪 اللي عملته صح</h4>${r.strengths.length ? `<ul>${r.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="fine">—</p>'}</div>
    <div class="ai-block"><h4>⚠️ نقاط ضعف</h4>${r.weaknesses.length ? `<ul>${r.weaknesses.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="fine">—</p>'}</div>
    <div class="ai-block"><h4>🔧 تحسينات</h4>${r.improvements.length ? `<ul>${r.improvements.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="fine">—</p>'}</div>
    <div class="ai-block"><h4>🎯 خطة المباراة الجاية</h4><p>${esc(r.nextMatchPlan)}</p></div>
    <p class="fine">التحليل مبني على النتيجة والملاحظات اللي أدخلتها — مفيش اتصال بحسابك في اللعبة.</p>`;
  box.scrollIntoView({ behavior: 'smooth' });
}

async function saveMatch() {
  const scoreFor = Number(qs('#mScoreFor').value);
  const scoreAgainst = Number(qs('#mScoreAgainst').value);
  const goals = Number(qs('#mGoals').value) || 0;
  const opponent = qs('#mOpponent').value.trim();
  const notes = qs('#mNotes').value.trim();
  if (!Number.isFinite(scoreFor) || !Number.isFinite(scoreAgainst) || qs('#mScoreFor').value === '' || qs('#mScoreAgainst').value === '') {
    return toast('أدخل نتيجة المباراة', 'err');
  }
  if (scoreFor > 99 || scoreAgainst > 99) return toast('النتيجة غير منطقية', 'err');
  const result = scoreFor > scoreAgainst ? 'W' : scoreFor < scoreAgainst ? 'L' : 'D';
  const btn = qs('#saveMatchBtn'); btn.disabled = true; btn.textContent = 'بحلل…';
  try {
    await useAiQuota('analyze');
    const report = await analyzeMatch({
      scoreFor, scoreAgainst, goals, opponent, notes, result,
      imageRead: matchImageRead ? `النتيجة المقروءة من الصورة: ${matchImageRead.scoreFor}-${matchImageRead.scoreAgainst}، إحصائيات ظاهرة: ${(matchImageRead.visibleStats || []).join(', ') || 'لا شيء'}` : ''
    });
    await addDoc(collection(db, 'users', state.user.uid, 'matches'), {
      scoreFor, scoreAgainst, goals, opponent, notes, result, report, createdAt: serverTimestamp()
    });
    await addDoc(collection(db, 'users', state.user.uid, 'notifications'), {
      type: 'ai', title: 'تحليل المباراة جاهز 📊',
      body: `نتيجة ${scoreFor}-${scoreAgainst} — تقييم الأداء ${report.rating}/100.`,
      read: false, createdAt: serverTimestamp()
    });
    matchImageRead = null;
    qs('#mScoreFor').value = ''; qs('#mScoreAgainst').value = ''; qs('#mGoals').value = ''; qs('#mOpponent').value = ''; qs('#mNotes').value = '';
    await loadUserData();
    renderMatches();
    showMatchReport(state.matches[0]);
    refreshBell();
    qs('#statMatches').textContent = state.matches.length;
    toast('تم حفظ المباراة والتحليل ✅', 'ok');
  } catch (e) {
    toast(aiError(e).message, 'err');
  } finally { btn.disabled = false; btn.textContent = 'حفظ وتحليل'; }
}

/* ═══════════════════════════════════════════════════════════════
   ١٥) المتجر والسلة والطلبات
   ═══════════════════════════════════════════════════════════════ */
function renderStore() {
  const grid = qs('#storeGrid');
  const empty = qs('#storeEmpty');
  qs('#cartCount').textContent = state.cart.reduce((a, c) => a + c.qty, 0);
  if (!state.products.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = state.products.map(p => `
    <div class="card gold-ring">
      ${p.image ? `<img class="card-img" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()" />` : `<div class="card-ico">🛍️</div>`}
      <h3>${esc(p.name)}</h3>
      <p>${esc((p.desc || '').slice(0, 110))}</p>
      <span class="price">${p.price > 0 ? money(p.price) : 'مجاني'}</span>
      <div class="row-actions">
        <button class="btn gold sm" data-view-product="${p.id}" type="button">التفاصيل</button>
        <button class="btn ghost sm" data-add-cart="${p.id}" type="button">أضف للسلة</button>
      </div>
    </div>`).join('');
  qsa('[data-view-product]').forEach(b => b.onclick = () => {
    state.currentProduct = state.products.find(p => p.id === b.dataset.viewProduct);
    navigate('product');
  });
  qsa('[data-add-cart]').forEach(b => b.onclick = () => addToCart(b.dataset.addCart));
  if (!qs('#view-store').dataset.storeBound) {
    qs('#view-store').dataset.storeBound = '1';
    qs('#storeSearch').oninput = () => {
      const t = lc(qs('#storeSearch').value);
      qsa('#storeGrid .card').forEach((c, i) => {
        const p = state.products[i];
        c.style.display = !t || lc(p.name + ' ' + (p.desc || '')).includes(t) ? '' : 'none';
      });
    };
    qs('#cartBtn').onclick = () => navigate('cart');
  }
}

function renderProduct() {
  const p = state.currentProduct;
  const box = qs('#productDetail');
  if (!p) { box.innerHTML = '<div class="panel empty"><b>الخدمة غير موجودة</b></div>'; return; }
  box.innerHTML = `
    <div class="panel">
      ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" style="width:100%;border-radius:16px;margin-bottom:14px;max-height:320px;object-fit:cover" onerror="this.remove()" />` : ''}
      <h3 style="font-size:19px">${esc(p.name)}</h3>
      <span class="price">${p.price > 0 ? money(p.price) : 'مجاني'}</span>
      <p style="font-size:13px;color:#b6b0a2;margin-top:12px;line-height:1.9;white-space:pre-wrap">${esc(p.desc || '')}</p>
      ${Array.isArray(p.features) && p.features.length ? `<div class="ai-block" style="margin-top:16px"><h4>هتحصل على</h4><ul>${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
      <div class="row-actions">
        <button class="btn gold" id="pdAdd" type="button">اطلب الخدمة</button>
        <button class="btn ghost" data-nav="store" type="button">رجوع للمتجر</button>
      </div>
      <p class="fine">الأدمن بيتواصل معاك بعد الطلب لتأكيد التفاصيل والدفع. الخدمات دي خدمات رقمية من فريق المنصة — مفيش بيع أو مشاركة حسابات لعب.</p>
    </div>`;
  qs('#pdAdd').onclick = () => { addToCart(p.id); navigate('cart'); };
}

function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const ex = state.cart.find(c => c.id === id);
  if (ex) ex.qty++; else state.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 });
  qs('#cartCount').textContent = state.cart.reduce((a, c) => a + c.qty, 0);
  toast('تمت الإضافة للسلة 🛒', 'ok');
}

function renderCart() {
  const body = qs('#cartBody');
  if (!state.cart.length) {
    body.innerHTML = '<div class="empty" style="text-align:center;padding:20px 0"><b>السلة فاضية</b><p class="fine">اختار خدمة من المتجر.</p><div class="row-actions" style="justify-content:center"><button class="btn gold sm" data-nav="store" type="button">روح للمتجر</button></div></div>';
    return;
  }
  const total = state.cart.reduce((a, c) => a + c.price * c.qty, 0);
  body.innerHTML = `
    <div class="list">
      ${state.cart.map(c => `
        <div class="list-item">
          <div class="li-main"><b>${esc(c.name)}</b><small>${money(c.price)} × ${c.qty}</small></div>
          <div class="li-act">
            <button data-qty="${c.id}" data-delta="-1" type="button">−</button>
            <span style="padding:0 6px;align-self:center;font-family:Oxanium;font-size:12px">${c.qty}</span>
            <button data-qty="${c.id}" data-delta="1" type="button">+</button>
            <button class="del" data-rm="${c.id}" type="button">حذف</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="list-item" style="margin-top:12px;border-color:rgba(212,175,55,.35);background:rgba(212,175,55,.08)">
      <div class="li-main"><b>الإجمالي</b><small>${state.cart.length} خدمة</small></div>
      <span class="price" style="margin:0">${money(total)}</span>
    </div>
    <label class="full" style="margin-top:12px">ملاحظات للطلب (اختياري)<textarea id="orderNote" class="input" rows="2" placeholder="أي تفاصيل تساعدنا"></textarea></label>
    <div class="row-actions"><button class="btn gold" id="placeOrderBtn" type="button">تأكيد الطلب</button></div>
    <p class="fine">الطلب هيتراجع من الإدارة، وبيتم التواصل معاك لتأكيد الدفع. مفيش دفع آلي في المنصة دلوقتي، ومفيش شيء بيتحسب "مدفوع" قبل تأكيد الإدارة.</p>`;
  qsa('[data-qty]').forEach(b => b.onclick = () => {
    const c = state.cart.find(x => x.id === b.dataset.qty);
    c.qty += Number(b.dataset.delta);
    if (c.qty <= 0) state.cart = state.cart.filter(x => x.id !== c.id);
    renderCart();
  });
  qsa('[data-rm]').forEach(b => b.onclick = () => {
    state.cart = state.cart.filter(x => x.id !== b.dataset.rm);
    renderCart();
  });
  qs('#placeOrderBtn').onclick = placeOrder;
}

async function placeOrder() {
  if (!state.cart.length) return;
  const btn = qs('#placeOrderBtn'); btn.disabled = true; btn.textContent = 'بنسجل الطلب…';
  const total = state.cart.reduce((a, c) => a + c.price * c.qty, 0);
  try {
    const ref = await addDoc(collection(db, 'orders'), {
      userId: state.user.uid,
      userName: state.profile.name,
      userPhone: state.profile.phone,
      userEmail: state.profile.email || '',
      type: 'product',
      items: state.cart.map(c => ({ productId: c.id, name: c.name, price: c.price, qty: c.qty })),
      total,
      status: 'pending',
      note: qs('#orderNote')?.value?.trim().slice(0, 500) || '',
      paymentMethod: state.config.paymentMethods || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, 'users', state.user.uid, 'notifications'), {
      type: 'order', title: 'تم استلام طلبك ✅',
      body: `طلبك بقيمة ${money(total)} اتسجل وحالته "بانتظار المراجعة". هنبلغك أول ما يتأكد.`,
      read: false, createdAt: serverTimestamp()
    });
    state.cart = [];
    qs('#cartCount').textContent = '0';
    await loadUserData();
    refreshBell();
    info('تم إرسال الطلب ✅', `رقم الطلب: <b>${ref.id.slice(0, 8)}</b><br>تابعه من صفحة "طلباتي". هيتواصل معك فريق المنصة لتأكيد الدفع عبر ${esc(state.config.paymentMethods || 'الطرق المتاحة')}.`);
    navigate('orders');
  } catch (e) {
    toast('فشل إرسال الطلب: ' + e.message, 'err');
  } finally { btn.disabled = false; btn.textContent = 'تأكيد الطلب'; }
}

function orderStatusBadge(s) {
  const map = { pending: ['pending', 'بانتظار المراجعة'], confirmed: ['paid', 'تم تأكيد الدفع'], delivered: ['done', 'تم التنفيذ'], rejected: ['rejected', 'مرفوض'], cancelled: ['cancelled', 'ملغي'] };
  const [cls, label] = map[s] || ['pending', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderOrders() {
  const list = qs('#ordersList');
  qs('#ordersEmpty').hidden = state.orders.length > 0;
  list.innerHTML = state.orders.map(o => `
    <div class="list-item" style="align-items:flex-start;flex-wrap:wrap">
      ${orderStatusBadge(o.status)}
      <div class="li-main">
        <b>${o.type === 'plan' ? 'اشتراك ' + esc(o.items?.[0]?.name || 'PRO') : (o.items || []).map(i => esc(i.name)).join(' + ')}</b>
        <small>${fmtDateTime(o.createdAt)} · ${money(o.total)}</small>
        ${o.adminNote ? `<small style="color:#f5d778">ملاحظة الإدارة: ${esc(o.adminNote)}</small>` : ''}
      </div>
      ${o.status === 'pending' ? `<div class="li-act"><button class="del" data-cancel-order="${o.id}" type="button">إلغاء</button></div>` : ''}
    </div>`).join('');
  qsa('[data-cancel-order]').forEach(b => b.onclick = async () => {
    if (!await confirmBox('إلغاء الطلب', 'تقدر تلغي الطلب وهو لسه بانتظار المراجعة.', true)) return;
    await updateDoc(doc(db, 'orders', b.dataset.cancelOrder), { status: 'cancelled', updatedAt: serverTimestamp() });
    await loadUserData(); renderOrders();
    toast('تم إلغاء الطلب', 'ok');
  });
}

/* ═══════════════════════════════════════════════════════════════
   ١٦) الاشتراكات
   ═══════════════════════════════════════════════════════════════ */
function renderPro() {
  const grid = qs('#plansGrid');
  const plans = state.plans || DEFAULT_PLANS;
  const keys = ['free', 'pro'].filter(k => plans[k]);
  grid.innerHTML = keys.map(k => {
    const p = plans[k];
    const featured = k === 'pro';
    return `<div class="plan ${featured ? 'featured gold-ring' : ''}">
      ${featured ? '<span class="badge-top">الأكثر اختياراً</span>' : ''}
      <div class="plan-name">${esc(p.name)}</div>
      <div class="plan-price">${p.price > 0 ? money(p.price) : 'مجاناً'} ${p.days ? `<small>/ ${p.days} يوم</small>` : ''}</div>
      <p class="fine">${esc(p.tagline || '')}</p>
      <ul class="plan-perks">${(p.perks || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <button class="btn ${featured ? 'gold' : 'ghost'}" data-plan="${k}" type="button" ${k === 'free' ? 'disabled' : ''}>
        ${k === 'free' ? 'الباقة الحالية' : 'اطلب الاشتراك'}
      </button>
    </div>`;
  }).join('');
  qsa('[data-plan]').forEach(b => b.onclick = () => requestPlan(b.dataset.plan));

  const box = qs('#subStatus');
  const p = state.profile;
  if (isProUser()) {
    box.hidden = false;
    box.innerHTML = `<h3>اشتراكك</h3>
      <div class="ai-meta">
        <span class="chip ok">PRO نشط</span>
        ${p.planExpiresAt ? `<span class="chip">ينتهي ${fmtDate(p.planExpiresAt)}</span>` : '<span class="chip">مفتوح</span>'}
      </div>
      <p class="fine">استفدت من كل أدوات PRO. الاشتراك بيتجدد بعد تأكيد الدفع.</p>`;
  } else if (state.orders.some(o => o.type === 'plan' && o.status === 'pending')) {
    box.hidden = false;
    box.innerHTML = `<h3>طلب اشتراك قيد المراجعة</h3><p class="fine">طلبك وصل للإدارة. الاشتراك هيتفعل بعد تأكيد الدفع — مش هيتحسب مفعّل قبل كده.</p>`;
  } else {
    box.hidden = true;
  }
}

async function requestPlan(key) {
  const plan = state.plans[key];
  if (!plan || key === 'free') return;
  const ok = await modal({
    title: `طلب اشتراك ${plan.name}`,
    body: `<p>السعر: <b>${money(plan.price)}</b> لمدة <b>${plan.days} يوم</b>.</p>
      <p class="fine">هيتسجل طلب بحالة "بانتظار المراجعة". بعد كده فريقنا يتواصل معاك لتأكيد الدفع (${esc(state.config.paymentMethods || 'الطرق المتاحة')}). الاشتراك بيتفعل بعد التأكيد فقط.</p>
      <label>ملاحظة (اختياري)<input id="planNote" class="input" placeholder="مثلاً: هحول فودافون كاش" /></label>`,
    actions: [{ label: 'إلغاء', value: false }, { label: 'تأكيد الطلب', value: true, cls: 'gold' }]
  });
  if (!ok) return;
  try {
    await addDoc(collection(db, 'orders'), {
      userId: state.user.uid,
      userName: state.profile.name,
      userPhone: state.profile.phone,
      userEmail: state.profile.email || '',
      type: 'plan',
      items: [{ productId: key, name: plan.name, price: plan.price, qty: 1, days: plan.days }],
      total: plan.price,
      status: 'pending',
      note: qs('#planNote')?.value?.trim().slice(0, 400) || '',
      paymentMethod: state.config.paymentMethods || '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, 'users', state.user.uid, 'notifications'), {
      type: 'subscription', title: 'طلب اشتراك PRO اتسجل 💎',
      body: 'طلبك بانتظار تأكيد الدفع من الإدارة. مش هيتفعل غير بعد التأكيد.',
      read: false, createdAt: serverTimestamp()
    });
    await loadUserData();
    refreshBell();
    renderPro();
    toast('تم تسجيل طلب الاشتراك ✅', 'ok');
  } catch (e) { toast('فشل الطلب: ' + e.message, 'err'); }
}

/* ═══════════════════════════════════════════════════════════════
   ١٧) الحساب والإعدادات
   ═══════════════════════════════════════════════════════════════ */
function renderAccount() {
  const p = state.profile;
  qs('#profAvatar').textContent = (p.name?.[0] || '؟').toUpperCase();
  qs('#profName').textContent = p.name || '—';
  qs('#profPhone').textContent = p.settings?.privHidePhone === false ? (p.phone || '—') : maskPhone(p.phone);
  qs('#profEmail').textContent = p.email || '—';
  const chip = qs('#profPlan');
  const pro = isProUser();
  chip.textContent = pro ? 'PRO' : 'FREE';
  chip.className = 'prof-plan' + (pro ? ' pro' : '');
  qs('#logoutRow').onclick = doLogout;
}
function maskPhone(ph) {
  const d = String(ph || '');
  if (d.length < 6) return '—';
  return d.slice(0, 3) + '•'.repeat(Math.max(0, d.length - 6)) + d.slice(-3);
}

async function doLogout() {
  if (!await confirmBox('تسجيل الخروج', 'بياناتك واشتراكك هيفضلوا محفوظين — هترجع تلاقيهم زي ما هما.')) return;
  sessionStorage.removeItem('pes_unlocked_' + state.user.uid);
  sessionStorage.removeItem('pes_splash_seen');
  await signOut(auth);
  chatHistory = [];
  qs('#chatBody').innerHTML = ''; qs('#chatBody').dataset.init = '';
  toast('تم تسجيل الخروج', 'ok');
}

function renderSettings() {
  const p = state.profile;
  qs('#setName').value = p.name || '';
  qs('#setPhone').value = p.phone || '';
  qs('#setEmail').value = p.email || '';
  const s = p.settings || {};
  qs('#notifOrders').checked = s.notifOrders !== false;
  qs('#notifUpdates').checked = s.notifUpdates !== false;
  qs('#notifAi').checked = s.notifAi !== false;
  qs('#privHistory').checked = s.privHistory !== false;
  qs('#privHidePhone').checked = s.privHidePhone !== false;

  const hasPin = !!p.pin?.hash;
  qs('#pinState').innerHTML = hasPin
    ? '<span class="chip ok">الرمز السري مفعّل</span>'
    : '<span class="chip">مفيش رمز سري — التطبيق بيفتح بكلمة المرور بس</span>';
  qs('#removePinBtn').style.display = hasPin ? '' : 'none';

  const provider = p.provider || (p.email ? 'password' : 'google');
  qs('#authProviderNote').textContent = provider === 'google'
    ? 'حسابك مربوط بجوجل — كلمة المرور بتتدار من حساب جوجل نفسه.'
    : provider === 'phone'
      ? 'حسابك بيدخل بكود الموبايل.'
      : 'كلمة المرور محفوظة مشفرة عند Firebase — إحنا لا نشوفها ولا نخزنها.';

  if (!qs('#view-settings').dataset.bound) {
    qs('#view-settings').dataset.bound = '1';
    qs('#saveProfileBtn').onclick = saveProfile;
    qs('#savePinBtn').onclick = savePin;
    qs('#removePinBtn').onclick = removePin;
    qs('#changePassBtn').onclick = changePassword;
    qs('#saveNotifBtn').onclick = saveNotif;
    qs('#savePrivacyBtn').onclick = savePrivacy;
    qs('#deleteAccountBtn').onclick = deleteAccount;
    qs('#logoutRow') && (qs('#logoutRow').onclick = doLogout);
  }
}

async function saveProfile() {
  const name = qs('#setName').value.trim();
  const phone = normPhone(qs('#setPhone').value);
  const email = lc(qs('#setEmail').value);
  if (name.length < 2) return toast('الاسم قصير', 'err');
  if (phone.length < 10) return toast('رقم الموبايل غير صحيح', 'err');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('الإيميل غير صحيح', 'err');
  const btn = qs('#saveProfileBtn'); btn.disabled = true;
  try {
    const payload = { name, phone };
    if (email && email !== state.profile.email) {
      // تغيير إيميل تسجيل الدخول يحتاج خطوة تحقق من Firebase
      const okMail = await confirmBox('تغيير إيميل الدخول', 'هيتبعت رابط تحقق على الإيميل الجديد، وبعد ما تأكده يتغير إيميل الدخول. تكمل؟');
      if (!okMail) { btn.disabled = false; return; }
      try {
        await verifyBeforeUpdateEmail(state.user, email);
        await updateDoc(doc(db, 'users', state.user.uid), { pendingEmail: email });
        toast('بعتنالك رابط تحقق على الإيميل الجديد', 'ok');
      } catch (e) {
        toast('مش قادر أغير إيميل الدخول الآن: ' + authError(e), 'err');
      }
    }
    await updateDoc(doc(db, 'users', state.user.uid), { ...payload, updatedAt: serverTimestamp() });
    if (auth.currentUser && name !== auth.currentUser.displayName) await updateProfile(auth.currentUser, { displayName: name }).catch(() => {});
    state.profile = { ...state.profile, ...payload };
    qs('#helloName').textContent = name.split(' ')[0];
    qs('#avatarInitial').textContent = (name[0] || '؟').toUpperCase();
    renderAccount();
    toast('تم حفظ بياناتك ✅', 'ok');
  } catch (e) { toast('فشل الحفظ: ' + e.message, 'err'); }
  finally { btn.disabled = false; }
}

async function savePin() {
  const pin = qs('#pinNew').value.trim();
  const pin2 = qs('#pinConfirm').value.trim();
  if (!/^\d{4}$/.test(pin)) return toast('الرمز ٤ أرقام', 'err');
  if (pin !== pin2) return toast('الرمز وتأكيده غير متطابقين', 'err');
  if (/^(\d)\1{3}$/.test(pin) || ['1234', '0000', '1111', '2000', '2024'].includes(pin)) {
    return toast('الرمز سهل جدًا — اختار أرقام أقل تخمينًا', 'err');
  }
  try {
    const rec = await makePinHash(pin);
    await updateDoc(doc(db, 'users', state.user.uid), { pin: rec });
    state.profile.pin = rec;
    qs('#pinNew').value = ''; qs('#pinConfirm').value = '';
    renderSettings();
    toast('تم حفظ الرمز السري ✅', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}
async function removePin() {
  if (!await confirmBox('إزالة الرمز السري', 'التطبيق هيفتح بكلمة المرور بس. متأكد؟', true)) return;
  await updateDoc(doc(db, 'users', state.user.uid), { pin: deleteField() });
  state.profile.pin = null;
  renderSettings();
  toast('تم إزالة الرمز', 'ok');
}

async function changePassword() {
  const cur = qs('#curPass').value;
  const nw = qs('#newPass').value;
  if (!cur || !nw) return toast('املأ الحقلين', 'err');
  if (nw.length < 8) return toast('كلمة المرور الجديدة ٨ حروف على الأقل', 'err');
  const btn = qs('#changePassBtn'); btn.disabled = true;
  try {
    const cred = EmailAuthProvider.credential(state.user.email, cur);
    await reauthenticateWithCredential(state.user, cred);
    await updatePassword(state.user, nw);
    qs('#curPass').value = ''; qs('#newPass').value = '';
    toast('تم تغيير كلمة المرور ✅', 'ok');
  } catch (e) { toast(authError(e), 'err'); }
  finally { btn.disabled = false; }
}

async function saveNotif() {
  await updateDoc(doc(db, 'users', state.user.uid), {
    'settings.notifOrders': qs('#notifOrders').checked,
    'settings.notifUpdates': qs('#notifUpdates').checked,
    'settings.notifAi': qs('#notifAi').checked
  });
  state.profile.settings = { ...state.profile.settings, notifOrders: qs('#notifOrders').checked, notifUpdates: qs('#notifUpdates').checked, notifAi: qs('#notifAi').checked };
  toast('تم حفظ تفضيلات الإشعارات ✅', 'ok');
}
async function savePrivacy() {
  await updateDoc(doc(db, 'users', state.user.uid), {
    'settings.privHistory': qs('#privHistory').checked,
    'settings.privHidePhone': qs('#privHidePhone').checked
  });
  state.profile.settings = { ...state.profile.settings, privHistory: qs('#privHistory').checked, privHidePhone: qs('#privHidePhone').checked };
  renderAccount();
  toast('تم الحفظ ✅', 'ok');
}

async function deleteAccount() {
  const typed = qs('#deleteConfirm').value.trim();
  if (lc(typed) !== lc(state.profile.name)) return toast('اكتب اسمك بالظبط للتأكيد', 'err');
  if (!await confirmBox('حذف الحساب نهائيًا', 'هيتم حذف بياناتك كلها: التشكيلات، المباريات، التحليلات، الإشعارات. الخطوة دي مش بترجع.', true)) return;
  const btn = qs('#deleteAccountBtn'); btn.disabled = true; btn.textContent = 'بيمسح…';
  try {
    const uid = state.user.uid;
    const uref = doc(db, 'users', uid);
    for (const sub of ['teams', 'matches', 'analyses', 'notifications']) {
      const snap = await getDocs(collection(uref, sub));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
    await deleteDoc(uref);
    await state.user.delete().catch(async () => {
      toast('لازم تعمل تسجيل دخول تاني عشان نكمل الحذف', 'err');
    });
    toast('تم حذف الحساب', 'ok');
    await signOut(auth).catch(() => {});
  } catch (e) {
    toast('فشل الحذف: ' + e.message, 'err');
  } finally { btn.disabled = false; btn.textContent = 'حذف الحساب نهائيًا'; }
}

/* ═══════════════════════════════════════════════════════════════
   ١٨) الإشعارات
   ═══════════════════════════════════════════════════════════════ */
function refreshBell() {
  const unread = state.notifications.filter(n => !n.read).length;
  qs('#bellDot').hidden = unread === 0;
}

function renderNotifications() {
  const list = qs('#notifList');
  qs('#notifEmpty').hidden = state.notifications.length > 0;
  list.innerHTML = state.notifications.map(n => `
    <div class="list-item ${n.read ? '' : 'unread'}" style="${n.read ? 'opacity:.72' : 'border-color:rgba(212,175,55,.35)'}">
      <div class="li-main"><b>${esc(n.title)}</b><small>${esc(n.body)}</small><small style="color:#6f6c64">${fmtDateTime(n.createdAt)}</small></div>
      ${n.read ? '' : `<div class="li-act"><button data-read="${n.id}" type="button">تم القراءة</button></div>`}
    </div>`).join('');
  qsa('[data-read]').forEach(b => b.onclick = async () => {
    await updateDoc(doc(db, 'users', state.user.uid, 'notifications', b.dataset.read), { read: true });
    await loadUserData(); renderNotifications(); refreshBell();
  });
  if (state.notifications.some(n => !n.read)) {
    setTimeout(async () => {
      const unread = state.notifications.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'users', state.user.uid, 'notifications', n.id), { read: true }).catch(() => {});
      }
      state.notifications = state.notifications.map(n => ({ ...n, read: true }));
      refreshBell();
    }, 2500);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ١٩) ربط الأزرار العامة
   ═══════════════════════════════════════════════════════════════ */
function bindGlobalUI() {
  qs('#bellBtn').onclick = () => navigate('notifications');
  qs('#avatarBtn').onclick = () => navigate('account');
  window.addEventListener('hashchange', () => {
    const r = location.hash.replace('#/', '') || 'home';
    if (VIEWS.includes(r) && r !== state.route) navigate(r);
  });
  const initial = location.hash.replace('#/', '') || 'home';
  if (VIEWS.includes(initial)) state.route = initial;
}

/* ═══════════════════════════════════════════════════════════════
   تشغيل
   ═══════════════════════════════════════════════════════════════ */
boot();
