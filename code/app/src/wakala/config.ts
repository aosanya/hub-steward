export type RuntimeConfig = { wakala: string; mcp: string };

const sameOrigin: RuntimeConfig = { wakala: "", mcp: "/mcp" };

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\/+$/, "") : "");

export const parseConfig = (raw: unknown): RuntimeConfig => {
  const doc = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const wakala = trimmed(doc.wakala);
  return { wakala, mcp: trimmed(doc.mcp) || `${wakala}/mcp` };
};

const fetchConfig = async (): Promise<RuntimeConfig | null> => {
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    return res.ok ? parseConfig(await res.json()) : null;
  } catch {
    return null;
  }
};

let pending: Promise<RuntimeConfig | null> | null = null;

export const runtimeConfig = async (): Promise<RuntimeConfig> => {
  pending ??= fetchConfig();
  const config = await pending;
  if (config === null) {
    pending = null;
    return sameOrigin;
  }
  return config;
};

export const setRuntimeConfig = (config: Partial<RuntimeConfig>) => {
  pending = Promise.resolve({ ...sameOrigin, ...config });
};

export const forgetRuntimeConfig = () => {
  pending = null;
};
