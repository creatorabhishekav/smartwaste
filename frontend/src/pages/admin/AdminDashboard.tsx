import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  MapPinned,
  Package,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import StatCard from "../../components/ui/StatCard";
import { ErrorState, SkeletonRows } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import { MiniMap } from "../../components/domain/MapCanvas";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api } from "../../lib/api";
import { formatDuration, formatNumber, formatPercent, timeAgo } from "../../lib/format";
import type { AdminOverview, DuplicateGroup } from "../../lib/types";

type Duplicates = { groups: DuplicateGroup[]; count: number };

export default function AdminDashboard() {
  const toast = useToast();
  const { data, loading, error, refetch } = useApi<AdminOverview>("/admin/overview");
  const duplicates = useApi<Duplicates>("/admin/duplicates", { query: { refresh: false } });
  const [recomputing, setRecomputing] = useState(false);

  const recompute = async () => {
    setRecomputing(true);
    try {
      const result = await api<{ count: number }>("/admin/recompute", { method: "POST" });
      toast.success("Hotspots recomputed", `${result.count} clusters refreshed from live complaints.`);
      void refetch();
      void duplicates.refetch();
    } catch (err) {
      toast.error("Recompute failed", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <AppShell title="Command centre" subtitle="City-wide waste operations at a glance">
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />
            ))}
          </div>
          <Card>
            <SkeletonRows rows={5} />
          </Card>
        </div>
      )}

      {data && (
        <>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              loading={recomputing}
              onClick={() => void recompute()}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Recompute hotspots
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total reports"
              value={formatNumber(data.total_complaints)}
              icon={Gauge}
              hint={`${data.pending_complaints} still open`}
              delay={0}
            />
            <StatCard
              label="Critical"
              value={formatNumber(data.critical_complaints)}
              icon={Flame}
              tone="red"
              hint={`${data.high_complaints} high priority`}
              delay={0.04}
            />
            <StatCard
              label="Resolution rate"
              value={formatPercent(data.resolution_rate)}
              icon={CheckCircle2}
              tone="emerald"
              hint={`${data.resolved_complaints} resolved`}
              delay={0.08}
            />
            <StatCard
              label="Active crews"
              value={`${data.active_workers}/${data.total_workers}`}
              icon={Truck}
              tone="blue"
              hint="Available or on job"
              delay={0.12}
            />
            <StatCard
              label="Avg response"
              value={formatDuration(data.avg_response_minutes)}
              icon={Clock}
              tone="cyan"
              hint={`${data.avg_resolution_hours} h avg resolution`}
              delay={0.16}
            />
            <StatCard
              label="Open hotspots"
              value={formatNumber(data.open_hotspots)}
              icon={MapPinned}
              tone="amber"
              hint="Clustered problem areas"
              delay={0.2}
            />
            <StatCard
              label="Citizens"
              value={formatNumber(data.citizens)}
              icon={Users}
              hint={`${data.total_evidence} evidence photos`}
              delay={0.24}
            />
            <StatCard
              label="Pickups"
              value={formatNumber(data.total_pickups)}
              icon={Package}
              tone="violet"
              hint={`${data.pending_pickups} pending`}
              delay={0.28}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* critical queue */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="Highest priority open reports"
                subtitle="Sorted by explainable priority score"
                icon={<Flame className="h-4 w-4" />}
                action={
                  <Link to="/admin/queue">
                    <Button size="sm" variant="ghost" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                      Full queue
                    </Button>
                  </Link>
                }
              />
              {data.critical_queue.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-500">No open reports. Queue is clear.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {data.critical_queue.map((complaint) => (
                    <li key={complaint.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-brand-700">
                              {complaint.complaint_id}
                            </span>
                            <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} size="xs" />
                            <StatusBadge status={complaint.status} size="xs" />
                            <CategoryChip category={complaint.category} size="xs" />
                          </div>
                          <p className="mt-1.5 truncate text-sm text-ink-800">{complaint.address}</p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            {complaint.ward ?? "Unassigned ward"} · reported {timeAgo(complaint.created_at)} by{" "}
                            {complaint.citizen_name ?? "a citizen"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {complaint.worker ? (
                            <span className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                              {complaint.worker.employee_code}
                            </span>
                          ) : (
                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                              Unassigned
                            </span>
                          )}
                          <Link to={`/admin/complaints/${complaint.complaint_id}`}>
                            <Button size="sm" variant="outline">
                              Review
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* top workers */}
            <Card>
              <CardHeader
                title="Top crews"
                subtitle="By completion and proof quality"
                icon={<Truck className="h-4 w-4" />}
                action={
                  <Link to="/admin/workers">
                    <Button size="sm" variant="ghost">
                      All
                    </Button>
                  </Link>
                }
              />
              {data.top_workers.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-500">No crew activity yet.</p>
              ) : (
                <ol className="space-y-3">
                  {data.top_workers.map((worker, index) => (
                    <motion.li
                      key={worker.worker_id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-xs font-bold text-ink-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">{worker.name}</p>
                        <p className="text-[11px] text-ink-500">
                          {worker.completed}/{worker.assigned} done · {formatPercent(worker.completion_rate)} ·{" "}
                          {worker.proof_images} proofs
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
                        {worker.rating}
                      </span>
                    </motion.li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* recent */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="Latest reports"
                subtitle="Newest submissions across all wards"
                icon={<Gauge className="h-4 w-4" />}
                action={
                  <Link to="/admin/complaints">
                    <Button size="sm" variant="ghost">
                      Browse all
                    </Button>
                  </Link>
                }
              />
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.recent_complaints.map((complaint) => (
                  <li key={complaint.id} className="rounded-xl border border-ink-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-ink-800">
                        {complaint.complaint_id}
                      </span>
                      <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} size="xs" />
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs text-ink-700">{complaint.address}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
                      <StatusBadge status={complaint.status} size="xs" />
                      {timeAgo(complaint.created_at)}
                    </p>
                    {complaint.image_url && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-400">
                        <Camera className="h-3 w-3" />
                        photo attached
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            {/* duplicates */}
            <Card>
              <CardHeader
                title="Duplicate clusters"
                subtitle={`${duplicates.data?.count ?? 0} groups can be cleared in one visit`}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              {duplicates.loading && <SkeletonRows rows={3} />}
              {duplicates.data?.groups.length === 0 && (
                <p className="py-8 text-center text-sm text-ink-500">No duplicate clusters detected.</p>
              )}
              <ul className="space-y-3">
                {duplicates.data?.groups.slice(0, 5).map((group) => (
                  <li key={group.code} className="rounded-xl border border-ink-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900">{group.label}</p>
                      <span className="rounded-lg bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        x{group.members.length}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {group.ward} ward · {group.complaint_count} reports · {group.critical_count} critical
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {group.members.slice(0, 4).map((member) => (
                        <span key={member.id} className="font-mono text-[10px] text-ink-500">
                          {member.complaint_id}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2">
                      <MiniMap lat={group.latitude} lon={group.longitude} label={group.label} zoom={14} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
