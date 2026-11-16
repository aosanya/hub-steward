import { filesHomePath, folderPath } from "./paths";

export const topLevel = "";

export const parentPathOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf("/"), 0));

export const lastNameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export const titleFor = (folderName: string, path: string) => (path === topLevel ? folderName : lastNameOf(path));

export const backLabelFor = (folderName: string, path: string) => {
  if (path === topLevel) return "Folders";
  const parent = parentPathOf(path);
  return parent === topLevel ? folderName : lastNameOf(parent);
};

export const backPathFor = (folderId: string, path: string) => (path === topLevel ? filesHomePath() : folderPath(folderId, parentPathOf(path)));
