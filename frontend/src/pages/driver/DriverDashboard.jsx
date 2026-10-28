import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
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
function pointAlong(poly, distKm) {
  if (!poly || poly.length === 0) return { lat: 0, lng: 0 };
  const total = totalLen(poly);
  if (total === 0) return { lat: poly[0][0], lng: poly[0][1] };
  if (distKm >= total) {
    const last = poly[poly.length - 1];
    return { lat: last[0], lng: last[1] };
  }
  let rem = Math.max(0, distKm);
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
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [onTrip, setOnTrip] = useState(false);
  const [mode, setMode] = useState('simulated'); // 'real' | 'simulated'
  const [isReturn, setIsReturn] = useState(false);
  const [pos, setPos] = useState(null);

  const simDistRef = useRef(0);
  const simIntervalRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    Promise.all([apiFetch('/api/buses'), apiFetch('/api/routes')])
      .then(([b, r]) => {
        // Driver only sees and operates their assigned bus
        const myBuses = b.buses.filter((bus) => {
          if (!bus.driverId) return false;
          const did = bus.driverId?._id || bus.driverId;
          const uid = user?._id || user?.id;
          return String(did) === String(uid);
        });
        const assignedBuses = myBuses.length > 0 ? myBuses : b.buses;
        setBuses(assignedBuses);
        setRoutes(r.routes);
        if (assignedBuses[0]) setSelectedBusId(assignedBuses[0]._id);
      })
      .catch((err) => toast.error(err.message));
  }, [user]);

  const selectedBus = useMemo(
    () => buses.find((b) => b._id === selectedBusId) || buses[0],
    [buses, selectedBusId]
  );
  const selectedRoute = useMemo(() => {
    if (!selectedBus) return null;
    const rid = selectedBus.routeId?._id || selectedBus.routeId;
    return routes.find((r) => String(r._id) === String(rid)) || (selectedBus.routeId?.name ? selectedBus.routeId : null);
  }, [selectedBus, routes]);

  const originTown = useMemo(() => {
    if (!selectedRoute) return 'Origin';
    if (selectedRoute.name) {
      const first = selectedRoute.name.split(' - ')[0];
      if (first) return first.trim();
    }
    return 'Origin';
  }, [selectedRoute]);

  // Stop any ongoing location source on unmount or when trip ends
  const stopLocationSource = () => {
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => () => stopLocationSource(), []);

  function emitLocation(lat, lng, speed, returnFlag = isReturn) {
    if (!socket || !selectedBusId) return;
    socket.emit('location:update', { busId: selectedBusId, lat, lng, speed, isReturn: returnFlag });
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

  function startSimulated(forReturn = isReturn) {
    if (!selectedRoute || !selectedRoute.polyline || selectedRoute.polyline.length < 2) {
      toast.error('Selected route has no polyline; cannot simulate');
      return;
    }
    stopLocationSource();
    setIsReturn(forReturn);

    // If return trip is selected, navigate the polyline in reverse order
    const activePolyline = forReturn
      ? [...selectedRoute.polyline].reverse()
      : selectedRoute.polyline;

    simDistRef.current = 0;
    const totalDistanceKm = totalLen(activePolyline);
    // Smoothly traverse the route in ~75 seconds
    const TARGET_LEG_SEC = 75;
    const TICK_SEC = 1;
    const stepKmPerTick = totalDistanceKm / TARGET_LEG_SEC;

    simIntervalRef.current = setInterval(() => {
      simDistRef.current += stepKmPerTick;
      if (simDistRef.current >= totalDistanceKm) {
        simDistRef.current = totalDistanceKm;
        const last = activePolyline[activePolyline.length - 1];
        emitLocation(last[0], last[1], 0, forReturn);
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
        toast.success(forReturn ? 'Returned to origin!' : 'Arrived at MGM College campus!');
        return;
      }
      const p = pointAlong(activePolyline, simDistRef.current);
      emitLocation(p.lat, p.lng, 60, forReturn);
    }, TICK_SEC * 1000);

    // fire first point immediately
    const p0 = pointAlong(activePolyline, 0);
    emitLocation(p0.lat, p0.lng, 60, forReturn);
  }

  async function startTrip(forReturn = false) {
    if (!socket || !connected) { toast.error('Not connected'); return; }
    if (!selectedBusId) { toast.error('No assigned bus found'); return; }
    await new Promise((resolve, reject) => {
      socket.emit('trip:start', { busId: selectedBusId, isReturn: forReturn }, (ack) => {
        if (ack && ack.ok) resolve(); else reject(new Error(ack && ack.message));
      });
    }).catch((err) => { toast.error(err.message); throw err; });
    setOnTrip(true);
    setIsReturn(forReturn);
    toast.success(forReturn ? `Return trip started (College to ${originTown})` : `Outbound trip started (${originTown} to College)`);
    if (mode === 'real') startRealGps(); else startSimulated(forReturn);
  }

  function toggleReturnTrip() {
    const nextReturn = !isReturn;
    setIsReturn(nextReturn);
    toast(nextReturn ? `Switched to: College to ${originTown}` : `Switched to: ${originTown} to College`, {
      icon: nextReturn ? '🔄' : '🟢',
    });
    if (mode === 'simulated') {
      startSimulated(nextReturn);
    }
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

        {/* Dedicated Assigned Bus & Route Card */}
        <div className="mb-4 p-3.5 bg-gradient-to-br from-indigo-50/90 to-slate-50 border border-indigo-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
              Your Assigned Bus
            </span>
            <span className={`badge badge-${onTrip ? 'active' : 'idle'}`}>
              {onTrip ? 'On Trip' : 'Idle'}
            </span>
          </div>
          <div className="text-base font-bold text-slate-900">
            {selectedBus?.busNumber || 'Assigned Bus'}
          </div>
          <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
            <span className="text-indigo-600">📍</span>
            <span className="font-semibold text-slate-800">
              {selectedRoute?.name || 'Assigned Route'}
            </span>
          </div>
          {selectedRoute?.stops && (
            <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200/60 flex justify-between">
              <span>{selectedRoute.stops.length} stops</span>
              <span>Driver: {user?.name || user?.email}</span>
            </div>
          )}
        </div>

        <div>
          <label className="label">GPS Source</label>
          <div className="flex gap-2">
            <button
              className={`btn flex-1 ${mode === 'real' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={onTrip}
              onClick={() => setMode('real')}
            >Real GPS</button>
            <button
              className={`btn flex-1 ${mode === 'simulated' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={onTrip}
              onClick={() => setMode('simulated')}
            >Simulated</button>
          </div>
        </div>

        {mode === 'simulated' && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Trip Direction</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${onTrip && isReturn ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {onTrip ? (isReturn ? '🔄 Return Trip (To Origin)' : '🟢 Outbound (To College)') : (isReturn ? 'Return Trip Selected' : 'Outbound Trip Selected')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Speed</span>
              <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                60 km/h
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Smooth accelerated simulation along route path.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {!onTrip ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => startTrip(false)}
                className="btn btn-primary py-2.5 flex flex-col items-center justify-center text-center"
              >
                <span className="font-bold text-sm">Start Trip</span>
                <span className="text-[11px] opacity-80 truncate max-w-full px-1">{originTown} to College</span>
              </button>
              <button
                onClick={() => startTrip(true)}
                className="btn bg-amber-600 hover:bg-amber-700 text-white py-2.5 flex flex-col items-center justify-center text-center shadow-sm"
              >
                <span className="font-bold text-sm flex items-center gap-1">
                  <span>🔄</span> Return Trip
                </span>
                <span className="text-[11px] opacity-90 truncate max-w-full px-1">College to {originTown}</span>
              </button>
            </div>
          ) : (
            <>
              {mode === 'simulated' && (
                <button
                  type="button"
                  onClick={toggleReturnTrip}
                  className={`btn py-2.5 flex items-center justify-center gap-2 font-semibold text-white shadow-sm transition ${isReturn ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                  <span className="text-base">{isReturn ? '🟢' : '🔄'}</span>
                  <span>{isReturn ? `Switch to: ${originTown} to College` : `Switch to: College to ${originTown}`}</span>
                </button>
              )}
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
          center={pos ? [pos.lat, pos.lng] : (selectedRoute?.stops?.[0] ? [selectedRoute.stops[0].lat, selectedRoute.stops[0].lng] : [10.8971, 76.1124])}
          stops={selectedRoute?.stops || []}
          polyline={selectedRoute?.polyline || []}
          buses={pos ? [{ busId: selectedBusId, busNumber: selectedBus?.busNumber, lat: pos.lat, lng: pos.lng, status: onTrip ? 'active' : 'idle' }] : []}
        />
      </section>
    </div>
  );
}
