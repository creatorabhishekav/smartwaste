import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import NotificationList from "../../components/domain/NotificationList";
import { Info } from "lucide-react";

export default function NotificationsPage() {
  return (
    <AppShell title="Notifications" subtitle="Assignment, status and awareness alerts">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="All notifications"
            subtitle="Mark individual items as read or clear the whole inbox"
            icon={<Info className="h-4 w-4" />}
          />
          <NotificationList />
        </Card>

        <Card>
          <CardHeader title="What you get notified about" />
          <ul className="space-y-3 text-sm text-ink-600">
            {[
              ["Assignment", "A crew is assigned to your complaint."],
              ["Status change", "Your report moves to in-progress or resolved."],
              ["Evidence verification", "A supervisor accepted or flagged the cleanup proof."],
              ["Pickup updates", "A doorstep pickup is scheduled or completed."],
              ["Awareness tips", "Seasonal waste guidance for your city."],
            ].map(([title, body]) => (
              <li key={title} className="rounded-lg border border-ink-200 p-3">
                <p className="text-sm font-medium text-ink-900">{title}</p>
                <p className="mt-0.5 text-xs text-ink-500">{body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
