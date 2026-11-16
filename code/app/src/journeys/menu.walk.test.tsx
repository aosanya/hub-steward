import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agencyTools } from "../features/agency/modules";
import { openAgency, openAgencyId } from "../shared/wakala/openAgency";
import { lateMattersTool } from "../features/council/lateMattersApi";
import { endInAgencies, everyCallNames, openApp, riders, startInAgencies, stubWakala, where } from "./inAgency.test-support";

beforeEach(startInAgencies);

afterEach(endInAgencies);

const heading = (name: string) => screen.findByRole("heading", { name, level: 1 });

const agencyWithFormsAndActor = {
  [agencyTools.agency]: () => ({ name: "Åkerby Cooperative" }),
  [agencyTools.modules]: () => ({ modules: [{ module: "forms", mounts: [] }, { module: "actor", mounts: [] }] }),
  [lateMattersTool]: () => ({
    items: [
      { id: "m1", title: "Broken water main", address: "Fo utca 4", created_at: "2026-10-01T08:00:00Z", department: "Works" },
      { id: "m2", title: "Fallen tree", address: "Kossuth ter 2", created_at: "2026-10-20T08:00:00Z", department: "Parks" },
    ],
  }),
};

const home = `/a/${riders.id}/home`;

const openHome = async () => {
  const world = stubWakala(agencyWithFormsAndActor);
  openAgency(riders.id);
  openApp(home);
  await screen.findByRole("button", { name: /Issues & Requests/ });
  expect(where()).toBe(home);
  return world;
};

describe("menu: a member goes from Home into a section and on to a screen", () => {
  it("opens Issues & Requests, then Overdue, lands on Late matters, goes back to Issues & Requests and returns to Home", async () => {
    const world = await openHome();
    await userEvent.click(screen.getByRole("button", { name: /Issues & Requests/ }));
    await heading("Issues & Requests");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/menu/issues`));
    await userEvent.click(await screen.findByRole("button", { name: /Overdue/ }));
    await heading("Late matters");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/council/late-matters`));
    expect(await screen.findByText("Broken water main")).toBeInTheDocument();
    expect(screen.getByText("Fallen tree")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Issues & Requests/ }));
    await heading("Issues & Requests");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/menu/issues`));
    await userEvent.click(screen.getByRole("link", { name: "Home" }));
    await waitFor(() => expect(where()).toBe(home));
    expect(await screen.findByRole("button", { name: /Services & Permits/ })).toBeInTheDocument();
    expect(world.named(lateMattersTool)).toHaveLength(1);
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });

  it("goes back from a section to Home, then opens Services & Permits and Applications on the Forms list and back to Services & Permits", async () => {
    await openHome();
    await userEvent.click(screen.getByRole("button", { name: /Issues & Requests/ }));
    await heading("Issues & Requests");
    await userEvent.click(screen.getByRole("button", { name: "‹ Home" }));
    await waitFor(() => expect(where()).toBe(home));
    await userEvent.click(await screen.findByRole("button", { name: /Services & Permits/ }));
    await heading("Services & Permits");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/menu/services`));
    await userEvent.click(await screen.findByRole("button", { name: /Applications/ }));
    await heading("Forms");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/forms`));
    await userEvent.click(screen.getByRole("button", { name: /Services & Permits/ }));
    await heading("Services & Permits");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/menu/services`));
  });

  it("shows a row with no screen behind it as text, not as a button", async () => {
    await openHome();
    await userEvent.click(screen.getByRole("button", { name: /Issues & Requests/ }));
    await heading("Issues & Requests");
    expect(await screen.findByText("All Issues")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /All Issues/ })).toBeNull();
    expect(screen.getAllByText("Not available yet").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Overdue/ })).toBeInTheDocument();
  });
});
