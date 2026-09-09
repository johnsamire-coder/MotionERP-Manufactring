# Motion ERP — سجل التنفيذ

سجل مختصر لكل مرحلة تنفيذ. هذا **ليس** مكان القرارات المعمارية
(مكانها [`00-Motion-ERP-Architecture-Decisions.md`](00-Motion-ERP-Architecture-Decisions.md)).

---

## المرحلة ب-1 — تأسيس المشروع (2026-08-29)

### ما تم إنشاؤه

- **مستودع أحادي (pnpm workspace)** بثلاثة أجزاء:
  - `apps/api` — تطبيق NestJS، وحدة `core` فقط: تحقق إعدادات البيئة (zod)،
    اتصال PostgreSQL كسول (`pg`) يُستخدم فقط في فحص الصحة، ونقاط `GET /api/v1/health`
    و `GET /api/v1/health/db`. تفعيل إصدارات URI و ValidationPipe و CORS و shutdown hooks.
  - `apps/web` — React + Vite + PWA. هيكل i18n (`i18next` + `react-i18next`) بلغتين
    (en/ar) بدون أي نص مكتوب في المكوّنات، ومزامنة `<html dir/lang>` مع اللغة،
    ورموز تصميم (CSS variables) وخصائص CSS منطقية (start/end) بدل يمين/يسار.
  - `packages/shared` — قيمة `Money` = (سلسلة عشرية + كود عملة)، مع حراس تمنع
    `float` وخلط العملات. يُبنى إلى `dist` ويُستهلك من `api`.
- **أدوات موحّدة:** ESLint (flat) + Prettier + tsconfig أساس صارم
  (`strict`, `noUncheckedIndexedAccess`, `no-explicit-any: error`).
- **اختبارات:** Jest (خلفية: وحدة + e2e)، Vitest (واجهة + shared).
- **CI:** `.github/workflows/ci.yml` يشغّل format:check + lint + typecheck + test + e2e
  مع خدمة PostgreSQL.
- **تشغيل محلي:** `docker-compose.yml` لـ PostgreSQL، وملفات `*.env.example`،
  و `README.md` بتعليمات جهاز جديد.

### ما لم يُنشأ (خارج نطاق ب-1)

- أي جدول قاعدة بيانات لوحدة أعمال.
- أي وحدة أعمال (شركات، مستخدمين، صلاحيات، لغات، عملات، مخزون، محاسبة، ...).
- اختيار ORM / أداة هجرات (مؤجَّل إلى ب-2).

### تفاصيل تنفيذ ظهرت أثناء العمل

- أُضيفت `class-validator` + `class-transformer` (اعتماديات NestJS القياسية لـ `ValidationPipe`).
- `apps/api/tsconfig.build.json` يحدد `rootDir: src` حتى يخرج البناء إلى `dist/main.js`.
- أوامر الجذر (`test`, `typecheck`, `dev`, `build`) تبني حزمة `shared` أولًا عبر
  `pnpm run shared:build` لأن `pnpm install` لا يعيد البناء إن لم تتغير الاعتماديات.
- `pnpm-workspace.yaml`: `onlyBuiltDependencies: [esbuild]` و
  `ignoredBuiltDependencies: [@nestjs/core]`.
- تمت تهيئة مستودع Git (`git init`) بدون أي commit — ليصبح `.gitignore` وملف CI ذوَي معنى.
  أول commit متروك للمالك.

### قرارات معمارية جديدة اتُّخذت

لا شيء. كل الاختيارات (pnpm، zod للتحقق، `pg` مؤقتًا لفحص الاتصال، Vite، i18next)
هي تنفيذ مباشر للقرارات المعتمدة أو تفاصيل تنفيذ لا ترقى لقرار معماري.
اختيار طبقة قاعدة البيانات (ORM / أداة هجرات) طُرح صراحةً على المالك ليُحسم في ب-2.

---

## المرحلة ب-2-1 — تأسيس طبقة قاعدة البيانات والهجرات (2026-08-29)

