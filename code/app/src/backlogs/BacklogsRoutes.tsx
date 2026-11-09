import { Route, Routes } from "react-router-dom";
import { BacklogsPage } from "./BacklogsPage";
import { IssuePage } from "./IssuePage";
import { IssuesPage } from "./IssuesPage";

export function BacklogsRoutes() {
  return (
    <Routes>
      <Route index element={<BacklogsPage />} />
      <Route path="issue/:issueId" element={<IssuePage />} />
      <Route path=":backlogId" element={<IssuesPage />} />
    </Routes>
  );
}

export default BacklogsRoutes;
