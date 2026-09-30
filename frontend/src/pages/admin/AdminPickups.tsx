import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Clock, Package, Truck } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Select } from "../../components/ui/Field";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { StatusBadge } from "../../components/domain/Badges";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api } from "../../lib/api";
import { formatDate, timeAgo } from "../../lib/format";
import type { Pickup, Paged, Worker } from "../../lib/types";

type Summary = { total: number; pending: number; completed: number; eco_points_awarded: number };

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "REQUESTED", label: "Requested" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "ON_THE_WAY", label: "On the way" },
  { value: "COLLECTED", label: "Collected" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AdminPickups() {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApi<Paged<Pickup>>("/pickup-requests", {
    query: { page, page_size: 20, ...(status ? { status } : {}) },
  });
  const summary = useApi<Summary>("/pickup-requests/summary/overview");
  const workers = useApi<Worker[]>("/workers", { query: { status: "AVAILABLE" } });

  const act = async (pickup: Pickup, label: string, run: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await run();
      toast.success(label, `${pickup.pickup_id} updated.`);
      void refetch();
      void summary.refetch();
    } catch (err) {
      toast.error("Action failed", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setBusy(null);
    }
  };
const assign = (pickup: Pickup, workerId: number) => {
    const worker = workers.data?.find((w) => w.id === workerId);
    const form = new FormData();
    form.append("worker_id", String(workerId));
    return act(pickup, `Assigned to ${worker?.name ?? "crew"}`, () =>
      api(`/pickup-requests/${pickup.pickup_id}/assign`, { method: "POST", form }),
    );
  };

  return (
    <AppShell title="Pickup requests" subtitle="Doorstep collection scheduling and crew assignment">
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {summary.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total requests", value: summary.data.total, icon: Package, tone: "slate" as const },
            { label: "Pending", value: summary.data.pending, icon: Clock, tone: "amber" as const },
            { label: "Completed", value: summary.data.completed, icon: CheckCircle2, tone: "emerald" as const },
            { label: "Eco points awarded", value: summary.data.eco_points_awarded, icon: CheckCircle2, tone: "blue" as const },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{stat.value}</p>
                  </div>
                  <stat.icon className="h-6 w-6 text-ink-300" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title="Filter requests" icon={<CalendarDays className="h-4 w-4" />} />
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                status === tab.value
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-ink-100 text-ink-600 hover:bg-ink-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {loading && (
        <Card className="mt-6">
          <SkeletonRows rows={5} />
        </Card>
      )}

      {!loading && !error && data?.items.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No pickups match" description="Adjust the status filter above." icon={<Package className="h-5 w-5" />} />
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="mt-6 space-y-3">
            {data.items.map((pickup) => (
              <Card key={pickup.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-brand-700">
                        {pickup.pickup_id}
                      </span>
                      <StatusBadge status={pickup.status} size="xs" />
                      {pickup.eco_points_awarded > 0 && (
                        <Badge tone="emerald" size="xs">+{pickup.eco_points_awarded} eco</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium text-ink-900">
                      {pickup.waste_type} · {pickup.quantity} {pickup.unit}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {pickup.address}
                      {pickup.ward ? ` · ${pickup.ward} ward` : ""} ·{" "}
                      {pickup.preferred_date ? formatDate(pickup.preferred_date) : "Any date"}
                      {pickup.preferred_time ? ` ${pickup.preferred_time}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-400">
                      {pickup.citizen_name ?? "Citizen"} · requested {timeAgo(pickup.created_at)}
                    </p>
                    {pickup.notes && <p className="mt-1.5 text-xs italic text-ink-600">“{pickup.notes}”</p>}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {pickup.worker_name ? (
                      <Badge tone="blue" size="sm">
                        <Truck className="h-3 w-3" />
                        {pickup.worker_name}
                      </Badge>
                    ) : (
                      <Select
                        className="min-w-40 py-1.5 text-xs"
                        options={[
                          { value: "", label: "Select crew…" },
                          ...(workers.data ?? []).map((worker) => ({
                            value: String(worker.id),
                            label: `${worker.name} (${worker.ward})`,
                          })),
                        ]}
                        onChange={(event) => {
                          if (event.target.value) void assign(pickup, Number(event.target.value));
                        }}
                      />
                    )}

                    {pickup.status === "ASSIGNED" && (
                      <Button
                        size="sm"
                        loading={busy === `Started ${pickup.pickup_id}`}
                        onClick={() =>
                          void act(pickup, `Started ${pickup.pickup_id}`, () =>
                            api(`/pickup-requests/${pickup.pickup_id}/status`, {
                              method: "POST",
                              body: { status: "ON_THE_WAY" },
                            }),
                          )
                        }
                        icon={<Truck className="h-3.5 w-3.5" />}
                      >
                        Dispatch
                      </Button>
                    )}
                    {pickup.status === "ON_THE_WAY" && (
                      <Button
                        size="sm"
                        loading={busy === `Collected ${pickup.pickup_id}`}
                        onClick={() =>
                          void act(pickup, `Collected ${pickup.pickup_id}`, () =>
                            api(`/pickup-requests/${pickup.pickup_id}/status`, {
                              method: "POST",
                              body: { status: "COLLECTED" },
                            }),
                          )
                        }
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      >
                        Collected
                      </Button>
                    )}
                    {pickup.status === "COLLECTED" && (
                      <Button
                        size="sm"
                        loading={busy === `Completed ${pickup.pickup_id}`}
                        onClick={() =>
                          void act(pickup, `Completed ${pickup.pickup_id}`, () =>
                            api(`/pickup-requests/${pickup.pickup_id}/status`, {
                              method: "POST",
                              body: { status: "COMPLETED" },
                            }),
                          )
                        }
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-ink-500">
                Page {data.page} of {data.pages} · {data.total} requests
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