**قرار المالك المعتمد:** PostgreSQL + **Drizzle** + `pg`.

### ما تم إنشاؤه

- **اعتماديات:** `drizzle-orm` (dependency)، `drizzle-kit` + `tsx` + `dotenv` (devDependencies) في `apps/api`.
- **`apps/api/drizzle.config.ts`** — إعداد drizzle-kit (لهجة postgresql، مصدر السكيما = برميل واحد،
  مخرج الهجرات = `drizzle/migrations`). لا يقرأ كلمة مرور من الكود — من `DATABASE_URL` فقط.
- **`apps/api/src/core/database/schema/index.ts`** — برميل تجميع تعريفات الجداول (فارغ، `export {}`).
  الوحدات لاحقًا تُسجّل جداولها هنا. نقطة تسجيل واحدة = حدود واضحة.
- **`apps/api/src/core/database/migrator.ts`** — محرك الهجرات: `runMigrations` (تطبيق، idempotent)،
  `getMigrationStatus` + `mergeMigrationStatus` (نقية، قابلة لاختبار الوحدة)، `readJournal`.
  يلتفّ حول `drizzle-orm/node-postgres/migrator`. لا يستدعيه التطبيق أبدًا.
- **`migrate.ts` / `migration-status.ts`** — أمرا CLI. لا يطبعان بيانات اتصال حساسة.
- **`apps/api/drizzle/migrations/`** — مجلد الهجرات المتتبَّع في Git: `meta/_journal.json` (يبدأ فارغًا)
  - `README.md` بقواعد الهجرات.
- **`DatabaseService`** (تعديل) — أضيفت واجهة Drizzle `db` جنب `pool`. هي **الباب الوحيد**
  لقاعدة البيانات؛ الوحدات تعتمد عليها (أو على repository فوقها لاحقًا)، لا pool خاص عشوائي.
- **أوامر (جذر + api):** `db:generate` (توليد هجرة)، `db:migrate` (تطبيق)، `db:status` (حالة)،
  `db:check` (فحص سلامة السجل). بجانب `db:up/down/logs` الموجودة.
- **اختبارات:**
  - `migrator.spec.ts` — وحدة (بدون قاعدة بيانات): ترتيب/تعليم حالة الهجرات + قراءة السجل.
  - `database.integration.spec.ts` — تكامل: اتصال `pg` + تطبيق هجرة تجريبية في سكيما معزولة +
    التحقق من التسجيل + عدم التكرار + تنظيف كامل. **يتخطّى نفسه بهدوء** لو لا توجد قاعدة بيانات،
    ويعمل في CI (الذي يوفّر PostgreSQL).

### ما لم يُنشأ (خارج نطاق ب-2-1)

- أي جدول أعمال أو بنية تحتية (companies, users, roles, permissions, branches, warehouses,
  products, customers, suppliers, employees، محاسبة، مخزون، تصنيع، outbox، audit...).
- أي هجرة حقيقية — سجل الهجرات فارغ. أول هجرة في ب-2-2.
- تشغيل الهجرات عند إقلاع التطبيق (ممنوع صراحةً).
- ربط طبقة قاعدة البيانات بأي وحدة أعمال.

### تفاصيل تنفيذ

- `drizzle-kit` يُصرِّف `drizzle.config.ts` إلى `drizzle.config.js` بجانبه وقت التشغيل →
  أُضيف لـ `.gitignore` و `.prettierignore`.
- `apps/api/tsconfig.build.json`: `include: ["src/**/*"]` صراحةً + استثناء `drizzle.config.ts`
  حتى لا يحاول `nest build` تصريفه.
- أوامر `db:*` تعمل بـ `tsx` (تنفيذ TypeScript مباشر)، و `nest build` يُنتج نسخة JS منها في `dist`
  كبديل للإنتاج.

### قرارات معمارية جديدة اتُّخذت

لا شيء. Drizzle قرار المالك. `tsx`/`dotenv` أدوات تنفيذ لا ترقى لقرار معماري.

### تعارضات معمارية

