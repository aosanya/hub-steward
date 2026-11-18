import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { dayWords } from "../../../../shared/ui/days";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { ChatAboutAsset, ChatAboutWorkOrder } from "./ChatAboutAsset";
import { WorkOrderAssignee } from "./WorkOrderAssignee";
import { WorkOrderStatus } from "./WorkOrderStatus";
import { maintenanceKeys } from "./maintenanceHistory";
import { MaintenanceHistory } from "./MaintenanceCard";
import { loadMaintenanceOf } from "./maintenanceRecords";
import { SectionGo } from "../residents/SectionAct";
import { assetEditPath, assetPathOf, scheduleEditPath, workOrderEditPath } from "./paths";
import { ruleWords } from "./scheduleWords";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const rowsOf = (pairs: [string, string][]) => pairs.filter(([, value]) => value !== "").map(([label, value]) => <ListRow key={label} title={label} meta={value} />);

const linesOf = (item: Item, keys: string[]) => keys.map((key) => textOf(item[key])).filter((line) => line !== "").map((line) => <ListRow key={line} title={line} />);

const movementKeys = ["movement0", "movement1", "movement2"];

function EditAct({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="sec-act" onClick={() => navigate(to)}>
      Edit
    </button>
  );
}

function PageHead({ name, line }: { name: string; line: string }) {
  return (
    <div className="title-block">
      <h1 className="person-name">{name}</h1>
      {line ? <p className="quiet-line">{line}</p> : null}
    </div>
  );
}

function Page({ name, line, children }: { name: string; line: string; children: ReactNode }) {
  return (
    <div className="person-page">
      <PageHead name={name} line={line} />
      <div className="sections">{children}</div>
    </div>
  );
}

export function AssetPanel({ asset }: { asset: Item }) {
  const may = useMay("asset.manage");
  const maintained = useLoad(() => loadMaintenanceOf({ id: textOf(asset.id), name: textOf(asset.name) }), `maintenance-of:${openAgencyId()}:${textOf(asset.id)}`);
  const lastDone = (maintained.state === "ready" ? maintained.data : []).find((one) => one.done !== "")?.done ?? "";
  const detail = rowsOf([
    ["Name", textOf(asset.name)],
    ["Code", textOf(asset.code)],
    ["Category", textOf(asset.category)],
    ["Condition", textOf(asset.condition)],
    ["Kept by", textOf(asset.keeperName)],
    ["Location", textOf(asset.place)],
  ]);
  return (
    <Page name={textOf(asset.name)} line={[textOf(asset.category), textOf(asset.condition), lastDone ? `Last maintained ${dayWords(lastDone)}` : ""].filter(Boolean).join(" · ")}>
      <ChatAboutAsset asset={asset} />
      <Section word="Asset detail" plain foot={may ? <EditAct to={assetEditPath.path({ id: textOf(asset.id) })} /> : undefined} rows={detail} />
      <Section word="Movements" icon="clock" plain rows={linesOf(asset, movementKeys)} />
      <MaintenanceHistory assetId={textOf(asset.id)} assetName={textOf(asset.name)} />
      <Section word="Finished work orders" icon="document" plain rows={linesOf(asset, maintenanceKeys)} />
    </Page>
  );
}

type WorkOrderPanelProps = { order: Item; onChanged: () => void };

export function WorkOrderPanel({ order, onChanged }: WorkOrderPanelProps) {
  const may = useMay("task.edit");
  const navigate = useNavigate();
  const detail = rowsOf([
    ["Title", textOf(order.title)],
    ["State", textOf(order.state)],
    ["Due", textOf(order.due)],
  ]);
  const opened = assetPathOf(textOf(order.aboutCategory), textOf(order.aboutId));
  const about = textOf(order.about) === "" ? [] : [<ListRow key="about" title={textOf(order.about)} meta={textOf(order.place)} end="›" onClick={opened === "" ? undefined : () => navigate(opened)} />];
  const foot = (
    <>
      {may ? <EditAct to={workOrderEditPath.path({ id: textOf(order.id) })} /> : null}
      <WorkOrderStatus order={order} onMoved={onChanged} />
    </>
  );
  return (
    <Page name={textOf(order.title)} line={textOf(order.state)}>
      <ChatAboutWorkOrder order={order} />
      <Section word="Work order" plain foot={foot} rows={detail} />
      <Section word="About" icon="box" rows={about} />
      <WorkOrderAssignee order={order} onAssigned={onChanged} />
    </Page>
  );
}

export function SchedulePanel({ item }: { item: Item }) {
  const rows = rowsOf([
    ["How often", textOf(item.often)],
    ["Last upkeep", textOf(item.lastUpkeep)],
    ["Last job due", textOf(item.lastJobDue)],
    ["Next upkeep", textOf(item.next)],
    ["Repeats", ruleWords(textOf(item.rule))],
  ]);
  return (
    <Page name={textOf(item.title)} line={textOf(item.oftenAndNext)}>
      <Section word="Schedule" plain rows={rows} foot={<SectionGo permission="task.edit" act="Edit" to={scheduleEditPath.path({ scheduleId: textOf(item.id) })} />} />
    </Page>
  );
}
