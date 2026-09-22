// ============================================================
// Motion ERP — RBAC Permissions Service
// Step 95 | Role-Based Access Control Matrix
// ============================================================
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { UpdateRolePermissionsDto, AssignUserRoleDto } from './rbac.dto';

export interface RoleMatrixItem {
  id: string;
  code: string;
  name: string;
  description: string;
  usersCount: number;
  permissions: string[];
}

@Injectable()
export class RbacService {
  constructor(@Inject('DRIZZLE') private readonly db: any) {}

  // ── قائمة الصلاحيات القياسية للمصنع ──
  getAllSystemPermissions() {
    return [
      { module: 'accounting', code: 'acc:view', name: 'استعراض الدفاتر والتقارير المالية' },
      { module: 'accounting', code: 'acc:post', name: 'ترحيل واعتماد قيود اليومية' },
      { module: 'accounting', code: 'acc:close', name: 'إقفال الفترات والسنوات المالية' },
      { module: 'tax', code: 'tax:settle', name: 'تسوية ضريبة القيمة المضافة ونموذج 41' },
      { module: 'costing', code: 'cost:view', name: 'استعراض كروت التكلفة والربحية' },
      { module: 'costing', code: 'cost:edit', name: 'تعديل المعايير وتوزيع الـ Overhead' },
      { module: 'inventory', code: 'inv:view', name: 'استعراض الأرصدة والسجل المالي' },
      { module: 'inventory', code: 'inv:trans', name: 'تنفيذ حركات الصرف والاستلام والجرد' },
      { module: 'production', code: 'prod:wo', name: 'إصدار أوامر الشغل وبطاقات العمل' },
      { module: 'production', code: 'prod:time', name: 'تسجيل أزمنة الماكينات والتشغيل' },
      { module: 'quality', code: 'qc:inspect', name: 'إجراء الفحص الطبي والحجر الصحي' },
      { module: 'quality', code: 'qc:recall', name: 'إطلاق أوامر الاستدعاء الطبي السريع' },
      { module: 'sales', code: 'sales:manage', name: 'إدارة العملاء وفواتير المبيعات' },
      { module: 'admin', code: 'admin:audit', name: 'استعراض سجل التدقيق الرقابي (Audit)' },
    ];
  }

  // ── جلب مصفوفة الأدوار بالكامل ──
  async getRolesMatrix(): Promise<RoleMatrixItem[]> {
    return [
      {
        id: 'r-super-admin',
        code: 'SUPER_ADMIN',
        name: 'مدير النظام الشامل',
        description: 'كامل الصلاحيات الفنية والإدارية والرقابية للنظام',
        usersCount: 2,
        permissions: this.getAllSystemPermissions().map((p) => p.code),
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
        name: 'مدير الإنتاج والمصنع',
        description: 'أوامر الشغل، صالة تشكيل الصاج، وأزمنة الماكينات',
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
    ];
  }

  // ── تحديث صلاحيات دور وظيفي ──
  async updateRolePermissions(dto: UpdateRolePermissionsDto, userId: string) {
    return {
      roleId: dto.roleId,
      roleName: dto.roleName,
      updatedPermissionsCount: dto.permissions.length,
      permissions: dto.permissions,
      updatedBy: userId,
      updatedAt: new Date(),
      status: 'permissions_synced',
    };
  }

  // ── تعيين دور لمستخدم ──
  async assignRoleToUser(dto: AssignUserRoleDto, adminUserId: string) {
    return {
      userId: dto.userId,
      roleId: dto.roleId,
      assignedBy: adminUserId,
      assignedAt: new Date(),
      status: 'role_assigned',
    };
  }
}