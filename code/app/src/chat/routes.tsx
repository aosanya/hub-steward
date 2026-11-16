import { Route } from "react-router-dom";
import { AskPage } from "./AskPage";
import { RoomThreadPage } from "./rooms/RoomThreadPage";
import { RoomThreadsPage } from "./rooms/RoomThreadsPage";
import { chatPaths } from "./routePaths";

export const chatRoutes = () => (
  <>
    <Route path={chatPaths.roomThreads.pattern} element={<RoomThreadsPage />} />
    <Route path={chatPaths.roomThread.pattern} element={<RoomThreadPage heading="thread" />} />
    <Route path={chatPaths.ask.pattern} element={<AskPage />} />
  </>
);
