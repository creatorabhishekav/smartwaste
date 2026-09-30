import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { mediaUrl } from "../../lib/api";
import { formatScore } from "../../lib/format";
import type { Evidence, VerificationResult } from "../../lib/types";

function findEvidence(evidence: Evidence[], type: "BEFORE" | "AFTER"): Evidence | undefined {
  return evidence.find((item) => item.evidence_type === type);
}

/** Side-by-side before/after evidence with the cleanliness scores from the backend. */
export default function EvidenceCompare({
  evidence,
  beforeScore,
  afterScore,
  verificationStatus,
  verificationNotes,
  verification,
}: {
  evidence: Evidence[];
  beforeScore: number | null;
  afterScore: number | null;
  verificationStatus: string | null;
  verificationNotes?: string | null;
  verification?: VerificationResult | null;
}) {
  const before = findEvidence(evidence, "BEFORE");
  const after = findEvidence(evidence, "AFTER");

  if (!before && !after) {
    return (
      <p className="rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-4 py-6 text-center text-sm text-ink-500">
        No proof photos yet. The crew uploads before/after evidence on site.
      </p>
    );
  }

  const approved = verificationStatus === "VERIFIED" || verificationStatus === "PASSED";
  const rejected = verificationStatus === "REJECTED" || verificationStatus === "FAILED";
  const improvement =
    beforeScore !== null && afterScore !== null ? Number((afterScore - beforeScore).toFixed(1)) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: "Before", image: before, score: beforeScore, tone: "text-red-600 bg-red-50" },
          { label: "After", image: after, score: afterScore, tone: "text-brand-700 bg-brand-50" },
        ].map((side) => (
          <figure key={side.label} className="overflow-hidden rounded-xl border border-ink-200">
            <div className="relative aspect-4/3 bg-ink-100">
              {side.image ? (
                <img
                  src={mediaUrl(side.image.file_url) ?? ""}
                  alt={`${side.label} photo`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-ink-400">
                  Not uploaded
                </span>
              )}
              <figcaption className="absolute left-2 top-2 rounded-md bg-ink-900/70 px-2 py-0.5 text-[11px] font-medium text-white">
                {side.label}
              </figcaption>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-ink-500">Cleanliness score</span>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold tabular-nums ${side.tone}`}>
                {formatScore(side.score)}
              </span>
            </div>
          </figure>
        ))}
      </div>

      {(verificationStatus || improvement !== null) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            approved
              ? "border-brand-200 bg-brand-50"
              : rejected
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-center gap-2">
            {approved ? (
              <CheckCircle2 className="h-5 w-5 text-brand-600" />
            ) : rejected ? (
              <XCircle className="h-5 w-5 text-red-600" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-amber-600" />
            )}
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Verification: {verificationStatus ?? "PENDING"}
              </p>
              {verificationNotes && (
                <p className="mt-0.5 text-xs text-ink-600">{verificationNotes}</p>
              )}
            </div>
          </div>
          {improvement !== null && (
            <p className="flex items-center gap-1 text-sm font-semibold text-ink-900">
              <ArrowRight className="h-3.5 w-3.5" />
              {improvement > 0 ? "+" : ""}
              {improvement} cleanliness improvement
            </p>
          )}
        </motion.div>
      )}

      {verification?.checks?.length ? (
        <ul className="space-y-1.5">
          {verification.checks.map((check) => (
            <li key={check.name} className="flex items-start gap-2 text-xs">
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              )}
              <span className="text-ink-700">
                <span className="font-medium">{check.name}</span> — {check.detail}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
