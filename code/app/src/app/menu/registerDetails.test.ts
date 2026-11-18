import { vi } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import * as registerDetails from "./registerDetails";
import { settingReply, settingsOf, type Settings } from "./settingsFake";

const named = registerDetails as unknown as Record<string, any>;

let settings: Settings;

beforeEach(() => {
  settings = {};
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => settingReply(settings, tool, args) ?? { items: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the default details of a resident", () => {
  it("are Name required, then Phone and Email optional, as the Add person form asks today", () => {
    expect(named.residentFields).toEqual([
      { prompt: "Name", required: true },
      { prompt: "Phone", required: false },
      { prompt: "Email", required: false },
    ]);
  });

  it("follow the choice kept under register_details:RESIDENT", async () => {
    settings = settingsOf({
      "register_details:RESIDENT": {
        details: [
          { prompt: "Phone", on: false, required: false, own: false },
          { prompt: "Preferred language", on: true, required: true, own: true },
        ],
      },
    });
    expect(named.residentFields).toBeDefined();

    const chosen = await registerDetails.readRegisterDetails("RESIDENT");

    expect(registerDetails.fieldsOf(named.residentFields, chosen)).toEqual([
      { prompt: "Name", required: true },
      { prompt: "Email", required: false },
      { prompt: "Preferred language", required: true },
    ]);
  });
});

describe("the default details of a holding", () => {
  it("are the tenure details shown today: Property, Kind and Since", () => {
    expect(named.holdingFields).toEqual([
      { prompt: "Property", required: false },
      { prompt: "Kind", required: false },
      { prompt: "Since", required: false },
    ]);
  });

  it("are kept under register_details:HOLDING with the owner's own detail after them", async () => {
    expect(named.holdingFields).toBeDefined();
    const details = registerDetails.detailsOf(named.holdingFields, []);

    await registerDetails.writeRegisterDetails("HOLDING", [...details, { prompt: "Water meter number", on: true, required: false, own: true }]);

    expect(JSON.parse(settings["register_details:HOLDING"]).details).toEqual([
      { prompt: "Property", on: true, required: false, own: false },
      { prompt: "Kind", on: true, required: false, own: false },
      { prompt: "Since", on: true, required: false, own: false },
      { prompt: "Water meter number", on: true, required: false, own: true },
    ]);
    expect(await registerDetails.readRegisterDetails("HOLDING")).toHaveLength(4);
  });
});
