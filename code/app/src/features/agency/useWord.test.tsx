import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useWord } from "./useWord";
import type { AgencyClient, AgencyView } from "./modules";

const listing = (words?: Record<string, string>): AgencyClient => {
  const view: AgencyView = { name: "Zöldhalom", modules: [{ code: "actor", name: "Residents", words }] };
  return { read: async () => view };
};

function Probe({ agency }: { agency: AgencyClient }) {
  const word = useWord("actor", agency);
  return <p>{`${word("People")} / ${word("Person")}`}</p>;
}

describe("useWord", () => {
  it("answers the agency's words once the agency is read", async () => {
    render(<Probe agency={listing({ People: "Residents", Person: "Resident" })} />);
    await waitFor(() => expect(screen.getByText("Residents / Resident")).toBeTruthy());
  });

  it("answers the generic words when the agency lists none", async () => {
    render(<Probe agency={listing()} />);
    expect(screen.getByText("People / Person")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("People / Person")).toBeTruthy());
  });

  it("answers the generic words when the agency cannot be read", async () => {
    render(<Probe agency={{ read: () => Promise.reject(new Error("down")) }} />);
    await waitFor(() => expect(screen.getByText("People / Person")).toBeTruthy());
  });
});
