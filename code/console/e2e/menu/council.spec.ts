import { test, expect, type Locator } from "@playwright/test";
import { figureAt, openMockup, shoot } from "./helpers/shoot";

const journey = "06-council";
const section = "Council & Decisions";

const expectDrawnLikeTheOthers = async (figure: Locator, backReads: string) => {
  await expect(figure.locator("dt")).toHaveText(["Landing", "Filled by", "Example data"]);
  await expect(figure.locator(".cap-row", { hasText: "Example data" }).locator("dd")).toContainText(/sample/i);
  await expect(figure.locator(".phone .back")).toHaveText(backReads);
  await expect(figure.locator(".phone .tabs")).toHaveAttribute("data-chosen", "home");
};

test("a person goes from Home to Council & Decisions and reads a meeting, then the other four screens", async ({ page }) => {
  await openMockup(page, "menu.html");
  await expect(page.locator(".phone").first().getByText(section)).toBeVisible();
  await shoot(page.locator("figure").first(), journey, "home-lists-council-and-decisions");

  await page.getByRole("link", { name: /Council & Decisions: the Meetings screen/ }).click();
  await page.waitForSelector(".phone");
  await expect(page).toHaveURL(/menu-council\.html$/);

  const meetings = figureAt(page, "s1");
  await expectDrawnLikeTheOthers(meetings, section);
  await expect(meetings.locator(".phone .bar-title")).toHaveText("Meetings");
  const firstMeeting = (await meetings.locator(".phone .row .ttl").first().textContent()) ?? "";
  await shoot(meetings, journey, "meetings-list");

  const meeting = figureAt(page, "mun931");
  await expectDrawnLikeTheOthers(meeting, section);
  await expect(meeting.locator(".phone .bar-title")).toHaveText("Meeting");
  await expect(meeting.locator(".phone .dh")).toHaveText(firstMeeting);
  await expect(meeting.locator(".cap-row", { hasText: "Filled by" }).locator("dd")).toContainText(/no tool/i);
  await shoot(meeting, journey, "a-meeting");

  const others = [
    { anchor: "mun933", title: "Agendas & Minutes", step: "agendas-and-minutes" },
    { anchor: "mun935", title: "Resolutions", step: "resolutions" },
    { anchor: "mun937", title: "Bylaws", step: "bylaws" },
    { anchor: "mun938", title: "Committees", step: "committees" },
  ];
  for (const other of others) {
    const figure = figureAt(page, other.anchor);
    await expectDrawnLikeTheOthers(figure, section);
    await expect(figure.locator(".phone .bar-title")).toHaveText(other.title);
    await shoot(figure, journey, other.step);
  }
});
