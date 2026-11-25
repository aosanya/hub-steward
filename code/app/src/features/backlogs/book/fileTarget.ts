import type { RuleFile } from "../rulebook";

export type FileTarget = (file: RuleFile) => string | undefined;

export const noFileTarget: FileTarget = () => undefined;
