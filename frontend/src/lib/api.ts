/**
 * Typed HTTP client for the SmartWaste 360 FastAPI backend.
 *
 * Base URL resolution:
 *   1. VITE_API_URL when set (explicit, always wins)
 *   2. same-origin "/api" - used by the Vite dev proxy and reverse proxies
 *
 * Every failure is normalised into ApiError so the UI can show one clear message
 * instead of a generic "Cannot connect to API: other side closed".
 */

export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL ?? ""
).replace(/\/+$/, "");

export type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Send a JSON body (default) or a FormData body for multipart uploads. */
  form?: FormData;
  auth?: boolean;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined | null>;
};

export class ApiError extends Error {
  status: number;
  detail: string;
  payload: unknown;

  constructor(message: string, status: number, detail: string, payload: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.payload = payload;
  }

  /** True when the request never reached the API process. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export const TOKEN_KEY = "smartwaste360.token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing - session-only auth */
  }
}

function buildUrl(path: string, query?: ApiOptions["query"]): string {
  const base = API_BASE_URL || "/api";
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Turns a FastAPI `detail` payload into one readable sentence. */
function extractDetail(payload: unknown, fallback: string): string {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined;
      if (first?.msg) {
        const field = Array.isArray(first.loc) ? String(first.loc.at(-1)) : "input";
        return `${field}: ${first.msg}`;
      }
    }
  }
  return fallback;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, form, auth = true, signal, query } = options;
  const headers: Record<string, string> = {};
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let payload: BodyInit | undefined;
  if (form) {
    payload = form; // let the browser set the multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { method, headers, body: payload, signal });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError(
      `Cannot connect to API: ${API_BASE_URL || window.location.origin}. ` +
        "Start the backend with `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` " +
        "from the backend folder, then retry.",
      0,
      (error as Error)?.message ?? "Network request failed",
    );
  }

  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  if (!response.ok) {
    const detail = extractDetail(parsed, `Request failed with HTTP ${response.status}.`);
    throw new ApiError(detail, response.status, detail, parsed);
  }

  return parsed as T;
}

/** Turns a backend-relative media path into a browser-loadable URL. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE_URL || "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
