import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplyPage } from "../pages/supply/ApplyPage";
import * as mcp from "../wakala/mcp";
import { leaderNames, mcpSupplyClient, waitingWords, type Supplier, type SupplyClient } from "./api";

const applicant = (status: string, approvedByName = ""): Supplier => ({
  id: "p1",
  shop: "Kisumu Agro Supplies",
  area: "Kisumu",
  sells: "Fertiliser and seed",
  owner: "m1",
  status,
  approvedBy: "",
  ownerName: "",
  approvedByName,
});

const clientOf = (supplier: Supplier, coordinators?: () => Promise<string[]>): SupplyClient => ({
  listSuppliers: vi.fn().mockResolvedValue([supplier]),
  applySupplier: vi.fn(),
  listOffers: vi.fn().mockResolvedValue([]),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
  listCoordinators: coordinators,
});

const show = (client: SupplyClient) =>
  render(
    <MemoryRouter>
      <ApplyPage client={client} me="m1" />
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe("a waiting application names who it waits for", () => {
  it("shows Waiting for the leader the tool names", async () => {
    show(clientOf(applicant("pending"), async () => ["Grace Adhiambo"]));
    expect(await screen.findByText("Waiting for Grace Adhiambo")).toBeInTheDocument();
  });

  it("names every leader when a group has several", async () => {
    show(clientOf(applicant("pending"), async () => ["Grace Adhiambo", "Peter Mwangi"]));
    expect(await screen.findByText("Waiting for Grace Adhiambo, Peter Mwangi")).toBeInTheDocument();
  });

  it("waits without a name when no leader is returned", async () => {
    show(clientOf(applicant("pending"), async () => []));
    expect(await screen.findByText("Waiting on the group coordinator")).toBeInTheDocument();
  });

  it("waits without a name when the leaders could not be read", async () => {
    show(clientOf(applicant("pending"), () => Promise.reject(new Error("down"))));
    expect(await screen.findByText("Waiting on the group coordinator")).toBeInTheDocument();
  });

  it("does not ask for leaders once the supplier is approved", async () => {
    const coordinators = vi.fn().mockResolvedValue(["Grace Adhiambo"]);
    show(clientOf(applicant("approved", "Grace Adhiambo"), coordinators));
    expect(await screen.findByText("You are approved as a supplier")).toBeInTheDocument();
    expect(coordinators).not.toHaveBeenCalled();
  });
});

describe("reading the coordinators", () => {
  it("asks each of my groups for its leaders and keeps each name once", async () => {
    const call = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
      if (tool === "actor_list_my_groups") return { items: [{ id: "g1" }, { id: "g2" }] };
      if (args.group_id === "g1") return { items: [{ actor_id: "a1", display_name: "Grace Adhiambo" }] };
      return { items: [{ actor_id: "a1", display_name: "Grace Adhiambo" }, { actor_id: "a2", display_name: "Peter Mwangi" }] };
    });
    expect(await mcpSupplyClient.listCoordinators!()).toEqual(["Grace Adhiambo", "Peter Mwangi"]);
    expect(call).toHaveBeenCalledWith("", "actor_list_group_leaders", { group_id: "g1" });
    expect(call).toHaveBeenCalledWith("", "actor_list_group_leaders", { group_id: "g2" });
  });

  it("skips a group whose leaders cannot be read", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
      if (tool === "actor_list_my_groups") return { items: [{ id: "g1" }, { id: "g2" }] };
      if (args.group_id === "g1") throw new Error("no");
      return { items: [{ actor_id: "a2", display_name: "Peter Mwangi" }] };
    });
    expect(await mcpSupplyClient.listCoordinators!()).toEqual(["Peter Mwangi"]);
  });

  it("drops leaders without a display name", () => {
    expect(leaderNames([{ actor_id: "a1", display_name: "" }, { actor_id: "a2" }, null])).toEqual([]);
    expect(waitingWords([])).toBe("Waiting on the group coordinator");
  });
});
