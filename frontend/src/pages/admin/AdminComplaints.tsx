import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import { useApi } from "../../hooks/useApi";
import { timeAgo } from "../../lib/format";
import type { Complaint, Paged } from "../../lib/types";

export default function AdminComplaints() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const query = {
    page_size: 20,
    ...(status ? { status } : {}),
    ...(priority ? { priority_level: priority } : {}),
    ...(search ? { search } : {}),
  };

  const { data, loading, error, refetch } = useApi<Paged<Complaint>>("/complaints", { query });

  return (
    <AppShell title="All complaints" subtitle="Every report, newest first, with filters">
      <Card>
        <CardHeader
          title="Browse reports"
          subtitle={data ? `${data.total} total matching` : undefined}
          icon={<Search className="h-4 w-4" />}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID, address, description"
              className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All statuses</option>
            {["SUBMITTED", "AI_ANALYZED", "REVIEWED", "ASSIGNED", "ON_THE_WAY", "ARRIVED", "COLLECTED", "PROOF_UPLOADED", "VERIFIED", "RESOLVED", "REJECTED"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All priorities</option>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
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

      {!loading && !error && data?.items.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No matching complaints" description="Adjust the filters above." icon={<Search className="h-5 w-5" />} />
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-6 space-y-3">
          {data.items.map((complaint) => (
            <Card key={complaint.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-brand-700">
                      {complaint.complaint_id}
                    </span>
                    <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} size="xs" />
                    <StatusBadge status={complaint.status} size="xs" />
                    <CategoryChip category={complaint.category} size="xs" />
                  </div>
                  <p className="mt-2 text-sm text-ink-800">{complaint.description ?? complaint.address}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {complaint.address} · {complaint.ward ?? "Unassigned"} · {timeAgo(complaint.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 lg:shrink-0">
                  {complaint.worker ? (
                    <Badge tone="blue" size="sm">
                      {complaint.worker.employee_code}
                    </Badge>
                  ) : (
                    <Badge tone="amber" size="sm">
                      Unassigned
                    </Badge>
                  )}
                  <Button size="sm" onClick={() => navigate(`/admin/complaints/${complaint.complaint_id}`)}>
                    Review
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
