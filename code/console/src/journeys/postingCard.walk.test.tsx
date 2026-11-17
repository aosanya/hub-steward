import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import words from "../../public/i18n.json";
import { I18nProvider } from "../i18n";
import { PostingStepCard } from "../pages/calcstep/PostingStepCard";
import type { Posting } from "../pages/calcstep/postingSentence";
import { savePage } from "./walkShot";

const results = [{ key: "pmt", name: "Monthly payment", step: "Work out the monthly payment" }];
const accounts = [
  { id: "loans", name: "Member loans" },
  { id: "savings", name: "Member savings" },
  { id: "cash", name: "Cash" },
];
const start: Posting = { amount: "", account: "", otherSide: "", direction: "credit", reason: "" };

function Step() {
  const [value, setValue] = useState(start);
  return <PostingStepCard title="Post the payment" results={results} accounts={accounts} value={value} onChange={setValue} sample="564.88" />;
}

describe("a builder sets up the step that posts the monthly payment", () => {
  it("chooses the amount, both accounts, the direction and a reason, and reads the posting back as a sentence", async () => {
    const { container } = render(
      <I18nProvider initial={words}>
        <Step />
      </I18nProvider>,
    );
    expect(screen.getByText("Choose the amount, both accounts and a reason to read the posting back.")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Amount" }), "pmt");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Account" }), "loans");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Other side" }), "cash");
    await userEvent.click(screen.getByRole("radio", { name: "Credit Member loans" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Reason" }), "Loan payment for the month");
    expect(screen.getByText(/^Credits Member loans and debits Cash by the Monthly payment\./)).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "What it does" }).closest("section") as HTMLElement;
    expect(within(card).getByText("564.88 on the sample")).toBeInTheDocument();
    if (process.env.WALK_SHOTS) savePage(container, process.env.WALK_SHOTS, "posting-card.html");
  });
});
