import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Leaf, ShieldAlert } from "lucide-react";
import { homeFor, useAuth } from "../context/AuthContext";
import type { Role } from "../lib/types";
import Button from "../components/ui/Button";
import { Spinner } from "../components/ui/States";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
          <Leaf className="h-6 w-6" />
        </span>
        <Spinner className="h-5 w-5" />
        <p className="text-sm text-ink-500">Loading SmartWaste 360...</p>
      </div>
    </div>
  );
}

/** Blocks unauthenticated access and bounces the user to the right role home. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageLoader />;
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Restricts a route tree to one or more roles. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageLoader />;
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!user || !roles.includes(user.role)) {
    return <WrongRole actual={user?.role} target={roles} />;
  }
  return <>{children}</>;
}

function WrongRole({ actual, target }: { actual?: Role; target: Role[] }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-ink-900">This area needs a different role</h2>
        <p className="mt-1 max-w-md text-sm text-ink-500">
          You are signed in as <span className="font-medium text-ink-700">{actual ?? "unknown"}</span>.
          This page is limited to {target.join(" / ")} accounts.
        </p>
      </div>
      <Button onClick={() => window.location.assign(homeFor(actual))}>Go to my dashboard</Button>
    </div>
  );
}

/** Signed-in users skip the marketing and auth pages. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === "loading") return <FullPageLoader />;
  if (status === "authenticated" && user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
