import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import { sectionById } from "../../sections";
import { items, routes } from "./index";

const removedTitles = ["Integrations", "AI Agents & Limits", "Audit Log"];

const removedPaths = ["/a/town/menu/settings/integrations", "/a/town/menu/settings/ai-agents", "/a/town/menu/settings/ai-agents/x/edit", "/a/town/menu/settings/audit-log"];

beforeEach(() => {
  openAgency("town");
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

describe("the screens the console owns", () => {
  it("are not items of the Settings section", () => {
    for (const title of removedTitles) expect(items.map((item) => item.title)).not.toContain(title);
  });

  it("are not named by the Settings section's own list", () => {
    const settings = sectionById("settings");
    for (const title of removedTitles) expect(JSON.stringify(settings)).not.toContain(title);
  });

  it.each(removedPaths)("have no route at %s", (path) => {
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes()}
          <Route path="*" element={<p>nothing here</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container.textContent).toBe("nothing here");
  });
});
