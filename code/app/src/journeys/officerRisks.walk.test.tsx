import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openAgency } from "../agency/open";
import { words } from "../entry/words";
import { forgetSubject } from "../wakala/me";
import { endInAgencies, everyCallNames, openApp, startInAgencies, stubWakala, where } from "./inAgency.test-support";
import type { Agency } from "../entry/api";

const hall: Agency = { id: "walk-hall", name: "Kisvarda Town Hall" };

const ilona = "officer-ilona";

const mine = { id: "r1", title: "Boiler room fire", top_event: "Fire in the boiler room", status: "open", owner: ilona };
const theirs = { id: "r2", title: "Archive flood", top_event: "Water in the archive", status: "open", owner: "officer-bence" };

const measure = (side: string, barrier: string, control: string, standing: string, count: number) => ({
  barrier: { id: barrier },
  pathway: { title: `${control} route`, side },
  control: { name: control },
  standing,
  evidence_count: count,
});

const replies = {
  riskmanager_risk_list: (args: Record<string, unknown>) => ({ items: [mine, theirs].filter((risk) => !args.owner || risk.owner === args.owner) }),
  riskmanager_action_list: () => ({ items: [{ id: "a1", risk_id: "r1", title: "Service the sprinklers", status: "open", owner: ilona }] }),
  riskmanager_risk_bowtie: () => ({ risk: mine, inherent: { score: 15, band: "high" }, actions: [] }),
  riskmanager_preventive_measure_list: () => ({ items: [measure("threat", "b1", "Wiring check", "proven", 1), measure("threat", "b2", "Vent inspection", "unproven", 0)] }),
  riskmanager_mitigating_measure_list: () => ({ items: [measure("consequence", "b3", "Sprinklers", "failing", 2)] }),
  riskmanager_evidence_record: () => ({ id: "e1" }),
};

const asIlona = () => {
  const wakala = stubWakala(replies);
  const underlying = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) =>
    String(url).endsWith("/me") ? { ok: true, status: 200, json: async () => ({ subject: ilona }) } : underlying(url, init),
  ));
  return wakala;
};

beforeEach(() => {
  startInAgencies();
  forgetSubject();
  window.localStorage.clear();
});

afterEach(() => {
  endInAgencies();
  forgetSubject();
  window.localStorage.clear();
});

describe("an officer's risks on the phone", () => {
  it("sees only their own risks, opens one, sees each safeguard's standing and attaches evidence", async () => {
    const wakala = asIlona();
    openAgency(hall.id);
    openApp(`/a/${hall.id}/risks`, [hall]);

    await userEvent.click(await screen.findByRole("button", { name: /Boiler room fire/ }));
    expect(screen.queryByText("Archive flood")).not.toBeInTheDocument();
    expect(where()).toBe(`/a/${hall.id}/risks/r1`);

    expect(await screen.findByRole("button", { name: /Wiring check/ })).toHaveTextContent(words.standingProven);
    expect(screen.getByRole("button", { name: /Vent inspection/ })).toHaveTextContent(words.standingUnproven);
    expect(screen.getByRole("button", { name: /Sprinklers/ })).toHaveTextContent(words.standingFailing);

    await userEvent.click(screen.getByRole("button", { name: /Vent inspection/ }));
    expect(where()).toBe(`/a/${hall.id}/risks/r1/safeguards/b2/evidence`);
    await userEvent.click(screen.getByLabelText(words.kindLog));
    await userEvent.type(screen.getByLabelText(words.evidenceSummary), "Vent was clear on the walk round");
    await userEvent.upload(screen.getByLabelText(words.evidenceFile), new File(["x"], "vent.jpg", { type: "image/jpeg" }));
    await userEvent.click(screen.getByRole("button", { name: words.evidenceSend }));
    expect(await screen.findByText(words.evidenceSent)).toBeInTheDocument();

    await waitFor(() => expect(wakala.named("riskmanager_evidence_record")).toHaveLength(1));
    expect(wakala.named("riskmanager_evidence_record")[0].args).toMatchObject({
      barrier_id: "b2",
      kind: "log",
      outcome: "pass",
      summary: "Vent was clear on the walk round",
      reference: "vent.jpg",
    });
    expect(wakala.named("riskmanager_risk_list")[0].args.owner).toBe(ilona);
    everyCallNames(wakala.sent, hall);
  });
});
