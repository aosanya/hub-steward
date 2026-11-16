import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartRows } from "../../home/StartRows";
import { NotificationsPage } from "../../pages/NotificationsPage";
import { TabBar } from "../../ui/TabBar";
import * as mcp from "../../wakala/mcp";
import { mcpStartClient, type StartStep } from "./api";

const checkDelivery = {
  id: "s9",
  title: "Check the delivery",
  kind: "fill_form",
  state: "waiting",
  order_id: "o1",
  record_code: "delivery",
  role_name: "Store keeper",
  form_name: "Delivery check",
  workflow_name: "Receive stock",
  questions: [{ prompt: "Bags received", answer_type: "number", helper: "" }],
};

const startable = { ...checkDelivery, id: "s1", title: "Report a problem", state: "start", order_id: undefined, form_name: "Problem report" };

const createGroupOrder = {
  id: "g1",
  title: "Start the urea group order",
  kind: "fill_form",
  state: "start",
  role_name: "Group coordinator",
  form_name: "Create group order",
  questions: [
    { prompt: "Product", answer_type: "free_text", helper: "" },
    { prompt: "Price a bag", answer_type: "currency", helper: "" },
    { prompt: "Minimum bags", answer_type: "number", helper: "" },
  ],
};

const world = (available: unknown[] | Error, open: unknown[] = []) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string, args: Record<string, unknown> = {}) => {
    switch (tool) {
      case "agency_list_my_open_steps":
        if (args.available === true) {
          if (available instanceof Error) throw available;
          return { items: available };
        }
        return { items: open };
      case "agency_get_agency":
        return { name: "Siaya Farmers' Group" };
      case "comm_notification_list":
      case "actor_list_my_invitations":
        return { items: [] };
      default:
        throw new Error(`no answer for ${tool}`);
    }
  }) as never);

const Where = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
};

const openNotifications = () =>
  render(
    <MemoryRouter>
      <TabBar />
      <Where />
      <Routes>
        <Route path="/" element={<NotificationsPage />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe("the steps that wait on the member, read from the hub", () => {
  it("waiting lists a step the hub says waits on her, with the run it belongs to", async () => {
    const call = world([startable, checkDelivery]);
    const steps = await mcpStartClient.waiting();
    expect(steps.map((s) => [s.id, s.orderId])).toEqual([["s9", "o1"]]);
    expect(steps[0]).toMatchObject({ title: "Check the delivery", formName: "Delivery check", roleName: "Store keeper", agencyName: "Siaya Farmers' Group" });
    expect(call).toHaveBeenCalledWith("", "agency_list_my_open_steps", { available: true });
  });

  it("waiting keeps the group order start, which the Start tab lists, beside the waiting steps", async () => {
    world([createGroupOrder, checkDelivery], [createGroupOrder]);
    const steps = await mcpStartClient.waiting();
    expect(steps.map((s) => s.id)).toEqual(["g1", "s9"]);
  });

  it("waiting fails when the hub cannot say which steps wait on her", async () => {
    world(new Error("down"), [createGroupOrder]);
    await expect(mcpStartClient.waiting()).rejects.toThrow("down");
  });
});

describe("Needs you on a fresh session", () => {
  it("lists the waiting step, counts it on the bell and opens its step page with the run", async () => {
    world([startable, checkDelivery]);
    openNotifications();
    const row = (await screen.findByText("Check the delivery")).closest(".row") as HTMLElement;
    expect(row).toHaveTextContent("Siaya Farmers' Group · Store keeper");
    await waitFor(() => expect(screen.getAllByLabelText("1 thing to do").length).toBeGreaterThan(0));
    expect(screen.queryByText("Report a problem")).toBeNull();
    await userEvent.click(screen.getByText("Check the delivery"));
    expect(screen.getByTestId("where")).toHaveTextContent("/steps/s9?order=o1");
  });

  it("does not list or count the Create group order start", async () => {
    world([createGroupOrder], [createGroupOrder]);
    openNotifications();
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.queryByLabelText(/things? to do/)).toBeNull();
  });
});

describe("the Start tab", () => {
  it("does not list a waiting step as a start", async () => {
    const waiting: StartStep = { id: "s9", title: "Check the delivery", formName: "Delivery check", roleName: "Store keeper", workflowName: "", agencyName: "", questions: [], orderId: "o1" };
    const start = { openSteps: async () => [], waiting: async () => [waiting] };
    render(
      <MemoryRouter>
        <StartRows start={start} steps={{ available: async () => [] }} forms={{ waiting: async () => [], answered: async () => [] }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.queryByText("Loading your tasks")).toBeNull());
    expect(screen.queryByText("Delivery check")).toBeNull();
  });
});
