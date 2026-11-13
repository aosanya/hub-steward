import { callTool } from "../wakala/mcp";

export type PublishedReport = { version: number; gitPath: string; publishedAt: string };

export type PublishClient = {
  holds(): Promise<boolean>;
  closedFormId(formName: string): Promise<string | null>;
  latest(formId: string): Promise<PublishedReport | null>;
  publish(formId: string, gitPath: string, gitCommit: string): Promise<PublishedReport>;
};

const REPORT_PUBLISH = "report.publish";

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const normal = (value: unknown) => text(value).trim().toLowerCase();

export const holdsReportPublish = (reply: any): boolean => Array.isArray(reply?.permissions) && reply.permissions.includes(REPORT_PUBLISH);

export const closedFormIdOf = (items: any[], formName: string): string | null => {
  const form = (Array.isArray(items) ? items : []).find((item) => normal(item?.status) === "closed" && normal(item?.title) === normal(formName));
  return form?.id ? text(form.id) : null;
};

const reportOf = (raw: any): PublishedReport => ({
  version: Number(raw?.version ?? 0),
  gitPath: text(raw?.git_path),
  publishedAt: text(raw?.published_at),
});

const itemsOf = (reply: any): any[] => (Array.isArray(reply) ? reply : Array.isArray(reply?.items) ? reply.items : []);

export const mcpPublishClient: PublishClient = {
  holds: async () => holdsReportPublish(await callTool("", "agency_get_my_roles", {})),
  closedFormId: async (formName) => closedFormIdOf(itemsOf(await callTool("", "forms_form_list", {})), formName),
  latest: async (formId) => {
    try {
      return reportOf(await callTool("", "forms_results_read", { form_id: formId }));
    } catch {
      return null;
    }
  },
  publish: async (formId, gitPath, gitCommit) => reportOf(await callTool("", "forms_results_publish", { form_id: formId, git_path: gitPath, git_commit: gitCommit })),
};
