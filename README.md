# Motion ERP

منصة تخطيط موارد مؤسسية (ERP) عامة، متعددة الشركات، قابلة للتكوين والتوسع.

> **الحالة الحالية:** المرحلة ب-1 — تأسيس المشروع فقط. لا توجد أي وحدة أعمال بعد
> (لا شركات، لا مستخدمين، لا صلاحيات، لا لغات كوحدة، لا عملات كوحدة، لا مخزون، لا محاسبة...).

المرجع المعماري الإلزامي: [`docs/00-Motion-ERP-Architecture-Decisions.md`](docs/00-Motion-ERP-Architecture-Decisions.md)

---

## المتطلبات

| الأداة                  | الإصدار                                             |
| ----------------------- | --------------------------------------------------- |
| Node.js                 | 22 أو أحدث (المشروع مُختبَر على 24 — انظر `.nvmrc`) |
| pnpm                    | 11 أو أحدث (`corepack enable` يكفي)                 |
| Docker + Docker Compose | لتشغيل PostgreSQL محليًا (اختياري في هذه المرحلة)   |

---

## بنية المشروع

```
motion-erp/
├── apps/
│   ├── api/          الخلفية — NestJS (وحدة core فقط: إعدادات + قاعدة بيانات + health)
│   └── web/          الواجهة — React + Vite (PWA)، بنية i18n واتجاه RTL/LTR
├── packages/
│   └── shared/       كود مشترك بين الواجهة والخلفية (حاليًا: تعريف Money)
├── docs/             الوثائق والقرارات المعمارية
├── docker-compose.yml   PostgreSQL للتطوير
└── eslint / prettier / tsconfig  إعدادات موحّدة للجذر
```

كل جزء مستقل (workspace). التواصل بين وحدات الأعمال مستقبلًا سيكون عبر عقود وأحداث،
وليس باستيراد مباشر بين الوحدات (قرار D2 / D20).

---

## التشغيل من جهاز جديد (خطوة بخطوة)

```bash
# 1) فعّل pnpm (لو مش مثبّت)
#    corepack enable        (قد يحتاج صلاحية مدير على ويندوز)
#    أو:  npm install -g pnpm
pnpm --version               # المفروض 11 أو أحدث

# 2) ثبّت الاعتماديات (يبني حزمة shared تلقائيًا بعد التثبيت)
pnpm install

# 3) جهّز ملفات البيئة
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# ثم عدّل كلمة مرور قاعدة البيانات في .env و apps/api/.env

# 4) (اختياري) شغّل قاعدة البيانات
pnpm run db:up

# 5) شغّل الخلفية والواجهة (كل واحدة في نافذة)
pnpm run dev:api      # http://localhost:3000/api/v1
pnpm run dev:web      # http://localhost:5173
```

> على Windows استخدم `copy` بدل `cp`.

### التحقق السريع أن كل شيء يعمل

| ماذا                 | كيف                                                           | المتوقع                                         |
| -------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| الخلفية حيّة         | افتح `http://localhost:3000/api/v1/health`                    | `{"status":"ok", "platform":"Motion ERP", ...}` |
| اتصال قاعدة البيانات | شغّل `db:up` ثم افتح `http://localhost:3000/api/v1/health/db` | `{"database":{"status":"up"}}`                  |
| الواجهة              | افتح `http://localhost:5173`                                  | شاشة ترحيب، وتبديل اللغة يقلب اتجاه الصفحة      |

---

## أوامر مفيدة

| الأمر                                       | الوظيفة                                                 |
| ------------------------------------------- | ------------------------------------------------------- |
| `pnpm run dev`                              | تشغيل الخلفية والواجهة معًا                             |
| `pnpm run dev:api` / `pnpm run dev:web`     | تشغيل جزء واحد                                          |
| `pnpm run build`                            | بناء كل الأجزاء                                         |
| `pnpm run lint`                             | فحص الكود (ESLint)                                      |
| `pnpm run format` / `pnpm run format:check` | تنسيق الكود (Prettier)                                  |
| `pnpm run typecheck`                        | فحص الأنواع (TypeScript) في كل الأجزاء                  |
| `pnpm run test`                             | اختبارات الوحدة (Jest للخلفية، Vitest للواجهة والمشترك) |
| `pnpm run test:e2e`                         | اختبار تشغيل الخلفية من طرف لطرف                        |
| `pnpm run verify`                           | يشغّل: format:check ثم lint ثم typecheck ثم test        |
| `pnpm run db:up` / `pnpm run db:down`       | تشغيل / إيقاف PostgreSQL                                |

`pnpm run verify` هو نفس ما يشغّله CI عند كل تغيير (`.github/workflows/ci.yml`).

---

## إعدادات البيئة

- الأسرار وكلمات المرور **لا تُكتب في الكود إطلاقًا**. تُقرأ من ملفات `.env` غير المتتبَّعة في Git.
- الملفات المتتبَّعة هي `*.env.example` فقط.
- الخلفية تتحقق من صحة كل متغيرات البيئة عند الإقلاع وتتوقف فورًا برسالة واضحة لو نقص شيء
  (`apps/api/src/core/config/env.validation.ts`).

---

## ما هو مؤجَّل عمدًا لهذه المرحلة

- اختيار أداة الوصول لقاعدة البيانات والهجرات (Kysely / Drizzle / TypeORM / Prisma) — قرار المرحلة ب-2.
- أي جدول قاعدة بيانات لوحدة أعمال.
- أدوات فرض حدود الوحدات في CI (تُضاف مع أول وحدتين).
- أيقونات PWA النقطية (يوجد حاليًا favicon متجهي فقط).
