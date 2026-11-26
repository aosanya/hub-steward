import type { AgencyRole } from "../../../shared/wakala/agencyRoles";

export type QuestionOption = { text: string; recommended: boolean; reason: string };

export type Question = {
  id: string;
  code: string;
  title: string;
  body: string;
  priority: string;
  status: string;
  targetRole: string;
  options: QuestionOption[];
  answer: string;
  tags: string[];
};

export type Choice = { option: number } | { other: string };

export type Standing = { holds: (role: string) => boolean; nameOf: (role: string) => string; canAsk: boolean };

export type NewQuestion = {
  title: string;
  body: string;
  priority: string;
  targetRole: string;
  options: QuestionOption[];
  tags: string[];
  issueId: string;
};

export type QuestionsClient = {
  forIssue: (issueId: string) => Promise<Question[]>;
  read: (code: string) => Promise<Question>;
  list: (backlogId: string, statuses: string[]) => Promise<Question[]>;
  answer: (code: string, choice: Choice) => Promise<void>;
  standing: () => Promise<Standing>;
  ask?: (question: NewQuestion) => Promise<string>;
  roles?: () => Promise<AgencyRole[]>;
  closedForIssue?: (issueId: string, tags: string[]) => Promise<Question[]>;
};
