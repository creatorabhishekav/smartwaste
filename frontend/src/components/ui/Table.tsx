import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
  pageSize?: number;
};

export default function Pagination({ page, pages, total, onChange, pageSize = 20 }: Props) {
  if (pages <= 1) {
    return (
      <p className="px-1 text-xs text-ink-500">
        {total} record{total === 1 ? "" : "s"}
      </p>
    );
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-xs text-ink-500">
        Showing <span className="font-medium text-ink-700">{from}</span>–
        <span className="font-medium text-ink-700">{to}</span> of{" "}
        <span className="font-medium text-ink-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <span className="px-2 text-xs tabular-nums text-ink-500">
          Page {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Professional data table shell: horizontal scroll container + consistent header. */
export function TableShell({ children, minWidth = 960 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="overflow-hidden rounded-xl border border-ink-200" style={{ minWidth }}>
        <div className="overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}

const ALIGN = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: keyof typeof ALIGN;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap bg-ink-50 px-3 py-2.5 ${ALIGN[align]} text-[11px] font-semibold uppercase tracking-wide text-ink-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  align?: keyof typeof ALIGN;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-2.5 ${ALIGN[align]} align-middle text-sm text-ink-700 ${className}`}
    >
      {children}
    </td>
  );
}
