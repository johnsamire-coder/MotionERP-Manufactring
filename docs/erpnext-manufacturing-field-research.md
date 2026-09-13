# ERPNext Manufacturing — المرجع الميداني الكامل (من لقطات الموقع التجريبي الحي)

- **المصدر:** موقع ERPNext التجريبي الحي `erpnext-dch-zpe.k.frappe.cloud` — شركة "Js (Demo)"، 13 سبتمبر 2026.
- **الأدلة:** 50 لقطة شاشة في [`docs/erpnext-screenshots/Manufactoring/`](erpnext-screenshots/Manufactoring/) (الأرشيف الأصلي: `Manufactoring.rar` من سطح مكتب المالك).
- **القاعدة الملزمة:** هذا التوثيق مأخوذ من **المعاينة الفعلية** لا من التوثيق النصي — مبدأ الجزء الثاني عشر من الوثيقة الانتقالية.
- **الاستخدام:** مرجع البناء عند تنفيذ موديول Manufacturing في Motion ERP (المرحلة ٥ من الخطة، وبناء الشاشات وفق القرار الحاسم في الجزء الثاني عشر).

---

## 1. القائمة الجانبية الكاملة لموديول Manufacturing (كما هي حرفيًا في ERPNext)

```
Manufacturing
├── Home
├── Dashboard
├── BOM
├── Work Order
├── Job Card
├── Stock Entry
├── Material Planning        (قائمة فرعية قابلة للطي)
│   ├── Item Lead Time
│   ├── Production Plan
│   ├── Forecasting
│   ├── Master Production Scheduled
│   ├── Sales Forecast
│   └── Production Planning Report
├── Tools                    (قائمة فرعية قابلة للطي)
│   ├── BOM Creator
│   ├── BOM Update Tool
│   └── Downtime Entry
├── Reports                  (قائمة فرعية قابلة للطي — 10 تقارير)
│   ├── Production Planning Report
│   ├── Work Order Summary
│   ├── Quality Inspection Summary
│   ├── Downtime Analysis
│   ├── Job Card Summary
│   ├── BOM Search
│   ├── Production Analytics
│   ├── BOM Operations Time
│   └── Work Order Consumed Materials
└── Setup                    (قائمة فرعية قابلة للطي)
    ├── Item
    ├── Warehouse
    ├── Operation
    ├── Workstation
    └── Workstation Type
+ Getting Started (قسم سفلي ثابت في الشريط الجانبي)
```

**تصحيح مهم عن الجزء الأول من التوثيق (الوثيقة الانتقالية):** قسم Setup لم يكن موثقًا فيه — وهو موجود فعليًا ويحوي 5 صفحات: `Item, Warehouse, Operation, Workstation, Workstation Type`. (Item و Warehouse مشتركان مع Stock لكن يظهران هنا كاختصارات.)

---

## 2. الصفحة الرئيسية للموديول (Manufacturing Dashboard)

- **المسار:** `Manufacturing / Dashboard View` — عنوان "All Manufactoring Data".
- **KPIs أعلى الصفحة (4):** `Total Work Order` · `Work Orders In Progress` · `Ongoing Job Card` · `Total BOMs`.
- **3 رسوم بيانية:**
  1. `Work Order Analysis` — عمودي، محور Y: Qty To Manufacture، محور X: Production Item.
  2. `Work Order Quantity Analysis` — دائري (Donut)، حسب الحالة: Not Started / In Progress / Completed / Stopped.
  3. `Pending Work Order` — خطي، محور Y: Pending Qty، محور X: Production Item.
- **زر "Create BOM"** عائم أسفل اليمين.
- **لاحظ الفرق عن توثيق الجزء الأول:** الـKPIs الفعلية هي `Total Work Order / Work Orders In Progress / Ongoing Job Card / Total BOMs` (وليس Monthly Total Work Order و Monthly Completed Work Order و Monthly Quality Inspection كما ورد في التوثيق النصي السابق). المعاينة الحية هي المرجع.

---

## 3. BOM (قائمة + مستند جديد)

### قائمة BOM
- أعمدة القائمة: `ID · Item · Quantity · UOM · Is Active · Is Default · With Modules · Company · Creation`.
- فلتر افتراضي ظاهر: `Company = Js (Demo)`.
- عرضها في ERPNext: قائمة مستندات عادية، كل صف يفتح مستند BOM.

