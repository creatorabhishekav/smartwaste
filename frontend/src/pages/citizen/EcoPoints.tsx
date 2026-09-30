import { motion } from "framer-motion";
import { Award, Coins, History, Sparkles, Star, TrendingUp } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { ErrorState, SkeletonRows } from "../../components/ui/States";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { formatDateTime } from "../../lib/format";
import type { EcoPayload } from "../../lib/types";

export default function EcoPoints() {
  const { data, loading, error, refetch } = useApi<EcoPayload>("/auth/me/eco");
  const { user } = useAuth();

  const percent = data?.next_level
    ? Math.min(100, Math.round(((data.xp_into_level ?? 0) / Math.max(1, data.next_level.needed)) * 100))
    : 100;

  return (
    <AppShell title="Eco points" subtitle={`Rewards for ${user?.name ?? "your"} clean-city contributions`}>
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2"
        >
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-7 text-white">
              <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                Total eco points
              </p>
              <div className="mt-2 flex items-end gap-3">
                <span className="text-5xl font-bold tabular-nums">
                  {loading ? "—" : (data?.eco_points ?? 0)}
                </span>
                <span className="mb-1.5 flex items-center gap-1 text-sm text-white/80">
                  <Coins className="h-4 w-4" />
                  points
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Star className="h-3.5 w-3.5" />
                    {data?.level ?? "Level 1"}
                  </span>
                  {data?.next_level ? (
                    <span>
                      {data.xp_into_level} / {data.next_level.needed} to {data.next_level.level}
                    </span>
                  ) : (
                    <span>Top level reached</span>
                  )}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.7 }}
                    className="h-full rounded-full bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              {[
                { label: "Level number", value: data?.level_number ?? 1 },
                { label: "Points this level", value: data?.xp_into_level ?? 0 },
                { label: "Points to next", value: data?.next_level?.needed ?? 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-ink-50 p-3.5">
                  <p className="text-[11px] uppercase tracking-wide text-ink-500">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <Card>
          <CardHeader title="How to earn" icon={<Sparkles className="h-4 w-4" />} />
          <ul className="space-y-3 text-sm text-ink-600">
            {[
              ["Report waste", "+25", "A verified complaint report"],
              ["Rate a cleanup", "+10", "Confirm a resolved report looks good"],
              ["Complete a pickup", "+40", "Crew completes a doorstep request"],
              ["Daily check-in", "+5", "Keep the streak going"],
            ].map(([action, points, note]) => (
              <li key={action} className="flex items-start justify-between gap-3 border-b border-ink-100 pb-2.5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink-900">{action}</p>
                  <p className="text-xs text-ink-500">{note}</p>
                </div>
                <Badge tone="emerald" size="sm" className="shrink-0">{points}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Badges"
            subtitle={data ? `${data.badges.filter((b) => b.earned).length} of ${data.badges.length} earned` : undefined}
            icon={<Award className="h-4 w-4" />}
          />
          {loading && <SkeletonRows rows={3} />}
          {data && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {data.badges.map((badge) => (
                <div
                  key={badge.name}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    badge.earned ? "border-brand-200 bg-brand-50/70" : "border-ink-200 opacity-60"
                  }`}
                >
                  <span className={`text-xl ${badge.earned ? "" : "grayscale"}`}>{badge.icon}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{badge.name}</p>
                    <p className="text-xs text-ink-500">{badge.requirement} points required</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Points history" icon={<History className="h-4 w-4" />} />
          {loading && <SkeletonRows rows={4} />}
          {data && data.history.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-500">No points earned yet.</p>
          )}
          {data && data.history.length > 0 && (
            <ul className="space-y-2">
              {data.history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{entry.reason}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(entry.created_at)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
                    +{entry.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data && data.next_level && (
        <Card className="mt-6 border-brand-200 bg-brand-50/60">
          <p className="flex items-center gap-2 text-sm text-brand-900">
            <TrendingUp className="h-4 w-4" />
            Earn {data.next_level.needed - data.xp_into_level} more points to reach{" "}
            <span className="font-semibold">{data.next_level.level}</span>.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
