import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default Leaflet marker icon paths for bundlers
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom animated Bus Marker with status color and radar wave
function createBusIcon(status = 'active', busNumber = 'Bus') {
  const isDelayed = status === 'delayed';
  const isActive = status === 'active';
  const bg = isDelayed ? '#e11d48' : isActive ? '#059669' : '#475569';
  const pulseClass = isActive ? 'bus-pulse-ring' : '';

  return L.divIcon({
    className: 'bus-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div class="${pulseClass}" style="
          background: ${bg};
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        ">
          🚌
        </div>
        <div style="
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(4px);
          color: #ffffff;
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 0.2px;
          padding: 2px 7px;
          border-radius: 6px;
          margin-top: 3px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.25);
        ">
          ${busNumber}
        </div>
      </div>
    `,
    iconSize: [90, 60],
    iconAnchor: [45, 20],
  });
}

// Custom Station Stop Icon with order badge or college emblem
function createStopIcon(stop) {
  const isCollege = /mgm|college/i.test(stop.name || '');
  if (isCollege) {
    return L.divIcon({
      className: 'stop-marker-college',
      html: `
        <div style="
          background: #4338ca;
          color: white;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          border: 2px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        " title="${stop.name}">
          🎓
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  return L.divIcon({
    className: 'stop-marker-regular',
    html: `
      <div style="
        background: #ffffff;
        color: #4338ca;
        border: 2.5px solid #4338ca;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      " title="${stop.name}">
        ${stop.order || '•'}
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const ROUTE_COLORS = [
  '#4f46e5', // indigo
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // rose
  '#7c3aed', // violet
  '#0891b2', // cyan
];

function MapController({ center, stops = [] }) {
  const map = useMap();
  const lastFingerprintRef = useRef('');
  const initialViewSetRef = useRef(false);

  // Auto-fit bounds ONLY when the route stops actually change (not on every GPS tick)
  useEffect(() => {
    if (!stops || stops.length === 0) {
      if (!initialViewSetRef.current && center) {
        initialViewSetRef.current = true;
        map.setView(center, 13);
      }
      return;
    }

    const fingerprint = stops.map((s) => s._id || `${s.lat},${s.lng}`).join('|');
    if (fingerprint !== lastFingerprintRef.current) {
      lastFingerprintRef.current = fingerprint;
      const points = stops.map((s) => [s.lat, s.lng]);
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
      }
    }
  }, [stops, center, map]);

  return null;
}

function MapControls({ stops = [], activeBus = null, showMyLocation = false, onMyLocationClick }) {
  const map = useMap();

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
        if (onMyLocationClick) onMyLocationClick({ lat, lng, accuracy: pos.coords.accuracy });
      },
      (err) => {
        alert(`Unable to get your location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: '10px', marginRight: '10px', zIndex: 1000 }}>
      <div className="leaflet-control flex flex-col gap-1.5">
        {stops && stops.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const points = stops.map((s) => [s.lat, s.lng]);
              if (points.length > 0) {
                map.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 16 });
              }
            }}
            className="bg-white/95 hover:bg-white text-slate-800 hover:text-indigo-600 font-bold text-xs px-3 py-2 rounded-lg shadow-md border border-slate-200 transition flex items-center gap-1.5 cursor-pointer select-none active:scale-95"
            title="Zoom to fit full route"
          >
            <span>🎯</span> Fit Route
          </button>
        )}

        {activeBus && activeBus.lat && activeBus.lng && (
          <button
            type="button"
            onClick={() => {
              map.setView([activeBus.lat, activeBus.lng], Math.max(map.getZoom(), 14), { animate: true });
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer select-none active:scale-95"
            title="Recenter on live bus"
          >
            <span className="animate-spin text-sm">🚌</span> Center Bus
          </button>
        )}

        {showMyLocation && (
          <button
            type="button"
            onClick={handleMyLocation}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer select-none active:scale-95"
            title="Show my current GPS location"
          >
            <span>📍</span> My Location
          </button>
        )}
      </div>
    </div>
  );
}

export default function MapComponent({ center = [10.8971, 76.1124], zoom = 13, stops = [], polyline = [], buses = [] }) {
  const polylinesList = useMemo(() => {
    if (!polyline || polyline.length === 0) return [];
    if (Array.isArray(polyline[0]) && Array.isArray(polyline[0][0])) {
      return polyline;
    }
    return [polyline];
  }, [polyline]);

  const activeBus = buses.find((b) => b.status === 'active' || b.lat) || buses[0] || null;

  return (
    <MapContainer center={center} zoom={zoom} className="rounded-xl overflow-hidden h-full w-full">
      <MapController center={center} stops={stops} />
      <MapControls stops={stops} activeBus={activeBus} showMyLocation={true} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polylinesList.map((pts, i) => (
        pts && pts.length > 1 ? (
          <Polyline
            key={i}
            positions={pts}
            pathOptions={{
              color: ROUTE_COLORS[i % ROUTE_COLORS.length],
              weight: 5,
              opacity: 0.85,
            }}
          />
        ) : null
      ))}
      {stops.map((s, i) => (
        <Marker
          key={s._id || i}
          position={[s.lat, s.lng]}
          icon={createStopIcon(s)}
        >
          <Popup>
            <div className="text-xs">
              <strong className="text-sm text-indigo-900 block mb-0.5">{s.name}</strong>
              <span className="text-slate-500 font-medium">Station Stop #{s.order}</span>
            </div>
          </Popup>
        </Marker>
      ))}
      {buses.map((b) => (
        <Marker
          key={b.busId || b._id}
          position={[b.lat, b.lng]}
          icon={createBusIcon(b.status, b.busNumber || 'Bus')}
        >
          <Popup>
            <div className="min-w-[190px]">
              <div className="flex items-center justify-between border-b pb-1 mb-1.5">
                <strong className="text-sm text-slate-800">{b.busNumber || 'College Bus'}</strong>
                <span className={`badge badge-${b.status || 'idle'}`}>{b.status || 'idle'}</span>
              </div>
              {Array.isArray(b.etas) && b.etas.length > 0 && (
                <div className="text-xs">
                  <div className="font-semibold text-slate-600 mb-1 flex justify-between">
                    <span>Upcoming stations</span>
                    <span className="text-slate-400 font-normal">ETA</span>
                  </div>
                  <div className="space-y-1">
                    {b.etas.slice(0, 3).map((e, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <span className="leading-tight text-slate-700">{e.stopName}</span>
                        <span className="font-bold whitespace-nowrap shrink-0 text-right min-w-[48px] text-indigo-700">
                          {e.etaSeconds < 60 ? `${e.etaSeconds}s` : `${Math.round(e.etaSeconds / 60)} min`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
