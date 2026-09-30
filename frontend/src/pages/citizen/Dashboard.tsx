import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  Flame,
  Leaf,
  MapPin,
  Sparkles,
  TrendingUp,
  Truck,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import StatCard, { MeterBar } from "../../components/ui/StatCard";
import Card, { CardHeader } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { AsyncBoundary, EmptyState } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import { formatDistance, formatNumber, formatPercent, timeAgo } from "../../lib/format";
import type { CitizenSummary, DashboardPayload } from "../../lib/types";

const QUICK_ACTIONS = [
  {
    to: "/app/report",
    label: "Report Waste",
    detail: "Photo + location in 60 s",
    icon: Sparkles,
    className: "from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600",
  },
  {
    to: "/app/pickup",
    label: "Request Pickup",
    detail: "Bulk or household waste",
    icon: Truck,
    className: "from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600",
  },
  {
    to: "/app/complaints",
    label: "Track Complaint",
    detail: "Follow every stage live",
    icon: MapPin,
    className: "from-ink-800 to-ink-900 hover:from-ink-700 hover:to-ink-800",
  },
];

export default function CitizenDashboard() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApi<DashboardPayload>("/analytics/dashboard");

  const summary = (data?.summary ?? null) as CitizenSummary | null;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <AppShell
      title={`Good to see you, ${firstName}`}
      subtitle="Here is the state of your reports and neighbourhood"
    >
      <AsyncBoundary loading={loading} error={error} onRetry={() => void refetch()}>
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total reports"
              value={formatNumber(summary?.total_complaints ?? 0)}
              icon={Bell}
              tone="slate"
              hint="All time"
              delay={0}
            />
            <StatCard
              label="Pending"
              value={formatNumber(summary?.pending_complaints ?? 0)}
              icon={Clock3}
              tone="amber"
              hint="Awaiting resolution"
              delay={0.05}
            />
            <StatCard
              label="Resolved"
              value={formatNumber(summary?.resolved_complaints ?? 0)}
              icon={CheckCircle2}
              tone="emerald"
              hint={
                summary ? `${formatPercent(summary.resolution_rate)} of your reports` : "Verified closed"
              }
              delay={0.1}
            />
            <StatCard
              label="Eco points"
              value={formatNumber(data?.eco_points ?? user?.eco_points ?? 0)}
              icon={Leaf}
              tone="blue"
              hint="Earned from verified action"
              delay={0.15}
            />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.to}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                >
                  <Link
                    to={action.to}
                    className={`flex items-center gap-4 rounded-2xl bg-gradient-to-br ${action.className} p-4 text-white shadow-md transition`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{action.label}</span>
                      <span className="block truncate text-xs text-white/75">{action.detail}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Recent reports */}
            <Card className="lg:col-span-2" padded={false}>
              <div className="p-5 pb-0">
                <CardHeader
                  title="Recent reports"
                  subtitle="Live status of your latest submissions"
                  icon={<Sparkles className="h-4 w-4" />}
                  action={
                    <Link to="/app/complaints" className="text-xs font-medium text-brand-700 hover:underline">
                      View all
                    </Link>
                  }
                />
              </div>
              <div className="px-2 pb-2">
                {data?.recent_complaints.length ? (
                  <ul className="divide-y divide-ink-100">
                    {data.recent_complaints.map((complaint) => (
                      <li key={complaint.id}>
                        <Link
                          to={`/app/complaints/${complaint.complaint_id}`}
                          className="flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-ink-50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-medium text-brand-700">
                                {complaint.complaint_id}
                              </span>
                              <CategoryChip category={complaint.category} size="xs" />
                              <PriorityBadge level={complaint.priority_level} size="xs" />
                            </div>
                            <p className="mt-1 truncate text-xs text-ink-500">{complaint.address}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <StatusBadge status={complaint.status} size="xs" />
                            <p className="mt-1 text-[10px] text-ink-400">{timeAgo(complaint.created_at)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-3">
                    <EmptyState
                      title="No reports yet"
                      description="Report waste in your area and track it from submission to verified resolution."
                      icon={<Sparkles className="h-5 w-5" />}
                      action={
                        <Link to="/app/report">
                          <Button size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>
                            Report waste now
                          </Button>
                        </Link>
                      }
                    />
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-6">
              {/* Resolution progress */}
              <Card>
                <CardHeader title="Your impact" subtitle="Resolution rate for your reports" />
                <MeterBar
                  value={summary?.resolution_rate ?? 0}
                  label="Reports resolved"
                  tone="emerald"
                />
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-ink-50 p-3">
                    <dt className="text-[11px] text-ink-500">Critical raised</dt>
                    <dd className="mt-0.5 flex items-center gap-1 text-lg font-semibold text-ink-900">
                      <Flame className="h-4 w-4 text-red-500" />
                      {summary?.critical_complaints ?? 0}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-3">
                    <dt className="text-[11px] text-ink-500">Evidence photos</dt>
                    <dd className="mt-0.5 flex items-center gap-1 text-lg font-semibold text-ink-900">
                      <TrendingUp className="h-4 w-4 text-brand-600" />
                      {summary?.total_evidence ?? 0}
                    </dd>
                  </div>
                </dl>
                <Link to="/app/eco-points" className="mt-4 block">
                  <Button variant="outline" size="sm" block icon={<Leaf className="h-3.5 w-3.5" />}>
                    View eco points
                  </Button>
                </Link>
              </Card>

              {/* Nearby hotspots */}
              <Card>
                <CardHeader
                  title="Nearby hotspots"
                  subtitle="Recurring problem pockets near you"
                  icon={<MapPin className="h-4 w-4" />}
                />
                {data?.nearby_hotspots.length ? (
                  <ul className="space-y-2.5">
                    {data.nearby_hotspots.slice(0, 5).map((item) => (
                      <li key={item.complaint_id} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                          <Flame className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-[11px] font-medium text-ink-700">
                              {item.complaint_id}
                            </span>
                            <Badge tone="slate" size="xs">
                              {formatDistance(item.distance_km)}
                            </Badge>
                          </div>
                          <p className="truncate text-xs text-ink-500">{item.address}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg bg-brand-50 px-3 py-4 text-center text-xs text-brand-800">
                    No open waste issues reported near you right now.
                  </p>
                )}
              </Card>
            </div>
          </div>
        </div>
      </AsyncBoundary>
    </AppShell>
  );
}
