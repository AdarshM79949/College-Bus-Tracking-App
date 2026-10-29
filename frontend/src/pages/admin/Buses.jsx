import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';

const empty = { busNumber: '', routeId: '', driverId: '' };

export default function Buses() {
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const [b, r, d] = await Promise.all([
      apiFetch('/api/buses'),
      apiFetch('/api/routes'),
      apiFetch('/api/users?role=driver'),
    ]);
    setBuses(b.buses); setRoutes(r.routes); setDrivers(d.users);
  }
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      const body = {
        busNumber: form.busNumber,
        routeId: form.routeId,
        driverId: form.driverId || undefined,
      };
      if (editingId) {
        await apiFetch(`/api/buses/${editingId}`, { method: 'PUT', body });
        toast.success('Bus updated');
      } else {
        await apiFetch('/api/buses', { method: 'POST', body });
        toast.success('Bus created');
      }
      setForm(empty); setEditingId(null);
      await load();
    } catch (err) { toast.error(err.message); }
  }

  function edit(b) {
    setEditingId(b._id);
    setForm({
      busNumber: b.busNumber,
      routeId: b.routeId?._id || b.routeId || '',
      driverId: b.driverId?._id || b.driverId || '',
    });
  }
  async function remove(id) {
    if (!confirm('Delete this bus?')) return;
    try { await apiFetch(`/api/buses/${id}`, { method: 'DELETE' }); await load(); toast.success('Deleted'); }
    catch (err) { toast.error(err.message); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <h2 className="text-lg font-bold mb-2">{editingId ? 'Edit Bus' : 'New Bus'}</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Bus Number</label>
            <input className="input" required value={form.busNumber}
              onChange={(e) => setForm({ ...form, busNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">Route</label>
            <select className="input" required value={form.routeId}
              onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
              <option value="">-- select --</option>
              {routes.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Driver (optional)</label>
            <select className="input" value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">-- none --</option>
              {drivers.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.email})</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit">{editingId ? 'Update' : 'Create'}</button>
            {editingId && <button type="button" className="btn btn-secondary" onClick={() => { setForm(empty); setEditingId(null); }}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-2">Buses ({buses.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr><th>Number</th><th>Route</th><th>Driver</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {buses.map((b) => (
              <tr key={b._id} className="border-t">
                <td className="py-2 font-medium">{b.busNumber}</td>
                <td>{b.routeId?.name || '-'}</td>
                <td>{b.driverId?.name || '-'}</td>
                <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                <td className="text-right">
                  <button className="text-indigo-600 mr-2" onClick={() => edit(b)}>Edit</button>
                  <button className="text-rose-600" onClick={() => remove(b._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
