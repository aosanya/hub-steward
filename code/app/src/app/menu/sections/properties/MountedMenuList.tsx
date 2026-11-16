import type { ComponentProps } from "react";
import { agencyTools, hasModule, modulesOf } from "../../../../features/agency/modules";
import { useLoad } from "../../../../features/forms/useLoad";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { loadFailedWords, MenuList } from "../../MenuList";
import { useBackToSection } from "../../useBackToSection";
import { notMountedWords } from "./words";

const assetModule = "assetmanager";

type Props = ComponentProps<typeof MenuList> & { module?: string };

const readMounts = async (module: string) => {
  const modules = modulesOf(await callTool("", agencyTools.modules, {}));
  return modules.length === 0 || hasModule({ name: "", modules }, module);
};

export function MountedMenuList({ module = assetModule, ...props }: Props) {
  const back = useBackToSection();
  const mounted = useLoad(() => readMounts(module), `properties-mounts:${module}:${openAgencyId()}`);
  if (mounted.state === "ready" && mounted.data) return <MenuList {...props} />;
  return (
    <Shell title={props.title} titleUnder {...back}>
      {mounted.state === "loading" ? <LoadingLine words={props.loadingWords} /> : null}
      {mounted.state === "error" ? <LoadFailed words={props.failedWords ?? loadFailedWords} /> : null}
      {mounted.state === "ready" ? <EmptyCard words={notMountedWords} /> : null}
    </Shell>
  );
}