لا شيء. الاختيارات تتوافق مع D7 (سكيما لكل وحدة، هجرات مرقّمة، لا auto-sync)،
D21 (هجرات قابلة للتطبيق بالتسلسل والمراجعة)، D2/D20 (باب واحد لقاعدة البيانات).

### ما لم يُختبر بسبب البيئة

- وقت ب-2-1 تعذّر اختبار التكامل محليًا (Docker معطّل). **حُلَّ لاحقًا في ب-2-2** بإضافة
  `pnpm run test:db` (embedded-postgres) — واختبار تكامل ب-2-1 الآن يمرّ فعليًا على PostgreSQL.

---

## المرحلة ب-2-2 — النواة التنظيمية: أول جدول حقيقي (2026-08-29)

### الجداول (سكيمة `platform`)

**`platform.org_node_type`** — قاموس أنواع العُقد (config لا code، D10). أعمدة: `code` (PK نصي)،
`label` (اسم إنجليزي احتياطي)، `created_at`. مزروع بـ 13 نوعًا:
group, legal_company, activity, branch, region, site, factory, department, section,
operating_unit, warehouse, work_center, project. إضافة نوع مستقبلًا = صف، لا DDL.

**`platform.org_node`** — الشجرة التنظيمية العامة (D10). أعمدة (= قائمة البند خامس بالحرف):
`id` uuid PK (افتراضي `gen_random_uuid()` + العميل يقدر يولّده — D14)، `node_type` FK →
`org_node_type.code`، `name` (احتياطي؛ الترجمات جدول جانبي لاحقًا — D16)، `parent_id` uuid FK
self، `status` (`active`/`inactive`/`archived`، افتراضي active)، `position` int، `created_at`،
`updated_at`، `created_by`/`updated_by` uuid (بدون FK — لا يوجد جدول مستخدمين).

### القيود

- 2 مفاتيح أجنبية: `node_type` (ON DELETE RESTRICT, ON UPDATE CASCADE)،
  `parent_id` self (ON DELETE RESTRICT — ممنوع حذف أب له أبناء؛ الإزالة = `status='archived'`, D25).
- 3 CHECK: `parent_id <> id` (لا عقدة أبًا لنفسها)، `status` ضمن القيم، `name` غير فارغ بعد trim.
- 2 trigger (plpgsql): `set_updated_at` (تحديث `updated_at` عند أي UPDATE — D22)،
  `org_node_prevent_cycle` (BEFORE INSERT/UPDATE OF parent_id — يمشي لأعلى الشجرة عبر CTE عودي
  ويرفض أي دورة، SQLSTATE 23514).

### الفهارس (كل واحد له مبرر)

- `org_node_parent_position_idx` على `(parent_id, position)` — بناء الشجرة (أبناء عقدة مرتّبين)
  - جذور (`parent_id IS NULL`) + فحص FK.
- `org_node_node_type_idx` على `(node_type)` — FK النوع + "كل عُقد نوع معيّن" (مثلًا كل الشركات القانونية).

### الشجرة

تخزين adjacency list (`parent_id`). البناء في الذاكرة: `buildForest()` دالة نقية —
خريطة id→عقدة، ربط كل عقدة بأبيها، الجذور = بلا أب/أب مفقود (لا إخفاء بيانات)، ترتيب الإخوة
بـ (position, name, id)، لا تعلّق مع بيانات دائرية. مناسب لحجم الشجرة التنظيمية (مئات، لا ملايين).
لو احتجنا استعلامات أسلاف كثيفة الأداء لاحقًا → جدول closure أو `ltree` بهجرة إضافية (D10 يذكرها كخيار).

### الهجرة

`drizzle/migrations/0000_organization_core.sql` — مولّدة بـ `drizzle-kit generate --name
organization_core`، ثم أُلحق بها يدويًا (طريقة Drizzle الرسمية): الزرع + الـ triggers.
مرقّمة، مرتّبة بـ `--> statement-breakpoint`، تُطبَّق مرة واحدة (متتبَّعة في
`drizzle.__drizzle_migrations`)، قابلة للمراجعة. تعديل يدوي واحد على SQL المولّد: تبسيط تعبيرات
CHECK من أسماء مؤهّلة بالسكيمة إلى أسماء أعمدة مجرّدة (أضمن في Postgres) — لا يؤثر على snapshot Drizzle.

