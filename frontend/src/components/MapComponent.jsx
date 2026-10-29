import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
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
    box-shadow:0 2px 6px rgba(0,0,0,.3); font-size:14px;">B</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function MapComponent({ center = [23.8160, 86.4410], zoom = 16, stops = [], polyline = [], buses = [] }) {
  return (
    <MapContainer center={center} zoom={zoom} className="rounded-xl overflow-hidden">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polyline && polyline.length > 1 && (
        <Polyline positions={polyline} pathOptions={{ color: '#6366f1', weight: 4, opacity: 0.7 }} />
      )}
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
              <div className="mt-2">
                <div className="font-semibold">Next stops:</div>
                {b.etas.slice(0, 3).map((e, i) => (
                  <div key={i}>{e.stopName} — {Math.round(e.etaSeconds / 60)} min</div>
                ))}
              </div>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
