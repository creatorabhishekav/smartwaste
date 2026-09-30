import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TONE_SOLID, type Tone } from "../../lib/constants";

type Props = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  footer?: ReactNode;
  delay?: number;
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "emerald",
  hint,
  footer,
  delay = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-4 shadow-sm shadow-ink-900/[0.03] transition hover:border-ink-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">
            {value}
          </p>
          {hint && <p className="mt-1 truncate text-xs text-ink-500">{hint}</p>}
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_SOLID[tone]} text-white shadow-sm`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: "currentColor" }}
      />
      {footer && <div className="mt-3 border-t border-ink-100 pt-3">{footer}</div>}
    </motion.div>
  );
}

/** Compact progress bar used for rates and cleanliness scores. */
export function MeterBar({
  value,
  max = 100,
  tone = "emerald",
  label,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colors: Record<Tone, string> = {
    slate: "bg-ink-400",
    emerald: "bg-brand-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    cyan: "bg-cyan-500",
  };
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-ink-500">{label}</span>
          <span className="font-medium text-ink-700 tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full rounded-full ${colors[tone]}`}
        />
      </div>
    </div>
  );
}
