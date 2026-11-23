import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actionsName = /^actions$/i;

const headerToggle = async () => {
  const toggles = await screen.findAllByRole("button", { name: actionsName });
  return toggles.find((toggle) => toggle.closest(".top")) ?? toggles[0];
};

export const openActions = async () => {
  const toggle = await headerToggle();
  if (toggle.getAttribute("aria-expanded") !== "true") await userEvent.click(toggle);
};

export const actionItem = async (name: string | RegExp) => {
  await openActions();
  return screen.findByRole("menuitem", { name });
};

export const chooseAction = async (name: string | RegExp) => {
  await userEvent.click(await actionItem(name));
};

export const actionNames = async () => {
  if (!document.querySelector(".top .actions > button")) return [];
  await openActions();
  const menu = document.querySelector(".top .actions-menu");
  return Array.from(menu?.querySelectorAll("[role=menuitem]") ?? []).map((item) => item.textContent ?? "");
};
