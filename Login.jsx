import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const homeFor = (role) => role === 'admin' ? '/admin' : role === 'driver' ? '/driver' : '/student';

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = mode === 'login'
        ? await login(form.email, form.password)
        : await register(form.name, form.email, form.password);
      toast.success(`Welcome, ${user.name}`);
      navigate(homeFor(user.role));
    } catch (err) {
      toast.error(err.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        <p className="text-sm text-slate-500 mb-6">
          {mode === 'login' ? 'Welcome back to Campus Bus Tracker.' : 'New students can register here.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="label">Name</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required minLength={6} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <button disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Register'}
          </button>
        </form>
        <div className="mt-4 text-sm text-center">
          {mode === 'login' ? (
            <button className="text-indigo-600 hover:underline" onClick={() => setMode('register')}>
              No account? Register as a student
            </button>
          ) : (
            <button className="text-indigo-600 hover:underline" onClick={() => setMode('login')}>
              Already have an account? Sign in
            </button>
          )}
        </div>
        <div className="mt-6 text-xs text-slate-500 border-t pt-4">
          <div className="font-semibold mb-1">Demo accounts (after seeding):</div>
          <div>admin@campus.edu / admin123</div>
          <div>driver@campus.edu / driver123</div>
          <div>student@campus.edu / student123</div>
        </div>
      </div>
    </div>
  );
}
