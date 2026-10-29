import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import MapComponent from '../../components/MapComponent';

export default function StudentView() {
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [liveBuses, setLiveBuses] = useState({}); // busId -> payload
  const { socket, connected } = useSocket();

  useEffect(() => {
    Promise.all([apiFetch('/api/routes'), apiFetch('/api/buses')])
      .then(([r, b]) => {
        setRoutes(r.routes);
        setBuses(b.buses);
        // Seed live buses from last-known currentLocation
        const seeded = {};
        b.buses.forEach((bus) => {
          if (bus.currentLocation && bus.currentLocation.lat != null) {
            seeded[bus._id] = {
              busId: bus._id,
              busNumber: bus.busNumber,
              routeId: bus.routeId?._id || bus.routeId,
              lat: bus.currentLocation.lat,
              lng: bus.currentLocation.lng,
              status: bus.status,
              etas: [],
            };
          }
        });
        setLiveBuses(seeded);
        if (r.routes[0]) setSelectedRouteId(r.routes[0]._id);
      })
      .catch((err) => toast.error(err.message));
  }, []);

  useEffect(() => {
    if (!socket || !connected || !selectedRouteId) return;
    socket.emit('subscribe:route', { routeId: selectedRouteId });

    const onLocation = (payload) => {
      setLiveBuses((prev) => ({ ...prev, [payload.busId]: payload }));
    };
    const onDelay = (payload) => {
      toast.error(`Bus delayed: ${payload.reason || 'unknown reason'}`, { icon: 'warn' });
      setLiveBuses((prev) =>
        prev[payload.busId] ? { ...prev, [payload.busId]: { ...prev[payload.busId], status: 'delayed' } } : prev
      );
    };
    const onStatus = (payload) => {
      setLiveBuses((prev) =>
        prev[payload.busId] ? { ...prev, [payload.busId]: { ...prev[payload.busId], status: payload.status } } : prev
      );
    };

    socket.on('bus:location', onLocation);
    socket.on('bus:delay', onDelay);
    socket.on('bus:status', onStatus);

    return () => {
      socket.emit('unsubscribe:route', { routeId: selectedRouteId });
      socket.off('bus:location', onLocation);
      socket.off('bus:delay', onDelay);
      socket.off('bus:status', onStatus);
    };
  }, [socket, connected, selectedRouteId]);

  const selectedRoute = useMemo(
    () => routes.find((r) => r._id === selectedRouteId),
    [routes, selectedRouteId]
  );

  const busesOnRoute = useMemo(() => {
    return Object.values(liveBuses).filter((b) => {
      const bus = buses.find((x) => x._id === b.busId);
      const rid = bus ? (bus.routeId?._id || bus.routeId) : b.routeId;
      return String(rid) === String(selectedRouteId);
    });
  }, [liveBuses, buses, selectedRouteId]);

  const mapCenter = selectedRoute?.stops?.[0]
    ? [selectedRoute.stops[0].lat, selectedRoute.stops[0].lng]
    : [23.8160, 86.4410];

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-56px)]">
      <aside className="card overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">Your Route</h2>
        <label className="label">Select route</label>
        <select
          className="input"
          value={selectedRouteId}
          onChange={(e) => setSelectedRouteId(e.target.value)}
        >
          {routes.map((r) => (
            <option key={r._id} value={r._id}>{r.name}</option>
          ))}
        </select>

        <div className="mt-4">
          <div className="text-sm text-slate-500">
            Connection: {connected ? <span className="text-emerald-600">live</span> : <span className="text-rose-600">offline</span>}
          </div>
        </div>

        <h3 className="mt-6 font-semibold">Active buses</h3>
        {busesOnRoute.length === 0 && (
          <p className="text-sm text-slate-500 mt-2">No live buses yet. Ask a driver to start a trip.</p>
        )}
        {busesOnRoute.map((b) => (
          <div key={b.busId} className="mt-3 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{b.busNumber || b.busId.slice(-4)}</div>
              <span className={`badge badge-${b.status || 'idle'}`}>{b.status || 'idle'}</span>
            </div>
            {Array.isArray(b.etas) && b.etas.length > 0 && (
              <div className="mt-2 text-sm">
                <div className="font-medium text-slate-700">Next stops:</div>
                {b.etas.slice(0, 4).map((e, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{e.stopName}</span>
                    <span className="text-indigo-700 font-medium">
                      {e.etaSeconds < 60 ? `${e.etaSeconds}s` : `${Math.round(e.etaSeconds / 60)} min`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>

      <section className="card p-0 overflow-hidden">
        <MapComponent
          center={mapCenter}
          stops={selectedRoute?.stops || []}
          polyline={selectedRoute?.polyline || []}
          buses={busesOnRoute}
        />
      </section>
    </div>
  );
}
