import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useOnceNotice } from "./onceNotice";

function Probe() {
  const notice = useOnceNotice();
  const location = useLocation();
  return (
    <div>
      <p>{notice ?? "no notice"}</p>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
    </div>
  );
}

const at = (state: unknown) => (
  <MemoryRouter initialEntries={[{ pathname: "/backlogs", state }]}>
    <Probe />
  </MemoryRouter>
);

describe("a one-time notice", () => {
  it("shows the line it arrived with", () => {
    render(at({ notice: "Deleted walk-09 smart" }));
    expect(screen.getByText("Deleted walk-09 smart")).toBeInTheDocument();
  });

  it("clears the history entry's state so a refresh does not show it again", async () => {
    render(at({ notice: "Deleted walk-09 smart" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("null"));
    expect(screen.getByText("Deleted walk-09 smart")).toBeInTheDocument();
  });

  it("shows nothing when the page was opened without a line", () => {
    render(at(null));
    expect(screen.getByText("no notice")).toBeInTheDocument();
  });

  it("does not show the line again when the page is opened again from the cleared entry", async () => {
    const first = render(at({ notice: "Deleted walk-09 smart" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("null"));
    first.unmount();
    render(at(null));
    expect(screen.queryByText("Deleted walk-09 smart")).toBeNull();
  });
});
