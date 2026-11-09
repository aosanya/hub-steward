import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import type { Answer, FormsClient } from "./api";
import { FormsProvider } from "./context";
import { forgetOpenAgency, openAgency } from "../agency/open";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const fake = (over: Partial<FormsClient> = {}): FormsClient => ({
  waiting: async () => [],
  answered: async () => [],
  standing: async () => [],
  questions: async () => [],
  submit: async () => {},
  ...over,
});

const at = (path: string, client: FormsClient) =>
  render(
    <FormsProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </FormsProvider>,
  );

describe("forms list", () => {
  it("shows loading then empty states", async () => {
    at("/a/farmers/forms", fake());
    expect(screen.getByText("Loading forms")).toBeInTheDocument();
    expect(await screen.findByText("Nothing is waiting for you")).toBeInTheDocument();
  });

  it("lists waiting and answered forms", async () => {
    at(
      "/a/farmers/forms",
      fake({
        waiting: async () => [{ form_id: "f1", title: "Access needs", closes_at: "2026-11-01T00:00:00Z", questions: 2, answered: false, unanswered_as: [] }],
        answered: async () => [{ send_id: "s1", form_id: "f0", title: "Welcome form", closes_at: "", open: true, answered_at: "2026-10-01T10:00:00Z" }],
      }),
    );
    expect(await screen.findByRole("button", { name: /Access needs/ })).toHaveTextContent("2 questions, closes 2026-11-01");
    await userEvent.click(screen.getByRole("button", { name: "Answered · 1" }));
    expect(await screen.findByText("Welcome form")).toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    at("/a/farmers/forms", fake({ waiting: async () => { throw new Error("x"); } }));
    expect(await screen.findByText("Forms could not be loaded")).toBeInTheDocument();
  });
});

