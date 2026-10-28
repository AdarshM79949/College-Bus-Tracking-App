import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api';
import { useSocket } from '../../hooks/useSocket';
import MapComponent from '../../components/MapComponent';

function formatEta(etaSeconds) {
  if (etaSeconds == null) return '';
  if (etaSeconds < 60) return `${Math.max(0, Math.round(etaSeconds))}s`;
  return `${Math.round(etaSeconds / 60)} min`;
}

function getStopStatus(stop, index, stopsList, liveBus, isLegActive) {
  if (!liveBus || liveBus.status !== 'active' || !isLegActive) {
    return {
      status: 'scheduled',
      label: 'Scheduled',
      pillClass: 'text-slate-400 font-normal text-xs',
    };
  }

  const etas = liveBus.etas || [];
  const remainingNames = etas.map((e) => e.stopName);
  const idx = remainingNames.indexOf(stop.name);
  const isFinalStop = index === stopsList.length - 1;

  // If the stop is not in remaining upcoming stops, it has already been passed
  if (idx === -1) {
    return {
      status: 'passed',
      label: '✓ Passed',
      pillClass: 'bg-slate-100 text-slate-500 border border-slate-200 line-through decoration-slate-400 text-[11px] font-medium px-2 py-0.5 rounded',
    };
  }

  const etaInfo = etas[idx];
  const etaText = formatEta(etaInfo.etaSeconds);

  // If this is the immediate upcoming stop
  if (idx === 0) {
    if (etaInfo.etaSeconds <= 30 || etaInfo.distanceKm < 0.25) {
      if (isFinalStop) {
        return {
          status: 'ended',
          label: '🏁 Ended',
          pillClass: 'bg-emerald-600 text-white font-bold text-xs px-2 py-0.5 rounded shadow-sm',
        };
      }
      return {
        status: 'at_station',
        label: '📍 At Station',
        pillClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-2 py-0.5 rounded animate-pulse',
      };
    }
    return {
      status: 'next',
      label: `Next (${etaText})`,
      pillClass: 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-xs px-2 py-0.5 rounded',
    };
  }

  // Future upcoming stop
  return {
    status: 'upcoming',
    label: etaText,
    pillClass: 'text-indigo-700 font-semibold text-xs',
  };
}

