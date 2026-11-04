# إعداد Firebase لـ PES AI PRO — ٥ دقايق

المنصة **كاملة وجاهزة**. اللي ناقص بس هو ربطها بمشروع Firebase بتاعك
(تسجيل دخول + قاعدة بيانات + ذكاء اصطناعي). مفيش سيرفر ولا مفتاح سري في الكود.

---

## ١) أنشئ مشروع Firebase

1. افتح <https://console.firebase.google.com>
2. **Add project** → اسم المشروع: `pes-ai-pro` → كمّل الخطوات.
3. من صفحة المشروع: اضغط أيقونة الويب **`</>`** → سمّي التطبيق `PES AI PRO` → **Register app**.
4. هتلاقي كود فيه `firebaseConfig`. **انسخه** (هنستخدمه في الخطوة ٤).

---

## ٢) فعّل الخدمات (Authentication)

من القائمة الجانبية → **Build → Authentication → Get started**، وبعدين تبويب **Sign-in method** وفعّل:

| الطريقة | الوضع |
|---|---|
| **Email/Password** | ✅ لازم (ده الأساسي) |
| **Google** | ✅ اختياري بس مطلوب لو عايز زر جوجل |
| **Phone** | ✅ لو عايز الدخول برقم + كود (محتاج تفعيل الفاتورة Blaze) |

**مهم:** بعدين من تبويب **Settings → Authorized domains** ضيف دومين موقعك
(مثلاً `your-site.vercel.app` و`username.github.io`). الدومين `localhost` موجود افتراضيًا.

---

## ٣) أنشئ قاعدة البيانات (Firestore) وانشر القواعد

1. **Build → Firestore Database → Create database**
2. اختار **Production mode** (مش test mode — إحنا عندنا قواعد جاهزة).
3. اختار أقرب Region (زي `europe-west1`).
4. انشر القواعد الموجودة في المشروع (الملف `firestore.rules`):

```bash
npm i -g firebase-tools
firebase login
firebase use --add        # اختار مشروعك
firebase deploy --only firestore:rules,firestore:indexes
```

> لو مش عايز تستخدم الـ CLI: افتح **Firestore → Rules** وانسخ محتوى `firestore.rules` والزقه واضغط **Publish**.

---

## ٤) حط الإعدادات في ملفين

افتح **`app.js`** وابحث عن `FIREBASE_CONFIG` في أول الملف، وبدّل القيم بقيم مشروعك:

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza....",
  authDomain: "pes-ai-pro.firebaseapp.com",
  projectId: "pes-ai-pro",
  storageBucket: "pes-ai-pro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

**اعمل نفس الحاجة في `admin.html`** (نفس القيم بالظبط — الكود جوّه الملف في آخر الصفحة، دوّر على `FIREBASE_CONFIG`).

> الـ `apiKey` هنا **مش سر** — ده معرّف عام مخصص للمتصفح، والحماية الحقيقية في
> `firestore.rules` + Authorized domains. مفاتيح الإدارة الحقيقية مالهاش وجود في الكود.

---

## ٥) فعّل الذكاء الاصطناعي (Gemini)

1. من Firebase Console → **Build → AI Logic** (أو **Firebase AI Logic**) → **Get started**.
2. اختار **Gemini Developer API** → agree على الشروط.
3. كده خلاص — المنصة بتستخدم `getAI()` من SDK وبتاخد مفتاحها من مشروع Firebase نفسه
   (مفيش مفتاح Gemini مكتوب في الكود).

> الموديل الافتراضي: `gemini-2.5-flash`. تقدر تغيّره من لوحة الأدمن → الإعدادات.

---

## ٦) اعمل حساب الأدمن (خطوة يدوية مرة واحدة)

الأدمن **مش** بيتسجل من الموقع — لازم تعمل حساب وتديله صلاحية `admin` من Firestore:

1. من الموقع نفسه (`index.html`) اعمل **حساب جديد** بالبريد اللي عايزه يكون أدمن
   والباسورد بتاعه (مثلاً `admin@yourdomain.com`).
