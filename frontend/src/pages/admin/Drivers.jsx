import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';

const empty = { name: '', email: '', password: '', role: 'driver' };

export default function Drivers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);

  async function load() {
    const { users } = await apiFetch('/api/users');
    setUsers(users);
  }
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await apiFetch('/api/users', { method: 'POST', body: form });
      toast.success('User created');
      setForm(empty);
      await load();
    } catch (err) { toast.error(err.message); }
  }

  async function remove(id) {
    if (!confirm('Delete this user?')) return;
    try { await apiFetch(`/api/users/${id}`, { method: 'DELETE' }); await load(); toast.success('Deleted'); }
    catch (err) { toast.error(err.message); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <h2 className="text-lg font-bold mb-2">New User</h2>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Password</label>
            <input className="input" type="password" minLength={6} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="driver">driver</option>
              <option value="admin">admin</option>
              <option value="student">student</option>
            </select></div>
          <button className="btn btn-primary" type="submit">Create</button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-2">Users ({users.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500"><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t">
                <td className="py-2">{u.name}</td>
                <td>{u.email}</td>
                <td><span className="badge badge-idle">{u.role}</span></td>
                <td className="text-right"><button className="text-rose-600" onClick={() => remove(u._id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
