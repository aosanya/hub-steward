import { createElement } from "react";
import { Route, Routes } from "react-router-dom";
import { BacklogBoard } from "./BacklogBoard";

export const BacklogBoardRoutes = () => createElement(Routes, null, createElement(Route, { path: ":backlogId/board", element: createElement(BacklogBoard) }));

export { boardPath } from "../shared/paths";
export { backlogPagePath } from "../page/paths";
export { BoardColumns } from "./BoardColumns";
export { columnsOf, stepsOfIssues } from "./board";
export { useView, ViewSwitch, type View } from "./ViewSwitch";
