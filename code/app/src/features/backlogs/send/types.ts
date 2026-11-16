export type Target = { backlogId: string; name: string; stepId: string; stepName: string };

export type SendResult = { sent: number; refusal: string };

export type SendClient = {
  targets: () => Promise<Target[]>;
  send: (issueIds: string[], target: Target) => Promise<SendResult>;
};
