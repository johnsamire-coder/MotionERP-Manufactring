import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Key,
  Check,
  X,
  Save,
  Printer,
  Search,
  Lock,
  Building,
  Factory,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface PermissionItem {
  module: string;
  code: string;
  name: string;
}

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description: string;
  usersCount: number;
  permissions: string[];
}

export const RbacPermissionsPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<string>('r-finance-dir');
  const [searchTerm, setSearchTerm] = useState('');
  const [savedAlert, setSavedAlert] = useState(false);

  const permissionsList: PermissionItem[] = [
    { module: 'المحاسبة العامة', code: 'acc:view', name: 'استعراض الدفاتر والتقارير المالية' },
    { module: 'المحاسبة العامة', code: 'acc:post', name: 'ترحيل واعتماد قيود اليومية' },
    { module: 'المحاسبة العامة', code: 'acc:close', name: 'إقفال الفترات والسنوات المالية' },
    { module: 'الضرائب والجمارك', code: 'tax:settle', name: 'تسوية ضريبة القيمة المضافة ونموذج 41' },
    { module: 'التكاليف الصناعية', code: 'cost:view', name: 'استعراض كروت التكلفة والربحية' },
    { module: 'التكاليف الصناعية', code: 'cost:edit', name: 'تعديل المعايير وتوزيع الـ Overhead' },
    { module: 'إدارة المخازن', code: 'inv:view', name: 'استعراض الأرصدة والسجل المالي' },
    { module: 'إدارة المخازن', code: 'inv:trans', name: 'تنفيذ حركات الصرف والاستلام والجرد' },
    { module: 'صالة الإنتاج', code: 'prod:wo', name: 'إصدار أوامر الشغل وبطاقات العمل' },
    { module: 'صالة الإنتاج', code: 'prod:time', name: 'تسجيل أزمنة الماكينات والتشغيل' },
    { module: 'الجودة الطبية', code: 'qc:inspect', name: 'إجراء الفحص الطبي والحجر الصحي' },
    { module: 'الجودة الطبية', code: 'qc:recall', name: 'إطلاق أوامر الاستدعاء الطبي السريع' },
    { module: 'إدارة المبيعات', code: 'sales:manage', name: 'إدارة العملاء وفواتير المبيعات والضمان' },
    { module: 'الرقابة والأمان', code: 'admin:audit', name: 'استعراض سجل التدقيق الرقابي (Audit)' },
  ];

  const [roles, setRoles] = useState<RoleItem[]>([
    {
      id: 'r-super-admin',
      code: 'SUPER_ADMIN',
      name: 'مدير النظام الشامل',
      description: 'كامل الصلاحيات الفنية والإدارية والرقابية للنظام',
      usersCount: 2,
      permissions: permissionsList.map((p) => p.code),
    },
    {
      id: 'r-finance-dir',
      code: 'FINANCIAL_MANAGER',
      name: 'المدير المالي والمحاسب القانوني',
      description: 'إدارة الدفاتر المحاسبية، الضرائب، الإقفالات، وسندات الصرف',
      usersCount: 3,
      permissions: ['acc:view', 'acc:post', 'acc:close', 'tax:settle', 'cost:view', 'inv:view', 'admin:audit'],
    },
    {
      id: 'r-cost-acc',
      code: 'COST_ACCOUNTANT',
      name: 'محاسب التكاليف الصناعية',
      description: 'متابعة كروت التكلفة، انحرافات الصاج، وتوزيع الـ Overhead',
      usersCount: 2,
      permissions: ['cost:view', 'cost:edit', 'prod:time', 'inv:view', 'acc:view'],
    },
    {
      id: 'r-prod-mgr',
      code: 'PRODUCTION_MANAGER',
      name: 'مدير الإنتاج وصالة تشكيل الصاج',
      description: 'أوامر الشغل، أزمنة الماكينات، وصرف عهدة الخامات',
      usersCount: 4,
      permissions: ['prod:wo', 'prod:time', 'inv:view', 'cost:view', 'qc:inspect'],
    },
    {
      id: 'r-qc-eng',
      code: 'QUALITY_INSPECTOR',
      name: 'مهندس الجودة والامتثال الطبي',
      description: 'فحص الخامات الطبية، الحجر الصحي، والاستدعاء الطبي ISO 13485',
      usersCount: 2,
      permissions: ['qc:inspect', 'qc:recall', 'inv:view', 'prod:wo'],
    },
    {
      id: 'r-storekeeper',
      code: 'INVENTORY_STOREKEEPER',
      name: 'أمين مخازن الصاج والمستلزمات',
      description: 'تسجيل اللوطات، أذون الصرف للتشغيل، والجرد الفعلي',
      usersCount: 5,
      permissions: ['inv:view', 'inv:trans', 'prod:wo'],
    },
    {
      id: 'r-sales-rep',
      code: 'SALES_EXECUTIVE',
      name: 'مسؤول المبيعات والمستشفيات',
      description: 'عروض الأسعار، أوامر البيع، وتخصيص السيريالات والضمان',
      usersCount: 6,
      permissions: ['sales:manage', 'cost:view', 'inv:view'],
    },
  ]);

  const currentRole: RoleItem = roles.find((r) => r.id === selectedRole) || roles[0]!;

  const handleTogglePermission = (permCode: string) => {
    if (currentRole.code === 'SUPER_ADMIN') return; // مدير النظام دائماً كامل الصلاحيات

    setRoles((prev) =>
      prev.map((r) => {
        if (r.id === currentRole.id) {
          const hasPerm = r.permissions.includes(permCode);
          const newPerms = hasPerm
            ? r.permissions.filter((p) => p !== permCode)
            : [...r.permissions, permCode];
          return { ...r, permissions: newPerms };
        }
        return r;
      })
    );
  };

  const handleSaveMatrix = () => {
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  const filteredPermissions = permissionsList.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.module.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
            <Key className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">مصفوفة الصلاحيات والتحكم بالأدوار (RBAC Matrix)</h1>
            <p className="text-sm text-slate-500">
              تحديد الصلاحيات الدقيقة لكل دور وظيفي وفصل المهام الرقابية بين الإدارات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedAlert && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> تم حفظ الصلاحيات بنجاح
            </span>
          )}
          <button
            onClick={handleSaveMatrix}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow transition cursor-pointer"
          >
            <Save className="w-4 h-4" /> حفظ التغييرات
          </button>
        </div>
      </div>

      {/* ── المحتوى المقسم ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── 1. قائمة الأدوار الوظيفية (Sidebar) ── */}
        <div className="lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">الأدوار الوظيفية</h3>
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={`w-full text-right p-3.5 rounded-xl transition flex flex-col gap-1 border ${
                selectedRole === r.id
                  ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                  : 'bg-white border-transparent hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">{r.name}</span>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                  {r.usersCount} موظف
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-snug">{r.description}</p>
            </button>
          ))}
        </div>

        {/* ── 2. مصفوفة الصلاحيات (Permissions Matrix) ── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-lg">صلاحيات: {currentRole.name}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ممنوح له ({currentRole.permissions.length}) من أصل ({permissionsList.length}) صلاحية بالنظام
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في الصلاحيات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">الموديول</th>
                  <th className="p-4">كود الصلاحية</th>
                  <th className="p-4">بيان الصلاحية</th>
                  <th className="p-4 text-center">الحالة والمنح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPermissions.map((p) => {
                  const isGranted = currentRole.permissions.includes(p.code);
                  return (
                    <tr
                      key={p.code}
                      onClick={() => handleTogglePermission(p.code)}
                      className={`hover:bg-slate-50/80 transition cursor-pointer ${
                        isGranted ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <td className="p-4 font-semibold text-slate-800">{p.module}</td>
                      <td className="p-4 font-mono text-xs text-indigo-700 font-bold">{p.code}</td>
                      <td className="p-4 text-slate-700">{p.name}</td>
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isGranted}
                          onChange={() => handleTogglePermission(p.code)}
                          disabled={currentRole.code === 'SUPER_ADMIN'}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RbacPermissionsPage;