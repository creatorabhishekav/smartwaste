import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Filter, MapPin, Search, Sparkles } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import Pagination from "../../components/ui/Table";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import { useApi } from "../../hooks/useApi";
import { CATEGORY_META, CATEGORY_ORDER, STATUS_META, STATUS_ORDER } from "../../lib/constants";
import { formatScore, timeAgo } from "../../lib/format";
import type { Complaint, Paged } from "../../lib/types";

const FILTERS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
];

export default function MyComplaints() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = {
    page,
    page_size: 12,
    ...(status === "OPEN" ? { open_only: true } : status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(search ? { search } : {}),
  };

  const { data, loading, error, refetch } = useApi<Paged<Complaint>>("/complaints", { query });

  return (
    <AppShell title="My complaints" subtitle="Every report you have submitted, with live status">
      <div className="space-y-5">
        {/* Filters */}
        <Card className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-ink-100 p-0.5">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setStatus(filter.value);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  status === filter.value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All categories</option>
            {CATEGORY_ORDER.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_META[key].label}
              </option>
            ))}
          </select>

          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search ID, address or text"
              className="w-full rounded-lg border border-ink-200 bg-white py-1.5 pl-9 pr-3 text-xs text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </Card>

        {error && <ErrorState error={error} onRetry={() => void refetch()} />}

        {loading && (
          <Card>
            <SkeletonRows rows={5} />
          </Card>
        )}

        {!loading && !error && data?.items.length === 0 && (
          <EmptyState
            title="No complaints match your filters"
            description="Try a different status or category, or submit a new report."
            icon={<Filter className="h-5 w-5" />}
            action={
              <Link to="/app/report">
                <Button size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>
                  Report waste
                </Button>
              </Link>
            }
          />
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((complaint) => (
                <Link
                  key={complaint.id}
                  to={`/app/complaints/${complaint.complaint_id}`}
                  className="group rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-brand-700">
                        {complaint.complaint_id}
                      </span>
                      <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} size="xs" />
                    </div>
                    <StatusBadge status={complaint.status} size="xs" />
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm font-medium text-ink-900">
                    {complaint.description ?? CATEGORY_META[complaint.category].label}
                  </p>

                  <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-1">{complaint.address}</span>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <CategoryChip category={complaint.category} size="xs" />
                    {complaint.worker && <Badge tone="blue" size="xs">{complaint.worker.employee_code}</Badge>}
                    {complaint.is_duplicate && <Badge tone="amber" size="xs">Duplicate linked</Badge>}
                  </div>

                  {/* Mini lifecycle progress */}
                  <div className="mt-3.5 flex gap-0.5">
                    {STATUS_ORDER.map((key) => {
                      const reached = (complaint.timeline ?? []).find((entry) => entry.status === key)?.completed;
                      return (
                        <span
                          key={key}
                          title={STATUS_META[key].label}
                          className={`h-1 flex-1 rounded-full ${
                            reached ? "bg-brand-500" : "bg-ink-150 bg-ink-100"
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-ink-400">
                    <span>Severity {formatScore(complaint.severity)}</span>
                    <span>{timeAgo(complaint.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>

            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              pageSize={data.page_size}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
