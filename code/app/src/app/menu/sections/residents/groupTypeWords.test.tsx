import { cleanup, render, screen } from "@testing-library/react";
import { GroupHead } from "./GroupScreen";

const show = (language: string, nodeType: string) => {
  window.localStorage.setItem("hub.language", language);
  render(<GroupHead group={{ id: "g1", name: "Takács household", node_type: nodeType, members: "4 members" }} />);
};

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("hub.language");
});

describe("the group type on the quiet line follows the chosen language", () => {
  it.each(["Háztartás", "household", "Household"])("reads Household on the English screen for the type %s", (type) => {
    show("en", type);
    expect(screen.getByText("Household · 4 members")).toBeInTheDocument();
  });

  it.each(["Város", "city", "City"])("reads City on the English screen for the type %s", (type) => {
    show("en", type);
    expect(screen.getByText("City · 4 members")).toBeInTheDocument();
  });

  it("keeps the Hungarian words on the Hungarian screen", () => {
    show("hu", "household");
    expect(screen.getByText("Háztartás · 4 members")).toBeInTheDocument();
  });

  it("reads City in Hungarian as Város", () => {
    show("hu", "city");
    expect(screen.getByText("Város · 4 members")).toBeInTheDocument();
  });

  it("falls back to the typed name, first letter raised, for a type it does not know", () => {
    show("en", "committee");
    expect(screen.getByText("Committee · 4 members")).toBeInTheDocument();
  });

  it("prints nothing for the type when the group has none", () => {
    show("en", "");
    expect(screen.getByText("4 members")).toBeInTheDocument();
  });
});
