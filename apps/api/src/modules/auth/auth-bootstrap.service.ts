import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { AppConfigService } from '../../core/config/app-config.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

export const ADMIN_ROLE_CODE = 'admin';

/**
 * Plan item 5.3: with login enforced, a fresh database needs one account to start from.
 * AUTH_BOOTSTRAP_USERNAME / AUTH_BOOTSTRAP_PASSWORD create it (with an "admin" role) when that
 * username does not exist yet; an existing user is never touched, so the password can be changed.
 */
@Injectable()
export class AuthBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthBootstrapService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly auth: AuthService,
    private readonly repository: AuthRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const admin = this.config.authBootstrapAdmin;
    if (!admin) {
      if (this.config.authEnforce && (await this.auth.getUsers()).length === 0)
        this.logger.warn(
          'AUTH_ENFORCE is on and there are no users: set AUTH_BOOTSTRAP_USERNAME/PASSWORD to create the first administrator',
        );
      return;
    }
    try {
      await this.ensureAdmin(admin.username, admin.password);
    } catch (err) {
      this.logger.error(`could not create the bootstrap administrator: ${(err as Error).message}`);
    }
  }

  /** Creates the administrator (and the admin role) unless the username exists. Returns true when created. */
  async ensureAdmin(username: string, password: string): Promise<boolean> {
    if (await this.repository.findUserByUsername(username.trim().toLowerCase())) return false;
    const role =
      (await this.repository.findRoleByCode(ADMIN_ROLE_CODE)) ??
      (await this.auth.createRole({ code: ADMIN_ROLE_CODE, name: 'مدير النظام' }));
    await this.auth.createUser({ username, password, roleId: role.id });
    this.logger.log(`created the bootstrap administrator "${username}"`);
    return true;
  }
}
