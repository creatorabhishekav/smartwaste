import type { ReactNode } from "react";
import { motion } from "framer-motion";

type Props = {
  children: ReactNode;
  className?: string;
  /** Adds a subtle lift animation when mounted. */
  animate?: boolean;
  padded?: boolean;
  as?: "div" | "section" | "article" | "li";
};

export default function Card({
  children,
  className = "",
  animate = false,
  padded = true,
  as: Tag = "div",
}: Props) {
  const base = `rounded-2xl border border-ink-200/80 bg-white shadow-sm shadow-ink-900/[0.03] ${
    padded ? "p-5" : ""
  } ${className}`;
  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className={base}
      >
        {children}
      </motion.div>
    );
  }
  return <Tag className={base}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold tracking-tight text-ink-900">{children}</h2>
      {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
    </div>
  );
}
