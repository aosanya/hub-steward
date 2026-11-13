import { Route, Routes } from "react-router-dom";
import { mcpFilesClient, type FilesClient } from "./api";
import { FilePage } from "./FilePage";
import { FolderPage } from "./FolderPage";
import { FoldersPage } from "./FoldersPage";

export function FilesRoutes({ client = mcpFilesClient }: { client?: FilesClient }) {
  return (
    <Routes>
      <Route index element={<FoldersPage client={client} />} />
      <Route path=":folderId" element={<FolderPage client={client} />} />
      <Route path=":folderId/file" element={<FilePage client={client} />} />
    </Routes>
  );
}
