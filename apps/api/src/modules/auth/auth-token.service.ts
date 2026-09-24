import { randomBytes } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../core/config/app-config.service';
import { AuthRepository } from './auth.repository';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import type { UserRecord } from './auth.types';

interface AccessTokenClaims {
  sub: string;
  username: string;
}

/**
 * Issues and verifies login tokens (plan item 5.0). A token only carries the user id;
 * the user and role are re-read on every request, so a deactivated user is locked out
 * immediately instead of when the token expires.
 */
@Injectable()
export class AuthTokenService {
  private readonly logger = new Logger(AuthTokenService.name);
  private readonly jwt: JwtService;

  constructor(
    private readonly config: AppConfigService,
    private readonly repository: AuthRepository,
  ) {
    let secret = config.authJwtSecret;
    if (!secret) {
      secret = randomBytes(48).toString('hex');
      this.logger.warn(
        'AUTH_JWT_SECRET is not set: using a random per-process secret (tokens end on restart)',
      );
    }
    this.jwt = new JwtService({ secret, signOptions: { expiresIn: config.authTokenTtlSeconds } });
  }

  get ttlSeconds(): number {
    return this.config.authTokenTtlSeconds;
  }

  async issue(user: UserRecord): Promise<string> {
    const claims: AccessTokenClaims = { sub: user.id, username: user.username };
    return this.jwt.signAsync(claims);
  }

  async resolveUser(token: string): Promise<CurrentUserPayload & { roleId: string }> {
    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token);
    } catch {
      throw new UnauthorizedException('جلسة الدخول غير صالحة أو منتهية — سجّل الدخول مرة أخرى');
    }
    const user = await this.repository.findUserById(claims.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('حساب المستخدم غير موجود أو غير نشط');
    }
    const role = await this.repository.findRoleById(user.roleId);
    const roleCode = role && role.status === 'active' ? role.code : '';
    return {
      id: user.id,
      email: '',
      name: user.username,
      role: roleCode,
      roles: roleCode ? [roleCode] : [],
      permissions: [],
      roleId: user.roleId,
    };
  }
}
