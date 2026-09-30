import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Star, Truck, UserX, Users } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import StatCard from "../../components/ui/StatCard";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { StatusBadge } from "../../components/domain/Badges";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api } from "../../lib/api";
import { WARDS } from "../../lib/constants";
import { formatDuration } from "../../lib/format";
import type { Worker, WorkerStatus } from "../../lib/types";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "AVAILABLE", label: "Available" },
  { value: "BUSY", label: "On job" },
  { value: "OFFLINE", label: "Offline" },
];

export default function AdminWorkers() {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [ward, setWard] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const { data, loading, error, refetch } = useApi<Worker[]>("/workers", {
    query: { ...(status ? { status } : {}), ...(ward ? { ward } : {}) },
  });

  const workers = useMemo(() => {
    const list = data ?? [];
    if (!search.trim()) return list;
    const needle = search.trim().toLowerCase();
    return list.filter((worker) =>
      [worker.name, worker.employee_code, worker.ward, worker.vehicle_number ?? ""].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [data, search]);

  const stats = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      available: list.filter((w) => w.status === "AVAILABLE").length,
      busy: list.filter((w) => w.status === "BUSY").length,
      offline: list.filter((w) => w.status === "OFFLINE").length,
      avgRating: list.length
        ? (list.reduce((sum, w) => sum + w.rating, 0) / list.length).toFixed(1)
        : "0.0",
      completion: list.reduce((sum, w) => sum + w.total_completed, 0),
    };
  }, [data]);

  const setWorkerStatus = async (worker: Worker, next: WorkerStatus) => {
    setBusy(worker.id);
    try {
      await api(`/workers/${worker.id}`, { method: "PATCH", body: { status: next } });
      toast.success("Status updated", `${worker.name} → ${next.toLowerCase()}`);
      void refetch();
    } catch (err) {
      toast.error("Update failed", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell title="Crew management" subtitle="Worker availability, workload and performance">
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total crews" value={stats.total} icon={Users} />
          <StatCard label="Available" value={stats.available} icon={Truck} tone="emerald" />
          <StatCard label="On job" value={stats.busy} icon={Truck} tone="amber" />
          <StatCard label="Avg rating" value={`${stats.avgRating} / 5`} icon={Star} tone="cyan" />
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title="Filter crews" icon={<Search className="h-4 w-4" />} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-ink-100 p-0.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  status === filter.value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <select
            value={ward}
            onChange={(event) => setWard(event.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All wards</option>
            {WARDS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, code or vehicle"
              className="w-full rounded-lg border border-ink-200 bg-white py-1.5 pl-9 pr-3 text-xs text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
      </Card>

      {loading && (
        <Card className="mt-6">
          <SkeletonRows rows={5} />
        </Card>
      )}

      {!loading && !error && workers.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No crews match" description="Adjust the filters above." icon={<Users className="h-5 w-5" />} />
        </div>
      )}

      {workers.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workers.map((worker, index) => (
            <motion.div
              key={worker.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.3) }}
            >
              <Card className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{worker.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {worker.employee_code} · {worker.ward} ward
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {worker.vehicle_number ? `Vehicle ${worker.vehicle_number}` : "No vehicle assigned"}
                    </p>
                  </div>
                  <StatusBadge status={worker.status} size="xs" />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-ink-100 py-3 text-center">
                  {[
                    { label: "Assigned", value: worker.total_assigned },
                    { label: "Completed", value: worker.total_completed },
                    { label: "Rating", value: worker.rating },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <dt className="text-[10px] uppercase tracking-wide text-ink-500">{stat.label}</dt>
                      <dd className="mt-0.5 text-sm font-bold tabular-nums text-ink-900">{stat.value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-3 text-xs text-ink-500">
                  Avg resolution {formatDuration(worker.average_resolution_minutes)}
                </p>

                <div className="mt-3 flex gap-1.5">
                  {(["AVAILABLE", "BUSY", "OFFLINE"] as WorkerStatus[]).map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={busy === worker.id || worker.status === next}
                      onClick={() => void setWorkerStatus(worker, next)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition disabled:opacity-40 ${
                        worker.status === next
                          ? "border-brand-500 bg-brand-50 text-brand-800"
                          : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                      }`}
                    >
                      {next === "AVAILABLE" ? "Available" : next === "BUSY" ? "On job" : "Offline"}
                    </button>
                  ))}
                </div>

                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-400">
                  <UserX className="h-3 w-3" />
                  {worker.latitude && worker.longitude
                    ? `Position ${worker.latitude.toFixed(3)}, ${worker.longitude.toFixed(3)}`
                    : "Position not shared"}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {stats.total > 0 && (
        <Card className="mt-6">
          <p className="text-sm text-ink-600">
            <span className="font-semibold text-ink-900">{stats.completion}</span> jobs completed by all crews
            since the seed. Status changes notify the crew instantly.
          </p>
          <div className="mt-3">
            <Badge tone="slate" size="sm">
              {stats.available} available now
            </Badge>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
