// The single place that talks to the backend, and the ONLY place that touches
// localStorage (per project guardrails). All protected calls go through
// `authedFetch`, which attaches the bearer token and, on a 401, clears the token
// and redirects to /login.

import type {
  AgentRepurposeRequest,
  AgentRepurposeResponse,
  RepurposeJob,
  RepurposeJobSummary,
  RepurposeRequest,
  TokenResponse,
  User,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "echo_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// --- token store (SSR-safe) ---------------------------------------------------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

// --- low-level fetch ----------------------------------------------------------

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg as string;
    }
  } catch {
    /* fall through to generic message */
  }
  return "Something went wrong. Please try again.";
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  return (await res.json()) as T;
}

/** Authenticated request: attaches the bearer token; on 401, logs out. */
export async function authedFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  return (await res.json()) as T;
}

/** Authenticated request with no response body (e.g. a 204 DELETE). */
export async function authedFetchNoContent(
  path: string,
  init: RequestInit = {}
): Promise<void> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
}

// --- auth calls ---------------------------------------------------------------

export async function register(
  email: string,
  password: string
): Promise<TokenResponse> {
  return request<TokenResponse>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function login(
  email: string,
  password: string
): Promise<TokenResponse> {
  // OAuth2 password flow expects form-encoded `username` + `password`.
  const body = new URLSearchParams({ username: email, password });
  return request<TokenResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function me(): Promise<User> {
  return authedFetch<User>("/api/auth/me");
}

// --- content calls ------------------------------------------------------------

export async function repurpose(
  req: RepurposeRequest
): Promise<RepurposeJob> {
  return authedFetch<RepurposeJob>("/api/repurpose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

// --- agent calls --------------------------------------------------------------

export async function agentRepurpose(
  req: AgentRepurposeRequest
): Promise<AgentRepurposeResponse> {
  return authedFetch<AgentRepurposeResponse>("/api/agent/repurpose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

// --- history calls ------------------------------------------------------------

export async function listHistory(): Promise<RepurposeJobSummary[]> {
  return authedFetch<RepurposeJobSummary[]>("/api/history");
}

export async function getHistoryJob(id: number): Promise<RepurposeJob> {
  return authedFetch<RepurposeJob>(`/api/history/${id}`);
}

export async function deleteHistoryJob(id: number): Promise<void> {
  return authedFetchNoContent(`/api/history/${id}`, { method: "DELETE" });
}