2. افتح **Firestore Database** → مجموعة `users` → افتح المستند اللي `email` بتاعه هو بريدك.
3. عدّل الحقلين:
   - `role` → `admin`
   - `status` → `active`
4. احفظ، وروح لـ `admin.html` — سجّل دخول بنفس البريد والباسورد. هتدخل اللوحة.

> من اللوحة تقدر بعد كده تدير كل حاجة: المستخدمين، الباقات، الأسعار، المتجر،
> الطلبات، اللاعبين، الإشعارات، حدود الـ AI، وإعدادات التواصل.

---

## ٧) اضبط إعدادات المنصة من لوحة الأدمن

بعد الدخول لـ `admin.html` → **الإعدادات**:

- **رقم واتساب** بالصيغة الدولية بدون `+` (مثال: `201012345678`)
- **رابط تليجرام** (مثال: `https://t.me/yourusername`)

> لحد ما تحطهم، الأيقونتين **مخفيين** — مش أزرار وهمية.

ومن **الاشتراكات** تحدد سعر ومدة PRO، ومن **المتجر** تضيف الخدمات.

---

## ٨) النشر على Vercel

المشروع ثابت (static) — مفيش سيرفر:

1. ارفع الريبو على GitHub.
2. Vercel → **Add New Project** → اختار الريبو → **Framework Preset: Other** → **Deploy**.
3. خلاص. `index.html` هي الصفحة الرئيسية و `admin.html` لوحة التحكم.
   (المشروع static — مفيش build command، و`vercel.json` فيه الـ headers والكاش جاهزين.)

> متنساش تضيف دومين Vercel في **Firebase → Authentication → Settings → Authorized domains**
> وإلا تسجيل الدخول بجوجل/الإيميل هيترفض (مثال: `your-project.vercel.app`).

> لو احتجت تعيد بناء حزمة Firebase بعد تحديث المكتبة: `npm run bundle:firebase`.

---

## ٩) إعدادات لازم تعرفها

| الحاجة | الوضع |
|---|---|
| **حدود الـ AI اليومية** | من الأدمن → الاشتراكات. مجاني: ٣ تحليلات + ٣ رسائل |
| **الدفع** | يدوي، الأدمن هو اللي يفعّل الاشتراك بعد التأكيد. مفيش بوابة دفع آلية |
| **الصور** | بتتحول على جهاز المستخدم لـ JPEG 1280px وبعدها تتحلل — مش بتتخزن |
| **الصوت** | Web Speech API في المتصفح (مجاني) — بيشتغل على Chrome/Edge |
| **حذف الحساب** | بيحذف البيانات كلها؛ حذف حساب Firebase نفسه بيطلب تسجيل دخول حديث |

---

## مشاكل شائعة

| الخطأ | الحل |
|---|---|
| `permission-denied` | القواعد مش منشورة → نشرها من الخطوة ٣ |
| `auth/unauthorized-domain` | ضيف الدومين في Authorized domains |
| `auth/operation-not-allowed` | فعّل Email/Password + Google في Sign-in method |
| تحليل الصور بيرجع خطأ | فعّل **AI Logic** (خطوة ٥) وتأكد إن الموديل `gemini-2.5-flash` |
| `auth/quota-exceeded` على الدخول بالرقم | حد SMS المجاني خلص — استخدم الإيميل أو فعّل Blaze |

---

## الملفات

| ملف | وظيفته |
|---|---|
| `index.html` | واجهة المنصة (٢٠+ شاشة) |
| `styles.css` | الهوية السوداء الذهبية + كل الحركات |
| `app.js` | منطق المنصة (Firebase + Gemini) |
| `admin.html` | **لوحة الأدمن كاملة في ملف واحد** (HTML + CSS + JS مدمجين) |
| `vendor/firebase.js` | حزمة Firebase محلية (مش CDN) |
| `firestore.rules` | أمان البيانات — القواعد الحقيقية |
| `tests/` | اختبارات E2E (٥٢ فحص) — مش بتتنشر |
