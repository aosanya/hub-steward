import { describe, expect, it } from "vitest";
import { chatPageOf } from "./index";
import { hintKeys, isAgencyContentPage, showsPage } from "../menu";
import { pageModule } from "../registry";
import { views } from "../../pages/views";

describe("the Controls and Risk library pages", () => {
  it.each(["controls", "hazards", "threats", "consequences"])("wires %s into the menu, views, registry and chat like the other agency pages", (page) => {
    expect(showsPage("farmers", page)).toBe(true);
    expect(isAgencyContentPage(page)).toBe(true);
    expect(views[page]).toBeDefined();
    expect(pageModule(page)).toBeDefined();
    expect(chatPageOf(page)?.reads.length).toBeGreaterThan(0);
    expect(hintKeys(page)).toHaveLength(3);
  });
});
