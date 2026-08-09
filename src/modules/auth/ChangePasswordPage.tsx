import { useState, FormEvent } from 'react';
import { authApi } from '@/core/api';
import { useAuthStore } from '@/core/auth';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
  const { mustChangePassword, logout } = useAuthStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) { toast.error('Passwords do not match'); return; }
    if (next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await authApi.changePassword({ current_password: mustChangePassword ? undefined : current, new_password: next });
      toast.success('Password changed — please sign in again');
      logout();
    } catch {
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card w-full max-w-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">
            {mustChangePassword ? 'Set your password' : 'Change password'}
          </h1>
          {mustChangePassword && (
            <p className="mt-1 text-sm text-amber-600">You must set a new password before continuing.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!mustChangePassword && (
            <div>
              <label className="label">Current password</label>
              <input type="password" className="input" value={current} onChange={e => setCurrent(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">New password</label>
            <input type="password" className="input" value={next} onChange={e => setNext(e.target.value)} required />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Saving…' : 'Save password'}
          </button>
          <button type="button" onClick={logout} className="btn-ghost w-full text-sm">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
