# Table — متتبع العادات

[![GitHub stars](https://img.shields.io/github/stars/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/issues)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/korgmen/table-habit-tracker/blob/main/LICENSE.txt)

[Русский](./README.md) | [English](./README.en.md) | [Español](./README.es.md) | [中文](./README.zh.md)

**Table** هو متتبع عادات متعدد الوظائف يساعدك على متابعة إنجاز المهام اليومية، بناء عادات مستدامة وتحليل التقدم. يعمل التطبيق في المتصفح وكذلك كتطبيق PWA (تطبيق ويب تقدمي)، ويدعم وضع عدم الاتصال، والمزامنة مع Google، وطباعة الجداول للملء اليدوي.

التقنيات الحديثة: Vue 3، Vite، Pinia، TailwindCSS، vue-i18n، vue-draggable-next، Lucide icons، ESLint، Prettier، Firebase (للمصادقة والمزامنة)، Vite PWA.

يتم تخزين بيانات التطبيق محليًا في المتصفح (localStorage) مع أرشفة شهرية. الحد الأقصى 20 مهمة و8 مهام فرعية لكل مهمة لضمان الأداء الأمثل.

![لقطة شاشة التطبيق](https://lebedevcode.ru/table-screenshot-ar.png)

---

## دعم اللغات
- تم ترجمة كامل الواجهة (انظر `src/locales/`).
- اللغات المدعومة: الروسية، الإنجليزية، العربية، الإسبانية، الصينية.
- يمكن تغيير اللغة من الإعدادات أو استخدام لغة النظام.

## الميزات
- **المهام والمهام الفرعية**: إضافة، تعديل، حذف المهام والمهام الفرعية (حتى 8 مهام فرعية لكل مهمة). السحب والإفلات لإعادة ترتيب المهام (vue-draggable-next).
- **علامات الإنجاز اليومية**: علامات يومية: منجز (دائرة ممتلئة)، غير منجز (فارغة)، تخطي (علامة × — اليوم لا يُحتسب في الإحصائيات). دعم النقر المزدوج على الجوال للتبديل السريع (نقرة واحدة — منجز/مسح، نقرتان — تخطي). على الكمبيوتر: زر الفأرة الأيسر — منجز/مسح، زر الفأرة الأيمن — تخطي.
- **أنماط العمل**:
  - وضع المسح السريع لإزالة العلامات.
  - وضع حذف المهام.
- **التنقل بين الأشهر**: تبديل الأشهر، عرض أرشيف الأشهر السابقة (يتم حفظ البيانات شهريًا في localStorage). إنشاء الأرشيف تلقائيًا عند تغيير الشهر.
- **الإحصائيات**: حساب نسبة الإنجاز لكل مهمة، النسبة العامة، تقييم بنظام 5 درجات. وضعان للحساب: كامل الشهر أو الأيام المنقضية فقط.
- **تصدير/استيراد البيانات**: تصدير إلى JSON، استيراد من ملف. توافق كامل مع الأرشيف.
- **تغيير السمة**: فاتح، داكن أو نظامي (تلقائي حسب إعدادات النظام).
- **تغيير اللغة**: الروسية، الإنجليزية، العربية، الإسبانية، الصينية أو النظامية.
- **إعدادات العرض**: فواصل الأسابيع (خطوط عمودية)، اختيار بداية الأسبوع (الاثنين/الأحد).
- **اختصارات لوحة المفاتيح**: تحكم سريع (Escape — إعادة تعيين، E — مسح، D — حذف، N — مهمة جديدة، الأسهم — تغيير الشهر، S — الإعدادات).
- **الطباعة**: دعم طباعة الجدول بشكل نظيف (بدون أزرار أو واجهة) للملء اليدوي على الورق.
- **دعم PWA**: التثبيت كتطبيق جوال، العمل دون اتصال، التحديث التلقائي مع إشعار.
- **المزامنة**: تسجيل الدخول عبر Google لمزامنة البيانات في السحابة (Firebase). التحميل/الحفظ التلقائي عند تسجيل الدخول.
- **النوافذ المنبثقة**: شرح ترحيبي عند أول تشغيل، تأكيدات لتكرار المهام، إشعار بتحديث PWA.
- **تكرار المهام**: نسخ المهام من الشهر السابق إلى الحالي.
- **تصميم متجاوب**: استجابة كاملة للهواتف والأجهزة اللوحية.
- **القيود والتحسينات**: حد أقصى 20 مهمة للأداء؛ حفظ تلقائي للإعدادات والبيانات بين الجلسات.

## هيكل المشروع
- `src/App.vue` — المكون الرئيسي للتطبيق (الجدول، العنوان، النوافذ المنبثقة).
- `src/main.js` — تهيئة Vue، Pinia، i18n، Firebase.
- `src/stores/habitStore.js` — Pinia store: إدارة المهام، التقدم، السمة، اللغة، الأرشيف، التصدير/الاستيراد، إعدادات الأسابيع، المصادقة والمزامنة.
- `src/locales/` — ملفات الترجمة (JSON لكل لغة).
- `src/components/` — المكونات: Header، TableHeader، TaskRow، Modal، SettingsModal، Controls، OverallStats وغيرها.
- `src/composables/` — هوكس: useHabitUtils (أدوات للأسابيع/السمات)، useModals (النوافذ المنبثقة).
- `src/style.css` — أنماط عامة، TailwindCSS وخطوط مخصصة.
- `src/firebase.js` — إعداد Firebase للمصادقة وFirestore.
- الإعدادات: `vite.config.js` (Vite، PWA، Tailwind)، `eslint.config.js` (ESLint)، `.prettierrc` (Prettier)، `package.json` (التبعيات والسكربتات).

## البدء السريع
1. استنساخ المستودع:
   ```sh
   git clone https://github.com/korgmen/table-habit-tracker.git
   cd table-habit-tracker
   ```
2. تثبيت التبعيات:
   ```sh
   pnpm install
   ```
3. تشغيل وضع التطوير:
   ```sh
   pnpm run dev
   ```
4. بناء للإنتاج:
   ```sh
   pnpm run build
   ```
5. فحص الكود:
   ```sh
   pnpm run lint        # فحص ESLint
   pnpm run format      # تنسيق Prettier
   ```
6. معاينة البناء:
   ```sh
   pnpm run preview
   ```

لـ PWA: بعد البناء، افتح في المتصفح وقم بتثبيته كتطبيق. وضع عدم الاتصال يعمل بفضل Service Worker.

## التبعيات الرئيسية
- [Vue 3](https://vuejs.org/) — إطار العمل.
- [Vite](https://vitejs.dev/) — أداة البناء.
- [Pinia](https://pinia.vuejs.org/) — إدارة الحالة.
- [TailwindCSS](https://tailwindcss.com/) — الأنماط.
- [vue-i18n](https://vue-i18n.intlify.dev/) — الترجمة.
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — السحب والإفلات.
- [lucide-vue-next](https://lucide.dev/) — الأيقونات.
- [Firebase](https://firebase.google.com/) — المصادقة والتخزين السحابي.
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — ميزات PWA.
- التطوير: ESLint، Prettier، eslint-plugin-vue، eslint-plugin-tailwindcss.

القائمة الكاملة في `package.json`.

## الهندسة والمنطق
- **تخزين البيانات**: localStorage للمهام والعلامات والأرشيف (المفتاح: `habitArchive`). أرشيف شهري بصيغة `{ "YYYY-MM": { tasks: [...] } }`. يتم حفظ الإعدادات بشكل منفصل (السمة، اللغة، الأسبوع).
- **Pinia store** (`habitStore.js`): إدارة مركزية للمهام، المهام الفرعية، العلامات، الإحصائيات، السمة، اللغة، التصدير/الاستيراد، الأسابيع، النوافذ المنبثقة، المصادقة والمزامنة مع Firestore.
- **الترجمة**: vue-i18n مع ملفات JSON في `src/locales/`. تحديد اللغة تلقائيًا من النظام.
- **السمات**: نظامية، فاتحة/داكنة. تطبق على العنصر الجذري.
- **PWA**: ملف manifest في `vite.config.js` (الأيقونات، theme_color). التحديث التلقائي مع نافذة منبثقة.
- **المزامنة**: Firebase Auth (Google) وFirestore. يتم حفظ البيانات في `/users/{uid}`. التحميل التلقائي عند تسجيل الدخول.
- **النوافذ المنبثقة**: مكون عام للتأكيدات، التنبيهات، المحتوى المخصص (الترحيب، التحديث).
- **التحسينات**: تحميل كسول، تصميم متجاوب، دعم اللمس، إمكانية الوصول (ARIA، focus trap).

## اختصارات لوحة المفاتيح
- Escape — إعادة تعيين الأنماط، إغلاق القائمة/الإعدادات.
- E — تبديل وضع المسح.
- D — تبديل وضع الحذف.
- N — إضافة مهمة جديدة.
- السهم الأيسر/الأيمن — تبديل الشهر.
- S — فتح/إغلاق الإعدادات.

## المساهمة
المساهمة مرحب بها!
- قم بعمل fork للمستودع وأنشئ فرعًا للميزة/الإصلاح.
- التزم بأسلوب الكود (Prettier، ESLint).
- استخدم المكونات وstore الموجودة.
- للغات جديدة — أضف الترجمات في `src/locales/` (JSON).
- قبل طلب الدمج: `pnpm run lint && pnpm run format`.
- وصف التغييرات في PR، أضف اختبارات إذا لزم الأمر.

أسئلة؟ افتح issue.

## الرخصة
Apache-2.0 – [LICENSE.txt](./LICENSE.txt) | [NOTICE.txt](./NOTICE.txt)