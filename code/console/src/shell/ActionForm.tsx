import { useEffect, useState } from "react";
import { toolSchema } from "../data/actionSchema";
import { formParamsOf } from "../data/chatActions";
import { useI18n } from "../i18n";
import { Empty, SchemaForm, useNotice, type FormValues } from "../ui";
import { callTool } from "../wakala/mcp";
import type { ActionViewProps } from "./actionViews";

export function ActionForm({ hubId, title, params, onDone }: ActionViewProps) {
  const { t } = useI18n();
  const notice = useNotice();
  const [schema, setSchema] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);
  const drawn = formParamsOf(params);
  const key = JSON.stringify(params);

  useEffect(() => {
    let live = true;
    setSchema(null);
    setFailed(drawn === null);
    if (drawn)
      toolSchema(drawn).then(
        (loaded) => live && setSchema(loaded),
        () => live && setFailed(true),
      );
    return () => {
      live = false;
    };
  }, [key]);

  if (failed || !drawn) return <Empty text={t("loadFailed")} failed />;
  if (!schema) return null;

  const submit = async (values: FormValues) => {
    try {
      await callTool(hubId, drawn.tool, { ...drawn.fixed, ...values });
    } catch (error) {
      return error instanceof Error && error.message !== "" ? error.message : t("submitFailed");
    }
    if (drawn.notice) notice.show(drawn.notice);
    onDone();
  };

  return <SchemaForm title={title} schema={schema} initial={drawn.initial} onSubmit={submit} onCancel={onDone} />;
}
