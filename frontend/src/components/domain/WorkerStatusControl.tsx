import { useState } from "react";
import { MapPin, Navigation, Radio } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { ApiError, api } from "../../lib/api";
import { WORKER_STATUS_META } from "../../lib/constants";
import type { Worker, WorkerStatus } from "../../lib/types";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

const OPTIONS: { value: WorkerStatus; label: string; hint: string }[] = [
  { value: "AVAILABLE", label: "Available", hint: "You can be assigned new jobs" },
  { value: "BUSY", label: "On job", hint: "Working through an assignment" },
  { value: "OFFLINE", label: "Offline", hint: "Shift finished or unavailable" },
];

export default function WorkerStatusControl({
  worker,
  onChanged,
}: {
  worker: Worker;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const meta = WORKER_STATUS_META[worker.status] ?? WORKER_STATUS_META.AVAILABLE;

  const change = async (status: WorkerStatus) => {
    setBusy(true);
    try {
      await api(`/workers/${worker.id}`, { method: "PATCH", body: { status } });
      toast.success("Status updated", OPTIONS.find((o) => o.value === status)?.hint ?? status);
      onChanged?.();
    } catch (err) {
      toast.error("Could not update status", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation unavailable", "This browser does not expose a location API.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await api<{ worker: Worker }>(`/workers/${worker.id}`, {
            method: "PATCH",
            body: { latitude, longitude },
          });
          toast.success(
            "Location shared",
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)} is now visible to dispatch.`,
          );
          onChanged?.();
        } catch (err) {
          toast.error(
            "Could not share location",
            err instanceof ApiError ? err.detail : "Unknown error",
          );
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Location denied", "Allow location access in your browser to share position.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              worker.status === "AVAILABLE"
                ? "bg-brand-50 text-brand-700"
                : worker.status === "BUSY"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-ink-100 text-ink-500"
            }`}
          >
            <Radio className={`h-5 w-5 ${worker.status === "AVAILABLE" ? "animate-pulse" : ""}`} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">{worker.name}</p>
            <p className="text-xs text-ink-500">
              {worker.employee_code} · {worker.ward} ward
              {worker.vehicle_number ? ` · ${worker.vehicle_number}` : ""}
            </p>
          </div>
          <Badge tone={meta.tone} size="sm">
            {meta.label}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            loading={locating}
            onClick={shareLocation}
            icon={<Navigation className="h-3.5 w-3.5" />}
          >
            Share location
          </Button>
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={busy || worker.status === option.value}
              onClick={() => void change(option.value)}
              title={option.hint}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                worker.status === option.value
                  ? "border-brand-500 bg-brand-50 text-brand-800"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-ink-100 pt-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {worker.latitude && worker.longitude
            ? `Position ${worker.latitude.toFixed(4)}, ${worker.longitude.toFixed(4)}`
            : "No position shared yet"}
        </span>
        <span>Zone {worker.zone ?? "—"}</span>
      </div>
    </div>
  );
}
