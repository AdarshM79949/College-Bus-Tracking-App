import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
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

const busIcon = (status) => L.divIcon({
  className: 'bus-marker',
  html: `<div style="
    background:${status === 'delayed' ? '#e11d48' : status === 'active' ? '#059669' : '#475569'};
    color:white; width:28px; height:28px; border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 6px rgba(0,0,0,.3); font-size:14px; font-weight:bold;">B</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

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
    // Only fit bounds if the route actually changed
    if (fingerprint !== lastFingerprintRef.current) {
      lastFingerprintRef.current = fingerprint;
      const points = stops.map((s) => [s.lat, s.lng]);
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [stops, center, map]);

  return null;
}

function FitRouteButton({ stops = [] }) {
  const map = useMap();
  if (!stops || stops.length === 0) return null;

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: '12px', marginRight: '12px' }}>
      <div className="leaflet-control">
        <button
          type="button"
          onClick={() => {
            const points = stops.map((s) => [s.lat, s.lng]);
            if (points.length > 0) {
              map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
            }
          }}
          className="bg-white/95 hover:bg-white text-slate-700 hover:text-indigo-600 font-semibold text-xs px-2.5 py-1.5 rounded-md shadow-md border border-slate-200 transition flex items-center gap-1 cursor-pointer select-none"
          title="Zoom to fit route"
        >
          <span>🎯</span> Fit Route
        </button>
      </div>
    </div>
  );
}

export default function MapComponent({ center = [10.8971, 76.1124], zoom = 13, stops = [], polyline = [], buses = [] }) {
  // Support both single polyline [[lat, lng], ...] and multi-polyline list [[[lat, lng], ...], ...]
  const polylinesList = useMemo(() => {
    if (!polyline || polyline.length === 0) return [];
    if (Array.isArray(polyline[0]) && Array.isArray(polyline[0][0])) {
      return polyline;
    }
    return [polyline];
  }, [polyline]);

  return (
    <MapContainer center={center} zoom={zoom} className="rounded-xl overflow-hidden h-full w-full">
      <MapController center={center} stops={stops} />
      <FitRouteButton stops={stops} />
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
              weight: 4,
              opacity: 0.8,
            }}
          />
        ) : null
      ))}
      {stops.map((s, i) => (
        <CircleMarker
          key={s._id || i}
          center={[s.lat, s.lng]}
          radius={6}
          pathOptions={{ color: '#4338ca', fillColor: '#818cf8', fillOpacity: 1 }}
        >
          <Popup>
            <strong>{s.name}</strong>
            <br />Stop #{s.order}
          </Popup>
        </CircleMarker>
      ))}
      {buses.map((b) => (
        <Marker key={b.busId || b._id} position={[b.lat, b.lng]} icon={busIcon(b.status)}>
          <Popup>
            <strong>{b.busNumber || 'Bus'}</strong>
            <br />Status: {b.status || 'unknown'}
            {Array.isArray(b.etas) && b.etas.length > 0 && (
              <div className="mt-2 text-xs border-t border-slate-200 pt-1.5">
                <div className="font-semibold text-slate-700 mb-1 flex justify-between">
                  <span>Next stops</span>
                  <span className="text-slate-400 font-normal">ETA</span>
                </div>
                <div className="space-y-1">
                  {b.etas.slice(0, 3).map((e, i) => (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <span className="leading-tight">{e.stopName}</span>
                      <span className="font-semibold whitespace-nowrap shrink-0 text-right min-w-[48px] text-indigo-700">
                        {e.etaSeconds < 60 ? `${e.etaSeconds}s` : `${Math.round(e.etaSeconds / 60)} min`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
