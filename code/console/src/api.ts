export type ApiResult<T> = { ok: boolean; status: number; data: T };

export async function api<T = any>(method: string, path: string, body?: unknown, init: RequestInit = {}): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    ...init,
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

export const get = <T = any>(path: string) => api<T>("GET", path);
export const post = <T = any>(path: string, body?: unknown) => api<T>("POST", path, body ?? {});
export const put = <T = any>(path: string, body?: unknown) => api<T>("PUT", path, body ?? {});

export const withQuery = (path: string, params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
};

export const hubPath = (hubId: string, ...segments: string[]) =>
  "/h/" + encodeURIComponent(hubId) + segments.map((s) => "/" + encodeURIComponent(s)).join("");
