import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookPage } from "./BookPage";
import { arrive, bookAt, bookClientOf, leave } from "./bookFixture";

vi.mock("../../inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

beforeEach(arrive);

afterEach(leave);

describe("the Book for a viewer who may not read the rules", () => {
  it("shows the no-access card and no load failure, no retry and no loading line", async () => {
    bookAt(<BookPage client={bookClientOf({ state: "no_access" })} />);
    expect(await screen.findByText("You do not have access to the rules yet. Ask the Product owner.")).toBeInTheDocument();
    expect(screen.queryByText("The Book could not be loaded.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reads no references when there are no rules to read them for", async () => {
    const client = bookClientOf({ state: "no_access" });
    bookAt(<BookPage client={client} />);
    await screen.findByText("You do not have access to the rules yet. Ask the Product owner.");
    expect(client.refs).not.toHaveBeenCalled();
  });
});
