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

  const allLive = Object.values(live);
  const allPolylines = routes.flatMap((r) => r.polyline || []);
  const allStops = routes.flatMap((r) => r.stops || []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-120px)]">
      <aside className="card overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">Live Monitor</h2>
        <div className="text-sm mb-4">{connected ? <span className="text-emerald-600">Connected</span> : <span className="text-rose-600">Offline</span>}</div>
        <div className="text-sm text-slate-500">Routes: {routes.length}</div>
        <div className="text-sm text-slate-500">Registered buses: {buses.length}</div>
        <div className="text-sm text-slate-500">Live buses: {allLive.length}</div>

        <h3 className="mt-4 font-semibold">Active</h3>
        {allLive.map((b) => (
          <div key={b.busId} className="mt-2 p-2 bg-slate-50 rounded">
            <div className="flex justify-between">
              <span className="font-medium">{b.busNumber || b.busId.slice(-4)}</span>
              <span className={`badge badge-${b.status}`}>{b.status}</span>
            </div>
            <div className="text-xs text-slate-500">
              {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
            </div>
          </div>
        ))}
      </aside>

      <section className="card p-0 overflow-hidden">
        <MapComponent
          stops={allStops}
          polyline={allPolylines}
          buses={allLive}
        />
      </section>
    </div>
  );
}
