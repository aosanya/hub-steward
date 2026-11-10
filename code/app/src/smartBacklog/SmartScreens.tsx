import { useLocation, useNavigate, useParams } from "react-router-dom";
import { backlogsHomePath } from "../backlogs/paths";
import { openAgencyId } from "../agency/open";
import { useLoad } from "../forms/useLoad";
import { LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { mcpSmartBacklogClient } from "./api";
import { RulesScreen } from "./RulesScreen";
import { smartBacklogPath } from "./paths";
import { deletedWords } from "./words";
import type { Draft } from "./rulesDraft";
import type { SmartBacklogClient } from "./types";

type Props = { client?: SmartBacklogClient };

export function AddSmartBacklogScreen({ client = mcpSmartBacklogClient }: Props) {
  const navigate = useNavigate();
  const initial = (useLocation().state as { draft?: Draft } | null)?.draft;
  const choices = useLoad(() => client.choices(), `smart-choices:${openAgencyId()}`);
  const back = () => navigate(backlogsHomePath());
  if (choices.state === "loading") return <Shell title="Add a smart backlog" onBack={back} tabless><LoadingLine /></Shell>;
  if (choices.state === "error") return <Shell title="Add a smart backlog" onBack={back} tabless><LoadFailed words="The tags and steps could not be loaded." /></Shell>;
  return (
    <RulesScreen
      choices={choices.data}
      count={client.count}
      initial={initial}
      onBack={back}
      onCreate={async (name, set) => navigate(smartBacklogPath(await client.create(name, set)))}
      onOpenExisting={(id) => navigate(smartBacklogPath(id))}
    />
  );
}

export function EditSmartBacklogScreen({ client = mcpSmartBacklogClient }: Props) {
  const navigate = useNavigate();
  const backlogId = useParams().backlogId ?? "";
  const loaded = useLoad(async () => ({ choices: await client.choices(), backlog: await client.read(backlogId), may: await client.mayManage().catch(() => false) }), `smart-edit:${openAgencyId()}:${backlogId}`);
  const back = () => navigate(smartBacklogPath(backlogId));
  if (loaded.state === "loading") return <Shell title="Edit rules" onBack={back} tabless><LoadingLine /></Shell>;
  if (loaded.state === "error") return <Shell title="Edit rules" onBack={back} tabless><LoadFailed words="The smart backlog could not be loaded." /></Shell>;
  const { choices, backlog, may } = loaded.data;
  const initial: Draft = { name: backlog.name, match: backlog.set.match, rules: backlog.set.rules };
  return (
    <RulesScreen
      choices={choices}
      count={client.count}
      initial={initial}
      title={`Edit ${backlog.name}`}
      submitLabel="Save"
      onBack={back}
      onCreate={async (name, set) => {
        await client.update(backlogId, name, set);
        navigate(smartBacklogPath(backlogId));
      }}
      onOpenExisting={(id) => navigate(smartBacklogPath(id))}
      onDelete={
        may
          ? async () => {
              await client.remove(backlogId);
              navigate(backlogsHomePath(), { state: { notice: deletedWords(backlog.name) } });
            }
          : undefined
      }
    />
  );
}
