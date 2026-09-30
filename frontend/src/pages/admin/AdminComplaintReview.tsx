import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Camera,
  CheckCircle2,
  Copy,
  MapPin,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Textarea } from "../../components/ui/Field";
import { AsyncBoundary } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import ComplaintTimeline from "../../components/domain/ComplaintTimeline";
import EvidenceCompare from "../../components/domain/EvidenceCompare";
import PriorityExplain from "../../components/domain/PriorityExplain";
import { MiniMap } from "../../components/domain/MapCanvas";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api, mediaUrl } from "../../lib/api";
import { formatDateTime, timeAgo } from "../../lib/format";
import type { Complaint, Worker } from "../../lib/types";

type Response = { complaint: Complaint };

type Suggestion = {
  id: number;
  name: string;
  employee_code: string;
  ward: string;
  vehicle_number: string | null;
  status: string;
  active_tasks: number;
  distance_km: number;
  eta_minutes: number;
  match_score: number;
};

export default function AdminComplaintReview() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, refetch } = useApi<Response>(id ? `/complaints/${id}` : null);

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const complaint = data?.complaint;

  const suggestions = useApi<{ suggestions: Suggestion[] }>(
    complaint && !complaint.worker ? `/complaints/${id}/suggest-workers` : null,
  );

  const act = async (label: string, run: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await run();
      toast.success(label, `${complaint?.complaint_id} updated.`);
      setNote("");
      void refetch();
      void suggestions.refetch();
    } catch (err) {
      toast.error("Action failed", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const assign = (worker: Worker | Suggestion) =>
    act(`Assigned to ${worker.name}`, () =>
      api(`/complaints/${id}/assign`, { method: "POST", body: { worker_id: worker.id } }),
    );

  return (
    <AppShell title="Complaint review" subtitle={id}>
      <div className="mb-5">
        <Link
          to="/admin/complaints"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to complaints
        </Link>
      </div>

      <AsyncBoundary loading={loading} error={error} onRetry={() => void refetch()}>
        {complaint && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-mono text-lg font-semibold text-ink-900">
                        {complaint.complaint_id}
                      </h2>
                      <StatusBadge status={complaint.status} />
                      <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} />
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
                      {complaint.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CategoryChip category={complaint.category} size="xs" />
                      {complaint.waste_type && <Badge tone="slate" size="xs">{complaint.waste_type}</Badge>}
                      {complaint.citizen_name && <Badge tone="cyan" size="xs">{complaint.citizen_name}</Badge>}
                      {complaint.is_duplicate && <Badge tone="amber" size="xs">Duplicate linked</Badge>}
                    </div>
                  </div>
                  {complaint.image_url && (
                    <img
                      src={mediaUrl(complaint.image_url) ?? ""}
                      alt="Reported waste"
                      className="h-28 w-36 shrink-0 rounded-lg border border-ink-200 object-cover"
                    />
                  )}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Reported", value: timeAgo(complaint.created_at) },
                    { label: "Assigned", value: complaint.assigned_at ? formatDateTime(complaint.assigned_at) : "—" },
                    { label: "Resolved", value: complaint.resolved_at ? formatDateTime(complaint.resolved_at) : "—" },
                    { label: "AI provider", value: complaint.ai_provider ?? "—" },
                  ].map((row) => (
                    <div key={row.label}>
                      <p className="text-[11px] uppercase tracking-wide text-ink-500">{row.label}</p>
                      <p className="mt-1 text-sm font-medium text-ink-900">{row.value}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* verification */}
              {complaint.status === "PROOF_UPLOADED" && (
                <Card className="border-brand-200 bg-brand-50/40">
                  <CardHeader
                    title="Verify worker proof"
                    subtitle="Accepting resolves the complaint and awards eco points"
                    icon={<ShieldCheck className="h-4 w-4" />}
                  />
                  <EvidenceCompare
                    evidence={complaint.evidence}
                    beforeScore={complaint.before_cleanliness}
                    afterScore={complaint.after_cleanliness}
                    verificationStatus={complaint.verification_status}
                    verificationNotes={complaint.verification_notes}
                  />
                  <Textarea
                    label="Supervisor note"
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. Before and after photos clearly show the drain was cleared."
                    className="mt-4"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      loading={busy === "Proof accepted"}
                      onClick={() =>
                        void act("Proof accepted", () =>
                          api(`/complaints/${id}/verify`, {
                            method: "POST",
                            body: { status: "VERIFIED", note: note.trim() || undefined },
                          }),
                        )
                      }
                      icon={<BadgeCheck className="h-4 w-4" />}
                    >
                      Accept proof
                    </Button>
                    <Button
                      variant="outline"
                      loading={busy === "Proof rejected"}
                      onClick={() =>
                        void act("Proof rejected", () =>
                          api(`/complaints/${id}/status`, {
                            method: "POST",
                            body: { status: "REJECTED", note: note.trim() || undefined },
                          }),
                        )
                      }
                      icon={<Ban className="h-4 w-4" />}
                    >
                      Reject proof
                    </Button>
                  </div>
                </Card>
              )}

              {complaint.evidence.length > 0 && complaint.status !== "PROOF_UPLOADED" && (
                <Card>
                  <CardHeader
                    title="Evidence record"
                    subtitle={`Verification: ${complaint.verification_status ?? "pending"}`}
                    icon={<Camera className="h-4 w-4" />}
                  />
                  <EvidenceCompare
                    evidence={complaint.evidence}
                    beforeScore={complaint.before_cleanliness}
                    afterScore={complaint.after_cleanliness}
                    verificationStatus={complaint.verification_status}
                    verificationNotes={complaint.verification_notes}
                  />
                </Card>
              )}

              <Card>
                <CardHeader title="Lifecycle" icon={<CheckCircle2 className="h-4 w-4" />} />
                <ComplaintTimeline timeline={complaint.timeline} />
              </Card>
            </div>

            <div className="space-y-6">
              {/* assignment */}
              <Card>
                <CardHeader title="Assignment" icon={<UserPlus className="h-4 w-4" />} />
                {complaint.worker ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
                    <p className="text-sm font-semibold text-blue-900">{complaint.worker.name}</p>
                    <p className="mt-0.5 text-xs text-blue-700">
                      {complaint.worker.employee_code} · {complaint.worker.ward} ward
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      {complaint.worker.total_assigned} assigned total · rating {complaint.worker.rating}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => navigate("/admin/workers")}
                    >
                      Manage crews
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-xs text-ink-500">
                      Ranked by match score, distance and current workload.
                    </p>
                    {suggestions.loading && (
                      <p className="py-4 text-center text-xs text-ink-500">Scoring crews…</p>
                    )}
                    {suggestions.data?.suggestions.map((worker) => (
                      <div
                        key={worker.id}
                        className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-ink-200 p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900">{worker.name}</p>
                          <p className="text-[11px] text-ink-500">
                            {worker.employee_code} · {worker.distance_km} km · {worker.eta_minutes} min ETA ·{" "}
                            {worker.active_tasks} active
                          </p>
                          <p className="mt-1 text-[11px] font-semibold text-brand-700">
                            Match {worker.match_score}%
                          </p>
                        </div>
                        <Button
                          size="sm"
                          loading={busy === `Assigned to ${worker.name}`}
                          onClick={() => void assign(worker)}
                        >
                          Assign
                        </Button>
                      </div>
                    ))}
                    {suggestions.data?.suggestions.length === 0 && (
                      <p className="py-6 text-center text-xs text-ink-500">
                        No crews available. Check the workers page.
                      </p>
                    )}
                  </>
                )}
              </Card>

              <PriorityExplain
                score={complaint.priority_score}
                level={complaint.priority_level}
                breakdown={complaint.priority_breakdown}
                reasons={complaint.priority_reasons}
              />

              <Card>
                <CardHeader title="Location" icon={<MapPin className="h-4 w-4" />} />
                <p className="text-sm font-medium text-ink-900">{complaint.address}</p>
                <p className="mt-1 text-xs text-ink-500">{complaint.ward ?? "Unassigned ward"}</p>
                <div className="mt-3">
                  <MiniMap lat={complaint.latitude} lon={complaint.longitude} label={complaint.address} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Admin override" />
                <Textarea
                  label="Note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Reason for the override"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {["REVIEWED", "REJECTED"].map((target) => (
                    <Button
                      key={target}
                      size="sm"
                      variant={target === "REJECTED" ? "outline" : "ghost"}
                      loading={busy === `Set ${target}`}
                      onClick={() =>
                        void act(`Set ${target}`, () =>
                          api(`/complaints/${id}/status`, {
                            method: "POST",
                            body: { status: target, note: note.trim() || undefined },
                          }),
                        )
                      }
                    >
                      {target === "REJECTED" ? "Reject report" : "Mark reviewed"}
                    </Button>
                  ))}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-ink-400 transition hover:text-ink-700"
                    onClick={() => {
                      void navigator.clipboard?.writeText(complaint.complaint_id);
                      toast.info("Copied", complaint.complaint_id);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copy ID
                  </button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </AsyncBoundary>
    </AppShell>
  );
}
