import Badge from "../ui/Badge";
import { CATEGORY_META, PICKUP_STATUS_META, PRIORITY_META, STATUS_META, WORKER_STATUS_META } from "../../lib/constants";
import type { Complaint, ComplaintCategory, ComplaintStatus, PickupStatus, PriorityLevel } from "../../lib/types";

export function PriorityBadge({
  level,
  score,
  size = "sm",
}: {
  level: PriorityLevel | null | undefined;
  score?: number | null;
  size?: "xs" | "sm";
}) {
  const meta = PRIORITY_META[level ?? "LOW"];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone} size={size} icon={<Icon className="h-3 w-3" />}>
      {meta.label}
      {score !== undefined && score !== null && (
        <span className="tabular-nums opacity-70">{score.toFixed(0)}</span>
      )}
    </Badge>
  );
}

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: ComplaintStatus | PickupStatus | string;
  size?: "xs" | "sm";
}) {
  const meta =
    STATUS_META[status as ComplaintStatus] ??
    PICKUP_STATUS_META[status as PickupStatus] ??
    WORKER_STATUS_META[status] ?? {
      label: status.replace(/_/g, " "),
      tone: "slate" as const,
      icon: Badge,
    };
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  );
}

export function CategoryChip({
  category,
  size = "sm",
}: {
  category: ComplaintCategory | string;
  size?: "xs" | "sm";
}) {
  const meta = CATEGORY_META[category as ComplaintCategory] ?? {
    label: String(category).replace(/_/g, " "),
    tone: "slate" as const,
    icon: Badge,
  };
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone} size={size} icon={<Icon className="h-3 w-3" />}>
      {meta.label}
    </Badge>
  );
}

/** Compact one-line row used inside dashboards and lists. */
export function ComplaintRef({ complaint }: { complaint: Complaint }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-xs font-medium text-brand-700">{complaint.complaint_id}</p>
      <p className="truncate text-xs text-ink-500">{complaint.address}</p>
    </div>
  );
}
