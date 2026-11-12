import { runtimeConfig } from "../wakala/config";
import { isRefusal, reportRefused } from "../wakala/mcp";
import { renewedAuthHeaders } from "../wakala/renewal";

export type LinkOutcome = "sent" | "invalid" | "busy" | "unavailable" | "offline";
export type Agency = { id: string; name: string };
export type DirectoryAgency = Agency & { kind: string; purpose: string; joinMode: "open" | "approval" };
export type JoinOutcome = "joined" | "requested" | "failed";

export type EntryClient = {
  sendSignInLink(email: string, redirectTo: string): Promise<LinkOutcome>;
  listAgencies(): Promise<Agency[]>;
  searchDirectory(query: string): Promise<DirectoryAgency[]>;
  join(agencyId: string): Promise<JoinOutcome>;
};

export const looksLikeAnAddress = (email: string) => /^[^\s@]+@[^\s@]+$/.test(email);

const wakalaFetch = async (path: string, init: RequestInit) => {
  const { wakala } = await runtimeConfig();
  const headers = { ...(await renewedAuthHeaders()), ...(init.headers as Record<string, string> | undefined) };
  return fetch(wakala + path, { credentials: "include", ...init, headers });
};

const directoryAgency = (raw: any): DirectoryAgency => ({
  id: String(raw?.id ?? ""),
  name: String(raw?.name ?? ""),
  kind: String(raw?.kind ?? ""),
  purpose: String(raw?.purpose ?? raw?.description ?? ""),
  joinMode: raw?.join_mode === "open" ? "open" : "approval",
});

export const httpEntryClient: EntryClient = {
  async sendSignInLink(email, redirectTo) {
    if (!looksLikeAnAddress(email)) return "invalid";
    try {
      const res = await wakalaFetch("/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirect_to: redirectTo }),
      });
      if (res.status === 202) return "sent";
      if (res.status === 400) return "invalid";
      if (res.status === 429) return "busy";
      return "unavailable";
    } catch {
      return "offline";
    }
  },
  async listAgencies() {
    const res = await wakalaFetch("/me/agencies", { method: "GET" });
    if (isRefusal(res.status)) reportRefused();
    if (!res.ok) throw new Error(`your agencies answered ${res.status}`);
    const body = await res.json();
    const items: any[] = Array.isArray(body?.agencies) ? body.agencies : [];
    const { agency } = await runtimeConfig();
    const only = agency?.toLowerCase();
    return items
      .map((a) => ({ id: String(a?.id ?? ""), name: String(a?.name ?? "") }))
      .filter((a) => !only || a.name.toLowerCase().includes(only));
  },
  async searchDirectory(query) {
    const res = await wakalaFetch(`/directory?q=${encodeURIComponent(query)}`, { method: "GET" });
    if (!res.ok) throw new Error(`directory answered ${res.status}`);
    const body = await res.json();
    const items = Array.isArray(body) ? body : (body?.items ?? []);
    return items.map(directoryAgency);
  },
  async join(agencyId) {
    try {
      const res = await wakalaFetch(`/instances/${encodeURIComponent(agencyId)}/join`, { method: "POST" });
      if (!res.ok) return "failed";
      const body = await res.json().catch(() => ({}));
      return body?.status === "requested" || res.status === 202 ? "requested" : "joined";
    } catch {
      return "failed";
    }
  },
};

let current: EntryClient = httpEntryClient;

export const entryClient = (): EntryClient => current;

export const provideEntryClient = (client: EntryClient) => {
  current = client;
};
