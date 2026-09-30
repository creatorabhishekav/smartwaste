import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, Check, Clock, Copy, Package, Truck } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Field";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { StatusBadge } from "../../components/domain/Badges";
import ImageDropzone from "../../components/domain/ImageDropzone";
import LocationPicker, { type LngLat } from "../../components/domain/LocationPicker";
import { useToast } from "../../context/ToastContext";
import { ApiError, api } from "../../lib/api";
import { useApi } from "../../hooks/useApi";
import { CITY_CENTER, PICKUP_WASTE_TYPES } from "../../lib/constants";
import { formatDate, todayIso } from "../../lib/format";
import type { Pickup, Paged } from "../../lib/types";

const TIME_SLOTS = [
  { value: "08:00 - 11:00", label: "Morning (8 am - 11 am)" },
  { value: "11:00 - 14:00", label: "Midday (11 am - 2 pm)" },
  { value: "14:00 - 17:00", label: "Afternoon (2 pm - 5 pm)" },
  { value: "17:00 - 20:00", label: "Evening (5 pm - 8 pm)" },
];

export default function PickupRequest() {
  const toast = useToast();
  const [params] = useSearchParams();

  const [form, setForm] = useState({
    waste_type: PICKUP_WASTE_TYPES[0],
    quantity: 5,
    unit: "kg",
    preferred_date: todayIso(),
    preferred_time: TIME_SLOTS[1].value,
    notes: "",
  });
  const [point, setPoint] = useState<LngLat>(CITY_CENTER);
  const [address, setAddress] = useState("");
  const [ward, setWard] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Pickup | null>(null);

  const { data, loading, refetch } = useApi<Paged<Pickup>>("/pickup-requests", { query: { page_size: 20 } });
  const highlight = params.get("ref");

  const patch = (key: keyof typeof form, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("waste_type", form.waste_type);
      body.append("quantity", String(form.quantity));
      body.append("unit", form.unit);
      body.append("address", address.trim());
      body.append("latitude", String(point.lat));
      body.append("longitude", String(point.lon));
      if (ward) body.append("ward", ward);
      body.append("preferred_date", form.preferred_date);
      body.append("preferred_time", form.preferred_time);
      if (form.notes.trim()) body.append("notes", form.notes.trim());
      if (photo) body.append("photo", photo);

      const result = await api<{ pickup: Pickup; message: string }>("/pickup-requests", {
        method: "POST",
        form: body,
      });
      setCreated(result.pickup);
      toast.success("Pickup requested", `${result.pickup.pickup_id} is queued for a crew.`);
      void refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not create the pickup request.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AppShell title="Pickup request" subtitle="Doorstep collection for bulk and household waste">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* --------------------------------------------------------- form */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={created ? "Request another pickup" : "New pickup request"}
            subtitle="Free for citizens · eco points awarded on completion"
            icon={<Truck className="h-4 w-4" />}
          />

          {error && (
            <div className="mb-4">
              <ErrorState error={new ApiError(error, 1, error)} />
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Waste type"
                required
                value={form.waste_type}
                onChange={(event) => patch("waste_type", event.target.value)}
                options={PICKUP_WASTE_TYPES.map((type) => ({ value: type, label: type }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantity"
                  required
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={form.quantity}
                  onChange={(event) => patch("quantity", Number(event.target.value))}
                />
                <Select
                  label="Unit"
                  value={form.unit}
                  onChange={(event) => patch("unit", event.target.value)}
                  options={[
                    { value: "kg", label: "kg" },
                    { value: "pieces", label: "pieces" },
                    { value: "bags", label: "bags" },
                  ]}
                />
              </div>
            </div>

            <div className="rounded-xl border border-ink-200 p-4">
              <p className="mb-3 text-xs font-medium text-ink-700">Collection location</p>
              <LocationPicker
                value={point}
                address={address}
                ward={ward}
                onChange={(patchValue) => {
                  if (patchValue.lat !== undefined) setPoint((p) => ({ ...p, lat: patchValue.lat as number }));
                  if (patchValue.lon !== undefined) setPoint((p) => ({ ...p, lon: patchValue.lon as number }));
                  if (patchValue.address !== undefined) setAddress(patchValue.address);
                  if (patchValue.ward !== undefined) setWard(patchValue.ward);
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Preferred date"
                type="date"
                required
                min={todayIso()}
                value={form.preferred_date}
                onChange={(event) => patch("preferred_date", event.target.value)}
                icon={<CalendarDays className="h-4 w-4" />}
              />
              <Select
                label="Preferred time slot"
                value={form.preferred_time}
                onChange={(event) => patch("preferred_time", event.target.value)}
                options={TIME_SLOTS}
              />
            </div>

            <Textarea
              label="Notes (optional)"
              rows={3}
              value={form.notes}
              onChange={(event) => patch("notes", event.target.value)}
              placeholder="e.g. Two old monitors and one printer in the ground floor store room. Ring the bell twice."
            />

            <ImageDropzone
              file={photo}
              onChange={setPhoto}
              label="Photo of the waste (optional)"
              hint="Helps the crew arrive with the right vehicle."
              compact
            />

            <Button type="submit" block size="lg" loading={pending} icon={<Truck className="h-4 w-4" />}>
              Request pickup
            </Button>
          </form>
        </Card>

        {/* ---------------------------------------------------- side panel */}
        <div className="space-y-6">
          {created && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-brand-200 bg-brand-50/60">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">Pickup requested</p>
                    <p className="text-xs text-ink-600">{created.waste_type} · {created.quantity} {created.unit}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-white px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">Pickup ID</p>
                    <p className="font-mono text-base font-semibold text-ink-900">{created.pickup_id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(created.pickup_id);
                      toast.info("Copied", created.pickup_id);
                    }}
                    className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                    aria-label="Copy pickup ID"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <StatusBadge status={created.status} />
                  <span className="text-xs text-ink-500">
                    {created.preferred_date ? formatDate(created.preferred_date) : "Any date"} ·{" "}
                    {created.preferred_time ?? "any time"}
                  </span>
                </div>
              </Card>
            </motion.div>
          )}

          <Card>
            <CardHeader title="How it works" icon={<Package className="h-4 w-4" />} />
            <ol className="space-y-3 text-sm">
              {[
                "You submit waste type, quantity, location and a preferred window.",
                "The municipal desk assigns the nearest crew with a suitable vehicle.",
                "The crew collects on the scheduled day and marks it collected.",
                "You receive eco points once the request is completed.",
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {index + 1}
                  </span>
                  <span className="text-ink-600">{step}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="My pickup requests" icon={<Clock className="h-4 w-4" />} />
            {loading && <SkeletonRows rows={3} />}
            {!loading && !data?.items.length && (
              <EmptyState title="No pickups yet" description="Your submitted requests appear here." icon={<Truck className="h-5 w-5" />} />
            )}
            {data?.items.length ? (
              <ul className="space-y-2.5">
                {data.items.slice(0, 8).map((pickup) => (
                  <li
                    key={pickup.id}
                    className={`rounded-xl border p-3 transition ${
                      highlight === pickup.pickup_id ? "border-brand-400 bg-brand-50/60" : "border-ink-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-ink-900">
                        {pickup.pickup_id}
                      </span>
                      <StatusBadge status={pickup.status} size="xs" />
                    </div>
                    <p className="mt-1 text-xs text-ink-600">
                      {pickup.waste_type} · {pickup.quantity} {pickup.unit}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-400">{pickup.address}</p>
                    {pickup.worker_name && (
                      <p className="mt-1 text-[11px] font-medium text-blue-700">Crew: {pickup.worker_name}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
