import { Route, Routes } from "react-router-dom";
import { BacklogBoard } from "../backlogBoard/BacklogBoard";
import { BacklogPage, backlogPageRoutePath } from "../backlogPage";
import { AddBacklogScreen, EditBacklogScreen } from "../backlogManage";
import { BacklogsPage } from "./BacklogsPage";
import { IssuePage } from "./IssuePage";
import { IssuesPage } from "./IssuesPage";

export function BacklogsRoutes() {
  return (
    <Routes>
      <Route index element={<BacklogsPage />} />
      <Route path="issue/:issueId" element={<IssuePage />} />
      <Route path="new" element={<AddBacklogScreen />} />
      <Route path=":backlogId/edit" element={<EditBacklogScreen />} />
      <Route path=":backlogId/board" element={<BacklogBoard />} />
      <Route path={backlogPageRoutePath} element={<BacklogPage />} />
      <Route path=":backlogId" element={<IssuesPage />} />
    </Routes>
  );
}

export default BacklogsRoutes;