### واجهة البرمجة

`GET /api/v1/organization/tree` → `{ "tree": OrgTreeNode[] }` (شجرة متداخلة، فارغة `{ "tree": [] }`
لو لا عُقد). للقراءة فقط. الطبقات: `organization.schema` → `organization.repository` (الوحيد الذي
يلمس الجدول) → `organization.service` (يستدعي `buildForest`) → `organization.controller`.
`OrganizationModule` تحت `src/modules/` (أول وحدة أعمال؛ تؤسس نمط `src/modules/*`).

### الاختبارات

- **وحدة** `organization.tree.spec.ts` (7): فارغ، جذر مفرد، ابن، متعدد المستويات، ترتيب الإخوة،
  جذور متعددة، عقدة بأب مفقود تُعامَل كجذر.
- **تكامل** `organization.repository.integration.spec.ts` (12): تطبيق الهجرة +
  13 نوعًا، جذر، ابن، 3 مستويات، رفض أب غير موجود، رفض نوع غير موجود، رفض عقدة أبًا لنفسها،
  منع دورة بتحديث لاحق، رفض حذف أب له أبناء، افتراض الحالة + رفض حالة غير صحيحة، اسم غير فارغ،
  trigger `updated_at`.
- **e2e** `test/organization.e2e-spec.ts` (2): شجرة فارغة `{tree:[]}`، شجرة متداخلة من القاعدة عبر
  المسار الكامل HTTP → controller → service → repository → DB.

اختبارات التكامل و e2e تتخطّى نفسها بهدوء لو `DATABASE_URL` غير قابل للوصول (مطوّر بلا قاعدة بيانات
لا يتعطّل)، وتعمل كاملة في CI وفي `pnpm run test:db`.

### تشغيل الاختبارات على PostgreSQL فعلي بدون Docker

Docker/WSL2 على هذا الجهاز معطّل. أُضيف `embedded-postgres` (devDependency) + سكربت
`apps/api/scripts/test-with-db.mjs` + أمر `pnpm run test:db`: يشغّل PostgreSQL حقيقيًا (18.4)
في مجلد مؤقت على منفذ آمن، يضبط `DATABASE_URL`، يشغّل كل اختبارات الخلفية (تكامل + e2e)، ثم
يوقفه ويحذف بياناته. **أداة اختبار محلية فقط** — لا تمسّ التطبيق ولا الإنتاج، و CI يظلّ يستخدم
خدمة `postgres:16` الخاصة به.

### قرارات معمارية جديدة

لا شيء. الاختيارات تنفيذ مباشر لـ D10 (شجرة عُقد عامة، أنواع كبيانات)، D14 (UUID)، D25 (أرشفة
لا حذف)، D22 (تتبّع التعديل)، D2/D20 (repository هو الباب الوحيد).

**نقطة للمالك (ليست تعارضًا):** D21 يذكر "رقم نسخة (version)" ضمن أعمدة الجداول التشغيلية.
اعتُبِر `org_node` جدولًا **هيكليًا** لا تشغيليًا، وقائمة البند خامس في تكليف ب-2-2 لا تتضمن `version`.
غياب `version` لا يمنع الأوفلاين (UUID + `updated_at` كافيان لكشف التعارض). إضافته لاحقًا = هجرة
`ADD COLUMN` سطر واحد. كذلك: لا عمود شركة على `org_node` (الشجرة هي مرساة الانتماء لا العكس —
D8/D9؛ الجداول التشغيلية لاحقًا تحمل `org_node_id` + الشركة القانونية المُستنتَجة).

### نتائج الاختبار الفعلي

`pnpm run test:db` على PostgreSQL 18.4:

