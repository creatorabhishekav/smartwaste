import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  Leaf,
  LogOut,
  Menu,
  PanelLeftClose,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useApi } from "../../hooks/useApi";
import {
  ADMIN_NAV,
  CITIZEN_NAV,
  PUBLIC_NAV,
  WORKER_NAV,
} from "../../lib/constants";
import { formatNumber, initials } from "../../lib/format";
import type { Role } from "../../lib/types";
import NotificationList from "../domain/NotificationList";
import Button from "../ui/Button";

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV_BY_ROLE: Record<Role, readonly NavItem[]> = {
  CITIZEN: CITIZEN_NAV,
  WORKER: WORKER_NAV,
  ADMIN: ADMIN_NAV,
};

const ROLE_META: Record<Role, { label: string; subtitle: string; icon: LucideIcon; accent: string }> = {
  CITIZEN: {
    label: "Citizen",
    subtitle: "Resident",
    icon: Leaf,
    accent: "from-brand-500 to-brand-700",
  },
  WORKER: { label: "Worker", subtitle: "Field crew", icon: Truck, accent: "from-blue-500 to-blue-700" },
  ADMIN: {
    label: "Administrator",
    subtitle: "Command centre",
    icon: ShieldCheck,
    accent: "from-ink-800 to-ink-900",
  },
};

type Props = {
  children: ReactNode;
  /** Extra actions rendered in the top bar (page specific). */
  headerAction?: ReactNode;
  title: string;
  subtitle?: string;
};

export default function AppShell({ children, headerAction, title, subtitle }: Props) {
  const { user, worker, logout, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const isSignedIn = status === "authenticated" && Boolean(user);
  const role = (user?.role ?? "CITIZEN") as Role;
  const nav = isSignedIn ? NAV_BY_ROLE[role] : PUBLIC_NAV;
  const roleMeta = ROLE_META[role];

  // Only signed-in citizens and admins receive notifications; workers use task status instead.
  const { data: notifications, refetch: refetchNotifications } = useApi<{ unread: number }>(
    !isSignedIn || role === "WORKER" ? null : "/notifications",
    { query: { page_size: 50 } },
  );
  const unread = notifications?.unread ?? 0;

  const handleLogout = () => {
    logout();
    toast.info("Signed out", "Your session has been cleared from this device.");
    navigate("/login");
  };

  const isActive = (to: string) =>
    to === location.pathname || (to !== "/" && location.pathname.startsWith(`${to}/`));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
          <Leaf className="h-5 w-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-ink-900">SmartWaste 360</p>
            <p className="truncate text-[11px] text-ink-500">{roleMeta.subtitle}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100"
                  : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-600" : "text-ink-400"}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-ink-100 p-3">
          <div className="rounded-xl bg-gradient-to-br from-ink-900 to-ink-800 p-4 text-white">
            <p className="text-xs font-medium text-brand-300">Smart City Kanpur</p>
            <p className="mt-1 text-sm font-semibold">Live waste intelligence</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
              Reports are analysed by AI, ranked by an explainable priority model and closed with
              photo proof.
            </p>
            <Link
              to="/"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-white underline-offset-2 hover:underline"
            >
              About the platform
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-full bg-ink-50">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-ink-200 bg-white transition-all duration-200 lg:block ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebar}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-6 hidden h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-sm transition hover:text-ink-900 lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeftClose className={`h-3.5 w-3.5 ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink-900/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-ink-200 bg-white lg:hidden"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-5 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className={`transition-all duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight text-ink-900 sm:text-lg">
                {title}
              </h1>
              {subtitle && <p className="truncate text-xs text-ink-500">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-2">
              {headerAction}

              {role !== "WORKER" && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setBellOpen((value) => !value)}
                    className="relative rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
                    aria-label={`Notifications (${unread} unread)`}
                  >
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                      <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {bellOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.98 }}
                          transition={{ duration: 0.16 }}
                          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl sm:w-96"
                        >
                          <NotificationList
                            compact
                            onChanged={() => void refetchNotifications()}
                            onNavigate={() => setBellOpen(false)}
                          />
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {isSignedIn ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((value) => !value)}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-ink-100"
                  >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white">
                    {initials(user?.name)}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-32 truncate text-xs font-medium text-ink-800">
                      {user?.name ?? "Account"}
                    </span>
                    <span className="block text-[10px] text-ink-500">
                      {worker?.employee_code ?? roleMeta.label}
                    </span>
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-ink-400 sm:block" />
                </button>
<AnimatePresence>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl"
                        >
                          <div className="border-b border-ink-100 p-3.5">
                            <p className="truncate text-sm font-medium text-ink-900">{user?.name}</p>
                            <p className="truncate text-xs text-ink-500">{user?.email}</p>
                            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                              <UserCheck className="h-3 w-3" />
                              {roleMeta.label}
                            </span>
                          </div>
                          <Link
                            to={
                              role === "WORKER"
                                ? "/worker/profile"
                                : role === "ADMIN"
                                  ? "/admin/settings"
                                  : "/app/profile"
                            }
                            onClick={() => setMenuOpen(false)}
                            className="block px-3.5 py-2.5 text-sm text-ink-700 transition hover:bg-ink-50"
                          >
                            Profile settings
                          </Link>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-100"
                  >
                    Sign in
                  </Link>
                  <Link to="/register">
                    <Button size="sm">Get started</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Compact page heading used inside dashboards. */
export function PageIntro({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Global search input style used by admin list pages. */
export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}

export { formatNumber };
