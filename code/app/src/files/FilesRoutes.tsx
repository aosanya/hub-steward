import { Route, Routes } from "react-router-dom";
import { useWide } from "../ui/useWide";
import { mcpFilesClient, type FilesClient } from "./api";
import { FilePage } from "./FilePage";
import { FolderPage } from "./FolderPage";
import { FoldersPage } from "./FoldersPage";
import { WideFiles } from "./WideFiles";

export function FilesRoutes({ client = mcpFilesClient }: { client?: FilesClient }) {
  const wide = useWide();
  return (
    <Routes>
      <Route index element={<FoldersPage client={client} />} />
      <Route path=":folderId" element={wide ? <WideFiles client={client} /> : <FolderPage client={client} />} />
      <Route path=":folderId/file" element={wide ? <WideFiles client={client} /> : <FilePage client={client} />} />
    </Routes>
  );
}
