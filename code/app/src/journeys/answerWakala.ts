import { vi } from "vitest";

type Agency = { id: string; name: string };

type Channel = (hub: string, tool: string, args?: Record<string, unknown>) => Promise<any>;

export const agenciesFrom = (channel: Channel) => async (): Promise<Agency[]> => (await channel("", "agency_list_instances")).items ?? [];

export const answerWakala = (subject: () => string, agencies: () => Promise<Agency[]> | Agency[]) =>
  vi.fn(async (url: string) => {
    const body = String(url).endsWith("/me/agencies") ? { agencies: await agencies() } : { subject: subject(), agencies: [] };
    return { ok: true, status: 200, json: async () => body };
  });
