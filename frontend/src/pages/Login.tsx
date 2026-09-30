import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Leaf, Mail, ShieldCheck, Truck, UserCheck } from "lucide-react";
import { useAuth, homeFor } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../lib/api";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import type { Role } from "../lib/types";

const DEMO_ACCOUNTS: { role: Role; email: string; icon: typeof UserCheck; blurb: string }[] = [
  {
    role: "CITIZEN",
    email: "citizen@demo.com",
    icon: UserCheck,
    blurb: "Report waste, track crews, earn eco points",
  },
  {
    role: "WORKER",
    email: "worker@demo.com",
    icon: Truck,
    blurb: "Task queue, status updates, photo proof",
  },
  {
    role: "ADMIN",
    email: "admin@demo.com",
    icon: ShieldCheck,
    blurb: "Priority queue, assignments, analytics",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { login, demoLogin, status, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from;

  if (status === "authenticated" && user) {
    return <Navigate to={from ?? homeFor(user.role)} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const session = await login(email.trim(), password);
      toast.success("Welcome back", "You are signed in to SmartWaste 360.");
      navigate(from ?? homeFor(session.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sign in failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const useDemo = async (role: Role) => {
    setError(null);
    setDemoPending(role);
    try {
      await demoLogin(role);
      toast.success("Demo session started", `Signed in as ${role.toLowerCase()}.`);
      navigate(homeFor(role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Demo sign in failed.");
    } finally {
      setDemoPending(null);
    }
  };

  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(56,189,248,0.25), transparent 45%)",
          }}
        />
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">SmartWaste 360</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            One platform for residents, crews and city administrators.
          </h2>
          <p className="mt-4 text-ink-300">
            Reports are analysed by AI, ranked by an explainable priority model, assigned to the nearest
            available crew and closed only with before/after photo proof.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-ink-200">
            {[
              "AI waste classification with severity scoring",
              "Explainable priority: severity, age, cluster, location",
              "Hotspot clustering to find repeat dumping pockets",
              "Verified resolution with photo evidence",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ink-400">Kanpur Smart City · AI-assisted waste management</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-ink-50 px-4 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Leaf className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight text-ink-900">SmartWaste 360</span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Use your account, or jump straight in with a demo role.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-800">
                  {error.includes("connect") ? "Unable to connect to SmartWaste API" : "Sign in failed"}
                </p>
                <p className="mt-0.5 break-words text-xs text-red-700">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Input
              id="email"
              label="Email address"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              icon={<Mail className="h-4 w-4" />}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
            <Button type="submit" block size="lg" loading={pending} icon={<ArrowRight className="h-4 w-4" />}>
              Sign in
            </Button>
          </form>

          <div className="my-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-200" />
            <span className="text-xs uppercase tracking-wide text-ink-400">or demo access</span>
            <span className="h-px flex-1 bg-ink-200" />
          </div>

          <div className="space-y-2.5">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = account.icon;
              return (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => void useDemo(account.role)}
                  disabled={demoPending !== null}
                  className="flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white p-3.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-900">
                      {account.role === "CITIZEN"
                        ? "Citizen"
                        : account.role === "WORKER"
                          ? "Sanitation worker"
                          : "Administrator"}
                    </span>
                    <span className="block truncate text-xs text-ink-500">{account.blurb}</span>
                  </span>
                  {demoPending === account.role ? (
                    <span className="text-xs text-brand-700">Signing in…</span>
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" />
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-7 text-center text-sm text-ink-500">
            New to SmartWaste?{" "}
            <Link to="/register" className="font-medium text-brand-700 hover:underline">
              Create a citizen account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
