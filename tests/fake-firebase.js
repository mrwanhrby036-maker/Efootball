/* محاكي Firebase في الذاكرة — للاختبار الآلي فقط (مش بيتنشر) */

const store = new Map();      // path -> data
const listeners = [];
let currentUser = null;
export const __state = { store, setUser(u) { currentUser = u; listeners.forEach(l => l(u)); } };
// نشارك الحالة مع الاختبار حتى لو الحزمة اتعملت inline
globalThis.__FAKE_STORE__ = store;
globalThis.__FAKE_STATE__ = __state;
globalThis.__FAKE_SIGNIN__ = (email) => signInWithEmailAndPassword(null, email, 'x');

export const serverTimestamp = () => ({ __ts: Date.now() });
export const Timestamp = {
  now: () => ({ toDate: () => new Date(), toMillis: () => Date.now(), seconds: Date.now() / 1000 }),
  fromDate: (d) => ({ toDate: () => d, toMillis: () => d.getTime(), seconds: d.getTime() / 1000 })
};
export const increment = (n) => ({ __inc: n });
export const deleteField = () => ({ __del: true });
export const writeBatch = () => ({ set(){}, update(){}, delete(){}, commit: async () => {} });

function applyPatch(path, patch) {
  const cur = store.get(path) || {};
  const next = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (v && v.__del) { delete next[k]; continue; }
    if (v && v.__inc !== undefined) { next[k] = (Number(next[k]) || 0) + v.__inc; continue; }
    if (k.includes('.') && !(v && typeof v === 'object' && !v.__ts)) {
      const [a, ...rest] = k.split('.');
      next[a] = next[a] || {};
      let ref = next[a];
      for (let i = 0; i < rest.length - 1; i++) { ref[rest[i]] = ref[rest[i]] || {}; ref = ref[rest[i]]; }
      ref[rest[rest.length - 1]] = v;
      continue;
    }
    next[k] = v;
  }
  store.set(path, next);
  return next;
}

const snap = (path) => ({
  id: path.split('/').pop(),
  exists: () => store.has(path),
  data: () => store.get(path),
  ref: { path, id: path.split('/').pop() }
});

export const initializeApp = () => ({ name: '[fake]' });
export const getApps = () => [];
export const getApp = () => ({});
export const deleteApp = async () => {};
export const getFirestore = () => ({ __db: true });

export const getAuth = () => ({
  currentUser,
  __fake: true
});

export function onAuthStateChanged(auth, cb) {
  listeners.push(cb);
  setTimeout(() => cb(currentUser), 0);
  return () => {};
}
export async function setPersistence() {}
export const browserLocalPersistence = {};

export async function createUserWithEmailAndPassword(auth, email, pass) {
  if ([...store.keys()].some(k => store.get(k)?.email === email)) {
    const e = new Error('exists'); e.code = 'auth/email-already-in-use'; throw e;
  }
  const uid = 'uid_' + Math.random().toString(36).slice(2, 8);

  const user = { uid, email, displayName: null, providerData: [{ providerId: 'password' }], delete: async () => true };
  currentUser = user;
  setTimeout(() => listeners.forEach(l => l(user)), 0);
  return { user };
}
export async function signInWithEmailAndPassword(auth, email, pass) {
  const found = [...store.entries()].find(([k, v]) => v?.email === email);
  if (!found) { const e = new Error('nope'); e.code = 'auth/invalid-credential'; throw e; }

  const user = { uid: found[1].uid, email, displayName: found[1].name, providerData: [{ providerId: 'password' }], delete: async () => true };
  currentUser = user;
  setTimeout(() => listeners.forEach(l => l(user)), 0);
  return { user };
}
export async function signOut() { currentUser = null; listeners.forEach(l => l(null)); }
export async function updateProfile(u, p) { u.displayName = p.displayName; }
export async function sendPasswordResetEmail() {}
export async function updatePassword() {}
export async function verifyBeforeUpdateEmail() {}
export const EmailAuthProvider = { credential: () => ({}) };
export async function reauthenticateWithCredential() {}
export class GoogleAuthProvider { setCustomParameters() {} }
export async function signInWithPopup() { throw Object.assign(new Error('no'), { code: 'auth/popup-blocked' }); }
export async function signInWithRedirect() {}
export async function getRedirectResult() { return null; }
export async function linkWithPopup() {}
export class RecaptchaVerifier { constructor() {} clear() {} }
export async function signInWithPhoneNumber() { return { confirm: async () => ({}) }; }
export async function linkWithPhoneNumber() {}
export const PhoneAuthProvider = {};

export const collection = (...args) => {
  // (db, 'users') | (db, 'users', uid, 'notifications') | (colRef, 'sub')
  const parts = args.filter(x => typeof x === 'string');
  if (args[0] && args[0].__col) parts.unshift(args[0].__col);
  if (args[0] && args[0].__path) parts.unshift(args[0].__path);
  return { __col: parts.join('/') };
};
export const doc = (a, b, c, d) => {
  if (a && a.__col) return { __path: `${a.__col}/${b}` };
  if (a && a.__path) {
    const parts = [a.__path, b, c, d].filter(x => x !== undefined && x !== null && x !== '');
    return { __path: parts.join('/') };
  }
  const parts = [b, c, d].filter(x => x !== undefined && x !== null && x !== '');
  return { __path: parts.join('/') };
};
// الاستعلامات: المحاكي بيرجع المرجع مع الاحتفاظ بالفلاتر كبيانات وصفية
export const query = (ref, ...clauses) => ({ ...ref, __clauses: clauses.filter(Boolean) });
export const where = (field, op, value) => ({ __where: { field, op, value } });
export const orderBy = (field, dir) => ({ __orderBy: { field, dir } });
export const limit = (n) => ({ __limit: n });

