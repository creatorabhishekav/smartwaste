import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ImagePlus,
  MapPin,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { Textarea } from "../../components/ui/Field";
import { AsyncBoundary } from "../../components/ui/States";
import ImageDropzone from "../../components/domain/ImageDropzone";
import LocationPicker, { type LngLat } from "../../components/domain/LocationPicker";
import PriorityExplain from "../../components/domain/PriorityExplain";
import { CategoryChip } from "../../components/domain/Badges";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { useApi } from "../../hooks/useApi";
import { CATEGORY_META, CATEGORY_ORDER, CITY_CENTER } from "../../lib/constants";
import { formatScore } from "../../lib/format";
import type { Complaint, ComplaintCategory, PreviewAnalysis, UploadConfig } from "../../lib/types";

const STEPS = [
  { key: 1, label: "Issue", hint: "What kind of waste problem?" },
  { key: 2, label: "Photo", hint: "Evidence helps AI score it" },
  { key: 3, label: "Location", hint: "Pin the exact spot" },
  { key: 4, label: "Details", hint: "Describe what you see" },
  { key: 5, label: "AI Analysis", hint: "Live severity and priority" },
  { key: 6, label: "Submit", hint: "Confirm and send to the city" },
] as const;

export default function ReportWaste() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ComplaintCategory | "">("");
  const [image, setImage] = useState<File | null>(null);
  const [point, setPoint] = useState<LngLat>(CITY_CENTER);
  const [address, setAddress] = useState("");
  const [ward, setWard] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<PreviewAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Complaint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: uploadConfig } = useApi<UploadConfig>("/uploads/config");
  const maxMb = uploadConfig?.max_mb ?? 5;

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(category);
    if (step === 2) return Boolean(image);
    if (step === 3) return address.trim().length > 3;
    if (step === 4) return description.trim().length > 4;
    if (step === 5) return Boolean(preview);
    return false;
  }, [step, category, image, address, description, preview]);

  /** Step 5 calls the backend preview endpoint - no record is created yet. */
  const runAnalysis = async () => {
    if (!category) return;
    setAnalyzing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("category", category);
      form.append("description", description);
      form.append("address", address);
      form.append("ward", ward);
      form.append("latitude", String(point.lat));
      form.append("longitude", String(point.lon));
      if (image) form.append("image", image);
      const result = await api<PreviewAnalysis>("/complaints/preview-analysis", {
        method: "POST",
        form,
      });
      setPreview(result);
      setStep(5);
    } catch (err) {
      setError(ApiErrorDetail(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const submit = async () => {
    if (!category) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("category", category);
      form.append("latitude", String(point.lat));
      form.append("longitude", String(point.lon));
      form.append("address", address.trim());
      form.append("description", description.trim());
      if (ward) form.append("ward", ward);
      form.append("run_ai", "true");
      if (image) form.append("image", image);
      const result = await api<{ complaint: Complaint; message: string }>("/complaints", {
        method: "POST",
        form,
      });
      setCreated(result.complaint);
      toast.success("Report submitted", `${result.complaint.complaint_id} is now in the city queue.`);
    } catch (err) {
      setError(ApiErrorDetail(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setCategory("");
    setImage(null);
    setPoint(CITY_CENTER);
    setAddress("");
    setWard("");
    setDescription("");
    setPreview(null);
    setCreated(null);
    setError(null);
  };

  // ------------------------------------------------------------ success view
  if (created) {
    return (
      <AppShell title="Report submitted" subtitle="Your report is live in the municipal queue">
        <div className="mx-auto max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex flex-col items-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Check className="h-8 w-8" strokeWidth={3} />
                </span>
                <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink-900">
                  Thank you for reporting
                </h2>
                <p className="mt-2 text-sm text-ink-500">
                  Your report has been analysed and queued. The ward supervisor assigns a crew next.
                </p>

                <div className="mt-6 flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 px-5 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">Complaint ID</p>
                    <p className="font-mono text-lg font-semibold text-ink-900">{created.complaint_id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(created.complaint_id);
                      toast.info("Copied", `${created.complaint_id} copied to clipboard.`);
                    }}
                    className="rounded-lg p-2 text-ink-400 transition hover:bg-white hover:text-ink-700"
                    aria-label="Copy complaint ID"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 w-full grid-cols-2 gap-3 text-left sm:grid-cols-3">
                  <div className="rounded-lg border border-ink-200 p-3">
                    <p className="text-[11px] text-ink-500">Category</p>
                    <div className="mt-1">
                      <CategoryChip category={created.category} size="xs" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-ink-200 p-3">
                    <p className="text-[11px] text-ink-500">Severity</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">{formatScore(created.severity)}</p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-ink-200 p-3 sm:col-span-1">
                    <p className="text-[11px] text-ink-500">Priority</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {created.priority_level} · {formatScore(created.priority_score)}
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() => navigate(`/app/complaints/${created.complaint_id}`)}
                    icon={<MapPin className="h-4 w-4" />}
                  >
                    Track this report
                  </Button>
                  <Button variant="outline" onClick={reset} icon={<RotateCcw className="h-4 w-4" />}>
                    Report another issue
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Report waste" subtitle="Six quick steps · AI scores the issue before you submit">
      <div className="mx-auto max-w-4xl">
        {/* Stepper */}
        <ol className="mb-6 flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((item) => {
            const state = item.key < step ? "done" : item.key === step ? "current" : "todo";
            return (
              <li key={item.key} className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  disabled={item.key > step}
                  onClick={() => setStep(item.key)}
                  className={`flex min-w-0 flex-col gap-1 rounded-lg px-2 py-1.5 text-left transition ${
                    state === "current" ? "bg-brand-50" : ""
                  } ${item.key > step ? "cursor-not-allowed opacity-60" : "hover:bg-ink-50"}`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                        state === "done"
                          ? "bg-brand-600 text-white"
                          : state === "current"
                            ? "bg-ink-900 text-white"
                            : "bg-ink-200 text-ink-500"
                      }`}
                    >
                      {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : item.key}
                    </span>
                    <span
                      className={`truncate text-xs font-medium ${
                        state === "current" ? "text-ink-900" : "text-ink-500"
                      }`}
                    >
                      {item.label}
                    </span>
                  </span>
                </button>
                {item.key < STEPS.length && (
                  <span
                    className={`hidden h-px flex-1 sm:block ${
                      item.key < step ? "bg-brand-400" : "bg-ink-200"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-800">Could not complete that step</p>
              <p className="mt-0.5 break-words text-xs text-red-700">{error}</p>
            </div>
          </div>
        )}

        <Card>
          <div className="mb-5">
            <h2 className="text-base font-semibold text-ink-900">
              Step {step}: {STEPS[step - 1].label}
            </h2>
            <p className="mt-0.5 text-sm text-ink-500">{STEPS[step - 1].hint}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              {/* ------------------------------------------------ step 1: issue */}
              {step === 1 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {CATEGORY_ORDER.map((key) => {
                    const meta = CATEGORY_META[key];
                    const Icon = meta.icon;
                    const active = category === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key)}
                        className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition ${
                          active
                            ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20"
                            : "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/20"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-semibold text-ink-900">{meta.label}</span>
                        <span className="text-xs leading-relaxed text-ink-500">{meta.blurb}</span>
                        {active && (
                          <span className="mt-auto flex items-center gap-1 text-xs font-medium text-brand-700">
                            <Check className="h-3 w-3" /> Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ------------------------------------------------ step 2: photo */}
              {step === 2 && (
                <div className="space-y-4">
                  <ImageDropzone
                    file={image}
                    onChange={setImage}
                    maxMb={maxMb}
                    label="Photo of the waste issue"
                    hint="A clear photo improves AI accuracy and speeds up crew dispatch."
                  />
                  <div className="flex items-start gap-2.5 rounded-lg bg-ink-50 p-3.5">
                    <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <p className="text-xs leading-relaxed text-ink-600">
                      The image is analysed for waste type, severity and visible objects. It is stored
                      with your report as evidence and is visible to the assigned crew.
                    </p>
                  </div>
                </div>
              )}

              {/* ---------------------------------------------- step 3: location */}
              {step === 3 && (
                <LocationPicker
                  value={point}
                  address={address}
                  ward={ward}
                  onChange={(patch) => {
                    if (patch.lat !== undefined) setPoint((p) => ({ ...p, lat: patch.lat as number }));
                    if (patch.lon !== undefined) setPoint((p) => ({ ...p, lon: patch.lon as number }));
                    if (patch.address !== undefined) setAddress(patch.address);
                    if (patch.ward !== undefined) setWard(patch.ward);
                  }}
                />
              )}

              {/* ---------------------------------------------- step 4: details */}
              {step === 4 && (
                <div className="space-y-4">
                  <Textarea
                    label="Describe the issue"
                    required
                    rows={5}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. The community bin has not been emptied for three days. Waste is spilling into the road and there is a strong smell near the school gate."
                    hint="Mention smells, waterlogging, insects, children or sensitive places — these raise the priority score."
                  />
                  <div className="rounded-lg bg-ink-50 p-3.5">
                    <p className="text-xs font-medium text-ink-700">Tips for a higher-impact report</p>
                    <ul className="mt-1.5 space-y-1 text-xs text-ink-600">
                      <li>• Describe the size of the problem: heap, half-full bin, whole street.</li>
                      <li>• Name who is affected: school, hospital, market, temple, housing society.</li>
                      <li>• Mention how long it has been there — ageing increases priority.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* ------------------------------------------- step 5: AI analysis */}
              {step === 5 && (
                <AsyncBoundary loading={analyzing} error={null}>
                  {preview ? (
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <div className="space-y-4">
                        <div className="rounded-xl border border-ink-200 p-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-violet-600" />
                            <p className="text-sm font-semibold text-ink-900">AI analysis</p>
                            <Badge tone="violet" size="xs" className="ml-auto">
                              {preview.analysis.provider}
                            </Badge>
                          </div>
                          <dl className="mt-3 space-y-2.5 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-ink-500">Waste type</dt>
                              <dd className="font-medium text-ink-900">
                                {preview.analysis.waste_type ?? "-"}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-ink-500">Issue</dt>
                              <dd className="font-medium text-ink-900">
                                {CATEGORY_META[preview.analysis.issue_type as ComplaintCategory]?.label ??
                                  preview.analysis.issue_type ??
                                  "-"}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-ink-500">Severity</dt>
                              <dd className="font-semibold tabular-nums text-ink-900">
                                {formatScore(preview.analysis.severity)} / 100
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-ink-500">Confidence</dt>
                              <dd className="tabular-nums text-ink-900">
                                {Math.round(preview.analysis.confidence * 100)}%
                              </dd>
                            </div>
                          </dl>

                          {preview.analysis.detected_objects.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-ink-700">Detected objects</p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {preview.analysis.detected_objects.map((object) => (
                                  <Badge key={object} tone="slate" size="xs">
                                    {object}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {preview.analysis.description_summary && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-ink-700">What we detected</p>
                              <p className="mt-0.5 text-xs text-ink-600">
                                {preview.analysis.description_summary}
                              </p>
                            </div>
                          )}

                          {preview.analysis.recommended_action && (
                            <div className="mt-3 rounded-lg bg-brand-50 p-3">
                              <p className="text-xs font-medium text-brand-800">Recommended action</p>
                              <p className="mt-0.5 text-xs text-brand-800">{preview.analysis.recommended_action}</p>
                            </div>
                          )}

                          {preview.analysis.environmental_risk && (
                            <div className="mt-3 rounded-lg bg-amber-50 p-3">
                              <p className="text-xs font-medium text-amber-800">Environmental risk</p>
                              <p className="mt-0.5 text-xs text-amber-800">
                                {preview.analysis.environmental_risk}
                              </p>
                            </div>
                          )}

                          {preview.severity_reasoning.factors.length > 0 && (
                            <div className="mt-3 rounded-lg bg-ink-50 p-3">
                              <p className="text-xs font-medium text-ink-700">Severity reasoning</p>
                              <ul className="mt-1 space-y-0.5">
                                {preview.severity_reasoning.factors.map((factor) => (
                                  <li key={factor} className="text-xs text-ink-600">
                                    {factor}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {preview.duplicate_of && (
                          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-xs text-amber-800">
                              A similar open report ({preview.duplicate_of.complaint_id}) exists{" "}
                              {preview.duplicate_of.distance_meters} m away. Yours will be linked so the
                              crew handles both in one visit.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <PriorityExplain
                          score={preview.priority.score}
                          level={preview.priority.level}
                          breakdown={preview.priority.breakdown}
                          reasons={preview.priority.reasons}
                        />
                        <div className="rounded-xl border border-ink-200 p-4">
                          <p className="text-xs font-medium text-ink-700">Nearby open reports</p>
                          <p className="mt-1 text-2xl font-semibold text-ink-900">
                            {preview.nearby_reports}
                          </p>
                          <p className="mt-1 text-xs text-ink-500">
                            Reports within 600 m increase cluster pressure in the priority model.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => void runAnalysis()} loading={analyzing}>
                          Re-run analysis
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </AsyncBoundary>
              )}

              {/* ---------------------------------------------- step 6: submit */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { label: "Issue", value: CATEGORY_META[category as ComplaintCategory]?.label ?? "—", icon: Trash2 },
                      { label: "Location", value: address, icon: MapPin },
                      { label: "Ward", value: ward || "Not specified", icon: MapPin },
                      {
                        label: "Coordinates",
                        value: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`,
                        icon: MapPin,
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-xl border border-ink-200 p-3.5">
                          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-500">
                            <Icon className="h-3 w-3" />
                            {item.label}
                          </p>
                          <p className="mt-1 truncate text-sm font-medium text-ink-900">{item.value}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-ink-200 p-4">
                    <p className="text-xs font-medium text-ink-700">Description</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{description}</p>
                  </div>

                  {preview && (
                    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                      <p className="text-xs font-medium text-brand-800">
                        On submit, the AI will run again and store priority{" "}
                        <span className="font-semibold">
                          {preview.priority.level} · {preview.priority.score.toFixed(0)}
                        </span>{" "}
                        for this report.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer controls */}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-ink-100 pt-5">
            <Button
              variant="outline"
              onClick={() => (step === 1 ? navigate("/app/dashboard") : setStep((s) => s - 1))}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            <div className="flex items-center gap-2">
              {step < 5 ? (
                <Button
                  onClick={() => (step === 4 ? void runAnalysis() : setStep((s) => s + 1))}
                  disabled={!canContinue}
                  loading={step === 4 && analyzing}
                  icon={step === 4 ? <Sparkles className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                >
                  {step === 4 ? "Analyse with AI" : "Continue"}
                </Button>
              ) : step === 5 ? (
                <Button onClick={() => setStep(6)} disabled={!preview} icon={<ArrowRight className="h-4 w-4" />}>
                  Review & submit
                </Button>
              ) : (
                <Button onClick={() => void submit()} loading={submitting} icon={<Send className="h-4 w-4" />}>
                  Submit report
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

/** Normalises thrown values into a readable sentence. */
function ApiErrorDetail(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("Cannot connect")
    ? "Unable to connect to SmartWaste API. Confirm the backend is running on port 8000."
    : message;
}
