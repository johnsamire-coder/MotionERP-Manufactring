// ============================================================
// Motion ERP — RBAC Permissions Controller
// Step 95 | REST APIs
// ============================================================
import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { UpdateRolePermissionsDto, AssignUserRoleDto } from './rbac.dto';

@Controller({ path: 'auth/rbac', version: '1' })
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('permissions')
  async getAllPermissions() {
    return this.rbacService.getAllSystemPermissions();
  }

  @Get('roles-matrix')
  async getRolesMatrix() {
    return this.rbacService.getRolesMatrix();
  }

  @Post('update-permissions')
  async updateRolePermissions(@Body() dto: UpdateRolePermissionsDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.rbacService.updateRolePermissions(dto, userId);
  }

  @Post('assign-user-role')
  async assignUserRole(@Body() dto: AssignUserRoleDto, @Req() req: any) {
    const userId = req.user?.id || '00000000-0000-0000-0000-000000000001';
    return this.rbacService.assignRoleToUser(dto, userId);
  }
}