### مستند BOM الجديد (New BOM) — 4 تابات
**Tab 1 — Production Item:**
- حقول الرأس: `Item` (إجباري) · `Quantity` · `UOM` · `Company` · `Allow Alternative Item` (checkbox) · `Set Rate Of Components Based On` (اختيار: Valuation Rate / Price List / Last Purchase Rate) · `Rate Of Materials Based On` · `Currency` · `Conversion Rate` · `RM Cost As On` · `Operating Cost` (قسم فرعي: `With Operations` checkbox، `Cost Allocation Per Qty`، `Op Cost Per Company Currency`) · `Has Variants` · `Is Default` · `Is Active` · `Default Source Warehouse` · `Default WIP Warehouse` · `Default Finished Goods Warehouse`.
- جدول `Items` (المكونات): Item Code · Item Name · BOM No · Source Warehouse · Operation · Qty Consumed Per Unit · Rate · Amount — مع زر "Fetch raw materials from BOM" (سحب مكونات من BOM فرعي) و "Get Cost Of Raw Materials".
- جدول `Scrap Items`: Item Code · Stock Qty · Stock UOM · Rate · Amount (وثيقة: "Scrap / Refusable Goods items... Rate can be updated by the user").

**Tab 2 — BOM Configuration:**
- جدول `Operations`: Operation · Workstation · Description · Operating Cost · Operation Time (Min) · Batch Size · Sequential Operation Time (Min) · Base Hour Rate (Ccy) — مع خيار "With Operations" لتفعيل الجدول.
- حقول: `Operating Cost` · `Project` · `Total Operating Cost` · `Total Original Cost` (يظهر بالعملة)، وقسم "Cost Breakup" (تفصيل: Raw Materials Cost + Operating Cost).
- `Consume Components Based On` — البديل الرسمي لمفهوم Backflush عندنا (خيارات الافتراضي: BOM).
- `Plant Capacity` (checkbox) · `Daily Production Capacity` · `MFG Time Per Day (Mins)`.
- **زر النشر:** "Submit" + تبويبات النتيجة: Raw Material Cost · Operating Cost · Total Cost (السعر النهائي للـBOM).

**Tab 3 — More Info:**
- `Exploded View` (شجرة توسيع BOM متعددة المستويات) · `Estimated Material Cost` · `Estimated Operating Cost` · `Leading Item Code` (الصنف الرئيسي للـBOM المفكك) · `Project` · `Reference: Sales Order` · `Customer`.

**Tab 4 — Connect:** قسم Integrations القياسي في ERPNext (ربط بمستندات أخرى).

**قاعدة إلزامية للتنفيذ عندنا:** BOM في ERPNext = مستند مستقل بمستوى الصنف، له دورة حياة كاملة (Draft → Submitted → Cancelled)، وحالة `Is Active` / `Is Default`، وتكلفة مفصّلة (خامات + تشغيل) وتُستخدم في Work Order. هذا مستقل تمامًا عن فكرة "BOM مرتبطة بالـJob Order" عندنا — الاثنين سيتعايشان في المرحلة الثانية (بعد التطابق الكامل) كإضافة واضحة فوق الهيكل المطابق.

---

## 4. BOM Creator (أداة الشجرة متعددة المستويات)

- **قائمة BOM Creator:** أعمدة `ID · BOM Name · Company · Status · Creation` (فلاتر: Status, Created By).
- **مستند BOM Creator جديد:**
  - الرأس: `BOM Name` (إجباري) · `Company` · `Item Name` · `Quantity To Produce` · `UOM` · `Project` · `Allow Alternative Item` · `Set Rate Of Components Based On`.
  - **4 تابات:** `BOM Tree` (شجرة المنتج النهائي ومكوناته الفرعية) · `Final Product` · `Sub Assemblies & Raw Materials` · `Remarks`.
  - BOM Tree تُبني تفاعليًا: كل عقدة منتج ممكن تحتها مكونات ومجموعات فرعية (sub-assemblies)، وبها "Expand" و"Create BOM" لكل عقدة فرعية، وأزرار: `Validate BOM Tree` · `Update Cost` (يحدّث التكلفة بالشجرة كلها) · `Create BOMs` (يولّد مستندات BOM فعلية من الشجرة دفعة واحدة).
  - الحالة (Status) للـBOM Creator: `Draft / Completed` — بعد Create BOMs تتحول Completed.

