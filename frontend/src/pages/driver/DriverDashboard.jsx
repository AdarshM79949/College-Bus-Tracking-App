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
  const [mobileTab, setMobileTab] = useState('controls'); // 'controls' | 'map'

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
    <div className="p-2 md:p-4 flex flex-col md:grid md:grid-cols-[380px_1fr] gap-3 md:gap-4 h-[calc(100vh-56px)]">
      {/* Mobile Top View Switcher */}
      <div className="md:hidden flex bg-slate-200/90 backdrop-blur-md p-1 rounded-xl shrink-0 shadow-inner">
        <button
          type="button"
          onClick={() => setMobileTab('controls')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${mobileTab === 'controls' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'}`}
        >
          <span>🎮</span> Driver Controls {onTrip && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${mobileTab === 'map' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900'}`}
        >
          <span>🗺️</span> Live Navigation Map
        </button>
      </div>

      {/* Driver Controls Sidebar */}
      <aside className={`card overflow-y-auto space-y-4 ${mobileTab === 'controls' ? 'flex-1' : 'hidden md:block'}`}>
        <div>
          <h2 className="text-lg font-bold mb-1">Driver Dashboard</h2>
          <div className="text-xs text-slate-500">
            Status: {connected ? <span className="text-emerald-600 font-semibold">Connected</span> : <span className="text-rose-600 font-semibold">Disconnected</span>}
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <label className="label">Assigned Bus</label>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">
              {selectedBus?.busNumber || (user ? `${user.name}` : 'Loading...')}
            </span>
            <span className={`badge badge-${onTrip ? 'active' : 'idle'}`}>
              {onTrip ? 'On Trip' : 'Available'}
            </span>
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
                onClick={() => {
                  startTrip(false);
                  setMobileTab('map');
                }}
                className="btn btn-primary py-2.5 flex flex-col items-center justify-center text-center"
              >
                <span className="font-bold text-sm">Start Trip</span>
                <span className="text-[11px] opacity-80 truncate max-w-full px-1">{originTown} to College</span>
              </button>
              <button
                onClick={() => {
                  startTrip(true);
                  setMobileTab('map');
                }}
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

      {/* Map Section */}
      <section className={`card p-0 overflow-hidden relative ${mobileTab === 'map' ? 'flex-1 min-h-[400px]' : 'hidden md:block'}`}>
        {/* Mobile floating quick actions over map */}
        {onTrip && (
          <div className="md:hidden absolute top-2.5 left-2.5 right-14 z-[999] pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md p-2 rounded-xl shadow-lg border border-slate-200/80 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 truncate">{selectedBus?.busNumber}</div>
                <div className="text-[10px] text-emerald-700 font-semibold truncate">
                  {isReturn ? `🔄 To ${originTown}` : `🟢 To College`}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={flagDelay}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold rounded-md"
                >
                  Flag Delay
                </button>
                <button
                  type="button"
                  onClick={endTrip}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-md"
                >
                  End
                </button>
              </div>
            </div>
          </div>
        )}

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
