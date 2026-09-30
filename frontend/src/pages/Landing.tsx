import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Leaf,
  MapPinned,
  Recycle,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import type { Health, Impact } from "../lib/types";
import { formatNumber, formatPercent } from "../lib/format";
import Button from "../components/ui/Button";

const PIPELINE = [
  { label: "Citizen Report", icon: ClipboardCheck, detail: "Photo, location and issue in 60 seconds" },
  { label: "AI Analysis", icon: Brain, detail: "Waste type, severity and objects detected" },
  { label: "Smart Priority", icon: Sparkles, detail: "Explainable 40/20/20/20 scoring" },
  { label: "Worker Assignment", icon: Truck, detail: "Nearest available crew with ETA" },
  { label: "Verified Resolution", icon: ShieldCheck, detail: "Before/after proof and admin sign-off" },
];

const FEATURES = [
  {
    icon: Brain,
    title: "AI Waste Analysis",
    body: "Every upload is classified into waste type, severity and detected objects - with a recommended action for the crew.",
    accent: "from-violet-500 to-indigo-600",
  },
  {
    icon: Sparkles,
    title: "Smart Priority",
    body: "Severity, ageing, cluster pressure and location sensitivity produce a score every admin can audit.",
    accent: "from-amber-500 to-orange-600",
  },
  {
    icon: MapPinned,
    title: "Waste Hotspots",
    body: "250 m clustering reveals repeated dumping pockets and the streets that need a rapid-response team.",
    accent: "from-red-500 to-rose-600",
  },
  {
    icon: Truck,
    title: "Pickup Management",
    body: "Bulk and household waste pickups with scheduled windows, crew assignment and completion tracking.",
    accent: "from-blue-500 to-indigo-600",
  },
  {
    icon: ClipboardCheck,
    title: "Complaint Tracking",
    body: "Citizens see the full lifecycle from submission to crew arrival to verified closure, in real time.",
    accent: "from-cyan-500 to-sky-600",
  },
  {
    icon: ShieldCheck,
    title: "Verified Resolution",
    body: "Workers upload before and after photos. The system scores cleanliness improvement before an admin closes the case.",
    accent: "from-brand-500 to-emerald-600",
  },
];

