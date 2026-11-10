import { runtimeConfig } from "../wakala/config";

const loopback = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const isLoopbackHost = (host: string) => loopback.has(host.toLowerCase());

export const hubIsLocal = async (page: { hostname: string } = window.location): Promise<boolean> => {
  if (!isLoopbackHost(page.hostname)) return false;
  const { wakala } = await runtimeConfig();
  if (wakala === "") return true;
  try {
    return isLoopbackHost(new URL(wakala).hostname);
  } catch {
    return false;
  }
};
