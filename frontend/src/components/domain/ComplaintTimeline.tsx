import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { formatDateTime } from "../../lib/format";
import type { TimelineEntry } from "../../lib/types";

/**
 * Vertical lifecycle timeline. Driven by the backend `timeline` array, which
 * already reports which steps are completed and when they happened.
 */
export default function ComplaintTimeline({
  timeline,
  compact = false,
}: {
  timeline: TimelineEntry[];
  compact?: boolean;
}) {
  if (!timeline.length) {
    return <p className="text-sm text-ink-500">No timeline available.</p>;
  }

  return (
    <ol className="relative">
      {timeline.map((entry, index) => {
        const isLast = index === timeline.length - 1;
        return (
          <li key={entry.status} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute left-[11px] top-6 h-[calc(100%-1rem)] w-0.5 ${
                  entry.completed ? "bg-brand-300" : "bg-ink-200"
                }`}
              />
            )}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                entry.completed
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-ink-200 bg-white text-ink-300"
              }`}
            >
              {entry.completed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </motion.span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p
                  className={`text-sm font-medium ${
                    entry.completed ? "text-ink-900" : "text-ink-400"
                  }`}
                >
                  {entry.label}
                </p>
                {entry.timestamp && !compact && (
                  <time className="text-[11px] tabular-nums text-ink-400" dateTime={entry.timestamp}>
                    {formatDateTime(entry.timestamp)}
                  </time>
                )}
              </div>
              {entry.note && (
                <p className={`mt-0.5 text-xs ${entry.completed ? "text-ink-500" : "text-ink-300"}`}>
                  {entry.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