**الفارق الجوهري عن BOM العادي:** BOM Creator = مسوّد شجرة كاملة متعددة المستويات تُنشئ عدة BOMs مرة واحدة؛ BOM = مستند نهائي لصنف واحد. عندنا لازم الاتنين (Tools: BOM Creator + BOM نفسه).

---

## 5. BOM Update Tool

شاشة أداة بسيطة بحقلين + زرّين:
- `Current BOM` (اختيار BOM قائم) → `New BOM` (اختيار BOM بديل) → زر `Replace` (يستبدل القديم بالجديد في كل مكان يستخدمه).
- زر منفصل: `Update latest price in all BOMs` (تحديث أسعار كل الـBOMs بأحدث الأسعار).

---

## 6. Work Order (قائمة + مستند جديد)

### قائمة Work Order
- فلاتر جانبية (Sidebar Filters): `Status` (Not Started / In Progress / Completed / Stopped / Closed) · `Production Item` · `Sales Orders` · `BOM No` · `Requested By` · `Status` · `Created By`.
- أعمدة: `ID · Production Item · Qty To Manufacture · Requested By (Item Future Error?) · Planned Start Date · Actual Start Date · Status · Company · Creation`.
- أعمدة إجماليات أعلى القائمة: `Total Qty To Manufacture · Total Produced Qty · Total Pending Qty`.

### مستند Work Order جديد — 4 تابات
**Tab 1 — Materials:**
- الرأس الإجباري: `Item To Manufacture` · `Qty To Manufacture` · `BOM No` (إجباري، يجيب الشجرة) · `Company` · `Use Multi-Level BOM` (checkbox) · `Project`.
- التواريخ: `Planned Start Date` · `Required Items By` · `Expected Delivery Date` · `Actual Start Date` · `Actual End Date`.
- المخازن: `Source Warehouse` · `WIP Warehouse` · `Finished Goods Warehouse` (إجبارية).
- `Consider Scrap Items` (checkbox) · `Material Consumption Percentage` (افتراضي 100) · `Material Transfer Mode` (اختيار: **Transfer** أو **Move**).
- `Track Operations` (checkbox) — لو مفعّل يظهر جدول `Operations` (Operations: Name · Workstation · Planned Start Time · Planned End Time · Process Loss Qty · Sequential Order).
- `Skip Material Transfer` (checkbox) · `Backflush Raw Materials Based On` (BOM) — **مفهوم الـBackflush الرسمي موجود هنا أيضًا**.
- جدول `Required Items`: Item Code · Item Name · Source Warehouse · Required Qty · Transferred Qty · Stock UOM · Amount.
- أزرار الجدول: `Update Cost` (يحدّث التكلفة من الـBOM) · `Get Item Details`.

**Tab 2 — More Information:**
- `Work Order Costing` (تسعير أمر التشغيل): `Operating Cost` · `Raw Material Cost` · `Additional Operating Cost` · `Total Operating Cost` · `Total Stock Cost` · **`Total Cost`**.
- جدول `Operations Cost` (تفصيل تكلفة العمليات) + جدول `Process Loss` (فاقد العملية: Operation · Process Loss Qty · Process Loss Percentage).
- `Sales Order` (ربط اختياري بأمر بيع) · `Material Request` (ربط اختياري) · `Product Bundle Items`.
- `Serial / Batch Numbers` القسم الخاص بتتبع السيريال والدفعة للمخارج.

**Tab 3 — Dashboard / Progress:**
- مؤشرات التقدم: `Produced Quantity` · `Rejected Quantity` · `Pending Quantity` · `Consumed Materials` (مع شريط تقدم لكل واحدة) · `Work Orders (Child)` (أوامر فرعية للمنتجات الوسيطة) · `Job Cards` المرتبطة.
- Section "Stock Entries Reservations" وقسم "Timesheet / Operations" الزمني الفعلي.

**Tab 4 — Connect:** Integrations القياسي.

**دورة حياة Work Order (من الفلاتر والأزرار):** Not Started → In Progress → Completed / Stopped / Closed — مع أزرار: Start · Pause · Resume · Finish (Complete) · Stop · Close · Cancel.
**الترقيم الرسمي:** `MFG-WO-.YYYY.-.#####` (يظهر في Document Naming بصفحة الإعدادات العامة) — وصفحة القائمة تستخدم نفس النمط.

