import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes as appRoutes } from "../../../routes";
import { routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = { id: string; answers: Record<string, string> };

let saved: Row[];

const chosen = {
  details: [
    { prompt: "Registration number", on: false, required: false, own: false },
    { prompt: "Tax number", on: true, required: false, own: false },
    { prompt: "Opening hours", on: true, required: true, own: true },
  ],
};

const hubWith = (rows: Row[], settings: Record<string, unknown>) => {
  saved = rows;
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    if (tool === "forms_catalog_setting_read") {
      const value = settings[String(given.key)];
      return value ? { key: given.key, value: JSON.stringify(value) } : null;
    }
    if (tool === "agency_add_live_record_row") {
      saved = [...saved, { id: `b${saved.length + 1}`, answers: given.answers as Record<string, string> }];
      return saved[saved.length - 1];
    }
    if (tool === "actor_list_actors") return { items: [] };
    return { items: saved };
  });
};

const showAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Add business form with details chosen in Settings", () => {
  it("asks the switched-on details, leaves out the switched-off one and asks the owner's own detail", async () => {
    hubWith([], { "register_details:RC-1": chosen });
    showAt(appRoutes.businessNew.path());

    expect(await screen.findByLabelText("Opening hours")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax number (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Registration number (optional)")).toBeNull();
  });

  it("saves the owner's own detail among the answers", async () => {
    const user = userEvent.setup();
    hubWith([], { "register_details:RC-1": chosen });
    showAt(appRoutes.businessNew.path());

    await user.type(await screen.findByLabelText("Opening hours"), "Mon to Fri, 6:00 to 14:00");
    await user.type(screen.getByLabelText("Trading name"), "Malom Pékség");
    await user.type(screen.getByLabelText("Kind of business"), "Bakery");
    await user.click(screen.getByRole("radio", { name: "Malomsor" }));
    await user.click(screen.getByRole("radio", { name: "Active" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].answers["Opening hours"]).toBe("Mon to Fri, 6:00 to 14:00");
    expect(saved[0].answers).not.toHaveProperty("Registration number");
  });

  it("asks today's details when nothing was chosen", async () => {
    hubWith([], {});
    showAt(appRoutes.businessNew.path());

    expect(await screen.findByLabelText("Registration number (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Opening hours")).toBeNull();
  });
});

describe("an opened business with details chosen in Settings", () => {
  it("shows the owner's own detail", async () => {
    const user = userEvent.setup();
    hubWith([{ id: "b1", answers: { "Trading name": "Malom Pékség", "Opening hours": "Mon to Fri, 6:00 to 14:00" } }], { "register_details:RC-1": chosen });
    showAt(residentPaths.businesses.path());

    await user.click(await screen.findByText("Malom Pékség"));

    expect(await screen.findByText("Opening hours")).toBeInTheDocument();
    expect(screen.getByText("Mon to Fri, 6:00 to 14:00")).toBeInTheDocument();
    expect(screen.queryByText("Registration number")).toBeNull();
  });
});
