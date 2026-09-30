import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2, PlugZap, Inbox, RefreshCw, AlertTriangle } from "lucide-react";
import { ApiError } from "../../lib/api";
import Button from "./Button";

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-brand-600 ${className}`} />;
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-ink-500">
      <Spinner className="h-6 w-6" />
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-ink-100" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink-400 shadow-sm">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <div>
        <p className="text-sm font-medium text-ink-800">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Renders a network/API failure with the exact recovery instruction.
 * Only shown when the request genuinely failed, so it never fires on a healthy API.
 */
export function ErrorState({
  error,
  onRetry,
  className = "",
}: {
  error: ApiError | Error | null;
  onRetry?: () => void;
  className?: string;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const isNetwork = apiError?.isNetworkError ?? false;
  const isDbDown = apiError?.status === 503;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border border-red-200 bg-red-50/70 p-5 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-red-600">
          {isNetwork ? <PlugZap className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-800">
            {isNetwork
              ? "Unable to connect to SmartWaste API"
              : isDbDown
                ? "Database unavailable"
                : "Something went wrong"}
          </p>
          <p className="mt-1 break-words text-sm text-red-700">
            {isNetwork
              ? "The backend is not responding. Start it with: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
              : (error?.message ?? "Unknown error")}
          </p>
          {isNetwork && (
            <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 font-mono text-xs text-red-700">
              cd smartwaste-360\backend → python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
            </p>
          )}
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Retry
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Wraps a page body with loading / error / empty handling in one place. */
export function AsyncBoundary({
  loading,
  error,
  isEmpty,
  onRetry,
  loadingFallback,
  empty,
  children,
}: {
  loading: boolean;
  error: ApiError | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  loadingFallback?: ReactNode;
  empty?: ReactNode;
  children: ReactNode;
}) {
  if (loading) return <>{loadingFallback ?? <LoadingBlock />}</>;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty ?? <EmptyState title="Nothing to show yet" />}</>;
  return <>{children}</>;
}
