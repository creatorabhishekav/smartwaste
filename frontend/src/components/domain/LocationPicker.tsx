import { useState } from "react";
import { Crosshair, MapPin, Navigation } from "lucide-react";
import Button from "../ui/Button";
import { Input } from "../ui/Field";
import MapCanvas from "./MapCanvas";
import { WARDS, WARD_COORDS } from "../../lib/constants";

export type LngLat = { lat: number; lon: number };

type Props = {
  value: LngLat;
  address: string;
  ward: string;
  onChange: (patch: { lat?: number; lon?: number; address?: string; ward?: string }) => void;
};

/**
 * Location step of the report wizard: browser geolocation, ward presets,
 * manual coordinates and a click-to-pick OpenStreetMap canvas.
 */
export default function LocationPicker({ value, address, ward, onChange }: Props) {
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error">("idle");
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  const detect = () => {
    if (!("geolocation" in navigator)) {
      setGeoState("error");
      setGeoMessage("This browser does not expose geolocation. Enter coordinates manually.");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoState("idle");
        setGeoMessage(null);
        onChange({
          lat: Number(position.coords.latitude.toFixed(6)),
          lon: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => {
        setGeoState("error");
        setGeoMessage(
          "Location permission was denied or unavailable. Tap the map or type coordinates manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const applyWard = (nextWard: string) => {
    const coords = WARD_COORDS[nextWard];
    onChange({
      ward: nextWard,
      ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      ...(coords && !address ? { address: `${nextWard}, Kanpur` } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={detect}
          loading={geoState === "loading"}
          icon={geoState === "loading" ? undefined : <Navigation className="h-3.5 w-3.5" />}
        >
          Use my current location
        </Button>
        <span className="flex items-center gap-1 self-center text-xs text-ink-500">
          <MapPin className="h-3.5 w-3.5" />
          {value.lat.toFixed(5)}, {value.lon.toFixed(5)}
        </span>
      </div>

      {geoMessage && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{geoMessage}</p>
      )}

      <MapCanvas
        height="h-64"
        center={value}
        zoom={14}
        onMapClick={(lat, lon) => onChange({ lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) })}
        markers={[{ id: "picked", lat: value.lat, lon: value.lon, label: address || "Reported location", color: "#059669" }]}
      />
      <p className="-mt-2 text-center text-xs text-ink-400">Tap anywhere on the map to fine-tune the pin</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Ward"
          value={ward}
          list="ward-options"
          onChange={(event) => applyWard(event.target.value)}
          placeholder="e.g. Barauna"
          icon={<Crosshair className="h-4 w-4" />}
        />
        <datalist id="ward-options">
          {WARDS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <Input
          label="Latitude"
          value={value.lat.toFixed(6)}
          inputMode="decimal"
          onChange={(event) => {
            const lat = Number(event.target.value);
            if (!Number.isNaN(lat)) onChange({ lat });
          }}
        />
        <Input
          label="Longitude"
          value={value.lon.toFixed(6)}
          inputMode="decimal"
          onChange={(event) => {
            const lon = Number(event.target.value);
            if (!Number.isNaN(lon)) onChange({ lon });
          }}
        />
      </div>

      <Input
        label="Address / landmark"
        value={address}
        onChange={(event) => onChange({ address: event.target.value })}
        placeholder="e.g. Near Civil Hospital main gate, Barauna"
        hint="A nearby landmark helps the crew find the spot quickly."
      />
    </div>
  );
}
