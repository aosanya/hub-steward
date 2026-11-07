import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { magyar } from "../entry/magyar";
import { words } from "../entry/words";
import type { EvidenceDraft, RiskDetail, RisksClient } from "./api";
import { EvidencePage } from "./EvidencePage";
import { RiskPage } from "./RiskPage";
import { RisksPage } from "./RisksPage";
import { routes } from "../routes";

beforeEach(() => {
  window.localStorage.clear();
  openAgency("risk-agency");
});

afterEach(() => {
  forgetOpenAgency();
  window.localStorage.clear();
});

const risk = { id: "r1", title: "Boiler room fire", topEvent: "Fire in the boiler room", status: "open", owner: "officer-ilona" };

const detail: RiskDetail = {
  risk,
  ratings: [
    { kind: "inherent", score: 15, band: "high" },
    { kind: "residual", score: 6, band: "medium" },
  ],
  safeguards: [
    { barrierId: "b1", side: "threat", pathway: "Faulty wiring", control: "Annual wiring check", standing: "proven", evidenceCount: 1, latestOutcome: "pass" },
    { barrierId: "b2", side: "threat", pathway: "Blocked vent", control: "Vent inspection", standing: "unproven", evidenceCount: 0, latestOutcome: "" },
    { barrierId: "b3", side: "consequence", pathway: "Smoke in the hall", control: "Sprinklers", standing: "failing", evidenceCount: 2, latestOutcome: "fail" },
  ],
  actions: [{ id: "a1", riskId: "r1", title: "Service the sprinklers", status: "in_progress", dueAt: "2026-12-01T00:00:00Z", owner: "officer-ilona" }],
};

const client = (over: Partial<RisksClient> = {}): RisksClient => ({
  myRisks: async () => [risk],
  myActions: async () => detail.actions,
  risk: async () => detail,
  recordEvidence: async () => {},
  ...over,
});

const at = (path: string, fake: RisksClient) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routes.risks.pattern} element={<RisksPage client={fake} />} />
        <Route path={routes.risk.pattern} element={<RiskPage client={fake} />} />
        <Route path={routes.riskEvidence.pattern} element={<EvidencePage client={fake} />} />
      </Routes>
    </MemoryRouter>,
  );

const base = "/a/risk-agency";

describe("the risk list", () => {
  it("lists the officer's risks and opens one", async () => {
    at(`${base}/risks`, client());
    await userEvent.click(await screen.findByRole("button", { name: /Boiler room fire/ }));
    expect(await screen.findByText("Fire in the boiler room")).toBeInTheDocument();
  });

  it("says so when no risk is the officer's", async () => {
    at(`${base}/risks`, client({ myRisks: async () => [] }));
    expect(await screen.findByText(words.risksEmpty)).toBeInTheDocument();
  });

  it("says so when the risks cannot be loaded", async () => {
    at(`${base}/risks`, client({ myRisks: async () => Promise.reject(new Error("down")) }));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.risksFailed);
  });

  it("shows the officer's actions with their due date and status", async () => {
    at(`${base}/risks`, client());
    await userEvent.click(screen.getByRole("button", { name: words.actionsMine }));
    const row = await screen.findByRole("button", { name: /Service the sprinklers/ });
    expect(row).toHaveTextContent("Due 2026-12-01");
    expect(row).toHaveTextContent(words.actionStatusInProgress);
  });

  it("says so when the officer has no actions", async () => {
    at(`${base}/risks`, client({ myActions: async () => [] }));
    await userEvent.click(screen.getByRole("button", { name: words.actionsMine }));
    expect(await screen.findByText(words.actionsEmpty)).toBeInTheDocument();
  });
});

describe("one risk", () => {
  it("shows each safeguard with its standing, the ratings and the actions", async () => {
    at(`${base}/risks/r1`, client());
    const wiring = await screen.findByRole("button", { name: /Annual wiring check/ });
    expect(wiring).toHaveTextContent(words.standingProven);
    expect(screen.getByRole("button", { name: /Vent inspection/ })).toHaveTextContent(words.standingUnproven);
    expect(screen.getByRole("button", { name: /Sprinklers/ })).toHaveTextContent(words.standingFailing);
    expect(screen.getByText(`${words.bandHigh} · 15`)).toBeInTheDocument();
    expect(screen.getByText("Service the sprinklers")).toBeInTheDocument();
  });

  it("says when the risk cannot be loaded", async () => {
    at(`${base}/risks/r1`, client({ risk: async () => Promise.reject(new Error("not yours")) }));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.riskFailed);
  });

  it("speaks Hungarian when the language is Hungarian", async () => {
    window.localStorage.setItem("hub.language", "hu");
    at(`${base}/risks/r1`, client());
    const wiring = await screen.findByRole("button", { name: /Annual wiring check/ });
    expect(wiring).toHaveTextContent(magyar.standingProven);
    expect(screen.getByText(magyar.riskThreats)).toBeInTheDocument();
  });
});

describe("attaching evidence", () => {
  it("sends the kind, outcome, summary and the attached file's name for the chosen safeguard", async () => {
    const sent: EvidenceDraft[] = [];
    at(`${base}/risks/r1/safeguards/b2/evidence`, client({ recordEvidence: async (draft) => void sent.push(draft) }));
    await userEvent.click(screen.getByLabelText(words.kindAudit));
    await userEvent.click(screen.getByLabelText(words.outcomePartial));
    await userEvent.type(screen.getByLabelText(words.evidenceSummary), "Looked at the vent");
    await userEvent.upload(screen.getByLabelText(words.evidenceFile), new File(["x"], "vent.jpg", { type: "image/jpeg" }));
    expect(screen.getByText("Attached: vent.jpg")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.evidenceSend }));
    expect(await screen.findByText(words.evidenceSent)).toBeInTheDocument();
    expect(sent).toEqual([{ barrierId: "b2", kind: "audit", outcome: "partial", summary: "Looked at the vent", reference: "vent.jpg" }]);
  });

  it("asks for a summary before sending", async () => {
    const sent: EvidenceDraft[] = [];
    at(`${base}/risks/r1/safeguards/b2/evidence`, client({ recordEvidence: async (draft) => void sent.push(draft) }));
    await userEvent.click(screen.getByRole("button", { name: words.evidenceSend }));
    expect(screen.getByText(words.evidenceSummaryNeeded)).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("keeps the form and says so when the evidence is not recorded", async () => {
    at(`${base}/risks/r1/safeguards/b2/evidence`, client({ recordEvidence: async () => Promise.reject(new Error("down")) }));
    await userEvent.type(screen.getByLabelText(words.evidenceSummary), "Looked at the vent");
    await userEvent.click(screen.getByRole("button", { name: words.evidenceSend }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(words.evidenceFailed));
    expect(screen.getByLabelText(words.evidenceSummary)).toHaveValue("Looked at the vent");
  });
});

describe("the Hungarian words", () => {
  it("has every risk word", () => {
    const keys = Object.keys(words).filter((key) => /^(risk|risks|actions|evidence|standing|status|kind|outcome|actionStatus|rating|band|safeguard)/.test(key));
    expect(keys.length).toBeGreaterThan(40);
    keys.forEach((key) => expect(magyar[key as keyof typeof magyar], key).not.toBe(""));
  });
});
