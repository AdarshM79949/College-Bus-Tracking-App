import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';

const empty = { name: '', stopsText: '', polylineText: '' };

function parseStops(text) {
  return text
    .split('\n')
    .map((l, i) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const [name, lat, lng] = l.split(',').map((s) => s.trim());
      return { name, lat: Number(lat), lng: Number(lng), order: i + 1 };
    });
}
function parsePolyline(text) {
  return text
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split(',').map((s) => Number(s.trim())))
    .filter((a) => a.length === 2 && !isNaN(a[0]) && !isNaN(a[1]));
}

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const { routes } = await apiFetch('/api/routes');
    setRoutes(routes);
  }
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      const body = {
        name: form.name,
        stops: parseStops(form.stopsText),
        polyline: parsePolyline(form.polylineText),
      };
      if (editingId) {
        await apiFetch(`/api/routes/${editingId}`, { method: 'PUT', body });
        toast.success('Route updated');
      } else {
        await apiFetch('/api/routes', { method: 'POST', body });
        toast.success('Route created');
      }
      setForm(empty); setEditingId(null);
      await load();
    } catch (err) { toast.error(err.message); }
  }

  function edit(r) {
    setEditingId(r._id);
    setForm({
      name: r.name,
      stopsText: r.stops.map((s) => `${s.name}, ${s.lat}, ${s.lng}`).join('\n'),
      polylineText: (r.polyline || []).map((p) => `${p[0]}, ${p[1]}`).join('\n'),
    });
  }

  async function remove(id) {
    if (!confirm('Delete this route?')) return;
    try { await apiFetch(`/api/routes/${id}`, { method: 'DELETE' }); await load(); toast.success('Deleted'); }
    catch (err) { toast.error(err.message); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <h2 className="text-lg font-bold mb-2">{editingId ? 'Edit Route' : 'New Route'}</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Stops (one per line: Name, lat, lng)</label>
            <textarea className="input h-32 font-mono text-xs" required value={form.stopsText}
              onChange={(e) => setForm({ ...form, stopsText: e.target.value })}
              placeholder="Main Gate, 28.545, 77.192" />
          </div>
          <div>
            <label className="label">Polyline (one per line: lat, lng)</label>
            <textarea className="input h-32 font-mono text-xs" value={form.polylineText}
              onChange={(e) => setForm({ ...form, polylineText: e.target.value })}
              placeholder="28.545, 77.192" />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" type="submit">{editingId ? 'Update' : 'Create'}</button>
            {editingId && <button type="button" className="btn btn-secondary" onClick={() => { setForm(empty); setEditingId(null); }}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-2">Routes ({routes.length})</h2>
        <div className="space-y-2">
          {routes.map((r) => (
            <div key={r._id} className="p-3 border rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.stops.length} stops · {r.polyline?.length || 0} polyline pts</div>
                </div>
                <div className="flex gap-2">
                  <button className="text-indigo-600 text-sm" onClick={() => edit(r)}>Edit</button>
                  <button className="text-rose-600 text-sm" onClick={() => remove(r._id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
