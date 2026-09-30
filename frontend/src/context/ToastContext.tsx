import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type ToastTone = "success" | "error" | "info";

type Toast = { id: number; tone: ToastTone; title: string; description?: string };

type ToastContextValue = {
  push: (tone: ToastTone, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { ring: string; icon: typeof Info; iconClass: string }> = {
  success: { ring: "border-brand-200 bg-white", icon: CheckCircle2, iconClass: "text-brand-600" },
  error: { ring: "border-red-200 bg-white", icon: AlertTriangle, iconClass: "text-red-600" },
  info: { ring: "border-blue-200 bg-white", icon: Info, iconClass: "text-blue-600" },
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      counter += 1;
      const id = counter;
      setToasts((current) => [...current, { id, tone, title, description }]);
      window.setTimeout(() => remove(id), tone === "error" ? 8000 : 4500);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
      info: (title, description) => push("info", title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = TONE_STYLES[toast.tone];
            const Icon = style.icon;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                role="status"
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg shadow-ink-900/5 ${style.ring}`}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{toast.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(toast.id)}
                  className="rounded p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