- خلفية (وحدة + تكامل): **27/27 نجحت**، 5 ملفات.
- e2e: **4/4 نجحت** (`app.e2e` + `organization.e2e`).
- الهجرة `0000_organization_core.sql` طُبِّقت فعليًا (سكيمة + جدولان + 2 FK + 3 CHECK + 2 trigger
  - زرع 13 نوعًا)، و`db:check` يمرّ، وأعيد تطبيقها بلا تكرار.

خطأ واحد ظهر وأُصلح: توقّع اختبار "رفض حذف أب له أبناء" كان `23503`؛ Postgres يُرجِع `23001`
(`restrict_violation`) لأن المفتاح `ON DELETE RESTRICT` — صُحِّح التوقّع.

### ما لم يُختبر بسبب البيئة

لا شيء في نطاق ب-2-2. Docker/WSL2 معطّل على هذا الجهاز، لكن الاختبارات نُفِّذت فعليًا عبر
`embedded-postgres` (انظر أعلاه). CI يشغّلها كذلك على `postgres:16`.

---

## المرحلة ب-2-3 — كتابة عُقد الشجرة وقواعد الأبوة (2026-08-30)

### الهجرة `0001_org_parent_rules.sql`

مولّدة بـ `drizzle-kit generate --name org_parent_rules` ثم أُلحق بها الزرع يدويًا. مرقّمة
ومتتبَّعة في Git. **هجرة 0000 لم تُلمس.** المحتوى:

- `ALTER TABLE platform.org_node_type ADD COLUMN can_be_root boolean NOT NULL DEFAULT false`
  ثم `UPDATE ... = true` لـ `group` و `legal_company`.
- `CREATE TABLE platform.org_node_parent_rule (child_type, parent_type, created_at,
PRIMARY KEY (child_type, parent_type))` — كلاهما FK → `org_node_type.code`
  (ON DELETE CASCADE / ON UPDATE CASCADE).
- زرع **~40 قاعدة** (child_type → parent_type مسموح) لكل الأنواع الـ13، بينها `department>department`
  و `section>section` (تداخل ذاتي واقعي).

**بنية `org_node` لم تتغيّر إطلاقًا** (متطلب البند 5). أنواع جديدة أو قواعد جديدة = صفوف.

### قواعد الأبوة المنفّذة (D10)

مصدر القواعد: جدول `org_node_parent_rule` + العمود `can_be_root`. مكان التطبيق:
**طبقة الخدمة** (الخط الأول)، وقاعدة البيانات تحتفظ بحُرّاسها الهيكلية (FK وجود الأب،
CHECK لا-عقدة-أبًا-لنفسها، trigger منع الدورة، CHECK الاسم والحالة) كخط دفاع نهائي.

عند الإنشاء / النقل، الخدمة تتحقق بالترتيب:

1. نوع العقدة موجود.
2. الاسم غير فارغ بعد trim، `position` عدد صحيح ≥ 0.
3. لو `parentId = null` → النوع لازم `can_be_root`.
4. لو له أب: الأب موجود، **ليس مؤرشفًا**، و`(childType, parentType)` موجود في `org_node_parent_rule`.
5. النقل: ليس أبًا لنفسه، وليس دورة (`listAncestorIds(newParent)` لا يحوي id العقدة).

### API الجديدة

| الطريقة | المسار                                   | الوظيفة                                                                 |
| ------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `POST`  | `/api/v1/organization/nodes`             | إنشاء عقدة (بدون `parentId` أو `null` = جذر) → 201                      |
| `PATCH` | `/api/v1/organization/nodes/:id`         | تعديل: `name` و/أو `position` و/أو `parentId` (نقل؛ `null` = جذر) → 200 |
| `POST`  | `/api/v1/organization/nodes/:id/archive` | أرشفة (status='archived'، لا DELETE) → 200                              |

`GET /tree` لم يتغيّر — يعكس تلقائيًا العُقد الجديدة والمؤرشفة (الحالة على كل عقدة).
لا حذف فعلي. الطبقات: DTO (class-validator) → Controller → Service → Repository → DB.
أخطاء المجال (`organization.errors.ts`) → HTTP عبر `OrganizationExceptionFilter`
(404 / 400 / 409). الخدمة لا تعرف HTTP.