**الأهم عندنا:** Work Order في ERPNext **يُبنى حصريًا فوق BOM** (حقل BOM No إجباري) ويرتبط اختياريًا بـSales Order — وهو أقرب مكافئ لما عندنا `job_order`، لكن بنية ERPNext أبسط من Job Order عندنا (لا يوجد مفهوم Job Order الجامع). في المرحلة الأولى نطابق شكل Work Order بالحرف، وفي المرحلة الثانية نُظهر Job Order كإضافة واضحة فوقه.

---

## 7. Job Card (قائمة + مستند جديد)

### قائمة Job Card
- فلاتر جانبية: `Status` (Open / Work In Progress / Completed / Cancelled) · `Work Order` · `Operation` · `Workstation` · `Production Item` · `From Date` / `To Date`.
- أعمدة: `ID · Workstation · Operation · Work Order · Production Item · Total Time In (Mins) · Total Time In (Mins) Actual · Status · Company · Creation`.

### مستند Job Card جديد — 3 تابات
**Tab 1 — Details:**
- الرأس: `Work Order` (**إجباري** — اختيار أمر تشغيل) · `Operation` (تُجاب تلقائيًا من أمر التشغيل) · `Workstation` · `Series` · `Company` · `Sequence ID` · `IsPaused` · `Process Loss Item` · `Workstation Type`.
- `For Quantity` (الكمية المستهدفة للعملية) · `Batch Size` · `Quantity (Manufactured)` · `Process Loss Quantity`.
- الأزمنة: `Expected Start Date` · `Expected End Date` · `Scheduled In Minutes` · `Total Time In (Mins)`.
- `Work-in-Progress Warehouse` · `Employee` (جدول العمال المنفذين) · `Operator` (المشغّل المسؤول).
- `Allow Overproduction` (checkbox + `Overproduction Percentage`) · `Current Operation Time (Mins)` · `Total Completed Quantity`.
- **جدول `Time Logs`:** From Time · To Time · Time In (Mins) · Completed Quantity · Process Loss Quantity (سجل فترات التشغيل الفعلية) — وهذا هو القلب التشغيلي للـJob Card.
- **جدول `Raw Materials`:** Item Code · Source Warehouse · Qty Consumed Per Unit · Required Qty · Transferred Qty · UOM.
- `Scrap Items` جدول (Wastage/Scrap).

**Tab 2 — More Information:**
- `Total Completed Quantity` · `Time Remaining (Mins)` · `Specific Operation Completion` · `Remarks` · `Process Loss Item` · `Parent Job Card` (بطاقة أب عند التقسيم) · `Transferred-pending` قسم.
- جدول `Time Log` + جدول `Correction` (تصحيحات التسجيل).

**Tab 3 — Connect:** Integrations القياسي.

**دورة حياة Job Card:** Open → Work In Progress → Completed / Cancelled — أزرار: `Start Operation` · `Pause` · `Resume` · `Complete Operation` · `Set Up` · `Cancel`.

**أهم استنتاج:** Job Card عند ERPNext = **سجل تنفيذ عملية واحدة على محطة عمل واحدة لأمر تشغيل واحد**، بسجل زمني (Time Logs) واستهلاك خامات (Raw Materials) وفاقد (Process Loss). هذا يطابق تمامًا ما سميناه `production_ops` (production_step) — التسمية عندنا أصبحت "Job Card" في الواجهة، والحقول المطلوبة واضحة من هنا.

---

## 8. Stock Entry (قائمة)

- فلاتر جانبية: `Purpose` (**Material Transfer / Manufacture / Repack / Material Issue / Material Receipt / Send to Subcontractor**) · `From Warehouse` · `To Warehouse` · `Status` · `Created By`.
- أعمدة: `ID · Purpose · Posting Date · From Warehouse · To Warehouse · Total Amount · Company · Creation`.
- من داخل Work Order تُنشأ Stock Entries تلقائيًا بناءً على الحركة (صرف خامات / تحويل تحت التشغيل / استلام تام).

**عندنا:** هذه هي الشاشة الموثقة سابقًا كـ`Stock Entry` في Stock — تظهر هنا لأنها جزء أساسي من دورة التصنيع (المسار الجانبي في Manufacturing يحويها كاختصار).

---

## 9. Material Planning (6 شاشات)

