import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface RoleRecord { id: string; code: string; name: string; description?: string; }
interface UserRecord { id: string; username: string; roleId: string; status: string; createdAt: string; }
interface PermissionRecord { id: string; roleId: string; action: string; resource: string; maxValueLimit?: string; }

export function AuthPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Forms toggles
  const [showUserForm, setShowUserForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showPermForm, setShowPermForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // User Form State
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('Password123!');
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // Role Form State
  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');

  // Permission Form State
  const [permAction, setPermAction] = useState('approve');
  const [permResource, setPermResource] = useState('accounting.journal_entry');
  const [maxValueInput, setMaxValueInput] = useState('50000');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, usersRes, permsRes] = await Promise.all([
        api.get<{ roles: RoleRecord[] }>('/auth/roles'),
        api.get<{ users: UserRecord[] }>('/auth/users'),
        api.get<{ permissions: PermissionRecord[] }>('/auth/permissions'),
      ]);
      setRoles(rolesRes.roles);
      setUsers(usersRes.users);
      setPermissions(permsRes.permissions);
      if (!selectedRoleId && rolesRes.roles[0]) setSelectedRoleId(rolesRes.roles[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load security and user data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleCreateUser(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/auth/users', {
        username: usernameInput,
        password: passwordInput,
        roleId: selectedRoleId,
      });
      setUsernameInput(''); setShowUserForm(false);
      setFormSuccess(t('pages.auth.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateRole(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/auth/roles', {
        code: roleCode,
        name: roleName,
      });
      setRoleCode(''); setRoleName(''); setShowRoleForm(false);
      setFormSuccess(t('pages.auth.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreatePermission(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/auth/permissions', {
        roleId: selectedRoleId,
        action: permAction,
        resource: permResource,
        maxValueLimit: maxValueInput || undefined,
      });
      setShowPermForm(false);
      setFormSuccess(t('pages.auth.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const roleLabel = (id: string): string => roles.find((r) => r.id === id)?.name ?? id;
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.auth.eyebrow')}</span>
          <h1>{t('pages.auth.title')}</h1>
          <p>{t('pages.auth.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* 1. Users Section */}
      <article className="panel module-panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">User Directory</span>
            <h2>{t('pages.auth.users.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowUserForm((v) => !v)}><b>+</b> {t('pages.auth.users.addUser')}</button>
        </div>

        {showUserForm && (
          <form onSubmit={(e) => { void handleCreateUser(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.auth.users.username')}</label>
              <input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} required placeholder="e.g. m.ahmed" style={{ ...inputStyle, minWidth: 160 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>كلمة السر</label>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required style={{ ...inputStyle, minWidth: 160 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.auth.users.role')}</label>
              <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.auth.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.auth.users.username')}</span>
            <span>{t('pages.auth.users.role')}</span>
            <span>{t('pages.auth.users.status')}</span>
            <span>تاريخ الإنشاء</span>
          </div>

          {users.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.auth.form.empty')}</p>}

          {users.map((u) => (
            <div className="placeholder-table__row" key={u.id}>
              <span><b>{u.username}</b></span>
              <span><code>{roleLabel(u.roleId)}</code></span>
              <span><span className="status status--success"><i />{u.status}</span></span>
              <span>{new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </article>

      {/* 2. System Roles & Value Limits Section */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Access Control Matrix</span>
            <h2>{t('pages.auth.roles.title')}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="filter-button" onClick={() => setShowRoleForm((v) => !v)}><b>+</b> {t('pages.auth.roles.addRole')}</button>
            <button className="primary-button" onClick={() => setShowPermForm((v) => !v)}><b>+</b> {t('pages.auth.roles.addPermission')}</button>
          </div>
        </div>

        {showRoleForm && (
          <form onSubmit={(e) => { void handleCreateRole(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.auth.roles.code')}</label>
              <input value={roleCode} onChange={(e) => setRoleCode(e.target.value)} required placeholder="e.g. ACCOUNTANT" style={{ ...inputStyle, width: 140 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.auth.roles.name')}</label>
              <input value={roleName} onChange={(e) => setRoleName(e.target.value)} required placeholder="e.g. مدير الحسابات" style={{ ...inputStyle, minWidth: 200 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.auth.form.save')}</button>
          </form>
        )}

        {showPermForm && (
          <form onSubmit={(e) => { void handleCreatePermission(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>الدور</label>
              <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.auth.roles.action')}</label>
              <select value={permAction} onChange={(e) => setPermAction(e.target.value)} style={{ ...inputStyle, minWidth: 120 }}>
                <option value="read">قراءة (read)</option>
                <option value="create">إنشاء (create)</option>
                <option value="approve">اعتماد (approve)</option>
                <option value="delete">حذف (delete)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.auth.roles.resource')}</label>
              <input value={permResource} onChange={(e) => setPermResource(e.target.value)} required placeholder="e.g. accounting.journal_entry" style={{ ...inputStyle, minWidth: 200 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.auth.roles.maxValue')}</label>
              <input type="number" value={maxValueInput} onChange={(e) => setMaxValueInput(e.target.value)} placeholder="بلا حد أقصى" style={{ ...inputStyle, width: 140 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.auth.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>الدور المسند</span>
            <span>{t('pages.auth.roles.action')}</span>
            <span>{t('pages.auth.roles.resource')}</span>
            <span>{t('pages.auth.roles.maxValue')}</span>
          </div>

          {permissions.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>لا توجد صلاحيات مسندة بعد</p>}

          {permissions.map((p) => (
            <div className="placeholder-table__row" key={p.id}>
              <span><b>{roleLabel(p.roleId)}</b></span>
              <span><span className="status status--success"><i />{p.action}</span></span>
              <span><code>{p.resource}</code></span>
              <span><b>{p.maxValueLimit ? `${Number(p.maxValueLimit).toLocaleString()} EGP` : 'بلا حد أقصى'}</b></span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
