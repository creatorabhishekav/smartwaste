import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Check, Eye, EyeOff, Plus, Save, Sparkles, ThumbsDown } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Input, Select, Textarea } from "../../components/ui/Field";
import Modal from "../../components/ui/Modal";
import { ErrorState, SkeletonRows } from "../../components/ui/States";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import { ApiError, api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../lib/format";
import type { AwarenessItem } from "../../lib/types";

const CATEGORY_OPTIONS = ["Biodegradable", "Recyclable", "Hazardous", "E-waste", "General"];
const HAZARD_OPTIONS = ["LOW", "MEDIUM", "HIGH"];

const BLANK = {
  title: "",
  category: "Recyclable",
  summary: "",
  what_it_is: "",
  which_bin: "",
  how_to_dispose: "",
  hazard_level: "LOW",
  recyclable: true,
  do_list: "",
  dont_list: "",
};

export default function AdminAwareness() {
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApi<AwarenessItem[]>("/awareness");
  const [editing, setEditing] = useState<AwarenessItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        category: editing.category,
        summary: editing.summary,
        what_it_is: editing.what_it_is,
        which_bin: editing.which_bin,
        how_to_dispose: editing.how_to_dispose,
        hazard_level: editing.hazard_level,
        recyclable: editing.recyclable,
        do_list: editing.do_list.join("\n"),
        dont_list: editing.dont_list.join("\n"),
      });
      setFormError(null);
    }
  }, [editing]);

  const open = creating;
  const close = () => {
    setCreating(false);
    setEditing(null);
    setForm(BLANK);
    setFormError(null);
  };

  const patch = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.title.trim() || !form.summary.trim()) {
      setFormError("Title and summary are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      title: form.title.trim(),
      category: form.category,
      summary: form.summary.trim(),
      what_it_is: form.what_it_is.trim(),
      which_bin: form.which_bin.trim(),
      how_to_dispose: form.how_to_dispose.trim(),
      hazard_level: form.hazard_level,
      recyclable: form.recyclable,
      do_list: form.do_list.split("\n").map((line) => line.trim()).filter(Boolean),
      dont_list: form.dont_list.split("\n").map((line) => line.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await api(`/awareness/${editing.id}`, { method: "PATCH", body });
        toast.success("Guideline updated", form.title);
      } else {
        await api("/awareness", { method: "POST", body });
        toast.success("Guideline published", form.title);
      }
      close();
      void refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.detail : "Could not save the guideline.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Awareness content" subtitle="Publish and maintain the citizen segregation guide">
      <Card>
        <CardHeader
          title="Guidelines"
          subtitle={data ? `${data.filter((item) => item.is_published).length} published of ${data.length}` : undefined}
          icon={<BookOpen className="h-4 w-4" />}
          action={
            <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="h-3.5 w-3.5" />}>
              New guideline
            </Button>
          }
        />
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {loading && <SkeletonRows rows={4} />}
        {data && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-ink-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="slate" size="xs">{item.category}</Badge>
                      <Badge
                        tone={item.is_published ? "emerald" : "amber"}
                        size="xs"
                        icon={item.is_published ? <Check className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                      >
                        {item.is_published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-ink-900">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-600">{item.summary}</p>
                    <p className="mt-2 text-[11px] text-ink-400">Updated {formatDate(item.updated_at)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing(item)} icon={<Eye className="h-3.5 w-3.5" />}>
                    Edit
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={open || Boolean(editing)}
        onClose={close}
        title={editing ? `Edit: ${editing.title}` : "New awareness guideline"}
        description="Shown to citizens in the waste awareness page"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void save()} icon={<Save className="h-4 w-4" />}>
              {editing ? "Save changes" : "Publish"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title" required value={form.title} onChange={(event) => patch("title", event.target.value)} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              value={form.category}
              onChange={(event) => patch("category", event.target.value)}
              options={CATEGORY_OPTIONS.map((value) => ({ value, label: value }))}
            />
            <Select
              label="Hazard level"
              value={form.hazard_level}
              onChange={(event) => patch("hazard_level", event.target.value)}
              options={HAZARD_OPTIONS.map((value) => ({ value, label: value }))}
            />
          </div>

          <Textarea label="Summary" required rows={2} value={form.summary} onChange={(event) => patch("summary", event.target.value)} />
          <Textarea label="What it is" rows={2} value={form.what_it_is} onChange={(event) => patch("what_it_is", event.target.value)} />
          <Textarea label="Which bin" rows={2} value={form.which_bin} onChange={(event) => patch("which_bin", event.target.value)} />
          <Textarea
            label="How to dispose"
            rows={3}
            value={form.how_to_dispose}
            onChange={(event) => patch("how_to_dispose", event.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Textarea
              label="Do list (one per line)"
              rows={4}
              value={form.do_list}
              onChange={(event) => patch("do_list", event.target.value)}
              placeholder={"Rinse before recycling\nSeparate by material"}
            />
            <Textarea
              label="Don't list (one per line)"
              rows={4}
              value={form.dont_list}
              onChange={(event) => patch("dont_list", event.target.value)}
              placeholder={"Do not mix with wet waste\nDo not put in drain"}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.recyclable}
              onChange={(event) => patch("recyclable", event.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Marked as recyclable
          </label>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {formError}
            </p>
          )}

          <p className="flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
            <span>
              Published content appears immediately on the citizen awareness page and can be asked about via
              the AI assistant.
            </span>
          </p>

          {!editing && (
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <ThumbsDown className="h-3 w-3" />
              Signed in as {user?.name}
            </p>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
