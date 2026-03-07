/**
 * API helpers. All fetch calls go to same-origin paths;
 * Vite dev server proxies /api/* to the Python backend.
 */

export const API_BASE = "";

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}