export async function getDoc(ref) {
  const p = ref.__path || ref.path;
  return snap(p);
}
export async function getDocs(ref) {
  const p = (ref.__path || ref.path || ref.__col || '').replace(/\/$/, '');
  if (!p) return { docs: [], size: 0, empty: true };
  let docs = [...store.entries()]
    .filter(([k]) => k.startsWith(p + '/') && k.split('/').length === p.split('/').length + 1)
    .map(([k]) => snap(k));

  // تطبيق الفلاتر البسيطة (where / orderBy / limit) لتحاكي Firestore
  for (const c of (ref.__clauses || [])) {
    if (c && c.__where) {
      const { field, op, value } = c.__where;
      docs = docs.filter(d => {
        const v = d.data()?.[field];
        if (op === '==') return v === value;
        if (op === '!=') return v !== value;
        if (op === '>') return v > value;
        if (op === '<') return v < value;
        if (op === 'array-contains') return Array.isArray(v) && v.includes(value);
        return true;
      });
    }
  }
  for (const c of (ref.__clauses || [])) {
    if (c && c.__orderBy) {
      const { field, dir } = c.__orderBy;
      const val = (d) => {
        const v = d.data()?.[field];
        return v && v.toMillis ? v.toMillis() : (v ?? 0);
      };
      docs.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (dir === 'desc' ? -1 : 1));
    }
    if (c && c.__limit) docs = docs.slice(0, c.__limit);
  }
  return { docs, size: docs.length, empty: docs.length === 0 };
}
export async function setDoc(ref, data) {
  const p = ref.__path || ref.path;
  store.set(p, { ...store.get(p), ...data });
  return true;
}
export async function addDoc(ref, data) {
  const p = `${ref.__col}/${Math.random().toString(36).slice(2, 10)}`;
  store.set(p, data);
  return { id: p.split('/').pop(), path: p };
}
export async function updateDoc(ref, data) {
  const p = ref.__path || ref.path;
  if (!store.has(p)) { const e = new Error('not-found'); e.code = 'not-found'; throw e; }
  applyPatch(p, data);
  return true;
}
export async function deleteDoc(ref) { store.delete(ref.__path || ref.path); return true; }
export const arrayUnion = (...a) => a;
export const arrayRemove = (...a) => a;
export const collectionGroup = (db, n) => ({ __col: n });

export const getAI = () => ({ __ai: true });
export class GoogleAIBackend {}
export const Schema = { object: () => ({}), string: () => ({}), number: () => ({}), array: () => ({}), integer: () => ({}) };
export function getGenerativeModel() {
  return {
    generateContent: async (prompt) => ({
      response: { text: () => JSON.stringify(fakeAiReply(prompt)) }
    }),
    startChat: () => ({
      sendMessageStream: async () => ({
        stream: (async function* () { yield { text: () => 'أهلاً يا كابتن، ' }; yield { text: () => 'إيه اللي محتاجه في فريقك؟' }; })()
      })
    })
  };
}

function fakeAiReply(prompt) {
  const p = String(prompt?.text || prompt?.[1]?.text || prompt || '');
  if (p.includes('"players"') && p.includes('confidence')) {
    return { formation: '4-3-3', confidence: 0.82, imageType: 'تشكيلة', warnings: [], players: [
      { slot: 'GK', name: 'Donnarumma', confidence: 0.9, ratingOnCard: null },
      { slot: 'CB', name: 'Van Dijk', confidence: 0.86, ratingOnCard: null },
      { slot: 'CM', name: 'Bellingham', confidence: 0.44, ratingOnCard: null }
    ] };
  }
  if (p.includes('"strengths"') && p.includes('"transfers"')) {
    return { overall: 78, estimated: true, formationSuggestion: { formation: '4-2-3-1', reason: 'توازن أفضل في الوسط' },
      strengths: ['وسط قوي'], weaknesses: ['دفاع أبطأ'], positionFixes: [{ player: 'Bellingham', current: 'CM', better: 'AMF', why: 'صناعة لعب' }],
      tactics: { playStyle: 'Possession', defensiveLine: 'متوسط', pressing: 'متوسط', buildUp: 'تمرير قصير', instructions: ['حافظ على الكرة'] },
      chemistry: { score: 74, notes: ['انسجام جيد'] }, transfers: [{ need: 'CB', why: 'سرعة أقل', profile: 'مدافع سريع' }],
      training: ['درّب الوسط'], confidence: 0.8 };
  }
  if (p.includes('"nextMatchPlan"')) {
    return { summary: 'مباراة متوازنة', strengths: ['هجوم جيد'], weaknesses: ['دفاع مكشوف'], improvements: ['ضغط أعلى'], nextMatchPlan: 'ابدأ حذر', rating: 70 };
  }
  if (p.includes('"assignments"')) {
    return { formation: '4-3-3', assignments: [{ player: 'Bellingham', position: 'CM' }], why: 'توزيع متوازن' };
  }
  if (p.includes('"scoreFor"')) {
    return { scoreFor: 3, scoreAgainst: 1, goals: 3, opponent: 'Real Madrid', visibleStats: ['استحواذ 58%'], confidence: 0.9, notes: '' };
  }
  return { ok: true };
}

export { doc as _doc };
