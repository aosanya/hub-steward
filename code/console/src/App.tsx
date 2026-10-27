import { Navigate, Route, Routes } from "react-router-dom";
import { CreateHub } from "./entry/CreateHub";
import { ExpiredRedirect } from "./entry/ExpiredRedirect";
import { Gate } from "./entry/Gate";
import { Hubs } from "./entry/Hubs";
import { SignIn } from "./entry/SignIn";
import { Start } from "./entry/Start";
import { AgentEdit } from "./pages/agent/AgentEdit";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { ModelAddPage } from "./pages/models/ModelAddPage";
import { ModelPage } from "./pages/models/ModelPage";
import { ModelsPage } from "./pages/ModelsPage";
import { PageView } from "./pages/PageView";
import { WorkflowEdit } from "./pages/workflows/WorkflowEdit";
import { Frame } from "./shell/Frame";

export function App() {
  return (
    <>
      <ExpiredRedirect />
      <Routes>
        <Route path="/" element={<Gate />} />
        <Route path="/start" element={<Start />} />
        <Route path="/login" element={<SignIn />} />
        <Route path="/create" element={<CreateHub />} />
        <Route path="/hubs" element={<Hubs />} />
        <Route path="/h/:hubId" element={<Frame />}>
          <Route index element={<Navigate to="status" replace />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="models/new" element={<ModelAddPage />} />
          <Route path="models/:accountId" element={<Navigate to="key" replace />} />
          <Route path="models/:accountId/:tab" element={<ModelPage />} />
          <Route path="approvals" element={<Navigate to="pending" replace />} />
          <Route path="approvals/:tab" element={<ApprovalsPage />} />
          <Route path="agent-edit/:role" element={<Navigate to="model" replace />} />
          <Route path="agent-edit/:role/:tab" element={<AgentEdit />} />
          <Route path="workflow-edit/:id" element={<Navigate to="workflow" replace />} />
          <Route path="workflow-edit/:id/:tab" element={<WorkflowEdit />} />
          <Route path=":page" element={<PageView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
