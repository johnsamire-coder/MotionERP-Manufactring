import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Requests that change nothing worth auditing (login, reads done by POST, the log itself). */
const SKIP = [/\/auth\/login$/, /\/audit\//, /\/auth\/check-permission$/, /\/health/];
const SECRET = /pass(word)?|secret|token/i;
const MAX_JSON = 4000;

export interface AuditDescription {
  entityName: string;
  entityId: string;
  action: string;
  newValues: string | null;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET.test(k) ? '***' : redact(v),
      ]),
    );
  return value;
}

/** The id of what was created or changed: the :id route param, else the first `id` in the response. */
function findId(params: Record<string, string>, response: unknown): string {
  if (params.id) return params.id;
  const firstParam = Object.values(params)[0];
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): string | null => {
    if (!v || typeof v !== 'object' || depth > 2 || seen.has(v)) return null;
    seen.add(v);
    const o = v as Record<string, unknown>;
    if (typeof o.id === 'string') return o.id;
    for (const child of Object.values(o)) {
      const found = walk(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(response, 0) ?? firstParam ?? '—';
}

/**
 * What a successful change was, from the route alone:
 * POST /crm/contacts → crm/contacts CREATE; POST /crm/contacts/:id/links → crm/contacts LINKS;
 * PATCH /crm/contacts/:id → UPDATE; DELETE → DELETE. Secrets in the body are masked.
 */
export function describeRequest(
  method: string,
  routePath: string,
  params: Record<string, string>,
  body: unknown,
  response: unknown,
): AuditDescription {
  const segments = routePath
    .replace(/^\/?api\/v\d+\//, '')
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean);
  const firstParam = segments.findIndex((s) => s.startsWith(':'));
  const resource = (firstParam === -1 ? segments : segments.slice(0, firstParam)).filter(
    (s) => !s.startsWith(':'),
  );
  const afterParam =
    firstParam === -1 ? [] : segments.slice(firstParam + 1).filter((s) => !s.startsWith(':'));
  let action: string;
  if (method === 'DELETE') action = 'DELETE';
  else if (method === 'PATCH' || method === 'PUT') action = 'UPDATE';
  else if (afterParam.length) action = afterParam.join('_').toUpperCase().replace(/-/g, '_');
  else action = 'CREATE';
  // "POST crm/leads/convert" style (verb as the last segment, no :id) keeps the verb as the action.
  const entityName = resource.join('/') || routePath;
  const json = body && Object.keys(body as object).length ? JSON.stringify(redact(body)) : null;
  return {
    entityName,
    entityId: findId(params, response),
    action,
    newValues: json && json.length > MAX_JSON ? `${json.slice(0, MAX_JSON)}…` : json,
  };
}

interface AuditedRequest {
  method: string;
  originalUrl?: string;
  url: string;
  route?: { path?: string };
  params: Record<string, string>;
  body: unknown;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string; name?: string };
}

/**
 * Every successful change through the API lands in audit.audit_log with who, when, from where and
 * the submitted values. Logging never blocks or fails the request itself.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuditedRequest>();
    const url = req.originalUrl ?? req.url;
    if (!MUTATING.has(req.method) || SKIP.some((r) => r.test(url.split('?')[0]!)))
      return next.handle();
    return next.handle().pipe(
      tap((response) => {
        const d = describeRequest(
          req.method,
          req.route?.path ?? url,
          req.params,
          req.body,
          response,
        );
        const ua = req.headers['user-agent'];
        this.audit
          .logAction({
            ...d,
            newValues: d.newValues ?? undefined,
            performedBy: req.user?.id,
            performedByName: req.user?.name,
            ipAddress: req.ip,
            userAgent: Array.isArray(ua) ? ua[0] : ua,
            details: `${req.method} ${url.split('?')[0]}`,
          })
          .catch((err: unknown) =>
            this.logger.warn(`audit log not written: ${(err as Error).message}`),
          );
      }),
    );
  }
}
