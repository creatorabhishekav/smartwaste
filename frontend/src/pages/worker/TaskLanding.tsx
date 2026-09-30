import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ClipboardCheck, MapPin, Navigation, Truck } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import { MiniMap } from "../../components/domain/MapCanvas";
import { useApi } from "../../hooks/useApi";
import { formatDateTime, formatDistance, timeAgo } from "../../lib/format";
import type { WorkerDashboard } from "../../lib/types";

type Mode = "active" | "completed";

export default function TaskLanding({ mode }: { mode: Mode }) {
  const { data, loading, error, refetch } = useApi<WorkerDashboard>("/workers/me/dashboard");
  const tasks = data ? (mode === "active" ? data.active : data.completed) : [];
  const isActive = mode === "active";

  return (
    <AppShell
      title={isActive ? "Active task" : "Completed jobs"}
      subtitle={
        isActive
          ? "The job you are currently working through"
          : "Recently completed jobs, kept for verification records"
      }
    >
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {loading && (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      )}

      {!loading && !error && tasks.length === 0 && (
        <EmptyState
          title={isActive ? "No active task right now" : "No completed jobs yet"}
          description={
            isActive
              ? "Accept a pending job from your queue to see it here."
              : "Completed jobs appear here once a supervisor verifies the proof."
          }
          icon={isActive ? <Navigation className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          action={
            <Link to="/worker/tasks">
              <Button size="sm" icon={<ClipboardCheck className="h-3.5 w-3.5" />}>
                Open my task queue
              </Button>
            </Link>
          }
        />
      )}

      {tasks.length > 0 && (
        <ul className="space-y-4">
          {tasks.map((task, index) => (
            <motion.li
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
            >
              <Card>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
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
                        <MapPin className="h-3 w-3" />
                        {formatDistance(task.distance_km)} away
                      </span>
                      <span>Reported {timeAgo(task.created_at)}</span>
                      {task.resolved_at && <span>Resolved {formatDateTime(task.resolved_at)}</span>}
                    </div>
                  </div>

                  <div className="w-full lg:w-56">
                    <MiniMap lat={task.latitude} lon={task.longitude} label={task.address} />
                    <Link to={`/worker/task/${task.complaint_id}`} className="mt-3 block">
                      <Button size="sm" block icon={<ArrowRight className="h-3.5 w-3.5" />}>
                        {isActive ? "Continue task" : "View record"}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.li>
          ))}
        </ul>
      )}

      {isActive && data && data.active.length > 0 && (
        <Card className="mt-6 border-brand-200 bg-brand-50/60">
          <p className="flex items-start gap-2 text-sm text-brand-900">
            <Truck className="mt-0.5 h-4 w-4 shrink-0" />
            Move the job through the field steps in order: travelling, arrived, collected, then upload before and
            after proof for supervisor verification.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
