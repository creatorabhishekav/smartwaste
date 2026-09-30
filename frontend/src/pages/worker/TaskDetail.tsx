import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ExternalLink,
  ImageUp,
  MapPin,
  Navigation,
  Package,
  Route,
  Truck,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Textarea } from "../../components/ui/Field";
import { AsyncBoundary, ErrorState } from "../../components/ui/States";
import { CategoryChip, PriorityBadge, StatusBadge } from "../../components/domain/Badges";
import ComplaintTimeline from "../../components/domain/ComplaintTimeline";
import EvidenceCompare from "../../components/domain/EvidenceCompare";
import { MiniMap } from "../../components/domain/MapCanvas";
import PriorityExplain from "../../components/domain/PriorityExplain";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api, mediaUrl } from "../../lib/api";
import { formatDateTime, formatDistance } from "../../lib/format";
import type { Complaint } from "../../lib/types";

type Response = { complaint: Complaint };

/** Worker transitions allowed by the backend ALLOWED_TRANSITIONS map. */
const NEXT_STEP: Record<string, { to: string; label: string; icon: typeof Navigation }> = {
  ASSIGNED: { to: "ON_THE_WAY", label: "Start travelling", icon: Navigation },
  ON_THE_WAY: { to: "ARRIVED", label: "Mark arrived on site", icon: MapPin },
  ARRIVED: { to: "COLLECTED", label: "Mark waste collected", icon: Package },
};

