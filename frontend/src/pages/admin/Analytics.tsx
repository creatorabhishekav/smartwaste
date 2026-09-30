import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Clock, Flame, MapPinned, Truck, TrendingUp, Users } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { useApi } from "../../hooks/useApi";
import { CATEGORY_META, PRIORITY_META } from "../../lib/constants";
import { formatDuration, formatNumber, formatPercent } from "../../lib/format";
import type { Analytics, ComplaintCategory } from "../../lib/types";

const PIE_COLORS = ["#059669", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b", "#14b8a6", "#ec4899"];
const AXIS = { fontSize: 11, fill: "#64748b" };

export default function Analytics() {
  const [days, setDays] = useState(14);
  const { data, loading, error, refetch } = useApi<Analytics>("/analytics", { query: { days } });

  return (
    <AppShell title="Analytics" subtitle="Trends, distributions, response times and crew performance">
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Reporting window</h2>
            <p className="mt-0.5 text-xs text-ink-500">Trend charts reflect the selected period</p>
          </div>
          <div className="flex rounded-lg bg-ink-100 p-0.5">
            {[7, 14, 30].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
                  days === option ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {option} days
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />
            ))}
          </div>
          <Card>
            <SkeletonRows rows={6} />
          </Card>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total reports" value={formatNumber(data.overview.total_complaints)} icon={BarChart3} hint={`${data.overview.pending_complaints} open`} />
            <StatCard label="Resolution rate" value={formatPercent(data.overview.resolution_rate)} icon={TrendingUp} tone="emerald" />
            <StatCard label="Avg response" value={formatDuration(data.overview.avg_response_minutes)} icon={Clock} tone="cyan" />
            <StatCard label="Active crews" value={`${data.overview.active_workers}/${data.overview.total_workers}`} icon={Truck} tone="blue" />
          </div>

          {/* trend */}
          <Card className="mt-6">
            <CardHeader title="Reported vs resolved" subtitle={`Last ${days} days`} icon={<TrendingUp className="h-4 w-4" />} />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={AXIS} tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis tick={AXIS} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="reported" name="Reported" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* category */}
            <Card>
              <CardHeader title="Reports by category" subtitle="Share of all complaints" icon={<BarChart3 className="h-4 w-4" />} />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.category_distribution}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.category_distribution.map((entry, index) => (
                        <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* priority */}
            <Card>
              <CardHeader title="Priority distribution" subtitle="How the queue is weighted" icon={<Flame className="h-4 w-4" />} />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.priority_distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="level" tick={AXIS} />
                    <YAxis tick={AXIS} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {data.priority_distribution.map((entry) => (
                        <Cell
                          key={entry.level}
                          fill={
                            entry.level === "CRITICAL"
                              ? "#dc2626"
                              : entry.level === "HIGH"
                                ? "#f59e0b"
                                : entry.level === "MEDIUM"
                                  ? "#0ea5e9"
                                  : "#64748b"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* wards + response */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Ward comparison" subtitle="Volume, criticals and resolution" icon={<MapPinned className="h-4 w-4" />} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wide text-ink-500">
                      <th className="pb-2 font-semibold">Ward</th>
                      <th className="pb-2 text-right font-semibold">Total</th>
                      <th className="pb-2 text-right font-semibold">Critical</th>
                      <th className="pb-2 text-right font-semibold">Open</th>
                      <th className="pb-2 text-right font-semibold">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ward_comparison.map((row) => (
                      <tr key={row.ward} className="border-b border-ink-100 last:border-0">
                        <td className="py-2 font-medium text-ink-900">{row.ward}</td>
                        <td className="py-2 text-right tabular-nums text-ink-700">{row.total}</td>
                        <td className="py-2 text-right tabular-nums">
                          <span className={row.critical > 0 ? "font-semibold text-red-600" : "text-ink-400"}>
                            {row.critical}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-700">{row.pending}</td>
                        <td className="py-2 text-right tabular-nums text-brand-700">
                          {formatPercent(row.resolution_rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader title="Response time" subtitle="Average minutes per day" icon={<Clock className="h-4 w-4" />} />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.response_times}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={AXIS} tickFormatter={(value: string) => value.slice(5)} />
                    <YAxis tick={AXIS} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg_response_minutes" name="Avg minutes" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* hotspots + workers */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Hotspot ranking" subtitle="By open complaint count" icon={<MapPinned className="h-4 w-4" />} />
              {data.hotspots.length === 0 ? (
                <EmptyState title="No hotspots" description="Clusters appear with complaint density." icon={<MapPinned className="h-5 w-5" />} />
              ) : (
                <ul className="space-y-2.5">
                  {data.hotspots.map((hotspot) => (
                    <li key={hotspot.code}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-ink-800">{hotspot.label}</span>
                        <span className="shrink-0 tabular-nums text-ink-600">
                          {hotspot.open_count} open · {hotspot.complaint_count} total
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, hotspot.intensity)}%` }}
                          className={`h-full rounded-full ${hotspot.critical_count >= 3 ? "bg-red-500" : "bg-brand-500"}`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Crew performance" subtitle="Completion and proof quality" icon={<Users className="h-4 w-4" />} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wide text-ink-500">
                      <th className="pb-2 font-semibold">Crew</th>
                      <th className="pb-2 text-right font-semibold">Done</th>
                      <th className="pb-2 text-right font-semibold">Rate</th>
                      <th className="pb-2 text-right font-semibold">Avg time</th>
                      <th className="pb-2 text-right font-semibold">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.worker_performance.map((worker) => (
                      <tr key={worker.worker_id} className="border-b border-ink-100 last:border-0">
                        <td className="py-2">
                          <p className="font-medium text-ink-900">{worker.name}</p>
                          <p className="text-[11px] text-ink-500">
                            {worker.employee_code} · {worker.ward}
                          </p>
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-700">
                          {worker.completed}/{worker.assigned}
                        </td>
                        <td className="py-2 text-right tabular-nums text-brand-700">
                          {formatPercent(worker.completion_rate, 0)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-600">
                          {formatDuration(worker.avg_resolution_minutes)}
                        </td>
                        <td className="py-2 text-right tabular-nums font-semibold text-ink-900">
                          {worker.rating}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* pickups + category detail */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Pickup analytics" subtitle="Doorstep collection volume" icon={<Truck className="h-4 w-4" />} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Requests", value: data.pickups.total },
                  { label: "Completed", value: data.pickups.completed },
                  { label: "Pending", value: data.pickups.pending },
                  { label: "Avg hours", value: data.pickups.avg_completion_hours },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-ink-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">{stat.label}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-ink-900">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pickups.by_waste_type}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="waste_type" tick={AXIS} />
                    <YAxis tick={AXIS} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Category breakdown" subtitle="Counts, shares and guidance" icon={<BarChart3 className="h-4 w-4" />} />
              <ul className="space-y-3">
                {data.category_distribution.map((entry) => (
                  <li key={entry.category}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-800">
                        {CATEGORY_META[entry.category as ComplaintCategory]?.label ?? entry.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-500">
                        {entry.count} · {formatPercent(entry.share, 0)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, entry.share)}%` }}
                        className="h-full rounded-full bg-brand-500"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-400">
                      {PRIORITY_META[(entry as { priority?: "LOW" }).priority ?? "LOW"]?.hint}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
