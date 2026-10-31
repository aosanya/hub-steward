import { userEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { answerWith, renderPage } from "../spec/profileTesting";

export const openLibrary = (view: ReactElement, page: string, replies: Record<string, unknown>, search = "") => {
  answerWith(replies);
  renderPage(view, page, search);
  return userEvent.setup();
};
