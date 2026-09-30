import { motion } from "framer-motion";
import { Info, MapPin, Clock3, Users, Sparkles } from "lucide-react";
import { PRIORITY_META } from "../../lib/constants";
import { formatScore } from "../../lib/format";
import type { PriorityBreakdown, PriorityLevel } from "../../lib/types";

const COMPONENT_META = [
  { key: "severity", label: "Severity", weight: 0.4, icon: Sparkles, tone: "bg-red-500" },
  { key: "age", label: "Age", weight: 0.2, icon: Clock3, tone: "bg-amber-500" },
  { key: "proximity", label: "Cluster pressure", weight: 0.2, icon: Users, tone: "bg-blue-500" },
  { key: "location", label: "Location sensitivity", weight: 0.2, icon: MapPin, tone: "bg-violet-500" },
] as const;

/**
 * Renders the backend's explainable priority formula:
 * severity 40% + age 20% + cluster pressure 20% + location sensitivity 20%.
 */
export default function PriorityExplain({
  score,
  level,
  breakdown,
  reasons = [],
  compact = false,
}: {
  score: number | null;
  level: PriorityLevel | null | undefined;
  breakdown: PriorityBreakdown | null | undefined;
  reasons?: string[];
  compact?: boolean;
}) {
  const meta = PRIORITY_META[level ?? "LOW"];

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Priority score</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink-900">
              {formatScore(score)}
            </span>
            <span className="text-sm text-ink-400">/ 100</span>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
              meta.tone === "red"
                ? "bg-red-50 text-red-700 ring-red-200"
                : meta.tone === "amber"
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : meta.tone === "cyan"
                    ? "bg-cyan-50 text-cyan-700 ring-cyan-200"
                    : "bg-ink-100 text-ink-700 ring-ink-200"
            }`}
          >
            {meta.label}
          </span>
          <p className="mt-1 text-[11px] text-ink-500">{meta.hint}</p>
        </div>
      </div>

      {breakdown && (
        <div className="mt-4 space-y-2.5">
          {COMPONENT_META.map((component, index) => {
            const data = breakdown?.[component.key as keyof PriorityBreakdown];
            if (!data) return null;
            const Icon = component.icon;
            return (
              <div key={component.key}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-ink-600">
                    <Icon className="h-3.5 w-3.5 text-ink-400" />
                    {component.label}
                    <span className="text-ink-400">({Math.round(component.weight * 100)}%)</span>
                    {data.nearby_count !== undefined && (
                      <span className="rounded bg-ink-100 px-1 text-[10px] text-ink-500">
                        {data.nearby_count} nearby
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-ink-500">
                    {formatScore(data.value)} × {component.weight} ={" "}
                    <span className="font-medium text-ink-800">{formatScore(data.contribution)}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (data.contribution / (component.weight * 100)) * 100)}%` }}
                    transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
                    className={`h-full rounded-full ${component.tone}`}
                  />
                </div>
                {data.label && <p className="mt-1 text-[11px] text-ink-400">{data.label}</p>}
              </div>
            );
          })}
        </div>
      )}

      {!compact && reasons.length > 0 && (
        <div className="mt-4 rounded-lg bg-ink-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-700">
            <Info className="h-3.5 w-3.5" />
            Why this score
          </p>
          <ul className="mt-1.5 space-y-1">
            {reasons.map((reason) => (
              <li key={reason} className="text-xs text-ink-600">
                • {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
