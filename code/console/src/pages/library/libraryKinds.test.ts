import { beforeEach, describe, expect, it, vi } from "vitest";
import { kindSetups, loadEntries } from "./libraryKinds";

const library = vi.hoisted(() => ({
  hazardRows: vi.fn(),
  threatRows: vi.fn(),
  consequenceRows: vi.fn(),
  createHazard: vi.fn(),
  createThreat: vi.fn(),
  createConsequence: vi.fn(),
  updateHazard: vi.fn(),
  updateThreat: vi.fn(),
  updateConsequence: vi.fn(),
  deleteHazard: vi.fn(),
  deleteThreat: vi.fn(),
  deleteConsequence: vi.fn(),
}));

vi.mock("../../data/pages/library", () => library);

beforeEach(() => {
  for (const fn of Object.values(library)) fn.mockReset();
});

describe("the three kinds of library part", () => {
  it("gives each kind its own page, menu word and add and edit words", () => {
    expect(kindSetups.hazard).toMatchObject({ pageId: "hazards", menuKey: "menu.hazards", addKey: "library.addHazard", editKey: "library.editHazard" });
    expect(kindSetups.threat).toMatchObject({ pageId: "threats", menuKey: "menu.threats", addKey: "library.addThreat", editKey: "library.editThreat" });
    expect(kindSetups.consequence).toMatchObject({ pageId: "consequences", menuKey: "menu.consequences", addKey: "library.addConsequence", editKey: "library.editConsequence" });
  });

  it("guards a threat and a consequence but not a hazard", () => {
    expect(kindSetups.hazard.guarded).toBe(false);
    expect(kindSetups.threat.guarded).toBe(true);
    expect(kindSetups.consequence.guarded).toBe(true);
  });

  it("sends create, update and delete of each kind to that kind's own calls", async () => {
    const input = { title: "Storm", description: "Wind" };
    await kindSetups.threat.create("h1", input);
    await kindSetups.threat.update("h1", "t1", input);
    await kindSetups.threat.remove("h1", "t1");
    expect(library.createThreat).toHaveBeenCalledWith("h1", input);
    expect(library.updateThreat).toHaveBeenCalledWith("h1", "t1", input);
    expect(library.deleteThreat).toHaveBeenCalledWith("h1", "t1");
    await kindSetups.hazard.create("h1", input);
    await kindSetups.consequence.update("h1", "q1", input);
    expect(library.createHazard).toHaveBeenCalledWith("h1", input);
    expect(library.updateConsequence).toHaveBeenCalledWith("h1", "q1", input);
    expect(library.createThreat).toHaveBeenCalledTimes(1);
  });
});

describe("loading the entries of a kind", () => {
  it("asks the kind's own loader and fills what the hub left out", async () => {
    library.threatRows.mockResolvedValue([{ id: "t1", code: "T-1", title: "Storm", description: "", usedIn: 2 }]);
    expect(await loadEntries("h1", "threat")).toEqual([
      { id: "t1", code: "T-1", title: "Storm", description: "", usedIn: 2, unguarded: false, hazardCode: undefined, hazardTitle: undefined, hazardId: undefined, bowties: undefined },
    ]);
    expect(library.threatRows).toHaveBeenCalledWith("h1");
    expect(library.hazardRows).not.toHaveBeenCalled();
  });

  it("keeps the unguarded flag, the hazard of a consequence and the bowties", async () => {
    const bowties = [{ id: "b1", name: "Flood" }];
    library.consequenceRows.mockResolvedValue([
      { id: "q1", code: "Q-1", title: "Crop loss", description: "d", usedIn: 1, unguarded: true, hazardCode: "H-1", hazardTitle: "Flood", hazardId: "h1", bowties },
    ]);
    const [entry] = await loadEntries("h1", "consequence");
    expect(entry).toMatchObject({ unguarded: true, hazardCode: "H-1", hazardTitle: "Flood", hazardId: "h1", bowties });
  });

  it("gives an empty list when the kind has none", async () => {
    library.hazardRows.mockResolvedValue([]);
    expect(await loadEntries("h1", "hazard")).toEqual([]);
  });
});