describe("forms lists announce their state", () => {
  it("announces the waiting list loading as a status in an empty card", () => {
    at("/a/farmers/forms", fake({ waiting: () => new Promise(() => {}) }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading forms");
    expect(status.closest(".card")).toHaveClass("empty");
  });

  it("announces the waiting list failing as an alert in an empty card", async () => {
    at("/a/farmers/forms", fake({ waiting: async () => { throw new Error("x"); } }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Forms could not be loaded");
    expect(alert.closest(".card")).toHaveClass("empty");
  });

  it("announces the answered list loading as a status in an empty card", async () => {
    at("/a/farmers/forms", fake({ answered: () => new Promise(() => {}) }));
    await userEvent.click(await screen.findByRole("button", { name: "Answered" }));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading answered forms");
    expect(status.closest(".card")).toHaveClass("empty");
  });

  it("announces the answered list failing as an alert in an empty card", async () => {
    at("/a/farmers/forms", fake({ answered: async () => { throw new Error("x"); } }));
    await userEvent.click(await screen.findByRole("button", { name: "Answered" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Answered forms could not be loaded");
    expect(alert.closest(".card")).toHaveClass("empty");
  });
});

describe("nothing waiting", () => {
  it("carries its act, which switches to Answered", async () => {
    at("/a/farmers/forms", fake({ answered: async () => [{ send_id: "s1", form_id: "f0", title: "Water levy", closes_at: "", open: true, answered_at: "2026-10-12T10:00:00Z" }] }));
    expect(await screen.findByText("New forms from your groups show up here and on Home.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "See what you answered" }));
    expect(await screen.findByText("Water levy")).toBeInTheDocument();
  });
});

describe("answered forms", () => {
  const sent = (id: string, title: string, open: boolean, answered_at: string) => ({ send_id: id, form_id: `f-${id}`, title, closes_at: "", open, answered_at });
  const answeredClient = () =>
    fake({
      answered: async () => [
        sent("s1", "Water levy 2026", true, "2026-10-12T10:00:00Z"),
        sent("s2", "Welcome form", false, "2026-10-01T10:00:00Z"),
        sent("s3", "Clean-up day", true, "2026-10-14T10:00:00Z"),
      ],
    });
  const openAnswered = async () => {
    at("/a/farmers/forms", answeredClient());
    await userEvent.click(await screen.findByRole("button", { name: "Answered · 2" }));
  };

  it("lists only the open forms she answered, newest first, with no chip", async () => {
    await openAnswered();
    const rows = await screen.findAllByRole("button", { name: /Water levy 2026|Clean-up day/ });
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining("Clean-up day"), expect.stringContaining("Water levy 2026")]);
    expect(screen.queryByText("Welcome form")).not.toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();
    expect(screen.queryByText("Closed")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Every form you answered" })).toBeInTheDocument();
  });

  it("opens every form she answered, with the Closed chip, behind the button", async () => {
    await openAnswered();
    await userEvent.click(await screen.findByRole("button", { name: "Every form you answered" }));
    expect(await screen.findByText("Welcome form")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getAllByText("Open")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Every form you answered" })).not.toBeInTheDocument();
  });

  it("offers the button even when every form she answered is closed", async () => {
    at("/a/farmers/forms", fake({ answered: async () => [sent("s2", "Welcome form", false, "2026-10-01T10:00:00Z")] }));
    await userEvent.click(await screen.findByRole("button", { name: "Answered · 0" }));
    expect(screen.queryByText("Welcome form")).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Every form you answered" }));
    expect(await screen.findByText("Welcome form")).toBeInTheDocument();
  });

  it("says None of the forms you answered is open in an empty card, not the nothing-answered line, when every one is closed", async () => {
    at("/a/farmers/forms", fake({ answered: async () => [sent("s2", "Welcome form", false, "2026-10-01T10:00:00Z")] }));
    await userEvent.click(await screen.findByRole("button", { name: "Answered · 0" }));
    expect(screen.getByText("None of the forms you answered is open").closest(".card")).toHaveClass("empty");
    expect(screen.queryByText("You have not answered any form yet")).not.toBeInTheDocument();
  });

  it("shows no button when she has answered nothing", async () => {
    at("/a/farmers/forms", fake());
    await userEvent.click(await screen.findByRole("button", { name: "Answered" }));
    expect((await screen.findByText("You have not answered any form yet")).closest(".card")).toHaveClass("empty");
    expect(screen.queryByText("None of the forms you answered is open")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Every form you answered" })).not.toBeInTheDocument();
  });
});

describe("standing forms", () => {
  it("lists them under Ask for something", async () => {
    at("/a/farmers/forms", fake({ standing: async () => [{ form_id: "s1", title: "Ask for a delivery", landing: "thread" }] }));
    expect(await screen.findByText("Ask for something")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ask for a delivery/ })).toHaveTextContent("Open any time");
  });

  it("shows no section when there are none", async () => {
    at("/a/farmers/forms", fake());
    await screen.findByText("Nothing is waiting for you");
    expect(screen.queryByText("Ask for something")).not.toBeInTheDocument();
  });

  it("opens the thread after a standing send, one answer per line", async () => {
    const delivery = async () => [
      { id: "q1", prompt: "Pickup", answer_type: "free_text", required: true, options: [] },
      { id: "q2", prompt: "Destination", answer_type: "free_text", required: true, options: [] },
    ];
    at("/a/farmers/forms", fake({ standing: async () => [{ form_id: "s1", title: "Ask for a delivery", landing: "thread" }], questions: delivery }));
    await userEvent.click(await screen.findByRole("button", { name: /Ask for a delivery/ }));
    await userEvent.type(await screen.findByLabelText("Pickup"), "Market gate");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.type(await screen.findByLabelText("Destination"), "Siaya hospital");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Submit" }));
    const sub = await screen.findByText("Your thread · with the agent");
    const title = screen.getByRole("heading", { level: 1, name: "Ask for a delivery" });
    expect(title.nextElementSibling).toBe(sub);
    expect(screen.getByRole("banner")).not.toContainElement(title);
    expect(screen.getByText("Pickup: Market gate")).toBeInTheDocument();
    expect(screen.getByText("Destination: Siaya hospital")).toBeInTheDocument();
  });
});

describe("answering a form", () => {
  const questions = async () => [
    { id: "q1", prompt: "What do you need", answer_type: "free_text", required: true, options: [] },
    { id: "q2", prompt: "Which days", answer_type: "multi_select", required: false, options: [{ id: "o1", label: "Monday" }, { id: "o2", label: "Tuesday" }] },
  ];

  beforeEach(() => window.localStorage.clear());

  it("goes question by question to Review, refuses a missing required answer, and sends without a member id", async () => {
    const submit = vi.fn(async (_id: string, _answers: Answer[]) => {});
    at("/a/farmers/forms/f1", fake({ questions, submit }));
    expect(await screen.findByText("Question 1 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("This question needs an answer")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("What do you need"), "A ramp");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Question 2 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Tuesday"));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("1 · What do you need")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toBe("f1");
    expect(submit.mock.calls[0][1]).toEqual([
      { question_id: "q1", value_text: "A ramp" },
      { question_id: "q2", option_ids: ["o2"] },
    ]);
    expect(JSON.stringify(submit.mock.calls[0])).not.toContain("member_id");
    expect(await screen.findByText("Your answers were sent")).toBeInTheDocument();
  });

  it("titles Review under the bar and names the form as its sub line", async () => {
    at(
      "/a/farmers/forms",
      fake({
        questions,
        waiting: async () => [{ form_id: "f1", title: "Inputs I need", closes_at: "2026-11-01T00:00:00Z", questions: 2, answered: false, unanswered_as: [] }],
      }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /Inputs I need/ }));
    await userEvent.type(await screen.findByLabelText("What do you need"), "A ramp");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    const title = await screen.findByRole("heading", { level: 1, name: "Review" });
    expect(screen.getByRole("banner")).not.toContainElement(title);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(title.nextElementSibling).toHaveTextContent("Inputs I need");
  });

  it("lets Edit on Review go back to that question", async () => {
    at("/a/farmers/forms/f1", fake({ questions }));
    await userEvent.type(await screen.findByLabelText("What do you need"), "A ramp");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: /1 · What do you need/ }));
    expect(await screen.findByLabelText("What do you need")).toHaveValue("A ramp");
  });

  it("keeps the answers on the device", async () => {
    const first = at("/a/farmers/forms/f1", fake({ questions }));
    await userEvent.type(await screen.findByLabelText("What do you need"), "A ramp");
    first.unmount();
    at("/a/farmers/forms/f1", fake({ questions }));
    expect(await screen.findByLabelText("What do you need")).toHaveValue("A ramp");
  });

  it("sends yes or no, a number, a date and a single choice in their own fields", async () => {
    const mixed = async () => [
      { id: "a", prompt: "Wheelchair user", answer_type: "yes_no", required: true, options: [] },
      { id: "b", prompt: "Visitors", answer_type: "number", required: true, options: [] },
      { id: "c", prompt: "Day", answer_type: "date", required: true, options: [] },
      { id: "d", prompt: "Terminal", answer_type: "single_choice", required: true, options: [{ id: "t1", label: "One" }, { id: "t2", label: "Two" }] },
    ];
    const submit = vi.fn(async (_id: string, _answers: Answer[]) => {});
    at("/a/farmers/forms/f2", fake({ questions: mixed, submit }));
    await userEvent.click(await screen.findByLabelText("Yes"));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.type(await screen.findByLabelText("Visitors"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(await screen.findByLabelText("Day"), { target: { value: "2026-11-02" } });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByLabelText("Two"));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][1]).toEqual([
      { question_id: "a", value_bool: true },
      { question_id: "b", value_number: 3 },
      { question_id: "c", value_date: "2026-11-02" },
      { question_id: "d", option_ids: ["t2"] },
    ]);
  });

  it("sends a photo and a file as file_ids, and a required one blocks Next until chosen", async () => {
    const pictures = async () => [
      { id: "p", prompt: "The broken light", answer_type: "photo", required: true, options: [] },
      { id: "f", prompt: "Your receipt", answer_type: "file", required: false, options: [] },
    ];
    const submit = vi.fn(async (_id: string, _answers: Answer[]) => {});
    at("/a/farmers/forms/f3", fake({ questions: pictures, submit }));
    const photo = await screen.findByLabelText("The broken light");
    expect(photo).toHaveAttribute("type", "file");
    expect(photo).toHaveAttribute("accept", "image/*");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("This question needs an answer")).toBeInTheDocument();
    await userEvent.upload(photo, new File(["x"], "light.jpg", { type: "image/jpeg" }));
    expect(screen.getByText("light.jpg")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const receipt = await screen.findByLabelText("Your receipt");
    expect(receipt).not.toHaveAttribute("accept");
    await userEvent.upload(receipt, new File(["x"], "receipt.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("button", { name: /1 · The broken light/ })).toHaveTextContent("light.jpg");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][1]).toEqual([
      { question_id: "p", file_ids: ["light.jpg"] },
      { question_id: "f", file_ids: ["receipt.pdf"] },
    ]);
  });

  it("says so when sending fails", async () => {
    at("/a/farmers/forms/f1", fake({ questions, submit: async () => { throw new Error("x"); } }));
    await userEvent.type(await screen.findByLabelText("What do you need"), "A ramp");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Your answers could not be sent. Try again.")).toBeInTheDocument();
  });
});

describe("sender on a waiting row", () => {
  const base = { closes_at: "2026-11-01T00:00:00Z", questions: 4, answered: false, unanswered_as: [] };

  it("names the authority, else the publisher, else nothing", async () => {
    at(
      "/a/farmers/forms",
      fake({
        waiting: async () => [
          { ...base, form_id: "a", title: "Borehole contribution", publishing_authority: "Treasurer, Kilimani Ward", publisher_name: "Wanjiru Kamau" },
          { ...base, form_id: "b", title: "Burial fund pledge", publisher_name: "Otieno Achieng" },
          { ...base, form_id: "c", title: "Plain form" },
        ],
      }),
    );
    expect(await screen.findByRole("button", { name: /Borehole contribution/ })).toHaveTextContent("Treasurer, Kilimani Ward4 questions, closes 2026-11-01");
    expect(screen.getByRole("button", { name: /Burial fund pledge/ })).toHaveTextContent("Otieno Achieng4 questions");
    expect(screen.getByRole("button", { name: /Plain form/ })).toHaveTextContent(/^Plain form4 questions, closes 2026-11-01/);
  });
});

describe("forms list drafts and grouping", () => {
  const w = (id: string, title: string, closes_at: string) => ({ form_id: id, title, closes_at, questions: 12, answered: false, unanswered_as: [] });

  it("marks a form with a draft kept on the device", async () => {
    window.localStorage.setItem("hs-form-draft-d1", JSON.stringify({ q1: { text: "yes", options: [] }, q2: { text: "", options: ["a"] }, q3: { text: " ", options: [] } }));
    at("/a/farmers/forms", fake({ waiting: async () => [w("d1", "Borehole pledge", "2026-11-01T00:00:00Z"), w("d2", "Plain form", "2026-11-02T00:00:00Z")] }));
    expect(await screen.findByText("Draft · 2 of 12")).toBeInTheDocument();
    expect(screen.getAllByText("New")).toHaveLength(1);
    window.localStorage.clear();
  });

  it("groups by closing date, soonest first", async () => {
    const day = 24 * 60 * 60 * 1000;
    const at2 = (n: number) => new Date(Date.now() + n * day).toISOString();
    at("/a/farmers/forms", fake({ waiting: async () => [w("a", "Far form", at2(30)), w("b", "Near form", at2(2))] }));
    await screen.findByText("Near form");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Closes this week", "Later"]);
  });
});

describe("photo limits and capture", () => {
  beforeEach(() => window.localStorage.clear());

  it("opens the camera for a require_capture photo and says so", async () => {
    const q = async () => [{ id: "p", prompt: "The broken light", answer_type: "photo", required: true, require_capture: true, options: [] }];
    at("/a/farmers/forms/c1", fake({ questions: q }));
    const input = await screen.findByLabelText("The broken light");
    expect(input).toHaveAttribute("capture", "environment");
    expect(input).not.toHaveAttribute("multiple");
    expect(screen.getByText("Take this photo now with the camera")).toBeInTheDocument();
  });

  it("takes up to max_files files, sends each as a file id, and refuses more", async () => {
    const q = async () => [{ id: "p", prompt: "Photos of the damage", answer_type: "photo", required: true, max_files: 2, options: [] }];
    const submit = vi.fn(async (_id: string, _answers: Answer[]) => {});
    at("/a/farmers/forms/c2", fake({ questions: q, submit }));
    const input = await screen.findByLabelText("Photos of the damage");
    expect(input).toHaveAttribute("multiple");
    expect(input).not.toHaveAttribute("capture");
    expect(screen.getByText("Up to 2 files")).toBeInTheDocument();
    const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });
    await userEvent.upload(input, [file("a.jpg"), file("b.jpg"), file("c.jpg")]);
    expect(await screen.findByText("Choose at most 2 files")).toBeInTheDocument();
    expect(screen.queryByText("c.jpg")).not.toBeInTheDocument();
    await userEvent.upload(input, [file("a.jpg"), file("b.jpg")]);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("button", { name: /1 · Photos of the damage/ })).toHaveTextContent("a.jpg, b.jpg");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][1]).toEqual([{ question_id: "p", file_ids: ["a.jpg", "b.jpg"] }]);
  });
});
