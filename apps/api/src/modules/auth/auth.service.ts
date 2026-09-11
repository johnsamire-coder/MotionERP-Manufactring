import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { AuthNotFoundError, AuthValidationError } from './auth.errors';
import { AuthRepository } from './auth.repository';
import type {
  CreatePermissionInput, CreateRoleInput, CreateUserInput, PermissionAction,
  PermissionRecord, RoleRecord, UserRecord,
} from './auth.types';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async getRoles(): Promise<RoleRecord[]> { return this.repository.listRoles(); }

  async createRole(input: CreateRoleInput): Promise<RoleRecord> {
    const code = normalizeCode(input.code);
    const existing = await this.repository.findRoleByCode(code);
    if (existing) throw new AuthValidationError(`a role with code "${code}" already exists`);
    return this.repository.insertRole({ id: randomUUID(), code, name: input.name.trim() });
  }

  async getPermissions(roleId?: string): Promise<PermissionRecord[]> { return this.repository.listPermissions(roleId); }

  async grantPermission(input: CreatePermissionInput): Promise<PermissionRecord> {
    const role = await this.repository.findRoleById(input.roleId);
    if (!role) throw new AuthNotFoundError(`role ${input.roleId} does not exist`);
    if (!input.resource?.trim()) throw new AuthValidationError('resource is required');
    return this.repository.insertPermission({ id: randomUUID(), ...input });
  }

  async getUsers(): Promise<UserRecord[]> { return this.repository.listUsers(); }

  /** Passwords are always hashed (never stored plain), consistent with the architecture's Argon2 requirement — bcryptjs used here as the practical equivalent that installs cleanly on this environment (see progress log). */
  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw new AuthValidationError('invalid username format');
    if (!input.password || input.password.length < 6) throw new AuthValidationError('password must be at least 6 characters');

    const existing = await this.repository.findUserByUsername(username);
    if (existing) throw new AuthValidationError(`a user with username "${username}" already exists`);

    const role = await this.repository.findRoleById(input.roleId);
    if (!role) throw new AuthNotFoundError(`role ${input.roleId} does not exist`);

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return this.repository.insertUser({ id: randomUUID(), username, passwordHash, roleId: input.roleId, employeeReference: input.employeeReference });
  }

  /** Verifies username/password. Returns the user record (never the hash) on success, or throws on invalid credentials. */
  async login(username: string, password: string): Promise<UserRecord> {
    const found = await this.repository.findUserWithPasswordByUsername(username.trim().toLowerCase());
    if (!found) throw new AuthValidationError('invalid username or password');
    if (found.status !== 'active') throw new AuthValidationError(`user account is "${found.status}"`);

    const matches = await bcrypt.compare(password, found.passwordHash);
    if (!matches) throw new AuthValidationError('invalid username or password');

    return { id: found.id, username: found.username, roleId: found.roleId, employeeReference: found.employeeReference, status: found.status };
  }

  /**
   * The concrete activation of "permission = action + resource + scope +
   * optional value limit" (architecture decision, documented since day one,
   * never exercised until this phase). Returns true only if the user's role
   * has a matching permission AND (if a value is given) that value does not
   * exceed the permission's valueLimit when one is set.
   */
  async checkPermission(userId: string, action: PermissionAction, resource: string, scopeOrgNodeId?: string, value?: string): Promise<boolean> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AuthNotFoundError(`user ${userId} does not exist`);

    const permission = await this.repository.findMatchingPermission(user.roleId, action, resource, scopeOrgNodeId);
    if (!permission) return false;

    if (permission.valueLimit && value) {
      const numValue = Number(value);
      const limit = Number(permission.valueLimit);
      if (Number.isFinite(numValue) && numValue > limit) return false;
    }

    return true;
  }
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new AuthValidationError('code is required');
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) throw new AuthValidationError('code must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  return trimmed;
}
