import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Check, Info, Leaf, Recycle, Search, Sparkles, ThumbsDown, TriangleAlert } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/ui/States";
import { useApi } from "../../hooks/useApi";
import type { AwarenessItem } from "../../lib/types";

const CATEGORIES = [
  { value: "", label: "All topics" },
  { value: "Biodegradable", label: "Biodegradable" },
  { value: "Recyclable", label: "Recyclable" },
  { value: "Hazardous", label: "Hazardous" },
  { value: "E-waste", label: "E-waste" },
  { value: "General", label: "General" },
];

const HAZARD_TONE: Record<string, "red" | "amber" | "emerald"> = {
  HIGH: "red",
  MEDIUM: "amber",
  LOW: "emerald",
};

export default function Awareness() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApi<AwarenessItem[]>("/awareness", {
    query: { ...(category ? { category } : {}) },
  });

  const items = useMemo(() => {
    const list = data ?? [];
    if (!search.trim()) return list;
    const needle = search.trim().toLowerCase();
    return list.filter((item) =>
      [item.title, item.summary, item.what_it_is, item.which_bin].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [data, search]);

  return (
    <AppShell title="Waste awareness" subtitle="What goes in which bin, and why it matters">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Segregation guide"
            subtitle={`${items.length} published guideline${items.length === 1 ? "" : "s"}`}
            icon={<BookOpen className="h-4 w-4" />}
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCategory(option.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  category === option.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                }`}
              >
                {option.label}
              </button>
            ))}
            <div className="relative ml-auto w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search waste types"
                className="py-1.5 pl-9 text-xs"
              />
            </div>
          </div>
        </Card>

        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {loading && (
          <Card>
            <SkeletonRows rows={4} />
          </Card>
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title="No guidelines found"
            description="Try another category or clear the search box."
            icon={<BookOpen className="h-5 w-5" />}
          />
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => {
            const expanded = openSlug === item.slug;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <Card className="h-full">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${item.accent}1a`, color: item.accent }}
                    >
                      <Leaf className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="slate" size="xs">
                          {item.category}
                        </Badge>
                        <Badge tone={HAZARD_TONE[item.hazard_level] ?? "slate"} size="xs">
                          {item.hazard_level} hazard
                        </Badge>
                        {item.recyclable && (
                          <Badge tone="emerald" size="xs" icon={<Check className="h-2.5 w-2.5" />}>
                            Recyclable
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-ink-900">{item.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-ink-600">{item.summary}</p>
                    </div>
                  </div>

                  <dl className="mt-3 space-y-2 rounded-lg bg-ink-50 p-3 text-xs">
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium text-ink-700">What it is</dt>
                      <dd className="text-ink-600">{item.what_it_is}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium text-ink-700">Which bin</dt>
                      <dd className="text-ink-600">{item.which_bin}</dd>
                    </div>
                  </dl>

                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 space-y-3 overflow-hidden text-xs"
                    >
                      <div>
                        <p className="mb-1.5 flex items-center gap-1.5 font-medium text-ink-900">
                          <Sparkles className="h-3 w-3 text-brand-600" />
                          How to dispose
                        </p>
                        <p className="text-ink-600">{item.how_to_dispose}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-brand-200 bg-brand-50/70 p-2.5">
                          <p className="mb-1 flex items-center gap-1 font-semibold text-brand-800">
                            <Check className="h-3 w-3" />
                            Do
                          </p>
                          <ul className="space-y-0.5 text-ink-600">
                            {item.do_list.map((line) => (
                              <li key={line}>· {line}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-red-200 bg-red-50/70 p-2.5">
                          <p className="mb-1 flex items-center gap-1 font-semibold text-red-800">
                            <ThumbsDown className="h-3 w-3" />
                            Don&apos;t
                          </p>
                          <ul className="space-y-0.5 text-ink-600">
                            {item.dont_list.map((line) => (
                              <li key={line}>· {line}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenSlug(expanded ? null : item.slug)}
                      icon={expanded ? <Info className="h-3.5 w-3.5" /> : undefined}
                    >
                      {expanded ? "Hide details" : "How to dispose"}
                    </Button>
                    {item.hazard_level === "HIGH" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                        <TriangleAlert className="h-3 w-3" />
                        Handle with gloves
                      </span>
                    )}
                    {item.hazard_level === "LOW" && item.recyclable && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600">
                        <Recycle className="h-3 w-3" />
                        Route to recycling
                      </span>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {items.some((item) => item.hazard_level === "HIGH") && (
          <Card className="border-red-200 bg-red-50/60">
            <p className="flex items-start gap-2 text-sm text-red-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Hazardous items such as batteries, medicines and chemical containers must never go into the
              general wet waste bin. Use the municipal collection point listed in the municipality notice.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
