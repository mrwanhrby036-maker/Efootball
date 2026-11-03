# قاعدة البيانات: Firebase Realtime Database

المنصة كلها بقت تقرأ وتكتب على **Realtime Database** فقط. مفيش Firestore خلاص
(الملف `firestore.rules` اتشال، ومكتبة `firebase-firestore` مش بتتحمل أصلًا).

## 1) خطوات لازمة مرة واحدة في Firebase Console

1. **Realtime Database ← Create Database** (اختار أقرب منطقة، مثلًا `europe-west1`).
2. من تبويب **Data** هات الـ URL وحدّثه في `firebaseConfig` جوه `app.js`:
   ```js
   databaseURL: "https://hamo-8132e-default-rtdb.firebaseio.com"
   ```
   لو القاعدة في منطقة تانية الشكل بيكون:
   `https://hamo-8132e-default-rtdb.europe-west1.firebasedatabase.app`
3. **Rules ← الصق محتوى `database.rules.json` ← Publish.**
4. عشان تظهر الباقات والخدمات والإعدادات: **Data ← ⋮ ← Import JSON** واستورد
   `database-seed.json`.
   ⚠️ الاستيراد بيستبدل محتوى القاعدة بالكامل — اعمله مرة واحدة في البداية فقط.
5. **Authentication ← Sign-in method**: فعّل `Phone` و/أو `Google`، وضيف دومين
   الموقع في **Authorized domains**.

## 2) شكل البيانات

| المسار | الوصول |
|---|---|
| `/settings/public` | قراءة عامة، كتابة من الكونسول فقط |
| `/plans/{id}` , `/products/{id}` | قراءة عامة، كتابة من الكونسول فقط |
| `/users/{uid}` | صاحب الحساب فقط (وممنوع يغيّر `plan` أو `status` بنفسه) |
| `/userSettings/{uid}` | صاحب الحساب فقط |
| `/teams/{id}` , `/matches/{id}` , `/reports/{id}` , `/notifications/{id}` , `/orders/{id}` | صاحب البيانات فقط (`userId`) |

الاستعلامات كلها `orderByChild('userId').equalTo(uid)`، والفهارس معرّفة في
`database.rules.json` تحت `.indexOn`.

## 3) الطلبات والاشتراكات (بعد إزالة لوحة الأدمن)

- المستخدم ينشئ الطلب بحالة `pending_review` فقط، وممنوع يعدّله أو يفعّله بنفسه.
- التفعيل بيتم من **Firebase Console ← Realtime Database ← orders/{id}**:
  غيّر `status` إلى `completed`، وبعدها في `users/{uid}` غيّر `plan` إلى `pro`
  وحدّد `plan_expires_at` (مثال: `2026-12-03 00:00:00`).
- لو حبيت ترجّع شاشة إدارة بسيطة للموافقة على الطلبات، قول وأعملها.

## 4) لو عندك بيانات قديمة على Firestore

Realtime Database قاعدة منفصلة تمامًا، فالبيانات القديمة مش هتظهر تلقائيًا.
محتاج سكربت ترحيل مرة واحدة (قراءة من Firestore وكتابة على RTDB). أقدر أعملك
صفحة `migrate.html` مؤقتة تعمل ده بضغطة زر لو محتاج تنقل مستخدمين/طلبات موجودة.

## 5) الفحص

`/tmp/jstest` فيه 59 اختبار آلي (jsdom) بيغطوا: تسجيل الدخول بـ OTP، بقاء الجلسة
بعد التحديث، كل الصفحات، أخطاء قاعدة البيانات، وطبقة بيانات RTDB (إنشاء حساب،
حفظ/قراءة تشكيلة، مباراة، طلب اشتراك، إشعارات، حذف).