### 9.1 Item Lead Time
- **القائمة:** أعمدة `ID · Item Code · Manufacturing Time (Hours) · Purchase Time (Days) · Default Buffer Time (Days) · Company · Creation`.
- **مستند جديد — 3 تابات:**
  - **Manufacturing Time:** `Default Buffer Time (Days)` · `Is Manufacturing Lead Time` (checkbox) · `Total Workstation Time (Hours)` · `Capacity Planning Detail` جدول (Workstation · Time Period · Weekly Capacity · Daily Capacity · Total Capacity).
    - معادلة معروضة حرفيًا: `Total Workstation Time (Hours) = Shift Time (Per Day) × No of Workstations × No of Shift`.
    - `No of Units Produced = (Total Workstation Time / Manufacturing Time) × 60`.
    - `Capacity = (Daily Yield % × No of Units Produced) / 100`.
  - **Purchase Time:** `Purchase Time (Days)` · `Lead Time Days (Lead Time Details جدول: Supplier · Lead Time Days)` · `Is Purchase Lead Time` · `Default Buffer Time (Days)`.
  - **Item Details:** `Item Code` · `Stock UOM` · `Description` · `Company`.

### 9.2 Production Plan (قائمة + مستند جديد)
- **القائمة:** فلاتر (Status: Draft / Submitted / Not Started / In Progress / Completed / Closed) · أعمدة `ID · Production Plan By · Company · From Planning Date · To Planning Date · Status · Creation`.
- **مستند Production Plan جديد (التقاطة 187KB — أكبر شاشة):**
  - الرأس: `Company` · `Production Plan By` (خيارات: **Sales Order / Material Request / Sales Forecast**) · `Posting Date` · `From Planning Date` · `To Planning Date` · `Customer` · `Combine Items` (checkbox) · `Use Multi-Level BOM` · `Skip Available Items` (checkbox) · `Include Non-Conceived Items` (checkbox) · `Include Sub Assembly Raw Materials` (checkbox) · `Sub Assembly Raw Material Warehouses`.
  - **جدول `Sales Orders`** (عند اختيار Production Plan By = Sales Orders): Sales Order · Sales Order Item · Customer · Item Code · Qty · Pending Qty · Warehouse · Production Plan Item · Planned Start Date — زر `Get Sales Orders` لجلبها.
  - **جدول `Material Requests`** (عند اختيار Material Request) بنفس المنطق بزر `Get Material Requests`.
  - **جدول `Sales Forecast`** (عند اختيار Sales Forecast) بزر `Get Sales Forecast`.
  - **جدول `Items`:** Item Code · Item Name · BOM No · Planned Start Date · Planned End Date · Qty To Plan · Planned Qty · Warehouse — أزرار `Get Items` · `Update Items` · `Combine Items`.
  - **جدول `Material Requirements`:** Item Code · Item Name · Required Qty · Warehouse To Be Used — زر `Get Raw Materials For Production` (يجيب الخامات المطلوبة من كل الـBOMs مجتمعة).
  - **جدول `Sub Assembly Items`** (عند تفعيل Include Sub Assembly Raw Materials): للمنتجات الوسيطة.
  - **Tab 2 — For Warehouse:** `For Warehouse` (قسم اختيار المخازن: Raw Material Warehouse · FG Warehouse · WIP Warehouse) + جدول `Warehouse-wise Required Quantity` (Item Code · Warehouse · Required Qty · Projected Qty · Actual Qty) وزر `Get Projected Qty` (سحب الأرصدة المتوقعة).
  - **Tab 3 — Finished Goods:** جدول Finished Goods (Item Code · Qty To Manufacture · Warehouse) + زر `Create Work Orders` (**هنا تُولَّد أوامر التشغيل دفعة واحدة من الخطة**) — خيار `Create Work Order For` (All Items / Selected Items) · `Include Non-Conceived Items` · `Consider Existing Work Orders` (checkbox).
  - **Tab 4 — Drafts:** Production Plan Items المسودّة.
  - **Tab 5 — More Info:** `Status` · `Amended From` · `Project`.
- **دورة الحياة:** Draft → Submitted → Not Started → In Progress → Completed / Closed — أزرار: `Submit` · `Create Work Orders` · `Create Material Requests` (توليد طلبات خامة من النواقص) · `Close`.