### أرشفة عقدة لها أبناء — قرار يحتاج حسم المالك

`docs/00` **لا يحدّد** ماذا يحدث للأبناء عند أرشفة الأب. لم أفترض سلوكًا (البند 7).
التنفيذ الحالي: **أرشفة الأوراق فقط**؛ أرشفة عقدة لها أبناء غير مؤرشفين → `409 OrgLifecycleError`
("أرشِف الأبناء أولًا"). هذا يمنع ترك شجرة غير صحيحة، ولا يفترض cascade/allow.
**الخيارات للمالك:** (أ) الإبقاء على الرفض · (ب) أرشفة متتالية للأبناء · (ج) السماح.

### قرارات تنفيذ أخرى (ليست معمارية، للعلم/الموافقة)

- قواعد الأبوة مطبَّقة في الخدمة، **لا trigger في قاعدة البيانات** لها (سياسة قابلة للتكوين،
  ليست سلامة هيكلية؛ trigger لها كان سيربط القواعد بـ DDL ويكسر اختبارات ب-2-2 التي تُدرِج
  أنواعًا حرة كجذور). قابل للتغيير لو أراد المالك دفاعًا في العمق على مستوى القاعدة.
- "الأب المؤرشف مرفوض كأب" — مشتق من دلالة الأرشفة في ب-2-2 ("الإزالة = archived") + البند 7.
- لا endpoint لإلغاء الأرشفة، والعقدة المؤرشفة لا تُعدَّل ولا تُنقل — خارج نطاق ب-2-3.
- `can_be_root` عمود على `org_node_type` (وليس `org_node`) — سماح البند 5 يحمي `org_node` فقط.

### الاختبارات — 75 اختبارًا (كلها خضراء على PostgreSQL 18.4 عبر `pnpm run test:db`)

| المجموعة                                                    | عدد | ملاحظة                                                                       |
| ----------------------------------------------------------- | --- | ---------------------------------------------------------------------------- |
| وحدة `organization.tree.spec.ts`                            | 7   | بناء الشجرة (كما هي من ب-2-2)                                                |
| وحدة `organization.service.spec.ts` (جديد، fake repo)       | 26  | إنشاء/تعديل/نقل/أرشفة + كل قواعد الرفض                                       |
| تكامل `organization.repository.integration.spec.ts` (موسّع) | 29  | 12 من ب-2-2 + 17 جديدة (هجرة 0001، helpers، تدفّق الخدمة، عدم تكرار الهجرات) |
| تكامل `database.integration.spec.ts` (ب-2-1)                | 2   | لم تنكسر                                                                     |
| وحدة `migrator.spec.ts` (ب-2-1)                             | 4   | لم تنكسر                                                                     |
| وحدة `health.controller.spec.ts` (ب-1)                      | 2   | لم تنكسر                                                                     |
| e2e `organization.e2e-spec.ts` (موسّع)                      | 7   | 2 من ب-2-2 + 5 جديدة (إنشاء/تعديل/نقل/أرشفة/رفض عبر HTTP)                    |
| e2e `app.e2e-spec.ts` (ب-1)                                 | 2   | لم تنكسر                                                                     |

بدون قاعدة بيانات (`pnpm verify`): 75 تمرّ (اختبارات التكامل/e2e تتخطّى نفسها بهدوء).

### مشاكل ظهرت وعولجت

1. `express` types غير موجودة في `OrganizationExceptionFilter` → استُبدلت بواجهة `HttpResponse`
   مصغّرة (لا اعتماد على types express).
2. اختبار الدورة (unit + integration) فشل بـ `OrgParentingError` بدل `OrgCycleError` لأن فحص
   نوع-الأب يسبق فحص الدورة → غُيّر السيناريو لسلسلة `department>department` (النوع مسموح فالدورة
   هي ما يُرفض)، وأُضيفت قاعدتا `department>department` و `section>section` للزرع.
