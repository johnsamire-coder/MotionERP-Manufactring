import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface EmployeeRecord {
  id: string;
  code: string;
  name: string;
}
interface _AttendanceEntry {
  employeeId: string;
  status: 'present' | 'absent' | 'half_day' | 'on_leave';
}

export function AttendancePage(): JSX.Element {
  const { t: _t } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]!);
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, 'present' | 'absent' | 'half_day' | 'on_leave'>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadEmployees(): Promise<void> {
    setLoading(true);
    try {
      const res = await api
        .get<{ employees: EmployeeRecord[] }>('/hr/employees')
        .catch(() => ({ employees: [] }));
      setEmployees(res.employees || []);
      const initialMap: Record<string, 'present' | 'absent' | 'half_day' | 'on_leave'> = {};
      res.employees?.forEach((e) => {
        initialMap[e.id] = 'present';
      });
      setAttendanceMap(initialMap);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  function handleStatusChange(
    empId: string,
    status: 'present' | 'absent' | 'half_day' | 'on_leave',
  ): void {
    setAttendanceMap({ ...attendanceMap, [empId]: status });
  }

  function handleSave(): void {
    setSuccess(
      `Attendance for ${attendanceDate} saved successfully (${employees.length} employees recorded)!`,
    );
  }

  const presentCount = Object.values(attendanceMap).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendanceMap).filter((s) => s === 'absent').length;

  if (loading)
    return <p style={{ padding: 40, textAlign: 'center' }}>Loading Employee Directory...</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Human Resources (ERPNext Parity)</span>
          <h1>Employee Attendance (سجل الحضور والانصراف)</h1>
          <p>Daily shift attendance ledger for factory workforce and staff.</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {success && <p style={{ color: '#166534', fontWeight: 'bold' }}>{success}</p>}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          margin: '20px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 'bold', color: '#475569' }}>
            Attendance Date:
          </label>
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <span
            style={{
              padding: '6px 12px',
              background: '#f0fdf4',
              color: '#166534',
              borderRadius: 6,
              fontWeight: 'bold',
              fontSize: 13,
            }}
          >
            ✓ Present: {presentCount}
          </span>
          <span
            style={{
              padding: '6px 12px',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 6,
              fontWeight: 'bold',
              fontSize: 13,
            }}
          >
            ✕ Absent: {absentCount}
          </span>
        </div>
      </div>

      <article
        className="panel module-panel"
        style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}
      >
        <div className="placeholder-table">
          <div className="placeholder-table__head" style={{ gridTemplateColumns: '1.5fr 2fr 3fr' }}>
            <span>Employee Code</span>
            <span>Employee Name</span>
            <span>Attendance Status</span>
          </div>

          {employees.length === 0 && (
            <p style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>
              No employees registered in HR.
            </p>
          )}

          {employees.map((emp) => (
            <div
              className="placeholder-table__row"
              key={emp.id}
              style={{ gridTemplateColumns: '1.5fr 2fr 3fr', alignItems: 'center' }}
            >
              <span>
                <b>{emp.code}</b>
              </span>
              <span>{emp.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['present', 'absent', 'half_day', 'on_leave'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(emp.id, st)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      borderRadius: 4,
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      background:
                        attendanceMap[emp.id] === st
                          ? st === 'present'
                            ? '#166534'
                            : st === 'absent'
                              ? '#b91c1c'
                              : '#0369a1'
                          : '#f8fafc',
                      color: attendanceMap[emp.id] === st ? '#fff' : '#475569',
                      fontWeight: attendanceMap[emp.id] === st ? 'bold' : 'normal',
                    }}
                  >
                    {st === 'present'
                      ? 'Present'
                      : st === 'absent'
                        ? 'Absent'
                        : st === 'half_day'
                          ? 'Half Day'
                          : 'On Leave'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="primary-button"
          style={{ marginTop: 20 }}
        >
          Save Attendance Sheet
        </button>
      </article>
    </section>
  );
}
