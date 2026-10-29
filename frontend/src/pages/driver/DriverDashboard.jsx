import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import MapComponent from '../../components/MapComponent';

// Client-side route simulator mirrors backend logic.
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function totalLen(poly) {
  let t = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    t += haversineKm({ lat: poly[i][0], lng: poly[i][1] }, { lat: poly[i + 1][0], lng: poly[i + 1][1] });
  }
  return t;
}
function pointAt(poly, distKm) {
  const total = totalLen(poly);
  if (total === 0) return { lat: poly[0][0], lng: poly[0][1] };
  let rem = ((distKm % total) + total) % total;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = { lat: poly[i][0], lng: poly[i][1] };
    const b = { lat: poly[i + 1][0], lng: poly[i + 1][1] };
    const seg = haversineKm(a, b);
    if (rem <= seg || i === poly.length - 2) {
      const t = seg === 0 ? 0 : Math.min(1, rem / seg);
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
    rem -= seg;
  }
  const last = poly[poly.length - 1];
  return { lat: last[0], lng: last[1] };
}

export default function DriverDashboard() {
  const { socket, connected } = useSocket();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [onTrip, setOnTrip] = useState(false);
  const [mode, setMode] = useState('simulated'); // 'real' | 'simulated'
  const [simSpeedKmh, setSimSpeedKmh] = useState(30);
  const [pos, setPos] = useState(null);

  const simDistRef = useRef(0);
  const simIntervalRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    Promise.all([apiFetch('/api/buses'), apiFetch('/api/routes')])
      .then(([b, r]) => {
        setBuses(b.buses);
        setRoutes(r.routes);
        if (b.buses[0]) setSelectedBusId(b.buses[0]._id);
      })
      .catch((err) => toast.error(err.message));
  }, []);

  const selectedBus = useMemo(
    () => buses.find((b) => b._id === selectedBusId),
    [buses, selectedBusId]
  );
  const selectedRoute = useMemo(() => {
    if (!selectedBus) return null;
    const rid = selectedBus.routeId?._id || selectedBus.routeId;
    return routes.find((r) => r._id === rid);
  }, [selectedBus, routes]);

  // Stop any ongoing location source on unmount or when trip ends
  const stopLocationSource = () => {
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => () => stopLocationSource(), []);

  function emitLocation(lat, lng, speed) {
    if (!socket || !selectedBusId) return;
    socket.emit('location:update', { busId: selectedBusId, lat, lng, speed });
    setPos({ lat, lng });
  }

  function startRealGps() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation not supported in this browser');
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => emitLocation(p.coords.latitude, p.coords.longitude, (p.coords.speed || 0) * 3.6),
      (err) => toast.error(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10_000 }
    );
  }

  function startSimulated() {
    if (!selectedRoute || !selectedRoute.polyline || selectedRoute.polyline.length < 2) {
      toast.error('Selected route has no polyline; cannot simulate');
      return;
    }
    simDistRef.current = 0;
    simIntervalRef.current = setInterval(() => {
      simDistRef.current += (simSpeedKmh * 3) / 3600; // 3s tick
      const p = pointAt(selectedRoute.polyline, simDistRef.current);
      emitLocation(p.lat, p.lng, simSpeedKmh);
    }, 3000);
    // fire first point immediately
    const p0 = pointAt(selectedRoute.polyline, 0);
    emitLocation(p0.lat, p0.lng, simSpeedKmh);
  }

  async function startTrip() {
    if (!socket || !connected) { toast.error('Not connected'); return; }
    if (!selectedBusId) { toast.error('Select a bus'); return; }
    await new Promise((resolve, reject) => {
      socket.emit('trip:start', { busId: selectedBusId }, (ack) => {
        if (ack && ack.ok) resolve(); else reject(new Error(ack && ack.message));
      });
    }).catch((err) => { toast.error(err.message); throw err; });
    setOnTrip(true);
    toast.success('Trip started');
    if (mode === 'real') startRealGps(); else startSimulated();
  }

  async function endTrip() {
    stopLocationSource();
    await new Promise((resolve) => {
      socket.emit('trip:end', { busId: selectedBusId }, () => resolve());
    });
    setOnTrip(false);
    toast('Trip ended', { icon: 'i' });
  }

  function flagDelay() {
    socket.emit('status:delay', { busId: selectedBusId, reason: 'Driver-reported delay' });
    toast('Delay flagged', { icon: 'warn' });
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-56px)]">
      <aside className="card overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">Driver Panel</h2>
        <div className="text-sm text-slate-500 mb-4">
          {connected ? <span className="text-emerald-600">Connected</span> : <span className="text-rose-600">Offline</span>}
        </div>

        <label className="label">Bus</label>
        <select className="input" value={selectedBusId} disabled={onTrip}
          onChange={(e) => setSelectedBusId(e.target.value)}>
          {buses.map((b) => (
            <option key={b._id} value={b._id}>{b.busNumber} — {b.routeId?.name || 'route'}</option>
          ))}
        </select>

        <div className="mt-4">
          <label className="label">GPS source</label>
          <div className="flex gap-2">
            <button
              className={`btn ${mode === 'real' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={onTrip}
              onClick={() => setMode('real')}
            >Real GPS</button>
            <button
              className={`btn ${mode === 'simulated' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={onTrip}
              onClick={() => setMode('simulated')}
            >Simulated</button>
          </div>
        </div>

        {mode === 'simulated' && (
          <div className="mt-4">
            <label className="label">Simulated speed: {simSpeedKmh} km/h</label>
            <input type="range" min="10" max="60" step="5" value={simSpeedKmh}
              disabled={onTrip}
              onChange={(e) => setSimSpeedKmh(Number(e.target.value))} className="w-full" />
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {!onTrip ? (
            <button onClick={startTrip} className="btn btn-primary">Start Trip</button>
          ) : (
            <>
              <button onClick={flagDelay} className="btn btn-secondary">Flag Delay</button>
              <button onClick={endTrip} className="btn btn-danger">End Trip</button>
            </>
          )}
        </div>

        {pos && (
          <div className="mt-6 text-sm bg-slate-50 rounded-lg p-3">
            <div className="font-semibold">Last position</div>
            <div>lat: {pos.lat.toFixed(5)}</div>
            <div>lng: {pos.lng.toFixed(5)}</div>
          </div>
        )}
      </aside>

      <section className="card p-0 overflow-hidden">
        <MapComponent
          center={pos ? [pos.lat, pos.lng] : (selectedRoute?.stops?.[0] ? [selectedRoute.stops[0].lat, selectedRoute.stops[0].lng] : [23.8160, 86.4410])}
          stops={selectedRoute?.stops || []}
          polyline={selectedRoute?.polyline || []}
          buses={pos ? [{ busId: selectedBusId, busNumber: selectedBus?.busNumber, lat: pos.lat, lng: pos.lng, status: onTrip ? 'active' : 'idle' }] : []}
        />
      </section>
    </div>
  );
}
