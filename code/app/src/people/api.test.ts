import * as mcp from "../wakala/mcp";
import { GROUP_COORDINATOR, listPeople, namesOf, peopleOf } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("people", () => {
  it("reads each actor's id and trimmed display name, and leaves out an actor with no name", () => {
    const reply = { items: [{ id: "a1", display_name: "  Grace Adhiambo " }, { id: "a2", display_name: "" }, { id: "a3" }, { id: "", display_name: "Nobody" }] };
    expect(peopleOf(reply)).toEqual([{ id: "a1", name: "Grace Adhiambo" }]);
  });

  it("reads a bare list as well as an items list", () => {
    expect(peopleOf([{ id: "a1", display_name: "Asha Otieno" }])).toEqual([{ id: "a1", name: "Asha Otieno" }]);
    expect(peopleOf(null)).toEqual([]);
  });

  it("lists the people over actor_list_actors", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [{ id: "a1", display_name: "Asha Otieno" }] });
    expect(await listPeople()).toEqual([{ id: "a1", name: "Asha Otieno" }]);
    expect(call).toHaveBeenCalledWith("", "actor_list_actors");
  });

  it("maps each id to its name", () => {
    expect(namesOf([{ id: "a1", name: "Asha Otieno" }]).get("a1")).toBe("Asha Otieno");
  });

  it("calls the fallback label the Group coordinator", () => {
    expect(GROUP_COORDINATOR).toBe("Group coordinator");
  });
});
