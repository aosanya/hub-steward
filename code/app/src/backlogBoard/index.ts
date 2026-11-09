import { createElement } from "react";
import { Route, Routes } from "react-router-dom";
import { BacklogBoard } from "./BacklogBoard";

export const BacklogBoardRoutes = () => createElement(Routes, null, createElement(Route, { path: ":backlogId/board", element: createElement(BacklogBoard) }));

export { boardPath } from "../backlogs/paths";
export { backlogPagePath } from "../backlogPage/paths";
