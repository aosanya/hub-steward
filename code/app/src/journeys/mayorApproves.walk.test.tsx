import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../app/App";
import { doSomethingPathIn, forgetOpenAgency, openAgency } from "../features/agency/open";
import { agenciesFrom, answerWakala } from "./answerWakala";
import * as mcp from "../shared/wakala/mcp";
import { forgetSubject } from "../shared/wakala/me";

type Row = Record<string, any>;

const siaya = { id: "walk-siaya", name: "Siaya Municipality" };
const mayor = { id: "hub-mayor@mwanachama.test", name: "Dr. Kovács Béla" };

const approveStep = {
  id: "s-approve",
  title: "Approve the permit",
  kind: "fill_form",
  role_name: "Mayor",
  form_name: "Permit approval",
  description: "approves it in their own name",
  state: "start",
  approval: true,
  questions: [{ prompt: "Did we complete the step?", answer_type: "yes_no" }],
};

const sentApproval = {
  step_id: "s-approve",
  title: "Approve the permit",
  form_name: "Permit approval",
  workflow_name: "Permit",
  row_id: "r1",
  order_id: "run-1",
  sent_at: "2026-11-13T12:00:00Z",
  answers: { "Approved by": mayor.name, "Approved at": "2026-11-13T12:00:00Z" },
};

const walk = () => {
  const posts: Array<{ url: string; body: Row }> = [];
  const approved = { done: false };
  const reply = async (_hub: string, tool: string): Promise<any> => {
    switch (tool) {
      case "agency_list_instances":
        return { items: [siaya] };
      case "agency_get_agency":
        return { id: siaya.id, name: siaya.name };
      case "agency_list_modules":
        return { items: [{ code: "forms", name: "Forms", enabled: true }] };
      case "agency_get_my_roles":
        return { instance_id: siaya.id, membership: "resident", roles: [] };
      case "actor_get_my_actor":
        return { id: mayor.id, display_name: mayor.name };
      case "agency_list_my_open_steps":
        return { items: approved.done ? [] : [approveStep] };
      case "agency_list_my_sent_steps":
        return { items: approved.done ? [sentApproval] : [] };
      default:
        return { items: [] };
    }
  };
  const base = answerWakala(() => mayor.id, agenciesFrom(reply as any));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (!String(url).endsWith("/answers")) return base(url);
      posts.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      approved.done = true;
      return { ok: true, status: 200, json: async () => ({ done: true }) };
    }),
  );
  vi.spyOn(mcp, "callTool").mockImplementation(reply as any);
  return posts;
};

beforeEach(() => {
  forgetSubject();
  forgetOpenAgency();
  openAgency(siaya.id);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  forgetSubject();
  forgetOpenAgency();
});

describe("the Mayor approves a step in her own name", () => {
  it("opens it from Do something, approves with only the answers, and reads Approved by on the Done list", async () => {
    const posts = walk();
    const first = render(
      <MemoryRouter initialEntries={[doSomethingPathIn(siaya.id)]}>
        <App />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByText(approveStep.form_name));
    expect(await screen.findByText("You approve this in your own name, as Dr. Kovács Béla.")).toBeInTheDocument();
    expect(screen.getByText(approveStep.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /yes/i }));
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toMatch(/\/steps\/s-approve\/answers$/);
    expect(posts[0].body.answers).toEqual({ "Did we complete the step?": "yes" });
    const sent = JSON.stringify(posts[0].body);
    expect(sent).not.toContain("Kovács");
    expect(sent).not.toContain("Approved by");
    expect(sent).not.toContain("2026-11");

    first.unmount();
    render(
      <MemoryRouter initialEntries={[`/a/${siaya.id}/ongoing`]}>
        <App />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(await screen.findByText(/Approved by Dr. Kovács Béla$/)).toBeInTheDocument();
  });
});
