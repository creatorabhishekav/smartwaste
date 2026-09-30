import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

const FIELD_BASE =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50 disabled:text-ink-400";

function Wrapper({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  icon?: ReactNode;
};

export function Input({ label, hint, error, icon, className = "", id, ...rest }: InputProps) {
  return (
    <Wrapper label={label} hint={hint} error={error} required={rest.required} htmlFor={id}>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`${FIELD_BASE} ${icon ? "pl-9" : ""} ${error ? "border-red-300" : ""} ${className}`}
          {...rest}
        />
      </div>
    </Wrapper>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  options: { value: string; label: string }[];
};

export function Select({ label, hint, error, options, className = "", id, ...rest }: SelectProps) {
  return (
    <Wrapper label={label} hint={hint} error={error} required={rest.required} htmlFor={id}>
      <select
        id={id}
        className={`${FIELD_BASE} ${error ? "border-red-300" : ""} ${className}`}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function Textarea({ label, hint, error, className = "", id, ...rest }: TextareaProps) {
  return (
    <Wrapper label={label} hint={hint} error={error} required={rest.required} htmlFor={id}>
      <textarea
        id={id}
        className={`${FIELD_BASE} min-h-24 resize-y ${error ? "border-red-300" : ""} ${className}`}
        {...rest}
      />
    </Wrapper>
  );
}
