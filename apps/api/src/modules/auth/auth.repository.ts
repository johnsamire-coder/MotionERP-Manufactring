import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { permission, role, user } from './auth.schema';
import type {
  CreatePermissionInput, CreateRoleInput, PermissionAction, PermissionRecord,
  RoleRecord, RoleStatus, UserRecord, UserStatus,
} from './auth.types';

const roleColumns = { id: role.id, code: role.code, name: role.name, status: role.status };
const permColumns = {
  id: permission.id, roleId: permission.roleId, action: permission.action, resource: permission.resource,
  scopeOrgNodeId: permission.scopeOrgNodeId, valueLimit: permission.valueLimit,
};
const userColumns = { id: user.id, username: user.username, roleId: user.roleId, employeeReference: user.employeeReference, status: user.status };
const userWithPasswordColumns = { ...userColumns, passwordHash: user.passwordHash };

interface RoleRow { id: string; code: string; name: string; status: string; }
interface PermRow { id: string; roleId: string; action: string; resource: string; scopeOrgNodeId: string | null; valueLimit: string | null; }
interface UserRow { id: string; username: string; roleId: string; employeeReference: string | null; status: string; }
interface UserWithPasswordRow extends UserRow { passwordHash: string; }

function toRoleRecord(row: RoleRow): RoleRecord { return { id: row.id, code: row.code, name: row.name, status: row.status as RoleStatus }; }
function toPermRecord(row: PermRow): PermissionRecord {
  return { id: row.id, roleId: row.roleId, action: row.action as PermissionAction, resource: row.resource, scopeOrgNodeId: row.scopeOrgNodeId, valueLimit: row.valueLimit };
}
function toUserRecord(row: UserRow): UserRecord { return { id: row.id, username: row.username, roleId: row.roleId, employeeReference: row.employeeReference, status: row.status as UserStatus }; }

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  async listRoles(): Promise<RoleRecord[]> {
    const rows = await this.database.db.select(roleColumns).from(role).orderBy(asc(role.code));
    return rows.map(toRoleRecord);
  }
  async findRoleById(id: string): Promise<RoleRecord | null> {
    const rows = await this.database.db.select(roleColumns).from(role).where(eq(role.id, id)).limit(1);
    return rows[0] ? toRoleRecord(rows[0]) : null;
  }
  async findRoleByCode(code: string): Promise<RoleRecord | null> {
    const rows = await this.database.db.select(roleColumns).from(role).where(eq(role.code, code)).limit(1);
    return rows[0] ? toRoleRecord(rows[0]) : null;
  }
  async insertRole(input: CreateRoleInput & { id: string }): Promise<RoleRecord> {
    const rows = await this.database.db.insert(role).values(input).returning(roleColumns);
    return toRoleRecord(rows[0]!);
  }

  async listPermissions(roleId?: string): Promise<PermissionRecord[]> {
    const rows = roleId
      ? await this.database.db.select(permColumns).from(permission).where(eq(permission.roleId, roleId))
      : await this.database.db.select(permColumns).from(permission);
    return rows.map(toPermRecord);
  }
  async insertPermission(input: CreatePermissionInput & { id: string }): Promise<PermissionRecord> {
    const rows = await this.database.db.insert(permission).values({
      id: input.id, roleId: input.roleId, action: input.action, resource: input.resource,
      scopeOrgNodeId: input.scopeOrgNodeId ?? null, valueLimit: input.valueLimit ?? null,
    }).returning(permColumns);
    return toPermRecord(rows[0]!);
  }
  /** Checks whether a role has a permission for (action, resource), optionally scoped to a specific org node. */
  async findMatchingPermission(roleId: string, action: string, resource: string, scopeOrgNodeId?: string): Promise<PermissionRecord | null> {
    const rows = await this.database.db.select(permColumns).from(permission)
      .where(and(eq(permission.roleId, roleId), eq(permission.action, action), eq(permission.resource, resource)));
    const matches = rows.map(toPermRecord);
    if (scopeOrgNodeId) {
      const scoped = matches.find((p) => p.scopeOrgNodeId === scopeOrgNodeId);
      if (scoped) return scoped;
    }
    return matches.find((p) => p.scopeOrgNodeId === null) ?? null;
  }

  async listUsers(): Promise<UserRecord[]> {
    const rows = await this.database.db.select(userColumns).from(user).orderBy(asc(user.username));
    return rows.map(toUserRecord);
  }
  async findUserById(id: string): Promise<UserRecord | null> {
    const rows = await this.database.db.select(userColumns).from(user).where(eq(user.id, id)).limit(1);
    return rows[0] ? toUserRecord(rows[0]) : null;
  }
  async findUserByUsername(username: string): Promise<UserRecord | null> {
    const rows = await this.database.db.select(userColumns).from(user).where(eq(user.username, username)).limit(1);
    return rows[0] ? toUserRecord(rows[0]) : null;
  }
  async findUserWithPasswordByUsername(username: string): Promise<UserWithPasswordRow | null> {
    const rows = await this.database.db.select(userWithPasswordColumns).from(user).where(eq(user.username, username)).limit(1);
    return rows[0] ?? null;
  }
  async insertUser(input: { id: string; username: string; passwordHash: string; roleId: string; employeeReference?: string }): Promise<UserRecord> {
    const rows = await this.database.db.insert(user).values({
      id: input.id, username: input.username, passwordHash: input.passwordHash,
      roleId: input.roleId, employeeReference: input.employeeReference ?? null,
    }).returning(userColumns);
    return toUserRecord(rows[0]!);
  }
}