3. `POST .../archive` رجع 201 (افتراضي NestJS) بدل 200 → `@HttpCode(200)`.

### تعارضات معمارية

لا شيء. `docs/00` لم يُلمس.

---

## المرحلة ب-2-4 — واجهات القراءة للنواة التنظيمية (2026-08-30)

**نطاق معتمد من المالك:** واجهات القراءة فقط. **لا هجرة، لا تغيير سكيما، لا وحدات جديدة.**

### API الجديدة (كلها GET، للقراءة فقط)

| المسار                                         | الرد                                                              | أخطاء                             |
| ---------------------------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| `GET /api/v1/organization/nodes/:id`           | `{ node }`                                                        | 404 غير موجود · 400 UUID غير صحيح |
| `GET /api/v1/organization/nodes/:id/subtree`   | `{ subtree }` (العقدة + نسلها متداخلًا)                           | 404 · 400                         |
| `GET /api/v1/organization/nodes/:id/ancestors` | `{ node, ancestors }` (السلسلة من الجذر لأسفل، بدون العقدة نفسها) | 404 · 400                         |
| `GET /api/v1/organization/node-types`          | `{ nodeTypes: [{ code, label, canBeRoot, allowedParentTypes }] }` | —                                 |

`GET /tree` و POST/PATCH/archive **لم تتغيّر**. لا حذف. لا كتابة.

### التنفيذ

- **Repository** (+2 دالة): `listNodeTypes()`، `listParentRules()`. لا SQL جديد معقّد —
  `getSubtree` و `getAncestors` تُحسبان في الذاكرة من `findAllNodes()` (نفس نهج `getTree`،
  والشجرة صغيرة). `listAncestorIds` (recursive CTE، من ب-2-3) باقية لفحص الدورة عند النقل.
- **Service** (+4 دوال): `getNode`، `getSubtree`، `getAncestors`، `getNodeTypes`.
- **Pure helpers** في `organization.tree.ts`: `collectSubtree`، `collectAncestors`،
  `assembleNodeTypes` (دمج قواعد الأبوة في كل نوع كـ `allowedParentTypes` مرتّبة).
- **Controller** (+4 GET). ترتيب المسارات: `node-types` قبل `nodes/:id`؛ `nodes/:id/subtree`
  و `nodes/:id/ancestors` أطول من `nodes/:id` فلا تعارض.

### الاختبارات — 96 اختبارًا (كلها خضراء على PostgreSQL 18.4 عبر `pnpm run test:db`)

| المجموعة                                              | عدد | تغيّر في ب-2-4                                            |
| ----------------------------------------------------- | --- | --------------------------------------------------------- |
| وحدة `organization.tree.spec.ts`                      | 17  | +10 (collectSubtree، collectAncestors، assembleNodeTypes) |
| وحدة `organization.service.spec.ts`                   | 32  | +6 (getNode/getSubtree/getAncestors/getNodeTypes)         |
| وحدة `migrator.spec.ts` + `health.controller.spec.ts` | 6   | —                                                         |
| تكامل `organization.repository.integration.spec.ts`   | ~38 | +4 (read APIs على قاعدة حقيقية)                           |
| تكامل `database.integration.spec.ts`                  | 2   | —                                                         |
| e2e `organization.e2e-spec.ts`                        | 11  | +4 (GET node/subtree/ancestors/node-types عبر HTTP)       |
| e2e `app.e2e-spec.ts`                                 | 2   | —                                                         |

`pnpm run test:db`: **83 خلفية (6 ملفات) + 13 e2e (2 ملف) = 96/96 نجحت.**
بدون قاعدة بيانات (`pnpm verify`): 92 تمرّ (التكامل/e2e تتخطّى نفسها).

### مشاكل ظهرت

لا شيء. الفحوصات مرّت من أول تشغيل بعد الكتابة (format / lint / typecheck / test / test:db / build / db:check).

### قرارات معمارية / تعارضات

لا شيء. `docs/00` لم يُلمس. لا قرارات جديدة — كله تنفيذ لواجهات قراءة على النموذج الموجود.
