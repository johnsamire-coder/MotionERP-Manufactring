import { Injectable, Optional } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { requestContext } from '../../core/request-context/request-context';
import { AuthService } from '../auth/auth.service';
import { WorkflowAutomationService } from './workflow-automation.service';
import { evaluateCondition, validateCondition, type Condition } from './workflow.condition';
import { WorkflowForbiddenError, WorkflowNotFoundError, WorkflowValidationError } from './workflow.errors';
import { workflowDefinition, workflowHistory, workflowInstance, workflowState, workflowTransition } from './workflow.schema';

export interface DefinitionInput {
  code: string; name: string; documentType: string; initialState: string;
  states: Array<{ code: string; name: string; isFinal?: boolean }>;
  transitions: Array<{ fromState: string; toState: string; action: string; allowedRoles?: string[]; condition?: unknown }>;
}
export interface AvailableAction { action: string; toState: string; allowed: boolean; reason: string | null; }
export interface InstanceView {
  id: string; workflowCode: string; documentType: string; documentId: string; currentState: string; isFinal: boolean;
  context: Record<string, unknown>; history: Array<{ fromState: string | null; toState: string; action: string; userId: string | null; comment: string | null; at: string }>;
}

/** Checks a definition's graph (pure): known states, one initial, reachable finals, no duplicate actions. */
export function validateDefinition(d: DefinitionInput): void {
  const codes = new Set(d.states.map((s) => s.code));
  if (codes.size !== d.states.length) throw new WorkflowValidationError('state codes must be unique');
  if (!codes.has(d.initialState)) throw new WorkflowValidationError(`initial state "${d.initialState}" is not one of the states`);
  if (!d.states.some((s) => s.isFinal)) throw new WorkflowValidationError('at least one state must be final');
  const seen = new Set<string>();
  for (const t of d.transitions) {
    if (!codes.has(t.fromState) || !codes.has(t.toState)) throw new WorkflowValidationError(`transition "${t.action}" uses an unknown state`);
    if (t.fromState === t.toState) throw new WorkflowValidationError(`transition "${t.action}" must change the state`);
    if (d.states.find((s) => s.code === t.fromState)?.isFinal) throw new WorkflowValidationError(`final state "${t.fromState}" cannot have outgoing transitions`);
    const key = `${t.fromState}|${t.action}`;
    if (seen.has(key)) throw new WorkflowValidationError(`action "${t.action}" appears twice from state "${t.fromState}"`);
    seen.add(key);
    if (t.condition !== undefined && t.condition !== null) {
      try { validateCondition(t.condition); } catch (err) { throw new WorkflowValidationError(`condition of "${t.action}": ${(err as Error).message}`); }
    }
  }
  // every non-final state must lead somewhere
  for (const s of d.states) {
    if (!s.isFinal && !d.transitions.some((t) => t.fromState === s.code)) throw new WorkflowValidationError(`state "${s.code}" is a dead end (not final, no transitions)`);
  }
}