export default function Landing() {
  // Public endpoints only - the landing page must render without a session.
  const { data: impact, loading: impactLoading, error: impactError } =
    useApi<Impact>("/analytics/impact");
  const { data: health } = useApi<Health>("/health");

  const stats: Impact | null = impact ?? null;
  const dbOnline = health?.database === "ok";

  return (
    <div className="min-h-full bg-white">
      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Leaf className="h-4.5 w-4.5" />
            </span>
            <span className="text-base font-semibold tracking-tight text-ink-900">SmartWaste 360</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-600 md:flex">
            <a href="#how" className="transition hover:text-ink-900">How it works</a>
            <a href="#features" className="transition hover:text-ink-900">Features</a>
            <a href="#impact" className="transition hover:text-ink-900">Impact</a>
            <Link to="/awareness" className="transition hover:text-ink-900">Awareness</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Create account</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,rgba(16,185,129,0.14),transparent_60%),radial-gradient(50%_40%_at_10%_10%,rgba(15,23,42,0.06),transparent_60%)]"
        />
        <div className="relative mx-auto grid grid-cols-1 max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
              </span>
              {stats ? `Live in ${stats.wards_covered} Kanpur wards` : "Live across Kanpur wards"}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl"
            >
              Smarter Waste Management.
              <span className="block bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent">
                Cleaner Communities.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 max-w-lg text-lg text-ink-600"
            >
              Report. Analyze. Prioritize. Resolve. — one AI-assisted pipeline that turns a citizen
              photo into a ranked, assigned and verified clean-up.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link to="/register">
                <Button size="lg" icon={<Sparkles className="h-4 w-4" />}>Report Waste</Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" icon={<ChevronRight className="h-4 w-4" />}>
                  Explore Platform
                </Button>
              </a>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-10 grid grid-cols-1 max-w-lg grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4"
            >
              {[
                { label: "Reports resolved", value: stats ? formatNumber(stats.reports_resolved) : null },
                { label: "Resolution rate", value: stats ? formatPercent(stats.resolution_rate) : null },
                { label: "Active crews", value: stats ? formatNumber(stats.active_crews) : null },
                { label: "Evidence photos", value: stats ? formatNumber(stats.evidence_photos) : null },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-500">{stat.label}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink-900">
                    {stat.value ?? <span className="text-ink-300">—</span>}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* Hero visual: pipeline preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative"
          >
            <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-xl shadow-ink-900/5">
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <div>
                  <p className="text-xs font-medium text-ink-500">Active report</p>
                  <p className="font-mono text-sm font-semibold text-ink-900">SW-2026-0004</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                  CRITICAL · 80
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {[
                  { label: "Severity", value: 72, weight: "40%" },
                  { label: "Age", value: 92, weight: "20%" },
                  { label: "Cluster pressure", value: 82, weight: "20%" },
                  { label: "Location sensitivity", value: 83, weight: "20%" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-600">
                        {row.label} <span className="text-ink-400">({row.weight})</span>
                      </span>
                      <span className="tabular-nums text-ink-700">{row.value}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${row.value}%` }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-ink-50 p-3">
                <p className="text-[11px] font-semibold text-ink-700">Why this score</p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-ink-600">
                  <li>• 4 open reports within 350 m at Civil Hospital crossing</li>
                  <li>• Open for 66 hours without collection</li>
                  <li>• Hospital frontage raises public-health sensitivity</li>
                </ul>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-brand-600" />
                <p className="text-[11px] text-brand-800">
                  Resolved with before/after proof · cleanliness 34 → 78
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------- how it works */}
      <section id="how" className="border-t border-ink-100 bg-ink-50/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-700">
              How it works
            </span>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
              From a photo to a verified clean-up
            </h2>
            <p className="mt-3 text-ink-600">
              Every stage is measurable, explainable and visible to the resident who reported it.
            </p>
          </div>

          <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-3">
            {PIPELINE.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <motion.li
                  key={stage.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: index * 0.08 }}
                  className="relative"
                >
                  <div className="flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink-900">{stage.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{stage.detail}</p>
                    <span className="mt-3 font-mono text-[10px] uppercase tracking-wide text-ink-400">
                      Step {index + 1}
                    </span>
                  </div>
                  {index < PIPELINE.length - 1 && (
                    <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-ink-300 md:block" />
                  )}
                </motion.li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-700">
              Platform capabilities
            </span>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
              Built for residents, crews and the command centre
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: index * 0.06 }}
                  className="group rounded-2xl border border-ink-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-lg hover:shadow-ink-900/5"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-sm`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-ink-900">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{feature.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-700 opacity-0 transition group-hover:opacity-100">
                    Learn more <ChevronRight className="h-3 w-3" />
                  </span>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ impact */}
      <section id="impact" className="border-t border-ink-100 bg-ink-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-400">
                Community impact
              </span>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Cleanliness you can measure
              </h2>
              <p className="mt-3 max-w-lg text-ink-300">
                Every number on this page is computed live from resolved reports, photo evidence and
                crew performance — not a static marketing figure.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button size="lg">Open the command centre</Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" variant="outline" className="border-ink-600 text-white hover:bg-ink-800">
                    I want to report waste
                  </Button>
                </Link>
              </div>
            </div>

            {stats ? (
              <dl className="grid grid-cols-2 gap-4">
                {[
                  { label: "Citizens registered", value: formatNumber(stats.citizens_registered), icon: Users },
                  { label: "Reports resolved", value: formatNumber(stats.reports_resolved), icon: CheckCircle2 },
                  { label: "Evidence photos", value: formatNumber(stats.evidence_photos), icon: ShieldCheck },
                  { label: "Hotspots mapped", value: formatNumber(stats.hotspots_mapped), icon: MapPinned },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border border-ink-700/60 bg-ink-800/60 p-5">
                      <Icon className="h-5 w-5 text-brand-400" />
                      <dd className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</dd>
                      <dt className="mt-0.5 text-xs text-ink-400">{item.label}</dt>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <div className="rounded-2xl border border-ink-700/60 bg-ink-800/60 p-6" role="status">
                <p className="text-sm font-semibold text-white">
                  {impactLoading ? "Loading live impact figures..." : "Live figures unavailable"}
                </p>
                <p className="mt-1.5 text-xs text-ink-400">
                  {impactError
                    ? `The impact service could not be reached (${impactError}). Figures are only shown when they can be read from the database.`
                    : "Figures are only shown when they can be read from the database."}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="bg-gradient-to-br from-brand-600 to-brand-800 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Recycle className="mx-auto h-10 w-10" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Ready to make your street visible?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-50">
            Create a citizen account and report waste in under a minute. City staff sign in to the same
            platform with their own role.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50">
                Create citizen account
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                Staff sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-ink-500 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-brand-600" />
            <span className="font-medium text-ink-700">SmartWaste 360</span>
            <span>· Kanpur Smart City pilot</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-ink-900">Sign in</Link>
            <Link to="/awareness" className="hover:text-ink-900">Waste awareness</Link>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                dbOnline ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dbOnline ? "bg-brand-500" : "bg-amber-500"}`} />
              API {dbOnline ? "online" : "degraded"}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
