import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { words } from "../entry/words";
import { routes } from "../routes";
import { CouncilViewLink } from "./CouncilViewLink";
import { councilViewOf } from "./stepLinks";

const lateStep = { title: "Let us approve the list and present it at the meeting" };
const risksStep = { title: "At the meeting we go through the risks" };
const otherStep = { title: "Refer the case" };

afterEach(cleanup);

const shown = (step: { title: string }) =>
  render(
    <MemoryRouter>
      <CouncilViewLink step={step} />
    </MemoryRouter>,
  );

describe("council step links", () => {
  it("names the late matters view for the approve-the-list step", () => {
    expect(councilViewOf(lateStep)).toBe("lateMatters");
  });

  it("names the risks view for the meeting step", () => {
    expect(councilViewOf(risksStep)).toBe("councilRisks");
  });

  it("names no view for another step", () => {
    expect(councilViewOf(otherStep)).toBeNull();
  });

  it("links the late matters step to the late matters screen", () => {
    shown(lateStep);
    expect(screen.getByRole("link", { name: words.lateMattersTitle }).getAttribute("href")).toBe(routes.lateMatters.path());
  });

  it("links the meeting step to the council risks screen", () => {
    shown(risksStep);
    expect(screen.getByRole("link", { name: words.councilRisksTitle }).getAttribute("href")).toBe(routes.councilRisks.path());
  });

  it("renders nothing for another step", () => {
    const { container } = shown(otherStep);
    expect(container.innerHTML).toBe("");
  });
});
