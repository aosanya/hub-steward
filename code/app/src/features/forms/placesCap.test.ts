import { moreThanShown, placesMatching, shownLimit, type Place } from "./places";

const town = (count: number): Place[] =>
  Array.from({ length: count }, (_, index) => ({ ref: `address:a-${index}`, words: `Fő tér ${index + 1}` }));

describe("the list of streets and addresses in the filing sheet", () => {
  it("shows six rows at most, so the free text box and File application stay in reach", () => {
    expect(shownLimit).toBe(6);
    expect(placesMatching(town(40), "", "")).toHaveLength(6);
  });

  it("keeps the picked place on top without growing past the cap by more than that one", () => {
    const shown = placesMatching(town(40), "", "address:a-30");
    expect(shown).toHaveLength(7);
    expect(shown[0].ref).toBe("address:a-30");
  });

  it("tells the person to keep typing while more places match than are shown", () => {
    expect(moreThanShown(town(7), "")).toBe(true);
    expect(moreThanShown(town(6), "")).toBe(false);
    expect(moreThanShown(town(40), "Fő tér 3")).toBe(true);
    expect(moreThanShown(town(40), "Fő tér 30")).toBe(false);
  });
});
