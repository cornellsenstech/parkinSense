import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

// Leaflet's default marker images are loaded by URL relative to the CSS, which
// the Metro bundler doesn't serve. Drawing markers as inline SVG avoids the
// broken-image problem entirely and lets us colour them by category.
function pin(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="38" viewBox="0 0 26 38">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.4 13 25 13 25s13-15.6 13-25C26 5.8 20.2 0 13 0z" fill="${color}"/>
    <circle cx="13" cy="13" r="5" fill="#ffffff"/>
  </svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [26, 38],
    iconAnchor: [13, 38], // point of the pin sits on the coordinate
    popupAnchor: [0, -34],
  });
}

const COLORS = {
  exercise: "#16a34a",
  support: "#2563eb",
  therapy: "#7c3aed",
  facility: "#6b7280",
};

// Recentres when the patient searches a new place. MapContainer only reads
// `center` on first render, so this has to be done through the map instance.
function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon], map.getZoom());
  }, [center.lat, center.lon, map]);
  return null;
}

export default function EventMap({ center, items, onSelect }) {
  return (
    <div style={{ height: 320, borderRadius: 20, overflow: "hidden" }}>
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Recenter center={center} />

        {items.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lon]}
            icon={pin(COLORS[item.kind] || COLORS.facility)}
            eventHandlers={{ click: () => onSelect && onSelect(item) }}
          >
            <Popup>
              <strong>{item.name}</strong>
              <br />
              {item.venue}
              {item.time ? (
                <>
                  <br />
                  {item.day} at {item.time}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
