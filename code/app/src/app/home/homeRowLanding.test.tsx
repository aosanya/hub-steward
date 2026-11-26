import { vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, forgetLanded, forgetWide, recordPathOf, setWide, showAt } from "./agencyHome_contract_adapters";
import { fieldSetup } from "./agencyHome_contract_fieldwork";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetWide();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("a record list opened on a row after a row form was sent", () => {
  it("shows the row's facts on a phone", async () => {
    setWide(false);
    showAt(`${recordPathOf(agencyId, "plots", "RC-1")}?open=r1`, fieldSetup());
    expect(await screen.findByText("Red loam")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows the row's facts on a wide screen", async () => {
    setWide(true);
    showAt(`${recordPathOf(agencyId, "plots", "RC-1")}?open=r1`, fieldSetup());
    expect(await screen.findByText("Red loam")).toBeInTheDocument();
  });
});
