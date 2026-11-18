import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { settingReply, settingsOf, type Settings } from "../../settingsFake";
import { OwnershipPage } from "../properties/OwnershipPage";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Item = Record<string, unknown>;

let settings: Settings;

const tenures = [
  { id: "t1", place_id: "n1", holder: "Szabó Katalin", holder_actor_id: "p1", kind: "owner", since: "2019-03-01T00:00:00Z" },
  { id: "t2", place_id: "n2", holder: "Szabó Katalin", holder_actor_id: "p1", kind: "tenant", since: "2021-06-15T00:00:00Z" },
];

const waterMeter = (patch: Partial<{ on: boolean; required: boolean }> = {}) => ({ prompt: "Water meter number", on: true, required: false, own: true, ...patch });

const holdingChoice = (...details: Item[]) => ({ "register_details:HOLDING": { details } });

const firstHoldingAnswers = (answers: Record<string, string>) => ({ "register_answers:HOLDING:t1": { answers } });

const hub = () =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    const setting = settingReply(settings, tool, args);
    if (setting !== undefined) return setting;
    if (tool === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }, { module: "digitaltwin" }] };
    if (tool === "agency_get_my_roles") return { permissions: ["member.view"] };
    if (tool === "actor_list_actors") return { items: [{ id: "p1", display_name: "Szabó Katalin", status: "active" }] };
    if (tool === "actor_get_actor") return { id: "p1", display_name: "Szabó Katalin", status: "active" };
    if (tool === "digitaltwin_tenure_list") return { items: given.holder_actor_id === undefined ? tenures : tenures.filter((tenure) => tenure.holder_actor_id === given.holder_actor_id) };
    if (tool === "digitaltwin_tenure_read") return { item: tenures.find((tenure) => tenure.id === given.tenureID) };
    if (tool === "digitaltwin_node_list") return { items: [{ id: "n1", name: "Kossuth utca 7" }, { id: "n2", name: "Malom utca 4" }] };
    return { items: [] };
  });

const rowOf = (title: string) => screen.getByText(title, { selector: ".ttl" }).closest(".row") as HTMLElement;

beforeEach(() => {
  openAgency("zoldhalom");
  settings = {};
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe("the holdings on an opened resident with details chosen in Settings", () => {
  const openPerson = async () => {
    hub();
    const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Szabó Katalin/ }));
    await screen.findByText("Kossuth utca 7", { selector: ".ttl" });
  };

  it("shows the owner's own detail with its answer on the holding that has one and today's details on the holding saved before", async () => {
    settings = settingsOf({ ...holdingChoice(waterMeter()), ...firstHoldingAnswers({ "Water meter number": "WM-20417" }) });
    await openPerson();

    expect(await within(rowOf("Kossuth utca 7")).findByText(/Water meter number/)).toBeInTheDocument();
    expect(rowOf("Kossuth utca 7").textContent).toContain("WM-20417");
    expect(rowOf("Malom utca 4").textContent).toContain("tenant · since 2021-06-15");
    expect(rowOf("Malom utca 4").textContent).not.toContain("Water meter number");
  });

  it("hides the answer of a detail switched off and shows the one still on", async () => {
    settings = settingsOf({
      ...holdingChoice(waterMeter({ on: false }), { prompt: "Heating", on: true, required: false, own: true }),
      ...firstHoldingAnswers({ "Water meter number": "WM-20417", Heating: "Gas" }),
    });
    await openPerson();

    expect(await within(rowOf("Kossuth utca 7")).findByText(/Gas/)).toBeInTheDocument();
    expect(rowOf("Kossuth utca 7").textContent).not.toContain("WM-20417");
    expect(rowOf("Kossuth utca 7").textContent).not.toContain("Water meter number");
  });
});

describe("an opened holding under Ownership & Tenure with details chosen in Settings", () => {
  const openHolding = async (row: RegExp) => {
    setWide(true);
    hub();
    render(
      <MemoryRouter initialEntries={["/a/zoldhalom/menu/properties/page"]}>
        <Routes>
          <Route path="/a/:agencyId/menu/properties/page" element={<OwnershipPage />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    const rows = await screen.findAllByText(row, { selector: ".meta" });
    await userEvent.click(rows[0]);
    const content = document.querySelector(".wf .wf-main .wf-content") as HTMLElement;
    expect(content).not.toBeNull();
    return within(content);
  };

  it("shows the owner's own detail and its answer after today's details", async () => {
    settings = settingsOf({ ...holdingChoice(waterMeter()), ...firstHoldingAnswers({ "Water meter number": "WM-20417" }) });

    const opened = await openHolding(/Kossuth utca 7/);

    expect(await opened.findByText("Water meter number")).toBeInTheDocument();
    expect(opened.getByText("WM-20417")).toBeInTheDocument();
    expect(opened.getByText("Property")).toBeInTheDocument();
    expect(opened.getByText("owner")).toBeInTheDocument();
  });

  it("shows today's details only for a holding saved before", async () => {
    settings = settingsOf({ ...holdingChoice(waterMeter()), ...firstHoldingAnswers({ "Water meter number": "WM-20417" }) });

    const opened = await openHolding(/Malom utca 4/);

    expect(await opened.findByText("tenant")).toBeInTheDocument();
    expect(opened.getByText("Malom utca 4")).toBeInTheDocument();
    expect(opened.queryByText("Water meter number")).toBeNull();
    expect(opened.queryByText("WM-20417")).toBeNull();
  });

  it("hides the answer of a detail switched off", async () => {
    settings = settingsOf({
      ...holdingChoice(waterMeter({ on: false }), { prompt: "Heating", on: true, required: false, own: true }),
      ...firstHoldingAnswers({ "Water meter number": "WM-20417", Heating: "Gas" }),
    });

    const opened = await openHolding(/Kossuth utca 7/);

    expect(await opened.findByText("Gas")).toBeInTheDocument();
    expect(opened.queryByText("WM-20417")).toBeNull();
    expect(opened.queryByText("Water meter number")).toBeNull();
  });
});
