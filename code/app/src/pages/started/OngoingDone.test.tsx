import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency } from "../../agency/open";
import type { DoneClient, DoneItem, DonePage } from "../../started/done";
import type { StartedClient } from "../../started/api";
import { Ongoing } from "./Ongoing";

const closedOrder: DoneItem = {
  id: "order-g1",
  workflow: "Create group order",
  title: "Urea 50kg",
  state: "Closed",
  endedAt: "2026-11-03T12:00:00Z",
  path: "/coordinator/orders/g1",
};
const calledOff: DoneItem = {
  id: "order-g2",
  workflow: "Group order",
  title: "Seed maize 10kg",
  state: "Called off",
  endedAt: "2026-10-28T12:00:00Z",
  path: "/my-orders/group/g2",
};
const sentForm: DoneItem = {
  id: "form-r1",
  workflow: "Form",
  title: "Group fertilizer order",
  state: "Sent",
  endedAt: "2026-10-21T12:00:00Z",
  path: "",
};

const liveEmpty: StartedClient = { list: async () => [] };

const page = (items: DoneItem[], over: Partial<DonePage> = {}): DonePage => ({ items, failed: [], next: null, ...over });

const doneOf = (...pages: Array<DonePage | Error>): DoneClient & { read: ReturnType<typeof vi.fn> } => {
  const read = vi.fn(async () => {
    const next = pages.length > 1 ? pages.shift()! : pages[0];
    if (next instanceof Error) throw next;
    return next;
  });
  return { read };
};

const Where = () => {
  const location = useLocation();
  return (
    <output data-testid="where">
      {location.pathname}|{JSON.stringify(location.state)}
    </output>
  );
};

const renderOngoing = (done: DoneClient, live: StartedClient = liveEmpty, at = "/ongoing") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="*" element={<Ongoing client={live} doneClient={done} onStart={() => undefined} />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const openDone = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Done" }));
};

afterEach(() => forgetOpenAgency());

describe("the Done tab", () => {
  it("is beside Live, Live chosen, and reads nothing finished until Done is pressed", async () => {
    const done = doneOf(page([closedOrder]));
    renderOngoing(done);
    expect(await screen.findByText("Nothing ongoing yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "false");
    expect(done.read).not.toHaveBeenCalled();
  });

  it("draws one read-only row per finished item with its workflow, state and day", async () => {
    renderOngoing(doneOf(page([closedOrder, calledOff, sentForm])));
    await openDone();
    expect(await screen.findByRole("button", { name: "Urea 50kg Create group order · Closed Tue 3 Nov" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seed maize 10kg Group order · Called off Wed 28 Oct" })).toBeInTheDocument();
    expect(screen.getByText("Group fertilizer order").closest(".row")).toHaveTextContent("Form · SentWed 21 Oct");
    expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the rows in the order the client gives them, newest first", async () => {
    renderOngoing(doneOf(page([closedOrder, calledOff, sentForm])));
    await openDone();
    await screen.findByText(closedOrder.title);
    const titles = Array.from(document.querySelectorAll(".rows .row .ttl")).map((title) => title.textContent);
    expect(titles).toEqual(["Urea 50kg", "Seed maize 10kg", "Group fertilizer order"]);
  });

  it("opens an order with the page it sits on as backTo", async () => {
    renderOngoing(doneOf(page([closedOrder])), liveEmpty, "/a/farmers/ongoing");
    await openDone();
    await userEvent.click(await screen.findByText(closedOrder.title));
    expect(screen.getByTestId("where")).toHaveTextContent('/coordinator/orders/g1|{"backTo":"/a/farmers/ongoing"}');
  });

  it("draws a sent form as a plain row that does not press", async () => {
    renderOngoing(doneOf(page([sentForm])));
    await openDone();
    const row = (await screen.findByText(sentForm.title)).closest(".row") as HTMLElement;
    expect(row.tagName).toBe("DIV");
    expect(screen.queryByRole("button", { name: /Group fertilizer order/ })).not.toBeInTheDocument();
  });

  it("says Nothing finished yet in a card with no button when nothing has finished", async () => {
    renderOngoing(doneOf(page([])));
    await openDone();
    const line = await screen.findByText("Nothing finished yet");
    expect(line.closest("section")).toHaveClass("empty");
    expect(within(line.closest("section") as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the loading card while the first page is on its way", async () => {
    renderOngoing({ read: () => new Promise<DonePage>(() => undefined) });
    await openDone();
    expect(await screen.findByText("Loading")).toHaveAttribute("role", "status");
  });

  it("says the finished tasks could not be loaded when every read fails, and reads again on Try again", async () => {
    const done = doneOf(new Error("down"), page([closedOrder]));
    renderOngoing(done);
    await openDone();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your finished tasks could not be loaded.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(closedOrder.title)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(done.read).toHaveBeenCalledTimes(2);
  });

  it("shows what loaded and says some could not when one source failed, and reads that source again on Try again", async () => {
    const cursor = { sentSteps: "" } as any;
    const done = doneOf(page([closedOrder], { failed: ["sentSteps"], next: cursor }), page([closedOrder, sentForm]));
    renderOngoing(done);
    await openDone();
    expect(await screen.findByText(closedOrder.title)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Some of your finished tasks could not be loaded.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(sentForm.title)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(done.read).toHaveBeenLastCalledWith(cursor);
  });

  it("offers Show more when there is a next page, adds its rows and keeps the whole list newest first", async () => {
    const cursor = { sentSteps: "r1" } as any;
    const older: DoneItem = { ...sentForm, id: "form-r0", title: "Older form", endedAt: "2026-09-01T12:00:00Z" };
    const between: DoneItem = { ...calledOff, id: "order-g3", title: "Between order", endedAt: "2026-11-01T12:00:00Z" };
    const done = doneOf(page([closedOrder, older], { next: cursor }), page([between]));
    renderOngoing(done);
    await openDone();
    await screen.findByText(closedOrder.title);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    await screen.findByText("Between order");
    expect(done.read).toHaveBeenLastCalledWith(cursor);
    const titles = Array.from(document.querySelectorAll(".rows .row .ttl")).map((title) => title.textContent);
    expect(titles).toEqual(["Urea 50kg", "Between order", "Older form"]);
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("offers no Show more on the last page", async () => {
    renderOngoing(doneOf(page([closedOrder])));
    await openDone();
    await screen.findByText(closedOrder.title);
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("goes back to Live and shows the live list again", async () => {
    renderOngoing(doneOf(page([closedOrder])));
    await openDone();
    await screen.findByText(closedOrder.title);
    await userEvent.click(screen.getByRole("button", { name: "Live" }));
    expect(await screen.findByText("Nothing ongoing yet")).toBeInTheDocument();
    expect(screen.queryByText(closedOrder.title)).not.toBeInTheDocument();
  });
});
