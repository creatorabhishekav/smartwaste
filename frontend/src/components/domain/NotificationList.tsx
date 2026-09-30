import { useNavigate } from "react-router-dom";
import { BellRing, CheckCheck, CircleAlert, Info, ShieldCheck } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { timeAgo } from "../../lib/format";
import type { AppNotification, NotificationType } from "../../lib/types";
import Button from "../ui/Button";
import { EmptyState, SkeletonRows } from "../ui/States";

const TYPE_META: Record<NotificationType, { icon: typeof Info; className: string }> = {
  INFO: { icon: Info, className: "text-blue-600 bg-blue-50" },
  SUCCESS: { icon: ShieldCheck, className: "text-brand-600 bg-brand-50" },
  WARNING: { icon: CircleAlert, className: "text-amber-600 bg-amber-50" },
  ALERT: { icon: BellRing, className: "text-red-600 bg-red-50" },
};

type Props = {
  compact?: boolean;
  onChanged?: () => void;
  onNavigate?: () => void;
};

export default function NotificationList({ compact = false, onChanged, onNavigate }: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi<{ items: AppNotification[]; unread: number }>(
    "/notifications",
    { query: { page_size: compact ? 8 : 50 } },
  );

  const markRead = async (id: number) => {
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      await refetch();
      onChanged?.();
    } catch {
      toast.error("Could not mark as read", "Please retry in a moment.");
    }
  };

  const markAllRead = async () => {
    try {
      await api("/notifications/read-all", { method: "POST" });
      await refetch();
      onChanged?.();
      toast.success("All caught up", "Every notification is marked as read.");
    } catch {
      toast.error("Could not mark all as read", "Please retry in a moment.");
    }
  };

  const open = (notification: AppNotification) => {
    if (notification.complaint_id) {
      const path = notification.type === "INFO" && notification.complaint_id.startsWith("PU-")
        ? `/app/pickup?ref=${notification.pickup_ref ?? notification.complaint_id}`
        : `/app/complaints/${notification.complaint_id}`;
      navigate(path);
      onNavigate?.();
    }
  };

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">Notifications</p>
          <p className="text-[11px] text-ink-500">
            {data ? `${data.unread} unread of ${data.items.length}` : "Loading…"}
          </p>
        </div>
        {(data?.unread ?? 0) > 0 && (
          <Button variant="ghost" size="sm" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-3"><SkeletonRows rows={3} /></div>}

        {error && !loading && (
          <div className="p-4 text-sm text-red-700">
            Unable to load notifications.
            <button type="button" onClick={() => void refetch()} className="ml-2 underline">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data?.items.length === 0 && (
          <div className="p-4">
            <EmptyState
              title="No notifications yet"
              description="Updates about your reports, pickups and crews appear here."
              icon={<BellRing className="h-5 w-5" />}
            />
          </div>
        )}

        {!loading &&
          !error &&
          data?.items.map((notification) => {
            const meta = TYPE_META[notification.type] ?? TYPE_META.INFO;
            const Icon = meta.icon;
            return (
              <div
                key={notification.id}
                className={`flex gap-3 border-b border-ink-50 px-4 py-3 transition ${
                  notification.is_read ? "bg-white" : "bg-brand-50/40"
                }`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.className}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink-900">{notification.title}</p>
                    <time className="shrink-0 text-[10px] text-ink-400" dateTime={notification.created_at}>
                      {timeAgo(notification.created_at)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{notification.message}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {notification.complaint_id && (
                      <button
                        type="button"
                        onClick={() => open(notification)}
                        className="-mx-2 -my-2 inline-flex items-center rounded-md px-2 py-2 text-[11px] font-medium text-brand-700 hover:underline"
                      >
                        View {notification.complaint_id}
                      </button>
                    )}
                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => void markRead(notification.id)}
                        className="-mx-2 -my-2 inline-flex items-center rounded-md px-2 py-2 text-[11px] text-ink-500 hover:text-ink-800 hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
