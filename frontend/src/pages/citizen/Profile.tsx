import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Save, ShieldCheck, User as UserIcon } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import Card, { CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Input, Select } from "../../components/ui/Field";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { ApiError, api } from "../../lib/api";
import { WARDS, WARD_COORDS } from "../../lib/constants";
import { initials } from "../../lib/format";
import type { User } from "../../lib/types";

export default function Profile() {
  const toast = useToast();
  const { user, worker, refresh } = useAuth();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    ward: user?.ward ?? "",
    address: user?.address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      ward: user?.ward ?? "",
      address: user?.address ?? "",
    });
  }, [user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api<{ user: User }>("/auth/me", {
        method: "PATCH",
        body: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          ward: form.ward,
          address: form.address.trim(),
        },
      });
      await refresh();
      toast.success("Profile updated", "Your details have been saved.");
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : "Could not save your profile.";
      setError(message);
      toast.error("Update failed", message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const changePassword = async () => {
    if (pw.next.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    setPwSaving(true);
    setPwError(null);
    try {
      await api<{ message: string }>("/auth/me/password", {
        method: "POST",
        body: { current_password: pw.current, new_password: pw.next },
      });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password updated", "Use your new password the next time you sign in.");
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : "Could not change your password.";
      setPwError(message);
      toast.error("Password change failed", message);
    } finally {
      setPwSaving(false);
    }
  };

  const patch = (key: keyof typeof form, value: string) => setForm((c) => ({ ...c, [key]: value }));

  return (
    <AppShell title="Profile" subtitle="Your account details and preferences">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <div className="flex flex-col items-center text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-2xl font-bold text-white">
              {initials(user.name)}
            </span>
            <h2 className="mt-3 text-lg font-semibold text-ink-900">{user.name}</h2>
            <p className="text-sm text-ink-500">{user.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Badge tone="emerald" size="sm">{user.role}</Badge>
              {user.ward && <Badge tone="slate" size="sm">{user.ward} ward</Badge>}
            </div>
          </div>

          <dl className="mt-5 space-y-2.5 border-t border-ink-100 pt-5 text-sm">
            {[
              { label: "Eco points", value: user.eco_points ?? 0 },
              { label: "Phone", value: user.phone || "Not provided" },
              { label: "Address", value: user.address || "Not provided" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">{row.label}</dt>
                <dd className="text-right font-medium text-ink-900">{row.value}</dd>
              </div>
            ))}
          </dl>

          {worker && (
            <div className="mt-5 rounded-xl bg-blue-50 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                Crew record
              </p>
              <p className="mt-1.5 text-xs text-blue-700">
                {worker.employee_code} · {worker.ward} ward · {worker.zone}
              </p>
              <p className="text-xs text-blue-700">Status: {worker.status}</p>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Edit details" subtitle="Used to route complaints and pickups near you" icon={<UserIcon className="h-4 w-4" />} />
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Full name" required value={form.name} onChange={(e) => patch("name", e.target.value)} />
              <Input label="Phone" value={form.phone} onChange={(e) => patch("phone", e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <Select
              label="Ward"
              value={form.ward}
              onChange={(e) => patch("ward", e.target.value)}
              options={WARDS.map((ward) => ({ value: ward, label: ward }))}
              hint={
                form.ward
                  ? `Approximate centre: ${WARD_COORDS[form.ward]?.lat}, ${WARD_COORDS[form.ward]?.lon}`
                  : "Nearest complaints in this ward will surface first."
              }
            />
            <Input label="Address" value={form.address} onChange={(e) => patch("address", e.target.value)} placeholder="House / street" />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" loading={saving} icon={<Save className="h-4 w-4" />}>
              Save changes
            </Button>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Security" subtitle="Signed in with email and password" icon={<KeyRound className="h-4 w-4" />} />
        <form
          className="max-w-md space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void changePassword();
          }}
        >
          <Input
            label="Current password"
            type="password"
            required
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw((c) => ({ ...c, current: e.target.value }))}
          />
          <Input
            label="New password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            hint="At least 6 characters."
            value={pw.next}
            onChange={(e) => setPw((c) => ({ ...c, next: e.target.value }))}
          />
          <Input
            label="Confirm new password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={pw.confirm}
            onChange={(e) => setPw((c) => ({ ...c, confirm: e.target.value }))}
          />
          {pwError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {pwError}
            </p>
          )}
          <Button type="submit" loading={pwSaving} icon={<KeyRound className="h-4 w-4" />}>
            Change password
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}