### 9.3 Forecasting (تقرير Exponential Smoothing Forecasting)
- **المسار:** `Manufacturing / Forecasting` — تقرير تفاعلي، بياناته فارغة افتراضيًا حتى تُدخل فلاتر.
- **الفلاتر:** `Company` · `From Date` · `To Date` · `Based On` (Sales Order / ...) · `Quantity Based On` (Qty / Amount) · `Periodicity` (خيارات: **Monthly / Quarterly / Half-Yearly / Yearly**) · `Smoothing Factor` (افتراضي 0.3 — عامل التمهيد الأسي) · `Item Code` · `Warehouse`.
- **النتيجة:** جدول تنبؤ + رسم بياني للأصناف عبر الفترات.

### 9.4 Master Production Schedule
- **القائمة:** فلاتر (Status) · أعمدة `ID · Item Code · From Date · To Date · Company · Status · Creation`.
- **مستند جديد — تابات:**
  - **Details:** `Item Code` · `From Date` · `To Date` · `Company` · `Warehouse`.
  - **Schedule:** جدول `Schedule` (Period: Week / Month / Quarter / Year + Start Date + End Date) — زر `Distribute Quantities` لتوزيع الكميات على الفترات — زر `Distribute Quantities Evenly` (توزيع متساوي).
  - **Quantities:** `Total Forecast Quantity` · `Projected Quantity` · `Available Quantity` · `Planned Quantity` — وزر `Get Projected Quantity` (سحب الأرصدة المتوقعة من المخزن).
  - **More Info:** Status · Amended From · Project.
- **الغرض:** خطة إنتاج رئيسية على مستوى صنف × فترة زمنية، تُغذّي Production Plan (عند اختيار Production Plan By = Sales Forecast / MPS).

### 9.5 Sales Forecast
- **القائمة:** فلاتر (Status) · أعمدة `ID · For (Item Group / Territory) · Company · From Date · To Date · Status · Creation`.
- **مستند جديد — تابات:**
  - **Details:** `Company` · `For` (خيارات: **Item Group / Territory / Both**) · `Item Group` · `Territory` · `From Date` · `To Date` · `Warehouse` · `Based On` (خيارات: **Sales Order / Sales Invoice / Quantity Forecast**) · `Forecast Periodicity` (**Monthly / Quarterly / Half-Yearly / Yearly**) · `Custom Forecast` (checkbox).
  - **Quantities:** `Total Forecast Quantity` · `Projected Quantity` · `Available Quantity` · `Planned Quantity` — زر `Get Projected Quantity`.
  - **Quantities Forecast (جدول):** Item Code · Warehouse · Forecast Quantity · Planned Quantity + زر `Get Items From` (يجيب الأصناف من اختيار `For`) — **بديل Custom Forecast** لو مفعّل.
  - **Period Distribution:** جدول توزيع على الفترات: Period · Period Name · Forecast Quantity · Planned Quantity — زر `Distribute Quantities Evenly`.
  - **More Info:** Status · Amended From · Project.
- **دورة الحياة:** Draft → Submitted → (تُستهلك في Production Plan).

### 9.6 Production Planning Report
- تقرير بفلاتر: `Company` · `Based On` (Sales Order / Material Request) · `Document Name` · `Raw Material Warehouse` · `Delivery Date` · checkbox `Include Sub-assembly Raw Materials`.
- **النتيجة:** جدول بمستويات BOM كاملة (Level · Item Code · BOM · Quantity Required · ...) لكل أمر بيع/طلب — خطة الخامات المتتالية (مواد خام + منتجات وسيطة) حتى آخر مستوى.

---

## 10. Tools (3 شاشات)

### 10.1 BOM Creator — راجع القسم 4 أعلاه.

### 10.2 BOM Update Tool — راجع القسم 5 أعلاه.

### 10.3 Downtime Entry (قائمة + مستند جديد)
- **القائمة:** أعمدة `ID · Workstation · Machine · Operator · From Time · To Time · Downtime (Mins) · Stop Reason · Company · Creation`.
- **مستند جديد:** `Workstation` · `Machine` · `Operator` · `From Time` · `To Time` · `Downtime` (يُحسب تلقائيًا بالدقائق من الفرق) · `Stop Reason` · `Company` · `Reason` · `Remarks`.
- **الغرض:** تسجيل أي توقف لأي محطة عمل لأي سبب — تُستهلك في تقرير Downtime Analysis.

---

## 11. Reports (10 تقارير) — كاملة من المعاينة

كل التقارير شاشات فلاتر أعلى + جدول نتائج، وبعضها رسوم بيانية:

| # | التقرير | الفلاتر الظاهرة | ملاحظات |
|---|---|---|---|
| 1 | **Production Planning Report** | Company · Based On (Sales Order / Material Request) · Document Name · Raw Material Warehouse · Delivery Date · Include Sub-assembly Raw Materials | يفصّل الخامات المطلوبة على مستويات BOM |
| 2 | **Work Order Summary** | Company · Based On (Creation Date) · From Date · To Date · Status · Sales Orders · Production Item · Qty · Status | ملخص أوامر التشغيل |
| 3 | **Quality Inspection Summary** | From Date · To Date · Status · Item Code · Inspected By | ملخص فحوصات الجودة (يُفعَّل مع موديول Quality) |
| 4 | **Downtime Analysis** | From Date · To Date · Machine | تحليل أوقات التوقف |
| 5 | **Job Card Summary** | Company · Fiscal Year · From Date · To Date · Status · Work Orders · Production Item · Workstation · Operation | ملخص بطاقات التشغيل |
| 6 | **BOM Search** | Based On (Item) · Item Code · Company | بحث في كل الـBOMs بالصنف أو المكوّن |
| 7 | **Production Analytics** | Company · From Date · To Date · Range (Monthly) | **رسم بياني تراكمي + جدول شهري بكل الحالات:** Not Started · Overdue · Pending · Completed · Closed ·Stopped — لكل شهر |
| 8 | **BOM Operations Time** | Company · Item Code · BOM | زمن كل عملية داخل كل BOM |
| 9 | **Work Order Consumed Materials** | Company · From Date · To Date · Work Order · Production Item · Status · checkbox "Excess Materials Consumed" | مقارنة المصروف الفعلي بمخطط الـBOM — **هذا أقرب تقرير لرقابة الانحراف عندنا** |
| 10 | **Exponential Smoothing Forecasting** | Company · From Date · To Date · Based On (Sales Order) · Qty/Amount · Periodicity (Monthly/Quarterly/Half-Yearly/Yearly) · Smoothing Factor (0.3) · Item Code · Warehouse | تنبؤ بالطلب بأسلوب التمهيد الأسي |

---

## 12. Setup (5 شاشات — اختصارات لمستندات تُدار في Stock/Frame)

| الصفحة | الغرض | ملاحظات للتنفيذ عندنا |
|---|---|---|
| **Item** | تعريف الصنف (قسم Setup في Manufacturing) | مشترك مع Stock — نفس السجل |
| **Warehouse** | تعريف المخزن | مشترك مع Stock |
| **Operation** | تعريف عملية تشغيل (اسم، محطة، وقت قياسي، تكلفة/ساعة) | **مستند جديد كليًا عندنا — مطلوب لكل BOM/Job Card** |
| **Workstation** | محطة عمل: `Workstation Name` · `Workstation Type` · `Capacity` (Units) · `Working Hours` (جدول Shift: Start/End) · `Hour Rate Labor` · `Hour Rate Electricity` · `Hour Rate Consumption` · `Hour Rate Rent` · `Hour Rate Depreciation` · **Total Hour Rate** (محسوب) · `WIP Warehouse` | **مكافئ مباشر لـ`work_center` عندنا** — أضِف حقول Hour Rate الأربعة + Workstation Type |
| **Workstation Type** | تصنيف المحطات (Machine / Assembly Line / ...) | جديد عندنا — جدول تصنيفات بسيط |

---

## 13. فجوات وملحوظات حرجة للتنفيذ (خلاصة المعاينة)

