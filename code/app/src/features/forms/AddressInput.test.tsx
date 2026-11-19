import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { callTool } from "../../shared/wakala/mcp";
import type { FormQuestion } from "./api";
import { QuestionInput } from "./QuestionInput";

vi.mock("../../shared/wakala/mcp", () => ({ callTool: vi.fn() }));

const mocked = callTool as any;

const addresses = [
  { id: "a1", street: "Fő tér", number: "2", area: "Óváros" },
  { id: "a2", street: "Fő tér", number: "7", area: "Óváros" },
  { id: "a3", street: "Malomsor utca", number: "9", area: "Malomsor" },
];

const question = (over: Partial<FormQuestion> = {}): FormQuestion => ({ id: "q1", prompt: "Which street needs to be closed?", answer_type: "address", required: true, options: [], ...over });

const empty = { text: "", options: [] as string[] };

describe("an address question", () => {
  beforeEach(() => {
    mocked.mockReset();
    mocked.mockImplementation(async (_hub: string, tool: string) => (tool === "digitaltwin_address_list" ? { items: addresses } : { items: [] }));
  });

  it("offers each street once and each address, by name", async () => {
    render(<QuestionInput q={question()} value={empty} onChange={vi.fn()} />);
    expect(await screen.findByRole("radio", { name: "Fő tér" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Fő tér" })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Fő tér 2" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Fő tér 7" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Malomsor utca" })).toBeInTheDocument();
    expect(screen.queryByText("a1")).not.toBeInTheDocument();
  });

  it("answers with the words and a reference to the picked address", async () => {
    const onChange = vi.fn();
    render(<QuestionInput q={question()} value={empty} onChange={onChange} />);
    await userEvent.click(await screen.findByRole("radio", { name: "Fő tér 2" }));
    expect(onChange).toHaveBeenCalledWith({ text: "Fő tér 2", placeRef: "address:a1" });
  });

  it("answers with the words and a reference to a picked street", async () => {
    const onChange = vi.fn();
    render(<QuestionInput q={question()} value={empty} onChange={onChange} />);
    await userEvent.click(await screen.findByRole("radio", { name: "Fő tér" }));
    expect(onChange).toHaveBeenCalledWith({ text: "Fő tér", placeRef: "street:Fő tér" });
  });

  it("narrows the list as the search is typed", async () => {
    render(<QuestionInput q={question()} value={empty} onChange={vi.fn()} />);
    await screen.findByRole("radio", { name: "Fő tér" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search streets and addresses" }), { target: { value: "malom" } });
    expect(screen.queryByRole("radio", { name: "Fő tér" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Malomsor utca" })).toBeInTheDocument();
  });

  it("marks the picked place", async () => {
    render(<QuestionInput q={question()} value={{ text: "Fő tér 7", options: [], placeRef: "address:a2" }} onChange={vi.fn()} />);
    expect(await screen.findByRole("radio", { name: "Fő tér 7" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Fő tér 2" })).not.toBeChecked();
  });

  it("has no free text box unless the question allows it", async () => {
    render(<QuestionInput q={question()} value={empty} onChange={vi.fn()} />);
    await screen.findByRole("radio", { name: "Fő tér" });
    expect(screen.queryByRole("textbox", { name: "Something else" })).not.toBeInTheDocument();
  });

  it("takes free text beside the list where the question allows it, with no reference", async () => {
    const onChange = vi.fn();
    render(<QuestionInput q={question({ allow_free_text: true })} value={empty} onChange={onChange} />);
    await screen.findByRole("radio", { name: "Fő tér" });
    fireEvent.change(screen.getByRole("textbox", { name: "Something else" }), { target: { value: "the car park behind the mill" } });
    expect(onChange).toHaveBeenLastCalledWith({ text: "the car park behind the mill", placeRef: "" });
  });

  it("says so when the town's places cannot be read, and still takes free text where allowed", async () => {
    mocked.mockRejectedValue(new Error("no"));
    render(<QuestionInput q={question({ allow_free_text: true })} value={empty} onChange={vi.fn()} />);
    expect(await screen.findByText("The streets and addresses could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Something else" })).toBeInTheDocument();
  });
});
