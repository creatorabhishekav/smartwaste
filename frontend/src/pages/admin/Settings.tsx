import { useState } from "react";
import {
  Bot,
  CheckCircle2,
  Database,
  FolderOpen,
  HardDrive,
  KeyRound,
  RefreshCw,
  Settings2,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { ErrorState, SkeletonRows } from "../../components/ui/States";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api } from "../../lib/api";
import { fileSize } from "../../lib/format";
import type { Health, SystemStatus, UploadConfig } from "../../lib/types";

export default function Settings() {
  const toast = useToast();
  const { user } = useAuth();
  const [recomputing, setRecomputing] = useState(false);

  const system = useApi<SystemStatus>("/admin/system");
  const uploads = useApi<UploadConfig>("/uploads/config");
  const health = useApi<Health>("/health");

  const recompute = async () => {
    setRecomputing(true);
    try {
      const result = await api<{ count: number }>("/admin/recompute", { method: "POST" });
      toast.success("Recomputed", `${result.count} hotspot clusters refreshed.`);
    } catch (err) {
      toast.error("Recompute failed", err instanceof ApiError ? err.detail : "Unknown error");
    } finally {
      setRecomputing(false);
    }
  };

  const Row = ({
    label,
    value,
    ok,
  }: {
    label: string;
    value: string;
    ok?: boolean;
  }) => (
    <div className="flex items-center justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="flex items-center gap-2 text-right text-sm font-medium text-ink-900">
        {ok !== undefined &&
          (ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          ))}
        <span className="break-all">{value}</span>
      </dd>
    </div>
  );

  return (
    <AppShell title="System settings" subtitle="Runtime status, AI provider and maintenance actions">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Service status" subtitle="Live runtime diagnostics" icon={<Server className="h-4 w-4" />} />
          {system.error && <ErrorState error={system.error} onRetry={() => void system.refetch()} />}
          {system.loading && <SkeletonRows rows={5} />}
          {system.data && (
            <dl>
              <Row label="Application" value={system.data.app} />
              <Row label="Environment" value={system.data.environment} />
              <Row label="Database" value={system.data.database} ok={health.data?.database === "ok"} />
              <Row label="Health endpoint" value={health.data?.status ?? "unknown"} ok={health.data?.status === "ok"} />
              <Row label="Upload limit" value={`${system.data.max_upload_mb} MB`} />
            </dl>
          )}
          {health.data?.database_error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{health.data.database_error}</p>
          )}
        </Card>

        <Card>
          <CardHeader title="AI provider" subtitle="Analysis and verification engine" icon={<Bot className="h-4 w-4" />} />
          {system.error && <ErrorState error={system.error} />}
          {system.loading && <SkeletonRows rows={3} />}
          {system.data && (
            <>
              <dl>
                <Row label="Provider" value={system.data.ai.provider} />
                <Row label="Model" value={system.data.ai.model} />
                <Row label="Live AI enabled" value={system.data.ai.live_ai ? "Yes" : "No (deterministic demo)"} ok={system.data.ai.live_ai} />
                <Row label="API key configured" value={system.data.ai.api_key_configured ? "Yes" : "No"} ok={system.data.ai.api_key_configured} />
                <Row label="Verification provider" value={system.data.verification_provider} />
              </dl>
              {!system.data.ai.live_ai && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  Set <span className="font-mono">GEMINI_API_KEY</span> in the backend environment and restart
                  to enable live AI. Without it, the deterministic demo provider produces stable, explainable results.
                </p>
              )}
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Uploads" subtitle="Image validation and storage" icon={<FolderOpen className="h-4 w-4" />} />
          {uploads.loading && <SkeletonRows rows={4} />}
          {uploads.error && <ErrorState error={uploads.error} onRetry={() => void uploads.refetch()} />}
          {uploads.data && (
            <>
              <dl>
                <Row label="Storage directory" value={system.data?.upload_dir ?? "unknown"} />
                <Row label="Directory exists" value={uploads.data.upload_dir_exists ? "Yes" : "No"} ok={uploads.data.upload_dir_exists} />
                <Row label="Max file size" value={fileSize(uploads.data.max_bytes)} />
                <Row label="Allowed types" value={uploads.data.allowed_types.join(", ")} />
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {uploads.data.folders.map((folder) => (
                  <Badge key={folder} tone="slate" size="xs">
                    <HardDrive className="h-2.5 w-2.5" />
                    {folder}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-500">
                Magic-byte validation blocks renamed executables regardless of the declared MIME type.
              </p>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Maintenance" subtitle="Administrative actions" icon={<Settings2 className="h-4 w-4" />} />
          <div className="space-y-3">
            <Button
              block
              loading={recomputing}
              onClick={() => void recompute()}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Recompute hotspot clusters
            </Button>
            <p className="text-xs text-ink-500">
              Reclusters open complaints into hotspots using live data. Safe to run at any time.
            </p>
          </div>

          <div className="mt-5 border-t border-ink-100 pt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <Database className="h-3.5 w-3.5" />
              Database fallback
            </p>
            <p className="text-xs leading-relaxed text-ink-600">
              If the configured <span className="font-mono">DATABASE_URL</span> is unreachable, startup no longer
              crashes. Data routes return HTTP 503 with an actionable message, and health, docs and the OpenAPI
              schema stay available for diagnosis.
            </p>
          </div>

          <div className="mt-5 border-t border-ink-100 pt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Signed in as
            </p>
            <p className="text-sm text-ink-800">
              {user?.name} · <span className="font-mono text-xs">{user?.email}</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
              <KeyRound className="h-3 w-3" />
              JWT-protected admin session
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
