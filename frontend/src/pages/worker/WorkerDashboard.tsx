import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Gauge,
  MapPin,
  Navigation,
  Package,
  Star,
  Truck,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import StatCard from "../../components/ui/StatCard";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import WorkerStatusControl from "../../components/domain/WorkerStatusControl";
import { useApi } from "../../hooks/useApi";
import { ApiError, api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { formatDistance, formatDuration } from "../../lib/format";
import type { WorkerDashboard } from "../../lib/types";

type StatusPayload = { message?: string };

export default function WorkerDashboard() {
  const toast = useToast();
  const { data, loading, error, refetch } = useApi<WorkerDashboard>("/workers/me/dashboard");
  const [busy, setBusy] = useState<string | null>(null);

  const start = async (ref: string) => {
    setBusy(ref);
    try {
      await api<StatusPayload>(`/complaints/${ref}/status`, {
        method: "POST",
        body: { status: "ON_THE_WAY" },
      });
      toast.success("On the way", "The citizen has been notified.");
      void refetch();
    } catch (err) {
      toast.error("Could not update", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell title="Field dashboard" subtitle="Your route, tasks and today’s performance">
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />
            ))}
          </div>
          <Card>
            <SkeletonRows rows={4} />
          </Card>
        </div>
      )}

      {data && (
        <>
          {/* status control */}
          <WorkerStatusControl worker={data.worker} onChanged={() => void refetch()} />

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tasks today" value={data.summary.today_tasks} icon={Truck} tone="emerald" />
            <StatCard label="Active" value={data.summary.active} icon={Navigation} tone="blue" />
            <StatCard label="Completed" value={data.summary.completed} icon={CheckCircle2} tone="emerald" />
            <StatCard label="Critical" value={data.summary.critical} icon={Gauge} tone="red" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader
                  title="Active tasks"
                  subtitle="Jobs you are working through right now"
                  icon={<Navigation className="h-4 w-4" />}
                  action={
                    <Link to="/worker/tasks">
                      <Button size="sm" variant="ghost" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                        All tasks
                      </Button>
                    </Link>
                  }
                />
                {data.active.length === 0 ? (
                  <EmptyState
                    title="No active tasks"
                    description="Accept a pending job to start working."
                    icon={<Navigation className="h-5 w-5" />}
                  />
                ) : (
                  <ul className="space-y-3">
                    {data.active.map((task) => (
                      <motion.li
                        key={task.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-ink-200 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-brand-700">
                                {task.complaint_id}
                              </span>
                              <PriorityBadge level={task.priority_level} score={task.priority_score} size="xs" />
                              <StatusBadge status={task.status} size="xs" />
                            </div>
                            <p className="mt-2 text-sm font-medium text-ink-900">{task.address}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                              <MapPin className="h-3 w-3" />
                              {formatDistance(task.distance_km)} from your position
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            {task.status === "ASSIGNED" && (
                              <Button
                                size="sm"
                                loading={busy === task.complaint_id}
                                onClick={() => void start(task.complaint_id)}
                                icon={<Navigation className="h-3.5 w-3.5" />}
                              >
                                Start
                              </Button>
                            )}
                            <Link to={`/worker/task/${task.complaint_id}`}>
                              <Button size="sm" variant="outline">
                                Open
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Pending assignments"
                  subtitle="Ordered by priority score"
                  icon={<Clock className="h-4 w-4" />}
                />
                {data.pending.length === 0 ? (
                  <EmptyState title="Queue is clear" description="No pending assignments right now." icon={<CheckCircle2 className="h-5 w-5" />} />
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {data.pending.map((task) => (
                      <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-ink-800">
                              {task.complaint_id}
                            </span>
                            <PriorityBadge level={task.priority_level} score={task.priority_score} size="xs" />
                            <CategoryChip category={task.category} size="xs" />
                          </div>
                          <p className="mt-1 truncate text-xs text-ink-500">
                            {task.address} · {formatDistance(task.distance_km)}
                          </p>
                        </div>
                        <Link to={`/worker/task/${task.complaint_id}`}>
                          <Button size="sm" variant="outline">
                            Details
                          </Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Your performance" icon={<Star className="h-4 w-4" />} />
                <dl className="space-y-3 text-sm">
                  {[
                    { label: "Total assigned", value: data.worker.total_assigned },
                    { label: "Total completed", value: data.worker.total_completed },
                    { label: "Average resolution", value: formatDuration(data.summary.avg_resolution_minutes || data.worker.average_resolution_minutes) },
                    { label: "Rating", value: `${data.worker.rating} / 5` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 border-b border-ink-100 pb-2.5 last:border-0">
                      <dt className="text-ink-500">{row.label}</dt>
                      <dd className="font-semibold tabular-nums text-ink-900">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              <Card>
                <CardHeader title="Pickup requests" icon={<Package className="h-4 w-4" />} />
                {data.pickups.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-500">No pickups assigned.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.pickups.slice(0, 6).map((pickup) => (
                      <li key={pickup.id} className="rounded-lg border border-ink-200 p-3">
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
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
