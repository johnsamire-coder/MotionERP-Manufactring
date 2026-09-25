import { describeRequest } from './audit.interceptor';

describe('audit trail: what a change was', () => {
  it('create: the resource path and the id from the response', () => {
    const d = describeRequest(
      'POST',
      '/api/v1/crm/contacts',
      {},
      { firstName: 'Karim' },
      { contact: { id: 'c-1', firstName: 'Karim' } },
    );
    expect(d).toEqual({
      entityName: 'crm/contacts',
      entityId: 'c-1',
      action: 'CREATE',
      newValues: '{"firstName":"Karim"}',
    });
  });

  it('an action on a record: the segment after :id', () => {
    const d = describeRequest(
      'POST',
      '/api/v1/production-ops/subcontracting/:id/receive',
      { id: 'o-9' },
      {},
      {},
    );
    expect(d.entityName).toBe('production-ops/subcontracting');
    expect(d.entityId).toBe('o-9');
    expect(d.action).toBe('RECEIVE');
    expect(d.newValues).toBeNull();
  });

  it('update / delete, and secrets are masked', () => {
    expect(describeRequest('PATCH', '/api/v1/crm/contacts/:id', { id: 'c-1' }, {}, {}).action).toBe(
      'UPDATE',
    );
    expect(
      describeRequest('DELETE', '/api/v1/auth/user-permissions/:id', { id: 'p' }, {}, {}).action,
    ).toBe('DELETE');
    const d = describeRequest(
      'POST',
      '/api/v1/auth/users',
      {},
      { username: 'a', password: 'x' },
      { user: { id: 'u' } },
    );
    expect(d.newValues).toBe('{"username":"a","password":"***"}');
  });
});
