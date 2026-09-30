import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Layers, MapPinned, Navigation, RefreshCw } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import MapCanvas, { type MapMarker } from "../../components/domain/MapCanvas";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api } from "../../lib/api";
import { CITY_CENTER } from "../../lib/constants";
import { timeAgo } from "../../lib/format";
import type { Hotspot } from "../../lib/types";

export default function HotspotMap() {
  const toast = useToast();
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const { data, loading, error, refetch } = useApi<Hotspot[]>("/hotspots", {
    query: { refresh: false },
  });

  const recompute = async () => {
    setRecomputing(true);
    try {
      const result = await api<{ count: number }>("/admin/recompute", { method: "POST" });
      toast.success("Hotspots recomputed", `${result.count} clusters refreshed.`);
      void refetch();
    } catch (err) {
      toast.error("Recompute failed", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setRecomputing(false);
    }
  };

  const markers: MapMarker[] = useMemo(
    () =>
      (data ?? []).map((hotspot) => ({
        id: hotspot.code,
        lat: hotspot.latitude,
        lon: hotspot.longitude,
        label: hotspot.label,
        sublabel: `${hotspot.complaint_count} reports · ${hotspot.critical_count} critical`,
        color:
          hotspot.critical_count >= 3 ? "#dc2626" : hotspot.intensity >= 60 ? "#f59e0b" : "#0ea5e9",
        onClick: () => setSelected(hotspot),
      })),
    [data],
  );

  const circles: MapMarker[] = useMemo(
    () =>
      (data ?? []).map((hotspot) => ({
        id: `c-${hotspot.code}`,
        lat: hotspot.latitude,
        lon: hotspot.longitude,
        label: hotspot.label,
        radius: hotspot.radius_meters,
        color:
          hotspot.critical_count >= 3 ? "#dc2626" : hotspot.intensity >= 60 ? "#f59e0b" : "#0ea5e9",
      })),
    [data],
  );

  return (
    <AppShell title="Hotspot map" subtitle="Clustered problem areas with privacy-rounded coordinates">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Live clustering"
            subtitle="Recomputed from open complaint density"
            icon={<MapPinned className="h-4 w-4" />}
            action={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={showLabels ? "outline" : "ghost"}
                  onClick={() => setShowLabels((v) => !v)}
                  icon={<Layers className="h-3.5 w-3.5" />}
                >
                  {showLabels ? "Hide circles" : "Show circles"}
                </Button>
                <Button
                  size="sm"
                  loading={recomputing}
                  onClick={() => void recompute()}
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Recompute
                </Button>
              </div>
            }
          />
          {error && <ErrorState error={error} onRetry={() => void refetch()} />}
          {loading && <SkeletonRows rows={4} />}
          {!loading && !error && data?.length === 0 && (
            <EmptyState title="No hotspots detected" description="Clusters appear as complaints accumulate." icon={<MapPinned className="h-5 w-5" />} />
          )}
          {data && data.length > 0 && (
            <>
              <MapCanvas
                markers={markers}
                circles={showLabels ? circles : []}
                center={CITY_CENTER}
                zoom={12}
                height="h-[480px]"
                legend={[
                  { label: "High critical count", color: "#dc2626" },
                  { label: "Moderate intensity", color: "#f59e0b" },
                  { label: "Low intensity", color: "#0ea5e9" },
                ]}
              />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                <Navigation className="h-3 w-3" />
                Coordinates are rounded to protect citizen privacy; exact addresses stay in the report record.
              </p>
            </>
          )}
        </Card>

        {selected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-brand-200 bg-brand-50/40">
              <CardHeader
                title={selected.label}
                subtitle={`${selected.ward} ward · ${selected.code} · updated ${timeAgo(selected.last_updated)}`}
                icon={<Flame className="h-4 w-4" />}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {[
                  { label: "Total reports", value: selected.complaint_count },
                  { label: "Critical", value: selected.critical_count },
                  { label: "Open", value: selected.open_count },
                  { label: "Intensity", value: `${selected.intensity}%` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">{stat.label}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-ink-900">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1.5 text-sm">
                <p className="text-ink-700">
                  <span className="font-medium text-ink-900">Top issue:</span> {selected.top_issue}
                </p>
                <p className="text-ink-700">
                  <span className="font-medium text-ink-900">Recommended action:</span>{" "}
                  {selected.recommended_action}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <Badge tone="slate" size="sm">Radius {selected.radius_meters} m</Badge>
                <Badge tone={selected.critical_count >= 3 ? "red" : "amber"} size="sm">
                  {selected.critical_count >= 3 ? "Needs escalation" : "Monitor"}
                </Badge>
              </div>
            </Card>
          </motion.div>
        )}

        {data && data.length > 0 && (
          <Card>
            <CardHeader title="All hotspots" subtitle="Ranked by intensity" icon={<Flame className="h-4 w-4" />} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.map((hotspot) => (
                <button
                  key={hotspot.code}
                  type="button"
                  onClick={() => setSelected(hotspot)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selected?.code === hotspot.code
                      ? "border-brand-400 bg-brand-50/60"
                      : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink-900">{hotspot.label}</p>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-brand-700">
                      {hotspot.intensity}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {hotspot.ward} ward · {hotspot.complaint_count} reports
                  </p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-ink-600">{hotspot.top_issue}</p>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
