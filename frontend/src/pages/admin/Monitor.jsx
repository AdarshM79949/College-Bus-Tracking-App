import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import MapComponent from '../../components/MapComponent';

export default function Monitor() {
  const { socket, connected } = useSocket();
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [live, setLive] = useState({});

  useEffect(() => {
    Promise.all([apiFetch('/api/routes'), apiFetch('/api/buses')])
      .then(([r, b]) => {
        setRoutes(r.routes);
        setBuses(b.buses);
      })
      .catch((err) => toast.error(err.message));
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit('subscribe:all');
    const onLoc = (p) => setLive((prev) => ({ ...prev, [p.busId]: p }));
    const onStatus = (p) =>
      setLive((prev) =>
        prev[p.busId] ? { ...prev, [p.busId]: { ...prev[p.busId], status: p.status } } : prev
      );
    const onDelay = (p) => toast.error(`Bus ${p.busId.slice(-4)} delayed: ${p.reason}`);
    socket.on('bus:location', onLoc);
    socket.on('bus:status', onStatus);
    socket.on('bus:delay', onDelay);
    return () => {
      socket.off('bus:location', onLoc);
      socket.off('bus:status', onStatus);
      socket.off('bus:delay', onDelay);
    };
  }, [socket, connected]);

  const [selectedRouteId, setSelectedRouteId] = useState('');

  const allLive = Object.values(live);
  const selectedRoute = routes.find((r) => r._id === selectedRouteId);
  const displayedPolylines = selectedRoute
    ? (selectedRoute.polyline && selectedRoute.polyline.length > 1 ? [selectedRoute.polyline] : [])
    : routes.map((r) => r.polyline).filter((p) => p && p.length > 1);
  const displayedStops = selectedRoute
    ? (selectedRoute.stops || [])
    : routes.flatMap((r) => r.stops || []);

  const ROUTE_COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-120px)]">
      <aside className="card overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">Fleet Monitor</h2>
        <div className="text-sm mb-3">
          {connected ? <span className="text-emerald-600 font-medium">● Connected Live</span> : <span className="text-rose-600 font-medium">● Offline</span>}
        </div>

        <div className="mb-4">
          <label className="label">Map Route View</label>
          <select
            className="input text-xs"
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
          >
            <option value="">All Bus Routes ({routes.length})</option>
            {routes.map((r) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 mb-4 text-xs">
          <div className="font-semibold text-slate-700 mb-1">Routes on Map:</div>
          {routes.map((r, i) => (
            <button
              key={r._id}
              onClick={() => setSelectedRouteId(selectedRouteId === r._id ? '' : r._id)}
              className={`w-full text-left p-1.5 rounded flex items-center justify-between transition ${selectedRouteId === r._id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'}`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ROUTE_COLORS[i % ROUTE_COLORS.length] }}></span>
                <span className="truncate">{r.name}</span>
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">{r.stops?.length || 0} stops</span>
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 border-t pt-3 space-y-1">
          <div>Registered fleet: <span className="font-semibold text-slate-700">{buses.length} buses</span></div>
          <div>Live active: <span className="font-semibold text-emerald-600">{allLive.length} online</span></div>
        </div>

        <h3 className="mt-4 font-semibold text-sm">Active Fleet</h3>
        {allLive.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">No buses currently streaming GPS.</p>
        )}
        {allLive.map((b) => (
          <div key={b.busId} className="mt-2 p-2 bg-slate-50 rounded border border-slate-100">
            <div className="flex justify-between items-center">
              <span className="font-medium text-xs">{b.busNumber || b.busId.slice(-4)}</span>
              <span className={`badge badge-${b.status}`}>{b.status}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              📍 {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
            </div>
          </div>
        ))}
      </aside>

      <section className="card p-0 overflow-hidden">
        <MapComponent
          stops={displayedStops}
          polyline={displayedPolylines}
          buses={allLive}
        />
      </section>
    </div>
  );
}
