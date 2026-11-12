import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import type { StartedAnswer, StartedClient, StartedItem } from "../../started/api";
import { Ongoing } from "./Ongoing";

const urea: StartedItem = {
  id: "s1",
  workflow: "Urea group order",
  title: "Start the urea group order",
  state: "Open",
  waitsOn: "others",
  reason: "3 new farmers joined",
  path: "/start/s1",
};
const supplier: StartedItem = {
  id: "s2",
  workflow: "Apply as a supplier",
  title: "Apply as a supplier",
  state: "Waiting on you",
  waitsOn: "you",
  reason: "Shop changed the price",
  path: "/start/s2",
};

const memberLine = "The app could not tell who you are, so some rows may be missing.";
const sourceLine = "Some of your tasks could not be loaded.";

const clientOf = (items: StartedItem[]): StartedClient => ({ list: async () => items });

const answering = (answer: StartedAnswer): StartedClient => ({
  list: async () => answer.items,
  listWithFailures: async () => answer,
});

const Where = () => {
  const location = useLocation();
  return (
    <output data-testid="where">
      {location.pathname}|{JSON.stringify(location.state)}
    </output>
  );
};

const where = () => screen.getByTestId("where").textContent;

const renderOngoing = (client: StartedClient, onStart: () => void = () => undefined, at = "/do-something") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="*" element={<Ongoing client={client} onStart={onStart} />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

describe("ongoing rows", () => {
  afterEach(() => forgetOpenAgency());

  it("draws no page heading, no navigation and no main of its own", async () => {
    renderOngoing(clientOf([urea]));
    await screen.findByText(urea.title);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("draws one row per item with its workflow, state words and reason", async () => {
    renderOngoing(clientOf([urea, supplier]));
    expect(
      await screen.findByRole("button", { name: "Start the urea group order Urea group order · Open 3 new farmers joined" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply as a supplier Apply as a supplier · Waiting on you Shop changed the price" }),
    ).toBeInTheDocument();
  });

  it("leaves out the separator when an item carries no state", async () => {
    renderOngoing(clientOf([{ ...urea, state: "" }]));
    const row = await screen.findByRole("button", { name: "Start the urea group order Urea group order 3 new farmers joined" });
    expect(row).not.toHaveTextContent("·");
  });

  it("names a row after its workflow when the item has no title", async () => {
    renderOngoing(clientOf([{ ...supplier, title: "", state: "Requested" }]));
    expect(await screen.findByRole("button", { name: "Apply as a supplier Requested Shop changed the price" })).toBeInTheDocument();
  });

  it("leaves out the reason line when an item carries no reason", async () => {
    renderOngoing(clientOf([{ ...urea, reason: "" }]));
    expect(await screen.findByRole("button", { name: "Start the urea group order Urea group order · Open" })).toBeInTheDocument();
  });

  it("opens the path an item points at", async () => {
    renderOngoing(clientOf([urea]));
    await userEvent.click(await screen.findByText(urea.title));
    expect(where()).toMatch(/^\/start\/s1\|/);
  });

  it("opens an item with the path of the page the row sits on as backTo", async () => {
    renderOngoing(clientOf([urea]), undefined, "/a/farmers/do-something");
    await userEvent.click(await screen.findByText(urea.title));
    expect(where()).toBe('/start/s1|{"backTo":"/a/farmers/do-something"}');
  });

  it("gives each row the page it sits on, whichever page that is", async () => {
    renderOngoing(clientOf([supplier]), undefined, "/started-rows");
    await userEvent.click(await screen.findByText(supplier.title));
    expect(where()).toBe('/start/s2|{"backTo":"/started-rows"}');
  });

  it("carries the empty state in a card with Go to Start inside it", async () => {
    renderOngoing(clientOf([]));
    const line = await screen.findByText("Nothing ongoing yet");
    const card = line.closest("section") as HTMLElement;
    expect(card).toHaveClass("empty");
    expect(within(card).getByRole("button", { name: "Go to Start" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onStart once from the empty card and navigates nowhere", async () => {
    const onStart = vi.fn();
    renderOngoing(clientOf([]), onStart, "/do-something");
    await userEvent.click(await screen.findByRole("button", { name: "Go to Start" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(where()).toBe("/do-something|null");
  });

  it("shows only the loading card before the list has answered", async () => {
    renderOngoing({ list: () => new Promise<StartedItem[]>(() => undefined) });
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.queryByText("Nothing ongoing yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces the loading as a status inside the empty card", () => {
    renderOngoing({ list: () => new Promise<StartedItem[]>(() => undefined) });
    const line = screen.getByText("Loading");
    expect(line).toHaveAttribute("role", "status");
    expect(line.closest(".card")).toHaveClass("empty");
  });

  it("clears the loading card once the items arrive", async () => {
    renderOngoing(clientOf([urea]));
    expect(screen.getByText("Loading")).toBeInTheDocument();
    await screen.findByText(urea.title);
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
  });

  it("says the tasks could not be loaded when the list fails", async () => {
    renderOngoing({ list: async () => Promise.reject(new Error("down")) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Your tasks could not be loaded.");
    expect(screen.queryByText("Nothing ongoing yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
    expect(screen.queryByText(/started/i)).not.toBeInTheDocument();
  });

  it("reads the list again when another agency is opened", async () => {
    const list = vi.fn(async () => [urea]);
    const page = () => (
      <MemoryRouter>
        <Ongoing client={{ list }} onStart={() => undefined} />
      </MemoryRouter>
    );
    const { rerender } = render(page());
    await screen.findByText(urea.title);
    openAgency("agency-two");
    rerender(page());
    await screen.findByText(urea.title);
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe("the Live tab", () => {
  afterEach(() => forgetOpenAgency());

  const headingNames = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

  it("puts what waits on her under Needs you above what waits on others under With others", async () => {
    renderOngoing(clientOf([urea, supplier]));
    await screen.findByText(urea.title);
    expect(headingNames()).toEqual(["Needs you", "With others"]);
    const needsYou = screen.getByRole("heading", { name: "Needs you" });
    const withOthers = screen.getByRole("heading", { name: "With others" });
    const waitingOnHer = screen.getByText(supplier.title).closest("button") as HTMLElement;
    const waitingOnOthers = screen.getByText(urea.title).closest("button") as HTMLElement;
    const follows = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(needsYou, waitingOnHer)).toBe(true);
    expect(follows(waitingOnHer, withOthers)).toBe(true);
    expect(follows(withOthers, waitingOnOthers)).toBe(true);
  });

  it("keeps the order the client gave inside a section", async () => {
    const second = { ...supplier, id: "s3", title: "Second one" };
    renderOngoing(clientOf([supplier, urea, second]));
    await screen.findByText(urea.title);
    const needsYou = within(screen.getByRole("heading", { name: "Needs you" }).nextElementSibling as HTMLElement);
    expect(needsYou.getAllByRole("button").map((row) => row.querySelector(".ttl")?.textContent)).toEqual([supplier.title, "Second one"]);
  });

  it("says why each row needs her or what it waits on", async () => {
    renderOngoing(clientOf([urea, supplier]));
    const needsYou = within((await screen.findByRole("heading", { name: "Needs you" })).nextElementSibling as HTMLElement);
    const withOthers = within(screen.getByRole("heading", { name: "With others" }).nextElementSibling as HTMLElement);
    expect(needsYou.getByText("Shop changed the price")).toBeInTheDocument();
    expect(withOthers.getByText("3 new farmers joined")).toBeInTheDocument();
  });

  it("draws no Needs you heading when nothing waits on her", async () => {
    renderOngoing(clientOf([urea]));
    await screen.findByText(urea.title);
    expect(headingNames()).toEqual(["With others"]);
  });

  it("draws no With others heading when nothing waits on others", async () => {
    renderOngoing(clientOf([supplier]));
    await screen.findByText(supplier.title);
    expect(headingNames()).toEqual(["Needs you"]);
  });

  it("draws no Done tab and no tab switch while Live is the only tab", async () => {
    renderOngoing(clientOf([urea, supplier]));
    await screen.findByText(urea.title);
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Live" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("still opens a row from either section", async () => {
    renderOngoing(clientOf([urea, supplier]));
    await userEvent.click(await screen.findByText(supplier.title));
    expect(where()).toMatch(/^\/start\/s2\|/);
  });
});

describe("ongoing rows when a source failed", () => {
  afterEach(() => forgetOpenAgency());

  it("says nothing when no source failed", async () => {
    renderOngoing(answering({ items: [urea], failed: [] }));
    await screen.findByText(urea.title);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reads the answer with its failures when the client gives them", async () => {
    renderOngoing(answering({ items: [urea], failed: ["orders"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(sourceLine);
  });

  it("puts one line under the rows when a source other than the member failed", async () => {
    renderOngoing(answering({ items: [urea, supplier], failed: ["orders", "supplier"] }));
    const row = (await screen.findByText(urea.title)).closest("button") as HTMLElement;
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(sourceLine);
    expect(row.compareDocumentPosition(alerts[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Nothing ongoing yet")).not.toBeInTheDocument();
  });

  it("puts the member line under the rows when the member could not be told", async () => {
    renderOngoing(answering({ items: [urea], failed: ["member"] }));
    await screen.findByText(urea.title);
    expect(screen.getByRole("alert")).toHaveTextContent(memberLine);
  });

  it("gives the member line alone when the member and another source failed", async () => {
    renderOngoing(answering({ items: [urea], failed: ["member", "orders"] }));
    await screen.findByText(urea.title);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(memberLine);
  });

  it.each([
    ["orders", sourceLine],
    ["joinRequests", sourceLine],
    ["supplier", sourceLine],
    ["member", memberLine],
  ] as const)("shows the %s line in place of the empty card when there are no rows", async (source, line) => {
    renderOngoing(answering({ items: [], failed: [source] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(line);
    expect(screen.queryByText("Nothing ongoing yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to Start" })).not.toBeInTheDocument();
  });

  it("keeps the empty card when nothing failed and there are no rows", async () => {
    renderOngoing(answering({ items: [], failed: [] }));
    expect(await screen.findByText("Nothing ongoing yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
