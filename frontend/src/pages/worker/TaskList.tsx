import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, ListChecks, Navigation, Package, Search } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import { MiniMap } from "../../components/domain/MapCanvas";
import { useApi } from "../../hooks/useApi";
import { formatDistance, timeAgo } from "../../lib/format";
import type { WorkerDashboard } from "../../lib/types";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function TaskList() {
  const [tab, setTab] = useState<TabKey>("pending");
  const [search, setSearch] = useState("");
  const { data, loading, error, refetch } = useApi<WorkerDashboard>("/workers/me/dashboard");

  const tasks = useMemo(() => {
    const list = data?.[tab] ?? [];
    if (!search.trim()) return list;
    const needle = search.trim().toLowerCase();
    return list.filter((task) =>
      [task.complaint_id, task.address, task.description ?? ""].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [data, tab, search]);

  return (
    <AppShell title="My tasks" subtitle="Assignments ordered by priority, with distance from your position">
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      <Card>
        <CardHeader
          title="Task queue"
          subtitle={data ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} in view` : undefined}
          icon={<ListChecks className="h-4 w-4" />}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-ink-100 p-0.5">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                  tab === item.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {item.label}
                {data && (
                  <span className="ml-1.5 tabular-nums text-[11px] text-ink-400">
                    {data[item.key].length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID or address"
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

      {!loading && !error && tasks.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title={tab === "pending" ? "No pending assignments" : tab === "active" ? "No active tasks" : "Nothing completed yet"}
            description={
              tab === "pending"
                ? "New jobs appear here as supervisors assign them."
                : tab === "active"
                  ? "Start a pending job to move it into your active list."
                  : "Completed jobs will be archived here for reference."
            }
            icon={tab === "completed" ? <CheckCircle2 className="h-5 w-5" /> : tab === "active" ? <Navigation className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          />
        </div>
      )}

      {tasks.length > 0 && (
        <ul className="mt-6 space-y-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <Card className="transition hover:border-brand-300">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-brand-700">
                        {task.complaint_id}
                      </span>
                      <PriorityBadge level={task.priority_level} score={task.priority_score} size="xs" />
                      <StatusBadge status={task.status} size="xs" />
                      <CategoryChip category={task.category} size="xs" />
                    </div>

                    <p className="mt-2 text-sm font-medium text-ink-900">{task.address}</p>
                    {task.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-600">{task.description}</p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {formatDistance(task.distance_km)} away
                      </span>
                      <span>Reported {timeAgo(task.created_at)}</span>
                      {task.evidence.length > 0 && (
                        <Badge tone="slate" size="xs">
                          {task.evidence.length} photo{task.evidence.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {task.is_duplicate && (
                        <Badge tone="amber" size="xs">
                          Duplicate cluster
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="w-full sm:w-56">
                    <MiniMap lat={task.latitude} lon={task.longitude} label={task.address} />
                    <Link to={`/worker/task/${task.complaint_id}`} className="mt-3 block">
                      <Button size="sm" block icon={<ArrowRight className="h-3.5 w-3.5" />}>
                        {tab === "completed" ? "View report" : "Open task"}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {tab === "active" && data?.pickups.length ? (
        <Card className="mt-6">
          <CardHeader title="Assigned pickups" icon={<Package className="h-4 w-4" />} />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.pickups.map((pickup) => (
              <li key={pickup.id} className="rounded-xl border border-ink-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-ink-900">
                    {pickup.pickup_id}
                  </span>
                  <StatusBadge status={pickup.status} size="xs" />
                </div>
                <p className="mt-1.5 text-xs font-medium text-ink-800">
                  {pickup.waste_type} · {pickup.quantity} {pickup.unit}
                </p>
                <p className="mt-1 text-[11px] text-ink-500">{pickup.address}</p>
                <p className="mt-1 text-[11px] text-ink-400">
                  {pickup.preferred_date ?? "Any date"} · {pickup.preferred_time ?? "any time"}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </AppShell>
  );
}
