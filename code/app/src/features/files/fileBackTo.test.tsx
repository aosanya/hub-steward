import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backText, goBack, makeClient, prepare, release } from "./filesFixture";
import { FilesRoutes } from "./index";

vi.mock("./viewer/FileViewer", () => ({ FileViewer: (props: { name: string }) => <div data-testid="viewer">{props.name}</div> }));

afterEach(() => {
  cleanup();
  release();
});

const Where = () => <span data-testid="at">{useLocation().pathname}</span>;

const open = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/hub-1/files/r1/file", search: "?path=main.go", state }]}>
      <Routes>
        <Route path="/a/:agencyId/files/*" element={<FilesRoutes client={makeClient()} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const book = { backTo: "/a/hub-1/backlogs/book", backLabel: "Book" };

describe.each([
  ["a phone", false, "/a/hub-1/files/r1"],
  ["a wide window", true, "/a/hub-1/files"],
])("the back of a file opened on %s", (_name, wide, parent) => {
  beforeEach(() => prepare(wide));

  it("goes to where the viewer came from and says so", async () => {
    open(book);
    await screen.findByTestId("viewer");
    expect(backText()).toContain("Book");
    goBack();
    expect(screen.getByTestId("at")).toHaveTextContent("/a/hub-1/backlogs/book");
  });

  it("still goes to the folder when nothing says where the viewer came from", async () => {
    open();
    await screen.findByTestId("viewer");
    expect(backText()).not.toContain("Book");
    goBack();
    expect(screen.getByTestId("at")).toHaveTextContent(parent);
  });
});
