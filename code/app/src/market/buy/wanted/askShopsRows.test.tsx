import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AskShopsPage } from "./AskShopsPage";
import type { WantedClient } from "./api";

const client = {
  listShops: vi.fn().mockResolvedValue([
    { id: "p1", name: "Siaya Farm Stores" },
    { id: "p2", name: "Bondo Agrovet" },
  ]),
} as unknown as WantedClient;

describe("Ask shops", () => {
  it("lists the shops as choice rows under one Shops legend", async () => {
    const { container, findByRole } = render(
      <MemoryRouter initialEntries={["/buy/wanted/r1/ask?what=Maize"]}>
        <Routes>
          <Route path="/buy/wanted/:requestId/ask" element={<AskShopsPage client={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    await findByRole("checkbox", { name: "Bondo Agrovet" });
    expect(container.querySelector("fieldset.field > legend")?.textContent).toBe("Shops");
    expect(Array.from(container.querySelectorAll("fieldset label.row > span.ttl")).map((el) => el.textContent)).toEqual(["Siaya Farm Stores", "Bondo Agrovet"]);
  });
});
