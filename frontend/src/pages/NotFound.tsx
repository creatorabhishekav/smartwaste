import { Link } from "react-router-dom";
import { Compass, Home, Leaf } from "lucide-react";
import Button from "../components/ui/Button";
import { homeFor, useAuth } from "../context/AuthContext";

export default function NotFound() {
  const { status, user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-50 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
        <Leaf className="h-8 w-8" />
      </span>
      <div>
        <p className="font-mono text-4xl font-bold text-ink-300">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-900">This page does not exist</h1>
        <p className="mt-1.5 max-w-sm text-sm text-ink-500">
          The link may be out of date. Head back to your dashboard to continue working.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to={status === "authenticated" ? homeFor(user?.role) : "/"}>
          <Button icon={<Home className="h-4 w-4" />}>Back to dashboard</Button>
        </Link>
        <Link to="/">
          <Button variant="outline" icon={<Compass className="h-4 w-4" />}>
            Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
