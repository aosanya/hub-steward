import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Profile } from "../account/profile";
import { ApproveInOwnName } from "./ApproveInOwnName";

const profile = (name: string): Profile => ({ name, code: "MUN-1", phone: "" });

const show = async (read: () => Promise<Profile>) => {
  await act(async () => {
    render(<ApproveInOwnName read={read} />);
  });
};

afterEach(cleanup);

describe("the panel above an approval", () => {
  it("says she approves in her own name, with her display name", async () => {
    await show(async () => profile("Anna Kovacs"));
    expect(screen.getByText("You approve this in your own name, as Anna Kovacs.")).toBeInTheDocument();
  });

  it("says the time and her name are recorded with her answer", async () => {
    await show(async () => profile("Anna Kovacs"));
    expect(screen.getByText("The time and your name are recorded with your answer.")).toBeInTheDocument();
  });

  it("shows nothing while the name is loading", async () => {
    let finish: (p: Profile) => void = () => {};
    const { container } = render(<ApproveInOwnName read={() => new Promise<Profile>((resolve) => (finish = resolve))} />);
    expect(container).toBeEmptyDOMElement();
    await act(async () => finish(profile("Anna Kovacs")));
  });

  it("asks her to set her name when it is empty", async () => {
    await show(async () => profile(""));
    expect(screen.getByText("Your name is not set. Add it in your profile before you approve.")).toBeInTheDocument();
    expect(screen.queryByText(/You approve this in your own name/)).not.toBeInTheDocument();
  });
});
