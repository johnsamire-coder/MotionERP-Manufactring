import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuthNotFoundError, AuthValidationError } from './auth.errors';
import { AuthRepository } from './auth.repository';
import type {
  CreateUserPermissionInput,
  UserPermissionAllowType,
  UserPermissionRecord,
} from './auth.types';

const ALLOW_TYPES: readonly UserPermissionAllowType[] = ['org_node', 'warehouse'];

/** Per-user restrictions (plan item 5.1): which org nodes / warehouses one user may work with. */
@Injectable()
export class UserPermissionService {
  constructor(private readonly repository: AuthRepository) {}

  async list(userId?: string): Promise<UserPermissionRecord[]> {
    return this.repository.listUserPermissions(userId);
  }

  async add(input: CreateUserPermissionInput): Promise<UserPermissionRecord> {
    if (!ALLOW_TYPES.includes(input.allowType)) {
      throw new AuthValidationError(`allowType must be one of: ${ALLOW_TYPES.join(', ')}`);
    }
    const user = await this.repository.findUserById(input.userId);
    if (!user) throw new AuthNotFoundError(`user ${input.userId} does not exist`);

    const exists =
      input.allowType === 'org_node'
        ? await this.repository.orgNodeExists(input.allowValue)
        : await this.repository.warehouseExists(input.allowValue);
    if (!exists) {
      throw new AuthNotFoundError(
        `${input.allowType === 'org_node' ? 'org node' : 'warehouse'} ${input.allowValue} does not exist`,
      );
    }

    const duplicate = await this.repository.findUserPermission(
      input.userId,
      input.allowType,
      input.allowValue,
    );
    if (duplicate) throw new AuthValidationError('this restriction already exists for the user');

    return this.repository.insertUserPermission({ ...input, id: randomUUID() });
  }

  async remove(id: string): Promise<void> {
    const found = await this.repository.findUserPermissionById(id);
    if (!found) throw new AuthNotFoundError(`user permission ${id} does not exist`);
    await this.repository.deleteUserPermission(id);
  }

  /**
   * The raw restrictions of a user, grouped by dimension. `null` = unrestricted on that
   * dimension. Expanding org nodes to their subtree is left to the enforcing module (5.2).
   */
  async getRestrictions(
    userId: string,
  ): Promise<{ orgNodeIds: string[] | null; warehouseIds: string[] | null }> {
    const rows = await this.repository.listUserPermissions(userId);
    const pick = (type: UserPermissionAllowType): string[] | null => {
      const values = rows.filter((r) => r.allowType === type).map((r) => r.allowValue);
      return values.length > 0 ? values : null;
    };
    return { orgNodeIds: pick('org_node'), warehouseIds: pick('warehouse') };
  }
}