export default function TaskDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, refetch } = useApi<Response>(id ? `/complaints/${id}` : null);

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const complaint = data?.complaint;
  const step = complaint ? NEXT_STEP[complaint.status] : undefined;
  const canProof = complaint?.status === "COLLECTED";

  const advance = async () => {
    if (!complaint || !step) return;
    setBusy(true);
    try {
      await api(`/complaints/${complaint.complaint_id}/status`, {
        method: "POST",
        body: { status: step.to, note: note.trim() || undefined },
      });
      toast.success(step.label, `Moved to ${step.to.replace("_", " ").toLowerCase()}.`);
      setNote("");
      void refetch();
    } catch (err) {
      toast.error("Could not update", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const uploadProof = async () => {
    if (!complaint) return;
    const before = beforeRef.current?.files?.[0];
    const after = afterRef.current?.files?.[0];
    if (!before || !after) {
      toast.error("Two photos required", "Capture a before and an after photo.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("before_image", before);
      body.append("after_image", after);
      if (note.trim()) body.append("note", note.trim());
      await api(`/complaints/${complaint.complaint_id}/proof`, { method: "POST", form: body });
      toast.success("Proof submitted", "The report moved to supervisor verification.");
      setNote("");
      void refetch();
    } catch (err) {
      toast.error("Upload failed", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Task detail" subtitle={id}>
      <div className="mb-5">
        <Link
          to="/worker/tasks"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tasks
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
                      {complaint.is_duplicate && <Badge tone="amber" size="xs">Duplicate cluster</Badge>}
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

                <div className="mt-5 border-t border-ink-100 pt-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-ink-500">Reported by</p>
                      <p className="mt-1 text-sm font-medium text-ink-900">
                        {complaint.citizen_name ?? "Anonymous citizen"}
                      </p>
                      <p className="text-xs text-ink-500">Reported {formatDateTime(complaint.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-ink-500">Location</p>
                      <p className="mt-1 text-sm font-medium text-ink-900">{complaint.address}</p>
                      <p className="text-xs text-ink-500">{complaint.ward ?? "Unassigned ward"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-ink-500">Distance</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-900">
                        <Route className="h-3.5 w-3.5 text-brand-600" />
                        {formatDistance(complaint.distance_km)} from you
                      </p>
                      {complaint.distance_km !== null && (
                        <a
                          className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                          href={`https://www.openstreetmap.org/?mlat=${complaint.latitude}&mlon=${complaint.longitude}#map=16/${complaint.latitude}/${complaint.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <MiniMap lat={complaint.latitude} lon={complaint.longitude} label={complaint.address} />
                  </div>
                </div>
              </Card>

              {/* ------------------------------------------------- field actions */}
              {(step || canProof) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-brand-200 bg-brand-50/50">
                    <CardHeader
                      title="Field actions"
                      subtitle="Each step is timestamped and notifies the citizen"
                      icon={<Truck className="h-4 w-4" />}
                    />

                    <Textarea
                      label="Field note (optional)"
                      rows={2}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="e.g. Drain was blocked by a parked van, cleared after asking the shop to move it."
                    />

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {step && (
                        <Button loading={busy} onClick={() => void advance()} icon={<step.icon className="h-4 w-4" />}>
                          {step.label}
                        </Button>
                      )}

                      {canProof && (
                        <div className="flex w-full flex-wrap items-end gap-3 border-t border-brand-200 pt-4">
                          <label className="flex-1 basis-40">
                            <span className="mb-1 block text-xs font-medium text-ink-700">Before photo</span>
                            <input
                              ref={beforeRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="w-full rounded-lg border border-ink-200 bg-white p-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-brand-800"
                            />
                          </label>
                          <label className="flex-1 basis-40">
                            <span className="mb-1 block text-xs font-medium text-ink-700">After photo</span>
                            <input
                              ref={afterRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="w-full rounded-lg border border-ink-200 bg-white p-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-brand-800"
                            />
                          </label>
                          <Button
                            loading={busy}
                            onClick={() => void uploadProof()}
                            icon={<ImageUp className="h-4 w-4" />}
                          >
                            Upload proof
                          </Button>
                        </div>
                      )}

                      {complaint.status === "PROOF_UPLOADED" && (
                        <p className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-brand-900">
                          <Camera className="h-3.5 w-3.5" />
                          Proof submitted. A supervisor is verifying the before and after photos.
                        </p>
                      )}
                      {complaint.status === "ARRIVED" && !canProof && (
                        <p className="text-xs text-brand-800">
                          Mark the waste as collected to unlock the proof upload step.
                        </p>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )}

              <Card>
                <CardHeader title="Progress so far" icon={<CheckCircle2 className="h-4 w-4" />} />
                <ComplaintTimeline timeline={complaint.timeline} />
              </Card>

              {complaint.evidence.length > 0 && (
                <Card>
                  <CardHeader title="Evidence on record" icon={<Camera className="h-4 w-4" />} />
                  <EvidenceCompare
                    evidence={complaint.evidence}
                    beforeScore={complaint.before_cleanliness}
                    afterScore={complaint.after_cleanliness}
                    verificationStatus={complaint.verification_status}
                    verificationNotes={complaint.verification_notes}
                  />
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <PriorityExplain
                score={complaint.priority_score}
                level={complaint.priority_level}
                breakdown={complaint.priority_breakdown}
                reasons={complaint.priority_reasons}
              />

              <Card>
                <CardHeader title="Recommended action" icon={<Package className="h-4 w-4" />} />
                <p className="text-sm text-ink-700">{complaint.recommended_action ?? "Standard collection."}</p>
                {complaint.detected_objects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {complaint.detected_objects.map((object) => (
                      <Badge key={object} tone="violet" size="xs">
                        {object}
                      </Badge>
                    ))}
                  </div>
                )}
                {complaint.duplicate_group && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    Clearing this job also resolves {complaint.duplicate_group} in the same visit.
                  </p>
                )}
              </Card>

              <Card>
                <CardHeader title="Shortcuts" />
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    block
                    onClick={() => navigate(`/worker/tasks`)}
                    icon={<Route className="h-3.5 w-3.5" />}
                  >
                    Back to my queue
                  </Button>
                  {complaint.status === "ASSIGNED" && (
                    <Button size="sm" block onClick={() => void advance()} icon={<Navigation className="h-3.5 w-3.5" />}>
                      Start travelling
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </AsyncBoundary>

      {error && <ErrorState error={error} onRetry={() => void refetch()} className="mt-6" />}
    </AppShell>
  );
}