function StationsTable({ title, originName, destName, icon, stops, liveBus, isLegActive }) {
  return (
    <div className={`rounded-xl border transition p-3 ${isLegActive ? 'bg-white border-indigo-300 shadow-sm' : 'bg-slate-50/70 border-slate-200'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
          <span>{icon}</span>
          <span className="truncate">{title}</span>
        </div>
        {isLegActive ? (
          <span className="badge bg-emerald-100 text-emerald-800 font-bold text-[11px] shrink-0 border border-emerald-300">
            ● Bus On Trip
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 shrink-0 font-medium">Scheduled</span>
        )}
      </div>

      <div className="text-[11px] text-slate-500 mb-2.5 flex items-center gap-1 truncate">
        <span className="font-medium text-slate-600 truncate">{originName}</span>
        <span>→</span>
        <span className="font-medium text-slate-600 truncate">{destName}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 font-semibold text-[10px] uppercase">
              <th className="pb-1 w-6">#</th>
              <th className="pb-1">Station</th>
              <th className="pb-1 text-right w-24">Status / ETA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stops.map((stop, i) => {
              const statusInfo = getStopStatus(stop, i, stops, liveBus, isLegActive);
              return (
                <tr key={stop._id || i} className={`hover:bg-slate-50/50 ${statusInfo.status === 'at_station' ? 'bg-emerald-50/50' : ''}`}>
                  <td className="py-1.5 text-[11px] text-slate-400 font-mono">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    <span className={`leading-snug block ${statusInfo.status === 'passed' ? 'text-slate-400' : 'text-slate-800 font-medium'}`}>
                      {stop.name}
                    </span>
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <span className={statusInfo.pillClass}>{statusInfo.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StudentView() {
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [liveBuses, setLiveBuses] = useState({}); // busId -> payload
  const [tableFilter, setTableFilter] = useState('both'); // 'both' | 'outbound' | 'return'
  const { socket, connected } = useSocket();

  useEffect(() => {
    Promise.all([apiFetch('/api/routes'), apiFetch('/api/buses')])
      .then(([r, b]) => {
        setRoutes(r.routes);
        setBuses(b.buses);
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
              isReturn: false,
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
        prev[payload.busId] ? { ...prev, [payload.busId]: { ...prev[payload.busId], status: payload.status, isReturn: payload.isReturn } } : prev
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

  const primaryBus = busesOnRoute[0];

  const outboundStops = useMemo(() => {
    if (!selectedRoute || !selectedRoute.stops) return [];
    return [...selectedRoute.stops].sort((a, b) => a.order - b.order);
  }, [selectedRoute]);

  const returnStops = useMemo(() => {
    if (!selectedRoute || !selectedRoute.stops) return [];
    return [...selectedRoute.stops].sort((a, b) => b.order - a.order);
  }, [selectedRoute]);

  const originName = outboundStops[0]?.name || 'Origin';
  const collegeName = outboundStops[outboundStops.length - 1]?.name || 'MGM College';

  const originTown = useMemo(() => {
    if (!selectedRoute) return 'Starting Point';
    if (selectedRoute.name) {
      const firstPart = selectedRoute.name.split(' - ')[0];
      if (firstPart) return firstPart.trim();
    }
    const firstStopName = outboundStops[0]?.name || '';
    const match = firstStopName.match(/\(([^)]+)\)/);
    if (match && match[1]) return match[1].trim();
    return firstStopName.split(' ')[0] || 'Starting Point';
  }, [selectedRoute, outboundStops]);

  const isOutboundActive = Boolean(primaryBus && primaryBus.status === 'active' && !primaryBus.isReturn);
  const isReturnActive = Boolean(primaryBus && primaryBus.status === 'active' && primaryBus.isReturn);

  const mapCenter = selectedRoute?.stops?.[0]
    ? [selectedRoute.stops[0].lat, selectedRoute.stops[0].lng]
    : [10.8971, 76.1124];

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-[400px_1fr] gap-4 h-[calc(100vh-56px)]">
      <aside className="card overflow-y-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold mb-1 text-slate-800">Your Route</h2>
          <label className="label">Select route</label>
          <select
            className="input text-xs font-medium"
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
          >
            {routes.map((r) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs border-y border-slate-100 py-2">
          <div className="text-slate-500">
            GPS Stream: {connected ? <span className="text-emerald-600 font-semibold">● Connected</span> : <span className="text-rose-600 font-semibold">● Offline</span>}
          </div>
          {primaryBus && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">{primaryBus.busNumber}</span>
              <span className={`badge badge-${primaryBus.status || 'idle'}`}>{primaryBus.status || 'idle'}</span>
            </div>
          )}
        </div>

        {/* View toggle tabs for the two tables */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1.5 flex justify-between items-center">
            <span>Trip Schedule & Stations</span>
            <span className="text-[11px] text-slate-400 font-normal">2 Direction Tables</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTableFilter('both')}
              className={`py-1.5 rounded-md transition text-center truncate ${tableFilter === 'both' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              title="Show Both Tables"
            >
              📋 Both Tables
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('outbound')}
              className={`py-1.5 rounded-md transition text-center truncate ${tableFilter === 'outbound' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              title={`${originTown} to College`}
            >
              🟢 {originTown} to College
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('return')}
              className={`py-1.5 rounded-md transition text-center truncate ${tableFilter === 'return' ? 'bg-white shadow text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              title={`College to ${originTown}`}
            >
              🔄 College to {originTown}
            </button>
          </div>
        </div>

        {/* Table 1: Starting Point to College */}
        {(tableFilter === 'both' || tableFilter === 'outbound') && (
          <StationsTable
            title={`${originTown} to College`}
            originName={originName}
            destName={collegeName}
            icon="🟢"
            stops={outboundStops}
            liveBus={primaryBus}
            isLegActive={isOutboundActive}
          />
        )}

        {/* Table 2: College to Starting Point */}
        {(tableFilter === 'both' || tableFilter === 'return') && (
          <StationsTable
            title={`College to ${originTown}`}
            originName={collegeName}
            destName={originName}
            icon="🔄"
            stops={returnStops}
            liveBus={primaryBus}
            isLegActive={isReturnActive}
          />
        )}
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
