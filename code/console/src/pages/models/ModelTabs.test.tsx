import { screen } from "@testing-library/react";
import { owner, renderOnPage, staff } from "../limits/harness";
import { ModelTabs, tabIn, tabsOf } from "./ModelTabs";

const tabLabels = () => Array.from(document.querySelectorAll(".tab")).map((tab) => tab.textContent);

describe("the tabs of a model", () => {
  it("run Key and test, Limits, Users, Usage, with Users between Limits and Usage", () => {
    renderOnPage(<ModelTabs accountId="c1" current="key" />);
    expect(tabLabels()).toEqual(["Key and test", "Limits", "Users", "Usage"]);
  });

  it("mark the tab they are on", () => {
    renderOnPage(<ModelTabs accountId="c1" current="users" />);
    expect(screen.getByText("Users", { selector: ".tab" })).toHaveAttribute("aria-current", "page");
    expect(document.querySelectorAll("[aria-current='page']")).toHaveLength(1);
  });

  it("link every tab to that model's own address, with the tab in it", () => {
    renderOnPage(<ModelTabs accountId="c1" current="users" />);
    expect(screen.getByRole("link", { name: "Key and test" })).toHaveAttribute("href", "/h/h1/models/c1/key");
    expect(screen.getByRole("link", { name: "Limits" })).toHaveAttribute("href", "/h/h1/models/c1/limits");
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/h/h1/models/c1/users");
    expect(screen.getByRole("link", { name: "Usage" })).toHaveAttribute("href", "/h/h1/models/c1/usage");
  });

  it("carry the id of another model into every address", () => {
    renderOnPage(<ModelTabs accountId="c 2" current="limits" />);
    const addresses = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(addresses).toEqual(["/h/h1/models/c%202/key", "/h/h1/models/c%202/limits", "/h/h1/models/c%202/users", "/h/h1/models/c%202/usage"]);
  });

  it("leave a staff seat every tab but Key and test", () => {
    renderOnPage(<ModelTabs accountId="c1" current="users" />, staff);
    expect(tabLabels()).toEqual(["Limits", "Users", "Usage"]);
  });
});

describe("the tab a model's address names", () => {
  it("is the tab named when the seat may open it", () => {
    expect(tabIn(owner.role, "usage")).toBe("usage");
    expect(tabIn(staff.role, "usage")).toBe("usage");
  });

  it("is Key and test for an owner when the name is missing or unknown", () => {
    expect(tabIn(owner.role, undefined)).toBe("key");
    expect(tabIn(owner.role, "billing")).toBe("key");
  });

  it("is Limits for a staff seat when the name is Key and test, missing or unknown", () => {
    expect(tabIn(staff.role, "key")).toBe("limits");
    expect(tabIn(staff.role, undefined)).toBe("limits");
    expect(tabIn(staff.role, "billing")).toBe("limits");
  });

  it("lists the tabs of a seat in the order of the bar", () => {
    expect(tabsOf(owner.role)).toEqual(["key", "limits", "users", "usage"]);
    expect(tabsOf(staff.role)).toEqual(["limits", "users", "usage"]);
  });
});
