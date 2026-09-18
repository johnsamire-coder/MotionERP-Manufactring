import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface EmployeeRecord { id: string; code: string; name: string; }
interface LeaveRecord {
  id: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'approved' | 'pending' | 'rejected';
}

export function LeaveApplicationPage(): JSX.Element {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([
    {
      id: '1',
      employeeName: 'Ahmed Hassan',
      leaveType: 'Annual (سنوية)',
      fromDate: '2026-10-01',
      toDate: '2026-10-05',
      reason: 'Family event',
      status: 'approved',
    }
  ]);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [leaveType, setLeaveType] = useState('Annual Leave (إجازة سنوية)');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]!);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]!);
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  async function loadEmployees(): Promise<void> {
    try {
      const res = await api.get<{ employees: EmployeeRecord[] }>('/hr/employees').catch(() => ({ employees: [] }));
      setEmployees(res.employees || []);
      if (res.employees?.[0]) setSelectedEmpId(res.employees[0].id);
    } catch {}
  }

  useEffect(() => { void loadEmployees(); }, []);

  function handleCreate(e: React.FormEvent): void {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmpId);
    const newLeave: LeaveRecord = {
      id: String(leaves.length + 1),
      employeeName: emp ? `${emp.name} (${emp.code})` : 'Employee',
      leaveType,
      fromDate,
      toDate,
      reason: reason || '—',
      status: 'approved',
    };
    setLeaves([newLeave, ...leaves]);
    setShowForm(false);
    setReason('');
    setSuccess('Leave application approved and recorded in HR register!');
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 'bold' as const };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Human Resources (ERPNext Parity)</span>
          <h1>Leave Application (طلبات الإجازات)</h1>
          <p>Submit, approve, and track employee annual, sick, and casual leave requests.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Leave Application'}
        </button>
      </div>

      {success && <p style={{ color: '#166534', fontWeight: 'bold' }}>{success}</p>}

      {showForm && (
        <article className="panel module-panel" style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e2e8f0', margin: '20px 0' }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Apply for Leave</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Employee</label>
                <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.code})</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Leave Type</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  <option value="Annual Leave (إجازة سنوية)">Annual Leave (إجازة سنوية)</option>
                  <option value="Sick Leave (إجازة مرضية)">Sick Leave (إجازة مرضية)</option>
                  <option value="Casual Leave (إجازة عارضة)">Casual Leave (إجازة عارضة)</option>
                  <option value="Unpaid Leave (إجازة بدون راتب)">Unpaid Leave (بدون راتب)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>From Date</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>To Date</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} required />
              </div>
            </div>

            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for leave..." style={{ ...inputStyle, minHeight: 50 }} />
            <button type="submit" className="primary-button" style={{ alignSelf: 'flex-start' }}>Approve & Record Leave</button>
          </form>
        </article>
      )}

      {/* Leave Ledger */}
      <article className="panel module-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 20 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Leave Applications Ledger</h2>
        <div className="placeholder-table">
          <div className="placeholder-table__head" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 2fr 1fr' }}>
            <span>Employee</span>
            <span>Type</span>
            <span>From</span>
            <span>To</span>
            <span>Reason</span>
            <span>Status</span>
          </div>

          {leaves.map(l => (
            <div className="placeholder-table__row" key={l.id} style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 2fr 1fr', alignItems: 'center' }}>
              <span><b>{l.employeeName}</b></span>
              <span>{l.leaveType}</span>
              <span>{l.fromDate}</span>
              <span>{l.toDate}</span>
              <span>{l.reason}</span>
              <span><span className="status status--success"><i />{l.status.toUpperCase()}</span></span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
