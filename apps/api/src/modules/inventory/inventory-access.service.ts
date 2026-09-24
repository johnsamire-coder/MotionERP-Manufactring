import { Injectable } from '@nestjs/common';
import { requestContext } from '../../core/request-context/request-context';
import { UserPermissionService } from '../auth/user-permission.service';
import { OrganizationService } from '../organization/organization.service';
import type { OrgTreeNode } from '../organization/organization.types';
import { InventoryForbiddenError } from './inventory.errors';
import { InventoryRepository } from './inventory.repository';

/**
 * Applies the logged-in user's restrictions (plan items 5.1/5.2) to inventory.
 * - No logged-in user (anonymous while AUTH_ENFORCE is off, or internal calls) → unrestricted.
 * - Warehouse restriction → only those warehouses.
 * - Org node restriction → only warehouses whose org node is that node or anywhere under it.
 * - Both → a warehouse must satisfy both (same as ERPNext combining different fields).
 */
@Injectable()
export class InventoryAccessService {
  constructor(
    private readonly userPermissions: UserPermissionService,
    private readonly organization: OrganizationService,
    private readonly repository: InventoryRepository,
  ) {}

  /** Allowed warehouse ids for the current user, or null when unrestricted. */
  async allowedWarehouseIds(): Promise<Set<string> | null> {
    const scope = await this.scope();
    if (!scope) return null;
    const warehouses = await this.repository.listWarehouses();
    return new Set(
      warehouses.filter((w) => this.warehouseInScope(scope, w.id, w.orgNodeId)).map((w) => w.id),
    );
  }

  async assertWarehouseAllowed(warehouseId: string): Promise<void> {
    const allowed = await this.allowedWarehouseIds();
    if (allowed && !allowed.has(warehouseId)) {
      throw new InventoryForbiddenError(
        'غير مسموح لك بالعمل على هذا المخزن (مقيّد بصلاحيات المستخدم)',
      );
    }
  }

  /** A new warehouse must sit inside the user's allowed org nodes; warehouse-restricted users cannot create more. */
  async assertCanCreateWarehouse(orgNodeId: string): Promise<void> {
    const scope = await this.scope();
    if (!scope) return;
    if (scope.warehouseIds) {
      throw new InventoryForbiddenError('المستخدم مقيّد بمخازن محددة ولا يمكنه إنشاء مخازن جديدة');
    }
    if (scope.orgNodeIds && !scope.orgNodeIds.has(orgNodeId)) {
      throw new InventoryForbiddenError(
        'غير مسموح لك بإنشاء مخزن تحت هذا الفرع (مقيّد بصلاحيات المستخدم)',
      );
    }
  }

  private warehouseInScope(
    scope: { warehouseIds: Set<string> | null; orgNodeIds: Set<string> | null },
    warehouseId: string,
    orgNodeId: string,
  ): boolean {
    if (scope.warehouseIds && !scope.warehouseIds.has(warehouseId)) return false;
    if (scope.orgNodeIds && !scope.orgNodeIds.has(orgNodeId)) return false;
    return true;
  }

  /** Current user's restrictions with org nodes expanded to their whole subtree; null = unrestricted. */
  private async scope(): Promise<{
    warehouseIds: Set<string> | null;
    orgNodeIds: Set<string> | null;
  } | null> {
    const userId = requestContext.currentUserId();
    if (!userId) return null;
    const restrictions = await this.userPermissions.getRestrictions(userId);
    if (!restrictions.orgNodeIds && !restrictions.warehouseIds) return null;

    let orgNodeIds: Set<string> | null = null;
    if (restrictions.orgNodeIds) {
      const roots = new Set(restrictions.orgNodeIds);
      orgNodeIds = new Set<string>();
      const walk = (nodes: OrgTreeNode[], inside: boolean): void => {
        for (const node of nodes) {
          const nodeInside = inside || roots.has(node.id);
          if (nodeInside) orgNodeIds!.add(node.id);
          walk(node.children, nodeInside);
        }
      };
      walk(await this.organization.getTree(), false);
    }
    return {
      warehouseIds: restrictions.warehouseIds ? new Set(restrictions.warehouseIds) : null,
      orgNodeIds,
    };
  }
}
