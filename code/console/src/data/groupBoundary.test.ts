import { callTool } from "../wakala/mcp";
import { boundaryOf, cornersFromText, loadBoundary, saveBoundary, textFromCorners } from "./groupBoundary";

vi.mock("../wakala/mcp");

const ring = [
  [20, 47],
  [21, 47],
  [21, 48],
  [20, 47],
];

describe("the group boundary", () => {
  beforeEach(() => vi.mocked(callTool).mockReset());

  it("reads a polygon from the group the API returns", async () => {
    vi.mocked(callTool).mockResolvedValue({ id: "g1", boundary: { type: "Polygon", coordinates: [ring] } });
    expect(await loadBoundary("h1", "g1")).toEqual({ type: "Polygon", rings: [ring] });
    expect(callTool).toHaveBeenCalledWith("h1", "actor_get_group", { group_id: "g1" });
  });

  it("reads every ring of a multipolygon and nothing from a group without a boundary", () => {
    expect(boundaryOf({ boundary: { type: "MultiPolygon", coordinates: [[ring], [ring]] } })?.rings).toHaveLength(2);
    expect(boundaryOf({ id: "g1" })).toBeNull();
    expect(boundaryOf({ boundary: { type: "Point", coordinates: [1, 1] } })).toBeNull();
  });

  it("turns lines of longitude, latitude into corners and refuses the rest", () => {
    expect(cornersFromText("20, 47\n21, 47\n21, 48")).toEqual([[20, 47], [21, 47], [21, 48]]);
    expect(cornersFromText("20, 47\n21, 47\n21, 48\n20, 47")).toHaveLength(3);
    expect(cornersFromText("20, 47\n21, 47")).toBeNull();
    expect(cornersFromText("20, 47\n21, 47\n21, 999")).toBeNull();
    expect(cornersFromText("20, 47\n21, 47\nx, 48")).toBeNull();
  });

  it("writes corners back without the closing one", () => {
    expect(textFromCorners(ring as [number, number][])).toBe("20, 47\n21, 47\n21, 48");
  });

  it("sends a closed polygon, and no boundary to clear it", async () => {
    vi.mocked(callTool).mockResolvedValue({});
    await saveBoundary("h1", "g1", [[20, 47], [21, 47], [21, 48]]);
    expect(callTool).toHaveBeenLastCalledWith("h1", "actor_set_group_boundary", {
      group_id: "g1",
      boundary: { type: "Polygon", coordinates: [ring] },
    });
    await saveBoundary("h1", "g1", null);
    expect(callTool).toHaveBeenLastCalledWith("h1", "actor_set_group_boundary", { group_id: "g1" });
  });
});
