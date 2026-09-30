import { useMapEvents, Circle, MapContainer, Marker, Popup, TileLayer, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CITY_CENTER } from "../../lib/constants";

/** Inline SVG pin so no image assets are needed (Leaflet's default icons break under bundlers). */
function pinIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9.5 13 23 13 23s13-13.5 13-23C26 5.8 20.2 0 13 0z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="13" cy="13" r="4.5" fill="white"/>
    </svg>`,
    iconSize: [26, 36],
    iconAnchor: [13, 36],
    popupAnchor: [0, -32],
  });
}

const PIN_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f59e0b",
  MEDIUM: "#06b6d4",
  LOW: "#64748b",
};

export type MapMarker = {
  id: string | number;
  lat: number;
  lon: number;
  label: string;
  sublabel?: string;
  color?: string;
  radius?: number;
  onClick?: () => void;
};

type Props = {
  markers?: MapMarker[];
  circles?: MapMarker[];
  center?: { lat: number; lon: number };
  zoom?: number;
  height?: string;
  onMapClick?: (lat: number, lon: number) => void;
  legend?: { label: string; color: string }[];
};

/** Invisible child layer that turns raw map clicks into lat/lon for the report wizard. */
function ClickCapture({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (event) => onClick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

/** OpenStreetMap canvas shared by the hotspot page, report wizard and tracking page. */
export default function MapCanvas({
  markers = [],
  circles = [],
  center,
  zoom = 13,
  height = "h-[420px]",
  onMapClick,
  legend,
}: Props) {
  const origin = center ?? CITY_CENTER;

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-ink-200 ${height}`}>
      <MapContainer
        center={[origin.lat, origin.lon]}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom={false}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onMapClick && <ClickCapture onClick={onMapClick} />}
        {circles.map((circle) => (
          <Circle
            key={`circle-${circle.id}`}
            center={[circle.lat, circle.lon]}
            radius={circle.radius ?? 250}
            pathOptions={{
              color: circle.color ?? "#059669",
              fillColor: circle.color ?? "#10b981",
              fillOpacity: 0.15,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-xs font-medium">{circle.label}</span>
            </Tooltip>
          </Circle>
        ))}
        {markers.map((marker) => (
          <Marker
            key={`marker-${marker.id}`}
            position={[marker.lat, marker.lon]}
            icon={pinIcon(marker.color ?? PIN_COLORS.HIGH)}
            eventHandlers={marker.onClick ? { click: () => marker.onClick?.() } : undefined}
          >
            <Popup>
              <div className="min-w-40">
                <p className="text-xs font-semibold text-ink-900">{marker.label}</p>
                {marker.sublabel && <p className="mt-0.5 text-[11px] text-ink-600">{marker.sublabel}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {legend && legend.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[400] rounded-lg border border-ink-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">Legend</p>
          <ul className="space-y-1">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-[11px] text-ink-700">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Read-only single-point map used on complaint detail pages. */
export function MiniMap({
  lat,
  lon,
  label,
  zoom = 15,
}: {
  lat: number;
  lon: number;
  label: string;
  zoom?: number;
}) {
  return (
    <MapCanvas
      height="h-56"
      zoom={zoom}
      center={{ lat, lon }}
      markers={[{ id: "point", lat, lon, label }]}
    />
  );
}
