import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import MapComponent from '../../components/MapComponent';

// Client-side route simulator & distance helpers
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

// Snaps coordinates to the nearest road polyline point within maxDistKm
function snapToPolyline(point, polyline, maxDistKm = 1.5) {
  if (!point || !polyline || polyline.length < 2) return point;
  let bestDist = Infinity;
  let bestPoint = point;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = { lat: polyline[i][0], lng: polyline[i][1] };
    const b = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = { lat: a.lat + t * dy, lng: a.lng + t * dx };
    const dist = haversineKm(point, proj);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = proj;
    }
  }

  if (bestDist <= maxDistKm) {
    return { lat: bestPoint.lat, lng: bestPoint.lng, snapped: true, snapDistanceKm: bestDist };
  }
  return point;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [onTrip, setOnTrip] = useState(false);
  const [mode, setMode] = useState('real'); // 'real' | 'simulated'
  const [isReturn, setIsReturn] = useState(false);
  const [pos, setPos] = useState(null);
  const [mobileTab, setMobileTab] = useState('controls'); // 'controls' | 'map'

  // Enhanced GPS diagnostics
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'acquiring' | 'locked' | 'error'
  const [gpsData, setGpsData] = useState(null); // { lat, lng, accuracy, speed, heading, updatedAt, provider, snapped }
  const [isTestingGps, setIsTestingGps] = useState(false);
  const [snapToRoute, setSnapToRoute] = useState(true);

  const simDistRef = useRef(0);
  const simIntervalRef = useRef(null);
  const watchIdRef = useRef(null);
  const heartbeatRef = useRef(null);
  const lastPosRef = useRef(null);
  const isReturnRef = useRef(isReturn);
  isReturnRef.current = isReturn;
  const snapToRouteRef = useRef(snapToRoute);
  snapToRouteRef.current = snapToRoute;
  const activePolylineRef = useRef([]);

  const isSecure = typeof window !== 'undefined'
    ? (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    : true;

  useEffect(() => {
    Promise.all([apiFetch('/api/buses'), apiFetch('/api/routes')])
      .then(([b, r]) => {
        // Driver only sees and operates their assigned bus, admins have fleet-wide access
        const myBuses = b.buses.filter((bus) => {
          if (!bus.driverId) return false;
          const did = bus.driverId?._id || bus.driverId;
          const uid = user?._id || user?.id;
          return String(did) === String(uid);
        });
        const assignedBuses = (user?.role === 'admin' || myBuses.length === 0) ? b.buses : myBuses;
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

  useEffect(() => {
    if (selectedRoute && selectedRoute.polyline) {
      activePolylineRef.current = selectedRoute.polyline;
    }
  }, [selectedRoute]);

  const originTown = useMemo(() => {
    if (!selectedRoute) return 'Origin';
    if (selectedRoute.name) {
      const first = selectedRoute.name.split(' - ')[0];
      if (first) return first.trim();
    }
    return 'Origin';
  }, [selectedRoute]);

  // Cleanly stops all GPS watchers, heartbeats, and simulators
  const stopLocationSource = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => () => stopLocationSource(), []);

  function emitLocation(lat, lng, speed, returnFlag = isReturnRef.current) {
    if (!socket || !selectedBusId) return;
    socket.emit('location:update', { busId: selectedBusId, lat, lng, speed, isReturn: returnFlag });
    setPos({ lat, lng });
  }

  // Pre-trip test / acquire GPS fix
  function testGpsSignal() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation not supported in this browser');
      return;
    }
    setIsTestingGps(true);
    setGpsStatus('acquiring');

    const handlePos = (p) => {
      const rawLat = p.coords.latitude;
      const rawLng = p.coords.longitude;
      const accuracyMeters = Math.round(p.coords.accuracy || 0);
      const speedKmh = Math.round((p.coords.speed || 0) * 3.6);

      const targetPoly = activePolylineRef.current;
      const processed = snapToRouteRef.current && targetPoly.length > 1
        ? snapToPolyline({ lat: rawLat, lng: rawLng }, targetPoly)
        : { lat: rawLat, lng: rawLng };

      const info = {
        lat: processed.lat,
        lng: processed.lng,
        rawLat,
        rawLng,
        accuracy: accuracyMeters,
        speed: speedKmh,
        updatedAt: new Date(),
        provider: accuracyMeters <= 20 ? 'Hardware GPS (High Precision)' : 'Network / Wi-Fi',
        snapped: Boolean(processed.snapped),
        snapDistanceKm: processed.snapDistanceKm,
      };

      setGpsData(info);
      setGpsStatus('locked');
      setPos({ lat: processed.lat, lng: processed.lng });
      lastPosRef.current = info;
      setIsTestingGps(false);
      toast.success(`GPS Locked! ±${accuracyMeters}m accuracy`);
    };

    const handleErr = (err) => {
      // Fallback with enableHighAccuracy: false
      navigator.geolocation.getCurrentPosition(
        handlePos,
        (fallbackErr) => {
          setIsTestingGps(false);
          setGpsStatus('error');
          if (fallbackErr.code === 1) {
            toast.error('Location permission denied. Please allow location in browser.');
          } else {
            toast.error(`GPS Error: ${fallbackErr.message}`);
          }
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 5000 }
      );
    };

    navigator.geolocation.getCurrentPosition(handlePos, handleErr, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 2000,
    });
  }

  // Real Hardware GPS Stream with auto-recovery and fallback
  function startRealGps(retryWithLowAccuracy = false) {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation not supported in this browser');
      setGpsStatus('error');
      return;
    }

    stopLocationSource();
    setGpsStatus('acquiring');

    const options = retryWithLowAccuracy
      ? { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }
      : { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 };

    const onLocationSuccess = (p) => {
      const rawLat = p.coords.latitude;
      const rawLng = p.coords.longitude;
      const accuracyMeters = Math.round(p.coords.accuracy || 0);
      const speedKmh = Math.round((p.coords.speed || 0) * 3.6);

      const targetPoly = activePolylineRef.current;
      const processed = snapToRouteRef.current && targetPoly.length > 1
        ? snapToPolyline({ lat: rawLat, lng: rawLng }, targetPoly)
        : { lat: rawLat, lng: rawLng };

      const info = {
        lat: processed.lat,
        lng: processed.lng,
        rawLat,
        rawLng,
        accuracy: accuracyMeters,
        speed: speedKmh,
        updatedAt: new Date(),
        provider: accuracyMeters <= 20 ? 'Hardware GPS (High Precision)' : 'Network / Wi-Fi',
        snapped: Boolean(processed.snapped),
        snapDistanceKm: processed.snapDistanceKm,
      };

      setGpsData(info);
      setGpsStatus('locked');
      lastPosRef.current = info;
      emitLocation(processed.lat, processed.lng, speedKmh, isReturnRef.current);
    };

    const onLocationError = (err) => {
      console.warn('[GPS] Error occurred:', err.message, 'Code:', err.code);
      // Auto-fallback from high accuracy satellite timeout to network positioning
      if (!retryWithLowAccuracy && (err.code === 3 || err.code === 2)) {
        console.log('[GPS] Switching to network/Wi-Fi positioning fallback...');
        startRealGps(true);
        return;
      }
      setGpsStatus('error');
      if (err.code === 1) {
        toast.error('GPS permission denied. Enable location in browser settings.');
      } else {
        toast.error(`GPS Error: ${err.message}`);
      }
    };

    // 1. Immediately request a fix
    navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, options);

    // 2. Continuous watch for movements
    watchIdRef.current = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, options);

    // 3. Heartbeat interval: keep emitting every 3s so the 30s delay watchdog never triggers when stationary
    heartbeatRef.current = setInterval(() => {
      if (lastPosRef.current) {
        emitLocation(
          lastPosRef.current.lat,
          lastPosRef.current.lng,
          lastPosRef.current.speed,
          isReturnRef.current
        );
      }
    }, 3000);
  }

  function startSimulated(forReturn = isReturn) {
    if (!selectedRoute || !selectedRoute.polyline || selectedRoute.polyline.length < 2) {
      toast.error('Selected route has no polyline; cannot simulate');
      return;
    }
    stopLocationSource();
    setIsReturn(forReturn);
    isReturnRef.current = forReturn;

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

    // Fire first point immediately
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
    isReturnRef.current = forReturn;
    toast.success(forReturn ? `Return trip started (College to ${originTown})` : `Outbound trip started (${originTown} to College)`);

    if (mode === 'real') {
      startRealGps();
    } else {
      startSimulated(forReturn);
    }
  }

  function toggleReturnTrip() {
    const nextReturn = !isReturn;
    setIsReturn(nextReturn);
    isReturnRef.current = nextReturn;
    toast(nextReturn ? `Switched to: College to ${originTown}` : `Switched to: ${originTown} to College`, {
      icon: nextReturn ? '🔄' : '🟢',
    });

    if (mode === 'simulated') {
      startSimulated(nextReturn);
    } else if (lastPosRef.current) {
      emitLocation(lastPosRef.current.lat, lastPosRef.current.lng, lastPosRef.current.speed, nextReturn);
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

  function handleMyLocationClick(location) {
    if (socket && selectedBusId) {
      socket.emit('location:update', {
        busId: selectedBusId,
        lat: location.lat,
        lng: location.lng,
        speed: 0,
        isReturn: isReturnRef.current,
      });
      toast.success('Location shared', { icon: '📍' });
    }
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
            Socket: {connected ? <span className="text-emerald-600 font-semibold">● Connected</span> : <span className="text-rose-600 font-semibold">● Disconnected</span>}
          </div>
        </div>

        {/* Insecure Context Warning for mobile testing over HTTP */}
        {!isSecure && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800 space-y-1">
            <div className="font-bold flex items-center gap-1">
              <span>⚠️</span> Mobile HTTP Geolocation Notice
            </div>
            <p>
              Mobile browsers block GPS on plain HTTP (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{window.location.host}</code>).
            </p>
            <p className="text-[11px] text-amber-700">
              For phone testing: use a live HTTPS URL (Vercel/Render) or Simulated Mode on phone.
            </p>
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <label className="label">Assigned Fleet Vehicle</label>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">
              {selectedBus?.busNumber || (user ? `${user.name}` : 'Loading...')}
            </span>
            <span className={`badge badge-${onTrip ? 'active' : 'idle'}`}>
              {onTrip ? 'On Trip' : 'Available'}
            </span>
          </div>

          {/* Bus Selector if multiple buses are available */}
          {buses.length > 1 && (
            <div className="mt-2.5">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Switch Bus Route</label>
              <select
                className="input text-xs font-semibold py-1.5"
                value={selectedBusId}
                disabled={onTrip}
                onChange={(e) => setSelectedBusId(e.target.value)}
              >
                {buses.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.busNumber} ({b.routeId?.name || 'Route'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-xs text-slate-600 mt-2 flex items-center gap-1.5">
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
          <label className="label">GPS Tracking Engine</label>
          <div className="flex gap-2">
            <button
              className={`btn flex-1 ${mode === 'real' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={onTrip}
              onClick={() => setMode('real')}
            >
              🛰️ Real GPS
            </button>
            <button
              className={`btn flex-1 ${mode === 'simulated' ? 'btn-primary' : 'btn-secondary'}`}
              disabled={onTrip}
              onClick={() => setMode('simulated')}
            >
              🔄 Simulated
            </button>
          </div>
        </div>

        {/* Real GPS Diagnostics & Controls Card */}
        {mode === 'real' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">GPS Status</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                gpsStatus === 'locked' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                gpsStatus === 'acquiring' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                gpsStatus === 'error' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {gpsStatus === 'locked' && '🟢 GPS Locked'}
                {gpsStatus === 'acquiring' && '🟡 Acquiring Satellite...'}
                {gpsStatus === 'error' && '🔴 Check Permission'}
                {gpsStatus === 'idle' && '⚪ Ready'}
              </span>
            </div>

            {gpsData ? (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5 shadow-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Coordinates:</span>
                  <span className="font-mono font-bold text-slate-800">{gpsData.lat.toFixed(5)}, {gpsData.lng.toFixed(5)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Accuracy:</span>
                  <span className="font-semibold text-emerald-700">±{gpsData.accuracy}m ({gpsData.provider})</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Speed:</span>
                  <span className="font-semibold text-slate-800">{gpsData.speed} km/h</span>
                </div>
                {gpsData.snapped && (
                  <div className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 pt-1 border-t border-slate-100">
                    <span>🛣️</span> Snapped to college highway path
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 leading-snug">
                Click below to acquire and verify your device's live GPS signal before starting the trip.
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={testGpsSignal}
                disabled={isTestingGps}
                className="btn btn-secondary flex-1 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <span>🛰️</span> {isTestingGps ? 'Testing Fix...' : 'Acquire / Test GPS'}
              </button>
              {pos && (
                <button
                  type="button"
                  onClick={() => setMobileTab('map')}
                  className="btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-1.5 text-xs font-semibold px-2.5"
                  title="View on Map"
                >
                  📍 View Map
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={snapToRoute}
                onChange={(e) => setSnapToRoute(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Snap GPS onto route roads (recommended)</span>
            </label>
          </div>
        )}

        {/* Simulated Mode Info Card */}
        {mode === 'simulated' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Trip Direction</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${onTrip && isReturn ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {onTrip ? (isReturn ? '🔄 Return Trip (To Origin)' : '🟢 Outbound (To College)') : (isReturn ? 'Return Trip Selected' : 'Outbound Trip Selected')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Simulation Velocity</span>
              <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                60 km/h (Smooth Traversal)
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Deterministic polyline progression along actual road networks.
            </p>
          </div>
        )}

        {/* Start / Control Buttons */}
        <div className="mt-6 flex flex-col gap-2">
          {!onTrip ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  startTrip(false);
                  setMobileTab('map');
                }}
                className="btn btn-primary py-2.5 flex flex-col items-center justify-center text-center shadow-sm"
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
              <button
                type="button"
                onClick={toggleReturnTrip}
                className={`btn py-2.5 flex items-center justify-center gap-2 font-semibold text-white shadow-sm transition ${isReturn ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                <span className="text-base">{isReturn ? '🟢' : '🔄'}</span>
                <span>{isReturn ? `Switch to: ${originTown} to College` : `Switch to: College to ${originTown}`}</span>
              </button>
              <button onClick={flagDelay} className="btn btn-secondary py-2 font-semibold">Flag Delay</button>
              <button onClick={endTrip} className="btn btn-danger py-2 font-semibold">End Trip</button>
            </>
          )}
        </div>

        {pos && (
          <div className="text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-200">
            <div className="font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Streaming Coordinates</span>
              {onTrip && <span className="text-emerald-600 font-bold">● Active</span>}
            </div>
            <div className="font-mono text-slate-600 text-[11px]">
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
            </div>
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
          onMyLocationClick={handleMyLocationClick}
        />
      </section>
    </div>
  );
}