1. **BOM عند ERPNext أعمق من عندنا:** فيها `Is Default` · `Is Active` · `Allow Alternative Item` · `Set Rate Of Components Based On` · `Consume Components Based On` (Backflush) · Scrap Items · Cost Breakup · Exploded View — **كلها حقول لازم تظهر في نسختنا المطابقة**، حتى لو خلفيتنا (bom table) أقرب شكلًا من الحالي.
2. **Work Order يقف على BOM حصرًا** (BOM No إجباري) وليس على Job Order — عندنا العكس حاليًا في المفهوم (BOM على Job Order). **المطابقة تعني:** Work Order بشروط ERPNext حرفيًا؛ وميزة "BOM على Job Order" ترجع في المرحلة الثانية كإضافة واضحة.
3. **Job Card = production_step عندنا** — يلزم إضافة: `Time Logs` (جدول فترات)، `Process Loss Qty`، `Allow Overproduction + Percentage`، `Workstation Type`، `Parent Job Card`، `Operator`/`Employee`.
4. **Operation و Workstation Type مستندان جديدان كليًا عندنا** (مطلوبان لأن BOM Operations وJob Card يعتمدان عليهما).
5. **التسلسلات الرسمية في Manufacturing:** `MFG-WO-.YYYY.-.#####` (Work Order) · `MFG-JC-.YYYY.-.#####` (Job Card) — تُثبَّت في Document Naming كما وثّقنا في Buying.
6. **Production Plan عند ERPNext يستقبل من 3 مصادر:** Sales Orders / Material Requests / Sales Forecast — ويولّد: Work Orders + Material Requests — **دورة تخطيط كاملة مفقودة عندنا يجب بناؤها في المرحلة ٥**.
7. **Master Production Schedule وSales Forecast وForecasting** ثلاثية تخطيط الطلب — غير موجودة عندنا إطلاقًا، وتُبنى كاملة (MPS مستند، Sales Forecast مستند، Forecasting تقرير بمحرك التمهيد الأسي).
8. **Downtime Entry + تقرير Downtime Analysis** — جديدان كليًا عندنا، بسيطان التنفيذ (مستند + تقرير تجميعي).
9. **تقرير Work Order Consumed Materials هو نظير رقابة الانحراف عندنا** (يقارن المصروف الفعلي بالـBOM مع فلتر "Excess Materials Consumed") — عندنا هذا السلوك مدمج في جوهر النظام (رقابة الكميات الأربع) وهو أقوى، لكن الشاشة نفسها لازم تظهر مطابقة في المرحلة الأولى.
10. **الصفحة الرئيسية للموديول:** KPIs + 3 رسوم بيانية + زر Create BOM — نمط الصفحة الرئيسية نفسه الموثق في Buying (Dashboard بالأرقام + رسوم).

---

## 14. سجل اللقطات (50 لقطة — mapping سريع)

| الملف (بعد `erpnext-dch-zpe.k.frappe.cloud-desk-`) | الشاشة |
|---|---|
| `manufacturing.png`, `manufacturing1.png` | الصفحة الرئيسية للموديول (Dashboard View — All Manufactoring Data) |
| `bom.png` | قائمة BOM |
| `bom-new-bom-tzqrfduhkh{,1,2}.png` | New BOM — التابات الثلاثة (Production Item / BOM Configuration / More Info) |
| `bom-creator.png` | قائمة BOM Creator |
| `bom-creator-new-bom-cre{,1,2,3,4}.png` | BOM Creator جديد — الرأس وشجرة BOM Tree وتاباتها |
| `bom-update-tool-BOM_20U.png` | BOM Update Tool |
| `work-order.png` | قائمة Work Order |
| `work-order-new-work-ord{,1,2,4}.png` | Work Order جديد — تابات Materials / More Info / Progress |
| `job-card.png` | قائمة Job Card |
| `job-card-new-job-card-f{,1,2,3,4}.png` | Job Card جديد — Details / Time Logs / Raw Materials |
| `stock-entry.png` | قائمة Stock Entry |
| `item-lead-time.png` | قائمة Item Lead Time |
| `item-lead-time-new-item{,1,2}.png` | Item Lead Time جديد — Manufacturing Time / Purchase Time / Item Details |
| `production-plan.png` | قائمة Production Plan |
| `production-plan-new-pro.png` | Production Plan جديد (الشاشة الأغنى — كل الجداول) |
| `master-production-sched{,1,2}.png` | Master Production Schedule — القائمة + المستند |
| `sales-forecast.png`, `sales-forecast-new-sale.png` | Sales Forecast — القائمة + المستند |
| `downtime-entry{,1}.png` | Downtime Entry — القائمة + المستند |
| `query-report-BOM_20Oper.png` | تقرير BOM Operations Time |
| `query-report-BOM_20Sear.png` | تقرير BOM Search |
| `query-report-Downtime_2.png` | تقرير Downtime Analysis |
| `query-report-Exponentia.png` | تقرير Exponential Smoothing Forecasting |
| `query-report-Job_20Card.png` | تقرير Job Card Summary |
| `query-report-Production.png` | تقرير Production Planning Report |
| `query-report-Production1.png` | تقرير Production Analytics |
| `query-report-Quality_20.png` | تقرير Quality Inspection Summary |
| `query-report-Work_20Ord.png` | تقرير Work Order Summary |
| `query-report-Work_20Ord1.png` | تقرير Work Order Consumed Materials |
