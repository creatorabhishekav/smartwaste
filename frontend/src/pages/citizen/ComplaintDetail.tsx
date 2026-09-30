import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Sparkles,
  Truck,
  UserCheck,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { AsyncBoundary } from "../../components/ui/States";
import ComplaintTimeline from "../../components/domain/ComplaintTimeline";
import EvidenceCompare from "../../components/domain/EvidenceCompare";
import PriorityExplain from "../../components/domain/PriorityExplain";
import { MiniMap } from "../../components/domain/MapCanvas";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import { mediaUrl } from "../../lib/api";
import { useApi } from "../../hooks/useApi";
import { formatDateTime, formatDuration, formatScore } from "../../lib/format";
import type { Complaint } from "../../lib/types";

type Response = { complaint: Complaint };

export default function ComplaintDetail() {
  const { id = "" } = useParams();
  const { data, loading, error, refetch } = useApi<Response>(id ? `/complaints/${id}` : null);

  return (
    <AppShell title="Complaint tracking" subtitle={id}>
      <div className="mb-5">
        <Link
          to="/app/complaints"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my complaints
        </Link>
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={() => void refetch()}>
        {data?.complaint && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ------------------------------------------------ main column */}
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-mono text-lg font-semibold text-ink-900">
                        {data.complaint.complaint_id}
                      </h2>
                      <StatusBadge status={data.complaint.status} />
                      <PriorityBadge level={data.complaint.priority_level} score={data.complaint.priority_score} />
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
                      {data.complaint.description}
                    </p>
                  </div>
                  {data.complaint.image_url && (
                    <img
                      src={mediaUrl(data.complaint.image_url) ?? ""}
                      alt="Reported waste"
                      className="h-24 w-32 shrink-0 rounded-lg border border-ink-200 object-cover"
                    />
                  )}
                </div>

                <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Category", value: <CategoryChip category={data.complaint.category} size="xs" /> },
                    { label: "Severity", value: formatScore(data.complaint.severity) },
                    { label: "Waste type", value: data.complaint.waste_type ?? "—" },
                    {
                      label: "AI provider",
                      value: (
                        <span className="inline-flex items-center gap-1">
                          <Bot className="h-3 w-3 text-violet-500" />
                          {data.complaint.ai_provider ?? "—"}
                        </span>
                      ),
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-[11px] uppercase tracking-wide text-ink-500">{item.label}</dt>
                      <dd className="mt-1 text-sm font-medium text-ink-900">{item.value}</dd>
                    </div>
                  ))}
                </dl>

                {data.complaint.detected_objects.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">AI detected objects</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {data.complaint.detected_objects.map((object) => (
                        <Badge key={object} tone="slate" size="xs">
                          {object}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {data.complaint.recommended_action && (
                  <div className="mt-4 rounded-lg bg-brand-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-800">
                      <Sparkles className="h-3.5 w-3.5" />
                      Recommended action
                    </p>
                    <p className="mt-1 text-sm text-brand-900">{data.complaint.recommended_action}</p>
                  </div>
                )}

                {data.complaint.is_duplicate && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    This report is linked to {data.complaint.duplicate_group ?? "a nearby duplicate"} so the
                    crew can clear both in a single visit.
                  </p>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Live tracking"
                  subtitle="Each stage is timestamped by the system"
                  icon={<CalendarClock className="h-4 w-4" />}
                />
                <ComplaintTimeline timeline={data.complaint.timeline} />
              </Card>

              <Card>
                <CardHeader
                  title="Verification evidence"
                  subtitle="Before and after photos captured by the crew"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <EvidenceCompare
                  evidence={data.complaint.evidence}
                  beforeScore={data.complaint.before_cleanliness}
                  afterScore={data.complaint.after_cleanliness}
                  verificationStatus={data.complaint.verification_status}
                  verificationNotes={data.complaint.verification_notes}
                />
              </Card>
            </div>

            {/* ------------------------------------------------ side column */}
            <div className="space-y-6">
              <PriorityExplain
                score={data.complaint.priority_score}
                level={data.complaint.priority_level}
                breakdown={data.complaint.priority_breakdown}
                reasons={data.complaint.priority_reasons}
              />

              <Card>
                <CardHeader title="Location" icon={<MapPin className="h-4 w-4" />} />
                <p className="text-sm font-medium text-ink-900">{data.complaint.address}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {data.complaint.ward ? `${data.complaint.ward} ward · ` : ""}
                  {data.complaint.latitude.toFixed(5)}, {data.complaint.longitude.toFixed(5)}
                </p>
                <div className="mt-3">
                  <MiniMap lat={data.complaint.latitude} lon={data.complaint.longitude} label={data.complaint.address} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Assigned crew" icon={<Truck className="h-4 w-4" />} />
                {data.complaint.worker ? (
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <UserCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{data.complaint.worker.name}</p>
                      <p className="text-xs text-ink-500">{data.complaint.worker.employee_code}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {data.complaint.worker.ward} ward
                        {data.complaint.worker.vehicle_number ? ` · ${data.complaint.worker.vehicle_number}` : ""}
                      </p>
                      {data.complaint.distance_km !== null && (
                        <p className="mt-1 text-xs text-ink-500">
                          {data.complaint.distance_km} km from the last known crew position
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    A crew has not been assigned yet. The ward supervisor assigns the nearest available team
                    from the priority queue.
                  </p>
                )}
              </Card>

              <Card>
                <CardHeader title="Report details" />
                <dl className="space-y-2.5 text-sm">
                  {[
                    { label: "Created", value: formatDateTime(data.complaint.created_at) },
                    { label: "Assigned", value: formatDateTime(data.complaint.assigned_at) },
                    { label: "Resolved", value: formatDateTime(data.complaint.resolved_at) },
                    { label: "Response time", value: formatDuration(data.complaint.response_minutes) },
                    { label: "Last update", value: formatDateTime(data.complaint.updated_at) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3">
                      <dt className="text-ink-500">{row.label}</dt>
                      <dd className="text-right font-medium text-ink-900">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                {data.complaint.admin_note && (
                  <p className="mt-3 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
                    <span className="font-medium text-ink-700">Supervisor note:</span>{" "}
                    {data.complaint.admin_note}
                  </p>
                )}
              </Card>
            </div>
          </div>
        )}
      </AsyncBoundary>
    </AppShell>
  );
}
