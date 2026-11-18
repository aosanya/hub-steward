import type { ChatAbout } from "../../app/chatAbout";
import { aboutLabel, choicesFor, emptyWordsFor, promptFor, readNamesFor, scopeKeysFor, scopedArgs, stepWordsFor } from "./aboutSubjects";

const place: ChatAbout = { kind: "place", id: "a1", name: "Zoldhalom Library", extra: { place: "n1" } };
const address: ChatAbout = { kind: "address", id: "d1", name: "Kossuth utca 7" };
const holding: ChatAbout = { kind: "holding", id: "t1", name: "Bela Szabo" };
const landUse: ChatAbout = { kind: "land-use", id: "u1", name: "Residential" };

const all = [place, address, holding, landUse];

describe("the property subjects", () => {
  it("a place reads its record and its holdings, scoped to itself", () => {
    expect(readNamesFor(place)).toEqual(["assetmanager_asset_read", "digitaltwin_tenure_list"]);
    expect(scopedArgs(place, "assetmanager_asset_read", {})).toEqual({ assetID: "a1" });
    expect(scopedArgs(place, "digitaltwin_tenure_list", {})).toEqual({ place_id: "n1" });
    expect(scopeKeysFor(place, "digitaltwin_tenure_list")).toEqual(["place_id"]);
  });

  it("an address, a holding and a land use each read only their own record", () => {
    expect(readNamesFor(address)).toEqual(["digitaltwin_address_read"]);
    expect(scopedArgs(address, "digitaltwin_address_read", {})).toEqual({ addressID: "d1" });
    expect(readNamesFor(holding)).toEqual(["digitaltwin_tenure_read"]);
    expect(scopedArgs(holding, "digitaltwin_tenure_read", {})).toEqual({ tenureID: "t1" });
    expect(readNamesFor(landUse)).toEqual(["digitaltwin_land_use_read"]);
    expect(scopedArgs(landUse, "digitaltwin_land_use_read", {})).toEqual({ landUseID: "u1" });
  });

  it("gives every read a step word and names the subject in its own words", () => {
    for (const about of all) {
      for (const name of readNamesFor(about)) expect(stepWordsFor(about)[name]).toBeTruthy();
      expect(aboutLabel(about)).toBe(about.name);
    }
  });

  it("offers choices for the kind and keeps the backlog out of the prompt", () => {
    expect(choicesFor(place)).toEqual(["Details", "Holdings"]);
    expect(choicesFor(address)).toEqual(["Details"]);
    expect(choicesFor(holding)).toEqual(["Details"]);
    expect(choicesFor(landUse)).toEqual(["Details"]);
    for (const about of all) {
      const prompt = promptFor(about);
      expect(prompt).toContain(`What would you like to see about ${about.name}? Tap one, or write your question.`);
      for (const choice of choicesFor(about)) expect(prompt).toContain(`[[${choice}]]`);
      expect(prompt).not.toMatch(/backlog/i);
    }
  });

  it("names the subject in the empty state", () => {
    expect(emptyWordsFor(place)).toBe("Ask about Zoldhalom Library: its details and holdings.");
    expect(emptyWordsFor(address)).toBe("Ask about Kossuth utca 7: its details.");
  });
});
