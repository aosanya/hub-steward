import { callTool } from "../wakala/mcp";

export type WaitingForm = {
  form_id: string;
  title: string;
  closes_at: string;
  questions: number;
  publisher_name?: string;
  publishing_authority?: string;
  originator_chapter_id?: string;
  group?: string;
  answered: boolean;
  unanswered_as: string[];
};

export type AnsweredForm = {
  send_id: string;
  form_id: string;
  title: string;
  closes_at: string;
  open: boolean;
  answered_at: string;
  chapter_id?: string;
};

export type Choice = { id: string; label: string };

export type FormQuestion = {
  id: string;
  prompt: string;
  answer_type: string;
  required: boolean;
  helper?: string;
  yes_label?: string;
  no_label?: string;
  max_files?: number;
  require_capture?: boolean;
  options: Choice[];
};

export type StandingForm = { form_id: string; title: string; landing: string };

export type Answer = {
  question_id: string;
  value_text?: string;
  value_number?: number;
  value_bool?: boolean;
  value_date?: string;
  value_time?: string;
  option_ids?: string[];
  file_ids?: string[];
};

export type FormsClient = {
  waiting(): Promise<WaitingForm[]>;
  answered(): Promise<AnsweredForm[]>;
  standing(): Promise<StandingForm[]>;
  questions(formId: string): Promise<FormQuestion[]>;
  submit(formId: string, answers: Answer[], as?: string): Promise<void>;
};

const items = <T>(reply: any): T[] => (Array.isArray(reply?.items) ? reply.items : []);

export const liveClient: FormsClient = {
  waiting: async () => {
    const [forms, groups] = await Promise.all([
      callTool("", "forms_form_list_waiting").then(items<WaitingForm>),
      callTool("", "actor_list_my_groups", {}).then(items<{ id: string; name: string }>, () => []),
    ]);
    const names = new Map(groups.map((g) => [g.id, g.name]));
    return forms.map((f) => {
      const group = f.originator_chapter_id ? names.get(f.originator_chapter_id) : undefined;
      return group ? { ...f, group } : f;
    });
  },
  standing: async () => [],
  answered: async () => items<AnsweredForm>(await callTool("", "forms_form_list_answered")),
  questions: async (formId) => {
    const reply = await callTool("", "forms_question_list", { form_id: formId });
    return items<any>(reply).map((entry) => {
      const q = entry.question ?? entry;
      return {
        id: q.id,
        prompt: q.prompt,
        answer_type: q.answer_type,
        required: Boolean(q.required),
        helper: q.helper,
        yes_label: q.yes_label,
        no_label: q.no_label,
        max_files: typeof q.max_files === "number" ? q.max_files : undefined,
        require_capture: q.require_capture ? true : undefined,
        options: (entry.options ?? q.options ?? []).map((o: any) => ({ id: o.id, label: o.label })),
      };
    });
  },
  submit: async (formId, answers, as) => {
    await callTool("", "forms_answer_submit", { form_id: formId, answers, ...(as ? { as } : {}) });
  },
};
