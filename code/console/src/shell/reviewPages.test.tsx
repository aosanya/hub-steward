import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { suggestToolsOf } from "../data/chatTools";
import { showsDraftBar } from "../data/draft";
import { hintKeys, reviewAreaPages } from "../data/menu";
import { listAccounts } from "../data/accounts";
import { I18nProvider } from "../i18n";
import type { Hub } from "../types";
import { HubSwitcher } from "./HubSwitcher";
import { itemPageOf, pageLabel } from "./labels";
import { pageOf } from "./page";
import { Strip } from "./Strip";

vi.mock("../data/accounts");

const words = JSON.parse(
  readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"),
);

const lab: Hub = {
  id: "siaya",
  name: "Siaya Community Computer Lab",
  role: "owner",
  kind: "community computer lab",
  model_key_set: true,
};
const farmers: Hub = {
  id: "kisumu",
  name: "Kisumu Farmers' Group",
  role: "owner",
  kind: "farmers' group",
  model_key_set: true,
};

const englishLabel = (page: string) =>
  pageLabel((key) => words.en[key] ?? key, page);

beforeEach(() => {
  vi.mocked(listAccounts).mockReset();
  vi.mocked(listAccounts).mockResolvedValue([]);
});

describe("the shell on the Review area pages", () => {
  it.each(reviewAreaPages)("reads %s from the address as the page", (page) => {
    expect(pageOf(`/h/kisumu/${page}`)).toBe(page);
  });

  it.each(reviewAreaPages)("draws no draft bar on %s", (page) => {
    expect(showsDraftBar(page)).toBe(false);
  });

  it.each(reviewAreaPages)("gives %s no suggestions tab of its own", (page) => {
    expect(suggestToolsOf(page)).toEqual(suggestToolsOf("publish-review"));
  });

  it.each(reviewAreaPages)(
    "offers on %s the three suggestions of Review",
    (page) => {
      expect(hintKeys(page)).toEqual([
        "chat.publish-review.1",
        "chat.publish-review.2",
        "chat.publish-review.3",
      ]);
    },
  );

  it.each(reviewAreaPages)(
    "names %s with its own words, never the page id",
    (page) => {
      expect(englishLabel(page)).not.toBe(page);
      expect(englishLabel(page)).toBe(words.en["menu." + page]);
    },
  );

  it.each(reviewAreaPages)(
    "keeps %s as the page when a goal or objective is in the address",
    (page) => {
      expect(itemPageOf(page, "?goal=g1")).toBe(page);
      expect(itemPageOf(page, "?objective=o1")).toBe(page);
    },
  );
});

describe("the breadcrumb of a Review area page", () => {
  const drawn = (page: string) => {
    render(
      <I18nProvider initial={words}>
        <MemoryRouter>
          <Strip hubs={[farmers]} hub={farmers} page={page} />
        </MemoryRouter>
      </I18nProvider>,
    );
    return document.querySelector(".crumb") as HTMLElement;
  };

  it("reads Agency, Review, then the area, with Review linking to the Review page", () => {
    const crumb = drawn("review-goals");

    expect(crumb).toHaveTextContent("Agency / Review / Goals");
    expect(crumb.querySelector("a")).toHaveAttribute(
      "href",
      "/h/kisumu/publish-review",
    );
    expect(crumb.querySelector(".crumb-now")).toHaveTextContent("Goals");
  });

  it("reads the Review page as Agency, then Review alone", () => {
    const crumb = drawn("publish-review");

    expect(crumb).toHaveTextContent("Agency / Review");
    expect(crumb.querySelector("a")).toBeNull();
  });
});

describe("switching hub from a Review area page", () => {
  const switcher = async (page: string) => {
    const user = userEvent.setup();
    render(
      <I18nProvider initial={words}>
        <MemoryRouter>
          <HubSwitcher hubs={[lab, farmers]} hub={farmers} page={page} />
        </MemoryRouter>
      </I18nProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: /Kisumu Farmers' Group/ }),
    );
    return screen.getByRole("link", { name: /Siaya Community Computer Lab/ });
  };

  it("lands a hub that shows the same area on that area", async () => {
    expect(await switcher("review-goals")).toHaveAttribute(
      "href",
      "/h/siaya/review-goals",
    );
  });

  it("lands a hub that has no Objectives area on Status", async () => {
    expect(await switcher("review-objectives")).toHaveAttribute(
      "href",
      "/h/siaya/status",
    );
  });
});
