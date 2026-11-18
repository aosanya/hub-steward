import { shownName, unnamedPerson } from "./personLabel";

describe("shownName", () => {
  it("keeps a name", () => {
    expect(shownName("Aranka Zoldhalmi")).toBe("Aranka Zoldhalmi");
  });

  it("reads an empty or blank name as Unnamed person", () => {
    expect(shownName("")).toBe(unnamedPerson);
    expect(shownName("   ")).toBe(unnamedPerson);
  });

  it("reads an id as Unnamed person", () => {
    expect(shownName("3f2c9a1e-5b7d-4c8e-9a10-2b6d4e8f0a13")).toBe(unnamedPerson);
    expect(shownName("3f2c9a1e")).toBe(unnamedPerson);
  });
});
