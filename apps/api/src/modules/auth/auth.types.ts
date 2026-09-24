export type RoleStatus = 'active' | 'inactive';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve';
export type UserStatus = 'active' | 'inactive' | 'locked';

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  status: RoleStatus;
}
export interface CreateRoleInput {
  code: string;
  name: string;
}

export interface PermissionRecord {
  id: string;
  roleId: string;
  action: PermissionAction;
  resource: string;
  scopeOrgNodeId: string | null;
  valueLimit: string | null;
}
export interface CreatePermissionInput {
  roleId: string;
  action: PermissionAction;
  resource: string;
  scopeOrgNodeId?: string;
  valueLimit?: string;
}

export interface UserRecord {
  id: string;
  username: string;
  roleId: string;
  employeeReference: string | null;
  status: UserStatus;
}
export interface CreateUserInput {
  username: string;
  password: string;
  roleId: string;
  employeeReference?: string;
}

export type UserPermissionAllowType = 'org_node' | 'warehouse';
export interface UserPermissionRecord {
  id: string;
  userId: string;
  allowType: UserPermissionAllowType;
  allowValue: string;
  createdAt: string;
}
export interface CreateUserPermissionInput {
  userId: string;
  allowType: UserPermissionAllowType;
  allowValue: string;
}
