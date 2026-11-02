import { useEffect, useRef, useState } from "react";
import { approvalParamsOf } from "../data/chatActions";
import { useI18n } from "../i18n";
import { ActionCard, Empty, useNotice } from "../ui";
import { callTool } from "../wakala/mcp";
import type { ActionViewProps } from "./actionViews";

type ApprovalCardProps = { title: string; text?: string; notice?: string; run: () => Promise<unknown>; onDone: () => void };

export function ApprovalCard({ title, text, notice, run, onDone }: ApprovalCardProps) {
  const { t } = useI18n();
  const shown = useNotice();
  const [applying, setApplying] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const approve = async () => {
    if (applying) return;
    setApplying(true);
    try {
      await run();
    } catch (error) {
      if (mounted.current) setApplying(false);
      shown.show(error instanceof Error && error.message !== "" ? error.message : t("submitFailed"), "bad");
      return;
    }
    if (notice) shown.show(notice);
    if (mounted.current) onDone();
  };

  return (
    <ActionCard
      title={title}
      text={text}
      state="pending"
      buttons={[
        { label: t("approve"), kind: "primary", onClick: approve, disabled: applying },
        { label: t("decline"), kind: "quiet", onClick: onDone, disabled: applying },
      ]}
    />
  );
}

export function ActionApproval({ hubId, title, params, onDone }: ActionViewProps) {
  const { t } = useI18n();
  const approval = approvalParamsOf(params);
  if (!approval) return <Empty text={t("loadFailed")} failed />;
  return (
    <ApprovalCard
      key={JSON.stringify(params)}
      title={title}
      text={approval.text}
      notice={approval.notice}
      run={() => callTool(hubId, approval.tool, approval.arguments)}
      onDone={onDone}
    />
  );
}
