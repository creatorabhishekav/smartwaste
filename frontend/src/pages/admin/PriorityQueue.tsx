import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, ListFilter, UserPlus } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api } from "../../lib/api";
import { formatDistance, timeAgo } from "../../lib/format";
import type { Complaint } from "../../lib/types";

const PRIORITY_TABS = [
  { value: "", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export default function PriorityQueue() {
  const navigate = useNavigate();
  const toast = useToast();
  const [priority, setPriority] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApi<Complaint[]>("/admin/priority-queue", {
    query: { limit: 200, ...(priority ? { priority } : {}) },
  });

  const grouped = useMemo(() => {
    const list = data ?? [];
    return {
      critical: list.filter((c) => c.priority_level === "CRITICAL"),
      high: list.filter((c) => c.priority_level === "HIGH"),
      rest: list.filter((c) => c.priority_level === "MEDIUM" || c.priority_level === "LOW"),
    };
  }, [data]);

  const assign = async (complaint: Complaint) => {
    setBusy(complaint.complaint_id);
    try {
      const { suggestions } = await api<{ suggestions: { id: number; name: string }[] }>(
        `/complaints/${complaint.complaint_id}/suggest-workers`,
      );
      const best = suggestions?.[0];
      if (!best) {
        toast.error("No crew suggested", "All crews are busy. Try again later.");
        return;
      }
      await api(`/complaints/${complaint.complaint_id}/assign`, {
        method: "POST",
        body: { worker_id: best.id },
      });
      toast.success("Assigned", `${complaint.complaint_id} → ${best.name}`);
      void refetch();
    } catch (err) {
      toast.error("Assign failed", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const Section = ({
    title,
    items,
    tone,
  }: {
    title: string;
    items: Complaint[];
    tone: "red" | "amber" | "slate";
  }) =>
    items.length > 0 && (
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-800">
          <Badge tone={tone} size="xs">
            {items.length}
          </Badge>
          {title}
        </h3>
        <div className="space-y-2">
          {items.map((complaint) => (
            <Card key={complaint.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-700">
                      {complaint.complaint_id}
                    </span>
                    <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} size="xs" />
                    <StatusBadge status={complaint.status} size="xs" />
                    <CategoryChip category={complaint.category} size="xs" />
                  </div>
                  <p className="mt-1.5 truncate text-sm text-ink-800">{complaint.address}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {complaint.ward ?? "Unassigned ward"} · reported {timeAgo(complaint.created_at)}
                    {complaint.distance_km !== null && ` · ${formatDistance(complaint.distance_km)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {complaint.worker ? (
                    <Badge tone="blue" size="sm">
                      {complaint.worker.employee_code}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      loading={busy === complaint.complaint_id}
                      onClick={() => void assign(complaint)}
                      icon={<UserPlus className="h-3.5 w-3.5" />}
                    >
                      Quick assign
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/complaints/${complaint.complaint_id}`)}>
                    Open
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );

  return (
    <AppShell title="Priority queue" subtitle="Open reports ordered by explainable priority score">
      <Card>
        <CardHeader
          title="Filter by priority"
          subtitle="Critical first, then high, then medium and low"
          icon={<ListFilter className="h-4 w-4" />}
        />
        <div className="flex flex-wrap gap-2">
          {PRIORITY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setPriority(tab.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                priority === tab.value
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-ink-100 text-ink-600 hover:bg-ink-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="mt-6">
          <ErrorState error={error} onRetry={() => void refetch()} />
        </div>
      )}

      {loading && (
        <Card className="mt-6">
          <SkeletonRows rows={6} />
        </Card>
      )}

      {!loading && !error && data?.length === 0 && (
        <div className="mt-6">
          <EmptyState title="Queue is clear" description="No open complaints match this filter." icon={<Filter className="h-5 w-5" />} />
        </div>
      )}

      {data && data.length > 0 && (
        <div className="mt-6 space-y-6">
          <Section title="Critical" items={grouped.critical} tone="red" />
          <Section title="High priority" items={grouped.high} tone="amber" />
          <Section title="Medium and low priority" items={grouped.rest} tone="slate" />
        </div>
      )}
    </AppShell>
  );
}
