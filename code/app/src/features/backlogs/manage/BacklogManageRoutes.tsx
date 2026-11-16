import { Route, Routes } from "react-router-dom";
import { AddBacklogScreen } from "./AddBacklogScreen";
import { EditBacklogScreen } from "./EditBacklogScreen";

export function BacklogManageRoutes() {
  return (
    <Routes>
      <Route path="new" element={<AddBacklogScreen />} />
      <Route path=":backlogId/edit" element={<EditBacklogScreen />} />
    </Routes>
  );
}
