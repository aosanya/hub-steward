import type { ComponentProps } from "react";
import { agencyTools, hasModule, modulesOf } from "../../../../features/agency/modules";
import { useLoad } from "../../../../features/forms/useLoad";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { useWide } from "../../../../shared/ui/useWide";
import { Shell } from "../../../Shell";
import { loadFailedWords, MenuList } from "../../MenuList";
import { MenuWindow } from "../../MenuWindow";
import { useBackToSection } from "../../useBackToSection";
import { notMountedWords } from "./words";

const assetModule = "assetmanager";

export type Detail = ComponentProps<typeof MenuWindow>["detail"];

type Props = ComponentProps<typeof MenuList> & { module?: string; detail?: Detail; version?: number };

const readMounts = async (module: string) => {
  const modules = modulesOf(await callTool("", agencyTools.modules, {}));
  return modules.length === 0 || hasModule({ name: "", modules }, module);
};

export function MountedMenuList({ module = assetModule, detail, version, ...props }: Props) {
  const wide = useWide();
  const back = useBackToSection();
  const mounted = useLoad(() => readMounts(module), `properties-mounts:${module}:${openAgencyId()}`);
  if (mounted.state === "ready" && mounted.data) {
    return detail && (wide || !props.onChoose) ? <MenuWindow title={props.title} list={props} detail={detail} listKey={version} detailKey={version} /> : <MenuList {...props} />;
  }
  return (
    <Shell title={props.title} titleUnder {...back}>
      {mounted.state === "loading" ? <LoadingLine words={props.loadingWords} /> : null}
      {mounted.state === "error" ? <LoadFailed words={props.failedWords ?? loadFailedWords} /> : null}
      {mounted.state === "ready" ? <EmptyCard words={notMountedWords} /> : null}
    </Shell>
  );
}