/** Generic workflow engine (plan item 42). */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly database: DatabaseService,
    @Optional() private readonly auth?: AuthService,
    @Optional() private readonly automation?: WorkflowAutomationService,
  ) {}

  async createDefinition(d: DefinitionInput): Promise<{ id: string }> {
    validateDefinition(d);
    const db = this.database.db;
    if ((await db.select({ id: workflowDefinition.id }).from(workflowDefinition).where(eq(workflowDefinition.code, d.code)).limit(1))[0]) {
      throw new WorkflowValidationError(`workflow "${d.code}" already exists`);
    }
    // one active workflow per document type
    await db.update(workflowDefinition).set({ isActive: false }).where(eq(workflowDefinition.documentType, d.documentType));
    const def = (await db.insert(workflowDefinition).values({ code: d.code, name: d.name, documentType: d.documentType, initialState: d.initialState }).returning())[0]!;
    await db.insert(workflowState).values(d.states.map((s) => ({ workflowId: def.id, code: s.code, name: s.name, isFinal: s.isFinal ?? false })));
    if (d.transitions.length > 0) {
      await db.insert(workflowTransition).values(d.transitions.map((t) => ({
        workflowId: def.id, fromState: t.fromState, toState: t.toState, action: t.action, allowedRoles: t.allowedRoles ?? [], condition: (t.condition ?? null) as object | null,
      })));
    }
    return { id: def.id };
  }

  async listDefinitions(): Promise<Array<typeof workflowDefinition.$inferSelect & { states: Array<typeof workflowState.$inferSelect>; transitions: Array<typeof workflowTransition.$inferSelect> }>> {
    const db = this.database.db;
    const defs = await db.select().from(workflowDefinition).orderBy(asc(workflowDefinition.code));
    return Promise.all(defs.map(async (d) => ({
      ...d,
      states: await db.select().from(workflowState).where(eq(workflowState.workflowId, d.id)),
      transitions: await db.select().from(workflowTransition).where(eq(workflowTransition.workflowId, d.id)),
    })));
  }

  /** Puts a document under the active workflow of its type, in the initial state. */
  async start(documentType: string, documentId: string, context: Record<string, unknown> = {}): Promise<InstanceView> {
    const db = this.database.db;
    const def = (await db.select().from(workflowDefinition).where(and(eq(workflowDefinition.documentType, documentType), eq(workflowDefinition.isActive, true))).limit(1))[0];
    if (!def) throw new WorkflowNotFoundError(`no active workflow for document type "${documentType}"`);
    const existing = (await db.select({ id: workflowInstance.id }).from(workflowInstance).where(and(eq(workflowInstance.documentType, documentType), eq(workflowInstance.documentId, documentId))).limit(1))[0];
    if (existing) throw new WorkflowValidationError(`document ${documentId} is already under a workflow`);
    const inst = (await db.insert(workflowInstance).values({ workflowId: def.id, documentType, documentId, currentState: def.initialState, context }).returning())[0]!;
    await db.insert(workflowHistory).values({ instanceId: inst.id, fromState: null, toState: def.initialState, action: 'start', userId: requestContext.currentUserId() ?? null });
    return this.view(inst.id);
  }

  async findByDocument(documentType: string, documentId: string): Promise<InstanceView> {
    const inst = (await this.database.db.select({ id: workflowInstance.id }).from(workflowInstance)
      .where(and(eq(workflowInstance.documentType, documentType), eq(workflowInstance.documentId, documentId))).limit(1))[0];
    if (!inst) throw new WorkflowNotFoundError(`document ${documentId} is not under a workflow`);
    return this.view(inst.id);
  }

  /** What the current user could do now, and why not when blocked. `context` = the document's latest data (optional). */
  async availableActions(instanceId: string, context?: Record<string, unknown>): Promise<AvailableAction[]> {
    const { inst, transitions } = await this.load(instanceId);
    const data = context ?? inst.context;
    const roles = await this.currentRoles();
    return transitions.filter((t) => t.fromState === inst.currentState).map((t) => {
      const block = this.blockReason(t, roles, data);
      return { action: t.action, toState: t.toState, allowed: block === null, reason: block?.message ?? null };
    });
  }

  /** Takes an action. The document's latest data may be passed so conditions see current values. */
  async act(instanceId: string, action: string, input: { comment?: string; context?: Record<string, unknown> } = {}): Promise<InstanceView> {
    const { inst, transitions, states } = await this.load(instanceId);
    if (states.find((s) => s.code === inst.currentState)?.isFinal) throw new WorkflowValidationError(`المستند في حالة نهائية "${inst.currentState}"`);
    const t = transitions.find((x) => x.fromState === inst.currentState && x.action === action);
    if (!t) throw new WorkflowValidationError(`الإجراء "${action}" مش متاح من الحالة "${inst.currentState}"`);
    const data = input.context ?? inst.context;
    const block = this.blockReason(t, await this.currentRoles(), data);
    if (block) throw (block.kind === 'role' ? new WorkflowForbiddenError(block.message) : new WorkflowValidationError(block.message));
    const db = this.database.db;
    await db.update(workflowInstance).set({ currentState: t.toState, context: data, updatedAt: new Date() }).where(eq(workflowInstance.id, inst.id));
    await db.insert(workflowHistory).values({ instanceId: inst.id, fromState: inst.currentState, toState: t.toState, action, userId: requestContext.currentUserId() ?? null, comment: input.comment?.trim() || null });
    const view = await this.view(inst.id);
    // Plan item 50: tasks tied to this transition run in the background.
    this.automation?.dispatch({
      instanceId: inst.id, workflowId: inst.workflowId, workflowCode: view.workflowCode, documentType: inst.documentType, documentId: inst.documentId,
      action, fromState: inst.currentState, toState: t.toState, context: data,
    });
    return view;
  }

  private blockReason(t: typeof workflowTransition.$inferSelect, roles: string[] | null, data: Record<string, unknown>): { kind: 'role' | 'condition'; message: string } | null {
    const allowed = t.allowedRoles ?? [];
    if (allowed.length > 0) {
      if (roles === null) return { kind: 'role', message: `الإجراء "${t.action}" محتاج تسجيل دخول بدور من: ${allowed.join('، ')}` };
      if (!allowed.some((r) => roles.includes(r))) return { kind: 'role', message: `دورك مش من الأدوار المسموح لها بـ "${t.action}" (${allowed.join('، ')})` };
    }
    if (!evaluateCondition(t.condition as Condition | null, data)) return { kind: 'condition', message: `شرط الإجراء "${t.action}" مش متحقق على بيانات المستند` };
    return null;
  }

  /** Role codes of the signed-in user; null when nobody is signed in. */
  private async currentRoles(): Promise<string[] | null> {
    const userId = requestContext.currentUserId();
    if (!userId || !this.auth) return null;
    const user = (await this.auth.getUsers()).find((u) => u.id === userId && u.status === 'active');
    if (!user) return null;
    const role = (await this.auth.getRoles()).find((r) => r.id === user.roleId && r.status === 'active');
    return role ? [role.code] : [];
  }

  private async load(instanceId: string): Promise<{ inst: typeof workflowInstance.$inferSelect; transitions: Array<typeof workflowTransition.$inferSelect>; states: Array<typeof workflowState.$inferSelect> }> {
    const db = this.database.db;
    const inst = (await db.select().from(workflowInstance).where(eq(workflowInstance.id, instanceId)).limit(1))[0];
    if (!inst) throw new WorkflowNotFoundError(`workflow instance ${instanceId} does not exist`);
    return {
      inst,
      transitions: await db.select().from(workflowTransition).where(eq(workflowTransition.workflowId, inst.workflowId)),
      states: await db.select().from(workflowState).where(eq(workflowState.workflowId, inst.workflowId)),
    };
  }

  private async view(instanceId: string): Promise<InstanceView> {
    const db = this.database.db;
    const { inst, states } = await this.load(instanceId);
    const def = (await db.select().from(workflowDefinition).where(eq(workflowDefinition.id, inst.workflowId)).limit(1))[0]!;
    const history = await db.select().from(workflowHistory).where(eq(workflowHistory.instanceId, inst.id)).orderBy(asc(workflowHistory.createdAt));
    return {
      id: inst.id, workflowCode: def.code, documentType: inst.documentType, documentId: inst.documentId, currentState: inst.currentState,
      isFinal: states.find((s) => s.code === inst.currentState)?.isFinal ?? false, context: inst.context,
      history: history.map((h) => ({ fromState: h.fromState, toState: h.toState, action: h.action, userId: h.userId, comment: h.comment, at: h.createdAt.toISOString() })),
    };
  }
}
