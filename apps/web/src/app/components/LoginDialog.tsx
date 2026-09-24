import React, { useState } from 'react';
import { ApiError, authApi, setAccessToken, type SessionUser } from '../api/client';

interface LoginDialogProps {
  /** Shown when the server itself asked for a login (AUTH_ENFORCE on, or the session ended). */
  required: boolean;
  onLoggedIn: (user: SessionUser) => void;
  onClose: () => void;
}

/** Login form (plan item 5.0): exchanges username/password for a login token. */
export const LoginDialog: React.FC<LoginDialogProps> = ({ required, onLoggedIn, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authApi.login(username.trim(), password);
      setAccessToken(res.accessToken);
      const me = await authApi.me();
      onLoggedIn(me.user);
    } catch (err) {
      setAccessToken(null);
      setError(err instanceof ApiError ? err.message : 'تعذّر تسجيل الدخول');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70" dir="rtl">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">تسجيل الدخول</h2>
          {required && (
            <p className="text-xs text-rose-600 mt-1">
              جلستك انتهت أو النظام يطلب تسجيل الدخول للمتابعة.
            </p>
          )}
        </div>
        {error && (
          <div className="text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-2">
            {error}
          </div>
        )}
        <label className="block text-xs font-bold text-slate-600">
          اسم المستخدم
          <input
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          كلمة المرور
          <input
            type="password"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg py-2 cursor-pointer"
          >
            {submitting ? 'جارٍ الدخول…' : 'دخول'}
          </button>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 text-sm font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              إلغاء
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
