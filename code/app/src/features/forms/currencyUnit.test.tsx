import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as mcp from "../../shared/wakala/mcp";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import type { FormQuestion } from "./api";
import { QuestionInput } from "./QuestionInput";
import { toAnswer } from "./answers";

const question = (answer_type: string): FormQuestion => ({ id: "q1", prompt: "Amount awarded", answer_type, required: true, options: [] });

const mountsWith = (words: Record<string, string>) => ({ modules: [{ module: "accounting", mounts: [{ name: "Finance", key: "finance", words }] }] });

const agencyNaming = (words: Record<string, string>) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => (name === "agency_list_mounts" ? mountsWith(words) : {}));

const shownFor = (q: FormQuestion, text = "") =>
  render(<QuestionInput q={q} value={{ text, options: [] }} onChange={() => {}} />);

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("currency question", () => {
  it("shows the currency its agency names after the input", async () => {
    const asked = agencyNaming({ Currency: "EUR" });
    const { container } = shownFor(question("currency"));
    const unit = await screen.findByText("EUR");
    const input = container.querySelector("input")!;
    expect(input.compareDocumentPosition(unit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(asked).toHaveBeenCalledWith("", "agency_list_mounts", {});
  });

  it("shows Ft only in an agency that names Ft", async () => {
    agencyNaming({ Currency: "Ft" });
    shownFor(question("currency"));
    expect(await screen.findByText("Ft")).toBeInTheDocument();
  });

  it("shows no unit while the agency names no currency", async () => {
    const asked = agencyNaming({});
    const { container } = shownFor(question("currency"));
    await waitFor(() => expect(asked).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector(".unit")).toBeNull());
    expect(screen.queryByText("Ft")).not.toBeInTheDocument();
  });

  it("shows no Ft when the agency cannot be read", async () => {
    const asked = vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("down"));
    const { container } = shownFor(question("currency"));
    await waitFor(() => expect(asked).toHaveBeenCalled());
    expect(container.querySelector(".unit")).toBeNull();
    expect(screen.queryByText("Ft")).not.toBeInTheDocument();
  });

  it("shows no unit for a number question", async () => {
    agencyNaming({ Currency: "EUR" });
    shownFor(question("number"));
    await waitFor(() => expect(screen.queryByText("EUR")).not.toBeInTheDocument());
  });

  it("sends 4800000 as value_number", () => {
    const q = question("currency");
    expect(toAnswer(q, { q1: { text: "4800000", options: [] } })).toEqual({ question_id: "q1", value_number: 4800000 });
  });
});
