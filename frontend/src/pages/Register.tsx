import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Leaf, Lock, Mail, Phone, User } from "lucide-react";
import { useAuth, homeFor } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../lib/api";
import Button from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { WARDS } from "../lib/constants";

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const { register, status, user } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    ward: WARDS[0],
    address: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated" && user) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  const patch = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.ward ? { ward: form.ward } : {}),
        ...(form.address.trim() ? { address: form.address.trim() } : {}),
      });
      toast.success("Account created", "Welcome to SmartWaste 360 — start with your first report.");
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Registration failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center bg-ink-50 px-4 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="mb-8 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Leaf className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight text-ink-900">SmartWaste 360</span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Create your account</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Residents report waste, track crews and earn eco points for verified action.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="min-w-0 text-xs text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Input
              id="name"
              label="Full name"
              required
              minLength={2}
              value={form.name}
              onChange={(event) => patch("name", event.target.value)}
              placeholder="e.g. Aarav Sharma"
              icon={<User className="h-4 w-4" />}
            />
            <Input
              id="email"
              label="Email address"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => patch("email", event.target.value)}
              placeholder="you@example.com"
              icon={<Mail className="h-4 w-4" />}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => patch("password", event.target.value)}
              placeholder="At least 6 characters"
              icon={<Lock className="h-4 w-4" />}
              hint="Use 6 or more characters."
            />
            <Input
              id="phone"
              label="Phone (optional)"
              type="tel"
              value={form.phone}
              onChange={(event) => patch("phone", event.target.value)}
              placeholder="+91 98765 43210"
              icon={<Phone className="h-4 w-4" />}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                id="ward"
                label="Ward"
                value={form.ward}
                onChange={(event) => patch("ward", event.target.value)}
                options={WARDS.map((ward) => ({ value: ward, label: ward }))}
              />
              <Input
                id="address"
                label="Address (optional)"
                value={form.address}
                onChange={(event) => patch("address", event.target.value)}
                placeholder="Street or landmark"
              />
            </div>

            <Button type="submit" block size="lg" loading={pending} icon={<ArrowRight className="h-4 w-4" />}>
              Create account
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-ink-500">
            Already registered?{" "}
            <Link to="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      <div className="relative hidden flex-col justify-center bg-gradient-to-br from-brand-700 to-brand-900 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.28), transparent 45%)",
          }}
        />
        <div className="relative max-w-sm">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Your report becomes a tracked, verified clean-up.
          </h2>
          <ol className="mt-8 space-y-4">
            {[
              "Snap a photo of overflowing bins or dumped waste",
              "Pin the exact location and describe the issue",
              "AI scores severity and predicts the priority",
              "Watch the crew arrive and the proof arrive too",
              "Earn eco points when your report is verified",
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="text-sm text-brand-50">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
